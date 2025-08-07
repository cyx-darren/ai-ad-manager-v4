/**
 * Render Optimizer for React Component Performance
 * Provides selective re-rendering optimization, render frequency monitoring, and performance metrics
 */

import React, { ComponentType, ReactElement, useRef, useCallback, useMemo } from 'react';

export interface RenderMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  lastRenderTime: number;
  renderFrequency: number; // renders per minute
  optimizationApplied: boolean;
  skippedRenders: number;
}

export interface RenderOptimizationConfig {
  enableMemoization: boolean;
  enableRenderTracking: boolean;
  enableFrequencyThrottling: boolean;
  enableOffscreenSkipping: boolean;
  maxRenderFrequency: number; // renders per minute
  renderTimeThreshold: number; // milliseconds
  memoryOptimization: boolean;
}

export interface ComponentRenderData {
  renderStartTime: number;
  renderEndTime: number;
  renderDuration: number;
  propsChanged: boolean;
  stateChanged: boolean;
  forceRender: boolean;
  isVisible: boolean;
}

export interface RenderStats {
  totalComponents: number;
  activeComponents: number;
  totalRenders: number;
  averageRenderTime: number;
  optimizationEfficiency: number;
  memoryUsage: number;
}

export class RenderOptimizer {
  private static instance: RenderOptimizer | null = null;
  private config: RenderOptimizationConfig;
  private componentMetrics: Map<string, RenderMetrics>;
  private renderHistory: Map<string, ComponentRenderData[]>;
  private memoizedComponents: WeakMap<ComponentType<any>, ComponentType<any>>;
  private intersectionObserver: IntersectionObserver | null = null;
  private visibleComponents: Set<string>;
  private rafId: number | null = null;
  private batchedRenders: Set<() => void>;

  constructor(config: Partial<RenderOptimizationConfig> = {}) {
    this.config = {
      enableMemoization: true,
      enableRenderTracking: true,
      enableFrequencyThrottling: true,
      enableOffscreenSkipping: true,
      maxRenderFrequency: 30, // 30 renders per minute
      renderTimeThreshold: 16, // 16ms (60fps)
      memoryOptimization: true,
      ...config
    };

    this.componentMetrics = new Map();
    this.renderHistory = new Map();
    this.memoizedComponents = new WeakMap();
    this.visibleComponents = new Set();
    this.batchedRenders = new Set();

    this.initializeIntersectionObserver();
    this.startRenderBatching();
  }

  public static getInstance(config?: Partial<RenderOptimizationConfig>): RenderOptimizer {
    if (!RenderOptimizer.instance) {
      RenderOptimizer.instance = new RenderOptimizer(config);
    }
    return RenderOptimizer.instance;
  }

  /**
   * Memoize a component with intelligent dependency tracking
   */
  public memoizeComponent<P extends object>(
    Component: ComponentType<P>,
    componentName: string,
    customComparison?: (prevProps: P, nextProps: P) => boolean
  ): ComponentType<P> {
    if (!this.config.enableMemoization) {
      return Component;
    }

    // Check if already memoized
    const existing = this.memoizedComponents.get(Component);
    if (existing) {
      return existing as ComponentType<P>;
    }

    const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
      const startTime = performance.now();
      
      // Use custom comparison if provided
      if (customComparison) {
        const isEqual = customComparison(prevProps, nextProps);
        this.recordRenderDecision(componentName, startTime, !isEqual, 'custom');
        return isEqual;
      }

      // Intelligent default comparison
      const isEqual = this.deepCompareProps(prevProps, nextProps);
      this.recordRenderDecision(componentName, startTime, !isEqual, 'default');
      return isEqual;
    });

    // Set display name for debugging
    MemoizedComponent.displayName = `Memoized(${componentName})`;

    // Store in cache
    this.memoizedComponents.set(Component, MemoizedComponent);

    return MemoizedComponent;
  }

  /**
   * Track render frequency and apply throttling
   */
  public trackRenderFrequency(componentName: string): boolean {
    if (!this.config.enableFrequencyThrottling) {
      return true; // Allow render
    }

    const metrics = this.getOrCreateMetrics(componentName);
    const now = Date.now();
    const minuteAgo = now - 60000;

    // Get recent render history
    const history = this.renderHistory.get(componentName) || [];
    const recentRenders = history.filter(render => render.renderStartTime > minuteAgo);

    // Update render frequency
    metrics.renderFrequency = recentRenders.length;

    // Check if frequency exceeds threshold
    if (metrics.renderFrequency >= this.config.maxRenderFrequency) {
      metrics.skippedRenders++;
      console.log(`🚫 Render throttled for ${componentName}: ${metrics.renderFrequency} renders/min`);
      return false;
    }

    return true;
  }

  /**
   * Calculate render cost based on timing and complexity
   */
  public calculateRenderCost(componentName: string, renderData: ComponentRenderData): number {
    const baseWeight = 1;
    const timeWeight = renderData.renderDuration / this.config.renderTimeThreshold;
    const changeWeight = (renderData.propsChanged ? 1.5 : 1) * (renderData.stateChanged ? 1.5 : 1);
    const visibilityWeight = renderData.isVisible ? 1 : 0.1;

    return baseWeight * timeWeight * changeWeight * visibilityWeight;
  }

  /**
   * Batch renders using requestAnimationFrame
   */
  public batchRenders(renderFn: () => void): void {
    if (!this.config.enableMemoization) {
      renderFn();
      return;
    }

    this.batchedRenders.add(renderFn);

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.processBatchedRenders();
      });
    }
  }

  /**
   * Skip renders for off-screen components
   */
  public skipOffscreenRenders(componentName: string, element: Element | null): boolean {
    if (!this.config.enableOffscreenSkipping || !element) {
      return false; // Don't skip
    }

    const isVisible = this.visibleComponents.has(componentName);
    
    if (!isVisible) {
      const metrics = this.getOrCreateMetrics(componentName);
      metrics.skippedRenders++;
      console.log(`⏭️ Skipped offscreen render for ${componentName}`);
      return true; // Skip render
    }

    return false; // Don't skip
  }

  /**
   * Collect performance metrics for a component
   */
  public collectMetrics(
    componentName: string,
    renderStartTime: number,
    renderEndTime: number,
    additionalData: Partial<ComponentRenderData> = {}
  ): void {
    if (!this.config.enableRenderTracking) {
      return;
    }

    const renderDuration = renderEndTime - renderStartTime;
    const metrics = this.getOrCreateMetrics(componentName);

    // Update metrics
    metrics.renderCount++;
    metrics.totalRenderTime += renderDuration;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
    metrics.lastRenderTime = renderDuration;

    // Store render data
    const renderData: ComponentRenderData = {
      renderStartTime,
      renderEndTime,
      renderDuration,
      propsChanged: false,
      stateChanged: false,
      forceRender: false,
      isVisible: this.visibleComponents.has(componentName),
      ...additionalData
    };

    // Add to history
    const history = this.renderHistory.get(componentName) || [];
    history.push(renderData);

    // Limit history size for memory optimization
    if (this.config.memoryOptimization && history.length > 50) {
      history.shift();
    }

    this.renderHistory.set(componentName, history);

    // Log expensive renders
    if (renderDuration > this.config.renderTimeThreshold) {
      console.warn(`⚠️ Slow render detected: ${componentName} took ${renderDuration.toFixed(2)}ms`);
    }
  }

  /**
   * Get render statistics for all components
   */
  public getRenderStats(): RenderStats {
    const metrics = Array.from(this.componentMetrics.values());
    
    const totalComponents = metrics.length;
    const activeComponents = metrics.filter(m => m.renderCount > 0).length;
    const totalRenders = metrics.reduce((sum, m) => sum + m.renderCount, 0);
    const averageRenderTime = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.averageRenderTime, 0) / metrics.length 
      : 0;

    const totalSkipped = metrics.reduce((sum, m) => sum + m.skippedRenders, 0);
    const optimizationEfficiency = totalRenders > 0 ? (totalSkipped / totalRenders) * 100 : 0;

    // Estimate memory usage
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalComponents,
      activeComponents,
      totalRenders,
      averageRenderTime,
      optimizationEfficiency,
      memoryUsage
    };
  }

  /**
   * Get metrics for a specific component
   */
  public getComponentMetrics(componentName: string): RenderMetrics | null {
    return this.componentMetrics.get(componentName) || null;
  }

  /**
   * Reset metrics for all components
   */
  public resetMetrics(): void {
    this.componentMetrics.clear();
    this.renderHistory.clear();
    console.log('🔄 Render metrics reset');
  }

  /**
   * Clean up resources and observers
   */
  public cleanup(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.componentMetrics.clear();
    this.renderHistory.clear();
    this.visibleComponents.clear();
    this.batchedRenders.clear();
  }

  // Private methods

  private getOrCreateMetrics(componentName: string): RenderMetrics {
    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, {
        componentName,
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        lastRenderTime: 0,
        renderFrequency: 0,
        optimizationApplied: true,
        skippedRenders: 0
      });
    }
    return this.componentMetrics.get(componentName)!;
  }

  private deepCompareProps<P>(prevProps: P, nextProps: P): boolean {
    if (prevProps === nextProps) return true;
    if (typeof prevProps !== 'object' || typeof nextProps !== 'object') return false;
    if (prevProps === null || nextProps === null) return prevProps === nextProps;

    const prevKeys = Object.keys(prevProps as object);
    const nextKeys = Object.keys(nextProps as object);

    if (prevKeys.length !== nextKeys.length) return false;

    for (const key of prevKeys) {
      if (!(key in (nextProps as object))) return false;
      if (!this.deepEqual((prevProps as any)[key], (nextProps as any)[key])) return false;
    }

    return true;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) return a === b;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (a.prototype !== b.prototype) return false;

    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;

    return keys.every(k => this.deepEqual(a[k], b[k]));
  }

  private recordRenderDecision(
    componentName: string,
    startTime: number,
    shouldRender: boolean,
    reason: string
  ): void {
    const endTime = performance.now();
    const metrics = this.getOrCreateMetrics(componentName);
    
    if (!shouldRender) {
      metrics.skippedRenders++;
    }

    // Log decision for debugging
    if (this.config.enableRenderTracking) {
      console.log(`🔍 ${componentName}: ${shouldRender ? 'RENDER' : 'SKIP'} (${reason}) - ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  private initializeIntersectionObserver(): void {
    if (!this.config.enableOffscreenSkipping || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const componentName = entry.target.getAttribute('data-component-name');
          if (componentName) {
            if (entry.isIntersecting) {
              this.visibleComponents.add(componentName);
            } else {
              this.visibleComponents.delete(componentName);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '50px', // Pre-load components 50px before they're visible
        threshold: 0.1
      }
    );
  }

  private startRenderBatching(): void {
    // Batching is handled via requestAnimationFrame in batchRenders method
  }

  private processBatchedRenders(): void {
    const renders = Array.from(this.batchedRenders);
    this.batchedRenders.clear();
    this.rafId = null;

    // Execute all batched renders
    renders.forEach((renderFn) => {
      try {
        renderFn();
      } catch (error) {
        console.error('Error in batched render:', error);
      }
    });
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in KB
    const metricsSize = this.componentMetrics.size * 200; // ~200 bytes per metric
    const historySize = Array.from(this.renderHistory.values())
      .reduce((total, history) => total + history.length * 100, 0); // ~100 bytes per history entry
    
    return (metricsSize + historySize) / 1024; // Convert to KB
  }
}

// Singleton instance
export const renderOptimizer = RenderOptimizer.getInstance();

// Export types for external use
export type {
  RenderMetrics,
  RenderOptimizationConfig,
  ComponentRenderData,
  RenderStats
};