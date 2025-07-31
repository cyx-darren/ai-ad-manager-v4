'use client'

import React, { useState } from 'react'
import {
  TrafficOverviewWidget,
  ConversionWidget,
  TopPagesWidget,
  TrafficSourceWidget,
  AlertBanner
} from '@/components/dashboard'

export default function TestWidgetsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Test functions for simulating different states
  const simulateLoading = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  const simulateError = () => {
    setError('Simulated error for testing')
    setTimeout(() => setError(null), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard Widgets Test
          </h1>
          <p className="mt-2 text-gray-600">
            Testing all dashboard widgets with interactive features and sample data
          </p>
          
          {/* Test Controls */}
          <div className="mt-4 flex space-x-4">
            <button
              onClick={simulateLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Test Loading State
            </button>
            <button
              onClick={simulateError}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Test Error State
            </button>
            <button
              onClick={() => {
                setLoading(false)
                setError(null)
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Reset States
            </button>
          </div>
        </div>

        {/* Alert for testing */}
        {error && (
          <AlertBanner
            type="error"
            title="Test Error"
            message={error}
            className="mb-6"
          />
        )}
        
        {loading && (
          <AlertBanner
            type="info"
            title="Loading Test"
            message="Testing loading states across all widgets..."
            className="mb-6"
          />
        )}

        <div className="space-y-8">
          {/* Traffic Overview Widget */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Traffic Overview Widget
            </h2>
            <p className="text-gray-600 mb-4">
              Combines line chart visualization with key traffic metrics and period-over-period comparison.
            </p>
            <TrafficOverviewWidget
              loading={loading}
              error={error || undefined}
              className="w-full"
            />
          </section>

          {/* Conversion Widget */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Conversion Widget
            </h2>
            <p className="text-gray-600 mb-4">
              Displays conversion metrics, rates, and channel comparison with revenue calculations.
            </p>
            <ConversionWidget
              loading={loading}
              error={error || undefined}
              className="w-full"
            />
          </section>

          {/* Top Pages Widget */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Top Pages Widget
            </h2>
            <p className="text-gray-600 mb-4">
              Interactive table showing top performing pages with search, sort, pagination, and performance indicators.
            </p>
            <TopPagesWidget
              loading={loading}
              error={error || undefined}
              className="w-full"
              maxRows={8}
              showSearch={true}
              showPagination={true}
            />
          </section>

          {/* Traffic Source Widget - Full Featured */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Traffic Source Widget (Full Featured)
            </h2>
            <p className="text-gray-600 mb-4">
              Donut chart with Google Ads highlighting, filtering, and dedicated metrics. Test all filter modes!
            </p>
            <TrafficSourceWidget
              loading={loading}
              error={error || undefined}
              className="w-full"
              showGoogleAdsFilter={true}
            />
          </section>

          {/* Traffic Source Widget - Simple */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Traffic Source Widget (Simple)
            </h2>
            <p className="text-gray-600 mb-4">
              Same widget without Google Ads filtering for comparison.
            </p>
            <TrafficSourceWidget
              loading={loading}
              error={error || undefined}
              className="w-full"
              showGoogleAdsFilter={false}
            />
          </section>

          {/* Widget Grid Layout Example */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Dashboard Grid Layout Example
            </h2>
            <p className="text-gray-600 mb-4">
              Example of how widgets would appear in a real dashboard layout.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrafficOverviewWidget
                loading={loading}
                error={error || undefined}
                className="lg:col-span-2"
              />
              <ConversionWidget
                loading={loading}
                error={error || undefined}
              />
              <TrafficSourceWidget
                loading={loading}
                error={error || undefined}
                showGoogleAdsFilter={true}
              />
              <TopPagesWidget
                loading={loading}
                error={error || undefined}
                className="lg:col-span-2"
                maxRows={5}
                showSearch={true}
                showPagination={false}
              />
            </div>
          </section>

          {/* Feature Summary */}
          <section className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Widget Features Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">TrafficOverviewWidget</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Time series visualization</li>
                  <li>✅ Metric cards with trends</li>
                  <li>✅ Period comparison</li>
                  <li>✅ Loading & error states</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">ConversionWidget</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Conversion metrics</li>
                  <li>✅ Revenue calculations</li>
                  <li>✅ Channel comparison</li>
                  <li>✅ Rate calculations</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">TopPagesWidget</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Interactive table</li>
                  <li>✅ Search & sort</li>
                  <li>✅ Performance indicators</li>
                  <li>✅ Action buttons</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">TrafficSourceWidget</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Google Ads filtering</li>
                  <li>✅ Source highlighting</li>
                  <li>✅ Multiple view modes</li>
                  <li>✅ Dedicated metrics</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}