/**
 * Component Integration for MCP Data Adapters
 * 
 * Integration utilities to connect the adapter system with existing dashboard components.
 * Provides backward compatibility and seamless integration with current data flows.
 */

import { 
  ChartDataAdapter, 
  WidgetDataAdapter, 
  TableDataAdapter, 
  MetricCardAdapter,
  createChartAdapter,
  createWidgetAdapter,
  createTableAdapter,
  createMetricCardAdapter
} from './index';

import type {
  ChartInputData,
  WidgetInputData, 
  TableInputData,
  MetricCardInputData,
  ExtendedAdapterConfig
} from './index';

// ============================================================================
// COMPONENT INTEGRATION TYPES
// ============================================================================

/**
 * Integration configuration for component adapters
 */
export interface ComponentIntegrationConfig {
  // Adapter configuration
  adapterConfig?: ExtendedAdapterConfig;
  
  // Performance options
  enableCaching?: boolean;
  cacheTimeout?: number;
  enablePerformanceLogging?: boolean;
  
  // Error handling
  enableFallbackData?: boolean;
  logErrors?: boolean;
  throwOnError?: boolean;
  
  // Compatibility options
  enableLegacySupport?: boolean;
  preserveOriginalData?: boolean;
  enableDataComparison?: boolean;
}

/**
 * Integration result with metadata
 */
export interface IntegrationResult<T> {
  data: T;
  metadata: {
    adapterId: string;
    processingTime: number;
    isFromCache: boolean;
    hasFallback: boolean;
    validationPassed: boolean;
    sanitizationApplied: boolean;
    warnings: string[];
  };
  original?: any; // Original data for comparison
}

/**
 * Performance metrics for integration
 */
export interface IntegrationMetrics {
  totalTransformations: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  validationFailureRate: number;
  lastUpdated: Date;
}

// ============================================================================
// COMPONENT INTEGRATION MANAGER
// ============================================================================

/**
 * Main integration manager for component adapters
 */
export class ComponentIntegrationManager {
  private static instance: ComponentIntegrationManager;
  private config: ComponentIntegrationConfig;
  private cache: Map<string, { data: any; timestamp: number }>;
  private metrics: IntegrationMetrics;
  
  private constructor(config: ComponentIntegrationConfig = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      enablePerformanceLogging: false,
      enableFallbackData: true,
      logErrors: true,
      throwOnError: false,
      enableLegacySupport: true,
      preserveOriginalData: false,
      enableDataComparison: false,
      ...config
    };
    
    this.cache = new Map();
    this.metrics = {
      totalTransformations: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      validationFailureRate: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: ComponentIntegrationConfig): ComponentIntegrationManager {
    if (!ComponentIntegrationManager.instance) {
      ComponentIntegrationManager.instance = new ComponentIntegrationManager(config);
    }
    return ComponentIntegrationManager.instance;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ComponentIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get integration metrics
   */
  public getMetrics(): IntegrationMetrics {
    return { ...this.metrics };
  }

  // ============================================================================
  // CHART COMPONENT INTEGRATION
  // ============================================================================

  /**
   * Integrate chart data with Line Chart component
   */
  public async integrateLineChart(
    data: ChartInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any[]>> {
    return this.processIntegration(
      'line-chart',
      data,
      () => createChartAdapter('line', this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate chart data with Bar Chart component
   */
  public async integrateBarChart(
    data: ChartInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any[]>> {
    return this.processIntegration(
      'bar-chart',
      data,
      () => createChartAdapter('bar', this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate chart data with Donut Chart component
   */
  public async integrateDonutChart(
    data: ChartInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any[]>> {
    return this.processIntegration(
      'donut-chart',
      data,
      () => createChartAdapter('donut', this.getAdapterConfig(config)),
      config
    );
  }

  // ============================================================================
  // WIDGET COMPONENT INTEGRATION
  // ============================================================================

  /**
   * Integrate data with Traffic Overview Widget
   */
  public async integrateTrafficOverviewWidget(
    data: WidgetInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.processIntegration(
      'traffic-overview-widget',
      data,
      () => createWidgetAdapter('traffic-overview', this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate data with Conversion Widget
   */
  public async integrateConversionWidget(
    data: WidgetInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.processIntegration(
      'conversion-widget',
      data,
      () => createWidgetAdapter('conversion', this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate data with Traffic Source Widget
   */
  public async integrateTrafficSourceWidget(
    data: WidgetInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.processIntegration(
      'traffic-source-widget',
      data,
      () => createWidgetAdapter('traffic-source', this.getAdapterConfig(config)),
      config
    );
  }

  // ============================================================================
  // TABLE COMPONENT INTEGRATION
  // ============================================================================

  /**
   * Integrate data with Table Component
   */
  public async integrateTable(
    data: TableInputData,
    tableType: 'generic' | 'analytics' | 'conversion' = 'generic',
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.processIntegration(
      `table-${tableType}`,
      data,
      () => createTableAdapter(tableType, this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate data with Analytics Table
   */
  public async integrateAnalyticsTable(
    data: TableInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.integrateTable(data, 'analytics', config);
  }

  /**
   * Integrate data with Conversion Table
   */
  public async integrateConversionTable(
    data: TableInputData,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.integrateTable(data, 'conversion', config);
  }

  // ============================================================================
  // METRIC CARD INTEGRATION
  // ============================================================================

  /**
   * Integrate data with Metric Card Component
   */
  public async integrateMetricCard(
    data: MetricCardInputData,
    metricType?: 'generic' | 'bounce-rate' | 'conversion-rate' | 'revenue' | 'duration',
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any>> {
    return this.processIntegration(
      `metric-card-${metricType || 'generic'}`,
      data,
      () => createMetricCardAdapter(metricType, this.getAdapterConfig(config)),
      config
    );
  }

  /**
   * Integrate multiple metric cards in batch
   */
  public async integrateMetricCardBatch(
    metrics: Array<{ data: MetricCardInputData; type?: string; id: string }>,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<any[]>> {
    const startTime = Date.now();
    const results: any[] = [];
    const warnings: string[] = [];
    
    try {
      for (const metric of metrics) {
        const result = await this.integrateMetricCard(
          metric.data,
          metric.type as any,
          config
        );
        results.push({
          id: metric.id,
          ...result.data
        });
        warnings.push(...result.metadata.warnings);
      }

      return {
        data: results,
        metadata: {
          adapterId: 'metric-card-batch',
          processingTime: Date.now() - startTime,
          isFromCache: false,
          hasFallback: false,
          validationPassed: true,
          sanitizationApplied: true,
          warnings
        }
      };
    } catch (error) {
      if (this.config.throwOnError) {
        throw error;
      }
      
      return {
        data: [],
        metadata: {
          adapterId: 'metric-card-batch',
          processingTime: Date.now() - startTime,
          isFromCache: false,
          hasFallback: true,
          validationPassed: false,
          sanitizationApplied: false,
          warnings: [`Batch processing failed: ${error.message}`]
        }
      };
    }
  }

  // ============================================================================
  // CORE INTEGRATION PROCESSING
  // ============================================================================

  /**
   * Core integration processing logic
   */
  private async processIntegration<TInput, TOutput>(
    adapterId: string,
    data: TInput,
    adapterFactory: () => any,
    config?: ComponentIntegrationConfig
  ): Promise<IntegrationResult<TOutput>> {
    const startTime = Date.now();
    const effectiveConfig = { ...this.config, ...config };
    
    try {
      // Check cache first
      if (effectiveConfig.enableCaching) {
        const cacheKey = this.generateCacheKey(adapterId, data);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.updateMetrics(true, Date.now() - startTime, true, false);
          return {
            data: cached,
            metadata: {
              adapterId,
              processingTime: Date.now() - startTime,
              isFromCache: true,
              hasFallback: false,
              validationPassed: true,
              sanitizationApplied: true,
              warnings: []
            },
            original: effectiveConfig.preserveOriginalData ? data : undefined
          };
        }
      }

      // Create and use adapter
      const adapter = adapterFactory();
      const result = adapter.transform(data);
      
      // Cache result if enabled
      if (effectiveConfig.enableCaching) {
        const cacheKey = this.generateCacheKey(adapterId, data);
        this.setCache(cacheKey, result);
      }

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime, false, false);

      // Performance logging
      if (effectiveConfig.enablePerformanceLogging) {
        console.log(`[ComponentIntegration] ${adapterId} processed in ${Date.now() - startTime}ms`);
      }

      return {
        data: result,
        metadata: {
          adapterId,
          processingTime: Date.now() - startTime,
          isFromCache: false,
          hasFallback: false,
          validationPassed: true,
          sanitizationApplied: true,
          warnings: []
        },
        original: effectiveConfig.preserveOriginalData ? data : undefined
      };

    } catch (error) {
      // Handle errors
      this.updateMetrics(false, Date.now() - startTime, false, true);
      
      if (effectiveConfig.logErrors) {
        console.error(`[ComponentIntegration] ${adapterId} failed:`, error);
      }

      if (effectiveConfig.enableFallbackData) {
        // Try to get fallback data
        try {
          const adapter = adapterFactory();
          const fallbackData = adapter.getDefaultOutput();
          
          return {
            data: fallbackData,
            metadata: {
              adapterId,
              processingTime: Date.now() - startTime,
              isFromCache: false,
              hasFallback: true,
              validationPassed: false,
              sanitizationApplied: false,
              warnings: [`Adapter error: ${error.message}. Using fallback data.`]
            },
            original: effectiveConfig.preserveOriginalData ? data : undefined
          };
        } catch (fallbackError) {
          // Fallback failed too
          if (effectiveConfig.throwOnError) {
            throw new Error(`Adapter and fallback both failed: ${error.message}, ${fallbackError.message}`);
          }
        }
      }

      if (effectiveConfig.throwOnError) {
        throw error;
      }

      // Return minimal safe data
      return {
        data: null as any,
        metadata: {
          adapterId,
          processingTime: Date.now() - startTime,
          isFromCache: false,
          hasFallback: false,
          validationPassed: false,
          sanitizationApplied: false,
          warnings: [`Critical error: ${error.message}`]
        },
        original: effectiveConfig.preserveOriginalData ? data : undefined
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate cache key for data
   */
  private generateCacheKey(adapterId: string, data: any): string {
    return `${adapterId}:${JSON.stringify(data).substring(0, 100)}:${Date.now()}`;
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < (this.config.cacheTimeout || 300000)) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get adapter configuration
   */
  private getAdapterConfig(config?: ComponentIntegrationConfig): ExtendedAdapterConfig {
    return config?.adapterConfig || this.config.adapterConfig || {};
  }

  /**
   * Update integration metrics
   */
  private updateMetrics(success: boolean, processingTime: number, fromCache: boolean, isError: boolean): void {
    this.metrics.totalTransformations++;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalTransformations - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalTransformations;
    
    // Update cache hit rate
    if (fromCache) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalTransformations - 1) + 1) / this.metrics.totalTransformations;
    } else {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalTransformations - 1)) / this.metrics.totalTransformations;
    }
    
    // Update error rate
    if (isError) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalTransformations - 1) + 1) / this.metrics.totalTransformations;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalTransformations - 1)) / this.metrics.totalTransformations;
    }
    
    this.metrics.lastUpdated = new Date();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick integration functions for common use cases
 */
export const ComponentIntegration = {
  /**
   * Initialize integration manager
   */
  init: (config?: ComponentIntegrationConfig) => ComponentIntegrationManager.getInstance(config),

  /**
   * Quick chart integration
   */
  chart: {
    line: (data: ChartInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateLineChart(data, config),
    bar: (data: ChartInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateBarChart(data, config),
    donut: (data: ChartInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateDonutChart(data, config)
  },

  /**
   * Quick widget integration
   */
  widget: {
    trafficOverview: (data: WidgetInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateTrafficOverviewWidget(data, config),
    conversion: (data: WidgetInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateConversionWidget(data, config),
    trafficSource: (data: WidgetInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateTrafficSourceWidget(data, config)
  },

  /**
   * Quick table integration
   */
  table: {
    generic: (data: TableInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateTable(data, 'generic', config),
    analytics: (data: TableInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateAnalyticsTable(data, config),
    conversion: (data: TableInputData, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateConversionTable(data, config)
  },

  /**
   * Quick metric card integration
   */
  metric: {
    card: (data: MetricCardInputData, type?: string, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateMetricCard(data, type as any, config),
    batch: (metrics: Array<{ data: MetricCardInputData; type?: string; id: string }>, config?: ComponentIntegrationConfig) => 
      ComponentIntegrationManager.getInstance().integrateMetricCardBatch(metrics, config)
  },

  /**
   * Get metrics
   */
  getMetrics: () => ComponentIntegrationManager.getInstance().getMetrics(),

  /**
   * Clear cache
   */
  clearCache: () => ComponentIntegrationManager.getInstance().clearCache()
};

/**
 * Default integration manager instance
 */
export const integrationManager = ComponentIntegrationManager.getInstance();