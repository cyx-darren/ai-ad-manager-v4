/**
 * GA4 Property Discovery Utilities
 * 
 * Utilities for discovering and fetching GA4 properties from Google Analytics Admin API,
 * with error handling, retry logic, and integration with MCP server.
 */

import { 
  GA4Property, 
  PropertyType, 
  PropertyStatus, 
  PropertyAccessLevel, 
  PropertyPermission,
  PropertyDiscoveryConfig,
  PropertyError,
  PropertyErrorCode,
  PropertyMetadata,
  PropertyHealthStatus,
  DataStream,
  DataStreamType,
  DEFAULT_PROPERTY_DISCOVERY_CONFIG
} from '../types/property';

// Google Analytics Admin API interfaces
interface GoogleAnalyticsAccount {
  name: string;
  displayName: string;
  regionCode: string;
  createTime: string;
  updateTime: string;
}

interface GoogleAnalyticsProperty {
  name: string;
  propertyType: string;
  createTime: string;
  updateTime: string;
  parent: string;
  displayName: string;
  industryCategory: string;
  timeZone: string;
  currencyCode: string;
  serviceLevel: string;
  deleteTime?: string;
}

interface GoogleAnalyticsDataStream {
  name: string;
  type: string;
  displayName: string;
  createTime: string;
  updateTime: string;
  webStreamData?: any;
  iosAppStreamData?: any;
  androidAppStreamData?: any;
}

// Property Discovery Service
export class PropertyDiscoveryService {
  private config: PropertyDiscoveryConfig;
  private mcpClient: any; // MCP client for API calls
  private retryAttempts: Map<string, number> = new Map();

  constructor(mcpClient: any, config?: Partial<PropertyDiscoveryConfig>) {
    this.mcpClient = mcpClient;
    this.config = { ...DEFAULT_PROPERTY_DISCOVERY_CONFIG, ...config };
  }

  /**
   * Discover all available GA4 properties for the authenticated user
   */
  async discoverProperties(): Promise<GA4Property[]> {
    try {
      console.log('🔍 Starting GA4 property discovery...');
      
      // Get accounts first
      const accounts = await this.fetchAccounts();
      console.log(`📊 Found ${accounts.length} Analytics accounts`);
      
      // Get properties for all accounts
      const allProperties: GA4Property[] = [];
      
      for (const account of accounts) {
        try {
          const accountProperties = await this.fetchPropertiesForAccount(account);
          allProperties.push(...accountProperties);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch properties for account ${account.displayName}:`, error);
          // Continue with other accounts
        }
      }

      console.log(`✅ Discovery complete: ${allProperties.length} properties found`);
      
      // Filter and validate properties
      const validProperties = this.filterProperties(allProperties);
      console.log(`🎯 ${validProperties.length} properties meet criteria`);
      
      return validProperties;
      
    } catch (error) {
      console.error('❌ Property discovery failed:', error);
      throw this.createPropertyError(
        PropertyErrorCode.DISCOVERY_FAILED,
        'Failed to discover GA4 properties',
        error
      );
    }
  }

  /**
   * Fetch a specific property by ID
   */
  async fetchProperty(propertyId: string): Promise<GA4Property> {
    try {
      console.log(`🔍 Fetching property ${propertyId}...`);
      
      // Call MCP server to fetch property details
      const response = await this.mcpClient.callTool('get_property', {
        property_id: propertyId
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch property');
      }
      
      const propertyData = response.data;
      
      // Fetch additional metadata
      const metadata = await this.fetchPropertyMetadata(propertyId);
      
      // Convert to our property format
      const property = this.convertToGA4Property(propertyData, metadata);
      
      console.log(`✅ Property ${propertyId} fetched successfully`);
      return property;
      
    } catch (error) {
      console.error(`❌ Failed to fetch property ${propertyId}:`, error);
      throw this.createPropertyError(
        PropertyErrorCode.FETCH_FAILED,
        `Failed to fetch property ${propertyId}`,
        error
      );
    }
  }

  /**
   * Refresh property data
   */
  async refreshProperty(propertyId: string): Promise<GA4Property> {
    try {
      // Clear any cached data for this property
      await this.mcpClient.callTool('clear_property_cache', {
        property_id: propertyId
      });
      
      // Fetch fresh data
      return await this.fetchProperty(propertyId);
      
    } catch (error) {
      console.error(`❌ Failed to refresh property ${propertyId}:`, error);
      throw this.createPropertyError(
        PropertyErrorCode.FETCH_FAILED,
        `Failed to refresh property ${propertyId}`,
        error
      );
    }
  }

  /**
   * Validate property access and permissions
   */
  async validatePropertyAccess(propertyId: string): Promise<{
    hasAccess: boolean;
    accessLevel: PropertyAccessLevel;
    permissions: PropertyPermission[];
  }> {
    try {
      console.log(`🔐 Validating access for property ${propertyId}...`);
      
      const response = await this.mcpClient.callTool('check_property_access', {
        property_id: propertyId
      });
      
      if (!response.success) {
        return {
          hasAccess: false,
          accessLevel: PropertyAccessLevel.NO_ACCESS,
          permissions: []
        };
      }
      
      const accessData = response.data;
      
      return {
        hasAccess: accessData.has_access || false,
        accessLevel: this.convertAccessLevel(accessData.access_level),
        permissions: this.convertPermissions(accessData.permissions || [])
      };
      
    } catch (error) {
      console.warn(`⚠️ Could not validate access for property ${propertyId}:`, error);
      return {
        hasAccess: false,
        accessLevel: PropertyAccessLevel.NO_ACCESS,
        permissions: []
      };
    }
  }

  /**
   * Check property health status
   */
  async checkPropertyHealth(propertyId: string): Promise<PropertyHealthStatus> {
    try {
      const response = await this.mcpClient.callTool('check_property_health', {
        property_id: propertyId
      });
      
      if (!response.success) {
        return PropertyHealthStatus.ERROR;
      }
      
      const healthData = response.data;
      
      // Analyze health based on various factors
      if (healthData.has_recent_data && healthData.data_quality_score > 80) {
        return PropertyHealthStatus.HEALTHY;
      } else if (healthData.has_recent_data && healthData.data_quality_score > 60) {
        return PropertyHealthStatus.WARNING;
      } else if (healthData.has_recent_data) {
        return PropertyHealthStatus.ERROR;
      } else {
        return PropertyHealthStatus.NO_DATA;
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not check health for property ${propertyId}:`, error);
      return PropertyHealthStatus.ERROR;
    }
  }

  // Private helper methods

  private async fetchAccounts(): Promise<GoogleAnalyticsAccount[]> {
    const response = await this.mcpClient.callTool('list_accounts', {});
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch accounts');
    }
    
    return response.data.accounts || [];
  }

  private async fetchPropertiesForAccount(account: GoogleAnalyticsAccount): Promise<GA4Property[]> {
    const response = await this.mcpClient.callTool('list_properties', {
      account_name: account.name
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch properties');
    }
    
    const properties: GA4Property[] = [];
    
    for (const propertyData of response.data.properties || []) {
      try {
        // Fetch metadata for each property
        const metadata = await this.fetchPropertyMetadata(this.extractPropertyId(propertyData.name));
        const property = this.convertToGA4Property(propertyData, metadata);
        properties.push(property);
      } catch (error) {
        console.warn(`⚠️ Failed to process property ${propertyData.name}:`, error);
        // Continue with other properties
      }
    }
    
    return properties;
  }

  private async fetchPropertyMetadata(propertyId: string): Promise<PropertyMetadata> {
    try {
      // Fetch data streams
      const dataStreamsResponse = await this.mcpClient.callTool('list_data_streams', {
        property_id: propertyId
      });
      
      const dataStreams: DataStream[] = [];
      if (dataStreamsResponse.success && dataStreamsResponse.data.dataStreams) {
        for (const streamData of dataStreamsResponse.data.dataStreams) {
          dataStreams.push(this.convertToDataStream(streamData));
        }
      }
      
      // Check various integration statuses
      const [healthStatus] = await Promise.all([
        this.checkPropertyHealth(propertyId)
      ]);
      
      return {
        dataStreams,
        measurementId: this.extractMeasurementId(dataStreams),
        firebaseLinked: dataStreams.some(ds => ds.webStreamData?.firebaseAppId || ds.iosAppStreamData?.firebaseAppId || ds.androidAppStreamData?.firebaseAppId),
        googleAdsLinked: false, // Would need additional API call
        enhancedEcommerceEnabled: false, // Would need additional API call
        lastDataReceived: undefined, // Would need additional API call
        healthStatus
      };
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch metadata for property ${propertyId}:`, error);
      return {
        dataStreams: [],
        firebaseLinked: false,
        googleAdsLinked: false,
        enhancedEcommerceEnabled: false,
        healthStatus: PropertyHealthStatus.ERROR
      };
    }
  }

  private convertToGA4Property(propertyData: GoogleAnalyticsProperty, metadata: PropertyMetadata): GA4Property {
    const propertyId = this.extractPropertyId(propertyData.name);
    
    return {
      id: propertyId,
      name: propertyData.displayName,
      resourceName: propertyData.name,
      displayName: propertyData.displayName,
      propertyType: this.convertPropertyType(propertyData.propertyType),
      industryCategory: propertyData.industryCategory || 'UNSPECIFIED',
      timeZone: propertyData.timeZone,
      currencyCode: propertyData.currencyCode,
      createTime: propertyData.createTime,
      updateTime: propertyData.updateTime,
      status: propertyData.deleteTime ? PropertyStatus.DELETED : PropertyStatus.ACTIVE,
      accessLevel: PropertyAccessLevel.READ_ONLY, // Will be updated by validation
      permissions: [], // Will be updated by validation
      metadata
    };
  }

  private convertToDataStream(streamData: GoogleAnalyticsDataStream): DataStream {
    const streamId = this.extractDataStreamId(streamData.name);
    
    return {
      id: streamId,
      name: streamData.displayName,
      type: this.convertDataStreamType(streamData.type),
      webStreamData: streamData.webStreamData,
      iosAppStreamData: streamData.iosAppStreamData,
      androidAppStreamData: streamData.androidAppStreamData
    };
  }

  private convertPropertyType(type: string): PropertyType {
    switch (type) {
      case 'PROPERTY_TYPE_ORDINARY':
        return PropertyType.WEB;
      case 'PROPERTY_TYPE_SUBPROPERTY':
        return PropertyType.WEB;
      case 'PROPERTY_TYPE_ROLLUP':
        return PropertyType.WEB;
      default:
        return PropertyType.WEB;
    }
  }

  private convertDataStreamType(type: string): DataStreamType {
    switch (type) {
      case 'WEB_DATA_STREAM':
        return DataStreamType.WEB_DATA_STREAM;
      case 'IOS_APP_DATA_STREAM':
        return DataStreamType.IOS_APP_DATA_STREAM;
      case 'ANDROID_APP_DATA_STREAM':
        return DataStreamType.ANDROID_APP_DATA_STREAM;
      default:
        return DataStreamType.WEB_DATA_STREAM;
    }
  }

  private convertAccessLevel(level: string): PropertyAccessLevel {
    switch (level?.toUpperCase()) {
      case 'ADMIN':
        return PropertyAccessLevel.ADMIN;
      case 'EDITOR':
        return PropertyAccessLevel.EDITOR;
      case 'ANALYST':
      case 'STANDARD':
        return PropertyAccessLevel.STANDARD;
      case 'VIEWER':
      case 'READ_ONLY':
        return PropertyAccessLevel.READ_ONLY;
      default:
        return PropertyAccessLevel.NO_ACCESS;
    }
  }

  private convertPermissions(permissions: string[]): PropertyPermission[] {
    const permissionMap: { [key: string]: PropertyPermission } = {
      'READ_DATA': PropertyPermission.READ_DATA,
      'EDIT_DATA': PropertyPermission.EDIT_DATA,
      'MANAGE_USERS': PropertyPermission.MANAGE_USERS,
      'MANAGE_SETTINGS': PropertyPermission.MANAGE_SETTINGS,
      'DELETE_PROPERTY': PropertyPermission.DELETE_PROPERTY
    };
    
    return permissions
      .map(p => permissionMap[p.toUpperCase()])
      .filter(Boolean);
  }

  private extractPropertyId(resourceName: string): string {
    const match = resourceName.match(/properties\/(\d+)/);
    return match ? match[1] : resourceName;
  }

  private extractDataStreamId(resourceName: string): string {
    const match = resourceName.match(/dataStreams\/(\d+)/);
    return match ? match[1] : resourceName;
  }

  private extractMeasurementId(dataStreams: DataStream[]): string | undefined {
    const webStream = dataStreams.find(ds => ds.type === DataStreamType.WEB_DATA_STREAM);
    return webStream?.webStreamData?.measurementId;
  }

  private filterProperties(properties: GA4Property[]): GA4Property[] {
    return properties.filter(property => {
      // Filter by status
      if (!this.config.includeInactive && property.status !== PropertyStatus.ACTIVE) {
        return false;
      }
      
      // Filter by access level
      if (property.accessLevel < this.config.minAccessLevel) {
        return false;
      }
      
      return true;
    });
  }

  private createPropertyError(
    code: PropertyErrorCode,
    message: string,
    originalError?: any
  ): PropertyError {
    return {
      code,
      message,
      details: originalError,
      timestamp: new Date().toISOString(),
      retryable: this.isRetryableError(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private isRetryableError(code: PropertyErrorCode): boolean {
    return [
      PropertyErrorCode.NETWORK_ERROR,
      PropertyErrorCode.RATE_LIMIT,
      PropertyErrorCode.FETCH_FAILED
    ].includes(code);
  }

  private getSuggestedAction(code: PropertyErrorCode): string {
    switch (code) {
      case PropertyErrorCode.PERMISSION_DENIED:
        return 'Check your Google Analytics permissions and re-authenticate if needed';
      case PropertyErrorCode.RATE_LIMIT:
        return 'Wait a moment and try again';
      case PropertyErrorCode.NETWORK_ERROR:
        return 'Check your internet connection and try again';
      case PropertyErrorCode.AUTH_ERROR:
        return 'Re-authenticate with Google Analytics';
      default:
        return 'Try refreshing the properties list';
    }
  }
}

// Utility functions for property discovery

/**
 * Create a property discovery service instance
 */
export function createPropertyDiscoveryService(
  mcpClient: any, 
  config?: Partial<PropertyDiscoveryConfig>
): PropertyDiscoveryService {
  return new PropertyDiscoveryService(mcpClient, config);
}

/**
 * Quick property discovery with default configuration
 */
export async function discoverGA4Properties(mcpClient: any): Promise<GA4Property[]> {
  const service = createPropertyDiscoveryService(mcpClient);
  return await service.discoverProperties();
}

/**
 * Fetch a single property with validation
 */
export async function fetchGA4Property(
  mcpClient: any, 
  propertyId: string
): Promise<GA4Property> {
  const service = createPropertyDiscoveryService(mcpClient);
  const property = await service.fetchProperty(propertyId);
  
  // Validate access
  const accessInfo = await service.validatePropertyAccess(propertyId);
  property.accessLevel = accessInfo.accessLevel;
  property.permissions = accessInfo.permissions;
  
  return property;
}

/**
 * Validate multiple properties
 */
export async function validateGA4Properties(
  mcpClient: any,
  properties: GA4Property[]
): Promise<GA4Property[]> {
  const service = createPropertyDiscoveryService(mcpClient);
  
  const validatedProperties = await Promise.all(
    properties.map(async (property) => {
      try {
        const accessInfo = await service.validatePropertyAccess(property.id);
        return {
          ...property,
          accessLevel: accessInfo.accessLevel,
          permissions: accessInfo.permissions
        };
      } catch (error) {
        console.warn(`⚠️ Failed to validate property ${property.id}:`, error);
        return property;
      }
    })
  );
  
  return validatedProperties;
}