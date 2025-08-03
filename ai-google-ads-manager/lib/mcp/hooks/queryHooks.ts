/**
 * MCP Query Parameter Hooks
 * 
 * This file provides React hooks for managing query parameters
 * including date ranges, filters, and pagination.
 */

'use client';

import { useCallback, useState, useEffect, useMemo } from 'react';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Date range configuration
 */
export interface DateRangeConfig {
  startDate: Date;
  endDate: Date;
  preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
}

/**
 * Date range hook return type
 */
export interface UseDateRangeReturn {
  dateRange: DateRangeConfig;
  setDateRange: (range: Partial<DateRangeConfig>) => void;
  setPreset: (preset: DateRangeConfig['preset']) => void;
  isValid: boolean;
  duration: number; // days
  formatForAPI: () => { startDate: string; endDate: string };
  reset: () => void;
}

/**
 * Filter operator types
 */
export type FilterOperator = 
  | 'equals' 
  | 'contains' 
  | 'startsWith' 
  | 'endsWith' 
  | 'greaterThan' 
  | 'lessThan' 
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'in' 
  | 'notIn'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty';

/**
 * Filter value types
 */
export type FilterValue = string | number | boolean | Date | string[] | number[] | [number, number] | [Date, Date];

/**
 * Filter configuration
 */
export interface FilterConfig {
  id: string;
  field: string;
  operator: FilterOperator;
  value: FilterValue;
  enabled?: boolean;
  label?: string;
}

/**
 * Filter hook return type
 */
export interface UseFiltersReturn {
  filters: FilterConfig[];
  addFilter: (filter: Omit<FilterConfig, 'id'>) => void;
  updateFilter: (id: string, updates: Partial<FilterConfig>) => void;
  removeFilter: (id: string) => void;
  toggleFilter: (id: string) => void;
  clearFilters: () => void;
  getActiveFilters: () => FilterConfig[];
  formatForAPI: () => Record<string, any>[];
  isValid: boolean;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
}

/**
 * Pagination hook return type
 */
export interface UsePaginationReturn {
  pagination: PaginationConfig;
  setPagination: (updates: Partial<PaginationConfig>) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  pageNumbers: number[];
  formatForAPI: () => { offset: number; limit: number };
  reset: () => void;
}

/**
 * Combined query parameters
 */
export interface QueryParams {
  dateRange: DateRangeConfig;
  filters: FilterConfig[];
  pagination: PaginationConfig;
}

/**
 * Combined query hook return type
 */
export interface UseQueryParamsReturn {
  dateRange: UseDateRangeReturn;
  filters: UseFiltersReturn;
  pagination: UsePaginationReturn;
  formatForAPI: () => {
    dateRange: { startDate: string; endDate: string };
    filters: Record<string, any>[];
    pagination: { offset: number; limit: number };
  };
  reset: () => void;
  serialize: () => string;
  deserialize: (serialized: string) => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get date range for a preset
 */
const getPresetDateRange = (preset: DateRangeConfig['preset']): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'last7days':
      return {
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: today
      };
    
    case 'last30days':
      return {
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: today
      };
    
    case 'thisMonth':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: today
      };
    
    case 'lastMonth':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: lastMonth,
        endDate: lastMonthEnd
      };
    
    default:
      return {
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: today
      };
  }
};

/**
 * Validate date range
 */
const validateDateRange = (dateRange: DateRangeConfig): boolean => {
  return dateRange.startDate <= dateRange.endDate;
};

/**
 * Validate filter
 */
const validateFilter = (filter: FilterConfig): boolean => {
  if (!filter.field || !filter.operator) return false;
  
  switch (filter.operator) {
    case 'isEmpty':
    case 'isNotEmpty':
      return true;
    
    case 'in':
    case 'notIn':
      return Array.isArray(filter.value) && filter.value.length > 0;
    
    case 'between':
      return Array.isArray(filter.value) && filter.value.length === 2;
    
    default:
      return filter.value !== undefined && filter.value !== null && filter.value !== '';
  }
};

/**
 * Generate unique filter ID
 */
const generateFilterId = (): string => {
  return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format date for API
 */
const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// ============================================================================
// DATE RANGE HOOKS
// ============================================================================

/**
 * Hook for managing date range selection
 * 
 * @example
 * ```tsx
 * function DateRangePicker() {
 *   const { 
 *     dateRange, 
 *     setDateRange, 
 *     setPreset, 
 *     isValid, 
 *     duration 
 *   } = useDateRange({
 *     startDate: new Date('2024-01-01'),
 *     endDate: new Date('2024-01-31'),
 *     preset: 'custom'
 *   });
 *   
 *   return (
 *     <div>
 *       <select value={dateRange.preset} onChange={(e) => setPreset(e.target.value)}>
 *         <option value="last7days">Last 7 Days</option>
 *         <option value="last30days">Last 30 Days</option>
 *         <option value="custom">Custom</option>
 *       </select>
 *       
 *       {dateRange.preset === 'custom' && (
 *         <div>
 *           <input 
 *             type="date" 
 *             value={formatDateForAPI(dateRange.startDate)}
 *             onChange={(e) => setDateRange({ startDate: new Date(e.target.value) })}
 *           />
 *           <input 
 *             type="date" 
 *             value={formatDateForAPI(dateRange.endDate)}
 *             onChange={(e) => setDateRange({ endDate: new Date(e.target.value) })}
 *           />
 *         </div>
 *       )}
 *       
 *       <p>Duration: {duration} days</p>
 *       <p>Valid: {isValid ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export const useDateRange = (initialRange?: Partial<DateRangeConfig>): UseDateRangeReturn => {
  const defaultRange: DateRangeConfig = {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    preset: 'last7days'
  };

  const [dateRange, setDateRangeState] = useState<DateRangeConfig>(() => {
    const initial = { ...defaultRange, ...initialRange };
    if (initial.preset && initial.preset !== 'custom') {
      const presetRange = getPresetDateRange(initial.preset);
      return { ...initial, ...presetRange };
    }
    return initial;
  });

  const setDateRange = useCallback((updates: Partial<DateRangeConfig>) => {
    setDateRangeState(prev => ({
      ...prev,
      ...updates,
      preset: updates.preset || 'custom'
    }));
  }, []);

  const setPreset = useCallback((preset: DateRangeConfig['preset']) => {
    if (preset && preset !== 'custom') {
      const presetRange = getPresetDateRange(preset);
      setDateRangeState({
        ...presetRange,
        preset
      });
    } else {
      setDateRangeState(prev => ({
        ...prev,
        preset: 'custom'
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setDateRangeState(defaultRange);
  }, []);

  const isValid = useMemo(() => validateDateRange(dateRange), [dateRange]);

  const duration = useMemo(() => {
    const diffTime = Math.abs(dateRange.endDate.getTime() - dateRange.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [dateRange]);

  const formatForAPI = useCallback(() => ({
    startDate: formatDateForAPI(dateRange.startDate),
    endDate: formatDateForAPI(dateRange.endDate)
  }), [dateRange]);

  return {
    dateRange,
    setDateRange,
    setPreset,
    isValid,
    duration,
    formatForAPI,
    reset
  };
};

// ============================================================================
// FILTER HOOKS
// ============================================================================

/**
 * Hook for managing data filters
 * 
 * @example
 * ```tsx
 * function FilterManager() {
 *   const { 
 *     filters, 
 *     addFilter, 
 *     updateFilter, 
 *     removeFilter, 
 *     getActiveFilters 
 *   } = useFilters();
 *   
 *   const handleAddFilter = () => {
 *     addFilter({
 *       field: 'country',
 *       operator: 'equals',
 *       value: 'US',
 *       label: 'Country is US'
 *     });
 *   };
 *   
 *   return (
 *     <div>
 *       <button onClick={handleAddFilter}>Add Filter</button>
 *       
 *       {filters.map(filter => (
 *         <div key={filter.id}>
 *           <span>{filter.label || `${filter.field} ${filter.operator} ${filter.value}`}</span>
 *           <button onClick={() => removeFilter(filter.id)}>Remove</button>
 *         </div>
 *       ))}
 *       
 *       <p>Active filters: {getActiveFilters().length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export const useFilters = (initialFilters: FilterConfig[] = []): UseFiltersReturn => {
  const [filters, setFilters] = useState<FilterConfig[]>(initialFilters);

  const addFilter = useCallback((filter: Omit<FilterConfig, 'id'>) => {
    const newFilter: FilterConfig = {
      ...filter,
      id: generateFilterId(),
      enabled: filter.enabled !== false
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterConfig>) => {
    setFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(filter => filter.id !== id));
  }, []);

  const toggleFilter = useCallback((id: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, enabled: !filter.enabled } : filter
    ));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const getActiveFilters = useCallback(() => {
    return filters.filter(filter => filter.enabled !== false);
  }, [filters]);

  const formatForAPI = useCallback(() => {
    return getActiveFilters().map(filter => ({
      field: filter.field,
      operator: filter.operator,
      value: filter.value
    }));
  }, [getActiveFilters]);

  const isValid = useMemo(() => {
    return filters.every(validateFilter);
  }, [filters]);

  return {
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    toggleFilter,
    clearFilters,
    getActiveFilters,
    formatForAPI,
    isValid
  };
};

// ============================================================================
// PAGINATION HOOKS
// ============================================================================

/**
 * Hook for managing pagination state
 * 
 * @example
 * ```tsx
 * function PaginationControls() {
 *   const { 
 *     pagination, 
 *     setPage, 
 *     setPageSize, 
 *     nextPage, 
 *     previousPage, 
 *     canGoNext, 
 *     canGoPrevious,
 *     pageNumbers 
 *   } = usePagination({
 *     page: 1,
 *     pageSize: 25,
 *     totalItems: 100
 *   });
 *   
 *   return (
 *     <div>
 *       <select value={pagination.pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
 *         <option value={10}>10 per page</option>
 *         <option value={25}>25 per page</option>
 *         <option value={50}>50 per page</option>
 *       </select>
 *       
 *       <button onClick={previousPage} disabled={!canGoPrevious}>
 *         Previous
 *       </button>
 *       
 *       {pageNumbers.map(pageNum => (
 *         <button 
 *           key={pageNum}
 *           onClick={() => setPage(pageNum)}
 *           disabled={pageNum === pagination.page}
 *         >
 *           {pageNum}
 *         </button>
 *       ))}
 *       
 *       <button onClick={nextPage} disabled={!canGoNext}>
 *         Next
 *       </button>
 *       
 *       <p>
 *         Page {pagination.page} of {pagination.totalPages} 
 *         ({pagination.totalItems} total items)
 *       </p>
 *     </div>
 *   );
 * }
 * ```
 */
export const usePagination = (initialConfig?: Partial<PaginationConfig>): UsePaginationReturn => {
  const defaultConfig: PaginationConfig = {
    page: 1,
    pageSize: 25
  };

  const [pagination, setPaginationState] = useState<PaginationConfig>(() => ({
    ...defaultConfig,
    ...initialConfig
  }));

  const setPagination = useCallback((updates: Partial<PaginationConfig>) => {
    setPaginationState(prev => {
      const newConfig = { ...prev, ...updates };
      
      // Recalculate totalPages if totalItems changed
      if (updates.totalItems !== undefined || updates.pageSize !== undefined) {
        newConfig.totalPages = newConfig.totalItems 
          ? Math.ceil(newConfig.totalItems / newConfig.pageSize)
          : undefined;
      }
      
      // Ensure page is within bounds
      if (newConfig.totalPages && newConfig.page > newConfig.totalPages) {
        newConfig.page = newConfig.totalPages;
      }
      
      return newConfig;
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setPagination({ page: Math.max(1, page) });
  }, [setPagination]);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination({ 
      pageSize: Math.max(1, pageSize),
      page: 1 // Reset to first page when changing page size
    });
  }, [setPagination]);

  const nextPage = useCallback(() => {
    if (pagination.totalPages && pagination.page < pagination.totalPages) {
      setPage(pagination.page + 1);
    }
  }, [pagination.page, pagination.totalPages, setPage]);

  const previousPage = useCallback(() => {
    if (pagination.page > 1) {
      setPage(pagination.page - 1);
    }
  }, [pagination.page, setPage]);

  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const goToLastPage = useCallback(() => {
    if (pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination.totalPages, setPage]);

  const reset = useCallback(() => {
    setPaginationState(defaultConfig);
  }, []);

  const canGoNext = useMemo(() => {
    return pagination.totalPages ? pagination.page < pagination.totalPages : true;
  }, [pagination.page, pagination.totalPages]);

  const canGoPrevious = useMemo(() => {
    return pagination.page > 1;
  }, [pagination.page]);

  const pageNumbers = useMemo(() => {
    if (!pagination.totalPages) return [];
    
    const maxVisiblePages = 5;
    const startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [pagination.page, pagination.totalPages]);

  const formatForAPI = useCallback(() => ({
    offset: (pagination.page - 1) * pagination.pageSize,
    limit: pagination.pageSize
  }), [pagination.page, pagination.pageSize]);

  return {
    pagination,
    setPagination,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    canGoNext,
    canGoPrevious,
    pageNumbers,
    formatForAPI,
    reset
  };
};

// ============================================================================
// COMBINED QUERY HOOKS
// ============================================================================

/**
 * Hook for managing all query parameters together
 * 
 * @example
 * ```tsx
 * function DataTable() {
 *   const queryParams = useQueryParams();
 *   
 *   const { data, isLoading } = useGA4Data({
 *     metrics: ['sessions', 'users'],
 *     ...queryParams.formatForAPI()
 *   });
 *   
 *   const handleSerialize = () => {
 *     const serialized = queryParams.serialize();
 *     console.log('Serialized params:', serialized);
 *   };
 *   
 *   return (
 *     <div>
 *       <DateRangePicker {...queryParams.dateRange} />
 *       <FilterManager {...queryParams.filters} />
 *       <PaginationControls {...queryParams.pagination} />
 *       
 *       <button onClick={queryParams.reset}>Reset All</button>
 *       <button onClick={handleSerialize}>Serialize</button>
 *       
 *       {isLoading ? 'Loading...' : (
 *         <div>Render data here</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useQueryParams = (
  initialDateRange?: Partial<DateRangeConfig>,
  initialFilters?: FilterConfig[],
  initialPagination?: Partial<PaginationConfig>
): UseQueryParamsReturn => {
  const dateRange = useDateRange(initialDateRange);
  const filters = useFilters(initialFilters);
  const pagination = usePagination(initialPagination);

  const formatForAPI = useCallback(() => ({
    dateRange: dateRange.formatForAPI(),
    filters: filters.formatForAPI(),
    pagination: pagination.formatForAPI()
  }), [dateRange, filters, pagination]);

  const reset = useCallback(() => {
    dateRange.reset();
    filters.clearFilters();
    pagination.reset();
  }, [dateRange, filters, pagination]);

  const serialize = useCallback(() => {
    const params = {
      dateRange: {
        startDate: dateRange.dateRange.startDate.toISOString(),
        endDate: dateRange.dateRange.endDate.toISOString(),
        preset: dateRange.dateRange.preset
      },
      filters: filters.filters.map(filter => ({
        ...filter,
        value: filter.value instanceof Date ? filter.value.toISOString() : filter.value
      })),
      pagination: pagination.pagination
    };
    return JSON.stringify(params);
  }, [dateRange, filters, pagination]);

  const deserialize = useCallback((serialized: string) => {
    try {
      const params = JSON.parse(serialized);
      
      if (params.dateRange) {
        dateRange.setDateRange({
          startDate: new Date(params.dateRange.startDate),
          endDate: new Date(params.dateRange.endDate),
          preset: params.dateRange.preset
        });
      }
      
      if (params.filters) {
        filters.clearFilters();
        params.filters.forEach((filter: any) => {
          filters.addFilter({
            ...filter,
            value: typeof filter.value === 'string' && filter.value.includes('T') 
              ? new Date(filter.value) 
              : filter.value
          });
        });
      }
      
      if (params.pagination) {
        pagination.setPagination(params.pagination);
      }
    } catch (error) {
      console.error('Failed to deserialize query params:', error);
    }
  }, [dateRange, filters, pagination]);

  return {
    dateRange,
    filters,
    pagination,
    formatForAPI,
    reset,
    serialize,
    deserialize
  };
};