/**
 * Property Controls for Dashboard Header
 * 
 * Integrates property selection controls into the dashboard header
 * with responsive design and consistent styling.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { 
  BuildingOfficeIcon, 
  ArrowPathIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { GA4Property } from '@/lib/mcp/types/property';
import { useSelectedProperty, useAvailableProperties } from '@/lib/mcp/context/PropertyContext';
import PropertySwitcher from '../PropertySwitcher';

// Property info badge component
interface PropertyBadgeProps {
  property: GA4Property;
  compact?: boolean;
  showDetails?: boolean;
  onClick?: () => void;
}

const PropertyBadge: React.FC<PropertyBadgeProps> = ({ 
  property, 
  compact = false, 
  showDetails = true,
  onClick
}) => {
  const getAccessLevelColor = (accessLevel: string) => {
    switch (accessLevel) {
      case 'EDIT': return 'bg-green-100 text-green-800 border-green-200';
      case 'READ_ONLY': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'NO_ACCESS': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccessLevelIcon = (accessLevel: string) => {
    switch (accessLevel) {
      case 'EDIT': return '✏️';
      case 'READ_ONLY': return '👁️';
      case 'NO_ACCESS': return '❌';
      default: return '❓';
    }
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title={`${property.name} (${property.id})`}
      >
        <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900 truncate max-w-32">
          {property.name}
        </span>
        <span className="text-xs text-gray-500">
          {getAccessLevelIcon(property.accessLevel)}
        </span>
      </button>
    );
  }

  return (
    <div 
      className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
      role="button"
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
    >
      <div className="flex-shrink-0">
        <BuildingOfficeIcon className="w-6 h-6 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {property.name}
          </h3>
          <span 
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getAccessLevelColor(property.accessLevel)}`}
            title={`Access Level: ${property.accessLevel}`}
          >
            {getAccessLevelIcon(property.accessLevel)} {property.accessLevel}
          </span>
        </div>
        {showDetails && (
          <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
            <span>ID: {property.id}</span>
            <span>{property.timeZone}</span>
            <span>{property.currencyCode}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Property stats component
const PropertyStats: React.FC<{ property: GA4Property }> = ({ property }) => {
  const stats = [
    { label: 'Property Type', value: property.propertyType },
    { label: 'Industry', value: property.industryCategory || 'Not specified' },
    { label: 'Time Zone', value: property.timeZone },
    { label: 'Currency', value: property.currencyCode }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
      {stats.map((stat, index) => (
        <div key={index} className="text-center">
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className="text-sm font-medium text-gray-900 truncate">{stat.value}</p>
        </div>
      ))}
    </div>
  );
};

// Main property controls component
export interface PropertyControlsProps {
  /** Show property details in expanded mode */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Show property statistics */
  showStats?: boolean;
  /** Custom className */
  className?: string;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Show settings button */
  showSettings?: boolean;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
}

export const PropertyControls: React.FC<PropertyControlsProps> = ({
  showDetails = true,
  compact = false,
  showStats = false,
  className = '',
  showRefresh = true,
  showSettings = false,
  onSettingsClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { selectedProperty, selectProperty, clearSelection, isLoading, error } = useSelectedProperty();
  const { availableProperties, refreshProperties, lastRefresh } = useAvailableProperties();

  const handlePropertySelect = useCallback((property: GA4Property) => {
    // Property selection is handled by the PropertySwitcher component
    setIsExpanded(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshProperties();
    } catch (error) {
      console.error('Failed to refresh properties:', error);
    }
  }, [refreshProperties]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Responsive breakpoints handling
  const getResponsiveClasses = () => {
    if (compact) {
      return 'flex items-center space-x-2';
    }
    return 'flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4';
  };

  if (!selectedProperty && availableProperties.length === 0 && !isLoading) {
    return (
      <div className={`${className} ${getResponsiveClasses()}`}>
        <div className="flex items-center space-x-2 text-gray-500">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <span className="text-sm">No properties available</span>
        </div>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} space-y-3`}>
      {/* Main Controls Row */}
      <div className={getResponsiveClasses()}>
        {/* Selected Property Display or Switcher */}
        <div className="flex-1 min-w-0">
          {selectedProperty && !isExpanded ? (
            <PropertyBadge
              property={selectedProperty}
              compact={compact}
              showDetails={showDetails && !compact}
              onClick={compact ? toggleExpanded : undefined}
            />
          ) : (
            <div className="max-w-md">
              <PropertySwitcher
                placeholder="Select a GA4 property..."
                disabled={isLoading}
                enableSearch={true}
                enableFiltering={true}
                showHealthIndicators={true}
                compact={compact}
                onPropertySelect={handlePropertySelect}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {selectedProperty && !compact && (
            <button
              onClick={toggleExpanded}
              className="inline-flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              <InformationCircleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{isExpanded ? 'Less' : 'Details'}</span>
            </button>
          )}

          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
              title={lastRefresh ? `Last refreshed: ${new Date(lastRefresh).toLocaleTimeString()}` : 'Refresh properties'}
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {showSettings && (
            <button
              onClick={onSettingsClick}
              className="inline-flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              title="Property settings"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Property Error</p>
            <p className="text-sm text-red-700">{error.message}</p>
            {error.suggestedAction && (
              <p className="text-xs text-red-600 mt-1">{error.suggestedAction}</p>
            )}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {selectedProperty && isExpanded && showStats && (
        <PropertyStats property={selectedProperty} />
      )}

      {/* Quick Stats for Compact Mode */}
      {selectedProperty && compact && !isExpanded && (
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span>ID: {selectedProperty.id}</span>
          <span>{selectedProperty.timeZone}</span>
          <span>{selectedProperty.currencyCode}</span>
          <span className="capitalize">{selectedProperty.propertyType.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
};

// Higher-order component for easy integration
export interface WithPropertyControlsProps {
  propertyControlsProps?: PropertyControlsProps;
  children?: React.ReactNode;
}

export const withPropertyControls = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P & WithPropertyControlsProps> => {
  return function WithPropertyControlsComponent({ propertyControlsProps, children, ...props }) {
    return (
      <div className="space-y-4">
        <PropertyControls {...propertyControlsProps} />
        <Component {...(props as P)}>
          {children}
        </Component>
      </div>
    );
  };
};

export default PropertyControls;