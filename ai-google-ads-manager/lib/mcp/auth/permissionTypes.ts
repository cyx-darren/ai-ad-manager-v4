/**
 * Permission & Scope Management Types
 * 
 * This file defines all types, interfaces, and enums related to GA4 permission
 * and scope management for the MCP authentication system.
 */

// ============================================================================
// GA4 PERMISSION TYPES
// ============================================================================

/**
 * GA4 Analytics Permission Levels
 */
export enum GA4PermissionLevel {
  /** No access to the property */
  NONE = 'none',
  /** Read-only access to standard reports */
  READ = 'read',
  /** Read access plus standard analysis capabilities */
  ANALYZE = 'analyze',
  /** Read/analyze plus collaborate on shared assets */
  COLLABORATE = 'collaborate',
  /** Full edit access except user management */
  EDIT = 'edit',
  /** Full administrative access including user management */
  ADMIN = 'admin'
}

/**
 * OAuth Scopes for Google Analytics
 */
export enum GA4OAuthScope {
  /** Read-only access to Google Analytics */
  ANALYTICS_READONLY = 'https://www.googleapis.com/auth/analytics.readonly',
  /** Full access to Google Analytics */
  ANALYTICS = 'https://www.googleapis.com/auth/analytics',
  /** Read-only access to Google Analytics user management */
  ANALYTICS_MANAGE_USERS_READONLY = 'https://www.googleapis.com/auth/analytics.manage.users.readonly',
  /** Full access to Google Analytics user management */
  ANALYTICS_MANAGE_USERS = 'https://www.googleapis.com/auth/analytics.manage.users',
  /** Access to edit Google Analytics */
  ANALYTICS_EDIT = 'https://www.googleapis.com/auth/analytics.edit',
  /** Provision Google Analytics accounts */
  ANALYTICS_PROVISION = 'https://www.googleapis.com/auth/analytics.provision'
}

/**
 * Specific GA4 Operations that require permissions
 */
export enum GA4Operation {
  // Data Reading Operations
  READ_REPORTS = 'read_reports',
  READ_REALTIME = 'read_realtime',
  READ_AUDIENCES = 'read_audiences',
  READ_CONVERSIONS = 'read_conversions',
  
  // Analysis Operations
  CREATE_CUSTOM_REPORTS = 'create_custom_reports',
  ACCESS_ANALYSIS_HUB = 'access_analysis_hub',
  CREATE_SEGMENTS = 'create_segments',
  
  // Configuration Operations
  EDIT_GOALS = 'edit_goals',
  EDIT_CONVERSIONS = 'edit_conversions',
  EDIT_AUDIENCES = 'edit_audiences',
  EDIT_CUSTOM_DIMENSIONS = 'edit_custom_dimensions',
  
  // Administrative Operations
  MANAGE_USERS = 'manage_users',
  MANAGE_PROPERTIES = 'manage_properties',
  MANAGE_DATA_STREAMS = 'manage_data_streams',
  
  // Advanced Operations
  DATA_EXPORT = 'data_export',
  MEASUREMENT_PROTOCOL = 'measurement_protocol',
  REPORTING_API = 'reporting_api'
}

// ============================================================================
// PERMISSION INTERFACES
// ============================================================================

/**
 * Represents a user's permission for a specific GA4 property
 */
export interface GA4PropertyPermission {
  /** The GA4 property ID */
  propertyId: string;
  /** User's permission level for this property */
  permissionLevel: GA4PermissionLevel;
  /** Specific operations the user can perform */
  allowedOperations: GA4Operation[];
  /** When this permission was granted */
  grantedAt: string;
  /** When this permission expires (if applicable) */
  expiresAt?: string;
  /** Whether this permission is inherited from account level */
  inherited: boolean;
}

/**
 * User's OAuth token information with scope details
 */
export interface GA4TokenPermissions {
  /** OAuth access token */
  accessToken: string;
  /** Token expiration timestamp */
  expiresAt: string;
  /** Granted OAuth scopes */
  grantedScopes: GA4OAuthScope[];
  /** Token type (usually 'Bearer') */
  tokenType: string;
  /** Whether token has refresh capability */
  hasRefreshToken: boolean;
}

/**
 * Overall permission context for a user
 */
export interface GA4PermissionContext {
  /** User identifier */
  userId: string;
  /** User's email address */
  email: string;
  /** OAuth token information */
  tokenPermissions: GA4TokenPermissions;
  /** Permissions for each GA4 property */
  propertyPermissions: GA4PropertyPermission[];
  /** When permissions were last checked */
  lastChecked: string;
  /** Whether permission check is currently in progress */
  isCheckingPermissions: boolean;
}

// ============================================================================
// PERMISSION VALIDATION TYPES
// ============================================================================

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
  /** User context to check permissions for */
  userContext: GA4PermissionContext;
  /** Specific GA4 property to check */
  propertyId: string;
  /** Required operation */
  requiredOperation: GA4Operation;
  /** Minimum permission level required */
  minimumPermissionLevel?: GA4PermissionLevel;
  /** Required OAuth scopes */
  requiredScopes?: GA4OAuthScope[];
}

/**
 * Result of a permission check
 */
export interface PermissionCheckResult {
  /** Whether the permission check passed */
  hasPermission: boolean;
  /** User's actual permission level */
  actualPermissionLevel: GA4PermissionLevel;
  /** Missing operations (if any) */
  missingOperations: GA4Operation[];
  /** Missing OAuth scopes (if any) */
  missingScopes: GA4OAuthScope[];
  /** Whether token has expired */
  tokenExpired: boolean;
  /** Detailed explanation of the result */
  explanation: string;
  /** Suggestions for resolving permission issues */
  suggestions: string[];
}

/**
 * Permission error types
 */
export enum PermissionErrorType {
  /** Token has expired */
  TOKEN_EXPIRED = 'token_expired',
  /** Insufficient OAuth scopes */
  INSUFFICIENT_SCOPES = 'insufficient_scopes',
  /** Insufficient property-level permissions */
  INSUFFICIENT_PROPERTY_PERMISSIONS = 'insufficient_property_permissions',
  /** Operation not allowed for current permission level */
  OPERATION_NOT_ALLOWED = 'operation_not_allowed',
  /** Property not found or no access */
  PROPERTY_ACCESS_DENIED = 'property_access_denied',
  /** Permission check failed due to network/API error */
  PERMISSION_CHECK_FAILED = 'permission_check_failed'
}

/**
 * Detailed permission error information
 */
export interface PermissionError {
  /** Type of permission error */
  type: PermissionErrorType;
  /** Human-readable error message */
  message: string;
  /** Technical details about the error */
  details: string;
  /** Suggested actions for the user */
  suggestions: string[];
  /** Whether this error is retryable */
  retryable: boolean;
  /** Property ID related to the error (if applicable) */
  propertyId?: string;
  /** Required scopes that are missing */
  requiredScopes?: GA4OAuthScope[];
  /** Current user permission level */
  currentPermissionLevel?: GA4PermissionLevel;
}

// ============================================================================
// PERMISSION MAPPING TYPES
// ============================================================================

/**
 * Maps operations to required permission levels
 */
export type OperationPermissionMap = {
  [key in GA4Operation]: {
    minimumPermissionLevel: GA4PermissionLevel;
    requiredScopes: GA4OAuthScope[];
    description: string;
  };
};

/**
 * Maps permission levels to allowed operations
 */
export type PermissionLevelOperationMap = {
  [key in GA4PermissionLevel]: GA4Operation[];
};

// ============================================================================
// PERMISSION CACHING TYPES
// ============================================================================

/**
 * Cached permission information
 */
export interface CachedPermissionInfo {
  /** User ID */
  userId: string;
  /** Property ID */
  propertyId: string;
  /** Cached permission result */
  permissionResult: PermissionCheckResult;
  /** When this was cached */
  cachedAt: string;
  /** When this cache entry expires */
  expiresAt: string;
  /** Cache entry version for invalidation */
  version: number;
}

/**
 * Permission cache configuration
 */
export interface PermissionCacheConfig {
  /** How long to cache successful permission checks (in seconds) */
  successCacheTTL: number;
  /** How long to cache failed permission checks (in seconds) */
  failureCacheTTL: number;
  /** Maximum number of cache entries */
  maxCacheSize: number;
  /** Whether to cache permission checks */
  enabled: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Permission status for UI display
 */
export interface PermissionStatus {
  /** Overall permission status */
  status: 'granted' | 'partial' | 'denied' | 'checking' | 'error';
  /** Permission level text for display */
  permissionLevelText: string;
  /** Status color for UI */
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  /** List of accessible operations */
  accessibleOperations: GA4Operation[];
  /** List of blocked operations */
  blockedOperations: GA4Operation[];
  /** Whether user can request additional permissions */
  canRequestPermissions: boolean;
}

/**
 * Permission request for elevation
 */
export interface PermissionElevationRequest {
  /** Current user context */
  userContext: GA4PermissionContext;
  /** Property requesting access to */
  propertyId: string;
  /** Requested permission level */
  requestedPermissionLevel: GA4PermissionLevel;
  /** Specific operations needed */
  requestedOperations: GA4Operation[];
  /** Additional OAuth scopes needed */
  additionalScopes: GA4OAuthScope[];
  /** Justification for the request */
  justification: string;
}

/**
 * Configuration for permission system
 */
export interface PermissionSystemConfig {
  /** Cache configuration */
  cache: PermissionCacheConfig;
  /** How often to refresh permissions automatically (in seconds) */
  autoRefreshInterval: number;
  /** Whether to enable strict permission checking */
  strictMode: boolean;
  /** Default permission level for new users */
  defaultPermissionLevel: GA4PermissionLevel;
  /** Whether to log all permission checks */
  enableAuditLogging: boolean;
}

// ============================================================================
// PHASE 2: SCOPE VALIDATION TYPES
// ============================================================================

/**
 * Scope validation configuration
 */
export interface ScopeValidationConfig {
  /** Whether to enable caching of validation results */
  enableCaching: boolean;
  /** Cache timeout in milliseconds */
  cacheTimeout: number;
  /** Whether to perform strict validation */
  strictValidation: boolean;
  /** Whether to allow scope upgrades */
  allowScopeUpgrade: boolean;
  /** Whether to log validation events */
  logValidationEvents: boolean;
  /** Whether to enable audit trail */
  enableAuditTrail: boolean;
}

/**
 * Scope validation result
 */
export interface ScopeValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Unique validation ID */
  validationId: string;
  /** Operation being validated */
  operation: GA4Operation;
  /** Token permissions being validated */
  tokenPermissions: GA4TokenPermissions;
  /** Scope requirements for the operation */
  requirements?: ScopeRequirement;
  /** Scope comparison result */
  scopeComparison?: ScopeComparisonResult;
  /** Validation error if failed */
  error?: ScopeValidationError;
  /** When validation was performed */
  validationTime: string;
  /** Validation duration in milliseconds */
  duration?: number;
  /** Whether result was cached */
  cached: boolean;
}

/**
 * Scope validation error
 */
export interface ScopeValidationError {
  /** Error type */
  type: PermissionErrorType;
  /** Error message */
  message: string;
  /** Operation that failed */
  operation: GA4Operation;
  /** Token permissions at time of error */
  tokenPermissions: GA4TokenPermissions;
  /** Additional error details */
  details: Record<string, any>;
  /** When error occurred */
  timestamp: string;
  /** Validation ID */
  validationId: string;
}

/**
 * Scope requirement definition
 */
export interface ScopeRequirement {
  /** Required OAuth scopes */
  requiredScopes: GA4OAuthScope[];
  /** Optional OAuth scopes */
  optionalScopes: GA4OAuthScope[];
  /** Minimum permission level needed */
  minimumPermissionLevel: GA4PermissionLevel;
  /** Human-readable description */
  description: string;
  /** Risk level of the operation */
  riskLevel: 'low' | 'medium' | 'high';
  /** Whether scope upgrade is required */
  scopeUpgradeRequired: boolean;
}

/**
 * Scope comparison result
 */
export interface ScopeComparisonResult {
  /** Whether all required scopes are present */
  valid: boolean;
  /** Missing required scopes */
  missingScopes: GA4OAuthScope[];
  /** Satisfied required scopes */
  satisfiedScopes: GA4OAuthScope[];
  /** Excess scopes not required */
  excessScopes: GA4OAuthScope[];
  /** Whether scope upgrade is required */
  upgradeRequired: boolean;
  /** Risk level assessment */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Cached scope validation info
 */
export interface CachedScopeInfo {
  /** Validation result */
  result: ScopeValidationResult;
  /** When cached */
  timestamp: number;
}

// ============================================================================
// SCOPE MIDDLEWARE TYPES
// ============================================================================

/**
 * Scope middleware configuration
 */
export interface ScopeMiddlewareConfig {
  /** Whether to enable validation */
  enableValidation: boolean;
  /** Whether to enable caching */
  enableCaching: boolean;
  /** Whether to enable metrics collection */
  enableMetrics: boolean;
  /** Whether to enable audit logging */
  enableAuditLog: boolean;
  /** Whether to fail on missing scopes */
  failOnMissingScopes: boolean;
  /** Whether to allow scope upgrades */
  allowScopeUpgrade: boolean;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Whether to enable retry logic */
  enableRetry: boolean;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Scope middleware result
 */
export interface ScopeMiddlewareResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Validation result */
  validationResult: ScopeValidationResult;
  /** Operation response if successful */
  response?: any;
  /** Error if failed */
  error?: ScopeValidationError;
}

/**
 * Operation context
 */
export interface OperationContext {
  /** Operation being performed */
  operation: GA4Operation;
  /** User performing operation */
  userId?: string;
  /** Request parameters */
  parameters: Record<string, any>;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * MCP operation request
 */
export interface MCPOperationRequest {
  /** Operation to perform */
  operation: GA4Operation;
  /** Request parameters */
  parameters: Record<string, any>;
  /** Authentication headers */
  headers?: Record<string, string>;
  /** Request metadata */
  metadata?: Record<string, any>;
}

/**
 * MCP operation response
 */
export interface MCPOperationResponse {
  /** Whether request was successful */
  success: boolean;
  /** Response data */
  data?: any;
  /** Error message if failed */
  error?: string;
  /** Response metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// SCOPE REPORTING TYPES
// ============================================================================

/**
 * Scope error category
 */
export enum ScopeErrorCategory {
  SCOPE_MISMATCH = 'scope_mismatch',
  PERMISSION_LEVEL = 'permission_level',
  TOKEN_ISSUE = 'token_issue',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN = 'unknown'
}

/**
 * Scope error severity
 */
export enum ScopeErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Scope reporting configuration
 */
export interface ScopeReportingConfig {
  /** Whether to enable error reporting */
  enableReporting: boolean;
  /** Whether to enable user feedback collection */
  enableUserFeedback: boolean;
  /** Whether to enable analytics */
  enableAnalytics: boolean;
  /** Where to store reports */
  storageLocation: 'localStorage' | 'indexedDB' | 'memory';
  /** Maximum number of stored reports */
  maxStoredReports: number;
  /** How long to retain reports (days) */
  retentionDays: number;
  /** Whether to show notifications */
  enableNotifications: boolean;
  /** Notification timeout in milliseconds */
  notificationTimeout: number;
}

/**
 * Scope error report
 */
export interface ScopeErrorReport {
  /** Unique report ID */
  reportId: string;
  /** When error occurred */
  timestamp: string;
  /** Operation that failed */
  operation: GA4Operation;
  /** Token permissions at time of error */
  tokenPermissions: GA4TokenPermissions;
  /** Error details */
  error: {
    type: PermissionErrorType;
    message: string;
    details: Record<string, any>;
    userFriendlyMessage: string;
  };
  /** Error categorization */
  categorization: {
    category: ScopeErrorCategory;
    severity: ScopeErrorSeverity;
    userFacing: boolean;
  };
  /** Suggested resolution actions */
  resolutionActions: ScopeResolutionAction[];
  /** User context when error occurred */
  context: {
    userAgent: string;
    url: string;
    timestamp: string;
    [key: string]: any;
  };
  /** Report status */
  status: 'resolved' | 'unresolved';
  /** User feedback if provided */
  userFeedback: {
    helpful: boolean;
    comments?: string;
    suggestedSolution?: string;
    timestamp: string;
  } | null;
  /** Resolution details if resolved */
  resolution: {
    resolvedAt: string;
    resolutionAction: string;
    resolutionNotes?: string;
    resolvedBy: string;
  } | null;
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Scope resolution action
 */
export interface ScopeResolutionAction {
  /** Unique action ID */
  actionId: string;
  /** Action title */
  title: string;
  /** Action description */
  description: string;
  /** Action type */
  type: 'user_action' | 'contact_support' | 'system_action';
  /** Action priority */
  priority: 'low' | 'medium' | 'high';
  /** Estimated time to complete */
  estimatedTime: string;
  /** Step-by-step instructions */
  steps: string[];
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * User feedback form
 */
export interface UserFeedbackForm {
  /** Whether the error message was helpful */
  helpful: boolean;
  /** User comments */
  comments?: string;
  /** User's suggested solution */
  suggestedSolution?: string;
}

/**
 * Scope reporting statistics
 */
export interface ScopeReportingStatistics {
  /** Total number of reports */
  totalReports: number;
  /** Number of resolved reports */
  resolvedReports: number;
  /** Resolution rate (0-1) */
  resolutionRate: number;
  /** Reports by category */
  reportsByCategory: { [category: string]: number };
  /** Reports by severity */
  reportsBySeverity: { [severity: string]: number };
  /** Average resolution time in milliseconds */
  averageResolutionTime: number;
  /** Most common error types */
  mostCommonErrors: { error: string; count: number }[];
  /** Resolution action effectiveness */
  resolutionActionEffectiveness: { [action: string]: number };
}