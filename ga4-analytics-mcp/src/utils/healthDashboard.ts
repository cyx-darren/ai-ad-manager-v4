/**
 * Health Dashboard and Monitoring System
 * 
 * Provides comprehensive health dashboards, uptime monitoring,
 * and real-time system status for production observability.
 */

import { logger } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';
import { errorTracker } from './errorTracking.js';
import { apmMonitor } from './apmMonitoring.js';
import { getAuthManager } from './googleAuth.js';
import cron from 'node-cron';

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  uptime: number;
  timestamp: number;
  version: string;
  environment: string;
  components: ComponentStatus[];
  metrics: DashboardMetrics;
  alerts: AlertSummary;
  trends: TrendData;
}

export interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
  critical: boolean;
}

export interface DashboardMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
    errorRate: number; // percentage
  };
  performance: {
    averageLatency: number;
    p95Latency: number;
    slowRequests: number;
    throughput: number;
  };
  resources: {
    memoryUsage: number; // percentage
    cpuUsage: number; // percentage
    diskUsage?: number; // percentage
    openConnections: number;
  };
  business: {
    mcpToolCalls: number;
    ga4ApiCalls: number;
    authEvents: number;
    dataProcessed: number; // bytes
  };
  health: {
    availability: number; // percentage
    mttr: number; // mean time to resolution
    incidents: number;
    lastIncident?: number;
  };
}

export interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  recent: Array<{
    id: string;
    severity: string;
    message: string;
    timestamp: number;
    resolved: boolean;
  }>;
}

export interface TrendData {
  timeRange: string;
  points: Array<{
    timestamp: number;
    requests: number;
    errors: number;
    latency: number;
    memoryUsage: number;
  }>;
  predictions?: {
    nextHourRequests: number;
    nextHourErrors: number;
    resourcePressure: 'low' | 'medium' | 'high';
  };
}

export interface UptimeRecord {
  timestamp: number;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  components: Record<string, boolean>;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<{ status: boolean; message?: string; details?: any; responseTime?: number }>;
  critical: boolean;
  timeout: number;
  interval: number;
  lastRun?: number;
  enabled: boolean;
}

export class HealthDashboard {
  private uptimeRecords: UptimeRecord[] = [];
  private startTime: number;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private trendData: TrendData['points'] = [];
  private lastMetricsUpdate: number = 0;
  private readonly maxUptimeRecords = 2880; // 24 hours at 30-second intervals
  private readonly maxTrendPoints = 720; // 6 hours at 30-second intervals

  constructor() {
    this.startTime = Date.now();
    this.setupDefaultHealthChecks();
    this.startMonitoring();
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    // Run all health checks
    const components = await this.runAllHealthChecks();
    
    // Determine overall status
    const overallStatus = this.determineOverallStatus(components);
    
    // Get metrics
    const metrics = await this.getDashboardMetrics();
    
    // Get alerts summary
    const alerts = this.getAlertSummary();
    
    // Get trend data
    const trends = this.getTrendData();

    return {
      status: overallStatus,
      uptime,
      timestamp: now,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components,
      metrics,
      alerts,
      trends
    };
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(hours: number = 24): {
    availability: number;
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    avgResponseTime: number;
    incidents: Array<{
      start: number;
      end?: number;
      duration?: number;
      reason: string;
    }>;
  } {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const records = this.uptimeRecords.filter(r => r.timestamp >= cutoff);
    
    if (records.length === 0) {
      return {
        availability: 100,
        totalChecks: 0,
        upChecks: 0,
        downChecks: 0,
        avgResponseTime: 0,
        incidents: []
      };
    }

    const upChecks = records.filter(r => r.status === 'up').length;
    const downChecks = records.filter(r => r.status === 'down').length;
    const availability = (upChecks / records.length) * 100;
    const avgResponseTime = records.reduce((sum, r) => sum + r.responseTime, 0) / records.length;

    // Identify incidents (consecutive down periods)
    const incidents = this.identifyIncidents(records);

    return {
      availability,
      totalChecks: records.length,
      upChecks,
      downChecks,
      avgResponseTime,
      incidents
    };
  }

  /**
   * Generate health dashboard HTML
   */
  generateDashboardHTML(): string {
    // This would generate a comprehensive HTML dashboard
    // For now, returning a placeholder
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GA4 Analytics MCP Health Dashboard</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-healthy { color: #27ae60; }
        .status-degraded { color: #f39c12; }
        .status-unhealthy { color: #e74c3c; }
        .metric { margin: 10px 0; }
        .metric-label { font-weight: bold; }
        .metric-value { float: right; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert-critical { background: #e74c3c; color: white; }
        .alert-high { background: #e67e22; color: white; }
        .alert-medium { background: #f39c12; color: white; }
        .alert-low { background: #3498db; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GA4 Analytics MCP Health Dashboard</h1>
            <p>Real-time monitoring and observability</p>
        </div>
        <div class="grid">
            <!-- Status cards would be dynamically generated here -->
            <div class="card">
                <h3>System Status</h3>
                <p class="status-healthy">🟢 All systems operational</p>
                <div class="metric">
                    <span class="metric-label">Uptime:</span>
                    <span class="metric-value">99.9%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Response Time:</span>
                    <span class="metric-value">145ms</span>
                </div>
            </div>
            <!-- More cards would be added dynamically -->
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Add custom health check
   */
  addHealthCheck(check: HealthCheck): void {
    this.healthChecks.set(check.name, check);
    logger.info(`Health check added: ${check.name}`, {
      critical: check.critical,
      interval: check.interval,
      timeout: check.timeout
    });
  }

  /**
   * Remove health check
   */
  removeHealthCheck(name: string): boolean {
    return this.healthChecks.delete(name);
  }

  /**
   * Run specific health check
   */
  async runHealthCheck(name: string): Promise<ComponentStatus | null> {
    const check = this.healthChecks.get(name);
    if (!check || !check.enabled) return null;

    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const result = await Promise.race([check.check(), timeoutPromise]);
      const responseTime = Date.now() - startTime;
      
      check.lastRun = Date.now();

      return {
        name: check.name,
        status: result.status ? 'healthy' : 'unhealthy',
        lastCheck: check.lastRun,
        responseTime,
        message: result.message,
        details: result.details,
        critical: check.critical
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      check.lastRun = Date.now();

      return {
        name: check.name,
        status: 'unhealthy',
        lastCheck: check.lastRun,
        responseTime,
        message: error instanceof Error ? error.message : 'Health check failed',
        critical: check.critical
      };
    }
  }

  /**
   * Run all health checks
   */
  private async runAllHealthChecks(): Promise<ComponentStatus[]> {
    const promises = Array.from(this.healthChecks.keys()).map(name => this.runHealthCheck(name));
    const results = await Promise.all(promises);
    return results.filter((result): result is ComponentStatus => result !== null);
  }

  /**
   * Setup default health checks
   */
  private setupDefaultHealthChecks(): void {
    // Google Authentication health check
    this.addHealthCheck({
      name: 'google_auth',
      check: async () => {
        try {
          const authManager = getAuthManager();
          const isValid = authManager.isAuthenticationValid();
          return {
            status: isValid,
            message: isValid ? 'Authentication valid' : 'Authentication invalid',
            details: { hasCredentials: !!authManager }
          };
        } catch (error) {
          return {
            status: false,
            message: `Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      },
      critical: true,
      timeout: 5000,
      interval: 60000, // 1 minute
      enabled: true
    });

    // Memory usage health check
    this.addHealthCheck({
      name: 'memory_usage',
      check: async () => {
        const usage = process.memoryUsage();
        const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
        const status = heapUsedPercent < 90;
        
        return {
          status,
          message: `Memory usage: ${heapUsedPercent.toFixed(2)}%`,
          details: {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            percentage: heapUsedPercent
          }
        };
      },
      critical: false,
      timeout: 1000,
      interval: 30000, // 30 seconds
      enabled: true
    });

    // Performance metrics health check
    this.addHealthCheck({
      name: 'performance_metrics',
      check: async () => {
        try {
          const metrics = performanceMonitor.getPerformanceMetrics();
          const highErrorRate = metrics.errorRate > 10;
          const slowResponse = metrics.averageResponseTime > 5000;
          
          return {
            status: !highErrorRate && !slowResponse,
            message: `Error rate: ${metrics.errorRate.toFixed(2)}%, Avg response: ${metrics.averageResponseTime.toFixed(0)}ms`,
            details: {
              errorRate: metrics.errorRate,
              averageResponseTime: metrics.averageResponseTime,
              requestCount: metrics.requestCount
            }
          };
        } catch (error) {
          return {
            status: false,
            message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      },
      critical: false,
      timeout: 2000,
      interval: 60000, // 1 minute
      enabled: true
    });

    // Error tracking health check
    this.addHealthCheck({
      name: 'error_tracking',
      check: async () => {
        try {
          const errorStats = errorTracker.getErrorStats();
          const highErrorRate = errorStats.errorRate > 5;
          const criticalErrors = errorStats.criticalErrors.length > 0;
          
          return {
            status: !highErrorRate && !criticalErrors,
            message: `${errorStats.totalErrors} total errors, rate: ${errorStats.errorRate.toFixed(2)}/min`,
            details: {
              totalErrors: errorStats.totalErrors,
              errorRate: errorStats.errorRate,
              criticalErrors: errorStats.criticalErrors.length
            }
          };
        } catch (error) {
          return {
            status: false,
            message: `Error tracking check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      },
      critical: false,
      timeout: 2000,
      interval: 60000, // 1 minute
      enabled: true
    });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Record uptime every 30 seconds
    setInterval(async () => {
      const components = await this.runAllHealthChecks();
      const overallStatus = this.determineOverallStatus(components);
      
      const record: UptimeRecord = {
        timestamp: Date.now(),
        status: overallStatus === 'healthy' ? 'up' : overallStatus === 'degraded' ? 'degraded' : 'down',
        responseTime: this.calculateAverageResponseTime(components),
        components: components.reduce((acc, comp) => {
          acc[comp.name] = comp.status === 'healthy';
          return acc;
        }, {} as Record<string, boolean>)
      };

      this.uptimeRecords.push(record);
      
      // Keep only recent records
      if (this.uptimeRecords.length > this.maxUptimeRecords) {
        this.uptimeRecords = this.uptimeRecords.slice(-this.maxUptimeRecords);
      }
    }, 30000);

    // Update trend data every 30 seconds
    setInterval(() => {
      this.updateTrendData();
    }, 30000);

    // Schedule daily uptime reports
    cron.schedule('0 0 * * *', () => {
      this.generateDailyReport();
    });

    // Schedule weekly summary
    cron.schedule('0 0 * * 0', () => {
      this.generateWeeklyReport();
    });

    logger.info('Health dashboard monitoring started', {
      healthChecks: this.healthChecks.size,
      uptimeRecordInterval: 30000,
      trendDataInterval: 30000
    });
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(components: ComponentStatus[]): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    const criticalUnhealthy = components.filter(c => c.critical && c.status === 'unhealthy');
    const anyUnhealthy = components.filter(c => c.status === 'unhealthy');
    const anyDegraded = components.filter(c => c.status === 'degraded');

    if (criticalUnhealthy.length > 0) {
      return 'critical';
    }
    if (anyUnhealthy.length > 0) {
      return 'unhealthy';
    }
    if (anyDegraded.length > 0) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Get dashboard metrics
   */
  private async getDashboardMetrics(): Promise<DashboardMetrics> {
    const perfMetrics = performanceMonitor.getPerformanceMetrics();
    const apmMetrics = apmMonitor.getAPMMetrics();
    const errorStats = errorTracker.getErrorStats();
    const memUsage = process.memoryUsage();

    return {
      requests: {
        total: perfMetrics.requestCount,
        successful: perfMetrics.requestCount - errorStats.totalErrors,
        failed: errorStats.totalErrors,
        rate: apmMetrics.throughput.requestsPerSecond,
        errorRate: perfMetrics.errorRate
      },
      performance: {
        averageLatency: perfMetrics.averageResponseTime,
        p95Latency: apmMetrics.latency.p95,
        slowRequests: apmMonitor.getSlowOperations(3000).length,
        throughput: apmMetrics.throughput.requestsPerSecond
      },
      resources: {
        memoryUsage: apmMetrics.resources.memoryUsage,
        cpuUsage: apmMetrics.resources.cpuUsage,
        openConnections: 0 // Would be implemented based on actual connection tracking
      },
      business: {
        mcpToolCalls: apmMetrics.business.mcpToolCalls,
        ga4ApiCalls: apmMetrics.business.ga4ApiCalls,
        authEvents: apmMetrics.business.authenticationEvents,
        dataProcessed: apmMetrics.business.dataProcessed
      },
      health: {
        availability: apmMetrics.serviceHealth.availability,
        mttr: errorStats.mttr,
        incidents: apmMetrics.serviceHealth.incidents,
        lastIncident: errorStats.criticalErrors.length > 0 ? 
          Math.max(...errorStats.criticalErrors.map(e => e.timestamp)) : undefined
      }
    };
  }

  /**
   * Get alert summary
   */
  private getAlertSummary(): AlertSummary {
    const alerts = errorTracker.getAlerts().slice(0, 10);
    
    const summary = alerts.reduce((acc, alert) => {
      switch (alert.severity) {
        case 'critical': acc.critical++; break;
        case 'high': acc.high++; break;
        case 'medium': acc.medium++; break;
        case 'low': acc.low++; break;
      }
      return acc;
    }, { total: alerts.length, critical: 0, high: 0, medium: 0, low: 0 });

    return {
      ...summary,
      recent: alerts.map(alert => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        resolved: alert.resolved || false
      }))
    };
  }

  /**
   * Get trend data
   */
  private getTrendData(): TrendData {
    return {
      timeRange: '6h',
      points: this.trendData.slice(-720), // Last 6 hours
      predictions: {
        nextHourRequests: this.predictNextHourRequests(),
        nextHourErrors: this.predictNextHourErrors(),
        resourcePressure: this.predictResourcePressure()
      }
    };
  }

  /**
   * Update trend data
   */
  private updateTrendData(): void {
    const now = Date.now();
    if (now - this.lastMetricsUpdate < 30000) return; // Throttle to 30 seconds

    const perfMetrics = performanceMonitor.getPerformanceMetrics();
    const errorStats = errorTracker.getErrorStats();
    const memUsage = process.memoryUsage();

    this.trendData.push({
      timestamp: now,
      requests: perfMetrics.requestCount,
      errors: errorStats.totalErrors,
      latency: perfMetrics.averageResponseTime,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    });

    // Keep only recent data
    if (this.trendData.length > this.maxTrendPoints) {
      this.trendData = this.trendData.slice(-this.maxTrendPoints);
    }

    this.lastMetricsUpdate = now;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(components: ComponentStatus[]): number {
    const responseTimes = components
      .filter(c => c.responseTime !== undefined)
      .map(c => c.responseTime!);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  /**
   * Identify incidents from uptime records
   */
  private identifyIncidents(records: UptimeRecord[]): Array<{
    start: number;
    end?: number;
    duration?: number;
    reason: string;
  }> {
    const incidents = [];
    let currentIncident: { start: number; end?: number; duration?: number; reason: string } | null = null;

    for (const record of records) {
      if (record.status === 'down' && !currentIncident) {
        currentIncident = {
          start: record.timestamp,
          reason: 'Service unavailable'
        };
      } else if (record.status === 'up' && currentIncident) {
        currentIncident.end = record.timestamp;
        currentIncident.duration = currentIncident.end - currentIncident.start;
        incidents.push(currentIncident);
        currentIncident = null;
      }
    }

    // If there's an ongoing incident
    if (currentIncident) {
      incidents.push(currentIncident);
    }

    return incidents;
  }

  /**
   * Generate daily report
   */
  private generateDailyReport(): void {
    const uptimeStats = this.getUptimeStats(24);
    
    logger.info('Daily uptime report generated', {
      availability: uptimeStats.availability,
      incidents: uptimeStats.incidents.length,
      avgResponseTime: uptimeStats.avgResponseTime,
      totalChecks: uptimeStats.totalChecks
    });
  }

  /**
   * Generate weekly report
   */
  private generateWeeklyReport(): void {
    const uptimeStats = this.getUptimeStats(24 * 7);
    
    logger.info('Weekly uptime report generated', {
      availability: uptimeStats.availability,
      incidents: uptimeStats.incidents.length,
      avgResponseTime: uptimeStats.avgResponseTime
    });
  }

  /**
   * Predict next hour requests (simple linear extrapolation)
   */
  private predictNextHourRequests(): number {
    if (this.trendData.length < 2) return 0;
    
    const recent = this.trendData.slice(-12); // Last 6 minutes
    if (recent.length < 2) return 0;
    
    const requestsPerInterval = (recent[recent.length - 1].requests - recent[0].requests) / recent.length;
    return Math.max(0, requestsPerInterval * 120); // 120 intervals in 1 hour
  }

  /**
   * Predict next hour errors
   */
  private predictNextHourErrors(): number {
    if (this.trendData.length < 2) return 0;
    
    const recent = this.trendData.slice(-12);
    if (recent.length < 2) return 0;
    
    const errorsPerInterval = (recent[recent.length - 1].errors - recent[0].errors) / recent.length;
    return Math.max(0, errorsPerInterval * 120);
  }

  /**
   * Predict resource pressure
   */
  private predictResourcePressure(): 'low' | 'medium' | 'high' {
    if (this.trendData.length < 6) return 'low';
    
    const recent = this.trendData.slice(-6);
    const avgMemory = recent.reduce((sum, point) => sum + point.memoryUsage, 0) / recent.length;
    
    if (avgMemory > 80) return 'high';
    if (avgMemory > 60) return 'medium';
    return 'low';
  }
}

// Global health dashboard instance
export const healthDashboard = new HealthDashboard();