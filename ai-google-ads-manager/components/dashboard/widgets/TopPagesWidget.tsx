'use client'

import React, { useMemo } from 'react'
import { TableComponent, GA4_PAGES_COLUMNS } from '@/components/dashboard'
import { sampleData } from '@/components/dashboard/sampleData'

export interface TopPagesWidgetProps {
  data?: typeof sampleData.pages
  loading?: boolean
  error?: string
  className?: string
  maxRows?: number
  showSearch?: boolean
  showPagination?: boolean
}

export const TopPagesWidget: React.FC<TopPagesWidgetProps> = ({
  data = sampleData.pages,
  loading = false,
  error,
  className = '',
  maxRows = 10,
  showSearch = true,
  showPagination = true
}) => {
  // Enhanced pages data with calculated metrics
  const processedData = useMemo(() => {
    // Ensure data is an array and has valid entries
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }
    
    return data.map(page => ({
      ...page,
      // Add conversion rate calculation
      conversionRate: page.sessions && page.sessions > 0 
        ? ((page.conversions || 0) / page.sessions) * 100 
        : 0,
      // Add revenue estimation
      estimatedRevenue: (page.conversions || 0) * 45.50, // Assuming $45.50 AOV
      // Ensure sessions and conversions have fallback values
      sessions: page.sessions || 0,
      conversions: page.conversions || 0
    }))
  }, [data])

  // Enhanced columns with additional metrics
  const enhancedColumns = [
    ...GA4_PAGES_COLUMNS,
    {
      key: 'sessions',
      label: 'Sessions',
      type: 'number' as const,
      sortable: true,
      align: 'right' as const,
      formatter: (value: number) => (value || 0).toLocaleString()
    },
    {
      key: 'conversions',
      label: 'Conversions',
      type: 'number' as const,
      sortable: true,
      align: 'right' as const,
      formatter: (value: number) => (value || 0).toLocaleString()
    },
    {
      key: 'conversionRate',
      label: 'Conv. Rate',
      type: 'percentage' as const,
      sortable: true,
      align: 'right' as const,
      formatter: (value: number) => `${(value || 0).toFixed(2)}%`
    },
    {
      key: 'estimatedRevenue',
      label: 'Est. Revenue',
      type: 'currency' as const,
      sortable: true,
      align: 'right' as const,
      formatter: (value: number) => `$${(value || 0).toFixed(2)}`
    }
  ]

  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading pages data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Top Pages</h3>
            <p className="text-sm text-gray-500 mt-1">Page performance by sessions and conversions</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              High performing
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Needs attention
            </span>
          </div>
        </div>
        
        <TableComponent
          data={processedData}
          columns={enhancedColumns}
          loading={loading}
          searchable={showSearch}
          sortable={true}
          pagination={showPagination}
          pageSize={maxRows}
          title=""
          description=""
          emptyMessage="No page data available"
          // Custom row styling based on performance
          rowClassName={(row) => {
            const conversionRate = row.conversionRate || 0
            if (conversionRate >= 3.0) return 'border-l-4 border-green-500 bg-green-50/30'
            if (conversionRate >= 1.0) return 'border-l-4 border-yellow-500 bg-yellow-50/30'
            return 'border-l-4 border-gray-200'
          }}
          // Quick actions for each row
          actions={[
            {
              label: 'View Details',
              onClick: (row) => {
                console.log('View page details:', row.page)
                // This would navigate to a detailed page analysis
              },
              icon: '👁️'
            },
            {
              label: 'Optimize',
              onClick: (row) => {
                console.log('Optimize page:', row.page)
                // This would open optimization suggestions
              },
              icon: '⚡'
            }
          ]}
        />
      </div>
    </div>
  )
}