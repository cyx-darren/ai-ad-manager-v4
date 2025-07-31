'use client'

import React, { useState, useEffect } from 'react'
import { 
  ClassifiedError, 
  ErrorSeverity, 
  RecoveryAction,
  AuthErrorType 
} from '@/lib/authErrorHandler'
import { useErrorRecovery } from '@/lib/errorRecoveryManager'

export interface ErrorToastProps {
  error: ClassifiedError | null
  onDismiss: () => void
  onRetry?: () => Promise<void>
  onContactSupport?: () => void
  autoHide?: boolean
  duration?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
}

interface ErrorIconProps {
  severity: ErrorSeverity
  className?: string
}

const ErrorIcon: React.FC<ErrorIconProps> = ({ severity, className = "w-5 h-5" }) => {
  const getIconColor = () => {
    switch (severity) {
      case ErrorSeverity.LOW: return 'text-blue-500'
      case ErrorSeverity.MEDIUM: return 'text-yellow-500'
      case ErrorSeverity.HIGH: return 'text-orange-500'
      case ErrorSeverity.CRITICAL: return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getIcon = () => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case ErrorSeverity.MEDIUM:
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className={`${getIconColor()} ${className}`}>
      {getIcon()}
    </div>
  )
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  onRetry,
  onContactSupport,
  autoHide = true,
  duration = 5000,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const { handleError } = useErrorRecovery()

  useEffect(() => {
    if (error) {
      setIsVisible(true)
      
      if (autoHide && error.severity === ErrorSeverity.LOW) {
        const timer = setTimeout(() => {
          handleDismiss()
        }, duration)
        
        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [error, autoHide, duration])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300) // Wait for animation
  }

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return
    
    try {
      setIsRetrying(true)
      await onRetry()
      handleDismiss()
    } catch (retryError) {
      console.error('Retry failed:', retryError)
      // Could show retry failed message here
    } finally {
      setIsRetrying(false)
    }
  }

  const handleAutoRecovery = async () => {
    if (!error || isRetrying) return
    
    try {
      setIsRetrying(true)
      const result = await handleError(error.originalError)
      
      if (result.recovered) {
        handleDismiss()
      }
    } catch (recoveryError) {
      console.error('Auto recovery failed:', recoveryError)
    } finally {
      setIsRetrying(false)
    }
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left': return 'top-4 left-4'
      case 'top-center': return 'top-4 left-1/2 transform -translate-x-1/2'
      case 'top-right': return 'top-4 right-4'
      case 'bottom-left': return 'bottom-4 left-4'
      case 'bottom-right': return 'bottom-4 right-4'
      default: return 'top-4 right-4'
    }
  }

  const getSeverityStyles = () => {
    if (!error) return ''
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case ErrorSeverity.HIGH:
        return 'bg-orange-50 border-orange-200 text-orange-800'
      case ErrorSeverity.CRITICAL:
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getSeverityTitle = () => {
    if (!error) return 'Error'
    
    switch (error.severity) {
      case ErrorSeverity.LOW: return 'Notice'
      case ErrorSeverity.MEDIUM: return 'Warning'
      case ErrorSeverity.HIGH: return 'Error'
      case ErrorSeverity.CRITICAL: return 'Critical Error'
      default: return 'Error'
    }
  }

  const shouldShowRetry = () => {
    return error?.isRecoverable && (
      error.recoveryStrategy.action === RecoveryAction.RETRY ||
      error.recoveryStrategy.action === RecoveryAction.REFRESH_TOKEN ||
      onRetry
    )
  }

  const shouldShowContactSupport = () => {
    return error?.recoveryStrategy.action === RecoveryAction.CONTACT_SUPPORT ||
           error?.severity === ErrorSeverity.CRITICAL ||
           onContactSupport
  }

  const getRetryButtonText = () => {
    if (!error) return 'Retry'
    
    switch (error.recoveryStrategy.action) {
      case RecoveryAction.REFRESH_TOKEN: return 'Refresh Session'
      case RecoveryAction.RETRY: return 'Try Again'
      default: return 'Retry'
    }
  }

  if (!error || !isVisible) return null

  return (
    <div className={`fixed ${getPositionClasses()} max-w-sm w-full z-50 transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className={`rounded-lg border shadow-lg p-4 ${getSeverityStyles()}`}>
        <div className="flex items-start">
          <ErrorIcon severity={error.severity} className="mt-0.5 mr-3" />
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold mb-1">
              {getSeverityTitle()}
            </h4>
            
            <p className="text-sm mb-3">
              {error.userMessage}
            </p>
            
            {/* Technical details for development */}
            {process.env.NODE_ENV === 'development' && error.technicalDetails && (
              <details className="mb-3">
                <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                  Technical Details
                </summary>
                <p className="text-xs mt-1 font-mono opacity-75">
                  {error.technicalDetails}
                </p>
              </details>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                {shouldShowRetry() && (
                  <button
                    onClick={onRetry ? handleRetry : handleAutoRecovery}
                    disabled={isRetrying}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors disabled:opacity-50"
                  >
                    {isRetrying && (
                      <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent mr-1"></div>
                    )}
                    {getRetryButtonText()}
                  </button>
                )}
                
                {shouldShowContactSupport() && (
                  <button
                    onClick={onContactSupport}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 110 19.5 9.75 9.75 0 010-19.5z" />
                    </svg>
                    Contact Support
                  </button>
                )}
              </div>
              
              <button
                onClick={handleDismiss}
                className="p-1 rounded hover:bg-current hover:bg-opacity-10 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toast container for managing multiple toasts
interface ErrorToastContainerProps {
  errors: ClassifiedError[]
  onDismiss: (errorId: string) => void
  onRetry?: (error: ClassifiedError) => Promise<void>
  onContactSupport?: (error: ClassifiedError) => void
  maxToasts?: number
}

export const ErrorToastContainer: React.FC<ErrorToastContainerProps> = ({
  errors,
  onDismiss,
  onRetry,
  onContactSupport,
  maxToasts = 3
}) => {
  // Show only the most recent errors
  const visibleErrors = errors.slice(-maxToasts)

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {visibleErrors.map((error, index) => (
        <ErrorToast
          key={`${error.type}_${error.timestamp}`}
          error={error}
          onDismiss={() => onDismiss(`${error.type}_${error.timestamp}`)}
          onRetry={onRetry ? () => onRetry(error) : undefined}
          onContactSupport={onContactSupport ? () => onContactSupport(error) : undefined}
          autoHide={error.severity === ErrorSeverity.LOW}
          position="top-right"
        />
      ))}
    </div>
  )
}

// Hook for managing error toasts
export function useErrorToasts() {
  const [errors, setErrors] = useState<ClassifiedError[]>([])

  const addError = (error: ClassifiedError) => {
    setErrors(prev => [...prev, error])
  }

  const removeError = (errorId: string) => {
    setErrors(prev => prev.filter(error => `${error.type}_${error.timestamp}` !== errorId))
  }

  const clearAll = () => {
    setErrors([])
  }

  return {
    errors,
    addError,
    removeError,
    clearAll
  }
}

export default ErrorToast