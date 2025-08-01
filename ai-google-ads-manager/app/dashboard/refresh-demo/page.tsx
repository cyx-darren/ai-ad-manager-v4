'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { 
  ArrowPathIcon,
  ClockIcon,
  ChartBarIcon,
  CpuChipIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
  PauseIcon,
  StopIcon
} from '@heroicons/react/24/outline'

// Phase 5 imports
import { useDashboardRefresh } from '@/hooks/useDashboardRefresh'
import { useRefreshManager } from '@/hooks/useRefreshManager'
import { cacheManager, invalidateCache, getCacheMetrics } from '@/utils/cacheManager'
import { performanceMonitor, usePerformanceTracking } from '@/utils/performanceMonitor'
import { ChartContainer } from '@/components/dashboard'
import { sampleData } from '@/components/dashboard/sampleData'

export default function RefreshDemoPage() {
  const { trackOperation } = usePerformanceTracking('RefreshDemoPage')
  
  // Demo state
  const [dateRange, setDateRange] = useState({
    startDate: '2025-07-01',
    endDate: '2025-07-31'
  })
  const [refreshConfig, setRefreshConfig] = useState({
    enableAutoRefresh: true,
    refreshInterval: 10000, // 10 seconds for demo
    enableCache: true,
    cacheStrategy: 'conservative' as const
  })
  const [demoData, setDemoData] = useState(sampleData.timeSeries)
  const [metrics, setMetrics] = useState<any>(null)

  // Mock data sources
  const dataSources = {
    sessions: useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)) // 0.5-1.5s delay
      return sampleData.timeSeries.map(item => ({
        ...item,
        sessions: item.sessions + Math.floor(Math.random() * 100) - 50 // Random variation
      }))
    }, []),
    
    trafficSources: useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 300))
      return sampleData.trafficSources
    }, []),
    
    topPages: useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 600 + 200))
      return sampleData.pages
    }, []),
    
    conversions: useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 700 + 400))
      return sampleData.conversionFunnel
    }, [])
  }

  // Set up dashboard refresh system
  const dashboardRefresh = useDashboardRefresh(dataSources, dateRange, refreshConfig)

  // Manual refresh for demo data
  const demoRefresh = useCallback(async () => {
    console.log('🎮 Demo refresh triggered')
    
    const newData = await trackOperation('demo-refresh', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      return sampleData.timeSeries.map(item => ({
        ...item,
        sessions: Math.floor(Math.random() * 1000) + 500,
        bounceRate: Math.random() * 0.8 + 0.1
      }))
    })
    
    setDemoData(newData)
    return newData
  }, [trackOperation])

  // Set up simple refresh manager for demo
  const simpleRefreshManager = useRefreshManager(demoRefresh, {
    enabled: true,
    interval: 15000, // 15 seconds
    maxRetries: 3,
    refreshOnFocus: true
  })

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics({
        cache: getCacheMetrics(),
        performance: performanceMonitor.getMetrics(),
        issues: performanceMonitor.getPerformanceIssues(),
        dashboard: dashboardRefresh.state
      })
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 2000)
    return () => clearInterval(interval)
  }, [dashboardRefresh.state])

  // Demo controls
  const handleConfigChange = (key: string, value: any) => {
    setRefreshConfig(prev => ({ ...prev, [key]: value }))
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Phase 5: Refresh & Optimization Demo
          </h1>
          <p className="text-gray-600">
            Manual refresh, automatic intervals, caching, performance monitoring, and data invalidation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Refresh Configuration */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-blue-500" />
                Refresh Configuration
              </h2>
              
              <div className="space-y-4">
                {/* Auto Refresh Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Auto Refresh</label>
                  <button
                    onClick={() => handleConfigChange('enableAutoRefresh', !refreshConfig.enableAutoRefresh)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      refreshConfig.enableAutoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        refreshConfig.enableAutoRefresh ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Refresh Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interval (seconds)
                  </label>
                  <select
                    value={refreshConfig.refreshInterval / 1000}
                    onChange={(e) => handleConfigChange('refreshInterval', parseInt(e.target.value) * 1000)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>

                {/* Cache Strategy */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cache Strategy
                  </label>
                  <select
                    value={refreshConfig.cacheStrategy}
                    onChange={(e) => handleConfigChange('cacheStrategy', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="realtime">Realtime (30s TTL)</option>
                    <option value="aggressive">Aggressive (2m TTL)</option>
                    <option value="conservative">Conservative (5m TTL)</option>
                  </select>
                </div>

                {/* Enable Cache Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Enable Cache</label>
                  <button
                    onClick={() => handleConfigChange('enableCache', !refreshConfig.enableCache)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      refreshConfig.enableCache ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        refreshConfig.enableCache ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PlayIcon className="h-5 w-5 text-green-500" />
                Manual Controls
              </h2>
              
              <div className="space-y-3">
                <button
                  onClick={dashboardRefresh.manualRefresh}
                  disabled={dashboardRefresh.state.isRefreshing}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${dashboardRefresh.state.isRefreshing ? 'animate-spin' : ''}`} />
                  Force Refresh All
                </button>

                <button
                  onClick={() => dashboardRefresh.refreshDataSource('sessions')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <ChartBarIcon className="h-4 w-4" />
                  Refresh Sessions
                </button>

                <button
                  onClick={() => dashboardRefresh.cacheControls.clearCache()}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <CloudIcon className="h-4 w-4" />
                  Clear All Cache
                </button>

                <button
                  onClick={() => dashboardRefresh.cacheControls.clearExpiredCache()}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center justify-center gap-2"
                >
                  <ClockIcon className="h-4 w-4" />
                  Clear Expired
                </button>
              </div>
            </div>

            {/* Simple Demo Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Simple Demo Refresh
              </h2>
              
              <div className="space-y-3">
                <button
                  onClick={simpleRefreshManager.refresh}
                  disabled={simpleRefreshManager.state.isRefreshing}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${simpleRefreshManager.state.isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Demo Data
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={simpleRefreshManager.pauseRefresh}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-1"
                  >
                    <PauseIcon className="h-4 w-4" />
                    Pause
                  </button>
                  <button
                    onClick={simpleRefreshManager.resumeRefresh}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-1"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Resume
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Status & Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Refresh Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Refresh Status
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {dashboardRefresh.state.isRefreshing ? (
                      <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    <span className="font-medium text-gray-900">Dashboard Refresh</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Status: {dashboardRefresh.state.isRefreshing ? 'Refreshing' : 'Idle'}</div>
                    <div>Last: {formatTime(dashboardRefresh.state.lastRefresh)}</div>
                    <div>Next: {formatTime(dashboardRefresh.state.nextRefresh)}</div>
                    <div>Stale: {dashboardRefresh.state.isStale ? 'Yes' : 'No'}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {simpleRefreshManager.state.isRefreshing ? (
                      <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    <span className="font-medium text-gray-900">Demo Refresh</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Count: {simpleRefreshManager.state.refreshCount}</div>
                    <div>Errors: {simpleRefreshManager.state.consecutiveErrors}</div>
                    <div>Paused: {simpleRefreshManager.state.isPaused ? 'Yes' : 'No'}</div>
                    <div>Stale: {simpleRefreshManager.state.isStale ? 'Yes' : 'No'}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CloudIcon className="h-5 w-5 text-purple-500" />
                    <span className="font-medium text-gray-900">Cache Status</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Hit Rate: {metrics?.cache ? `${(metrics.cache.hitRate * 100).toFixed(1)}%` : 'N/A'}</div>
                    <div>Total Size: {metrics?.cache?.totalSize || 0}</div>
                    <div>Hits: {metrics?.cache?.hits || 0}</div>
                    <div>Misses: {metrics?.cache?.misses || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CpuChipIcon className="h-5 w-5 text-green-500" />
                Performance Metrics
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">API Performance</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Total Calls: {metrics?.performance?.apiCalls?.total || 0}</div>
                    <div>Success Rate: {metrics?.performance?.apiCalls ? 
                      `${((metrics.performance.apiCalls.successful / metrics.performance.apiCalls.total) * 100).toFixed(1)}%` : 'N/A'}</div>
                    <div>Avg Response: {formatDuration(metrics?.performance?.apiCalls?.averageResponseTime)}</div>
                    <div>Slowest: {formatDuration(metrics?.performance?.apiCalls?.slowestCall)}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Memory Usage</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Heap Used: {metrics?.performance?.memory ? 
                      `${(metrics.performance.memory.heapUsed / 1024 / 1024).toFixed(1)}MB` : 'N/A'}</div>
                    <div>Heap Total: {metrics?.performance?.memory ? 
                      `${(metrics.performance.memory.heapTotal / 1024 / 1024).toFixed(1)}MB` : 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Performance Issues */}
              {metrics?.issues && metrics.issues.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                    Performance Issues
                  </h3>
                  <div className="space-y-2">
                    {metrics.issues.map((issue: any, index: number) => (
                      <div key={index} className={`p-2 rounded text-sm border-l-4 ${
                        issue.severity === 'high' ? 'bg-red-50 border-red-400 text-red-700' :
                        issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' :
                        'bg-blue-50 border-blue-400 text-blue-700'
                      }`}>
                        <span className="font-medium capitalize">{issue.type}:</span> {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Demo Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Demo Data Visualization
              </h2>
              
              <ChartContainer
                title="Sessions Over Time (Auto-Refreshing)"
                description={`Data refreshes every ${refreshConfig.refreshInterval / 1000} seconds. Cache ${refreshConfig.enableCache ? 'enabled' : 'disabled'}.`}
              >
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Demo chart with {demoData.length} data points</p>
                    <p className="text-sm text-gray-400">
                      Last updated: {formatTime(simpleRefreshManager.state.lastRefresh)}
                    </p>
                  </div>
                </div>
              </ChartContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}