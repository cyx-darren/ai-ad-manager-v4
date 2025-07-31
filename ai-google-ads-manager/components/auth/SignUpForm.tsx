'use client'

import { useState, useEffect, useCallback } from 'react'
import { auth } from '@/lib/auth'

interface SignUpFormProps {
  onCancel?: () => void
  className?: string
  onSuccess?: () => void
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  terms?: string
  general?: string
}

interface ValidationResult {
  isValid: boolean
  errors: FormErrors
}

export default function SignUpForm({ onCancel, className, onSuccess }: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Load saved form data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('signup_form_draft')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setEmail(parsed.email || '')
        setAcceptTerms(parsed.acceptTerms || false)
      } catch (error) {
        console.error('Failed to parse saved form data:', error)
      }
    }
  }, [])

  // Save form data to localStorage (excluding passwords for security)
  const saveFormDraft = useCallback(() => {
    const draftData = {
      email,
      acceptTerms,
      timestamp: Date.now()
    }
    localStorage.setItem('signup_form_draft', JSON.stringify(draftData))
  }, [email, acceptTerms])

  // Auto-save form data
  useEffect(() => {
    const timer = setTimeout(saveFormDraft, 1000)
    return () => clearTimeout(timer)
  }, [saveFormDraft])

  // Email validation with real-time feedback
  const validateEmail = useCallback((email: string): string | undefined => {
    if (!email) {
      return 'Email address is required'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address'
    }

    // Check for common email providers
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && !commonProviders.includes(domain) && !domain.includes('.')) {
      return 'Please check your email domain'
    }

    return undefined
  }, [])

  // Password validation with detailed requirements
  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) {
      return 'Password is required'
    }

    const minLength = 8
    if (password.length < minLength) {
      return `Password must be at least ${minLength} characters long`
    }

    const requirements = [
      { regex: /[A-Z]/, message: 'one uppercase letter' },
      { regex: /[a-z]/, message: 'one lowercase letter' },
      { regex: /[0-9]/, message: 'one number' },
      { regex: /[^A-Za-z0-9]/, message: 'one special character' }
    ]

    const missingRequirements = requirements
      .filter(req => !req.regex.test(password))
      .map(req => req.message)

    if (missingRequirements.length > 0) {
      return `Password must contain ${missingRequirements.join(', ')}`
    }

    // Check for common weak passwords
    const weakPatterns = [
      /^password/i,
      /^123456/,
      /^qwerty/i,
      /^admin/i,
      /(.)\1{2,}/ // repeated characters
    ]

    if (weakPatterns.some(pattern => pattern.test(password))) {
      return 'Please choose a stronger password'
    }

    return undefined
  }, [])

  // Comprehensive form validation
  const validateForm = useCallback((): ValidationResult => {
    const newErrors: FormErrors = {}

    // Email validation
    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError

    // Password validation
    const passwordError = validatePassword(password)
    if (passwordError) newErrors.password = passwordError

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    // Terms validation
    if (!acceptTerms) {
      newErrors.terms = 'You must accept the terms and conditions'
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    }
  }, [email, password, confirmPassword, acceptTerms, validateEmail, validatePassword])

  // Real-time validation
  useEffect(() => {
    if (isSubmitted || Object.keys(touched).length > 0) {
      const { errors } = validateForm()
      setErrors(errors)
    }
  }, [email, password, confirmPassword, acceptTerms, isSubmitted, touched, validateForm])

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return Math.min(strength, 5)
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)
    
    const { isValid, errors } = validateForm()
    setErrors(errors)
    
    if (!isValid) {
      // Focus first field with error
      const firstErrorField = Object.keys(errors)[0]
      const element = document.getElementById(firstErrorField)
      element?.focus()
      return
    }

    setIsLoading(true)
    try {
      // For now, we'll show a message that email signup is not implemented
      console.log('Email signup:', { email, password })
      setErrors({ general: 'Email signup not yet implemented. Please use Google OAuth.' })
      
      // Clear form draft on successful submission
      localStorage.removeItem('signup_form_draft')
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Signup error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account. Please try again.'
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const clearForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setAcceptTerms(false)
    setErrors({})
    setTouched({})
    setIsSubmitted(false)
    localStorage.removeItem('signup_form_draft')
  }

  const getFieldError = (fieldName: keyof FormErrors) => {
    return (touched[fieldName] || isSubmitted) ? errors[fieldName] : undefined
  }

  return (
    <div className={`card ${className || ''}`}>
      <div className="card-header">
        <h2 className="card-title text-2xl">Create Account</h2>
        <p className="card-description">
          Sign up for your AI Ad Manager account
        </p>
      </div>

      <div className="card-content">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="label">
              Email Address *
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                onBlur={() => handleFieldBlur('email')}
                className={`input ${getFieldError('email') ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                placeholder="Enter your email address"
                disabled={isLoading}
                required
                autoComplete="email"
                aria-describedby={getFieldError('email') ? 'email-error' : undefined}
              />
              {email && !getFieldError('email') && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {getFieldError('email') && (
              <p id="email-error" className="text-sm text-red-600" role="alert">
                {getFieldError('email')}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="label">
              Password *
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleFieldBlur('password')}
                className={`input pr-10 ${getFieldError('password') ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                placeholder="Create a strong password"
                disabled={isLoading}
                required
                autoComplete="new-password"
                aria-describedby={getFieldError('password') ? 'password-error' : 'password-help'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L18.364 18.364m-8.486-8.486l-2.828-2.828m4.242 4.242L9.878 9.878m8.486 8.486L16.95 19.778" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-2">
                <div className="flex space-x-1" role="progressbar" aria-valuenow={passwordStrength} aria-valuemax={5}>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={`h-2 w-full rounded-full transition-all duration-200 ${
                        index < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                  Password strength: {strengthLabels[passwordStrength - 1] || 'Very Weak'}
                </p>
              </div>
            )}

            {getFieldError('password') ? (
              <p id="password-error" className="text-sm text-red-600" role="alert">
                {getFieldError('password')}
              </p>
            ) : password && (
              <div id="password-help" className="text-xs text-gray-600">
                Password requirements:
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>One uppercase letter</li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>One lowercase letter</li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>One number</li>
                  <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>One special character</li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="label">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleFieldBlur('confirmPassword')}
                className={`input pr-10 ${getFieldError('confirmPassword') ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                placeholder="Confirm your password"
                disabled={isLoading}
                required
                autoComplete="new-password"
                aria-describedby={getFieldError('confirmPassword') ? 'confirm-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L18.364 18.364m-8.486-8.486l-2.828-2.828m4.242 4.242L9.878 9.878m8.486 8.486L16.95 19.778" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
              {confirmPassword && password === confirmPassword && (
                <div className="absolute inset-y-0 right-8 flex items-center pr-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {getFieldError('confirmPassword') && (
              <p id="confirm-password-error" className="text-sm text-red-600" role="alert">
                {getFieldError('confirmPassword')}
              </p>
            )}
          </div>

          {/* Terms Acceptance */}
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                onBlur={() => handleFieldBlur('terms')}
                className={`mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${getFieldError('terms') ? 'border-red-500' : ''}`}
                disabled={isLoading}
                required
                aria-describedby={getFieldError('terms') ? 'terms-error' : undefined}
              />
              <label htmlFor="acceptTerms" className="text-sm text-muted-foreground">
                I accept the{' '}
                <a href="/terms" className="text-saas-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Terms and Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-saas-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
              </label>
            </div>
            {getFieldError('terms') && (
              <p id="terms-error" className="text-sm text-red-600" role="alert">
                {getFieldError('terms')}
              </p>
            )}
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4" role="alert">
              <p className="text-sm text-red-600">{errors.general}</p>
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
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
            
            <div className="flex gap-2">
              {(email || password || confirmPassword) && (
                <button
                  type="button"
                  onClick={clearForm}
                  disabled={isLoading}
                  className="btn btn-ghost"
                >
                  Clear
                </button>
              )}
              
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Alternative Sign-Up Options */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-center text-sm text-muted-foreground mb-4">
            Or sign up with
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => auth.signInWithGoogle()}
              className="btn btn-outline"
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 