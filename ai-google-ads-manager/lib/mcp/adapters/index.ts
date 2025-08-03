/**
 * MCP Data Adapter Framework - Main Export
 * 
 * This file provides the main entry point for the MCP data adapter system,
 * exporting all core components, types, and utilities.
 */

// ============================================================================
// CORE TYPES AND INTERFACES
// ============================================================================

export type {
  // Base interfaces
  BaseAdapter as IBaseAdapter,
  AdapterMetadata,
  AdapterConfig,
  ValidationResult,
  DataValidator,
  
  // Factory types
  AdapterFactory as IAdapterFactory,
  AdapterType,
  AdapterRegistration,
  AdapterRegistry as IAdapterRegistry,
  
  // Utility types
  FieldMapping,
  DateFormatConfig,
  MetricComputationConfig,
  NumberFormatConfig,
  DateNormalizer,
  MetricComputer,
  FieldMapper,
  TypeCoercer,
  NullHandler,
  PercentageCalculator,
  
  // Error handling types
  ErrorStrategy,
  ErrorHandlerConfig,
  
  // Component data types
  MCPResponse,
  TimeSeriesDataPoint,
  BarChartDataPoint,
  DonutChartDataPoint,
  MetricCardData,
  TableRow,
  TableColumn,
  
  // Performance monitoring
  AdapterPerformanceMetrics,
  PerformanceMonitor,
  
  // React integration
  AdaptedComponentProps,
  UseAdapterHook
} from './types';

// ============================================================================
// CORE CLASSES
// ============================================================================

export { BaseAdapter } from './BaseAdapter';
export { AdapterFactory, defaultAdapterFactory } from './AdapterFactory';
export { 
  AdapterErrorHandler,
  EnhancedAdapterError,
  ConsoleErrorLogger,
  ErrorRecoveryManager,
  ErrorSeverity,
  ErrorCategory,
  defaultErrorHandler
} from './ErrorHandler';

// ============================================================================
// ERROR CLASSES
// ============================================================================

export { AdapterError } from './types';

// ============================================================================
// COMPONENT-SPECIFIC ADAPTERS (PHASE 3)
// ============================================================================

// Chart Adapters
export { 
  LineChartAdapter,
  BarChartAdapter,
  DonutChartAdapter,
  createLineChartAdapter,
  createBarChartAdapter,
  createDonutChartAdapter,
  createChartAdapter
} from './ChartDataAdapter';
export type { ChartInputData, ChartAdapterConfig, ChartAdapterType } from './ChartDataAdapter';

// Widget Adapters
export {
  TrafficOverviewAdapter,
  ConversionAdapter,
  TrafficSourceAdapter,
  createWidgetAdapter
} from './WidgetDataAdapter';
export type { 
  TrafficOverviewData,
  ConversionData,
  TrafficSourceData,
  PerformanceMetricsData,
  WidgetInputData,
  WidgetAdapterType
} from './WidgetDataAdapter';

// Table Adapters
export {
  TableDataAdapter,
  AnalyticsTableAdapter,
  ConversionTableAdapter,
  createTableAdapter
} from './TableDataAdapter';
export type { 
  TableInputData,
  TableOutputData,
  TableAdapterConfig,
  ColumnDataType,
  ColumnFormatter,
  TableAdapterType
} from './TableDataAdapter';

// Metric Card Adapters
export {
  MetricCardAdapter,
  BounceRateMetricAdapter,
  ConversionRateMetricAdapter,
  RevenueMetricAdapter,
  DurationMetricAdapter,
  createMetricCardAdapter,
  processMetricsBatch
} from './MetricCardAdapter';
export type { 
  MetricCardInputData,
  MetricType,
  ChangeCalculation,
  MetricCardAdapterConfig,
  MetricCardAdapterType
} from './MetricCardAdapter';

// ============================================================================
// PHASE 4: VALIDATION & SANITIZATION (NEW)
// ============================================================================

// Validation System
export {
  ValidationEngine,
  ValidationUtils,
  validator,
  CHART_INPUT_SCHEMA,
  WIDGET_INPUT_SCHEMA,
  TABLE_INPUT_SCHEMA,
  METRIC_CARD_INPUT_SCHEMA,
  SECURITY_STRING_SCHEMA,
  SECURITY_NUMBER_SCHEMA
} from './ValidationSchemas';
export type {
  ValidationSchema,
  ValidationContext,
  ValidationError,
  ValidationErrorCode
} from './ValidationSchemas';

// Sanitization System
export {
  DataSanitizer,
  ChartDataSanitizer,
  WidgetDataSanitizer,
  TableDataSanitizer,
  MetricCardSanitizer,
  SanitizationUtils,
  sanitizer,
  SANITIZATION_CONFIGS
} from './DataSanitizer';
export type {
  SanitizationConfig,
  SanitizationResult
} from './DataSanitizer';

// Updated Base Adapter with Phase 4 features
export type { ExtendedAdapterConfig } from './BaseAdapter';

// ============================================================================
// PHASE 5: INTEGRATION & TESTING (NEW)
// ============================================================================

// Component Integration System
export {
  ComponentIntegrationManager,
  ComponentIntegration,
  integrationManager
} from './ComponentIntegration';
export type {
  ComponentIntegrationConfig,
  IntegrationResult,
  IntegrationMetrics
} from './ComponentIntegration';

// Comprehensive Testing System
export {
  AdapterTestingEngine,
  TestDataGenerator,
  AdapterTesting,
  testingEngine,
  ErrorTestType
} from './AdapterTesting';
export type {
  TestConfig,
  TestResult,
  TestSuiteResult,
  PerformanceTestResult
} from './AdapterTesting';

// Backward Compatibility System
export {
  BackwardCompatibilityManager,
  BackwardCompatibility,
  compatibilityManager
} from './BackwardCompatibility';
export type {
  CompatibilityConfig,
  LegacyChartData,
  LegacyWidgetData,
  LegacyTableData,
  LegacyMetricCardData
} from './BackwardCompatibility';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  // Date utilities
  normalizeDateString,
  parseDateRange,
  
  // Metric computation
  computeMetrics,
  calculatePercentageChange,
  
  // Field mapping
  mapFields,
  GA4_TO_COMPONENT_MAPPING,
  
  // Type coercion
  coerceType,
  safeNumber,
  cleanObject,
  
  // Null handling
  handleNullValue,
  
  // Percentage calculations
  calculatePercentages,
  
  // Formatting
  formatNumber,
  formatPercentage,
  
  // Validation
  validateRequiredFields,
  validateArrayData
} from './utils';

// ============================================================================
// FACTORY CONVENIENCE FUNCTIONS
// ============================================================================

export {
  registerAdapter,
  createAdapter,
  getAdapter,
  getAvailableAdapterTypes,
  isAdapterAvailable,
  registerAdapters,
  createAdapters
} from './AdapterFactory';

// ============================================================================
// ERROR HANDLING CONVENIENCE FUNCTIONS
// ============================================================================

export {
  handleAdapterError,
  createAdapterErrorHandler
} from './ErrorHandler';

// ============================================================================
// HELPER FUNCTIONS FOR COMMON ADAPTER PATTERNS
// ============================================================================

/**
 * Quick helper to create a simple data transformation adapter
 */
export function createSimpleAdapter<TInput, TOutput>(
  name: string,
  transformFn: (input: TInput) => TOutput,
  validateFn?: (input: TInput) => boolean,
  defaultOutput?: TOutput
) {
  class SimpleAdapter extends BaseAdapter<TInput, TOutput> {
    protected performTransformation(input: TInput): TOutput {
      return transformFn(input);
    }

    protected validateInput(input: TInput): boolean {
      return validateFn ? validateFn(input) : true;
    }

    public getDefaultOutput(): TOutput {
      return defaultOutput || ({} as TOutput);
    }

    public getMetadata(): AdapterMetadata {
      return {
        name,
        version: '1.0.0',
        inputType: 'TInput',
        outputType: 'TOutput',
        description: `Simple adapter: ${name}`
      };
    }
  }

  return SimpleAdapter;
}

/**
 * Create an adapter that safely transforms arrays of data
 */
export function createArrayAdapter<TInputItem, TOutputItem>(
  name: string,
  itemTransformFn: (item: TInputItem, index: number) => TOutputItem,
  validateItemFn?: (item: TInputItem) => boolean
) {
  class ArrayAdapter extends BaseAdapter<TInputItem[], TOutputItem[]> {
    protected performTransformation(input: TInputItem[]): TOutputItem[] {
      return input
        .filter((item, index) => {
          if (validateItemFn) {
            return validateItemFn(item);
          }
          return true;
        })
        .map((item, index) => itemTransformFn(item, index));
    }

    protected validateInput(input: TInputItem[]): boolean {
      return Array.isArray(input);
    }

    public getDefaultOutput(): TOutputItem[] {
      return [];
    }

    public getMetadata(): AdapterMetadata {
      return {
        name,
        version: '1.0.0',
        inputType: 'TInputItem[]',
        outputType: 'TOutputItem[]',
        description: `Array adapter: ${name}`
      };
    }
  }

  return ArrayAdapter;
}

/**
 * Create an adapter that handles MCP response wrappers
 */
export function createMCPResponseAdapter<TData, TOutput>(
  name: string,
  dataTransformFn: (data: TData) => TOutput,
  validateDataFn?: (data: TData) => boolean
) {
  class MCPResponseAdapter extends BaseAdapter<MCPResponse<TData>, TOutput> {
    protected performTransformation(input: MCPResponse<TData>): TOutput {
      if (input.error) {
        throw new AdapterError(`MCP response contains error: ${input.error.message}`, name);
      }

      if (input.isLoading) {
        throw new AdapterError('MCP response is still loading', name);
      }

      return dataTransformFn(input.data);
    }

    protected validateInput(input: MCPResponse<TData>): boolean {
      if (!input || typeof input !== 'object') {
        return false;
      }

      if (input.error || input.isLoading) {
        return false;
      }

      if (validateDataFn && input.data) {
        return validateDataFn(input.data);
      }

      return input.data !== null && input.data !== undefined;
    }

    public getDefaultOutput(): TOutput {
      return {} as TOutput;
    }

    public getMetadata(): AdapterMetadata {
      return {
        name,
        version: '1.0.0',
        inputType: 'MCPResponse<TData>',
        outputType: 'TOutput',
        description: `MCP response adapter: ${name}`
      };
    }
  }

  return MCPResponseAdapter;
}

// ============================================================================
// COMMON FIELD MAPPINGS
// ============================================================================

/**
 * Pre-configured field mappings for common transformations
 */
export const COMMON_FIELD_MAPPINGS = {
  GA4_TO_COMPONENT: GA4_TO_COMPONENT_MAPPING,
  
  // Google Ads to component mapping
  GOOGLE_ADS_TO_COMPONENT: {
    'campaign.name': 'campaignName',
    'adGroup.name': 'adGroupName',
    'ad.finalUrls': 'finalUrls',
    'metrics.clicks': 'clicks',
    'metrics.impressions': 'impressions',
    'metrics.cost_micros': 'cost',
    'metrics.conversions': 'conversions',
    'metrics.ctr': 'ctr',
    'metrics.averageCpc': 'cpc',
    'metrics.costPerConversion': 'costPerConversion'
  } as FieldMapping,
  
  // Time series normalization
  TIME_SERIES_FIELDS: {
    'date_range': 'date',
    'ga:date': 'date',
    'dimensions.date': 'date',
    'segments.date': 'date'
  } as FieldMapping
};

// ============================================================================
// VALIDATION PRESETS
// ============================================================================

/**
 * Common validation functions for typical data shapes
 */
export const VALIDATION_PRESETS = {
  /**
   * Validate time series data
   */
  timeSeriesData: (data: any): boolean => {
    if (!Array.isArray(data)) return false;
    return data.every(item => 
      item && 
      typeof item === 'object' && 
      (item.date || item.timestamp)
    );
  },

  /**
   * Validate chart data
   */
  chartData: (data: any): boolean => {
    if (!Array.isArray(data)) return false;
    return data.every(item => 
      item && 
      typeof item === 'object' && 
      (item.name || item.label || item.date)
    );
  },

  /**
   * Validate metric card data
   */
  metricCardData: (data: any): boolean => {
    return data &&
      typeof data === 'object' &&
      (typeof data.value === 'number' || typeof data.value === 'string') &&
      typeof data.title === 'string';
  },

  /**
   * Validate table data
   */
  tableData: (data: any): boolean => {
    if (!Array.isArray(data)) return false;
    return data.every(row => row && typeof row === 'object');
  }
};

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default adapter configurations for common use cases
 */
export const DEFAULT_CONFIGS = {
  /**
   * Development configuration with verbose logging
   */
  DEVELOPMENT: {
    enableValidation: true,
    enableErrorLogging: true,
    fallbackToDefault: true,
    debugMode: true
  } as AdapterConfig,

  /**
   * Production configuration with minimal logging
   */
  PRODUCTION: {
    enableValidation: true,
    enableErrorLogging: false,
    fallbackToDefault: true,
    debugMode: false
  } as AdapterConfig,

  /**
   * Strict configuration that throws on errors
   */
  STRICT: {
    enableValidation: true,
    enableErrorLogging: true,
    fallbackToDefault: false,
    debugMode: false
  } as AdapterConfig,

  /**
   * Performance-optimized configuration
   */
  PERFORMANCE: {
    enableValidation: false,
    enableErrorLogging: false,
    fallbackToDefault: true,
    debugMode: false
  } as AdapterConfig
};

// ============================================================================
// VERSION INFORMATION
// ============================================================================

export const ADAPTER_FRAMEWORK_VERSION = '1.0.0';
export const ADAPTER_FRAMEWORK_NAME = 'MCP Data Adapter Framework';

/**
 * Get framework information
 */
export function getFrameworkInfo() {
  return {
    name: ADAPTER_FRAMEWORK_NAME,
    version: ADAPTER_FRAMEWORK_VERSION,
    availableAdapters: getAvailableAdapterTypes(),
    documentation: 'See ANALYSIS_AND_MAPPING.md for detailed documentation'
  };
}