'use client'

import React from 'react'
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { MetricCardSkeleton } from '../ui/SkeletonLoaders'

export interface MetricCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease'
    timeframe?: string
  }
  icon?: React.ComponentType<{ className?: string }>
  description?: string
  loading?: boolean
  error?: string
  className?: string
  onClick?: () => void
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  loading = false,
  error,
  className = '',
  onClick
}: MetricCardProps) {
  const isClickable = !!onClick

  if (loading) {
    return <MetricCardSkeleton />
  }

  if (error) {
    return (
      <div className={`bg-white overflow-hidden shadow rounded-lg p-6 border-l-4 border-red-400 ${className}`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{title}</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const changeColor = change?.type === 'increase' ? 'text-green-600' : 'text-red-600'
  const ChangeIcon = change?.type === 'increase' ? ArrowUpIcon : ArrowDownIcon

  return (
    <div 
      className={`bg-white overflow-hidden shadow rounded-lg ${
        isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 truncate">
              {title}
            </p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          {Icon && (
            <div className="flex-shrink-0">
              <Icon className="h-8 w-8 text-purple-600" />
            </div>
          )}
        </div>
        
        {(change || description) && (
          <div className="mt-4 flex items-center justify-between">
            {change && (
              <div className={`flex items-center text-sm ${changeColor}`}>
                <ChangeIcon className="h-4 w-4 mr-1" />
                <span className="font-medium">
                  {Math.abs(change.value).toFixed(1)}%
                </span>
                {change.timeframe && (
                  <span className="ml-1 text-gray-500">
                    {change.timeframe}
                  </span>
                )}
              </div>
            )}
            
            {description && (
              <p className="text-sm text-gray-500 truncate">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Specialized metric card variants
export function LoadingMetricCard({ title, className = '' }: { title: string; className?: string }) {
  return <MetricCard title={title} value="" loading className={className} />
}

export function ErrorMetricCard({ 
  title, 
  error, 
  className = '' 
}: { 
  title: string; 
  error: string; 
  className?: string 
}) {
  return <MetricCard title={title} value="" error={error} className={className} />
}