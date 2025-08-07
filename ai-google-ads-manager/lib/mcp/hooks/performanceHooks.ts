/**
 * Performance Optimization Hooks for React Components
 * Provides hooks for optimized rendering, batched updates, change detection, and performance monitoring
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { renderOptimizer, RenderMetrics, RenderOptimizationConfig } from '../utils/renderOptimizer';
import { updateBatcher, StateUpdate, UpdateResult } from '../utils/updateBatcher';
import { changeDetector, ComparisonResult, ChangeDetectionOptions } from '../utils/changeDetection';

export interface PerformanceConfig {
  renderOptimization: Partial<RenderOptimizationConfig>;
  changeDetection: Partial<ChangeDetectionOptions>;
  enableMetrics: boolean;
  debugMode: boolean;
}

export interface RenderHookOptions {
  componentName: string;
  enableFrequencyThrottling?: boolean;
  enableOffscreenSkipping?: boolean;
  dependencies?: any[];
  customComparison?: (prev: any[], next: any[]) => boolean;
}

export interface BatchedUpdateOptions {
  priority?: 'high' | 'normal' | 'low';
  coalesceKey?: string;
  debounce?: boolean;
  maxWaitTime?: number;
}

export interface ChangeDetectionHookOptions {
  enableCaching?: boolean;
  pathBasedComparison?: boolean;
  customComparators?: boolean;
  paths?: string[];
}

export interface PerformanceMetrics {
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  optimizationEfficiency: number;
  memoryUsage: number;
  cacheHitRate: number;
}

/**
 * Hook for optimized component rendering with intelligent memoization
 */
export const useOptimizedRender = <T extends any[]>(
  renderFn: (...args: T) => JSX.Element | null,
  dependencies: T,
  options: RenderHookOptions
): JSX.Element | null => {
  const {
    componentName,
    enableFrequencyThrottling = true,
    enableOffscreenSkipping = true,
    customComparison
  } = options;

  const lastDepsRef = useRef<T>();
  const renderCountRef = useRef(0);
  const elementRef = useRef<Element | null>(null);
  const lastResultRef = useRef<JSX.Element | null>(null);

  // Check if render should be skipped
  const shouldRender = useMemo(() => {
    const startTime = performance.now();

    // Check frequency throttling
    if (enableFrequencyThrottling && !renderOptimizer.trackRenderFrequency(componentName)) {
      return false;
    }

    // Check if dependencies changed
    let depsChanged = true;
    if (lastDepsRef.current) {
      if (customComparison) {
        depsChanged = !customComparison(lastDepsRef.current, dependencies);
      } else {
        const result = changeDetector.deepEquals(lastDepsRef.current, dependencies);
        depsChanged = !result.isEqual;
      }
    }

    if (!depsChanged) {
      return false; // No need to re-render
    }

    // Check offscreen skipping
    if (enableOffscreenSkipping && renderOptimizer.skipOffscreenRenders(componentName, elementRef.current)) {
      return false;
    }

    // Update dependencies reference
    lastDepsRef.current = dependencies;
    
    const endTime = performance.now();
    renderOptimizer.collectMetrics(componentName, startTime, endTime, {
      renderStartTime: startTime,
      renderEndTime: endTime,
      renderDuration: endTime - startTime,
      propsChanged: depsChanged,
      stateChanged: false,
      forceRender: false,
      isVisible: true
    });

    return true;
  }, dependencies);

  // Memoized render function
  const memoizedRender = useCallback(() => {
    if (!shouldRender && lastResultRef.current) {
      return lastResultRef.current;
    }

    const startTime = performance.now();
    const result = renderFn(...dependencies);
    const endTime = performance.now();

    renderCountRef.current++;
    lastResultRef.current = result;

    // Collect detailed render metrics
    renderOptimizer.collectMetrics(componentName, startTime, endTime, {
      renderStartTime: startTime,
      renderEndTime: endTime,
      renderDuration: endTime - startTime,
      propsChanged: true,
      stateChanged: false,
      forceRender: false,
      isVisible: true
    });

    return result;
  }, [shouldRender, renderFn, dependencies, componentName]);

  // Batch the render using requestAnimationFrame
  const [renderedElement, setRenderedElement] = useState<JSX.Element | null>(null);

  useEffect(() => {
    renderOptimizer.batchRenders(() => {
      const element = memoizedRender();
      setRenderedElement(element);
    });
  }, [memoizedRender]);

  return renderedElement;
};

/**
 * Hook for batched state updates with intelligent coalescing
 */
export const useBatchedUpdates = <T>(
  initialState: T,
  options: BatchedUpdateOptions = {}
) => {
  const {
    priority = 'normal',
    coalesceKey,
    debounce = true,
    maxWaitTime = 1000
  } = options;

  const [state, setState] = useState<T>(initialState);
  const updateCounterRef = useRef(0);
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map());

  const batchedSetState = useCallback(
    async (newState: T | ((prevState: T) => T)): Promise<UpdateResult> => {
      const updateId = `update-${++updateCounterRef.current}`;
      
      const resolvedState = typeof newState === 'function' 
        ? (newState as (prevState: T) => T)(state)
        : newState;

      const stateUpdate: StateUpdate = {
        id: updateId,
        type: 'state-update',
        data: resolvedState,
        timestamp: Date.now(),
        source: 'user',
        dependencies: [],
        coalesceKey: coalesceKey || 'default'
      };

      // Store pending update
      pendingUpdatesRef.current.set(updateId, resolvedState);

      try {
        const result = await updateBatcher.batchUpdates(stateUpdate, priority);
        
        if (result.success) {
          // Apply the state change
          setState(resolvedState);
          pendingUpdatesRef.current.delete(updateId);
        }

        return result;
      } catch (error) {
        pendingUpdatesRef.current.delete(updateId);
        throw error;
      }
    },
    [state, priority, coalesceKey]
  );

  const getPendingUpdates = useCallback(() => {
    return Array.from(pendingUpdatesRef.current.values());
  }, []);

  const clearPendingUpdates = useCallback(() => {
    pendingUpdatesRef.current.clear();
  }, []);

  return {
    state,
    setState: batchedSetState,
    getPendingUpdates,
    clearPendingUpdates
  };
};

/**
 * Hook for optimized change detection with caching
 */
export const useChangeDetection = <T>(
  value: T,
  options: ChangeDetectionHookOptions = {}
): ComparisonResult & { hasChanged: boolean; previousValue: T | undefined } => {
  const {
    enableCaching = true,
    pathBasedComparison = false,
    customComparators = true,
    paths = []
  } = options;

  const previousValueRef = useRef<T>();
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult>({
    isEqual: true,
    changedPaths: [],
    comparisonTime: 0,
    cacheHit: false,
    structuralOptimization: false
  });

  const result = useMemo(() => {
    if (previousValueRef.current === undefined) {
      previousValueRef.current = value;
      return {
        isEqual: true,
        changedPaths: [],
        comparisonTime: 0,
        cacheHit: false,
        structuralOptimization: false
      };
    }

    const detectionOptions = {
      enableCaching,
      pathBasedComparison,
      enableCustomComparators: customComparators
    };

    let comparison: ComparisonResult;

    if (pathBasedComparison && paths.length > 0) {
      comparison = changeDetector.selectiveComparison(
        previousValueRef.current,
        value,
        paths,
        detectionOptions
      );
    } else {
      comparison = changeDetector.deepEquals(
        previousValueRef.current,
        value,
        detectionOptions
      );
    }

    previousValueRef.current = value;
    return comparison;
  }, [value, enableCaching, pathBasedComparison, customComparators, paths]);

  useEffect(() => {
    setComparisonResult(result);
  }, [result]);

  return {
    ...comparisonResult,
    hasChanged: !comparisonResult.isEqual,
    previousValue: previousValueRef.current
  };
};

/**
 * Hook for component performance metrics and monitoring
 */
export const useRenderMetrics = (
  componentName: string,
  enableRealtimeUpdates: boolean = false
): PerformanceMetrics & {
  resetMetrics: () => void;
  getDetailedMetrics: () => RenderMetrics | null;
} => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    optimizationEfficiency: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  });

  const updateMetrics = useCallback(() => {
    const renderMetrics = renderOptimizer.getComponentMetrics(componentName);
    const renderStats = renderOptimizer.getRenderStats();
    const changeStats = changeDetector.getStats();

    const updatedMetrics: PerformanceMetrics = {
      renderCount: renderMetrics?.renderCount || 0,
      averageRenderTime: renderMetrics?.averageRenderTime || 0,
      lastRenderTime: renderMetrics?.lastRenderTime || 0,
      optimizationEfficiency: renderStats.optimizationEfficiency,
      memoryUsage: renderStats.memoryUsage + changeStats.memoryUsage,
      cacheHitRate: changeStats.totalComparisons > 0 
        ? (changeStats.cacheHits / changeStats.totalComparisons) * 100 
        : 0
    };

    setMetrics(updatedMetrics);
  }, [componentName]);

  // Update metrics on mount and when dependencies change
  useEffect(() => {
    updateMetrics();
  }, [updateMetrics]);

  // Realtime updates if enabled
  useEffect(() => {
    if (!enableRealtimeUpdates) return;

    const interval = setInterval(updateMetrics, 1000); // Update every second
    return () => clearInterval(interval);
  }, [enableRealtimeUpdates, updateMetrics]);

  const resetMetrics = useCallback(() => {
    renderOptimizer.resetMetrics();
    changeDetector.resetStats();
    updateMetrics();
  }, [updateMetrics]);

  const getDetailedMetrics = useCallback(() => {
    return renderOptimizer.getComponentMetrics(componentName);
  }, [componentName]);

  return {
    ...metrics,
    resetMetrics,
    getDetailedMetrics
  };
};

/**
 * Hook for dependency tracking with intelligent optimization
 * Provides advanced dependencyTracking capabilities for React components
 */
export const useDependencyTracking = <T extends any[]>(
  dependencies: T,
  debugName?: string
): {
  dependencies: T;
  hasChanged: boolean;
  changedIndices: number[];
  optimizationApplied: boolean;
} => {
  const previousDepsRef = useRef<T>();
  const optimizationAppliedRef = useRef(false);

  const result = useMemo(() => {
    if (!previousDepsRef.current) {
      previousDepsRef.current = dependencies;
      return {
        dependencies,
        hasChanged: true,
        changedIndices: [],
        optimizationApplied: false
      };
    }

    const changedIndices: number[] = [];
    let hasChanged = false;

    // Check each dependency individually
    dependencies.forEach((dep, index) => {
      const prevDep = previousDepsRef.current![index];
      const comparison = changeDetector.deepEquals(prevDep, dep);
      
      if (!comparison.isEqual) {
        hasChanged = true;
        changedIndices.push(index);
      }
    });

    // Apply optimization if possible
    optimizationAppliedRef.current = !hasChanged;

    if (debugName && hasChanged) {
      console.log(`🔍 ${debugName}: Dependencies changed at indices [${changedIndices.join(', ')}]`);
    }

    previousDepsRef.current = dependencies;

    return {
      dependencies,
      hasChanged,
      changedIndices,
      optimizationApplied: optimizationAppliedRef.current
    };
  }, dependencies);

  return result;
};

/**
 * Hook for performance debugging and monitoring
 */
export const usePerformanceDebug = (
  componentName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
): {
  startTiming: (label: string) => void;
  endTiming: (label: string) => number;
  logMetrics: () => void;
  getTimings: () => Record<string, number>;
} => {
  const timingsRef = useRef<Map<string, number>>(new Map());
  const metricsRef = useRef<Map<string, number>>(new Map());

  const startTiming = useCallback((label: string) => {
    if (!enabled) return;
    timingsRef.current.set(label, performance.now());
  }, [enabled]);

  const endTiming = useCallback((label: string): number => {
    if (!enabled) return 0;
    
    const startTime = timingsRef.current.get(label);
    if (startTime === undefined) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    timingsRef.current.delete(label);
    metricsRef.current.set(label, duration);

    console.log(`⏱️ ${componentName} - ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }, [enabled, componentName]);

  const logMetrics = useCallback(() => {
    if (!enabled) return;

    const renderMetrics = renderOptimizer.getComponentMetrics(componentName);
    const renderStats = renderOptimizer.getRenderStats();
    const changeStats = changeDetector.getStats();

    console.group(`📊 Performance Metrics - ${componentName}`);
    console.log('Render Metrics:', renderMetrics);
    console.log('Global Stats:', renderStats);
    console.log('Change Detection:', changeStats);
    console.log('Custom Timings:', Object.fromEntries(metricsRef.current));
    console.groupEnd();
  }, [enabled, componentName]);

  const getTimings = useCallback((): Record<string, number> => {
    return Object.fromEntries(metricsRef.current);
  }, []);

  return {
    startTiming,
    endTiming,
    logMetrics,
    getTimings
  };
};

/**
 * Hook for memory usage optimization
 */
export const useMemoryOptimization = (
  componentName: string,
  options: { 
    enableAutoCleanup?: boolean;
    cleanupInterval?: number;
    memoryThreshold?: number; // in MB
  } = {}
): {
  memoryUsage: number;
  optimizeMemory: () => void;
  isMemoryOptimal: boolean;
} => {
  const {
    enableAutoCleanup = true,
    cleanupInterval = 30000, // 30 seconds
    memoryThreshold = 50 // 50MB
  } = options;

  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isMemoryOptimal, setIsMemoryOptimal] = useState(true);

  const optimizeMemory = useCallback(() => {
    // Trigger memory optimization
    renderOptimizer.cleanup();
    changeDetector.memoryOptimization();
    updateBatcher.cleanup();

    // Update memory usage
    const stats = renderOptimizer.getRenderStats();
    const changeStats = changeDetector.getStats();
    const totalMemory = stats.memoryUsage + changeStats.memoryUsage;
    
    setMemoryUsage(totalMemory);
    setIsMemoryOptimal(totalMemory < memoryThreshold);

    console.log(`🧹 Memory optimized for ${componentName}: ${totalMemory.toFixed(2)}KB`);
  }, [componentName, memoryThreshold]);

  // Auto cleanup
  useEffect(() => {
    if (!enableAutoCleanup) return;

    const interval = setInterval(optimizeMemory, cleanupInterval);
    return () => clearInterval(interval);
  }, [enableAutoCleanup, cleanupInterval, optimizeMemory]);

  // Initial memory check
  useEffect(() => {
    optimizeMemory();
  }, [optimizeMemory]);

  return {
    memoryUsage,
    optimizeMemory,
    isMemoryOptimal
  };
};

// Export utility functions
export const performanceUtils = {
  // Create a memoized component wrapper
  memoizeComponent: <P extends object>(
    Component: React.ComponentType<P>,
    componentName: string,
    customComparison?: (prevProps: P, nextProps: P) => boolean
  ) => renderOptimizer.memoizeComponent(Component, componentName, customComparison),

  // Batch multiple state updates
  batchStateUpdates: (updates: StateUpdate[], priority: 'high' | 'normal' | 'low' = 'normal') =>
    updateBatcher.batchUpdates(updates, priority),

  // Deep compare two values
  deepCompare: (a: any, b: any, options?: Partial<ChangeDetectionOptions>) =>
    changeDetector.deepEquals(a, b, options),

  // Get global performance statistics
  getGlobalStats: () => ({
    render: renderOptimizer.getRenderStats(),
    changeDetection: changeDetector.getStats(),
    batching: updateBatcher.getStats()
  }),

  // Reset all performance metrics
  resetAllMetrics: () => {
    renderOptimizer.resetMetrics();
    changeDetector.resetStats();
    updateBatcher.resetStats();
  },

  // Micro-optimization utilities for Phase 5 100% completion
  optimizeMemoryUsage: () => {
    // Force garbage collection of weak references and clear caches
    renderOptimizer.clearCache();
    changeDetector.clearCache();
    updateBatcher.clearCache();
  },

  preloadOptimizations: () => {
    // Pre-initialize critical performance systems for faster runtime
    renderOptimizer.warmupMetrics();
    changeDetector.warmupComparison();
    updateBatcher.warmupBatching();
  },

  enableHighPerformanceMode: () => {
    // Enable aggressive optimizations for maximum performance
    renderOptimizer.enableOptimizations();
    changeDetector.enableFastMode();
    updateBatcher.enableTurboMode();
  }
};

// Export types for external use
export type {
  PerformanceConfig,
  RenderHookOptions,
  BatchedUpdateOptions,
  ChangeDetectionHookOptions,
  PerformanceMetrics
};