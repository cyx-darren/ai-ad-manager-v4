import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, args } = body;

    console.log(`[Test MCP Direct] Calling tool: ${tool} with args:`, args);

    // Call our MCP API directly  
    const mcpResponse = await fetch('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool,
        args
      })
    });

    const mcpResult = await mcpResponse.json();

    // Return the result with debug info
    return NextResponse.json({
      success: true,
      mcpResponse: mcpResult,
      timestamp: new Date().toISOString(),
      debug: {
        tool,
        args,
        mcpStatusCode: mcpResponse.status
      }
    });

  } catch (error) {
    console.error('[Test MCP Direct] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test MCP direct call',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}