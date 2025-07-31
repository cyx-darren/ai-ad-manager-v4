'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  className?: string
}

export default function ForgotPasswordForm({ onSuccess, onCancel, className }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email) {
      setError('Email address is required')
      return
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)
      if (onSuccess) {
        setTimeout(onSuccess, 3000) // Auto-close after 3 seconds
      }
    } catch (error: unknown) {
      console.error('Password reset error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className={`card ${className || ''}`}>
        <div className="card-content text-center py-12">
          {/* Success Icon */}
          <div className="mx-auto mb-6 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Check Your Email
          </h2>
          
          <p className="text-gray-600 mb-6">
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Didn&apos;t receive the email? Check your spam folder or click below to try again.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setIsSuccess(false)
                  setEmail('')
                }}
                className="btn btn-outline"
              >
                Try Again
              </button>
              
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="btn btn-ghost"
                >
                  Back to Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className || ''}`}>
      <div className="card-header">
        <h2 className="card-title text-2xl">Reset Password</h2>
        <p className="card-description">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      <div className="card-content">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="Enter your email address"
              disabled={isLoading}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll send a password reset link to this email address
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex-1"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending Reset Link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
            
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="btn btn-outline flex-1"
              >
                Back to Login
              </button>
            )}
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Remember your password?
            </p>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-saas-primary hover:underline text-sm font-medium"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 