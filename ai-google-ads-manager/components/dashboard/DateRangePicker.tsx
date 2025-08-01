'use client'

import React, { useState } from 'react'
import { CalendarIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useDashboard } from '@/contexts/DashboardContext'
import type { DateRange } from '@/contexts/DashboardContext'

export interface DateRangePickerProps {
  className?: string
  showPresets?: boolean
  showCustom?: boolean
}

export function DateRangePicker({ 
  className = "", 
  showPresets = true, 
  showCustom = true 
}: DateRangePickerProps) {
  const { state, setDateRange, setPresetDateRange } = useDashboard()
  const [isOpen, setIsOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(state.dateRange.startDate)
  const [customEndDate, setCustomEndDate] = useState(state.dateRange.endDate)

  const presets = [
    { key: 'last7days' as const, label: 'Last 7 days' },
    { key: 'last30days' as const, label: 'Last 30 days' },
    { key: 'last90days' as const, label: 'Last 90 days' }
  ]

  const handlePresetSelect = (preset: 'last7days' | 'last30days' | 'last90days') => {
    setPresetDateRange(preset)
    setIsOpen(false)
  }

  const handleCustomDateSubmit = () => {
    const customRange: DateRange = {
      startDate: customStartDate,
      endDate: customEndDate,
      preset: 'custom'
    }
    setDateRange(customRange)
    setIsOpen(false)
  }

  const formatDateRange = () => {
    const start = new Date(state.dateRange.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const end = new Date(state.dateRange.endDate).toLocaleDateString('en-US', {
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
    return `${start} - ${end}`
  }

  const getPresetLabel = () => {
    if (state.dateRange.preset && state.dateRange.preset !== 'custom') {
      const preset = presets.find(p => p.key === state.dateRange.preset)
      return preset?.label || 'Custom range'
    }
    return 'Custom range'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 w-full sm:w-auto"
      >
        <CalendarIcon className="h-5 w-5 text-gray-400" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">
            {getPresetLabel()}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {formatDateRange()}
          </span>
        </div>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Date Range</h3>
              
              {/* Preset Options */}
              {showPresets && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">Quick Select</h4>
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => handlePresetSelect(preset.key)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
                        state.dateRange.preset === preset.key
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Date Range */}
              {showCustom && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-3">Custom Range</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleCustomDateSubmit}
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                    >
                      Apply Custom Range
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}