/**
 * Permission Validator
 * 
 * This file provides the core permission validation infrastructure for 
 * checking GA4 permissions before tool calls and operations.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4PermissionContext,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionError,
  PermissionErrorType,
  CachedPermissionInfo,
  PermissionCacheConfig,
  PermissionSystemConfig
} from './permissionTypes';

import {
  detectPropertyPermissionLevel,
  detectAllowedOperations,
  detectMissingScopes,
  isTokenExpired,
  hasPermissionForOperation,
  isPermissionLevelSufficient,
  validatePermissionCheckRequest,
  createPermissionError,
  getOperationDescription,
  getScopeDescription,
  OPERATION_PERMISSION_MAP
} from './permissionDetection';

// ============================================================================
// PERMISSION VALIDATOR CLASS
// ============================================================================

/**
 * Core permission validation service
 */
export class PermissionValidator {
  private cache: Map<string, CachedPermissionInfo> = new Map();
  private config: PermissionSystemConfig;

  constructor(config?: Partial<PermissionSystemConfig>) {
    this.config = {
      cache: {
        successCacheTTL: 300, // 5 minutes
        failureCacheTTL: 60,  // 1 minute
        maxCacheSize: 1000,
        enabled: true
      },
      autoRefreshInterval: 3600, // 1 hour
      strictMode: true,
      defaultPermissionLevel: GA4PermissionLevel.READ,
      enableAuditLogging: true,
      ...config
    };
  }

  // ========================================================================
  // MAIN PERMISSION VALIDATION METHODS
  // ========================================================================

  /**
   * Performs a comprehensive permission check
   */
  public async checkPermission(request: PermissionCheckRequest): Promise<PermissionCheckResult> {
    try {
      // Validate request
      const validationErrors = validatePermissionCheckRequest(request);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid permission check request: ${validationErrors.join(', ')}`);
      }

      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedPermission(request);
        if (cached) {
          return cached.permissionResult;
        }
      }

      // Perform actual permission check
      const result = await this.performPermissionCheck(request);

      // Cache the result
      if (this.config.cache.enabled) {
        this.cachePermissionResult(request, result);
      }

      // Log if audit logging is enabled
      if (this.config.enableAuditLogging) {
        this.logPermissionCheck(request, result);
      }

      return result;

    } catch (error) {
      const errorResult: PermissionCheckResult = {
        hasPermission: false,
        actualPermissionLevel: GA4PermissionLevel.NONE,
        missingOperations: [request.requiredOperation],
        missingScopes: [],
        tokenExpired: false,
        explanation: `Permission check failed: ${error.message}`,
        suggestions: ['Retry the permission check', 'Contact system administrator']
      };

      // Log error if audit logging is enabled
      if (this.config.enableAuditLogging) {
        this.logPermissionError(request, error);
      }

      return errorResult;
    }
  }

  /**
   * Checks if user can perform a specific operation
   */
  public async canPerformOperation(
    userContext: GA4PermissionContext,
    propertyId: string,
    operation: GA4Operation
  ): Promise<boolean> {
    const request: PermissionCheckRequest = {
      userContext,
      propertyId,
      requiredOperation: operation
    };

    const result = await this.checkPermission(request);
    return result.hasPermission;
  }

  /**
   * Validates multiple operations at once
   */
  public async validateOperations(
    userContext: GA4PermissionContext,
    propertyId: string,
    operations: GA4Operation[]
  ): Promise<{ [operation: string]: PermissionCheckResult }> {
    const results: { [operation: string]: PermissionCheckResult } = {};

    await Promise.all(
      operations.map(async (operation) => {
        const request: PermissionCheckRequest = {
          userContext,
          propertyId,
          requiredOperation: operation
        };
        
        results[operation] = await this.checkPermission(request);
      })
    );

    return results;
  }

  // ========================================================================
  // PERMISSION CHECK IMPLEMENTATION
  // ========================================================================

  /**
   * Performs the actual permission validation logic
   */
  private async performPermissionCheck(
    request: PermissionCheckRequest
  ): Promise<PermissionCheckResult> {
    const { userContext, propertyId, requiredOperation, minimumPermissionLevel, requiredScopes } = request;

    // Check token expiration
    if (isTokenExpired(userContext.tokenPermissions)) {
      return {
        hasPermission: false,
        actualPermissionLevel: GA4PermissionLevel.NONE,
        missingOperations: [requiredOperation],
        missingScopes: [],
        tokenExpired: true,
        explanation: 'Access token has expired',
        suggestions: [
          'Refresh your authentication token',
          'Sign in again to renew access',
          'Check if your session has expired'
        ]
      };
    }

    // Get user's actual permission level for the property
    const actualPermissionLevel = detectPropertyPermissionLevel(
      userContext.propertyPermissions,
      propertyId
    );

    // Get operation requirements
    const operationConfig = OPERATION_PERMISSION_MAP[requiredOperation];
    const requiredPermissionLevel = minimumPermissionLevel || operationConfig.minimumPermissionLevel;
    const requiredScopesForOperation = requiredScopes || operationConfig.requiredScopes;

    // Check permission level sufficiency
    const hasPermissionLevel = isPermissionLevelSufficient(actualPermissionLevel, requiredPermissionLevel);

    // Check OAuth scopes
    const missingScopes = detectMissingScopes(requiredOperation, userContext.tokenPermissions.grantedScopes);

    // Determine overall permission status
    const hasPermission = hasPermissionLevel && missingScopes.length === 0;

    // Build result
    const result: PermissionCheckResult = {
      hasPermission,
      actualPermissionLevel,
      missingOperations: hasPermission ? [] : [requiredOperation],
      missingScopes,
      tokenExpired: false,
      explanation: this.buildExplanation(
        hasPermission,
        actualPermissionLevel,
        requiredPermissionLevel,
        missingScopes,
        requiredOperation
      ),
      suggestions: this.buildSuggestions(
        hasPermission,
        actualPermissionLevel,
        requiredPermissionLevel,
        missingScopes,
        propertyId
      )
    };

    return result;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Builds a human-readable explanation of the permission check result
   */
  private buildExplanation(
    hasPermission: boolean,
    actualLevel: GA4PermissionLevel,
    requiredLevel: GA4PermissionLevel,
    missingScopes: GA4OAuthScope[],
    operation: GA4Operation
  ): string {
    if (hasPermission) {
      return `Permission granted: You have ${actualLevel} access which is sufficient for ${getOperationDescription(operation)}`;
    }

    const explanations: string[] = [];

    if (!isPermissionLevelSufficient(actualLevel, requiredLevel)) {
      explanations.push(
        `Insufficient permission level: ${actualLevel} access is not sufficient for ${getOperationDescription(operation)} (requires ${requiredLevel})`
      );
    }

    if (missingScopes.length > 0) {
      const scopeDescriptions = missingScopes.map(scope => getScopeDescription(scope)).join(', ');
      explanations.push(`Missing OAuth scopes: ${scopeDescriptions}`);
    }

    return explanations.join('. ');
  }

  /**
   * Builds actionable suggestions for resolving permission issues
   */
  private buildSuggestions(
    hasPermission: boolean,
    actualLevel: GA4PermissionLevel,
    requiredLevel: GA4PermissionLevel,
    missingScopes: GA4OAuthScope[],
    propertyId: string
  ): string[] {
    if (hasPermission) {
      return [];
    }

    const suggestions: string[] = [];

    if (!isPermissionLevelSufficient(actualLevel, requiredLevel)) {
      suggestions.push(
        `Request ${requiredLevel} access for property ${propertyId} from a GA4 administrator`,
        'Contact your Google Analytics account administrator',
        'Verify you have been granted appropriate permissions'
      );
    }

    if (missingScopes.length > 0) {
      suggestions.push(
        'Re-authenticate with additional OAuth scopes',
        'Update your application permissions in Google Cloud Console',
        'Contact your system administrator to configure proper OAuth scopes'
      );
    }

    // Add general suggestions
    suggestions.push(
      'Refresh your browser and try again',
      'Check if you have access to this GA4 property',
      'Verify your account has not been suspended or restricted'
    );

    return suggestions;
  }

  // ========================================================================
  // CACHING METHODS
  // ========================================================================

  /**
   * Gets cached permission result if available and valid
   */
  private getCachedPermission(request: PermissionCheckRequest): CachedPermissionInfo | null {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    const now = new Date();
    const expiresAt = new Date(cached.expiresAt);

    if (now >= expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Caches a permission check result
   */
  private cachePermissionResult(request: PermissionCheckRequest, result: PermissionCheckResult): void {
    const cacheKey = this.buildCacheKey(request);
    const now = new Date();
    
    // Determine cache TTL based on result
    const ttl = result.hasPermission 
      ? this.config.cache.successCacheTTL 
      : this.config.cache.failureCacheTTL;

    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const cacheEntry: CachedPermissionInfo = {
      userId: request.userContext.userId,
      propertyId: request.propertyId,
      permissionResult: result,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      version: 1
    };

    // Check cache size limit
    if (this.cache.size >= this.config.cache.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    this.cache.set(cacheKey, cacheEntry);
  }

  /**
   * Builds a cache key for a permission check request
   */
  private buildCacheKey(request: PermissionCheckRequest): string {
    return `${request.userContext.userId}:${request.propertyId}:${request.requiredOperation}`;
  }

  /**
   * Evicts the oldest cache entry when size limit is reached
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime: Date | null = null;

    for (const [key, entry] of this.cache.entries()) {
      const cachedAt = new Date(entry.cachedAt);
      if (!oldestTime || cachedAt < oldestTime) {
        oldestTime = cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // ========================================================================
  // CACHE MANAGEMENT METHODS
  // ========================================================================

  /**
   * Clears all cached permission results
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clears cached permissions for a specific user
   */
  public clearUserCache(userId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears cached permissions for a specific property
   */
  public clearPropertyCache(propertyId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.propertyId === propertyId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cache.maxCacheSize
    };
  }

  // ========================================================================
  // AUDIT LOGGING METHODS
  // ========================================================================

  /**
   * Logs a permission check for audit purposes
   */
  private logPermissionCheck(request: PermissionCheckRequest, result: PermissionCheckResult): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: request.userContext.userId,
      userEmail: request.userContext.email,
      propertyId: request.propertyId,
      operation: request.requiredOperation,
      hasPermission: result.hasPermission,
      actualPermissionLevel: result.actualPermissionLevel,
      missingScopes: result.missingScopes,
      tokenExpired: result.tokenExpired
    };

    // In a real implementation, this would go to a proper logging service
    console.log('[PERMISSION_AUDIT]', JSON.stringify(logEntry));
  }

  /**
   * Logs permission check errors for audit purposes
   */
  private logPermissionError(request: PermissionCheckRequest, error: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: request.userContext.userId,
      userEmail: request.userContext.email,
      propertyId: request.propertyId,
      operation: request.requiredOperation,
      error: error.message || String(error),
      type: 'PERMISSION_CHECK_ERROR'
    };

    // In a real implementation, this would go to a proper logging service
    console.error('[PERMISSION_ERROR]', JSON.stringify(logEntry));
  }

  // ========================================================================
  // CONFIGURATION METHODS
  // ========================================================================

  /**
   * Updates the permission system configuration
   */
  public updateConfig(newConfig: Partial<PermissionSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If cache is disabled, clear existing cache
    if (!this.config.cache.enabled) {
      this.clearCache();
    }
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): PermissionSystemConfig {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new PermissionValidator with default configuration
 */
export function createPermissionValidator(config?: Partial<PermissionSystemConfig>): PermissionValidator {
  return new PermissionValidator(config);
}

/**
 * Creates a PermissionValidator configured for development
 */
export function createDevelopmentPermissionValidator(): PermissionValidator {
  return new PermissionValidator({
    cache: {
      successCacheTTL: 60, // Shorter cache for development
      failureCacheTTL: 30,
      maxCacheSize: 100,
      enabled: true
    },
    strictMode: false, // More lenient for development
    enableAuditLogging: true
  });
}

/**
 * Creates a PermissionValidator configured for production
 */
export function createProductionPermissionValidator(): PermissionValidator {
  return new PermissionValidator({
    cache: {
      successCacheTTL: 300, // 5 minutes
      failureCacheTTL: 60,  // 1 minute
      maxCacheSize: 5000,   // Larger cache for production
      enabled: true
    },
    strictMode: true,
    enableAuditLogging: true
  });
}