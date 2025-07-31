'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import LoginButton from '@/components/auth/LoginButton'
import Link from 'next/link'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading, error, clearError } = useAuth()
  const [redirectTo, setRedirectTo] = useState<string>('/')

  useEffect(() => {
    // Get redirect destination from URL params
    const redirect = searchParams.get('redirectTo')
    if (redirect) {
      setRedirectTo(decodeURIComponent(redirect))
    }
  }, [searchParams])

  useEffect(() => {
    // If user is already authenticated, redirect to intended destination
    if (user && !loading) {
      router.push(redirectTo)
    }
  }, [user, loading, redirectTo, router])

  const handleLoginSuccess = () => {
    // LoginButton will handle the redirect, but we can add additional logic here
    console.log('Login successful, redirecting to:', redirectTo)
  }

  const handleLoginError = (error: string) => {
    console.error('Login error:', error)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-green-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-purple-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full" style={{ maxWidth: '448px' }}>
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-purple-200 mb-6 shadow-lg">
            <svg className="h-10 w-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            Sign in to AI Ad Manager
          </h1>
          <p className="text-base sm:text-lg text-gray-600" style={{ maxWidth: '512px', margin: '0 auto' }}>
            Connect with Google to access your analytics dashboard
          </p>
        </div>

        {/* Main Form Container */}
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 lg:p-12 border border-gray-100">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Authentication Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={clearError}
                      className="bg-red-50 px-3 py-2 rounded-lg text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sign-in Form */}
          <div className="space-y-8">
            {/* Google Sign-in Button */}
            <div style={{ maxWidth: '384px', margin: '0 auto' }}>
              <LoginButton
                onSuccess={handleLoginSuccess}
                onError={handleLoginError}
                showRememberMe={true}
                variant="primary"
                size="lg"
                className="w-full"
              />
            </div>
            
            {/* Terms and Privacy Policy */}
            <div className="text-center pt-4">
              <p className="text-sm text-gray-600 leading-relaxed" style={{ maxWidth: '400px', margin: '0 auto' }}>
                By signing in, you agree to our{' '}
                <Link href="/terms" className="font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200 underline decoration-purple-200 hover:decoration-purple-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200 underline decoration-purple-200 hover:decoration-purple-400">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <div className="text-center mb-8">
              <h3 className="text-base font-semibold text-gray-900 uppercase tracking-wide">
                Benefits of Google Sign-In
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-green-50 border border-green-100">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">Automatic Google Analytics integration</span>
              </div>
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">Secure data access and storage</span>
              </div>
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-purple-50 border border-purple-100">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">No additional passwords to remember</span>
              </div>
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">Enterprise-grade security standards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 group"
          >
            <svg className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading authentication...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
} 