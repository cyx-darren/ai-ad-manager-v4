/**
 * Donut Chart Data Fetcher
 * 
 * Specialized data fetching for donut chart components with MCP integration,
 * feature flag control, and fallback mechanisms.
 */

import { MCPClient } from '../client';
import { DonutChartAdapter } from '../adapters/ChartDataAdapter';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';
import { DonutChartDataPoint } from '@/components/dashboard/DonutChart';

export interface DonutChartFetchOptions {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  propertyId?: string;
  forceRefresh?: boolean;
  userId?: string;
  userRole?: string;
}

export interface DonutChartData {
  data: DonutChartDataPoint[];
  loading: boolean;
  error?: string;
  lastUpdated?: Date;
  source: 'mcp' | 'mock' | 'cache';
  totalValue?: number;
}

/**
 * Data fetcher for donut chart components
 */
export class DonutChartDataFetcher {
  private mcpClient: MCPClient;
  private adapter: DonutChartAdapter;
  private cache: Map<string, { data: DonutChartData; timestamp: number; ttl: number }> = new Map();
  private cacheTtl: number = 300000; // 5 minutes

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.adapter = new DonutChartAdapter();
  }

  /**
   * Fetch traffic source distribution data
   */
  async fetchTrafficSourceData(options: DonutChartFetchOptions = {}): Promise<DonutChartData> {
    return this.fetchWithFallback(
      'traffic-source',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-traffic-sources', {
          dateRange: options.dateRange,
          propertyId: options.propertyId,
          metrics: ['sessions'],
          dimensions: ['source', 'medium']
        });
        
        // Transform GA4 response to donut chart format
        const data: DonutChartDataPoint[] = response.dimensionValues?.map((item: any, index: number) => ({
          name: `${item.source} / ${item.medium}`,
          value: response.metricValues?.[index]?.sessions || 0
        })) || [];
        
        return data;
      },
      () => [
        { name: 'Organic Search', value: 2850 },
        { name: 'Direct', value: 1650 },
        { name: 'Paid Search', value: 1240 },
        { name: 'Social Media', value: 890 },
        { name: 'Email Marketing', value: 720 },
        { name: 'Referral', value: 420 },
        { name: 'Display Ads', value: 280 },
        { name: 'Other', value: 150 }
      ],
      'traffic_source_donut_mcp',
      options
    );
  }

  /**
   * Fetch device breakdown data
   */
  async fetchDeviceData(options: DonutChartFetchOptions = {}): Promise<DonutChartData> {
    return this.fetchWithFallback(
      'device-breakdown',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-device-data', {
          dateRange: options.dateRange,
          propertyId: options.propertyId,
          metrics: ['sessions'],
          dimensions: ['deviceCategory']
        });
        
        const data: DonutChartDataPoint[] = response.dimensionValues?.map((item: any, index: number) => ({
          name: item.deviceCategory,
          value: response.metricValues?.[index]?.sessions || 0
        })) || [];
        
        return data;
      },
      () => [
        { name: 'Desktop', value: 4250 },
        { name: 'Mobile', value: 3890 },
        { name: 'Tablet', value: 1060 }
      ],
      'device_breakdown_donut_mcp',
      options
    );
  }

  /**
   * Fetch campaign type performance data
   */
  async fetchCampaignTypeData(options: DonutChartFetchOptions = {}): Promise<DonutChartData> {
    return this.fetchWithFallback(
      'campaign-type',
      async () => {
        const response = await this.mcpClient.callTool('google-ads-get-campaign-performance', {
          dateRange: options.dateRange,
          propertyId: options.propertyId,
          metrics: ['clicks'],
          dimensions: ['campaignType']
        });
        
        const data: DonutChartDataPoint[] = response.campaignTypes?.map((item: any) => ({
          name: item.type,
          value: item.clicks || 0
        })) || [];
        
        return data;
      },
      () => [
        { name: 'Search Campaigns', value: 1240 },
        { name: 'Display Campaigns', value: 650 },
        { name: 'Shopping Campaigns', value: 890 },
        { name: 'Video Campaigns', value: 420 },
        { name: 'App Campaigns', value: 180 }
      ],
      'campaign_type_donut_mcp',
      options
    );
  }

  /**
   * Fetch geographic distribution data
   */
  async fetchGeographicData(options: DonutChartFetchOptions = {}): Promise<DonutChartData> {
    return this.fetchWithFallback(
      'geographic',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-geographic-data', {
          dateRange: options.dateRange,
          propertyId: options.propertyId,
          metrics: ['sessions'],
          dimensions: ['country']
        });
        
        const data: DonutChartDataPoint[] = response.dimensionValues?.map((item: any, index: number) => ({
          name: item.country,
          value: response.metricValues?.[index]?.sessions || 0
        })) || [];
        
        return data;
      },
      () => [
        { name: 'United States', value: 4250 },
        { name: 'Canada', value: 1580 },
        { name: 'United Kingdom', value: 1420 },
        { name: 'Australia', value: 890 },
        { name: 'Germany', value: 680 },
        { name: 'France', value: 540 },
        { name: 'Other', value: 840 }
      ],
      'geographic_donut_mcp',
      options
    );
  }

  /**
   * Generic fetch with fallback implementation
   */
  private async fetchWithFallback(
    chartType: string,
    mcpFetcher: () => Promise<DonutChartDataPoint[]>,
    fallbackData: () => DonutChartDataPoint[],
    flagName: string,
    options: DonutChartFetchOptions
  ): Promise<DonutChartData> {
    const cacheKey = `${chartType}-${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached && !options.forceRefresh) {
      return cached;
    }

    try {
      // Check feature flags
      const isMCPEnabled = await featureFlagManager.isEnabled(flagName, {
        userId: options.userId,
        userRole: options.userRole
      });

      const isFallbackEnabled = await featureFlagManager.isEnabled('donut_charts_fallback_enabled', {
        userId: options.userId,
        userRole: options.userRole
      });

      let data: DonutChartDataPoint[];
      let source: 'mcp' | 'mock' | 'cache' = 'mock';

      if (isMCPEnabled) {
        try {
          data = await mcpFetcher();
          source = 'mcp';
        } catch (error) {
          console.warn(`MCP fetch failed for ${chartType}:`, error);
          if (isFallbackEnabled) {
            data = fallbackData();
            source = 'mock';
          } else {
            throw error;
          }
        }
      } else {
        data = fallbackData();
        source = 'mock';
      }

      const totalValue = data.reduce((sum, item) => sum + item.value, 0);
      
      const result: DonutChartData = {
        data,
        loading: false,
        source,
        lastUpdated: new Date(),
        totalValue
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;

    } catch (error) {
      const fallbackEnabled = await featureFlagManager.isEnabled('donut_charts_fallback_enabled', {
        userId: options.userId,
        userRole: options.userRole
      });

      if (fallbackEnabled) {
        const data = fallbackData();
        const totalValue = data.reduce((sum, item) => sum + item.value, 0);
        
        return {
          data,
          loading: false,
          error: `Failed to fetch live data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          source: 'mock',
          lastUpdated: new Date(),
          totalValue
        };
      }

      throw error;
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): DonutChartData | null {
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return {
        ...entry.data,
        source: 'cache'
      };
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  private setCache(key: string, data: DonutChartData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTtl
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}