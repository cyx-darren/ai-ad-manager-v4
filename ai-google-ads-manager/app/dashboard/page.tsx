'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { DashboardLayout, AlertBanner, MetricCard } from '@/components/dashboard'
import { DashboardContextTest } from '@/components/dashboard/DashboardContextTest'
import { SessionRefreshButton } from '@/components/dashboard/SessionRefreshButton'
import { 
  ChartBarIcon, 
  EyeIcon, 
  CursorArrowRaysIcon,
  BanknotesIcon 
} from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const { user } = useAuth()

  // Setup user profile when first visiting dashboard
  useEffect(() => {
    const setupUserProfile = async () => {
      if (!user?.id) return

      try {
        // Upsert user profile (create if doesn't exist, update if it does)
        const { error } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email!,
            role: 'user',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          })

        if (error) {
          console.warn('Could not upsert user profile:', error.message)
        } else {
          console.log('✅ User profile synchronized successfully')
        }
    } catch (error) {
        console.warn('Could not setup user profile (this is ok):', error)
      }
    }

    setupUserProfile()
  }, [user?.id, user?.email])

  return (
    <DashboardLayout>
      <div className="space-y-6">
            <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome to your AI Ad Manager dashboard
          </p>
        </div>

        <AlertBanner 
          type="success" 
          title="Authentication Complete"
          message="🎉 Authentication successful! Your dashboard is ready."
        />

        {/* Session Refresh Button - only shows when user email is not available */}
        <SessionRefreshButton />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Campaigns"
            value="0"
            icon={ChartBarIcon}
            description="Active ad campaigns"
          />
          <MetricCard
            title="Total Impressions"
            value="0"
            icon={EyeIcon}
            description="Campaign impressions"
          />
          <MetricCard
            title="Click Rate"
            value="0%"
            icon={CursorArrowRaysIcon}
            description="Average CTR"
          />
          <MetricCard
            title="Total Spend"
            value="$0"
            icon={BanknotesIcon}
            description="Campaign spend"
          />
        </div>

        {/* Dashboard Context Test - Phase 1 Testing */}
        <DashboardContextTest />

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Welcome!</h2>
          <p className="text-gray-600">
            You've successfully signed in to AI Ad Manager. Start by connecting your Google Analytics 
            and Google Ads accounts to begin tracking your campaign performance.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}