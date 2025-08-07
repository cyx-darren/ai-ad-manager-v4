/**
 * Adapter Utility Functions
 * 
 * This file provides common utility functions for data transformation,
 * validation, and manipulation used across all adapters.
 */

import { 
  DateFormatConfig, 
  MetricComputationConfig, 
  FieldMapping, 
  NumberFormatConfig,
  ValidationResult,
  DateNormalizer,
  MetricComputer,
  FieldMapper,
  TypeCoercer,
  NullHandler,
  PercentageCalculator
} from './types';

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Normalize various date formats to consistent ISO date string (YYYY-MM-DD)
 */
export const normalizeDateString: DateNormalizer = (
  date: string | Date, 
  config: DateFormatConfig = {}
): string => {
  try {
    let dateObj: Date;

    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      // Handle common GA4 date formats
      if (date.match(/^\d{8}$/)) {
        // YYYYMMDD format
        const year = date.substring(0, 4);
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        dateObj = new Date(`${year}-${month}-${day}`);
      } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format
        return date;
      } else {
        // Try to parse as-is
        dateObj = new Date(date);
      }
    } else {
      throw new Error('Invalid date input');
    }

    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }

    // Return in ISO format (YYYY-MM-DD)
    return dateObj.toISOString().split('T')[0];

  } catch (error) {
    console.warn('Date normalization failed:', error);
    return new Date().toISOString().split('T')[0]; // Current date as fallback
  }
};

/**
 * Parse date range strings commonly used in GA4
 */
export function parseDateRange(dateRange: string): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = normalizeDateString(today);

  switch (dateRange.toLowerCase()) {
    case 'today':
      return { startDate: endDate, endDate };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = normalizeDateString(yesterday);
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    
    case 'last7days':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { startDate: normalizeDateString(last7), endDate };
    
    case 'last30days':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { startDate: normalizeDateString(last30), endDate };
    
    default:
      // Try to parse as date range "YYYY-MM-DD:YYYY-MM-DD"
      const parts = dateRange.split(':');
      if (parts.length === 2) {
        return {
          startDate: normalizeDateString(parts[0]),
          endDate: normalizeDateString(parts[1])
        };
      }
      
      // Fallback to last 7 days
      const fallbackStart = new Date(today);
      fallbackStart.setDate(fallbackStart.getDate() - 7);
      return { startDate: normalizeDateString(fallbackStart), endDate };
  }
}

// ============================================================================
// METRIC COMPUTATION UTILITIES
// ============================================================================

/**
 * Compute derived metrics from raw data
 */
export const computeMetrics: MetricComputer = (
  data: any, 
  config: MetricComputationConfig = {}
): Record<string, number> => {
  const metrics: Record<string, number> = {};
  
  try {
    // Extract base values with null safety
    const clicks = safeNumber(data.clicks || data.adClicks || 0);
    const impressions = safeNumber(data.impressions || data.adImpressions || 0);
    const cost = safeNumber(data.cost || data.adCost || 0);
    const conversions = safeNumber(data.conversions || data.goalCompletions || 0);
    const sessions = safeNumber(data.sessions || 0);
    const revenue = safeNumber(data.revenue || 0);

    // Click-through rate (CTR) = (clicks / impressions) * 100
    if (config.enableCTR !== false && impressions > 0) {
      metrics.ctr = (clicks / impressions) * 100;
    }

    // Cost per click (CPC) = cost / clicks
    if (config.enableCPC !== false && clicks > 0) {
      metrics.cpc = cost / clicks;
    }

    // Cost per mille (CPM) = (cost / impressions) * 1000
    if (config.enableCPM !== false && impressions > 0) {
      metrics.cpm = (cost / impressions) * 1000;
    }

    // Conversion rate (CVR) = (conversions / sessions or clicks) * 100
    if (config.enableCVR !== false) {
      const denominator = sessions > 0 ? sessions : clicks;
      if (denominator > 0) {
        metrics.conversionRate = (conversions / denominator) * 100;
      }
    }

    // Return on ad spend (ROAS) = revenue / cost
    if (config.enableROAS !== false && cost > 0) {
      let revenueForROAS = revenue;
      
      // If no revenue data, estimate using conversions and AOV
      if (revenue === 0 && conversions > 0 && config.averageOrderValue) {
        revenueForROAS = conversions * config.averageOrderValue;
      }
      
      if (revenueForROAS > 0) {
        metrics.roas = revenueForROAS / cost;
      }
    }

    return metrics;

  } catch (error) {
    console.warn('Metric computation failed:', error);
    return {};
  }
};

/**
 * Calculate percentage changes between current and previous periods
 */
export function calculatePercentageChange(current: number, previous: number): {
  value: number;
  type: 'increase' | 'decrease' | 'no-change';
} {
  if (previous === 0) {
    return {
      value: current > 0 ? 100 : 0,
      type: current > 0 ? 'increase' : 'no-change'
    };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  
  return {
    value: Math.abs(change),
    type: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no-change'
  };
}

// ============================================================================
// FIELD MAPPING UTILITIES
// ============================================================================

/**
 * Map field names from GA4/MCP format to component format
 */
export const mapFields: FieldMapper = (data: any, mapping: FieldMapping): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const mapped: any = Array.isArray(data) ? [] : {};

  if (Array.isArray(data)) {
    // Handle array of objects
    return data.map(item => mapFields(item, mapping));
  }

  // Handle single object
  for (const [key, value] of Object.entries(data)) {
    const targetKey = mapping[key] || key;
    mapped[targetKey] = value;
  }

  return mapped;
};

/**
 * Common field mappings for GA4 to component format
 */
export const GA4_TO_COMPONENT_MAPPING: FieldMapping = {
  // Date fields
  'date': 'date',
  'dateHourMinute': 'date',
  
  // Session fields
  'sessions': 'sessions',
  'activeUsers': 'users',
  'totalUsers': 'users',
  'newUsers': 'newUsers',
  
  // Page view fields
  'screenPageViews': 'pageviews',
  'pageViews': 'pageviews',
  'views': 'pageviews',
  
  // Google Ads fields
  'adClicks': 'clicks',
  'clicks': 'clicks',
  'adImpressions': 'impressions',
  'impressions': 'impressions',
  'adCost': 'cost',
  'cost': 'cost',
  
  // Conversion fields
  'conversions': 'conversions',
  'goalCompletions': 'conversions',
  'ecommerceRevenue': 'revenue',
  'totalRevenue': 'revenue',
  'revenue': 'revenue',
  
  // Source/Medium fields
  'sessionSource': 'source',
  'source': 'source',
  'sessionMedium': 'medium',
  'medium': 'medium',
  'sessionCampaignName': 'campaign',
  'campaignName': 'campaign',
  
  // Page fields
  'pagePath': 'pagePath',
  'pageTitle': 'pageTitle',
  'landingPage': 'landingPage',
  
  // Time fields
  'averageSessionDuration': 'avgSessionDuration',
  'sessionDuration': 'sessionDuration',
  'timeOnPage': 'avgTimeOnPage',
  
  // Rate fields
  'bounceRate': 'bounceRate',
  'exitRate': 'exitRate'
};

// ============================================================================
// TYPE COERCION UTILITIES
// ============================================================================

/**
 * Safely coerce values to target types
 */
export const coerceType: TypeCoercer = (
  value: any, 
  targetType: 'string' | 'number' | 'boolean' | 'date'
): any => {
  if (value === null || value === undefined) {
    return getDefaultValueForType(targetType);
  }

  try {
    switch (targetType) {
      case 'string':
        return String(value);
      
      case 'number':
        return safeNumber(value);
      
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      
      case 'date':
        return normalizeDateString(value);
      
      default:
        return value;
    }
  } catch (error) {
    console.warn(`Type coercion failed for ${targetType}:`, error);
    return getDefaultValueForType(targetType);
  }
};

/**
 * Get default value for a given type
 */
function getDefaultValueForType(type: string): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'date': return new Date().toISOString().split('T')[0];
    default: return null;
  }
}

// ============================================================================
// NULL/UNDEFINED HANDLING
// ============================================================================

/**
 * Handle null/undefined values with defaults
 */
export const handleNullValue: NullHandler = (value: any, defaultValue: any = null): any => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  return value;
};

/**
 * Safely convert to number with fallback
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  
  return fallback;
}

/**
 * Deep clean object of null/undefined values
 */
export function cleanObject(obj: any, removeEmpty: boolean = true): any {
  if (obj === null || obj === undefined) {
    return {};
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObject(item, removeEmpty))
      .filter(item => !removeEmpty || (item !== null && item !== undefined));
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        if (!removeEmpty) {
          cleaned[key] = null;
        }
      } else if (typeof value === 'object') {
        cleaned[key] = cleanObject(value, removeEmpty);
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  return obj;
}

// ============================================================================
// PERCENTAGE CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate percentages from array of values
 */
export const calculatePercentages: PercentageCalculator = (
  values: number[], 
  config: { precision?: number } = {}
): number[] => {
  const precision = config.precision || 2;
  const total = values.reduce((sum, value) => sum + Math.abs(value), 0);
  
  if (total === 0) {
    return values.map(() => 0);
  }
  
  return values.map(value => 
    parseFloat(((Math.abs(value) / total) * 100).toFixed(precision))
  );
};

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format numbers based on configuration
 */
export function formatNumber(
  value: number, 
  config: NumberFormatConfig = {}
): string {
  const {
    locale = 'en-US',
    currency,
    decimalPlaces,
    useGrouping = true
  } = config;

  if (currency) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      useGrouping
    }).format(value);
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping
  }).format(value);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, precision: number = 2): string {
  return `${value.toFixed(precision)}%`;
}

/**
 * Format currency values - alias for formatNumber with currency
 */
export function formatCurrency(
  value: number, 
  currency: string = 'USD', 
  locale: string = 'en-US'
): string {
  return formatNumber(value, { currency, locale });
}

/**
 * Coerce value to number - alias for safeNumber
 */
export function coerceToNumber(value: any, fallback: number = 0): number {
  return safeNumber(value, fallback);
}

/**
 * Coerce value to string
 */
export function coerceToString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that an object has required fields
 */
export function validateRequiredFields(
  obj: any, 
  requiredFields: string[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Input must be an object');
    return { isValid: false, errors, warnings };
  }

  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate array data
 */
export function validateArrayData(data: any, minLength: number = 0): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { isValid: false, errors, warnings };
  }

  if (data.length < minLength) {
    errors.push(`Array must have at least ${minLength} items`);
  }

  if (data.length === 0) {
    warnings.push('Array is empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate time series data structure
 */
export function validateTimeSeriesData(data: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Time series data must be an array');
    return { isValid: false, errors, warnings };
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.date) {
      errors.push(`Item at index ${i} missing required 'date' field`);
    }
    if (typeof item.value === 'undefined') {
      errors.push(`Item at index ${i} missing required 'value' field`);
    }
    if (typeof item.value !== 'number' && item.value !== null) {
      errors.push(`Item at index ${i} 'value' must be a number or null`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate bar chart data structure
 */
export function validateBarChartData(data: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Bar chart data must be an array');
    return { isValid: false, errors, warnings };
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.category && !item.name && !item.label) {
      errors.push(`Item at index ${i} missing category/name/label field`);
    }
    if (typeof item.value === 'undefined') {
      errors.push(`Item at index ${i} missing required 'value' field`);
    }
    if (typeof item.value !== 'number' && item.value !== null) {
      errors.push(`Item at index ${i} 'value' must be a number or null`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate donut chart data structure
 */
export function validateDonutChartData(data: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Donut chart data must be an array');
    return { isValid: false, errors, warnings };
  }

  let totalValue = 0;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.category && !item.name && !item.label) {
      errors.push(`Item at index ${i} missing category/name/label field`);
    }
    if (typeof item.value === 'undefined') {
      errors.push(`Item at index ${i} missing required 'value' field`);
    }
    if (typeof item.value !== 'number' && item.value !== null) {
      errors.push(`Item at index ${i} 'value' must be a number or null`);
    } else if (typeof item.value === 'number') {
      totalValue += item.value;
    }
  }

  if (totalValue === 0) {
    warnings.push('Total value is zero - chart may appear empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}