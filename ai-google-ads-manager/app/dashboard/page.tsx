'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  DashboardLayout, 
  AlertBanner, 
  MetricCard, 
  DonutChart, 
  TableComponent, 
  GOOGLE_ADS_CAMPAIGNS_COLUMNS,
  sampleData 
} from '@/components/dashboard'
import { DashboardContextTest } from '@/components/dashboard/DashboardContextTest'
import { SessionRefreshButton } from '@/components/dashboard/SessionRefreshButton'
import { 
  ChartBarIcon, 
  EyeIcon, 
  CursorArrowRaysIcon,
  BanknotesIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon
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
            value="12"
            icon={ChartBarIcon}
            description="Active ad campaigns"
          />
          <MetricCard
            title="Total Impressions"
            value="45,678"
            icon={EyeIcon}
            description="Campaign impressions"
          />
          <MetricCard
            title="Click Rate"
            value="3.2%"
            icon={CursorArrowRaysIcon}
            description="Average CTR"
          />
          <MetricCard
            title="Total Sessions"
            value="8,234"
            icon={ArrowTrendingUpIcon}
            description="Website sessions"
          />
          <MetricCard
            title="Total Users"
            value="6,543"
            icon={UsersIcon}
            description="Unique visitors"
          />
          <MetricCard
            title="Avg Bounce Rate"
            value="42.5%"
            icon={ArrowUturnLeftIcon}
            description="Average bounce rate"
          />
          <MetricCard
            title="Conversions"
            value="234"
            icon={CheckCircleIcon}
            description="Goal completions"
          />
          <MetricCard
            title="Total Spend"
            value="$2,456"
            icon={BanknotesIcon}
            description="Campaign spend (mock data)"
          />
        </div>

        {/* Donut Charts Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics Overview</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Source Distribution */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Traffic Source Distribution</h3>
              <p className="text-sm text-gray-600 mb-4">Sessions by source</p>
              <DonutChart
                data={sampleData.trafficSources}
                metric="sessions"
                height="h-80"
                title=""
                centerContent={
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {sampleData.trafficSources.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Total Sessions
                    </div>
                  </div>
                }
              />
            </div>

            {/* Device Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Device Breakdown</h3>
              <p className="text-sm text-gray-600 mb-4">Traffic by device type</p>
              <DonutChart
                data={sampleData.devices}
                metric="sessions"
                height="h-80"
                showLegend={true}
                title=""
                centerContent={
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {sampleData.devices.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Total Traffic
                    </div>
                  </div>
                }
              />
            </div>

            {/* Campaign Type Performance */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Type Performance</h3>
              <p className="text-sm text-gray-600 mb-4">Clicks by campaign type</p>
              <DonutChart
                data={sampleData.campaignTypes}
                metric="clicks"
                height="h-80"
                colors={['blue', 'emerald', 'violet', 'amber', 'rose']}
                title=""
                centerContent={
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {sampleData.campaignTypes.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Total Clicks
                    </div>
                  </div>
                }
              />
            </div>

            {/* Geographic Distribution */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Geographic Distribution</h3>
              <p className="text-sm text-gray-600 mb-4">Traffic by country</p>
              <DonutChart
                data={sampleData.geographic}
                metric="sessions"
                height="h-80"
                showLegend={true}
                title=""
                centerContent={
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {sampleData.geographic.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Total Traffic
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>

        {/* Google Ads Campaigns Table */}
        <div className="mt-8">
          <TableComponent
            data={sampleData.googleAdsCampaigns}
            columns={GOOGLE_ADS_CAMPAIGNS_COLUMNS}
            title="Google Ads Campaigns"
            description="Campaign performance metrics"
            searchable={true}
            sortable={true}
            paginated={false}
            highlightRow={(row) => row.status === 'Paused'}
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