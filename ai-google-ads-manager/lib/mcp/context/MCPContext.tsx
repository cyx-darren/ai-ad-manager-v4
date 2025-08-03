/**
 * MCP Context for React Application
 * 
 * This file provides React Context for managing MCP client instances
 * across the application, with connection status management and error handling.
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  MCPClient, 
  createMCPClient, 
  createProductionMCPClient,
  MCPConnectionState,
  type MCPClientConfig,
  type MCPConnectionEvents,
  type MCPClientStatus,
  type MCPConnectionMetrics
} from '../client';
import { MCPErrorBoundary, type MCPErrorBoundaryConfig } from './MCPErrorBoundary';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * MCP Provider configuration options
 */
export interface MCPProviderConfig {
  // Client configuration
  clientConfig?: MCPClientConfig;
  
  // Provider-specific options
  autoConnect?: boolean;
  reconnectOnMount?: boolean;
  enableStatusPolling?: boolean;
  statusPollingInterval?: number;
  
  // Environment detection
  useProductionClient?: boolean;
  
  // Error handling
  enableErrorBoundary?: boolean;
  errorBoundaryConfig?: MCPErrorBoundaryConfig;
  maxRetryAttempts?: number;
  retryDelay?: number;
  
  // Debug options
  enableDebugLogging?: boolean;
  logConnectionEvents?: boolean;
}

/**
 * Connection status with additional metadata
 */
export interface MCPConnectionStatus {
  state: MCPConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  hasError: boolean;
  lastConnected?: Date;
  lastError?: Error;
  connectionAttempts: number;
  connectionDuration?: number;
  metrics?: MCPConnectionMetrics;
}

/**
 * MCP Context value interface
 */
export interface MCPContextValue {
  // Client instance
  client: MCPClient | null;
  
  // Connection status
  status: MCPConnectionStatus;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // Configuration
  config: MCPProviderConfig;
  updateConfig: (newConfig: Partial<MCPProviderConfig>) => void;
  
  // Error handling
  clearError: () => void;
  
  // Status and metrics
  getClientStatus: () => MCPClientStatus | null;
  refreshStatus: () => void;
  
  // Debug information
  getDebugInfo: () => any;
  isDebugMode: boolean;
}

/**
 * MCP Provider props
 */
export interface MCPProviderProps {
  children: ReactNode;
  config?: MCPProviderConfig;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultConfig: MCPProviderConfig = {
  autoConnect: true,
  reconnectOnMount: false,
  enableStatusPolling: true,
  statusPollingInterval: 30000, // 30 seconds
  useProductionClient: process.env.NODE_ENV === 'production',
  enableErrorBoundary: true,
  maxRetryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  enableDebugLogging: process.env.NODE_ENV === 'development',
  logConnectionEvents: process.env.NODE_ENV === 'development'
};

const defaultStatus: MCPConnectionStatus = {
  state: MCPConnectionState.DISCONNECTED,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  hasError: false,
  connectionAttempts: 0
};

// ============================================================================
// CONTEXT CREATION
// ============================================================================

/**
 * MCP React Context
 */
export const MCPContext = createContext<MCPContextValue | null>(null);

/**
 * Hook for accessing MCP context
 */
export const useMCPContext = (): MCPContextValue => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCPContext must be used within an MCPProvider');
  }
  return context;
};

/**
 * Hook for accessing MCP client directly
 */
export const useMCPClient = (): MCPClient | null => {
  const { client } = useMCPContext();
  return client;
};

/**
 * Hook for accessing connection status
 */
export const useMCPStatus = (): MCPConnectionStatus => {
  const { status } = useMCPContext();
  return status;
};

// ============================================================================
// MCP PROVIDER COMPONENT
// ============================================================================

/**
 * MCP Provider component for managing MCP client across the application
 */
export const MCPProvider: React.FC<MCPProviderProps> = ({ 
  children, 
  config: userConfig = {} 
}) => {
  // Merge user config with defaults
  const config = { ...defaultConfig, ...userConfig };
  
  // State management
  const [client, setClient] = useState<MCPClient | null>(null);
  const [status, setStatus] = useState<MCPConnectionStatus>(defaultStatus);
  const [isInitialized, setIsInitialized] = useState(false);
  const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Debug logging utility
  const debugLog = useCallback((message: string, data?: any) => {
    if (config.enableDebugLogging) {
      console.log(`[MCPProvider] ${message}`, data || '');
    }
  }, [config.enableDebugLogging]);

  // Update connection status
  const updateStatus = useCallback((newStatus: Partial<MCPConnectionStatus>) => {
    setStatus(prevStatus => {
      const updatedStatus = { ...prevStatus, ...newStatus };
      
      // Update convenience flags
      updatedStatus.isConnected = updatedStatus.state === MCPConnectionState.CONNECTED;
      updatedStatus.isConnecting = updatedStatus.state === MCPConnectionState.CONNECTING;
      updatedStatus.isDisconnected = updatedStatus.state === MCPConnectionState.DISCONNECTED;
      updatedStatus.hasError = updatedStatus.state === MCPConnectionState.ERROR;
      
      if (config.logConnectionEvents) {
        debugLog('Status updated', {
          from: prevStatus.state,
          to: updatedStatus.state,
          attempts: updatedStatus.connectionAttempts
        });
      }
      
      return updatedStatus;
    });
  }, [config.logConnectionEvents, debugLog]);

  // Create MCP client instance
  const createClient = useCallback(() => {
    debugLog('Creating MCP client', { 
      useProduction: config.useProductionClient,
      config: config.clientConfig 
    });
    
    try {
      // Set up event listeners first
      const connectionEvents: MCPConnectionEvents = {
        onConnect: (connectionInfo) => {
          debugLog('Client connected', connectionInfo);
          updateStatus({
            state: MCPConnectionState.CONNECTED,
            lastConnected: new Date(),
            lastError: undefined,
            connectionDuration: connectionInfo?.duration
          });
        },
        
        onDisconnect: (reason) => {
          debugLog('Client disconnected', { reason });
          updateStatus({
            state: MCPConnectionState.DISCONNECTED,
            connectionDuration: undefined
          });
        },
        
        onError: (error, context) => {
          debugLog('Client error', { error: error.message, context });
          updateStatus({
            state: MCPConnectionState.ERROR,
            lastError: error,
            connectionDuration: undefined
          });
        },
        
        onStateChange: (newState, previousState) => {
          debugLog('State change', { from: previousState, to: newState });
          updateStatus({ state: newState });
        }
      };

      // Create the client with appropriate function based on environment
      const mcpClient = config.useProductionClient
        ? createProductionMCPClient(connectionEvents)
        : createMCPClient(config.clientConfig, connectionEvents);
      
      setClient(mcpClient);
      debugLog('MCP client created successfully');
      
      return mcpClient;
    } catch (error) {
      debugLog('Failed to create MCP client', error);
      updateStatus({
        state: MCPConnectionState.ERROR,
        lastError: error as Error
      });
      return null;
    }
  }, [config.useProductionClient, config.clientConfig, debugLog, updateStatus]);

  // Connection management functions
  const connect = useCallback(async () => {
    if (!client) {
      debugLog('No client available for connection');
      return;
    }

    try {
      debugLog('Attempting to connect...');
      updateStatus({
        state: MCPConnectionState.CONNECTING,
        connectionAttempts: status.connectionAttempts + 1
      });
      
      await client.connect();
    } catch (error) {
      debugLog('Connection failed', error);
      updateStatus({
        state: MCPConnectionState.ERROR,
        lastError: error as Error
      });
      throw error;
    }
  }, [client, status.connectionAttempts, debugLog, updateStatus]);

  const disconnect = useCallback(async () => {
    if (!client) {
      debugLog('No client available for disconnection');
      return;
    }

    try {
      debugLog('Disconnecting...');
      await client.disconnect();
    } catch (error) {
      debugLog('Disconnection error', error);
      // Don't throw on disconnect errors
    }
  }, [client, debugLog]);

  const reconnect = useCallback(async () => {
    debugLog('Reconnecting...');
    await disconnect();
    await connect();
  }, [connect, disconnect, debugLog]);

  // Configuration update
  const updateConfig = useCallback((newConfig: Partial<MCPProviderConfig>) => {
    debugLog('Updating provider config', newConfig);
    Object.assign(config, newConfig);
    
    // Handle config changes that require client recreation
    if (newConfig.useProductionClient !== undefined || newConfig.clientConfig) {
      debugLog('Config requires client recreation');
      // Recreate client with new config on next render
      setIsInitialized(false);
    }
  }, [config, debugLog]);

  // Error handling
  const clearError = useCallback(() => {
    debugLog('Clearing error state');
    updateStatus({
      lastError: undefined,
      state: MCPConnectionState.DISCONNECTED
    });
  }, [debugLog, updateStatus]);

  // Status and metrics
  const getClientStatus = useCallback((): MCPClientStatus | null => {
    return client?.getStatus() || null;
  }, [client]);

  const refreshStatus = useCallback(() => {
    if (client) {
      const clientStatus = client.getStatus();
      updateStatus({
        state: clientStatus.state,
        metrics: clientStatus.metrics
      });
      debugLog('Status refreshed', clientStatus);
    }
  }, [client, updateStatus, debugLog]);

  // Debug information
  const getDebugInfo = useCallback(() => {
    return {
      providerConfig: config,
      connectionStatus: status,
      clientStatus: getClientStatus(),
      clientDebugInfo: client?.exportDebugInfo?.() || null,
      isInitialized,
      timestamp: new Date().toISOString()
    };
  }, [config, status, getClientStatus, client, isInitialized]);

  // Initialize client on mount
  useEffect(() => {
    if (!isInitialized) {
      debugLog('Initializing MCP Provider');
      const newClient = createClient();
      
      if (newClient && config.autoConnect) {
        connect();
      }
      
      setIsInitialized(true);
    }
  }, [isInitialized, createClient, connect, config.autoConnect, debugLog]);

  // Set up status polling
  useEffect(() => {
    if (config.enableStatusPolling && client) {
      debugLog('Starting status polling', { interval: config.statusPollingInterval });
      
      const interval = setInterval(() => {
        refreshStatus();
      }, config.statusPollingInterval);
      
      setStatusPollingInterval(interval);
      
      return () => {
        debugLog('Stopping status polling');
        clearInterval(interval);
        setStatusPollingInterval(null);
      };
    }
  }, [config.enableStatusPolling, config.statusPollingInterval, client, refreshStatus, debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debugLog('MCPProvider unmounting, cleaning up...');
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
      }
      if (client) {
        client.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        });
      }
    };
  }, [client, statusPollingInterval, debugLog]);

  // Context value
  const contextValue: MCPContextValue = {
    client,
    status,
    connect,
    disconnect,
    reconnect,
    config,
    updateConfig,
    clearError,
    getClientStatus,
    refreshStatus,
    getDebugInfo,
    isDebugMode: config.enableDebugLogging || false
  };

  // Error boundary configuration
  const errorBoundaryConfig: MCPErrorBoundaryConfig = {
    enableAutoRecovery: true,
    maxRecoveryAttempts: config.maxRetryAttempts || 3,
    recoveryDelay: config.retryDelay || 5000,
    enableErrorLogging: config.enableDebugLogging,
    logErrorsToConsole: config.enableDebugLogging,
    onError: (error, errorInfo, errorContext) => {
      debugLog('Error boundary caught error', { 
        error: error.message, 
        errorContext,
        componentStack: errorInfo.componentStack 
      });
    },
    onRecoveryAttempt: (attempt, error) => {
      debugLog(`Error recovery attempt ${attempt}`, { error: error.message });
    },
    onRecoverySuccess: (attempt) => {
      debugLog(`Error recovery succeeded after ${attempt} attempts`);
    },
    onRecoveryFailure: (error, totalAttempts) => {
      debugLog(`Error recovery failed after ${totalAttempts} attempts`, { error: error.message });
    },
    ...config.errorBoundaryConfig
  };

  // Provider content
  const providerContent = (
    <MCPContext.Provider value={contextValue}>
      {children}
    </MCPContext.Provider>
  );

  // Wrap with error boundary if enabled
  if (config.enableErrorBoundary) {
    return (
      <MCPErrorBoundary 
        config={errorBoundaryConfig}
        onError={(error, errorInfo) => {
          debugLog('MCPProvider error boundary triggered', { 
            error: error.message,
            componentStack: errorInfo.componentStack 
          });
        }}
      >
        {providerContent}
      </MCPErrorBoundary>
    );
  }

  return providerContent;
};

// Export default as MCPProvider
export default MCPProvider;