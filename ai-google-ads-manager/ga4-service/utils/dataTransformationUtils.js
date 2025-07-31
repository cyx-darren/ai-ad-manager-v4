/**
 * Data Transformation Utilities for GA4 API Service
 * Phase 5.4.1: Data Normalization, Format Standardization, and Type Conversions
 */

const logger = require('./logger');

/**
 * Business data structure definitions
 * @typedef {Object} SessionMetrics
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {number} sessions - Total sessions
 * @property {number} users - Total users
 * @property {number} newUsers - New users
 * @property {number} pageViews - Page views
 * @property {number} avgSessionDuration - Average session duration in seconds
 * @property {number} bounceRate - Bounce rate percentage
 * @property {number} engagementRate - Engagement rate percentage
 */

/**
 * @typedef {Object} UserMetrics
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {number} totalUsers - Total users
 * @property {number} newUsers - New users
 * @property {number} returningUsers - Returning users
 * @property {number} activeUsers - Active users
 * @property {number} avgEngagementTime - Average engagement time in seconds
 * @property {number} engagementRate - Engagement rate percentage
 */

class DataTransformationUtils {
  
  /**
   * Data normalization constants
   */
  static get NORMALIZATION_RULES() {
    return {
      // Date format normalization
      DATE_FORMAT: 'YYYY-MM-DD',
      
      // Number precision rules
      PERCENTAGE_PRECISION: 2,
      DURATION_PRECISION: 1,
      CURRENCY_PRECISION: 2,
      METRIC_PRECISION: 0,
      
      // Default values for missing data
      DEFAULT_VALUES: {
        sessions: 0,
        users: 0,
        newUsers: 0,
        pageViews: 0,
        bounceRate: 0,
        engagementRate: 0,
        avgSessionDuration: 0,
        revenue: 0,
        conversions: 0
      },
      
      // Data validation limits
      VALIDATION_LIMITS: {
        bounceRate: { min: 0, max: 100 },
        engagementRate: { min: 0, max: 100 },
        avgSessionDuration: { min: 0, max: 86400 }, // 24 hours max
        pageViews: { min: 0, max: 999999999 },
        users: { min: 0, max: 999999999 }
      }
    };
  }

  /**
   * Normalize raw GA4 API response data into standardized format
   * @param {Object} rawData - Raw GA4 API response
   * @param {string} dataType - Type of data ('sessions', 'users', 'traffic', 'pages', 'conversions')
   * @returns {Object} Normalized data structure
   */
  static normalizeGA4Data(rawData, dataType) {
    try {
      logger.debug('Normalizing GA4 data', { dataType, recordCount: rawData.data?.length || 0 });

      if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        logger.warn('Invalid raw data provided for normalization', { rawData });
        return this.createEmptyNormalizedStructure(dataType);
      }

      const normalizedData = {
        metadata: this.normalizeMetadata(rawData.metadata),
        dateRange: this.normalizeDateRange(rawData.dateRange),
        records: [],
        summary: {},
        breakdown: {}
      };

      // Normalize individual records
      normalizedData.records = rawData.data.map(record => 
        this.normalizeDataRecord(record, dataType)
      ).filter(record => record !== null);

      // Generate summary statistics
      normalizedData.summary = this.generateSummaryStatistics(normalizedData.records, dataType);

      // Generate breakdown analysis
      normalizedData.breakdown = this.generateBreakdownAnalysis(normalizedData.records, dataType);

      logger.info('GA4 data normalization completed', {
        dataType,
        originalRecords: rawData.data.length,
        normalizedRecords: normalizedData.records.length,
        summaryMetrics: Object.keys(normalizedData.summary).length
      });

      return normalizedData;

    } catch (error) {
      logger.error('Failed to normalize GA4 data:', { error: error.message, dataType });
      return this.createEmptyNormalizedStructure(dataType);
    }
  }

  /**
   * Normalize individual data record based on type
   * @param {Object} record - Individual data record
   * @param {string} dataType - Type of data
   * @returns {Object|null} Normalized record or null if invalid
   */
  static normalizeDataRecord(record, dataType) {
    try {
      if (!record || !record.dimensions || !record.metrics) {
        return null;
      }

      const baseRecord = {
        id: this.generateRecordId(record),
        date: this.normalizeDate(record.dimensions.date),
        dimensions: this.normalizeDimensions(record.dimensions),
        metrics: this.normalizeMetrics(record.metrics, dataType)
      };

      // Add type-specific normalizations
      switch (dataType) {
        case 'sessions':
          return this.normalizeSessionRecord(baseRecord);
        case 'users':
          return this.normalizeUserRecord(baseRecord);
        case 'traffic':
          return this.normalizeTrafficRecord(baseRecord);
        case 'pages':
          return this.normalizePageRecord(baseRecord);
        case 'conversions':
          return this.normalizeConversionRecord(baseRecord);
        default:
          return baseRecord;
      }

    } catch (error) {
      logger.warn('Failed to normalize individual record:', { error: error.message, record });
      return null;
    }
  }

  /**
   * Normalize session-specific data record
   * @param {Object} baseRecord - Base normalized record
   * @returns {Object} Session-specific normalized record
   */
  static normalizeSessionRecord(baseRecord) {
    const metrics = baseRecord.metrics;
    
    return {
      ...baseRecord,
      type: 'session',
      sessionMetrics: {
        sessions: this.validateAndCleanNumber(metrics.sessions, 'sessions'),
        users: this.validateAndCleanNumber(metrics.totalUsers, 'users'),
        newUsers: this.validateAndCleanNumber(metrics.newUsers, 'newUsers'),
        pageViews: this.validateAndCleanNumber(metrics.screenPageViews, 'pageViews'),
        avgSessionDuration: this.validateAndCleanDuration(metrics.averageSessionDuration),
        bounceRate: this.validateAndCleanPercentage(metrics.bounceRate),
        engagementRate: this.calculateEngagementRate(metrics),
        sessionsPerUser: this.calculateSafeRatio(metrics.sessions, metrics.totalUsers),
        pageViewsPerSession: this.calculateSafeRatio(metrics.screenPageViews, metrics.sessions)
      }
    };
  }

  /**
   * Normalize user-specific data record
   * @param {Object} baseRecord - Base normalized record
   * @returns {Object} User-specific normalized record
   */
  static normalizeUserRecord(baseRecord) {
    const metrics = baseRecord.metrics;
    
    return {
      ...baseRecord,
      type: 'user',
      userMetrics: {
        totalUsers: this.validateAndCleanNumber(metrics.totalUsers, 'users'),
        newUsers: this.validateAndCleanNumber(metrics.newUsers, 'newUsers'),
        returningUsers: this.calculateReturningUsers(metrics),
        activeUsers: this.validateAndCleanNumber(metrics.activeUsers, 'users'),
        avgEngagementTime: this.validateAndCleanDuration(metrics.userEngagementDuration),
        engagementRate: this.validateAndCleanPercentage(metrics.engagementRate),
        sessionsPerUser: this.calculateSafeRatio(metrics.sessions, metrics.totalUsers),
        engagedSessions: this.validateAndCleanNumber(metrics.engagedSessions, 'sessions')
      }
    };
  }

  /**
   * Normalize traffic source data record
   * @param {Object} baseRecord - Base normalized record
   * @returns {Object} Traffic-specific normalized record
   */
  static normalizeTrafficRecord(baseRecord) {
    const metrics = baseRecord.metrics;
    const dimensions = baseRecord.dimensions;
    
    return {
      ...baseRecord,
      type: 'traffic',
      trafficMetrics: {
        source: this.normalizeStringValue(dimensions.source),
        medium: this.normalizeStringValue(dimensions.medium),
        sourceMedium: this.createSourceMediumCombination(dimensions),
        sessions: this.validateAndCleanNumber(metrics.sessions, 'sessions'),
        users: this.validateAndCleanNumber(metrics.totalUsers, 'users'),
        newUsers: this.validateAndCleanNumber(metrics.newUsers, 'newUsers'),
        pageViews: this.validateAndCleanNumber(metrics.screenPageViews, 'pageViews'),
        bounceRate: this.validateAndCleanPercentage(metrics.bounceRate),
        avgSessionDuration: this.validateAndCleanDuration(metrics.averageSessionDuration),
        conversions: this.validateAndCleanNumber(metrics.conversions, 'conversions'),
        conversionRate: this.calculateConversionRate(metrics)
      }
    };
  }

  /**
   * Normalize page performance data record
   * @param {Object} baseRecord - Base normalized record
   * @returns {Object} Page-specific normalized record
   */
  static normalizePageRecord(baseRecord) {
    const metrics = baseRecord.metrics;
    const dimensions = baseRecord.dimensions;
    
    return {
      ...baseRecord,
      type: 'page',
      pageMetrics: {
        pagePath: this.normalizePagePath(dimensions.pagePath),
        pageTitle: this.normalizeStringValue(dimensions.pageTitle),
        pageViews: this.validateAndCleanNumber(metrics.screenPageViews, 'pageViews'),
        uniquePageViews: this.validateAndCleanNumber(metrics.uniqueScreenPageViews, 'pageViews'),
        users: this.validateAndCleanNumber(metrics.totalUsers, 'users'),
        sessions: this.validateAndCleanNumber(metrics.sessions, 'sessions'),
        avgTimeOnPage: this.validateAndCleanDuration(metrics.userEngagementDuration),
        bounceRate: this.validateAndCleanPercentage(metrics.bounceRate),
        engagementRate: this.validateAndCleanPercentage(metrics.engagementRate),
        exitRate: this.calculateExitRate(metrics),
        viewsPerSession: this.calculateSafeRatio(metrics.screenPageViews, metrics.sessions)
      }
    };
  }

  /**
   * Normalize conversion data record
   * @param {Object} baseRecord - Base normalized record
   * @returns {Object} Conversion-specific normalized record
   */
  static normalizeConversionRecord(baseRecord) {
    const metrics = baseRecord.metrics;
    const dimensions = baseRecord.dimensions;
    
    return {
      ...baseRecord,
      type: 'conversion',
      conversionMetrics: {
        eventName: this.normalizeStringValue(dimensions.eventName),
        conversions: this.validateAndCleanNumber(metrics.conversions, 'conversions'),
        totalRevenue: this.validateAndCleanCurrency(metrics.totalRevenue),
        purchaseRevenue: this.validateAndCleanCurrency(metrics.purchaseRevenue),
        sessions: this.validateAndCleanNumber(metrics.sessions, 'sessions'),
        users: this.validateAndCleanNumber(metrics.totalUsers, 'users'),
        sessionsWithEvent: this.validateAndCleanNumber(metrics.sessionsWithEvent, 'sessions'),
        userConversionRate: this.validateAndCleanPercentage(metrics.userConversionRate),
        sessionConversionRate: this.validateAndCleanPercentage(metrics.sessionConversionRate),
        averageOrderValue: this.calculateAverageOrderValue(metrics),
        revenuePerUser: this.calculateSafeRatio(metrics.totalRevenue, metrics.totalUsers),
        revenuePerSession: this.calculateSafeRatio(metrics.totalRevenue, metrics.sessions)
      }
    };
  }

  /**
   * Format standardization functions
   */

  /**
   * Normalize date to standard format
   * @param {string} dateValue - Date value to normalize
   * @returns {string} Normalized date in YYYY-MM-DD format
   */
  static normalizeDate(dateValue) {
    if (!dateValue) return null;
    
    try {
      // Handle different date formats
      let date;
      if (dateValue.includes('-')) {
        date = new Date(dateValue);
      } else if (dateValue.length === 8) {
        // Handle YYYYMMDD format
        const year = dateValue.substring(0, 4);
        const month = dateValue.substring(4, 6);
        const day = dateValue.substring(6, 8);
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) {
        logger.warn('Invalid date value:', dateValue);
        return null;
      }

      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      logger.warn('Failed to normalize date:', { dateValue, error: error.message });
      return null;
    }
  }

  /**
   * Normalize string value
   * @param {string} value - String value to normalize
   * @returns {string} Normalized string
   */
  static normalizeStringValue(value) {
    if (!value || typeof value !== 'string') return '';
    
    return value
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .toLowerCase();
  }

  /**
   * Normalize page path
   * @param {string} pagePath - Page path to normalize
   * @returns {string} Normalized page path
   */
  static normalizePagePath(pagePath) {
    if (!pagePath) return '/';
    
    let normalized = pagePath.trim();
    
    // Ensure it starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    // Remove query parameters and fragments for consistency
    normalized = normalized.split('?')[0].split('#')[0];
    
    // Remove trailing slash unless it's the root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }

  /**
   * Data type conversion and validation functions
   */

  /**
   * Validate and clean numeric values
   * @param {any} value - Value to validate and clean
   * @param {string} metricType - Type of metric for validation
   * @returns {number} Cleaned numeric value
   */
  static validateAndCleanNumber(value, metricType = 'generic') {
    if (value === null || value === undefined || value === '') {
      return this.NORMALIZATION_RULES.DEFAULT_VALUES[metricType] || 0;
    }

    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || !isFinite(numValue)) {
      logger.warn('Invalid numeric value detected:', { value, metricType });
      return this.NORMALIZATION_RULES.DEFAULT_VALUES[metricType] || 0;
    }

    // Apply validation limits if they exist
    const limits = this.NORMALIZATION_RULES.VALIDATION_LIMITS[metricType];
    if (limits) {
      if (numValue < limits.min) {
        logger.warn('Value below minimum limit:', { value: numValue, min: limits.min, metricType });
        return limits.min;
      }
      if (numValue > limits.max) {
        logger.warn('Value above maximum limit:', { value: numValue, max: limits.max, metricType });
        return limits.max;
      }
    }

    // Round to appropriate precision
    const precision = metricType === 'sessions' || metricType === 'users' || metricType === 'pageViews' 
      ? this.NORMALIZATION_RULES.METRIC_PRECISION 
      : 2;
    
    return Math.round(numValue * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  /**
   * Validate and clean percentage values
   * @param {any} value - Percentage value to validate
   * @returns {number} Cleaned percentage (0-100)
   */
  static validateAndCleanPercentage(value) {
    const numValue = this.validateAndCleanNumber(value, 'generic');
    
    // Ensure percentage is between 0 and 100
    if (numValue < 0) return 0;
    if (numValue > 100) return 100;
    
    return Math.round(numValue * 100) / 100; // 2 decimal places
  }

  /**
   * Validate and clean duration values (in seconds)
   * @param {any} value - Duration value to validate
   * @returns {number} Cleaned duration in seconds
   */
  static validateAndCleanDuration(value) {
    const numValue = this.validateAndCleanNumber(value, 'generic');
    
    // Ensure duration is non-negative and reasonable (max 24 hours)
    if (numValue < 0) return 0;
    if (numValue > 86400) return 86400; // 24 hours max
    
    return Math.round(numValue * 10) / 10; // 1 decimal place
  }

  /**
   * Validate and clean currency values
   * @param {any} value - Currency value to validate
   * @returns {number} Cleaned currency value
   */
  static validateAndCleanCurrency(value) {
    const numValue = this.validateAndCleanNumber(value, 'revenue');
    
    // Ensure non-negative
    if (numValue < 0) return 0;
    
    return Math.round(numValue * 100) / 100; // 2 decimal places
  }

  /**
   * Business logic calculation functions
   */

  /**
   * Calculate safe ratio avoiding division by zero
   * @param {number} numerator - Numerator value
   * @param {number} denominator - Denominator value
   * @returns {number} Safe ratio
   */
  static calculateSafeRatio(numerator, denominator) {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100) / 100;
  }

  /**
   * Calculate engagement rate from metrics
   * @param {Object} metrics - Metrics object
   * @returns {number} Engagement rate percentage
   */
  static calculateEngagementRate(metrics) {
    if (metrics.engagementRate !== undefined) {
      return this.validateAndCleanPercentage(metrics.engagementRate);
    }
    
    // Calculate from engaged sessions if available
    if (metrics.engagedSessions && metrics.sessions) {
      return this.validateAndCleanPercentage((metrics.engagedSessions / metrics.sessions) * 100);
    }
    
    return 0;
  }

  /**
   * Calculate returning users
   * @param {Object} metrics - Metrics object
   * @returns {number} Returning users count
   */
  static calculateReturningUsers(metrics) {
    const totalUsers = this.validateAndCleanNumber(metrics.totalUsers, 'users');
    const newUsers = this.validateAndCleanNumber(metrics.newUsers, 'newUsers');
    
    const returningUsers = totalUsers - newUsers;
    return returningUsers < 0 ? 0 : returningUsers;
  }

  /**
   * Create source/medium combination
   * @param {Object} dimensions - Dimensions object
   * @returns {string} Source/medium combination
   */
  static createSourceMediumCombination(dimensions) {
    const source = this.normalizeStringValue(dimensions.source) || '(direct)';
    const medium = this.normalizeStringValue(dimensions.medium) || '(none)';
    return `${source} / ${medium}`;
  }

  /**
   * Calculate conversion rate
   * @param {Object} metrics - Metrics object
   * @returns {number} Conversion rate percentage
   */
  static calculateConversionRate(metrics) {
    if (metrics.sessionConversionRate !== undefined) {
      return this.validateAndCleanPercentage(metrics.sessionConversionRate);
    }
    
    if (metrics.conversions && metrics.sessions) {
      return this.validateAndCleanPercentage((metrics.conversions / metrics.sessions) * 100);
    }
    
    return 0;
  }

  /**
   * Calculate average order value
   * @param {Object} metrics - Metrics object
   * @returns {number} Average order value
   */
  static calculateAverageOrderValue(metrics) {
    const revenue = this.validateAndCleanCurrency(metrics.purchaseRevenue || metrics.totalRevenue);
    const conversions = this.validateAndCleanNumber(metrics.conversions, 'conversions');
    
    return this.calculateSafeRatio(revenue, conversions);
  }

  /**
   * Calculate exit rate (estimated)
   * @param {Object} metrics - Metrics object
   * @returns {number} Exit rate percentage
   */
  static calculateExitRate(metrics) {
    // Exit rate estimation based on bounce rate and other factors
    const bounceRate = this.validateAndCleanPercentage(metrics.bounceRate);
    
    // Simple estimation - in reality this would need more sophisticated calculation
    return Math.min(bounceRate * 1.2, 100);
  }

  /**
   * Utility functions for data structure creation
   */

  /**
   * Generate unique record ID
   * @param {Object} record - Data record
   * @returns {string} Unique record ID
   */
  static generateRecordId(record) {
    const dimensions = record.dimensions || {};
    const date = dimensions.date || 'unknown';
    const key = Object.values(dimensions).join('_').replace(/[^a-zA-Z0-9]/g, '_');
    return `${date}_${key}_${Date.now()}`;
  }

  /**
   * Normalize metadata structure
   * @param {Object} metadata - Raw metadata
   * @returns {Object} Normalized metadata
   */
  static normalizeMetadata(metadata = {}) {
    return {
      recordCount: metadata.recordCount || 0,
      samplingMetadata: metadata.samplingMetadata || null,
      currencyCode: metadata.currencyCode || 'USD',
      timezone: metadata.timezone || 'UTC',
      quotaConsumed: metadata.quotaConsumed || null,
      dataFreshness: new Date().toISOString(),
      processingTime: Date.now()
    };
  }

  /**
   * Normalize date range structure
   * @param {Object} dateRange - Raw date range
   * @returns {Object} Normalized date range
   */
  static normalizeDateRange(dateRange = {}) {
    return {
      startDate: this.normalizeDate(dateRange.startDate),
      endDate: this.normalizeDate(dateRange.endDate),
      dayCount: this.calculateDayCount(dateRange.startDate, dateRange.endDate)
    };
  }

  /**
   * Calculate day count between dates
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {number} Number of days
   */
  static calculateDayCount(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
    } catch (error) {
      return 0;
    }
  }

  /**
   * Normalize dimensions object
   * @param {Object} dimensions - Raw dimensions
   * @returns {Object} Normalized dimensions
   */
  static normalizeDimensions(dimensions = {}) {
    const normalized = {};
    
    Object.keys(dimensions).forEach(key => {
      const value = dimensions[key];
      
      if (key === 'date') {
        normalized[key] = this.normalizeDate(value);
      } else if (key === 'pagePath') {
        normalized[key] = this.normalizePagePath(value);
      } else {
        normalized[key] = this.normalizeStringValue(value);
      }
    });
    
    return normalized;
  }

  /**
   * Normalize metrics object
   * @param {Object} metrics - Raw metrics
   * @param {string} dataType - Type of data
   * @returns {Object} Normalized metrics
   */
  static normalizeMetrics(metrics = {}, dataType) {
    const normalized = {};
    
    Object.keys(metrics).forEach(key => {
      const value = metrics[key];
      
      if (key.includes('Rate') || key.includes('Percentage')) {
        normalized[key] = this.validateAndCleanPercentage(value);
      } else if (key.includes('Duration') || key.includes('Time')) {
        normalized[key] = this.validateAndCleanDuration(value);
      } else if (key.includes('Revenue') || key.includes('Value')) {
        normalized[key] = this.validateAndCleanCurrency(value);
      } else {
        normalized[key] = this.validateAndCleanNumber(value, key);
      }
    });
    
    return normalized;
  }

  /**
   * Generate summary statistics
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Summary statistics
   */
  static generateSummaryStatistics(records, dataType) {
    if (!records || records.length === 0) {
      return this.createEmptySummary(dataType);
    }

    const summary = {
      totalRecords: records.length,
      dateRange: this.extractDateRange(records),
      aggregatedMetrics: this.aggregateMetrics(records, dataType),
      averageMetrics: this.calculateAverageMetrics(records, dataType),
      trendAnalysis: this.calculateTrendAnalysis(records, dataType)
    };

    return summary;
  }

  /**
   * Generate breakdown analysis
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Breakdown analysis
   */
  static generateBreakdownAnalysis(records, dataType) {
    if (!records || records.length === 0) {
      return this.createEmptyBreakdown(dataType);
    }

    const breakdown = {
      topPerformers: this.identifyTopPerformers(records, dataType),
      timeSeriesData: this.createTimeSeriesData(records, dataType),
      segmentAnalysis: this.performSegmentAnalysis(records, dataType),
      performanceDistribution: this.analyzePerformanceDistribution(records, dataType)
    };

    return breakdown;
  }

  /**
   * Create empty normalized structure for error cases
   * @param {string} dataType - Type of data
   * @returns {Object} Empty normalized structure
   */
  static createEmptyNormalizedStructure(dataType) {
    return {
      metadata: this.normalizeMetadata(),
      dateRange: this.normalizeDateRange(),
      records: [],
      summary: this.createEmptySummary(dataType),
      breakdown: this.createEmptyBreakdown(dataType)
    };
  }

  /**
   * Create empty summary for different data types
   * @param {string} dataType - Type of data
   * @returns {Object} Empty summary
   */
  static createEmptySummary(dataType) {
    const baseSummary = {
      totalRecords: 0,
      dateRange: { startDate: null, endDate: null, dayCount: 0 },
      aggregatedMetrics: {},
      averageMetrics: {},
      trendAnalysis: {}
    };

    return baseSummary;
  }

  /**
   * Create empty breakdown for different data types
   * @param {string} dataType - Type of data
   * @returns {Object} Empty breakdown
   */
  static createEmptyBreakdown(dataType) {
    return {
      topPerformers: [],
      timeSeriesData: [],
      segmentAnalysis: {},
      performanceDistribution: {}
    };
  }

  /**
   * Helper functions for summary and breakdown generation
   */

  /**
   * Extract date range from records
   * @param {Array} records - Normalized records
   * @returns {Object} Date range information
   */
  static extractDateRange(records) {
    const dates = records
      .map(record => record.date)
      .filter(date => date)
      .sort();

    return {
      startDate: dates[0] || null,
      endDate: dates[dates.length - 1] || null,
      dayCount: dates.length
    };
  }

  /**
   * Aggregate metrics across records
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Aggregated metrics
   */
  static aggregateMetrics(records, dataType) {
    // Implementation would aggregate metrics based on data type
    // This is a simplified version
    const aggregated = {};
    
    records.forEach(record => {
      const metrics = record[`${dataType}Metrics`] || record.metrics || {};
      
      Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'number') {
          aggregated[key] = (aggregated[key] || 0) + metrics[key];
        }
      });
    });

    return aggregated;
  }

  /**
   * Calculate average metrics
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Average metrics
   */
  static calculateAverageMetrics(records, dataType) {
    const aggregated = this.aggregateMetrics(records, dataType);
    const averages = {};
    
    Object.keys(aggregated).forEach(key => {
      averages[key] = this.calculateSafeRatio(aggregated[key], records.length);
    });

    return averages;
  }

  /**
   * Calculate trend analysis
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Trend analysis
   */
  static calculateTrendAnalysis(records, dataType) {
    // Simplified trend analysis
    const sortedRecords = records
      .filter(record => record.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedRecords.length < 2) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    // Basic trend calculation (could be enhanced with more sophisticated algorithms)
    const firstHalf = sortedRecords.slice(0, Math.floor(sortedRecords.length / 2));
    const secondHalf = sortedRecords.slice(Math.floor(sortedRecords.length / 2));

    return {
      trend: 'stable', // simplified
      confidence: 0.5,
      periods: {
        first: firstHalf.length,
        second: secondHalf.length
      }
    };
  }

  /**
   * Identify top performers
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Array} Top performing records
   */
  static identifyTopPerformers(records, dataType) {
    // Return top 10 records based on primary metric
    return records
      .sort((a, b) => {
        const aMetrics = a[`${dataType}Metrics`] || a.metrics || {};
        const bMetrics = b[`${dataType}Metrics`] || b.metrics || {};
        
        // Sort by primary metric (sessions, users, etc.)
        const aPrimary = aMetrics.sessions || aMetrics.users || aMetrics.pageViews || 0;
        const bPrimary = bMetrics.sessions || bMetrics.users || bMetrics.pageViews || 0;
        
        return bPrimary - aPrimary;
      })
      .slice(0, 10);
  }

  /**
   * Create time series data
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Array} Time series data points
   */
  static createTimeSeriesData(records, dataType) {
    return records
      .filter(record => record.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(record => ({
        date: record.date,
        metrics: record[`${dataType}Metrics`] || record.metrics || {}
      }));
  }

  /**
   * Perform segment analysis
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Segment analysis
   */
  static performSegmentAnalysis(records, dataType) {
    // Group records by common dimensions for analysis
    const segments = {};
    
    records.forEach(record => {
      const dimensions = record.dimensions || {};
      
      // Create segments based on available dimensions
      Object.keys(dimensions).forEach(dimKey => {
        if (dimKey !== 'date') {
          const dimValue = dimensions[dimKey] || 'unknown';
          
          if (!segments[dimKey]) segments[dimKey] = {};
          if (!segments[dimKey][dimValue]) segments[dimKey][dimValue] = [];
          
          segments[dimKey][dimValue].push(record);
        }
      });
    });

    return segments;
  }

  /**
   * Analyze performance distribution
   * @param {Array} records - Normalized records
   * @param {string} dataType - Type of data
   * @returns {Object} Performance distribution analysis
   */
  static analyzePerformanceDistribution(records, dataType) {
    // Analyze distribution of key metrics
    const distribution = {
      quartiles: {},
      outliers: [],
      distribution: 'normal' // simplified
    };

    return distribution;
  }
}

module.exports = { DataTransformationUtils };