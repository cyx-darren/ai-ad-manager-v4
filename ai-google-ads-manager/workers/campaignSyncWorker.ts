/**
 * Background Campaign Sync Worker
 * Web Worker for background data synchronization and cache management
 * (Phase 7 of Subtask 29.3)
 */

import { Campaign } from '../lib/mcp/types/analytics';

interface SyncMessage {
  type: 'SYNC_REQUEST' | 'SYNC_RESPONSE' | 'SYNC_ERROR' | 'SYNC_STATUS' | 'CONFIG_UPDATE';
  data?: any;
  error?: string;
  timestamp: number;
  id: string;
}

interface SyncConfig {
  baseUrl: string;
  apiKey: string;
  refreshInterval: number; // ms
  retryAttempts: number;
  retryDelay: number; // ms
  enableDifferentialSync: boolean;
  enableOfflineQueue: boolean;
  maxQueueSize: number;
  compressionEnabled: boolean;
}

interface SyncStatus {
  isActive: boolean;
  lastSync: number;
  nextSync: number;
  syncCount: number;
  errorCount: number;
  queueSize: number;
  networkStatus: 'online' | 'offline';
}

interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  campaignId: string;
  data?: Partial<Campaign>;
  timestamp: number;
  retryCount: number;
}

class CampaignSyncWorker {
  private config: SyncConfig;
  private status: SyncStatus;
  private syncTimer?: NodeJS.Timeout;
  private operationQueue: QueuedOperation[] = [];
  private lastDataHash = '';
  private isProcessing = false;

  constructor() {
    this.config = {
      baseUrl: '',
      apiKey: '',
      refreshInterval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      enableDifferentialSync: true,
      enableOfflineQueue: true,
      maxQueueSize: 100,
      compressionEnabled: true
    };

    this.status = {
      isActive: false,
      lastSync: 0,
      nextSync: 0,
      syncCount: 0,
      errorCount: 0,
      queueSize: 0,
      networkStatus: 'online'
    };

    this.initializeWorker();
  }

  private initializeWorker(): void {
    // Listen for messages from main thread
    self.addEventListener('message', this.handleMessage.bind(this));
    
    // Monitor network status
    self.addEventListener('online', () => {
      this.status.networkStatus = 'online';
      this.processOfflineQueue();
    });
    
    self.addEventListener('offline', () => {
      this.status.networkStatus = 'offline';
    });
  }

  private handleMessage(event: MessageEvent<SyncMessage>): void {
    const { type, data, id } = event.data;

    switch (type) {
      case 'SYNC_REQUEST':
        this.handleSyncRequest(data, id);
        break;
      
      case 'CONFIG_UPDATE':
        this.updateConfig(data);
        break;
      
      default:
        this.sendError(`Unknown message type: ${type}`, id);
    }
  }

  private async handleSyncRequest(data: any, requestId: string): Promise<void> {
    try {
      const { action, payload } = data;

      switch (action) {
        case 'START_SYNC':
          await this.startSync(requestId);
          break;
        
        case 'STOP_SYNC':
          this.stopSync(requestId);
          break;
        
        case 'MANUAL_SYNC':
          await this.performManualSync(requestId);
          break;
        
        case 'QUEUE_OPERATION':
          this.queueOperation(payload, requestId);
          break;
        
        case 'GET_STATUS':
          this.sendStatus(requestId);
          break;
        
        default:
          this.sendError(`Unknown sync action: ${action}`, requestId);
      }
    } catch (error) {
      this.sendError(error instanceof Error ? error.message : 'Unknown error', requestId);
    }
  }

  private async startSync(requestId: string): Promise<void> {
    if (this.status.isActive) {
      this.sendResponse({ message: 'Sync already active' }, requestId);
      return;
    }

    this.status.isActive = true;
    this.scheduleNextSync();
    
    this.sendResponse({ 
      message: 'Sync started',
      status: this.status 
    }, requestId);
  }

  private stopSync(requestId: string): void {
    this.status.isActive = false;
    
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }

    this.sendResponse({ 
      message: 'Sync stopped',
      status: this.status 
    }, requestId);
  }

  private async performManualSync(requestId: string): Promise<void> {
    if (this.isProcessing) {
      this.sendError('Sync already in progress', requestId);
      return;
    }

    try {
      this.isProcessing = true;
      const result = await this.syncCampaigns();
      
      this.sendResponse({
        message: 'Manual sync completed',
        result,
        status: this.status
      }, requestId);
    } catch (error) {
      this.status.errorCount++;
      this.sendError(error instanceof Error ? error.message : 'Sync failed', requestId);
    } finally {
      this.isProcessing = false;
    }
  }

  private queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>, requestId: string): void {
    if (this.operationQueue.length >= this.config.maxQueueSize) {
      this.sendError('Operation queue is full', requestId);
      return;
    }

    const queuedOperation: QueuedOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    this.operationQueue.push(queuedOperation);
    this.status.queueSize = this.operationQueue.length;

    this.sendResponse({ 
      message: 'Operation queued',
      operationId: queuedOperation.id 
    }, requestId);

    // Process immediately if online
    if (this.status.networkStatus === 'online') {
      this.processOfflineQueue();
    }
  }

  private scheduleNextSync(): void {
    if (!this.status.isActive) return;

    this.status.nextSync = Date.now() + this.config.refreshInterval;
    
    this.syncTimer = setTimeout(async () => {
      if (this.status.isActive && !this.isProcessing) {
        try {
          await this.syncCampaigns();
        } catch (error) {
          this.status.errorCount++;
          console.error('Background sync failed:', error);
        }
      }
      this.scheduleNextSync();
    }, this.config.refreshInterval);
  }

  private async syncCampaigns(): Promise<{ updated: number; new: number; deleted: number }> {
    if (this.status.networkStatus === 'offline') {
      throw new Error('Network is offline');
    }

    const startTime = Date.now();
    
    try {
      // Fetch latest campaigns data
      const response = await this.fetchCampaignsData();
      const campaigns: Campaign[] = response.campaigns;
      const newDataHash = await this.calculateDataHash(campaigns);

      // Check if data has changed (differential sync)
      if (this.config.enableDifferentialSync && newDataHash === this.lastDataHash) {
        this.status.lastSync = Date.now();
        this.status.syncCount++;
        return { updated: 0, new: 0, deleted: 0 };
      }

      // Update cache with new data
      const result = await this.updateCacheData(campaigns);
      
      this.lastDataHash = newDataHash;
      this.status.lastSync = Date.now();
      this.status.syncCount++;

      // Process any queued operations
      await this.processOfflineQueue();

      return result;
    } catch (error) {
      this.status.errorCount++;
      throw error;
    }
  }

  private async fetchCampaignsData(): Promise<{ campaigns: Campaign[]; lastModified: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Add differential sync headers
    if (this.config.enableDifferentialSync && this.status.lastSync > 0) {
      headers['If-Modified-Since'] = new Date(this.status.lastSync).toISOString();
    }

    const response = await fetch(`${this.config.baseUrl}/api/campaigns`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Sync request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      campaigns: data.campaigns || [],
      lastModified: response.headers.get('Last-Modified') || new Date().toISOString()
    };
  }

  private async updateCacheData(campaigns: Campaign[]): Promise<{ updated: number; new: number; deleted: number }> {
    // Send data to main thread for cache update
    return new Promise((resolve) => {
      const requestId = this.generateId();
      
      const messageHandler = (event: MessageEvent<SyncMessage>) => {
        if (event.data.id === requestId && event.data.type === 'SYNC_RESPONSE') {
          self.removeEventListener('message', messageHandler);
          resolve(event.data.data);
        }
      };

      self.addEventListener('message', messageHandler);

      this.sendMessage({
        type: 'SYNC_REQUEST',
        data: {
          action: 'UPDATE_CACHE',
          campaigns: this.config.compressionEnabled ? this.compressData(campaigns) : campaigns
        },
        timestamp: Date.now(),
        id: requestId
      });
    });
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.status.networkStatus === 'offline' || this.operationQueue.length === 0) {
      return;
    }

    const operations = [...this.operationQueue];
    const processedIds: string[] = [];

    for (const operation of operations) {
      try {
        await this.processOperation(operation);
        processedIds.push(operation.id);
      } catch (error) {
        operation.retryCount++;
        
        if (operation.retryCount >= this.config.retryAttempts) {
          console.error(`Operation ${operation.id} failed after ${this.config.retryAttempts} attempts:`, error);
          processedIds.push(operation.id);
        } else {
          console.warn(`Operation ${operation.id} failed, retrying... (${operation.retryCount}/${this.config.retryAttempts})`);
        }
      }
    }

    // Remove processed operations from queue
    this.operationQueue = this.operationQueue.filter(op => !processedIds.includes(op.id));
    this.status.queueSize = this.operationQueue.length;
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    const { type, campaignId, data } = operation;
    const url = `${this.config.baseUrl}/api/campaigns/${campaignId}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let method: string;
    let body: string | undefined;

    switch (type) {
      case 'CREATE':
        method = 'POST';
        body = JSON.stringify(data);
        break;
      
      case 'UPDATE':
        method = 'PUT';
        body = JSON.stringify(data);
        break;
      
      case 'DELETE':
        method = 'DELETE';
        break;
      
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    const response = await fetch(url, {
      method,
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`Operation ${type} failed: ${response.status} ${response.statusText}`);
    }
  }

  private async calculateDataHash(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private compressData(data: any): string {
    // Simple compression using JSON stringify
    // In a real implementation, you might use a compression library
    return JSON.stringify(data);
  }

  private updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart sync with new interval if it changed
    if (newConfig.refreshInterval && this.status.isActive) {
      this.stopSync('config-update');
      this.startSync('config-update');
    }
  }

  private sendStatus(requestId: string): void {
    this.sendResponse({
      status: this.status,
      config: this.config,
      queueSize: this.operationQueue.length
    }, requestId);
  }

  private sendMessage(message: SyncMessage): void {
    self.postMessage(message);
  }

  private sendResponse(data: any, requestId: string): void {
    this.sendMessage({
      type: 'SYNC_RESPONSE',
      data,
      timestamp: Date.now(),
      id: requestId
    });
  }

  private sendError(error: string, requestId: string): void {
    this.sendMessage({
      type: 'SYNC_ERROR',
      error,
      timestamp: Date.now(),
      id: requestId
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Initialize worker
const worker = new CampaignSyncWorker();

// Export types for main thread
export type { SyncMessage, SyncConfig, SyncStatus, QueuedOperation };