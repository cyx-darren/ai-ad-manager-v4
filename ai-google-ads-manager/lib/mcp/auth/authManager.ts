/**
 * MCP Authentication Manager
 * 
 * Core authentication manager for bridging Supabase auth with MCP client
 * Phase 1 of Subtask 28.1: Foundation Setup
 */

import { Session } from '@supabase/supabase-js';
import { 
  MCPAuthCredentials, 
  MCPAuthStatus, 
  MCPAuthError, 
  MCPAuthErrorType,
  MCPAuthConfig,
  MCPAuthEvents,
  MCPAuthState,
  TokenValidationResult,
  MCPSecurityConfig,
  BackwardCompatibilityConfig,
  MCPAuthLoggingConfig,
  SecurityValidationResult,
  RaceConditionConfig,
  RetryMechanismConfig,
  GracefulDegradationConfig,
  SecurityReviewConfig,
  AuthOperationLock,
  CircuitBreakerStatus,
  SystemHealthStatus,
  SecurityVulnerability
} from './authTypes';
import { 
  extractMCPCredentials, 
  validateMCPToken, 
  shouldRefreshToken, 
  getAuthStatus, 
  createAuthHeaders,
  handleSupabaseAuthError,
  debugLogAuthData,
  sanitizeAuthDataForLogging
} from './authUtils';
import { SecurityValidator } from './securityValidator';
import { BackwardCompatibilityHandler } from './backwardCompatibility';
import { EnhancedAuthLogger } from './enhancedLogger';
import { RaceConditionHandler } from './raceConditionHandler';
import { RetryMechanismHandler } from './retryMechanismHandler';
import { GracefulDegradationHandler } from './gracefulDegradationHandler';
import { SecurityReviewSystem } from './securityReviewSystem';

// ============================================================================
// MCP AUTHENTICATION MANAGER
// ============================================================================

/**
 * Authentication manager for MCP client integration with Supabase
 */
export class MCPAuthManager {
  private credentials: MCPAuthCredentials | null = null;
  private authState: MCPAuthState;
  private config: Required<MCPAuthConfig>;
  private events: MCPAuthEvents;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private lastSupabaseSession: Session | null = null;

  // Phase 5: Security & Compatibility components
  private securityValidator: SecurityValidator | null = null;
  private compatibilityHandler: BackwardCompatibilityHandler | null = null;
  private enhancedLogger: EnhancedAuthLogger | null = null;
  private securityConfig: MCPSecurityConfig | null = null;
  private compatibilityConfig: BackwardCompatibilityConfig | null = null;
  private loggingConfig: MCPAuthLoggingConfig | null = null;

  // Phase 6: Edge Cases & Resilience components
  private raceConditionHandler: RaceConditionHandler | null = null;
  private retryMechanismHandler: RetryMechanismHandler | null = null;
  private gracefulDegradationHandler: GracefulDegradationHandler | null = null;
  private securityReviewSystem: SecurityReviewSystem | null = null;
  private raceConditionConfig: RaceConditionConfig | null = null;
  private retryConfig: RetryMechanismConfig | null = null;
  private degradationConfig: GracefulDegradationConfig | null = null;
  private securityReviewConfig: SecurityReviewConfig | null = null;

  constructor(
    config: MCPAuthConfig & {
      securityConfig?: MCPSecurityConfig;
      compatibilityConfig?: BackwardCompatibilityConfig;
      loggingConfig?: MCPAuthLoggingConfig;
      raceConditionConfig?: RaceConditionConfig;
      retryConfig?: RetryMechanismConfig;
      degradationConfig?: GracefulDegradationConfig;
      securityReviewConfig?: SecurityReviewConfig;
    } = {}, 
    events: MCPAuthEvents = {}
  ) {
    // Set default configuration
    this.config = {
      enableAuthentication: config.enableAuthentication ?? true,
      tokenRefreshThreshold: config.tokenRefreshThreshold ?? 5, // 5 minutes
      maxTokenAge: config.maxTokenAge ?? (24 * 60 * 60 * 1000), // 24 hours
      fallbackToAnonymous: config.fallbackToAnonymous ?? true,
      strictValidation: config.strictValidation ?? false,
      debugAuth: config.debugAuth ?? false
    };

    this.events = events;

    // Initialize auth state
    this.authState = {
      errors: [],
      isInitialized: false
    };

    // Phase 5 & 6: Initialize security, compatibility, and resilience features
    this.initializePhase5And6Components(config);

    // Debug logging
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Initialized with config:', {
        enableAuthentication: this.config.enableAuthentication,
        tokenRefreshThreshold: this.config.tokenRefreshThreshold,
        fallbackToAnonymous: this.config.fallbackToAnonymous,
        strictValidation: this.config.strictValidation,
        securityEnabled: !!this.securityValidator,
        compatibilityEnabled: !!this.compatibilityHandler,
        enhancedLoggingEnabled: !!this.enhancedLogger,
        raceConditionEnabled: !!this.raceConditionHandler,
        retryMechanismEnabled: !!this.retryMechanismHandler,
        gracefulDegradationEnabled: !!this.gracefulDegradationHandler,
        securityReviewEnabled: !!this.securityReviewSystem
      });
    }
  }

  /**
   * Initialize Phase 5 security & compatibility + Phase 6 resilience components
   */
  private initializePhase5And6Components(config: any): void {
    try {
      // Initialize security configuration and validator
      if (config.securityConfig) {
        this.securityConfig = {
          enableSecurityValidation: config.securityConfig.enableSecurityValidation ?? true,
          enableTokenSanitization: config.securityConfig.enableTokenSanitization ?? true,
          enableSecurityLogging: config.securityConfig.enableSecurityLogging ?? true,
          maxTokenAge: config.securityConfig.maxTokenAge ?? (24 * 60 * 60 * 1000),
          maxRefreshAttempts: config.securityConfig.maxRefreshAttempts ?? 3,
          securityCheckInterval: config.securityConfig.securityCheckInterval ?? (5 * 60 * 1000),
          enableIntrusionDetection: config.securityConfig.enableIntrusionDetection ?? false,
          enableRateLimiting: config.securityConfig.enableRateLimiting ?? true,
          rateLimitWindowMs: config.securityConfig.rateLimitWindowMs ?? (60 * 1000),
          maxRequestsPerWindow: config.securityConfig.maxRequestsPerWindow ?? 100,
          enableAuditLogging: config.securityConfig.enableAuditLogging ?? true,
          restrictedHeaders: config.securityConfig.restrictedHeaders ?? ['x-debug', 'x-admin'],
          allowedOrigins: config.securityConfig.allowedOrigins ?? [],
          tokenEncryption: {
            enabled: config.securityConfig.tokenEncryption?.enabled ?? false,
            algorithm: config.securityConfig.tokenEncryption?.algorithm ?? 'AES-256-GCM',
            keyRotationInterval: config.securityConfig.tokenEncryption?.keyRotationInterval ?? (7 * 24 * 60 * 60 * 1000)
          }
        };
        this.securityValidator = new SecurityValidator(this.securityConfig);
      }

      // Initialize backward compatibility configuration and handler
      if (config.compatibilityConfig) {
        this.compatibilityConfig = {
          enableLegacySupport: config.compatibilityConfig.enableLegacySupport ?? true,
          legacyTokenFormats: config.compatibilityConfig.legacyTokenFormats ?? ['simple_token', 'session_based'],
          migrationMode: config.compatibilityConfig.migrationMode ?? 'permissive',
          deprecationWarnings: config.compatibilityConfig.deprecationWarnings ?? true,
          legacyEventSupport: config.compatibilityConfig.legacyEventSupport ?? true,
          versionCompatibility: {
            minSupportedVersion: config.compatibilityConfig.versionCompatibility?.minSupportedVersion ?? '1.0.0',
            currentVersion: config.compatibilityConfig.versionCompatibility?.currentVersion ?? '2.0.0',
            migrationPath: config.compatibilityConfig.versionCompatibility?.migrationPath ?? []
          },
          featureFlags: {
            enableNewAuthFlow: config.compatibilityConfig.featureFlags?.enableNewAuthFlow ?? true,
            enableLegacyFallback: config.compatibilityConfig.featureFlags?.enableLegacyFallback ?? true,
            enableProgressiveUpgrade: config.compatibilityConfig.featureFlags?.enableProgressiveUpgrade ?? true
          }
        };
        this.compatibilityHandler = new BackwardCompatibilityHandler(this.compatibilityConfig);
      }

      // Initialize enhanced logging configuration and logger
      if (config.loggingConfig) {
        this.loggingConfig = {
          enableAuthLogging: config.loggingConfig.enableAuthLogging ?? true,
          enableSecurityLogging: config.loggingConfig.enableSecurityLogging ?? true,
          enablePerformanceLogging: config.loggingConfig.enablePerformanceLogging ?? false,
          enableAuditLogging: config.loggingConfig.enableAuditLogging ?? true,
          logLevel: config.loggingConfig.logLevel ?? 'info',
          logDestination: config.loggingConfig.logDestination ?? 'console',
          logFormat: config.loggingConfig.logFormat ?? 'json',
          sensitiveDataRedaction: config.loggingConfig.sensitiveDataRedaction ?? true,
          maxLogFileSize: config.loggingConfig.maxLogFileSize ?? (10 * 1024 * 1024), // 10MB
          logRetentionDays: config.loggingConfig.logRetentionDays ?? 30,
          enableLogRotation: config.loggingConfig.enableLogRotation ?? true,
          logCategories: {
            authentication: config.loggingConfig.logCategories?.authentication ?? true,
            authorization: config.loggingConfig.logCategories?.authorization ?? true,
            tokenManagement: config.loggingConfig.logCategories?.tokenManagement ?? true,
            securityViolations: config.loggingConfig.logCategories?.securityViolations ?? true,
            performanceMetrics: config.loggingConfig.logCategories?.performanceMetrics ?? false,
            errorTracking: config.loggingConfig.logCategories?.errorTracking ?? true
          },
          customLogFields: config.loggingConfig.customLogFields ?? {}
        };
        this.enhancedLogger = new EnhancedAuthLogger(this.loggingConfig);
      }

      // Phase 6: Initialize resilience and edge case handling components
      if (config.raceConditionConfig) {
        this.raceConditionConfig = {
          enableRaceConditionProtection: config.raceConditionConfig.enableRaceConditionProtection ?? true,
          operationTimeout: config.raceConditionConfig.operationTimeout ?? (30 * 1000), // 30 seconds
          maxConcurrentOperations: config.raceConditionConfig.maxConcurrentOperations ?? 5,
          lockTimeout: config.raceConditionConfig.lockTimeout ?? (10 * 1000), // 10 seconds
          conflictResolutionStrategy: config.raceConditionConfig.conflictResolutionStrategy ?? 'first-wins',
          enableDeadlockDetection: config.raceConditionConfig.enableDeadlockDetection ?? true,
          deadlockTimeout: config.raceConditionConfig.deadlockTimeout ?? (60 * 1000) // 60 seconds
        };
        this.raceConditionHandler = new RaceConditionHandler(this.raceConditionConfig);
      }

      if (config.retryConfig) {
        this.retryConfig = {
          enableRetryMechanism: config.retryConfig.enableRetryMechanism ?? true,
          maxRetryAttempts: config.retryConfig.maxRetryAttempts ?? 3,
          baseRetryDelay: config.retryConfig.baseRetryDelay ?? 1000, // 1 second
          maxRetryDelay: config.retryConfig.maxRetryDelay ?? (30 * 1000), // 30 seconds
          retryBackoffStrategy: config.retryConfig.retryBackoffStrategy ?? 'exponential',
          retryableErrors: config.retryConfig.retryableErrors ?? ['NETWORK_ERROR', 'SUPABASE_ERROR', 'REFRESH_FAILED'],
          nonRetryableErrors: config.retryConfig.nonRetryableErrors ?? ['INVALID_TOKEN', 'VALIDATION_ERROR'],
          circuitBreakerThreshold: config.retryConfig.circuitBreakerThreshold ?? 5,
          circuitBreakerTimeout: config.retryConfig.circuitBreakerTimeout ?? (60 * 1000), // 60 seconds
          enableRetryJitter: config.retryConfig.enableRetryJitter ?? true,
          jitterFactor: config.retryConfig.jitterFactor ?? 0.1
        };
        this.retryMechanismHandler = new RetryMechanismHandler(this.retryConfig);
      }

      if (config.degradationConfig) {
        this.degradationConfig = {
          enableGracefulDegradation: config.degradationConfig.enableGracefulDegradation ?? true,
          degradationLevels: config.degradationConfig.degradationLevels ?? this.getDefaultDegradationLevels(),
          fallbackStrategies: config.degradationConfig.fallbackStrategies ?? this.getDefaultFallbackStrategies(),
          healthCheckInterval: config.degradationConfig.healthCheckInterval ?? (30 * 1000), // 30 seconds
          recoveryThreshold: config.degradationConfig.recoveryThreshold ?? 80, // 80% success rate
          degradationThreshold: config.degradationConfig.degradationThreshold ?? 25, // 25% failure rate
          enableAutoRecovery: config.degradationConfig.enableAutoRecovery ?? true,
          maxDegradationLevel: config.degradationConfig.maxDegradationLevel ?? 3
        };
        this.gracefulDegradationHandler = new GracefulDegradationHandler(this.degradationConfig);
      }

      if (config.securityReviewConfig) {
        this.securityReviewConfig = {
          enableSecurityReview: config.securityReviewConfig.enableSecurityReview ?? false,
          penetrationTestingLevel: config.securityReviewConfig.penetrationTestingLevel ?? 'basic',
          securityScanInterval: config.securityReviewConfig.securityScanInterval ?? (24 * 60 * 60 * 1000), // 24 hours
          vulnerabilityThresholds: {
            critical: config.securityReviewConfig.vulnerabilityThresholds?.critical ?? 0,
            high: config.securityReviewConfig.vulnerabilityThresholds?.high ?? 2,
            medium: config.securityReviewConfig.vulnerabilityThresholds?.medium ?? 5,
            low: config.securityReviewConfig.vulnerabilityThresholds?.low ?? 10
          },
          enableAutomaticPatching: config.securityReviewConfig.enableAutomaticPatching ?? false,
          securityReportFormat: config.securityReviewConfig.securityReportFormat ?? 'json',
          complianceStandards: config.securityReviewConfig.complianceStandards ?? ['OWASP_TOP_10']
        };
        this.securityReviewSystem = new SecurityReviewSystem(this.securityReviewConfig);
      }

      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Phase 5 & 6 components initialized', {
          securityValidator: !!this.securityValidator,
          compatibilityHandler: !!this.compatibilityHandler,
          enhancedLogger: !!this.enhancedLogger,
          raceConditionHandler: !!this.raceConditionHandler,
          retryMechanismHandler: !!this.retryMechanismHandler,
          gracefulDegradationHandler: !!this.gracefulDegradationHandler,
          securityReviewSystem: !!this.securityReviewSystem
        });
      }

    } catch (error) {
      console.error('[MCP Auth Manager] Failed to initialize Phase 5 & 6 components:', error);
      // Continue without Phase 5 & 6 features if initialization fails
    }
  }

  /**
   * Get default degradation levels for graceful degradation
   */
  private getDefaultDegradationLevels(): any[] {
    return [
      {
        level: 0,
        name: 'Normal Operation',
        description: 'All authentication features enabled',
        disabledFeatures: [],
        enabledFeatures: ['auth', 'refresh', 'validate', 'security', 'compatibility'],
        performanceTargets: {
          maxResponseTime: 2000,
          maxErrorRate: 5,
          minSuccessRate: 95
        },
        fallbackBehavior: {
          useCache: false,
          allowAnonymous: false,
          skipValidation: false,
          simplifiedAuth: false
        }
      },
      {
        level: 1,
        name: 'Reduced Security',
        description: 'Simplified security validation',
        disabledFeatures: ['complex_validation', 'penetration_testing'],
        enabledFeatures: ['auth', 'refresh', 'basic_validate'],
        performanceTargets: {
          maxResponseTime: 3000,
          maxErrorRate: 10,
          minSuccessRate: 90
        },
        fallbackBehavior: {
          useCache: true,
          allowAnonymous: false,
          skipValidation: true,
          simplifiedAuth: false
        }
      },
      {
        level: 2,
        name: 'Basic Authentication',
        description: 'Core authentication only',
        disabledFeatures: ['security_review', 'compatibility_migration', 'enhanced_logging'],
        enabledFeatures: ['auth', 'basic_refresh'],
        performanceTargets: {
          maxResponseTime: 5000,
          maxErrorRate: 20,
          minSuccessRate: 80
        },
        fallbackBehavior: {
          useCache: true,
          allowAnonymous: true,
          skipValidation: true,
          simplifiedAuth: true
        }
      },
      {
        level: 3,
        name: 'Emergency Mode',
        description: 'Minimal authentication for critical operations',
        disabledFeatures: ['refresh', 'validation', 'security', 'compatibility'],
        enabledFeatures: ['emergency_auth'],
        performanceTargets: {
          maxResponseTime: 10000,
          maxErrorRate: 50,
          minSuccessRate: 50
        },
        fallbackBehavior: {
          useCache: true,
          allowAnonymous: true,
          skipValidation: true,
          simplifiedAuth: true
        }
      }
    ];
  }

  /**
   * Get default fallback strategies for graceful degradation
   */
  private getDefaultFallbackStrategies(): any[] {
    return [
      {
        name: 'Cache Fallback',
        triggerConditions: ['auth', 'refresh'],
        actions: [
          {
            type: 'cache',
            parameters: { maxAge: 300000 }, // 5 minutes
            timeout: 1000
          }
        ],
        priority: 1,
        timeout: 5000
      },
      {
        name: 'Anonymous Access',
        triggerConditions: ['auth', 'validate'],
        actions: [
          {
            type: 'anonymous',
            parameters: { scope: 'read_only' },
            timeout: 500
          }
        ],
        priority: 2,
        timeout: 2000
      },
      {
        name: 'Simplified Auth',
        triggerConditions: ['refresh', 'validate'],
        actions: [
          {
            type: 'simplified',
            parameters: { skipComplexValidation: true },
            timeout: 1000
          }
        ],
        priority: 3,
        timeout: 3000
      },
      {
        name: 'Offline Mode',
        triggerConditions: ['auth', 'refresh', 'validate'],
        actions: [
          {
            type: 'offline',
            parameters: { duration: 600000 }, // 10 minutes
            timeout: 100
          }
        ],
        priority: 4,
        timeout: 1000
      }
    ];
  }

  // ============================================================================
  // PUBLIC AUTH INTERFACE
  // ============================================================================

  /**
   * Initialize authentication with Supabase session
   */
  async initializeAuth(session: Session | null): Promise<void> {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Initializing authentication', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        sessionEmail: session?.user?.email
      });
    }

    try {
      if (!this.config.enableAuthentication) {
        this.setAnonymousAuth();
        return;
      }

      if (!session) {
        this.handleNoSession();
        return;
      }

      // Extract credentials from Supabase session
      const credentials = extractMCPCredentials(session);
      if (!credentials) {
        throw new Error('Failed to extract credentials from Supabase session');
      }

      // Validate extracted credentials
      const validation = validateMCPToken(credentials);
      if (!validation.isValid) {
        throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`);
      }

      // Store credentials and session
      this.credentials = credentials;
      this.lastSupabaseSession = session;
      this.authState.credentials = credentials;
      this.authState.lastValidation = Date.now();
      this.authState.isInitialized = true;

      // Clear previous errors
      this.authState.errors = [];

      // Set up automatic refresh if needed
      this.scheduleTokenRefresh();

      // Fire success event
      this.events.onAuthSuccess?.(credentials);
      this.events.onAuthStatusChange?.(this.getAuthStatus());

      if (this.config.debugAuth) {
        debugLogAuthData(credentials, 'Successfully initialized');
      }

    } catch (error) {
      const authError = handleSupabaseAuthError(error);
      this.handleAuthError(authError, 'initializeAuth');
    }
  }

  /**
   * Update authentication with new Supabase session
   */
  async updateAuth(session: Session | null): Promise<void> {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Updating authentication', {
        hadCredentials: !!this.credentials,
        hasNewSession: !!session,
        sessionChanged: session !== this.lastSupabaseSession
      });
    }

    // Only update if session actually changed
    if (session === this.lastSupabaseSession) {
      return;
    }

    await this.initializeAuth(session);
  }

  /**
   * Refresh authentication credentials
   */
  async refreshAuth(newSession?: Session): Promise<void> {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Refreshing authentication', {
        hasCurrentCredentials: !!this.credentials,
        hasNewSession: !!newSession,
        shouldRefreshCurrent: this.credentials ? shouldRefreshToken(this.credentials, this.config.tokenRefreshThreshold) : false
      });
    }

    try {
      if (newSession) {
        // Use new session for refresh
        await this.initializeAuth(newSession);
      } else if (this.credentials && shouldRefreshToken(this.credentials, this.config.tokenRefreshThreshold)) {
        // Attempt to refresh current credentials
        // Note: In a full implementation, this would call Supabase refresh
        // For now, we'll trigger an auth failure to prompt higher-level refresh
        throw new Error('Token refresh required - please refresh Supabase session');
      }

      this.authState.refreshAttempts = 0;
      this.lastAuthRefresh = Date.now();

      // Fire refresh event
      if (this.credentials) {
        this.events.onTokenRefresh?.(this.credentials);
      }

    } catch (error) {
      this.authState.refreshAttempts = (this.authState.refreshAttempts || 0) + 1;
      const authError = handleSupabaseAuthError(error);
      this.handleAuthError(authError, 'refreshAuth');
    }
  }

  /**
   * Clear authentication (legacy method - use coordinatedLogout for Phase 4)
   */
  clearAuth(): void {
    this.coordinatedLogout('internal');
  }

  // ============================================================================
  // PHASE 4: COORDINATED LOGOUT & CLEANUP
  // ============================================================================

  /**
   * Coordinated logout across both Supabase and MCP systems (Phase 4)
   */
  async coordinatedLogout(source: 'supabase' | 'mcp' | 'internal' | 'user' = 'user'): Promise<void> {
    const logoutId = `logout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Starting coordinated logout', {
        source,
        logoutId,
        hasCredentials: !!this.credentials,
        hasSession: !!this.lastSupabaseSession
      });
    }

    try {
      // Phase 4: Enhanced logout sequence
      await this.performLogoutSequence(source, logoutId);
      
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Coordinated logout completed', { logoutId });
      }

    } catch (error) {
      // Even if logout fails, ensure local state is cleared
      this.forceCleanup();
      
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Logout error, forced cleanup performed', { 
          logoutId, 
          error: error instanceof Error ? error.message : error 
        });
      }
      
      throw error;
    }
  }

  /**
   * Perform logout sequence with session invalidation (Phase 4)
   */
  private async performLogoutSequence(source: string, logoutId: string): Promise<void> {
    const currentCredentials = this.credentials;
    const currentSession = this.lastSupabaseSession;

    // Step 1: Invalidate active sessions
    await this.invalidateActiveSessions(logoutId);

    // Step 2: Clear refresh mechanisms
    this.clearRefreshMechanisms();

    // Step 3: Clean stored auth state  
    this.cleanStoredAuthState();

    // Step 4: Fire logout events
    this.fireLogoutEvents(source, currentCredentials, currentSession);

    // Step 5: Reset authentication state
    this.resetAuthenticationState();
  }

  /**
   * Invalidate active sessions for MCP connections (Phase 4)
   */
  private async invalidateActiveSessions(logoutId: string): Promise<void> {
    if (!this.credentials) {
      return;
    }

    try {
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Invalidating active sessions', { 
          logoutId,
          userId: this.credentials.userId 
        });
      }

      // Mark credentials as invalidated
      if (this.credentials) {
        this.credentials.expiresAt = Date.now() - 1000; // Set to past time
      }

      // Fire session invalidation event
      this.events.onTokenExpired?.(this.credentials);

      // Note: In a full implementation, this would also:
      // - Notify any active MCP connections to close
      // - Invalidate any cached credentials in external systems
      // - Revoke tokens if the backend supports it

    } catch (error) {
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Session invalidation error', { 
          logoutId, 
          error: error instanceof Error ? error.message : error 
        });
      }
      // Continue with logout even if invalidation fails
    }
  }

  /**
   * Clear all refresh mechanisms and timeouts (Phase 4)
   */
  private clearRefreshMechanisms(): void {
    // Clear refresh timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    // Reset refresh state
    this.authState.refreshAttempts = 0;
    this.lastAuthRefresh = null;
  }

  /**
   * Clean stored authentication state (Phase 4)
   */
  private cleanStoredAuthState(): void {
    // Clear credentials
    this.credentials = null;
    this.lastSupabaseSession = null;

    // Clear auth state
    this.authState.credentials = undefined;
    this.authState.errors = [];
    this.authState.lastValidation = undefined;

    // Note: In a full implementation, this might also:
    // - Clear any localStorage/sessionStorage entries
    // - Clear any cached data associated with the user
    // - Reset any user-specific configuration
  }

  /**
   * Fire appropriate logout events (Phase 4)
   */
  private fireLogoutEvents(
    source: string, 
    credentials: MCPAuthCredentials | null, 
    session: Session | null
  ): void {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Firing logout events', { source });
    }

    // Fire auth status change event
    this.events.onAuthStatusChange?.(this.getAuthStatus());

    // Note: Could add custom logout events here:
    // this.events.onLogout?.(source, credentials, session);
  }

  /**
   * Reset authentication state to initial values (Phase 4)
   */
  private resetAuthenticationState(): void {
    this.authState.isInitialized = false;
    
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Authentication state reset');
    }
  }

  /**
   * Force cleanup for partial logout scenarios (Phase 4)
   */
  forceCleanup(): void {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Performing force cleanup');
    }

    try {
      this.clearRefreshMechanisms();
      this.cleanStoredAuthState(); 
      this.resetAuthenticationState();
      this.events.onAuthStatusChange?.(this.getAuthStatus());
    } catch (error) {
      // Swallow errors during force cleanup
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Error during force cleanup', { error });
      }
    }
  }

  /**
   * Handle partial logout scenarios (Phase 4)
   */
  async handlePartialLogout(scenario: 'network_error' | 'timeout' | 'server_error'): Promise<void> {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Handling partial logout', { scenario });
    }

    switch (scenario) {
      case 'network_error':
        // Network issue - clear local state but mark for retry
        this.forceCleanup();
        break;
        
      case 'timeout':
        // Timeout - force immediate cleanup
        this.forceCleanup();
        break;
        
      case 'server_error':
        // Server error - try graceful logout, fallback to force cleanup
        try {
          await this.coordinatedLogout('internal');
        } catch {
          this.forceCleanup();
        }
        break;
    }
  }

  /**
   * Get logout status and timing information (Phase 4)
   */
  getLogoutStatus(): {
    isLoggedOut: boolean;
    hasActiveRefresh: boolean;
    hasStoredCredentials: boolean;
    timeSinceLastRefresh: number | null;
  } {
    return {
      isLoggedOut: !this.credentials && !this.lastSupabaseSession,
      hasActiveRefresh: !!this.refreshTimeout,
      hasStoredCredentials: !!this.credentials,
      timeSinceLastRefresh: this.lastAuthRefresh ? Date.now() - this.lastAuthRefresh : null
    };
  }

  // ============================================================================
  // PHASE 5: SECURITY & COMPATIBILITY INTEGRATION
  // ============================================================================

  /**
   * Validate credentials with comprehensive security checks (Phase 5)
   */
  validateCredentialsWithSecurity(
    credentials: MCPAuthCredentials,
    context?: Record<string, any>
  ): SecurityValidationResult | null {
    if (!this.securityValidator) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      const result = this.securityValidator.validateCredentials(credentials, context);
      
      // Log performance metrics
      if (this.enhancedLogger) {
        this.enhancedLogger.logPerformanceMetric(
          'security_validation',
          Date.now() - startTime,
          credentials,
          { violationCount: result.violations.length, securityLevel: result.securityLevel }
        );
      }

      // Log security violations if any
      if (result.violations.length > 0 && this.enhancedLogger) {
        this.enhancedLogger.logSecurityViolation(result.violations, credentials, {
          action: 'credential_validation',
          riskScore: this.calculateRiskScore(result.violations)
        });
      }

      return result;

    } catch (error) {
      if (this.enhancedLogger) {
        this.enhancedLogger.logError(error, credentials, {
          operation: 'security_validation',
          additionalContext: { context }
        });
      }

      return {
        isValid: false,
        securityLevel: 'critical',
        violations: [{
          type: 'validation_error' as any,
          severity: 'critical',
          message: `Security validation failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now()
        }],
        recommendations: ['Review security validation system'],
        validationTimestamp: Date.now()
      };
    }
  }

  /**
   * Handle legacy authentication data with backward compatibility (Phase 5)
   */
  handleLegacyAuth(legacyData: any): {
    success: boolean;
    credentials: MCPAuthCredentials | null;
    warnings: string[];
    migrationRequired: boolean;
  } {
    if (!this.compatibilityHandler) {
      return {
        success: false,
        credentials: null,
        warnings: ['Backward compatibility is not enabled'],
        migrationRequired: false
      };
    }

    const startTime = Date.now();

    try {
      const migrationResult = this.compatibilityHandler.migrateLegacyAuth(legacyData);

      if (this.enhancedLogger) {
        this.enhancedLogger.logPerformanceMetric(
          'legacy_migration',
          Date.now() - startTime,
          migrationResult.credentials,
          { migrationStatus: migrationResult.migrationStatus }
        );

        this.enhancedLogger.logAuthEvent('auth_success', migrationResult.credentials, {
          action: 'legacy_auth_migration',
          result: migrationResult.migrationStatus === 'failed' ? 'failure' : 'success',
          details: {
            migrationStatus: migrationResult.migrationStatus,
            warningCount: migrationResult.warnings.length,
            deprecationNotices: migrationResult.deprecationNotices.length
          }
        });
      }

      return {
        success: migrationResult.migrationStatus !== 'failed',
        credentials: migrationResult.credentials,
        warnings: [...migrationResult.warnings, ...migrationResult.deprecationNotices],
        migrationRequired: migrationResult.migrationStatus !== 'success'
      };

    } catch (error) {
      if (this.enhancedLogger) {
        this.enhancedLogger.logError(error, null, {
          operation: 'legacy_auth_migration',
          additionalContext: { legacyDataType: typeof legacyData }
        });
      }

      return {
        success: false,
        credentials: null,
        warnings: [`Legacy migration failed: ${error instanceof Error ? error.message : String(error)}`],
        migrationRequired: true
      };
    }
  }

  /**
   * Enhanced error handling with comprehensive logging (Phase 5)
   */
  private handleEnhancedAuthError(error: any, operation: string, credentials?: MCPAuthCredentials): void {
    const authError = handleSupabaseAuthError(error);
    
    // Add to auth state errors
    this.authState.errors = this.authState.errors || [];
    this.authState.errors.push(authError);

    // Enhanced logging
    if (this.enhancedLogger) {
      this.enhancedLogger.logError(authError, credentials || null, {
        operation,
        stackTrace: error instanceof Error ? error.stack : undefined,
        additionalContext: {
          errorType: authError.type,
          hasCredentials: !!credentials,
          authStateInitialized: this.authState.isInitialized
        }
      });
    }

    // Fire error event
    this.events.onAuthFailure?.(authError, operation);

    // Debug logging
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Enhanced error handling', {
        operation,
        errorType: authError.type,
        message: authError.message,
        hasCredentials: !!credentials
      });
    }
  }

  /**
   * Integration testing with existing auth flows (Phase 5)
   */
  runIntegrationTests(): {
    passed: boolean;
    results: Array<{
      testName: string;
      passed: boolean;
      message: string;
      duration: number;
    }>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalDuration: number;
    };
  } {
    const results: Array<{
      testName: string;
      passed: boolean;
      message: string;
      duration: number;
    }> = [];

    const testStartTime = Date.now();

    // Test 1: Basic authentication flow
    const test1Start = Date.now();
    try {
      const mockSession = this.createMockSession();
      const extractedCredentials = extractMCPCredentials(mockSession);
      const isValid = extractedCredentials !== null;
      
      results.push({
        testName: 'Basic Authentication Flow',
        passed: isValid,
        message: isValid ? 'Successfully extracted credentials from mock session' : 'Failed to extract credentials',
        duration: Date.now() - test1Start
      });
    } catch (error) {
      results.push({
        testName: 'Basic Authentication Flow',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - test1Start
      });
    }

    // Test 2: Security validation (if enabled)
    if (this.securityValidator) {
      const test2Start = Date.now();
      try {
        const mockCredentials = this.createMockCredentials();
        const validationResult = this.securityValidator.validateCredentials(mockCredentials);
        const passed = validationResult.isValid;
        
        results.push({
          testName: 'Security Validation',
          passed,
          message: passed ? 'Security validation working correctly' : `Security issues detected: ${validationResult.violations.length} violations`,
          duration: Date.now() - test2Start
        });
      } catch (error) {
        results.push({
          testName: 'Security Validation',
          passed: false,
          message: `Security validation test failed: ${error instanceof Error ? error.message : String(error)}`,
          duration: Date.now() - test2Start
        });
      }
    }

    // Test 3: Backward compatibility (if enabled)
    if (this.compatibilityHandler) {
      const test3Start = Date.now();
      try {
        const legacyData = { token: 'test-token', userId: 'test-user', email: 'test@example.com' };
        const migrationResult = this.compatibilityHandler.migrateLegacyAuth(legacyData);
        const passed = migrationResult.migrationStatus !== 'failed';
        
        results.push({
          testName: 'Backward Compatibility',
          passed,
          message: passed ? 'Legacy migration working correctly' : 'Legacy migration failed',
          duration: Date.now() - test3Start
        });
      } catch (error) {
        results.push({
          testName: 'Backward Compatibility',
          passed: false,
          message: `Compatibility test failed: ${error instanceof Error ? error.message : String(error)}`,
          duration: Date.now() - test3Start
        });
      }
    }

    // Test 4: Enhanced logging (if enabled)
    if (this.enhancedLogger) {
      const test4Start = Date.now();
      try {
        const mockCredentials = this.createMockCredentials();
        this.enhancedLogger.logAuthEvent('auth_success', mockCredentials, {
          action: 'integration_test',
          result: 'success',
          details: { testRun: true }
        });
        
        results.push({
          testName: 'Enhanced Logging',
          passed: true,
          message: 'Enhanced logging working correctly',
          duration: Date.now() - test4Start
        });
      } catch (error) {
        results.push({
          testName: 'Enhanced Logging',
          passed: false,
          message: `Logging test failed: ${error instanceof Error ? error.message : String(error)}`,
          duration: Date.now() - test4Start
        });
      }
    }

    // Test 5: Error handling
    const test5Start = Date.now();
    try {
      const testError = new Error('Test error for integration testing');
      this.handleEnhancedAuthError(testError, 'integration_test');
      
      results.push({
        testName: 'Error Handling',
        passed: true,
        message: 'Error handling working correctly',
        duration: Date.now() - test5Start
      });
    } catch (error) {
      results.push({
        testName: 'Error Handling',
        passed: false,
        message: `Error handling test failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - test5Start
      });
    }

    const totalDuration = Date.now() - testStartTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    return {
      passed: failedTests === 0,
      results,
      summary: {
        totalTests: results.length,
        passedTests,
        failedTests,
        totalDuration
      }
    };
  }

  /**
   * Create mock session for testing
   */
  private createMockSession(): any {
    return {
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      expires_at: Math.floor((Date.now() + 60 * 60 * 1000) / 1000), // 1 hour from now
      token_type: 'bearer',
      user: {
        id: 'mock-user-id-' + Date.now(),
        email: 'test@example.com'
      }
    };
  }

  /**
   * Create mock credentials for testing
   */
  private createMockCredentials(): MCPAuthCredentials {
    return {
      bearerToken: 'mock-bearer-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      userId: 'mock-user-id-' + Date.now(),
      userEmail: 'test@example.com',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      tokenSource: 'supabase'
    };
  }

  /**
   * Calculate risk score from violations
   */
  private calculateRiskScore(violations: any[]): number {
    let score = 0;
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical': score += 25; break;
        case 'high': score += 15; break;
        case 'medium': score += 8; break;
        case 'low': score += 3; break;
      }
    }
    return Math.min(100, score);
  }

  /**
   * Get Phase 5 feature status
   */
  getPhase5Status(): {
    securityValidation: { enabled: boolean; config?: MCPSecurityConfig };
    backwardCompatibility: { enabled: boolean; config?: BackwardCompatibilityConfig };
    enhancedLogging: { enabled: boolean; config?: MCPAuthLoggingConfig };
  } {
    return {
      securityValidation: {
        enabled: !!this.securityValidator,
        config: this.securityConfig || undefined
      },
      backwardCompatibility: {
        enabled: !!this.compatibilityHandler,
        config: this.compatibilityConfig || undefined
      },
      enhancedLogging: {
        enabled: !!this.enhancedLogger,
        config: this.loggingConfig || undefined
      }
    };
  }

  // ============================================================================
  // PHASE 6: EDGE CASES & RESILIENCE INTEGRATION
  // ============================================================================

  /**
   * Execute authentication operation with race condition protection (Phase 6)
   */
  async executeWithRaceConditionProtection<T>(
    operationType: 'auth' | 'refresh' | 'logout' | 'validate',
    operation: () => Promise<T>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: Record<string, any>
  ): Promise<{ success: boolean; result?: T; error?: MCPAuthError; lockTime?: number }> {
    if (!this.raceConditionHandler) {
      try {
        const result = await operation();
        return { success: true, result };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof MCPAuthError ? error : new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, String(error))
        };
      }
    }

    const lockResult = await this.raceConditionHandler.acquireLock(operationType, 'auth_manager', priority, context);
    
    if (!lockResult.success) {
      return {
        success: false,
        error: new MCPAuthError(MCPAuthErrorType.NETWORK_ERROR, lockResult.error || 'Failed to acquire operation lock'),
        lockTime: lockResult.waitTime
      };
    }

    try {
      const result = await operation();
      return { success: true, result, lockTime: lockResult.waitTime };
    } catch (error) {
      return {
        success: false,
        error: error instanceof MCPAuthError ? error : new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, String(error)),
        lockTime: lockResult.waitTime
      };
    } finally {
      if (lockResult.lockId) {
        this.raceConditionHandler.releaseLock(lockResult.lockId);
      }
    }
  }

  /**
   * Execute authentication operation with retry logic (Phase 6)
   */
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<{ success: boolean; result?: T; error?: MCPAuthError; attempts: any[] }> {
    if (!this.retryMechanismHandler) {
      try {
        const result = await operation();
        return { success: true, result, attempts: [] };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof MCPAuthError ? error : new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, String(error)),
          attempts: []
        };
      }
    }

    return await this.retryMechanismHandler.executeWithRetry(operationId, operation, context);
  }

  /**
   * Execute authentication operation with graceful degradation (Phase 6)
   */
  async executeWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    operationType: string,
    context?: Record<string, any>
  ): Promise<{ success: boolean; result?: T; error?: MCPAuthError; usedFallback?: string; degradationLevel: number }> {
    if (!this.gracefulDegradationHandler) {
      try {
        const result = await operation();
        return { success: true, result, degradationLevel: 0 };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof MCPAuthError ? error : new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, String(error)),
          degradationLevel: 0
        };
      }
    }

    return await this.gracefulDegradationHandler.executeWithFallback(operation, operationType, context);
  }

  /**
   * Perform comprehensive security review (Phase 6)
   */
  async performSecurityReview(): Promise<{
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
    complianceStatus: Record<string, boolean>;
    testResults: any[];
  } | null> {
    if (!this.securityReviewSystem) {
      return null;
    }

    return await this.securityReviewSystem.performSecurityReview();
  }

  /**
   * Enable full protection mode with all Phase 6 components (Phase 6)
   */
  enableFullProtectionMode(): void {
    if (!this.raceConditionHandler || !this.retryMechanismHandler || 
        !this.gracefulDegradationHandler || !this.securityReviewSystem) {
      throw new Error('All Phase 6 components must be initialized before enabling full protection mode');
    }

    // Enable all protection mechanisms
    this.raceConditionHandler.setEnabled(true);
    this.retryMechanismHandler.setEnabled(true);
    this.gracefulDegradationHandler.setEnabled(true);
    this.securityReviewSystem.setEnabled(true);

    console.log('[MCP Auth Manager] Full protection mode enabled - all Phase 6 components active');
  }

  /**
   * Execute authentication operation with full Phase 6 protection (Phase 6)
   */
  async executeWithFullProtection<T>(
    operationType: 'auth' | 'refresh' | 'logout' | 'validate',
    operation: () => Promise<T>,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      enableRetry?: boolean;
      enableDegradation?: boolean;
      context?: Record<string, any>;
    } = {}
  ): Promise<{
    success: boolean;
    result?: T;
    error?: MCPAuthError;
    protection: {
      usedRaceProtection: boolean;
      usedRetry: boolean;
      usedDegradation: boolean;
      lockTime?: number;
      attempts?: any[];
      usedFallback?: string;
      degradationLevel: number;
    };
  }> {
    const protection = {
      usedRaceProtection: !!this.raceConditionHandler,
      usedRetry: options.enableRetry !== false && !!this.retryMechanismHandler,
      usedDegradation: options.enableDegradation !== false && !!this.gracefulDegradationHandler,
      degradationLevel: 0
    };

    let finalOperation = operation;

    // Wrap with graceful degradation if enabled
    if (protection.usedDegradation) {
      finalOperation = async () => {
        const result = await this.executeWithGracefulDegradation(operation, operationType, options.context);
        protection.degradationLevel = result.degradationLevel;
        protection.usedFallback = result.usedFallback;
        if (!result.success) {
          throw result.error || new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, 'Degradation failed');
        }
        return result.result as T;
      };
    }

    // Wrap with retry if enabled
    if (protection.usedRetry) {
      const retryOperation = finalOperation;
      finalOperation = async () => {
        const operationId = `${operationType}_${Date.now()}`;
        const result = await this.retryMechanismHandler!.executeWithRetry(operationId, retryOperation, options.context);
        protection.attempts = result.attempts;
        if (!result.success) {
          throw result.error || new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, 'Retry failed');
        }
        return result.result as T;
      };
    }

    // Wrap with race condition protection if enabled
    if (protection.usedRaceProtection) {
      const result = await this.executeWithRaceConditionProtection(
        operationType,
        finalOperation,
        options.priority,
        options.context
      );
      
      protection.lockTime = result.lockTime;
      
      return {
        success: result.success,
        result: result.result,
        error: result.error,
        protection
      };
    } else {
      // Execute without race protection
      try {
        const result = await finalOperation();
        return { success: true, result, protection };
      } catch (error) {
        return {
          success: false,
          error: error instanceof MCPAuthError ? error : new MCPAuthError(MCPAuthErrorType.UNKNOWN_ERROR, String(error)),
          protection
        };
      }
    }
  }

  /**
   * Get comprehensive system health status (Phase 6)
   */
  getSystemHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'critical' | 'offline';
    raceConditionStatus?: any;
    retryMechanismStatus?: any;
    degradationStatus?: any;
    securityStatus?: any;
  } {
    const status: any = {
      overall: 'healthy'
    };

    if (this.raceConditionHandler) {
      status.raceConditionStatus = this.raceConditionHandler.getLockStatus();
    }

    if (this.retryMechanismHandler) {
      status.retryMechanismStatus = {
        circuitBreaker: this.retryMechanismHandler.getCircuitBreakerStatus(),
        statistics: this.retryMechanismHandler.getRetryStatistics()
      };
    }

    if (this.gracefulDegradationHandler) {
      status.degradationStatus = {
        currentLevel: this.gracefulDegradationHandler.getDegradationLevel(),
        systemHealth: this.gracefulDegradationHandler.getSystemHealth(),
        activeFallbacks: this.gracefulDegradationHandler.getActiveFallbacks()
      };
      
      // Update overall status based on degradation
      const systemHealth = this.gracefulDegradationHandler.getSystemHealth();
      if (systemHealth.overall === 'critical' || systemHealth.overall === 'offline') {
        status.overall = systemHealth.overall;
      } else if (systemHealth.overall === 'degraded' && status.overall === 'healthy') {
        status.overall = 'degraded';
      }
    }

    if (this.securityReviewSystem) {
      status.securityStatus = {
        vulnerabilities: this.securityReviewSystem.getVulnerabilities().length,
        metrics: this.securityReviewSystem.getSecurityMetrics(),
        testResults: this.securityReviewSystem.getTestResults().length
      };
    }

    return status;
  }

  /**
   * Get Phase 6 feature status and configuration
   */
  getPhase6Status(): {
    raceConditionProtection: { enabled: boolean; config?: RaceConditionConfig };
    retryMechanism: { enabled: boolean; config?: RetryMechanismConfig };
    gracefulDegradation: { enabled: boolean; config?: GracefulDegradationConfig };
    securityReview: { enabled: boolean; config?: SecurityReviewConfig };
  } {
    return {
      raceConditionProtection: {
        enabled: !!this.raceConditionHandler,
        config: this.raceConditionConfig || undefined
      },
      retryMechanism: {
        enabled: !!this.retryMechanismHandler,
        config: this.retryConfig || undefined
      },
      gracefulDegradation: {
        enabled: !!this.gracefulDegradationHandler,
        config: this.degradationConfig || undefined
      },
      securityReview: {
        enabled: !!this.securityReviewSystem,
        config: this.securityReviewConfig || undefined
      }
    };
  }

  /**
   * Cleanup Phase 6 components
   */
  private cleanupPhase6Components(): void {
    try {
      if (this.raceConditionHandler) {
        this.raceConditionHandler.destroy();
        this.raceConditionHandler = null;
      }

      if (this.gracefulDegradationHandler) {
        this.gracefulDegradationHandler.destroy();
        this.gracefulDegradationHandler = null;
      }

      if (this.securityReviewSystem) {
        this.securityReviewSystem.destroy();
        this.securityReviewSystem = null;
      }

      // Retry mechanism handler doesn't need explicit cleanup
      this.retryMechanismHandler = null;

    } catch (error) {
      console.error('[MCP Auth Manager] Error cleaning up Phase 6 components:', error);
    }
  }

  // ============================================================================
  // AUTH STATUS & CREDENTIALS
  // ============================================================================

  /**
   * Get current authentication status
   */
  getAuthStatus(): MCPAuthStatus {
    return getAuthStatus(this.credentials);
  }

  /**
   * Get current credentials
   */
  getCredentials(): MCPAuthCredentials | null {
    return this.credentials;
  }

  /**
   * Get authentication headers for MCP requests
   */
  getAuthHeaders(): Record<string, string> {
    return createAuthHeaders(this.credentials);
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.getAuthStatus().isAuthenticated;
  }

  /**
   * Check if token is valid and not expired
   */
  hasValidToken(): boolean {
    return this.getAuthStatus().hasValidToken;
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    const status = this.getAuthStatus();
    return status.timeUntilExpiry || 0;
  }

  // ============================================================================
  // CONFIGURATION & STATE
  // ============================================================================

  /**
   * Update authentication configuration
   */
  updateConfig(newConfig: Partial<MCPAuthConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Configuration updated', newConfig);
    }

    // Re-evaluate current auth state if needed
    if (this.credentials && (newConfig.strictValidation !== undefined || newConfig.tokenRefreshThreshold !== undefined)) {
      const validation = validateMCPToken(this.credentials);
      if (!validation.isValid && this.config.strictValidation) {
        this.handleAuthError(
          new MCPAuthError(MCPAuthErrorType.VALIDATION_ERROR, 'Credentials failed strict validation'),
          'updateConfig'
        );
      } else if (shouldRefreshToken(this.credentials, this.config.tokenRefreshThreshold)) {
        this.scheduleTokenRefresh();
      }
    }
  }

  /**
   * Get current auth state
   */
  getAuthState(): MCPAuthState {
    return { ...this.authState };
  }

  /**
   * Get sanitized auth data for logging
   */
  getSanitizedAuthData(): any {
    if (!this.credentials) {
      return { hasCredentials: false };
    }
    return sanitizeAuthDataForLogging(this.credentials);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: MCPAuthError, context: string): void {
    this.authState.errors.push(error);
    
    // Keep only recent errors (last 10)
    if (this.authState.errors.length > 10) {
      this.authState.errors = this.authState.errors.slice(-10);
    }

    if (this.config.debugAuth) {
      console.error(`[MCP Auth Manager] Auth error in ${context}:`, {
        type: error.type,
        message: error.message,
        context: error.context
      });
    }

    // Fire error event
    this.events.onAuthFailure?.(error, context);
    this.events.onAuthStatusChange?.(this.getAuthStatus());

    // Handle fallback to anonymous if enabled
    if (this.config.fallbackToAnonymous && !this.credentials) {
      this.setAnonymousAuth();
    }
  }

  /**
   * Handle case when no session is available
   */
  private handleNoSession(): void {
    if (this.config.fallbackToAnonymous) {
      this.setAnonymousAuth();
    } else {
      this.handleAuthError(
        new MCPAuthError(MCPAuthErrorType.INVALID_TOKEN, 'No Supabase session available'),
        'handleNoSession'
      );
    }
  }

  /**
   * Set anonymous authentication fallback
   */
  private setAnonymousAuth(): void {
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Setting anonymous authentication');
    }

    this.credentials = null;
    this.authState.isInitialized = true;
    this.events.onAuthStatusChange?.(this.getAuthStatus());
  }

  /**
   * Enhanced automatic token refresh detection (Phase 3)
   * Implements proactive refresh detection with failure recovery
   */
  private scheduleTokenRefresh(): void {
    if (!this.credentials || this.refreshTimeout) {
      return;
    }

    const timeUntilExpiry = this.getTimeUntilExpiry();
    const refreshThresholdMs = this.config.tokenRefreshThreshold * 60 * 1000;
    const timeUntilRefresh = timeUntilExpiry - refreshThresholdMs;
    
    // Phase 3: Enhanced refresh logic
    if (timeUntilRefresh > 0) {
      this.refreshTimeout = setTimeout(() => {
        this.performAutomaticRefresh();
      }, timeUntilRefresh);

      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Enhanced refresh scheduled', {
          timeUntilRefresh: Math.round(timeUntilRefresh / 1000),
          timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
          refreshAt: new Date(Date.now() + timeUntilRefresh).toISOString(),
          expiresAt: new Date(Date.now() + timeUntilExpiry).toISOString()
        });
      }
    } else if (timeUntilExpiry > 0) {
      // Token is close to expiry, refresh immediately
      this.performAutomaticRefresh();
    } else {
      // Token has already expired
      this.handleExpiredToken();
    }
  }

  /**
   * Perform automatic token refresh with enhanced detection (Phase 3)
   */
  private async performAutomaticRefresh(): Promise<void> {
    this.refreshTimeout = null;
    
    if (!this.credentials) {
      return;
    }

    const currentCredentials = this.credentials;
    
    try {
      if (this.config.debugAuth) {
        console.debug('[MCP Auth Manager] Starting automatic refresh', {
          userId: currentCredentials.userId,
          currentExpiry: new Date(currentCredentials.expiresAt).toISOString()
        });
      }

      // Phase 3: Enhanced refresh detection
      if (this.isTokenNearExpiry(currentCredentials)) {
        this.events.onTokenExpired?.(currentCredentials);
        
        // Attempt automatic refresh
        await this.attemptTokenRefresh();
        
        // Reschedule next refresh
        this.scheduleTokenRefresh();
        
      } else {
        // Token still valid, reschedule
        this.scheduleTokenRefresh();
      }

    } catch (error) {
      await this.handleRefreshFailure(error, currentCredentials);
    }
  }

  /**
   * Enhanced token refresh attempt with failure recovery (Phase 3)
   */
  private async attemptTokenRefresh(): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        
        if (this.config.debugAuth) {
          console.debug(`[MCP Auth Manager] Refresh attempt ${attempt}/${maxRetries}`);
        }
        
        // Call the refresh method - this will trigger Supabase to refresh the session
        await this.refreshAuth();
        
        // If successful, reset retry count and return
        this.authState.refreshAttempts = 0;
        this.lastAuthRefresh = Date.now();
        
        if (this.config.debugAuth) {
          console.debug('[MCP Auth Manager] Automatic refresh successful');
        }
        
        return;
        
      } catch (error) {
        if (this.config.debugAuth) {
          console.debug(`[MCP Auth Manager] Refresh attempt ${attempt} failed:`, error);
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Handle refresh failure with recovery mechanisms (Phase 3)
   */
  private async handleRefreshFailure(error: any, expiredCredentials: MCPAuthCredentials): Promise<void> {
    this.authState.refreshAttempts = (this.authState.refreshAttempts || 0) + 1;
    
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Refresh failure recovery', {
        attempt: this.authState.refreshAttempts,
        userId: expiredCredentials.userId,
        error: error.message
      });
    }
    
    // Phase 3: Intelligent failure recovery
    if (this.authState.refreshAttempts < 3) {
      // Schedule retry with exponential backoff
      const retryDelayMs = Math.min(5000 * Math.pow(2, this.authState.refreshAttempts - 1), 60000);
      
      setTimeout(() => {
        this.performAutomaticRefresh();
      }, retryDelayMs);
      
      if (this.config.debugAuth) {
        console.debug(`[MCP Auth Manager] Retry scheduled in ${retryDelayMs}ms`);
      }
      
    } else {
      // Maximum retries exceeded, handle as auth failure
      const authError = handleSupabaseAuthError(error);
      this.handleAuthError(authError, 'handleRefreshFailure');
      
      // Clear credentials and notify
      this.clearAuth();
      this.events.onAuthFailure?.(authError);
    }
  }

  /**
   * Handle expired token scenarios (Phase 3)
   */
  private handleExpiredToken(): void {
    if (!this.credentials) {
      return;
    }
    
    if (this.config.debugAuth) {
      console.debug('[MCP Auth Manager] Token already expired', {
        userId: this.credentials.userId,
        expiredAt: new Date(this.credentials.expiresAt).toISOString()
      });
    }
    
    // Fire expired event
    this.events.onTokenExpired?.(this.credentials);
    
    // If fallback is enabled, continue with anonymous access
    if (this.config.fallbackToAnonymous) {
      this.setAnonymousAuth();
    } else {
      this.clearAuth();
    }
  }

  /**
   * Check if token is near expiry with enhanced detection (Phase 3)
   */
  private isTokenNearExpiry(credentials: MCPAuthCredentials): boolean {
    const now = Date.now();
    const expiryTime = credentials.expiresAt;
    const refreshThresholdMs = this.config.tokenRefreshThreshold * 60 * 1000;
    
    return (expiryTime - now) <= refreshThresholdMs;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new MCP authentication manager
 */
export function createMCPAuthManager(
  config?: MCPAuthConfig,
  events?: MCPAuthEvents
): MCPAuthManager {
  return new MCPAuthManager(config, events);
}

/**
 * Create MCP auth manager with production-safe defaults
 */
export function createProductionMCPAuthManager(events?: MCPAuthEvents): MCPAuthManager {
  return new MCPAuthManager({
    enableAuthentication: true,
    tokenRefreshThreshold: 10, // 10 minutes for production
    maxTokenAge: 12 * 60 * 60 * 1000, // 12 hours max age
    fallbackToAnonymous: false, // Strict auth in production
    strictValidation: true,
    debugAuth: false
  }, events);
}