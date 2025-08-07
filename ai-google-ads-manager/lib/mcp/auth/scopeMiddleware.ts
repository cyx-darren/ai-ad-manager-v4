/**
 * Scope Middleware
 * 
 * This file provides middleware for MCP operations to validate OAuth scopes
 * before executing GA4 API calls, with pre-execution hooks and validation.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionError,
  PermissionErrorType,
  ScopeValidationResult,
  ScopeValidationError,
  ScopeMiddlewareConfig,
  ScopeMiddlewareResult,
  OperationContext,
  MCPOperationRequest,
  MCPOperationResponse
} from './permissionTypes';

import {
  ScopeValidator,
  createScopeValidator,
  OPERATION_SCOPE_REQUIREMENTS
} from './scopeValidator';

import {
  detectPropertyPermissionLevel,
  isTokenExpired,
  createPermissionError
} from './permissionDetection';

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

/**
 * Middleware execution context
 */
export interface MiddlewareContext {
  /** Unique request ID */
  requestId: string;
  /** Operation being performed */
  operation: GA4Operation;
  /** Token permissions */
  tokenPermissions: GA4TokenPermissions;
  /** Operation parameters */
  parameters: Record<string, any>;
  /** Request timestamp */
  timestamp: string;
  /** User context */
  userContext?: Record<string, any>;
  /** Request metadata */
  metadata?: Record<string, any>;
}

/**
 * Middleware hook function type
 */
export type MiddlewareHook = (
  context: MiddlewareContext,
  validationResult: ScopeValidationResult
) => Promise<void> | void;

/**
 * Operation handler function type
 */
export type OperationHandler = (
  context: MiddlewareContext
) => Promise<MCPOperationResponse>;

/**
 * Middleware execution result
 */
export interface MiddlewareExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Operation response data */
  response?: MCPOperationResponse;
  /** Validation result */
  validationResult: ScopeValidationResult;
  /** Error if execution failed */
  error?: ScopeValidationError;
  /** Execution metrics */
  metrics: {
    validationTime: number;
    executionTime: number;
    totalTime: number;
  };
}

// ============================================================================
// SCOPE MIDDLEWARE CLASS
// ============================================================================

/**
 * OAuth scope validation middleware for MCP operations
 */
export class ScopeMiddleware {
  private config: ScopeMiddlewareConfig;
  private validator: ScopeValidator;
  private hooks: {
    beforeValidation: MiddlewareHook[];
    afterValidation: MiddlewareHook[];
    beforeExecution: MiddlewareHook[];
    afterExecution: MiddlewareHook[];
    onError: MiddlewareHook[];
  };

  constructor(config?: Partial<ScopeMiddlewareConfig>) {
    this.config = {
      enableValidation: true,
      enableCaching: true,
      enableMetrics: true,
      enableAuditLog: true,
      failOnMissingScopes: true,
      allowScopeUpgrade: true,
      requestTimeout: 30000, // 30 seconds
      enableRetry: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.validator = createScopeValidator({
      enableCaching: this.config.enableCaching,
      strictValidation: this.config.failOnMissingScopes,
      allowScopeUpgrade: this.config.allowScopeUpgrade,
      logValidationEvents: this.config.enableAuditLog
    });

    this.hooks = {
      beforeValidation: [],
      afterValidation: [],
      beforeExecution: [],
      afterExecution: [],
      onError: []
    };
  }

  /**
   * Execute operation with scope validation middleware
   */
  public async execute(
    operation: GA4Operation,
    tokenPermissions: GA4TokenPermissions,
    handler: OperationHandler,
    parameters: Record<string, any> = {},
    userContext?: Record<string, any>
  ): Promise<MiddlewareExecutionResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    const context: MiddlewareContext = {
      requestId,
      operation,
      tokenPermissions,
      parameters,
      timestamp: new Date().toISOString(),
      userContext,
      metadata: {
        userAgent: this.getUserAgent(),
        ipAddress: this.getClientIP()
      }
    };

    try {
      // Execute before validation hooks
      await this.executeHooks(this.hooks.beforeValidation, context, {} as ScopeValidationResult);

      // Validate scopes
      const validationStartTime = Date.now();
      const validationResult = await this.validateWithTimeout(context);
      const validationTime = Date.now() - validationStartTime;

      // Execute after validation hooks
      await this.executeHooks(this.hooks.afterValidation, context, validationResult);

      // Check if validation failed
      if (!validationResult.valid) {
        await this.executeHooks(this.hooks.onError, context, validationResult);
        
        return {
          success: false,
          validationResult,
          error: validationResult.error,
          metrics: {
            validationTime,
            executionTime: 0,
            totalTime: Date.now() - startTime
          }
        };
      }

      // Execute before execution hooks
      await this.executeHooks(this.hooks.beforeExecution, context, validationResult);

      // Execute the operation
      const executionStartTime = Date.now();
      const response = await this.executeWithRetry(handler, context);
      const executionTime = Date.now() - executionStartTime;

      // Execute after execution hooks
      await this.executeHooks(this.hooks.afterExecution, context, validationResult);

      // Log success if enabled
      if (this.config.enableAuditLog) {
        console.log(`[SCOPE_MIDDLEWARE] Operation ${operation} executed successfully`, {
          requestId,
          validationTime,
          executionTime,
          totalTime: Date.now() - startTime
        });
      }

      return {
        success: true,
        response,
        validationResult,
        metrics: {
          validationTime,
          executionTime,
          totalTime: Date.now() - startTime
        }
      };

    } catch (error) {
      const errorValidationResult: ScopeValidationResult = {
        valid: false,
        validationId: this.generateValidationId(),
        operation,
        tokenPermissions,
        error: {
          type: PermissionErrorType.MIDDLEWARE_ERROR,
          message: `Middleware execution failed: ${error.message}`,
          operation,
          tokenPermissions,
          details: { originalError: error.message },
          timestamp: new Date().toISOString(),
          validationId: context.requestId
        },
        validationTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        cached: false
      };

      await this.executeHooks(this.hooks.onError, context, errorValidationResult);

      if (this.config.enableAuditLog) {
        console.error(`[SCOPE_MIDDLEWARE] Operation ${operation} failed`, {
          requestId,
          error: error.message,
          totalTime: Date.now() - startTime
        });
      }

      return {
        success: false,
        validationResult: errorValidationResult,
        error: errorValidationResult.error,
        metrics: {
          validationTime: 0,
          executionTime: 0,
          totalTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Add middleware hook
   */
  public addHook(
    type: 'beforeValidation' | 'afterValidation' | 'beforeExecution' | 'afterExecution' | 'onError',
    hook: MiddlewareHook
  ): void {
    this.hooks[type].push(hook);
  }

  /**
   * Remove middleware hook
   */
  public removeHook(
    type: 'beforeValidation' | 'afterValidation' | 'beforeExecution' | 'afterExecution' | 'onError',
    hook: MiddlewareHook
  ): void {
    const hooks = this.hooks[type];
    const index = hooks.indexOf(hook);
    if (index !== -1) {
      hooks.splice(index, 1);
    }
  }

  /**
   * Clear all hooks of a specific type
   */
  public clearHooks(
    type: 'beforeValidation' | 'afterValidation' | 'beforeExecution' | 'afterExecution' | 'onError'
  ): void {
    this.hooks[type] = [];
  }

  /**
   * Get middleware configuration
   */
  public getConfig(): ScopeMiddlewareConfig {
    return { ...this.config };
  }

  /**
   * Update middleware configuration
   */
  public updateConfig(config: Partial<ScopeMiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update validator config
    this.validator = createScopeValidator({
      enableCaching: this.config.enableCaching,
      strictValidation: this.config.failOnMissingScopes,
      allowScopeUpgrade: this.config.allowScopeUpgrade,
      logValidationEvents: this.config.enableAuditLog
    });
  }

  /**
   * Get middleware statistics
   */
  public getStatistics(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageValidationTime: number;
    averageExecutionTime: number;
    cacheHitRate: number;
  } {
    // Simple implementation - in production you'd track detailed metrics
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageValidationTime: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0
    };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Validate scopes with timeout
   */
  private async validateWithTimeout(context: MiddlewareContext): Promise<ScopeValidationResult> {
    return Promise.race([
      this.validator.validateOperationScopes(context.operation, context.tokenPermissions, context),
      this.createTimeoutPromise()
    ]);
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry(
    handler: OperationHandler,
    context: MiddlewareContext
  ): Promise<MCPOperationResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        return await handler(context);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on permission errors
        if (this.isPermissionError(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.maxRetryAttempts) {
          throw error;
        }
        
        // Wait before retry
        await this.sleep(this.config.retryDelay * attempt);
        
        if (this.config.enableAuditLog) {
          console.warn(`[SCOPE_MIDDLEWARE] Retry attempt ${attempt} for ${context.operation}`, {
            requestId: context.requestId,
            error: error.message
          });
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Execute middleware hooks
   */
  private async executeHooks(
    hooks: MiddlewareHook[],
    context: MiddlewareContext,
    validationResult: ScopeValidationResult
  ): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook(context, validationResult);
      } catch (error) {
        if (this.config.enableAuditLog) {
          console.error('[SCOPE_MIDDLEWARE] Hook execution failed', {
            requestId: context.requestId,
            error: error.message
          });
        }
        // Continue executing other hooks even if one fails
      }
    }
  }

  /**
   * Check if error is permission-related
   */
  private isPermissionError(error: any): boolean {
    const message = (error?.message || String(error)).toLowerCase();
    return message.includes('permission') ||
           message.includes('scope') ||
           message.includes('unauthorized') ||
           message.includes('forbidden') ||
           error?.status === 401 ||
           error?.status === 403;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Validation timeout after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);
    });
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique validation ID
   */
  private generateValidationId(): string {
    return `val-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js';
  }

  /**
   * Get client IP (simplified implementation)
   */
  private getClientIP(): string {
    // In a real implementation, this would extract IP from request headers
    return 'unknown';
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create GA4 operation wrapper with scope validation
 */
export function createScopeValidatedOperation<T = any>(
  operation: GA4Operation,
  handler: OperationHandler
) {
  return async (
    tokenPermissions: GA4TokenPermissions,
    parameters: Record<string, any> = {},
    userContext?: Record<string, any>
  ): Promise<T> => {
    const middleware = createScopeMiddleware();
    const result = await middleware.execute(
      operation,
      tokenPermissions,
      handler,
      parameters,
      userContext
    );

    if (!result.success) {
      throw new Error(result.error?.message || 'Operation failed scope validation');
    }

    return result.response?.data as T;
  };
}

/**
 * Create middleware with validation hooks for common scenarios
 */
export function createAuditingMiddleware(
  onValidation?: (context: MiddlewareContext, result: ScopeValidationResult) => void,
  onExecution?: (context: MiddlewareContext, result: ScopeValidationResult) => void
): ScopeMiddleware {
  const middleware = createScopeMiddleware({
    enableAuditLog: true,
    enableMetrics: true
  });

  if (onValidation) {
    middleware.addHook('afterValidation', onValidation);
  }

  if (onExecution) {
    middleware.addHook('afterExecution', onExecution);
  }

  return middleware;
}

/**
 * Create rate-limited middleware
 */
export function createRateLimitedMiddleware(
  requestsPerMinute: number = 60
): ScopeMiddleware {
  const requests = new Map<string, number[]>();
  
  const middleware = createScopeMiddleware();
  
  middleware.addHook('beforeValidation', (context) => {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${context.tokenPermissions.userId || 'unknown'}-${minute}`;
    
    const requestTimes = requests.get(key) || [];
    const recentRequests = requestTimes.filter(time => now - time < 60000);
    
    if (recentRequests.length >= requestsPerMinute) {
      throw new Error('Rate limit exceeded');
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
  });
  
  return middleware;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating scope middleware
 */
export class ScopeMiddlewareFactory {
  /**
   * Create standard scope middleware
   */
  public static createStandard(config?: Partial<ScopeMiddlewareConfig>): ScopeMiddleware {
    return new ScopeMiddleware(config);
  }

  /**
   * Create strict middleware for production
   */
  public static createStrict(): ScopeMiddleware {
    return new ScopeMiddleware({
      enableValidation: true,
      failOnMissingScopes: true,
      allowScopeUpgrade: false,
      enableRetry: false,
      maxRetryAttempts: 1,
      requestTimeout: 15000
    });
  }

  /**
   * Create permissive middleware for development
   */
  public static createPermissive(): ScopeMiddleware {
    return new ScopeMiddleware({
      enableValidation: true,
      failOnMissingScopes: false,
      allowScopeUpgrade: true,
      enableRetry: true,
      maxRetryAttempts: 5,
      requestTimeout: 60000
    });
  }
}

/**
 * Create a standard scope middleware
 */
export function createScopeMiddleware(config?: Partial<ScopeMiddlewareConfig>): ScopeMiddleware {
  return ScopeMiddlewareFactory.createStandard(config);
}

/**
 * Execute operation with scope validation (convenience function)
 */
export async function executeWithScopeValidation(
  operation: GA4Operation,
  tokenPermissions: GA4TokenPermissions,
  handler: OperationHandler,
  parameters?: Record<string, any>,
  config?: Partial<ScopeMiddlewareConfig>
): Promise<MiddlewareExecutionResult> {
  const middleware = createScopeMiddleware(config);
  return middleware.execute(operation, tokenPermissions, handler, parameters);
}