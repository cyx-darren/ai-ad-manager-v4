'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ClassifiedError, 
  RecoveryAction, 
  ErrorSeverity,
  AuthErrorType,
  classifyAuthError 
} from './authErrorHandler'
import { auth } from './auth'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface RecoveryAttempt {
  errorId: string
  attempt: number
  timestamp: number
  action: RecoveryAction
  success: boolean
  error?: any
}

export interface RecoveryManagerOptions {
  maxGlobalRetries?: number
  enableAutoRecovery?: boolean
  onRecoveryAttempt?: (attempt: RecoveryAttempt) => void
  onRecoverySuccess?: (error: ClassifiedError, attempts: RecoveryAttempt[]) => void
  onRecoveryFailed?: (error: ClassifiedError, attempts: RecoveryAttempt[]) => void
  onCriticalError?: (error: ClassifiedError) => void
}

export class ErrorRecoveryManager {
  private attempts: Map<string, RecoveryAttempt[]> = new Map()
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private options: Required<RecoveryManagerOptions>

  constructor(options: RecoveryManagerOptions = {}) {
    this.options = {
      maxGlobalRetries: 3,
      enableAutoRecovery: true,
      onRecoveryAttempt: () => {},
      onRecoverySuccess: () => {},
      onRecoveryFailed: () => {},
      onCriticalError: () => {},
      ...options
    }
  }

  /**
   * Main recovery orchestrator
   */
  async handleError(
    error: any,
    context?: any,
    customRecovery?: () => Promise<boolean>
  ): Promise<{ recovered: boolean; finalError?: ClassifiedError }> {
    const classifiedError = classifyAuthError(error, context)
    const errorId = this.generateErrorId(classifiedError)

    console.log('🔥 Error Recovery Manager: Handling error', {
      type: classifiedError.type,
      severity: classifiedError.severity,
      recoverable: classifiedError.isRecoverable,
      action: classifiedError.recoveryStrategy.action
    })

    // Handle critical errors immediately
    if (classifiedError.severity === ErrorSeverity.CRITICAL) {
      this.options.onCriticalError(classifiedError)
      return { recovered: false, finalError: classifiedError }
    }

    // Check if we should attempt recovery
    if (!this.shouldAttemptRecovery(classifiedError, errorId)) {
      console.log('❌ Recovery not attempted: max retries exceeded or not recoverable')
      this.options.onRecoveryFailed(classifiedError, this.getAttempts(errorId))
      return { recovered: false, finalError: classifiedError }
    }

    // Attempt recovery
    const recovered = await this.attemptRecovery(classifiedError, errorId, customRecovery)
    
    if (recovered) {
      console.log('✅ Error recovery successful')
      this.options.onRecoverySuccess(classifiedError, this.getAttempts(errorId))
      this.clearAttempts(errorId)
    } else {
      console.log('❌ Error recovery failed')
      this.options.onRecoveryFailed(classifiedError, this.getAttempts(errorId))
    }

    return { recovered, finalError: recovered ? undefined : classifiedError }
  }

  /**
   * Attempts recovery based on the error's recovery strategy
   */
  private async attemptRecovery(
    error: ClassifiedError,
    errorId: string,
    customRecovery?: () => Promise<boolean>
  ): Promise<boolean> {
    const { recoveryStrategy } = error
    const attemptNumber = this.getAttemptCount(errorId) + 1

    // Record the attempt
    this.recordAttempt(errorId, {
      errorId,
      attempt: attemptNumber,
      timestamp: Date.now(),
      action: recoveryStrategy.action,
      success: false
    })

    try {
      let success = false

      // Custom recovery handler takes precedence
      if (customRecovery) {
        success = await customRecovery()
      } else {
        // Execute built-in recovery strategy
        success = await this.executeRecoveryAction(error, recoveryStrategy)
      }

      // Update attempt record
      this.updateAttempt(errorId, attemptNumber, { success })
      this.options.onRecoveryAttempt(this.getLatestAttempt(errorId)!)

      return success
    } catch (recoveryError) {
      console.error('🚨 Recovery attempt failed:', recoveryError)
      this.updateAttempt(errorId, attemptNumber, { 
        success: false, 
        error: recoveryError 
      })
      this.options.onRecoveryAttempt(this.getLatestAttempt(errorId)!)
      return false
    }
  }

  /**
   * Executes the specific recovery action
   */
  private async executeRecoveryAction(
    error: ClassifiedError,
    strategy: ClassifiedError['recoveryStrategy']
  ): Promise<boolean> {
    switch (strategy.action) {
      case RecoveryAction.RETRY:
        return this.handleRetry(error, strategy)

      case RecoveryAction.REFRESH_TOKEN:
        return this.handleTokenRefresh(error)

      case RecoveryAction.REAUTH:
        return this.handleReauthentication(error)

      case RecoveryAction.REDIRECT:
        return this.handleRedirect(error, strategy)

      case RecoveryAction.FALLBACK:
        return this.handleFallback(error, strategy)

      case RecoveryAction.CONTACT_SUPPORT:
        return this.handleContactSupport(error)

      case RecoveryAction.NONE:
      default:
        return false
    }
  }

  /**
   * Handle retry strategy with delay
   */
  private async handleRetry(
    error: ClassifiedError,
    strategy: ClassifiedError['recoveryStrategy']
  ): Promise<boolean> {
    const { retryDelay = 1000 } = strategy
    
    if (retryDelay > 0) {
      console.log(`⏳ Waiting ${retryDelay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }

    // For retry, we return false to indicate the operation should be retried
    // The actual retry logic should be handled by the calling code
    return false
  }

  /**
   * Handle token refresh
   */
  private async handleTokenRefresh(error: ClassifiedError): Promise<boolean> {
    try {
      console.log('🔄 Attempting token refresh...')
      
      // Get current user to refresh their tokens
      const currentUser = await auth.getCurrentUser()
      if (!currentUser) {
        console.log('❌ No user found for token refresh')
        return false
      }

      // Attempt to refresh the session using Supabase's built-in refresh
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.log('❌ Session refresh failed, trying Google token refresh...', refreshError)
        
        // If session refresh fails, try Google-specific token refresh
        if (currentUser.id) {
          const googleRefreshResult = await auth.refreshGoogleToken(currentUser.id)
          if (googleRefreshResult.success) {
            console.log('✅ Google token refresh successful')
            return true
          }
          console.log('❌ Google token refresh failed:', googleRefreshResult.error)
        }
        return false
      }

      console.log('✅ Session refresh successful')
      return true
    } catch (error) {
      console.error('❌ Token refresh error:', error)
      return false
    }
  }

  /**
   * Handle re-authentication
   */
  private async handleReauthentication(error: ClassifiedError): Promise<boolean> {
    try {
      console.log('🔄 Triggering re-authentication...')
      
      // Sign out current user
      await auth.quickSignOut()
      
      // Redirect to login with return URL
      if (typeof window !== 'undefined') {
        const returnUrl = window.location.pathname + window.location.search
        window.location.href = `/auth/login?redirectTo=${encodeURIComponent(returnUrl)}`
      }
      
      return true // Consider redirect as successful recovery
    } catch (error) {
      console.error('❌ Re-authentication error:', error)
      return false
    }
  }

  /**
   * Handle redirect strategy
   */
  private async handleRedirect(
    error: ClassifiedError,
    strategy: ClassifiedError['recoveryStrategy']
  ): Promise<boolean> {
    try {
      const { fallbackUrl = '/dashboard' } = strategy
      console.log(`🔄 Redirecting to: ${fallbackUrl}`)
      
      if (typeof window !== 'undefined') {
        window.location.href = fallbackUrl
      }
      
      return true
    } catch (error) {
      console.error('❌ Redirect error:', error)
      return false
    }
  }

  /**
   * Handle fallback strategy
   */
  private async handleFallback(
    error: ClassifiedError,
    strategy: ClassifiedError['recoveryStrategy']
  ): Promise<boolean> {
    try {
      console.log('🔄 Executing fallback strategy...')
      
      // Implement graceful degradation
      if (strategy.fallbackUrl) {
        if (typeof window !== 'undefined') {
          window.location.href = strategy.fallbackUrl
        }
      }
      
      // Could implement other fallback behaviors here
      // like switching to offline mode, showing cached data, etc.
      
      return true
    } catch (error) {
      console.error('❌ Fallback error:', error)
      return false
    }
  }

  /**
   * Handle contact support strategy
   */
  private async handleContactSupport(error: ClassifiedError): Promise<boolean> {
    console.log('📞 Contact support strategy triggered')
    
    // Could integrate with support systems, show contact modal, etc.
    // For now, we'll log the error and return false to show error UI
    console.error('🚨 Critical error requiring support:', {
      type: error.type,
      message: error.message,
      technicalDetails: error.technicalDetails,
      timestamp: error.timestamp
    })
    
    return false
  }

  /**
   * Determines if recovery should be attempted
   */
  private shouldAttemptRecovery(error: ClassifiedError, errorId: string): boolean {
    if (!this.options.enableAutoRecovery) return false
    if (!error.isRecoverable) return false

    const attemptCount = this.getAttemptCount(errorId)
    const maxRetries = error.recoveryStrategy.maxRetries ?? this.options.maxGlobalRetries
    
    return attemptCount < maxRetries
  }

  /**
   * Utility methods for attempt tracking
   */
  private generateErrorId(error: ClassifiedError): string {
    return `${error.type}_${error.context?.route || 'unknown'}_${Date.now()}`
  }

  private recordAttempt(errorId: string, attempt: RecoveryAttempt): void {
    if (!this.attempts.has(errorId)) {
      this.attempts.set(errorId, [])
    }
    this.attempts.get(errorId)!.push(attempt)
  }

  private updateAttempt(errorId: string, attemptNumber: number, updates: Partial<RecoveryAttempt>): void {
    const attempts = this.attempts.get(errorId)
    if (attempts) {
      const attempt = attempts.find(a => a.attempt === attemptNumber)
      if (attempt) {
        Object.assign(attempt, updates)
      }
    }
  }

  private getAttempts(errorId: string): RecoveryAttempt[] {
    return this.attempts.get(errorId) || []
  }

  private getAttemptCount(errorId: string): number {
    return this.getAttempts(errorId).length
  }

  private getLatestAttempt(errorId: string): RecoveryAttempt | undefined {
    const attempts = this.getAttempts(errorId)
    return attempts[attempts.length - 1]
  }

  private clearAttempts(errorId: string): void {
    this.attempts.delete(errorId)
    const timeout = this.retryTimeouts.get(errorId)
    if (timeout) {
      clearTimeout(timeout)
      this.retryTimeouts.delete(errorId)
    }
  }

  /**
   * Clean up old attempts (call periodically)
   */
  public cleanup(maxAge: number = 5 * 60 * 1000): void {
    const now = Date.now()
    for (const [errorId, attempts] of this.attempts.entries()) {
      const latestAttempt = attempts[attempts.length - 1]
      if (latestAttempt && (now - latestAttempt.timestamp) > maxAge) {
        this.clearAttempts(errorId)
      }
    }
  }

  /**
   * Get recovery statistics
   */
  public getStats(): {
    totalErrors: number
    totalAttempts: number
    successfulRecoveries: number
    failedRecoveries: number
    successRate: number
  } {
    let totalAttempts = 0
    let successfulRecoveries = 0
    let failedRecoveries = 0

    for (const attempts of this.attempts.values()) {
      totalAttempts += attempts.length
      const lastAttempt = attempts[attempts.length - 1]
      if (lastAttempt) {
        if (lastAttempt.success) {
          successfulRecoveries++
        } else {
          failedRecoveries++
        }
      }
    }

    const totalErrors = this.attempts.size
    const successRate = totalErrors > 0 ? (successfulRecoveries / totalErrors) * 100 : 0

    return {
      totalErrors,
      totalAttempts,
      successfulRecoveries,
      failedRecoveries,
      successRate
    }
  }
}

/**
 * React hook for using error recovery
 */
export function useErrorRecovery(options: RecoveryManagerOptions = {}) {
  const router = useRouter()
  const { user } = useAuth()
  const managerRef = useRef<ErrorRecoveryManager | null>(null)

  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = new ErrorRecoveryManager({
      ...options,
      onRecoveryAttempt: (attempt) => {
        console.log('🔄 Recovery attempt:', attempt)
        options.onRecoveryAttempt?.(attempt)
      },
      onRecoverySuccess: (error, attempts) => {
        console.log('✅ Recovery successful:', { error: error.type, attempts: attempts.length })
        options.onRecoverySuccess?.(error, attempts)
      },
      onRecoveryFailed: (error, attempts) => {
        console.log('❌ Recovery failed:', { error: error.type, attempts: attempts.length })
        options.onRecoveryFailed?.(error, attempts)
      },
      onCriticalError: (error) => {
        console.error('🚨 Critical error:', error)
        options.onCriticalError?.(error)
      }
    })
  }

  const handleError = useCallback(async (
    error: any,
    context?: any,
    customRecovery?: () => Promise<boolean>
  ) => {
    if (!managerRef.current) return { recovered: false }
    return managerRef.current.handleError(error, { userId: user?.id, ...context }, customRecovery)
  }, [user?.id])

  const getStats = useCallback(() => {
    if (!managerRef.current) return { totalErrors: 0, totalAttempts: 0, successfulRecoveries: 0, failedRecoveries: 0, successRate: 0 }
    return managerRef.current.getStats()
  }, [])

  const cleanup = useCallback((maxAge?: number) => {
    if (managerRef.current) {
      managerRef.current.cleanup(maxAge)
    }
  }, [])

  return {
    handleError,
    getStats,
    cleanup
  }
}

export default ErrorRecoveryManager