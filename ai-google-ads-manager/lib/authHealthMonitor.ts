'use client'

// Phase D: Authentication Health Monitoring System

import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/auth'
import { authAnalytics, AuthEvent } from './authAnalytics'

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN'
}

export enum ServiceType {
  SUPABASE_AUTH = 'SUPABASE_AUTH',
  GOOGLE_OAUTH = 'GOOGLE_OAUTH',
  TOKEN_VALIDATION = 'TOKEN_VALIDATION',
  SESSION_MANAGEMENT = 'SESSION_MANAGEMENT',
  ERROR_RECOVERY = 'ERROR_RECOVERY',
  ROUTE_PROTECTION = 'ROUTE_PROTECTION'
}

export interface HealthCheck {
  id: string
  service: ServiceType
  status: HealthStatus
  timestamp: number
  
  // Performance metrics
  responseTime: number
  uptime: number
  
  // Error information
  error?: {
    message: string
    code?: string
    details?: any
  }
  
  // Additional metrics
  metrics?: {
    successRate?: number
    averageResponseTime?: number
    errorCount?: number
    lastSuccessfulCheck?: number
  }
}

export interface HealthReport {
  overallStatus: HealthStatus
  services: Record<ServiceType, HealthCheck>
  alerts: HealthAlert[]
  generatedAt: number
  
  // Summary metrics
  summary: {
    totalServices: number
    healthyServices: number
    warningServices: number
    criticalServices: number
    averageResponseTime: number
    overallUptime: number
  }
}

export interface HealthAlert {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  service: ServiceType
  message: string
  timestamp: number
  resolved: boolean
  
  // Alert context
  context?: {
    errorCount?: number
    duration?: number
    affectedUsers?: number
    recommendedAction?: string
  }
}

export interface MonitoringConfig {
  checkInterval: number
  alertThresholds: {
    responseTime: number
    errorRate: number
    uptime: number
  }
  enableAlerting: boolean
  enableAutoRecovery: boolean
  retentionDays: number
}

class AuthHealthMonitor {
  private checks: Map<ServiceType, HealthCheck[]> = new Map()
  private alerts: HealthAlert[] = []
  private monitoringIntervals: Map<ServiceType, NodeJS.Timeout> = new Map()
  private config: MonitoringConfig
  private isMonitoring: boolean = false
  
  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      alertThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 10, // 10%
        uptime: 95 // 95%
      },
      enableAlerting: true,
      enableAutoRecovery: true,
      retentionDays: 7,
      ...config
    }
    
    // Initialize checks storage
    Object.values(ServiceType).forEach(service => {
      this.checks.set(service, [])
    })
  }
  
  /**
   * Start monitoring all services
   */
  startMonitoring(): void {
    if (this.isMonitoring) return
    
    console.log('🔍 Starting authentication health monitoring...')
    this.isMonitoring = true
    
    // Start monitoring each service
    Object.values(ServiceType).forEach(service => {
      this.startServiceMonitoring(service)
    })
    
    // Setup cleanup interval
    this.setupCleanup()
    
    // Track monitoring start
    authAnalytics.track(AuthEvent.SESSION_START, {
      metadata: { component: 'health_monitor' }
    })
  }
  
  /**
   * Stop monitoring all services
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return
    
    console.log('🛑 Stopping authentication health monitoring...')
    this.isMonitoring = false
    
    // Clear all intervals
    this.monitoringIntervals.forEach(interval => {
      clearInterval(interval)
    })
    this.monitoringIntervals.clear()
  }
  
  /**
   * Perform immediate health check for all services
   */
  async performHealthCheck(): Promise<HealthReport> {
    const services: Record<ServiceType, HealthCheck> = {} as any
    
    // Run all health checks concurrently
    const checkPromises = Object.values(ServiceType).map(async service => {
      const check = await this.checkServiceHealth(service)
      services[service] = check
      return check
    })
    
    await Promise.all(checkPromises)
    
    // Generate alerts based on checks
    const newAlerts = this.generateAlerts(services)
    this.alerts.push(...newAlerts)
    
    // Calculate overall status and summary
    const overallStatus = this.calculateOverallStatus(services)
    const summary = this.calculateSummary(services)
    
    const report: HealthReport = {
      overallStatus,
      services,
      alerts: this.getActiveAlerts(),
      generatedAt: Date.now(),
      summary
    }
    
    console.log('📊 Health Check Report:', {
      status: overallStatus,
      services: Object.keys(services).length,
      alerts: newAlerts.length
    })
    
    return report
  }
  
  /**
   * Get the latest health report
   */
  getLatestReport(): HealthReport | null {
    const latestChecks: Record<ServiceType, HealthCheck> = {} as any
    
    // Get the most recent check for each service
    Object.values(ServiceType).forEach(service => {
      const checks = this.checks.get(service) || []
      if (checks.length > 0) {
        latestChecks[service] = checks[checks.length - 1]
      }
    })
    
    if (Object.keys(latestChecks).length === 0) {
      return null
    }
    
    const overallStatus = this.calculateOverallStatus(latestChecks)
    const summary = this.calculateSummary(latestChecks)
    
    return {
      overallStatus,
      services: latestChecks,
      alerts: this.getActiveAlerts(),
      generatedAt: Date.now(),
      summary
    }
  }
  
  /**
   * Get historical data for a specific service
   */
  getServiceHistory(service: ServiceType, timeRange?: { start: number; end: number }): HealthCheck[] {
    const checks = this.checks.get(service) || []
    
    if (!timeRange) {
      return [...checks]
    }
    
    return checks.filter(check => 
      check.timestamp >= timeRange.start && check.timestamp <= timeRange.end
    )
  }
  
  /**
   * Get all active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      console.log(`✅ Resolved health alert: ${alert.message}`)
      return true
    }
    return false
  }
  
  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart monitoring with new config if currently running
    if (this.isMonitoring) {
      this.stopMonitoring()
      this.startMonitoring()
    }
  }
  
  /**
   * Export monitoring data
   */
  exportData(): {
    checks: Record<ServiceType, HealthCheck[]>
    alerts: HealthAlert[]
    config: MonitoringConfig
    exportedAt: number
  } {
    const checksObject: Record<ServiceType, HealthCheck[]> = {} as any
    
    this.checks.forEach((checks, service) => {
      checksObject[service] = checks
    })
    
    return {
      checks: checksObject,
      alerts: this.alerts,
      config: this.config,
      exportedAt: Date.now()
    }
  }
  
  // Private methods
  
  private startServiceMonitoring(service: ServiceType): void {
    const interval = setInterval(async () => {
      try {
        const check = await this.checkServiceHealth(service)
        this.addHealthCheck(service, check)
        
        // Generate alerts if needed
        const alerts = this.generateAlertsForService(service, check)
        this.alerts.push(...alerts)
        
      } catch (error) {
        console.error(`Health check failed for ${service}:`, error)
      }
    }, this.config.checkInterval)
    
    this.monitoringIntervals.set(service, interval)
  }
  
  private async checkServiceHealth(service: ServiceType): Promise<HealthCheck> {
    const startTime = Date.now()
    let status = HealthStatus.HEALTHY
    let error: any = undefined
    
    try {
      switch (service) {
        case ServiceType.SUPABASE_AUTH:
          await this.checkSupabaseAuth()
          break
          
        case ServiceType.GOOGLE_OAUTH:
          await this.checkGoogleOAuth()
          break
          
        case ServiceType.TOKEN_VALIDATION:
          await this.checkTokenValidation()
          break
          
        case ServiceType.SESSION_MANAGEMENT:
          await this.checkSessionManagement()
          break
          
        case ServiceType.ERROR_RECOVERY:
          await this.checkErrorRecovery()
          break
          
        case ServiceType.ROUTE_PROTECTION:
          await this.checkRouteProtection()
          break
          
        default:
          throw new Error(`Unknown service: ${service}`)
      }
    } catch (err: any) {
      status = HealthStatus.CRITICAL
      error = {
        message: err.message || 'Unknown error',
        code: err.code,
        details: err
      }
    }
    
    const responseTime = Date.now() - startTime
    
    // Calculate uptime and metrics
    const previousChecks = this.checks.get(service) || []
    const metrics = this.calculateServiceMetrics(service, previousChecks, status === HealthStatus.HEALTHY)
    
    return {
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      service,
      status,
      timestamp: Date.now(),
      responseTime,
      uptime: metrics.uptime,
      error,
      metrics
    }
  }
  
  private async checkSupabaseAuth(): Promise<void> {
    // Test Supabase connection and basic auth functionality
    const { data, error } = await supabase.auth.getSession()
    if (error && error.message !== 'No session found') {
      throw new Error(`Supabase Auth error: ${error.message}`)
    }
    
    // Additional check: test anonymous sign-in capability
    try {
      await supabase.auth.signInAnonymously()
    } catch (err: any) {
      if (!err.message?.includes('Anonymous sign-ins are disabled')) {
        throw err
      }
    }
  }
  
  private async checkGoogleOAuth(): Promise<void> {
    // Check if Google OAuth configuration is valid
    const config = {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
    }
    
    if (!config.clientId) {
      throw new Error('Google OAuth client ID not configured')
    }
    
    // Test Google OAuth endpoint accessibility (simple connectivity check)
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('https://accounts.google.com/.well-known/openid_configuration', {
          method: 'HEAD',
          mode: 'no-cors'
        })
        // If no error thrown, the endpoint is accessible
      } catch (error) {
        throw new Error('Google OAuth service unreachable')
      }
    }
  }
  
  private async checkTokenValidation(): Promise<void> {
    // Test token validation functionality
    try {
      const currentUser = await auth.getCurrentUser()
      
      if (currentUser) {
        // Test token health if user is authenticated
        const tokenHealth = await auth.checkTokenHealth(currentUser.id)
        if (!tokenHealth.isValid) {
          throw new Error(`Token validation failed: ${tokenHealth.error?.message}`)
        }
      }
    } catch (error: any) {
      if (!error.message?.includes('No user found')) {
        throw error
      }
    }
  }
  
  private async checkSessionManagement(): Promise<void> {
    // Test session management functionality
    const { data: session } = await supabase.auth.getSession()
    
    // Test session refresh capability
    try {
      await supabase.auth.refreshSession()
    } catch (error: any) {
      if (!error.message?.includes('No session found')) {
        throw new Error(`Session management error: ${error.message}`)
      }
    }
  }
  
  private async checkErrorRecovery(): Promise<void> {
    // Test error recovery system availability
    try {
      const { classifyAuthError } = await import('./authErrorHandler')
      const { ErrorRecoveryManager } = await import('./errorRecoveryManager')
      
      // Create a test error to ensure classification works
      const testError = new Error('Health check test error')
      const classified = classifyAuthError(testError)
      
      if (!classified || !classified.type) {
        throw new Error('Error classification system not functioning')
      }
      
      // Test recovery manager initialization
      const manager = new ErrorRecoveryManager({ enableAutoRecovery: false })
      if (!manager) {
        throw new Error('Error recovery manager initialization failed')
      }
    } catch (error: any) {
      throw new Error(`Error recovery system check failed: ${error.message}`)
    }
  }
  
  private async checkRouteProtection(): Promise<void> {
    // Test route protection middleware functionality
    if (typeof window !== 'undefined') {
      try {
        // Test a protected API route
        const response = await fetch('/api/health-check', {
          method: 'HEAD'
        })
        
        // We expect either 200 (if authenticated) or 401 (if not authenticated)
        // Both indicate the middleware is working
        if (response.status !== 200 && response.status !== 401) {
          throw new Error(`Unexpected route protection response: ${response.status}`)
        }
      } catch (error: any) {
        if (error.message?.includes('fetch')) {
          throw new Error('Route protection middleware not responding')
        }
        throw error
      }
    }
  }
  
  private calculateServiceMetrics(service: ServiceType, previousChecks: HealthCheck[], isCurrentCheckSuccessful: boolean) {
    const recentChecks = previousChecks.slice(-20) // Last 20 checks
    
    if (recentChecks.length === 0) {
      return {
        successRate: isCurrentCheckSuccessful ? 100 : 0,
        averageResponseTime: 0,
        errorCount: isCurrentCheckSuccessful ? 0 : 1,
        uptime: isCurrentCheckSuccessful ? 100 : 0,
        lastSuccessfulCheck: isCurrentCheckSuccessful ? Date.now() : undefined
      }
    }
    
    const successfulChecks = recentChecks.filter(c => c.status === HealthStatus.HEALTHY)
    const totalResponseTime = recentChecks.reduce((sum, c) => sum + c.responseTime, 0)
    const errorCount = recentChecks.filter(c => c.status !== HealthStatus.HEALTHY).length
    const lastSuccessful = [...successfulChecks].reverse()[0]
    
    return {
      successRate: (successfulChecks.length / recentChecks.length) * 100,
      averageResponseTime: totalResponseTime / recentChecks.length,
      errorCount,
      uptime: (successfulChecks.length / recentChecks.length) * 100,
      lastSuccessfulCheck: lastSuccessful?.timestamp
    }
  }
  
  private addHealthCheck(service: ServiceType, check: HealthCheck): void {
    const checks = this.checks.get(service) || []
    checks.push(check)
    
    // Keep only recent checks (based on retention)
    const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - retentionTime
    const filteredChecks = checks.filter(c => c.timestamp > cutoffTime)
    
    this.checks.set(service, filteredChecks)
  }
  
  private generateAlerts(services: Record<ServiceType, HealthCheck>): HealthAlert[] {
    const alerts: HealthAlert[] = []
    
    Object.entries(services).forEach(([serviceType, check]) => {
      const service = serviceType as ServiceType
      const serviceAlerts = this.generateAlertsForService(service, check)
      alerts.push(...serviceAlerts)
    })
    
    return alerts
  }
  
  private generateAlertsForService(service: ServiceType, check: HealthCheck): HealthAlert[] {
    const alerts: HealthAlert[] = []
    
    // Critical status alert
    if (check.status === HealthStatus.CRITICAL) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        severity: 'CRITICAL',
        service,
        message: `${service} is in critical state: ${check.error?.message || 'Unknown error'}`,
        timestamp: Date.now(),
        resolved: false,
        context: {
          recommendedAction: this.getRecommendedAction(service, check)
        }
      })
    }
    
    // High response time alert
    if (check.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        severity: 'WARNING',
        service,
        message: `${service} response time is high: ${check.responseTime}ms`,
        timestamp: Date.now(),
        resolved: false,
        context: {
          recommendedAction: 'Monitor service performance and consider scaling'
        }
      })
    }
    
    // Low uptime alert
    if (check.uptime < this.config.alertThresholds.uptime) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        severity: 'WARNING',
        service,
        message: `${service} uptime is low: ${check.uptime.toFixed(2)}%`,
        timestamp: Date.now(),
        resolved: false,
        context: {
          recommendedAction: 'Investigate service stability issues'
        }
      })
    }
    
    return alerts
  }
  
  private getRecommendedAction(service: ServiceType, check: HealthCheck): string {
    switch (service) {
      case ServiceType.SUPABASE_AUTH:
        return 'Check Supabase dashboard for service status and configuration'
      case ServiceType.GOOGLE_OAUTH:
        return 'Verify Google OAuth configuration and API quotas'
      case ServiceType.TOKEN_VALIDATION:
        return 'Check token validation logic and refresh mechanisms'
      case ServiceType.SESSION_MANAGEMENT:
        return 'Review session configuration and storage'
      case ServiceType.ERROR_RECOVERY:
        return 'Verify error handling system components'
      case ServiceType.ROUTE_PROTECTION:
        return 'Check middleware configuration and route definitions'
      default:
        return 'Contact technical support for assistance'
    }
  }
  
  private calculateOverallStatus(services: Record<ServiceType, HealthCheck>): HealthStatus {
    const statuses = Object.values(services).map(check => check.status)
    
    if (statuses.includes(HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL
    }
    
    if (statuses.includes(HealthStatus.WARNING)) {
      return HealthStatus.WARNING
    }
    
    if (statuses.every(status => status === HealthStatus.HEALTHY)) {
      return HealthStatus.HEALTHY
    }
    
    return HealthStatus.UNKNOWN
  }
  
  private calculateSummary(services: Record<ServiceType, HealthCheck>) {
    const checks = Object.values(services)
    const totalServices = checks.length
    
    const healthyServices = checks.filter(c => c.status === HealthStatus.HEALTHY).length
    const warningServices = checks.filter(c => c.status === HealthStatus.WARNING).length
    const criticalServices = checks.filter(c => c.status === HealthStatus.CRITICAL).length
    
    const averageResponseTime = totalServices > 0 
      ? checks.reduce((sum, c) => sum + c.responseTime, 0) / totalServices 
      : 0
    
    const overallUptime = totalServices > 0
      ? checks.reduce((sum, c) => sum + c.uptime, 0) / totalServices
      : 0
    
    return {
      totalServices,
      healthyServices,
      warningServices,
      criticalServices,
      averageResponseTime,
      overallUptime
    }
  }
  
  private setupCleanup(): void {
    // Clean up old data every hour
    setInterval(() => {
      const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000
      const cutoffTime = Date.now() - retentionTime
      
      // Clean up health checks
      this.checks.forEach((checks, service) => {
        const filteredChecks = checks.filter(c => c.timestamp > cutoffTime)
        this.checks.set(service, filteredChecks)
      })
      
      // Clean up resolved alerts older than retention period
      this.alerts = this.alerts.filter(alert => 
        !alert.resolved || (alert.timestamp > cutoffTime)
      )
      
      console.log('🧹 Cleaned up old health monitoring data')
    }, 60 * 60 * 1000) // Every hour
  }
}

// Global health monitor instance
export const authHealthMonitor = new AuthHealthMonitor({
  checkInterval: 30000, // 30 seconds
  alertThresholds: {
    responseTime: 5000, // 5 seconds
    errorRate: 10, // 10%
    uptime: 95 // 95%
  },
  enableAlerting: true,
  enableAutoRecovery: true,
  retentionDays: 7
})

// React hook for health monitoring
export function useAuthHealthMonitor() {
  const startMonitoring = () => {
    authHealthMonitor.startMonitoring()
  }
  
  const stopMonitoring = () => {
    authHealthMonitor.stopMonitoring()
  }
  
  const performHealthCheck = async () => {
    return authHealthMonitor.performHealthCheck()
  }
  
  const getLatestReport = () => {
    return authHealthMonitor.getLatestReport()
  }
  
  const getServiceHistory = (service: ServiceType, timeRange?: { start: number; end: number }) => {
    return authHealthMonitor.getServiceHistory(service, timeRange)
  }
  
  const getActiveAlerts = () => {
    return authHealthMonitor.getActiveAlerts()
  }
  
  const resolveAlert = (alertId: string) => {
    return authHealthMonitor.resolveAlert(alertId)
  }
  
  const exportData = () => {
    return authHealthMonitor.exportData()
  }
  
  return {
    startMonitoring,
    stopMonitoring,
    performHealthCheck,
    getLatestReport,
    getServiceHistory,
    getActiveAlerts,
    resolveAlert,
    exportData
  }
}

export default authHealthMonitor