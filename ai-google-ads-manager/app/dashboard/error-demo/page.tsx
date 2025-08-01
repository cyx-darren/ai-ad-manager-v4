'use client'

import React, { useState, useCallback } from 'react'
import { 
  ExclamationTriangleIcon, 
  WifiIcon, 
  ArrowPathIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline'

// Phase 4 imports
import { ErrorBoundary, ChartErrorBoundary, useThrowError } from '@/components/ui/ErrorBoundaries'
import { useError } from '@/contexts/ErrorContext'
import { 
  ErrorMessage, 
  ErrorList, 
  ErrorToast, 
  NetworkError, 
  ErrorState 
} from '@/components/ui/ErrorMessages'
import { useRetry, RETRY_CONFIGS } from '@/utils/retryUtils'
import { useErrorRecovery, errorRecoveryUtils } from '@/hooks/useErrorRecovery'
import { getFallbackData, FALLBACK_CONFIGS } from '@/utils/fallbackData'
import { sampleData } from '@/components/dashboard/sampleData'

export default function ErrorDemoPage() {
  const { 
    addError, 
    addApiError, 
    addNetworkError, 
    addAuthError,
    clearErrors,
    state,
    isOnline 
  } = useError()
  
  const throwError = useThrowError()
  const [showToast, setShowToast] = useState(false)
  const [componentError, setComponentError] = useState(false)

  // Demo API operation that can fail
  const demoApiOperation = useCallback(async () => {
    const shouldFail = Math.random() > 0.7 // 30% success rate
    
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate delay
    
    if (shouldFail) {
      throw new Error('Simulated API failure')
    }
    
    return { message: 'API call successful!', timestamp: new Date().toISOString() }
  }, [])

  // Error recovery demo
  const recovery = useErrorRecovery(
    demoApiOperation,
    'demo_api_data',
    { message: 'Sample data', timestamp: '' },
    errorRecoveryUtils.dashboardWidget
  )

  // Retry demo
  const retryDemo = useRetry(demoApiOperation, RETRY_CONFIGS.user)

  // Demo error handlers
  const handleAddApiError = () => {
    addApiError('Failed to fetch analytics data', 'Server returned 500 error', 'Demo')
  }

  const handleAddNetworkError = () => {
    addNetworkError('Connection timeout', 'Request timed out after 10 seconds', 'Demo')
  }

  const handleAddAuthError = () => {
    addAuthError('Authentication failed', 'Token has expired', 'Demo')
  }

  const handleThrowComponentError = () => {
    setComponentError(true)
  }

  const handleShowToast = () => {
    const errorId = addError({
      type: 'validation',
      severity: 'medium',
      message: 'Form validation failed',
      details: 'Please check your input and try again',
      source: 'Demo',
      maxRetries: 1
    })
    setShowToast(true)
  }

  // Component that throws errors for demo
  const ErrorThrowingComponent = () => {
    if (componentError) {
      throwError('This is a demo component error!')
    }
    return <div className="p-4 bg-green-50 rounded">Component working normally</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Phase 4: Error Handling Demo
          </h1>
          <p className="text-gray-600">
            Comprehensive error handling, recovery mechanisms, and fallback strategies
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Error Context Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Error Context Management
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAddApiError}
                  className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
                >
                  Add API Error
                </button>
                <button
                  onClick={handleAddNetworkError}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Add Network Error
                </button>
                <button
                  onClick={handleAddAuthError}
                  className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                >
                  Add Auth Error
                </button>
                <button
                  onClick={clearErrors}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Clear All
                </button>
              </div>

              {/* Network Status */}
              <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50">
                <WifiIcon className={`h-5 w-5 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm">
                  Status: {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Error List */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Active Errors ({state.errors.length})
                </h3>
                <ErrorList 
                  errors={state.errors} 
                  maxDisplay={3}
                  className="space-y-2"
                />
                {state.errors.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No active errors</p>
                )}
              </div>
            </div>
          </div>

          {/* Error Boundaries Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Error Boundaries
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={handleThrowComponentError}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Trigger Component Error
                </button>
                <button
                  onClick={() => setComponentError(false)}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  Reset Component
                </button>
              </div>

              <ChartErrorBoundary>
                <ErrorThrowingComponent />
              </ChartErrorBoundary>
            </div>
          </div>

          {/* Error Recovery Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Error Recovery System
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={recovery.execute}
                  disabled={recovery.loading}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1"
                >
                  <PlayIcon className="h-4 w-4" />
                  Execute API Call
                </button>
                <button
                  onClick={recovery.retry}
                  disabled={!recovery.canRetry || recovery.loading}
                  className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm flex items-center gap-1"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Manual Retry
                </button>
                <button
                  onClick={recovery.useFallback}
                  disabled={!recovery.canUseFallback}
                  className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  Use Fallback
                </button>
                <button
                  onClick={recovery.reset}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Reset
                </button>
              </div>

              {/* Recovery Status */}
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Status: {recovery.loading ? 'Loading' : 'Idle'}</div>
                  <div>Retries: {recovery.retryCount}</div>
                  <div>Recovery: {recovery.recoveryMethod}</div>
                  <div>Confidence: {Math.round(recovery.confidence * 100)}%</div>
                  <div>Fallback Used: {recovery.fallbackUsed ? 'Yes' : 'No'}</div>
                  <div>Auto-Retrying: {recovery.isAutoRetrying ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {/* Recovery Result */}
              {recovery.data && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-800">Success!</p>
                  <p className="text-sm text-green-700">
                    {recovery.data.message}
                  </p>
                </div>
              )}

              {recovery.error && !recovery.fallbackUsed && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">
                    {recovery.error.message}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Retry Utilities Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Retry Mechanisms
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={retryDemo.execute}
                  disabled={retryDemo.loading}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center gap-1"
                >
                  <PlayIcon className="h-4 w-4" />
                  Start Retry Demo
                </button>
                <button
                  onClick={retryDemo.reset}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Reset
                </button>
              </div>

              {/* Retry Status */}
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Loading: {retryDemo.loading ? 'Yes' : 'No'}</div>
                  <div>Attempts: {retryDemo.attempts}</div>
                  <div>Retrying: {retryDemo.isRetrying ? 'Yes' : 'No'}</div>
                  <div>Last Attempt: {retryDemo.lastAttemptTime ? new Date(retryDemo.lastAttemptTime).toLocaleTimeString() : 'None'}</div>
                </div>
              </div>

              {/* Retry Result */}
              {retryDemo.data && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-800">Retry Success!</p>
                  <p className="text-sm text-green-700">
                    {retryDemo.data.message} (after {retryDemo.attempts} attempts)
                  </p>
                </div>
              )}

              {retryDemo.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-800">Retry Failed</p>
                  <p className="text-sm text-red-700">
                    {retryDemo.error.message} (after {retryDemo.attempts} attempts)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Messages Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Error Message Components
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={handleShowToast}
                className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
              >
                Show Error Toast
              </button>

              {/* Sample Error Messages */}
              <div className="space-y-3">
                <ErrorMessage
                  error={{
                    id: 'demo-1',
                    type: 'api',
                    severity: 'medium',
                    message: 'Failed to load dashboard data',
                    details: 'The server is temporarily unavailable. Please try again.',
                    timestamp: new Date().toISOString(),
                    resolved: false,
                    retryCount: 1,
                    maxRetries: 3,
                    source: 'Demo'
                  }}
                  onRetry={() => alert('Retry clicked!')}
                  onDismiss={() => alert('Dismiss clicked!')}
                  showDetails={true}
                />

                <NetworkError onRetry={() => alert('Network retry clicked!')} />

                <ErrorState
                  title="Demo Error State"
                  message="This is how error states look in empty components"
                  onRetry={() => alert('Error state retry clicked!')}
                  showSupport={true}
                />
              </div>
            </div>
          </div>

          {/* Fallback Data Demo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Fallback Data Strategies
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(FALLBACK_CONFIGS).map(([strategy, config]) => {
                const fallbackResult = getFallbackData(
                  `demo_${strategy}`,
                  sampleData.trafficSources.slice(0, 3),
                  config
                )

                return (
                  <div key={strategy} className="p-4 border border-gray-200 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2 capitalize">
                      {strategy} Strategy
                    </h3>
                    <div className="text-sm space-y-1">
                      <div>Source: {fallbackResult.source}</div>
                      <div>Confidence: {Math.round(fallbackResult.confidence * 100)}%</div>
                      <div>Stale: {fallbackResult.isStale ? 'Yes' : 'No'}</div>
                      <div>Items: {fallbackResult.data.length}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {showToast && state.errors.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <ErrorToast
            error={state.errors[state.errors.length - 1]}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  )
}