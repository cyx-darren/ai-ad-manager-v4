/**
 * Security System Types
 * 
 * Type definitions for Phase 5 security validation and monitoring
 */

import { CredentialId } from '../credentials/types';

// ============================================================================
// SECURITY VALIDATION TYPES
// ============================================================================

/**
 * Security validation configuration
 */
export interface SecurityValidationConfig {
  enableIntegrityChecks: boolean;
  enableAccessLogging: boolean;
  enableTamperingDetection: boolean;
  enableThreatDetection: boolean;
  maxFailedAttempts: number;
  lockoutDuration: number;
  auditRetentionDays: number;
  compressionDetection: boolean;
  anomalyThreshold: number;
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: SecurityViolation[];
  recommendations: string[];
  riskScore: number;
  timestamp: string;
}

/**
 * Security violation details
 */
export interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  timestamp: string;
  remediation: string[];
}

/**
 * Types of security violations
 */
export type SecurityViolationType =
  | 'integrity_failure'
  | 'unauthorized_access'
  | 'tampering_detected'
  | 'suspicious_activity'
  | 'policy_violation'
  | 'anomalous_behavior'
  | 'credential_compromise'
  | 'encryption_weakness';

/**
 * Access attempt tracking
 */
export interface AccessAttempt {
  credentialId: CredentialId;
  operation: string;
  success: boolean;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  metadata: Record<string, any>;
}

/**
 * Security metrics
 */
export interface SecurityMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  violationsDetected: number;
  highRiskOperations: number;
  averageRiskScore: number;
  lastValidation: string;
}

// ============================================================================
// AUDIT SYSTEM TYPES
// ============================================================================

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  credentialId?: CredentialId;
  userId?: string;
  operation: string;
  outcome: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

/**
 * Types of audit events
 */
export type AuditEventType =
  | 'credential_access'
  | 'credential_modification'
  | 'security_violation'
  | 'authentication_event'
  | 'system_event'
  | 'policy_change'
  | 'backup_operation'
  | 'recovery_operation';

/**
 * Audit report configuration
 */
export interface AuditReportConfig {
  startDate: string;
  endDate: string;
  eventTypes: AuditEventType[];
  riskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  includeMetadata: boolean;
  maxEntries: number;
}

/**
 * Audit report
 */
export interface AuditReport {
  id: string;
  generatedAt: string;
  config: AuditReportConfig;
  totalEntries: number;
  entries: AuditLogEntry[];
  summary: AuditSummary;
  recommendations: string[];
}

/**
 * Audit summary statistics
 */
export interface AuditSummary {
  totalEvents: number;
  eventTypeBreakdown: Record<AuditEventType, number>;
  riskLevelBreakdown: Record<string, number>;
  successRate: number;
  topOperations: Array<{ operation: string; count: number }>;
  timeSpan: {
    start: string;
    end: string;
    durationHours: number;
  };
}

// ============================================================================
// MONITORING SYSTEM TYPES
// ============================================================================

/**
 * Security monitor configuration
 */
export interface SecurityMonitorConfig {
  enableRealTimeMonitoring: boolean;
  alertThresholds: AlertThresholds;
  monitoringInterval: number;
  retentionPeriod: number;
  enableNotifications: boolean;
  notificationChannels: string[];
}

/**
 * Alert thresholds
 */
export interface AlertThresholds {
  failureRate: number;
  riskScore: number;
  accessFrequency: number;
  violationCount: number;
  anomalyScore: number;
}

/**
 * Security alert
 */
export interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: SecurityAlertType;
  title: string;
  description: string;
  affectedCredentials: CredentialId[];
  evidence: Record<string, any>;
  recommendations: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/**
 * Types of security alerts
 */
export type SecurityAlertType =
  | 'high_risk_activity'
  | 'multiple_failures'
  | 'tampering_detected'
  | 'anomalous_behavior'
  | 'policy_violation'
  | 'system_compromise'
  | 'credential_breach'
  | 'unusual_access';

/**
 * Monitoring status
 */
export interface MonitoringStatus {
  isActive: boolean;
  lastCheck: string;
  checksPerformed: number;
  alertsGenerated: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: number;
  performance: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

// ============================================================================
// INTERFACE EXPORTS
// ============================================================================

/**
 * Security validator interface
 */
export interface ISecurityValidator {
  validateCredentialIntegrity(credential: any, expectedHash?: string): Promise<SecurityValidationResult>;
  validateAccess(credentialId: CredentialId, operation: string, context: Record<string, any>): Promise<SecurityValidationResult>;
  detectTampering(credentialId: CredentialId, currentData: any, previousHash?: string): Promise<SecurityValidationResult>;
  analyzeSecurityPatterns(accessHistory: AccessAttempt[]): Promise<SecurityValidationResult>;
  getSecurityMetrics(): Promise<SecurityMetrics>;
  configure(config: Partial<SecurityValidationConfig>): Promise<void>;
}

/**
 * Audit logger interface
 */
export interface IAuditLogger {
  logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
  getAuditLog(config: AuditReportConfig): Promise<AuditReport>;
  searchAuditLog(query: string, filters?: Record<string, any>): Promise<AuditLogEntry[]>;
  exportAuditLog(format: 'json' | 'csv', config: AuditReportConfig): Promise<string>;
  purgeOldEntries(olderThan: string): Promise<number>;
}

/**
 * Security monitor interface
 */
export interface ISecurityMonitor {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getStatus(): Promise<MonitoringStatus>;
  getAlerts(since?: string): Promise<SecurityAlert[]>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
  configure(config: Partial<SecurityMonitorConfig>): Promise<void>;
  generateReport(period: 'day' | 'week' | 'month'): Promise<Record<string, any>>;
}