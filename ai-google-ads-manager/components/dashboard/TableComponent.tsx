'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { 
  Table, 
  TableHead, 
  TableRow, 
  TableHeaderCell, 
  TableBody, 
  TableCell,
  Card,
  Title,
  Text,
  Badge,
  Button
} from '@tremor/react'
import { 
  ChevronUpIcon, 
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

// Types for GA4/Google Ads table data
export interface TableColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'badge'
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  formatter?: (value: any, row: any) => React.ReactNode
  width?: string
}

export interface TableRow {
  [key: string]: any
}

export interface TableComponentProps<T extends TableRow> {
  data: T[]
  columns: TableColumn[]
  title?: string
  description?: string
  searchable?: boolean
  searchPlaceholder?: string
  sortable?: boolean
  paginated?: boolean
  pageSize?: number
  showRowCount?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
  onRowClick?: (row: T) => void
  highlightRow?: (row: T) => boolean
}

// Default formatters for common data types
const DEFAULT_FORMATTERS = {
  number: (value: number) => value?.toLocaleString() || '0',
  currency: (value: number) => `$${value?.toFixed(2) || '0.00'}`,
  percentage: (value: number) => `${((value || 0) * 100).toFixed(2)}%`,
  date: (value: string | Date) => {
    if (!value) return '-'
    const date = typeof value === 'string' ? new Date(value) : value
    return date.toLocaleDateString()
  },
  text: (value: any) => value?.toString() || '-'
}

export function TableComponent<T extends TableRow>({
  data,
  columns,
  title,
  description,
  searchable = false,
  sortable = false,
  paginated = false,
  pageSize = 10,
  searchPlaceholder = 'Search...',
  showRowCount = false,
  loading = false,
  emptyMessage = "No data available",
  className = '',
  onRowClick,
  highlightRow
}: TableComponentProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering interactive elements on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    
    return data.filter(row =>
      columns.some(column => {
        const value = row[column.key]
        if (value == null) return false
        return value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      })
    )
  }, [data, searchTerm, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1
      
      let comparison = 0
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else {
        comparison = aValue.toString().localeCompare(bValue.toString())
      }
      
      return sortConfig.direction === 'desc' ? -comparison : comparison
    })
  }, [filteredData, sortConfig])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData
    
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize, paginated])

  // Calculate pagination info
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const startRow = (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, sortedData.length)

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (!sortable) return
    
    const column = columns.find(col => col.key === columnKey)
    if (!column?.sortable) return

    setSortConfig(current => {
      if (current?.key === columnKey) {
        return {
          key: columnKey,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key: columnKey, direction: 'asc' }
    })
  }

  // Format cell value
  const formatCellValue = (value: any, column: TableColumn, row: TableRow) => {
    if (column.formatter) {
      return column.formatter(value, row)
    }

    if (value == null) return '-'

    switch (column.type) {
      case 'number':
        return DEFAULT_FORMATTERS.number(value)
      case 'currency':
        return DEFAULT_FORMATTERS.currency(value)
      case 'percentage':
        return DEFAULT_FORMATTERS.percentage(value)
      case 'date':
        return DEFAULT_FORMATTERS.date(value)
      case 'badge':
        return <Badge color="blue">{value}</Badge>
      default:
        return DEFAULT_FORMATTERS.text(value)
    }
  }

  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        {(title || description) && (
          <div className="mb-4">
            {title && <Title>{title}</Title>}
            {description && <Text>{description}</Text>}
          </div>
        )}
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <Title>{title}</Title>}
          {description && <Text>{description}</Text>}
        </div>
      )}
      
      <Card>
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {searchable && mounted && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to first page on search
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          
          {showRowCount && (
            <Text className="text-sm text-gray-600">
              {sortedData.length} {sortedData.length === 1 ? 'row' : 'rows'}
            </Text>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeaderCell
                    key={column.key}
                    className={`${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${
                      column.sortable && sortable ? 'cursor-pointer hover:bg-gray-50' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && sortable && (
                        <div className="flex flex-col">
                          <ChevronUpIcon 
                            className={`h-3 w-3 ${
                              sortConfig?.key === column.key && sortConfig.direction === 'asc'
                                ? 'text-blue-600' 
                                : 'text-gray-400'
                            }`}
                          />
                          <ChevronDownIcon 
                            className={`h-3 w-3 -mt-0.5 ${
                              sortConfig?.key === column.key && sortConfig.direction === 'desc'
                                ? 'text-blue-600' 
                                : 'text-gray-400'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                      highlightRow?.(row) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                      >
                        {formatCellValue(row[column.key], column, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {paginated && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-200">
            <Text className="text-sm text-gray-600">
              Showing {startRow} to {endRow} of {sortedData.length} entries
            </Text>
            
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1
                  const isCurrentPage = page === currentPage
                  const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                  
                  if (!showPage && page !== 2 && page !== totalPages - 1) {
                    return page === 2 || page === totalPages - 1 ? (
                      <span key={page} className="px-2 text-gray-400">...</span>
                    ) : null
                  }
                  
                  return (
                    <Button
                      key={page}
                      variant={isCurrentPage ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="min-w-[2rem]"
                    >
                      {page}
                    </Button>
                  )
                })}
              </div>
              
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// Common GA4/Google Ads table configurations
export const GA4_PAGES_COLUMNS: TableColumn[] = [
  { key: 'page', label: 'Page', type: 'text', sortable: true, align: 'left' },
  { key: 'pageviews', label: 'Pageviews', type: 'number', sortable: true, align: 'right' },
  { key: 'uniquePageviews', label: 'Unique Pageviews', type: 'number', sortable: true, align: 'right' },
  { key: 'avgTimeOnPage', label: 'Avg. Time on Page', type: 'text', sortable: true, align: 'right' },
  { key: 'bounceRate', label: 'Bounce Rate', type: 'percentage', sortable: true, align: 'right' }
]

export const GOOGLE_ADS_CAMPAIGNS_COLUMNS: TableColumn[] = [
  { key: 'campaign', label: 'Campaign', type: 'text', sortable: true, align: 'left' },
  { key: 'status', label: 'Status', type: 'badge', sortable: true, align: 'center' },
  { key: 'clicks', label: 'Clicks', type: 'number', sortable: true, align: 'right' },
  { key: 'impressions', label: 'Impressions', type: 'number', sortable: true, align: 'right' },
  { key: 'ctr', label: 'CTR', type: 'percentage', sortable: true, align: 'right' },
  { key: 'avgCpc', label: 'Avg. CPC', type: 'currency', sortable: true, align: 'right' },
  { key: 'cost', label: 'Cost', type: 'currency', sortable: true, align: 'right' },
  { key: 'conversions', label: 'Conversions', type: 'number', sortable: true, align: 'right' }
]

export const GA4_TRAFFIC_SOURCES_COLUMNS: TableColumn[] = [
  { key: 'source', label: 'Source', type: 'text', sortable: true, align: 'left' },
  { key: 'medium', label: 'Medium', type: 'text', sortable: true, align: 'left' },
  { key: 'sessions', label: 'Sessions', type: 'number', sortable: true, align: 'right' },
  { key: 'users', label: 'Users', type: 'number', sortable: true, align: 'right' },
  { key: 'newUsers', label: 'New Users', type: 'number', sortable: true, align: 'right' },
  { key: 'sessionDuration', label: 'Avg. Session Duration', type: 'text', sortable: true, align: 'right' },
  { key: 'pagesPerSession', label: 'Pages/Session', type: 'number', sortable: true, align: 'right' }
]