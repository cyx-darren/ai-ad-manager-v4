/**
 * Concurrent Update Handler
 * 
 * Handles detection and resolution of concurrent state updates using
 * version-based optimistic locking and conflict detection.
 */

export interface StateData {
  [key: string]: unknown;
}

export interface VersionedState<T = StateData> {
  version: number;
  lastModified: number;
  modifiedBy: string;
  data: T;
}

export interface UpdateContext {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  expectedVersion?: number;
  force?: boolean;
}

export interface ConflictInfo {
  id: string;
  type: 'version_mismatch' | 'concurrent_update' | 'timestamp_conflict';
  currentState: VersionedState;
  attemptedUpdate: UpdateContext;
  conflictingUpdate?: UpdateContext;
  canMerge: boolean;
  mergeStrategy?: string;
}

export interface MergeResult<T = StateData> {
  success: boolean;
  mergedData: T;
  conflicts: string[];
  warnings: string[];
}

export interface ConcurrentUpdateEventData {
  type: string;
  stateKey?: string;
  updateContext?: UpdateContext;
  conflictInfo?: ConflictInfo;
  timestamp: number;
  error?: Error;
}

/**
 * Concurrent Update Handler
 */
export class ConcurrentUpdateHandler {
  private stateVersions: Map<string, VersionedState> = new Map();
  private activeUpdates: Map<string, UpdateContext> = new Map();
  private conflictHistory: ConflictInfo[] = [];
  private eventListeners: Map<string, ((data: ConcurrentUpdateEventData) => void)[]> = new Map();

  /**
   * Initialize state with version tracking
   */
  initializeState<T = StateData>(key: string, initialData: T, source: string = 'system'): VersionedState<T> {
    const state: VersionedState = {
      version: 1,
      lastModified: Date.now(),
      modifiedBy: source,
      data: initialData
    };

    this.stateVersions.set(key, state);
    this.emitEvent('state_initialized', { key, state });

    return state;
  }

  /**
   * Get current state with version info
   */
  getVersionedState(key: string): VersionedState | null {
    return this.stateVersions.get(key) || null;
  }

  /**
   * Attempt to update state with concurrent update detection
   */
  async updateState<T = StateData>(
    key: string, 
    newData: T, 
    context: UpdateContext
  ): Promise<{ success: boolean; state?: VersionedState<T>; conflict?: ConflictInfo }> {
    
    const currentState = this.stateVersions.get(key);
    
    if (!currentState) {
      // State doesn't exist, initialize it
      const state = this.initializeState(key, newData, context.source);
      return { success: true, state };
    }

    // Check for version conflicts
    if (context.expectedVersion && context.expectedVersion !== currentState.version) {
      const conflict = this.createVersionConflict(key, currentState, context);
      this.recordConflict(conflict);
      
      if (!context.force) {
        this.emitEvent('version_conflict', conflict);
        return { success: false, conflict };
      }
    }

    // Check for concurrent updates
    const concurrentUpdate = this.detectConcurrentUpdate(key, context);
    if (concurrentUpdate) {
      const conflict = this.createConcurrentConflict(key, currentState, context, concurrentUpdate);
      this.recordConflict(conflict);

      // Try to merge if possible
      if (conflict.canMerge) {
        const mergeResult = await this.attemptMerge(currentState.data, newData, context.type);
        if (mergeResult.success) {
          return this.applyUpdate(key, mergeResult.mergedData, context);
        }
      }

      if (!context.force) {
        this.emitEvent('concurrent_conflict', conflict);
        return { success: false, conflict };
      }
    }

    // No conflicts or forced update - apply the change
    return this.applyUpdate(key, newData, context);
  }

  /**
   * Force update without conflict checking (use with caution)
   */
  forceUpdate<T = StateData>(key: string, newData: T, context: UpdateContext): VersionedState<T> {
    const result = this.applyUpdate(key, newData, { ...context, force: true });
    return result.state!;
  }

  /**
   * Get conflicts for a specific state key
   */
  getConflicts(key: string): ConflictInfo[] {
    return this.conflictHistory.filter(conflict => 
      conflict.currentState === this.stateVersions.get(key)
    );
  }

  /**
   * Clear conflict history
   */
  clearConflictHistory(): void {
    this.conflictHistory = [];
    this.emitEvent('conflicts_cleared', {});
  }

  /**
   * Check if state can be safely updated
   */
  canUpdate(key: string, expectedVersion?: number): boolean {
    const state = this.stateVersions.get(key);
    if (!state) return true;

    if (expectedVersion && expectedVersion !== state.version) {
      return false;
    }

    // Check for active concurrent updates
    const hasActiveConcurrentUpdate = Array.from(this.activeUpdates.values())
      .some(update => update.timestamp > state.lastModified - 1000); // 1 second window

    return !hasActiveConcurrentUpdate;
  }

  /**
   * Get update statistics
   */
  getStats(): {
    totalStates: number;
    totalConflicts: number;
    recentConflicts: number;
    averageVersion: number;
  } {
    const now = Date.now();
    const recentConflicts = this.conflictHistory.filter(
      conflict => (now - conflict.attemptedUpdate.timestamp) < 3600000 // 1 hour
    ).length;

    const versions = Array.from(this.stateVersions.values()).map(s => s.version);
    const averageVersion = versions.length > 0 
      ? versions.reduce((sum, v) => sum + v, 0) / versions.length 
      : 0;

    return {
      totalStates: this.stateVersions.size,
      totalConflicts: this.conflictHistory.length,
      recentConflicts,
      averageVersion
    };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (data: ConcurrentUpdateEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (data: ConcurrentUpdateEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private applyUpdate<T = StateData>(
    key: string, 
    newData: T, 
    context: UpdateContext
  ): { success: true; state: VersionedState<T> } {
    
    const currentState = this.stateVersions.get(key);
    const newVersion = currentState ? currentState.version + 1 : 1;

    const updatedState: VersionedState = {
      version: newVersion,
      lastModified: context.timestamp,
      modifiedBy: context.source,
      data: newData
    };

    this.stateVersions.set(key, updatedState);
    
    // Track the active update
    this.activeUpdates.set(context.id, context);
    
    // Clean up after a short delay
    setTimeout(() => {
      this.activeUpdates.delete(context.id);
    }, 5000);

    this.emitEvent('state_updated', { key, state: updatedState, context });

    return { success: true, state: updatedState };
  }

  private detectConcurrentUpdate(key: string, context: UpdateContext): UpdateContext | null {
    const recentThreshold = context.timestamp - 1000; // 1 second

    for (const [updateId, activeUpdate] of this.activeUpdates) {
      if (updateId !== context.id && 
          activeUpdate.timestamp >= recentThreshold &&
          Math.abs(activeUpdate.timestamp - context.timestamp) < 500) { // 500ms window
        return activeUpdate;
      }
    }

    return null;
  }

  private createVersionConflict(
    key: string, 
    currentState: VersionedState, 
    context: UpdateContext
  ): ConflictInfo {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'version_mismatch',
      currentState,
      attemptedUpdate: context,
      canMerge: false
    };
  }

  private createConcurrentConflict(
    key: string,
    currentState: VersionedState,
    context: UpdateContext,
    conflictingUpdate: UpdateContext
  ): ConflictInfo {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'concurrent_update',
      currentState,
      attemptedUpdate: context,
      conflictingUpdate,
      canMerge: this.canMergeUpdates(context, conflictingUpdate)
    };
  }

  private canMergeUpdates(update1: UpdateContext, update2: UpdateContext): boolean {
    // Simple heuristic: updates of the same type from different sources might be mergeable
    return update1.type === update2.type && update1.source !== update2.source;
  }

  private async attemptMerge<T = StateData>(
    currentData: T, 
    newData: T, 
    updateType: string
  ): Promise<MergeResult<T>> {
    try {
      // Implement specific merge strategies based on update type
      switch (updateType) {
        case 'filter':
          return this.mergeFilters(currentData, newData);
        case 'dateRange':
          return this.mergeDateRanges(currentData, newData);
        default:
          return this.defaultMerge(currentData, newData);
      }
    } catch (error) {
      return {
        success: false,
        mergedData: currentData,
        conflicts: [`Merge failed: ${error}`],
        warnings: []
      };
    }
  }

  private mergeFilters<T = StateData>(current: T, incoming: T): MergeResult<T> {
    const merged = { ...current };
    const conflicts: string[] = [];
    const warnings: string[] = [];

    // Merge traffic sources
    if (incoming.trafficSources) {
      const currentSources = new Set(current.trafficSources || []);
      const incomingSources = new Set(incoming.trafficSources);
      merged.trafficSources = [...new Set([...currentSources, ...incomingSources])];
      
      if (currentSources.size > 0 && incomingSources.size > 0) {
        warnings.push('Merged traffic sources from concurrent updates');
      }
    }

    // Merge device categories
    if (incoming.deviceCategories) {
      const currentCategories = new Set(current.deviceCategories || []);
      const incomingCategories = new Set(incoming.deviceCategories);
      merged.deviceCategories = [...new Set([...currentCategories, ...incomingCategories])];
    }

    // Handle Google Ads highlight conflict
    if (incoming.highlightGoogleAds !== undefined && 
        current.highlightGoogleAds !== incoming.highlightGoogleAds) {
      conflicts.push('Google Ads highlight setting conflict');
      // Use the most recent value (incoming)
      merged.highlightGoogleAds = incoming.highlightGoogleAds;
    }

    return {
      success: conflicts.length === 0,
      mergedData: merged,
      conflicts,
      warnings
    };
  }

  private mergeDateRanges<T = StateData>(current: T, incoming: T): MergeResult<T> {
    // Date ranges typically can't be merged - use the most recent
    return {
      success: true,
      mergedData: incoming, // Use incoming as it's more recent
      conflicts: [],
      warnings: ['Used most recent date range in conflict resolution']
    };
  }

  private defaultMerge<T = StateData>(current: T, incoming: T): MergeResult<T> {
    // Default strategy: shallow merge with incoming taking precedence
    const merged = { ...current, ...incoming };
    
    return {
      success: true,
      mergedData: merged,
      conflicts: [],
      warnings: ['Applied default merge strategy']
    };
  }

  private recordConflict(conflict: ConflictInfo): void {
    this.conflictHistory.push(conflict);
    
    // Keep only last 100 conflicts to prevent memory issues
    if (this.conflictHistory.length > 100) {
      this.conflictHistory = this.conflictHistory.slice(-100);
    }
  }

  private emitEvent(event: string, data: ConcurrentUpdateEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in concurrent update event listener:', error);
        }
      });
    }
  }
}

// Singleton instance for global use
export const concurrentUpdateHandler = new ConcurrentUpdateHandler();

export default concurrentUpdateHandler;