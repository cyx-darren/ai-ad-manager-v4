/**
 * Chart Data Adapter
 * 
 * Specialized adapters for converting MCP responses to chart component data formats.
 * Supports LineChart, BarChart, and DonutChart components.
 */

import { BaseAdapter } from './BaseAdapter';
import { 
  TimeSeriesDataPoint, 
  BarChartDataPoint, 
  DonutChartDataPoint,
  MCPResponse,
  AdapterConfig,
  AdapterMetadata,
  ValidationResult
} from './types';
import { 
  normalizeDateString, 
  mapFields, 
  computeMetrics, 
  coerceToNumber,
  handleNullValue,
  calculatePercentages,
  validateTimeSeriesData,
  validateBarChartData,
  validateDonutChartData
} from './utils';

// ============================================================================
// CHART DATA TYPES
// ============================================================================

/**
 * Input data structure from MCP analytics responses
 */
export interface ChartInputData {
  data: Array<{
    date?: string;
    dimension?: string;
    value?: string | number;
    metric?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    cost?: string | number;
    [key: string]: any;
  }>;
  summary?: {
    total?: number;
    change?: number;
    trend?: 'up' | 'down' | 'stable';
  };
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Configuration for chart adapters
 */
export interface ChartAdapterConfig extends AdapterConfig {
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD-MM-YYYY';
  includeComputedMetrics?: boolean;
  maxDataPoints?: number;
  sortByDate?: boolean;
  fillMissingDates?: boolean;
  aggregateSmallValues?: boolean;
  aggregationThreshold?: number;
}

// ============================================================================
// LINE CHART ADAPTER
// ============================================================================

/**
 * Adapter for LineChart components - converts time series data
 */
export class LineChartAdapter extends BaseAdapter<ChartInputData, TimeSeriesDataPoint[]> {
  constructor(config: ChartAdapterConfig = {}) {
    super({
      ...config,
      maxDataPoints: config.maxDataPoints || 100,
      sortByDate: config.sortByDate !== false,
      fillMissingDates: config.fillMissingDates || false
    });
  }

  protected transformImplementation(input: ChartInputData): TimeSeriesDataPoint[] {
    if (!input.data || !Array.isArray(input.data)) {
      return this.getDefaultOutput();
    }

    const result: TimeSeriesDataPoint[] = input.data
      .map(item => {
        try {
          const date = normalizeDateString(item.date || '');
          const value = coerceToNumber(item.value || item.metric || 0);
          
          if (!date) {
            throw new Error('Invalid date');
          }

          return {
            date,
            value: handleNullValue(value, 0) as number,
            label: item.dimension || date,
            change: item.change ? coerceToNumber(item.change) as number : undefined,
            trend: item.trend as 'up' | 'down' | 'stable' | undefined
          };
        } catch (error) {
          return null;
        }
      })
      .filter((item): item is TimeSeriesDataPoint => item !== null);

    // Sort by date if enabled
    if ((this.config as ChartAdapterConfig).sortByDate) {
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // Limit data points if specified
    const maxPoints = (this.config as ChartAdapterConfig).maxDataPoints;
    if (maxPoints && result.length > maxPoints) {
      return result.slice(0, maxPoints);
    }

    return result;
  }

  public validate(input: ChartInputData): boolean {
    return validateTimeSeriesData(input.data || []);
  }

  public getDefaultOutput(): TimeSeriesDataPoint[] {
    return [];
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'LineChartAdapter',
      version: '1.0.0',
      inputType: 'ChartInputData',
      outputType: 'TimeSeriesDataPoint[]',
      description: 'Converts MCP analytics data to line chart format',
      supportsTimeRange: true,
      supportsAggregation: false
    };
  }
}

// ============================================================================
// BAR CHART ADAPTER
// ============================================================================

/**
 * Adapter for BarChart components - converts categorical data
 */
export class BarChartAdapter extends BaseAdapter<ChartInputData, BarChartDataPoint[]> {
  constructor(config: ChartAdapterConfig = {}) {
    super({
      ...config,
      aggregateSmallValues: config.aggregateSmallValues || false,
      aggregationThreshold: config.aggregationThreshold || 0.05
    });
  }

  protected transformImplementation(input: ChartInputData): BarChartDataPoint[] {
    if (!input.data || !Array.isArray(input.data)) {
      return this.getDefaultOutput();
    }

    const result: BarChartDataPoint[] = input.data
      .map(item => {
        try {
          const label = item.dimension || item.label || 'Unknown';
          const value = coerceToNumber(item.value || item.metric || 0);
          
          return {
            label,
            value: handleNullValue(value, 0) as number,
            color: item.color,
            change: item.change ? coerceToNumber(item.change) as number : undefined,
            percentage: item.percentage ? coerceToNumber(item.percentage) as number : undefined
          };
        } catch (error) {
          return null;
        }
      })
      .filter((item): item is BarChartDataPoint => item !== null);

    // Calculate percentages if not provided
    const totalValue = result.reduce((sum, item) => sum + item.value, 0);
    if (totalValue > 0) {
      result.forEach(item => {
        if (item.percentage === undefined) {
          item.percentage = (item.value / totalValue) * 100;
        }
      });
    }

    // Aggregate small values if enabled
    const config = this.config as ChartAdapterConfig;
    if (config.aggregateSmallValues && config.aggregationThreshold) {
      return this.aggregateSmallValues(result, config.aggregationThreshold);
    }

    return result;
  }

  private aggregateSmallValues(data: BarChartDataPoint[], threshold: number): BarChartDataPoint[] {
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    const minValue = totalValue * threshold;
    
    const largeItems = data.filter(item => item.value >= minValue);
    const smallItems = data.filter(item => item.value < minValue);
    
    if (smallItems.length === 0) {
      return largeItems;
    }
    
    const aggregatedValue = smallItems.reduce((sum, item) => sum + item.value, 0);
    const aggregatedItem: BarChartDataPoint = {
      label: `Other (${smallItems.length})`,
      value: aggregatedValue,
      percentage: (aggregatedValue / totalValue) * 100,
      color: '#9CA3AF'
    };
    
    return [...largeItems, aggregatedItem];
  }

  public validate(input: ChartInputData): boolean {
    return validateBarChartData(input.data || []);
  }

  public getDefaultOutput(): BarChartDataPoint[] {
    return [];
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'BarChartAdapter',
      version: '1.0.0',
      inputType: 'ChartInputData',
      outputType: 'BarChartDataPoint[]',
      description: 'Converts MCP analytics data to bar chart format',
      supportsTimeRange: false,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// DONUT CHART ADAPTER
// ============================================================================

/**
 * Adapter for DonutChart components - converts categorical data with emphasis on percentages
 */
export class DonutChartAdapter extends BaseAdapter<ChartInputData, DonutChartDataPoint[]> {
  constructor(config: ChartAdapterConfig = {}) {
    super({
      ...config,
      aggregateSmallValues: config.aggregateSmallValues !== false,
      aggregationThreshold: config.aggregationThreshold || 0.03
    });
  }

  protected transformImplementation(input: ChartInputData): DonutChartDataPoint[] {
    if (!input.data || !Array.isArray(input.data)) {
      return this.getDefaultOutput();
    }

    const result: DonutChartDataPoint[] = input.data
      .map(item => {
        try {
          const label = item.dimension || item.label || 'Unknown';
          const value = coerceToNumber(item.value || item.metric || 0);
          
          return {
            label,
            value: handleNullValue(value, 0) as number,
            color: item.color,
            percentage: item.percentage ? coerceToNumber(item.percentage) as number : undefined
          };
        } catch (error) {
          return null;
        }
      })
      .filter((item): item is DonutChartDataPoint => item !== null);

    // Calculate percentages
    const totalValue = result.reduce((sum, item) => sum + item.value, 0);
    if (totalValue > 0) {
      result.forEach(item => {
        item.percentage = (item.value / totalValue) * 100;
      });
    }

    // Aggregate small values for better visualization
    const config = this.config as ChartAdapterConfig;
    if (config.aggregateSmallValues && config.aggregationThreshold) {
      return this.aggregateSmallValues(result, config.aggregationThreshold);
    }

    return result.sort((a, b) => b.value - a.value); // Sort by value descending
  }

  private aggregateSmallValues(data: DonutChartDataPoint[], threshold: number): DonutChartDataPoint[] {
    const largeItems = data.filter(item => (item.percentage || 0) >= threshold * 100);
    const smallItems = data.filter(item => (item.percentage || 0) < threshold * 100);
    
    if (smallItems.length === 0) {
      return largeItems;
    }
    
    const aggregatedValue = smallItems.reduce((sum, item) => sum + item.value, 0);
    const aggregatedPercentage = smallItems.reduce((sum, item) => sum + (item.percentage || 0), 0);
    
    const aggregatedItem: DonutChartDataPoint = {
      label: `Other (${smallItems.length})`,
      value: aggregatedValue,
      percentage: aggregatedPercentage,
      color: '#9CA3AF'
    };
    
    return [...largeItems, aggregatedItem];
  }

  public validate(input: ChartInputData): boolean {
    return validateDonutChartData(input.data || []);
  }

  public getDefaultOutput(): DonutChartDataPoint[] {
    return [];
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'DonutChartAdapter',
      version: '1.0.0',
      inputType: 'ChartInputData',
      outputType: 'DonutChartDataPoint[]',
      description: 'Converts MCP analytics data to donut chart format',
      supportsTimeRange: false,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// CHART ADAPTER FACTORY HELPERS
// ============================================================================

/**
 * Create a line chart adapter with common configuration
 */
export function createLineChartAdapter(config?: ChartAdapterConfig): LineChartAdapter {
  return new LineChartAdapter(config);
}

/**
 * Create a bar chart adapter with common configuration
 */
export function createBarChartAdapter(config?: ChartAdapterConfig): BarChartAdapter {
  return new BarChartAdapter(config);
}

/**
 * Create a donut chart adapter with common configuration
 */
export function createDonutChartAdapter(config?: ChartAdapterConfig): DonutChartAdapter {
  return new DonutChartAdapter(config);
}

/**
 * Chart adapter type for factory registration
 */
export type ChartAdapterType = 'line' | 'bar' | 'donut';

/**
 * Factory function for creating chart adapters by type
 */
export function createChartAdapter(
  type: ChartAdapterType, 
  config?: ChartAdapterConfig
): LineChartAdapter | BarChartAdapter | DonutChartAdapter {
  switch (type) {
    case 'line':
      return createLineChartAdapter(config);
    case 'bar':
      return createBarChartAdapter(config);
    case 'donut':
      return createDonutChartAdapter(config);
    default:
      throw new Error(`Unknown chart adapter type: ${type}`);
  }
}