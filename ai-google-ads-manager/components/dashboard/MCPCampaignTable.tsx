/**
 * MCP Campaign Table Component
 * 
 * Enhanced table component that uses MCP data with fallback to mock data,
 * basic error handling, loading states, and feature flag control.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useCampaignTableData } from '@/hooks/useCampaignTableData';
import { CampaignData, CampaignTableFilters, CampaignTableSorting } from '@/lib/mcp/dataFetchers/CampaignTableDataFetcher';
import { AdvancedCampaignFilters } from './AdvancedCampaignFilters';
import { EnhancedSortingControls, SortableColumnHeader } from './EnhancedSortingControls';
import { EnhancedPaginationControls } from './EnhancedPaginationControls';
import { EnhancedExportControls, ExportConfiguration, ExportFormat, ExportScope } from './EnhancedExportControls';
import { AdvancedTableControls, ColumnDefinition, TableViewPreference } from './AdvancedTableControls';
import { useTableViewPreferences } from '@/hooks/useTableViewPreferences';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

// Icons for the table
const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

interface MCPCampaignTableProps {
  className?: string;
  enableMCP?: boolean;
  showSource?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  propertyId?: string;
  userId?: string;
  userRole?: string;
  initialPageSize?: number;
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: string) {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  
  switch (status) {
    case 'ENABLED':
      return `${baseClasses} bg-green-100 text-green-800`;
    case 'PAUSED':
      return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case 'REMOVED':
      return `${baseClasses} bg-red-100 text-red-800`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
}

/**
 * Get campaign type badge styling
 */
function getTypeBadge(type: string) {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  
  switch (type) {
    case 'SEARCH':
      return `${baseClasses} bg-blue-100 text-blue-800`;
    case 'DISPLAY':
      return `${baseClasses} bg-purple-100 text-purple-800`;
    case 'SHOPPING':
      return `${baseClasses} bg-green-100 text-green-800`;
    case 'VIDEO':
      return `${baseClasses} bg-red-100 text-red-800`;
    case 'APP':
      return `${baseClasses} bg-indigo-100 text-indigo-800`;
    case 'PERFORMANCE_MAX':
      return `${baseClasses} bg-orange-100 text-orange-800`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
}

/**
 * Format currency values
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format percentage values
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format large numbers
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function MCPCampaignTable({
  className = '',
  enableMCP = true,
  showSource = false,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  propertyId,
  userId,
  userRole,
  initialPageSize = 25
}: MCPCampaignTableProps) {

  // Local state for filters (managed by AdvancedCampaignFilters)
  const [filters, setFilters] = useState<CampaignTableFilters>({});
  
  // Feature flag states
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [filteringEnabled, setFilteringEnabled] = useState(false);
  const [sortingEnabled, setSortingEnabled] = useState(false);
  const [paginationEnabled, setPaginationEnabled] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [advancedFeaturesEnabled, setAdvancedFeaturesEnabled] = useState(false);

  // Export progress state
  const [exportProgress, setExportProgress] = useState({
    status: 'idle' as 'idle' | 'preparing' | 'exporting' | 'complete' | 'error',
    progress: 0,
    message: '',
    downloadUrl: undefined as string | undefined,
    filename: undefined as string | undefined,
    fileSize: undefined as number | undefined,
    recordCount: undefined as number | undefined
  });

  // Default column definitions for table view preferences
  const defaultColumns: ColumnDefinition[] = React.useMemo(() => [
    { key: 'name', label: 'Campaign Name', visible: true, width: 200, order: 0, resizable: true, sortable: true, filterable: true },
    { key: 'status', label: 'Status', visible: true, width: 120, order: 1, resizable: true, sortable: true, filterable: true },
    { key: 'type', label: 'Type', visible: true, width: 150, order: 2, resizable: true, sortable: true, filterable: true },
    { key: 'budget', label: 'Budget', visible: true, width: 120, order: 3, resizable: true, sortable: true, filterable: true },
    { key: 'spend', label: 'Spend', visible: true, width: 120, order: 4, resizable: true, sortable: true, filterable: true },
    { key: 'impressions', label: 'Impressions', visible: true, width: 120, order: 5, resizable: true, sortable: true, filterable: false },
    { key: 'clicks', label: 'Clicks', visible: true, width: 100, order: 6, resizable: true, sortable: true, filterable: false },
    { key: 'ctr', label: 'CTR', visible: true, width: 80, order: 7, resizable: true, sortable: true, filterable: false },
    { key: 'cpc', label: 'CPC', visible: false, width: 80, order: 8, resizable: true, sortable: true, filterable: false },
    { key: 'conversions', label: 'Conversions', visible: true, width: 120, order: 9, resizable: true, sortable: true, filterable: false },
    { key: 'conversionRate', label: 'Conv. Rate', visible: false, width: 100, order: 10, resizable: true, sortable: true, filterable: false },
    { key: 'roas', label: 'ROAS', visible: true, width: 80, order: 11, resizable: true, sortable: true, filterable: false },
    { key: 'lastModified', label: 'Last Modified', visible: false, width: 150, order: 12, resizable: true, sortable: true, filterable: true }
  ], []);

  // Table view preferences hook
  const {
    columns: tableColumns,
    updateColumns,
    toggleColumnVisibility,
    resizeColumn,
    reorderColumns,
    resetToDefault,
    viewPreferences,
    saveViewPreference,
    loadViewPreference,
    deleteViewPreference,
    visibleColumns,
    columnWidths
  } = useTableViewPreferences({
    tableId: 'campaign-table',
    defaultColumns,
    enabled: advancedFeaturesEnabled
  });

  // Check feature flags on mount
  React.useEffect(() => {
    const checkFeatureFlags = async () => {
      try {
        const [searchFlag, filteringFlag, sortingFlag, paginationFlag, exportFlag, advancedFlag] = await Promise.all([
          featureFlagManager.isEnabled('campaign_table_search_enabled', { userId, userRole }),
          featureFlagManager.isEnabled('campaign_table_filtering_enabled', { userId, userRole }),
          featureFlagManager.isEnabled('campaign_table_sorting_enabled', { userId, userRole }),
          featureFlagManager.isEnabled('campaign_table_pagination_enabled', { userId, userRole }),
          featureFlagManager.isEnabled('campaign_table_export_enabled', { userId, userRole }),
          featureFlagManager.isEnabled('campaign_table_advanced_features_enabled', { userId, userRole })
        ]);
        
        setSearchEnabled(searchFlag);
        setFilteringEnabled(filteringFlag);
        setSortingEnabled(sortingFlag);
        setPaginationEnabled(paginationFlag);
        setExportEnabled(exportFlag);
        setAdvancedFeaturesEnabled(advancedFlag);
      } catch (error) {
        console.warn('Failed to check feature flags:', error);
        // Default to enabled for fallback
        setSearchEnabled(true);
        setFilteringEnabled(true);
        setSortingEnabled(true);
        setPaginationEnabled(true);
        setExportEnabled(true);
        setAdvancedFeaturesEnabled(true);
      }
    };

    checkFeatureFlags();
  }, [userId, userRole]);

  // Use the campaign table hook
  const {
    campaigns,
    totalCount,
    filteredCount,
    loading,
    error,
    source,
    lastUpdated,
    currentPage,
    totalPages,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    sorting,
    updateFilters,
    sortBy,
    goToPage,
    nextPage,
    previousPage,
    changePageSize,
    refresh,
    exportData,
    exportDataEnhanced,
    isExporting
  } = useCampaignTableData({
    initialFilters: filters,
    autoRefresh: enableMCP ? autoRefresh : false,
    refreshInterval,
    enabled: true,
    propertyId,
    userId,
    userRole,
    initialPagination: { page: 1, pageSize: initialPageSize }
  });

  // Handle filter changes from AdvancedCampaignFilters
  const handleFiltersChange = React.useCallback((newFilters: CampaignTableFilters) => {
    setFilters(newFilters);
    updateFilters(newFilters);
  }, [updateFilters]);

  // Handle clearing filters
  const handleClearFilters = React.useCallback(() => {
    setFilters({});
    updateFilters({});
  }, [updateFilters]);

  // Handle enhanced export
  const handleEnhancedExport = React.useCallback(async (config: ExportConfiguration) => {
    try {
      setExportProgress({
        status: 'preparing',
        progress: 0,
        message: 'Preparing export...',
        downloadUrl: undefined,
        filename: undefined,
        fileSize: undefined,
        recordCount: undefined
      });

      const result = await exportDataEnhanced(config, (progress) => {
        setExportProgress({
          status: progress.status as any,
          progress: progress.progress,
          message: progress.message,
          downloadUrl: undefined,
          filename: undefined,
          fileSize: undefined,
          recordCount: progress.recordCount
        });
      });

      setExportProgress({
        status: 'complete',
        progress: 100,
        message: 'Export complete!',
        downloadUrl: result.downloadUrl,
        filename: result.filename,
        fileSize: result.fileSize,
        recordCount: result.recordCount
      });

    } catch (error) {
      setExportProgress({
        status: 'error',
        progress: 0,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        downloadUrl: undefined,
        filename: undefined,
        fileSize: undefined,
        recordCount: undefined
      });
    }
  }, [exportDataEnhanced]);

  // Render cell content based on column type
  const renderCellContent = React.useCallback((campaign: CampaignData, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
            <div className="text-sm text-gray-500">ID: {campaign.id}</div>
          </div>
        );
      case 'status':
        return (
          <span className={getStatusBadge(campaign.status)}>
            {campaign.status}
          </span>
        );
      case 'type':
        return (
          <span className={getTypeBadge(campaign.type)}>
            {campaign.type}
          </span>
        );
      case 'budget':
        return formatCurrency(campaign.budget);
      case 'spend':
        return formatCurrency(campaign.spend);
      case 'impressions':
        return formatNumber(campaign.impressions);
      case 'clicks':
        return formatNumber(campaign.clicks);
      case 'ctr':
        return formatPercent(campaign.ctr);
      case 'cpc':
        return formatCurrency(campaign.cpc);
      case 'conversions':
        return formatNumber(campaign.conversions);
      case 'conversionRate':
        return formatPercent(campaign.conversionRate);
      case 'roas':
        return `${campaign.roas.toFixed(1)}x`;
      case 'lastModified':
        return new Date(campaign.lastModified).toLocaleDateString();
      default:
        return (campaign as any)[columnKey]?.toString() || '-';
    }
  }, []);

  // Handle export
  const handleExport = async () => {
    try {
      await exportData('csv');
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Ads Campaigns</h3>
            <p className="text-sm text-gray-600 mt-1">
              {loading ? 'Loading...' : `${filteredCount.toLocaleString()} of ${totalCount.toLocaleString()} campaigns`}
              {showSource && (
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  source === 'mcp' ? 'bg-green-100 text-green-700' :
                  source === 'cache' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {source.toUpperCase()}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting || campaigns.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm leading-4 font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon />
              <span className="ml-2">{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm leading-4 font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshIcon />
              <span className="ml-2">Refresh</span>
            </button>
          </div>
        </div>

      </div>

      {/* Advanced Search and Filters */}
      {(searchEnabled || filteringEnabled) && (
        <AdvancedCampaignFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          searchEnabled={searchEnabled}
          filteringEnabled={filteringEnabled}
          className="mx-6 mb-4"
        />
      )}

      {/* Enhanced Sorting Controls */}
      {sortingEnabled && (
        <EnhancedSortingControls
          currentSorting={sorting}
          onSortChange={(newSorting) => {
            sortBy(newSorting.column);
          }}
          onResetSort={() => {
            // Reset to default sorting (name ascending)
            sortBy('name');
            if (sorting.column === 'name' && sorting.direction === 'desc') {
              sortBy('name'); // Click again to get ascending
            }
          }}
          sortingEnabled={sortingEnabled}
          showQuickSort={true}
          className="mx-6 mb-4"
        />
      )}

      {/* Enhanced Export Controls */}
      {exportEnabled && (
        <EnhancedExportControls
          campaigns={campaigns}
          totalCount={totalCount}
          filteredCount={filteredCount}
          onExport={handleEnhancedExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportEnabled={exportEnabled}
          showAdvancedOptions={true}
          selectedCampaigns={[]}
          className="mx-6 mb-4"
        />
      )}

      {/* Advanced Table Controls */}
      {advancedFeaturesEnabled && (
        <AdvancedTableControls
          columns={tableColumns}
          onColumnsChange={updateColumns}
          onColumnResize={resizeColumn}
          onColumnReorder={reorderColumns}
          viewPreferences={viewPreferences}
          onSaveViewPreference={saveViewPreference}
          onLoadViewPreference={loadViewPreference}
          onDeleteViewPreference={deleteViewPreference}
          advancedFeaturesEnabled={advancedFeaturesEnabled}
          className="mx-6 mb-4"
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="px-6 py-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {source === 'mock' ? 'Displaying fallback data.' : 'Please try refreshing the page.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-8 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading campaigns...</p>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {(advancedFeaturesEnabled ? visibleColumns : defaultColumns.filter(col => col.visible))
                    .sort((a, b) => a.order - b.order)
                    .map(column => (
                      <SortableColumnHeader
                        key={column.key}
                        column={column.key}
                        label={column.label}
                        currentSorting={sorting}
                        onSort={sortBy}
                        sortingEnabled={sortingEnabled && column.sortable}
                        style={{ width: advancedFeaturesEnabled ? columnWidths[column.key] : undefined }}
                      />
                    ))}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => {
                  const columnsToRender = advancedFeaturesEnabled ? visibleColumns : defaultColumns.filter(col => col.visible);
                  
                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      {columnsToRender
                        .sort((a, b) => a.order - b.order)
                        .map(column => (
                          <td 
                            key={column.key}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            style={{ 
                              width: advancedFeaturesEnabled ? columnWidths[column.key] : undefined,
                              minWidth: advancedFeaturesEnabled ? Math.max(50, columnWidths[column.key] * 0.8) : undefined,
                              maxWidth: advancedFeaturesEnabled ? columnWidths[column.key] * 1.2 : undefined
                            }}
                          >
                            {renderCellContent(campaign, column.key)}
                          </td>
                        ))}
                    </tr>
                  );
                })}

                {/* Empty State */}
                {campaigns.length === 0 && !loading && (
                  <tr>
                    <td 
                      colSpan={advancedFeaturesEnabled ? visibleColumns.length : defaultColumns.filter(col => col.visible).length} 
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No campaigns found. {Object.keys(filters).length > 0 ? 'Try adjusting your filters.' : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Enhanced Pagination */}
          <EnhancedPaginationControls
            paginationInfo={{
              currentPage,
              totalPages,
              pageSize,
              totalCount,
              filteredCount,
              hasNextPage,
              hasPreviousPage
            }}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            onFirstPage={() => goToPage(1)}
            onLastPage={() => goToPage(totalPages)}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            paginationEnabled={paginationEnabled}
            showPageSizeOptions={true}
            showGoToPage={true}
            showDetailedInfo={true}
          />

          {/* Footer Info */}
          {lastUpdated && (
            <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
              Last updated: {lastUpdated.toLocaleString()}
              {showSource && (
                <span className="ml-4">
                  Data source: <span className="font-medium">{source.toUpperCase()}</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}