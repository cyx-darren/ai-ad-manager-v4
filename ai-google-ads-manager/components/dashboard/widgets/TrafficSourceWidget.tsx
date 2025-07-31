'use client'

import React, { useState, useMemo } from 'react'
import { ChartContainer, DonutChart, TrafficSourceDonutChart, MetricCard } from '@/components/dashboard'
import { sampleData } from '@/components/dashboard/sampleData'

export interface TrafficSourceWidgetProps {
  data?: typeof sampleData.trafficSources
  loading?: boolean
  error?: string
  className?: string
  showGoogleAdsFilter?: boolean
}

export const TrafficSourceWidget: React.FC<TrafficSourceWidgetProps> = ({
  data = sampleData.trafficSources,
  loading = false,
  error,
  className = '',
  showGoogleAdsFilter = true
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'google-ads' | 'organic'>('all')
  const [highlightGoogleAds, setHighlightGoogleAds] = useState(true)

  // Process and filter data based on current filter mode
  const { filteredData, totalSessions, googleAdsMetrics } = useMemo(() => {
    // Ensure data is valid
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        filteredData: [],
        totalSessions: 0,
        googleAdsMetrics: {
          sessions: 0,
          percentage: 0,
          sources: 0
        }
      }
    }
    
    let processedData = [...data]
    
    // Identify Google Ads traffic (Paid Search, Google Ads, PPC, etc.)
    const googleAdsKeywords = ['google ads', 'paid search', 'ppc', 'cpc', 'google cpc']
    
    const googleAdsData = processedData.filter(source => 
      googleAdsKeywords.some(keyword => 
        source.name.toLowerCase().includes(keyword)
      )
    )
    
    const organicData = processedData.filter(source => 
      source.name.toLowerCase().includes('organic') || 
      source.name.toLowerCase().includes('search') && !googleAdsKeywords.some(keyword => 
        source.name.toLowerCase().includes(keyword)
      )
    )

    // Apply filter
    if (filterMode === 'google-ads') {
      processedData = googleAdsData
    } else if (filterMode === 'organic') {
      processedData = organicData
    }

    // Calculate totals
    const totalSessions = processedData.reduce((sum, source) => sum + source.value, 0)
    
    // Google Ads specific metrics
    const googleAdsSessions = googleAdsData.reduce((sum, source) => sum + source.value, 0)
    const googleAdsPercentage = data.length > 0 ? (googleAdsSessions / data.reduce((sum, source) => sum + source.value, 0)) * 100 : 0
    
    // Highlight Google Ads sources with special colors
    if (highlightGoogleAds && filterMode === 'all') {
      processedData = processedData.map(source => {
        const isGoogleAds = googleAdsKeywords.some(keyword => 
          source.name.toLowerCase().includes(keyword)
        )
        return {
          ...source,
          color: isGoogleAds ? '#ea4335' : source.color // Google red for Google Ads
        }
      })
    }

    return {
      filteredData: processedData,
      totalSessions,
      googleAdsMetrics: {
        sessions: googleAdsSessions,
        percentage: googleAdsPercentage,
        sources: googleAdsData.length
      }
    }
  }, [data, filterMode, highlightGoogleAds])

  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading traffic source data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Traffic Sources</h3>
            <p className="text-sm text-gray-500 mt-1">Session distribution by channel</p>
          </div>
          
          {showGoogleAdsFilter && (
            <div className="flex items-center space-x-4">
              {/* Google Ads Highlight Toggle */}
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={highlightGoogleAds}
                  onChange={(e) => setHighlightGoogleAds(e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                  Highlight Google Ads
                </span>
              </label>
              
              {/* Filter Buttons */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 text-xs font-medium ${
                    filterMode === 'all' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Sources
                </button>
                <button
                  onClick={() => setFilterMode('google-ads')}
                  className={`px-3 py-1 text-xs font-medium border-l border-gray-200 ${
                    filterMode === 'google-ads' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Google Ads Only
                </button>
                <button
                  onClick={() => setFilterMode('organic')}
                  className={`px-3 py-1 text-xs font-medium border-l border-gray-200 ${
                    filterMode === 'organic' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Organic Only
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Google Ads Summary Metrics */}
        {showGoogleAdsFilter && filterMode === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <MetricCard
              title="Google Ads Sessions"
              value={googleAdsMetrics.sessions}
              loading={loading}
              format="number"
              showTrend={false}
              className="bg-red-50 border-red-200"
            />
            <MetricCard
              title="Google Ads Share"
              value={googleAdsMetrics.percentage}
              loading={loading}
              format="percentage"
              showTrend={false}
              className="bg-red-50 border-red-200"
            />
            <MetricCard
              title="Google Ads Sources"
              value={googleAdsMetrics.sources}
              loading={loading}
              format="number"
              showTrend={false}
              className="bg-red-50 border-red-200"
            />
          </div>
        )}
        
        {/* Traffic Source Chart */}
        <ChartContainer
          title={`Traffic Distribution ${filterMode === 'all' ? '' : `(${filterMode.replace('-', ' ')})`}`}
          description={`${totalSessions.toLocaleString()} total sessions`}
          loading={loading}
        >
          <TrafficSourceDonutChart
            data={filteredData}
            height="h-80"
            showLegend={true}
            showTooltip={true}
            showLabels={true}
          />
        </ChartContainer>

        {/* Filter Results Info */}
        {filterMode !== 'all' && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Filter Active:</strong> Showing {filterMode.replace('-', ' ')} traffic only 
              ({filteredData.length} source{filteredData.length !== 1 ? 's' : ''}, {totalSessions.toLocaleString()} sessions)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}