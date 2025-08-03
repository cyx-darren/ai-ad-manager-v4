/**
 * Base Adapter Implementation
 * 
 * This file provides the abstract base class that all specific adapters extend.
 * It includes common functionality for validation, error handling, and performance monitoring.
 */

import { 
  BaseAdapter as IBaseAdapter,
  AdapterMetadata, 
  AdapterConfig, 
  ValidationResult,
  AdapterError,
  ErrorStrategy,
  AdapterPerformanceMetrics
} from './types';
import { ValidationEngine, ValidationSchema } from './ValidationSchemas';
import { DataSanitizer, SanitizationConfig, SanitizationResult } from './DataSanitizer';

/**
 * Extended adapter configuration with validation and sanitization options
 */
export interface ExtendedAdapterConfig extends AdapterConfig {
  enableSanitization?: boolean;
  sanitizationConfig?: SanitizationConfig;
  validationSchema?: ValidationSchema;
  strictValidation?: boolean;
  sanitizeBeforeValidation?: boolean;
}

/**
 * Abstract base adapter class with common functionality
 */
export abstract class BaseAdapter<TInput, TOutput> implements IBaseAdapter<TInput, TOutput> {
  protected config: ExtendedAdapterConfig;
  protected performanceMetrics: AdapterPerformanceMetrics;
  protected validator: ValidationEngine;
  protected sanitizer: DataSanitizer;

  constructor(config: ExtendedAdapterConfig = {}) {
    this.config = {
      enableValidation: true,
      enableErrorLogging: true,
      fallbackToDefault: true,
      debugMode: false,
      enableSanitization: true,
      strictValidation: false,
      sanitizeBeforeValidation: true,
      ...config
    };

    this.performanceMetrics = {
      transformationCount: 0,
      averageTransformationTime: 0,
      totalTransformationTime: 0,
      errorCount: 0,
      successRate: 100,
      lastTransformationTime: 0
    };

    // Initialize validation and sanitization
    this.validator = ValidationEngine.getInstance();
    this.sanitizer = config.sanitizationConfig ? 
      new DataSanitizer(config.sanitizationConfig) : 
      DataSanitizer.getDefault();
  }

  /**
   * Main transformation method with error handling and performance tracking
   */
  public transform(input: TInput): TOutput {
    const startTime = Date.now();
    let processedInput = input;

    try {
      // Phase 4: Sanitize input first if enabled
      if (this.config.enableSanitization && this.config.sanitizeBeforeValidation) {
        const sanitizationResult = this.sanitizeInput(input);
        processedInput = sanitizationResult.sanitized;
        
        if (this.config.debugMode && sanitizationResult.changes.length > 0) {
          console.log(`[${this.getMetadata().name}] Sanitization applied:`, {
            changes: sanitizationResult.changes,
            warnings: sanitizationResult.warnings
          });
        }
      }

      // Phase 4: Enhanced validation with detailed reporting
      if (this.config.enableValidation) {
        const validationResult = this.validateInputDetailed(processedInput);
        
        if (!validationResult.isValid) {
          if (this.config.strictValidation) {
            throw new AdapterError(
              `Input validation failed: ${validationResult.errors.join(', ')}`,
              this.getMetadata().name,
              processedInput
            );
          } else if (this.config.debugMode) {
            console.warn(`[${this.getMetadata().name}] Validation warnings:`, validationResult.errors);
          }
        }
      }

      // Phase 4: Sanitize after validation if configured differently
      if (this.config.enableSanitization && !this.config.sanitizeBeforeValidation) {
        const sanitizationResult = this.sanitizeInput(processedInput);
        processedInput = sanitizationResult.sanitized;
      }

      // Perform the actual transformation
      const result = this.transformImplementation(processedInput);

      // Update performance metrics
      this.updateSuccessMetrics(Date.now() - startTime);

      if (this.config.debugMode) {
        console.log(`[${this.getMetadata().name}] Transformation successful`, {
          input: processedInput,
          output: result,
          duration: Date.now() - startTime
        });
      }

      return result;

    } catch (error) {
      // Update error metrics
      this.updateErrorMetrics(Date.now() - startTime);

      // Log error if enabled
      if (this.config.enableErrorLogging) {
        console.error(`[${this.getMetadata().name}] Transformation failed:`, error);
      }

      // Handle error based on strategy
      return this.handleError(error as Error);
    }
  }

  /**
   * Abstract method that subclasses must implement for actual transformation logic
   */
  protected abstract transformImplementation(input: TInput): TOutput;

  /**
   * Validate input data - can be overridden by subclasses
   */
  public validate(input: TInput): boolean {
    // Basic null/undefined check
    if (input === null || input === undefined) {
      return false;
    }

    // Delegate to subclass implementation
    return this.validateInput(input);
  }

  /**
   * Subclass-specific validation logic
   */
  protected abstract validateInput(input: TInput): boolean;

  /**
   * Get validation details - can be overridden for more detailed validation
   */
  public getValidationResult(input: TInput): ValidationResult {
    const isValid = this.validate(input);
    
    if (isValid) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    }

    return {
      isValid: false,
      errors: ['Input validation failed'],
      warnings: []
    };
  }

  /**
   * Handle errors gracefully
   */
  public handleError(error: Error): TOutput {
    const adapterError = error instanceof AdapterError 
      ? error 
      : new AdapterError(error.message, this.getMetadata().name, undefined, error);

    // Return default output if configured to do so
    if (this.config.fallbackToDefault) {
      return this.getDefaultOutput();
    }

    // Otherwise re-throw the error
    throw adapterError;
  }

  /**
   * Get default/fallback output - must be implemented by subclasses
   */
  public abstract getDefaultOutput(): TOutput;

  /**
   * Get adapter metadata - must be implemented by subclasses
   */
  public abstract getMetadata(): AdapterMetadata;

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): AdapterPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.performanceMetrics = {
      transformationCount: 0,
      averageTransformationTime: 0,
      totalTransformationTime: 0,
      errorCount: 0,
      successRate: 100,
      lastTransformationTime: 0
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AdapterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): AdapterConfig {
    return { ...this.config };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Update metrics after successful transformation
   */
  private updateSuccessMetrics(duration: number): void {
    this.performanceMetrics.transformationCount++;
    this.performanceMetrics.totalTransformationTime += duration;
    this.performanceMetrics.averageTransformationTime = 
      this.performanceMetrics.totalTransformationTime / this.performanceMetrics.transformationCount;
    this.performanceMetrics.lastTransformationTime = duration;
    
    // Update success rate
    const totalAttempts = this.performanceMetrics.transformationCount + this.performanceMetrics.errorCount;
    this.performanceMetrics.successRate = 
      (this.performanceMetrics.transformationCount / totalAttempts) * 100;
  }

  /**
   * Update metrics after failed transformation
   */
  private updateErrorMetrics(duration: number): void {
    this.performanceMetrics.errorCount++;
    this.performanceMetrics.lastTransformationTime = duration;
    
    // Update success rate
    const totalAttempts = this.performanceMetrics.transformationCount + this.performanceMetrics.errorCount;
    this.performanceMetrics.successRate = 
      (this.performanceMetrics.transformationCount / totalAttempts) * 100;
  }

  // ============================================================================
  // PHASE 4: VALIDATION & SANITIZATION METHODS
  // ============================================================================

  /**
   * Phase 4: Sanitize input data for security and consistency
   */
  protected sanitizeInput(input: TInput): SanitizationResult<TInput> {
    return this.sanitizer.sanitize(input);
  }

  /**
   * Phase 4: Enhanced validation with detailed reporting
   */
  protected validateInputDetailed(input: TInput): ValidationResult {
    // Use schema validation if available
    if (this.config.validationSchema) {
      return this.validator.validate(input, this.config.validationSchema);
    }
    
    // Fall back to the adapter's validate method
    const isValid = this.validate(input);
    return {
      isValid,
      errors: isValid ? [] : ['Basic validation failed'],
      warnings: [],
      details: {
        errorCount: isValid ? 0 : 1,
        warningCount: 0,
        criticalErrors: isValid ? 0 : 1
      }
    };
  }

  /**
   * Phase 4: Get validation schema for this adapter (override in subclasses)
   */
  protected getValidationSchema(): ValidationSchema | null {
    return this.config.validationSchema || null;
  }

  /**
   * Phase 4: Get sanitization configuration for this adapter (override in subclasses)
   */
  protected getSanitizationConfig(): SanitizationConfig | null {
    return this.config.sanitizationConfig || null;
  }
}

/**
 * Utility function to create adapter instances with consistent error handling
 */
export function createAdapterInstance<TInput, TOutput>(
  AdapterClass: new (config?: AdapterConfig) => BaseAdapter<TInput, TOutput>,
  config?: AdapterConfig
): BaseAdapter<TInput, TOutput> {
  try {
    return new AdapterClass(config);
  } catch (error) {
    throw new AdapterError(
      `Failed to create adapter instance: ${error.message}`,
      AdapterClass.name,
      config,
      error as Error
    );
  }
}

/**
 * Utility function to safely transform data with fallback
 */
export function safeTransform<TInput, TOutput>(
  adapter: BaseAdapter<TInput, TOutput>,
  input: TInput,
  fallback?: TOutput
): TOutput {
  try {
    return adapter.transform(input);
  } catch (error) {
    console.warn(`Adapter transformation failed, using fallback:`, error);
    return fallback || adapter.getDefaultOutput();
  }
}