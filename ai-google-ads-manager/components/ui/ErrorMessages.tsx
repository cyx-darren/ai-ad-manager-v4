'use client'

import React from 'react'
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  WifiIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { AppError, ErrorType, ErrorSeverity, useError } from '@/contexts/ErrorContext'

// Props for error message components
export interface ErrorMessageProps {
  error: AppError
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
  compact?: boolean
  className?: string
}

// Main error message component
export function ErrorMessage({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  compact = false,
  className = ''
}: ErrorMessageProps) {
  const config = getErrorConfig(error.type, error.severity)
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-md ${config.bgColor} ${className}`}>
        <config.icon className={`h-4 w-4 ${config.iconColor}`} />
        <span className={`text-sm ${config.textColor} flex-1`}>
          {error.message}
        </span>
        {onRetry && error.retryCount < error.maxRetries && (
          <button
            onClick={onRetry}
            className={`text-sm ${config.actionColor} hover:opacity-80`}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${config.iconColor} hover:opacity-80`}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <config.icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${config.textColor}`}>
            {config.title}
          </h3>
          <div className={`mt-2 text-sm ${config.textColor}`}>
            <p>{error.message}</p>
          </div>
          
          {showDetails && error.details && (
            <div className="mt-3">
              <details>
                <summary className={`cursor-pointer text-sm font-medium ${config.actionColor}`}>
                  Show Details
                </summary>
                <div className={`mt-2 p-2 rounded ${config.detailsBg}`}>
                  <p className={`text-xs font-mono ${config.detailsText}`}>
                    {error.details}
                  </p>
                  <p className={`text-xs ${config.detailsText} mt-1`}>
                    Time: {new Date(error.timestamp).toLocaleString()}
                  </p>
                  {error.source && (
                    <p className={`text-xs ${config.detailsText}`}>
                      Source: {error.source}
                    </p>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && error.retryCount < error.maxRetries && (
              <button
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-2 border ${config.buttonBorder} shadow-sm text-sm leading-4 font-medium rounded-md ${config.buttonText} ${config.buttonBg} ${config.buttonHover} focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.buttonFocus}`}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Retry ({error.maxRetries - error.retryCount} left)
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Network error component
export function NetworkError({ onRetry, className = '' }: { onRetry?: () => void; className?: string }) {
  const { isOnline } = useError()
  
  if (isOnline) return null

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <WifiIcon className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            No Internet Connection
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>Please check your internet connection and try again.</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="inline-flex items-center px-3 py-2 border border-yellow-300 shadow-sm text-sm leading-4 font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Error list component for displaying multiple errors
export function ErrorList({ 
  errors, 
  showResolved = false, 
  maxDisplay = 5,
  className = '' 
}: { 
  errors: AppError[]
  showResolved?: boolean
  maxDisplay?: number
  className?: string 
}) {
  const { resolveError, retryError, clearError } = useError()
  
  const displayErrors = errors
    .filter(error => showResolved || !error.resolved)
    .slice(0, maxDisplay)

  if (displayErrors.length === 0) return null

  return (
    <div className={`space-y-3 ${className}`}>
      {displayErrors.map(error => (
        <ErrorMessage
          key={error.id}
          error={error}
          onRetry={() => retryError(error.id)}
          onDismiss={() => clearError(error.id)}
          showDetails={process.env.NODE_ENV === 'development'}
        />
      ))}
    </div>
  )
}

// Global error toast
export function ErrorToast({ error, onClose }: { error: AppError; onClose: () => void }) {
  const { retryError } = useError()
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (error.severity === 'low') {
        onClose()
      }
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [error.severity, onClose])

  const config = getErrorConfig(error.type, error.severity)

  return (
    <div className={`max-w-sm w-full ${config.bgColor} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <config.icon className={`h-6 w-6 ${config.iconColor}`} />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </p>
            <p className={`mt-1 text-sm ${config.textColor}`}>
              {error.message}
            </p>
            {error.retryCount < error.maxRetries && (
              <div className="mt-3 flex space-x-7">
                <button
                  type="button"
                  className={`bg-white rounded-md text-sm font-medium ${config.actionColor} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.buttonFocus}`}
                  onClick={() => retryError(error.id)}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className={`bg-white rounded-md inline-flex ${config.iconColor} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.buttonFocus}`}
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Error state for empty/failed data
export function ErrorState({
  title = "Something went wrong",
  message = "We encountered an error while loading this content.",
  onRetry,
  showSupport = false,
  className = ''
}: {
  title?: string
  message?: string
  onRetry?: () => void
  showSupport?: boolean
  className?: string
}) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <XCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}
        {showSupport && (
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Contact Support
          </button>
        )}
      </div>
    </div>
  )
}

// Helper function to get error configuration
function getErrorConfig(type: ErrorType, severity: ErrorSeverity) {
  const severityConfig = {
    low: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-800',
      actionColor: 'text-blue-600',
      buttonBg: 'bg-white',
      buttonText: 'text-blue-700',
      buttonBorder: 'border-blue-300',
      buttonHover: 'hover:bg-blue-50',
      buttonFocus: 'focus:ring-blue-500',
      detailsBg: 'bg-blue-100',
      detailsText: 'text-blue-700'
    },
    medium: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-800',
      actionColor: 'text-yellow-600',
      buttonBg: 'bg-white',
      buttonText: 'text-yellow-700',
      buttonBorder: 'border-yellow-300',
      buttonHover: 'hover:bg-yellow-50',
      buttonFocus: 'focus:ring-yellow-500',
      detailsBg: 'bg-yellow-100',
      detailsText: 'text-yellow-700'
    },
    high: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-400',
      textColor: 'text-red-800',
      actionColor: 'text-red-600',
      buttonBg: 'bg-white',
      buttonText: 'text-red-700',
      buttonBorder: 'border-red-300',
      buttonHover: 'hover:bg-red-50',
      buttonFocus: 'focus:ring-red-500',
      detailsBg: 'bg-red-100',
      detailsText: 'text-red-700'
    },
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-500',
      textColor: 'text-red-900',
      actionColor: 'text-red-700',
      buttonBg: 'bg-white',
      buttonText: 'text-red-800',
      buttonBorder: 'border-red-400',
      buttonHover: 'hover:bg-red-50',
      buttonFocus: 'focus:ring-red-500',
      detailsBg: 'bg-red-100',
      detailsText: 'text-red-800'
    }
  }

  const typeConfig = {
    api: { title: 'API Error', icon: ExclamationTriangleIcon },
    validation: { title: 'Validation Error', icon: InformationCircleIcon },
    authentication: { title: 'Authentication Error', icon: XCircleIcon },
    network: { title: 'Network Error', icon: WifiIcon },
    component: { title: 'Component Error', icon: ExclamationTriangleIcon },
    unknown: { title: 'Unknown Error', icon: XCircleIcon }
  }

  return {
    ...severityConfig[severity],
    ...typeConfig[type]
  }
}