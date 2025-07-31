'use client'

import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { auth, AuthUser } from './auth'
import { getSessionStorageManager, CrossTabEvent } from './sessionStorage'
import { getTokenRefreshManager } from './tokenRefreshManager'

interface AuthEventData {
  event: AuthChangeEvent
  session: Session | null
  user: User | null
  timestamp: number
}

interface TokenExpiryEvent {
  userId: string
  expiresAt: Date
  minutesUntilExpiry: number
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
}

interface UserProfileUpdateEvent {
  userId: string
  changes: Partial<AuthUser>
  source: 'SUPABASE' | 'GOOGLE' | 'MANUAL'
}

type AuthEventListener = (data: AuthEventData) => void
type TokenExpiryListener = (event: TokenExpiryEvent) => void
type ProfileUpdateListener = (event: UserProfileUpdateEvent) => void
type ConnectionListener = (isOnline: boolean) => void

interface AuthEventHandlerConfig {
  enableProfileUpdates: boolean
  enableTokenMonitoring: boolean
  enableConnectionMonitoring: boolean
  tokenExpiryWarningMinutes: number[]
  profileUpdateDebounceMs: number
  connectionCheckIntervalMs: number
}

class AuthEventHandler {
  private config: AuthEventHandlerConfig
  private sessionStorage = getSessionStorageManager()
  private tokenRefreshManager = getTokenRefreshManager()
  
  // Event listeners
  private authListeners: AuthEventListener[] = []
  private tokenExpiryListeners: TokenExpiryListener[] = []
  private profileUpdateListeners: ProfileUpdateListener[] = []
  private connectionListeners: ConnectionListener[] = []
  
  // State tracking
  private currentUser: AuthUser | null = null
  private lastProfileUpdate: number = 0
  private connectionStatus: boolean = navigator.onLine
  private supabaseSubscription?: { data: { subscription: { unsubscribe: () => void } } }
  
  // Timers
  private tokenMonitorTimer?: NodeJS.Timeout
  private connectionCheckTimer?: NodeJS.Timeout
  private profileUpdateDebounceTimer?: NodeJS.Timeout
  
  // Cross-tab cleanup functions
  private crossTabCleanups: (() => void)[] = []

  constructor(config?: Partial<AuthEventHandlerConfig>) {
    this.config = {
      enableProfileUpdates: true,
      enableTokenMonitoring: true,
      enableConnectionMonitoring: true,
      tokenExpiryWarningMinutes: [30, 10, 5, 1], // Warning thresholds
      profileUpdateDebounceMs: 1000,
      connectionCheckIntervalMs: 30000,
      ...config
    }

    this.initialize()
  }

  private initialize(): void {
    if (typeof window === 'undefined') return

    this.setupSupabaseAuthListener()
    this.setupCrossTabListeners()
    
    if (this.config.enableTokenMonitoring) {
      this.startTokenMonitoring()
    }
    
    if (this.config.enableConnectionMonitoring) {
      this.setupConnectionMonitoring()
    }

    console.log('🎧 Auth event handler initialized')
  }

  // Setup Supabase auth state listener
  private setupSupabaseAuthListener(): void {
    this.supabaseSubscription = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const eventData: AuthEventData = {
          event,
          session,
          user: session?.user || null,
          timestamp: Date.now()
        }

        console.log(`🔔 Auth event: ${event}`, {
          user: session?.user?.email,
          hasSession: !!session,
          timestamp: eventData.timestamp
        })

        // Handle the event
        await this.handleAuthStateChange(eventData)

        // Notify listeners
        this.authListeners.forEach(listener => {
          try {
            listener(eventData)
          } catch (error) {
            console.error('Auth listener error:', error)
          }
        })
      }
    )
  }

  // Handle different auth state changes
  private async handleAuthStateChange(eventData: AuthEventData): Promise<void> {
    const { event, session, user } = eventData

    try {
      switch (event) {
        case 'INITIAL_SESSION':
          await this.handleInitialSession(session)
          break
          
        case 'SIGNED_IN':
          await this.handleSignIn(session)
          break
          
        case 'SIGNED_OUT':
          await this.handleSignOut()
          break
          
        case 'TOKEN_REFRESHED':
          await this.handleTokenRefresh(session)
          break
          
        case 'USER_UPDATED':
          await this.handleUserUpdate(user)
          break
          
        case 'PASSWORD_RECOVERY':
          await this.handlePasswordRecovery()
          break
          
        default:
          console.log(`Unhandled auth event: ${event}`)
      }
    } catch (error) {
      console.error(`Error handling auth event ${event}:`, error)
    }
  }

  // Handle initial session load
  private async handleInitialSession(session: Session | null): Promise<void> {
    if (session?.user) {
      console.log('🔄 Loading initial session')
      
      const extendedUser = await auth.getCurrentUser()
      this.currentUser = extendedUser
      
      // Save session state
      this.sessionStorage.saveAuthState({
        user: extendedUser,
        isTokenValid: false, // Will be updated by token monitoring
        sessionTimestamp: Date.now(),
        lastActivity: Date.now(),
        rememberMe: this.sessionStorage.isRememberMeEnabled()
      })

      // Start token refresh manager if user has tokens
      if (extendedUser?.id) {
        this.tokenRefreshManager.start()
      }
    }
  }

  // Handle successful sign in
  private async handleSignIn(session: Session | null): Promise<void> {
    if (session?.user) {
      console.log('✅ User signed in successfully')
      
      // Process OAuth callback if applicable
      if (session.provider_token) {
        console.log('🔄 Processing OAuth callback with token capture')
        await auth.processOAuthCallback(session)
      }
      
      const extendedUser = await auth.getCurrentUser()
      this.currentUser = extendedUser
      
      // Save session state
      this.sessionStorage.saveAuthState({
        user: extendedUser,
        isTokenValid: false,
        sessionTimestamp: Date.now(),
        lastActivity: Date.now(),
        rememberMe: this.sessionStorage.isRememberMeEnabled()
      })

      // Emit cross-tab event
      this.sessionStorage.emitCrossTabEvent('AUTH_CHANGE', {
        type: 'SIGNED_IN',
        user: extendedUser,
        timestamp: Date.now()
      })

      // Start token management
      this.tokenRefreshManager.start()
    }
  }

  // Handle sign out
  private async handleSignOut(): Promise<void> {
    console.log('🚪 User signed out')
    
    this.currentUser = null
    
    // Clear session storage
    this.sessionStorage.clearAuthState()
    
    // Stop token monitoring
    this.stopTokenMonitoring()
    this.tokenRefreshManager.stop()
    
    // Emit cross-tab event
    this.sessionStorage.emitCrossTabEvent('SIGN_OUT', {
      timestamp: Date.now()
    })
  }

  // Handle token refresh
  private async handleTokenRefresh(session: Session | null): Promise<void> {
    console.log('🔄 Session token refreshed')
    
    if (session?.user && this.currentUser) {
      // Update current user data
      const extendedUser = await auth.getCurrentUser()
      this.currentUser = extendedUser
      
      // Update session storage
      const storedState = this.sessionStorage.loadAuthState()
      if (storedState) {
        this.sessionStorage.saveAuthState({
          ...storedState,
          user: extendedUser,
          sessionTimestamp: Date.now()
        })
      }

      // Emit cross-tab event
      this.sessionStorage.emitCrossTabEvent('SESSION_REFRESH', {
        timestamp: Date.now()
      })
    }
  }

  // Handle user profile updates
  private async handleUserUpdate(user: User | null): Promise<void> {
    if (!user || !this.config.enableProfileUpdates) return

    // Debounce profile updates
    if (this.profileUpdateDebounceTimer) {
      clearTimeout(this.profileUpdateDebounceTimer)
    }

    this.profileUpdateDebounceTimer = setTimeout(async () => {
      try {
        console.log('👤 User profile updated')
        
        const extendedUser = await auth.getCurrentUser()
        const previousUser = this.currentUser
        this.currentUser = extendedUser
        
        // Determine what changed
        const changes: Partial<AuthUser> = {}
        if (previousUser?.email !== extendedUser?.email) {
          changes.email = extendedUser?.email
        }
        if (previousUser?.role !== extendedUser?.role) {
          changes.role = extendedUser?.role
        }

        // Notify profile update listeners
        if (Object.keys(changes).length > 0) {
          const event: UserProfileUpdateEvent = {
            userId: user.id,
            changes,
            source: 'SUPABASE'
          }
          
          this.profileUpdateListeners.forEach(listener => {
            try {
              listener(event)
            } catch (error) {
              console.error('Profile update listener error:', error)
            }
          })
        }

        this.lastProfileUpdate = Date.now()
      } catch (error) {
        console.error('Error handling user update:', error)
      }
    }, this.config.profileUpdateDebounceMs)
  }

  // Handle password recovery
  private async handlePasswordRecovery(): Promise<void> {
    console.log('🔐 Password recovery initiated')
    // Could implement additional logic here if needed
  }

  // Setup cross-tab event listeners
  private setupCrossTabListeners(): void {
    // Listen for auth changes from other tabs
    const authChangeCleanup = this.sessionStorage.onCrossTabEvent('AUTH_CHANGE', (event: CrossTabEvent) => {
      console.log('🔄 Cross-tab auth change detected:', event.data?.type)
      
      if (event.data?.type === 'SIGNED_IN' && event.data?.user && typeof event.data.user === 'object') {
        this.currentUser = event.data.user as AuthUser
      }
    })

    // Listen for sign out from other tabs
    const signOutCleanup = this.sessionStorage.onCrossTabEvent('SIGN_OUT', () => {
      console.log('🚪 Cross-tab sign out detected')
      this.currentUser = null
      this.stopTokenMonitoring()
    })

    // Listen for token updates from other tabs
    const tokenUpdateCleanup = this.sessionStorage.onCrossTabEvent('TOKEN_UPDATE', (event: CrossTabEvent) => {
      console.log('🔄 Cross-tab token update:', event.data?.success ? 'success' : 'failed')
    })

    this.crossTabCleanups.push(authChangeCleanup, signOutCleanup, tokenUpdateCleanup)
  }

  // Start token expiry monitoring
  private startTokenMonitoring(): void {
    if (this.tokenMonitorTimer) return

    this.tokenMonitorTimer = setInterval(async () => {
      await this.checkTokenExpiry()
    }, 60000) // Check every minute

    console.log('⏰ Token expiry monitoring started')
  }

  // Stop token expiry monitoring
  private stopTokenMonitoring(): void {
    if (this.tokenMonitorTimer) {
      clearInterval(this.tokenMonitorTimer)
      this.tokenMonitorTimer = undefined
    }
  }

  // Check for token expiry and emit warnings
  private async checkTokenExpiry(): Promise<void> {
    if (!this.currentUser?.id) return

    try {
      const health = await auth.checkTokenHealth(this.currentUser.id)
      
      if (!health?.expires_at) return

      const expiresAt = new Date(health.expires_at)
      const now = new Date()
      const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60)

      // Check if we should emit a warning
      for (const threshold of this.config.tokenExpiryWarningMinutes) {
        if (minutesUntilExpiry <= threshold && minutesUntilExpiry > threshold - 1) {
          const severity = threshold <= 5 ? 'CRITICAL' : threshold <= 10 ? 'WARNING' : 'INFO'
          
          const event: TokenExpiryEvent = {
            userId: this.currentUser.id,
            expiresAt,
            minutesUntilExpiry,
            severity
          }

          console.log(`⏰ Token expiry warning: ${minutesUntilExpiry.toFixed(1)} minutes remaining`)
          
          this.tokenExpiryListeners.forEach(listener => {
            try {
              listener(event)
            } catch (error) {
              console.error('Token expiry listener error:', error)
            }
          })
          
          break // Only emit one warning per check
        }
      }
    } catch (error) {
      console.error('Error checking token expiry:', error)
    }
  }

  // Setup connection monitoring
  private setupConnectionMonitoring(): void {
    const handleOnline = () => {
      this.connectionStatus = true
      console.log('🌐 Connection restored')
      this.notifyConnectionListeners(true)
    }

    const handleOffline = () => {
      this.connectionStatus = false
      console.log('📴 Connection lost')
      this.notifyConnectionListeners(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic connection check
    this.connectionCheckTimer = setInterval(() => {
      const isOnline = navigator.onLine
      if (isOnline !== this.connectionStatus) {
        this.connectionStatus = isOnline
        this.notifyConnectionListeners(isOnline)
      }
    }, this.config.connectionCheckIntervalMs)
  }

  // Notify connection status listeners
  private notifyConnectionListeners(isOnline: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(isOnline)
      } catch (error) {
        console.error('Connection listener error:', error)
      }
    })
  }

  // Public API for adding event listeners
  onAuthStateChange(listener: AuthEventListener): () => void {
    this.authListeners.push(listener)
    return () => {
      const index = this.authListeners.indexOf(listener)
      if (index > -1) this.authListeners.splice(index, 1)
    }
  }

  onTokenExpiry(listener: TokenExpiryListener): () => void {
    this.tokenExpiryListeners.push(listener)
    return () => {
      const index = this.tokenExpiryListeners.indexOf(listener)
      if (index > -1) this.tokenExpiryListeners.splice(index, 1)
    }
  }

  onProfileUpdate(listener: ProfileUpdateListener): () => void {
    this.profileUpdateListeners.push(listener)
    return () => {
      const index = this.profileUpdateListeners.indexOf(listener)
      if (index > -1) this.profileUpdateListeners.splice(index, 1)
    }
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.push(listener)
    return () => {
      const index = this.connectionListeners.indexOf(listener)
      if (index > -1) this.connectionListeners.splice(index, 1)
    }
  }

  // Get current state
  getCurrentState(): {
    user: AuthUser | null
    isOnline: boolean
    lastProfileUpdate: number
  } {
    return {
      user: this.currentUser,
      isOnline: this.connectionStatus,
      lastProfileUpdate: this.lastProfileUpdate
    }
  }

  // Cleanup
  destroy(): void {
    // Stop timers
    this.stopTokenMonitoring()
    
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer)
    }

    if (this.profileUpdateDebounceTimer) {
      clearTimeout(this.profileUpdateDebounceTimer)
    }

    // Clean up Supabase subscription
    if (this.supabaseSubscription) {
      this.supabaseSubscription.data.subscription.unsubscribe()
    }

    // Clean up cross-tab listeners
    this.crossTabCleanups.forEach(cleanup => cleanup())

    // Clear listeners
    this.authListeners = []
    this.tokenExpiryListeners = []
    this.profileUpdateListeners = []
    this.connectionListeners = []

    console.log('🧹 Auth event handler destroyed')
  }
}

// Singleton instance
let eventHandler: AuthEventHandler | null = null

export function getAuthEventHandler(config?: Partial<AuthEventHandlerConfig>): AuthEventHandler {
  if (typeof window === 'undefined') {
    // Return a mock instance for SSR
    return {
      onAuthStateChange: () => () => {},
      onTokenExpiry: () => () => {},
      onProfileUpdate: () => () => {},
      onConnectionChange: () => () => {},
      getCurrentState: () => ({ user: null, isOnline: true, lastProfileUpdate: 0 }),
      destroy: () => {}
    } as Partial<AuthEventHandler> as AuthEventHandler
  }

  if (!eventHandler) {
    eventHandler = new AuthEventHandler(config)
  }
  
  return eventHandler
}

export type { 
  AuthEventData, 
  TokenExpiryEvent, 
  UserProfileUpdateEvent,
  AuthEventListener,
  TokenExpiryListener,
  ProfileUpdateListener,
  ConnectionListener,
  AuthEventHandlerConfig 
}
export { AuthEventHandler }