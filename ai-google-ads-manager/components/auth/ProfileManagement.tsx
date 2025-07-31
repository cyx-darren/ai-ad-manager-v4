'use client'

import { useState, useEffect } from 'react'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'

interface ProfileManagementProps {
  user: AuthUser
  className?: string
}

export default function ProfileManagement({ user, className }: ProfileManagementProps) {
  const [email, setEmail] = useState(user?.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    setEmail(user?.email || '')
  }, [user])

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(newPassword)
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')

    if (!email || email === user?.email) {
      setEmailError('Please enter a new email address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setIsUpdatingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email })

      if (error) {
        throw error
      }

      setEmailSuccess('Verification email sent to your new address. Please check your inbox.')
    } catch (error: unknown) {
      console.error('Email update error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update email. Please try again.'
      setEmailError(errorMessage)
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordStrength < 3) {
      setPasswordError('Password is too weak. Use at least 8 characters with uppercase, lowercase, and numbers.')
      return
    }

    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      setPasswordSuccess('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: unknown) {
      console.error('Password update error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password. Please try again.'
      setPasswordError(errorMessage)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      return
    }

    try {
      // Note: Supabase doesn't have direct account deletion from client
      // This would typically involve a server-side API call
      console.log('Account deletion requested')
      alert('Account deletion functionality would be implemented server-side for security.')
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    } catch (error) {
      console.error('Account deletion error:', error)
    }
  }

  return (
    <div className={`space-y-8 ${className || ''}`}>
      {/* Profile Overview */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title text-2xl">Profile Settings</h2>
          <p className="card-description">
            Manage your account information and preferences
          </p>
        </div>

        <div className="card-content">
          <div className="flex items-center space-x-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-saas-primary to-saas-accent rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">
                {user?.email}
              </h3>
              <p className="text-sm text-muted-foreground">
                Role: <span className="capitalize font-medium">{user?.role || 'User'}</span>
              </p>
              <div className="flex items-center mt-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-green-600 font-medium">Google Account Linked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Update */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-xl font-semibold text-gray-900">Email Address</h3>
                     <p className="text-sm text-muted-foreground">
             Update your email address. You&apos;ll need to verify the new email.
           </p>
        </div>

        <div className="card-content">
          <form onSubmit={handleEmailUpdate} className="space-y-4">
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
                placeholder="Enter new email address"
                disabled={isUpdatingEmail}
              />
            </div>

            {emailError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{emailError}</p>
              </div>
            )}

            {emailSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-600">{emailSuccess}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdatingEmail || email === user?.email}
              className="btn btn-primary"
            >
              {isUpdatingEmail ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating Email...
                </>
              ) : (
                'Update Email'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Password Update */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-xl font-semibold text-gray-900">Change Password</h3>
          <p className="text-sm text-muted-foreground">
            Update your password to keep your account secure
          </p>
        </div>

        <div className="card-content">
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="Enter new password"
                disabled={isUpdatingPassword}
              />
              
              {/* Password Strength Indicator */}
              {newPassword && (
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
                placeholder="Confirm new password"
                disabled={isUpdatingPassword}
              />
            </div>

            {passwordError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-600">{passwordSuccess}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="btn btn-primary"
            >
              {isUpdatingPassword ? (
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
          </form>
        </div>
      </div>

      {/* Account Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-xl font-semibold text-gray-900">Account Actions</h3>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="card-content space-y-4">
          {/* Sign Out */}
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h4 className="font-semibold text-gray-900">Sign Out</h4>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="btn btn-outline"
            >
              {isSigningOut ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing Out...
                </>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>

          {/* Delete Account */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-red-900">Delete Account</h4>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn btn-destructive ml-4"
              >
                Delete Account
              </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Confirm Account Deletion
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This action will permanently delete your account and all associated data. 
                    Type <strong>DELETE</strong> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="input mb-4"
                    placeholder="Type DELETE to confirm"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirmText('')
                      }}
                      className="btn btn-outline flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="btn btn-destructive flex-1"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 