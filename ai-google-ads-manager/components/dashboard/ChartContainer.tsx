'use client'

import React from 'react'
import { 
  InformationCircleIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline'

export interface ChartContainerProps {
  title: string
  children: React.ReactNode
  description?: string
  loading?: boolean
  error?: string
  onRefresh?: () => void
  actions?: React.ReactNode
  className?: string
  height?: string
}

export function ChartContainer({
  title,
  children,
  description,
  loading = false,
  error,
  onRefresh,
  actions,
  className = '',
  height = 'h-80'
}: ChartContainerProps) {
  if (loading) {
    return (
      <div className={`bg-white shadow rounded-lg ${className}`}>
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {title}
              </h3>
              {description && (
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {description}
                </p>
              )}
            </div>
            <div className="animate-spin">
              <ArrowPathIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        <div className={`px-6 py-6 ${height}`}>
          <div className="animate-pulse flex flex-col h-full">
            <div className="flex-1 space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white shadow rounded-lg ${className}`}>
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {title}
          </h3>
        </div>
        
        <div className={`px-6 py-6 ${height} flex items-center justify-center`}>
          <div className="text-center">
            <InformationCircleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Chart Error</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            {onRefresh && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white shadow rounded-lg flex flex-col ${className}`}>
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {title}
            </h3>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                title="Refresh data"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            )}
            
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="px-6 py-6 flex-1 min-h-0 overflow-visible">
        {children}
      </div>
    </div>
  )
}

// Preset chart container sizes
export function SmallChartContainer(props: Omit<ChartContainerProps, 'height'>) {
  return <ChartContainer {...props} height="h-64" />
}

export function MediumChartContainer(props: Omit<ChartContainerProps, 'height'>) {
  return <ChartContainer {...props} height="h-80" />
}

export function LargeChartContainer(props: Omit<ChartContainerProps, 'height'>) {
  return <ChartContainer {...props} height="h-96" />
}

// Chart container with dropdown menu
export function ChartContainerWithMenu({ 
  menuItems, 
  ...props 
}: ChartContainerProps & { 
  menuItems?: Array<{ label: string; onClick: () => void }> 
}) {
  const [showMenu, setShowMenu] = React.useState(false)

  const menuActions = menuItems && (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    item.onClick()
                    setShowMenu(false)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return <ChartContainer {...props} actions={menuActions} />
}