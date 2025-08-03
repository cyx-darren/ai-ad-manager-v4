/**
 * MCP Notification & Alert Hooks
 * 
 * This file provides React hooks for managing notifications,
 * alerts, and connection state changes.
 */

'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useMCPStatus } from '../context';
import { useLiveConnectionStatus } from './realtimeHooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Notification configuration
 */
export interface NotificationConfig {
  notifyOnConnect?: boolean;
  notifyOnDisconnect?: boolean;
  notifyOnReconnect?: boolean;
  notifyOnError?: boolean;
  historySize?: number;
  persistNotifications?: boolean;
  onNotification?: (notification: Notification) => void;
}

/**
 * Notification object
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

/**
 * Notification action
 */
export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Alert configuration for data changes
 */
export interface DataChangeAlertConfig {
  metrics: Record<string, MetricThreshold>;
  aggregationWindow?: number;
  notificationHandler?: (alert: DataAlert) => void;
  persistAlerts?: boolean;
  maxAlerts?: number;
}

/**
 * Metric threshold configuration
 */
export interface MetricThreshold {
  threshold: number;
  direction: 'increase' | 'decrease' | 'both';
  comparison: 'absolute' | 'percentage';
  enabled?: boolean;
}

/**
 * Data alert
 */
export interface DataAlert {
  id: string;
  metric: string;
  oldValue: number;
  newValue: number;
  change: number;
  changeType: 'increase' | 'decrease';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged?: boolean;
}

/**
 * Notification state
 */
export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastNotification?: Notification;
}

/**
 * Alert state
 */
export interface AlertState {
  alerts: DataAlert[];
  unacknowledgedCount: number;
  lastAlert?: DataAlert;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique notification ID
 */
const generateNotificationId = (): string => {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique alert ID
 */
const generateAlertId = (): string => {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate alert severity based on change magnitude
 */
const calculateSeverity = (change: number, threshold: number): DataAlert['severity'] => {
  const magnitude = Math.abs(change);
  const ratio = magnitude / threshold;
  
  if (ratio >= 3) return 'critical';
  if (ratio >= 2) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
};

/**
 * Format change message for alerts
 */
const formatChangeMessage = (metric: string, oldValue: number, newValue: number, change: number, comparison: string): string => {
  const direction = change > 0 ? 'increased' : 'decreased';
  const absChange = Math.abs(change);
  
  if (comparison === 'percentage') {
    return `${metric} ${direction} by ${absChange.toFixed(1)}% (from ${oldValue} to ${newValue})`;
  } else {
    return `${metric} ${direction} by ${absChange} (from ${oldValue} to ${newValue})`;
  }
};

// ============================================================================
// NOTIFICATION HOOKS
// ============================================================================

/**
 * Hook for managing connection-related notifications
 * 
 * @example
 * ```tsx
 * function ConnectionNotifications() {
 *   const { 
 *     notifications, 
 *     unreadCount, 
 *     dismiss, 
 *     dismissAll, 
 *     snooze 
 *   } = useConnectionNotifications({
 *     notifyOnReconnect: true,
 *     historySize: 50,
 *     onNotification: (notification) => {
 *       toast.show(notification.message, { type: notification.type });
 *     }
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Unread notifications: {unreadCount}</div>
 *       <button onClick={dismissAll}>Dismiss All</button>
 *       {notifications.slice(0, 5).map(notification => (
 *         <div key={notification.id} className={`notification ${notification.type}`}>
 *           <h4>{notification.title}</h4>
 *           <p>{notification.message}</p>
 *           <button onClick={() => dismiss(notification.id)}>Dismiss</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useConnectionNotifications = (
  config: NotificationConfig = {}
) => {
  const defaultConfig: NotificationConfig = {
    notifyOnConnect: true,
    notifyOnDisconnect: true,
    notifyOnReconnect: true,
    notifyOnError: true,
    historySize: 100,
    persistNotifications: false
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { status } = useMCPStatus();
  const { quality } = useLiveConnectionStatus();
  
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0
  });

  const previousStatusRef = useRef<string>('disconnected');
  const snoozeMapRef = useRef<Map<string, number>>(new Map());

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: generateNotificationId(),
      timestamp: Date.now()
    };

    setState(prev => {
      const notifications = [newNotification, ...prev.notifications];
      
      // Limit history size
      if (notifications.length > finalConfig.historySize!) {
        notifications.splice(finalConfig.historySize!);
      }

      return {
        notifications,
        unreadCount: prev.unreadCount + 1,
        lastNotification: newNotification
      };
    });

    // Trigger callback
    if (finalConfig.onNotification) {
      finalConfig.onNotification(newNotification);
    }

    // Auto-dismiss non-persistent notifications
    if (!notification.persistent && notification.duration) {
      setTimeout(() => {
        dismiss(newNotification.id);
      }, notification.duration);
    }
  }, [finalConfig]);

  const dismiss = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
      unreadCount: Math.max(0, prev.unreadCount - 1)
    }));
  }, []);

  const dismissAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
      unreadCount: 0
    }));
  }, []);

  const snooze = useCallback((notificationId: string, duration: number) => {
    const snoozeUntil = Date.now() + duration;
    snoozeMapRef.current.set(notificationId, snoozeUntil);
    dismiss(notificationId);

    // Re-add after snooze period
    setTimeout(() => {
      snoozeMapRef.current.delete(notificationId);
      // Note: In a real implementation, you'd need to restore the original notification
    }, duration);
  }, [dismiss]);

  const markAsRead = useCallback((notificationId?: string) => {
    setState(prev => ({
      ...prev,
      unreadCount: notificationId ? Math.max(0, prev.unreadCount - 1) : 0
    }));
  }, []);

  // Monitor connection status changes
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = status;

    if (previousStatus !== currentStatus) {
      switch (currentStatus) {
        case 'connected':
          if (finalConfig.notifyOnConnect) {
            if (previousStatus === 'disconnected' || previousStatus === 'error') {
              addNotification({
                type: previousStatus === 'error' ? 'success' : 'info',
                title: 'Connection Established',
                message: 'Successfully connected to MCP server',
                duration: 3000
              });
            } else if (previousStatus === 'connecting' && finalConfig.notifyOnReconnect) {
              addNotification({
                type: 'success',
                title: 'Reconnected',
                message: 'Connection restored successfully',
                duration: 3000
              });
            }
          }
          break;

        case 'disconnected':
          if (finalConfig.notifyOnDisconnect && previousStatus === 'connected') {
            addNotification({
              type: 'warning',
              title: 'Connection Lost',
              message: 'Lost connection to MCP server',
              duration: 5000,
              actions: [
                {
                  label: 'Retry',
                  action: () => {
                    // TODO: Implement reconnection logic
                    console.log('Retrying connection...');
                  },
                  style: 'primary'
                }
              ]
            });
          }
          break;

        case 'error':
          if (finalConfig.notifyOnError) {
            addNotification({
              type: 'error',
              title: 'Connection Error',
              message: 'Failed to connect to MCP server',
              persistent: true,
              actions: [
                {
                  label: 'Retry',
                  action: () => {
                    // TODO: Implement reconnection logic
                    console.log('Retrying connection...');
                  },
                  style: 'primary'
                },
                {
                  label: 'Dismiss',
                  action: () => {},
                  style: 'secondary'
                }
              ]
            });
          }
          break;
      }

      previousStatusRef.current = currentStatus;
    }
  }, [status, finalConfig, addNotification]);

  // Monitor connection quality changes
  useEffect(() => {
    if (quality.quality === 'poor' && finalConfig.notifyOnError) {
      addNotification({
        type: 'warning',
        title: 'Poor Connection Quality',
        message: `High latency detected (${quality.latency}ms). Some features may be slow.`,
        duration: 8000
      });
    }
  }, [quality.quality, quality.latency, finalConfig, addNotification]);

  return {
    ...state,
    dismiss,
    dismissAll,
    snooze,
    markAsRead,
    addNotification
  };
};

/**
 * Hook for data change alerts and monitoring
 * 
 * @example
 * ```tsx
 * function DataChangeMonitor() {
 *   const { 
 *     alerts, 
 *     unacknowledgedCount, 
 *     acknowledge, 
 *     configure, 
 *     dismissAll 
 *   } = useDataChangeAlerts({
 *     metrics: {
 *       'conversions': { 
 *         threshold: 20, 
 *         direction: 'decrease', 
 *         comparison: 'percentage' 
 *       },
 *       'bounceRate': { 
 *         threshold: 10, 
 *         direction: 'increase', 
 *         comparison: 'percentage' 
 *       }
 *     },
 *     notificationHandler: (alert) => {
 *       if (alert.severity === 'critical') {
 *         sendEmailAlert(alert);
 *       }
 *       showToast(alert.message, { type: 'warning' });
 *     }
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Active alerts: {unacknowledgedCount}</div>
 *       <button onClick={dismissAll}>Dismiss All</button>
 *       {alerts.slice(0, 10).map(alert => (
 *         <div key={alert.id} className={`alert severity-${alert.severity}`}>
 *           <h4>Alert: {alert.metric}</h4>
 *           <p>{alert.message}</p>
 *           <div>Severity: {alert.severity}</div>
 *           <button onClick={() => acknowledge(alert.id)}>
 *             Acknowledge
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useDataChangeAlerts = (
  config: DataChangeAlertConfig
) => {
  const defaultConfig = {
    aggregationWindow: 5000,
    persistAlerts: true,
    maxAlerts: 1000
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<AlertState>({
    alerts: [],
    unacknowledgedCount: 0
  });

  const metricHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastValuesRef = useRef<Map<string, number>>(new Map());

  const checkMetricThreshold = useCallback((metric: string, newValue: number) => {
    const threshold = finalConfig.metrics[metric];
    if (!threshold || !threshold.enabled) return;

    const lastValue = lastValuesRef.current.get(metric);
    if (lastValue === undefined) {
      lastValuesRef.current.set(metric, newValue);
      return;
    }

    let change: number;
    let changeType: 'increase' | 'decrease';

    if (threshold.comparison === 'percentage') {
      change = ((newValue - lastValue) / lastValue) * 100;
    } else {
      change = newValue - lastValue;
    }

    changeType = change > 0 ? 'increase' : 'decrease';
    const absChange = Math.abs(change);

    // Check if change exceeds threshold and matches direction
    const exceedsThreshold = absChange >= threshold.threshold;
    const matchesDirection = threshold.direction === 'both' || 
                            threshold.direction === changeType;

    if (exceedsThreshold && matchesDirection) {
      const alert: DataAlert = {
        id: generateAlertId(),
        metric,
        oldValue: lastValue,
        newValue,
        change,
        changeType,
        severity: calculateSeverity(absChange, threshold.threshold),
        message: formatChangeMessage(metric, lastValue, newValue, change, threshold.comparison!),
        timestamp: Date.now(),
        acknowledged: false
      };

      setState(prev => {
        const alerts = [alert, ...prev.alerts];
        
        // Limit alerts
        if (alerts.length > finalConfig.maxAlerts!) {
          alerts.splice(finalConfig.maxAlerts!);
        }

        return {
          alerts,
          unacknowledgedCount: prev.unacknowledgedCount + 1,
          lastAlert: alert
        };
      });

      // Trigger notification handler
      if (finalConfig.notificationHandler) {
        finalConfig.notificationHandler(alert);
      }
    }

    lastValuesRef.current.set(metric, newValue);
  }, [finalConfig]);

  const acknowledge = useCallback((alertId: string) => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      ),
      unacknowledgedCount: Math.max(0, prev.unacknowledgedCount - 1)
    }));
  }, []);

  const acknowledgeAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(alert => ({ ...alert, acknowledged: true })),
      unacknowledgedCount: 0
    }));
  }, []);

  const dismissAll = useCallback(() => {
    setState({
      alerts: [],
      unacknowledgedCount: 0
    });
  }, []);

  const removeAlert = useCallback((alertId: string) => {
    setState(prev => {
      const alertToRemove = prev.alerts.find(alert => alert.id === alertId);
      const wasUnacknowledged = alertToRemove && !alertToRemove.acknowledged;
      
      return {
        ...prev,
        alerts: prev.alerts.filter(alert => alert.id !== alertId),
        unacknowledgedCount: wasUnacknowledged 
          ? Math.max(0, prev.unacknowledgedCount - 1)
          : prev.unacknowledgedCount
      };
    });
  }, []);

  const configure = useCallback((metric: string, threshold: MetricThreshold) => {
    finalConfig.metrics[metric] = threshold;
  }, [finalConfig]);

  const updateMetric = useCallback((metric: string, value: number) => {
    checkMetricThreshold(metric, value);
  }, [checkMetricThreshold]);

  // Public API for updating metrics from external sources
  const monitorMetrics = useCallback((metrics: Record<string, number>) => {
    Object.entries(metrics).forEach(([metric, value]) => {
      updateMetric(metric, value);
    });
  }, [updateMetric]);

  return {
    ...state,
    acknowledge,
    acknowledgeAll,
    dismissAll,
    removeAlert,
    configure,
    updateMetric,
    monitorMetrics,
    getAlertsByMetric: useCallback((metric: string) => 
      state.alerts.filter(alert => alert.metric === metric), [state.alerts]),
    getAlertsBySeverity: useCallback((severity: DataAlert['severity']) => 
      state.alerts.filter(alert => alert.severity === severity), [state.alerts])
  };
};

/**
 * Hook for general-purpose notification management
 * 
 * @example
 * ```tsx
 * function NotificationManager() {
 *   const { 
 *     show, 
 *     showSuccess, 
 *     showError, 
 *     showWarning,
 *     notifications,
 *     dismiss
 *   } = useNotificationManager();
 *   
 *   return (
 *     <div>
 *       <button onClick={() => showSuccess('Operation completed!')}>
 *         Show Success
 *       </button>
 *       <button onClick={() => showError('Something went wrong!')}>
 *         Show Error
 *       </button>
 *       <div className="notifications">
 *         {notifications.map(notification => (
 *           <div key={notification.id} className={`notification ${notification.type}`}>
 *             <h4>{notification.title}</h4>
 *             <p>{notification.message}</p>
 *             <button onClick={() => dismiss(notification.id)}>×</button>
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export const useNotificationManager = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const show = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: generateNotificationId(),
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-dismiss if duration is specified
    if (notification.duration) {
      setTimeout(() => {
        dismiss(newNotification.id);
      }, notification.duration);
    }

    return newNotification.id;
  }, []);

  const showSuccess = useCallback((message: string, title = 'Success', duration = 4000) => {
    return show({
      type: 'success',
      title,
      message,
      duration
    });
  }, [show]);

  const showError = useCallback((message: string, title = 'Error', persistent = false) => {
    return show({
      type: 'error',
      title,
      message,
      persistent,
      duration: persistent ? undefined : 6000
    });
  }, [show]);

  const showWarning = useCallback((message: string, title = 'Warning', duration = 5000) => {
    return show({
      type: 'warning',
      title,
      message,
      duration
    });
  }, [show]);

  const showInfo = useCallback((message: string, title = 'Info', duration = 3000) => {
    return show({
      type: 'info',
      title,
      message,
      duration
    });
  }, [show]);

  const dismiss = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const update = useCallback((notificationId: string, updates: Partial<Notification>) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, ...updates }
          : notification
      )
    );
  }, []);

  return {
    notifications,
    show,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismiss,
    dismissAll,
    update
  };
};