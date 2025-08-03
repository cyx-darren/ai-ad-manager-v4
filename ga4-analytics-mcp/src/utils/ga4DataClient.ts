/**
 * Shared GA4 Data Fetching Client
 * 
 * Provides a unified interface for all GA4 data operations with built-in
 * error handling, data transformation, and caching capabilities.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { logger } from './logger.js';
import { MCPErrorHandler, ErrorCode } from './errorHandler.js';
import { performanceMonitor } from './performanceMetrics.js';
import { getAuthManager } from './googleAuth.js';
// Google Analytics Data API types (using any for compatibility)
export interface GA4DateRange {
  startDate: string;
  endDate: string;
  name?: string;
}

export interface GA4Dimension {
  name: string;
}

export interface GA4Metric {
  name: string;
}

export interface GA4RunReportRequest {
  property: string;
  dateRanges: GA4DateRange[];
  metrics: GA4Metric[];
  dimensions?: GA4Dimension[];
  limit?: number;
  offset?: number;
  orderBys?: any[];
  dimensionFilter?: any;
  metricFilter?: any;
}

export interface GA4RunRealtimeReportRequest {
  property: string;
  metrics: GA4Metric[];
  dimensions?: GA4Dimension[];
  limit?: number;
  orderBys?: any[];
  dimensionFilter?: any;
  metricFilter?: any;
}

// Common GA4 date range types
export interface DateRangeOptions {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
  name?: string;     // Optional name for the date range
}

// Standardized GA4 request options
export interface GA4RequestOptions {
  propertyId: string;
  dateRanges: DateRangeOptions[];
  metrics: string[];
  dimensions?: string[];
  limit?: number;
  offset?: number;
  orderBy?: Array<{
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
    desc?: boolean;
  }>;
  dimensionFilter?: any;
  metricFilter?: any;
}

// Transformed response data structure
export interface GA4DataRow {
  dimensions: { [dimensionName: string]: string };
  metrics: { [metricName: string]: number };
}

export interface GA4TransformedResponse {
  rows: GA4DataRow[];
  totals: { [metricName: string]: number };
  metadata: {
    dimensionHeaders: string[];
    metricHeaders: string[];
    rowCount: number;
    totalCount?: number;
    samplingInfo?: any;
  };
  dateRanges: DateRangeOptions[];
  requestInfo: {
    propertyId: string;
    executionTime: number;
    fromCache: boolean;
  };
}

// Real-time report specific interfaces
export interface GA4RealtimeOptions {
  propertyId: string;
  metrics: string[];
  dimensions?: string[];
  limit?: number;
  orderBy?: Array<{
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
    desc?: boolean;
  }>;
  dimensionFilter?: any;
  metricFilter?: any;
}

export interface GA4RealtimeResponse {
  rows: GA4DataRow[];
  totals: { [metricName: string]: number };
  metadata: {
    dimensionHeaders: string[];
    metricHeaders: string[];
    rowCount: number;
  };
  requestInfo: {
    propertyId: string;
    executionTime: number;
    timestamp: string;
  };
}

// Error types specific to GA4 operations
export enum GA4ErrorType {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PROPERTY_NOT_FOUND = 'PROPERTY_NOT_FOUND',
  INVALID_METRICS = 'INVALID_METRICS',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATA_PROCESSING_ERROR = 'DATA_PROCESSING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface GA4Error {
  type: GA4ErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
  retryAfter?: number; // seconds
}

export class GA4DataClient {
  private client?: BetaAnalyticsDataClient;
  private propertyId: string;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly defaultCacheTTL = 300000; // 5 minutes
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(propertyId: string) {
    this.propertyId = propertyId;
  }

  /**
   * Initialize the GA4 client with authentication
   */
  async initialize(): Promise<void> {
    try {
      const authManager = getAuthManager();
      
      if (!authManager.isAuthenticationValid()) {
        throw this.createGA4Error(
          GA4ErrorType.AUTHENTICATION_FAILED,
          'GA4 client requires valid authentication',
          null,
          false
        );
      }

      this.client = authManager.getGA4Client();
      
      if (!this.client) {
        throw this.createGA4Error(
          GA4ErrorType.AUTHENTICATION_FAILED,
          'Failed to get authenticated GA4 client',
          null,
          false
        );
      }

      logger.info('✅ GA4 Data Client initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize GA4 Data Client', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Run a standard GA4 report with built-in error handling and transformation
   */
  async runReport(options: GA4RequestOptions): Promise<GA4TransformedResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('report', options);
    
    try {
      // Check cache first
      const cachedResult = this.getCachedData(cacheKey);
      if (cachedResult) {
        logger.debug('📊 Returning cached GA4 report data');
        return cachedResult;
      }

      // Validate options
      this.validateReportOptions(options);

      // Ensure client is initialized
      if (!this.client) {
        await this.initialize();
      }

      // Track GA4 API call
      performanceMonitor.incrementCounter('ga4_api_calls_total', { 
        type: 'report',
        propertyId: options.propertyId 
      });

      // Build GA4 request
      const request = this.buildReportRequest(options);
      
      // Execute with retry logic
      const response = await this.executeWithRetry(
        () => this.client!.runReport(request)
      );

      // Transform response
      const transformedResponse = this.transformReportResponse(
        response[0], 
        options, 
        Date.now() - startTime,
        false
      );

      // Cache the result
      this.setCachedData(cacheKey, transformedResponse);

      // Track successful API call
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordResponseTime(responseTime, 'ga4');

      logger.debug(`📊 GA4 report completed in ${responseTime}ms`);
      return transformedResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordResponseTime(responseTime, 'ga4');
      performanceMonitor.incrementCounter('ga4_api_errors_total', { 
        type: 'report',
        propertyId: options.propertyId 
      });

      const ga4Error = this.handleGA4Error(error);
      logger.error(`❌ GA4 report failed: ${ga4Error.message}`, ga4Error.originalError);
      
      throw MCPErrorHandler.ga4ApiError(
        ga4Error.message,
        ga4Error.originalError
      );
    }
  }

  /**
   * Run a real-time GA4 report
   */
  async runRealtimeReport(options: GA4RealtimeOptions): Promise<GA4RealtimeResponse> {
    const startTime = Date.now();
    
    try {
      // Validate options
      this.validateRealtimeOptions(options);

      // Ensure client is initialized
      if (!this.client) {
        await this.initialize();
      }

      // Track GA4 API call
      performanceMonitor.incrementCounter('ga4_api_calls_total', { 
        type: 'realtime',
        propertyId: options.propertyId 
      });

      // Build GA4 realtime request
      const request = this.buildRealtimeRequest(options);
      
      // Execute with retry logic
      const response = await this.executeWithRetry(
        () => this.client!.runRealtimeReport(request)
      );

      // Transform response
      const transformedResponse = this.transformRealtimeResponse(
        response[0], 
        options, 
        Date.now() - startTime
      );

      // Track successful API call
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordResponseTime(responseTime, 'ga4');

      logger.debug(`📊 GA4 realtime report completed in ${responseTime}ms`);
      return transformedResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordResponseTime(responseTime, 'ga4');
      performanceMonitor.incrementCounter('ga4_api_errors_total', { 
        type: 'realtime',
        propertyId: options.propertyId 
      });

      const ga4Error = this.handleGA4Error(error);
      logger.error(`❌ GA4 realtime report failed: ${ga4Error.message}`, ga4Error.originalError);
      
      throw MCPErrorHandler.ga4ApiError(
        `Realtime: ${ga4Error.message}`,
        ga4Error.originalError
      );
    }
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const ga4Error = this.handleGA4Error(error);
        
        if (!ga4Error.retryable || attempt === this.maxRetries) {
          throw error;
        }
        
        const delay = ga4Error.retryAfter ? ga4Error.retryAfter * 1000 : this.retryDelay * attempt;
        logger.warn(`🔄 GA4 API call failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Build GA4 report request from options
   */
  private buildReportRequest(options: GA4RequestOptions): GA4RunReportRequest {
    const property = `properties/${options.propertyId}`;
    
    const dateRanges: GA4DateRange[] = options.dateRanges.map(range => ({
      startDate: range.startDate,
      endDate: range.endDate,
      name: range.name
    }));

    const metrics: GA4Metric[] = options.metrics.map(metricName => ({
      name: metricName
    }));

    const dimensions: GA4Dimension[] = (options.dimensions || []).map(dimensionName => ({
      name: dimensionName
    }));

    const request: GA4RunReportRequest = {
      property,
      dateRanges,
      metrics,
      dimensions,
      limit: options.limit || 1000,
      offset: options.offset || 0
    };

    if (options.orderBy && options.orderBy.length > 0) {
      request.orderBys = options.orderBy;
    }

    if (options.dimensionFilter) {
      request.dimensionFilter = options.dimensionFilter;
    }

    if (options.metricFilter) {
      request.metricFilter = options.metricFilter;
    }

    return request;
  }

  /**
   * Build GA4 realtime request from options
   */
  private buildRealtimeRequest(options: GA4RealtimeOptions): GA4RunRealtimeReportRequest {
    const property = `properties/${options.propertyId}`;
    
    const metrics: GA4Metric[] = options.metrics.map(metricName => ({
      name: metricName
    }));

    const dimensions: GA4Dimension[] = (options.dimensions || []).map(dimensionName => ({
      name: dimensionName
    }));

    const request: GA4RunRealtimeReportRequest = {
      property,
      metrics,
      dimensions,
      limit: options.limit || 100
    };

    if (options.orderBy && options.orderBy.length > 0) {
      request.orderBys = options.orderBy;
    }

    if (options.dimensionFilter) {
      request.dimensionFilter = options.dimensionFilter;
    }

    if (options.metricFilter) {
      request.metricFilter = options.metricFilter;
    }

    return request;
  }

  /**
   * Transform GA4 report response to standardized format
   */
  private transformReportResponse(
    response: any, 
    options: GA4RequestOptions,
    executionTime: number,
    fromCache: boolean
  ): GA4TransformedResponse {
    const rows: GA4DataRow[] = [];
    const totals: { [metricName: string]: number } = {};

    // Extract dimension and metric headers
    const dimensionHeaders = (response.dimensionHeaders || []).map((header: any) => header.name || '');
    const metricHeaders = (response.metricHeaders || []).map((header: any) => header.name || '');

    // Process data rows
    if (response.rows) {
      for (const row of response.rows) {
        const transformedRow: GA4DataRow = {
          dimensions: {},
          metrics: {}
        };

        // Map dimensions
        if (row.dimensionValues) {
          dimensionHeaders.forEach((header: string, index: number) => {
            transformedRow.dimensions[header] = row.dimensionValues![index]?.value || '';
          });
        }

        // Map metrics
        if (row.metricValues) {
          metricHeaders.forEach((header: string, index: number) => {
            const value = parseFloat(row.metricValues![index]?.value || '0');
            transformedRow.metrics[header] = value;
          });
        }

        rows.push(transformedRow);
      }
    }

    // Calculate totals
    if (response.totals && response.totals.length > 0) {
      const totalRow = response.totals[0];
      if (totalRow.metricValues) {
        metricHeaders.forEach((header: string, index: number) => {
          totals[header] = parseFloat(totalRow.metricValues![index]?.value || '0');
        });
      }
    }

    return {
      rows,
      totals,
      metadata: {
        dimensionHeaders,
        metricHeaders,
        rowCount: rows.length,
        totalCount: response.rowCount ? parseInt(response.rowCount.toString()) : undefined,
        samplingInfo: response.metadata?.samplingMetadatas?.[0]
      },
      dateRanges: options.dateRanges,
      requestInfo: {
        propertyId: options.propertyId,
        executionTime,
        fromCache
      }
    };
  }

  /**
   * Transform GA4 realtime response to standardized format
   */
  private transformRealtimeResponse(
    response: any, 
    options: GA4RealtimeOptions,
    executionTime: number
  ): GA4RealtimeResponse {
    const rows: GA4DataRow[] = [];
    const totals: { [metricName: string]: number } = {};

    // Extract dimension and metric headers
    const dimensionHeaders = (response.dimensionHeaders || []).map((header: any) => header.name || '');
    const metricHeaders = (response.metricHeaders || []).map((header: any) => header.name || '');

    // Process data rows
    if (response.rows) {
      for (const row of response.rows) {
        const transformedRow: GA4DataRow = {
          dimensions: {},
          metrics: {}
        };

        // Map dimensions
        if (row.dimensionValues) {
          dimensionHeaders.forEach((header: string, index: number) => {
            transformedRow.dimensions[header] = row.dimensionValues![index]?.value || '';
          });
        }

        // Map metrics
        if (row.metricValues) {
          metricHeaders.forEach((header: string, index: number) => {
            const value = parseFloat(row.metricValues![index]?.value || '0');
            transformedRow.metrics[header] = value;
          });
        }

        rows.push(transformedRow);
      }
    }

    // Calculate totals
    if (response.totals && response.totals.length > 0) {
      const totalRow = response.totals[0];
      if (totalRow.metricValues) {
        metricHeaders.forEach((header: string, index: number) => {
          totals[header] = parseFloat(totalRow.metricValues![index]?.value || '0');
        });
      }
    }

    return {
      rows,
      totals,
      metadata: {
        dimensionHeaders,
        metricHeaders,
        rowCount: rows.length
      },
      requestInfo: {
        propertyId: options.propertyId,
        executionTime,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validate report options
   */
  private validateReportOptions(options: GA4RequestOptions): void {
    if (!options.propertyId) {
      throw this.createGA4Error(
        GA4ErrorType.PROPERTY_NOT_FOUND,
        'Property ID is required',
        null,
        false
      );
    }

    if (!options.metrics || options.metrics.length === 0) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_METRICS,
        'At least one metric is required',
        null,
        false
      );
    }

    if (!options.dateRanges || options.dateRanges.length === 0) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_DATE_RANGE,
        'At least one date range is required',
        null,
        false
      );
    }

    // Validate date ranges
    for (const dateRange of options.dateRanges) {
      this.validateDateRange(dateRange);
    }
  }

  /**
   * Validate realtime options
   */
  private validateRealtimeOptions(options: GA4RealtimeOptions): void {
    if (!options.propertyId) {
      throw this.createGA4Error(
        GA4ErrorType.PROPERTY_NOT_FOUND,
        'Property ID is required',
        null,
        false
      );
    }

    if (!options.metrics || options.metrics.length === 0) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_METRICS,
        'At least one metric is required',
        null,
        false
      );
    }
  }

  /**
   * Validate date range format
   */
  private validateDateRange(dateRange: DateRangeOptions): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(dateRange.startDate)) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_DATE_RANGE,
        `Invalid start date format: ${dateRange.startDate}. Expected YYYY-MM-DD`,
        null,
        false
      );
    }

    if (!dateRegex.test(dateRange.endDate)) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_DATE_RANGE,
        `Invalid end date format: ${dateRange.endDate}. Expected YYYY-MM-DD`,
        null,
        false
      );
    }

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    if (startDate > endDate) {
      throw this.createGA4Error(
        GA4ErrorType.INVALID_DATE_RANGE,
        `Start date ${dateRange.startDate} cannot be after end date ${dateRange.endDate}`,
        null,
        false
      );
    }
  }

  /**
   * Handle GA4 API errors and categorize them
   */
  private handleGA4Error(error: any): GA4Error {
    // Check for specific GA4 error patterns
    if (error.code) {
      switch (error.code) {
        case 3: // INVALID_ARGUMENT
          if (error.message?.includes('property')) {
            return this.createGA4Error(
              GA4ErrorType.PROPERTY_NOT_FOUND,
              `Property not found or access denied: ${error.message}`,
              error,
              false
            );
          }
          if (error.message?.includes('metric')) {
            return this.createGA4Error(
              GA4ErrorType.INVALID_METRICS,
              `Invalid metrics: ${error.message}`,
              error,
              false
            );
          }
          if (error.message?.includes('dimension')) {
            return this.createGA4Error(
              GA4ErrorType.INVALID_DIMENSIONS,
              `Invalid dimensions: ${error.message}`,
              error,
              false
            );
          }
          break;

        case 7: // PERMISSION_DENIED
          return this.createGA4Error(
            GA4ErrorType.AUTHENTICATION_FAILED,
            `Authentication failed: ${error.message}`,
            error,
            false
          );

        case 8: // RESOURCE_EXHAUSTED
          return this.createGA4Error(
            GA4ErrorType.QUOTA_EXCEEDED,
            `Quota exceeded: ${error.message}`,
            error,
            true,
            3600 // Retry after 1 hour
          );

        case 14: // UNAVAILABLE
          return this.createGA4Error(
            GA4ErrorType.NETWORK_ERROR,
            `Service unavailable: ${error.message}`,
            error,
            true,
            30 // Retry after 30 seconds
          );
      }
    }

    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return this.createGA4Error(
        GA4ErrorType.NETWORK_ERROR,
        `Network error: ${error.message}`,
        error,
        true,
        10 // Retry after 10 seconds
      );
    }

    // Default to unknown error
    return this.createGA4Error(
      GA4ErrorType.UNKNOWN_ERROR,
      `Unknown GA4 error: ${error.message || 'Unknown error'}`,
      error,
      true,
      5 // Retry after 5 seconds
    );
  }

  /**
   * Create standardized GA4 error
   */
  private createGA4Error(
    type: GA4ErrorType, 
    message: string, 
    originalError: any, 
    retryable: boolean,
    retryAfter?: number
  ): GA4Error {
    return {
      type,
      message,
      originalError,
      retryable,
      retryAfter
    };
  }

  /**
   * Generate cache key for data caching
   */
  private generateCacheKey(type: string, options: any): string {
    const keyData = {
      type,
      propertyId: options.propertyId,
      ...options
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Mark as from cache
    if (cached.data && cached.data.requestInfo) {
      cached.data.requestInfo.fromCache = true;
    }

    return cached.data;
  }

  /**
   * Set data in cache
   */
  private setCachedData(key: string, data: any, ttl: number = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [cacheKey, cached] of this.cache.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.cache.delete(cacheKey);
        }
      }
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('📊 GA4 data cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Global GA4 data client instance
let globalGA4DataClient: GA4DataClient | undefined;

/**
 * Initialize global GA4 data client
 */
export function initializeGA4DataClient(propertyId: string): GA4DataClient {
  globalGA4DataClient = new GA4DataClient(propertyId);
  return globalGA4DataClient;
}

/**
 * Get global GA4 data client
 */
export function getGA4DataClient(): GA4DataClient {
  if (!globalGA4DataClient) {
    throw new Error('GA4 Data Client not initialized. Call initializeGA4DataClient first.');
  }
  return globalGA4DataClient;
}