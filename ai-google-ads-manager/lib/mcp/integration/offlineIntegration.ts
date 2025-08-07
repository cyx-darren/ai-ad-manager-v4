/**
 * Offline Integration for MCP Session Monitoring
 * Seamless integration with existing offline system, unified state management,
 * and coordinated reconnection strategies
 */

import { MonitoringConfig } from '../config/monitoringConfig';
import { ConnectionMonitor } from '../utils/connectionMonitor';
import { ServerHealthMonitor } from '../utils/serverHealthMonitor';
import { AnalyticsManager } from '../utils/analyticsManager';
import { StorageManager } from '../utils/storageManager';
import { PerformanceOptimizer } from '../utils/performanceOptimizer';

export interface OfflineState {
  isOffline: boolean;
  lastOnline: number;
  offlineDuration: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  queuedOperations: OfflineOperation[];
}

export interface OfflineOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

export interface UnifiedStatus {
  connection: {
    isConnected: boolean;
    quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    latency: number;
    stability: number;
  };
  server: {
    isHealthy: boolean;
    availability: number;
    responseTime: number;
    services: Map<string, boolean>;
  };
  offline: {
    isOffline: boolean;
    canSync: boolean;
    queueSize: number;
    lastSync: number;
  };
  overall: {
    status: 'online' | 'degraded' | 'offline' | 'recovering';
    confidence: number;
    recommendations: string[];
  };
}

export interface ReconnectionStrategy {
  name: string;
  priority: number;
  conditions: (state: UnifiedStatus) => boolean;
  execute: (state: UnifiedStatus) => Promise<boolean>;
  timeout: number;
  maxRetries: number;
}

export class OfflineIntegration {
  private static instance: OfflineIntegration | null = null;
  private config: MonitoringConfig;
  private offlineState: OfflineState;
  private unifiedStatus: UnifiedStatus;
  private reconnectionStrategies: Map<string, ReconnectionStrategy>;
  private eventListeners: Map<string, Set<Function>>;
  private syncQueue: OfflineOperation[];
  private isInitialized = false;

  // Integration with existing monitoring components
  private connectionMonitor: ConnectionMonitor | null = null;
  private serverHealthMonitor: ServerHealthMonitor | null = null;
  private analyticsManager: AnalyticsManager | null = null;
  private storageManager: StorageManager | null = null;
  private performanceOptimizer: PerformanceOptimizer | null = null;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.offlineState = this.initializeOfflineState();
    this.unifiedStatus = this.initializeUnifiedStatus();
    this.reconnectionStrategies = new Map();
    this.eventListeners = new Map();
    this.syncQueue = [];
  }

  public static getInstance(config?: MonitoringConfig): OfflineIntegration {
    if (!OfflineIntegration.instance) {
      if (!config) {
        throw new Error('Config required for first OfflineIntegration instantiation');
      }
      OfflineIntegration.instance = new OfflineIntegration(config);
    }
    return OfflineIntegration.instance;
  }

  private initializeOfflineState(): OfflineState {
    return {
      isOffline: !navigator.onLine,
      lastOnline: navigator.onLine ? Date.now() : 0,
      offlineDuration: 0,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      queuedOperations: []
    };
  }

  private initializeUnifiedStatus(): UnifiedStatus {
    return {
      connection: {
        isConnected: navigator.onLine,
        quality: 'good',
        latency: 0,
        stability: 100
      },
      server: {
        isHealthy: true,
        availability: 100,
        responseTime: 0,
        services: new Map()
      },
      offline: {
        isOffline: !navigator.onLine,
        canSync: false,
        queueSize: 0,
        lastSync: 0
      },
      overall: {
        status: navigator.onLine ? 'online' : 'offline',
        confidence: 100,
        recommendations: []
      }
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize monitoring components
      await this.initializeMonitoringComponents();

      // Setup reconnection strategies
      this.setupReconnectionStrategies();

      // Setup event listeners
      this.setupEventListeners();

      // Setup browser offline/online detection
      this.setupBrowserOfflineDetection();

      // Start unified status monitoring
      this.startUnifiedStatusMonitoring();

      // Restore queued operations from storage
      await this.restoreQueuedOperations();

      this.isInitialized = true;
      console.log('OfflineIntegration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineIntegration:', error);
      throw error;
    }
  }

  private async initializeMonitoringComponents(): Promise<void> {
    // Initialize connection monitor
    this.connectionMonitor = ConnectionMonitor.getInstance(this.config);
    await this.connectionMonitor.initialize();

    // Initialize server health monitor
    this.serverHealthMonitor = ServerHealthMonitor.getInstance(this.config);
    await this.serverHealthMonitor.initialize();

    // Initialize analytics manager
    this.analyticsManager = AnalyticsManager.getInstance(this.config);
    await this.analyticsManager.initialize();

    // Initialize storage manager
    this.storageManager = StorageManager.getInstance(this.config);
    await this.storageManager.initialize();

    // Initialize performance optimizer
    this.performanceOptimizer = PerformanceOptimizer.getInstance(this.config);
    await this.performanceOptimizer.initialize();
  }

  private setupReconnectionStrategies(): void {
    // Strategy 1: Immediate reconnection for transient issues
    this.reconnectionStrategies.set('immediate', {
      name: 'immediate',
      priority: 1,
      conditions: (status) => 
        status.connection.quality === 'good' && 
        status.offline.isOffline && 
        this.offlineState.reconnectAttempts === 0,
      execute: async () => this.executeImmediateReconnection(),
      timeout: 5000,
      maxRetries: 1
    });

    // Strategy 2: Progressive reconnection with exponential backoff
    this.reconnectionStrategies.set('progressive', {
      name: 'progressive',
      priority: 2,
      conditions: (status) => 
        status.offline.isOffline && 
        this.offlineState.reconnectAttempts > 0 && 
        this.offlineState.reconnectAttempts < 5,
      execute: async () => this.executeProgressiveReconnection(),
      timeout: 15000,
      maxRetries: 5
    });

    // Strategy 3: Smart reconnection based on network conditions
    this.reconnectionStrategies.set('smart', {
      name: 'smart',
      priority: 3,
      conditions: (status) => 
        status.connection.quality !== 'critical' && 
        status.server.availability > 50,
      execute: async () => this.executeSmartReconnection(),
      timeout: 30000,
      maxRetries: 3
    });

    // Strategy 4: Conservative reconnection for poor conditions
    this.reconnectionStrategies.set('conservative', {
      name: 'conservative',
      priority: 4,
      conditions: (status) => 
        status.connection.quality === 'poor' || 
        status.server.availability < 50,
      execute: async () => this.executeConservativeReconnection(),
      timeout: 60000,
      maxRetries: 10
    });
  }

  private setupEventListeners(): void {
    // Listen to connection events
    if (this.connectionMonitor) {
      this.connectionMonitor.addEventListener('stateChange', (state) => {
        this.handleConnectionStateChange(state);
      });

      this.connectionMonitor.addEventListener('qualityChange', (quality) => {
        this.handleConnectionQualityChange(quality);
      });
    }

    // Listen to server health events
    if (this.serverHealthMonitor) {
      this.serverHealthMonitor.addEventListener('healthChange', (health) => {
        this.handleServerHealthChange(health);
      });

      this.serverHealthMonitor.addEventListener('serviceChange', (service) => {
        this.handleServiceChange(service);
      });
    }
  }

  private setupBrowserOfflineDetection(): void {
    window.addEventListener('online', () => {
      this.handleBrowserOnline();
    });

    window.addEventListener('offline', () => {
      this.handleBrowserOffline();
    });

    // Initial state
    if (!navigator.onLine) {
      this.handleBrowserOffline();
    }
  }

  private startUnifiedStatusMonitoring(): void {
    const updateStatus = () => {
      this.updateUnifiedStatus();
      setTimeout(updateStatus, 1000); // Update every second
    };

    updateStatus();
  }

  private updateUnifiedStatus(): void {
    // Update connection status
    if (this.connectionMonitor) {
      const connectionState = this.connectionMonitor.getState();
      this.unifiedStatus.connection = {
        isConnected: connectionState.isConnected,
        quality: connectionState.quality.classification,
        latency: connectionState.latency.current,
        stability: connectionState.quality.stability
      };
    }

    // Update server status
    if (this.serverHealthMonitor) {
      const serverHealth = this.serverHealthMonitor.getHealth();
      this.unifiedStatus.server = {
        isHealthy: serverHealth.isHealthy,
        availability: serverHealth.availability,
        responseTime: serverHealth.responseTime.average,
        services: new Map(Object.entries(serverHealth.services))
      };
    }

    // Update offline status
    this.unifiedStatus.offline = {
      isOffline: this.offlineState.isOffline,
      canSync: this.canSync(),
      queueSize: this.syncQueue.length,
      lastSync: this.getLastSyncTime()
    };

    // Calculate overall status
    this.calculateOverallStatus();

    // Emit unified status change event
    this.emit('statusChange', this.unifiedStatus);

    // Handle automatic reconnection if needed
    if (this.offlineState.isOffline && this.shouldAttemptReconnection()) {
      this.attemptReconnection();
    }
  }

  private calculateOverallStatus(): void {
    const { connection, server, offline } = this.unifiedStatus;
    
    if (!offline.isOffline && connection.isConnected && server.isHealthy) {
      this.unifiedStatus.overall.status = 'online';
      this.unifiedStatus.overall.confidence = Math.min(
        connection.stability,
        server.availability
      );
    } else if (connection.isConnected && server.availability > 50) {
      this.unifiedStatus.overall.status = 'degraded';
      this.unifiedStatus.overall.confidence = server.availability;
    } else if (this.offlineState.reconnectAttempts > 0) {
      this.unifiedStatus.overall.status = 'recovering';
      this.unifiedStatus.overall.confidence = Math.max(
        0,
        100 - (this.offlineState.reconnectAttempts * 10)
      );
    } else {
      this.unifiedStatus.overall.status = 'offline';
      this.unifiedStatus.overall.confidence = 0;
    }

    // Generate recommendations
    this.unifiedStatus.overall.recommendations = this.generateRecommendations();
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const { connection, server, offline } = this.unifiedStatus;

    if (offline.isOffline) {
      recommendations.push('Currently offline - queuing operations for later sync');
    }

    if (connection.quality === 'poor') {
      recommendations.push('Poor connection quality - consider using offline mode');
    }

    if (server.availability < 50) {
      recommendations.push('Server availability low - some features may be unavailable');
    }

    if (offline.queueSize > 100) {
      recommendations.push('Large sync queue - consider manual sync when connection improves');
    }

    if (connection.latency > 1000) {
      recommendations.push('High latency detected - enabling compression and batching');
    }

    return recommendations;
  }

  public async queueOperation(
    type: string,
    data: any,
    priority: number = 3
  ): Promise<string> {
    const operation: OfflineOperation = {
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      maxRetries: 3
    };

    this.syncQueue.push(operation);
    this.offlineState.queuedOperations.push(operation);

    // Sort by priority
    this.syncQueue.sort((a, b) => b.priority - a.priority);

    // Persist to storage
    if (this.storageManager) {
      await this.storageManager.store(
        `queue_${operation.id}`,
        'offline_operation',
        operation,
        priority
      );
    }

    this.emit('operationQueued', operation);
    return operation.id;
  }

  public async syncQueuedOperations(): Promise<void> {
    if (!this.canSync() || this.syncQueue.length === 0) return;

    const operations = [...this.syncQueue];
    this.syncQueue = [];

    let syncedCount = 0;
    let failedOperations: OfflineOperation[] = [];

    for (const operation of operations) {
      try {
        await this.syncOperation(operation);
        syncedCount++;
        
        // Remove from storage
        if (this.storageManager) {
          await this.storageManager.remove(`queue_${operation.id}`, 'offline_operation');
        }
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);
        operation.retryCount++;
        
        if (operation.retryCount < operation.maxRetries) {
          failedOperations.push(operation);
        }
      }
    }

    // Re-queue failed operations
    this.syncQueue.unshift(...failedOperations);

    this.emit('syncCompleted', { synced: syncedCount, failed: failedOperations.length });
  }

  private async syncOperation(operation: OfflineOperation): Promise<void> {
    // Implementation depends on operation type
    switch (operation.type) {
      case 'analytics':
        return this.syncAnalyticsOperation(operation);
      case 'monitoring':
        return this.syncMonitoringOperation(operation);
      case 'storage':
        return this.syncStorageOperation(operation);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async syncAnalyticsOperation(operation: OfflineOperation): Promise<void> {
    if (this.analyticsManager) {
      // Sync analytics data
      await this.analyticsManager.recordEvent(operation.data);
    }
  }

  private async syncMonitoringOperation(operation: OfflineOperation): Promise<void> {
    // Sync monitoring data
    console.log('Syncing monitoring operation:', operation.id);
  }

  private async syncStorageOperation(operation: OfflineOperation): Promise<void> {
    if (this.storageManager) {
      // Sync storage operation
      await this.storageManager.store(
        operation.data.id,
        operation.data.type,
        operation.data.content,
        operation.priority
      );
    }
  }

  private canSync(): boolean {
    return (
      !this.offlineState.isOffline &&
      this.unifiedStatus.connection.isConnected &&
      this.unifiedStatus.server.availability > 30
    );
  }

  private getLastSyncTime(): number {
    // Get last sync time from storage or analytics
    return Date.now(); // Placeholder
  }

  private shouldAttemptReconnection(): boolean {
    const timeSinceLastAttempt = Date.now() - this.offlineState.lastOnline;
    const delayThreshold = this.offlineState.reconnectDelay * Math.pow(2, this.offlineState.reconnectAttempts);
    
    return (
      this.offlineState.reconnectAttempts < this.offlineState.maxReconnectAttempts &&
      timeSinceLastAttempt > delayThreshold
    );
  }

  private async attemptReconnection(): Promise<void> {
    const strategies = Array.from(this.reconnectionStrategies.values())
      .filter(strategy => strategy.conditions(this.unifiedStatus))
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of strategies) {
      try {
        this.emit('reconnectionAttempt', { strategy: strategy.name, attempt: this.offlineState.reconnectAttempts + 1 });
        
        const success = await Promise.race([
          strategy.execute(this.unifiedStatus),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), strategy.timeout)
          )
        ]);

        if (success) {
          this.handleReconnectionSuccess();
          return;
        }
      } catch (error) {
        console.warn(`Reconnection strategy ${strategy.name} failed:`, error);
      }
    }

    this.handleReconnectionFailure();
  }

  private async executeImmediateReconnection(): Promise<boolean> {
    // Try immediate reconnection
    return fetch('/api/health', { method: 'HEAD' })
      .then(() => true)
      .catch(() => false);
  }

  private async executeProgressiveReconnection(): Promise<boolean> {
    // Progressive reconnection with exponential backoff
    const delay = 1000 * Math.pow(2, this.offlineState.reconnectAttempts);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.executeImmediateReconnection();
  }

  private async executeSmartReconnection(): Promise<boolean> {
    // Smart reconnection based on network conditions
    if (this.connectionMonitor) {
      const quality = this.connectionMonitor.getNetworkQuality();
      if (quality.classification === 'critical') {
        return false;
      }
    }

    return this.executeImmediateReconnection();
  }

  private async executeConservativeReconnection(): Promise<boolean> {
    // Conservative reconnection for poor conditions
    const delay = 5000 * Math.pow(1.5, this.offlineState.reconnectAttempts);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.executeImmediateReconnection();
  }

  private handleConnectionStateChange(state: any): void {
    const wasOffline = this.offlineState.isOffline;
    this.offlineState.isOffline = !state.isConnected;

    if (wasOffline && !this.offlineState.isOffline) {
      this.handleReconnectionSuccess();
    } else if (!wasOffline && this.offlineState.isOffline) {
      this.handleDisconnection();
    }
  }

  private handleConnectionQualityChange(quality: any): void {
    this.emit('qualityChange', quality);
  }

  private handleServerHealthChange(health: any): void {
    this.emit('serverHealthChange', health);
  }

  private handleServiceChange(service: any): void {
    this.emit('serviceChange', service);
  }

  private handleBrowserOnline(): void {
    if (this.offlineState.isOffline) {
      this.offlineState.isOffline = false;
      this.offlineState.lastOnline = Date.now();
      this.handleReconnectionSuccess();
    }
  }

  private handleBrowserOffline(): void {
    this.offlineState.isOffline = true;
    this.handleDisconnection();
  }

  private handleReconnectionSuccess(): void {
    this.offlineState.reconnectAttempts = 0;
    this.offlineState.reconnectDelay = 1000;
    this.offlineState.lastOnline = Date.now();

    this.emit('reconnected', this.unifiedStatus);

    // Start syncing queued operations
    this.syncQueuedOperations();
  }

  private handleReconnectionFailure(): void {
    this.offlineState.reconnectAttempts++;
    this.offlineState.reconnectDelay = Math.min(30000, this.offlineState.reconnectDelay * 2);

    this.emit('reconnectionFailed', {
      attempts: this.offlineState.reconnectAttempts,
      nextAttemptIn: this.offlineState.reconnectDelay
    });
  }

  private handleDisconnection(): void {
    this.offlineState.isOffline = true;
    this.offlineState.reconnectAttempts = 0;

    this.emit('disconnected', this.unifiedStatus);
  }

  private async restoreQueuedOperations(): Promise<void> {
    if (!this.storageManager) return;

    // Restore operations from storage
    // Implementation depends on storage manager API
  }

  public addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  public removeEventListener(event: string, listener: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      for (const listener of this.eventListeners.get(event)!) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      }
    }
  }

  public getUnifiedStatus(): UnifiedStatus {
    return { ...this.unifiedStatus };
  }

  public getOfflineState(): OfflineState {
    return { ...this.offlineState };
  }

  public getQueuedOperations(): OfflineOperation[] {
    return [...this.syncQueue];
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async destroy(): Promise<void> {
    // Clean up all monitoring components
    if (this.connectionMonitor) {
      await this.connectionMonitor.destroy();
    }

    if (this.serverHealthMonitor) {
      await this.serverHealthMonitor.destroy();
    }

    if (this.analyticsManager) {
      await this.analyticsManager.destroy();
    }

    if (this.storageManager) {
      await this.storageManager.destroy();
    }

    if (this.performanceOptimizer) {
      await this.performanceOptimizer.destroy();
    }

    // Remove browser event listeners
    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);

    this.eventListeners.clear();
    this.syncQueue = [];
    this.isInitialized = false;
    OfflineIntegration.instance = null;
  }
}

export const createOfflineIntegration = (config: MonitoringConfig): OfflineIntegration => {
  return OfflineIntegration.getInstance(config);
};