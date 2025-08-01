/**
 * Performance monitoring and optimization utilities
 */

export interface PerformanceMetrics {
  apiCalls: {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
    slowestCall: number
    fastestCall: number
  }
  rendering: {
    componentsRendered: number
    averageRenderTime: number
    slowestComponent: string | null
    renderCount: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss?: number
  }
  cache: {
    hitRate: number
    totalSize: number
    evictions: number
  }
  dataFetching: {
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    averageFetchTime: number
    dataFreshness: number
  }
}

export interface PerformanceEntry {
  name: string
  startTime: number
  endTime: number
  duration: number
  type: 'api' | 'render' | 'data' | 'user'
  metadata?: Record<string, any>
}

export interface PerformanceConfig {
  enableMetrics: boolean
  enableProfiler: boolean
  sampleRate: number // 0-1, percentage of operations to track
  maxEntries: number
  enableMemoryTracking: boolean
  enableRenderTracking: boolean
  thresholds: {
    slowApiCall: number // ms
    slowRender: number // ms
    lowCacheHitRate: number // percentage
  }
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enableMetrics: process.env.NODE_ENV === 'development',
  enableProfiler: process.env.NODE_ENV === 'development',
  sampleRate: 1.0,
  maxEntries: 1000,
  enableMemoryTracking: true,
  enableRenderTracking: true,
  thresholds: {
    slowApiCall: 2000, // 2 seconds
    slowRender: 16, // 16ms (60fps)
    lowCacheHitRate: 0.8 // 80%
  }
}

class PerformanceMonitor {
  private config: PerformanceConfig
  private entries: PerformanceEntry[] = []
  private metrics: Partial<PerformanceMetrics> = {}
  private observers: Map<string, PerformanceObserver> = new Map()
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enableMetrics) {
      this.initializeObservers()
    }
  }

  // Start timing an operation
  startTiming(name: string, type: PerformanceEntry['type'] = 'user', metadata?: Record<string, any>): string {
    if (!this.shouldSample()) return ''
    
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`${id}_start`)
    }
    
    return id
  }

  // End timing an operation
  endTiming(id: string, name: string, type: PerformanceEntry['type'] = 'user', metadata?: Record<string, any>): number {
    if (!id || !this.config.enableMetrics) return 0
    
    const endTime = Date.now()
    let duration = 0
    
    if (typeof window !== 'undefined' && window.performance) {
      try {
        window.performance.mark(`${id}_end`)
        window.performance.measure(id, `${id}_start`, `${id}_end`)
        
        const measure = window.performance.getEntriesByName(id)[0]
        if (measure) {
          duration = measure.duration
        }
        
        // Clean up marks
        window.performance.clearMarks(`${id}_start`)
        window.performance.clearMarks(`${id}_end`)
        window.performance.clearMeasures(id)
      } catch (error) {
        console.warn('Performance measurement failed:', error)
        return 0
      }
    }
    
    const entry: PerformanceEntry = {
      name,
      startTime: endTime - duration,
      endTime,
      duration,
      type,
      metadata
    }
    
    this.addEntry(entry)
    this.checkThresholds(entry)
    
    return duration
  }

  // Time a function execution
  async timeFunction<T>(
    name: string, 
    fn: () => Promise<T> | T,
    type: PerformanceEntry['type'] = 'user',
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = this.startTiming(name, type, metadata)
    
    try {
      const result = await fn()
      this.endTiming(id, name, type, { ...metadata, success: true })
      return result
    } catch (error) {
      this.endTiming(id, name, type, { ...metadata, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  // Track API call performance
  async trackApiCall<T>(
    name: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.timeFunction(name, apiCall, 'api', metadata)
  }

  // Track component render performance
  trackRender(componentName: string, renderFn: () => any): any {
    if (!this.config.enableRenderTracking) {
      return renderFn()
    }
    
    const id = this.startTiming(componentName, 'render')
    const result = renderFn()
    this.endTiming(id, componentName, 'render')
    
    return result
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    this.updateMetrics()
    return this.metrics as PerformanceMetrics
  }

  // Get performance entries
  getEntries(type?: PerformanceEntry['type'], limit?: number): PerformanceEntry[] {
    let filtered = type ? this.entries.filter(entry => entry.type === type) : this.entries
    
    if (limit) {
      filtered = filtered.slice(-limit)
    }
    
    return filtered.sort((a, b) => b.endTime - a.endTime)
  }

  // Clear performance data
  clear(): void {
    this.entries = []
    this.metrics = {}
    
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.clearMarks()
      window.performance.clearMeasures()
    }
  }

  // Get memory usage
  getMemoryUsage(): PerformanceMetrics['memory'] | null {
    if (typeof window === 'undefined') return null
    
    // @ts-ignore - performance.memory is not in types but exists in Chrome
    const memory = (window.performance as any)?.memory
    
    if (memory) {
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: memory.usedJSHeapSize,
        rss: memory.totalJSHeapSize
      }
    }
    
    return null
  }

  // Report performance issues
  getPerformanceIssues(): Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> {
    const issues: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> = []
    const metrics = this.getMetrics()
    
    // Check API performance
    if (metrics.apiCalls?.averageResponseTime > this.config.thresholds.slowApiCall) {
      issues.push({
        type: 'api',
        message: `Slow API calls detected (avg: ${metrics.apiCalls.averageResponseTime}ms)`,
        severity: 'high'
      })
    }
    
    // Check render performance
    if (metrics.rendering?.averageRenderTime > this.config.thresholds.slowRender) {
      issues.push({
        type: 'render',
        message: `Slow rendering detected (avg: ${metrics.rendering.averageRenderTime}ms)`,
        severity: 'medium'
      })
    }
    
    // Check cache performance
    if (metrics.cache?.hitRate < this.config.thresholds.lowCacheHitRate) {
      issues.push({
        type: 'cache',
        message: `Low cache hit rate (${(metrics.cache.hitRate * 100).toFixed(1)}%)`,
        severity: 'medium'
      })
    }
    
    // Check memory usage
    const memory = this.getMemoryUsage()
    if (memory && memory.heapUsed > 50 * 1024 * 1024) { // 50MB
      issues.push({
        type: 'memory',
        message: `High memory usage (${(memory.heapUsed / 1024 / 1024).toFixed(1)}MB)`,
        severity: 'low'
      })
    }
    
    return issues
  }

  // Export performance data
  exportData(): {
    metrics: PerformanceMetrics
    entries: PerformanceEntry[]
    issues: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>
    timestamp: string
  } {
    return {
      metrics: this.getMetrics(),
      entries: this.getEntries(),
      issues: this.getPerformanceIssues(),
      timestamp: new Date().toISOString()
    }
  }

  // Private methods

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate
  }

  private addEntry(entry: PerformanceEntry): void {
    this.entries.push(entry)
    
    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries)
    }
  }

  private checkThresholds(entry: PerformanceEntry): void {
    if (entry.type === 'api' && entry.duration > this.config.thresholds.slowApiCall) {
      console.warn(`🐌 Slow API call detected: ${entry.name} took ${entry.duration}ms`)
    }
    
    if (entry.type === 'render' && entry.duration > this.config.thresholds.slowRender) {
      console.warn(`🐌 Slow render detected: ${entry.name} took ${entry.duration}ms`)
    }
  }

  private updateMetrics(): void {
    const apiEntries = this.entries.filter(e => e.type === 'api')
    const renderEntries = this.entries.filter(e => e.type === 'render')
    
    // API metrics
    if (apiEntries.length > 0) {
      const durations = apiEntries.map(e => e.duration)
      const successful = apiEntries.filter(e => e.metadata?.success !== false).length
      
      this.metrics.apiCalls = {
        total: apiEntries.length,
        successful,
        failed: apiEntries.length - successful,
        averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
        slowestCall: Math.max(...durations),
        fastestCall: Math.min(...durations)
      }
    }
    
    // Render metrics
    if (renderEntries.length > 0) {
      const durations = renderEntries.map(e => e.duration)
      const slowestEntry = renderEntries.reduce((prev, current) => 
        prev.duration > current.duration ? prev : current
      )
      
      this.metrics.rendering = {
        componentsRendered: new Set(renderEntries.map(e => e.name)).size,
        averageRenderTime: durations.reduce((a, b) => a + b, 0) / durations.length,
        slowestComponent: slowestEntry.name,
        renderCount: renderEntries.length
      }
    }
    
    // Memory metrics
    const memory = this.getMemoryUsage()
    if (memory) {
      this.metrics.memory = memory
    }
  }

  private initializeObservers(): void {
    if (typeof window === 'undefined') return
    
    try {
      // Navigation timing observer
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('📊 Navigation timing:', entry)
        }
      })
      navigationObserver.observe({ entryTypes: ['navigation'] })
      this.observers.set('navigation', navigationObserver)
      
      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 1000) { // Log slow resources
            console.log('📊 Slow resource:', entry.name, entry.duration + 'ms')
          }
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.set('resource', resourceObserver)
      
    } catch (error) {
      console.warn('Failed to initialize performance observers:', error)
    }
  }

  // Cleanup
  destroy(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect()
    }
    this.observers.clear()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Performance decorator for functions
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  type: PerformanceEntry['type'] = 'user'
): T {
  return ((...args: any[]) => {
    return performanceMonitor.timeFunction(name, () => fn(...args), type)
  }) as T
}

// React hook for performance tracking
import { useEffect, useRef, useCallback } from 'react'

export function usePerformanceTracking(componentName: string) {
  const renderCount = useRef(0)
  const mountTime = useRef(Date.now())
  
  useEffect(() => {
    renderCount.current++
    
    return () => {
      const lifetime = Date.now() - mountTime.current
      console.log(`📊 Component ${componentName} lifetime: ${lifetime}ms, renders: ${renderCount.current}`)
    }
  }, [componentName])

  const trackOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T> | T
  ): Promise<T> => {
    return performanceMonitor.timeFunction(
      `${componentName}.${operationName}`,
      operation,
      'user',
      { component: componentName }
    )
  }, [componentName])

  const trackRender = useCallback(() => {
    renderCount.current++
    return performanceMonitor.trackRender(componentName, () => {
      console.log(`🎨 ${componentName} rendered (${renderCount.current} times)`)
    })
  }, [componentName])

  return {
    trackOperation,
    trackRender,
    renderCount: renderCount.current
  }
}

// Performance utilities
export const performance = {
  // Start timing
  start: (name: string, type?: PerformanceEntry['type']) => 
    performanceMonitor.startTiming(name, type),
  
  // End timing
  end: (id: string, name: string, type?: PerformanceEntry['type']) => 
    performanceMonitor.endTiming(id, name, type),
  
  // Time function
  time: <T>(name: string, fn: () => Promise<T> | T, type?: PerformanceEntry['type']) => 
    performanceMonitor.timeFunction(name, fn, type),
  
  // Track API call
  api: <T>(name: string, apiCall: () => Promise<T>) => 
    performanceMonitor.trackApiCall(name, apiCall),
  
  // Get metrics
  getMetrics: () => performanceMonitor.getMetrics(),
  
  // Get issues
  getIssues: () => performanceMonitor.getPerformanceIssues(),
  
  // Export data
  export: () => performanceMonitor.exportData(),
  
  // Clear data
  clear: () => performanceMonitor.clear()
}