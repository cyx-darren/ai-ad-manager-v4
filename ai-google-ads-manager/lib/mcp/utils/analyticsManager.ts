/**
 * Connection Analytics Manager
 * 
 * Manages historical connection analytics including uptime tracking,
 * quality trends, performance metrics, and data persistence.
 */

import {
  ConnectionEvent,
  ConnectionEventType,
  UptimeAnalytics,
  QualityTrends,
  QualityTrendPoint,
  PerformanceMetrics,
  AnalyticsSummary,
  AnalyticsConfig,
  Outage,
  AggregatedData,
  AnalyticsPeriod,
  AnalyticsEventCallback,
  TrendCalculation,
  DEFAULT_ANALYTICS_CONFIG
} from '../types/analytics';
import { ConnectionState, NetworkQuality, ConnectionQualityMetrics } from '../types/connection';
import { ServerHealthState, ServiceStatus } from '../types/serverHealth';

/**
 * Core Analytics Manager Class
 */
export class AnalyticsManager {
  private config: AnalyticsConfig;
  private events: ConnectionEvent[] = [];
  private qualityTrends: QualityTrendPoint[] = [];
  private outages: Outage[] = [];
  private currentOutage: Outage | null = null;
  private lastConnectionState: ConnectionState = 'disconnected';
  private sessionStartTime: number = Date.now();
  private eventCallbacks: Set<AnalyticsEventCallback> = new Set();
  
  // Timers for periodic operations
  private trendTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
    this.initializeStorage();
    this.startPeriodicOperations();
  }

  /**
   * Initialize storage and load existing data
   */
  private async initializeStorage(): Promise<void> {
    if (this.config.storage.localStorage && typeof window !== 'undefined') {
      await this.loadFromLocalStorage();
    }
    
    if (this.config.storage.supabase?.enabled) {
      await this.loadFromSupabase();
    }
  }

  /**
   * Record a connection event
   */
  public recordEvent(
    type: ConnectionEventType,
    connectionState: ConnectionState,
    options: {
      networkQuality?: NetworkQuality;
      metrics?: ConnectionQualityMetrics;
      serverHealth?: ServerHealthState;
      serviceStatus?: ServiceStatus;
      data?: Record<string, any>;
    } = {}
  ): void {
    const event: ConnectionEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      connectionState,
      ...options
    };

    // Add to events array
    this.events.push(event);
    
    // Maintain max events limit
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    // Handle outage tracking
    this.handleOutageTracking(event);

    // Record quality trend if metrics available
    if (options.metrics) {
      this.recordQualityTrend(options.metrics);
    }

    // Notify callbacks
    this.eventCallbacks.forEach(callback => callback(event));

    // Persist data
    this.persistData();

    // Update last connection state
    this.lastConnectionState = connectionState;
  }

  /**
   * Handle outage tracking based on events
   */
  private handleOutageTracking(event: ConnectionEvent): void {
    const isOutageEvent = ['disconnected', 'error', 'timeout'].includes(event.type);
    const isRecoveryEvent = ['connected', 'reconnected'].includes(event.type);

    if (isOutageEvent && !this.currentOutage) {
      // Start new outage
      this.currentOutage = {
        id: `outage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: event.timestamp,
        duration: 0,
        cause: this.determineOutageCause(event),
        severity: this.determineOutageSeverity(event),
        events: [event],
        isOngoing: true
      };
    } else if (isOutageEvent && this.currentOutage) {
      // Add event to current outage
      this.currentOutage.events.push(event);
      this.currentOutage.duration = event.timestamp - this.currentOutage.startTime;
    } else if (isRecoveryEvent && this.currentOutage) {
      // End current outage
      this.currentOutage.endTime = event.timestamp;
      this.currentOutage.duration = event.timestamp - this.currentOutage.startTime;
      this.currentOutage.isOngoing = false;
      this.currentOutage.events.push(event);
      
      this.outages.push(this.currentOutage);
      this.currentOutage = null;
    }
  }

  /**
   * Determine outage cause from event
   */
  private determineOutageCause(event: ConnectionEvent): Outage['cause'] {
    switch (event.type) {
      case 'timeout': return 'timeout';
      case 'error': return 'connection';
      case 'disconnected':
        if (event.serverHealth === 'unhealthy') return 'server';
        if (event.networkQuality === 'critical') return 'network';
        return 'connection';
      default: return 'unknown';
    }
  }

  /**
   * Determine outage severity
   */
  private determineOutageSeverity(event: ConnectionEvent): Outage['severity'] {
    if (event.serverHealth === 'unhealthy') return 'critical';
    if (event.networkQuality === 'critical') return 'major';
    return 'minor';
  }

  /**
   * Record quality trend point
   */
  private recordQualityTrend(metrics: ConnectionQualityMetrics): void {
    const trendPoint: QualityTrendPoint = {
      timestamp: Date.now(),
      quality: metrics.quality,
      score: this.calculateQualityScore(metrics.quality),
      latency: metrics.latency,
      jitter: metrics.jitter,
      downloadBandwidth: metrics.downloadBandwidth,
      uploadBandwidth: metrics.uploadBandwidth,
      packetLoss: metrics.packetLoss
    };

    this.qualityTrends.push(trendPoint);

    // Maintain max trend points limit
    if (this.qualityTrends.length > this.config.maxTrendPoints) {
      this.qualityTrends = this.qualityTrends.slice(-this.config.maxTrendPoints);
    }
  }

  /**
   * Calculate quality score from network quality
   */
  private calculateQualityScore(quality: NetworkQuality): number {
    const scores = {
      excellent: 100,
      good: 80,
      fair: 60,
      poor: 40,
      critical: 20,
      unknown: 0
    };
    return scores[quality] || 0;
  }

  /**
   * Calculate uptime analytics
   */
  public calculateUptimeAnalytics(period?: { start: number; end: number }): UptimeAnalytics {
    const now = Date.now();
    const start = period?.start || this.sessionStartTime;
    const end = period?.end || now;
    const totalPeriod = end - start;

    // Filter events in the period
    const periodEvents = this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
    const periodOutages = this.outages.filter(o => o.startTime >= start && o.startTime <= end);

    // Calculate downtime from outages
    let totalDowntime = 0;
    let outageCount = periodOutages.length;

    for (const outage of periodOutages) {
      const outageStart = Math.max(outage.startTime, start);
      const outageEnd = Math.min(outage.endTime || now, end);
      totalDowntime += outageEnd - outageStart;
    }

    // Add current outage if ongoing
    if (this.currentOutage && this.currentOutage.startTime >= start) {
      const outageStart = Math.max(this.currentOutage.startTime, start);
      const outageEnd = Math.min(now, end);
      totalDowntime += outageEnd - outageStart;
      outageCount++;
    }

    const totalUptime = totalPeriod - totalDowntime;
    const uptimePercentage = totalPeriod > 0 ? (totalUptime / totalPeriod) * 100 : 100;

    // Calculate averages
    const averageOutageDuration = outageCount > 0 ? totalDowntime / outageCount : 0;
    const longestOutage = periodOutages.reduce((max, outage) => 
      Math.max(max, outage.duration), 0);

    // Calculate current streak
    const currentStreak = this.calculateCurrentStreak(now);

    return {
      uptimePercentage,
      totalUptime,
      totalDowntime,
      outageCount,
      averageOutageDuration,
      longestOutage,
      currentStreak,
      period: { start, end }
    };
  }

  /**
   * Calculate current uptime/downtime streak
   */
  private calculateCurrentStreak(now: number): UptimeAnalytics['currentStreak'] {
    if (this.currentOutage) {
      return {
        type: 'downtime',
        duration: now - this.currentOutage.startTime,
        startTime: this.currentOutage.startTime
      };
    }

    // Find last outage to determine uptime streak
    const lastOutage = this.outages[this.outages.length - 1];
    const startTime = lastOutage?.endTime || this.sessionStartTime;

    return {
      type: 'uptime',
      duration: now - startTime,
      startTime
    };
  }

  /**
   * Calculate quality trends with analysis
   */
  public calculateQualityTrends(period?: { start: number; end: number }): QualityTrends {
    const now = Date.now();
    const start = period?.start || (now - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const end = period?.end || now;

    // Filter trend points in the period
    const periodPoints = this.qualityTrends.filter(p => p.timestamp >= start && p.timestamp <= end);

    if (periodPoints.length === 0) {
      return {
        dataPoints: [],
        analysis: {
          direction: 'stable',
          confidence: 0,
          percentageChange: 0,
          averageScore: 0,
          volatility: 0
        },
        period: {
          start,
          end,
          granularity: 'hour'
        }
      };
    }

    // Calculate trend analysis
    const scores = periodPoints.map(p => p.score);
    const timestamps = periodPoints.map(p => p.timestamp);
    
    const trendCalculation = this.calculateLinearTrend(timestamps, scores);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const volatility = this.calculateStandardDeviation(scores);
    
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const percentageChange = firstScore > 0 ? ((lastScore - firstScore) / firstScore) * 100 : 0;

    return {
      dataPoints: periodPoints,
      analysis: {
        direction: trendCalculation.direction,
        confidence: trendCalculation.confidence,
        percentageChange,
        averageScore,
        volatility
      },
      period: {
        start,
        end,
        granularity: this.determineGranularity(end - start)
      }
    };
  }

  /**
   * Calculate linear trend from data points
   */
  private calculateLinearTrend(x: number[], y: number[]): TrendCalculation {
    if (x.length < 2) {
      return {
        slope: 0,
        rSquared: 0,
        direction: 'stable',
        confidence: 0,
        projection: y[0] || 0
      };
    }

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    // Determine direction and confidence
    let direction: TrendCalculation['direction'] = 'stable';
    let confidence = Math.abs(rSquared);

    if (Math.abs(slope) > 0.1 && confidence > 0.3) {
      direction = slope > 0 ? 'improving' : 'degrading';
    }

    const projection = slope * (x[x.length - 1] + (x[1] - x[0])) + intercept;

    return {
      slope,
      rSquared,
      direction,
      confidence,
      projection
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Determine appropriate granularity for time period
   */
  private determineGranularity(periodMs: number): QualityTrends['period']['granularity'] {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const week = 7 * day;

    if (periodMs <= 2 * hour) return 'minute';
    if (periodMs <= 2 * day) return 'hour';
    if (periodMs <= 2 * week) return 'day';
    return 'week';
  }

  /**
   * Calculate performance metrics
   */
  public calculatePerformanceMetrics(period?: { start: number; end: number }): PerformanceMetrics {
    const now = Date.now();
    const start = period?.start || (now - 24 * 60 * 60 * 1000);
    const end = period?.end || now;

    // Filter trend points in the period
    const periodPoints = this.qualityTrends.filter(p => p.timestamp >= start && p.timestamp <= end);

    if (periodPoints.length === 0) {
      return {
        latency: { current: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0, trend: 0 },
        bandwidth: {
          download: { current: 0, average: 0, min: 0, max: 0, trend: 0 },
          upload: { current: 0, average: 0, min: 0, max: 0, trend: 0 }
        },
        reliability: {
          successRate: 100,
          errorRate: 0,
          meanTimeBetweenFailures: 0,
          meanTimeToRecovery: 0
        },
        period: { start, end }
      };
    }

    // Calculate latency metrics
    const latencies = periodPoints.map(p => p.latency);
    const downloadSpeeds = periodPoints.map(p => p.downloadBandwidth);
    const uploadSpeeds = periodPoints.map(p => p.uploadBandwidth);

    const latencyMetrics = this.calculateMetricStats(latencies);
    const downloadMetrics = this.calculateMetricStats(downloadSpeeds);
    const uploadMetrics = this.calculateMetricStats(uploadSpeeds);

    // Calculate reliability metrics
    const totalEvents = this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
    const errorEvents = totalEvents.filter(e => ['error', 'timeout', 'disconnected'].includes(e.type));
    const successRate = totalEvents.length > 0 ? ((totalEvents.length - errorEvents.length) / totalEvents.length) * 100 : 100;
    const errorRate = 100 - successRate;

    // Calculate MTBF and MTTR
    const outagesInPeriod = this.outages.filter(o => o.startTime >= start && o.startTime <= end);
    const meanTimeBetweenFailures = outagesInPeriod.length > 1 ? 
      (end - start) / outagesInPeriod.length : (end - start);
    const meanTimeToRecovery = outagesInPeriod.length > 0 ?
      outagesInPeriod.reduce((sum, o) => sum + o.duration, 0) / outagesInPeriod.length : 0;

    return {
      latency: latencyMetrics,
      bandwidth: {
        download: downloadMetrics,
        upload: uploadMetrics
      },
      reliability: {
        successRate,
        errorRate,
        meanTimeBetweenFailures,
        meanTimeToRecovery
      },
      period: { start, end }
    };
  }

  /**
   * Calculate statistical metrics for a dataset
   */
  private calculateMetricStats(values: number[]): PerformanceMetrics['latency'] {
    if (values.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0, trend: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Calculate trend (simple comparison of first and last quarter)
    const quarterSize = Math.floor(values.length / 4);
    if (quarterSize > 0) {
      const firstQuarter = values.slice(0, quarterSize);
      const lastQuarter = values.slice(-quarterSize);
      const firstAvg = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
      const trend = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
      
      return { current, average, min, max, p95, p99, trend };
    }

    return { current, average, min, max, p95, p99, trend: 0 };
  }

  /**
   * Get complete analytics summary
   */
  public getAnalyticsSummary(period?: { start: number; end: number }): AnalyticsSummary {
    const uptime = this.calculateUptimeAnalytics(period);
    const quality = this.calculateQualityTrends(period);
    const performance = this.calculatePerformanceMetrics(period);
    
    // Get recent events (last 50)
    const recentEvents = this.events.slice(-50);

    const dataStats = {
      totalDataPoints: this.events.length + this.qualityTrends.length,
      firstRecorded: this.events[0]?.timestamp || this.sessionStartTime,
      lastUpdated: Math.max(
        this.events[this.events.length - 1]?.timestamp || 0,
        this.qualityTrends[this.qualityTrends.length - 1]?.timestamp || 0
      ),
      retentionPeriod: this.config.retentionPeriod
    };

    return {
      uptime,
      quality,
      performance,
      recentEvents,
      dataStats
    };
  }

  /**
   * Start periodic operations
   */
  private startPeriodicOperations(): void {
    // Cleanup old data periodically
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, this.config.intervals.dataCleanup);
  }

  /**
   * Cleanup old data based on retention period
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    // Clean old events
    this.events = this.events.filter(e => e.timestamp > cutoffTime);
    
    // Clean old quality trends
    this.qualityTrends = this.qualityTrends.filter(t => t.timestamp > cutoffTime);
    
    // Clean old outages
    this.outages = this.outages.filter(o => o.startTime > cutoffTime);

    // Persist cleaned data
    this.persistData();
  }

  /**
   * Persist data to storage
   */
  private async persistData(): Promise<void> {
    if (this.config.storage.localStorage && typeof window !== 'undefined') {
      await this.saveToLocalStorage();
    }
    
    if (this.config.storage.supabase?.enabled) {
      await this.saveToSupabase();
    }
  }

  /**
   * Save data to localStorage
   */
  private async saveToLocalStorage(): Promise<void> {
    try {
      const data = {
        events: this.events,
        qualityTrends: this.qualityTrends,
        outages: this.outages,
        sessionStartTime: this.sessionStartTime,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem('mcp-analytics', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save analytics data to localStorage:', error);
    }
  }

  /**
   * Load data from localStorage
   */
  private async loadFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('mcp-analytics');
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
        this.qualityTrends = data.qualityTrends || [];
        this.outages = data.outages || [];
        this.sessionStartTime = data.sessionStartTime || Date.now();
      }
    } catch (error) {
      console.warn('Failed to load analytics data from localStorage:', error);
    }
  }

  /**
   * Save data to Supabase (placeholder for future implementation)
   */
  private async saveToSupabase(): Promise<void> {
    // TODO: Implement Supabase integration
    console.log('Supabase integration not yet implemented');
  }

  /**
   * Load data from Supabase (placeholder for future implementation)
   */
  private async loadFromSupabase(): Promise<void> {
    // TODO: Implement Supabase integration
    console.log('Supabase integration not yet implemented');
  }

  /**
   * Add event callback
   */
  public addEventListener(callback: AnalyticsEventCallback): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Remove event callback
   */
  public removeEventListener(callback: AnalyticsEventCallback): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Get aggregated data for a specific period
   */
  public getAggregatedData(periods: AnalyticsPeriod[]): AggregatedData[] {
    const now = Date.now();
    const results: AggregatedData[] = [];

    for (const period of periods) {
      const { start, end } = this.getPeriodBounds(period, now);
      const uptime = this.calculateUptimeAnalytics({ start, end });
      const quality = this.calculateQualityTrends({ start, end });
      
      const periodEvents = this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
      const periodOutages = this.outages.filter(o => o.startTime >= start && o.startTime <= end);

      results.push({
        period,
        startTime: start,
        endTime: end,
        uptimePercentage: uptime.uptimePercentage,
        averageLatency: quality.analysis.averageScore,
        averageQuality: quality.analysis.averageScore,
        eventCount: periodEvents.length,
        outageCount: periodOutages.length
      });
    }

    return results;
  }

  /**
   * Get time bounds for a period
   */
  private getPeriodBounds(period: AnalyticsPeriod, now: number): { start: number; end: number } {
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    return {
      start: now - periodMs[period],
      end: now
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.trendTimer) clearInterval(this.trendTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    this.eventCallbacks.clear();
  }
}

/**
 * Create analytics manager instance
 */
export function createAnalyticsManager(config?: Partial<AnalyticsConfig>): AnalyticsManager {
  return new AnalyticsManager(config);
}

/**
 * Global analytics manager instance
 */
let globalAnalyticsManager: AnalyticsManager | null = null;

/**
 * Get or create global analytics manager
 */
export function getGlobalAnalyticsManager(config?: Partial<AnalyticsConfig>): AnalyticsManager {
  if (!globalAnalyticsManager) {
    globalAnalyticsManager = createAnalyticsManager(config);
  }
  return globalAnalyticsManager;
}

export default AnalyticsManager;