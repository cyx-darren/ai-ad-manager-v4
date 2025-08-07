/**
 * Property Management Context
 * 
 * React context for managing GA4 property selection state across the application.
 * Integrates with the existing DashboardContext for seamless state management.
 */

'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { 
  GA4Property, 
  PropertySelectionState,
  PropertyFilter,
  PropertySort,
  PropertyError,
  PropertyErrorCode,
  DEFAULT_PROPERTY_FILTER,
  DEFAULT_PROPERTY_SORT
} from '../types/property';

import { 
  PropertyPersistenceService,
  getPropertyPersistenceService
} from '../utils/propertyPersistence';

import { usePropertyManager } from '../hooks/propertyHooks';

// Property context state
export interface PropertyContextState extends PropertySelectionState {
  isInitialized: boolean;
  persistenceEnabled: boolean;
}

// Property context actions
export type PropertyAction =
  | { type: 'SET_SELECTED_PROPERTY'; payload: GA4Property | null }
  | { type: 'SET_AVAILABLE_PROPERTIES'; payload: GA4Property[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: PropertyError | null }
  | { type: 'SET_FILTER'; payload: PropertyFilter }
  | { type: 'SET_SORT'; payload: PropertySort }
  | { type: 'SET_LAST_REFRESH'; payload: string | null }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'RESET_STATE' };

// Property context value
export interface PropertyContextValue {
  state: PropertyContextState;
  actions: {
    selectProperty: (property: GA4Property) => Promise<void>;
    clearSelection: () => void;
    refreshProperties: () => Promise<void>;
    updateFilter: (filter: Partial<PropertyFilter>) => void;
    updateSort: (sort: PropertySort) => void;
    resetState: () => void;
  };
}

// Initial state
const initialState: PropertyContextState = {
  selectedProperty: null,
  availableProperties: [],
  isLoading: false,
  error: null,
  lastRefresh: null,
  filter: DEFAULT_PROPERTY_FILTER,
  sort: DEFAULT_PROPERTY_SORT,
  isInitialized: false,
  persistenceEnabled: true
};

// Property reducer
function propertyReducer(state: PropertyContextState, action: PropertyAction): PropertyContextState {
  switch (action.type) {
    case 'SET_SELECTED_PROPERTY':
      return {
        ...state,
        selectedProperty: action.payload,
        error: action.payload ? null : state.error // Clear error when successfully selecting
      };

    case 'SET_AVAILABLE_PROPERTIES':
      return {
        ...state,
        availableProperties: action.payload
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false // Clear loading when error occurs
      };

    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload
      };

    case 'SET_SORT':
      return {
        ...state,
        sort: action.payload
      };

    case 'SET_LAST_REFRESH':
      return {
        ...state,
        lastRefresh: action.payload
      };

    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.payload
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        persistenceEnabled: state.persistenceEnabled
      };

    default:
      return state;
  }
}

// Property context
const PropertyContext = createContext<PropertyContextValue | null>(null);

// Property context provider props
export interface PropertyProviderProps {
  children: ReactNode;
  initialPropertyId?: string;
  persistenceEnabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Property context provider
export function PropertyProvider({ 
  children, 
  initialPropertyId,
  persistenceEnabled = true,
  autoRefresh = false,
  refreshInterval = 5 * 60 * 1000 // 5 minutes
}: PropertyProviderProps) {
  const [state, dispatch] = useReducer(propertyReducer, {
    ...initialState,
    persistenceEnabled
  });

  const persistenceService = useMemo(() => {
    return persistenceEnabled ? getPropertyPersistenceService() : null;
  }, [persistenceEnabled]);

  const propertyManager = usePropertyManager(initialPropertyId);

  // Sync property manager state with context state
  useEffect(() => {
    dispatch({ type: 'SET_SELECTED_PROPERTY', payload: propertyManager.selectedProperty });
  }, [propertyManager.selectedProperty]);

  useEffect(() => {
    dispatch({ type: 'SET_AVAILABLE_PROPERTIES', payload: propertyManager.availableProperties });
  }, [propertyManager.availableProperties]);

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: propertyManager.isLoading });
  }, [propertyManager.isLoading]);

  useEffect(() => {
    dispatch({ type: 'SET_ERROR', payload: propertyManager.error });
  }, [propertyManager.error]);

  useEffect(() => {
    dispatch({ type: 'SET_INITIALIZED', payload: propertyManager.isInitialized });
  }, [propertyManager.isInitialized]);

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      if (!persistenceService) return;

      try {
        const persistedState = await persistenceService.loadPropertyState();
        if (persistedState) {
          if (persistedState.selectedProperty) {
            dispatch({ type: 'SET_SELECTED_PROPERTY', payload: persistedState.selectedProperty });
          }
          dispatch({ type: 'SET_FILTER', payload: persistedState.filter });
          dispatch({ type: 'SET_SORT', payload: persistedState.sort });
          
          console.log('📂 Loaded persisted property state');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load persisted property state:', error);
      }
    };

    loadPersistedState();
  }, [persistenceService]);

  // Persist state changes
  useEffect(() => {
    if (!persistenceService || !state.isInitialized) return;

    const persistState = async () => {
      try {
        await persistenceService.savePropertyState({
          selectedProperty: state.selectedProperty,
          filter: state.filter,
          sort: state.sort
        });
      } catch (error) {
        console.warn('⚠️ Failed to persist property state:', error);
      }
    };

    persistState();
  }, [persistenceService, state.selectedProperty, state.filter, state.sort, state.isInitialized]);

  // Auto refresh properties
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return;

    const interval = setInterval(() => {
      propertyManager.refreshProperties();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, propertyManager]);

  // Listen for cross-tab changes
  useEffect(() => {
    if (!persistenceEnabled) return;

    const handleStorageChange = async (event: CustomEvent) => {
      console.log('🔄 Property state changed in another tab');
      
      // Reload persisted state
      if (persistenceService) {
        try {
          const persistedState = await persistenceService.loadPropertyState();
          if (persistedState && persistedState.selectedProperty) {
            dispatch({ type: 'SET_SELECTED_PROPERTY', payload: persistedState.selectedProperty });
          }
        } catch (error) {
          console.warn('⚠️ Failed to sync cross-tab property changes:', error);
        }
      }
    };

    window.addEventListener('property-state-changed', handleStorageChange as EventListener);
    return () => window.removeEventListener('property-state-changed', handleStorageChange as EventListener);
  }, [persistenceEnabled, persistenceService]);

  // Context actions
  const selectProperty = useCallback(async (property: GA4Property) => {
    try {
      await propertyManager.selectProperty(property);
    } catch (error) {
      const propertyError: PropertyError = {
        code: PropertyErrorCode.VALIDATION_FAILED,
        message: error instanceof Error ? error.message : 'Failed to select property',
        details: error,
        timestamp: new Date().toISOString(),
        retryable: true,
        suggestedAction: 'Check property permissions and try again'
      };
      dispatch({ type: 'SET_ERROR', payload: propertyError });
    }
  }, [propertyManager]);

  const clearSelection = useCallback(() => {
    propertyManager.clearSelection();
    dispatch({ type: 'SET_SELECTED_PROPERTY', payload: null });
  }, [propertyManager]);

  const refreshProperties = useCallback(async () => {
    try {
      await propertyManager.refreshProperties();
      dispatch({ type: 'SET_LAST_REFRESH', payload: new Date().toISOString() });
    } catch (error) {
      const propertyError: PropertyError = {
        code: PropertyErrorCode.DISCOVERY_FAILED,
        message: error instanceof Error ? error.message : 'Failed to refresh properties',
        details: error,
        timestamp: new Date().toISOString(),
        retryable: true,
        suggestedAction: 'Check your network connection and try again'
      };
      dispatch({ type: 'SET_ERROR', payload: propertyError });
    }
  }, [propertyManager]);

  const updateFilter = useCallback((filter: Partial<PropertyFilter>) => {
    const newFilter = { ...state.filter, ...filter };
    dispatch({ type: 'SET_FILTER', payload: newFilter });
  }, [state.filter]);

  const updateSort = useCallback((sort: PropertySort) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);

  const resetState = useCallback(() => {
    propertyManager.clearSelection();
    dispatch({ type: 'RESET_STATE' });
    
    if (persistenceService) {
      persistenceService.clearPropertyState();
    }
  }, [propertyManager, persistenceService]);

  // Context value
  const contextValue: PropertyContextValue = useMemo(() => ({
    state,
    actions: {
      selectProperty,
      clearSelection,
      refreshProperties,
      updateFilter,
      updateSort,
      resetState
    }
  }), [state, selectProperty, clearSelection, refreshProperties, updateFilter, updateSort, resetState]);

  return (
    <PropertyContext.Provider value={contextValue}>
      {children}
    </PropertyContext.Provider>
  );
}

// Property context hook
export function usePropertyContext(): PropertyContextValue {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('usePropertyContext must be used within a PropertyProvider');
  }
  return context;
}

// Convenience hooks for specific property context features
export function useSelectedProperty(): {
  selectedProperty: GA4Property | null;
  selectProperty: (property: GA4Property) => Promise<void>;
  clearSelection: () => void;
  isLoading: boolean;
  error: PropertyError | null;
} {
  const { state, actions } = usePropertyContext();
  
  return {
    selectedProperty: state.selectedProperty,
    selectProperty: actions.selectProperty,
    clearSelection: actions.clearSelection,
    isLoading: state.isLoading,
    error: state.error
  };
}

export function useAvailableProperties(): {
  availableProperties: GA4Property[];
  refreshProperties: () => Promise<void>;
  isLoading: boolean;
  lastRefresh: string | null;
} {
  const { state, actions } = usePropertyContext();
  
  return {
    availableProperties: state.availableProperties,
    refreshProperties: actions.refreshProperties,
    isLoading: state.isLoading,
    lastRefresh: state.lastRefresh
  };
}

export function usePropertyFilter(): {
  filter: PropertyFilter;
  updateFilter: (filter: Partial<PropertyFilter>) => void;
  sort: PropertySort;
  updateSort: (sort: PropertySort) => void;
} {
  const { state, actions } = usePropertyContext();
  
  return {
    filter: state.filter,
    updateFilter: actions.updateFilter,
    sort: state.sort,
    updateSort: actions.updateSort
  };
}

// Higher-order component for property context
export function withPropertyContext<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P & { propertyProviderProps?: Partial<PropertyProviderProps> }> {
  return function WithPropertyContextComponent({ propertyProviderProps, ...props }) {
    return (
      <PropertyProvider {...propertyProviderProps}>
        <Component {...(props as P)} />
      </PropertyProvider>
    );
  };
}

export default PropertyContext;