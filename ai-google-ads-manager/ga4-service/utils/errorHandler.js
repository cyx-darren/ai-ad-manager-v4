/**
 * Comprehensive Error Handling System
 * Subtask 5.5.1: Custom error classes, retry logic, and enhanced error handling
 */

const logger = require('./logger');

/**
 * Base error class for all GA4 service errors
 */
class GA4ServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.retryable = false;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

/**
 * Authentication and authorization errors
 */
class GA4AuthError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_AUTH_ERROR', details);
    this.retryable = false; // Auth errors usually aren't retryable
  }
}

/**
 * Rate limiting and throttling errors
 */
class GA4RateLimitError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_RATE_LIMIT_ERROR', details);
    this.retryable = true; // Rate limit errors are typically retryable after waiting
  }
}

/**
 * API quota and rate limiting errors
 */
class GA4QuotaError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_QUOTA_ERROR', details);
    this.retryable = true; // Quota errors can be retried after delay
    this.retryAfter = details.retryAfter || 60; // Default 60 seconds
  }
}

/**
 * Network and connectivity errors
 */
class GA4NetworkError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_NETWORK_ERROR', details);
    this.retryable = true; // Network errors are usually retryable
  }
}

/**
 * API validation and parameter errors
 */
class GA4ValidationError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_VALIDATION_ERROR', details);
    this.retryable = false; // Validation errors aren't retryable without fixing params
  }
}

/**
 * Timeout errors
 */
class GA4TimeoutError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_TIMEOUT_ERROR', details);
    this.retryable = true; // Timeouts can be retried
  }
}

/**
 * Cache-related errors
 */
class GA4CacheError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_CACHE_ERROR', details);
    this.retryable = false; // Cache errors should gracefully degrade, not retry
  }
}

/**
 * Configuration errors
 */
class GA4ConfigError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_CONFIG_ERROR', details);
    this.retryable = false; // Config errors need manual intervention
  }
}

/**
 * Data processing errors
 */
class GA4DataError extends GA4ServiceError {
  constructor(message, details = {}) {
    super(message, 'GA4_DATA_ERROR', details);
    this.retryable = false; // Data processing errors usually indicate bad data
  }
}

/**
 * Exponential backoff retry mechanism
 */
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.jitter = options.jitter !== false; // Add randomization by default
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }

  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry(fn, context = {}) {
    let lastError;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        logger.debug(`Attempting operation (attempt ${attempt + 1}/${this.maxRetries + 1})`, {
          context,
          attempt
        });

        const result = await fn();
        
        if (attempt > 0) {
          logger.info(`Operation succeeded after ${attempt} retries`, {
            context,
            totalAttempts: attempt + 1
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        // Convert raw errors to our custom error types
        const customError = this.classifyError(error, context);
        
        logger.warn(`Operation failed (attempt ${attempt}/${this.maxRetries + 1})`, {
          error: customError.toJSON(),
          context,
          attempt,
          retryable: customError.retryable
        });

        // Don't retry if error is not retryable or we've exhausted retries
        if (!customError.retryable || attempt > this.maxRetries) {
          logger.error(`Operation failed permanently after ${attempt} attempts`, {
            error: customError.toJSON(),
            context,
            totalAttempts: attempt
          });
          throw customError;
        }

        // Calculate delay for next retry
        const delay = this.calculateDelay(attempt, customError);
        
        logger.info(`Retrying operation after ${delay}ms delay`, {
          context,
          attempt,
          delay,
          nextAttempt: attempt + 1
        });

        await this.sleep(delay);
      }
    }

    // This shouldn't be reached, but just in case
    throw this.classifyError(lastError, context);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateDelay(attempt, error) {
    // Use custom retry delay if specified (e.g., from quota errors)
    if (error instanceof GA4QuotaError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Calculate exponential backoff
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Classify generic errors into our custom error types
   */
  classifyError(error, context = {}) {
    // If already a custom error, return as-is
    if (error instanceof GA4ServiceError) {
      return error;
    }

    const errorMessage = error.message || 'Unknown error';
    const errorDetails = {
      originalError: error.name,
      originalMessage: errorMessage,
      context,
      stack: error.stack
    };

    // Authentication/Authorization errors
    if (errorMessage.includes('PERMISSION_DENIED') || 
        errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('invalid_client') ||
        errorMessage.includes('unauthorized')) {
      return new GA4AuthError(
        this.getAuthErrorMessage(errorMessage),
        errorDetails
      );
    }

    // Quota/Rate limiting errors
    if (errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('quotaExceeded') ||
        errorMessage.includes('rateLimitExceeded') ||
        errorMessage.includes('429')) {
      return new GA4QuotaError(
        'API quota exceeded. Please try again later.',
        { ...errorDetails, retryAfter: this.extractRetryAfter(error) }
      );
    }

    // Network/Connectivity errors
    if (errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('network') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND') {
      return new GA4NetworkError(
        'Network error occurred. Please check connectivity.',
        errorDetails
      );
    }

    // Timeout errors
    if (errorMessage.includes('DEADLINE_EXCEEDED') ||
        errorMessage.includes('timeout') ||
        error.code === 'ETIMEDOUT') {
      return new GA4TimeoutError(
        'Request timed out. Please try again.',
        errorDetails
      );
    }

    // Validation errors
    if (errorMessage.includes('INVALID_ARGUMENT') ||
        errorMessage.includes('NOT_FOUND') ||
        errorMessage.includes('validation') ||
        errorMessage.includes('invalid')) {
      return new GA4ValidationError(
        this.getValidationErrorMessage(errorMessage),
        errorDetails
      );
    }

    // Configuration errors
    if (errorMessage.includes('credentials') ||
        errorMessage.includes('key') ||
        errorMessage.includes('config')) {
      return new GA4ConfigError(
        'Configuration error. Please check service credentials.',
        errorDetails
      );
    }

    // Default to generic service error (retryable)
    return new GA4ServiceError(
      `GA4 service error: ${errorMessage}`,
      'GA4_GENERIC_ERROR',
      { ...errorDetails, retryable: true }
    );
  }

  /**
   * Get user-friendly auth error message
   */
  getAuthErrorMessage(originalMessage) {
    if (originalMessage.includes('PERMISSION_DENIED')) {
      return 'Access denied: Check that the service account has access to the GA4 property';
    }
    if (originalMessage.includes('UNAUTHENTICATED')) {
      return 'Authentication failed: Check service account credentials';
    }
    return 'Authentication error: Please verify your credentials and permissions';
  }

  /**
   * Get user-friendly validation error message
   */
  getValidationErrorMessage(originalMessage) {
    if (originalMessage.includes('NOT_FOUND')) {
      return 'GA4 property not found: Verify the property ID exists and is accessible';
    }
    if (originalMessage.includes('INVALID_ARGUMENT')) {
      return 'Invalid request parameters: Check property ID and date range format';
    }
    return 'Validation error: Please check your request parameters';
  }

  /**
   * Extract retry-after value from error headers
   */
  extractRetryAfter(error) {
    // Try to extract from error headers if available
    if (error.response && error.response.headers) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? 60 : seconds;
      }
    }
    
    // Default retry delay for quota errors
    return 60;
  }
}

/**
 * Global error handler with enhanced logging and monitoring
 */
class ErrorHandler {
  constructor() {
    this.retryManager = new RetryManager();
    this.errorStats = {
      total: 0,
      byType: {},
      byCode: {},
      retried: 0,
      recovered: 0
    };
  }

  /**
   * Handle error with retry logic and monitoring
   */
  async handleWithRetry(fn, context = {}, retryOptions = {}) {
    const retryManager = new RetryManager(retryOptions);
    
    try {
      const result = await retryManager.executeWithRetry(fn, context);
      
      // Track recovery if this was a retry
      if (context.isRetry) {
        this.errorStats.recovered++;
      }
      
      return result;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  /**
   * Handle error without retry (immediate failure)
   */
  handleError(error, context = {}) {
    const customError = this.retryManager.classifyError(error, context);
    this.recordError(customError);
    
    logger.error('Error handled without retry', {
      error: customError.toJSON(),
      context
    });
    
    return customError;
  }

  /**
   * Record error statistics
   */
  recordError(error) {
    this.errorStats.total++;
    
    const errorType = error.constructor.name;
    this.errorStats.byType[errorType] = (this.errorStats.byType[errorType] || 0) + 1;
    
    if (error.code) {
      this.errorStats.byCode[error.code] = (this.errorStats.byCode[error.code] || 0) + 1;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset error statistics
   */
  resetErrorStats() {
    this.errorStats = {
      total: 0,
      byType: {},
      byCode: {},
      retried: 0,
      recovered: 0
    };
  }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

module.exports = {
  GA4ServiceError,
  GA4AuthError,
  GA4QuotaError,
  GA4NetworkError,
  GA4ValidationError,
  GA4TimeoutError,
  GA4CacheError,
  GA4ConfigError,
  GA4DataError,
  GA4RateLimitError,
  RetryManager,
  ErrorHandler,
  errorHandler
};