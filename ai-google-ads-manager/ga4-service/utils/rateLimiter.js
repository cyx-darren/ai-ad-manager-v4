/**
 * Rate Limiting and Quota Management System
 * Subtask 5.5.2: Implement rate limiting, quota tracking, and warning systems
 */

const logger = require('./logger');

/**
 * Token Bucket Rate Limiter Implementation
 * Implements the token bucket algorithm for smooth rate limiting
 */
class TokenBucketRateLimiter {
  constructor(options = {}) {
    this.capacity = options.capacity || 100; // Maximum tokens
    this.refillRate = options.refillRate || 10; // Tokens per second
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.identifier = options.identifier || 'default';
    
    logger.info('Token bucket rate limiter initialized', {
      identifier: this.identifier,
      capacity: this.capacity,
      refillRate: this.refillRate
    });
  }

  /**
   * Refill tokens based on elapsed time
   */
  refillTokens() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Attempt to consume tokens for a request
   * @param {number} tokensRequired - Number of tokens needed
   * @returns {Object} Result with allowed status and remaining tokens
   */
  consume(tokensRequired = 1) {
    this.refillTokens();
    
    if (this.tokens >= tokensRequired) {
      this.tokens -= tokensRequired;
      return {
        allowed: true,
        remaining: this.tokens,
        resetTime: null,
        retryAfter: null
      };
    }
    
    // Calculate when enough tokens will be available
    const tokensNeeded = tokensRequired - this.tokens;
    const timeToWait = Math.ceil(tokensNeeded / this.refillRate * 1000); // milliseconds
    
    return {
      allowed: false,
      remaining: this.tokens,
      resetTime: Date.now() + timeToWait,
      retryAfter: Math.ceil(timeToWait / 1000) // seconds
    };
  }

  /**
   * Get current bucket status
   */
  getStatus() {
    this.refillTokens();
    return {
      identifier: this.identifier,
      tokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      utilizationPercent: Math.round((1 - this.tokens / this.capacity) * 100)
    };
  }
}

/**
 * Global Rate Limiting Manager
 * Manages multiple rate limiters for different categories
 */
class RateLimitingManager {
  constructor() {
    this.limiters = new Map();
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      startTime: Date.now()
    };
    
    // Initialize default limiters based on GA4 API limits
    this.initializeDefaultLimiters();
    
    logger.info('Rate limiting manager initialized');
  }

  /**
   * Initialize default rate limiters for GA4 API endpoints
   */
  initializeDefaultLimiters() {
    // GA4 has different rate limits for different types of requests
    // Core Reporting API: 100 requests per minute per property
    this.limiters.set('ga4-core-reporting', new TokenBucketRateLimiter({
      identifier: 'ga4-core-reporting',
      capacity: 100,
      refillRate: 100 / 60 // 100 requests per 60 seconds
    }));
    
    // Realtime Reporting API: 60 requests per minute per property
    this.limiters.set('ga4-realtime', new TokenBucketRateLimiter({
      identifier: 'ga4-realtime',
      capacity: 60,
      refillRate: 60 / 60 // 60 requests per 60 seconds
    }));
    
    // General API calls: 200 requests per minute
    this.limiters.set('ga4-general', new TokenBucketRateLimiter({
      identifier: 'ga4-general',
      capacity: 200,
      refillRate: 200 / 60 // 200 requests per 60 seconds
    }));
    
    // Per-user limits: 10 requests per second per user
    this.limiters.set('per-user', new TokenBucketRateLimiter({
      identifier: 'per-user',
      capacity: 50,
      refillRate: 10 // 10 requests per second
    }));
  }

  /**
   * Check rate limit for a specific category
   * @param {string} category - Rate limit category
   * @param {string} userId - Optional user identifier
   * @param {number} tokensRequired - Number of tokens needed
   * @returns {Object} Rate limit result
   */
  checkRateLimit(category, userId = null, tokensRequired = 1) {
    this.stats.totalRequests++;
    
    // For user-specific limits, create dynamic limiters
    if (userId && category === 'per-user') {
      const userLimiterKey = `user-${userId}`;
      if (!this.limiters.has(userLimiterKey)) {
        this.limiters.set(userLimiterKey, new TokenBucketRateLimiter({
          identifier: userLimiterKey,
          capacity: 50,
          refillRate: 10
        }));
      }
      category = userLimiterKey;
    }
    
    const limiter = this.limiters.get(category);
    if (!limiter) {
      logger.warn('Unknown rate limit category', { category });
      // If no limiter exists, allow the request but log it
      this.stats.allowedRequests++;
      return {
        allowed: true,
        category,
        message: `No rate limiter configured for category: ${category}`
      };
    }
    
    const result = limiter.consume(tokensRequired);
    
    if (result.allowed) {
      this.stats.allowedRequests++;
      logger.debug('Request allowed by rate limiter', {
        category,
        userId,
        tokensRequired,
        remaining: result.remaining
      });
    } else {
      this.stats.blockedRequests++;
      logger.warn('Request blocked by rate limiter', {
        category,
        userId,
        tokensRequired,
        retryAfter: result.retryAfter
      });
    }
    
    return {
      ...result,
      category,
      userId
    };
  }

  /**
   * Get status of all rate limiters
   */
  getAllStatus() {
    const limiterStatus = {};
    for (const [key, limiter] of this.limiters) {
      limiterStatus[key] = limiter.getStatus();
    }
    
    return {
      limiters: limiterStatus,
      statistics: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime,
        allowedPercent: this.stats.totalRequests > 0 
          ? Math.round((this.stats.allowedRequests / this.stats.totalRequests) * 100) 
          : 100,
        blockedPercent: this.stats.totalRequests > 0 
          ? Math.round((this.stats.blockedRequests / this.stats.totalRequests) * 100) 
          : 0
      }
    };
  }

  /**
   * Reset statistics (useful for testing or monitoring)
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      startTime: Date.now()
    };
    
    logger.info('Rate limiting statistics reset');
  }
}

/**
 * GA4 API Quota Tracking System
 * Tracks and monitors GA4 API quota usage
 */
class QuotaTracker {
  constructor() {
    this.quotaLimits = {
      // Daily limits
      'core-reporting-daily': { limit: 50000, used: 0, resetTime: this.getNextDayReset() },
      'realtime-daily': { limit: 10000, used: 0, resetTime: this.getNextDayReset() },
      
      // Hourly limits
      'core-reporting-hourly': { limit: 5000, used: 0, resetTime: this.getNextHourReset() },
      'realtime-hourly': { limit: 1000, used: 0, resetTime: this.getNextHourReset() }
    };
    
    this.warningThresholds = {
      yellow: 70, // 70% usage warning
      red: 90     // 90% usage critical warning
    };
    
    this.alertCallbacks = [];
    
    // Start periodic quota reset check
    this.startQuotaResetMonitor();
    
    logger.info('Quota tracker initialized', {
      quotaLimits: Object.keys(this.quotaLimits),
      warningThresholds: this.warningThresholds
    });
  }

  /**
   * Get next day reset time (midnight UTC)
   */
  getNextDayReset() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Get next hour reset time
   */
  getNextHourReset() {
    const nextHour = new Date();
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    return nextHour.getTime();
  }

  /**
   * Track quota usage for an API call
   * @param {string} quotaType - Type of quota to track
   * @param {number} cost - Cost of the operation (default 1)
   */
  trackUsage(quotaType, cost = 1) {
    if (!this.quotaLimits[quotaType]) {
      logger.warn('Unknown quota type', { quotaType });
      return;
    }
    
    const quota = this.quotaLimits[quotaType];
    quota.used += cost;
    
    const usagePercent = (quota.used / quota.limit) * 100;
    
    logger.debug('Quota usage tracked', {
      quotaType,
      cost,
      used: quota.used,
      limit: quota.limit,
      usagePercent: Math.round(usagePercent)
    });
    
    // Check for warnings
    this.checkQuotaWarnings(quotaType, usagePercent);
  }

  /**
   * Check if quota warnings should be triggered
   */
  checkQuotaWarnings(quotaType, usagePercent) {
    const quota = this.quotaLimits[quotaType];
    
    if (usagePercent >= this.warningThresholds.red) {
      this.triggerAlert('critical', quotaType, usagePercent, quota);
    } else if (usagePercent >= this.warningThresholds.yellow) {
      this.triggerAlert('warning', quotaType, usagePercent, quota);
    }
  }

  /**
   * Trigger quota alert
   */
  triggerAlert(level, quotaType, usagePercent, quota) {
    const alert = {
      level,
      quotaType,
      usagePercent: Math.round(usagePercent),
      used: quota.used,
      limit: quota.limit,
      remaining: quota.limit - quota.used,
      resetTime: quota.resetTime,
      timestamp: Date.now()
    };
    
    logger.warn('Quota alert triggered', alert);
    
    // Call registered alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error in quota alert callback', { error: error.message });
      }
    });
  }

  /**
   * Register an alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Check if quota allows for a request
   * @param {string} quotaType - Type of quota to check
   * @param {number} cost - Cost of the operation
   * @returns {Object} Check result
   */
  checkQuota(quotaType, cost = 1) {
    if (!this.quotaLimits[quotaType]) {
      return { allowed: true, message: `Unknown quota type: ${quotaType}` };
    }
    
    const quota = this.quotaLimits[quotaType];
    const wouldExceed = (quota.used + cost) > quota.limit;
    
    if (wouldExceed) {
      return {
        allowed: false,
        quotaType,
        used: quota.used,
        limit: quota.limit,
        cost,
        resetTime: quota.resetTime,
        message: `Quota exceeded for ${quotaType}. Used: ${quota.used}/${quota.limit}`
      };
    }
    
    return {
      allowed: true,
      quotaType,
      used: quota.used,
      limit: quota.limit,
      remaining: quota.limit - quota.used - cost,
      usagePercent: Math.round(((quota.used + cost) / quota.limit) * 100)
    };
  }

  /**
   * Get current quota status
   */
  getQuotaStatus() {
    const status = {};
    const now = Date.now();
    
    for (const [type, quota] of Object.entries(this.quotaLimits)) {
      const usagePercent = (quota.used / quota.limit) * 100;
      const timeToReset = quota.resetTime - now;
      
      status[type] = {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.limit - quota.used,
        usagePercent: Math.round(usagePercent),
        resetTime: quota.resetTime,
        timeToReset: Math.max(0, timeToReset),
        status: usagePercent >= 90 ? 'critical' : 
               usagePercent >= 70 ? 'warning' : 'ok'
      };
    }
    
    return status;
  }

  /**
   * Start periodic monitoring to reset quotas
   */
  startQuotaResetMonitor() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [type, quota] of Object.entries(this.quotaLimits)) {
        if (now >= quota.resetTime) {
          const oldUsed = quota.used;
          quota.used = 0;
          
          if (type.includes('daily')) {
            quota.resetTime = this.getNextDayReset();
          } else if (type.includes('hourly')) {
            quota.resetTime = this.getNextHourReset();
          }
          
          logger.info('Quota reset', {
            quotaType: type,
            previousUsage: oldUsed,
            nextReset: new Date(quota.resetTime).toISOString()
          });
        }
      }
    }, 60000); // Check every minute
  }
}

// Create singleton instances
const rateLimitingManager = new RateLimitingManager();
const quotaTracker = new QuotaTracker();

// Export everything
module.exports = {
  TokenBucketRateLimiter,
  RateLimitingManager,
  QuotaTracker,
  rateLimitingManager,
  quotaTracker
};