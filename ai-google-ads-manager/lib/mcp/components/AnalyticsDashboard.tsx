/**
 * Analytics Dashboard Component
 * 
 * Comprehensive dashboard for displaying historical connection analytics,
 * uptime tracking, quality trends, and performance metrics.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  useAnalytics,
  useUptimeAnalytics,
  useQualityTrends,
  usePerformanceMetrics,
  useConnectionEvents
} from '../hooks/analyticsHooks';
import { AnalyticsPeriod } from '../types/analytics';

/**
 * Analytics Dashboard Props
 */
export interface AnalyticsDashboardProps {
  /** Dashboard size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show specific sections */
  sections?: {
    uptime?: boolean;
    quality?: boolean;
    performance?: boolean;
    events?: boolean;
  };
  /** Time period for analytics */
  period?: { start: number; end: number };
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Custom className */
  className?: string;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
}

/**
 * Time period selector options
 */
const PERIOD_OPTIONS: { label: string; value: AnalyticsPeriod; hours: number }[] = [
  { label: 'Last Hour', value: 'hour', hours: 1 },
  { label: 'Last 24 Hours', value: 'day', hours: 24 },
  { label: 'Last Week', value: 'week', hours: 24 * 7 },
  { label: 'Last Month', value: 'month', hours: 24 * 30 }
];

/**
 * Main Analytics Dashboard Component
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  size = 'md',
  sections = { uptime: true, quality: true, performance: true, events: true },
  period,
  updateInterval = 30000,
  autoRefresh = true,
  className = ''
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('day');
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate time period
  const timePeriod = useMemo(() => {
    if (period) return period;
    
    const now = Date.now();
    const selectedOption = PERIOD_OPTIONS.find(opt => opt.value === selectedPeriod);
    const hours = selectedOption?.hours || 24;
    
    return {
      start: now - (hours * 60 * 60 * 1000),
      end: now
    };
  }, [period, selectedPeriod]);

  // Analytics hooks
  const { summary, isLoading: summaryLoading, refresh } = useAnalytics({
    period: timePeriod,
    updateInterval,
    autoUpdate: autoRefresh
  });

  const { uptime, isLoading: uptimeLoading } = useUptimeAnalytics({
    period: timePeriod,
    updateInterval,
    autoUpdate: autoRefresh
  });

  const { trends, isLoading: trendsLoading } = useQualityTrends({
    period: timePeriod,
    updateInterval: 60000,
    autoUpdate: autoRefresh
  });

  const { metrics, isLoading: metricsLoading } = usePerformanceMetrics({
    period: timePeriod,
    updateInterval,
    autoUpdate: autoRefresh
  });

  const { events, isLoading: eventsLoading } = useConnectionEvents({
    maxEvents: 10,
    updateInterval: 10000,
    autoUpdate: autoRefresh
  });

  const isLoading = summaryLoading || uptimeLoading || trendsLoading || metricsLoading || eventsLoading;

  // Size-based styling
  const sizeClasses = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
    lg: 'p-6 text-lg'
  };

  const cardSizeClasses = {
    sm: 'p-3 min-h-[120px]',
    md: 'p-4 min-h-[150px]',
    lg: 'p-6 min-h-[180px]'
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const formatLatency = (ms: number): string => {
    return `${ms.toFixed(0)}ms`;
  };

  if (isLoading && !summary) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${sizeClasses[size]} ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${sizeClasses[size]} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Connection Analytics
          </h3>
          {summary && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {PERIOD_OPTIONS.find(opt => opt.value === selectedPeriod)?.label}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as AnalyticsPeriod)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Uptime Card */}
        {sections.uptime && uptime && (
          <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg ${cardSizeClasses[size]}`}>
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Uptime</h4>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatPercentage(uptime.uptimePercentage)}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">
              {uptime.outageCount} outages
            </div>
            {uptime.currentStreak && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                Current {uptime.currentStreak.type}: {formatDuration(uptime.currentStreak.duration)}
              </div>
            )}
          </div>
        )}

        {/* Quality Card */}
        {sections.quality && trends && (
          <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${cardSizeClasses[size]}`}>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Quality</h4>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {trends.analysis.averageScore.toFixed(0)}/100
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              {trends.analysis.direction === 'improving' ? '↗' : trends.analysis.direction === 'degrading' ? '↘' : '→'} {trends.analysis.direction}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {trends.dataPoints.length} data points
            </div>
          </div>
        )}

        {/* Performance Card */}
        {sections.performance && metrics && (
          <div className={`bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg ${cardSizeClasses[size]}`}>
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Latency</h4>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatLatency(metrics.latency.average)}
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300">
              P95: {formatLatency(metrics.latency.p95)}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {metrics.latency.trend > 0 ? '↗' : metrics.latency.trend < 0 ? '↘' : '→'} {Math.abs(metrics.latency.trend).toFixed(1)}%
            </div>
          </div>
        )}

        {/* Reliability Card */}
        {sections.performance && metrics && (
          <div className={`bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg ${cardSizeClasses[size]}`}>
            <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">Reliability</h4>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatPercentage(metrics.reliability.successRate)}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">
              {formatPercentage(metrics.reliability.errorRate)} errors
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              MTTR: {formatDuration(metrics.reliability.meanTimeToRecovery)}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Quality Trend Chart */}
          {sections.quality && trends && trends.dataPoints.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Quality Trend</h4>
              <div className="h-40 flex items-end space-x-1">
                {trends.dataPoints.slice(-20).map((point, index) => {
                  const height = (point.score / 100) * 100;
                  const color = point.score >= 80 ? 'bg-green-500' : 
                               point.score >= 60 ? 'bg-yellow-500' : 
                               point.score >= 40 ? 'bg-orange-500' : 'bg-red-500';
                  
                  return (
                    <div
                      key={index}
                      className={`${color} rounded-t opacity-70 hover:opacity-100 transition-opacity flex-1 min-w-[8px]`}
                      style={{ height: `${height}%` }}
                      title={`${new Date(point.timestamp).toLocaleTimeString()}: ${point.score}/100`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span>Poor</span>
                <span>Good</span>
                <span>Excellent</span>
              </div>
            </div>
          )}

          {/* Recent Events */}
          {sections.events && events && events.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Events</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {events.slice(-10).reverse().map((event) => {
                  const eventColors = {
                    connected: 'text-green-600 dark:text-green-400',
                    reconnected: 'text-blue-600 dark:text-blue-400',
                    disconnected: 'text-red-600 dark:text-red-400',
                    error: 'text-red-600 dark:text-red-400',
                    timeout: 'text-orange-600 dark:text-orange-400',
                    quality_changed: 'text-blue-600 dark:text-blue-400',
                    server_health_changed: 'text-purple-600 dark:text-purple-400'
                  };

                  return (
                    <div key={event.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${eventColors[event.type] || 'text-gray-600 dark:text-gray-400'}`}>
                          {event.type.replace('_', ' ')}
                        </span>
                        {event.networkQuality && (
                          <span className="text-gray-500 dark:text-gray-400">
                            ({event.networkQuality})
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400 dark:text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {summary && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              {summary.dataStats.totalDataPoints} data points collected
            </span>
            <span>
              Last updated: {new Date(summary.dataStats.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Analytics Summary Component
 */
export const AnalyticsSummary: React.FC<{
  period?: { start: number; end: number };
  className?: string;
}> = ({ period, className = '' }) => {
  const { summary, isLoading } = useAnalytics({ period, autoUpdate: true });

  if (isLoading || !summary) {
    return (
      <div className={`flex space-x-4 ${className}`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-6 text-sm ${className}`}>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-gray-700 dark:text-gray-300">
          {summary.uptime.uptimePercentage.toFixed(1)}% uptime
        </span>
      </div>
      
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span className="text-gray-700 dark:text-gray-300">
          {summary.performance.latency.average.toFixed(0)}ms avg
        </span>
      </div>
      
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
        <span className="text-gray-700 dark:text-gray-300">
          {summary.quality.analysis.averageScore.toFixed(0)}/100 quality
        </span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;