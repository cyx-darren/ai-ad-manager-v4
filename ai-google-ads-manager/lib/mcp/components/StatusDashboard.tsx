/**
 * Status Dashboard Widget Component
 * 
 * Comprehensive dashboard widget that combines connection monitoring, 
 * server health, quality visualizations, and alert systems.
 * Integrates Phase 1 (Connection) and Phase 2 (Server Health) with Phase 3 (Visual).
 */

'use client';

import React, { useState, useEffect } from 'react';
import { StatusIndicator, ConnectionStatusIndicator, ServerHealthStatusIndicator } from './StatusIndicator';
import { ConnectionQualityChart } from './ConnectionQualityChart';
import { ConnectionAlert } from './ConnectionAlert';
import { 
  ConnectionState, 
  NetworkQuality, 
  ConnectionQualityMetrics,
  ConnectionHealth 
} from '../types/connection';
import { 
  ServerHealthState, 
  ServiceStatus, 
  ServerHealthMetrics,
  HealthEvent 
} from '../types/serverHealth';

/**
 * Dashboard widget configuration
 */
export interface StatusDashboardConfig {
  /** Show connection monitoring section */
  showConnection?: boolean;
  /** Show server health monitoring section */
  showServerHealth?: boolean;
  /** Show quality charts */
  showQualityChart?: boolean;
  /** Show alerts */
  showAlerts?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Chart type for quality visualization */
  chartType?: 'line' | 'bar' | 'gauge';
}

/**
 * Dashboard props
 */
export interface StatusDashboardProps {
  /** Configuration options */
  config?: StatusDashboardConfig;
  /** Custom className */
  className?: string;
  /** Custom title */
  title?: string;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Connection monitoring data */
  connectionData?: {
    state: ConnectionState;
    quality: NetworkQuality;
    metrics: ConnectionQualityMetrics;
    health: ConnectionHealth;
    history: ConnectionQualityMetrics[];
  };
  /** Server health monitoring data */
  serverHealthData?: {
    state: ServerHealthState;
    serviceStatus: ServiceStatus;
    metrics: ServerHealthMetrics;
    events: HealthEvent[];
  };
}

/**
 * Mock data for demonstration
 */
const mockConnectionData = {
  state: 'connected' as ConnectionState,
  quality: 'good' as NetworkQuality,
  metrics: {
    latency: 45,
    jitter: 12,
    downloadBandwidth: 25.5,
    uploadBandwidth: 8.2,
    packetLoss: 0.1,
    quality: 'good' as NetworkQuality,
    qualityConfidence: 0.95,
    timestamp: Date.now()
  },
  health: {
    healthScore: 92,
    isHealthy: true,
    uptime: 99.8,
    downtime: 0,
    availability: 100,
    failureCount: 0,
    recoveryCount: 1,
    lastConnected: Date.now() - 3600000,
    lastDisconnected: 0,
    stability: 'stable' as const
  },
  history: []
};

const mockServerHealthData = {
  state: 'healthy' as ServerHealthState,
  serviceStatus: 'operational' as ServiceStatus,
  metrics: {
    overallHealth: 'healthy' as ServerHealthState,
    healthScore: 95,
    uptime: 99.9,
    averageResponseTime: 120,
    errorRate: 0.01,
    lastHeartbeat: Date.now() - 30000,
    failedHeartbeats: 0,
    servicesHealth: {},
    endpointsHealth: {},
    timestamp: Date.now()
  },
  events: []
};

/**
 * Status summary component
 */
const StatusSummary: React.FC<{
  connectionData?: typeof mockConnectionData;
  serverHealthData?: typeof mockServerHealthData;
  compact?: boolean;
}> = ({ connectionData, serverHealthData, compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center space-x-4">
        <StatusIndicator
          connectionState={connectionData?.state}
          networkQuality={connectionData?.quality}
          serverHealth={serverHealthData?.state}
          serviceStatus={serverHealthData?.serviceStatus}
          size="sm"
          showLabel={true}
          showTooltip={true}
        />
        <div className="text-xs text-gray-500">
          {connectionData?.metrics.latency}ms • {serverHealthData?.metrics.uptime.toFixed(1)}% uptime
        </div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Connection Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Connection Status</h4>
        <div className="space-y-3">
          <ConnectionStatusIndicator
            connectionState={connectionData?.state || 'disconnected'}
            networkQuality={connectionData?.quality || 'unknown'}
            latency={connectionData?.metrics.latency}
            size="md"
            showDetails={true}
          />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Uptime</span>
              <div className="font-semibold">{connectionData?.health.uptime.toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-gray-500">Health</span>
              <div className="font-semibold">{connectionData?.health.healthScore}</div>
            </div>
            <div>
              <span className="text-gray-500">Jitter</span>
              <div className="font-semibold">{connectionData?.metrics.jitter.toFixed(1)}ms</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Server Health */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Server Health</h4>
        <div className="space-y-3">
          <ServerHealthStatusIndicator
            serverHealth={serverHealthData?.state || 'unknown'}
            healthScore={serverHealthData?.metrics.healthScore}
            uptime={serverHealthData?.metrics.uptime}
            size="md"
            showDetails={true}
          />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Response</span>
              <div className="font-semibold">{serverHealthData?.metrics.averageResponseTime.toFixed(0)}ms</div>
            </div>
            <div>
              <span className="text-gray-500">Error Rate</span>
              <div className="font-semibold">{(serverHealthData?.metrics.errorRate || 0).toFixed(2)}%</div>
            </div>
            <div>
              <span className="text-gray-500">Score</span>
              <div className="font-semibold">{serverHealthData?.metrics.healthScore}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Performance metrics component
 */
const PerformanceMetrics: React.FC<{
  connectionData?: typeof mockConnectionData;
  serverHealthData?: typeof mockServerHealthData;
}> = ({ connectionData, serverHealthData }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Performance Metrics</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {connectionData?.metrics.latency || 0}ms
          </div>
          <div className="text-xs text-gray-500">Latency</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {(connectionData?.metrics.downloadBandwidth || 0).toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Mbps Down</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {(serverHealthData?.metrics.averageResponseTime || 0).toFixed(0)}ms
          </div>
          <div className="text-xs text-gray-500">Server Response</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {(serverHealthData?.metrics.uptime || 0).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Uptime</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Default configuration
 */
const defaultConfig: StatusDashboardConfig = {
  showConnection: true,
  showServerHealth: true,
  showQualityChart: true,
  showAlerts: true,
  compact: false,
  refreshInterval: 5000,
  chartType: 'gauge'
};

/**
 * Main Status Dashboard Component
 */
export const StatusDashboard: React.FC<StatusDashboardProps> = ({
  config = defaultConfig,
  className = '',
  title = 'MCP Status Dashboard',
  showRefresh = true,
  onRefresh,
  connectionData = mockConnectionData,
  serverHealthData = mockServerHealthData
}) => {
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Auto refresh
  useEffect(() => {
    if (config.refreshInterval && config.refreshInterval > 0) {
      const interval = setInterval(() => {
        setLastUpdated(Date.now());
        onRefresh?.();
      }, config.refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [config.refreshInterval, onRefresh]);
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastUpdated(Date.now());
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  const mergedConfig = { ...defaultConfig, ...config };
  
  if (mergedConfig.compact) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <StatusSummary
            connectionData={connectionData}
            serverHealthData={serverHealthData}
            compact={true}
          />
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            <span>Refresh</span>
          </button>
        )}
      </div>
      
      {/* Status Summary */}
      <StatusSummary
        connectionData={connectionData}
        serverHealthData={serverHealthData}
        compact={false}
      />
      
      {/* Quality Chart */}
      {mergedConfig.showQualityChart && connectionData && (
        <ConnectionQualityChart
          currentMetrics={connectionData.metrics}
          historicalData={connectionData.history}
          chartType={mergedConfig.chartType}
          size="md"
          showTrend={true}
        />
      )}
      
      {/* Performance Metrics */}
      <PerformanceMetrics
        connectionData={connectionData}
        serverHealthData={serverHealthData}
      />
      
      {/* Alerts */}
      {mergedConfig.showAlerts && (
        <ConnectionAlert
          connectionState={connectionData?.state}
          networkQuality={connectionData?.quality}
          serverHealth={serverHealthData?.state}
          serviceStatus={serverHealthData?.serviceStatus}
          healthEvents={serverHealthData?.events}
          position="top-right"
          showCounter={true}
          autoDismissTimeout={15000}
        />
      )}
    </div>
  );
};

export default StatusDashboard;