/**
 * Offline Notification System (Phase 3)
 * 
 * This component provides toast-style notifications for offline mode events:
 * - Connection loss notifications
 * - Reconnection success notifications
 * - Feature availability changes
 * - Fallback activation alerts
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
 * Notification types
 */
export type NotificationType = 
  | 'connection_lost'     // Internet/network connection lost
  | 'connection_restored' // Internet/network connection restored
  | 'mcp_disconnected'    // MCP server disconnected
  | 'mcp_connected'       // MCP server connected
  | 'feature_disabled'    // Feature became unavailable
  | 'feature_enabled'     // Feature became available
  | 'fallback_activated'  // Fallback mechanism activated
  | 'degradation_changed' // Degradation level changed
  | 'cache_serving'       // Serving cached/mock data
  | 'operation_queued'    // Operation queued for later
  | 'error_occurred'      // Error in offline handling
  | 'info';               // General information

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Notification position
 */
export type NotificationPosition = 
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center';

/**
 * Individual notification data
 */
export interface NotificationData {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  data?: any;
}

/**
 * Props for OfflineNotification component
 */
export interface OfflineNotificationProps {
  position?: NotificationPosition;
  maxNotifications?: number;
  defaultDuration?: number;
  enableSound?: boolean;
  enableVibration?: boolean;
  enableBrowserNotifications?: boolean;
  className?: string;
  onNotificationClick?: (notification: NotificationData) => void;
  onNotificationDismiss?: (notification: NotificationData) => void;
  filterTypes?: NotificationType[];
  minPriority?: NotificationPriority;
}

/**
 * Props for individual notification item
 */
export interface NotificationItemProps {
  notification: NotificationData;
  onDismiss: (id: string) => void;
  onClick?: (notification: NotificationData) => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique notification ID
 */
export const generateNotificationId = (): string => {
  return `offline_notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get notification color based on type and priority
 */
export const getNotificationColor = (type: NotificationType, priority: NotificationPriority): string => {
  if (priority === 'critical') {
    return 'bg-red-600 border-red-700 text-white';
  }
  
  switch (type) {
    case 'connection_lost':
    case 'mcp_disconnected':
    case 'feature_disabled':
    case 'error_occurred':
      return 'bg-red-50 border-red-200 text-red-800';
    
    case 'connection_restored':
    case 'mcp_connected':
    case 'feature_enabled':
      return 'bg-green-50 border-green-200 text-green-800';
    
    case 'fallback_activated':
    case 'degradation_changed':
    case 'cache_serving':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    
    case 'operation_queued':
    case 'info':
    default:
      return 'bg-blue-50 border-blue-200 text-blue-800';
  }
};

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'connection_lost':
      return '📡❌';
    case 'connection_restored':
      return '📡✅';
    case 'mcp_disconnected':
      return '🔌❌';
    case 'mcp_connected':
      return '🔌✅';
    case 'feature_disabled':
      return '🚫';
    case 'feature_enabled':
      return '✅';
    case 'fallback_activated':
      return '🔄';
    case 'degradation_changed':
      return '⚠️';
    case 'cache_serving':
      return '💾';
    case 'operation_queued':
      return '📝';
    case 'error_occurred':
      return '❌';
    case 'info':
    default:
      return 'ℹ️';
  }
};

/**
 * Get default duration based on priority
 */
export const getDefaultDuration = (priority: NotificationPriority): number => {
  switch (priority) {
    case 'critical':
      return 0; // Persistent
    case 'high':
      return 10000; // 10 seconds
    case 'medium':
      return 6000;  // 6 seconds
    case 'low':
    default:
      return 4000;  // 4 seconds
  }
};

/**
 * Priority level to numeric value for comparison
 */
export const priorityToNumber = (priority: NotificationPriority): number => {
  switch (priority) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 1;
  }
};

// ============================================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================================

/**
 * Individual notification item
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onClick
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleDismiss = useCallback(() => {
    if (notification.dismissible !== false) {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss(notification.id);
      }, 300); // Animation duration
    }
  }, [notification.id, notification.dismissible, onDismiss]);

  const handleClick = useCallback(() => {
    onClick?.(notification);
  }, [notification, onClick]);

  const colorClasses = getNotificationColor(notification.type, notification.priority);
  const icon = getNotificationIcon(notification.type);

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isExiting ? 'scale-95' : 'scale-100'}
        max-w-sm w-full shadow-lg rounded-lg pointer-events-auto border-l-4 ${colorClasses}
        ${onClick ? 'cursor-pointer hover:shadow-xl' : ''}
      `}
      onClick={onClick ? handleClick : undefined}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-lg">{icon}</span>
          </div>
          
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium">
              {notification.title}
            </p>
            <p className="mt-1 text-sm opacity-90">
              {notification.message}
            </p>
            
            {notification.action && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.action?.onClick();
                  }}
                  className="text-sm font-medium underline hover:no-underline focus:outline-none"
                >
                  {notification.action.label}
                </button>
              </div>
            )}
            
            <div className="mt-2 text-xs opacity-75">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </div>
          </div>
          
          {notification.dismissible !== false && (
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN NOTIFICATION SYSTEM
// ============================================================================

/**
 * Main offline notification system
 */
export const OfflineNotification: React.FC<OfflineNotificationProps> = ({
  position = 'top-right',
  maxNotifications = 5,
  defaultDuration = 5000,
  enableSound = false,
  enableVibration = false,
  enableBrowserNotifications = false,
  className = '',
  onNotificationClick,
  onNotificationDismiss,
  filterTypes,
  minPriority = 'low'
}) => {
  // Hooks
  const offlineResult = useOfflineDetection();
  const mcpClient = useMCPClient();
  const fallbackManager = useFallbackManager();
  const degradationLevel = useDegradationLevel(fallbackManager.manager);
  const featureAvailability = useFeatureAvailability(fallbackManager.manager);

  // State
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [lastStates, setLastStates] = useState({
    isOnline: true,
    mcpConnected: false,
    degradationLevel: 'full',
    disabledFeatures: new Set<string>()
  });

  // Add notification function
  const addNotification = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    options: Partial<NotificationData> = {}
  ) => {
    // Filter by type if specified
    if (filterTypes && !filterTypes.includes(type)) {
      return;
    }

    // Filter by priority
    if (priorityToNumber(priority) < priorityToNumber(minPriority)) {
      return;
    }

    const notification: NotificationData = {
      id: generateNotificationId(),
      type,
      priority,
      title,
      message,
      timestamp: Date.now(),
      duration: options.duration ?? (options.persistent ? 0 : getDefaultDuration(priority)),
      dismissible: options.dismissible ?? true,
      ...options
    };

    setNotifications(prev => {
      const updated = [notification, ...prev];
      
      // Limit number of notifications
      if (updated.length > maxNotifications) {
        return updated.slice(0, maxNotifications);
      }
      
      return updated;
    });

    // Browser notification
    if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }

    // Sound notification
    if (enableSound && priority !== 'low') {
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {
          // Fallback: use system beep
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('');
            speechSynthesis.speak(utterance);
          }
        });
      } catch (error) {
        // Ignore audio errors
      }
    }

    // Vibration
    if (enableVibration && 'vibrate' in navigator && priority === 'critical') {
      navigator.vibrate([200, 100, 200]);
    }
  }, [filterTypes, minPriority, maxNotifications, enableBrowserNotifications, enableSound, enableVibration]);

  // Monitor offline status changes
  useEffect(() => {
    const currentStates = {
      isOnline: offlineResult.isOnline,
      mcpConnected: mcpClient.isConnected,
      degradationLevel: degradationLevel.currentLevel,
      disabledFeatures: new Set(featureAvailability.disabledFeatures)
    };

    // Check for network connection changes
    if (lastStates.isOnline !== currentStates.isOnline) {
      if (currentStates.isOnline) {
        addNotification(
          'connection_restored',
          'Connection Restored',
          'Internet connection is back online. All features are being restored.',
          'medium'
        );
      } else {
        addNotification(
          'connection_lost',
          'Connection Lost',
          'Internet connection lost. Working in offline mode with cached data.',
          'high'
        );
      }
    }

    // Check for MCP connection changes
    if (lastStates.mcpConnected !== currentStates.mcpConnected) {
      if (currentStates.mcpConnected) {
        addNotification(
          'mcp_connected',
          'Service Connected',
          'Analytics service connection restored. All features are now available.',
          'medium'
        );
      } else {
        addNotification(
          'mcp_disconnected',
          'Service Disconnected',
          'Analytics service is unavailable. Using cached data and limited functionality.',
          'high'
        );
      }
    }

    // Check for degradation level changes
    if (lastStates.degradationLevel !== currentStates.degradationLevel) {
      const levelDescriptions = {
        full: 'All features are available',
        limited: 'Some features are temporarily disabled',
        minimal: 'Only basic features are available',
        read_only: 'Read-only mode - no data modifications allowed',
        offline: 'Offline mode - working with cached data only'
      };

      addNotification(
        'degradation_changed',
        'Service Level Changed',
        levelDescriptions[currentStates.degradationLevel as keyof typeof levelDescriptions] || 'Service level has changed',
        currentStates.degradationLevel === 'offline' ? 'high' : 'medium'
      );
    }

    // Check for feature availability changes
    const previousDisabled = lastStates.disabledFeatures;
    const currentDisabled = currentStates.disabledFeatures;

    // Features that became disabled
    for (const feature of currentDisabled) {
      if (!previousDisabled.has(feature)) {
        addNotification(
          'feature_disabled',
          'Feature Unavailable',
          `${feature.replace(/_/g, ' ')} is temporarily unavailable.`,
          'low'
        );
      }
    }

    // Features that became enabled
    for (const feature of previousDisabled) {
      if (!currentDisabled.has(feature)) {
        addNotification(
          'feature_enabled',
          'Feature Restored',
          `${feature.replace(/_/g, ' ')} is now available.`,
          'low'
        );
      }
    }

    setLastStates(currentStates);
  }, [
    offlineResult.isOnline,
    mcpClient.isConnected,
    degradationLevel.currentLevel,
    featureAvailability.disabledFeatures,
    lastStates,
    addNotification
  ]);

  // Monitor fallback activations
  useEffect(() => {
    if (fallbackManager.stats.totalFallbackActivations > 0) {
      const timeSinceLastActivation = Date.now() - fallbackManager.stats.lastFallbackActivation;
      
      // Only notify for recent activations (within last 5 seconds)
      if (timeSinceLastActivation < 5000) {
        addNotification(
          'fallback_activated',
          'Fallback Mode Active',
          'Using backup data source due to service unavailability.',
          'low'
        );
      }
    }
  }, [fallbackManager.stats.totalFallbackActivations, fallbackManager.stats.lastFallbackActivation, addNotification]);

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification) {
        onNotificationDismiss?.(notification);
      }
      return prev.filter(n => n.id !== id);
    });
  }, [onNotificationDismiss]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: NotificationData) => {
    onNotificationClick?.(notification);
  }, [onNotificationClick]);

  // Position classes
  const positionClasses = {
    'top-left': 'fixed top-0 left-0 z-50 flex flex-col space-y-4 p-6',
    'top-right': 'fixed top-0 right-0 z-50 flex flex-col space-y-4 p-6',
    'bottom-left': 'fixed bottom-0 left-0 z-50 flex flex-col-reverse space-y-reverse space-y-4 p-6',
    'bottom-right': 'fixed bottom-0 right-0 z-50 flex flex-col-reverse space-y-reverse space-y-4 p-6',
    'top-center': 'fixed top-0 left-1/2 transform -translate-x-1/2 z-50 flex flex-col space-y-4 p-6',
    'bottom-center': 'fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50 flex flex-col-reverse space-y-reverse space-y-4 p-6'
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`${positionClasses[position]} ${className}`} aria-live="polite">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
          onClick={onNotificationClick ? handleNotificationClick : undefined}
        />
      ))}
    </div>
  );
};

// ============================================================================
// NOTIFICATION HOOK
// ============================================================================

/**
 * Hook for programmatically creating notifications
 */
export const useOfflineNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const addNotification = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    options: Partial<NotificationData> = {}
  ) => {
    const notification: NotificationData = {
      id: generateNotificationId(),
      type,
      priority,
      title,
      message,
      timestamp: Date.now(),
      duration: options.duration ?? getDefaultDuration(priority),
      dismissible: options.dismissible ?? true,
      ...options
    };

    setNotifications(prev => [notification, ...prev]);

    return notification.id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAllNotifications
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default OfflineNotification;