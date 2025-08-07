/**
 * Enhanced Campaign Data Cache System
 * Intelligent caching with LRU eviction, tiered storage, and background refresh
 * (Phase 7 of Subtask 29.3)
 */

import { Campaign } from '../types/analytics';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  key: string;
  size: number;
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  defaultTTL: number; // Default TTL in milliseconds
  maxEntries: number; // Maximum number of entries
  enableIndexedDB: boolean; // Enable IndexedDB for persistent storage
  enableBackgroundRefresh: boolean; // Enable background refresh
  refreshInterval: number; // Background refresh interval in ms
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
}

interface CacheFilter {
  search?: string;
  status?: string[];
  type?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  budgetRange?: {
    min: number;
    max: number;
  };
  spendRange?: {
    min: number;
    max: number;
  };
}

interface CacheSort {
  column: string;
  direction: 'asc' | 'desc';
}

export class CampaignDataCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private indexedDB?: IDBDatabase;
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50, // 50MB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxEntries: 1000,
      enableIndexedDB: true,
      enableBackgroundRefresh: true,
      refreshInterval: 30 * 1000, // 30 seconds
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0
    };

    this.initIndexedDB();
    this.startBackgroundRefresh();
  }

  /**
   * Get campaigns with filters and sorting
   */
  async get(
    key: string,
    filters?: CacheFilter,
    sort?: CacheSort,
    page?: { offset: number; limit: number }
  ): Promise<Campaign[] | null> {
    const cacheKey = this.buildCacheKey(key, filters, sort, page);
    const entry = this.cache.get(cacheKey);

    if (entry && !this.isExpired(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.metrics.hits++;
      this.updateHitRate();
      return entry.data;
    }

    // Try IndexedDB if memory cache miss
    if (this.config.enableIndexedDB && this.indexedDB) {
      const persistedData = await this.getFromIndexedDB(cacheKey);
      if (persistedData) {
        this.set(cacheKey, persistedData, this.config.defaultTTL);
        return persistedData;
      }
    }

    this.metrics.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set campaigns in cache
   */
  async set(
    key: string,
    data: Campaign[],
    ttl: number = this.config.defaultTTL,
    filters?: CacheFilter,
    sort?: CacheSort,
    page?: { offset: number; limit: number }
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(key, filters, sort, page);
    const size = this.calculateSize(data);
    
    // Check if we need to evict entries
    this.evictIfNeeded(size);

    const entry: CacheEntry<Campaign[]> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      ttl,
      key: cacheKey,
      size
    };

    this.cache.set(cacheKey, entry);
    this.metrics.size += size;
    this.metrics.entries++;

    // Store in IndexedDB for persistence
    if (this.config.enableIndexedDB && this.indexedDB) {
      await this.setInIndexedDB(cacheKey, data, ttl);
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string | RegExp): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const matches = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);

      if (matches) {
        keysToDelete.push(key);
        this.metrics.size -= entry.size;
        this.metrics.entries--;
        invalidated++;
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    return invalidated;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0
    };

    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['campaigns'], 'readwrite');
      const objectStore = transaction.objectStore('campaigns');
      objectStore.clear();
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Warm up cache with initial data
   */
  async warmUp(dataLoader: () => Promise<Campaign[]>): Promise<void> {
    try {
      const data = await dataLoader();
      await this.set('campaigns:all', data);
    } catch (error) {
      console.error('Cache warm-up failed:', error);
    }
  }

  /**
   * Update campaign data incrementally
   */
  async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<void> {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.data && Array.isArray(entry.data)) {
        const campaigns = entry.data as Campaign[];
        const index = campaigns.findIndex(c => c.id === campaignId);
        
        if (index !== -1) {
          campaigns[index] = { ...campaigns[index], ...updates };
          entry.lastAccessed = Date.now();
          
          // Update in IndexedDB
          if (this.config.enableIndexedDB && this.indexedDB) {
            await this.setInIndexedDB(key, campaigns, entry.ttl);
          }
        }
      }
    }
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(
    baseKey: string,
    filters?: CacheFilter,
    sort?: CacheSort,
    page?: { offset: number; limit: number }
  ): string {
    const parts = [baseKey];

    if (filters) {
      if (filters.search) parts.push(`search:${filters.search}`);
      if (filters.status?.length) parts.push(`status:${filters.status.join(',')}`);
      if (filters.type?.length) parts.push(`type:${filters.type.join(',')}`);
      if (filters.dateRange) {
        parts.push(`date:${filters.dateRange.start.toISOString()}-${filters.dateRange.end.toISOString()}`);
      }
      if (filters.budgetRange) {
        parts.push(`budget:${filters.budgetRange.min}-${filters.budgetRange.max}`);
      }
      if (filters.spendRange) {
        parts.push(`spend:${filters.spendRange.min}-${filters.spendRange.max}`);
      }
    }

    if (sort) {
      parts.push(`sort:${sort.column}:${sort.direction}`);
    }

    if (page) {
      parts.push(`page:${page.offset}:${page.limit}`);
    }

    return parts.join('|');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Evict entries using LRU strategy
   */
  private evictIfNeeded(newEntrySize: number): void {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;
    
    while (
      (this.metrics.size + newEntrySize > maxSizeBytes || 
       this.metrics.entries >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.cache.delete(oldestKey);
        this.metrics.size -= entry.size;
        this.metrics.entries--;
        this.metrics.evictions++;
      }
    }
  }

  /**
   * Update hit rate metric
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Initialize IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    if (!this.config.enableIndexedDB || typeof indexedDB === 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CampaignCache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('campaigns')) {
          const objectStore = db.createObjectStore('campaigns', { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Get data from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<Campaign[] | null> {
    if (!this.indexedDB) return null;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['campaigns'], 'readonly');
      const objectStore = transaction.objectStore('campaigns');
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && !this.isExpired(result)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Set data in IndexedDB
   */
  private async setInIndexedDB(key: string, data: Campaign[], ttl: number): Promise<void> {
    if (!this.indexedDB) return;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['campaigns'], 'readwrite');
      const objectStore = transaction.objectStore('campaigns');
      
      const entry = {
        key,
        data,
        timestamp: Date.now(),
        ttl
      };

      const request = objectStore.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Fail silently
    });
  }

  /**
   * Start background refresh timer
   */
  private startBackgroundRefresh(): void {
    if (!this.config.enableBackgroundRefresh) return;

    this.refreshTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.refreshInterval);
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
        this.metrics.size -= entry.size;
        this.metrics.entries--;
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.indexedDB) {
      this.indexedDB.close();
    }

    this.cache.clear();
  }
}

// Export singleton instance
export const campaignDataCache = new CampaignDataCache();
export default campaignDataCache;