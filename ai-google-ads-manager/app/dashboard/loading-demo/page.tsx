'use client'

import React, { useState } from 'react'
import { 
  DonutChart, 
  BarChart, 
  MetricCard, 
  ChartContainer,
  TableComponent
} from '@/components/dashboard'
import { 
  ChartSkeleton, 
  DonutChartSkeleton, 
  LineChartSkeleton, 
  MetricCardSkeleton, 
  TableSkeleton, 
  WidgetSkeleton,
  ProgressiveLoadingSkeleton 
} from '@/components/ui/SkeletonLoaders'
import { useLoadingStates, useSimpleLoading, useAsyncLoading } from '@/hooks/useLoadingStates'
import { useDashboard } from '@/contexts/DashboardContext'
import { sampleData } from '@/components/dashboard/sampleData'

export default function LoadingDemoPage() {
  const { state, setLoading } = useDashboard()
  const { loading: simpleLoading, toggleLoading } = useSimpleLoading()
  const [progressivePhase, setProgressivePhase] = useState<'initial' | 'partial' | 'complete'>('initial')
  
  // Loading states for different components
  const {
    loadingStates,
    setLoading: setCustomLoading,
    startProgressiveLoading,
    isAnyLoading,
    getLoadingKeys
  } = useLoadingStates({
    charts: false,
    metrics: false,
    widgets: false
  })

  // Simulate async data loading
  const simulateDataFetch = async (duration = 2000) => {
    await new Promise(resolve => setTimeout(resolve, duration))
    return { success: true, data: 'Loaded successfully!' }
  }

  const { loading: asyncLoading, execute: loadData, data: asyncData } = useAsyncLoading(
    simulateDataFetch
  )

  const demoData = {
    donutData: sampleData.trafficSources.slice(0, 4),
    barData: sampleData.campaigns.slice(0, 5).map(item => ({
      name: item.name,
      sessions: item.sessions,
      clicks: item.clicks,
      cost: item.cost
    })),
    tableData: sampleData.pages.slice(0, 3)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Loading States Demo</h1>
          <p className="mt-2 text-gray-600">
            Phase 3: Loading States & Skeleton Loaders Implementation
          </p>
        </div>

        {/* Loading Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Loading Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setCustomLoading('charts', !loadingStates.charts)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                loadingStates.charts 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {loadingStates.charts ? 'Stop' : 'Start'} Chart Loading
            </button>
            
            <button
              onClick={() => setCustomLoading('metrics', !loadingStates.metrics)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                loadingStates.metrics 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {loadingStates.metrics ? 'Stop' : 'Start'} Metrics Loading
            </button>
            
            <button
              onClick={() => setCustomLoading('widgets', !loadingStates.widgets)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                loadingStates.widgets 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {loadingStates.widgets ? 'Stop' : 'Start'} Widget Loading
            </button>
            
            <button
              onClick={() => startProgressiveLoading('progressive', ['initial', 'partial', 'complete'], [1000, 2000, 3000])}
              className="px-4 py-2 rounded-md text-sm font-medium bg-purple-100 text-purple-700 hover:bg-purple-200"
            >
              Start Progressive Loading
            </button>
          </div>

          <div className="mt-4 flex items-center space-x-4 text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`px-2 py-1 rounded ${isAnyLoading() ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {isAnyLoading() ? `Loading: ${getLoadingKeys().join(', ')}` : 'Ready'}
            </span>
          </div>
        </div>

        {/* Dashboard Context Loading */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Dashboard Context Loading</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => setLoading('trafficSources', !state.loading.trafficSources)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            >
              Toggle Traffic Sources: {state.loading.trafficSources ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setLoading('timeSeries', !state.loading.timeSeries)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            >
              Toggle Time Series: {state.loading.timeSeries ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setLoading('topPages', !state.loading.topPages)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            >
              Toggle Top Pages: {state.loading.topPages ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            <strong>Current Loading State:</strong>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(state.loading, null, 2)}
            </pre>
          </div>
        </div>

        {/* Skeleton Components Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Skeleton Loaders</h2>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Chart Skeleton</h3>
              <ChartSkeleton height="h-48" />
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Donut Chart Skeleton</h3>
              <DonutChartSkeleton height="h-48" />
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Metric Cards</h3>
              <div className="grid grid-cols-2 gap-4">
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Interactive Components</h2>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Loading Donut Chart</h3>
              <DonutChart
                data={demoData.donutData}
                title="Traffic Sources"
                loading={loadingStates.charts as boolean}
                height="h-48"
                centerContent={
                  <div className="text-center">
                    <div className="text-2xl font-bold">8,200</div>
                    <div className="text-sm text-gray-500">Total Sessions</div>
                  </div>
                }
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Loading Bar Chart</h3>
              <BarChart
                data={demoData.barData}
                title="Campaign Performance"
                metric="sessions"
                loading={loadingStates.charts as boolean}
                height="h-48"
              />
            </div>
          </div>
        </div>

        {/* Progressive Loading Demo */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Progressive Loading</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loading Phase:
            </label>
            <select 
              value={progressivePhase} 
              onChange={(e) => setProgressivePhase(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="initial">Initial</option>
              <option value="partial">Partial</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          
          <ProgressiveLoadingSkeleton 
            phase={progressivePhase}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard 
                title="Sessions" 
                value="8,200" 
                change={{ value: 12.5, type: 'increase' }}
              />
              <MetricCard 
                title="Conversions" 
                value="342" 
                change={{ value: 8.2, type: 'increase' }}
              />
            </div>
          </ProgressiveLoadingSkeleton>
        </div>

        {/* Widget Container Demo */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Widget Containers</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Chart Container (Context Loading)</h3>
              <ChartContainer
                title="Traffic Distribution"
                description="Real-time traffic data"
                loading={state.loading.trafficSources}
                height="h-64"
              >
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Chart content would appear here</p>
                </div>
              </ChartContainer>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Widget Loading</h3>
              <div className="h-64">
                {loadingStates.widgets ? (
                  <WidgetSkeleton variant="default" height="h-64" />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 h-full">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Custom Widget</h4>
                    <p className="text-gray-600">This widget shows real content when not loading.</p>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 bg-blue-200 rounded w-full"></div>
                      <div className="h-2 bg-green-200 rounded w-3/4"></div>
                      <div className="h-2 bg-purple-200 rounded w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Async Loading Demo */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Async Operations</h2>
          
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => loadData(3000)}
              disabled={asyncLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {asyncLoading ? 'Loading...' : 'Load Data (3s)'}
            </button>
            
            <div className="text-sm text-gray-600">
              {asyncLoading && <span className="text-blue-600">⏳ Loading data...</span>}
              {asyncData && <span className="text-green-600">✅ {asyncData.data}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Metric during async load</h4>
              <MetricCard
                title="API Response Time"
                value={asyncLoading ? "..." : "1.2s"}
                loading={asyncLoading}
                change={asyncLoading ? undefined : { value: 15.2, type: 'decrease' }}
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Table during async load</h4>
              {asyncLoading ? (
                <TableSkeleton rows={3} columns={3} />
              ) : (
                <div className="bg-gray-50 rounded p-4 text-sm">
                  <div className="font-medium text-gray-900 mb-2">Sample Data</div>
                  <div className="space-y-1 text-gray-600">
                    <div>Row 1: Sample data loaded</div>
                    <div>Row 2: Another data point</div>
                    <div>Row 3: Final data entry</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}