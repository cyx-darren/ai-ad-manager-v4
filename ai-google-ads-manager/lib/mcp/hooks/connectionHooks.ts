/**
 * MCP Connection Management Hooks
 * 
 * This file provides React hooks for managing MCP client connections,
 * including connection, disconnection, and reconnection operations.
 */

'use client';

import { useCallback, useState, useRef } from 'react';
import { useMCPContext, useMCPClient, useMCPStatus } from '../context';
import { MCPConnectionState } from '../client';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Connection operation result
 */
export interface ConnectionResult {
  success: boolean;
  error?: Error;
  duration?: number;
  timestamp: Date;
}

/**
 * Connection hook state
 */
export interface ConnectionHookState {
  isLoading: boolean;
  lastResult?: ConnectionResult;
  operationCount: number;
}

/**
 * Connection hook return type
 */
export interface UseConnectReturn {
  connect: () => Promise<ConnectionResult>;
  isConnecting: boolean;
  lastConnectResult?: ConnectionResult;
  connectCount: number;
  canConnect: boolean;
}

/**
 * Disconnect hook return type
 */
export interface UseDisconnectReturn {
  disconnect: () => Promise<ConnectionResult>;
  isDisconnecting: boolean;
  lastDisconnectResult?: ConnectionResult;
  disconnectCount: number;
  canDisconnect: boolean;
}

/**
 * Reconnect hook return type
 */
export interface UseReconnectReturn {
  reconnect: () => Promise<ConnectionResult>;
  isReconnecting: boolean;
  lastReconnectResult?: ConnectionResult;
  reconnectCount: number;
  canReconnect: boolean;
}

// ============================================================================
// CONNECTION MANAGEMENT HOOKS
// ============================================================================

/**
 * Hook for managing MCP client connection
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { connect, isConnecting, lastConnectResult, canConnect } = useConnect();
 *   
 *   const handleConnect = async () => {
 *     const result = await connect();
 *     if (result.success) {
 *       console.log('Connected successfully');
 *     } else {
 *       console.error('Connection failed:', result.error);
 *     }
 *   };
 *   
 *   return (
 *     <button 
 *       onClick={handleConnect} 
 *       disabled={!canConnect || isConnecting}
 *     >
 *       {isConnecting ? 'Connecting...' : 'Connect'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useConnect = (): UseConnectReturn => {
  const { connect: contextConnect } = useMCPContext();
  const status = useMCPStatus();
  const [state, setState] = useState<ConnectionHookState>({
    isLoading: false,
    operationCount: 0
  });
  const operationIdRef = useRef<string | null>(null);

  const connect = useCallback(async (): Promise<ConnectionResult> => {
    if (state.isLoading) {
      throw new Error('Connection operation already in progress');
    }

    const operationId = `connect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    operationIdRef.current = operationId;
    const startTime = Date.now();

    setState(prev => ({
      ...prev,
      isLoading: true,
      operationCount: prev.operationCount + 1
    }));

    try {
      await contextConnect();
      
      const result: ConnectionResult = {
        success: true,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    } catch (error) {
      const result: ConnectionResult = {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    }
  }, [contextConnect, state.isLoading]);

  // Determine if connection is possible
  const canConnect = !status.isConnected && !status.isConnecting && !state.isLoading;

  return {
    connect,
    isConnecting: state.isLoading,
    lastConnectResult: state.lastResult,
    connectCount: state.operationCount,
    canConnect
  };
};

/**
 * Hook for managing MCP client disconnection
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { disconnect, isDisconnecting, canDisconnect } = useDisconnect();
 *   
 *   const handleDisconnect = async () => {
 *     const result = await disconnect();
 *     if (result.success) {
 *       console.log('Disconnected successfully');
 *     }
 *   };
 *   
 *   return (
 *     <button 
 *       onClick={handleDisconnect} 
 *       disabled={!canDisconnect || isDisconnecting}
 *     >
 *       {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useDisconnect = (): UseDisconnectReturn => {
  const { disconnect: contextDisconnect } = useMCPContext();
  const status = useMCPStatus();
  const [state, setState] = useState<ConnectionHookState>({
    isLoading: false,
    operationCount: 0
  });
  const operationIdRef = useRef<string | null>(null);

  const disconnect = useCallback(async (): Promise<ConnectionResult> => {
    if (state.isLoading) {
      throw new Error('Disconnection operation already in progress');
    }

    const operationId = `disconnect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    operationIdRef.current = operationId;
    const startTime = Date.now();

    setState(prev => ({
      ...prev,
      isLoading: true,
      operationCount: prev.operationCount + 1
    }));

    try {
      await contextDisconnect();
      
      const result: ConnectionResult = {
        success: true,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    } catch (error) {
      const result: ConnectionResult = {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    }
  }, [contextDisconnect, state.isLoading]);

  // Determine if disconnection is possible
  const canDisconnect = status.isConnected && !state.isLoading;

  return {
    disconnect,
    isDisconnecting: state.isLoading,
    lastDisconnectResult: state.lastResult,
    disconnectCount: state.operationCount,
    canDisconnect
  };
};

/**
 * Hook for managing MCP client reconnection
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { reconnect, isReconnecting, lastReconnectResult } = useReconnect();
 *   
 *   const handleReconnect = async () => {
 *     const result = await reconnect();
 *     if (result.success) {
 *       console.log(`Reconnected in ${result.duration}ms`);
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleReconnect} disabled={isReconnecting}>
 *       {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useReconnect = (): UseReconnectReturn => {
  const { reconnect: contextReconnect } = useMCPContext();
  const status = useMCPStatus();
  const [state, setState] = useState<ConnectionHookState>({
    isLoading: false,
    operationCount: 0
  });
  const operationIdRef = useRef<string | null>(null);

  const reconnect = useCallback(async (): Promise<ConnectionResult> => {
    if (state.isLoading) {
      throw new Error('Reconnection operation already in progress');
    }

    const operationId = `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    operationIdRef.current = operationId;
    const startTime = Date.now();

    setState(prev => ({
      ...prev,
      isLoading: true,
      operationCount: prev.operationCount + 1
    }));

    try {
      await contextReconnect();
      
      const result: ConnectionResult = {
        success: true,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    } catch (error) {
      const result: ConnectionResult = {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Only update state if this is still the current operation
      if (operationIdRef.current === operationId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result
        }));
      }

      return result;
    }
  }, [contextReconnect, state.isLoading]);

  // Determine if reconnection is possible
  const canReconnect = !status.isConnecting && !state.isLoading;

  return {
    reconnect,
    isReconnecting: state.isLoading,
    lastReconnectResult: state.lastResult,
    reconnectCount: state.operationCount,
    canReconnect
  };
};

// ============================================================================
// COMBINED CONNECTION MANAGEMENT HOOK
// ============================================================================

/**
 * Combined connection management hook return type
 */
export interface UseConnectionManagementReturn {
  connect: UseConnectReturn;
  disconnect: UseDisconnectReturn;
  reconnect: UseReconnectReturn;
  isAnyOperationInProgress: boolean;
  totalOperations: number;
}

/**
 * Combined hook for all connection management operations
 * 
 * @example
 * ```tsx
 * function ConnectionManager() {
 *   const { 
 *     connect, 
 *     disconnect, 
 *     reconnect, 
 *     isAnyOperationInProgress 
 *   } = useConnectionManagement();
 *   
 *   return (
 *     <div>
 *       <button 
 *         onClick={connect.connect} 
 *         disabled={!connect.canConnect || isAnyOperationInProgress}
 *       >
 *         Connect
 *       </button>
 *       <button 
 *         onClick={disconnect.disconnect} 
 *         disabled={!disconnect.canDisconnect || isAnyOperationInProgress}
 *       >
 *         Disconnect
 *       </button>
 *       <button 
 *         onClick={reconnect.reconnect} 
 *         disabled={!reconnect.canReconnect || isAnyOperationInProgress}
 *       >
 *         Reconnect
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useConnectionManagement = (): UseConnectionManagementReturn => {
  const connect = useConnect();
  const disconnect = useDisconnect();
  const reconnect = useReconnect();

  const isAnyOperationInProgress = connect.isConnecting || disconnect.isDisconnecting || reconnect.isReconnecting;
  const totalOperations = connect.connectCount + disconnect.disconnectCount + reconnect.reconnectCount;

  return {
    connect,
    disconnect,
    reconnect,
    isAnyOperationInProgress,
    totalOperations
  };
};