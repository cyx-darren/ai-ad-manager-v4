/**
 * Application Performance Monitoring (APM) System
 * 
 * Provides distributed tracing, spans, performance insights,
 * and detailed monitoring for production observability.
 */

import { logger } from './productionLogger.js';
import { getCorrelationId } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
  component: string;
  error?: {
    message: string;
    stack?: string;
    type: string;
  };
}

export interface SpanLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export enum SpanStatus {
  UNSET = 'unset',
  OK = 'ok',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export interface Trace {
  id: string;
  rootSpan: Span;
  spans: Map<string, Span>;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  totalSpans: number;
  errorSpans: number;
  service: string;
  operation: string;
}

export interface APMMetrics {
  // Request metrics
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  
  // Latency metrics
  latency: {
    p50: number;    // 50th percentile
    p75: number;    // 75th percentile
    p95: number;    // 95th percentile
    p99: number;    // 99th percentile
    mean: number;
    max: number;
    min: number;
  };
  
  // Error metrics
  errorRate: {
    percentage: number;
    errorsPerSecond: number;
    totalErrors: number;
  };
  
  // Service metrics
  serviceHealth: {
    availability: number;  // percentage
    uptime: number;       // milliseconds
    incidents: number;
  };
  
  // Resource utilization
  resources: {
    cpuUsage: number;     // percentage
    memoryUsage: number;  // percentage
    diskUsage?: number;   // percentage
    networkIO?: {
      inbound: number;    // bytes/sec
      outbound: number;   // bytes/sec
    };
  };
  
  // Business metrics
  business: {
    mcpToolCalls: number;
    ga4ApiCalls: number;
    authenticationEvents: number;
    dataProcessed: number; // bytes
  };
}

export interface PerformanceInsight {
  type: 'slow_operation' | 'high_error_rate' | 'resource_pressure' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  metrics: Record<string, number>;
  affectedOperations: string[];
  timestamp: number;
}

export class APMMonitor {
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private latencyHistory: number[] = [];
  private errorHistory: number[] = [];
  private startTime: number;
  private readonly maxTraces = 1000;
  private readonly maxLatencyHistory = 10000;
  private readonly cleanupInterval = 300000; // 5 minutes

  constructor() {
    this.startTime = Date.now();
    
    // Start periodic cleanup and analysis
    setInterval(() => this.cleanup(), this.cleanupInterval);
    setInterval(() => this.generateInsights(), 60000); // Every minute
    setInterval(() => this.updateMetrics(), 30000); // Every 30 seconds
  }

  /**
   * Start a new trace
   */
  startTrace(operationName: string, component: string, tags: Record<string, any> = {}): string {
    const traceId = this.generateId('trace');
    const rootSpan = this.createSpan(traceId, operationName, component, undefined, tags);
    
    const trace: Trace = {
      id: traceId,
      rootSpan,
      spans: new Map([[rootSpan.id, rootSpan]]),
      startTime: rootSpan.startTime,
      status: SpanStatus.UNSET,
      totalSpans: 1,
      errorSpans: 0,
      service: 'ga4-analytics-mcp',
      operation: operationName
    };

    this.traces.set(traceId, trace);
    this.activeSpans.set(rootSpan.id, rootSpan);

    logger.debug(`Trace started: ${operationName}`, {
      traceId,
      spanId: rootSpan.id,
      component,
      correlationId: getCorrelationId() || undefined
    });

    return traceId;
  }

  /**
   * Start a child span
   */
  startSpan(traceId: string, operationName: string, component: string, parentSpanId?: string, tags: Record<string, any> = {}): string {
    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn(`Trace not found for span: ${traceId}`);
      return '';
    }

    const span = this.createSpan(traceId, operationName, component, parentSpanId, tags);
    trace.spans.set(span.id, span);
    trace.totalSpans++;
    this.activeSpans.set(span.id, span);

    logger.debug(`Span started: ${operationName}`, {
      traceId,
      spanId: span.id,
      parentSpanId,
      component
    });

    return span.id;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, status: SpanStatus = SpanStatus.OK, error?: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn(`Span not found: ${spanId}`);
      return;
    }

    const endTime = Date.now();
    span.endTime = endTime;
    span.duration = endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      };
      span.status = SpanStatus.ERROR;
    }

    // Update trace
    const trace = this.traces.get(span.traceId);
    if (trace) {
      if (span.status === SpanStatus.ERROR) {
        trace.errorSpans++;
      }

      // If this is the root span, finish the trace
      if (span.id === trace.rootSpan.id) {
        trace.endTime = endTime;
        trace.duration = endTime - trace.startTime;
        trace.status = trace.errorSpans > 0 ? SpanStatus.ERROR : SpanStatus.OK;

        // Record metrics
        this.recordTraceMetrics(trace);
      }
    }

    this.activeSpans.delete(spanId);

    logger.debug(`Span finished: ${span.operationName}`, {
      traceId: span.traceId,
      spanId,
      duration: span.duration,
      status: span.status,
      component: span.component,
      hasError: !!span.error
    });
  }

  /**
   * Add log to span
   */
  spanLog(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields
    });
  }

  /**
   * Add tags to span
   */
  spanTags(spanId: string, tags: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    Object.assign(span.tags, tags);
  }

  /**
   * Get APM metrics
   */
  getAPMMetrics(): APMMetrics {
    const now = Date.now();
    const last1Min = now - (60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);

    // Get completed traces in the last hour
    const recentTraces = Array.from(this.traces.values())
      .filter(trace => trace.endTime && trace.endTime >= last1Hour);

    // Calculate throughput
    const tracesLast1Min = recentTraces.filter(trace => trace.endTime! >= last1Min);
    const tracesLast1Hour = recentTraces;

    const throughput = {
      requestsPerSecond: tracesLast1Min.length / 60,
      requestsPerMinute: tracesLast1Min.length,
      requestsPerHour: tracesLast1Hour.length
    };

    // Calculate latency metrics
    const durations = recentTraces
      .filter(trace => trace.duration !== undefined)
      .map(trace => trace.duration!)
      .sort((a, b) => a - b);

    const latency = this.calculateLatencyMetrics(durations);

    // Calculate error metrics
    const errorTraces = recentTraces.filter(trace => trace.status === SpanStatus.ERROR);
    const errorRate = {
      percentage: recentTraces.length > 0 ? (errorTraces.length / recentTraces.length) * 100 : 0,
      errorsPerSecond: errorTraces.filter(trace => trace.endTime! >= last1Min).length / 60,
      totalErrors: errorTraces.length
    };

    // Calculate service health
    const uptime = now - this.startTime;
    const availability = recentTraces.length > 0 ? 
      ((recentTraces.length - errorTraces.length) / recentTraces.length) * 100 : 100;

    const serviceHealth = {
      availability,
      uptime,
      incidents: errorTraces.length
    };

    // Get resource utilization
    const memUsage = process.memoryUsage();
    const resources = {
      cpuUsage: this.getCPUUsage(),
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    // Calculate business metrics
    const business = {
      mcpToolCalls: this.countSpansByOperation('mcp_tool_call', recentTraces),
      ga4ApiCalls: this.countSpansByOperation('ga4_api_call', recentTraces),
      authenticationEvents: this.countSpansByOperation('authentication', recentTraces),
      dataProcessed: this.calculateDataProcessed(recentTraces)
    };

    return {
      throughput,
      latency,
      errorRate,
      serviceHealth,
      resources,
      business
    };
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit: number = 50): Trace[] {
    return Array.from(this.traces.values())
      .filter(trace => trace.endTime !== undefined)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      .slice(0, limit);
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get slow operations
   */
  getSlowOperations(threshold: number = 5000): Array<{ operation: string; avgDuration: number; count: number }> {
    const operationStats = new Map<string, { durations: number[]; count: number }>();

    for (const trace of this.traces.values()) {
      if (!trace.duration || trace.duration < threshold) continue;

      const stats = operationStats.get(trace.operation) || { durations: [], count: 0 };
      stats.durations.push(trace.duration);
      stats.count++;
      operationStats.set(trace.operation, stats);
    }

    return Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        avgDuration: stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length,
        count: stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Generate performance insights
   */
  private generateInsights(): void {
    const metrics = this.getAPMMetrics();
    const insights: PerformanceInsight[] = [];

    // Check for slow operations
    const slowOps = this.getSlowOperations(3000);
    if (slowOps.length > 0) {
      insights.push({
        type: 'slow_operation',
        severity: slowOps[0].avgDuration > 10000 ? 'high' : 'medium',
        title: 'Slow Operations Detected',
        description: `${slowOps.length} operations are running slower than expected`,
        recommendation: 'Review database queries, API calls, and resource-intensive operations',
        metrics: { avgDuration: slowOps[0].avgDuration },
        affectedOperations: slowOps.slice(0, 5).map(op => op.operation),
        timestamp: Date.now()
      });
    }

    // Check for high error rate
    if (metrics.errorRate.percentage > 5) {
      insights.push({
        type: 'high_error_rate',
        severity: metrics.errorRate.percentage > 15 ? 'critical' : 'high',
        title: 'High Error Rate Detected',
        description: `Error rate is at ${metrics.errorRate.percentage.toFixed(2)}%`,
        recommendation: 'Investigate recent errors and check for service dependencies',
        metrics: { errorRate: metrics.errorRate.percentage },
        affectedOperations: [],
        timestamp: Date.now()
      });
    }

    // Check for resource pressure
    if (metrics.resources.memoryUsage > 85) {
      insights.push({
        type: 'resource_pressure',
        severity: metrics.resources.memoryUsage > 95 ? 'critical' : 'high',
        title: 'High Memory Usage',
        description: `Memory usage is at ${metrics.resources.memoryUsage.toFixed(2)}%`,
        recommendation: 'Consider scaling up or optimizing memory-intensive operations',
        metrics: { memoryUsage: metrics.resources.memoryUsage },
        affectedOperations: [],
        timestamp: Date.now()
      });
    }

    // Log insights
    for (const insight of insights) {
      logger.warn(`Performance insight: ${insight.title}`, {
        type: insight.type,
        severity: insight.severity,
        description: insight.description,
        recommendation: insight.recommendation,
        metrics: insight.metrics
      });

      // Update performance metrics
      performanceMonitor.incrementCounter('performance_insights_generated', {
        type: insight.type,
        severity: insight.severity
      });
    }
  }

  /**
   * Create a new span
   */
  private createSpan(traceId: string, operationName: string, component: string, parentSpanId?: string, tags: Record<string, any> = {}): Span {
    const spanId = this.generateId('span');
    
    return {
      id: spanId,
      traceId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      status: SpanStatus.UNSET,
      tags: {
        component,
        ...tags,
        ...(getCorrelationId() ? { correlationId: getCorrelationId()! } : {})
      },
      logs: [],
      component
    };
  }

  /**
   * Record trace metrics
   */
  private recordTraceMetrics(trace: Trace): void {
    if (trace.duration !== undefined) {
      this.latencyHistory.push(trace.duration);
      
      // Keep only recent latency data
      if (this.latencyHistory.length > this.maxLatencyHistory) {
        this.latencyHistory = this.latencyHistory.slice(-this.maxLatencyHistory);
      }
    }

    // Record error
    if (trace.status === SpanStatus.ERROR) {
      this.errorHistory.push(Date.now());
    }

    // Update performance monitor
    performanceMonitor.recordResponseTime(trace.duration || 0, 'mcp');
    performanceMonitor.incrementCounter('traces_completed', {
      operation: trace.operation,
      status: trace.status
    });

    if (trace.errorSpans > 0) {
      performanceMonitor.incrementCounter('traces_with_errors', {
        operation: trace.operation
      });
    }
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatencyMetrics(durations: number[]): APMMetrics['latency'] {
    if (durations.length === 0) {
      return { p50: 0, p75: 0, p95: 0, p99: 0, mean: 0, max: 0, min: 0 };
    }

    const len = durations.length;
    const mean = durations.reduce((sum, d) => sum + d, 0) / len;

    return {
      p50: durations[Math.floor(len * 0.5)] || 0,
      p75: durations[Math.floor(len * 0.75)] || 0,
      p95: durations[Math.floor(len * 0.95)] || 0,
      p99: durations[Math.floor(len * 0.99)] || 0,
      mean,
      max: durations[len - 1] || 0,
      min: durations[0] || 0
    };
  }

  /**
   * Get CPU usage percentage
   */
  private getCPUUsage(): number {
    // Simple CPU usage calculation
    // In production, you might want to use a more sophisticated method
    try {
      const usage = process.cpuUsage();
      return ((usage.user + usage.system) / 1000000) * 100; // Convert to percentage
    } catch {
      return 0;
    }
  }

  /**
   * Count spans by operation
   */
  private countSpansByOperation(operation: string, traces: Trace[]): number {
    return traces.reduce((count, trace) => {
      for (const span of trace.spans.values()) {
        if (span.operationName.includes(operation)) {
          count++;
        }
      }
      return count;
    }, 0);
  }

  /**
   * Calculate data processed
   */
  private calculateDataProcessed(traces: Trace[]): number {
    return traces.reduce((total, trace) => {
      for (const span of trace.spans.values()) {
        const dataSize = span.tags.dataSize as number;
        if (typeof dataSize === 'number') {
          total += dataSize;
        }
      }
      return total;
    }, 0);
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const metrics = this.getAPMMetrics();
    
    // Record APM metrics in performance monitor
    performanceMonitor.recordMetric('apm_requests_per_second', metrics.throughput.requestsPerSecond);
    performanceMonitor.recordMetric('apm_error_rate', metrics.errorRate.percentage);
    performanceMonitor.recordMetric('apm_latency_p95', metrics.latency.p95);
    performanceMonitor.recordMetric('apm_memory_usage', metrics.resources.memoryUsage);
    performanceMonitor.recordMetric('apm_availability', metrics.serviceHealth.availability);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old traces
   */
  private cleanup(): void {
    const cutoff = Date.now() - (2 * 60 * 60 * 1000); // Keep 2 hours
    let removedCount = 0;

    for (const [id, trace] of this.traces.entries()) {
      if (trace.endTime && trace.endTime < cutoff) {
        this.traces.delete(id);
        removedCount++;
      }
    }

    // Keep trace count under limit
    if (this.traces.size > this.maxTraces) {
      const sortedTraces = Array.from(this.traces.entries())
        .sort(([, a], [, b]) => (a.endTime || 0) - (b.endTime || 0));
      
      const toRemove = this.traces.size - this.maxTraces;
      for (let i = 0; i < toRemove; i++) {
        this.traces.delete(sortedTraces[i][0]);
        removedCount++;
      }
    }

    // Clean up error history
    const errorCutoff = Date.now() - (60 * 60 * 1000); // Keep 1 hour
    this.errorHistory = this.errorHistory.filter(timestamp => timestamp >= errorCutoff);

    if (removedCount > 0) {
      logger.debug(`APM cleanup completed`, {
        removedTraces: removedCount,
        activeTraces: this.traces.size,
        activeSpans: this.activeSpans.size
      });
    }
  }
}

// Helper functions for easy APM integration
export function withAPMTrace<T>(
  operationName: string,
  component: string,
  tags: Record<string, any>,
  operation: (traceId: string) => Promise<T>
): Promise<T> {
  const traceId = apmMonitor.startTrace(operationName, component, tags);
  
  return operation(traceId)
    .then(result => {
      apmMonitor.finishSpan(apmMonitor.getTrace(traceId)?.rootSpan.id || '', SpanStatus.OK);
      return result;
    })
    .catch(error => {
      apmMonitor.finishSpan(apmMonitor.getTrace(traceId)?.rootSpan.id || '', SpanStatus.ERROR, error);
      throw error;
    });
}

export function withAPMSpan<T>(
  traceId: string,
  operationName: string,
  component: string,
  parentSpanId: string | undefined,
  tags: Record<string, any>,
  operation: (spanId: string) => Promise<T>
): Promise<T> {
  const spanId = apmMonitor.startSpan(traceId, operationName, component, parentSpanId, tags);
  
  return operation(spanId)
    .then(result => {
      apmMonitor.finishSpan(spanId, SpanStatus.OK);
      return result;
    })
    .catch(error => {
      apmMonitor.finishSpan(spanId, SpanStatus.ERROR, error);
      throw error;
    });
}

// Global APM monitor instance
export const apmMonitor = new APMMonitor();