'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/auth'

interface AutoSignOutHandlerProps {
  children: React.ReactNode
  
  // Automatic sign-out configuration
  enableAutoSignOut?: boolean
  sessionTimeoutMinutes?: number
  warningMinutes?: number
  
  // Event handling
  onTokenExpiry?: () => void
  onSessionTimeout?: () => void
  onSecurityEvent?: () => void
  onAutoSignOut?: (reason: string) => void
  
  // UI configuration
  showWarnings?: boolean
  redirectTo?: string
}

interface WarningToastProps {
  show: boolean
  message: string
  timeLeft: number
  onExtend: () => void
  onSignOut: () => void
}

const WarningToast: React.FC<WarningToastProps> = ({
  show,
  message,
  timeLeft,
  onExtend,
  onSignOut
}) => {
  if (!show) return null

  return (
    <div className="fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-start">
        <div className="w-5 h-5 text-yellow-400 mr-3 mt-0.5">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-800 mb-1">
            Session Expiring Soon
          </h4>
          <p className="text-sm text-yellow-700 mb-3">
            {message}
          </p>
          <div className="text-xs text-yellow-600 mb-3">
            Time remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onExtend}
              className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded border border-yellow-300"
            >
              Stay Signed In
            </button>
            <button
              onClick={onSignOut}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded border border-red-300"
            >
              Sign Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AutoSignOutHandler: React.FC<AutoSignOutHandlerProps> = ({
  children,
  enableAutoSignOut = true,
  sessionTimeoutMinutes = 30,
  warningMinutes = 5,
  onTokenExpiry,
  onSessionTimeout,
  onSecurityEvent,
  onAutoSignOut,
  showWarnings = true,
  redirectTo = '/auth/login'
}) => {
  const { user } = useAuth()
  const router = useRouter()
  
  // State for session management
  const [showWarning, setShowWarning] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState(0)
  const lastActivityRef = useRef<number>(Date.now())
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  // Update last activity time
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Handle automatic sign-out
  const handleAutoSignOut = useCallback(async (reason: 'token_expired' | 'session_timeout' | 'security') => {
    console.log('🚨 Auto sign-out triggered:', reason)
    
    try {
      await auth.tokenExpirySignOut()
      onAutoSignOut?.(reason)
      
      // Clear all timers
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      
      setShowWarning(false)
      router.push(`${redirectTo}?reason=${reason}`)
    } catch (error) {
      console.error('Auto sign-out error:', error)
    }
  }, [onAutoSignOut, redirectTo, router])

  // Handle session warning
  const handleSessionWarning = useCallback(() => {
    if (!showWarnings) {
      handleAutoSignOut('session_timeout')
      return
    }

    setShowWarning(true)
    setTimeLeft(warningMinutes * 60)
    onSessionTimeout?.()

    // Start countdown
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoSignOut('session_timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto sign-out after warning period
    warningTimeoutRef.current = setTimeout(() => {
      handleAutoSignOut('session_timeout')
    }, warningMinutes * 60 * 1000)
  }, [showWarnings, warningMinutes, handleAutoSignOut, onSessionTimeout])

  // Extend session
  const extendSession = useCallback(() => {
    console.log('📈 Session extended by user')
    updateActivity()
    setShowWarning(false)
    
    // Clear existing timers
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    
    // Restart session timer
    setupSessionTimer()
  }, [updateActivity])

  // Setup session timer
  const setupSessionTimer = useCallback(() => {
    if (!enableAutoSignOut || !user) return

    // Clear existing timer
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)

    const sessionDuration = sessionTimeoutMinutes * 60 * 1000
    const warningDuration = warningMinutes * 60 * 1000

    // Set timer for warning
    sessionTimeoutRef.current = setTimeout(() => {
      handleSessionWarning()
    }, sessionDuration - warningDuration)

    console.log(`⏱️ Session timer set for ${sessionTimeoutMinutes} minutes`)
  }, [enableAutoSignOut, user, sessionTimeoutMinutes, warningMinutes, handleSessionWarning])

  // Monitor token validity - disabled for now since isTokenValid is not available
  // useEffect(() => {
  //   if (!user || !enableAutoSignOut) return
  //   // Token validity check would go here
  // }, [user, enableAutoSignOut, handleAutoSignOut, onTokenExpiry])

  // Setup session management
  useEffect(() => {
    if (!user || !enableAutoSignOut) return

    setupSessionTimer()

    // Activity listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      updateActivity()
      
      // If warning is showing and user is active, extend session
      if (showWarning) {
        extendSession()
      }
    }

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, true)
    })

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity, true)
      })
      
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [user, enableAutoSignOut, setupSessionTimer, updateActivity, showWarning, extendSession])

  // Listen for security events (from other parts of the app)
  useEffect(() => {
    const handleSecurityEvent = () => {
      console.log('🚨 Security event detected, triggering sign-out')
      handleAutoSignOut('security')
      onSecurityEvent?.()
    }

    // Listen for custom security events
    window.addEventListener('auth:security-event', handleSecurityEvent)
    
    return () => {
      window.removeEventListener('auth:security-event', handleSecurityEvent)
    }
  }, [handleAutoSignOut, onSecurityEvent])

  // Manual sign-out from warning
  const handleManualSignOut = useCallback(() => {
    handleAutoSignOut('session_timeout')
  }, [handleAutoSignOut])

  return (
    <>
      {children}
      
      <WarningToast
        show={showWarning}
        message="Your session will expire soon due to inactivity."
        timeLeft={timeLeft}
        onExtend={extendSession}
        onSignOut={handleManualSignOut}
      />
    </>
  )
}

// Hook for triggering security events
export const useSecuritySignOut = () => {
  const triggerSecuritySignOut = useCallback(() => {
    const event = new CustomEvent('auth:security-event')
    window.dispatchEvent(event)
  }, [])

  return { triggerSecuritySignOut }
}

export default AutoSignOutHandler