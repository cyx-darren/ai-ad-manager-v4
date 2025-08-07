/**
 * Security Monitor Implementation
 * 
 * Real-time security monitoring and alerting system
 */

import {
  SecurityMonitorConfig,
  AlertThresholds,
  SecurityAlert,
  SecurityAlertType,
  MonitoringStatus,
  ISecurityMonitor
} from './types';

import { IAuditLogger } from './types';
import { ISecurityValidator } from './types';

// ============================================================================
// SECURITY MONITOR IMPLEMENTATION
// ============================================================================

export class BrowserSecurityMonitor implements ISecurityMonitor {
  private config: SecurityMonitorConfig;
  private alerts: SecurityAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private status: MonitoringStatus;
  private auditLogger?: IAuditLogger;
  private securityValidator?: ISecurityValidator;

  constructor(
    config?: Partial<SecurityMonitorConfig>,
    auditLogger?: IAuditLogger,
    securityValidator?: ISecurityValidator
  ) {
    this.config = {
      enableRealTimeMonitoring: true,
      alertThresholds: {
        failureRate: 0.3,
        riskScore: 0.7,
        accessFrequency: 100,
        violationCount: 5,
        anomalyScore: 0.8
      },
      monitoringInterval: 60000, // 1 minute
      retentionPeriod: 2592000000, // 30 days
      enableNotifications: true,
      notificationChannels: ['console', 'storage'],
      ...config
    };

    this.auditLogger = auditLogger;
    this.securityValidator = securityValidator;

    this.status = {
      isActive: false,
      lastCheck: new Date().toISOString(),
      checksPerformed: 0,
      alertsGenerated: 0,
      systemHealth: 'healthy',
      uptime: 0,
      performance: {
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0
      }
    };

    this.loadAlertsFromStorage();
  }

  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.status.isActive = true;
    this.status.uptime = Date.now();

    if (this.config.enableRealTimeMonitoring) {
      this.monitoringInterval = setInterval(
        () => this.performSecurityCheck(),
        this.config.monitoringInterval
      );
    }

    await this.logEvent('monitoring_started', 'success');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.status.isActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    await this.logEvent('monitoring_stopped', 'success');
  }

  /**
   * Get monitoring status
   */
  async getStatus(): Promise<MonitoringStatus> {
    // Update uptime
    if (this.status.isActive) {
      this.status.uptime = Date.now() - this.status.uptime;
    }

    return { ...this.status };
  }

  /**
   * Get alerts
   */
  async getAlerts(since?: string): Promise<SecurityAlert[]> {
    let filteredAlerts = this.alerts;

    if (since) {
      const sinceTime = new Date(since).getTime();
      filteredAlerts = this.alerts.filter(alert => {
        return new Date(alert.timestamp).getTime() >= sinceTime;
      });
    }

    return filteredAlerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();

      await this.saveAlertsToStorage();
      await this.logEvent('alert_acknowledged', 'success', { alertId, acknowledgedBy });
    }
  }

  /**
   * Configure monitoring
   */
  async configure(config: Partial<SecurityMonitorConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    await this.logEvent('configuration_updated', 'success', { oldConfig, newConfig: this.config });
  }

  /**
   * Generate monitoring report
   */
  async generateReport(period: 'day' | 'week' | 'month'): Promise<Record<string, any>> {
    const now = new Date();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(now.getTime() - periodMs[period]);
    const alerts = await this.getAlerts(startTime.toISOString());

    // Alert statistics
    const alertStats = {
      total: alerts.length,
      byseverity: alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      acknowledged: alerts.filter(a => a.acknowledged).length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length
    };

    // System health metrics
    const healthMetrics = {
      status: this.status.systemHealth,
      uptime: this.status.uptime,
      checksPerformed: this.status.checksPerformed,
      performance: this.status.performance
    };

    // Recommendations
    const recommendations = this.generateReportRecommendations(alertStats, healthMetrics);

    return {
      period,
      generatedAt: new Date().toISOString(),
      timeRange: {
        start: startTime.toISOString(),
        end: now.toISOString()
      },
      alertStatistics: alertStats,
      systemHealth: healthMetrics,
      recommendations,
      summary: {
        overallRisk: this.calculateOverallRisk(alertStats),
        trendDirection: this.calculateTrendDirection(alerts),
        criticalIssues: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length
      }
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async performSecurityCheck(): Promise<void> {
    const checkStart = Date.now();

    try {
      this.status.checksPerformed++;
      this.status.lastCheck = new Date().toISOString();

      // Get security metrics if validator is available
      if (this.securityValidator) {
        const metrics = await this.securityValidator.getSecurityMetrics();
        await this.analyzeSecurityMetrics(metrics);
      }

      // Clean up old alerts
      await this.cleanupOldAlerts();

      // Update system health
      this.updateSystemHealth();

      // Update performance metrics
      const responseTime = Date.now() - checkStart;
      this.updatePerformanceMetrics(responseTime, true);

    } catch (error) {
      console.error('Security check failed:', error);
      this.updatePerformanceMetrics(Date.now() - checkStart, false);
      
      await this.generateAlert({
        type: 'system_compromise',
        severity: 'high',
        title: 'Security Check Failed',
        description: `Security monitoring check failed: ${error.message}`,
        affectedCredentials: [],
        evidence: { error: error.message },
        recommendations: ['Investigate monitoring system', 'Check system resources']
      });
    }
  }

  private async analyzeSecurityMetrics(metrics: any): Promise<void> {
    // Check failure rate
    const failureRate = metrics.totalValidations > 0 ? 
      metrics.failedValidations / metrics.totalValidations : 0;

    if (failureRate > this.config.alertThresholds.failureRate) {
      await this.generateAlert({
        type: 'multiple_failures',
        severity: 'high',
        title: 'High Failure Rate Detected',
        description: `Failure rate of ${(failureRate * 100).toFixed(1)}% exceeds threshold`,
        affectedCredentials: [],
        evidence: { failureRate, metrics },
        recommendations: ['Investigate failed operations', 'Review security policies']
      });
    }

    // Check average risk score
    if (metrics.averageRiskScore > this.config.alertThresholds.riskScore) {
      await this.generateAlert({
        type: 'high_risk_activity',
        severity: 'medium',
        title: 'Elevated Risk Score',
        description: `Average risk score ${metrics.averageRiskScore.toFixed(2)} exceeds threshold`,
        affectedCredentials: [],
        evidence: { averageRiskScore: metrics.averageRiskScore, metrics },
        recommendations: ['Review high-risk operations', 'Implement additional controls']
      });
    }

    // Check violation count
    if (metrics.violationsDetected > this.config.alertThresholds.violationCount) {
      await this.generateAlert({
        type: 'policy_violation',
        severity: 'medium',
        title: 'Multiple Security Violations',
        description: `${metrics.violationsDetected} violations detected`,
        affectedCredentials: [],
        evidence: { violationsDetected: metrics.violationsDetected, metrics },
        recommendations: ['Review security policies', 'Investigate violation patterns']
      });
    }
  }

  private async generateAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);
    this.status.alertsGenerated++;

    // Save to storage
    await this.saveAlertsToStorage();

    // Send notifications
    if (this.config.enableNotifications) {
      await this.sendNotification(alert);
    }

    // Log the alert
    await this.logEvent('alert_generated', 'warning', { alert });
  }

  private async sendNotification(alert: SecurityAlert): Promise<void> {
    for (const channel of this.config.notificationChannels) {
      try {
        switch (channel) {
          case 'console':
            console.warn(`🚨 Security Alert [${alert.severity.toUpperCase()}]: ${alert.title}`);
            console.warn(`Description: ${alert.description}`);
            break;
          
          case 'storage':
            // Already handled by saveAlertsToStorage
            break;
          
          default:
            console.warn(`Unknown notification channel: ${channel}`);
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel}:`, error);
      }
    }
  }

  private updateSystemHealth(): void {
    const recentAlerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      return alertTime > oneHourAgo;
    });

    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
    const highAlerts = recentAlerts.filter(a => a.severity === 'high');

    if (criticalAlerts.length > 0) {
      this.status.systemHealth = 'critical';
    } else if (highAlerts.length > 2) {
      this.status.systemHealth = 'warning';
    } else {
      this.status.systemHealth = 'healthy';
    }
  }

  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    const perf = this.status.performance;
    
    // Update average response time
    const totalRequests = this.status.checksPerformed;
    perf.averageResponseTime = ((perf.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
    
    // Update error rate
    if (!success) {
      perf.errorRate = ((perf.errorRate * (totalRequests - 1)) + 1) / totalRequests;
    } else {
      perf.errorRate = (perf.errorRate * (totalRequests - 1)) / totalRequests;
    }
    
    // Update throughput (checks per minute)
    const uptimeMinutes = (Date.now() - this.status.uptime) / (60 * 1000);
    perf.throughput = uptimeMinutes > 0 ? totalRequests / uptimeMinutes : 0;
  }

  private async cleanupOldAlerts(): Promise<void> {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    const oldCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert => {
      return new Date(alert.timestamp).getTime() > cutoffTime;
    });

    if (this.alerts.length < oldCount) {
      await this.saveAlertsToStorage();
    }
  }

  private generateAlertId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private calculateOverallRisk(alertStats: any): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = alertStats.byType?.critical || 0;
    const highCount = alertStats.byType?.high || 0;
    const totalAlerts = alertStats.total || 0;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (totalAlerts > 5) return 'medium';
    return 'low';
  }

  private calculateTrendDirection(alerts: SecurityAlert[]): 'improving' | 'stable' | 'worsening' {
    if (alerts.length < 4) return 'stable';

    const midpoint = Math.floor(alerts.length / 2);
    const recentAlerts = alerts.slice(0, midpoint);
    const olderAlerts = alerts.slice(midpoint);

    const recentSeverityScore = this.calculateSeverityScore(recentAlerts);
    const olderSeverityScore = this.calculateSeverityScore(olderAlerts);

    if (recentSeverityScore < olderSeverityScore * 0.8) return 'improving';
    if (recentSeverityScore > olderSeverityScore * 1.2) return 'worsening';
    return 'stable';
  }

  private calculateSeverityScore(alerts: SecurityAlert[]): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return alerts.reduce((sum, alert) => sum + weights[alert.severity], 0);
  }

  private generateReportRecommendations(alertStats: any, healthMetrics: any): string[] {
    const recommendations: string[] = [];

    if (alertStats.total > 10) {
      recommendations.push('High alert volume detected - review security policies');
    }

    if (alertStats.unacknowledged > 5) {
      recommendations.push('Multiple unacknowledged alerts - implement alert response procedures');
    }

    if (healthMetrics.performance.errorRate > 0.1) {
      recommendations.push('High error rate in monitoring system - investigate system health');
    }

    if (alertStats.byType?.critical > 0) {
      recommendations.push('Critical alerts detected - immediate security review required');
    }

    return recommendations;
  }

  private async logEvent(operation: string, outcome: 'success' | 'failure' | 'warning', details?: any): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.logEvent({
        eventType: 'system_event',
        operation,
        outcome,
        details: details || {},
        riskLevel: outcome === 'failure' ? 'medium' : 'low',
        metadata: {
          component: 'security_monitor',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  private async loadAlertsFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('mcp_security_alerts');
      if (stored) {
        this.alerts = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load alerts from storage:', error);
      this.alerts = [];
    }
  }

  private async saveAlertsToStorage(): Promise<void> {
    try {
      localStorage.setItem('mcp_security_alerts', JSON.stringify(this.alerts));
    } catch (error) {
      console.warn('Failed to save alerts to storage:', error);
    }
  }
}

// ============================================================================
// SECURITY MONITOR FACTORY
// ============================================================================

export class SecurityMonitorFactory {
  static createDefault(auditLogger?: IAuditLogger, securityValidator?: ISecurityValidator): ISecurityMonitor {
    return new BrowserSecurityMonitor(undefined, auditLogger, securityValidator);
  }

  static createHighSensitivity(auditLogger?: IAuditLogger, securityValidator?: ISecurityValidator): ISecurityMonitor {
    return new BrowserSecurityMonitor({
      enableRealTimeMonitoring: true,
      alertThresholds: {
        failureRate: 0.1,
        riskScore: 0.5,
        accessFrequency: 50,
        violationCount: 2,
        anomalyScore: 0.6
      },
      monitoringInterval: 30000, // 30 seconds
      retentionPeriod: 7776000000, // 90 days
      enableNotifications: true,
      notificationChannels: ['console', 'storage']
    }, auditLogger, securityValidator);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createSecurityMonitor(auditLogger?: IAuditLogger, securityValidator?: ISecurityValidator): ISecurityMonitor {
  return SecurityMonitorFactory.createDefault(auditLogger, securityValidator);
}

export function createHighSensitivityMonitor(auditLogger?: IAuditLogger, securityValidator?: ISecurityValidator): ISecurityMonitor {
  return SecurityMonitorFactory.createHighSensitivity(auditLogger, securityValidator);
}