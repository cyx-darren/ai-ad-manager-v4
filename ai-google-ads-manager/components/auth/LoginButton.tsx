'use client'

import { useState, useEffect } from 'react'
import { auth } from '@/lib/auth'
import { authSecurity, formatRemainingTime } from '@/lib/auth-security'

interface LoginButtonProps {
  redirectTo?: string
  className?: string
  rememberMe?: boolean
  showRememberMe?: boolean
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onSuccess?: () => void
  onError?: (error: string) => void
}

export default function LoginButton({ 
  redirectTo, 
  className,
  rememberMe = false,
  showRememberMe = false,
  variant = 'primary',
  size = 'md',
  onSuccess,
  onError
}: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [shouldRemember, setShouldRemember] = useState(rememberMe)
  const [error, setError] = useState('')
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitResetTime, setRateLimitResetTime] = useState<number | undefined>()
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>()

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  const variantClasses = {
    primary: 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-lg hover:shadow-xl',
    outline: 'border-2 border-purple-600 bg-transparent text-purple-600 hover:bg-purple-600 hover:text-white',
    ghost: 'bg-transparent text-purple-600 hover:bg-purple-50'
  }

  // Check rate limit status on component mount and when needed
  useEffect(() => {
    const checkRateLimit = () => {
      const identifier = 'login_attempt' // You could use user IP or session ID
      const status = authSecurity.getRateLimitStatus(identifier, 'login')
      
      setIsRateLimited(status.isLimited)
      setRateLimitResetTime(status.resetTime)
      setRemainingAttempts(status.remainingAttempts)
    }

    checkRateLimit()
    
    // Check periodically if rate limited
    const interval = isRateLimited ? setInterval(checkRateLimit, 1000) : null
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRateLimited])

  const handleGoogleLogin = async () => {
    if (isLoading) return

    const identifier = 'login_attempt' // In production, use user IP or session ID
    
    // Check rate limit before attempting
    const rateLimitCheck = authSecurity.checkRateLimit(identifier, 'login')
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetTime || Date.now()
      const waitTime = Math.max(0, resetTime - Date.now())
      setIsRateLimited(true)
      setRateLimitResetTime(resetTime)
      setError(`Too many login attempts. Please try again in ${formatRemainingTime(waitTime)}.`)
      return
    }

    try {
      setIsLoading(true)
      setError('')
      
      const { error } = await auth.signInWithGoogle(redirectTo)
      
      if (error) {
        const errorMessage = error.message || 'Failed to sign in with Google'
        setError(errorMessage)
        
        // Record failed attempt
        authSecurity.recordAttempt(identifier, 'login', false, {
          error: errorMessage,
          userAgent: navigator.userAgent
        })
        
        // Update rate limit status
        const newStatus = authSecurity.getRateLimitStatus(identifier, 'login')
        setRemainingAttempts(newStatus.remainingAttempts)
        
        if (onError) {
          onError(errorMessage)
        }
      } else {
        // Success - store remember me preference if enabled
        if (shouldRemember) {
          localStorage.setItem('auth_remember_me', 'true')
        } else {
          localStorage.removeItem('auth_remember_me')
        }
        
        // Record successful attempt
        authSecurity.recordAttempt(identifier, 'login', true, {
          rememberMe: shouldRemember
        })
        
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      console.error('Login error:', error)
      setError(errorMessage)
      
      // Record failed attempt
      authSecurity.recordAttempt(identifier, 'login', false, {
        error: errorMessage,
        userAgent: navigator.userAgent
      })
      
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleGoogleLogin()
    }
  }

  return (
    <div className="w-full space-y-4">
      <button
        onClick={handleGoogleLogin}
        onKeyDown={handleKeyDown}
        disabled={isLoading || isRateLimited}
        className={`
          w-full
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          inline-flex items-center justify-center
          font-semibold rounded-xl
          focus:outline-none focus:ring-4 focus:ring-purple-500/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 ease-out
          ${isLoading ? 'transform scale-95' : 'hover:scale-[1.02] active:scale-95'}
          ${className || ''}
        `}
        aria-label={isLoading ? 'Signing in...' : 'Sign in with Google'}
        role="button"
        tabIndex={0}
      >
        {isLoading ? (
          <>
            <svg 
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <svg 
              className="w-5 h-5 mr-3 flex-shrink-0" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                fill="#4285F4" 
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path 
                fill="#34A853" 
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path 
                fill="#FBBC05" 
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path 
                fill="#EA4335" 
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      {showRememberMe && (
        <div className="flex items-center justify-center space-x-3 py-2">
          <div className="relative flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={shouldRemember}
              onChange={(e) => setShouldRemember(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 text-purple-600 bg-white border-2 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <svg 
              className={`absolute inset-0 h-4 w-4 text-white pointer-events-none transition-opacity duration-200 ${shouldRemember ? 'opacity-100' : 'opacity-0'}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          <label 
            htmlFor="remember-me" 
            className="text-sm font-medium text-gray-700 select-none cursor-pointer transition-colors duration-200 hover:text-gray-900"
          >
            Keep me signed in
          </label>
        </div>
      )}

      {error && (
        <div 
          className="p-4 bg-red-50 border-l-4 border-red-400 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start">
            <svg 
              className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">
                Sign-in failed
              </p>
              <p className="text-sm text-red-700 mt-1">
                {error}
              </p>
              {!isRateLimited && remainingAttempts && remainingAttempts > 0 && (
                <button
                  onClick={() => {
                    setError('')
                    handleGoogleLogin()
                  }}
                  className="text-sm text-red-700 hover:text-red-900 underline mt-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded transition-colors duration-200"
                >
                  Try again ({remainingAttempts} attempts remaining)
                </button>
              )}
              {isRateLimited && rateLimitResetTime && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  Rate limited. Try again in {formatRemainingTime(Math.max(0, rateLimitResetTime - Date.now()))}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-1000 ease-out animate-pulse"
            style={{ width: '70%' }}
          />
        </div>
      )}
    </div>
  )
} 