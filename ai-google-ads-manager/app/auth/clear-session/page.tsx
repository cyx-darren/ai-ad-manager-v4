'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClearSessionPage() {
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const router = useRouter()

  const clearSession = async () => {
    setClearing(true)
    try {
      // Clear bridge cookies first
      document.cookie = 'sb-session-bridge=; Max-Age=0; path=/; SameSite=Lax'
      document.cookie = 'sb-auth-success=; Max-Age=0; path=/; SameSite=Lax'
      
      // Clear Supabase session
      await supabase.auth.signOut({ scope: 'local' })
      
      // Clear all browser storage
      if (typeof window !== 'undefined') {
        // Clear Supabase-specific storage
        const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`
        localStorage.removeItem(storageKey)
        
        // Clear any other auth-related storage
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
        
        sessionStorage.clear()
      }
      
      console.log('✅ Session and bridge cookies cleared successfully')
      setCleared(true)
      
      // Redirect to home after a delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error('Error clearing session:', error)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    // Auto-clear on page load
    clearSession()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto text-center p-6">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            {clearing ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            ) : cleared ? (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {clearing ? 'Clearing Session...' : cleared ? 'Session Cleared!' : 'Clear Authentication Session'}
        </h1>

        <p className="text-gray-600 mb-6">
          {clearing ? (
            'Removing stored authentication data and clearing browser storage...'
          ) : cleared ? (
            'Your authentication session has been cleared. You will be redirected to the home page shortly.'
          ) : (
            'This will clear all stored authentication data and fix any stuck login states.'
          )}
        </p>

        {cleared && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-700">
              ✅ Session cleared successfully! You can now sign in again without issues.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home Page
          </button>
          
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go to Login Page
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>This page automatically clears your session when loaded.</p>
          <p>Use this if you're stuck on "Loading authentication..."</p>
        </div>
      </div>
    </div>
  )
}