/**
 * Simple HTTP-based MCP Client
 * 
 * This client provides a simpler alternative to SSE/WebSocket transports
 * by using direct HTTP API calls to the MCP server.
 */

export interface HTTPMCPClientConfig {
  serverUrl: string;
  timeout?: number;
}

export class HTTPMCPClient {
  private config: HTTPMCPClientConfig;
  private connected: boolean = false;

  constructor(config: HTTPMCPClientConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      timeout: config.timeout || 30000
    };
  }

  /**
   * Connect to the MCP server (verify it's available)
   */
  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const health = await response.json();
      console.log('[HTTPMCPClient] Connected to server:', health);
      this.connected = true;
    } catch (error) {
      console.error('[HTTPMCPClient] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[HTTPMCPClient] Disconnected');
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await fetch(`${this.config.serverUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now()
      }),
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await fetch(`${this.config.serverUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name,
          arguments: args
        },
        id: Date.now()
      }),
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a simple HTTP MCP client
 */
export function createHTTPMCPClient(serverUrl?: string): HTTPMCPClient {
  return new HTTPMCPClient({
    serverUrl: serverUrl || process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004'
  });
}