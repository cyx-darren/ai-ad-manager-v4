'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRefreshManager } from './useRefreshManager'
import { withCache, cacheManager, invalidateCache, CACHE_CONFIGS } from '@/utils/cacheManager'
import { useErrorRecovery } from './useErrorRecovery'
import { useError } from '@/contexts/ErrorContext'

export interface DashboardRefreshConfig {
  enableAutoRefresh: boolean
  refreshInterval: number
  enableCache: boolean
  cacheStrategy: 'aggressive' | 'conservative' | 'realtime'
  enableErrorRecovery: boolean
  enableMetrics: boolean
}

export interface DashboardDataSources {
  sessions: () => Promise<any>
  trafficSources: () => Promise<any>
  topPages: () => Promise<any>
  conversions: () => Promise<any>
}

export interface DashboardRefreshState {
  refreshManager: any
  cacheMetrics: any
  lastRefreshTime: string | null
  refreshCount: number
  isStale: boolean
  errors: string[]
}

const DEFAULT_CONFIG: DashboardRefreshConfig = {
  enableAutoRefresh: true,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  enableCache: true,
  cacheStrategy: 'conservative',
  enableErrorRecovery: true,
  enableMetrics: true
}

export function useDashboardRefresh(
  dataSources: DashboardDataSources,
  dateRange: { startDate: string; endDate: string },
  config: Partial<DashboardRefreshConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { addApiError } = useError()

  // Generate cache key based on date range
  const cacheKey = useMemo(() => {
    return `dashboard_${dateRange.startDate}_${dateRange.endDate}`
  }, [dateRange.startDate, dateRange.endDate])

  // Cache configuration based on strategy
  const cacheConfig = useMemo(() => {
    switch (finalConfig.cacheStrategy) {
      case 'realtime':
        return CACHE_CONFIGS.realtime
      case 'aggressive':
        return { ...CACHE_CONFIGS.dashboard, ttl: 2 * 60 * 1000 } // 2 minutes
      case 'conservative':
      default:
        return CACHE_CONFIGS.dashboard
    }
  }, [finalConfig.cacheStrategy])

  // Main refresh function that fetches all dashboard data
  const refreshDashboardData = useCallback(async () => {
    console.log('🔄 Starting comprehensive dashboard refresh...')
    
    const startTime = Date.now()
    
    try {
      // Fetch all data sources in parallel with caching
      const [sessionsData, trafficData, pagesData, conversionsData] = await Promise.all([
        finalConfig.enableCache 
          ? withCache(`${cacheKey}_sessions`, dataSources.sessions, cacheConfig)
          : dataSources.sessions(),
        
        finalConfig.enableCache
          ? withCache(`${cacheKey}_traffic`, dataSources.trafficSources, cacheConfig)
          : dataSources.trafficSources(),
        
        finalConfig.enableCache
          ? withCache(`${cacheKey}_pages`, dataSources.topPages, cacheConfig)
          : dataSources.topPages(),
        
        finalConfig.enableCache
          ? withCache(`${cacheKey}_conversions`, dataSources.conversions, cacheConfig)
          : dataSources.conversions()
      ])

      const duration = Date.now() - startTime
      console.log(`✅ Dashboard refresh completed in ${duration}ms`)

      return {
        sessions: sessionsData,
        trafficSources: trafficData,
        topPages: pagesData,
        conversions: conversionsData,
        timestamp: new Date().toISOString(),
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Dashboard refresh failed after ${duration}ms:`, error)
      
      addApiError(
        'Dashboard refresh failed',
        error instanceof Error ? error.message : 'Unknown error',
        'DashboardRefresh'
      )
      
      throw error
    }
  }, [cacheKey, dataSources, cacheConfig, finalConfig.enableCache, addApiError])

  // Set up refresh manager
  const refreshManager = useRefreshManager(refreshDashboardData, {
    enabled: finalConfig.enableAutoRefresh,
    interval: finalConfig.refreshInterval,
    maxRetries: 3,
    retryDelay: 2000,
    pauseOnError: true,
    pauseOnOffline: true,
    refreshOnFocus: true,
    refreshOnReconnect: true,
    staleTime: finalConfig.refreshInterval * 2 // Data is stale after 2x refresh interval
  })

  // Set up error recovery if enabled
  const errorRecovery = useErrorRecovery(
    refreshDashboardData,
    cacheKey,
    { sessions: [], trafficSources: [], topPages: [], conversions: [] },
    finalConfig.enableErrorRecovery ? {
      enableRetry: true,
      enableFallback: true,
      enableAutoRecovery: true,
      maxAutoRetries: 3,
      retryStrategy: 'dashboard',
      fallbackStrategy: 'dashboard'
    } : { enableRetry: false, enableFallback: false, enableAutoRecovery: false }
  )

  // Invalidate cache when date range changes
  useEffect(() => {
    console.log('📅 Date range changed, invalidating cache...')
    
    // Invalidate old cache entries for different date ranges
    invalidateCache.byPattern(/^dashboard_/)
    
    // Force refresh with new date range
    if (finalConfig.enableAutoRefresh) {
      refreshManager.forceRefresh()
    }
  }, [dateRange.startDate, dateRange.endDate, finalConfig.enableAutoRefresh, refreshManager])

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    console.log('👆 Manual refresh triggered')
    
    // Clear cache for fresh data
    invalidateCache.byKey(`${cacheKey}_sessions`)
    invalidateCache.byKey(`${cacheKey}_traffic`)
    invalidateCache.byKey(`${cacheKey}_pages`)
    invalidateCache.byKey(`${cacheKey}_conversions`)
    
    // Trigger refresh
    return await refreshManager.refresh()
  }, [cacheKey, refreshManager])

  // Refresh specific data source
  const refreshDataSource = useCallback(async (source: keyof DashboardDataSources) => {
    console.log(`🎯 Refreshing specific data source: ${source}`)
    
    // Clear specific cache
    invalidateCache.byKey(`${cacheKey}_${source}`)
    
    // Fetch fresh data
    try {
      const data = await dataSources[source]()
      
      // Update cache
      if (finalConfig.enableCache) {
        cacheManager.set(`${cacheKey}_${source}`, data, cacheConfig)
      }
      
      return data
    } catch (error) {
      console.error(`❌ Failed to refresh ${source}:`, error)
      throw error
    }
  }, [cacheKey, dataSources, finalConfig.enableCache, cacheConfig])

  // Cache management functions
  const cacheControls = useMemo(() => ({
    clearCache: () => invalidateCache.byPattern(/^dashboard_/),
    clearSpecificCache: (source: string) => invalidateCache.byKey(`${cacheKey}_${source}`),
    clearExpiredCache: () => invalidateCache.expired(),
    getCacheMetrics: () => cacheManager.getMetrics(),
    getCacheKeys: () => cacheManager.getKeys().filter(key => key.startsWith('dashboard_'))
  }), [cacheKey])

  // Configuration controls
  const configControls = useMemo(() => ({
    setRefreshInterval: (interval: number) => {
      refreshManager.setConfig({ interval })
    },
    enableAutoRefresh: () => {
      refreshManager.setConfig({ enabled: true })
    },
    disableAutoRefresh: () => {
      refreshManager.setConfig({ enabled: false })
    },
    pauseRefresh: () => {
      refreshManager.pauseRefresh()
    },
    resumeRefresh: () => {
      refreshManager.resumeRefresh()
    },
    resetErrors: () => {
      refreshManager.resetErrorCount()
    }
  }), [refreshManager])

  // State aggregation
  const state = useMemo(() => ({
    refreshManager: refreshManager.state,
    errorRecovery: errorRecovery,
    cache: finalConfig.enableMetrics ? cacheManager.getMetrics() : null,
    isRefreshing: refreshManager.state.isRefreshing || errorRecovery.loading,
    lastRefresh: refreshManager.state.lastRefresh,
    nextRefresh: refreshManager.state.nextRefresh,
    isStale: refreshManager.state.isStale,
    hasErrors: refreshManager.state.consecutiveErrors > 0 || !!errorRecovery.error,
    isPaused: refreshManager.state.isPaused
  }), [refreshManager.state, errorRecovery, finalConfig.enableMetrics])

  return {
    // State
    state,
    
    // Actions
    manualRefresh,
    refreshDataSource,
    
    // Configuration
    configControls,
    
    // Cache management
    cacheControls,
    
    // Error recovery
    errorRecovery: {
      retry: errorRecovery.retry,
      useFallback: errorRecovery.useFallback,
      reset: errorRecovery.reset
    }
  }
}