/**
 * useDonutChartData Hook
 * 
 * React hook for fetching donut chart data with MCP integration,
 * feature flag control, and automatic refresh capabilities.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMCPClient } from '@/lib/mcp/context';
import { DonutChartDataFetcher, DonutChartData, DonutChartFetchOptions } from '@/lib/mcp/dataFetchers/DonutChartDataFetcher';

export type DonutChartType = 
  | 'traffic-source'
  | 'device-breakdown' 
  | 'campaign-type'
  | 'geographic';

interface UseDonutChartDataProps {
  chartType: DonutChartType;
  options?: DonutChartFetchOptions;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

export function useDonutChartData({
  chartType,
  options = {},
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  enabled = true
}: UseDonutChartDataProps) {
  const mcpClient = useMCPClient();
  
  const [data, setData] = useState<DonutChartData>({
    data: [],
    loading: false, // Start with false since we have fallback data
    source: 'mock'
  });
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Initialize fetcher (memoized to prevent recreation)
  const fetcher = useMemo(() => {
    return mcpClient ? new DonutChartDataFetcher(mcpClient) : null;
  }, [mcpClient]);
  const mounted = useRef(true);

  /**
   * Fetch data based on chart type
   */
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled || !mounted.current || !fetcher) {
      // Set loading to false when we can't fetch data
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    setData(prev => ({ ...prev, loading: true }));

    try {
      const fetchOptions = { ...options, forceRefresh };
      let result: DonutChartData;

      switch (chartType) {
        case 'traffic-source':
          result = await fetcher.fetchTrafficSourceData(fetchOptions);
          break;
        case 'device-breakdown':
          result = await fetcher.fetchDeviceData(fetchOptions);
          break;
        case 'campaign-type':
          result = await fetcher.fetchCampaignTypeData(fetchOptions);
          break;
        case 'geographic':
          result = await fetcher.fetchGeographicData(fetchOptions);
          break;
        default:
          throw new Error(`Unknown chart type: ${chartType}`);
      }

      if (mounted.current) {
        setData(result);
        setLastFetch(new Date());
      }
    } catch (error) {
      console.error(`Failed to fetch ${chartType} data:`, error);
      if (mounted.current) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }));
      }
    }
  }, [chartType, enabled, fetcher]); // Removed 'options' from deps to avoid recreation

  /**
   * Force refresh data
   */
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  /**
   * Initial data fetch - run once on mount
   */
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fetch data when MCP client becomes available
   */
  useEffect(() => {
    if (mcpClient && fetcher && enabled) {
      fetchData();
    }
  }, [mcpClient, fetcher, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Auto-refresh setup
   */
  useEffect(() => {
    if (!autoRefresh || !enabled) {
      return;
    }

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, enabled]); // Removed fetchData to prevent recreation

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    data: data.data,
    loading: data.loading,
    error: data.error,
    source: data.source,
    lastUpdated: data.lastUpdated,
    totalValue: data.totalValue,
    lastFetch,
    refresh
  };
}

/**
 * Specialized hooks for each donut chart type
 */
export function useTrafficSourceData(props: Omit<UseDonutChartDataProps, 'chartType'> = {}) {
  return useDonutChartData({ ...props, chartType: 'traffic-source' });
}

export function useDeviceBreakdownData(props: Omit<UseDonutChartDataProps, 'chartType'> = {}) {
  return useDonutChartData({ ...props, chartType: 'device-breakdown' });
}

export function useCampaignTypeData(props: Omit<UseDonutChartDataProps, 'chartType'> = {}) {
  return useDonutChartData({ ...props, chartType: 'campaign-type' });
}

export function useGeographicData(props: Omit<UseDonutChartDataProps, 'chartType'> = {}) {
  return useDonutChartData({ ...props, chartType: 'geographic' });
}