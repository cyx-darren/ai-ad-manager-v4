/**
 * Permission Cache
 * 
 * This file provides advanced permission caching system with TTL, LRU eviction,
 * multi-level storage, and atomic operations with transaction support.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions
} from './permissionTypes';

// ============================================================================
// CACHE CONFIGURATION TYPES
// ============================================================================

/**
 * Cache storage types
 */
export enum CacheStorageType {
  MEMORY = 'memory',
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB',
  SESSION_STORAGE = 'sessionStorage'
}

/**
 * Cache eviction policies
 */
export enum CacheEvictionPolicy {
  LRU = 'lru',           // Least Recently Used
  LFU = 'lfu',           // Least Frequently Used  
  FIFO = 'fifo',         // First In, First Out
  TTL_ONLY = 'ttl_only'  // Time To Live only
}

/**
 * Permission cache configuration
 */
export interface PermissionCacheConfig {
  /** Primary storage type */
  primaryStorage: CacheStorageType;
  /** Fallback storage types */
  fallbackStorage: CacheStorageType[];
  /** Enable multi-level caching */
  enableMultiLevel: boolean;
  /** Maximum cache size (number of entries) */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTtl: number;
  /** Eviction policy */
  evictionPolicy: CacheEvictionPolicy;
  /** Enable compression for large entries */
  enableCompression: boolean;
  /** Enable cache analytics */
  enableAnalytics: boolean;
  /** Enable atomic operations */
  enableAtomicOperations: boolean;
  /** Cache key prefix */
  keyPrefix: string;
  /** Enable encryption for sensitive data */
  enableEncryption: boolean;
  /** Encryption key (if encryption enabled) */
  encryptionKey?: string;
}

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  /** Entry key */
  key: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  lastAccessed: number;
  /** Access count */
  accessCount: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Entry size in bytes */
  size: number;
  /** Storage type used */
  storageType: CacheStorageType;
  /** Whether entry is compressed */
  compressed: boolean;
  /** Whether entry is encrypted */
  encrypted: boolean;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
  /** Entry value */
  value: T;
  /** Entry metadata */
  metadata: CacheEntryMetadata;
}

/**
 * Cache transaction
 */
export interface CacheTransaction {
  /** Transaction ID */
  id: string;
  /** Transaction start time */
  startTime: number;
  /** Operations in transaction */
  operations: CacheOperation[];
  /** Transaction status */
  status: 'pending' | 'committed' | 'aborted';
}

/**
 * Cache operation
 */
export interface CacheOperation {
  /** Operation type */
  type: 'set' | 'delete' | 'clear';
  /** Target key */
  key: string;
  /** Operation value (for set operations) */
  value?: any;
  /** Operation TTL (for set operations) */
  ttl?: number;
}

/**
 * Cache analytics
 */
export interface CacheAnalytics {
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Hit ratio */
  hitRatio: number;
  /** Total sets */
  sets: number;
  /** Total deletes */
  deletes: number;
  /** Total evictions */
  evictions: number;
  /** Current size */
  currentSize: number;
  /** Maximum size reached */
  maxSizeReached: number;
  /** Total storage used (bytes) */
  storageUsed: number;
  /** Average access time */
  avgAccessTime: number;
  /** Storage type statistics */
  storageStats: Map<CacheStorageType, {
    hits: number;
    misses: number;
    storageUsed: number;
  }>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: PermissionCacheConfig = {
  primaryStorage: CacheStorageType.MEMORY,
  fallbackStorage: [CacheStorageType.LOCAL_STORAGE, CacheStorageType.SESSION_STORAGE],
  enableMultiLevel: true,
  maxSize: 1000,
  defaultTtl: 30 * 60 * 1000, // 30 minutes
  evictionPolicy: CacheEvictionPolicy.LRU,
  enableCompression: false,
  enableAnalytics: true,
  enableAtomicOperations: true,
  keyPrefix: 'perm_cache_',
  enableEncryption: false
};

// ============================================================================
// PERMISSION CACHE CLASS
// ============================================================================

/**
 * Advanced permission caching system
 */
export class PermissionCache {
  private config: PermissionCacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private analytics: CacheAnalytics;
  private transactions: Map<string, CacheTransaction> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<PermissionCacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.analytics = this.initializeAnalytics();
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const prefixedKey = this.getPrefixedKey(key);

    try {
      // Try memory cache first
      let entry = this.memoryCache.get(prefixedKey);
      let storageType = CacheStorageType.MEMORY;

      // If not in memory, try other storage types
      if (!entry && this.config.enableMultiLevel) {
        const storageTypes = [this.config.primaryStorage, ...this.config.fallbackStorage];
        
        for (const storage of storageTypes) {
          if (storage === CacheStorageType.MEMORY) continue;
          
          entry = await this.getFromStorage(prefixedKey, storage);
          if (entry) {
            storageType = storage;
            // Promote to memory cache
            this.memoryCache.set(prefixedKey, entry);
            break;
          }
        }
      }

      if (!entry) {
        this.recordMiss(startTime);
        return null;
      }

      // Check expiration
      if (this.isExpired(entry)) {
        await this.delete(key);
        this.recordMiss(startTime);
        return null;
      }

      // Update access metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;

      this.recordHit(startTime, storageType);
      return entry.value;

    } catch (error) {
      console.error('[PERMISSION_CACHE] Get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    const effectiveTtl = ttl || this.config.defaultTtl;
    const now = Date.now();

    try {
      // Create cache entry
      const entry: CacheEntry<T> = {
        value,
        metadata: {
          key: prefixedKey,
          createdAt: now,
          lastAccessed: now,
          accessCount: 1,
          ttl: effectiveTtl,
          expiresAt: now + effectiveTtl,
          size: this.calculateSize(value),
          storageType: this.config.primaryStorage,
          compressed: false,
          encrypted: false
        }
      };

      // Apply compression if enabled
      if (this.config.enableCompression && entry.metadata.size > 1024) {
        entry.value = await this.compress(value);
        entry.metadata.compressed = true;
      }

      // Apply encryption if enabled
      if (this.config.enableEncryption && this.config.encryptionKey) {
        entry.value = await this.encrypt(entry.value);
        entry.metadata.encrypted = true;
      }

      // Check if eviction is needed
      if (this.memoryCache.size >= this.config.maxSize) {
        await this.evictEntries();
      }

      // Store in memory cache
      this.memoryCache.set(prefixedKey, entry);

      // Store in other storage levels if multi-level enabled
      if (this.config.enableMultiLevel) {
        const storageTypes = [this.config.primaryStorage, ...this.config.fallbackStorage];
        
        for (const storage of storageTypes) {
          if (storage === CacheStorageType.MEMORY) continue;
          await this.setInStorage(prefixedKey, entry, storage);
        }
      }

      this.analytics.sets++;
      this.analytics.currentSize = this.memoryCache.size;
      this.analytics.storageUsed += entry.metadata.size;

      return true;

    } catch (error) {
      console.error('[PERMISSION_CACHE] Set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);

    try {
      // Remove from memory cache
      const memoryEntry = this.memoryCache.get(prefixedKey);
      if (memoryEntry) {
        this.memoryCache.delete(prefixedKey);
        this.analytics.storageUsed -= memoryEntry.metadata.size;
      }

      // Remove from other storage levels
      if (this.config.enableMultiLevel) {
        const storageTypes = [this.config.primaryStorage, ...this.config.fallbackStorage];
        
        for (const storage of storageTypes) {
          if (storage === CacheStorageType.MEMORY) continue;
          await this.deleteFromStorage(prefixedKey, storage);
        }
      }

      this.analytics.deletes++;
      this.analytics.currentSize = this.memoryCache.size;

      return true;

    } catch (error) {
      console.error('[PERMISSION_CACHE] Delete error:', error);
      return false;
    }
  }

  /**
   * Clear entire cache
   */
  public async clear(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear other storage levels
      if (this.config.enableMultiLevel) {
        const storageTypes = [this.config.primaryStorage, ...this.config.fallbackStorage];
        
        for (const storage of storageTypes) {
          if (storage === CacheStorageType.MEMORY) continue;
          await this.clearStorage(storage);
        }
      }

      // Reset analytics
      this.analytics.currentSize = 0;
      this.analytics.storageUsed = 0;

    } catch (error) {
      console.error('[PERMISSION_CACHE] Clear error:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  public async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.memoryCache.size;
  }

  /**
   * Get cache keys
   */
  public keys(): string[] {
    return Array.from(this.memoryCache.keys()).map(key => 
      key.startsWith(this.config.keyPrefix) 
        ? key.substring(this.config.keyPrefix.length)
        : key
    );
  }

  /**
   * Get cache analytics
   */
  public getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  /**
   * Start transaction
   */
  public beginTransaction(): string {
    if (!this.config.enableAtomicOperations) {
      throw new Error('Atomic operations not enabled');
    }

    const transactionId = this.generateTransactionId();
    const transaction: CacheTransaction = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      status: 'pending'
    };

    this.transactions.set(transactionId, transaction);
    return transactionId;
  }

  /**
   * Add operation to transaction
   */
  public addToTransaction(transactionId: string, operation: CacheOperation): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== 'pending') {
      throw new Error('Invalid transaction');
    }

    transaction.operations.push(operation);
  }

  /**
   * Commit transaction
   */
  public async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== 'pending') {
      throw new Error('Invalid transaction');
    }

    try {
      // Execute all operations
      for (const operation of transaction.operations) {
        switch (operation.type) {
          case 'set':
            await this.set(operation.key, operation.value, operation.ttl);
            break;
          case 'delete':
            await this.delete(operation.key);
            break;
          case 'clear':
            await this.clear();
            break;
        }
      }

      transaction.status = 'committed';
      return true;

    } catch (error) {
      transaction.status = 'aborted';
      console.error('[PERMISSION_CACHE] Transaction commit error:', error);
      return false;
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Abort transaction
   */
  public abortTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.status = 'aborted';
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Cleanup expired entries
   */
  public async cleanup(): Promise<number> {
    let removedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }

    this.analytics.currentSize = this.memoryCache.size;
    return removedCount;
  }

  /**
   * Get cache optimization suggestions
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const analytics = this.analytics;

    // Hit ratio suggestions
    if (analytics.hitRatio < 0.7) {
      suggestions.push('Consider increasing cache TTL or size to improve hit ratio');
    }

    // Size optimization
    if (analytics.currentSize >= this.config.maxSize * 0.9) {
      suggestions.push('Cache is near capacity, consider increasing maxSize or enabling compression');
    }

    // Storage optimization
    if (analytics.storageUsed > 50 * 1024 * 1024 && !this.config.enableCompression) {
      suggestions.push('Enable compression to reduce storage usage');
    }

    // Access pattern optimization
    if (analytics.avgAccessTime > 10) {
      suggestions.push('Consider optimizing cache access patterns or reducing cache complexity');
    }

    return suggestions;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Initialize analytics
   */
  private initializeAnalytics(): CacheAnalytics {
    return {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      maxSizeReached: 0,
      storageUsed: 0,
      avgAccessTime: 0,
      storageStats: new Map()
    };
  }

  /**
   * Get prefixed key
   */
  private getPrefixedKey(key: string): string {
    return this.config.keyPrefix + key;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.metadata.expiresAt;
  }

  /**
   * Calculate entry size
   */
  private calculateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return JSON.stringify(value).length * 2; // Rough estimate
    }
  }

  /**
   * Compress value
   */
  private async compress<T>(value: T): Promise<any> {
    // Simplified compression (in real implementation, use proper compression library)
    try {
      const jsonString = JSON.stringify(value);
      // Return compressed representation (placeholder)
      return { __compressed: true, data: jsonString };
    } catch (error) {
      return value; // Return original if compression fails
    }
  }

  /**
   * Decompress value
   */
  private async decompress<T>(value: any): Promise<T> {
    try {
      if (value && value.__compressed) {
        return JSON.parse(value.data);
      }
      return value;
    } catch (error) {
      return value; // Return original if decompression fails
    }
  }

  /**
   * Encrypt value
   */
  private async encrypt(value: any): Promise<any> {
    // Simplified encryption (in real implementation, use proper encryption)
    if (!this.config.encryptionKey) {
      return value;
    }
    
    try {
      const jsonString = JSON.stringify(value);
      // Return encrypted representation (placeholder)
      return { __encrypted: true, data: btoa(jsonString) };
    } catch (error) {
      return value; // Return original if encryption fails
    }
  }

  /**
   * Decrypt value
   */
  private async decrypt(value: any): Promise<any> {
    try {
      if (value && value.__encrypted) {
        return JSON.parse(atob(value.data));
      }
      return value;
    } catch (error) {
      return value; // Return original if decryption fails
    }
  }

  /**
   * Get value from storage
   */
  private async getFromStorage(key: string, storageType: CacheStorageType): Promise<CacheEntry | null> {
    try {
      let storedValue: string | null = null;

      switch (storageType) {
        case CacheStorageType.LOCAL_STORAGE:
          storedValue = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          break;
        case CacheStorageType.SESSION_STORAGE:
          storedValue = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
          break;
        case CacheStorageType.INDEXED_DB:
          // Implement IndexedDB access (placeholder)
          storedValue = null;
          break;
      }

      if (!storedValue) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(storedValue);
      
      // Decompress if needed
      if (entry.metadata.compressed) {
        entry.value = await this.decompress(entry.value);
      }

      // Decrypt if needed
      if (entry.metadata.encrypted) {
        entry.value = await this.decrypt(entry.value);
      }

      return entry;

    } catch (error) {
      console.error('[PERMISSION_CACHE] Storage get error:', error);
      return null;
    }
  }

  /**
   * Set value in storage
   */
  private async setInStorage(key: string, entry: CacheEntry, storageType: CacheStorageType): Promise<void> {
    try {
      const serialized = JSON.stringify(entry);

      switch (storageType) {
        case CacheStorageType.LOCAL_STORAGE:
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, serialized);
          }
          break;
        case CacheStorageType.SESSION_STORAGE:
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, serialized);
          }
          break;
        case CacheStorageType.INDEXED_DB:
          // Implement IndexedDB storage (placeholder)
          break;
      }
    } catch (error) {
      console.error('[PERMISSION_CACHE] Storage set error:', error);
    }
  }

  /**
   * Delete value from storage
   */
  private async deleteFromStorage(key: string, storageType: CacheStorageType): Promise<void> {
    try {
      switch (storageType) {
        case CacheStorageType.LOCAL_STORAGE:
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
          }
          break;
        case CacheStorageType.SESSION_STORAGE:
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(key);
          }
          break;
        case CacheStorageType.INDEXED_DB:
          // Implement IndexedDB deletion (placeholder)
          break;
      }
    } catch (error) {
      console.error('[PERMISSION_CACHE] Storage delete error:', error);
    }
  }

  /**
   * Clear storage
   */
  private async clearStorage(storageType: CacheStorageType): Promise<void> {
    try {
      const prefix = this.config.keyPrefix;

      switch (storageType) {
        case CacheStorageType.LOCAL_STORAGE:
          if (typeof localStorage !== 'undefined') {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          }
          break;
        case CacheStorageType.SESSION_STORAGE:
          if (typeof sessionStorage !== 'undefined') {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
          }
          break;
        case CacheStorageType.INDEXED_DB:
          // Implement IndexedDB clearing (placeholder)
          break;
      }
    } catch (error) {
      console.error('[PERMISSION_CACHE] Storage clear error:', error);
    }
  }

  /**
   * Evict entries based on policy
   */
  private async evictEntries(): Promise<void> {
    const entriesToEvict = Math.ceil(this.config.maxSize * 0.1); // Evict 10%
    const entries = Array.from(this.memoryCache.entries());

    let sortedEntries: [string, CacheEntry][] = [];

    switch (this.config.evictionPolicy) {
      case CacheEvictionPolicy.LRU:
        sortedEntries = entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);
        break;
      case CacheEvictionPolicy.LFU:
        sortedEntries = entries.sort((a, b) => a[1].metadata.accessCount - b[1].metadata.accessCount);
        break;
      case CacheEvictionPolicy.FIFO:
        sortedEntries = entries.sort((a, b) => a[1].metadata.createdAt - b[1].metadata.createdAt);
        break;
      case CacheEvictionPolicy.TTL_ONLY:
        // Only evict expired entries
        const now = Date.now();
        sortedEntries = entries.filter(([_, entry]) => entry.metadata.expiresAt < now);
        break;
    }

    for (let i = 0; i < Math.min(entriesToEvict, sortedEntries.length); i++) {
      const [key, entry] = sortedEntries[i];
      this.memoryCache.delete(key);
      this.analytics.storageUsed -= entry.metadata.size;
      this.analytics.evictions++;
    }

    this.analytics.currentSize = this.memoryCache.size;
    this.analytics.maxSizeReached = Math.max(this.analytics.maxSizeReached, this.analytics.currentSize);
  }

  /**
   * Record cache hit
   */
  private recordHit(startTime: number, storageType: CacheStorageType): void {
    this.analytics.hits++;
    this.updateHitRatio();
    
    const accessTime = Date.now() - startTime;
    this.analytics.avgAccessTime = (this.analytics.avgAccessTime + accessTime) / 2;

    // Update storage stats
    if (!this.analytics.storageStats.has(storageType)) {
      this.analytics.storageStats.set(storageType, { hits: 0, misses: 0, storageUsed: 0 });
    }
    this.analytics.storageStats.get(storageType)!.hits++;
  }

  /**
   * Record cache miss
   */
  private recordMiss(startTime: number): void {
    this.analytics.misses++;
    this.updateHitRatio();
    
    const accessTime = Date.now() - startTime;
    this.analytics.avgAccessTime = (this.analytics.avgAccessTime + accessTime) / 2;
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    const total = this.analytics.hits + this.analytics.misses;
    this.analytics.hitRatio = total > 0 ? this.analytics.hits / total : 0;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy cache instance
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memoryCache.clear();
    this.transactions.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating permission caches
 */
export class PermissionCacheFactory {
  /**
   * Create standard cache
   */
  public static createStandard(config?: Partial<PermissionCacheConfig>): PermissionCache {
    return new PermissionCache(config);
  }

  /**
   * Create high-performance cache
   */
  public static createHighPerformance(): PermissionCache {
    return new PermissionCache({
      primaryStorage: CacheStorageType.MEMORY,
      fallbackStorage: [],
      enableMultiLevel: false,
      maxSize: 5000,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      evictionPolicy: CacheEvictionPolicy.LRU,
      enableCompression: true,
      enableAnalytics: true,
      enableAtomicOperations: true
    });
  }

  /**
   * Create persistent cache
   */
  public static createPersistent(): PermissionCache {
    return new PermissionCache({
      primaryStorage: CacheStorageType.LOCAL_STORAGE,
      fallbackStorage: [CacheStorageType.MEMORY, CacheStorageType.SESSION_STORAGE],
      enableMultiLevel: true,
      maxSize: 2000,
      defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
      evictionPolicy: CacheEvictionPolicy.LRU,
      enableCompression: true,
      enableAnalytics: true,
      enableAtomicOperations: true,
      enableEncryption: true
    });
  }
}

/**
 * Create a standard permission cache
 */
export function createPermissionCache(config?: Partial<PermissionCacheConfig>): PermissionCache {
  return PermissionCacheFactory.createStandard(config);
}

/**
 * Global permission cache instance (singleton pattern)
 */
let globalPermissionCache: PermissionCache | null = null;

/**
 * Get global permission cache instance
 */
export function getGlobalPermissionCache(): PermissionCache {
  if (!globalPermissionCache) {
    globalPermissionCache = createPermissionCache();
  }
  return globalPermissionCache;
}

/**
 * Set global permission cache instance
 */
export function setGlobalPermissionCache(cache: PermissionCache): void {
  if (globalPermissionCache) {
    globalPermissionCache.destroy();
  }
  globalPermissionCache = cache;
}