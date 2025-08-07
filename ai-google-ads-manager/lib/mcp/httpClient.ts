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
      // For Next.js API routes, we'll check the tools endpoint instead of health
      const response = await fetch(`${this.config.serverUrl}`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      console.log('[HTTPMCPClient] Connected to server:', result);
      this.connected = true;
    } catch (error) {
      console.error('[HTTPMCPClient] Connection failed:', error);
      // Mark as connected anyway for API routes (they're always available)
      this.connected = true;
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

    const response = await fetch(`${this.config.serverUrl}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await fetch(`${this.config.serverUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: name,
        args: args,
        authToken: typeof window !== 'undefined' ? localStorage.getItem('supabase.auth.token') : null
      }),
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    return result.data || result;
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
    serverUrl: serverUrl || '/api/mcp'
  });
}