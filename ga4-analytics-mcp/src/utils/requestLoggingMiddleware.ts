import { Request, Response, NextFunction } from 'express';
import { logger, setCorrelationId, getCorrelationId, LogContext, sanitizeLogData } from './productionLogger.js';

// Extended Express Request interface for correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
      logger?: typeof logger;
    }
  }
}

// Correlation ID header name
const CORRELATION_ID_HEADER = 'x-correlation-id';

// Request ID counter for internal tracking
let requestIdCounter = 0;

// Middleware to add correlation ID and request logging
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  req.startTime = startTime;
  
  // Generate or extract correlation ID
  const incomingCorrelationId = req.headers[CORRELATION_ID_HEADER] as string;
  const correlationId = setCorrelationId(incomingCorrelationId);
  req.correlationId = correlationId;
  
  // Set correlation ID in response header
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  
  // Generate unique request ID
  const requestId = `req_${++requestIdCounter}_${Date.now()}`;
  
  // Attach logger to request for convenience
  req.logger = logger;
  
  // Create request context
  const requestContext: LogContext = {
    correlationId,
    requestId,
    component: 'HTTP_MIDDLEWARE',
    method: req.method,
    endpoint: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'],
    ip: getClientIP(req),
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    referer: req.headers.referer,
    host: req.headers.host,
    protocol: req.protocol,
    secure: req.secure,
    timestamp: new Date().toISOString(),
  };
  
  // Log incoming request
  logger.logRequest(req, requestContext);
  
  // Hook into response finish event
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  let responseLogged = false;
  
  function logResponse() {
    if (responseLogged) return;
    responseLogged = true;
    
    const duration = Date.now() - startTime;
    const responseSize = res.get('content-length');
    
    const responseContext: LogContext = {
      correlationId,
      requestId,
      component: 'HTTP_MIDDLEWARE',
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      responseSize,
      cached: res.get('x-cache-status') === 'hit',
      userAgent: req.headers['user-agent'],
      ip: getClientIP(req),
    };
    
    // Log response with appropriate level
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} - Server Error`, responseContext);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} - Client Error`, responseContext);
    } else if (duration > 10000) {
      logger.warn(`${req.method} ${req.originalUrl} - Slow Response`, responseContext);
    } else {
      logger.logResponse(req, res, duration, responseContext);
    }
    
    // Performance logging for slow requests
    if (duration > 5000) {
      logger.logPerformance(`HTTP Request: ${req.method} ${req.originalUrl}`, duration, {
        correlationId,
        requestId,
        statusCode: res.statusCode,
        slow: true,
      });
    }
  }
  
  // Override response methods to capture response logging
  res.send = function(body: any) {
    logResponse();
    return originalSend.call(this, body);
  };
  
  res.json = function(obj: any) {
    logResponse();
    return originalJson.call(this, obj);
  };
  
  res.end = function(chunk?: any, encoding?: any) {
    logResponse();
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Handle response finish event as fallback
  res.on('finish', logResponse);
  res.on('close', logResponse);
  
  // Handle errors in the request processing
  res.on('error', (error: Error) => {
    logger.error('Response error occurred', error, {
      correlationId,
      requestId,
      component: 'HTTP_MIDDLEWARE',
      method: req.method,
      endpoint: req.originalUrl || req.url,
      duration: Date.now() - startTime,
    });
  });
  
  next();
}

// Get client IP address with proxy support
function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// MCP-specific request logging middleware
export function mcpRequestLoggingMiddleware(toolName: string, args: any) {
  const correlationId = setCorrelationId();
  const startTime = Date.now();
  
  // Log MCP tool invocation
  logger.info(`MCP Tool invoked: ${toolName}`, {
    correlationId,
    component: 'MCP_TOOLS',
    toolName,
    args: sanitizeLogData(args),
    timestamp: new Date().toISOString(),
  });
  
  return {
    correlationId,
    startTime,
    logSuccess: (result: any) => {
      const duration = Date.now() - startTime;
      logger.info(`MCP Tool completed: ${toolName}`, {
        correlationId,
        component: 'MCP_TOOLS',
        toolName,
        duration,
        success: true,
        resultSize: JSON.stringify(result).length,
      });
      
      if (duration > 5000) {
        logger.logPerformance(`MCP Tool: ${toolName}`, duration, {
          correlationId,
          toolName,
          slow: true,
        });
      }
    },
    logError: (error: Error) => {
      const duration = Date.now() - startTime;
      logger.error(`MCP Tool failed: ${toolName}`, error, {
        correlationId,
        component: 'MCP_TOOLS',
        toolName,
        duration,
        success: false,
      });
    },
  };
}

// GA4 API request logging middleware
export function ga4RequestLoggingMiddleware(endpoint: string, params: any) {
  const correlationId = getCorrelationId() || setCorrelationId();
  const startTime = Date.now();
  
  // Log GA4 API request
  logger.logGA4Request(endpoint, params, {
    correlationId,
    timestamp: new Date().toISOString(),
  });
  
  return {
    correlationId,
    startTime,
    logSuccess: (response: any) => {
      const duration = Date.now() - startTime;
      logger.logGA4Response(endpoint, true, duration, {
        correlationId,
        responseSize: JSON.stringify(response).length,
        fromCache: response.requestInfo?.fromCache || false,
      });
    },
    logError: (error: Error) => {
      const duration = Date.now() - startTime;
      logger.logGA4Response(endpoint, false, duration, {
        correlationId,
        error: {
          name: error.name,
          message: error.message,
        },
      });
    },
  };
}

// Authentication logging middleware
export function authLoggingMiddleware(action: string, userId?: string) {
  const correlationId = getCorrelationId() || setCorrelationId();
  const startTime = Date.now();
  
  return {
    correlationId,
    startTime,
    logSuccess: (additionalContext?: LogContext) => {
      const duration = Date.now() - startTime;
      logger.logAuth(action, true, userId, {
        correlationId,
        duration,
        ...additionalContext,
      });
    },
    logFailure: (reason: string, additionalContext?: LogContext) => {
      const duration = Date.now() - startTime;
      logger.logAuth(action, false, userId, {
        correlationId,
        duration,
        reason,
        ...additionalContext,
      });
    },
  };
}

// Health check logging middleware
export function healthCheckLoggingMiddleware(checkName: string) {
  const correlationId = getCorrelationId() || setCorrelationId();
  const startTime = Date.now();
  
  return {
    correlationId,
    startTime,
    logStatus: (status: 'healthy' | 'unhealthy' | 'degraded', details: any) => {
      const duration = Date.now() - startTime;
      logger.logHealthCheck(status, details, {
        correlationId,
        checkName,
        duration,
      });
    },
  };
}

// Express error handler with logging
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = req.correlationId || setCorrelationId();
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  
  logger.error('Unhandled request error', error, {
    correlationId,
    component: 'ERROR_HANDLER',
    method: req.method,
    endpoint: req.originalUrl || req.url,
    duration,
    statusCode: res.statusCode,
    userAgent: req.headers['user-agent'],
    ip: getClientIP(req),
  });
  
  // Set correlation ID in error response
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  
  // Send error response
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
  
  next(error);
}

// Cleanup function for graceful shutdown
export function cleanupRequestLogging(): void {
  logger.info('Request logging middleware shutting down', {
    component: 'HTTP_MIDDLEWARE',
    timestamp: new Date().toISOString(),
  });
}

export default requestLoggingMiddleware;