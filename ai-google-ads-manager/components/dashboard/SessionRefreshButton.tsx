'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function SessionRefreshButton() {
  const { user, refreshSession } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefreshSession = async () => {
    setIsRefreshing(true)
    try {
      console.log("🔄 Manual refresh triggered from UI")
      await refreshSession()
    } catch (err) {
      console.error("Session refresh failed:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Only show the button if the user email is not available
  if (user?.email) {
    return null
  }

  return (
    <button
      onClick={handleRefreshSession}
      disabled={isRefreshing}
      className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Refresh session"
    >
      {isRefreshing ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          Refreshing...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Session
        </>
      )}
    </button>
  )
}