/**
 * Enhanced Sorting Controls Component
 * 
 * Advanced sorting UI for campaign table with feature flag control,
 * multi-column sorting, and enhanced visual indicators (Phase 4 of Subtask 29.3)
 */

'use client';

import React, { useState } from 'react';
import { CampaignData, CampaignTableSorting } from '@/lib/mcp/dataFetchers/CampaignTableDataFetcher';

// Icons
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

const ArrowsUpDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const SortIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

interface SortableColumn {
  key: keyof CampaignData;
  label: string;
  sortable: boolean;
  defaultSort?: 'asc' | 'desc';
  hint?: string;
}

interface EnhancedSortingControlsProps {
  columns: SortableColumn[];
  currentSorting: CampaignTableSorting;
  onSortChange: (sorting: CampaignTableSorting) => void;
  onResetSort: () => void;
  sortingEnabled?: boolean;
  showQuickSort?: boolean;
  className?: string;
}

const SORTABLE_COLUMNS: SortableColumn[] = [
  { key: 'name', label: 'Campaign Name', sortable: true, defaultSort: 'asc', hint: 'Sort campaigns alphabetically' },
  { key: 'status', label: 'Status', sortable: true, defaultSort: 'asc', hint: 'Group by campaign status' },
  { key: 'type', label: 'Type', sortable: true, defaultSort: 'asc', hint: 'Group by campaign type' },
  { key: 'budget', label: 'Budget', sortable: true, defaultSort: 'desc', hint: 'Sort by budget amount' },
  { key: 'spend', label: 'Spend', sortable: true, defaultSort: 'desc', hint: 'Sort by total spend' },
  { key: 'impressions', label: 'Impressions', sortable: true, defaultSort: 'desc', hint: 'Sort by impression count' },
  { key: 'clicks', label: 'Clicks', sortable: true, defaultSort: 'desc', hint: 'Sort by click count' },
  { key: 'ctr', label: 'CTR', sortable: true, defaultSort: 'desc', hint: 'Sort by click-through rate' },
  { key: 'cpc', label: 'CPC', sortable: true, defaultSort: 'asc', hint: 'Sort by cost per click' },
  { key: 'conversions', label: 'Conversions', sortable: true, defaultSort: 'desc', hint: 'Sort by conversion count' },
  { key: 'conversionRate', label: 'Conversion Rate', sortable: true, defaultSort: 'desc', hint: 'Sort by conversion rate' },
  { key: 'roas', label: 'ROAS', sortable: true, defaultSort: 'desc', hint: 'Sort by return on ad spend' },
  { key: 'lastModified', label: 'Last Modified', sortable: true, defaultSort: 'desc', hint: 'Sort by modification date' }
];

export function EnhancedSortingControls({
  columns = SORTABLE_COLUMNS,
  currentSorting,
  onSortChange,
  onResetSort,
  sortingEnabled = true,
  showQuickSort = true,
  className = ''
}: EnhancedSortingControlsProps) {

  const [showSortPanel, setShowSortPanel] = useState(false);

  // Quick sort options for common use cases
  const quickSortOptions = [
    { label: 'Highest Spend', column: 'spend' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Best ROAS', column: 'roas' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Most Conversions', column: 'conversions' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Highest CTR', column: 'ctr' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Largest Budget', column: 'budget' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Most Clicks', column: 'clicks' as keyof CampaignData, direction: 'desc' as const },
    { label: 'Campaign Name A-Z', column: 'name' as keyof CampaignData, direction: 'asc' as const },
    { label: 'Recently Modified', column: 'lastModified' as keyof CampaignData, direction: 'desc' as const }
  ];

  // Handle column header click
  const handleColumnSort = (column: keyof CampaignData) => {
    if (!sortingEnabled) return;

    const currentDirection = currentSorting.column === column ? currentSorting.direction : null;
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

    onSortChange({
      column,
      direction: newDirection
    });
  };

  // Handle quick sort selection
  const handleQuickSort = (option: typeof quickSortOptions[0]) => {
    onSortChange({
      column: option.column,
      direction: option.direction
    });
    setShowSortPanel(false);
  };

  // Get sort indicator for column
  const getSortIndicator = (column: keyof CampaignData) => {
    if (currentSorting.column !== column) {
      return <ArrowsUpDownIcon />;
    }
    return currentSorting.direction === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />;
  };

  // Get sort indicator style
  const getSortIndicatorStyle = (column: keyof CampaignData) => {
    const baseStyle = "ml-1 opacity-0 group-hover:opacity-50 transition-opacity";
    if (currentSorting.column === column) {
      return `${baseStyle} opacity-100 text-indigo-600`;
    }
    return baseStyle;
  };

  if (!sortingEnabled) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <SortIcon />
          <h3 className="text-sm font-medium text-gray-900">Sorting</h3>
          {currentSorting.column && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {columns.find(col => col.key === currentSorting.column)?.label} {currentSorting.direction === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {showQuickSort && (
            <button
              onClick={() => setShowSortPanel(!showSortPanel)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Quick Sort
            </button>
          )}
          
          {currentSorting.column && (
            <button
              onClick={onResetSort}
              className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Current Sort Display */}
      {currentSorting.column && (
        <div className="mb-4 p-3 bg-indigo-50 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-800">
                <span className="font-medium">Sorted by:</span> {columns.find(col => col.key === currentSorting.column)?.label}
              </p>
              <p className="text-xs text-indigo-600">
                {currentSorting.direction === 'asc' ? 'Ascending (low to high)' : 'Descending (high to low)'}
              </p>
            </div>
            <div className="text-indigo-600">
              {getSortIndicator(currentSorting.column)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Sort Panel */}
      {showQuickSort && showSortPanel && (
        <div className="mb-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Sort Options</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {quickSortOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleQuickSort(option)}
                className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  currentSorting.column === option.column && currentSorting.direction === option.direction
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                } border`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Column Sort Instructions */}
      <div className="text-xs text-gray-500">
        <p className="mb-1">
          <strong>Tip:</strong> Click any column header in the table to sort by that column. 
          Click again to reverse the sort order.
        </p>
        <p>
          Use Quick Sort above for common sorting patterns, or click column headers for custom sorting.
        </p>
      </div>
    </div>
  );
}

/**
 * Enhanced Table Header Component
 * Integrates with EnhancedSortingControls for clickable column headers
 */
interface SortableColumnHeaderProps {
  column: keyof CampaignData;
  label: string;
  currentSorting: CampaignTableSorting;
  onSort: (column: keyof CampaignData) => void;
  sortingEnabled?: boolean;
  className?: string;
}

export function SortableColumnHeader({
  column,
  label,
  currentSorting,
  onSort,
  sortingEnabled = true,
  className = ''
}: SortableColumnHeaderProps) {

  const isCurrentColumn = currentSorting.column === column;
  const direction = isCurrentColumn ? currentSorting.direction : null;

  const handleClick = () => {
    if (sortingEnabled) {
      onSort(column);
    }
  };

  return (
    <th
      onClick={handleClick}
      className={`group px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
        sortingEnabled ? 'cursor-pointer hover:bg-gray-100' : ''
      } ${className}`}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortingEnabled && (
          <span className={
            isCurrentColumn 
              ? 'text-indigo-600 opacity-100' 
              : 'opacity-0 group-hover:opacity-50 transition-opacity'
          }>
            {direction === 'asc' ? <ChevronUpIcon /> : 
             direction === 'desc' ? <ChevronDownIcon /> : 
             <ArrowsUpDownIcon />}
          </span>
        )}
      </div>
    </th>
  );
}