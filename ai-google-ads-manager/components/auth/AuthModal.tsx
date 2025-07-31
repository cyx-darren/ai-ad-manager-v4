'use client'

import { useState, useEffect } from 'react'
import LoginButton from './LoginButton'
import SignUpForm from './SignUpForm'
import ForgotPasswordForm from './ForgotPasswordForm'

type AuthModalMode = 'login' | 'signup' | 'forgot-password'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthModalMode
  onSuccess?: () => void
  className?: string
}

export default function AuthModal({ 
  isOpen, 
  onClose, 
  initialMode = 'login', 
  onSuccess,
  className 
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSuccess = () => {
    onClose()
    if (onSuccess) {
      onSuccess()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot-password' && 'Reset Password'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'login' && (
            <div className="space-y-6">
              {/* Google OAuth Login */}
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Sign in to your AI Ad Manager account
                </p>
                <LoginButton 
                  className="w-full justify-center"
                  redirectTo="/dashboard"
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Email/Password Login Placeholder */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="Enter your email"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter your password"
                    disabled
                  />
                </div>
                <button 
                  className="btn btn-primary w-full"
                  disabled
                >
                  Sign In with Email (Coming Soon)
                </button>
              </div>

              {/* Footer Links */}
              <div className="space-y-4 text-center">
                <button
                  onClick={() => setMode('forgot-password')}
                  className="text-saas-primary hover:underline text-sm"
                >
                  Forgot your password?
                </button>
                
                <div className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-saas-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-6">
              <SignUpForm 
                onCancel={() => setMode('login')}
                className="!p-0 !shadow-none !border-0 !bg-transparent"
              />
              
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-saas-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {mode === 'forgot-password' && (
            <div className="space-y-6">
              <ForgotPasswordForm 
                onSuccess={handleSuccess}
                onCancel={() => setMode('login')}
                className="!p-0 !shadow-none !border-0 !bg-transparent"
              />
              
              <div className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-saas-primary hover:underline font-medium"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook for easier modal management
export function useAuthModal(initialMode: AuthModalMode = 'login') {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<AuthModalMode>(initialMode)

  const openModal = (newMode?: AuthModalMode) => {
    if (newMode) setMode(newMode)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
  }

  const switchMode = (newMode: AuthModalMode) => {
    setMode(newMode)
  }

  return {
    isOpen,
    mode,
    openModal,
    closeModal,
    switchMode,
    AuthModal: (props: Omit<AuthModalProps, 'isOpen' | 'onClose'>) => (
      <AuthModal 
        {...props} 
        isOpen={isOpen} 
        onClose={closeModal}
        initialMode={mode}
      />
    )
  }
} 