/**
 * Recovery React Hooks (Phase 5)
 * 
 * This file provides React hooks for recovery and reconnection functionality:
 * - useRecoveryManager: Main hook for recovery management
 * - useConnectionRecovery: Hook for connection recovery state
 * - useAutomaticRecovery: Hook for automatic recovery mechanisms
 * - useSyncRecovery: Hook for data synchronization on reconnect
 * - useRecoveryStats: Hook for recovery statistics and monitoring
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RecoveryManager, 
  RecoveryConfig, 
  RecoveryState, 
  RecoveryStatus,
  RecoveryResult,
  FailureReason,
  ConnectionHealth,
  getRecoveryManager,
  createRecoveryConfig,
  type RecoveryAttempt,
  type RecoveryEventData
} from '../utils/recoveryManager';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Recovery hook configuration
 */
export interface UseRecoveryConfig extends Partial<RecoveryConfig> {
  autoStart?: boolean;
  onRecoveryComplete?: (result: RecoveryResult) => void;
  onRecoveryFailed?: (error: string) => void;
  onConnectionLost?: (reason: FailureReason) => void;
  onConnectionRestored?: () => void;
}

/**
 * Recovery manager hook result
 */
export interface UseRecoveryManagerResult {
  manager: RecoveryManager;
  state: RecoveryState;
  isRecovering: boolean;
  isConnected: boolean;
  startRecovery: () => Promise<RecoveryResult>;
  manualRecovery: () => Promise<RecoveryResult>;
  detectFailure: (reason: FailureReason, error: string) => Promise<void>;
  stop: () => void;
  getConnectionHealth: () => Promise<ConnectionHealth>;
}

/**
 * Connection recovery hook result
 */
export interface UseConnectionRecoveryResult {
  status: RecoveryStatus;
  isConnected: boolean;
  isRecovering: boolean;
  lastFailureReason?: FailureReason;
  attemptCount: number;
  nextAttemptIn?: number;
  estimatedRecoveryTime?: number;
  recover: () => Promise<void>;
  reset: () => void;
}

/**
 * Automatic recovery hook result
 */
export interface UseAutomaticRecoveryResult {
  isEnabled: boolean;
  isActive: boolean;
  currentStrategy: string;
  failureCount: number;
  successRate: number;
  enable: () => void;
  disable: () => void;
  setStrategy: (strategy: 'aggressive' | 'balanced' | 'conservative') => void;
  triggerRecovery: (reason: FailureReason, error: string) => Promise<void>;
}

/**
 * Sync recovery hook result
 */
export interface UseSyncRecoveryResult {
  isSyncing: boolean;
  syncProgress: number;
  pendingOperations: number;
  unresolvedConflicts: number;
  lastSyncTime?: number;
  syncOnReconnect: boolean;
  performSync: () => Promise<{ synced: number; conflicts: number }>;
  setSyncOnReconnect: (enabled: boolean) => void;
  clearPendingOperations: () => void;
}

/**
 * Recovery statistics
 */
export interface RecoveryStats {
  totalAttempts: number;
  successfulRecoveries: number;
  failedAttempts: number;
  averageRecoveryTime: number;
  longestDowntime: number;
  uptime: number;
  reliability: number;
  lastRecoveryTime?: number;
  recentAttempts: RecoveryAttempt[];
}

/**
 * Recovery stats hook result
 */
export interface UseRecoveryStatsResult {
  stats: RecoveryStats;
  refresh: () => void;
  reset: () => void;
  isLoading: boolean;
}

// ============================================================================
// MAIN RECOVERY MANAGER HOOK
// ============================================================================

/**
 * Main hook for recovery manager integration
 */
export const useRecoveryManager = (config: UseRecoveryConfig = {}): UseRecoveryManagerResult => {
  const [manager] = useState(() => getRecoveryManager(config));
  const [state, setState] = useState<RecoveryState>(manager.getState());
  const [isRecovering, setIsRecovering] = useState(false);
  
  const mountedRef = useRef(true);

  // Set up event listeners
  useEffect(() => {
    const handleStateChange = (data: RecoveryEventData) => {
      if (!mountedRef.current) return;
      setState(manager.getState());
    };

    const handleRecoveryStarted = (data: RecoveryEventData) => {
      if (!mountedRef.current) return;
      setIsRecovering(true);
      setState(manager.getState());
    };

    const handleRecoveryCompleted = (data: RecoveryEventData) => {
      if (!mountedRef.current) return;
      setIsRecovering(false);
      setState(manager.getState());
      config.onRecoveryComplete?.(data as RecoveryResult);
      config.onConnectionRestored?.();
    };

    const handleRecoveryFailed = (data: RecoveryEventData) => {
      if (!mountedRef.current) return;
      setIsRecovering(false);
      setState(manager.getState());
      config.onRecoveryFailed?.(data.error || 'Recovery failed');
    };

    const handleFailureDetected = (data: RecoveryEventData) => {
      if (!mountedRef.current) return;
      setState(manager.getState());
      if (data.metadata?.reason) {
        config.onConnectionLost?.(data.metadata.reason as FailureReason);
      }
    };

    // Register event listeners
    manager.on('recoveryStarted', handleRecoveryStarted);
    manager.on('recoveryCompleted', handleRecoveryCompleted);
    manager.on('recoveryAttemptFailed', handleRecoveryFailed);
    manager.on('recoveryAbandoned', handleRecoveryFailed);
    manager.on('failureDetected', handleFailureDetected);
    manager.on('reconnectionSuccessful', handleStateChange);

    return () => {
      mountedRef.current = false;
      manager.off('recoveryStarted', handleRecoveryStarted);
      manager.off('recoveryCompleted', handleRecoveryCompleted);
      manager.off('recoveryAttemptFailed', handleRecoveryFailed);
      manager.off('recoveryAbandoned', handleRecoveryFailed);
      manager.off('failureDetected', handleFailureDetected);
      manager.off('reconnectionSuccessful', handleStateChange);
    };
  }, [manager, config]);

  // Auto-start if configured
  useEffect(() => {
    if (config.autoStart && !state.isConnected && state.status === 'idle') {
      manager.detectFailure('unknown', 'Initial connection check');
    }
  }, [config.autoStart, state.isConnected, state.status, manager]);

  const startRecovery = useCallback(async (): Promise<RecoveryResult> => {
    return await manager.startRecovery();
  }, [manager]);

  const manualRecovery = useCallback(async (): Promise<RecoveryResult> => {
    return await manager.manualRecovery();
  }, [manager]);

  const detectFailure = useCallback(async (reason: FailureReason, error: string): Promise<void> => {
    await manager.detectFailure(reason, error);
  }, [manager]);

  const stop = useCallback((): void => {
    manager.stop();
    setIsRecovering(false);
  }, [manager]);

  const getConnectionHealth = useCallback(async (): Promise<ConnectionHealth> => {
    return await manager.getConnectionHealth();
  }, [manager]);

  return {
    manager,
    state,
    isRecovering,
    isConnected: state.isConnected,
    startRecovery,
    manualRecovery,
    detectFailure,
    stop,
    getConnectionHealth
  };
};

// ============================================================================
// CONNECTION RECOVERY HOOK
// ============================================================================

/**
 * Hook for connection recovery state and controls
 */
export const useConnectionRecovery = (): UseConnectionRecoveryResult => {
  const { state, manualRecovery, detectFailure } = useRecoveryManager();
  const [nextAttemptIn, setNextAttemptIn] = useState<number | undefined>();

  // Update countdown timer
  useEffect(() => {
    if (!state.nextAttemptTime) {
      setNextAttemptIn(undefined);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, state.nextAttemptTime! - Date.now());
      setNextAttemptIn(remaining);
      
      if (remaining <= 0) {
        setNextAttemptIn(undefined);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [state.nextAttemptTime]);

  const recover = useCallback(async (): Promise<void> => {
    await manualRecovery();
  }, [manualRecovery]);

  const reset = useCallback(async (): Promise<void> => {
    // Reset recovery state by triggering a manual success
    await detectFailure('unknown', 'Manual reset');
    await recover();
  }, [detectFailure, recover]);

  return {
    status: state.status,
    isConnected: state.isConnected,
    isRecovering: ['detecting', 'reconnecting', 'synchronizing', 'resolving'].includes(state.status),
    lastFailureReason: state.lastFailure?.reason,
    attemptCount: state.totalAttempts,
    nextAttemptIn,
    estimatedRecoveryTime: state.estimatedRecoveryTime,
    recover,
    reset
  };
};

// ============================================================================
// AUTOMATIC RECOVERY HOOK
// ============================================================================

/**
 * Hook for automatic recovery management
 */
export const useAutomaticRecovery = (): UseAutomaticRecoveryResult => {
  const { manager, state } = useRecoveryManager();
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentStrategy, setCurrentStrategy] = useState<string>('balanced');
  const [failureCount, setFailureCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);

  // Calculate success rate
  const successRate = useMemo(() => {
    const total = failureCount + successCount;
    return total > 0 ? successCount / total : 1;
  }, [failureCount, successCount]);

  // Track recovery attempts
  useEffect(() => {
    const handleRecoveryCompleted = () => {
      setSuccessCount(prev => prev + 1);
    };

    const handleRecoveryFailed = () => {
      setFailureCount(prev => prev + 1);
    };

    manager.on('recoveryCompleted', handleRecoveryCompleted);
    manager.on('recoveryAttemptFailed', handleRecoveryFailed);
    manager.on('recoveryAbandoned', handleRecoveryFailed);

    return () => {
      manager.off('recoveryCompleted', handleRecoveryCompleted);
      manager.off('recoveryAttemptFailed', handleRecoveryFailed);
      manager.off('recoveryAbandoned', handleRecoveryFailed);
    };
  }, [manager]);

  const enable = useCallback((): void => {
    setIsEnabled(true);
    // Restart manager with current config
  }, []);

  const disable = useCallback((): void => {
    setIsEnabled(false);
    manager.stop();
  }, [manager]);

  const setStrategy = useCallback((strategy: 'aggressive' | 'balanced' | 'conservative'): void => {
    setCurrentStrategy(strategy);
    // Would reconfigure manager with new strategy
    const newConfig = createRecoveryConfig(strategy);
    // Implementation would update manager configuration
  }, []);

  const triggerRecovery = useCallback(async (reason: FailureReason, error: string): Promise<void> => {
    if (isEnabled) {
      await manager.detectFailure(reason, error);
    }
  }, [manager, isEnabled]);

  return {
    isEnabled,
    isActive: state.status !== 'idle' && state.status !== 'recovered',
    currentStrategy,
    failureCount,
    successRate,
    enable,
    disable,
    setStrategy,
    triggerRecovery
  };
};

// ============================================================================
// SYNC RECOVERY HOOK
// ============================================================================

/**
 * Hook for data synchronization on reconnect
 */
export const useSyncRecovery = (): UseSyncRecoveryResult => {
  const { state } = useRecoveryManager();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncOnReconnect, setSyncOnReconnectState] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<number | undefined>();

  const performSync = useCallback(async (): Promise<{ synced: number; conflicts: number }> => {
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      // Simulate sync progress
      for (let i = 0; i <= 100; i += 10) {
        setSyncProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const result = {
        synced: state.pendingSyncOperations,
        conflicts: state.unresolvedConflicts
      };

      setLastSyncTime(Date.now());
      setSyncProgress(100);

      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  }, [state.pendingSyncOperations, state.unresolvedConflicts]);

  const setSyncOnReconnect = useCallback((enabled: boolean): void => {
    setSyncOnReconnectState(enabled);
    // Would update manager configuration
  }, []);

  const clearPendingOperations = useCallback((): void => {
    // Would clear pending operations in the manager
  }, []);

  return {
    isSyncing,
    syncProgress,
    pendingOperations: state.pendingSyncOperations,
    unresolvedConflicts: state.unresolvedConflicts,
    lastSyncTime,
    syncOnReconnect,
    performSync,
    setSyncOnReconnect,
    clearPendingOperations
  };
};

// ============================================================================
// RECOVERY STATS HOOK
// ============================================================================

/**
 * Hook for recovery statistics and monitoring
 */
export const useRecoveryStats = (): UseRecoveryStatsResult => {
  const { state } = useRecoveryManager();
  const [isLoading, setIsLoading] = useState(false);

  const stats: RecoveryStats = useMemo(() => {
    const attempts = state.attempts || [];
    const successfulAttempts = attempts.filter(a => a.success);
    const failedAttempts = attempts.filter(a => !a.success);

    const averageRecoveryTime = successfulAttempts.length > 0
      ? successfulAttempts.reduce((sum, a) => sum + a.duration, 0) / successfulAttempts.length
      : 0;

    const longestDowntime = failedAttempts.length > 0
      ? Math.max(...failedAttempts.map(a => a.duration))
      : 0;

    const uptime = state.lastRecoveryTime 
      ? Date.now() - state.lastRecoveryTime
      : 0;

    const reliability = state.totalAttempts > 0
      ? state.successfulRecoveries / state.totalAttempts
      : 1;

    return {
      totalAttempts: state.totalAttempts,
      successfulRecoveries: state.successfulRecoveries,
      failedAttempts: failedAttempts.length,
      averageRecoveryTime,
      longestDowntime,
      uptime,
      reliability,
      lastRecoveryTime: state.lastRecoveryTime,
      recentAttempts: attempts.slice(-5) // Last 5 attempts
    };
  }, [state]);

  const refresh = useCallback((): void => {
    setIsLoading(true);
    // Simulate refresh delay
    setTimeout(() => setIsLoading(false), 100);
  }, []);

  const reset = useCallback((): void => {
    // Would reset statistics in the manager
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 100);
  }, []);

  return {
    stats,
    refresh,
    reset,
    isLoading
  };
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for recovery configuration management
 */
export const useRecoveryConfig = (initialConfig?: Partial<RecoveryConfig>) => {
  const [config, setConfig] = useState<RecoveryConfig>(() => 
    initialConfig ? { ...getRecoveryManager().getState(), ...initialConfig } as RecoveryConfig 
                 : createRecoveryConfig('balanced')
  );

  const updateConfig = useCallback((updates: Partial<RecoveryConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(createRecoveryConfig('balanced'));
  }, []);

  const applyPreset = useCallback((preset: 'aggressive' | 'balanced' | 'conservative') => {
    setConfig(createRecoveryConfig(preset));
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    applyPreset
  };
};

/**
 * Hook for recovery notifications
 */
export const useRecoveryNotifications = (enabled: boolean = true) => {
  const { state } = useRecoveryManager();
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'recovery_started' | 'recovery_completed' | 'recovery_failed' | 'connection_lost';
    message: string;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    if (!enabled) return;

    // Monitor state changes and create notifications
    const prevStatus = useRef(state.status);
    
    if (prevStatus.current !== state.status) {
      let message = '';
      let type: any = '';

      switch (state.status) {
        case 'reconnecting':
          type = 'recovery_started';
          message = `Recovery attempt ${state.totalAttempts} started`;
          break;
        case 'recovered':
          type = 'recovery_completed';
          message = 'Connection recovered successfully';
          break;
        case 'failed':
        case 'abandoned':
          type = 'recovery_failed';
          message = 'Recovery attempt failed';
          break;
        case 'detecting':
          type = 'connection_lost';
          message = 'Connection lost, starting recovery';
          break;
      }

      if (message) {
        const notification = {
          id: `recovery_${Date.now()}`,
          type,
          message,
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev.slice(-4), notification]); // Keep last 5
      }

      prevStatus.current = state.status;
    }
  }, [state.status, state.totalAttempts, enabled]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    clearNotifications,
    dismissNotification
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default useRecoveryManager;