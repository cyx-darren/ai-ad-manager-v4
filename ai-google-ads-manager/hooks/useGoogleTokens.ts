'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { auth, type AuthUser } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

export interface GoogleTokenHealth {
  has_token?: boolean
  expires_at?: string
  is_expired?: boolean
  scope?: string
  security_version?: number
}

export interface GoogleTokenInfo {
  refreshToken?: string
  scope?: string
  expiresAt?: Date
}

export interface UseGoogleTokensReturn {
  // Token status
  hasToken: boolean
  isTokenExpired: boolean
  tokenHealth: GoogleTokenHealth | null
  healthScore: number
  
  // Token operations
  refreshToken: () => Promise<{ success: boolean; newToken?: string; error?: any }>
  storeToken: (tokenInfo: GoogleTokenInfo) => Promise<{ success: boolean; error?: any }>
  revokeToken: () => Promise<{ success: boolean; error?: any }>
  checkHealth: () => Promise<GoogleTokenHealth | null>
  monitorHealth: () => Promise<{ needsRefresh: boolean; isExpired: boolean; health: GoogleTokenHealth | null }>
  ensureValidToken: () => Promise<{ success: boolean; accessToken?: string; error?: any }>
  
  // Recovery operations
  initiateRecovery: () => Promise<{ success: boolean; requiresReauth: boolean; error?: any }>
  
  // Loading states
  loading: boolean
  refreshing: boolean
}

/**
 * Google-specific token management hook for Phase A implementation
 * Handles all Google OAuth token operations and monitoring
 */
export function useGoogleTokens(): UseGoogleTokensReturn {
  const { user } = useAuth()
  
  // State management
  const [hasToken, setHasToken] = useState<boolean>(false)
  const [isTokenExpired, setIsTokenExpired] = useState<boolean>(false)
  const [tokenHealth, setTokenHealth] = useState<GoogleTokenHealth | null>(null)
  const [healthScore, setHealthScore] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Initialize token status on user change
  useEffect(() => {
    let mounted = true
    let healthCheckInterval: NodeJS.Timeout

    const initializeTokenStatus = async () => {
      if (!user?.id || !mounted) return

      setLoading(true)
      try {
        // Initial health check
        const health = await auth.checkTokenHealth(user.id)
        const analytics = await auth.getTokenUsageAnalytics(user.id)
        
        if (mounted) {
          setTokenHealth(health)
          setHasToken(health?.has_token || false)
          setIsTokenExpired(health?.is_expired || false)
          setHealthScore(analytics.healthScore || 0)
        }
      } catch (error) {
        console.error('Failed to initialize Google token status:', error)
        if (mounted) {
          setHasToken(false)
          setIsTokenExpired(true)
          setTokenHealth(null)
          setHealthScore(0)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    const performPeriodicHealthCheck = async () => {
      if (!user?.id || !mounted) return

      try {
        const health = await auth.checkTokenHealth(user.id)
        const analytics = await auth.getTokenUsageAnalytics(user.id)
        
        if (mounted) {
          setTokenHealth(health)
          setHasToken(health?.has_token || false)
          setIsTokenExpired(health?.is_expired || false)
          setHealthScore(analytics.healthScore || 0)
        }
      } catch (error) {
        console.error('Periodic token health check failed:', error)
      }
    }

    if (user?.id) {
      initializeTokenStatus()
      
      // Set up periodic health checks every 2 minutes
      healthCheckInterval = setInterval(performPeriodicHealthCheck, 120000)
    } else {
      setHasToken(false)
      setIsTokenExpired(false)
      setTokenHealth(null)
      setHealthScore(0)
      setLoading(false)
    }

    return () => {
      mounted = false
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
      }
    }
  }, [user?.id])

  // Refresh Google token
  const refreshToken = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: { message: 'No user logged in' } }
    }

    setRefreshing(true)
    try {
      console.log('🔄 Refreshing Google OAuth token...')
      const result = await auth.refreshGoogleToken(user.id)
      
      if (result.success) {
        // Update local state after successful refresh
        const health = await auth.checkTokenHealth(user.id)
        const analytics = await auth.getTokenUsageAnalytics(user.id)
        
        setTokenHealth(health)
        setHasToken(health?.has_token || false)
        setIsTokenExpired(false)
        setHealthScore(analytics.healthScore || 0)
        
        console.log('✅ Google token refreshed successfully')
      }
      
      return result
    } catch (error) {
      console.error('❌ Google token refresh failed:', error)
      return { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Unknown refresh error' } 
      }
    } finally {
      setRefreshing(false)
    }
  }, [user?.id])

  // Store Google token
  const storeToken = useCallback(async (tokenInfo: GoogleTokenInfo) => {
    if (!user?.id) {
      return { success: false, error: { message: 'No user logged in' } }
    }

    if (!tokenInfo.refreshToken) {
      return { success: false, error: { message: 'No refresh token provided' } }
    }

    try {
      console.log('💾 Storing Google refresh token...')
      const result = await auth.storeRefreshToken(user.id, {
        refreshToken: tokenInfo.refreshToken, // Ensured to be string by the check above
        scope: tokenInfo.scope,
        expiresAt: tokenInfo.expiresAt
      })
      
      if (result.success) {
        // Update local state after successful storage
        const health = await auth.checkTokenHealth(user.id)
        const analytics = await auth.getTokenUsageAnalytics(user.id)
        
        setTokenHealth(health)
        setHasToken(true)
        setIsTokenExpired(false)
        setHealthScore(analytics.healthScore || 0)
        
        console.log('✅ Google token stored successfully')
      }
      
      return result
    } catch (error) {
      console.error('❌ Failed to store Google token:', error)
      return { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Unknown storage error' } 
      }
    }
  }, [user?.id])

  // Revoke Google token
  const revokeToken = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: { message: 'No user logged in' } }
    }

    try {
      console.log('🗑️ Revoking Google refresh token...')
      const result = await auth.revokeRefreshToken(user.id)
      
      if (result.success) {
        // Update local state after successful revocation
        setTokenHealth(null)
        setHasToken(false)
        setIsTokenExpired(false)
        setHealthScore(0)
        
        console.log('✅ Google token revoked successfully')
      }
      
      return result
    } catch (error) {
      console.error('❌ Failed to revoke Google token:', error)
      return { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Unknown revocation error' } 
      }
    }
  }, [user?.id])

  // Check token health
  const checkHealth = useCallback(async (): Promise<GoogleTokenHealth | null> => {
    if (!user?.id) return null

    try {
      const health = await auth.checkTokenHealth(user.id)
      setTokenHealth(health)
      return health
    } catch (error) {
      console.error('❌ Token health check failed:', error)
      return null
    }
  }, [user?.id])

  // Monitor token health with refresh recommendations
  const monitorHealth = useCallback(async () => {
    if (!user?.id) {
      return { needsRefresh: false, isExpired: false, health: null }
    }

    try {
      const result = await auth.monitorTokenHealth(user.id)
      
      // Update local state - safely cast the health object
      const healthData = result.health as GoogleTokenHealth | null
      setTokenHealth(healthData)
      setHasToken(healthData?.has_token || false)
      setIsTokenExpired(result.isExpired)
      
      return { ...result, health: healthData }
    } catch (error) {
      console.error('❌ Token health monitoring failed:', error)
      return { needsRefresh: false, isExpired: false, health: null }
    }
  }, [user?.id])

  // Ensure valid token (smart refresh)
  const ensureValidToken = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: { message: 'No user logged in' } }
    }

    try {
      console.log('🔍 Ensuring Google token validity...')
      const result = await auth.ensureValidToken(user.id)
      
      // Update local state based on result
      if (result.success) {
        const health = await auth.checkTokenHealth(user.id)
        const analytics = await auth.getTokenUsageAnalytics(user.id)
        
        setTokenHealth(health)
        setHasToken(health?.has_token || false)
        setIsTokenExpired(health?.is_expired || false)
        setHealthScore(analytics.healthScore || 0)
      }
      
      return result
    } catch (error) {
      console.error('❌ Token validation failed:', error)
      return { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Unknown validation error' } 
      }
    }
  }, [user?.id])

  // Initiate token recovery
  const initiateRecovery = useCallback(async () => {
    if (!user?.id) {
      return { success: false, requiresReauth: true, error: { message: 'No user logged in' } }
    }

    try {
      console.log('🔧 Initiating Google token recovery...')
      const result = await auth.initiateTokenRecovery(user.id)
      
      if (result.success) {
        // Clear local token state
        setTokenHealth(null)
        setHasToken(false)
        setIsTokenExpired(false)
        setHealthScore(0)
        
        console.log('✅ Token recovery initiated')
      }
      
      return result
    } catch (error) {
      console.error('❌ Token recovery failed:', error)
      return { 
        success: false, 
        requiresReauth: true, 
        error: { message: error instanceof Error ? error.message : 'Unknown recovery error' } 
      }
    }
  }, [user?.id])

  return {
    // Token status
    hasToken,
    isTokenExpired,
    tokenHealth,
    healthScore,
    
    // Token operations
    refreshToken,
    storeToken,
    revokeToken,
    checkHealth,
    monitorHealth,
    ensureValidToken,
    
    // Recovery operations
    initiateRecovery,
    
    // Loading states
    loading,
    refreshing,
  }
}

export default useGoogleTokens