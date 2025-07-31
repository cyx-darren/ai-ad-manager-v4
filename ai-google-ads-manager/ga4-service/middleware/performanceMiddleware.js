/**
 * Performance Monitoring Middleware
 * Subtask 5.5.4: Request tracking, performance monitoring, and structured logging
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request tracking middleware
 * Tracks all requests with performance metrics and structured logging
 */
function requestTrackingMiddleware(req, res, next) {
  // Generate unique request ID
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  
  // Set request ID header for client correlation
  res.setHeader('X-Request-ID', requestId);
  
  // Extract user information if available
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  
  // Start performance tracking
  logger.performance.startRequest(
    requestId,
    req.originalUrl || req.url,
    req.method,
    userId
  );
  
  // Store original res.end to track response completion
  const originalEnd = res.end;
  
  res.end = function(chunk, encoding) {
    // Complete performance tracking
    logger.performance.endRequest(
      requestId,
      res.statusCode,
      res.locals.cacheHit,
      res.locals.error
    );
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  // Monitor for slow requests (check every 2 seconds)
  const slowRequestMonitor = setInterval(() => {
    logger.performance.checkPerformanceWarning(requestId, 5000);
  }, 2000);
  
  // Clear monitor when response completes
  res.on('finish', () => {
    clearInterval(slowRequestMonitor);
  });
  
  // Add request metadata to locals for use in other middleware
  res.locals.requestId = requestId;
  res.locals.startTime = Date.now();
  
  next();
}

/**
 * Response time middleware
 * Adds response time headers and logs performance metrics
 */
function responseTimeMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Store original res.end
  const originalEnd = res.end;
  
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // Add response time header
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    // Log API call metrics
    logger.apiCall(
      req.originalUrl || req.url,
      req.method,
      res.statusCode,
      responseTime,
      res.locals.cacheHit,
      req.requestId
    );
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Error tracking middleware
 * Captures and logs errors with request context
 */
function errorTrackingMiddleware(err, req, res, next) {
  // Store error in locals for performance tracking
  res.locals.error = err;
  
  // Log error with full context
  logger.error('Request error occurred', {
    requestId: req.requestId,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    statusCode: res.statusCode || 500,
    error: {
      message: err.message,
      code: err.code,
      stack: err.stack
    },
    user: req.user?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  next(err);
}

/**
 * Cache hit tracking middleware
 * Tracks cache performance metrics
 */
function cacheTrackingMiddleware(req, res, next) {
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    // Check if response indicates cache hit
    if (data && data.cache && typeof data.cache.hit === 'boolean') {
      res.locals.cacheHit = data.cache.hit;
    }
    
    // Call original json method
    originalJson.call(this, data);
  };
  
  next();
}

/**
 * Security event middleware
 * Logs security-related events
 */
function securityEventMiddleware(req, res, next) {
  // Check for potential security issues
  const userAgent = req.headers['user-agent'] || '';
  const apiKey = req.headers['x-api-key'];
  const authorization = req.headers['authorization'];
  
  // Log suspicious user agents
  if (userAgent.toLowerCase().includes('bot') || 
      userAgent.toLowerCase().includes('crawler') ||
      userAgent.toLowerCase().includes('scanner')) {
    logger.security('Suspicious user agent detected', {
      requestId: req.requestId,
      userAgent,
      ip: req.ip,
      endpoint: req.originalUrl || req.url
    });
  }
  
  // Log authentication attempts
  if (apiKey || authorization) {
    logger.debug('Authentication attempt', {
      requestId: req.requestId,
      hasApiKey: !!apiKey,
      hasAuth: !!authorization,
      endpoint: req.originalUrl || req.url,
      ip: req.ip
    });
  }
  
  // Log requests without authentication to protected endpoints
  if ((req.originalUrl || req.url).startsWith('/api/') && !apiKey && !authorization) {
    logger.security('Unauthenticated request to protected endpoint', {
      requestId: req.requestId,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      ip: req.ip,
      userAgent
    });
  }
  
  next();
}

/**
 * Business metrics middleware
 * Tracks business-relevant metrics
 */
function businessMetricsMiddleware(req, res, next) {
  // Store original res.json
  const originalJson = res.json;
  
  res.json = function(data) {
    // Track successful GA4 API calls
    if (req.url.startsWith('/api/ga4/') && res.statusCode === 200) {
      const endpoint = req.url.split('/')[3]; // Extract endpoint type
      logger.business('ga4_api_call', 1, {
        requestId: req.requestId,
        endpoint,
        method: req.method,
        cacheHit: res.locals.cacheHit,
        responseTime: Date.now() - res.locals.startTime
      });
    }
    
    // Track cache operations
    if (req.url.startsWith('/cache/') && res.statusCode === 200) {
      const operation = req.url.split('/')[2];
      logger.business('cache_operation', 1, {
        requestId: req.requestId,
        operation,
        method: req.method
      });
    }
    
    // Track authentication events
    if (req.url.startsWith('/auth/') && res.statusCode === 200) {
      const authType = req.url.split('/')[2];
      logger.business('auth_event', 1, {
        requestId: req.requestId,
        authType,
        method: req.method
      });
    }
    
    // Call original json method
    originalJson.call(this, data);
  };
  
  next();
}

/**
 * Health check middleware
 * Adds health status headers to responses
 */
function healthStatusMiddleware(req, res, next) {
  // Add service health headers
  res.setHeader('X-Service-Health', 'healthy');
  res.setHeader('X-Service-Version', '1.0.0');
  res.setHeader('X-Service-Name', 'ga4-api-service');
  
  // Add basic performance headers
  const systemMetrics = logger.performance.getSystemMetrics();
  res.setHeader('X-Service-Uptime', Math.round(systemMetrics.uptime / 1000));
  res.setHeader('X-Service-Memory', `${systemMetrics.memory.current}MB`);
  res.setHeader('X-Service-Requests', systemMetrics.requests.total);
  
  next();
}

/**
 * Create a combined performance monitoring middleware stack
 */
function createPerformanceMiddleware() {
  return [
    requestTrackingMiddleware,
    responseTimeMiddleware,
    cacheTrackingMiddleware,
    securityEventMiddleware,
    businessMetricsMiddleware,
    healthStatusMiddleware
  ];
}

module.exports = {
  requestTrackingMiddleware,
  responseTimeMiddleware,
  errorTrackingMiddleware,
  cacheTrackingMiddleware,
  securityEventMiddleware,
  businessMetricsMiddleware,
  healthStatusMiddleware,
  createPerformanceMiddleware
};