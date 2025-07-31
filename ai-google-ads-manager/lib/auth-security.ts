// Authentication Security Utilities
// Provides rate limiting, CSRF protection, and security monitoring for auth components

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs: number
}

interface AttemptRecord {
  count: number
  firstAttempt: number
  lastAttempt: number
  blocked: boolean
  blockExpires?: number
}

interface SecurityEvent {
  type: 'login_attempt' | 'login_failure' | 'suspicious_activity' | 'rate_limit_hit'
  email?: string
  ip?: string
  userAgent?: string
  timestamp: number
  details?: Record<string, unknown>
}

class AuthSecurityManager {
  private attemptStorage: Map<string, AttemptRecord> = new Map()
  private securityEvents: SecurityEvent[] = []
  private maxEventsInMemory = 100

  // Default rate limit configurations
  private configs: Record<string, RateLimitConfig> = {
    login: { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 }, // 5 attempts per 15min, block for 30min
    signup: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 60 * 1000 }, // 3 attempts per hour, block for 1 hour
    passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 60 * 1000 },
    emailVerification: { maxAttempts: 5, windowMs: 60 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 }
  }

  constructor() {
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Check if an action is rate limited
   */
  checkRateLimit(identifier: string, action: keyof typeof this.configs): { allowed: boolean; resetTime?: number; remainingAttempts?: number } {
    const config = this.configs[action]
    const key = `${action}:${identifier}`
    const now = Date.now()
    
    let record = this.attemptStorage.get(key)
    
    // Initialize or reset if window expired
    if (!record || (now - record.firstAttempt) > config.windowMs) {
      record = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false
      }
    }

    // Check if currently blocked
    if (record.blocked && record.blockExpires && now < record.blockExpires) {
      return { 
        allowed: false, 
        resetTime: record.blockExpires 
      }
    }

    // Reset block if expired
    if (record.blocked && record.blockExpires && now >= record.blockExpires) {
      record.blocked = false
      record.blockExpires = undefined
      record.count = 0
      record.firstAttempt = now
    }

    // Check if over limit
    if (record.count >= config.maxAttempts) {
      record.blocked = true
      record.blockExpires = now + config.blockDurationMs
      
      this.logSecurityEvent({
        type: 'rate_limit_hit',
        email: identifier.includes('@') ? identifier : undefined,
        timestamp: now,
        details: { action, attempts: record.count }
      })

      this.attemptStorage.set(key, record)
      return { 
        allowed: false, 
        resetTime: record.blockExpires 
      }
    }

    return { 
      allowed: true, 
      remainingAttempts: config.maxAttempts - record.count 
    }
  }

  /**
   * Record an authentication attempt
   */
  recordAttempt(identifier: string, action: keyof typeof this.configs, success: boolean, details?: Record<string, unknown>) {
    const key = `${action}:${identifier}`
    const now = Date.now()
    
    const record = this.attemptStorage.get(key) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
      blocked: false
    }

    if (success) {
      // Reset on success
      this.attemptStorage.delete(key)
      this.logSecurityEvent({
        type: 'login_attempt',
        email: identifier.includes('@') ? identifier : undefined,
        timestamp: now,
        details: { action, success: true, ...details }
      })
    } else {
      // Increment failure count
      record.count++
      record.lastAttempt = now
      this.attemptStorage.set(key, record)
      
      this.logSecurityEvent({
        type: 'login_failure',
        email: identifier.includes('@') ? identifier : undefined,
        timestamp: now,
        details: { action, attempts: record.count, ...details }
      })
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken || token.length !== storedToken.length) {
      return false
    }
    
    // Constant-time comparison to prevent timing attacks
    let result = 0
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i)
    }
    
    return result === 0
  }

  /**
   * Detect suspicious patterns
   */
  detectSuspiciousActivity(email: string): { suspicious: boolean; reasons: string[] } {
    const reasons: string[] = []
    const recentEvents = this.getRecentSecurityEvents(email, 24 * 60 * 60 * 1000) // Last 24 hours

    // Check for rapid successive attempts
    const recentFailures = recentEvents
      .filter(e => e.type === 'login_failure' && Date.now() - e.timestamp < 5 * 60 * 1000) // Last 5 minutes
    
    if (recentFailures.length > 10) {
      reasons.push('Excessive failed login attempts')
    }

    // Check for multiple user agents
    const userAgents = new Set(recentEvents.map(e => e.userAgent).filter(Boolean))
    if (userAgents.size > 5) {
      reasons.push('Multiple user agents detected')
    }

    // Check for unusual timing patterns
    const attempts = recentEvents
      .filter(e => e.type === 'login_attempt')
      .map(e => e.timestamp)
      .sort((a, b) => a - b)

    if (attempts.length > 1) {
      const intervals = []
      for (let i = 1; i < attempts.length; i++) {
        intervals.push(attempts[i] - attempts[i - 1])
      }
      
      // Suspiciously regular intervals (potential bot)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const regularIntervals = intervals.filter(i => Math.abs(i - avgInterval) < 1000).length
      
      if (regularIntervals / intervals.length > 0.8) {
        reasons.push('Suspiciously regular timing patterns')
      }
    }

    return {
      suspicious: reasons.length > 0,
      reasons
    }
  }

  /**
   * Get security recommendations
   */
  getSecurityRecommendations(email: string): string[] {
    const recommendations: string[] = []
    const recentEvents = this.getRecentSecurityEvents(email, 7 * 24 * 60 * 60 * 1000) // Last 7 days
    
    const failureCount = recentEvents.filter(e => e.type === 'login_failure').length
    const rateLimitHits = recentEvents.filter(e => e.type === 'rate_limit_hit').length

    if (failureCount > 5) {
      recommendations.push('Consider enabling two-factor authentication')
    }

    if (rateLimitHits > 0) {
      recommendations.push('Your account has been rate limited recently. Consider changing your password if you suspect unauthorized access.')
    }

    const suspiciousActivity = this.detectSuspiciousActivity(email)
    if (suspiciousActivity.suspicious) {
      recommendations.push('Suspicious activity detected. Please review your recent login activity.')
    }

    return recommendations
  }

  /**
   * Sanitize user input to prevent XSS and injection attacks
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, '') // Remove quotes
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 500) // Limit length
  }

  /**
   * Validate email format with additional security checks
   */
  validateEmailSecurity(email: string): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      issues.push('Invalid email format')
    }

    // Check for suspicious characters
    if (/[<>'"&]/.test(email)) {
      issues.push('Email contains suspicious characters')
    }

    // Check for excessively long email
    if (email.length > 254) {
      issues.push('Email address too long')
    }

    // Check for known disposable email providers
    const disposableProviders = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com']
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && disposableProviders.some(provider => domain.includes(provider))) {
      issues.push('Disposable email addresses are not allowed')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Generate secure password requirements
   */
  generatePasswordRequirements(): {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
    forbiddenPatterns: RegExp[]
  } {
    return {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      forbiddenPatterns: [
        /password/i,
        /123456/,
        /qwerty/i,
        /admin/i,
        /(.)\1{2,}/, // Repeated characters
        /^(.{1,3})\1+$/ // Repeated patterns
      ]
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: SecurityEvent) {
    this.securityEvents.push(event)
    
    // Keep only recent events in memory
    if (this.securityEvents.length > this.maxEventsInMemory) {
      this.securityEvents = this.securityEvents.slice(-this.maxEventsInMemory)
    }

    // In production, you would also send critical events to a security monitoring service
    if (event.type === 'rate_limit_hit' || event.type === 'suspicious_activity') {
      console.warn('Security Event:', event)
    }
  }

  /**
   * Get recent security events for an identifier
   */
  private getRecentSecurityEvents(identifier: string, windowMs: number): SecurityEvent[] {
    const cutoff = Date.now() - windowMs
    return this.securityEvents.filter(event => 
      event.timestamp >= cutoff && 
      (event.email === identifier || event.ip === identifier)
    )
  }

  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now()
    
    for (const [key, record] of this.attemptStorage.entries()) {
      const [action] = key.split(':')
      const config = this.configs[action as keyof typeof this.configs]
      
      if (!config) continue
      
      // Remove old records
      if ((now - record.firstAttempt) > (config.windowMs * 2)) {
        this.attemptStorage.delete(key)
      }
    }

    // Clean up old security events
    const cutoff = now - (24 * 60 * 60 * 1000) // Keep events for 24 hours
    this.securityEvents = this.securityEvents.filter(event => event.timestamp >= cutoff)
  }

  /**
   * Get rate limit status for display
   */
  getRateLimitStatus(identifier: string, action: keyof typeof this.configs): {
    isLimited: boolean
    resetTime?: number
    remainingAttempts?: number
    nextAttemptIn?: number
  } {
    const result = this.checkRateLimit(identifier, action)
    
    return {
      isLimited: !result.allowed,
      resetTime: result.resetTime,
      remainingAttempts: result.remainingAttempts,
      nextAttemptIn: result.resetTime ? Math.max(0, result.resetTime - Date.now()) : undefined
    }
  }
}

// Export singleton instance
export const authSecurity = new AuthSecurityManager()

// Export utility functions
export const formatRemainingTime = (ms: number): string => {
  const minutes = Math.ceil(ms / (1000 * 60))
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  const hours = Math.ceil(minutes / 60)
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

export const generateSecureToken = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Export types
export type { RateLimitConfig, SecurityEvent } 