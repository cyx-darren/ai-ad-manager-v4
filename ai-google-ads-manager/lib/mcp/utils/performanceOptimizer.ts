/**
 * Performance Optimizer for MCP Session Monitoring
 * Handles adaptive monitoring, CPU/memory tracking, batch processing, and background optimization
 */

import { MonitoringConfig } from '../config/monitoringConfig';

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  batteryLevel?: number;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  connectionType?: string;
  effectiveType?: string;
}

export interface OptimizationSettings {
  monitoringIntensity: 'minimal' | 'standard' | 'intensive';
  batchSize: number;
  batchInterval: number;
  adaptiveThrottling: boolean;
  backgroundProcessing: boolean;
  resourceThresholds: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export interface BatchOperation {
  id: string;
  type: string;
  data: any;
  priority: number;
  timestamp: number;
  retryCount: number;
}

export interface ResourceMonitor {
  isActive: boolean;
  lastCheck: number;
  checkInterval: number;
  metrics: PerformanceMetrics;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer | null = null;
  private config: MonitoringConfig;
  private settings: OptimizationSettings;
  private resourceMonitor: ResourceMonitor;
  private batchQueue: Map<string, BatchOperation[]>;
  private worker: Worker | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private rafId: number | null = null;
  private isInitialized = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.settings = this.initializeSettings();
    this.resourceMonitor = this.initializeResourceMonitor();
    this.batchQueue = new Map();
  }

  public static getInstance(config?: MonitoringConfig): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      if (!config) {
        throw new Error('Config required for first PerformanceOptimizer instantiation');
      }
      PerformanceOptimizer.instance = new PerformanceOptimizer(config);
    }
    return PerformanceOptimizer.instance;
  }

  private initializeSettings(): OptimizationSettings {
    return {
      monitoringIntensity: 'standard',
      batchSize: 10,
      batchInterval: 1000, // 1 second
      adaptiveThrottling: true,
      backgroundProcessing: true,
      resourceThresholds: {
        cpu: 70, // Percentage
        memory: 80, // Percentage
        network: 1000 // Latency in ms
      }
    };
  }

  private initializeResourceMonitor(): ResourceMonitor {
    return {
      isActive: false,
      lastCheck: 0,
      checkInterval: 5000, // 5 seconds
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0
      }
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize background worker for intensive operations
      if (typeof Worker !== 'undefined' && this.settings.backgroundProcessing) {
        this.worker = new Worker(
          URL.createObjectURL(new Blob([this.getWorkerCode()], { type: 'application/javascript' }))
        );
        this.setupWorkerMessageHandling();
      }

      // Initialize performance observer
      if (typeof PerformanceObserver !== 'undefined') {
        this.performanceObserver = new PerformanceObserver(this.handlePerformanceEntries.bind(this));
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      }

      // Start resource monitoring
      this.startResourceMonitoring();

      // Start batch processing
      this.startBatchProcessing();

      this.isInitialized = true;
      console.log('PerformanceOptimizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PerformanceOptimizer:', error);
      throw error;
    }
  }

  public async addToBatch(
    type: string,
    data: any,
    priority: number = 3
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const operation: BatchOperation = {
      id: this.generateId(),
      type,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    };

    if (!this.batchQueue.has(type)) {
      this.batchQueue.set(type, []);
    }

    const queue = this.batchQueue.get(type)!;
    queue.push(operation);

    // Sort by priority (higher number = higher priority)
    queue.sort((a, b) => b.priority - a.priority);

    // Trigger immediate processing if high priority or queue is full
    if (priority >= 4 || queue.length >= this.settings.batchSize) {
      this.processBatch(type);
    }

    return operation.id;
  }

  public setOptimizationSettings(settings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // Adjust resource monitoring interval based on new settings
    if (settings.monitoringIntensity) {
      this.adjustMonitoringIntensity(settings.monitoringIntensity);
    }

    console.log('Optimization settings updated:', this.settings);
  }

  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.resourceMonitor.metrics };
  }

  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.resourceMonitor.metrics;

    if (metrics.cpuUsage > this.settings.resourceThresholds.cpu) {
      recommendations.push('High CPU usage detected - consider reducing monitoring frequency');
    }

    if (metrics.memoryUsage > this.settings.resourceThresholds.memory) {
      recommendations.push('High memory usage detected - consider enabling data compression');
    }

    if (metrics.networkLatency > this.settings.resourceThresholds.network) {
      recommendations.push('High network latency detected - consider batch processing');
    }

    if (metrics.batteryLevel && metrics.batteryLevel < 20) {
      recommendations.push('Low battery detected - switching to power-saving mode');
    }

    return recommendations;
  }

  public async optimizeMonitoring(): Promise<void> {
    const metrics = this.resourceMonitor.metrics;
    const recommendations = this.getOptimizationRecommendations();

    if (recommendations.length === 0) return;

    // Automatic optimization based on current conditions
    if (metrics.cpuUsage > this.settings.resourceThresholds.cpu) {
      this.settings.monitoringIntensity = 'minimal';
      this.adjustMonitoringIntensity('minimal');
    }

    if (metrics.memoryUsage > this.settings.resourceThresholds.memory) {
      // Trigger garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }
      
      // Reduce batch sizes
      this.settings.batchSize = Math.max(5, this.settings.batchSize - 5);
    }

    if (metrics.networkLatency > this.settings.resourceThresholds.network) {
      // Increase batch intervals
      this.settings.batchInterval = Math.min(5000, this.settings.batchInterval + 1000);
    }

    console.log('Monitoring optimized based on current conditions');
  }

  private startResourceMonitoring(): void {
    const monitor = () => {
      if (!this.resourceMonitor.isActive) return;

      this.updatePerformanceMetrics();
      
      // Adaptive monitoring based on current metrics
      if (this.settings.adaptiveThrottling) {
        this.optimizeMonitoring();
      }

      // Schedule next check
      setTimeout(monitor, this.resourceMonitor.checkInterval);
    };

    this.resourceMonitor.isActive = true;
    monitor();
  }

  private updatePerformanceMetrics(): void {
    const now = performance.now();
    
    // CPU usage estimation (simplified)
    if (this.resourceMonitor.lastCheck > 0) {
      const timeDiff = now - this.resourceMonitor.lastCheck;
      const cpuUsage = this.estimateCPUUsage(timeDiff);
      this.resourceMonitor.metrics.cpuUsage = cpuUsage;
    }

    // Memory usage
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.resourceMonitor.metrics.memoryUsage = 
        (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
    }

    // Network information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.resourceMonitor.metrics.networkLatency = connection.rtt || 0;
      this.resourceMonitor.metrics.connectionType = connection.type;
      this.resourceMonitor.metrics.effectiveType = connection.effectiveType;
    }

    // Battery information
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.resourceMonitor.metrics.batteryLevel = battery.level * 100;
      });
    }

    this.resourceMonitor.lastCheck = now;
  }

  private estimateCPUUsage(timeDiff: number): number {
    // Simplified CPU usage estimation based on frame rate and timing
    const targetFrameTime = 16.67; // 60 FPS
    const actualFrameTime = timeDiff;
    
    if (actualFrameTime > targetFrameTime) {
      return Math.min(100, (actualFrameTime / targetFrameTime) * 50);
    }
    
    return Math.max(0, 50 - ((targetFrameTime - actualFrameTime) / targetFrameTime) * 50);
  }

  private adjustMonitoringIntensity(intensity: 'minimal' | 'standard' | 'intensive'): void {
    switch (intensity) {
      case 'minimal':
        this.resourceMonitor.checkInterval = 30000; // 30 seconds
        this.settings.batchInterval = 5000; // 5 seconds
        this.settings.batchSize = 5;
        break;
      case 'standard':
        this.resourceMonitor.checkInterval = 5000; // 5 seconds
        this.settings.batchInterval = 1000; // 1 second
        this.settings.batchSize = 10;
        break;
      case 'intensive':
        this.resourceMonitor.checkInterval = 1000; // 1 second
        this.settings.batchInterval = 500; // 0.5 seconds
        this.settings.batchSize = 20;
        break;
    }
  }

  private startBatchProcessing(): void {
    const processBatches = () => {
      for (const [type, queue] of this.batchQueue) {
        if (queue.length > 0) {
          this.processBatch(type);
        }
      }

      // Continue batch processing
      setTimeout(processBatches, this.settings.batchInterval);
    };

    processBatches();
  }

  private async processBatch(type: string): Promise<void> {
    const queue = this.batchQueue.get(type);
    if (!queue || queue.length === 0) return;

    const batchSize = Math.min(this.settings.batchSize, queue.length);
    const batch = queue.splice(0, batchSize);

    try {
      if (this.worker && this.settings.backgroundProcessing) {
        // Process in background worker
        await this.processInWorker(type, batch);
      } else {
        // Process in main thread
        await this.processInMainThread(type, batch);
      }
    } catch (error) {
      console.error(`Batch processing failed for type ${type}:`, error);
      
      // Retry failed operations
      for (const operation of batch) {
        if (operation.retryCount < 3) {
          operation.retryCount++;
          queue.unshift(operation);
        }
      }
    }
  }

  private async processInWorker(type: string, batch: BatchOperation[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const messageId = this.generateId();
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data.messageId === messageId) {
          this.worker!.removeEventListener('message', handleMessage);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve();
          }
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({
        messageId,
        action: 'processBatch',
        type,
        batch
      });
    });
  }

  private async processInMainThread(type: string, batch: BatchOperation[]): Promise<void> {
    // Use requestIdleCallback for non-blocking processing
    return new Promise((resolve) => {
      const processChunk = (deadline: IdleDeadline) => {
        let processed = 0;
        
        while (processed < batch.length && deadline.timeRemaining() > 0) {
          const operation = batch[processed];
          this.processOperation(operation);
          processed++;
        }

        if (processed < batch.length) {
          // Continue processing in next idle period
          requestIdleCallback(processChunk);
        } else {
          resolve();
        }
      };

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processChunk);
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          batch.forEach(operation => this.processOperation(operation));
          resolve();
        }, 0);
      }
    });
  }

  private processOperation(operation: BatchOperation): void {
    // Process individual operation based on type
    switch (operation.type) {
      case 'analytics':
        this.processAnalyticsOperation(operation);
        break;
      case 'storage':
        this.processStorageOperation(operation);
        break;
      case 'monitoring':
        this.processMonitoringOperation(operation);
        break;
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
    }
  }

  private processAnalyticsOperation(operation: BatchOperation): void {
    // Implementation for analytics operations
    console.log(`Processing analytics operation: ${operation.id}`);
  }

  private processStorageOperation(operation: BatchOperation): void {
    // Implementation for storage operations
    console.log(`Processing storage operation: ${operation.id}`);
  }

  private processMonitoringOperation(operation: BatchOperation): void {
    // Implementation for monitoring operations
    console.log(`Processing monitoring operation: ${operation.id}`);
  }

  private setupWorkerMessageHandling(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event) => {
      const { action, data, error } = event.data;

      if (error) {
        console.error('Worker error:', error);
        return;
      }

      switch (action) {
        case 'batchProcessed':
          console.log('Batch processed successfully in worker');
          break;
        case 'performanceUpdate':
          // Handle performance updates from worker
          break;
        default:
          console.warn('Unknown worker message action:', action);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };
  }

  private handlePerformanceEntries(list: PerformanceObserverEntryList): void {
    for (const entry of list.getEntries()) {
      // Process performance entries for optimization insights
      if (entry.entryType === 'measure') {
        // Handle custom measurements
      } else if (entry.entryType === 'navigation') {
        // Handle navigation timing
      } else if (entry.entryType === 'resource') {
        // Handle resource loading timing
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWorkerCode(): string {
    return `
      self.onmessage = function(event) {
        const { messageId, action, type, batch } = event.data;
        
        try {
          if (action === 'processBatch') {
            // Simulate batch processing
            batch.forEach(operation => {
              // Process operation based on type
              console.log('Processing in worker:', operation.id);
            });
            
            self.postMessage({
              messageId,
              action: 'batchProcessed',
              result: 'success'
            });
          }
        } catch (error) {
          self.postMessage({
            messageId,
            error: error.message
          });
        }
      };
    `;
  }

  public async destroy(): Promise<void> {
    this.resourceMonitor.isActive = false;

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.batchQueue.clear();
    this.isInitialized = false;
    PerformanceOptimizer.instance = null;
  }
}

export const createPerformanceOptimizer = (config: MonitoringConfig): PerformanceOptimizer => {
  return PerformanceOptimizer.getInstance(config);
};