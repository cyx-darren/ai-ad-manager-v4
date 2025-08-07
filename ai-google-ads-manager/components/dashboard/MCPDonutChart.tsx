'use client'

import React from 'react'
import { DonutChart, DonutChartProps, DonutChartDataPoint } from './DonutChart'
import { 
  useTrafficSourceData, 
  useDeviceBreakdownData, 
  useCampaignTypeData, 
  useGeographicData,
  DonutChartType 
} from '@/hooks/useDonutChartData'
import { InformationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface MCPDonutChartProps extends Omit<DonutChartProps, 'data' | 'loading'> {
  chartType: DonutChartType;
  fallbackData: DonutChartDataPoint[];
  enableMCP?: boolean;
  showSource?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  propertyId?: string;
  userId?: string;
  userRole?: string;
}

/**
 * Enhanced DonutChart that fetches data from MCP with feature flag control
 */
export function MCPDonutChart({
  chartType,
  fallbackData,
  title,
  description,
  metric,
  height,
  colors,
  showLegend,
  showLabels,
  showTooltip,
  formatValue,
  formatPercentage,
  className,
  showAnimation,
  centerContent,
  enableMCP = true,
  showSource = false,
  autoRefresh = false,
  refreshInterval = 300000,
  dateRange,
  propertyId,
  userId,
  userRole
}: MCPDonutChartProps) {
  // Use the appropriate hook based on chart type
  const hookMap = {
    'traffic-source': useTrafficSourceData,
    'device-breakdown': useDeviceBreakdownData,
    'campaign-type': useCampaignTypeData,
    'geographic': useGeographicData
  };

  const useDataHook = hookMap[chartType];
  const {
    data,
    loading,
    error,
    source,
    lastUpdated,
    totalValue,
    refresh
  } = useDataHook({
    options: {
      dateRange,
      propertyId,
      userId,
      userRole
    },
    autoRefresh,
    refreshInterval,
    enabled: enableMCP
  });

  // Use MCP data if available, otherwise fallback
  const chartData = enableMCP && data.length > 0 ? data : fallbackData;
  const isLoading = enableMCP ? loading : false;
  const hasError = enableMCP ? !!error : false;

  // Enhanced center content with total value
  const enhancedCenterContent = centerContent || (
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900">
        {(totalValue || chartData.reduce((sum, item) => sum + item.value, 0)).toLocaleString()}
      </div>
      <div className="text-sm text-gray-500">
        {metric === 'sessions' ? 'Total Sessions' :
         metric === 'clicks' ? 'Total Clicks' :
         metric === 'users' ? 'Total Users' :
         'Total Value'}
      </div>
      {showSource && (
        <div className="text-xs text-gray-400 mt-1">
          {source === 'mcp' ? '🔗 Live Data' :
           source === 'cache' ? '💾 Cached' :
           '📋 Mock Data'}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Header with refresh button */}
      {(showSource || hasError) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {hasError && (
              <div className="flex items-center text-yellow-600 text-sm">
                <InformationCircleIcon className="h-4 w-4 mr-1" />
                <span>Using fallback data</span>
              </div>
            )}
            {showSource && lastUpdated && (
              <div className="text-xs text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          {enableMCP && (
            <button
              onClick={refresh}
              disabled={loading}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="Refresh data"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Error banner */}
      {hasError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Data fetch error
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                {error}. Showing fallback data instead.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DonutChart component */}
      <DonutChart
        data={chartData}
        title={title}
        description={description}
        metric={metric}
        height={height}
        colors={colors}
        showLegend={showLegend}
        showLabels={showLabels}
        showTooltip={showTooltip}
        formatValue={formatValue}
        formatPercentage={formatPercentage}
        className={className}
        showAnimation={showAnimation}
        centerContent={enhancedCenterContent}
        loading={isLoading}
      />
    </div>
  );
}

/**
 * Specialized MCP Donut Chart components for common use cases
 */

interface TrafficSourceMCPDonutChartProps extends Omit<MCPDonutChartProps, 'chartType' | 'fallbackData' | 'metric'> {}

export function TrafficSourceMCPDonutChart(props: TrafficSourceMCPDonutChartProps) {
  const fallbackData: DonutChartDataPoint[] = [
    { name: 'Organic Search', value: 2850 },
    { name: 'Direct', value: 1650 },
    { name: 'Paid Search', value: 1240 },
    { name: 'Social Media', value: 890 },
    { name: 'Email Marketing', value: 720 },
    { name: 'Referral', value: 420 },
    { name: 'Display Ads', value: 280 },
    { name: 'Other', value: 150 }
  ];

  return (
    <MCPDonutChart
      {...props}
      chartType="traffic-source"
      fallbackData={fallbackData}
      metric="sessions"
    />
  );
}

interface DeviceBreakdownMCPDonutChartProps extends Omit<MCPDonutChartProps, 'chartType' | 'fallbackData' | 'metric'> {}

export function DeviceBreakdownMCPDonutChart(props: DeviceBreakdownMCPDonutChartProps) {
  const fallbackData: DonutChartDataPoint[] = [
    { name: 'Desktop', value: 4250 },
    { name: 'Mobile', value: 3890 },
    { name: 'Tablet', value: 1060 }
  ];

  return (
    <MCPDonutChart
      {...props}
      chartType="device-breakdown"
      fallbackData={fallbackData}
      metric="sessions"
    />
  );
}

interface CampaignTypeMCPDonutChartProps extends Omit<MCPDonutChartProps, 'chartType' | 'fallbackData' | 'metric'> {}

export function CampaignTypeMCPDonutChart(props: CampaignTypeMCPDonutChartProps) {
  const fallbackData: DonutChartDataPoint[] = [
    { name: 'Search Campaigns', value: 1240 },
    { name: 'Display Campaigns', value: 650 },
    { name: 'Shopping Campaigns', value: 890 },
    { name: 'Video Campaigns', value: 420 },
    { name: 'App Campaigns', value: 180 }
  ];

  return (
    <MCPDonutChart
      {...props}
      chartType="campaign-type"
      fallbackData={fallbackData}
      metric="clicks"
    />
  );
}

interface GeographicMCPDonutChartProps extends Omit<MCPDonutChartProps, 'chartType' | 'fallbackData' | 'metric'> {}

export function GeographicMCPDonutChart(props: GeographicMCPDonutChartProps) {
  const fallbackData: DonutChartDataPoint[] = [
    { name: 'United States', value: 4250 },
    { name: 'Canada', value: 1580 },
    { name: 'United Kingdom', value: 1420 },
    { name: 'Australia', value: 890 },
    { name: 'Germany', value: 680 },
    { name: 'France', value: 540 },
    { name: 'Other', value: 840 }
  ];

  return (
    <MCPDonutChart
      {...props}
      chartType="geographic"
      fallbackData={fallbackData}
      metric="sessions"
    />
  );
}