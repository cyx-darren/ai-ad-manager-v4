/**
 * Property Badge Component
 * 
 * Visual indicators and badges for GA4 property status, health, and information.
 * Provides consistent property representation across the application.
 */

'use client';

import React, { useState, useRef } from 'react';
import { 
  BuildingOfficeIcon, 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  EyeIcon,
  PencilIcon,
  ClockIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { GA4Property, PropertyAccessLevel, PropertyStatus } from '@/lib/mcp/types/property';

// Badge size variants
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

// Badge style variants
export type BadgeVariant = 'default' | 'compact' | 'detailed' | 'minimal';

// Property badge props
export interface PropertyBadgeProps {
  /** The GA4 property to display */
  property: GA4Property;
  /** Size variant */
  size?: BadgeSize;
  /** Style variant */
  variant?: BadgeVariant;
  /** Show property health indicators */
  showHealth?: boolean;
  /** Show access level indicator */
  showAccessLevel?: boolean;
  /** Show property status */
  showStatus?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Make the badge clickable */
  clickable?: boolean;
  /** Callback when badge is clicked */
  onClick?: (property: GA4Property) => void;
  /** Custom className */
  className?: string;
  /** Show property switching animation */
  animated?: boolean;
}

// Tooltip component
interface PropertyTooltipProps {
  property: GA4Property;
  show: boolean;
  anchorRef: React.RefObject<HTMLElement>;
}

const PropertyTooltip: React.FC<PropertyTooltipProps> = ({ property, show, anchorRef }) => {
  if (!show) return null;

  return (
    <div className="absolute z-50 w-72 p-4 bg-white border border-gray-200 rounded-lg shadow-lg bottom-full mb-2 left-1/2 transform -translate-x-1/2">
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
      
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start space-x-3">
          <BuildingOfficeIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {property.name}
            </h3>
            <p className="text-xs text-gray-500">
              Property ID: {property.id}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <EyeIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600">Access: {property.accessLevel}</span>
            </div>
            <div className="flex items-center space-x-2">
              <GlobeAltIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600">{property.timeZone}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CurrencyDollarIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600">{property.currencyCode}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600">
                {property.propertyType}
              </span>
            </div>
          </div>
        </div>

        {/* Industry Category */}
        {property.industryCategory && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Industry:</span> {property.industryCategory}
            </p>
          </div>
        )}

        {/* Creation Date */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Created:</span> {new Date(property.createTime).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

// Access level indicator
const AccessLevelIndicator: React.FC<{ accessLevel: PropertyAccessLevel; size: BadgeSize }> = ({ 
  accessLevel, 
  size 
}) => {
  const getAccessConfig = () => {
    switch (accessLevel) {
      case 'EDIT':
        return {
          icon: PencilIcon,
          color: 'text-green-600 bg-green-100',
          label: 'Edit Access'
        };
      case 'READ_ONLY':
        return {
          icon: EyeIcon,
          color: 'text-yellow-600 bg-yellow-100',
          label: 'Read Only'
        };
      case 'NO_ACCESS':
        return {
          icon: ExclamationTriangleIcon,
          color: 'text-red-600 bg-red-100',
          label: 'No Access'
        };
      default:
        return {
          icon: InformationCircleIcon,
          color: 'text-gray-600 bg-gray-100',
          label: 'Unknown'
        };
    }
  };

  const config = getAccessConfig();
  const Icon = config.icon;
  
  const iconSize = {
    xs: 'w-3 h-3',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size];

  const padding = {
    xs: 'p-1',
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2'
  }[size];

  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full ${config.color} ${padding}`}
      title={config.label}
    >
      <Icon className={iconSize} />
    </div>
  );
};

// Status indicator
const StatusIndicator: React.FC<{ status: PropertyStatus; size: BadgeSize }> = ({ status, size }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'bg-green-500', label: 'Active' };
      case 'INACTIVE':
        return { color: 'bg-red-500', label: 'Inactive' };
      case 'PENDING':
        return { color: 'bg-yellow-500', label: 'Pending' };
      default:
        return { color: 'bg-gray-500', label: 'Unknown' };
    }
  };

  const config = getStatusConfig();
  
  const dotSize = {
    xs: 'w-2 h-2',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }[size];

  return (
    <div 
      className={`rounded-full ${config.color} ${dotSize}`}
      title={`Status: ${config.label}`}
    />
  );
};

// Health indicator
const HealthIndicator: React.FC<{ property: GA4Property; size: BadgeSize }> = ({ property, size }) => {
  // Simple health calculation based on access level and status
  const getHealthScore = () => {
    let score = 0;
    if (property.status === 'ACTIVE') score += 40;
    if (property.accessLevel === 'EDIT') score += 30;
    else if (property.accessLevel === 'READ_ONLY') score += 20;
    if (property.permissions && property.permissions.length > 0) score += 30;
    return Math.min(score, 100);
  };

  const healthScore = getHealthScore();
  
  const getHealthColor = () => {
    if (healthScore >= 80) return 'text-green-600';
    if (healthScore >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = () => {
    if (healthScore >= 80) return '●';
    if (healthScore >= 60) return '◐';
    return '○';
  };

  const textSize = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }[size];

  return (
    <span 
      className={`${getHealthColor()} ${textSize} font-mono`}
      title={`Health Score: ${healthScore}%`}
    >
      {getHealthIcon()}
    </span>
  );
};

// Main PropertyBadge component
export const PropertyBadge: React.FC<PropertyBadgeProps> = ({
  property,
  size = 'md',
  variant = 'default',
  showHealth = true,
  showAccessLevel = true,
  showStatus = true,
  showTooltip = true,
  clickable = false,
  onClick,
  className = '',
  animated = false
}) => {
  const [showTooltipState, setShowTooltipState] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (clickable && onClick) {
      onClick(property);
    }
  };

  const handleMouseEnter = () => {
    if (showTooltip) {
      setShowTooltipState(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltipState(false);
  };

  // Size-based styling
  const sizeStyles = {
    xs: {
      container: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
      text: 'text-xs',
      spacing: 'space-x-1'
    },
    sm: {
      container: 'px-2.5 py-1.5 text-sm',
      icon: 'w-4 h-4',
      text: 'text-sm',
      spacing: 'space-x-1.5'
    },
    md: {
      container: 'px-3 py-2 text-sm',
      icon: 'w-4 h-4',
      text: 'text-sm',
      spacing: 'space-x-2'
    },
    lg: {
      container: 'px-4 py-3 text-base',
      icon: 'w-5 h-5',
      text: 'text-base',
      spacing: 'space-x-2'
    }
  }[size];

  // Variant-based content
  const getVariantContent = () => {
    switch (variant) {
      case 'minimal':
        return (
          <div className={`flex items-center ${sizeStyles.spacing}`}>
            <BuildingOfficeIcon className={`${sizeStyles.icon} text-gray-500`} />
            <span className={`${sizeStyles.text} font-medium text-gray-900 truncate max-w-32`}>
              {property.name}
            </span>
          </div>
        );

      case 'compact':
        return (
          <div className={`flex items-center ${sizeStyles.spacing}`}>
            <BuildingOfficeIcon className={`${sizeStyles.icon} text-blue-600`} />
            <span className={`${sizeStyles.text} font-medium text-gray-900 truncate max-w-40`}>
              {property.name}
            </span>
            {showAccessLevel && <AccessLevelIndicator accessLevel={property.accessLevel} size={size} />}
            {showStatus && <StatusIndicator status={property.status} size={size} />}
          </div>
        );

      case 'detailed':
        return (
          <div className="space-y-2">
            <div className={`flex items-center ${sizeStyles.spacing}`}>
              <BuildingOfficeIcon className={`${sizeStyles.icon} text-blue-600`} />
              <span className={`${sizeStyles.text} font-medium text-gray-900 truncate`}>
                {property.name}
              </span>
              <div className="flex items-center space-x-1">
                {showAccessLevel && <AccessLevelIndicator accessLevel={property.accessLevel} size={size} />}
                {showStatus && <StatusIndicator status={property.status} size={size} />}
                {showHealth && <HealthIndicator property={property} size={size} />}
              </div>
            </div>
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span>ID: {property.id}</span>
              <span>{property.timeZone}</span>
              <span>{property.currencyCode}</span>
            </div>
          </div>
        );

      default: // 'default'
        return (
          <div className={`flex items-center ${sizeStyles.spacing}`}>
            <BuildingOfficeIcon className={`${sizeStyles.icon} text-blue-600`} />
            <div className="flex-1 min-w-0">
              <span className={`${sizeStyles.text} font-medium text-gray-900 truncate block`}>
                {property.name}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                {property.id}
              </span>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
              {showAccessLevel && <AccessLevelIndicator accessLevel={property.accessLevel} size={size} />}
              {showStatus && <StatusIndicator status={property.status} size={size} />}
              {showHealth && <HealthIndicator property={property} size={size} />}
            </div>
          </div>
        );
    }
  };

  const baseClasses = `
    relative inline-flex items-center bg-white border border-gray-200 rounded-lg shadow-sm
    ${sizeStyles.container}
    ${clickable ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : ''}
    ${animated ? 'transition-all duration-200 ease-in-out' : ''}
    ${className}
  `;

  return (
    <div
      ref={badgeRef}
      className={baseClasses}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={!showTooltip ? `${property.name} (${property.id})` : undefined}
    >
      {getVariantContent()}
      
      {/* Tooltip */}
      {showTooltip && (
        <PropertyTooltip
          property={property}
          show={showTooltipState}
          anchorRef={badgeRef}
        />
      )}
    </div>
  );
};

// Property list with badges
export interface PropertyBadgeListProps {
  properties: GA4Property[];
  selectedProperty?: GA4Property | null;
  onPropertySelect?: (property: GA4Property) => void;
  badgeProps?: Partial<PropertyBadgeProps>;
  className?: string;
  maxHeight?: number;
}

export const PropertyBadgeList: React.FC<PropertyBadgeListProps> = ({
  properties,
  selectedProperty,
  onPropertySelect,
  badgeProps = {},
  className = '',
  maxHeight = 400
}) => {
  return (
    <div 
      className={`space-y-2 overflow-auto ${className}`}
      style={{ maxHeight }}
    >
      {properties.map((property) => (
        <PropertyBadge
          key={property.id}
          property={property}
          clickable={!!onPropertySelect}
          onClick={onPropertySelect}
          animated={true}
          className={selectedProperty?.id === property.id ? 'ring-2 ring-blue-500 border-blue-300' : ''}
          {...badgeProps}
        />
      ))}
    </div>
  );
};

export default PropertyBadge;