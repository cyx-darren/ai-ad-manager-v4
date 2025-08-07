/**
 * Real-time Status Indicator Component
 * 
 * Provides visual status indicators for connection and server health monitoring.
 * Integrates with Phase 1 (Connection) and Phase 2 (Server Health) monitoring.
 */

'use client';

import React from 'react';
import { 
  ConnectionState, 
  NetworkQuality, 
  ServerHealthState,
  ServiceStatus 
} from '../types/connection';

/**
 * Status indicator props
 */
export interface StatusIndicatorProps {
  /** Connection state from Phase 1 monitoring */
  connectionState?: ConnectionState;
  /** Network quality from Phase 1 monitoring */
  networkQuality?: NetworkQuality;
  /** Server health state from Phase 2 monitoring */
  serverHealth?: ServerHealthState;
  /** Service status from Phase 2 monitoring */
  serviceStatus?: ServiceStatus;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show labels */
  showLabel?: boolean;
  /** Custom className */
  className?: string;
  /** Show detailed tooltip */
  showTooltip?: boolean;
}

/**
 * Get status color based on states
 */
const getStatusColor = (
  connectionState?: ConnectionState,
  networkQuality?: NetworkQuality,
  serverHealth?: ServerHealthState,
  serviceStatus?: ServiceStatus
): string => {
  // Critical states (red)
  if (connectionState === 'error' || 
      serverHealth === 'unhealthy' || 
      serviceStatus === 'outage') {
    return 'bg-red-500';
  }
  
  // Warning states (yellow/orange)
  if (connectionState === 'disconnected' || 
      connectionState === 'reconnecting' ||
      networkQuality === 'poor' || 
      networkQuality === 'critical' ||
      serverHealth === 'degraded' ||
      serviceStatus === 'degraded') {
    return 'bg-yellow-500';
  }
  
  // Connecting states (blue)
  if (connectionState === 'connecting' || 
      serverHealth === 'maintenance') {
    return 'bg-blue-500';
  }
  
  // Good states (green)
  if (connectionState === 'connected' && 
      (networkQuality === 'excellent' || networkQuality === 'good') &&
      serverHealth === 'healthy' &&
      serviceStatus === 'operational') {
    return 'bg-green-500';
  }
  
  // Default/unknown (gray)
  return 'bg-gray-400';
};

/**
 * Get status label
 */
const getStatusLabel = (
  connectionState?: ConnectionState,
  networkQuality?: NetworkQuality,
  serverHealth?: ServerHealthState,
  serviceStatus?: ServiceStatus
): string => {
  if (connectionState === 'error' || serverHealth === 'unhealthy' || serviceStatus === 'outage') {
    return 'Offline';
  }
  
  if (connectionState === 'disconnected' || connectionState === 'reconnecting') {
    return 'Reconnecting';
  }
  
  if (connectionState === 'connecting') {
    return 'Connecting';
  }
  
  if (serverHealth === 'maintenance') {
    return 'Maintenance';
  }
  
  if (networkQuality === 'poor' || networkQuality === 'critical' || 
      serverHealth === 'degraded' || serviceStatus === 'degraded') {
    return 'Degraded';
  }
  
  if (connectionState === 'connected' && serverHealth === 'healthy') {
    return 'Online';
  }
  
  return 'Unknown';
};

/**
 * Get detailed status info for tooltip
 */
const getDetailedStatus = (
  connectionState?: ConnectionState,
  networkQuality?: NetworkQuality,
  serverHealth?: ServerHealthState,
  serviceStatus?: ServiceStatus
): string => {
  const details = [];
  
  if (connectionState) {
    details.push(`Connection: ${connectionState}`);
  }
  
  if (networkQuality) {
    details.push(`Network: ${networkQuality}`);
  }
  
  if (serverHealth) {
    details.push(`Server: ${serverHealth}`);
  }
  
  if (serviceStatus) {
    details.push(`Service: ${serviceStatus}`);
  }
  
  return details.join('\n');
};

/**
 * Status Indicator Component
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  connectionState,
  networkQuality,
  serverHealth,
  serviceStatus,
  size = 'md',
  showLabel = false,
  className = '',
  showTooltip = false
}) => {
  const statusColor = getStatusColor(connectionState, networkQuality, serverHealth, serviceStatus);
  const statusLabel = getStatusLabel(connectionState, networkQuality, serverHealth, serviceStatus);
  const detailedStatus = getDetailedStatus(connectionState, networkQuality, serverHealth, serviceStatus);
  
  // Size classes
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  const [isHovered, setIsHovered] = React.useState(false);
  const [isClicked, setIsClicked] = React.useState(false);
  
  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200);
  };

  const indicatorElement = (
    <div 
      className={`flex items-center space-x-2 cursor-pointer transition-all duration-200 ${className} ${
        isHovered ? 'transform scale-105' : ''
      } ${isClicked ? 'transform scale-95' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`${sizeClasses[size]} ${statusColor} rounded-full transition-all duration-300 ${
          connectionState === 'connected' || serverHealth === 'healthy' ? 'animate-pulse' : ''
        }`}
        style={{
          boxShadow: `0 0 ${size === 'lg' ? '8px' : size === 'md' ? '6px' : '4px'} rgba(var(--${statusColor.split('-')[1]}-500), ${isHovered ? '0.6' : '0.4'})`
        }}
      />
      {showLabel && (
        <span className={`${textSizeClasses[size]} font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200 ${
          isHovered ? 'text-gray-900 dark:text-gray-100' : ''
        }`}>
          {statusLabel}
        </span>
      )}
      {isHovered && (
        <div className="text-xs text-gray-500 opacity-75">
          Click for details
        </div>
      )}
    </div>
  );
  
  if (showTooltip) {
    return (
      <div title={detailedStatus} className="cursor-help">
        {indicatorElement}
      </div>
    );
  }
  
  return indicatorElement;
};

/**
 * Connection Status Indicator (Phase 1 focused)
 */
export interface ConnectionStatusIndicatorProps {
  connectionState: ConnectionState;
  networkQuality: NetworkQuality;
  latency?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  connectionState,
  networkQuality,
  latency,
  size = 'md',
  showDetails = false
}) => {
  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected':
        switch (networkQuality) {
          case 'excellent': return 'text-green-500 bg-green-100';
          case 'good': return 'text-green-400 bg-green-50';
          case 'fair': return 'text-yellow-500 bg-yellow-100';
          case 'poor': return 'text-orange-500 bg-orange-100';
          case 'critical': return 'text-red-500 bg-red-100';
          default: return 'text-gray-500 bg-gray-100';
        }
      case 'connecting':
      case 'reconnecting':
        return 'text-blue-500 bg-blue-100';
      case 'disconnected':
      case 'error':
        return 'text-red-500 bg-red-100';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };
  
  const colorClasses = getConnectionColor();
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  return (
    <div className={`inline-flex items-center space-x-2 rounded-full ${colorClasses} ${sizeClasses[size]}`}>
      <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-current animate-pulse' : 'bg-current'}`} />
      <span className="font-medium capitalize">
        {connectionState === 'connected' ? networkQuality : connectionState}
      </span>
      {showDetails && latency && (
        <span className="text-xs opacity-75">
          {latency}ms
        </span>
      )}
    </div>
  );
};

/**
 * Server Health Status Indicator (Phase 2 focused)
 */
export interface ServerHealthStatusIndicatorProps {
  serverHealth: ServerHealthState;
  healthScore?: number;
  uptime?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const ServerHealthStatusIndicator: React.FC<ServerHealthStatusIndicatorProps> = ({
  serverHealth,
  healthScore,
  uptime,
  size = 'md',
  showDetails = false
}) => {
  const getHealthColor = () => {
    switch (serverHealth) {
      case 'healthy': return 'text-green-500 bg-green-100';
      case 'degraded': return 'text-yellow-500 bg-yellow-100';
      case 'unhealthy': return 'text-red-500 bg-red-100';
      case 'maintenance': return 'text-blue-500 bg-blue-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };
  
  const colorClasses = getHealthColor();
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  return (
    <div className={`inline-flex items-center space-x-2 rounded-full ${colorClasses} ${sizeClasses[size]}`}>
      <div className={`w-2 h-2 rounded-full bg-current ${serverHealth === 'healthy' ? 'animate-pulse' : ''}`} />
      <span className="font-medium capitalize">{serverHealth}</span>
      {showDetails && (
        <div className="flex items-center space-x-1 text-xs opacity-75">
          {healthScore && (
            <span>{healthScore}%</span>
          )}
          {uptime && (
            <span>{uptime.toFixed(1)}% uptime</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Interactive Status Button Component
 */
export interface StatusButtonProps extends StatusIndicatorProps {
  /** Button click handler */
  onClick?: () => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

export const StatusButton: React.FC<StatusButtonProps> = ({
  connectionState,
  networkQuality,
  serverHealth,
  serviceStatus,
  size = 'md',
  showLabel = true,
  variant = 'default',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) => {
  const statusColor = getStatusColor(connectionState, networkQuality, serverHealth, serviceStatus);
  const statusLabel = getStatusLabel(connectionState, networkQuality, serverHealth, serviceStatus);
  
  const baseClasses = 'inline-flex items-center space-x-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const variantClasses = {
    default: `${statusColor} text-white hover:opacity-90 focus:ring-opacity-50`,
    outline: `border-2 border-current text-current hover:bg-current hover:text-white focus:ring-current`,
    ghost: `text-current hover:bg-current hover:bg-opacity-10 focus:ring-current`
  };
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <div className={`w-2 h-2 rounded-full ${statusColor.replace('bg-', 'bg-current')}`} />
      )}
      {showLabel && <span>{statusLabel}</span>}
    </button>
  );
};

/**
 * Animated Status Pulse Component
 */
export interface StatusPulseProps {
  active: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  speed?: 'slow' | 'normal' | 'fast';
}

export const StatusPulse: React.FC<StatusPulseProps> = ({
  active,
  color = 'bg-blue-500',
  size = 'md',
  speed = 'normal'
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };
  
  const speedClasses = {
    slow: 'animate-pulse [animation-duration:2s]',
    normal: 'animate-pulse',
    fast: 'animate-pulse [animation-duration:0.5s]'
  };
  
  if (!active) return null;
  
  return (
    <div className="relative">
      <div className={`${sizeClasses[size]} ${color} rounded-full ${speedClasses[speed]}`} />
      <div className={`absolute inset-0 ${sizeClasses[size]} ${color} rounded-full ${speedClasses[speed]} opacity-50 animate-ping`} />
    </div>
  );
};

/**
 * Status Badge Component with Click Interaction
 */
export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  count?: number;
  interactive?: boolean;
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  count,
  interactive = false,
  onClick
}) => {
  const [isPressed, setIsPressed] = React.useState(false);
  
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online', textColor: 'text-green-800' },
    offline: { color: 'bg-red-500', label: 'Offline', textColor: 'text-red-800' },
    degraded: { color: 'bg-yellow-500', label: 'Degraded', textColor: 'text-yellow-800' },
    maintenance: { color: 'bg-blue-500', label: 'Maintenance', textColor: 'text-blue-800' }
  };
  
  const config = statusConfig[status];
  
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);
  
  return (
    <div
      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
        interactive ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${config.color} ${config.textColor} ${isPressed ? 'transform scale-95' : ''}`}
      onClick={interactive ? onClick : undefined}
      onMouseDown={interactive ? handleMouseDown : undefined}
      onMouseUp={interactive ? handleMouseUp : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      <StatusPulse active={status === 'online'} color="bg-current" size="sm" />
      <span>{config.label}</span>
      {count !== undefined && (
        <span className="bg-white bg-opacity-30 px-1 rounded">
          {count}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;