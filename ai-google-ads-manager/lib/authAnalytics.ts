'use client'

// Phase D: Authentication Analytics & Monitoring System

export enum AuthEvent {
  // Authentication Events
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  SIGNUP_ATTEMPT = 'SIGNUP_ATTEMPT',
  SIGNUP_SUCCESS = 'SIGNUP_SUCCESS',
  SIGNUP_FAILURE = 'SIGNUP_FAILURE',
  
  // Session Management
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_RENEWED = 'SESSION_RENEWED',
  
  // Token Management
  TOKEN_REFRESH_ATTEMPT = 'TOKEN_REFRESH_ATTEMPT',
  TOKEN_REFRESH_SUCCESS = 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE = 'TOKEN_REFRESH_FAILURE',
  TOKEN_VALIDATION_SUCCESS = 'TOKEN_VALIDATION_SUCCESS',
  TOKEN_VALIDATION_FAILURE = 'TOKEN_VALIDATION_FAILURE',
  
  // Error Events
  ERROR_CLASSIFIED = 'ERROR_CLASSIFIED',
  ERROR_RECOVERY_ATTEMPTED = 'ERROR_RECOVERY_ATTEMPTED',
  ERROR_RECOVERY_SUCCESS = 'ERROR_RECOVERY_SUCCESS',
  ERROR_RECOVERY_FAILED = 'ERROR_RECOVERY_FAILED',
  
  // User Flow Events
  ROUTE_PROTECTED = 'ROUTE_PROTECTED',
  ROUTE_AUTHORIZED = 'ROUTE_AUTHORIZED',
  ROUTE_DENIED = 'ROUTE_DENIED',
  SIGN_OUT_ATTEMPT = 'SIGN_OUT_ATTEMPT',
  SIGN_OUT_SUCCESS = 'SIGN_OUT_SUCCESS',
  
  // OAuth Events
  OAUTH_REDIRECT = 'OAUTH_REDIRECT',
  OAUTH_CALLBACK = 'OAUTH_CALLBACK',
  OAUTH_SUCCESS = 'OAUTH_SUCCESS',
  OAUTH_FAILURE = 'OAUTH_FAILURE',
  
  // Security Events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  MULTIPLE_LOGIN_ATTEMPTS = 'MULTIPLE_LOGIN_ATTEMPTS',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS'
}

export interface AuthAnalyticsEvent {
  id: string
  event: AuthEvent
  timestamp: number
  userId?: string
  sessionId: string
  
  // Context Information
  userAgent: string
  ipAddress?: string
  route?: string
  referrer?: string
  
  // Event-specific data
  provider?: 'google' | 'email'
  errorType?: string
  errorMessage?: string
  duration?: number
  success?: boolean
  
  // Additional metadata
  metadata?: Record<string, any>
}

export interface AuthAnalyticsMetrics {
  // Login Metrics
  loginAttempts: number
  loginSuccesses: number
  loginFailures: number
  loginSuccessRate: number
  
  // Session Metrics
  activeSessions: number
  averageSessionDuration: number
  sessionRenewals: number
  sessionExpirations: number
  
  // Token Metrics
  tokenRefreshAttempts: number
  tokenRefreshSuccesses: number
  tokenRefreshFailures: number
  tokenRefreshSuccessRate: number
  
  // Error Metrics
  totalErrors: number
  errorRecoveryAttempts: number
  errorRecoverySuccesses: number
  errorRecoverySuccessRate: number
  
  // Route Protection Metrics
  protectedRouteAccesses: number
  authorizedAccesses: number
  deniedAccesses: number
  authorizationSuccessRate: number
  
  // Time-based metrics
  peakUsageHours: number[]
  dailyActiveUsers: number
  timeRange: {
    start: number
    end: number
  }
}

export interface UserFlowAnalytics {
  userId: string
  sessionId: string
  events: AuthAnalyticsEvent[]
  
  // Flow Analysis
  entryPoint: string
  currentRoute: string
  previousRoutes: string[]
  timeOnRoute: number
  totalSessionTime: number
  
  // Conversion Metrics
  loginAttempted: boolean
  loginSuccessful: boolean
  firstTimeUser: boolean
  returnUser: boolean
  
  // Security Metrics
  failedLoginAttempts: number
  suspiciousActivity: boolean
}

class AuthAnalyticsManager {
  private events: AuthAnalyticsEvent[] = []
  private userFlows: Map<string, UserFlowAnalytics> = new Map()
  private sessionId: string
  private isEnabled: boolean = true
  
  // Storage keys
  private readonly EVENTS_STORAGE_KEY = 'auth_analytics_events'
  private readonly FLOWS_STORAGE_KEY = 'auth_analytics_flows'
  private readonly SESSION_STORAGE_KEY = 'auth_analytics_session'
  
  constructor(options: { enableStorage?: boolean; maxEvents?: number } = {}) {
    this.sessionId = this.generateSessionId()
    this.isEnabled = options.enableStorage ?? true
    
    // Load existing data if enabled
    if (this.isEnabled && typeof window !== 'undefined') {
      this.loadFromStorage()
    }
    
    // Setup automatic cleanup
    this.setupCleanup(options.maxEvents || 1000)
  }
  
  /**
   * Track an authentication event
   */
  track(event: AuthEvent, data: Partial<AuthAnalyticsEvent> = {}): void {
    if (!this.isEnabled) return
    
    const analyticsEvent: AuthAnalyticsEvent = {
      id: this.generateEventId(),
      event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      ...data
    }
    
    this.events.push(analyticsEvent)
    this.updateUserFlow(analyticsEvent)
    
    // Save to storage if enabled
    if (this.isEnabled && typeof window !== 'undefined') {
      this.saveToStorage()
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Auth Analytics:', {
        event: event,
        data: analyticsEvent,
        sessionId: this.sessionId
      })
    }
  }
  
  /**
   * Get comprehensive analytics metrics
   */
  getMetrics(timeRange?: { start: number; end: number }): AuthAnalyticsMetrics {
    const filteredEvents = timeRange 
      ? this.events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      : this.events
    
    // Login Metrics
    const loginAttempts = filteredEvents.filter(e => e.event === AuthEvent.LOGIN_ATTEMPT).length
    const loginSuccesses = filteredEvents.filter(e => e.event === AuthEvent.LOGIN_SUCCESS).length
    const loginFailures = filteredEvents.filter(e => e.event === AuthEvent.LOGIN_FAILURE).length
    
    // Session Metrics
    const sessionStarts = filteredEvents.filter(e => e.event === AuthEvent.SESSION_START)
    const sessionEnds = filteredEvents.filter(e => e.event === AuthEvent.SESSION_END)
    const sessionDurations = sessionEnds.map(end => {
      const start = sessionStarts.find(s => s.sessionId === end.sessionId)
      return start ? end.timestamp - start.timestamp : 0
    }).filter(d => d > 0)
    
    // Token Metrics
    const tokenRefreshAttempts = filteredEvents.filter(e => e.event === AuthEvent.TOKEN_REFRESH_ATTEMPT).length
    const tokenRefreshSuccesses = filteredEvents.filter(e => e.event === AuthEvent.TOKEN_REFRESH_SUCCESS).length
    const tokenRefreshFailures = filteredEvents.filter(e => e.event === AuthEvent.TOKEN_REFRESH_FAILURE).length
    
    // Error Metrics
    const totalErrors = filteredEvents.filter(e => e.event === AuthEvent.ERROR_CLASSIFIED).length
    const errorRecoveryAttempts = filteredEvents.filter(e => e.event === AuthEvent.ERROR_RECOVERY_ATTEMPTED).length
    const errorRecoverySuccesses = filteredEvents.filter(e => e.event === AuthEvent.ERROR_RECOVERY_SUCCESS).length
    
    // Route Protection Metrics
    const protectedRouteAccesses = filteredEvents.filter(e => e.event === AuthEvent.ROUTE_PROTECTED).length
    const authorizedAccesses = filteredEvents.filter(e => e.event === AuthEvent.ROUTE_AUTHORIZED).length
    const deniedAccesses = filteredEvents.filter(e => e.event === AuthEvent.ROUTE_DENIED).length
    
    return {
      // Login Metrics
      loginAttempts,
      loginSuccesses,
      loginFailures,
      loginSuccessRate: loginAttempts > 0 ? (loginSuccesses / loginAttempts) * 100 : 0,
      
      // Session Metrics
      activeSessions: new Set(filteredEvents.map(e => e.sessionId)).size,
      averageSessionDuration: sessionDurations.length > 0 ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length : 0,
      sessionRenewals: filteredEvents.filter(e => e.event === AuthEvent.SESSION_RENEWED).length,
      sessionExpirations: filteredEvents.filter(e => e.event === AuthEvent.SESSION_EXPIRED).length,
      
      // Token Metrics
      tokenRefreshAttempts,
      tokenRefreshSuccesses,
      tokenRefreshFailures,
      tokenRefreshSuccessRate: tokenRefreshAttempts > 0 ? (tokenRefreshSuccesses / tokenRefreshAttempts) * 100 : 0,
      
      // Error Metrics
      totalErrors,
      errorRecoveryAttempts,
      errorRecoverySuccesses,
      errorRecoverySuccessRate: errorRecoveryAttempts > 0 ? (errorRecoverySuccesses / errorRecoveryAttempts) * 100 : 0,
      
      // Route Protection Metrics
      protectedRouteAccesses,
      authorizedAccesses,
      deniedAccesses,
      authorizationSuccessRate: protectedRouteAccesses > 0 ? (authorizedAccesses / protectedRouteAccesses) * 100 : 0,
      
      // Time-based metrics
      peakUsageHours: this.calculatePeakUsageHours(filteredEvents),
      dailyActiveUsers: this.calculateDailyActiveUsers(filteredEvents),
      timeRange: timeRange || {
        start: Math.min(...filteredEvents.map(e => e.timestamp)),
        end: Math.max(...filteredEvents.map(e => e.timestamp))
      }
    }
  }
  
  /**
   * Get user flow analytics
   */
  getUserFlow(sessionId: string): UserFlowAnalytics | undefined {
    return this.userFlows.get(sessionId)
  }
  
  /**
   * Get all user flows
   */
  getAllUserFlows(): UserFlowAnalytics[] {
    return Array.from(this.userFlows.values())
  }
  
  /**
   * Get events for debugging
   */
  getEvents(filter?: (event: AuthAnalyticsEvent) => boolean): AuthAnalyticsEvent[] {
    return filter ? this.events.filter(filter) : [...this.events]
  }
  
  /**
   * Clear all analytics data
   */
  clear(): void {
    this.events = []
    this.userFlows.clear()
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.EVENTS_STORAGE_KEY)
      localStorage.removeItem(this.FLOWS_STORAGE_KEY)
    }
  }
  
  /**
   * Export analytics data
   */
  exportData(): {
    events: AuthAnalyticsEvent[]
    userFlows: UserFlowAnalytics[]
    metrics: AuthAnalyticsMetrics
    generatedAt: number
  } {
    return {
      events: this.events,
      userFlows: this.getAllUserFlows(),
      metrics: this.getMetrics(),
      generatedAt: Date.now()
    }
  }
  
  /**
   * Enable or disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }
  
  // Private methods
  
  private updateUserFlow(event: AuthAnalyticsEvent): void {
    const flowKey = event.sessionId
    let flow = this.userFlows.get(flowKey)
    
    if (!flow) {
      flow = {
        userId: event.userId || 'anonymous',
        sessionId: event.sessionId,
        events: [],
        entryPoint: event.route || 'unknown',
        currentRoute: event.route || 'unknown',
        previousRoutes: [],
        timeOnRoute: 0,
        totalSessionTime: 0,
        loginAttempted: false,
        loginSuccessful: false,
        firstTimeUser: true,
        returnUser: false,
        failedLoginAttempts: 0,
        suspiciousActivity: false
      }
      this.userFlows.set(flowKey, flow)
    }
    
    // Update flow based on event
    flow.events.push(event)
    
    if (event.route && event.route !== flow.currentRoute) {
      flow.previousRoutes.push(flow.currentRoute)
      flow.currentRoute = event.route
    }
    
    // Update flow metrics based on event type
    switch (event.event) {
      case AuthEvent.LOGIN_ATTEMPT:
        flow.loginAttempted = true
        break
      case AuthEvent.LOGIN_SUCCESS:
        flow.loginSuccessful = true
        break
      case AuthEvent.LOGIN_FAILURE:
        flow.failedLoginAttempts++
        if (flow.failedLoginAttempts >= 3) {
          flow.suspiciousActivity = true
        }
        break
      case AuthEvent.SUSPICIOUS_ACTIVITY:
        flow.suspiciousActivity = true
        break
    }
    
    // Update session timing
    const sessionEvents = flow.events.filter(e => e.sessionId === event.sessionId)
    if (sessionEvents.length > 1) {
      const firstEvent = sessionEvents[0]
      flow.totalSessionTime = event.timestamp - firstEvent.timestamp
    }
  }
  
  private calculatePeakUsageHours(events: AuthAnalyticsEvent[]): number[] {
    const hourCounts: Record<number, number> = {}
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    
    // Return hours sorted by usage count (descending)
    return Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))
  }
  
  private calculateDailyActiveUsers(events: AuthAnalyticsEvent[]): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayEvents = events.filter(e => e.timestamp >= today.getTime())
    return new Set(todayEvents.map(e => e.userId).filter(Boolean)).size
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private setupCleanup(maxEvents: number): void {
    // Cleanup old events periodically
    setInterval(() => {
      if (this.events.length > maxEvents) {
        const eventsToRemove = this.events.length - maxEvents
        this.events.splice(0, eventsToRemove)
        console.log(`📊 Cleaned up ${eventsToRemove} old analytics events`)
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }
  
  private loadFromStorage(): void {
    try {
      const eventsData = localStorage.getItem(this.EVENTS_STORAGE_KEY)
      const flowsData = localStorage.getItem(this.FLOWS_STORAGE_KEY)
      const sessionData = localStorage.getItem(this.SESSION_STORAGE_KEY)
      
      if (eventsData) {
        this.events = JSON.parse(eventsData)
      }
      
      if (flowsData) {
        const flows = JSON.parse(flowsData)
        this.userFlows = new Map(flows)
      }
      
      if (sessionData) {
        const { sessionId, timestamp } = JSON.parse(sessionData)
        // Use existing session if it's less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          this.sessionId = sessionId
        }
      }
    } catch (error) {
      console.warn('Failed to load analytics from storage:', error)
    }
  }
  
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.EVENTS_STORAGE_KEY, JSON.stringify(this.events.slice(-500))) // Keep last 500 events
      localStorage.setItem(this.FLOWS_STORAGE_KEY, JSON.stringify(Array.from(this.userFlows.entries())))
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify({
        sessionId: this.sessionId,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.warn('Failed to save analytics to storage:', error)
    }
  }
}

// Global analytics instance
export const authAnalytics = new AuthAnalyticsManager({
  enableStorage: true,
  maxEvents: 1000
})

// React hook for analytics
export function useAuthAnalytics() {
  const track = (event: AuthEvent, data?: Partial<AuthAnalyticsEvent>) => {
    authAnalytics.track(event, data)
  }
  
  const getMetrics = (timeRange?: { start: number; end: number }) => {
    return authAnalytics.getMetrics(timeRange)
  }
  
  const getUserFlow = (sessionId: string) => {
    return authAnalytics.getUserFlow(sessionId)
  }
  
  const getAllUserFlows = () => {
    return authAnalytics.getAllUserFlows()
  }
  
  const exportData = () => {
    return authAnalytics.exportData()
  }
  
  const clear = () => {
    authAnalytics.clear()
  }
  
  return {
    track,
    getMetrics,
    getUserFlow,
    getAllUserFlows,
    exportData,
    clear
  }
}

export default authAnalytics