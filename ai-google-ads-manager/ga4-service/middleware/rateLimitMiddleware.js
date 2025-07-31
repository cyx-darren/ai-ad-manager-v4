/**
 * Rate Limiting Middleware
 * Subtask 5.5.2: Express middleware for rate limiting and quota management
 */

const { rateLimitingManager, quotaTracker } = require('../utils/rateLimiter');
const { GA4QuotaError, GA4RateLimitError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Create rate limiting middleware for different endpoint categories
 * @param {string} category - Rate limit category (ga4-core-reporting, ga4-realtime, etc.)
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
function createRateLimitMiddleware(category, options = {}) {
  const {
    tokensRequired = 1,
    enableQuotaCheck = true,
    quotaTypes = [],
    skipSuccessfulRequests = false,
    keyGenerator = null,
    onLimitReached = null
  } = options;

  return async (req, res, next) => {
    try {
      // Extract user identifier for per-user limits
      const userId = req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous';
      
      // Generate unique key if custom key generator provided
      const requestKey = keyGenerator ? keyGenerator(req) : null;
      const effectiveCategory = requestKey ? `${category}-${requestKey}` : category;
      
      // Check rate limits
      const rateLimitResult = rateLimitingManager.checkRateLimit(
        effectiveCategory, 
        userId, 
        tokensRequired
      );
      
      if (!rateLimitResult.allowed) {
        const error = new GA4RateLimitError(
          `Rate limit exceeded for ${category}`, 
          {
            category: effectiveCategory,
            userId,
            retryAfter: rateLimitResult.retryAfter,
            resetTime: rateLimitResult.resetTime,
            remaining: rateLimitResult.remaining
          }
        );
        
        // Custom callback for rate limit reached
        if (onLimitReached) {
          onLimitReached(req, rateLimitResult);
        }
        
        logger.warn('Rate limit exceeded', {
          path: req.path,
          method: req.method,
          userId,
          category: effectiveCategory,
          retryAfter: rateLimitResult.retryAfter
        });
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': rateLimitResult.capacity || 'unknown',
          'X-RateLimit-Remaining': rateLimitResult.remaining || 0,
          'X-RateLimit-Reset': rateLimitResult.resetTime || '',
          'Retry-After': rateLimitResult.retryAfter || 60
        });
        
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
          retryAfter: rateLimitResult.retryAfter,
          resetTime: rateLimitResult.resetTime
        });
      }
      
      // Check quota limits if enabled
      if (enableQuotaCheck && quotaTypes.length > 0) {
        for (const quotaType of quotaTypes) {
          const quotaResult = quotaTracker.checkQuota(quotaType, tokensRequired);
          
          if (!quotaResult.allowed) {
            const error = new GA4QuotaError(
              `Quota exceeded for ${quotaType}`,
              {
                quotaType,
                used: quotaResult.used,
                limit: quotaResult.limit,
                resetTime: quotaResult.resetTime
              }
            );
            
            logger.warn('Quota limit exceeded', {
              path: req.path,
              method: req.method,
              userId,
              quotaType,
              used: quotaResult.used,
              limit: quotaResult.limit
            });
            
            // Set quota headers
            res.set({
              'X-Quota-Used': quotaResult.used,
              'X-Quota-Limit': quotaResult.limit,
              'X-Quota-Reset': quotaResult.resetTime
            });
            
            return res.status(429).json({
              success: false,
              error: 'QUOTA_EXCEEDED',
              message: error.message,
              quotaType,
              used: quotaResult.used,
              limit: quotaResult.limit,
              resetTime: quotaResult.resetTime
            });
          }
        }
      }
      
      // Add rate limit info to request for logging
      req.rateLimit = {
        category: effectiveCategory,
        userId,
        tokensUsed: tokensRequired,
        remaining: rateLimitResult.remaining
      };
      
      // Add quota tracking to response handler
      if (enableQuotaCheck && quotaTypes.length > 0) {
        const originalEnd = res.end;
        res.end = function(...args) {
          // Track quota usage only on successful requests (or all if configured)
          if (!skipSuccessfulRequests || res.statusCode < 400) {
            quotaTypes.forEach(quotaType => {
              quotaTracker.trackUsage(quotaType, tokensRequired);
            });
          }
          
          originalEnd.apply(this, args);
        };
      }
      
      // Set informational headers
      res.set({
        'X-RateLimit-Remaining': rateLimitResult.remaining,
        'X-RateLimit-Category': effectiveCategory
      });
      
      next();
      
    } catch (error) {
      logger.error('Rate limiting middleware error', {
        error: error.message,
        path: req.path,
        method: req.method
      });
      
      // Allow request to proceed on middleware errors
      next();
    }
  };
}

/**
 * Predefined rate limiting middleware for common GA4 endpoints
 */
const rateLimitMiddlewares = {
  /**
   * Rate limiting for GA4 Core Reporting API calls
   */
  ga4CoreReporting: createRateLimitMiddleware('ga4-core-reporting', {
    tokensRequired: 1,
    enableQuotaCheck: true,
    quotaTypes: ['core-reporting-hourly', 'core-reporting-daily'],
    skipSuccessfulRequests: false
  }),
  
  /**
   * Rate limiting for GA4 Realtime Reporting API calls
   */
  ga4Realtime: createRateLimitMiddleware('ga4-realtime', {
    tokensRequired: 1,
    enableQuotaCheck: true,
    quotaTypes: ['realtime-hourly', 'realtime-daily'],
    skipSuccessfulRequests: false
  }),
  
  /**
   * Rate limiting for general GA4 API calls
   */
  ga4General: createRateLimitMiddleware('ga4-general', {
    tokensRequired: 1,
    enableQuotaCheck: false
  }),
  
  /**
   * Per-user rate limiting
   */
  perUser: createRateLimitMiddleware('per-user', {
    tokensRequired: 1,
    enableQuotaCheck: false
  }),
  
  /**
   * Heavy operations (like batch requests)
   */
  heavyOperations: createRateLimitMiddleware('ga4-core-reporting', {
    tokensRequired: 5, // Heavy operations consume more tokens
    enableQuotaCheck: true,
    quotaTypes: ['core-reporting-hourly', 'core-reporting-daily'],
    skipSuccessfulRequests: false
  }),
  
  /**
   * Administrative operations
   */
  admin: createRateLimitMiddleware('ga4-general', {
    tokensRequired: 1,
    enableQuotaCheck: false,
    keyGenerator: (req) => req.auth?.user?.role === 'admin' ? 'admin' : 'user'
  })
};

/**
 * Middleware to add rate limiting headers to all responses
 */
function rateLimitHeadersMiddleware(req, res, next) {
  const status = rateLimitingManager.getAllStatus();
  
  // Add general rate limiting information to headers
  res.set({
    'X-RateLimit-Service': 'ga4-api-service',
    'X-RateLimit-Version': '1.0.0'
  });
  
  next();
}

/**
 * Global quota monitoring middleware
 * Adds quota information to responses and triggers alerts
 */
function quotaMonitoringMiddleware(req, res, next) {
  const quotaStatus = quotaTracker.getQuotaStatus();
  
  // Add quota headers for monitoring
  const criticalQuotas = Object.entries(quotaStatus)
    .filter(([_, quota]) => quota.status === 'critical')
    .map(([type]) => type);
    
  if (criticalQuotas.length > 0) {
    res.set({
      'X-Quota-Status': 'critical',
      'X-Quota-Critical': criticalQuotas.join(',')
    });
  }
  
  next();
}

/**
 * Quota alert callback for system notifications
 */
quotaTracker.onAlert((alert) => {
  logger.warn('Quota alert received in middleware', {
    level: alert.level,
    quotaType: alert.quotaType,
    usagePercent: alert.usagePercent,
    remaining: alert.remaining
  });
  
  // Here you could integrate with external alerting systems
  // e.g., send to Slack, PagerDuty, email, etc.
});

module.exports = {
  createRateLimitMiddleware,
  rateLimitMiddlewares,
  rateLimitHeadersMiddleware,
  quotaMonitoringMiddleware
};