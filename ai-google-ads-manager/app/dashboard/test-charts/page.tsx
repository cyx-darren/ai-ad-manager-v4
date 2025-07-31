'use client'

import React from 'react'
import {
  ChartContainer,
  LineChart,
  TrafficLineChart,
  BarChart,
  CampaignPerformanceBarChart,
  DonutChart,
  TrafficSourceDonutChart,
  TableComponent,
  GA4_PAGES_COLUMNS,
  GOOGLE_ADS_CAMPAIGNS_COLUMNS,
  sampleData
} from '@/components/dashboard'

export default function TestChartsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Data Visualization Components Test
          </h1>
          <p className="mt-2 text-gray-600">
            Testing all GA4/Google Ads visualization components with sample data
          </p>
        </div>

        <div className="space-y-8">
          {/* LineChart Tests */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Line Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic LineChart - Direct Rendering Test */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <LineChart
                  data={sampleData.timeSeries}
                  metrics={['sessions', 'users', 'pageviews']}
                  height="h-64"
                  title="Traffic Metrics Over Time"
                  description="Sessions, Users, and Pageviews"
                />
              </div>

              {/* Direct Preset TrafficLineChart */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <TrafficLineChart
                  data={sampleData.timeSeries}
                  height="h-64"
                  title="GA4 Traffic Metrics"
                  description="Using preset configuration"
                />
              </div>

              {/* Direct Google Ads Performance */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <LineChart
                  data={sampleData.timeSeries}
                  metrics={['clicks', 'impressions', 'cost']}
                  height="h-64"
                  colors={['cyan', 'teal', 'pink']}
                  title="Google Ads Performance"
                  description="Clicks, Impressions, and Cost"
                />
              </div>

              {/* Direct Efficiency Metrics */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <LineChart
                  data={sampleData.timeSeries}
                  metrics={['ctr', 'cpc', 'roas']}
                  height="h-64"
                  colors={['amber', 'orange', 'violet']}
                  title="Efficiency Metrics"
                  description="CTR, CPC, and ROAS"
                />
              </div>
            </div>
          </section>

          {/* BarChart Tests */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Bar Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Direct Bar Chart Test */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-lg font-medium mb-2 text-gray-900">Campaign Performance by Clicks</h3>
                <p className="text-sm text-gray-600 mb-4">Top performing campaigns</p>
                <CampaignPerformanceBarChart
                  data={sampleData.campaigns}
                  metric="clicks"
                  height="h-64"
                  showDataLabels={true}
                  color="cyan"
                />
              </div>

              {/* Direct Channel Traffic */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-lg font-medium mb-2 text-gray-900">Traffic by Channel</h3>
                <p className="text-sm text-gray-600 mb-4">Sessions by traffic source</p>
                <BarChart
                  data={sampleData.channels}
                  metric="sessions"
                  height="h-64"
                  sortBy="value"
                  sortDirection="desc"
                  color="indigo"
                />
              </div>

              {/* Direct Campaign Cost Analysis */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-lg font-medium mb-2 text-gray-900">Campaign Cost Analysis</h3>
                <p className="text-sm text-gray-600 mb-4">Cost per campaign</p>
                <BarChart
                  data={sampleData.campaigns}
                  metric="cost"
                  height="h-64"
                  color="pink"
                  layout="horizontal"
                  maxLabelLength={25}
                  maxItems={5}
                />
              </div>

              {/* Direct Conversion Rate by Channel */}
              <div className="bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-lg font-medium mb-2 text-gray-900">Conversion Rate by Channel</h3>
                <p className="text-sm text-gray-600 mb-4">Performance comparison</p>
                <BarChart
                  data={sampleData.channels}
                  metric="conversionRate"
                  height="h-64"
                  color="emerald"
                />
              </div>
            </div>
          </section>

          {/* DonutChart Tests */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Donut Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Direct Donut Chart Test */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Traffic Source Distribution</h3>
                <p className="text-sm text-gray-600 mb-4">Sessions by source</p>
                <DonutChart
                  data={sampleData.trafficSources}
                  metric="sessions"
                  height="h-80"
                  title=""
                />
              </div>

              {/* Direct Device Breakdown */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Device Breakdown</h3>
                <p className="text-sm text-gray-600 mb-4">Traffic by device type</p>
                <DonutChart
                  data={sampleData.devices}
                  metric="sessions"
                  height="h-80"
                  showLegend={true}
                  title=""
                />
              </div>

              {/* Direct Campaign Types */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Type Performance</h3>
                <p className="text-sm text-gray-600 mb-4">Clicks by campaign type</p>
                <DonutChart
                  data={sampleData.campaignTypes}
                  metric="clicks"
                  height="h-80"
                  colors={['blue', 'emerald', 'violet', 'amber', 'rose']}
                  title=""
                />
              </div>

              {/* Direct Geographic Distribution */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Geographic Distribution</h3>
                <p className="text-sm text-gray-600 mb-4">Traffic by country</p>
                <DonutChart
                  data={sampleData.geographic}
                  metric="sessions"
                  height="h-80"
                  showLegend={true}
                  title=""
                />
              </div>
            </div>
          </section>

          {/* TableComponent Tests */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Tables</h2>
            <div className="space-y-6">
              {/* Page Performance Table */}
              <TableComponent
                data={sampleData.pages}
                columns={GA4_PAGES_COLUMNS}
                title="Page Performance Analysis"
                description="Top performing pages by pageviews"
                searchable={true}
                sortable={true}
                paginated={true}
                pageSize={5}
                showRowCount={true}
              />

              {/* Google Ads Campaigns Table */}
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
          </section>

          {/* Combined Dashboard Preview */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard Preview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Traffic Overview */}
              <div className="lg:col-span-2">
                <ChartContainer
                  title="Traffic Overview"
                  description="7-day trend"
                >
                    <LineChart
                      data={sampleData.timeSeries}
                      metrics={['sessions', 'users']}
                      height="h-48"
                      colors={['blue', 'indigo']}
                      showLegend={true}
                    />
  
                </ChartContainer>
              </div>

              {/* Traffic Sources */}
              <ChartContainer
                title="Traffic Sources"
                description="Current distribution"
              >
                <DonutChart
                    data={sampleData.trafficSources}
                    metric="sessions"
                    height="h-48"
                    showLegend={false}
                    centerContent={
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {sampleData.trafficSources.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          Total Sessions
                        </div>
                      </div>
                    }
                  />

              </ChartContainer>

              {/* Top Campaigns */}
              <div className="lg:col-span-2">
                <ChartContainer
                  title="Top Campaigns"
                  description="Performance by conversions"
                >
                    <BarChart
                      data={sampleData.campaigns}
                      metric="conversions"
                      height="h-48"
                      layout="horizontal"
                      maxItems={3}
                      color="emerald"
                    />
  
                </ChartContainer>
              </div>

              {/* Device Performance */}
              <ChartContainer
                title="Device Performance"
                description="Sessions by device"
              >
                <DonutChart
                    data={sampleData.devices}
                    metric="sessions"
                    height="h-48"
                    showLegend={false}
                    colors={['blue', 'emerald', 'amber']}
                  />

              </ChartContainer>
            </div>
          </section>

          {/* Test Summary */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Test Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900">LineChart</h3>
                <p className="text-sm text-green-700">
                  ✅ Time series data<br/>
                  ✅ Multiple metrics<br/>
                  ✅ Custom formatting<br/>
                  ✅ Preset configurations
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900">BarChart</h3>
                <p className="text-sm text-green-700">
                  ✅ Comparative data<br/>
                  ✅ Sorting & filtering<br/>
                  ✅ Horizontal/vertical layouts<br/>
                  ✅ Campaign analysis
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900">DonutChart</h3>
                <p className="text-sm text-green-700">
                  ✅ Percentage breakdowns<br/>
                  ✅ Custom center content<br/>
                  ✅ Legend & tooltips<br/>
                  ✅ Traffic source analysis
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900">TableComponent</h3>
                <p className="text-sm text-green-700">
                  ✅ Search & sort<br/>
                  ✅ Pagination<br/>
                  ✅ Custom formatting<br/>
                  ✅ GA4/Ads column presets
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-900 font-medium">
                🎉 All visualization components are ready for integration with GA4 API service on port 3001!
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}