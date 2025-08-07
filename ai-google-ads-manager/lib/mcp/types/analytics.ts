/**
 * Historical Connection Analytics Types
 * 
 * Defines types for connection analytics, history tracking, uptime analytics,
 * trend analysis, and performance metrics for the MCP monitoring system.
 */

import { ConnectionState, NetworkQuality, ConnectionQualityMetrics } from './connection';
import { ServerHealthState, ServiceStatus } from './serverHealth';

/**
 * Connection event for historical tracking
 */
export interface ConnectionEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp of the event */
  timestamp: number;
  /** Type of connection event */
  type: ConnectionEventType;
  /** Connection state during the event */
  connectionState: ConnectionState;
  /** Network quality during the event */
  networkQuality?: NetworkQuality;
  /** Metrics at the time of the event */
  metrics?: ConnectionQualityMetrics;
  /** Server health during the event */
  serverHealth?: ServerHealthState;
  /** Service status during the event */
  serviceStatus?: ServiceStatus;
  /** Additional event data */
  data?: Record<string, any>;
  /** Duration in milliseconds (for outages, etc.) */
  duration?: number;
}

/**
 * Types of connection events
 */
export type ConnectionEventType = 
  | 'connected'
  | 'disconnected'
  | 'reconnected'
  | 'error'
  | 'quality_changed'
  | 'server_health_changed'
  | 'timeout'
  | 'latency_spike'
  | 'bandwidth_changed';

/**
 * Uptime analytics data
 */
export interface UptimeAnalytics {
  /** Overall uptime percentage */
  uptimePercentage: number;
  /** Total uptime in milliseconds */
  totalUptime: number;
  /** Total downtime in milliseconds */
  totalDowntime: number;
  /** Number of outages */
  outageCount: number;
  /** Average outage duration in milliseconds */
  averageOutageDuration: number;
  /** Longest outage duration in milliseconds */
  longestOutage: number;
  /** Current streak of uptime/downtime */
  currentStreak: {
    type: 'uptime' | 'downtime';
    duration: number;
    startTime: number;
  };
  /** Time period for these analytics */
  period: {
    start: number;
    end: number;
  };
}

/**
 * Quality trend data point
 */
export interface QualityTrendPoint {
  /** Timestamp of the measurement */
  timestamp: number;
  /** Network quality */
  quality: NetworkQuality;
  /** Quality score (0-100) */
  score: number;
  /** Latency in milliseconds */
  latency: number;
  /** Jitter in milliseconds */
  jitter: number;
  /** Download bandwidth in Mbps */
  downloadBandwidth: number;
  /** Upload bandwidth in Mbps */
  uploadBandwidth: number;
  /** Packet loss percentage */
  packetLoss: number;
}

/**
 * Connection quality trends over time
 */
export interface QualityTrends {
  /** Data points for the trend */
  dataPoints: QualityTrendPoint[];
  /** Trend analysis */
  analysis: {
    /** Overall trend direction */
    direction: 'improving' | 'degrading' | 'stable';
    /** Confidence in the trend (0-1) */
    confidence: number;
    /** Percentage change over the period */
    percentageChange: number;
    /** Average quality score over the period */
    averageScore: number;
    /** Quality volatility (standard deviation) */
    volatility: number;
  };
  /** Time period for these trends */
  period: {
    start: number;
    end: number;
    granularity: 'minute' | 'hour' | 'day' | 'week';
  };
}

/**
 * Performance metrics over time
 */
export interface PerformanceMetrics {
  /** Latency statistics */
  latency: {
    /** Current value */
    current: number;
    /** Average over period */
    average: number;
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** 95th percentile */
    p95: number;
    /** 99th percentile */
    p99: number;
    /** Trend over period */
    trend: number; // percentage change
  };
  /** Bandwidth statistics */
  bandwidth: {
    download: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: number;
    };
    upload: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: number;
    };
  };
  /** Reliability metrics */
  reliability: {
    /** Success rate percentage */
    successRate: number;
    /** Error rate percentage */
    errorRate: number;
    /** Time between failures (MTBF) */
    meanTimeBetweenFailures: number;
    /** Time to recovery (MTTR) */
    meanTimeToRecovery: number;
  };
  /** Time period for these metrics */
  period: {
    start: number;
    end: number;
  };
}

/**
 * Historical analytics summary
 */
export interface AnalyticsSummary {
  /** Uptime analytics */
  uptime: UptimeAnalytics;
  /** Quality trends */
  quality: QualityTrends;
  /** Performance metrics */
  performance: PerformanceMetrics;
  /** Recent events (last 50) */
  recentEvents: ConnectionEvent[];
  /** Statistics about the data */
  dataStats: {
    /** Total number of data points */
    totalDataPoints: number;
    /** First recorded timestamp */
    firstRecorded: number;
    /** Last updated timestamp */
    lastUpdated: number;
    /** Data retention period in milliseconds */
    retentionPeriod: number;
  };
}

/**
 * Analytics storage configuration
 */
export interface AnalyticsConfig {
  /** Maximum number of events to store in memory */
  maxEvents: number;
  /** Maximum number of quality trend points */
  maxTrendPoints: number;
  /** Data retention period in milliseconds */
  retentionPeriod: number;
  /** Storage backend */
  storage: {
    /** Use localStorage for persistence */
    localStorage: boolean;
    /** Use Supabase for long-term storage */
    supabase?: {
      enabled: boolean;
      projectUrl?: string;
      anonKey?: string;
      table?: string;
    };
  };
  /** Analytics calculation intervals */
  intervals: {
    /** How often to calculate trends (ms) */
    trendCalculation: number;
    /** How often to update metrics (ms) */
    metricsUpdate: number;
    /** How often to clean old data (ms) */
    dataCleanup: number;
  };
}

/**
 * Outage information
 */
export interface Outage {
  /** Unique identifier */
  id: string;
  /** Start time of the outage */
  startTime: number;
  /** End time of the outage (if resolved) */
  endTime?: number;
  /** Duration in milliseconds */
  duration: number;
  /** Cause of the outage */
  cause: 'connection' | 'server' | 'network' | 'timeout' | 'unknown';
  /** Severity level */
  severity: 'minor' | 'major' | 'critical';
  /** Events during this outage */
  events: ConnectionEvent[];
  /** Whether the outage is ongoing */
  isOngoing: boolean;
}

/**
 * Analytics aggregation periods
 */
export type AnalyticsPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * Time-based aggregated data
 */
export interface AggregatedData {
  /** Time period */
  period: AnalyticsPeriod;
  /** Start time of the period */
  startTime: number;
  /** End time of the period */
  endTime: number;
  /** Uptime percentage for this period */
  uptimePercentage: number;
  /** Average latency */
  averageLatency: number;
  /** Average quality score */
  averageQuality: number;
  /** Number of events */
  eventCount: number;
  /** Number of outages */
  outageCount: number;
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  maxEvents: 1000,
  maxTrendPoints: 500,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  storage: {
    localStorage: true,
    supabase: {
      enabled: false,
      table: 'mcp_connection_analytics'
    }
  },
  intervals: {
    trendCalculation: 60 * 1000, // 1 minute
    metricsUpdate: 30 * 1000, // 30 seconds
    dataCleanup: 60 * 60 * 1000 // 1 hour
  }
};

/**
 * Analytics event callback type
 */
export type AnalyticsEventCallback = (event: ConnectionEvent) => void;

/**
 * Trend calculation result
 */
export interface TrendCalculation {
  /** Linear regression slope */
  slope: number;
  /** R-squared value (goodness of fit) */
  rSquared: number;
  /** Trend direction */
  direction: 'improving' | 'degrading' | 'stable';
  /** Confidence level (0-1) */
  confidence: number;
  /** Projected value based on trend */
  projection: number;
}

/**
 * Export all types
 */
export type {
  ConnectionEvent,
  ConnectionEventType,
  UptimeAnalytics,
  QualityTrendPoint,
  QualityTrends,
  PerformanceMetrics,
  AnalyticsSummary,
  AnalyticsConfig,
  Outage,
  AnalyticsPeriod,
  AggregatedData,
  AnalyticsEventCallback,
  TrendCalculation
};