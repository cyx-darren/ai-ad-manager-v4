'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface WithRolesOptions {
  allowedRoles: string[]
  redirectTo?: string
  fallback?: React.ComponentType<{ userRole?: string; requiredRoles: string[] }>
  requireAll?: boolean // If true, user must have ALL roles; if false, user needs ANY role
  showLoader?: boolean
}

interface AccessDeniedComponentProps {
  userRole?: string
  requiredRoles: string[]
}

const DefaultAccessDeniedComponent: React.FC<AccessDeniedComponentProps> = ({ 
  userRole, 
  requiredRoles 
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="w-16 h-16 mx-auto mb-6 text-red-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
      <p className="text-gray-600 mb-4">
        You don't have sufficient permissions to access this page.
      </p>
      <div className="bg-gray-100 rounded-lg p-4 mb-6 text-sm">
        <p className="text-gray-700">
          <span className="font-medium">Your role:</span> {userRole || 'None'}
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Required roles:</span> {requiredRoles.join(', ')}
        </p>
      </div>
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
)

const DefaultLoadingComponent: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg">Checking permissions...</p>
    </div>
  </div>
)

/**
 * Check if user has required roles
 */
function hasRequiredRoles(
  userRole: string | null | undefined, 
  allowedRoles: string[], 
  requireAll: boolean = false
): boolean {
  if (!userRole || !allowedRoles.length) return false
  
  if (requireAll) {
    // User must have ALL specified roles (for complex role requirements)
    return allowedRoles.includes(userRole)
  } else {
    // User needs ANY of the specified roles (most common case)
    return allowedRoles.includes(userRole)
  }
}

/**
 * Get user role from the auth context
 */
function getUserRole(user: any): string | null {
  // Try to get role from different possible locations
  if (user?.role) return user.role
  if (user?.user_metadata?.role) return user.user_metadata.role
  if (user?.app_metadata?.role) return user.app_metadata.role
  
  // Default role for authenticated users
  return 'user'
}

/**
 * Higher-order component that protects routes by requiring specific roles
 * @param Component - The component to wrap
 * @param options - Configuration options for role-based protection
 */
export function withRoles<P extends object>(
  Component: React.ComponentType<P>,
  options: WithRolesOptions
): React.ComponentType<P> {
  const {
    allowedRoles,
    redirectTo = '/dashboard',
    fallback: FallbackComponent = DefaultAccessDeniedComponent,
    requireAll = false,
    showLoader = true
  } = options

  return function RoleProtectedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    // Show loading state while checking authentication and roles
    if (loading && showLoader) {
      return <DefaultLoadingComponent />
    }

    // If user is not authenticated, redirect to login
    if (!user) {
      React.useEffect(() => {
        const currentPath = window.location.pathname + window.location.search
        const redirectUrl = `/auth/login?redirectTo=${encodeURIComponent(currentPath)}`
        router.push(redirectUrl)
      }, [router])

      return <DefaultLoadingComponent />
    }

    // Get user role
    const userRole = getUserRole(user)
    
    // Check if user has required roles
    const hasAccess = hasRequiredRoles(userRole, allowedRoles, requireAll)

    if (!hasAccess) {
      // Use client-side redirect to avoid SSR issues
      React.useEffect(() => {
        if (redirectTo && redirectTo !== window.location.pathname) {
          const redirectUrl = `${redirectTo}?error=insufficient_permissions&required=${encodeURIComponent(allowedRoles.join(','))}&current=${encodeURIComponent(userRole || '')}`
          router.push(redirectUrl)
        }
      }, [router, userRole])

      return (
        <FallbackComponent 
          userRole={userRole || undefined} 
          requiredRoles={allowedRoles} 
        />
      )
    }

    // User has required roles, render the component
    return <Component {...props} />
  }
}

// Predefined role-based HOCs for common use cases
export const withAdminRole = <P extends object>(Component: React.ComponentType<P>) =>
  withRoles(Component, { allowedRoles: ['admin'] })

export const withManagerRole = <P extends object>(Component: React.ComponentType<P>) =>
  withRoles(Component, { allowedRoles: ['admin', 'manager'] })

export const withUserRole = <P extends object>(Component: React.ComponentType<P>) =>
  withRoles(Component, { allowedRoles: ['user', 'admin', 'manager'] })

// Utility hook for checking roles in components
export function useRole(): {
  role: string | null
  hasRole: (requiredRoles: string | string[]) => boolean
  isAdmin: boolean
  isManager: boolean
  isUser: boolean
} {
  const { user } = useAuth()
  const userRole = getUserRole(user)

  const hasRole = (requiredRoles: string | string[]): boolean => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
    return hasRequiredRoles(userRole, roles, false)
  }

  return {
    role: userRole,
    hasRole,
    isAdmin: hasRole(['admin']),
    isManager: hasRole(['admin', 'manager']),
    isUser: hasRole(['user', 'admin', 'manager'])
  }
}

// Component for conditionally rendering content based on roles
interface RoleGateProps {
  allowedRoles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
  requireAll?: boolean
}

export const RoleGate: React.FC<RoleGateProps> = ({ 
  allowedRoles, 
  children, 
  fallback = null,
  requireAll = false 
}) => {
  const { user } = useAuth()
  const userRole = getUserRole(user)
  
  const hasAccess = hasRequiredRoles(userRole, allowedRoles, requireAll)
  
  return hasAccess ? <>{children}</> : <>{fallback}</>
}

export default withRoles