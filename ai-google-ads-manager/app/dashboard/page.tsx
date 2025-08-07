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
  MCPCampaignTable,
  sampleData 
} from '@/components/dashboard'
import { MCPMetricCard } from '@/components/dashboard/MCPMetricCard'
import { 
  TrafficSourceMCPDonutChart,
  DeviceBreakdownMCPDonutChart,
  CampaignTypeMCPDonutChart,
  GeographicMCPDonutChart
} from '@/components/dashboard/MCPDonutChart'
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
          <MCPMetricCard
            cardType="total-campaigns"
            title="Total Campaigns"
            fallbackValue="12"
            icon={ChartBarIcon}
            description="Active ad campaigns"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="impressions"
            title="Total Impressions"
            fallbackValue="45,678"
            icon={EyeIcon}
            description="Campaign impressions"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="click-rate"
            title="Click Rate"
            fallbackValue="3.2%"
            icon={CursorArrowRaysIcon}
            description="Average CTR"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="sessions"
            title="Total Sessions"
            fallbackValue="8,234"
            icon={ArrowTrendingUpIcon}
            description="Website sessions"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="users"
            title="Total Users"
            fallbackValue="6,543"
            icon={UsersIcon}
            description="Unique visitors"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="bounce-rate"
            title="Avg Bounce Rate"
            fallbackValue="42.5%"
            icon={ArrowUturnLeftIcon}
            description="Average bounce rate"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="conversions"
            title="Conversions"
            fallbackValue="234"
            icon={CheckCircleIcon}
            description="Goal completions"
            enableMCP={true}
            showSource={true}
          />
          <MCPMetricCard
            cardType="total-spend"
            title="Total Spend"
            fallbackValue="$2,456"
            icon={BanknotesIcon}
            description="Campaign spend"
            enableMCP={true}
            showSource={true}
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
              <TrafficSourceMCPDonutChart
                height="h-80"
                title=""
                enableMCP={true}
                showSource={true}
                autoRefresh={false}
              />
            </div>

            {/* Device Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Device Breakdown</h3>
              <p className="text-sm text-gray-600 mb-4">Traffic by device type</p>
              <DeviceBreakdownMCPDonutChart
                height="h-80"
                showLegend={true}
                title=""
                enableMCP={true}
                showSource={true}
                autoRefresh={false}
              />
            </div>

            {/* Campaign Type Performance */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Type Performance</h3>
              <p className="text-sm text-gray-600 mb-4">Clicks by campaign type</p>
              <CampaignTypeMCPDonutChart
                height="h-80"
                colors={['blue', 'emerald', 'violet', 'amber', 'rose']}
                title=""
                enableMCP={true}
                showSource={true}
                autoRefresh={false}
              />
            </div>

            {/* Geographic Distribution */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Geographic Distribution</h3>
              <p className="text-sm text-gray-600 mb-4">Traffic by country</p>
              <GeographicMCPDonutChart
                height="h-80"
                showLegend={true}
                title=""
                enableMCP={true}
                showSource={true}
                autoRefresh={false}
              />
            </div>
          </div>
        </div>

        {/* Google Ads Campaigns Table - MCP Powered */}
        <div className="mt-8">
          <MCPCampaignTable
            enableMCP={true}
            showSource={true}
            autoRefresh={true}
            refreshInterval={300000}
            initialPageSize={25}
            className="shadow-lg"
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