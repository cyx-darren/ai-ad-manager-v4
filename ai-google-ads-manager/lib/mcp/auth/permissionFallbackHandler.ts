/**
 * Permission Fallback Handler
 * 
 * This file provides graceful degradation and fallback mechanisms
 * for permission failures with automatic escalation flows.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionErrorType
} from './permissionTypes';

import {
  PermissionErrorCategory,
  PermissionErrorSeverity,
  PermissionErrorInfo
} from './permissionErrorHandler';

// ============================================================================
// FALLBACK STRATEGY TYPES
// ============================================================================

/**
 * Fallback levels for graceful degradation
 */
export enum FallbackLevel {
  FULL = 'full',                    // Full functionality
  LIMITED = 'limited',              // Some features disabled
  READ_ONLY = 'read_only',         // Only read operations
  CACHED = 'cached',               // Cached data only
  EMERGENCY = 'emergency'          // Minimal emergency functionality
}

/**
 * Degradation mode
 */
export enum DegradationMode {
  AUTOMATIC = 'automatic',         // Automatic fallback
  MANUAL = 'manual',              // User-initiated fallback
  FORCED = 'forced'               // System-forced fallback
}

/**
 * Feature availability status
 */
export enum FeatureStatus {
  AVAILABLE = 'available',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
  CACHED_ONLY = 'cached_only'
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /** Enable automatic fallback */
  enableAutoFallback: boolean;
  /** Default fallback level */
  defaultFallbackLevel: FallbackLevel;
  /** Maximum fallback duration */
  maxFallbackDuration: number;
  /** Auto-recovery attempt interval */
  recoveryAttemptInterval: number;
  /** Maximum recovery attempts */
  maxRecoveryAttempts: number;
  /** User notification settings */
  notificationConfig: {
    showFallbackNotifications: boolean;
    showRecoveryNotifications: boolean;
    notificationTimeout: number;
  };
  /** Feature priorities for degradation */
  featurePriorities: Map<GA4Operation, number>;
  /** Cache settings */
  cacheConfig: {
    enableCache: boolean;
    cacheTimeout: number;
    maxCacheSize: number;
  };
}

/**
 * Fallback strategy
 */
export interface FallbackStrategy {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: string;
  /** Target fallback level */
  targetLevel: FallbackLevel;
  /** Operations allowed in this fallback */
  allowedOperations: GA4Operation[];
  /** Operations that should use cache */
  cachedOperations: GA4Operation[];
  /** User message for this fallback */
  userMessage: string;
  /** Estimated functionality percentage */
  functionalityPercentage: number;
  /** Recovery conditions */
  recoveryConditions: string[];
}

/**
 * Fallback context
 */
export interface FallbackContext {
  /** Current fallback level */
  currentLevel: FallbackLevel;
  /** When fallback started */
  fallbackStartTime: number;
  /** Original error that triggered fallback */
  triggerError: PermissionErrorInfo;
  /** Degradation mode */
  mode: DegradationMode;
  /** User state preservation */
  preservedState: Record<string, any>;
  /** Recovery attempts made */
  recoveryAttempts: number;
  /** Available features */
  availableFeatures: Map<GA4Operation, FeatureStatus>;
}

/**
 * Recovery attempt result
 */
export interface RecoveryAttempt {
  /** Attempt number */
  attemptNumber: number;
  /** When attempt was made */
  timestamp: number;
  /** Whether attempt succeeded */
  success: boolean;
  /** Error if attempt failed */
  error?: Error;
  /** Permissions recovered */
  recoveredPermissions?: GA4OAuthScope[];
  /** New permission level achieved */
  newPermissionLevel?: GA4PermissionLevel;
}

/**
 * Escalation request
 */
export interface EscalationRequest {
  /** Request ID */
  requestId: string;
  /** When request was made */
  timestamp: number;
  /** User who made request */
  userId?: string;
  /** Requested permissions */
  requestedPermissions: GA4OAuthScope[];
  /** Requested permission level */
  requestedLevel: GA4PermissionLevel;
  /** Business justification */
  justification: string;
  /** Request status */
  status: 'pending' | 'approved' | 'denied' | 'expired';
  /** Admin response */
  adminResponse?: string;
}

// ============================================================================
// PREDEFINED FALLBACK STRATEGIES
// ============================================================================

/**
 * Predefined fallback strategies for different scenarios
 */
export const FALLBACK_STRATEGIES: Map<PermissionErrorType, FallbackStrategy[]> = new Map([
  [PermissionErrorType.INSUFFICIENT_PERMISSION, [
    {
      id: 'permission-readonly',
      name: 'Read-Only Mode',
      targetLevel: FallbackLevel.READ_ONLY,
      allowedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA,
        GA4Operation.READ_DIMENSIONS,
        GA4Operation.READ_CUSTOM_DEFINITIONS
      ],
      cachedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME
      ],
      userMessage: 'Switched to read-only mode. You can view data but cannot make changes.',
      functionalityPercentage: 60,
      recoveryConditions: ['Permission upgrade', 'Admin approval']
    },
    {
      id: 'permission-cached',
      name: 'Cached Data Mode',
      targetLevel: FallbackLevel.CACHED,
      allowedOperations: [],
      cachedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA
      ],
      userMessage: 'Showing cached data only. Some information may be outdated.',
      functionalityPercentage: 30,
      recoveryConditions: ['Permission upgrade', 'Service restoration']
    }
  ]],

  [PermissionErrorType.INSUFFICIENT_SCOPE, [
    {
      id: 'scope-limited',
      name: 'Limited Scope Mode',
      targetLevel: FallbackLevel.LIMITED,
      allowedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA
      ],
      cachedOperations: [
        GA4Operation.READ_REPORTS
      ],
      userMessage: 'Some features are disabled due to insufficient permissions. Re-authorize to restore full functionality.',
      functionalityPercentage: 70,
      recoveryConditions: ['OAuth re-authorization', 'Scope upgrade']
    }
  ]],

  [PermissionErrorType.TOKEN_EXPIRED, [
    {
      id: 'token-cached',
      name: 'Cached Data Fallback',
      targetLevel: FallbackLevel.CACHED,
      allowedOperations: [],
      cachedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA,
        GA4Operation.READ_DIMENSIONS
      ],
      userMessage: 'Session expired. Showing cached data while you re-authenticate.',
      functionalityPercentage: 40,
      recoveryConditions: ['Token refresh', 'Re-authentication']
    }
  ]],

  [PermissionErrorType.RATE_LIMITED, [
    {
      id: 'rate-cached',
      name: 'Rate Limit Fallback',
      targetLevel: FallbackLevel.CACHED,
      allowedOperations: [],
      cachedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA
      ],
      userMessage: 'Rate limit reached. Showing cached data until limit resets.',
      functionalityPercentage: 50,
      recoveryConditions: ['Rate limit reset', 'Wait period']
    }
  ]],

  [PermissionErrorType.NETWORK_ERROR, [
    {
      id: 'network-cached',
      name: 'Offline Mode',
      targetLevel: FallbackLevel.CACHED,
      allowedOperations: [],
      cachedOperations: [
        GA4Operation.READ_REPORTS,
        GA4Operation.READ_REALTIME,
        GA4Operation.READ_METADATA,
        GA4Operation.READ_DIMENSIONS,
        GA4Operation.READ_CUSTOM_DEFINITIONS
      ],
      userMessage: 'Network connection lost. Working in offline mode with cached data.',
      functionalityPercentage: 35,
      recoveryConditions: ['Network restoration', 'Connection recovery']
    }
  ]]
]);

// ============================================================================
// PERMISSION FALLBACK HANDLER CLASS
// ============================================================================

/**
 * Comprehensive permission fallback handler
 */
export class PermissionFallbackHandler {
  private config: FallbackConfig;
  private currentContext: FallbackContext | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private escalationRequests: Map<string, EscalationRequest> = new Map();
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      enableAutoFallback: true,
      defaultFallbackLevel: FallbackLevel.READ_ONLY,
      maxFallbackDuration: 24 * 60 * 60 * 1000, // 24 hours
      recoveryAttemptInterval: 5 * 60 * 1000, // 5 minutes
      maxRecoveryAttempts: 10,
      notificationConfig: {
        showFallbackNotifications: true,
        showRecoveryNotifications: true,
        notificationTimeout: 10000
      },
      featurePriorities: new Map([
        [GA4Operation.READ_REPORTS, 10],
        [GA4Operation.READ_REALTIME, 9],
        [GA4Operation.READ_METADATA, 8],
        [GA4Operation.READ_DIMENSIONS, 7],
        [GA4Operation.READ_CUSTOM_DEFINITIONS, 6],
        [GA4Operation.RUN_FUNNEL_REPORT, 5],
        [GA4Operation.RUN_COHORT_REPORT, 4],
        [GA4Operation.CREATE_AUDIENCE, 3],
        [GA4Operation.MODIFY_AUDIENCE, 2],
        [GA4Operation.DELETE_AUDIENCE, 1]
      ]),
      cacheConfig: {
        enableCache: true,
        cacheTimeout: 30 * 60 * 1000, // 30 minutes
        maxCacheSize: 100
      },
      ...config
    };
  }

  /**
   * Initiate fallback for permission error
   */
  public async initiateFallback(
    errorInfo: PermissionErrorInfo,
    mode: DegradationMode = DegradationMode.AUTOMATIC,
    preserveState?: Record<string, any>
  ): Promise<FallbackContext> {
    // Select appropriate fallback strategy
    const strategy = this.selectFallbackStrategy(errorInfo);
    
    // Create fallback context
    const context: FallbackContext = {
      currentLevel: strategy.targetLevel,
      fallbackStartTime: Date.now(),
      triggerError: errorInfo,
      mode,
      preservedState: preserveState || {},
      recoveryAttempts: 0,
      availableFeatures: this.buildFeatureMap(strategy)
    };

    this.currentContext = context;

    // Start automatic recovery if enabled
    if (this.config.enableAutoFallback && mode === DegradationMode.AUTOMATIC) {
      this.startRecoveryAttempts();
    }

    // Show notification
    if (this.config.notificationConfig.showFallbackNotifications) {
      this.showFallbackNotification(strategy);
    }

    console.warn('[FALLBACK_HANDLER] Fallback initiated', {
      level: strategy.targetLevel,
      strategy: strategy.name,
      functionality: strategy.functionalityPercentage,
      mode
    });

    return context;
  }

  /**
   * Check if operation is available in current fallback
   */
  public isOperationAvailable(operation: GA4Operation): boolean {
    if (!this.currentContext) {
      return true; // No fallback active
    }

    const status = this.currentContext.availableFeatures.get(operation);
    return status === FeatureStatus.AVAILABLE || status === FeatureStatus.DEGRADED;
  }

  /**
   * Check if operation should use cache
   */
  public shouldUseCache(operation: GA4Operation): boolean {
    if (!this.currentContext) {
      return false;
    }

    const status = this.currentContext.availableFeatures.get(operation);
    return status === FeatureStatus.CACHED_ONLY;
  }

  /**
   * Get cached data for operation
   */
  public getCachedData(operation: GA4Operation, parameters?: Record<string, any>): any | null {
    if (!this.config.cacheConfig.enableCache) {
      return null;
    }

    const cacheKey = this.generateCacheKey(operation, parameters);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache data for operation
   */
  public cacheData(
    operation: GA4Operation,
    data: any,
    parameters?: Record<string, any>,
    customTtl?: number
  ): void {
    if (!this.config.cacheConfig.enableCache) {
      return;
    }

    const cacheKey = this.generateCacheKey(operation, parameters);
    const ttl = customTtl || this.config.cacheConfig.cacheTimeout;

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Manage cache size
    if (this.cache.size > this.config.cacheConfig.maxCacheSize) {
      this.evictOldestCacheEntries();
    }
  }

  /**
   * Request permission escalation
   */
  public requestEscalation(
    requestedPermissions: GA4OAuthScope[],
    requestedLevel: GA4PermissionLevel,
    justification: string,
    userId?: string
  ): EscalationRequest {
    const request: EscalationRequest = {
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      userId,
      requestedPermissions,
      requestedLevel,
      justification,
      status: 'pending'
    };

    this.escalationRequests.set(request.requestId, request);

    // Simulate notification to admin (in real app, this would trigger actual notification)
    console.info('[FALLBACK_HANDLER] Escalation request created', {
      requestId: request.requestId,
      requestedLevel,
      requestedPermissions,
      justification
    });

    return request;
  }

  /**
   * Attempt recovery from fallback
   */
  public async attemptRecovery(): Promise<RecoveryAttempt> {
    if (!this.currentContext) {
      throw new Error('No active fallback to recover from');
    }

    const attemptNumber = this.currentContext.recoveryAttempts + 1;
    const attempt: RecoveryAttempt = {
      attemptNumber,
      timestamp: Date.now(),
      success: false
    };

    try {
      // Simulate recovery logic (in real app, this would test actual permissions)
      const recoverySuccess = await this.testRecovery();
      
      if (recoverySuccess) {
        attempt.success = true;
        await this.exitFallback();
        
        if (this.config.notificationConfig.showRecoveryNotifications) {
          this.showRecoveryNotification();
        }
      }

    } catch (error) {
      attempt.error = error as Error;
    }

    this.currentContext.recoveryAttempts = attemptNumber;

    console.log('[FALLBACK_HANDLER] Recovery attempt', {
      attemptNumber,
      success: attempt.success,
      error: attempt.error?.message
    });

    return attempt;
  }

  /**
   * Exit fallback mode
   */
  public async exitFallback(): Promise<void> {
    if (!this.currentContext) {
      return;
    }

    // Stop recovery attempts
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    const duration = Date.now() - this.currentContext.fallbackStartTime;
    
    console.info('[FALLBACK_HANDLER] Fallback ended', {
      level: this.currentContext.currentLevel,
      duration: Math.round(duration / 1000),
      recoveryAttempts: this.currentContext.recoveryAttempts
    });

    this.currentContext = null;
  }

  /**
   * Get current fallback status
   */
  public getFallbackStatus(): {
    active: boolean;
    context?: FallbackContext;
    availableOperations: GA4Operation[];
    cachedOperations: GA4Operation[];
    functionalityPercentage: number;
  } {
    if (!this.currentContext) {
      return {
        active: false,
        availableOperations: Object.values(GA4Operation),
        cachedOperations: [],
        functionalityPercentage: 100
      };
    }

    const availableOperations = Array.from(this.currentContext.availableFeatures.entries())
      .filter(([_, status]) => status === FeatureStatus.AVAILABLE || status === FeatureStatus.DEGRADED)
      .map(([operation, _]) => operation);

    const cachedOperations = Array.from(this.currentContext.availableFeatures.entries())
      .filter(([_, status]) => status === FeatureStatus.CACHED_ONLY)
      .map(([operation, _]) => operation);

    const strategy = this.getCurrentStrategy();
    
    return {
      active: true,
      context: this.currentContext,
      availableOperations,
      cachedOperations,
      functionalityPercentage: strategy?.functionalityPercentage || 0
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Select appropriate fallback strategy
   */
  private selectFallbackStrategy(errorInfo: PermissionErrorInfo): FallbackStrategy {
    const strategies = FALLBACK_STRATEGIES.get(errorInfo.type) || [];
    
    if (strategies.length === 0) {
      // Default fallback strategy
      return {
        id: 'default-readonly',
        name: 'Default Read-Only',
        targetLevel: this.config.defaultFallbackLevel,
        allowedOperations: [
          GA4Operation.READ_REPORTS,
          GA4Operation.READ_REALTIME,
          GA4Operation.READ_METADATA
        ],
        cachedOperations: [GA4Operation.READ_REPORTS],
        userMessage: 'Limited functionality due to permission error.',
        functionalityPercentage: 50,
        recoveryConditions: ['Permission restoration']
      };
    }

    // Select strategy based on severity and context
    if (errorInfo.severity === PermissionErrorSeverity.CRITICAL) {
      return strategies[strategies.length - 1]; // Most restrictive
    }

    return strategies[0]; // Least restrictive
  }

  /**
   * Build feature availability map
   */
  private buildFeatureMap(strategy: FallbackStrategy): Map<GA4Operation, FeatureStatus> {
    const featureMap = new Map<GA4Operation, FeatureStatus>();

    // Set all operations as unavailable by default
    Object.values(GA4Operation).forEach(operation => {
      featureMap.set(operation, FeatureStatus.UNAVAILABLE);
    });

    // Set allowed operations
    strategy.allowedOperations.forEach(operation => {
      featureMap.set(operation, FeatureStatus.AVAILABLE);
    });

    // Set cached operations
    strategy.cachedOperations.forEach(operation => {
      featureMap.set(operation, FeatureStatus.CACHED_ONLY);
    });

    return featureMap;
  }

  /**
   * Start automatic recovery attempts
   */
  private startRecoveryAttempts(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }

    this.recoveryInterval = setInterval(async () => {
      if (!this.currentContext) {
        clearInterval(this.recoveryInterval!);
        return;
      }

      // Check if max attempts reached
      if (this.currentContext.recoveryAttempts >= this.config.maxRecoveryAttempts) {
        console.warn('[FALLBACK_HANDLER] Max recovery attempts reached');
        clearInterval(this.recoveryInterval!);
        return;
      }

      // Check if max duration reached
      const duration = Date.now() - this.currentContext.fallbackStartTime;
      if (duration >= this.config.maxFallbackDuration) {
        console.warn('[FALLBACK_HANDLER] Max fallback duration reached');
        clearInterval(this.recoveryInterval!);
        return;
      }

      await this.attemptRecovery();
    }, this.config.recoveryAttemptInterval);
  }

  /**
   * Test recovery (simulation)
   */
  private async testRecovery(): Promise<boolean> {
    // In a real implementation, this would test actual permissions
    // For now, simulate a random chance of recovery
    return Math.random() > 0.8; // 20% chance of recovery
  }

  /**
   * Get current strategy
   */
  private getCurrentStrategy(): FallbackStrategy | null {
    if (!this.currentContext) {
      return null;
    }

    const strategies = FALLBACK_STRATEGIES.get(this.currentContext.triggerError.type) || [];
    return strategies.find(s => s.targetLevel === this.currentContext!.currentLevel) || null;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(operation: GA4Operation, parameters?: Record<string, any>): string {
    const paramString = parameters ? JSON.stringify(parameters) : '';
    return `${operation}-${paramString}`;
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestCacheEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const toRemove = Math.ceil(this.cache.size * 0.2); // Remove 20%
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Show fallback notification
   */
  private showFallbackNotification(strategy: FallbackStrategy): void {
    console.info('[FALLBACK_HANDLER] Fallback notification', {
      message: strategy.userMessage,
      level: strategy.targetLevel,
      functionality: strategy.functionalityPercentage
    });
  }

  /**
   * Show recovery notification
   */
  private showRecoveryNotification(): void {
    console.info('[FALLBACK_HANDLER] Recovery notification', {
      message: 'Full functionality restored'
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `esc-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating fallback handlers
 */
export class FallbackHandlerFactory {
  /**
   * Create standard fallback handler
   */
  public static createStandard(config?: Partial<FallbackConfig>): PermissionFallbackHandler {
    return new PermissionFallbackHandler(config);
  }

  /**
   * Create aggressive fallback handler (quick to fallback, aggressive recovery)
   */
  public static createAggressive(): PermissionFallbackHandler {
    return new PermissionFallbackHandler({
      enableAutoFallback: true,
      defaultFallbackLevel: FallbackLevel.CACHED,
      recoveryAttemptInterval: 2 * 60 * 1000, // 2 minutes
      maxRecoveryAttempts: 20,
      cacheConfig: {
        enableCache: true,
        cacheTimeout: 60 * 60 * 1000, // 1 hour
        maxCacheSize: 200
      }
    });
  }

  /**
   * Create conservative fallback handler (slow to fallback, conservative recovery)
   */
  public static createConservative(): PermissionFallbackHandler {
    return new PermissionFallbackHandler({
      enableAutoFallback: false,
      defaultFallbackLevel: FallbackLevel.LIMITED,
      recoveryAttemptInterval: 15 * 60 * 1000, // 15 minutes
      maxRecoveryAttempts: 5,
      cacheConfig: {
        enableCache: true,
        cacheTimeout: 10 * 60 * 1000, // 10 minutes
        maxCacheSize: 50
      }
    });
  }
}

/**
 * Create a standard fallback handler
 */
export function createFallbackHandler(config?: Partial<FallbackConfig>): PermissionFallbackHandler {
  return FallbackHandlerFactory.createStandard(config);
}

/**
 * Initiate fallback for error (convenience function)
 */
export async function initiateFallback(
  errorInfo: PermissionErrorInfo,
  mode?: DegradationMode,
  preserveState?: Record<string, any>,
  config?: Partial<FallbackConfig>
): Promise<FallbackContext> {
  const handler = createFallbackHandler(config);
  return handler.initiateFallback(errorInfo, mode, preserveState);
}