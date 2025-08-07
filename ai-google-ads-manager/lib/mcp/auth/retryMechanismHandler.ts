import {
  RetryMechanismConfig,
  RetryAttempt,
  CircuitBreakerState,
  CircuitBreakerStatus,
  MCPAuthError,
  MCPAuthErrorType
} from './authTypes';

/**
 * Retry Mechanism Handler for Phase 6
 * Intelligent retry logic with circuit breakers and backoff strategies
 */
export class RetryMechanismHandler {
  private config: RetryMechanismConfig;
  private circuitBreaker: CircuitBreakerStatus;
  private retryHistory: Map<string, RetryAttempt[]> = new Map();
  private lastRequestTime: number = 0;

  constructor(config: RetryMechanismConfig) {
    this.config = config;
    
    // Initialize circuit breaker
    this.circuitBreaker = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      errorRate: 0,
      stateChangedAt: Date.now()
    };
  }

  // ============================================================================
  // PHASE 6: RETRY MECHANISM WITH CIRCUIT BREAKER
  // ============================================================================

  /**
   * Execute operation with retry logic and circuit breaker protection
   */
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<{ success: boolean; result?: T; error?: MCPAuthError; attempts: RetryAttempt[] }> {
    if (!this.config.enableRetryMechanism) {
      try {
        const result = await operation();
        return { success: true, result, attempts: [] };
      } catch (error) {
        return { 
          success: false, 
          error: this.convertToMCPAuthError(error), 
          attempts: [] 
        };
      }
    }

    // Check circuit breaker state
    if (this.circuitBreaker.state === CircuitBreakerState.OPEN) {
      const canRetry = this.canRetryInOpenCircuit();
      if (!canRetry) {
        return {
          success: false,
          error: new MCPAuthError(
            MCPAuthErrorType.NETWORK_ERROR,
            'Circuit breaker is open - too many failures'
          ),
          attempts: []
        };
      }
    }

    const attempts: RetryAttempt[] = [];
    let lastError: MCPAuthError | null = null;

    for (let attemptNumber = 1; attemptNumber <= this.config.maxRetryAttempts + 1; attemptNumber++) {
      const attempt: RetryAttempt = {
        attemptNumber,
        startTime: Date.now(),
        delay: attemptNumber === 1 ? 0 : this.calculateDelay(attemptNumber - 1),
        backoffStrategy: this.config.retryBackoffStrategy,
        success: false,
        context
      };

      try {
        // Apply delay for retry attempts
        if (attempt.delay > 0) {
          await this.sleep(attempt.delay);
        }

        // Execute the operation
        const result = await operation();
        
        // Success
        attempt.endTime = Date.now();
        attempt.success = true;
        attempts.push(attempt);

        // Update circuit breaker on success
        this.onOperationSuccess();

        // Store retry history
        this.storeRetryHistory(operationId, attempts);

        return { success: true, result, attempts };

      } catch (error) {
        const authError = this.convertToMCPAuthError(error);
        attempt.endTime = Date.now();
        attempt.error = authError;
        attempt.success = false;
        attempts.push(attempt);

        lastError = authError;

        // Update circuit breaker on failure
        this.onOperationFailure();

        // Check if error is retryable
        if (!this.isRetryableError(authError)) {
          break;
        }

        // Check if we should continue retrying
        if (attemptNumber > this.config.maxRetryAttempts) {
          break;
        }

        // Check circuit breaker state after failure
        if (this.circuitBreaker.state === CircuitBreakerState.OPEN) {
          break;
        }
      }
    }

    // Store retry history for failed operation
    this.storeRetryHistory(operationId, attempts);

    return { 
      success: false, 
      error: lastError || new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, 'Operation failed'),
      attempts 
    };
  }

  /**
   * Calculate delay for retry attempt based on backoff strategy
   */
  private calculateDelay(attemptNumber: number): number {
    let delay: number;

    switch (this.config.retryBackoffStrategy) {
      case 'exponential':
        delay = Math.min(
          this.config.baseRetryDelay * Math.pow(2, attemptNumber - 1),
          this.config.maxRetryDelay
        );
        break;

      case 'linear':
        delay = Math.min(
          this.config.baseRetryDelay * attemptNumber,
          this.config.maxRetryDelay
        );
        break;

      case 'fixed':
        delay = this.config.baseRetryDelay;
        break;

      case 'jitter':
        const exponentialDelay = Math.min(
          this.config.baseRetryDelay * Math.pow(2, attemptNumber - 1),
          this.config.maxRetryDelay
        );
        
        if (this.config.enableRetryJitter) {
          const jitter = exponentialDelay * this.config.jitterFactor * Math.random();
          delay = exponentialDelay + jitter;
        } else {
          delay = exponentialDelay;
        }
        break;

      default:
        delay = this.config.baseRetryDelay;
    }

    return Math.floor(delay);
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private isRetryableError(error: MCPAuthError): boolean {
    // Check non-retryable errors first
    if (this.config.nonRetryableErrors.includes(error.type)) {
      return false;
    }

    // Check retryable errors
    if (this.config.retryableErrors.length > 0) {
      return this.config.retryableErrors.includes(error.type);
    }

    // Default retryable errors
    const defaultRetryableErrors = [
      MCPAuthErrorType.NETWORK_ERROR,
      MCPAuthErrorType.SUPABASE_ERROR,
      MCPAuthErrorType.REFRESH_FAILED,
      MCPAuthErrorType.UNKNOWN_ERROR
    ];

    return defaultRetryableErrors.includes(error.type);
  }

  /**
   * Handle successful operation for circuit breaker
   */
  private onOperationSuccess(): void {
    this.circuitBreaker.successCount++;
    this.circuitBreaker.totalRequests++;
    this.lastRequestTime = Date.now();

    // Reset failure count if circuit was closed
    if (this.circuitBreaker.state === CircuitBreakerState.CLOSED) {
      this.circuitBreaker.failureCount = 0;
    }

    // Transition from HALF_OPEN to CLOSED after success
    if (this.circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreaker.state = CircuitBreakerState.CLOSED;
      this.circuitBreaker.stateChangedAt = Date.now();
      this.circuitBreaker.failureCount = 0;
    }

    this.updateCircuitBreakerMetrics();
  }

  /**
   * Handle failed operation for circuit breaker
   */
  private onOperationFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.totalRequests++;
    this.lastRequestTime = Date.now();
    this.circuitBreaker.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (this.circuitBreaker.state === CircuitBreakerState.CLOSED &&
        this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = CircuitBreakerState.OPEN;
      this.circuitBreaker.stateChangedAt = Date.now();
      this.circuitBreaker.nextRetryTime = Date.now() + this.config.circuitBreakerTimeout;
    }

    // Transition from HALF_OPEN back to OPEN on failure
    if (this.circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreaker.state = CircuitBreakerState.OPEN;
      this.circuitBreaker.stateChangedAt = Date.now();
      this.circuitBreaker.nextRetryTime = Date.now() + this.config.circuitBreakerTimeout;
    }

    this.updateCircuitBreakerMetrics();
  }

  /**
   * Update circuit breaker error rate metrics
   */
  private updateCircuitBreakerMetrics(): void {
    if (this.circuitBreaker.totalRequests > 0) {
      this.circuitBreaker.errorRate = this.circuitBreaker.failureCount / this.circuitBreaker.totalRequests;
    }
  }

  /**
   * Check if we can retry when circuit is open
   */
  private canRetryInOpenCircuit(): boolean {
    const now = Date.now();
    
    if (this.circuitBreaker.nextRetryTime && now >= this.circuitBreaker.nextRetryTime) {
      // Transition to HALF_OPEN for testing
      this.circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
      this.circuitBreaker.stateChangedAt = now;
      this.circuitBreaker.nextRetryTime = undefined;
      return true;
    }

    return false;
  }

  /**
   * Convert any error to MCPAuthError
   */
  private convertToMCPAuthError(error: any): MCPAuthError {
    if (error instanceof MCPAuthError) {
      return error;
    }

    if (error instanceof Error) {
      return new MCPAuthError(
        MCPAuthErrorType.UNKNOWN_ERROR,
        error.message,
        error
      );
    }

    return new MCPAuthError(
      MCPAuthErrorType.UNKNOWN_ERROR,
      String(error),
      error
    );
  }

  /**
   * Store retry history for analysis
   */
  private storeRetryHistory(operationId: string, attempts: RetryAttempt[]): void {
    this.retryHistory.set(operationId, attempts);

    // Keep only recent history (last 100 operations)
    if (this.retryHistory.size > 100) {
      const oldestKey = this.retryHistory.keys().next().value;
      this.retryHistory.delete(oldestKey);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerStatus {
    return { ...this.circuitBreaker };
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageRetryAttempts: number;
    circuitBreakerTrips: number;
    averageDelayMs: number;
    retryStrategies: Record<string, number>;
  } {
    const allAttempts = Array.from(this.retryHistory.values()).flat();
    const operations = Array.from(this.retryHistory.values());
    
    const totalOperations = operations.length;
    const successfulOperations = operations.filter(attempts => 
      attempts.some(attempt => attempt.success)
    ).length;
    const failedOperations = totalOperations - successfulOperations;

    const totalRetryAttempts = allAttempts.length;
    const averageRetryAttempts = totalOperations > 0 ? totalRetryAttempts / totalOperations : 0;

    const totalDelay = allAttempts.reduce((sum, attempt) => sum + attempt.delay, 0);
    const averageDelayMs = allAttempts.length > 0 ? totalDelay / allAttempts.length : 0;

    const retryStrategies: Record<string, number> = {};
    allAttempts.forEach(attempt => {
      retryStrategies[attempt.backoffStrategy] = (retryStrategies[attempt.backoffStrategy] || 0) + 1;
    });

    // Estimate circuit breaker trips (state changes to OPEN)
    const circuitBreakerTrips = Math.floor(this.circuitBreaker.failureCount / this.config.circuitBreakerThreshold);

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageRetryAttempts,
      circuitBreakerTrips,
      averageDelayMs,
      retryStrategies
    };
  }

  /**
   * Get retry history for specific operation
   */
  getRetryHistory(operationId: string): RetryAttempt[] | undefined {
    return this.retryHistory.get(operationId);
  }

  /**
   * Get all retry history
   */
  getAllRetryHistory(): Map<string, RetryAttempt[]> {
    return new Map(this.retryHistory);
  }

  /**
   * Reset circuit breaker to closed state
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      errorRate: 0,
      stateChangedAt: Date.now()
    };
  }

  /**
   * Force circuit breaker to open state (for testing)
   */
  forceCircuitBreakerOpen(): void {
    this.circuitBreaker.state = CircuitBreakerState.OPEN;
    this.circuitBreaker.stateChangedAt = Date.now();
    this.circuitBreaker.nextRetryTime = Date.now() + this.config.circuitBreakerTimeout;
  }

  /**
   * Clear retry history
   */
  clearRetryHistory(): void {
    this.retryHistory.clear();
  }

  /**
   * Test if operation would be retried based on error
   */
  wouldRetry(error: MCPAuthError): boolean {
    if (!this.config.enableRetryMechanism) {
      return false;
    }

    if (this.circuitBreaker.state === CircuitBreakerState.OPEN && !this.canRetryInOpenCircuit()) {
      return false;
    }

    return this.isRetryableError(error);
  }

  /**
   * Get estimated wait time for next retry based on current state
   */
  getEstimatedWaitTime(attemptNumber: number = 1): number {
    if (this.circuitBreaker.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (this.circuitBreaker.nextRetryTime) {
        return Math.max(0, this.circuitBreaker.nextRetryTime - now);
      }
    }

    return this.calculateDelay(attemptNumber);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<RetryMechanismConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryMechanismConfig {
    return { ...this.config };
  }
}