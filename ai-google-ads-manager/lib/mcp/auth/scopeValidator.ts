/**
 * Scope Validator
 * 
 * This file provides core OAuth scope validation logic for GA4 operations,
 * including pre-execution scope checking and requirement mapping.
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
  PermissionStatus,
  OperationPermissionMap,
  ScopeValidationConfig,
  ScopeValidationResult,
  ScopeValidationError,
  ScopeRequirement,
  ScopeComparisonResult,
  CachedScopeInfo
} from './permissionTypes';

import {
  OPERATION_PERMISSION_MAP,
  detectPropertyPermissionLevel,
  detectAllowedOperations,
  detectMissingScopes,
  isTokenExpired,
  hasPermissionForOperation,
  createPermissionError,
  getOperationDescription,
  getScopeDescription
} from './permissionDetection';

// ============================================================================
// SCOPE REQUIREMENT MAPPING
// ============================================================================

/**
 * Maps each GA4 operation to its detailed scope requirements
 */
export const OPERATION_SCOPE_REQUIREMENTS: { [operation in GA4Operation]: ScopeRequirement } = {
  [GA4Operation.READ_REPORTS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Read basic GA4 reports and data',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.READ_REALTIME]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Access real-time GA4 data streams',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.READ_METADATA]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Read GA4 property metadata and configuration',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.READ_DIMENSIONS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Read available dimensions and metrics',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.READ_CUSTOM_DEFINITIONS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Read custom dimensions and metrics definitions',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.RUN_FUNNEL_REPORT]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    description: 'Generate funnel analysis reports',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.RUN_COHORT_REPORT]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    description: 'Generate cohort analysis reports',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.CREATE_AUDIENCE]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Create new audiences in GA4',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.MODIFY_AUDIENCE]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Modify existing audiences',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.DELETE_AUDIENCE]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Delete audiences from GA4',
    riskLevel: 'high',
    scopeUpgradeRequired: true
  },

  [GA4Operation.CREATE_CONVERSION_EVENT]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Create new conversion events',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.MODIFY_CONVERSION_EVENT]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Modify conversion event settings',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.CREATE_CUSTOM_DIMENSION]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Create custom dimensions',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.MODIFY_CUSTOM_DIMENSION]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    description: 'Modify custom dimension settings',
    riskLevel: 'medium',
    scopeUpgradeRequired: true
  },

  [GA4Operation.MANAGE_USERS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_MANAGE_USERS],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    description: 'Manage GA4 property users and permissions',
    riskLevel: 'high',
    scopeUpgradeRequired: true
  },

  [GA4Operation.MODIFY_PROPERTY_SETTINGS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    description: 'Modify GA4 property settings and configuration',
    riskLevel: 'high',
    scopeUpgradeRequired: true
  },

  [GA4Operation.ACCESS_ENHANCED_ECOMMERCE]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY, GA4OAuthScope.ANALYTICS_ENHANCED_ECOMMERCE],
    optionalScopes: [GA4OAuthScope.ANALYTICS],
    minimumPermissionLevel: GA4PermissionLevel.READ,
    description: 'Access enhanced ecommerce data and reports',
    riskLevel: 'low',
    scopeUpgradeRequired: false
  },

  [GA4Operation.MANAGE_DATA_STREAMS]: {
    requiredScopes: [GA4OAuthScope.ANALYTICS],
    optionalScopes: [],
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    description: 'Manage GA4 data streams and sources',
    riskLevel: 'high',
    scopeUpgradeRequired: true
  }
};

/**
 * Scope hierarchy mapping - higher scopes include permissions of lower scopes
 */
export const SCOPE_HIERARCHY: { [scope in GA4OAuthScope]: GA4OAuthScope[] } = {
  [GA4OAuthScope.ANALYTICS_READONLY]: [],
  [GA4OAuthScope.ANALYTICS]: [GA4OAuthScope.ANALYTICS_READONLY],
  [GA4OAuthScope.ANALYTICS_MANAGE_USERS]: [GA4OAuthScope.ANALYTICS_READONLY],
  [GA4OAuthScope.ANALYTICS_PROVISION]: [GA4OAuthScope.ANALYTICS, GA4OAuthScope.ANALYTICS_READONLY, GA4OAuthScope.ANALYTICS_MANAGE_USERS],
  [GA4OAuthScope.ANALYTICS_ENHANCED_ECOMMERCE]: [],
  [GA4OAuthScope.ANALYTICS_USER_DELETION]: []
};

// ============================================================================
// SCOPE VALIDATOR CLASS
// ============================================================================

/**
 * Core scope validation service
 */
export class ScopeValidator {
  private config: ScopeValidationConfig;
  private cache: Map<string, CachedScopeInfo> = new Map();

  constructor(config?: Partial<ScopeValidationConfig>) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      strictValidation: true,
      allowScopeUpgrade: true,
      logValidationEvents: true,
      enableAuditTrail: true,
      ...config
    };
  }

  /**
   * Validate scopes before executing a GA4 operation
   */
  public async validateOperationScopes(
    operation: GA4Operation,
    tokenPermissions: GA4TokenPermissions,
    context?: Record<string, any>
  ): Promise<ScopeValidationResult> {
    try {
      const startTime = Date.now();
      const validationId = this.generateValidationId();

      // Check cache first
      const cacheKey = this.createCacheKey(operation, tokenPermissions);
      if (this.config.enableCaching) {
        const cachedResult = this.getCachedValidation(cacheKey);
        if (cachedResult) {
          return cachedResult.result;
        }
      }

      // Get scope requirements for operation
      const requirements = OPERATION_SCOPE_REQUIREMENTS[operation];
      if (!requirements) {
        throw new Error(`No scope requirements defined for operation: ${operation}`);
      }

      // Validate token expiration
      if (isTokenExpired(tokenPermissions)) {
        return this.createFailureResult(
          validationId,
          operation,
          tokenPermissions,
          PermissionErrorType.TOKEN_EXPIRED,
          'Access token has expired',
          {
            errorCode: 'TOKEN_EXPIRED',
            resolution: 'Please refresh your authentication token'
          }
        );
      }

      // Check required scopes
      const scopeValidation = this.validateRequiredScopes(
        requirements.requiredScopes,
        tokenPermissions.scopes
      );

      if (!scopeValidation.valid) {
        return this.createFailureResult(
          validationId,
          operation,
          tokenPermissions,
          PermissionErrorType.INSUFFICIENT_SCOPE,
          `Missing required OAuth scopes: ${scopeValidation.missingScopes.join(', ')}`,
          {
            errorCode: 'INSUFFICIENT_SCOPE',
            missingScopes: scopeValidation.missingScopes,
            requiredScopes: requirements.requiredScopes,
            availableScopes: tokenPermissions.scopes,
            resolution: this.generateScopeUpgradeMessage(scopeValidation.missingScopes)
          }
        );
      }

      // Check permission level
      const permissionLevel = detectPropertyPermissionLevel(tokenPermissions);
      if (!this.isPermissionLevelSufficient(permissionLevel, requirements.minimumPermissionLevel)) {
        return this.createFailureResult(
          validationId,
          operation,
          tokenPermissions,
          PermissionErrorType.INSUFFICIENT_PERMISSION,
          `Insufficient permission level. Required: ${requirements.minimumPermissionLevel}, Current: ${permissionLevel}`,
          {
            errorCode: 'INSUFFICIENT_PERMISSION',
            requiredLevel: requirements.minimumPermissionLevel,
            currentLevel: permissionLevel,
            resolution: 'Please request elevated permissions from your administrator'
          }
        );
      }

      // Create success result
      const result = this.createSuccessResult(
        validationId,
        operation,
        tokenPermissions,
        requirements,
        Date.now() - startTime
      );

      // Cache result
      if (this.config.enableCaching) {
        this.cacheValidation(cacheKey, result);
      }

      // Log if enabled
      if (this.config.logValidationEvents) {
        console.log(`[SCOPE_VALIDATOR] Operation ${operation} validated successfully`, {
          validationId,
          duration: Date.now() - startTime,
          requiredScopes: requirements.requiredScopes,
          permissionLevel
        });
      }

      return result;

    } catch (error) {
      return this.createErrorResult(operation, tokenPermissions, error);
    }
  }

  /**
   * Validate a specific set of scopes against requirements
   */
  public validateScopes(
    requiredScopes: GA4OAuthScope[],
    availableScopes: GA4OAuthScope[]
  ): ScopeComparisonResult {
    const missingScopes: GA4OAuthScope[] = [];
    const satisfiedScopes: GA4OAuthScope[] = [];
    const excessScopes: GA4OAuthScope[] = [];

    // Check each required scope
    for (const requiredScope of requiredScopes) {
      if (this.hasScopeOrHigher(availableScopes, requiredScope)) {
        satisfiedScopes.push(requiredScope);
      } else {
        missingScopes.push(requiredScope);
      }
    }

    // Find excess scopes
    for (const availableScope of availableScopes) {
      if (!requiredScopes.includes(availableScope)) {
        excessScopes.push(availableScope);
      }
    }

    return {
      valid: missingScopes.length === 0,
      missingScopes,
      satisfiedScopes,
      excessScopes,
      upgradeRequired: missingScopes.length > 0,
      riskLevel: this.calculateRiskLevel(requiredScopes, availableScopes)
    };
  }

  /**
   * Get all operations that can be performed with given scopes
   */
  public getAvailableOperations(scopes: GA4OAuthScope[]): GA4Operation[] {
    const availableOperations: GA4Operation[] = [];

    for (const [operation, requirements] of Object.entries(OPERATION_SCOPE_REQUIREMENTS)) {
      const scopeValidation = this.validateRequiredScopes(requirements.requiredScopes, scopes);
      if (scopeValidation.valid) {
        availableOperations.push(operation as GA4Operation);
      }
    }

    return availableOperations;
  }

  /**
   * Get missing scopes for a specific operation
   */
  public getMissingScopes(operation: GA4Operation, availableScopes: GA4OAuthScope[]): GA4OAuthScope[] {
    const requirements = OPERATION_SCOPE_REQUIREMENTS[operation];
    if (!requirements) return [];

    const validation = this.validateRequiredScopes(requirements.requiredScopes, availableScopes);
    return validation.missingScopes;
  }

  /**
   * Generate scope upgrade URL for missing scopes
   */
  public generateScopeUpgradeUrl(
    missingScopes: GA4OAuthScope[],
    currentScopes: GA4OAuthScope[],
    redirectUri?: string
  ): string {
    const allScopes = [...new Set([...currentScopes, ...missingScopes])];
    const scopeString = allScopes.join(' ');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri || window.location.origin + '/auth/callback',
      scope: scopeString,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get validation statistics
   */
  public getStatistics(): {
    cacheSize: number;
    cacheHitRate: number;
    totalValidations: number;
  } {
    // Simple implementation - in production you'd track more metrics
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would track hits/total
      totalValidations: 0 // Would track total validations
    };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Validate required scopes against available scopes
   */
  private validateRequiredScopes(
    requiredScopes: GA4OAuthScope[],
    availableScopes: GA4OAuthScope[]
  ): { valid: boolean; missingScopes: GA4OAuthScope[] } {
    const missingScopes: GA4OAuthScope[] = [];

    for (const requiredScope of requiredScopes) {
      if (!this.hasScopeOrHigher(availableScopes, requiredScope)) {
        missingScopes.push(requiredScope);
      }
    }

    return {
      valid: missingScopes.length === 0,
      missingScopes
    };
  }

  /**
   * Check if available scopes include the required scope or a higher-level scope
   */
  private hasScopeOrHigher(availableScopes: GA4OAuthScope[], requiredScope: GA4OAuthScope): boolean {
    // Direct match
    if (availableScopes.includes(requiredScope)) {
      return true;
    }

    // Check if any available scope includes the required scope in its hierarchy
    for (const availableScope of availableScopes) {
      const hierarchy = SCOPE_HIERARCHY[availableScope] || [];
      if (hierarchy.includes(requiredScope)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if permission level is sufficient
   */
  private isPermissionLevelSufficient(
    currentLevel: GA4PermissionLevel,
    requiredLevel: GA4PermissionLevel
  ): boolean {
    const levels = [
      GA4PermissionLevel.NONE,
      GA4PermissionLevel.READ,
      GA4PermissionLevel.ANALYZE,
      GA4PermissionLevel.COLLABORATE,
      GA4PermissionLevel.EDIT,
      GA4PermissionLevel.ADMIN
    ];

    const currentIndex = levels.indexOf(currentLevel);
    const requiredIndex = levels.indexOf(requiredLevel);

    return currentIndex >= requiredIndex;
  }

  /**
   * Calculate risk level for scope combination
   */
  private calculateRiskLevel(
    requiredScopes: GA4OAuthScope[],
    availableScopes: GA4OAuthScope[]
  ): 'low' | 'medium' | 'high' {
    const highRiskScopes = [
      GA4OAuthScope.ANALYTICS_MANAGE_USERS,
      GA4OAuthScope.ANALYTICS_PROVISION,
      GA4OAuthScope.ANALYTICS_USER_DELETION
    ];

    const hasHighRiskScope = requiredScopes.some(scope => highRiskScopes.includes(scope));
    if (hasHighRiskScope) return 'high';

    const hasWriteScope = requiredScopes.includes(GA4OAuthScope.ANALYTICS);
    if (hasWriteScope) return 'medium';

    return 'low';
  }

  /**
   * Generate scope upgrade message
   */
  private generateScopeUpgradeMessage(missingScopes: GA4OAuthScope[]): string {
    const scopeDescriptions = missingScopes.map(scope => getScopeDescription(scope));
    return `To perform this operation, you need additional permissions: ${scopeDescriptions.join(', ')}. Please re-authenticate with elevated permissions.`;
  }

  /**
   * Create cache key for validation result
   */
  private createCacheKey(operation: GA4Operation, tokenPermissions: GA4TokenPermissions): string {
    return `${operation}-${tokenPermissions.scopes.sort().join(',')}-${tokenPermissions.permissionLevel}`;
  }

  /**
   * Get cached validation result
   */
  private getCachedValidation(cacheKey: string): CachedScopeInfo | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache validation result
   */
  private cacheValidation(cacheKey: string, result: ScopeValidationResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Simple cache size management
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Create success validation result
   */
  private createSuccessResult(
    validationId: string,
    operation: GA4Operation,
    tokenPermissions: GA4TokenPermissions,
    requirements: ScopeRequirement,
    duration: number
  ): ScopeValidationResult {
    return {
      valid: true,
      validationId,
      operation,
      tokenPermissions,
      requirements,
      scopeComparison: this.validateScopes(requirements.requiredScopes, tokenPermissions.scopes),
      validationTime: new Date().toISOString(),
      duration,
      cached: false
    };
  }

  /**
   * Create failure validation result
   */
  private createFailureResult(
    validationId: string,
    operation: GA4Operation,
    tokenPermissions: GA4TokenPermissions,
    errorType: PermissionErrorType,
    message: string,
    errorDetails: Record<string, any>
  ): ScopeValidationResult {
    const error: ScopeValidationError = {
      type: errorType,
      message,
      operation,
      tokenPermissions,
      details: errorDetails,
      timestamp: new Date().toISOString(),
      validationId
    };

    return {
      valid: false,
      validationId,
      operation,
      tokenPermissions,
      error,
      validationTime: new Date().toISOString(),
      duration: 0,
      cached: false
    };
  }

  /**
   * Create error validation result
   */
  private createErrorResult(
    operation: GA4Operation,
    tokenPermissions: GA4TokenPermissions,
    error: any
  ): ScopeValidationResult {
    const validationId = this.generateValidationId();
    
    return {
      valid: false,
      validationId,
      operation,
      tokenPermissions,
      error: {
        type: PermissionErrorType.VALIDATION_ERROR,
        message: `Scope validation failed: ${error.message}`,
        operation,
        tokenPermissions,
        details: { originalError: error.message },
        timestamp: new Date().toISOString(),
        validationId
      },
      validationTime: new Date().toISOString(),
      duration: 0,
      cached: false
    };
  }

  /**
   * Generate unique validation ID
   */
  private generateValidationId(): string {
    return `scope-val-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating scope validators
 */
export class ScopeValidatorFactory {
  /**
   * Create a standard scope validator
   */
  public static createStandard(config?: Partial<ScopeValidationConfig>): ScopeValidator {
    return new ScopeValidator(config);
  }

  /**
   * Create a strict scope validator for production
   */
  public static createStrict(): ScopeValidator {
    return new ScopeValidator({
      strictValidation: true,
      allowScopeUpgrade: false,
      enableCaching: true,
      cacheTimeout: 600000, // 10 minutes
      logValidationEvents: true,
      enableAuditTrail: true
    });
  }

  /**
   * Create a permissive scope validator for development
   */
  public static createPermissive(): ScopeValidator {
    return new ScopeValidator({
      strictValidation: false,
      allowScopeUpgrade: true,
      enableCaching: false,
      logValidationEvents: true,
      enableAuditTrail: false
    });
  }
}

/**
 * Create a standard scope validator
 */
export function createScopeValidator(config?: Partial<ScopeValidationConfig>): ScopeValidator {
  return ScopeValidatorFactory.createStandard(config);
}

/**
 * Validate operation scopes (convenience function)
 */
export async function validateOperationScopes(
  operation: GA4Operation,
  tokenPermissions: GA4TokenPermissions,
  config?: Partial<ScopeValidationConfig>
): Promise<ScopeValidationResult> {
  const validator = createScopeValidator(config);
  return validator.validateOperationScopes(operation, tokenPermissions);
}

/**
 * Get available operations for scopes (convenience function)
 */
export function getAvailableOperations(scopes: GA4OAuthScope[]): GA4Operation[] {
  const validator = createScopeValidator();
  return validator.getAvailableOperations(scopes);
}