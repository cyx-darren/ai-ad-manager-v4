/**
 * Credential Rotation & Management
 * 
 * This file implements automatic credential rotation handling,
 * rotation policies, and credential lifecycle management.
 */

import {
  GA4ServiceAccountCredential,
  CredentialId,
  CredentialAlias,
  CredentialOperationResult,
  CredentialError,
  CredentialLifecycleState,
  CredentialLifecycleEvent
} from './types';

import {
  ICredentialService,
  CredentialServiceFactory
} from './services';

import {
  ICredentialLifecycle,
  CredentialLifecycleFactory
} from './lifecycle';

// ============================================================================
// CREDENTIAL ROTATION TYPES
// ============================================================================

/**
 * Credential rotation strategy
 */
export type CredentialRotationStrategy = 
  | 'time-based'      // Rotate based on time intervals
  | 'usage-based'     // Rotate based on usage patterns
  | 'security-based'  // Rotate based on security events
  | 'manual'          // Manual rotation only
  | 'hybrid';         // Combination of strategies

/**
 * Credential rotation policy configuration
 */
export interface CredentialRotationPolicy {
  enabled: boolean;
  strategy: CredentialRotationStrategy;
  
  // Time-based rotation
  rotationInterval: number; // milliseconds
  maxCredentialAge: number; // milliseconds
  warningThreshold: number; // percentage of interval (0-1)
  
  // Usage-based rotation
  maxUsageCount?: number;
  usagePatternTriggers?: string[];
  
  // Security-based rotation
  securityEventTriggers?: string[];
  forceRotationOnBreach?: boolean;
  
  // Automation settings
  autoRotate: boolean;
  requireApproval: boolean;
  backupBeforeRotation: boolean;
  
  // Notification settings
  notifyOnRotation: boolean;
  notifyOnExpiry: boolean;
  notificationChannels: CredentialNotificationChannel[];
  
  // Validation settings
  validateNewCredentials: boolean;
  testCredentialsBeforeActivation: boolean;
  rollbackOnFailure: boolean;
}

/**
 * Notification channel configuration
 */
export interface CredentialNotificationChannel {
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'teams' | 'custom';
  endpoint: string;
  enabled: boolean;
  events: CredentialRotationEvent[];
  metadata?: Record<string, any>;
}

/**
 * Credential rotation event types
 */
export type CredentialRotationEvent = 
  | 'rotation_scheduled'
  | 'rotation_started'
  | 'rotation_completed'
  | 'rotation_failed'
  | 'rotation_cancelled'
  | 'expiry_warning'
  | 'expiry_imminent'
  | 'credential_expired'
  | 'validation_failed'
  | 'rollback_initiated'
  | 'rollback_completed';

/**
 * Credential rotation status
 */
export interface CredentialRotationStatus {
  credentialId: CredentialId;
  currentState: CredentialLifecycleState;
  rotationPolicy: CredentialRotationPolicy;
  lastRotation: string | null;
  nextRotation: string | null;
  rotationHistory: CredentialRotationRecord[];
  isRotationPending: boolean;
  warningIssued: boolean;
  rotationAttempts: number;
  lastError?: CredentialError;
}

/**
 * Credential rotation record
 */
export interface CredentialRotationRecord {
  rotationId: string;
  credentialId: CredentialId;
  startTime: string;
  endTime: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  strategy: CredentialRotationStrategy;
  trigger: 'scheduled' | 'manual' | 'security' | 'usage' | 'expiry';
  oldCredentialHash?: string;
  newCredentialHash?: string;
  error?: CredentialError;
  metadata?: Record<string, any>;
}

/**
 * Credential rotation operation result
 */
export interface CredentialRotationResult extends CredentialOperationResult<boolean> {
  rotationRecord?: CredentialRotationRecord;
  newCredentialId?: CredentialId;
  rollbackAvailable?: boolean;
}

// ============================================================================
// CREDENTIAL ROTATION SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential rotation operations
 */
export interface ICredentialRotationService {
  // Policy management
  setRotationPolicy(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>>;
  getRotationPolicy(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationPolicy>>;
  updateRotationPolicy(credentialId: CredentialId, updates: Partial<CredentialRotationPolicy>): Promise<CredentialOperationResult<boolean>>;
  removeRotationPolicy(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Rotation operations
  rotateCredential(credentialId: CredentialId, newCredential: GA4ServiceAccountCredential, trigger?: string): Promise<CredentialRotationResult>;
  scheduleRotation(credentialId: CredentialId, scheduledTime: string): Promise<CredentialOperationResult<string>>;
  cancelRotation(rotationId: string): Promise<CredentialOperationResult<boolean>>;
  rollbackRotation(rotationId: string): Promise<CredentialRotationResult>;
  
  // Monitoring and status
  getRotationStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationStatus>>;
  listPendingRotations(): Promise<CredentialOperationResult<CredentialRotationRecord[]>>;
  getRotationHistory(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationRecord[]>>;
  
  // Automated rotation
  startAutomaticRotation(): Promise<CredentialOperationResult<boolean>>;
  stopAutomaticRotation(): Promise<CredentialOperationResult<boolean>>;
  processScheduledRotations(): Promise<CredentialOperationResult<number>>;
  
  // Validation and testing
  validateCredentialForRotation(credential: GA4ServiceAccountCredential): Promise<CredentialOperationResult<boolean>>;
  testCredentialBeforeActivation(credential: GA4ServiceAccountCredential): Promise<CredentialOperationResult<boolean>>;
  
  // Event handling
  onRotationEvent(callback: (event: CredentialRotationEvent, data: any) => void): void;
  emitRotationEvent(event: CredentialRotationEvent, data: any): void;
}

// ============================================================================
// CREDENTIAL ROTATION SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Credential rotation service implementation
 */
export class CredentialRotationService implements ICredentialRotationService {
  private credentialService: ICredentialService;
  private lifecycle: ICredentialLifecycle;
  private rotationPolicies: Map<CredentialId, CredentialRotationPolicy> = new Map();
  private rotationTimers: Map<CredentialId, NodeJS.Timeout> = new Map();
  private rotationRecords: Map<string, CredentialRotationRecord> = new Map();
  private isAutomaticRotationEnabled: boolean = false;
  private automaticRotationTimer: NodeJS.Timeout | null = null;
  
  // Event handlers
  private rotationEventHandlers: Array<(event: CredentialRotationEvent, data: any) => void> = [];
  
  constructor(
    credentialService?: ICredentialService,
    lifecycle?: ICredentialLifecycle
  ) {
    this.credentialService = credentialService || CredentialServiceFactory.createSecure();
    this.lifecycle = lifecycle || CredentialLifecycleFactory.createDefault();
  }
  
  /**
   * Set rotation policy for a credential
   */
  async setRotationPolicy(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>> {
    try {
      // Validate policy
      this.validateRotationPolicy(policy);
      
      // Store policy
      this.rotationPolicies.set(credentialId, policy);
      
      // Schedule rotation if auto-rotation is enabled
      if (policy.enabled && policy.autoRotate) {
        await this.scheduleAutomaticRotation(credentialId, policy);
      }
      
      // Emit event
      this.emitRotationEvent('rotation_scheduled', {
        credentialId,
        policy,
        scheduledTime: this.calculateNextRotationTime(policy)
      });
      
      return {
        success: true,
        data: true,
        metadata: {
          policySet: new Date().toISOString(),
          nextRotation: this.calculateNextRotationTime(policy)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to set rotation policy', 'SET_POLICY_ERROR', credentialId, 'setRotationPolicy', error)
      };
    }
  }
  
  /**
   * Get rotation policy for a credential
   */
  async getRotationPolicy(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationPolicy>> {
    try {
      const policy = this.rotationPolicies.get(credentialId);
      if (!policy) {
        throw new CredentialError('Rotation policy not found', 'POLICY_NOT_FOUND', credentialId);
      }
      
      return {
        success: true,
        data: policy
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get rotation policy', 'GET_POLICY_ERROR', credentialId, 'getRotationPolicy', error)
      };
    }
  }
  
  /**
   * Update rotation policy for a credential
   */
  async updateRotationPolicy(credentialId: CredentialId, updates: Partial<CredentialRotationPolicy>): Promise<CredentialOperationResult<boolean>> {
    try {
      const existingPolicy = this.rotationPolicies.get(credentialId);
      if (!existingPolicy) {
        throw new CredentialError('Rotation policy not found', 'POLICY_NOT_FOUND', credentialId);
      }
      
      const updatedPolicy = { ...existingPolicy, ...updates };
      this.validateRotationPolicy(updatedPolicy);
      
      // Update policy
      this.rotationPolicies.set(credentialId, updatedPolicy);
      
      // Reschedule if necessary
      if (updatedPolicy.enabled && updatedPolicy.autoRotate) {
        await this.scheduleAutomaticRotation(credentialId, updatedPolicy);
      } else {
        this.cancelScheduledRotation(credentialId);
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update rotation policy', 'UPDATE_POLICY_ERROR', credentialId, 'updateRotationPolicy', error)
      };
    }
  }
  
  /**
   * Remove rotation policy for a credential
   */
  async removeRotationPolicy(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      // Cancel any scheduled rotation
      this.cancelScheduledRotation(credentialId);
      
      // Remove policy
      const removed = this.rotationPolicies.delete(credentialId);
      if (!removed) {
        throw new CredentialError('Rotation policy not found', 'POLICY_NOT_FOUND', credentialId);
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove rotation policy', 'REMOVE_POLICY_ERROR', credentialId, 'removeRotationPolicy', error)
      };
    }
  }
  
  /**
   * Rotate a credential
   */
  async rotateCredential(credentialId: CredentialId, newCredential: GA4ServiceAccountCredential, trigger?: string): Promise<CredentialRotationResult> {
    const rotationId = this.generateRotationId();
    const startTime = new Date().toISOString();
    
    // Create rotation record
    const rotationRecord: CredentialRotationRecord = {
      rotationId,
      credentialId,
      startTime,
      endTime: null,
      status: 'in-progress',
      strategy: this.getRotationStrategy(credentialId),
      trigger: (trigger as any) || 'manual'
    };
    
    this.rotationRecords.set(rotationId, rotationRecord);
    this.emitRotationEvent('rotation_started', { rotationId, credentialId });
    
    try {
      // Get rotation policy
      const policy = this.rotationPolicies.get(credentialId);
      
      // Validate new credential if required
      if (policy?.validateNewCredentials) {
        const validationResult = await this.validateCredentialForRotation(newCredential);
        if (!validationResult.success) {
          throw validationResult.error || new CredentialError('Credential validation failed', 'VALIDATION_FAILED', credentialId);
        }
      }
      
      // Test new credential if required
      if (policy?.testCredentialsBeforeActivation) {
        const testResult = await this.testCredentialBeforeActivation(newCredential);
        if (!testResult.success) {
          throw testResult.error || new CredentialError('Credential testing failed', 'TESTING_FAILED', credentialId);
        }
      }
      
      // Backup current credential if required
      if (policy?.backupBeforeRotation) {
        await this.backupCurrentCredential(credentialId);
      }
      
      // Get current credential hash for record
      const currentCredentialResult = await this.credentialService.getCredential(credentialId);
      if (currentCredentialResult.success && currentCredentialResult.data) {
        rotationRecord.oldCredentialHash = await this.createCredentialHash(currentCredentialResult.data);
      }
      
      // Update credential
      const updateResult = await this.credentialService.updateCredential(credentialId, newCredential);
      if (!updateResult.success) {
        throw updateResult.error || new CredentialError('Failed to update credential', 'UPDATE_FAILED', credentialId);
      }
      
      // Create new credential hash
      rotationRecord.newCredentialHash = await this.createCredentialHash(newCredential);
      
      // Update lifecycle state
      await this.lifecycle.logEvent(credentialId, {
        eventType: 'state_change',
        newState: 'active',
        description: 'Credential rotated successfully',
        timestamp: new Date().toISOString(),
        source: 'rotation_service'
      });
      
      // Complete rotation record
      rotationRecord.status = 'completed';
      rotationRecord.endTime = new Date().toISOString();
      this.rotationRecords.set(rotationId, rotationRecord);
      
      // Schedule next rotation if auto-rotation is enabled
      if (policy?.enabled && policy.autoRotate) {
        await this.scheduleAutomaticRotation(credentialId, policy);
      }
      
      // Emit completion event
      this.emitRotationEvent('rotation_completed', { rotationId, credentialId });
      
      return {
        success: true,
        data: true,
        rotationRecord,
        newCredentialId: credentialId,
        rollbackAvailable: policy?.backupBeforeRotation || false
      };
    } catch (error) {
      // Update rotation record with failure
      rotationRecord.status = 'failed';
      rotationRecord.endTime = new Date().toISOString();
      rotationRecord.error = error instanceof CredentialError ? error : new CredentialError('Rotation failed', 'ROTATION_FAILED', credentialId, 'rotateCredential', error);
      this.rotationRecords.set(rotationId, rotationRecord);
      
      // Emit failure event
      this.emitRotationEvent('rotation_failed', { rotationId, credentialId, error: rotationRecord.error });
      
      // Attempt rollback if enabled
      const policy = this.rotationPolicies.get(credentialId);
      if (policy?.rollbackOnFailure) {
        try {
          await this.rollbackRotation(rotationId);
        } catch (rollbackError) {
          // Log rollback failure but don't override original error
        }
      }
      
      return {
        success: false,
        error: rotationRecord.error,
        rotationRecord,
        rollbackAvailable: policy?.backupBeforeRotation || false
      };
    }
  }
  
  /**
   * Schedule rotation for a specific time
   */
  async scheduleRotation(credentialId: CredentialId, scheduledTime: string): Promise<CredentialOperationResult<string>> {
    try {
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new CredentialError('Scheduled time must be in the future', 'INVALID_SCHEDULE_TIME', credentialId);
      }
      
      const rotationId = this.generateRotationId();
      const delay = scheduledDate.getTime() - now.getTime();
      
      // Create timer
      const timer = setTimeout(async () => {
        // This would need to get the new credential from somewhere
        // For now, we'll emit an event that rotation is needed
        this.emitRotationEvent('rotation_scheduled', { credentialId, rotationId });
      }, delay);
      
      this.rotationTimers.set(credentialId, timer);
      
      return {
        success: true,
        data: rotationId,
        metadata: {
          scheduledTime,
          delay
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to schedule rotation', 'SCHEDULE_ERROR', credentialId, 'scheduleRotation', error)
      };
    }
  }
  
  /**
   * Cancel scheduled rotation
   */
  async cancelRotation(rotationId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const rotationRecord = this.rotationRecords.get(rotationId);
      if (!rotationRecord) {
        throw new CredentialError('Rotation record not found', 'ROTATION_NOT_FOUND');
      }
      
      if (rotationRecord.status !== 'pending') {
        throw new CredentialError('Cannot cancel rotation that is not pending', 'INVALID_ROTATION_STATE');
      }
      
      // Cancel timer
      this.cancelScheduledRotation(rotationRecord.credentialId);
      
      // Update record
      rotationRecord.status = 'cancelled';
      rotationRecord.endTime = new Date().toISOString();
      this.rotationRecords.set(rotationId, rotationRecord);
      
      // Emit event
      this.emitRotationEvent('rotation_cancelled', { rotationId, credentialId: rotationRecord.credentialId });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to cancel rotation', 'CANCEL_ERROR', undefined, 'cancelRotation', error)
      };
    }
  }
  
  /**
   * Rollback a rotation
   */
  async rollbackRotation(rotationId: string): Promise<CredentialRotationResult> {
    try {
      const rotationRecord = this.rotationRecords.get(rotationId);
      if (!rotationRecord) {
        throw new CredentialError('Rotation record not found', 'ROTATION_NOT_FOUND');
      }
      
      if (rotationRecord.status !== 'completed' && rotationRecord.status !== 'failed') {
        throw new CredentialError('Cannot rollback rotation that is not completed or failed', 'INVALID_ROLLBACK_STATE');
      }
      
      // Emit rollback initiated event
      this.emitRotationEvent('rollback_initiated', { rotationId, credentialId: rotationRecord.credentialId });
      
      // This would implement the actual rollback logic
      // For now, we'll just update the record
      rotationRecord.metadata = {
        ...rotationRecord.metadata,
        rollbackTime: new Date().toISOString()
      };
      
      // Emit rollback completed event
      this.emitRotationEvent('rollback_completed', { rotationId, credentialId: rotationRecord.credentialId });
      
      return {
        success: true,
        data: true,
        rotationRecord
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to rollback rotation', 'ROLLBACK_ERROR', undefined, 'rollbackRotation', error)
      };
    }
  }
  
  /**
   * Get rotation status for a credential
   */
  async getRotationStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationStatus>> {
    try {
      const policy = this.rotationPolicies.get(credentialId);
      const history = this.getCredentialRotationHistory(credentialId);
      const lastRotation = history.length > 0 ? history[0] : null;
      
      // Get current lifecycle state (simulated for now)
      const currentState: CredentialLifecycleState = 'active'; // This would be retrieved from lifecycle service
      
      const status: CredentialRotationStatus = {
        credentialId,
        currentState,
        rotationPolicy: policy || this.getDefaultRotationPolicy(),
        lastRotation: lastRotation?.endTime || null,
        nextRotation: policy ? this.calculateNextRotationTime(policy) : null,
        rotationHistory: history,
        isRotationPending: this.rotationTimers.has(credentialId),
        warningIssued: false, // This would be tracked separately
        rotationAttempts: history.filter(r => r.status === 'failed').length
      };
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get rotation status', 'GET_STATUS_ERROR', credentialId, 'getRotationStatus', error)
      };
    }
  }
  
  /**
   * List pending rotations
   */
  async listPendingRotations(): Promise<CredentialOperationResult<CredentialRotationRecord[]>> {
    try {
      const pendingRotations = Array.from(this.rotationRecords.values())
        .filter(record => record.status === 'pending' || record.status === 'in-progress');
      
      return {
        success: true,
        data: pendingRotations
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list pending rotations', 'LIST_PENDING_ERROR', undefined, 'listPendingRotations', error)
      };
    }
  }
  
  /**
   * Get rotation history for a credential
   */
  async getRotationHistory(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRotationRecord[]>> {
    try {
      const history = this.getCredentialRotationHistory(credentialId);
      
      return {
        success: true,
        data: history
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get rotation history', 'GET_HISTORY_ERROR', credentialId, 'getRotationHistory', error)
      };
    }
  }
  
  /**
   * Start automatic rotation
   */
  async startAutomaticRotation(): Promise<CredentialOperationResult<boolean>> {
    try {
      if (this.isAutomaticRotationEnabled) {
        return { success: true, data: true };
      }
      
      this.isAutomaticRotationEnabled = true;
      
      // Start rotation processor
      this.automaticRotationTimer = setInterval(async () => {
        await this.processScheduledRotations();
      }, 60000); // Check every minute
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to start automatic rotation', 'START_AUTO_ROTATION_ERROR', undefined, 'startAutomaticRotation', error)
      };
    }
  }
  
  /**
   * Stop automatic rotation
   */
  async stopAutomaticRotation(): Promise<CredentialOperationResult<boolean>> {
    try {
      this.isAutomaticRotationEnabled = false;
      
      if (this.automaticRotationTimer) {
        clearInterval(this.automaticRotationTimer);
        this.automaticRotationTimer = null;
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to stop automatic rotation', 'STOP_AUTO_ROTATION_ERROR', undefined, 'stopAutomaticRotation', error)
      };
    }
  }
  
  /**
   * Process scheduled rotations
   */
  async processScheduledRotations(): Promise<CredentialOperationResult<number>> {
    try {
      let processedCount = 0;
      
      // This would check all credentials with rotation policies
      // and process those that need rotation
      for (const [credentialId, policy] of Array.from(this.rotationPolicies.entries())) {
        if (this.shouldRotateCredential(credentialId, policy)) {
          // Emit rotation needed event
          this.emitRotationEvent('expiry_warning', { credentialId });
          processedCount++;
        }
      }
      
      return {
        success: true,
        data: processedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to process scheduled rotations', 'PROCESS_ROTATIONS_ERROR', undefined, 'processScheduledRotations', error)
      };
    }
  }
  
  /**
   * Validate credential for rotation
   */
  async validateCredentialForRotation(credential: GA4ServiceAccountCredential): Promise<CredentialOperationResult<boolean>> {
    try {
      // Basic validation
      if (!credential.type || credential.type !== 'service_account') {
        throw new CredentialError('Invalid credential type', 'INVALID_TYPE');
      }
      
      if (!credential.project_id || !credential.client_email || !credential.private_key) {
        throw new CredentialError('Missing required credential fields', 'MISSING_FIELDS');
      }
      
      // Additional validation would go here
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Credential validation failed', 'VALIDATION_ERROR', undefined, 'validateCredentialForRotation', error)
      };
    }
  }
  
  /**
   * Test credential before activation
   */
  async testCredentialBeforeActivation(credential: GA4ServiceAccountCredential): Promise<CredentialOperationResult<boolean>> {
    try {
      // This would perform actual GA4 API tests
      // For now, just validate the structure
      const validationResult = await this.validateCredentialForRotation(credential);
      
      return validationResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Credential testing failed', 'TESTING_ERROR', undefined, 'testCredentialBeforeActivation', error)
      };
    }
  }
  
  /**
   * Register rotation event handler
   */
  onRotationEvent(callback: (event: CredentialRotationEvent, data: any) => void): void {
    this.rotationEventHandlers.push(callback);
  }
  
  /**
   * Emit rotation event
   */
  emitRotationEvent(event: CredentialRotationEvent, data: any): void {
    this.rotationEventHandlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        // Ignore handler errors
      }
    });
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private validateRotationPolicy(policy: CredentialRotationPolicy): void {
    if (policy.rotationInterval <= 0) {
      throw new CredentialError('Rotation interval must be positive', 'INVALID_INTERVAL');
    }
    
    if (policy.warningThreshold < 0 || policy.warningThreshold > 1) {
      throw new CredentialError('Warning threshold must be between 0 and 1', 'INVALID_THRESHOLD');
    }
  }
  
  private async scheduleAutomaticRotation(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<void> {
    // Cancel existing timer
    this.cancelScheduledRotation(credentialId);
    
    // Calculate next rotation time
    const nextRotation = this.calculateNextRotationTime(policy);
    const delay = new Date(nextRotation).getTime() - Date.now();
    
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.emitRotationEvent('rotation_scheduled', { credentialId });
      }, delay);
      
      this.rotationTimers.set(credentialId, timer);
    }
  }
  
  private cancelScheduledRotation(credentialId: CredentialId): void {
    const timer = this.rotationTimers.get(credentialId);
    if (timer) {
      clearTimeout(timer);
      this.rotationTimers.delete(credentialId);
    }
  }
  
  private calculateNextRotationTime(policy: CredentialRotationPolicy): string {
    const now = new Date();
    const nextRotation = new Date(now.getTime() + policy.rotationInterval);
    return nextRotation.toISOString();
  }
  
  private getRotationStrategy(credentialId: CredentialId): CredentialRotationStrategy {
    const policy = this.rotationPolicies.get(credentialId);
    return policy?.strategy || 'manual';
  }
  
  private shouldRotateCredential(credentialId: CredentialId, policy: CredentialRotationPolicy): boolean {
    // This would implement the logic to check if a credential should be rotated
    // based on the policy and current state
    return false; // Placeholder
  }
  
  private getCredentialRotationHistory(credentialId: CredentialId): CredentialRotationRecord[] {
    return Array.from(this.rotationRecords.values())
      .filter(record => record.credentialId === credentialId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }
  
  private async backupCurrentCredential(credentialId: CredentialId): Promise<void> {
    // This would implement credential backup logic
    // For now, just log the action
    console.log(`Backing up credential ${credentialId}`);
  }
  
  private async createCredentialHash(credential: GA4ServiceAccountCredential): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({
        project_id: credential.project_id,
        client_email: credential.client_email,
        client_id: credential.client_id
      }));
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new CredentialError('Failed to create credential hash', 'HASH_ERROR', undefined, 'createCredentialHash', error);
    }
  }
  
  private generateRotationId(): string {
    return `rotation_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private getDefaultRotationPolicy(): CredentialRotationPolicy {
    return {
      enabled: false,
      strategy: 'time-based',
      rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxCredentialAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      warningThreshold: 0.8,
      autoRotate: false,
      requireApproval: true,
      backupBeforeRotation: true,
      notifyOnRotation: true,
      notifyOnExpiry: true,
      notificationChannels: [],
      validateNewCredentials: true,
      testCredentialsBeforeActivation: true,
      rollbackOnFailure: true
    };
  }
}

// ============================================================================
// CREDENTIAL ROTATION FACTORY
// ============================================================================

/**
 * Factory for creating credential rotation service instances
 */
export class CredentialRotationServiceFactory {
  /**
   * Create default credential rotation service
   */
  static createDefault(): CredentialRotationService {
    return new CredentialRotationService();
  }
  
  /**
   * Create secure credential rotation service
   */
  static createSecure(): CredentialRotationService {
    const credentialService = CredentialServiceFactory.createSecure();
    const lifecycle = CredentialLifecycleFactory.createDefault();
    
    return new CredentialRotationService(credentialService, lifecycle);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default rotation policy
 */
export function createDefaultRotationPolicy(): CredentialRotationPolicy {
  return new CredentialRotationService().getDefaultRotationPolicy();
}

/**
 * Quick rotation setup function
 */
export async function setupCredentialRotation(
  credentialId: CredentialId,
  policy: Partial<CredentialRotationPolicy>
): Promise<CredentialRotationService> {
  const rotationService = CredentialRotationServiceFactory.createSecure();
  
  const fullPolicy = {
    ...createDefaultRotationPolicy(),
    ...policy
  };
  
  await rotationService.setRotationPolicy(credentialId, fullPolicy);
  return rotationService;
}