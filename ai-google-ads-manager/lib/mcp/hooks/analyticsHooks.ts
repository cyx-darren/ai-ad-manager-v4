/**
 * Analytics React Hooks
 * 
 * React hooks for integrating connection analytics, uptime tracking,
 * quality trends, and performance metrics into React components.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalyticsManager, getGlobalAnalyticsManager } from '../utils/analyticsManager';
import {
  AnalyticsSummary,
  UptimeAnalytics,
  QualityTrends,
  PerformanceMetrics,
  ConnectionEvent,
  AggregatedData,
  AnalyticsPeriod,
  AnalyticsConfig,
  Outage
} from '../types/analytics';
import { ConnectionState, NetworkQuality, ConnectionQualityMetrics } from '../types/connection';
import { ServerHealthState, ServiceStatus } from '../types/serverHealth';

/**
 * Options for analytics hooks
 */
export interface AnalyticsHookOptions {
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Time period for analytics */
  period?: { start: number; end: number };
  /** Enable automatic updates */
  autoUpdate?: boolean;
  /** Analytics configuration */
  config?: Partial<AnalyticsConfig>;
}

/**
 * Main analytics hook for comprehensive historical analytics
 */
export function useAnalytics(options: AnalyticsHookOptions = {}) {
  const {
    updateInterval = 30000, // 30 seconds
    period,
    autoUpdate = true,
    config
  } = options;

  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager(config)
  );
  
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Update analytics summary
  const updateSummary = useCallback(async () => {
    try {
      setError(null);
      const newSummary = analyticsManager.getAnalyticsSummary(period);
      setSummary(newSummary);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update analytics');
      setIsLoading(false);
    }
  }, [analyticsManager, period]);

  // Record a new event
  const recordEvent = useCallback((
    type: ConnectionEvent['type'],
    connectionState: ConnectionState,
    options: {
      networkQuality?: NetworkQuality;
      metrics?: ConnectionQualityMetrics;
      serverHealth?: ServerHealthState;
      serviceStatus?: ServiceStatus;
      data?: Record<string, any>;
    } = {}
  ) => {
    analyticsManager.recordEvent(type, connectionState, options);
    // Trigger immediate update after recording
    updateSummary();
  }, [analyticsManager, updateSummary]);

  // Get aggregated data for specific periods
  const getAggregatedData = useCallback((periods: AnalyticsPeriod[]): AggregatedData[] => {
    return analyticsManager.getAggregatedData(periods);
  }, [analyticsManager]);

  // Manual refresh
  const refresh = useCallback(() => {
    updateSummary();
  }, [updateSummary]);

  // Set up auto-update
  useEffect(() => {
    updateSummary(); // Initial load

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateSummary();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateSummary, autoUpdate, updateInterval]);

  return {
    summary,
    isLoading,
    error,
    recordEvent,
    getAggregatedData,
    refresh,
    analyticsManager
  };
}

/**
 * Hook for uptime analytics specifically
 */
export function useUptimeAnalytics(options: AnalyticsHookOptions = {}) {
  const { updateInterval = 30000, period, autoUpdate = true, config } = options;
  
  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager(config)
  );
  
  const [uptime, setUptime] = useState<UptimeAnalytics | null>(null);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const updateUptime = useCallback(async () => {
    try {
      const uptimeData = analyticsManager.calculateUptimeAnalytics(period);
      setUptime(uptimeData);
      
      // Get recent outages
      const summary = analyticsManager.getAnalyticsSummary(period);
      const recentOutages = summary.recentEvents
        .filter(e => ['disconnected', 'error', 'timeout'].includes(e.type))
        .slice(-10); // Last 10 outage events
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update uptime analytics:', err);
      setIsLoading(false);
    }
  }, [analyticsManager, period]);

  useEffect(() => {
    updateUptime();

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateUptime();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateUptime, autoUpdate, updateInterval]);

  return {
    uptime,
    outages,
    isLoading,
    refresh: updateUptime
  };
}

/**
 * Hook for quality trends analytics
 */
export function useQualityTrends(options: AnalyticsHookOptions = {}) {
  const { updateInterval = 60000, period, autoUpdate = true, config } = options; // 1 minute default

  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager(config)
  );
  
  const [trends, setTrends] = useState<QualityTrends | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const updateTrends = useCallback(async () => {
    try {
      const trendsData = analyticsManager.calculateQualityTrends(period);
      setTrends(trendsData);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update quality trends:', err);
      setIsLoading(false);
    }
  }, [analyticsManager, period]);

  useEffect(() => {
    updateTrends();

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateTrends();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateTrends, autoUpdate, updateInterval]);

  return {
    trends,
    isLoading,
    refresh: updateTrends
  };
}

/**
 * Hook for performance metrics
 */
export function usePerformanceMetrics(options: AnalyticsHookOptions = {}) {
  const { updateInterval = 30000, period, autoUpdate = true, config } = options;

  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager(config)
  );
  
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const updateMetrics = useCallback(async () => {
    try {
      const metricsData = analyticsManager.calculatePerformanceMetrics(period);
      setMetrics(metricsData);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update performance metrics:', err);
      setIsLoading(false);
    }
  }, [analyticsManager, period]);

  useEffect(() => {
    updateMetrics();

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateMetrics();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateMetrics, autoUpdate, updateInterval]);

  return {
    metrics,
    isLoading,
    refresh: updateMetrics
  };
}

/**
 * Hook for recent connection events
 */
export function useConnectionEvents(options: { maxEvents?: number; autoUpdate?: boolean; updateInterval?: number } = {}) {
  const { maxEvents = 50, autoUpdate = true, updateInterval = 10000 } = options;

  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager()
  );
  
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const updateEvents = useCallback(async () => {
    try {
      const summary = analyticsManager.getAnalyticsSummary();
      setEvents(summary.recentEvents.slice(-maxEvents));
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update connection events:', err);
      setIsLoading(false);
    }
  }, [analyticsManager, maxEvents]);

  // Listen for new events
  useEffect(() => {
    const handleNewEvent = (event: ConnectionEvent) => {
      setEvents(prev => [...prev.slice(-(maxEvents - 1)), event]);
    };

    analyticsManager.addEventListener(handleNewEvent);

    return () => {
      analyticsManager.removeEventListener(handleNewEvent);
    };
  }, [analyticsManager, maxEvents]);

  useEffect(() => {
    updateEvents();

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateEvents();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateEvents, autoUpdate, updateInterval]);

  return {
    events,
    isLoading,
    refresh: updateEvents
  };
}

/**
 * Hook for historical comparison between periods
 */
export function useHistoricalComparison(
  currentPeriod: { start: number; end: number },
  previousPeriod: { start: number; end: number },
  options: { autoUpdate?: boolean; updateInterval?: number } = {}
) {
  const { autoUpdate = true, updateInterval = 60000 } = options;

  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager()
  );
  
  const [comparison, setComparison] = useState<{
    current: AnalyticsSummary;
    previous: AnalyticsSummary;
    changes: {
      uptimeChange: number;
      latencyChange: number;
      qualityChange: number;
      outageChange: number;
    };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const updateComparison = useCallback(async () => {
    try {
      const current = analyticsManager.getAnalyticsSummary(currentPeriod);
      const previous = analyticsManager.getAnalyticsSummary(previousPeriod);

      const uptimeChange = current.uptime.uptimePercentage - previous.uptime.uptimePercentage;
      const latencyChange = current.performance.latency.average - previous.performance.latency.average;
      const qualityChange = current.quality.analysis.averageScore - previous.quality.analysis.averageScore;
      const outageChange = current.uptime.outageCount - previous.uptime.outageCount;

      setComparison({
        current,
        previous,
        changes: {
          uptimeChange,
          latencyChange,
          qualityChange,
          outageChange
        }
      });
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to update historical comparison:', err);
      setIsLoading(false);
    }
  }, [analyticsManager, currentPeriod, previousPeriod]);

  useEffect(() => {
    updateComparison();

    if (autoUpdate) {
      const scheduleUpdate = () => {
        updateTimeoutRef.current = setTimeout(() => {
          updateComparison();
          scheduleUpdate();
        }, updateInterval);
      };
      scheduleUpdate();
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateComparison, autoUpdate, updateInterval]);

  return {
    comparison,
    isLoading,
    refresh: updateComparison
  };
}

/**
 * Hook for real-time analytics integration with connection monitoring
 */
export function useAnalyticsIntegration(
  connectionState?: ConnectionState,
  networkQuality?: NetworkQuality,
  serverHealth?: ServerHealthState,
  metrics?: ConnectionQualityMetrics
) {
  const [analyticsManager] = useState<AnalyticsManager>(() => 
    getGlobalAnalyticsManager()
  );

  const previousStateRef = useRef<{
    connectionState?: ConnectionState;
    networkQuality?: NetworkQuality;
    serverHealth?: ServerHealthState;
  }>({});

  // Record events when states change
  useEffect(() => {
    const prev = previousStateRef.current;
    
    // Record connection state changes
    if (connectionState && connectionState !== prev.connectionState) {
      let eventType: ConnectionEvent['type'] = 'connected';
      
      switch (connectionState) {
        case 'connected':
          eventType = prev.connectionState === 'disconnected' ? 'reconnected' : 'connected';
          break;
        case 'disconnected':
          eventType = 'disconnected';
          break;
        case 'error':
          eventType = 'error';
          break;
        case 'timeout':
          eventType = 'timeout';
          break;
      }

      analyticsManager.recordEvent(eventType, connectionState, {
        networkQuality,
        metrics,
        serverHealth
      });
    }

    // Record quality changes
    if (networkQuality && networkQuality !== prev.networkQuality && connectionState === 'connected') {
      analyticsManager.recordEvent('quality_changed', connectionState, {
        networkQuality,
        metrics,
        serverHealth
      });
    }

    // Record server health changes
    if (serverHealth && serverHealth !== prev.serverHealth) {
      analyticsManager.recordEvent('server_health_changed', connectionState || 'unknown', {
        networkQuality,
        metrics,
        serverHealth
      });
    }

    // Update previous state
    previousStateRef.current = {
      connectionState,
      networkQuality,
      serverHealth
    };
  }, [connectionState, networkQuality, serverHealth, metrics, analyticsManager]);

  // Record metrics periodically when connected
  useEffect(() => {
    if (connectionState === 'connected' && metrics) {
      const interval = setInterval(() => {
        analyticsManager.recordEvent('connected', connectionState, {
          networkQuality,
          metrics,
          serverHealth
        });
      }, 60000); // Record every minute when connected

      return () => clearInterval(interval);
    }
  }, [connectionState, networkQuality, serverHealth, metrics, analyticsManager]);

  return {
    analyticsManager,
    recordEvent: (type: ConnectionEvent['type'], data?: Record<string, any>) => {
      if (connectionState) {
        analyticsManager.recordEvent(type, connectionState, {
          networkQuality,
          metrics,
          serverHealth,
          data
        });
      }
    }
  };
}

export default {
  useAnalytics,
  useUptimeAnalytics,
  useQualityTrends,
  usePerformanceMetrics,
  useConnectionEvents,
  useHistoricalComparison,
  useAnalyticsIntegration
};