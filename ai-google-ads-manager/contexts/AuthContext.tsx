'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthUser extends User {
  role?: string
  google_refresh_token?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearAuthState = () => {
    console.log('🧹 Clearing authentication state...')
    
    // Clear bridge cookies
    document.cookie = 'sb-session-bridge=; Max-Age=0; path=/; SameSite=Lax'
    document.cookie = 'sb-auth-success=; Max-Age=0; path=/; SameSite=Lax'
    
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
    setUser(null)
    setError(null)
  }

  // Improved user extraction that ensures email is available
  const createAuthUser = (supabaseUser: User): AuthUser => {
    console.log('🔍 Creating AuthUser from Supabase user:', {
      id: supabaseUser.id,
      email: supabaseUser.email,
      userMetadata: supabaseUser.user_metadata,
      appMetadata: supabaseUser.app_metadata
    })

    // Extract email with multiple fallbacks
    const email = supabaseUser.email || 
                  supabaseUser.user_metadata?.email || 
                  supabaseUser.user_metadata?.full_name ||
                  supabaseUser.identities?.[0]?.identity_data?.email ||
                  'Unknown User'

    console.log('✅ Extracted email:', email)

    return {
      ...supabaseUser,
      email,
      role: 'user',
      google_refresh_token: undefined
    }
  }

  useEffect(() => {
    console.log('🔄 Initializing auth state...')

    // Debug: Check Supabase client configuration
    console.log('🔍 SUPABASE CLIENT CHECK:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
      clientExists: !!supabase,
      authExists: !!supabase?.auth,
    })

    // Fail-safe timeout
    const timeoutId = setTimeout(() => {
      console.warn('⏰ AuthContext loading timeout - forcing loading to false')
      setLoading(false)
    }, 5000)

    const initAuth = async () => {
      try {
        console.log('🔍 Checking for session bridge from OAuth callback...')
        
        // Check for session bridge cookie
        const cookies = document.cookie.split(';').map(c => c.trim())
        const bridgeCookie = cookies.find(c => c.startsWith('sb-session-bridge='))
        
        if (bridgeCookie) {
          try {
            console.log('🔍 Session bridge found, attempting restoration...')
            const bridgeValue = decodeURIComponent(bridgeCookie.split('=')[1])
            const sessionBridgeData = JSON.parse(bridgeValue)
            
            if (sessionBridgeData.access_token && sessionBridgeData.refresh_token) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: sessionBridgeData.access_token,
                refresh_token: sessionBridgeData.refresh_token
              })
              
              if (sessionData.session?.user && !sessionError) {
                console.log('✅ Session restored from bridge')
                const authUser = createAuthUser(sessionData.session.user)
                setUser(authUser)
                setError(null)
                setLoading(false)
                
                // Clear bridge cookie
                document.cookie = 'sb-session-bridge=; Max-Age=0; path=/; SameSite=Lax'
                document.cookie = 'sb-auth-success=; Max-Age=0; path=/; SameSite=Lax'
                
                clearTimeout(timeoutId)
                return
              } else {
                console.warn('⚠️ Failed to restore session from bridge:', sessionError?.message)
              }
            }
          } catch (err) {
            console.error('❌ Error parsing session bridge:', err)
          }
        }
        
        console.log('🔍 Checking for existing session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Session check error:', error)
          
          // Handle 403 specifically
          if (error.status === 403) {
            console.log('🔧 403 error detected, trying session recovery...')
            await handleSessionRecovery()
            return
          }
          
          setError(error.message)
          setLoading(false)
          clearTimeout(timeoutId)
          return
        }

        if (session?.user) {
          console.log('✅ Session found for user:', session.user.email)
          const authUser = createAuthUser(session.user)
          setUser(authUser)
        } else {
          console.log('ℹ️ No session found')
          
          // Try session recovery for authenticated pages
          if (window.location.pathname.startsWith('/dashboard')) {
            console.log('🔄 Dashboard detected, attempting session recovery...')
            await handleSessionRecovery()
            return
          }
          
          setUser(null)
        }

        setError(null)
        setLoading(false)
        clearTimeout(timeoutId)

      } catch (err: any) {
        console.error('❌ Session initialization failed:', err.message)
        setError(err.message)
        setLoading(false)
        clearTimeout(timeoutId)
      }
    }

    // Simplified session recovery
    const handleSessionRecovery = async () => {
      try {
        console.log('🔄 Attempting session recovery...')
        
        // Method 1: Try refresh session
        const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshResult.session?.user && !refreshError) {
          console.log('✅ Session recovered via refresh')
          const authUser = createAuthUser(refreshResult.session.user)
          setUser(authUser)
          setError(null)
          setLoading(false)
          clearTimeout(timeoutId)
          return
        }
        
        // Method 2: Try server-side session fetch
        console.log('🔄 Trying server-side session...')
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' }
        })
        
        if (response.ok) {
          const sessionData = await response.json()
          
          if (sessionData.user) {
            console.log('✅ User found via server-side session')
            const authUser = createAuthUser(sessionData.user)
            setUser(authUser)
            setError(null)
            setLoading(false)
            clearTimeout(timeoutId)
            return
          }
        } else if (response.status === 401) {
          console.log('ℹ️ Server confirms no valid session')
        } else {
          console.warn('⚠️ Server session fetch failed:', response.status)
        }
        
        // No recovery possible
        console.log('❌ Session recovery failed - no valid session found')
        setUser(null)
        setError('Session expired. Please sign in again.')
        setLoading(false)
        clearTimeout(timeoutId)
        
      } catch (err: any) {
        console.error('❌ Session recovery error:', err.message)
        setUser(null)
        setError('Session recovery failed')
        setLoading(false)
        clearTimeout(timeoutId)
      }
    }

    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email)

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in')
          const authUser = createAuthUser(session.user)
          setUser(authUser)
          setError(null)
        } else if (event === 'SIGNED_OUT') {
          console.log('ℹ️ User signed out')
          setUser(null)
          setError(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('✅ Token refreshed')
          const authUser = createAuthUser(session.user)
          setUser(authUser)
          setError(null)
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('✅ User updated')
          const authUser = createAuthUser(session.user)
          setUser(authUser)
        }
        setLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    // Initialize auth and set up listener
    initAuth()
    const unsubscribe = setupAuthListener()

    return () => {
      clearTimeout(timeoutId)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
      console.log('🚀 Redirecting to Google for sign-in...')
    } catch (err: any) {
      console.error('❌ Error signing in with Google:', err)
      setError(err.message || 'Failed to sign in with Google.')
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      
      // Clear all auth state first
      clearAuthState()
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      console.log('👋 User signed out successfully')
    } catch (err: any) {
      console.error('❌ Error signing out:', err)
      setError(err.message || 'Failed to sign out.')
      // Even if signOut fails, clear local state
      clearAuthState()
    }
  }

  const refreshSession = async () => {
    console.log('🔄 Manual session refresh requested...')
    setError(null)
    
    try {
      // Try session refresh
      const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshResult.session?.user && !refreshError) {
        console.log('✅ Session refreshed successfully')
        const authUser = createAuthUser(refreshResult.session.user)
        setUser(authUser)
        return
      }
      
      // Fallback: Try server-side session
      console.log('🔄 Trying server-side session...')
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' }
      })
      
      if (response.ok) {
        const sessionData = await response.json()
        if (sessionData.user) {
          console.log('✅ Session refreshed via server')
          const authUser = createAuthUser(sessionData.user)
          setUser(authUser)
          return
        }
      }
      
      // If all fails, clear state
      console.log('❌ Session refresh failed')
      setError('Session refresh failed. Please sign in again.')
      
    } catch (err: any) {
      console.error('❌ Session refresh error:', err)
      setError(err.message || 'Failed to refresh session.')
    }
  }

  const clearError = () => setError(null)

  const value = { user, loading, error, signInWithGoogle, signOut, clearError, refreshSession }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext