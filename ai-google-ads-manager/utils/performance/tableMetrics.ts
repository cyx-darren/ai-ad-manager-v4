/**
 * Performance Monitoring Utilities for Campaign Table
 * Real-time performance metrics tracking and optimization analysis
 * (Phase 7 of Subtask 29.3)
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  threshold?: number;
  isWarning?: boolean;
  isError?: boolean;
}

interface RenderMetrics {
  renderTime: number;
  componentCount: number;
  reRenderCount: number;
  paintTime: number;
  layoutTime: number;
  scriptTime: number;
}

interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryUsagePercent: number;
  memoryGrowthRate: number;
}

interface InteractionMetrics {
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

interface TablePerformanceConfig {
  enableMetrics: boolean;
  enableWarnings: boolean;
  enableLogging: boolean;
  renderTimeThreshold: number; // ms
  memoryThreshold: number; // MB
  fpsThreshold: number;
  interactionThreshold: number; // ms
  sampleRate: number; // 0-1
}

class TablePerformanceMonitor {
  private config: TablePerformanceConfig;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private renderObserver?: PerformanceObserver;
  private memoryMonitor?: NodeJS.Timeout;
  private frameMonitor?: number;
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentFPS = 0;
  private baselineMemory = 0;
  private isMonitoring = false;

  constructor(config: Partial<TablePerformanceConfig> = {}) {
    this.config = {
      enableMetrics: true,
      enableWarnings: true,
      enableLogging: false,
      renderTimeThreshold: 16, // 16ms for 60fps
      memoryThreshold: 100, // 100MB
      fpsThreshold: 55, // FPS warning threshold
      interactionThreshold: 100, // 100ms interaction delay
      sampleRate: 1, // 100% sampling
      ...config
    };

    if (this.config.enableMetrics) {
      this.initializeMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (!this.config.enableMetrics || this.isMonitoring) return;

    this.isMonitoring = true;
    this.initializeRenderObserver();
    this.initializeMemoryMonitor();
    this.initializeFrameMonitor();
    this.recordBaselineMemory();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.renderObserver) {
      this.renderObserver.disconnect();
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    if (this.frameMonitor) {
      cancelAnimationFrame(this.frameMonitor);
    }
  }

  /**
   * Measure component render time
   */
  measureRender<T>(
    componentName: string,
    renderFunction: () => T,
    options: { threshold?: number; logWarnings?: boolean } = {}
  ): T {
    if (!this.config.enableMetrics || Math.random() > this.config.sampleRate) {
      return renderFunction();
    }

    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    this.recordMetric('renderTime', {
      name: `render:${componentName}`,
      value: renderTime,
      unit: 'ms',
      timestamp: Date.now(),
      threshold: options.threshold || this.config.renderTimeThreshold,
      isWarning: renderTime > (options.threshold || this.config.renderTimeThreshold),
      isError: renderTime > (options.threshold || this.config.renderTimeThreshold) * 2
    });

    if (options.logWarnings && renderTime > (options.threshold || this.config.renderTimeThreshold)) {
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Measure async operation performance
   */
  async measureAsync<T>(
    operationName: string,
    asyncFunction: () => Promise<T>,
    options: { threshold?: number; logWarnings?: boolean } = {}
  ): Promise<T> {
    if (!this.config.enableMetrics || Math.random() > this.config.sampleRate) {
      return asyncFunction();
    }

    const startTime = performance.now();
    const result = await asyncFunction();
    const endTime = performance.now();
    const operationTime = endTime - startTime;

    this.recordMetric('asyncOperation', {
      name: `async:${operationName}`,
      value: operationTime,
      unit: 'ms',
      timestamp: Date.now(),
      threshold: options.threshold || this.config.interactionThreshold,
      isWarning: operationTime > (options.threshold || this.config.interactionThreshold),
      isError: operationTime > (options.threshold || this.config.interactionThreshold) * 3
    });

    if (options.logWarnings && operationTime > (options.threshold || this.config.interactionThreshold)) {
      console.warn(`Slow async operation: ${operationName} took ${operationTime.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): { [category: string]: PerformanceMetric[] } {
    const result: { [category: string]: PerformanceMetric[] } = {};
    
    for (const [category, metrics] of this.metrics.entries()) {
      result[category] = [...metrics];
    }
    
    return result;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    render: RenderMetrics;
    memory: MemoryMetrics;
    interaction: InteractionMetrics;
    fps: number;
    warnings: PerformanceMetric[];
    errors: PerformanceMetric[];
  } {
    const renderMetrics = this.metrics.get('renderTime') || [];
    const memoryMetrics = this.getCurrentMemoryMetrics();
    const interactionMetrics = this.getInteractionMetrics();
    
    const warnings = this.getAllMetrics().filter(m => m.isWarning && !m.isError);
    const errors = this.getAllMetrics().filter(m => m.isError);

    return {
      render: this.calculateRenderMetrics(renderMetrics),
      memory: memoryMetrics,
      interaction: interactionMetrics,
      fps: this.currentFPS,
      warnings,
      errors
    };
  }

  /**
   * Check if performance is within acceptable bounds
   */
  isPerformanceHealthy(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check FPS
    if (this.currentFPS < this.config.fpsThreshold) {
      issues.push(`Low FPS: ${this.currentFPS.toFixed(1)} (threshold: ${this.config.fpsThreshold})`);
      recommendations.push('Consider reducing table row count or enabling virtualization');
    }
    
    // Check memory usage
    const memoryMetrics = this.getCurrentMemoryMetrics();
    if (memoryMetrics.memoryUsagePercent > 80) {
      issues.push(`High memory usage: ${memoryMetrics.memoryUsagePercent.toFixed(1)}%`);
      recommendations.push('Clear cache or reduce data retention period');
    }
    
    // Check render times
    const renderMetrics = this.metrics.get('renderTime') || [];
    const recentSlowRenders = renderMetrics
      .filter(m => Date.now() - m.timestamp < 30000) // Last 30 seconds
      .filter(m => m.isWarning).length;
    
    if (recentSlowRenders > 5) {
      issues.push(`Multiple slow renders detected: ${recentSlowRenders} in last 30s`);
      recommendations.push('Optimize component rendering or implement memoization');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const summary = this.getPerformanceSummary();
    const health = this.isPerformanceHealthy();
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary,
      health,
      rawMetrics: this.getMetrics()
    }, null, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.frameCount = 0;
    this.currentFPS = 0;
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Initialize performance observer for browser metrics
    if ('PerformanceObserver' in window) {
      this.startMonitoring();
    }
  }

  private initializeRenderObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      this.renderObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' && entry.name.startsWith('⚛️')) {
            this.recordMetric('renderTime', {
              name: entry.name,
              value: entry.duration,
              unit: 'ms',
              timestamp: Date.now(),
              threshold: this.config.renderTimeThreshold,
              isWarning: entry.duration > this.config.renderTimeThreshold,
              isError: entry.duration > this.config.renderTimeThreshold * 2
            });
          }
        });
      });

      this.renderObserver.observe({ entryTypes: ['measure', 'paint', 'layout-shift'] });
    } catch (error) {
      console.warn('Performance observer initialization failed:', error);
    }
  }

  private initializeMemoryMonitor(): void {
    if (typeof window === 'undefined') return;

    this.memoryMonitor = setInterval(() => {
      const memoryMetrics = this.getCurrentMemoryMetrics();
      
      this.recordMetric('memory', {
        name: 'memoryUsage',
        value: memoryMetrics.usedJSHeapSize / (1024 * 1024),
        unit: 'MB',
        timestamp: Date.now(),
        threshold: this.config.memoryThreshold,
        isWarning: memoryMetrics.memoryUsagePercent > 70,
        isError: memoryMetrics.memoryUsagePercent > 90
      });
    }, 5000); // Check every 5 seconds
  }

  private initializeFrameMonitor(): void {
    if (typeof window === 'undefined') return;

    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.frameCount++;
        
        if (this.frameCount >= 60) { // Calculate FPS every 60 frames
          this.currentFPS = 60000 / (timestamp - (this.lastFrameTime - (delta * 59)));
          this.frameCount = 0;
          
          this.recordMetric('fps', {
            name: 'framesPerSecond',
            value: this.currentFPS,
            unit: 'fps',
            timestamp: Date.now(),
            threshold: this.config.fpsThreshold,
            isWarning: this.currentFPS < this.config.fpsThreshold,
            isError: this.currentFPS < this.config.fpsThreshold * 0.8
          });
        }
      }
      
      this.lastFrameTime = timestamp;
      this.frameMonitor = requestAnimationFrame(measureFPS);
    };

    this.frameMonitor = requestAnimationFrame(measureFPS);
  }

  private recordBaselineMemory(): void {
    const memoryInfo = this.getMemoryInfo();
    if (memoryInfo) {
      this.baselineMemory = memoryInfo.usedJSHeapSize;
    }
  }

  private recordMetric(category: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const categoryMetrics = this.metrics.get(category)!;
    categoryMetrics.push(metric);
    
    // Keep only last 100 metrics per category
    if (categoryMetrics.length > 100) {
      categoryMetrics.shift();
    }
    
    // Log warnings if enabled
    if (this.config.enableWarnings && metric.isWarning) {
      console.warn(`Performance warning: ${metric.name} = ${metric.value}${metric.unit}`);
    }
    
    if (this.config.enableLogging) {
      console.log(`Performance metric: ${metric.name} = ${metric.value}${metric.unit}`);
    }
  }

  private getCurrentMemoryMetrics(): MemoryMetrics {
    const memoryInfo = this.getMemoryInfo();
    
    if (!memoryInfo) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        memoryUsagePercent: 0,
        memoryGrowthRate: 0
      };
    }
    
    const memoryUsagePercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
    const memoryGrowthRate = this.baselineMemory > 0 
      ? ((memoryInfo.usedJSHeapSize - this.baselineMemory) / this.baselineMemory) * 100
      : 0;
    
    return {
      usedJSHeapSize: memoryInfo.usedJSHeapSize,
      totalJSHeapSize: memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
      memoryUsagePercent,
      memoryGrowthRate
    };
  }

  private getMemoryInfo(): any {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      return (window.performance as any).memory;
    }
    return null;
  }

  private getInteractionMetrics(): InteractionMetrics {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return {
        timeToInteractive: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0
      };
    }

    const paintEntries = performance.getEntriesByType('paint');
    const navigationEntries = performance.getEntriesByType('navigation');
    
    return {
      timeToInteractive: this.getTimeToInteractive(),
      firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
      largestContentfulPaint: this.getLargestContentfulPaint(),
      cumulativeLayoutShift: this.getCumulativeLayoutShift(),
      firstInputDelay: this.getFirstInputDelay()
    };
  }

  private calculateRenderMetrics(metrics: PerformanceMetric[]): RenderMetrics {
    if (metrics.length === 0) {
      return {
        renderTime: 0,
        componentCount: 0,
        reRenderCount: 0,
        paintTime: 0,
        layoutTime: 0,
        scriptTime: 0
      };
    }
    
    const recentMetrics = metrics.filter(m => Date.now() - m.timestamp < 60000); // Last minute
    
    return {
      renderTime: recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length,
      componentCount: new Set(recentMetrics.map(m => m.name)).size,
      reRenderCount: recentMetrics.length,
      paintTime: this.getAveragePaintTime(),
      layoutTime: this.getAverageLayoutTime(),
      scriptTime: this.getAverageScriptTime()
    };
  }

  private getAllMetrics(): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];
    
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    
    return allMetrics;
  }

  private getTimeToInteractive(): number {
    // Simplified TTI calculation
    if (typeof window === 'undefined') return 0;
    
    const navigationStart = performance.timeOrigin;
    const now = performance.now();
    return now - navigationStart;
  }

  private getLargestContentfulPaint(): number {
    if (typeof window === 'undefined') return 0;
    
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      return lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0;
    } catch {
      return 0;
    }
  }

  private getCumulativeLayoutShift(): number {
    if (typeof window === 'undefined') return 0;
    
    try {
      const clsEntries = performance.getEntriesByType('layout-shift');
      return clsEntries.reduce((sum: number, entry: any) => sum + entry.value, 0);
    } catch {
      return 0;
    }
  }

  private getFirstInputDelay(): number {
    if (typeof window === 'undefined') return 0;
    
    try {
      const fidEntries = performance.getEntriesByType('first-input');
      return fidEntries.length > 0 ? (fidEntries[0] as any).processingStart - fidEntries[0].startTime : 0;
    } catch {
      return 0;
    }
  }

  private getAveragePaintTime(): number {
    if (typeof window === 'undefined') return 0;
    
    const paintEntries = performance.getEntriesByType('paint');
    return paintEntries.length > 0 
      ? paintEntries.reduce((sum, entry) => sum + entry.duration, 0) / paintEntries.length
      : 0;
  }

  private getAverageLayoutTime(): number {
    // This would require more detailed performance measurements
    return 0;
  }

  private getAverageScriptTime(): number {
    // This would require more detailed performance measurements
    return 0;
  }
}

// Export singleton instance
export const tablePerformanceMonitor = new TablePerformanceMonitor();

// Utility functions for React components
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return function PerformanceTrackedComponent(props: P) {
    return tablePerformanceMonitor.measureRender(
      componentName,
      () => React.createElement(Component, props)
    );
  };
}

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = React.useState(tablePerformanceMonitor.getPerformanceSummary());
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(tablePerformanceMonitor.getPerformanceSummary());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return metrics;
}

export default tablePerformanceMonitor;