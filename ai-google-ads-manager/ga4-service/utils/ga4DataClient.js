/**
 * GA4 Data Client with Advanced Performance Optimizations
 * Phases 5.3.1-5.3.6 + 5.4.3 + 5.4.4 + 5.5.1: Complete GA4 data fetching with caching strategies, advanced optimizations, and comprehensive error handling
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const logger = require('./logger');
const { ValidationUtils } = require('./validationUtils');
const { GA4Utils } = require('./ga4Utils');
const { DataTransformationUtils } = require('./dataTransformationUtils');
const { redisClient } = require('./redisClient');
const { performanceAnalytics } = require('./performanceAnalytics');
const { requestDeduplication } = require('./requestDeduplication');
const { cacheWarmingService } = require('./cacheWarming');

// Subtask 5.5.1: Import new comprehensive error handling system
const { 
  errorHandler, 
  GA4ServiceError, 
  GA4AuthError, 
  GA4QuotaError, 
  GA4NetworkError, 
  GA4ValidationError, 
  GA4TimeoutError, 
  GA4CacheError, 
  GA4ConfigError,
  GA4DataError,
  RetryManager 
} = require('./errorHandler');

class GA4DataClient {
  constructor() {
    this.analyticsDataClient = null;
    this.isInitialized = false;
    this.cacheEnabled = true; // Default to enabled, gracefully degrades if Redis unavailable
    this.cacheStats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0
    };
    
    // Performance optimization features
    this.optimizationsEnabled = {
      performanceAnalytics: true,
      requestDeduplication: true,
      cacheWarming: true,
      batchOperations: true
    };

    // Subtask 5.5.1: Initialize retry managers with different configurations
    this.standardRetryManager = new RetryManager({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    });

    this.quotaRetryManager = new RetryManager({
      maxRetries: 2,
      baseDelay: 5000,
      maxDelay: 120000 // 2 minutes for quota errors
    });

    this.networkRetryManager = new RetryManager({
      maxRetries: 5,
      baseDelay: 500,
      maxDelay: 10000
    });
  }

  async initialize() {
    // Subtask 5.5.1: Enhanced initialization with comprehensive error handling
    return await errorHandler.handleWithRetry(async () => {
      logger.info('Initializing GA4DataClient with advanced optimizations...');
      
      try {
        this.analyticsDataClient = new BetaAnalyticsDataClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
      } catch (error) {
        throw new GA4ConfigError('Failed to initialize GA4 Analytics Data Client', {
          credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          originalError: error.message
        });
      }
      
      this.isInitialized = true;
      
      // Initialize Redis connection (graceful failure if unavailable)
      await this.initializeCache();
      
      // Initialize performance optimizations
      await this.initializeOptimizations();
      
      logger.info('GA4DataClient initialized successfully', {
        cacheEnabled: this.cacheEnabled,
        optimizations: this.optimizationsEnabled,
        googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      
      return true;
    }, { operation: 'initialize', component: 'GA4DataClient' });
  }

  /**
   * Initialize Redis cache connection
   */
  async initializeCache() {
    try {
      const connected = await redisClient.connect();
      this.cacheEnabled = connected;
      
      if (this.cacheEnabled) {
        logger.info('Redis cache enabled for GA4DataClient');
      } else {
        logger.warn('Redis cache unavailable - operating in direct mode');
      }
    } catch (error) {
      // Subtask 5.5.1: Enhanced cache error handling
      const cacheError = new GA4CacheError('Redis cache initialization failed', {
        originalError: error.message,
        fallbackMode: 'direct'
      });
      
      logger.warn('Cache initialization failed, continuing in direct mode:', {
        error: cacheError.toJSON()
      });
      
      this.cacheEnabled = false;
      // Don't throw - cache failure should be graceful
    }
  }

  /**
   * Initialize performance optimizations
   */
  async initializeOptimizations() {
    try {
      // Initialize cache warming service with dependencies
      if (this.optimizationsEnabled.cacheWarming) {
        cacheWarmingService.initialize(this, performanceAnalytics);
        logger.info('Cache warming service initialized');
      }

      logger.info('Performance optimizations initialized', {
        optimizations: this.optimizationsEnabled
      });
    } catch (error) {
      logger.warn('Performance optimizations initialization warning:', error.message);
      // Don't fail initialization for optimization issues
    }
  }

  /**
   * Enhanced cache-first data retrieval with performance optimizations
   * @param {string} dataType - Type of data (sessions, users, traffic, etc.)
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Query options
   * @param {Function} fetchFunction - Function to fetch data from GA4 API
   * @returns {Object} Data with cache metadata and performance metrics
   */
  async getCachedData(dataType, propertyId, options, fetchFunction) {
    const startTime = Date.now();
    this.cacheStats.totalRequests++;

    // Generate request key for deduplication
    const requestKey = this.optimizationsEnabled.requestDeduplication
      ? requestDeduplication.generateGA4RequestKey(dataType, propertyId, options)
      : `${dataType}:${propertyId}:${JSON.stringify(options)}`;

    // Subtask 5.5.1: Enhanced error handling with appropriate retry strategy
    const context = {
      operation: 'getCachedData',
      dataType,
      propertyId,
      requestKey,
      options: { ...options, sensitive: false } // Remove sensitive data from context
    };

    try {
      // Determine appropriate retry manager based on operation type
      const retryManager = this.getRetryManagerForDataType(dataType);
      
      // Execute with comprehensive error handling and retry logic
      const result = await retryManager.executeWithRetry(async () => {
        // Execute with deduplication if enabled
        return this.optimizationsEnabled.requestDeduplication
          ? await requestDeduplication.executeRequest(requestKey, async () => {
              return await this.executeDataRetrieval(dataType, propertyId, options, fetchFunction, startTime);
            })
          : await this.executeDataRetrieval(dataType, propertyId, options, fetchFunction, startTime);
      }, context);

      // Record performance analytics
      if (this.optimizationsEnabled.performanceAnalytics) {
        this.recordPerformanceMetrics(dataType, propertyId, options, result, startTime);
      }

      return result;
    } catch (error) {
      // Subtask 5.5.1: Comprehensive error handling and statistics
      this.cacheStats.errors++;
      const responseTime = Date.now() - startTime;
      
      // Record performance analytics for errors
      if (this.optimizationsEnabled.performanceAnalytics) {
        performanceAnalytics.recordGA4Request({
          dataType,
          propertyId,
          source: 'error',
          responseTime,
          cacheHit: false,
          error: error.message,
          options
        });
      }
      
      // Log comprehensive error information
      logger.error(`Enhanced data retrieval failed for ${dataType}:`, {
        propertyId,
        dataType,
        error: error.toJSON ? error.toJSON() : {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        responseTime: `${responseTime}ms`,
        requestKey,
        context
      });

      // Return error response with comprehensive details
      return {
        success: false,
        error: error.message || 'Data retrieval failed',
        errorType: error.constructor.name,
        errorCode: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        source: 'error',
        cached: false,
        responseTime,
        retryable: error.retryable || false,
        cacheStats: this.getCacheStats(),
        context: {
          dataType,
          propertyId,
          operation: 'getCachedData'
        }
      };
    }
  }

  /**
   * Subtask 5.5.1: Get appropriate retry manager based on data type and expected load
   */
  getRetryManagerForDataType(dataType) {
    // Real-time data needs faster, more frequent retries
    if (dataType === 'realtime' || dataType === 'events') {
      return this.networkRetryManager;
    }
    
    // Standard analytics data uses standard retry logic
    return this.standardRetryManager;
  }

  /**
   * Execute data retrieval with caching logic
   */
  async executeDataRetrieval(dataType, propertyId, options, fetchFunction, startTime) {
    // Step 1: Try to get from cache first
    if (this.cacheEnabled) {
      try {
        const cachedData = await redisClient.getCachedGA4Data(dataType, propertyId, options);
        
        if (cachedData) {
          this.cacheStats.hits++;
          const responseTime = Date.now() - startTime;
          
          // Track cache hit from warming if applicable
          if (this.optimizationsEnabled.cacheWarming) {
            cacheWarmingService.trackCacheHitFromWarming(dataType, propertyId);
          }
          
          logger.info(`Cache HIT for ${dataType}`, {
            propertyId,
            dataType,
            responseTime: `${responseTime}ms`,
            cacheHitRate: `${((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(1)}%`
          });

          return {
            success: true,
            data: cachedData,
            source: 'cache',
            cached: true,
            responseTime,
            cacheStats: this.getCacheStats()
          };
        }
      } catch (cacheError) {
        // Subtask 5.5.1: Enhanced cache error handling - don't fail the request
        const customCacheError = new GA4CacheError('Cache retrieval failed', {
          originalError: cacheError.message,
          dataType,
          propertyId,
          fallback: 'direct_api'
        });
        
        logger.warn('Cache retrieval failed, falling back to direct API:', {
          error: customCacheError.toJSON(),
          dataType,
          propertyId
        });
        
        // Continue to API fetch - cache failure should not block the request
      }
    }

    // Step 2: Cache miss or cache failure - fetch from GA4 API
    this.cacheStats.misses++;
    
    logger.info(`Cache MISS for ${dataType} - fetching from GA4 API`, {
      propertyId,
      dataType,
      cacheEnabled: this.cacheEnabled
    });

    // Subtask 5.5.1: Enhanced API fetch with specific error context
    const apiData = await this.executeGA4APICall(fetchFunction, {
      dataType,
      propertyId,
      options,
      operation: 'api_fetch'
    });

    const responseTime = Date.now() - startTime;

    // Step 3: Cache the result for future requests
    if (this.cacheEnabled && apiData.success) {
      try {
        await redisClient.cacheGA4Data(dataType, propertyId, options, apiData.data);
      } catch (cacheError) {
        // Subtask 5.5.1: Enhanced cache storage error handling
        const customCacheError = new GA4CacheError('Cache storage failed', {
          originalError: cacheError.message,
          dataType,
          propertyId,
          impact: 'future_requests_slower'
        });
        
        logger.warn('Cache storage failed, data retrieved but not cached:', {
          error: customCacheError.toJSON(),
          dataType,
          propertyId
        });
        
        // Don't fail the request - just log the cache storage failure
      }
    }

    logger.info(`GA4 API fetch completed for ${dataType}`, {
      propertyId,
      dataType,
      responseTime: `${responseTime}ms`,
      cached: this.cacheEnabled && apiData.success,
      cacheHitRate: `${((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(1)}%`
    });

    return {
      ...apiData,
      source: 'api',
      cached: this.cacheEnabled && apiData.success,
      responseTime,
      cacheStats: this.getCacheStats()
    };
  }

  /**
   * Subtask 5.5.1: Execute GA4 API call with comprehensive error handling
   */
  async executeGA4APICall(fetchFunction, context) {
    try {
      const result = await fetchFunction();
      return result;
    } catch (error) {
      // Enhanced error classification and handling
      if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
        throw new GA4QuotaError('GA4 API quota exceeded', {
          ...context,
          originalError: error.message,
          retryAfter: this.extractRetryAfterFromError(error)
        });
      }
      
      if (error.message && error.message.includes('PERMISSION_DENIED')) {
        throw new GA4AuthError('GA4 API access denied', {
          ...context,
          originalError: error.message,
          propertyId: context.propertyId
        });
      }
      
      if (error.message && error.message.includes('DEADLINE_EXCEEDED')) {
        throw new GA4TimeoutError('GA4 API request timeout', {
          ...context,
          originalError: error.message
        });
      }
      
      if (error.message && (error.message.includes('UNAVAILABLE') || error.message.includes('network'))) {
        throw new GA4NetworkError('GA4 API network error', {
          ...context,
          originalError: error.message
        });
      }
      
      if (error.message && (error.message.includes('INVALID_ARGUMENT') || error.message.includes('NOT_FOUND'))) {
        throw new GA4ValidationError('GA4 API validation error', {
          ...context,
          originalError: error.message
        });
      }
      
      // Default to generic GA4 service error
      throw new GA4ServiceError('GA4 API error', 'GA4_API_ERROR', {
        ...context,
        originalError: error.message,
        retryable: true
      });
    }
  }

  /**
   * Subtask 5.5.1: Extract retry-after value from GA4 API error
   */
  extractRetryAfterFromError(error) {
    // Try to extract from error details or metadata
    if (error.details && error.details.retryDelay) {
      return error.details.retryDelay;
    }
    
    // Default for quota errors
    return 60;
  }

  /**
   * Record performance metrics for analytics
   */
  recordPerformanceMetrics(dataType, propertyId, options, result, startTime) {
    try {
      const responseTime = Date.now() - startTime;
      
      performanceAnalytics.recordRequest({
        dataType,
        propertyId,
        source: result.source || 'unknown',
        responseTime,
        cacheHit: result.source === 'cache',
        error: !result.success ? result.message : null,
        options
      });
    } catch (error) {
      logger.warn('Failed to record performance metrics:', error.message);
    }
  }

  /**
   * Batch operation for multiple data type requests
   * @param {string} propertyId - GA4 property ID
   * @param {Array} dataTypes - Array of data types to fetch
   * @param {Object} commonOptions - Common options for all requests
   * @returns {Promise<Object>} Batch results
   */
  async getBatchData(propertyId, dataTypes, commonOptions = {}) {
    if (!this.optimizationsEnabled.batchOperations) {
      // Fallback to individual requests
      return await this.getBatchDataSequential(propertyId, dataTypes, commonOptions);
    }

    const batchStartTime = Date.now();
    logger.info('Starting batch data retrieval', {
      propertyId,
      dataTypes,
      batchSize: dataTypes.length
    });

    try {
      // Generate batch request key for deduplication
      const batchRequestKey = requestDeduplication.generateBatchRequestKey(
        dataTypes.map(dataType => ({ dataType, propertyId, options: commonOptions }))
      );

      // Execute batch with deduplication
      const batchResult = await requestDeduplication.executeRequest(batchRequestKey, async () => {
        return await this.executeBatchRequests(propertyId, dataTypes, commonOptions);
      });

      const batchResponseTime = Date.now() - batchStartTime;
      
      logger.info('Batch data retrieval completed', {
        propertyId,
        dataTypes,
        batchSize: dataTypes.length,
        responseTime: `${batchResponseTime}ms`,
        successCount: Object.values(batchResult.results).filter(r => r.success).length
      });

      return {
        success: true,
        results: batchResult.results,
        batchMetrics: {
          totalRequests: dataTypes.length,
          responseTime: batchResponseTime,
          averageRequestTime: batchResponseTime / dataTypes.length
        }
      };

    } catch (error) {
      logger.error('Batch data retrieval failed:', {
        propertyId,
        dataTypes,
        error: error.message
      });

      return {
        success: false,
        error: 'Batch operation failed',
        message: error.message,
        results: {}
      };
    }
  }

  /**
   * Execute batch requests in parallel
   */
  async executeBatchRequests(propertyId, dataTypes, commonOptions) {
    const requests = dataTypes.map(async (dataType) => {
      try {
        let result;
        switch (dataType) {
          case 'sessions':
            result = await this.getSessionMetrics(propertyId, commonOptions);
            break;
          case 'users':
            result = await this.getUserMetrics(propertyId, commonOptions);
            break;
          case 'traffic':
            result = await this.getTrafficSourceBreakdown(propertyId, commonOptions);
            break;
          case 'pages':
            result = await this.getPagePerformance(propertyId, commonOptions);
            break;
          case 'conversions':
            result = await this.getConversionMetrics(propertyId, commonOptions);
            break;
          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }
        
        return { dataType, result };
      } catch (error) {
        return {
          dataType,
          result: {
            success: false,
            error: error.message,
            source: 'error'
          }
        };
      }
    });

    const results = await Promise.allSettled(requests);
    
    // Process results
    const batchResults = {};
    results.forEach((result, index) => {
      const dataType = dataTypes[index];
      if (result.status === 'fulfilled') {
        batchResults[dataType] = result.value.result;
      } else {
        batchResults[dataType] = {
          success: false,
          error: 'Request failed',
          message: result.reason?.message || 'Unknown error'
        };
      }
    });

    return { results: batchResults };
  }

  /**
   * Sequential batch processing (fallback)
   */
  async getBatchDataSequential(propertyId, dataTypes, commonOptions) {
    const results = {};
    
    for (const dataType of dataTypes) {
      try {
        switch (dataType) {
          case 'sessions':
            results[dataType] = await this.getSessionMetrics(propertyId, commonOptions);
            break;
          case 'users':
            results[dataType] = await this.getUserMetrics(propertyId, commonOptions);
            break;
          case 'traffic':
            results[dataType] = await this.getTrafficSourceBreakdown(propertyId, commonOptions);
            break;
          case 'pages':
            results[dataType] = await this.getPagePerformance(propertyId, commonOptions);
            break;
          case 'conversions':
            results[dataType] = await this.getConversionMetrics(propertyId, commonOptions);
            break;
          default:
            results[dataType] = {
              success: false,
              error: `Unsupported data type: ${dataType}`
            };
        }
      } catch (error) {
        results[dataType] = {
          success: false,
          error: error.message
        };
      }
    }

    return { success: true, results };
  }

  /**
   * Get current cache statistics
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      hitRate: this.cacheStats.totalRequests > 0 
        ? ((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(1) + '%'
        : '0%',
      enabled: this.cacheEnabled
    };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {
      cache: this.getCacheStats(),
      optimizations: this.optimizationsEnabled
    };

    if (this.optimizationsEnabled.performanceAnalytics) {
      metrics.analytics = performanceAnalytics.getCurrentMetrics();
    }

    if (this.optimizationsEnabled.requestDeduplication) {
      metrics.deduplication = requestDeduplication.getStats();
    }

    if (this.optimizationsEnabled.cacheWarming) {
      metrics.warming = cacheWarmingService.getWarmingStats();
    }

    return metrics;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    if (!this.optimizationsEnabled.performanceAnalytics) {
      return {
        error: 'Performance analytics not enabled'
      };
    }

    return performanceAnalytics.generateAnalysisReport();
  }

  /**
   * Clear cache for specific data type or property
   * @param {string} pattern - Pattern to clear (e.g., 'ga4:sessions:*' or 'ga4:*:123456789:*')
   */
  async clearCache(pattern = 'ga4:*') {
    try {
      if (!this.cacheEnabled) {
        logger.warn('Cache not enabled - clear operation skipped');
        return { cleared: 0, message: 'Cache not enabled' };
      }

      const cleared = await redisClient.clearCache(pattern);
      
      logger.info('Cache cleared', {
        pattern,
        keysCleared: cleared
      });

      return { cleared, pattern };
    } catch (error) {
      logger.error('Cache clear failed:', {
        pattern,
        error: error.message
      });
      return { cleared: 0, error: error.message };
    }
  }

  /**
   * Invalidate cache for specific data combinations
   * @param {string} propertyId - GA4 property ID  
   * @param {Array} dataTypes - Data types to invalidate (optional, defaults to all)
   */
  async invalidateCache(propertyId, dataTypes = ['sessions', 'users', 'traffic', 'pages', 'conversions']) {
    try {
      if (!this.cacheEnabled) {
        return { invalidated: 0, message: 'Cache not enabled' };
      }

      let totalInvalidated = 0;
      const cleanPropertyId = propertyId.replace('properties/', '');

      for (const dataType of dataTypes) {
        const pattern = `ga4:${dataType}:${cleanPropertyId}:*`;
        const cleared = await redisClient.clearCache(pattern);
        totalInvalidated += cleared;
      }

      logger.info('Cache invalidated for property', {
        propertyId,
        dataTypes,
        totalInvalidated
      });

      return { invalidated: totalInvalidated, propertyId, dataTypes };
    } catch (error) {
      logger.error('Cache invalidation failed:', {
        propertyId,
        error: error.message
      });
      return { invalidated: 0, error: error.message };
    }
  }

  /**
   * Toggle performance optimizations
   * @param {Object} optimizations - Optimizations to enable/disable
   */
  toggleOptimizations(optimizations) {
    this.optimizationsEnabled = { ...this.optimizationsEnabled, ...optimizations };
    
    logger.info('Performance optimizations updated', {
      optimizations: this.optimizationsEnabled
    });
  }

  // === GA4 Data Fetching Methods with Integrated Optimizations ===

  /**
   * Get session metrics with advanced optimizations
   */
  async getSessionMetrics(propertyId, options = {}) {
    return this.getCachedData('sessions', propertyId, options, async () => {
      // Validate parameters
      const validation = ValidationUtils.validateGA4Request(propertyId, options);
      if (!validation.isValid) {
        // Subtask 5.5.1: Use custom validation error instead of generic Error
        throw new GA4ValidationError(`Parameter validation failed: ${validation.errors.join(', ')}`, {
          propertyId,
          options,
          validationErrors: validation.errors
        });
      }

      const { normalized } = validation;
      const { dateRange, dimensions, limit } = normalized;

      // Create GA4 API request
      const request = GA4Utils.createGA4Request(propertyId, {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        dimensions: dimensions.map(dim => ({ name: dim })),
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'sessionsPerUser' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' },
          { name: 'screenPageViewsPerSession' }
        ],
        limit
      });

      const performanceStart = Date.now();

      // Subtask 5.5.1: Remove old try-catch and let new error handling system manage errors
      const [response] = await this.analyticsDataClient.runReport(request);
      const performanceMetrics = GA4Utils.createPerformanceMetrics(performanceStart);

      const transformedData = this.transformSessionMetrics(response, { propertyId, ...options });
      const summary = this.calculateSessionSummary(transformedData);

      // Apply data transformation utilities
      const normalizedData = DataTransformationUtils.normalizeGA4Data({
        data: transformedData,
        metadata: response.metadata,
        dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate }
      }, 'sessions');

      return {
        success: true,
        data: {
          ...normalizedData,
          summary,
          performanceMetrics,
          requestInfo: { propertyId, dateRange, dimensions, limit }
        }
      };
    });
  }

  /**
   * Get user metrics with advanced optimizations
   */
  async getUserMetrics(propertyId, options = {}) {
    return this.getCachedData('users', propertyId, options, async () => {
      const validation = ValidationUtils.validateGA4Request(propertyId, options);
      if (!validation.isValid) {
        // Subtask 5.5.1: Use custom validation error
        throw new GA4ValidationError(`Parameter validation failed: ${validation.errors.join(', ')}`, {
          propertyId,
          options,
          validationErrors: validation.errors
        });
      }

      const { normalized } = validation;
      const { dateRange, dimensions, limit } = normalized;

      const request = GA4Utils.createGA4Request(propertyId, {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        dimensions: dimensions.map(dim => ({ name: dim })),
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'activeUsers' },
          { name: 'userConversionRate' },
          { name: 'engagedSessions' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' }
        ],
        limit
      });

      const performanceStart = Date.now();

      // Subtask 5.5.1: Remove old try-catch and let new error handling system manage errors
      const [response] = await this.analyticsDataClient.runReport(request);
      const performanceMetrics = GA4Utils.createPerformanceMetrics(performanceStart);

      const transformedData = this.transformUserMetrics(response, { propertyId, ...options });
      const summary = this.calculateUserSummary(transformedData);

      // Apply data transformation utilities
      const normalizedData = DataTransformationUtils.normalizeGA4Data({
        data: transformedData,
        metadata: response.metadata,
        dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate }
      }, 'users');

      return {
        success: true,
        data: {
          ...normalizedData,
          summary,
          performanceMetrics,
          requestInfo: { propertyId, dateRange, dimensions, limit }
        }
      };
    });
  }

  /**
   * Get traffic source breakdown with advanced optimizations
   */
  async getTrafficSourceBreakdown(propertyId, options = {}) {
    return this.getCachedData('traffic', propertyId, options, async () => {
      const validation = ValidationUtils.validateGA4Request(propertyId, options);
      if (!validation.isValid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
      }

      const { normalized } = validation;
      const { dateRange, dimensions, limit } = normalized;

      // Add traffic-specific dimensions
      const trafficDimensions = ['source', 'medium', ...dimensions];

      const request = GA4Utils.createGA4Request(propertyId, {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        dimensions: trafficDimensions.map(dim => ({ name: dim })),
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' }
        ],
        limit
      });

      const performanceStart = Date.now();

      try {
        const [response] = await this.analyticsDataClient.runReport(request);
        const performanceMetrics = GA4Utils.createPerformanceMetrics(performanceStart);

        const transformedData = this.transformTrafficSourceMetrics(response, { propertyId, ...options });
        const summary = this.calculateTrafficSourceSummary(transformedData);
        const breakdown = this.calculateTrafficSourceBreakdown(transformedData);

        const normalizedData = DataTransformationUtils.normalizeGA4Data({
          data: transformedData,
          metadata: response.metadata,
          dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate }
        }, 'traffic');

        return {
          success: true,
          data: {
            ...normalizedData,
            summary,
            breakdown,
            performanceMetrics,
            requestInfo: { propertyId, dateRange, dimensions: trafficDimensions, limit }
          }
        };
      } catch (error) {
        throw GA4Utils.handleGA4Error(error, 'getTrafficSourceBreakdown', { propertyId, options });
      }
    });
  }

  /**
   * Get page performance metrics with advanced optimizations
   */
  async getPagePerformance(propertyId, options = {}) {
    return this.getCachedData('pages', propertyId, options, async () => {
      const validation = ValidationUtils.validateGA4Request(propertyId, options);
      if (!validation.isValid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
      }

      const { normalized } = validation;
      const { dateRange, dimensions, limit } = normalized;

      // Add page-specific dimensions
      const pageDimensions = ['pagePath', 'pageTitle', ...dimensions];

      const request = GA4Utils.createGA4Request(propertyId, {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        dimensions: pageDimensions.map(dim => ({ name: dim })),
        metrics: [
          { name: 'screenPageViews' },
          { name: 'uniqueScreenPageViews' },
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'userEngagementDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' }
        ],
        limit
      });

      const performanceStart = Date.now();

      try {
        const [response] = await this.analyticsDataClient.runReport(request);
        const performanceMetrics = GA4Utils.createPerformanceMetrics(performanceStart);

        const transformedData = this.transformPagePerformanceMetrics(response, { propertyId, ...options });
        const summary = this.calculatePagePerformanceSummary(transformedData);
        const breakdown = this.calculatePagePerformanceBreakdown(transformedData);

        const normalizedData = DataTransformationUtils.normalizeGA4Data({
          data: transformedData,
          metadata: response.metadata,
          dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate }
        }, 'pages');

        return {
          success: true,
          data: {
            ...normalizedData,
            summary,
            breakdown,
            performanceMetrics,
            requestInfo: { propertyId, dateRange, dimensions: pageDimensions, limit }
          }
        };
      } catch (error) {
        throw GA4Utils.handleGA4Error(error, 'getPagePerformance', { propertyId, options });
      }
    });
  }

  /**
   * Get conversion metrics with advanced optimizations
   */
  async getConversionMetrics(propertyId, options = {}) {
    return this.getCachedData('conversions', propertyId, options, async () => {
      const validation = ValidationUtils.validateGA4Request(propertyId, options);
      if (!validation.isValid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
      }

      const { normalized } = validation;
      const { dateRange, dimensions, limit } = normalized;

      const request = GA4Utils.createGA4Request(propertyId, {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        dimensions: dimensions.map(dim => ({ name: dim })),
        metrics: [
          { name: 'conversions' },
          { name: 'totalRevenue' },
          { name: 'purchaseRevenue' },
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'sessionsWithEvent' },
          { name: 'userConversionRate' },
          { name: 'sessionConversionRate' }
        ],
        limit
      });

      const performanceStart = Date.now();

      try {
        const [response] = await this.analyticsDataClient.runReport(request);
        const performanceMetrics = GA4Utils.createPerformanceMetrics(performanceStart);

        const transformedData = this.transformConversionMetrics(response, { propertyId, ...options });
        const summary = this.calculateConversionSummary(transformedData);
        const breakdown = this.calculateConversionBreakdown(transformedData);

        const normalizedData = DataTransformationUtils.normalizeGA4Data({
          data: transformedData,
          metadata: response.metadata,
          dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate }
        }, 'conversions');

        return {
          success: true,
          data: {
            ...normalizedData,
            summary,
            breakdown,
            performanceMetrics,
            requestInfo: { propertyId, dateRange, dimensions, limit }
          }
        };
      } catch (error) {
        throw GA4Utils.handleGA4Error(error, 'getConversionMetrics', { propertyId, options });
      }
    });
  }

  // === Data Transformation Methods (Existing implementation) ===

  transformSessionMetrics(response, options) {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      // Extract dimensions
      row.dimensionValues?.forEach((value, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = value.value;
        }
      });

      // Extract metrics
      row.metricValues?.forEach((value, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          metrics[metricName] = parseFloat(value.value) || 0;
        }
      });

      return {
        dimensions,
        metrics,
        sessionData: {
          sessions: metrics.sessions || 0,
          users: metrics.totalUsers || 0,
          newUsers: metrics.newUsers || 0,
          sessionsPerUser: metrics.sessionsPerUser || 0,
          avgSessionDuration: metrics.averageSessionDuration || 0,
          bounceRate: metrics.bounceRate || 0,
          pageViews: metrics.screenPageViews || 0,
          pageViewsPerSession: metrics.screenPageViewsPerSession || 0
        }
      };
    });
  }

  calculateSessionSummary(data) {
    if (!data || data.length === 0) {
      return {
        totalSessions: 0,
        totalUsers: 0,
        totalNewUsers: 0,
        avgSessionDuration: 0,
        avgBounceRate: 0,
        totalPageViews: 0
      };
    }

    const totals = data.reduce((acc, item) => {
      const session = item.sessionData;
      return {
        sessions: acc.sessions + session.sessions,
        users: acc.users + session.users,
        newUsers: acc.newUsers + session.newUsers,
        sessionDuration: acc.sessionDuration + (session.avgSessionDuration * session.sessions),
        bounceRate: acc.bounceRate + (session.bounceRate * session.sessions),
        pageViews: acc.pageViews + session.pageViews
      };
    }, { sessions: 0, users: 0, newUsers: 0, sessionDuration: 0, bounceRate: 0, pageViews: 0 });

    return {
      totalSessions: totals.sessions,
      totalUsers: totals.users,
      totalNewUsers: totals.newUsers,
      avgSessionDuration: totals.sessions > 0 ? totals.sessionDuration / totals.sessions : 0,
      avgBounceRate: totals.sessions > 0 ? totals.bounceRate / totals.sessions : 0,
      totalPageViews: totals.pageViews,
      returningUsers: totals.users - totals.newUsers
    };
  }

  transformUserMetrics(response, options) {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      row.dimensionValues?.forEach((value, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = value.value;
        }
      });

      row.metricValues?.forEach((value, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          metrics[metricName] = parseFloat(value.value) || 0;
        }
      });

      return {
        dimensions,
        metrics,
        userData: {
          totalUsers: metrics.totalUsers || 0,
          newUsers: metrics.newUsers || 0,
          activeUsers: metrics.activeUsers || 0,
          returningUsers: (metrics.totalUsers || 0) - (metrics.newUsers || 0),
          avgEngagementTime: metrics.userEngagementDuration || 0,
          engagedSessions: metrics.engagedSessions || 0,
          engagementRate: metrics.engagementRate || 0,
          avgEngagementTimePerUser: metrics.averageEngagementTime || 0
        }
      };
    });
  }

  calculateUserSummary(data) {
    if (!data || data.length === 0) {
      return {
        totalUsers: 0,
        totalNewUsers: 0,
        totalReturningUsers: 0,
        totalActiveUsers: 0,
        avgEngagementTime: 0,
        totalEngagedSessions: 0,
        avgEngagementRate: 0
      };
    }

    const totals = data.reduce((acc, item) => {
      const user = item.userData;
      return {
        users: acc.users + user.totalUsers,
        newUsers: acc.newUsers + user.newUsers,
        returningUsers: acc.returningUsers + user.returningUsers,
        activeUsers: acc.activeUsers + user.activeUsers,
        engagementTime: acc.engagementTime + (user.avgEngagementTime * user.totalUsers),
        engagedSessions: acc.engagedSessions + user.engagedSessions,
        engagementRate: acc.engagementRate + (user.engagementRate * user.totalUsers)
      };
    }, { users: 0, newUsers: 0, returningUsers: 0, activeUsers: 0, engagementTime: 0, engagedSessions: 0, engagementRate: 0 });

    return {
      totalUsers: totals.users,
      totalNewUsers: totals.newUsers,
      totalReturningUsers: totals.returningUsers,
      totalActiveUsers: totals.activeUsers,
      avgEngagementTime: totals.users > 0 ? totals.engagementTime / totals.users : 0,
      totalEngagedSessions: totals.engagedSessions,
      avgEngagementRate: totals.users > 0 ? totals.engagementRate / totals.users : 0
    };
  }

  transformTrafficSourceMetrics(response, options) {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      row.dimensionValues?.forEach((value, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = value.value;
        }
      });

      row.metricValues?.forEach((value, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          metrics[metricName] = parseFloat(value.value) || 0;
        }
      });

      return {
        dimensions,
        metrics,
        trafficData: {
          source: dimensions.source || '(direct)',
          medium: dimensions.medium || '(none)',
          sessions: metrics.sessions || 0,
          users: metrics.totalUsers || 0,
          newUsers: metrics.newUsers || 0,
          pageViews: metrics.screenPageViews || 0,
          bounceRate: metrics.bounceRate || 0,
          avgSessionDuration: metrics.averageSessionDuration || 0,
          conversions: metrics.conversions || 0
        }
      };
    });
  }

  calculateTrafficSourceSummary(data) {
    if (!data || data.length === 0) {
      return {
        totalSessions: 0,
        totalUsers: 0,
        totalConversions: 0,
        avgBounceRate: 0,
        topSources: []
      };
    }

    const totals = data.reduce((acc, item) => {
      const traffic = item.trafficData;
      return {
        sessions: acc.sessions + traffic.sessions,
        users: acc.users + traffic.users,
        conversions: acc.conversions + traffic.conversions,
        bounceRate: acc.bounceRate + (traffic.bounceRate * traffic.sessions)
      };
    }, { sessions: 0, users: 0, conversions: 0, bounceRate: 0 });

    const topSources = data
      .sort((a, b) => b.trafficData.sessions - a.trafficData.sessions)
      .slice(0, 5)
      .map(item => ({
        source: item.trafficData.source,
        medium: item.trafficData.medium,
        sessions: item.trafficData.sessions,
        users: item.trafficData.users
      }));

    return {
      totalSessions: totals.sessions,
      totalUsers: totals.users,
      totalConversions: totals.conversions,
      avgBounceRate: totals.sessions > 0 ? totals.bounceRate / totals.sessions : 0,
      topSources
    };
  }

  calculateTrafficSourceBreakdown(data) {
    if (!data || data.length === 0) {
      return { bySource: {}, byMedium: {} };
    }

    const bySource = {};
    const byMedium = {};

    data.forEach(item => {
      const traffic = item.trafficData;
      
      // Group by source
      if (!bySource[traffic.source]) {
        bySource[traffic.source] = { sessions: 0, users: 0, conversions: 0 };
      }
      bySource[traffic.source].sessions += traffic.sessions;
      bySource[traffic.source].users += traffic.users;
      bySource[traffic.source].conversions += traffic.conversions;

      // Group by medium
      if (!byMedium[traffic.medium]) {
        byMedium[traffic.medium] = { sessions: 0, users: 0, conversions: 0 };
      }
      byMedium[traffic.medium].sessions += traffic.sessions;
      byMedium[traffic.medium].users += traffic.users;
      byMedium[traffic.medium].conversions += traffic.conversions;
    });

    return { bySource, byMedium };
  }

  transformPagePerformanceMetrics(response, options) {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      row.dimensionValues?.forEach((value, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = value.value;
        }
      });

      row.metricValues?.forEach((value, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          metrics[metricName] = parseFloat(value.value) || 0;
        }
      });

      return {
        dimensions,
        metrics,
        pageData: {
          pagePath: dimensions.pagePath || '/',
          pageTitle: dimensions.pageTitle || 'Unknown',
          pageViews: metrics.screenPageViews || 0,
          uniquePageViews: metrics.uniqueScreenPageViews || 0,
          users: metrics.totalUsers || 0,
          sessions: metrics.sessions || 0,
          avgTimeOnPage: metrics.userEngagementDuration || 0,
          bounceRate: metrics.bounceRate || 0,
          engagementRate: metrics.engagementRate || 0
        }
      };
    });
  }

  calculatePagePerformanceSummary(data) {
    if (!data || data.length === 0) {
      return {
        totalPageViews: 0,
        totalUniquePageViews: 0,
        avgTimeOnPage: 0,
        avgBounceRate: 0,
        topPages: []
      };
    }

    const totals = data.reduce((acc, item) => {
      const page = item.pageData;
      return {
        pageViews: acc.pageViews + page.pageViews,
        uniquePageViews: acc.uniquePageViews + page.uniquePageViews,
        timeOnPage: acc.timeOnPage + (page.avgTimeOnPage * page.pageViews),
        bounceRate: acc.bounceRate + (page.bounceRate * page.pageViews)
      };
    }, { pageViews: 0, uniquePageViews: 0, timeOnPage: 0, bounceRate: 0 });

    const topPages = data
      .sort((a, b) => b.pageData.pageViews - a.pageData.pageViews)
      .slice(0, 10)
      .map(item => ({
        pagePath: item.pageData.pagePath,
        pageTitle: item.pageData.pageTitle,
        pageViews: item.pageData.pageViews,
        uniquePageViews: item.pageData.uniquePageViews
      }));

    return {
      totalPageViews: totals.pageViews,
      totalUniquePageViews: totals.uniquePageViews,
      avgTimeOnPage: totals.pageViews > 0 ? totals.timeOnPage / totals.pageViews : 0,
      avgBounceRate: totals.pageViews > 0 ? totals.bounceRate / totals.pageViews : 0,
      topPages
    };
  }

  calculatePagePerformanceBreakdown(data) {
    if (!data || data.length === 0) {
      return { byPath: {}, byTitle: {} };
    }

    const byPath = {};
    const byTitle = {};

    data.forEach(item => {
      const page = item.pageData;
      
      if (!byPath[page.pagePath]) {
        byPath[page.pagePath] = { pageViews: 0, uniquePageViews: 0, users: 0 };
      }
      byPath[page.pagePath].pageViews += page.pageViews;
      byPath[page.pagePath].uniquePageViews += page.uniquePageViews;
      byPath[page.pagePath].users += page.users;

      if (!byTitle[page.pageTitle]) {
        byTitle[page.pageTitle] = { pageViews: 0, uniquePageViews: 0, users: 0 };
      }
      byTitle[page.pageTitle].pageViews += page.pageViews;
      byTitle[page.pageTitle].uniquePageViews += page.uniquePageViews;
      byTitle[page.pageTitle].users += page.users;
    });

    return { byPath, byTitle };
  }

  transformConversionMetrics(response, options) {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    return response.rows.map(row => {
      const dimensions = {};
      const metrics = {};

      row.dimensionValues?.forEach((value, index) => {
        const dimensionName = response.dimensionHeaders[index]?.name;
        if (dimensionName) {
          dimensions[dimensionName] = value.value;
        }
      });

      row.metricValues?.forEach((value, index) => {
        const metricName = response.metricHeaders[index]?.name;
        if (metricName) {
          metrics[metricName] = parseFloat(value.value) || 0;
        }
      });

      return {
        dimensions,
        metrics,
        conversionData: {
          conversions: metrics.conversions || 0,
          totalRevenue: metrics.totalRevenue || 0,
          purchaseRevenue: metrics.purchaseRevenue || 0,
          sessions: metrics.sessions || 0,
          users: metrics.totalUsers || 0,
          sessionsWithEvent: metrics.sessionsWithEvent || 0,
          userConversionRate: metrics.userConversionRate || 0,
          sessionConversionRate: metrics.sessionConversionRate || 0
        }
      };
    });
  }

  calculateConversionSummary(data) {
    if (!data || data.length === 0) {
      return {
        totalConversions: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        conversionRate: 0
      };
    }

    const totals = data.reduce((acc, item) => {
      const conv = item.conversionData;
      return {
        conversions: acc.conversions + conv.conversions,
        revenue: acc.revenue + conv.totalRevenue,
        sessions: acc.sessions + conv.sessions
      };
    }, { conversions: 0, revenue: 0, sessions: 0 });

    return {
      totalConversions: totals.conversions,
      totalRevenue: totals.revenue,
      avgOrderValue: totals.conversions > 0 ? totals.revenue / totals.conversions : 0,
      conversionRate: totals.sessions > 0 ? (totals.conversions / totals.sessions) * 100 : 0
    };
  }

  calculateConversionBreakdown(data) {
    if (!data || data.length === 0) {
      return { byDimension: {} };
    }

    const byDimension = {};

    data.forEach(item => {
      // Group by first available dimension
      const dimensionKeys = Object.keys(item.dimensions);
      if (dimensionKeys.length > 0) {
        const key = item.dimensions[dimensionKeys[0]];
        if (!byDimension[key]) {
          byDimension[key] = { conversions: 0, revenue: 0 };
        }
        byDimension[key].conversions += item.conversionData.conversions;
        byDimension[key].revenue += item.conversionData.totalRevenue;
      }
    });

    return { byDimension };
  }

  /**
   * Validate parameters for all GA4 requests
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Request options
   * @returns {Object} Validation result
   */
  validateParameters(propertyId, options) {
    return ValidationUtils.validateGA4Request(propertyId, options);
  }

  /**
   * Health check for GA4 client
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Test basic client initialization
      if (!this.analyticsDataClient) {
        throw new Error('GA4 client not initialized');
      }

      return {
        status: 'healthy',
        clientInitialized: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Phase 5.4.4: Intelligent Cache Invalidation Rules
   * Automatically invalidate related cache entries when data dependencies change
   * @param {string} dataType - Type of data that was updated
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Update context
   */
  async smartInvalidateCache(dataType, propertyId, options = {}) {
    try {
      if (!this.cacheEnabled) {
        return { invalidated: 0, message: 'Cache not enabled' };
      }

      const cleanPropertyId = propertyId.replace('properties/', '');
      let totalInvalidated = 0;
      const invalidatedTypes = [];

      // Define data dependency relationships for smart invalidation
      const dependencyRules = {
        sessions: ['users', 'traffic', 'pages'], // Session changes affect user metrics, traffic, and page views
        users: ['sessions', 'conversions'], // User changes affect sessions and conversions
        traffic: ['sessions', 'conversions'], // Traffic changes affect sessions and conversions
        pages: ['sessions', 'users'], // Page changes affect sessions and user metrics
        conversions: [] // Conversions are usually leaf nodes
      };

      // Invalidate the primary data type
      const primaryPattern = `ga4:${dataType}:${cleanPropertyId}:*`;
      const primaryCleared = await redisClient.clearCache(primaryPattern);
      totalInvalidated += primaryCleared;
      invalidatedTypes.push(dataType);

      // Invalidate dependent data types based on rules
      const dependentTypes = dependencyRules[dataType] || [];
      for (const depType of dependentTypes) {
        const depPattern = `ga4:${depType}:${cleanPropertyId}:*`;
        const depCleared = await redisClient.clearCache(depPattern);
        totalInvalidated += depCleared;
        if (depCleared > 0) {
          invalidatedTypes.push(depType);
        }
      }

      // Invalidate summary and aggregate caches
      const summaryPattern = `ga4:summary:${cleanPropertyId}:*`;
      const summaryCleared = await redisClient.clearCache(summaryPattern);
      totalInvalidated += summaryCleared;

      logger.info('Smart cache invalidation completed', {
        primaryType: dataType,
        propertyId,
        totalInvalidated,
        invalidatedTypes,
        options
      });

      return {
        invalidated: totalInvalidated,
        primaryType: dataType,
        invalidatedTypes,
        propertyId: cleanPropertyId,
        smartInvalidation: true
      };

    } catch (error) {
      logger.error('Smart cache invalidation failed:', {
        dataType,
        propertyId,
        error: error.message
      });
      return { invalidated: 0, error: error.message };
    }
  }

  /**
   * Phase 5.4.4: Adaptive Performance Optimization
   * Automatically adjust cache settings based on usage patterns
   */
  async optimizePerformance() {
    try {
      if (!this.optimizationsEnabled.performanceAnalytics) {
        return { optimized: false, message: 'Performance analytics not enabled' };
      }

      const analytics = performanceAnalytics.getCurrentMetrics();
      const recommendations = [];
      const optimizations = [];

      // Analyze cache hit rates and suggest optimizations
      if (this.cacheStats.totalRequests > 100) {
        const hitRate = (this.cacheStats.hits / this.cacheStats.totalRequests) * 100;
        
        if (hitRate < 40) {
          recommendations.push({
            type: 'cache_warming',
            priority: 'high',
            description: 'Low cache hit rate detected. Enable aggressive cache warming.',
            action: 'Enable cache warming for frequently requested data types'
          });
          
          // Auto-enable cache warming if hit rate is very low
          if (hitRate < 20 && this.optimizationsEnabled.cacheWarming) {
            cacheWarmingService.enableAggressiveWarming();
            optimizations.push('Enabled aggressive cache warming');
          }
        }

        if (hitRate > 80) {
          recommendations.push({
            type: 'ttl_optimization',
            priority: 'medium',
            description: 'High cache hit rate. Consider increasing TTL for better efficiency.',
            action: 'Increase cache TTL by 50% for high-hit-rate data types'
          });
        }
      }

      // Analyze response times and suggest optimizations
      const avgResponseTime = analytics.responseTimeAnalysis?.average || 0;
      if (avgResponseTime > 2000) { // > 2 seconds
        recommendations.push({
          type: 'batch_optimization',
          priority: 'high',
          description: 'High response times detected. Enable batch operations.',
          action: 'Use batch requests for multiple data types'
        });

        // Auto-enable batch operations for slow responses
        if (!this.optimizationsEnabled.batchOperations) {
          this.optimizationsEnabled.batchOperations = true;
          optimizations.push('Enabled batch operations');
        }
      }

      // Analyze memory usage and suggest cache size optimization
      if (analytics.cacheEffectiveness?.memoryUsage > 100000000) { // > 100MB
        recommendations.push({
          type: 'cache_size',
          priority: 'medium',
          description: 'High cache memory usage. Consider implementing cache size limits.',
          action: 'Implement LRU eviction policy'
        });
      }

      // Analyze request patterns for deduplication optimization
      if (analytics.requestMetrics?.duplicateRequests > 10) {
        recommendations.push({
          type: 'deduplication',
          priority: 'medium',
          description: 'Duplicate concurrent requests detected.',
          action: 'Enable request deduplication'
        });

        // Auto-enable deduplication
        if (!this.optimizationsEnabled.requestDeduplication) {
          this.optimizationsEnabled.requestDeduplication = true;
          optimizations.push('Enabled request deduplication');
        }
      }

      const result = {
        optimized: optimizations.length > 0,
        appliedOptimizations: optimizations,
        recommendations,
        performanceScore: this.calculatePerformanceScore(analytics),
        analysisTimestamp: new Date().toISOString()
      };

      logger.info('Performance optimization analysis completed', {
        optimizationsApplied: optimizations.length,
        recommendationsGenerated: recommendations.length,
        performanceScore: result.performanceScore
      });

      return result;

    } catch (error) {
      logger.error('Performance optimization failed:', error.message);
      return {
        optimized: false,
        error: error.message,
        analysisTimestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate overall performance score based on metrics
   * @param {Object} analytics - Current analytics data
   * @returns {number} Performance score (0-100)
   */
  calculatePerformanceScore(analytics) {
    let score = 100;
    
    // Cache hit rate scoring (40% of total score)
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 
      : 0;
    const hitRateScore = Math.min(hitRate / 80 * 40, 40); // 80% hit rate = full 40 points
    score = Math.max(0, score - (40 - hitRateScore));

    // Response time scoring (30% of total score)
    const avgResponseTime = analytics.responseTimeAnalysis?.average || 0;
    const responseTimeScore = avgResponseTime > 0 
      ? Math.max(0, 30 - (avgResponseTime / 1000 * 10)) // Penalty for response time > 1s
      : 30;
    score = Math.max(0, score - (30 - responseTimeScore));

    // Error rate scoring (20% of total score)
    const errorRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.errors / this.cacheStats.totalRequests) * 100 
      : 0;
    const errorScore = Math.max(0, 20 - (errorRate * 4)); // 5% error rate = 0 points
    score = Math.max(0, score - (20 - errorScore));

    // Optimization utilization scoring (10% of total score)
    const optimizationsActive = Object.values(this.optimizationsEnabled).filter(Boolean).length;
    const optimizationScore = (optimizationsActive / 4) * 10; // 4 optimizations = full 10 points
    score = Math.max(0, score - (10 - optimizationScore));

    return Math.round(score);
  }

  /**
   * Phase 5.4.4: Real-time Performance Monitoring with Alerts
   * Monitor performance metrics and trigger alerts for anomalies
   */
  async monitorPerformanceAlerts() {
    try {
      const alerts = [];
      const thresholds = {
        responseTime: 5000, // 5 seconds
        errorRate: 5, // 5%
        hitRate: 30, // 30% minimum
        memoryUsage: 500000000 // 500MB
      };

      // Check response time
      const analytics = performanceAnalytics.getCurrentMetrics();
      const avgResponseTime = analytics.responseTimeAnalysis?.average || 0;
      if (avgResponseTime > thresholds.responseTime) {
        alerts.push({
          type: 'response_time',
          severity: 'high',
          message: `Average response time (${avgResponseTime}ms) exceeds threshold (${thresholds.responseTime}ms)`,
          recommendation: 'Enable batch operations and cache warming',
          timestamp: new Date().toISOString()
        });
      }

      // Check error rate
      const errorRate = this.cacheStats.totalRequests > 0 
        ? (this.cacheStats.errors / this.cacheStats.totalRequests) * 100 
        : 0;
      if (errorRate > thresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          severity: 'medium',
          message: `Error rate (${errorRate.toFixed(1)}%) exceeds threshold (${thresholds.errorRate}%)`,
          recommendation: 'Investigate error patterns and improve error handling',
          timestamp: new Date().toISOString()
        });
      }

      // Check cache hit rate
      const hitRate = this.cacheStats.totalRequests > 0 
        ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 
        : 0;
      if (hitRate < thresholds.hitRate && this.cacheStats.totalRequests > 50) {
        alerts.push({
          type: 'cache_hit_rate',
          severity: 'medium',
          message: `Cache hit rate (${hitRate.toFixed(1)}%) below threshold (${thresholds.hitRate}%)`,
          recommendation: 'Enable cache warming and review cache TTL settings',
          timestamp: new Date().toISOString()
        });
      }

      // Log alerts if any are found
      if (alerts.length > 0) {
        logger.warn('Performance alerts triggered', {
          alertCount: alerts.length,
          alerts: alerts.map(a => ({ type: a.type, severity: a.severity }))
        });
      }

      return {
        alertsTriggered: alerts.length,
        alerts,
        thresholds,
        monitoringTimestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Performance monitoring failed:', error.message);
      return {
        alertsTriggered: 0,
        error: error.message,
        monitoringTimestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const ga4DataClient = new GA4DataClient();

module.exports = { GA4DataClient, ga4DataClient };