import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser extends User {
  role?: string
  google_refresh_token?: string
}

// Token validation and sanitization utilities
export const tokenUtils = {
  // Validate Google refresh token format
  validateRefreshToken: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false
    
    // Google refresh tokens typically start with "1//" and are 45-85 characters
    const refreshTokenPattern = /^1\/\/[\w\-\.]+$/
    const isValidFormat = refreshTokenPattern.test(token)
    const isValidLength = token.length >= 45 && token.length <= 85
    
    return isValidFormat && isValidLength
  },

  // Sanitize token (basic cleaning)
  sanitizeToken: (token: string): string => {
    return token.trim().replace(/[\r\n\t]/g, '')
  },

  // Extract token information safely
  getTokenInfo: (providerToken: unknown): { refreshToken?: string; scope?: string; expiresAt?: Date } => {
    const result: { refreshToken?: string; scope?: string; expiresAt?: Date } = {}
    
    try {
      // Extract refresh token
      if (providerToken && typeof providerToken === 'object' && 'refresh_token' in providerToken) {
        const token = (providerToken as { refresh_token?: string }).refresh_token
        if (token && typeof token === 'string') {
          const sanitized = tokenUtils.sanitizeToken(token)
          if (tokenUtils.validateRefreshToken(sanitized)) {
            result.refreshToken = sanitized
          }
        }
      }
      
      // Extract scope
      if (providerToken && typeof providerToken === 'object' && 'scope' in providerToken) {
        const scope = (providerToken as { scope?: string }).scope
        if (scope && typeof scope === 'string') {
          result.scope = scope
        }
      }
      
      // Calculate expiry (if expires_in is provided)
      if (providerToken && typeof providerToken === 'object' && 'expires_in' in providerToken) {
        const expiresIn = (providerToken as { expires_in?: number }).expires_in
        if (expiresIn && typeof expiresIn === 'number') {
          result.expiresAt = new Date(Date.now() + (expiresIn * 1000))
        }
      }
    } catch (error) {
      console.error('Error extracting token info:', error)
    }
    
    return result
  }
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

  // Enhanced Sign out with comprehensive token cleanup (Phase B)
  signOut: async (options: { fromAllDevices?: boolean; reason?: 'manual' | 'token_expired' | 'security' } = {}) => {
    const { fromAllDevices = false, reason = 'manual' } = options
    
    try {
      console.log('🚪 Starting comprehensive sign-out process...', { fromAllDevices, reason })
      
      // Get current user before signing out
      const currentUser = await auth.getCurrentUser()
      
      if (currentUser?.id) {
        console.log('🔄 Revoking refresh tokens for user:', currentUser.id)
        
        // Revoke Google refresh token first (Phase B enhancement)
        try {
          const revokeResult = await auth.revokeRefreshToken(currentUser.id)
          if (revokeResult.success) {
            console.log('✅ Google refresh token successfully revoked')
          } else {
            console.warn('⚠️ Failed to revoke Google refresh token:', revokeResult.error ? String(revokeResult.error) : 'Unknown error')
          }
        } catch (error) {
          console.error('❌ Error during token revocation:', error)
          // Continue with sign-out even if token revocation fails
        }
        
        // Sign out from all devices if requested (Phase B)
        if (fromAllDevices) {
          try {
            console.log('🌐 Signing out from all devices...')
            // This will invalidate all refresh tokens for the user
            const { error: globalSignOutError } = await supabase.auth.signOut({ scope: 'global' })
            if (globalSignOutError) {
              console.warn('⚠️ Global sign-out error:', globalSignOutError)
            } else {
              console.log('✅ Successfully signed out from all devices')
            }
          } catch (error) {
            console.error('❌ Error during global sign-out:', error)
          }
        }
        
        // Log security event for audit trail (Phase B)
        console.log('📊 Logging sign-out security event for user:', currentUser.id, { reason, fromAllDevices })
      }
      
      // Clear all browser storage (Phase B comprehensive cleanup)
      try {
        // Clear localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const authKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('auth_') || 
            key.startsWith('supabase') || 
            key.startsWith('sb-') ||
            key.includes('token') ||
            key.includes('session')
          )
          authKeys.forEach(key => localStorage.removeItem(key))
          console.log('🧹 LocalStorage cleanup completed:', authKeys.length, 'items removed')
        }
        
        // Clear sessionStorage
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const sessionKeys = Object.keys(sessionStorage).filter(key => 
            key.startsWith('auth_') || 
            key.startsWith('supabase') || 
            key.startsWith('sb-') ||
            key.includes('token') ||
            key.includes('session')
          )
          sessionKeys.forEach(key => sessionStorage.removeItem(key))
          console.log('🧹 SessionStorage cleanup completed:', sessionKeys.length, 'items removed')
        }
        
        // Clear auth-related cookies
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';')
          const authCookies = cookies.filter(cookie => {
            const name = cookie.split('=')[0].trim()
            return name.startsWith('sb-') || 
                   name.startsWith('supabase') || 
                   name.includes('auth') ||
                   name.includes('token')
          })
          
          authCookies.forEach(cookie => {
            const name = cookie.split('=')[0].trim()
            // Clear cookie with multiple domain/path combinations to ensure removal
            const clearOptions = [
              '',
              '; path=/',
              '; path=/; domain=' + window.location.hostname,
              '; path=/; domain=.' + window.location.hostname,
            ]
            
            clearOptions.forEach(options => {
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${options}`
            })
          })
          console.log('🍪 Cookie cleanup completed:', authCookies.length, 'cookies cleared')
        }
        
      } catch (error) {
        console.warn('⚠️ Storage cleanup error:', error)
      }
      
      // Sign out from Supabase (local session only if not global)
      const { error } = await supabase.auth.signOut({ 
        scope: fromAllDevices ? 'global' : 'local' 
      })
      
      if (error) {
        console.error('❌ Supabase sign-out error:', error)
        return { error: { message: String(error) || 'Failed to sign out' } }
      }
      
      // Clear any cached data (Phase B)
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheNames = await caches.keys()
          const authCaches = cacheNames.filter(name => 
            name.includes('auth') || 
            name.includes('user') || 
            name.includes('session')
          )
          
          await Promise.all(authCaches.map(name => caches.delete(name)))
          console.log('💾 Cache cleanup completed:', authCaches.length, 'caches cleared')
        } catch (error) {
          console.warn('⚠️ Cache cleanup error:', error)
        }
      }
      
      console.log('✅ Comprehensive sign-out completed successfully')
      return { error: null, reason, fromAllDevices }
    } catch (error) {
      console.error('❌ Critical error during sign-out:', error)
      return { error: { message: error instanceof Error ? error.message : 'Unknown sign-out error' } }
    }
  },

  // Phase B: Quick sign-out (for UI buttons)
  quickSignOut: async () => {
    return auth.signOut({ fromAllDevices: false, reason: 'manual' })
  },

  // Phase B: Security sign-out (for security events)
  securitySignOut: async () => {
    return auth.signOut({ fromAllDevices: true, reason: 'security' })
  },

  // Phase B: Token expiry sign-out
  tokenExpirySignOut: async () => {
    return auth.signOut({ fromAllDevices: false, reason: 'token_expired' })
  },

  // Get current user with refresh token status
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

  // Enhanced: Store refresh token securely using Phase A functions
  storeRefreshToken: async (userId: string, tokenInfo: { refreshToken: string; scope?: string; expiresAt?: Date }) => {
    try {
      const { data, error } = await supabase.rpc('store_user_refresh_token', {
        user_uuid: userId,
        token_value: tokenInfo.refreshToken,
        expires_at: tokenInfo.expiresAt?.toISOString() || null,
        token_scope: tokenInfo.scope || null
      })

      if (error) {
        console.error('Error storing refresh token:', error)
        return { success: false, error }
      }

      console.log('Refresh token stored securely')
      return { success: true, data }
    } catch (error) {
      console.error('Error calling store_user_refresh_token:', error)
      return { success: false, error }
    }
  },

  // Enhanced: Get refresh token securely using Phase A functions
  getRefreshToken: async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_refresh_token', {
        user_uuid: userId
      })

      if (error) {
        console.error('Error retrieving refresh token:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error calling get_user_refresh_token:', error)
      return null
    }
  },

  // Enhanced: Check token health using Phase A functions
  checkTokenHealth: async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('check_token_health', {
        user_uuid: userId
      })

      if (error) {
        console.error('Error checking token health:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error calling check_token_health:', error)
      return null
    }
  },

  // Enhanced: Revoke refresh token using Phase A functions
  revokeRefreshToken: async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('revoke_user_refresh_token', {
        user_uuid: userId
      })

      if (error) {
        console.error('Error revoking refresh token:', error)
        return { success: false, error }
      }

      console.log('Refresh token revoked successfully')
      return { success: true, data }
    } catch (error) {
      console.error('Error calling revoke_user_refresh_token:', error)
      return { success: false, error }
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

  // Enhanced: Create or update user profile with token capture
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
  },

  // NEW: Enhanced callback processing with token capture
  processOAuthCallback: async (session: { user?: { id: string; email?: string }; provider_token?: unknown }) => {
    try {
      if (!session?.user) {
        throw new Error('No user session found')
      }

      const user = session.user
      
      // Extract provider token information
      const providerToken = session.provider_token
      const tokenInfo = tokenUtils.getTokenInfo(providerToken)

      // Create/update user profile first
      const { error: profileError } = await auth.upsertUserProfile(user as User)
      if (profileError) {
        console.error('Error creating user profile:', profileError)
        throw profileError
      }

      // Store refresh token securely if captured
      if (tokenInfo.refreshToken) {
        console.log('Refresh token captured, storing securely...')
        const { success, error: tokenError } = await auth.storeRefreshToken(user.id, {
          refreshToken: tokenInfo.refreshToken,
          scope: tokenInfo.scope,
          expiresAt: tokenInfo.expiresAt
        })
        
        if (!success) {
          console.error('Failed to store refresh token:', tokenError)
          // Don't fail the entire auth flow, but log the issue
        } else {
          console.log('✅ Refresh token stored successfully with scope:', tokenInfo.scope)
        }
      } else {
        console.warn('⚠️ No refresh token captured in OAuth flow')
      }

      return { success: true, user, tokenInfo }
    } catch (error) {
      console.error('Error processing OAuth callback:', error)
      return { success: false, error }
    }
  },

  // NEW Phase C: Token refresh and management logic
  refreshGoogleToken: async (userId: string): Promise<{ success: boolean; error?: { message: string }; newToken?: string; expiresIn?: number }> => {
    try {
      // Get current refresh token
      const refreshToken = await auth.getRefreshToken(userId)
      if (!refreshToken) {
        return { success: false, error: { message: 'No refresh token available' } }
      }

      // Call Google OAuth2 API to refresh the access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json() as { error?: string; error_description?: string }
        console.error('Token refresh failed:', errorData)
        
        // If refresh token is invalid, revoke it
        if (errorData.error === 'invalid_grant') {
          await auth.revokeRefreshToken(userId)
        }
        
        return { success: false, error: { message: errorData.error_description || errorData.error || 'Token refresh failed' } }
      }

      const tokenData = await response.json() as { access_token?: string; expires_in?: number }
      console.log('✅ Google token refreshed successfully')
      
      return { 
        success: true, 
        newToken: tokenData.access_token,
        expiresIn: tokenData.expires_in 
      }
    } catch (error) {
      console.error('Error refreshing Google token:', error)
      return { success: false, error: { message: error instanceof Error ? error.message : 'Unknown error during token refresh' } }
    }
  },

  // Enhanced: Monitor token health and refresh if needed
  monitorTokenHealth: async (userId: string): Promise<{ needsRefresh: boolean; isExpired: boolean; health: { has_token?: boolean; expires_at?: string; is_expired?: boolean } | null }> => {
    try {
      const health = await auth.checkTokenHealth(userId)
      
      if (!health || !health.has_token) {
        return { needsRefresh: false, isExpired: false, health: null }
      }

      const now = new Date()
      const expiresAt = health.expires_at ? new Date(health.expires_at) : null
      const isExpired = health.is_expired || false
      
      // Check if token expires within 10 minutes (600,000 ms)
      const needsRefresh = expiresAt ? (expiresAt.getTime() - now.getTime()) < 600000 : false
      
      console.log('🔍 Token health check:', {
        hasToken: health.has_token,
        isExpired,
        needsRefresh,
        expiresAt: expiresAt?.toISOString(),
        timeUntilExpiry: expiresAt ? Math.round((expiresAt.getTime() - now.getTime()) / 1000) : null
      })

      return { needsRefresh, isExpired, health }
    } catch (error) {
      console.error('Error monitoring token health:', error)
      return { needsRefresh: false, isExpired: false, health: null }
    }
  },

  // Enhanced: Automatic token refresh with health monitoring
  ensureValidToken: async (userId: string): Promise<{ success: boolean; accessToken?: string; error?: { message: string } }> => {
    try {
      // Check token health first
      const { needsRefresh, isExpired, health } = await auth.monitorTokenHealth(userId)
      
      if (!health?.has_token) {
        return { success: false, error: { message: 'No token available' } }
      }

      if (isExpired) {
        return { success: false, error: { message: 'Token expired and cannot be refreshed' } }
      }

      if (needsRefresh) {
        console.log('🔄 Token needs refresh, refreshing automatically...')
        const refreshResult = await auth.refreshGoogleToken(userId)
        
        if (refreshResult.success) {
          return { 
            success: true, 
            accessToken: refreshResult.newToken 
          }
        } else {
          return { success: false, error: refreshResult.error }
        }
      }

      // Token is still valid, no refresh needed
      return { success: true, accessToken: undefined } // Use cached token
    } catch (error) {
      console.error('Error ensuring valid token:', error)
      return { success: false, error: { message: error instanceof Error ? error.message : 'Unknown error during token validation' } }
    }
  },

  // Enhanced: Token recovery flow for invalid/expired tokens
  initiateTokenRecovery: async (userId: string): Promise<{ success: boolean; requiresReauth: boolean; error?: { message: string } }> => {
    try {
      console.log('🔧 Initiating token recovery for user:', userId)
      
      // First, revoke the existing invalid token
      const revokeResult = await auth.revokeRefreshToken(userId)
      if (!revokeResult.success) {
        console.warn('Failed to revoke invalid token, continuing with recovery')
      }

      // Check if user needs to re-authenticate
      const currentUser = await auth.getCurrentUser()
      if (!currentUser || currentUser.id !== userId) {
        return { 
          success: false, 
          requiresReauth: true, 
          error: { message: 'User session invalid, re-authentication required' } 
        }
      }

      console.log('✅ Token recovery initiated - user needs to re-authorize Google access')
      return { 
        success: true, 
        requiresReauth: true 
      }
    } catch (error) {
      console.error('Error during token recovery:', error)
      return { success: false, requiresReauth: true, error: { message: error instanceof Error ? error.message : 'Unknown error during token recovery' } }
    }
  },

  // NEW Phase D: Security audit and monitoring
  performSecurityAudit: async (userId: string): Promise<{ passed: boolean; issues: string[]; recommendations: string[] }> => {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      console.log('🔍 Performing security audit for user:', userId)

      // Check token health
      const health = await auth.checkTokenHealth(userId)
      if (!health?.has_token) {
        issues.push('No refresh token available - reduced functionality')
        recommendations.push('Re-authenticate to capture fresh tokens')
      } else if (health.is_expired) {
        issues.push('Refresh token has expired')
        recommendations.push('Initiate token recovery flow')
      }

      // Check user profile completeness
      const user = await auth.getCurrentUser()
      if (!user?.email) {
        issues.push('User profile incomplete - missing email')
        recommendations.push('Update user profile with complete information')
      }

      // Check session age (security best practice)
      const sessionAge = user?.last_sign_in_at ? Date.now() - new Date(user.last_sign_in_at).getTime() : 0
      const maxSessionAge = 24 * 60 * 60 * 1000 // 24 hours
      if (sessionAge > maxSessionAge) {
        issues.push('Session age exceeds security threshold')
        recommendations.push('Consider requiring re-authentication for sensitive operations')
      }

      console.log(`🔍 Security audit completed: ${issues.length} issues found`)
      return {
        passed: issues.length === 0,
        issues,
        recommendations
      }
    } catch (error) {
      console.error('Error during security audit:', error)
      return {
        passed: false,
        issues: ['Security audit failed to complete'],
        recommendations: ['Review system logs and retry audit']
      }
    }
  },

  // NEW Phase D: Token usage analytics and monitoring
  getTokenUsageAnalytics: async (userId: string): Promise<{ lastUsed?: Date; usageCount?: number; healthScore: number }> => {
    try {
      console.log('📊 Analyzing token usage for user:', userId)

      const health = await auth.checkTokenHealth(userId)
      
      // Calculate health score based on multiple factors
      let healthScore = 0
      
      if (health?.has_token) healthScore += 40
      if (health?.expires_at && !health.is_expired) healthScore += 30
      if (health?.expires_at) {
        const expiresAt = new Date(health.expires_at)
        const timeUntilExpiry = expiresAt.getTime() - Date.now()
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)
        
        if (hoursUntilExpiry > 24) healthScore += 30 // Good: More than 24 hours
        else if (hoursUntilExpiry > 1) healthScore += 20 // OK: More than 1 hour
        else if (hoursUntilExpiry > 0) healthScore += 10 // Warning: Less than 1 hour
        // else: Critical: Expired or about to expire (0 points)
      }

      console.log(`📊 Token health score: ${healthScore}/100`)
      
      return {
        healthScore,
        lastUsed: health?.expires_at ? new Date(health.expires_at) : undefined
      }
    } catch (error) {
      console.error('Error analyzing token usage:', error)
      return { healthScore: 0 }
    }
  },

  // NEW Phase D: Comprehensive error reporting
  generateSecurityReport: async (userId: string): Promise<{ report: string; severity: 'low' | 'medium' | 'high' | 'critical' }> => {
    try {
      const audit = await auth.performSecurityAudit(userId)
      const analytics = await auth.getTokenUsageAnalytics(userId)
      
      const timestamp = new Date().toISOString()
      
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
      
      if (audit.issues.length === 0 && analytics.healthScore >= 80) {
        severity = 'low'
      } else if (audit.issues.length <= 2 && analytics.healthScore >= 60) {
        severity = 'medium'  
      } else if (audit.issues.length <= 4 && analytics.healthScore >= 30) {
        severity = 'high'
      } else {
        severity = 'critical'
      }

      const report = `
🔒 SECURITY REPORT - ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 User ID: ${userId}
🚨 Severity: ${severity.toUpperCase()}
📊 Token Health Score: ${analytics.healthScore}/100
✅ Audit Passed: ${audit.passed ? 'YES' : 'NO'}

📋 ISSUES IDENTIFIED (${audit.issues.length}):
${audit.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n') || 'None'}

💡 RECOMMENDATIONS (${audit.recommendations.length}):
${audit.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n') || 'None'}

🔧 NEXT STEPS:
- ${severity === 'critical' ? 'IMMEDIATE ACTION REQUIRED' : severity === 'high' ? 'Action recommended within 24 hours' : severity === 'medium' ? 'Monitor and address within a week' : 'Continue normal monitoring'}
- Regular security audits recommended
- Maintain token health above 70/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim()

      console.log('📄 Security report generated successfully')
      return { report, severity }
    } catch (error) {
      console.error('Error generating security report:', error)
      return {
        report: `Security report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      }
    }
  }
}

export default auth 