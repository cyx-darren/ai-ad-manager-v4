'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ErrorInfo {
  title: string
  description: string
  action: {
    text: string
    href: string
  }
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>({
    title: 'Authentication Error',
    description: 'An unexpected error occurred during authentication.',
    action: {
      text: 'Try Again',
      href: '/auth/login'
    }
  })

  useEffect(() => {
    // Parse error information from URL parameters
    const message = searchParams.get('message')
    const error = searchParams.get('error')
    const errorCode = searchParams.get('error_code')

    // Determine error type and customize display
    if (error === 'access_denied') {
      setErrorInfo({
        title: 'Access Denied',
        description: 'You declined to authorize the application. To use AI Ad Manager, please grant the necessary permissions.',
        action: {
          text: 'Try Again',
          href: '/auth/login'
        }
      })
    } else if (error === 'unauthorized_client') {
      setErrorInfo({
        title: 'Configuration Error',
        description: 'There&apos;s an issue with the application configuration. Please contact support.',
        action: {
          text: 'Go Home',
          href: '/'
        }
      })
    } else if (error === 'invalid_request' || errorCode === 'invalid_request') {
      setErrorInfo({
        title: 'Invalid Request',
        description: 'The authentication request was malformed. Please try signing in again.',
        action: {
          text: 'Try Again',
          href: '/auth/login'
        }
      })
    } else if (error === 'server_error' || errorCode === 'server_error') {
      setErrorInfo({
        title: 'Server Error',
        description: 'A temporary server error occurred. Please try again in a few moments.',
        action: {
          text: 'Try Again',
          href: '/auth/login'
        }
      })
    } else if (message) {
      setErrorInfo({
        title: 'Authentication Failed',
        description: message,
        action: {
          text: 'Try Again',
          href: '/auth/login'
        }
      })
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full space-y-8" style={{ maxWidth: '448px' }}>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {errorInfo.title}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {errorInfo.description}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Troubleshooting Tips
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check your internet connection</li>
                    <li>Ensure you&apos;re using a supported browser</li>
                    <li>Clear your browser cache and cookies</li>
                    <li>Disable browser extensions temporarily</li>
                    <li>Try using an incognito/private window</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Link
              href={errorInfo.action.href}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {errorInfo.action.text}
            </Link>
            
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go Home
            </Link>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Refresh Page
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              If this problem persists, please contact our support team with the error details above.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading error details...</p>
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
} 