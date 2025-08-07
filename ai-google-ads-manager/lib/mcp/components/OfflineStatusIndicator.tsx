/**
 * Offline Status Indicator Component (Phase 3)
 * 
 * This component provides visual feedback for offline mode and connection status:
 * - Connection status indicators
 * - Offline mode banners
 * - User-friendly offline messages
 * - Retry and reconnection controls
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  useFallbackManager, 
  useDegradationLevel,
  useFeatureAvailability 
} from '../hooks/fallbackHooks';
import { useOfflineDetection } from '../hooks/offlineHooks';
import { useMCPClient } from '../context';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Connection status types
 */
export type ConnectionStatus = 
  | 'online'          // Fully connected
  | 'limited'         // Limited connectivity
  | 'offline'         // No connectivity
  | 'reconnecting'    // Attempting to reconnect
  | 'degraded'        // Degraded service
  | 'error';          // Connection error

/**
 * Status indicator variant types
 */
export type StatusIndicatorVariant = 
  | 'dot'             // Small dot indicator
  | 'badge'           // Badge with text
  | 'banner'          // Full-width banner
  | 'card'            // Card-style indicator
  | 'toast'           // Toast notification
  | 'minimal';        // Minimal text-only

/**
 * Status indicator position
 */
export type StatusIndicatorPosition = 
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center'
  | 'inline';

/**
 * Props for OfflineStatusIndicator component
 */
export interface OfflineStatusIndicatorProps {
  variant?: StatusIndicatorVariant;
  position?: StatusIndicatorPosition;
  showRetryButton?: boolean;
  showDetailedStatus?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  className?: string;
  onRetry?: () => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  showFeatureStatus?: boolean;
  enableNotifications?: boolean;
}

/**
 * Props for ConnectionStatusBanner component
 */
export interface ConnectionStatusBannerProps {
  onDismiss?: () => void;
  showActions?: boolean;
  persistent?: boolean;
  className?: string;
}

/**
 * Props for FeatureAvailabilityCard component
 */
export interface FeatureAvailabilityCardProps {
  className?: string;
  showAlternatives?: boolean;
  collapsible?: boolean;
}

/**
 * Props for RetryControls component
 */
export interface RetryControlsProps {
  onRetry?: () => void;
  onRefresh?: () => void;
  onReconnect?: () => void;
  isRetrying?: boolean;
  className?: string;
  showAllOptions?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine connection status from various states
 */
export const getConnectionStatus = (
  isOnline: boolean,
  mcpConnected: boolean,
  degradationLevel: string,
  hasError: boolean
): ConnectionStatus => {
  if (hasError) return 'error';
  if (!isOnline) return 'offline';
  if (!mcpConnected && degradationLevel === 'offline') return 'offline';
  if (!mcpConnected) return 'reconnecting';
  if (degradationLevel === 'limited' || degradationLevel === 'minimal') return 'limited';
  if (degradationLevel === 'read_only') return 'degraded';
  return 'online';
};

/**
 * Get status color based on connection status
 */
export const getStatusColor = (status: ConnectionStatus): string => {
  switch (status) {
    case 'online':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'limited':
      return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'offline':
      return 'text-red-600 bg-red-100 border-red-200';
    case 'reconnecting':
      return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'degraded':
      return 'text-orange-600 bg-orange-100 border-orange-200';
    case 'error':
      return 'text-red-700 bg-red-200 border-red-300';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
};

/**
 * Get status icon based on connection status
 */
export const getStatusIcon = (status: ConnectionStatus): string => {
  switch (status) {
    case 'online':
      return '🟢';
    case 'limited':
      return '🟡';
    case 'offline':
      return '🔴';
    case 'reconnecting':
      return '🔄';
    case 'degraded':
      return '🟠';
    case 'error':
      return '❌';
    default:
      return '⚫';
  }
};

/**
 * Get status message based on connection status
 */
export const getStatusMessage = (status: ConnectionStatus): { title: string; description: string } => {
  switch (status) {
    case 'online':
      return {
        title: 'Connected',
        description: 'All services are available'
      };
    case 'limited':
      return {
        title: 'Limited Connectivity',
        description: 'Some features may be unavailable'
      };
    case 'offline':
      return {
        title: 'Offline Mode',
        description: 'Working with cached data only'
      };
    case 'reconnecting':
      return {
        title: 'Reconnecting',
        description: 'Attempting to restore connection'
      };
    case 'degraded':
      return {
        title: 'Degraded Service',
        description: 'Limited functionality available'
      };
    case 'error':
      return {
        title: 'Connection Error',
        description: 'Unable to connect to services'
      };
    default:
      return {
        title: 'Unknown Status',
        description: 'Connection status unclear'
      };
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Main offline status indicator component
 */
export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  variant = 'badge',
  position = 'top-right',
  showRetryButton = true,
  showDetailedStatus = false,
  autoHide = false,
  autoHideDelay = 5000,
  className = '',
  onRetry,
  onStatusChange,
  showFeatureStatus = false,
  enableNotifications = false
}) => {
  // Hooks
  const offlineResult = useOfflineDetection();
  const mcpClient = useMCPClient();
  const fallbackManager = useFallbackManager();
  const degradationLevel = useDegradationLevel(fallbackManager.manager);
  const featureAvailability = useFeatureAvailability(fallbackManager.manager);

  // State
  const [isVisible, setIsVisible] = useState(true);
  const [lastNotification, setLastNotification] = useState<number>(0);

  // Determine current status
  const connectionStatus = useMemo(() => {
    const status = getConnectionStatus(
      offlineResult.isOnline,
      mcpClient.isConnected,
      degradationLevel.currentLevel,
      mcpClient.hasError || fallbackManager.error !== null
    );
    
    // Notify parent component of status changes
    onStatusChange?.(status);
    
    return status;
  }, [
    offlineResult.isOnline,
    mcpClient.isConnected,
    degradationLevel.currentLevel,
    mcpClient.hasError,
    fallbackManager.error,
    onStatusChange
  ]);

  // Auto-hide functionality
  React.useEffect(() => {
    if (autoHide && connectionStatus === 'online') {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [autoHide, autoHideDelay, connectionStatus]);

  // Browser notifications
  React.useEffect(() => {
    if (enableNotifications && 'Notification' in window) {
      const now = Date.now();
      
      // Only show notifications every 30 seconds minimum
      if (now - lastNotification > 30000) {
        if (connectionStatus === 'offline') {
          if (Notification.permission === 'granted') {
            new Notification('Application Offline', {
              body: 'You are now working in offline mode with cached data.',
              icon: '/favicon.ico'
            });
            setLastNotification(now);
          } else if (Notification.permission === 'default') {
            Notification.requestPermission();
          }
        } else if (connectionStatus === 'online' && lastNotification > 0) {
          if (Notification.permission === 'granted') {
            new Notification('Connection Restored', {
              body: 'All services are now available.',
              icon: '/favicon.ico'
            });
            setLastNotification(now);
          }
        }
      }
    }
  }, [connectionStatus, enableNotifications, lastNotification]);

  // Retry functionality
  const handleRetry = useCallback(async () => {
    try {
      // Attempt to reconnect MCP client
      if (!mcpClient.isConnected) {
        await mcpClient.connect?.();
      }
      
      // Trigger offline detection check
      offlineResult.refreshStatus?.();
      
      // Call parent retry handler
      onRetry?.();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [mcpClient, offlineResult, onRetry]);

  // Don't render if auto-hidden
  if (!isVisible) {
    return null;
  }

  // Don't render if online and not showing detailed status
  if (connectionStatus === 'online' && !showDetailedStatus) {
    return null;
  }

  const statusColor = getStatusColor(connectionStatus);
  const statusIcon = getStatusIcon(connectionStatus);
  const statusMessage = getStatusMessage(connectionStatus);

  // Position classes
  const positionClasses = {
    'top-left': 'fixed top-4 left-4 z-50',
    'top-right': 'fixed top-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'top-center': 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
    'inline': 'relative'
  };

  // Render based on variant
  switch (variant) {
    case 'dot':
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <div 
            className={`w-3 h-3 rounded-full ${statusColor.split(' ')[1]} border-2 ${statusColor.split(' ')[2]}`}
            title={`${statusMessage.title}: ${statusMessage.description}`}
          />
        </div>
      );

    case 'badge':
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
            <span className="mr-1">{statusIcon}</span>
            {statusMessage.title}
          </div>
        </div>
      );

    case 'banner':
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <ConnectionStatusBanner />
        </div>
      );

    case 'card':
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <div className={`bg-white rounded-lg shadow-lg border p-4 max-w-sm ${statusColor.split(' ')[2]}`}>
            <div className="flex items-start space-x-3">
              <span className="text-xl">{statusIcon}</span>
              <div className="flex-1">
                <h3 className={`font-medium ${statusColor.split(' ')[0]}`}>
                  {statusMessage.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {statusMessage.description}
                </p>
                {showRetryButton && connectionStatus !== 'online' && (
                  <button
                    onClick={handleRetry}
                    className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Retry Connection
                  </button>
                )}
                {showFeatureStatus && (
                  <div className="mt-2">
                    <FeatureAvailabilityCard />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );

    case 'toast':
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <div className={`bg-white rounded-lg shadow-lg border-l-4 p-4 max-w-sm ${statusColor.replace('border-', 'border-l-')}`}>
            <div className="flex items-center">
              <span className="mr-2">{statusIcon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {statusMessage.title}
                </div>
                <div className="text-sm text-gray-500">
                  {statusMessage.description}
                </div>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      );

    case 'minimal':
    default:
      return (
        <div className={`${positionClasses[position]} ${className}`}>
          <span className={`text-sm ${statusColor.split(' ')[0]}`}>
            {statusIcon} {statusMessage.title}
          </span>
        </div>
      );
  }
};

// ============================================================================
// CONNECTION STATUS BANNER
// ============================================================================

/**
 * Full-width connection status banner
 */
export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({
  onDismiss,
  showActions = true,
  persistent = false,
  className = ''
}) => {
  const offlineResult = useOfflineDetection();
  const mcpClient = useMCPClient();
  const fallbackManager = useFallbackManager();
  const degradationLevel = useDegradationLevel(fallbackManager.manager);

  const [isDismissed, setIsDismissed] = useState(false);

  const connectionStatus = useMemo(() => {
    return getConnectionStatus(
      offlineResult.isOnline,
      mcpClient.isConnected,
      degradationLevel.currentLevel,
      mcpClient.hasError || fallbackManager.error !== null
    );
  }, [
    offlineResult.isOnline,
    mcpClient.isConnected,
    degradationLevel.currentLevel,
    mcpClient.hasError,
    fallbackManager.error
  ]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleRetry = useCallback(async () => {
    try {
      if (!mcpClient.isConnected) {
        await mcpClient.connect?.();
      }
      offlineResult.refreshStatus?.();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [mcpClient, offlineResult]);

  // Don't show if dismissed and not persistent
  if (isDismissed && !persistent) {
    return null;
  }

  // Don't show if online
  if (connectionStatus === 'online') {
    return null;
  }

  const statusColor = getStatusColor(connectionStatus);
  const statusIcon = getStatusIcon(connectionStatus);
  const statusMessage = getStatusMessage(connectionStatus);

  return (
    <div className={`w-full border-l-4 p-4 ${statusColor} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xl">{statusIcon}</span>
          <div>
            <h3 className={`font-medium ${statusColor.split(' ')[0]}`}>
              {statusMessage.title}
            </h3>
            <p className="text-sm text-gray-600">
              {statusMessage.description}
            </p>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2">
            {connectionStatus !== 'online' && (
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            )}
            {!persistent && (
              <button
                onClick={handleDismiss}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// FEATURE AVAILABILITY CARD
// ============================================================================

/**
 * Card showing feature availability status
 */
export const FeatureAvailabilityCard: React.FC<FeatureAvailabilityCardProps> = ({
  className = '',
  showAlternatives = true,
  collapsible = false
}) => {
  const fallbackManager = useFallbackManager();
  const featureAvailability = useFeatureAvailability(fallbackManager.manager);
  
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  if (featureAvailability.availabilityScore === 1) {
    return null; // All features available
  }

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${className}`}>
      {collapsible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
        >
          <span className="font-medium text-gray-900">
            Feature Status ({Math.round(featureAvailability.availabilityScore * 100)}% available)
          </span>
          <svg 
            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      
      {isExpanded && (
        <div className="p-4">
          {featureAvailability.disabledFeatures.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-700 mb-2">Unavailable Features</h4>
              <div className="space-y-2">
                {featureAvailability.disabledFeatures.map(featureId => {
                  const message = featureAvailability.getFeatureMessage(featureId);
                  const alternatives = featureAvailability.getAlternativeFeatures(featureId);
                  
                  return (
                    <div key={featureId} className="text-sm">
                      <div className="text-red-600 font-medium capitalize">
                        {featureId.replace(/_/g, ' ')}
                      </div>
                      {message && (
                        <div className="text-gray-600 text-xs mt-1">{message}</div>
                      )}
                      {showAlternatives && alternatives.length > 0 && (
                        <div className="text-blue-600 text-xs mt-1">
                          Alternatives: {alternatives.map(alt => alt.replace(/_/g, ' ')).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {featureAvailability.degradedFeatures.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-yellow-700 mb-2">Limited Features</h4>
              <div className="space-y-2">
                {featureAvailability.degradedFeatures.map(featureId => (
                  <div key={featureId} className="text-sm">
                    <div className="text-yellow-600 font-medium capitalize">
                      {featureId.replace(/_/g, ' ')}
                    </div>
                    <div className="text-gray-600 text-xs mt-1">
                      Limited functionality available
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RETRY CONTROLS
// ============================================================================

/**
 * Retry and reconnection controls
 */
export const RetryControls: React.FC<RetryControlsProps> = ({
  onRetry,
  onRefresh,
  onReconnect,
  isRetrying = false,
  className = '',
  showAllOptions = true
}) => {
  const mcpClient = useMCPClient();
  const offlineResult = useOfflineDetection();

  const handleRetry = useCallback(async () => {
    try {
      if (!mcpClient.isConnected) {
        await mcpClient.connect?.();
      }
      onRetry?.();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [mcpClient, onRetry]);

  const handleRefresh = useCallback(() => {
    offlineResult.refreshStatus?.();
    onRefresh?.();
  }, [offlineResult, onRefresh]);

  const handleReconnect = useCallback(async () => {
    try {
      await mcpClient.disconnect?.();
      await mcpClient.connect?.();
      onReconnect?.();
    } catch (error) {
      console.error('Reconnect failed:', error);
    }
  }, [mcpClient, onReconnect]);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
      
      {showAllOptions && (
        <>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Refresh Status
          </button>
          
          <button
            onClick={handleReconnect}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Reconnect
          </button>
        </>
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default OfflineStatusIndicator;