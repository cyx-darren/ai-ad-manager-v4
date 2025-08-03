/**
 * MCP Advanced Operation Hooks
 * 
 * This file provides React hooks for advanced MCP operations including
 * batch requests, parallel operations, advanced caching, and retry mechanisms.
 */

'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useMCPClient, useMCPStatus } from '../context';
import { useErrorRecovery } from './errorHooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Batch request configuration
 */
export interface BatchRequestConfig<T = any> {
  id: string;
  operation: () => Promise<T>;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

/**
 * Batch request result
 */
export interface BatchRequestResult<T = any> {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  data?: T;
  error?: Error;
  startTime?: number;
  endTime?: number;
  duration?: number;
  retryCount: number;
}

/**
 * Batch operation state
 */
export interface BatchOperationState<T = any> {
  requests: BatchRequestResult<T>[];
  isRunning: boolean;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  progress: number; // 0-1
  startTime?: number;
  estimatedTimeRemaining?: number;
}

/**
 * Parallel operation configuration
 */
export interface ParallelOperationConfig {
  maxConcurrency?: number;
  continueOnError?: boolean;
  timeout?: number;
  retryFailedOperations?: boolean;
  batchSize?: number;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  expiresAt?: number;
  tags?: string[];
  size?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number; // bytes
  maxEntries?: number;
  defaultTTL?: number; // milliseconds
  cleanupInterval?: number; // milliseconds
  enableCompression?: boolean;
  enableMetrics?: boolean;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  evictions: number;
  cleanupRuns: number;
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter?: boolean;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  duration: number;
  onTimeout?: () => void;
  enableWarning?: boolean;
  warningThreshold?: number; // percentage of timeout duration
}

/**
 * Operation context for tracking
 */
export interface OperationContext {
  id: string;
  type: string;
  startTime: number;
  timeout?: number;
  abortController?: AbortController;
  retryCount: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique operation ID
 */
const generateOperationId = (): string => {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate operation priority score
 */
const calculatePriorityScore = (priority: 'low' | 'normal' | 'high'): number => {
  switch (priority) {
    case 'high': return 3;
    case 'normal': return 2;
    case 'low': return 1;
    default: return 2;
  }
};

/**
 * Estimate cache entry size
 */
const estimateCacheSize = (data: any): number => {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length * 2; // Rough estimate
  }
};

/**
 * Calculate cache hit rate
 */
const calculateHitRate = (hits: number, misses: number): number => {
  const total = hits + misses;
  return total > 0 ? hits / total : 0;
};

/**
 * Calculate exponential backoff with jitter
 */
const calculateRetryDelay = (
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean = true
): number => {
  const exponentialDelay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
  
  if (!jitter) {
    return exponentialDelay;
  }
  
  // Add jitter (±25% of the delay)
  const jitterRange = exponentialDelay * 0.25;
  const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
  return Math.max(0, exponentialDelay + jitterOffset);
};

// ============================================================================
// BATCH OPERATION HOOKS
// ============================================================================

/**
 * Hook for managing batch requests with intelligent scheduling
 * 
 * @example
 * ```tsx
 * function BatchDataLoader() {
 *   const { addRequest, executeAll, state, cancelAll } = useBatchRequests({
 *     maxConcurrency: 3,
 *     continueOnError: true
 *   });
 *   
 *   const loadUserData = useCallback(() => {
 *     addRequest({
 *       id: 'user-profile',
 *       operation: () => fetchUserProfile(),
 *       priority: 'high'
 *     });
 *     
 *     addRequest({
 *       id: 'user-settings',
 *       operation: () => fetchUserSettings(),
 *       priority: 'normal',
 *       dependencies: ['user-profile']
 *     });
 *     
 *     executeAll();
 *   }, [addRequest, executeAll]);
 *   
 *   return (
 *     <div>
 *       <button onClick={loadUserData}>Load User Data</button>
 *       <div>Progress: {(state.progress * 100).toFixed(1)}%</div>
 *       <div>Completed: {state.completedCount}/{state.totalCount}</div>
 *       {state.failedCount > 0 && (
 *         <div>Failed: {state.failedCount}</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useBatchRequests = <T = any>(
  config: ParallelOperationConfig = {}
) => {
  const defaultConfig: ParallelOperationConfig = {
    maxConcurrency: 3,
    continueOnError: true,
    timeout: 30000,
    retryFailedOperations: false,
    batchSize: 10
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<BatchOperationState<T>>({
    requests: [],
    isRunning: false,
    completedCount: 0,
    failedCount: 0,
    totalCount: 0,
    progress: 0
  });

  const requestsRef = useRef<Map<string, BatchRequestConfig<T>>>(new Map());
  const runningOperationsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const addRequest = useCallback((request: BatchRequestConfig<T>) => {
    requestsRef.current.set(request.id, request);
    
    setState(prev => {
      const newRequest: BatchRequestResult<T> = {
        id: request.id,
        status: 'pending',
        retryCount: 0
      };
      
      const updatedRequests = [...prev.requests.filter(r => r.id !== request.id), newRequest];
      
      return {
        ...prev,
        requests: updatedRequests,
        totalCount: updatedRequests.length
      };
    });
  }, []);

  const removeRequest = useCallback((id: string) => {
    requestsRef.current.delete(id);
    setState(prev => {
      const updatedRequests = prev.requests.filter(r => r.id !== id);
      return {
        ...prev,
        requests: updatedRequests,
        totalCount: updatedRequests.length
      };
    });
  }, []);

  const executeRequest = useCallback(async (request: BatchRequestConfig<T>): Promise<void> => {
    const startTime = Date.now();
    
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r => 
        r.id === request.id 
          ? { ...r, status: 'running', startTime }
          : r
      )
    }));

    runningOperationsRef.current.add(request.id);

    try {
      // Check dependencies
      if (request.dependencies) {
        const dependencyResults = state.requests.filter(r => 
          request.dependencies!.includes(r.id)
        );
        
        const incompleteDeps = dependencyResults.filter(r => r.status !== 'completed');
        if (incompleteDeps.length > 0) {
          throw new Error(`Dependencies not completed: ${incompleteDeps.map(d => d.id).join(', ')}`);
        }
      }

      // Execute the operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), request.timeout || finalConfig.timeout);
      });

      const result = await Promise.race([
        request.operation(),
        timeoutPromise
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(r => 
          r.id === request.id 
            ? { 
                ...r, 
                status: 'completed', 
                data: result, 
                endTime, 
                duration,
                error: undefined
              }
            : r
        ),
        completedCount: prev.completedCount + 1
      }));

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(r => 
          r.id === request.id 
            ? { 
                ...r, 
                status: 'failed', 
                error: error as Error, 
                endTime, 
                duration 
              }
            : r
        ),
        failedCount: prev.failedCount + 1
      }));

      if (!finalConfig.continueOnError) {
        throw error;
      }
    } finally {
      runningOperationsRef.current.delete(request.id);
    }
  }, [finalConfig.continueOnError, finalConfig.timeout, state.requests]);

  const executeAll = useCallback(async () => {
    if (state.isRunning) return;

    setState(prev => ({ ...prev, isRunning: true, startTime: Date.now() }));
    abortControllerRef.current = new AbortController();

    try {
      const requests = Array.from(requestsRef.current.values());
      
      // Sort by priority and dependencies
      const sortedRequests = requests.sort((a, b) => {
        const priorityDiff = calculatePriorityScore(b.priority || 'normal') - 
                           calculatePriorityScore(a.priority || 'normal');
        if (priorityDiff !== 0) return priorityDiff;
        
        // Prefer requests with fewer dependencies
        const aDeps = a.dependencies?.length || 0;
        const bDeps = b.dependencies?.length || 0;
        return aDeps - bDeps;
      });

      // Execute with concurrency control
      const semaphore = Array(finalConfig.maxConcurrency!).fill(null);
      let requestIndex = 0;

      const executeNext = async (): Promise<void> => {
        while (requestIndex < sortedRequests.length) {
          const request = sortedRequests[requestIndex++];
          
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          try {
            await executeRequest(request);
          } catch (error) {
            if (!finalConfig.continueOnError) {
              throw error;
            }
          }
        }
      };

      await Promise.all(semaphore.map(() => executeNext()));

    } finally {
      setState(prev => ({ ...prev, isRunning: false }));
      abortControllerRef.current = null;
    }
  }, [state.isRunning, executeRequest, finalConfig.maxConcurrency, finalConfig.continueOnError]);

  const cancelAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState(prev => ({
      ...prev,
      isRunning: false,
      requests: prev.requests.map(r => 
        r.status === 'pending' || r.status === 'running'
          ? { ...r, status: 'cancelled' }
          : r
      )
    }));
  }, []);

  const reset = useCallback(() => {
    cancelAll();
    requestsRef.current.clear();
    setState({
      requests: [],
      isRunning: false,
      completedCount: 0,
      failedCount: 0,
      totalCount: 0,
      progress: 0
    });
  }, [cancelAll]);

  // Update progress
  useEffect(() => {
    const { totalCount, completedCount, failedCount } = state;
    const progress = totalCount > 0 ? (completedCount + failedCount) / totalCount : 0;
    
    if (progress !== state.progress) {
      setState(prev => ({ ...prev, progress }));
    }
  }, [state.completedCount, state.failedCount, state.totalCount, state.progress]);

  return {
    state,
    addRequest,
    removeRequest,
    executeAll,
    cancelAll,
    reset,
    isRunning: state.isRunning,
    progress: state.progress
  };
};

/**
 * Hook for managing parallel operations with load balancing
 * 
 * @example
 * ```tsx
 * function ParallelDataProcessor() {
 *   const { executeParallel, state } = useParallelOperations({
 *     maxConcurrency: 5,
 *     batchSize: 20
 *   });
 *   
 *   const processData = useCallback(async () => {
 *     const operations = dataItems.map(item => ({
 *       id: item.id,
 *       operation: () => processItem(item)
 *     }));
 *     
 *     const results = await executeParallel(operations);
 *     console.log('All processing complete:', results);
 *   }, [executeParallel, dataItems]);
 *   
 *   return (
 *     <div>
 *       <button onClick={processData}>Process All Data</button>
 *       {state.isRunning && (
 *         <div>
 *           Processing: {state.progress.toFixed(1)}%
 *           ({state.completedCount}/{state.totalCount})
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useParallelOperations = <T = any>(
  config: ParallelOperationConfig = {}
) => {
  const batchHook = useBatchRequests<T>(config);
  
  const executeParallel = useCallback(async (
    operations: Array<{ id: string; operation: () => Promise<T>; priority?: 'low' | 'normal' | 'high' }>
  ): Promise<BatchRequestResult<T>[]> => {
    // Reset any existing state
    batchHook.reset();
    
    // Add all operations
    operations.forEach(op => {
      batchHook.addRequest({
        id: op.id,
        operation: op.operation,
        priority: op.priority || 'normal'
      });
    });
    
    // Execute all operations
    await batchHook.executeAll();
    
    return batchHook.state.requests;
  }, [batchHook]);

  return {
    ...batchHook,
    executeParallel
  };
};

// ============================================================================
// ADVANCED CACHING HOOKS
// ============================================================================

/**
 * Hook for advanced caching with intelligent cache management
 * 
 * @example
 * ```tsx
 * function CachedDataComponent() {
 *   const { 
 *     get, 
 *     set, 
 *     invalidate, 
 *     clear, 
 *     metrics 
 *   } = useCachedData({
 *     maxEntries: 100,
 *     defaultTTL: 5 * 60 * 1000, // 5 minutes
 *     enableMetrics: true
 *   });
 *   
 *   const fetchData = useCallback(async (key: string) => {
 *     // Check cache first
 *     const cached = get(key);
 *     if (cached) {
 *       return cached;
 *     }
 *     
 *     // Fetch fresh data
 *     const data = await apiCall(key);
 *     
 *     // Cache the result
 *     set(key, data, { ttl: 10 * 60 * 1000 }); // 10 minutes
 *     
 *     return data;
 *   }, [get, set]);
 *   
 *   return (
 *     <div>
 *       <div>Cache Hit Rate: {(metrics.hitRate * 100).toFixed(1)}%</div>
 *       <div>Cache Size: {metrics.entryCount} entries</div>
 *       <button onClick={() => clear()}>Clear Cache</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useCachedData = <T = any>(config: CacheConfig = {}) => {
  const defaultConfig: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 1000,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    cleanupInterval: 60 * 1000, // 1 minute
    enableCompression: false,
    enableMetrics: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [metrics, setMetrics] = useState<CacheMetrics>({
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    entryCount: 0,
    evictions: 0,
    cleanupRuns: 0
  });
  
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateMetrics = useCallback(() => {
    if (!finalConfig.enableMetrics) return;

    const cache = cacheRef.current;
    let totalSize = 0;
    
    const entries = Array.from(cache.values());
    for (const entry of entries) {
      totalSize += entry.size || 0;
    }

    setMetrics(prev => ({
      ...prev,
      hitRate: calculateHitRate(prev.hits, prev.misses),
      totalSize,
      entryCount: cache.size
    }));
  }, [finalConfig.enableMetrics]);

  const cleanup = useCallback(() => {
    const cache = cacheRef.current;
    const now = Date.now();
    let evictionCount = 0;

    // Remove expired entries
    const cacheEntries = Array.from(cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        cache.delete(key);
        evictionCount++;
      }
    }

    // Enforce size limits
    if (cache.size > finalConfig.maxEntries!) {
      // Remove least recently accessed entries
      const sortedEntries = Array.from(cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const excess = cache.size - finalConfig.maxEntries!;
      for (let i = 0; i < excess; i++) {
        const [key] = sortedEntries[i];
        cache.delete(key);
        evictionCount++;
      }
    }

    if (evictionCount > 0) {
      setMetrics(prev => ({
        ...prev,
        evictions: prev.evictions + evictionCount,
        cleanupRuns: prev.cleanupRuns + 1
      }));
      updateMetrics();
    }
  }, [finalConfig.maxEntries, updateMetrics]);

  const get = useCallback((key: string): T | undefined => {
    const cache = cacheRef.current;
    const entry = cache.get(key);

    if (!entry) {
      if (finalConfig.enableMetrics) {
        setMetrics(prev => ({ ...prev, misses: prev.misses + 1 }));
      }
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      cache.delete(key);
      if (finalConfig.enableMetrics) {
        setMetrics(prev => ({ ...prev, misses: prev.misses + 1 }));
      }
      return undefined;
    }

    // Update access metadata
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    if (finalConfig.enableMetrics) {
      setMetrics(prev => ({ ...prev, hits: prev.hits + 1 }));
    }

    return entry.data;
  }, [finalConfig.enableMetrics]);

  const set = useCallback((
    key: string, 
    data: T, 
    options: { ttl?: number; tags?: string[] } = {}
  ) => {
    const cache = cacheRef.current;
    const now = Date.now();
    const ttl = options.ttl || finalConfig.defaultTTL!;
    const size = estimateCacheSize(data);

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      expiresAt: ttl > 0 ? now + ttl : undefined,
      tags: options.tags,
      size
    };

    cache.set(key, entry);
    updateMetrics();
  }, [finalConfig.defaultTTL, updateMetrics]);

  const invalidate = useCallback((keyOrPattern: string | RegExp | string[]) => {
    const cache = cacheRef.current;
    let removedCount = 0;

    if (typeof keyOrPattern === 'string') {
      if (cache.delete(keyOrPattern)) {
        removedCount = 1;
      }
    } else if (keyOrPattern instanceof RegExp) {
      const cacheKeys = Array.from(cache.keys());
      for (const key of cacheKeys) {
        if (keyOrPattern.test(key)) {
          cache.delete(key);
          removedCount++;
        }
      }
    } else if (Array.isArray(keyOrPattern)) {
      for (const key of keyOrPattern) {
        if (cache.delete(key)) {
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      updateMetrics();
    }

    return removedCount;
  }, [updateMetrics]);

  const invalidateByTags = useCallback((tags: string[]) => {
    const cache = cacheRef.current;
    let removedCount = 0;

    const cacheEntries = Array.from(cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (entry.tags && tags.some(tag => entry.tags!.includes(tag))) {
        cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      updateMetrics();
    }

    return removedCount;
  }, [updateMetrics]);

  const clear = useCallback(() => {
    cacheRef.current.clear();
    setMetrics({
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      evictions: 0,
      cleanupRuns: 0
    });
  }, []);

  // Setup cleanup interval
  useEffect(() => {
    if (finalConfig.cleanupInterval! > 0) {
      cleanupIntervalRef.current = setInterval(cleanup, finalConfig.cleanupInterval);
    }

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [cleanup, finalConfig.cleanupInterval]);

  return {
    get,
    set,
    invalidate,
    invalidateByTags,
    clear,
    cleanup,
    metrics,
    size: metrics.entryCount
  };
};

/**
 * Hook for cache invalidation with intelligent strategies
 * 
 * @example
 * ```tsx
 * function CacheManager() {
 *   const { 
 *     invalidatePattern, 
 *     invalidateStale, 
 *     scheduleInvalidation 
 *   } = useInvalidateCache();
 *   
 *   const handleUserUpdate = useCallback((userId: string) => {
 *     // Invalidate all user-related cache entries
 *     invalidatePattern(`user:${userId}:*`);
 *     
 *     // Schedule invalidation of related data
 *     scheduleInvalidation(['user-list', 'user-stats'], 5000);
 *   }, [invalidatePattern, scheduleInvalidation]);
 *   
 *   return (
 *     <div>
 *       <button onClick={() => invalidateStale(60000)}>
 *         Remove Stale (>1min)
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useInvalidateCache = () => {
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const invalidatePattern = useCallback((pattern: string, cacheHook?: ReturnType<typeof useCachedData>) => {
    if (!cacheHook) return 0;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return cacheHook.invalidate(regex);
  }, []);

  const invalidateStale = useCallback((
    maxAge: number, 
    cacheHook?: ReturnType<typeof useCachedData>
  ) => {
    if (!cacheHook) return 0;

    const now = Date.now();
    const staleKeys: string[] = [];
    
    // This would need access to cache internals, simplified for demo
    // In real implementation, would need to expose cache inspection methods
    
    return cacheHook.invalidate(staleKeys);
  }, []);

  const scheduleInvalidation = useCallback((
    keys: string[], 
    delay: number,
    cacheHook?: ReturnType<typeof useCachedData>
  ) => {
    const scheduleId = `schedule-${Date.now()}-${Math.random()}`;
    
    const timeout = setTimeout(() => {
      if (cacheHook) {
        cacheHook.invalidate(keys);
      }
      timeoutsRef.current.delete(scheduleId);
    }, delay);

    timeoutsRef.current.set(scheduleId, timeout);

    return () => {
      const existingTimeout = timeoutsRef.current.get(scheduleId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(scheduleId);
      }
    };
  }, []);

  const cancelAllScheduled = useCallback(() => {
    const timeouts = Array.from(timeoutsRef.current.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    timeoutsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cancelAllScheduled;
  }, [cancelAllScheduled]);

  return {
    invalidatePattern,
    invalidateStale,
    scheduleInvalidation,
    cancelAllScheduled
  };
};

/**
 * Hook for stale-while-revalidate caching strategy
 * 
 * @example
 * ```tsx
 * function StaleWhileRevalidateExample() {
 *   const { data, isLoading, isValidating, mutate } = useStaleWhileRevalidate(
 *     'user-profile',
 *     () => fetchUserProfile(),
 *     {
 *       revalidateOnFocus: true,
 *       revalidateOnReconnect: true,
 *       refreshInterval: 30000 // 30 seconds
 *     }
 *   );
 *   
 *   return (
 *     <div>
 *       {isLoading ? (
 *         <div>Loading...</div>
 *       ) : (
 *         <div>
 *           <pre>{JSON.stringify(data, null, 2)}</pre>
 *           {isValidating && <div>Updating...</div>}
 *           <button onClick={() => mutate()}>Refresh</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useStaleWhileRevalidate = <T = any>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    refreshInterval?: number;
    dedupingInterval?: number;
    onError?: (error: Error) => void;
    onSuccess?: (data: T) => void;
  } = {}
) => {
  const cache = useCachedData<T>();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [data, setData] = useState<T | undefined>(cache.get(key));
  const [error, setError] = useState<Error | undefined>();
  
  const lastFetchRef = useRef<number>(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dedupeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performFetch = useCallback(async (isBackground = false) => {
    const now = Date.now();
    const dedupingInterval = options.dedupingInterval || 2000;

    // Prevent duplicate requests within deduping interval
    if (now - lastFetchRef.current < dedupingInterval) {
      return;
    }

    lastFetchRef.current = now;
    
    if (!isBackground && !data) {
      setIsLoading(true);
    } else if (isBackground) {
      setIsValidating(true);
    }

    try {
      const result = await fetcher();
      
      // Update cache
      cache.set(key, result);
      setData(result);
      setError(undefined);

      if (options.onSuccess) {
        options.onSuccess(result);
      }
    } catch (err) {
      const fetchError = err as Error;
      setError(fetchError);
      
      if (options.onError) {
        options.onError(fetchError);
      }
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [key, fetcher, cache, data, options]);

  const mutate = useCallback(async (newData?: T) => {
    if (newData !== undefined) {
      cache.set(key, newData);
      setData(newData);
    } else {
      await performFetch(false);
    }
  }, [key, cache, performFetch]);

  // Initial fetch
  useEffect(() => {
    const cachedData = cache.get(key);
    if (cachedData) {
      setData(cachedData);
      // Revalidate in background
      performFetch(true);
    } else {
      performFetch(false);
    }
  }, [key, cache, performFetch]);

  // Setup refresh interval
  useEffect(() => {
    if (options.refreshInterval && options.refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        performFetch(true);
      }, options.refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [performFetch, options.refreshInterval]);

  // Handle focus revalidation
  useEffect(() => {
    if (!options.revalidateOnFocus) return;

    const handleFocus = () => {
      performFetch(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [performFetch, options.revalidateOnFocus]);

  // Handle reconnect revalidation
  useEffect(() => {
    if (!options.revalidateOnReconnect) return;

    const handleOnline = () => {
      performFetch(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [performFetch, options.revalidateOnReconnect]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate
  };
};

// ============================================================================
// RETRY AND TIMEOUT HOOKS
// ============================================================================

/**
 * Hook for retryable operations with advanced configuration
 * 
 * @example
 * ```tsx
 * function RetryableOperation() {
 *   const { execute, isRetrying, attempt, lastError } = useRetryableOperation(
 *     async () => {
 *       const response = await fetch('/api/unreliable-endpoint');
 *       if (!response.ok) throw new Error('API Error');
 *       return response.json();
 *     },
 *     {
 *       maxAttempts: 5,
 *       baseDelay: 1000,
 *       backoffFactor: 2,
 *       jitter: true,
 *       retryCondition: (error, attempt) => {
 *         // Only retry on network errors or 5xx responses
 *         return error.message.includes('network') || 
 *                error.message.includes('5') ||
 *                attempt < 3;
 *       }
 *     }
 *   );
 *   
 *   return (
 *     <div>
 *       <button onClick={execute} disabled={isRetrying}>
 *         {isRetrying ? `Retrying... (${attempt}/${5})` : 'Execute'}
 *       </button>
 *       {lastError && <div>Error: {lastError.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export const useRetryableOperation = <T = any>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
) => {
  const defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    retryCondition: () => true
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lastError, setLastError] = useState<Error | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (): Promise<T> => {
    setIsRetrying(true);
    setAttempt(0);
    setLastError(undefined);
    
    abortControllerRef.current = new AbortController();

    let currentAttempt = 0;
    let lastAttemptError: Error | undefined;

    while (currentAttempt < finalConfig.maxAttempts) {
      currentAttempt++;
      setAttempt(currentAttempt);

      try {
        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Operation aborted');
        }

        const result = await operation();
        setIsRetrying(false);
        return result;

      } catch (error) {
        lastAttemptError = error as Error;
        setLastError(lastAttemptError);

        if (finalConfig.onRetry) {
          finalConfig.onRetry(lastAttemptError, currentAttempt);
        }

        // Check if we should retry
        const shouldRetry = currentAttempt < finalConfig.maxAttempts &&
                           finalConfig.retryCondition!(lastAttemptError, currentAttempt);

        if (!shouldRetry) {
          break;
        }

        // Calculate delay for next attempt
        const delay = calculateRetryDelay(
          currentAttempt,
          finalConfig.baseDelay,
          finalConfig.maxDelay,
          finalConfig.backoffFactor,
          finalConfig.jitter
        );

        // Wait before next attempt
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          
          abortControllerRef.current!.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Operation aborted'));
          });
        });
      }
    }

    setIsRetrying(false);
    throw lastAttemptError || new Error('All retry attempts failed');
  }, [operation, finalConfig]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRetrying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    execute,
    abort,
    isRetrying,
    attempt,
    lastError,
    maxAttempts: finalConfig.maxAttempts
  };
};

/**
 * Hook for timeout handling with warnings and cancellation
 * 
 * @example
 * ```tsx
 * function TimeoutExample() {
 *   const { 
 *     executeWithTimeout, 
 *     isRunning, 
 *     timeRemaining, 
 *     cancel 
 *   } = useTimeoutHandler({
 *     duration: 10000, // 10 seconds
 *     enableWarning: true,
 *     warningThreshold: 0.8, // 80% of timeout
 *     onTimeout: () => console.log('Operation timed out'),
 *     onWarning: (remaining) => console.log(`Warning: ${remaining}ms remaining`)
 *   });
 *   
 *   const longOperation = useCallback(async () => {
 *     return executeWithTimeout(async () => {
 *       // Simulate long-running operation
 *       await new Promise(resolve => setTimeout(resolve, 8000));
 *       return 'Success!';
 *     });
 *   }, [executeWithTimeout]);
 *   
 *   return (
 *     <div>
 *       <button onClick={longOperation} disabled={isRunning}>
 *         Start Long Operation
 *       </button>
 *       {isRunning && (
 *         <div>
 *           <div>Time remaining: {Math.ceil(timeRemaining / 1000)}s</div>
 *           <button onClick={cancel}>Cancel</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useTimeoutHandler = (config: Partial<TimeoutConfig> & { onWarning?: (remaining: number) => void } = {}) => {
  const defaultConfig = {
    duration: 30000, // 30 seconds
    enableWarning: false,
    warningThreshold: 0.8 // 80%
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(finalConfig.duration);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const warningTriggeredRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setTimeRemaining(finalConfig.duration);
    warningTriggeredRef.current = false;
  }, [finalConfig.duration]);

  const executeWithTimeout = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    cleanup();
    
    setIsRunning(true);
    startTimeRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    
    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        if (finalConfig.onTimeout) {
          finalConfig.onTimeout();
        }
        reject(new Error(`Operation timed out after ${finalConfig.duration}ms`));
      }, finalConfig.duration);
    });

    // Set up time remaining updates
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, finalConfig.duration - elapsed);
      
      setTimeRemaining(remaining);

      // Check for warning threshold
      if (finalConfig.enableWarning && !warningTriggeredRef.current) {
        const warningPoint = finalConfig.duration * (1 - finalConfig.warningThreshold!);
        if (elapsed >= warningPoint) {
          warningTriggeredRef.current = true;
          if (config.onWarning) {
            config.onWarning(remaining);
          }
        }
      }

      if (remaining <= 0) {
        cleanup();
      }
    }, 100); // Update every 100ms

    try {
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      cleanup();
      return result;
    } catch (error) {
      cleanup();
      throw error;
    }
  }, [finalConfig, config.onWarning, cleanup]);

  const cancel = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    executeWithTimeout,
    cancel,
    isRunning,
    timeRemaining,
    progress: isRunning ? 1 - (timeRemaining / finalConfig.duration) : 0
  };
};