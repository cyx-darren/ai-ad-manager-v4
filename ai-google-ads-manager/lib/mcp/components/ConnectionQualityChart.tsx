/**
 * Connection Quality Visualization Component
 * 
 * Provides real-time charts and visualizations for connection quality metrics.
 * Integrates with Phase 1 connection monitoring data.
 */

'use client';

import React, { useMemo } from 'react';
import { NetworkQuality, ConnectionQualityMetrics } from '../types/connection';

/**
 * Connection Quality Chart Props
 */
export interface ConnectionQualityChartProps {
  /** Current quality metrics */
  currentMetrics: ConnectionQualityMetrics;
  /** Historical metrics data */
  historicalData?: ConnectionQualityMetrics[];
  /** Chart type */
  chartType?: 'line' | 'bar' | 'gauge';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show trend indicator */
  showTrend?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Quality score calculation
 */
const getQualityScore = (quality: NetworkQuality): number => {
  switch (quality) {
    case 'excellent': return 100;
    case 'good': return 80;
    case 'fair': return 60;
    case 'poor': return 40;
    case 'critical': return 20;
    default: return 0;
  }
};

/**
 * Quality color mapping
 */
const getQualityColor = (quality: NetworkQuality): string => {
  switch (quality) {
    case 'excellent': return '#10b981'; // green-500
    case 'good': return '#84cc16';      // lime-500
    case 'fair': return '#eab308';      // yellow-500
    case 'poor': return '#f97316';      // orange-500
    case 'critical': return '#ef4444';  // red-500
    default: return '#6b7280';          // gray-500
  }
};

/**
 * Latency Quality Gauge Component
 */
const LatencyGauge: React.FC<{
  latency: number;
  size: 'sm' | 'md' | 'lg';
}> = ({ latency, size }) => {
  const sizeMap = {
    sm: { size: 80, strokeWidth: 8, fontSize: '12px' },
    md: { size: 120, strokeWidth: 12, fontSize: '14px' },
    lg: { size: 160, strokeWidth: 16, fontSize: '16px' }
  };
  
  const { size: circleSize, strokeWidth, fontSize } = sizeMap[size];
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Calculate progress based on latency (0-1000ms scale)
  const progress = Math.min(latency / 1000, 1);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress * circumference);
  
  // Color based on latency
  const getLatencyColor = (ms: number): string => {
    if (ms < 50) return '#10b981';    // green
    if (ms < 150) return '#84cc16';   // lime  
    if (ms < 300) return '#eab308';   // yellow
    if (ms < 500) return '#f97316';   // orange
    return '#ef4444';                 // red
  };
  
  const color = getLatencyColor(latency);
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={circleSize}
        height={circleSize}
        viewBox={`0 0 ${circleSize} ${circleSize}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease'
          }}
        />
      </svg>
      {/* Center text */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ fontSize }}
      >
        <div className="font-bold text-gray-800">{latency}ms</div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">latency</div>
      </div>
    </div>
  );
};

/**
 * Mini Quality Chart Component  
 */
const MiniQualityChart: React.FC<{
  data: ConnectionQualityMetrics[];
  width: number;
  height: number;
}> = ({ data, width, height }) => {
  const points = useMemo(() => {
    if (data.length === 0) return '';
    
    const maxLatency = Math.max(...data.map(d => d.latency));
    const minLatency = Math.min(...data.map(d => d.latency));
    const range = maxLatency - minLatency || 1;
    
    return data.map((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((point.latency - minLatency) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [data, width, height]);
  
  const avgLatency = data.length > 0 
    ? data.reduce((sum, d) => sum + d.latency, 0) / data.length 
    : 0;
  
  const getLineColor = (latency: number): string => {
    if (latency < 100) return '#10b981';
    if (latency < 200) return '#eab308';
    return '#ef4444';
  };
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={getLineColor(avgLatency)}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Data points */}
      {data.map((point, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((point.latency - (Math.min(...data.map(d => d.latency)))) / 
                   (Math.max(...data.map(d => d.latency)) - Math.min(...data.map(d => d.latency)) || 1)) * height;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={getQualityColor(point.quality)}
            className="opacity-80"
          />
        );
      })}
    </svg>
  );
};

/**
 * Quality Metrics Bar Component
 */
const QualityMetricsBar: React.FC<{
  metrics: ConnectionQualityMetrics;
  size: 'sm' | 'md' | 'lg';
}> = ({ metrics, size }) => {
  const barHeight = {
    sm: 'h-2',
    md: 'h-3', 
    lg: 'h-4'
  }[size];
  
  const qualityScore = getQualityScore(metrics.quality);
  const qualityColor = getQualityColor(metrics.quality);
  
  return (
    <div className="space-y-2">
      {/* Quality Score Bar */}
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-gray-700 w-16">Quality</span>
        <div className={`flex-1 bg-gray-200 rounded-full ${barHeight}`}>
          <div
            className={`${barHeight} rounded-full transition-all duration-500 ease-out`}
            style={{
              width: `${qualityScore}%`,
              backgroundColor: qualityColor
            }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-800 w-16 text-right">
          {metrics.quality}
        </span>
      </div>
      
      {/* Latency Indicator */}
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-gray-700 w-16">Latency</span>
        <div className={`flex-1 bg-gray-200 rounded-full ${barHeight}`}>
          <div
            className={`${barHeight} rounded-full transition-all duration-500 ease-out`}
            style={{
              width: `${Math.min((metrics.latency / 500) * 100, 100)}%`,
              backgroundColor: metrics.latency < 100 ? '#10b981' : metrics.latency < 300 ? '#eab308' : '#ef4444'
            }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-800 w-16 text-right">
          {metrics.latency}ms
        </span>
      </div>
      
      {/* Jitter Indicator */}
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-gray-700 w-16">Jitter</span>
        <div className={`flex-1 bg-gray-200 rounded-full ${barHeight}`}>
          <div
            className={`${barHeight} rounded-full transition-all duration-500 ease-out`}
            style={{
              width: `${Math.min((metrics.jitter / 100) * 100, 100)}%`,
              backgroundColor: metrics.jitter < 20 ? '#10b981' : metrics.jitter < 50 ? '#eab308' : '#ef4444'
            }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-800 w-16 text-right">
          {metrics.jitter.toFixed(1)}ms
        </span>
      </div>
    </div>
  );
};

/**
 * Main Connection Quality Chart Component
 */
export const ConnectionQualityChart: React.FC<ConnectionQualityChartProps> = ({
  currentMetrics,
  historicalData = [],
  chartType = 'gauge',
  size = 'md',
  showTrend = false,
  className = ''
}) => {
  const renderChart = () => {
    switch (chartType) {
      case 'gauge':
        return (
          <div className="flex flex-col items-center space-y-4">
            <LatencyGauge latency={currentMetrics.latency} size={size} />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">
                Network Quality: 
                <span 
                  className="ml-2 font-semibold capitalize"
                  style={{ color: getQualityColor(currentMetrics.quality) }}
                >
                  {currentMetrics.quality}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Confidence: {(currentMetrics.qualityConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        );
        
      case 'bar':
        return <QualityMetricsBar metrics={currentMetrics} size={size} />;
        
      case 'line':
        const chartWidth = size === 'sm' ? 200 : size === 'md' ? 300 : 400;
        const chartHeight = size === 'sm' ? 60 : size === 'md' ? 80 : 100;
        
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Latency Trend
              </span>
              <span className="text-sm text-gray-500">
                {currentMetrics.latency}ms current
              </span>
            </div>
            <MiniQualityChart 
              data={historicalData.slice(-20)} 
              width={chartWidth} 
              height={chartHeight}
            />
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {renderChart()}
      {showTrend && historicalData.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Trend</span>
            <div className="flex items-center space-x-2">
              {/* Simple trend calculation */}
              {(() => {
                const recent = historicalData.slice(-5);
                const older = historicalData.slice(-10, -5);
                if (recent.length === 0 || older.length === 0) return null;
                
                const recentAvg = recent.reduce((sum, d) => sum + d.latency, 0) / recent.length;
                const olderAvg = older.reduce((sum, d) => sum + d.latency, 0) / older.length;
                const change = ((recentAvg - olderAvg) / olderAvg) * 100;
                
                if (Math.abs(change) < 5) {
                  return <span className="text-gray-500">Stable</span>;
                } else if (change > 0) {
                  return <span className="text-red-500">↗ Degrading ({change.toFixed(1)}%)</span>;
                } else {
                  return <span className="text-green-500">↘ Improving ({Math.abs(change).toFixed(1)}%)</span>;
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionQualityChart;