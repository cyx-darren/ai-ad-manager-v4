/**
 * GA4 API Utilities for Common Operations
 * Phase 5.3.6: Shared utilities and error handling
 */

const logger = require('./logger');

class GA4Utils {
  /**
   * Standard GA4 API error handler
   * @param {Error} error - The error object
   * @param {string} operation - Operation being performed
   * @param {Object} context - Additional context (propertyId, options, etc.)
   * @returns {Error} Enhanced error with standardized message
   */
  static handleGA4Error(error, operation, context = {}) {
    const { propertyId, options } = context;
    
    logger.error(`GA4 ${operation} failed:`, {
      error: error.message,
      propertyId,
      options,
      stack: error.stack
    });

    // Map common GA4 errors to user-friendly messages
    if (error.message.includes('PERMISSION_DENIED')) {
      return new Error('Access denied: Check that the service account has access to the GA4 property');
    } else if (error.message.includes('INVALID_ARGUMENT')) {
      return new Error('Invalid request parameters: Check property ID and date range format');
    } else if (error.message.includes('RESOURCE_EXHAUSTED')) {
      return new Error('API quota exceeded: Too many requests. Please try again later');
    } else if (error.message.includes('UNAUTHENTICATED')) {
      return new Error('Authentication failed: Check service account credentials');
    } else if (error.message.includes('NOT_FOUND')) {
      return new Error('GA4 property not found: Verify the property ID exists and is accessible');
    } else if (error.message.includes('DEADLINE_EXCEEDED')) {
      return new Error('Request timeout: The GA4 API request took too long');
    } else if (error.message.includes('UNAVAILABLE')) {
      return new Error('GA4 API temporarily unavailable: Please try again later');
    } else if (error.message.includes('INTERNAL')) {
      return new Error('Internal GA4 API error: Please try again or contact support');
    }

    // Return original error if no specific mapping
    return error;
  }

  /**
   * Create standardized GA4 API request structure
   * @param {string} propertyId - GA4 property ID
   * @param {Array} dimensions - Dimensions array
   * @param {Array} metrics - Metrics array
   * @param {Object} dateRange - Date range object
   * @param {Object} options - Additional options
   * @returns {Object} Formatted GA4 API request
   */
  static createGA4Request(propertyId, dimensions, metrics, dateRange, options = {}) {
    const request = {
      property: propertyId,
      dimensions: dimensions.map(dim => ({ name: dim })),
      metrics: metrics.map(metric => ({ name: metric })),
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      ]
    };

    // Add optional parameters
    if (options.limit) {
      request.limit = options.limit;
    }

    if (options.orderBys) {
      request.orderBys = options.orderBys;
    }

    if (options.dimensionFilter) {
      request.dimensionFilter = options.dimensionFilter;
    }

    if (options.metricFilter) {
      request.metricFilter = options.metricFilter;
    }

    if (options.keepEmptyRows !== undefined) {
      request.keepEmptyRows = options.keepEmptyRows;
    }

    return request;
  }

  /**
   * Transform GA4 API response into standardized format
   * @param {Object} response - Raw GA4 API response
   * @param {Object} context - Request context
   * @returns {Object} Standardized response format
   */
  static transformGA4Response(response, context = {}) {
    const { startDate, endDate, endpoint } = context;

    // Handle empty response
    if (!response.rows || response.rows.length === 0) {
      return {
        propertyId: response.metadata?.currencyCode ? 'Available' : 'Unknown',
        dateRange: { startDate, endDate },
        data: [],
        summary: this.createEmptySummary(endpoint),
        breakdown: this.createEmptyBreakdown(endpoint),
        metadata: {
          recordCount: 0,
          samplingMetadata: response.metadata?.samplesReadCounts || null,
          currencyCode: response.metadata?.currencyCode || null,
          timezone: response.metadata?.timeZone || null,
          quotaConsumed: response.metadata?.quotaConsumed || null
        }
      };
    }

    // Transform rows into normalized format
    const data = response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      // Process dimensions
      row.dimensionValues?.forEach((dimValue, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = dimValue.value;
        }
      });

      // Process metrics
      row.metricValues?.forEach((metricValue, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          const value = parseFloat(metricValue.value) || 0;
          metrics[metricName] = value;
        }
      });

      return {
        dimensions,
        metrics
      };
    });

    return {
      propertyId: 'Fetched Successfully',
      dateRange: { startDate, endDate },
      data,
      metadata: {
        recordCount: data.length,
        samplingMetadata: response.metadata?.samplesReadCounts || null,
        currencyCode: response.metadata?.currencyCode || null,
        timezone: response.metadata?.timeZone || null,
        quotaConsumed: response.metadata?.quotaConsumed || null
      }
    };
  }

  /**
   * Create empty summary for different endpoint types
   * @param {string} endpoint - Endpoint name
   * @returns {Object} Empty summary object
   */
  static createEmptySummary(endpoint) {
    const baseSummary = {
      totalSessions: 0,
      totalUsers: 0
    };

    switch (endpoint) {
      case 'getSessionMetrics':
        return {
          ...baseSummary,
          newUsers: 0,
          sessionsPerUser: 0,
          averageSessionDuration: 0,
          bounceRate: 0,
          screenPageViews: 0,
          screenPageViewsPerSession: 0
        };
      
      case 'getUserMetrics':
        return {
          ...baseSummary,
          newUsers: 0,
          returningUsers: 0,
          activeUsers: 0,
          userEngagementDuration: 0,
          engagedSessions: 0,
          engagementRate: 0,
          averageEngagementTime: 0
        };
      
      case 'getTrafficSourceBreakdown':
        return {
          ...baseSummary,
          newUsers: 0,
          totalPageViews: 0,
          averageSessionDuration: 0,
          bounceRate: 0,
          engagementRate: 0,
          totalConversions: 0,
          conversionRate: 0,
          pageViewsPerSession: 0
        };
      
      case 'getPagePerformance':
        return {
          totalPageViews: 0,
          uniquePageViews: 0,
          ...baseSummary,
          averageSessionDuration: 0,
          bounceRate: 0,
          engagementRate: 0,
          userEngagementDuration: 0,
          viewsPerSession: 0,
          usersPerPage: 0
        };
      
      case 'getConversionMetrics':
        return {
          totalConversions: 0,
          totalRevenue: 0,
          purchaseRevenue: 0,
          ...baseSummary,
          sessionsWithConversions: 0,
          userConversionRate: 0,
          sessionConversionRate: 0,
          averageOrderValue: 0,
          revenuePerUser: 0
        };
      
      default:
        return baseSummary;
    }
  }

  /**
   * Create empty breakdown for different endpoint types
   * @param {string} endpoint - Endpoint name
   * @returns {Object} Empty breakdown object
   */
  static createEmptyBreakdown(endpoint) {
    switch (endpoint) {
      case 'getSessionMetrics':
        return {
          sessionsByDate: [],
          topCountries: [],
          topDevices: []
        };
      
      case 'getUserMetrics':
        return {
          usersByDate: [],
          topCountries: [],
          userTypeBreakdown: []
        };
      
      case 'getTrafficSourceBreakdown':
        return {
          topSources: [],
          topMediums: [],
          sourceMediumCombinations: []
        };
      
      case 'getPagePerformance':
        return {
          topPages: [],
          pagesByEngagement: [],
          pagesByBounceRate: []
        };
      
      case 'getConversionMetrics':
        return {
          topConversionEvents: [],
          conversionsByDate: [],
          revenueByEvent: []
        };
      
      default:
        return {};
    }
  }

  /**
   * Calculate percentage safely (avoid division by zero)
   * @param {number} numerator - Numerator value
   * @param {number} denominator - Denominator value
   * @param {number} defaultValue - Default value if denominator is 0
   * @returns {number} Calculated percentage
   */
  static safePercentage(numerator, denominator, defaultValue = 0) {
    if (denominator === 0 || !Number.isFinite(denominator)) {
      return defaultValue;
    }
    return (numerator / denominator) * 100;
  }

  /**
   * Calculate ratio safely (avoid division by zero)
   * @param {number} numerator - Numerator value
   * @param {number} denominator - Denominator value
   * @param {number} defaultValue - Default value if denominator is 0
   * @returns {number} Calculated ratio
   */
  static safeRatio(numerator, denominator, defaultValue = 0) {
    if (denominator === 0 || !Number.isFinite(denominator)) {
      return defaultValue;
    }
    return numerator / denominator;
  }

  /**
   * Round number to specified decimal places
   * @param {number} value - Value to round
   * @param {number} decimals - Number of decimal places
   * @returns {number} Rounded value
   */
  static roundToDecimals(value, decimals = 2) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Sort array by numeric property (descending by default)
   * @param {Array} array - Array to sort
   * @param {string} property - Property to sort by
   * @param {boolean} ascending - Sort order (default: false)
   * @returns {Array} Sorted array
   */
  static sortByProperty(array, property, ascending = false) {
    return array.sort((a, b) => {
      const aVal = a[property] || 0;
      const bVal = b[property] || 0;
      return ascending ? aVal - bVal : bVal - aVal;
    });
  }

  /**
   * Aggregate array data by a specific property
   * @param {Array} data - Data array
   * @param {string} groupBy - Property to group by
   * @param {Array} sumProperties - Properties to sum
   * @returns {Object} Aggregated data
   */
  static aggregateByProperty(data, groupBy, sumProperties = []) {
    const aggregated = {};

    data.forEach(item => {
      const key = item[groupBy];
      if (!aggregated[key]) {
        aggregated[key] = { [groupBy]: key };
        sumProperties.forEach(prop => {
          aggregated[key][prop] = 0;
        });
      }

      sumProperties.forEach(prop => {
        aggregated[key][prop] += item[prop] || 0;
      });
    });

    return aggregated;
  }

  /**
   * Format numbers for display
   * @param {number} value - Value to format
   * @param {string} type - Format type ('currency', 'percentage', 'decimal', 'integer')
   * @param {string} currency - Currency code for currency formatting
   * @returns {string} Formatted value
   */
  static formatNumber(value, type = 'decimal', currency = 'USD') {
    if (!Number.isFinite(value)) {
      return '0';
    }

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(value);
      
      case 'percentage':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value / 100);
      
      case 'integer':
        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 0
        }).format(value);
      
      case 'decimal':
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
    }
  }

  /**
   * Create performance timing metrics
   * @param {number} startTime - Start timestamp
   * @param {string} operation - Operation name
   * @returns {Object} Performance metrics
   */
  static createPerformanceMetrics(startTime, operation) {
    const duration = Date.now() - startTime;
    const metrics = {
      operation,
      duration,
      timestamp: new Date().toISOString()
    };

    // Log performance for slow operations
    if (duration > 5000) {
      logger.warn('Slow GA4 operation detected:', metrics);
    } else if (duration > 2000) {
      logger.info('GA4 operation completed:', metrics);
    }

    return metrics;
  }
}

module.exports = { GA4Utils };