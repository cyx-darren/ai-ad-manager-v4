/**
 * Request Validation and Sanitization for GA4 Analytics MCP Server
 * 
 * Provides comprehensive input validation, sanitization, and security checks
 * for all MCP tool requests to prevent injection attacks and ensure data integrity.
 */

import { logger as productionLogger } from './productionLogger.js';
import { errorTracker, ErrorType, ErrorSeverity } from './errorTracking.js';
import { performanceMonitor } from './performanceMetrics.js';

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'email' | 'url';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  customValidator?: (value: any) => ValidationResult;
  sanitize?: boolean;
  description?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  warnings?: string[];
}

export interface SanitizationOptions {
  removeHtml: boolean;
  removeScripts: boolean;
  normalizeWhitespace: boolean;
  maxLength?: number;
  allowedChars?: RegExp;
  escapeSpecialChars: boolean;
}

export interface SecurityCheckResult {
  isSafe: boolean;
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sanitizedValue?: any;
}

export class RequestValidator {
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|;|\||&)/g,
    /(\bOR\b|\bAND\b)\s+(\d+\s*=\s*\d+|\w+\s*=\s*\w+)/gi
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<\s*\/?\s*(script|iframe|object|embed|form|input|meta|link)\b[^>]*>/gi
  ];

  private static readonly LDAP_INJECTION_PATTERNS = [
    /(\*|\(|\)|\||&|!)/g,
    /(\x00|\x08|\x09|\x0a|\x0d|\x1a|\x22|\x25|\x27|\x5c|\x5f)/g
  ];

  private static readonly COMMON_DANGEROUS_PATTERNS = [
    /\.\.\/|\.\.\\/, // Path traversal
    /\$\{.*\}/, // Template injection
    /%[0-9a-f]{2}/gi, // URL encoding that might hide malicious content
    /\\x[0-9a-f]{2}/gi, // Hex encoding
    /\\u[0-9a-f]{4}/gi, // Unicode encoding
  ];

  private validationMetrics = {
    totalValidations: 0,
    failedValidations: 0,
    sanitizations: 0,
    securityThreats: 0,
    performanceWarnings: 0
  };

  /**
   * Validate and sanitize MCP tool arguments
   */
  async validateToolArguments(
    toolName: string, 
    arguments_: any, 
    schema: ValidationSchema
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    this.validationMetrics.totalValidations++;

    try {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        sanitizedData: {},
        warnings: []
      };

      // Check for required arguments
      for (const [key, rule] of Object.entries(schema)) {
        const value = arguments_[key];
        
        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
          result.errors.push(`${key} is required`);
          result.isValid = false;
          continue;
        }

        // Skip validation for optional missing fields
        if (value === undefined || value === null) {
          continue;
        }

        // Validate and sanitize the field
        const fieldResult = await this.validateField(key, value, rule);
        
        if (!fieldResult.isValid) {
          result.errors.push(...fieldResult.errors);
          result.isValid = false;
        }

        if (fieldResult.warnings) {
          result.warnings?.push(...fieldResult.warnings);
        }

        // Store sanitized value
        result.sanitizedData[key] = fieldResult.sanitizedData || value;
      }

      // Check for unexpected arguments
      for (const key of Object.keys(arguments_)) {
        if (!schema[key]) {
          result.warnings?.push(`Unexpected argument: ${key}`);
        }
      }

      // Performance check
      const validationTime = Date.now() - startTime;
      if (validationTime > 100) {
        result.warnings?.push(`Validation took ${validationTime}ms (performance warning)`);
        this.validationMetrics.performanceWarnings++;
      }

      // Log validation result
      if (!result.isValid) {
        this.validationMetrics.failedValidations++;
        
        productionLogger.warn('Request validation failed', {
          component: 'VALIDATION',
          toolName,
          errors: result.errors,
          validationTime
        });

        errorTracker.trackError(new Error(`Validation failed for ${toolName}`), {
          type: ErrorType.VALIDATION_ERROR,
          severity: ErrorSeverity.MEDIUM,
          component: 'VALIDATION',
          additionalContext: {
            toolName,
            errors: result.errors,
            argumentKeys: Object.keys(arguments_)
          }
        });
      } else {
        productionLogger.debug('Request validation passed', {
          component: 'VALIDATION',
          toolName,
          argumentCount: Object.keys(arguments_).length,
          sanitizationCount: Object.keys(result.sanitizedData).length,
          validationTime
        });
      }

      performanceMonitor.recordResponseTime(validationTime, 'mcp');
      
      return result;

    } catch (error) {
      this.validationMetrics.failedValidations++;
      
      productionLogger.error('Validation error', {
        component: 'VALIDATION',
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        errors: [`Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        sanitizedData: {}
      };
    }
  }

  /**
   * Validate individual field
   */
  private async validateField(fieldName: string, value: any, rule: ValidationRule): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Type validation
      if (rule.type && !this.validateType(value, rule.type)) {
        result.errors.push(`${fieldName} must be of type ${rule.type}`);
        result.isValid = false;
        return result;
      }

      // Security check
      const securityCheck = await this.performSecurityCheck(value, fieldName);
      if (!securityCheck.isSafe) {
        result.errors.push(`${fieldName} contains potentially dangerous content: ${securityCheck.threats.join(', ')}`);
        result.isValid = false;
        this.validationMetrics.securityThreats++;
        
        productionLogger.warn('Security threat detected', {
          component: 'VALIDATION',
          fieldName,
          threats: securityCheck.threats,
          riskLevel: securityCheck.riskLevel
        });
        
        return result;
      }

      // Sanitize value if needed
      let sanitizedValue = value;
      if (rule.sanitize && typeof value === 'string') {
        sanitizedValue = this.sanitizeString(value, {
          removeHtml: true,
          removeScripts: true,
          normalizeWhitespace: true,
          maxLength: rule.maxLength,
          allowedChars: rule.pattern,
          escapeSpecialChars: true
        });
        
        if (sanitizedValue !== value) {
          this.validationMetrics.sanitizations++;
          result.warnings?.push(`${fieldName} was sanitized`);
        }
      }

      // Length validation for strings
      if (typeof sanitizedValue === 'string') {
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          result.errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
          result.isValid = false;
        }
        
        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          result.errors.push(`${fieldName} must be at most ${rule.maxLength} characters long`);
          result.isValid = false;
        }
      }

      // Numeric range validation
      if (typeof sanitizedValue === 'number') {
        if (rule.min !== undefined && sanitizedValue < rule.min) {
          result.errors.push(`${fieldName} must be at least ${rule.min}`);
          result.isValid = false;
        }
        
        if (rule.max !== undefined && sanitizedValue > rule.max) {
          result.errors.push(`${fieldName} must be at most ${rule.max}`);
          result.isValid = false;
        }
      }

      // Pattern validation
      if (rule.pattern && typeof sanitizedValue === 'string' && !rule.pattern.test(sanitizedValue)) {
        result.errors.push(`${fieldName} does not match required pattern`);
        result.isValid = false;
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(sanitizedValue)) {
        result.errors.push(`${fieldName} must be one of: ${rule.allowedValues.join(', ')}`);
        result.isValid = false;
      }

      // Custom validation
      if (rule.customValidator) {
        const customResult = rule.customValidator(sanitizedValue);
        if (!customResult.isValid) {
          result.errors.push(...customResult.errors);
          result.isValid = false;
        }
        if (customResult.warnings) {
          result.warnings?.push(...customResult.warnings);
        }
      }

      result.sanitizedData = sanitizedValue;
      return result;

    } catch (error) {
      result.errors.push(`Validation error for ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      return result;
    }
  }

  /**
   * Perform security checks on input value
   */
  private async performSecurityCheck(value: any, fieldName: string): Promise<SecurityCheckResult> {
    const threats: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (typeof value !== 'string') {
      return { isSafe: true, threats: [], riskLevel: 'low' };
    }

    const stringValue = value.toString();

    // Check for SQL injection patterns
    for (const pattern of RequestValidator.SQL_INJECTION_PATTERNS) {
      if (pattern.test(stringValue)) {
        threats.push('SQL injection');
        riskLevel = 'critical';
        break;
      }
    }

    // Check for XSS patterns
    for (const pattern of RequestValidator.XSS_PATTERNS) {
      if (pattern.test(stringValue)) {
        threats.push('Cross-site scripting (XSS)');
        riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
        break;
      }
    }

    // Check for LDAP injection patterns
    for (const pattern of RequestValidator.LDAP_INJECTION_PATTERNS) {
      if (pattern.test(stringValue)) {
        threats.push('LDAP injection');
        riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
        break;
      }
    }

    // Check for other dangerous patterns
    for (const pattern of RequestValidator.COMMON_DANGEROUS_PATTERNS) {
      if (pattern.test(stringValue)) {
        threats.push('Dangerous pattern detected');
        riskLevel = riskLevel === 'critical' ? 'critical' : (riskLevel === 'high' ? 'high' : 'medium');
        break;
      }
    }

    // Check for suspicious length
    if (stringValue.length > 10000) {
      threats.push('Unusually long input');
      riskLevel = riskLevel === 'critical' ? 'critical' : (riskLevel === 'high' ? 'high' : 'medium');
    }

    // Check for null bytes and control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(stringValue)) {
      threats.push('Control characters detected');
      riskLevel = riskLevel === 'critical' ? 'critical' : 'medium';
    }

    return {
      isSafe: threats.length === 0,
      threats,
      riskLevel,
      sanitizedValue: threats.length > 0 ? this.sanitizeString(stringValue, {
        removeHtml: true,
        removeScripts: true,
        normalizeWhitespace: true,
        escapeSpecialChars: true
      }) : stringValue
    };
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string, options: SanitizationOptions): string {
    let sanitized = input;

    // Remove HTML tags
    if (options.removeHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove script content
    if (options.removeScripts) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      sanitized = sanitized.replace(/javascript:/gi, '');
      sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Filter allowed characters
    if (options.allowedChars) {
      sanitized = sanitized.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
    }

    // Escape special characters
    if (options.escapeSpecialChars) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Validate type
   */
  private validateType(value: any, expectedType: string): boolean {
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
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics() {
    return { ...this.validationMetrics };
  }

  /**
   * Get validation health status
   */
  getValidationHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  } {
    const metrics = this.getValidationMetrics();
    const failureRate = metrics.totalValidations > 0 ? 
      (metrics.failedValidations / metrics.totalValidations) * 100 : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (metrics.securityThreats > 10 || failureRate > 25) {
      status = 'critical';
    } else if (metrics.securityThreats > 5 || failureRate > 10) {
      status = 'warning';
    }

    return {
      status,
      details: {
        totalValidations: metrics.totalValidations,
        failureRate: Math.round(failureRate * 100) / 100,
        securityThreats: metrics.securityThreats,
        sanitizations: metrics.sanitizations,
        performanceWarnings: metrics.performanceWarnings
      }
    };
  }

  /**
   * Reset validation metrics
   */
  resetMetrics(): void {
    this.validationMetrics = {
      totalValidations: 0,
      failedValidations: 0,
      sanitizations: 0,
      securityThreats: 0,
      performanceWarnings: 0
    };
  }
}

// Predefined validation schemas for GA4 MCP tools
export const GA4_VALIDATION_SCHEMAS = {
  query_analytics: {
    propertyId: {
      required: true,
      type: 'string' as const,
      pattern: /^\d+$/,
      description: 'GA4 Property ID (numeric string)',
      sanitize: true
    },
    startDate: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      description: 'Start date in YYYY-MM-DD format',
      sanitize: true
    },
    endDate: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      description: 'End date in YYYY-MM-DD format',
      sanitize: true
    },
    metrics: {
      required: true,
      type: 'array' as const,
      description: 'Array of metric names',
      customValidator: (value: any) => {
        if (!Array.isArray(value) || value.length === 0) {
          return { isValid: false, errors: ['At least one metric is required'] };
        }
        return { isValid: true, errors: [] };
      }
    },
    dimensions: {
      type: 'array' as const,
      description: 'Array of dimension names'
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 100000,
      description: 'Maximum number of results to return'
    }
  },

  get_realtime_data: {
    propertyId: {
      required: true,
      type: 'string' as const,
      pattern: /^\d+$/,
      description: 'GA4 Property ID (numeric string)',
      sanitize: true
    },
    metrics: {
      required: true,
      type: 'array' as const,
      description: 'Array of realtime metric names'
    },
    dimensions: {
      type: 'array' as const,
      description: 'Array of realtime dimension names'
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 10000,
      description: 'Maximum number of results to return'
    }
  },

  get_traffic_sources: {
    propertyId: {
      required: true,
      type: 'string' as const,
      pattern: /^\d+$/,
      description: 'GA4 Property ID (numeric string)',
      sanitize: true
    },
    startDate: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      description: 'Start date in YYYY-MM-DD format',
      sanitize: true
    },
    endDate: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      description: 'End date in YYYY-MM-DD format',
      sanitize: true
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 10000,
      description: 'Maximum number of results to return'
    }
  }
} as const;

// Global validator instance
export const requestValidator = new RequestValidator();