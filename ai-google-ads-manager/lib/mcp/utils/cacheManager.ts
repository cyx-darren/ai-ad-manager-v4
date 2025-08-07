/**
 * Cache Manager (Phase 4)
 * 
 * This file provides comprehensive data caching and persistence for offline access:
 * - Local data caching with configurable strategies
 * - Data persistence with storage backends
 * - Cache management and expiration
 * - Offline data synchronization preparation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Cache storage backend types
 */
export type CacheStorageBackend = 
  | 'memory'          // In-memory storage (session-only)
  | 'localStorage'    // Browser localStorage (persistent)
  | 'sessionStorage'  // Browser sessionStorage (tab-only)
  | 'indexedDB'       // IndexedDB (large data, persistent)
  | 'hybrid';         // Combination of multiple backends

/**
 * Cache expiration strategy
 */
export type CacheExpirationStrategy = 
  | 'ttl'             // Time-to-live based
  | 'lru'             // Least recently used
  | 'lfu'             // Least frequently used
  | 'manual'          // Manual invalidation only
  | 'smart';          // Intelligent based on data type

/**
 * Cache invalidation trigger
 */
export type CacheInvalidationTrigger = 
  | 'time_based'      // Expire after time duration
  | 'data_change'     // Invalidate when source data changes
  | 'user_action'     // Invalidate on specific user actions
  | 'network_restore' // Invalidate when network restored
  | 'manual';         // Manual invalidation only

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  key: string;
  created: number;
  lastAccessed: number;
  accessCount: number;
  expiresAt?: number;
  size: number;
  version: string;
  tags: string[];
  priority: number;
  source: string;
}

/**
 * Cache entry data
 */
export interface CacheEntry<T = any> {
  data: T;
  metadata: CacheEntryMetadata;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  backend: CacheStorageBackend;
  maxSize: number;              // Maximum cache size in bytes
  maxEntries: number;           // Maximum number of entries
  defaultTTL: number;           // Default time-to-live in milliseconds
  expirationStrategy: CacheExpirationStrategy;
  invalidationTriggers: CacheInvalidationTrigger[];
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistentKeys: string[];     // Keys that should persist across sessions
  volatileKeys: string[];       // Keys that should never persist
  syncEnabled: boolean;         // Enable synchronization with server
  maxSyncQueue: number;         // Maximum sync queue size
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  syncQueueSize: number;
  lastCleanup: number;
  memoryUsage: {
    memory: number;
    localStorage: number;
    sessionStorage: number;
    indexedDB: number;
  };
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache: boolean;
  metadata?: CacheEntryMetadata;
}

/**
 * Sync queue entry
 */
export interface SyncQueueEntry {
  id: string;
  operation: 'create' | 'update' | 'delete';
  key: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  backend: 'hybrid',
  maxSize: 50 * 1024 * 1024,     // 50MB
  maxEntries: 1000,
  defaultTTL: 30 * 60 * 1000,    // 30 minutes
  expirationStrategy: 'smart',
  invalidationTriggers: ['time_based', 'data_change'],
  compressionEnabled: true,
  encryptionEnabled: false,
  persistentKeys: ['user_preferences', 'dashboard_settings', 'ga4_metrics'],
  volatileKeys: ['session_temp', 'ui_state'],
  syncEnabled: true,
  maxSyncQueue: 100
};

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

/**
 * Main cache manager class
 */
export class CacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private syncQueue: SyncQueueEntry[];
  private cleanupInterval: number | null;
  private compressionWorker: Worker | null;
  private eventListeners: Map<string, Function[]>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.memoryCache = new Map();
    this.syncQueue = [];
    this.cleanupInterval = null;
    this.compressionWorker = null;
    this.eventListeners = new Map();
    
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      syncQueueSize: 0,
      lastCleanup: Date.now(),
      memoryUsage: {
        memory: 0,
        localStorage: 0,
        sessionStorage: 0,
        indexedDB: 0
      }
    };

    this.initialize();
  }

  /**
   * Initialize cache manager
   */
  private async initialize(): Promise<void> {
    try {
      // Start cleanup interval
      this.startCleanupInterval();
      
      // Initialize storage backends
      await this.initializeStorageBackends();
      
      // Load persistent data
      await this.loadPersistentData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize compression worker if needed
      if (this.config.compressionEnabled) {
        this.initializeCompressionWorker();
      }

      this.emit('initialized', { config: this.config });
    } catch (error) {
      console.error('Cache manager initialization failed:', error);
      this.emit('error', { error, context: 'initialization' });
    }
  }

  /**
   * Store data in cache
   */
  async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: number;
      persist?: boolean;
      compress?: boolean;
    } = {}
  ): Promise<CacheOperationResult<T>> {
    try {
      const now = Date.now();
      const ttl = options.ttl ?? this.config.defaultTTL;
      const expiresAt = ttl > 0 ? now + ttl : undefined;
      
      // Create cache entry
      const entry: CacheEntry<T> = {
        data,
        metadata: {
          key,
          created: now,
          lastAccessed: now,
          accessCount: 1,
          expiresAt,
          size: this.calculateSize(data),
          version: '1.0',
          tags: options.tags || [],
          priority: options.priority || 1,
          source: 'manual'
        }
      };

      // Compress data if enabled
      if (options.compress !== false && this.config.compressionEnabled) {
        entry.data = await this.compressData(data);
      }

      // Check cache limits
      await this.ensureCacheSpace(entry.metadata.size);

      // Store in appropriate backend(s)
      await this.storeInBackend(key, entry, options.persist);

      // Update in-memory cache
      this.memoryCache.set(key, entry);

      // Update statistics
      this.updateStats('set', entry.metadata.size);

      // Emit event
      this.emit('set', { key, data, metadata: entry.metadata });

      return {
        success: true,
        data,
        fromCache: false,
        metadata: entry.metadata
      };
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.emit('error', { error, context: 'set', key });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromCache: false
      };
    }
  }

  /**
   * Retrieve data from cache
   */
  async get<T>(key: string): Promise<CacheOperationResult<T>> {
    try {
      let entry: CacheEntry<T> | null = null;

      // Check memory cache first
      if (this.memoryCache.has(key)) {
        entry = this.memoryCache.get(key) as CacheEntry<T>;
      } else {
        // Check storage backends
        entry = await this.retrieveFromBackend<T>(key);
      }

      if (!entry) {
        this.updateStats('miss');
        return {
          success: false,
          error: 'Key not found in cache',
          fromCache: true
        };
      }

      // Check expiration
      if (this.isExpired(entry)) {
        await this.delete(key);
        this.updateStats('miss');
        return {
          success: false,
          error: 'Cache entry expired',
          fromCache: true
        };
      }

      // Update access metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;

      // Update in memory cache
      this.memoryCache.set(key, entry);

      // Decompress if needed
      let data = entry.data;
      if (this.config.compressionEnabled && this.isCompressed(data)) {
        data = await this.decompressData(data);
      }

      this.updateStats('hit');
      this.emit('get', { key, data, metadata: entry.metadata });

      return {
        success: true,
        data,
        fromCache: true,
        metadata: entry.metadata
      };
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.updateStats('miss');
      this.emit('error', { error, context: 'get', key });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromCache: true
      };
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const entry = this.memoryCache.get(key);
      
      // Remove from memory cache
      this.memoryCache.delete(key);

      // Remove from storage backends
      await this.removeFromBackend(key);

      // Update statistics
      if (entry) {
        this.updateStats('delete', -entry.metadata.size);
      }

      this.emit('delete', { key });
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      this.emit('error', { error, context: 'delete', key });
      return false;
    }
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<boolean> {
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear storage backends
      await this.clearAllBackends();

      // Reset statistics
      this.resetStats();

      this.emit('clear', {});
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      this.emit('error', { error, context: 'clear' });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateMemoryUsageStats();
    return { ...this.stats };
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;

    try {
      const keysToInvalidate: string[] = [];

      // Find entries with matching tags
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.metadata.tags.some(tag => tags.includes(tag))) {
          keysToInvalidate.push(key);
        }
      }

      // Delete matching entries
      for (const key of keysToInvalidate) {
        if (await this.delete(key)) {
          invalidatedCount++;
        }
      }

      this.emit('invalidate', { tags, count: invalidatedCount });
      return invalidatedCount;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.emit('error', { error, context: 'invalidate', tags });
      return invalidatedCount;
    }
  }

  /**
   * Queue operation for synchronization
   */
  queueSync(operation: 'create' | 'update' | 'delete', key: string, data?: any): void {
    if (!this.config.syncEnabled) return;

    const syncEntry: SyncQueueEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      key,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.syncQueue.push(syncEntry);
    
    // Limit queue size
    if (this.syncQueue.length > this.config.maxSyncQueue) {
      this.syncQueue = this.syncQueue.slice(-this.config.maxSyncQueue);
    }

    this.stats.syncQueueSize = this.syncQueue.length;
    this.emit('syncQueued', { entry: syncEntry });
  }

  /**
   * Process synchronization queue
   */
  async processSyncQueue(): Promise<{ processed: number; failed: number }> {
    if (!this.config.syncEnabled || this.syncQueue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    const entriesToProcess = [...this.syncQueue];
    this.syncQueue = [];

    for (const entry of entriesToProcess) {
      try {
        await this.processSyncEntry(entry);
        processed++;
      } catch (error) {
        console.error('Sync entry processing failed:', error);
        entry.retryCount++;
        
        if (entry.retryCount < entry.maxRetries) {
          this.syncQueue.push(entry);
        } else {
          failed++;
        }
      }
    }

    this.stats.syncQueueSize = this.syncQueue.length;
    this.emit('syncProcessed', { processed, failed });

    return { processed, failed };
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;

    try {
      const now = Date.now();
      const keysToClean: string[] = [];

      // Find expired entries
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.isExpired(entry)) {
          keysToClean.push(key);
        }
      }

      // Apply expiration strategy
      const additionalKeysToClean = this.applyExpirationStrategy();
      keysToClean.push(...additionalKeysToClean);

      // Remove expired entries
      for (const key of keysToClean) {
        if (await this.delete(key)) {
          cleanedCount++;
        }
      }

      this.stats.lastCleanup = now;
      this.emit('cleanup', { cleaned: cleanedCount });

      return cleanedCount;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      this.emit('error', { error, context: 'cleanup' });
      return cleanedCount;
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Terminate compression worker
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }

    // Clear all data
    this.memoryCache.clear();
    this.syncQueue = [];
    this.eventListeners.clear();

    this.emit('destroyed', {});
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private startCleanupInterval(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  private async initializeStorageBackends(): Promise<void> {
    // Initialize IndexedDB if using hybrid backend
    if (this.config.backend === 'hybrid' || this.config.backend === 'indexedDB') {
      await this.initializeIndexedDB();
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    // IndexedDB initialization would go here
    // Simplified for this implementation
  }

  private async loadPersistentData(): Promise<void> {
    try {
      for (const key of this.config.persistentKeys) {
        const entry = await this.retrieveFromBackend(key);
        if (entry && !this.isExpired(entry)) {
          this.memoryCache.set(key, entry);
        }
      }
    } catch (error) {
      console.error('Failed to load persistent data:', error);
    }
  }

  private setupEventListeners(): void {
    // Set up browser event listeners for cache management
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.savePersistentData();
      });

      window.addEventListener('online', () => {
        this.processSyncQueue();
      });
    }
  }

  private initializeCompressionWorker(): void {
    // Compression worker initialization would go here
    // Simplified for this implementation
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return JSON.stringify(data).length * 2; // Approximate UTF-16 size
    }
  }

  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    while (this.stats.totalSize + requiredSize > this.config.maxSize) {
      const evicted = this.evictEntries(1);
      if (evicted === 0) break; // No more entries to evict
    }
  }

  private evictEntries(count: number): number {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by priority and access patterns based on strategy
    entries.sort((a, b) => {
      switch (this.config.expirationStrategy) {
        case 'lru':
          return a[1].metadata.lastAccessed - b[1].metadata.lastAccessed;
        case 'lfu':
          return a[1].metadata.accessCount - b[1].metadata.accessCount;
        default:
          return a[1].metadata.priority - b[1].metadata.priority;
      }
    });

    let evicted = 0;
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.removeFromBackend(key);
      evicted++;
    }

    this.stats.evictionCount += evicted;
    return evicted;
  }

  private applyExpirationStrategy(): string[] {
    const keysToExpire: string[] = [];
    
    if (this.memoryCache.size <= this.config.maxEntries) {
      return keysToExpire;
    }

    const entriesToCheck = Array.from(this.memoryCache.entries());
    const excessCount = entriesToCheck.length - this.config.maxEntries;

    // Apply strategy-specific expiration
    switch (this.config.expirationStrategy) {
      case 'lru':
        entriesToCheck
          .sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed)
          .slice(0, excessCount)
          .forEach(([key]) => keysToExpire.push(key));
        break;
      
      case 'lfu':
        entriesToCheck
          .sort((a, b) => a[1].metadata.accessCount - b[1].metadata.accessCount)
          .slice(0, excessCount)
          .forEach(([key]) => keysToExpire.push(key));
        break;
      
      default:
        // Smart strategy combines multiple factors
        entriesToCheck
          .sort((a, b) => {
            const scoreA = this.calculateSmartScore(a[1]);
            const scoreB = this.calculateSmartScore(b[1]);
            return scoreA - scoreB;
          })
          .slice(0, excessCount)
          .forEach(([key]) => keysToExpire.push(key));
    }

    return keysToExpire;
  }

  private calculateSmartScore(entry: CacheEntry): number {
    const now = Date.now();
    const age = now - entry.metadata.created;
    const timeSinceAccess = now - entry.metadata.lastAccessed;
    
    // Lower score = higher chance of eviction
    return (
      entry.metadata.priority * 0.4 +
      entry.metadata.accessCount * 0.3 +
      (1 / (timeSinceAccess + 1)) * 0.2 +
      (1 / (age + 1)) * 0.1
    );
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.metadata.expiresAt) return false;
    return Date.now() > entry.metadata.expiresAt;
  }

  private async storeInBackend(key: string, entry: CacheEntry, persist?: boolean): Promise<void> {
    const shouldPersist = persist ?? this.config.persistentKeys.includes(key);
    const isVolatile = this.config.volatileKeys.includes(key);

    if (isVolatile) return; // Don't store volatile keys

    try {
      if (shouldPersist && typeof window !== 'undefined') {
        const serialized = JSON.stringify(entry);
        
        switch (this.config.backend) {
          case 'localStorage':
            localStorage.setItem(`cache_${key}`, serialized);
            break;
          case 'sessionStorage':
            sessionStorage.setItem(`cache_${key}`, serialized);
            break;
          case 'hybrid':
            if (entry.metadata.size < 1024 * 10) { // < 10KB
              localStorage.setItem(`cache_${key}`, serialized);
            } else {
              // Would use IndexedDB for larger items
              sessionStorage.setItem(`cache_${key}`, serialized);
            }
            break;
        }
      }
    } catch (error) {
      console.warn(`Failed to store ${key} in backend:`, error);
    }
  }

  private async retrieveFromBackend<T>(key: string): Promise<CacheEntry<T> | null> {
    if (typeof window === 'undefined') return null;

    try {
      let serialized: string | null = null;

      switch (this.config.backend) {
        case 'localStorage':
          serialized = localStorage.getItem(`cache_${key}`);
          break;
        case 'sessionStorage':
          serialized = sessionStorage.getItem(`cache_${key}`);
          break;
        case 'hybrid':
          serialized = localStorage.getItem(`cache_${key}`) || 
                      sessionStorage.getItem(`cache_${key}`);
          break;
      }

      if (serialized) {
        return JSON.parse(serialized) as CacheEntry<T>;
      }
    } catch (error) {
      console.warn(`Failed to retrieve ${key} from backend:`, error);
    }

    return null;
  }

  private async removeFromBackend(key: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(`cache_${key}`);
      sessionStorage.removeItem(`cache_${key}`);
      // Would also remove from IndexedDB if using it
    } catch (error) {
      console.warn(`Failed to remove ${key} from backend:`, error);
    }
  }

  private async clearAllBackends(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear cache entries from localStorage
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
      localKeys.forEach(key => localStorage.removeItem(key));

      // Clear cache entries from sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith('cache_'));
      sessionKeys.forEach(key => sessionStorage.removeItem(key));

      // Would also clear IndexedDB if using it
    } catch (error) {
      console.warn('Failed to clear storage backends:', error);
    }
  }

  private async savePersistentData(): Promise<void> {
    try {
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.config.persistentKeys.includes(key)) {
          await this.storeInBackend(key, entry, true);
        }
      }
    } catch (error) {
      console.error('Failed to save persistent data:', error);
    }
  }

  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete', sizeChange: number = 0): void {
    switch (operation) {
      case 'hit':
        this.stats.hitRate = (this.stats.hitRate * 0.9) + 0.1;
        this.stats.missRate = 1 - this.stats.hitRate;
        break;
      case 'miss':
        this.stats.missRate = (this.stats.missRate * 0.9) + 0.1;
        this.stats.hitRate = 1 - this.stats.missRate;
        break;
      case 'set':
        this.stats.totalEntries = this.memoryCache.size;
        this.stats.totalSize += sizeChange;
        break;
      case 'delete':
        this.stats.totalEntries = this.memoryCache.size;
        this.stats.totalSize += sizeChange;
        break;
    }
  }

  private updateMemoryUsageStats(): void {
    this.stats.memoryUsage.memory = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.metadata.size, 0);

    if (typeof window !== 'undefined') {
      try {
        // Estimate localStorage usage
        let localStorageSize = 0;
        for (const key in localStorage) {
          if (key.startsWith('cache_')) {
            localStorageSize += localStorage[key].length;
          }
        }
        this.stats.memoryUsage.localStorage = localStorageSize * 2; // UTF-16

        // Estimate sessionStorage usage
        let sessionStorageSize = 0;
        for (const key in sessionStorage) {
          if (key.startsWith('cache_')) {
            sessionStorageSize += sessionStorage[key].length;
          }
        }
        this.stats.memoryUsage.sessionStorage = sessionStorageSize * 2; // UTF-16
      } catch (error) {
        console.warn('Failed to calculate storage usage:', error);
      }
    }
  }

  private resetStats(): void {
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      syncQueueSize: 0,
      lastCleanup: Date.now(),
      memoryUsage: {
        memory: 0,
        localStorage: 0,
        sessionStorage: 0,
        indexedDB: 0
      }
    };
  }

  private async compressData(data: any): Promise<any> {
    // Compression implementation would go here
    // For now, return data as-is
    return data;
  }

  private async decompressData(data: any): Promise<any> {
    // Decompression implementation would go here
    // For now, return data as-is
    return data;
  }

  private isCompressed(data: any): boolean {
    // Check if data is compressed
    // For now, return false
    return false;
  }

  private async processSyncEntry(entry: SyncQueueEntry): Promise<void> {
    // Sync entry processing would go here
    // This would communicate with the server to synchronize data
    console.log('Processing sync entry:', entry);
  }
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Create a cache key from components
 */
export const createCacheKey = (...components: (string | number | boolean)[]): string => {
  return components
    .map(component => String(component))
    .join(':')
    .replace(/[^a-zA-Z0-9:_-]/g, '_');
};

/**
 * Get data type for cache tagging
 */
export const getDataTypeTag = (data: any): string => {
  if (Array.isArray(data)) return 'array';
  if (data && typeof data === 'object') {
    if (data.type) return `object:${data.type}`;
    return 'object';
  }
  return typeof data;
};

/**
 * Create cache tags from data
 */
export const createCacheTags = (data: any, additionalTags: string[] = []): string[] => {
  const tags = [getDataTypeTag(data), ...additionalTags];
  
  // Add specific tags based on data content
  if (data && typeof data === 'object') {
    if (data.source) tags.push(`source:${data.source}`);
    if (data.category) tags.push(`category:${data.category}`);
    if (data.userId) tags.push(`user:${data.userId}`);
  }
  
  return [...new Set(tags)]; // Remove duplicates
};

/**
 * Calculate cache priority based on data importance
 */
export const calculateCachePriority = (data: any, context: string = ''): number => {
  let priority = 1;
  
  // Higher priority for user-specific data
  if (context.includes('user') || (data && data.userId)) priority += 2;
  
  // Higher priority for recent data
  if (data && data.timestamp) {
    const age = Date.now() - data.timestamp;
    if (age < 60 * 60 * 1000) priority += 1; // Last hour
  }
  
  // Higher priority for frequently accessed data types
  if (context.includes('dashboard') || context.includes('metrics')) priority += 1;
  
  return Math.min(priority, 5); // Cap at 5
};

/**
 * Default cache manager instance
 */
let defaultCacheManager: CacheManager | null = null;

/**
 * Get or create default cache manager
 */
export const getCacheManager = (config?: Partial<CacheConfig>): CacheManager => {
  if (!defaultCacheManager) {
    defaultCacheManager = new CacheManager(config);
  }
  return defaultCacheManager;
};

/**
 * Destroy default cache manager
 */
export const destroyCacheManager = (): void => {
  if (defaultCacheManager) {
    defaultCacheManager.destroy();
    defaultCacheManager = null;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default CacheManager;