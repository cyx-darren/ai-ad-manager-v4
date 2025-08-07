/**
 * VirtualizedCampaignTable Component
 * Virtualized table component for handling large datasets with performance optimization
 * (Phase 7 of Subtask 29.3)
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useCampaignTableData } from '../../hooks/useCampaignTableData';
import { useFeatureFlag } from '../../lib/mcp/hooks/featureFlags';
import { Campaign } from '../../lib/mcp/types/analytics';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface VirtualizedCampaignTableProps {
  campaigns: Campaign[];
  isLoading?: boolean;
  onRowClick?: (campaign: Campaign) => void;
  height?: number;
  itemHeight?: number;
  enableVirtualization?: boolean;
}

interface RowData {
  campaigns: Campaign[];
  columns: ColumnConfig[];
  onRowClick?: (campaign: Campaign) => void;
}

interface ColumnConfig {
  key: keyof Campaign;
  label: string;
  width: number;
  sortable: boolean;
  formatter?: (value: any) => string;
}

const defaultColumns: ColumnConfig[] = [
  { key: 'name', label: 'Campaign Name', width: 200, sortable: true },
  { key: 'status', label: 'Status', width: 100, sortable: true },
  { key: 'type', label: 'Type', width: 120, sortable: true },
  { key: 'budget', label: 'Budget', width: 100, sortable: true, formatter: (value) => `$${value?.toLocaleString()}` },
  { key: 'spend', label: 'Spend', width: 100, sortable: true, formatter: (value) => `$${value?.toLocaleString()}` },
  { key: 'impressions', label: 'Impressions', width: 120, sortable: true, formatter: (value) => value?.toLocaleString() },
  { key: 'clicks', label: 'Clicks', width: 100, sortable: true, formatter: (value) => value?.toLocaleString() },
  { key: 'ctr', label: 'CTR', width: 80, sortable: true, formatter: (value) => `${(value * 100)?.toFixed(2)}%` },
  { key: 'conversions', label: 'Conversions', width: 120, sortable: true, formatter: (value) => value?.toLocaleString() },
  { key: 'roas', label: 'ROAS', width: 80, sortable: true, formatter: (value) => `${value?.toFixed(2)}x` }
];

const VirtualTableRow: React.FC<{ index: number; style: React.CSSProperties; data: RowData }> = ({ 
  index, 
  style, 
  data 
}) => {
  const { campaigns, columns, onRowClick } = data;
  const campaign = campaigns[index];

  if (!campaign) {
    return (
      <div style={style} className="flex items-center px-4 border-b border-gray-200 bg-gray-50">
        <div className="animate-pulse w-full h-4 bg-gray-300 rounded"></div>
      </div>
    );
  }

  return (
    <div 
      style={style} 
      className="flex items-center px-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => onRowClick?.(campaign)}
    >
      {columns.map((column) => {
        const value = campaign[column.key];
        const displayValue = column.formatter ? column.formatter(value) : String(value || '');
        
        return (
          <div 
            key={column.key}
            className="flex-shrink-0 truncate text-sm text-gray-900"
            style={{ width: column.width }}
          >
            {displayValue}
          </div>
        );
      })}
    </div>
  );
};

const VirtualTableHeader: React.FC<{
  columns: ColumnConfig[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}> = ({ columns, sortColumn, sortDirection, onSort }) => {
  return (
    <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-900">
      {columns.map((column) => (
        <div 
          key={column.key}
          className={`flex-shrink-0 flex items-center space-x-1 ${
            column.sortable ? 'cursor-pointer hover:text-blue-600' : ''
          }`}
          style={{ width: column.width }}
          onClick={() => column.sortable && onSort?.(column.key)}
        >
          <span className="truncate">{column.label}</span>
          {column.sortable && (
            <div className="flex flex-col">
              <ChevronUpIcon 
                className={`h-3 w-3 ${
                  sortColumn === column.key && sortDirection === 'asc' 
                    ? 'text-blue-600' 
                    : 'text-gray-400'
                }`}
              />
              <ChevronDownIcon 
                className={`h-3 w-3 ${
                  sortColumn === column.key && sortDirection === 'desc' 
                    ? 'text-blue-600' 
                    : 'text-gray-400'
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const VirtualizedCampaignTable: React.FC<VirtualizedCampaignTableProps> = ({
  campaigns,
  isLoading = false,
  onRowClick,
  height = 600,
  itemHeight = 50,
  enableVirtualization = true
}) => {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Check if virtualization feature flag is enabled
  const { isEnabled: virtualizationEnabled, isLoading: flagLoading } = useFeatureFlag('campaign_table_virtualization_enabled');
  
  const shouldUseVirtualization = useMemo(() => {
    return enableVirtualization && virtualizationEnabled && campaigns.length > 50;
  }, [enableVirtualization, virtualizationEnabled, campaigns.length]);

  // Sort campaigns
  const sortedCampaigns = useMemo(() => {
    if (!sortColumn) return campaigns;

    return [...campaigns].sort((a, b) => {
      const aValue = a[sortColumn as keyof Campaign];
      const bValue = b[sortColumn as keyof Campaign];
      
      if (aValue === bValue) return 0;
      
      const isAscending = sortDirection === 'asc';
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return isAscending 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return isAscending ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }, [campaigns, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const rowData: RowData = useMemo(() => ({
    campaigns: sortedCampaigns,
    columns: defaultColumns,
    onRowClick
  }), [sortedCampaigns, onRowClick]);

  if (isLoading || flagLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200"></div>
          <div className="space-y-2 p-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <VirtualTableHeader
          columns={defaultColumns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
        <div className="text-center py-12 text-gray-500">
          No campaigns found.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <VirtualTableHeader
        columns={defaultColumns}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      
      {shouldUseVirtualization ? (
        <List
          height={height}
          itemCount={sortedCampaigns.length}
          itemSize={itemHeight}
          itemData={rowData}
          overscanCount={5}
        >
          {VirtualTableRow}
        </List>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {sortedCampaigns.map((campaign, index) => (
            <VirtualTableRow
              key={campaign.id}
              index={index}
              style={{ height: itemHeight }}
              data={rowData}
            />
          ))}
        </div>
      )}
      
      {shouldUseVirtualization && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
          Virtualized view - showing {Math.min(10, sortedCampaigns.length)} of {sortedCampaigns.length} rows
        </div>
      )}
    </div>
  );
};

export default VirtualizedCampaignTable;