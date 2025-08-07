/**
 * Permission Error Handler
 * 
 * This file provides comprehensive permission error classification and handling
 * with context tracking, pattern recognition, and automated resolution.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionError,
  PermissionErrorType,
  ScopeValidationError,
  ScopeErrorCategory,
  ScopeErrorSeverity
} from './permissionTypes';

// ============================================================================
// ERROR CLASSIFICATION TYPES
// ============================================================================

/**
 * Extended error categories for comprehensive classification
 */
export enum PermissionErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  SCOPE = 'scope',
  TOKEN = 'token',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels with impact assessment
 */
export enum PermissionErrorSeverity {
  LOW = 'low',         // Minor functionality impact
  MEDIUM = 'medium',   // Moderate functionality impact
  HIGH = 'high',       // Major functionality impact  
  CRITICAL = 'critical' // System-wide impact
}

/**
 * Error context information
 */
export interface PermissionErrorContext {
  /** Unique error ID */
  errorId: string;
  /** When error occurred */
  timestamp: string;
  /** Operation that failed */
  operation: GA4Operation;
  /** User ID if available */
  userId?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** User agent information */
  userAgent?: string;
  /** IP address */
  ipAddress?: string;
  /** Additional context data */
  metadata: Record<string, any>;
}

/**
 * Comprehensive error information
 */
export interface PermissionErrorInfo {
  /** Error type */
  type: PermissionErrorType;
  /** Error category */
  category: PermissionErrorCategory;
  /** Error severity */
  severity: PermissionErrorSeverity;
  /** Error message */
  message: string;
  /** User-friendly message */
  userMessage: string;
  /** Error details */
  details: Record<string, any>;
  /** Error context */
  context: PermissionErrorContext;
  /** Suggested resolutions */
  resolutions: ErrorResolution[];
  /** Whether error is retryable */
  retryable: boolean;
  /** Estimated recovery time */
  estimatedRecoveryTime?: number;
}

/**
 * Error resolution suggestion
 */
export interface ErrorResolution {
  /** Resolution ID */
  id: string;
  /** Resolution title */
  title: string;
  /** Resolution description */
  description: string;
  /** Resolution steps */
  steps: string[];
  /** Success probability (0-1) */
  successProbability: number;
  /** Estimated time to complete */
  estimatedTime: number;
  /** Required user action */
  requiresUserAction: boolean;
  /** Whether admin assistance needed */
  requiresAdminAssistance: boolean;
}

/**
 * Error pattern information
 */
export interface ErrorPattern {
  /** Pattern ID */
  patternId: string;
  /** Pattern description */
  description: string;
  /** Error types in pattern */
  errorTypes: PermissionErrorType[];
  /** Frequency of occurrence */
  frequency: number;
  /** Time window for pattern */
  timeWindow: number;
  /** Suggested prevention measures */
  preventionMeasures: string[];
}

/**
 * Error handler configuration
 */
export interface PermissionErrorHandlerConfig {
  /** Enable error pattern recognition */
  enablePatternRecognition: boolean;
  /** Enable error analytics */
  enableAnalytics: boolean;
  /** Enable user-friendly messages */
  enableUserFriendlyMessages: boolean;
  /** Enable automatic resolution suggestions */
  enableAutoResolution: boolean;
  /** Maximum errors to track */
  maxErrorsTracked: number;
  /** Pattern detection time window (ms) */
  patternTimeWindow: number;
  /** Minimum pattern frequency */
  minPatternFrequency: number;
}

// ============================================================================
// ERROR TYPE DEFINITIONS
// ============================================================================

/**
 * Predefined error types with classifications
 */
export const ERROR_TYPE_CLASSIFICATIONS: { [key in PermissionErrorType]: {
  category: PermissionErrorCategory;
  severity: PermissionErrorSeverity;
  retryable: boolean;
  userMessage: string;
  resolutions: Omit<ErrorResolution, 'id'>[];
}} = {
  [PermissionErrorType.INSUFFICIENT_PERMISSION]: {
    category: PermissionErrorCategory.AUTHORIZATION,
    severity: PermissionErrorSeverity.HIGH,
    retryable: false,
    userMessage: 'You don\'t have sufficient permissions to perform this action.',
    resolutions: [
      {
        title: 'Request Permission Upgrade',
        description: 'Contact your administrator to request higher permissions',
        steps: [
          'Contact your Google Analytics administrator',
          'Request the specific permissions needed for this action',
          'Provide the operation details for context'
        ],
        successProbability: 0.8,
        estimatedTime: 2 * 24 * 60 * 60 * 1000, // 2 days
        requiresUserAction: true,
        requiresAdminAssistance: true
      }
    ]
  },

  [PermissionErrorType.INSUFFICIENT_SCOPE]: {
    category: PermissionErrorCategory.SCOPE,
    severity: PermissionErrorSeverity.HIGH,
    retryable: false,
    userMessage: 'Additional OAuth permissions are required for this action.',
    resolutions: [
      {
        title: 'Re-authorize with Additional Scopes',
        description: 'Grant additional OAuth permissions to enable this feature',
        steps: [
          'Click the "Re-authorize" button',
          'Review and approve the additional permissions',
          'Complete the OAuth flow',
          'Try the action again'
        ],
        successProbability: 0.95,
        estimatedTime: 2 * 60 * 1000, // 2 minutes
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.TOKEN_EXPIRED]: {
    category: PermissionErrorCategory.TOKEN,
    severity: PermissionErrorSeverity.MEDIUM,
    retryable: true,
    userMessage: 'Your authentication session has expired.',
    resolutions: [
      {
        title: 'Refresh Authentication',
        description: 'Sign in again to refresh your session',
        steps: [
          'Click "Sign Out" in the navigation',
          'Click "Sign In" to authenticate again',
          'Complete the sign-in process',
          'Try your action again'
        ],
        successProbability: 0.9,
        estimatedTime: 60 * 1000, // 1 minute
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.INVALID_TOKEN]: {
    category: PermissionErrorCategory.TOKEN,
    severity: PermissionErrorSeverity.HIGH,
    retryable: false,
    userMessage: 'Your authentication token is invalid.',
    resolutions: [
      {
        title: 'Clear and Re-authenticate',
        description: 'Clear stored credentials and sign in again',
        steps: [
          'Clear browser cache and cookies',
          'Sign out completely',
          'Sign in again with your credentials',
          'Try the action again'
        ],
        successProbability: 0.85,
        estimatedTime: 3 * 60 * 1000, // 3 minutes
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.RATE_LIMITED]: {
    category: PermissionErrorCategory.RATE_LIMIT,
    severity: PermissionErrorSeverity.MEDIUM,
    retryable: true,
    userMessage: 'Too many requests. Please wait before trying again.',
    resolutions: [
      {
        title: 'Wait and Retry',
        description: 'Wait for the rate limit to reset automatically',
        steps: [
          'Wait for 60 seconds',
          'Try your action again',
          'If still limited, wait longer'
        ],
        successProbability: 0.95,
        estimatedTime: 60 * 1000, // 1 minute
        requiresUserAction: false,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.NETWORK_ERROR]: {
    category: PermissionErrorCategory.NETWORK,
    severity: PermissionErrorSeverity.LOW,
    retryable: true,
    userMessage: 'Network connection issue. Please check your internet connection.',
    resolutions: [
      {
        title: 'Check Network Connection',
        description: 'Verify your internet connection and retry',
        steps: [
          'Check your internet connection',
          'Try refreshing the page',
          'Try the action again',
          'If issues persist, contact support'
        ],
        successProbability: 0.7,
        estimatedTime: 30 * 1000, // 30 seconds
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.VALIDATION_ERROR]: {
    category: PermissionErrorCategory.UNKNOWN,
    severity: PermissionErrorSeverity.LOW,
    retryable: true,
    userMessage: 'A validation error occurred. Please try again.',
    resolutions: [
      {
        title: 'Retry Operation',
        description: 'Try the operation again as it may be a temporary issue',
        steps: [
          'Wait a moment',
          'Try the action again',
          'If error persists, contact support'
        ],
        successProbability: 0.6,
        estimatedTime: 15 * 1000, // 15 seconds
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  },

  [PermissionErrorType.MIDDLEWARE_ERROR]: {
    category: PermissionErrorCategory.UNKNOWN,
    severity: PermissionErrorSeverity.LOW,
    retryable: true,
    userMessage: 'A system error occurred. Please try again.',
    resolutions: [
      {
        title: 'Retry Operation',
        description: 'Try the operation again as it may be a temporary system issue',
        steps: [
          'Wait a moment for the system to recover',
          'Try the action again',
          'If error persists, contact support'
        ],
        successProbability: 0.6,
        estimatedTime: 30 * 1000, // 30 seconds
        requiresUserAction: true,
        requiresAdminAssistance: false
      }
    ]
  }
};

// ============================================================================
// PERMISSION ERROR HANDLER CLASS
// ============================================================================

/**
 * Comprehensive permission error handler
 */
export class PermissionErrorHandler {
  private config: PermissionErrorHandlerConfig;
  private errorHistory: Map<string, PermissionErrorInfo[]> = new Map();
  private patterns: Map<string, ErrorPattern> = new Map();
  private analytics: {
    totalErrors: number;
    errorsByType: Map<PermissionErrorType, number>;
    errorsByCategory: Map<PermissionErrorCategory, number>;
    errorsBySeverity: Map<PermissionErrorSeverity, number>;
    resolutionSuccess: Map<string, number>;
  };

  constructor(config?: Partial<PermissionErrorHandlerConfig>) {
    this.config = {
      enablePatternRecognition: true,
      enableAnalytics: true,
      enableUserFriendlyMessages: true,
      enableAutoResolution: true,
      maxErrorsTracked: 1000,
      patternTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
      minPatternFrequency: 3,
      ...config
    };

    this.analytics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
      resolutionSuccess: new Map()
    };
  }

  /**
   * Handle a permission error comprehensively
   */
  public handleError(
    error: PermissionError | ScopeValidationError,
    context?: Partial<PermissionErrorContext>
  ): PermissionErrorInfo {
    const errorInfo = this.createErrorInfo(error, context);
    
    // Track error in history
    this.trackError(errorInfo);
    
    // Update analytics
    this.updateAnalytics(errorInfo);
    
    // Detect patterns if enabled
    if (this.config.enablePatternRecognition) {
      this.detectPatterns(errorInfo);
    }
    
    // Log error
    console.error('[PERMISSION_ERROR_HANDLER] Error handled', {
      errorId: errorInfo.context.errorId,
      type: errorInfo.type,
      category: errorInfo.category,
      severity: errorInfo.severity,
      operation: errorInfo.context.operation,
      retryable: errorInfo.retryable
    });

    return errorInfo;
  }

  /**
   * Get error pattern analysis
   */
  public getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get error analytics
   */
  public getAnalytics(): {
    totalErrors: number;
    errorsByType: { [type: string]: number };
    errorsByCategory: { [category: string]: number };
    errorsBySeverity: { [severity: string]: number };
    resolutionSuccessRate: { [resolution: string]: number };
    averageRecoveryTime: number;
  } {
    return {
      totalErrors: this.analytics.totalErrors,
      errorsByType: Object.fromEntries(this.analytics.errorsByType),
      errorsByCategory: Object.fromEntries(this.analytics.errorsByCategory),
      errorsBySeverity: Object.fromEntries(this.analytics.errorsBySeverity),
      resolutionSuccessRate: Object.fromEntries(this.analytics.resolutionSuccess),
      averageRecoveryTime: this.calculateAverageRecoveryTime()
    };
  }

  /**
   * Mark resolution as successful
   */
  public markResolutionSuccess(resolutionId: string): void {
    const current = this.analytics.resolutionSuccess.get(resolutionId) || 0;
    this.analytics.resolutionSuccess.set(resolutionId, current + 1);
  }

  /**
   * Get suggested resolution for error type
   */
  public getSuggestedResolution(errorType: PermissionErrorType): ErrorResolution | null {
    const classification = ERROR_TYPE_CLASSIFICATIONS[errorType];
    if (!classification || classification.resolutions.length === 0) {
      return null;
    }

    // Return the resolution with highest success probability
    const bestResolution = classification.resolutions
      .sort((a, b) => b.successProbability - a.successProbability)[0];

    return {
      id: `${errorType}-${Date.now()}`,
      ...bestResolution
    };
  }

  /**
   * Check if error type is retryable
   */
  public isRetryable(errorType: PermissionErrorType): boolean {
    return ERROR_TYPE_CLASSIFICATIONS[errorType]?.retryable || false;
  }

  /**
   * Get user-friendly message for error
   */
  public getUserFriendlyMessage(errorType: PermissionErrorType): string {
    return ERROR_TYPE_CLASSIFICATIONS[errorType]?.userMessage || 
           'An unexpected error occurred. Please try again or contact support.';
  }

  /**
   * Clear error history
   */
  public clearHistory(): void {
    this.errorHistory.clear();
    this.patterns.clear();
    this.analytics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
      resolutionSuccess: new Map()
    };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Create comprehensive error information
   */
  private createErrorInfo(
    error: PermissionError | ScopeValidationError,
    context?: Partial<PermissionErrorContext>
  ): PermissionErrorInfo {
    const errorType = error.type;
    const classification = ERROR_TYPE_CLASSIFICATIONS[errorType];
    
    const errorContext: PermissionErrorContext = {
      errorId: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      operation: 'operation' in error ? error.operation : GA4Operation.READ_REPORTS,
      userId: context?.userId,
      requestId: context?.requestId,
      userAgent: context?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'),
      ipAddress: context?.ipAddress || 'Unknown',
      metadata: {
        ...context?.metadata,
        originalError: error
      }
    };

    const resolutions = classification?.resolutions.map((res, index) => ({
      id: `${errorType}-${index}-${Date.now()}`,
      ...res
    })) || [];

    return {
      type: errorType,
      category: classification?.category || PermissionErrorCategory.UNKNOWN,
      severity: classification?.severity || PermissionErrorSeverity.MEDIUM,
      message: error.message,
      userMessage: this.getUserFriendlyMessage(errorType),
      details: 'details' in error ? error.details || {} : {},
      context: errorContext,
      resolutions,
      retryable: classification?.retryable || false,
      estimatedRecoveryTime: this.estimateRecoveryTime(errorType)
    };
  }

  /**
   * Track error in history
   */
  private trackError(errorInfo: PermissionErrorInfo): void {
    const key = errorInfo.context.userId || 'anonymous';
    const userErrors = this.errorHistory.get(key) || [];
    
    userErrors.push(errorInfo);
    
    // Limit history size
    if (userErrors.length > this.config.maxErrorsTracked) {
      userErrors.shift(); // Remove oldest error
    }
    
    this.errorHistory.set(key, userErrors);
  }

  /**
   * Update analytics
   */
  private updateAnalytics(errorInfo: PermissionErrorInfo): void {
    this.analytics.totalErrors++;
    
    // Update error type count
    const typeCount = this.analytics.errorsByType.get(errorInfo.type) || 0;
    this.analytics.errorsByType.set(errorInfo.type, typeCount + 1);
    
    // Update category count
    const categoryCount = this.analytics.errorsByCategory.get(errorInfo.category) || 0;
    this.analytics.errorsByCategory.set(errorInfo.category, categoryCount + 1);
    
    // Update severity count
    const severityCount = this.analytics.errorsBySeverity.get(errorInfo.severity) || 0;
    this.analytics.errorsBySeverity.set(errorInfo.severity, severityCount + 1);
  }

  /**
   * Detect error patterns
   */
  private detectPatterns(errorInfo: PermissionErrorInfo): void {
    const key = errorInfo.context.userId || 'anonymous';
    const userErrors = this.errorHistory.get(key) || [];
    
    const cutoffTime = Date.now() - this.config.patternTimeWindow;
    const recentErrors = userErrors.filter(e => 
      new Date(e.context.timestamp).getTime() > cutoffTime
    );
    
    // Group by error type
    const errorGroups = new Map<PermissionErrorType, PermissionErrorInfo[]>();
    recentErrors.forEach(error => {
      const group = errorGroups.get(error.type) || [];
      group.push(error);
      errorGroups.set(error.type, group);
    });
    
    // Detect patterns
    errorGroups.forEach((errors, type) => {
      if (errors.length >= this.config.minPatternFrequency) {
        const patternId = `${type}-${key}`;
        this.patterns.set(patternId, {
          patternId,
          description: `Recurring ${type} errors`,
          errorTypes: [type],
          frequency: errors.length,
          timeWindow: this.config.patternTimeWindow,
          preventionMeasures: this.generatePreventionMeasures(type)
        });
      }
    });
  }

  /**
   * Generate prevention measures for error type
   */
  private generatePreventionMeasures(errorType: PermissionErrorType): string[] {
    switch (errorType) {
      case PermissionErrorType.TOKEN_EXPIRED:
        return [
          'Enable automatic token refresh',
          'Set up session warnings before expiration',
          'Implement background token renewal'
        ];
      
      case PermissionErrorType.RATE_LIMITED:
        return [
          'Implement request queuing',
          'Add request rate limiting on client side',
          'Use exponential backoff for retries'
        ];
      
      case PermissionErrorType.INSUFFICIENT_SCOPE:
        return [
          'Request all necessary scopes during initial authentication',
          'Implement progressive permission requests',
          'Cache scope requirements for operations'
        ];
      
      default:
        return [
          'Monitor error patterns',
          'Implement proper error handling',
          'Add user feedback mechanisms'
        ];
    }
  }

  /**
   * Estimate recovery time for error type
   */
  private estimateRecoveryTime(errorType: PermissionErrorType): number {
    const classification = ERROR_TYPE_CLASSIFICATIONS[errorType];
    if (!classification || classification.resolutions.length === 0) {
      return 60 * 1000; // Default 1 minute
    }
    
    return Math.min(...classification.resolutions.map(r => r.estimatedTime));
  }

  /**
   * Calculate average recovery time
   */
  private calculateAverageRecoveryTime(): number {
    const allErrors = Array.from(this.errorHistory.values()).flat();
    if (allErrors.length === 0) return 0;
    
    const totalTime = allErrors.reduce((sum, error) => 
      sum + (error.estimatedRecoveryTime || 0), 0
    );
    
    return totalTime / allErrors.length;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `perm-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating permission error handlers
 */
export class PermissionErrorHandlerFactory {
  /**
   * Create standard error handler
   */
  public static createStandard(config?: Partial<PermissionErrorHandlerConfig>): PermissionErrorHandler {
    return new PermissionErrorHandler(config);
  }

  /**
   * Create comprehensive error handler with full features
   */
  public static createComprehensive(): PermissionErrorHandler {
    return new PermissionErrorHandler({
      enablePatternRecognition: true,
      enableAnalytics: true,
      enableUserFriendlyMessages: true,
      enableAutoResolution: true,
      maxErrorsTracked: 5000,
      patternTimeWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
      minPatternFrequency: 2
    });
  }

  /**
   * Create minimal error handler for development
   */
  public static createMinimal(): PermissionErrorHandler {
    return new PermissionErrorHandler({
      enablePatternRecognition: false,
      enableAnalytics: false,
      enableUserFriendlyMessages: true,
      enableAutoResolution: true,
      maxErrorsTracked: 100,
      patternTimeWindow: 60 * 60 * 1000, // 1 hour
      minPatternFrequency: 5
    });
  }
}

/**
 * Create a standard permission error handler
 */
export function createPermissionErrorHandler(config?: Partial<PermissionErrorHandlerConfig>): PermissionErrorHandler {
  return PermissionErrorHandlerFactory.createStandard(config);
}

/**
 * Handle permission error (convenience function)
 */
export function handlePermissionError(
  error: PermissionError | ScopeValidationError,
  context?: Partial<PermissionErrorContext>,
  config?: Partial<PermissionErrorHandlerConfig>
): PermissionErrorInfo {
  const handler = createPermissionErrorHandler(config);
  return handler.handleError(error, context);
}