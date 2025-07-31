'use client'

import React from 'react'
import { useDashboard } from '@/contexts/DashboardContext'

export const DashboardContextTest: React.FC = () => {
  const {
    state,
    setPresetDateRange,
    toggleGoogleAdsHighlight,
    setGlobalLoading,
    setError,
    clearErrors,
    refresh
  } = useDashboard()

  return (
    <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🧪 Dashboard Context Test Component
      </h3>
      
      {/* Current State Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h4 className="font-medium text-gray-700 mb-2">Date Range</h4>
          <div className="text-sm text-gray-600">
            <p>Start: {state.dateRange.startDate}</p>
            <p>End: {state.dateRange.endDate}</p>
            <p>Preset: {state.dateRange.preset || 'custom'}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h4 className="font-medium text-gray-700 mb-2">Filters</h4>
          <div className="text-sm text-gray-600">
            <p>Google Ads Highlight: {state.filters.highlightGoogleAds ? '✅' : '❌'}</p>
            <p>Traffic Sources: {state.filters.trafficSources.length}</p>
            <p>Device Categories: {state.filters.deviceCategories.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h4 className="font-medium text-gray-700 mb-2">Loading States</h4>
          <div className="text-sm text-gray-600">
            <p>Global: {state.loading.global ? '🔄' : '✅'}</p>
            <p>Time Series: {state.loading.timeSeries ? '🔄' : '✅'}</p>
            <p>Traffic Sources: {state.loading.trafficSources ? '🔄' : '✅'}</p>
            <p>Top Pages: {state.loading.topPages ? '🔄' : '✅'}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h4 className="font-medium text-gray-700 mb-2">System Status</h4>
          <div className="text-sm text-gray-600">
            <p>Online: {state.isOnline ? '🟢' : '🔴'}</p>
            <p>Last Refresh: {state.lastRefresh ? new Date(state.lastRefresh).toLocaleTimeString() : 'Never'}</p>
            <p>Data Updated: {state.data.lastUpdated ? new Date(state.data.lastUpdated).toLocaleTimeString() : 'Never'}</p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {Object.values(state.errors).some(error => error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-red-800 mb-2">Errors</h4>
          <div className="text-sm text-red-700">
            {Object.entries(state.errors).map(([key, error]) => (
              error && <p key={key}>{key}: {error}</p>
            ))}
          </div>
        </div>
      )}
      
      {/* Test Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h4 className="font-medium text-gray-700 mb-4">Test Controls</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => setPresetDateRange('last7days')}
            className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPresetDateRange('last30days')}
            className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            Last 30 Days
          </button>
          <button
            onClick={toggleGoogleAdsHighlight}
            className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
          >
            Toggle Google Ads
          </button>
          <button
            onClick={refresh}
            className="px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setGlobalLoading(!state.loading.global)}
            className="px-3 py-2 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
          >
            Toggle Loading
          </button>
          <button
            onClick={() => setError('global', 'Test error message')}
            className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Test Error
          </button>
          <button
            onClick={clearErrors}
            className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Clear Errors
          </button>
        </div>
      </div>
    </div>
  )
}