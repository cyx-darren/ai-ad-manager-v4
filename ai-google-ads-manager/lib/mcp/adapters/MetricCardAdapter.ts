/**
 * Metric Card Adapter
 * 
 * Specialized adapter for converting MCP responses to metric card component data formats.
 * Supports change calculations, trend analysis, and various metric types.
 */

import { BaseAdapter } from './BaseAdapter';
import { 
  MetricCardData,
  AdapterConfig,
  AdapterMetadata
} from './types';
import { 
  coerceToNumber,
  coerceToString,
  handleNullValue,
  formatCurrency,
  formatPercentage,
  formatNumber
} from './utils';

// ============================================================================
// METRIC CARD DATA TYPES
// ============================================================================

/**
 * Input data structure for metric cards
 */
export interface MetricCardInputData {
  current: number | string;
  previous?: number | string;
  title: string;
  subtitle?: string;
  unit?: string;
  type?: MetricType;
  target?: number;
  trend?: 'up' | 'down' | 'stable';
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Metric type for formatting
 */
export type MetricType = 'number' | 'currency' | 'percentage' | 'duration' | 'rate';

/**
 * Change calculation result
 */
export interface ChangeCalculation {
  absolute: number;
  percentage: number;
  direction: 'increase' | 'decrease' | 'no-change';
  trend: 'up' | 'down' | 'stable';
  isPositive: boolean;
}

/**
 * Configuration for metric card adapter
 */
export interface MetricCardAdapterConfig extends AdapterConfig {
  defaultMetricType?: MetricType;
  showPercentageChange?: boolean;
  showAbsoluteChange?: boolean;
  currencySymbol?: string;
  locale?: string;
  precision?: number;
  zeroThreshold?: number; // Threshold for considering changes as "no change"
}

// ============================================================================
// METRIC CARD ADAPTER
// ============================================================================

/**
 * Main metric card adapter
 */
export class MetricCardAdapter extends BaseAdapter<MetricCardInputData, MetricCardData> {
  
  constructor(config: MetricCardAdapterConfig = {}) {
    super({
      defaultMetricType: 'number',
      showPercentageChange: true,
      showAbsoluteChange: false,
      currencySymbol: '$',
      locale: 'en-US',
      precision: 2,
      zeroThreshold: 0.01,
      ...config
    });
  }

  protected transformImplementation(input: MetricCardInputData): MetricCardData {
    const config = this.config as MetricCardAdapterConfig;
    
    // Extract and validate current value
    const currentValue = this.extractNumericValue(input.current);
    const previousValue = input.previous ? this.extractNumericValue(input.previous) : null;
    
    // Calculate change if previous value is available
    const change = previousValue !== null ? this.calculateChange(currentValue, previousValue, config) : null;
    
    // Format the display value based on metric type
    const metricType = input.type || config.defaultMetricType || 'number';
    const formattedValue = this.formatValue(currentValue, metricType, config);
    
    // Determine status based on target and trend
    const status = this.determineStatus(currentValue, input.target, change, input.trend);
    
    return {
      title: input.title,
      subtitle: input.subtitle,
      value: formattedValue,
      rawValue: currentValue,
      change: change ? {
        value: change.absolute,
        percentage: change.percentage,
        direction: change.direction,
        trend: change.trend,
        isPositive: change.isPositive,
        formatted: this.formatChangeValue(change, metricType, config)
      } : undefined,
      status,
      unit: input.unit,
      type: metricType,
      target: input.target ? {
        value: input.target,
        progress: input.target > 0 ? (currentValue / input.target) * 100 : 0,
        isAchieved: currentValue >= input.target
      } : undefined,
      metadata: input.metadata
    };
  }

  private extractNumericValue(value: number | string): number {
    const numericValue = coerceToNumber(value);
    return handleNullValue(numericValue, 0) as number;
  }

  private calculateChange(current: number, previous: number, config: MetricCardAdapterConfig): ChangeCalculation {
    const absolute = current - previous;
    const percentage = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : 0;
    
    // Apply zero threshold
    const zeroThreshold = config.zeroThreshold || 0.01;
    const isSignificantChange = Math.abs(percentage) >= zeroThreshold;
    
    let direction: 'increase' | 'decrease' | 'no-change';
    let trend: 'up' | 'down' | 'stable';
    
    if (!isSignificantChange) {
      direction = 'no-change';
      trend = 'stable';
    } else if (absolute > 0) {
      direction = 'increase';
      trend = 'up';
    } else {
      direction = 'decrease';
      trend = 'down';
    }
    
    // Determine if change is positive (depends on context)
    const isPositive = this.isChangePositive(direction, trend);
    
    return {
      absolute,
      percentage,
      direction,
      trend,
      isPositive
    };
  }

  private isChangePositive(direction: 'increase' | 'decrease' | 'no-change', trend: 'up' | 'down' | 'stable'): boolean {
    // For most metrics, increase is positive
    // This can be overridden for specific metrics like bounce rate, error rate, etc.
    return direction === 'increase' || trend === 'up';
  }

  private formatValue(value: number, type: MetricType, config: MetricCardAdapterConfig): string {
    const precision = config.precision || 2;
    const locale = config.locale || 'en-US';
    
    try {
      switch (type) {
        case 'currency':
          return formatCurrency(value, {
            currency: 'USD',
            locale,
            minimumFractionDigits: 0,
            maximumFractionDigits: precision
          });
          
        case 'percentage':
          return formatPercentage(value, {
            locale,
            minimumFractionDigits: 0,
            maximumFractionDigits: precision
          });
          
        case 'duration':
          return this.formatDuration(value);
          
        case 'rate':
          return `${formatNumber(value, { locale, maximumFractionDigits: precision })}/s`;
          
        default: // number
          return formatNumber(value, {
            locale,
            minimumFractionDigits: 0,
            maximumFractionDigits: precision
          });
      }
    } catch (error) {
      return value.toString();
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  private formatChangeValue(change: ChangeCalculation, type: MetricType, config: MetricCardAdapterConfig): string {
    const showPercentage = config.showPercentageChange !== false;
    const showAbsolute = config.showAbsoluteChange === true;
    
    if (change.direction === 'no-change') {
      return '0%';
    }
    
    const sign = change.absolute >= 0 ? '+' : '';
    const percentageStr = `${sign}${change.percentage.toFixed(1)}%`;
    
    if (showAbsolute && !showPercentage) {
      const absoluteStr = this.formatValue(Math.abs(change.absolute), type, config);
      return `${sign}${absoluteStr}`;
    } else if (showAbsolute && showPercentage) {
      const absoluteStr = this.formatValue(Math.abs(change.absolute), type, config);
      return `${percentageStr} (${sign}${absoluteStr})`;
    } else {
      return percentageStr;
    }
  }

  private determineStatus(
    current: number, 
    target?: number, 
    change?: ChangeCalculation | null,
    trendHint?: 'up' | 'down' | 'stable'
  ): 'success' | 'warning' | 'error' | 'neutral' {
    // If target is provided, use target-based status
    if (target !== undefined) {
      const progress = target > 0 ? (current / target) : 0;
      if (progress >= 1) return 'success';
      if (progress >= 0.8) return 'warning';
      if (progress < 0.5) return 'error';
      return 'neutral';
    }
    
    // If change is available, use change-based status
    if (change) {
      if (change.direction === 'no-change') return 'neutral';
      if (change.isPositive) return 'success';
      if (Math.abs(change.percentage) > 20) return 'error';
      return 'warning';
    }
    
    // Fall back to trend hint or neutral
    if (trendHint) {
      switch (trendHint) {
        case 'up': return 'success';
        case 'down': return 'error';
        default: return 'neutral';
      }
    }
    
    return 'neutral';
  }

  public validate(input: MetricCardInputData): boolean {
    return input && 
           input.title && 
           (input.current !== undefined && input.current !== null);
  }

  public getDefaultOutput(): MetricCardData {
    return {
      title: 'Unknown Metric',
      value: '0',
      rawValue: 0,
      status: 'neutral',
      type: 'number'
    };
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'MetricCardAdapter',
      version: '1.0.0',
      inputType: 'MetricCardInputData',
      outputType: 'MetricCardData',
      description: 'Converts MCP metric data to metric card format with change calculations',
      supportsTimeRange: false,
      supportsAggregation: false
    };
  }
}

// ============================================================================
// SPECIALIZED METRIC CARD ADAPTERS
// ============================================================================

/**
 * Bounce rate metric adapter - treats increases as negative
 */
export class BounceRateMetricAdapter extends MetricCardAdapter {
  protected isChangePositive(direction: 'increase' | 'decrease' | 'no-change', trend: 'up' | 'down' | 'stable'): boolean {
    // For bounce rate, decrease is positive (lower bounce rate is better)
    return direction === 'decrease' || trend === 'down';
  }
}

/**
 * Conversion rate metric adapter with specific formatting
 */
export class ConversionRateMetricAdapter extends MetricCardAdapter {
  constructor(config: MetricCardAdapterConfig = {}) {
    super({
      ...config,
      defaultMetricType: 'percentage'
    });
  }
}

/**
 * Revenue metric adapter with currency formatting
 */
export class RevenueMetricAdapter extends MetricCardAdapter {
  constructor(config: MetricCardAdapterConfig = {}) {
    super({
      ...config,
      defaultMetricType: 'currency',
      precision: 0
    });
  }
}

/**
 * Duration metric adapter (for session duration, page load time, etc.)
 */
export class DurationMetricAdapter extends MetricCardAdapter {
  constructor(config: MetricCardAdapterConfig = {}) {
    super({
      ...config,
      defaultMetricType: 'duration'
    });
  }
}

// ============================================================================
// METRIC CARD FACTORY HELPERS
// ============================================================================

/**
 * Metric card adapter type for factory registration
 */
export type MetricCardAdapterType = 'generic' | 'bounce-rate' | 'conversion-rate' | 'revenue' | 'duration';

/**
 * Factory function for creating metric card adapters by type
 */
export function createMetricCardAdapter(
  type: MetricCardAdapterType, 
  config?: MetricCardAdapterConfig
): MetricCardAdapter | BounceRateMetricAdapter | ConversionRateMetricAdapter | RevenueMetricAdapter | DurationMetricAdapter {
  switch (type) {
    case 'generic':
      return new MetricCardAdapter(config);
    case 'bounce-rate':
      return new BounceRateMetricAdapter(config);
    case 'conversion-rate':
      return new ConversionRateMetricAdapter(config);
    case 'revenue':
      return new RevenueMetricAdapter(config);
    case 'duration':
      return new DurationMetricAdapter(config);
    default:
      throw new Error(`Unknown metric card adapter type: ${type}`);
  }
}

/**
 * Batch process multiple metrics
 */
export function processMetricsBatch(
  metrics: Array<{data: MetricCardInputData; type?: MetricCardAdapterType}>,
  config?: MetricCardAdapterConfig
): MetricCardData[] {
  return metrics.map(metric => {
    const adapter = createMetricCardAdapter(metric.type || 'generic', config);
    return adapter.transform(metric.data);
  });
}