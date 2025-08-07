import {
  RaceConditionConfig,
  AuthOperationLock,
  RaceConditionDetection,
  MCPAuthError,
  MCPAuthErrorType
} from './authTypes';

/**
 * Race Condition Handler for Phase 6
 * Handles concurrent authentication operations and prevents race conditions
 */
export class RaceConditionHandler {
  private config: RaceConditionConfig;
  private activeLocks: Map<string, AuthOperationLock> = new Map();
  private lockQueue: AuthOperationLock[] = [];
  private conflictHistory: RaceConditionDetection[] = [];
  private deadlockDetectionTimer: NodeJS.Timeout | null = null;

  constructor(config: RaceConditionConfig) {
    this.config = config;
    
    if (this.config.enableDeadlockDetection) {
      this.startDeadlockDetection();
    }
  }

  // ============================================================================
  // PHASE 6: RACE CONDITION PROTECTION
  // ============================================================================

  /**
   * Acquire an exclusive lock for an authentication operation
   */
  async acquireLock(
    operationType: AuthOperationLock['operationType'],
    source: string,
    priority: AuthOperationLock['priority'] = 'medium',
    context?: Record<string, any>
  ): Promise<{ success: boolean; lockId?: string; error?: string; waitTime?: number }> {
    if (!this.config.enableRaceConditionProtection) {
      return { success: true, lockId: this.generateLockId() };
    }

    const startTime = Date.now();
    const lockId = this.generateLockId();
    
    const lock: AuthOperationLock = {
      operationId: lockId,
      operationType,
      lockAcquiredAt: startTime,
      lockTimeout: startTime + this.config.lockTimeout,
      source,
      priority,
      context
    };

    try {
      // Check if we can acquire the lock immediately
      if (this.canAcquireImmediately(lock)) {
        this.activeLocks.set(lockId, lock);
        return { success: true, lockId, waitTime: 0 };
      }

      // Check if we've reached max concurrent operations
      if (this.activeLocks.size >= this.config.maxConcurrentOperations) {
        return { 
          success: false, 
          error: 'Maximum concurrent operations reached',
          waitTime: this.estimateWaitTime()
        };
      }

      // Add to queue and wait
      this.lockQueue.push(lock);
      this.lockQueue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));

      return await this.waitForLock(lock);

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Release a lock and allow queued operations to proceed
   */
  releaseLock(lockId: string): boolean {
    if (!this.config.enableRaceConditionProtection) {
      return true;
    }

    const lock = this.activeLocks.get(lockId);
    if (!lock) {
      return false;
    }

    this.activeLocks.delete(lockId);
    
    // Process queue
    this.processLockQueue();

    return true;
  }

  /**
   * Detect and resolve race conditions between operations
   */
  detectRaceCondition(newOperation: AuthOperationLock): RaceConditionDetection {
    const conflictingOperations = Array.from(this.activeLocks.values()).filter(
      lock => this.operationsConflict(lock, newOperation)
    );

    const hasRaceCondition = conflictingOperations.length > 0;

    if (!hasRaceCondition) {
      return {
        hasRaceCondition: false,
        conflictingOperations: [],
        resolutionStrategy: 'none',
        blockedOperations: [],
        resolutionTimestamp: Date.now(),
        conflictDuration: 0
      };
    }

    const resolution = this.resolveRaceCondition(newOperation, conflictingOperations);
    const detection: RaceConditionDetection = {
      hasRaceCondition: true,
      conflictingOperations,
      resolutionStrategy: this.config.conflictResolutionStrategy,
      winningOperation: resolution.winner,
      blockedOperations: resolution.blocked,
      resolutionTimestamp: Date.now(),
      conflictDuration: Date.now() - Math.min(...conflictingOperations.map(op => op.lockAcquiredAt))
    };

    // Log the race condition
    this.logRaceCondition(detection);
    this.conflictHistory.push(detection);

    // Keep only recent history (last 100 conflicts)
    if (this.conflictHistory.length > 100) {
      this.conflictHistory = this.conflictHistory.slice(-100);
    }

    return detection;
  }

  /**
   * Check if two operations conflict with each other
   */
  private operationsConflict(op1: AuthOperationLock, op2: AuthOperationLock): boolean {
    // Same operation type conflicts
    if (op1.operationType === op2.operationType) {
      return true;
    }

    // Specific conflict rules
    const conflictMatrix: Record<string, string[]> = {
      'auth': ['auth', 'logout'],
      'refresh': ['auth', 'logout', 'refresh'],
      'logout': ['auth', 'refresh', 'logout'],
      'validate': [] // Validation can run concurrently with most operations
    };

    const conflictsWithOp1 = conflictMatrix[op1.operationType] || [];
    return conflictsWithOp1.includes(op2.operationType);
  }

  /**
   * Resolve race condition based on configured strategy
   */
  private resolveRaceCondition(
    newOperation: AuthOperationLock,
    conflictingOperations: AuthOperationLock[]
  ): { winner: AuthOperationLock; blocked: AuthOperationLock[] } {
    const allOperations = [newOperation, ...conflictingOperations];

    switch (this.config.conflictResolutionStrategy) {
      case 'first-wins':
        return this.resolveFirstWins(allOperations);
      
      case 'last-wins':
        return this.resolveLastWins(allOperations);
      
      case 'merge':
        return this.resolveMerge(allOperations);
      
      case 'abort':
        return this.resolveAbort(allOperations);
      
      default:
        return this.resolveFirstWins(allOperations);
    }
  }

  /**
   * First-wins resolution strategy
   */
  private resolveFirstWins(operations: AuthOperationLock[]): { winner: AuthOperationLock; blocked: AuthOperationLock[] } {
    const sorted = operations.sort((a, b) => a.lockAcquiredAt - b.lockAcquiredAt);
    return {
      winner: sorted[0],
      blocked: sorted.slice(1)
    };
  }

  /**
   * Last-wins resolution strategy
   */
  private resolveLastWins(operations: AuthOperationLock[]): { winner: AuthOperationLock; blocked: AuthOperationLock[] } {
    const sorted = operations.sort((a, b) => b.lockAcquiredAt - a.lockAcquiredAt);
    return {
      winner: sorted[0],
      blocked: sorted.slice(1)
    };
  }

  /**
   * Merge resolution strategy (priority-based)
   */
  private resolveMerge(operations: AuthOperationLock[]): { winner: AuthOperationLock; blocked: AuthOperationLock[] } {
    const sorted = operations.sort((a, b) => {
      const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.lockAcquiredAt - b.lockAcquiredAt; // First-wins as tiebreaker
    });

    return {
      winner: sorted[0],
      blocked: sorted.slice(1)
    };
  }

  /**
   * Abort resolution strategy (abort new operation)
   */
  private resolveAbort(operations: AuthOperationLock[]): { winner: AuthOperationLock; blocked: AuthOperationLock[] } {
    const existingOperations = operations.filter(op => this.activeLocks.has(op.operationId));
    const newOperations = operations.filter(op => !this.activeLocks.has(op.operationId));

    if (existingOperations.length > 0) {
      return {
        winner: existingOperations[0],
        blocked: newOperations
      };
    }

    return this.resolveFirstWins(operations);
  }

  /**
   * Get numeric priority value for comparison
   */
  private getPriorityValue(priority: AuthOperationLock['priority']): number {
    const priorityMap = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return priorityMap[priority] || 2;
  }

  /**
   * Check if a lock can be acquired immediately
   */
  private canAcquireImmediately(newLock: AuthOperationLock): boolean {
    // Check for conflicts with existing locks
    for (const existingLock of Array.from(this.activeLocks.values())) {
      if (this.operationsConflict(existingLock, newLock)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Wait for a lock to be available
   */
  private async waitForLock(lock: AuthOperationLock): Promise<{ success: boolean; lockId?: string; error?: string; waitTime?: number }> {
    const startWait = Date.now();
    const timeout = lock.lockTimeout;

    return new Promise((resolve) => {
      const checkLock = () => {
        const now = Date.now();
        
        // Check timeout
        if (now > timeout) {
          this.removeLockFromQueue(lock.operationId);
          resolve({ 
            success: false, 
            error: 'Lock acquisition timeout',
            waitTime: now - startWait
          });
          return;
        }

        // Check if lock can be acquired
        if (this.canAcquireImmediately(lock)) {
          this.removeLockFromQueue(lock.operationId);
          this.activeLocks.set(lock.operationId, lock);
          resolve({ 
            success: true, 
            lockId: lock.operationId,
            waitTime: now - startWait
          });
          return;
        }

        // Continue waiting
        setTimeout(checkLock, 50); // Check every 50ms
      };

      checkLock();
    });
  }

  /**
   * Process the lock queue and grant locks when possible
   */
  private processLockQueue(): void {
    for (let i = 0; i < this.lockQueue.length; i++) {
      const queuedLock = this.lockQueue[i];
      
      if (this.canAcquireImmediately(queuedLock)) {
        this.lockQueue.splice(i, 1);
        this.activeLocks.set(queuedLock.operationId, queuedLock);
        i--; // Adjust index after removal
      }
    }
  }

  /**
   * Remove a lock from the queue
   */
  private removeLockFromQueue(lockId: string): void {
    const index = this.lockQueue.findIndex(lock => lock.operationId === lockId);
    if (index !== -1) {
      this.lockQueue.splice(index, 1);
    }
  }

  /**
   * Estimate wait time for new operations
   */
  private estimateWaitTime(): number {
    if (this.activeLocks.size === 0) {
      return 0;
    }

    const currentTime = Date.now();
    const lockTimeouts = Array.from(this.activeLocks.values()).map(lock => lock.lockTimeout);
    const nearestTimeout = Math.min(...lockTimeouts);
    
    return Math.max(0, nearestTimeout - currentTime);
  }

  /**
   * Generate unique lock ID
   */
  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Start deadlock detection monitoring
   */
  private startDeadlockDetection(): void {
    if (this.deadlockDetectionTimer) {
      clearInterval(this.deadlockDetectionTimer);
    }

    this.deadlockDetectionTimer = setInterval(() => {
      this.detectAndResolveDeadlocks();
    }, this.config.deadlockTimeout);
  }

  /**
   * Detect and resolve potential deadlocks
   */
  private detectAndResolveDeadlocks(): void {
    const now = Date.now();
    const staleLocks: AuthOperationLock[] = [];

    // Find locks that have exceeded their timeout
    for (const lock of Array.from(this.activeLocks.values())) {
      if (now > lock.lockTimeout) {
        staleLocks.push(lock);
      }
    }

    // Remove stale locks
    for (const staleLock of staleLocks) {
      this.activeLocks.delete(staleLock.operationId);
      console.warn('[Race Condition Handler] Removed stale lock:', staleLock.operationId);
    }

    // Process queue after cleanup
    if (staleLocks.length > 0) {
      this.processLockQueue();
    }

    // Check for potential deadlocks in queue
    const queuedOperationsOverTimeout = this.lockQueue.filter(
      lock => now > lock.lockTimeout
    );

    for (const expiredQueuedLock of queuedOperationsOverTimeout) {
      this.removeLockFromQueue(expiredQueuedLock.operationId);
      console.warn('[Race Condition Handler] Removed expired queued operation:', expiredQueuedLock.operationId);
    }
  }

  /**
   * Log race condition for debugging and monitoring
   */
  private logRaceCondition(detection: RaceConditionDetection): void {
    console.warn('[Race Condition Handler] Race condition detected:', {
      conflictingOperations: detection.conflictingOperations.length,
      resolutionStrategy: detection.resolutionStrategy,
      conflictDuration: detection.conflictDuration,
      winningOperation: detection.winningOperation?.operationType,
      blockedOperations: detection.blockedOperations.length
    });
  }

  /**
   * Get current lock status
   */
  getLockStatus(): {
    activeLocks: number;
    queuedOperations: number;
    conflictHistory: number;
    lockTypes: Record<string, number>;
    averageConflictDuration: number;
  } {
    const lockTypes: Record<string, number> = {};
    for (const lock of Array.from(this.activeLocks.values())) {
      lockTypes[lock.operationType] = (lockTypes[lock.operationType] || 0) + 1;
    }

    const conflictDurations = this.conflictHistory.map(c => c.conflictDuration);
    const averageConflictDuration = conflictDurations.length > 0
      ? conflictDurations.reduce((a, b) => a + b, 0) / conflictDurations.length
      : 0;

    return {
      activeLocks: this.activeLocks.size,
      queuedOperations: this.lockQueue.length,
      conflictHistory: this.conflictHistory.length,
      lockTypes,
      averageConflictDuration
    };
  }

  /**
   * Force release all locks (emergency cleanup)
   */
  forceReleaseAllLocks(): void {
    console.warn('[Race Condition Handler] Force releasing all locks');
    this.activeLocks.clear();
    this.lockQueue.length = 0;
  }

  /**
   * Get conflict history for analysis
   */
  getConflictHistory(): RaceConditionDetection[] {
    return [...this.conflictHistory];
  }

  /**
   * Clear conflict history
   */
  clearConflictHistory(): void {
    this.conflictHistory = [];
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.deadlockDetectionTimer) {
      clearInterval(this.deadlockDetectionTimer);
      this.deadlockDetectionTimer = null;
    }
    
    this.forceReleaseAllLocks();
    this.clearConflictHistory();
  }
}