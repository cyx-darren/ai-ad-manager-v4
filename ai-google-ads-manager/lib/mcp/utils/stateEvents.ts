/**
 * State Change Event System
 * 
 * Advanced pub/sub event system for efficient state change distribution
 * across MCP components with intelligent batching and filtering.
 */

export interface StateChangeEvent {
  id: string;
  type: 'state_change' | 'component_mount' | 'component_unmount' | 'dependency_change' | 'error';
  topic: string;
  source: string;
  target?: string;
  timestamp: number;
  data: any;
  metadata: {
    priority: 'low' | 'normal' | 'high' | 'critical';
    batch?: string;
    sequence?: number;
    retry?: number;
  };
}

export interface EventSubscription {
  id: string;
  topic: string;
  callback: (event: StateChangeEvent) => void;
  filter?: (event: StateChangeEvent) => boolean;
  options: {
    once: boolean;
    priority: number;
    debounceMs?: number;
    throttleMs?: number;
    batchSize?: number;
  };
  metadata: {
    subscribedAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
    componentId?: string;
  };
}

export interface EventBatch {
  id: string;
  topic: string;
  events: StateChangeEvent[];
  createdAt: Date;
  maxSize: number;
  timeout: number;
  timer?: NodeJS.Timeout;
}

export interface EventReplay {
  topic: string;
  maxEvents: number;
  maxAge: number; // milliseconds
  enabled: boolean;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  totalSubscriptions: number;
  subscriptionsByTopic: Record<string, number>;
  averageEventLatency: number;
  batchedEvents: number;
  replayEvents: number;
}

/**
 * State Change Event Manager
 */
export class StateChangeEventManager {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: StateChangeEvent[] = [];
  private batches: Map<string, EventBatch> = new Map();
  private replayConfigs: Map<string, EventReplay> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventQueue: StateChangeEvent[] = [];
  private processingQueue = false;
  private stats: EventStats = {
    totalEvents: 0,
    eventsByType: {},
    totalSubscriptions: 0,
    subscriptionsByTopic: {},
    averageEventLatency: 0,
    batchedEvents: 0,
    replayEvents: 0
  };

  constructor() {
    this.initializeQueueProcessor();
  }

  /**
   * Subscribe to events on a topic
   */
  subscribe(
    topic: string,
    callback: (event: StateChangeEvent) => void,
    options: Partial<EventSubscription['options']> = {},
    filter?: (event: StateChangeEvent) => boolean
  ): string {
    
    const subscription: EventSubscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic,
      callback,
      filter,
      options: {
        once: false,
        priority: 0,
        ...options
      },
      metadata: {
        subscribedAt: new Date(),
        triggerCount: 0
      }
    };

    this.subscriptions.set(subscription.id, subscription);
    this.updateSubscriptionStats(topic, 1);

    // Send replay events if enabled for this topic
    if (this.replayConfigs.has(topic)) {
      this.sendReplayEvents(subscription);
    }

    console.log(`📡 Subscribed to '${topic}' (${subscription.id})`);

    return subscription.id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Clean up timers
    this.cleanupSubscriptionTimers(subscriptionId);

    this.subscriptions.delete(subscriptionId);
    this.updateSubscriptionStats(subscription.topic, -1);

    console.log(`📡 Unsubscribed from '${subscription.topic}' (${subscriptionId})`);

    return true;
  }

  /**
   * Publish an event
   */
  publish(
    topic: string,
    data: any,
    source: string,
    type: StateChangeEvent['type'] = 'state_change',
    priority: StateChangeEvent['metadata']['priority'] = 'normal'
  ): string {
    
    const event: StateChangeEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      topic,
      source,
      timestamp: Date.now(),
      data,
      metadata: {
        priority
      }
    };

    // Add to event queue for processing
    this.eventQueue.push(event);
    this.updateEventStats(event);

    // Store in history
    this.addToHistory(event);

    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processEventQueue();
    }

    return event.id;
  }

  /**
   * Publish multiple events atomically
   */
  publishBatch(events: Omit<StateChangeEvent, 'id' | 'timestamp'>[]): string[] {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventIds: string[] = [];

    events.forEach((eventData, index) => {
      const event: StateChangeEvent = {
        ...eventData,
        id: `${batchId}_${index}`,
        timestamp: Date.now(),
        metadata: {
          ...eventData.metadata,
          batch: batchId,
          sequence: index
        }
      };

      this.eventQueue.push(event);
      this.updateEventStats(event);
      this.addToHistory(event);
      eventIds.push(event.id);
    });

    if (!this.processingQueue) {
      this.processEventQueue();
    }

    return eventIds;
  }

  /**
   * Enable event replay for a topic
   */
  enableReplay(topic: string, maxEvents: number = 10, maxAge: number = 3600000): void {
    this.replayConfigs.set(topic, {
      topic,
      maxEvents,
      maxAge,
      enabled: true
    });

    console.log(`🔄 Event replay enabled for '${topic}' (${maxEvents} events, ${maxAge}ms)`);
  }

  /**
   * Disable event replay for a topic
   */
  disableReplay(topic: string): void {
    this.replayConfigs.delete(topic);
    console.log(`🔄 Event replay disabled for '${topic}'`);
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): EventSubscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all subscriptions for a topic
   */
  getSubscriptionsForTopic(topic: string): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => 
      sub.topic === topic || this.topicMatches(topic, sub.topic)
    );
  }

  /**
   * Get event history for a topic
   */
  getEventHistory(topic: string, limit: number = 50): StateChangeEvent[] {
    return this.eventHistory
      .filter(event => event.topic === topic)
      .slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(topic?: string): void {
    if (topic) {
      this.eventHistory = this.eventHistory.filter(event => event.topic !== topic);
    } else {
      this.eventHistory = [];
    }
  }

  /**
   * Get event statistics
   */
  getStats(): EventStats {
    return { ...this.stats };
  }

  /**
   * Create event filter function
   */
  createFilter(conditions: {
    source?: string | string[];
    type?: StateChangeEvent['type'] | StateChangeEvent['type'][];
    priority?: StateChangeEvent['metadata']['priority'] | StateChangeEvent['metadata']['priority'][];
    minTimestamp?: number;
    maxTimestamp?: number;
    dataFilter?: (data: any) => boolean;
  }): (event: StateChangeEvent) => boolean {
    
    return (event: StateChangeEvent) => {
      // Source filter
      if (conditions.source) {
        const sources = Array.isArray(conditions.source) ? conditions.source : [conditions.source];
        if (!sources.includes(event.source)) return false;
      }

      // Type filter
      if (conditions.type) {
        const types = Array.isArray(conditions.type) ? conditions.type : [conditions.type];
        if (!types.includes(event.type)) return false;
      }

      // Priority filter
      if (conditions.priority) {
        const priorities = Array.isArray(conditions.priority) ? conditions.priority : [conditions.priority];
        if (!priorities.includes(event.metadata.priority)) return false;
      }

      // Timestamp filters
      if (conditions.minTimestamp && event.timestamp < conditions.minTimestamp) return false;
      if (conditions.maxTimestamp && event.timestamp > conditions.maxTimestamp) return false;

      // Data filter
      if (conditions.dataFilter && !conditions.dataFilter(event.data)) return false;

      return true;
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timers
    this.throttleTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.batches.forEach(batch => {
      if (batch.timer) clearTimeout(batch.timer);
    });

    // Clear all data
    this.subscriptions.clear();
    this.eventHistory = [];
    this.batches.clear();
    this.replayConfigs.clear();
    this.throttleTimers.clear();
    this.debounceTimers.clear();
    this.eventQueue = [];
  }

  // Private methods

  private async processEventQueue(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.deliverEvent(event);
    }

    this.processingQueue = false;
  }

  private async deliverEvent(event: StateChangeEvent): Promise<void> {
    const startTime = Date.now();
    const relevantSubscriptions = this.getSubscriptionsForTopic(event.topic);

    // Sort by priority (higher priority first)
    relevantSubscriptions.sort((a, b) => b.options.priority - a.options.priority);

    for (const subscription of relevantSubscriptions) {
      try {
        // Apply filter if provided
        if (subscription.filter && !subscription.filter(event)) {
          continue;
        }

        // Handle throttling
        if (subscription.options.throttleMs) {
          if (!this.shouldThrottle(subscription.id, subscription.options.throttleMs)) {
            continue;
          }
        }

        // Handle debouncing
        if (subscription.options.debounceMs) {
          this.debounceCallback(subscription, event);
          continue;
        }

        // Handle batching
        if (subscription.options.batchSize) {
          this.addToBatch(subscription, event);
          continue;
        }

        // Deliver event immediately
        await this.executeCallback(subscription, event);

        // Remove subscription if it's a one-time subscription
        if (subscription.options.once) {
          this.unsubscribe(subscription.id);
        }

      } catch (error) {
        console.error('Error delivering event to subscription:', error);
      }
    }

    // Update latency stats
    const latency = Date.now() - startTime;
    this.updateLatencyStats(latency);
  }

  private async executeCallback(subscription: EventSubscription, event: StateChangeEvent): Promise<void> {
    subscription.metadata.lastTriggered = new Date();
    subscription.metadata.triggerCount++;

    await subscription.callback(event);
  }

  private shouldThrottle(subscriptionId: string, throttleMs: number): boolean {
    const lastExecuted = this.throttleTimers.get(subscriptionId);
    const now = Date.now();

    if (lastExecuted && (now - Number(lastExecuted)) < throttleMs) {
      return false;
    }

    this.throttleTimers.set(subscriptionId, setTimeout(() => {
      this.throttleTimers.delete(subscriptionId);
    }, throttleMs) as any);

    return true;
  }

  private debounceCallback(subscription: EventSubscription, event: StateChangeEvent): void {
    const existingTimer = this.debounceTimers.get(subscription.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(subscription.id);
      await this.executeCallback(subscription, event);
    }, subscription.options.debounceMs);

    this.debounceTimers.set(subscription.id, timer);
  }

  private addToBatch(subscription: EventSubscription, event: StateChangeEvent): void {
    const batchKey = `${subscription.id}_batch`;
    let batch = this.batches.get(batchKey);

    if (!batch) {
      batch = {
        id: batchKey,
        topic: event.topic,
        events: [],
        createdAt: new Date(),
        maxSize: subscription.options.batchSize!,
        timeout: 1000 // 1 second default
      };
      this.batches.set(batchKey, batch);
    }

    batch.events.push(event);

    // Deliver batch if it's full or timeout
    if (batch.events.length >= batch.maxSize) {
      this.deliverBatch(subscription, batch);
    } else if (!batch.timer) {
      batch.timer = setTimeout(() => {
        this.deliverBatch(subscription, batch!);
      }, batch.timeout);
    }
  }

  private async deliverBatch(subscription: EventSubscription, batch: EventBatch): Promise<void> {
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Create synthetic batch event
    const batchEvent: StateChangeEvent = {
      id: `batch_${batch.id}`,
      type: 'state_change',
      topic: batch.topic,
      source: 'batch',
      timestamp: Date.now(),
      data: {
        events: batch.events,
        count: batch.events.length
      },
      metadata: {
        priority: 'normal',
        batch: batch.id
      }
    };

    await this.executeCallback(subscription, batchEvent);
    this.batches.delete(batch.id);
    this.stats.batchedEvents += batch.events.length;
  }

  private sendReplayEvents(subscription: EventSubscription): void {
    const replayConfig = this.replayConfigs.get(subscription.topic);
    if (!replayConfig || !replayConfig.enabled) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - replayConfig.maxAge;

    const replayEvents = this.eventHistory
      .filter(event => 
        event.topic === subscription.topic && 
        event.timestamp >= cutoffTime
      )
      .slice(-replayConfig.maxEvents);

    replayEvents.forEach(event => {
      // Mark as replay event
      const replayEvent = {
        ...event,
        id: `replay_${event.id}`,
        metadata: {
          ...event.metadata,
          replay: true
        }
      };

      // Deliver asynchronously to avoid blocking
      setTimeout(() => {
        this.executeCallback(subscription, replayEvent);
      }, 0);
    });

    this.stats.replayEvents += replayEvents.length;
  }

  private topicMatches(eventTopic: string, subscriptionTopic: string): boolean {
    // Support wildcard matching
    if (subscriptionTopic.includes('*')) {
      const pattern = subscriptionTopic.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(eventTopic);
    }

    return eventTopic === subscriptionTopic;
  }

  private addToHistory(event: StateChangeEvent): void {
    this.eventHistory.push(event);

    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  private updateEventStats(event: StateChangeEvent): void {
    this.stats.totalEvents++;
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;
  }

  private updateSubscriptionStats(topic: string, delta: number): void {
    this.stats.totalSubscriptions += delta;
    this.stats.subscriptionsByTopic[topic] = (this.stats.subscriptionsByTopic[topic] || 0) + delta;
    
    if (this.stats.subscriptionsByTopic[topic] <= 0) {
      delete this.stats.subscriptionsByTopic[topic];
    }
  }

  private updateLatencyStats(latency: number): void {
    const currentAvg = this.stats.averageEventLatency;
    const totalEvents = this.stats.totalEvents;
    
    this.stats.averageEventLatency = totalEvents === 1 
      ? latency 
      : ((currentAvg * (totalEvents - 1)) + latency) / totalEvents;
  }

  private cleanupSubscriptionTimers(subscriptionId: string): void {
    const throttleTimer = this.throttleTimers.get(subscriptionId);
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      this.throttleTimers.delete(subscriptionId);
    }

    const debounceTimer = this.debounceTimers.get(subscriptionId);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      this.debounceTimers.delete(subscriptionId);
    }
  }

  private initializeQueueProcessor(): void {
    // Process queue every 10ms for high performance
    setInterval(() => {
      if (!this.processingQueue && this.eventQueue.length > 0) {
        this.processEventQueue();
      }
    }, 10);
  }
}

// Singleton instance for global use
export const stateChangeEventManager = new StateChangeEventManager();

export default stateChangeEventManager;