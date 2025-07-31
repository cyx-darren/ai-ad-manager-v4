// Sample data structures for testing GA4/Google Ads visualization components

import { TimeSeriesDataPoint } from './LineChart'
import { BarChartDataPoint } from './BarChart'
import { DonutChartDataPoint } from './DonutChart'
import { TableRow } from './TableComponent'

// Time series data for LineChart testing
export const sampleTimeSeriesData: TimeSeriesDataPoint[] = [
  {
    date: '2024-01-01',
    sessions: 1250,
    users: 980,
    pageviews: 3200,
    clicks: 890,
    impressions: 15200,
    cost: 245.50,
    conversions: 28,
    ctr: 0.0585,
    cpc: 0.276,
    roas: 4.2
  },
  {
    date: '2024-01-02',
    sessions: 1380,
    users: 1120,
    pageviews: 3650,
    clicks: 950,
    impressions: 16800,
    cost: 267.30,
    conversions: 32,
    ctr: 0.0565,
    cpc: 0.281,
    roas: 4.8
  },
  {
    date: '2024-01-03',
    sessions: 1420,
    users: 1180,
    pageviews: 3890,
    clicks: 1020,
    impressions: 17500,
    cost: 289.80,
    conversions: 35,
    ctr: 0.0583,
    cpc: 0.284,
    roas: 5.1
  },
  {
    date: '2024-01-04',
    sessions: 1180,
    users: 920,
    pageviews: 3100,
    clicks: 780,
    impressions: 14200,
    cost: 221.40,
    conversions: 24,
    ctr: 0.0549,
    cpc: 0.284,
    roas: 3.9
  },
  {
    date: '2024-01-05',
    sessions: 1650,
    users: 1320,
    pageviews: 4200,
    clicks: 1180,
    impressions: 19800,
    cost: 332.60,
    conversions: 42,
    ctr: 0.0596,
    cpc: 0.282,
    roas: 5.8
  },
  {
    date: '2024-01-06',
    sessions: 1580,
    users: 1280,
    pageviews: 4050,
    clicks: 1150,
    impressions: 19200,
    cost: 319.00,
    conversions: 40,
    ctr: 0.0599,
    cpc: 0.277,
    roas: 5.6
  },
  {
    date: '2024-01-07',
    sessions: 1720,
    users: 1380,
    pageviews: 4380,
    clicks: 1240,
    impressions: 20500,
    cost: 347.20,
    conversions: 45,
    ctr: 0.0605,
    cpc: 0.280,
    roas: 6.1
  }
]

// Campaign performance data for BarChart testing
export const sampleCampaignData: BarChartDataPoint[] = [
  {
    name: 'Google Ads - Search Campaign',
    sessions: 850,
    users: 720,
    clicks: 1240,
    impressions: 18500,
    cost: 347.20,
    conversions: 45,
    revenue: 2120.80,
    ctr: 0.067,
    cpc: 0.280,
    roas: 6.1,
    conversionRate: 0.036
  },
  {
    name: 'Facebook Ads - Prospecting',
    sessions: 620,
    users: 580,
    clicks: 890,
    impressions: 15200,
    cost: 245.50,
    conversions: 28,
    revenue: 1430.40,
    ctr: 0.059,
    cpc: 0.276,
    roas: 5.8,
    conversionRate: 0.031
  },
  {
    name: 'Google Ads - Display Campaign',
    sessions: 420,
    users: 380,
    clicks: 650,
    impressions: 22800,
    cost: 189.75,
    conversions: 18,
    revenue: 912.60,
    ctr: 0.029,
    cpc: 0.292,
    roas: 4.8,
    conversionRate: 0.028
  },
  {
    name: 'LinkedIn Ads - B2B Targeting',
    sessions: 180,
    users: 165,
    clicks: 245,
    impressions: 3400,
    cost: 167.30,
    conversions: 12,
    revenue: 720.00,
    ctr: 0.072,
    cpc: 0.683,
    roas: 4.3,
    conversionRate: 0.049
  },
  {
    name: 'Twitter Ads - Engagement',
    sessions: 320,
    users: 290,
    clicks: 480,
    impressions: 8900,
    cost: 134.40,
    conversions: 15,
    revenue: 675.00,
    ctr: 0.054,
    cpc: 0.280,
    roas: 5.0,
    conversionRate: 0.031
  }
]

// Channel breakdown data for BarChart testing
export const sampleChannelData: BarChartDataPoint[] = [
  {
    name: 'Organic Search',
    sessions: 2850,
    users: 2420,
    clicks: 0, // Not applicable for organic
    impressions: 0,
    cost: 0,
    conversions: 125,
    revenue: 6250.00,
    conversionRate: 0.044
  },
  {
    name: 'Paid Search',
    sessions: 1240,
    users: 1020,
    clicks: 1890,
    impressions: 28200,
    cost: 532.80,
    conversions: 63,
    revenue: 3150.00,
    conversionRate: 0.051
  },
  {
    name: 'Social Media',
    sessions: 890,
    users: 780,
    clicks: 1320,
    impressions: 19800,
    cost: 298.60,
    conversions: 38,
    revenue: 1900.00,
    conversionRate: 0.043
  },
  {
    name: 'Direct',
    sessions: 1650,
    users: 1520,
    clicks: 0,
    impressions: 0,
    cost: 0,
    conversions: 89,
    revenue: 4450.00,
    conversionRate: 0.054
  },
  {
    name: 'Email Marketing',
    sessions: 720,
    users: 680,
    clicks: 0,
    impressions: 0,
    cost: 45.00, // Email platform cost
    conversions: 52,
    revenue: 2600.00,
    conversionRate: 0.072
  },
  {
    name: 'Referral',
    sessions: 420,
    users: 380,
    clicks: 0,
    impressions: 0,
    cost: 0,
    conversions: 18,
    revenue: 900.00,
    conversionRate: 0.043
  }
]

// Traffic source breakdown for DonutChart testing
export const sampleTrafficSourceData: DonutChartDataPoint[] = [
  { name: 'Organic Search', value: 2850 },
  { name: 'Direct', value: 1650 },
  { name: 'Paid Search', value: 1240 },
  { name: 'Social Media', value: 890 },
  { name: 'Email Marketing', value: 720 },
  { name: 'Referral', value: 420 },
  { name: 'Display Ads', value: 280 },
  { name: 'Other', value: 150 }
]

// Device breakdown for DonutChart testing
export const sampleDeviceData: DonutChartDataPoint[] = [
  { name: 'Desktop', value: 4250 },
  { name: 'Mobile', value: 3890 },
  { name: 'Tablet', value: 1060 }
]

// Campaign type breakdown for DonutChart testing
export const sampleCampaignTypeData: DonutChartDataPoint[] = [
  { name: 'Search Campaigns', value: 1240 },
  { name: 'Display Campaigns', value: 650 },
  { name: 'Shopping Campaigns', value: 890 },
  { name: 'Video Campaigns', value: 420 },
  { name: 'App Campaigns', value: 180 }
]

// Geographic breakdown for DonutChart testing
export const sampleGeographicData: DonutChartDataPoint[] = [
  { name: 'United States', value: 4250 },
  { name: 'Canada', value: 1580 },
  { name: 'United Kingdom', value: 1420 },
  { name: 'Australia', value: 890 },
  { name: 'Germany', value: 680 },
  { name: 'France', value: 540 },
  { name: 'Other', value: 840 }
]

// Page performance data for TableComponent testing
export const samplePageData: TableRow[] = [
  {
    page: '/landing-page',
    pageviews: 1250,
    uniquePageviews: 1180,
    avgTimeOnPage: '02:34',
    bounceRate: 0.32,
    entrances: 890,
    exits: 420
  },
  {
    page: '/product-category',
    pageviews: 980,
    uniquePageviews: 920,
    avgTimeOnPage: '01:48',
    bounceRate: 0.41,
    entrances: 650,
    exits: 380
  },
  {
    page: '/checkout',
    pageviews: 520,
    uniquePageviews: 510,
    avgTimeOnPage: '03:12',
    bounceRate: 0.15,
    entrances: 45,
    exits: 180
  },
  {
    page: '/blog/article-1',
    pageviews: 450,
    uniquePageviews: 420,
    avgTimeOnPage: '04:25',
    bounceRate: 0.68,
    entrances: 380,
    exits: 320
  },
  {
    page: '/about-us',
    pageviews: 320,
    uniquePageviews: 310,
    avgTimeOnPage: '01:55',
    bounceRate: 0.52,
    entrances: 180,
    exits: 220
  }
]

// Google Ads campaign data for TableComponent testing
export const sampleGoogleAdsCampaignData: TableRow[] = [
  {
    campaign: 'Search - Brand Keywords',
    status: 'Active',
    clicks: 1240,
    impressions: 18500,
    ctr: 0.067,
    avgCpc: 0.280,
    cost: 347.20,
    conversions: 45,
    conversionRate: 0.036,
    costPerConversion: 7.72
  },
  {
    campaign: 'Display - Remarketing',
    status: 'Active',
    clicks: 650,
    impressions: 22800,
    ctr: 0.029,
    avgCpc: 0.292,
    cost: 189.75,
    conversions: 18,
    conversionRate: 0.028,
    costPerConversion: 10.54
  },
  {
    campaign: 'Shopping - Product Catalog',
    status: 'Active',
    clicks: 890,
    impressions: 15200,
    ctr: 0.059,
    avgCpc: 0.276,
    cost: 245.50,
    conversions: 28,
    conversionRate: 0.031,
    costPerConversion: 8.77
  },
  {
    campaign: 'Search - Competitor Keywords',
    status: 'Paused',
    clicks: 420,
    impressions: 8900,
    ctr: 0.047,
    avgCpc: 0.385,
    cost: 161.70,
    conversions: 12,
    conversionRate: 0.029,
    costPerConversion: 13.48
  },
  {
    campaign: 'Video - YouTube Ads',
    status: 'Active',
    clicks: 180,
    impressions: 25000,
    ctr: 0.007,
    avgCpc: 0.125,
    cost: 22.50,
    conversions: 3,
    conversionRate: 0.017,
    costPerConversion: 7.50
  }
]

// Traffic sources data for TableComponent testing
export const sampleTrafficSourceTableData: TableRow[] = [
  {
    source: 'google',
    medium: 'organic',
    sessions: 2850,
    users: 2420,
    newUsers: 1680,
    sessionDuration: '02:45',
    pagesPerSession: 2.8,
    bounceRate: 0.35
  },
  {
    source: 'google',
    medium: 'cpc',
    sessions: 1240,
    users: 1020,
    newUsers: 890,
    sessionDuration: '03:12',
    pagesPerSession: 3.2,
    bounceRate: 0.28
  },
  {
    source: '(direct)',
    medium: '(none)',
    sessions: 1650,
    users: 1520,
    newUsers: 420,
    sessionDuration: '04:18',
    pagesPerSession: 4.1,
    bounceRate: 0.22
  },
  {
    source: 'facebook.com',
    medium: 'social',
    sessions: 620,
    users: 580,
    newUsers: 520,
    sessionDuration: '01:58',
    pagesPerSession: 2.1,
    bounceRate: 0.48
  },
  {
    source: 'newsletter',
    medium: 'email',
    sessions: 720,
    users: 680,
    newUsers: 85,
    sessionDuration: '03:45',
    pagesPerSession: 3.8,
    bounceRate: 0.25
  }
]

// Conversion funnel data for DonutChart testing
export const sampleConversionFunnelData: DonutChartDataPoint[] = [
  { name: 'Visitors', value: 10000 },
  { name: 'Product Views', value: 4200 },
  { name: 'Add to Cart', value: 1800 },
  { name: 'Checkout Started', value: 850 },
  { name: 'Purchases', value: 420 }
]

// Export all sample data for easy testing
export const sampleData = {
  timeSeries: sampleTimeSeriesData,
  campaigns: sampleCampaignData,
  channels: sampleChannelData,
  trafficSources: sampleTrafficSourceData,
  devices: sampleDeviceData,
  campaignTypes: sampleCampaignTypeData,
  geographic: sampleGeographicData,
  pages: samplePageData,
  googleAdsCampaigns: sampleGoogleAdsCampaignData,
  trafficSourceTable: sampleTrafficSourceTableData,
  conversionFunnel: sampleConversionFunnelData
}

// Utility function to generate random data variations for testing
export function generateRandomVariation<T extends Record<string, any>>(
  baseData: T[],
  variationPercent: number = 0.2
): T[] {
  return baseData.map(item => {
    const newItem = { ...item }
    
    Object.keys(newItem).forEach(key => {
      if (typeof newItem[key] === 'number' && key !== 'percentage') {
        const variation = 1 + (Math.random() - 0.5) * 2 * variationPercent
        ;(newItem as any)[key] = Math.round((newItem as any)[key] * variation)
      }
    })
    
    return newItem
  })
}

// Utility function to generate time series data for different date ranges
export function generateTimeSeriesForDateRange(
  startDate: string,
  endDate: string,
  baseData: TimeSeriesDataPoint = sampleTimeSeriesData[0]
): TimeSeriesDataPoint[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const data: TimeSeriesDataPoint[] = []
  
  const current = new Date(start)
  while (current <= end) {
    const variation = 1 + (Math.random() - 0.5) * 0.4 // ±20% variation
    
    data.push({
      date: current.toISOString().split('T')[0],
      sessions: Math.round((baseData.sessions || 1000) * variation),
      users: Math.round((baseData.users || 800) * variation),
      pageviews: Math.round((baseData.pageviews || 2500) * variation),
      clicks: Math.round((baseData.clicks || 600) * variation),
      impressions: Math.round((baseData.impressions || 12000) * variation),
      cost: parseFloat(((baseData.cost || 200) * variation).toFixed(2)),
      conversions: Math.round((baseData.conversions || 20) * variation),
      ctr: parseFloat(((baseData.ctr || 0.05) * variation).toFixed(4)),
      cpc: parseFloat(((baseData.cpc || 0.25) * variation).toFixed(3)),
      roas: parseFloat(((baseData.roas || 4.0) * variation).toFixed(1))
    })
    
    current.setDate(current.getDate() + 1)
  }
  
  return data
}