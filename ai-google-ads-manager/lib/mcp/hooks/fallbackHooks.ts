/**
 * Fallback React Hooks (Phase 2)
 * 
 * This file provides React hooks for managing fallback mechanisms and degraded functionality:
 * - useFallbackManager: Main hook for fallback management
 * - useDegradationLevel: Hook for monitoring degradation levels
 * - useFeatureAvailability: Hook for checking feature availability
 * - useQueuedOperations: Hook for managing queued operations
 * - useMockDataCache: Hook for mock data management
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FallbackManager,
  FallbackManagerConfig,
  FallbackManagerEvents,
  FallbackManagerState,
  OperationType,
  FallbackStrategy,
  DegradationLevel,
  FeatureConfig,
  QueuedOperation,
  FallbackOperationConfig,
  DEFAULT_FALLBACK_CONFIG
} from '../utils/fallbackManager';

// ============================================================================
// HOOK RESULT TYPES
// ============================================================================

/**
 * Result type for useFallbackManager hook
 */
export interface FallbackManagerResult {
  // Manager instance
  manager: FallbackManager | null;
  
  // State
  state: FallbackManagerState;
  degradationLevel: DegradationLevel;
  isOnline: boolean;
  isFullyFunctional: boolean;
  
  // Feature availability
  availableFeatures: string[];
  disabledFeatures: string[];
  getFeatureStatus: (featureId: string) => 'available' | 'disabled' | 'degraded';
  
  // Operation execution
  executeWithFallback: <T>(
    operationType: OperationType,
    operation: () => Promise<T>,
    config?: Partial<FallbackOperationConfig>
  ) => Promise<T | any>;
  
  // Queue management
  queueOperation: (
    operationType: OperationType,
    operation: () => Promise<any>,
    params: any,
    priority?: 'high' | 'medium' | 'low'
  ) => string;
  queuedOperationsCount: number;
  
  // Mock data
  getMockData: (operationType: OperationType) => any;
  clearMockDataCache: () => void;
  
  // Configuration
  updateConfig: (config: Partial<FallbackManagerConfig>) => void;
  
  // Status
  isReady: boolean;
  error: Error | null;
  
  // Statistics
  stats: {
    totalFallbackActivations: number;
    lastFallbackActivation: number;
    queueSize: number;
    cacheSize: number;
    operationHistorySize: number;
  };
}

/**
 * Result type for useDegradationLevel hook
 */
export interface DegradationLevelResult {
  currentLevel: DegradationLevel;
  previousLevel: DegradationLevel | null;
  isFullyFunctional: boolean;
  isLimited: boolean;
  isMinimal: boolean;
  isReadOnly: boolean;
  isOffline: boolean;
  levelDescription: string;
  recommendations: string[];
  lastChanged: number;
  changeHistory: Array<{
    from: DegradationLevel;
    to: DegradationLevel;
    timestamp: number;
  }>;
}

/**
 * Result type for useFeatureAvailability hook
 */
export interface FeatureAvailabilityResult {
  features: Map<string, {
    isAvailable: boolean;
    status: 'available' | 'disabled' | 'degraded';
    config: FeatureConfig;
    lastStatusChange: number;
    userMessage?: string;
    alternativeFeatures?: string[];
  }>;
  
  availableFeatures: string[];
  disabledFeatures: string[];
  degradedFeatures: string[];
  
  isFeatureAvailable: (featureId: string) => boolean;
  getFeatureStatus: (featureId: string) => 'available' | 'disabled' | 'degraded' | 'unknown';
  getFeatureMessage: (featureId: string) => string | undefined;
  getAlternativeFeatures: (featureId: string) => string[];
  
  essentialFeaturesAvailable: boolean;
  availabilityScore: number; // 0-1 representing overall feature availability
}

/**
 * Result type for useQueuedOperations hook
 */
export interface QueuedOperationsResult {
  operations: QueuedOperation[];
  queueSize: number;
  isEmpty: boolean;
  
  // Queue statistics
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  
  // Queue management
  getOperation: (id: string) => QueuedOperation | undefined;
  removeOperation: (id: string) => boolean;
  clearQueue: () => void;
  
  // Queue monitoring
  averageWaitTime: number;
  oldestOperation: QueuedOperation | null;
  newestOperation: QueuedOperation | null;
  
  // Retry information
  operationsWithRetries: QueuedOperation[];
  totalRetryCount: number;
}

/**
 * Result type for useMockDataCache hook
 */
export interface MockDataCacheResult {
  cache: Map<string, { data: any; expiry: number }>;
  cacheSize: number;
  isEmpty: boolean;
  
  // Cache operations
  getCachedData: (key: string) => any | null;
  setCachedData: (key: string, data: any, ttl?: number) => void;
  removeCachedData: (key: string) => boolean;
  clearCache: () => void;
  
  // Cache statistics
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  
  // Cache health
  expiredEntries: number;
  cacheUtilization: number; // 0-1 representing cache usage
  averageDataAge: number;
}

// ============================================================================
// HOOK CONFIGURATIONS
// ============================================================================

/**
 * Configuration for useFallbackManager hook
 */
export interface UseFallbackManagerConfig {
  autoStart?: boolean;
  config?: Partial<FallbackManagerConfig>;
  events?: FallbackManagerEvents;
  enableAutoRecovery?: boolean;
  recoveryCheckInterval?: number;
  onlineCheckMethod?: 'navigator' | 'ping' | 'both';
}

/**
 * Configuration for feature availability monitoring
 */
export interface UseFeatureAvailabilityConfig {
  watchFeatures?: string[];
  enableNotifications?: boolean;
  notificationDuration?: number;
  trackHistory?: boolean;
  maxHistorySize?: number;
}

// ============================================================================
// MAIN FALLBACK MANAGER HOOK
// ============================================================================

/**
 * Main hook for managing fallback functionality
 */
export function useFallbackManager(
  config: UseFallbackManagerConfig = {}
): FallbackManagerResult {
  const {
    autoStart = true,
    config: managerConfig = {},
    events = {},
    enableAutoRecovery = true,
    recoveryCheckInterval = 30000,
    onlineCheckMethod = 'both'
  } = config;

  // State
  const [manager, setManager] = useState<FallbackManager | null>(null);
  const [state, setState] = useState<FallbackManagerState>({
    currentDegradationLevel: 'full',
    activeStrategies: new Map(),
    disabledFeatures: new Set(),
    queuedOperations: [],
    mockDataCache: new Map(),
    lastFallbackActivation: 0,
    totalFallbackActivations: 0,
    operationHistory: []
  });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Refs for cleanup
  const recoveryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced events with state updates
  const enhancedEvents = useMemo<FallbackManagerEvents>(() => ({
    ...events,
    onDegradationLevelChange: (level, previousLevel) => {
      setState(prevState => ({ ...prevState, currentDegradationLevel: level }));
      events.onDegradationLevelChange?.(level, previousLevel);
    },
    onFeatureDisabled: (featureId, reason) => {
      setState(prevState => ({
        ...prevState,
        disabledFeatures: new Set([...prevState.disabledFeatures, featureId])
      }));
      events.onFeatureDisabled?.(featureId, reason);
    },
    onFeatureRestored: (featureId) => {
      setState(prevState => {
        const newDisabledFeatures = new Set(prevState.disabledFeatures);
        newDisabledFeatures.delete(featureId);
        return { ...prevState, disabledFeatures: newDisabledFeatures };
      });
      events.onFeatureRestored?.(featureId);
    },
    onFallbackActivated: (operationType, strategy) => {
      setState(prevState => ({
        ...prevState,
        totalFallbackActivations: prevState.totalFallbackActivations + 1,
        lastFallbackActivation: Date.now()
      }));
      events.onFallbackActivated?.(operationType, strategy);
    },
    onOperationQueued: (operation) => {
      setState(prevState => ({
        ...prevState,
        queuedOperations: [...prevState.queuedOperations, operation]
      }));
      events.onOperationQueued?.(operation);
    },
    onQueuedOperationExecuted: (operation, result) => {
      setState(prevState => ({
        ...prevState,
        queuedOperations: prevState.queuedOperations.filter(op => op.id !== operation.id)
      }));
      events.onQueuedOperationExecuted?.(operation, result);
    }
  }), [events]);

  // Initialize manager
  useEffect(() => {
    try {
      const finalConfig = { ...DEFAULT_FALLBACK_CONFIG, ...managerConfig };
      const fallbackManager = new FallbackManager(finalConfig, enhancedEvents);
      
      setManager(fallbackManager);
      setError(null);

      if (autoStart) {
        fallbackManager.start();
      }

      setIsReady(true);

      return () => {
        fallbackManager.stop();
      };
    } catch (err) {
      setError(err as Error);
      setIsReady(false);
    }
  }, [autoStart, managerConfig, enhancedEvents]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (onlineCheckMethod === 'navigator' || onlineCheckMethod === 'both') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onlineCheckMethod]);

  // Auto-recovery mechanism
  useEffect(() => {
    if (!enableAutoRecovery || !manager) return;

    recoveryIntervalRef.current = setInterval(async () => {
      if (!isOnline) {
        // Try to detect if we're back online
        if (onlineCheckMethod === 'ping' || onlineCheckMethod === 'both') {
          try {
            const response = await fetch('/api/health', { 
              method: 'HEAD',
              cache: 'no-cache',
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok && !isOnline) {
              setIsOnline(true);
            }
          } catch {
            // Still offline
            if (isOnline) {
              setIsOnline(false);
            }
          }
        }
      }
    }, recoveryCheckInterval);

    return () => {
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
      }
    };
  }, [enableAutoRecovery, manager, isOnline, recoveryCheckInterval, onlineCheckMethod]);

  // Periodic state updates
  useEffect(() => {
    if (!manager) return;

    stateUpdateIntervalRef.current = setInterval(() => {
      const currentState = manager.getState();
      setState(currentState);
    }, 1000); // Update every second

    return () => {
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
      }
    };
  }, [manager]);

  // Memoized derived state
  const derivedState = useMemo(() => {
    const availableFeatures = (manager?.getState().disabledFeatures) 
      ? Array.from(DEFAULT_FALLBACK_CONFIG.features
          .filter(f => !manager.getState().disabledFeatures.has(f.featureId))
          .map(f => f.featureId))
      : [];

    const disabledFeatures = Array.from(state.disabledFeatures);
    
    const isFullyFunctional = state.currentDegradationLevel === 'full';

    return {
      availableFeatures,
      disabledFeatures,
      isFullyFunctional
    };
  }, [manager, state.disabledFeatures, state.currentDegradationLevel]);

  // Callback functions
  const executeWithFallback = useCallback(
    async <T>(
      operationType: OperationType,
      operation: () => Promise<T>,
      operationConfig?: Partial<FallbackOperationConfig>
    ): Promise<T | any> => {
      if (!manager) {
        throw new Error('Fallback manager not initialized');
      }
      
      return manager.executeWithFallback(operationType, operation, operationConfig);
    },
    [manager]
  );

  const queueOperation = useCallback(
    (
      operationType: OperationType,
      operation: () => Promise<any>,
      params: any,
      priority: 'high' | 'medium' | 'low' = 'medium'
    ): string => {
      if (!manager) {
        throw new Error('Fallback manager not initialized');
      }
      
      return manager.queueOperation(operationType, operation, params, priority);
    },
    [manager]
  );

  const getMockData = useCallback(
    (operationType: OperationType) => {
      return manager?.getMockData(operationType) || null;
    },
    [manager]
  );

  const clearMockDataCache = useCallback(() => {
    if (manager) {
      const currentState = manager.getState();
      currentState.mockDataCache.clear();
    }
  }, [manager]);

  const getFeatureStatus = useCallback(
    (featureId: string): 'available' | 'disabled' | 'degraded' => {
      if (state.disabledFeatures.has(featureId)) {
        return 'disabled';
      }
      
      const feature = DEFAULT_FALLBACK_CONFIG.features.find(f => f.featureId === featureId);
      if (!feature) {
        return 'disabled';
      }

      if (state.currentDegradationLevel !== 'full' && feature.fallbackBehavior === 'degrade') {
        return 'degraded';
      }

      return 'available';
    },
    [state.disabledFeatures, state.currentDegradationLevel]
  );

  const updateConfig = useCallback(
    (newConfig: Partial<FallbackManagerConfig>) => {
      manager?.updateConfig(newConfig);
    },
    [manager]
  );

  // Statistics
  const stats = useMemo(() => ({
    totalFallbackActivations: state.totalFallbackActivations,
    lastFallbackActivation: state.lastFallbackActivation,
    queueSize: state.queuedOperations.length,
    cacheSize: state.mockDataCache.size,
    operationHistorySize: state.operationHistory.length
  }), [state]);

  return {
    manager,
    state,
    degradationLevel: state.currentDegradationLevel,
    isOnline,
    isFullyFunctional: derivedState.isFullyFunctional,
    availableFeatures: derivedState.availableFeatures,
    disabledFeatures: derivedState.disabledFeatures,
    getFeatureStatus,
    executeWithFallback,
    queueOperation,
    queuedOperationsCount: state.queuedOperations.length,
    getMockData,
    clearMockDataCache,
    updateConfig,
    isReady,
    error,
    stats
  };
}

// ============================================================================
// DEGRADATION LEVEL HOOK
// ============================================================================

/**
 * Hook for monitoring degradation levels
 */
export function useDegradationLevel(
  fallbackManager?: FallbackManager
): DegradationLevelResult {
  const [currentLevel, setCurrentLevel] = useState<DegradationLevel>('full');
  const [previousLevel, setPreviousLevel] = useState<DegradationLevel | null>(null);
  const [lastChanged, setLastChanged] = useState(Date.now());
  const [changeHistory, setChangeHistory] = useState<Array<{
    from: DegradationLevel;
    to: DegradationLevel;
    timestamp: number;
  }>>([]);

  // Monitor level changes
  useEffect(() => {
    if (!fallbackManager) return;

    const checkLevel = () => {
      const state = fallbackManager.getState();
      const newLevel = state.currentDegradationLevel;
      
      if (newLevel !== currentLevel) {
        setPreviousLevel(currentLevel);
        setCurrentLevel(newLevel);
        setLastChanged(Date.now());
        
        setChangeHistory(prev => {
          const newHistory = [...prev, {
            from: currentLevel,
            to: newLevel,
            timestamp: Date.now()
          }];
          
          // Keep only last 10 changes
          return newHistory.slice(-10);
        });
      }
    };

    const interval = setInterval(checkLevel, 1000);
    checkLevel(); // Initial check

    return () => clearInterval(interval);
  }, [fallbackManager, currentLevel]);

  // Derived state
  const isFullyFunctional = currentLevel === 'full';
  const isLimited = currentLevel === 'limited';
  const isMinimal = currentLevel === 'minimal';
  const isReadOnly = currentLevel === 'read_only';
  const isOffline = currentLevel === 'offline';

  const levelDescription = useMemo(() => {
    switch (currentLevel) {
      case 'full':
        return 'All features available';
      case 'limited':
        return 'Some features disabled';
      case 'minimal':
        return 'Only basic features available';
      case 'read_only':
        return 'Read-only mode - no write operations';
      case 'offline':
        return 'Offline mode - limited functionality';
      default:
        return 'Unknown status';
    }
  }, [currentLevel]);

  const recommendations = useMemo(() => {
    switch (currentLevel) {
      case 'full':
        return ['All systems operational'];
      case 'limited':
        return [
          'Some advanced features are temporarily unavailable',
          'Check your network connection',
          'Basic functionality remains available'
        ];
      case 'minimal':
        return [
          'Operating in minimal mode',
          'Check network connectivity',
          'Only essential features are available'
        ];
      case 'read_only':
        return [
          'Write operations are disabled',
          'You can view data but cannot make changes',
          'Check server connectivity'
        ];
      case 'offline':
        return [
          'Application is offline',
          'Limited cached data available',
          'Check your internet connection',
          'Some features will return when connection is restored'
        ];
      default:
        return ['Status unknown'];
    }
  }, [currentLevel]);

  return {
    currentLevel,
    previousLevel,
    isFullyFunctional,
    isLimited,
    isMinimal,
    isReadOnly,
    isOffline,
    levelDescription,
    recommendations,
    lastChanged,
    changeHistory
  };
}

// ============================================================================
// FEATURE AVAILABILITY HOOK
// ============================================================================

/**
 * Hook for monitoring feature availability
 */
export function useFeatureAvailability(
  fallbackManager?: FallbackManager,
  config: UseFeatureAvailabilityConfig = {}
): FeatureAvailabilityResult {
  const {
    watchFeatures,
    enableNotifications = false,
    notificationDuration = 5000,
    trackHistory = true,
    maxHistorySize = 50
  } = config;

  const [features, setFeatures] = useState<Map<string, {
    isAvailable: boolean;
    status: 'available' | 'disabled' | 'degraded';
    config: FeatureConfig;
    lastStatusChange: number;
    userMessage?: string;
    alternativeFeatures?: string[];
  }>>(new Map());

  // Initialize features
  useEffect(() => {
    const initialFeatures = new Map();
    
    for (const featureConfig of DEFAULT_FALLBACK_CONFIG.features) {
      initialFeatures.set(featureConfig.featureId, {
        isAvailable: true,
        status: 'available' as const,
        config: featureConfig,
        lastStatusChange: Date.now(),
        userMessage: featureConfig.userMessage,
        alternativeFeatures: featureConfig.alternativeFeatures
      });
    }
    
    setFeatures(initialFeatures);
  }, []);

  // Monitor feature availability
  useEffect(() => {
    if (!fallbackManager) return;

    const checkFeatures = () => {
      const state = fallbackManager.getState();
      
      setFeatures(prevFeatures => {
        const newFeatures = new Map(prevFeatures);
        
        for (const [featureId, featureData] of newFeatures.entries()) {
          const isCurrentlyDisabled = state.disabledFeatures.has(featureId);
          const wasAvailable = featureData.isAvailable;
          const isNowAvailable = !isCurrentlyDisabled;
          
          if (wasAvailable !== isNowAvailable) {
            newFeatures.set(featureId, {
              ...featureData,
              isAvailable: isNowAvailable,
              status: isNowAvailable ? 'available' : 'disabled',
              lastStatusChange: Date.now()
            });
            
            // Show notification if enabled
            if (enableNotifications && typeof window !== 'undefined') {
              const message = isNowAvailable 
                ? `Feature "${featureData.config.name}" is now available`
                : `Feature "${featureData.config.name}" is temporarily disabled`;
              
              // You could integrate with a notification system here
              console.info(`[Feature Availability] ${message}`);
            }
          }
        }
        
        return newFeatures;
      });
    };

    const interval = setInterval(checkFeatures, 1000);
    checkFeatures(); // Initial check

    return () => clearInterval(interval);
  }, [fallbackManager, enableNotifications]);

  // Derived state
  const availableFeatures = useMemo(() => 
    Array.from(features.entries())
      .filter(([_, data]) => data.isAvailable)
      .map(([id]) => id),
    [features]
  );

  const disabledFeatures = useMemo(() => 
    Array.from(features.entries())
      .filter(([_, data]) => !data.isAvailable)
      .map(([id]) => id),
    [features]
  );

  const degradedFeatures = useMemo(() => 
    Array.from(features.entries())
      .filter(([_, data]) => data.status === 'degraded')
      .map(([id]) => id),
    [features]
  );

  const essentialFeaturesAvailable = useMemo(() => {
    const essentialFeatures = Array.from(features.entries())
      .filter(([_, data]) => data.config.essentialForApp);
    
    return essentialFeatures.every(([_, data]) => data.isAvailable);
  }, [features]);

  const availabilityScore = useMemo(() => {
    if (features.size === 0) return 1;
    
    const availableCount = availableFeatures.length;
    return availableCount / features.size;
  }, [features.size, availableFeatures.length]);

  // Callback functions
  const isFeatureAvailable = useCallback(
    (featureId: string): boolean => {
      return features.get(featureId)?.isAvailable ?? false;
    },
    [features]
  );

  const getFeatureStatus = useCallback(
    (featureId: string): 'available' | 'disabled' | 'degraded' | 'unknown' => {
      return features.get(featureId)?.status ?? 'unknown';
    },
    [features]
  );

  const getFeatureMessage = useCallback(
    (featureId: string): string | undefined => {
      return features.get(featureId)?.userMessage;
    },
    [features]
  );

  const getAlternativeFeatures = useCallback(
    (featureId: string): string[] => {
      return features.get(featureId)?.alternativeFeatures ?? [];
    },
    [features]
  );

  return {
    features,
    availableFeatures,
    disabledFeatures,
    degradedFeatures,
    isFeatureAvailable,
    getFeatureStatus,
    getFeatureMessage,
    getAlternativeFeatures,
    essentialFeaturesAvailable,
    availabilityScore
  };
}

// ============================================================================
// QUEUED OPERATIONS HOOK
// ============================================================================

/**
 * Hook for monitoring queued operations
 */
export function useQueuedOperations(
  fallbackManager?: FallbackManager
): QueuedOperationsResult {
  const [operations, setOperations] = useState<QueuedOperation[]>([]);

  // Monitor queued operations
  useEffect(() => {
    if (!fallbackManager) return;

    const checkOperations = () => {
      const state = fallbackManager.getState();
      setOperations([...state.queuedOperations]);
    };

    const interval = setInterval(checkOperations, 1000);
    checkOperations(); // Initial check

    return () => clearInterval(interval);
  }, [fallbackManager]);

  // Derived state
  const queueSize = operations.length;
  const isEmpty = queueSize === 0;

  const priorityCounts = useMemo(() => {
    return operations.reduce(
      (counts, op) => {
        counts[op.priority]++;
        return counts;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [operations]);

  const oldestOperation = useMemo(() => {
    if (operations.length === 0) return null;
    return operations.reduce((oldest, op) => 
      op.timestamp < oldest.timestamp ? op : oldest
    );
  }, [operations]);

  const newestOperation = useMemo(() => {
    if (operations.length === 0) return null;
    return operations.reduce((newest, op) => 
      op.timestamp > newest.timestamp ? op : newest
    );
  }, [operations]);

  const averageWaitTime = useMemo(() => {
    if (operations.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = operations.reduce((total, op) => 
      total + (now - op.timestamp), 0
    );
    
    return totalWaitTime / operations.length;
  }, [operations]);

  const operationsWithRetries = useMemo(() => 
    operations.filter(op => op.retryCount > 0),
    [operations]
  );

  const totalRetryCount = useMemo(() => 
    operations.reduce((total, op) => total + op.retryCount, 0),
    [operations]
  );

  // Callback functions
  const getOperation = useCallback(
    (id: string): QueuedOperation | undefined => {
      return operations.find(op => op.id === id);
    },
    [operations]
  );

  const removeOperation = useCallback(
    (id: string): boolean => {
      const operationExists = operations.some(op => op.id === id);
      if (operationExists && fallbackManager) {
        const state = fallbackManager.getState();
        state.queuedOperations = state.queuedOperations.filter(op => op.id !== id);
        return true;
      }
      return false;
    },
    [operations, fallbackManager]
  );

  const clearQueue = useCallback(() => {
    if (fallbackManager) {
      const state = fallbackManager.getState();
      state.queuedOperations.length = 0;
    }
  }, [fallbackManager]);

  return {
    operations,
    queueSize,
    isEmpty,
    highPriorityCount: priorityCounts.high,
    mediumPriorityCount: priorityCounts.medium,
    lowPriorityCount: priorityCounts.low,
    getOperation,
    removeOperation,
    clearQueue,
    averageWaitTime,
    oldestOperation,
    newestOperation,
    operationsWithRetries,
    totalRetryCount
  };
}

// ============================================================================
// MOCK DATA CACHE HOOK
// ============================================================================

/**
 * Hook for managing mock data cache
 */
export function useMockDataCache(
  fallbackManager?: FallbackManager
): MockDataCacheResult {
  const [cache, setCache] = useState<Map<string, { data: any; expiry: number }>>(new Map());
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0
  });

  // Monitor cache
  useEffect(() => {
    if (!fallbackManager) return;

    const checkCache = () => {
      const state = fallbackManager.getState();
      setCache(new Map(state.mockDataCache));
    };

    const interval = setInterval(checkCache, 1000);
    checkCache(); // Initial check

    return () => clearInterval(interval);
  }, [fallbackManager]);

  // Derived state
  const cacheSize = cache.size;
  const isEmpty = cacheSize === 0;

  const expiredEntries = useMemo(() => {
    const now = Date.now();
    return Array.from(cache.values()).filter(entry => entry.expiry <= now).length;
  }, [cache]);

  const cacheUtilization = useMemo(() => {
    if (!fallbackManager) return 0;
    const config = fallbackManager.getState();
    const maxSize = DEFAULT_FALLBACK_CONFIG.mockDataCacheSize;
    return cacheSize / maxSize;
  }, [cacheSize, fallbackManager]);

  const averageDataAge = useMemo(() => {
    if (cache.size === 0) return 0;
    
    const now = Date.now();
    const totalAge = Array.from(cache.values()).reduce((total, entry) => {
      return total + (now - (entry.expiry - DEFAULT_FALLBACK_CONFIG.mockDataTTL));
    }, 0);
    
    return totalAge / cache.size;
  }, [cache]);

  const hitRate = useMemo(() => {
    if (stats.totalRequests === 0) return 0;
    return stats.totalHits / stats.totalRequests;
  }, [stats]);

  // Callback functions
  const getCachedData = useCallback(
    (key: string): any | null => {
      setStats(prev => ({ ...prev, totalRequests: prev.totalRequests + 1 }));
      
      const entry = cache.get(key);
      if (entry && entry.expiry > Date.now()) {
        setStats(prev => ({ ...prev, totalHits: prev.totalHits + 1 }));
        return entry.data;
      } else {
        setStats(prev => ({ ...prev, totalMisses: prev.totalMisses + 1 }));
        return null;
      }
    },
    [cache]
  );

  const setCachedData = useCallback(
    (key: string, data: any, ttl?: number): void => {
      if (fallbackManager) {
        const state = fallbackManager.getState();
        const expiry = Date.now() + (ttl || DEFAULT_FALLBACK_CONFIG.mockDataTTL);
        state.mockDataCache.set(key, { data, expiry });
      }
    },
    [fallbackManager]
  );

  const removeCachedData = useCallback(
    (key: string): boolean => {
      if (fallbackManager) {
        const state = fallbackManager.getState();
        return state.mockDataCache.delete(key);
      }
      return false;
    },
    [fallbackManager]
  );

  const clearCache = useCallback(() => {
    if (fallbackManager) {
      const state = fallbackManager.getState();
      state.mockDataCache.clear();
    }
  }, [fallbackManager]);

  return {
    cache,
    cacheSize,
    isEmpty,
    getCachedData,
    setCachedData,
    removeCachedData,
    clearCache,
    hitRate,
    totalRequests: stats.totalRequests,
    totalHits: stats.totalHits,
    totalMisses: stats.totalMisses,
    expiredEntries,
    cacheUtilization,
    averageDataAge
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useFallbackManager;