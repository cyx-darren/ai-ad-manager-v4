/**
 * MCP Specific Tool Hooks
 * 
 * This file provides specialized React hooks for specific MCP tools,
 * offering domain-specific functionality with optimized configurations.
 */

'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useMCPClient, useMCPStatus } from '../context';
import { useGA4Data, useMetrics } from './dataHooks';
import { useCachedData, useRetryableOperation } from './advancedHooks';
import { useAutoRefresh, useDashboardIntegration } from './integrationHooks';
import { useConnectionNotifications } from './notificationHooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Analytics query configuration
 */
export interface AnalyticsQueryConfig {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
  orderBy?: Array<{
    metric?: string;
    dimension?: string;
    desc?: boolean;
  }>;
  limit?: number;
  offset?: number;
  refreshInterval?: number;
  enableCache?: boolean;
  cacheTime?: number;
}

/**
 * Real-time data configuration
 */
export interface RealtimeConfig {
  updateFrequency: number;
  autoRefresh?: boolean;
  pauseOnError?: boolean;
  maxRetries?: number;
  thresholdPercent?: number;
  onDataChange?: (newData: any, oldData: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Traffic sources configuration
 */
export interface TrafficSourcesConfig {
  includeGoogleAds?: boolean;
  includeOrganic?: boolean;
  includeSocial?: boolean;
  includeDirect?: boolean;
  includeReferral?: boolean;
  groupBy?: 'source' | 'medium' | 'campaign' | 'sourceMedium';
  filters?: {
    source?: string[];
    medium?: string[];
    campaign?: string[];
    country?: string[];
    device?: string[];
  };
  sortBy?: 'sessions' | 'users' | 'conversions' | 'revenue';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Page performance configuration
 */
export interface PagePerformanceConfig {
  sortBy?: 'pageViews' | 'uniquePageViews' | 'avgTimeOnPage' | 'bounceRate' | 'exitRate';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  filters?: {
    pagePath?: string[];
    pageTitle?: string[];
    landingPage?: boolean;
    exitPage?: boolean;
  };
  includeMetrics?: string[];
  groupBy?: 'pagePath' | 'pageTitle' | 'contentGroup';
}

/**
 * Conversions configuration
 */
export interface ConversionsConfig {
  goals?: string[];
  conversionActions?: string[];
  attributionModel?: 'firstClick' | 'lastClick' | 'linear' | 'timeDecay' | 'positionBased';
  lookbackWindow?: number; // days
  includeEcommerce?: boolean;
  groupBy?: 'date' | 'source' | 'campaign' | 'goal';
  filters?: {
    goalName?: string[];
    conversionAction?: string[];
    source?: string[];
    medium?: string[];
    campaign?: string[];
  };
}

/**
 * Analytics query result
 */
export interface AnalyticsResult<T = any> {
  data: T;
  isLoading: boolean;
  error?: Error;
  lastUpdated: number;
  cache: {
    isFromCache: boolean;
    cacheAge: number;
  };
  meta: {
    totalRows: number;
    samplingLevel: string;
    isDataGolden: boolean;
  };
}

/**
 * Real-time data result
 */
export interface RealtimeResult<T = any> {
  data: T;
  isConnected: boolean;
  isPaused: boolean;
  lastUpdate: number;
  updateCount: number;
  errorCount: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Traffic sources result
 */
export interface TrafficSourcesResult {
  sources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    newUsers: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversions: number;
    revenue: number;
    isGoogleAds: boolean;
  }>;
  summary: {
    totalSessions: number;
    totalUsers: number;
    googleAdsShare: number;
    organicShare: number;
    directShare: number;
    socialShare: number;
    referralShare: number;
  };
}

/**
 * Page performance result
 */
export interface PagePerformanceResult {
  pages: Array<{
    pagePath: string;
    pageTitle: string;
    pageViews: number;
    uniquePageViews: number;
    avgTimeOnPage: number;
    bounceRate: number;
    exitRate: number;
    conversions: number;
    conversionRate: number;
    pageValue: number;
  }>;
  summary: {
    totalPageViews: number;
    avgTimeOnPage: number;
    avgBounceRate: number;
    totalConversions: number;
    avgConversionRate: number;
  };
}

/**
 * Conversions result
 */
export interface ConversionsResult {
  conversions: Array<{
    goalName: string;
    goalCompletions: number;
    goalValue: number;
    goalConversionRate: number;
    source: string;
    medium: string;
    campaign: string;
    date: string;
  }>;
  ecommerce?: {
    transactions: number;
    revenue: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  summary: {
    totalConversions: number;
    totalValue: number;
    avgConversionRate: number;
    topPerformingGoal: string;
    topPerformingSource: string;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate cache key for analytics queries
 */
const generateAnalyticsCacheKey = (config: AnalyticsQueryConfig): string => {
  const { dateRange, metrics, dimensions, filters, orderBy } = config;
  return `analytics:${JSON.stringify({ dateRange, metrics, dimensions, filters, orderBy })}`;
};

/**
 * Transform raw GA4 data to analytics result format
 */
const transformAnalyticsData = (rawData: any, fromCache: boolean = false, cacheAge: number = 0): AnalyticsResult => {
  return {
    data: rawData?.rows || [],
    isLoading: false,
    lastUpdated: Date.now(),
    cache: {
      isFromCache: fromCache,
      cacheAge
    },
    meta: {
      totalRows: rawData?.rowCount || 0,
      samplingLevel: rawData?.metadata?.samplingLevel || 'HIGHER_PRECISION',
      isDataGolden: rawData?.metadata?.dataLossFromOtherRow || false
    }
  };
};

/**
 * Mock data generators for development
 */
const generateMockTrafficSources = (): TrafficSourcesResult => {
  const sources = [
    { source: 'google', medium: 'organic', sessions: 12500, users: 8900, newUsers: 6200, bounceRate: 0.45, avgSessionDuration: 185, conversions: 89, revenue: 4500, isGoogleAds: false },
    { source: 'google', medium: 'cpc', sessions: 8900, users: 6700, newUsers: 5100, bounceRate: 0.38, avgSessionDuration: 210, conversions: 145, revenue: 8900, isGoogleAds: true },
    { source: 'facebook', medium: 'social', sessions: 3400, users: 2800, newUsers: 2200, bounceRate: 0.52, avgSessionDuration: 140, conversions: 34, revenue: 1700, isGoogleAds: false },
    { source: 'direct', medium: '(none)', sessions: 5600, users: 4200, newUsers: 2800, bounceRate: 0.41, avgSessionDuration: 195, conversions: 67, revenue: 3400, isGoogleAds: false },
    { source: 'bing', medium: 'cpc', sessions: 1200, users: 980, newUsers: 740, bounceRate: 0.46, avgSessionDuration: 175, conversions: 18, revenue: 890, isGoogleAds: false }
  ];

  const totalSessions = sources.reduce((sum, s) => sum + s.sessions, 0);
  const googleAdsShare = sources.filter(s => s.isGoogleAds).reduce((sum, s) => sum + s.sessions, 0) / totalSessions;
  
  return {
    sources,
    summary: {
      totalSessions,
      totalUsers: sources.reduce((sum, s) => sum + s.users, 0),
      googleAdsShare,
      organicShare: sources.filter(s => s.medium === 'organic').reduce((sum, s) => sum + s.sessions, 0) / totalSessions,
      directShare: sources.filter(s => s.medium === '(none)').reduce((sum, s) => sum + s.sessions, 0) / totalSessions,
      socialShare: sources.filter(s => s.medium === 'social').reduce((sum, s) => sum + s.sessions, 0) / totalSessions,
      referralShare: sources.filter(s => s.medium === 'referral').reduce((sum, s) => sum + s.sessions, 0) / totalSessions
    }
  };
};

const generateMockPagePerformance = (): PagePerformanceResult => {
  const pages = [
    { pagePath: '/', pageTitle: 'Home Page', pageViews: 15600, uniquePageViews: 12400, avgTimeOnPage: 145, bounceRate: 0.42, exitRate: 0.28, conversions: 89, conversionRate: 0.057, pageValue: 12.50 },
    { pagePath: '/products', pageTitle: 'Products', pageViews: 8900, uniquePageViews: 7200, avgTimeOnPage: 210, bounceRate: 0.35, exitRate: 0.45, conversions: 156, conversionRate: 0.175, pageValue: 24.80 },
    { pagePath: '/about', pageTitle: 'About Us', pageViews: 3400, uniquePageViews: 2900, avgTimeOnPage: 95, bounceRate: 0.58, exitRate: 0.52, conversions: 12, conversionRate: 0.035, pageValue: 3.20 },
    { pagePath: '/contact', pageTitle: 'Contact', pageViews: 2100, uniquePageViews: 1800, avgTimeOnPage: 120, bounceRate: 0.48, exitRate: 0.67, conversions: 45, conversionRate: 0.214, pageValue: 15.60 },
    { pagePath: '/blog', pageTitle: 'Blog', pageViews: 5600, uniquePageViews: 4800, avgTimeOnPage: 180, bounceRate: 0.41, exitRate: 0.38, conversions: 28, conversionRate: 0.050, pageValue: 8.40 }
  ];

  return {
    pages,
    summary: {
      totalPageViews: pages.reduce((sum, p) => sum + p.pageViews, 0),
      avgTimeOnPage: pages.reduce((sum, p) => sum + p.avgTimeOnPage, 0) / pages.length,
      avgBounceRate: pages.reduce((sum, p) => sum + p.bounceRate, 0) / pages.length,
      totalConversions: pages.reduce((sum, p) => sum + p.conversions, 0),
      avgConversionRate: pages.reduce((sum, p) => sum + p.conversionRate, 0) / pages.length
    }
  };
};

const generateMockConversions = (): ConversionsResult => {
  const conversions = [
    { goalName: 'Purchase', goalCompletions: 234, goalValue: 12400, goalConversionRate: 0.025, source: 'google', medium: 'cpc', campaign: 'summer-sale', date: '2025-08-02' },
    { goalName: 'Newsletter Signup', goalCompletions: 456, goalValue: 2280, goalConversionRate: 0.048, source: 'google', medium: 'organic', campaign: '(not set)', date: '2025-08-02' },
    { goalName: 'Contact Form', goalCompletions: 89, goalValue: 4450, goalConversionRate: 0.019, source: 'facebook', medium: 'social', campaign: 'brand-awareness', date: '2025-08-02' },
    { goalName: 'Demo Request', goalCompletions: 67, goalValue: 6700, goalConversionRate: 0.014, source: 'direct', medium: '(none)', campaign: '(not set)', date: '2025-08-02' },
    { goalName: 'Download', goalCompletions: 123, goalValue: 615, goalConversionRate: 0.026, source: 'bing', medium: 'cpc', campaign: 'competitor-keywords', date: '2025-08-02' }
  ];

  return {
    conversions,
    ecommerce: {
      transactions: 234,
      revenue: 12400,
      avgOrderValue: 52.99,
      conversionRate: 0.025
    },
    summary: {
      totalConversions: conversions.reduce((sum, c) => sum + c.goalCompletions, 0),
      totalValue: conversions.reduce((sum, c) => sum + c.goalValue, 0),
      avgConversionRate: conversions.reduce((sum, c) => sum + c.goalConversionRate, 0) / conversions.length,
      topPerformingGoal: 'Newsletter Signup',
      topPerformingSource: 'google'
    }
  };
};

// ============================================================================
// SPECIALIZED TOOL HOOKS
// ============================================================================

/**
 * Hook for general analytics queries with date range support
 * 
 * @example
 * ```tsx
 * function AnalyticsDashboard() {
 *   const { 
 *     data, 
 *     isLoading, 
 *     error, 
 *     refetch, 
 *     updateDateRange 
 *   } = useMCPAnalytics({
 *     dateRange: {
 *       startDate: '2025-01-01',
 *       endDate: '2025-01-31'
 *     },
 *     metrics: ['sessions', 'users', 'conversions'],
 *     dimensions: ['source', 'medium'],
 *     refreshInterval: 30000
 *   });
 *   
 *   if (isLoading) return <div>Loading analytics...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Analytics Overview</h2>
 *       <div>Total rows: {data.meta.totalRows}</div>
 *       <div>From cache: {data.cache.isFromCache ? 'Yes' : 'No'}</div>
 *       <button onClick={refetch}>Refresh</button>
 *       <button onClick={() => updateDateRange('2025-02-01', '2025-02-28')}>
 *         Update Date Range
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPAnalytics = (config: AnalyticsQueryConfig) => {
  const { status } = useMCPStatus();
  const cache = useCachedData<any>();
  const [result, setResult] = useState<AnalyticsResult>({
    data: [],
    isLoading: true,
    lastUpdated: 0,
    cache: { isFromCache: false, cacheAge: 0 },
    meta: { totalRows: 0, samplingLevel: 'HIGHER_PRECISION', isDataGolden: false }
  });

  const [currentConfig, setCurrentConfig] = useState(config);
  const cacheKey = useMemo(() => generateAnalyticsCacheKey(currentConfig), [currentConfig]);

  const { execute: fetchAnalytics, isRetrying } = useRetryableOperation(
    async () => {
      // Check cache first
      if (currentConfig.enableCache !== false) {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
          const cacheAge = Date.now() - (cachedData.timestamp || 0);
          setResult(transformAnalyticsData(cachedData, true, cacheAge));
          return;
        }
      }

      setResult(prev => ({ ...prev, isLoading: true, error: undefined }));

      // TODO: Replace with actual MCP analytics call
      // For now, simulate API call with mock data
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      const mockData = {
        rows: [
          { source: 'google', medium: 'organic', sessions: 12500, users: 8900, conversions: 89 },
          { source: 'google', medium: 'cpc', sessions: 8900, users: 6700, conversions: 145 },
          { source: 'facebook', medium: 'social', sessions: 3400, users: 2800, conversions: 34 },
          { source: 'direct', medium: '(none)', sessions: 5600, users: 4200, conversions: 67 }
        ],
        rowCount: 4,
        metadata: {
          samplingLevel: 'HIGHER_PRECISION',
          dataLossFromOtherRow: false
        }
      };

      // Cache the result
      if (currentConfig.enableCache !== false) {
        cache.set(cacheKey, { ...mockData, timestamp: Date.now() }, { 
          ttl: currentConfig.cacheTime || 300000 // 5 minutes default
        });
      }

      setResult(transformAnalyticsData(mockData));
    },
    {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffFactor: 2
    }
  );

  const refetch = useCallback(() => {
    cache.invalidate(cacheKey);
    fetchAnalytics();
  }, [cache, cacheKey, fetchAnalytics]);

  const updateDateRange = useCallback((startDate: string, endDate: string) => {
    setCurrentConfig(prev => ({
      ...prev,
      dateRange: { startDate, endDate }
    }));
  }, []);

  const updateFilters = useCallback((filters: Record<string, any>) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  // Auto-refresh if interval is specified
  useAutoRefresh(
    {
      interval: currentConfig.refreshInterval || 0,
      enabled: !!currentConfig.refreshInterval && status === 'connected'
    },
    fetchAnalytics
  );

  // Initial fetch
  useEffect(() => {
    if (status === 'connected') {
      fetchAnalytics();
    }
  }, [status, fetchAnalytics, currentConfig]);

  return {
    ...result,
    isRetrying,
    refetch,
    updateDateRange,
    updateFilters,
    config: currentConfig
  };
};

/**
 * Hook for real-time data with auto-refresh capabilities
 * 
 * @example
 * ```tsx
 * function RealtimeDashboard() {
 *   const { 
 *     data, 
 *     isConnected, 
 *     isPaused, 
 *     togglePause, 
 *     connectionQuality 
 *   } = useMCPRealtime({
 *     updateFrequency: 5000,
 *     autoRefresh: true,
 *     thresholdPercent: 5,
 *     onDataChange: (newData, oldData) => {
 *       console.log('Data changed:', { newData, oldData });
 *     }
 *   });
 *   
 *   return (
 *     <div>
 *       <h2>Real-time Analytics</h2>
 *       <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
 *       <div>Quality: {connectionQuality}</div>
 *       <button onClick={togglePause}>
 *         {isPaused ? 'Resume' : 'Pause'}
 *       </button>
 *       {data && (
 *         <div>
 *           <div>Active Users: {data.activeUsers}</div>
 *           <div>Page Views: {data.pageViews}</div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPRealtime = (config: RealtimeConfig) => {
  const { status } = useMCPStatus();
  const [result, setResult] = useState<RealtimeResult>({
    data: null,
    isConnected: false,
    isPaused: false,
    lastUpdate: 0,
    updateCount: 0,
    errorCount: 0,
    connectionQuality: 'excellent'
  });

  const previousDataRef = useRef<any>(null);
  const errorCountRef = useRef(0);
  const successCountRef = useRef(0);

  const { metrics, lastUpdated, isPaused: metricsIsPaused } = useMetrics({
    metrics: ['activeUsers', 'screenPageViews', 'sessions'],
    updateFrequency: config.updateFrequency,
    thresholdPercent: config.thresholdPercent
  });

  const togglePause = useCallback(() => {
    setResult(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const calculateConnectionQuality = useCallback(() => {
    const total = errorCountRef.current + successCountRef.current;
    if (total === 0) return 'excellent';
    
    const successRate = successCountRef.current / total;
    if (successRate >= 0.95) return 'excellent';
    if (successRate >= 0.85) return 'good';
    if (successRate >= 0.70) return 'fair';
    return 'poor';
  }, []);

  // Update real-time data
  useEffect(() => {
    if (metrics && !result.isPaused) {
      const newData = {
        activeUsers: metrics.activeUsers || Math.floor(Math.random() * 500) + 100,
        pageViews: metrics.screenPageViews || Math.floor(Math.random() * 1000) + 200,
        sessions: metrics.sessions || Math.floor(Math.random() * 300) + 50,
        timestamp: Date.now()
      };

      // Check if data changed significantly
      const hasSignificantChange = !previousDataRef.current || 
        Object.keys(newData).some(key => {
          if (key === 'timestamp') return false;
          const oldValue = previousDataRef.current?.[key] || 0;
          const newValue = newData[key as keyof typeof newData] as number;
          const changePercent = Math.abs((newValue - oldValue) / oldValue) * 100;
          return changePercent >= (config.thresholdPercent || 5);
        });

      if (hasSignificantChange && config.onDataChange && previousDataRef.current) {
        config.onDataChange(newData, previousDataRef.current);
      }

      previousDataRef.current = newData;
      successCountRef.current++;

      setResult(prev => ({
        ...prev,
        data: newData,
        isConnected: status === 'connected',
        lastUpdate: Date.now(),
        updateCount: prev.updateCount + 1,
        connectionQuality: calculateConnectionQuality()
      }));
    }
  }, [metrics, result.isPaused, status, config, calculateConnectionQuality]);

  // Handle errors
  useEffect(() => {
    if (status === 'error' || status === 'disconnected') {
      errorCountRef.current++;
      
      if (config.onError) {
        config.onError(new Error(`Connection ${status}`));
      }

      setResult(prev => ({
        ...prev,
        isConnected: false,
        errorCount: prev.errorCount + 1,
        connectionQuality: calculateConnectionQuality()
      }));

      // Auto-pause on too many errors
      if (config.pauseOnError && errorCountRef.current >= (config.maxRetries || 5)) {
        setResult(prev => ({ ...prev, isPaused: true }));
      }
    }
  }, [status, config, calculateConnectionQuality]);

  return {
    ...result,
    togglePause
  };
};

/**
 * Hook for traffic sources breakdown with filtering
 * 
 * @example
 * ```tsx
 * function TrafficSourcesWidget() {
 *   const { 
 *     data, 
 *     isLoading, 
 *     error, 
 *     refresh, 
 *     toggleGoogleAds,
 *     updateFilters 
 *   } = useMCPTrafficSources({
 *     includeGoogleAds: true,
 *     groupBy: 'sourceMedium',
 *     sortBy: 'sessions',
 *     sortOrder: 'desc',
 *     limit: 10
 *   });
 *   
 *   if (isLoading) return <div>Loading traffic sources...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Traffic Sources</h3>
 *       <div>Google Ads Share: {(data.summary.googleAdsShare * 100).toFixed(1)}%</div>
 *       <button onClick={toggleGoogleAds}>Toggle Google Ads</button>
 *       <button onClick={refresh}>Refresh</button>
 *       {data.sources.map((source, index) => (
 *         <div key={index}>
 *           {source.source}/{source.medium}: {source.sessions} sessions
 *           {source.isGoogleAds && <span> (Google Ads)</span>}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPTrafficSources = (config: TrafficSourcesConfig) => {
  const [data, setData] = useState<TrafficSourcesResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [currentConfig, setCurrentConfig] = useState(config);

  const cache = useCachedData<TrafficSourcesResult>();
  const cacheKey = useMemo(() => `traffic-sources:${JSON.stringify(currentConfig)}`, [currentConfig]);

  const fetchTrafficSources = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Check cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
        return;
      }

      // TODO: Replace with actual MCP traffic sources call
      // For now, use mock data
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
      
      let mockData = generateMockTrafficSources();

      // Apply filters
      if (!currentConfig.includeGoogleAds) {
        mockData.sources = mockData.sources.filter(s => !s.isGoogleAds);
      }

      if (currentConfig.filters) {
        const { source, medium, campaign } = currentConfig.filters;
        if (source?.length) {
          mockData.sources = mockData.sources.filter(s => source.includes(s.source));
        }
        if (medium?.length) {
          mockData.sources = mockData.sources.filter(s => medium.includes(s.medium));
        }
      }

      // Apply sorting
      if (currentConfig.sortBy) {
        mockData.sources.sort((a, b) => {
          const aVal = a[currentConfig.sortBy as keyof typeof a] as number;
          const bVal = b[currentConfig.sortBy as keyof typeof b] as number;
          return currentConfig.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
      }

      // Apply limit
      if (currentConfig.limit) {
        mockData.sources = mockData.sources.slice(0, currentConfig.limit);
      }

      // Recalculate summary after filtering
      const totalSessions = mockData.sources.reduce((sum, s) => sum + s.sessions, 0);
      mockData.summary = {
        ...mockData.summary,
        totalSessions,
        totalUsers: mockData.sources.reduce((sum, s) => sum + s.users, 0),
        googleAdsShare: mockData.sources.filter(s => s.isGoogleAds).reduce((sum, s) => sum + s.sessions, 0) / totalSessions
      };

      cache.set(cacheKey, mockData, { ttl: 300000 }); // 5 minutes
      setData(mockData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentConfig, cache, cacheKey]);

  const refresh = useCallback(() => {
    cache.invalidate(cacheKey);
    fetchTrafficSources();
  }, [cache, cacheKey, fetchTrafficSources]);

  const toggleGoogleAds = useCallback(() => {
    setCurrentConfig(prev => ({
      ...prev,
      includeGoogleAds: !prev.includeGoogleAds
    }));
  }, []);

  const updateFilters = useCallback((filters: TrafficSourcesConfig['filters']) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  const updateSorting = useCallback((sortBy: TrafficSourcesConfig['sortBy'], sortOrder?: TrafficSourcesConfig['sortOrder']) => {
    setCurrentConfig(prev => ({
      ...prev,
      sortBy,
      sortOrder: sortOrder || prev.sortOrder
    }));
  }, []);

  // Initial fetch and refetch on config changes
  useEffect(() => {
    fetchTrafficSources();
  }, [fetchTrafficSources]);

  return {
    data,
    isLoading,
    error,
    refresh,
    toggleGoogleAds,
    updateFilters,
    updateSorting,
    config: currentConfig
  };
};

/**
 * Hook for page performance metrics with sorting
 * 
 * @example
 * ```tsx
 * function PagePerformanceWidget() {
 *   const { 
 *     data, 
 *     isLoading, 
 *     error, 
 *     refresh,
 *     updateSorting,
 *     updateFilters 
 *   } = useMCPPagePerformance({
 *     sortBy: 'pageViews',
 *     sortOrder: 'desc',
 *     limit: 20,
 *     includeMetrics: ['pageViews', 'uniquePageViews', 'avgTimeOnPage', 'bounceRate']
 *   });
 *   
 *   if (isLoading) return <div>Loading page performance...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Page Performance</h3>
 *       <div>Total Page Views: {data.summary.totalPageViews}</div>
 *       <select onChange={(e) => updateSorting(e.target.value as any)}>
 *         <option value="pageViews">Page Views</option>
 *         <option value="avgTimeOnPage">Time on Page</option>
 *         <option value="bounceRate">Bounce Rate</option>
 *         <option value="conversionRate">Conversion Rate</option>
 *       </select>
 *       <button onClick={refresh}>Refresh</button>
 *       {data.pages.map((page, index) => (
 *         <div key={index}>
 *           {page.pageTitle}: {page.pageViews} views, {page.bounceRate.toFixed(1)}% bounce
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPPagePerformance = (config: PagePerformanceConfig) => {
  const [data, setData] = useState<PagePerformanceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [currentConfig, setCurrentConfig] = useState(config);

  const cache = useCachedData<PagePerformanceResult>();
  const cacheKey = useMemo(() => `page-performance:${JSON.stringify(currentConfig)}`, [currentConfig]);

  const fetchPagePerformance = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Check cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
        return;
      }

      // TODO: Replace with actual MCP page performance call
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));
      
      let mockData = generateMockPagePerformance();

      // Apply filters
      if (currentConfig.filters) {
        const { pagePath, pageTitle } = currentConfig.filters;
        if (pagePath?.length) {
          mockData.pages = mockData.pages.filter(p => 
            pagePath.some(path => p.pagePath.includes(path))
          );
        }
        if (pageTitle?.length) {
          mockData.pages = mockData.pages.filter(p => 
            pageTitle.some(title => p.pageTitle.toLowerCase().includes(title.toLowerCase()))
          );
        }
      }

      // Apply sorting
      if (currentConfig.sortBy) {
        mockData.pages.sort((a, b) => {
          const aVal = a[currentConfig.sortBy as keyof typeof a] as number;
          const bVal = b[currentConfig.sortBy as keyof typeof b] as number;
          return currentConfig.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
      }

      // Apply limit
      if (currentConfig.limit) {
        mockData.pages = mockData.pages.slice(0, currentConfig.limit);
      }

      // Recalculate summary
      mockData.summary = {
        totalPageViews: mockData.pages.reduce((sum, p) => sum + p.pageViews, 0),
        avgTimeOnPage: mockData.pages.reduce((sum, p) => sum + p.avgTimeOnPage, 0) / mockData.pages.length,
        avgBounceRate: mockData.pages.reduce((sum, p) => sum + p.bounceRate, 0) / mockData.pages.length,
        totalConversions: mockData.pages.reduce((sum, p) => sum + p.conversions, 0),
        avgConversionRate: mockData.pages.reduce((sum, p) => sum + p.conversionRate, 0) / mockData.pages.length
      };

      cache.set(cacheKey, mockData, { ttl: 300000 });
      setData(mockData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentConfig, cache, cacheKey]);

  const refresh = useCallback(() => {
    cache.invalidate(cacheKey);
    fetchPagePerformance();
  }, [cache, cacheKey, fetchPagePerformance]);

  const updateSorting = useCallback((sortBy: PagePerformanceConfig['sortBy'], sortOrder?: PagePerformanceConfig['sortOrder']) => {
    setCurrentConfig(prev => ({
      ...prev,
      sortBy,
      sortOrder: sortOrder || prev.sortOrder
    }));
  }, []);

  const updateFilters = useCallback((filters: PagePerformanceConfig['filters']) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  const updateLimit = useCallback((limit: number) => {
    setCurrentConfig(prev => ({
      ...prev,
      limit
    }));
  }, []);

  // Initial fetch and refetch on config changes
  useEffect(() => {
    fetchPagePerformance();
  }, [fetchPagePerformance]);

  return {
    data,
    isLoading,
    error,
    refresh,
    updateSorting,
    updateFilters,
    updateLimit,
    config: currentConfig
  };
};

/**
 * Hook for conversion data with goals tracking
 * 
 * @example
 * ```tsx
 * function ConversionsWidget() {
 *   const { 
 *     data, 
 *     isLoading, 
 *     error, 
 *     refresh,
 *     updateGoals,
 *     updateAttribution 
 *   } = useMCPConversions({
 *     goals: ['Purchase', 'Newsletter Signup', 'Contact Form'],
 *     attributionModel: 'lastClick',
 *     lookbackWindow: 30,
 *     includeEcommerce: true
 *   });
 *   
 *   if (isLoading) return <div>Loading conversions...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Conversions</h3>
 *       <div>Total Conversions: {data.summary.totalConversions}</div>
 *       <div>Total Value: ${data.summary.totalValue}</div>
 *       <div>Top Goal: {data.summary.topPerformingGoal}</div>
 *       
 *       {data.ecommerce && (
 *         <div>
 *           <h4>E-commerce</h4>
 *           <div>Revenue: ${data.ecommerce.revenue}</div>
 *           <div>Avg Order Value: ${data.ecommerce.avgOrderValue}</div>
 *         </div>
 *       )}
 *       
 *       <button onClick={refresh}>Refresh</button>
 *       
 *       {data.conversions.map((conversion, index) => (
 *         <div key={index}>
 *           {conversion.goalName}: {conversion.goalCompletions} completions
 *           (${conversion.goalValue})
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPConversions = (config: ConversionsConfig) => {
  const [data, setData] = useState<ConversionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [currentConfig, setCurrentConfig] = useState(config);

  const cache = useCachedData<ConversionsResult>();
  const cacheKey = useMemo(() => `conversions:${JSON.stringify(currentConfig)}`, [currentConfig]);

  const fetchConversions = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Check cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
        return;
      }

      // TODO: Replace with actual MCP conversions call
      await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 550));
      
      let mockData = generateMockConversions();

      // Apply goal filters
      if (currentConfig.goals?.length) {
        mockData.conversions = mockData.conversions.filter(c => 
          currentConfig.goals!.includes(c.goalName)
        );
      }

      // Apply other filters
      if (currentConfig.filters) {
        const { goalName, source, medium, campaign } = currentConfig.filters;
        
        if (goalName?.length) {
          mockData.conversions = mockData.conversions.filter(c => 
            goalName.includes(c.goalName)
          );
        }
        if (source?.length) {
          mockData.conversions = mockData.conversions.filter(c => 
            source.includes(c.source)
          );
        }
        if (medium?.length) {
          mockData.conversions = mockData.conversions.filter(c => 
            medium.includes(c.medium)
          );
        }
        if (campaign?.length) {
          mockData.conversions = mockData.conversions.filter(c => 
            campaign.includes(c.campaign)
          );
        }
      }

      // Remove ecommerce data if not included
      if (!currentConfig.includeEcommerce) {
        delete mockData.ecommerce;
      }

      // Recalculate summary
      if (mockData.conversions.length > 0) {
        mockData.summary = {
          totalConversions: mockData.conversions.reduce((sum, c) => sum + c.goalCompletions, 0),
          totalValue: mockData.conversions.reduce((sum, c) => sum + c.goalValue, 0),
          avgConversionRate: mockData.conversions.reduce((sum, c) => sum + c.goalConversionRate, 0) / mockData.conversions.length,
          topPerformingGoal: mockData.conversions.sort((a, b) => b.goalCompletions - a.goalCompletions)[0]?.goalName || '',
          topPerformingSource: mockData.conversions.sort((a, b) => b.goalCompletions - a.goalCompletions)[0]?.source || ''
        };
      }

      cache.set(cacheKey, mockData, { ttl: 300000 });
      setData(mockData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentConfig, cache, cacheKey]);

  const refresh = useCallback(() => {
    cache.invalidate(cacheKey);
    fetchConversions();
  }, [cache, cacheKey, fetchConversions]);

  const updateGoals = useCallback((goals: string[]) => {
    setCurrentConfig(prev => ({
      ...prev,
      goals
    }));
  }, []);

  const updateAttribution = useCallback((attributionModel: ConversionsConfig['attributionModel']) => {
    setCurrentConfig(prev => ({
      ...prev,
      attributionModel
    }));
  }, []);

  const updateFilters = useCallback((filters: ConversionsConfig['filters']) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  const toggleEcommerce = useCallback(() => {
    setCurrentConfig(prev => ({
      ...prev,
      includeEcommerce: !prev.includeEcommerce
    }));
  }, []);

  // Initial fetch and refetch on config changes
  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  return {
    data,
    isLoading,
    error,
    refresh,
    updateGoals,
    updateAttribution,
    updateFilters,
    toggleEcommerce,
    config: currentConfig
  };
};