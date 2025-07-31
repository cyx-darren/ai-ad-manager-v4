'use client'

import LoginButton from './LoginButton'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function OAuthTestSection() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="border-t pt-6 mt-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🧪 OAuth Test (Step 3.2 Phase C)</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading authentication state...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="border-t pt-6 mt-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">✅ Authentication Complete</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800">Successfully Signed In</h3>
              <p className="mt-1 text-sm text-green-700">
                Welcome back, {user.email}! Your authentication is working correctly.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  🚀 Go to Dashboard
                </Link>
                <button
                  onClick={signOut}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t pt-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">🧪 OAuth Test (Step 3.2 Phase C)</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">Test Advanced Authentication Features</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p className="mb-3">
                Phase C includes advanced authentication context, protected routes, and session management.
              </p>
              <ul className="list-disc list-inside space-y-1 mb-4">
                <li>✅ AuthContext with state management</li>
                <li>✅ Protected route with withAuth HOC</li>
                <li>✅ Session refresh and error handling</li>
                <li>✅ Sign out functionality</li>
                <li>✅ User profile management</li>
              </ul>
            </div>
            <div className="mt-4">
              <LoginButton 
                className="mb-4"
                showRememberMe={true}
                variant="primary"
                size="md"
                onSuccess={() => {
                  console.log('OAuth success - redirecting to dashboard')
                }}
                onError={(error) => {
                  console.error('OAuth error:', error)
                }}
              />
              <p className="text-sm text-blue-600">
                After signing in, you&apos;ll be redirected to the protected dashboard to test all Phase C features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 