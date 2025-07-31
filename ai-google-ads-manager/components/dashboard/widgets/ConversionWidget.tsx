'use client'

import React, { useMemo } from 'react'
import { ChartContainer, MetricCard, BarChart } from '@/components/dashboard'
import { sampleData } from '@/components/dashboard/sampleData'

export interface ConversionWidgetProps {
  data?: typeof sampleData.timeSeries
  channelData?: typeof sampleData.channels
  loading?: boolean
  error?: string
  className?: string
}

export const ConversionWidget: React.FC<ConversionWidgetProps> = ({
  data = sampleData.timeSeries,
  channelData = sampleData.channels,
  loading = false,
  error,
  className = ''
}) => {
  // Calculate conversion metrics from time series data
  const conversionMetrics = useMemo(() => {
    // Ensure data is valid
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        conversions: 0,
        conversionsChange: { value: 0, type: 'increase', timeframe: '7 days' },
        conversionRate: 0,
        conversionRateChange: { value: 0, type: 'increase', timeframe: '7 days' },
        costPerConversion: 0,
        revenue: 0,
        revenueChange: { value: 0, type: 'increase', timeframe: '7 days' }
      }
    }
    
    const currentPeriod = data.slice(-7) // Last 7 days
    const previousPeriod = data.slice(-14, -7) // Previous 7 days
    
    const currentConversions = currentPeriod.reduce((sum, day) => sum + (day.conversions || 0), 0)
    const previousConversions = previousPeriod.reduce((sum, day) => sum + (day.conversions || 0), 0)
    const conversionsChange = previousConversions > 0 ? ((currentConversions - previousConversions) / previousConversions) * 100 : 0
    
    const currentSessions = currentPeriod.reduce((sum, day) => sum + (day.sessions || 0), 0)
    const previousSessions = previousPeriod.reduce((sum, day) => sum + (day.sessions || 0), 0)
    
    const currentConversionRate = currentSessions > 0 ? (currentConversions / currentSessions) * 100 : 0
    const previousConversionRate = previousSessions > 0 ? (previousConversions / previousSessions) * 100 : 0
    const conversionRateChange = previousConversionRate > 0 ? ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100 : 0
    
    const currentCost = currentPeriod.reduce((sum, day) => sum + (day.cost || 0), 0)
    const costPerConversion = currentConversions > 0 ? currentCost / currentConversions : 0
    
    const currentRevenue = currentConversions * 45.50 // Assuming $45.50 average order value
    const previousRevenue = previousConversions * 45.50
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0

    return {
      conversions: currentConversions,
      conversionsChange: {
        value: Math.abs(conversionsChange),
        type: conversionsChange >= 0 ? 'increase' : 'decrease',
        timeframe: '7 days'
      },
      conversionRate: currentConversionRate,
      conversionRateChange: {
        value: Math.abs(conversionRateChange),
        type: conversionRateChange >= 0 ? 'increase' : 'decrease',
        timeframe: '7 days'
      },
      costPerConversion,
      revenue: currentRevenue,
      revenueChange: {
        value: Math.abs(revenueChange),
        type: revenueChange >= 0 ? 'increase' : 'decrease',
        timeframe: '7 days'
      }
    }
  }, [data])

  // Process channel data for conversion rate chart
  const conversionRateData = useMemo(() => {
    // Ensure channelData is valid
    if (!channelData || !Array.isArray(channelData) || channelData.length === 0) {
      return []
    }
    
    return channelData.map(channel => ({
      ...channel,
      conversionRate: channel.sessions && channel.sessions > 0 
        ? ((channel.conversions || 0) / channel.sessions) * 100 
        : 0
    }))
  }, [channelData])

  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversions</h3>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading conversion data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Conversions</h3>
          <div className="text-sm text-gray-500">Last 7 days vs previous 7 days</div>
        </div>
        
        {/* Key Conversion Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Conversions"
            value={conversionMetrics.conversions}
            change={conversionMetrics.conversionsChange}
            loading={loading}
            format="number"
          />
          <MetricCard
            title="Conversion Rate"
            value={conversionMetrics.conversionRate}
            change={conversionMetrics.conversionRateChange}
            loading={loading}
            format="percentage"
          />
          <MetricCard
            title="Cost per Conversion"
            value={conversionMetrics.costPerConversion}
            loading={loading}
            format="currency"
            showTrend={false}
          />
          <MetricCard
            title="Revenue"
            value={conversionMetrics.revenue}
            change={conversionMetrics.revenueChange}
            loading={loading}
            format="currency"
          />
        </div>

        {/* Conversion Rate by Channel */}
        <ChartContainer
          title="Conversion Rate by Channel"
          description="Comparison of conversion rates across traffic sources"
          loading={loading}
        >
          <BarChart
            data={conversionRateData}
            metric="conversionRate"
            title=""
            height="h-64"
            color="#10b981"
            formatValue={(value) => `${value.toFixed(2)}%`}
            sortBy="value"
            sortDirection="desc"
            showDataLabels={true}
          />
        </ChartContainer>
      </div>
    </div>
  )
}