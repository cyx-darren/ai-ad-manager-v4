/**
 * Backward Compatibility for MCP Data Adapters
 * 
 * Ensures seamless integration with existing dashboard components while maintaining
 * backward compatibility with current data flows and interfaces.
 */

import { ComponentIntegration } from './ComponentIntegration';
import type {
  ChartInputData,
  WidgetInputData,
  TableInputData,
  MetricCardInputData,
  ComponentIntegrationConfig
} from './index';

// ============================================================================
// LEGACY DATA INTERFACE COMPATIBILITY
// ============================================================================

/**
 * Legacy chart data format (existing dashboard format)
 */
export interface LegacyChartData {
  data?: Array<{
    date?: string;
    value?: number;
    [key: string]: any;
  }>;
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }>;
}

/**
 * Legacy widget data format (existing dashboard format)
 */
export interface LegacyWidgetData {
  sessions?: number;
  pageviews?: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  conversionRate?: number;
  revenue?: number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  [key: string]: any;
}

/**
 * Legacy table data format (existing dashboard format)
 */
export interface LegacyTableData {
  rows?: Array<{ [key: string]: any }>;
  columns?: Array<{
    key: string;
    label?: string;
    title?: string;
    type?: string;
  }>;
  pagination?: {
    current?: number;
    total?: number;
    pageSize?: number;
  };
}

/**
 * Legacy metric card data format (existing dashboard format)
 */
export interface LegacyMetricCardData {
  value?: number;
  previousValue?: number;
  label?: string;
  title?: string;
  unit?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  trend?: 'up' | 'down' | 'stable';
}

// ============================================================================
// COMPATIBILITY CONFIGURATION
// ============================================================================

/**
 * Compatibility mode configuration
 */
export interface CompatibilityConfig {
  // Data transformation options
  enableLegacyFormat?: boolean;
  preserveOriginalStructure?: boolean;
  enableDataMigration?: boolean;
  
  // Fallback options
  useLegacyFallback?: boolean;
  enableGracefulDegradation?: boolean;
  
  // Validation options
  relaxValidation?: boolean;
  allowMissingFields?: boolean;
  
  // Performance options
  enableCaching?: boolean;
  enableBatchProcessing?: boolean;
  
  // Debug options
  logTransformations?: boolean;
  enableCompatibilityWarnings?: boolean;
}

// ============================================================================
// BACKWARD COMPATIBILITY MANAGER
// ============================================================================

/**
 * Main backward compatibility manager
 */
export class BackwardCompatibilityManager {
  private static instance: BackwardCompatibilityManager;
  private config: CompatibilityConfig;
  
  private constructor(config: CompatibilityConfig = {}) {
    this.config = {
      enableLegacyFormat: true,
      preserveOriginalStructure: false,
      enableDataMigration: true,
      useLegacyFallback: true,
      enableGracefulDegradation: true,
      relaxValidation: true,
      allowMissingFields: true,
      enableCaching: true,
      enableBatchProcessing: false,
      logTransformations: false,
      enableCompatibilityWarnings: true,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: CompatibilityConfig): BackwardCompatibilityManager {
    if (!BackwardCompatibilityManager.instance) {
      BackwardCompatibilityManager.instance = new BackwardCompatibilityManager(config);
    }
    return BackwardCompatibilityManager.instance;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<CompatibilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ============================================================================
  // LEGACY TO NEW FORMAT MIGRATION
  // ============================================================================

  /**
   * Migrate legacy chart data to new adapter format
   */
  public migrateLegacyChartData(legacyData: LegacyChartData): ChartInputData {
    if (this.config.logTransformations) {
      console.log('[Compatibility] Migrating legacy chart data:', legacyData);
    }

    // Handle direct data array format
    if (legacyData.data) {
      return {
        data: legacyData.data.map(item => ({
          date: item.date || new Date().toISOString().split('T')[0],
          value: item.value || 0,
          ...item
        })),
        summary: this.extractChartSummary(legacyData.data)
      };
    }

    // Handle chart.js dataset format
    if (legacyData.datasets && legacyData.labels) {
      const data = legacyData.labels.map((label, index) => ({
        date: label,
        value: legacyData.datasets![0]?.data?.[index] || 0,
        label: legacyData.datasets![0]?.label || 'Data'
      }));

      return {
        data,
        summary: this.extractChartSummary(data)
      };
    }

    // Fallback for unknown formats
    if (this.config.enableCompatibilityWarnings) {
      console.warn('[Compatibility] Unknown legacy chart data format, using fallback');
    }

    return {
      data: [],
      summary: { total: 0, change: 0, trend: 'stable' }
    };
  }

  /**
   * Migrate legacy widget data to new adapter format
   */
  public migrateLegacyWidgetData(legacyData: LegacyWidgetData): WidgetInputData {
    if (this.config.logTransformations) {
      console.log('[Compatibility] Migrating legacy widget data:', legacyData);
    }

    return {
      data: [
        {
          sessions: legacyData.sessions || 0,
          pageviews: legacyData.pageviews || 0,
          bounceRate: legacyData.bounceRate || 0,
          avgSessionDuration: legacyData.avgSessionDuration || 0,
          conversionRate: legacyData.conversionRate || 0,
          revenue: legacyData.revenue || 0,
          ...legacyData
        }
      ],
      summary: {
        totalSessions: legacyData.sessions || 0,
        changePercent: legacyData.change || 0,
        trend: legacyData.trend || 'stable'
      }
    };
  }

  /**
   * Migrate legacy table data to new adapter format
   */
  public migrateLegacyTableData(legacyData: LegacyTableData): TableInputData {
    if (this.config.logTransformations) {
      console.log('[Compatibility] Migrating legacy table data:', legacyData);
    }

    return {
      data: legacyData.rows || [],
      columns: legacyData.columns?.map(col => ({
        key: col.key,
        title: col.title || col.label || col.key,
        type: this.inferColumnType(col.type),
        sortable: true
      })) || undefined,
      pagination: legacyData.pagination ? {
        page: legacyData.pagination.current || 1,
        pageSize: legacyData.pagination.pageSize || 10,
        total: legacyData.pagination.total || 0
      } : undefined
    };
  }

  /**
   * Migrate legacy metric card data to new adapter format
   */
  public migrateLegacyMetricCardData(legacyData: LegacyMetricCardData): MetricCardInputData {
    if (this.config.logTransformations) {
      console.log('[Compatibility] Migrating legacy metric card data:', legacyData);
    }

    return {
      current: legacyData.value || 0,
      previous: legacyData.previousValue,
      title: legacyData.title || legacyData.label || 'Metric',
      unit: legacyData.unit,
      type: this.inferMetricType(legacyData.unit),
      trend: legacyData.trend
    };
  }

  // ============================================================================
  // NEW TO LEGACY FORMAT CONVERSION
  // ============================================================================

  /**
   * Convert new adapter result to legacy chart format
   */
  public convertToLegacyChartFormat(adapterResult: any[]): LegacyChartData {
    if (!Array.isArray(adapterResult)) {
      return { data: [] };
    }

    // Convert to legacy data format
    const data = adapterResult.map(item => ({
      date: item.date || item.x || item.label,
      value: item.value || item.y || item.count || 0,
      ...item
    }));

    // Also provide chart.js compatible format
    const labels = data.map(item => item.date);
    const values = data.map(item => item.value);

    return {
      data,
      labels,
      datasets: [{
        label: 'Data',
        data: values,
        backgroundColor: '#8884d8',
        borderColor: '#8884d8'
      }]
    };
  }

  /**
   * Convert new adapter result to legacy widget format
   */
  public convertToLegacyWidgetFormat(adapterResult: any): LegacyWidgetData {
    if (!adapterResult || typeof adapterResult !== 'object') {
      return {};
    }

    return {
      sessions: adapterResult.sessions || adapterResult.totalSessions || 0,
      pageviews: adapterResult.pageviews || adapterResult.totalPageviews || 0,
      bounceRate: adapterResult.bounceRate || 0,
      avgSessionDuration: adapterResult.avgSessionDuration || adapterResult.sessionDuration || 0,
      conversionRate: adapterResult.conversionRate || 0,
      revenue: adapterResult.revenue || adapterResult.totalRevenue || 0,
      change: adapterResult.change || adapterResult.changePercent || 0,
      trend: adapterResult.trend || 'stable',
      ...adapterResult
    };
  }

  /**
   * Convert new adapter result to legacy table format
   */
  public convertToLegacyTableFormat(adapterResult: any): LegacyTableData {
    if (!adapterResult || typeof adapterResult !== 'object') {
      return { rows: [] };
    }

    return {
      rows: adapterResult.data || adapterResult.rows || [],
      columns: adapterResult.columns?.map((col: any) => ({
        key: col.key,
        label: col.title || col.label,
        title: col.title || col.label,
        type: col.type
      })) || undefined,
      pagination: adapterResult.pagination ? {
        current: adapterResult.pagination.page,
        total: adapterResult.pagination.total,
        pageSize: adapterResult.pagination.pageSize
      } : undefined
    };
  }

  /**
   * Convert new adapter result to legacy metric card format
   */
  public convertToLegacyMetricCardFormat(adapterResult: any): LegacyMetricCardData {
    if (!adapterResult || typeof adapterResult !== 'object') {
      return {};
    }

    return {
      value: adapterResult.current || adapterResult.value || 0,
      previousValue: adapterResult.previous || adapterResult.previousValue,
      label: adapterResult.title || adapterResult.label,
      title: adapterResult.title || adapterResult.label,
      unit: adapterResult.unit,
      change: adapterResult.change || adapterResult.changePercent,
      changeType: this.determineChangeType(adapterResult.change),
      trend: adapterResult.trend
    };
  }

  // ============================================================================
  // COMPATIBILITY BRIDGE FUNCTIONS
  // ============================================================================

  /**
   * Process chart data with backward compatibility
   */
  public async processChartDataWithCompatibility(
    data: LegacyChartData | ChartInputData,
    chartType: 'line' | 'bar' | 'donut' = 'line',
    returnLegacyFormat: boolean = false
  ): Promise<LegacyChartData | any[]> {
    try {
      // Determine if data is in legacy format
      const isLegacyFormat = this.isLegacyChartData(data);
      
      // Migrate to new format if needed
      const normalizedData = isLegacyFormat 
        ? this.migrateLegacyChartData(data as LegacyChartData)
        : data as ChartInputData;

      // Process with new adapter system
      const result = await ComponentIntegration.chart[chartType](normalizedData, {
        enableFallbackData: this.config.useLegacyFallback,
        logErrors: this.config.logTransformations
      });

      // Convert back to legacy format if requested
      if (returnLegacyFormat) {
        return this.convertToLegacyChartFormat(result.data);
      }

      return result.data;

    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn('[Compatibility] Chart processing failed, using fallback:', error);
        return returnLegacyFormat ? { data: [] } : [];
      }
      throw error;
    }
  }

  /**
   * Process widget data with backward compatibility
   */
  public async processWidgetDataWithCompatibility(
    data: LegacyWidgetData | WidgetInputData,
    widgetType: 'traffic-overview' | 'conversion' | 'traffic-source' = 'traffic-overview',
    returnLegacyFormat: boolean = false
  ): Promise<LegacyWidgetData | any> {
    try {
      // Determine if data is in legacy format
      const isLegacyFormat = this.isLegacyWidgetData(data);
      
      // Migrate to new format if needed
      const normalizedData = isLegacyFormat 
        ? this.migrateLegacyWidgetData(data as LegacyWidgetData)
        : data as WidgetInputData;

      // Process with new adapter system
      const result = await ComponentIntegration.widget[widgetType.replace('-', '') as keyof typeof ComponentIntegration.widget](normalizedData, {
        enableFallbackData: this.config.useLegacyFallback,
        logErrors: this.config.logTransformations
      });

      // Convert back to legacy format if requested
      if (returnLegacyFormat) {
        return this.convertToLegacyWidgetFormat(result.data);
      }

      return result.data;

    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn('[Compatibility] Widget processing failed, using fallback:', error);
        return returnLegacyFormat ? {} : null;
      }
      throw error;
    }
  }

  /**
   * Process table data with backward compatibility
   */
  public async processTableDataWithCompatibility(
    data: LegacyTableData | TableInputData,
    tableType: 'generic' | 'analytics' | 'conversion' = 'generic',
    returnLegacyFormat: boolean = false
  ): Promise<LegacyTableData | any> {
    try {
      // Determine if data is in legacy format
      const isLegacyFormat = this.isLegacyTableData(data);
      
      // Migrate to new format if needed
      const normalizedData = isLegacyFormat 
        ? this.migrateLegacyTableData(data as LegacyTableData)
        : data as TableInputData;

      // Process with new adapter system
      const result = await ComponentIntegration.table[tableType](normalizedData, {
        enableFallbackData: this.config.useLegacyFallback,
        logErrors: this.config.logTransformations
      });

      // Convert back to legacy format if requested
      if (returnLegacyFormat) {
        return this.convertToLegacyTableFormat(result.data);
      }

      return result.data;

    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn('[Compatibility] Table processing failed, using fallback:', error);
        return returnLegacyFormat ? { rows: [] } : null;
      }
      throw error;
    }
  }

  /**
   * Process metric card data with backward compatibility
   */
  public async processMetricCardDataWithCompatibility(
    data: LegacyMetricCardData | MetricCardInputData,
    returnLegacyFormat: boolean = false
  ): Promise<LegacyMetricCardData | any> {
    try {
      // Determine if data is in legacy format
      const isLegacyFormat = this.isLegacyMetricCardData(data);
      
      // Migrate to new format if needed
      const normalizedData = isLegacyFormat 
        ? this.migrateLegacyMetricCardData(data as LegacyMetricCardData)
        : data as MetricCardInputData;

      // Process with new adapter system
      const result = await ComponentIntegration.metric.card(normalizedData, undefined, {
        enableFallbackData: this.config.useLegacyFallback,
        logErrors: this.config.logTransformations
      });

      // Convert back to legacy format if requested
      if (returnLegacyFormat) {
        return this.convertToLegacyMetricCardFormat(result.data);
      }

      return result.data;

    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn('[Compatibility] Metric card processing failed, using fallback:', error);
        return returnLegacyFormat ? {} : null;
      }
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if data is in legacy chart format
   */
  private isLegacyChartData(data: any): boolean {
    return data && (
      (data.datasets && Array.isArray(data.datasets)) ||
      (data.data && !data.summary) ||
      (data.labels && Array.isArray(data.labels))
    );
  }

  /**
   * Check if data is in legacy widget format
   */
  private isLegacyWidgetData(data: any): boolean {
    return data && (
      typeof data.sessions === 'number' ||
      typeof data.pageviews === 'number' ||
      typeof data.bounceRate === 'number'
    ) && !data.data;
  }

  /**
   * Check if data is in legacy table format
   */
  private isLegacyTableData(data: any): boolean {
    return data && data.rows && Array.isArray(data.rows) && !data.data;
  }

  /**
   * Check if data is in legacy metric card format
   */
  private isLegacyMetricCardData(data: any): boolean {
    return data && (
      typeof data.value === 'number' ||
      typeof data.previousValue === 'number'
    ) && typeof data.current === 'undefined';
  }

  /**
   * Extract chart summary from data
   */
  private extractChartSummary(data: any[]): any {
    if (!Array.isArray(data) || data.length === 0) {
      return { total: 0, change: 0, trend: 'stable' };
    }

    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    const firstValue = data[0]?.value || 0;
    const lastValue = data[data.length - 1]?.value || 0;
    const change = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    return {
      total,
      change: Math.round(change * 100) / 100,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  }

  /**
   * Infer column type from legacy type
   */
  private inferColumnType(legacyType?: string): string {
    switch (legacyType?.toLowerCase()) {
      case 'number':
      case 'numeric':
      case 'int':
      case 'integer':
        return 'number';
      case 'percent':
      case 'percentage':
        return 'percentage';
      case 'currency':
      case 'money':
      case 'price':
        return 'currency';
      case 'date':
      case 'datetime':
      case 'timestamp':
        return 'date';
      case 'boolean':
      case 'bool':
        return 'boolean';
      default:
        return 'string';
    }
  }

  /**
   * Infer metric type from unit
   */
  private inferMetricType(unit?: string): string {
    if (!unit) return 'number';
    
    const unitLower = unit.toLowerCase();
    if (unitLower.includes('$') || unitLower.includes('currency')) return 'currency';
    if (unitLower.includes('%') || unitLower.includes('percent')) return 'percentage';
    if (unitLower.includes('time') || unitLower.includes('duration')) return 'duration';
    if (unitLower.includes('rate')) return 'rate';
    
    return 'number';
  }

  /**
   * Determine change type from change value
   */
  private determineChangeType(change?: number): 'increase' | 'decrease' | 'neutral' {
    if (!change || change === 0) return 'neutral';
    return change > 0 ? 'increase' : 'decrease';
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Convenience functions for backward compatibility
 */
export const BackwardCompatibility = {
  /**
   * Initialize compatibility manager
   */
  init: (config?: CompatibilityConfig) => BackwardCompatibilityManager.getInstance(config),

  /**
   * Process data with automatic format detection and compatibility
   */
  process: {
    chart: (data: any, chartType?: 'line' | 'bar' | 'donut', returnLegacyFormat?: boolean) =>
      BackwardCompatibilityManager.getInstance().processChartDataWithCompatibility(data, chartType, returnLegacyFormat),
    widget: (data: any, widgetType?: 'traffic-overview' | 'conversion' | 'traffic-source', returnLegacyFormat?: boolean) =>
      BackwardCompatibilityManager.getInstance().processWidgetDataWithCompatibility(data, widgetType, returnLegacyFormat),
    table: (data: any, tableType?: 'generic' | 'analytics' | 'conversion', returnLegacyFormat?: boolean) =>
      BackwardCompatibilityManager.getInstance().processTableDataWithCompatibility(data, tableType, returnLegacyFormat),
    metric: (data: any, returnLegacyFormat?: boolean) =>
      BackwardCompatibilityManager.getInstance().processMetricCardDataWithCompatibility(data, returnLegacyFormat)
  },

  /**
   * Migration utilities
   */
  migrate: {
    chart: (data: LegacyChartData) => BackwardCompatibilityManager.getInstance().migrateLegacyChartData(data),
    widget: (data: LegacyWidgetData) => BackwardCompatibilityManager.getInstance().migrateLegacyWidgetData(data),
    table: (data: LegacyTableData) => BackwardCompatibilityManager.getInstance().migrateLegacyTableData(data),
    metric: (data: LegacyMetricCardData) => BackwardCompatibilityManager.getInstance().migrateLegacyMetricCardData(data)
  },

  /**
   * Conversion utilities
   */
  convert: {
    toLegacy: {
      chart: (data: any[]) => BackwardCompatibilityManager.getInstance().convertToLegacyChartFormat(data),
      widget: (data: any) => BackwardCompatibilityManager.getInstance().convertToLegacyWidgetFormat(data),
      table: (data: any) => BackwardCompatibilityManager.getInstance().convertToLegacyTableFormat(data),
      metric: (data: any) => BackwardCompatibilityManager.getInstance().convertToLegacyMetricCardFormat(data)
    }
  }
};

/**
 * Default compatibility manager instance
 */
export const compatibilityManager = BackwardCompatibilityManager.getInstance();