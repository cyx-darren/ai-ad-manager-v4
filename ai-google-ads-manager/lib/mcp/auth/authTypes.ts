/**
 * MCP Authentication Types
 * 
 * Type definitions for MCP authentication integration with Supabase
 * Phase 1 of Subtask 28.1: Foundation Setup
 */

import { User, Session } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE TO MCP AUTH MAPPING
// ============================================================================

/**
 * Extracted authentication data from Supabase session
 */
export interface SupabaseAuthData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  expiresAt?: number;
  tokenType?: string;
  sessionId?: string;
}

/**
 * MCP authentication credentials derived from Supabase
 */
export interface MCPAuthCredentials {
  bearerToken: string;
  refreshToken: string;
  userId: string;
  userEmail: string;
  expiresAt: number;
  tokenSource: 'supabase';
  sessionMetadata?: {
    sessionId: string;
    issuedAt: number;
    lastRefresh?: number;
  };
}

/**
 * MCP authentication configuration options
 */
export interface MCPAuthConfig {
  enableAuthentication: boolean;
  tokenRefreshThreshold?: number; // Minutes before expiry to refresh
  maxTokenAge?: number; // Maximum token age in milliseconds
  fallbackToAnonymous?: boolean;
  strictValidation?: boolean;
  debugAuth?: boolean;
}

/**
 * Authentication status for MCP connections
 */
export interface MCPAuthStatus {
  isAuthenticated: boolean;
  hasValidToken: boolean;
  tokenExpiresAt?: number;
  timeUntilExpiry?: number;
  lastRefresh?: number;
  authSource: 'supabase' | 'anonymous' | 'none';
  userId?: string;
  userEmail?: string;
  errors: string[];
}

/**
 * Authentication event types for MCP auth lifecycle
 */
export interface MCPAuthEvents {
  onAuthSuccess?: (credentials: MCPAuthCredentials) => void;
  onAuthFailure?: (error: Error, context?: string) => void;
  onTokenRefresh?: (newCredentials: MCPAuthCredentials) => void;
  onTokenExpired?: (expiredCredentials: MCPAuthCredentials) => void;
  onAuthStatusChange?: (status: MCPAuthStatus) => void;
}

/**
 * Authentication error types
 */
export enum MCPAuthErrorType {
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  REFRESH_FAILED = 'refresh_failed',
  SUPABASE_ERROR = 'supabase_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Authentication error with detailed context
 */
export class MCPAuthError extends Error {
  constructor(
    public type: MCPAuthErrorType,
    message: string,
    public context?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MCPAuthError';
  }
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  timeUntilExpiry: number;
  errors: string[];
  metadata?: {
    issuedAt?: number;
    expiresAt?: number;
    tokenAge?: number;
  };
}

/**
 * Authentication state for persistence
 */
export interface MCPAuthState {
  credentials?: MCPAuthCredentials;
  lastValidation?: number;
  refreshAttempts?: number;
  errors: MCPAuthError[];
  isInitialized: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Supabase session with extended auth metadata
 */
export interface ExtendedSupabaseSession extends Session {
  authMetadata?: {
    extractedAt: number;
    source: string;
    validation?: TokenValidationResult;
  };
}

/**
 * MCP server authentication requirements
 */
export interface MCPServerAuthRequirements {
  requiresAuthentication: boolean;
  supportedTokenTypes: string[];
  tokenValidationEndpoint?: string;
  refreshEndpoint?: string;
  minimumTokenLifetime?: number;
  maxConcurrentSessions?: number;
}

// ============================================================================
// PHASE 5: SECURITY & COMPATIBILITY TYPES
// ============================================================================

/**
 * Enhanced security configuration for Phase 5
 */
export interface MCPSecurityConfig {
  enableSecurityValidation: boolean;
  enableTokenSanitization: boolean;
  enableSecurityLogging: boolean;
  maxTokenAge: number; // milliseconds
  maxRefreshAttempts: number;
  securityCheckInterval: number; // milliseconds
  enableIntrusionDetection: boolean;
  enableRateLimiting: boolean;
  rateLimitWindowMs: number;
  maxRequestsPerWindow: number;
  enableAuditLogging: boolean;
  restrictedHeaders: string[];
  allowedOrigins: string[];
  tokenEncryption: {
    enabled: boolean;
    algorithm?: string;
    keyRotationInterval?: number;
  };
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: SecurityViolation[];
  recommendations: string[];
  sanitizedData?: any;
  validationTimestamp: number;
}

/**
 * Security violation details
 */
export interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  field?: string;
  originalValue?: any;
  sanitizedValue?: any;
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * Security violation types
 */
export enum SecurityViolationType {
  TOKEN_TAMPERING = 'token_tampering',
  EXPIRED_TOKEN = 'expired_token',
  MALFORMED_TOKEN = 'malformed_token',
  SUSPICIOUS_HEADERS = 'suspicious_headers',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_ORIGIN = 'invalid_origin',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION = 'sql_injection',
  PAYLOAD_TOO_LARGE = 'payload_too_large',
  INVALID_ENCODING = 'invalid_encoding',
  SUSPICIOUS_TIMING = 'suspicious_timing',
  CONCURRENT_SESSION_LIMIT = 'concurrent_session_limit'
}

/**
 * Backward compatibility configuration
 */
export interface BackwardCompatibilityConfig {
  enableLegacySupport: boolean;
  legacyTokenFormats: string[];
  migrationMode: 'strict' | 'permissive' | 'automatic';
  deprecationWarnings: boolean;
  legacyEventSupport: boolean;
  versionCompatibility: {
    minSupportedVersion: string;
    currentVersion: string;
    migrationPath?: string[];
  };
  featureFlags: {
    enableNewAuthFlow: boolean;
    enableLegacyFallback: boolean;
    enableProgressiveUpgrade: boolean;
  };
}

/**
 * Comprehensive logging configuration for Phase 5
 */
export interface MCPAuthLoggingConfig {
  enableAuthLogging: boolean;
  enableSecurityLogging: boolean;
  enablePerformanceLogging: boolean;
  enableAuditLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  logDestination: 'console' | 'file' | 'external' | 'all';
  logFormat: 'json' | 'text' | 'structured';
  sensitiveDataRedaction: boolean;
  maxLogFileSize: number; // bytes
  logRetentionDays: number;
  enableLogRotation: boolean;
  logCategories: {
    authentication: boolean;
    authorization: boolean;
    tokenManagement: boolean;
    securityViolations: boolean;
    performanceMetrics: boolean;
    errorTracking: boolean;
  };
  customLogFields: Record<string, any>;
}

/**
 * Integration test configuration
 */
export interface IntegrationTestConfig {
  enableIntegrationTests: boolean;
  testEnvironment: 'development' | 'staging' | 'production';
  testSuites: {
    authFlow: boolean;
    tokenRefresh: boolean;
    securityValidation: boolean;
    backwardCompatibility: boolean;
    errorHandling: boolean;
    performanceTests: boolean;
  };
  mockData: {
    validTokens: MCPAuthCredentials[];
    expiredTokens: MCPAuthCredentials[];
    invalidTokens: any[];
    testUsers: any[];
  };
  testTimeouts: {
    authTimeout: number;
    refreshTimeout: number;
    logoutTimeout: number;
  };
  assertionLevel: 'basic' | 'comprehensive' | 'exhaustive';
}

/**
 * Enhanced authentication state with security context
 */
export interface MCPAuthStateWithSecurity extends MCPAuthState {
  securityContext: {
    lastSecurityCheck: number;
    securityLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: SecurityViolation[];
    trustScore: number; // 0-100
    riskFactors: string[];
    lastAudit: number;
  };
  backwardCompatibility: {
    isLegacyMode: boolean;
    migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
    legacyFeatures: string[];
    deprecationWarnings: string[];
  };
  performanceMetrics: {
    authDuration: number;
    refreshDuration: number;
    validationDuration: number;
    totalOperations: number;
    failureRate: number;
  };
}

/**
 * Security audit log entry
 */
export interface SecurityAuditLogEntry {
  timestamp: number;
  eventType: 'auth_success' | 'auth_failure' | 'token_refresh' | 'security_violation' | 'logout' | 'configuration_change';
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  clientInfo: {
    userAgent?: string;
    ipAddress?: string;
    origin?: string;
  };
  action: string;
  result: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  securityContext?: {
    violations: SecurityViolation[];
    riskScore: number;
    mitigationActions: string[];
  };
}

// ============================================================================
// PHASE 6: EDGE CASES & RESILIENCE TYPES
// ============================================================================

/**
 * Race condition protection configuration
 */
export interface RaceConditionConfig {
  enableRaceConditionProtection: boolean;
  operationTimeout: number; // milliseconds
  maxConcurrentOperations: number;
  lockTimeout: number; // milliseconds
  conflictResolutionStrategy: 'first-wins' | 'last-wins' | 'merge' | 'abort';
  enableDeadlockDetection: boolean;
  deadlockTimeout: number; // milliseconds
}

/**
 * Authentication operation lock
 */
export interface AuthOperationLock {
  operationId: string;
  operationType: 'auth' | 'refresh' | 'logout' | 'validate';
  lockAcquiredAt: number;
  lockTimeout: number;
  source: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

/**
 * Race condition detection result
 */
export interface RaceConditionDetection {
  hasRaceCondition: boolean;
  conflictingOperations: AuthOperationLock[];
  resolutionStrategy: string;
  winningOperation?: AuthOperationLock;
  blockedOperations: AuthOperationLock[];
  resolutionTimestamp: number;
  conflictDuration: number;
}

/**
 * Retry mechanism configuration
 */
export interface RetryMechanismConfig {
  enableRetryMechanism: boolean;
  maxRetryAttempts: number;
  baseRetryDelay: number; // milliseconds
  maxRetryDelay: number; // milliseconds
  retryBackoffStrategy: 'exponential' | 'linear' | 'fixed' | 'jitter';
  retryableErrors: MCPAuthErrorType[];
  nonRetryableErrors: MCPAuthErrorType[];
  circuitBreakerThreshold: number; // failed attempts before circuit opens
  circuitBreakerTimeout: number; // milliseconds to wait before retry
  enableRetryJitter: boolean;
  jitterFactor: number; // 0.0 to 1.0
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  attemptNumber: number;
  startTime: number;
  endTime?: number;
  error?: MCPAuthError;
  delay: number;
  backoffStrategy: string;
  success: boolean;
  context?: Record<string, any>;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Failing fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
  successCount: number;
  totalRequests: number;
  errorRate: number;
  stateChangedAt: number;
}

/**
 * Graceful degradation configuration
 */
export interface GracefulDegradationConfig {
  enableGracefulDegradation: boolean;
  degradationLevels: DegradationLevel[];
  fallbackStrategies: FallbackStrategy[];
  healthCheckInterval: number; // milliseconds
  recoveryThreshold: number; // successful operations before upgrading
  degradationThreshold: number; // failed operations before degrading
  enableAutoRecovery: boolean;
  maxDegradationLevel: number;
}

/**
 * Degradation level configuration
 */
export interface DegradationLevel {
  level: number;
  name: string;
  description: string;
  disabledFeatures: string[];
  enabledFeatures: string[];
  performanceTargets: {
    maxResponseTime: number;
    maxErrorRate: number;
    minSuccessRate: number;
  };
  fallbackBehavior: {
    useCache: boolean;
    allowAnonymous: boolean;
    skipValidation: boolean;
    simplifiedAuth: boolean;
  };
}

/**
 * Fallback strategy
 */
export interface FallbackStrategy {
  name: string;
  triggerConditions: string[];
  actions: FallbackAction[];
  priority: number;
  timeout: number;
  retryAfter?: number;
}

/**
 * Fallback action
 */
export interface FallbackAction {
  type: 'cache' | 'anonymous' | 'simplified' | 'offline' | 'retry' | 'abort';
  parameters: Record<string, any>;
  timeout: number;
  onSuccess?: string;
  onFailure?: string;
}

/**
 * System health status
 */
export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  components: {
    authentication: ComponentHealth;
    tokenRefresh: ComponentHealth;
    security: ComponentHealth;
    compatibility: ComponentHealth;
    logging: ComponentHealth;
  };
  degradationLevel: number;
  activeFallbacks: string[];
  lastHealthCheck: number;
  healthHistory: HealthCheckResult[];
}

/**
 * Component health status
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  responseTime: number;
  errorRate: number;
  successRate: number;
  lastCheck: number;
  errors: MCPAuthError[];
  metrics: Record<string, number>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  timestamp: number;
  component: string;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  responseTime: number;
  errorCount: number;
  successCount: number;
  details?: Record<string, any>;
}

/**
 * Security review configuration
 */
export interface SecurityReviewConfig {
  enableSecurityReview: boolean;
  penetrationTestingLevel: 'basic' | 'intermediate' | 'advanced' | 'comprehensive';
  securityScanInterval: number; // milliseconds
  vulnerabilityThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  enableAutomaticPatching: boolean;
  securityReportFormat: 'json' | 'html' | 'pdf' | 'xml';
  complianceStandards: string[];
}

/**
 * Security vulnerability
 */
export interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  title: string;
  description: string;
  affectedComponents: string[];
  discoveredAt: number;
  cvssScore?: number;
  cveId?: string;
  mitigation: {
    steps: string[];
    estimatedEffort: string;
    priority: number;
  };
  status: 'discovered' | 'confirmed' | 'patched' | 'mitigated' | 'false_positive';
}

/**
 * Penetration test result
 */
export interface PenetrationTestResult {
  testId: string;
  testType: string;
  startTime: number;
  endTime: number;
  status: 'passed' | 'failed' | 'partial' | 'error';
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    businessImpact: string;
    technicalImpact: string;
    likelihood: string;
  };
  testDetails: {
    methodology: string;
    toolsUsed: string[];
    coverage: number; // percentage
    duration: number; // milliseconds
  };
}

/**
 * Enhanced authentication state with Phase 6 resilience features
 */
export interface MCPAuthStateWithResilience extends MCPAuthStateWithSecurity {
  raceConditionProtection: {
    activeLocks: AuthOperationLock[];
    conflictHistory: RaceConditionDetection[];
    lockTimeout: number;
  };
  retryMechanism: {
    circuitBreaker: CircuitBreakerStatus;
    retryHistory: RetryAttempt[];
    maxRetries: number;
  };
  gracefulDegradation: {
    currentLevel: number;
    activeFallbacks: string[];
    healthStatus: SystemHealthStatus;
  };
  securityReview: {
    lastReview: number;
    vulnerabilities: SecurityVulnerability[];
    testResults: PenetrationTestResult[];
  };
}