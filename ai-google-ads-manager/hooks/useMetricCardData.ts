/**
 * useMetricCardData Hook
 * 
 * React hook that integrates feature flags, MCP data fetching, fallback mechanisms,
 * and monitoring for metric cards.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { useMCPClient } from '@/lib/mcp/context';
import { MetricCardDataFetcher, MetricCardData } from '@/lib/mcp/dataFetchers/MetricCardDataFetcher';
import { metricCardMonitor } from '@/lib/monitoring/MetricCardMonitor';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

export type MetricCardType = 
  | 'total-campaigns'
  | 'impressions' 
  | 'click-rate'
  | 'sessions'
  | 'users'
  | 'bounce-rate'
  | 'conversions'
  | 'total-spend';

export interface UseMetricCardDataOptions {
  cardType: MetricCardType;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enableMonitoring?: boolean;
}

export interface MetricCardHookResult {
  data: MetricCardData;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isFeatureEnabled: boolean;
  source: 'mcp' | 'mock' | 'cache';
  lastUpdated: Date | null;
}

/**
 * Main hook
 */
export function useMetricCardData(options: UseMetricCardDataOptions): MetricCardHookResult {
  const { cardType, autoRefresh = false, refreshInterval = 300000, enableMonitoring = true } = options;
  
  // Context dependencies
  const { user } = useAuth();
  const { dateRange, selectedPropertyId } = useDashboard();
  const mcpClient = useMCPClient();
  
  // State
  const [data, setData] = useState<MetricCardData>({
    value: '', // Start with empty value, let the component handle fallback
    loading: true,
    source: 'mock'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs
  const dataFetcher = useRef<MetricCardDataFetcher | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const mounted = useRef(true);

  // Initialize data fetcher when MCP client is available
  useEffect(() => {
    if (mcpClient) {
      dataFetcher.current = new MetricCardDataFetcher(mcpClient, {
        cacheEnabled: true,
        cacheTtl: 300000, // 5 minutes
        retryAttempts: 3,
        retryDelay: 1000,
        timeoutMs: 10000
      });
    }

    return () => {
      mounted.current = false;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, [mcpClient]);

  // Check feature flag status
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const checkFeatureFlag = async () => {
      try {
        const flagName = `${cardType.replace('-', '_')}_card_mcp`;
        const enabled = await featureFlagManager.isEnabled(flagName, user?.id, user?.email);
        setIsFeatureEnabled(enabled);

        // Subscribe to flag changes
        unsubscribe = featureFlagManager.subscribe(flagName, (enabled) => {
          setIsFeatureEnabled(enabled);
          // Refresh data when flag changes
          if (mounted.current) {
            refreshData();
          }
        });
      } catch (error) {
        console.error('Error checking feature flag:', error);
        setIsFeatureEnabled(false);
      }
    };

    checkFeatureFlag();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [cardType, user?.id, user?.email]);

  /**
   * Fetch data based on card type
   */
  const fetchCardData = useCallback(async (): Promise<MetricCardData> => {
    if (!dataFetcher.current) {
      throw new Error('Data fetcher not initialized');
    }

    const fetchOptions = {
      dateRange: dateRange ? {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      } : undefined,
      propertyId: selectedPropertyId,
      userId: user?.id,
      userRole: user?.email?.includes('@admin.') ? 'admin' : 'user'
    };

    switch (cardType) {
      case 'total-campaigns':
        return dataFetcher.current.fetchTotalCampaigns(fetchOptions);
      case 'impressions':
        return dataFetcher.current.fetchTotalImpressions(fetchOptions);
      case 'click-rate':
        return dataFetcher.current.fetchClickRate(fetchOptions);
      case 'sessions':
        return dataFetcher.current.fetchTotalSessions(fetchOptions);
      case 'users':
        return dataFetcher.current.fetchTotalUsers(fetchOptions);
      case 'bounce-rate':
        return dataFetcher.current.fetchBounceRate(fetchOptions);
      case 'conversions':
        return dataFetcher.current.fetchConversions(fetchOptions);
      case 'total-spend':
        return dataFetcher.current.fetchTotalSpend(fetchOptions);
      default:
        throw new Error(`Unknown card type: ${cardType}`);
    }
  }, [cardType, dateRange, selectedPropertyId, user?.id, user?.email]);

  /**
   * Refresh data with monitoring
   */
  const refreshData = useCallback(async () => {
    if (!mounted.current) return;
    
    // Wait for MCP client and data fetcher to be ready
    if (!mcpClient || !dataFetcher.current) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Record monitoring event
      if (enableMonitoring) {
        metricCardMonitor.recordEvent({
          type: 'fetch_start',
          cardId: cardType
        });
      }

      const newData = await fetchCardData();
      
      if (mounted.current) {
        console.log(`[${cardType}] Setting new data:`, newData.value, 'source:', newData.source);
        setData(newData);
        setLastUpdated(new Date());
        
        // Record success
        if (enableMonitoring) {
          metricCardMonitor.recordEvent({
            type: 'fetch_success',
            cardId: cardType,
            duration: Date.now() - startTime,
            source: newData.source
          });

          // Record cache hit/miss
          if (newData.source === 'cache') {
            metricCardMonitor.recordEvent({
              type: 'cache_hit',
              cardId: cardType
            });
          } else {
            metricCardMonitor.recordEvent({
              type: 'cache_miss',
              cardId: cardType
            });
          }

          // Record fallback usage
          if (newData.source === 'mock') {
            metricCardMonitor.recordEvent({
              type: 'fallback_used',
              cardId: cardType
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (mounted.current) {
        setError(errorMessage);
        
        // Keep the last data if available, just show error
        setData(prev => ({
          ...prev,
          error: errorMessage,
          loading: false
        }));
      }

      // Record error
      if (enableMonitoring) {
        metricCardMonitor.recordEvent({
          type: 'fetch_error',
          cardId: cardType,
          duration: Date.now() - startTime,
          error: errorMessage
        });
      }

      console.error(`Error fetching data for ${cardType}:`, err);
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [cardType, fetchCardData, enableMonitoring, mcpClient]);

  // Initial data load - only run once when component mounts
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh data when key dependencies change
  useEffect(() => {
    if (mounted.current && !isLoading) {
      refreshData();
    }
  }, [dateRange, selectedPropertyId, cardType, user?.id]); // Only the values that actually should trigger refresh

  // Refresh data when MCP client becomes available
  useEffect(() => {
    if (mcpClient && dataFetcher.current && mounted.current) {
      refreshData();
    }
  }, [mcpClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const timer = setInterval(() => {
        if (mounted.current) {
          refreshData();
        }
      }, refreshInterval);

      refreshTimer.current = timer;

      return () => {
        if (timer) {
          clearInterval(timer);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshData]);

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  return {
    data,
    isLoading,
    error,
    refresh: manualRefresh,
    isFeatureEnabled,
    source: data.source || 'mock',
    lastUpdated
  };
}

/**
 * Hook for multiple metric cards
 */
export function useMultipleMetricCards(cardTypes: MetricCardType[]): Record<MetricCardType, MetricCardHookResult> {
  const results: Record<string, MetricCardHookResult> = {};

  cardTypes.forEach(cardType => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[cardType] = useMetricCardData({ cardType });
  });

  return results as Record<MetricCardType, MetricCardHookResult>;
}

/**
 * Hook for metric cards health monitoring
 */
export function useMetricCardsHealth() {
  const [healthSummary, setHealthSummary] = useState(metricCardMonitor.getHealthSummary());
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Update health summary periodically
    const healthInterval = setInterval(() => {
      setHealthSummary(metricCardMonitor.getHealthSummary());
    }, 30000); // Every 30 seconds

    // Subscribe to alerts
    const unsubscribeAlerts = metricCardMonitor.onAlert((alert) => {
      setAlerts(prev => [...prev, alert].slice(-10)); // Keep last 10 alerts
    });

    return () => {
      clearInterval(healthInterval);
      unsubscribeAlerts();
    };
  }, []);

  return {
    healthSummary,
    alerts,
    getCardMetrics: metricCardMonitor.getCardMetrics.bind(metricCardMonitor),
    exportMetrics: metricCardMonitor.exportMetrics.bind(metricCardMonitor)
  };
}