'use client'

import React from 'react'
import { ChartContainer, MetricCard, LineChart } from '@/components/dashboard'
import { sampleData } from '@/components/dashboard/sampleData'

export interface TrafficOverviewWidgetProps {
  data?: typeof sampleData.timeSeries
  loading?: boolean
  error?: string
  className?: string
}

export const TrafficOverviewWidget: React.FC<TrafficOverviewWidgetProps> = ({
  data = sampleData.timeSeries,
  loading = false,
  error,
  className = ''
}) => {
  // Calculate current vs previous period metrics
  const currentPeriod = (data && Array.isArray(data) ? data : []).slice(-7) // Last 7 days
  const previousPeriod = (data && Array.isArray(data) ? data : []).slice(-14, -7) // Previous 7 days
  
  const currentSessions = currentPeriod.reduce((sum, day) => sum + (day.sessions || 0), 0)
  const previousSessions = previousPeriod.reduce((sum, day) => sum + (day.sessions || 0), 0)
  const sessionsChange = previousSessions > 0 ? ((currentSessions - previousSessions) / previousSessions) * 100 : 0
  
  const currentUsers = currentPeriod.reduce((sum, day) => sum + (day.users || 0), 0)
  const previousUsers = previousPeriod.reduce((sum, day) => sum + (day.users || 0), 0)
  const usersChange = previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0
  
  const currentPageviews = currentPeriod.reduce((sum, day) => sum + (day.pageviews || 0), 0)
  const previousPageviews = previousPeriod.reduce((sum, day) => sum + (day.pageviews || 0), 0)
  const pageviewsChange = previousPageviews > 0 ? ((currentPageviews - previousPageviews) / previousPageviews) * 100 : 0

  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Overview</h3>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading traffic data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Traffic Overview</h3>
          <div className="text-sm text-gray-500">Last 14 days</div>
        </div>
        
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Sessions"
            value={currentSessions}
            change={sessionsChange}
            loading={loading}
            format="number"
          />
          <MetricCard
            title="Users"
            value={currentUsers}
            change={usersChange}
            loading={loading}
            format="number"
          />
          <MetricCard
            title="Pageviews"
            value={currentPageviews}
            change={pageviewsChange}
            loading={loading}
            format="number"
          />
        </div>

        {/* Traffic Trend Chart */}
        <ChartContainer
          title="Traffic Trends (Last 14 Days)"
          description="Daily sessions, users, and pageviews"
          loading={loading}
        >
          <LineChart
            data={data || sampleData.timeSeries}
            metrics={['sessions', 'users', 'pageviews']}
            height="h-64"
            formatYAxis={(value) => value.toLocaleString()}
            colors={['#3b82f6', '#10b981', '#f59e0b']}
          />
        </ChartContainer>
      </div>
    </div>
  )
}