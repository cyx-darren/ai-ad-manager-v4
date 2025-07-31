'use client'

import { auth } from './auth'
import { getSessionStorageManager } from './sessionStorage'

interface RefreshAttempt {
  timestamp: number
  success: boolean
  error?: string
  backoffUntil?: number
}

interface TokenRefreshConfig {
  preRefreshMinutes: number // Minutes before expiry to trigger refresh
  maxRetries: number
  baseBackoffMs: number // Base backoff time in milliseconds
  maxBackoffMs: number // Maximum backoff time
  healthCheckIntervalMs: number
  networkRetryDelay: number
}

interface RefreshResult {
  success: boolean
  newToken?: string
  expiresIn?: number
  error?: {
    type: 'NETWORK' | 'AUTH' | 'INVALID_TOKEN' | 'RATE_LIMIT' | 'UNKNOWN'
    message: string
    retryable: boolean
  }
  nextRefreshAt?: number
}

class TokenRefreshManager {
  private config: TokenRefreshConfig
  private refreshTimer?: NodeJS.Timeout
  private healthCheckTimer?: NodeJS.Timeout
  private attemptHistory: RefreshAttempt[] = []
  private isRefreshing = false
  private refreshCallbacks: ((result: RefreshResult) => void)[] = []
  private sessionStorage = getSessionStorageManager()

  constructor(config?: Partial<TokenRefreshConfig>) {
    this.config = {
      preRefreshMinutes: 10, // Refresh 10 minutes before expiry
      maxRetries: 3,
      baseBackoffMs: 1000, // Start with 1 second
      maxBackoffMs: 60000, // Max 1 minute backoff
      healthCheckIntervalMs: 60000, // Check every minute
      networkRetryDelay: 5000, // 5 seconds for network errors
      ...config
    }

    this.startHealthCheckLoop()
  }

  // Start the health monitoring loop
  private startHealthCheckLoop(): void {
    if (typeof window === 'undefined') return

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkAndRefreshIfNeeded()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, this.config.healthCheckIntervalMs)

    console.log('🔄 Token refresh health check started')
  }

  // Main logic for checking and refreshing tokens
  private async checkAndRefreshIfNeeded(): Promise<void> {
    const currentUser = await auth.getCurrentUser()
    if (!currentUser?.id) return

    try {
      const health = await auth.checkTokenHealth(currentUser.id)
      
      if (!health?.has_token) {
        console.log('⚠️ No token found, skipping refresh check')
        return
      }

      const needsRefresh = this.shouldRefreshToken(health)
      
      if (needsRefresh && !this.isRefreshing) {
        console.log('🔄 Token needs refresh, initiating automatic refresh')
        await this.refreshToken(currentUser.id)
      }
    } catch (error) {
      console.error('Error during token health check:', error)
    }
  }

  // Determine if token needs refresh
  private shouldRefreshToken(health: { expires_at?: string; has_token?: boolean }): boolean {
    if (!health.expires_at) return false

    const expiresAt = new Date(health.expires_at)
    const now = new Date()
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60)

    // Check if we're in backoff period
    if (this.isInBackoffPeriod()) {
      console.log('⏳ In backoff period, skipping refresh')
      return false
    }

    // Refresh if expires within the configured time
    const shouldRefresh = minutesUntilExpiry <= this.config.preRefreshMinutes

    if (shouldRefresh) {
      console.log(`🕐 Token expires in ${minutesUntilExpiry.toFixed(1)} minutes, triggering refresh`)
    }

    return shouldRefresh
  }

  // Check if we're in a backoff period
  private isInBackoffPeriod(): boolean {
    const lastAttempt = this.attemptHistory[this.attemptHistory.length - 1]
    if (!lastAttempt?.backoffUntil) return false

    return Date.now() < lastAttempt.backoffUntil
  }

  // Calculate backoff time using exponential backoff
  private calculateBackoff(attemptNumber: number): number {
    const backoff = Math.min(
      this.config.baseBackoffMs * Math.pow(2, attemptNumber),
      this.config.maxBackoffMs
    )
    
    // Add jitter (random ±25%)
    const jitter = backoff * 0.25 * (Math.random() - 0.5)
    return Math.floor(backoff + jitter)
  }

  // Main token refresh function
  async refreshToken(userId: string): Promise<RefreshResult> {
    if (this.isRefreshing) {
      console.log('🔄 Refresh already in progress, waiting...')
      return new Promise((resolve) => {
        this.refreshCallbacks.push(resolve)
      })
    }

    this.isRefreshing = true
    const startTime = Date.now()
    let result: RefreshResult = { success: false, error: { type: 'UNKNOWN', message: 'Unknown error', retryable: false } }

    try {
      console.log('🔄 Starting token refresh process')

      // Check if we've exceeded max retries
      const recentAttempts = this.getRecentAttempts()
      if (recentAttempts.length >= this.config.maxRetries) {
        result = this.createErrorResult('RATE_LIMIT', 'Maximum refresh attempts exceeded', false)
        await this.handleRefreshResult(result, userId)
        return result
      }

      // Attempt refresh
      const refreshResult = await auth.refreshGoogleToken(userId)
      
      if (refreshResult.success) {
        result = {
          success: true,
          newToken: refreshResult.newToken,
          expiresIn: refreshResult.expiresIn,
          nextRefreshAt: this.calculateNextRefreshTime(refreshResult.expiresIn)
        }

        await this.handleRefreshResult(result, userId)
        this.recordAttempt(true)
        
        console.log('✅ Token refresh successful')
        return result
      } else {
        // Handle different error types
        const errorType = this.categorizeError(refreshResult.error?.message || 'Unknown error')
        result = this.createErrorResult(
          errorType.type,
          refreshResult.error?.message || 'Token refresh failed',
          errorType.retryable
        )

        await this.handleRefreshResult(result, userId)
        this.recordAttempt(false, result.error?.message)

        console.error('❌ Token refresh failed:', result.error?.message)
        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result = this.createErrorResult('NETWORK', errorMessage, true)
      
      await this.handleRefreshResult(result, userId)
      this.recordAttempt(false, errorMessage)
      
      console.error('❌ Token refresh error:', error)
      return result
    } finally {
      this.isRefreshing = false
      
      // Notify waiting callbacks
      const callbacks = [...this.refreshCallbacks]
      this.refreshCallbacks = []
      if (result) {
        callbacks.forEach(callback => callback(result))
      }
      
      const duration = Date.now() - startTime
      console.log(`⏱️ Token refresh completed in ${duration}ms`)
    }
  }

  // Categorize errors for appropriate handling
  private categorizeError(errorMessage: string): { type: NonNullable<RefreshResult['error']>['type'], retryable: boolean } {
    const message = errorMessage.toLowerCase()

    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return { type: 'NETWORK', retryable: true }
    }
    
    if (message.includes('invalid_grant') || message.includes('expired')) {
      return { type: 'INVALID_TOKEN', retryable: false }
    }
    
    if (message.includes('rate') || message.includes('quota') || message.includes('limit')) {
      return { type: 'RATE_LIMIT', retryable: true }
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return { type: 'AUTH', retryable: false }
    }

    return { type: 'UNKNOWN', retryable: true }
  }

  // Create standardized error result
  private createErrorResult(
    type: NonNullable<RefreshResult['error']>['type'], 
    message: string, 
    retryable: boolean
  ): RefreshResult {
    return {
      success: false,
      error: { type, message, retryable }
    }
  }

  // Handle refresh result and update state
  private async handleRefreshResult(result: RefreshResult, userId: string): Promise<void> {
    // Emit cross-tab event
    this.sessionStorage.emitCrossTabEvent('TOKEN_UPDATE', {
      success: result.success,
      timestamp: Date.now(),
      error: result.error
    })

    // Schedule next refresh if successful
    if (result.success && result.nextRefreshAt) {
      this.scheduleNextRefresh(result.nextRefreshAt, userId)
    }

    // Handle failures
    if (!result.success && result.error) {
      if (!result.error.retryable) {
        console.log('🚨 Non-retryable error, initiating token recovery')
        await auth.initiateTokenRecovery(userId)
      } else {
        // Schedule retry with backoff
        const attempts = this.getRecentAttempts()
        const backoffMs = this.calculateBackoff(attempts.length)
        
        console.log(`⏳ Scheduling retry in ${backoffMs}ms`)
        setTimeout(() => {
          if (!this.isRefreshing) {
            this.refreshToken(userId)
          }
        }, backoffMs)
      }
    }

    // Notify callbacks
    this.refreshCallbacks.forEach(callback => callback(result))
  }

  // Calculate when next refresh should happen
  private calculateNextRefreshTime(expiresIn?: number): number {
    if (!expiresIn) return Date.now() + (this.config.preRefreshMinutes * 60 * 1000)
    
    const expiresAt = Date.now() + (expiresIn * 1000)
    const preRefreshTime = this.config.preRefreshMinutes * 60 * 1000
    
    return expiresAt - preRefreshTime
  }

  // Schedule the next automatic refresh
  private scheduleNextRefresh(refreshAt: number, userId: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    const delay = Math.max(0, refreshAt - Date.now())
    
    this.refreshTimer = setTimeout(async () => {
      console.log('⏰ Scheduled refresh triggered')
      await this.refreshToken(userId)
    }, delay)

    console.log(`📅 Next refresh scheduled in ${Math.round(delay / 1000)} seconds`)
  }

  // Record refresh attempt
  private recordAttempt(success: boolean, error?: string): void {
    const attempt: RefreshAttempt = {
      timestamp: Date.now(),
      success
    }

    if (!success && error) {
      attempt.error = error
      
      // Add backoff if this is a retryable error
      const attempts = this.getRecentAttempts()
      const backoffMs = this.calculateBackoff(attempts.length)
      attempt.backoffUntil = Date.now() + backoffMs
    }

    this.attemptHistory.push(attempt)
    
    // Keep only recent attempts (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    this.attemptHistory = this.attemptHistory.filter(a => a.timestamp > oneHourAgo)
  }

  // Get recent failed attempts for rate limiting
  private getRecentAttempts(): RefreshAttempt[] {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    return this.attemptHistory.filter(a => 
      !a.success && a.timestamp > fiveMinutesAgo
    )
  }

  // Public API for manual refresh
  async forceRefresh(userId: string): Promise<RefreshResult> {
    console.log('🔄 Manual refresh triggered')
    return this.refreshToken(userId)
  }

  // Check current refresh status
  getRefreshStatus(): {
    isRefreshing: boolean
    lastAttempt?: RefreshAttempt
    nextRefreshAt?: number
    recentFailures: number
  } {
    return {
      isRefreshing: this.isRefreshing,
      lastAttempt: this.attemptHistory[this.attemptHistory.length - 1],
      recentFailures: this.getRecentAttempts().length
    }
  }

  // Start the refresh manager
  start(): void {
    this.startHealthCheckLoop()
    console.log('🚀 Token refresh manager started')
  }

  // Stop the refresh manager
  stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    console.log('🛑 Token refresh manager stopped')
  }
}

// Singleton instance
let refreshManager: TokenRefreshManager | null = null

export function getTokenRefreshManager(config?: Partial<TokenRefreshConfig>): TokenRefreshManager {
  if (typeof window === 'undefined') {
    // Return a mock instance for SSR
    return {
      refreshToken: async () => ({ success: false }),
      forceRefresh: async () => ({ success: false }),
      getRefreshStatus: () => ({ isRefreshing: false, recentFailures: 0 }),
      start: () => {},
      stop: () => {}
    } as Partial<TokenRefreshManager> as TokenRefreshManager
  }

  if (!refreshManager) {
    refreshManager = new TokenRefreshManager(config)
  }
  
  return refreshManager
}

export type { RefreshResult, TokenRefreshConfig }
export { TokenRefreshManager }