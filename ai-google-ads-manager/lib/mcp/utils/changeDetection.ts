/**
 * Change Detection Optimizer for React State Management
 * Provides optimized deep equality checking, selective comparison, and change detection caching
 */

export interface ChangeDetectionOptions {
  enableCaching: boolean;
  enableStructuralSharing: boolean;
  enableCustomComparators: boolean;
  cacheSize: number;
  serializationFree: boolean;
  pathBasedComparison: boolean;
  immutableOptimization: boolean;
}

export interface ChangeDetectionConfig extends ChangeDetectionOptions {
  memoryOptimization: boolean;
  performanceTracking: boolean;
  debugMode: boolean;
}

export interface ComparisonResult {
  isEqual: boolean;
  changedPaths: string[];
  comparisonTime: number;
  cacheHit: boolean;
  structuralOptimization: boolean;
}

export interface ChangeDetectionStats {
  totalComparisons: number;
  cacheHits: number;
  cacheMisses: number;
  averageComparisonTime: number;
  structuralOptimizations: number;
  memoryUsage: number;
}

export interface CustomComparator<T = any> {
  type: string;
  compareFn: (a: T, b: T) => boolean;
  priority: number;
}

export interface CacheEntry {
  key: string;
  result: boolean;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export class ChangeDetector {
  private static instance: ChangeDetector | null = null;
  private config: ChangeDetectionConfig;
  private comparisonCache: Map<string, CacheEntry>;
  private customComparators: Map<string, CustomComparator>;
  private stats: ChangeDetectionStats;
  private weakMapCache: WeakMap<object, Map<object, boolean>>;
  private structuralSharing: WeakMap<object, any>;

  constructor(config: Partial<ChangeDetectionConfig> = {}) {
    this.config = {
      enableCaching: true,
      enableStructuralSharing: true,
      enableCustomComparators: true,
      cacheSize: 1000,
      serializationFree: true,
      pathBasedComparison: true,
      immutableOptimization: true,
      memoryOptimization: true,
      performanceTracking: true,
      debugMode: false,
      ...config
    };

    this.comparisonCache = new Map();
    this.customComparators = new Map();
    this.weakMapCache = new WeakMap();
    this.structuralSharing = new WeakMap();

    this.stats = {
      totalComparisons: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageComparisonTime: 0,
      structuralOptimizations: 0,
      memoryUsage: 0
    };

    this.initializeDefaultComparators();
    this.startCacheCleanup();
  }

  public static getInstance(config?: Partial<ChangeDetectionConfig>): ChangeDetector {
    if (!ChangeDetector.instance) {
      ChangeDetector.instance = new ChangeDetector(config);
    }
    return ChangeDetector.instance;
  }

  /**
   * Optimized deep equality checking with structural sharing
   */
  public deepEquals(a: any, b: any, options: Partial<ChangeDetectionOptions> = {}): ComparisonResult {
    const startTime = performance.now();
    const opts = { ...this.config, ...options };
    
    this.stats.totalComparisons++;

    // Quick reference equality check
    if (a === b) {
      return this.createResult(true, [], startTime, false, false);
    }

    // Check cache first
    if (opts.enableCaching) {
      const cacheResult = this.checkCache(a, b);
      if (cacheResult !== null) {
        this.stats.cacheHits++;
        return this.createResult(cacheResult, [], startTime, true, false);
      }
      this.stats.cacheMisses++;
    }

    // Use WeakMap cache for object comparisons
    if (opts.enableStructuralSharing && typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const weakMapResult = this.checkWeakMapCache(a, b);
      if (weakMapResult !== null) {
        this.stats.structuralOptimizations++;
        return this.createResult(weakMapResult, [], startTime, false, true);
      }
    }

    // Perform deep comparison
    const { isEqual, changedPaths } = this.performDeepComparison(a, b, opts);
    const endTime = performance.now();

    // Cache the result
    if (opts.enableCaching && typeof a === 'object' && typeof b === 'object') {
      this.cacheResult(a, b, isEqual);
    }

    // Store in WeakMap cache
    if (opts.enableStructuralSharing && typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      this.storeInWeakMapCache(a, b, isEqual);
    }

    return this.createResult(isEqual, changedPaths, startTime, false, false);
  }

  /**
   * Path-based selective comparison for nested objects
   */
  public selectiveComparison(
    a: any,
    b: any,
    paths: string[],
    options: Partial<ChangeDetectionOptions> = {}
  ): ComparisonResult {
    const startTime = performance.now();
    const opts = { ...this.config, ...options };
    const changedPaths: string[] = [];

    if (!opts.pathBasedComparison) {
      return this.deepEquals(a, b, options);
    }

    let isEqual = true;

    for (const path of paths) {
      const valueA = this.getValueByPath(a, path);
      const valueB = this.getValueByPath(b, path);

      if (!this.shallowEquals(valueA, valueB)) {
        isEqual = false;
        changedPaths.push(path);
      }
    }

    return this.createResult(isEqual, changedPaths, startTime, false, false);
  }

  /**
   * Cache comparison results with LRU eviction
   */
  public cacheResults(key: string, result: boolean): void {
    if (!this.config.enableCaching) {
      return;
    }

    // Implement LRU cache
    if (this.comparisonCache.size >= this.config.cacheSize) {
      this.evictLRUEntry();
    }

    const now = Date.now();
    this.comparisonCache.set(key, {
      key,
      result,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    });
  }

  /**
   * Add support for immutable data structures
   */
  public structuralSharing<T>(obj: T): T {
    if (!this.config.enableStructuralSharing || typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Check if we already have a structural representation
    const existing = this.structuralSharing.get(obj as any);
    if (existing) {
      return existing;
    }

    // Create structural representation
    const structural = this.createStructuralRepresentation(obj);
    this.structuralSharing.set(obj as any, structural);
    return structural;
  }

  /**
   * Register custom equality comparators for specialized types
   */
  public customComparators<T>(
    type: string,
    compareFn: (a: T, b: T) => boolean,
    priority: number = 0
  ): void {
    this.customComparators.set(type, {
      type,
      compareFn,
      priority
    });

    // Re-sort by priority
    const sorted = Array.from(this.customComparators.entries())
      .sort(([, a], [, b]) => b.priority - a.priority);
    
    this.customComparators.clear();
    sorted.forEach(([key, value]) => {
      this.customComparators.set(key, value);
    });
  }

  /**
   * Memory optimization with weak references
   */
  public memoryOptimization(): void {
    if (!this.config.memoryOptimization) {
      return;
    }

    // Clear old cache entries
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, entry] of this.comparisonCache.entries()) {
      if (now - entry.lastAccessed > maxAge) {
        this.comparisonCache.delete(key);
      }
    }

    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }

    this.updateMemoryStats();
  }

  /**
   * Get performance statistics
   */
  public getStats(): ChangeDetectionStats {
    this.updateMemoryStats();
    
    const totalTime = this.stats.totalComparisons > 0 ? 
      this.stats.averageComparisonTime * this.stats.totalComparisons : 0;
    
    return {
      ...this.stats,
      averageComparisonTime: this.stats.totalComparisons > 0 ? 
        totalTime / this.stats.totalComparisons : 0
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalComparisons: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageComparisonTime: 0,
      structuralOptimizations: 0,
      memoryUsage: 0
    };
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.comparisonCache.clear();
    this.weakMapCache = new WeakMap();
    this.structuralSharing = new WeakMap();
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.clearCaches();
    this.customComparators.clear();
    this.resetStats();
  }

  // Private methods

  private performDeepComparison(
    a: any,
    b: any,
    options: ChangeDetectionOptions,
    path: string = '',
    visited: Set<any> = new Set()
  ): { isEqual: boolean; changedPaths: string[] } {
    const changedPaths: string[] = [];

    // Handle null/undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      const isEqual = a === b;
      if (!isEqual && path) changedPaths.push(path);
      return { isEqual, changedPaths };
    }

    // Handle primitive types
    if (typeof a !== 'object' || typeof b !== 'object') {
      const isEqual = a === b;
      if (!isEqual && path) changedPaths.push(path);
      return { isEqual, changedPaths };
    }

    // Handle circular references
    if (visited.has(a) || visited.has(b)) {
      return { isEqual: a === b, changedPaths };
    }
    visited.add(a);
    visited.add(b);

    // Use custom comparators if available
    if (options.enableCustomComparators) {
      const customResult = this.tryCustomComparators(a, b);
      if (customResult !== null) {
        if (!customResult && path) changedPaths.push(path);
        return { isEqual: customResult, changedPaths };
      }
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      return this.compareArrays(a, b, options, path, visited);
    }

    // Handle objects
    if (Array.isArray(a) || Array.isArray(b)) {
      if (path) changedPaths.push(path);
      return { isEqual: false, changedPaths };
    }

    return this.compareObjects(a, b, options, path, visited);
  }

  private compareArrays(
    a: any[],
    b: any[],
    options: ChangeDetectionOptions,
    path: string,
    visited: Set<any>
  ): { isEqual: boolean; changedPaths: string[] } {
    const changedPaths: string[] = [];

    if (a.length !== b.length) {
      if (path) changedPaths.push(path);
      return { isEqual: false, changedPaths };
    }

    let isEqual = true;
    for (let i = 0; i < a.length; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      const result = this.performDeepComparison(a[i], b[i], options, itemPath, visited);
      
      if (!result.isEqual) {
        isEqual = false;
        changedPaths.push(...result.changedPaths);
      }
    }

    return { isEqual, changedPaths };
  }

  private compareObjects(
    a: object,
    b: object,
    options: ChangeDetectionOptions,
    path: string,
    visited: Set<any>
  ): { isEqual: boolean; changedPaths: string[] } {
    const changedPaths: string[] = [];

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      if (path) changedPaths.push(path);
      return { isEqual: false, changedPaths };
    }

    let isEqual = true;
    for (const key of keysA) {
      if (!(key in b)) {
        isEqual = false;
        const keyPath = path ? `${path}.${key}` : key;
        changedPaths.push(keyPath);
        continue;
      }

      const keyPath = path ? `${path}.${key}` : key;
      const result = this.performDeepComparison(
        (a as any)[key],
        (b as any)[key],
        options,
        keyPath,
        visited
      );

      if (!result.isEqual) {
        isEqual = false;
        changedPaths.push(...result.changedPaths);
      }
    }

    return { isEqual, changedPaths };
  }

  private shallowEquals(a: any, b: any): boolean {
    return a === b;
  }

  private getValueByPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indices
      if (key.includes('[') && key.includes(']')) {
        const [objKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current[objKey];
        if (Array.isArray(current)) {
          current = current[index];
        }
      } else {
        current = current[key];
      }
    }

    return current;
  }

  private createObjectHash(obj: any): string {
    if (this.config.serializationFree) {
      // Create hash without serialization
      return this.createStructuralHash(obj);
    }
    
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }

  private createStructuralHash(obj: any, visited: Set<any> = new Set()): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj !== 'object') return String(obj);
    if (visited.has(obj)) return '[circular]';

    visited.add(obj);

    if (Array.isArray(obj)) {
      const hashes = obj.map(item => this.createStructuralHash(item, visited));
      return `[${hashes.join(',')}]`;
    }

    const keys = Object.keys(obj).sort();
    const hashes = keys.map(key => `${key}:${this.createStructuralHash(obj[key], visited)}`);
    return `{${hashes.join(',')}}`;
  }

  private checkCache(a: any, b: any): boolean | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const keyA = this.createObjectHash(a);
    const keyB = this.createObjectHash(b);
    const cacheKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;

    const entry = this.comparisonCache.get(cacheKey);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      return entry.result;
    }

    return null;
  }

  private cacheResult(a: any, b: any, result: boolean): void {
    const keyA = this.createObjectHash(a);
    const keyB = this.createObjectHash(b);
    const cacheKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;

    this.cacheResults(cacheKey, result);
  }

  private checkWeakMapCache(a: object, b: object): boolean | null {
    const aCache = this.weakMapCache.get(a);
    if (aCache) {
      return aCache.get(b) ?? null;
    }
    return null;
  }

  private storeInWeakMapCache(a: object, b: object, result: boolean): void {
    let aCache = this.weakMapCache.get(a);
    if (!aCache) {
      aCache = new Map();
      this.weakMapCache.set(a, aCache);
    }
    aCache.set(b, result);

    // Also store reverse for bidirectional lookup
    let bCache = this.weakMapCache.get(b);
    if (!bCache) {
      bCache = new Map();
      this.weakMapCache.set(b, bCache);
    }
    bCache.set(a, result);
  }

  private createStructuralRepresentation<T>(obj: T): T {
    // For now, return the object as-is
    // This could be enhanced with more sophisticated structural analysis
    return obj;
  }

  private tryCustomComparators(a: any, b: any): boolean | null {
    for (const [, comparator] of this.customComparators) {
      try {
        if (this.isTypeMatch(a, b, comparator.type)) {
          return comparator.compareFn(a, b);
        }
      } catch (error) {
        console.warn(`Custom comparator failed for type ${comparator.type}:`, error);
      }
    }
    return null;
  }

  private isTypeMatch(a: any, b: any, type: string): boolean {
    // Simple type matching - can be enhanced
    switch (type) {
      case 'date':
        return a instanceof Date && b instanceof Date;
      case 'regexp':
        return a instanceof RegExp && b instanceof RegExp;
      case 'map':
        return a instanceof Map && b instanceof Map;
      case 'set':
        return a instanceof Set && b instanceof Set;
      default:
        return false;
    }
  }

  private evictLRUEntry(): void {
    let oldestEntry: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.comparisonCache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.comparisonCache.delete(oldestKey);
    }
  }

  private updateMemoryStats(): void {
    // Estimate memory usage
    const cacheSize = this.comparisonCache.size * 100; // ~100 bytes per entry
    const comparatorSize = this.customComparators.size * 50; // ~50 bytes per comparator
    
    this.stats.memoryUsage = (cacheSize + comparatorSize) / 1024; // Convert to KB
  }

  private createResult(
    isEqual: boolean,
    changedPaths: string[],
    startTime: number,
    cacheHit: boolean,
    structuralOptimization: boolean
  ): ComparisonResult {
    const comparisonTime = performance.now() - startTime;
    
    // Update average comparison time
    const totalComparisons = this.stats.totalComparisons;
    this.stats.averageComparisonTime = 
      (this.stats.averageComparisonTime * (totalComparisons - 1) + comparisonTime) / totalComparisons;

    return {
      isEqual,
      changedPaths,
      comparisonTime,
      cacheHit,
      structuralOptimization
    };
  }

  private initializeDefaultComparators(): void {
    // Date comparator
    this.customComparators.set('date', (a: Date, b: Date) => a.getTime() === b.getTime());

    // RegExp comparator
    this.customComparators.set('regexp', (a: RegExp, b: RegExp) => a.toString() === b.toString());

    // Map comparator
    this.customComparators.set('map', (a: Map<any, any>, b: Map<any, any>) => {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !this.deepEquals(value, b.get(key)).isEqual) {
          return false;
        }
      }
      return true;
    });

    // Set comparator
    this.customComparators.set('set', (a: Set<any>, b: Set<any>) => {
      if (a.size !== b.size) return false;
      for (const value of a) {
        if (!b.has(value)) return false;
      }
      return true;
    });
  }

  private startCacheCleanup(): void {
    // Clean up cache every 5 minutes
    setInterval(() => {
      this.memoryOptimization();
    }, 5 * 60 * 1000);
  }
}

// Singleton instance
export const changeDetector = ChangeDetector.getInstance();

// Export types for external use
export type {
  ChangeDetectionOptions,
  ChangeDetectionConfig,
  ComparisonResult,
  ChangeDetectionStats,
  CustomComparator,
  CacheEntry
};