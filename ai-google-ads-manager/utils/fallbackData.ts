/**
 * Fallback data utilities for graceful degradation when API calls fail
 */

import { sampleData } from '@/components/dashboard/sampleData'

// Types for fallback strategies
export type FallbackStrategy = 'cache' | 'sample' | 'empty' | 'partial' | 'hybrid'

export interface FallbackConfig {
  strategy: FallbackStrategy
  cacheKey?: string
  cacheTTL?: number // Time to live in milliseconds
  enableSampleData?: boolean
  enableLocalStorage?: boolean
  enableSessionStorage?: boolean
  partialDataThreshold?: number // Minimum data points required
}

export interface FallbackResult<T> {
  data: T
  source: 'api' | 'cache' | 'sample' | 'partial' | 'empty'
  timestamp: string
  isStale: boolean
  confidence: number // 0-1, how reliable is this data
}

// Default fallback configuration
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  strategy: 'hybrid',
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableSampleData: true,
  enableLocalStorage: true,
  enableSessionStorage: true,
  partialDataThreshold: 0.3 // 30% of expected data
}

// Cache management
class CacheManager {
  private memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  set(key: string, data: any, ttl: number) {
    this.memoryCache.set(key, {
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: Date.now(),
      ttl
    })

    // Also save to localStorage if available
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`fallback_${key}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          ttl
        }))
      } catch (error) {
        console.warn('Failed to save to localStorage:', error)
      }
    }
  }

  get(key: string) {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key)
    if (memoryItem && Date.now() - memoryItem.timestamp < memoryItem.ttl) {
      return {
        data: memoryItem.data,
        source: 'memory',
        timestamp: new Date(memoryItem.timestamp).toISOString(),
        isStale: false
      }
    }

    // Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`fallback_${key}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          const isStale = Date.now() - parsed.timestamp > parsed.ttl
          return {
            data: parsed.data,
            source: 'localStorage',
            timestamp: new Date(parsed.timestamp).toISOString(),
            isStale
          }
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error)
      }
    }

    return null
  }

  clear(key?: string) {
    if (key) {
      this.memoryCache.delete(key)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`fallback_${key}`)
      }
    } else {
      this.memoryCache.clear()
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter(k => k.startsWith('fallback_'))
          .forEach(k => localStorage.removeItem(k))
      }
    }
  }
}

const cacheManager = new CacheManager()

// Main fallback function
export function getFallbackData<T>(
  key: string,
  expectedShape: T,
  config: Partial<FallbackConfig> = {}
): FallbackResult<T> {
  const finalConfig = { ...DEFAULT_FALLBACK_CONFIG, ...config }

  switch (finalConfig.strategy) {
    case 'cache':
      return getCachedFallback(key, expectedShape, finalConfig)
    
    case 'sample':
      return getSampleFallback(key, expectedShape)
    
    case 'empty':
      return getEmptyFallback(expectedShape)
    
    case 'partial':
      return getPartialFallback(key, expectedShape, finalConfig)
    
    case 'hybrid':
    default:
      return getHybridFallback(key, expectedShape, finalConfig)
  }
}

// Cache-based fallback
function getCachedFallback<T>(
  key: string,
  expectedShape: T,
  config: FallbackConfig
): FallbackResult<T> {
  const cached = cacheManager.get(key)
  
  if (cached) {
    return {
      data: cached.data,
      source: 'cache',
      timestamp: cached.timestamp,
      isStale: cached.isStale,
      confidence: cached.isStale ? 0.5 : 0.8
    }
  }

  // Fallback to sample data if cache miss
  if (config.enableSampleData) {
    return getSampleFallback(key, expectedShape)
  }

  return getEmptyFallback(expectedShape)
}

// Sample data fallback
function getSampleFallback<T>(key: string, expectedShape: T): FallbackResult<T> {
  const sampleDataMap: Record<string, any> = {
    'dashboard_sessions': sampleData.timeSeries,
    'dashboard_traffic_sources': sampleData.trafficSources,
    'dashboard_campaigns': sampleData.campaigns,
    'dashboard_channels': sampleData.channels,
    'dashboard_conversions': sampleData.conversionFunnel,
    'dashboard_pages': sampleData.pages,
    'dashboard_devices': sampleData.devices,
    'dashboard_geographic': sampleData.geographic
  }

  const data = sampleDataMap[key] || generateSampleFromShape(expectedShape)

  return {
    data,
    source: 'sample',
    timestamp: new Date().toISOString(),
    isStale: false,
    confidence: 0.3 // Sample data has low confidence
  }
}

// Empty data fallback
function getEmptyFallback<T>(expectedShape: T): FallbackResult<T> {
  const emptyData = createEmptyFromShape(expectedShape)

  return {
    data: emptyData,
    source: 'empty',
    timestamp: new Date().toISOString(),
    isStale: false,
    confidence: 0
  }
}

// Partial data fallback (uses whatever data is available)
function getPartialFallback<T>(
  key: string,
  expectedShape: T,
  config: FallbackConfig
): FallbackResult<T> {
  // Try to get partial data from cache
  const cached = cacheManager.get(key)
  
  if (cached) {
    const dataPoints = getDataPointCount(cached.data)
    const expectedPoints = getDataPointCount(expectedShape)
    const ratio = dataPoints / expectedPoints

    if (ratio >= (config.partialDataThreshold || 0.3)) {
      return {
        data: cached.data,
        source: 'partial',
        timestamp: cached.timestamp,
        isStale: cached.isStale,
        confidence: ratio * 0.7 // Confidence based on data completeness
      }
    }
  }

  // Fallback to sample data
  return getSampleFallback(key, expectedShape)
}

// Hybrid fallback (best available strategy)
function getHybridFallback<T>(
  key: string,
  expectedShape: T,
  config: FallbackConfig
): FallbackResult<T> {
  // Try cache first
  const cached = cacheManager.get(key)
  if (cached && !cached.isStale) {
    return {
      data: cached.data,
      source: 'cache',
      timestamp: cached.timestamp,
      isStale: false,
      confidence: 0.8
    }
  }

  // Try partial cache data
  if (cached) {
    const dataPoints = getDataPointCount(cached.data)
    const expectedPoints = getDataPointCount(expectedShape)
    const ratio = dataPoints / expectedPoints

    if (ratio >= (config.partialDataThreshold || 0.3)) {
      return {
        data: cached.data,
        source: 'partial',
        timestamp: cached.timestamp,
        isStale: true,
        confidence: ratio * 0.5
      }
    }
  }

  // Fallback to sample data
  if (config.enableSampleData) {
    return getSampleFallback(key, expectedShape)
  }

  // Last resort: empty data
  return getEmptyFallback(expectedShape)
}

// Utility functions
function createEmptyFromShape<T>(shape: T): T {
  if (Array.isArray(shape)) {
    return [] as T
  }

  if (typeof shape === 'object' && shape !== null) {
    const empty: any = {}
    Object.keys(shape as any).forEach(key => {
      const value = (shape as any)[key]
      if (Array.isArray(value)) {
        empty[key] = []
      } else if (typeof value === 'number') {
        empty[key] = 0
      } else if (typeof value === 'string') {
        empty[key] = ''
      } else if (typeof value === 'boolean') {
        empty[key] = false
      } else if (typeof value === 'object') {
        empty[key] = createEmptyFromShape(value)
      } else {
        empty[key] = null
      }
    })
    return empty
  }

  return shape
}

function generateSampleFromShape<T>(shape: T): T {
  if (Array.isArray(shape)) {
    // Generate 3-5 sample items
    const count = Math.floor(Math.random() * 3) + 3
    return Array(count).fill(null).map(() => generateSampleFromShape(shape[0])) as T
  }

  if (typeof shape === 'object' && shape !== null) {
    const sample: any = {}
    Object.keys(shape as any).forEach(key => {
      const value = (shape as any)[key]
      if (Array.isArray(value)) {
        sample[key] = generateSampleFromShape(value)
      } else if (typeof value === 'number') {
        sample[key] = Math.floor(Math.random() * 1000) + 100
      } else if (typeof value === 'string') {
        sample[key] = `Sample ${key}`
      } else if (typeof value === 'boolean') {
        sample[key] = Math.random() > 0.5
      } else if (typeof value === 'object') {
        sample[key] = generateSampleFromShape(value)
      } else {
        sample[key] = value
      }
    })
    return sample
  }

  return shape
}

function getDataPointCount(data: any): number {
  if (Array.isArray(data)) {
    return data.length
  }

  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).length
  }

  return 1
}

// Cache management functions
export function saveFallbackData<T>(key: string, data: T, ttl?: number) {
  cacheManager.set(key, data, ttl || DEFAULT_FALLBACK_CONFIG.cacheTTL!)
}

export function clearFallbackCache(key?: string) {
  cacheManager.clear(key)
}

// React hook for fallback data
import { useState, useEffect, useCallback } from 'react'

export function useFallbackData<T>(
  key: string,
  expectedShape: T,
  config: Partial<FallbackConfig> = {}
) {
  const [fallbackResult, setFallbackResult] = useState<FallbackResult<T> | null>(null)

  const getFallback = useCallback(() => {
    const result = getFallbackData(key, expectedShape, config)
    setFallbackResult(result)
    return result
  }, [key, expectedShape, config])

  const saveFallback = useCallback((data: T) => {
    const ttl = config.cacheTTL || DEFAULT_FALLBACK_CONFIG.cacheTTL!
    saveFallbackData(key, data, ttl)
  }, [key, config.cacheTTL])

  const clearFallback = useCallback(() => {
    clearFallbackCache(key)
    setFallbackResult(null)
  }, [key])

  useEffect(() => {
    if (!fallbackResult) {
      getFallback()
    }
  }, [fallbackResult, getFallback])

  return {
    fallbackData: fallbackResult,
    getFallback,
    saveFallback,
    clearFallback
  }
}

// Predefined fallback configurations for common scenarios
export const FALLBACK_CONFIGS = {
  critical: {
    strategy: 'hybrid' as FallbackStrategy,
    cacheTTL: 60 * 60 * 1000, // 1 hour
    enableSampleData: true,
    partialDataThreshold: 0.5
  },
  
  realtime: {
    strategy: 'cache' as FallbackStrategy,
    cacheTTL: 30 * 1000, // 30 seconds
    enableSampleData: false,
    partialDataThreshold: 0.8
  },
  
  dashboard: {
    strategy: 'hybrid' as FallbackStrategy,
    cacheTTL: 10 * 60 * 1000, // 10 minutes
    enableSampleData: true,
    partialDataThreshold: 0.3
  },
  
  background: {
    strategy: 'cache' as FallbackStrategy,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
    enableSampleData: true,
    partialDataThreshold: 0.1
  }
} as const