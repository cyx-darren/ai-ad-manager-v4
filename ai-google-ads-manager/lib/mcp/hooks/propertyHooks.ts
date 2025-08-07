/**
 * Property Management Hooks
 * 
 * React hooks for managing GA4 property selection, discovery, caching,
 * and validation within the MCP client system.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  GA4Property, 
  PropertySelectionState,
  PropertyFilter,
  PropertySort,
  PropertyValidationResult,
  PropertyDiscoveryConfig,
  PropertyError,
  PropertyErrorCode,
  PropertyAccessLevel,
  PropertyPermission,
  DEFAULT_PROPERTY_FILTER,
  DEFAULT_PROPERTY_SORT,
  DEFAULT_PROPERTY_DISCOVERY_CONFIG
} from '../types/property';

import { 
  PropertyDiscoveryService,
  createPropertyDiscoveryService,
  discoverGA4Properties
} from '../utils/propertyDiscovery';

import {
  PropertyValidationService,
  createPropertyValidationService,
  validateGA4Property,
  processProperties
} from '../utils/propertyValidation';

import {
  PropertyCacheService,
  getPropertyCache,
  PropertyCacheUtils
} from '../utils/propertyCache';

import { useMCPClient } from '../context/MCPContext';

// Property selection hook with persistence
export function usePropertySelection(initialPropertyId?: string) {
  const mcpClient = useMCPClient();
  const [selectionState, setSelectionState] = useState<PropertySelectionState>({
    selectedProperty: null,
    availableProperties: [],
    isLoading: false,
    error: null,
    lastRefresh: null,
    filter: DEFAULT_PROPERTY_FILTER,
    sort: DEFAULT_PROPERTY_SORT
  });

  const cache = useMemo(() => getPropertyCache('property-selection'), []);
  const discoveryService = useMemo(() => createPropertyDiscoveryService(mcpClient), [mcpClient]);

  // Load persisted property selection
  useEffect(() => {
    const loadPersistedSelection = async () => {
      try {
        const persistedPropertyId = localStorage.getItem('ga4-selected-property-id');
        const targetPropertyId = initialPropertyId || persistedPropertyId;

        if (targetPropertyId) {
          const cachedProperty = cache.get(targetPropertyId);
          if (cachedProperty) {
            setSelectionState(prev => ({
              ...prev,
              selectedProperty: cachedProperty
            }));
          }
        }
      } catch (error) {
        console.warn('Failed to load persisted property selection:', error);
      }
    };

    loadPersistedSelection();
  }, [initialPropertyId, cache]);

  // Select property
  const selectProperty = useCallback(async (property: GA4Property) => {
    try {
      setSelectionState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      // Validate property access
      const accessInfo = await discoveryService.validatePropertyAccess(property.id);
      if (!accessInfo.hasAccess) {
        throw new Error(`No access to property ${property.name}`);
      }

      // Update property with access information
      const updatedProperty = {
        ...property,
        accessLevel: accessInfo.accessLevel,
        permissions: accessInfo.permissions
      };

      // Cache the property
      cache.set(updatedProperty);

      // Persist selection
      localStorage.setItem('ga4-selected-property-id', property.id);

      setSelectionState(prev => ({
        ...prev,
        selectedProperty: updatedProperty,
        isLoading: false
      }));

      console.log(`✅ Selected property: ${property.name} (${property.id})`);
    } catch (error) {
      const propertyError: PropertyError = {
        code: PropertyErrorCode.VALIDATION_FAILED,
        message: error instanceof Error ? error.message : 'Failed to select property',
        details: error,
        timestamp: new Date().toISOString(),
        retryable: true,
        suggestedAction: 'Check property permissions and try again'
      };

      setSelectionState(prev => ({
        ...prev,
        error: propertyError,
        isLoading: false
      }));

      console.error(`❌ Failed to select property ${property.name}:`, error);
    }
  }, [discoveryService, cache]);

  // Clear property selection
  const clearSelection = useCallback(() => {
    localStorage.removeItem('ga4-selected-property-id');
    setSelectionState(prev => ({
      ...prev,
      selectedProperty: null,
      error: null
    }));
    console.log('🗑️ Cleared property selection');
  }, []);

  // Refresh properties
  const refreshProperties = useCallback(async () => {
    try {
      setSelectionState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const properties = await discoveryService.discoverProperties();
      
      setSelectionState(prev => ({
        ...prev,
        availableProperties: properties,
        isLoading: false,
        lastRefresh: new Date().toISOString()
      }));

      console.log(`🔄 Refreshed ${properties.length} properties`);
    } catch (error) {
      const propertyError: PropertyError = {
        code: PropertyErrorCode.DISCOVERY_FAILED,
        message: error instanceof Error ? error.message : 'Failed to refresh properties',
        details: error,
        timestamp: new Date().toISOString(),
        retryable: true,
        suggestedAction: 'Check your Google Analytics permissions and try again'
      };

      setSelectionState(prev => ({
        ...prev,
        error: propertyError,
        isLoading: false
      }));

      console.error('❌ Failed to refresh properties:', error);
    }
  }, [discoveryService]);

  // Update filter
  const updateFilter = useCallback((newFilter: Partial<PropertyFilter>) => {
    setSelectionState(prev => ({
      ...prev,
      filter: { ...prev.filter, ...newFilter }
    }));
  }, []);

  // Update sort
  const updateSort = useCallback((newSort: PropertySort) => {
    setSelectionState(prev => ({
      ...prev,
      sort: newSort
    }));
  }, []);

  return {
    ...selectionState,
    selectProperty,
    clearSelection,
    refreshProperties,
    updateFilter,
    updateSort
  };
}

// Property discovery hook for fetching available properties
export function usePropertyDiscovery(config?: Partial<PropertyDiscoveryConfig>) {
  const mcpClient = useMCPClient();
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PropertyError | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const discoveryService = useMemo(() => createPropertyDiscoveryService(mcpClient, config), [mcpClient, config]);
  const cache = useMemo(() => getPropertyCache('property-discovery'), []);

  // Discover properties
  const discoverProperties = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedProperties = cache.getAllValidCached();
        if (cachedProperties.length > 0) {
          setProperties(cachedProperties);
          setLastFetch(new Date().toISOString());
          setIsLoading(false);
          return cachedProperties;
        }
      }

      const discoveredProperties = await discoveryService.discoverProperties();
      
      // Cache the properties
      cache.setMultiple(discoveredProperties);
      
      setProperties(discoveredProperties);
      setLastFetch(new Date().toISOString());
      setIsLoading(false);

      return discoveredProperties;
    } catch (err) {
      const propertyError: PropertyError = {
        code: PropertyErrorCode.DISCOVERY_FAILED,
        message: err instanceof Error ? err.message : 'Failed to discover properties',
        details: err,
        timestamp: new Date().toISOString(),
        retryable: true,
        suggestedAction: 'Check your Google Analytics permissions and network connection'
      };

      setError(propertyError);
      setIsLoading(false);
      return [];
    }
  }, [discoveryService, cache]);

  // Auto-discover on mount
  useEffect(() => {
    discoverProperties();
  }, [discoverProperties]);

  return {
    properties,
    isLoading,
    error,
    lastFetch,
    discoverProperties,
    refreshProperties: () => discoverProperties(true)
  };
}

// Property cache management hook
export function usePropertyCache(context: string = 'default') {
  const cache = useMemo(() => getPropertyCache(context), [context]);
  const [cacheStats, setCacheStats] = useState(cache.getStats());

  // Update stats periodically
  useEffect(() => {
    const updateStats = () => setCacheStats(cache.getStats());
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [cache]);

  const cacheProperty = useCallback((property: GA4Property) => {
    cache.set(property);
    setCacheStats(cache.getStats());
  }, [cache]);

  const getCachedProperty = useCallback((propertyId: string) => {
    return cache.get(propertyId);
  }, [cache]);

  const removeCachedProperty = useCallback((propertyId: string) => {
    const removed = cache.delete(propertyId);
    if (removed) {
      setCacheStats(cache.getStats());
    }
    return removed;
  }, [cache]);

  const clearCache = useCallback(() => {
    cache.clear();
    setCacheStats(cache.getStats());
  }, [cache]);

  const preloadProperties = useCallback(async (
    propertyIds: string[],
    fetchFunction: (id: string) => Promise<GA4Property>
  ) => {
    await cache.preload(propertyIds, fetchFunction);
    setCacheStats(cache.getStats());
  }, [cache]);

  return {
    cacheStats,
    cacheProperty,
    getCachedProperty,
    removeCachedProperty,
    clearCache,
    preloadProperties,
    hasProperty: cache.has.bind(cache),
    getAllCached: cache.getAllValidCached.bind(cache)
  };
}

// Property validation hook for validation workflows
export function usePropertyValidation() {
  const [validationResults, setValidationResults] = useState<Map<string, PropertyValidationResult>>(new Map());
  const [isValidating, setIsValidating] = useState(false);

  const validationService = useMemo(() => createPropertyValidationService(), []);

  const validateProperty = useCallback(async (property: GA4Property) => {
    setIsValidating(true);
    
    try {
      const result = validationService.validateProperty(property);
      setValidationResults(prev => new Map(prev).set(property.id, result));
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [validationService]);

  const validateProperties = useCallback(async (properties: GA4Property[]) => {
    setIsValidating(true);
    
    try {
      const results = validationService.validateProperties(properties);
      setValidationResults(results);
      return results;
    } finally {
      setIsValidating(false);
    }
  }, [validationService]);

  const filterAndSortProperties = useCallback((
    properties: GA4Property[],
    filter: PropertyFilter,
    sort: PropertySort
  ) => {
    return processProperties(properties, filter, sort);
  }, []);

  const checkPropertyPermissions = useCallback((
    property: GA4Property,
    requiredPermissions: PropertyPermission[],
    minAccessLevel: PropertyAccessLevel = PropertyAccessLevel.READ_ONLY
  ) => {
    const hasPermissions = validationService.hasRequiredPermissions(property, requiredPermissions);
    const hasAccessLevel = validationService.meetsMinimumAccessLevel(property, minAccessLevel);
    const missingPermissions = validationService.getMissingPermissions(property, requiredPermissions);

    return {
      isValid: hasPermissions && hasAccessLevel,
      hasPermissions,
      hasAccessLevel,
      missingPermissions
    };
  }, [validationService]);

  const getPropertyRecommendations = useCallback((property: GA4Property) => {
    const healthSummary = validationService.getPropertyHealthSummary(property);
    return healthSummary.recommendations;
  }, [validationService]);

  return {
    validationResults,
    isValidating,
    validateProperty,
    validateProperties,
    filterAndSortProperties,
    checkPropertyPermissions,
    getPropertyRecommendations
  };
}

// Property permissions hook for access control
export function usePropertyPermissions(property: GA4Property | null) {
  const validationService = useMemo(() => createPropertyValidationService(), []);

  const permissions = useMemo(() => {
    if (!property) return null;

    return {
      canRead: property.permissions.includes(PropertyPermission.READ_DATA),
      canEdit: property.permissions.includes(PropertyPermission.EDIT_DATA),
      canManageUsers: property.permissions.includes(PropertyPermission.MANAGE_USERS),
      canManageSettings: property.permissions.includes(PropertyPermission.MANAGE_SETTINGS),
      canDelete: property.permissions.includes(PropertyPermission.DELETE_PROPERTY),
      accessLevel: property.accessLevel,
      allPermissions: property.permissions
    };
  }, [property]);

  const checkPermission = useCallback((permission: PropertyPermission) => {
    return property?.permissions.includes(permission) ?? false;
  }, [property]);

  const checkMinimumAccess = useCallback((minAccessLevel: PropertyAccessLevel) => {
    if (!property) return false;
    return validationService.meetsMinimumAccessLevel(property, minAccessLevel);
  }, [property, validationService]);

  const checkRequiredPermissions = useCallback((requiredPermissions: PropertyPermission[]) => {
    if (!property) return false;
    return validationService.hasRequiredPermissions(property, requiredPermissions);
  }, [property, validationService]);

  return {
    permissions,
    checkPermission,
    checkMinimumAccess,
    checkRequiredPermissions
  };
}

// Combined property management hook
export function usePropertyManager(initialPropertyId?: string) {
  const selection = usePropertySelection(initialPropertyId);
  const discovery = usePropertyDiscovery();
  const cache = usePropertyCache();
  const validation = usePropertyValidation();
  const permissions = usePropertyPermissions(selection.selectedProperty);

  const isInitialized = useMemo(() => {
    return !discovery.isLoading && discovery.properties.length > 0;
  }, [discovery.isLoading, discovery.properties.length]);

  return {
    // Selection state
    selectedProperty: selection.selectedProperty,
    availableProperties: selection.availableProperties,
    isLoading: selection.isLoading || discovery.isLoading,
    error: selection.error || discovery.error,
    
    // Selection actions
    selectProperty: selection.selectProperty,
    clearSelection: selection.clearSelection,
    refreshProperties: selection.refreshProperties,
    
    // Discovery
    discoverProperties: discovery.discoverProperties,
    
    // Cache
    cache,
    
    // Validation
    validation,
    
    // Permissions
    permissions,
    
    // Combined state
    isInitialized
  };
}

export default {
  usePropertySelection,
  usePropertyDiscovery,
  usePropertyCache,
  usePropertyValidation,
  usePropertyPermissions,
  usePropertyManager
};