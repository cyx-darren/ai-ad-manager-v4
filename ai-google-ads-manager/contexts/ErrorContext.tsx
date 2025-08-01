'use client'

import React, { createContext, useContext, useCallback, useReducer, ReactNode } from 'react'
import { ErrorInfo } from '@/components/ui/ErrorBoundaries'

// Error types
export type ErrorType = 'api' | 'validation' | 'authentication' | 'network' | 'component' | 'unknown'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AppError {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  details?: string
  timestamp: string
  source?: string
  resolved: boolean
  retryCount: number
  maxRetries: number
  metadata?: Record<string, any>
}

// Error context state
interface ErrorContextState {
  errors: AppError[]
  globalError: AppError | null
  isOnline: boolean
  retryQueue: string[]
}

// Error context actions
type ErrorAction = 
  | { type: 'ADD_ERROR'; payload: Omit<AppError, 'id' | 'timestamp' | 'resolved' | 'retryCount'> }
  | { type: 'RESOLVE_ERROR'; payload: { id: string } }
  | { type: 'RETRY_ERROR'; payload: { id: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'CLEAR_ERROR'; payload: { id: string } }
  | { type: 'SET_GLOBAL_ERROR'; payload: AppError | null }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'ADD_TO_RETRY_QUEUE'; payload: string }
  | { type: 'REMOVE_FROM_RETRY_QUEUE'; payload: string }

// Error context type
interface ErrorContextType {
  state: ErrorContextState
  addError: (error: Omit<AppError, 'id' | 'timestamp' | 'resolved' | 'retryCount'>) => string
  resolveError: (id: string) => void
  retryError: (id: string) => void
  clearErrors: () => void
  clearError: (id: string) => void
  setGlobalError: (error: AppError | null) => void
  addApiError: (message: string, details?: string, source?: string) => string
  addValidationError: (message: string, details?: string, source?: string) => string
  addNetworkError: (message: string, details?: string, source?: string) => string
  addAuthError: (message: string, details?: string, source?: string) => string
  isOnline: boolean
  hasErrors: boolean
  hasUnresolvedErrors: boolean
  criticalErrors: AppError[]
  getErrorsByType: (type: ErrorType) => AppError[]
  getErrorById: (id: string) => AppError | undefined
}

// Initial state
const initialState: ErrorContextState = {
  errors: [],
  globalError: null,
  isOnline: true,
  retryQueue: []
}

// Error reducer
function errorReducer(state: ErrorContextState, action: ErrorAction): ErrorContextState {
  switch (action.type) {
    case 'ADD_ERROR':
      const newError: AppError = {
        ...action.payload,
        id: generateErrorId(),
        timestamp: new Date().toISOString(),
        resolved: false,
        retryCount: 0
      }
      return {
        ...state,
        errors: [...state.errors, newError]
      }

    case 'RESOLVE_ERROR':
      return {
        ...state,
        errors: state.errors.map(error =>
          error.id === action.payload.id
            ? { ...error, resolved: true }
            : error
        )
      }

    case 'RETRY_ERROR':
      return {
        ...state,
        errors: state.errors.map(error =>
          error.id === action.payload.id
            ? { ...error, retryCount: error.retryCount + 1 }
            : error
        )
      }

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
        globalError: null
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload.id),
        globalError: state.globalError?.id === action.payload.id ? null : state.globalError
      }

    case 'SET_GLOBAL_ERROR':
      return {
        ...state,
        globalError: action.payload
      }

    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload
      }

    case 'ADD_TO_RETRY_QUEUE':
      return {
        ...state,
        retryQueue: [...state.retryQueue, action.payload]
      }

    case 'REMOVE_FROM_RETRY_QUEUE':
      return {
        ...state,
        retryQueue: state.retryQueue.filter(id => id !== action.payload)
      }

    default:
      return state
  }
}

// Generate unique error ID
function generateErrorId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Create context
const ErrorContext = createContext<ErrorContextType | null>(null)

// Error provider component
export function ErrorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(errorReducer, initialState)

  // Add error
  const addError = useCallback((error: Omit<AppError, 'id' | 'timestamp' | 'resolved' | 'retryCount'>) => {
    dispatch({ type: 'ADD_ERROR', payload: error })
    const id = generateErrorId()
    
    // Auto-resolve low severity errors after 5 seconds
    if (error.severity === 'low') {
      setTimeout(() => {
        dispatch({ type: 'RESOLVE_ERROR', payload: { id } })
      }, 5000)
    }
    
    return id
  }, [])

  // Helper functions for specific error types
  const addApiError = useCallback((message: string, details?: string, source?: string) => {
    return addError({
      type: 'api',
      severity: 'medium',
      message,
      details,
      source,
      maxRetries: 3
    })
  }, [addError])

  const addValidationError = useCallback((message: string, details?: string, source?: string) => {
    return addError({
      type: 'validation',
      severity: 'low',
      message,
      details,
      source,
      maxRetries: 0
    })
  }, [addError])

  const addNetworkError = useCallback((message: string, details?: string, source?: string) => {
    return addError({
      type: 'network',
      severity: 'high',
      message,
      details,
      source,
      maxRetries: 5
    })
  }, [addError])

  const addAuthError = useCallback((message: string, details?: string, source?: string) => {
    return addError({
      type: 'authentication',
      severity: 'critical',
      message,
      details,
      source,
      maxRetries: 1
    })
  }, [addError])

  // Other actions
  const resolveError = useCallback((id: string) => {
    dispatch({ type: 'RESOLVE_ERROR', payload: { id } })
  }, [])

  const retryError = useCallback((id: string) => {
    dispatch({ type: 'RETRY_ERROR', payload: { id } })
  }, [])

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' })
  }, [])

  const clearError = useCallback((id: string) => {
    dispatch({ type: 'CLEAR_ERROR', payload: { id } })
  }, [])

  const setGlobalError = useCallback((error: AppError | null) => {
    dispatch({ type: 'SET_GLOBAL_ERROR', payload: error })
  }, [])

  // Computed values
  const hasErrors = state.errors.length > 0
  const hasUnresolvedErrors = state.errors.some(error => !error.resolved)
  const criticalErrors = state.errors.filter(error => error.severity === 'critical' && !error.resolved)

  const getErrorsByType = useCallback((type: ErrorType) => {
    return state.errors.filter(error => error.type === type)
  }, [state.errors])

  const getErrorById = useCallback((id: string) => {
    return state.errors.find(error => error.id === id)
  }, [state.errors])

  // Monitor online status
  React.useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true })
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-retry network errors when coming back online
  React.useEffect(() => {
    if (state.isOnline && state.retryQueue.length > 0) {
      // Process retry queue
      state.retryQueue.forEach(errorId => {
        const error = getErrorById(errorId)
        if (error && error.retryCount < error.maxRetries) {
          retryError(errorId)
        }
        dispatch({ type: 'REMOVE_FROM_RETRY_QUEUE', payload: errorId })
      })
    }
  }, [state.isOnline, state.retryQueue, getErrorById, retryError])

  const contextValue: ErrorContextType = {
    state,
    addError,
    resolveError,
    retryError,
    clearErrors,
    clearError,
    setGlobalError,
    addApiError,
    addValidationError,
    addNetworkError,
    addAuthError,
    isOnline: state.isOnline,
    hasErrors,
    hasUnresolvedErrors,
    criticalErrors,
    getErrorsByType,
    getErrorById
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )
}

// Hook to use error context
export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

// Hook for error boundary integration
export function useErrorBoundaryHandler() {
  const { addError } = useError()

  return useCallback((error: Error, errorInfo: ErrorInfo) => {
    addError({
      type: 'component',
      severity: 'high',
      message: error.message,
      details: error.stack,
      source: 'ErrorBoundary',
      maxRetries: 2,
      metadata: {
        componentStack: errorInfo.componentStack,
        userAgent: errorInfo.userAgent,
        url: errorInfo.url
      }
    })
  }, [addError])
}