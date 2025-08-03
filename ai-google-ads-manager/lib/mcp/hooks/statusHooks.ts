/**
 * MCP Status Monitoring Hooks
 * 
 * This file provides React hooks for monitoring MCP client status,
 * including connection status and health check functionality.
 */

'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useMCPContext, useMCPClient, useMCPStatus } from '../context';
import { MCPConnectionState, type MCPConnectionMetrics, type MCPClientStatus } from '../client';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Extended connection status with additional monitoring data
 */
export interface ExtendedConnectionStatus {
  // Basic status
  state: MCPConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  hasError: boolean;
  
  // Timing information
  lastConnected?: Date;
  lastDisconnected?: Date;
  lastError?: Error;
  connectionDuration?: number;
  uptime?: number;
  
  // Metrics
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  metrics?: MCPConnectionMetrics;
  
  // Performance
  averageConnectionTime?: number;
  connectionReliability: number; // Percentage of successful connections
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  timestamp: Date;
  duration: number;
  error?: Error;
  details: {
    connectionStatus: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastSuccessfulCheck?: Date;
    consecutiveFailures: number;
  };
}

/**
 * Health monitoring configuration
 */
export interface HealthMonitoringConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  maxConsecutiveFailures: number;
  onHealthChange?: (isHealthy: boolean, result: HealthCheckResult) => void;
  onUnhealthy?: (result: HealthCheckResult) => void;
}

/**
 * Connection status hook return type
 */
export interface UseConnectionStatusReturn {
  status: ExtendedConnectionStatus;
  refresh: () => void;
  isRefreshing: boolean;
  lastRefresh: Date | null;
}

/**
 * Health check hook return type
 */
export interface UseHealthCheckReturn {
  performHealthCheck: () => Promise<HealthCheckResult>;
  lastHealthCheck?: HealthCheckResult;
  isHealthy: boolean;
  isChecking: boolean;
  healthHistory: HealthCheckResult[];
  startMonitoring: (config?: Partial<HealthMonitoringConfig>) => void;
  stopMonitoring: () => void;
  isMonitoring: boolean;
  monitoringConfig?: HealthMonitoringConfig;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const defaultHealthMonitoringConfig: HealthMonitoringConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  maxConsecutiveFailures: 3
};

// ============================================================================
// STATUS MONITORING HOOKS
// ============================================================================

/**
 * Hook for monitoring extended connection status with metrics
 * 
 * @example
 * ```tsx
 * function ConnectionStatusDisplay() {
 *   const { status, refresh, isRefreshing } = useConnectionStatus();
 *   
 *   return (
 *     <div>
 *       <h3>Connection Status: {status.state}</h3>
 *       <p>Reliability: {(status.connectionReliability * 100).toFixed(1)}%</p>
 *       <p>Uptime: {status.uptime ? Math.round(status.uptime / 1000) : 0}s</p>
 *       <button onClick={refresh} disabled={isRefreshing}>
 *         {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useConnectionStatus = (): UseConnectionStatusReturn => {
  const { getClientStatus } = useMCPContext();
  const status = useMCPStatus();
  const [extendedStatus, setExtendedStatus] = useState<ExtendedConnectionStatus>({
    state: status.state,
    isConnected: status.isConnected,
    isConnecting: status.isConnecting,
    isDisconnected: status.isDisconnected,
    hasError: status.hasError,
    lastConnected: status.lastConnected,
    lastError: status.lastError,
    connectionAttempts: status.connectionAttempts,
    connectionDuration: status.connectionDuration,
    metrics: status.metrics,
    successfulConnections: 0,
    failedConnections: 0,
    connectionReliability: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const connectTimeRef = useRef<Date | null>(null);

  // Update extended status when base status changes
  useEffect(() => {
    const clientStatus = getClientStatus();
    
    // Track connection timing
    if (status.isConnected && !extendedStatus.isConnected) {
      connectTimeRef.current = new Date();
    }

    // Calculate metrics
    const totalAttempts = status.connectionAttempts;
    const successful = status.isConnected ? extendedStatus.successfulConnections + 1 : extendedStatus.successfulConnections;
    const failed = status.hasError ? extendedStatus.failedConnections + 1 : extendedStatus.failedConnections;
    const reliability = totalAttempts > 0 ? successful / totalAttempts : 0;

    // Calculate uptime
    const uptime = connectTimeRef.current && status.isConnected 
      ? Date.now() - connectTimeRef.current.getTime() 
      : undefined;

    // Calculate last disconnected time
    const lastDisconnected = status.isDisconnected && extendedStatus.isConnected 
      ? new Date() 
      : extendedStatus.lastDisconnected;

    setExtendedStatus(prev => ({
      ...prev,
      state: status.state,
      isConnected: status.isConnected,
      isConnecting: status.isConnecting,
      isDisconnected: status.isDisconnected,
      hasError: status.hasError,
      lastConnected: status.lastConnected,
      lastDisconnected,
      lastError: status.lastError,
      connectionAttempts: status.connectionAttempts,
      connectionDuration: status.connectionDuration,
      uptime,
      metrics: status.metrics || clientStatus?.metrics,
      successfulConnections: successful,
      failedConnections: failed,
      connectionReliability: reliability
    }));
  }, [status, getClientStatus, extendedStatus.isConnected, extendedStatus.successfulConnections, extendedStatus.failedConnections]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    
    try {
      const clientStatus = getClientStatus();
      
      setExtendedStatus(prev => ({
        ...prev,
        metrics: clientStatus?.metrics || prev.metrics
      }));
      
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [getClientStatus]);

  return {
    status: extendedStatus,
    refresh,
    isRefreshing,
    lastRefresh
  };
};

/**
 * Hook for performing health checks and monitoring
 * 
 * @example
 * ```tsx
 * function HealthMonitor() {
 *   const { 
 *     performHealthCheck, 
 *     isHealthy, 
 *     isChecking, 
 *     startMonitoring, 
 *     stopMonitoring,
 *     isMonitoring,
 *     lastHealthCheck 
 *   } = useHealthCheck();
 *   
 *   useEffect(() => {
 *     // Start monitoring on mount
 *     startMonitoring({
 *       interval: 15000, // 15 seconds
 *       onUnhealthy: (result) => {
 *         console.error('Health check failed:', result.error);
 *       }
 *     });
 *     
 *     return () => stopMonitoring();
 *   }, [startMonitoring, stopMonitoring]);
 *   
 *   return (
 *     <div>
 *       <div>Health: {isHealthy ? '✅ Healthy' : '❌ Unhealthy'}</div>
 *       <div>Monitoring: {isMonitoring ? 'Active' : 'Inactive'}</div>
 *       <button onClick={performHealthCheck} disabled={isChecking}>
 *         {isChecking ? 'Checking...' : 'Check Health'}
 *       </button>
 *       {lastHealthCheck && (
 *         <div>
 *           Last check: {lastHealthCheck.timestamp.toLocaleTimeString()}
 *           ({lastHealthCheck.duration}ms)
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useHealthCheck = (): UseHealthCheckReturn => {
  const client = useMCPClient();
  const status = useMCPStatus();
  const [isChecking, setIsChecking] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<HealthCheckResult>();
  const [healthHistory, setHealthHistory] = useState<HealthCheckResult[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringConfig, setMonitoringConfig] = useState<HealthMonitoringConfig>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveFailuresRef = useRef(0);

  const performHealthCheck = useCallback(async (): Promise<HealthCheckResult> => {
    if (!client) {
      const result: HealthCheckResult = {
        isHealthy: false,
        timestamp: new Date(),
        duration: 0,
        error: new Error('MCP client not available'),
        details: {
          connectionStatus: 'unhealthy',
          responseTime: 0,
          consecutiveFailures: consecutiveFailuresRef.current + 1
        }
      };
      return result;
    }

    setIsChecking(true);
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Perform health check by getting client status
      const clientStatus = client.getStatus();
      const duration = Date.now() - startTime;
      
      const isHealthy = status.isConnected && clientStatus.state === MCPConnectionState.CONNECTED;
      
      const result: HealthCheckResult = {
        isHealthy,
        timestamp,
        duration,
        details: {
          connectionStatus: isHealthy ? 'healthy' : (status.isConnecting ? 'degraded' : 'unhealthy'),
          responseTime: duration,
          lastSuccessfulCheck: isHealthy ? timestamp : lastHealthCheck?.details.lastSuccessfulCheck,
          consecutiveFailures: isHealthy ? 0 : consecutiveFailuresRef.current + 1
        }
      };

      // Update consecutive failures counter
      consecutiveFailuresRef.current = isHealthy ? 0 : consecutiveFailuresRef.current + 1;

      // Update state
      setLastHealthCheck(result);
      setHealthHistory(prev => [...prev.slice(-9), result]); // Keep last 10 results

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      consecutiveFailuresRef.current += 1;
      
      const result: HealthCheckResult = {
        isHealthy: false,
        timestamp,
        duration,
        error: error as Error,
        details: {
          connectionStatus: 'unhealthy',
          responseTime: duration,
          lastSuccessfulCheck: lastHealthCheck?.details.lastSuccessfulCheck,
          consecutiveFailures: consecutiveFailuresRef.current
        }
      };

      setLastHealthCheck(result);
      setHealthHistory(prev => [...prev.slice(-9), result]);

      return result;
    } finally {
      setIsChecking(false);
    }
  }, [client, status.isConnected, status.isConnecting, lastHealthCheck]);

  const startMonitoring = useCallback((config?: Partial<HealthMonitoringConfig>) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const finalConfig = { ...defaultHealthMonitoringConfig, ...config };
    setMonitoringConfig(finalConfig);
    setIsMonitoring(true);

    if (finalConfig.enabled) {
      intervalRef.current = setInterval(async () => {
        try {
          const result = await performHealthCheck();
          
          // Call health change callback
          if (finalConfig.onHealthChange) {
            finalConfig.onHealthChange(result.isHealthy, result);
          }

          // Call unhealthy callback if needed
          if (!result.isHealthy && finalConfig.onUnhealthy) {
            finalConfig.onUnhealthy(result);
          }

          // Stop monitoring if too many consecutive failures
          if (result.details.consecutiveFailures >= finalConfig.maxConsecutiveFailures) {
            console.warn(`Health monitoring stopped due to ${finalConfig.maxConsecutiveFailures} consecutive failures`);
            setIsMonitoring(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } catch (error) {
          console.error('Health monitoring error:', error);
        }
      }, finalConfig.interval);
    }
  }, [performHealthCheck]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
    setMonitoringConfig(undefined);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Calculate current health status
  const isHealthy = lastHealthCheck?.isHealthy ?? false;

  return {
    performHealthCheck,
    lastHealthCheck,
    isHealthy,
    isChecking,
    healthHistory,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    monitoringConfig
  };
};