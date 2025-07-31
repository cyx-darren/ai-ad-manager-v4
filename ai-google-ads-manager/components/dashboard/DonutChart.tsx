'use client'

import React from 'react'
import { DonutChart as TremorDonutChart, Card, Title, Text, Legend } from '@tremor/react'
import { getHexColor, TREMOR_COLOR_HEX } from '../../lib/tremor-utils'
import { DonutChartSkeleton } from '../ui/SkeletonLoaders'

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
  loading?: boolean
  loadingHeight?: string
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
  height = 'h-96',
  colors = DEFAULT_COLORS,
  showLegend = true,
  showLabels = true,
  showTooltip = true,
  formatValue,
  formatPercentage,
  className = '',
  showAnimation = true,
  centerContent,
  loading = false,
  loadingHeight
}: DonutChartProps) {
  // Show skeleton loader when loading
  if (loading) {
    return <DonutChartSkeleton height={loadingHeight || height} />
  }
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
    total: defaultFormatter(total),
    label: metric.charAt(0).toUpperCase() + metric.slice(1)
  }

  // Determine chart size based on height prop
  const getChartSize = () => {
    switch (height) {
      case 'h-32': return 'w-32 h-32' // 128px for dashboard preview
      case 'h-40': return 'w-40 h-40' // 160px
      case 'h-48': return 'w-48 h-48' // 192px
      case 'h-64': return 'w-64 h-64' // 256px
      case 'h-80': return 'w-72 h-72' // 288px for main charts
      case 'h-96': return 'w-80 h-80' // 320px
      default: return 'w-72 h-72'     // Default 288px
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <Title className="text-gray-900 font-bold">{title}</Title>}
          {description && <Text className="text-gray-600">{description}</Text>}
        </div>
      )}
      
      <div className={`flex ${showLegend ? 'flex-col lg:flex-row' : 'justify-center'} gap-8 ${height} min-h-fit overflow-visible`}>
        {/* Donut Chart */}
        <div className={`${showLegend ? 'lg:w-2/3' : 'w-full'} flex justify-center items-center py-4`}>
          <div className="relative overflow-visible">
            <TremorDonutChart
              data={formattedData}
              category="value"
              index="name"
              colors={tremorColors}
              className={getChartSize()}
              showLabel={showLabels}
              showAnimation={showAnimation}
              showTooltip={showTooltip}
              customTooltip={(props) => {
                if (!showTooltip || !props.active || !props.payload) return null
                
                const data = props.payload[0]
                if (!data) return null
                
                // Find the correct hex color for this data point
                const dataIndex = formattedData.findIndex(item => item.name === data.name)
                const correctColor = hexColors[dataIndex] || data.color
                
                // Calculate tooltip positioning at outer edge of hovered segment
                const getTooltipPosition = () => {
                  const x = props.coordinate?.x || 0
                  const y = props.coordinate?.y || 0
                  
                  // Chart center is approximately at (144, 144) for a 288px (w-72 h-72) chart
                  const chartCenterX = 144
                  const chartCenterY = 144
                  const donutOuterRadius = 120 // Actual donut outer radius (smaller than full chart area)
                  const tooltipOffset = 8 // Small offset from donut edge (5-10px as requested)
                  
                  // Calculate angle from center to mouse position (hovered segment)
                  const deltaX = x - chartCenterX
                  const deltaY = y - chartCenterY
                  const angle = Math.atan2(deltaY, deltaX)
                  
                  // Position tooltip just outside the donut ring at the segment's edge
                  const tooltipRadius = donutOuterRadius + tooltipOffset
                  const tooltipX = chartCenterX + Math.cos(angle) * tooltipRadius
                  const tooltipY = chartCenterY + Math.sin(angle) * tooltipRadius
                  
                  // Determine positioning class based on angle for optimal readability
                  const normalizedAngle = ((angle * 180 / Math.PI) + 360) % 360
                  let positioningClass = 'transform -translate-x-1/2 -translate-y-1/2'
                  
                  // Adjust tooltip anchor point based on position to ensure visibility
                  if (normalizedAngle >= 330 || normalizedAngle < 30) {
                    // Right side - anchor from left edge
                    positioningClass = 'transform -translate-y-1/2'
                  } else if (normalizedAngle >= 30 && normalizedAngle < 60) {
                    // Bottom-right - anchor from top-left corner
                    positioningClass = 'transform -translate-y-3/4'
                  } else if (normalizedAngle >= 60 && normalizedAngle < 120) {
                    // Bottom side - anchor from top edge
                    positioningClass = 'transform -translate-x-1/2'
                  } else if (normalizedAngle >= 120 && normalizedAngle < 150) {
                    // Bottom-left - anchor from top-right corner
                    positioningClass = 'transform -translate-x-3/4'
                  } else if (normalizedAngle >= 150 && normalizedAngle < 210) {
                    // Left side - anchor from right edge
                    positioningClass = 'transform -translate-x-full -translate-y-1/2'
                  } else if (normalizedAngle >= 210 && normalizedAngle < 240) {
                    // Top-left - anchor from bottom-right corner
                    positioningClass = 'transform -translate-x-full -translate-y-1/4'
                  } else if (normalizedAngle >= 240 && normalizedAngle < 300) {
                    // Top side - anchor from bottom edge  
                    positioningClass = 'transform -translate-x-1/2 -translate-y-full'
                  } else {
                    // Top-right - anchor from bottom-left corner
                    positioningClass = 'transform -translate-x-1/4 -translate-y-full'
                  }
                  
                  return {
                    left: `${tooltipX}px`,
                    top: `${tooltipY}px`,
                    className: positioningClass
                  }
                }
                
                const tooltipPosition = getTooltipPosition()
                
                return (
                  <div 
                    className={`absolute bg-white p-2 border border-gray-200 rounded-lg shadow-lg z-50 pointer-events-none whitespace-nowrap ${tooltipPosition.className}`}
                    style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: correctColor }}
                      />
                      <p className="font-medium text-gray-900 text-sm">{data.name}</p>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-600">Value:</span>
                        <span className="font-medium text-gray-900 text-xs">
                          {defaultFormatter(data.value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-600">Share:</span>
                        <span className="font-medium text-gray-900 text-xs">
                          {defaultPercentageFormatter(data.payload.percentage)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            
            {/* Center Content */}
            {(centerContent || !showLegend) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {centerContent || (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {centerStats.total}
                    </div>
                    <div className="text-sm text-gray-500">
                      Total {centerStats.label}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Legend */}
        {showLegend && (
          <div className="lg:w-1/3 flex flex-col justify-start lg:justify-center min-h-0">
            <div className="space-y-2">
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
                    <span className="text-sm font-medium text-gray-900">
                      {defaultFormatter(item.value)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {defaultPercentageFormatter(item.percentage)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Total Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="text-sm font-bold text-gray-900">
                  {centerStats.total}
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