/**
 * Performance Metrics Collection and Monitoring
 * 
 * Tracks server performance, request metrics, and system health
 * for monitoring and optimization purposes.
 */

import { logger } from './logger.js';

export interface MetricValue {
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  // Request metrics
  requestCount: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  
  // System metrics  
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  
  // MCP specific metrics
  mcpRequestCount: number;
  toolCallCount: number;
  authenticationAttempts: number;
  authenticationSuccesses: number;
  
  // GA4 API metrics
  ga4ApiCalls: number;
  ga4ApiErrors: number;
  ga4ApiLatency: number;
  
  // Phase 3 metrics
  tokenRefreshCount: number;
  credentialRecoveryAttempts: number;
  
  // Time ranges
  last1Minute: Partial<PerformanceMetrics>;
  last5Minutes: Partial<PerformanceMetrics>;
  last15Minutes: Partial<PerformanceMetrics>;
}

export interface MetricsSummary {
  timestamp: string;
  uptime: number;
  performance: PerformanceMetrics;
  trends: {
    requestTrend: 'increasing' | 'decreasing' | 'stable';
    errorTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
  };
  alerts: string[];
}

export class PerformanceMonitor {
  private metrics: Map<string, MetricValue[]> = new Map();
  private startTime: number;
  private lastCleanup: number;
  private readonly maxDataPoints = 1000; // Keep last 1000 data points per metric
  private readonly cleanupInterval = 300000; // 5 minutes

  // Counters
  private requestCount = 0;
  private mcpRequestCount = 0;
  private toolCallCount = 0;
  private authAttempts = 0;
  private authSuccesses = 0;
  private ga4ApiCalls = 0;
  private ga4ApiErrors = 0;
  private tokenRefreshCount = 0;
  private credentialRecoveryAttempts = 0;

  // Response time tracking
  private responseTimes: number[] = [];
  private ga4Latencies: number[] = [];

  constructor() {
    this.startTime = Date.now();
    this.lastCleanup = Date.now();
    
    // Start periodic cleanup
    setInterval(() => this.cleanup(), this.cleanupInterval);
    
    // Start system metrics collection
    setInterval(() => this.collectSystemMetrics(), 30000); // Every 30 seconds
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const timestamp = Date.now();
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricValues = this.metrics.get(name)!;
    metricValues.push({ value, timestamp, tags });
    
    // Keep only recent data points
    if (metricValues.length > this.maxDataPoints) {
      metricValues.splice(0, metricValues.length - this.maxDataPoints);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, tags?: Record<string, string>): void {
    this.recordMetric(name, 1, tags);
    
    // Update internal counters
    switch (name) {
      case 'http_requests_total':
        this.requestCount++;
        break;
      case 'mcp_requests_total':
        this.mcpRequestCount++;
        break;
      case 'tool_calls_total':
        this.toolCallCount++;
        break;
      case 'auth_attempts_total':
        this.authAttempts++;
        break;
      case 'auth_successes_total':
        this.authSuccesses++;
        break;
      case 'ga4_api_calls_total':
        this.ga4ApiCalls++;
        break;
      case 'ga4_api_errors_total':
        this.ga4ApiErrors++;
        break;
      case 'token_refreshes_total':
        this.tokenRefreshCount++;
        break;
      case 'credential_recovery_attempts_total':
        this.credentialRecoveryAttempts++;
        break;
    }
  }

  /**
   * Record response time
   */
  recordResponseTime(duration: number, type: 'http' | 'mcp' | 'ga4' = 'http'): void {
    this.recordMetric(`${type}_response_time`, duration);
    
    if (type === 'http') {
      this.responseTimes.push(duration);
      if (this.responseTimes.length > 100) {
        this.responseTimes.splice(0, this.responseTimes.length - 100);
      }
    } else if (type === 'ga4') {
      this.ga4Latencies.push(duration);
      if (this.ga4Latencies.length > 100) {
        this.ga4Latencies.splice(0, this.ga4Latencies.length - 100);
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;
    const uptimeSeconds = uptime / 1000;

    const memUsage = process.memoryUsage();
    const memoryUsage = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };

    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    const ga4ApiLatency = this.ga4Latencies.length > 0
      ? this.ga4Latencies.reduce((a, b) => a + b, 0) / this.ga4Latencies.length
      : 0;

    const errorRate = this.requestCount > 0 
      ? (this.ga4ApiErrors / Math.max(this.ga4ApiCalls, 1)) * 100 
      : 0;

    const requestsPerSecond = uptimeSeconds > 0 ? this.requestCount / uptimeSeconds : 0;

    return {
      requestCount: this.requestCount,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      
      memoryUsage,
      
      mcpRequestCount: this.mcpRequestCount,
      toolCallCount: this.toolCallCount,
      authenticationAttempts: this.authAttempts,
      authenticationSuccesses: this.authSuccesses,
      
      ga4ApiCalls: this.ga4ApiCalls,
      ga4ApiErrors: this.ga4ApiErrors,
      ga4ApiLatency: Math.round(ga4ApiLatency),
      
      tokenRefreshCount: this.tokenRefreshCount,
      credentialRecoveryAttempts: this.credentialRecoveryAttempts,
      
      last1Minute: this.getMetricsForTimeRange(60 * 1000),
      last5Minutes: this.getMetricsForTimeRange(5 * 60 * 1000),
      last15Minutes: this.getMetricsForTimeRange(15 * 60 * 1000)
    };
  }

  /**
   * Get metrics summary with trends and alerts
   */
  getMetricsSummary(): MetricsSummary {
    const performance = this.getPerformanceMetrics();
    const trends = this.calculateTrends();
    const alerts = this.generateAlerts(performance);

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      performance,
      trends,
      alerts
    };
  }

  /**
   * Get metrics for a specific time range
   */
  private getMetricsForTimeRange(timeRangeMs: number): Partial<PerformanceMetrics> {
    const cutoff = Date.now() - timeRangeMs;
    
    // Count requests in time range
    const recentRequests = this.getMetricCount('http_requests_total', cutoff);
    const recentMcpRequests = this.getMetricCount('mcp_requests_total', cutoff);
    const recentToolCalls = this.getMetricCount('tool_calls_total', cutoff);
    
    return {
      requestCount: recentRequests,
      mcpRequestCount: recentMcpRequests,
      toolCallCount: recentToolCalls
    };
  }

  /**
   * Get metric count since a timestamp
   */
  private getMetricCount(metricName: string, since: number): number {
    const metricValues = this.metrics.get(metricName) || [];
    return metricValues.filter(m => m.timestamp >= since).length;
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): MetricsSummary['trends'] {
    const last5Min = this.getMetricCount('http_requests_total', Date.now() - 5 * 60 * 1000);
    const previous5Min = this.getMetricCount('http_requests_total', Date.now() - 10 * 60 * 1000) - last5Min;
    
    const requestTrend = last5Min > previous5Min ? 'increasing' : 
                        last5Min < previous5Min ? 'decreasing' : 'stable';

    const recentErrors = this.getMetricCount('ga4_api_errors_total', Date.now() - 5 * 60 * 1000);
    const previousErrors = this.getMetricCount('ga4_api_errors_total', Date.now() - 10 * 60 * 1000) - recentErrors;
    
    const errorTrend = recentErrors > previousErrors ? 'increasing' :
                      recentErrors < previousErrors ? 'decreasing' : 'stable';

    const currentMemory = process.memoryUsage().heapUsed;
    const memoryMetrics = this.metrics.get('memory_usage') || [];
    const oldMemory = memoryMetrics.length > 0 ? memoryMetrics[Math.max(0, memoryMetrics.length - 10)].value : currentMemory;
    
    const memoryTrend = currentMemory > oldMemory * 1.1 ? 'increasing' :
                       currentMemory < oldMemory * 0.9 ? 'decreasing' : 'stable';

    return { requestTrend, errorTrend, memoryTrend };
  }

  /**
   * Generate performance alerts
   */
  private generateAlerts(performance: PerformanceMetrics): string[] {
    const alerts: string[] = [];

    if (performance.memoryUsage.percentage > 90) {
      alerts.push('HIGH_MEMORY_USAGE: Memory usage above 90%');
    }

    if (performance.errorRate > 10) {
      alerts.push('HIGH_ERROR_RATE: Error rate above 10%');
    }

    if (performance.averageResponseTime > 5000) {
      alerts.push('SLOW_RESPONSE: Average response time above 5 seconds');
    }

    if (performance.ga4ApiLatency > 3000) {
      alerts.push('SLOW_GA4_API: GA4 API latency above 3 seconds');
    }

    const uptime = Date.now() - this.startTime;
    if (uptime > 24 * 60 * 60 * 1000 && performance.tokenRefreshCount === 0) {
      alerts.push('NO_TOKEN_REFRESH: No token refresh in 24+ hours');
    }

    return alerts;
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.recordMetric('memory_usage', memUsage.heapUsed);
    this.recordMetric('memory_total', memUsage.heapTotal);
    this.recordMetric('memory_external', memUsage.external);

    // Record CPU usage if available
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      this.recordMetric('cpu_user', cpuUsage.user);
      this.recordMetric('cpu_system', cpuUsage.system);
    }
  }

  /**
   * Cleanup old metrics data
   */
  private cleanup(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // Keep 1 hour of data
    
    for (const [name, values] of this.metrics.entries()) {
      const filtered = values.filter(v => v.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }
    
    this.lastCleanup = Date.now();
    logger.debug(`Performance metrics cleanup completed, ${this.metrics.size} metrics tracked`);
  }

  /**
   * Get raw metrics data for external monitoring
   */
  getMetricsData(): Record<string, MetricValue[]> {
    const data: Record<string, MetricValue[]> = {};
    for (const [name, values] of this.metrics.entries()) {
      data[name] = [...values]; // Return a copy
    }
    return data;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.requestCount = 0;
    this.mcpRequestCount = 0;
    this.toolCallCount = 0;
    this.authAttempts = 0;
    this.authSuccesses = 0;
    this.ga4ApiCalls = 0;
    this.ga4ApiErrors = 0;
    this.tokenRefreshCount = 0;
    this.credentialRecoveryAttempts = 0;
    this.responseTimes = [];
    this.ga4Latencies = [];
    this.startTime = Date.now();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();