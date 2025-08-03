/**
 * Adapter Error Handling System
 * 
 * This file provides comprehensive error handling, logging, and recovery
 * mechanisms for the MCP adapter system.
 */

import { 
  AdapterError,
  ErrorStrategy,
  ErrorHandlerConfig,
  AdapterMetadata,
  ValidationResult
} from './types';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error category types
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  TRANSFORMATION = 'transformation',
  NETWORK = 'network',
  PARSING = 'parsing',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system'
}

/**
 * Enhanced adapter error with additional context
 */
export class EnhancedAdapterError extends AdapterError {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly timestamp: number;
  public readonly stackTrace?: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    adapterName: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.TRANSFORMATION,
    inputData?: any,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, adapterName, inputData, originalError);
    
    this.severity = severity;
    this.category = category;
    this.timestamp = Date.now();
    this.stackTrace = originalError?.stack || this.stack;
    this.context = context;
    
    this.name = 'EnhancedAdapterError';
  }

  /**
   * Get formatted error message with context
   */
  getFormattedMessage(): string {
    return `[${this.severity.toUpperCase()}] ${this.adapterName}: ${this.message}`;
  }

  /**
   * Get error details for logging
   */
  getErrorDetails(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      adapterName: this.adapterName,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp,
      inputData: this.inputData,
      context: this.context,
      stackTrace: this.stackTrace
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.severity === ErrorSeverity.LOW || this.severity === ErrorSeverity.MEDIUM;
  }
}

/**
 * Error logger interface
 */
export interface ErrorLogger {
  log(error: EnhancedAdapterError): void;
  getErrorHistory(): EnhancedAdapterError[];
  clearHistory(): void;
}

/**
 * Console-based error logger
 */
export class ConsoleErrorLogger implements ErrorLogger {
  private errorHistory: EnhancedAdapterError[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  log(error: EnhancedAdapterError): void {
    // Add to history
    this.errorHistory.push(error);
    
    // Trim history if needed
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }

    // Log to console based on severity
    const message = error.getFormattedMessage();
    const details = error.getErrorDetails();

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨', message, details);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌', message, details);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️', message, details);
        break;
      case ErrorSeverity.LOW:
        console.info('ℹ️', message, details);
        break;
    }
  }

  getErrorHistory(): EnhancedAdapterError[] {
    return [...this.errorHistory];
  }

  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    byAdapter: Record<string, number>;
  } {
    const stats = {
      total: this.errorHistory.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      byAdapter: {} as Record<string, number>
    };

    // Initialize counters
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });
    Object.values(ErrorCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });

    // Count errors
    this.errorHistory.forEach(error => {
      stats.bySeverity[error.severity]++;
      stats.byCategory[error.category]++;
      stats.byAdapter[error.adapterName] = (stats.byAdapter[error.adapterName] || 0) + 1;
    });

    return stats;
  }
}

/**
 * Error recovery strategies
 */
export class ErrorRecoveryManager {
  private recoveryAttempts = new Map<string, number>();
  private maxRecoveryAttempts: number;

  constructor(maxRecoveryAttempts: number = 3) {
    this.maxRecoveryAttempts = maxRecoveryAttempts;
  }

  /**
   * Attempt to recover from an error
   */
  attemptRecovery<T>(
    errorKey: string,
    recoveryFunction: () => T,
    fallbackValue: T
  ): T {
    const attempts = this.recoveryAttempts.get(errorKey) || 0;
    
    if (attempts >= this.maxRecoveryAttempts) {
      console.warn(`Max recovery attempts reached for ${errorKey}, using fallback`);
      return fallbackValue;
    }

    try {
      const result = recoveryFunction();
      this.recoveryAttempts.delete(errorKey); // Reset on success
      return result;
    } catch (error) {
      this.recoveryAttempts.set(errorKey, attempts + 1);
      console.warn(`Recovery attempt ${attempts + 1} failed for ${errorKey}:`, error);
      
      if (attempts + 1 >= this.maxRecoveryAttempts) {
        return fallbackValue;
      }
      
      // Exponential backoff before next attempt
      const delay = Math.pow(2, attempts) * 100;
      setTimeout(() => {
        // In a real implementation, this would trigger another recovery attempt
      }, delay);
      
      return fallbackValue;
    }
  }

  /**
   * Reset recovery attempts for a specific key
   */
  resetRecoveryAttempts(errorKey: string): void {
    this.recoveryAttempts.delete(errorKey);
  }

  /**
   * Get recovery attempt count
   */
  getRecoveryAttempts(errorKey: string): number {
    return this.recoveryAttempts.get(errorKey) || 0;
  }
}

/**
 * Comprehensive error handler for adapters
 */
export class AdapterErrorHandler {
  private logger: ErrorLogger;
  private recoveryManager: ErrorRecoveryManager;
  private config: ErrorHandlerConfig;

  constructor(
    config: ErrorHandlerConfig = { strategy: 'return-default' },
    logger?: ErrorLogger,
    recoveryManager?: ErrorRecoveryManager
  ) {
    this.config = config;
    this.logger = logger || new ConsoleErrorLogger();
    this.recoveryManager = recoveryManager || new ErrorRecoveryManager();
  }

  /**
   * Handle an error based on the configured strategy
   */
  handleError<T>(
    error: Error | EnhancedAdapterError,
    adapterName: string,
    fallbackValue: T,
    inputData?: any,
    context?: Record<string, any>
  ): T {
    const enhancedError = this.enhanceError(error, adapterName, inputData, context);
    
    // Log the error
    if (this.config.logErrors !== false) {
      this.logger.log(enhancedError);
    }

    // Call custom error handler if provided
    if (this.config.onError) {
      try {
        this.config.onError(enhancedError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Apply error handling strategy
    switch (this.config.strategy) {
      case 'throw':
        throw enhancedError;
      
      case 'return-default':
        return fallbackValue;
      
      case 'return-null':
        return null as T;
      
      case 'log-and-continue':
        return fallbackValue;
      
      default:
        return fallbackValue;
    }
  }

  /**
   * Handle validation errors specifically
   */
  handleValidationError<T>(
    validationResult: ValidationResult,
    adapterName: string,
    fallbackValue: T,
    inputData?: any
  ): T {
    if (validationResult.isValid) {
      return fallbackValue; // This shouldn't happen, but just in case
    }

    const errorMessage = `Validation failed: ${validationResult.errors.join(', ')}`;
    const error = new EnhancedAdapterError(
      errorMessage,
      adapterName,
      ErrorSeverity.MEDIUM,
      ErrorCategory.VALIDATION,
      inputData,
      undefined,
      { validationResult }
    );

    return this.handleError(error, adapterName, fallbackValue, inputData);
  }

  /**
   * Attempt recovery with fallback
   */
  attemptRecovery<T>(
    errorKey: string,
    recoveryFunction: () => T,
    fallbackValue: T,
    adapterName: string
  ): T {
    return this.recoveryManager.attemptRecovery(
      `${adapterName}-${errorKey}`,
      recoveryFunction,
      fallbackValue
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    if (this.logger instanceof ConsoleErrorLogger) {
      return this.logger.getErrorStats();
    }
    return null;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.logger.clearHistory();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Enhance a basic error with additional context
   */
  private enhanceError(
    error: Error | EnhancedAdapterError,
    adapterName: string,
    inputData?: any,
    context?: Record<string, any>
  ): EnhancedAdapterError {
    if (error instanceof EnhancedAdapterError) {
      return error;
    }

    // Determine error category and severity based on error type and message
    const { category, severity } = this.categorizeError(error);

    return new EnhancedAdapterError(
      error.message,
      adapterName,
      severity,
      category,
      inputData,
      error,
      context
    );
  }

  /**
   * Categorize error based on type and message
   */
  private categorizeError(error: Error): { category: ErrorCategory; severity: ErrorSeverity } {
    const message = error.message.toLowerCase();

    // Determine category
    let category = ErrorCategory.SYSTEM;
    if (message.includes('validation') || message.includes('invalid')) {
      category = ErrorCategory.VALIDATION;
    } else if (message.includes('parse') || message.includes('json') || message.includes('format')) {
      category = ErrorCategory.PARSING;
    } else if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      category = ErrorCategory.NETWORK;
    } else if (message.includes('config') || message.includes('setting')) {
      category = ErrorCategory.CONFIGURATION;
    } else if (message.includes('transform') || message.includes('convert')) {
      category = ErrorCategory.TRANSFORMATION;
    }

    // Determine severity
    let severity = ErrorSeverity.MEDIUM;
    if (error instanceof TypeError || error instanceof ReferenceError) {
      severity = ErrorSeverity.HIGH;
    } else if (message.includes('critical') || message.includes('fatal')) {
      severity = ErrorSeverity.CRITICAL;
    } else if (message.includes('warn') || message.includes('minor')) {
      severity = ErrorSeverity.LOW;
    }

    return { category, severity };
  }
}

/**
 * Default error handler instance
 */
export const defaultErrorHandler = new AdapterErrorHandler();

/**
 * Convenience function to handle errors with the default handler
 */
export function handleAdapterError<T>(
  error: Error,
  adapterName: string,
  fallbackValue: T,
  inputData?: any,
  context?: Record<string, any>
): T {
  return defaultErrorHandler.handleError(error, adapterName, fallbackValue, inputData, context);
}

/**
 * Create a specialized error handler for an adapter
 */
export function createAdapterErrorHandler(
  adapterMetadata: AdapterMetadata,
  config?: ErrorHandlerConfig
): (error: Error, fallbackValue: any, inputData?: any) => any {
  const errorHandler = new AdapterErrorHandler(config);
  
  return (error: Error, fallbackValue: any, inputData?: any) => {
    return errorHandler.handleError(
      error,
      adapterMetadata.name,
      fallbackValue,
      inputData,
      { adapterMetadata }
    );
  };
}