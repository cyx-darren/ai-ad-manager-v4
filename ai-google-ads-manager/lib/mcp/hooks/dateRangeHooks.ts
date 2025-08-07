/**
 * Enhanced Date Range Hooks for State Synchronization
 * 
 * Provides React hooks for synchronized date range management across all dashboard components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DateRange } from '@/contexts/DashboardContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { dateRangeSyncManager, DateRangeValidationResult, DateRangeEventData } from '../utils/dateRangeSync';
import { usePropertyContext } from '../context/PropertyContext';

export interface DateRangeHookOptions {
  enableValidation?: boolean;
  enablePersistence?: boolean;
  enablePropertySync?: boolean;
  autoCorrect?: boolean;
  onValidationError?: (errors: string[]) => void;
  onValidationWarning?: (warnings: string[]) => void;
}

export interface SyncedDateRangeResult {
  dateRange: DateRange;
  isLoading: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  setDateRange: (range: DateRange) => Promise<boolean>;
  setPresetDateRange: (preset: 'last7days' | 'last30days' | 'last90days') => Promise<boolean>;
  validateRange: (range: DateRange) => DateRangeValidationResult;
  resetToDefault: () => void;
  syncStatus: {
    lastSync: Date | null;
    syncSource: string | null;
    hasPendingSync: boolean;
  };
}

/**
 * Enhanced date range hook with full synchronization support
 */
export function useSyncedDateRange(options: DateRangeHookOptions = {}): SyncedDateRangeResult {
  const dashboard = useDashboard();
  const propertyContext = usePropertyContext();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null as Date | null,
    syncSource: null as string | null,
    hasPendingSync: false
  });
  const lastRangeRef = useRef<DateRange | null>(null);
  const pendingSyncRef = useRef<boolean>(false);

  const {
    enableValidation = true,
    enablePersistence = true,
    enablePropertySync = true,
    autoCorrect = true,
    onValidationError,
    onValidationWarning
  } = options;

  // Validate a date range without setting it
  const validateRange = useCallback((range: DateRange): DateRangeValidationResult => {
    if (!enableValidation) {
      return { isValid: true, errors: [], warnings: [] };
    }
    return dateRangeSyncManager.validateDateRange(range);
  }, [enableValidation]);

  // Set date range with validation and synchronization
  const setDateRange = useCallback(async (range: DateRange): Promise<boolean> => {
    setIsLoading(true);
    setErrors([]);
    setWarnings([]);

    try {
      let finalRange = range;

      // Validate if enabled
      if (enableValidation) {
        const validation = validateRange(range);
        
        if (!validation.isValid) {
          if (autoCorrect && validation.adjustedRange) {
            finalRange = validation.adjustedRange;
            setWarnings(validation.warnings || []);
            onValidationWarning?.(validation.warnings || []);
          } else {
            setErrors(validation.errors || []);
            onValidationError?.(validation.errors || []);
            return false;
          }
        } else if (validation.warnings && validation.warnings.length > 0) {
          setWarnings(validation.warnings);
          onValidationWarning?.(validation.warnings);
        }
      }

      // Normalize the range
      finalRange = dateRangeSyncManager.normalizeDateRange(finalRange);

      // Update dashboard context
      dashboard.setDateRange(finalRange);

      // Persist if enabled
      if (enablePersistence) {
        const propertyId = enablePropertySync ? propertyContext?.selectedProperty?.id : undefined;
        dateRangeSyncManager.persistDateRange(finalRange, propertyId);
      }

      // Update sync status
      setSyncStatus({
        lastSync: new Date(),
        syncSource: 'user',
        hasPendingSync: false
      });

      lastRangeRef.current = finalRange;
      return true;

    } catch (error) {
      console.error('Error setting date range:', error);
      setErrors(['Failed to update date range']);
      onValidationError?.(['Failed to update date range']);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    dashboard, 
    enableValidation, 
    enablePersistence, 
    enablePropertySync,
    autoCorrect,
    validateRange,
    propertyContext?.selectedProperty?.id,
    onValidationError,
    onValidationWarning
  ]);

  // Set preset date range
  const setPresetDateRange = useCallback(async (preset: 'last7days' | 'last30days' | 'last90days'): Promise<boolean> => {
    const presetRange = dateRangeSyncManager.getPresetDateRange(preset);
    return await setDateRange(presetRange);
  }, [setDateRange]);

  // Reset to default range
  const resetToDefault = useCallback(() => {
    const defaultRange = dateRangeSyncManager.getPresetDateRange('last30days');
    setDateRange(defaultRange);
  }, [setDateRange]);

  // Initialize and restore persisted range on mount
  useEffect(() => {
    if (enablePersistence) {
      const propertyId = enablePropertySync ? propertyContext?.selectedProperty?.id : undefined;
      const restoredRange = dateRangeSyncManager.restoreDateRange(propertyId);
      
      if (restoredRange && restoredRange !== lastRangeRef.current) {
        dashboard.setDateRange(restoredRange);
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
      if (data.dateRange && data.dateRange !== lastRangeRef.current) {
        setSyncStatus({
          lastSync: new Date(),
          syncSource: data.source || 'sync',
          hasPendingSync: true
        });

        // Update dashboard context with synced range
        setTimeout(() => {
          dashboard.setDateRange(data.dateRange);
          setSyncStatus(prev => ({
            ...prev,
            hasPendingSync: false
          }));
        }, 100);
      }
    };

    dateRangeSyncManager.addEventListener('sync', handleSyncEvent);

    return () => {
      dateRangeSyncManager.removeEventListener('sync', handleSyncEvent);
    };
  }, [dashboard]);

  // Listen for property changes and sync range if needed
  useEffect(() => {
    if (enablePropertySync && propertyContext?.selectedProperty?.id) {
      const propertyId = propertyContext.selectedProperty.id;
      const propertyRange = dateRangeSyncManager.restoreDateRange(propertyId);
      
      if (propertyRange && JSON.stringify(propertyRange) !== JSON.stringify(dashboard.state.dateRange)) {
        dashboard.setDateRange(propertyRange);
        setSyncStatus({
          lastSync: new Date(),
          syncSource: 'property-change',
          hasPendingSync: false
        });
      }
    }
  }, [enablePropertySync, propertyContext?.selectedProperty?.id, dashboard]);

  // Update last range reference when dashboard range changes
  useEffect(() => {
    lastRangeRef.current = dashboard.state.dateRange;
  }, [dashboard.state.dateRange]);

  return {
    dateRange: dashboard.state.dateRange,
    isLoading,
    isValid: errors.length === 0,
    errors,
    warnings,
    setDateRange,
    setPresetDateRange,
    validateRange,
    resetToDefault,
    syncStatus
  };
}

/**
 * Hook for cross-component date range synchronization monitoring
 */
export function useDateRangeSync() {
  const [syncEvents, setSyncEvents] = useState<DateRangeEventData[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const handleSyncEvent = (data: DateRangeEventData) => {
      setSyncEvents(prev => [...prev.slice(-9), data]); // Keep last 10 events
    };

    const handleErrorEvent = (error: any) => {
      console.error('Date range sync error:', error);
      setIsConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => setIsConnected(true), 5000);
    };

    dateRangeSyncManager.addEventListener('sync', handleSyncEvent);
    dateRangeSyncManager.addEventListener('error', handleErrorEvent);

    return () => {
      dateRangeSyncManager.removeEventListener('sync', handleSyncEvent);
      dateRangeSyncManager.removeEventListener('error', handleErrorEvent);
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
    syncManager: dateRangeSyncManager
  };
}

/**
 * Hook for date range validation utilities
 */
export function useDateRangeValidation() {
  const validateRange = useCallback((range: DateRange) => {
    return dateRangeSyncManager.validateDateRange(range);
  }, []);

  const normalizeRange = useCallback((range: DateRange) => {
    return dateRangeSyncManager.normalizeDateRange(range);
  }, []);

  const getPresetRange = useCallback((preset: 'last7days' | 'last30days' | 'last90days') => {
    return dateRangeSyncManager.getPresetDateRange(preset);
  }, []);

  const getLimits = useCallback(() => {
    return dateRangeSyncManager.getLimits();
  }, []);

  const formatDateForDisplay = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const calculateRangeDays = useCallback((range: DateRange) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  return {
    validateRange,
    normalizeRange,
    getPresetRange,
    getLimits,
    formatDateForDisplay,
    calculateRangeDays
  };
}

export default useSyncedDateRange;