import {
  MCPAuthCredentials,
  BackwardCompatibilityConfig,
  MCPAuthError,
  MCPAuthErrorType,
  SecurityAuditLogEntry
} from './authTypes';

/**
 * Backward Compatibility System for Phase 5
 * Ensures existing code continues to work with new authentication system
 */
export class BackwardCompatibilityHandler {
  private config: BackwardCompatibilityConfig;
  private migrationLog: SecurityAuditLogEntry[] = [];
  private deprecationWarnings: Set<string> = new Set();

  constructor(config: BackwardCompatibilityConfig) {
    this.config = config;
  }

  // ============================================================================
  // PHASE 5: BACKWARD COMPATIBILITY SAFEGUARDS
  // ============================================================================

  /**
   * Handle legacy authentication data and migrate to new format
   */
  migrateLegacyAuth(legacyData: any): {
    credentials: MCPAuthCredentials | null;
    migrationStatus: 'success' | 'partial' | 'failed';
    warnings: string[];
    deprecationNotices: string[];
  } {
    const warnings: string[] = [];
    const deprecationNotices: string[] = [];

    try {
      if (!this.config.enableLegacySupport) {
        throw new MCPAuthError(
          MCPAuthErrorType.VALIDATION_ERROR,
          'Legacy authentication support is disabled'
        );
      }

      // Detect legacy format
      const legacyFormat = this.detectLegacyFormat(legacyData);
      if (!legacyFormat) {
        return {
          credentials: null,
          migrationStatus: 'failed',
          warnings: ['Unknown legacy format detected'],
          deprecationNotices
        };
      }

      // Log deprecation warning
      const deprecationKey = `legacy_format_${legacyFormat}`;
      if (!this.deprecationWarnings.has(deprecationKey)) {
        this.deprecationWarnings.add(deprecationKey);
        if (this.config.deprecationWarnings) {
          deprecationNotices.push(`DEPRECATED: Legacy format '${legacyFormat}' will be removed in future versions`);
        }
      }

      // Attempt migration
      const credentials = this.performMigration(legacyData, legacyFormat, warnings);

      // Log migration event
      this.logMigrationEvent(legacyData, credentials, legacyFormat, warnings);

      const migrationStatus = warnings.length === 0 ? 'success' : 'partial';

      return {
        credentials,
        migrationStatus,
        warnings,
        deprecationNotices
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(`Migration failed: ${errorMessage}`);

      return {
        credentials: null,
        migrationStatus: 'failed',
        warnings,
        deprecationNotices
      };
    }
  }

  /**
   * Detect the legacy authentication format
   */
  private detectLegacyFormat(data: any): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Format 1: Simple token object
    if (data.token && typeof data.token === 'string' && !data.bearerToken) {
      return 'simple_token';
    }

    // Format 2: Session-based format
    if (data.sessionId && data.accessToken && !data.bearerToken) {
      return 'session_based';
    }

    // Format 3: User object with auth
    if (data.user && data.auth && typeof data.auth === 'object') {
      return 'user_auth_object';
    }

    // Format 4: Firebase-style format
    if (data.stsTokenManager && data.uid) {
      return 'firebase_style';
    }

    // Format 5: Old MCP format (pre-Phase 1)
    if (data.mcpToken && data.userInfo) {
      return 'old_mcp_format';
    }

    // Check if it's already in new format but missing some fields
    if (data.bearerToken && data.userId) {
      return 'partial_new_format';
    }

    return null;
  }

  /**
   * Perform the actual migration based on detected format
   */
  private performMigration(data: any, format: string, warnings: string[]): MCPAuthCredentials {
    switch (format) {
      case 'simple_token':
        return this.migrateSimpleToken(data, warnings);
      
      case 'session_based':
        return this.migrateSessionBased(data, warnings);
      
      case 'user_auth_object':
        return this.migrateUserAuthObject(data, warnings);
      
      case 'firebase_style':
        return this.migrateFirebaseStyle(data, warnings);
      
      case 'old_mcp_format':
        return this.migrateOldMcpFormat(data, warnings);
      
      case 'partial_new_format':
        return this.migratePartialNewFormat(data, warnings);
      
      default:
        throw new MCPAuthError(
          MCPAuthErrorType.VALIDATION_ERROR,
          `Unsupported legacy format: ${format}`
        );
    }
  }

  /**
   * Migrate simple token format
   */
  private migrateSimpleToken(data: any, warnings: string[]): MCPAuthCredentials {
    warnings.push('Migrating from simple token format - some fields may be missing');

    return {
      bearerToken: data.token,
      refreshToken: data.refreshToken || '',
      userId: data.userId || data.id || 'unknown',
      userEmail: data.email || data.userEmail || '',
      expiresAt: data.expiresAt || data.expires || (Date.now() + 60 * 60 * 1000), // Default 1 hour
      tokenSource: 'supabase'
    };
  }

  /**
   * Migrate session-based format
   */
  private migrateSessionBased(data: any, warnings: string[]): MCPAuthCredentials {
    return {
      bearerToken: data.accessToken,
      refreshToken: data.refreshToken || '',
      userId: data.userId || data.sessionId || 'unknown',
      userEmail: data.userEmail || data.email || '',
      expiresAt: data.expiresAt || data.sessionExpiry || (Date.now() + 60 * 60 * 1000),
      tokenSource: 'supabase'
    };
  }

  /**
   * Migrate user auth object format
   */
  private migrateUserAuthObject(data: any, warnings: string[]): MCPAuthCredentials {
    const auth = data.auth;
    const user = data.user;

    return {
      bearerToken: auth.accessToken || auth.token,
      refreshToken: auth.refreshToken || '',
      userId: user.id || user.uid || 'unknown',
      userEmail: user.email || '',
      expiresAt: auth.expiresAt || auth.expires || (Date.now() + 60 * 60 * 1000),
      tokenSource: 'supabase'
    };
  }

  /**
   * Migrate Firebase-style format
   */
  private migrateFirebaseStyle(data: any, warnings: string[]): MCPAuthCredentials {
    const tokenManager = data.stsTokenManager;

    return {
      bearerToken: tokenManager.accessToken,
      refreshToken: tokenManager.refreshToken || '',
      userId: data.uid,
      userEmail: data.email || '',
      expiresAt: tokenManager.expirationTime || (Date.now() + 60 * 60 * 1000),
      tokenSource: 'supabase'
    };
  }

  /**
   * Migrate old MCP format
   */
  private migrateOldMcpFormat(data: any, warnings: string[]): MCPAuthCredentials {
    warnings.push('Migrating from old MCP format - updating to new structure');

    return {
      bearerToken: data.mcpToken,
      refreshToken: data.refreshToken || '',
      userId: data.userInfo.id || data.userInfo.userId,
      userEmail: data.userInfo.email || '',
      expiresAt: data.expiresAt || (Date.now() + 60 * 60 * 1000),
      tokenSource: 'supabase'
    };
  }

  /**
   * Migrate partial new format (missing some fields)
   */
  private migratePartialNewFormat(data: any, warnings: string[]): MCPAuthCredentials {
    const credentials: MCPAuthCredentials = {
      bearerToken: data.bearerToken,
      refreshToken: data.refreshToken || '',
      userId: data.userId,
      userEmail: data.userEmail || '',
      expiresAt: data.expiresAt || (Date.now() + 60 * 60 * 1000),
      tokenSource: data.tokenSource || 'supabase'
    };

    // Fill in missing fields with warnings
    if (!data.refreshToken) {
      warnings.push('Missing refresh token - using empty string');
    }
    if (!data.userEmail) {
      warnings.push('Missing user email - using empty string');
    }
    if (!data.expiresAt) {
      warnings.push('Missing expiry time - using default 1 hour from now');
    }

    return credentials;
  }

  /**
   * Check if data needs migration
   */
  needsMigration(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // If it has all required new format fields, no migration needed
    if (data.bearerToken && data.userId && data.userEmail && data.expiresAt && data.tokenSource) {
      return false;
    }

    // If it has some legacy indicators, it needs migration
    return this.detectLegacyFormat(data) !== null;
  }

  /**
   * Handle legacy events for backward compatibility
   */
  handleLegacyEvents(eventName: string, data: any): {
    handled: boolean;
    modernEventName?: string;
    convertedData?: any;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (!this.config.legacyEventSupport) {
      return { handled: false, warnings: ['Legacy event support is disabled'] };
    }

    // Map legacy event names to modern equivalents
    const eventMappings: Record<string, string> = {
      'auth_login': 'onAuthSuccess',
      'auth_logout': 'onAuthFailure',
      'token_update': 'onTokenRefresh',
      'session_expired': 'onTokenExpired',
      'auth_change': 'onAuthStatusChange'
    };

    const modernEventName = eventMappings[eventName];
    if (!modernEventName) {
      return { handled: false, warnings: [`Unknown legacy event: ${eventName}`] };
    }

    // Add deprecation warning
    const deprecationKey = `legacy_event_${eventName}`;
    if (!this.deprecationWarnings.has(deprecationKey)) {
      this.deprecationWarnings.add(deprecationKey);
      if (this.config.deprecationWarnings) {
        warnings.push(`DEPRECATED: Event '${eventName}' is deprecated, use '${modernEventName}' instead`);
      }
    }

    // Convert legacy data format if needed
    let convertedData = data;
    if (data && this.needsMigration(data)) {
      const migration = this.migrateLegacyAuth(data);
      if (migration.migrationStatus !== 'failed') {
        convertedData = migration.credentials;
        warnings.push(...migration.warnings);
      }
    }

    return {
      handled: true,
      modernEventName,
      convertedData,
      warnings
    };
  }

  /**
   * Get migration path for version upgrade
   */
  getMigrationPath(fromVersion: string, toVersion: string): string[] {
    const { migrationPath } = this.config.versionCompatibility;
    
    if (!migrationPath) {
      return [`Direct migration from ${fromVersion} to ${toVersion}`];
    }

    return migrationPath;
  }

  /**
   * Check version compatibility
   */
  isVersionCompatible(version: string): boolean {
    const { minSupportedVersion, currentVersion } = this.config.versionCompatibility;
    
    // Simple version comparison (assumes semantic versioning)
    return this.compareVersions(version, minSupportedVersion) >= 0;
  }

  /**
   * Compare two version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Apply progressive upgrade features
   */
  applyProgressiveUpgrade(currentData: any): {
    upgradedData: any;
    upgradeSteps: string[];
    remainingSteps: string[];
  } {
    const upgradeSteps: string[] = [];
    const remainingSteps: string[] = [];
    let upgradedData = { ...currentData };

    if (!this.config.featureFlags.enableProgressiveUpgrade) {
      return { upgradedData, upgradeSteps, remainingSteps };
    }

    // Step 1: Migrate to new auth format if needed
    if (this.needsMigration(upgradedData)) {
      const migration = this.migrateLegacyAuth(upgradedData);
      if (migration.migrationStatus !== 'failed') {
        upgradedData = migration.credentials;
        upgradeSteps.push('Migrated to new authentication format');
      } else {
        remainingSteps.push('Failed to migrate authentication format');
      }
    }

    // Step 2: Enable new auth flow if configured
    if (this.config.featureFlags.enableNewAuthFlow) {
      upgradedData._newAuthFlow = true;
      upgradeSteps.push('Enabled new authentication flow');
    }

    // Step 3: Apply security enhancements
    if (!upgradedData._securityEnhancements) {
      upgradedData._securityEnhancements = {
        validationEnabled: true,
        sanitizationEnabled: true,
        auditingEnabled: true
      };
      upgradeSteps.push('Applied security enhancements');
    }

    return { upgradedData, upgradeSteps, remainingSteps };
  }

  /**
   * Log migration events for audit purposes
   */
  private logMigrationEvent(
    originalData: any,
    migratedData: MCPAuthCredentials | null,
    format: string,
    warnings: string[]
  ): void {
    const logEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'configuration_change',
      userId: migratedData?.userId,
      userEmail: migratedData?.userEmail,
      action: `legacy_migration_${format}`,
      result: migratedData ? 'success' : 'failure',
      details: {
        legacyFormat: format,
        warningCount: warnings.length,
        migrationMode: this.config.migrationMode
      },
      clientInfo: {}
    };

    this.migrationLog.push(logEntry);

    // Keep only recent entries (last 500)
    if (this.migrationLog.length > 500) {
      this.migrationLog = this.migrationLog.slice(-500);
    }
  }

  /**
   * Get all deprecation warnings
   */
  getDeprecationWarnings(): string[] {
    return Array.from(this.deprecationWarnings);
  }

  /**
   * Get migration log
   */
  getMigrationLog(): SecurityAuditLogEntry[] {
    return [...this.migrationLog];
  }

  /**
   * Clear migration log
   */
  clearMigrationLog(): void {
    this.migrationLog = [];
  }

  /**
   * Reset deprecation warnings
   */
  resetDeprecationWarnings(): void {
    this.deprecationWarnings.clear();
  }

  /**
   * Get compatibility status report
   */
  getCompatibilityStatus(): {
    isLegacySupportEnabled: boolean;
    migrationMode: string;
    deprecationWarningCount: number;
    migrationLogCount: number;
    featureFlags: Record<string, boolean>;
    versionInfo: {
      minSupported: string;
      current: string;
      isCompatible: boolean;
    };
  } {
    return {
      isLegacySupportEnabled: this.config.enableLegacySupport,
      migrationMode: this.config.migrationMode,
      deprecationWarningCount: this.deprecationWarnings.size,
      migrationLogCount: this.migrationLog.length,
      featureFlags: { ...this.config.featureFlags },
      versionInfo: {
        minSupported: this.config.versionCompatibility.minSupportedVersion,
        current: this.config.versionCompatibility.currentVersion,
        isCompatible: this.isVersionCompatible(this.config.versionCompatibility.currentVersion)
      }
    };
  }
}