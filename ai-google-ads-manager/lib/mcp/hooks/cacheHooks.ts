/**
 * Cache React Hooks (Phase 4)
 * 
 * This file provides React hooks for data caching and persistence:
 * - useCache: Main hook for cache operations
 * - useCacheManager: Hook for cache manager instance
 * - useCachedData: Hook for cached data with automatic fetching
 * - useCacheStats: Hook for cache statistics and monitoring
 * - useOfflineCache: Hook for offline-specific caching
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  CacheManager, 
  CacheConfig, 
  CacheStats, 
  CacheOperationResult,
  getCacheManager,
  createCacheKey,
  createCacheTags,
  calculateCachePriority,
  type CacheEntry,
  type CacheEntryMetadata
} from '../utils/cacheManager';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Cache hook configuration
 */
export interface UseCacheConfig {
  ttl?: number;
  tags?: string[];
  priority?: number;
  persist?: boolean;
  compress?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  background?: boolean;
}

/**
 * Cached data hook result
 */
export interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  metadata: CacheEntryMetadata | null;
  refresh: () => Promise<void>;
  invalidate: () => Promise<void>;
  updateCache: (newData: T) => Promise<void>;
}

/**
 * Cache stats hook result
 */
export interface UseCacheStatsResult {
  stats: CacheStats;
  refresh: () => void;
  clearStats: () => void;
  isLoading: boolean;
}

/**
 * Offline cache configuration
 */
export interface UseOfflineCacheConfig extends UseCacheConfig {
  offlineStrategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only';
  maxAge?: number;
  staleWhileRevalidate?: boolean;
  enableSync?: boolean;
}

/**
 * Cache manager hook result
 */
export interface UseCacheManagerResult {
  manager: CacheManager;
  isInitialized: boolean;
  error: string | null;
  reinitialize: (config?: Partial<CacheConfig>) => void;
}

/**
 * Offline cache hook result
 */
export interface UseOfflineCacheResult<T> extends UseCachedDataResult<T> {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  queuedChanges: number;
  forceFetch: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
}

// ============================================================================
// MAIN CACHE HOOK
// ============================================================================

/**
 * Main cache hook for basic cache operations
 */
export const useCache = () => {
  const manager = useCacheManager().manager;

  const get = useCallback(async <T>(key: string): Promise<CacheOperationResult<T>> => {
    return await manager.get<T>(key);
  }, [manager]);

  const set = useCallback(async <T>(
    key: string, 
    data: T, 
    config: UseCacheConfig = {}
  ): Promise<CacheOperationResult<T>> => {
    return await manager.set(key, data, config);
  }, [manager]);

  const remove = useCallback(async (key: string): Promise<boolean> => {
    return await manager.delete(key);
  }, [manager]);

  const clear = useCallback(async (): Promise<boolean> => {
    return await manager.clear();
  }, [manager]);

  const invalidateByTags = useCallback(async (tags: string[]): Promise<number> => {
    return await manager.invalidateByTags(tags);
  }, [manager]);

  return {
    get,
    set,
    remove,
    clear,
    invalidateByTags,
    manager
  };
};

// ============================================================================
// CACHE MANAGER HOOK
// ============================================================================

/**
 * Hook for cache manager instance and initialization
 */
export const useCacheManager = (config?: Partial<CacheConfig>): UseCacheManagerResult => {
  const [manager] = useState(() => getCacheManager(config));
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reinitialize = useCallback((newConfig?: Partial<CacheConfig>) => {
    try {
      manager.destroy();
      const newManager = getCacheManager(newConfig);
      setIsInitialized(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
    }
  }, [manager]);

  useEffect(() => {
    const handleInitialized = () => {
      setIsInitialized(true);
      setError(null);
    };

    const handleError = (data: { error: Error }) => {
      setError(data.error.message);
    };

    manager.on('initialized', handleInitialized);
    manager.on('error', handleError);

    return () => {
      manager.off('initialized', handleInitialized);
      manager.off('error', handleError);
    };
  }, [manager]);

  return {
    manager,
    isInitialized,
    error,
    reinitialize
  };
};

// ============================================================================
// CACHED DATA HOOK
// ============================================================================

/**
 * Hook for cached data with automatic fetching and management
 */
export const useCachedData = <T>(
  key: string | (() => string),
  fetcher: () => Promise<T>,
  config: UseCacheConfig = {}
): UseCachedDataResult<T> => {
  const cache = useCache();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [metadata, setMetadata] = useState<CacheEntryMetadata | null>(null);
  
  const refreshTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Generate cache key
  const cacheKey = useMemo(() => {
    return typeof key === 'function' ? key() : key;
  }, [key]);

  // Fetch data from cache or network
  const fetchData = useCallback(async (fromRefresh: boolean = false) => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // Try cache first (unless it's a refresh)
      if (!fromRefresh) {
        const cachedResult = await cache.get<T>(cacheKey);
        if (cachedResult.success && cachedResult.data !== undefined) {
          setData(cachedResult.data);
          setFromCache(true);
          setMetadata(cachedResult.metadata || null);
          setLoading(false);
          return;
        }
      }

      // Fetch from network
      const freshData = await fetcher();
      
      if (!mountedRef.current) return;

      // Cache the fresh data
      const tags = createCacheTags(freshData, config.tags);
      const priority = calculateCachePriority(freshData, cacheKey);
      
      await cache.set(cacheKey, freshData, {
        ttl: config.ttl,
        tags,
        priority: config.priority ?? priority,
        persist: config.persist,
        compress: config.compress
      });

      setData(freshData);
      setFromCache(false);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      
      // Try to use stale cache data on error
      const cachedResult = await cache.get<T>(cacheKey);
      if (cachedResult.success && cachedResult.data !== undefined) {
        setData(cachedResult.data);
        setFromCache(true);
        setMetadata(cachedResult.metadata || null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [cache, cacheKey, fetcher, config]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Invalidate function
  const invalidate = useCallback(async () => {
    await cache.remove(cacheKey);
    if (config.tags && config.tags.length > 0) {
      await cache.invalidateByTags(config.tags);
    }
  }, [cache, cacheKey, config.tags]);

  // Update cache function
  const updateCache = useCallback(async (newData: T) => {
    const tags = createCacheTags(newData, config.tags);
    const priority = calculateCachePriority(newData, cacheKey);
    
    await cache.set(cacheKey, newData, {
      ttl: config.ttl,
      tags,
      priority: config.priority ?? priority,
      persist: config.persist,
      compress: config.compress
    });
    
    setData(newData);
    setFromCache(false);
    setError(null);
  }, [cache, cacheKey, config]);

  // Set up auto-refresh
  useEffect(() => {
    if (config.autoRefresh && config.refreshInterval && config.refreshInterval > 0) {
      refreshTimeoutRef.current = window.setInterval(() => {
        if (config.background) {
          fetchData(true);
        } else if (document.visibilityState === 'visible') {
          fetchData(true);
        }
      }, config.refreshInterval);

      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [config.autoRefresh, config.refreshInterval, config.background, fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    fromCache,
    metadata,
    refresh,
    invalidate,
    updateCache
  };
};

// ============================================================================
// CACHE STATS HOOK
// ============================================================================

/**
 * Hook for cache statistics and monitoring
 */
export const useCacheStats = (): UseCacheStatsResult => {
  const { manager } = useCacheManager();
  const [stats, setStats] = useState<CacheStats>(manager.getStats());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    try {
      const newStats = manager.getStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to refresh cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  const clearStats = useCallback(() => {
    // Note: This would reset internal counters if the cache manager supported it
    refresh();
  }, [refresh]);

  // Auto-refresh stats periodically
  useEffect(() => {
    const interval = setInterval(refresh, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    stats,
    refresh,
    clearStats,
    isLoading
  };
};

// ============================================================================
// OFFLINE CACHE HOOK
// ============================================================================

/**
 * Hook for offline-specific caching with network strategies
 */
export const useOfflineCache = <T>(
  key: string | (() => string),
  fetcher: () => Promise<T>,
  config: UseOfflineCacheConfig = {}
): UseOfflineCacheResult<T> => {
  const baseResult = useCachedData(key, fetcher, config);
  const cache = useCache();
  
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [queuedChanges, setQueuedChanges] = useState(0);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(true);

  const cacheKey = useMemo(() => {
    return typeof key === 'function' ? key() : key;
  }, [key]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Force fetch (bypass cache)
  const forceFetch = useCallback(async () => {
    if (!isOnline && config.offlineStrategy !== 'network-only') {
      throw new Error('Cannot force fetch while offline');
    }

    try {
      setSyncStatus('syncing');
      const freshData = await fetcher();
      
      // Update cache with fresh data
      await baseResult.updateCache(freshData);
      
      setSyncStatus('success');
      
      // Clear any queued changes for this key
      setQueuedChanges(0);
    } catch (error) {
      setSyncStatus('error');
      throw error;
    }
  }, [isOnline, config.offlineStrategy, fetcher, baseResult]);

  // Enhanced fetch with offline strategy
  const fetchWithStrategy = useCallback(async (fromRefresh: boolean = false) => {
    const strategy = config.offlineStrategy || 'cache-first';

    switch (strategy) {
      case 'cache-only':
        // Only use cache, never fetch from network
        const cachedResult = await cache.get<T>(cacheKey);
        if (cachedResult.success) {
          return cachedResult.data;
        }
        throw new Error('Data not available in cache');

      case 'network-only':
        // Always fetch from network, never use cache
        if (!isOnline) {
          throw new Error('Network unavailable and cache disabled');
        }
        return await fetcher();

      case 'network-first':
        // Try network first, fallback to cache
        if (isOnline) {
          try {
            const freshData = await fetcher();
            await cache.set(cacheKey, freshData, config);
            return freshData;
          } catch (error) {
            // Network failed, try cache
            const cachedResult = await cache.get<T>(cacheKey);
            if (cachedResult.success) {
              return cachedResult.data;
            }
            throw error;
          }
        } else {
          // Offline, use cache only
          const cachedResult = await cache.get<T>(cacheKey);
          if (cachedResult.success) {
            return cachedResult.data;
          }
          throw new Error('Data not available offline');
        }

      case 'cache-first':
      default:
        // Try cache first, fallback to network
        if (!fromRefresh) {
          const cachedResult = await cache.get<T>(cacheKey);
          if (cachedResult.success) {
            // If stale-while-revalidate is enabled and we're online, fetch in background
            if (config.staleWhileRevalidate && isOnline) {
              fetcher().then(freshData => {
                cache.set(cacheKey, freshData, config);
              }).catch(() => {
                // Ignore background fetch errors
              });
            }
            return cachedResult.data;
          }
        }

        // Cache miss or refresh requested
        if (isOnline) {
          const freshData = await fetcher();
          await cache.set(cacheKey, freshData, config);
          return freshData;
        } else {
          throw new Error('Data not available offline');
        }
    }
  }, [cache, cacheKey, config, fetcher, isOnline]);

  // Enable offline mode
  const enableOfflineMode = useCallback(() => {
    setOfflineModeEnabled(true);
  }, []);

  // Disable offline mode
  const disableOfflineMode = useCallback(() => {
    setOfflineModeEnabled(false);
  }, []);

  // Enhanced update cache with offline queue
  const updateCacheWithQueue = useCallback(async (newData: T) => {
    await baseResult.updateCache(newData);
    
    if (config.enableSync && !isOnline) {
      // Queue change for later sync
      cache.manager.queueSync('update', cacheKey, newData);
      setQueuedChanges(prev => prev + 1);
    }
  }, [baseResult, cache.manager, cacheKey, config.enableSync, isOnline]);

  // Process sync queue when coming online
  useEffect(() => {
    if (isOnline && config.enableSync && queuedChanges > 0) {
      setSyncStatus('syncing');
      
      cache.manager.processSyncQueue()
        .then(result => {
          if (result.processed > 0) {
            setSyncStatus('success');
            setQueuedChanges(0);
          } else if (result.failed > 0) {
            setSyncStatus('error');
          } else {
            setSyncStatus('idle');
          }
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }
  }, [isOnline, config.enableSync, queuedChanges, cache.manager]);

  return {
    ...baseResult,
    isOnline: isOnline && offlineModeEnabled,
    syncStatus,
    queuedChanges,
    forceFetch,
    enableOfflineMode,
    disableOfflineMode,
    updateCache: updateCacheWithQueue
  };
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for creating cache keys from dependencies
 */
export const useCacheKey = (prefix: string, dependencies: any[]): string => {
  return useMemo(() => {
    return createCacheKey(prefix, ...dependencies);
  }, [prefix, ...dependencies]);
};

/**
 * Hook for cache invalidation on dependency changes
 */
export const useCacheInvalidation = (tags: string[], dependencies: any[]): void => {
  const cache = useCache();
  
  useEffect(() => {
    cache.invalidateByTags(tags);
  }, dependencies);
};

/**
 * Hook for preloading cache data
 */
export const useCachePreload = <T>(
  keys: string[],
  fetcher: (key: string) => Promise<T>,
  config: UseCacheConfig = {}
): { preload: (key: string) => Promise<void>; preloadAll: () => Promise<void> } => {
  const cache = useCache();

  const preload = useCallback(async (key: string) => {
    const cached = await cache.get(key);
    if (!cached.success) {
      try {
        const data = await fetcher(key);
        await cache.set(key, data, config);
      } catch (error) {
        console.warn(`Failed to preload cache for key: ${key}`, error);
      }
    }
  }, [cache, fetcher, config]);

  const preloadAll = useCallback(async () => {
    await Promise.allSettled(keys.map(key => preload(key)));
  }, [keys, preload]);

  return { preload, preloadAll };
};

/**
 * Hook for cache warming strategies
 */
export const useCacheWarming = (
  warmingStrategies: Array<{
    key: string;
    fetcher: () => Promise<any>;
    priority: number;
    delay?: number;
  }>
): { startWarming: () => void; stopWarming: () => void; warmingStatus: string } => {
  const cache = useCache();
  const [warmingStatus, setWarmingStatus] = useState<string>('idle');
  const warmingRef = useRef<boolean>(false);

  const startWarming = useCallback(async () => {
    if (warmingRef.current) return;
    
    warmingRef.current = true;
    setWarmingStatus('warming');

    try {
      // Sort by priority (higher priority first)
      const sortedStrategies = [...warmingStrategies].sort((a, b) => b.priority - a.priority);

      for (const strategy of sortedStrategies) {
        if (!warmingRef.current) break;

        // Add delay if specified
        if (strategy.delay) {
          await new Promise(resolve => setTimeout(resolve, strategy.delay));
        }

        try {
          const cached = await cache.get(strategy.key);
          if (!cached.success) {
            const data = await strategy.fetcher();
            await cache.set(strategy.key, data, { priority: strategy.priority });
          }
        } catch (error) {
          console.warn(`Cache warming failed for key: ${strategy.key}`, error);
        }
      }

      setWarmingStatus('complete');
    } catch (error) {
      setWarmingStatus('error');
    } finally {
      warmingRef.current = false;
    }
  }, [cache, warmingStrategies]);

  const stopWarming = useCallback(() => {
    warmingRef.current = false;
    setWarmingStatus('stopped');
  }, []);

  return { startWarming, stopWarming, warmingStatus };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default useCache;