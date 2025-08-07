/**
 * Offline Dashboard Integration (Phase 3)
 * 
 * This component integrates offline status indicators and notifications 
 * into the main dashboard layout, providing comprehensive offline UX:
 * - Dashboard-wide offline status display
 * - Contextual feature availability indicators
 * - Integration with existing dashboard components
 * - Responsive offline mode experience
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  OfflineStatusIndicator, 
  ConnectionStatusBanner,
  FeatureAvailabilityCard,
  RetryControls,
  type ConnectionStatus,
  type StatusIndicatorVariant,
  type StatusIndicatorPosition
} from './OfflineStatusIndicator';
import { 
  OfflineNotification,
  type NotificationData,
  type NotificationType,
  type NotificationPosition
} from './OfflineNotification';
import { 
  useFallbackManager,
  useDegradationLevel,
  useFeatureAvailability 
} from '../hooks/fallbackHooks';
import { useOfflineDetection } from '../hooks/offlineHooks';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Offline dashboard configuration
 */
export interface OfflineDashboardConfig {
  // Status indicator settings
  showStatusIndicator?: boolean;
  statusVariant?: StatusIndicatorVariant;
  statusPosition?: StatusIndicatorPosition;
  
  // Banner settings
  showBanner?: boolean;
  bannerPersistent?: boolean;
  
  // Notification settings
  showNotifications?: boolean;
  notificationPosition?: NotificationPosition;
  maxNotifications?: number;
  
  // Feature availability
  showFeatureStatus?: boolean;
  featureStatusCollapsible?: boolean;
  
  // Controls
  showRetryControls?: boolean;
  showDetailedStatus?: boolean;
  
  // Behavior
  enableBrowserNotifications?: boolean;
  enableSound?: boolean;
  autoHideWhenOnline?: boolean;
  
  // Styling
  className?: string;
  statusClassName?: string;
  bannerClassName?: string;
  notificationClassName?: string;
}

/**
 * Props for OfflineDashboard component
 */
export interface OfflineDashboardProps extends OfflineDashboardConfig {
  children?: React.ReactNode;
  onStatusChange?: (status: ConnectionStatus) => void;
  onNotificationAction?: (notification: NotificationData) => void;
  onRetry?: () => void;
}

/**
 * Props for OfflineDashboardProvider
 */
export interface OfflineDashboardProviderProps {
  config?: OfflineDashboardConfig;
  children: React.ReactNode;
}

/**
 * Dashboard context type
 */
export interface OfflineDashboardContextType {
  config: OfflineDashboardConfig;
  isOffline: boolean;
  connectionStatus: ConnectionStatus;
  degradationLevel: string;
  availableFeatures: string[];
  disabledFeatures: string[];
  updateConfig: (newConfig: Partial<OfflineDashboardConfig>) => void;
  retry: () => Promise<void>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: OfflineDashboardConfig = {
  showStatusIndicator: true,
  statusVariant: 'badge',
  statusPosition: 'top-right',
  showBanner: true,
  bannerPersistent: false,
  showNotifications: true,
  notificationPosition: 'top-right',
  maxNotifications: 5,
  showFeatureStatus: true,
  featureStatusCollapsible: true,
  showRetryControls: true,
  showDetailedStatus: false,
  enableBrowserNotifications: false,
  enableSound: false,
  autoHideWhenOnline: true
};

// ============================================================================
// CONTEXT
// ============================================================================

const OfflineDashboardContext = React.createContext<OfflineDashboardContextType | null>(null);

/**
 * Hook to use offline dashboard context
 */
const useOfflineDashboard = (): OfflineDashboardContextType => {
  const context = React.useContext(OfflineDashboardContext);
  if (!context) {
    throw new Error('useOfflineDashboard must be used within OfflineDashboardProvider');
  }
  return context;
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

/**
 * Provider component for offline dashboard context
 */
const OfflineDashboardProvider: React.FC<OfflineDashboardProviderProps> = ({
  config: initialConfig = {},
  children
}) => {
  const [config, setConfig] = useState<OfflineDashboardConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });

  // Hooks
  const offlineResult = useOfflineDetection();
  const fallbackManager = useFallbackManager();
  const degradationLevel = useDegradationLevel(fallbackManager.manager);
  const featureAvailability = useFeatureAvailability(fallbackManager.manager);

  // Determine connection status
  const connectionStatus = useMemo((): ConnectionStatus => {
    if (!offlineResult.isOnline) return 'offline';
    if (fallbackManager.error) return 'error';
    if (degradationLevel.currentLevel === 'offline') return 'offline';
    if (degradationLevel.currentLevel === 'limited' || degradationLevel.currentLevel === 'minimal') return 'limited';
    if (degradationLevel.currentLevel === 'read_only') return 'degraded';
    return 'online';
  }, [offlineResult.isOnline, fallbackManager.error, degradationLevel.currentLevel]);

  const updateConfig = useCallback((newConfig: Partial<OfflineDashboardConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const retry = useCallback(async () => {
    try {
      // Trigger offline detection refresh
      offlineResult.refreshStatus?.();
      
      // Clear fallback manager errors
      if (fallbackManager.manager) {
        // Add any retry logic here
      }
    } catch (error) {
      console.error('Dashboard retry failed:', error);
    }
  }, [offlineResult, fallbackManager]);

  const contextValue: OfflineDashboardContextType = {
    config,
    isOffline: !offlineResult.isOnline || degradationLevel.currentLevel === 'offline',
    connectionStatus,
    degradationLevel: degradationLevel.currentLevel,
    availableFeatures: featureAvailability.availableFeatures,
    disabledFeatures: featureAvailability.disabledFeatures,
    updateConfig,
    retry
  };

  return (
    <OfflineDashboardContext.Provider value={contextValue}>
      {children}
    </OfflineDashboardContext.Provider>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Main offline dashboard component
 */
const OfflineDashboard: React.FC<OfflineDashboardProps> = ({
  children,
  onStatusChange,
  onNotificationAction,
  onRetry,
  ...configProps
}) => {
  const dashboardContext = useOfflineDashboard();
  const [showBanner, setShowBanner] = useState(true);

  // Merge props with context config
  const config = useMemo(() => ({
    ...dashboardContext.config,
    ...configProps
  }), [dashboardContext.config, configProps]);

  // Handle status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Handle notification actions
  const handleNotificationAction = useCallback((notification: NotificationData) => {
    onNotificationAction?.(notification);
  }, [onNotificationAction]);

  // Handle retry actions
  const handleRetry = useCallback(async () => {
    try {
      await dashboardContext.retry();
      onRetry?.();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [dashboardContext.retry, onRetry]);

  // Handle banner dismiss
  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false);
  }, []);

  return (
    <div className={`relative ${config.className || ''}`}>
      {/* Connection Status Banner */}
      {config.showBanner && showBanner && (
        <ConnectionStatusBanner
          onDismiss={config.bannerPersistent ? undefined : handleBannerDismiss}
          showActions={config.showRetryControls}
          persistent={config.bannerPersistent}
          className={config.bannerClassName}
        />
      )}

      {/* Main Dashboard Content */}
      <div className="relative">
        {children}
      </div>

      {/* Status Indicator */}
      {config.showStatusIndicator && (
        <OfflineStatusIndicator
          variant={config.statusVariant}
          position={config.statusPosition}
          showRetryButton={config.showRetryControls}
          showDetailedStatus={config.showDetailedStatus}
          autoHide={config.autoHideWhenOnline}
          onRetry={handleRetry}
          onStatusChange={handleStatusChange}
          showFeatureStatus={config.showFeatureStatus}
          className={config.statusClassName}
        />
      )}

      {/* Notifications */}
      {config.showNotifications && (
        <OfflineNotification
          position={config.notificationPosition}
          maxNotifications={config.maxNotifications}
          enableBrowserNotifications={config.enableBrowserNotifications}
          enableSound={config.enableSound}
          onNotificationClick={handleNotificationAction}
          className={config.notificationClassName}
        />
      )}
    </div>
  );
};

// ============================================================================
// WIDGET COMPONENTS
// ============================================================================

/**
 * Offline status widget for embedding in sidebars or headers
 */
export const OfflineStatusWidget: React.FC<{
  variant?: 'compact' | 'detailed' | 'icon-only';
  className?: string;
  onClick?: () => void;
}> = ({
  variant = 'compact',
  className = '',
  onClick
}) => {
  const { isOffline, connectionStatus, degradationLevel } = useOfflineDashboard();

  if (connectionStatus === 'online' && variant !== 'detailed') {
    return null;
  }

  const getStatusDisplay = () => {
    switch (variant) {
      case 'icon-only':
        return (
          <div 
            className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer ${className}`}
            onClick={onClick}
            title={`Status: ${connectionStatus}`}
          >
            {connectionStatus === 'online' ? '🟢' : 
             connectionStatus === 'offline' ? '🔴' : 
             connectionStatus === 'limited' ? '🟡' : '🟠'}
          </div>
        );

      case 'detailed':
        return (
          <div 
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer ${className}`}
            onClick={onClick}
          >
            <span>
              {connectionStatus === 'online' ? '🟢' : 
               connectionStatus === 'offline' ? '🔴' : 
               connectionStatus === 'limited' ? '🟡' : '🟠'}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {connectionStatus === 'online' ? 'Online' : 
                 connectionStatus === 'offline' ? 'Offline' : 
                 connectionStatus === 'limited' ? 'Limited' : 'Degraded'}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {degradationLevel.replace('_', ' ')} mode
              </span>
            </div>
          </div>
        );

      case 'compact':
      default:
        return (
          <div 
            className={`flex items-center space-x-1 px-2 py-1 rounded cursor-pointer ${className}`}
            onClick={onClick}
          >
            <span className="text-sm">
              {connectionStatus === 'online' ? '🟢' : 
               connectionStatus === 'offline' ? '🔴' : 
               connectionStatus === 'limited' ? '🟡' : '🟠'}
            </span>
            <span className="text-sm">
              {connectionStatus === 'online' ? 'Online' : 
               connectionStatus === 'offline' ? 'Offline' : 
               connectionStatus === 'limited' ? 'Limited' : 'Issues'}
            </span>
          </div>
        );
    }
  };

  return getStatusDisplay();
};

/**
 * Feature availability summary widget
 */
export const FeatureStatusWidget: React.FC<{
  className?: string;
  showDetails?: boolean;
}> = ({
  className = '',
  showDetails = false
}) => {
  const { availableFeatures, disabledFeatures } = useOfflineDashboard();

  const totalFeatures = availableFeatures.length + disabledFeatures.length;
  const availabilityPercentage = totalFeatures > 0 ? Math.round((availableFeatures.length / totalFeatures) * 100) : 100;

  if (availabilityPercentage === 100 && !showDetails) {
    return null;
  }

  return (
    <div className={`bg-white border rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Features</span>
        <span className={`text-sm font-medium ${
          availabilityPercentage === 100 ? 'text-green-600' :
          availabilityPercentage >= 75 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {availabilityPercentage}%
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full ${
            availabilityPercentage === 100 ? 'bg-green-500' :
            availabilityPercentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${availabilityPercentage}%` }}
        />
      </div>

      {showDetails && disabledFeatures.length > 0 && (
        <div className="text-xs text-gray-600">
          <div className="font-medium mb-1">Unavailable:</div>
          <div>
            {disabledFeatures.map(feature => feature.replace(/_/g, ' ')).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Quick retry controls widget
 */
export const QuickRetryWidget: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({
  className = '',
  size = 'md'
}) => {
  const { connectionStatus, retry } = useOfflineDashboard();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retry();
    } finally {
      setIsRetrying(false);
    }
  }, [retry]);

  if (connectionStatus === 'online') {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  return (
    <button
      onClick={handleRetry}
      disabled={isRetrying}
      className={`
        bg-blue-600 text-white rounded hover:bg-blue-700 
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        ${sizeClasses[size]} ${className}
      `}
    >
      {isRetrying ? 'Retrying...' : 'Retry Connection'}
    </button>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default OfflineDashboard;
export { OfflineDashboardProvider, useOfflineDashboard };