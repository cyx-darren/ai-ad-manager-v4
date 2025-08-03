/**
 * Core MCP Data Adapter Types
 * 
 * This file defines the foundational types and interfaces for the MCP data adapter system.
 * These types ensure type safety and consistency across all adapters.
 */

// ============================================================================
// BASE ADAPTER INTERFACES
// ============================================================================

/**
 * Base adapter interface that all adapters must implement
 */
export interface BaseAdapter<TInput, TOutput> {
  /**
   * Transform input data to output format
   */
  transform(input: TInput): TOutput;
  
  /**
   * Validate that input data is in expected format
   */
  validate(input: TInput): boolean;
  
  /**
   * Get default/fallback output when input is invalid
   */
  getDefaultOutput(): TOutput;
  
  /**
   * Handle errors gracefully and return fallback output
   */
  handleError(error: Error): TOutput;
  
  /**
   * Get adapter metadata
   */
  getMetadata(): AdapterMetadata;
}

/**
 * Adapter metadata for debugging and monitoring
 */
export interface AdapterMetadata {
  name: string;
  version: string;
  inputType: string;
  outputType: string;
  description: string;
}

/**
 * Adapter configuration options
 */
export interface AdapterConfig {
  enableValidation?: boolean;
  enableErrorLogging?: boolean;
  fallbackToDefault?: boolean;
  debugMode?: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result with details
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Data validation function type
 */
export type DataValidator<T> = (data: T) => ValidationResult;

// ============================================================================
// TRANSFORMATION UTILITY TYPES
// ============================================================================

/**
 * Field mapping configuration for transforming field names
 */
export interface FieldMapping {
  [sourceField: string]: string; // source -> target field name
}

/**
 * Date format configuration
 */
export interface DateFormatConfig {
  inputFormat?: string;
  outputFormat?: string;
  timezone?: string;
}

/**
 * Metric computation configuration
 */
export interface MetricComputationConfig {
  enableCTR?: boolean;      // Click-through rate
  enableCPC?: boolean;      // Cost per click
  enableROAS?: boolean;     // Return on ad spend
  enableCPM?: boolean;      // Cost per mille
  enableCVR?: boolean;      // Conversion rate
  averageOrderValue?: number; // For ROAS calculation
}

/**
 * Number formatting configuration
 */
export interface NumberFormatConfig {
  locale?: string;
  currency?: string;
  decimalPlaces?: number;
  useGrouping?: boolean;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Adapter error with context
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public adapterName: string,
    public inputData?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * Error handling strategy
 */
export type ErrorStrategy = 'throw' | 'return-default' | 'return-null' | 'log-and-continue';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  strategy: ErrorStrategy;
  logErrors?: boolean;
  onError?: (error: AdapterError) => void;
}

// ============================================================================
// FACTORY PATTERN TYPES
// ============================================================================

/**
 * Adapter factory interface
 */
export interface AdapterFactory {
  /**
   * Create an adapter instance
   */
  createAdapter<TInput, TOutput>(
    type: AdapterType,
    config?: AdapterConfig
  ): BaseAdapter<TInput, TOutput>;
  
  /**
   * Register a new adapter type
   */
  registerAdapter<TInput, TOutput>(
    type: AdapterType,
    adapterClass: new (config?: AdapterConfig) => BaseAdapter<TInput, TOutput>
  ): void;
  
  /**
   * Get list of available adapter types
   */
  getAvailableTypes(): AdapterType[];
}

/**
 * Supported adapter types
 */
export type AdapterType = 
  | 'chart-line'
  | 'chart-bar' 
  | 'chart-donut'
  | 'widget-traffic'
  | 'widget-conversion'
  | 'widget-performance'
  | 'table-generic'
  | 'metric-card'
  | 'error-handler'
  | 'loading-state';

// ============================================================================
// COMPONENT-SPECIFIC INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Common MCP response wrapper
 */
export interface MCPResponse<T = any> {
  data: T;
  isLoading: boolean;
  error?: Error;
  lastUpdated: number;
  cache?: {
    isFromCache: boolean;
    cacheAge: number;
  };
  meta?: {
    totalRows: number;
    samplingLevel: string;
    isDataGolden: boolean;
  };
}

/**
 * Time series data point (component format)
 */
export interface TimeSeriesDataPoint {
  date: string;
  sessions?: number;
  users?: number;
  pageviews?: number;
  clicks?: number;
  impressions?: number;
  cost?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
}

/**
 * Bar chart data point (component format)
 */
export interface BarChartDataPoint {
  name: string;
  sessions?: number;
  users?: number;
  clicks?: number;
  impressions?: number;
  cost?: number;
  conversions?: number;
  revenue?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
  conversionRate?: number;
}

/**
 * Donut chart data point (component format)
 */
export interface DonutChartDataPoint {
  name: string;
  value: number;
  percentage?: number;
}

/**
 * Metric card props (component format)
 */
export interface MetricCardData {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    timeframe?: string;
  };
  icon?: string;
  description?: string;
  loading?: boolean;
  error?: string;
}

/**
 * Table row (component format)
 */
export interface TableRow {
  [key: string]: any;
}

/**
 * Table column configuration (component format)
 */
export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'badge';
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

// ============================================================================
// UTILITY FUNCTION TYPES
// ============================================================================

/**
 * Date normalization function type
 */
export type DateNormalizer = (date: string | Date, config?: DateFormatConfig) => string;

/**
 * Metric computation function type
 */
export type MetricComputer = (data: any, config?: MetricComputationConfig) => Record<string, number>;

/**
 * Field mapper function type
 */
export type FieldMapper = (data: any, mapping: FieldMapping) => any;

/**
 * Type coercion function type
 */
export type TypeCoercer = (value: any, targetType: 'string' | 'number' | 'boolean' | 'date') => any;

/**
 * Null handler function type
 */
export type NullHandler = (value: any, defaultValue?: any) => any;

/**
 * Percentage calculator function type
 */
export type PercentageCalculator = (values: number[], config?: { precision?: number }) => number[];

// ============================================================================
// ADAPTER REGISTRY TYPES
// ============================================================================

/**
 * Adapter registration entry
 */
export interface AdapterRegistration<TInput = any, TOutput = any> {
  type: AdapterType;
  adapterClass: new (config?: AdapterConfig) => BaseAdapter<TInput, TOutput>;
  metadata: AdapterMetadata;
}

/**
 * Adapter registry interface
 */
export interface AdapterRegistry {
  register<TInput, TOutput>(registration: AdapterRegistration<TInput, TOutput>): void;
  get<TInput, TOutput>(type: AdapterType): AdapterRegistration<TInput, TOutput> | undefined;
  getAll(): AdapterRegistration[];
  clear(): void;
}

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

/**
 * Adapter performance metrics
 */
export interface AdapterPerformanceMetrics {
  transformationCount: number;
  averageTransformationTime: number;
  totalTransformationTime: number;
  errorCount: number;
  successRate: number;
  lastTransformationTime: number;
}

/**
 * Performance monitor interface
 */
export interface PerformanceMonitor {
  startTiming(adapterId: string): void;
  endTiming(adapterId: string, success: boolean): void;
  getMetrics(adapterId: string): AdapterPerformanceMetrics;
  getAllMetrics(): Record<string, AdapterPerformanceMetrics>;
  reset(adapterId?: string): void;
}

// ============================================================================
// REACT INTEGRATION TYPES
// ============================================================================

/**
 * React component props that expect adapted data
 */
export interface AdaptedComponentProps<T> {
  data?: T;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  fallbackData?: T;
}

/**
 * Hook for using adapters in React components
 */
export interface UseAdapterHook<TInput, TOutput> {
  (input: TInput | undefined, adapterType: AdapterType, config?: AdapterConfig): {
    data: TOutput | undefined;
    isTransforming: boolean;
    error: Error | undefined;
    retransform: () => void;
  };
}