/**
 * Property Search & Filtering Components
 * 
 * Comprehensive search and filtering UI for GA4 properties with 
 * real-time updates, filter tags, and advanced sorting options.
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  CheckIcon,
  ArrowsUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TagIcon,
  Bars3BottomLeftIcon
} from '@heroicons/react/24/outline';
import { 
  GA4Property, 
  PropertyFilter, 
  PropertySort, 
  PropertyType, 
  PropertyAccessLevel, 
  PropertyStatus,
  PropertySortField,
  SortDirection
} from '@/lib/mcp/types/property';

// Search input component
export interface PropertySearchProps {
  /** Current search query */
  value: string;
  /** Callback when search changes */
  onChange: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Show search history */
  showHistory?: boolean;
  /** Search history items */
  history?: string[];
  /** Callback when history item is selected */
  onHistorySelect?: (query: string) => void;
  /** Custom className */
  className?: string;
}

export const PropertySearch: React.FC<PropertySearchProps> = ({
  value,
  onChange,
  placeholder = 'Search properties...',
  debounceMs = 300,
  showHistory = false,
  history = [],
  onHistorySelect,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, onChange, debounceMs]);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue('');
    setShowHistoryDropdown(false);
  };

  const handleHistorySelect = (query: string) => {
    setLocalValue(query);
    setShowHistoryDropdown(false);
    onHistorySelect?.(query);
  };

  const handleFocus = () => {
    if (showHistory && history.length > 0) {
      setShowHistoryDropdown(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding to allow clicking on history items
    setTimeout(() => setShowHistoryDropdown(false), 150);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search History Dropdown */}
      {showHistory && showHistoryDropdown && history.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
          <div className="p-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">Recent Searches</span>
          </div>
          {history.slice(0, 5).map((item, index) => (
            <button
              key={index}
              onClick={() => handleHistorySelect(item)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
                <span className="truncate">{item}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Filter dropdown component
export interface FilterDropdownProps {
  /** Filter label */
  label: string;
  /** Available options */
  options: Array<{ value: string; label: string; count?: number }>;
  /** Selected values */
  selectedValues: string[];
  /** Callback when selection changes */
  onChange: (values: string[]) => void;
  /** Allow multiple selections */
  multiple?: boolean;
  /** Custom className */
  className?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  multiple = true,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value];
      onChange(newValues);
    } else {
      onChange(selectedValues.includes(value) ? [] : [value]);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const selectedCount = selectedValues.length;
  const hasSelections = selectedCount > 0;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center space-x-2 px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasSelections 
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <FunnelIcon className="w-4 h-4" />
        <span>{label}</span>
        {hasSelections && (
          <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs rounded-full">
            {selectedCount}
          </span>
        )}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {hasSelections && (
              <button
                onClick={handleClear}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-auto">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </div>
                  {option.count !== undefined && (
                    <span className="text-xs text-gray-500 ml-2">({option.count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Sort controls component
export interface SortControlsProps {
  /** Current sort configuration */
  sort: PropertySort;
  /** Callback when sort changes */
  onChange: (sort: PropertySort) => void;
  /** Available sort fields */
  sortFields: Array<{ field: PropertySortField; label: string }>;
  /** Custom className */
  className?: string;
}

export const SortControls: React.FC<SortControlsProps> = ({
  sort,
  onChange,
  sortFields,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentField = sortFields.find(f => f.field === sort.field);

  const handleFieldChange = (field: PropertySortField) => {
    onChange({ ...sort, field });
    setIsOpen(false);
  };

  const handleDirectionToggle = () => {
    onChange({ 
      ...sort, 
      direction: sort.direction === 'asc' ? 'desc' : 'asc' 
    });
  };

  const DirectionIcon = sort.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-1">
        {/* Sort Field Dropdown */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Bars3BottomLeftIcon className="w-4 h-4" />
          <span>{currentField?.label || 'Name'}</span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Sort Direction Toggle */}
        <button
          onClick={handleDirectionToggle}
          className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 bg-white rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={`Sort ${sort.direction === 'asc' ? 'ascending' : 'descending'}`}
        >
          <DirectionIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Sort Field Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-1">
            {sortFields.map((field) => (
              <button
                key={field.field}
                onClick={() => handleFieldChange(field.field)}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                  sort.field === field.field ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <ArrowsUpDownIcon className="w-4 h-4" />
                <span>{field.label}</span>
                {sort.field === field.field && (
                  <CheckIcon className="w-4 h-4 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Active filter tags component
export interface ActiveFilterTagsProps {
  /** Current filter state */
  filter: PropertyFilter;
  /** Callback when filter changes */
  onChange: (filter: PropertyFilter) => void;
  /** Custom className */
  className?: string;
}

export const ActiveFilterTags: React.FC<ActiveFilterTagsProps> = ({
  filter,
  onChange,
  className = ''
}) => {
  const tags = useMemo(() => {
    const result: Array<{ key: string; label: string; value: string }> = [];

    // Property types
    filter.types?.forEach(type => {
      result.push({
        key: 'types',
        label: 'Type',
        value: type
      });
    });

    // Access levels
    filter.accessLevels?.forEach(level => {
      result.push({
        key: 'accessLevels',
        label: 'Access',
        value: level
      });
    });

    // Statuses
    filter.statuses?.forEach(status => {
      result.push({
        key: 'statuses',
        label: 'Status',
        value: status
      });
    });

    return result;
  }, [filter]);

  const removeTag = (key: string, value: string) => {
    const newFilter = { ...filter };
    
    if (key === 'types' && newFilter.types) {
      newFilter.types = newFilter.types.filter(t => t !== value);
      if (newFilter.types.length === 0) delete newFilter.types;
    } else if (key === 'accessLevels' && newFilter.accessLevels) {
      newFilter.accessLevels = newFilter.accessLevels.filter(l => l !== value);
      if (newFilter.accessLevels.length === 0) delete newFilter.accessLevels;
    } else if (key === 'statuses' && newFilter.statuses) {
      newFilter.statuses = newFilter.statuses.filter(s => s !== value);
      if (newFilter.statuses.length === 0) delete newFilter.statuses;
    }

    onChange(newFilter);
  };

  const clearAll = () => {
    onChange({});
  };

  if (tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center space-x-1">
        <TagIcon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">Filters:</span>
      </div>
      
      {tags.map((tag, index) => (
        <span
          key={`${tag.key}-${tag.value}-${index}`}
          className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
        >
          <span>{tag.label}: {tag.value}</span>
          <button
            onClick={() => removeTag(tag.key, tag.value)}
            className="text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
      
      <button
        onClick={clearAll}
        className="text-xs text-gray-500 hover:text-gray-700 underline focus:outline-none"
      >
        Clear all
      </button>
    </div>
  );
};

// Combined property filters component
export interface PropertyFiltersProps {
  /** Available properties for counting */
  properties: GA4Property[];
  /** Current filter state */
  filter: PropertyFilter;
  /** Current sort state */
  sort: PropertySort;
  /** Current search query */
  searchQuery: string;
  /** Search change callback */
  onSearchChange: (query: string) => void;
  /** Filter change callback */
  onFilterChange: (filter: PropertyFilter) => void;
  /** Sort change callback */
  onSortChange: (sort: PropertySort) => void;
  /** Search history */
  searchHistory?: string[];
  /** Custom className */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  properties,
  filter,
  sort,
  searchQuery,
  onSearchChange,
  onFilterChange,
  onSortChange,
  searchHistory = [],
  className = '',
  compact = false
}) => {
  // Generate filter options with counts
  const filterOptions = useMemo(() => {
    const typeOptions = Object.values(PropertyType).map(type => ({
      value: type,
      label: type.replace('_', ' '),
      count: properties.filter(p => p.propertyType === type).length
    }));

    const accessLevelOptions = Object.values(PropertyAccessLevel).map(level => ({
      value: level,
      label: level.replace('_', ' '),
      count: properties.filter(p => p.accessLevel === level).length
    }));

    const statusOptions = Object.values(PropertyStatus).map(status => ({
      value: status,
      label: status,
      count: properties.filter(p => p.status === status).length
    }));

    return { typeOptions, accessLevelOptions, statusOptions };
  }, [properties]);

  const sortFields = [
    { field: 'name' as PropertySortField, label: 'Name' },
    { field: 'createTime' as PropertySortField, label: 'Created' },
    { field: 'accessLevel' as PropertySortField, label: 'Access Level' }
  ];

  const handleTypeFilterChange = (types: string[]) => {
    onFilterChange({ ...filter, types: types as PropertyType[] });
  };

  const handleAccessLevelFilterChange = (accessLevels: string[]) => {
    onFilterChange({ ...filter, accessLevels: accessLevels as PropertyAccessLevel[] });
  };

  const handleStatusFilterChange = (statuses: string[]) => {
    onFilterChange({ ...filter, statuses: statuses as PropertyStatus[] });
  };

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        <PropertySearch
          value={searchQuery}
          onChange={onSearchChange}
          showHistory={searchHistory.length > 0}
          history={searchHistory}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Type"
            options={filterOptions.typeOptions}
            selectedValues={filter.types || []}
            onChange={handleTypeFilterChange}
          />
          <FilterDropdown
            label="Access"
            options={filterOptions.accessLevelOptions}
            selectedValues={filter.accessLevels || []}
            onChange={handleAccessLevelFilterChange}
          />
          <SortControls
            sort={sort}
            onChange={onSortChange}
            sortFields={sortFields}
          />
        </div>
        <ActiveFilterTags
          filter={filter}
          onChange={onFilterChange}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      <PropertySearch
        value={searchQuery}
        onChange={onSearchChange}
        showHistory={searchHistory.length > 0}
        history={searchHistory}
      />

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          label="Property Type"
          options={filterOptions.typeOptions}
          selectedValues={filter.types || []}
          onChange={handleTypeFilterChange}
        />
        <FilterDropdown
          label="Access Level"
          options={filterOptions.accessLevelOptions}
          selectedValues={filter.accessLevels || []}
          onChange={handleAccessLevelFilterChange}
        />
        <FilterDropdown
          label="Status"
          options={filterOptions.statusOptions}
          selectedValues={filter.statuses || []}
          onChange={handleStatusFilterChange}
        />
        <SortControls
          sort={sort}
          onChange={onSortChange}
          sortFields={sortFields}
        />
      </div>

      {/* Active Filter Tags */}
      <ActiveFilterTags
        filter={filter}
        onChange={onFilterChange}
      />
    </div>
  );
};

export default PropertyFilters;