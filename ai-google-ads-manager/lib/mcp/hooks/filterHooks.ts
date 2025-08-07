/**
 * Enhanced Filter Hooks for State Synchronization
 * 
 * Provides React hooks for synchronized filter management across all dashboard components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardFilters } from '@/contexts/DashboardContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { 
  filterSyncManager, 
  FilterValidationResult, 
  FilterEventData,
  FilterPreset,
  FilterConflict
} from '../utils/filterSync';
import { usePropertyContext } from '../context/PropertyContext';

export interface FilterHookOptions {
  enableValidation?: boolean;
  enablePersistence?: boolean;
  enablePropertySync?: boolean;
  enableDependencyTracking?: boolean;
  autoResolveConflicts?: boolean;
  onValidationError?: (errors: string[]) => void;
  onValidationWarning?: (warnings: string[]) => void;
  onConflictDetected?: (conflicts: FilterConflict[]) => void;
}

export interface SyncedFilterResult {
  filters: DashboardFilters;
  isLoading: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: FilterConflict[];
  setFilters: (filters: Partial<DashboardFilters>) => Promise<boolean>;
  clearFilters: () => void;
  resetToDefault: () => void;
  applyPreset: (presetId: string) => Promise<boolean>;
  toggleGoogleAdsHighlight: () => void;
  addTrafficSource: (source: string) => Promise<boolean>;
  removeTrafficSource: (source: string) => Promise<boolean>;
  addDeviceCategory: (category: string) => Promise<boolean>;
  removeDeviceCategory: (category: string) => Promise<boolean>;
  validateFilters: (filters: DashboardFilters) => FilterValidationResult;
  syncStatus: {
    lastSync: Date | null;
    syncSource: string | null;
    hasPendingSync: boolean;
  };
  stats: {
    totalTrafficSources: number;
    totalDeviceCategories: number;
    totalCustomFilters: number;
    hasActiveFilters: boolean;
    complexity: number;
  };
}

/**
 * Enhanced filter hook with full synchronization support
 */
export function useSyncedFilters(options: FilterHookOptions = {}): SyncedFilterResult {
  const dashboard = useDashboard();
  const propertyContext = usePropertyContext();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<FilterConflict[]>([]);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null as Date | null,
    syncSource: null as string | null,
    hasPendingSync: false
  });
  const lastFiltersRef = useRef<DashboardFilters | null>(null);

  const {
    enableValidation = true,
    enablePersistence = true,
    enablePropertySync = true,
    enableDependencyTracking = true,
    autoResolveConflicts = true,
    onValidationError,
    onValidationWarning,
    onConflictDetected
  } = options;

  // Validate filters without setting them
  const validateFilters = useCallback((filters: DashboardFilters): FilterValidationResult => {
    if (!enableValidation) {
      return { isValid: true, errors: [], warnings: [], conflicts: [] };
    }
    return filterSyncManager.validateFilters(filters);
  }, [enableValidation]);

  // Set filters with validation and synchronization
  const setFilters = useCallback(async (newFilters: Partial<DashboardFilters>): Promise<boolean> => {
    setIsLoading(true);
    setErrors([]);
    setWarnings([]);
    setConflicts([]);

    try {
      // Merge with current filters
      let mergedFilters: DashboardFilters = {
        ...dashboard.state.filters,
        ...newFilters
      };

      // Apply filter dependencies if enabled
      if (enableDependencyTracking) {
        mergedFilters = filterSyncManager.applyFilterDependencies(mergedFilters);
      }

      // Validate if enabled
      if (enableValidation) {
        const validation = validateFilters(mergedFilters);
        
        if (!validation.isValid) {
          if (autoResolveConflicts && validation.adjustedFilters) {
            mergedFilters = validation.adjustedFilters;
            setWarnings(validation.warnings || []);
            onValidationWarning?.(validation.warnings || []);
          } else {
            setErrors(validation.errors || []);
            setConflicts(validation.conflicts || []);
            onValidationError?.(validation.errors || []);
            onConflictDetected?.(validation.conflicts || []);
            return false;
          }
        } else {
          if (validation.warnings && validation.warnings.length > 0) {
            setWarnings(validation.warnings);
            onValidationWarning?.(validation.warnings);
          }
          if (validation.conflicts && validation.conflicts.length > 0) {
            setConflicts(validation.conflicts);
            onConflictDetected?.(validation.conflicts);
          }
        }
      }

      // Normalize the filters
      mergedFilters = filterSyncManager.normalizeFilters(mergedFilters);

      // Update dashboard context
      dashboard.setFilters(mergedFilters);

      // Persist if enabled
      if (enablePersistence) {
        const propertyId = enablePropertySync ? propertyContext?.selectedProperty?.id : undefined;
        filterSyncManager.persistFilters(mergedFilters, propertyId);
      }

      // Update sync status
      setSyncStatus({
        lastSync: new Date(),
        syncSource: 'user',
        hasPendingSync: false
      });

      lastFiltersRef.current = mergedFilters;
      return true;

    } catch (error) {
      console.error('Error setting filters:', error);
      setErrors(['Failed to update filters']);
      onValidationError?.(['Failed to update filters']);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    dashboard, 
    enableValidation, 
    enablePersistence, 
    enablePropertySync,
    enableDependencyTracking,
    autoResolveConflicts,
    validateFilters,
    propertyContext?.selectedProperty?.id,
    onValidationError,
    onValidationWarning,
    onConflictDetected
  ]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    const defaultFilters: DashboardFilters = {
      highlightGoogleAds: false,
      trafficSources: [],
      deviceCategories: [],
      customFilters: {}
    };
    setFilters(defaultFilters);
  }, [setFilters]);

  // Reset to default filters
  const resetToDefault = useCallback(() => {
    const defaultFilters: DashboardFilters = {
      highlightGoogleAds: true,
      trafficSources: [],
      deviceCategories: [],
      customFilters: {}
    };
    setFilters(defaultFilters);
  }, [setFilters]);

  // Apply filter preset
  const applyPreset = useCallback(async (presetId: string): Promise<boolean> => {
    try {
      const presetFilters = filterSyncManager.applyFilterPreset(presetId, dashboard.state.filters);
      return await setFilters(presetFilters);
    } catch (error) {
      console.error('Error applying filter preset:', error);
      setErrors([`Failed to apply preset '${presetId}'`]);
      return false;
    }
  }, [dashboard.state.filters, setFilters]);

  // Toggle Google Ads highlight
  const toggleGoogleAdsHighlight = useCallback(() => {
    setFilters({ highlightGoogleAds: !dashboard.state.filters.highlightGoogleAds });
  }, [dashboard.state.filters.highlightGoogleAds, setFilters]);

  // Add traffic source
  const addTrafficSource = useCallback(async (source: string): Promise<boolean> => {
    const currentSources = dashboard.state.filters.trafficSources || [];
    if (!currentSources.includes(source)) {
      return await setFilters({ 
        trafficSources: [...currentSources, source] 
      });
    }
    return true;
  }, [dashboard.state.filters.trafficSources, setFilters]);

  // Remove traffic source
  const removeTrafficSource = useCallback(async (source: string): Promise<boolean> => {
    const currentSources = dashboard.state.filters.trafficSources || [];
    return await setFilters({ 
      trafficSources: currentSources.filter(s => s !== source) 
    });
  }, [dashboard.state.filters.trafficSources, setFilters]);

  // Add device category
  const addDeviceCategory = useCallback(async (category: string): Promise<boolean> => {
    const currentCategories = dashboard.state.filters.deviceCategories || [];
    if (!currentCategories.includes(category)) {
      return await setFilters({ 
        deviceCategories: [...currentCategories, category] 
      });
    }
    return true;
  }, [dashboard.state.filters.deviceCategories, setFilters]);

  // Remove device category
  const removeDeviceCategory = useCallback(async (category: string): Promise<boolean> => {
    const currentCategories = dashboard.state.filters.deviceCategories || [];
    return await setFilters({ 
      deviceCategories: currentCategories.filter(c => c !== category) 
    });
  }, [dashboard.state.filters.deviceCategories, setFilters]);

  // Calculate filter statistics
  const stats = useMemo(() => {
    return filterSyncManager.getFilterStats(dashboard.state.filters);
  }, [dashboard.state.filters]);

  // Initialize and restore persisted filters on mount
  useEffect(() => {
    if (enablePersistence) {
      const propertyId = enablePropertySync ? propertyContext?.selectedProperty?.id : undefined;
      const restoredFilters = filterSyncManager.restoreFilters(propertyId);
      
      if (restoredFilters && JSON.stringify(restoredFilters) !== JSON.stringify(lastFiltersRef.current)) {
        dashboard.setFilters(restoredFilters);
        setSyncStatus({
          lastSync: new Date(),
          syncSource: 'restore',
          hasPendingSync: false
        });
      }
    }
  }, [
    enablePersistence, 
    enablePropertySync, 
    propertyContext?.selectedProperty?.id,
    dashboard
  ]);

  // Listen for sync events from other tabs/components
  useEffect(() => {
    const handleSyncEvent = (data: any) => {
      if (data.filters && JSON.stringify(data.filters) !== JSON.stringify(lastFiltersRef.current)) {
        setSyncStatus({
          lastSync: new Date(),
          syncSource: data.source || 'sync',
          hasPendingSync: true
        });

        // Update dashboard context with synced filters
        setTimeout(() => {
          dashboard.setFilters(data.filters);
          setSyncStatus(prev => ({
            ...prev,
            hasPendingSync: false
          }));
        }, 100);
      }
    };

    filterSyncManager.addEventListener('sync', handleSyncEvent);

    return () => {
      filterSyncManager.removeEventListener('sync', handleSyncEvent);
    };
  }, [dashboard]);

  // Listen for property changes and sync filters if needed
  useEffect(() => {
    if (enablePropertySync && propertyContext?.selectedProperty?.id) {
      const propertyId = propertyContext.selectedProperty.id;
      const propertyFilters = filterSyncManager.restoreFilters(propertyId);
      
      if (propertyFilters && JSON.stringify(propertyFilters) !== JSON.stringify(dashboard.state.filters)) {
        dashboard.setFilters(propertyFilters);
        setSyncStatus({
          lastSync: new Date(),
          syncSource: 'property-change',
          hasPendingSync: false
        });
      }
    }
  }, [enablePropertySync, propertyContext?.selectedProperty?.id, dashboard]);

  // Update last filters reference when dashboard filters change
  useEffect(() => {
    lastFiltersRef.current = dashboard.state.filters;
  }, [dashboard.state.filters]);

  return {
    filters: dashboard.state.filters,
    isLoading,
    isValid: errors.length === 0 && conflicts.length === 0,
    errors,
    warnings,
    conflicts,
    setFilters,
    clearFilters,
    resetToDefault,
    applyPreset,
    toggleGoogleAdsHighlight,
    addTrafficSource,
    removeTrafficSource,
    addDeviceCategory,
    removeDeviceCategory,
    validateFilters,
    syncStatus,
    stats
  };
}

/**
 * Hook for filter presets management
 */
export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    setPresets(filterSyncManager.getFilterPresets());
  }, []);

  const refreshPresets = useCallback(() => {
    setPresets(filterSyncManager.getFilterPresets());
  }, []);

  const getPresetsByTag = useCallback((tag: string) => {
    return presets.filter(preset => preset.tags.includes(tag));
  }, [presets]);

  const findPreset = useCallback((id: string) => {
    return presets.find(preset => preset.id === id);
  }, [presets]);

  return {
    presets,
    refreshPresets,
    getPresetsByTag,
    findPreset
  };
}

/**
 * Hook for filter synchronization monitoring
 */
export function useFilterSync() {
  const [syncEvents, setSyncEvents] = useState<FilterEventData[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const handleSyncEvent = (data: FilterEventData) => {
      setSyncEvents(prev => [...prev.slice(-9), data]); // Keep last 10 events
    };

    const handleErrorEvent = (error: any) => {
      console.error('Filter sync error:', error);
      setIsConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => setIsConnected(true), 5000);
    };

    filterSyncManager.addEventListener('sync', handleSyncEvent);
    filterSyncManager.addEventListener('error', handleErrorEvent);

    return () => {
      filterSyncManager.removeEventListener('sync', handleSyncEvent);
      filterSyncManager.removeEventListener('error', handleErrorEvent);
    };
  }, []);

  const clearSyncHistory = useCallback(() => {
    setSyncEvents([]);
  }, []);

  const getLastSyncEvent = useCallback(() => {
    return syncEvents[syncEvents.length - 1] || null;
  }, [syncEvents]);

  const getSyncEventsBySource = useCallback((source: string) => {
    return syncEvents.filter(event => event.source === source);
  }, [syncEvents]);

  return {
    syncEvents,
    isConnected,
    lastSyncEvent: getLastSyncEvent(),
    clearSyncHistory,
    getSyncEventsBySource,
    syncManager: filterSyncManager
  };
}

/**
 * Hook for filter validation utilities
 */
export function useFilterValidation() {
  const validateFilters = useCallback((filters: DashboardFilters) => {
    return filterSyncManager.validateFilters(filters);
  }, []);

  const normalizeFilters = useCallback((filters: DashboardFilters) => {
    return filterSyncManager.normalizeFilters(filters);
  }, []);

  const applyDependencies = useCallback((filters: DashboardFilters) => {
    return filterSyncManager.applyFilterDependencies(filters);
  }, []);

  const getFilterStats = useCallback((filters: DashboardFilters) => {
    return filterSyncManager.getFilterStats(filters);
  }, []);

  const checkFilterComplexity = useCallback((filters: DashboardFilters) => {
    const stats = filterSyncManager.getFilterStats(filters);
    return {
      complexity: stats.complexity,
      isSimple: stats.complexity < 20,
      isModerate: stats.complexity >= 20 && stats.complexity < 50,
      isComplex: stats.complexity >= 50
    };
  }, []);

  return {
    validateFilters,
    normalizeFilters,
    applyDependencies,
    getFilterStats,
    checkFilterComplexity
  };
}

export default useSyncedFilters;