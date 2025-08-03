/**
 * MCP Integration & Optimization Hooks
 * 
 * This file provides React hooks for performance optimization,
 * dashboard integration, and debugging/monitoring capabilities.
 */

'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useMCPClient, useMCPStatus } from '../context';
import { useGA4Data, useRealTimeMetrics } from './dataHooks';
import { useCachedData } from './advancedHooks';
import { useConnectionNotifications } from './notificationHooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  cacheHitRate: number;
  operationCount: number;
  errorRate: number;
  lastUpdated: number;
}

/**
 * Hook debug information
 */
export interface HookDebugInfo {
  hookName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  dependencyChanges: number;
  errorCount: number;
  warnings: string[];
  metadata: Record<string, any>;
}

/**
 * Operation history entry
 */
export interface OperationHistoryEntry {
  id: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Dashboard integration configuration
 */
export interface DashboardIntegrationConfig {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealTime?: boolean;
  cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
  errorHandling?: 'silent' | 'notify' | 'throw';
  performanceTracking?: boolean;
}

/**
 * Widget data configuration
 */
export interface WidgetDataConfig {
  widgetId: string;
  dataSource: string;
  refreshInterval?: number;
  cacheKey?: string;
  dependencies?: string[];
  transformer?: (data: any) => any;
  validator?: (data: any) => boolean;
}

/**
 * Auto-refresh configuration
 */
export interface AutoRefreshConfig {
  interval: number;
  enabled?: boolean;
  onlyWhenVisible?: boolean;
  pauseOnError?: boolean;
  maxRetries?: number;
  backoffFactor?: number;
}

/**
 * Debounce configuration
 */
export interface DebounceConfig {
  delay: number;
  immediate?: boolean;
  maxWait?: number;
}

/**
 * Throttle configuration
 */
export interface ThrottleConfig {
  limit: number;
  trailing?: boolean;
  leading?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate memory usage (approximation)
 */
const getMemoryUsage = (): number => {
  if ('memory' in performance && (performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
  }
  return 0;
};

/**
 * Calculate render time
 */
const measureRenderTime = (start: number): number => {
  return performance.now() - start;
};

/**
 * Generate unique operation ID
 */
const generateOperationId = (): string => {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if document is visible
 */
const isDocumentVisible = (): boolean => {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
};

// ============================================================================
// PERFORMANCE OPTIMIZATION HOOKS
// ============================================================================

/**
 * Hook for debouncing values and functions
 * 
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounced(query, { delay: 300 });
 *   const debouncedSearch = useDebounced(
 *     (q: string) => performSearch(q),
 *     { delay: 500, immediate: false }
 *   );
 *   
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       debouncedSearch(debouncedQuery);
 *     }
 *   }, [debouncedQuery, debouncedSearch]);
 *   
 *   return (
 *     <input
 *       value={query}
 *       onChange={(e) => setQuery(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 * ```
 */
export const useDebounced = <T = any>(
  value: T | ((...args: any[]) => any),
  config: DebounceConfig
): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(
    typeof value === 'function' ? ((() => {}) as any) : value
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof value === 'function') {
      // For function debouncing
      const debouncedFn = (...args: any[]) => {
        const now = Date.now();
        lastCallTimeRef.current = now;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (config.immediate && debouncedValue === ((() => {}) as any)) {
          (value as Function)(...args);
          setDebouncedValue(value);
          return;
        }

        timeoutRef.current = setTimeout(() => {
          if (config.maxWait && now - lastCallTimeRef.current >= config.maxWait) {
            (value as Function)(...args);
          } else {
            (value as Function)(...args);
          }
        }, config.delay);
      };

      setDebouncedValue(debouncedFn as any);
    } else {
      // For value debouncing
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
      }, config.delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, config.delay, config.immediate, config.maxWait]);

  return debouncedValue;
};

/**
 * Hook for throttling function calls
 * 
 * @example
 * ```tsx
 * function ScrollComponent() {
 *   const [scrollPosition, setScrollPosition] = useState(0);
 *   
 *   const throttledScrollHandler = useThrottled(
 *     (event: Event) => {
 *       setScrollPosition(window.scrollY);
 *     },
 *     { limit: 100, trailing: true }
 *   );
 *   
 *   useEffect(() => {
 *     window.addEventListener('scroll', throttledScrollHandler);
 *     return () => window.removeEventListener('scroll', throttledScrollHandler);
 *   }, [throttledScrollHandler]);
 *   
 *   return <div>Scroll position: {scrollPosition}px</div>;
 * }
 * ```
 */
export const useThrottled = <T extends (...args: any[]) => any>(
  func: T,
  config: ThrottleConfig
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T>>();

  const throttledFunction = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    lastArgsRef.current = args;

    if (timeSinceLastCall >= config.limit) {
      if (config.leading !== false) {
        func(...args);
        lastCallRef.current = now;
      }
    } else {
      if (config.trailing !== false) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          func(...(lastArgsRef.current as Parameters<T>));
          lastCallRef.current = Date.now();
        }, config.limit - timeSinceLastCall);
      }
    }
  }, [func, config.limit, config.leading, config.trailing]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledFunction;
};

/**
 * Hook for memoized queries with intelligent caching
 * 
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { 
 *     data: user, 
 *     isLoading, 
 *     error, 
 *     refetch 
 *   } = useMemoizedQuery(
 *     ['user', userId],
 *     () => fetchUser(userId),
 *     {
 *       staleTime: 5 * 60 * 1000, // 5 minutes
 *       cacheTime: 10 * 60 * 1000, // 10 minutes
 *       enabled: !!userId
 *     }
 *   );
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return <div>Welcome, {user?.name}!</div>;
 * }
 * ```
 */
export const useMemoizedQuery = <T = any>(
  queryKey: (string | number)[],
  queryFn: () => Promise<T>,
  options: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    retry?: number;
    retryDelay?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const defaultOptions = {
    enabled: true,
    staleTime: 0,
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000
  };

  const finalOptions = { ...defaultOptions, ...options };
  const cache = useCachedData<T>();
  const [data, setData] = useState<T | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [fetchCount, setFetchCount] = useState(0);

  const cacheKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async (skipCache = false) => {
    if (!finalOptions.enabled) return;

    // Check cache first
    if (!skipCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setError(undefined);
        return;
      }
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const result = await queryFn();
      
      // Cache the result
      cache.set(cacheKey, result, { ttl: finalOptions.cacheTime });
      
      setData(result);
      setFetchCount(prev => prev + 1);
      retryCountRef.current = 0;

      if (finalOptions.onSuccess) {
        finalOptions.onSuccess(result);
      }
    } catch (err) {
      const fetchError = err as Error;
      
      if (retryCountRef.current < finalOptions.retry!) {
        retryCountRef.current++;
        setTimeout(() => {
          fetchData(skipCache);
        }, finalOptions.retryDelay! * retryCountRef.current);
        return;
      }

      setError(fetchError);
      if (finalOptions.onError) {
        finalOptions.onError(fetchError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, cacheKey, cache, finalOptions]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    fetchCount
  };
};

// ============================================================================
// INTEGRATION HOOKS
// ============================================================================

/**
 * Hook for dashboard integration with comprehensive state management
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   const {
 *     isReady,
 *     metrics,
 *     refreshAll,
 *     toggleAutoRefresh,
 *     performance
 *   } = useDashboardIntegration({
 *     autoRefresh: true,
 *     refreshInterval: 30000,
 *     enableRealTime: true,
 *     performanceTracking: true
 *   });
 *   
 *   if (!isReady) {
 *     return <div>Loading dashboard...</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <button onClick={refreshAll}>Refresh All</button>
 *       <button onClick={toggleAutoRefresh}>
 *         {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
 *       </button>
 *       <div>Performance: {performance.renderTime.toFixed(2)}ms</div>
 *       {metrics && <MetricsDisplay data={metrics} />}
 *     </div>
 *   );
 * }
 * ```
 */
export const useDashboardIntegration = (
  config: DashboardIntegrationConfig = {}
) => {
  const defaultConfig: DashboardIntegrationConfig = {
    autoRefresh: true,
    refreshInterval: 30000,
    enableRealTime: false,
    cacheStrategy: 'moderate',
    errorHandling: 'notify',
    performanceTracking: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { status } = useMCPStatus();
  const { notifications } = useConnectionNotifications();
  
  const [isReady, setIsReady] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(finalConfig.autoRefresh!);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [refreshCount, setRefreshCount] = useState(0);

  const performanceRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0,
    operationCount: 0,
    errorRate: 0,
    lastUpdated: Date.now()
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time metrics if enabled
  const { metrics } = useRealTimeMetrics(
    finalConfig.enableRealTime ? {
      metrics: ['sessions', 'users', 'conversions'],
      updateFrequency: 5000
    } : { metrics: [] }
  );

  // General metrics fallback
  const { data: fallbackMetrics, refetch } = useGA4Data({
    metrics: ['sessions', 'users'],
    dateRange: {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  });

  const updatePerformance = useCallback(() => {
    if (!finalConfig.performanceTracking) return;

    const now = Date.now();
    performanceRef.current = {
      ...performanceRef.current,
      memoryUsage: getMemoryUsage(),
      lastUpdated: now
    };
  }, [finalConfig.performanceTracking]);

  const refreshAll = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      setRefreshCount(prev => prev + 1);
      await refetch();
      setLastRefresh(Date.now());

      if (finalConfig.performanceTracking) {
        const renderTime = measureRenderTime(startTime);
        performanceRef.current.renderTime = renderTime;
        performanceRef.current.operationCount++;
      }
    } catch (error) {
      if (finalConfig.errorHandling === 'throw') {
        throw error;
      }
      // Silent or notify handled by error boundaries/notifications
    }
  }, [refetch, finalConfig]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && finalConfig.refreshInterval! > 0 && status === 'connected') {
      intervalRef.current = setInterval(refreshAll, finalConfig.refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, finalConfig.refreshInterval, status, refreshAll]);

  // Performance monitoring
  useEffect(() => {
    if (finalConfig.performanceTracking) {
      const interval = setInterval(updatePerformance, 5000);
      return () => clearInterval(interval);
    }
  }, [finalConfig.performanceTracking, updatePerformance]);

  // Ready state management
  useEffect(() => {
    setIsReady(status === 'connected');
  }, [status]);

  return {
    isReady,
    metrics: finalConfig.enableRealTime ? metrics : fallbackMetrics,
    autoRefresh,
    lastRefresh,
    refreshCount,
    refreshAll,
    toggleAutoRefresh,
    performance: performanceRef.current,
    connectionStatus: status,
    notifications: notifications.slice(0, 5) // Recent notifications
  };
};

/**
 * Hook for widget-specific data management
 * 
 * @example
 * ```tsx
 * function MetricsWidget() {
 *   const { 
 *     data, 
 *     isLoading, 
 *     error, 
 *     refresh,
 *     lastUpdate 
 *   } = useWidgetData({
 *     widgetId: 'metrics-overview',
 *     dataSource: 'ga4-metrics',
 *     refreshInterval: 60000,
 *     transformer: (data) => ({
 *       sessions: data.sessions,
 *       users: data.users,
 *       growth: calculateGrowth(data)
 *     })
 *   });
 *   
 *   return (
 *     <div className="widget">
 *       <h3>Metrics Overview</h3>
 *       {isLoading && <span>Loading...</span>}
 *       {error && <span>Error: {error.message}</span>}
 *       {data && (
 *         <div>
 *           <div>Sessions: {data.sessions}</div>
 *           <div>Users: {data.users}</div>
 *           <div>Growth: {data.growth}%</div>
 *         </div>
 *       )}
 *       <button onClick={refresh}>Refresh</button>
 *       <small>Last update: {new Date(lastUpdate).toLocaleTimeString()}</small>
 *     </div>
 *   );
 * }
 * ```
 */
export const useWidgetData = <T = any>(config: WidgetDataConfig) => {
  const [data, setData] = useState<T | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const cache = useCachedData<T>();
  const cacheKey = config.cacheKey || `widget-${config.widgetId}-${config.dataSource}`;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Check cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setLastUpdate(Date.now());
        setIsLoading(false);
        return;
      }

      // TODO: Replace with actual data source fetching
      // For now, simulate data fetching
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      const mockData = {
        sessions: Math.floor(Math.random() * 10000),
        users: Math.floor(Math.random() * 5000),
        conversions: Math.floor(Math.random() * 100),
        timestamp: Date.now()
      } as any;

      // Apply transformer if provided
      const transformedData = config.transformer ? config.transformer(mockData) : mockData;

      // Validate if validator provided
      if (config.validator && !config.validator(transformedData)) {
        throw new Error('Data validation failed');
      }

      // Cache the result
      cache.set(cacheKey, transformedData, { 
        ttl: config.refreshInterval ? config.refreshInterval * 0.8 : 30000 
      });

      setData(transformedData);
      setLastUpdate(Date.now());
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [config, cache, cacheKey]);

  const refresh = useCallback(() => {
    cache.invalidate(cacheKey);
    fetchData();
  }, [fetchData, cache, cacheKey]);

  // Auto-refresh setup
  useEffect(() => {
    if (config.refreshInterval && config.refreshInterval > 0) {
      fetchData(); // Initial fetch
      
      const interval = setInterval(fetchData, config.refreshInterval);
      return () => clearInterval(interval);
    } else {
      fetchData(); // One-time fetch
    }
  }, [fetchData, config.refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refresh,
    lastUpdate,
    widgetId: config.widgetId
  };
};

/**
 * Hook for auto-refresh functionality with intelligent pausing
 * 
 * @example
 * ```tsx
 * function AutoRefreshComponent() {
 *   const { 
 *     isRunning, 
 *     timeRemaining, 
 *     start, 
 *     stop, 
 *     reset 
 *   } = useAutoRefresh({
 *     interval: 30000,
 *     onlyWhenVisible: true,
 *     pauseOnError: true
 *   }, async () => {
 *     // Your refresh logic here
 *     const data = await fetchLatestData();
 *     updateUI(data);
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Auto-refresh: {isRunning ? 'Running' : 'Paused'}</div>
 *       <div>Next refresh in: {Math.ceil(timeRemaining / 1000)}s</div>
 *       <button onClick={isRunning ? stop : start}>
 *         {isRunning ? 'Pause' : 'Start'}
 *       </button>
 *       <button onClick={reset}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useAutoRefresh = (
  config: AutoRefreshConfig,
  callback: () => Promise<void> | void
) => {
  const [isRunning, setIsRunning] = useState(config.enabled !== false);
  const [timeRemaining, setTimeRemaining] = useState(config.interval);
  const [errorCount, setErrorCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const executeCallback = useCallback(async () => {
    try {
      await callback();
      setErrorCount(0); // Reset error count on success
    } catch (error) {
      setErrorCount(prev => prev + 1);
      
      if (config.pauseOnError && errorCount >= (config.maxRetries || 3)) {
        setIsPaused(true);
        setIsRunning(false);
        return;
      }

      // Exponential backoff for retries
      if (config.maxRetries && errorCount < config.maxRetries) {
        const delay = config.interval * Math.pow(config.backoffFactor || 2, errorCount);
        retryTimeoutRef.current = setTimeout(executeCallback, Math.min(delay, 60000));
      }
    }
  }, [callback, config, errorCount]);

  const start = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      setErrorCount(0);
    }
    
    setIsRunning(true);
    setTimeRemaining(config.interval);

    // Execute immediately, then set up interval
    executeCallback();

    intervalRef.current = setInterval(() => {
      // Check visibility if required
      if (config.onlyWhenVisible && !isDocumentVisible()) {
        return;
      }

      executeCallback();
      setTimeRemaining(config.interval);
    }, config.interval);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
  }, [config, executeCallback, isPaused]);

  const stop = useCallback(() => {
    setIsRunning(false);
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    stop();
    setErrorCount(0);
    setIsPaused(false);
    setTimeRemaining(config.interval);
  }, [stop, config.interval]);

  // Handle visibility change
  useEffect(() => {
    if (!config.onlyWhenVisible) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && !isPaused) {
        // Resume when page becomes visible
        start();
      } else if (document.visibilityState === 'hidden' && isRunning) {
        // Pause when page becomes hidden
        cleanup();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [config.onlyWhenVisible, isRunning, isPaused, start, cleanup]);

  // Auto-start if enabled
  useEffect(() => {
    if (config.enabled !== false && !isRunning && !isPaused) {
      start();
    }
  }, [config.enabled, isRunning, isPaused, start]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isRunning,
    timeRemaining,
    errorCount,
    isPaused,
    start,
    stop,
    reset
  };
};

// ============================================================================
// DEBUGGING & MONITORING HOOKS
// ============================================================================

/**
 * Hook for collecting performance metrics
 * 
 * @example
 * ```tsx
 * function PerformanceMonitor() {
 *   const metrics = usePerformanceMetrics({
 *     trackRenders: true,
 *     trackMemory: true,
 *     trackNetwork: true
 *   });
 *   
 *   return (
 *     <div className="performance-panel">
 *       <h3>Performance Metrics</h3>
 *       <div>Render Time: {metrics.renderTime.toFixed(2)}ms</div>
 *       <div>Memory Usage: {metrics.memoryUsage.toFixed(1)}MB</div>
 *       <div>Network Latency: {metrics.networkLatency}ms</div>
 *       <div>Cache Hit Rate: {(metrics.cacheHitRate * 100).toFixed(1)}%</div>
 *       <div>Error Rate: {(metrics.errorRate * 100).toFixed(2)}%</div>
 *     </div>
 *   );
 * }
 * ```
 */
export const usePerformanceMetrics = (
  options: {
    trackRenders?: boolean;
    trackMemory?: boolean;
    trackNetwork?: boolean;
    updateInterval?: number;
  } = {}
) => {
  const defaultOptions = {
    trackRenders: true,
    trackMemory: true,
    trackNetwork: true,
    updateInterval: 1000
  };

  const finalOptions = { ...defaultOptions, ...options };
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0,
    operationCount: 0,
    errorRate: 0,
    lastUpdated: Date.now()
  });

  const renderStartRef = useRef<number>(performance.now());
  const operationCountRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const cache = useCachedData();

  const updateMetrics = useCallback(() => {
    const newMetrics: PerformanceMetrics = { ...metrics };

    if (finalOptions.trackRenders) {
      newMetrics.renderTime = measureRenderTime(renderStartRef.current);
      renderStartRef.current = performance.now();
    }

    if (finalOptions.trackMemory) {
      newMetrics.memoryUsage = getMemoryUsage();
    }

    if (finalOptions.trackNetwork) {
      // Simulate network latency measurement
      // In real implementation, this would measure actual network calls
      newMetrics.networkLatency = Math.floor(Math.random() * 100) + 20;
    }

    // Update cache metrics if available
    if (cache.metrics) {
      newMetrics.cacheHitRate = cache.metrics.hitRate;
    }

    newMetrics.operationCount = operationCountRef.current;
    newMetrics.errorRate = operationCountRef.current > 0 
      ? errorCountRef.current / operationCountRef.current 
      : 0;
    newMetrics.lastUpdated = Date.now();

    setMetrics(newMetrics);
  }, [finalOptions, cache.metrics, metrics]);

  const recordOperation = useCallback(() => {
    operationCountRef.current++;
  }, []);

  const recordError = useCallback(() => {
    errorCountRef.current++;
  }, []);

  // Update metrics at specified interval
  useEffect(() => {
    const interval = setInterval(updateMetrics, finalOptions.updateInterval);
    return () => clearInterval(interval);
  }, [updateMetrics, finalOptions.updateInterval]);

  return {
    ...metrics,
    recordOperation,
    recordError
  };
};

/**
 * Hook for debugging React hook behavior
 * 
 * @example
 * ```tsx
 * function DebuggableComponent({ userId }: { userId: string }) {
 *   const debugInfo = useHookDebugger('DebuggableComponent', [userId]);
 *   const [user, setUser] = useState(null);
 *   
 *   // Your component logic here
 *   
 *   return (
 *     <div>
 *       {/* Your component UI */}
 *       {process.env.NODE_ENV === 'development' && (
 *         <div className="debug-panel">
 *           <h4>Debug Info</h4>
 *           <div>Renders: {debugInfo.renderCount}</div>
 *           <div>Avg Render Time: {debugInfo.averageRenderTime.toFixed(2)}ms</div>
 *           <div>Dependency Changes: {debugInfo.dependencyChanges}</div>
 *           <div>Errors: {debugInfo.errorCount}</div>
 *           {debugInfo.warnings.length > 0 && (
 *             <div>Warnings: {debugInfo.warnings.join(', ')}</div>
 *           )}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useHookDebugger = (
  hookName: string,
  dependencies: any[] = []
): HookDebugInfo => {
  const renderCountRef = useRef<number>(0);
  const renderTimesRef = useRef<number[]>([]);
  const dependencyChangesRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const warningsRef = useRef<string[]>([]);
  const lastDependenciesRef = useRef<any[]>([]);
  const renderStartTimeRef = useRef<number>(performance.now());

  const [debugInfo, setDebugInfo] = useState<HookDebugInfo>({
    hookName,
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    dependencyChanges: 0,
    errorCount: 0,
    warnings: [],
    metadata: {}
  });

  // Track render count and timing
  useEffect(() => {
    renderCountRef.current++;
    const renderTime = measureRenderTime(renderStartTimeRef.current);
    renderTimesRef.current.push(renderTime);
    
    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift();
    }

    const averageRenderTime = renderTimesRef.current.reduce((sum, time) => sum + time, 0) / renderTimesRef.current.length;

    setDebugInfo(prev => ({
      ...prev,
      renderCount: renderCountRef.current,
      lastRenderTime: renderTime,
      averageRenderTime,
      dependencyChanges: dependencyChangesRef.current,
      errorCount: errorCountRef.current,
      warnings: [...warningsRef.current]
    }));

    renderStartTimeRef.current = performance.now();
  });

  // Track dependency changes
  useEffect(() => {
    if (lastDependenciesRef.current.length > 0) {
      const hasChanged = dependencies.some((dep, index) => dep !== lastDependenciesRef.current[index]);
      if (hasChanged) {
        dependencyChangesRef.current++;
      }
    }
    lastDependenciesRef.current = [...dependencies];
  }, dependencies);

  // Performance warnings
  useEffect(() => {
    const warnings: string[] = [];
    
    if (renderCountRef.current > 100) {
      warnings.push('High render count detected');
    }
    
    if (debugInfo.averageRenderTime > 16) {
      warnings.push('Slow render time detected');
    }
    
    if (dependencyChangesRef.current > renderCountRef.current * 0.8) {
      warnings.push('Frequent dependency changes');
    }

    warningsRef.current = warnings;
  }, [debugInfo.averageRenderTime]);

  return debugInfo;
};

/**
 * Hook for tracking operation history and analytics
 * 
 * @example
 * ```tsx
 * function OperationTracker() {
 *   const { 
 *     history, 
 *     addOperation, 
 *     completeOperation, 
 *     failOperation,
 *     getStatistics,
 *     clearHistory 
 *   } = useOperationHistory({
 *     maxEntries: 1000,
 *     persistHistory: true
 *   });
 *   
 *   const performOperation = async () => {
 *     const operationId = addOperation('fetchUserData');
 *     
 *     try {
 *       const result = await fetchUserData();
 *       completeOperation(operationId, result);
 *     } catch (error) {
 *       failOperation(operationId, error);
 *     }
 *   };
 *   
 *   const stats = getStatistics();
 *   
 *   return (
 *     <div>
 *       <button onClick={performOperation}>Perform Operation</button>
 *       <div>Total Operations: {stats.total}</div>
 *       <div>Success Rate: {(stats.successRate * 100).toFixed(1)}%</div>
 *       <div>Average Duration: {stats.averageDuration.toFixed(0)}ms</div>
 *       <button onClick={clearHistory}>Clear History</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useOperationHistory = (
  options: {
    maxEntries?: number;
    persistHistory?: boolean;
    trackMetrics?: boolean;
  } = {}
) => {
  const defaultOptions = {
    maxEntries: 500,
    persistHistory: false,
    trackMetrics: true
  };

  const finalOptions = { ...defaultOptions, ...options };
  const [history, setHistory] = useState<OperationHistoryEntry[]>([]);

  const addOperation = useCallback((operation: string, metadata?: Record<string, any>): string => {
    const entry: OperationHistoryEntry = {
      id: generateOperationId(),
      operation,
      startTime: Date.now(),
      status: 'pending',
      metadata
    };

    setHistory(prev => {
      const newHistory = [entry, ...prev];
      
      // Limit history size
      if (newHistory.length > finalOptions.maxEntries!) {
        newHistory.splice(finalOptions.maxEntries!);
      }
      
      return newHistory;
    });

    return entry.id;
  }, [finalOptions.maxEntries]);

  const updateOperation = useCallback((
    id: string, 
    updates: Partial<OperationHistoryEntry>
  ) => {
    setHistory(prev => 
      prev.map(entry => 
        entry.id === id 
          ? { ...entry, ...updates, endTime: updates.endTime || Date.now() }
          : entry
      )
    );
  }, []);

  const completeOperation = useCallback((id: string, result?: any) => {
    updateOperation(id, {
      status: 'completed',
      result,
      endTime: Date.now()
    });
  }, [updateOperation]);

  const failOperation = useCallback((id: string, error: Error) => {
    updateOperation(id, {
      status: 'failed',
      error,
      endTime: Date.now()
    });
  }, [updateOperation]);

  const cancelOperation = useCallback((id: string) => {
    updateOperation(id, {
      status: 'cancelled',
      endTime: Date.now()
    });
  }, [updateOperation]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getStatistics = useCallback(() => {
    const completedOperations = history.filter(op => op.status === 'completed' || op.status === 'failed');
    const successfulOperations = history.filter(op => op.status === 'completed');
    
    const durations = completedOperations
      .filter(op => op.duration !== undefined)
      .map(op => op.duration!);
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;

    return {
      total: history.length,
      completed: completedOperations.length,
      successful: successfulOperations.length,
      failed: history.filter(op => op.status === 'failed').length,
      pending: history.filter(op => op.status === 'pending').length,
      cancelled: history.filter(op => op.status === 'cancelled').length,
      successRate: completedOperations.length > 0 
        ? successfulOperations.length / completedOperations.length 
        : 0,
      averageDuration
    };
  }, [history]);

  const getOperationsByType = useCallback((operation: string) => {
    return history.filter(entry => entry.operation === operation);
  }, [history]);

  // Calculate durations for completed operations
  useEffect(() => {
    setHistory(prev => 
      prev.map(entry => {
        if (entry.endTime && !entry.duration) {
          return {
            ...entry,
            duration: entry.endTime - entry.startTime
          };
        }
        return entry;
      })
    );
  }, [history]);

  return {
    history,
    addOperation,
    completeOperation,
    failOperation,
    cancelOperation,
    clearHistory,
    getStatistics,
    getOperationsByType
  };
};