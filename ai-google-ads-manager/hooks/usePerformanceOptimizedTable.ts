/**
 * Performance Optimized Table Hook
 * Hook for managing performance optimization features in campaign tables
 * (Phase 7 of Subtask 29.3)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Campaign } from '../lib/mcp/types/analytics';
import { useFeatureFlag } from '../lib/mcp/hooks/featureFlags';
import { campaignDataCache } from '../lib/mcp/cache/CampaignDataCache';
import { tablePerformanceMonitor } from '../utils/performance/tableMetrics';

interface PerformanceConfig {
  enableVirtualization: boolean;
  enableCaching: boolean;
  enableBackgroundSync: boolean;
  enablePerformanceMonitoring: boolean;
  virtualizationThreshold: number;
  cacheSize: number;
  refreshInterval: number;
}

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  fps: number;
  cacheHitRate: number;
  lastSync: number;
  isHealthy: boolean;
  warnings: string[];
}

interface SyncWorkerRef {
  worker?: Worker;
  isConnected: boolean;
  messageId: number;
}

interface UsePerformanceOptimizedTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  filters?: any;
  sorting?: any;
  pagination?: any;
  onDataUpdate?: (campaigns: Campaign[]) => void;
}

interface UsePerformanceOptimizedTableReturn {
  // Data
  optimizedCampaigns: Campaign[];
  isOptimizing: boolean;
  
  // Performance
  performanceMetrics: PerformanceMetrics;
  performanceConfig: PerformanceConfig;
  
  // Cache
  cacheStatus: {
    enabled: boolean;
    hitRate: number;
    size: number;
    lastUpdate: number;
  };
  
  // Virtualization
  virtualizationStatus: {
    enabled: boolean;
    threshold: number;
    shouldVirtualize: boolean;
  };
  
  // Background Sync
  syncStatus: {
    enabled: boolean;
    isActive: boolean;
    lastSync: number;
    errorCount: number;
  };
  
  // Actions
  updatePerformanceConfig: (config: Partial<PerformanceConfig>) => void;
  clearCache: () => void;
  forceSyncRefresh: () => void;
  exportPerformanceReport: () => string;
}

export function usePerformanceOptimizedTable({
  campaigns,
  isLoading,
  filters,
  sorting,
  pagination,
  onDataUpdate
}: UsePerformanceOptimizedTableProps): UsePerformanceOptimizedTableReturn {
  // Feature flags
  const { isEnabled: virtualizationEnabled } = useFeatureFlag('campaign_table_virtualization_enabled');
  const { isEnabled: cachingEnabled } = useFeatureFlag('campaign_table_caching_enabled');
  const { isEnabled: backgroundSyncEnabled } = useFeatureFlag('campaign_table_background_sync_enabled');
  const { isEnabled: performanceMonitoringEnabled } = useFeatureFlag('campaign_table_performance_monitoring_enabled');

  // State
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceConfig>({
    enableVirtualization: true,
    enableCaching: true,
    enableBackgroundSync: true,
    enablePerformanceMonitoring: true,
    virtualizationThreshold: 50,
    cacheSize: 50, // MB
    refreshInterval: 30000 // 30 seconds
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    fps: 0,
    cacheHitRate: 0,
    lastSync: 0,
    isHealthy: true,
    warnings: []
  });

  const [cacheStatus, setCacheStatus] = useState({
    enabled: false,
    hitRate: 0,
    size: 0,
    lastUpdate: 0
  });

  const [syncStatus, setSyncStatus] = useState({
    enabled: false,
    isActive: false,
    lastSync: 0,
    errorCount: 0
  });

  // Refs
  const syncWorkerRef = useRef<SyncWorkerRef>({
    worker: undefined,
    isConnected: false,
    messageId: 0
  });

  const performanceTimerRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);

  // Initialize performance monitoring
  useEffect(() => {
    if (performanceConfig.enablePerformanceMonitoring && performanceMonitoringEnabled) {
      tablePerformanceMonitor.startMonitoring();
      
      // Update metrics every second
      performanceTimerRef.current = setInterval(() => {
        const summary = tablePerformanceMonitor.getPerformanceSummary();
        const health = tablePerformanceMonitor.isPerformanceHealthy();
        
        setPerformanceMetrics({
          renderTime: summary.render.renderTime,
          memoryUsage: summary.memory.memoryUsagePercent,
          fps: summary.fps,
          cacheHitRate: campaignDataCache.getMetrics().hitRate * 100,
          lastSync: syncStatus.lastSync,
          isHealthy: health.healthy,
          warnings: health.issues
        });
      }, 1000);

      return () => {
        tablePerformanceMonitor.stopMonitoring();
        if (performanceTimerRef.current) {
          clearInterval(performanceTimerRef.current);
        }
      };
    }
  }, [performanceConfig.enablePerformanceMonitoring, performanceMonitoringEnabled, syncStatus.lastSync]);

  // Initialize background sync worker
  useEffect(() => {
    if (performanceConfig.enableBackgroundSync && backgroundSyncEnabled) {
      initializeBackgroundSync();
    }

    return () => {
      if (syncWorkerRef.current.worker) {
        syncWorkerRef.current.worker.terminate();
      }
    };
  }, [performanceConfig.enableBackgroundSync, backgroundSyncEnabled]);

  // Update cache status
  useEffect(() => {
    if (performanceConfig.enableCaching && cachingEnabled) {
      const metrics = campaignDataCache.getMetrics();
      setCacheStatus({
        enabled: true,
        hitRate: metrics.hitRate * 100,
        size: metrics.size / (1024 * 1024), // Convert to MB
        lastUpdate: Date.now()
      });
    }
  }, [campaigns, performanceConfig.enableCaching, cachingEnabled]);

  // Optimized campaigns with caching
  const optimizedCampaigns = useMemo(() => {
    return tablePerformanceMonitor.measureRender('optimizedCampaigns', () => {
      if (!performanceConfig.enableCaching || !cachingEnabled) {
        return campaigns;
      }

      // Use cached data if available
      const cacheKey = `campaigns:${JSON.stringify({ filters, sorting, pagination })}`;
      const cached = campaignDataCache.get(cacheKey, filters, sorting, pagination);
      
      if (cached) {
        return cached as Campaign[];
      }

      // Cache the current data
      campaignDataCache.set(cacheKey, campaigns, performanceConfig.refreshInterval, filters, sorting, pagination);
      return campaigns;
    });
  }, [campaigns, filters, sorting, pagination, performanceConfig.enableCaching, cachingEnabled, performanceConfig.refreshInterval]);

  // Virtualization status
  const virtualizationStatus = useMemo(() => ({
    enabled: performanceConfig.enableVirtualization && virtualizationEnabled,
    threshold: performanceConfig.virtualizationThreshold,
    shouldVirtualize: campaigns.length > performanceConfig.virtualizationThreshold
  }), [performanceConfig.enableVirtualization, virtualizationEnabled, performanceConfig.virtualizationThreshold, campaigns.length]);

  // Initialize background sync
  const initializeBackgroundSync = useCallback(() => {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported');
      return;
    }

    try {
      const worker = new Worker(new URL('../workers/campaignSyncWorker.ts', import.meta.url));
      
      worker.onmessage = (event) => {
        const { type, data, error } = event.data;
        
        switch (type) {
          case 'SYNC_RESPONSE':
            if (data.status) {
              setSyncStatus(prev => ({
                ...prev,
                isActive: data.status.isActive,
                lastSync: data.status.lastSync,
                errorCount: data.status.errorCount
              }));
            }
            break;
          
          case 'SYNC_ERROR':
            console.error('Background sync error:', error);
            setSyncStatus(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
            break;
        }
      };

      worker.onerror = (error) => {
        console.error('Background sync worker error:', error);
      };

      syncWorkerRef.current = {
        worker,
        isConnected: true,
        messageId: 0
      };

      // Start background sync
      sendWorkerMessage({
        type: 'SYNC_REQUEST',
        data: { action: 'START_SYNC' },
        timestamp: Date.now(),
        id: generateMessageId()
      });

      setSyncStatus(prev => ({ ...prev, enabled: true }));
    } catch (error) {
      console.error('Failed to initialize background sync:', error);
    }
  }, []);

  // Send message to worker
  const sendWorkerMessage = useCallback((message: any) => {
    if (syncWorkerRef.current.worker && syncWorkerRef.current.isConnected) {
      syncWorkerRef.current.worker.postMessage(message);
    }
  }, []);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    syncWorkerRef.current.messageId++;
    return `msg-${Date.now()}-${syncWorkerRef.current.messageId}`;
  }, []);

  // Update performance config
  const updatePerformanceConfig = useCallback((newConfig: Partial<PerformanceConfig>) => {
    setPerformanceConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    campaignDataCache.clear();
    setCacheStatus(prev => ({ ...prev, hitRate: 0, size: 0, lastUpdate: Date.now() }));
  }, []);

  // Force sync refresh
  const forceSyncRefresh = useCallback(() => {
    if (syncWorkerRef.current.worker) {
      sendWorkerMessage({
        type: 'SYNC_REQUEST',
        data: { action: 'MANUAL_SYNC' },
        timestamp: Date.now(),
        id: generateMessageId()
      });
    }
  }, [sendWorkerMessage, generateMessageId]);

  // Export performance report
  const exportPerformanceReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      performanceMetrics,
      performanceConfig,
      cacheStatus,
      virtualizationStatus,
      syncStatus,
      tablePerformanceReport: tablePerformanceMonitor.exportMetrics()
    };

    return JSON.stringify(report, null, 2);
  }, [performanceMetrics, performanceConfig, cacheStatus, virtualizationStatus, syncStatus]);

  // Track data changes for optimization
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 100) { // Throttle optimization checks
      setIsOptimizing(true);
      
      // Simulate optimization work
      setTimeout(() => {
        setIsOptimizing(false);
        lastUpdateRef.current = now;
        
        if (onDataUpdate) {
          onDataUpdate(optimizedCampaigns);
        }
      }, 50);
    }
  }, [campaigns, optimizedCampaigns, onDataUpdate]);

  return {
    // Data
    optimizedCampaigns,
    isOptimizing: isOptimizing || isLoading,
    
    // Performance
    performanceMetrics,
    performanceConfig,
    
    // Cache
    cacheStatus,
    
    // Virtualization
    virtualizationStatus,
    
    // Background Sync
    syncStatus,
    
    // Actions
    updatePerformanceConfig,
    clearCache,
    forceSyncRefresh,
    exportPerformanceReport
  };
}