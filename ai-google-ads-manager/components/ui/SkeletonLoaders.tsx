'use client'

import React from 'react'

// Base skeleton component with animation
export const SkeletonBase: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

// Chart skeleton loader
export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`${height} w-full flex flex-col justify-between p-4 bg-white rounded-lg border border-gray-200`}>
    {/* Chart title skeleton */}
    <div className="flex justify-between items-center mb-4">
      <SkeletonBase className="h-5 w-32" />
      <SkeletonBase className="h-4 w-16" />
    </div>
    
    {/* Chart area skeleton */}
    <div className="flex-1 flex items-end justify-between space-x-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonBase 
          key={i} 
          className={`w-8 bg-gray-300 ${i % 3 === 0 ? 'h-24' : i % 2 === 0 ? 'h-16' : 'h-12'}`} 
        />
      ))}
    </div>
    
    {/* Legend skeleton */}
    <div className="flex justify-center space-x-4 mt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <SkeletonBase className="h-3 w-3 rounded-full" />
          <SkeletonBase className="h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
)

// Donut chart skeleton loader
export const DonutChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-80' }) => (
  <div className={`${height} w-full flex items-center justify-center bg-white rounded-lg border border-gray-200 p-4`}>
    <div className="relative">
      {/* Donut ring skeleton */}
      <div className="w-48 h-48 rounded-full border-8 border-gray-200 animate-pulse">
        <div className="w-32 h-32 rounded-full border-8 border-gray-100 m-6 flex items-center justify-center">
          {/* Center text skeleton */}
          <div className="text-center">
            <SkeletonBase className="h-8 w-16 mb-2 mx-auto" />
            <SkeletonBase className="h-4 w-20 mx-auto" />
          </div>
        </div>
      </div>
      
      {/* Legend skeleton */}
      <div className="absolute -right-40 top-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <SkeletonBase className="h-4 w-4 rounded-full" />
            <div className="space-y-1">
              <SkeletonBase className="h-3 w-24" />
              <SkeletonBase className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

// Line chart skeleton loader
export const LineChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`${height} w-full bg-white rounded-lg border border-gray-200 p-4`}>
    {/* Title skeleton */}
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-5 w-40" />
      <SkeletonBase className="h-4 w-20" />
    </div>
    
    {/* Chart area */}
    <div className="relative h-40">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-right pr-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBase key={i} className="h-3 w-8" />
        ))}
      </div>
      
      {/* Chart line area */}
      <div className="ml-12 h-full relative">
        <svg className="w-full h-full">
          <defs>
            <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f3f4f6" stopOpacity="1" />
              <stop offset="50%" stopColor="#e5e7eb" stopOpacity="1" />
              <stop offset="100%" stopColor="#f3f4f6" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path 
            d="M 0 120 Q 50 80 100 100 T 200 90 T 300 110 T 400 95" 
            stroke="url(#skeleton-gradient)" 
            strokeWidth="3" 
            fill="none"
            className="animate-pulse"
          />
        </svg>
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 ml-12">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBase key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
)

// Metric card skeleton loader
export const MetricCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBase className="h-4 w-24" />
        <SkeletonBase className="h-8 w-16" />
        <SkeletonBase className="h-3 w-20" />
      </div>
      <SkeletonBase className="h-12 w-12 rounded-lg" />
    </div>
  </div>
)

// Table skeleton loader
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    {/* Table header */}
    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
      <div className="flex space-x-6">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBase key={i} className="h-4 w-24" />
        ))}
      </div>
    </div>
    
    {/* Table rows */}
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4">
          <div className="flex space-x-6">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonBase 
                key={colIndex} 
                className={`h-4 ${colIndex === 0 ? 'w-32' : 'w-16'}`} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Widget skeleton with various layouts
export const WidgetSkeleton: React.FC<{ 
  variant?: 'default' | 'chart' | 'metric' | 'table'
  height?: string 
}> = ({ variant = 'default', height = 'h-64' }) => {
  switch (variant) {
    case 'chart':
      return <ChartSkeleton height={height} />
    case 'metric':
      return <MetricCardSkeleton />
    case 'table':
      return <TableSkeleton />
    default:
      return (
        <div className={`${height} w-full bg-white rounded-lg border border-gray-200 p-6`}>
          <div className="space-y-4">
            <SkeletonBase className="h-6 w-40" />
            <SkeletonBase className="h-4 w-full" />
            <SkeletonBase className="h-4 w-3/4" />
            <SkeletonBase className="h-20 w-full" />
            <div className="flex space-x-4">
              <SkeletonBase className="h-10 w-24" />
              <SkeletonBase className="h-10 w-24" />
            </div>
          </div>
        </div>
      )
  }
}

// Progressive loading skeleton that shows different phases
export const ProgressiveLoadingSkeleton: React.FC<{ 
  phase: 'initial' | 'partial' | 'complete'
  children?: React.ReactNode
}> = ({ phase, children }) => {
  if (phase === 'complete' && children) {
    return <>{children}</>
  }
  
  return (
    <div className="space-y-4">
      {/* Always show basic structure */}
      <SkeletonBase className="h-6 w-48" />
      
      {/* Show more detail in partial phase */}
      {phase === 'partial' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      )}
      
      {/* Initial phase shows minimal content */}
      {phase === 'initial' && (
        <div className="space-y-3">
          <SkeletonBase className="h-4 w-full" />
          <SkeletonBase className="h-4 w-2/3" />
          <SkeletonBase className="h-32 w-full" />
        </div>
      )}
    </div>
  )
}