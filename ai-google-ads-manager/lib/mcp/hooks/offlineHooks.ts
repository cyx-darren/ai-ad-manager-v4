/**
 * Offline Detection React Hooks (Phase 1)
 * 
 * This file provides React hooks for offline detection and state management:
 * - useOfflineDetection: Main hook for offline status monitoring
 * - useNetworkStatus: Hook specifically for network connectivity
 * - useMCPServerStatus: Hook specifically for MCP server availability
 * - useOfflineRecovery: Hook for handling offline recovery scenarios
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMCPClient } from '../context';
import {
  OfflineDetectionManager,
  OfflineDetectionConfig,
  OfflineDetectionState,
  OfflineDetectionEvents,
  NetworkStatus,
  MCPServerStatus,
  OfflineStatus,
  NetworkInfo,
  MCPHealthCheckResult,
  DEFAULT_OFFLINE_CONFIG
} from '../utils/offlineDetection';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Offline detection hook result
 */
export interface UseOfflineDetectionResult {
  // Current state
  isOnline: boolean;
  isOffline: boolean;
  isPartiallyOnline: boolean;
  networkStatus: NetworkStatus;
  mcpServerStatus: MCPServerStatus;
  offlineStatus: OfflineStatus;
  
  // Network information
  networkInfo: NetworkInfo;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  
  // MCP server information
  mcpHealth: MCPHealthCheckResult | null;
  serverResponseTime: number | null;
  serverFeatures: { tools: boolean; resources: boolean; prompts: boolean } | null;
  
  // Actions
  forceCheck: () => Promise<void>;
  updateConfig: (config: Partial<OfflineDetectionConfig>) => void;
  
  // Timing information
  lastCheck: number;
  timeSinceLastCheck: number;
  nextCheckIn: number;
  
  // Statistics
  errorCount: number;
  consecutiveFailures: number;
  uptime: number;
  
  // State management
  isChecking: boolean;
  hasRecentError: boolean;
}

/**
 * Network status hook result
 */
export interface UseNetworkStatusResult {
  status: NetworkStatus;
  isOnline: boolean;
  networkInfo: NetworkInfo;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  lastCheck: number;
  checkHistory: boolean[];
}

/**
 * MCP server status hook result
 */
export interface UseMCPServerStatusResult {
  status: MCPServerStatus;
  isAvailable: boolean;
  health: MCPHealthCheckResult | null;
  responseTime: number | null;
  features: { tools: boolean; resources: boolean; prompts: boolean } | null;
  lastCheck: number;
  checkHistory: boolean[];
}

/**
 * Offline recovery hook configuration
 */
export interface OfflineRecoveryConfig {
  enableAutoRecovery: boolean;
  recoveryDelay: number;
  maxRecoveryAttempts: number;
  recoveryBackoffMultiplier: number;
  onRecoveryStart?: () => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailure?: (error: Error) => void;
}

/**
 * Offline recovery hook result
 */
export interface UseOfflineRecoveryResult {
  isRecovering: boolean;
  recoveryAttempts: number;
  lastRecoveryTime: number | null;
  canRetry: boolean;
  startRecovery: () => Promise<void>;
  cancelRecovery: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate connection quality from network info
 */
const calculateConnectionQuality = (networkInfo: NetworkInfo): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' => {
  if (!networkInfo.effectiveType) return 'unknown';
  
  switch (networkInfo.effectiveType) {
    case '4g':
      if (networkInfo.downlink && networkInfo.downlink > 10) return 'excellent';
      if (networkInfo.downlink && networkInfo.downlink > 5) return 'good';
      return 'fair';
    case '3g':
      return 'fair';
    case '2g':
    case 'slow-2g':
      return 'poor';
    default:
      return 'unknown';
  }
};

/**
 * Calculate time until next check
 */
const calculateNextCheckTime = (
  lastCheck: number,
  interval: number,
  isChecking: boolean
): number => {
  if (isChecking) return 0;
  
  const elapsed = Date.now() - lastCheck;
  const remaining = Math.max(0, interval - elapsed);
  return remaining;
};

// ============================================================================
// MAIN OFFLINE DETECTION HOOK
// ============================================================================

/**
 * Main hook for offline detection and status monitoring
 * 
 * @example
 * ```tsx
 * function OfflineStatusIndicator() {
 *   const {
 *     isOnline,
 *     isOffline,
 *     networkStatus,
 *     mcpServerStatus,
 *     connectionQuality,
 *     forceCheck,
 *     serverResponseTime
 *   } = useOfflineDetection({
 *     enableNetworkMonitoring: true,
 *     enableMCPMonitoring: true,
 *     networkCheckInterval: 10000
 *   });
 *   
 *   return (
 *     <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
 *       <div>Network: {networkStatus}</div>
 *       <div>MCP Server: {mcpServerStatus}</div>
 *       <div>Quality: {connectionQuality}</div>
 *       {serverResponseTime && (
 *         <div>Response Time: {serverResponseTime}ms</div>
 *       )}
 *       <button onClick={forceCheck}>Check Now</button>
 *     </div>
 *   );
 * }
 * ```
 */
const useOfflineDetection = (
  config: Partial<OfflineDetectionConfig> = {},
  events: OfflineDetectionEvents = {}
): UseOfflineDetectionResult => {
  // Get MCP client for server URL
  const { client, status } = useMCPClient();
  
  // State management
  const [state, setState] = useState<OfflineDetectionState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [startTime] = useState(() => Date.now());
  
  // Manager instance
  const managerRef = useRef<OfflineDetectionManager | null>(null);
  const configRef = useRef<OfflineDetectionConfig>({ ...DEFAULT_OFFLINE_CONFIG, ...config });
  
  // Server URL from MCP client config
  const serverUrl = useMemo(() => {
    // Try to get from client first, fallback to localhost
    return client?.config?.serverUrl || 'http://localhost:3001';
  }, [client]);
  
  // Initialize manager
  useEffect(() => {
    const finalConfig = { ...DEFAULT_OFFLINE_CONFIG, ...config };
    configRef.current = finalConfig;
    
    const manager = new OfflineDetectionManager(
      serverUrl,
      finalConfig,
      {
        ...events,
        onNetworkChange: (networkStatus, networkInfo) => {
          setState(prev => prev ? { ...prev, networkStatus, networkInfo } : null);
          events.onNetworkChange?.(networkStatus, networkInfo);
        },
        onMCPServerChange: (mcpServerStatus, health) => {
          setState(prev => prev ? { ...prev, mcpServerStatus, mcpHealth: health } : null);
          events.onMCPServerChange?.(mcpServerStatus, health);
        },
        onOfflineStatusChange: (offlineStatus, previousStatus) => {
          setState(prev => prev ? { ...prev, offlineStatus, lastStatusChange: Date.now() } : null);
          events.onOfflineStatusChange?.(offlineStatus, previousStatus);
        },
        onRecovery: (fromStatus) => {
          events.onRecovery?.(fromStatus);
        },
        onError: (error, context) => {
          setState(prev => prev ? { ...prev, lastError: error, errorCount: prev.errorCount + 1 } : null);
          events.onError?.(error, context);
        }
      }
    );
    
    managerRef.current = manager;
    
    // Start monitoring
    manager.start();
    
    // Set initial state
    setState(manager.getState());
    
    // Cleanup
    return () => {
      manager.stop();
      managerRef.current = null;
    };
  }, [serverUrl, config, events]);
  
  // Update state periodically
  useEffect(() => {
    if (!managerRef.current) return;
    
    const interval = setInterval(() => {
      setState(managerRef.current?.getState() || null);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Force check function
  const forceCheck = useCallback(async () => {
    if (!managerRef.current) return;
    
    setIsChecking(true);
    try {
      await managerRef.current.forceCheck();
      setState(managerRef.current.getState());
    } finally {
      setIsChecking(false);
    }
  }, []);
  
  // Update config function
  const updateConfig = useCallback((newConfig: Partial<OfflineDetectionConfig>) => {
    if (!managerRef.current) return;
    
    configRef.current = { ...configRef.current, ...newConfig };
    managerRef.current.updateConfig(newConfig);
  }, []);
  
  // Calculate derived values
  const derivedValues = useMemo(() => {
    if (!state) {
      return {
        isOnline: false,
        isOffline: true,
        isPartiallyOnline: false,
        connectionQuality: 'unknown' as const,
        serverResponseTime: null,
        serverFeatures: null,
        lastCheck: 0,
        timeSinceLastCheck: 0,
        nextCheckIn: 0,
        uptime: 0,
        hasRecentError: false
      };
    }
    
    const isOnline = state.offlineStatus === 'online';
    const isOffline = state.offlineStatus === 'offline';
    const isPartiallyOnline = state.offlineStatus === 'partial';
    
    const connectionQuality = calculateConnectionQuality(state.networkInfo);
    const serverResponseTime = state.mcpHealth?.responseTime || null;
    const serverFeatures = state.mcpHealth?.features || null;
    
    const lastCheck = Math.max(state.lastNetworkCheck, state.lastMCPCheck);
    const timeSinceLastCheck = Date.now() - lastCheck;
    const nextCheckIn = calculateNextCheckTime(
      lastCheck,
      Math.min(configRef.current.networkCheckInterval, configRef.current.mcpCheckInterval),
      isChecking
    );
    
    const uptime = Date.now() - startTime;
    const hasRecentError = state.lastError !== undefined && 
      (Date.now() - (state.lastError as any)?.timestamp || 0) < 30000; // 30 seconds
    
    return {
      isOnline,
      isOffline,
      isPartiallyOnline,
      connectionQuality,
      serverResponseTime,
      serverFeatures,
      lastCheck,
      timeSinceLastCheck,
      nextCheckIn,
      uptime,
      hasRecentError
    };
  }, [state, isChecking, startTime]);
  
  return {
    // Current state
    isOnline: derivedValues.isOnline,
    isOffline: derivedValues.isOffline,
    isPartiallyOnline: derivedValues.isPartiallyOnline,
    networkStatus: state?.networkStatus || 'unknown',
    mcpServerStatus: state?.mcpServerStatus || 'checking',
    offlineStatus: state?.offlineStatus || 'checking',
    
    // Network information
    networkInfo: state?.networkInfo || {},
    connectionQuality: derivedValues.connectionQuality,
    
    // MCP server information
    mcpHealth: state?.mcpHealth || null,
    serverResponseTime: derivedValues.serverResponseTime,
    serverFeatures: derivedValues.serverFeatures,
    
    // Actions
    forceCheck,
    updateConfig,
    
    // Timing information
    lastCheck: derivedValues.lastCheck,
    timeSinceLastCheck: derivedValues.timeSinceLastCheck,
    nextCheckIn: derivedValues.nextCheckIn,
    
    // Statistics
    errorCount: state?.errorCount || 0,
    consecutiveFailures: state?.consecutiveFailures || 0,
    uptime: derivedValues.uptime,
    
    // State management
    isChecking,
    hasRecentError: derivedValues.hasRecentError
  };
};

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook specifically for network connectivity status
 * 
 * @example
 * ```tsx
 * function NetworkIndicator() {
 *   const { status, isOnline, connectionQuality, networkInfo } = useNetworkStatus();
 *   
 *   return (
 *     <div className={`network-status ${status}`}>
 *       <span>{isOnline ? '🟢' : '🔴'}</span>
 *       <span>Network: {status}</span>
 *       <span>Quality: {connectionQuality}</span>
 *       {networkInfo.effectiveType && (
 *         <span>Type: {networkInfo.effectiveType}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
const useNetworkStatus = (
  config?: Partial<OfflineDetectionConfig>
): UseNetworkStatusResult => {
  const {
    networkStatus,
    networkInfo,
    connectionQuality,
    lastCheck,
    isOnline
  } = useOfflineDetection(config);
  
  // Get check history from offline detection state
  const [checkHistory, setCheckHistory] = useState<boolean[]>([]);
  
  useEffect(() => {
    // This would be populated by the manager's network check history
    // For now, we'll simulate it based on current status
    setCheckHistory(prev => {
      const newHistory = [...prev, isOnline];
      return newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
    });
  }, [isOnline]);
  
  return {
    status: networkStatus,
    isOnline: networkStatus === 'online',
    networkInfo,
    connectionQuality,
    lastCheck,
    checkHistory
  };
};

/**
 * Hook specifically for MCP server availability
 * 
 * @example
 * ```tsx
 * function MCPServerIndicator() {
 *   const { 
 *     status, 
 *     isAvailable, 
 *     responseTime, 
 *     features 
 *   } = useMCPServerStatus();
 *   
 *   return (
 *     <div className={`mcp-status ${status}`}>
 *       <span>{isAvailable ? '🟢' : '🔴'}</span>
 *       <span>MCP: {status}</span>
 *       {responseTime && <span>{responseTime}ms</span>}
 *       {features && (
 *         <div>
 *           <span>Tools: {features.tools ? '✓' : '✗'}</span>
 *           <span>Resources: {features.resources ? '✓' : '✗'}</span>
 *           <span>Prompts: {features.prompts ? '✓' : '✗'}</span>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
const useMCPServerStatus = (
  config?: Partial<OfflineDetectionConfig>
): UseMCPServerStatusResult => {
  const {
    mcpServerStatus,
    mcpHealth,
    serverResponseTime,
    serverFeatures,
    lastCheck
  } = useOfflineDetection(config);
  
  // Get check history from offline detection state
  const [checkHistory, setCheckHistory] = useState<boolean[]>([]);
  
  useEffect(() => {
    const isAvailable = mcpServerStatus === 'available';
    setCheckHistory(prev => {
      const newHistory = [...prev, isAvailable];
      return newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
    });
  }, [mcpServerStatus]);
  
  return {
    status: mcpServerStatus,
    isAvailable: mcpServerStatus === 'available',
    health: mcpHealth,
    responseTime: serverResponseTime,
    features: serverFeatures,
    lastCheck,
    checkHistory
  };
};

/**
 * Hook for handling offline recovery scenarios
 * 
 * @example
 * ```tsx
 * function OfflineRecoveryButton() {
 *   const { 
 *     isRecovering, 
 *     recoveryAttempts, 
 *     canRetry, 
 *     startRecovery 
 *   } = useOfflineRecovery({
 *     enableAutoRecovery: false,
 *     maxRecoveryAttempts: 3
 *   });
 *   
 *   const { isOffline } = useOfflineDetection();
 *   
 *   if (!isOffline) return null;
 *   
 *   return (
 *     <button 
 *       onClick={startRecovery}
 *       disabled={isRecovering || !canRetry}
 *       className="recovery-button"
 *     >
 *       {isRecovering ? 'Reconnecting...' : `Retry (${recoveryAttempts}/3)`}
 *     </button>
 *   );
 * }
 * ```
 */
const useOfflineRecovery = (
  config: OfflineRecoveryConfig = {
    enableAutoRecovery: true,
    recoveryDelay: 5000,
    maxRecoveryAttempts: 3,
    recoveryBackoffMultiplier: 2
  }
): UseOfflineRecoveryResult => {
  const { isOffline, forceCheck } = useOfflineDetection();
  
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastRecoveryTime, setLastRecoveryTime] = useState<number | null>(null);
  
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const startRecovery = useCallback(async () => {
    if (isRecovering || recoveryAttempts >= config.maxRecoveryAttempts) {
      return;
    }
    
    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);
    setLastRecoveryTime(Date.now());
    
    config.onRecoveryStart?.();
    
    try {
      // Wait for recovery delay with backoff
      const delay = config.recoveryDelay * Math.pow(config.recoveryBackoffMultiplier, recoveryAttempts);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Force connectivity check
      await forceCheck();
      
      // Check if recovery was successful
      // Note: This check happens after forceCheck completes
      setTimeout(() => {
        setIsRecovering(false);
        
        // The actual success/failure determination would happen in a useEffect
        // that monitors the offline status changes
      }, 1000);
      
    } catch (error) {
      setIsRecovering(false);
      config.onRecoveryFailure?.(error as Error);
    }
  }, [isRecovering, recoveryAttempts, config, forceCheck]);
  
  const cancelRecovery = useCallback(() => {
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    setIsRecovering(false);
  }, []);
  
  // Auto-recovery when offline is detected
  useEffect(() => {
    if (config.enableAutoRecovery && isOffline && !isRecovering) {
      const delay = config.recoveryDelay * Math.pow(config.recoveryBackoffMultiplier, recoveryAttempts);
      
      recoveryTimeoutRef.current = setTimeout(() => {
        startRecovery();
      }, delay);
    }
    
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
    };
  }, [isOffline, isRecovering, config, recoveryAttempts, startRecovery]);
  
  // Reset recovery attempts when back online
  useEffect(() => {
    if (!isOffline) {
      setRecoveryAttempts(0);
      setIsRecovering(false);
      
      if (lastRecoveryTime && Date.now() - lastRecoveryTime < 10000) {
        config.onRecoverySuccess?.();
      }
    }
  }, [isOffline, config, lastRecoveryTime]);
  
  const canRetry = recoveryAttempts < config.maxRecoveryAttempts && !isRecovering;
  
  return {
    isRecovering,
    recoveryAttempts,
    lastRecoveryTime,
    canRetry,
    startRecovery,
    cancelRecovery
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default useOfflineDetection;
export {
  useOfflineDetection,
  useNetworkStatus,
  useMCPServerStatus,
  useOfflineRecovery
};