/**
 * Validation Schemas for MCP Data Adapters
 * 
 * Comprehensive data validation schemas for security, consistency, and data integrity.
 * Provides validation for all adapter input types with detailed error reporting.
 */

import { ValidationResult } from './types';

// ============================================================================
// VALIDATION SCHEMA TYPES
// ============================================================================

/**
 * Schema definition for data validation
 */
export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  nullable?: boolean;
  properties?: { [key: string]: ValidationSchema };
  items?: ValidationSchema;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validation context for detailed error reporting
 */
export interface ValidationContext {
  path: string;
  field: string;
  value: any;
  schema: ValidationSchema;
}

/**
 * Detailed validation error information
 */
export interface ValidationError {
  path: string;
  field: string;
  value: any;
  message: string;
  code: ValidationErrorCode;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Validation error codes for categorization
 */
export enum ValidationErrorCode {
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_TYPE = 'INVALID_TYPE',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  CUSTOM_VALIDATION_FAILED = 'CUSTOM_VALIDATION_FAILED',
  ARRAY_VALIDATION_FAILED = 'ARRAY_VALIDATION_FAILED',
  OBJECT_VALIDATION_FAILED = 'OBJECT_VALIDATION_FAILED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}

// ============================================================================
// CORE VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for chart input data validation
 */
export const CHART_INPUT_SCHEMA: ValidationSchema = {
  type: 'object',
  required: true,
  properties: {
    data: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            required: false,
            pattern: /^\d{4}-\d{2}-\d{2}$|^\d{8}$/
          },
          dimension: {
            type: 'string',
            required: false,
            maxLength: 500
          },
          value: {
            type: 'number',
            required: false,
            min: 0,
            max: Number.MAX_SAFE_INTEGER
          },
          metric: {
            type: 'number',
            required: false,
            min: 0,
            max: Number.MAX_SAFE_INTEGER
          },
          clicks: {
            type: 'number',
            required: false,
            min: 0,
            max: Number.MAX_SAFE_INTEGER
          },
          impressions: {
            type: 'number',
            required: false,
            min: 0,
            max: Number.MAX_SAFE_INTEGER
          },
          cost: {
            type: 'number',
            required: false,
            min: 0,
            max: 1000000000 // $1B max
          }
        }
      }
    },
    summary: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {
        total: {
          type: 'number',
          required: false,
          min: 0
        },
        change: {
          type: 'number',
          required: false,
          min: -100,
          max: 1000
        },
        trend: {
          type: 'string',
          required: false,
          enum: ['up', 'down', 'stable']
        }
      }
    },
    dateRange: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {
        startDate: {
          type: 'string',
          required: true,
          pattern: /^\d{4}-\d{2}-\d{2}$/
        },
        endDate: {
          type: 'string',
          required: true,
          pattern: /^\d{4}-\d{2}-\d{2}$/
        }
      }
    }
  }
};

/**
 * Schema for widget input data validation
 */
export const WIDGET_INPUT_SCHEMA: ValidationSchema = {
  type: 'object',
  required: true,
  properties: {
    data: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        properties: {} // Flexible object structure for widget data
      }
    },
    summary: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {} // Flexible summary structure
    },
    metadata: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {
        dateRange: {
          type: 'object',
          required: false,
          properties: {
            startDate: {
              type: 'string',
              required: true,
              pattern: /^\d{4}-\d{2}-\d{2}$/
            },
            endDate: {
              type: 'string',
              required: true,
              pattern: /^\d{4}-\d{2}-\d{2}$/
            }
          }
        }
      }
    }
  }
};

/**
 * Schema for table input data validation
 */
export const TABLE_INPUT_SCHEMA: ValidationSchema = {
  type: 'object',
  required: true,
  properties: {
    data: {
      type: 'array',
      required: true,
      maxLength: 10000, // Limit for performance
      items: {
        type: 'object',
        properties: {} // Flexible row structure
      }
    },
    columns: {
      type: 'array',
      required: false,
      nullable: true,
      items: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            required: true,
            minLength: 1,
            maxLength: 100
          },
          title: {
            type: 'string',
            required: true,
            minLength: 1,
            maxLength: 200
          },
          type: {
            type: 'string',
            required: false,
            enum: ['string', 'number', 'currency', 'percentage', 'date', 'boolean']
          },
          sortable: {
            type: 'boolean',
            required: false
          }
        }
      }
    },
    pagination: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {
        page: {
          type: 'number',
          required: false,
          min: 1,
          max: 10000
        },
        pageSize: {
          type: 'number',
          required: false,
          min: 1,
          max: 1000
        },
        total: {
          type: 'number',
          required: false,
          min: 0
        }
      }
    },
    sorting: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {
        column: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 100
        },
        direction: {
          type: 'string',
          required: true,
          enum: ['asc', 'desc']
        }
      }
    }
  }
};

/**
 * Schema for metric card input data validation
 */
export const METRIC_CARD_INPUT_SCHEMA: ValidationSchema = {
  type: 'object',
  required: true,
  properties: {
    current: {
      type: 'number',
      required: true,
      min: -Number.MAX_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER
    },
    previous: {
      type: 'number',
      required: false,
      nullable: true,
      min: -Number.MAX_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER
    },
    title: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 200,
      custom: (value: string) => {
        // Security: Prevent XSS in titles
        const dangerousPatterns = /<script|javascript:|on\w+=/i;
        return !dangerousPatterns.test(value) || 'Title contains potentially dangerous content';
      }
    },
    subtitle: {
      type: 'string',
      required: false,
      nullable: true,
      maxLength: 300,
      custom: (value: string) => {
        if (!value) return true;
        const dangerousPatterns = /<script|javascript:|on\w+=/i;
        return !dangerousPatterns.test(value) || 'Subtitle contains potentially dangerous content';
      }
    },
    unit: {
      type: 'string',
      required: false,
      nullable: true,
      maxLength: 20
    },
    type: {
      type: 'string',
      required: false,
      enum: ['number', 'currency', 'percentage', 'duration', 'rate']
    },
    target: {
      type: 'number',
      required: false,
      nullable: true,
      min: 0
    },
    trend: {
      type: 'string',
      required: false,
      enum: ['up', 'down', 'stable']
    },
    metadata: {
      type: 'object',
      required: false,
      nullable: true,
      properties: {} // Flexible metadata structure
    }
  }
};

// ============================================================================
// SECURITY VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for validating string fields against XSS and injection attacks
 */
export const SECURITY_STRING_SCHEMA: ValidationSchema = {
  type: 'string',
  custom: (value: string) => {
    if (!value) return true;
    
    // Check for common XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi,
      /data:text\/html/gi
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(value)) {
        return 'String contains potentially dangerous content';
      }
    }
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|SELECT|UNION|UPDATE)\b)/gi,
      /(--|\/\*|\*\/)/g,
      /(\b(OR|AND)\b.*=.*)/gi
    ];
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(value)) {
        return 'String contains potentially dangerous SQL content';
      }
    }
    
    return true;
  }
};

/**
 * Schema for validating numeric fields against overflow attacks
 */
export const SECURITY_NUMBER_SCHEMA: ValidationSchema = {
  type: 'number',
  custom: (value: number) => {
    if (typeof value !== 'number') return 'Value must be a number';
    if (!isFinite(value)) return 'Value must be finite';
    if (isNaN(value)) return 'Value cannot be NaN';
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      return 'Value exceeds safe integer range';
    }
    return true;
  }
};

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

/**
 * Main validation engine class
 */
export class ValidationEngine {
  private static instance: ValidationEngine;
  
  public static getInstance(): ValidationEngine {
    if (!ValidationEngine.instance) {
      ValidationEngine.instance = new ValidationEngine();
    }
    return ValidationEngine.instance;
  }

  /**
   * Validate data against a schema
   */
  public validate(data: any, schema: ValidationSchema, path: string = 'root'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    try {
      this.validateValue(data, schema, path, errors, warnings);
      
      return {
        isValid: errors.length === 0,
        errors: errors.map(err => err.message),
        warnings,
        details: {
          errorCount: errors.length,
          warningCount: warnings.length,
          criticalErrors: errors.filter(e => e.severity === 'critical').length,
          detailedErrors: errors
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation engine error: ${error.message}`],
        warnings,
        details: {
          errorCount: 1,
          warningCount: warnings.length,
          criticalErrors: 1,
          detailedErrors: [{
            path,
            field: 'validation_engine',
            value: data,
            message: `Validation engine error: ${error.message}`,
            code: ValidationErrorCode.OBJECT_VALIDATION_FAILED,
            severity: 'critical'
          }]
        }
      };
    }
  }

  private validateValue(
    value: any, 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    // Handle null/undefined values
    if (value === null || value === undefined) {
      if (schema.required && !schema.nullable) {
        errors.push({
          path,
          field: path.split('.').pop() || 'unknown',
          value,
          message: `Required field is missing or null`,
          code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
          severity: 'high'
        });
      }
      return;
    }

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Expected type ${schema.type}, got ${typeof value}`,
        code: ValidationErrorCode.INVALID_TYPE,
        severity: 'medium'
      });
      return;
    }

    // Type-specific validation
    switch (schema.type) {
      case 'string':
        this.validateString(value, schema, path, errors, warnings);
        break;
      case 'number':
        this.validateNumber(value, schema, path, errors, warnings);
        break;
      case 'array':
        this.validateArray(value, schema, path, errors, warnings);
        break;
      case 'object':
        this.validateObject(value, schema, path, errors, warnings);
        break;
      case 'date':
        this.validateDate(value, schema, path, errors, warnings);
        break;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: ValidationErrorCode.INVALID_ENUM_VALUE,
        severity: 'medium'
      });
    }

    // Custom validation
    if (schema.custom) {
      const customResult = schema.custom(value);
      if (customResult !== true) {
        errors.push({
          path,
          field: path.split('.').pop() || 'unknown',
          value,
          message: typeof customResult === 'string' ? customResult : 'Custom validation failed',
          code: ValidationErrorCode.CUSTOM_VALIDATION_FAILED,
          severity: 'high'
        });
      }
    }
  }

  private validateType(value: any, expectedType: ValidationSchema['type']): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || typeof value === 'string';
      default:
        return true;
    }
  }

  private validateString(
    value: string, 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `String too short. Minimum length: ${schema.minLength}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `String too long. Maximum length: ${schema.maxLength}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `String does not match required pattern`,
        code: ValidationErrorCode.INVALID_FORMAT,
        severity: 'medium'
      });
    }
  }

  private validateNumber(
    value: number, 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    if (schema.min !== undefined && value < schema.min) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Number too small. Minimum: ${schema.min}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    if (schema.max !== undefined && value > schema.max) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Number too large. Maximum: ${schema.max}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    if (!isFinite(value)) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Number must be finite`,
        code: ValidationErrorCode.INVALID_TYPE,
        severity: 'high'
      });
    }
  }

  private validateArray(
    value: any[], 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Array too short. Minimum length: ${schema.minLength}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Array too long. Maximum length: ${schema.maxLength}`,
        code: ValidationErrorCode.VALUE_OUT_OF_RANGE,
        severity: 'medium'
      });
    }

    // Validate array items
    if (schema.items) {
      value.forEach((item, index) => {
        this.validateValue(item, schema.items!, `${path}[${index}]`, errors, warnings);
      });
    }
  }

  private validateObject(
    value: object, 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    if (schema.properties) {
      // Validate defined properties
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const propValue = (value as any)[key];
        this.validateValue(propValue, propSchema, `${path}.${key}`, errors, warnings);
      });

      // Check for unexpected properties (security measure)
      Object.keys(value).forEach(key => {
        if (!schema.properties![key]) {
          warnings.push(`Unexpected property '${key}' at ${path}`);
        }
      });
    }
  }

  private validateDate(
    value: string | Date, 
    schema: ValidationSchema, 
    path: string, 
    errors: ValidationError[], 
    warnings: string[]
  ): void {
    let date: Date;
    
    if (typeof value === 'string') {
      date = new Date(value);
    } else {
      date = value;
    }
    
    if (isNaN(date.getTime())) {
      errors.push({
        path,
        field: path.split('.').pop() || 'unknown',
        value,
        message: `Invalid date format`,
        code: ValidationErrorCode.INVALID_FORMAT,
        severity: 'medium'
      });
    }
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Quick validation functions for common use cases
 */
export const ValidationUtils = {
  /**
   * Validate chart input data
   */
  validateChartInput: (data: any): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, CHART_INPUT_SCHEMA);
  },

  /**
   * Validate widget input data
   */
  validateWidgetInput: (data: any): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, WIDGET_INPUT_SCHEMA);
  },

  /**
   * Validate table input data
   */
  validateTableInput: (data: any): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, TABLE_INPUT_SCHEMA);
  },

  /**
   * Validate metric card input data
   */
  validateMetricCardInput: (data: any): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, METRIC_CARD_INPUT_SCHEMA);
  },

  /**
   * Security validation for strings
   */
  validateSecureString: (data: string): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, SECURITY_STRING_SCHEMA);
  },

  /**
   * Security validation for numbers
   */
  validateSecureNumber: (data: number): ValidationResult => {
    return ValidationEngine.getInstance().validate(data, SECURITY_NUMBER_SCHEMA);
  }
};

/**
 * Export validation engine instance
 */
export const validator = ValidationEngine.getInstance();