'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useError } from '@/contexts/ErrorContext'

export interface RefreshConfig {
  enabled: boolean
  interval: number // milliseconds
  maxRetries: number
  retryDelay: number
  pauseOnError: boolean
  pauseOnOffline: boolean
  refreshOnFocus: boolean
  refreshOnReconnect: boolean
  staleTime: number // Time after which data is considered stale
}

export interface RefreshState {
  isRefreshing: boolean
  lastRefresh: string | null
  nextRefresh: string | null
  refreshCount: number
  consecutiveErrors: number
  isPaused: boolean
  isStale: boolean
}

export interface RefreshManager {
  state: RefreshState
  refresh: () => Promise<void>
  pauseRefresh: () => void
  resumeRefresh: () => void
  setConfig: (config: Partial<RefreshConfig>) => void
  resetErrorCount: () => void
  forceRefresh: () => Promise<void>
}

const DEFAULT_CONFIG: RefreshConfig = {
  enabled: true,
  interval: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  retryDelay: 2000,
  pauseOnError: true,
  pauseOnOffline: true,
  refreshOnFocus: true,
  refreshOnReconnect: true,
  staleTime: 10 * 60 * 1000 // 10 minutes
}

export function useRefreshManager(
  refreshFunction: () => Promise<void>,
  initialConfig: Partial<RefreshConfig> = {}
): RefreshManager {
  const { isOnline } = useError()
  const [config, setConfigState] = useState<RefreshConfig>({ ...DEFAULT_CONFIG, ...initialConfig })
  const [state, setState] = useState<RefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    nextRefresh: null,
    refreshCount: 0,
    consecutiveErrors: 0,
    isPaused: false,
    isStale: true
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshInProgress = useRef(false)

  // Update config
  const setConfig = useCallback((newConfig: Partial<RefreshConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Check if data is stale
  const checkStaleStatus = useCallback(() => {
    if (!state.lastRefresh) return true
    const lastRefreshTime = new Date(state.lastRefresh).getTime()
    const now = Date.now()
    return (now - lastRefreshTime) > config.staleTime
  }, [state.lastRefresh, config.staleTime])

  // Calculate next refresh time
  const calculateNextRefresh = useCallback(() => {
    if (!config.enabled || state.isPaused) return null
    
    const now = Date.now()
    let delay = config.interval
    
    // Add exponential backoff for consecutive errors
    if (state.consecutiveErrors > 0) {
      delay = Math.min(delay * Math.pow(2, state.consecutiveErrors), 30 * 60 * 1000) // Max 30 minutes
    }
    
    return new Date(now + delay).toISOString()
  }, [config.enabled, config.interval, state.isPaused, state.consecutiveErrors])

  // Main refresh function
  const refresh = useCallback(async (isManual = false) => {
    // Prevent concurrent refreshes
    if (refreshInProgress.current && !isManual) return
    
    // Check if refresh should be paused
    if (state.isPaused && !isManual) return
    if (config.pauseOnOffline && !isOnline && !isManual) return
    if (config.pauseOnError && state.consecutiveErrors >= config.maxRetries && !isManual) return

    refreshInProgress.current = true
    
    setState(prev => ({
      ...prev,
      isRefreshing: true,
      refreshCount: prev.refreshCount + 1
    }))

    try {
      console.log(`🔄 Starting ${isManual ? 'manual' : 'automatic'} refresh...`)
      await refreshFunction()
      
      const now = new Date().toISOString()
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        lastRefresh: now,
        nextRefresh: calculateNextRefresh(),
        consecutiveErrors: 0,
        isStale: false
      }))
      
      console.log(`✅ ${isManual ? 'Manual' : 'Automatic'} refresh completed successfully`)
    } catch (error) {
      console.error(`❌ ${isManual ? 'Manual' : 'Automatic'} refresh failed:`, error)
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        consecutiveErrors: prev.consecutiveErrors + 1,
        nextRefresh: calculateNextRefresh()
      }))
      
      // Pause automatic refresh if too many errors (but allow manual refresh)
      if (state.consecutiveErrors >= config.maxRetries && config.pauseOnError && !isManual) {
        setState(prev => ({ ...prev, isPaused: true }))
      }
    } finally {
      refreshInProgress.current = false
    }
  }, [refreshFunction, state.isPaused, state.consecutiveErrors, config, isOnline, calculateNextRefresh])

  // Force refresh (ignores pause state)
  const forceRefresh = useCallback(async () => {
    await refresh(true)
  }, [refresh])

  // Pause refresh
  const pauseRefresh = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true, nextRefresh: null }))
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Resume refresh
  const resumeRefresh = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isPaused: false, 
      nextRefresh: calculateNextRefresh(),
      consecutiveErrors: 0 // Reset errors on manual resume
    }))
  }, [calculateNextRefresh])

  // Reset error count
  const resetErrorCount = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      consecutiveErrors: 0,
      isPaused: false,
      nextRefresh: calculateNextRefresh()
    }))
  }, [calculateNextRefresh])

  // Set up automatic refresh interval
  useEffect(() => {
    if (!config.enabled || state.isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Calculate delay until next refresh
    let delay = config.interval
    if (state.lastRefresh) {
      const timeSinceLastRefresh = Date.now() - new Date(state.lastRefresh).getTime()
      delay = Math.max(config.interval - timeSinceLastRefresh, 0)
    }

    // Set initial timeout
    const timeoutId = setTimeout(() => {
      refresh(false)
      
      // Set up recurring interval
      intervalRef.current = setInterval(() => {
        refresh(false)
      }, config.interval)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [config.enabled, config.interval, state.isPaused, refresh])

  // Handle window focus
  useEffect(() => {
    if (!config.refreshOnFocus) return

    const handleFocus = () => {
      // Only refresh if data is stale
      if (checkStaleStatus()) {
        console.log('🪟 Window focused and data is stale, refreshing...')
        refresh(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [config.refreshOnFocus, refresh, checkStaleStatus])

  // Handle online/offline
  useEffect(() => {
    if (!config.refreshOnReconnect) return

    const handleOnline = () => {
      if (state.consecutiveErrors > 0 || checkStaleStatus()) {
        console.log('🌐 Back online, refreshing stale data...')
        refresh(false)
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [config.refreshOnReconnect, refresh, state.consecutiveErrors, checkStaleStatus])

  // Update stale status
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const isStale = checkStaleStatus()
      setState(prev => {
        if (prev.isStale !== isStale) {
          return { ...prev, isStale }
        }
        return prev
      })
    }, 30000) // Check every 30 seconds

    return () => clearInterval(checkInterval)
  }, [checkStaleStatus])

  // Update next refresh time
  useEffect(() => {
    setState(prev => ({ ...prev, nextRefresh: calculateNextRefresh() }))
  }, [calculateNextRefresh])

  return {
    state,
    refresh: forceRefresh,
    pauseRefresh,
    resumeRefresh,
    setConfig,
    resetErrorCount,
    forceRefresh
  }
}