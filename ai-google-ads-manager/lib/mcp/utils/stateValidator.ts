/**
 * Component State Validator
 * 
 * Schema-based state validation system for ensuring data integrity
 * and consistency across MCP components with automatic repair capabilities.
 */

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'custom';
  required: boolean;
  validator?: (value: any) => boolean;
  sanitizer?: (value: any) => any;
  defaultValue?: any;
  constraints?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: any[];
  };
}

export interface ValidationSchema {
  name: string;
  version: string;
  rules: ValidationRule[];
  allowAdditionalFields: boolean;
  strictMode: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  repairedState?: any;
  score: number; // 0-100
  metadata: {
    validatedAt: Date;
    schemaUsed: string;
    fieldCount: number;
    repairCount: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
  value?: any;
  expectedType?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
  value?: any;
}

export interface CrossComponentValidation {
  componentId: string;
  dependsOn: string[];
  rules: {
    field: string;
    dependencyField: string;
    relationship: 'equals' | 'greater' | 'less' | 'contains' | 'custom';
    validator?: (value: any, dependencyValue: any) => boolean;
  }[];
}

export interface StateIntegrityCheck {
  componentId: string;
  checksum: string;
  timestamp: Date;
  size: number;
  version: string;
}

/**
 * Component State Validator Manager
 */
export class ComponentStateValidator {
  private schemas: Map<string, ValidationSchema> = new Map();
  private crossComponentRules: Map<string, CrossComponentValidation> = new Map();
  private integrityChecks: Map<string, StateIntegrityCheck> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private repairStrategies: Map<string, (state: any, errors: ValidationError[]) => any> = new Map();

  constructor() {
    this.initializeDefaultSchemas();
    this.initializeDefaultRepairStrategies();
  }

  /**
   * Register validation schema for a component type
   */
  registerSchema(componentType: string, schema: ValidationSchema): void {
    this.schemas.set(componentType, schema);
    console.log(`📋 Validation schema registered for '${componentType}'`);
  }

  /**
   * Validate component state against its schema
   */
  validateState(componentId: string, componentType: string, state: any): ValidationResult {
    const cacheKey = `${componentId}_${this.generateChecksum(state)}`;
    
    // Check cache first
    const cached = this.validationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const schema = this.schemas.get(componentType);
    if (!schema) {
      return this.createEmptyValidationResult('No schema found for component type');
    }

    const result = this.performValidation(state, schema);
    
    // Cache result for performance
    this.validationCache.set(cacheKey, result);
    
    // Clean cache if it gets too large
    if (this.validationCache.size > 1000) {
      const keys = Array.from(this.validationCache.keys());
      keys.slice(0, 500).forEach(key => this.validationCache.delete(key));
    }

    return result;
  }

  /**
   * Validate cross-component state consistency
   */
  validateCrossComponent(
    componentId: string, 
    state: any, 
    dependencyStates: Record<string, any>
  ): ValidationResult {
    
    const crossComponentRule = this.crossComponentRules.get(componentId);
    if (!crossComponentRule) {
      return this.createEmptyValidationResult('No cross-component rules defined', true);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    crossComponentRule.rules.forEach(rule => {
      const dependencyState = dependencyStates[rule.dependencyField];
      if (dependencyState === undefined) {
        errors.push({
          field: rule.field,
          message: `Dependency '${rule.dependencyField}' not found`,
          severity: 'error',
          code: 'MISSING_DEPENDENCY'
        });
        return;
      }

      const isValid = this.validateRelationship(
        state[rule.field], 
        dependencyState, 
        rule.relationship,
        rule.validator
      );

      if (!isValid) {
        errors.push({
          field: rule.field,
          message: `Cross-component validation failed: ${rule.field} ${rule.relationship} ${rule.dependencyField}`,
          severity: 'error',
          code: 'CROSS_COMPONENT_MISMATCH',
          value: state[rule.field]
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: errors.length === 0 ? 100 : Math.max(0, 100 - (errors.length * 20)),
      metadata: {
        validatedAt: new Date(),
        schemaUsed: 'cross-component',
        fieldCount: crossComponentRule.rules.length,
        repairCount: 0
      }
    };
  }

  /**
   * Repair invalid state automatically
   */
  repairState(componentType: string, state: any, validationResult: ValidationResult): any {
    if (validationResult.isValid) {
      return state;
    }

    const repairStrategy = this.repairStrategies.get(componentType);
    if (repairStrategy) {
      return repairStrategy(state, validationResult.errors);
    }

    return this.defaultRepairStrategy(state, validationResult.errors);
  }

  /**
   * Check state integrity using checksums
   */
  checkStateIntegrity(componentId: string, state: any): boolean {
    const currentChecksum = this.generateChecksum(state);
    const lastCheck = this.integrityChecks.get(componentId);

    if (!lastCheck) {
      // First time check - store baseline
      this.integrityChecks.set(componentId, {
        componentId,
        checksum: currentChecksum,
        timestamp: new Date(),
        size: this.calculateStateSize(state),
        version: '1.0'
      });
      return true;
    }

    // Compare with last known good state
    const isIntact = lastCheck.checksum === currentChecksum;
    
    if (!isIntact) {
      console.warn(`⚠️ State integrity check failed for component ${componentId}`);
    }

    // Update check record
    this.integrityChecks.set(componentId, {
      componentId,
      checksum: currentChecksum,
      timestamp: new Date(),
      size: this.calculateStateSize(state),
      version: lastCheck.version
    });

    return isIntact;
  }

  /**
   * Register cross-component validation rules
   */
  registerCrossComponentRules(componentId: string, validation: CrossComponentValidation): void {
    this.crossComponentRules.set(componentId, validation);
    console.log(`🔗 Cross-component rules registered for '${componentId}'`);
  }

  /**
   * Register custom repair strategy
   */
  registerRepairStrategy(
    componentType: string, 
    strategy: (state: any, errors: ValidationError[]) => any
  ): void {
    this.repairStrategies.set(componentType, strategy);
    console.log(`🔧 Repair strategy registered for '${componentType}'`);
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalSchemas: number;
    totalCrossComponentRules: number;
    cacheSize: number;
    integrityChecks: number;
    repairStrategies: number;
  } {
    return {
      totalSchemas: this.schemas.size,
      totalCrossComponentRules: this.crossComponentRules.size,
      cacheSize: this.validationCache.size,
      integrityChecks: this.integrityChecks.size,
      repairStrategies: this.repairStrategies.size
    };
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
    console.log('🗑️ Validation cache cleared');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.schemas.clear();
    this.crossComponentRules.clear();
    this.integrityChecks.clear();
    this.validationCache.clear();
    this.repairStrategies.clear();
  }

  // Private methods

  private performValidation(state: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let repairedState = { ...state };
    let repairCount = 0;

    // Validate each rule
    schema.rules.forEach(rule => {
      const value = state[rule.field];
      const ruleResult = this.validateField(value, rule);
      
      if (ruleResult.error) {
        errors.push(ruleResult.error);
      }
      
      if (ruleResult.warning) {
        warnings.push(ruleResult.warning);
      }

      // Apply repairs
      if (ruleResult.repairedValue !== undefined) {
        repairedState[rule.field] = ruleResult.repairedValue;
        repairCount++;
      }
    });

    // Check for additional fields in strict mode
    if (schema.strictMode && !schema.allowAdditionalFields) {
      const schemaFields = new Set(schema.rules.map(r => r.field));
      Object.keys(state).forEach(field => {
        if (!schemaFields.has(field)) {
          warnings.push({
            field,
            message: 'Unexpected field in strict mode',
            suggestion: 'Remove field or update schema',
            value: state[field]
          });
        }
      });
    }

    const score = this.calculateValidationScore(errors, warnings, schema.rules.length);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      repairedState: repairCount > 0 ? repairedState : undefined,
      score,
      metadata: {
        validatedAt: new Date(),
        schemaUsed: schema.name,
        fieldCount: schema.rules.length,
        repairCount
      }
    };
  }

  private validateField(value: any, rule: ValidationRule): {
    error?: ValidationError;
    warning?: ValidationWarning;
    repairedValue?: any;
  } {
    
    // Check if field is required
    if (rule.required && (value === undefined || value === null)) {
      return {
        error: {
          field: rule.field,
          message: 'Required field is missing',
          severity: 'error',
          code: 'REQUIRED_FIELD_MISSING',
          expectedType: rule.type
        },
        repairedValue: rule.defaultValue
      };
    }

    // Skip validation for optional missing fields
    if (!rule.required && (value === undefined || value === null)) {
      return {};
    }

    // Type validation
    const typeValid = this.validateType(value, rule.type);
    if (!typeValid) {
      const sanitized = rule.sanitizer ? rule.sanitizer(value) : undefined;
      return {
        error: {
          field: rule.field,
          message: `Invalid type. Expected ${rule.type}, got ${typeof value}`,
          severity: 'error',
          code: 'TYPE_MISMATCH',
          value,
          expectedType: rule.type
        },
        repairedValue: sanitized || rule.defaultValue
      };
    }

    // Constraint validation
    if (rule.constraints) {
      const constraintResult = this.validateConstraints(value, rule.constraints);
      if (constraintResult.error) {
        return constraintResult;
      }
    }

    // Custom validator
    if (rule.validator && !rule.validator(value)) {
      return {
        error: {
          field: rule.field,
          message: 'Custom validation failed',
          severity: 'error',
          code: 'CUSTOM_VALIDATION_FAILED',
          value
        }
      };
    }

    return {};
  }

  private validateType(value: any, expectedType: ValidationRule['type']): boolean {
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
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'custom':
        return true; // Custom types are validated by custom validators
      default:
        return false;
    }
  }

  private validateConstraints(value: any, constraints: ValidationRule['constraints']): {
    error?: ValidationError;
    warning?: ValidationWarning;
  } {
    
    if (!constraints) return {};

    // Numeric constraints
    if (typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        return {
          error: {
            field: '',
            message: `Value ${value} is below minimum ${constraints.min}`,
            severity: 'error',
            code: 'VALUE_TOO_SMALL',
            value
          }
        };
      }
      
      if (constraints.max !== undefined && value > constraints.max) {
        return {
          error: {
            field: '',
            message: `Value ${value} is above maximum ${constraints.max}`,
            severity: 'error',
            code: 'VALUE_TOO_LARGE',
            value
          }
        };
      }
    }

    // String length constraints
    if (typeof value === 'string' || Array.isArray(value)) {
      const length = value.length;
      
      if (constraints.minLength !== undefined && length < constraints.minLength) {
        return {
          error: {
            field: '',
            message: `Length ${length} is below minimum ${constraints.minLength}`,
            severity: 'error',
            code: 'LENGTH_TOO_SHORT',
            value
          }
        };
      }
      
      if (constraints.maxLength !== undefined && length > constraints.maxLength) {
        return {
          error: {
            field: '',
            message: `Length ${length} is above maximum ${constraints.maxLength}`,
            severity: 'error',
            code: 'LENGTH_TOO_LONG',
            value
          }
        };
      }
    }

    // Pattern constraint for strings
    if (typeof value === 'string' && constraints.pattern) {
      if (!constraints.pattern.test(value)) {
        return {
          error: {
            field: '',
            message: `Value does not match required pattern`,
            severity: 'error',
            code: 'PATTERN_MISMATCH',
            value
          }
        };
      }
    }

    // Enum constraint
    if (constraints.enum && !constraints.enum.includes(value)) {
      return {
        error: {
          field: '',
          message: `Value is not in allowed enum: ${constraints.enum.join(', ')}`,
          severity: 'error',
          code: 'ENUM_MISMATCH',
          value
        }
      };
    }

    return {};
  }

  private validateRelationship(
    value: any, 
    dependencyValue: any, 
    relationship: CrossComponentValidation['rules'][0]['relationship'],
    customValidator?: (value: any, dependencyValue: any) => boolean
  ): boolean {
    
    if (customValidator) {
      return customValidator(value, dependencyValue);
    }

    switch (relationship) {
      case 'equals':
        return value === dependencyValue;
      case 'greater':
        return value > dependencyValue;
      case 'less':
        return value < dependencyValue;
      case 'contains':
        if (Array.isArray(dependencyValue)) {
          return dependencyValue.includes(value);
        }
        if (typeof dependencyValue === 'string') {
          return dependencyValue.includes(value);
        }
        return false;
      default:
        return false;
    }
  }

  private calculateValidationScore(
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    totalFields: number
  ): number {
    if (totalFields === 0) return 100;
    
    const errorPenalty = errors.length * 20;
    const warningPenalty = warnings.length * 5;
    
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }

  private defaultRepairStrategy(state: any, errors: ValidationError[]): any {
    const repairedState = { ...state };
    
    errors.forEach(error => {
      if (error.code === 'REQUIRED_FIELD_MISSING') {
        // Set default values for missing required fields
        repairedState[error.field] = this.getDefaultValueForType(error.expectedType);
      } else if (error.code === 'TYPE_MISMATCH') {
        // Attempt type coercion
        repairedState[error.field] = this.coerceType(error.value, error.expectedType);
      }
    });

    return repairedState;
  }

  private getDefaultValueForType(type?: string): any {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      case 'date': return new Date();
      default: return null;
    }
  }

  private coerceType(value: any, targetType?: string): any {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : {};
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  private generateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private calculateStateSize(state: any): number {
    try {
      return JSON.stringify(state).length;
    } catch {
      return 0;
    }
  }

  private createEmptyValidationResult(message: string, isValid: boolean = false): ValidationResult {
    return {
      isValid,
      errors: isValid ? [] : [{
        field: 'schema',
        message,
        severity: 'error',
        code: 'SCHEMA_ERROR'
      }],
      warnings: [],
      score: isValid ? 100 : 0,
      metadata: {
        validatedAt: new Date(),
        schemaUsed: 'none',
        fieldCount: 0,
        repairCount: 0
      }
    };
  }

  private initializeDefaultSchemas(): void {
    // Dashboard state schema
    this.registerSchema('dashboard', {
      name: 'Dashboard State',
      version: '1.0',
      allowAdditionalFields: true,
      strictMode: false,
      rules: [
        { field: 'dateRange', type: 'object', required: true },
        { field: 'filters', type: 'object', required: true },
        { field: 'loading', type: 'object', required: true },
        { field: 'data', type: 'object', required: false }
      ]
    });

    // Widget state schema
    this.registerSchema('widget', {
      name: 'Widget State',
      version: '1.0',
      allowAdditionalFields: true,
      strictMode: false,
      rules: [
        { field: 'id', type: 'string', required: true },
        { field: 'type', type: 'string', required: true },
        { field: 'data', type: 'object', required: false },
        { field: 'loading', type: 'boolean', required: true, defaultValue: false },
        { field: 'error', type: 'string', required: false }
      ]
    });
  }

  private initializeDefaultRepairStrategies(): void {
    // Dashboard repair strategy
    this.registerRepairStrategy('dashboard', (state, errors) => {
      const repaired = { ...state };
      
      errors.forEach(error => {
        switch (error.field) {
          case 'dateRange':
            repaired.dateRange = {
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0]
            };
            break;
          case 'filters':
            repaired.filters = {
              highlightGoogleAds: false,
              trafficSources: [],
              deviceCategories: [],
              customFilters: {}
            };
            break;
          case 'loading':
            repaired.loading = {};
            break;
        }
      });

      return repaired;
    });
  }
}

// Singleton instance for global use
export const componentStateValidator = new ComponentStateValidator();

export default componentStateValidator;