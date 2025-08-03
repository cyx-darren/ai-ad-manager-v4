/**
 * GA4 API Usage Metrics Collection System
 * 
 * Provides specialized monitoring for Google Analytics 4 API usage,
 * quota tracking, performance analysis, and usage optimization insights.
 */

import { logger } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';
import { errorTracker, ErrorType } from './errorTracking.js';

export interface GA4ApiCall {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  tool: string; // MCP tool that made the call
  correlationId?: string;
  request: {
    propertyId: string;
    metrics: string[];
    dimensions: string[];
    dateRanges: Array<{ startDate: string; endDate: string; name?: string }>;
    limit?: number;
    parameters?: Record<string, any>;
  };
  response: {
    success: boolean;
    duration: number;
    statusCode?: number;
    rowCount?: number;
    dataSize?: number; // bytes
    fromCache?: boolean;
    error?: {
      type: string;
      message: string;
      code?: string;
    };
  };
  quota: {
    tokensUsed?: number;
    dailyQuotaUsed?: number;
    remainingQuota?: number;
  };
}

export interface GA4QuotaUsage {
  daily: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    resetTime: number; // timestamp when quota resets
  };
  hourly?: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
  };
  concurrent?: {
    limit: number;
    current: number;
    peak: number;
  };
}

export interface GA4PerformanceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  
  timing: {
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    slowestCall: number;
    fastestCall: number;
  };
  
  data: {
    totalRowsReturned: number;
    totalDataProcessed: number; // bytes
    averageRowsPerCall: number;
    largestResponse: number; // rows
    smallestResponse: number; // rows
  };
  
  caching: {
    cacheHitRate: number;
    cacheMisses: number;
    cacheHits: number;
    cacheSavings: number; // estimated API calls saved
  };
  
  tools: Record<string, {
    calls: number;
    averageLatency: number;
    successRate: number;
    popularMetrics: string[];
    popularDimensions: string[];
  }>;
  
  trends: {
    callsPerHour: number[];
    latencyTrend: 'improving' | 'degrading' | 'stable';
    errorTrend: 'improving' | 'degrading' | 'stable';
    usageTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface GA4UsagePattern {
  pattern: string;
  frequency: number;
  description: string;
  metrics: string[];
  dimensions: string[];
  tools: string[];
  optimization?: {
    suggestion: string;
    potentialSavings: number; // estimated API calls
    implementation: string;
  };
}

export interface GA4Alert {
  id: string;
  type: 'quota_warning' | 'quota_critical' | 'performance_degradation' | 'high_error_rate' | 'unusual_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export class GA4MetricsCollector {
  private apiCalls: Map<string, GA4ApiCall> = new Map();
  private quotaUsage: GA4QuotaUsage;
  private alerts: Map<string, GA4Alert> = new Map();
  private usagePatterns: Map<string, GA4UsagePattern> = new Map();
  private hourlyCallCounts: number[] = new Array(24).fill(0);
  private currentHour: number;
  private readonly maxStoredCalls = 10000;
  private readonly cleanupInterval = 300000; // 5 minutes

  constructor() {
    this.currentHour = new Date().getHours();
    this.quotaUsage = this.initializeQuotaUsage();
    
    // Start monitoring
    setInterval(() => this.cleanup(), this.cleanupInterval);
    setInterval(() => this.analyzeUsagePatterns(), 600000); // Every 10 minutes
    setInterval(() => this.updateTrends(), 300000); // Every 5 minutes
    setInterval(() => this.checkQuotaAlerts(), 60000); // Every minute
  }

  /**
   * Record GA4 API call
   */
  recordApiCall(call: Omit<GA4ApiCall, 'id' | 'timestamp'>): string {
    const callId = `ga4_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    const apiCall: GA4ApiCall = {
      id: callId,
      timestamp,
      ...call
    };

    this.apiCalls.set(callId, apiCall);
    
    // Update quota usage
    this.updateQuotaUsage(apiCall);
    
    // Update hourly counts
    this.updateHourlyCount();
    
    // Record in performance monitor
    performanceMonitor.recordMetric('ga4_api_latency', call.response.duration, {
      tool: call.tool,
      endpoint: call.endpoint,
      success: call.response.success.toString(),
      cached: call.response.fromCache?.toString() || 'false'
    });

    // Track errors
    if (!call.response.success && call.response.error) {
      errorTracker.trackError(call.response.error.message, {
        type: this.mapErrorToType(call.response.error),
        component: 'GA4_API',
        correlationId: call.correlationId,
        additionalContext: {
          endpoint: call.endpoint,
          tool: call.tool,
          statusCode: call.response.statusCode,
          errorCode: call.response.error.code
        }
      });
    }

    // Log structured call
    logger.info(`GA4 API call recorded: ${call.endpoint}`, {
      callId,
      tool: call.tool,
      duration: call.response.duration,
      success: call.response.success,
      rowCount: call.response.rowCount,
      fromCache: call.response.fromCache,
      correlationId: call.correlationId
    });

    // Check for immediate alerts
    this.checkImmediateAlerts(apiCall);

    return callId;
  }

  /**
   * Get GA4 performance metrics
   */
  getPerformanceMetrics(): GA4PerformanceMetrics {
    const calls = Array.from(this.apiCalls.values());
    const successfulCalls = calls.filter(c => c.response.success);
    const failedCalls = calls.filter(c => !c.response.success);
    
    // Calculate timing metrics
    const durations = successfulCalls.map(c => c.response.duration).sort((a, b) => a - b);
    const timing = this.calculateTimingMetrics(durations);
    
    // Calculate data metrics
    const rowCounts = successfulCalls
      .filter(c => c.response.rowCount !== undefined)
      .map(c => c.response.rowCount!);
    
    const data = this.calculateDataMetrics(calls, rowCounts);
    
    // Calculate caching metrics
    const caching = this.calculateCachingMetrics(calls);
    
    // Calculate tool metrics
    const tools = this.calculateToolMetrics(calls);
    
    // Calculate trends
    const trends = this.calculateTrends();

    return {
      totalCalls: calls.length,
      successfulCalls: successfulCalls.length,
      failedCalls: failedCalls.length,
      successRate: calls.length > 0 ? (successfulCalls.length / calls.length) * 100 : 100,
      timing,
      data,
      caching,
      tools,
      trends
    };
  }

  /**
   * Get quota usage
   */
  getQuotaUsage(): GA4QuotaUsage {
    return { ...this.quotaUsage };
  }

  /**
   * Get usage patterns
   */
  getUsagePatterns(): GA4UsagePattern[] {
    return Array.from(this.usagePatterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get recent API calls
   */
  getRecentApiCalls(limit: number = 50): GA4ApiCall[] {
    return Array.from(this.apiCalls.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get API calls by tool
   */
  getApiCallsByTool(tool: string, limit: number = 100): GA4ApiCall[] {
    return Array.from(this.apiCalls.values())
      .filter(call => call.tool === tool)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get slow API calls
   */
  getSlowApiCalls(threshold: number = 3000): GA4ApiCall[] {
    return Array.from(this.apiCalls.values())
      .filter(call => call.response.duration > threshold)
      .sort((a, b) => b.response.duration - a.response.duration);
  }

  /**
   * Get failed API calls
   */
  getFailedApiCalls(limit: number = 100): GA4ApiCall[] {
    return Array.from(this.apiCalls.values())
      .filter(call => !call.response.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts
   */
  getAlerts(): GA4Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    implementation: string;
    estimatedSavings: number;
    metrics?: Record<string, number>;
  }> {
    const recommendations: Array<{
      type: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      implementation: string;
      estimatedSavings: number;
      metrics?: Record<string, number>;
    }> = [];
    const metrics = this.getPerformanceMetrics();
    
    // High cache miss rate
    if (metrics.caching.cacheHitRate < 60) {
      recommendations.push({
        type: 'caching',
        priority: 'high' as const,
        title: 'Improve API Response Caching',
        description: `Cache hit rate is only ${metrics.caching.cacheHitRate.toFixed(1)}%. Implementing better caching strategies could significantly reduce API calls.`,
        implementation: 'Consider caching responses for longer periods, implementing intelligent cache warming, or using more specific cache keys.',
        estimatedSavings: Math.floor(metrics.totalCalls * (1 - metrics.caching.cacheHitRate / 100) * 0.7),
        metrics: { currentHitRate: metrics.caching.cacheHitRate, targetHitRate: 80 }
      });
    }

    // Frequent duplicate calls
    const duplicatePatterns = this.findDuplicateCallPatterns();
    if (duplicatePatterns.length > 0) {
      recommendations.push({
        type: 'deduplication',
        priority: 'medium' as const,
        title: 'Eliminate Duplicate API Calls',
        description: `Found ${duplicatePatterns.length} patterns of duplicate or similar API calls that could be consolidated.`,
        implementation: 'Implement request deduplication, batch similar requests, or add request merging logic.',
        estimatedSavings: duplicatePatterns.reduce((sum, pattern) => sum + pattern.frequency, 0) * 0.5,
        metrics: undefined
      });
    }

    // Inefficient date range usage
    const inefficientDateRanges = this.findInefficientDateRanges();
    if (inefficientDateRanges > 0) {
      recommendations.push({
        type: 'date_ranges',
        priority: 'medium' as const,
        title: 'Optimize Date Range Queries',
        description: `${inefficientDateRanges} API calls use overlapping or inefficient date ranges.`,
        implementation: 'Consolidate overlapping date ranges, use incremental data fetching, or implement smarter date range selection.',
        estimatedSavings: Math.floor(inefficientDateRanges * 0.3),
        metrics: undefined
      });
    }

    // High error rate
    if (metrics.successRate < 95) {
      recommendations.push({
        type: 'error_handling',
        priority: 'high' as const,
        title: 'Improve Error Handling and Retry Logic',
        description: `Success rate is ${metrics.successRate.toFixed(1)}%. Better error handling could reduce failed calls.`,
        implementation: 'Implement exponential backoff retry logic, better error categorization, and proactive error recovery.',
        estimatedSavings: Math.floor(metrics.failedCalls * 0.8),
        metrics: { currentSuccessRate: metrics.successRate, targetSuccessRate: 98 }
      });
    }

    // Quota efficiency
    if (this.quotaUsage.daily.percentage > 80) {
      recommendations.push({
        type: 'quota_optimization',
        priority: 'high' as const,
        title: 'Optimize Quota Usage',
        description: `Daily quota usage is at ${this.quotaUsage.daily.percentage.toFixed(1)}%. Consider optimizing API usage patterns.`,
        implementation: 'Implement intelligent query optimization, reduce unnecessary metrics/dimensions, or spread load across time.',
        estimatedSavings: Math.floor(this.quotaUsage.daily.used * 0.2),
        metrics: undefined
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Initialize quota usage
   */
  private initializeQuotaUsage(): GA4QuotaUsage {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      daily: {
        limit: 200000, // Default GA4 daily limit
        used: 0,
        remaining: 200000,
        percentage: 0,
        resetTime: tomorrow.getTime()
      }
    };
  }

  /**
   * Update quota usage
   */
  private updateQuotaUsage(call: GA4ApiCall): void {
    // Estimate tokens used based on request complexity
    const tokensUsed = this.estimateTokensUsed(call);
    
    this.quotaUsage.daily.used += tokensUsed;
    this.quotaUsage.daily.remaining = Math.max(0, this.quotaUsage.daily.limit - this.quotaUsage.daily.used);
    this.quotaUsage.daily.percentage = (this.quotaUsage.daily.used / this.quotaUsage.daily.limit) * 100;
    
    // Reset daily quota if needed
    if (Date.now() > this.quotaUsage.daily.resetTime) {
      this.resetDailyQuota();
    }
  }

  /**
   * Estimate tokens used for an API call
   */
  private estimateTokensUsed(call: GA4ApiCall): number {
    // Basic estimation based on request complexity
    let tokens = 10; // Base cost
    
    // Add cost for metrics and dimensions
    tokens += call.request.metrics.length * 2;
    tokens += call.request.dimensions.length * 2;
    
    // Add cost for date ranges
    tokens += call.request.dateRanges.length * 5;
    
    // Add cost based on response size
    if (call.response.rowCount) {
      tokens += Math.floor(call.response.rowCount / 100);
    }
    
    return tokens;
  }

  /**
   * Reset daily quota
   */
  private resetDailyQuota(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    this.quotaUsage.daily.used = 0;
    this.quotaUsage.daily.remaining = this.quotaUsage.daily.limit;
    this.quotaUsage.daily.percentage = 0;
    this.quotaUsage.daily.resetTime = tomorrow.getTime();

    logger.info('Daily GA4 quota reset', {
      limit: this.quotaUsage.daily.limit,
      nextReset: tomorrow.toISOString()
    });
  }

  /**
   * Update hourly count
   */
  private updateHourlyCount(): void {
    const currentHour = new Date().getHours();
    
    if (currentHour !== this.currentHour) {
      // Reset counter for new hour
      this.currentHour = currentHour;
      this.hourlyCallCounts[currentHour] = 0;
    }
    
    this.hourlyCallCounts[currentHour]++;
  }

  /**
   * Calculate timing metrics
   */
  private calculateTimingMetrics(durations: number[]): GA4PerformanceMetrics['timing'] {
    if (durations.length === 0) {
      return {
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        slowestCall: 0,
        fastestCall: 0
      };
    }

    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      averageLatency: sum / durations.length,
      p50Latency: durations[Math.floor(durations.length * 0.5)] || 0,
      p95Latency: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Latency: durations[Math.floor(durations.length * 0.99)] || 0,
      slowestCall: durations[durations.length - 1] || 0,
      fastestCall: durations[0] || 0
    };
  }

  /**
   * Calculate data metrics
   */
  private calculateDataMetrics(calls: GA4ApiCall[], rowCounts: number[]): GA4PerformanceMetrics['data'] {
    const totalRows = rowCounts.reduce((sum, count) => sum + count, 0);
    const totalDataSize = calls
      .filter(c => c.response.dataSize)
      .reduce((sum, c) => sum + (c.response.dataSize || 0), 0);

    return {
      totalRowsReturned: totalRows,
      totalDataProcessed: totalDataSize,
      averageRowsPerCall: rowCounts.length > 0 ? totalRows / rowCounts.length : 0,
      largestResponse: rowCounts.length > 0 ? Math.max(...rowCounts) : 0,
      smallestResponse: rowCounts.length > 0 ? Math.min(...rowCounts) : 0
    };
  }

  /**
   * Calculate caching metrics
   */
  private calculateCachingMetrics(calls: GA4ApiCall[]): GA4PerformanceMetrics['caching'] {
    const cacheHits = calls.filter(c => c.response.fromCache).length;
    const cacheMisses = calls.filter(c => !c.response.fromCache).length;
    const totalCalls = calls.length;

    return {
      cacheHitRate: totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0,
      cacheHits,
      cacheMisses,
      cacheSavings: cacheHits // Estimate: each cache hit saves one API call
    };
  }

  /**
   * Calculate tool metrics
   */
  private calculateToolMetrics(calls: GA4ApiCall[]): Record<string, any> {
    const toolStats: Record<string, {
      calls: number;
      durations: number[];
      successes: number;
      metrics: Set<string>;
      dimensions: Set<string>;
    }> = {};

    for (const call of calls) {
      if (!toolStats[call.tool]) {
        toolStats[call.tool] = {
          calls: 0,
          durations: [],
          successes: 0,
          metrics: new Set(),
          dimensions: new Set()
        };
      }

      const stats = toolStats[call.tool];
      stats.calls++;
      stats.durations.push(call.response.duration);
      
      if (call.response.success) {
        stats.successes++;
      }

      call.request.metrics.forEach(metric => stats.metrics.add(metric));
      call.request.dimensions.forEach(dimension => stats.dimensions.add(dimension));
    }

    const result: Record<string, any> = {};
    
    for (const [tool, stats] of Object.entries(toolStats)) {
      result[tool] = {
        calls: stats.calls,
        averageLatency: stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length,
        successRate: (stats.successes / stats.calls) * 100,
        popularMetrics: Array.from(stats.metrics).slice(0, 5),
        popularDimensions: Array.from(stats.dimensions).slice(0, 5)
      };
    }

    return result;
  }

  /**
   * Calculate trends
   */
  private calculateTrends(): GA4PerformanceMetrics['trends'] {
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.timestamp > Date.now() - (6 * 60 * 60 * 1000)) // Last 6 hours
      .sort((a, b) => a.timestamp - b.timestamp);

    // Simple trend calculation
    const firstHalf = recentCalls.slice(0, Math.floor(recentCalls.length / 2));
    const secondHalf = recentCalls.slice(Math.floor(recentCalls.length / 2));

    const firstHalfLatency = firstHalf.reduce((sum, call) => sum + call.response.duration, 0) / firstHalf.length || 0;
    const secondHalfLatency = secondHalf.reduce((sum, call) => sum + call.response.duration, 0) / secondHalf.length || 0;

    const firstHalfErrors = firstHalf.filter(call => !call.response.success).length;
    const secondHalfErrors = secondHalf.filter(call => !call.response.success).length;

    let latencyTrend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (secondHalfLatency > firstHalfLatency * 1.1) latencyTrend = 'degrading';
    else if (secondHalfLatency < firstHalfLatency * 0.9) latencyTrend = 'improving';

    let errorTrend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (secondHalfErrors > firstHalfErrors * 1.2) errorTrend = 'degrading';
    else if (secondHalfErrors < firstHalfErrors * 0.8) errorTrend = 'improving';

    const usageTrend = secondHalf.length > firstHalf.length * 1.1 ? 'increasing' : 
                      secondHalf.length < firstHalf.length * 0.9 ? 'decreasing' : 'stable';

    return {
      callsPerHour: this.hourlyCallCounts.slice(),
      latencyTrend,
      errorTrend,
      usageTrend
    };
  }

  /**
   * Check immediate alerts
   */
  private checkImmediateAlerts(call: GA4ApiCall): void {
    // Slow response alert
    if (call.response.duration > 10000) {
      this.createAlert({
        type: 'performance_degradation',
        severity: 'high',
        message: `Very slow GA4 API response: ${call.response.duration}ms for ${call.tool}`,
        details: {
          callId: call.id,
          tool: call.tool,
          endpoint: call.endpoint,
          duration: call.response.duration
        }
      });
    }

    // Error alert
    if (!call.response.success) {
      this.createAlert({
        type: 'high_error_rate',
        severity: 'medium',
        message: `GA4 API call failed: ${call.response.error?.message || 'Unknown error'}`,
        details: {
          callId: call.id,
          tool: call.tool,
          endpoint: call.endpoint,
          error: call.response.error
        }
      });
    }
  }

  /**
   * Check quota alerts
   */
  private checkQuotaAlerts(): void {
    if (this.quotaUsage.daily.percentage > 90) {
      this.createAlert({
        type: 'quota_critical',
        severity: 'critical',
        message: `GA4 daily quota usage critical: ${this.quotaUsage.daily.percentage.toFixed(1)}%`,
        details: {
          used: this.quotaUsage.daily.used,
          limit: this.quotaUsage.daily.limit,
          remaining: this.quotaUsage.daily.remaining
        }
      });
    } else if (this.quotaUsage.daily.percentage > 75) {
      this.createAlert({
        type: 'quota_warning',
        severity: 'medium',
        message: `GA4 daily quota usage warning: ${this.quotaUsage.daily.percentage.toFixed(1)}%`,
        details: {
          used: this.quotaUsage.daily.used,
          limit: this.quotaUsage.daily.limit,
          remaining: this.quotaUsage.daily.remaining
        }
      });
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: Omit<GA4Alert, 'id' | 'timestamp'>): void {
    const alertId = `ga4_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullAlert: GA4Alert = {
      id: alertId,
      timestamp: Date.now(),
      ...alert
    };

    this.alerts.set(alertId, fullAlert);

    logger.warn(`GA4 Alert: ${alert.message}`, {
      alertId,
      type: alert.type,
      severity: alert.severity,
      details: alert.details
    });
  }

  /**
   * Analyze usage patterns
   */
  private analyzeUsagePatterns(): void {
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.timestamp > Date.now() - (24 * 60 * 60 * 1000)); // Last 24 hours

    // Find common metric/dimension combinations
    const combinations = new Map<string, number>();
    
    for (const call of recentCalls) {
      const key = `${call.request.metrics.sort().join(',')}_${call.request.dimensions.sort().join(',')}`;
      combinations.set(key, (combinations.get(key) || 0) + 1);
    }

    // Convert to patterns
    this.usagePatterns.clear();
    
    for (const [key, frequency] of combinations.entries()) {
      if (frequency >= 5) { // Only patterns with 5+ occurrences
        const [metricsStr, dimensionsStr] = key.split('_');
        const metrics = metricsStr ? metricsStr.split(',') : [];
        const dimensions = dimensionsStr ? dimensionsStr.split(',') : [];
        
        const tools = recentCalls
          .filter(call => {
            const callKey = `${call.request.metrics.sort().join(',')}_${call.request.dimensions.sort().join(',')}`;
            return callKey === key;
          })
          .map(call => call.tool);

        const pattern: GA4UsagePattern = {
          pattern: key,
          frequency,
          description: `Common query pattern: ${metrics.slice(0, 3).join(', ')} x ${dimensions.slice(0, 3).join(', ')}`,
          metrics,
          dimensions,
          tools: [...new Set(tools)]
        };

        this.usagePatterns.set(key, pattern);
      }
    }
  }

  /**
   * Find duplicate call patterns
   */
  private findDuplicateCallPatterns(): Array<{ pattern: string; frequency: number }> {
    const patterns = new Map<string, number>();
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.timestamp > Date.now() - (60 * 60 * 1000)); // Last hour

    for (const call of recentCalls) {
      const pattern = `${call.request.propertyId}_${call.request.metrics.sort().join(',')}_${call.request.dimensions.sort().join(',')}_${call.request.dateRanges.map(dr => `${dr.startDate}-${dr.endDate}`).join(',')}`;
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    return Array.from(patterns.entries())
      .filter(([, frequency]) => frequency > 2)
      .map(([pattern, frequency]) => ({ pattern, frequency }));
  }

  /**
   * Find inefficient date ranges
   */
  private findInefficientDateRanges(): number {
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.timestamp > Date.now() - (60 * 60 * 1000)); // Last hour

    return recentCalls.filter(call => {
      // Check for overlapping date ranges or very small ranges
      return call.request.dateRanges.length > 3 || 
             call.request.dateRanges.some(range => {
               const start = new Date(range.startDate);
               const end = new Date(range.endDate);
               const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
               return diffDays < 1; // Very short date ranges
             });
    }).length;
  }

  /**
   * Map error to error type
   */
  private mapErrorToType(error: GA4ApiCall['response']['error']): ErrorType | undefined {
    if (!error) return undefined;
    
    const message = error.message.toLowerCase();
    
    if (message.includes('quota') || message.includes('limit')) {
      return ErrorType.QUOTA_EXCEEDED_ERROR;
    }
    if (message.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (message.includes('auth') || message.includes('credential')) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    if (message.includes('rate limit')) {
      return ErrorType.RATE_LIMIT_ERROR;
    }
    
    return ErrorType.GA4_API_ERROR;
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    let removedCalls = 0;
    let removedAlerts = 0;

    // Clean up old API calls
    for (const [id, call] of this.apiCalls.entries()) {
      if (call.timestamp < cutoff) {
        this.apiCalls.delete(id);
        removedCalls++;
      }
    }

    // Keep call count under limit
    if (this.apiCalls.size > this.maxStoredCalls) {
      const sortedCalls = Array.from(this.apiCalls.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = this.apiCalls.size - this.maxStoredCalls;
      for (let i = 0; i < toRemove; i++) {
        this.apiCalls.delete(sortedCalls[i][0]);
        removedCalls++;
      }
    }

    // Clean up old alerts
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff) {
        this.alerts.delete(id);
        removedAlerts++;
      }
    }

    if (removedCalls > 0 || removedAlerts > 0) {
      logger.debug('GA4 metrics cleanup completed', {
        removedCalls,
        removedAlerts,
        activeCalls: this.apiCalls.size,
        activeAlerts: this.alerts.size
      });
    }
  }

  /**
   * Update trends
   */
  private updateTrends(): void {
    const metrics = this.getPerformanceMetrics();
    
    // Record trend metrics
    performanceMonitor.recordMetric('ga4_success_rate', metrics.successRate);
    performanceMonitor.recordMetric('ga4_cache_hit_rate', metrics.caching.cacheHitRate);
    performanceMonitor.recordMetric('ga4_avg_latency', metrics.timing.averageLatency);
    performanceMonitor.recordMetric('ga4_quota_usage', this.quotaUsage.daily.percentage);
  }
}

// Global GA4 metrics collector instance
export const ga4MetricsCollector = new GA4MetricsCollector();