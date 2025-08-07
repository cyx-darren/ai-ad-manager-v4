/**
 * Conflict Resolution System
 * 
 * Provides strategies and mechanisms for resolving state conflicts
 * that arise from concurrent updates or race conditions.
 */

import { ConflictInfo, UpdateContext, VersionedState } from './concurrentUpdates';

export type ResolutionStrategy = 
  | 'last_writer_wins' 
  | 'first_writer_wins' 
  | 'merge_compatible' 
  | 'user_confirmation' 
  | 'priority_based'
  | 'rollback';

export interface ResolutionConfig {
  defaultStrategy: ResolutionStrategy;
  enableUserConfirmation: boolean;
  autoResolveSimple: boolean;
  priorityOrder: string[]; // source priority order
  mergeTimeout: number;
  maxRetries: number;
}

export interface ResolutionContext {
  conflict: ConflictInfo;
  strategy: ResolutionStrategy;
  userChoice?: 'accept' | 'reject' | 'merge';
  timestamp: number;
  resolvedBy: string;
}

export interface ResolutionResult {
  success: boolean;
  resolvedData: any;
  strategy: ResolutionStrategy;
  conflicts: string[];
  warnings: string[];
  requiresUserAction: boolean;
  rollbackData?: any;
}

/**
 * Conflict Resolution Manager
 */
export class ConflictResolutionManager {
  private config: ResolutionConfig;
  private pendingResolutions: Map<string, ResolutionContext> = new Map();
  private resolutionHistory: ResolutionContext[] = [];
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(config: Partial<ResolutionConfig> = {}) {
    this.config = {
      defaultStrategy: 'last_writer_wins',
      enableUserConfirmation: true,
      autoResolveSimple: true,
      priorityOrder: ['user', 'property-change', 'system', 'sync'],
      mergeTimeout: 30000, // 30 seconds
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  async resolveConflict(
    conflict: ConflictInfo,
    strategy?: ResolutionStrategy
  ): Promise<ResolutionResult> {
    
    const resolvedStrategy = strategy || this.determineStrategy(conflict);
    const context: ResolutionContext = {
      conflict,
      strategy: resolvedStrategy,
      timestamp: Date.now(),
      resolvedBy: 'system'
    };

    this.pendingResolutions.set(conflict.id, context);

    try {
      const result = await this.executeResolution(context);
      this.recordResolution(context);
      this.emitEvent('conflict_resolved', { context, result });
      
      return result;
    } catch (error) {
      this.emitEvent('resolution_failed', { context, error });
      throw error;
    } finally {
      this.pendingResolutions.delete(conflict.id);
    }
  }

  /**
   * Determine the best resolution strategy for a conflict
   */
  determineStrategy(conflict: ConflictInfo): ResolutionStrategy {
    // Check if it's a simple conflict that can be auto-resolved
    if (this.config.autoResolveSimple && this.isSimpleConflict(conflict)) {
      return 'last_writer_wins';
    }

    // Check if merge is possible and recommended
    if (conflict.canMerge && conflict.type === 'concurrent_update') {
      return 'merge_compatible';
    }

    // Use priority-based resolution if sources have different priorities
    if (this.hasPriorityDifference(conflict)) {
      return 'priority_based';
    }

    // For complex conflicts, use user confirmation if enabled
    if (this.config.enableUserConfirmation && this.isComplexConflict(conflict)) {
      return 'user_confirmation';
    }

    return this.config.defaultStrategy;
  }

  /**
   * Get pending resolutions (for user interface)
   */
  getPendingResolutions(): ResolutionContext[] {
    return Array.from(this.pendingResolutions.values());
  }

  /**
   * Manually resolve a conflict with user input
   */
  async resolveWithUserChoice(
    conflictId: string,
    choice: 'accept' | 'reject' | 'merge'
  ): Promise<ResolutionResult> {
    
    const context = this.pendingResolutions.get(conflictId);
    if (!context) {
      throw new Error(`Conflict ${conflictId} not found in pending resolutions`);
    }

    context.userChoice = choice;
    context.resolvedBy = 'user';
    context.strategy = 'user_confirmation';

    return this.executeResolution(context);
  }

  /**
   * Cancel a pending resolution
   */
  cancelResolution(conflictId: string): boolean {
    const context = this.pendingResolutions.get(conflictId);
    if (context) {
      this.pendingResolutions.delete(conflictId);
      this.emitEvent('resolution_cancelled', { context });
      return true;
    }
    return false;
  }

  /**
   * Get resolution statistics
   */
  getStats(): {
    totalResolutions: number;
    successfulResolutions: number;
    pendingResolutions: number;
    byStrategy: Record<ResolutionStrategy, number>;
    averageResolutionTime: number;
  } {
    const byStrategy: Record<ResolutionStrategy, number> = {
      last_writer_wins: 0,
      first_writer_wins: 0,
      merge_compatible: 0,
      user_confirmation: 0,
      priority_based: 0,
      rollback: 0
    };

    let totalTime = 0;
    let successCount = 0;

    this.resolutionHistory.forEach(resolution => {
      byStrategy[resolution.strategy]++;
      // Assume successful if recorded in history
      successCount++;
      totalTime += 100; // Placeholder timing
    });

    return {
      totalResolutions: this.resolutionHistory.length,
      successfulResolutions: successCount,
      pendingResolutions: this.pendingResolutions.size,
      byStrategy,
      averageResolutionTime: successCount > 0 ? totalTime / successCount : 0
    };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private async executeResolution(context: ResolutionContext): Promise<ResolutionResult> {
    const { conflict, strategy, userChoice } = context;

    switch (strategy) {
      case 'last_writer_wins':
        return this.resolveLastWriterWins(conflict);
      
      case 'first_writer_wins':
        return this.resolveFirstWriterWins(conflict);
      
      case 'merge_compatible':
        return this.resolveMergeCompatible(conflict);
      
      case 'priority_based':
        return this.resolvePriorityBased(conflict);
      
      case 'user_confirmation':
        return this.resolveUserConfirmation(conflict, userChoice);
      
      case 'rollback':
        return this.resolveRollback(conflict);
      
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  private resolveLastWriterWins(conflict: ConflictInfo): ResolutionResult {
    // Use the attempted update (more recent)
    return {
      success: true,
      resolvedData: conflict.attemptedUpdate,
      strategy: 'last_writer_wins',
      conflicts: [],
      warnings: ['Applied last writer wins strategy'],
      requiresUserAction: false
    };
  }

  private resolveFirstWriterWins(conflict: ConflictInfo): ResolutionResult {
    // Use the current state (first writer)
    return {
      success: true,
      resolvedData: conflict.currentState.data,
      strategy: 'first_writer_wins',
      conflicts: [],
      warnings: ['Applied first writer wins strategy'],
      requiresUserAction: false
    };
  }

  private async resolveMergeCompatible(conflict: ConflictInfo): Promise<ResolutionResult> {
    if (!conflict.canMerge) {
      // Fall back to last writer wins
      return this.resolveLastWriterWins(conflict);
    }

    try {
      // Attempt to merge the data
      const merged = await this.mergeConflictingData(
        conflict.currentState.data,
        conflict.attemptedUpdate
      );

      return {
        success: true,
        resolvedData: merged.data,
        strategy: 'merge_compatible',
        conflicts: merged.conflicts,
        warnings: merged.warnings,
        requiresUserAction: false
      };
    } catch (error) {
      return {
        success: false,
        resolvedData: conflict.currentState.data,
        strategy: 'merge_compatible',
        conflicts: [`Merge failed: ${error}`],
        warnings: [],
        requiresUserAction: true
      };
    }
  }

  private resolvePriorityBased(conflict: ConflictInfo): ResolutionResult {
    const currentPriority = this.getSourcePriority(conflict.currentState.modifiedBy);
    const attemptedPriority = this.getSourcePriority(conflict.attemptedUpdate.source);

    if (attemptedPriority < currentPriority) {
      // Attempted update has higher priority
      return {
        success: true,
        resolvedData: conflict.attemptedUpdate,
        strategy: 'priority_based',
        conflicts: [],
        warnings: [`Used ${conflict.attemptedUpdate.source} update (higher priority)`],
        requiresUserAction: false
      };
    } else {
      // Current state has higher priority
      return {
        success: true,
        resolvedData: conflict.currentState.data,
        strategy: 'priority_based',
        conflicts: [],
        warnings: [`Kept ${conflict.currentState.modifiedBy} update (higher priority)`],
        requiresUserAction: false
      };
    }
  }

  private resolveUserConfirmation(
    conflict: ConflictInfo, 
    userChoice?: 'accept' | 'reject' | 'merge'
  ): ResolutionResult {
    
    if (!userChoice) {
      return {
        success: false,
        resolvedData: conflict.currentState.data,
        strategy: 'user_confirmation',
        conflicts: [],
        warnings: [],
        requiresUserAction: true
      };
    }

    switch (userChoice) {
      case 'accept':
        return {
          success: true,
          resolvedData: conflict.attemptedUpdate,
          strategy: 'user_confirmation',
          conflicts: [],
          warnings: ['User accepted the new update'],
          requiresUserAction: false
        };
      
      case 'reject':
        return {
          success: true,
          resolvedData: conflict.currentState.data,
          strategy: 'user_confirmation',
          conflicts: [],
          warnings: ['User rejected the new update'],
          requiresUserAction: false
        };
      
      case 'merge':
        // Attempt merge or fall back to accept
        if (conflict.canMerge) {
          return this.resolveMergeCompatible(conflict);
        } else {
          return this.resolveLastWriterWins(conflict);
        }
      
      default:
        throw new Error(`Invalid user choice: ${userChoice}`);
    }
  }

  private resolveRollback(conflict: ConflictInfo): ResolutionResult {
    // Roll back to a previous known good state
    return {
      success: true,
      resolvedData: conflict.currentState.data,
      strategy: 'rollback',
      conflicts: [],
      warnings: ['Rolled back to previous state'],
      requiresUserAction: false,
      rollbackData: conflict.currentState.data
    };
  }

  private async mergeConflictingData(currentData: any, update: UpdateContext): Promise<{
    data: any;
    conflicts: string[];
    warnings: string[];
  }> {
    // Implement type-specific merge logic
    switch (update.type) {
      case 'filter':
        return this.mergeFilterData(currentData, update);
      case 'dateRange':
        return this.mergeDateRangeData(currentData, update);
      default:
        return this.defaultMerge(currentData, update);
    }
  }

  private mergeFilterData(current: any, update: UpdateContext): {
    data: any;
    conflicts: string[];
    warnings: string[];
  } {
    const merged = { ...current };
    const conflicts: string[] = [];
    const warnings: string[] = [];

    // Simple merge strategy - combine arrays, use latest for booleans
    if (update.payload) {
      Object.keys(update.payload).forEach(key => {
        if (Array.isArray(current[key]) && Array.isArray(update.payload[key])) {
          merged[key] = [...new Set([...current[key], ...update.payload[key]])];
          warnings.push(`Merged ${key} arrays`);
        } else if (current[key] !== update.payload[key]) {
          merged[key] = update.payload[key];
          warnings.push(`Used new value for ${key}`);
        }
      });
    }

    return { data: merged, conflicts, warnings };
  }

  private mergeDateRangeData(current: any, update: UpdateContext): {
    data: any;
    conflicts: string[];
    warnings: string[];
  } {
    // Date ranges typically can't be meaningfully merged
    return {
      data: update.payload || current,
      conflicts: [],
      warnings: ['Used most recent date range']
    };
  }

  private defaultMerge(current: any, update: UpdateContext): {
    data: any;
    conflicts: string[];
    warnings: string[];
  } {
    return {
      data: { ...current, ...(update.payload || {}) },
      conflicts: [],
      warnings: ['Applied default merge strategy']
    };
  }

  private isSimpleConflict(conflict: ConflictInfo): boolean {
    // Simple conflicts are version mismatches with small time differences
    return conflict.type === 'version_mismatch' && 
           !conflict.conflictingUpdate;
  }

  private isComplexConflict(conflict: ConflictInfo): boolean {
    // Complex conflicts involve concurrent updates or multiple conflicting changes
    return conflict.type === 'concurrent_update' && 
           conflict.conflictingUpdate !== undefined;
  }

  private hasPriorityDifference(conflict: ConflictInfo): boolean {
    const currentPriority = this.getSourcePriority(conflict.currentState.modifiedBy);
    const attemptedPriority = this.getSourcePriority(conflict.attemptedUpdate.source);
    return currentPriority !== attemptedPriority;
  }

  private getSourcePriority(source: string): number {
    const index = this.config.priorityOrder.indexOf(source);
    return index === -1 ? this.config.priorityOrder.length : index;
  }

  private recordResolution(context: ResolutionContext): void {
    this.resolutionHistory.push(context);
    
    // Keep only last 100 resolutions to prevent memory issues
    if (this.resolutionHistory.length > 100) {
      this.resolutionHistory = this.resolutionHistory.slice(-100);
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in conflict resolution event listener:', error);
        }
      });
    }
  }
}

// Singleton instance for global use
export const conflictResolutionManager = new ConflictResolutionManager();

export default conflictResolutionManager;