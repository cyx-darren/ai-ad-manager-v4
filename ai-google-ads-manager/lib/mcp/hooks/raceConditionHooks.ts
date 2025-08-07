/**
 * Race Condition Handling Hooks
 * 
 * Provides React hooks for managing race conditions and concurrent updates
 * in dashboard state management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { stateUpdateQueue, StateUpdate, QueueStats } from '../utils/stateQueue';
import { 
  concurrentUpdateHandler, 
  ConflictInfo, 
  VersionedState,
  UpdateContext 
} from '../utils/concurrentUpdates';
import { 
  conflictResolutionManager, 
  ResolutionStrategy, 
  ResolutionResult 
} from '../utils/conflictResolution';

export interface RaceConditionOptions {
  enableQueueing?: boolean;
  enableVersioning?: boolean;
  enableConflictResolution?: boolean;
  defaultResolutionStrategy?: ResolutionStrategy;
  maxRetries?: number;
  autoResolveSimple?: boolean;
}

export interface SafeUpdateResult {
  success: boolean;
  updateId?: string;
  version?: number;
  conflicts?: ConflictInfo[];
  errors?: string[];
  warnings?: string[];
}

export interface RaceConditionState {
  isUpdating: boolean;
  queueSize: number;
  hasConflicts: boolean;
  lastUpdate: Date | null;
  version: number;
  conflicts: ConflictInfo[];
  stats: QueueStats;
}

/**
 * Main hook for race condition handling
 */
export function useRaceConditionHandler(
  stateKey: string,
  options: RaceConditionOptions = {}
) {
  const {
    enableQueueing = true,
    enableVersioning = true,
    enableConflictResolution = true,
    defaultResolutionStrategy = 'last_writer_wins',
    maxRetries = 3,
    autoResolveSimple = true
  } = options;

  const [state, setState] = useState<RaceConditionState>({
    isUpdating: false,
    queueSize: 0,
    hasConflicts: false,
    lastUpdate: null,
    version: 1,
    conflicts: [],
    stats: stateUpdateQueue.getStats()
  });

  const versionRef = useRef<number>(1);
  const lastUpdateRef = useRef<Date | null>(null);

  // Initialize versioned state if needed
  useEffect(() => {
    if (enableVersioning) {
      const existingState = concurrentUpdateHandler.getVersionedState(stateKey);
      if (!existingState) {
        concurrentUpdateHandler.initializeState(stateKey, {}, 'system');
      }
    }
  }, [stateKey, enableVersioning]);

  // Safe update function with race condition protection
  const safeUpdate = useCallback(async (
    newData: any,
    updateType: string = 'data',
    source: string = 'user',
    priority: StateUpdate['priority'] = 'normal'
  ): Promise<SafeUpdateResult> => {
    
    setState(prev => ({ ...prev, isUpdating: true }));

    try {
      // Create update context
      const context: UpdateContext = {
        id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: updateType,
        source,
        timestamp: Date.now(),
        expectedVersion: enableVersioning ? versionRef.current : undefined
      };

      // If versioning is enabled, attempt concurrent update handling
      if (enableVersioning) {
        const updateResult = await concurrentUpdateHandler.updateState(
          stateKey,
          newData,
          context
        );

        if (!updateResult.success && updateResult.conflict) {
          // Handle conflict
          if (enableConflictResolution) {
            const resolution = await conflictResolutionManager.resolveConflict(
              updateResult.conflict,
              defaultResolutionStrategy
            );

            if (resolution.success && !resolution.requiresUserAction) {
              // Apply resolved data
              const resolvedResult = await concurrentUpdateHandler.updateState(
                stateKey,
                resolution.resolvedData,
                { ...context, force: true }
              );

              if (resolvedResult.success) {
                versionRef.current = resolvedResult.state!.version;
                lastUpdateRef.current = new Date();
                
                setState(prev => ({
                  ...prev,
                  version: resolvedResult.state!.version,
                  lastUpdate: new Date(),
                  hasConflicts: false
                }));

                return {
                  success: true,
                  version: resolvedResult.state!.version,
                  warnings: resolution.warnings
                };
              }
            }

            // Resolution requires user action or failed
            setState(prev => ({
              ...prev,
              hasConflicts: true,
              conflicts: [updateResult.conflict!]
            }));

            return {
              success: false,
              conflicts: [updateResult.conflict!],
              errors: ['Update conflict requires resolution']
            };
          }

          return {
            success: false,
            conflicts: [updateResult.conflict],
            errors: ['Update conflict detected']
          };
        }

        // Successful update
        if (updateResult.success && updateResult.state) {
          versionRef.current = updateResult.state.version;
          lastUpdateRef.current = new Date();
          
          setState(prev => ({
            ...prev,
            version: updateResult.state!.version,
            lastUpdate: new Date(),
            hasConflicts: false
          }));

          return {
            success: true,
            version: updateResult.state.version
          };
        }
      }

      // Fall back to queue-based update if versioning is disabled
      if (enableQueueing) {
        const updateId = stateUpdateQueue.enqueue({
          type: updateType as StateUpdate['type'],
          priority,
          payload: newData,
          source: source as StateUpdate['source'],
          maxRetries,
          onSuccess: (result) => {
            setState(prev => ({
              ...prev,
              lastUpdate: new Date(),
              queueSize: stateUpdateQueue.getStats().currentQueueSize
            }));
          },
          onError: (error) => {
            console.error('Queued update failed:', error);
          }
        });

        setState(prev => ({
          ...prev,
          queueSize: stateUpdateQueue.getStats().currentQueueSize
        }));

        return {
          success: true,
          updateId
        };
      }

      // Direct update without protection (not recommended)
      lastUpdateRef.current = new Date();
      setState(prev => ({ ...prev, lastUpdate: new Date() }));

      return { success: true };

    } catch (error) {
      return {
        success: false,
        errors: [`Update failed: ${error}`]
      };
    } finally {
      setState(prev => ({ ...prev, isUpdating: false }));
    }
  }, [
    stateKey, 
    enableQueueing, 
    enableVersioning, 
    enableConflictResolution,
    defaultResolutionStrategy,
    maxRetries
  ]);

  // Resolve conflict manually
  const resolveConflict = useCallback(async (
    conflictId: string,
    choice: 'accept' | 'reject' | 'merge'
  ): Promise<ResolutionResult> => {
    try {
      const result = await conflictResolutionManager.resolveWithUserChoice(
        conflictId,
        choice
      );

      if (result.success) {
        // Remove resolved conflict from state
        setState(prev => ({
          ...prev,
          conflicts: prev.conflicts.filter(c => c.id !== conflictId),
          hasConflicts: prev.conflicts.length > 1
        }));
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error}`);
    }
  }, []);

  // Get current version
  const getCurrentVersion = useCallback((): number => {
    if (enableVersioning) {
      const versionedState = concurrentUpdateHandler.getVersionedState(stateKey);
      return versionedState?.version || 1;
    }
    return versionRef.current;
  }, [stateKey, enableVersioning]);

  // Check if state can be safely updated
  const canUpdate = useCallback((): boolean => {
    if (enableVersioning) {
      return concurrentUpdateHandler.canUpdate(stateKey, versionRef.current);
    }
    return !state.isUpdating;
  }, [stateKey, enableVersioning, state.isUpdating]);

  // Update queue and conflict stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        stats: stateUpdateQueue.getStats(),
        queueSize: stateUpdateQueue.getStats().currentQueueSize
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    state,
    safeUpdate,
    resolveConflict,
    getCurrentVersion,
    canUpdate,
    isUpdating: state.isUpdating,
    hasConflicts: state.hasConflicts,
    queueSize: state.queueSize,
    version: state.version,
    conflicts: state.conflicts
  };
}

/**
 * Hook for monitoring queue statistics
 */
export function useQueueStats() {
  const [stats, setStats] = useState<QueueStats>(stateUpdateQueue.getStats());

  useEffect(() => {
    const updateStats = () => {
      setStats(stateUpdateQueue.getStats());
    };

    stateUpdateQueue.addEventListener('enqueued', updateStats);
    stateUpdateQueue.addEventListener('success', updateStats);
    stateUpdateQueue.addEventListener('error', updateStats);
    stateUpdateQueue.addEventListener('cancelled', updateStats);

    const interval = setInterval(updateStats, 2000);

    return () => {
      stateUpdateQueue.removeEventListener('enqueued', updateStats);
      stateUpdateQueue.removeEventListener('success', updateStats);
      stateUpdateQueue.removeEventListener('error', updateStats);
      stateUpdateQueue.removeEventListener('cancelled', updateStats);
      clearInterval(interval);
    };
  }, []);

  const clearQueue = useCallback(() => {
    stateUpdateQueue.clear();
  }, []);

  const pauseQueue = useCallback(() => {
    stateUpdateQueue.pause();
  }, []);

  const resumeQueue = useCallback(() => {
    stateUpdateQueue.resume();
  }, []);

  return {
    stats,
    clearQueue,
    pauseQueue,
    resumeQueue
  };
}

/**
 * Hook for monitoring conflicts
 */
export function useConflictMonitor() {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [resolutionStats, setResolutionStats] = useState(
    conflictResolutionManager.getStats()
  );

  useEffect(() => {
    const handleConflict = (data: { conflict: ConflictInfo }) => {
      setConflicts(prev => [...prev, data.conflict]);
    };

    const handleResolution = () => {
      setResolutionStats(conflictResolutionManager.getStats());
    };

    concurrentUpdateHandler.addEventListener('version_conflict', handleConflict);
    concurrentUpdateHandler.addEventListener('concurrent_conflict', handleConflict);
    conflictResolutionManager.addEventListener('conflict_resolved', handleResolution);

    const interval = setInterval(() => {
      setResolutionStats(conflictResolutionManager.getStats());
    }, 5000);

    return () => {
      concurrentUpdateHandler.removeEventListener('version_conflict', handleConflict);
      concurrentUpdateHandler.removeEventListener('concurrent_conflict', handleConflict);
      conflictResolutionManager.removeEventListener('conflict_resolved', handleResolution);
      clearInterval(interval);
    };
  }, []);

  const clearConflictHistory = useCallback(() => {
    concurrentUpdateHandler.clearConflictHistory();
    setConflicts([]);
  }, []);

  return {
    conflicts,
    resolutionStats,
    clearConflictHistory
  };
}

/**
 * Hook for safe state updates with automatic race condition handling
 */
export function useSafeStateUpdate<T>(
  initialValue: T,
  stateKey: string,
  options: RaceConditionOptions = {}
) {
  const [value, setValue] = useState<T>(initialValue);
  const { safeUpdate, isUpdating, hasConflicts } = useRaceConditionHandler(stateKey, options);

  const updateValue = useCallback(async (
    newValue: T | ((prev: T) => T),
    updateType: string = 'state',
    source: string = 'user'
  ): Promise<SafeUpdateResult> => {
    
    const actualNewValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(value)
      : newValue;

    const result = await safeUpdate(actualNewValue, updateType, source);
    
    if (result.success) {
      setValue(actualNewValue);
    }

    return result;
  }, [value, safeUpdate]);

  return {
    value,
    updateValue,
    isUpdating,
    hasConflicts
  };
}

export default useRaceConditionHandler;