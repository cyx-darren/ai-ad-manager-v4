'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ResetPasswordFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  className?: string
}

export default function ResetPasswordForm({ onSuccess, onCancel, className }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)
  const [isCheckingToken, setIsCheckingToken] = useState(true)

  const router = useRouter()

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']

  // Check if we have valid session from reset link
  useEffect(() => {
    const checkResetToken = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session check error:', error)
          setError('Invalid or expired reset link')
          setIsValidToken(false)
        } else if (session) {
          setIsValidToken(true)
        } else {
          setError('No active reset session found')
          setIsValidToken(false)
        }
      } catch (error) {
        console.error('Error checking reset token:', error)
        setError('Failed to validate reset link')
        setIsValidToken(false)
      } finally {
        setIsCheckingToken(false)
      }
    }

    checkResetToken()
  }, [])

  const validateForm = () => {
    if (!password || !confirmPassword) {
      setError('Both password fields are required')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    if (passwordStrength < 3) {
      setError('Password is too weak. Use at least 8 characters with uppercase, lowercase, and numbers.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) return

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)
      
      // Auto-redirect after success
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/')
        }
      }, 3000)
    } catch (error: unknown) {
      console.error('Password reset error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state while checking token
  if (isCheckingToken) {
    return (
      <div className={`card ${className || ''}`}>
        <div className="card-content text-center py-12">
          <div className="animate-spin mx-auto mb-4 w-8 h-8 border-4 border-saas-primary border-t-transparent rounded-full"></div>
          <p className="text-muted-foreground">Validating reset link...</p>
        </div>
      </div>
    )
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className={`card ${className || ''}`}>
        <div className="card-content text-center py-12">
          {/* Error Icon */}
          <div className="mx-auto mb-6 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Reset Link
          </h2>
          
          <p className="text-gray-600 mb-6">
            {error || 'This password reset link is invalid or has expired.'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/auth/forgot-password')}
              className="btn btn-primary"
            >
              Request New Reset Link
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="btn btn-outline"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Success state
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
            Password Reset Successful
          </h2>
          
          <p className="text-gray-600 mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          
          <p className="text-sm text-gray-500 mb-6">
            Redirecting you to the dashboard in a few seconds...
          </p>
          
          <button
            onClick={() => router.push('/')}
            className="btn btn-primary"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Main reset form
  return (
    <div className={`card ${className || ''}`}>
      <div className="card-header">
        <h2 className="card-title text-2xl">Reset Your Password</h2>
        <p className="card-description">
          Enter your new password below
        </p>
      </div>

      <div className="card-content">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="label">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your new password"
              disabled={isLoading}
              required
              autoFocus
            />
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-2">
                <div className="flex space-x-1">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={`h-2 w-full rounded-full ${
                        index < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                      } transition-all duration-200`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                  Password strength: {strengthLabels[passwordStrength - 1] || 'Very Weak'}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="label">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Confirm your new password"
              disabled={isLoading}
              required
            />
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
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
            
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="btn btn-outline flex-1"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Password Requirements */}
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Password Requirements:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center">
              <span className={`w-4 h-4 mr-2 rounded-full text-xs flex items-center justify-center ${password.length >= 8 ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                {password.length >= 8 ? '✓' : ''}
              </span>
              At least 8 characters
            </li>
            <li className="flex items-center">
              <span className={`w-4 h-4 mr-2 rounded-full text-xs flex items-center justify-center ${/[A-Z]/.test(password) ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                {/[A-Z]/.test(password) ? '✓' : ''}
              </span>
              One uppercase letter
            </li>
            <li className="flex items-center">
              <span className={`w-4 h-4 mr-2 rounded-full text-xs flex items-center justify-center ${/[a-z]/.test(password) ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                {/[a-z]/.test(password) ? '✓' : ''}
              </span>
              One lowercase letter
            </li>
            <li className="flex items-center">
              <span className={`w-4 h-4 mr-2 rounded-full text-xs flex items-center justify-center ${/[0-9]/.test(password) ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                {/[0-9]/.test(password) ? '✓' : ''}
              </span>
              One number
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
} 