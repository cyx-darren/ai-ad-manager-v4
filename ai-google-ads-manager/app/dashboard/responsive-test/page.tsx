'use client'

import { DashboardLayout, DateRangePicker, SettingsPanel, MetricCard } from '@/components/dashboard'
import { 
  ChartBarIcon, 
  EyeIcon, 
  CursorArrowRaysIcon,
  BanknotesIcon 
} from '@heroicons/react/24/outline'

export default function ResponsiveTestPage() {
  return (
    <DashboardLayout title="Responsive Design Test" showDatePicker={true} showSettings={true}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Responsive Design Test</h2>
          <p className="text-gray-600 mb-4">
            This page tests the responsive design across different screen sizes and devices.
          </p>
          
          {/* Screen Size Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <div className="w-3 h-3 bg-red-500 rounded-full sm:bg-yellow-500 lg:bg-green-500"></div>
              <span className="text-sm font-medium">
                <span className="sm:hidden">Mobile (&lt;640px)</span>
                <span className="hidden sm:block lg:hidden">Tablet (640px+)</span>
                <span className="hidden lg:block">Desktop (1024px+)</span>
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Current viewport: 
              <span className="font-mono ml-1">
                <span className="sm:hidden">XS</span>
                <span className="hidden sm:block md:hidden">SM</span>
                <span className="hidden md:block lg:hidden">MD</span>
                <span className="hidden lg:block xl:hidden">LG</span>
                <span className="hidden xl:block">XL</span>
              </span>
            </div>
          </div>
        </div>

        {/* Date Range Picker Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range Picker Test</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Width (Mobile)</label>
              <DateRangePicker className="w-full" showPresets={true} showCustom={true} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Auto Width (Desktop)</label>
              <DateRangePicker showPresets={true} showCustom={true} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Presets Only</label>
              <DateRangePicker showPresets={true} showCustom={false} />
            </div>
          </div>
        </div>

        {/* Settings Panel Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings Panel Test</h3>
          <div className="flex items-center space-x-4">
            <SettingsPanel />
            <span className="text-sm text-gray-600">Click the settings button to test the panel</span>
          </div>
        </div>

        {/* Metric Cards Responsive Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Responsive Metric Cards</h3>
          
          {/* 1 column on mobile, 2 on tablet, 4 on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Campaigns"
              value="42"
              icon={ChartBarIcon}
              description="Active campaigns"
              trend={{ value: 12.5, isPositive: true }}
            />
            <MetricCard
              title="Impressions"
              value="125.8K"
              icon={EyeIcon}
              description="Total impressions"
              trend={{ value: 8.2, isPositive: true }}
            />
            <MetricCard
              title="Click Rate"
              value="3.2%"
              icon={CursorArrowRaysIcon}
              description="Average CTR"
              trend={{ value: -2.1, isPositive: false }}
            />
            <MetricCard
              title="Total Spend"
              value="$2,450"
              icon={BanknotesIcon}
              description="Campaign spend"
              trend={{ value: 15.8, isPositive: false }}
            />
          </div>

          {/* 1 column on mobile, 1 on tablet, 2 on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricCard
              title="Conversion Rate"
              value="4.8%"
              icon={ChartBarIcon}
              description="Goal completion rate"
              trend={{ value: 18.7, isPositive: true }}
            />
            <MetricCard
              title="Cost per Click"
              value="$0.85"
              icon={BanknotesIcon}
              description="Average CPC"
              trend={{ value: -5.3, isPositive: true }}
            />
          </div>

          {/* Single full-width card */}
          <div className="grid grid-cols-1 gap-6">
            <MetricCard
              title="Return on Ad Spend (ROAS)"
              value="4.2x"
              icon={ChartBarIcon}
              description="Revenue per dollar spent on advertising"
              trend={{ value: 22.4, isPositive: true }}
            />
          </div>
        </div>

        {/* Responsive Text and Typography */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Responsive Typography</h3>
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Responsive Heading 1
            </h1>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Responsive Heading 2
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600">
              This paragraph demonstrates responsive text sizing. On mobile devices, text is smaller to accommodate limited screen space. On tablets and desktops, text scales up for better readability.
            </p>
          </div>
        </div>

        {/* Layout Responsiveness */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Layout Responsiveness</h3>
          
          {/* Flex layout that stacks on mobile */}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Primary Content</h4>
              <p className="text-blue-800 text-sm">
                This content area takes full width on mobile and shares space with the sidebar on desktop.
              </p>
            </div>
            <div className="w-full lg:w-1/3 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Sidebar</h4>
              <p className="text-gray-700 text-sm">
                This sidebar stacks below content on mobile and appears alongside on desktop.
              </p>
            </div>
          </div>
        </div>

        {/* Responsive Instructions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Testing Instructions</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p><strong>Mobile (< 640px):</strong> Resize browser window or use developer tools to test mobile layout</p>
            <p><strong>Tablet (640px - 1024px):</strong> Medium-sized screens should show tablet layout</p>
            <p><strong>Desktop (> 1024px):</strong> Full desktop layout with sidebar and multiple columns</p>
            <p><strong>Features to test:</strong> Date picker dropdown, settings panel, metric card grids, text scaling</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}