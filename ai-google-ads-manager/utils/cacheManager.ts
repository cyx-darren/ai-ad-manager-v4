/**
 * Advanced cache management system for API optimization
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  hits: number
  lastAccessed: number
  etag?: string
  version: number
}

export interface CacheConfig {
  defaultTTL: number // Time to live in milliseconds
  maxSize: number // Maximum number of cache entries
  enablePersistence: boolean // Enable localStorage persistence
  compressionThreshold: number // Size threshold for compression
  enableMetrics: boolean // Enable cache metrics
}

export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalRequests: number
  totalSize: number
  evictions: number
  lastCleanup: number
}

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  refreshOnAccess?: boolean
  metadata?: Record<string, any>
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  enablePersistence: true,
  compressionThreshold: 10000, // 10KB
  enableMetrics: true
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>()
  private config: CacheConfig
  private metrics: CacheMetrics
  private tagMap = new Map<string, Set<string>>() // tag -> set of cache keys
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      totalSize: 0,
      evictions: 0,
      lastCleanup: Date.now()
    }

    this.loadFromPersistence()
    this.startCleanupTimer()
  }

  // Get item from cache
  get<T>(key: string): T | null {
    this.metrics.totalRequests++
    
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    // Update access stats
    entry.hits++
    entry.lastAccessed = Date.now()
    this.metrics.hits++
    this.updateHitRate()

    console.log(`🎯 Cache hit for key: ${key} (${entry.hits} hits)`)
    return this.deserializeData(entry.data)
  }

  // Set item in cache
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const now = Date.now()
    const ttl = options.ttl || this.config.defaultTTL
    const serializedData = this.serializeData(data)

    const entry: CacheEntry<T> = {
      data: serializedData,
      timestamp: now,
      expiresAt: now + ttl,
      hits: 0,
      lastAccessed: now,
      version: 1
    }

    // Handle cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, entry)

    // Handle tags
    if (options.tags) {
      this.addTags(key, options.tags)
    }

    // Persist if enabled
    if (this.config.enablePersistence) {
      this.persistToStorage(key, entry)
    }

    console.log(`💾 Cached data for key: ${key} (TTL: ${ttl}ms)`)
    this.updateMetrics()
  }

  // Delete specific key
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    
    if (deleted) {
      this.removeTags(key)
      this.removeFromPersistence(key)
      this.updateMetrics()
      console.log(`🗑️ Deleted cache entry: ${key}`)
    }
    
    return deleted
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
    this.tagMap.clear()
    this.clearPersistence()
    this.updateMetrics()
    console.log('🧹 Cache cleared')
  }

  // Invalidate by tags
  invalidateByTag(tag: string): number {
    const keys = this.tagMap.get(tag)
    if (!keys) return 0

    let count = 0
    for (const key of keys) {
      if (this.cache.delete(key)) {
        count++
        this.removeFromPersistence(key)
      }
    }

    this.tagMap.delete(tag)
    this.updateMetrics()
    
    console.log(`🏷️ Invalidated ${count} entries with tag: ${tag}`)
    return count
  }

  // Invalidate by pattern
  invalidateByPattern(pattern: RegExp): number {
    let count = 0
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
        this.removeTags(key)
        this.removeFromPersistence(key)
        count++
      }
    }

    this.updateMetrics()
    console.log(`🔍 Invalidated ${count} entries matching pattern: ${pattern}`)
    return count
  }

  // Refresh expired entries
  refresh(): number {
    const now = Date.now()
    let count = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        this.removeTags(key)
        this.removeFromPersistence(key)
        count++
      }
    }

    this.updateMetrics()
    console.log(`♻️ Refreshed ${count} expired entries`)
    return count
  }

  // Get cache statistics
  getMetrics(): CacheMetrics {
    return { ...this.metrics, totalSize: this.cache.size }
  }

  // Get cache keys
  getKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  // Check if key exists and is valid
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  // Get cache size
  size(): number {
    return this.cache.size
  }

  // Private methods

  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.removeTags(oldestKey)
      this.removeFromPersistence(oldestKey)
      this.metrics.evictions++
      console.log(`⏰ Evicted LRU entry: ${oldestKey}`)
    }
  }

  private addTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set())
      }
      this.tagMap.get(tag)!.add(key)
    }
  }

  private removeTags(key: string): void {
    for (const [tag, keys] of this.tagMap.entries()) {
      keys.delete(key)
      if (keys.size === 0) {
        this.tagMap.delete(tag)
      }
    }
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0
  }

  private updateMetrics(): void {
    this.metrics.totalSize = this.cache.size
    this.updateHitRate()
  }

  private serializeData<T>(data: T): any {
    if (this.config.compressionThreshold && JSON.stringify(data).length > this.config.compressionThreshold) {
      // In a real implementation, you might use a compression library here
      return { compressed: true, data: JSON.stringify(data) }
    }
    return data
  }

  private deserializeData<T>(data: any): T {
    if (data && data.compressed) {
      return JSON.parse(data.data)
    }
    return data
  }

  private persistToStorage(key: string, entry: CacheEntry<any>): void {
    if (typeof window === 'undefined') return
    
    try {
      const storageKey = `cache_${key}`
      localStorage.setItem(storageKey, JSON.stringify(entry))
    } catch (error) {
      console.warn('Failed to persist cache entry:', error)
    }
  }

  private removeFromPersistence(key: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const storageKey = `cache_${key}`
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.warn('Failed to remove cache entry from persistence:', error)
    }
  }

  private loadFromPersistence(): void {
    if (typeof window === 'undefined' || !this.config.enablePersistence) return

    try {
      const now = Date.now()
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith('cache_')) continue

        const cacheKey = key.substring(6) // Remove 'cache_' prefix
        const entryJson = localStorage.getItem(key)
        
        if (entryJson) {
          const entry: CacheEntry<any> = JSON.parse(entryJson)
          
          // Skip expired entries
          if (now > entry.expiresAt) {
            localStorage.removeItem(key)
            continue
          }
          
          this.cache.set(cacheKey, entry)
        }
      }
      
      console.log(`📦 Loaded ${this.cache.size} entries from persistence`)
    } catch (error) {
      console.warn('Failed to load cache from persistence:', error)
    }
  }

  private clearPersistence(): void {
    if (typeof window === 'undefined') return

    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache_')) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear cache persistence:', error)
    }
  }

  private startCleanupTimer(): void {
    // Run cleanup every 10 minutes
    this.cleanupTimer = setInterval(() => {
      const expiredCount = this.refresh()
      this.metrics.lastCleanup = Date.now()
      
      if (expiredCount > 0) {
        console.log(`🧽 Cleanup completed: removed ${expiredCount} expired entries`)
      }
    }, 10 * 60 * 1000)
  }

  // Cleanup timer on destroy
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}

// Global cache instance
export const cacheManager = new CacheManager({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  enablePersistence: true,
  enableMetrics: true
})

// Cache wrapper for API calls
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = cacheManager.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  console.log(`🌐 Cache miss for ${key}, fetching fresh data...`)
  const data = await fetcher()
  
  // Store in cache
  cacheManager.set(key, data, options)
  
  return data
}

// Invalidation helpers
export const invalidateCache = {
  byKey: (key: string) => cacheManager.delete(key),
  byTag: (tag: string) => cacheManager.invalidateByTag(tag),
  byPattern: (pattern: RegExp) => cacheManager.invalidateByPattern(pattern),
  all: () => cacheManager.clear(),
  expired: () => cacheManager.refresh()
}

// Cache metrics
export const getCacheMetrics = () => cacheManager.getMetrics()

// Predefined cache configurations
export const CACHE_CONFIGS = {
  // Quick data that changes frequently
  realtime: {
    ttl: 30 * 1000, // 30 seconds
    tags: ['realtime'],
    priority: 'high' as const
  },
  
  // Dashboard data
  dashboard: {
    ttl: 5 * 60 * 1000, // 5 minutes
    tags: ['dashboard'],
    priority: 'medium' as const
  },
  
  // User preferences and settings
  userSettings: {
    ttl: 30 * 60 * 1000, // 30 minutes
    tags: ['user', 'settings'],
    priority: 'medium' as const
  },
  
  // Static or rarely changing data
  static: {
    ttl: 60 * 60 * 1000, // 1 hour
    tags: ['static'],
    priority: 'low' as const
  },
  
  // API metadata and configuration
  metadata: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    tags: ['metadata'],
    priority: 'low' as const
  }
} as const