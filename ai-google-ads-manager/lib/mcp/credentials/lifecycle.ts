/**
 * MCP Credential Lifecycle Management
 * 
 * This file implements credential lifecycle management including
 * expiry tracking, rotation policies, audit logging, and state management.
 */

import {
  EncryptedCredential,
  CredentialLifecycleState,
  CredentialLifecycleEvent,
  CredentialRotationPolicy,
  CredentialAuditEntry,
  CredentialError,
  CredentialOperationResult,
  CredentialId
} from './types';

// ============================================================================
// LIFECYCLE MANAGEMENT INTERFACE
// ============================================================================

/**
 * Interface for credential lifecycle management
 */
export interface ICredentialLifecycle {
  // State management
  getState(credentialId: CredentialId): Promise<CredentialLifecycleState>;
  setState(credentialId: CredentialId, state: CredentialLifecycleState, reason?: string): Promise<CredentialOperationResult<boolean>>;
  
  // Lifecycle events
  logEvent(event: CredentialLifecycleEvent): Promise<void>;
  getEvents(credentialId: CredentialId): Promise<CredentialLifecycleEvent[]>;
  
  // Expiry management
  checkExpiry(credentialId: CredentialId): Promise<{ isExpired: boolean; expiresAt?: string; timeRemaining?: number }>;
  setExpiry(credentialId: CredentialId, expiresAt: string): Promise<CredentialOperationResult<boolean>>;
  getExpiringCredentials(withinHours: number): Promise<CredentialId[]>;
  
  // Rotation management
  scheduleRotation(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>>;
  checkRotationDue(credentialId: CredentialId): Promise<{ isDue: boolean; reason?: string; dueAt?: string }>;
  performRotation(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialId>>;
  
  // Audit and monitoring
  getAuditLog(credentialId: CredentialId): Promise<CredentialAuditEntry[]>;
  generateReport(credentialId: CredentialId): Promise<CredentialLifecycleReport>;
  
  // Cleanup and maintenance
  cleanupExpired(): Promise<CredentialOperationResult<number>>;
  archiveCredential(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>>;
}

// ============================================================================
// LIFECYCLE REPORT INTERFACE
// ============================================================================

export interface CredentialLifecycleReport {
  credentialId: CredentialId;
  currentState: CredentialLifecycleState;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  rotationStatus: {
    isScheduled: boolean;
    nextRotation?: string;
    rotationCount: number;
    lastRotation?: string;
  };
  usage: {
    accessCount: number;
    lastAccess?: string;
    averageUsagePerDay: number;
  };
  security: {
    integrityCheck: 'pass' | 'fail' | 'warning';
    lastSecurityReview?: string;
    vulnerabilities: string[];
    recommendations: string[];
  };
  lifecycle: {
    totalEvents: number;
    stateChanges: number;
    lastStateChange?: string;
  };
  health: 'healthy' | 'warning' | 'critical';
}

// ============================================================================
// BROWSER LIFECYCLE MANAGEMENT IMPLEMENTATION
// ============================================================================

/**
 * Browser-based credential lifecycle management
 */
export class BrowserCredentialLifecycle implements ICredentialLifecycle {
  private readonly LIFECYCLE_STATE_KEY = 'mcp_credential_states';
  private readonly LIFECYCLE_EVENTS_KEY = 'mcp_credential_events';
  private readonly ROTATION_POLICIES_KEY = 'mcp_rotation_policies';
  private readonly AUDIT_LOG_KEY = 'mcp_audit_log';
  
  async getState(credentialId: CredentialId): Promise<CredentialLifecycleState> {
    try {
      const states = await this.getStorageItem<Record<CredentialId, CredentialLifecycleState>>(this.LIFECYCLE_STATE_KEY) || {};
      return states[credentialId] || 'pending';
    } catch (error) {
      throw new CredentialError(
        'Failed to get credential state',
        'STATE_RETRIEVAL_ERROR',
        credentialId,
        'getState',
        error
      );
    }
  }
  
  async setState(credentialId: CredentialId, state: CredentialLifecycleState, reason?: string): Promise<CredentialOperationResult<boolean>> {
    try {
      // Get current states
      const states = await this.getStorageItem<Record<CredentialId, CredentialLifecycleState>>(this.LIFECYCLE_STATE_KEY) || {};
      const previousState = states[credentialId];
      
      // Update state
      states[credentialId] = state;
      await this.setStorageItem(this.LIFECYCLE_STATE_KEY, states);
      
      // Log state change event
      await this.logEvent({
        id: this.generateId(),
        credentialId,
        event: this.getStateChangeEvent(state),
        timestamp: new Date().toISOString(),
        source: 'lifecycle_manager',
        metadata: {
          previousState,
          newState: state,
          reason
        }
      });
      
      return {
        success: true,
        data: true,
        metadata: {
          previousState,
          newState: state
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to set credential state',
          'STATE_UPDATE_ERROR',
          credentialId,
          'setState',
          error
        )
      };
    }
  }
  
  async logEvent(event: CredentialLifecycleEvent): Promise<void> {
    try {
      const events = await this.getStorageItem<CredentialLifecycleEvent[]>(this.LIFECYCLE_EVENTS_KEY) || [];
      events.push(event);
      
      // Keep only last 10000 events to prevent storage bloat
      if (events.length > 10000) {
        events.splice(0, events.length - 10000);
      }
      
      await this.setStorageItem(this.LIFECYCLE_EVENTS_KEY, events);
    } catch (error) {
      // Event logging is non-critical, so we don't throw errors
      console.warn('Failed to log credential lifecycle event:', error);
    }
  }
  
  async getEvents(credentialId: CredentialId): Promise<CredentialLifecycleEvent[]> {
    try {
      const allEvents = await this.getStorageItem<CredentialLifecycleEvent[]>(this.LIFECYCLE_EVENTS_KEY) || [];
      return allEvents.filter(event => event.credentialId === credentialId);
    } catch (error) {
      throw new CredentialError(
        'Failed to get credential events',
        'EVENTS_RETRIEVAL_ERROR',
        credentialId,
        'getEvents',
        error
      );
    }
  }
  
  async checkExpiry(credentialId: CredentialId): Promise<{ isExpired: boolean; expiresAt?: string; timeRemaining?: number }> {
    try {
      // This would typically check the credential's expiration date
      // For GA4 service account credentials, we need to check token expiry
      
      const expiryData = await this.getStorageItem<Record<CredentialId, string>>('mcp_credential_expiry') || {};
      const expiresAt = expiryData[credentialId];
      
      if (!expiresAt) {
        return { isExpired: false };
      }
      
      const expiryTime = new Date(expiresAt).getTime();
      const currentTime = Date.now();
      const timeRemaining = expiryTime - currentTime;
      
      return {
        isExpired: timeRemaining <= 0,
        expiresAt,
        timeRemaining: Math.max(0, timeRemaining)
      };
    } catch (error) {
      throw new CredentialError(
        'Failed to check credential expiry',
        'EXPIRY_CHECK_ERROR',
        credentialId,
        'checkExpiry',
        error
      );
    }
  }
  
  async setExpiry(credentialId: CredentialId, expiresAt: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const expiryData = await this.getStorageItem<Record<CredentialId, string>>('mcp_credential_expiry') || {};
      expiryData[credentialId] = expiresAt;
      await this.setStorageItem('mcp_credential_expiry', expiryData);
      
      await this.logEvent({
        id: this.generateId(),
        credentialId,
        event: 'created', // Or updated if this is an expiry update
        timestamp: new Date().toISOString(),
        source: 'lifecycle_manager',
        metadata: {
          action: 'set_expiry',
          expiresAt
        }
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to set credential expiry',
          'EXPIRY_SET_ERROR',
          credentialId,
          'setExpiry',
          error
        )
      };
    }
  }
  
  async getExpiringCredentials(withinHours: number): Promise<CredentialId[]> {
    try {
      const expiryData = await this.getStorageItem<Record<CredentialId, string>>('mcp_credential_expiry') || {};
      const thresholdTime = Date.now() + (withinHours * 60 * 60 * 1000);
      
      const expiringCredentials: CredentialId[] = [];
      
      for (const [credentialId, expiresAt] of Object.entries(expiryData)) {
        const expiryTime = new Date(expiresAt).getTime();
        if (expiryTime <= thresholdTime) {
          expiringCredentials.push(credentialId);
        }
      }
      
      return expiringCredentials;
    } catch (error) {
      throw new CredentialError(
        'Failed to get expiring credentials',
        'EXPIRING_CREDENTIALS_ERROR',
        undefined,
        'getExpiringCredentials',
        error
      );
    }
  }
  
  async scheduleRotation(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>> {
    try {
      const policies = await this.getStorageItem<Record<CredentialId, CredentialRotationPolicy>>(this.ROTATION_POLICIES_KEY) || {};
      policies[credentialId] = policy;
      await this.setStorageItem(this.ROTATION_POLICIES_KEY, policies);
      
      await this.logEvent({
        id: this.generateId(),
        credentialId,
        event: 'created',
        timestamp: new Date().toISOString(),
        source: 'lifecycle_manager',
        metadata: {
          action: 'schedule_rotation',
          policy: {
            enabled: policy.enabled,
            rotationInterval: policy.rotationInterval,
            autoRotate: policy.autoRotate
          }
        }
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to schedule rotation',
          'ROTATION_SCHEDULE_ERROR',
          credentialId,
          'scheduleRotation',
          error
        )
      };
    }
  }
  
  async checkRotationDue(credentialId: CredentialId): Promise<{ isDue: boolean; reason?: string; dueAt?: string }> {
    try {
      const policies = await this.getStorageItem<Record<CredentialId, CredentialRotationPolicy>>(this.ROTATION_POLICIES_KEY) || {};
      const policy = policies[credentialId];
      
      if (!policy || !policy.enabled) {
        return { isDue: false, reason: 'No rotation policy or disabled' };
      }
      
      // Get last rotation timestamp
      const events = await this.getEvents(credentialId);
      const lastRotation = events
        .filter(e => e.event === 'rotated')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      const lastRotationTime = lastRotation ? new Date(lastRotation.timestamp).getTime() : 0;
      const nextRotationTime = lastRotationTime + policy.rotationInterval;
      const currentTime = Date.now();
      
      if (currentTime >= nextRotationTime) {
        return {
          isDue: true,
          reason: 'Rotation interval exceeded',
          dueAt: new Date(nextRotationTime).toISOString()
        };
      }
      
      // Check maximum age
      const credentialAge = currentTime - lastRotationTime;
      if (policy.maxAge && credentialAge >= policy.maxAge) {
        return {
          isDue: true,
          reason: 'Maximum credential age exceeded',
          dueAt: new Date(lastRotationTime + policy.maxAge).toISOString()
        };
      }
      
      return {
        isDue: false,
        reason: 'Within rotation schedule',
        dueAt: new Date(nextRotationTime).toISOString()
      };
    } catch (error) {
      throw new CredentialError(
        'Failed to check rotation due',
        'ROTATION_CHECK_ERROR',
        credentialId,
        'checkRotationDue',
        error
      );
    }
  }
  
  async performRotation(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialId>> {
    try {
      // This is a placeholder for actual rotation logic
      // In a real implementation, this would:
      // 1. Generate new credential
      // 2. Update Google Cloud configuration
      // 3. Test new credential
      // 4. Archive old credential
      // 5. Update stored credential
      
      const newCredentialId = `${credentialId}_rotated_${Date.now()}`;
      
      await this.logEvent({
        id: this.generateId(),
        credentialId,
        event: 'rotated',
        timestamp: new Date().toISOString(),
        source: 'lifecycle_manager',
        metadata: {
          newCredentialId,
          reason: 'Scheduled rotation'
        }
      });
      
      return {
        success: true,
        data: newCredentialId,
        metadata: {
          originalId: credentialId,
          rotationTimestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to perform rotation',
          'ROTATION_PERFORM_ERROR',
          credentialId,
          'performRotation',
          error
        )
      };
    }
  }
  
  async getAuditLog(credentialId: CredentialId): Promise<CredentialAuditEntry[]> {
    try {
      const allAuditEntries = await this.getStorageItem<CredentialAuditEntry[]>(this.AUDIT_LOG_KEY) || [];
      return allAuditEntries.filter(entry => entry.credentialId === credentialId);
    } catch (error) {
      throw new CredentialError(
        'Failed to get audit log',
        'AUDIT_LOG_ERROR',
        credentialId,
        'getAuditLog',
        error
      );
    }
  }
  
  async generateReport(credentialId: CredentialId): Promise<CredentialLifecycleReport> {
    try {
      const [state, events, auditLog, expiryCheck] = await Promise.all([
        this.getState(credentialId),
        this.getEvents(credentialId),
        this.getAuditLog(credentialId),
        this.checkExpiry(credentialId)
      ]);
      
      const createdEvent = events.find(e => e.event === 'created');
      const rotationEvents = events.filter(e => e.event === 'rotated');
      const stateChangeEvents = events.filter(e => ['activated', 'expired', 'revoked', 'deleted'].includes(e.event));
      
      const accessEvents = auditLog.filter(entry => entry.action === 'read');
      const lastAccess = accessEvents.length > 0 ? accessEvents[accessEvents.length - 1].timestamp : undefined;
      
      // Calculate usage statistics
      const daysSinceCreation = createdEvent ? 
        (Date.now() - new Date(createdEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24) : 0;
      const averageUsagePerDay = daysSinceCreation > 0 ? accessEvents.length / daysSinceCreation : 0;
      
      // Determine health status
      let health: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (expiryCheck.isExpired) {
        health = 'critical';
      } else if (expiryCheck.timeRemaining && expiryCheck.timeRemaining < 7 * 24 * 60 * 60 * 1000) { // 7 days
        health = 'warning';
      }
      
      return {
        credentialId,
        currentState: state,
        createdAt: createdEvent?.timestamp || new Date().toISOString(),
        lastUsed: lastAccess,
        expiresAt: expiryCheck.expiresAt,
        rotationStatus: {
          isScheduled: rotationEvents.length > 0,
          nextRotation: undefined, // Would be calculated from rotation policy
          rotationCount: rotationEvents.length,
          lastRotation: rotationEvents.length > 0 ? rotationEvents[rotationEvents.length - 1].timestamp : undefined
        },
        usage: {
          accessCount: accessEvents.length,
          lastAccess,
          averageUsagePerDay
        },
        security: {
          integrityCheck: 'pass', // Would be implemented based on actual security checks
          vulnerabilities: [],
          recommendations: []
        },
        lifecycle: {
          totalEvents: events.length,
          stateChanges: stateChangeEvents.length,
          lastStateChange: stateChangeEvents.length > 0 ? stateChangeEvents[stateChangeEvents.length - 1].timestamp : undefined
        },
        health
      };
    } catch (error) {
      throw new CredentialError(
        'Failed to generate lifecycle report',
        'REPORT_GENERATION_ERROR',
        credentialId,
        'generateReport',
        error
      );
    }
  }
  
  async cleanupExpired(): Promise<CredentialOperationResult<number>> {
    try {
      const expiryData = await this.getStorageItem<Record<CredentialId, string>>('mcp_credential_expiry') || {};
      const currentTime = Date.now();
      let cleanedCount = 0;
      
      for (const [credentialId, expiresAt] of Object.entries(expiryData)) {
        const expiryTime = new Date(expiresAt).getTime();
        if (expiryTime <= currentTime) {
          // Archive expired credential
          await this.archiveCredential(credentialId);
          cleanedCount++;
        }
      }
      
      return {
        success: true,
        data: cleanedCount,
        metadata: {
          cleanupTimestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to cleanup expired credentials',
          'CLEANUP_ERROR',
          undefined,
          'cleanupExpired',
          error
        )
      };
    }
  }
  
  async archiveCredential(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      await this.setState(credentialId, 'archived', 'Automatic archival');
      
      await this.logEvent({
        id: this.generateId(),
        credentialId,
        event: 'deleted', // Using 'deleted' event type for archival
        timestamp: new Date().toISOString(),
        source: 'lifecycle_manager',
        metadata: {
          action: 'archive',
          reason: 'Expired or scheduled for archival'
        }
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError(
          'Failed to archive credential',
          'ARCHIVE_ERROR',
          credentialId,
          'archiveCredential',
          error
        )
      };
    }
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private getStateChangeEvent(state: CredentialLifecycleState): CredentialLifecycleEvent['event'] {
    switch (state) {
      case 'active': return 'activated';
      case 'expired': return 'expired';
      case 'revoked': return 'revoked';
      case 'archived': return 'deleted';
      default: return 'created';
    }
  }
  
  private async getStorageItem<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }
  
  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

// ============================================================================
// LIFECYCLE FACTORY
// ============================================================================

/**
 * Factory for creating lifecycle management instances
 */
export class CredentialLifecycleFactory {
  /**
   * Create browser-based lifecycle manager
   */
  static createBrowserLifecycle(): ICredentialLifecycle {
    return new BrowserCredentialLifecycle();
  }
  
  /**
   * Create lifecycle manager with default configuration
   */
  static createDefault(): ICredentialLifecycle {
    return new BrowserCredentialLifecycle();
  }
}