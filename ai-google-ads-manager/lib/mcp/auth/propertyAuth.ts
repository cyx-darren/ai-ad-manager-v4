/**
 * Property-Aware Authentication
 * 
 * Enhanced authentication system that handles property-specific permissions,
 * scope validation, and cross-property authentication state management.
 */

import { GA4Property, PropertyAccessLevel, PropertyPermission } from '../types/property';
import { MCPAuthConfig, MCPAuthCredentials, MCPAuthStatus } from './authTypes';

// Property-specific authentication types
export interface PropertyAuthScope {
  propertyId: string;
  accessLevel: PropertyAccessLevel;
  permissions: PropertyPermission[];
  grantedAt: Date;
  expiresAt?: Date;
  refreshToken?: string;
}

export interface PropertyAuthCredentials extends MCPAuthCredentials {
  propertyScopes: PropertyAuthScope[];
  defaultPropertyId?: string;
  globalPermissions: string[];
}

export interface PropertyAuthConfig extends MCPAuthConfig {
  requirePropertyScopes?: boolean;
  autoRefreshPropertyTokens?: boolean;
  maxPropertiesPerUser?: number;
  propertyTokenTTL?: number;
  enableCrossPropertySharing?: boolean;
}

export interface PropertyAuthStatus extends MCPAuthStatus {
  authorizedProperties: string[];
  currentPropertyId?: string;
  propertyPermissions: Record<string, PropertyPermission[]>;
  lastPropertySwitch?: Date;
  pendingPropertyAuthorizations: string[];
}

export interface PropertyAuthenticationResult {
  success: boolean;
  credentials?: PropertyAuthCredentials;
  status?: PropertyAuthStatus;
  errors: string[];
  warnings: string[];
  requiresAdditionalScopes?: boolean;
  suggestedActions: string[];
}

// Property scope constants
export const GOOGLE_ANALYTICS_SCOPES = {
  READ_ONLY: 'https://www.googleapis.com/auth/analytics.readonly',
  EDIT: 'https://www.googleapis.com/auth/analytics.edit',
  MANAGE_USERS: 'https://www.googleapis.com/auth/analytics.manage.users',
  PROVISION: 'https://www.googleapis.com/auth/analytics.provision'
} as const;

export const REQUIRED_SCOPES_BY_ACCESS_LEVEL: Record<PropertyAccessLevel, string[]> = {
  'READ_ONLY': [GOOGLE_ANALYTICS_SCOPES.READ_ONLY],
  'EDIT': [GOOGLE_ANALYTICS_SCOPES.READ_ONLY, GOOGLE_ANALYTICS_SCOPES.EDIT],
  'NO_ACCESS': []
};

/**
 * Property-aware authentication manager
 */
export class PropertyAuthManager {
  private config: Required<PropertyAuthConfig>;
  private currentCredentials: PropertyAuthCredentials | null = null;
  private authStatus: PropertyAuthStatus | null = null;
  private authCache = new Map<string, PropertyAuthScope>();
  private refreshTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(config: PropertyAuthConfig = {}) {
    this.config = {
      ...config,
      requirePropertyScopes: config.requirePropertyScopes ?? true,
      autoRefreshPropertyTokens: config.autoRefreshPropertyTokens ?? true,
      maxPropertiesPerUser: config.maxPropertiesPerUser || 50,
      propertyTokenTTL: config.propertyTokenTTL || 3600000, // 1 hour
      enableCrossPropertySharing: config.enableCrossPropertySharing ?? false
    };
  }

  /**
   * Authenticate user with property-specific scopes
   */
  async authenticateWithProperties(
    properties: GA4Property[],
    requiredAccessLevel: PropertyAccessLevel = 'READ_ONLY'
  ): Promise<PropertyAuthenticationResult> {
    const result: PropertyAuthenticationResult = {
      success: false,
      errors: [],
      warnings: [],
      suggestedActions: []
    };

    try {
      // Validate property limit
      if (properties.length > this.config.maxPropertiesPerUser) {
        result.errors.push(
          `Too many properties requested (${properties.length}). Maximum allowed: ${this.config.maxPropertiesPerUser}`
        );
        result.suggestedActions.push('Reduce the number of properties or contact administrator for increased limits');
        return result;
      }

      // Build required scopes for all properties
      const requiredScopes = this.buildRequiredScopes(properties, requiredAccessLevel);
      
      // Attempt authentication with Google OAuth
      const authResult = await this.performGoogleOAuth(requiredScopes);
      
      if (!authResult.success) {
        result.errors.push(...authResult.errors);
        result.suggestedActions.push('Check your Google account permissions and try again');
        return result;
      }

      // Validate property access for each property
      const propertyScopes: PropertyAuthScope[] = [];
      const unauthorizedProperties: string[] = [];

      for (const property of properties) {
        const scopeValidation = await this.validatePropertyScope(property, authResult.credentials!);
        
        if (scopeValidation.success) {
          propertyScopes.push(scopeValidation.scope!);
        } else {
          unauthorizedProperties.push(property.id);
          result.warnings.push(`Limited access to property ${property.name} (${property.id})`);
        }
      }

      // Create property-aware credentials
      this.currentCredentials = {
        ...authResult.credentials!,
        propertyScopes,
        defaultPropertyId: properties[0]?.id,
        globalPermissions: this.extractGlobalPermissions(authResult.credentials!)
      };

      // Create authentication status
      this.authStatus = {
        isAuthenticated: true,
        user: authResult.credentials!.user,
        expiresAt: authResult.credentials!.expiresAt,
        authorizedProperties: propertyScopes.map(s => s.propertyId),
        propertyPermissions: propertyScopes.reduce((acc, scope) => {
          acc[scope.propertyId] = scope.permissions;
          return acc;
        }, {} as Record<string, PropertyPermission[]>),
        pendingPropertyAuthorizations: unauthorizedProperties
      };

      // Set up automatic token refresh
      if (this.config.autoRefreshPropertyTokens) {
        this.setupPropertyTokenRefresh();
      }

      result.success = true;
      result.credentials = this.currentCredentials;
      result.status = this.authStatus;

      if (unauthorizedProperties.length > 0) {
        result.requiresAdditionalScopes = true;
        result.suggestedActions.push(
          'Request additional permissions for unauthorized properties through Google Analytics admin'
        );
      }

      return result;

    } catch (error) {
      result.errors.push(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.suggestedActions.push('Check your internet connection and Google account status');
      return result;
    }
  }

  /**
   * Switch to a different property context
   */
  async switchPropertyContext(propertyId: string): Promise<PropertyAuthenticationResult> {
    const result: PropertyAuthenticationResult = {
      success: false,
      errors: [],
      warnings: [],
      suggestedActions: []
    };

    try {
      if (!this.currentCredentials || !this.authStatus) {
        result.errors.push('No active authentication session');
        result.suggestedActions.push('Re-authenticate before switching properties');
        return result;
      }

      // Check if property is already authorized
      const propertyScope = this.currentCredentials.propertyScopes.find(
        scope => scope.propertyId === propertyId
      );

      if (!propertyScope) {
        result.errors.push(`Property ${propertyId} is not in your authorized property list`);
        result.suggestedActions.push('Re-authenticate to include this property in your session');
        return result;
      }

      // Check if property scope is still valid
      if (propertyScope.expiresAt && propertyScope.expiresAt < new Date()) {
        result.warnings.push(`Property ${propertyId} authorization has expired`);
        
        // Attempt to refresh if possible
        if (propertyScope.refreshToken && this.config.autoRefreshPropertyTokens) {
          const refreshed = await this.refreshPropertyScope(propertyId);
          if (!refreshed) {
            result.errors.push(`Failed to refresh authorization for property ${propertyId}`);
            result.suggestedActions.push('Re-authenticate to refresh property access');
            return result;
          }
        } else {
          result.errors.push(`Property ${propertyId} authorization has expired and cannot be refreshed`);
          result.suggestedActions.push('Re-authenticate to refresh property access');
          return result;
        }
      }

      // Update current property context
      this.currentCredentials.defaultPropertyId = propertyId;
      this.authStatus.currentPropertyId = propertyId;
      this.authStatus.lastPropertySwitch = new Date();

      result.success = true;
      result.status = this.authStatus;

      console.log(`🔄 Switched to property context: ${propertyId}`);
      return result;

    } catch (error) {
      result.errors.push(`Property switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate property access permissions
   */
  async validatePropertyAccess(
    propertyId: string,
    requiredPermission: PropertyPermission
  ): Promise<boolean> {
    if (!this.currentCredentials || !this.authStatus) {
      return false;
    }

    const propertyScope = this.currentCredentials.propertyScopes.find(
      scope => scope.propertyId === propertyId
    );

    if (!propertyScope) {
      return false;
    }

    // Check if scope is still valid
    if (propertyScope.expiresAt && propertyScope.expiresAt < new Date()) {
      return false;
    }

    // Validate permission level
    return propertyScope.permissions.includes(requiredPermission);
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): PropertyAuthStatus | null {
    return this.authStatus;
  }

  /**
   * Get current credentials
   */
  getCredentials(): PropertyAuthCredentials | null {
    return this.currentCredentials;
  }

  /**
   * Build required OAuth scopes for properties
   */
  private buildRequiredScopes(
    properties: GA4Property[],
    minAccessLevel: PropertyAccessLevel
  ): string[] {
    const scopes = new Set<string>();
    
    // Add base scopes
    scopes.add(GOOGLE_ANALYTICS_SCOPES.READ_ONLY);
    
    // Add additional scopes based on access level
    if (minAccessLevel === 'EDIT') {
      scopes.add(GOOGLE_ANALYTICS_SCOPES.EDIT);
    }

    // Add property-specific scopes if needed
    properties.forEach(property => {
      const requiredForProperty = REQUIRED_SCOPES_BY_ACCESS_LEVEL[property.accessLevel] || [];
      requiredForProperty.forEach(scope => scopes.add(scope));
    });

    return Array.from(scopes);
  }

  /**
   * Perform Google OAuth authentication
   */
  private async performGoogleOAuth(scopes: string[]): Promise<{
    success: boolean;
    credentials?: MCPAuthCredentials;
    errors: string[];
  }> {
    try {
      // This would integrate with your actual OAuth implementation
      // For now, we'll simulate the process
      
      const credentials: MCPAuthCredentials = {
        accessToken: `access_token_${Date.now()}`,
        refreshToken: `refresh_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        tokenType: 'Bearer',
        scope: scopes.join(' '),
        user: {
          id: 'user_123',
          email: 'user@example.com',
          name: 'User Name'
        }
      };

      return {
        success: true,
        credentials,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [`OAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate property-specific scope
   */
  private async validatePropertyScope(
    property: GA4Property,
    credentials: MCPAuthCredentials
  ): Promise<{
    success: boolean;
    scope?: PropertyAuthScope;
  }> {
    try {
      // Validate property access with Google Analytics API
      // This would make actual API calls to verify access
      
      const scope: PropertyAuthScope = {
        propertyId: property.id,
        accessLevel: property.accessLevel,
        permissions: this.getPermissionsForAccessLevel(property.accessLevel),
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.propertyTokenTTL),
        refreshToken: credentials.refreshToken
      };

      // Cache the scope
      this.authCache.set(property.id, scope);

      return { success: true, scope };

    } catch (error) {
      console.error(`Failed to validate scope for property ${property.id}:`, error);
      return { success: false };
    }
  }

  /**
   * Get permissions for access level
   */
  private getPermissionsForAccessLevel(accessLevel: PropertyAccessLevel): PropertyPermission[] {
    switch (accessLevel) {
      case 'EDIT':
        return ['READ_ONLY', 'EDIT'];
      case 'READ_ONLY':
        return ['READ_ONLY'];
      case 'NO_ACCESS':
      default:
        return [];
    }
  }

  /**
   * Extract global permissions from credentials
   */
  private extractGlobalPermissions(credentials: MCPAuthCredentials): string[] {
    return credentials.scope?.split(' ') || [];
  }

  /**
   * Setup automatic token refresh for properties
   */
  private setupPropertyTokenRefresh(): void {
    if (!this.currentCredentials) return;

    this.currentCredentials.propertyScopes.forEach(scope => {
      if (scope.expiresAt && scope.refreshToken) {
        const refreshTime = scope.expiresAt.getTime() - Date.now() - 300000; // 5 minutes before expiry
        
        if (refreshTime > 0) {
          const timeout = setTimeout(() => {
            this.refreshPropertyScope(scope.propertyId);
          }, refreshTime);

          this.refreshTimeouts.set(scope.propertyId, timeout);
        }
      }
    });
  }

  /**
   * Refresh property scope token
   */
  private async refreshPropertyScope(propertyId: string): Promise<boolean> {
    try {
      // Implementation would refresh the specific property token
      // For now, we'll simulate success
      
      const scopeIndex = this.currentCredentials?.propertyScopes.findIndex(
        s => s.propertyId === propertyId
      );

      if (scopeIndex !== undefined && scopeIndex >= 0 && this.currentCredentials) {
        this.currentCredentials.propertyScopes[scopeIndex].expiresAt = 
          new Date(Date.now() + this.config.propertyTokenTTL);
        
        console.log(`🔄 Refreshed property scope for ${propertyId}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`Failed to refresh property scope for ${propertyId}:`, error);
      return false;
    }
  }

  /**
   * Clear all authentication data
   */
  signOut(): void {
    this.currentCredentials = null;
    this.authStatus = null;
    this.authCache.clear();
    
    // Clear refresh timeouts
    this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
    this.refreshTimeouts.clear();

    console.log('🚪 Property authentication cleared');
  }
}

// Create default property auth manager
export const defaultPropertyAuth = new PropertyAuthManager();

// Convenience functions
export async function authenticateWithProperties(
  properties: GA4Property[],
  requiredAccessLevel: PropertyAccessLevel = 'READ_ONLY'
): Promise<PropertyAuthenticationResult> {
  return defaultPropertyAuth.authenticateWithProperties(properties, requiredAccessLevel);
}

export async function switchPropertyContext(propertyId: string): Promise<PropertyAuthenticationResult> {
  return defaultPropertyAuth.switchPropertyContext(propertyId);
}

export async function validatePropertyAccess(
  propertyId: string,
  requiredPermission: PropertyPermission
): Promise<boolean> {
  return defaultPropertyAuth.validatePropertyAccess(propertyId, requiredPermission);
}

export function getPropertyAuthStatus(): PropertyAuthStatus | null {
  return defaultPropertyAuth.getAuthStatus();
}

export default PropertyAuthManager;