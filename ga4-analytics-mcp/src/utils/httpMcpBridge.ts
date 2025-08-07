/**
 * HTTP MCP Bridge
 * 
 * Provides HTTP-based MCP communication for React frontend clients
 * while maintaining the existing stdio/IPC MCP server for AI tools.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from './logger.js';
import { IncomingMessage, ServerResponse } from 'node:http';

interface HttpMcpBridgeOptions {
  port?: number;
  host?: string;
}

interface SessionInfo {
  transport: SSEServerTransport;
  server: Server;
  createdAt: Date;
}

/**
 * HTTP MCP Bridge Server
 */
export class HttpMcpBridge {
  private mcpServer: Server;
  private port: number;
  private host: string;
  private app: express.Application;
  private server: any = null;
  private sessions: Map<string, SessionInfo> = new Map();
  
  constructor(mcpServer: Server, options: HttpMcpBridgeOptions = {}) {
    this.mcpServer = mcpServer;
    this.port = options.port || 3004;
    this.host = options.host || 'localhost';
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS for React frontend
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS']
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.text());
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`HTTP MCP Bridge: ${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'HTTP MCP Bridge',
        port: this.port,
        sessions: this.sessions.size,
        timestamp: new Date().toISOString()
      });
    });

    // MCP SSE endpoint - the SDK expects this exact path
    this.app.get('/sse', async (req, res) => {
      try {
        logger.info('New MCP SSE connection request');
        
        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        });
        
        // Create SSE transport
        const transport = new SSEServerTransport('/message', res as any);

        // Create new MCP server instance for this session
        const sessionServer = await this.createSessionServer();
        
        // Generate session ID
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Store session
        this.sessions.set(sessionId, {
          transport,
          server: sessionServer,
          createdAt: new Date()
        });

        // Connect server to transport
        await sessionServer.connect(transport);
        
        // Handle cleanup
        req.on('close', () => {
          logger.info(`MCP session closed: ${sessionId}`);
          this.sessions.delete(sessionId);
        });

        logger.info(`MCP SSE connection established: ${sessionId}`);
        
      } catch (error) {
        logger.error('Failed to establish MCP SSE connection', error as Error);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Failed to establish MCP connection',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
    
    // Keep the old endpoint for compatibility
    this.app.get('/mcp/connect', (req, res) => {
      res.redirect('/sse');
    });

    // MCP message endpoint (POST) - SSE transport expects /message
    this.app.post('/message', async (req, res) => {
      try {
        const sessionId = req.query.sessionId || req.headers['x-session-id'];
        
        if (!sessionId || typeof sessionId !== 'string') {
          return res.status(400).json({ error: 'Session ID required' });
        }

        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }

        // Handle the POST message
        await session.transport.handlePostMessage(req, res, req.body);
        
      } catch (error) {
        logger.error('Failed to handle MCP message', error as Error);
        res.status(500).json({ 
          error: 'Failed to process MCP message',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Simple JSON-RPC endpoint for direct API calls
    this.app.post('/api/mcp', async (req, res) => {
      try {
        const { method, params, id } = req.body;
        
        logger.info(`Direct MCP API call: ${method}`, { params, id });

        // Handle the request directly without SSE/WebSocket complexity
        const response = await this.handleDirectApiCall(method, params, id);
        
        res.json(response);
        
      } catch (error) {
        logger.error('Direct RPC call failed', error as Error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: req.body.id || null
        });
      }
    });

    // Session management
    this.app.get('/mcp/sessions', (req, res) => {
      const sessionInfo = Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        connected: true
      }));
      
      res.json({
        count: this.sessions.size,
        sessions: sessionInfo
      });
    });

    this.app.delete('/mcp/sessions/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId;
      const session = this.sessions.get(sessionId);
      
      if (session) {
        session.transport.close();
        this.sessions.delete(sessionId);
        res.json({ message: 'Session closed' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    });
  }

  /**
   * Create a new MCP server instance for a session
   */
  private async createSessionServer(): Promise<Server> {
    // Create new server with the same tools as the main server
    const server = new Server(
      {
        name: 'ga4-analytics-mcp-http',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Copy tool handlers from the main server
    if ((this.mcpServer as any)._toolHandlers) {
      (server as any)._toolHandlers = new Map((this.mcpServer as any)._toolHandlers);
    }

    // Copy other handlers
    if ((this.mcpServer as any)._listToolsHandler) {
      (server as any)._listToolsHandler = (this.mcpServer as any)._listToolsHandler;
    }

    return server;
  }

  /**
   * Handle direct API calls without SSE/WebSocket
   */
  private async handleDirectApiCall(method: string, params: any, id: any): Promise<any> {
    try {
      // Use the main MCP server directly
      const handlers = (this.mcpServer as any)._toolHandlers;
      const listToolsHandler = (this.mcpServer as any)._listToolsHandler;
      
      switch (method) {
        case 'tools/list':
          if (listToolsHandler) {
            const result = await listToolsHandler();
            return {
              jsonrpc: '2.0',
              result,
              id
            };
          }
          break;
          
        case 'tools/call':
          if (handlers && handlers.has(params.name)) {
            const handler = handlers.get(params.name);
            const result = await handler(params.arguments || {});
            return {
              jsonrpc: '2.0',
              result,
              id
            };
          }
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      throw new Error(`No handler for method: ${method}`);
      
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error)
        },
        id
      };
    }
  }

  /**
   * Handle direct RPC calls for testing (legacy)
   */
  private async handleDirectRpcCall(server: Server, method: string, params: any, id: any): Promise<any> {
    try {
      switch (method) {
        case 'tools/list':
          if ((server as any)._listToolsHandler) {
            const result = await (server as any)._listToolsHandler();
            return {
              jsonrpc: '2.0',
              result,
              id
            };
          }
          break;
          
        case 'tools/call':
          if ((server as any)._toolHandlers && (server as any)._toolHandlers.has(params.name)) {
            const handler = (server as any)._toolHandlers.get(params.name);
            const result = await handler(params.arguments || {});
            return {
              jsonrpc: '2.0',
              result,
              id
            };
          }
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      throw new Error(`No handler for method: ${method}`);
      
    } catch (error) {
              return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: error instanceof Error ? error.message : String(error)
          },
          id
        };
    }
  }

  /**
   * Start the HTTP MCP bridge server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, (error) => {
        if (error) {
          logger.error('Failed to start HTTP MCP bridge', error);
          reject(error);
        } else {
          logger.info(`🌉 HTTP MCP Bridge started on http://${this.host}:${this.port}`);
          logger.info(`   MCP Connect: http://${this.host}:${this.port}/mcp/connect`);
          logger.info(`   Direct RPC: http://${this.host}:${this.port}/mcp/rpc`);
          logger.info(`   Health: http://${this.host}:${this.port}/health`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the HTTP MCP bridge server
   */
  async stop(): Promise<void> {
    // Close all sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.transport.close();
      } catch (error) {
        logger.error(`Error closing session ${sessionId}`, error as Error);
      }
    }
    this.sessions.clear();

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('HTTP MCP Bridge stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Get bridge status
   */
  getStatus(): any {
    return {
      running: !!this.server,
      port: this.port,
      host: this.host,
      activeSessions: this.sessions.size,
      uptime: this.server ? process.uptime() : 0
    };
  }
}

export default HttpMcpBridge;