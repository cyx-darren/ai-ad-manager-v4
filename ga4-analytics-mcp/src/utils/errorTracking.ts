/**
 * Advanced Error Tracking and Alerting System
 * 
 * Provides comprehensive error tracking, categorization, alerting,
 * and incident management for production monitoring.
 */

import { logger } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';

export interface ErrorDetails {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  type: ErrorType;
  severity: ErrorSeverity;
  component: string;
  correlationId?: string;
  context?: Record<string, any>;
  fingerprint: string; // For error deduplication
  userImpact: UserImpact;
  recovery?: RecoveryAction;
}

export enum ErrorType {
  AUTHENTICATION_ERROR = 'authentication_error',
  GA4_API_ERROR = 'ga4_api_error',
  MCP_PROTOCOL_ERROR = 'mcp_protocol_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_ERROR = 'configuration_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  QUOTA_EXCEEDED_ERROR = 'quota_exceeded_error',
  TIMEOUT_ERROR = 'timeout_error',
  DATA_PROCESSING_ERROR = 'data_processing_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum ErrorSeverity {
  CRITICAL = 'critical',      // Service unavailable
  HIGH = 'high',             // Major functionality impacted
  MEDIUM = 'medium',         // Minor functionality impacted
  LOW = 'low',              // No user impact
  INFO = 'info'             // Informational only
}

export enum UserImpact {
  SERVICE_DOWN = 'service_down',           // Complete service unavailable
  FEATURE_UNAVAILABLE = 'feature_unavailable', // Specific feature not working
  DEGRADED_PERFORMANCE = 'degraded_performance', // Slow but functional
  NO_IMPACT = 'no_impact'                  // Internal error, no user impact
}

export interface RecoveryAction {
  attempted: boolean;
  type: string;
  success?: boolean;
  message?: string;
  timestamp?: number;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  errorRate: number; // errors per minute
  mttr: number; // mean time to resolution in milliseconds
  recentErrors: ErrorDetails[];
  criticalErrors: ErrorDetails[];
  errorTrends: {
    last5Minutes: number;
    last15Minutes: number;
    last1Hour: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  window: number; // time window in milliseconds
  severity: ErrorSeverity;
  enabled: boolean;
  cooldown: number; // minimum time between alerts in milliseconds
  lastTriggered?: number;
  actions: AlertAction[];
}

export interface AlertCondition {
  type: 'error_rate' | 'error_count' | 'specific_error' | 'consecutive_errors';
  filters?: {
    errorType?: ErrorType;
    component?: string;
    severity?: ErrorSeverity;
  };
}

export interface AlertAction {
  type: 'log' | 'webhook' | 'email' | 'slack';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: number;
  correlationId?: string;
  triggerDetails: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: number;
}

export class ErrorTracker {
  private errors: Map<string, ErrorDetails> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private errorCounts: Record<string, number[]> = {}; // timestamp arrays per component
  private maxErrorHistory = 1000;
  private readonly cleanupInterval = 300000; // 5 minutes

  constructor() {
    // Setup default alert rules
    this.setupDefaultAlertRules();
    
    // Start periodic cleanup
    setInterval(() => this.cleanup(), this.cleanupInterval);
    
    // Start error rate monitoring
    setInterval(() => this.checkAlertRules(), 30000); // Every 30 seconds
  }

  /**
   * Track an error
   */
  trackError(error: Error | string, context: {
    type?: ErrorType;
    severity?: ErrorSeverity;
    component: string;
    correlationId?: string;
    userImpact?: UserImpact;
    additionalContext?: Record<string, any>;
  }): string {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    // Determine error properties
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const type = context.type || this.categorizeError(message);
    const severity = context.severity || this.determineSeverity(type, message);
    const userImpact = context.userImpact || this.determineUserImpact(type, severity);
    const fingerprint = this.generateFingerprint(message, type, context.component);

    const errorDetails: ErrorDetails = {
      id: errorId,
      timestamp,
      message,
      stack,
      type,
      severity,
      component: context.component,
      correlationId: context.correlationId,
      context: context.additionalContext,
      fingerprint,
      userImpact
    };

    // Store error
    this.errors.set(errorId, errorDetails);
    
    // Track error count for component
    if (!this.errorCounts[context.component]) {
      this.errorCounts[context.component] = [];
    }
    this.errorCounts[context.component].push(timestamp);

    // Log structured error
    logger.error(`Error tracked: ${message}`, error instanceof Error ? error : undefined, {
      errorId,
      errorType: type,
      severity,
      component: context.component,
      correlationId: context.correlationId,
      userImpact,
      fingerprint
    });

    // Update performance metrics
    performanceMonitor.incrementCounter('errors_total', {
      type: type.toString(),
      severity: severity.toString(),
      component: context.component
    });

    // Check for immediate alerts
    this.checkImmediateAlerts(errorDetails);

    return errorId;
  }

  /**
   * Attempt error recovery
   */
  attemptRecovery(errorId: string, recoveryType: string, recoveryFunc: () => Promise<boolean>): Promise<void> {
    const errorDetails = this.errors.get(errorId);
    if (!errorDetails) return Promise.resolve();

    return recoveryFunc().then(success => {
      const recovery: RecoveryAction = {
        attempted: true,
        type: recoveryType,
        success,
        message: success ? 'Recovery successful' : 'Recovery failed',
        timestamp: Date.now()
      };

      errorDetails.recovery = recovery;
      
      logger.info(`Recovery attempted for error ${errorId}`, {
        errorId,
        recoveryType,
        success,
        component: errorDetails.component,
        correlationId: errorDetails.correlationId
      });

      if (success) {
        performanceMonitor.incrementCounter('error_recoveries_successful', {
          type: errorDetails.type.toString(),
          component: errorDetails.component
        });
      } else {
        performanceMonitor.incrementCounter('error_recoveries_failed', {
          type: errorDetails.type.toString(),
          component: errorDetails.component
        });
      }
    }).catch(recoveryError => {
      const recovery: RecoveryAction = {
        attempted: true,
        type: recoveryType,
        success: false,
        message: `Recovery error: ${recoveryError.message}`,
        timestamp: Date.now()
      };

      errorDetails.recovery = recovery;
      
      logger.error(`Recovery failed for error ${errorId}`, recoveryError, {
        errorId,
        recoveryType,
        component: errorDetails.component,
        correlationId: errorDetails.correlationId
      });
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const last5Min = now - (5 * 60 * 1000);
    const last15Min = now - (15 * 60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);

    const allErrors = Array.from(this.errors.values());
    const recentErrors = allErrors.filter(e => e.timestamp >= last15Min).slice(-10);
    const criticalErrors = allErrors.filter(e => e.severity === ErrorSeverity.CRITICAL && e.timestamp >= last1Hour);

    // Calculate error counts by time periods
    const last5MinErrors = allErrors.filter(e => e.timestamp >= last5Min).length;
    const last15MinErrors = allErrors.filter(e => e.timestamp >= last15Min).length;
    const last1HourErrors = allErrors.filter(e => e.timestamp >= last1Hour).length;

    // Calculate trend
    const prev5Min = allErrors.filter(e => e.timestamp >= (last5Min - (5 * 60 * 1000)) && e.timestamp < last5Min).length;
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (last5MinErrors > prev5Min * 1.2) trend = 'increasing';
    else if (last5MinErrors < prev5Min * 0.8) trend = 'decreasing';

    // Calculate error rate (errors per minute over last 5 minutes)
    const errorRate = last5MinErrors / 5;

    // Calculate MTTR (mean time to resolution) for resolved errors
    const resolvedErrors = allErrors.filter(e => e.recovery?.success);
    const mttr = resolvedErrors.length > 0 
      ? resolvedErrors.reduce((sum, e) => sum + ((e.recovery?.timestamp || e.timestamp) - e.timestamp), 0) / resolvedErrors.length
      : 0;

    // Group by type, severity, component
    const errorsByType = this.groupByField(allErrors, 'type') as Record<ErrorType, number>;
    const errorsBySeverity = this.groupByField(allErrors, 'severity') as Record<ErrorSeverity, number>;
    const errorsByComponent = this.groupByField(allErrors, 'component');

    return {
      totalErrors: allErrors.length,
      errorsByType,
      errorsBySeverity,
      errorsByComponent,
      errorRate,
      mttr,
      recentErrors,
      criticalErrors,
      errorTrends: {
        last5Minutes: last5MinErrors,
        last15Minutes: last15MinErrors,
        last1Hour: last1HourErrors,
        trend
      }
    };
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'error_rate'
      },
      threshold: 10, // 10 errors per minute
      window: 5 * 60 * 1000, // 5 minutes
      severity: ErrorSeverity.HIGH,
      enabled: true,
      cooldown: 15 * 60 * 1000, // 15 minutes
      actions: [
        { type: 'log', config: { level: 'error' } }
      ]
    });

    // Critical error alert
    this.addAlertRule({
      id: 'critical_error',
      name: 'Critical Error Detected',
      condition: {
        type: 'specific_error',
        filters: { severity: ErrorSeverity.CRITICAL }
      },
      threshold: 1,
      window: 60 * 1000, // 1 minute
      severity: ErrorSeverity.CRITICAL,
      enabled: true,
      cooldown: 5 * 60 * 1000, // 5 minutes
      actions: [
        { type: 'log', config: { level: 'error' } }
      ]
    });

    // GA4 API error clustering
    this.addAlertRule({
      id: 'ga4_api_errors',
      name: 'GA4 API Error Cluster',
      condition: {
        type: 'error_count',
        filters: { errorType: ErrorType.GA4_API_ERROR }
      },
      threshold: 5,
      window: 10 * 60 * 1000, // 10 minutes
      severity: ErrorSeverity.MEDIUM,
      enabled: true,
      cooldown: 20 * 60 * 1000, // 20 minutes
      actions: [
        { type: 'log', config: { level: 'warn' } }
      ]
    });

    // Authentication failure cluster
    this.addAlertRule({
      id: 'auth_failures',
      name: 'Authentication Failure Cluster',
      condition: {
        type: 'error_count',
        filters: { errorType: ErrorType.AUTHENTICATION_ERROR }
      },
      threshold: 3,
      window: 5 * 60 * 1000, // 5 minutes
      severity: ErrorSeverity.HIGH,
      enabled: true,
      cooldown: 10 * 60 * 1000, // 10 minutes
      actions: [
        { type: 'log', config: { level: 'error' } }
      ]
    });
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Check alert rules
   */
  private checkAlertRules(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.lastTriggered && (Date.now() - rule.lastTriggered) < rule.cooldown) {
        continue;
      }

      if (this.evaluateAlertCondition(rule)) {
        this.triggerAlert(rule);
        rule.lastTriggered = Date.now();
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(rule: AlertRule): boolean {
    const now = Date.now();
    const windowStart = now - rule.window;
    
    const relevantErrors = Array.from(this.errors.values()).filter(error => {
      if (error.timestamp < windowStart) return false;
      
      if (rule.condition.filters) {
        const filters = rule.condition.filters;
        if (filters.errorType && error.type !== filters.errorType) return false;
        if (filters.component && error.component !== filters.component) return false;
        if (filters.severity && error.severity !== filters.severity) return false;
      }
      
      return true;
    });

    switch (rule.condition.type) {
      case 'error_count':
        return relevantErrors.length >= rule.threshold;
      
      case 'error_rate':
        const windowMinutes = rule.window / (60 * 1000);
        const errorRate = relevantErrors.length / windowMinutes;
        return errorRate >= rule.threshold;
      
      case 'specific_error':
        return relevantErrors.length >= rule.threshold;
      
      case 'consecutive_errors':
        // Check for consecutive errors in the same component
        const sortedErrors = relevantErrors.sort((a, b) => a.timestamp - b.timestamp);
        return sortedErrors.length >= rule.threshold;
      
      default:
        return false;
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      message: `Alert triggered: ${rule.name}`,
      severity: rule.severity,
      timestamp: Date.now(),
      triggerDetails: {
        threshold: rule.threshold,
        window: rule.window,
        condition: rule.condition
      }
    };

    this.alerts.set(alertId, alert);

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, alert);
    }

    // Update performance metrics
    performanceMonitor.incrementCounter('alerts_triggered', {
      severity: rule.severity.toString(),
      rule: rule.id
    });

    logger.warn(`Alert triggered: ${rule.name}`, {
      alertId,
      ruleId: rule.id,
      severity: rule.severity,
      triggerDetails: alert.triggerDetails
    });
  }

  /**
   * Execute alert action
   */
  private executeAlertAction(action: AlertAction, alert: Alert): void {
    switch (action.type) {
      case 'log':
        const level = action.config.level || 'warn';
        const logMessage = `ALERT: ${alert.message}`;
        const logContext = {
          alertId: alert.id,
          severity: alert.severity,
          ruleName: alert.ruleName
        };
        
        switch (level) {
          case 'error':
            logger.error(logMessage, logContext);
            break;
          case 'warn':
            logger.warn(logMessage, logContext);
            break;
          case 'info':
            logger.info(logMessage, logContext);
            break;
          case 'debug':
            logger.debug(logMessage, logContext);
            break;
          default:
            logger.warn(logMessage, logContext);
        }
        break;
      
      case 'webhook':
        // Webhook implementation would go here
        logger.info(`Webhook alert action triggered`, { alertId: alert.id });
        break;
      
      default:
        logger.debug(`Unknown alert action: ${action.type}`, { alertId: alert.id });
    }
  }

  /**
   * Check for immediate alerts
   */
  private checkImmediateAlerts(error: ErrorDetails): void {
    // Critical errors trigger immediate alerts
    if (error.severity === ErrorSeverity.CRITICAL) {
      const alertId = `immediate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const alert: Alert = {
        id: alertId,
        ruleId: 'immediate_critical',
        ruleName: 'Immediate Critical Error',
        message: `Critical error detected: ${error.message}`,
        severity: ErrorSeverity.CRITICAL,
        timestamp: Date.now(),
        correlationId: error.correlationId,
        triggerDetails: { errorId: error.id }
      };

      this.alerts.set(alertId, alert);
      
      logger.error(`IMMEDIATE CRITICAL ALERT: ${error.message}`, {
        alertId,
        errorId: error.id,
        component: error.component,
        correlationId: error.correlationId
      });
    }
  }

  /**
   * Categorize error type from message
   */
  private categorizeError(message: string): ErrorType {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('auth') || lowerMessage.includes('credential')) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    if (lowerMessage.includes('ga4') || lowerMessage.includes('google analytics')) {
      return ErrorType.GA4_API_ERROR;
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return ErrorType.RATE_LIMIT_ERROR;
    }
    if (lowerMessage.includes('quota') || lowerMessage.includes('limit exceeded')) {
      return ErrorType.QUOTA_EXCEEDED_ERROR;
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (lowerMessage.includes('config') || lowerMessage.includes('environment')) {
      return ErrorType.CONFIGURATION_ERROR;
    }
    
    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(type: ErrorType, message: string): ErrorSeverity {
    switch (type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return ErrorSeverity.HIGH;
      case ErrorType.GA4_API_ERROR:
        return ErrorSeverity.MEDIUM;
      case ErrorType.CONFIGURATION_ERROR:
        return ErrorSeverity.HIGH;
      case ErrorType.RATE_LIMIT_ERROR:
      case ErrorType.QUOTA_EXCEEDED_ERROR:
        return ErrorSeverity.MEDIUM;
      case ErrorType.TIMEOUT_ERROR:
      case ErrorType.NETWORK_ERROR:
        return ErrorSeverity.LOW;
      case ErrorType.VALIDATION_ERROR:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine user impact
   */
  private determineUserImpact(type: ErrorType, severity: ErrorSeverity): UserImpact {
    if (severity === ErrorSeverity.CRITICAL) {
      return UserImpact.SERVICE_DOWN;
    }
    
    switch (type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return UserImpact.FEATURE_UNAVAILABLE;
      case ErrorType.GA4_API_ERROR:
        return UserImpact.FEATURE_UNAVAILABLE;
      case ErrorType.TIMEOUT_ERROR:
      case ErrorType.NETWORK_ERROR:
        return UserImpact.DEGRADED_PERFORMANCE;
      default:
        return UserImpact.NO_IMPACT;
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(message: string, type: ErrorType, component: string): string {
    const normalized = message.replace(/\d+/g, 'N').replace(/['"]/g, '').toLowerCase();
    return `${type}_${component}_${normalized}`.replace(/[^a-z0-9_]/g, '_').substr(0, 64);
  }

  /**
   * Group errors by field
   */
  private groupByField(errors: ErrorDetails[], field: keyof ErrorDetails): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const error of errors) {
      const value = String(error[field]);
      groups[value] = (groups[value] || 0) + 1;
    }
    
    return groups;
  }

  /**
   * Cleanup old errors and alerts
   */
  private cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    
    // Clean up old errors
    let removedErrors = 0;
    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoff) {
        this.errors.delete(id);
        removedErrors++;
      }
    }
    
    // Clean up old alerts
    let removedAlerts = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff) {
        this.alerts.delete(id);
        removedAlerts++;
      }
    }
    
    // Clean up error counts
    for (const component in this.errorCounts) {
      this.errorCounts[component] = this.errorCounts[component].filter(timestamp => timestamp >= cutoff);
    }
    
    if (removedErrors > 0 || removedAlerts > 0) {
      logger.debug(`Error tracking cleanup completed`, {
        removedErrors,
        removedAlerts,
        activeErrors: this.errors.size,
        activeAlerts: this.alerts.size
      });
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorDetails[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return false;
    
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    
    logger.info(`Alert resolved: ${alert.ruleName}`, {
      alertId,
      resolutionTime: alert.resolvedAt - alert.timestamp
    });
    
    return true;
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();