'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'

// API Configuration
const GA4_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_GA4_SERVICE_URL || 'http://localhost:3001'
const API_TIMEOUT = 10000 // 10 seconds

// Types for GA4 API responses
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface SessionMetrics {
  sessions: number
  users: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  timeSeries?: Array<{
    date: string
    sessions: number
    users: number
    pageviews: number
  }>
}

export interface TrafficSource {
  source: string
  medium: string
  sessions: number
  users: number
  percentage: number
}

export interface PagePerformance {
  pagePath: string
  pageviews: number
  uniquePageviews: number
  avgTimeOnPage: number
  bounceRate: number
}

export interface ConversionData {
  conversionName: string
  conversions: number
  conversionRate: number
  conversionValue: number
}

// Mock data for development/fallback
const MOCK_DATA = {
  sessions: {
    sessions: 8200,
    users: 6150,
    pageviews: 24680,
    bounceRate: 42.3,
    avgSessionDuration: 185,
    timeSeries: [
      { date: '2024-01-15', sessions: 1200, users: 950, pageviews: 3600 },
      { date: '2024-01-16', sessions: 1150, users: 890, pageviews: 3450 },
      { date: '2024-01-17', sessions: 1300, users: 1020, pageviews: 3900 },
      { date: '2024-01-18', sessions: 1180, users: 920, pageviews: 3540 },
      { date: '2024-01-19', sessions: 1250, users: 980, pageviews: 3750 },
      { date: '2024-01-20', sessions: 1100, users: 850, pageviews: 3300 },
      { date: '2024-01-21', sessions: 1020, users: 800, pageviews: 3060 }
    ]
  } as SessionMetrics,
  
  trafficSources: [
    { source: 'google', medium: 'organic', sessions: 2850, users: 2200, percentage: 34.8 },
    { source: '(direct)', medium: '(none)', sessions: 1650, users: 1280, percentage: 20.1 },
    { source: 'google', medium: 'cpc', sessions: 1240, users: 950, percentage: 15.1 },
    { source: 'facebook', medium: 'social', sessions: 820, users: 630, percentage: 10.0 },
    { source: 'newsletter', medium: 'email', sessions: 640, users: 490, percentage: 7.8 },
    { source: 'bing', medium: 'organic', sessions: 520, users: 400, percentage: 6.3 },
    { source: 'twitter', medium: 'social', sessions: 480, users: 370, percentage: 5.9 }
  ] as TrafficSource[],
  
  pagePerformance: [
    { pagePath: '/', pageviews: 5240, uniquePageviews: 4680, avgTimeOnPage: 145, bounceRate: 38.2 },
    { pagePath: '/products', pageviews: 3200, uniquePageviews: 2890, avgTimeOnPage: 220, bounceRate: 28.5 },
    { pagePath: '/about', pageviews: 1850, uniquePageviews: 1720, avgTimeOnPage: 180, bounceRate: 45.8 },
    { pagePath: '/contact', pageviews: 1240, uniquePageviews: 1150, avgTimeOnPage: 95, bounceRate: 62.3 },
    { pagePath: '/blog', pageviews: 980, uniquePageviews: 890, avgTimeOnPage: 280, bounceRate: 35.7 }
  ] as PagePerformance[],
  
  conversions: [
    { conversionName: 'Purchase', conversions: 186, conversionRate: 2.27, conversionValue: 28650 },
    { conversionName: 'Newsletter Signup', conversions: 425, conversionRate: 5.18, conversionValue: 0 },
    { conversionName: 'Contact Form', conversions: 89, conversionRate: 1.09, conversionValue: 0 },
    { conversionName: 'Download', conversions: 156, conversionRate: 1.90, conversionValue: 0 }
  ] as ConversionData[]
}

// API Client Class
class GA4ApiClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = GA4_SERVICE_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  // Generic API request method
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    authToken?: string
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}/api/ga4${endpoint}`
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>
      }

      // Add authentication if token is provided
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      console.log(`🔌 API Request: ${url}`)
      console.log(`🔧 Request headers:`, headers)
      console.log(`⚙️ Base URL configured as:`, this.baseUrl)
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.timeout)
      })

      console.log(`📡 Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log('🔧 Raw API response:', data)
      
      return {
        success: true,
        data: data.success ? data.data : data,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error(`❌ API Error for ${endpoint}:`, error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to fetch data from ${endpoint}`,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Test GA4 service connectivity
  async testConnection(authToken?: string): Promise<ApiResponse<any>> {
    try {
      console.log('🔍 Testing connection to GA4 service...')
      console.log(`🌐 Testing URL: ${this.baseUrl}/api/ga4/health`)
      
      // Try the main health endpoint first (simpler)
      const healthUrl = `${this.baseUrl}/api/health`
      console.log(`🩺 Trying main health endpoint: ${healthUrl}`)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Main health endpoint successful:', data)
        return {
          success: true,
          data,
          timestamp: new Date().toISOString()
        }
      } else {
        console.log(`⚠️ Main health endpoint failed: ${response.status}`)
        // Fall back to GA4-specific health endpoint
        return this.request('/health', { method: 'GET' }, authToken)
      }
    } catch (error) {
      console.error('❌ Health check failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        message: 'Could not connect to GA4 service',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Fetch session metrics
  async getSessionMetrics(
    propertyId: string,
    options: {
      startDate?: string
      endDate?: string
      dimensions?: string[]
      limit?: number
    } = {},
    authToken?: string
  ): Promise<ApiResponse<SessionMetrics>> {
    const queryParams = new URLSearchParams()
    
    if (options.startDate) queryParams.set('startDate', options.startDate)
    if (options.endDate) queryParams.set('endDate', options.endDate)
    if (options.dimensions) queryParams.set('dimensions', options.dimensions.join(','))
    if (options.limit) queryParams.set('limit', options.limit.toString())

    const endpoint = `/sessions/${propertyId}?${queryParams.toString()}`
    return this.request<SessionMetrics>(endpoint, { method: 'GET' }, authToken)
  }

  // Fetch traffic source data
  async getTrafficSources(
    propertyId: string,
    options: {
      startDate?: string
      endDate?: string
      limit?: number
    } = {},
    authToken?: string
  ): Promise<ApiResponse<TrafficSource[]>> {
    const queryParams = new URLSearchParams()
    
    if (options.startDate) queryParams.set('startDate', options.startDate)
    if (options.endDate) queryParams.set('endDate', options.endDate)
    if (options.limit) queryParams.set('limit', options.limit.toString())

    const endpoint = `/traffic-sources/${propertyId}?${queryParams.toString()}`
    return this.request<TrafficSource[]>(endpoint, { method: 'GET' }, authToken)
  }

  // Fetch page performance data
  async getPagePerformance(
    propertyId: string,
    options: {
      startDate?: string
      endDate?: string
      limit?: number
    } = {},
    authToken?: string
  ): Promise<ApiResponse<PagePerformance[]>> {
    const queryParams = new URLSearchParams()
    
    if (options.startDate) queryParams.set('startDate', options.startDate)
    if (options.endDate) queryParams.set('endDate', options.endDate)
    if (options.limit) queryParams.set('limit', options.limit.toString())

    const endpoint = `/page-performance/${propertyId}?${queryParams.toString()}`
    return this.request<PagePerformance[]>(endpoint, { method: 'GET' }, authToken)
  }

  // Fetch conversion data
  async getConversions(
    propertyId: string,
    options: {
      startDate?: string
      endDate?: string
      limit?: number
    } = {},
    authToken?: string
  ): Promise<ApiResponse<ConversionData[]>> {
    const queryParams = new URLSearchParams()
    
    if (options.startDate) queryParams.set('startDate', options.startDate)
    if (options.endDate) queryParams.set('endDate', options.endDate)
    if (options.limit) queryParams.set('limit', options.limit.toString())

    const endpoint = `/conversions/${propertyId}?${queryParams.toString()}`
    return this.request<ConversionData[]>(endpoint, { method: 'GET' }, authToken)
  }
}

// Data fetching utilities with fallback logic
export class DashboardDataService {
  private apiClient: GA4ApiClient
  private defaultPropertyId: string

  constructor(propertyId: string = process.env.NEXT_PUBLIC_GA4_PROPERTY_ID || 'demo') {
    this.apiClient = new GA4ApiClient()
    this.defaultPropertyId = propertyId
  }

  // Get session metrics with fallback
  async getSessionMetrics(
    dateRange: { startDate: string; endDate: string },
    authToken?: string
  ): Promise<SessionMetrics> {
    try {
      console.log('📊 Attempting to fetch session metrics from GA4 API...')
      const response = await this.apiClient.getSessionMetrics(
        this.defaultPropertyId,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          dimensions: ['date']
        },
        authToken
      )

      if (response.success && response.data) {
        console.log('✅ Successfully fetched session data from GA4 API')
        return response.data
      }
      
      console.warn('🔄 GA4 API response not successful, using mock session data')
      console.warn('Response:', response)
      return MOCK_DATA.sessions
    } catch (error) {
      console.warn('🔄 GA4 API error, using mock session data:', error)
      return MOCK_DATA.sessions
    }
  }

  // Get traffic sources with fallback
  async getTrafficSources(
    dateRange: { startDate: string; endDate: string },
    authToken?: string
  ): Promise<TrafficSource[]> {
    try {
      const response = await this.apiClient.getTrafficSources(
        this.defaultPropertyId,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          limit: 10
        },
        authToken
      )

      console.log('🔍 DEBUG: API response for traffic sources:', {
        success: response.success,
        data: response.data,
        dataIsArray: Array.isArray(response.data),
        dataType: typeof response.data,
        fullResponse: response
      })

      if (response.success && response.data) {
        console.log('✅ DashboardDataService returning extracted data:', {
          data: response.data,
          isArray: Array.isArray(response.data),
          type: typeof response.data,
          length: response.data?.length
        })
        return response.data
      }
      
      console.warn('🔄 Using mock traffic source data - API unavailable')
      return MOCK_DATA.trafficSources
    } catch (error) {
      console.warn('🔄 Using mock traffic source data - API error:', error)
      return MOCK_DATA.trafficSources
    }
  }

  // Get page performance with fallback
  async getPagePerformance(
    dateRange: { startDate: string; endDate: string },
    authToken?: string
  ): Promise<PagePerformance[]> {
    try {
      const response = await this.apiClient.getPagePerformance(
        this.defaultPropertyId,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          limit: 10
        },
        authToken
      )

      if (response.success && response.data) {
        return response.data
      }
      
      console.warn('🔄 Using mock page performance data - API unavailable')
      return MOCK_DATA.pagePerformance
    } catch (error) {
      console.warn('🔄 Using mock page performance data - API error:', error)
      return MOCK_DATA.pagePerformance
    }
  }

  // Get conversions with fallback
  async getConversions(
    dateRange: { startDate: string; endDate: string },
    authToken?: string
  ): Promise<ConversionData[]> {
    try {
      const response = await this.apiClient.getConversions(
        this.defaultPropertyId,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        authToken
      )

      if (response.success && response.data) {
        return response.data
      }
      
      console.warn('🔄 Using mock conversion data - API unavailable')
      return MOCK_DATA.conversions
    } catch (error) {
      console.warn('🔄 Using mock conversion data - API error:', error)
      return MOCK_DATA.conversions
    }
  }

  // Test API connectivity
  async testConnection(authToken?: string): Promise<boolean> {
    try {
      console.log('🔍 Testing GA4 API connection...')
      const response = await this.apiClient.testConnection(authToken)
      console.log(`🔌 GA4 API Connection test result:`, response)
      return response.success
    } catch (error) {
      console.error('❌ GA4 API Connection test failed:', error)
      return false
    }
  }
}

// Export instances and utilities
export const ga4ApiClient = new GA4ApiClient()
export const dashboardDataService = new DashboardDataService()

// Hook for using the data service with authentication
export const useGA4DataService = () => {
  const { user } = useAuth()
  
  // You could get auth token from user session here if needed
  const authToken = user?.access_token // Adjust based on your auth structure
  
  // 🐛 DEBUG: Log when this hook runs
  console.log('🔗 useGA4DataService hook running, user:', !!user, 'token:', !!authToken)
  
  // ✅ FIXED: Memoize the returned object to prevent unnecessary re-renders
  return React.useMemo(() => ({
    getSessionMetrics: (dateRange: { startDate: string; endDate: string }) =>
      dashboardDataService.getSessionMetrics(dateRange, authToken),
    getTrafficSources: async (dateRange: { startDate: string; endDate: string }) => {
      console.log('🔧 useGA4DataService.getTrafficSources called')
      const result = await dashboardDataService.getTrafficSources(dateRange, authToken)
      console.log('🔧 useGA4DataService.getTrafficSources result:', {
        result,
        isArray: Array.isArray(result),
        type: typeof result,
        length: result?.length
      })
      return result
    },
    getPagePerformance: (dateRange: { startDate: string; endDate: string }) =>
      dashboardDataService.getPagePerformance(dateRange, authToken),
    getConversions: (dateRange: { startDate: string; endDate: string }) =>
      dashboardDataService.getConversions(dateRange, authToken),
    testConnection: () => dashboardDataService.testConnection(authToken)
  }), [authToken]) // Only recreate when authToken changes
}

export default dashboardDataService