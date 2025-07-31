'use client'

import React from 'react'
import { BarChart as TremorBarChart } from '@tremor/react'
import { getTremorColor, TREMOR_COLOR_HEX } from '@/lib/tremor-utils'

interface TremorBarChartProps {
  data: any[]
  index: string
  categories: string[]
  colors?: string[]
  className?: string
  valueFormatter?: (value: number) => string
  layout?: 'vertical' | 'horizontal'
  showLegend?: boolean
  showGridLines?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  yAxisWidth?: number
  autoMinValue?: boolean
}

// Create a wrapper that ensures colors work properly
export function BarChartWrapper({
  data,
  index,
  categories,
  colors = ['blue'],
  className = '',
  valueFormatter,
  layout = 'vertical',
  showLegend = false,
  showGridLines = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 60,
  autoMinValue = false,
}: TremorBarChartProps) {
  // Process colors to ensure they're valid
  const processedColors = colors.map(color => {
    // If it's a HEX color, return as-is
    if (color.startsWith('#')) {
      return color
    }
    // Otherwise, get the valid Tremor color
    const tremorColor = getTremorColor(color)
    // Return the HEX value for the color
    return TREMOR_COLOR_HEX[tremorColor]
  })

  return (
    <div className={className}>
      <TremorBarChart
        data={data}
        index={index}
        categories={categories}
        colors={processedColors}
        valueFormatter={valueFormatter}
        layout={layout}
        showLegend={showLegend}
        showGridLines={showGridLines}
        showXAxis={showXAxis}
        showYAxis={showYAxis}
        yAxisWidth={yAxisWidth}
        autoMinValue={autoMinValue}
      />
    </div>
  )
}