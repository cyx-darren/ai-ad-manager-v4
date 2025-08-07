'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react'
import { useGA4DataService } from '@/lib/ga4ApiClient'
import { useMCPClient, useMCPStatus } from '@/lib/mcp/context'
import { useGA4Data, useMetrics } from '@/lib/mcp/hooks/dataHooks'
import { useMCPContext } from '@/lib/mcp/context'
import { dateRangeSyncManager } from '@/lib/mcp/utils/dateRangeSync'
import { filterSyncManager } from '@/lib/mcp/utils/filterSync'
import { useRaceConditionHandler } from '@/lib/mcp/hooks/raceConditionHooks'
import { useCrossComponentState } from '@/lib/mcp/hooks/crossComponentHooks'

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

export interface MCPConnectionStatus {
  isConnected: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'
  lastConnected: string | null
  authStatus: 'authenticated' | 'unauthenticated' | 'pending' | 'error'
  capabilities: string[]
  error: string | null
}

export interface DashboardState {
  dateRange: DateRange
  filters: DashboardFilters
  data: DashboardData
  loading: LoadingStates
  errors: ErrorStates
  isOnline: boolean
  lastRefresh: string | null
  mcpConnection: MCPConnectionStatus
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
  | { type: 'SET_MCP_CONNECTION'; payload: Partial<MCPConnectionStatus> }
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
  lastRefresh: null,
  mcpConnection: {
    isConnected: false,
    connectionState: 'disconnected',
    lastConnected: null,
    authStatus: 'unauthenticated',
    capabilities: [],
    error: null
  }
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
    
    case 'SET_MCP_CONNECTION':
      return {
        ...state,
        mcpConnection: {
          ...state.mcpConnection,
          ...action.payload
        }
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
  
  // MCP Connection actions
  setMCPConnection: (connection: Partial<MCPConnectionStatus>) => void
  connectMCP: () => Promise<void>
  disconnectMCP: () => Promise<void>
  refreshMCPAuth: () => Promise<void>
  
  // Individual data fetching functions - Phase B (Legacy GA4 + MCP)
  fetchData: {
    sessions: () => Promise<void>
    trafficSources: () => Promise<void>
    topPages: () => Promise<void>
    conversions: () => Promise<void>
    all: () => Promise<void>
  }
  
  // MCP data fetching functions
  fetchDataMCP: {
    sessions: () => Promise<void>
    trafficSources: () => Promise<void>
    topPages: () => Promise<void>
    conversions: () => Promise<void>
    all: () => Promise<void>
  }
}

// Create the context
const DashboardContext = createContext<DashboardContextType | null>(null)

// Provider component
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  const dataService = useGA4DataService()
  
  // Race condition protection for dashboard state
  const raceConditionHandler = useRaceConditionHandler('dashboard-state', {
    enableQueueing: true,
    enableVersioning: true,
    enableConflictResolution: true,
    defaultResolutionStrategy: 'last_writer_wins',
    autoResolveSimple: true
  });

  // Cross-component state consistency
  const crossComponentHandler = useCrossComponentState({
    componentId: 'dashboard-context',
    componentName: 'Dashboard Context',
    componentType: 'layout',
    enableValidation: true,
    enableEvents: true,
    enableDependencyTracking: true,
    autoRepair: true
  }, state);
  
  // MCP Integration
  const mcpClient = useMCPClient()
  const mcpStatus = useMCPStatus()
  const { connect, disconnect } = useMCPContext()

  // 🐛 DEBUG: Add console log to trace re-renders
  console.log('🔄 DashboardProvider render - Date range:', state.dateRange)
  console.log('🔗 MCP Status:', mcpStatus)

  // Register dashboard component on mount
  useEffect(() => {
    crossComponentHandler.register();
    
    return () => {
      crossComponentHandler.unregister();
    };
  }, [crossComponentHandler]);

  // Date range management with synchronization and race condition protection
  const setDateRange = useCallback(async (dateRange: DateRange) => {
    // Validate and normalize the date range
    const validation = dateRangeSyncManager.validateDateRange(dateRange);
    let finalRange = dateRange;

    if (!validation.isValid) {
      if (validation.adjustedRange) {
        finalRange = validation.adjustedRange;
        console.warn('📅 Date range adjusted:', validation.warnings);
      } else {
        console.error('📅 Invalid date range:', validation.errors);
        return; // Don't update if invalid and can't be corrected
      }
    }

    // Normalize the range
    finalRange = dateRangeSyncManager.normalizeDateRange(finalRange);

    // Use race condition handler for safe update
    const updateResult = await raceConditionHandler.safeUpdate(
      finalRange,
      'dateRange',
      'user',
      'normal'
    );

    if (updateResult.success) {
      // Update state
      dispatch({ type: 'SET_DATE_RANGE', payload: finalRange });
      
      // Update cross-component state
      await crossComponentHandler.updateState({ ...state, dateRange: finalRange });
      
      // Persist the range
      dateRangeSyncManager.persistDateRange(finalRange);
      
      // Publish cross-component event
      crossComponentHandler.publishEvent(
        'dashboard.dateRange.changed',
        { newRange: finalRange, source: 'user' },
        'state_change'
      );
      
      console.log('📅 Date range updated and synced:', finalRange);
    } else {
      console.error('📅 Date range update failed:', updateResult.errors);
      if (updateResult.conflicts) {
        console.warn('📅 Date range conflicts detected:', updateResult.conflicts);
      }
    }
  }, [raceConditionHandler, crossComponentHandler, state])

  const setPresetDateRange = useCallback((preset: 'last7days' | 'last30days' | 'last90days') => {
    // Use the sync manager for standardized preset ranges
    const dateRange = dateRangeSyncManager.getPresetDateRange(preset);
    setDateRange(dateRange);
    console.log('📅 Preset date range set:', preset, dateRange);
  }, [setDateRange])

  // Filter management with synchronization and race condition protection
  const setFilters = useCallback(async (newFilters: Partial<DashboardFilters>) => {
    // Merge with current filters
    let mergedFilters: DashboardFilters = {
      ...state.filters,
      ...newFilters
    };

    // Apply filter dependencies
    mergedFilters = filterSyncManager.applyFilterDependencies(mergedFilters);

    // Validate and normalize the filters
    const validation = filterSyncManager.validateFilters(mergedFilters);
    let finalFilters = mergedFilters;

    if (!validation.isValid) {
      if (validation.adjustedFilters) {
        finalFilters = validation.adjustedFilters;
        console.warn('🔍 Filters adjusted:', validation.warnings);
      } else {
        console.error('🔍 Invalid filters:', validation.errors);
        return; // Don't update if invalid and can't be corrected
      }
    }

    // Normalize the filters
    finalFilters = filterSyncManager.normalizeFilters(finalFilters);

    // Use race condition handler for safe update
    const updateResult = await raceConditionHandler.safeUpdate(
      finalFilters,
      'filter',
      'user',
      'normal'
    );

    if (updateResult.success) {
      // Update state
      dispatch({ type: 'SET_FILTERS', payload: finalFilters });
      
      // Update cross-component state
      await crossComponentHandler.updateState({ ...state, filters: finalFilters });
      
      // Persist the filters
      filterSyncManager.persistFilters(finalFilters);
      
      // Publish cross-component event
      crossComponentHandler.publishEvent(
        'dashboard.filters.changed',
        { newFilters: finalFilters, source: 'user' },
        'state_change'
      );
      
      console.log('🔍 Filters updated and synced:', finalFilters);
    } else {
      console.error('🔍 Filter update failed:', updateResult.errors);
      if (updateResult.conflicts) {
        console.warn('🔍 Filter conflicts detected:', updateResult.conflicts);
      }
    }
  }, [state.filters, raceConditionHandler, crossComponentHandler, state])

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

  // MCP connection management
  const setMCPConnection = useCallback((connection: Partial<MCPConnectionStatus>) => {
    dispatch({ type: 'SET_MCP_CONNECTION', payload: connection })
  }, [])

  // Monitor MCP status changes
  useEffect(() => {
    if (mcpStatus) {
      setMCPConnection({
        isConnected: mcpStatus.isConnected,
        connectionState: mcpStatus.connectionState,
        lastConnected: mcpStatus.lastConnected?.toISOString() || null,
        authStatus: mcpStatus.authStatus || 'unauthenticated',
        capabilities: mcpStatus.capabilities || [],
        error: mcpStatus.error?.message || null
      })
    }
  }, [mcpStatus, setMCPConnection])

  const connectMCP = useCallback(async () => {
    try {
      setMCPConnection({ connectionState: 'connecting' })
      await connect()
    } catch (error) {
      setMCPConnection({ 
        connectionState: 'error', 
        error: error instanceof Error ? error.message : 'Connection failed' 
      })
    }
  }, [connect, setMCPConnection])

  const disconnectMCP = useCallback(async () => {
    try {
      await disconnect()
    } catch (error) {
      setMCPConnection({ 
        error: error instanceof Error ? error.message : 'Disconnection failed' 
      })
    }
  }, [disconnect, setMCPConnection])

  const refreshMCPAuth = useCallback(async () => {
    // TODO: Implement MCP auth refresh if needed
    console.log('🔄 MCP Auth refresh requested')
  }, [])

  // Data fetching functions - Phase B Implementation
  const fetchSessionData = useCallback(async () => {
    console.log('🔍 Fetching session data...')
    setLoading('timeSeries', true)
    clearError('timeSeries')
    
    try {
      const sessionMetrics = await dataService.getSessionMetrics({
        startDate: state.dateRange.startDate,
        endDate: state.dateRange.endDate
      })
      
      setData('timeSeries', sessionMetrics.timeSeries || [])
      console.log('✅ Session data fetched successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch session data'
      setError('timeSeries', errorMessage)
      console.error('❌ Session data fetch failed:', errorMessage)
    } finally {
      setLoading('timeSeries', false)
    }
  }, [state.dateRange, dataService, setLoading, clearError, setData, setError])

  const fetchTrafficSourceData = useCallback(async () => {
    setLoading('trafficSources', true)
    clearError('trafficSources')
    
    try {
      const trafficSources = await dataService.getTrafficSources({
        startDate: state.dateRange.startDate,
        endDate: state.dateRange.endDate
      })
      
      setData('trafficSources', trafficSources)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch traffic source data'
      setError('trafficSources', errorMessage)
      console.error('❌ Traffic source data fetch failed:', errorMessage)
    } finally {
      setLoading('trafficSources', false)
    }
  }, [state.dateRange, dataService, setLoading, clearError, setData, setError])

  const fetchTopPagesData = useCallback(async () => {
    setLoading('topPages', true)
    clearError('topPages')
    
    try {
      const pagePerformance = await dataService.getPagePerformance({
        startDate: state.dateRange.startDate,
        endDate: state.dateRange.endDate
      })
      
      setData('topPages', pagePerformance)
      console.log('✅ Top pages data fetched successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch top pages data'
      setError('topPages', errorMessage)
      console.error('❌ Top pages data fetch failed:', errorMessage)
    } finally {
      setLoading('topPages', false)
    }
  }, [state.dateRange, dataService, setLoading, clearError, setData, setError])

  const fetchConversionsData = useCallback(async () => {
    setLoading('conversions', true)
    clearError('conversions')
    
    try {
      const conversions = await dataService.getConversions({
        startDate: state.dateRange.startDate,
        endDate: state.dateRange.endDate
      })
      
      setData('conversions', conversions)
      console.log('✅ Conversions data fetched successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch conversions data'
      setError('conversions', errorMessage)
      console.error('❌ Conversions data fetch failed:', errorMessage)
    } finally {
      setLoading('conversions', false)
    }
  }, [state.dateRange, dataService, setLoading, clearError, setData, setError])

  // Main refresh functionality - Phase B Implementation
  const refresh = useCallback(async () => {
    console.log('🔄 Dashboard refresh triggered - Phase B Implementation')
    console.log('📊 Current date range:', state.dateRange)
    dispatch({ type: 'SET_LAST_REFRESH', payload: new Date().toISOString() })
    
    // Set global loading state
    setGlobalLoading(true)
    clearErrors()
    
    try {
      // Test API connection first (but less frequently than before)
      const lastConnectionTest = sessionStorage.getItem('lastConnectionTest')
      const now = Date.now()
      let isConnected = true // Default to true to avoid unnecessary blocking
      
      if (!lastConnectionTest || now - parseInt(lastConnectionTest) > 60000) { // 1 minute rate limit
        console.log('🔍 Testing API connection during refresh...')
        isConnected = await dataService.testConnection()
        sessionStorage.setItem('lastConnectionTest', now.toString())
        sessionStorage.setItem('lastConnectionStatus', isConnected ? 'connected' : 'failed')
      } else {
        console.log('⏭️ Skipping connection test (using cached status)')
        const cachedStatus = sessionStorage.getItem('lastConnectionStatus')
        isConnected = cachedStatus === 'connected'
      }
      
      console.log(`🔌 API Connection: ${isConnected ? 'Connected' : 'Using fallback data'}`)
      
      // Fetch all data types in parallel (call functions directly to avoid dependency loops)
      await Promise.allSettled([
        (async () => {
          setLoading('timeSeries', true)
          clearError('timeSeries')
          try {
            const sessions = await dataService.getSessionMetrics({
              startDate: state.dateRange.startDate,
              endDate: state.dateRange.endDate
            })
            setData('timeSeries', sessions)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Session data fetch failed'
            setError('timeSeries', errorMessage)
          } finally {
            setLoading('timeSeries', false)
          }
        })(),
        (async () => {
          setLoading('trafficSources', true)
          clearError('trafficSources')
          try {
            const trafficSources = await dataService.getTrafficSources({
              startDate: state.dateRange.startDate,
              endDate: state.dateRange.endDate
            })
            setData('trafficSources', trafficSources)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Traffic source data fetch failed'
            setError('trafficSources', errorMessage)
          } finally {
            setLoading('trafficSources', false)
          }
        })(),
        (async () => {
          setLoading('topPages', true)
          clearError('topPages')
          try {
            const pagePerformance = await dataService.getPagePerformance({
              startDate: state.dateRange.startDate,
              endDate: state.dateRange.endDate
            })
            setData('topPages', pagePerformance)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Page performance data fetch failed'
            setError('topPages', errorMessage)
          } finally {
            setLoading('topPages', false)
          }
        })(),
        (async () => {
          setLoading('conversions', true)
          clearError('conversions')
          try {
            const conversions = await dataService.getConversions({
              startDate: state.dateRange.startDate,
              endDate: state.dateRange.endDate
            })
            setData('conversions', conversions)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Conversion data fetch failed'
            setError('conversions', errorMessage)
          } finally {
            setLoading('conversions', false)
          }
        })()
      ])
      
      console.log('✅ Dashboard refresh completed successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Dashboard refresh failed'
      setError('global', errorMessage)
      console.error('❌ Dashboard refresh failed:', errorMessage)
    } finally {
      setGlobalLoading(false)
    }
  }, [
    dataService,
    setGlobalLoading,
    clearErrors,
    setError,
    setLoading,
    clearError,
    setData
  ])

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

  // Initialize date range synchronization on mount
  useEffect(() => {
    console.log('📅 Initializing date range synchronization...');
    
    // Try to restore persisted date range
    const restoredRange = dateRangeSyncManager.restoreDateRange();
    if (restoredRange) {
      console.log('📅 Restored persisted date range:', restoredRange);
      dispatch({ type: 'SET_DATE_RANGE', payload: restoredRange });
    }

    // Listen for cross-browser sync events
    const handleSyncEvent = (data: any) => {
      if (data.newValue && data.key === 'dashboard-date-range') {
        console.log('📅 Received date range sync from another tab:', data.newValue);
        dispatch({ type: 'SET_DATE_RANGE', payload: data.newValue });
      }
    };

    dateRangeSyncManager.addEventListener('sync', handleSyncEvent);

    return () => {
      dateRangeSyncManager.removeEventListener('sync', handleSyncEvent);
    };
  }, []);

  // Initialize filter synchronization on mount
  useEffect(() => {
    console.log('🔍 Initializing filter synchronization...');
    
    // Try to restore persisted filters
    const restoredFilters = filterSyncManager.restoreFilters();
    if (restoredFilters) {
      console.log('🔍 Restored persisted filters:', restoredFilters);
      dispatch({ type: 'SET_FILTERS', payload: restoredFilters });
    }

    // Listen for cross-browser sync events
    const handleFilterSyncEvent = (data: any) => {
      if (data.newValue && data.key === 'dashboard-filters') {
        console.log('🔍 Received filter sync from another tab:', data.newValue);
        dispatch({ type: 'SET_FILTERS', payload: data.newValue });
      }
    };

    filterSyncManager.addEventListener('sync', handleFilterSyncEvent);

    return () => {
      filterSyncManager.removeEventListener('sync', handleFilterSyncEvent);
    };
  }, []);

  // Initial data fetch on mount and when date range changes - Phase B Implementation
  useEffect(() => {
    console.log('📅 Date range changed, fetching fresh data...')
    refresh()
  }, [state.dateRange.startDate, state.dateRange.endDate]) // ✅ FIXED: Removed refresh from dependencies

  // Expose individual fetch functions for manual use
  const fetchData = useMemo(() => ({
    sessions: fetchSessionData,
    trafficSources: fetchTrafficSourceData,
    topPages: fetchTopPagesData,
    conversions: fetchConversionsData,
    all: refresh
  }), [fetchSessionData, fetchTrafficSourceData, fetchTopPagesData, fetchConversionsData, refresh])

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
    reset,
    setMCPConnection,
    connectMCP,
    disconnectMCP,
    refreshMCPAuth,
    fetchData,
    fetchDataMCP: {
      sessions: fetchSessionData, // TODO: Implement MCP versions
      trafficSources: fetchTrafficSourceData,
      topPages: fetchTopPagesData,
      conversions: fetchConversionsData,
      all: refresh
    }
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