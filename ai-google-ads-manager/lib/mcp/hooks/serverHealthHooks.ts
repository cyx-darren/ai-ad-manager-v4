/**
 * React Hooks for MCP Server Health Monitoring
 * 
 * Provides React hooks for server health monitoring, heartbeat tracking,
 * service availability, and endpoint health checks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ServerHealthState,
  ServiceStatus,
  ServerHealthMetrics,
  ServiceHealth,
  EndpointHealth,
  HealthEvent,
  HealthSummary,
  ServiceConfig,
  EndpointConfig,
  HeartbeatConfig
} from '../types/serverHealth';

/**
 * Hook for comprehensive server health monitoring
 */
export interface UseServerHealthResult {
  /** Current server health state */
  healthState: ServerHealthState;
  /** Health metrics */
  metrics: ServerHealthMetrics;
  /** Health summary */
  summary: HealthSummary;
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Last error */
  lastError?: string;
  /** Start monitoring */
  startMonitoring: () => Promise<void>;
  /** Stop monitoring */
  stopMonitoring: () => void;
  /** Add service for monitoring */
  addService: (config: ServiceConfig) => void;
  /** Add endpoint for monitoring */
  addEndpoint: (config: EndpointConfig) => void;
  /** Get service health */
  getServiceHealth: (serviceId: string) => ServiceHealth | undefined;
  /** Get endpoint health */
  getEndpointHealth: (endpointId: string) => EndpointHealth | undefined;
}

export const useServerHealth = (
  baseUrl?: string,
  heartbeatConfig?: Partial<HeartbeatConfig>
): UseServerHealthResult => {
  const [healthState, setHealthState] = useState<ServerHealthState>('unknown');
  const [metrics, setMetrics] = useState<ServerHealthMetrics>({
    overallHealth: 'unknown',
    healthScore: 0,
    uptime: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastHeartbeat: 0,
    failedHeartbeats: 0,
    servicesHealth: {},
    endpointsHealth: {},
    timestamp: Date.now()
  });
  const [summary, setSummary] = useState<HealthSummary>({
    status: 'unknown',
    score: 0,
    criticalIssues: 0,
    warningIssues: 0,
    services: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
    endpoints: { total: 0, healthy: 0, unhealthy: 0 },
    performance: { averageResponseTime: 0, uptime: 0, errorRate: 0 }
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastError, setLastError] = useState<string>();

  const monitorRef = useRef<any>(null);

  // Initialize monitor on mount
  useEffect(() => {
    const initMonitor = async () => {
      const { createServerHealthMonitor } = await import('../utils/serverHealthMonitor');
      monitorRef.current = createServerHealthMonitor(baseUrl, heartbeatConfig);

      // Set up event listeners
      monitorRef.current.on('heartbeat_success', () => {
        updateMetrics();
      });

      monitorRef.current.on('heartbeat_failure', (event: HealthEvent) => {
        setLastError(event.data?.error || 'Heartbeat failed');
        updateMetrics();
      });

      monitorRef.current.on('health_degradation', () => {
        updateMetrics();
      });

      monitorRef.current.on('health_recovery', () => {
        updateMetrics();
      });
    };

    initMonitor();

    return () => {
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
      }
    };
  }, [baseUrl]);

  const updateMetrics = useCallback(() => {
    if (monitorRef.current) {
      const currentMetrics = monitorRef.current.getMetrics();
      const currentSummary = monitorRef.current.getHealthSummary();
      
      setMetrics(currentMetrics);
      setSummary(currentSummary);
      setHealthState(currentMetrics.overallHealth);
    }
  }, []);

  // Update metrics periodically
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [isMonitoring, updateMetrics]);

  const startMonitoring = useCallback(async () => {
    if (monitorRef.current) {
      await monitorRef.current.startMonitoring();
      setIsMonitoring(true);
      updateMetrics();
    }
  }, [updateMetrics]);

  const stopMonitoring = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.stopMonitoring();
      setIsMonitoring(false);
    }
  }, []);

  const addService = useCallback((config: ServiceConfig) => {
    if (monitorRef.current) {
      monitorRef.current.addService(config);
    }
  }, []);

  const addEndpoint = useCallback((config: EndpointConfig) => {
    if (monitorRef.current) {
      monitorRef.current.addEndpoint(config);
    }
  }, []);

  const getServiceHealth = useCallback((serviceId: string) => {
    return monitorRef.current?.getServiceHealth(serviceId);
  }, []);

  const getEndpointHealth = useCallback((endpointId: string) => {
    return monitorRef.current?.getEndpointHealth(endpointId);
  }, []);

  return {
    healthState,
    metrics,
    summary,
    isMonitoring,
    lastError,
    startMonitoring,
    stopMonitoring,
    addService,
    addEndpoint,
    getServiceHealth,
    getEndpointHealth
  };
};

/**
 * Hook for heartbeat monitoring
 */
export interface UseHeartbeatMonitorResult {
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
  /** Number of failed heartbeats */
  failedHeartbeats: number;
  /** Whether heartbeat is healthy */
  isHealthy: boolean;
  /** Heartbeat interval */
  interval: number;
  /** Last heartbeat response time */
  lastResponseTime: number;
}

export const useHeartbeatMonitor = (): UseHeartbeatMonitorResult => {
  const [lastHeartbeat, setLastHeartbeat] = useState(0);
  const [failedHeartbeats, setFailedHeartbeats] = useState(0);
  const [lastResponseTime, setLastResponseTime] = useState(0);

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalServerHealthMonitor } = await import('../utils/serverHealthMonitor');
      monitorRef.current = getGlobalServerHealthMonitor();

      monitorRef.current.on('heartbeat_success', (event: HealthEvent) => {
        setLastHeartbeat(event.timestamp);
        setLastResponseTime(event.data?.responseTime || 0);
      });

      monitorRef.current.on('heartbeat_failure', (event: HealthEvent) => {
        setFailedHeartbeats(prev => prev + 1);
      });

      // Update metrics periodically
      const interval = setInterval(() => {
        const metrics = monitorRef.current.getMetrics();
        setLastHeartbeat(metrics.lastHeartbeat);
        setFailedHeartbeats(metrics.failedHeartbeats);
      }, 5000);

      return () => clearInterval(interval);
    };

    initMonitor();
  }, []);

  return {
    lastHeartbeat,
    failedHeartbeats,
    isHealthy: failedHeartbeats < 3,
    interval: 30000, // Default interval
    lastResponseTime
  };
};

/**
 * Hook for service availability monitoring
 */
export interface UseServiceAvailabilityResult {
  /** Services health status */
  services: Record<string, ServiceStatus>;
  /** Overall services health */
  overallServiceHealth: 'healthy' | 'degraded' | 'critical';
  /** Service count by status */
  serviceCount: {
    total: number;
    operational: number;
    degraded: number;
    outage: number;
  };
  /** Get specific service health */
  getServiceStatus: (serviceId: string) => ServiceHealth | undefined;
}

export const useServiceAvailability = (): UseServiceAvailabilityResult => {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [serviceCount, setServiceCount] = useState({
    total: 0,
    operational: 0,
    degraded: 0,
    outage: 0
  });

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalServerHealthMonitor } = await import('../utils/serverHealthMonitor');
      monitorRef.current = getGlobalServerHealthMonitor();

      monitorRef.current.on('service_status_change', () => {
        updateServiceMetrics();
      });

      // Update metrics periodically
      const interval = setInterval(updateServiceMetrics, 10000);
      return () => clearInterval(interval);
    };

    const updateServiceMetrics = () => {
      if (monitorRef.current) {
        const metrics = monitorRef.current.getMetrics();
        setServices(metrics.servicesHealth);

        const statusCounts = Object.values(metrics.servicesHealth).reduce(
          (acc, status) => {
            acc.total++;
            if (status === 'operational') acc.operational++;
            else if (status === 'degraded') acc.degraded++;
            else if (status === 'outage') acc.outage++;
            return acc;
          },
          { total: 0, operational: 0, degraded: 0, outage: 0 }
        );
        setServiceCount(statusCounts);
      }
    };

    initMonitor();
  }, []);

  const overallServiceHealth = (() => {
    if (serviceCount.outage > 0) return 'critical';
    if (serviceCount.degraded > 0) return 'degraded';
    return 'healthy';
  })();

  const getServiceStatus = useCallback((serviceId: string) => {
    return monitorRef.current?.getServiceHealth(serviceId);
  }, []);

  return {
    services,
    overallServiceHealth,
    serviceCount,
    getServiceStatus
  };
};

/**
 * Hook for endpoint health monitoring
 */
export interface UseEndpointHealthResult {
  /** Endpoints health status */
  endpoints: Record<string, boolean>;
  /** Overall endpoint health */
  overallEndpointHealth: 'healthy' | 'degraded' | 'critical';
  /** Endpoint count by status */
  endpointCount: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  /** Average response time across all endpoints */
  averageResponseTime: number;
  /** Get specific endpoint health */
  getEndpointStatus: (endpointId: string) => EndpointHealth | undefined;
}

export const useEndpointHealth = (): UseEndpointHealthResult => {
  const [endpoints, setEndpoints] = useState<Record<string, boolean>>({});
  const [endpointCount, setEndpointCount] = useState({
    total: 0,
    healthy: 0,
    unhealthy: 0
  });
  const [averageResponseTime, setAverageResponseTime] = useState(0);

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalServerHealthMonitor } = await import('../utils/serverHealthMonitor');
      monitorRef.current = getGlobalServerHealthMonitor();

      monitorRef.current.on('endpoint_status_change', () => {
        updateEndpointMetrics();
      });

      // Update metrics periodically
      const interval = setInterval(updateEndpointMetrics, 10000);
      return () => clearInterval(interval);
    };

    const updateEndpointMetrics = () => {
      if (monitorRef.current) {
        const metrics = monitorRef.current.getMetrics();
        setEndpoints(metrics.endpointsHealth);
        setAverageResponseTime(metrics.averageResponseTime);

        const healthCounts = Object.values(metrics.endpointsHealth).reduce(
          (acc, isHealthy) => {
            acc.total++;
            if (isHealthy) acc.healthy++;
            else acc.unhealthy++;
            return acc;
          },
          { total: 0, healthy: 0, unhealthy: 0 }
        );
        setEndpointCount(healthCounts);
      }
    };

    initMonitor();
  }, []);

  const overallEndpointHealth = (() => {
    const unhealthyRatio = endpointCount.total > 0 ? endpointCount.unhealthy / endpointCount.total : 0;
    if (unhealthyRatio >= 0.5) return 'critical';
    if (unhealthyRatio > 0) return 'degraded';
    return 'healthy';
  })();

  const getEndpointStatus = useCallback((endpointId: string) => {
    return monitorRef.current?.getEndpointHealth(endpointId);
  }, []);

  return {
    endpoints,
    overallEndpointHealth,
    endpointCount,
    averageResponseTime,
    getEndpointStatus
  };
};

/**
 * Hook for server response time monitoring
 */
export interface UseServerResponseTimeResult {
  /** Current average response time */
  averageResponseTime: number;
  /** Response time trend */
  trend: 'improving' | 'stable' | 'degrading';
  /** Response time status */
  status: 'excellent' | 'good' | 'fair' | 'poor';
  /** Response time history */
  history: number[];
  /** Response time percentiles */
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export const useServerResponseTime = (): UseServerResponseTimeResult => {
  const [averageResponseTime, setAverageResponseTime] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [percentiles, setPercentiles] = useState({
    p50: 0,
    p90: 0,
    p95: 0,
    p99: 0
  });

  const monitorRef = useRef<any>(null);

  useEffect(() => {
    const initMonitor = async () => {
      const { getGlobalServerHealthMonitor } = await import('../utils/serverHealthMonitor');
      monitorRef.current = getGlobalServerHealthMonitor();

      // Update metrics periodically
      const interval = setInterval(() => {
        if (monitorRef.current) {
          const metrics = monitorRef.current.getMetrics();
          setAverageResponseTime(metrics.averageResponseTime);
          
          // Update history (simplified for demo)
          setHistory(prev => {
            const newHistory = [...prev, metrics.averageResponseTime].slice(-20);
            return newHistory;
          });
        }
      }, 10000);

      return () => clearInterval(interval);
    };

    initMonitor();
  }, []);

  // Calculate trend
  const trend = (() => {
    if (history.length < 5) return 'stable';
    
    const recent = history.slice(-3);
    const older = history.slice(-6, -3);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  })();

  // Calculate status based on response time
  const status = (() => {
    if (averageResponseTime < 100) return 'excellent';
    if (averageResponseTime < 300) return 'good';
    if (averageResponseTime < 1000) return 'fair';
    return 'poor';
  })();

  // Calculate percentiles (simplified)
  useEffect(() => {
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => a - b);
      setPercentiles({
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0
      });
    }
  }, [history]);

  return {
    averageResponseTime,
    trend,
    status,
    history,
    percentiles
  };
};

export default useServerHealth;