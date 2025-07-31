// Phase A Authentication Hooks  
export { useAuth } from '@/contexts/AuthContext'
export { useGoogleTokens, type UseGoogleTokensReturn, type GoogleTokenHealth, type GoogleTokenInfo } from '@/hooks/useGoogleTokens'
export { useProtectedRoute, createProtectedRoute, type UseProtectedRouteReturn, type ProtectionConfig } from '@/hooks/useProtectedRoute'

// Phase A Route Protection - Higher-Order Components
export { default as withAuth, withAuthRequired, withAuthAndVerification } from './withAuth'
export { default as withRoles, withAdminRole, withManagerRole, withUserRole, useRole, RoleGate } from './withRoles'

// Phase A Route Protection - Components
export { 
  default as ProtectedRoute, 
  AuthRequired, 
  AdminOnly, 
  ManagerOnly, 
  UserOrAbove 
} from './ProtectedRoute'

// Phase B Sign-Out Components and Handlers
export { default as SignOutButton } from './SignOutButton'
export { default as AutoSignOutHandler } from './AutoSignOutHandler'

// Phase C Error Handling System - Core
export { 
  classifyAuthError,
  AuthErrorType,
  ErrorSeverity,
  RecoveryAction,
  type ClassifiedError,
  type AuthError,
  type ErrorRecoveryStrategy
} from '@/lib/authErrorHandler'

export { 
  ErrorRecoveryManager,
  useErrorRecovery,
  type RecoveryAttempt,
  type RecoveryManagerOptions
} from '@/lib/errorRecoveryManager'

// Phase C Error Handling System - UI Components
export { 
  default as ErrorToast,
  ErrorToastContainer,
  useErrorToasts,
  type ErrorToastProps
} from './ErrorToast'

export { 
  default as AuthErrorBoundary,
  type AuthErrorBoundaryProps,
  type AuthErrorContext
} from './AuthErrorBoundary'

// Phase D Analytics & Monitoring System - Core
export {
  authAnalytics,
  useAuthAnalytics,
  AuthEvent,
  type AuthAnalyticsEvent,
  type AuthAnalyticsMetrics,
  type UserFlowAnalytics
} from '@/lib/authAnalytics'

export {
  authHealthMonitor,
  useAuthHealthMonitor,
  HealthStatus,
  ServiceType,
  type HealthCheck,
  type HealthReport,
  type HealthAlert,
  type MonitoringConfig
} from '@/lib/authHealthMonitor'

// Legacy Components (Pre-Phase C)
export { default as AuthModal } from './AuthModal'
export { default as LoginButton } from './LoginButton'
export { default as ProfileManagement } from './ProfileManagement'
export { default as SignUpForm } from './SignUpForm'
export { default as ForgotPasswordForm } from './ForgotPasswordForm'
export { default as ResetPasswordForm } from './ResetPasswordForm'
export { default as OAuthTestSection } from './OAuthTestSection'

// Export core auth library
export { auth, type AuthUser } from '@/lib/auth' 