/**
 * Audit Logger Implementation
 * 
 * Provides comprehensive audit logging and monitoring capabilities
 */

import {
  AuditLogEntry,
  AuditEventType,
  AuditReportConfig,
  AuditReport,
  AuditSummary,
  IAuditLogger
} from './types';

import { CredentialId } from '../credentials/types';

// ============================================================================
// AUDIT LOGGER IMPLEMENTATION
// ============================================================================

export class BrowserAuditLogger implements IAuditLogger {
  private logEntries: AuditLogEntry[] = [];
  private readonly storageKey = 'mcp_audit_log';
  private readonly maxEntries = 10000;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Log an audit event
   */
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.logEntries.push(auditEntry);

    // Maintain size limit
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries = this.logEntries.slice(-this.maxEntries);
    }

    await this.saveToStorage();
  }

  /**
   * Get audit log with filtering
   */
  async getAuditLog(config: AuditReportConfig): Promise<AuditReport> {
    const startTime = new Date(config.startDate).getTime();
    const endTime = new Date(config.endDate).getTime();

    // Filter entries
    let filteredEntries = this.logEntries.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      
      // Time range filter
      if (entryTime < startTime || entryTime > endTime) {
        return false;
      }

      // Event type filter
      if (config.eventTypes.length > 0 && !config.eventTypes.includes(entry.eventType)) {
        return false;
      }

      // Risk level filter
      if (config.riskLevels.length > 0 && !config.riskLevels.includes(entry.riskLevel)) {
        return false;
      }

      return true;
    });

    // Limit entries
    if (config.maxEntries > 0) {
      filteredEntries = filteredEntries.slice(-config.maxEntries);
    }

    // Generate summary
    const summary = this.generateSummary(filteredEntries, config);

    return {
      id: this.generateId(),
      generatedAt: new Date().toISOString(),
      config,
      totalEntries: filteredEntries.length,
      entries: config.includeMetadata ? filteredEntries : filteredEntries.map(this.stripMetadata),
      summary,
      recommendations: this.generateRecommendations(summary)
    };
  }

  /**
   * Search audit log
   */
  async searchAuditLog(query: string, filters?: Record<string, any>): Promise<AuditLogEntry[]> {
    const lowerQuery = query.toLowerCase();

    return this.logEntries.filter(entry => {
      // Text search
      const searchableText = [
        entry.operation,
        entry.details ? JSON.stringify(entry.details) : '',
        entry.credentialId || '',
        entry.userId || ''
      ].join(' ').toLowerCase();

      if (!searchableText.includes(lowerQuery)) {
        return false;
      }

      // Apply additional filters
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (entry[key as keyof AuditLogEntry] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Export audit log
   */
  async exportAuditLog(format: 'json' | 'csv', config: AuditReportConfig): Promise<string> {
    const report = await this.getAuditLog(config);

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // CSV format
    const headers = ['id', 'timestamp', 'eventType', 'operation', 'outcome', 'riskLevel', 'credentialId', 'userId'];
    const csvRows = [
      headers.join(','),
      ...report.entries.map(entry => 
        headers.map(header => {
          const value = entry[header as keyof AuditLogEntry] || '';
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  /**
   * Purge old entries
   */
  async purgeOldEntries(olderThan: string): Promise<number> {
    const cutoffTime = new Date(olderThan).getTime();
    const originalCount = this.logEntries.length;

    this.logEntries = this.logEntries.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= cutoffTime;
    });

    await this.saveToStorage();
    return originalCount - this.logEntries.length;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private stripMetadata(entry: AuditLogEntry): AuditLogEntry {
    const { metadata, ...strippedEntry } = entry;
    return strippedEntry as AuditLogEntry;
  }

  private generateSummary(entries: AuditLogEntry[], config: AuditReportConfig): AuditSummary {
    const eventTypeBreakdown: Record<AuditEventType, number> = {
      credential_access: 0,
      credential_modification: 0,
      security_violation: 0,
      authentication_event: 0,
      system_event: 0,
      policy_change: 0,
      backup_operation: 0,
      recovery_operation: 0
    };

    const riskLevelBreakdown: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    const operationCounts: Record<string, number> = {};
    let successCount = 0;

    entries.forEach(entry => {
      // Event type breakdown
      eventTypeBreakdown[entry.eventType]++;

      // Risk level breakdown
      riskLevelBreakdown[entry.riskLevel]++;

      // Operation counts
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;

      // Success rate
      if (entry.outcome === 'success') {
        successCount++;
      }
    });

    // Top operations
    const topOperations = Object.entries(operationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([operation, count]) => ({ operation, count }));

    // Time span
    const timestamps = entries.map(e => new Date(e.timestamp).getTime()).sort();
    const timeSpan = {
      start: config.startDate,
      end: config.endDate,
      durationHours: timestamps.length > 0 ? 
        (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60) : 0
    };

    return {
      totalEvents: entries.length,
      eventTypeBreakdown,
      riskLevelBreakdown,
      successRate: entries.length > 0 ? successCount / entries.length : 0,
      topOperations,
      timeSpan
    };
  }

  private generateRecommendations(summary: AuditSummary): string[] {
    const recommendations: string[] = [];

    // High failure rate
    if (summary.successRate < 0.8) {
      recommendations.push('Investigate high failure rate in operations');
    }

    // High risk events
    const highRiskCount = summary.riskLevelBreakdown.high + summary.riskLevelBreakdown.critical;
    if (highRiskCount > summary.totalEvents * 0.1) {
      recommendations.push('Review high-risk events and implement additional security measures');
    }

    // Security violations
    if (summary.eventTypeBreakdown.security_violation > 0) {
      recommendations.push('Address security violations and review security policies');
    }

    // High activity volume
    if (summary.totalEvents > 1000) {
      recommendations.push('Consider implementing automated monitoring for high-volume activity');
    }

    return recommendations;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.logEntries = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load audit log from storage:', error);
      this.logEntries = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logEntries));
    } catch (error) {
      console.warn('Failed to save audit log to storage:', error);
    }
  }
}

// ============================================================================
// AUDIT LOGGER FACTORY
// ============================================================================

export class AuditLoggerFactory {
  static createDefault(): IAuditLogger {
    return new BrowserAuditLogger();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createAuditLogger(): IAuditLogger {
  return AuditLoggerFactory.createDefault();
}

/**
 * Log credential access event
 */
export async function logCredentialAccess(
  logger: IAuditLogger,
  credentialId: CredentialId,
  operation: string,
  success: boolean,
  details?: Record<string, any>
): Promise<void> {
  await logger.logEvent({
    eventType: 'credential_access',
    credentialId,
    operation,
    outcome: success ? 'success' : 'failure',
    details: details || {},
    riskLevel: success ? 'low' : 'medium',
    metadata: {
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent || 'unknown'
    }
  });
}

/**
 * Log security violation
 */
export async function logSecurityViolation(
  logger: IAuditLogger,
  operation: string,
  violation: string,
  evidence: Record<string, any>,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
): Promise<void> {
  await logger.logEvent({
    eventType: 'security_violation',
    operation,
    outcome: 'failure',
    details: {
      violation,
      evidence
    },
    riskLevel,
    metadata: {
      timestamp: new Date().toISOString(),
      detectionSystem: 'credential_security_monitor'
    }
  });
}