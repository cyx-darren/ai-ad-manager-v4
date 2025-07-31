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
  signInWithGoogle: (redirectTo?: string) => Promise<{ error?: any }>
  signOut: () => Promise<{ error?: any }>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state and listen for changes
  useEffect(() => {
    console.log('🔄 Initializing auth state...')

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting initial session:', error)
          setError(error.message)
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log('✅ Initial session found for user:', session.user.email)
          
          // Try to get additional user data from users table, but handle RLS issues gracefully
          try {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('role, google_refresh_token')
              .eq('id', session.user.id)
              .single()

            const authUser: AuthUser = {
              ...session.user,
              role: userData?.role || 'user',
              google_refresh_token: userData?.google_refresh_token
            }

            setUser(authUser)
          } catch (error) {
            console.warn('⚠️ Could not fetch additional user data (RLS issue), using basic auth data:', error)
            // Fall back to basic user data from Supabase auth
            const authUser: AuthUser = {
              ...session.user,
              role: 'user',
              google_refresh_token: undefined
            }
            setUser(authUser)
          }
        } else {
          console.log('No initial session found')
        }
      } catch (error) {
        console.error('Error during initial auth check:', error)
        setError('Failed to check authentication status')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email)

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          // Try to get additional user data from users table, but handle RLS issues gracefully
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('role, google_refresh_token')
              .eq('id', session.user.id)
              .single()

            const authUser: AuthUser = {
              ...session.user,
              role: userData?.role || 'user',
              google_refresh_token: userData?.google_refresh_token
            }

            setUser(authUser)
          } catch (error) {
            console.warn('⚠️ Could not fetch additional user data (RLS issue), using basic auth data:', error)
            // Fall back to basic user data from Supabase auth
            const authUser: AuthUser = {
              ...session.user,
              role: 'user',
              google_refresh_token: undefined
            }
            setUser(authUser)
          }
          setError(null)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setError(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Try to update user data on token refresh, but handle RLS issues gracefully
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('role, google_refresh_token')
              .eq('id', session.user.id)
              .single()

            const authUser: AuthUser = {
              ...session.user,
              role: userData?.role || 'user',
              google_refresh_token: userData?.google_refresh_token
            }

            setUser(authUser)
          } catch (error) {
            console.warn('⚠️ Could not fetch additional user data during token refresh, keeping current user data:', error)
            // Keep current user data if query fails
            if (user) {
              const authUser: AuthUser = {
                ...session.user,
                role: user.role || 'user',
                google_refresh_token: user.google_refresh_token
              }
              setUser(authUser)
            }
          }
        }

        setLoading(false)
      } catch (error) {
        console.error('Error handling auth state change:', error)
        setError('Authentication state error')
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/analytics.readonly',
          redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      return { data, error }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      setError(errorMessage)
      return { error: { message: errorMessage } }
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) {
        setError(error.message)
        return { error }
      }
      setUser(null)
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      setError(errorMessage)
      return { error: { message: errorMessage } }
    }
  }

  const clearError = () => {
    setError(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    clearError,
  }

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