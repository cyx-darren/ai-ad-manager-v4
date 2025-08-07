'use client'

import React from 'react'
import { MetricCard, MetricCardProps } from './MetricCard'
import { useMetricCardData, MetricCardType } from '@/hooks/useMetricCardData'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface MCPMetricCardProps extends Omit<MetricCardProps, 'value' | 'loading' | 'error'> {
  cardType: MetricCardType;
  fallbackValue: string | number;
  enableMCP?: boolean;
  showSource?: boolean;
}

/**
 * Enhanced MetricCard that fetches data from MCP with feature flag control
 */
export function MCPMetricCard({
  cardType,
  fallbackValue,
  title,
  icon,
  description,
  enableMCP = true,
  showSource = false,
  className = '',
  onClick
}: MCPMetricCardProps) {
  const {
    data,
    isLoading,
    error,
    isFeatureEnabled,
    source,
    lastUpdated,
    refresh
  } = useMetricCardData({
    cardType,
    autoRefresh: false, // Disabled to prevent infinite refresh loops
    refreshInterval: 300000, // 5 minutes
    enableMonitoring: true
  });

  // Determine what value to display
  const displayValue = React.useMemo(() => {
    console.log(`[${cardType}] Display logic - data.value:`, data.value, 'isLoading:', isLoading, 'source:', source, 'type:', typeof data.value);
    
    // If we have actual data (number or non-empty string), use it
    if (data.value !== undefined && data.value !== '' && data.value !== null && data.value !== 0) {
      console.log(`[${cardType}] Using data.value:`, data.value);
      return data.value;
    }
    
    // If we have data that's specifically 0 (valid number), use it
    if (data.value === 0 && !isLoading) {
      console.log(`[${cardType}] Using zero value from data:`, data.value);
      return data.value;
    }
    
    // Otherwise use fallback
    console.log(`[${cardType}] Using fallback:`, fallbackValue);
    return fallbackValue;
  }, [cardType, data.value, isLoading, error, source, fallbackValue]);

  // Enhanced description with source info
  const enhancedDescription = React.useMemo(() => {
    if (!showSource) return description;
    
    let sourceInfo = '';
    if (isFeatureEnabled && source === 'mcp') {
      sourceInfo = ' (Live data)';
    } else if (source === 'cache') {
      sourceInfo = ' (Cached)';
    } else if (source === 'mock') {
      sourceInfo = ' (Mock data)';
    }
    
    return description + sourceInfo;
  }, [description, showSource, isFeatureEnabled, source]);

  // Enhanced error message
  const displayError = React.useMemo(() => {
    if (!error) return undefined;
    
    if (source === 'mock') {
      return `MCP unavailable: ${error}. Showing fallback data.`;
    }
    
    return error;
  }, [error, source]);

  // Add refresh capability on click if MCP is enabled
  const handleClick = React.useCallback(() => {
    if (enableMCP && isFeatureEnabled) {
      refresh();
    }
    if (onClick) {
      onClick();
    }
  }, [enableMCP, isFeatureEnabled, refresh, onClick]);

  return (
    <div className="relative">
      <MetricCard
        title={title}
        value={displayValue}
        change={data.change}
        icon={icon}
        description={enhancedDescription}
        loading={isLoading}
        error={displayError}
        className={className}
        onClick={enableMCP ? handleClick : onClick}
      />
      
      {/* Status indicator */}
      {enableMCP && (
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          {/* Feature flag status */}
          <div 
            className={`w-2 h-2 rounded-full ${
              isFeatureEnabled ? 'bg-green-400' : 'bg-gray-300'
            }`}
            title={isFeatureEnabled ? 'MCP enabled' : 'Feature disabled'}
          />
          
          {/* Data source indicator */}
          {source === 'mcp' && (
            <div 
              className="w-2 h-2 rounded-full bg-blue-400" 
              title="Live MCP data"
            />
          )}
          {source === 'cache' && (
            <div 
              className="w-2 h-2 rounded-full bg-yellow-400" 
              title="Cached data"
            />
          )}
          {source === 'mock' && (
            <div 
              className="w-2 h-2 rounded-full bg-red-300" 
              title="Mock data (fallback)"
            />
          )}
          
          {/* Error indicator */}
          {error && source !== 'mock' && (
            <InformationCircleIcon 
              className="w-3 h-3 text-red-500" 
              title={error}
            />
          )}
        </div>
      )}
      
      {/* Last updated timestamp for MCP data */}
      {enableMCP && lastUpdated && source !== 'mock' && (
        <div className="absolute bottom-1 right-1 text-xs text-gray-400">
          {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Backward-compatible wrapper for existing MetricCard usage
 */
export function TotalCampaignsCard({
  className = '',
  showSource = false
}: {
  className?: string;
  showSource?: boolean;
}) {
  return (
    <MCPMetricCard
      cardType="total-campaigns"
      title="Total Campaigns"
      fallbackValue="12"
      icon={undefined} // Will be set in dashboard
      description="Active ad campaigns"
      enableMCP={true}
      showSource={showSource}
      className={className}
    />
  );
}

export default MCPMetricCard;