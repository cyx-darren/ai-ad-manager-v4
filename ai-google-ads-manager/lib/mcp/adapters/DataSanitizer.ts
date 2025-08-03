/**
 * Data Sanitizer for MCP Adapters
 * 
 * Comprehensive data sanitization for security, consistency, and data integrity.
 * Provides sanitization for all adapter input types with configurable policies.
 */

import { coerceToNumber, coerceToString, handleNullValue } from './utils';

// ============================================================================
// SANITIZATION TYPES
// ============================================================================

/**
 * Sanitization configuration options
 */
export interface SanitizationConfig {
  // String sanitization
  removeHtml?: boolean;
  removeScripts?: boolean;
  removeUrls?: boolean;
  maxStringLength?: number;
  allowedHtmlTags?: string[];
  
  // Number sanitization
  numberPrecision?: number;
  maxNumberValue?: number;
  minNumberValue?: number;
  
  // Array sanitization
  maxArrayLength?: number;
  removeDuplicates?: boolean;
  
  // Object sanitization
  maxObjectDepth?: number;
  removeEmptyObjects?: boolean;
  allowedKeys?: string[];
  
  // Date sanitization
  dateFormat?: 'ISO' | 'YYYY-MM-DD' | 'timestamp';
  minDate?: Date;
  maxDate?: Date;
  
  // Security
  enableXssProtection?: boolean;
  enableSqlInjectionProtection?: boolean;
  enableCsrfProtection?: boolean;
}

/**
 * Sanitization result with details
 */
export interface SanitizationResult<T = any> {
  sanitized: T;
  warnings: string[];
  changes: string[];
  isClean: boolean;
}

/**
 * Default sanitization configurations for different security levels
 */
export const SANITIZATION_CONFIGS = {
  STRICT: {
    removeHtml: true,
    removeScripts: true,
    removeUrls: true,
    maxStringLength: 1000,
    allowedHtmlTags: [],
    numberPrecision: 2,
    maxNumberValue: 1000000000,
    minNumberValue: -1000000000,
    maxArrayLength: 10000,
    removeDuplicates: true,
    maxObjectDepth: 10,
    removeEmptyObjects: true,
    enableXssProtection: true,
    enableSqlInjectionProtection: true,
    enableCsrfProtection: true
  } as SanitizationConfig,
  
  MODERATE: {
    removeHtml: true,
    removeScripts: true,
    removeUrls: false,
    maxStringLength: 5000,
    allowedHtmlTags: ['b', 'i', 'em', 'strong'],
    numberPrecision: 4,
    maxNumberValue: Number.MAX_SAFE_INTEGER,
    minNumberValue: Number.MIN_SAFE_INTEGER,
    maxArrayLength: 50000,
    removeDuplicates: false,
    maxObjectDepth: 20,
    removeEmptyObjects: false,
    enableXssProtection: true,
    enableSqlInjectionProtection: true,
    enableCsrfProtection: false
  } as SanitizationConfig,
  
  PERMISSIVE: {
    removeHtml: false,
    removeScripts: true,
    removeUrls: false,
    maxStringLength: 10000,
    allowedHtmlTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    numberPrecision: 6,
    maxNumberValue: Number.MAX_SAFE_INTEGER,
    minNumberValue: Number.MIN_SAFE_INTEGER,
    maxArrayLength: 100000,
    removeDuplicates: false,
    maxObjectDepth: 50,
    removeEmptyObjects: false,
    enableXssProtection: true,
    enableSqlInjectionProtection: false,
    enableCsrfProtection: false
  } as SanitizationConfig
};

// ============================================================================
// CORE SANITIZER CLASS
// ============================================================================

/**
 * Main data sanitizer class
 */
export class DataSanitizer {
  private config: SanitizationConfig;
  private static defaultInstance: DataSanitizer;

  constructor(config: SanitizationConfig = SANITIZATION_CONFIGS.MODERATE) {
    this.config = { ...SANITIZATION_CONFIGS.MODERATE, ...config };
  }

  /**
   * Get default sanitizer instance
   */
  public static getDefault(): DataSanitizer {
    if (!DataSanitizer.defaultInstance) {
      DataSanitizer.defaultInstance = new DataSanitizer();
    }
    return DataSanitizer.defaultInstance;
  }

  /**
   * Sanitize any value based on its type
   */
  public sanitize<T>(value: T): SanitizationResult<T> {
    const warnings: string[] = [];
    const changes: string[] = [];
    
    try {
      const sanitized = this.sanitizeValue(value, warnings, changes) as T;
      
      return {
        sanitized,
        warnings,
        changes,
        isClean: changes.length === 0
      };
    } catch (error) {
      warnings.push(`Sanitization error: ${error.message}`);
      return {
        sanitized: value,
        warnings,
        changes,
        isClean: false
      };
    }
  }

  private sanitizeValue(value: any, warnings: string[], changes: string[], depth: number = 0): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Prevent infinite recursion
    if (this.config.maxObjectDepth && depth > this.config.maxObjectDepth) {
      warnings.push(`Maximum object depth exceeded (${this.config.maxObjectDepth})`);
      return null;
    }

    // Type-based sanitization
    switch (typeof value) {
      case 'string':
        return this.sanitizeString(value, warnings, changes);
      case 'number':
        return this.sanitizeNumber(value, warnings, changes);
      case 'boolean':
        return value;
      case 'object':
        if (Array.isArray(value)) {
          return this.sanitizeArray(value, warnings, changes, depth);
        } else if (value instanceof Date) {
          return this.sanitizeDate(value, warnings, changes);
        } else {
          return this.sanitizeObject(value, warnings, changes, depth);
        }
      default:
        return value;
    }
  }

  // ============================================================================
  // STRING SANITIZATION
  // ============================================================================

  private sanitizeString(value: string, warnings: string[], changes: string[]): string {
    let sanitized = value;
    
    // Remove potential XSS attacks
    if (this.config.enableXssProtection) {
      sanitized = this.removeXssThreats(sanitized, warnings, changes);
    }
    
    // Remove SQL injection attempts
    if (this.config.enableSqlInjectionProtection) {
      sanitized = this.removeSqlInjection(sanitized, warnings, changes);
    }
    
    // Remove HTML if configured
    if (this.config.removeHtml) {
      sanitized = this.removeHtml(sanitized, warnings, changes);
    }
    
    // Remove scripts
    if (this.config.removeScripts) {
      sanitized = this.removeScripts(sanitized, warnings, changes);
    }
    
    // Remove URLs if configured
    if (this.config.removeUrls) {
      sanitized = this.removeUrls(sanitized, warnings, changes);
    }
    
    // Truncate if too long
    if (this.config.maxStringLength && sanitized.length > this.config.maxStringLength) {
      const originalLength = sanitized.length;
      sanitized = sanitized.substring(0, this.config.maxStringLength);
      changes.push(`String truncated from ${originalLength} to ${this.config.maxStringLength} characters`);
    }
    
    // Normalize whitespace
    const normalizedWhitespace = sanitized.replace(/\s+/g, ' ').trim();
    if (normalizedWhitespace !== sanitized) {
      sanitized = normalizedWhitespace;
      changes.push('Normalized whitespace');
    }
    
    return sanitized;
  }

  private removeXssThreats(value: string, warnings: string[], changes: string[]): string {
    const xssPatterns = [
      // Script tags
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      // Event handlers
      /on\w+\s*=\s*["'][^"']*["']/gi,
      // JavaScript URLs
      /javascript\s*:/gi,
      // Data URLs with scripts
      /data\s*:\s*text\/html/gi,
      // Iframe, object, embed tags
      /<(iframe|object|embed)[^>]*>/gi,
      // Meta redirects
      /<meta[^>]*http-equiv[^>]*refresh[^>]*>/gi
    ];
    
    let sanitized = value;
    let foundThreats = false;
    
    xssPatterns.forEach(pattern => {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        foundThreats = true;
      }
    });
    
    if (foundThreats) {
      warnings.push('Potential XSS content detected and removed');
      changes.push('Removed XSS threats');
    }
    
    return sanitized;
  }

  private removeSqlInjection(value: string, warnings: string[], changes: string[]): string {
    const sqlPatterns = [
      // SQL keywords in suspicious contexts
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|SELECT|UNION|UPDATE)\b[^a-zA-Z])/gi,
      // SQL comments
      /(--|\/\*[\s\S]*?\*\/)/g,
      // UNION attacks
      /(\bunion\b.*\bselect\b)/gi,
      // Boolean-based attacks
      /(\b(or|and)\b\s*['"]?\s*\w*['"]?\s*=\s*['"]?\s*\w*['"]?)/gi
    ];
    
    let sanitized = value;
    let foundInjection = false;
    
    sqlPatterns.forEach(pattern => {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        foundInjection = true;
      }
    });
    
    if (foundInjection) {
      warnings.push('Potential SQL injection detected and removed');
      changes.push('Removed SQL injection threats');
    }
    
    return sanitized;
  }

  private removeHtml(value: string, warnings: string[], changes: string[]): string {
    const allowedTags = this.config.allowedHtmlTags || [];
    
    if (allowedTags.length === 0) {
      // Remove all HTML
      const withoutHtml = value.replace(/<[^>]*>/g, '');
      if (withoutHtml !== value) {
        changes.push('Removed all HTML tags');
      }
      return withoutHtml;
    } else {
      // Remove only non-allowed HTML tags
      const tagPattern = /<\/?([a-zA-Z]+)[^>]*>/g;
      const sanitized = value.replace(tagPattern, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
          return match;
        } else {
          changes.push(`Removed disallowed HTML tag: ${tagName}`);
          return '';
        }
      });
      return sanitized;
    }
  }

  private removeScripts(value: string, warnings: string[], changes: string[]): string {
    const scriptPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript\s*:/gi,
      /vbscript\s*:/gi
    ];
    
    let sanitized = value;
    let foundScripts = false;
    
    scriptPatterns.forEach(pattern => {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        foundScripts = true;
      }
    });
    
    if (foundScripts) {
      warnings.push('Script content detected and removed');
      changes.push('Removed script content');
    }
    
    return sanitized;
  }

  private removeUrls(value: string, warnings: string[], changes: string[]): string {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const sanitized = value.replace(urlPattern, '[URL_REMOVED]');
    
    if (sanitized !== value) {
      changes.push('Removed URLs');
    }
    
    return sanitized;
  }

  // ============================================================================
  // NUMBER SANITIZATION
  // ============================================================================

  private sanitizeNumber(value: number, warnings: string[], changes: string[]): number {
    let sanitized = value;
    
    // Handle NaN and Infinity
    if (isNaN(sanitized) || !isFinite(sanitized)) {
      warnings.push(`Invalid number detected (${value}), replacing with 0`);
      changes.push('Replaced invalid number with 0');
      return 0;
    }
    
    // Apply min/max bounds
    if (this.config.minNumberValue !== undefined && sanitized < this.config.minNumberValue) {
      changes.push(`Number clamped to minimum value (${this.config.minNumberValue})`);
      sanitized = this.config.minNumberValue;
    }
    
    if (this.config.maxNumberValue !== undefined && sanitized > this.config.maxNumberValue) {
      changes.push(`Number clamped to maximum value (${this.config.maxNumberValue})`);
      sanitized = this.config.maxNumberValue;
    }
    
    // Apply precision
    if (this.config.numberPrecision !== undefined) {
      const rounded = Number(sanitized.toFixed(this.config.numberPrecision));
      if (rounded !== sanitized) {
        changes.push(`Number rounded to ${this.config.numberPrecision} decimal places`);
        sanitized = rounded;
      }
    }
    
    return sanitized;
  }

  // ============================================================================
  // ARRAY SANITIZATION
  // ============================================================================

  private sanitizeArray(value: any[], warnings: string[], changes: string[], depth: number): any[] {
    let sanitized = [...value];
    
    // Limit array length
    if (this.config.maxArrayLength && sanitized.length > this.config.maxArrayLength) {
      const originalLength = sanitized.length;
      sanitized = sanitized.slice(0, this.config.maxArrayLength);
      warnings.push(`Array truncated from ${originalLength} to ${this.config.maxArrayLength} items`);
      changes.push('Array length limited for performance');
    }
    
    // Sanitize each element
    sanitized = sanitized.map((item, index) => {
      try {
        return this.sanitizeValue(item, warnings, changes, depth + 1);
      } catch (error) {
        warnings.push(`Error sanitizing array item ${index}: ${error.message}`);
        return null;
      }
    });
    
    // Remove null/undefined elements created by sanitization errors
    const filteredArray = sanitized.filter(item => item !== null && item !== undefined);
    if (filteredArray.length !== sanitized.length) {
      changes.push('Removed invalid array elements');
      sanitized = filteredArray;
    }
    
    // Remove duplicates if configured
    if (this.config.removeDuplicates) {
      const uniqueArray = [...new Set(sanitized.map(item => JSON.stringify(item)))].map(item => JSON.parse(item));
      if (uniqueArray.length !== sanitized.length) {
        changes.push('Removed duplicate array elements');
        sanitized = uniqueArray;
      }
    }
    
    return sanitized;
  }

  // ============================================================================
  // OBJECT SANITIZATION
  // ============================================================================

  private sanitizeObject(value: object, warnings: string[], changes: string[], depth: number): object {
    const sanitized: any = {};
    
    Object.entries(value).forEach(([key, val]) => {
      // Sanitize the key
      const sanitizedKey = this.sanitizeString(key, warnings, changes);
      
      // Check if key is allowed
      if (this.config.allowedKeys && !this.config.allowedKeys.includes(sanitizedKey)) {
        warnings.push(`Disallowed object key removed: ${key}`);
        changes.push(`Removed disallowed key: ${key}`);
        return;
      }
      
      // Sanitize the value
      try {
        const sanitizedValue = this.sanitizeValue(val, warnings, changes, depth + 1);
        
        // Skip empty objects if configured
        if (this.config.removeEmptyObjects && 
            typeof sanitizedValue === 'object' && 
            sanitizedValue !== null &&
            !Array.isArray(sanitizedValue) &&
            Object.keys(sanitizedValue).length === 0) {
          changes.push(`Removed empty object for key: ${sanitizedKey}`);
          return;
        }
        
        sanitized[sanitizedKey] = sanitizedValue;
      } catch (error) {
        warnings.push(`Error sanitizing object property '${key}': ${error.message}`);
        changes.push(`Removed invalid property: ${key}`);
      }
    });
    
    return sanitized;
  }

  // ============================================================================
  // DATE SANITIZATION
  // ============================================================================

  private sanitizeDate(value: Date, warnings: string[], changes: string[]): Date | string | number {
    // Validate date
    if (isNaN(value.getTime())) {
      warnings.push('Invalid date detected, replacing with current date');
      changes.push('Replaced invalid date');
      value = new Date();
    }
    
    // Apply date bounds
    if (this.config.minDate && value < this.config.minDate) {
      warnings.push(`Date before minimum allowed date, clamping to ${this.config.minDate.toISOString()}`);
      changes.push('Date clamped to minimum');
      value = this.config.minDate;
    }
    
    if (this.config.maxDate && value > this.config.maxDate) {
      warnings.push(`Date after maximum allowed date, clamping to ${this.config.maxDate.toISOString()}`);
      changes.push('Date clamped to maximum');
      value = this.config.maxDate;
    }
    
    // Format according to configuration
    switch (this.config.dateFormat) {
      case 'ISO':
        return value.toISOString();
      case 'YYYY-MM-DD':
        return value.toISOString().split('T')[0];
      case 'timestamp':
        return value.getTime();
      default:
        return value;
    }
  }
}

// ============================================================================
// SPECIALIZED SANITIZERS
// ============================================================================

/**
 * Chart data sanitizer with chart-specific rules
 */
export class ChartDataSanitizer extends DataSanitizer {
  constructor() {
    super({
      ...SANITIZATION_CONFIGS.MODERATE,
      maxArrayLength: 1000, // Limit chart data points
      numberPrecision: 2,
      removeEmptyObjects: true,
      dateFormat: 'YYYY-MM-DD'
    });
  }
}

/**
 * Widget data sanitizer with widget-specific rules
 */
export class WidgetDataSanitizer extends DataSanitizer {
  constructor() {
    super({
      ...SANITIZATION_CONFIGS.MODERATE,
      maxStringLength: 500,
      numberPrecision: 2,
      removeEmptyObjects: true
    });
  }
}

/**
 * Table data sanitizer with table-specific rules
 */
export class TableDataSanitizer extends DataSanitizer {
  constructor() {
    super({
      ...SANITIZATION_CONFIGS.MODERATE,
      maxArrayLength: 10000, // Large tables allowed
      maxStringLength: 1000,
      removeEmptyObjects: false, // Keep empty cells for tables
      removeDuplicates: false
    });
  }
}

/**
 * Metric card sanitizer with strict security
 */
export class MetricCardSanitizer extends DataSanitizer {
  constructor() {
    super({
      ...SANITIZATION_CONFIGS.STRICT,
      maxStringLength: 200, // Short titles/labels
      numberPrecision: 4
    });
  }
}

// ============================================================================
// SANITIZATION UTILITIES
// ============================================================================

/**
 * Quick sanitization functions for common use cases
 */
export const SanitizationUtils = {
  /**
   * Sanitize chart input data
   */
  sanitizeChartData: (data: any): SanitizationResult => {
    return new ChartDataSanitizer().sanitize(data);
  },

  /**
   * Sanitize widget input data
   */
  sanitizeWidgetData: (data: any): SanitizationResult => {
    return new WidgetDataSanitizer().sanitize(data);
  },

  /**
   * Sanitize table input data
   */
  sanitizeTableData: (data: any): SanitizationResult => {
    return new TableDataSanitizer().sanitize(data);
  },

  /**
   * Sanitize metric card input data
   */
  sanitizeMetricCardData: (data: any): SanitizationResult => {
    return new MetricCardSanitizer().sanitize(data);
  },

  /**
   * General purpose sanitization
   */
  sanitize: (data: any, config?: SanitizationConfig): SanitizationResult => {
    return new DataSanitizer(config).sanitize(data);
  }
};

/**
 * Export default sanitizer instance
 */
export const sanitizer = DataSanitizer.getDefault();