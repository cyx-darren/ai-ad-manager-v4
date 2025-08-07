/**
 * GA4 Property Validation Utilities
 * 
 * Utilities for validating GA4 properties, checking permissions,
 * filtering properties, and ensuring data quality.
 */

// Validation utility types
export type ValidationResult<T> = {
  isValid: boolean;
  data?: T;
  errors: string[];
};

export interface PropertyValidatorOptions {
  strictMode?: boolean;
  checkPermissions?: boolean;
  validateHealth?: boolean;
}

import {
  GA4Property,
  PropertyType,
  PropertyStatus,
  PropertyAccessLevel,
  PropertyPermission,
  PropertyFilter,
  PropertySort,
  PropertySortField,
  PropertyValidationResult,
  PropertyValidationError,
  PropertyValidationWarning,
  PropertyValidationErrorCode,
  PropertyValidationWarningCode,
  PropertyHealthStatus,
  DataStreamType
} from '../types/property';

// Property Validation Service
export class PropertyValidationService {
  
  /**
   * Validate a single property
   */
  validateProperty(property: GA4Property): PropertyValidationResult {
    const errors: PropertyValidationError[] = [];
    const warnings: PropertyValidationWarning[] = [];
    
    // Basic property validation
    this.validateBasicProperty(property, errors);
    
    // Permission validation
    this.validatePermissions(property, errors, warnings);
    
    // Data quality validation
    this.validateDataQuality(property, warnings);
    
    // Health status validation
    this.validateHealthStatus(property, warnings);
    
    // Calculate validation score
    const score = this.calculateValidationScore(errors, warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validate multiple properties
   */
  validateProperties(properties: GA4Property[]): Map<string, PropertyValidationResult> {
    const results = new Map<string, PropertyValidationResult>();
    
    for (const property of properties) {
      const validationResult = this.validateProperty(property);
      results.set(property.id, validationResult);
    }
    
    return results;
  }

  /**
   * Filter properties based on criteria
   */
  filterProperties(properties: GA4Property[], filter: PropertyFilter): GA4Property[] {
    return properties.filter(property => {
      // Filter by property types
      if (filter.propertyTypes && filter.propertyTypes.length > 0) {
        if (!filter.propertyTypes.includes(property.propertyType)) {
          return false;
        }
      }
      
      // Filter by access levels
      if (filter.accessLevels && filter.accessLevels.length > 0) {
        if (!filter.accessLevels.includes(property.accessLevel)) {
          return false;
        }
      }
      
      // Filter by status
      if (filter.statuses && filter.statuses.length > 0) {
        if (!filter.statuses.includes(property.status)) {
          return false;
        }
      }
      
      // Filter by search query
      if (filter.searchQuery && filter.searchQuery.trim()) {
        const query = filter.searchQuery.toLowerCase();
        const searchableText = [
          property.name,
          property.displayName,
          property.id,
          property.metadata.measurementId
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }
      
      // Filter by data availability
      if (filter.hasDataOnly) {
        if (property.metadata.healthStatus === PropertyHealthStatus.NO_DATA) {
          return false;
        }
      }
      
      // Filter by recent activity
      if (filter.recentlyActiveOnly) {
        if (!this.isRecentlyActive(property)) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Sort properties based on criteria
   */
  sortProperties(properties: GA4Property[], sort: PropertySort): GA4Property[] {
    return [...properties].sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case PropertySortField.NAME:
          comparison = a.name.localeCompare(b.name);
          break;
          
        case PropertySortField.CREATE_TIME:
          comparison = new Date(a.createTime).getTime() - new Date(b.createTime).getTime();
          break;
          
        case PropertySortField.UPDATE_TIME:
          comparison = new Date(a.updateTime).getTime() - new Date(b.updateTime).getTime();
          break;
          
        case PropertySortField.LAST_DATA_RECEIVED:
          const aTime = a.metadata.lastDataReceived ? new Date(a.metadata.lastDataReceived).getTime() : 0;
          const bTime = b.metadata.lastDataReceived ? new Date(b.metadata.lastDataReceived).getTime() : 0;
          comparison = aTime - bTime;
          break;
          
        case PropertySortField.ACCESS_LEVEL:
          comparison = this.getAccessLevelOrder(a.accessLevel) - this.getAccessLevelOrder(b.accessLevel);
          break;
          
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Check if property has required permissions for specific operations
   */
  hasRequiredPermissions(
    property: GA4Property, 
    requiredPermissions: PropertyPermission[]
  ): boolean {
    return requiredPermissions.every(permission => 
      property.permissions.includes(permission)
    );
  }

  /**
   * Get missing permissions for a property
   */
  getMissingPermissions(
    property: GA4Property,
    requiredPermissions: PropertyPermission[]
  ): PropertyPermission[] {
    return requiredPermissions.filter(permission => 
      !property.permissions.includes(permission)
    );
  }

  /**
   * Check if property meets minimum access level
   */
  meetsMinimumAccessLevel(
    property: GA4Property,
    minAccessLevel: PropertyAccessLevel
  ): boolean {
    return this.getAccessLevelOrder(property.accessLevel) >= this.getAccessLevelOrder(minAccessLevel);
  }

  /**
   * Validate property ID format
   */
  isValidPropertyId(propertyId: string): boolean {
    // GA4 property IDs are typically numeric strings
    return /^\d+$/.test(propertyId) && propertyId.length >= 9 && propertyId.length <= 12;
  }

  /**
   * Validate measurement ID format
   */
  isValidMeasurementId(measurementId: string): boolean {
    // GA4 measurement IDs follow the format G-XXXXXXXXXX
    return /^G-[A-Z0-9]{10}$/.test(measurementId);
  }

  /**
   * Get property health summary
   */
  getPropertyHealthSummary(property: GA4Property): {
    status: PropertyHealthStatus;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check data streams
    if (property.metadata.dataStreams.length === 0) {
      issues.push('No data streams configured');
      recommendations.push('Configure at least one data stream to start collecting data');
    }
    
    // Check measurement ID for web properties
    if (property.propertyType === PropertyType.WEB && !property.metadata.measurementId) {
      issues.push('Missing measurement ID');
      recommendations.push('Configure a web data stream to get a measurement ID');
    }
    
    // Check recent data
    if (property.metadata.healthStatus === PropertyHealthStatus.NO_DATA) {
      issues.push('No recent data received');
      recommendations.push('Check that tracking code is properly implemented');
    }
    
    // Check Firebase linking for app properties
    if (
      (property.propertyType === PropertyType.IOS_APP || property.propertyType === PropertyType.ANDROID_APP) &&
      !property.metadata.firebaseLinked
    ) {
      issues.push('Not linked to Firebase');
      recommendations.push('Link to Firebase for enhanced app analytics');
    }
    
    return {
      status: property.metadata.healthStatus,
      issues,
      recommendations
    };
  }

  // Private validation methods

  private validateBasicProperty(property: GA4Property, errors: PropertyValidationError[]): void {
    // Validate property ID
    if (!property.id || !this.isValidPropertyId(property.id)) {
      errors.push({
        code: PropertyValidationErrorCode.INVALID_PROPERTY_ID,
        message: `Invalid property ID: ${property.id}`,
        field: 'id',
        severity: 'error'
      });
    }
    
    // Validate property name
    if (!property.name || property.name.trim().length === 0) {
      errors.push({
        code: PropertyValidationErrorCode.PROPERTY_NOT_FOUND,
        message: 'Property name is required',
        field: 'name',
        severity: 'error'
      });
    }
    
    // Validate property status
    if (property.status === PropertyStatus.DELETED) {
      errors.push({
        code: PropertyValidationErrorCode.PROPERTY_INACTIVE,
        message: 'Property is deleted and cannot be used',
        field: 'status',
        severity: 'error'
      });
    }
    
    if (property.status === PropertyStatus.SUSPENDED) {
      errors.push({
        code: PropertyValidationErrorCode.PROPERTY_INACTIVE,
        message: 'Property is suspended and cannot be used',
        field: 'status',
        severity: 'error'
      });
    }
    
    // Validate measurement ID for web properties
    if (
      property.propertyType === PropertyType.WEB && 
      property.metadata.measurementId && 
      !this.isValidMeasurementId(property.metadata.measurementId)
    ) {
      errors.push({
        code: PropertyValidationErrorCode.INVALID_MEASUREMENT_ID,
        message: `Invalid measurement ID: ${property.metadata.measurementId}`,
        field: 'measurementId',
        severity: 'error'
      });
    }
  }

  private validatePermissions(
    property: GA4Property, 
    errors: PropertyValidationError[], 
    warnings: PropertyValidationWarning[]
  ): void {
    // Check if user has any access
    if (property.accessLevel === PropertyAccessLevel.NO_ACCESS) {
      errors.push({
        code: PropertyValidationErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'No access to this property',
        field: 'accessLevel',
        severity: 'error'
      });
    }
    
    // Check for minimum read permissions
    if (!property.permissions.includes(PropertyPermission.READ_DATA)) {
      if (property.accessLevel !== PropertyAccessLevel.NO_ACCESS) {
        warnings.push({
          code: PropertyValidationWarningCode.LIMITED_PERMISSIONS,
          message: 'Limited read permissions may affect data access',
          field: 'permissions'
        });
      }
    }
    
    // Warn about limited permissions
    if (property.accessLevel === PropertyAccessLevel.READ_ONLY) {
      warnings.push({
        code: PropertyValidationWarningCode.LIMITED_PERMISSIONS,
        message: 'Read-only access - some features may be unavailable',
        field: 'accessLevel'
      });
    }
  }

  private validateDataQuality(property: GA4Property, warnings: PropertyValidationWarning[]): void {
    // Check for data streams
    if (property.metadata.dataStreams.length === 0) {
      warnings.push({
        code: PropertyValidationWarningCode.CONFIGURATION_ISSUES,
        message: 'No data streams configured',
        field: 'dataStreams'
      });
    }
    
    // Check for recent data
    if (!property.metadata.lastDataReceived) {
      warnings.push({
        code: PropertyValidationWarningCode.NO_RECENT_DATA,
        message: 'No recent data received',
        field: 'lastDataReceived'
      });
    } else {
      const daysSinceLastData = this.getDaysSinceLastData(property.metadata.lastDataReceived);
      if (daysSinceLastData > 7) {
        warnings.push({
          code: PropertyValidationWarningCode.NO_RECENT_DATA,
          message: `No data received in ${daysSinceLastData} days`,
          field: 'lastDataReceived'
        });
      }
    }
  }

  private validateHealthStatus(property: GA4Property, warnings: PropertyValidationWarning[]): void {
    switch (property.metadata.healthStatus) {
      case PropertyHealthStatus.ERROR:
        warnings.push({
          code: PropertyValidationWarningCode.CONFIGURATION_ISSUES,
          message: 'Property has configuration errors',
          field: 'healthStatus'
        });
        break;
        
      case PropertyHealthStatus.WARNING:
        warnings.push({
          code: PropertyValidationWarningCode.CONFIGURATION_ISSUES,
          message: 'Property has configuration warnings',
          field: 'healthStatus'
        });
        break;
        
      case PropertyHealthStatus.NO_DATA:
        warnings.push({
          code: PropertyValidationWarningCode.NO_RECENT_DATA,
          message: 'Property is not receiving data',
          field: 'healthStatus'
        });
        break;
    }
  }

  private calculateValidationScore(
    errors: PropertyValidationError[], 
    warnings: PropertyValidationWarning[]
  ): number {
    // Start with perfect score
    let score = 100;
    
    // Deduct points for errors (more severe)
    score -= errors.length * 25;
    
    // Deduct points for warnings (less severe)
    score -= warnings.length * 10;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private isRecentlyActive(property: GA4Property): boolean {
    if (!property.metadata.lastDataReceived) {
      return false;
    }
    
    const daysSinceLastData = this.getDaysSinceLastData(property.metadata.lastDataReceived);
    return daysSinceLastData <= 7; // Consider active if data received within 7 days
  }

  private getDaysSinceLastData(lastDataReceived: string): number {
    const lastDate = new Date(lastDataReceived);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getAccessLevelOrder(accessLevel: PropertyAccessLevel): number {
    const order: { [key in PropertyAccessLevel]: number } = {
      [PropertyAccessLevel.NO_ACCESS]: 0,
      [PropertyAccessLevel.READ_ONLY]: 1,
      [PropertyAccessLevel.STANDARD]: 2,
      [PropertyAccessLevel.EDITOR]: 3,
      [PropertyAccessLevel.ADMIN]: 4
    };
    
    return order[accessLevel] || 0;
  }
}

// Utility functions for property validation

/**
 * Create a property validation service instance
 */
export function createPropertyValidationService(): PropertyValidationService {
  return new PropertyValidationService();
}

/**
 * Quick property validation
 */
export function validateGA4Property(property: GA4Property): PropertyValidationResult {
  const service = createPropertyValidationService();
  return service.validateProperty(property);
}

/**
 * Filter and sort properties with validation
 */
export function processProperties(
  properties: GA4Property[],
  filter: PropertyFilter,
  sort: PropertySort
): {
  properties: GA4Property[];
  validationResults: Map<string, PropertyValidationResult>;
} {
  const service = createPropertyValidationService();
  
  // Validate all properties
  const validationResults = service.validateProperties(properties);
  
  // Filter properties
  const filteredProperties = service.filterProperties(properties, filter);
  
  // Sort properties
  const sortedProperties = service.sortProperties(filteredProperties, sort);
  
  return {
    properties: sortedProperties,
    validationResults
  };
}

/**
 * Check if properties meet requirements for specific operation
 */
export function checkPropertiesForOperation(
  properties: GA4Property[],
  requiredPermissions: PropertyPermission[],
  minAccessLevel: PropertyAccessLevel = PropertyAccessLevel.READ_ONLY
): {
  validProperties: GA4Property[];
  invalidProperties: GA4Property[];
  issues: Map<string, string[]>;
} {
  const service = createPropertyValidationService();
  const validProperties: GA4Property[] = [];
  const invalidProperties: GA4Property[] = [];
  const issues = new Map<string, string[]>();
  
  for (const property of properties) {
    const propertyIssues: string[] = [];
    
    // Check access level
    if (!service.meetsMinimumAccessLevel(property, minAccessLevel)) {
      propertyIssues.push(`Insufficient access level (required: ${minAccessLevel}, has: ${property.accessLevel})`);
    }
    
    // Check permissions
    const missingPermissions = service.getMissingPermissions(property, requiredPermissions);
    if (missingPermissions.length > 0) {
      propertyIssues.push(`Missing permissions: ${missingPermissions.join(', ')}`);
    }
    
    // Check property status
    if (property.status !== PropertyStatus.ACTIVE) {
      propertyIssues.push(`Property is not active (status: ${property.status})`);
    }
    
    if (propertyIssues.length === 0) {
      validProperties.push(property);
    } else {
      invalidProperties.push(property);
      issues.set(property.id, propertyIssues);
    }
  }
  
  return {
    validProperties,
    invalidProperties,
    issues
  };
}

/**
 * Get property recommendations
 */
export function getPropertyRecommendations(property: GA4Property): string[] {
  const service = createPropertyValidationService();
  const healthSummary = service.getPropertyHealthSummary(property);
  return healthSummary.recommendations;
}