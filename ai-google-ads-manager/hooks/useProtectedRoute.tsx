'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGoogleTokens } from './useGoogleTokens'

export interface ProtectionConfig {
  requireAuth?: boolean
  requireValidToken?: boolean
  redirectTo?: string
  allowUnauthenticated?: boolean
  minimumHealthScore?: number
}

export interface UseProtectedRouteReturn {
  // Protection status
  isProtected: boolean
  isAuthenticated: boolean
  hasValidToken: boolean
  isLoading: boolean
  canAccess: boolean
  
  // Redirect functions
  redirectToLogin: (returnUrl?: string) => void
  redirectToAuth: () => void
  redirectToDashboard: () => void
  
  // Route guards
  requireAuthentication: () => Promise<boolean>
  requireValidTokens: () => Promise<boolean>
  checkRouteAccess: (config?: ProtectionConfig) => Promise<boolean>
  
  // Protection utilities
  withProtection: <T>(action: () => Promise<T>, config?: ProtectionConfig) => Promise<T | null>
  getReturnUrl: () => string
}

/**
 * Protected route management hook for Phase A implementation
 * Handles route-level authentication and authorization
 */
export function useProtectedRoute(config: ProtectionConfig = {}): UseProtectedRouteReturn {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, isTokenValid } = useAuth()
  const { hasToken, healthScore, loading: tokenLoading } = useGoogleTokens()
  
  // Default protection configuration
  const {
    requireAuth = true,
    requireValidToken = false,
    redirectTo = '/auth/login',
    allowUnauthenticated = false,
    minimumHealthScore = 0
  } = config

  // State management
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [canAccess, setCanAccess] = useState<boolean>(false)

  // Computed states
  const isAuthenticated = !!user && !authLoading
  const hasValidToken = isTokenValid && hasToken
  const isProtected = requireAuth || requireValidToken

  // Update access status when dependencies change
  useEffect(() => {
    let mounted = true

    const checkAccess = async () => {
      if (authLoading || tokenLoading) return

      try {
        let accessGranted = true

        // Check authentication requirement
        if (requireAuth && !isAuthenticated) {
          accessGranted = false
        }

        // Check token requirement
        if (requireValidToken && !hasValidToken) {
          accessGranted = false
        }

        // Check minimum health score
        if (minimumHealthScore > 0 && healthScore < minimumHealthScore) {
          accessGranted = false
        }

        // Allow unauthenticated access if configured
        if (allowUnauthenticated && !isAuthenticated) {
          accessGranted = true
        }

        if (mounted) {
          setCanAccess(accessGranted)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Route access check failed:', error)
        if (mounted) {
          setCanAccess(false)
          setIsLoading(false)
        }
      }
    }

    checkAccess()

    return () => {
      mounted = false
    }
  }, [
    isAuthenticated, 
    hasValidToken, 
    healthScore, 
    authLoading, 
    tokenLoading, 
    requireAuth, 
    requireValidToken, 
    allowUnauthenticated, 
    minimumHealthScore
  ])

  // Get return URL for post-auth redirect
  const getReturnUrl = useCallback((): string => {
    if (typeof window === 'undefined') return '/'
    
    const currentPath = pathname
    const searchParams = new URLSearchParams(window.location.search)
    const returnUrl = searchParams.get('returnUrl')
    
    return returnUrl || currentPath || '/dashboard'
  }, [pathname])

  // Redirect to login with return URL
  const redirectToLogin = useCallback((returnUrl?: string) => {
    const targetUrl = returnUrl || getReturnUrl()
    const loginUrl = `${redirectTo}?returnUrl=${encodeURIComponent(targetUrl)}`
    
    console.log('🔄 Redirecting to login:', loginUrl)
    router.push(loginUrl)
  }, [router, redirectTo, getReturnUrl])

  // Redirect to auth (generic)
  const redirectToAuth = useCallback(() => {
    redirectToLogin()
  }, [redirectToLogin])

  // Redirect to dashboard
  const redirectToDashboard = useCallback(() => {
    console.log('🔄 Redirecting to dashboard')
    router.push('/dashboard')
  }, [router])

  // Require authentication
  const requireAuthentication = useCallback(async (): Promise<boolean> => {
    if (authLoading) return false
    
    if (!isAuthenticated) {
      console.log('🚫 Authentication required - redirecting to login')
      redirectToLogin()
      return false
    }
    
    return true
  }, [isAuthenticated, authLoading, redirectToLogin])

  // Require valid tokens
  const requireValidTokens = useCallback(async (): Promise<boolean> => {
    if (authLoading || tokenLoading) return false
    
    if (!isAuthenticated) {
      console.log('🚫 Authentication required for token validation')
      redirectToLogin()
      return false
    }
    
    if (!hasValidToken) {
      console.log('🚫 Valid tokens required - redirecting to re-auth')
      // Could redirect to a token refresh page or re-auth flow
      redirectToLogin()
      return false
    }
    
    return true
  }, [isAuthenticated, hasValidToken, authLoading, tokenLoading, redirectToLogin])

  // Check route access with custom config
  const checkRouteAccess = useCallback(async (customConfig?: ProtectionConfig): Promise<boolean> => {
    const effectiveConfig = { ...config, ...customConfig }
    
    if (authLoading || tokenLoading) return false

    // Check authentication
    if (effectiveConfig.requireAuth && !isAuthenticated) {
      if (!effectiveConfig.allowUnauthenticated) {
        console.log('🚫 Route requires authentication')
        redirectToLogin()
        return false
      }
    }

    // Check token validity
    if (effectiveConfig.requireValidToken && !hasValidToken) {
      console.log('🚫 Route requires valid tokens')
      redirectToLogin()
      return false
    }

    // Check minimum health score
    if ((effectiveConfig.minimumHealthScore || 0) > 0 && healthScore < (effectiveConfig.minimumHealthScore || 0)) {
      console.log('🚫 Route requires higher token health score')
      redirectToLogin()
      return false
    }

    return true
  }, [
    config, 
    isAuthenticated, 
    hasValidToken, 
    healthScore, 
    authLoading, 
    tokenLoading, 
    redirectToLogin
  ])

  // Execute action with protection
  const withProtection = useCallback(async function<T>(
    action: () => Promise<T>, 
    actionConfig?: ProtectionConfig
  ): Promise<T | null> {
    const hasAccess = await checkRouteAccess(actionConfig)
    
    if (!hasAccess) {
      console.log('🚫 Action blocked - insufficient permissions')
      return null
    }
    
    try {
      return await action()
    } catch (error) {
      console.error('Protected action failed:', error)
      throw error
    }
  }, [checkRouteAccess])

  return {
    // Protection status
    isProtected,
    isAuthenticated,
    hasValidToken,
    isLoading,
    canAccess,
    
    // Redirect functions
    redirectToLogin,
    redirectToAuth,
    redirectToDashboard,
    
    // Route guards
    requireAuthentication,
    requireValidTokens,
    checkRouteAccess,
    
    // Protection utilities
    withProtection,
    getReturnUrl,
  }
}

// Higher-order component factory for protected routes
export function createProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  config?: ProtectionConfig
): React.ComponentType<P> {
  const ProtectedComponent: React.FC<P> = (props) => {
    const { isLoading, canAccess, redirectToLogin } = useProtectedRoute(config)

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!canAccess) {
      // Redirect will be handled by the hook
      redirectToLogin()
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Redirecting to authentication...</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }

  ProtectedComponent.displayName = `Protected(${Component.displayName || Component.name})`
  return ProtectedComponent
}

export default useProtectedRoute