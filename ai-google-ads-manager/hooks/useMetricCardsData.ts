'use client'

import { useState, useEffect } from 'react'
import { useGA4DataService } from '@/lib/ga4ApiClient'
import { useDashboard } from '@/contexts/DashboardContext'

export interface MetricCardData {
  totalCampaigns: number
  totalImpressions: number
  clickRate: number
  totalSessions: number
  totalUsers: number
  avgBounceRate: number
  conversions: number
  totalSpend: number
}

export interface MetricCardsState {
  data: MetricCardData | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
}

// Mock data for metrics not available in GA4
const MOCK_CAMPAIGN_DATA = {
  totalCampaigns: 12,
  totalImpressions: 45678,
  clickRate: 3.2,
  totalSpend: 2456
}

export const useMetricCardsData = (): MetricCardsState => {
  const { state } = useDashboard()
  const ga4Service = useGA4DataService()
  
  const [data, setData] = useState<MetricCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchMetricCardsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching metric cards data...')
      
      // Fetch all required data from GA4 API
      const [sessionMetrics, conversionsData] = await Promise.all([
        ga4Service.getSessionMetrics(state.dateRange),
        ga4Service.getConversions(state.dateRange)
      ])
      
      // Calculate total conversions from conversions data
      const totalConversions = conversionsData.reduce((total, conv) => total + conv.conversions, 0)
      
      // Combine GA4 data with mock campaign data
      const metricData: MetricCardData = {
        // From GA4 API
        totalSessions: sessionMetrics.sessions,
        totalUsers: sessionMetrics.users,
        avgBounceRate: Number(sessionMetrics.bounceRate.toFixed(1)),
        conversions: totalConversions,
        
        // Mock data (not available in GA4)
        totalCampaigns: MOCK_CAMPAIGN_DATA.totalCampaigns,
        totalImpressions: MOCK_CAMPAIGN_DATA.totalImpressions,
        clickRate: MOCK_CAMPAIGN_DATA.clickRate,
        totalSpend: MOCK_CAMPAIGN_DATA.totalSpend
      }
      
      console.log('✅ Successfully fetched metric cards data:', metricData)
      
      setData(metricData)
      setLastUpdated(new Date().toISOString())
      
    } catch (err) {
      console.error('❌ Error fetching metric cards data:', err)
      setError('Failed to fetch metrics data')
      
      // Fallback to all mock data on complete failure
      setData({
        totalCampaigns: MOCK_CAMPAIGN_DATA.totalCampaigns,
        totalImpressions: MOCK_CAMPAIGN_DATA.totalImpressions,
        clickRate: MOCK_CAMPAIGN_DATA.clickRate,
        totalSessions: 8234, // fallback mock value
        totalUsers: 6543, // fallback mock value
        avgBounceRate: 42.5, // fallback mock value
        conversions: 234, // fallback mock value
        totalSpend: MOCK_CAMPAIGN_DATA.totalSpend
      })
      
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when component mounts or date range changes
  useEffect(() => {
    fetchMetricCardsData()
  }, [state.dateRange.startDate, state.dateRange.endDate])

  return {
    data,
    loading,
    error,
    lastUpdated
  }
}