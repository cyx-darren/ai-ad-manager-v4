'use client'

import { AuthUser } from './auth'
import { getSessionStorageManager } from './sessionStorage'
import { getTokenRefreshManager } from './tokenRefreshManager'
import { getAuthEventHandler } from './authEventHandler'

interface AuthDebugInfo {
  user: AuthUser | null
  sessionStorage: {
    state: ReturnType<ReturnType<typeof getSessionStorageManager>['loadAuthState']>
    isRecoverable: boolean
  }
  tokenHealth: {
    isRefreshing: boolean
    lastRefresh: number | null
    nextRefresh: number | null
  }
  eventHandlerState: {
    listeners: number
    isActive: boolean
  }
  performanceMetrics: {
    renderCount: number
    lastOptimization: number
    memoryUsage?: number
  }
  flags: {
    isDevelopment: boolean
    isDebugging: boolean
    bypassAuth: boolean
  }
}

interface DevNotification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  timestamp: number
  actions?: { label: string; action: () => void }[]
}

type EventListener = (...args: unknown[]) => void

class AuthDevTools {
  private static instance: AuthDevTools | null = null
  private notifications: DevNotification[] = []
  private debugMode: boolean = false
  private bypassMode: boolean = false
  private listeners: Map<string, EventListener[]> = new Map()
  private performanceMetrics = {
    renderCount: 0,
    lastOptimization: Date.now(),
    startTime: Date.now()
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupDevConsole()
      this.setupKeyboardShortcuts()
      this.detectEnvironment()
    }
  }

  static getInstance(): AuthDevTools {
    if (!AuthDevTools.instance) {
      AuthDevTools.instance = new AuthDevTools()
    }
    return AuthDevTools.instance
  }

  private detectEnvironment() {
    this.debugMode = process.env.NODE_ENV === 'development' || 
                     process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true'
    
    if (this.debugMode) {
      console.log('🛠️ Auth Dev Tools initialized in development mode')
      this.addNotification({
        type: 'info',
        title: 'Development Mode',
        message: 'Auth debugging tools are active. Press Ctrl+Shift+A for auth debugger.'
      })
    }
  }

  private setupDevConsole() {
    if (typeof window === 'undefined') return

    // Add global auth debugger to window
    ;(window as Window & { authDebug?: Record<string, () => unknown> }).authDebug = {
      getState: () => this.getDebugInfo(),
      clearNotifications: () => this.clearNotifications(),
      enableBypass: () => this.enableBypass(),
      disableBypass: () => this.disableBypass(),
      simulateTokenExpiry: () => this.simulateTokenExpiry(),
      testPerformance: () => this.testPerformance(),
      exportLogs: () => this.exportLogs()
    }
  }

  private setupKeyboardShortcuts() {
    if (typeof window === 'undefined') return

    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+A: Open auth debugger
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        this.openDebugger()
      }
      
      // Ctrl+Shift+N: Toggle notifications
      if (event.ctrlKey && event.shiftKey && event.key === 'N') {
        event.preventDefault()
        this.toggleNotifications()
      }
      
      // Ctrl+Shift+B: Toggle auth bypass
      if (event.ctrlKey && event.shiftKey && event.key === 'B') {
        event.preventDefault()
        this.toggleBypass()
      }
    })
  }

  // Development notifications system
  addNotification(notification: Omit<DevNotification, 'id' | 'timestamp'>) {
    if (!this.debugMode) return

    const newNotification: DevNotification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    this.notifications.unshift(newNotification)
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50)
    }

    this.emitEvent('notification', newNotification)
    
    // Auto-clear info notifications after 5 seconds
    if (notification.type === 'info') {
      setTimeout(() => {
        this.removeNotification(newNotification.id)
      }, 5000)
    }
  }

  removeNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id)
    this.emitEvent('notificationRemoved', id)
  }

  clearNotifications() {
    this.notifications = []
    this.emitEvent('notificationsCleared', null)
  }

  // Auth bypass for development
  enableBypass() {
    if (!this.debugMode) {
      console.warn('Auth bypass only available in development mode')
      return
    }

    this.bypassMode = true
    localStorage.setItem('auth_dev_bypass', 'true')
    
    this.addNotification({
      type: 'warning',
      title: 'Auth Bypass Enabled',
      message: 'Authentication checks are bypassed. This should only be used in development!'
    })

    console.warn('🚨 Auth bypass enabled - all auth checks will pass')
  }

  disableBypass() {
    this.bypassMode = false
    localStorage.removeItem('auth_dev_bypass')
    
    this.addNotification({
      type: 'success',
      title: 'Auth Bypass Disabled',
      message: 'Normal authentication flow restored.'
    })

    console.log('✅ Auth bypass disabled - normal auth flow restored')
  }

  toggleBypass() {
    if (this.bypassMode) {
      this.disableBypass()
    } else {
      this.enableBypass()
    }
  }

  isBypassEnabled(): boolean {
    return this.bypassMode || localStorage.getItem('auth_dev_bypass') === 'true'
  }

  // Debug information gathering
  async getDebugInfo(): Promise<AuthDebugInfo> {
    const sessionStorage = getSessionStorageManager()
    const tokenManager = getTokenRefreshManager()
    const eventHandler = getAuthEventHandler()

    return {
      user: sessionStorage.loadAuthState()?.user || null,
      sessionStorage: {
        state: sessionStorage.loadAuthState(),
        isRecoverable: (sessionStorage as unknown as { isSessionRecoverable?: () => boolean }).isSessionRecoverable?.() || false
      },
      tokenHealth: {
        isRefreshing: (tokenManager as unknown as { isRefreshing?: boolean }).isRefreshing || false,
        lastRefresh: (tokenManager as unknown as { lastRefreshTime?: number }).lastRefreshTime || null,
        nextRefresh: (tokenManager as unknown as { nextRefreshTime?: number }).nextRefreshTime || null
      },
      eventHandlerState: {
        listeners: (eventHandler as unknown as { authListeners?: unknown[] }).authListeners?.length || 0,
        isActive: true
      },
      performanceMetrics: {
        ...this.performanceMetrics,
        memoryUsage: (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || undefined
      },
      flags: {
        isDevelopment: this.debugMode,
        isDebugging: this.debugMode,
        bypassAuth: this.bypassMode
      }
    }
  }

  // Performance testing
  incrementRenderCount() {
    this.performanceMetrics.renderCount++
    
    // Warn about excessive re-renders
    if (this.performanceMetrics.renderCount % 50 === 0) {
      this.addNotification({
        type: 'warning',
        title: 'High Render Count',
        message: `Auth component has re-rendered ${this.performanceMetrics.renderCount} times. Consider optimization.`
      })
    }
  }

  testPerformance() {
    const startTime = performance.now()
    const iterations = 1000
    
    // Simulate auth state access
    for (let i = 0; i < iterations; i++) {
      this.getDebugInfo()
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    this.addNotification({
      type: 'info',
      title: 'Performance Test Complete',
      message: `${iterations} auth state accesses completed in ${duration.toFixed(2)}ms`
    })
    
    return { duration, iterations, avgTime: duration / iterations }
  }

  // Token expiry simulation
  simulateTokenExpiry() {
    if (!this.debugMode) return

    this.addNotification({
      type: 'warning',
      title: 'Simulated Token Expiry',
      message: 'Token expiry event triggered for testing purposes.'
    })

    // Emit token expiry event
    const eventHandler = getAuthEventHandler()
    const mockExpiryEvent = {
      userId: 'dev_user',
      expiresAt: new Date(Date.now() + 60000), // 1 minute from now
      minutesUntilExpiry: 1,
      severity: 'WARNING' as const
    }

    // Trigger expiry event if handler supports it
    if ((eventHandler as unknown as { handleTokenExpiry?: (event: typeof mockExpiryEvent) => void }).handleTokenExpiry) {
      (eventHandler as unknown as { handleTokenExpiry: (event: typeof mockExpiryEvent) => void }).handleTokenExpiry(mockExpiryEvent)
    }

    console.log('🔄 Simulated token expiry event:', mockExpiryEvent)
  }

  // Debug UI
  openDebugger() {
    if (!this.debugMode) return

    this.getDebugInfo().then(info => {
      console.group('🛠️ Auth Debug Information')
      console.log('User:', info.user)
      console.log('Session Storage:', info.sessionStorage)
      console.log('Token Health:', info.tokenHealth)
      console.log('Event Handler:', info.eventHandlerState)
      console.log('Performance:', info.performanceMetrics)
      console.log('Flags:', info.flags)
      console.log('Recent Notifications:', this.notifications.slice(0, 10))
      console.groupEnd()
      
      // Show browser alert with summary
      alert(`Auth Debug Summary:
User: ${info.user ? info.user.email : 'None'}
Renders: ${info.performanceMetrics.renderCount}
Bypass: ${info.flags.bypassAuth ? 'ON' : 'OFF'}
Notifications: ${this.notifications.length}`)
    })
  }

  toggleNotifications() {
    const hasNotifications = this.notifications.length > 0
    
    if (hasNotifications) {
      console.group('📢 Auth Notifications')
      this.notifications.forEach(n => {
        console.log(`[${n.type.toUpperCase()}] ${n.title}: ${n.message}`)
      })
      console.groupEnd()
    } else {
      console.log('📢 No auth notifications')
    }
  }

  // Export logs for debugging
  exportLogs() {
    const data = {
      timestamp: new Date().toISOString(),
      debugInfo: this.getDebugInfo(),
      notifications: this.notifications,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        nodeEnv: process.env.NODE_ENV
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auth-debug-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    this.addNotification({
      type: 'success',
      title: 'Debug Logs Exported',
      message: 'Auth debug information has been downloaded as JSON file.'
    })
  }

  // Event system
  on(event: string, callback: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: EventListener) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emitEvent(event: string, data: unknown) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  // Cleanup
  destroy() {
    this.notifications = []
    this.listeners.clear()
    
    // Remove global debugger
    if (typeof window !== 'undefined') {
      delete (window as Window & { authDebug?: Record<string, unknown> }).authDebug
    }
  }
}

// Singleton instance
export function getAuthDevTools(): AuthDevTools {
  return AuthDevTools.getInstance()
}

export type { AuthDebugInfo, DevNotification }
export { AuthDevTools }