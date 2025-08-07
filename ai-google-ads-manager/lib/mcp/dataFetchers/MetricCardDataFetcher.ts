/**
 * Metric Card Data Fetcher
 * 
 * Centralized data fetching utilities for metric cards with caching, error handling,
 * and performance monitoring.
 */

import { MCPClient } from '../client';
import { MetricCardAdapter } from '../adapters/MetricCardAdapter';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

export interface MetricCardData {
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    timeframe?: string;
  };
  loading: boolean;
  error?: string;
  lastUpdated?: Date;
  source: 'mcp' | 'mock' | 'cache';
}

export interface DataFetcherConfig {
  cacheEnabled: boolean;
  cacheTtl: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeoutMs: number;
}

export interface MetricCardFetchOptions {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  propertyId?: string;
  forceRefresh?: boolean;
  userId?: string;
  userRole?: string;
}

/**
 * Data cache entry
 */
interface CacheEntry {
  data: MetricCardData;
  timestamp: number;
  ttl: number;
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  cacheHitCount: number;
  averageLatency: number;
  p95Latency: number;
  lastRequestTime: number;
}

/**
 * Main data fetcher class
 */
export class MetricCardDataFetcher {
  private mcpClient: MCPClient;
  private adapter: MetricCardAdapter;
  private cache: Map<string, CacheEntry> = new Map();
  private config: DataFetcherConfig;
  private metrics: PerformanceMetrics;

  constructor(mcpClient: MCPClient, config: Partial<DataFetcherConfig> = {}) {
    this.mcpClient = mcpClient;
    this.adapter = new MetricCardAdapter();
    this.config = {
      cacheEnabled: true,
      cacheTtl: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      timeoutMs: 10000, // 10 seconds
      ...config
    };

    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHitCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      lastRequestTime: 0
    };
  }

  /**
   * Fetch total campaigns count
   */
  async fetchTotalCampaigns(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'total-campaigns',
      async () => {
        const response = await this.mcpClient.callTool('google-ads-get-campaigns', {
          dateRange: options.dateRange,
          propertyId: options.propertyId,
          status: 'ENABLED'
        });
        
        return {
          current: response.campaigns?.length || 0,
          title: 'Total Campaigns',
          type: 'number' as const
        };
      },
      () => ({
        value: '12',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch total impressions
   */
  async fetchTotalImpressions(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'impressions',
      async () => {
        const response = await this.mcpClient.callTool('google-ads-get-metrics', {
          metrics: ['impressions'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.impressions || 0,
          title: 'Total Impressions',
          type: 'number' as const
        };
      },
      () => ({
        value: '45,678',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch click rate (CTR)
   */
  async fetchClickRate(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'click-rate',
      async () => {
        const response = await this.mcpClient.callTool('google-ads-get-metrics', {
          metrics: ['clicks', 'impressions'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        const clicks = response.metrics?.clicks || 0;
        const impressions = response.metrics?.impressions || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        
        return {
          current: ctr,
          title: 'Click Rate',
          type: 'percentage' as const
        };
      },
      () => ({
        value: '3.2%',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch total sessions
   */
  async fetchTotalSessions(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'sessions',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-metrics', {
          metrics: ['sessions'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.sessions || 0,
          title: 'Total Sessions',
          type: 'number' as const
        };
      },
      () => ({
        value: '8,234',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch total users
   */
  async fetchTotalUsers(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'users',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-metrics', {
          metrics: ['activeUsers'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.activeUsers || 0,
          title: 'Total Users',
          type: 'number' as const
        };
      },
      () => ({
        value: '6,543',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch bounce rate
   */
  async fetchBounceRate(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'bounce-rate',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-metrics', {
          metrics: ['bounceRate'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.bounceRate || 0,
          title: 'Avg Bounce Rate',
          type: 'percentage' as const
        };
      },
      () => ({
        value: '42.5%',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch conversions
   */
  async fetchConversions(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'conversions',
      async () => {
        const response = await this.mcpClient.callTool('ga4-get-metrics', {
          metrics: ['conversions'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.conversions || 0,
          title: 'Conversions',
          type: 'number' as const
        };
      },
      () => ({
        value: '234',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Fetch total spend
   */
  async fetchTotalSpend(options: MetricCardFetchOptions = {}): Promise<MetricCardData> {
    return this.fetchWithFallback(
      'total-spend',
      async () => {
        const response = await this.mcpClient.callTool('google-ads-get-metrics', {
          metrics: ['cost'],
          dateRange: options.dateRange,
          propertyId: options.propertyId
        });
        
        return {
          current: response.metrics?.cost || 0,
          title: 'Total Spend',
          type: 'currency' as const
        };
      },
      () => ({
        value: '$2,456',
        loading: false,
        source: 'mock' as const,
        lastUpdated: new Date()
      }),
      options
    );
  }

  /**
   * Core fetch method with fallback logic
   */
  private async fetchWithFallback(
    cardId: string,
    mcpFetcher: () => Promise<any>,
    fallbackData: () => MetricCardData,
    options: MetricCardFetchOptions
  ): Promise<MetricCardData> {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      // Check feature flags
      const flagName = `${cardId.replace('-', '_')}_card_mcp`;
      const isEnabled = await featureFlagManager.isEnabled(flagName, options.userId, options.userRole);
      
      if (!isEnabled) {
        return fallbackData();
      }

      // Check cache first
      if (!options.forceRefresh && this.config.cacheEnabled) {
        const cached = this.getFromCache(cardId, options);
        if (cached) {
          this.metrics.cacheHitCount++;
          return cached;
        }
      }

      // Fetch from MCP with retries
      const mcpData = await this.retryWithBackoff(mcpFetcher);
      const adaptedData = this.adapter.transform(mcpData);
      
      const result: MetricCardData = {
        value: adaptedData.formattedValue,
        change: adaptedData.change ? {
          value: adaptedData.change.percentage,
          type: adaptedData.change.direction === 'increase' ? 'increase' : 'decrease',
          timeframe: 'vs last period'
        } : undefined,
        loading: false,
        source: 'mcp',
        lastUpdated: new Date()
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setCache(cardId, options, result);
      }

      this.metrics.successCount++;
      this.updateLatencyMetrics(Date.now() - startTime);
      
      return result;

    } catch (error) {
      this.metrics.errorCount++;
      console.error(`Error fetching ${cardId} data:`, error);

      // Check if fallback is enabled
      const fallbackEnabled = await featureFlagManager.isEnabled(
        'metric_cards_fallback_enabled',
        options.userId,
        options.userRole
      );

      if (fallbackEnabled) {
        return {
          ...fallbackData(),
          error: `Failed to fetch live data: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

      throw error;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), this.config.timeoutMs)
          )
        ]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.retryAttempts - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Cache management
   */
  private getCacheKey(cardId: string, options: MetricCardFetchOptions): string {
    return `${cardId}-${JSON.stringify(options)}`;
  }

  private getFromCache(cardId: string, options: MetricCardFetchOptions): MetricCardData | null {
    const key = this.getCacheKey(cardId, options);
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

  private setCache(cardId: string, options: MetricCardFetchOptions, data: MetricCardData): void {
    const key = this.getCacheKey(cardId, options);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl
    });
  }

  /**
   * Performance metrics management
   */
  private updateLatencyMetrics(latency: number): void {
    this.metrics.lastRequestTime = latency;
    
    // Simple moving average for average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.successCount - 1) + latency) / 
      this.metrics.successCount;
    
    // Simple approximation for P95 (would need proper histogram in production)
    this.metrics.p95Latency = Math.max(this.metrics.p95Latency, latency);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHitCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      lastRequestTime: 0
    };
  }
}