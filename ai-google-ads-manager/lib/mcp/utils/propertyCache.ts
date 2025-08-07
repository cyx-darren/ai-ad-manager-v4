/**
 * GA4 Property Cache Utilities
 * 
 * Efficient caching system for GA4 properties with TTL, LRU eviction,
 * persistence, and intelligent refresh strategies.
 */

// Cache utility types
export type CacheKey = string;
export type CacheValue<T> = T | null;

export interface CacheOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

import {
  GA4Property,
  PropertyCache,
  CachedProperty,
  PropertyCacheMetadata,
  PropertyCacheConfig,
  PropertyError,
  PropertyErrorCode,
  DEFAULT_PROPERTY_CACHE_CONFIG
} from '../types/property';

// Property Cache Service
export class PropertyCacheService {
  private cache: Map<string, CachedProperty> = new Map();
  private config: PropertyCacheConfig;
  private metadata: PropertyCacheMetadata;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<PropertyCacheConfig>) {
    this.config = { ...DEFAULT_PROPERTY_CACHE_CONFIG, ...config };
    this.metadata = this.initializeMetadata();
    this.startCleanupTimer();
    this.loadFromPersistence();
  }

  /**
   * Get a property from cache
   */
  get(propertyId: string): GA4Property | null {
    console.log(`🔍 Cache lookup for property ${propertyId}`);
    
    const cached = this.cache.get(propertyId);
    
    if (!cached) {
      console.log(`❌ Cache miss for property ${propertyId}`);
      this.updateMetrics(false);
      return null;
    }
    
    // Check if expired
    if (this.isExpired(cached)) {
      console.log(`⏰ Cache entry expired for property ${propertyId}`);
      this.cache.delete(propertyId);
      this.updateMetrics(false);
      return null;
    }
    
    console.log(`✅ Cache hit for property ${propertyId}`);
    
    // Update access info
    cached.accessCount++;
    cached.lastAccessed = new Date().toISOString();
    
    this.updateMetrics(true);
    return cached.property;
  }

  /**
   * Set a property in cache
   */
  set(property: GA4Property): void {
    console.log(`💾 Caching property ${property.id}`);
    
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.config.ttl).toISOString();
    
    const cachedProperty: CachedProperty = {
      property,
      cachedAt: now,
      expiresAt,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.cache.set(property.id, cachedProperty);
    this.updateCacheSize();
    
    console.log(`✅ Property ${property.id} cached until ${expiresAt}`);
  }

  /**
   * Check if a property is cached and valid
   */
  has(propertyId: string): boolean {
    const cached = this.cache.get(propertyId);
    return cached !== undefined && !this.isExpired(cached);
  }

  /**
   * Remove a property from cache
   */
  delete(propertyId: string): boolean {
    console.log(`🗑️ Removing property ${propertyId} from cache`);
    const deleted = this.cache.delete(propertyId);
    if (deleted) {
      this.updateCacheSize();
    }
    return deleted;
  }

  /**
   * Clear all cached properties
   */
  clear(): void {
    console.log('🧹 Clearing property cache');
    this.cache.clear();
    this.updateCacheSize();
    this.clearPersistence();
  }

  /**
   * Get multiple properties from cache
   */
  getMultiple(propertyIds: string[]): Map<string, GA4Property> {
    const results = new Map<string, GA4Property>();
    
    for (const propertyId of propertyIds) {
      const property = this.get(propertyId);
      if (property) {
        results.set(propertyId, property);
      }
    }
    
    return results;
  }

  /**
   * Set multiple properties in cache
   */
  setMultiple(properties: GA4Property[]): void {
    for (const property of properties) {
      this.set(property);
    }
  }

  /**
   * Refresh a cached property (mark as expired to force reload)
   */
  refresh(propertyId: string): void {
    console.log(`🔄 Refreshing cache for property ${propertyId}`);
    const cached = this.cache.get(propertyId);
    
    if (cached) {
      // Mark as expired by setting expiry to past
      cached.expiresAt = new Date(Date.now() - 1000).toISOString();
    }
  }

  /**
   * Refresh multiple cached properties
   */
  refreshMultiple(propertyIds: string[]): void {
    for (const propertyId of propertyIds) {
      this.refresh(propertyId);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): PropertyCacheMetadata {
    return { ...this.metadata };
  }

  /**
   * Get cached property info (including cache metadata)
   */
  getCachedInfo(propertyId: string): CachedProperty | null {
    return this.cache.get(propertyId) || null;
  }

  /**
   * Get all cached property IDs
   */
  getCachedPropertyIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all valid cached properties
   */
  getAllValidCached(): GA4Property[] {
    const validProperties: GA4Property[] = [];
    
    for (const [propertyId, cached] of this.cache.entries()) {
      if (!this.isExpired(cached)) {
        validProperties.push(cached.property);
      }
    }
    
    return validProperties;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    console.log('🧹 Cleaning up expired cache entries');
    
    const initialSize = this.cache.size;
    let removedCount = 0;
    
    for (const [propertyId, cached] of this.cache.entries()) {
      if (this.isExpired(cached)) {
        this.cache.delete(propertyId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🗑️ Removed ${removedCount} expired entries`);
      this.updateCacheSize();
    }
    
    this.metadata.lastCleanup = new Date().toISOString();
  }

  /**
   * Warm up cache with properties
   */
  warmUp(properties: GA4Property[]): void {
    console.log(`🔥 Warming up cache with ${properties.length} properties`);
    this.setMultiple(properties);
  }

  /**
   * Preload properties into cache
   */
  async preload(
    propertyIds: string[],
    fetchFunction: (id: string) => Promise<GA4Property>
  ): Promise<void> {
    console.log(`⏳ Preloading ${propertyIds.length} properties into cache`);
    
    const promises = propertyIds.map(async (propertyId) => {
      if (!this.has(propertyId)) {
        try {
          const property = await fetchFunction(propertyId);
          this.set(property);
        } catch (error) {
          console.warn(`⚠️ Failed to preload property ${propertyId}:`, error);
        }
      }
    });
    
    await Promise.all(promises);
    console.log('✅ Preloading complete');
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<PropertyCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
    
    // Clean up if max size decreased
    if (newConfig.maxSize && newConfig.maxSize < this.cache.size) {
      this.enforceMaxSize();
    }
  }

  /**
   * Export cache data
   */
  export(): {
    properties: CachedProperty[];
    metadata: PropertyCacheMetadata;
    config: PropertyCacheConfig;
  } {
    return {
      properties: Array.from(this.cache.values()),
      metadata: this.metadata,
      config: this.config
    };
  }

  /**
   * Import cache data
   */
  import(data: {
    properties: CachedProperty[];
    metadata?: PropertyCacheMetadata;
    config?: PropertyCacheConfig;
  }): void {
    console.log(`📥 Importing ${data.properties.length} cached properties`);
    
    this.cache.clear();
    
    for (const cached of data.properties) {
      if (!this.isExpired(cached)) {
        this.cache.set(cached.property.id, cached);
      }
    }
    
    if (data.metadata) {
      this.metadata = { ...this.metadata, ...data.metadata };
    }
    
    if (data.config) {
      this.updateConfig(data.config);
    }
    
    this.updateCacheSize();
  }

  /**
   * Destroy cache service (cleanup resources)
   */
  destroy(): void {
    console.log('💥 Destroying property cache service');
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    
    if (this.config.enablePersistence) {
      this.saveToPersistence();
    }
    
    this.cache.clear();
  }

  // Private helper methods

  private isExpired(cached: CachedProperty): boolean {
    return new Date(cached.expiresAt).getTime() < Date.now();
  }

  private evictLRU(): void {
    console.log('🔄 Evicting LRU cache entry');
    
    let oldestEntry: [string, CachedProperty] | null = null;
    let oldestTime = Date.now();
    
    for (const [propertyId, cached] of this.cache.entries()) {
      const lastAccessedTime = new Date(cached.lastAccessed).getTime();
      if (lastAccessedTime < oldestTime) {
        oldestTime = lastAccessedTime;
        oldestEntry = [propertyId, cached];
      }
    }
    
    if (oldestEntry) {
      this.cache.delete(oldestEntry[0]);
      console.log(`🗑️ Evicted property ${oldestEntry[0]} (last accessed: ${oldestEntry[1].lastAccessed})`);
    }
  }

  private enforceMaxSize(): void {
    while (this.cache.size > this.config.maxSize) {
      this.evictLRU();
    }
  }

  private updateMetrics(hit: boolean): void {
    const totalRequests = this.metadata.hitRate + this.metadata.missRate + 1;
    
    if (hit) {
      this.metadata.hitRate = (this.metadata.hitRate + 1) / totalRequests;
      this.metadata.missRate = this.metadata.missRate / totalRequests;
    } else {
      this.metadata.hitRate = this.metadata.hitRate / totalRequests;
      this.metadata.missRate = (this.metadata.missRate + 1) / totalRequests;
    }
  }

  private updateCacheSize(): void {
    this.metadata.totalProperties = this.cache.size;
    this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): void {
    // Rough estimate of memory usage
    let totalSize = 0;
    
    for (const cached of this.cache.values()) {
      // Estimate size of property object
      const propertySize = JSON.stringify(cached.property).length * 2; // Rough estimate
      const metadataSize = 200; // Rough estimate for cache metadata
      totalSize += propertySize + metadataSize;
    }
    
    this.metadata.memoryUsage = totalSize;
  }

  private initializeMetadata(): PropertyCacheMetadata {
    return {
      totalProperties: 0,
      hitRate: 0,
      missRate: 0,
      lastCleanup: new Date().toISOString(),
      memoryUsage: 0
    };
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private loadFromPersistence(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.import(data);
        console.log('📂 Loaded cache from persistence');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cache from persistence:', error);
    }
  }

  private saveToPersistence(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      const data = this.export();
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
      console.log('💾 Saved cache to persistence');
    } catch (error) {
      console.warn('⚠️ Failed to save cache to persistence:', error);
    }
  }

  private clearPersistence(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      localStorage.removeItem(this.config.storageKey);
      console.log('🗑️ Cleared cache from persistence');
    } catch (error) {
      console.warn('⚠️ Failed to clear cache from persistence:', error);
    }
  }
}

// Cache Manager - Singleton pattern for global cache management
class PropertyCacheManager {
  private static instance: PropertyCacheManager | null = null;
  private cacheServices: Map<string, PropertyCacheService> = new Map();

  private constructor() {}

  static getInstance(): PropertyCacheManager {
    if (!PropertyCacheManager.instance) {
      PropertyCacheManager.instance = new PropertyCacheManager();
    }
    return PropertyCacheManager.instance;
  }

  /**
   * Get or create a cache service for a specific context
   */
  getCache(context: string = 'default', config?: Partial<PropertyCacheConfig>): PropertyCacheService {
    if (!this.cacheServices.has(context)) {
      const service = new PropertyCacheService(config);
      this.cacheServices.set(context, service);
    }
    return this.cacheServices.get(context)!;
  }

  /**
   * Remove a cache service
   */
  removeCache(context: string): void {
    const service = this.cacheServices.get(context);
    if (service) {
      service.destroy();
      this.cacheServices.delete(context);
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const service of this.cacheServices.values()) {
      service.clear();
    }
  }

  /**
   * Destroy all cache services
   */
  destroyAll(): void {
    for (const [context, service] of this.cacheServices.entries()) {
      service.destroy();
    }
    this.cacheServices.clear();
  }

  /**
   * Get cache statistics for all contexts
   */
  getAllStats(): Map<string, PropertyCacheMetadata> {
    const stats = new Map<string, PropertyCacheMetadata>();
    for (const [context, service] of this.cacheServices.entries()) {
      stats.set(context, service.getStats());
    }
    return stats;
  }
}

// Utility functions for property caching

/**
 * Get the global property cache instance
 */
export function getPropertyCache(
  context: string = 'default',
  config?: Partial<PropertyCacheConfig>
): PropertyCacheService {
  return PropertyCacheManager.getInstance().getCache(context, config);
}

/**
 * Create a new property cache service
 */
export function createPropertyCache(config?: Partial<PropertyCacheConfig>): PropertyCacheService {
  return new PropertyCacheService(config);
}

/**
 * Quick cache operations
 */
export const PropertyCacheUtils = {
  /**
   * Cache a property with default settings
   */
  cache(property: GA4Property, context: string = 'default'): void {
    const cache = getPropertyCache(context);
    cache.set(property);
  },

  /**
   * Get a cached property
   */
  get(propertyId: string, context: string = 'default'): GA4Property | null {
    const cache = getPropertyCache(context);
    return cache.get(propertyId);
  },

  /**
   * Check if property is cached
   */
  has(propertyId: string, context: string = 'default'): boolean {
    const cache = getPropertyCache(context);
    return cache.has(propertyId);
  },

  /**
   * Remove property from cache
   */
  remove(propertyId: string, context: string = 'default'): boolean {
    const cache = getPropertyCache(context);
    return cache.delete(propertyId);
  },

  /**
   * Clear all cached properties
   */
  clear(context: string = 'default'): void {
    const cache = getPropertyCache(context);
    cache.clear();
  },

  /**
   * Get cache statistics
   */
  getStats(context: string = 'default'): PropertyCacheMetadata {
    const cache = getPropertyCache(context);
    return cache.getStats();
  }
};

// Export the cache manager (PropertyCacheService is already exported directly at line 29)
export { PropertyCacheManager };