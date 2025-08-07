import {
  MCPAuthLoggingConfig,
  SecurityAuditLogEntry,
  MCPAuthCredentials,
  SecurityViolation
} from './authTypes';

/**
 * Enhanced Logging System for Phase 5
 * Comprehensive authentication and security logging with audit capabilities
 */
export class EnhancedAuthLogger {
  private config: MCPAuthLoggingConfig;
  private logBuffer: SecurityAuditLogEntry[] = [];
  private performanceMetrics: Map<string, number[]> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor(config: MCPAuthLoggingConfig) {
    this.config = config;
  }

  // ============================================================================
  // PHASE 5: ENHANCED LOGGING & AUDIT SYSTEM
  // ============================================================================

  /**
   * Log authentication events with comprehensive context
   */
  logAuthEvent(
    eventType: SecurityAuditLogEntry['eventType'],
    credentials: MCPAuthCredentials | null,
    context: {
      action: string;
      result: 'success' | 'failure' | 'warning';
      details?: Record<string, any>;
      clientInfo?: {
        userAgent?: string;
        ipAddress?: string;
        origin?: string;
      };
      securityContext?: {
        violations: SecurityViolation[];
        riskScore: number;
        mitigationActions: string[];
      };
      performanceMetrics?: {
        duration: number;
        operationType: string;
      };
    }
  ): void {
    if (!this.shouldLog('authentication')) {
      return;
    }

    const logEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType,
      userId: credentials?.userId,
      userEmail: this.redactSensitiveData(credentials?.userEmail),
      sessionId: this.generateSessionId(credentials),
      clientInfo: context.clientInfo || {},
      action: context.action,
      result: context.result,
      details: this.sanitizeLogDetails(context.details || {}),
      securityContext: context.securityContext
    };

    this.addToLogBuffer(logEntry);
    this.updatePerformanceMetrics(context.performanceMetrics);
    this.updateErrorCounts(context.result, context.action);
    this.outputLog(logEntry);
  }

  /**
   * Log security violations and threats
   */
  logSecurityViolation(
    violations: SecurityViolation[],
    credentials: MCPAuthCredentials | null,
    context?: {
      action?: string;
      mitigationActions?: string[];
      riskScore?: number;
    }
  ): void {
    if (!this.shouldLog('securityViolations')) {
      return;
    }

    const logEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'security_violation',
      userId: credentials?.userId,
      userEmail: this.redactSensitiveData(credentials?.userEmail),
      action: context?.action || 'security_check',
      result: 'warning',
      details: {
        violationCount: violations.length,
        violationTypes: violations.map(v => v.type),
        severityBreakdown: this.groupViolationsBySeverity(violations)
      },
      clientInfo: {},
      securityContext: {
        violations,
        riskScore: context?.riskScore || this.calculateRiskScore(violations),
        mitigationActions: context?.mitigationActions || []
      }
    };

    this.addToLogBuffer(logEntry);
    this.outputLog(logEntry);

    // Alert on critical violations
    if (violations.some(v => v.severity === 'critical')) {
      this.logCriticalSecurityAlert(violations, credentials);
    }
  }

  /**
   * Log performance metrics and monitoring data
   */
  logPerformanceMetric(
    operation: string,
    duration: number,
    credentials: MCPAuthCredentials | null,
    additionalMetrics?: Record<string, number>
  ): void {
    if (!this.shouldLog('performanceMetrics')) {
      return;
    }

    const metrics = {
      operation,
      duration,
      timestamp: Date.now(),
      userId: credentials?.userId,
      ...additionalMetrics
    };

    // Store for trend analysis
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    const operationMetrics = this.performanceMetrics.get(operation)!;
    operationMetrics.push(duration);

    // Keep only recent metrics (last 100 per operation)
    if (operationMetrics.length > 100) {
      operationMetrics.splice(0, operationMetrics.length - 100);
    }

    if (this.config.enablePerformanceLogging) {
      this.outputLog({
        timestamp: Date.now(),
        eventType: 'auth_success', // Performance is typically success event
        userId: credentials?.userId,
        action: `performance_${operation}`,
        result: 'success',
        details: metrics,
        clientInfo: {}
      });
    }

    // Alert on slow operations
    const slowThreshold = 5000; // 5 seconds
    if (duration > slowThreshold) {
      this.logSlowOperationAlert(operation, duration, credentials);
    }
  }

  /**
   * Log error events with stack traces and context
   */
  logError(
    error: Error | string,
    credentials: MCPAuthCredentials | null,
    context: {
      operation: string;
      stackTrace?: string;
      additionalContext?: Record<string, any>;
    }
  ): void {
    if (!this.shouldLog('errorTracking')) {
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : context.stackTrace;

    const logEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'auth_failure',
      userId: credentials?.userId,
      userEmail: this.redactSensitiveData(credentials?.userEmail),
      action: `error_${context.operation}`,
      result: 'failure',
      details: {
        errorMessage: this.sanitizeErrorMessage(errorMessage),
        stackTrace: this.sanitizeStackTrace(stackTrace),
        context: this.sanitizeLogDetails(context.additionalContext || {})
      },
      clientInfo: {}
    };

    this.addToLogBuffer(logEntry);
    this.updateErrorCounts('failure', context.operation);
    this.outputLog(logEntry);
  }

  /**
   * Log configuration changes
   */
  logConfigurationChange(
    configType: string,
    changes: Record<string, { from: any; to: any }>,
    credentials: MCPAuthCredentials | null
  ): void {
    if (!this.shouldLog('authentication')) {
      return;
    }

    const logEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'configuration_change',
      userId: credentials?.userId,
      userEmail: this.redactSensitiveData(credentials?.userEmail),
      action: `config_change_${configType}`,
      result: 'success',
      details: {
        configType,
        changes: this.sanitizeConfigChanges(changes)
      },
      clientInfo: {}
    };

    this.addToLogBuffer(logEntry);
    this.outputLog(logEntry);
  }

  /**
   * Generate comprehensive audit report
   */
  generateAuditReport(timeRange?: { start: number; end: number }): {
    summary: {
      totalEvents: number;
      eventTypeBreakdown: Record<string, number>;
      resultBreakdown: Record<string, number>;
      timeRange: { start: number; end: number };
    };
    securityMetrics: {
      violationCount: number;
      criticalViolations: number;
      averageRiskScore: number;
      topViolationTypes: Array<{ type: string; count: number }>;
    };
    performanceMetrics: {
      averageDurations: Record<string, number>;
      slowOperations: Array<{ operation: string; duration: number; timestamp: number }>;
      operationCounts: Record<string, number>;
    };
    errorMetrics: {
      totalErrors: number;
      errorsByType: Record<string, number>;
      errorTrends: Array<{ timestamp: number; count: number }>;
    };
    recommendations: string[];
  } {
    const filteredLogs = this.filterLogsByTimeRange(timeRange);
    
    return {
      summary: this.generateSummaryMetrics(filteredLogs, timeRange),
      securityMetrics: this.generateSecurityMetrics(filteredLogs),
      performanceMetrics: this.generatePerformanceMetrics(),
      errorMetrics: this.generateErrorMetrics(filteredLogs),
      recommendations: this.generateRecommendations(filteredLogs)
    };
  }

  /**
   * Check if specific log category should be logged
   */
  private shouldLog(category: keyof MCPAuthLoggingConfig['logCategories']): boolean {
    if (!this.config.enableAuthLogging && !this.config.enableAuditLogging) {
      return false;
    }

    return this.config.logCategories[category];
  }

  /**
   * Add log entry to buffer
   */
  private addToLogBuffer(entry: SecurityAuditLogEntry): void {
    this.logBuffer.push(entry);

    // Maintain buffer size
    const maxBufferSize = 1000;
    if (this.logBuffer.length > maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-maxBufferSize);
    }
  }

  /**
   * Output log entry based on configuration
   */
  private outputLog(entry: SecurityAuditLogEntry): void {
    const formattedLog = this.formatLogEntry(entry);

    switch (this.config.logDestination) {
      case 'console':
        console.log(formattedLog);
        break;
      case 'file':
        this.writeToLogFile(formattedLog);
        break;
      case 'external':
        this.sendToExternalService(formattedLog);
        break;
      case 'all':
        console.log(formattedLog);
        this.writeToLogFile(formattedLog);
        this.sendToExternalService(formattedLog);
        break;
    }
  }

  /**
   * Format log entry based on configuration
   */
  private formatLogEntry(entry: SecurityAuditLogEntry): string {
    const baseData = {
      timestamp: new Date(entry.timestamp).toISOString(),
      level: this.getLogLevel(entry),
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      result: entry.result,
      ...this.config.customLogFields
    };

    switch (this.config.logFormat) {
      case 'json':
        return JSON.stringify({ ...baseData, details: entry.details });
      
      case 'structured':
        return this.formatStructuredLog(baseData, entry);
      
      case 'text':
      default:
        return this.formatTextLog(baseData, entry);
    }
  }

  /**
   * Get log level for entry
   */
  private getLogLevel(entry: SecurityAuditLogEntry): string {
    if (entry.eventType === 'security_violation') {
      return entry.securityContext?.violations.some(v => v.severity === 'critical') ? 'critical' : 'warn';
    }
    if (entry.result === 'failure') {
      return 'error';
    }
    if (entry.result === 'warning') {
      return 'warn';
    }
    return 'info';
  }

  /**
   * Format structured log
   */
  private formatStructuredLog(baseData: any, entry: SecurityAuditLogEntry): string {
    const structured = {
      ...baseData,
      authentication: {
        userEmail: entry.userEmail,
        sessionId: entry.sessionId
      },
      client: entry.clientInfo,
      details: entry.details,
      security: entry.securityContext
    };

    return JSON.stringify(structured, null, 2);
  }

  /**
   * Format text log
   */
  private formatTextLog(baseData: any, entry: SecurityAuditLogEntry): string {
    const parts = [
      `[${baseData.timestamp}]`,
      `[${baseData.level.toUpperCase()}]`,
      `[${entry.eventType}]`,
      `User: ${entry.userId || 'anonymous'}`,
      `Action: ${entry.action}`,
      `Result: ${entry.result}`,
      entry.details ? `Details: ${JSON.stringify(entry.details)}` : ''
    ];

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Write to log file (placeholder - would implement actual file writing)
   */
  private writeToLogFile(logEntry: string): void {
    // In a real implementation, this would write to a file
    // For now, we'll just console.log with a file prefix
    if (this.config.enableLogRotation) {
      console.log(`[FILE] ${logEntry}`);
    }
  }

  /**
   * Send to external logging service (placeholder)
   */
  private sendToExternalService(logEntry: string): void {
    // In a real implementation, this would send to an external service
    // For now, we'll just console.log with an external prefix
    console.log(`[EXTERNAL] ${logEntry}`);
  }

  /**
   * Redact sensitive data from logs
   */
  private redactSensitiveData(data?: string): string | undefined {
    if (!this.config.sensitiveDataRedaction || !data) {
      return data;
    }

    // Redact email addresses partially
    if (data.includes('@')) {
      const [localPart, domain] = data.split('@');
      const redactedLocal = localPart.length > 2 
        ? localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
        : '***';
      return `${redactedLocal}@${domain}`;
    }

    return data;
  }

  /**
   * Sanitize log details to remove sensitive information
   */
  private sanitizeLogDetails(details: Record<string, any>): Record<string, any> {
    if (!this.config.sensitiveDataRedaction) {
      return details;
    }

    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize error messages
   */
  private sanitizeErrorMessage(message: string): string {
    if (!this.config.sensitiveDataRedaction) {
      return message;
    }

    // Remove potential tokens or keys from error messages
    return message.replace(/\b[A-Za-z0-9+/]{20,}\b/g, '[TOKEN_REDACTED]');
  }

  /**
   * Sanitize stack traces
   */
  private sanitizeStackTrace(stackTrace?: string): string | undefined {
    if (!stackTrace || !this.config.sensitiveDataRedaction) {
      return stackTrace;
    }

    // Remove file paths and line numbers for security
    return stackTrace.replace(/\/[^\s]+:\d+:\d+/g, '[PATH_REDACTED]');
  }

  /**
   * Sanitize configuration changes
   */
  private sanitizeConfigChanges(changes: Record<string, { from: any; to: any }>): Record<string, { from: any; to: any }> {
    const sanitized: Record<string, { from: any; to: any }> = {};

    for (const [key, value] of Object.entries(changes)) {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('key')) {
        sanitized[key] = { from: '[REDACTED]', to: '[REDACTED]' };
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Generate session ID for tracking
   */
  private generateSessionId(credentials: MCPAuthCredentials | null): string | undefined {
    if (!credentials) {
      return undefined;
    }

    // Generate a simple session ID based on user ID and timestamp
    const sessionData = `${credentials.userId}_${Date.now()}`;
    return btoa(sessionData).substring(0, 16);
  }

  /**
   * Group violations by severity
   */
  private groupViolationsBySeverity(violations: SecurityViolation[]): Record<string, number> {
    const breakdown: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const violation of violations) {
      breakdown[violation.severity]++;
    }

    return breakdown;
  }

  /**
   * Calculate risk score from violations
   */
  private calculateRiskScore(violations: SecurityViolation[]): number {
    let score = 0;
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical': score += 25; break;
        case 'high': score += 15; break;
        case 'medium': score += 8; break;
        case 'low': score += 3; break;
      }
    }
    return Math.min(100, score);
  }

  /**
   * Update performance metrics tracking
   */
  private updatePerformanceMetrics(metrics?: { duration: number; operationType: string }): void {
    if (!metrics) {
      return;
    }

    const { duration, operationType } = metrics;
    if (!this.performanceMetrics.has(operationType)) {
      this.performanceMetrics.set(operationType, []);
    }

    const operationMetrics = this.performanceMetrics.get(operationType)!;
    operationMetrics.push(duration);

    // Keep only recent metrics
    if (operationMetrics.length > 100) {
      operationMetrics.splice(0, operationMetrics.length - 100);
    }
  }

  /**
   * Update error counts tracking
   */
  private updateErrorCounts(result: string, operation: string): void {
    if (result === 'failure') {
      const key = `error_${operation}`;
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }
  }

  /**
   * Log critical security alert
   */
  private logCriticalSecurityAlert(violations: SecurityViolation[], credentials: MCPAuthCredentials | null): void {
    const alertEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'security_violation',
      userId: credentials?.userId,
      userEmail: this.redactSensitiveData(credentials?.userEmail),
      action: 'critical_security_alert',
      result: 'warning',
      details: {
        alertLevel: 'CRITICAL',
        criticalViolations: violations.filter(v => v.severity === 'critical').map(v => v.type),
        immediateAction: 'BLOCK_AND_INVESTIGATE'
      },
      clientInfo: {},
      securityContext: {
        violations,
        riskScore: 100,
        mitigationActions: ['Immediate account lockdown', 'Security team notification', 'Forensic investigation']
      }
    };

    this.addToLogBuffer(alertEntry);
    this.outputLog(alertEntry);
  }

  /**
   * Log slow operation alert
   */
  private logSlowOperationAlert(operation: string, duration: number, credentials: MCPAuthCredentials | null): void {
    const alertEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: 'auth_success',
      userId: credentials?.userId,
      action: 'slow_operation_alert',
      result: 'warning',
      details: {
        operation,
        duration,
        threshold: 5000,
        performanceImpact: 'HIGH'
      },
      clientInfo: {}
    };

    this.addToLogBuffer(alertEntry);
    this.outputLog(alertEntry);
  }

  /**
   * Filter logs by time range
   */
  private filterLogsByTimeRange(timeRange?: { start: number; end: number }): SecurityAuditLogEntry[] {
    if (!timeRange) {
      return this.logBuffer;
    }

    return this.logBuffer.filter(
      entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    );
  }

  /**
   * Generate summary metrics for audit report
   */
  private generateSummaryMetrics(
    logs: SecurityAuditLogEntry[], 
    timeRange?: { start: number; end: number }
  ): any {
    const eventTypeBreakdown: Record<string, number> = {};
    const resultBreakdown: Record<string, number> = {};

    for (const log of logs) {
      eventTypeBreakdown[log.eventType] = (eventTypeBreakdown[log.eventType] || 0) + 1;
      resultBreakdown[log.result] = (resultBreakdown[log.result] || 0) + 1;
    }

    return {
      totalEvents: logs.length,
      eventTypeBreakdown,
      resultBreakdown,
      timeRange: timeRange || {
        start: logs.length > 0 ? Math.min(...logs.map(l => l.timestamp)) : 0,
        end: logs.length > 0 ? Math.max(...logs.map(l => l.timestamp)) : 0
      }
    };
  }

  /**
   * Generate security metrics for audit report
   */
  private generateSecurityMetrics(logs: SecurityAuditLogEntry[]): any {
    const securityLogs = logs.filter(log => log.securityContext);
    const allViolations = securityLogs.flatMap(log => log.securityContext?.violations || []);
    
    const violationTypeCount: Record<string, number> = {};
    let totalRiskScore = 0;

    for (const log of securityLogs) {
      if (log.securityContext) {
        totalRiskScore += log.securityContext.riskScore;
        for (const violation of log.securityContext.violations) {
          violationTypeCount[violation.type] = (violationTypeCount[violation.type] || 0) + 1;
        }
      }
    }

    const topViolationTypes = Object.entries(violationTypeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      violationCount: allViolations.length,
      criticalViolations: allViolations.filter(v => v.severity === 'critical').length,
      averageRiskScore: securityLogs.length > 0 ? totalRiskScore / securityLogs.length : 0,
      topViolationTypes
    };
  }

  /**
   * Generate performance metrics for audit report
   */
  private generatePerformanceMetrics(): any {
    const averageDurations: Record<string, number> = {};
    const operationCounts: Record<string, number> = {};
    const slowOperations: Array<{ operation: string; duration: number; timestamp: number }> = [];

    for (const [operation, durations] of this.performanceMetrics.entries()) {
      if (durations.length > 0) {
        averageDurations[operation] = durations.reduce((a, b) => a + b, 0) / durations.length;
        operationCounts[operation] = durations.length;

        // Find slow operations (> 5 seconds)
        const slowDurations = durations.filter(d => d > 5000);
        for (const duration of slowDurations) {
          slowOperations.push({
            operation,
            duration,
            timestamp: Date.now() // Approximation
          });
        }
      }
    }

    return {
      averageDurations,
      slowOperations: slowOperations.slice(0, 10), // Top 10 slowest
      operationCounts
    };
  }

  /**
   * Generate error metrics for audit report
   */
  private generateErrorMetrics(logs: SecurityAuditLogEntry[]): any {
    const errorLogs = logs.filter(log => log.result === 'failure');
    const errorsByType: Record<string, number> = {};

    for (const log of errorLogs) {
      errorsByType[log.action] = (errorsByType[log.action] || 0) + 1;
    }

    // Simple error trend (hourly buckets)
    const errorTrends: Array<{ timestamp: number; count: number }> = [];
    const hourlyBuckets: Record<number, number> = {};

    for (const log of errorLogs) {
      const hour = Math.floor(log.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1;
    }

    for (const [timestamp, count] of Object.entries(hourlyBuckets)) {
      errorTrends.push({ timestamp: Number(timestamp), count });
    }

    return {
      totalErrors: errorLogs.length,
      errorsByType,
      errorTrends: errorTrends.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Generate recommendations based on audit data
   */
  private generateRecommendations(logs: SecurityAuditLogEntry[]): string[] {
    const recommendations: string[] = [];
    
    const securityLogs = logs.filter(log => log.securityContext);
    const errorLogs = logs.filter(log => log.result === 'failure');
    const errorRate = logs.length > 0 ? errorLogs.length / logs.length : 0;

    if (securityLogs.length > 0) {
      recommendations.push('Review security violations and implement additional safeguards');
    }

    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - investigate authentication issues');
    }

    const avgRiskScore = securityLogs.length > 0 
      ? securityLogs.reduce((sum, log) => sum + (log.securityContext?.riskScore || 0), 0) / securityLogs.length
      : 0;

    if (avgRiskScore > 50) {
      recommendations.push('Average risk score is high - strengthen security measures');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating normally - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Get current log buffer
   */
  getLogBuffer(): SecurityAuditLogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): Record<string, { average: number; count: number; recent: number[] }> {
    const summary: Record<string, { average: number; count: number; recent: number[] }> = {};

    for (const [operation, durations] of this.performanceMetrics.entries()) {
      const average = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      summary[operation] = {
        average,
        count: durations.length,
        recent: durations.slice(-10) // Last 10 measurements
      };
    }

    return summary;
  }

  /**
   * Get error counts summary
   */
  getErrorCounts(): Record<string, number> {
    return { ...Object.fromEntries(this.errorCounts) };
  }
}