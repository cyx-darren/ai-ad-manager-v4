/**
 * Performance Chart Component
 * 
 * Advanced charts for visualizing connection performance metrics,
 * latency trends, bandwidth utilization, and quality analytics.
 */

'use client';

import React, { useMemo } from 'react';
import { useQualityTrends, usePerformanceMetrics } from '../hooks/analyticsHooks';
import { QualityTrendPoint, PerformanceMetrics } from '../types/analytics';

/**
 * Performance Chart Props
 */
export interface PerformanceChartProps {
  /** Chart type */
  type: 'latency' | 'bandwidth' | 'quality' | 'combined';
  /** Time period for data */
  period?: { start: number; end: number };
  /** Chart size */
  size?: 'sm' | 'md' | 'lg';
  /** Show trend lines */
  showTrend?: boolean;
  /** Custom className */
  className?: string;
  /** Chart height */
  height?: number;
}

/**
 * Latency Trend Chart Component
 */
export const LatencyChart: React.FC<PerformanceChartProps> = ({
  period,
  size = 'md',
  showTrend = true,
  className = '',
  height = 200
}) => {
  const { trends, isLoading } = useQualityTrends({ period });
  const { metrics } = usePerformanceMetrics({ period });

  const chartData = useMemo(() => {
    if (!trends?.dataPoints || trends.dataPoints.length === 0) return null;

    const points = trends.dataPoints.slice(-50); // Last 50 points
    const maxLatency = Math.max(...points.map(p => p.latency));
    const minLatency = Math.min(...points.map(p => p.latency));
    const latencyRange = maxLatency - minLatency || 1;

    return points.map((point, index) => ({
      x: (index / (points.length - 1)) * 100,
      y: ((maxLatency - point.latency) / latencyRange) * 100,
      latency: point.latency,
      timestamp: point.timestamp,
      quality: point.quality
    }));
  }, [trends]);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No latency data available</p>
        </div>
      </div>
    );
  }

  // Create SVG path for the line chart
  const pathData = chartData.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.y}`;
  }, '');

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 dark:text-white">Latency Trend</h4>
        {metrics && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Avg: {metrics.latency.average.toFixed(0)}ms | P95: {metrics.latency.p95.toFixed(0)}ms
          </div>
        )}
      </div>

      <div className="relative" style={{ height: height - 80 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-gray-300 dark:text-gray-600" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />

          {/* Area fill */}
          <path
            d={`${pathData} L 100 100 L 0 100 Z`}
            fill="url(#latencyGradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="0.5"
            className="drop-shadow-sm"
          />

          {/* Data points */}
          {chartData.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="0.8"
              fill="#8B5CF6"
              className="drop-shadow-sm hover:r-1.2 transition-all cursor-pointer"
            >
              <title>
                {new Date(point.timestamp).toLocaleTimeString()}: {point.latency.toFixed(0)}ms ({point.quality})
              </title>
            </circle>
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="latencyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-8">
          <span>Low</span>
          <span>High</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-500 dark:text-gray-400 -mb-4">
          <span>Past</span>
          <span>Recent</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Bandwidth Chart Component
 */
export const BandwidthChart: React.FC<PerformanceChartProps> = ({
  period,
  className = '',
  height = 200
}) => {
  const { trends, isLoading } = useQualityTrends({ period });

  const chartData = useMemo(() => {
    if (!trends?.dataPoints || trends.dataPoints.length === 0) return null;

    const points = trends.dataPoints.slice(-30);
    const maxBandwidth = Math.max(...points.map(p => Math.max(p.downloadBandwidth, p.uploadBandwidth)));
    
    return points.map((point, index) => ({
      x: (index / (points.length - 1)) * 100,
      downloadY: ((maxBandwidth - point.downloadBandwidth) / maxBandwidth) * 100,
      uploadY: ((maxBandwidth - point.uploadBandwidth) / maxBandwidth) * 100,
      download: point.downloadBandwidth,
      upload: point.uploadBandwidth,
      timestamp: point.timestamp
    }));
  }, [trends]);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <p>No bandwidth data available</p>
        </div>
      </div>
    );
  }

  const downloadPath = chartData.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.downloadY}`;
  }, '');

  const uploadPath = chartData.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.uploadY}`;
  }, '');

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 dark:text-white">Bandwidth Usage</h4>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-500 dark:text-gray-400">Download</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-500 dark:text-gray-400">Upload</span>
          </div>
        </div>
      </div>

      <div className="relative" style={{ height: height - 80 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
        >
          {/* Grid */}
          <defs>
            <pattern id="bandwidthGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-gray-300 dark:text-gray-600" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#bandwidthGrid)" />

          {/* Download line */}
          <path
            d={downloadPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="0.5"
            strokeDasharray="none"
          />

          {/* Upload line */}
          <path
            d={uploadPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Data points */}
          {chartData.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.downloadY}
                r="0.6"
                fill="#3B82F6"
              >
                <title>
                  {new Date(point.timestamp).toLocaleTimeString()}: ↓{point.download.toFixed(1)} Mbps
                </title>
              </circle>
              <circle
                cx={point.x}
                cy={point.uploadY}
                r="0.6"
                fill="#10B981"
              >
                <title>
                  {new Date(point.timestamp).toLocaleTimeString()}: ↑{point.upload.toFixed(1)} Mbps
                </title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

/**
 * Quality Score Chart Component
 */
export const QualityChart: React.FC<PerformanceChartProps> = ({
  period,
  className = '',
  height = 200
}) => {
  const { trends, isLoading } = useQualityTrends({ period });

  const chartData = useMemo(() => {
    if (!trends?.dataPoints || trends.dataPoints.length === 0) return null;

    return trends.dataPoints.slice(-40).map((point, index) => ({
      x: (index / (trends.dataPoints.length - 1)) * 100,
      y: ((100 - point.score) / 100) * 100,
      score: point.score,
      quality: point.quality,
      timestamp: point.timestamp
    }));
  }, [trends]);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <p>No quality data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`} style={{ height }}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 dark:text-white">Connection Quality</h4>
        {trends && (
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Avg: {trends.analysis.averageScore.toFixed(0)}/100</span>
            <span className={`${
              trends.analysis.direction === 'improving' ? 'text-green-500' :
              trends.analysis.direction === 'degrading' ? 'text-red-500' : 'text-gray-500'
            }`}>
              {trends.analysis.direction === 'improving' ? '↗' : 
               trends.analysis.direction === 'degrading' ? '↘' : '→'}
            </span>
          </div>
        )}
      </div>

      <div className="relative" style={{ height: height - 80 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
        >
          {/* Quality zones */}
          <rect x="0" y="0" width="100" height="20" fill="#DC2626" opacity="0.1" />
          <rect x="0" y="20" width="100" height="20" fill="#F59E0B" opacity="0.1" />
          <rect x="0" y="40" width="100" height="20" fill="#10B981" opacity="0.1" />
          <rect x="0" y="60" width="100" height="20" fill="#059669" opacity="0.1" />
          <rect x="0" y="80" width="100" height="20" fill="#047857" opacity="0.1" />

          {/* Quality bars */}
          {chartData.map((point, index) => {
            const barWidth = 100 / chartData.length * 0.8;
            const barX = (index / (chartData.length - 1)) * (100 - barWidth) + barWidth / 2;
            
            const color = point.score >= 80 ? '#10B981' :
                         point.score >= 60 ? '#F59E0B' :
                         point.score >= 40 ? '#EF4444' : '#DC2626';

            return (
              <rect
                key={index}
                x={barX}
                y={point.y}
                width={barWidth}
                height={100 - point.y}
                fill={color}
                opacity="0.7"
                className="hover:opacity-100 transition-opacity cursor-pointer"
              >
                <title>
                  {new Date(point.timestamp).toLocaleTimeString()}: {point.score}/100 ({point.quality})
                </title>
              </rect>
            );
          })}
        </svg>

        {/* Quality labels */}
        <div className="absolute right-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -mr-12">
          <span>Excellent</span>
          <span>Good</span>
          <span>Fair</span>
          <span>Poor</span>
          <span>Critical</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Combined Performance Chart
 */
export const CombinedChart: React.FC<PerformanceChartProps> = ({
  period,
  className = '',
  height = 300
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LatencyChart period={period} height={height / 2} />
        <QualityChart period={period} height={height / 2} />
      </div>
      <BandwidthChart period={period} height={height / 2} />
    </div>
  );
};

/**
 * Main Performance Chart Component
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = (props) => {
  switch (props.type) {
    case 'latency':
      return <LatencyChart {...props} />;
    case 'bandwidth':
      return <BandwidthChart {...props} />;
    case 'quality':
      return <QualityChart {...props} />;
    case 'combined':
      return <CombinedChart {...props} />;
    default:
      return <LatencyChart {...props} />;
  }
};

export default PerformanceChart;