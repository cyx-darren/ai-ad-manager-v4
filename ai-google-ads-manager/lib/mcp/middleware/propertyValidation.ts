/**
 * Property Validation Middleware
 * 
 * Comprehensive middleware for validating property access, permissions,
 * and context for all MCP requests.
 */

import { GA4Property, PropertyAccessLevel, PropertyPermission, PropertyError } from '../types/property';
import { useSelectedProperty } from '../context/PropertyContext';

// Middleware configuration types
export interface PropertyValidationConfig {
  strictMode?: boolean;
  requirePropertySelection?: boolean;
  allowFallbackProperty?: boolean;
  cacheValidationResults?: boolean;
  logValidationEvents?: boolean;
  defaultPropertyId?: string;
}

export interface PropertyValidationContext {
  propertyId: string;
  property: GA4Property;
  accessLevel: PropertyAccessLevel;
  permissions: PropertyPermission[];
  validatedAt: Date;
  userId?: string;
  requestId?: string;
}

export interface PropertyValidationResult {
  isValid: boolean;
  context?: PropertyValidationContext;
  errors: PropertyError[];
  warnings: string[];
  metadata: {
    validationDuration: number;
    cacheHit: boolean;
    fallbackUsed: boolean;
  };
}

export interface PropertyOperation {
  type: 'READ' | 'WRITE' | 'ADMIN';
  resource: string;
  description: string;
  requiredPermissions: PropertyPermission[];
}

// Predefined operations and their requirements
export const PROPERTY_OPERATIONS = {
  // Analytics Read Operations
  READ_ANALYTICS_DATA: {
    type: 'READ' as const,
    resource: 'analytics.data',
    description: 'Read analytics data and reports',
    requiredPermissions: ['READ_ONLY', 'EDIT'] as PropertyPermission[]
  },
  READ_ANALYTICS_REPORTS: {
    type: 'READ' as const,
    resource: 'analytics.reports',
    description: 'Access analytics reports',
    requiredPermissions: ['READ_ONLY', 'EDIT'] as PropertyPermission[]
  },
  READ_ANALYTICS_REALTIME: {
    type: 'READ' as const,
    resource: 'analytics.realtime',
    description: 'Access real-time analytics data',
    requiredPermissions: ['READ_ONLY', 'EDIT'] as PropertyPermission[]
  },

  // Analytics Write Operations
  MODIFY_ANALYTICS_CONFIG: {
    type: 'WRITE' as const,
    resource: 'analytics.config',
    description: 'Modify analytics configuration',
    requiredPermissions: ['EDIT'] as PropertyPermission[]
  },
  CREATE_ANALYTICS_REPORTS: {
    type: 'WRITE' as const,
    resource: 'analytics.reports',
    description: 'Create custom analytics reports',
    requiredPermissions: ['EDIT'] as PropertyPermission[]
  },

  // Admin Operations
  MANAGE_PROPERTY_USERS: {
    type: 'ADMIN' as const,
    resource: 'property.users',
    description: 'Manage property user access',
    requiredPermissions: ['EDIT'] as PropertyPermission[]
  },
  MODIFY_PROPERTY_SETTINGS: {
    type: 'ADMIN' as const,
    resource: 'property.settings',
    description: 'Modify property settings',
    requiredPermissions: ['EDIT'] as PropertyPermission[]
  }
} as const;

export type PropertyOperationType = keyof typeof PROPERTY_OPERATIONS;

// Validation cache for performance
class PropertyValidationCache {
  private cache = new Map<string, { result: PropertyValidationResult; expiresAt: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): PropertyValidationResult | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      entry.result.metadata.cacheHit = true;
      return entry.result;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  set(key: string, result: PropertyValidationResult): void {
    this.cache.set(key, {
      result: { ...result, metadata: { ...result.metadata, cacheHit: false } },
      expiresAt: Date.now() + this.TTL
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global validation cache instance
const validationCache = new PropertyValidationCache();

/**
 * Property validation middleware class
 */
export class PropertyValidationMiddleware {
  private config: Required<PropertyValidationConfig>;
  private validationHistory: Array<{
    timestamp: Date;
    propertyId: string;
    operation: string;
    success: boolean;
    duration: number;
  }> = [];

  constructor(config: PropertyValidationConfig = {}) {
    this.config = {
      strictMode: config.strictMode ?? true,
      requirePropertySelection: config.requirePropertySelection ?? true,
      allowFallbackProperty: config.allowFallbackProperty ?? true,
      cacheValidationResults: config.cacheValidationResults ?? true,
      logValidationEvents: config.logValidationEvents ?? true,
      defaultPropertyId: config.defaultPropertyId || process.env.NEXT_PUBLIC_GA4_PROPERTY_ID || ''
    };
  }

  /**
   * Validate property access for a specific operation
   */
  async validatePropertyOperation(
    operation: PropertyOperationType,
    propertyId?: string,
    requestId?: string
  ): Promise<PropertyValidationResult> {
    const startTime = Date.now();
    const operationDef = PROPERTY_OPERATIONS[operation];

    try {
      // Check cache first
      const cacheKey = `${propertyId || 'current'}_${operation}_${requestId || 'no-request'}`;
      if (this.config.cacheValidationResults) {
        const cached = validationCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Resolve property ID and get property details
      const { resolvedPropertyId, property } = await this.resolveProperty(propertyId);

      // Create validation result
      const result: PropertyValidationResult = {
        isValid: false,
        errors: [],
        warnings: [],
        metadata: {
          validationDuration: 0,
          cacheHit: false,
          fallbackUsed: !!propertyId && propertyId !== resolvedPropertyId
        }
      };

      // Validate property exists and is accessible
      if (!property) {
        result.errors.push({
          code: 'PROPERTY_NOT_FOUND',
          message: `Property ${resolvedPropertyId} not found or not accessible`,
          propertyId: resolvedPropertyId,
          suggestedAction: 'Verify property ID and ensure you have access to this property'
        });
        return this.finalizeResult(result, startTime, cacheKey);
      }

      // Check property status
      if (property.status !== 'ACTIVE') {
        result.errors.push({
          code: 'PROPERTY_INACTIVE',
          message: `Property ${resolvedPropertyId} is not active (status: ${property.status})`,
          propertyId: resolvedPropertyId,
          suggestedAction: 'Contact property administrator to activate the property'
        });
        return this.finalizeResult(result, startTime, cacheKey);
      }

      // Validate permissions
      const hasRequiredPermissions = this.validatePermissions(
        property.accessLevel,
        operationDef.requiredPermissions,
        result
      );

      if (!hasRequiredPermissions && this.config.strictMode) {
        result.errors.push({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Insufficient permissions for operation ${operation}. Required: ${operationDef.requiredPermissions.join(' or ')}, Current: ${property.accessLevel}`,
          propertyId: resolvedPropertyId,
          suggestedAction: 'Request elevated permissions or contact property administrator'
        });
        return this.finalizeResult(result, startTime, cacheKey);
      }

      // Create validation context
      result.context = {
        propertyId: resolvedPropertyId,
        property,
        accessLevel: property.accessLevel,
        permissions: property.permissions || [],
        validatedAt: new Date(),
        userId: this.getCurrentUserId(),
        requestId
      };

      result.isValid = true;

      // Add warnings for non-strict mode
      if (!hasRequiredPermissions && !this.config.strictMode) {
        result.warnings.push(
          `Operation ${operation} executed with limited permissions. Some features may not be available.`
        );
      }

      return this.finalizeResult(result, startTime, cacheKey);

    } catch (error) {
      const result: PropertyValidationResult = {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `Property validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          propertyId: propertyId || 'unknown',
          suggestedAction: 'Check your connection and try again'
        }],
        warnings: [],
        metadata: {
          validationDuration: Date.now() - startTime,
          cacheHit: false,
          fallbackUsed: false
        }
      };

      return result;
    }
  }

  /**
   * Resolve property ID from various sources
   */
  private async resolveProperty(propertyId?: string): Promise<{
    resolvedPropertyId: string;
    property: GA4Property | null;
  }> {
    let resolvedPropertyId = propertyId;
    let property: GA4Property | null = null;

    // Try to get from React context if no property ID provided
    if (!resolvedPropertyId) {
      try {
        const { selectedProperty } = useSelectedProperty();
        if (selectedProperty) {
          resolvedPropertyId = selectedProperty.id;
          property = selectedProperty;
        }
      } catch (error) {
        // Context not available (e.g., server-side)
        console.warn('Property context not available:', error);
      }
    }

    // Fallback to default property
    if (!resolvedPropertyId && this.config.allowFallbackProperty) {
      resolvedPropertyId = this.config.defaultPropertyId;
    }

    // Validate property selection requirement
    if (!resolvedPropertyId && this.config.requirePropertySelection) {
      throw new Error('Property selection is required but no property ID was provided or found in context');
    }

    if (!resolvedPropertyId) {
      throw new Error('No property ID available for validation');
    }

    // Fetch property details if not already available
    if (!property) {
      try {
        const { PropertyDiscoveryService } = await import('../utils/propertyDiscovery');
        const discoveryService = new PropertyDiscoveryService();
        property = await discoveryService.fetchGA4Property(resolvedPropertyId);
      } catch (error) {
        console.error(`Failed to fetch property ${resolvedPropertyId}:`, error);
      }
    }

    return { resolvedPropertyId, property };
  }

  /**
   * Validate permissions for operation
   */
  private validatePermissions(
    currentAccessLevel: PropertyAccessLevel,
    requiredPermissions: PropertyPermission[],
    result: PropertyValidationResult
  ): boolean {
    const hasPermission = requiredPermissions.some(permission => {
      switch (permission) {
        case 'READ_ONLY':
          return ['READ_ONLY', 'EDIT'].includes(currentAccessLevel);
        case 'EDIT':
          return currentAccessLevel === 'EDIT';
        case 'NO_ACCESS':
          return false;
        default:
          return false;
      }
    });

    if (!hasPermission) {
      result.warnings.push(
        `Current access level (${currentAccessLevel}) may not be sufficient for all features`
      );
    }

    return hasPermission;
  }

  /**
   * Finalize validation result
   */
  private finalizeResult(
    result: PropertyValidationResult,
    startTime: number,
    cacheKey: string
  ): PropertyValidationResult {
    result.metadata.validationDuration = Date.now() - startTime;

    // Cache result if enabled
    if (this.config.cacheValidationResults) {
      validationCache.set(cacheKey, result);
    }

    // Log validation event
    if (this.config.logValidationEvents) {
      this.logValidationEvent(result);
    }

    return result;
  }

  /**
   * Log validation event
   */
  private logValidationEvent(result: PropertyValidationResult): void {
    const event = {
      timestamp: new Date(),
      propertyId: result.context?.propertyId || 'unknown',
      operation: 'validation',
      success: result.isValid,
      duration: result.metadata.validationDuration
    };

    this.validationHistory.push(event);

    // Keep only last 100 events
    if (this.validationHistory.length > 100) {
      this.validationHistory.shift();
    }

    if (this.config.logValidationEvents) {
      console.log(`🔒 Property validation: ${result.isValid ? '✅' : '❌'}`, {
        propertyId: event.propertyId,
        duration: `${event.duration}ms`,
        errors: result.errors.length,
        warnings: result.warnings.length
      });
    }
  }

  /**
   * Get current user ID (placeholder implementation)
   */
  private getCurrentUserId(): string | undefined {
    // This would integrate with your auth system
    try {
      return 'current-user'; // Replace with actual user ID logic
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    const recentEvents = this.validationHistory.filter(
      event => Date.now() - event.timestamp.getTime() < 60000 // Last minute
    );

    return {
      totalValidations: this.validationHistory.length,
      recentValidations: recentEvents.length,
      successRate: this.validationHistory.length > 0 
        ? this.validationHistory.filter(e => e.success).length / this.validationHistory.length 
        : 0,
      averageDuration: this.validationHistory.length > 0
        ? this.validationHistory.reduce((sum, e) => sum + e.duration, 0) / this.validationHistory.length
        : 0,
      cacheSize: validationCache.size(),
      config: this.config
    };
  }

  /**
   * Clear validation cache and history
   */
  clearCache(): void {
    validationCache.clear();
    this.validationHistory = [];
  }
}

// Create default middleware instance
export const defaultPropertyValidation = new PropertyValidationMiddleware();

// Convenience function for operation validation
export async function validatePropertyOperation(
  operation: PropertyOperationType,
  propertyId?: string,
  requestId?: string
): Promise<PropertyValidationResult> {
  return defaultPropertyValidation.validatePropertyOperation(operation, propertyId, requestId);
}

// Higher-order function for wrapping API calls with property validation
export function withPropertyValidation<T extends any[], R>(
  operation: PropertyOperationType,
  apiFunction: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    // Extract property ID from args if available (assuming first arg might contain it)
    const propertyId = args.length > 0 && typeof args[0] === 'object' && args[0] !== null 
      ? (args[0] as any).propertyId 
      : undefined;

    const validation = await validatePropertyOperation(operation, propertyId);
    
    if (!validation.isValid) {
      throw new Error(`Property validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Log successful validation
    console.log(`✅ Property validation passed for ${operation}`, {
      propertyId: validation.context?.propertyId,
      duration: `${validation.metadata.validationDuration}ms`
    });

    return apiFunction(...args);
  };
}

export default PropertyValidationMiddleware;