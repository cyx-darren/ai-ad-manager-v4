import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';

// Log levels for different environments
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for log levels
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(LOG_COLORS);

// Environment-based configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || '30';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14';

// Security-safe logging - fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'api_key',
  'access_token',
  'refresh_token',
  'client_secret',
  'private_key',
  'credential',
  'auth',
  'bearer'
];

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, component, method, duration, ...meta } = info;
    
    // Security-safe logging - redact sensitive data
    const safeMeta = sanitizeLogData(meta);
    
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId,
      component,
      method,
      duration,
      ...safeMeta,
      environment: NODE_ENV,
      service: 'ga4-analytics-mcp'
    };
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, component, method, duration } = info;
    let logLine = `${timestamp} [${level}]`;
    
    if (correlationId && typeof correlationId === 'string') logLine += ` [${correlationId.slice(0, 8)}]`;
    if (component) logLine += ` [${component}]`;
    if (method) logLine += ` ${method}`;
    if (duration) logLine += ` (${duration}ms)`;
    
    logLine += `: ${message}`;
    
    return logLine;
  })
);

// Transport configurations
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      level: LOG_LEVEL,
      format: consoleFormat,
    })
  );
}

// File transports for production
if (NODE_ENV === 'production') {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: `${LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: customFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_RETENTION_DAYS + 'd',
      zippedArchive: true,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: `${LOG_DIR}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      format: customFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_RETENTION_DAYS + 'd',
      zippedArchive: true,
    })
  );

  // HTTP request logs
  transports.push(
    new DailyRotateFile({
      filename: `${LOG_DIR}/http-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: customFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES + 'd',
      zippedArchive: true,
    })
  );
}

// Create Winston logger instance
const productionLogger = winston.createLogger({
  level: LOG_LEVEL,
  levels: LOG_LEVELS,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Security function to sanitize sensitive data
export function sanitizeLogData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLogData(item));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field) || lowerKey.includes(field.replace('_', ''))
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Correlation ID management
let currentCorrelationId: string | null = null;

export function setCorrelationId(id?: string): string {
  currentCorrelationId = id || uuidv4();
  return currentCorrelationId;
}

export function getCorrelationId(): string | null {
  return currentCorrelationId;
}

export function clearCorrelationId(): void {
  currentCorrelationId = null;
}

// Enhanced logging interface
export interface LogContext {
  correlationId?: string;
  component?: string;
  method?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  [key: string]: any;
}

export class ProductionLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = productionLogger;
  }

  private formatMessage(message: string, context?: LogContext): any {
    const logEntry: any = {
      message,
      correlationId: context?.correlationId || getCorrelationId(),
      timestamp: new Date().toISOString(),
    };

    if (context) {
      Object.assign(logEntry, sanitizeLogData(context));
    }

    return logEntry;
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    let errorContext: LogContext = {};
    
    if (error instanceof Error) {
      errorContext = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...context,
      };
    } else if (error && typeof error === 'object') {
      errorContext = error;
    }

    this.logger.error(this.formatMessage(message, errorContext));
  }

  http(message: string, context?: LogContext): void {
    this.logger.http(this.formatMessage(message, context));
  }

  // Request/Response logging helpers
  logRequest(req: any, context?: LogContext): void {
    const requestContext: LogContext = {
      method: req.method,
      endpoint: req.url || req.path,
      userAgent: req.headers?.['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      contentLength: req.headers?.['content-length'],
      ...context,
    };

    this.http(`Incoming ${req.method} request`, requestContext);
  }

  logResponse(req: any, res: any, duration: number, context?: LogContext): void {
    const responseContext: LogContext = {
      method: req.method,
      endpoint: req.url || req.path,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get?.('content-length'),
      ...context,
    };

    const level = res.statusCode >= 400 ? 'warn' : 'http';
    this[level](`${req.method} ${req.url} - ${res.statusCode}`, responseContext);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    const perfContext: LogContext = {
      operation,
      duration,
      performance: true,
      ...context,
    };

    if (duration > 5000) {
      this.warn(`Slow operation detected: ${operation}`, perfContext);
    } else {
      this.info(`Operation completed: ${operation}`, perfContext);
    }
  }

  // GA4 API specific logging
  logGA4Request(endpoint: string, params: any, context?: LogContext): void {
    const ga4Context: LogContext = {
      component: 'GA4_API',
      endpoint,
      params: sanitizeLogData(params),
      ...context,
    };

    this.info(`GA4 API request: ${endpoint}`, ga4Context);
  }

  logGA4Response(endpoint: string, success: boolean, duration: number, context?: LogContext): void {
    const ga4Context: LogContext = {
      component: 'GA4_API',
      endpoint,
      success,
      duration,
      ...context,
    };

    if (success) {
      this.info(`GA4 API response: ${endpoint}`, ga4Context);
    } else {
      this.error(`GA4 API failed: ${endpoint}`, ga4Context);
    }
  }

  // Health check logging
  logHealthCheck(status: string, details: any, context?: LogContext): void {
    const healthContext: LogContext = {
      component: 'HEALTH_CHECK',
      status,
      details: sanitizeLogData(details),
      ...context,
    };

    this.info(`Health check: ${status}`, healthContext);
  }

  // Authentication logging
  logAuth(action: string, success: boolean, userId?: string, context?: LogContext): void {
    const authContext: LogContext = {
      component: 'AUTH',
      action,
      success,
      userId,
      ...context,
    };

    if (success) {
      this.info(`Auth ${action} successful`, authContext);
    } else {
      this.warn(`Auth ${action} failed`, authContext);
    }
  }
}

// Create singleton instance
export const logger = new ProductionLogger();

// Export configuration info
export const loggerConfig = {
  level: LOG_LEVEL,
  environment: NODE_ENV,
  logDir: LOG_DIR,
  retentionDays: LOG_RETENTION_DAYS,
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  transports: transports.length,
};

// Graceful shutdown
export function closeLogger(): Promise<void> {
  return new Promise((resolve) => {
    productionLogger.end(() => {
      resolve();
    });
  });
}

export default logger;