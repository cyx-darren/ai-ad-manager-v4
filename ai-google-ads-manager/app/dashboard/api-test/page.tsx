'use client'

import React, { useEffect, useState } from 'react'
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext'
import { useGA4DataService } from '@/lib/ga4ApiClient'
import { AlertBanner } from '@/components/dashboard/AlertBanner'

// Test component that uses the DashboardContext
function DashboardApiTest() {
  const { state, refresh, fetchData, setPresetDateRange } = useDashboard()
  const dataService = useGA4DataService()
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'failed'>('testing')

  // Test API connection on mount (with rate limiting)
  useEffect(() => {
    let isMounted = true
    
    const testConnection = async () => {
      if (!isMounted) return
      
      setConnectionStatus('testing')
      const isConnected = await dataService.testConnection()
      if (isMounted) {
        const status = isConnected ? 'connected' : 'failed'
        setConnectionStatus(status)
        // Cache the status for future use
        sessionStorage.setItem('lastConnectionStatus', status)
      }
    }
    
    // Always test connection on this page (it's a test page after all!)
    console.log('🔍 Testing GA4 API connection on test page')
    testConnection()

    return () => { isMounted = false }
  }, [dataService])

  const handleRefresh = async () => {
    await refresh()
  }

  const handleSetDateRange = () => {
    setPresetDateRange('last7days')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Phase B API Integration Test</h1>
      
      {/* Connection Status */}
      <div className="mb-6">
        <AlertBanner
          type={connectionStatus === 'connected' ? 'success' : connectionStatus === 'failed' ? 'warning' : 'info'}
          title="GA4 API Connection Status"
          message={
            connectionStatus === 'connected' 
              ? '✅ Connected to GA4 API service on port 3001 - using real data'
              : connectionStatus === 'failed'
              ? '⚠️ GA4 API service unavailable on port 3001 - using mock data fallback for development. Check console for detailed error logs.'
              : '🔄 Testing connection to GA4 service...'
          }
        />
      </div>

      {/* Dashboard State Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Dashboard State</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-gray-800">Date Range:</strong>
            <div className="text-gray-700 mt-1">{state.dateRange.startDate} to {state.dateRange.endDate}</div>
            <div className="text-gray-500 text-xs mt-1">Preset: {state.dateRange.preset || 'custom'}</div>
          </div>
          <div>
            <strong className="text-gray-800">Last Refresh:</strong>
            <div className="text-gray-700 mt-1">{state.lastRefresh ? new Date(state.lastRefresh).toLocaleString() : 'Never'}</div>
          </div>
          <div>
            <strong className="text-gray-800">Online Status:</strong>
            <div className={`mt-1 font-medium ${state.isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {state.isOnline ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
          <div>
            <strong className="text-gray-800">Global Loading:</strong>
            <div className={`mt-1 font-medium ${state.loading.global ? 'text-blue-600' : 'text-gray-600'}`}>
              {state.loading.global ? '⏳ Loading...' : '✅ Ready'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Controls</h2>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={state.loading.global}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {state.loading.global ? '⏳ Refreshing...' : '🔄 Refresh All Data'}
          </button>
          <button
            onClick={handleSetDateRange}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            📅 Set Last 7 Days
          </button>
          <button
            onClick={() => fetchData.sessions()}
            disabled={state.loading.timeSeries}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {state.loading.timeSeries ? '⏳' : '📊'} Fetch Sessions
          </button>
          <button
            onClick={() => fetchData.trafficSources()}
            disabled={state.loading.trafficSources}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {state.loading.trafficSources ? '⏳' : '🚦'} Fetch Traffic Sources
          </button>
        </div>
      </div>

      {/* Loading States */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Loading States</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(state.loading).map(([key, loading]) => (
            <div key={key} className="flex justify-between">
              <span className="capitalize text-gray-700">{key.replace(/([A-Z])/g, ' $1')}:</span>
              <span className={`font-medium ${loading ? 'text-blue-600' : 'text-gray-600'}`}>
                {loading ? '⏳ Loading' : '✅ Ready'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error States */}
      {Object.values(state.errors).some(error => error) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Errors</h2>
          <div className="space-y-2">
            {Object.entries(state.errors).map(([key, error]) => (
              error && (
                <div key={key} className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  <strong className="capitalize">{key}:</strong> {error}
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Data Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Time Series Data */}
          <div>
            <h3 className="font-medium mb-2 text-gray-800">
              Time Series (
              {Array.isArray(state.data.timeSeries) 
                ? state.data.timeSeries.length 
                : `NOT ARRAY - type: ${typeof state.data.timeSeries}`
              } entries)
            </h3>
            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-auto text-xs border">
              <pre className="text-gray-700">
                {state.data.timeSeries 
                  ? JSON.stringify(
                      Array.isArray(state.data.timeSeries) 
                        ? state.data.timeSeries.slice(0, 3)
                        : state.data.timeSeries, 
                      null, 2
                    )
                  : 'No data'
                }
              </pre>
              {Array.isArray(state.data.timeSeries) && state.data.timeSeries.length > 3 && (
                <div className="text-gray-500 mt-2">... and {state.data.timeSeries.length - 3} more</div>
              )}
            </div>
          </div>

          {/* Traffic Sources */}
          <div>
            <h3 className="font-medium mb-2 text-gray-800">
              Traffic Sources (
              {Array.isArray(state.data.trafficSources) 
                ? state.data.trafficSources.length 
                : `NOT ARRAY - type: ${typeof state.data.trafficSources}`
              } entries)
            </h3>
            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-auto text-xs border">
              <pre className="text-gray-700">
                {state.data.trafficSources 
                  ? JSON.stringify(
                      Array.isArray(state.data.trafficSources) 
                        ? state.data.trafficSources.slice(0, 3)
                        : state.data.trafficSources, 
                      null, 2
                    )
                  : 'No data'
                }
              </pre>
              {Array.isArray(state.data.trafficSources) && state.data.trafficSources.length > 3 && (
                <div className="text-gray-500 mt-2">... and {state.data.trafficSources.length - 3} more</div>
              )}
            </div>
          </div>

          {/* Top Pages */}
          <div>
            <h3 className="font-medium mb-2 text-gray-800">
              Top Pages (
              {Array.isArray(state.data.topPages) 
                ? state.data.topPages.length 
                : `NOT ARRAY - type: ${typeof state.data.topPages}`
              } entries)
            </h3>
            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-auto text-xs border">
              <pre className="text-gray-700">
                {state.data.topPages 
                  ? JSON.stringify(
                      Array.isArray(state.data.topPages) 
                        ? state.data.topPages.slice(0, 3)
                        : state.data.topPages, 
                      null, 2
                    )
                  : 'No data'
                }
              </pre>
              {Array.isArray(state.data.topPages) && state.data.topPages.length > 3 && (
                <div className="text-gray-500 mt-2">... and {state.data.topPages.length - 3} more</div>
              )}
            </div>
          </div>

          {/* Conversions */}
          <div>
            <h3 className="font-medium mb-2 text-gray-800">
              Conversions (
              {Array.isArray(state.data.conversions) 
                ? state.data.conversions.length 
                : `NOT ARRAY - type: ${typeof state.data.conversions}`
              } entries)
            </h3>
            <div className="bg-gray-50 rounded p-3 max-h-32 overflow-auto text-xs border">
              <pre className="text-gray-700">
                {state.data.conversions 
                  ? JSON.stringify(
                      Array.isArray(state.data.conversions) 
                        ? state.data.conversions.slice(0, 3)
                        : state.data.conversions, 
                      null, 2
                    )
                  : 'No data'
                }
              </pre>
              {Array.isArray(state.data.conversions) && state.data.conversions.length > 3 && (
                <div className="text-gray-500 mt-2">... and {state.data.conversions.length - 3} more</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main page component with DashboardProvider
export default function ApiTestPage() {
  return (
    <DashboardProvider>
      <DashboardApiTest />
    </DashboardProvider>
  )
}