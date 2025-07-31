'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'

// Types for dashboard state
export interface DateRange {
  startDate: string
  endDate: string
  preset?: 'last7days' | 'last30days' | 'last90days' | 'custom'
}

export interface DashboardFilters {
  highlightGoogleAds: boolean
  trafficSources: string[]
  deviceCategories: string[]
  customFilters: Record<string, any>
}

export interface DashboardData {
  timeSeries: any[]
  trafficSources: any[]
  topPages: any[]
  conversions: any[]
  lastUpdated: string | null
}

export interface LoadingStates {
  timeSeries: boolean
  trafficSources: boolean
  topPages: boolean
  conversions: boolean
  global: boolean
}

export interface ErrorStates {
  timeSeries: string | null
  trafficSources: string | null
  topPages: string | null
  conversions: string | null
  global: string | null
}

export interface DashboardState {
  dateRange: DateRange
  filters: DashboardFilters
  data: DashboardData
  loading: LoadingStates
  errors: ErrorStates
  isOnline: boolean
  lastRefresh: string | null
}

// Action types for the reducer
export type DashboardAction =
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'SET_FILTERS'; payload: Partial<DashboardFilters> }
  | { type: 'SET_LOADING'; payload: { key: keyof LoadingStates; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof ErrorStates; value: string | null } }
  | { type: 'SET_DATA'; payload: { key: keyof DashboardData; value: any } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'SET_LAST_REFRESH'; payload: string }
  | { type: 'RESET_STATE' }

// Initial state
const getInitialDateRange = (): DateRange => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 30) // Default to last 30 days
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    preset: 'last30days'
  }
}

const initialState: DashboardState = {
  dateRange: getInitialDateRange(),
  filters: {
    highlightGoogleAds: true,
    trafficSources: [],
    deviceCategories: [],
    customFilters: {}
  },
  data: {
    timeSeries: [],
    trafficSources: [],
    topPages: [],
    conversions: [],
    lastUpdated: null
  },
  loading: {
    timeSeries: false,
    trafficSources: false,
    topPages: false,
    conversions: false,
    global: false
  },
  errors: {
    timeSeries: null,
    trafficSources: null,
    topPages: null,
    conversions: null,
    global: null
  },
  isOnline: true,
  lastRefresh: null
}

// Reducer function
function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_DATE_RANGE':
      return {
        ...state,
        dateRange: action.payload
      }
    
    case 'SET_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value
        }
      }
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.key]: action.payload.value
        }
      }
    
    case 'SET_DATA':
      return {
        ...state,
        data: {
          ...state.data,
          [action.payload.key]: action.payload.value,
          lastUpdated: new Date().toISOString()
        }
      }
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {
          timeSeries: null,
          trafficSources: null,
          topPages: null,
          conversions: null,
          global: null
        }
      }
    
    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload
      }
    
    case 'SET_LAST_REFRESH':
      return {
        ...state,
        lastRefresh: action.payload
      }
    
    case 'RESET_STATE':
      return {
        ...initialState,
        dateRange: getInitialDateRange()
      }
    
    default:
      return state
  }
}

// Context type definition
export interface DashboardContextType {
  // State
  state: DashboardState
  
  // Date range actions
  setDateRange: (dateRange: DateRange) => void
  setPresetDateRange: (preset: 'last7days' | 'last30days' | 'last90days') => void
  
  // Filter actions
  setFilters: (filters: Partial<DashboardFilters>) => void
  toggleGoogleAdsHighlight: () => void
  
  // Loading state actions
  setLoading: (key: keyof LoadingStates, value: boolean) => void
  setGlobalLoading: (value: boolean) => void
  
  // Error state actions
  setError: (key: keyof ErrorStates, error: string | null) => void
  clearErrors: () => void
  clearError: (key: keyof ErrorStates) => void
  
  // Data actions
  setData: (key: keyof DashboardData, data: any) => void
  
  // Utility actions
  refresh: () => Promise<void>
  reset: () => void
}

// Create the context
const DashboardContext = createContext<DashboardContextType | null>(null)

// Provider component
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)

  // Date range management
  const setDateRange = useCallback((dateRange: DateRange) => {
    dispatch({ type: 'SET_DATE_RANGE', payload: dateRange })
  }, [])

  const setPresetDateRange = useCallback((preset: 'last7days' | 'last30days' | 'last90days') => {
    const endDate = new Date()
    const startDate = new Date()
    
    switch (preset) {
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7)
        break
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30)
        break
      case 'last90days':
        startDate.setDate(endDate.getDate() - 90)
        break
    }
    
    const dateRange: DateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      preset
    }
    
    setDateRange(dateRange)
  }, [setDateRange])

  // Filter management
  const setFilters = useCallback((filters: Partial<DashboardFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }, [])

  const toggleGoogleAdsHighlight = useCallback(() => {
    setFilters({ highlightGoogleAds: !state.filters.highlightGoogleAds })
  }, [state.filters.highlightGoogleAds, setFilters])

  // Loading state management
  const setLoading = useCallback((key: keyof LoadingStates, value: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { key, value } })
  }, [])

  const setGlobalLoading = useCallback((value: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'global', value } })
  }, [])

  // Error state management
  const setError = useCallback((key: keyof ErrorStates, error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { key, value: error } })
  }, [])

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' })
  }, [])

  const clearError = useCallback((key: keyof ErrorStates) => {
    dispatch({ type: 'SET_ERROR', payload: { key, value: null } })
  }, [])

  // Data management
  const setData = useCallback((key: keyof DashboardData, data: any) => {
    dispatch({ type: 'SET_DATA', payload: { key, value: data } })
  }, [])

  // Refresh functionality (placeholder for Phase 5)
  const refresh = useCallback(async () => {
    console.log('🔄 Dashboard refresh triggered')
    dispatch({ type: 'SET_LAST_REFRESH', payload: new Date().toISOString() })
    
    // This will be implemented in Phase 2 (API Integration)
    // For now, just clear errors and reset loading states
    clearErrors()
    
    // TODO: Implement actual data fetching in Phase 2
  }, [clearErrors])

  // Reset functionality
  const reset = useCallback(() => {
    dispatch({ type: 'RESET_STATE' })
  }, [])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true })
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial online status
    dispatch({ type: 'SET_ONLINE_STATUS', payload: navigator.onLine })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Context value
  const value: DashboardContextType = {
    state,
    setDateRange,
    setPresetDateRange,
    setFilters,
    toggleGoogleAdsHighlight,
    setLoading,
    setGlobalLoading,
    setError,
    clearErrors,
    clearError,
    setData,
    refresh,
    reset
  }

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}

// Custom hook to use the dashboard context
export const useDashboard = () => {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

// Export the context for advanced use cases
export default DashboardContext