/**
 * useCampaignTableData Hook
 * 
 * React hook for managing campaign table data with MCP integration,
 * advanced filtering, sorting, pagination, and export capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMCPClient } from '@/lib/mcp/context';
import { 
  CampaignTableDataFetcher, 
  CampaignTableData, 
  CampaignTableOptions,
  CampaignTableFilters,
  CampaignTableSorting,
  CampaignTablePagination,
  CampaignData
} from '@/lib/mcp/dataFetchers/CampaignTableDataFetcher';

interface UseCampaignTableDataProps {
  initialFilters?: CampaignTableFilters;
  initialSorting?: CampaignTableSorting;
  initialPagination?: CampaignTablePagination;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
  propertyId?: string;
  userId?: string;
  userRole?: string;
}

export function useCampaignTableData({
  initialFilters = {},
  initialSorting = { column: 'name', direction: 'asc' },
  initialPagination = { page: 1, pageSize: 25 },
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  enabled = true,
  propertyId,
  userId,
  userRole
}: UseCampaignTableDataProps = {}) {
  const mcpClient = useMCPClient();

  // State management
  const [data, setData] = useState<CampaignTableData>({
    campaigns: [],
    totalCount: 0,
    filteredCount: 0,
    currentPage: 1,
    totalPages: 0,
    pageSize: 25,
    loading: true,
    source: 'mock',
    hasNextPage: false,
    hasPreviousPage: false
  });

  const [filters, setFilters] = useState<CampaignTableFilters>(initialFilters);
  const [sorting, setSorting] = useState<CampaignTableSorting>(initialSorting);
  const [pagination, setPagination] = useState<CampaignTablePagination>(initialPagination);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Refs for cleanup
  const fetcherRef = useRef<CampaignTableDataFetcher>();
  const intervalRef = useRef<NodeJS.Timeout>();

  // Initialize fetcher when MCP client is available
  useEffect(() => {
    if (mcpClient && !fetcherRef.current) {
      fetcherRef.current = new CampaignTableDataFetcher(mcpClient);
    }
  }, [mcpClient]);

  /**
   * Fetch data with current options
   */
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled || !fetcherRef.current) {
      return;
    }

    setData(prev => ({ ...prev, loading: true }));

    try {
      const options: CampaignTableOptions = {
        filters,
        sorting,
        pagination,
        forceRefresh,
        propertyId,
        userId,
        userRole
      };

      const result = await fetcherRef.current.fetchCampaigns(options);
      setData(result);
      setLastFetch(new Date());
    } catch (error) {
      console.error('Failed to fetch campaign data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [filters, sorting, pagination, enabled, propertyId, userId, userRole]);

  /**
   * Update filters and trigger refresh
   */
  const updateFilters = useCallback((newFilters: Partial<CampaignTableFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    // Reset to first page when filtering
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Update sorting and trigger refresh
   */
  const updateSorting = useCallback((newSorting: CampaignTableSorting) => {
    setSorting(newSorting);
  }, []);

  /**
   * Update pagination
   */
  const updatePagination = useCallback((newPagination: Partial<CampaignTablePagination>) => {
    setPagination(prev => ({ ...prev, ...newPagination }));
  }, []);

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page: number) => {
    updatePagination({ page });
  }, [updatePagination]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (data.hasNextPage) {
      goToPage(data.currentPage + 1);
    }
  }, [data.hasNextPage, data.currentPage, goToPage]);

  /**
   * Go to previous page
   */
  const previousPage = useCallback(() => {
    if (data.hasPreviousPage) {
      goToPage(data.currentPage - 1);
    }
  }, [data.hasPreviousPage, data.currentPage, goToPage]);

  /**
   * Change page size
   */
  const changePageSize = useCallback((pageSize: number) => {
    updatePagination({ pageSize, page: 1 });
  }, [updatePagination]);

  /**
   * Search campaigns
   */
  const search = useCallback((searchTerm: string) => {
    updateFilters({ search: searchTerm });
  }, [updateFilters]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Sort by column
   */
  const sortBy = useCallback((column: keyof CampaignData) => {
    setSorting(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  /**
   * Force refresh data
   */
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  /**
   * Export campaign data (legacy method)
   */
  const exportData = useCallback(async (format: 'csv' | 'excel' = 'csv') => {
    if (!fetcherRef.current) {
      throw new Error('Data fetcher not initialized');
    }

    setIsExporting(true);
    try {
      const options: CampaignTableOptions = {
        filters,
        sorting,
        // Export all data (no pagination)
        pagination: { page: 1, pageSize: 10000 },
        propertyId,
        userId,
        userRole
      };

      const csvData = await fetcherRef.current.exportCampaigns(options, format);
      
      // Create download
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `campaigns_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return csvData;
    } finally {
      setIsExporting(false);
    }
  }, [filters, sorting, propertyId, userId, userRole]);

  /**
   * Enhanced export with configuration and progress tracking
   */
  const exportDataEnhanced = useCallback(async (
    exportConfig: {
      format: 'csv' | 'excel' | 'json' | 'pdf';
      scope: 'all' | 'filtered' | 'visible' | 'selected';
      includeHeaders: boolean;
      includeMetadata: boolean;
      dateFormat: 'iso' | 'us' | 'eu';
      numberFormat: 'standard' | 'accounting';
      selectedColumns?: string[];
    },
    onProgress?: (progress: { status: string; progress: number; message: string; recordCount?: number }) => void
  ) => {
    if (!fetcherRef.current) {
      throw new Error('Data fetcher not initialized');
    }

    setIsExporting(true);
    try {
      onProgress?.({ status: 'preparing', progress: 0, message: 'Preparing export...' });

      const exportOptions: CampaignTableOptions = {
        filters: exportConfig.scope === 'all' ? {} : filters,
        sorting,
        pagination: { page: 1, pageSize: 50000 },
        propertyId,
        userId,
        userRole
      };

      // Get campaigns based on scope
      let selectedCampaigns: CampaignData[] | undefined;
      if (exportConfig.scope === 'visible') {
        selectedCampaigns = data.campaigns;
      }

      const result = await fetcherRef.current.exportCampaignsEnhanced(exportOptions, {
        ...exportConfig,
        selectedCampaigns,
        onProgress: (progress: number, message: string) => {
          onProgress?.({
            status: 'exporting',
            progress,
            message,
            recordCount: undefined
          });
        }
      });

      onProgress?.({
        status: 'complete',
        progress: 100,
        message: 'Export complete!',
        recordCount: result.recordCount
      });

      // Create blob and download
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        filename: result.filename,
        recordCount: result.recordCount,
        downloadUrl: url,
        fileSize: blob.size
      };

    } catch (error) {
      console.error('Enhanced export failed:', error);
      onProgress?.({
        status: 'error',
        progress: 0,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [fetcherRef, filters, sorting, propertyId, userId, userRole, data.campaigns]);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return fetcherRef.current?.getCacheStats() || { size: 0, keys: [] };
  }, []);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    fetcherRef.current?.clearCache();
  }, []);

  /**
   * Initial data fetch - run once on mount
   */
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Refresh when filters, sorting, or pagination change
   */
  useEffect(() => {
    fetchData();
  }, [filters, sorting, pagination, propertyId, userId, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Auto-refresh setup
   */
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (autoRefresh && enabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, enabled, refreshInterval]); // Removed fetchData dependency

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // Data
    campaigns: data.campaigns,
    totalCount: data.totalCount,
    filteredCount: data.filteredCount,
    loading: data.loading,
    error: data.error,
    source: data.source,
    lastUpdated: data.lastUpdated,
    lastFetch,

    // Pagination
    currentPage: data.currentPage,
    totalPages: data.totalPages,
    pageSize: data.pageSize,
    hasNextPage: data.hasNextPage,
    hasPreviousPage: data.hasPreviousPage,

    // Current state
    filters,
    sorting,
    pagination,

    // Actions
    updateFilters,
    updateSorting,
    updatePagination,
    goToPage,
    nextPage,
    previousPage,
    changePageSize,
    search,
    clearFilters,
    sortBy,
    refresh,

    // Export
    exportData,
    exportDataEnhanced,
    isExporting,

    // Cache management
    getCacheStats,
    clearCache
  };
}

/**
 * Specialized hook for campaign table with preset configurations
 */
export function useCampaignTable(props: Omit<UseCampaignTableDataProps, 'initialPagination'> & {
  pageSize?: number;
} = {}) {
  const { pageSize = 25, ...otherProps } = props;
  
  return useCampaignTableData({
    ...otherProps,
    initialPagination: { page: 1, pageSize }
  });
}

/**
 * Hook for campaign export functionality only
 */
export function useCampaignExport(props: Pick<UseCampaignTableDataProps, 'propertyId' | 'userId' | 'userRole'> = {}) {
  const [isExporting, setIsExporting] = useState(false);
  const fetcherRef = useRef<CampaignTableDataFetcher>();

  if (!fetcherRef.current) {
    fetcherRef.current = new CampaignTableDataFetcher(new MCPClient());
  }

  const exportCampaigns = useCallback(async (
    options: {
      filters?: CampaignTableFilters;
      sorting?: CampaignTableSorting;
      format?: 'csv' | 'excel';
    } = {}
  ) => {
    if (!fetcherRef.current) {
      throw new Error('Data fetcher not initialized');
    }

    setIsExporting(true);
    try {
      const { filters = {}, sorting = { column: 'name', direction: 'asc' }, format = 'csv' } = options;
      
      const fetchOptions: CampaignTableOptions = {
        filters,
        sorting,
        pagination: { page: 1, pageSize: 10000 },
        ...props
      };

      return await fetcherRef.current.exportCampaigns(fetchOptions, format);
    } finally {
      setIsExporting(false);
    }
  }, [props]);

  return {
    exportCampaigns,
    isExporting
  };
}