'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/auth'

interface SignOutButtonProps {
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  showConfirmation?: boolean
  includeAllDevices?: boolean
  redirectTo?: string
  onSignOutStart?: () => void
  onSignOutComplete?: (success: boolean) => void
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (fromAllDevices: boolean) => void
  includeAllDevices: boolean
  loading: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  includeAllDevices,
  loading
}) => {
  const [signOutFromAll, setSignOutFromAll] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 text-orange-500 mr-3">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Confirm Sign Out</h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to sign out? You'll need to sign in again to access your account.
        </p>
        
        {includeAllDevices && (
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={signOutFromAll}
                onChange={(e) => setSignOutFromAll(e.target.checked)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={loading}
              />
              <span className="ml-2 text-sm text-gray-700">
                Sign out from all devices
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              This will end your session on all devices and browsers
            </p>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(signOutFromAll)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export const SignOutButton: React.FC<SignOutButtonProps> = ({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  showConfirmation = true,
  includeAllDevices = false,
  redirectTo = '/',
  onSignOutStart,
  onSignOutComplete
}) => {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const getVariantClasses = () => {
    const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    switch (variant) {
      case 'ghost':
        return `${baseClasses} text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500`
      case 'destructive':
        return `${baseClasses} text-white bg-red-600 hover:bg-red-700 focus:ring-red-500`
      case 'outline':
        return `${baseClasses} text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500`
      default:
        return `${baseClasses} text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500`
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm'
      case 'lg':
        return 'px-6 py-3 text-lg'
      default:
        return 'px-4 py-2 text-sm'
    }
  }

  const handleSignOut = async (fromAllDevices: boolean = false) => {
    if (!user) return

    try {
      setLoading(true)
      onSignOutStart?.()

      const result = await auth.signOut({
        fromAllDevices,
        reason: 'manual'
      })

      if (result.error) {
        console.error('Sign out error:', result.error)
        onSignOutComplete?.(false)
      } else {
        console.log('✅ Sign out successful')
        onSignOutComplete?.(true)
        
        // Redirect after successful sign out
        router.push(redirectTo)
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error)
      onSignOutComplete?.(false)
    } finally {
      setLoading(false)
      setShowModal(false)
    }
  }

  const handleClick = () => {
    if (showConfirmation) {
      setShowModal(true)
    } else {
      handleSignOut(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${getVariantClasses()} ${getSizeClasses()} ${className} disabled:opacity-50 flex items-center`}
      >
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
        )}
        {children || 'Sign Out'}
      </button>

      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleSignOut}
        includeAllDevices={includeAllDevices}
        loading={loading}
      />
    </>
  )
}

// Convenience components for common use cases
export const QuickSignOutButton: React.FC<Omit<SignOutButtonProps, 'showConfirmation'>> = (props) => (
  <SignOutButton {...props} showConfirmation={false} />
)

export const SecuritySignOutButton: React.FC<Omit<SignOutButtonProps, 'includeAllDevices' | 'variant'>> = (props) => (
  <SignOutButton 
    {...props} 
    includeAllDevices={true} 
    variant="destructive"
  >
    🚨 Security Sign Out
  </SignOutButton>
)

export const HeaderSignOutButton: React.FC = () => (
  <SignOutButton 
    variant="ghost" 
    size="sm"
    className="ml-3"
  >
    <div className="flex items-center">
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Sign Out
    </div>
  </SignOutButton>
)

export default SignOutButton