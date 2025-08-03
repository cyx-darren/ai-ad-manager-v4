/**
 * GA4 Utility Functions
 * 
 * Common utility functions for GA4 data processing, date handling,
 * and data transformation operations.
 */

import { logger } from './logger.js';
import type { DateRangeOptions, GA4DataRow, GA4TransformedResponse, GA4RealtimeResponse } from './ga4DataClient.js';

// Common GA4 metric and dimension definitions
export const GA4_METRICS = {
  // User metrics
  ACTIVE_USERS: 'activeUsers',
  NEW_USERS: 'newUsers',
  TOTAL_USERS: 'totalUsers',
  
  // Session metrics
  SESSIONS: 'sessions',
  SESSIONS_PER_USER: 'sessionsPerUser',
  AVERAGE_SESSION_DURATION: 'averageSessionDuration',
  BOUNCE_RATE: 'bounceRate',
  
  // Page metrics
  SCREEN_PAGE_VIEWS: 'screenPageViews',
  SCREEN_PAGE_VIEWS_PER_SESSION: 'screenPageViewsPerSession',
  VIEWS: 'views',
  UNIQUE_USERS: 'totalUsers',
  EXITS: 'exits',
  EXIT_RATE: 'exitRate',
  
  // Event metrics
  EVENT_COUNT: 'eventCount',
  EVENTS_PER_SESSION: 'eventsPerSession',
  
  // Conversion metrics
  CONVERSIONS: 'conversions',
  CONVERSION_RATE: 'conversionRate',
  GOAL_COMPLETIONS: 'goalCompletions',
  GOAL_COMPLETION_RATE: 'goalCompletionRate',
  CONVERSION_VALUE: 'conversionValue',
  
  // E-commerce metrics
  PURCHASE_REVENUE: 'purchaseRevenue',
  TOTAL_REVENUE: 'totalRevenue',
  ECOMMERCE_PURCHASES: 'ecommercePurchases',
  
  // Engagement metrics
  ENGAGED_SESSIONS: 'engagedSessions',
  ENGAGEMENT_RATE: 'engagementRate',
  USER_ENGAGEMENT_DURATION: 'userEngagementDuration'
} as const;

export const GA4_DIMENSIONS = {
  // Time dimensions
  DATE: 'date',
  YEAR: 'year',
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  HOUR: 'hour',
  
  // Geographic dimensions
  COUNTRY: 'country',
  REGION: 'region',
  CITY: 'city',
  CONTINENT: 'continent',
  
  // Technology dimensions
  DEVICE_CATEGORY: 'deviceCategory',
  DEVICE_MODEL: 'deviceModel',
  OPERATING_SYSTEM: 'operatingSystem',
  BROWSER: 'browser',
  
  // Traffic source dimensions
  SESSION_SOURCE: 'sessionSource',
  SESSION_MEDIUM: 'sessionMedium',
  SESSION_CAMPAIGN_NAME: 'sessionCampaignName',
  SESSION_DEFAULT_CHANNEL_GROUP: 'sessionDefaultChannelGrouping',
  SESSION_GOOGLE_ADS_CAMPAIGN_NAME: 'sessionGoogleAdsCampaignName',
  SESSION_GOOGLE_ADS_AD_GROUP_NAME: 'sessionGoogleAdsAdGroupName',
  SESSION_GOOGLE_ADS_KEYWORD: 'sessionGoogleAdsKeyword',
  
  // Content dimensions
  PAGE_TITLE: 'pageTitle',
  PAGE_LOCATION: 'pageLocation',
  PAGE_PATH: 'pagePath',
  PAGE_REFERRER: 'pageReferrer',
  
  // User dimensions
  USER_GENDER: 'userGender',
  USER_AGE_BRACKET: 'userAgeBracket',
  USER_AGE_GROUP: 'userAgeGroup',
  NEW_VS_RETURNING: 'newVsReturning',
  
  // Event dimensions
  EVENT_NAME: 'eventName',
  CUSTOM_EVENT: 'customEvent',
  
  // Conversion dimensions
  CONVERSION_EVENT: 'conversionEvent',
  GOAL_NAME: 'goalName',
  LANDING_PAGE: 'landingPage',
  EXIT_PAGE: 'exitPage'
} as const;

// Date range presets
export const DATE_RANGE_PRESETS = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: '7daysAgo',
  LAST_30_DAYS: '30daysAgo',
  LAST_90_DAYS: '90daysAgo',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  THIS_YEAR: 'thisYear',
  LAST_YEAR: 'lastYear'
} as const;

// Traffic source categories for Google Ads identification
export const GOOGLE_ADS_SOURCES = [
  'google',
  'google ads',
  'googleads',
  'google_ads',
  'cpc'
];

export const GOOGLE_ADS_MEDIUMS = [
  'cpc',
  'ppc',
  'paid',
  'google_ads',
  'googleads'
];

/**
 * Parse date range from various input formats
 */
export function parseDateRange(input: string | DateRangeOptions | { start: string; end: string }): DateRangeOptions {
  // If already a DateRangeOptions object
  if (typeof input === 'object' && 'startDate' in input && 'endDate' in input) {
    return validateDateRange(input);
  }
  
  // If object with start/end properties
  if (typeof input === 'object' && 'start' in input && 'end' in input) {
    return validateDateRange({
      startDate: input.start,
      endDate: input.end
    });
  }
  
  // If string preset
  if (typeof input === 'string') {
    return parseDateRangePreset(input);
  }
  
  throw new Error(`Invalid date range input: ${JSON.stringify(input)}`);
}

/**
 * Parse date range from preset strings
 */
export function parseDateRangePreset(preset: string): DateRangeOptions {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  
  switch (preset.toLowerCase()) {
    case DATE_RANGE_PRESETS.TODAY:
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
        name: 'Today'
      };
      
    case DATE_RANGE_PRESETS.YESTERDAY:
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday),
        name: 'Yesterday'
      };
      
    case DATE_RANGE_PRESETS.LAST_7_DAYS:
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        startDate: formatDate(sevenDaysAgo),
        endDate: formatDate(today),
        name: 'Last 7 Days'
      };
      
    case DATE_RANGE_PRESETS.LAST_30_DAYS:
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        startDate: formatDate(thirtyDaysAgo),
        endDate: formatDate(today),
        name: 'Last 30 Days'
      };
      
    case DATE_RANGE_PRESETS.LAST_90_DAYS:
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return {
        startDate: formatDate(ninetyDaysAgo),
        endDate: formatDate(today),
        name: 'Last 90 Days'
      };
      
    case DATE_RANGE_PRESETS.THIS_MONTH:
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDate(thisMonthStart),
        endDate: formatDate(today),
        name: 'This Month'
      };
      
    case DATE_RANGE_PRESETS.LAST_MONTH:
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(lastMonthStart),
        endDate: formatDate(lastMonthEnd),
        name: 'Last Month'
      };
      
    case DATE_RANGE_PRESETS.THIS_YEAR:
      const thisYearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: formatDate(thisYearStart),
        endDate: formatDate(today),
        name: 'This Year'
      };
      
    case DATE_RANGE_PRESETS.LAST_YEAR:
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      return {
        startDate: formatDate(lastYearStart),
        endDate: formatDate(lastYearEnd),
        name: 'Last Year'
      };
      
    default:
      throw new Error(`Unknown date range preset: ${preset}`);
  }
}

/**
 * Validate date range format and logic
 */
export function validateDateRange(dateRange: DateRangeOptions): DateRangeOptions {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(dateRange.startDate)) {
    throw new Error(`Invalid start date format: ${dateRange.startDate}. Expected YYYY-MM-DD`);
  }
  
  if (!dateRegex.test(dateRange.endDate)) {
    throw new Error(`Invalid end date format: ${dateRange.endDate}. Expected YYYY-MM-DD`);
  }
  
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  if (isNaN(startDate.getTime())) {
    throw new Error(`Invalid start date: ${dateRange.startDate}`);
  }
  
  if (isNaN(endDate.getTime())) {
    throw new Error(`Invalid end date: ${dateRange.endDate}`);
  }
  
  if (startDate > endDate) {
    throw new Error(`Start date ${dateRange.startDate} cannot be after end date ${dateRange.endDate}`);
  }
  
  // Check if date range is too far in the future
  const today = new Date();
  if (startDate > today) {
    throw new Error(`Start date ${dateRange.startDate} cannot be in the future`);
  }
  
  return dateRange;
}

/**
 * Filter GA4 data rows for Google Ads traffic
 */
export function filterGoogleAdsTraffic(data: GA4TransformedResponse): GA4TransformedResponse {
  const filteredRows = data.rows.filter(row => {
    const source = (row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE] || '').toLowerCase();
    const medium = (row.dimensions[GA4_DIMENSIONS.SESSION_MEDIUM] || '').toLowerCase();
    
    // Check if source contains Google Ads indicators
    const isGoogleAdsSource = GOOGLE_ADS_SOURCES.some(googleSource => 
      source.includes(googleSource)
    );
    
    // Check if medium contains Google Ads indicators
    const isGoogleAdsMedium = GOOGLE_ADS_MEDIUMS.some(googleMedium => 
      medium.includes(googleMedium)
    );
    
    // Check for Google Ads campaign data
    const hasGoogleAdsCampaign = row.dimensions[GA4_DIMENSIONS.SESSION_GOOGLE_ADS_CAMPAIGN_NAME] && 
                                row.dimensions[GA4_DIMENSIONS.SESSION_GOOGLE_ADS_CAMPAIGN_NAME] !== '(not set)';
    
    return isGoogleAdsSource || isGoogleAdsMedium || hasGoogleAdsCampaign;
  });
  
  // Recalculate totals for filtered data
  const totals: { [metricName: string]: number } = {};
  data.metadata.metricHeaders.forEach(metricName => {
    totals[metricName] = filteredRows.reduce((sum, row) => 
      sum + (row.metrics[metricName] || 0), 0
    );
  });
  
  return {
    ...data,
    rows: filteredRows,
    totals,
    metadata: {
      ...data.metadata,
      rowCount: filteredRows.length
    }
  };
}

/**
 * Sort GA4 data rows by a specific metric or dimension
 */
export function sortGA4Data(
  data: GA4TransformedResponse, 
  sortBy: string, 
  descending?: boolean
): GA4TransformedResponse;
export function sortGA4Data(
  data: GA4RealtimeResponse, 
  sortBy: string, 
  descending?: boolean
): GA4RealtimeResponse;
export function sortGA4Data(
  data: GA4TransformedResponse | GA4RealtimeResponse, 
  sortBy: string, 
  descending: boolean = true
): GA4TransformedResponse | GA4RealtimeResponse {
  const sortedRows = [...data.rows].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    // Check if sorting by metric or dimension
    if (data.metadata.metricHeaders.includes(sortBy)) {
      aValue = a.metrics[sortBy] || 0;
      bValue = b.metrics[sortBy] || 0;
    } else if (data.metadata.dimensionHeaders.includes(sortBy)) {
      aValue = a.dimensions[sortBy] || '';
      bValue = b.dimensions[sortBy] || '';
    } else {
      throw new Error(`Sort field '${sortBy}' not found in data`);
    }
    
    // Handle numeric vs string comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return descending ? bValue - aValue : aValue - bValue;
    } else {
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (descending) {
        return bStr.localeCompare(aStr);
      } else {
        return aStr.localeCompare(bStr);
      }
    }
  });
  
  return {
    ...data,
    rows: sortedRows
  };
}

/**
 * Limit GA4 data rows to a specific number
 */
export function limitGA4Data(data: GA4TransformedResponse, limit: number): GA4TransformedResponse {
  if (limit <= 0 || limit >= data.rows.length) {
    return data;
  }
  
  return {
    ...data,
    rows: data.rows.slice(0, limit),
    metadata: {
      ...data.metadata,
      rowCount: Math.min(limit, data.rows.length)
    }
  };
}

/**
 * Format metric values for display
 */
export function formatMetricValue(metricName: string, value: number): string {
  switch (metricName) {
    case GA4_METRICS.ACTIVE_USERS:
    case GA4_METRICS.NEW_USERS:
    case GA4_METRICS.TOTAL_USERS:
    case GA4_METRICS.SESSIONS:
    case GA4_METRICS.SCREEN_PAGE_VIEWS:
    case GA4_METRICS.EVENT_COUNT:
    case GA4_METRICS.CONVERSIONS:
    case GA4_METRICS.ECOMMERCE_PURCHASES:
    case GA4_METRICS.ENGAGED_SESSIONS:
      return Math.round(value).toLocaleString();
      
    case GA4_METRICS.SESSIONS_PER_USER:
    case GA4_METRICS.SCREEN_PAGE_VIEWS_PER_SESSION:
    case GA4_METRICS.EVENTS_PER_SESSION:
      return value.toFixed(2);
      
    case GA4_METRICS.BOUNCE_RATE:
    case GA4_METRICS.CONVERSION_RATE:
    case GA4_METRICS.ENGAGEMENT_RATE:
      return (value * 100).toFixed(1) + '%';
      
    case GA4_METRICS.AVERAGE_SESSION_DURATION:
    case GA4_METRICS.USER_ENGAGEMENT_DURATION:
      return formatDuration(value);
      
    case GA4_METRICS.PURCHASE_REVENUE:
    case GA4_METRICS.TOTAL_REVENUE:
      return '$' + value.toFixed(2);
      
    default:
      return value.toLocaleString();
  }
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Get metric display name
 */
export function getMetricDisplayName(metricName: string): string {
  const displayNames: { [key: string]: string } = {
    [GA4_METRICS.ACTIVE_USERS]: 'Active Users',
    [GA4_METRICS.NEW_USERS]: 'New Users',
    [GA4_METRICS.TOTAL_USERS]: 'Total Users',
    [GA4_METRICS.SESSIONS]: 'Sessions',
    [GA4_METRICS.SESSIONS_PER_USER]: 'Sessions per User',
    [GA4_METRICS.AVERAGE_SESSION_DURATION]: 'Avg. Session Duration',
    [GA4_METRICS.BOUNCE_RATE]: 'Bounce Rate',
    [GA4_METRICS.SCREEN_PAGE_VIEWS]: 'Page Views',
    [GA4_METRICS.SCREEN_PAGE_VIEWS_PER_SESSION]: 'Pages per Session',
    [GA4_METRICS.EVENT_COUNT]: 'Events',
    [GA4_METRICS.EVENTS_PER_SESSION]: 'Events per Session',
    [GA4_METRICS.CONVERSIONS]: 'Conversions',
    [GA4_METRICS.CONVERSION_RATE]: 'Conversion Rate',
    [GA4_METRICS.PURCHASE_REVENUE]: 'Purchase Revenue',
    [GA4_METRICS.TOTAL_REVENUE]: 'Total Revenue',
    [GA4_METRICS.ECOMMERCE_PURCHASES]: 'Purchases',
    [GA4_METRICS.ENGAGED_SESSIONS]: 'Engaged Sessions',
    [GA4_METRICS.ENGAGEMENT_RATE]: 'Engagement Rate',
    [GA4_METRICS.USER_ENGAGEMENT_DURATION]: 'Engagement Duration'
  };
  
  return displayNames[metricName] || metricName;
}

/**
 * Get dimension display name
 */
export function getDimensionDisplayName(dimensionName: string): string {
  const displayNames: { [key: string]: string } = {
    [GA4_DIMENSIONS.DATE]: 'Date',
    [GA4_DIMENSIONS.YEAR]: 'Year',
    [GA4_DIMENSIONS.MONTH]: 'Month',
    [GA4_DIMENSIONS.WEEK]: 'Week',
    [GA4_DIMENSIONS.DAY]: 'Day',
    [GA4_DIMENSIONS.HOUR]: 'Hour',
    [GA4_DIMENSIONS.COUNTRY]: 'Country',
    [GA4_DIMENSIONS.REGION]: 'Region',
    [GA4_DIMENSIONS.CITY]: 'City',
    [GA4_DIMENSIONS.CONTINENT]: 'Continent',
    [GA4_DIMENSIONS.DEVICE_CATEGORY]: 'Device Category',
    [GA4_DIMENSIONS.DEVICE_MODEL]: 'Device Model',
    [GA4_DIMENSIONS.OPERATING_SYSTEM]: 'Operating System',
    [GA4_DIMENSIONS.BROWSER]: 'Browser',
    [GA4_DIMENSIONS.SESSION_SOURCE]: 'Source',
    [GA4_DIMENSIONS.SESSION_MEDIUM]: 'Medium',
    [GA4_DIMENSIONS.SESSION_CAMPAIGN_NAME]: 'Campaign',
    [GA4_DIMENSIONS.SESSION_GOOGLE_ADS_CAMPAIGN_NAME]: 'Google Ads Campaign',
    [GA4_DIMENSIONS.SESSION_GOOGLE_ADS_AD_GROUP_NAME]: 'Ad Group',
    [GA4_DIMENSIONS.SESSION_GOOGLE_ADS_KEYWORD]: 'Keyword',
    [GA4_DIMENSIONS.PAGE_TITLE]: 'Page Title',
    [GA4_DIMENSIONS.PAGE_LOCATION]: 'Page URL',
    [GA4_DIMENSIONS.PAGE_PATH]: 'Page Path',
    [GA4_DIMENSIONS.PAGE_REFERRER]: 'Referrer',
    [GA4_DIMENSIONS.USER_GENDER]: 'Gender',
    [GA4_DIMENSIONS.USER_AGE_GROUP]: 'Age Group',
    [GA4_DIMENSIONS.NEW_VS_RETURNING]: 'User Type',
    [GA4_DIMENSIONS.EVENT_NAME]: 'Event Name',
    [GA4_DIMENSIONS.CUSTOM_EVENT]: 'Custom Event'
  };
  
  return displayNames[dimensionName] || dimensionName;
}

/**
 * Aggregate GA4 data rows by a specific dimension
 */
export function aggregateGA4Data(
  data: GA4TransformedResponse, 
  groupByDimension: string
): GA4TransformedResponse {
  if (!data.metadata.dimensionHeaders.includes(groupByDimension)) {
    throw new Error(`Dimension '${groupByDimension}' not found in data`);
  }
  
  const grouped = new Map<string, GA4DataRow>();
  
  for (const row of data.rows) {
    const groupKey = row.dimensions[groupByDimension] || '(not set)';
    
    if (grouped.has(groupKey)) {
      const existingRow = grouped.get(groupKey)!;
      
      // Aggregate metrics
      for (const metricName of data.metadata.metricHeaders) {
        existingRow.metrics[metricName] = (existingRow.metrics[metricName] || 0) + (row.metrics[metricName] || 0);
      }
    } else {
      grouped.set(groupKey, {
        dimensions: { [groupByDimension]: groupKey },
        metrics: { ...row.metrics }
      });
    }
  }
  
  const aggregatedRows = Array.from(grouped.values());
  
  // Recalculate totals
  const totals: { [metricName: string]: number } = {};
  data.metadata.metricHeaders.forEach(metricName => {
    totals[metricName] = aggregatedRows.reduce((sum, row) => 
      sum + (row.metrics[metricName] || 0), 0
    );
  });
  
  return {
    ...data,
    rows: aggregatedRows,
    totals,
    metadata: {
      ...data.metadata,
      dimensionHeaders: [groupByDimension],
      rowCount: aggregatedRows.length
    }
  };
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change for display
 */
export function formatPercentageChange(current: number, previous: number): string {
  const change = calculatePercentageChange(current, previous);
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString;
}

/**
 * Get the number of days between two dates
 */
export function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Debug helper to log GA4 data structure
 */
export function debugGA4Data(data: GA4TransformedResponse, label?: string): void;
export function debugGA4Data(data: GA4RealtimeResponse, label?: string): void;
export function debugGA4Data(data: GA4TransformedResponse | GA4RealtimeResponse, label: string = 'GA4 Data'): void {
  const debugInfo: any = {
    rowCount: data.metadata.rowCount,
    dimensionHeaders: data.metadata.dimensionHeaders,
    metricHeaders: data.metadata.metricHeaders,
    totals: data.totals,
    executionTime: data.requestInfo.executionTime,
    sampleRows: data.rows.slice(0, 3) // Show first 3 rows
  };

  // Add properties specific to each response type
  if ('dateRanges' in data) {
    // GA4TransformedResponse
    debugInfo.dateRanges = data.dateRanges;
    debugInfo.fromCache = data.requestInfo.fromCache;
  } else {
    // GA4RealtimeResponse
    debugInfo.timestamp = data.requestInfo.timestamp;
    debugInfo.isRealtime = true;
  }

  logger.debug(`📊 ${label}:`, debugInfo);
}