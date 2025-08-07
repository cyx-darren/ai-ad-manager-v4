/**
 * Storage Manager for MCP Session Monitoring
 * Handles multi-tier storage, data persistence, and retention management
 */

import { MonitoringConfig } from '../config/monitoringConfig';

export interface StorageLayer {
  name: string;
  priority: number;
  maxSize: number;
  retention: number; // in days
  compression: boolean;
  encryption: boolean;
}

export interface StorageEntry {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  priority: number;
}

export interface StorageStats {
  totalEntries: number;
  totalSize: number;
  compressionRatio: number;
  oldestEntry: number;
  newestEntry: number;
  layerStats: Map<string, {
    entries: number;
    size: number;
    lastCleanup: number;
  }>;
}

export class StorageManager {
  private static instance: StorageManager | null = null;
  private config: MonitoringConfig;
  private layers: Map<string, StorageLayer>;
  private compressionWorker: Worker | null = null;
  private encryptionKey: CryptoKey | null = null;
  private isInitialized = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.layers = new Map();
    this.initializeStorageLayers();
  }

  public static getInstance(config?: MonitoringConfig): StorageManager {
    if (!StorageManager.instance) {
      if (!config) {
        throw new Error('Config required for first StorageManager instantiation');
      }
      StorageManager.instance = new StorageManager(config);
    }
    return StorageManager.instance;
  }

  private initializeStorageLayers(): void {
    // Memory layer - fastest access, smallest capacity
    this.layers.set('memory', {
      name: 'memory',
      priority: 1,
      maxSize: 1024 * 1024, // 1MB
      retention: 0.25, // 6 hours
      compression: false,
      encryption: false
    });

    // LocalStorage layer - fast access, medium capacity
    this.layers.set('localStorage', {
      name: 'localStorage',
      priority: 2,
      maxSize: 5 * 1024 * 1024, // 5MB
      retention: 7, // 7 days
      compression: true,
      encryption: false
    });

    // IndexedDB layer - good access, large capacity
    this.layers.set('indexedDB', {
      name: 'indexedDB',
      priority: 3,
      maxSize: 50 * 1024 * 1024, // 50MB
      retention: 30, // 30 days
      compression: true,
      encryption: true
    });

    // Supabase layer - slow access, unlimited capacity
    this.layers.set('supabase', {
      name: 'supabase',
      priority: 4,
      maxSize: Infinity,
      retention: 365, // 1 year
      compression: true,
      encryption: true
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize compression worker
      if (typeof Worker !== 'undefined') {
        this.compressionWorker = new Worker(
          URL.createObjectURL(new Blob([this.getCompressionWorkerCode()], { type: 'application/javascript' }))
        );
      }

      // Initialize encryption key
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        this.encryptionKey = await this.generateEncryptionKey();
      }

      // Initialize IndexedDB
      await this.initializeIndexedDB();

      // Clean up expired data
      await this.performInitialCleanup();

      this.isInitialized = true;
      console.log('StorageManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize StorageManager:', error);
      throw error;
    }
  }

  public async store(
    id: string,
    type: string,
    data: any,
    priority: number = 3
  ): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry: StorageEntry = {
      id,
      type,
      data,
      timestamp: Date.now(),
      size: this.calculateSize(data),
      compressed: false,
      encrypted: false,
      priority
    };

    // Determine appropriate storage layer based on priority and size
    const targetLayers = this.selectStorageLayers(entry);

    let stored = false;
    for (const layerName of targetLayers) {
      try {
        const success = await this.storeInLayer(layerName, entry);
        if (success) {
          stored = true;
        }
      } catch (error) {
        console.warn(`Failed to store in ${layerName}:`, error);
      }
    }

    // Trigger cleanup if needed
    if (stored) {
      this.scheduleCleanup();
    }

    return stored;
  }

  public async retrieve(id: string, type?: string): Promise<any | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Search layers in priority order (fastest first)
    const sortedLayers = Array.from(this.layers.values())
      .sort((a, b) => a.priority - b.priority);

    for (const layer of sortedLayers) {
      try {
        const entry = await this.retrieveFromLayer(layer.name, id, type);
        if (entry) {
          // Update access timestamp for LRU
          await this.updateAccessTime(layer.name, id);
          return entry.data;
        }
      } catch (error) {
        console.warn(`Failed to retrieve from ${layer.name}:`, error);
      }
    }

    return null;
  }

  public async remove(id: string, type?: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let removed = false;
    for (const layerName of this.layers.keys()) {
      try {
        const success = await this.removeFromLayer(layerName, id, type);
        if (success) {
          removed = true;
        }
      } catch (error) {
        console.warn(`Failed to remove from ${layerName}:`, error);
      }
    }

    return removed;
  }

  public async clear(type?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    for (const layerName of this.layers.keys()) {
      try {
        await this.clearLayer(layerName, type);
      } catch (error) {
        console.warn(`Failed to clear ${layerName}:`, error);
      }
    }
  }

  public async getStats(): Promise<StorageStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stats: StorageStats = {
      totalEntries: 0,
      totalSize: 0,
      compressionRatio: 1,
      oldestEntry: Date.now(),
      newestEntry: 0,
      layerStats: new Map()
    };

    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const layerName of this.layers.keys()) {
      try {
        const layerStats = await this.getLayerStats(layerName);
        stats.layerStats.set(layerName, layerStats);
        stats.totalEntries += layerStats.entries;
        stats.totalSize += layerStats.size;
      } catch (error) {
        console.warn(`Failed to get stats for ${layerName}:`, error);
      }
    }

    if (totalOriginalSize > 0) {
      stats.compressionRatio = totalOriginalSize / totalCompressedSize;
    }

    return stats;
  }

  private selectStorageLayers(entry: StorageEntry): string[] {
    const layers: string[] = [];

    // Always try memory for high priority items
    if (entry.priority >= 4) {
      layers.push('memory');
    }

    // LocalStorage for medium-term storage
    if (entry.priority >= 3) {
      layers.push('localStorage');
    }

    // IndexedDB for persistent storage
    if (entry.priority >= 2) {
      layers.push('indexedDB');
    }

    // Supabase for long-term storage
    if (entry.priority >= 1) {
      layers.push('supabase');
    }

    return layers;
  }

  private async storeInLayer(layerName: string, entry: StorageEntry): Promise<boolean> {
    const layer = this.layers.get(layerName);
    if (!layer) return false;

    // Prepare entry for storage
    const preparedEntry = await this.prepareEntryForStorage(entry, layer);

    switch (layerName) {
      case 'memory':
        return this.storeInMemory(preparedEntry);
      case 'localStorage':
        return this.storeInLocalStorage(preparedEntry);
      case 'indexedDB':
        return this.storeInIndexedDB(preparedEntry);
      case 'supabase':
        return this.storeInSupabase(preparedEntry);
      default:
        return false;
    }
  }

  private async prepareEntryForStorage(entry: StorageEntry, layer: StorageLayer): Promise<StorageEntry> {
    let preparedEntry = { ...entry };

    // Compress if required
    if (layer.compression && !entry.compressed) {
      try {
        preparedEntry.data = await this.compress(entry.data);
        preparedEntry.compressed = true;
      } catch (error) {
        console.warn('Compression failed:', error);
      }
    }

    // Encrypt if required
    if (layer.encryption && !entry.encrypted && this.encryptionKey) {
      try {
        preparedEntry.data = await this.encrypt(preparedEntry.data);
        preparedEntry.encrypted = true;
      } catch (error) {
        console.warn('Encryption failed:', error);
      }
    }

    return preparedEntry;
  }

  private memoryStorage = new Map<string, StorageEntry>();

  private storeInMemory(entry: StorageEntry): boolean {
    try {
      const key = `${entry.type}:${entry.id}`;
      this.memoryStorage.set(key, entry);
      return true;
    } catch (error) {
      console.error('Memory storage failed:', error);
      return false;
    }
  }

  private storeInLocalStorage(entry: StorageEntry): boolean {
    try {
      const key = `mcp_storage:${entry.type}:${entry.id}`;
      localStorage.setItem(key, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error('LocalStorage failed:', error);
      return false;
    }
  }

  private async storeInIndexedDB(entry: StorageEntry): Promise<boolean> {
    try {
      const db = await this.getIndexedDB();
      const transaction = db.transaction(['monitoring_data'], 'readwrite');
      const store = transaction.objectStore('monitoring_data');
      
      await new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('IndexedDB storage failed:', error);
      return false;
    }
  }

  private async storeInSupabase(entry: StorageEntry): Promise<boolean> {
    // Implementation would depend on Supabase client setup
    // For now, return false to indicate not implemented
    console.log('Supabase storage not yet implemented');
    return false;
  }

  private async retrieveFromLayer(layerName: string, id: string, type?: string): Promise<StorageEntry | null> {
    switch (layerName) {
      case 'memory':
        return this.retrieveFromMemory(id, type);
      case 'localStorage':
        return this.retrieveFromLocalStorage(id, type);
      case 'indexedDB':
        return this.retrieveFromIndexedDB(id, type);
      case 'supabase':
        return this.retrieveFromSupabase(id, type);
      default:
        return null;
    }
  }

  private retrieveFromMemory(id: string, type?: string): StorageEntry | null {
    const key = type ? `${type}:${id}` : id;
    return this.memoryStorage.get(key) || null;
  }

  private retrieveFromLocalStorage(id: string, type?: string): StorageEntry | null {
    try {
      const key = type ? `mcp_storage:${type}:${id}` : `mcp_storage:${id}`;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('LocalStorage retrieval failed:', error);
      return null;
    }
  }

  private async retrieveFromIndexedDB(id: string, type?: string): Promise<StorageEntry | null> {
    try {
      const db = await this.getIndexedDB();
      const transaction = db.transaction(['monitoring_data'], 'readonly');
      const store = transaction.objectStore('monitoring_data');
      
      const result = await new Promise<StorageEntry | null>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      return result;
    } catch (error) {
      console.error('IndexedDB retrieval failed:', error);
      return null;
    }
  }

  private async retrieveFromSupabase(id: string, type?: string): Promise<StorageEntry | null> {
    // Implementation would depend on Supabase client setup
    console.log('Supabase retrieval not yet implemented');
    return null;
  }

  private async compress(data: any): Promise<string> {
    if (this.compressionWorker) {
      return new Promise((resolve, reject) => {
        this.compressionWorker!.postMessage({ action: 'compress', data });
        this.compressionWorker!.onmessage = (e) => {
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data.result);
          }
        };
      });
    } else {
      // Fallback: simple JSON string compression
      return JSON.stringify(data);
    }
  }

  private async encrypt(data: any): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const encoder = new TextEncoder();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      dataBuffer
    );

    const encryptedArray = new Uint8Array(encryptedBuffer);
    const resultArray = new Uint8Array(iv.length + encryptedArray.length);
    resultArray.set(iv);
    resultArray.set(encryptedArray, iv.length);

    return btoa(String.fromCharCode(...resultArray));
  }

  private async generateEncryptionKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private getCompressionWorkerCode(): string {
    return `
      self.onmessage = function(e) {
        const { action, data } = e.data;
        
        try {
          if (action === 'compress') {
            // Simple compression using JSON.stringify
            const result = JSON.stringify(data);
            self.postMessage({ result });
          } else {
            self.postMessage({ error: 'Unknown action' });
          }
        } catch (error) {
          self.postMessage({ error: error.message });
        }
      };
    `;
  }

  private indexedDBConnection: IDBDatabase | null = null;

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MCPMonitoringStorage', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDBConnection = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('monitoring_data')) {
          const store = db.createObjectStore('monitoring_data', { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async getIndexedDB(): Promise<IDBDatabase> {
    if (!this.indexedDBConnection) {
      await this.initializeIndexedDB();
    }
    return this.indexedDBConnection!;
  }

  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  private async updateAccessTime(layerName: string, id: string): Promise<void> {
    // Update access time for LRU cache management
    // Implementation depends on storage layer
  }

  private async removeFromLayer(layerName: string, id: string, type?: string): Promise<boolean> {
    // Implementation for removing entries from specific layer
    return false;
  }

  private async clearLayer(layerName: string, type?: string): Promise<void> {
    // Implementation for clearing layer
  }

  private async getLayerStats(layerName: string): Promise<{ entries: number; size: number; lastCleanup: number }> {
    // Implementation for getting layer statistics
    return { entries: 0, size: 0, lastCleanup: 0 };
  }

  private async performInitialCleanup(): Promise<void> {
    // Clean up expired data on initialization
  }

  private scheduleCleanup(): void {
    // Schedule periodic cleanup
  }

  public async destroy(): Promise<void> {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }

    if (this.indexedDBConnection) {
      this.indexedDBConnection.close();
      this.indexedDBConnection = null;
    }

    this.memoryStorage.clear();
    this.isInitialized = false;
    StorageManager.instance = null;
  }
}

export const createStorageManager = (config: MonitoringConfig): StorageManager => {
  return StorageManager.getInstance(config);
};