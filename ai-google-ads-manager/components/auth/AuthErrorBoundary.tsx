'use client'

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { getAuthDevTools } from '@/lib/authDevTools'
import { 
  classifyAuthError, 
  ClassifiedError, 
  ErrorSeverity, 
  RecoveryAction 
} from '@/lib/authErrorHandler'
import { 
  ErrorRecoveryManager, 
  RecoveryManagerOptions 
} from '@/lib/errorRecoveryManager'
import ErrorToast from './ErrorToast'

interface AuthErrorBoundaryState {
  hasError: boolean
  error: Error | null
  classifiedError: ClassifiedError | null
  errorInfo: ErrorInfo | null
  retryCount: number
  isRecovering: boolean
  showToast: boolean
}

interface AuthErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: ClassifiedError, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo, classifiedError: ClassifiedError) => void
  maxRetries?: number
  recoverOnPropsChange?: boolean
  showDevDetails?: boolean
  enableAutoRecovery?: boolean
  showErrorToasts?: boolean
  recoveryOptions?: RecoveryManagerOptions
}

interface AuthErrorContext {
  type: 'AUTH_FAILURE' | 'TOKEN_EXPIRED' | 'NETWORK_ERROR' | 'UNKNOWN'
  severity: 'low' | 'medium' | 'high' | 'critical'
  canRecover: boolean
  userAction?: string
}

class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = []
  private devTools = getAuthDevTools()
  private recoveryManager: ErrorRecoveryManager

  constructor(props: AuthErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      classifiedError: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      showToast: false
    }

    // Initialize recovery manager
    this.recoveryManager = new ErrorRecoveryManager({
      maxGlobalRetries: this.props.maxRetries || 3,
      enableAutoRecovery: this.props.enableAutoRecovery ?? true,
      onRecoveryAttempt: (attempt) => {
        this.devTools.addNotification({
          type: 'info',
          title: 'Recovery Attempt',
          message: `Attempting recovery: ${attempt.action} (${attempt.attempt})`
        })
      },
      onRecoverySuccess: (error, attempts) => {
        this.devTools.addNotification({
          type: 'success',
          title: 'Recovery Successful',
          message: `Error recovered after ${attempts.length} attempts`
        })
        this.resetErrorState()
      },
      onRecoveryFailed: (error, attempts) => {
        this.devTools.addNotification({
          type: 'error',
          title: 'Recovery Failed',
          message: `Unable to recover from ${error.type} after ${attempts.length} attempts`
        })
      },
      onCriticalError: (error) => {
        this.devTools.addNotification({
          type: 'error',
          title: 'Critical Error',
          message: `Critical authentication error: ${error.userMessage}`
        })
      },
      ...this.props.recoveryOptions
    })
  }

  static getDerivedStateFromError(error: Error): Partial<AuthErrorBoundaryState> {
    return {
      hasError: true,
      error,
      isRecovering: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Classify the error using Phase C system
    const classifiedError = classifyAuthError(error, {
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      action: 'error_boundary_catch',
      componentStack: errorInfo.componentStack
    })

    // Update state with error details
    this.setState({
      errorInfo,
      classifiedError,
      retryCount: this.state.retryCount + 1,
      showToast: this.props.showErrorToasts ?? true
    })

    // Log error to dev tools
    this.logErrorToDevTools(classifiedError, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, classifiedError)
    }

    // Attempt automatic recovery if enabled
    if (this.props.enableAutoRecovery ?? true) {
      this.attemptRecovery(classifiedError)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Auth Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Classified Error:', classifiedError)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  componentDidUpdate(prevProps: AuthErrorBoundaryProps) {
    // Reset error state when props change (potential recovery)
    if (this.props.recoverOnPropsChange && 
        this.state.hasError && 
        prevProps.children !== this.props.children) {
      this.resetErrorState()
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
  }

  private async attemptRecovery(classifiedError: ClassifiedError) {
    if (!classifiedError.isRecoverable) return

    try {
      this.setState({ isRecovering: true })
      
      const result = await this.recoveryManager.handleError(
        classifiedError.originalError,
        { 
          route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
          action: 'error_boundary_recovery'
        }
      )

      if (!result.recovered) {
        this.setState({ isRecovering: false })
      }
      // If recovery succeeded, resetErrorState is called via onRecoverySuccess
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError)
      this.setState({ isRecovering: false })
    }
  }

  private logErrorToDevTools(classifiedError: ClassifiedError, errorInfo: ErrorInfo) {
    const context = this.analyzeAuthError(classifiedError.originalError || new Error(classifiedError.message))
    
    this.devTools.addNotification({
      type: classifiedError.severity === ErrorSeverity.CRITICAL ? 'error' : 'warning',
      title: `Auth Error: ${classifiedError.type}`,
      message: classifiedError.userMessage,
      actions: classifiedError.isRecoverable ? [
        { label: 'Retry', action: () => this.handleRetry() },
        { label: 'Reset', action: () => this.resetErrorState() }
      ] : [
        { label: 'Reset', action: () => this.resetErrorState() }
      ]
    })

    // Log detailed error to console for debugging
    console.error('Auth Error Context:', {
      originalError: classifiedError.originalError?.message,
      classifiedType: classifiedError.type,
      severity: classifiedError.severity,
      isRecoverable: classifiedError.isRecoverable,
      recoveryAction: classifiedError.recoveryStrategy.action,
      userMessage: classifiedError.userMessage,
      technicalDetails: classifiedError.technicalDetails,
      retryCount: this.state.retryCount,
      componentStack: errorInfo.componentStack,
      legacyContext: context
    })
  }

  // Keep backward compatibility with legacy error analysis
  private analyzeAuthError(error: Error): AuthErrorContext {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // Auth-specific error patterns
    if (message.includes('token') && (message.includes('expired') || message.includes('invalid'))) {
      return {
        type: 'TOKEN_EXPIRED',
        severity: 'medium',
        canRecover: true,
        userAction: 'Please refresh your session or sign in again.'
      }
    }

    if (message.includes('auth') && (message.includes('failed') || message.includes('unauthorized'))) {
      return {
        type: 'AUTH_FAILURE',
        severity: 'high',
        canRecover: true,
        userAction: 'Please check your credentials and try signing in again.'
      }
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        type: 'NETWORK_ERROR',
        severity: 'medium',
        canRecover: true,
        userAction: 'Please check your internet connection and try again.'
      }
    }

    // Check component stack for auth-related components
    if (stack.includes('auth') || stack.includes('login') || stack.includes('token')) {
      return {
        type: 'AUTH_FAILURE',
        severity: 'medium',
        canRecover: true,
        userAction: 'An authentication error occurred. Please try again.'
      }
    }

    return {
      type: 'UNKNOWN',
      severity: 'low',
      canRecover: false,
      userAction: 'An unexpected error occurred. Please refresh the page.'
    }
  }

  private handleRetry = async () => {
    const { classifiedError } = this.state
    if (!classifiedError) return

    const maxRetries = this.props.maxRetries || 3

    if (this.state.retryCount >= maxRetries) {
      this.devTools.addNotification({
        type: 'error',
        title: 'Max Retries Reached',
        message: 'Unable to recover from authentication error. Please refresh the page.',
      })
      return
    }

    try {
      await this.attemptRecovery(classifiedError)
    } catch (error) {
      console.error('Manual retry failed:', error)
    }
  }

  private resetErrorState = () => {
    this.setState({
      hasError: false,
      error: null,
      classifiedError: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      showToast: false
    })

    this.devTools.addNotification({
      type: 'success',
      title: 'Error Boundary Reset',
      message: 'Authentication error boundary has been reset.'
    })
  }

  private handleContactSupport = () => {
    const { classifiedError } = this.state
    if (!classifiedError) return

    // Could integrate with support systems here
    console.log('Contact support requested for error:', {
      type: classifiedError.type,
      message: classifiedError.message,
      timestamp: classifiedError.timestamp
    })

    // For now, show an alert with error details
    alert(`Error ID: ${classifiedError.type}_${classifiedError.timestamp}\n\nPlease contact support with this error ID.`)
  }

  private renderErrorFallback(): ReactNode {
    const { classifiedError, error } = this.state
    const legacyContext = error ? this.analyzeAuthError(error) : null

    // Use custom fallback if provided
    if (this.props.fallback && classifiedError) {
      return this.props.fallback(classifiedError, this.handleRetry)
    }

    // Use classified error data or fall back to legacy analysis
    const errorType = classifiedError?.type || legacyContext?.type || 'UNKNOWN'
    const userMessage = classifiedError?.userMessage || legacyContext?.userAction || 'An unexpected error occurred.'
    const isRecoverable = classifiedError?.isRecoverable ?? legacyContext?.canRecover ?? false
    const severity = classifiedError?.severity || ErrorSeverity.MEDIUM

    return (
      <>
        {/* Error Toast */}
        {this.state.showToast && classifiedError && (
          <ErrorToast
            error={classifiedError}
            onDismiss={() => this.setState({ showToast: false })}
            onRetry={isRecoverable ? this.handleRetry : undefined}
            onContactSupport={this.handleContactSupport}
            autoHide={false}
            position="top-center"
          />
        )}

        {/* Main Error UI */}
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              {/* Error icon */}
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${
                severity === ErrorSeverity.CRITICAL ? 'bg-red-100' :
                severity === ErrorSeverity.HIGH ? 'bg-orange-100' :
                severity === ErrorSeverity.MEDIUM ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
                <svg
                  className={`h-6 w-6 ${
                    severity === ErrorSeverity.CRITICAL ? 'text-red-600' :
                    severity === ErrorSeverity.HIGH ? 'text-orange-600' :
                    severity === ErrorSeverity.MEDIUM ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              {/* Error title */}
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {errorType === 'AUTH_FAILURE' && 'Authentication Error'}
                {errorType === 'TOKEN_EXPIRED' && 'Session Expired'}
                {errorType === 'NETWORK_ERROR' && 'Connection Error'}
                {errorType === 'INVALID_CREDENTIALS' && 'Invalid Credentials'}
                {errorType === 'INSUFFICIENT_PERMISSIONS' && 'Access Denied'}
                {errorType === 'RATE_LIMITED' && 'Too Many Requests'}
                {errorType === 'SERVICE_UNAVAILABLE' && 'Service Unavailable'}
                {errorType === 'UNKNOWN' && 'Something went wrong'}
                {!['AUTH_FAILURE', 'TOKEN_EXPIRED', 'NETWORK_ERROR', 'INVALID_CREDENTIALS', 
                    'INSUFFICIENT_PERMISSIONS', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'UNKNOWN'].includes(errorType) && 
                  'Application Error'}
              </h2>

              {/* Error message */}
              <p className="mt-2 text-sm text-gray-600">
                {userMessage}
              </p>

              {/* Development details */}
              {(this.props.showDevDetails || process.env.NODE_ENV === 'development') && classifiedError && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Developer Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded-md text-xs font-mono text-gray-800 overflow-auto max-h-32">
                    <div><strong>Error Type:</strong> {classifiedError.type}</div>
                    <div><strong>Severity:</strong> {classifiedError.severity}</div>
                    <div><strong>Recoverable:</strong> {classifiedError.isRecoverable ? 'Yes' : 'No'}</div>
                    <div><strong>Recovery Action:</strong> {classifiedError.recoveryStrategy.action}</div>
                    <div><strong>Retry Count:</strong> {this.state.retryCount}</div>
                    <div><strong>Timestamp:</strong> {new Date(classifiedError.timestamp).toISOString()}</div>
                    {classifiedError.technicalDetails && (
                      <div><strong>Technical:</strong> {classifiedError.technicalDetails}</div>
                    )}
                    {classifiedError.originalError?.stack && (
                      <div><strong>Stack:</strong> {classifiedError.originalError.stack}</div>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              {isRecoverable && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRecovering}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {this.state.isRecovering ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Recovering...
                    </>
                  ) : (
                    `Try Again (${this.state.retryCount}/${this.props.maxRetries || 3})`
                  )}
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Refresh Page
              </button>

              <button
                onClick={this.resetErrorState}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reset Error Boundary
              </button>

              {(severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) && (
                <button
                  onClick={this.handleContactSupport}
                  className="w-full flex justify-center py-2 px-4 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Contact Support
                </button>
              )}
            </div>

            {/* Support info */}
            <div className="text-center text-xs text-gray-500">
              {classifiedError ? (
                <>Error ID: {classifiedError.type}_{classifiedError.timestamp}</>
              ) : (
                <>Error ID: {error?.message.slice(0, 10)}...</>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderErrorFallback()
    }

    return this.props.children
  }
}

export default AuthErrorBoundary
export type { AuthErrorBoundaryProps, AuthErrorContext }