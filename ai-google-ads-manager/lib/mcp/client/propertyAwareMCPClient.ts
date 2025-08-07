/**
 * Property-Aware MCP Client
 * 
 * Enhanced MCP client that automatically includes property context in all requests,
 * validates property permissions, and provides seamless property switching support.
 */

import { MCPClient, MCPClientConfig, MCPConnectionState, MCPConnectionEvents } from '../client';
import { GA4Property, PropertyAccessLevel } from '../types/property';
import { PropertyValidationMiddleware, PropertyOperationType, validatePropertyOperation } from '../middleware/propertyValidation';
import { useSelectedProperty } from '../context/PropertyContext';

// Enhanced request types with property context
export interface PropertyAwareMCPRequest {
  method: string;
  params?: any;
  propertyId?: string;
  validateProperty?: boolean;
  operation?: PropertyOperationType;
  requestId?: string;
  timeout?: number;
}

export interface PropertyAwareMCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  propertyContext?: {
    propertyId: string;
    propertyName: string;
    accessLevel: PropertyAccessLevel;
    validatedAt: string;
  };
  requestId?: string;
  timestamp: string;
}

export interface PropertyMCPClientConfig extends MCPClientConfig {
  autoValidateProperties?: boolean;
  requirePropertyContext?: boolean;
  defaultPropertyId?: string;
  enablePropertyLogging?: boolean;
  propertyRequestTimeout?: number;
}

/**
 * Enhanced MCP client with automatic property context injection
 */
export class PropertyAwareMCPClient extends MCPClient {
  private propertyValidation: PropertyValidationMiddleware;
  private propertyConfig: Required<PropertyMCPClientConfig>;
  private activeRequests = new Map<string, PropertyAwareMCPRequest>();
  private propertyRequestHistory: Array<{
    timestamp: Date;
    propertyId: string;
    method: string;
    success: boolean;
    duration: number;
  }> = [];

  constructor(config: PropertyMCPClientConfig = {}, events: MCPConnectionEvents = {}) {
    // Initialize base MCP client
    super(config, events);

    // Set property-specific configuration
    this.propertyConfig = {
      ...config,
      autoValidateProperties: config.autoValidateProperties ?? true,
      requirePropertyContext: config.requirePropertyContext ?? false,
      defaultPropertyId: config.defaultPropertyId || process.env.NEXT_PUBLIC_GA4_PROPERTY_ID || '',
      enablePropertyLogging: config.enablePropertyLogging ?? true,
      propertyRequestTimeout: config.propertyRequestTimeout || 15000
    };

    // Initialize property validation middleware
    this.propertyValidation = new PropertyValidationMiddleware({
      strictMode: this.propertyConfig.autoValidateProperties,
      requirePropertySelection: this.propertyConfig.requirePropertyContext,
      allowFallbackProperty: true,
      cacheValidationResults: true,
      logValidationEvents: this.propertyConfig.enablePropertyLogging,
      defaultPropertyId: this.propertyConfig.defaultPropertyId
    });
  }

  /**
   * Send request with automatic property context injection
   */
  async sendPropertyAwareRequest<T = any>(
    request: PropertyAwareMCPRequest
  ): Promise<PropertyAwareMCPResponse<T>> {
    const startTime = Date.now();
    const requestId = request.requestId || this.generateRequestId();

    try {
      // Validate property context if required
      if (this.propertyConfig.autoValidateProperties && request.operation) {
        const validation = await validatePropertyOperation(
          request.operation,
          request.propertyId,
          requestId
        );

        if (!validation.isValid) {
          return {
            success: false,
            error: `Property validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
            requestId,
            timestamp: new Date().toISOString()
          };
        }

        // Inject property context from validation
        if (validation.context) {
          request.propertyId = validation.context.propertyId;
        }
      }

      // Get current property context if not provided
      const propertyContext = await this.getPropertyContext(request.propertyId);

      // Enhance request with property context
      const enhancedRequest = {
        ...request,
        params: {
          ...request.params,
          propertyId: propertyContext.propertyId,
          propertyContext: {
            propertyId: propertyContext.propertyId,
            propertyName: propertyContext.propertyName,
            accessLevel: propertyContext.accessLevel
          }
        }
      };

      // Track active request
      this.activeRequests.set(requestId, enhancedRequest);

      // Send request using base MCP client
      const response = await this.sendRequest(enhancedRequest.method, enhancedRequest.params);

      // Record request history
      this.recordPropertyRequest(
        propertyContext.propertyId,
        request.method,
        true,
        Date.now() - startTime
      );

      return {
        success: true,
        data: response,
        propertyContext: {
          propertyId: propertyContext.propertyId,
          propertyName: propertyContext.propertyName,
          accessLevel: propertyContext.accessLevel,
          validatedAt: new Date().toISOString()
        },
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Record failed request
      const propertyId = request.propertyId || 'unknown';
      this.recordPropertyRequest(
        propertyId,
        request.method,
        false,
        Date.now() - startTime
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        timestamp: new Date().toISOString()
      };

    } finally {
      // Clean up active request
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Get GA4 analytics data with property awareness
   */
  async getGA4Analytics(params: {
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    propertyId?: string;
  }): Promise<PropertyAwareMCPResponse<any>> {
    return this.sendPropertyAwareRequest({
      method: 'ga4.getAnalytics',
      params,
      propertyId: params.propertyId,
      operation: 'READ_ANALYTICS_DATA',
      validateProperty: true
    });
  }

  /**
   * Get GA4 real-time data with property awareness
   */
  async getGA4RealTime(params: {
    metrics: string[];
    dimensions?: string[];
    propertyId?: string;
  }): Promise<PropertyAwareMCPResponse<any>> {
    return this.sendPropertyAwareRequest({
      method: 'ga4.getRealTime',
      params,
      propertyId: params.propertyId,
      operation: 'READ_ANALYTICS_REALTIME',
      validateProperty: true
    });
  }

  /**
   * Get GA4 reports with property awareness
   */
  async getGA4Reports(params: {
    reportType: string;
    startDate: string;
    endDate: string;
    propertyId?: string;
  }): Promise<PropertyAwareMCPResponse<any>> {
    return this.sendPropertyAwareRequest({
      method: 'ga4.getReports',
      params,
      propertyId: params.propertyId,
      operation: 'READ_ANALYTICS_REPORTS',
      validateProperty: true
    });
  }

  /**
   * Update GA4 configuration with property awareness
   */
  async updateGA4Config(params: {
    configType: string;
    configData: any;
    propertyId?: string;
  }): Promise<PropertyAwareMCPResponse<any>> {
    return this.sendPropertyAwareRequest({
      method: 'ga4.updateConfig',
      params,
      propertyId: params.propertyId,
      operation: 'MODIFY_ANALYTICS_CONFIG',
      validateProperty: true
    });
  }

  /**
   * Get property context from various sources
   */
  private async getPropertyContext(propertyId?: string): Promise<{
    propertyId: string;
    propertyName: string;
    accessLevel: PropertyAccessLevel;
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
        if (this.propertyConfig.enablePropertyLogging) {
          console.warn('Property context not available, using fallback:', error);
        }
      }
    }

    // Fallback to default property
    if (!resolvedPropertyId) {
      resolvedPropertyId = this.propertyConfig.defaultPropertyId;
    }

    if (!resolvedPropertyId) {
      throw new Error('No property ID available for request context');
    }

    // Fetch property details if not already available
    if (!property) {
      try {
        const { PropertyDiscoveryService } = await import('../utils/propertyDiscovery');
        const discoveryService = new PropertyDiscoveryService();
        property = await discoveryService.fetchGA4Property(resolvedPropertyId);
      } catch (error) {
        if (this.propertyConfig.enablePropertyLogging) {
          console.warn(`Failed to fetch property ${resolvedPropertyId}:`, error);
        }
        // Create minimal property context for fallback
        property = {
          id: resolvedPropertyId,
          name: `Property ${resolvedPropertyId}`,
          accessLevel: 'READ_ONLY',
          status: 'ACTIVE'
        } as GA4Property;
      }
    }

    return {
      propertyId: resolvedPropertyId,
      propertyName: property.name,
      accessLevel: property.accessLevel
    };
  }

  /**
   * Record property request for analytics
   */
  private recordPropertyRequest(
    propertyId: string,
    method: string,
    success: boolean,
    duration: number
  ): void {
    const event = {
      timestamp: new Date(),
      propertyId,
      method,
      success,
      duration
    };

    this.propertyRequestHistory.push(event);

    // Keep only last 100 requests
    if (this.propertyRequestHistory.length > 100) {
      this.propertyRequestHistory.shift();
    }

    if (this.propertyConfig.enablePropertyLogging) {
      console.log(`🔄 Property-aware MCP request: ${success ? '✅' : '❌'}`, {
        propertyId,
        method,
        duration: `${duration}ms`
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Switch property context for all subsequent requests
   */
  async switchProperty(propertyId: string): Promise<void> {
    try {
      // Validate new property
      const validation = await validatePropertyOperation('READ_ANALYTICS_DATA', propertyId);
      
      if (!validation.isValid) {
        throw new Error(`Cannot switch to property ${propertyId}: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Update default property in config
      this.propertyConfig.defaultPropertyId = propertyId;

      if (this.propertyConfig.enablePropertyLogging) {
        console.log(`🔄 Switched to property: ${propertyId}`);
      }

    } catch (error) {
      if (this.propertyConfig.enablePropertyLogging) {
        console.error(`❌ Failed to switch to property ${propertyId}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get property request statistics
   */
  getPropertyStats() {
    const recentRequests = this.propertyRequestHistory.filter(
      req => Date.now() - req.timestamp.getTime() < 60000 // Last minute
    );

    const propertyUsage = this.propertyRequestHistory.reduce((acc, req) => {
      acc[req.propertyId] = (acc[req.propertyId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests: this.propertyRequestHistory.length,
      recentRequests: recentRequests.length,
      successRate: this.propertyRequestHistory.length > 0 
        ? this.propertyRequestHistory.filter(r => r.success).length / this.propertyRequestHistory.length 
        : 0,
      averageDuration: this.propertyRequestHistory.length > 0
        ? this.propertyRequestHistory.reduce((sum, r) => sum + r.duration, 0) / this.propertyRequestHistory.length
        : 0,
      activeRequests: this.activeRequests.size,
      propertyUsage,
      validationStats: this.propertyValidation.getValidationStats(),
      currentProperty: this.propertyConfig.defaultPropertyId
    };
  }

  /**
   * Clear property request history and cache
   */
  clearPropertyData(): void {
    this.propertyRequestHistory = [];
    this.activeRequests.clear();
    this.propertyValidation.clearCache();
    
    if (this.propertyConfig.enablePropertyLogging) {
      console.log('🧹 Cleared property-aware MCP client data');
    }
  }
}

// Create enhanced MCP client instance
export function createPropertyAwareMCPClient(
  config: PropertyMCPClientConfig = {},
  events: MCPConnectionEvents = {}
): PropertyAwareMCPClient {
  return new PropertyAwareMCPClient(config, events);
}

// Create production-ready property-aware MCP client
export function createProductionPropertyAwareMCPClient(
  events: MCPConnectionEvents = {}
): PropertyAwareMCPClient {
  return createPropertyAwareMCPClient({
    serverUrl: process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000,
    enableLogging: process.env.NODE_ENV !== 'production',
    autoValidateProperties: true,
    requirePropertyContext: false,
    enablePropertyLogging: process.env.NODE_ENV !== 'production',
    propertyRequestTimeout: 15000
  }, events);
}

// Export singleton instance for convenience
export const propertyAwareMCPClient = createProductionPropertyAwareMCPClient();

export default PropertyAwareMCPClient;