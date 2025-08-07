/**
 * Synchronization Monitoring and Debugging Console
 * Provides real-time monitoring, debugging tools, and visual indicators for sync operations
 */

import { dateRangeSyncManager } from '../utils/dateRangeSync';
import { filterSyncManager } from '../utils/filterSync';
import { stateUpdateQueue } from '../utils/stateQueue';
import { componentStateRegistry } from '../utils/componentRegistry';
import { stateChangeEventManager } from '../utils/stateEvents';
import { renderOptimizer } from '../utils/renderOptimizer';
import { updateBatcher } from '../utils/updateBatcher';
import { changeDetector } from '../utils/changeDetection';

export interface SyncStatus {
  component: string;
  lastSync: number;
  status: 'active' | 'idle' | 'error' | 'syncing';
  syncCount: number;
  lastError?: string;
  performance: {
    averageTime: number;
    lastTime: number;
    totalTime: number;
  };
}

export interface SyncEvent {
  id: string;
  timestamp: number;
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'state_change' | 'conflict_detected';
  component: string;
  data: any;
  duration?: number;
  error?: string;
}

export interface SyncMetrics {
  dateRangeSync: {
    validations: number;
    persists: number;
    retrievals: number;
    conflicts: number;
    averageTime: number;
  };
  filterSync: {
    validations: number;
    persists: number;
    retrievals: number;
    conflicts: number;
    presetApplications: number;
    averageTime: number;
  };
  stateUpdates: {
    queued: number;
    processed: number;
    failed: number;
    batched: number;
    averageTime: number;
  };
  crossComponent: {
    events: number;
    registrations: number;
    validations: number;
    errors: number;
    averageTime: number;
  };
  performance: {
    renders: number;
    optimizations: number;
    changeDetections: number;
    memoryUsage: number;
    averageTime: number;
  };
}

export interface DebugConfig {
  enableLogging: boolean;
  enableVisualIndicators: boolean;
  enablePerformanceTracking: boolean;
  enableEventReplay: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxEventHistory: number;
  metricsUpdateInterval: number;
}

export class SyncMonitor {
  private static instance: SyncMonitor | null = null;
  private config: DebugConfig;
  private componentStatus: Map<string, SyncStatus>;
  private eventHistory: SyncEvent[];
  private metrics: SyncMetrics;
  private eventCounter: number;
  private metricsInterval: number | null;
  private subscribers: Map<string, (event: SyncEvent) => void>;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableVisualIndicators: true,
      enablePerformanceTracking: true,
      enableEventReplay: true,
      logLevel: 'info',
      maxEventHistory: 1000,
      metricsUpdateInterval: 1000, // 1 second
      ...config
    };

    this.componentStatus = new Map();
    this.eventHistory = [];
    this.eventCounter = 0;
    this.metricsInterval = null;
    this.subscribers = new Map();

    this.initializeMetrics();
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  public static getInstance(config?: Partial<DebugConfig>): SyncMonitor {
    if (!SyncMonitor.instance) {
      SyncMonitor.instance = new SyncMonitor(config);
    }
    return SyncMonitor.instance;
  }

  /**
   * Start monitoring synchronization operations
   */
  public startMonitoring(): void {
    this.log('info', '🔍 Starting synchronization monitoring...');
    
    // Initialize component statuses
    this.initializeComponentStatuses();
    
    // Start real-time metrics collection
    this.startMetricsCollection();
    
    this.log('info', '✅ Synchronization monitoring started');
  }

  /**
   * Stop monitoring and clean up
   */
  public stopMonitoring(): void {
    this.log('info', '🛑 Stopping synchronization monitoring...');
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.componentStatus.clear();
    this.eventHistory.length = 0;
    this.subscribers.clear();
    
    this.log('info', '✅ Synchronization monitoring stopped');
  }

  /**
   * Subscribe to sync events
   */
  public subscribe(eventType: string, callback: (event: SyncEvent) => void): string {
    const subscriptionId = `sub-${++this.eventCounter}`;
    this.subscribers.set(subscriptionId, callback);
    return subscriptionId;
  }

  /**
   * Unsubscribe from sync events
   */
  public unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);
  }

  /**
   * Record a synchronization event
   */
  public recordEvent(
    type: SyncEvent['type'],
    component: string,
    data: any,
    duration?: number,
    error?: string
  ): void {
    const event: SyncEvent = {
      id: `event-${++this.eventCounter}`,
      timestamp: Date.now(),
      type,
      component,
      data,
      duration,
      error
    };

    // Add to history
    this.eventHistory.push(event);
    
    // Trim history if needed
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }

    // Update component status
    this.updateComponentStatus(component, type, duration, error);

    // Notify subscribers
    this.notifySubscribers(event);

    // Log event
    this.logEvent(event);

    // Update metrics
    this.updateMetrics(event);
  }

  /**
   * Get current synchronization status for all components
   */
  public getSyncStatus(): Record<string, SyncStatus> {
    return Object.fromEntries(this.componentStatus);
  }

  /**
   * Get synchronization metrics
   */
  public getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Get event history with optional filtering
   */
  public getEventHistory(filter?: {
    component?: string;
    type?: SyncEvent['type'];
    timeRange?: { start: number; end: number };
    limit?: number;
  }): SyncEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.component) {
        events = events.filter(e => e.component === filter.component);
      }
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.timeRange) {
        events = events.filter(e => 
          e.timestamp >= filter.timeRange!.start && e.timestamp <= filter.timeRange!.end
        );
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Create visual sync status indicator
   */
  public createStatusIndicator(containerId: string): HTMLElement {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element ${containerId} not found`);
    }

    const indicator = document.createElement('div');
    indicator.id = 'sync-status-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
    `;

    container.appendChild(indicator);
    this.updateStatusIndicator(indicator);

    // Update indicator periodically
    setInterval(() => this.updateStatusIndicator(indicator), 1000);

    return indicator;
  }

  /**
   * Generate debugging report
   */
  public generateDebugReport(): string {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const recentEvents = this.getEventHistory({ timeRange: { start: lastHour, end: now } });

    let report = '🔍 SYNCHRONIZATION DEBUG REPORT\n';
    report += '================================================================================\n\n';

    // Component Status
    report += 'COMPONENT STATUS:\n';
    for (const [component, status] of this.componentStatus) {
      const statusIcon = {
        active: '🟢',
        idle: '🟡',
        error: '🔴',
        syncing: '🔄'
      }[status.status];
      
      report += `  ${statusIcon} ${component}: ${status.status} (${status.syncCount} syncs, avg: ${status.performance.averageTime.toFixed(2)}ms)\n`;
      if (status.lastError) {
        report += `    Last Error: ${status.lastError}\n`;
      }
    }

    // Recent Events
    report += '\nRECENT EVENTS (Last Hour):\n';
    recentEvents.slice(0, 20).forEach(event => {
      const timeAgo = Math.round((now - event.timestamp) / 1000);
      const icon = {
        sync_start: '▶️',
        sync_complete: '✅',
        sync_error: '❌',
        state_change: '🔄',
        conflict_detected: '⚠️'
      }[event.type];
      
      report += `  ${icon} ${event.component} - ${event.type} (${timeAgo}s ago)`;
      if (event.duration) {
        report += ` - ${event.duration.toFixed(2)}ms`;
      }
      if (event.error) {
        report += ` - ERROR: ${event.error}`;
      }
      report += '\n';
    });

    // Metrics Summary
    report += '\nMETRICS SUMMARY:\n';
    report += `  Date Range Sync: ${this.metrics.dateRangeSync.persists} persists, ${this.metrics.dateRangeSync.conflicts} conflicts\n`;
    report += `  Filter Sync: ${this.metrics.filterSync.persists} persists, ${this.metrics.filterSync.conflicts} conflicts\n`;
    report += `  State Updates: ${this.metrics.stateUpdates.processed} processed, ${this.metrics.stateUpdates.failed} failed\n`;
    report += `  Cross-Component: ${this.metrics.crossComponent.events} events, ${this.metrics.crossComponent.errors} errors\n`;
    report += `  Performance: ${this.metrics.performance.renders} renders, ${this.metrics.performance.optimizations} optimizations\n`;

    return report;
  }

  /**
   * Export sync data for analysis
   */
  public exportSyncData(): {
    status: Record<string, SyncStatus>;
    events: SyncEvent[];
    metrics: SyncMetrics;
    timestamp: number;
  } {
    return {
      status: this.getSyncStatus(),
      events: this.getEventHistory(),
      metrics: this.getMetrics(),
      timestamp: Date.now()
    };
  }

  /**
   * Import sync data for analysis
   */
  public importSyncData(data: ReturnType<typeof this.exportSyncData>): void {
    // Clear current data
    this.componentStatus.clear();
    this.eventHistory.length = 0;

    // Import data
    Object.entries(data.status).forEach(([component, status]) => {
      this.componentStatus.set(component, status);
    });

    this.eventHistory.push(...data.events);
    this.metrics = { ...data.metrics };

    this.log('info', `Imported sync data from ${new Date(data.timestamp).toISOString()}`);
  }

  // Private methods

  private initializeMetrics(): void {
    this.metrics = {
      dateRangeSync: {
        validations: 0,
        persists: 0,
        retrievals: 0,
        conflicts: 0,
        averageTime: 0
      },
      filterSync: {
        validations: 0,
        persists: 0,
        retrievals: 0,
        conflicts: 0,
        presetApplications: 0,
        averageTime: 0
      },
      stateUpdates: {
        queued: 0,
        processed: 0,
        failed: 0,
        batched: 0,
        averageTime: 0
      },
      crossComponent: {
        events: 0,
        registrations: 0,
        validations: 0,
        errors: 0,
        averageTime: 0
      },
      performance: {
        renders: 0,
        optimizations: 0,
        changeDetections: 0,
        memoryUsage: 0,
        averageTime: 0
      }
    };
  }

  private setupEventListeners(): void {
    // Listen for state change events
    stateChangeEventManager.subscribe('*', (event) => {
      this.recordEvent('state_change', 'StateChangeEventManager', event);
    });

    // Monitor performance metrics
    setInterval(() => {
      const renderStats = renderOptimizer.getRenderStats();
      const batchStats = updateBatcher.getStats();
      const changeStats = changeDetector.getStats();

      this.metrics.performance.renders = renderStats.totalRenders;
      this.metrics.performance.memoryUsage = renderStats.memoryUsage + changeStats.memoryUsage;
      this.metrics.performance.changeDetections = changeStats.totalComparisons;
    }, this.config.metricsUpdateInterval);
  }

  private initializeComponentStatuses(): void {
    const components = [
      'DateRangeSync',
      'FilterSync',
      'StateUpdateQueue',
      'ComponentRegistry',
      'StateEventManager',
      'RenderOptimizer',
      'UpdateBatcher',
      'ChangeDetector'
    ];

    components.forEach(component => {
      this.componentStatus.set(component, {
        component,
        lastSync: Date.now(),
        status: 'idle',
        syncCount: 0,
        performance: {
          averageTime: 0,
          lastTime: 0,
          totalTime: 0
        }
      });
    });
  }

  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.collectRealTimeMetrics();
    }, this.config.metricsUpdateInterval);
  }

  private collectRealTimeMetrics(): void {
    // Update component statuses based on recent activity
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;

    for (const [component, status] of this.componentStatus) {
      const recentEvents = this.eventHistory.filter(e => 
        e.component === component && e.timestamp > fiveSecondsAgo
      );

      if (recentEvents.length > 0) {
        const lastEvent = recentEvents[recentEvents.length - 1];
        status.status = lastEvent.type === 'sync_error' ? 'error' : 'active';
        status.lastSync = lastEvent.timestamp;
      } else if (status.status === 'active') {
        status.status = 'idle';
      }
    }
  }

  private updateComponentStatus(
    component: string,
    eventType: SyncEvent['type'],
    duration?: number,
    error?: string
  ): void {
    let status = this.componentStatus.get(component);
    
    if (!status) {
      status = {
        component,
        lastSync: Date.now(),
        status: 'idle',
        syncCount: 0,
        performance: {
          averageTime: 0,
          lastTime: 0,
          totalTime: 0
        }
      };
      this.componentStatus.set(component, status);
    }

    status.lastSync = Date.now();
    status.syncCount++;

    if (duration) {
      status.performance.lastTime = duration;
      status.performance.totalTime += duration;
      status.performance.averageTime = status.performance.totalTime / status.syncCount;
    }

    if (error) {
      status.status = 'error';
      status.lastError = error;
    } else {
      status.status = eventType === 'sync_start' ? 'syncing' : 
                    eventType === 'sync_complete' ? 'active' : status.status;
    }
  }

  private notifySubscribers(event: SyncEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.log('error', `Subscriber callback error: ${error}`);
      }
    });
  }

  private logEvent(event: SyncEvent): void {
    if (!this.config.enableLogging) return;

    const logLevel = event.type === 'sync_error' ? 'error' : 
                    event.type === 'conflict_detected' ? 'warn' : 'info';

    if (this.shouldLog(logLevel)) {
      const icon = {
        sync_start: '▶️',
        sync_complete: '✅',
        sync_error: '❌',
        state_change: '🔄',
        conflict_detected: '⚠️'
      }[event.type];

      let message = `${icon} [${event.component}] ${event.type}`;
      if (event.duration) {
        message += ` (${event.duration.toFixed(2)}ms)`;
      }
      if (event.error) {
        message += ` - ${event.error}`;
      }

      this.log(logLevel, message);
    }
  }

  private updateMetrics(event: SyncEvent): void {
    const { type, component, duration } = event;

    // Update metrics based on event type and component
    if (component.includes('DateRange')) {
      if (type === 'sync_complete') this.metrics.dateRangeSync.persists++;
      if (type === 'conflict_detected') this.metrics.dateRangeSync.conflicts++;
    } else if (component.includes('Filter')) {
      if (type === 'sync_complete') this.metrics.filterSync.persists++;
      if (type === 'conflict_detected') this.metrics.filterSync.conflicts++;
    } else if (component.includes('State') || component.includes('Update')) {
      if (type === 'sync_complete') this.metrics.stateUpdates.processed++;
      if (type === 'sync_error') this.metrics.stateUpdates.failed++;
    } else if (component.includes('Component') || component.includes('Event')) {
      if (type === 'state_change') this.metrics.crossComponent.events++;
      if (type === 'sync_error') this.metrics.crossComponent.errors++;
    }
  }

  private updateStatusIndicator(indicator: HTMLElement): void {
    if (!this.config.enableVisualIndicators) return;

    const status = this.getSyncStatus();
    const activeComponents = Object.values(status).filter(s => s.status === 'active').length;
    const errorComponents = Object.values(status).filter(s => s.status === 'error').length;
    const syncingComponents = Object.values(status).filter(s => s.status === 'syncing').length;

    const statusColor = errorComponents > 0 ? '#ff4444' : 
                       syncingComponents > 0 ? '#ffaa00' : 
                       activeComponents > 0 ? '#44ff44' : '#888888';

    indicator.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 5px;">
        <div style="width: 8px; height: 8px; background: ${statusColor}; border-radius: 50%; margin-right: 8px;"></div>
        <strong>Sync Status</strong>
      </div>
      <div style="font-size: 10px;">
        Active: ${activeComponents} | Syncing: ${syncingComponents} | Errors: ${errorComponents}
      </div>
      <div style="font-size: 10px; margin-top: 5px;">
        Events: ${this.eventHistory.length} | Uptime: ${Math.round((Date.now() - (this.eventHistory[0]?.timestamp || Date.now())) / 1000)}s
      </div>
    `;
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.config.logLevel);
  }

  private log(level: string, message: string): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console[level as keyof Console](`[${timestamp}] [SyncMonitor] ${message}` as any);
    }
  }
}

// Export singleton instance
export const syncMonitor = SyncMonitor.getInstance();

// Export types for external use
export type {
  SyncStatus,
  SyncEvent,
  SyncMetrics,
  DebugConfig
};