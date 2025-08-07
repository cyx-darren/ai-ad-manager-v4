/**
 * MCP API Route Handler
 * 
 * This route connects to the GA4 Analytics MCP server for real analytics data.
 * It handles authentication and forwards tool calls to the GA4 MCP instance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// MCP client instance (singleton)
let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;
let mcpServerProcess: ChildProcess | null = null;

/**
 * Initialize MCP client connection to GA4 Analytics server
 */
async function initializeMCPClient(): Promise<Client> {
  if (mcpClient && mcpTransport) {
    return mcpClient;
  }

  try {
    console.log('[MCP API] Initializing connection to GA4 Analytics MCP server...');
    
    // Path to GA4 Analytics MCP server
    const mcpServerPath = path.join(process.cwd(), '..', 'ga4-analytics-mcp');
    
    console.log(`[MCP API] MCP server path: ${mcpServerPath}`);
    
    // Spawn the GA4 MCP server process
    mcpServerProcess = spawn('node', ['dist/index.js'], {
      cwd: mcpServerPath,
      env: {
        ...process.env,
        // Pass GA4 configuration to the MCP server
        GA4_PROPERTY_ID: '255973574', // Your GA4 property ID
        GOOGLE_APPLICATION_CREDENTIALS: '/Users/darrenchoong/Desktop/cursor projects/ai-ad-manager-v4/ai-google-ads-manager/ga4-service-account.json',
        NODE_ENV: 'development',
        MCP_SERVER_PORT: '3003',
        MCP_SERVER_HOST: '0.0.0.0'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server process events
    mcpServerProcess.on('error', (error) => {
      console.error('[MCP API] Server process error:', error);
    });

    mcpServerProcess.stderr?.on('data', (data) => {
      console.log('[MCP Server]', data.toString());
    });

    mcpServerProcess.stdout?.on('data', (data) => {
      console.log('[MCP Server]', data.toString());
    });

    // Create stdio transport
    mcpTransport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      cwd: mcpServerPath,
      env: {
        ...process.env,
        GA4_PROPERTY_ID: '255973574',
        GOOGLE_APPLICATION_CREDENTIALS: '/Users/darrenchoong/Desktop/cursor projects/ai-ad-manager-v4/ai-google-ads-manager/ga4-service-account.json',
        NODE_ENV: 'development'
      }
    });

    // Create MCP client
    mcpClient = new Client(
      {
        name: 'ai-ad-manager-api',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Connect to the MCP server
    await mcpClient.connect(mcpTransport);
    console.log('[MCP API] Connected to GA4 Analytics MCP server successfully');
    
    return mcpClient;
    
  } catch (error) {
    console.error('[MCP API] Failed to initialize MCP client:', error);
    // Clean up on failure
    if (mcpServerProcess) {
      mcpServerProcess.kill();
      mcpServerProcess = null;
    }
    mcpClient = null;
    mcpTransport = null;
    throw error;
  }
}

/**
 * Fallback mock data generator for when MCP server fails
 */
function generateFallbackData(tool: string): any {
  const now = new Date();

  switch (tool) {
    case 'query_analytics':
      return {
        totals: [{ metricValues: [{ value: Math.floor(Math.random() * 10000) + 1000 }] }],
        totalSessions: Math.floor(Math.random() * 10000) + 1000,
        totalUsers: Math.floor(Math.random() * 8000) + 800,
        bounceRate: (Math.random() * 0.5 + 0.2).toFixed(3),
        timestamp: now.toISOString(),
        source: 'fallback'
      };
    
    case 'get_conversion_data':
      return {
        totalConversions: Math.floor(Math.random() * 500) + 50,
        conversions: Math.floor(Math.random() * 500) + 50,
        timestamp: now.toISOString(),
        source: 'fallback'
      };
    
    default:
      return {
        data: 'Fallback data for ' + tool,
        timestamp: now.toISOString(),
        source: 'fallback'
      };
  }
}

/**
 * Handle POST requests to call MCP tools
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { tool, args, authToken } = body;

    if (!tool) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    // Verify authentication if token provided (optional for now)
    if (authToken) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(authToken);
        if (error && process.env.NODE_ENV === 'production') {
          console.warn('[MCP API] Auth verification failed:', error.message);
        }
      } catch (authError) {
        console.warn('[MCP API] Auth check failed:', authError);
        // Continue anyway for development
      }
    }

    console.log(`[MCP API] Calling tool: ${tool} with args:`, args);

    try {
      // Initialize MCP client connection to GA4 server
      const client = await initializeMCPClient();

      // Call the real GA4 MCP tool
      const result = await client.callTool({
        name: tool,
        arguments: args || {}
      });

      console.log(`[MCP API] Tool ${tool} executed successfully`);

      return NextResponse.json({
        success: true,
        data: result.content?.[0] || result,
        timestamp: new Date().toISOString(),
        tool: tool,
        source: 'ga4-mcp'
      });

    } catch (mcpError) {
      console.error(`[MCP API] MCP tool execution failed for ${tool}:`, mcpError);
      
      // Check if feature flag allows fallback
      try {
        const { data: fallbackFlag } = await supabase
          .from('feature_flags')
          .select('is_enabled')
          .eq('flag_name', 'metric_cards_fallback_enabled')
          .single();

        if (fallbackFlag?.is_enabled) {
          console.log(`[MCP API] Using fallback data for ${tool}`);
          const fallbackData = generateFallbackData(tool);
          
          return NextResponse.json({
            success: true,
            data: fallbackData,
            timestamp: new Date().toISOString(),
            tool: tool,
            source: 'fallback',
            warning: 'MCP server unavailable, using fallback data'
          });
        }
      } catch (fallbackError) {
        console.warn('[MCP API] Could not check fallback flag:', fallbackError);
      }

      // If no fallback allowed, return error
      throw mcpError;
    }

  } catch (error) {
    console.error('MCP API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute MCP tool',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests to list available tools
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[MCP API] Listing available tools...');

    try {
      // Try to connect to real MCP server and list tools
      const client = await initializeMCPClient();
      const toolsResponse = await client.listTools();
      
      console.log('[MCP API] Successfully retrieved tools from GA4 MCP server');

      return NextResponse.json({
        success: true,
        tools: toolsResponse.tools || [],
        timestamp: new Date().toISOString(),
        source: 'ga4-mcp'
      });

    } catch (mcpError) {
      console.warn('[MCP API] Could not connect to MCP server, returning fallback tools:', mcpError);
      
      // Return fallback tool list
      const fallbackTools = [
        {
          name: 'query_analytics',
          description: 'Query Google Analytics 4 data for sessions, users, and bounce rate',
          inputSchema: {
            type: 'object',
            properties: {
              metrics: { type: 'array', items: { type: 'string' } },
              startDate: { type: 'string' },
              endDate: { type: 'string' }
            }
          }
        },
        {
          name: 'get_conversion_data',
          description: 'Get conversion data from GA4',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: { type: 'string' },
              endDate: { type: 'string' }
            }
          }
        }
      ];

      return NextResponse.json({
        success: true,
        tools: fallbackTools,
        timestamp: new Date().toISOString(),
        source: 'fallback',
        warning: 'MCP server unavailable, using fallback tools'
      });
    }

  } catch (error) {
    console.error('[MCP API] Error listing tools:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list MCP tools',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Clean up MCP connection on process exit
 */
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    console.log('[MCP API] Cleaning up MCP connections...');
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (error) {
        console.warn('[MCP API] Error closing MCP client:', error);
      }
    }
    if (mcpTransport) {
      try {
        await mcpTransport.close();
      } catch (error) {
        console.warn('[MCP API] Error closing MCP transport:', error);
      }
    }
    if (mcpServerProcess) {
      mcpServerProcess.kill('SIGTERM');
      setTimeout(() => {
        if (mcpServerProcess && !mcpServerProcess.killed) {
          mcpServerProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}