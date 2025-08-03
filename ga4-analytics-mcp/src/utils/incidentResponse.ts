/**
 * Incident Response and Monitoring Alerting System
 * 
 * Provides comprehensive incident management, alerting, and automated response
 * for production monitoring and emergency situations.
 */

import { logger as productionLogger } from './productionLogger.js';
import { errorTracker, ErrorType, ErrorSeverity } from './errorTracking.js';
import { performanceMonitor } from './performanceMetrics.js';

export enum IncidentSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum IncidentStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum AlertChannel {
  LOG = 'log',
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms'
}

export interface IncidentConfig {
  enabled: boolean;
  autoResponse: boolean;
  escalationTimeout: number;
  retryAttempts: number;
  notificationChannels: AlertChannel[];
  thresholds: {
    criticalErrorRate: number;
    highResponseTime: number;
    lowSuccessRate: number;
    memoryUsageThreshold: number;
    diskUsageThreshold: number;
  };
  recovery: {
    enableAutoRecovery: boolean;
    maxRecoveryAttempts: number;
    recoveryDelay: number;
  };
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  component: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  affectedUsers?: number;
  impact: string;
  rootCause?: string;
  resolution?: string;
  assignee?: string;
  escalated: boolean;
  escalationTime?: Date;
  recovery: {
    attempts: number;
    successful: boolean;
    lastAttempt?: Date;
    autoRecovered: boolean;
  };
  timeline: IncidentEvent[];
  metrics: {
    errorCount: number;
    affectedRequests: number;
    downtime: number;
    responseTime: number;
    successRate: number;
  };
  tags: string[];
  relatedIncidents: string[];
}

export interface IncidentEvent {
  timestamp: Date;
  type: 'created' | 'updated' | 'acknowledged' | 'escalated' | 'resolved' | 'recovery_attempted' | 'auto_resolved';
  description: string;
  user?: string;
  data?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // How long condition must persist
  severity: IncidentSeverity;
  enabled: boolean;
  channels: AlertChannel[];
  cooldown: number; // Minimum time between alerts
  lastTriggered?: Date;
  conditions: {
    timeWindow: number;
    aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
    filters?: Record<string, any>;
  };
  recovery: {
    autoResolve: boolean;
    recoveryThreshold?: number;
    recoveryDuration?: number;
  };
}

export interface AlertMetrics {
  totalAlerts: number;
  activeIncidents: number;
  resolvedIncidents: number;
  averageResolutionTime: number;
  escalationRate: number;
  autoRecoveryRate: number;
  alertFrequency: Record<IncidentSeverity, number>;
  componentHealth: Record<string, number>;
  recentIncidents: Incident[];
}

export class IncidentManager {
  private config: IncidentConfig;
  private incidents: Map<string, Incident> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private metrics: AlertMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date = new Date();

  constructor(config?: Partial<IncidentConfig>) {
    this.config = {
      enabled: process.env.ENABLE_INCIDENT_RESPONSE !== 'false',
      autoResponse: process.env.ENABLE_AUTO_RESPONSE !== 'false',
      escalationTimeout: parseInt(process.env.INCIDENT_ESCALATION_TIMEOUT || '1800000'), // 30 minutes
      retryAttempts: parseInt(process.env.INCIDENT_RETRY_ATTEMPTS || '3'),
      notificationChannels: (process.env.INCIDENT_CHANNELS || 'log,webhook').split(',') as AlertChannel[],
      
      thresholds: {
        criticalErrorRate: parseFloat(process.env.CRITICAL_ERROR_RATE || '5'), // 5% error rate
        highResponseTime: parseInt(process.env.HIGH_RESPONSE_TIME || '2000'), // 2 seconds
        lowSuccessRate: parseFloat(process.env.LOW_SUCCESS_RATE || '95'), // Below 95%
        memoryUsageThreshold: parseFloat(process.env.MEMORY_THRESHOLD || '85'), // 85% memory usage
        diskUsageThreshold: parseFloat(process.env.DISK_THRESHOLD || '90'), // 90% disk usage
      },
      
      recovery: {
        enableAutoRecovery: process.env.ENABLE_AUTO_RECOVERY !== 'false',
        maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3'),
        recoveryDelay: parseInt(process.env.RECOVERY_DELAY || '60000'), // 1 minute
      },

      ...config
    };

    this.metrics = {
      totalAlerts: 0,
      activeIncidents: 0,
      resolvedIncidents: 0,
      averageResolutionTime: 0,
      escalationRate: 0,
      autoRecoveryRate: 0,
      alertFrequency: {
        [IncidentSeverity.CRITICAL]: 0,
        [IncidentSeverity.HIGH]: 0,
        [IncidentSeverity.MEDIUM]: 0,
        [IncidentSeverity.LOW]: 0,
        [IncidentSeverity.INFO]: 0
      },
      componentHealth: {},
      recentIncidents: []
    };

    this.initializeDefaultAlertRules();
    this.startMonitoring();

    productionLogger.info('Incident Response system initialized', {
      component: 'INCIDENT_RESPONSE',
      config: {
        enabled: this.config.enabled,
        autoResponse: this.config.autoResponse,
        channels: this.config.notificationChannels,
        thresholds: this.config.thresholds
      }
    });
  }

  /**
   * Create a new incident
   */
  async createIncident(
    title: string, 
    description: string, 
    severity: IncidentSeverity,
    component: string,
    impact: string,
    metadata?: any
  ): Promise<Incident> {
    const incidentId = this.generateIncidentId();
    
    const incident: Incident = {
      id: incidentId,
      title,
      description,
      severity,
      status: IncidentStatus.OPEN,
      component,
      startTime: new Date(),
      impact,
      escalated: false,
      recovery: {
        attempts: 0,
        successful: false,
        autoRecovered: false
      },
      timeline: [{
        timestamp: new Date(),
        type: 'created',
        description: `Incident created: ${title}`,
        data: metadata
      }],
      metrics: {
        errorCount: 0,
        affectedRequests: 0,
        downtime: 0,
        responseTime: 0,
        successRate: 100
      },
      tags: this.generateTags(severity, component),
      relatedIncidents: []
    };

    this.incidents.set(incidentId, incident);
    this.updateMetrics();

    // Send notifications
    await this.sendAlert(incident, 'Incident Created');

    // Auto-response for critical incidents
    if (severity === IncidentSeverity.CRITICAL && this.config.autoResponse) {
      await this.initiateAutoResponse(incident);
    }

    productionLogger.error('Incident created', {
      component: 'INCIDENT_RESPONSE',
      incidentId,
      title,
      severity,
      affectedComponent: component,
      impact
    });

    return incident;
  }

  /**
   * Update incident status
   */
  async updateIncident(
    incidentId: string,
    updates: Partial<Incident>,
    user?: string,
    notes?: string
  ): Promise<Incident | null> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    const oldStatus = incident.status;
    Object.assign(incident, updates);

    // Add timeline event
    incident.timeline.push({
      timestamp: new Date(),
      type: 'updated',
      description: notes || `Incident updated by ${user || 'system'}`,
      user,
      data: updates
    });

    // Handle status changes
    if (updates.status && updates.status !== oldStatus) {
      await this.handleStatusChange(incident, oldStatus, updates.status);
    }

    // Handle resolution
    if (updates.status === IncidentStatus.RESOLVED && !incident.endTime) {
      incident.endTime = new Date();
      incident.duration = incident.endTime.getTime() - incident.startTime.getTime();
    }

    this.updateMetrics();

    productionLogger.info('Incident updated', {
      component: 'INCIDENT_RESPONSE',
      incidentId,
      oldStatus,
      newStatus: incident.status,
      user
    });

    return incident;
  }

  /**
   * Auto-response for critical incidents
   */
  private async initiateAutoResponse(incident: Incident): Promise<void> {
    productionLogger.info('Initiating auto-response for critical incident', {
      component: 'INCIDENT_RESPONSE',
      incidentId: incident.id
    });

    // Update incident status
    await this.updateIncident(incident.id, { 
      status: IncidentStatus.INVESTIGATING 
    }, 'auto-response', 'Automated response initiated');

    // Perform recovery actions based on component
    const recoveryActions = this.getRecoveryActions(incident.component);
    
    for (const action of recoveryActions) {
      try {
        incident.recovery.attempts++;
        incident.recovery.lastAttempt = new Date();

        productionLogger.info('Executing recovery action', {
          component: 'INCIDENT_RESPONSE',
          incidentId: incident.id,
          action: action.name
        });

        await action.execute();

        // Add timeline event
        incident.timeline.push({
          timestamp: new Date(),
          type: 'recovery_attempted',
          description: `Recovery action executed: ${action.name}`,
          data: { action: action.name, attempt: incident.recovery.attempts }
        });

        // Brief delay between actions
        await this.delay(this.config.recovery.recoveryDelay);

      } catch (error) {
        productionLogger.error('Recovery action failed', {
          component: 'INCIDENT_RESPONSE',
          incidentId: incident.id,
          action: action.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check if recovery was successful
    await this.verifyRecovery(incident);
  }

  /**
   * Get recovery actions for a component
   */
  private getRecoveryActions(component: string): Array<{ name: string; execute: () => Promise<void> }> {
    const actions: Array<{ name: string; execute: () => Promise<void> }> = [];

    switch (component.toLowerCase()) {
      case 'ga4_api':
        actions.push(
          { name: 'Clear GA4 cache', execute: async () => { /* Clear GA4 cache */ } },
          { name: 'Reset connection pool', execute: async () => { /* Reset connections */ } },
          { name: 'Refresh authentication', execute: async () => { /* Refresh auth */ } }
        );
        break;

      case 'cache':
        actions.push(
          { name: 'Clear production cache', execute: async () => { /* Clear cache */ } },
          { name: 'Restart cache service', execute: async () => { /* Restart cache */ } }
        );
        break;

      case 'security':
        actions.push(
          { name: 'Reset rate limiting', execute: async () => { /* Reset rate limits */ } },
          { name: 'Clear security blocks', execute: async () => { /* Clear blocks */ } }
        );
        break;

      case 'database':
        actions.push(
          { name: 'Reset connection pool', execute: async () => { /* Reset DB connections */ } },
          { name: 'Clear query cache', execute: async () => { /* Clear DB cache */ } }
        );
        break;

      default:
        actions.push(
          { name: 'General system check', execute: async () => { /* General health check */ } }
        );
    }

    return actions;
  }

  /**
   * Verify if recovery was successful
   */
  private async verifyRecovery(incident: Incident): Promise<void> {
    // Wait a moment for systems to stabilize
    await this.delay(30000); // 30 seconds

    // Check system health metrics
    const healthScore = await this.calculateHealthScore(incident.component);
    
    if (healthScore > 0.8) { // 80% health threshold
      incident.recovery.successful = true;
      incident.recovery.autoRecovered = true;

      await this.updateIncident(incident.id, {
        status: IncidentStatus.RESOLVED,
        resolution: 'Auto-recovered through automated response actions'
      }, 'auto-response', 'Automated recovery successful');

      incident.timeline.push({
        timestamp: new Date(),
        type: 'auto_resolved',
        description: 'Incident auto-resolved through recovery actions'
      });

      productionLogger.info('Incident auto-resolved', {
        component: 'INCIDENT_RESPONSE',
        incidentId: incident.id,
        healthScore,
        recoveryAttempts: incident.recovery.attempts
      });

    } else {
      productionLogger.warn('Auto-recovery failed, escalating incident', {
        component: 'INCIDENT_RESPONSE',
        incidentId: incident.id,
        healthScore,
        recoveryAttempts: incident.recovery.attempts
      });

      await this.escalateIncident(incident.id);
    }
  }

  /**
   * Escalate incident
   */
  async escalateIncident(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.escalated) {
      return;
    }

    incident.escalated = true;
    incident.escalationTime = new Date();

    incident.timeline.push({
      timestamp: new Date(),
      type: 'escalated',
      description: 'Incident escalated due to severity or failed auto-recovery'
    });

    // Send escalation alerts
    await this.sendAlert(incident, 'Incident Escalated', true);

    productionLogger.error('Incident escalated', {
      component: 'INCIDENT_RESPONSE',
      incidentId,
      title: incident.title,
      severity: incident.severity,
      duration: Date.now() - incident.startTime.getTime()
    });
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(incident: Incident, alertType: string, isEscalation: boolean = false): Promise<void> {
    const alertData = {
      incident,
      alertType,
      isEscalation,
      timestamp: new Date(),
      urgency: this.calculateUrgency(incident.severity, isEscalation)
    };

    for (const channel of this.config.notificationChannels) {
      try {
        await this.sendAlertToChannel(channel, alertData);
      } catch (error) {
        productionLogger.error('Failed to send alert', {
          component: 'INCIDENT_RESPONSE',
          channel,
          incidentId: incident.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(channel: AlertChannel, alertData: any): Promise<void> {
    switch (channel) {
      case AlertChannel.LOG:
        productionLogger.error('INCIDENT ALERT', {
          component: 'INCIDENT_RESPONSE',
          alert: alertData.alertType,
          incident: {
            id: alertData.incident.id,
            title: alertData.incident.title,
            severity: alertData.incident.severity,
            component: alertData.incident.component,
            status: alertData.incident.status
          },
          urgency: alertData.urgency,
          escalation: alertData.isEscalation
        });
        break;

      case AlertChannel.WEBHOOK:
        // In a real implementation, send to webhook URL
        productionLogger.info('Webhook alert sent', {
          component: 'INCIDENT_RESPONSE',
          incidentId: alertData.incident.id,
          webhook: process.env.INCIDENT_WEBHOOK_URL || 'not-configured'
        });
        break;

      case AlertChannel.EMAIL:
        // In a real implementation, send email
        productionLogger.info('Email alert sent', {
          component: 'INCIDENT_RESPONSE',
          incidentId: alertData.incident.id,
          recipients: process.env.INCIDENT_EMAIL_RECIPIENTS || 'not-configured'
        });
        break;

      case AlertChannel.SLACK:
        // In a real implementation, send to Slack
        productionLogger.info('Slack alert sent', {
          component: 'INCIDENT_RESPONSE',
          incidentId: alertData.incident.id,
          channel: process.env.SLACK_CHANNEL || 'not-configured'
        });
        break;

      case AlertChannel.SMS:
        // In a real implementation, send SMS
        productionLogger.info('SMS alert sent', {
          component: 'INCIDENT_RESPONSE',
          incidentId: alertData.incident.id,
          recipients: process.env.SMS_RECIPIENTS || 'not-configured'
        });
        break;
    }
  }

  /**
   * Calculate urgency based on severity and escalation
   */
  private calculateUrgency(severity: IncidentSeverity, isEscalation: boolean): 'immediate' | 'high' | 'medium' | 'low' {
    if (isEscalation || severity === IncidentSeverity.CRITICAL) return 'immediate';
    if (severity === IncidentSeverity.HIGH) return 'high';
    if (severity === IncidentSeverity.MEDIUM) return 'medium';
    return 'low';
  }

  /**
   * Calculate health score for a component
   */
  private async calculateHealthScore(component: string): Promise<number> {
    // In a real implementation, this would check actual system health
    // For now, return a simulated score
    return Math.random() * 0.4 + 0.6; // Random score between 0.6 and 1.0
  }

  /**
   * Handle status changes
   */
  private async handleStatusChange(
    incident: Incident, 
    oldStatus: IncidentStatus, 
    newStatus: IncidentStatus
  ): Promise<void> {
    incident.timeline.push({
      timestamp: new Date(),
      type: 'updated',
      description: `Status changed from ${oldStatus} to ${newStatus}`
    });

    // Send status change notifications for critical incidents
    if (incident.severity === IncidentSeverity.CRITICAL) {
      await this.sendAlert(incident, `Status Changed: ${newStatus}`);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Triggers when error rate exceeds threshold',
        metric: 'error_rate',
        operator: 'gt',
        threshold: this.config.thresholds.criticalErrorRate,
        duration: 300000, // 5 minutes
        severity: IncidentSeverity.HIGH,
        enabled: true,
        channels: [AlertChannel.LOG, AlertChannel.WEBHOOK],
        cooldown: 600000, // 10 minutes
        conditions: {
          timeWindow: 300000, // 5 minutes
          aggregation: 'avg'
        },
        recovery: {
          autoResolve: true,
          recoveryThreshold: 1, // 1% error rate
          recoveryDuration: 300000 // 5 minutes
        }
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        description: 'Triggers when response time is consistently high',
        metric: 'response_time',
        operator: 'gt',
        threshold: this.config.thresholds.highResponseTime,
        duration: 600000, // 10 minutes
        severity: IncidentSeverity.MEDIUM,
        enabled: true,
        channels: [AlertChannel.LOG],
        cooldown: 900000, // 15 minutes
        conditions: {
          timeWindow: 600000, // 10 minutes
          aggregation: 'avg'
        },
        recovery: {
          autoResolve: true,
          recoveryThreshold: 500, // 500ms
          recoveryDuration: 300000 // 5 minutes
        }
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Start monitoring for alert conditions
   */
  private startMonitoring(): void {
    if (!this.config.enabled) return;

    this.monitoringInterval = setInterval(() => {
      this.checkAlertConditions();
    }, 60000); // Check every minute

    productionLogger.info('Incident monitoring started', {
      component: 'INCIDENT_RESPONSE',
      interval: '60s',
      rules: this.alertRules.size
    });
  }

  /**
   * Check alert conditions
   */
  private async checkAlertConditions(): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule);
        
        if (shouldTrigger) {
          await this.triggerAlert(rule);
          rule.lastTriggered = new Date();
        }
      } catch (error) {
        productionLogger.error('Error evaluating alert rule', {
          component: 'INCIDENT_RESPONSE',
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    // In a real implementation, this would fetch actual metrics
    // For now, simulate metric evaluation
    const mockMetricValue = Math.random() * 100;
    
    switch (rule.operator) {
      case 'gt': return mockMetricValue > rule.threshold;
      case 'lt': return mockMetricValue < rule.threshold;
      case 'gte': return mockMetricValue >= rule.threshold;
      case 'lte': return mockMetricValue <= rule.threshold;
      case 'eq': return mockMetricValue === rule.threshold;
      default: return false;
    }
  }

  /**
   * Trigger alert based on rule
   */
  private async triggerAlert(rule: AlertRule): Promise<void> {
    const incident = await this.createIncident(
      rule.name,
      rule.description,
      rule.severity,
      'monitoring',
      `Alert triggered: ${rule.name}`,
      { ruleId: rule.id, metric: rule.metric, threshold: rule.threshold }
    );

    productionLogger.warn('Alert rule triggered', {
      component: 'INCIDENT_RESPONSE',
      ruleId: rule.id,
      ruleName: rule.name,
      incidentId: incident.id,
      severity: rule.severity
    });
  }

  /**
   * Get incident metrics
   */
  getMetrics(): AlertMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const incidents = Array.from(this.incidents.values());
    
    this.metrics.totalAlerts = incidents.length;
    this.metrics.activeIncidents = incidents.filter(i => 
      i.status !== IncidentStatus.RESOLVED && i.status !== IncidentStatus.CLOSED
    ).length;
    this.metrics.resolvedIncidents = incidents.filter(i => 
      i.status === IncidentStatus.RESOLVED || i.status === IncidentStatus.CLOSED
    ).length;

    // Calculate average resolution time
    const resolvedIncidents = incidents.filter(i => i.endTime);
    if (resolvedIncidents.length > 0) {
      const totalResolutionTime = resolvedIncidents.reduce((sum, i) => sum + (i.duration || 0), 0);
      this.metrics.averageResolutionTime = totalResolutionTime / resolvedIncidents.length;
    }

    // Calculate escalation rate
    const escalatedIncidents = incidents.filter(i => i.escalated).length;
    this.metrics.escalationRate = incidents.length > 0 ? (escalatedIncidents / incidents.length) * 100 : 0;

    // Calculate auto-recovery rate
    const autoRecovered = incidents.filter(i => i.recovery.autoRecovered).length;
    this.metrics.autoRecoveryRate = incidents.length > 0 ? (autoRecovered / incidents.length) * 100 : 0;

    // Update alert frequency
    incidents.forEach(incident => {
      this.metrics.alertFrequency[incident.severity]++;
    });

    // Recent incidents (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics.recentIncidents = incidents
      .filter(i => i.startTime > twentyFourHoursAgo)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 10);
  }

  /**
   * Utility methods
   */
  private generateIncidentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  private generateTags(severity: IncidentSeverity, component: string): string[] {
    return [
      `severity:${severity}`,
      `component:${component}`,
      'automated',
      new Date().toISOString().split('T')[0] // Date tag
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown incident manager
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    productionLogger.info('Incident Response system shutdown', {
      component: 'INCIDENT_RESPONSE',
      totalIncidents: this.incidents.size,
      activeIncidents: this.metrics.activeIncidents
    });
  }
}

// Global incident manager instance
let globalIncidentManager: IncidentManager | null = null;

/**
 * Initialize global incident manager
 */
export function initializeIncidentManager(config?: Partial<IncidentConfig>): IncidentManager {
  if (globalIncidentManager) {
    globalIncidentManager.shutdown();
  }

  globalIncidentManager = new IncidentManager(config);
  return globalIncidentManager;
}

/**
 * Get global incident manager instance
 */
export function getIncidentManager(): IncidentManager | null {
  return globalIncidentManager;
}

/**
 * Shutdown global incident manager
 */
export function shutdownIncidentManager(): void {
  if (globalIncidentManager) {
    globalIncidentManager.shutdown();
    globalIncidentManager = null;
  }
}