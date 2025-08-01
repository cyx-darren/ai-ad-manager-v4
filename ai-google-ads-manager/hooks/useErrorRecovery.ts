'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useError } from '@/contexts/ErrorContext'
import { retryAsync, RETRY_CONFIGS, fetchWithRetry } from '@/utils/retryUtils'
import { getFallbackData, saveFallbackData, FALLBACK_CONFIGS } from '@/utils/fallbackData'

export interface ErrorRecoveryConfig {
  enableRetry?: boolean
  enableFallback?: boolean
  enableAutoRecovery?: boolean
  maxAutoRetries?: number
  retryStrategy?: keyof typeof RETRY_CONFIGS
  fallbackStrategy?: keyof typeof FALLBACK_CONFIGS
  onRecovery?: (method: 'retry' | 'fallback' | 'manual') => void
  onFailure?: (error: any) => void
}

export interface ErrorRecoveryState<T> {
  data: T | null
  loading: boolean
  error: any | null
  retryCount: number
  lastRetryTime: string | null
  recoveryMethod: 'none' | 'retry' | 'fallback' | 'manual'
  fallbackUsed: boolean
  confidence: number
}

const DEFAULT_CONFIG: ErrorRecoveryConfig = {
  enableRetry: true,
  enableFallback: true,
  enableAutoRecovery: true,
  maxAutoRetries: 3,
  retryStrategy: 'user',
  fallbackStrategy: 'dashboard'
}

export function useErrorRecovery<T>(
  operation: () => Promise<T>,
  fallbackKey: string,
  expectedShape: T,
  config: ErrorRecoveryConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { addApiError, addNetworkError, isOnline } = useError()
  const autoRetryCount = useRef(0)
  
  const [state, setState] = useState<ErrorRecoveryState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
    lastRetryTime: null,
    recoveryMethod: 'none',
    fallbackUsed: false,
    confidence: 0
  })

  // Manual retry function
  const retry = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      retryCount: prev.retryCount + 1,
      lastRetryTime: new Date().toISOString()
    }))

    try {
      const result = await retryAsync(operation, RETRY_CONFIGS[finalConfig.retryStrategy!])
      
      if (result.success) {
        // Save successful data as fallback
        saveFallbackData(fallbackKey, result.data!)
        
        setState(prev => ({
          ...prev,
          data: result.data!,
          loading: false,
          error: null,
          recoveryMethod: 'retry',
          fallbackUsed: false,
          confidence: 1.0
        }))
        
        finalConfig.onRecovery?.('retry')
        autoRetryCount.current = 0
      } else {
        throw result.error
      }
    } catch (error) {
      await handleFailure(error)
    }
  }, [operation, fallbackKey, finalConfig])

  // Get fallback data
  const useFallback = useCallback(() => {
    const fallbackResult = getFallbackData(
      fallbackKey, 
      expectedShape, 
      FALLBACK_CONFIGS[finalConfig.fallbackStrategy!]
    )
    
    setState(prev => ({
      ...prev,
      data: fallbackResult.data,
      loading: false,
      error: null,
      recoveryMethod: 'fallback',
      fallbackUsed: true,
      confidence: fallbackResult.confidence
    }))
    
    finalConfig.onRecovery?.('fallback')
  }, [fallbackKey, expectedShape, finalConfig])

  // Handle failure with recovery strategies
  const handleFailure = useCallback(async (error: any) => {
    console.error('Operation failed:', error)
    
    // Add error to error context
    if (error?.code === 'NETWORK_ERROR' || !isOnline) {
      addNetworkError('Network operation failed', error.message, 'errorRecovery')
    } else {
      addApiError('API operation failed', error.message, 'errorRecovery')
    }

    // Try auto-recovery if enabled
    if (finalConfig.enableAutoRecovery && 
        autoRetryCount.current < (finalConfig.maxAutoRetries || 3)) {
      
      autoRetryCount.current++
      
      // Wait a bit before auto-retry
      setTimeout(() => {
        retry()
      }, 2000 * autoRetryCount.current) // Increasing delay
      
      return
    }

    // Use fallback if available and enabled
    if (finalConfig.enableFallback) {
      useFallback()
      return
    }

    // No recovery possible
    setState(prev => ({
      ...prev,
      loading: false,
      error,
      recoveryMethod: 'none',
      confidence: 0
    }))
    
    finalConfig.onFailure?.(error)
  }, [finalConfig, addApiError, addNetworkError, isOnline, retry, useFallback])

  // Initial execution
  const execute = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      retryCount: 0,
      recoveryMethod: 'none'
    }))
    
    autoRetryCount.current = 0

    try {
      const result = await operation()
      
      // Save successful data as fallback
      saveFallbackData(fallbackKey, result)
      
      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null,
        recoveryMethod: 'none',
        fallbackUsed: false,
        confidence: 1.0
      }))
    } catch (error) {
      await handleFailure(error)
    }
  }, [operation, fallbackKey, handleFailure])

  // Reset function
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0,
      lastRetryTime: null,
      recoveryMethod: 'none',
      fallbackUsed: false,
      confidence: 0
    })
    autoRetryCount.current = 0
  }, [])

  // Auto-retry when coming back online
  useEffect(() => {
    if (isOnline && state.error && finalConfig.enableAutoRecovery) {
      const networkError = state.error?.code === 'NETWORK_ERROR' || 
                          state.error?.name === 'TypeError'
      
      if (networkError && autoRetryCount.current < (finalConfig.maxAutoRetries || 3)) {
        retry()
      }
    }
  }, [isOnline, state.error, finalConfig.enableAutoRecovery, finalConfig.maxAutoRetries, retry])

  return {
    ...state,
    execute,
    retry,
    useFallback,
    reset,
    canRetry: finalConfig.enableRetry && state.retryCount < (finalConfig.maxAutoRetries || 3),
    canUseFallback: finalConfig.enableFallback && !state.fallbackUsed,
    isAutoRetrying: autoRetryCount.current > 0 && state.loading
  }
}

// Enhanced fetch hook with error recovery
export function useFetchWithRecovery<T>(
  url: string,
  options: RequestInit = {},
  fallbackKey: string,
  expectedShape: T,
  config: ErrorRecoveryConfig = {}
) {
  const operation = useCallback(async () => {
    const response = await fetchWithRetry(url, options, RETRY_CONFIGS[config.retryStrategy || 'user'])
    return await response.json() as T
  }, [url, options, config.retryStrategy])

  return useErrorRecovery(operation, fallbackKey, expectedShape, config)
}

// Recovery status component helper
export function getRecoveryStatus(state: ErrorRecoveryState<any>) {
  if (state.loading) {
    if (state.retryCount > 0) {
      return {
        type: 'retrying' as const,
        message: `Retrying... (Attempt ${state.retryCount})`
      }
    }
    return {
      type: 'loading' as const,
      message: 'Loading...'
    }
  }

  if (state.error && !state.fallbackUsed) {
    return {
      type: 'error' as const,
      message: 'Failed to load data'
    }
  }

  if (state.fallbackUsed) {
    const confidenceLevel = state.confidence > 0.7 ? 'high' : 
                           state.confidence > 0.4 ? 'medium' : 'low'
    
    return {
      type: 'fallback' as const,
      message: `Using ${state.recoveryMethod} data`,
      confidence: confidenceLevel
    }
  }

  if (state.data) {
    return {
      type: 'success' as const,
      message: 'Data loaded successfully'
    }
  }

  return {
    type: 'idle' as const,
    message: 'Ready to load'
  }
}

// Error recovery utilities for common scenarios
export const errorRecoveryUtils = {
  // For dashboard widgets that need to show something
  dashboardWidget: {
    enableRetry: true,
    enableFallback: true,
    enableAutoRecovery: true,
    maxAutoRetries: 2,
    retryStrategy: 'user' as const,
    fallbackStrategy: 'dashboard' as const
  },

  // For critical data that must be fresh
  criticalData: {
    enableRetry: true,
    enableFallback: false,
    enableAutoRecovery: true,
    maxAutoRetries: 5,
    retryStrategy: 'critical' as const,
    fallbackStrategy: 'critical' as const
  },

  // For real-time data that should fail fast
  realtimeData: {
    enableRetry: true,
    enableFallback: false,
    enableAutoRecovery: false,
    maxAutoRetries: 1,
    retryStrategy: 'realtime' as const,
    fallbackStrategy: 'realtime' as const
  },

  // For background operations
  backgroundSync: {
    enableRetry: true,
    enableFallback: true,
    enableAutoRecovery: true,
    maxAutoRetries: 10,
    retryStrategy: 'background' as const,
    fallbackStrategy: 'background' as const
  }
} as const