'use client'

import { DashboardLayout, DateRangePicker } from '@/components/dashboard'
import { useDashboard } from '@/contexts/DashboardContext'
import { useState } from 'react'
import { CalendarIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export default function DateRangeTestPage() {
  const { state, setDateRange, setPresetDateRange } = useDashboard()
  const [testResults, setTestResults] = useState<Array<{ test: string; passed: boolean; details: string }>>([])

  const runTests = () => {
    const results = []
    
    // Test 1: Check if date range context is available
    const hasDateRange = state.dateRange && state.dateRange.startDate && state.dateRange.endDate
    results.push({
      test: "Date Range Context Available",
      passed: hasDateRange,
      details: hasDateRange ? `Start: ${state.dateRange.startDate}, End: ${state.dateRange.endDate}` : "Date range not found in context"
    })

    // Test 2: Check if preset is properly set
    const hasPreset = state.dateRange && state.dateRange.preset
    results.push({
      test: "Date Range Preset Available",
      passed: hasPreset,
      details: hasPreset ? `Current preset: ${state.dateRange.preset}` : "No preset found"
    })

    // Test 3: Check date range validity
    const validDates = hasDateRange && new Date(state.dateRange.startDate) <= new Date(state.dateRange.endDate)
    results.push({
      test: "Date Range Validity",
      passed: validDates,
      details: validDates ? "Start date is before or equal to end date" : "Invalid date range detected"
    })

    // Test 4: Check if functions are available
    const hasFunctions = typeof setDateRange === 'function' && typeof setPresetDateRange === 'function'
    results.push({
      test: "Date Range Functions Available",
      passed: hasFunctions,
      details: hasFunctions ? "setDateRange and setPresetDateRange functions available" : "Date range functions not available"
    })

    setTestResults(results)
  }

  const testPresetChange = (preset: 'last7days' | 'last30days' | 'last90days') => {
    const beforeDate = state.dateRange.startDate
    setPresetDateRange(preset)
    
    // Add a small delay to check if the change took effect
    setTimeout(() => {
      const afterDate = state.dateRange.startDate
      const changed = beforeDate !== afterDate
      
      setTestResults(prev => [...prev, {
        test: `Preset Change to ${preset}`,
        passed: changed && state.dateRange.preset === preset,
        details: changed ? `Successfully changed from ${beforeDate} to ${afterDate}` : "Date range did not change"
      }])
    }, 100)
  }

  const testCustomDateRange = () => {
    const customStart = '2024-06-01'
    const customEnd = '2024-06-30'
    
    setDateRange({
      startDate: customStart,
      endDate: customEnd,
      preset: 'custom'
    })

    setTimeout(() => {
      const isCustomSet = state.dateRange.startDate === customStart && 
                         state.dateRange.endDate === customEnd &&
                         state.dateRange.preset === 'custom'
      
      setTestResults(prev => [...prev, {
        test: "Custom Date Range Set",
        passed: isCustomSet,
        details: isCustomSet ? 
          `Successfully set custom range: ${customStart} to ${customEnd}` : 
          `Failed to set custom range. Current: ${state.dateRange.startDate} to ${state.dateRange.endDate}`
      }])
    }, 100)
  }

  const clearTests = () => {
    setTestResults([])
  }

  return (
    <DashboardLayout title="Date Range Functionality Test" showDatePicker={true} showSettings={false}>
      <div className="space-y-6">
        {/* Current Date Range Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Current Date Range Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <p className="text-lg font-mono text-gray-900">{state.dateRange?.startDate || 'Not set'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <p className="text-lg font-mono text-gray-900">{state.dateRange?.endDate || 'Not set'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">Preset</label>
              <p className="text-lg font-mono text-gray-900">{state.dateRange?.preset || 'Not set'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">Date Count</label>
              <p className="text-lg font-mono text-gray-900">
                {state.dateRange?.startDate && state.dateRange?.endDate 
                  ? Math.ceil((new Date(state.dateRange.endDate).getTime() - new Date(state.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                  : 0
                } days
              </p>
            </div>
          </div>
        </div>

        {/* Date Range Picker Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Interactive Date Range Picker</h3>
          <div className="space-y-4">
            <p className="text-gray-600">Use the date range picker below to test functionality:</p>
            <DateRangePicker className="w-full sm:w-auto" showPresets={true} showCustom={true} />
            <p className="text-sm text-gray-500">
              Try selecting different presets and custom date ranges to see if the context updates correctly.
            </p>
          </div>
        </div>

        {/* Manual Test Buttons */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Test Controls</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => testPresetChange('last7days')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Last 7 Days
            </button>
            <button
              onClick={() => testPresetChange('last30days')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Last 30 Days
            </button>
            <button
              onClick={() => testPresetChange('last90days')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Last 90 Days
            </button>
            <button
              onClick={testCustomDateRange}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Test Custom Range
            </button>
          </div>
        </div>

        {/* Automated Tests */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Automated Tests</h3>
          <div className="flex space-x-4 mb-4">
            <button
              onClick={runTests}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Run Tests
            </button>
            <button
              onClick={clearTests}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Results
            </button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Test Results:</h4>
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 p-3 rounded-lg ${
                    result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {result.passed ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
                      {result.test}
                    </p>
                    <p className={`text-sm ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                      {result.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug Information */}
        <div className="bg-gray-900 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">Debug Information</h3>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(state.dateRange, null, 2)}
          </pre>
        </div>
      </div>
    </DashboardLayout>
  )
}