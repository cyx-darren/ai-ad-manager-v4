/**
 * React Hooks for Real-time Connection Monitoring
 * 
 * Provides React hooks for connection monitoring, network quality assessment,
 * latency tracking, and bandwidth monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConnectionState,
  NetworkQuality,
  ConnectionQualityMetrics,
  ConnectionHealth,
  ConnectionEvent,
  MonitoringState,
  ConnectionEventType,
  WebSocketMonitorConfig,
  NetworkMonitorConfig
} from '../types/connection';

/**
 * Hook for real-time connection monitoring
 */
export interface UseConnectionMonitorResult {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Current quality metrics */
  metrics: ConnectionQualityMetrics;
  /** Connection health information */
  health: ConnectionHealth;
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Whether connection is healthy */
  isHealthy: boolean;
  /** Current network quality */
  quality: NetworkQuality;
  /** Start monitoring */
  startMonitoring: () => Promise<void>;
  /** Stop monitoring */
  stopMonitoring: () => void;
  /** Force reconnection */
  reconnect: () => Promise<void>;
  /** Get historical data */
  getHistory: (timeWindow?: number) => any[];
  /** Last error that occurred */
  lastError?: string;
}

export const useConnectionMonitor = (
  wsConfig?: Partial<WebSocketMonitorConfig>,
  networkConfig?: Partial<NetworkMonitorConfig>
): UseConnectionMonitorResult => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [metrics, setMetrics] = useState<ConnectionQualityMetrics>({
    latency: 0,
    jitter: 0,
    downloadBandwidth: 0,
    uploadBandwidth: 0,
    packetLoss: 0,
    quality: 'unknown',
    qualityConfidence: 0,
    timestamp: Date.now()
  });
  const [health, setHealth] = useState<ConnectionHealth>({
    healthScore: 0,
    isHealthy: false,
    uptime: 0,
    downtime: 0,
    availability: 0,
    failureCount: 0,
    recoveryCount: 0,
    lastConnected: 0,
    lastDisconnected: 0,
    stability: 'unknown'
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastError, setLastError] = useState<string>();

  const monitorRef = useRef<any>(null);

  // Initialize monitor on mount
  useEffect(() => {
    // Dynamic import to avoid SSR issues
    const initMonitor = async () => {
      const { createConnectionMonitor } = await import('../utils/connectionMonitor');
      monitorRef.current = createConnectionMonitor(wsConfig, networkConfig);

      // Set up event listeners
      monitorRef.current.on('state_change', (event: ConnectionEvent) => {
        setConnectionState(event.state);
        if (event.error) {
          setLastError(event.error.message);
        }
      });

      monitorRef.current.on('metrics_update', (event: ConnectionEvent) => {
        if (event.metrics) {
          setMetrics(event.metrics);
        }
      });

      monitorRef.current.on('error', (event: ConnectionEvent) => {
        if (event.error) {
          setLastError(event.error.message);
        }
      });
    };

    initMonitor();

    return () => {
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
      }
    };
  }, []);

  // Update health periodically
  useEffect(() => {
    if (!isMonitoring || !monitorRef.current) return;

    const interval = setInterval(() => {
      const currentHealth = monitorRef.current.getHealth();
      setHealth(currentHealth);
    }, 5000);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  const startMonitoring = useCallback(async () => {
    if (monitorRef.current) {
      await monitorRef.current.startMonitoring();
      setIsMonitoring(true);
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.stopMonitoring();
      setIsMonitoring(false);
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (monitorRef.current) {
      await monitorRef.current.reconnect();
    }
  }, []);

  const getHistory = useCallback((timeWindow?: number) => {
    if (monitorRef.current) {
      return monitorRef.current.getHistory(timeWindow);
    }
    return [];
  }, []);

  return {
    connectionState,
    metrics,
    health,
    isMonitoring,
    isHealthy: health.isHealthy,
    quality: metrics.quality,
    startMonitoring,
    stopMonitoring,
    reconnect,
    getHistory,
    lastError
  };
};

/**
 * Hook for network quality monitoring
 */
export interface UseNetworkQualityResult {
  /** Current network quality */
  quality: NetworkQuality;
  /** Quality confidence score */
  confidence: number;
  /** Average latency */
  latency: number;
  /** Network jitter */
  jitter: number;
  /** Download bandwidth */
  downloadBandwidth: number;
  /** Upload bandwidth */
  uploadBandwidth: number;
  /** Whether quality is degraded */
  isDegraded: boolean;
  /** Quality trend direction */
  trend: 'improving' | 'degrading' | 'stable';
}

export const useNetworkQuality = (): UseNetworkQualityResult => {
  const [quality, setQuality] = useState<NetworkQuality>('unknown');
  const [confidence, setConfidence] = useState(0);
  const [latency, setLatency] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [downloadBandwidth, setDownloadBandwidth] = useState(0);
  const [uploadBandwidth, setUploadBandwidth] = useState(0);
  const [previousQuality, setPreviousQuality] = useState<NetworkQuality>('unknown');

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalConnectionMonitor } = await import('../utils/connectionMonitor');
      monitorRef.current = getGlobalConnectionMonitor();

      monitorRef.current.on('metrics_update', (event: ConnectionEvent) => {
        if (event.metrics) {
          setQuality(event.metrics.quality);
          setConfidence(event.metrics.qualityConfidence);
          setLatency(event.metrics.latency);
          setJitter(event.metrics.jitter);
          setDownloadBandwidth(event.metrics.downloadBandwidth);
          setUploadBandwidth(event.metrics.uploadBandwidth);
        }
      });

      monitorRef.current.on('quality_change', (event: ConnectionEvent) => {
        if (event.previousMetrics) {
          setPreviousQuality(event.previousMetrics.quality);
        }
      });
    };

    initMonitor();
  }, []);

  const isDegraded = quality === 'poor' || quality === 'critical';
  
  const trend = (() => {
    const qualityOrder: NetworkQuality[] = ['critical', 'poor', 'fair', 'good', 'excellent'];
    const currentIndex = qualityOrder.indexOf(quality);
    const previousIndex = qualityOrder.indexOf(previousQuality);
    
    if (currentIndex > previousIndex) return 'improving';
    if (currentIndex < previousIndex) return 'degrading';
    return 'stable';
  })();

  return {
    quality,
    confidence,
    latency,
    jitter,
    downloadBandwidth,
    uploadBandwidth,
    isDegraded,
    trend
  };
};

/**
 * Hook for connection health monitoring
 */
export interface UseConnectionHealthResult {
  /** Overall health score (0-100) */
  healthScore: number;
  /** Whether connection is healthy */
  isHealthy: boolean;
  /** Current uptime */
  uptime: number;
  /** Availability percentage */
  availability: number;
  /** Connection stability */
  stability: 'stable' | 'unstable' | 'very_unstable' | 'unknown';
  /** Number of failures */
  failureCount: number;
  /** Number of recoveries */
  recoveryCount: number;
  /** Health status text */
  statusText: string;
  /** Health color indicator */
  statusColor: string;
}

export const useConnectionHealth = (): UseConnectionHealthResult => {
  const [health, setHealth] = useState<ConnectionHealth>({
    healthScore: 0,
    isHealthy: false,
    uptime: 0,
    downtime: 0,
    availability: 0,
    failureCount: 0,
    recoveryCount: 0,
    lastConnected: 0,
    lastDisconnected: 0,
    stability: 'unknown'
  });

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalConnectionMonitor } = await import('../utils/connectionMonitor');
      monitorRef.current = getGlobalConnectionMonitor();

      // Update health periodically
      const interval = setInterval(() => {
        const currentHealth = monitorRef.current.getHealth();
        setHealth(currentHealth);
      }, 5000);

      return () => clearInterval(interval);
    };

    initMonitor();
  }, []);

  const statusText = (() => {
    if (health.healthScore >= 90) return 'Excellent';
    if (health.healthScore >= 70) return 'Good';
    if (health.healthScore >= 50) return 'Fair';
    if (health.healthScore >= 30) return 'Poor';
    return 'Critical';
  })();

  const statusColor = (() => {
    if (health.healthScore >= 90) return '#10b981'; // green
    if (health.healthScore >= 70) return '#f59e0b'; // yellow
    if (health.healthScore >= 50) return '#f97316'; // orange
    return '#ef4444'; // red
  })();

  return {
    healthScore: health.healthScore,
    isHealthy: health.isHealthy,
    uptime: health.uptime,
    availability: health.availability,
    stability: health.stability,
    failureCount: health.failureCount,
    recoveryCount: health.recoveryCount,
    statusText,
    statusColor
  };
};

/**
 * Hook for latency monitoring
 */
export interface UseLatencyMonitorResult {
  /** Current latency */
  currentLatency: number;
  /** Average latency */
  averageLatency: number;
  /** Latency jitter */
  jitter: number;
  /** Whether latency is high */
  isHighLatency: boolean;
  /** Latency trend */
  trend: 'improving' | 'degrading' | 'stable';
  /** Latency history */
  history: number[];
}

export const useLatencyMonitor = (thresholdMs: number = 200): UseLatencyMonitorResult => {
  const [currentLatency, setCurrentLatency] = useState(0);
  const [averageLatency, setAverageLatency] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalConnectionMonitor } = await import('../utils/connectionMonitor');
      monitorRef.current = getGlobalConnectionMonitor();

      monitorRef.current.on('metrics_update', (event: ConnectionEvent) => {
        if (event.metrics) {
          setCurrentLatency(event.metrics.latency);
          setJitter(event.metrics.jitter);
          
          // Update history
          setHistory(prev => {
            const newHistory = [...prev, event.metrics!.latency].slice(-20); // Keep last 20 samples
            const avg = newHistory.reduce((sum, val) => sum + val, 0) / newHistory.length;
            setAverageLatency(avg);
            return newHistory;
          });
        }
      });
    };

    initMonitor();
  }, []);

  const isHighLatency = currentLatency > thresholdMs;
  
  const trend = (() => {
    if (history.length < 5) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    const threshold = olderAvg * 0.1; // 10% change threshold
    
    if (change > threshold) return 'degrading';
    if (change < -threshold) return 'improving';
    return 'stable';
  })();

  return {
    currentLatency,
    averageLatency,
    jitter,
    isHighLatency,
    trend,
    history
  };
};

/**
 * Hook for bandwidth monitoring
 */
export interface UseBandwidthMonitorResult {
  /** Download bandwidth in Mbps */
  downloadBandwidth: number;
  /** Upload bandwidth in Mbps */
  uploadBandwidth: number;
  /** Whether bandwidth is sufficient */
  isSufficientBandwidth: boolean;
  /** Bandwidth classification */
  classification: 'high' | 'medium' | 'low' | 'very_low';
  /** Whether bandwidth test is running */
  isTestingBandwidth: boolean;
  /** Trigger manual bandwidth test */
  testBandwidth: () => Promise<void>;
}

export const useBandwidthMonitor = (minimumMbps: number = 1): UseBandwidthMonitorResult => {
  const [downloadBandwidth, setDownloadBandwidth] = useState(0);
  const [uploadBandwidth, setUploadBandwidth] = useState(0);
  const [isTestingBandwidth, setIsTestingBandwidth] = useState(false);

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalConnectionMonitor } = await import('../utils/connectionMonitor');
      monitorRef.current = getGlobalConnectionMonitor();

      monitorRef.current.on('metrics_update', (event: ConnectionEvent) => {
        if (event.metrics) {
          setDownloadBandwidth(event.metrics.downloadBandwidth);
          setUploadBandwidth(event.metrics.uploadBandwidth);
        }
      });

      monitorRef.current.on('bandwidth_test_complete', () => {
        setIsTestingBandwidth(false);
      });
    };

    initMonitor();
  }, []);

  const isSufficientBandwidth = downloadBandwidth >= minimumMbps;
  
  const classification = (() => {
    if (downloadBandwidth >= 10) return 'high';
    if (downloadBandwidth >= 5) return 'medium';
    if (downloadBandwidth >= 1) return 'low';
    return 'very_low';
  })() as 'high' | 'medium' | 'low' | 'very_low';

  const testBandwidth = useCallback(async () => {
    if (monitorRef.current && !isTestingBandwidth) {
      setIsTestingBandwidth(true);
      // The monitor will automatically update bandwidth and trigger the complete event
    }
  }, [isTestingBandwidth]);

  return {
    downloadBandwidth,
    uploadBandwidth,
    isSufficientBandwidth,
    classification,
    isTestingBandwidth,
    testBandwidth
  };
};

export default useConnectionMonitor;