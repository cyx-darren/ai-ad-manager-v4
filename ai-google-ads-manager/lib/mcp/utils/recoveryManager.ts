/**
 * Recovery Manager (Phase 5)
 * 
 * This file provides automatic reconnection mechanisms and recovery state management:
 * - Automatic reconnection mechanisms
 * - Data synchronization on reconnect
 * - Conflict resolution for offline changes
 * - Recovery state management
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Recovery status types
 */
export type RecoveryStatus = 
  | 'idle'           // No recovery in progress
  | 'detecting'      // Detecting connection issues
  | 'reconnecting'   // Attempting to reconnect
  | 'synchronizing'  // Syncing data after reconnection
  | 'resolving'      // Resolving conflicts
  | 'recovered'      // Successfully recovered
  | 'failed'         // Recovery failed
  | 'abandoned';     // Recovery abandoned after max attempts

/**
 * Recovery strategy types
 */
export type RecoveryStrategy = 
  | 'immediate'      // Attempt recovery immediately
  | 'exponential'    // Exponential backoff
  | 'linear'         // Linear backoff
  | 'custom'         // Custom strategy
  | 'manual';        // Manual recovery only

/**
 * Connection failure reason
 */
export type FailureReason = 
  | 'network_timeout'     // Network request timeout
  | 'server_error'        // Server returned error
  | 'authentication'      // Authentication failure
  | 'rate_limit'          // Rate limiting
  | 'service_unavailable' // Service temporarily unavailable
  | 'unknown';            // Unknown error

/**
 * Recovery attempt information
 */
export interface RecoveryAttempt {
  id: string;
  timestamp: number;
  strategy: RecoveryStrategy;
  reason: FailureReason;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  enabled: boolean;
  strategy: RecoveryStrategy;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  timeoutMs: number;
  healthCheckInterval: number;
  syncOnReconnect: boolean;
  autoResolveConflicts: boolean;
  persistRecoveryState: boolean;
  notifyOnRecovery: boolean;
  enableLogging: boolean;
}

/**
 * Recovery state information
 */
export interface RecoveryState {
  status: RecoveryStatus;
  isConnected: boolean;
  lastFailure?: {
    timestamp: number;
    reason: FailureReason;
    error: string;
  };
  attempts: RecoveryAttempt[];
  totalAttempts: number;
  successfulRecoveries: number;
  lastRecoveryTime?: number;
  nextAttemptTime?: number;
  estimatedRecoveryTime?: number;
  pendingSyncOperations: number;
  unresolvedConflicts: number;
}

/**
 * Recovery event data
 */
export interface RecoveryEventData {
  status: RecoveryStatus;
  attempt?: RecoveryAttempt;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Connection health information
 */
export interface ConnectionHealth {
  isHealthy: boolean;
  latency: number;
  uptime: number;
  errorRate: number;
  lastCheck: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  status: RecoveryStatus;
  duration: number;
  syncedOperations?: number;
  resolvedConflicts?: number;
  error?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: true,
  strategy: 'exponential',
  maxAttempts: 5,
  baseDelay: 1000,       // 1 second
  maxDelay: 30000,       // 30 seconds
  exponentialBase: 2,
  timeoutMs: 10000,      // 10 seconds
  healthCheckInterval: 5000, // 5 seconds
  syncOnReconnect: true,
  autoResolveConflicts: true,
  persistRecoveryState: true,
  notifyOnRecovery: true,
  enableLogging: true
};

// ============================================================================
// RECOVERY MANAGER CLASS
// ============================================================================

/**
 * Main recovery manager class
 */
export class RecoveryManager {
  private config: RecoveryConfig;
  private state: RecoveryState;
  private recoveryTimeout: number | null;
  private healthCheckInterval: number | null;
  private eventListeners: Map<string, Function[]>;
  private abortController: AbortController | null;

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.recoveryTimeout = null;
    this.healthCheckInterval = null;
    this.eventListeners = new Map();
    this.abortController = null;
    
    this.state = {
      status: 'idle',
      isConnected: true,
      attempts: [],
      totalAttempts: 0,
      successfulRecoveries: 0,
      pendingSyncOperations: 0,
      unresolvedConflicts: 0
    };

    this.initialize();
  }

  /**
   * Initialize recovery manager
   */
  private initialize(): void {
    if (this.config.enabled) {
      this.startHealthChecking();
      this.loadPersistedState();
      this.setupEventListeners();
    }

    this.emit('initialized', { config: this.config });
  }

  /**
   * Detect connection failure and initiate recovery
   */
  async detectFailure(reason: FailureReason, error: string): Promise<void> {
    if (!this.config.enabled || this.state.status === 'reconnecting') {
      return;
    }

    this.state.lastFailure = {
      timestamp: Date.now(),
      reason,
      error
    };

    this.state.isConnected = false;
    this.state.status = 'detecting';

    this.emit('failureDetected', { 
      reason, 
      error, 
      timestamp: this.state.lastFailure.timestamp 
    });

    if (this.config.enableLogging) {
      console.warn(`🔄 Recovery: Connection failure detected - ${reason}: ${error}`);
    }

    // Start recovery process
    await this.startRecovery();
  }

  /**
   * Start the recovery process
   */
  async startRecovery(): Promise<RecoveryResult> {
    if (this.state.totalAttempts >= this.config.maxAttempts) {
      this.state.status = 'abandoned';
      this.emit('recoveryAbandoned', { 
        attempts: this.state.totalAttempts,
        maxAttempts: this.config.maxAttempts 
      });
      
      return {
        success: false,
        status: 'abandoned',
        duration: 0,
        error: 'Maximum recovery attempts exceeded'
      };
    }

    this.state.status = 'reconnecting';
    this.state.totalAttempts++;

    const attempt: RecoveryAttempt = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      strategy: this.config.strategy,
      reason: this.state.lastFailure?.reason || 'unknown',
      duration: 0,
      success: false
    };

    this.emit('recoveryStarted', { attempt });

    if (this.config.enableLogging) {
      console.log(`🔄 Recovery: Starting attempt ${this.state.totalAttempts}/${this.config.maxAttempts}`);
    }

    try {
      // Calculate delay based on strategy
      const delay = this.calculateDelay();
      
      if (delay > 0) {
        this.state.nextAttemptTime = Date.now() + delay;
        this.state.estimatedRecoveryTime = this.state.nextAttemptTime + this.config.timeoutMs;
        
        if (this.config.enableLogging) {
          console.log(`🔄 Recovery: Waiting ${delay}ms before attempt`);
        }
        
        await this.delay(delay);
      }

      // Attempt reconnection
      const startTime = Date.now();
      const reconnectResult = await this.attemptReconnection();
      
      attempt.duration = Date.now() - startTime;
      attempt.success = reconnectResult.success;
      
      if (!reconnectResult.success) {
        attempt.error = reconnectResult.error;
        this.state.attempts.push(attempt);
        
        this.emit('recoveryAttemptFailed', { attempt });
        
        // Schedule next attempt
        this.scheduleNextRecovery();
        
        return {
          success: false,
          status: 'failed',
          duration: attempt.duration,
          error: reconnectResult.error
        };
      }

      // Reconnection successful
      this.state.isConnected = true;
      this.state.status = 'synchronizing';
      this.state.attempts.push(attempt);
      this.state.successfulRecoveries++;
      this.state.lastRecoveryTime = Date.now();

      this.emit('reconnectionSuccessful', { attempt });

      if (this.config.enableLogging) {
        console.log(`✅ Recovery: Reconnection successful after ${attempt.duration}ms`);
      }

      // Perform post-reconnection sync if enabled
      let syncResult: any = { syncedOperations: 0, resolvedConflicts: 0 };
      
      if (this.config.syncOnReconnect) {
        syncResult = await this.performPostReconnectionSync();
      }

      // Mark recovery as complete
      this.state.status = 'recovered';
      this.state.nextAttemptTime = undefined;
      this.state.estimatedRecoveryTime = undefined;

      this.emit('recoveryCompleted', { 
        attempt,
        syncResult,
        totalDuration: Date.now() - (this.state.lastFailure?.timestamp || Date.now())
      });

      if (this.config.enableLogging) {
        console.log(`🎉 Recovery: Complete! Synced ${syncResult.syncedOperations} operations, resolved ${syncResult.resolvedConflicts} conflicts`);
      }

      // Reset state for next potential failure
      setTimeout(() => {
        if (this.state.status === 'recovered') {
          this.state.status = 'idle';
        }
      }, 5000); // Reset after 5 seconds

      return {
        success: true,
        status: 'recovered',
        duration: attempt.duration,
        syncedOperations: syncResult.syncedOperations,
        resolvedConflicts: syncResult.resolvedConflicts
      };

    } catch (error) {
      attempt.duration = Date.now() - attempt.timestamp;
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      this.state.attempts.push(attempt);

      this.emit('recoveryAttemptFailed', { attempt, error });

      // Schedule next attempt
      this.scheduleNextRecovery();

      return {
        success: false,
        status: 'failed',
        duration: attempt.duration,
        error: attempt.error
      };
    }
  }

  /**
   * Manually trigger recovery
   */
  async manualRecovery(): Promise<RecoveryResult> {
    if (this.config.enableLogging) {
      console.log('🔄 Recovery: Manual recovery triggered');
    }

    // Reset attempt counter for manual recovery
    const originalAttempts = this.state.totalAttempts;
    this.state.totalAttempts = 0;

    const result = await this.startRecovery();

    // Restore attempt counter if recovery failed
    if (!result.success) {
      this.state.totalAttempts = originalAttempts;
    }

    return result;
  }

  /**
   * Get current recovery state
   */
  getState(): RecoveryState {
    return { ...this.state };
  }

  /**
   * Get connection health information
   */
  async getConnectionHealth(): Promise<ConnectionHealth> {
    const startTime = Date.now();
    
    try {
      // Perform health check (implementation would depend on specific service)
      await this.performHealthCheck();
      
      const latency = Date.now() - startTime;
      const errorRate = this.calculateErrorRate();
      
      let quality: ConnectionHealth['quality'] = 'excellent';
      if (latency > 2000 || errorRate > 0.1) quality = 'poor';
      else if (latency > 1000 || errorRate > 0.05) quality = 'fair';
      else if (latency > 500 || errorRate > 0.01) quality = 'good';

      return {
        isHealthy: this.state.isConnected && latency < 5000,
        latency,
        uptime: this.calculateUptime(),
        errorRate,
        lastCheck: Date.now(),
        quality
      };
    } catch (error) {
      return {
        isHealthy: false,
        latency: -1,
        uptime: this.calculateUptime(),
        errorRate: 1.0,
        lastCheck: Date.now(),
        quality: 'critical'
      };
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Stop recovery manager
   */
  stop(): void {
    this.config.enabled = false;
    
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.state.status = 'idle';
    this.emit('stopped', {});
  }

  /**
   * Destroy recovery manager
   */
  destroy(): void {
    this.stop();
    this.eventListeners.clear();
    this.persistState();
    this.emit('destroyed', {});
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateDelay(): number {
    const attempt = this.state.totalAttempts;
    
    switch (this.config.strategy) {
      case 'immediate':
        return 0;
      
      case 'linear':
        return Math.min(this.config.baseDelay * attempt, this.config.maxDelay);
      
      case 'exponential':
        return Math.min(
          this.config.baseDelay * Math.pow(this.config.exponentialBase, attempt - 1),
          this.config.maxDelay
        );
      
      case 'custom':
        // Custom strategy implementation would go here
        return this.config.baseDelay;
      
      case 'manual':
        return 0;
      
      default:
        return this.config.baseDelay;
    }
  }

  private async attemptReconnection(): Promise<{ success: boolean; error?: string }> {
    this.abortController = new AbortController();
    
    try {
      // Implementation would depend on specific service being recovered
      // This is a placeholder that simulates reconnection attempt
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Reconnection timeout')), this.config.timeoutMs);
      });

      const reconnectPromise = this.performReconnection();

      await Promise.race([reconnectPromise, timeoutPromise]);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reconnection failed'
      };
    } finally {
      this.abortController = null;
    }
  }

  private async performReconnection(): Promise<void> {
    // Placeholder for actual reconnection logic
    // In real implementation, this would attempt to reconnect to the service
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async performPostReconnectionSync(): Promise<{ syncedOperations: number; resolvedConflicts: number }> {
    try {
      let syncedOperations = 0;
      let resolvedConflicts = 0;

      // Sync pending operations (placeholder)
      if (this.state.pendingSyncOperations > 0) {
        // Implementation would sync queued operations
        syncedOperations = this.state.pendingSyncOperations;
        this.state.pendingSyncOperations = 0;
      }

      // Resolve conflicts if auto-resolution is enabled
      if (this.config.autoResolveConflicts && this.state.unresolvedConflicts > 0) {
        // Implementation would resolve conflicts
        resolvedConflicts = this.state.unresolvedConflicts;
        this.state.unresolvedConflicts = 0;
      }

      return { syncedOperations, resolvedConflicts };
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Recovery: Post-reconnection sync failed:', error);
      }
      return { syncedOperations: 0, resolvedConflicts: 0 };
    }
  }

  private scheduleNextRecovery(): void {
    if (this.state.totalAttempts >= this.config.maxAttempts) {
      this.state.status = 'abandoned';
      return;
    }

    const delay = this.calculateDelay();
    this.state.nextAttemptTime = Date.now() + delay;

    this.recoveryTimeout = window.setTimeout(() => {
      this.startRecovery();
    }, delay);
  }

  private async performHealthCheck(): Promise<void> {
    // Placeholder for health check implementation
    // In real implementation, this would ping the service
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private calculateErrorRate(): number {
    if (this.state.attempts.length === 0) return 0;
    
    const recentAttempts = this.state.attempts.slice(-10); // Last 10 attempts
    const failures = recentAttempts.filter(attempt => !attempt.success).length;
    
    return failures / recentAttempts.length;
  }

  private calculateUptime(): number {
    if (!this.state.lastRecoveryTime) return 0;
    return Date.now() - this.state.lastRecoveryTime;
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = window.setInterval(async () => {
      if (this.state.isConnected && this.state.status === 'idle') {
        try {
          await this.performHealthCheck();
        } catch (error) {
          // Health check failed, trigger recovery
          await this.detectFailure('network_timeout', 'Health check failed');
        }
      }
    }, this.config.healthCheckInterval);
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.state.isConnected) {
          this.manualRecovery();
        }
      });

      window.addEventListener('beforeunload', () => {
        this.persistState();
      });
    }
  }

  private loadPersistedState(): void {
    if (!this.config.persistRecoveryState || typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('recoveryManager_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.successfulRecoveries = parsed.successfulRecoveries || 0;
        this.state.totalAttempts = Math.min(parsed.totalAttempts || 0, this.config.maxAttempts);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn('Recovery: Failed to load persisted state:', error);
      }
    }
  }

  private persistState(): void {
    if (!this.config.persistRecoveryState || typeof window === 'undefined') return;

    try {
      const toSave = {
        successfulRecoveries: this.state.successfulRecoveries,
        totalAttempts: this.state.totalAttempts,
        lastRecoveryTime: this.state.lastRecoveryTime,
        timestamp: Date.now()
      };
      localStorage.setItem('recoveryManager_state', JSON.stringify(toSave));
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn('Recovery: Failed to persist state:', error);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private emit(event: string, data: RecoveryEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          if (this.config.enableLogging) {
            console.error('Recovery: Event listener error:', error);
          }
        }
      });
    }
  }
}

// ============================================================================
// RECOVERY UTILITIES
// ============================================================================

/**
 * Default recovery manager instance
 */
let defaultRecoveryManager: RecoveryManager | null = null;

/**
 * Get or create default recovery manager
 */
export const getRecoveryManager = (config?: Partial<RecoveryConfig>): RecoveryManager => {
  if (!defaultRecoveryManager) {
    defaultRecoveryManager = new RecoveryManager(config);
  }
  return defaultRecoveryManager;
};

/**
 * Destroy default recovery manager
 */
export const destroyRecoveryManager = (): void => {
  if (defaultRecoveryManager) {
    defaultRecoveryManager.destroy();
    defaultRecoveryManager = null;
  }
};

/**
 * Quick recovery utility function
 */
export const quickRecovery = async (reason: FailureReason, error: string): Promise<RecoveryResult> => {
  const manager = getRecoveryManager();
  await manager.detectFailure(reason, error);
  return manager.startRecovery();
};

/**
 * Create recovery configuration preset
 */
export const createRecoveryConfig = (preset: 'aggressive' | 'balanced' | 'conservative'): RecoveryConfig => {
  const baseConfig = { ...DEFAULT_RECOVERY_CONFIG };

  switch (preset) {
    case 'aggressive':
      return {
        ...baseConfig,
        strategy: 'immediate',
        maxAttempts: 10,
        baseDelay: 500,
        maxDelay: 10000,
        timeoutMs: 5000,
        healthCheckInterval: 2000
      };

    case 'conservative':
      return {
        ...baseConfig,
        strategy: 'exponential',
        maxAttempts: 3,
        baseDelay: 5000,
        maxDelay: 60000,
        timeoutMs: 30000,
        healthCheckInterval: 15000
      };

    case 'balanced':
    default:
      return baseConfig;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default RecoveryManager;