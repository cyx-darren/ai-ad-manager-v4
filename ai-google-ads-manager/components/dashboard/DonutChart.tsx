'use client'

import React from 'react'
import { DonutChart as TremorDonutChart, Card, Title, Text, Legend } from '@tremor/react'
import { getHexColor, TREMOR_COLOR_HEX } from '../../lib/tremor-utils'

// Types for GA4/Google Ads percentage/proportion data
export interface DonutChartDataPoint {
  name: string // Source/Medium, Device, Campaign Type, etc.
  value: number // Sessions, users, clicks, revenue, etc.
  percentage?: number // Optional pre-calculated percentage
}

export interface DonutChartProps {
  data: DonutChartDataPoint[]
  title?: string
  description?: string
  metric?: string // What the values represent
  height?: string
  colors?: string[]
  showLegend?: boolean
  showLabels?: boolean
  showTooltip?: boolean
  innerRadius?: number
  outerRadius?: number
  formatValue?: (value: number) => string
  formatPercentage?: (percentage: number) => string
  className?: string
  showAnimation?: boolean
  centerContent?: React.ReactNode
}

// Vibrant SaaS color palette for donut charts - matching homepage theme
const DEFAULT_COLORS = [
  'indigo',     // Primary brand
  'emerald',    // Success
  'pink',       // Secondary brand
  'cyan',       // Accent
  'amber',      // Warning
  'violet',     // Premium
  'rose',       // Alert
  'green',      // Positive
  'purple',     // Highlight
  'red',        // Critical
  'yellow',     // Caution
  'teal'        // Info
]

// Common GA4/Ads metric formatters
const DONUT_FORMATTERS = {
  sessions: (value: number) => value.toLocaleString(),
  users: (value: number) => value.toLocaleString(),
  clicks: (value: number) => value.toLocaleString(),
  impressions: (value: number) => value.toLocaleString(),
  cost: (value: number) => `$${value.toFixed(2)}`,
  revenue: (value: number) => `$${value.toFixed(2)}`,
  conversions: (value: number) => value.toLocaleString()
}

// Helper function to get proper color values for Tremor colors
const getTremorColor = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    indigo: '#6366f1',
    emerald: '#10b981',
    pink: '#ec4899',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    violet: '#8b5cf6',
    rose: '#f43f5e',
    green: '#22c55e',
    purple: '#a855f7',
    red: '#ef4444',
    yellow: '#eab308',
    teal: '#14b8a6',
    blue: '#3b82f6',
    orange: '#f97316'
  }
  return colorMap[colorName] || '#6366f1'
}

export function DonutChart({
  data,
  title,
  description,
  metric = 'sessions',
  height = 'h-80',
  colors = DEFAULT_COLORS,
  showLegend = true,
  showLabels = true,
  showTooltip = true,
  formatValue,
  formatPercentage,
  className = '',
  showAnimation = true,
  centerContent
}: DonutChartProps) {
  // Calculate total and percentages
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  // Convert colors to valid Tremor color names
  const tremorColors = colors.map(color => {
    // If it's a HEX color, find the closest Tremor color name
    if (color.startsWith('#')) {
      const colorMap: Record<string, string> = {
        '#6366f1': 'indigo',
        '#10b981': 'emerald', 
        '#ec4899': 'pink',
        '#06b6d4': 'cyan',
        '#fbbf24': 'amber',
        '#8b5cf6': 'violet',
        '#fb7185': 'rose',
        '#34d399': 'green',
        '#a855f7': 'purple',
        '#ef4444': 'red',
        '#facc15': 'yellow',
        '#14b8a6': 'teal'
      }
      return colorMap[color] || 'blue'
    }
    // Otherwise, return the color name as-is (should already be a valid Tremor color)
    return color
  })

  // Also keep hex values for tooltip
  const hexColors = tremorColors.map(colorName => TREMOR_COLOR_HEX[colorName as keyof typeof TREMOR_COLOR_HEX])
  
  // Format data for Tremor DonutChart
  const formattedData = data.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0
    return {
      name: item.name,
      value: item.value,
      percentage: item.percentage || percentage,
      share: `${percentage.toFixed(1)}%`
    }
  })

  // Get default formatter
  const defaultFormatter = formatValue || DONUT_FORMATTERS[metric as keyof typeof DONUT_FORMATTERS] || ((value: number) => value.toLocaleString())
  const defaultPercentageFormatter = formatPercentage || ((percentage: number) => `${percentage.toFixed(1)}%`)

  // Calculate center stats
  const centerStats = {
    total: total.toLocaleString(),
    label: `Total ${metric.charAt(0).toUpperCase() + metric.slice(1)}`
  }

  return (
    <div className={`w-full ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <Title className="text-gray-900 font-bold">{title}</Title>}
          {description && <Text className="text-gray-600">{description}</Text>}
        </div>
      )}
      
      <div className={`flex ${showLegend ? 'flex-col lg:flex-row' : 'justify-center'} gap-4 lg:gap-6 min-h-[300px] sm:min-h-[320px] lg:min-h-[350px] h-full`}>
        {/* Donut Chart */}
        <div className={`${showLegend ? 'lg:w-2/3' : 'w-full'} flex items-center justify-center`}>
          <div className="relative tremor-donut-container">
            <TremorDonutChart
              data={formattedData}
              category="value"
              index="name"
              colors={tremorColors}
              className="w-72 h-72"
              showLabel={false}
              showAnimation={showAnimation}
              showTooltip={showTooltip}
              variant="donut"
              customTooltip={(props) => {
                if (!showTooltip || !props.active || !props.payload) return null
                
                const data = props.payload[0]
                if (!data) return null
                
                // Find the correct hex color for this data point
                const dataIndex = formattedData.findIndex(item => item.name === data.name)
                const correctColor = hexColors[dataIndex] || data.color
                
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: correctColor }}
                      />
                      <p className="font-medium text-gray-900">{data.name}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-600">Value:</span>
                        <span className="font-medium text-gray-900">
                          {defaultFormatter(data.value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-600">Share:</span>
                        <span className="font-medium text-gray-900">
                          {defaultPercentageFormatter(data.payload.percentage)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            
            {/* Center Content */}
            <div className="absolute top-0 left-0 w-72 h-72 flex items-center justify-center pointer-events-none z-20">
              {centerContent || (
                <div className="text-center donut-chart-center-override">
                  <div className="text-2xl font-bold text-gray-900">
                    {centerStats.total}
                  </div>
                  <div className="text-sm text-gray-500">
                    {centerStats.label}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Legend */}
        {showLegend && (
          <div className="lg:w-1/3 flex flex-col justify-center min-h-0">
            <div className="space-y-3">
              {formattedData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: hexColors[index % hexColors.length] }}
                    />
                    <span className="text-sm text-gray-600 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-gray-900">
                      {defaultFormatter(item.value)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {defaultPercentageFormatter(item.percentage)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Total Summary */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="text-sm font-bold text-gray-900">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Preset configurations for common use cases
export interface TrafficSourceDonutChartProps extends Omit<DonutChartProps, 'metric'> {
  metric?: 'sessions' | 'users' | 'conversions'
}

export interface DeviceBreakdownDonutChartProps extends Omit<DonutChartProps, 'metric'> {
  metric?: 'sessions' | 'users' | 'revenue'
}

export interface CampaignTypeDonutChartProps extends Omit<DonutChartProps, 'metric'> {
  metric?: 'clicks' | 'cost' | 'conversions' | 'revenue'
}

// Preset DonutChart components for common use cases
export function TrafficSourceDonutChart({ 
  metric = 'sessions', 
  ...props 
}: TrafficSourceDonutChartProps) {
  return (
    <DonutChart 
      {...props} 
      metric={metric}
      title={props.title || `Traffic Sources by ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
    />
  )
}

export function DeviceBreakdownDonutChart({ 
  metric = 'sessions', 
  ...props 
}: DeviceBreakdownDonutChartProps) {
  return (
    <DonutChart 
      {...props} 
      metric={metric}
      title={props.title || `Device Breakdown by ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
    />
  )
}

export function CampaignTypeDonutChart({ 
  metric = 'clicks', 
  ...props 
}: CampaignTypeDonutChartProps) {
  return (
    <DonutChart 
      {...props} 
      metric={metric}
      title={props.title || `Campaign Types by ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
    />
  )
}

// Geographic breakdown donut chart
export function GeographicDonutChart(props: DonutChartProps) {
  return (
    <DonutChart 
      {...props}
      title={props.title || 'Geographic Distribution'}
      showLegend={true}
    />
  )
}

// Conversion funnel donut chart
export function ConversionFunnelDonutChart(props: Omit<DonutChartProps, 'metric' | 'centerContent'>) {
  const conversionRate = props.data.length > 1 
    ? (props.data[props.data.length - 1].value / props.data[0].value) * 100 
    : 0

  return (
    <DonutChart 
      {...props}
      metric="conversions"
      title={props.title || 'Conversion Funnel'}
      centerContent={
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {conversionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Conversion Rate
          </div>
        </div>
      }
    />
  )
}