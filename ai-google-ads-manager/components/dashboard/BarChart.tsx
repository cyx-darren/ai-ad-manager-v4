'use client'

import React from 'react'
import { BarChart as TremorBarChart, Card, Title, Text } from '@tremor/react'
import { getTremorColor, TREMOR_COLOR_HEX, type TremorColor } from '@/lib/tremor-utils'
import '@/styles/charts.css'

// Types for GA4/Google Ads comparative data
export interface BarChartDataPoint {
  name: string // Campaign name, channel, device, etc.
  sessions?: number
  users?: number
  clicks?: number
  impressions?: number
  cost?: number
  conversions?: number
  revenue?: number
  ctr?: number  // Click-through rate
  cpc?: number  // Cost per click
  roas?: number // Return on ad spend
  conversionRate?: number
}

export interface BarChartProps {
  data: BarChartDataPoint[]
  title?: string
  description?: string
  metric: string // Single metric to display
  height?: string
  color?: string
  showDataLabels?: boolean
  sortBy?: 'value' | 'name' | 'none'
  sortDirection?: 'asc' | 'desc'
  maxItems?: number
  formatValue?: (value: number) => string
  className?: string
  layout?: 'vertical' | 'horizontal'
  maxLabelLength?: number // Maximum characters for labels
}

// Default color palette for different metric types - vibrant colors
const METRIC_COLORS: Record<string, TremorColor> = {
  sessions: 'indigo',
  users: 'blue',
  clicks: 'cyan',
  impressions: 'sky',
  cost: 'pink',
  conversions: 'emerald',
  revenue: 'green',
  ctr: 'amber',
  cpc: 'orange',
  roas: 'violet',
  conversionRate: 'purple'
}

// Default formatters for different metrics
const METRIC_FORMATTERS = {
  sessions: (value: number) => value.toLocaleString(),
  users: (value: number) => value.toLocaleString(),
  clicks: (value: number) => value.toLocaleString(),
  impressions: (value: number) => value.toLocaleString(),
  cost: (value: number) => `$${value.toFixed(2)}`,
  conversions: (value: number) => value.toLocaleString(),
  revenue: (value: number) => `$${value.toFixed(2)}`,
  ctr: (value: number) => `${(value * 100).toFixed(2)}%`,
  cpc: (value: number) => `$${value.toFixed(2)}`,
  roas: (value: number) => `${value.toFixed(2)}x`,
  conversionRate: (value: number) => `${(value * 100).toFixed(2)}%`
}

// Metric display labels
const METRIC_LABELS: Record<string, string> = {
  sessions: 'Sessions',
  users: 'Users',
  clicks: 'Clicks',
  impressions: 'Impressions',
  cost: 'Cost',
  conversions: 'Conversions',
  revenue: 'Revenue',
  ctr: 'Click-Through Rate',
  cpc: 'Cost Per Click',
  roas: 'Return on Ad Spend',
  conversionRate: 'Conversion Rate'
}

export function BarChart({
  data,
  title,
  description,
  metric,
  height = 'h-80',
  color,
  showDataLabels = false,
  sortBy = 'value',
  sortDirection = 'desc',
  maxItems = 10,
  formatValue,
  className = '',
  layout = 'vertical',
  maxLabelLength = 30
}: BarChartProps) {
  // Sort and limit data
  let processedData = [...data]
  
  if (sortBy === 'value') {
    processedData.sort((a, b) => {
      const aValue = (a as any)[metric] || 0
      const bValue = (b as any)[metric] || 0
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue
    })
  } else if (sortBy === 'name') {
    processedData.sort((a, b) => {
      return sortDirection === 'desc' 
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name)
    })
  }
  
  if (maxItems > 0) {
    processedData = processedData.slice(0, maxItems)
  }

  // Helper function to truncate long labels
  const truncateLabel = (label: string, maxLength: number) => {
    if (label.length <= maxLength) return label
    return label.substring(0, maxLength - 3) + '...'
  }

  // Format data for Tremor BarChart
  const formattedData = processedData.map(point => ({
    name: truncateLabel(point.name, maxLabelLength),
    originalName: point.name, // Keep original for tooltip
    [metric]: (point as any)[metric] || 0
  }))

  // Get default color and formatter
  // Ensure we use a valid Tremor color and convert to HEX
  const requestedColor = color || METRIC_COLORS[metric] || 'blue'
  const tremorColor = getTremorColor(requestedColor)
  const chartColorHex = TREMOR_COLOR_HEX[tremorColor]
  const defaultFormatter = formatValue || METRIC_FORMATTERS[metric as keyof typeof METRIC_FORMATTERS] || ((value: number) => value.toLocaleString())
  const metricLabel = METRIC_LABELS[metric] || metric.charAt(0).toUpperCase() + metric.slice(1)

  return (
    <div className={`w-full ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <Title className="text-gray-900 font-bold">{title}</Title>}
          {description && <Text className="text-gray-600">{description}</Text>}
        </div>
      )}
      
      <div className={`${height} bar-chart-container relative overflow-hidden`} data-layout={layout}>
        {/* Gradient overlay for modern effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50/20 pointer-events-none" />
        <TremorBarChart
          data={formattedData}
          index="name"
          categories={[metric]}
          colors={[tremorColor]}
          valueFormatter={defaultFormatter}
          yAxisWidth={layout === 'vertical' ? 80 : 100}
          layout={layout}
          showLegend={false}
          showGridLines={true}
          className="h-full"
          autoMinValue={false}
          showYAxis={true}
          showXAxis={true}
          customTooltip={(props) => {
            if (!props.active || !props.payload || !props.label) return null
            
            const data = props.payload[0]
            if (!data) return null
            
            // Find the original full name from the data
            const fullName = formattedData.find(d => d.name === props.label)?.originalName || props.label
            
            return (
              <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
                <p className="font-medium text-gray-900 mb-2 break-words">{fullName}</p>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: chartColorHex }}
                    />
                    <span className="text-sm text-gray-600">{metricLabel}</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {defaultFormatter(data.value)}
                  </span>
                </div>
              </div>
            )
          }}
        />
      </div>
      
      {showDataLabels && (
        <div className="mt-2 text-xs text-gray-500">
          Showing top {Math.min(maxItems, data.length)} items by {metricLabel.toLowerCase()}
        </div>
      )}
    </div>
  )
}

// Preset configurations for common use cases
export interface CampaignPerformanceBarChartProps extends Omit<BarChartProps, 'metric'> {
  metric?: 'clicks' | 'impressions' | 'cost' | 'conversions'
}

export interface ChannelTrafficBarChartProps extends Omit<BarChartProps, 'metric'> {
  metric?: 'sessions' | 'users' | 'conversions'
}

export interface DevicePerformanceBarChartProps extends Omit<BarChartProps, 'metric'> {
  metric?: 'sessions' | 'users' | 'conversions' | 'revenue'
}

// Preset BarChart components for common use cases
export function CampaignPerformanceBarChart({ 
  metric = 'clicks', 
  ...props 
}: CampaignPerformanceBarChartProps) {
  return (
    <BarChart 
      {...props} 
      metric={metric}
      title={props.title || `Campaign Performance by ${METRIC_LABELS[metric]}`}
    />
  )
}

export function ChannelTrafficBarChart({ 
  metric = 'sessions', 
  ...props 
}: ChannelTrafficBarChartProps) {
  return (
    <BarChart 
      {...props} 
      metric={metric}
      title={props.title || `Traffic Channels by ${METRIC_LABELS[metric]}`}
    />
  )
}

export function DevicePerformanceBarChart({ 
  metric = 'sessions', 
  ...props 
}: DevicePerformanceBarChartProps) {
  return (
    <BarChart 
      {...props} 
      metric={metric}
      title={props.title || `Device Performance by ${METRIC_LABELS[metric]}`}
    />
  )
}

// Top performing campaigns bar chart (horizontal layout for long names)
export function TopCampaignsBarChart(props: Omit<BarChartProps, 'layout' | 'maxItems'>) {
  return (
    <BarChart 
      {...props}
      layout="horizontal"
      maxItems={8}
      title={props.title || 'Top Performing Campaigns'}
    />
  )
}