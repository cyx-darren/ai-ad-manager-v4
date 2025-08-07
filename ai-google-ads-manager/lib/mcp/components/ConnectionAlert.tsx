/**
 * Connection Alert System Component
 * 
 * Provides real-time alerts and notifications for connection and server health issues.
 * Integrates with Phase 1 (Connection) and Phase 2 (Server Health) monitoring.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ConnectionState, 
  NetworkQuality, 
  ServerHealthState,
  ServiceStatus 
} from '../types/connection';
import { HealthEvent } from '../types/serverHealth';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert data structure
 */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: number;
  source: 'connection' | 'server' | 'service';
  dismissed?: boolean;
  actionable?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

/**
 * Alert system props
 */
export interface ConnectionAlertProps {
  /** Current connection state */
  connectionState?: ConnectionState;
  /** Current network quality */
  networkQuality?: NetworkQuality;
  /** Current server health */
  serverHealth?: ServerHealthState;
  /** Service status */
  serviceStatus?: ServiceStatus;
  /** Health events from server monitoring */
  healthEvents?: HealthEvent[];
  /** Maximum number of alerts to show */
  maxAlerts?: number;
  /** Auto dismiss timeout (ms) */
  autoDismissTimeout?: number;
  /** Position of alerts */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Show alert counter */
  showCounter?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when alert is dismissed */
  onAlertDismiss?: (alertId: string) => void;
}

/**
 * Generate alert from connection state
 */
const generateConnectionAlert = (
  connectionState: ConnectionState,
  networkQuality: NetworkQuality,
  previousState?: ConnectionState
): Alert | null => {
  const timestamp = Date.now();
  
  // Critical connection issues
  if (connectionState === 'error') {
    return {
      id: `connection-error-${timestamp}`,
      severity: 'critical',
      title: 'Connection Error',
      message: 'Unable to establish connection to MCP server. Please check your network.',
      timestamp,
      source: 'connection',
      actionable: true,
      action: {
        label: 'Retry Connection',
        handler: () => window.location.reload()
      }
    };
  }
  
  // Connection state changes
  if (connectionState === 'disconnected' && previousState === 'connected') {
    return {
      id: `connection-lost-${timestamp}`,
      severity: 'error',
      title: 'Connection Lost',
      message: 'Connection to MCP server was lost. Attempting to reconnect...',
      timestamp,
      source: 'connection'
    };
  }
  
  if (connectionState === 'connected' && previousState === 'disconnected') {
    return {
      id: `connection-restored-${timestamp}`,
      severity: 'info',
      title: 'Connection Restored',
      message: 'Successfully reconnected to MCP server.',
      timestamp,
      source: 'connection'
    };
  }
  
  // Network quality degradation
  if (connectionState === 'connected' && networkQuality === 'critical') {
    return {
      id: `network-critical-${timestamp}`,
      severity: 'warning',
      title: 'Poor Network Quality',
      message: 'Network performance is critically low. Some features may be slow.',
      timestamp,
      source: 'connection'
    };
  }
  
  if (connectionState === 'connected' && networkQuality === 'poor') {
    return {
      id: `network-poor-${timestamp}`,
      severity: 'warning',
      title: 'Network Quality Degraded',
      message: 'Network performance has decreased. You may experience delays.',
      timestamp,
      source: 'connection'
    };
  }
  
  return null;
};

/**
 * Generate alert from server health
 */
const generateServerAlert = (
  serverHealth: ServerHealthState,
  serviceStatus: ServiceStatus,
  previousHealth?: ServerHealthState
): Alert | null => {
  const timestamp = Date.now();
  
  // Server health issues
  if (serverHealth === 'unhealthy') {
    return {
      id: `server-unhealthy-${timestamp}`,
      severity: 'critical',
      title: 'Server Unhealthy',
      message: 'MCP server is experiencing critical issues. Data may be unavailable.',
      timestamp,
      source: 'server'
    };
  }
  
  if (serverHealth === 'degraded' && previousHealth === 'healthy') {
    return {
      id: `server-degraded-${timestamp}`,
      severity: 'warning',
      title: 'Server Performance Degraded',
      message: 'MCP server performance has decreased. Some operations may be slower.',
      timestamp,
      source: 'server'
    };
  }
  
  // Service issues
  if (serviceStatus === 'outage') {
    return {
      id: `service-outage-${timestamp}`,
      severity: 'critical',
      title: 'Service Outage',
      message: 'One or more services are experiencing an outage.',
      timestamp,
      source: 'service'
    };
  }
  
  // Recovery notifications
  if (serverHealth === 'healthy' && previousHealth === 'degraded') {
    return {
      id: `server-recovered-${timestamp}`,
      severity: 'info',
      title: 'Server Performance Restored',
      message: 'MCP server is operating normally again.',
      timestamp,
      source: 'server'
    };
  }
  
  return null;
};

/**
 * Alert severity styling
 */
const getAlertStyling = (severity: AlertSeverity) => {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50 border-red-200',
        icon: 'text-red-600',
        title: 'text-red-800',
        message: 'text-red-700',
        button: 'text-red-600 hover:bg-red-100'
      };
    case 'error':
      return {
        bg: 'bg-red-50 border-red-200',
        icon: 'text-red-500',
        title: 'text-red-800',
        message: 'text-red-600',
        button: 'text-red-500 hover:bg-red-100'
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-600',
        title: 'text-yellow-800',
        message: 'text-yellow-700',
        button: 'text-yellow-600 hover:bg-yellow-100'
      };
    case 'info':
      return {
        bg: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-600',
        title: 'text-blue-800',
        message: 'text-blue-700',
        button: 'text-blue-600 hover:bg-blue-100'
      };
  }
};

/**
 * Alert icon component
 */
const AlertIcon: React.FC<{ severity: AlertSeverity; className?: string }> = ({ 
  severity, 
  className = '' 
}) => {
  const iconClasses = `w-5 h-5 ${className}`;
  
  switch (severity) {
    case 'critical':
    case 'error':
      return (
        <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'info':
      return (
        <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
  }
};

/**
 * Individual Alert Component
 */
const AlertItem: React.FC<{
  alert: Alert;
  onDismiss: (id: string) => void;
  onAction?: () => void;
}> = ({ alert, onDismiss, onAction }) => {
  const styling = getAlertStyling(alert.severity);
  
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${styling.bg} transition-all duration-300 ease-in-out`}>
      <div className="flex items-start space-x-3">
        <AlertIcon severity={alert.severity} className={styling.icon} />
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${styling.title}`}>
            {alert.title}
          </h4>
          <p className={`mt-1 text-sm ${styling.message}`}>
            {alert.message}
          </p>
          <div className="mt-2 flex items-center space-x-3">
            <span className="text-xs text-gray-500">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
            {alert.actionable && alert.action && (
              <button
                onClick={() => {
                  alert.action?.handler();
                  onAction?.();
                }}
                className={`text-xs font-medium ${styling.button} hover:underline`}
              >
                {alert.action.label}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className={`${styling.button} p-1 rounded-md transition-colors`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

/**
 * Main Connection Alert Component
 */
export const ConnectionAlert: React.FC<ConnectionAlertProps> = ({
  connectionState,
  networkQuality,
  serverHealth,
  serviceStatus,
  healthEvents = [],
  maxAlerts = 5,
  autoDismissTimeout = 10000,
  position = 'top-right',
  showCounter = true,
  className = '',
  onAlertDismiss
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [previousStates, setPreviousStates] = useState<{
    connectionState?: ConnectionState;
    serverHealth?: ServerHealthState;
  }>({});
  
  // Generate alerts based on state changes
  useEffect(() => {
    const newAlerts: Alert[] = [];
    
    // Connection alerts
    if (connectionState && networkQuality) {
      const connectionAlert = generateConnectionAlert(
        connectionState,
        networkQuality,
        previousStates.connectionState
      );
      if (connectionAlert) newAlerts.push(connectionAlert);
    }
    
    // Server health alerts
    if (serverHealth && serviceStatus) {
      const serverAlert = generateServerAlert(
        serverHealth,
        serviceStatus,
        previousStates.serverHealth
      );
      if (serverAlert) newAlerts.push(serverAlert);
    }
    
    // Add new alerts
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const combined = [...newAlerts, ...prev];
        return combined.slice(0, maxAlerts);
      });
    }
    
    // Update previous states
    setPreviousStates({
      connectionState,
      serverHealth
    });
  }, [connectionState, networkQuality, serverHealth, serviceStatus, maxAlerts, previousStates.connectionState, previousStates.serverHealth]);
  
  // Handle health events
  useEffect(() => {
    healthEvents.forEach(event => {
      if (event.severity === 'critical' || event.severity === 'error') {
        const alert: Alert = {
          id: `health-event-${event.timestamp}`,
          severity: event.severity,
          title: `Health Event: ${event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          message: event.data?.message || 'A health monitoring event occurred.',
          timestamp: event.timestamp,
          source: 'server'
        };
        
        setAlerts(prev => {
          const exists = prev.some(a => a.id === alert.id);
          if (exists) return prev;
          return [alert, ...prev].slice(0, maxAlerts);
        });
      }
    });
  }, [healthEvents, maxAlerts]);
  
  // Auto dismiss alerts
  useEffect(() => {
    if (autoDismissTimeout > 0) {
      const timer = setInterval(() => {
        setAlerts(prev => prev.filter(alert => 
          Date.now() - alert.timestamp < autoDismissTimeout
        ));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [autoDismissTimeout]);
  
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    onAlertDismiss?.(alertId);
  }, [onAlertDismiss]);
  
  const dismissAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);
  
  if (alerts.length === 0) return null;
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50 w-96 max-w-sm ${className}`}>
      {showCounter && alerts.length > 1 && (
        <div className="mb-2 flex justify-between items-center bg-gray-900 text-white px-3 py-2 rounded-lg text-sm">
          <span>{alerts.length} active alerts</span>
          <button
            onClick={dismissAllAlerts}
            className="text-gray-300 hover:text-white text-xs underline"
          >
            Dismiss All
          </button>
        </div>
      )}
      
      <div className="space-y-2">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onDismiss={dismissAlert}
          />
        ))}
      </div>
    </div>
  );
};

export default ConnectionAlert;