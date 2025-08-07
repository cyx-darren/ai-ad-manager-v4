/**
 * Sync Manager (Phase 4)
 * 
 * This file provides data synchronization preparation for offline scenarios:
 * - Offline data synchronization preparation
 * - Conflict resolution strategies
 * - Data versioning and merge logic
 * - Synchronization queue management
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Sync operation types
 */
export type SyncOperationType = 
  | 'create'    // Create new data
  | 'update'    // Update existing data
  | 'delete'    // Delete data
  | 'patch';    // Partial update

/**
 * Sync conflict resolution strategy
 */
export type ConflictResolutionStrategy = 
  | 'server_wins'     // Server data takes precedence
  | 'client_wins'     // Client data takes precedence
  | 'last_write_wins' // Most recent timestamp wins
  | 'merge'           // Attempt to merge changes
  | 'manual'          // Require manual resolution
  | 'custom';         // Use custom resolution function

/**
 * Sync status
 */
export type SyncStatus = 
  | 'idle'        // No sync in progress
  | 'preparing'   // Preparing sync data
  | 'syncing'     // Sync in progress
  | 'resolving'   // Resolving conflicts
  | 'success'     // Sync completed successfully
  | 'error'       // Sync failed
  | 'partial';    // Partial sync completed

/**
 * Data version information
 */
export interface DataVersion {
  version: string;
  timestamp: number;
  userId: string;
  checksum: string;
  source: 'client' | 'server';
}

/**
 * Sync operation data
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  key: string;
  data: any;
  previousData?: any;
  version: DataVersion;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  dependencies: string[];
  tags: string[];
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  id: string;
  key: string;
  clientData: any;
  serverData: any;
  clientVersion: DataVersion;
  serverVersion: DataVersion;
  strategy: ConflictResolutionStrategy;
  resolutionRequired: boolean;
  resolvedData?: any;
  resolvedBy?: string;
  resolvedAt?: number;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  operationsProcessed: number;
  operationsFailed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errors: Array<{
    operation: SyncOperation;
    error: string;
  }>;
  conflicts: SyncConflict[];
  duration: number;
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  conflictResolution: ConflictResolutionStrategy;
  autoSync: boolean;
  syncInterval: number;
  offlineQueueEnabled: boolean;
  maxQueueSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  checksumValidation: boolean;
  dependencyResolution: boolean;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSyncTime: number;
  queueSize: number;
  dataTransferred: number;
}

/**
 * Custom conflict resolver function
 */
export type ConflictResolver = (conflict: SyncConflict) => Promise<any>;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_SYNC_CONFIG: SyncManagerConfig = {
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 1000,
  conflictResolution: 'last_write_wins',
  autoSync: true,
  syncInterval: 30000, // 30 seconds
  offlineQueueEnabled: true,
  maxQueueSize: 1000,
  compressionEnabled: true,
  encryptionEnabled: false,
  checksumValidation: true,
  dependencyResolution: true
};

// ============================================================================
// SYNC MANAGER CLASS
// ============================================================================

/**
 * Main synchronization manager
 */
export class SyncManager {
  private config: SyncManagerConfig;
  private operationQueue: SyncOperation[];
  private conflictQueue: SyncConflict[];
  private stats: SyncStats;
  private syncInterval: number | null;
  private isSyncing: boolean;
  private eventListeners: Map<string, Function[]>;
  private customResolvers: Map<string, ConflictResolver>;

  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.operationQueue = [];
    this.conflictQueue = [];
    this.syncInterval = null;
    this.isSyncing = false;
    this.eventListeners = new Map();
    this.customResolvers = new Map();
    
    this.stats = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      averageSyncTime: 0,
      lastSyncTime: 0,
      queueSize: 0,
      dataTransferred: 0
    };

    this.initialize();
  }

  /**
   * Initialize sync manager
   */
  private initialize(): void {
    try {
      if (this.config.autoSync) {
        this.startAutoSync();
      }

      this.setupEventListeners();
      this.loadQueueFromStorage();

      this.emit('initialized', { config: this.config });
    } catch (error) {
      console.error('Sync manager initialization failed:', error);
      this.emit('error', { error, context: 'initialization' });
    }
  }

  /**
   * Queue operation for synchronization
   */
  queueOperation(
    type: SyncOperationType,
    key: string,
    data: any,
    options: {
      previousData?: any;
      dependencies?: string[];
      tags?: string[];
      priority?: number;
    } = {}
  ): string {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type,
      key,
      data,
      previousData: options.previousData,
      version: this.createDataVersion(data),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.retryAttempts,
      dependencies: options.dependencies || [],
      tags: options.tags || []
    };

    // Insert based on priority and dependencies
    if (this.config.dependencyResolution) {
      this.insertOperationWithDependencies(operation);
    } else {
      this.operationQueue.push(operation);
    }

    // Limit queue size
    if (this.operationQueue.length > this.config.maxQueueSize) {
      this.operationQueue = this.operationQueue.slice(-this.config.maxQueueSize);
    }

    this.stats.totalOperations++;
    this.stats.queueSize = this.operationQueue.length;

    this.saveQueueToStorage();
    this.emit('operationQueued', { operation });

    return operation.id;
  }

  /**
   * Process synchronization queue
   */
  async processQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        operationsProcessed: 0,
        operationsFailed: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errors: [{ operation: {} as SyncOperation, error: 'Sync already in progress' }],
        conflicts: [],
        duration: 0
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      this.emit('syncStarted', { queueSize: this.operationQueue.length });

      const result = await this.processBatchedOperations();
      
      const duration = Date.now() - startTime;
      result.duration = duration;

      // Update statistics
      if (result.success) {
        this.stats.successfulSyncs++;
      } else {
        this.stats.failedSyncs++;
      }

      this.stats.averageSyncTime = (this.stats.averageSyncTime + duration) / 2;
      this.stats.lastSyncTime = Date.now();
      this.stats.queueSize = this.operationQueue.length;

      this.emit('syncCompleted', { result });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.failedSyncs++;
      this.emit('syncError', { error });
      
      return {
        success: false,
        operationsProcessed: 0,
        operationsFailed: this.operationQueue.length,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errors: [{ operation: {} as SyncOperation, error: error instanceof Error ? error.message : 'Unknown error' }],
        conflicts: [],
        duration
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(conflictId: string, resolvedData: any): Promise<boolean> {
    try {
      const conflict = this.conflictQueue.find(c => c.id === conflictId);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found`);
      }

      conflict.resolvedData = resolvedData;
      conflict.resolvedBy = 'manual';
      conflict.resolvedAt = Date.now();
      conflict.resolutionRequired = false;

      // Remove from conflict queue
      this.conflictQueue = this.conflictQueue.filter(c => c.id !== conflictId);

      // Queue resolved data for sync
      this.queueOperation('update', conflict.key, resolvedData);

      this.stats.conflictsResolved++;
      this.emit('conflictResolved', { conflict });

      return true;
    } catch (error) {
      this.emit('error', { error, context: 'resolveConflict', conflictId });
      return false;
    }
  }

  /**
   * Register custom conflict resolver
   */
  registerConflictResolver(key: string, resolver: ConflictResolver): void {
    this.customResolvers.set(key, resolver);
  }

  /**
   * Get synchronization statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Clear all queued operations
   */
  clearQueue(): void {
    this.operationQueue = [];
    this.stats.queueSize = 0;
    this.saveQueueToStorage();
    this.emit('queueCleared', {});
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
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      if (this.operationQueue.length > 0 && !this.isSyncing) {
        this.processQueue();
      }
    }, this.config.syncInterval);

    this.emit('autoSyncStarted', { interval: this.config.syncInterval });
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.emit('autoSyncStopped', {});
    }
  }

  /**
   * Destroy sync manager
   */
  destroy(): void {
    this.stopAutoSync();
    this.operationQueue = [];
    this.conflictQueue = [];
    this.eventListeners.clear();
    this.customResolvers.clear();
    this.emit('destroyed', {});
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async processBatchedOperations(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      operationsProcessed: 0,
      operationsFailed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors: [],
      conflicts: [],
      duration: 0
    };

    while (this.operationQueue.length > 0) {
      const batch = this.operationQueue.splice(0, this.config.batchSize);
      
      for (const operation of batch) {
        try {
          const operationResult = await this.processOperation(operation);
          
          if (operationResult.success) {
            result.operationsProcessed++;
          } else {
            result.operationsFailed++;
            result.errors.push({
              operation,
              error: operationResult.error || 'Unknown error'
            });

            // Retry if possible
            if (operation.retryCount < operation.maxRetries) {
              operation.retryCount++;
              this.operationQueue.push(operation);
            }
          }

          if (operationResult.conflict) {
            result.conflictsDetected++;
            this.conflictQueue.push(operationResult.conflict);
            result.conflicts.push(operationResult.conflict);

            // Try to resolve automatically
            const resolved = await this.attemptAutomaticResolution(operationResult.conflict);
            if (resolved) {
              result.conflictsResolved++;
            }
          }
        } catch (error) {
          result.operationsFailed++;
          result.errors.push({
            operation,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    result.success = result.operationsFailed === 0;
    this.saveQueueToStorage();

    return result;
  }

  private async processOperation(operation: SyncOperation): Promise<{
    success: boolean;
    error?: string;
    conflict?: SyncConflict;
  }> {
    try {
      // Simulate server communication
      // In a real implementation, this would make API calls
      
      // Check for conflicts
      const serverData = await this.fetchServerData(operation.key);
      if (serverData && this.hasConflict(operation, serverData)) {
        const conflict = this.createConflict(operation, serverData);
        return { success: false, conflict };
      }

      // Process the operation
      await this.sendToServer(operation);
      this.stats.dataTransferred += this.calculateOperationSize(operation);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  }

  private async attemptAutomaticResolution(conflict: SyncConflict): Promise<boolean> {
    try {
      let resolvedData: any;

      // Check for custom resolver
      const customResolver = this.customResolvers.get(conflict.key);
      if (customResolver) {
        resolvedData = await customResolver(conflict);
      } else {
        // Use configured strategy
        resolvedData = await this.resolveWithStrategy(conflict);
      }

      if (resolvedData !== null) {
        conflict.resolvedData = resolvedData;
        conflict.resolvedBy = 'automatic';
        conflict.resolvedAt = Date.now();
        conflict.resolutionRequired = false;

        // Queue resolved data
        this.queueOperation('update', conflict.key, resolvedData);

        this.stats.conflictsResolved++;
        return true;
      }
    } catch (error) {
      console.warn('Automatic conflict resolution failed:', error);
    }

    return false;
  }

  private async resolveWithStrategy(conflict: SyncConflict): Promise<any> {
    switch (this.config.conflictResolution) {
      case 'server_wins':
        return conflict.serverData;
      
      case 'client_wins':
        return conflict.clientData;
      
      case 'last_write_wins':
        return conflict.clientVersion.timestamp > conflict.serverVersion.timestamp 
          ? conflict.clientData 
          : conflict.serverData;
      
      case 'merge':
        return this.mergeData(conflict.clientData, conflict.serverData);
      
      case 'manual':
        conflict.resolutionRequired = true;
        return null;
      
      default:
        return conflict.serverData;
    }
  }

  private mergeData(clientData: any, serverData: any): any {
    // Simple merge strategy - in practice, this would be more sophisticated
    if (typeof clientData === 'object' && typeof serverData === 'object') {
      return { ...serverData, ...clientData };
    }
    return clientData;
  }

  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createDataVersion(data: any): DataVersion {
    return {
      version: `v${Date.now()}`,
      timestamp: Date.now(),
      userId: 'current_user', // Would get from auth context
      checksum: this.calculateChecksum(data),
      source: 'client'
    };
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private insertOperationWithDependencies(operation: SyncOperation): void {
    // Simple dependency resolution - insert at end if no dependencies
    if (operation.dependencies.length === 0) {
      this.operationQueue.push(operation);
      return;
    }

    // Find insertion point based on dependencies
    let insertIndex = this.operationQueue.length;
    for (let i = this.operationQueue.length - 1; i >= 0; i--) {
      if (operation.dependencies.includes(this.operationQueue[i].id)) {
        insertIndex = i + 1;
        break;
      }
    }

    this.operationQueue.splice(insertIndex, 0, operation);
  }

  private hasConflict(operation: SyncOperation, serverData: any): boolean {
    if (!serverData || !serverData.version) return false;
    
    // Check if server version is newer than operation version
    return serverData.version.timestamp > operation.version.timestamp;
  }

  private createConflict(operation: SyncOperation, serverData: any): SyncConflict {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key: operation.key,
      clientData: operation.data,
      serverData: serverData.data,
      clientVersion: operation.version,
      serverVersion: serverData.version,
      strategy: this.config.conflictResolution,
      resolutionRequired: this.config.conflictResolution === 'manual'
    };
  }

  private async fetchServerData(key: string): Promise<any> {
    // Simulate server fetch
    // In real implementation, this would make an API call
    return null;
  }

  private async sendToServer(operation: SyncOperation): Promise<void> {
    // Simulate server communication
    // In real implementation, this would make an API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private calculateOperationSize(operation: SyncOperation): number {
    return JSON.stringify(operation.data).length;
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.operationQueue.length > 0) {
          this.processQueue();
        }
      });

      window.addEventListener('beforeunload', () => {
        this.saveQueueToStorage();
      });
    }
  }

  private loadQueueFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('syncManager_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.operationQueue = parsed.operations || [];
        this.conflictQueue = parsed.conflicts || [];
        this.stats.queueSize = this.operationQueue.length;
      }
    } catch (error) {
      console.warn('Failed to load sync queue from storage:', error);
    }
  }

  private saveQueueToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const toSave = {
        operations: this.operationQueue,
        conflicts: this.conflictQueue,
        timestamp: Date.now()
      };
      localStorage.setItem('syncManager_queue', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save sync queue to storage:', error);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Sync event listener error:', error);
        }
      });
    }
  }
}

// ============================================================================
// SYNC UTILITIES
// ============================================================================

/**
 * Default sync manager instance
 */
let defaultSyncManager: SyncManager | null = null;

/**
 * Get or create default sync manager
 */
export const getSyncManager = (config?: Partial<SyncManagerConfig>): SyncManager => {
  if (!defaultSyncManager) {
    defaultSyncManager = new SyncManager(config);
  }
  return defaultSyncManager;
};

/**
 * Destroy default sync manager
 */
export const destroySyncManager = (): void => {
  if (defaultSyncManager) {
    defaultSyncManager.destroy();
    defaultSyncManager = null;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default SyncManager;