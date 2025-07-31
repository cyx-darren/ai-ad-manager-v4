'use client'

import { useState, useCallback, useEffect } from 'react'

export type LoadingPhase = 'initial' | 'partial' | 'complete'
export type LoadingState = boolean | LoadingPhase

interface LoadingStatesConfig {
  [key: string]: LoadingState
}

interface UseLoadingStatesReturn {
  loadingStates: LoadingStatesConfig
  isLoading: (key: string) => boolean
  getLoadingPhase: (key: string) => LoadingPhase
  setLoading: (key: string, state: LoadingState) => void
  setMultipleLoading: (states: Partial<LoadingStatesConfig>) => void
  clearAllLoading: () => void
  startProgressiveLoading: (key: string, phases: LoadingPhase[], intervals: number[]) => void
  isAnyLoading: () => boolean
  getLoadingKeys: () => string[]
}

export const useLoadingStates = (
  initialStates: LoadingStatesConfig = {}
): UseLoadingStatesReturn => {
  const [loadingStates, setLoadingStates] = useState<LoadingStatesConfig>(initialStates)

  // Check if a specific key is loading
  const isLoading = useCallback((key: string): boolean => {
    const state = loadingStates[key]
    return state === true || (typeof state === 'string' && state !== 'complete')
  }, [loadingStates])

  // Get the loading phase for a key
  const getLoadingPhase = useCallback((key: string): LoadingPhase => {
    const state = loadingStates[key]
    if (typeof state === 'string') {
      return state
    }
    return state === true ? 'initial' : 'complete'
  }, [loadingStates])

  // Set loading state for a specific key
  const setLoading = useCallback((key: string, state: LoadingState) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: state
    }))
  }, [])

  // Set multiple loading states at once
  const setMultipleLoading = useCallback((states: Partial<LoadingStatesConfig>) => {
    setLoadingStates(prev => ({
      ...prev,
      ...states
    }))
  }, [])

  // Clear all loading states
  const clearAllLoading = useCallback(() => {
    setLoadingStates(prev => {
      const cleared: LoadingStatesConfig = {}
      Object.keys(prev).forEach(key => {
        cleared[key] = 'complete'
      })
      return cleared
    })
  }, [])

  // Start progressive loading with custom phases and timing
  const startProgressiveLoading = useCallback((
    key: string, 
    phases: LoadingPhase[] = ['initial', 'partial', 'complete'],
    intervals: number[] = [500, 1000, 1500]
  ) => {
    if (phases.length === 0) return

    // Start with first phase
    setLoading(key, phases[0])

    // Progress through phases
    phases.slice(1).forEach((phase, index) => {
      const timeoutIndex = Math.min(index, intervals.length - 1)
      setTimeout(() => {
        setLoading(key, phase)
      }, intervals[timeoutIndex])
    })
  }, [setLoading])

  // Check if any key is loading
  const isAnyLoading = useCallback((): boolean => {
    return Object.keys(loadingStates).some(key => isLoading(key))
  }, [loadingStates, isLoading])

  // Get all currently loading keys
  const getLoadingKeys = useCallback((): string[] => {
    return Object.keys(loadingStates).filter(key => isLoading(key))
  }, [loadingStates, isLoading])

  return {
    loadingStates,
    isLoading,
    getLoadingPhase,
    setLoading,
    setMultipleLoading,
    clearAllLoading,
    startProgressiveLoading,
    isAnyLoading,
    getLoadingKeys
  }
}

// Hook for simple boolean loading state
export const useSimpleLoading = (initialState = false) => {
  const [loading, setLoading] = useState(initialState)
  
  const startLoading = useCallback(() => setLoading(true), [])
  const stopLoading = useCallback(() => setLoading(false), [])
  const toggleLoading = useCallback(() => setLoading(prev => !prev), [])

  return {
    loading,
    setLoading,
    startLoading,
    stopLoading,
    toggleLoading
  }
}

// Hook for loading with automatic timeout
export const useLoadingWithTimeout = (
  timeoutMs = 10000, // 10 second default timeout
  onTimeout?: () => void
) => {
  const [loading, setLoading] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const startLoading = useCallback(() => {
    setLoading(true)
    setTimedOut(false)

    const timeoutId = setTimeout(() => {
      setLoading(false)
      setTimedOut(true)
      onTimeout?.()
    }, timeoutMs)

    return () => clearTimeout(timeoutId)
  }, [timeoutMs, onTimeout])

  const stopLoading = useCallback(() => {
    setLoading(false)
    setTimedOut(false)
  }, [])

  return {
    loading,
    timedOut,
    startLoading,
    stopLoading
  }
}

// Hook for managing loading state of async operations
export const useAsyncLoading = <T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  options?: {
    onSuccess?: (result: Awaited<ReturnType<T>>) => void
    onError?: (error: Error) => void
    showProgressiveLoading?: boolean
  }
) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<Awaited<ReturnType<T>> | null>(null)

  const execute = useCallback(async (...args: Parameters<T>) => {
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn(...args)
      setData(result)
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      options?.onError?.(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [asyncFn, options])

  return {
    loading,
    error,
    data,
    execute
  }
}