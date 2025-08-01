'use client'

import React, { Component, ReactNode } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

// Error info interface for better error tracking
export interface ErrorInfo {
  errorMessage: string
  errorStack?: string
  componentStack?: string
  timestamp: string
  userAgent?: string
  url?: string
}

// Props for error boundary components
export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
  level?: 'component' | 'widget' | 'page' | 'app'
}

// State for error boundary
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

// Generic Error Boundary Component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const enhancedErrorInfo: ErrorInfo = {
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    }

    this.setState({
      errorInfo: enhancedErrorInfo
    })

    // Call custom error handler if provided
    this.props.onError?.(error, enhancedErrorInfo)

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught error:', error)
      console.error('Error Info:', enhancedErrorInfo)
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback based on error level
      return this.renderDefaultFallback()
    }

    return this.props.children
  }

  private renderDefaultFallback() {
    const { level = 'component', showDetails = false } = this.props
    const { error, errorInfo, retryCount } = this.state
    const canRetry = retryCount < this.maxRetries

    const levelConfig = {
      component: {
        title: 'Component Error',
        description: 'This component encountered an error and could not be displayed.',
        className: 'p-4 border border-red-200 rounded-lg bg-red-50'
      },
      widget: {
        title: 'Widget Error',
        description: 'This widget encountered an error and could not load properly.',
        className: 'p-6 border border-red-200 rounded-lg bg-red-50'
      },
      page: {
        title: 'Page Error',
        description: 'This page encountered an error and could not be displayed.',
        className: 'min-h-96 p-8 border border-red-200 rounded-lg bg-red-50'
      },
      app: {
        title: 'Application Error',
        description: 'The application encountered an unexpected error.',
        className: 'min-h-screen p-8 bg-red-50 flex items-center justify-center'
      }
    }

    const config = levelConfig[level]

    return (
      <div className={config.className}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {config.title}
            </h3>
            <p className="text-red-700 mb-4">
              {config.description}
            </p>
            
            <div className="flex gap-3 mb-4">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Try Again ({this.maxRetries - retryCount} left)
                </button>
              )}
              <button
                onClick={this.handleReset}
                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Reset
              </button>
            </div>

            {showDetails && error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-red-700 hover:text-red-800">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-red-100 rounded-md">
                  <p className="text-sm text-red-800 font-mono">
                    <strong>Error:</strong> {error.message}
                  </p>
                  {errorInfo?.timestamp && (
                    <p className="text-sm text-red-700 mt-1">
                      <strong>Time:</strong> {new Date(errorInfo.timestamp).toLocaleString()}
                    </p>
                  )}
                  {retryCount > 0 && (
                    <p className="text-sm text-red-700 mt-1">
                      <strong>Retry Attempts:</strong> {retryCount}
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    )
  }
}

// Specialized Chart Error Boundary
export const ChartErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="widget" />
)

// Specialized Dashboard Error Boundary
export const DashboardErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="page" />
)

// Specialized Component Error Boundary
export const ComponentErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="component" />
)

// App-level Error Boundary
export const AppErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="app" showDetails={process.env.NODE_ENV === 'development'} />
)

// Hook for manual error throwing (useful for testing)
export const useThrowError = () => {
  return (error: string | Error) => {
    throw error instanceof Error ? error : new Error(error)
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return WithErrorBoundaryComponent
}