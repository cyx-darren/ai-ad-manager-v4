/**
 * Table Data Adapter
 * 
 * Specialized adapter for converting MCP responses to table component data formats.
 * Supports flexible column mapping, sorting, pagination, and data formatting.
 */

import { BaseAdapter } from './BaseAdapter';
import { 
  TableRow,
  TableColumn,
  AdapterConfig,
  AdapterMetadata
} from './types';
import { 
  normalizeDateString, 
  mapFields, 
  coerceToNumber,
  coerceToString,
  handleNullValue,
  formatCurrency,
  formatPercentage,
  formatNumber
} from './utils';

// ============================================================================
// TABLE DATA TYPES
// ============================================================================

/**
 * Table input data structure from MCP responses
 */
export interface TableInputData {
  data: Array<{
    [key: string]: any;
  }>;
  columns?: TableColumn[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  sorting?: {
    column: string;
    direction: 'asc' | 'desc';
  };
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Table output data with processed rows and metadata
 */
export interface TableOutputData {
  rows: TableRow[];
  columns: TableColumn[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  sorting: {
    column: string;
    direction: 'asc' | 'desc';
  } | null;
  summary?: {
    [key: string]: any;
  };
}

/**
 * Configuration for table adapter
 */
export interface TableAdapterConfig extends AdapterConfig {
  defaultPageSize?: number;
  maxPageSize?: number;
  autoDetectColumns?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  dateFormat?: string;
  numberFormat?: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  };
  currencyFormat?: {
    currency?: string;
    locale?: string;
  };
}

/**
 * Column data type for formatting
 */
export type ColumnDataType = 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'boolean';

/**
 * Column formatter configuration
 */
export interface ColumnFormatter {
  type: ColumnDataType;
  format?: string;
  options?: {
    [key: string]: any;
  };
}

// ============================================================================
// TABLE DATA ADAPTER
// ============================================================================

/**
 * Main table data adapter with flexible configuration
 */
export class TableDataAdapter extends BaseAdapter<TableInputData, TableOutputData> {
  
  constructor(config: TableAdapterConfig = {}) {
    super({
      defaultPageSize: 25,
      maxPageSize: 100,
      autoDetectColumns: true,
      enableSorting: true,
      enablePagination: true,
      dateFormat: 'YYYY-MM-DD',
      ...config
    });
  }

  protected transformImplementation(input: TableInputData): TableOutputData {
    const data = input.data || [];
    const config = this.config as TableAdapterConfig;
    
    // Auto-detect or use provided columns
    const columns = input.columns || (config.autoDetectColumns ? this.autoDetectColumns(data) : []);
    
    // Process and format rows
    const processedRows = this.processRows(data, columns);
    
    // Apply sorting if enabled and specified
    const sortedRows = config.enableSorting && input.sorting ? 
      this.applySorting(processedRows, input.sorting, columns) : processedRows;
    
    // Apply pagination if enabled
    const paginationConfig = config.enablePagination ? this.configurePagination(input.pagination, sortedRows.length) : null;
    const paginatedRows = paginationConfig ? 
      this.applyPagination(sortedRows, paginationConfig) : sortedRows;
    
    return {
      rows: paginatedRows,
      columns,
      pagination: paginationConfig || {
        page: 1,
        pageSize: sortedRows.length,
        total: sortedRows.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      },
      sorting: input.sorting || null,
      summary: this.calculateSummary(sortedRows, columns)
    };
  }

  private autoDetectColumns(data: any[]): TableColumn[] {
    if (data.length === 0) return [];
    
    // Get all unique keys from data
    const keys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => keys.add(key));
    });
    
    // Convert to column definitions with auto-detected types
    return Array.from(keys).map(key => ({
      key,
      title: this.formatColumnTitle(key),
      type: this.detectColumnType(data, key),
      sortable: true,
      formatter: this.getDefaultFormatter(this.detectColumnType(data, key))
    }));
  }

  private formatColumnTitle(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/_/g, ' ') // Replace underscores with spaces
      .trim();
  }

  private detectColumnType(data: any[], key: string): ColumnDataType {
    const values = data.map(item => item[key]).filter(val => val != null);
    
    if (values.length === 0) return 'string';
    
    // Check for common patterns
    if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
      return 'date';
    }
    
    if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('percent')) {
      return 'percentage';
    }
    
    if (key.toLowerCase().includes('cost') || key.toLowerCase().includes('revenue') || 
        key.toLowerCase().includes('value') || key.toLowerCase().includes('price')) {
      return 'currency';
    }
    
    // Type detection based on values
    const sampleValue = values[0];
    
    if (typeof sampleValue === 'boolean') return 'boolean';
    if (typeof sampleValue === 'number') return 'number';
    if (!isNaN(Number(sampleValue))) return 'number';
    
    return 'string';
  }

  private getDefaultFormatter(type: ColumnDataType): ColumnFormatter {
    const config = this.config as TableAdapterConfig;
    
    switch (type) {
      case 'currency':
        return {
          type: 'currency',
          options: config.currencyFormat || { currency: 'USD', locale: 'en-US' }
        };
      case 'percentage':
        return {
          type: 'percentage',
          options: { minimumFractionDigits: 1, maximumFractionDigits: 2 }
        };
      case 'number':
        return {
          type: 'number',
          options: config.numberFormat || { minimumFractionDigits: 0, maximumFractionDigits: 2 }
        };
      case 'date':
        return {
          type: 'date',
          format: config.dateFormat || 'YYYY-MM-DD'
        };
      default:
        return {
          type: 'string'
        };
    }
  }

  private processRows(data: any[], columns: TableColumn[]): TableRow[] {
    return data.map((item, index) => {
      const row: TableRow = {
        id: item.id || index.toString(),
        data: {}
      };
      
      columns.forEach(column => {
        const rawValue = item[column.key];
        row.data[column.key] = this.formatCellValue(rawValue, column.formatter);
      });
      
      return row;
    });
  }

  private formatCellValue(value: any, formatter?: ColumnFormatter): any {
    if (value == null) return '';
    
    if (!formatter) return value;
    
    try {
      switch (formatter.type) {
        case 'currency':
          return formatCurrency(coerceToNumber(value) as number, formatter.options);
          
        case 'percentage':
          return formatPercentage(coerceToNumber(value) as number, formatter.options);
          
        case 'number':
          return formatNumber(coerceToNumber(value) as number, formatter.options);
          
        case 'date':
          return normalizeDateString(value, { format: formatter.format });
          
        case 'boolean':
          return Boolean(value);
          
        default:
          return coerceToString(value);
      }
    } catch (error) {
      return value;
    }
  }

  private applySorting(rows: TableRow[], sorting: {column: string; direction: 'asc' | 'desc'}, columns: TableColumn[]): TableRow[] {
    const column = columns.find(col => col.key === sorting.column);
    if (!column || !column.sortable) return rows;
    
    return [...rows].sort((a, b) => {
      const aValue = a.data[sorting.column];
      const bValue = b.data[sorting.column];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sorting.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sorting.direction === 'asc' ? 1 : -1;
      
      // Numeric comparison
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sorting.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sorting.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }

  private configurePagination(inputPagination: any, totalRows: number) {
    const config = this.config as TableAdapterConfig;
    const page = inputPagination?.page || 1;
    const pageSize = Math.min(
      inputPagination?.pageSize || config.defaultPageSize || 25,
      config.maxPageSize || 100
    );
    
    const totalPages = Math.ceil(totalRows / pageSize);
    
    return {
      page: Math.max(1, Math.min(page, totalPages)),
      pageSize,
      total: totalRows,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }

  private applyPagination(rows: TableRow[], pagination: any): TableRow[] {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return rows.slice(startIndex, endIndex);
  }

  private calculateSummary(rows: TableRow[], columns: TableColumn[]): {[key: string]: any} {
    const summary: {[key: string]: any} = {};
    
    columns.forEach(column => {
      if (column.formatter?.type === 'number' || column.formatter?.type === 'currency') {
        const values = rows
          .map(row => row.data[column.key])
          .map(val => coerceToNumber(val))
          .filter(val => !isNaN(val as number)) as number[];
        
        if (values.length > 0) {
          summary[`${column.key}_sum`] = values.reduce((sum, val) => sum + val, 0);
          summary[`${column.key}_avg`] = summary[`${column.key}_sum`] / values.length;
          summary[`${column.key}_min`] = Math.min(...values);
          summary[`${column.key}_max`] = Math.max(...values);
        }
      }
    });
    
    return summary;
  }

  public validate(input: TableInputData): boolean {
    return input && Array.isArray(input.data);
  }

  public getDefaultOutput(): TableOutputData {
    return {
      rows: [],
      columns: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
      },
      sorting: null,
      summary: {}
    };
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'TableDataAdapter',
      version: '1.0.0',
      inputType: 'TableInputData',
      outputType: 'TableOutputData',
      description: 'Converts MCP analytics data to table format with sorting and pagination',
      supportsTimeRange: false,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// SPECIALIZED TABLE ADAPTERS
// ============================================================================

/**
 * Analytics table adapter with pre-configured columns for GA4 data
 */
export class AnalyticsTableAdapter extends TableDataAdapter {
  constructor(config: TableAdapterConfig = {}) {
    super({
      ...config,
      autoDetectColumns: false
    });
  }

  protected transformImplementation(input: TableInputData): TableOutputData {
    // Pre-defined columns for analytics data
    const predefinedColumns: TableColumn[] = [
      {
        key: 'date',
        title: 'Date',
        type: 'date',
        sortable: true,
        formatter: { type: 'date', format: 'YYYY-MM-DD' }
      },
      {
        key: 'page',
        title: 'Page',
        type: 'string',
        sortable: true,
        formatter: { type: 'string' }
      },
      {
        key: 'sessions',
        title: 'Sessions',
        type: 'number',
        sortable: true,
        formatter: { type: 'number', options: { minimumFractionDigits: 0 } }
      },
      {
        key: 'pageviews',
        title: 'Pageviews',
        type: 'number',
        sortable: true,
        formatter: { type: 'number', options: { minimumFractionDigits: 0 } }
      },
      {
        key: 'bounceRate',
        title: 'Bounce Rate',
        type: 'percentage',
        sortable: true,
        formatter: { type: 'percentage', options: { maximumFractionDigits: 1 } }
      }
    ];
    
    const inputWithColumns = {
      ...input,
      columns: predefinedColumns
    };
    
    return super.transformImplementation(inputWithColumns);
  }
}

/**
 * Conversion table adapter with pre-configured columns for conversion data
 */
export class ConversionTableAdapter extends TableDataAdapter {
  constructor(config: TableAdapterConfig = {}) {
    super({
      ...config,
      autoDetectColumns: false
    });
  }

  protected transformImplementation(input: TableInputData): TableOutputData {
    // Pre-defined columns for conversion data
    const predefinedColumns: TableColumn[] = [
      {
        key: 'goalName',
        title: 'Goal',
        type: 'string',
        sortable: true,
        formatter: { type: 'string' }
      },
      {
        key: 'conversions',
        title: 'Conversions',
        type: 'number',
        sortable: true,
        formatter: { type: 'number', options: { minimumFractionDigits: 0 } }
      },
      {
        key: 'conversionRate',
        title: 'Rate',
        type: 'percentage',
        sortable: true,
        formatter: { type: 'percentage', options: { maximumFractionDigits: 2 } }
      },
      {
        key: 'conversionValue',
        title: 'Value',
        type: 'currency',
        sortable: true,
        formatter: { type: 'currency', options: { currency: 'USD', locale: 'en-US' } }
      }
    ];
    
    const inputWithColumns = {
      ...input,
      columns: predefinedColumns
    };
    
    return super.transformImplementation(inputWithColumns);
  }
}

// ============================================================================
// TABLE ADAPTER FACTORY HELPERS
// ============================================================================

/**
 * Table adapter type for factory registration
 */
export type TableAdapterType = 'generic' | 'analytics' | 'conversion';

/**
 * Factory function for creating table adapters by type
 */
export function createTableAdapter(
  type: TableAdapterType, 
  config?: TableAdapterConfig
): TableDataAdapter | AnalyticsTableAdapter | ConversionTableAdapter {
  switch (type) {
    case 'generic':
      return new TableDataAdapter(config);
    case 'analytics':
      return new AnalyticsTableAdapter(config);
    case 'conversion':
      return new ConversionTableAdapter(config);
    default:
      throw new Error(`Unknown table adapter type: ${type}`);
  }
}