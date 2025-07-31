/**
 * Enhanced Logging System
 * Subtask 5.5.4: Structured logging, performance monitoring, and health checks
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Define log levels with numeric priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Define log colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey'
};

// Add colors to winston
winston.addColors(logColors);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Enhanced structured logging format
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'ga4-api-service',
      version: '1.0.0'
    };

    // Add request context if available
    if (info.requestId) logEntry.requestId = info.requestId;
    if (info.userId) logEntry.userId = info.userId;
    if (info.endpoint) logEntry.endpoint = info.endpoint;
    if (info.method) logEntry.method = info.method;
    if (info.statusCode) logEntry.statusCode = info.statusCode;
    if (info.responseTime) logEntry.responseTime = info.responseTime;

    // Add performance metrics
    if (info.performance) logEntry.performance = info.performance;
    if (info.cacheHit !== undefined) logEntry.cacheHit = info.cacheHit;
    if (info.rateLimitRemaining) logEntry.rateLimitRemaining = info.rateLimitRemaining;
    if (info.quotaUsage) logEntry.quotaUsage = info.quotaUsage;

    // Add error details
    if (info.error) {
      logEntry.error = {
        message: info.error.message,
        code: info.error.code,
        stack: info.error.stack
      };
    }

    // Add any additional metadata
    if (info.metadata) logEntry.metadata = info.metadata;

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    let logMessage = `${info.timestamp} [${info.level}]: ${info.message}`;
    
    // Add request context to console output
    if (info.requestId) logMessage += ` | RequestID: ${info.requestId}`;
    if (info.endpoint) logMessage += ` | ${info.method || 'GET'} ${info.endpoint}`;
    if (info.responseTime) logMessage += ` | ${info.responseTime}ms`;
    if (info.statusCode) logMessage += ` | ${info.statusCode}`;
    
    return logMessage;
  })
);

// Define transports based on environment
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
);

// File transports for production and development
if (process.env.NODE_ENV === 'production') {
  // Production file logging with structured format
  transports.push(
    // Error log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: structuredFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: structuredFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),

    // Performance log
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'http',
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  );
} else {
  // Development file logging
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'development.log'),
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: logLevels,
  format: structuredFormat,
  transports,
  
  // Global error handling
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: structuredFormat
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: structuredFormat
    })
  ],
  
  exitOnError: false
});

/**
 * Performance Monitoring Logger
 * Tracks request performance and system metrics
 */
class PerformanceLogger {
  constructor() {
    this.requestMetrics = new Map();
    this.systemMetrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0
    };
  }

  /**
   * Start tracking a request
   */
  startRequest(requestId, endpoint, method, userId = null) {
    this.requestMetrics.set(requestId, {
      startTime: Date.now(),
      endpoint,
      method,
      userId,
      memoryStart: process.memoryUsage()
    });

    this.systemMetrics.requestCount++;

    logger.http('Request started', {
      requestId,
      endpoint,
      method,
      userId,
      performance: {
        totalRequests: this.systemMetrics.requestCount,
        uptime: Date.now() - this.systemMetrics.startTime
      }
    });
  }

  /**
   * End tracking a request
   */
  endRequest(requestId, statusCode, cacheHit = null, error = null) {
    const requestData = this.requestMetrics.get(requestId);
    if (!requestData) return;

    const endTime = Date.now();
    const responseTime = endTime - requestData.startTime;
    const memoryEnd = process.memoryUsage();
    const memoryDelta = memoryEnd.heapUsed - requestData.memoryStart.heapUsed;

    // Update system metrics
    this.systemMetrics.averageResponseTime = 
      (this.systemMetrics.averageResponseTime + responseTime) / 2;
    
    if (memoryEnd.heapUsed > this.systemMetrics.peakMemoryUsage) {
      this.systemMetrics.peakMemoryUsage = memoryEnd.heapUsed;
    }

    if (error || statusCode >= 400) {
      this.systemMetrics.errorCount++;
    }

    // Log request completion
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(logLevel, 'Request completed', {
      requestId,
      endpoint: requestData.endpoint,
      method: requestData.method,
      userId: requestData.userId,
      statusCode,
      responseTime,
      cacheHit,
      performance: {
        memoryDelta,
        currentMemory: Math.round(memoryEnd.heapUsed / 1024 / 1024), // MB
        averageResponseTime: Math.round(this.systemMetrics.averageResponseTime),
        errorRate: Math.round((this.systemMetrics.errorCount / this.systemMetrics.requestCount) * 100)
      },
      error: error ? {
        message: error.message,
        code: error.code,
        stack: error.stack
      } : undefined
    });

    // Clean up
    this.requestMetrics.delete(requestId);
  }

  /**
   * Log performance warning if response time is high
   */
  checkPerformanceWarning(requestId, threshold = 5000) {
    const requestData = this.requestMetrics.get(requestId);
    if (!requestData) return;

    const currentTime = Date.now();
    const responseTime = currentTime - requestData.startTime;

    if (responseTime > threshold) {
      logger.warn('Slow request detected', {
        requestId,
        endpoint: requestData.endpoint,
        method: requestData.method,
        responseTime,
        threshold,
        performance: {
          warning: 'SLOW_REQUEST',
          recommendation: 'Consider optimizing query or implementing caching'
        }
      });
    }
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics() {
    const memory = process.memoryUsage();
    const uptime = Date.now() - this.systemMetrics.startTime;

    return {
      uptime,
      requests: {
        total: this.systemMetrics.requestCount,
        errors: this.systemMetrics.errorCount,
        errorRate: this.systemMetrics.requestCount > 0 
          ? Math.round((this.systemMetrics.errorCount / this.systemMetrics.requestCount) * 100)
          : 0,
        averageResponseTime: Math.round(this.systemMetrics.averageResponseTime)
      },
      memory: {
        current: Math.round(memory.heapUsed / 1024 / 1024), // MB
        peak: Math.round(this.systemMetrics.peakMemoryUsage / 1024 / 1024), // MB
        total: Math.round(memory.heapTotal / 1024 / 1024), // MB
        external: Math.round(memory.external / 1024 / 1024) // MB
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        version: process.version,
        uptime: Math.round(process.uptime())
      }
    };
  }

  /**
   * Log system health metrics
   */
  logSystemHealth() {
    const metrics = this.getSystemMetrics();
    
    logger.info('System health metrics', {
      performance: metrics,
      health: {
        status: 'healthy',
        checks: {
          memory: metrics.memory.current < 512 ? 'ok' : 'warning', // 512MB threshold
          errorRate: metrics.requests.errorRate < 5 ? 'ok' : 'warning', // 5% threshold
          responseTime: metrics.requests.averageResponseTime < 1000 ? 'ok' : 'warning' // 1s threshold
        }
      }
    });
  }
}

// Create global performance logger instance
const performanceLogger = new PerformanceLogger();

// Enhanced logger with additional methods
const enhancedLogger = Object.assign(logger, {
  performance: performanceLogger,
  
  /**
   * Log with request context
   */
  withRequest(requestId, level, message, metadata = {}) {
    logger.log(level, message, {
      requestId,
      ...metadata
    });
  },

  /**
   * Log API call metrics
   */
  apiCall(endpoint, method, statusCode, responseTime, cacheHit = null, requestId = null) {
    logger.http('API call metrics', {
      requestId,
      endpoint,
      method,
      statusCode,
      responseTime,
      cacheHit,
      performance: {
        responseTime,
        cached: cacheHit === true
      }
    });
  },

  /**
   * Log security events
   */
  security(event, details = {}) {
    logger.warn('Security event', {
      securityEvent: event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log business metrics
   */
  business(metric, value, metadata = {}) {
    logger.info('Business metric', {
      businessMetric: metric,
      value,
      ...metadata
    });
  }
});

// Start periodic health logging (every 5 minutes)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    performanceLogger.logSystemHealth();
  }, 5 * 60 * 1000);
}

module.exports = enhancedLogger;