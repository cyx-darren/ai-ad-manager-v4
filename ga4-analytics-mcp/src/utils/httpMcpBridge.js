/**
 * HTTP MCP Bridge
 * 
 * Provides HTTP-based MCP communication for React frontend clients
 * while maintaining the existing stdio/IPC MCP server for AI tools.
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from './logger.js';

/**
 * HTTP MCP Bridge Server
 */
export class HttpMcpBridge {
  constructor(mcpServer, options = {}) {
    this.mcpServer = mcpServer;
    this.port = options.port || 3004;
    this.host = options.host || 'localhost';
    this.app = express();
    this.server = null;
    this.sessions = new Map(); // Track MCP sessions
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
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
    this.app.use((req, res, next) => {
      logger.info(`HTTP MCP Bridge: ${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body
      });
      next();
    });
  }

  setupRoutes() {
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

    // MCP SSE connection endpoint
    this.app.get('/mcp/connect', async (req, res) => {
      try {
        logger.info('New MCP SSE connection request');
        
        // Create SSE transport
        const transport = new SSEServerTransport('/mcp/message', res, {
          allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
          enableDnsRebindingProtection: true
        });

        // Create new MCP server instance for this session
        const sessionServer = await this.createSessionServer();
        
        // Store session
        this.sessions.set(transport.sessionId, {
          transport,
          server: sessionServer,
          createdAt: new Date()
        });

        // Connect server to transport
        await sessionServer.connect(transport);
        
        // Handle cleanup
        transport.onclose = () => {
          logger.info(`MCP session closed: ${transport.sessionId}`);
          this.sessions.delete(transport.sessionId);
        };

        transport.onerror = (error) => {
          logger.error(`MCP session error: ${transport.sessionId}`, error);
          this.sessions.delete(transport.sessionId);
        };

        // Start SSE stream
        await transport.start();
        
        logger.info(`MCP SSE connection established: ${transport.sessionId}`);
        
      } catch (error) {
        logger.error('Failed to establish MCP SSE connection', error);
        res.status(500).json({ 
          error: 'Failed to establish MCP connection',
          details: error.message 
        });
      }
    });

    // MCP message endpoint (POST)
    this.app.post('/mcp/message', async (req, res) => {
      try {
        const sessionId = req.query.sessionId || req.headers['x-session-id'];
        
        if (!sessionId) {
          return res.status(400).json({ error: 'Session ID required' });
        }

        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }

        // Handle the POST message
        await session.transport.handlePostMessage(req, res, req.body);
        
      } catch (error) {
        logger.error('Failed to handle MCP message', error);
        res.status(500).json({ 
          error: 'Failed to process MCP message',
          details: error.message 
        });
      }
    });

    // Simple JSON-RPC endpoint for testing
    this.app.post('/mcp/rpc', async (req, res) => {
      try {
        const { method, params, id } = req.body;
        
        logger.info(`Direct RPC call: ${method}`, { params, id });

        // Create a temporary session for direct calls
        const tempSessionServer = await this.createSessionServer();
        
        // Simulate JSON-RPC call
        const response = await this.handleDirectRpcCall(tempSessionServer, method, params, id);
        
        res.json(response);
        
      } catch (error) {
        logger.error('Direct RPC call failed', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
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
  async createSessionServer() {
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
    if (this.mcpServer._toolHandlers) {
      server._toolHandlers = new Map(this.mcpServer._toolHandlers);
    }

    // Copy other handlers
    if (this.mcpServer._listToolsHandler) {
      server._listToolsHandler = this.mcpServer._listToolsHandler;
    }

    return server;
  }

  /**
   * Handle direct RPC calls for testing
   */
  async handleDirectRpcCall(server, method, params, id) {
    try {
      switch (method) {
        case 'tools/list':
          if (server._listToolsHandler) {
            const result = await server._listToolsHandler();
            return {
              jsonrpc: '2.0',
              result,
              id
            };
          }
          break;
          
        case 'tools/call':
          if (server._toolHandlers && server._toolHandlers.has(params.name)) {
            const handler = server._toolHandlers.get(params.name);
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
          data: error.message
        },
        id
      };
    }
  }

  /**
   * Start the HTTP MCP bridge server
   */
  async start() {
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
  async stop() {
    // Close all sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.transport.close();
      } catch (error) {
        logger.error(`Error closing session ${sessionId}`, error);
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
  getStatus() {
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