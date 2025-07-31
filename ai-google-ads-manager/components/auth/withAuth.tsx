'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface WithAuthOptions {
  redirectTo?: string
  showLoader?: boolean
  fallback?: React.ComponentType
  requireEmailVerification?: boolean
}

interface LoadingComponentProps {
  message?: string
}

const DefaultLoadingComponent: React.FC<LoadingComponentProps> = ({ message = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg">{message}</p>
    </div>
  </div>
)

const DefaultUnauthenticatedComponent: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="w-16 h-16 mx-auto mb-6 text-gray-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
      <p className="text-gray-600 mb-6">Please sign in to access this page.</p>
      <button
        onClick={() => window.location.href = '/auth/login'}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Sign In
      </button>
    </div>
  </div>
)

/**
 * Higher-order component that protects routes by requiring authentication
 * @param Component - The component to wrap
 * @param options - Configuration options for the authentication wrapper
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
): React.ComponentType<P> {
  const {
    redirectTo = '/auth/login',
    showLoader = true,
    fallback: FallbackComponent = DefaultUnauthenticatedComponent,
    requireEmailVerification = false
  } = options

  return function AuthenticatedComponent(props: P) {
    const { user, loading, error } = useAuth()
    const router = useRouter()

    // Show loading state
    if (loading && showLoader) {
      return <DefaultLoadingComponent message="Verifying authentication..." />
    }

    // Handle authentication errors
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-6 text-red-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    // Check if user is authenticated
    if (!user) {
      // Use client-side redirect to avoid SSR issues
      React.useEffect(() => {
        const currentPath = window.location.pathname + window.location.search
        const redirectUrl = `${redirectTo}?redirectTo=${encodeURIComponent(currentPath)}`
        router.push(redirectUrl)
      }, [router])

      return <FallbackComponent />
    }

    // Check email verification if required
    if (requireEmailVerification && !user.email_confirmed_at) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-6 text-yellow-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Email Verification Required</h2>
            <p className="text-gray-600 mb-6">
              Please check your email and click the verification link to continue.
            </p>
            <button
              onClick={() => router.push('/auth/verify-email')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Resend Verification Email
            </button>
          </div>
        </div>
      )
    }

    // User is authenticated and verified, render the component
    return <Component {...props} />
  }
}

// Named export with default options for common use cases
export const withAuthRequired = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { requireEmailVerification: false })

export const withAuthAndVerification = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { requireEmailVerification: true })

export default withAuth