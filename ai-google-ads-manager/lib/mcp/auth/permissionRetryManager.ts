/**
 * Permission Retry Manager
 * 
 * This file provides intelligent retry mechanisms for permission-related failures
 * with exponential backoff, conditional retry logic, and circuit breaker patterns.
 */

import {
  GA4Operation,
  PermissionErrorType,
  PermissionError,
  ScopeValidationError
} from './permissionTypes';

import {
  PermissionErrorCategory,
  PermissionErrorSeverity,
  PermissionErrorInfo,
  ERROR_TYPE_CLASSIFICATIONS
} from './permissionErrorHandler';

// ============================================================================
// RETRY STRATEGY TYPES
// ============================================================================

/**
 * Retry strategy types
 */
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_DELAY = 'fixed_delay',
  IMMEDIATE = 'immediate',
  NO_RETRY = 'no_retry'
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Retry strategy to use */
  strategy: RetryStrategy;
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier for exponential strategy */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: number;
  /** Timeout for each attempt in milliseconds */
  attemptTimeout: number;
  /** Total timeout for all attempts */
  totalTimeout: number;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** When attempt started */
  startTime: number;
  /** When attempt completed */
  endTime?: number;
  /** Whether attempt succeeded */
  success: boolean;
  /** Error if attempt failed */
  error?: Error;
  /** Delay before this attempt */
  delay: number;
  /** Total time elapsed so far */
  totalElapsed: number;
}

/**
 * Retry result
 */
export interface RetryResult<T = any> {
  /** Whether retry succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Final error if all attempts failed */
  error?: Error;
  /** All retry attempts */
  attempts: RetryAttempt[];
  /** Total time spent retrying */
  totalTime: number;
  /** Strategy used */
  strategy: RetryStrategy;
  /** Configuration used */
  config: RetryConfig;
}

/**
 * Retry condition function
 */
export type RetryCondition = (
  error: Error,
  attemptNumber: number,
  totalElapsed: number
) => boolean;

/**
 * Retry manager configuration
 */
export interface RetryManagerConfig {
  /** Default retry configurations by error type */
  defaultConfigs: Map<PermissionErrorType, RetryConfig>;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: number;
  /** Circuit breaker timeout */
  circuitBreakerTimeout: number;
  /** Enable retry analytics */
  enableAnalytics: boolean;
  /** Enable success probability calculation */
  enableProbabilityCalculation: boolean;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, blocking requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Circuit breaker information
 */
export interface CircuitBreakerInfo {
  /** Current state */
  state: CircuitBreakerState;
  /** Failure count */
  failureCount: number;
  /** Last failure time */
  lastFailureTime?: number;
  /** Next attempt time when in OPEN state */
  nextAttemptTime?: number;
  /** Success count in HALF_OPEN state */
  halfOpenSuccessCount: number;
}

/**
 * Retry analytics
 */
export interface RetryAnalytics {
  /** Total retry attempts */
  totalAttempts: number;
  /** Successful retries */
  successfulRetries: number;
  /** Failed retries */
  failedRetries: number;
  /** Success rate by error type */
  successRateByType: Map<PermissionErrorType, number>;
  /** Average attempts per retry */
  averageAttempts: number;
  /** Average total time per retry */
  averageTotalTime: number;
}

// ============================================================================
// DEFAULT RETRY CONFIGURATIONS
// ============================================================================

/**
 * Default retry configurations for different error types
 */
export const DEFAULT_RETRY_CONFIGS: Map<PermissionErrorType, RetryConfig> = new Map([
  [PermissionErrorType.TOKEN_EXPIRED, {
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    attemptTimeout: 30000,
    totalTimeout: 60000
  }],

  [PermissionErrorType.RATE_LIMITED, {
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxAttempts: 5,
    baseDelay: 5000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    attemptTimeout: 30000,
    totalTimeout: 300000 // 5 minutes
  }],

  [PermissionErrorType.NETWORK_ERROR, {
    strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxAttempts: 4,
    baseDelay: 500,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    attemptTimeout: 15000,
    totalTimeout: 60000
  }],

  [PermissionErrorType.VALIDATION_ERROR, {
    strategy: RetryStrategy.FIXED_DELAY,
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 1000,
    backoffMultiplier: 1,
    jitterFactor: 0.1,
    attemptTimeout: 10000,
    totalTimeout: 30000
  }],

  [PermissionErrorType.MIDDLEWARE_ERROR, {
    strategy: RetryStrategy.LINEAR_BACKOFF,
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.1,
    attemptTimeout: 20000,
    totalTimeout: 60000
  }],

  // Non-retryable errors
  [PermissionErrorType.INSUFFICIENT_PERMISSION, {
    strategy: RetryStrategy.NO_RETRY,
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitterFactor: 0,
    attemptTimeout: 0,
    totalTimeout: 0
  }],

  [PermissionErrorType.INSUFFICIENT_SCOPE, {
    strategy: RetryStrategy.NO_RETRY,
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitterFactor: 0,
    attemptTimeout: 0,
    totalTimeout: 0
  }],

  [PermissionErrorType.INVALID_TOKEN, {
    strategy: RetryStrategy.NO_RETRY,
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitterFactor: 0,
    attemptTimeout: 0,
    totalTimeout: 0
  }]
]);

// ============================================================================
// PERMISSION RETRY MANAGER CLASS
// ============================================================================

/**
 * Intelligent permission retry manager
 */
export class PermissionRetryManager {
  private config: RetryManagerConfig;
  private circuitBreakers: Map<string, CircuitBreakerInfo> = new Map();
  private analytics: RetryAnalytics;

  constructor(config?: Partial<RetryManagerConfig>) {
    this.config = {
      defaultConfigs: DEFAULT_RETRY_CONFIGS,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
      enableAnalytics: true,
      enableProbabilityCalculation: true,
      ...config
    };

    this.analytics = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      successRateByType: new Map(),
      averageAttempts: 0,
      averageTotalTime: 0
    };
  }

  /**
   * Execute operation with intelligent retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    errorInfo: PermissionErrorInfo,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = this.getRetryConfig(errorInfo.type, customConfig);
    const circuitBreakerKey = this.getCircuitBreakerKey(errorInfo);

    // Check circuit breaker
    if (this.config.enableCircuitBreaker && this.isCircuitOpen(circuitBreakerKey)) {
      return {
        success: false,
        error: new Error('Circuit breaker is open'),
        attempts: [],
        totalTime: 0,
        strategy: config.strategy,
        config
      };
    }

    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error | undefined;

    // No retry for certain strategies
    if (config.strategy === RetryStrategy.NO_RETRY || config.maxAttempts === 0) {
      try {
        const data = await operation();
        return {
          success: true,
          data,
          attempts: [],
          totalTime: Date.now() - startTime,
          strategy: config.strategy,
          config
        };
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          attempts: [],
          totalTime: Date.now() - startTime,
          strategy: config.strategy,
          config
        };
      }
    }

    // Retry loop
    for (let attemptNumber = 1; attemptNumber <= config.maxAttempts; attemptNumber++) {
      const totalElapsed = Date.now() - startTime;

      // Check total timeout
      if (totalElapsed >= config.totalTimeout) {
        break;
      }

      // Calculate delay
      const delay = attemptNumber === 1 ? 0 : this.calculateDelay(
        config,
        attemptNumber - 1
      );

      // Wait for delay
      if (delay > 0) {
        await this.sleep(delay);
      }

      const attemptStartTime = Date.now();
      let attemptSuccess = false;
      let attemptError: Error | undefined;

      try {
        // Execute with timeout
        const data = await this.executeWithTimeout(operation, config.attemptTimeout);
        attemptSuccess = true;

        // Record successful attempt
        const attempt: RetryAttempt = {
          attemptNumber,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: true,
          delay,
          totalElapsed: Date.now() - startTime
        };
        attempts.push(attempt);

        // Update circuit breaker
        if (this.config.enableCircuitBreaker) {
          this.recordCircuitBreakerSuccess(circuitBreakerKey);
        }

        // Update analytics
        if (this.config.enableAnalytics) {
          this.updateAnalytics(errorInfo.type, true, attempts.length, Date.now() - startTime);
        }

        return {
          success: true,
          data,
          attempts,
          totalTime: Date.now() - startTime,
          strategy: config.strategy,
          config
        };

      } catch (error) {
        attemptError = error as Error;
        lastError = attemptError;

        // Record failed attempt
        const attempt: RetryAttempt = {
          attemptNumber,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: false,
          error: attemptError,
          delay,
          totalElapsed: Date.now() - startTime
        };
        attempts.push(attempt);

        // Check if we should continue retrying
        if (!this.shouldRetry(attemptError, attemptNumber, Date.now() - startTime, config)) {
          break;
        }
      }
    }

    // All attempts failed
    if (this.config.enableCircuitBreaker) {
      this.recordCircuitBreakerFailure(circuitBreakerKey);
    }

    if (this.config.enableAnalytics) {
      this.updateAnalytics(errorInfo.type, false, attempts.length, Date.now() - startTime);
    }

    return {
      success: false,
      error: lastError || new Error('All retry attempts failed'),
      attempts,
      totalTime: Date.now() - startTime,
      strategy: config.strategy,
      config
    };
  }

  /**
   * Calculate success probability for retry
   */
  public calculateSuccessProbability(errorType: PermissionErrorType): number {
    if (!this.config.enableProbabilityCalculation) {
      return 0.5; // Default probability
    }

    const successRate = this.analytics.successRateByType.get(errorType);
    if (successRate === undefined) {
      // Return base probability based on error type
      return this.getBaseProbability(errorType);
    }

    return successRate;
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(key: string): CircuitBreakerInfo | null {
    return this.circuitBreakers.get(key) || null;
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(key: string): void {
    this.circuitBreakers.delete(key);
  }

  /**
   * Get retry analytics
   */
  public getAnalytics(): RetryAnalytics {
    return { ...this.analytics };
  }

  /**
   * Clear analytics
   */
  public clearAnalytics(): void {
    this.analytics = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      successRateByType: new Map(),
      averageAttempts: 0,
      averageTotalTime: 0
    };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Get retry configuration for error type
   */
  private getRetryConfig(
    errorType: PermissionErrorType,
    customConfig?: Partial<RetryConfig>
  ): RetryConfig {
    const defaultConfig = this.config.defaultConfigs.get(errorType) || {
      strategy: RetryStrategy.NO_RETRY,
      maxAttempts: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      attemptTimeout: 10000,
      totalTimeout: 30000
    };

    return { ...defaultConfig, ...customConfig };
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(config: RetryConfig, attemptNumber: number): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
        break;

      case RetryStrategy.LINEAR_BACKOFF:
        delay = config.baseDelay * attemptNumber;
        break;

      case RetryStrategy.FIXED_DELAY:
        delay = config.baseDelay;
        break;

      case RetryStrategy.IMMEDIATE:
        delay = 0;
        break;

      default:
        delay = config.baseDelay;
    }

    // Apply maximum delay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter
    if (config.jitterFactor > 0) {
      const jitter = delay * config.jitterFactor * Math.random();
      delay += jitter;
    }

    return Math.floor(delay);
  }

  /**
   * Check if should retry
   */
  private shouldRetry(
    error: Error,
    attemptNumber: number,
    totalElapsed: number,
    config: RetryConfig
  ): boolean {
    // Check if more attempts available
    if (attemptNumber >= config.maxAttempts) {
      return false;
    }

    // Check total timeout
    if (totalElapsed >= config.totalTimeout) {
      return false;
    }

    // Check if error is retryable (could add more sophisticated logic here)
    return true;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout);
      })
    ]);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker key
   */
  private getCircuitBreakerKey(errorInfo: PermissionErrorInfo): string {
    return `${errorInfo.type}-${errorInfo.context.operation}`;
  }

  /**
   * Check if circuit is open
   */
  private isCircuitOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return false;

    if (breaker.state === CircuitBreakerState.OPEN) {
      if (breaker.nextAttemptTime && Date.now() >= breaker.nextAttemptTime) {
        // Transition to half-open
        breaker.state = CircuitBreakerState.HALF_OPEN;
        breaker.halfOpenSuccessCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      breaker.halfOpenSuccessCount++;
      if (breaker.halfOpenSuccessCount >= 2) {
        // Transition to closed
        breaker.state = CircuitBreakerState.CLOSED;
        breaker.failureCount = 0;
      }
    } else if (breaker.state === CircuitBreakerState.CLOSED) {
      breaker.failureCount = 0;
    }
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(key: string): void {
    let breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      breaker = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        halfOpenSuccessCount: 0
      };
      this.circuitBreakers.set(key, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
      breaker.state = CircuitBreakerState.OPEN;
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
    }
  }

  /**
   * Update retry analytics
   */
  private updateAnalytics(
    errorType: PermissionErrorType,
    success: boolean,
    attempts: number,
    totalTime: number
  ): void {
    this.analytics.totalAttempts += attempts;

    if (success) {
      this.analytics.successfulRetries++;
    } else {
      this.analytics.failedRetries++;
    }

    // Update success rate by type
    const currentRate = this.analytics.successRateByType.get(errorType) || 0;
    const currentCount = (this.analytics.successfulRetries + this.analytics.failedRetries);
    const newRate = currentCount === 1 
      ? (success ? 1 : 0)
      : (currentRate * (currentCount - 1) + (success ? 1 : 0)) / currentCount;
    
    this.analytics.successRateByType.set(errorType, newRate);

    // Update averages
    const totalRetries = this.analytics.successfulRetries + this.analytics.failedRetries;
    this.analytics.averageAttempts = this.analytics.totalAttempts / totalRetries;
    this.analytics.averageTotalTime = 
      (this.analytics.averageTotalTime * (totalRetries - 1) + totalTime) / totalRetries;
  }

  /**
   * Get base probability for error type
   */
  private getBaseProbability(errorType: PermissionErrorType): number {
    switch (errorType) {
      case PermissionErrorType.TOKEN_EXPIRED:
        return 0.9;
      case PermissionErrorType.RATE_LIMITED:
        return 0.8;
      case PermissionErrorType.NETWORK_ERROR:
        return 0.7;
      case PermissionErrorType.VALIDATION_ERROR:
        return 0.6;
      case PermissionErrorType.MIDDLEWARE_ERROR:
        return 0.5;
      default:
        return 0.1; // Very low for non-retryable errors
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating retry managers
 */
export class RetryManagerFactory {
  /**
   * Create standard retry manager
   */
  public static createStandard(config?: Partial<RetryManagerConfig>): PermissionRetryManager {
    return new PermissionRetryManager(config);
  }

  /**
   * Create aggressive retry manager
   */
  public static createAggressive(): PermissionRetryManager {
    const aggressiveConfigs = new Map(DEFAULT_RETRY_CONFIGS);
    
    // Increase retry attempts for retryable errors
    aggressiveConfigs.set(PermissionErrorType.TOKEN_EXPIRED, {
      strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      attemptTimeout: 45000,
      totalTimeout: 120000
    });

    return new PermissionRetryManager({
      defaultConfigs: aggressiveConfigs,
      enableCircuitBreaker: false,
      circuitBreakerThreshold: 10,
      circuitBreakerTimeout: 30000
    });
  }

  /**
   * Create conservative retry manager
   */
  public static createConservative(): PermissionRetryManager {
    const conservativeConfigs = new Map(DEFAULT_RETRY_CONFIGS);
    
    // Reduce retry attempts
    conservativeConfigs.set(PermissionErrorType.RATE_LIMITED, {
      strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      maxAttempts: 2,
      baseDelay: 10000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      attemptTimeout: 20000,
      totalTimeout: 60000
    });

    return new PermissionRetryManager({
      defaultConfigs: conservativeConfigs,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 120000
    });
  }
}

/**
 * Create a standard retry manager
 */
export function createRetryManager(config?: Partial<RetryManagerConfig>): PermissionRetryManager {
  return RetryManagerFactory.createStandard(config);
}

/**
 * Execute operation with retry (convenience function)
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  errorInfo: PermissionErrorInfo,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const manager = createRetryManager();
  return manager.executeWithRetry(operation, errorInfo, config);
}