/**
 * MCP Client Library - Main Entry Point
 * 
 * This file exports all the main MCP client functionality for easy importing
 * throughout the application.
 */

// Core client imports for internal use
import {
  MCPClient,
  createMCPClient,
  createProductionMCPClient,
  MCPConnectionState,
  type MCPClientConfig,
  type MCPConnectionEvents,
  type MCPClientStatus,
  type MCPConnectionPoolConfig,
  type MCPRetryConfig,
  type MCPConnectionMetrics,
  type MCPPersistedState,
  type MCPLoggingConfig,
  type MCPEnvironmentConfig,
  type MCPValidationConfig,
  type MCPDebugConfig
} from './client';

// Core client exports
export {
  MCPClient,
  createMCPClient,
  createProductionMCPClient,
  MCPConnectionState,
  type MCPClientConfig,
  type MCPConnectionEvents,
  type MCPClientStatus,
  type MCPConnectionPoolConfig,
  type MCPRetryConfig,
  type MCPConnectionMetrics,
  type MCPPersistedState,
  type MCPLoggingConfig,
  type MCPEnvironmentConfig,
  type MCPValidationConfig,
  type MCPDebugConfig
} from './client';

// Context and provider (Subtask 27.2 - Phase 1)
export * from './context';

// Type definitions (to be implemented in Phase 4)
// export * from './types';

// Hooks (Subtask 27.3 - Phase 1: Basic MCP Operation Hooks)
export * from './hooks';

// Data adapters (to be implemented in Phase 5)
// export * from './adapters';

// Utilities (to be implemented in Phase 2-5)
// export * from './utils';

/**
 * Version information
 */
export const MCP_CLIENT_VERSION = '1.0.0-alpha';

/**
 * Default MCP client instance (singleton pattern)
 * This can be used throughout the app for a shared connection
 */
let defaultMCPClient: MCPClient | null = null;

/**
 * Get or create the default MCP client instance
 */
export function getDefaultMCPClient(): MCPClient {
  if (!defaultMCPClient) {
    defaultMCPClient = createProductionMCPClient();
  }
  return defaultMCPClient;
}

/**
 * Reset the default MCP client (useful for testing)
 */
export function resetDefaultMCPClient(): void {
  if (defaultMCPClient) {
    defaultMCPClient.disconnect();
    defaultMCPClient = null;
  }
}