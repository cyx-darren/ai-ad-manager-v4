/**
 * Property-Aware GA4 Service
 * 
 * Enhanced GA4 API service that supports multi-property operations with
 * property validation, permission checking, and request context management.
 */

import { GA4Property, PropertyAccessLevel } from '../types/property';
import { useSelectedProperty } from '../context/PropertyContext';
import { DashboardDataService, GA4ApiClient, SessionMetrics, TrafficSource, PagePerformance, ConversionData, ApiResponse } from '@/lib/ga4ApiClient';

// Enhanced request interfaces with property context
export interface PropertyAwareRequest {
  propertyId?: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  limit?: number;
  validatePermissions?: boolean;
  bypassCache?: boolean;
}

export interface PropertyRequestContext {
  propertyId: string;
  accessLevel: PropertyAccessLevel;
  permissions: string[];
  userId?: string;
  sessionId?: string;
}

export interface PropertyValidationResult {
  isValid: boolean;
  propertyId: string;
  accessLevel: PropertyAccessLevel;
  hasRequiredPermissions: boolean;
  errors: string[];
  warnings: string[];
}

export interface PropertyAwareResponse<T = any> extends ApiResponse<T> {
  propertyContext: {
    propertyId: string;
    propertyName: string;
    accessLevel: PropertyAccessLevel;
    requestTimestamp: string;
    cacheHit?: boolean;
  };
}

// Property permission constants
export const REQUIRED_PERMISSIONS = {
  READ_ANALYTICS: ['READ_ONLY', 'EDIT'],
  WRITE_ANALYTICS: ['EDIT'],
  ADMIN_ANALYTICS: ['EDIT']
} as const;

// Property validation errors
export class PropertyValidationError extends Error {
  constructor(
    message: string,
    public propertyId: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PropertyValidationError';
  }
}

export class PropertyPermissionError extends Error {
  constructor(
    message: string,
    public propertyId: string,
    public requiredPermission: string,
    public currentAccessLevel: PropertyAccessLevel
  ) {
    super(message);
    this.name = 'PropertyPermissionError';
  }
}

/**
 * Property validation middleware for GA4 requests
 */
export class PropertyValidationService {
  /**
   * Validate property access for a given request
   */
  static async validatePropertyAccess(
    propertyId: string,
    requiredPermission: keyof typeof REQUIRED_PERMISSIONS,
    context?: Partial<PropertyRequestContext>
  ): Promise<PropertyValidationResult> {
    const result: PropertyValidationResult = {
      isValid: false,
      propertyId,
      accessLevel: 'NO_ACCESS',
      hasRequiredPermissions: false,
      errors: [],
      warnings: []
    };

    try {
      // Get property from cache or discovery service
      const { PropertyDiscoveryService } = await import('../utils/propertyDiscovery');
      const { PropertyValidationService } = await import('../utils/propertyValidation');
      
      const discoveryService = new PropertyDiscoveryService();
      const validationService = new PropertyValidationService();

      // Fetch property details
      const property = await discoveryService.fetchGA4Property(propertyId);
      if (!property) {
        result.errors.push(`Property ${propertyId} not found or not accessible`);
        return result;
      }

      // Validate property permissions
      const permissionCheck = validationService.checkPropertyPermissions(
        property,
        REQUIRED_PERMISSIONS[requiredPermission],
        context?.accessLevel || property.accessLevel
      );

      result.accessLevel = property.accessLevel;
      result.hasRequiredPermissions = permissionCheck.isValid;
      result.isValid = permissionCheck.isValid && property.status === 'ACTIVE';

      if (!permissionCheck.isValid) {
        result.errors.push(...permissionCheck.errors);
      }

      if (property.status !== 'ACTIVE') {
        result.errors.push(`Property ${propertyId} is not active (status: ${property.status})`);
      }

      return result;

    } catch (error) {
      result.errors.push(`Property validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Create property request context
   */
  static createPropertyContext(
    propertyId: string,
    property: GA4Property,
    userId?: string
  ): PropertyRequestContext {
    return {
      propertyId,
      accessLevel: property.accessLevel,
      permissions: property.permissions || [],
      userId,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
}

/**
 * Enhanced GA4 API service with property awareness
 */
export class PropertyAwareGA4Service extends DashboardDataService {
  private propertyCache = new Map<string, GA4Property>();
  private validationCache = new Map<string, PropertyValidationResult>();
  private requestQueue = new Map<string, Promise<any>>();

  constructor() {
    super(''); // Empty property ID since we'll use dynamic ones
  }

  /**
   * Get current property from context or fallback
   */
  private async getCurrentProperty(): Promise<GA4Property | null> {
    try {
      // Try to get from React context
      const { useSelectedProperty } = await import('../context/PropertyContext');
      const { selectedProperty } = useSelectedProperty();
      return selectedProperty;
    } catch (error) {
      // Fallback to environment or default
      const defaultPropertyId = process.env.NEXT_PUBLIC_GA4_PROPERTY_ID;
      if (defaultPropertyId) {
        return this.getPropertyById(defaultPropertyId);
      }
      return null;
    }
  }

  /**
   * Get property by ID with caching
   */
  private async getPropertyById(propertyId: string): Promise<GA4Property | null> {
    if (this.propertyCache.has(propertyId)) {
      return this.propertyCache.get(propertyId)!;
    }

    try {
      const { PropertyDiscoveryService } = await import('../utils/propertyDiscovery');
      const discoveryService = new PropertyDiscoveryService();
      const property = await discoveryService.fetchGA4Property(propertyId);
      
      if (property) {
        this.propertyCache.set(propertyId, property);
      }
      
      return property;
    } catch (error) {
      console.error(`Failed to fetch property ${propertyId}:`, error);
      return null;
    }
  }

  /**
   * Validate and execute property-aware request
   */
  private async executeWithPropertyValidation<T>(
    request: PropertyAwareRequest,
    operation: (propertyId: string, context: PropertyRequestContext) => Promise<T>,
    requiredPermission: keyof typeof REQUIRED_PERMISSIONS = 'READ_ANALYTICS'
  ): Promise<PropertyAwareResponse<T>> {
    // Determine property ID
    let propertyId = request.propertyId;
    let property: GA4Property | null = null;

    if (!propertyId) {
      property = await this.getCurrentProperty();
      propertyId = property?.id;
    }

    if (!propertyId) {
      throw new PropertyValidationError(
        'No property ID specified and no property selected in context',
        'unknown',
        'MISSING_PROPERTY_ID'
      );
    }

    // Get property details if not already fetched
    if (!property) {
      property = await this.getPropertyById(propertyId);
    }

    if (!property) {
      throw new PropertyValidationError(
        `Property ${propertyId} not found or not accessible`,
        propertyId,
        'PROPERTY_NOT_FOUND'
      );
    }

    // Validate permissions if requested
    if (request.validatePermissions !== false) {
      const cacheKey = `${propertyId}_${requiredPermission}`;
      let validation = this.validationCache.get(cacheKey);

      if (!validation || Date.now() - validation.propertyId.length > 300000) { // 5 minutes cache
        validation = await PropertyValidationService.validatePropertyAccess(
          propertyId,
          requiredPermission
        );
        this.validationCache.set(cacheKey, validation);
      }

      if (!validation.isValid) {
        throw new PropertyPermissionError(
          `Insufficient permissions for property ${propertyId}: ${validation.errors.join(', ')}`,
          propertyId,
          requiredPermission,
          property.accessLevel
        );
      }
    }

    // Create request context
    const context = PropertyValidationService.createPropertyContext(propertyId, property);

    // Execute operation with request deduplication
    const requestKey = `${propertyId}_${JSON.stringify(request)}_${operation.name}`;
    
    if (this.requestQueue.has(requestKey)) {
      console.log(`🔄 Deduplicating request for ${requestKey}`);
      return this.requestQueue.get(requestKey)!;
    }

    const requestPromise = (async () => {
      try {
        const data = await operation(propertyId, context);
        
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          propertyContext: {
            propertyId,
            propertyName: property!.name,
            accessLevel: property!.accessLevel,
            requestTimestamp: new Date().toISOString()
          }
        } as PropertyAwareResponse<T>;

      } catch (error) {
        throw error;
      } finally {
        // Clean up request queue
        setTimeout(() => {
          this.requestQueue.delete(requestKey);
        }, 1000);
      }
    })();

    this.requestQueue.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * Get session metrics with property awareness
   */
  async getPropertyAwareSessionMetrics(
    request: PropertyAwareRequest,
    authToken?: string
  ): Promise<PropertyAwareResponse<SessionMetrics>> {
    return this.executeWithPropertyValidation(
      request,
      async (propertyId, context) => {
        console.log(`📊 Fetching session metrics for property ${propertyId}`);
        
        // Call parent method with specific property ID
        const response = await super.getSessionMetrics(
          {
            startDate: request.startDate,
            endDate: request.endDate
          },
          authToken
        );

        // Add property context to response
        return response;
      },
      'READ_ANALYTICS'
    );
  }

  /**
   * Get traffic sources with property awareness
   */
  async getPropertyAwareTrafficSources(
    request: PropertyAwareRequest,
    authToken?: string
  ): Promise<PropertyAwareResponse<TrafficSource[]>> {
    return this.executeWithPropertyValidation(
      request,
      async (propertyId, context) => {
        console.log(`🚦 Fetching traffic sources for property ${propertyId}`);
        
        const response = await super.getTrafficSources(
          {
            startDate: request.startDate,
            endDate: request.endDate
          },
          authToken
        );

        return response;
      },
      'READ_ANALYTICS'
    );
  }

  /**
   * Get page performance with property awareness
   */
  async getPropertyAwarePagePerformance(
    request: PropertyAwareRequest,
    authToken?: string
  ): Promise<PropertyAwareResponse<PagePerformance[]>> {
    return this.executeWithPropertyValidation(
      request,
      async (propertyId, context) => {
        console.log(`📄 Fetching page performance for property ${propertyId}`);
        
        const response = await super.getPagePerformance(
          {
            startDate: request.startDate,
            endDate: request.endDate
          },
          authToken
        );

        return response;
      },
      'READ_ANALYTICS'
    );
  }

  /**
   * Clear property and validation caches
   */
  clearCaches(): void {
    this.propertyCache.clear();
    this.validationCache.clear();
    this.requestQueue.clear();
    console.log('🧹 Cleared property-aware service caches');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      propertyCache: this.propertyCache.size,
      validationCache: this.validationCache.size,
      activeRequests: this.requestQueue.size,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const propertyAwareGA4Service = new PropertyAwareGA4Service();

// Export for use in React components
export const usePropertyAwareGA4Service = () => {
  return {
    service: propertyAwareGA4Service,
    getSessionMetrics: (request: PropertyAwareRequest, authToken?: string) => 
      propertyAwareGA4Service.getPropertyAwareSessionMetrics(request, authToken),
    getTrafficSources: (request: PropertyAwareRequest, authToken?: string) => 
      propertyAwareGA4Service.getPropertyAwareTrafficSources(request, authToken),
    getPagePerformance: (request: PropertyAwareRequest, authToken?: string) => 
      propertyAwareGA4Service.getPropertyAwarePagePerformance(request, authToken),
    clearCaches: () => propertyAwareGA4Service.clearCaches(),
    getCacheStats: () => propertyAwareGA4Service.getCacheStats()
  };
};

export default propertyAwareGA4Service;