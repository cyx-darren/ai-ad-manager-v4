'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/auth'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error.message)
          router.push('/auth/error?message=' + encodeURIComponent(error.message))
          return
        }

        if (data.session?.user) {
          // Create or update user profile in our database
          await auth.upsertUserProfile(data.session.user)
          
          // Redirect to dashboard or intended destination
          const redirectTo = new URLSearchParams(window.location.search).get('redirectTo')
          router.push(redirectTo || '/dashboard')
        } else {
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/error?message=' + encodeURIComponent('Authentication failed'))
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
} 