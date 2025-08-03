/**
 * MCP Context Module Exports
 * 
 * This file exports all MCP context-related components and utilities
 * for easy importing throughout the application.
 */

// Core context and provider
export {
  MCPContext,
  MCPProvider,
  useMCPContext,
  useMCPClient,
  useMCPStatus,
  type MCPProviderConfig,
  type MCPConnectionStatus,
  type MCPContextValue,
  type MCPProviderProps
} from './MCPContext';

// Error boundary (Phase 3)
export {
  MCPErrorBoundary,
  withMCPErrorBoundary,
  type MCPErrorBoundaryConfig,
  type MCPErrorContext,
  type MCPErrorBoundaryState,
  type MCPErrorBoundaryProps,
  type MCPErrorDisplayProps
} from './MCPErrorBoundary';

// Default export
export { default } from './MCPContext';