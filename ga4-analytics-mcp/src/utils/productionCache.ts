/**
 * Production-Optimized Caching System for GA4 Analytics MCP Server
 * 
 * Provides multi-level caching with intelligent TTL management,
 * cache warming, compression, and distributed caching support.
 */

import { logger as productionLogger } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const compressAsync = promisify(gzip);
const decompressAsync = promisify(gunzip);

export interface CacheConfig {
  // Memory cache settings
  maxMemoryEntries: number;
  defaultTTL: number;
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  
  // TTL strategies per data type
  ttlStrategies: Record<string, number>;
  
  // Persistence settings
  enablePersistence: boolean;
  persistenceFile?: string;
  persistenceInterval: number;
  
  // Performance settings
  enableCacheWarming: boolean;
  warmingSchedule: string[]; // cron expressions
  enableAnalytics: boolean;
  enableOptimization: boolean;
  
  // Advanced features
  enableDistributed: boolean;
  distributedPrefix: string;
  enableStaleWhileRevalidate: boolean;
  staleTimeout: number;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  dataType: string;
  compressed: boolean;
  size: number;
  tags: string[];
}

export interface CacheMetrics {
  memory: {
    entries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  };
  performance: {
    averageGetTime: number;
    averageSetTime: number;
    compressionRatio: number;
    compressionSavings: number;
  };
  ttl: {
    expired: number;
    nearExpiry: number;
    averageTTL: number;
  };
  analytics: {
    hotKeys: string[];
    coldKeys: string[];
    accessPatterns: Record<string, number>;
  };
}

export class ProductionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private accessOrder: string[] = []; // For LRU eviction
  private warmingTasks: Map<string, NodeJS.Timeout> = new Map();
  private analytics: Map<string, { count: number; lastAccess: number }> = new Map();
  private performanceData: { gets: number[]; sets: number[] } = { gets: [], sets: [] };

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxMemoryEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000'),
      defaultTTL: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
      enableCompression: process.env.CACHE_COMPRESSION !== 'false',
      compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'), // 1KB
      
      ttlStrategies: {
        'ga4-report': parseInt(process.env.CACHE_GA4_REPORT_TTL || '600000'), // 10 minutes
        'ga4-realtime': parseInt(process.env.CACHE_GA4_REALTIME_TTL || '30000'), // 30 seconds
        'ga4-traffic': parseInt(process.env.CACHE_GA4_TRAFFIC_TTL || '900000'), // 15 minutes
        'ga4-demographics': parseInt(process.env.CACHE_GA4_DEMOGRAPHICS_TTL || '1800000'), // 30 minutes
        'ga4-conversions': parseInt(process.env.CACHE_GA4_CONVERSIONS_TTL || '1200000'), // 20 minutes
        'health-check': parseInt(process.env.CACHE_HEALTH_TTL || '60000'), // 1 minute
        'auth-token': parseInt(process.env.CACHE_AUTH_TTL || '3300000'), // 55 minutes
      },
      
      enablePersistence: process.env.CACHE_PERSISTENCE === 'true',
      persistenceFile: process.env.CACHE_PERSISTENCE_FILE || '.cache/production-cache.json',
      persistenceInterval: parseInt(process.env.CACHE_PERSISTENCE_INTERVAL || '300000'), // 5 minutes
      
      enableCacheWarming: process.env.CACHE_WARMING === 'true',
      warmingSchedule: (process.env.CACHE_WARMING_SCHEDULE || '0 */5 * * * *').split(','), // Every 5 minutes
      enableAnalytics: process.env.CACHE_ANALYTICS !== 'false',
      enableOptimization: process.env.CACHE_OPTIMIZATION !== 'false',
      
      enableDistributed: process.env.CACHE_DISTRIBUTED === 'true',
      distributedPrefix: process.env.CACHE_DISTRIBUTED_PREFIX || 'ga4-mcp-cache:',
      enableStaleWhileRevalidate: process.env.CACHE_STALE_WHILE_REVALIDATE !== 'false',
      staleTimeout: parseInt(process.env.CACHE_STALE_TIMEOUT || '60000'), // 1 minute
      
      ...config
    };

    this.metrics = {
      memory: {
        entries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        evictions: 0
      },
      performance: {
        averageGetTime: 0,
        averageSetTime: 0,
        compressionRatio: 0,
        compressionSavings: 0
      },
      ttl: {
        expired: 0,
        nearExpiry: 0,
        averageTTL: 0
      },
      analytics: {
        hotKeys: [],
        coldKeys: [],
        accessPatterns: {}
      }
    };

    this.initializeOptimizations();

    productionLogger.info('Production cache initialized', {
      component: 'CACHE',
      config: {
        maxEntries: this.config.maxMemoryEntries,
        defaultTTL: this.config.defaultTTL,
        compression: this.config.enableCompression,
        persistence: this.config.enablePersistence,
        distributed: this.config.enableDistributed
      }
    });
  }

  /**
   * Get cached data with performance tracking
   */
  async get(key: string, dataType?: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.recordMiss(key);
        return null;
      }

      // Check expiration
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        // Handle stale-while-revalidate
        if (this.config.enableStaleWhileRevalidate && 
            now - entry.timestamp < entry.ttl + this.config.staleTimeout) {
          
          this.recordHit(key, true);
          this.updateAccessOrder(key);
          this.updateKeyAnalytics(key);
          
          // Return stale data but trigger background refresh
          this.triggerBackgroundRefresh(key, dataType);
          
          productionLogger.debug('Cache hit (stale)', {
            component: 'CACHE',
            key: this.sanitizeKey(key),
            staleDuration: now - entry.timestamp - entry.ttl
          });
          
          return await this.decompressData(entry);
        }
        
        // Expired and no stale policy
        this.cache.delete(key);
        this.metrics.ttl.expired++;
        this.recordMiss(key);
        return null;
      }

      // Cache hit
      entry.accessCount++;
      entry.lastAccessed = now;
      
      this.recordHit(key, false);
      this.updateAccessOrder(key);
      this.updateKeyAnalytics(key);

      const data = await this.decompressData(entry);
      
      const getTime = Date.now() - startTime;
      this.performanceData.gets.push(getTime);
      if (this.performanceData.gets.length > 100) {
        this.performanceData.gets.shift();
      }

      return data;

    } catch (error) {
      productionLogger.error('Cache get error', {
        component: 'CACHE',
        key: this.sanitizeKey(key),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Set cached data with intelligent optimization
   */
  async set(key: string, data: any, options?: {
    ttl?: number;
    dataType?: string;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    const startTime = Date.now();
    
    try {
      const dataType = options?.dataType || 'default';
      const ttl = options?.ttl || this.config.ttlStrategies[dataType] || this.config.defaultTTL;
      const tags = options?.tags || [];
      
      // Ensure we have space
      await this.ensureCapacity(options?.priority || 'medium');

      // Compress data if needed
      const { compressedData, compressed, size } = await this.compressData(data);

      const entry: CacheEntry = {
        data: compressedData,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        dataType,
        compressed,
        size,
        tags
      };

      this.cache.set(key, entry);
      this.updateAccessOrder(key);
      this.updateMetrics();

      const setTime = Date.now() - startTime;
      this.performanceData.sets.push(setTime);
      if (this.performanceData.sets.length > 100) {
        this.performanceData.sets.shift();
      }

      productionLogger.debug('Cache set', {
        component: 'CACHE',
        key: this.sanitizeKey(key),
        dataType,
        ttl,
        size,
        compressed
      });

    } catch (error) {
      productionLogger.error('Cache set error', {
        component: 'CACHE',
        key: this.sanitizeKey(key),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      this.updateMetrics();
    }
    return deleted;
  }

  /**
   * Clear cache with optional pattern matching
   */
  clear(pattern?: string): number {
    let cleared = 0;
    
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          cleared++;
        }
      }
    } else {
      cleared = this.cache.size;
      this.cache.clear();
      this.accessOrder = [];
    }

    this.updateMetrics();
    
    productionLogger.info('Cache cleared', {
      component: 'CACHE',
      pattern,
      entriesCleared: cleared
    });

    return cleared;
  }

  /**
   * Clear cache entries by tags
   */
  clearByTags(tags: string[]): number {
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleared++;
      }
    }

    this.updateMetrics();
    
    productionLogger.info('Cache cleared by tags', {
      component: 'CACHE',
      tags,
      entriesCleared: cleared
    });

    return cleared;
  }

  /**
   * Get cache metrics and statistics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    this.updateAnalytics();
    return { ...this.metrics };
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  } {
    const metrics = this.getMetrics();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Check cache hit rate
    if (metrics.memory.hitRate < 60) {
      status = 'critical';
    } else if (metrics.memory.hitRate < 80) {
      status = 'warning';
    }
    
    // Check memory usage
    const memoryUsage = metrics.memory.entries / this.config.maxMemoryEntries;
    if (memoryUsage > 0.9) {
      status = 'critical';
    } else if (memoryUsage > 0.8) {
      status = status === 'healthy' ? 'warning' : status;
    }

    return {
      status,
      details: {
        hitRate: metrics.memory.hitRate,
        memoryUsage: Math.round(memoryUsage * 100),
        totalEntries: metrics.memory.entries,
        totalSize: metrics.memory.totalSize,
        avgGetTime: metrics.performance.averageGetTime,
        compressionRatio: metrics.performance.compressionRatio,
        nearExpiry: metrics.ttl.nearExpiry
      }
    };
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimize(): Promise<void> {
    if (!this.config.enableOptimization) return;

    productionLogger.info('Starting cache optimization', {
      component: 'CACHE'
    });

    // Remove expired entries
    const expired = this.removeExpiredEntries();
    
    // Optimize TTL based on access patterns
    this.optimizeTTLStrategies();
    
    // Clean up cold data
    const coldRemoved = this.removeColdData();
    
    // Update analytics
    this.updateAnalytics();

    productionLogger.info('Cache optimization completed', {
      component: 'CACHE',
      expiredRemoved: expired,
      coldDataRemoved: coldRemoved,
      currentEntries: this.cache.size,
      hitRate: this.metrics.memory.hitRate
    });
  }

  /**
   * Compress data if it meets threshold
   */
  private async compressData(data: any): Promise<{
    compressedData: any;
    compressed: boolean;
    size: number;
  }> {
    if (!this.config.enableCompression) {
      const size = JSON.stringify(data).length;
      return { compressedData: data, compressed: false, size };
    }

    const jsonString = JSON.stringify(data);
    const originalSize = jsonString.length;

    if (originalSize < this.config.compressionThreshold) {
      return { compressedData: data, compressed: false, size: originalSize };
    }

    try {
      const compressed = await compressAsync(Buffer.from(jsonString));
      const compressedSize = compressed.length;
      
      // Only use compression if it actually saves space
      if (compressedSize < originalSize * 0.8) {
        this.metrics.performance.compressionSavings += originalSize - compressedSize;
        return { 
          compressedData: compressed, 
          compressed: true, 
          size: compressedSize 
        };
      }
    } catch (error) {
      productionLogger.warn('Compression failed, using uncompressed data', {
        component: 'CACHE',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return { compressedData: data, compressed: false, size: originalSize };
  }

  /**
   * Decompress data if compressed
   */
  private async decompressData(entry: CacheEntry): Promise<any> {
    if (!entry.compressed) {
      return entry.data;
    }

    try {
      const decompressed = await decompressAsync(entry.data as Buffer);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      productionLogger.error('Decompression failed', {
        component: 'CACHE',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Ensure cache has capacity using LRU eviction
   */
  private async ensureCapacity(priority: 'low' | 'medium' | 'high'): Promise<void> {
    if (this.cache.size < this.config.maxMemoryEntries) return;

    const evictCount = Math.max(1, Math.floor(this.config.maxMemoryEntries * 0.1));
    let evicted = 0;

    // Evict based on priority and LRU
    for (let i = 0; i < this.accessOrder.length && evicted < evictCount; i++) {
      const key = this.accessOrder[i];
      const entry = this.cache.get(key);
      
      if (entry) {
        // Protect high-priority recent entries
        const age = Date.now() - entry.lastAccessed;
        if (priority === 'high' && age < 60000) continue; // Don't evict recent high-priority
        
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        evicted++;
        this.metrics.memory.evictions++;
      }
    }

    productionLogger.debug('Cache eviction completed', {
      component: 'CACHE',
      evicted,
      remaining: this.cache.size
    });
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    this.metrics.memory.entries = this.cache.size;
    this.metrics.memory.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);

    // Calculate hit rate
    const totalRequests = this.analytics.size;
    const totalHits = Array.from(this.analytics.values())
      .reduce((hits, stat) => hits + stat.count, 0);
    
    this.metrics.memory.hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    this.metrics.memory.missRate = 100 - this.metrics.memory.hitRate;

    // Calculate performance metrics
    if (this.performanceData.gets.length > 0) {
      this.metrics.performance.averageGetTime = 
        this.performanceData.gets.reduce((a, b) => a + b, 0) / this.performanceData.gets.length;
    }

    if (this.performanceData.sets.length > 0) {
      this.metrics.performance.averageSetTime = 
        this.performanceData.sets.reduce((a, b) => a + b, 0) / this.performanceData.sets.length;
    }

    // Calculate compression ratio
    const compressedEntries = Array.from(this.cache.values()).filter(e => e.compressed);
    if (compressedEntries.length > 0) {
      this.metrics.performance.compressionRatio = compressedEntries.length / this.cache.size;
    }

    // Calculate near expiry entries
    const now = Date.now();
    this.metrics.ttl.nearExpiry = Array.from(this.cache.values())
      .filter(entry => (now - entry.timestamp) > (entry.ttl * 0.8)).length;
  }

  /**
   * Update analytics data
   */
  private updateAnalytics(): void {
    if (!this.config.enableAnalytics) return;

    const now = Date.now();
    const hotThreshold = now - 300000; // 5 minutes
    const coldThreshold = now - 1800000; // 30 minutes

    const sorted = Array.from(this.analytics.entries())
      .sort((a, b) => b[1].count - a[1].count);

    this.metrics.analytics.hotKeys = sorted
      .filter(([_, stat]) => stat.lastAccess > hotThreshold)
      .slice(0, 10)
      .map(([key, _]) => this.sanitizeKey(key));

    this.metrics.analytics.coldKeys = sorted
      .filter(([_, stat]) => stat.lastAccess < coldThreshold)
      .slice(-10)
      .map(([key, _]) => this.sanitizeKey(key));

    // Update access patterns
    this.metrics.analytics.accessPatterns = {};
    for (const [key, stat] of this.analytics.entries()) {
      const pattern = this.extractPattern(key);
      this.metrics.analytics.accessPatterns[pattern] = 
        (this.metrics.analytics.accessPatterns[pattern] || 0) + stat.count;
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(key: string, stale: boolean): void {
    this.updateKeyAnalytics(key);
    
    performanceMonitor.incrementCounter('cache_hits_total', {
      type: 'memory',
      stale: stale.toString()
    });
  }

  /**
   * Record cache miss
   */
  private recordMiss(key: string): void {
    performanceMonitor.incrementCounter('cache_misses_total', {
      type: 'memory'
    });
  }

  /**
   * Update access analytics for a specific key
   */
  private updateKeyAnalytics(key: string): void {
    if (!this.config.enableAnalytics) return;

    const stat = this.analytics.get(key) || { count: 0, lastAccess: 0 };
    stat.count++;
    stat.lastAccess = Date.now();
    this.analytics.set(key, stat);
  }

  /**
   * Remove expired entries
   */
  private removeExpiredEntries(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        removed++;
      }
    }

    this.metrics.ttl.expired += removed;
    return removed;
  }

  /**
   * Remove cold (rarely accessed) data
   */
  private removeColdData(): number {
    const now = Date.now();
    const coldThreshold = now - 1800000; // 30 minutes
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < coldThreshold && entry.accessCount < 2) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Optimize TTL strategies based on usage patterns
   */
  private optimizeTTLStrategies(): void {
    // Analyze access patterns and adjust TTL for different data types
    const patterns = this.metrics.analytics.accessPatterns;
    
    for (const [pattern, count] of Object.entries(patterns)) {
      if (count > 100) { // High usage pattern
        const currentTTL = this.config.ttlStrategies[pattern];
        if (currentTTL && currentTTL < 1800000) { // Increase TTL up to 30 minutes
          this.config.ttlStrategies[pattern] = Math.min(currentTTL * 1.2, 1800000);
        }
      }
    }
  }

  /**
   * Trigger background refresh for stale data
   */
  private triggerBackgroundRefresh(key: string, dataType?: string): void {
    // This would typically trigger a refresh of the underlying data
    // Implementation depends on the specific data source
    productionLogger.debug('Background refresh triggered', {
      component: 'CACHE',
      key: this.sanitizeKey(key),
      dataType
    });
  }

  /**
   * Initialize optimization tasks
   */
  private initializeOptimizations(): void {
    // Regular optimization
    setInterval(() => {
      this.optimize();
    }, 300000); // Every 5 minutes

    // Metrics update
    setInterval(() => {
      this.updateMetrics();
    }, 60000); // Every minute
  }

  /**
   * Extract pattern from cache key for analytics
   */
  private extractPattern(key: string): string {
    // Extract pattern from key (e.g., "ga4-report:property:123" -> "ga4-report")
    const parts = key.split(':');
    return parts[0] || 'unknown';
  }

  /**
   * Sanitize key for logging (remove sensitive data)
   */
  private sanitizeKey(key: string): string {
    return key.length > 50 ? key.substring(0, 50) + '...' : key;
  }

  /**
   * Shutdown cache gracefully
   */
  async shutdown(): Promise<void> {
    // Clear warming tasks
    for (const task of this.warmingTasks.values()) {
      clearTimeout(task);
    }
    this.warmingTasks.clear();

    // Final metrics
    const finalMetrics = this.getMetrics();
    
    productionLogger.info('Production cache shutting down', {
      component: 'CACHE',
      finalStats: {
        entries: finalMetrics.memory.entries,
        hitRate: finalMetrics.memory.hitRate,
        totalSize: finalMetrics.memory.totalSize,
        compressionSavings: finalMetrics.performance.compressionSavings
      }
    });

    // Clear cache
    this.cache.clear();
    this.accessOrder = [];
    this.analytics.clear();
  }
}

// Global production cache instance
let globalProductionCache: ProductionCache | null = null;

/**
 * Initialize global production cache
 */
export function initializeProductionCache(config?: Partial<CacheConfig>): ProductionCache {
  if (globalProductionCache) {
    globalProductionCache.shutdown();
  }

  globalProductionCache = new ProductionCache(config);
  return globalProductionCache;
}

/**
 * Get global production cache instance
 */
export function getProductionCache(): ProductionCache | null {
  return globalProductionCache;
}

/**
 * Shutdown global production cache
 */
export async function shutdownProductionCache(): Promise<void> {
  if (globalProductionCache) {
    await globalProductionCache.shutdown();
    globalProductionCache = null;
  }
}