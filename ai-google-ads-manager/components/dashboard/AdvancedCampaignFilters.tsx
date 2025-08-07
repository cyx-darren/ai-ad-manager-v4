/**
 * Advanced Campaign Filters Component
 * 
 * Enhanced filtering UI for campaign table with real-time search,
 * column-based filtering, and advanced filter options (Phase 3 of Subtask 29.3)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CampaignTableFilters } from '@/lib/mcp/dataFetchers/CampaignTableDataFetcher';

// Icons
const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586a1 1 0 01-.447.894l-4 2A1 1 0 019 20v-6.586a1 1 0 00-.293-.707L2.293 7.293A1 1 0 012 6.586V4z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DollarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
  </svg>
);

interface AdvancedCampaignFiltersProps {
  filters: CampaignTableFilters;
  onFiltersChange: (filters: CampaignTableFilters) => void;
  onClearFilters: () => void;
  searchEnabled?: boolean;
  filteringEnabled?: boolean;
  className?: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

interface BudgetRange {
  min: number;
  max: number;
}

interface SpendRange {
  min: number;
  max: number;
}

export function AdvancedCampaignFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  searchEnabled = true,
  filteringEnabled = true,
  className = ''
}: AdvancedCampaignFiltersProps) {

  // Local state for controlled inputs
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [statusFilter, setStatusFilter] = useState<string[]>(filters.status || []);
  const [typeFilter, setTypeFilter] = useState<string[]>(filters.type || []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(filters.dateRange);
  const [budgetRange, setBudgetRange] = useState<BudgetRange | undefined>(filters.budgetRange);
  const [spendRange, setSpendRange] = useState<SpendRange | undefined>(filters.spendRange);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Search debouncing
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  // Update parent filters when local state changes
  const updateFilters = useCallback(() => {
    const newFilters: CampaignTableFilters = {};
    
    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }
    
    if (statusFilter.length > 0) {
      newFilters.status = statusFilter;
    }
    
    if (typeFilter.length > 0) {
      newFilters.type = typeFilter;
    }
    
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      newFilters.dateRange = dateRange;
    }
    
    if (budgetRange && (budgetRange.min > 0 || budgetRange.max > 0)) {
      newFilters.budgetRange = budgetRange;
    }
    
    if (spendRange && (spendRange.min > 0 || spendRange.max > 0)) {
      newFilters.spendRange = spendRange;
    }
    
    onFiltersChange(newFilters);
  }, [searchTerm, statusFilter, typeFilter, dateRange, budgetRange, spendRange, onFiltersChange]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    
    const timeout = setTimeout(() => {
      updateFilters();
    }, 300); // 300ms debounce
    
    setSearchDebounceTimeout(timeout);
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchTerm]);

  // Update filters for non-search changes immediately
  useEffect(() => {
    updateFilters();
  }, [statusFilter, typeFilter, dateRange, budgetRange, spendRange]);

  // Handle clear all filters
  const handleClearAll = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setTypeFilter([]);
    setDateRange(undefined);
    setBudgetRange(undefined);
    setSpendRange(undefined);
    setShowAdvancedFilters(false);
    onClearFilters();
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm.trim() || 
    statusFilter.length > 0 || 
    typeFilter.length > 0 || 
    dateRange || 
    budgetRange || 
    spendRange;

  // Status options
  const statusOptions = [
    { value: 'ENABLED', label: 'Enabled' },
    { value: 'PAUSED', label: 'Paused' },
    { value: 'REMOVED', label: 'Removed' }
  ];

  // Campaign type options
  const typeOptions = [
    { value: 'SEARCH', label: 'Search' },
    { value: 'DISPLAY', label: 'Display' },
    { value: 'SHOPPING', label: 'Shopping' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'APP', label: 'App' },
    { value: 'PERFORMANCE_MAX', label: 'Performance Max' }
  ];

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FilterIcon />
          <h3 className="text-sm font-medium text-gray-900">Campaign Filters</h3>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {[
                searchTerm.trim() ? 'Search' : null,
                statusFilter.length > 0 ? 'Status' : null,
                typeFilter.length > 0 ? 'Type' : null,
                dateRange ? 'Date' : null,
                budgetRange ? 'Budget' : null,
                spendRange ? 'Spend' : null
              ].filter(Boolean).length} active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <XIcon />
              <span className="ml-1">Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {searchEnabled && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search campaigns by name..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}

      {/* Basic Filters */}
      {filteringEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="space-y-2">
              {statusOptions.map(option => (
                <label key={option.value} className="inline-flex items-center mr-4">
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setStatusFilter([...statusFilter, option.value]);
                      } else {
                        setStatusFilter(statusFilter.filter(s => s !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
            <div className="space-y-2">
              {typeOptions.map(option => (
                <label key={option.value} className="inline-flex items-center mr-4">
                  <input
                    type="checkbox"
                    checked={typeFilter.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTypeFilter([...typeFilter, option.value]);
                      } else {
                        setTypeFilter(typeFilter.filter(t => t !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvancedFilters && filteringEnabled && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Advanced Filters</h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarIcon />
                <span className="ml-1">Date Range</span>
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={dateRange?.startDate || ''}
                  onChange={(e) => setDateRange(prev => ({ 
                    startDate: e.target.value, 
                    endDate: prev?.endDate || '' 
                  }))}
                  placeholder="Start date"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="date"
                  value={dateRange?.endDate || ''}
                  onChange={(e) => setDateRange(prev => ({ 
                    startDate: prev?.startDate || '', 
                    endDate: e.target.value 
                  }))}
                  placeholder="End date"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarIcon />
                <span className="ml-1">Budget Range</span>
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={budgetRange?.min || ''}
                  onChange={(e) => setBudgetRange(prev => ({ 
                    min: Number(e.target.value) || 0, 
                    max: prev?.max || 0 
                  }))}
                  placeholder="Min budget"
                  min="0"
                  step="100"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="number"
                  value={budgetRange?.max || ''}
                  onChange={(e) => setBudgetRange(prev => ({ 
                    min: prev?.min || 0, 
                    max: Number(e.target.value) || 0 
                  }))}
                  placeholder="Max budget"
                  min="0"
                  step="100"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Spend Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarIcon />
                <span className="ml-1">Spend Range</span>
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  value={spendRange?.min || ''}
                  onChange={(e) => setSpendRange(prev => ({ 
                    min: Number(e.target.value) || 0, 
                    max: prev?.max || 0 
                  }))}
                  placeholder="Min spend"
                  min="0"
                  step="100"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="number"
                  value={spendRange?.max || ''}
                  onChange={(e) => setSpendRange(prev => ({ 
                    min: prev?.min || 0, 
                    max: Number(e.target.value) || 0 
                  }))}
                  placeholder="Max spend"
                  min="0"
                  step="100"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex flex-wrap gap-2">
            {searchTerm.trim() && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: "{searchTerm.trim()}"
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-1 hover:text-blue-600"
                >
                  <XIcon />
                </button>
              </span>
            )}
            
            {statusFilter.map(status => (
              <span key={status} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Status: {status}
                <button
                  onClick={() => setStatusFilter(statusFilter.filter(s => s !== status))}
                  className="ml-1 hover:text-green-600"
                >
                  <XIcon />
                </button>
              </span>
            ))}
            
            {typeFilter.map(type => (
              <span key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Type: {type}
                <button
                  onClick={() => setTypeFilter(typeFilter.filter(t => t !== type))}
                  className="ml-1 hover:text-purple-600"
                >
                  <XIcon />
                </button>
              </span>
            ))}
            
            {dateRange && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Date: {dateRange.startDate} to {dateRange.endDate}
                <button
                  onClick={() => setDateRange(undefined)}
                  className="ml-1 hover:text-yellow-600"
                >
                  <XIcon />
                </button>
              </span>
            )}
            
            {budgetRange && (budgetRange.min > 0 || budgetRange.max > 0) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Budget: ${budgetRange.min} - ${budgetRange.max}
                <button
                  onClick={() => setBudgetRange(undefined)}
                  className="ml-1 hover:text-indigo-600"
                >
                  <XIcon />
                </button>
              </span>
            )}
            
            {spendRange && (spendRange.min > 0 || spendRange.max > 0) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Spend: ${spendRange.min} - ${spendRange.max}
                <button
                  onClick={() => setSpendRange(undefined)}
                  className="ml-1 hover:text-red-600"
                >
                  <XIcon />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}