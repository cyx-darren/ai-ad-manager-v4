/**
 * Update Batcher for React State Management
 * Provides intelligent update batching, coalescing, and debouncing for optimal performance
 */

export interface UpdateBatch {
  id: string;
  updates: StateUpdate[];
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
  scheduledAt: number;
  maxWaitTime: number;
  cancelled: boolean;
}

export interface StateUpdate {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  source: string;
  dependencies: string[];
  coalesceKey?: string; // Key for coalescing similar updates
}

export interface UpdateBatchConfig {
  enableBatching: boolean;
  enableCoalescing: boolean;
  enableDebouncing: boolean;
  batchSize: number;
  batchTimeout: number; // milliseconds
  debounceDelay: number; // milliseconds
  priorityWeights: {
    high: number;
    normal: number;
    low: number;
  };
  maxBatchAge: number; // milliseconds
}

export interface BatchStats {
  totalBatches: number;
  processedUpdates: number;
  coalescedUpdates: number;
  cancelledBatches: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  pendingBatches: number;
}

export interface UpdateResult {
  success: boolean;
  batchId: string;
  updatesProcessed: number;
  updatesCoalesced: number;
  processingTime: number;
  errors: Error[];
}

export class UpdateBatcher {
  private static instance: UpdateBatcher | null = null;
  private config: UpdateBatchConfig;
  private pendingBatches: Map<string, UpdateBatch>;
  private processingQueue: UpdateBatch[];
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private coalescingMap: Map<string, StateUpdate>;
  private stats: BatchStats;
  private batchCounter: number;
  private isProcessing: boolean;

  constructor(config: Partial<UpdateBatchConfig> = {}) {
    this.config = {
      enableBatching: true,
      enableCoalescing: true,
      enableDebouncing: true,
      batchSize: 10,
      batchTimeout: 50, // 50ms
      debounceDelay: 100, // 100ms
      priorityWeights: {
        high: 10,
        normal: 5,
        low: 1
      },
      maxBatchAge: 1000, // 1 second
      ...config
    };

    this.pendingBatches = new Map();
    this.processingQueue = [];
    this.debounceTimers = new Map();
    this.coalescingMap = new Map();
    this.batchCounter = 0;
    this.isProcessing = false;

    this.stats = {
      totalBatches: 0,
      processedUpdates: 0,
      coalescedUpdates: 0,
      cancelledBatches: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      pendingBatches: 0
    };

    this.startBatchProcessor();
  }

  public static getInstance(config?: Partial<UpdateBatchConfig>): UpdateBatcher {
    if (!UpdateBatcher.instance) {
      UpdateBatcher.instance = new UpdateBatcher(config);
    }
    return UpdateBatcher.instance;
  }

  /**
   * Add a state update to the batching system
   */
  public batchUpdates(
    updates: StateUpdate | StateUpdate[],
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<UpdateResult> {
    if (!this.config.enableBatching) {
      return this.processImmediately(Array.isArray(updates) ? updates : [updates]);
    }

    const updateArray = Array.isArray(updates) ? updates : [updates];
    
    return new Promise((resolve) => {
      // Apply coalescing if enabled
      const coalescedUpdates = this.config.enableCoalescing 
        ? this.coalesceUpdates(updateArray)
        : updateArray;

      // Apply debouncing if enabled
      if (this.config.enableDebouncing) {
        this.debounceUpdates(coalescedUpdates, priority, resolve);
      } else {
        this.addToBatch(coalescedUpdates, priority, resolve);
      }
    });
  }

  /**
   * Coalesce similar updates to reduce redundancy
   */
  public coalesceUpdates(updates: StateUpdate[]): StateUpdate[] {
    if (!this.config.enableCoalescing) {
      return updates;
    }

    const coalesceMap = new Map<string, StateUpdate>();
    let coalescedCount = 0;

    updates.forEach((update) => {
      const coalesceKey = update.coalesceKey || `${update.type}-${update.source}`;
      
      if (coalesceMap.has(coalesceKey)) {
        // Coalesce with existing update
        const existing = coalesceMap.get(coalesceKey)!;
        const merged = this.mergeUpdates(existing, update);
        coalesceMap.set(coalesceKey, merged);
        coalescedCount++;
      } else {
        coalesceMap.set(coalesceKey, update);
      }
    });

    this.stats.coalescedUpdates += coalescedCount;
    
    const result = Array.from(coalesceMap.values());
    if (coalescedCount > 0) {
      console.log(`🔄 Coalesced ${coalescedCount} updates, reduced from ${updates.length} to ${result.length}`);
    }

    return result;
  }

  /**
   * Schedule a batch for processing
   */
  public scheduleBatch(batchId: string, delay: number = 0): void {
    const batch = this.pendingBatches.get(batchId);
    if (!batch || batch.cancelled) {
      return;
    }

    setTimeout(() => {
      if (!batch.cancelled && this.pendingBatches.has(batchId)) {
        this.moveBatchToProcessingQueue(batchId);
      }
    }, delay);
  }

  /**
   * Cancel a pending batch
   */
  public cancelBatch(batchId: string): boolean {
    const batch = this.pendingBatches.get(batchId);
    if (batch && !batch.cancelled) {
      batch.cancelled = true;
      this.pendingBatches.delete(batchId);
      this.stats.cancelledBatches++;
      console.log(`❌ Cancelled batch ${batchId}`);
      return true;
    }
    return false;
  }

  /**
   * Optimize batch size based on current system load
   */
  public optimizeBatchSize(): number {
    const currentLoad = this.getCurrentSystemLoad();
    const baseSize = this.config.batchSize;

    if (currentLoad > 0.8) {
      // High load - reduce batch size
      return Math.max(1, Math.floor(baseSize * 0.5));
    } else if (currentLoad < 0.3) {
      // Low load - increase batch size
      return Math.floor(baseSize * 1.5);
    }

    return baseSize;
  }

  /**
   * Split large batches into smaller ones
   */
  public splitBatch(batch: UpdateBatch, targetSize: number): UpdateBatch[] {
    if (batch.updates.length <= targetSize) {
      return [batch];
    }

    const splits: UpdateBatch[] = [];
    const updates = [...batch.updates];

    while (updates.length > 0) {
      const chunk = updates.splice(0, targetSize);
      const splitBatch: UpdateBatch = {
        id: `${batch.id}-split-${splits.length + 1}`,
        updates: chunk,
        priority: batch.priority,
        createdAt: batch.createdAt,
        scheduledAt: Date.now(),
        maxWaitTime: batch.maxWaitTime,
        cancelled: false
      };
      splits.push(splitBatch);
    }

    console.log(`✂️ Split batch ${batch.id} into ${splits.length} smaller batches`);
    return splits;
  }

  /**
   * Get current batching statistics
   */
  public getStats(): BatchStats {
    this.stats.pendingBatches = this.pendingBatches.size;
    return { ...this.stats };
  }

  /**
   * Reset batching statistics
   */
  public resetStats(): void {
    this.stats = {
      totalBatches: 0,
      processedUpdates: 0,
      coalescedUpdates: 0,
      cancelledBatches: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      pendingBatches: 0
    };
    console.log('📊 Batch statistics reset');
  }

  /**
   * Clean up timers and resources
   */
  public cleanup(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.debounceTimers.clear();

    // Clear pending batches
    this.pendingBatches.clear();
    this.processingQueue.length = 0;
    this.coalescingMap.clear();

    console.log('🧹 Update batcher cleaned up');
  }

  // Private methods

  private addToBatch(
    updates: StateUpdate[],
    priority: 'high' | 'normal' | 'low',
    resolve: (result: UpdateResult) => void
  ): void {
    const batchId = `batch-${++this.batchCounter}`;
    const now = Date.now();

    const batch: UpdateBatch = {
      id: batchId,
      updates,
      priority,
      createdAt: now,
      scheduledAt: now + this.config.batchTimeout,
      maxWaitTime: this.config.maxBatchAge,
      cancelled: false
    };

    // Store the resolve function with the batch
    (batch as any).resolver = resolve;

    this.pendingBatches.set(batchId, batch);

    // Schedule the batch for processing
    this.scheduleBatch(batchId, this.config.batchTimeout);

    console.log(`📦 Created batch ${batchId} with ${updates.length} updates (${priority} priority)`);
  }

  private debounceUpdates(
    updates: StateUpdate[],
    priority: 'high' | 'normal' | 'low',
    resolve: (result: UpdateResult) => void
  ): void {
    const debounceKey = `${priority}-${updates.map(u => u.type).join('-')}`;
    
    // Clear existing debounce timer
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      this.addToBatch(updates, priority, resolve);
    }, this.config.debounceDelay);

    this.debounceTimers.set(debounceKey, timer);
  }

  private mergeUpdates(existing: StateUpdate, incoming: StateUpdate): StateUpdate {
    // Simple merge strategy - override with incoming data
    // Can be enhanced with more sophisticated merging logic
    return {
      ...existing,
      data: { ...existing.data, ...incoming.data },
      timestamp: incoming.timestamp,
      dependencies: [...new Set([...existing.dependencies, ...incoming.dependencies])]
    };
  }

  private moveBatchToProcessingQueue(batchId: string): void {
    const batch = this.pendingBatches.get(batchId);
    if (batch && !batch.cancelled) {
      this.pendingBatches.delete(batchId);
      this.processingQueue.push(batch);
      this.processingQueue.sort((a, b) => {
        // Sort by priority and age
        const priorityDiff = this.config.priorityWeights[b.priority] - this.config.priorityWeights[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt; // Older batches first
      });
    }
  }

  private startBatchProcessor(): void {
    const processNextBatch = () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        this.isProcessing = true;
        const batch = this.processingQueue.shift()!;
        this.processBatch(batch);
      }

      // Continue processing
      setTimeout(processNextBatch, 10); // Check every 10ms
    };

    processNextBatch();
  }

  private async processBatch(batch: UpdateBatch): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log(`⚙️ Processing batch ${batch.id} with ${batch.updates.length} updates`);

      // Check if batch is too old
      const age = Date.now() - batch.createdAt;
      if (age > batch.maxWaitTime) {
        console.warn(`⏰ Batch ${batch.id} expired (${age}ms old)`);
        this.handleBatchResult(batch, {
          success: false,
          batchId: batch.id,
          updatesProcessed: 0,
          updatesCoalesced: 0,
          processingTime: 0,
          errors: [new Error('Batch expired')]
        });
        return;
      }

      // Optimize batch size if needed
      const optimizedSize = this.optimizeBatchSize();
      const batches = batch.updates.length > optimizedSize 
        ? this.splitBatch(batch, optimizedSize)
        : [batch];

      // Process all batch splits
      let totalProcessed = 0;
      const errors: Error[] = [];

      for (const splitBatch of batches) {
        try {
          await this.executeBatchUpdates(splitBatch.updates);
          totalProcessed += splitBatch.updates.length;
        } catch (error) {
          errors.push(error as Error);
        }
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Update statistics
      this.updateStats(batch, processingTime);

      // Resolve the batch
      this.handleBatchResult(batch, {
        success: errors.length === 0,
        batchId: batch.id,
        updatesProcessed: totalProcessed,
        updatesCoalesced: batch.updates.length - totalProcessed,
        processingTime,
        errors
      });

    } catch (error) {
      console.error(`❌ Error processing batch ${batch.id}:`, error);
      this.handleBatchResult(batch, {
        success: false,
        batchId: batch.id,
        updatesProcessed: 0,
        updatesCoalesced: 0,
        processingTime: performance.now() - startTime,
        errors: [error as Error]
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeBatchUpdates(updates: StateUpdate[]): Promise<void> {
    // This would integrate with the actual state management system
    // For now, we'll simulate the processing
    return new Promise((resolve) => {
      // Use microtask for better performance
      queueMicrotask(() => {
        updates.forEach((update) => {
          // Simulate update processing
          console.log(`🔄 Processing update: ${update.type} from ${update.source}`);
        });
        resolve();
      });
    });
  }

  private handleBatchResult(batch: UpdateBatch, result: UpdateResult): void {
    const resolver = (batch as any).resolver;
    if (resolver) {
      resolver(result);
    }
  }

  private updateStats(batch: UpdateBatch, processingTime: number): void {
    this.stats.totalBatches++;
    this.stats.processedUpdates += batch.updates.length;
    
    // Update averages
    const totalBatches = this.stats.totalBatches;
    this.stats.averageBatchSize = 
      (this.stats.averageBatchSize * (totalBatches - 1) + batch.updates.length) / totalBatches;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (totalBatches - 1) + processingTime) / totalBatches;
  }

  private getCurrentSystemLoad(): number {
    // Simple load estimation based on pending work
    const pendingWork = this.pendingBatches.size + this.processingQueue.length;
    const maxWork = 20; // Arbitrary threshold
    return Math.min(pendingWork / maxWork, 1);
  }

  private async processImmediately(updates: StateUpdate[]): Promise<UpdateResult> {
    const startTime = performance.now();
    
    try {
      await this.executeBatchUpdates(updates);
      return {
        success: true,
        batchId: 'immediate',
        updatesProcessed: updates.length,
        updatesCoalesced: 0,
        processingTime: performance.now() - startTime,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        batchId: 'immediate',
        updatesProcessed: 0,
        updatesCoalesced: 0,
        processingTime: performance.now() - startTime,
        errors: [error as Error]
      };
    }
  }
}

// Singleton instance
export const updateBatcher = UpdateBatcher.getInstance();

// Export types for external use
export type {
  UpdateBatch,
  StateUpdate,
  UpdateBatchConfig,
  BatchStats,
  UpdateResult
};