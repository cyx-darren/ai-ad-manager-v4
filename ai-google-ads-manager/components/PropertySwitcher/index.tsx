/**
 * PropertySwitcher Dropdown Component
 * 
 * A comprehensive dropdown component for GA4 property selection with search,
 * filtering, accessibility, and keyboard navigation support.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { GA4Property, PropertyFilter, PropertySort } from '@/lib/mcp/types/property';
import { usePropertySelection, usePropertyValidation } from '@/lib/mcp/hooks/propertyHooks';
import { useSelectedProperty, useAvailableProperties, usePropertyFilter } from '@/lib/mcp/context/PropertyContext';

// Component props interface
export interface PropertySwitcherProps {
  /** Whether the switcher is disabled */
  disabled?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Placeholder text when no property is selected */
  placeholder?: string;
  /** Maximum height of the dropdown */
  maxHeight?: number;
  /** Enable property search */
  enableSearch?: boolean;
  /** Enable property filtering */
  enableFiltering?: boolean;
  /** Custom property renderer */
  renderProperty?: (property: GA4Property) => React.ReactNode;
  /** Callback when property is selected */
  onPropertySelect?: (property: GA4Property) => void;
  /** Show property health indicators */
  showHealthIndicators?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

// Property item component
interface PropertyItemProps {
  property: GA4Property;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  showHealthIndicators?: boolean;
  renderProperty?: (property: GA4Property) => React.ReactNode;
}

const PropertyItem: React.FC<PropertyItemProps> = ({ 
  property, 
  isSelected, 
  isHighlighted, 
  onClick, 
  onMouseEnter,
  showHealthIndicators = true,
  renderProperty
}) => {
  const { checkPropertyPermissions } = usePropertyValidation();
  
  const permissionCheck = useMemo(() => {
    return checkPropertyPermissions(property, [], 'READ_ONLY');
  }, [property, checkPropertyPermissions]);

  const getHealthColor = () => {
    if (!showHealthIndicators) return 'bg-gray-100';
    if (!permissionCheck.isValid) return 'bg-red-100';
    if (property.accessLevel === 'EDIT') return 'bg-green-100';
    if (property.accessLevel === 'READ_ONLY') return 'bg-yellow-100';
    return 'bg-gray-100';
  };

  const getHealthIndicator = () => {
    if (!showHealthIndicators) return null;
    if (!permissionCheck.isValid) return '❌';
    if (property.accessLevel === 'EDIT') return '✅';
    if (property.accessLevel === 'READ_ONLY') return '👁️';
    return '❓';
  };

  if (renderProperty) {
    return (
      <div
        className={`cursor-pointer p-3 transition-colors ${
          isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
        } ${isSelected ? 'bg-blue-100' : ''}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        role="option"
        aria-selected={isSelected}
      >
        {renderProperty(property)}
      </div>
    );
  }

  return (
    <div
      className={`cursor-pointer p-3 border-l-4 transition-all duration-200 ${
        isHighlighted ? 'bg-blue-50 border-l-blue-500' : 'hover:bg-gray-50 border-l-transparent'
      } ${isSelected ? 'bg-blue-100 border-l-blue-600' : ''} ${getHealthColor()}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {property.name}
            </h4>
            {showHealthIndicators && (
              <span className="text-xs" title={`Access Level: ${property.accessLevel}`}>
                {getHealthIndicator()}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">
            ID: {property.id} • {property.timeZone} • {property.currencyCode}
          </p>
          {property.industryCategory && (
            <p className="text-xs text-gray-400 truncate">
              {property.industryCategory}
            </p>
          )}
        </div>
        {isSelected && (
          <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <div className="p-3 space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
      </div>
    ))}
  </div>
);

// Empty state component
const EmptyState: React.FC<{ searchQuery: string }> = ({ searchQuery }) => (
  <div className="p-6 text-center">
    <ExclamationTriangleIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
    <h3 className="text-sm font-medium text-gray-900 mb-1">
      {searchQuery ? 'No properties found' : 'No properties available'}
    </h3>
    <p className="text-xs text-gray-500">
      {searchQuery 
        ? `No properties match "${searchQuery}". Try adjusting your search.`
        : 'Connect your Google Analytics account to view properties.'
      }
    </p>
  </div>
);

// Main PropertySwitcher component
export const PropertySwitcher: React.FC<PropertySwitcherProps> = ({
  disabled = false,
  className = '',
  placeholder = 'Select a property...',
  maxHeight = 320,
  enableSearch = true,
  enableFiltering = true,
  renderProperty,
  onPropertySelect,
  showHealthIndicators = true,
  compact = false
}) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Hooks
  const { selectedProperty, selectProperty, clearSelection, isLoading, error } = useSelectedProperty();
  const { availableProperties, refreshProperties } = useAvailableProperties();
  const { filter, updateFilter, sort, updateSort } = usePropertyFilter();

  // Filtered and sorted properties
  const filteredProperties = useMemo(() => {
    let filtered = availableProperties;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(property => 
        property.name.toLowerCase().includes(query) ||
        property.id.toLowerCase().includes(query) ||
        property.displayName.toLowerCase().includes(query)
      );
    }

    // Apply additional filters (if any are set)
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(property => filter.types!.includes(property.propertyType));
    }

    if (filter.accessLevels && filter.accessLevels.length > 0) {
      filtered = filtered.filter(property => filter.accessLevels!.includes(property.accessLevel));
    }

    if (filter.statuses && filter.statuses.length > 0) {
      filtered = filtered.filter(property => filter.statuses!.includes(property.status));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort.field) {
        case 'name':
          return sort.direction === 'asc' 
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'createTime':
          return sort.direction === 'asc'
            ? new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
            : new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
        case 'accessLevel':
          const accessOrder = { 'EDIT': 3, 'READ_ONLY': 2, 'NO_ACCESS': 1 };
          return sort.direction === 'asc'
            ? accessOrder[a.accessLevel] - accessOrder[b.accessLevel]
            : accessOrder[b.accessLevel] - accessOrder[a.accessLevel];
        default:
          return 0;
      }
    });

    return filtered;
  }, [availableProperties, searchQuery, filter, sort]);

  // Handle property selection
  const handlePropertySelect = useCallback(async (property: GA4Property) => {
    try {
      await selectProperty(property);
      onPropertySelect?.(property);
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Failed to select property:', error);
    }
  }, [selectProperty, onPropertySelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredProperties.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredProperties.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProperties[highlightedIndex]) {
          handlePropertySelect(filteredProperties[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredProperties, highlightedIndex, handlePropertySelect]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && enableSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, enableSearch]);

  // Reset highlighted index when filtered properties change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredProperties]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between px-3 py-2 border border-gray-300 
          bg-white rounded-md shadow-sm text-left cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          hover:border-gray-400 transition-colors
          ${compact ? 'text-sm' : 'text-sm'}
          ${error ? 'border-red-300' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selectedProperty ? `Selected property: ${selectedProperty.name}` : placeholder}
      >
        <span className={`block truncate ${selectedProperty ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedProperty ? selectedProperty.name : placeholder}
        </span>
        <ChevronDownIcon 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      {/* Error Display */}
      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error.message}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg"
          style={{ maxHeight }}
        >
          {/* Search Input */}
          {enableSearch && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search properties..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Properties List */}
          <div 
            className="overflow-auto"
            style={{ maxHeight: maxHeight - (enableSearch ? 60 : 0) }}
            role="listbox"
            aria-label="GA4 Properties"
          >
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredProperties.length === 0 ? (
              <EmptyState searchQuery={searchQuery} />
            ) : (
              filteredProperties.map((property, index) => (
                <PropertyItem
                  key={property.id}
                  property={property}
                  isSelected={selectedProperty?.id === property.id}
                  isHighlighted={index === highlightedIndex}
                  onClick={() => handlePropertySelect(property)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  showHealthIndicators={showHealthIndicators}
                  renderProperty={renderProperty}
                />
              ))
            )}
          </div>

          {/* Refresh Button */}
          {availableProperties.length > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={refreshProperties}
                disabled={isLoading}
                className="w-full px-3 py-1 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {isLoading ? 'Refreshing...' : 'Refresh Properties'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PropertySwitcher;