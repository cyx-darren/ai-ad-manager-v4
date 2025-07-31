'use client'

// Phase C: Comprehensive Authentication Error Handling System

export enum AuthErrorType {
  // Network and connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  
  // Token and session errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Permission and access errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ROLE_REQUIRED = 'ROLE_REQUIRED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  
  // Rate limiting and abuse
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // Provider-specific errors
  GOOGLE_OAUTH_ERROR = 'GOOGLE_OAUTH_ERROR',
  GOOGLE_TOKEN_REVOKED = 'GOOGLE_TOKEN_REVOKED',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  
  // Configuration and setup errors
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',
  
  // Unknown and fallback
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CRITICAL_ERROR = 'CRITICAL_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',         // Minor issues, app continues normally
  MEDIUM = 'MEDIUM',   // Some functionality affected
  HIGH = 'HIGH',       // Major functionality broken
  CRITICAL = 'CRITICAL' // App cannot function
}

export enum RecoveryAction {
  NONE = 'NONE',                    // No automatic recovery
  RETRY = 'RETRY',                  // Simple retry
  REFRESH_TOKEN = 'REFRESH_TOKEN',  // Attempt token refresh
  REAUTH = 'REAUTH',                // Require re-authentication
  REDIRECT = 'REDIRECT',            // Redirect to different page
  FALLBACK = 'FALLBACK',           // Use fallback functionality
  CONTACT_SUPPORT = 'CONTACT_SUPPORT' // Show support contact
}

export interface AuthError {
  type: AuthErrorType
  severity: ErrorSeverity
  message: string
  userMessage: string
  technicalDetails?: string
  originalError?: Error | any
  timestamp: number
  context?: {
    userId?: string
    action?: string
    route?: string
    userAgent?: string
    [key: string]: any
  }
}

export interface ErrorRecoveryStrategy {
  action: RecoveryAction
  maxRetries?: number
  retryDelay?: number
  fallbackUrl?: string
  customHandler?: () => Promise<boolean>
}

export interface ClassifiedError extends AuthError {
  recoveryStrategy: ErrorRecoveryStrategy
  isRecoverable: boolean
  shouldLogToService: boolean
  shouldNotifyUser: boolean
}

// Error classification mapping
const ERROR_CLASSIFICATIONS: Record<AuthErrorType, {
  severity: ErrorSeverity
  recoveryStrategy: ErrorRecoveryStrategy
  isRecoverable: boolean
  shouldLogToService: boolean
  shouldNotifyUser: boolean
}> = {
  // Network errors - usually recoverable
  [AuthErrorType.NETWORK_ERROR]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 3, retryDelay: 2000 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.CONNECTION_TIMEOUT]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 2, retryDelay: 5000 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.SERVICE_UNAVAILABLE]: {
    severity: ErrorSeverity.HIGH,
    recoveryStrategy: { action: RecoveryAction.FALLBACK, fallbackUrl: '/maintenance' },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },

  // Authentication errors
  [AuthErrorType.INVALID_CREDENTIALS]: {
    severity: ErrorSeverity.LOW,
    recoveryStrategy: { action: RecoveryAction.NONE },
    isRecoverable: false,
    shouldLogToService: false,
    shouldNotifyUser: true
  },
  [AuthErrorType.USER_NOT_FOUND]: {
    severity: ErrorSeverity.LOW,
    recoveryStrategy: { action: RecoveryAction.REDIRECT, fallbackUrl: '/auth/signup' },
    isRecoverable: false,
    shouldLogToService: false,
    shouldNotifyUser: true
  },
  [AuthErrorType.EMAIL_NOT_VERIFIED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REDIRECT, fallbackUrl: '/auth/verify-email' },
    isRecoverable: true,
    shouldLogToService: false,
    shouldNotifyUser: true
  },
  [AuthErrorType.ACCOUNT_DISABLED]: {
    severity: ErrorSeverity.HIGH,
    recoveryStrategy: { action: RecoveryAction.CONTACT_SUPPORT },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },

  // Token errors - often recoverable
  [AuthErrorType.TOKEN_EXPIRED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REFRESH_TOKEN, maxRetries: 1 },
    isRecoverable: true,
    shouldLogToService: false,
    shouldNotifyUser: false
  },
  [AuthErrorType.TOKEN_INVALID]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REAUTH },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.REFRESH_TOKEN_EXPIRED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REAUTH },
    isRecoverable: true,
    shouldLogToService: false,
    shouldNotifyUser: true
  },
  [AuthErrorType.SESSION_EXPIRED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REAUTH },
    isRecoverable: true,
    shouldLogToService: false,
    shouldNotifyUser: true
  },

  // Permission errors
  [AuthErrorType.INSUFFICIENT_PERMISSIONS]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REDIRECT, fallbackUrl: '/dashboard' },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.ROLE_REQUIRED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REDIRECT, fallbackUrl: '/dashboard' },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.FEATURE_NOT_AVAILABLE]: {
    severity: ErrorSeverity.LOW,
    recoveryStrategy: { action: RecoveryAction.FALLBACK },
    isRecoverable: false,
    shouldLogToService: false,
    shouldNotifyUser: true
  },

  // Rate limiting
  [AuthErrorType.RATE_LIMITED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 1, retryDelay: 60000 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.TOO_MANY_REQUESTS]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 1, retryDelay: 30000 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.SUSPICIOUS_ACTIVITY]: {
    severity: ErrorSeverity.HIGH,
    recoveryStrategy: { action: RecoveryAction.CONTACT_SUPPORT },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },

  // Provider errors
  [AuthErrorType.GOOGLE_OAUTH_ERROR]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 1 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.GOOGLE_TOKEN_REVOKED]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.REAUTH },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.SUPABASE_ERROR]: {
    severity: ErrorSeverity.HIGH,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 2, retryDelay: 3000 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },

  // Configuration errors
  [AuthErrorType.MISSING_CONFIG]: {
    severity: ErrorSeverity.CRITICAL,
    recoveryStrategy: { action: RecoveryAction.CONTACT_SUPPORT },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.INVALID_CONFIG]: {
    severity: ErrorSeverity.CRITICAL,
    recoveryStrategy: { action: RecoveryAction.CONTACT_SUPPORT },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.ENVIRONMENT_ERROR]: {
    severity: ErrorSeverity.HIGH,
    recoveryStrategy: { action: RecoveryAction.FALLBACK, fallbackUrl: '/maintenance' },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  },

  // Unknown errors
  [AuthErrorType.UNKNOWN_ERROR]: {
    severity: ErrorSeverity.MEDIUM,
    recoveryStrategy: { action: RecoveryAction.RETRY, maxRetries: 1 },
    isRecoverable: true,
    shouldLogToService: true,
    shouldNotifyUser: true
  },
  [AuthErrorType.CRITICAL_ERROR]: {
    severity: ErrorSeverity.CRITICAL,
    recoveryStrategy: { action: RecoveryAction.CONTACT_SUPPORT },
    isRecoverable: false,
    shouldLogToService: true,
    shouldNotifyUser: true
  }
}

/**
 * Classifies a raw error into a structured AuthError with recovery strategy
 */
export function classifyAuthError(
  error: Error | any,
  context?: Partial<AuthError['context']>
): ClassifiedError {
  const errorType = determineErrorType(error)
  const classification = ERROR_CLASSIFICATIONS[errorType]
  
  const baseError: AuthError = {
    type: errorType,
    severity: classification.severity,
    message: error?.message || 'An authentication error occurred',
    userMessage: getUserFriendlyMessage(errorType, error),
    technicalDetails: getTechnicalDetails(error),
    originalError: error,
    timestamp: Date.now(),
    context: {
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...context
    }
  }

  return {
    ...baseError,
    ...classification
  }
}

/**
 * Determines the specific error type from a raw error
 */
function determineErrorType(error: any): AuthErrorType {
  // Handle different error formats
  const message = error?.message?.toLowerCase() || ''
  const code = error?.code || error?.error_code || ''
  const status = error?.status || error?.statusCode || 0

  // Network errors
  if (message.includes('network') || message.includes('fetch') || status === 0) {
    return AuthErrorType.NETWORK_ERROR
  }
  if (message.includes('timeout') || code === 'TIMEOUT') {
    return AuthErrorType.CONNECTION_TIMEOUT
  }
  if (status === 503 || message.includes('service unavailable')) {
    return AuthErrorType.SERVICE_UNAVAILABLE
  }

  // Authentication errors
  if (message.includes('invalid_grant') || message.includes('invalid credentials')) {
    return AuthErrorType.INVALID_CREDENTIALS
  }
  if (message.includes('user not found') || status === 404) {
    return AuthErrorType.USER_NOT_FOUND
  }
  if (message.includes('email not confirmed') || message.includes('email not verified')) {
    return AuthErrorType.EMAIL_NOT_VERIFIED
  }
  if (message.includes('account disabled') || message.includes('user disabled')) {
    return AuthErrorType.ACCOUNT_DISABLED
  }

  // Token errors
  if (message.includes('token expired') || message.includes('jwt expired')) {
    return AuthErrorType.TOKEN_EXPIRED
  }
  if (message.includes('invalid token') || message.includes('jwt malformed')) {
    return AuthErrorType.TOKEN_INVALID
  }
  if (message.includes('refresh token') && message.includes('expired')) {
    return AuthErrorType.REFRESH_TOKEN_EXPIRED
  }
  if (message.includes('session expired') || message.includes('session invalid')) {
    return AuthErrorType.SESSION_EXPIRED
  }

  // Permission errors
  if (status === 403 || message.includes('forbidden') || message.includes('insufficient permissions')) {
    return AuthErrorType.INSUFFICIENT_PERMISSIONS
  }
  if (message.includes('role required') || message.includes('access denied')) {
    return AuthErrorType.ROLE_REQUIRED
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return AuthErrorType.RATE_LIMITED
  }

  // Provider-specific
  if (message.includes('google') && (message.includes('oauth') || message.includes('authorization'))) {
    return AuthErrorType.GOOGLE_OAUTH_ERROR
  }
  if (message.includes('google') && message.includes('revoked')) {
    return AuthErrorType.GOOGLE_TOKEN_REVOKED
  }
  if (message.includes('supabase') || code?.startsWith('SP')) {
    return AuthErrorType.SUPABASE_ERROR
  }

  // Configuration
  if (message.includes('missing') && (message.includes('config') || message.includes('env'))) {
    return AuthErrorType.MISSING_CONFIG
  }
  if (message.includes('invalid') && message.includes('config')) {
    return AuthErrorType.INVALID_CONFIG
  }

  // Default to unknown
  return AuthErrorType.UNKNOWN_ERROR
}

/**
 * Generates user-friendly error messages
 */
function getUserFriendlyMessage(errorType: AuthErrorType, originalError?: any): string {
  const messages: Record<AuthErrorType, string> = {
    [AuthErrorType.NETWORK_ERROR]: "We're having trouble connecting. Please check your internet connection and try again.",
    [AuthErrorType.CONNECTION_TIMEOUT]: "The connection is taking too long. Please try again.",
    [AuthErrorType.SERVICE_UNAVAILABLE]: "Our service is temporarily unavailable. Please try again later.",
    
    [AuthErrorType.INVALID_CREDENTIALS]: "The email or password you entered is incorrect. Please try again.",
    [AuthErrorType.USER_NOT_FOUND]: "No account found with this email. Would you like to create an account?",
    [AuthErrorType.EMAIL_NOT_VERIFIED]: "Please check your email and click the verification link before signing in.",
    [AuthErrorType.ACCOUNT_DISABLED]: "Your account has been disabled. Please contact support for assistance.",
    
    [AuthErrorType.TOKEN_EXPIRED]: "Your session has expired. Please sign in again.",
    [AuthErrorType.TOKEN_INVALID]: "There was a problem with your session. Please sign in again.",
    [AuthErrorType.REFRESH_TOKEN_EXPIRED]: "Your session has expired. Please sign in again.",
    [AuthErrorType.SESSION_EXPIRED]: "Your session has expired. Please sign in again.",
    
    [AuthErrorType.INSUFFICIENT_PERMISSIONS]: "You don't have permission to access this feature.",
    [AuthErrorType.ROLE_REQUIRED]: "This feature requires additional permissions. Please contact your administrator.",
    [AuthErrorType.FEATURE_NOT_AVAILABLE]: "This feature is not available for your account type.",
    
    [AuthErrorType.RATE_LIMITED]: "Too many attempts. Please wait a moment before trying again.",
    [AuthErrorType.TOO_MANY_REQUESTS]: "Too many requests. Please wait before trying again.",
    [AuthErrorType.SUSPICIOUS_ACTIVITY]: "Suspicious activity detected. Please contact support.",
    
    [AuthErrorType.GOOGLE_OAUTH_ERROR]: "There was a problem signing in with Google. Please try again.",
    [AuthErrorType.GOOGLE_TOKEN_REVOKED]: "Your Google account access has been revoked. Please sign in again.",
    [AuthErrorType.SUPABASE_ERROR]: "We're experiencing technical difficulties. Please try again.",
    
    [AuthErrorType.MISSING_CONFIG]: "The application is not properly configured. Please contact support.",
    [AuthErrorType.INVALID_CONFIG]: "There's a configuration error. Please contact support.",
    [AuthErrorType.ENVIRONMENT_ERROR]: "We're experiencing technical issues. Please try again later.",
    
    [AuthErrorType.UNKNOWN_ERROR]: "An unexpected error occurred. Please try again.",
    [AuthErrorType.CRITICAL_ERROR]: "A critical error occurred. Please contact support immediately."
  }

  return messages[errorType] || "An error occurred. Please try again."
}

/**
 * Extracts technical details for debugging
 */
function getTechnicalDetails(error: any): string {
  const details: string[] = []
  
  if (error?.code) details.push(`Code: ${error.code}`)
  if (error?.status || error?.statusCode) details.push(`Status: ${error.status || error.statusCode}`)
  if (error?.stack) details.push(`Stack: ${error.stack.split('\n')[0]}`)
  if (error?.response?.data) details.push(`Response: ${JSON.stringify(error.response.data)}`)
  
  return details.join(' | ')
}

export default {
  classifyAuthError,
  AuthErrorType,
  ErrorSeverity,
  RecoveryAction
}