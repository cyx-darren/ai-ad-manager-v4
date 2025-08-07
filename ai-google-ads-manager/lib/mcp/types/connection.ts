/**
 * Connection Type Definitions for MCP Real-time Monitoring
 * 
 * Defines all types related to connection monitoring, network quality assessment,
 * latency tracking, and bandwidth monitoring for the MCP client system.
 */

/**
 * Connection states that the system can be in
 */
export type ConnectionState = 
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'degraded'
  | 'timeout';

/**
 * Network quality classification levels
 */
export type NetworkQuality = 
  | 'excellent'  // < 50ms, > 10 Mbps
  | 'good'       // 50-150ms, 5-10 Mbps
  | 'fair'       // 150-300ms, 1-5 Mbps
  | 'poor'       // 300-1000ms, < 1 Mbps
  | 'critical'   // > 1000ms or very low bandwidth
  | 'unknown';

/**
 * Connection quality metrics
 */
export interface ConnectionQualityMetrics {
  /** Average latency in milliseconds */
  latency: number;
  /** Network jitter (latency variance) in milliseconds */
  jitter: number;
  /** Estimated download bandwidth in Mbps */
  downloadBandwidth: number;
  /** Estimated upload bandwidth in Mbps */
  uploadBandwidth: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Overall connection quality classification */
  quality: NetworkQuality;
  /** Confidence score for quality assessment (0-1) */
  qualityConfidence: number;
  /** Timestamp of when metrics were measured */
  timestamp: number;
}

/**
 * Historical connection data point
 */
export interface ConnectionDataPoint {
  /** Timestamp of the measurement */
  timestamp: number;
  /** Connection state at this point */
  state: ConnectionState;
  /** Quality metrics at this point */
  metrics: ConnectionQualityMetrics;
  /** Any errors that occurred */
  error?: string;
}

/**
 * WebSocket connection monitoring configuration
 */
export interface WebSocketMonitorConfig {
  /** WebSocket endpoint URL */
  endpoint: string;
  /** Ping interval in milliseconds */
  pingInterval: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Retry delay base (for exponential backoff) */
  retryDelayBase: number;
  /** Maximum retry delay */
  maxRetryDelay: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect: boolean;
  /** Custom headers for WebSocket connection */
  headers?: Record<string, string>;
  /** Protocols to use for WebSocket */
  protocols?: string[];
}

/**
 * Network monitoring configuration
 */
export interface NetworkMonitorConfig {
  /** How often to check network status (ms) */
  statusCheckInterval: number;
  /** How often to measure bandwidth (ms) */
  bandwidthCheckInterval: number;
  /** Size of test data for bandwidth measurement (bytes) */
  bandwidthTestSize: number;
  /** Timeout for bandwidth tests (ms) */
  bandwidthTestTimeout: number;
  /** Number of latency samples to keep for averaging */
  latencySampleSize: number;
  /** Threshold for considering connection degraded (ms) */
  degradationThreshold: number;
  /** URLs to use for connectivity testing */
  testEndpoints: string[];
  /** Enable browser-specific network APIs */
  useBrowserAPIs: boolean;
}

/**
 * Connection monitoring event types
 */
export type ConnectionEventType = 
  | 'state_change'
  | 'quality_change'
  | 'metrics_update'
  | 'error'
  | 'reconnection_attempt'
  | 'bandwidth_test_complete'
  | 'latency_spike'
  | 'quality_degradation'
  | 'quality_improvement';

/**
 * Connection monitoring event data
 */
export interface ConnectionEvent {
  /** Type of the event */
  type: ConnectionEventType;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Current connection state */
  state: ConnectionState;
  /** Current quality metrics */
  metrics?: ConnectionQualityMetrics;
  /** Previous state (for change events) */
  previousState?: ConnectionState;
  /** Previous metrics (for change events) */
  previousMetrics?: ConnectionQualityMetrics;
  /** Error details (for error events) */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  /** Additional event-specific data */
  data?: any;
}

/**
 * Connection monitoring callback function
 */
export type ConnectionEventCallback = (event: ConnectionEvent) => void;

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Overall health score (0-100) */
  healthScore: number;
  /** Whether connection is considered healthy */
  isHealthy: boolean;
  /** Current uptime in milliseconds */
  uptime: number;
  /** Total downtime in the current session */
  downtime: number;
  /** Availability percentage for current session */
  availability: number;
  /** Number of connection failures in current session */
  failureCount: number;
  /** Number of successful reconnections */
  recoveryCount: number;
  /** Last successful connection timestamp */
  lastConnected: number;
  /** Last disconnection timestamp */
  lastDisconnected: number;
  /** Stability rating based on connection history */
  stability: 'stable' | 'unstable' | 'very_unstable' | 'unknown';
}

/**
 * Bandwidth test result
 */
export interface BandwidthTestResult {
  /** Test start timestamp */
  startTime: number;
  /** Test end timestamp */
  endTime: number;
  /** Test duration in milliseconds */
  duration: number;
  /** Amount of data transferred (bytes) */
  bytesTransferred: number;
  /** Calculated bandwidth (Mbps) */
  bandwidth: number;
  /** Test type (download/upload) */
  testType: 'download' | 'upload';
  /** Test endpoint used */
  endpoint: string;
  /** Whether test completed successfully */
  success: boolean;
  /** Error message if test failed */
  error?: string;
}

/**
 * Latency measurement result
 */
export interface LatencyTestResult {
  /** Test timestamp */
  timestamp: number;
  /** Target endpoint */
  endpoint: string;
  /** Round-trip time in milliseconds */
  rtt: number;
  /** Whether test completed successfully */
  success: boolean;
  /** Error message if test failed */
  error?: string;
  /** Additional timing details */
  timings?: {
    dns?: number;
    tcp?: number;
    tls?: number;
    request?: number;
    response?: number;
  };
}

/**
 * Real-time monitoring state
 */
export interface MonitoringState {
  /** Whether monitoring is currently active */
  isActive: boolean;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Current quality metrics */
  currentMetrics: ConnectionQualityMetrics;
  /** Connection health information */
  health: ConnectionHealth;
  /** Historical data points */
  history: ConnectionDataPoint[];
  /** Active monitoring configurations */
  config: {
    websocket: WebSocketMonitorConfig;
    network: NetworkMonitorConfig;
  };
  /** Last error that occurred */
  lastError?: {
    timestamp: number;
    message: string;
    code?: string;
  };
}

/**
 * Quality trend analysis
 */
export interface QualityTrend {
  /** Trend direction */
  direction: 'improving' | 'degrading' | 'stable' | 'unknown';
  /** Trend confidence (0-1) */
  confidence: number;
  /** Trend duration in milliseconds */
  duration: number;
  /** Predicted quality in near future */
  prediction?: NetworkQuality;
  /** Factors contributing to the trend */
  factors: string[];
}

/**
 * Connection analytics summary
 */
export interface ConnectionAnalytics {
  /** Time period covered by this summary */
  period: {
    start: number;
    end: number;
    duration: number;
  };
  /** Overall statistics */
  stats: {
    averageLatency: number;
    averageBandwidth: number;
    averageQuality: NetworkQuality;
    uptimePercentage: number;
    totalDisconnections: number;
    averageReconnectionTime: number;
  };
  /** Quality distribution */
  qualityDistribution: Record<NetworkQuality, number>;
  /** Identified patterns */
  patterns: {
    peakUsageHours?: number[];
    commonFailureReasons?: string[];
    qualityTrends?: QualityTrend[];
  };
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Connection prediction model
 */
export interface ConnectionPrediction {
  /** Predicted state in the near future */
  predictedState: ConnectionState;
  /** Predicted quality */
  predictedQuality: NetworkQuality;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Time window for prediction (ms) */
  timeWindow: number;
  /** Factors influencing prediction */
  factors: {
    historicalPattern: number;
    currentTrend: number;
    timeOfDay: number;
    networkLoad: number;
  };
  /** Recommended actions */
  recommendations: {
    action: string;
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }[];
}

/**
 * Export default configuration
 */
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketMonitorConfig = {
  endpoint: 'ws://localhost:3001/mcp-ws',
  pingInterval: 30000,
  connectionTimeout: 10000,
  maxRetryAttempts: 5,
  retryDelayBase: 1000,
  maxRetryDelay: 30000,
  autoReconnect: true,
  headers: {},
  protocols: ['mcp-v1']
};

export const DEFAULT_NETWORK_CONFIG: NetworkMonitorConfig = {
  statusCheckInterval: 10000,
  bandwidthCheckInterval: 60000,
  bandwidthTestSize: 1024 * 1024, // 1MB
  bandwidthTestTimeout: 30000,
  latencySampleSize: 10,
  degradationThreshold: 500,
  testEndpoints: [
    'https://www.google.com/favicon.ico',
    'https://httpbin.org/bytes/1024'
  ],
  useBrowserAPIs: true
};