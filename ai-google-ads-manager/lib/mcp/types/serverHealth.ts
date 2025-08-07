/**
 * Server Health Monitoring Types for MCP
 * 
 * Defines types for MCP server health monitoring, heartbeat tracking,
 * service availability, API endpoint health checks, and response time monitoring.
 */

/**
 * Server health states
 */
export type ServerHealthState = 
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'maintenance'
  | 'unknown';

/**
 * Service status for individual MCP services
 */
export type ServiceStatus = 
  | 'operational'
  | 'degraded'
  | 'outage'
  | 'maintenance'
  | 'unknown';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Timestamp of the check */
  timestamp: number;
  /** Whether the check passed */
  success: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Status code if applicable */
  statusCode?: number;
  /** Error message if check failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Heartbeat monitoring configuration
 */
export interface HeartbeatConfig {
  /** Heartbeat interval in milliseconds */
  interval: number;
  /** Timeout for heartbeat requests */
  timeout: number;
  /** Number of failed heartbeats before marking as unhealthy */
  failureThreshold: number;
  /** Number of successful heartbeats to mark as recovered */
  recoveryThreshold: number;
  /** Heartbeat endpoint URL */
  endpoint: string;
  /** Custom headers for heartbeat requests */
  headers?: Record<string, string>;
}

/**
 * Service monitoring configuration
 */
export interface ServiceConfig {
  /** Service identifier */
  id: string;
  /** Service name */
  name: string;
  /** Service description */
  description?: string;
  /** Health check endpoint */
  healthEndpoint: string;
  /** Check interval in milliseconds */
  checkInterval: number;
  /** Request timeout */
  timeout: number;
  /** Expected response for healthy state */
  expectedResponse?: any;
  /** Service dependencies */
  dependencies?: string[];
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * API endpoint health check configuration
 */
export interface EndpointConfig {
  /** Endpoint identifier */
  id: string;
  /** Endpoint URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body for POST/PUT */
  body?: any;
  /** Expected status codes for healthy response */
  expectedStatusCodes: number[];
  /** Expected response time threshold (ms) */
  responseTimeThreshold: number;
  /** Check interval in milliseconds */
  checkInterval: number;
  /** Request timeout */
  timeout: number;
}

/**
 * Server health metrics
 */
export interface ServerHealthMetrics {
  /** Overall server health state */
  overallHealth: ServerHealthState;
  /** Health score (0-100) */
  healthScore: number;
  /** Uptime percentage */
  uptime: number;
  /** Average response time */
  averageResponseTime: number;
  /** Error rate percentage */
  errorRate: number;
  /** Last successful heartbeat */
  lastHeartbeat: number;
  /** Number of failed heartbeats */
  failedHeartbeats: number;
  /** Services status summary */
  servicesHealth: Record<string, ServiceStatus>;
  /** Endpoint health summary */
  endpointsHealth: Record<string, boolean>;
  /** Timestamp of metrics calculation */
  timestamp: number;
}

/**
 * Service health information
 */
export interface ServiceHealth {
  /** Service configuration */
  config: ServiceConfig;
  /** Current status */
  status: ServiceStatus;
  /** Last check result */
  lastCheck: HealthCheckResult;
  /** Check history */
  checkHistory: HealthCheckResult[];
  /** Uptime percentage */
  uptime: number;
  /** Average response time */
  averageResponseTime: number;
  /** Error rate */
  errorRate: number;
  /** Last successful check */
  lastSuccessfulCheck: number;
  /** Consecutive failures */
  consecutiveFailures: number;
}

/**
 * Endpoint health information
 */
export interface EndpointHealth {
  /** Endpoint configuration */
  config: EndpointConfig;
  /** Current health status */
  isHealthy: boolean;
  /** Last check result */
  lastCheck: HealthCheckResult;
  /** Check history */
  checkHistory: HealthCheckResult[];
  /** Response time statistics */
  responseTimeStats: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  /** Success rate percentage */
  successRate: number;
  /** Consecutive failures */
  consecutiveFailures: number;
}

/**
 * Health monitoring event types
 */
export type HealthEventType = 
  | 'heartbeat_success'
  | 'heartbeat_failure'
  | 'service_status_change'
  | 'endpoint_status_change'
  | 'health_degradation'
  | 'health_recovery'
  | 'response_time_spike'
  | 'error_rate_increase';

/**
 * Health monitoring event
 */
export interface HealthEvent {
  /** Event type */
  type: HealthEventType;
  /** Timestamp */
  timestamp: number;
  /** Service or endpoint ID */
  targetId?: string;
  /** Previous state/value */
  previousValue?: any;
  /** Current state/value */
  currentValue?: any;
  /** Additional event data */
  data?: Record<string, any>;
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Health monitoring callback
 */
export type HealthEventCallback = (event: HealthEvent) => void;

/**
 * Server health monitoring state
 */
export interface ServerHealthMonitoringState {
  /** Whether monitoring is active */
  isActive: boolean;
  /** Current health metrics */
  metrics: ServerHealthMetrics;
  /** Heartbeat configuration */
  heartbeatConfig: HeartbeatConfig;
  /** Monitored services */
  services: Map<string, ServiceHealth>;
  /** Monitored endpoints */
  endpoints: Map<string, EndpointHealth>;
  /** Health event history */
  eventHistory: HealthEvent[];
  /** Active monitoring intervals */
  activeIntervals: Map<string, NodeJS.Timeout>;
}

/**
 * Response time analytics
 */
export interface ResponseTimeAnalytics {
  /** Time period for analytics */
  period: {
    start: number;
    end: number;
  };
  /** Response time percentiles */
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** Response time trend */
  trend: 'improving' | 'stable' | 'degrading';
  /** Anomalies detected */
  anomalies: Array<{
    timestamp: number;
    responseTime: number;
    deviation: number;
  }>;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Server health summary
 */
export interface HealthSummary {
  /** Overall status */
  status: ServerHealthState;
  /** Health score */
  score: number;
  /** Critical issues count */
  criticalIssues: number;
  /** Warning issues count */
  warningIssues: number;
  /** Services summary */
  services: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  /** Endpoints summary */
  endpoints: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  /** Performance metrics */
  performance: {
    averageResponseTime: number;
    uptime: number;
    errorRate: number;
  };
}

/**
 * Default configurations
 */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  interval: 30000, // 30 seconds
  timeout: 10000,  // 10 seconds
  failureThreshold: 3,
  recoveryThreshold: 2,
  endpoint: '/health',
  headers: {
    'Content-Type': 'application/json'
  }
};

export const DEFAULT_SERVICE_CONFIG: Partial<ServiceConfig> = {
  checkInterval: 60000, // 1 minute
  timeout: 10000,      // 10 seconds
  priority: 'medium',
  expectedStatusCodes: [200]
};

export const DEFAULT_ENDPOINT_CONFIG: Partial<EndpointConfig> = {
  method: 'GET',
  expectedStatusCodes: [200, 201, 204],
  responseTimeThreshold: 5000, // 5 seconds
  checkInterval: 30000,        // 30 seconds
  timeout: 10000               // 10 seconds
};