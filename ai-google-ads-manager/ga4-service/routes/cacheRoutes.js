/**
 * Cache Management Routes for GA4 API Service
 * Phase 5.4.3 + 5.4.4: Administrative cache operations, monitoring, and advanced performance analytics
 */

const express = require('express');
const { ga4DataClient } = require('../utils/ga4DataClient');
const { redisClient } = require('../utils/redisClient');
const { performanceAnalytics } = require('../utils/performanceAnalytics');
const { requestDeduplication } = require('../utils/requestDeduplication');
const { cacheWarmingService } = require('../utils/cacheWarming');
const { authMiddleware, requireSupabaseAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /cache/status
 * Get cache status and statistics
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    logger.info('Cache status request received', {
      authenticatedUser: req.auth?.user?.email || req.auth?.user || 'developer@localhost'
    });

    // Get GA4DataClient cache statistics
    const ga4CacheStats = ga4DataClient.getCacheStats();
    
    // Get Redis connection status and statistics
    const redisStats = await redisClient.getStats();
    
    // Get Redis ping status
    const redisPing = await redisClient.ping();

    const cacheStatus = {
      enabled: ga4CacheStats.enabled,
      connected: redisStats.connected,
      healthy: redisPing,
      ga4CacheStats: ga4CacheStats,
      redisStats: redisStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    logger.info('Cache status retrieved successfully', {
      enabled: cacheStatus.enabled,
      connected: cacheStatus.connected,
      hitRate: ga4CacheStats.hitRate,
      totalRequests: ga4CacheStats.totalRequests
    });

    res.json({
      success: true,
      data: cacheStatus
    });

  } catch (error) {
    logger.error('Failed to get cache status:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/performance
 * Get comprehensive performance metrics including analytics, deduplication, and warming
 */
router.get('/performance', authMiddleware, async (req, res) => {
  try {
    logger.info('Performance metrics request received');

    const performanceMetrics = ga4DataClient.getPerformanceMetrics();
    
    // Add additional system metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };

    const response = {
      success: true,
      data: {
        ...performanceMetrics,
        system: systemMetrics
      }
    };

    logger.info('Performance metrics retrieved', {
      cacheHitRate: performanceMetrics.cache?.hitRate,
      optimizationsEnabled: Object.keys(performanceMetrics.optimizations || {}).length,
      deduplicationRate: performanceMetrics.deduplication?.deduplicationRate
    });

    res.json(response);

  } catch (error) {
    logger.error('Failed to get performance metrics:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/analytics/report
 * Get detailed performance analysis report
 */
router.get('/analytics/report', authMiddleware, async (req, res) => {
  try {
    logger.info('Performance analysis report requested');

    const report = ga4DataClient.generatePerformanceReport();
    
    if (report.error) {
      return res.status(503).json({
        success: false,
        error: report.error,
        message: 'Performance analytics not available'
      });
    }

    logger.info('Performance analysis report generated', {
      performanceScore: report.performanceScore,
      totalRequests: report.summary?.totalRequests,
      recommendations: report.optimizationRecommendations?.length
    });

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Failed to generate performance report:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/deduplication
 * Get request deduplication statistics and queue status
 */
router.get('/deduplication', authMiddleware, async (req, res) => {
  try {
    logger.info('Deduplication metrics request received');

    const stats = requestDeduplication.getStats();
    const queueDetails = requestDeduplication.getQueueDetails();
    const healthStatus = requestDeduplication.getHealthStatus();

    const deduplicationInfo = {
      statistics: stats,
      queueDetails,
      healthStatus,
      configuration: {
        maxWaitTime: requestDeduplication.config.maxWaitTime,
        maxQueueSize: requestDeduplication.config.maxQueueSize,
        cleanupInterval: requestDeduplication.config.cleanupInterval
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Deduplication metrics retrieved', {
      deduplicationRate: stats.deduplicationRate,
      pendingRequests: stats.pendingRequests,
      queuedRequests: stats.queuedRequests,
      healthStatus: healthStatus.status
    });

    res.json({
      success: true,
      data: deduplicationInfo
    });

  } catch (error) {
    logger.error('Failed to get deduplication metrics:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve deduplication metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /cache/deduplication/clear
 * Clear all pending requests and queues (admin operation)
 */
router.delete('/deduplication/clear', requireSupabaseAuth, async (req, res) => {
  try {
    logger.info('Deduplication clear request received', {
      authenticatedUser: req.auth?.user?.email || 'unknown'
    });

    const result = requestDeduplication.clearAll();

    logger.info('Deduplication queues cleared', {
      clearedPending: result.clearedPending,
      clearedQueued: result.clearedQueued
    });

    res.json({
      success: true,
      data: result,
      message: 'All deduplication queues cleared',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to clear deduplication queues:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear deduplication queues',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/warming
 * Get cache warming statistics and queue status
 */
router.get('/warming', authMiddleware, async (req, res) => {
  try {
    logger.info('Cache warming status request received');

    const stats = cacheWarmingService.getWarmingStats();
    const queueStatus = cacheWarmingService.getQueueStatus();
    const effectivenessReport = cacheWarmingService.getEffectivenessReport();

    const warmingInfo = {
      statistics: stats,
      queueStatus,
      effectiveness: effectivenessReport,
      configuration: {
        warmingInterval: cacheWarmingService.config.warmingInterval,
        maxConcurrentWarmings: cacheWarmingService.config.maxConcurrentWarmings,
        minRequestFrequency: cacheWarmingService.config.minRequestFrequency
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Cache warming info retrieved', {
      successRate: stats.successRate,
      activeWarmings: stats.activeWarmings,
      pendingRecommendations: queueStatus.pendingRecommendations
    });

    res.json({
      success: true,
      data: warmingInfo
    });

  } catch (error) {
    logger.error('Failed to get cache warming info:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache warming information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /cache/warming/trigger
 * Manually trigger cache warming for specific request
 */
router.post('/warming/trigger', requireSupabaseAuth, async (req, res) => {
  try {
    const { dataType, propertyId, options = {} } = req.body;

    if (!dataType || !propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'dataType and propertyId are required'
      });
    }

    logger.info('Manual cache warming triggered', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      dataType,
      propertyId,
      options
    });

    const result = await cacheWarmingService.warmSpecificRequest(dataType, propertyId, options);

    logger.info('Manual cache warming completed', {
      success: result.success,
      warmingId: result.warmingId,
      duration: result.duration
    });

    res.json({
      success: true,
      data: result,
      message: `Cache warming ${result.success ? 'completed' : 'failed'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Manual cache warming failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Manual cache warming failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /cache/batch
 * Execute batch data retrieval for multiple data types
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { propertyId, dataTypes, options = {} } = req.body;

    if (!propertyId || !dataTypes || !Array.isArray(dataTypes)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'propertyId and dataTypes (array) are required'
      });
    }

    logger.info('Batch data request received', {
      authenticatedUser: req.auth?.user?.email || req.auth?.user || 'developer@localhost',
      propertyId,
      dataTypes,
      batchSize: dataTypes.length
    });

    const startTime = Date.now();
    const result = await ga4DataClient.getBatchData(propertyId, dataTypes, options);
    const responseTime = Date.now() - startTime;

    logger.info('Batch data request completed', {
      propertyId,
      batchSize: dataTypes.length,
      success: result.success,
      responseTime: `${responseTime}ms`
    });

    res.json({
      success: result.success,
      data: result.results || {},
      batchMetrics: {
        ...result.batchMetrics,
        totalResponseTime: responseTime
      },
      message: `Batch operation ${result.success ? 'completed' : 'failed'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Batch data request failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Batch operation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /cache/optimizations
 * Toggle performance optimizations on/off
 */
router.put('/optimizations', requireSupabaseAuth, async (req, res) => {
  try {
    const { optimizations } = req.body;

    if (!optimizations || typeof optimizations !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid optimizations configuration',
        message: 'optimizations object is required'
      });
    }

    logger.info('Performance optimizations update requested', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      optimizations
    });

    ga4DataClient.toggleOptimizations(optimizations);

    const currentOptimizations = ga4DataClient.optimizationsEnabled;

    logger.info('Performance optimizations updated', {
      optimizations: currentOptimizations
    });

    res.json({
      success: true,
      data: {
        optimizations: currentOptimizations
      },
      message: 'Performance optimizations updated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to update optimizations:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to update optimizations',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/optimizations
 * Get current optimization settings
 */
router.get('/optimizations', authMiddleware, async (req, res) => {
  try {
    const optimizations = ga4DataClient.optimizationsEnabled;
    
    res.json({
      success: true,
      data: {
        optimizations,
        features: {
          performanceAnalytics: 'Track request patterns and generate optimization recommendations',
          requestDeduplication: 'Prevent duplicate concurrent requests to same data',
          cacheWarming: 'Proactively populate cache based on usage patterns',
          batchOperations: 'Handle multiple data type requests efficiently'
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get optimizations:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve optimizations',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /cache/clear
 * Clear cache with optional pattern
 */
router.delete('/clear', requireSupabaseAuth, async (req, res) => {
  try {
    const { pattern = 'ga4:*', propertyId, dataTypes } = req.query;

    logger.info('Cache clear request received', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      pattern,
      propertyId,
      dataTypes
    });

    let result;

    if (propertyId) {
      // Clear cache for specific property
      const typesToClear = dataTypes ? dataTypes.split(',') : undefined;
      result = await ga4DataClient.invalidateCache(propertyId, typesToClear);
      
      logger.info('Property cache invalidated', {
        propertyId,
        dataTypes: typesToClear,
        invalidated: result.invalidated
      });
    } else {
      // Clear cache by pattern
      result = await ga4DataClient.clearCache(pattern);
      
      logger.info('Cache cleared by pattern', {
        pattern,
        cleared: result.cleared
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Cache cleared successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to clear cache:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /cache/invalidate/:propertyId
 * Invalidate cache for specific property
 */
router.post('/invalidate/:propertyId', requireSupabaseAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dataTypes } = req.body;

    logger.info('Cache invalidation request received', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      propertyId,
      dataTypes
    });

    const result = await ga4DataClient.invalidateCache(propertyId, dataTypes);

    logger.info('Cache invalidated for property', {
      propertyId,
      dataTypes,
      invalidated: result.invalidated
    });

    res.json({
      success: true,
      data: result,
      message: `Cache invalidated for property ${propertyId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to invalidate cache:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/keys
 * List cache keys with optional pattern
 */
router.get('/keys', requireSupabaseAuth, async (req, res) => {
  try {
    const { pattern = 'ga4:*', limit = 100 } = req.query;

    logger.info('Cache keys request received', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      pattern,
      limit
    });

    if (!redisClient.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Cache not available',
        message: 'Redis connection not available',
        timestamp: new Date().toISOString()
      });
    }

    // Get keys matching pattern
    const keys = await redisClient.client.keys(pattern);
    const limitedKeys = keys.slice(0, parseInt(limit));
    
    // Get TTL for each key (sample of first 10)
    const keyDetails = [];
    const sampleKeys = limitedKeys.slice(0, 10);
    
    for (const key of sampleKeys) {
      const ttl = await redisClient.ttl(key);
      keyDetails.push({
        key,
        ttl: ttl > 0 ? ttl : 'no expiry',
        type: key.split(':')[1] || 'unknown'
      });
    }

    logger.info('Cache keys retrieved', {
      pattern,
      totalFound: keys.length,
      returned: limitedKeys.length,
      sampleDetails: keyDetails.length
    });

    res.json({
      success: true,
      data: {
        keys: limitedKeys,
        keyDetails,
        totalFound: keys.length,
        returned: limitedKeys.length,
        pattern
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get cache keys:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache keys',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/health
 * Comprehensive cache health check
 */
router.get('/health', authMiddleware, async (req, res) => {
  try {
    logger.info('Cache health check request received');

    const healthCheck = {
      timestamp: new Date().toISOString(),
      cache: {
        enabled: ga4DataClient.cacheEnabled,
        status: 'unknown'
      },
      redis: {
        connected: false,
        responsive: false,
        stats: null
      },
      performance: {
        hitRate: '0%',
        totalRequests: 0,
        errors: 0
      }
    };

    // Check GA4DataClient cache status
    const ga4Stats = ga4DataClient.getCacheStats();
    healthCheck.performance = {
      hitRate: ga4Stats.hitRate,
      totalRequests: ga4Stats.totalRequests,
      hits: ga4Stats.hits,
      misses: ga4Stats.misses,
      errors: ga4Stats.errors
    };

    // Check Redis connection and responsiveness
    if (ga4DataClient.cacheEnabled) {
      healthCheck.redis.connected = redisClient.isConnected;
      
      try {
        const pingResult = await redisClient.ping();
        healthCheck.redis.responsive = pingResult;
        
        if (pingResult) {
          healthCheck.cache.status = 'healthy';
          healthCheck.redis.stats = await redisClient.getStats();
        } else {
          healthCheck.cache.status = 'degraded';
        }
      } catch (pingError) {
        healthCheck.cache.status = 'error';
        healthCheck.redis.error = pingError.message;
      }
    } else {
      healthCheck.cache.status = 'disabled';
    }

    const isHealthy = healthCheck.cache.status === 'healthy' || healthCheck.cache.status === 'disabled';
    const statusCode = isHealthy ? 200 : 503;

    logger.info('Cache health check completed', {
      status: healthCheck.cache.status,
      connected: healthCheck.redis.connected,
      responsive: healthCheck.redis.responsive,
      hitRate: healthCheck.performance.hitRate
    });

    res.status(statusCode).json({
      success: isHealthy,
      data: healthCheck
    });

  } catch (error) {
    logger.error('Cache health check failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Cache health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /cache/test
 * Test cache operations (set/get/delete)
 */
router.post('/test', requireSupabaseAuth, async (req, res) => {
  try {
    const testKey = `test:cache:${Date.now()}`;
    const testValue = {
      message: 'Cache test',
      timestamp: new Date().toISOString(),
      user: req.auth?.user?.email || 'test-user'
    };

    logger.info('Cache test request received', {
      authenticatedUser: req.auth?.user?.email || 'unknown',
      testKey
    });

    const testResults = {
      enabled: ga4DataClient.cacheEnabled,
      operations: {},
      performance: {},
      timestamp: new Date().toISOString()
    };

    if (!ga4DataClient.cacheEnabled) {
      testResults.message = 'Cache is disabled - test skipped';
      return res.json({
        success: true,
        data: testResults
      });
    }

    const startTime = Date.now();

    // Test SET operation
    try {
      const setResult = await redisClient.set(testKey, testValue, 60); // 60 seconds TTL
      testResults.operations.set = {
        success: setResult,
        duration: `${Date.now() - startTime}ms`
      };
    } catch (setError) {
      testResults.operations.set = {
        success: false,
        error: setError.message
      };
    }

    // Test GET operation
    try {
      const getStartTime = Date.now();
      const getValue = await redisClient.get(testKey);
      testResults.operations.get = {
        success: getValue !== null,
        dataMatch: getValue?.message === testValue.message,
        duration: `${Date.now() - getStartTime}ms`
      };
    } catch (getError) {
      testResults.operations.get = {
        success: false,
        error: getError.message
      };
    }

    // Test EXISTS operation
    try {
      const existsResult = await redisClient.exists(testKey);
      testResults.operations.exists = {
        success: existsResult,
        found: existsResult
      };
    } catch (existsError) {
      testResults.operations.exists = {
        success: false,
        error: existsError.message
      };
    }

    // Test TTL operation
    try {
      const ttlResult = await redisClient.ttl(testKey);
      testResults.operations.ttl = {
        success: ttlResult > 0,
        remaining: ttlResult > 0 ? `${ttlResult}s` : 'expired or no expiry'
      };
    } catch (ttlError) {
      testResults.operations.ttl = {
        success: false,
        error: ttlError.message
      };
    }

    // Test DELETE operation
    try {
      const deleteResult = await redisClient.del(testKey);
      testResults.operations.delete = {
        success: deleteResult,
        deleted: deleteResult
      };
    } catch (deleteError) {
      testResults.operations.delete = {
        success: false,
        error: deleteError.message
      };
    }

    testResults.performance.totalDuration = `${Date.now() - startTime}ms`;
    
    const allOperationsSuccessful = Object.values(testResults.operations)
      .every(op => op.success);

    logger.info('Cache test completed', {
      allOperationsSuccessful,
      totalDuration: testResults.performance.totalDuration,
      operations: Object.keys(testResults.operations).length
    });

    res.json({
      success: allOperationsSuccessful,
      data: testResults,
      message: allOperationsSuccessful ? 'All cache operations successful' : 'Some cache operations failed'
    });

  } catch (error) {
    logger.error('Cache test failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Cache test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /cache/metrics
 * Get detailed cache performance metrics
 */
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    logger.info('Cache metrics request received');

    const ga4Stats = ga4DataClient.getCacheStats();
    const redisStats = await redisClient.getStats();

    const metrics = {
      ga4Cache: ga4Stats,
      redis: redisStats,
      performance: {
        hitRate: ga4Stats.hitRate,
        missRate: ga4Stats.totalRequests > 0 
          ? `${((ga4Stats.misses / ga4Stats.totalRequests) * 100).toFixed(1)}%`
          : '0%',
        errorRate: ga4Stats.totalRequests > 0 
          ? `${((ga4Stats.errors / ga4Stats.totalRequests) * 100).toFixed(1)}%`
          : '0%',
        efficiency: ga4Stats.totalRequests > 0 
          ? `${(((ga4Stats.hits + ga4Stats.misses) / ga4Stats.totalRequests) * 100).toFixed(1)}%`
          : '0%'
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Cache metrics retrieved', {
      hitRate: metrics.performance.hitRate,
      totalRequests: ga4Stats.totalRequests,
      redisConnected: redisStats.connected
    });

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Failed to get cache metrics:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;