import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser extends User {
  role?: string
  google_refresh_token?: string
}

export const auth = {
  // Sign in with Google OAuth
  signInWithGoogle: async (redirectTo?: string) => {
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
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  getCurrentUser: async (): Promise<AuthUser | null> => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    // Get additional user data from our users table
    const { data: userData } = await supabase
      .from('users')
      .select('role, google_refresh_token')
      .eq('id', user.id)
      .single()

    return {
      ...user,
      role: userData?.role,
      google_refresh_token: userData?.google_refresh_token,
    }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (user: AuthUser | null) => void) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await auth.getCurrentUser()
        callback(user)
      } else {
        callback(null)
      }
    })
  },

  // Create or update user profile
  upsertUserProfile: async (user: User, additionalData?: Partial<AuthUser>) => {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email!,
        role: additionalData?.role || 'user',
        google_refresh_token: additionalData?.google_refresh_token,
        updated_at: new Date().toISOString(),
      })

    return { error }
  }
}

export default auth 