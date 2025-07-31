'use client'

import React, { useEffect, useRef } from 'react'
import { LineChart as TremorLineChart, Card, Title, Text } from '@tremor/react'
import { getTremorColor, TREMOR_COLOR_HEX } from '@/lib/tremor-utils'

// Types for GA4/Google Ads time series data
export interface TimeSeriesDataPoint {
  date: string
  sessions?: number
  users?: number
  pageviews?: number
  clicks?: number
  impressions?: number
  cost?: number
  conversions?: number
  ctr?: number  // Click-through rate
  cpc?: number  // Cost per click
  roas?: number // Return on ad spend
}

export interface LineChartProps {
  data: TimeSeriesDataPoint[]
  title?: string
  description?: string
  metrics: string[] // Which metrics to display as lines
  height?: string
  colors?: string[]
  showLegend?: boolean
  showGridLines?: boolean
  formatYAxis?: (value: number) => string
  formatTooltip?: (value: number, metric: string) => string
  className?: string
}

// Vibrant SaaS color palette optimized for modern dashboards - matching homepage theme
const DEFAULT_COLORS = [
  'indigo',     // Primary brand color  
  'emerald',    // Success/growth color
  'pink',       // Secondary brand color
  'cyan',       // Accent color
  'amber',      // Warning/highlight color
  'violet',     // Premium color
  'rose',       // Alert color
  'green'       // Positive indicator
]

// Default formatters for common GA4/Ads metrics
const DEFAULT_FORMATTERS = {
  sessions: (value: number) => value.toLocaleString(),
  users: (value: number) => value.toLocaleString(),
  pageviews: (value: number) => value.toLocaleString(),
  clicks: (value: number) => value.toLocaleString(),
  impressions: (value: number) => value.toLocaleString(),
  cost: (value: number) => `$${value.toFixed(2)}`,
  conversions: (value: number) => value.toLocaleString(),
  ctr: (value: number) => `${(value * 100).toFixed(2)}%`,
  cpc: (value: number) => `$${value.toFixed(2)}`,
  roas: (value: number) => `${value.toFixed(2)}x`
}

export function LineChart({
  data,
  title,
  description,
  metrics,
  height = 'h-80',
  colors = DEFAULT_COLORS,
  showLegend = true,
  showGridLines = true,
  formatYAxis,
  formatTooltip,
  className = ''
}: LineChartProps) {
  // Format data for Tremor LineChart
  const formattedData = data.map(point => ({
    date: point.date,
    ...point
  }))

  // Get metric labels for display
  const getMetricLabel = (metric: string): string => {
    const labels: Record<string, string> = {
      sessions: 'Sessions',
      users: 'Users', 
      pageviews: 'Pageviews',
      clicks: 'Clicks',
      impressions: 'Impressions',
      cost: 'Cost',
      conversions: 'Conversions',
      ctr: 'CTR',
      cpc: 'CPC',
      roas: 'ROAS'
    }
    return labels[metric] || metric.charAt(0).toUpperCase() + metric.slice(1)
  }

  // Default Y-axis formatter
  const defaultYAxisFormatter = (value: number): string => {
    if (formatYAxis) return formatYAxis(value)
    
    // Auto-detect metric type from first metric for formatting
    const primaryMetric = metrics[0]
    if (DEFAULT_FORMATTERS[primaryMetric as keyof typeof DEFAULT_FORMATTERS]) {
      return DEFAULT_FORMATTERS[primaryMetric as keyof typeof DEFAULT_FORMATTERS](value)
    }
    
    return value.toLocaleString()
  }

  // Default tooltip formatter
  const defaultTooltipFormatter = (value: number, metric: string): string => {
    if (formatTooltip) return formatTooltip(value, metric)
    
    if (DEFAULT_FORMATTERS[metric as keyof typeof DEFAULT_FORMATTERS]) {
      return DEFAULT_FORMATTERS[metric as keyof typeof DEFAULT_FORMATTERS](value)
    }
    
    return value.toLocaleString()
  }

  // Convert color names to valid Tremor color names (not hex)
  const tremorColors = colors.slice(0, metrics.length).map(color => {
    // If it's a HEX color, we need to find the closest Tremor color name
    if (color.startsWith('#')) {
      // For now, map hex to closest tremor color name
      const colorMap: Record<string, string> = {
        '#6366f1': 'indigo',
        '#10b981': 'emerald', 
        '#ec4899': 'pink',
        '#06b6d4': 'cyan',
        '#fbbf24': 'amber',
        '#8b5cf6': 'violet',
        '#fb7185': 'rose',
        '#34d399': 'green'
      }
      return colorMap[color] || 'blue'
    }
    // Otherwise, get the valid Tremor color name
    return getTremorColor(color)
  })

  // Also keep hex values for our manual fixes
  const hexColors = tremorColors.map(colorName => TREMOR_COLOR_HEX[colorName as keyof typeof TREMOR_COLOR_HEX])

  const chartRef = useRef<HTMLDivElement>(null)

  // Diagnostic function to understand DOM structure
  const diagnoseLegendStructure = () => {
    if (chartRef.current) {
      console.log('=== LEGEND DIAGNOSIS ===')
      console.log('Chart container:', chartRef.current)
      
      // Find all possible legend elements
      const allLegends = chartRef.current.querySelectorAll('[class*="legend"]')
      console.log('All legend elements:', allLegends)
      
      const rechartLegends = chartRef.current.querySelectorAll('.recharts-default-legend, .recharts-legend-wrapper')
      console.log('Recharts legend elements:', rechartLegends)
      
      const legendItems = chartRef.current.querySelectorAll('.recharts-legend-item')
      console.log('Legend items found:', legendItems.length, legendItems)
      
      legendItems.forEach((item, index) => {
        console.log(`Legend item ${index}:`, item)
        console.log(`  - innerHTML:`, item.innerHTML)
        console.log(`  - all children:`, item.children)
        console.log(`  - SVG elements:`, item.querySelectorAll('svg, svg *'))
      })
      
      console.log('Expected colors:', hexColors)
      console.log('=== END DIAGNOSIS ===')
    }
  }

  // Simplified fix - Tremor should handle colors correctly now with proper color names
  useEffect(() => {
    const timer = setTimeout(() => {
      if (chartRef.current) {
        // Log for debugging
        console.log('Tremor colors:', tremorColors)
        console.log('Hex colors for fallback:', hexColors)
        
        // Only apply fallback fixes if needed
        const legendItems = chartRef.current.querySelectorAll('.recharts-legend-item')
        if (legendItems.length > 0) {
          legendItems.forEach((item, index) => {
            if (hexColors[index]) {
              // Minimal fallback: just set the SVG rect fill color
              const rects = item.querySelectorAll('svg rect')
              rects.forEach(rect => {
                ;(rect as SVGElement).style.fill = hexColors[index]
                ;(rect as SVGElement).setAttribute('fill', hexColors[index])
              })
            }
          })
        }
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [tremorColors, hexColors, formattedData])

  return (
    <div className={`w-full ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <Title className="text-gray-900 font-semibold">{title}</Title>}
          {description && <Text className="text-gray-600">{description}</Text>}
        </div>
      )}
      
      <div className={height} ref={chartRef}>
        <TremorLineChart
          data={formattedData}
          index="date"
          categories={metrics}
          colors={tremorColors}
          yAxisWidth={60}
          showLegend={showLegend}
          showGridLines={showGridLines}
          valueFormatter={defaultYAxisFormatter}
          className="h-full"
          style={{
            '--tw-stroke-opacity': '1'
          } as React.CSSProperties}
          customTooltip={(props) => {
            if (!props.active || !props.payload || !props.label) return null
            
            return (
              <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="font-medium text-gray-900 mb-2">{props.label}</p>
                {props.payload.map((entry: any, index: number) => {
                  // Get the correct hex color for this metric
                  const metricIndex = metrics.indexOf(entry.dataKey)
                  const correctColor = hexColors[metricIndex] || entry.color
                  
                  return (
                    <div key={index} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: correctColor }}
                        />
                        <span className="text-sm text-gray-600">
                          {getMetricLabel(entry.dataKey)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {defaultTooltipFormatter(entry.value, entry.dataKey)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

// Preset configurations for common GA4 metrics
export const GA4_TRAFFIC_METRICS: string[] = ['sessions', 'users', 'pageviews']
export const GA4_ENGAGEMENT_METRICS: string[] = ['sessions', 'conversions']
export const GOOGLE_ADS_PERFORMANCE_METRICS: string[] = ['clicks', 'impressions', 'cost']
export const GOOGLE_ADS_EFFICIENCY_METRICS: string[] = ['ctr', 'cpc', 'roas']

// Preset LineChart components for common use cases
export function TrafficLineChart(props: Omit<LineChartProps, 'metrics'>) {
  return <LineChart {...props} metrics={GA4_TRAFFIC_METRICS} />
}

export function EngagementLineChart(props: Omit<LineChartProps, 'metrics'>) {
  return <LineChart {...props} metrics={GA4_ENGAGEMENT_METRICS} />
}

export function AdsPerformanceLineChart(props: Omit<LineChartProps, 'metrics'>) {
  return <LineChart {...props} metrics={GOOGLE_ADS_PERFORMANCE_METRICS} />
}

export function AdsEfficiencyLineChart(props: Omit<LineChartProps, 'metrics'>) {
  return <LineChart {...props} metrics={GOOGLE_ADS_EFFICIENCY_METRICS} />
}