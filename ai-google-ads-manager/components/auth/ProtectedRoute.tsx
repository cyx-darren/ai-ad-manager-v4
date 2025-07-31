'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  
  // Authentication requirements
  requireAuth?: boolean
  requireEmailVerification?: boolean
  
  // Role-based access control
  allowedRoles?: string[]
  requireAllRoles?: boolean
  
  // Redirect behavior
  redirectTo?: string
  fallback?: React.ComponentType<ProtectedRouteFallbackProps>
  
  // Loading and error handling
  showLoader?: boolean
  loadingMessage?: string
  
  // Custom validation
  customValidator?: (user: any) => boolean | { valid: boolean; message?: string }
}

interface ProtectedRouteFallbackProps {
  reason: 'unauthenticated' | 'unverified' | 'insufficient_roles' | 'custom_validation' | 'error'
  user?: any
  userRole?: string
  requiredRoles?: string[]
  message?: string
  error?: string
}

const DefaultFallbackComponent: React.FC<ProtectedRouteFallbackProps> = ({ 
  reason, 
  userRole, 
  requiredRoles, 
  message,
  error 
}) => {
  const router = useRouter()

  const getContent = () => {
    switch (reason) {
      case 'unauthenticated':
        return {
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
          title: 'Authentication Required',
          description: 'Please sign in to access this page.',
          action: (
            <button
              onClick={() => router.push('/auth/login')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Sign In
            </button>
          ),
          color: 'text-gray-400'
        }

      case 'unverified':
        return {
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          title: 'Email Verification Required',
          description: 'Please verify your email address to continue.',
          action: (
            <button
              onClick={() => router.push('/auth/verify-email')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Verify Email
            </button>
          ),
          color: 'text-yellow-400'
        }

      case 'insufficient_roles':
        return {
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          ),
          title: 'Access Denied',
          description: 'You don\'t have sufficient permissions to access this page.',
          action: (
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          ),
          color: 'text-red-400',
          details: (
            <div className="bg-gray-100 rounded-lg p-4 mb-6 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Your role:</span> {userRole || 'None'}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Required roles:</span> {requiredRoles?.join(', ') || 'None'}
              </p>
            </div>
          )
        }

      case 'custom_validation':
        return {
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          title: 'Access Restricted',
          description: message || 'Access to this page is currently restricted.',
          action: (
            <button
              onClick={() => router.back()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go Back
            </button>
          ),
          color: 'text-orange-400'
        }

      case 'error':
        return {
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: 'Authentication Error',
          description: error || 'An error occurred while checking your permissions.',
          action: (
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          ),
          color: 'text-red-400'
        }

      default:
        return {
          icon: null,
          title: 'Access Denied',
          description: 'You cannot access this page.',
          action: null,
          color: 'text-gray-400'
        }
    }
  }

  const content = getContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        {content.icon && (
          <div className={`mx-auto mb-6 ${content.color}`}>
            {content.icon}
          </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{content.title}</h2>
        <p className="text-gray-600 mb-6">{content.description}</p>
        {content.details}
        {content.action}
      </div>
    </div>
  )
}

const DefaultLoadingComponent: React.FC<{ message?: string }> = ({ 
  message = "Checking permissions..." 
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg">{message}</p>
    </div>
  </div>
)

/**
 * Get user role from the auth user object
 */
function getUserRole(user: any): string | null {
  if (user?.role) return user.role
  if (user?.user_metadata?.role) return user.user_metadata.role
  if (user?.app_metadata?.role) return user.app_metadata.role
  return 'user' // Default role for authenticated users
}

/**
 * Check if user has required roles
 */
function hasRequiredRoles(
  userRole: string | null, 
  allowedRoles: string[], 
  requireAll: boolean = false
): boolean {
  if (!userRole || !allowedRoles.length) return false
  
  if (requireAll) {
    // For future complex role requirements (currently simplified)
    return allowedRoles.includes(userRole)
  } else {
    // User needs ANY of the specified roles
    return allowedRoles.includes(userRole)
  }
}

/**
 * ProtectedRoute component for declarative route protection
 * 
 * Usage examples:
 * 
 * // Basic authentication
 * <ProtectedRoute requireAuth>
 *   <DashboardComponent />
 * </ProtectedRoute>
 * 
 * // Role-based protection
 * <ProtectedRoute requireAuth allowedRoles={['admin', 'manager']}>
 *   <AdminPanel />
 * </ProtectedRoute>
 * 
 * // Custom validation
 * <ProtectedRoute customValidator={user => user.has_premium}>
 *   <PremiumFeature />
 * </ProtectedRoute>
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireEmailVerification = false,
  allowedRoles,
  requireAllRoles = false,
  redirectTo,
  fallback: FallbackComponent = DefaultFallbackComponent,
  showLoader = true,
  loadingMessage,
  customValidator
}) => {
  const { user, loading, error } = useAuth()
  const router = useRouter()

  // Show loading state
  if (loading && showLoader) {
    return <DefaultLoadingComponent message={loadingMessage} />
  }

  // Handle authentication errors
  if (error) {
    return (
      <FallbackComponent 
        reason="error" 
        error={error} 
      />
    )
  }

  // Check authentication requirement
  if (requireAuth && !user) {
    // Handle redirect
    React.useEffect(() => {
      if (redirectTo) {
        const currentPath = window.location.pathname + window.location.search
        const redirectUrl = `${redirectTo}?redirectTo=${encodeURIComponent(currentPath)}`
        router.push(redirectUrl)
      }
    }, [router])

    return (
      <FallbackComponent 
        reason="unauthenticated" 
      />
    )
  }

  // Check email verification requirement
  if (requireEmailVerification && user && !user.email_confirmed_at) {
    return (
      <FallbackComponent 
        reason="unverified" 
        user={user} 
      />
    )
  }

  // Check role-based access control
  if (allowedRoles && allowedRoles.length > 0 && user) {
    const userRole = getUserRole(user)
    const hasAccess = hasRequiredRoles(userRole, allowedRoles, requireAllRoles)

    if (!hasAccess) {
      return (
        <FallbackComponent 
          reason="insufficient_roles" 
          user={user} 
          userRole={userRole || undefined}
          requiredRoles={allowedRoles} 
        />
      )
    }
  }

  // Custom validation
  if (customValidator && user) {
    const validationResult = customValidator(user)
    
    if (typeof validationResult === 'boolean' && !validationResult) {
      return (
        <FallbackComponent 
          reason="custom_validation" 
          user={user} 
        />
      )
    }
    
    if (typeof validationResult === 'object' && !validationResult.valid) {
      return (
        <FallbackComponent 
          reason="custom_validation" 
          user={user} 
          message={validationResult.message}
        />
      )
    }
  }

  // All checks passed, render children
  return <>{children}</>
}

// Convenience components for common protection patterns
export const AuthRequired: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAuth>
    {children}
  </ProtectedRoute>
)

export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAuth allowedRoles={['admin']}>
    {children}
  </ProtectedRoute>
)

export const ManagerOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAuth allowedRoles={['admin', 'manager']}>
    {children}
  </ProtectedRoute>
)

export const UserOrAbove: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAuth allowedRoles={['user', 'admin', 'manager']}>
    {children}
  </ProtectedRoute>
)

export default ProtectedRoute