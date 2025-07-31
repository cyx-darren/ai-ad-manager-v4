'use client'

import { AuthUser } from './auth'

// Storage keys
const STORAGE_KEYS = {
  AUTH_USER: 'auth_user',
  AUTH_STATE: 'auth_state', 
  TOKEN_VALIDITY: 'token_validity',
  SESSION_TIMESTAMP: 'session_timestamp',
  CROSS_TAB_EVENT: 'auth_cross_tab',
  REMEMBER_ME: 'auth_remember_me',
  LAST_ACTIVITY: 'auth_last_activity'
} as const

interface StoredAuthState {
  user: AuthUser | null
  isTokenValid: boolean
  sessionTimestamp: number
  lastActivity: number
  rememberMe: boolean
}

interface CrossTabEvent {
  type: 'AUTH_CHANGE' | 'TOKEN_UPDATE' | 'SIGN_OUT' | 'SESSION_REFRESH'
  data?: Record<string, unknown>
  timestamp: number
  tabId: string
}

class SessionStorageManager {
  private tabId: string
  private eventListeners: Map<string, ((event: CrossTabEvent) => void)[]> = new Map()
  private storageListener?: (event: StorageEvent) => void
  private lastActivity: number = Date.now()
  private activityTimer?: NodeJS.Timeout

  constructor() {
    this.tabId = this.generateTabId()
    this.setupStorageListener()
    this.setupActivityTracking()
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupStorageListener() {
    if (typeof window === 'undefined') return

    this.storageListener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.CROSS_TAB_EVENT && event.newValue) {
        try {
          const crossTabEvent: CrossTabEvent = JSON.parse(event.newValue)
          
          // Don't process events from the same tab
          if (crossTabEvent.tabId === this.tabId) return

          console.log('🔄 Cross-tab event received:', crossTabEvent.type)
          
          // Emit to registered listeners
          const listeners = this.eventListeners.get(crossTabEvent.type) || []
          listeners.forEach(listener => listener(crossTabEvent))
        } catch (error) {
          console.error('Error parsing cross-tab event:', error)
        }
      }
    }

    window.addEventListener('storage', this.storageListener)
  }

  private setupActivityTracking() {
    if (typeof window === 'undefined') return

    const trackActivity = () => {
      this.lastActivity = Date.now()
      this.setItem(STORAGE_KEYS.LAST_ACTIVITY, this.lastActivity.toString())
    }

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true })
    })

    // Update activity every 30 seconds
    this.activityTimer = setInterval(trackActivity, 30000)
  }

  // Session state management
  saveAuthState(state: StoredAuthState): void {
    try {
      const dataToStore = {
        ...state,
        sessionTimestamp: Date.now(),
        lastActivity: this.lastActivity
      }

      if (state.rememberMe) {
        // Use localStorage for persistent sessions
        localStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(dataToStore))
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true')
      } else {
        // Use sessionStorage for session-only
        window.sessionStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(dataToStore))
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME)
      }

      console.log('💾 Auth state saved to storage')
    } catch (error) {
      console.error('Failed to save auth state:', error)
    }
  }

  loadAuthState(): StoredAuthState | null {
    try {
      // Check for persistent storage first
      let storedData = localStorage.getItem(STORAGE_KEYS.AUTH_STATE)
      let isPersistent = true

      // Fall back to session storage
      if (!storedData) {
        storedData = window.sessionStorage.getItem(STORAGE_KEYS.AUTH_STATE)
        isPersistent = false
      }

      if (!storedData) return null

      const state: StoredAuthState = JSON.parse(storedData)
      
      // Check if session is expired (24 hours for persistent, 2 hours for session)
      const maxAge = isPersistent ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000
      const age = Date.now() - state.sessionTimestamp
      
      if (age > maxAge) {
        console.log('🕐 Stored session expired, clearing')
        this.clearAuthState()
        return null
      }

      console.log('📂 Auth state loaded from storage')
      return state
    } catch (error) {
      console.error('Failed to load auth state:', error)
      return null
    }
  }

  clearAuthState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_STATE)
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME)
      window.sessionStorage.removeItem(STORAGE_KEYS.AUTH_STATE)
      
      console.log('🧹 Auth state cleared from storage')
    } catch (error) {
      console.error('Failed to clear auth state:', error)
    }
  }

  // Cross-tab communication
  emitCrossTabEvent(type: CrossTabEvent['type'], data?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return

    const event: CrossTabEvent = {
      type,
      data,
      timestamp: Date.now(),
      tabId: this.tabId
    }

    try {
      localStorage.setItem(STORAGE_KEYS.CROSS_TAB_EVENT, JSON.stringify(event))
      // Clear immediately to ensure event fires
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.CROSS_TAB_EVENT)
      }, 100)
    } catch (error) {
      console.error('Failed to emit cross-tab event:', error)
    }
  }

  onCrossTabEvent(type: CrossTabEvent['type'], callback: (event: CrossTabEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, [])
    }
    
    this.eventListeners.get(type)!.push(callback)

    // Return cleanup function
    return () => {
      const listeners = this.eventListeners.get(type) || []
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Session recovery helpers
  isSessionRecoverable(): boolean {
    const stored = this.loadAuthState()
    return stored !== null && stored.user !== null
  }

  getSessionAge(): number {
    const stored = this.loadAuthState()
    if (!stored) return 0
    return Date.now() - stored.sessionTimestamp
  }

  isRememberMeEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true'
  }

  // Activity tracking
  getLastActivity(): number {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY)
    return stored ? parseInt(stored, 10) : this.lastActivity
  }

  isSessionActive(): boolean {
    const lastActivity = this.getLastActivity()
    const inactiveTime = Date.now() - lastActivity
    return inactiveTime < 30 * 60 * 1000 // 30 minutes
  }

  // Utility methods
  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.error(`Failed to set storage item ${key}:`, error)
    }
  }

  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error(`Failed to get storage item ${key}:`, error)
      return null
    }
  }

  // Cleanup
  destroy(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener)
    }
    
    if (this.activityTimer) {
      clearInterval(this.activityTimer)
    }

    this.eventListeners.clear()
  }
}

// Singleton instance
let sessionStorage: SessionStorageManager | null = null

export function getSessionStorageManager(): SessionStorageManager {
  if (typeof window === 'undefined') {
    // Return a mock instance for SSR
    return {
      saveAuthState: () => {},
      loadAuthState: () => null,
      clearAuthState: () => {},
      emitCrossTabEvent: () => {},
      onCrossTabEvent: () => () => {},
      isSessionRecoverable: () => false,
      getSessionAge: () => 0,
      isRememberMeEnabled: () => false,
      getLastActivity: () => Date.now(),
      isSessionActive: () => true,
      destroy: () => {}
    } as Partial<SessionStorageManager> as SessionStorageManager
  }

  if (!sessionStorage) {
    sessionStorage = new SessionStorageManager()
  }
  
  return sessionStorage
}

export type { StoredAuthState, CrossTabEvent }
export { STORAGE_KEYS }