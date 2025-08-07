/**
 * State Update Queue Manager
 * 
 * Provides centralized queuing system for state updates to prevent race conditions
 * and ensure sequential processing of concurrent updates.
 */

export type UpdatePriority = 'low' | 'normal' | 'high' | 'critical' | 'immediate';

export interface StateUpdatePayload {
  [key: string]: unknown;
}

export interface StateUpdate<T = StateUpdatePayload> {
  id: string;
  type: 'dateRange' | 'filter' | 'property' | 'data' | 'ui';
  priority: UpdatePriority;
  payload: T;
  source: 'user' | 'system' | 'sync' | 'property-change' | 'api';
  timestamp: number;
  version?: number;
  retryCount: number;
  maxRetries: number;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface QueueConfig {
  maxConcurrentUpdates: number;
  enableBatching: boolean;
  batchTimeout: number;
  retryDelay: number;
  maxRetryDelay: number;
  enableLogging: boolean;
}

export interface QueueStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  cancelledUpdates: number;
  averageProcessingTime: number;
  currentQueueSize: number;
  isProcessing: boolean;
}

export interface QueueEventData {
  type: string;
  updateId?: string;
  priority?: UpdatePriority;
  payload?: StateUpdatePayload;
  timestamp: number;
  error?: Error;
}

/**
 * State Update Queue Manager
 */
export class StateUpdateQueue {
  private config: QueueConfig;
  private updateQueue: StateUpdate[] = [];
  private processingQueue: StateUpdate[] = [];
  private isProcessing = false;
  private eventListeners: Map<string, ((data: QueueEventData) => void)[]> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrentUpdates: 3,
      enableBatching: true,
      batchTimeout: 100, // ms
      retryDelay: 1000, // ms
      maxRetryDelay: 10000, // ms
      enableLogging: true,
      ...config
    };
  }

  /**
   * Add update to queue
   */
  enqueue(update: Omit<StateUpdate, 'id' | 'timestamp' | 'retryCount'>): string {
    const queuedUpdate: StateUpdate = {
      id: this.generateUpdateId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      ...update
    };

    // Insert update in priority order
    this.insertByPriority(queuedUpdate);
    
    this.stats.currentQueueSize = this.queue.length;
    this.stats.totalUpdates++;

    this.emitEvent('enqueued', queuedUpdate);

    if (this.config.enableLogging) {
      console.log(`📥 Queued update ${queuedUpdate.id} (${queuedUpdate.type}, ${queuedUpdate.priority})`);
    }

    // Start processing if not already running
    this.processQueue();

    return queuedUpdate.id;
  }

  /**
   * Cancel update by ID
   */
  cancel(updateId: string): boolean {
    // Remove from queue if not yet processing
    const queueIndex = this.queue.findIndex(update => update.id === updateId);
    if (queueIndex !== -1) {
      const cancelled = this.queue.splice(queueIndex, 1)[0];
      this.stats.cancelledUpdates++;
      this.stats.currentQueueSize = this.queue.length;
      
      if (cancelled.onCancel) {
        cancelled.onCancel();
      }

      this.emitEvent('cancelled', cancelled);

      if (this.config.enableLogging) {
        console.log(`❌ Cancelled update ${updateId}`);
      }

      return true;
    }

    // Cannot cancel if already processing
    return false;
  }

  /**
   * Cancel all updates of a specific type
   */
  cancelByType(type: StateUpdate['type']): number {
    const cancelled = this.queue.filter(update => update.type === type);
    this.queue = this.queue.filter(update => update.type !== type);
    
    this.stats.cancelledUpdates += cancelled.length;
    this.stats.currentQueueSize = this.queue.length;

    cancelled.forEach(update => {
      if (update.onCancel) {
        update.onCancel();
      }
      this.emitEvent('cancelled', update);
    });

    if (this.config.enableLogging && cancelled.length > 0) {
      console.log(`❌ Cancelled ${cancelled.length} updates of type ${type}`);
    }

    return cancelled.length;
  }

  /**
   * Get current queue status
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Clear entire queue
   */
  clear(): void {
    const cancelled = [...this.queue];
    this.queue = [];
    this.stats.cancelledUpdates += cancelled.length;
    this.stats.currentQueueSize = 0;

    cancelled.forEach(update => {
      if (update.onCancel) {
        update.onCancel();
      }
      this.emitEvent('cancelled', update);
    });

    if (this.config.enableLogging) {
      console.log(`🗑️ Cleared queue (${cancelled.length} updates cancelled)`);
    }
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.stats.isProcessing = false;
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.emitEvent('paused', {});
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.processQueue();
    this.emitEvent('resumed', {});
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (data: QueueEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (data: QueueEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private async processQueue(): Promise<void> {
    if (this.stats.isProcessing) return;
    
    this.stats.isProcessing = true;

    while (this.queue.length > 0 && this.processing.size < this.config.maxConcurrentUpdates) {
      const update = this.queue.shift()!;
      this.stats.currentQueueSize = this.queue.length;
      
      // Check if we should batch this update
      if (this.config.enableBatching && this.shouldBatchUpdate(update)) {
        this.scheduleBatch(update);
        continue;
      }

      this.processUpdate(update);
    }

    // Check if queue is empty and no updates are processing
    if (this.queue.length === 0 && this.processing.size === 0) {
      this.stats.isProcessing = false;
      this.emitEvent('idle', {});
    }
  }

  private async processUpdate(update: StateUpdate): Promise<void> {
    this.processing.add(update.id);
    const startTime = Date.now();

    try {
      this.emitEvent('processing', update);

      if (this.config.enableLogging) {
        console.log(`⚡ Processing update ${update.id} (${update.type})`);
      }

      // Execute the update (this would be implemented by the specific managers)
      const result = await this.executeUpdate(update);

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      this.stats.successfulUpdates++;
      
      if (update.onSuccess) {
        update.onSuccess(result);
      }

      this.emitEvent('success', { update, result, processingTime });

      if (this.config.enableLogging) {
        console.log(`✅ Completed update ${update.id} in ${processingTime}ms`);
      }

    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`❌ Failed update ${update.id}:`, error);
      }

      // Retry logic
      if (update.retryCount < update.maxRetries) {
        update.retryCount++;
        const retryDelay = Math.min(
          this.config.retryDelay * Math.pow(2, update.retryCount - 1),
          this.config.maxRetryDelay
        );

        setTimeout(() => {
          this.queue.unshift(update); // Put back at front with higher priority
          this.processQueue();
        }, retryDelay);

        this.emitEvent('retry', { update, error, retryDelay });

        if (this.config.enableLogging) {
          console.log(`🔄 Retrying update ${update.id} in ${retryDelay}ms (attempt ${update.retryCount}/${update.maxRetries})`);
        }

      } else {
        this.stats.failedUpdates++;
        
        if (update.onError) {
          update.onError(error);
        }

        this.emitEvent('error', { update, error });
      }
    } finally {
      this.processing.delete(update.id);
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private shouldBatchUpdate(update: StateUpdate): boolean {
    if (!this.config.enableBatching) return false;
    
    // Only batch certain types of updates
    const batchableTypes: StateUpdate['type'][] = ['filter', 'ui'];
    return batchableTypes.includes(update.type);
  }

  private scheduleBatch(update: StateUpdate): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);

    // Add to a temporary batch queue (for simplicity, we'll process immediately)
    this.processUpdate(update);
  }

  private processBatch(): void {
    // Batch processing logic would go here
    // For now, we'll just continue normal processing
    this.processQueue();
  }

  private async executeUpdate(update: StateUpdate): Promise<any> {
    // This is a placeholder - actual execution would be handled by specific managers
    // (dateRangeSyncManager, filterSyncManager, etc.)
    
    return new Promise((resolve) => {
      // Simulate async update
      setTimeout(() => {
        resolve({ success: true, updateId: update.id });
      }, Math.random() * 50 + 10); // 10-60ms
    });
  }

  private insertByPriority(update: StateUpdate): void {
    const priorityOrder: UpdatePriority[] = ['immediate', 'critical', 'high', 'normal', 'low'];
    const updatePriorityIndex = priorityOrder.indexOf(update.priority);

    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      const queuedPriorityIndex = priorityOrder.indexOf(this.queue[i].priority);
      
      if (updatePriorityIndex < queuedPriorityIndex) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, update);
  }

  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAverageProcessingTime(newTime: number): void {
    const totalSuccessful = this.stats.successfulUpdates;
    if (totalSuccessful === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (totalSuccessful - 1) + newTime) / totalSuccessful;
    }
  }

  private emitEvent(event: string, data: QueueEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in queue event listener:', error);
        }
      });
    }
  }
}

// Singleton instance for global use
export const stateUpdateQueue = new StateUpdateQueue();

export default stateUpdateQueue;