/**
 * Error Recovery Service
 * 
 * This file provides comprehensive error recovery mechanisms for the credential system,
 * including automated recovery strategies, failure handling, and system restoration.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
  /** Maximum number of recovery attempts */
  maxRetryAttempts: number;
  /** Base delay between retry attempts (in milliseconds) */
  baseRetryDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** Maximum delay between retries (in milliseconds) */
  maxRetryDelay: number;
  /** Whether to enable automatic recovery */
  enableAutoRecovery: boolean;
  /** Recovery timeout (in milliseconds) */
  recoveryTimeout: number;
  /** Whether to log recovery attempts */
  enableLogging: boolean;
}

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  /** Retry the failed operation */
  RETRY = 'retry',
  /** Fallback to a different approach */
  FALLBACK = 'fallback',
  /** Refresh credentials and retry */
  REFRESH_CREDENTIALS = 'refresh_credentials',
  /** Reset to a known good state */
  RESET_STATE = 'reset_state',
  /** Use cached data if available */
  USE_CACHE = 'use_cache',
  /** Gracefully degrade functionality */
  DEGRADE = 'degrade',
  /** Escalate to manual intervention */
  ESCALATE = 'escalate'
}

/**
 * Recovery attempt information
 */
export interface RecoveryAttempt {
  /** Unique attempt ID */
  attemptId: string;
  /** When the attempt was made */
  timestamp: string;
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Original error that triggered recovery */
  originalError: any;
  /** Whether the attempt was successful */
  successful: boolean;
  /** Error from the recovery attempt (if failed) */
  recoveryError?: any;
  /** Duration of the recovery attempt (in milliseconds) */
  duration: number;
  /** Additional context about the attempt */
  context: Record<string, any>;
}

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  recovered: boolean;
  /** Strategy that ultimately succeeded */
  successfulStrategy?: RecoveryStrategy;
  /** Total number of attempts made */
  totalAttempts: number;
  /** Total time spent on recovery (in milliseconds) */
  totalDuration: number;
  /** All recovery attempts made */
  attempts: RecoveryAttempt[];
  /** Final error if recovery failed */
  finalError?: any;
  /** Result data if recovery succeeded */
  recoveredData?: any;
  /** Whether manual intervention is required */
  requiresManualIntervention: boolean;
}

/**
 * System recovery status
 */
export interface SystemRecoveryStatus {
  /** Whether the system is currently in recovery mode */
  inRecovery: boolean;
  /** Number of active recovery operations */
  activeRecoveries: number;
  /** Total recoveries attempted in current session */
  totalRecoveries: number;
  /** Number of successful recoveries */
  successfulRecoveries: number;
  /** Number of failed recoveries */
  failedRecoveries: number;
  /** Average recovery time (in milliseconds) */
  averageRecoveryTime: number;
  /** Most recent recovery result */
  lastRecoveryResult?: RecoveryResult;
  /** System health score (0-100) */
  healthScore: number;
}

/**
 * Error recovery service interface
 */
export interface IErrorRecoveryService {
  /** Attempt to recover from an error */
  recover(error: any, context?: Record<string, any>): Promise<RecoveryResult>;
  
  /** Get current recovery status */
  getRecoveryStatus(): SystemRecoveryStatus;
  
  /** Register a custom recovery strategy */
  registerStrategy(strategy: RecoveryStrategy, handler: RecoveryHandler): void;
  
  /** Clear recovery history */
  clearHistory(): void;
  
  /** Update recovery configuration */
  updateConfig(config: Partial<ErrorRecoveryConfig>): void;
  
  /** Get recovery statistics */
  getStatistics(): RecoveryStatistics;
}

/**
 * Recovery handler function type
 */
export type RecoveryHandler = (
  error: any,
  context: Record<string, any>,
  attempt: number
) => Promise<{ success: boolean; data?: any; error?: any }>;

/**
 * Recovery statistics
 */
export interface RecoveryStatistics {
  /** Total number of recovery operations */
  totalOperations: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Most common error types */
  commonErrors: { [errorType: string]: number };
  /** Most effective strategies */
  strategyEffectiveness: { [strategy: string]: { attempts: number; successes: number } };
  /** Average recovery time by strategy */
  averageTimeByStrategy: { [strategy: string]: number };
}

// ============================================================================
// BROWSER ERROR RECOVERY SERVICE
// ============================================================================

/**
 * Browser-based error recovery service implementation
 */
export class BrowserErrorRecoveryService implements IErrorRecoveryService {
  private config: ErrorRecoveryConfig;
  private strategies: Map<RecoveryStrategy, RecoveryHandler> = new Map();
  private recoveryHistory: RecoveryResult[] = [];
  private activeRecoveries: Set<string> = new Set();

  constructor(config?: Partial<ErrorRecoveryConfig>) {
    this.config = {
      maxRetryAttempts: 3,
      baseRetryDelay: 1000,
      exponentialBackoff: true,
      maxRetryDelay: 10000,
      enableAutoRecovery: true,
      recoveryTimeout: 30000,
      enableLogging: true,
      ...config
    };

    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Retry strategy
    this.strategies.set(RecoveryStrategy.RETRY, async (error, context, attempt) => {
      const delay = this.calculateRetryDelay(attempt);
      await this.sleep(delay);
      
      if (context.originalOperation) {
        try {
          const result = await context.originalOperation();
          return { success: true, data: result };
        } catch (retryError) {
          return { success: false, error: retryError };
        }
      }
      
      return { success: false, error: new Error('No original operation to retry') };
    });

    // Use cache strategy
    this.strategies.set(RecoveryStrategy.USE_CACHE, async (error, context, attempt) => {
      try {
        if (context.cacheService && context.cacheKey) {
          const cachedData = await context.cacheService.get(context.cacheKey);
          if (cachedData) {
            return { success: true, data: cachedData };
          }
        }
        return { success: false, error: new Error('No cached data available') };
      } catch (cacheError) {
        return { success: false, error: cacheError };
      }
    });

    // Escalate strategy
    this.strategies.set(RecoveryStrategy.ESCALATE, async (error, context, attempt) => {
      if (this.config.enableLogging) {
        console.error('[ERROR_RECOVERY] Escalating error for manual intervention:', {
          error: error.message || String(error),
          context,
          attempt,
          timestamp: new Date().toISOString()
        });
      }
      
      return { 
        success: false, 
        error: new Error('Manual intervention required') 
      };
    });
  }

  /**
   * Main recovery method
   */
  public async recover(error: any, context: Record<string, any> = {}): Promise<RecoveryResult> {
    const recoveryId = this.generateRecoveryId();
    this.activeRecoveries.add(recoveryId);

    const startTime = Date.now();
    const attempts: RecoveryAttempt[] = [];
    
    try {
      const strategies = [RecoveryStrategy.RETRY, RecoveryStrategy.USE_CACHE, RecoveryStrategy.ESCALATE];
      let recovered = false;
      let successfulStrategy: RecoveryStrategy | undefined;
      let recoveredData: any = null;

      for (const strategy of strategies) {
        for (let attemptNum = 1; attemptNum <= this.config.maxRetryAttempts; attemptNum++) {
          const attemptStart = Date.now();
          const attemptId = `${recoveryId}-${strategy}-${attemptNum}`;

          try {
            const handler = this.strategies.get(strategy);
            if (!handler) continue;

            const result = await handler(error, context, attemptNum);
            const attemptDuration = Date.now() - attemptStart;

            const attempt: RecoveryAttempt = {
              attemptId,
              timestamp: new Date().toISOString(),
              strategy,
              attemptNumber: attemptNum,
              originalError: error,
              successful: result.success,
              recoveryError: result.error,
              duration: attemptDuration,
              context: { ...context, strategy }
            };

            attempts.push(attempt);

            if (result.success) {
              recovered = true;
              successfulStrategy = strategy;
              recoveredData = result.data;
              break;
            }
          } catch (attemptError) {
            const attemptDuration = Date.now() - attemptStart;
            attempts.push({
              attemptId,
              timestamp: new Date().toISOString(),
              strategy,
              attemptNumber: attemptNum,
              originalError: error,
              successful: false,
              recoveryError: attemptError,
              duration: attemptDuration,
              context: { ...context, strategy }
            });
          }
        }

        if (recovered) break;
      }

      const result: RecoveryResult = {
        recovered,
        successfulStrategy,
        totalAttempts: attempts.length,
        totalDuration: Date.now() - startTime,
        attempts,
        finalError: recovered ? undefined : error,
        recoveredData,
        requiresManualIntervention: !recovered
      };

      this.recoveryHistory.push(result);
      return result;

    } finally {
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.baseRetryDelay;
    }

    const delay = this.config.baseRetryDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique recovery ID
   */
  private generateRecoveryId(): string {
    return `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current recovery status
   */
  public getRecoveryStatus(): SystemRecoveryStatus {
    const totalRecoveries = this.recoveryHistory.length;
    const successfulRecoveries = this.recoveryHistory.filter(r => r.recovered).length;
    const failedRecoveries = totalRecoveries - successfulRecoveries;
    
    const totalTime = this.recoveryHistory.reduce((sum, r) => sum + r.totalDuration, 0);
    const averageRecoveryTime = totalRecoveries > 0 ? totalTime / totalRecoveries : 0;
    
    const successRate = totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 1;
    const healthScore = Math.round(successRate * 100);

    return {
      inRecovery: this.activeRecoveries.size > 0,
      activeRecoveries: this.activeRecoveries.size,
      totalRecoveries,
      successfulRecoveries,
      failedRecoveries,
      averageRecoveryTime,
      lastRecoveryResult: this.recoveryHistory[this.recoveryHistory.length - 1],
      healthScore
    };
  }

  /**
   * Register a custom recovery strategy
   */
  public registerStrategy(strategy: RecoveryStrategy, handler: RecoveryHandler): void {
    this.strategies.set(strategy, handler);
  }

  /**
   * Clear recovery history
   */
  public clearHistory(): void {
    this.recoveryHistory = [];
  }

  /**
   * Update recovery configuration
   */
  public updateConfig(config: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get recovery statistics
   */
  public getStatistics(): RecoveryStatistics {
    const totalOperations = this.recoveryHistory.length;
    const successes = this.recoveryHistory.filter(r => r.recovered).length;
    const successRate = totalOperations > 0 ? successes / totalOperations : 0;

    return {
      totalOperations,
      successRate,
      commonErrors: {},
      strategyEffectiveness: {},
      averageTimeByStrategy: {}
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating error recovery services
 */
export class ErrorRecoveryFactory {
  /**
   * Create a standard error recovery service
   */
  public static createStandard(config?: Partial<ErrorRecoveryConfig>): BrowserErrorRecoveryService {
    return new BrowserErrorRecoveryService(config);
  }
}

/**
 * Create a standard error recovery service
 */
export function createErrorRecoveryService(config?: Partial<ErrorRecoveryConfig>): BrowserErrorRecoveryService {
  return ErrorRecoveryFactory.createStandard(config);
}

/**
 * Create a robust error recovery service with enhanced capabilities
 */
export function createRobustErrorRecovery(): BrowserErrorRecoveryService {
  return new BrowserErrorRecoveryService({
    maxRetryAttempts: 5,
    baseRetryDelay: 500,
    exponentialBackoff: true,
    maxRetryDelay: 5000,
    recoveryTimeout: 60000,
    enableLogging: true
  });
}