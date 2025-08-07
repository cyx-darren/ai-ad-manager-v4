/**
 * Predictive Intelligence Visual Components
 * Phase 5: Predictive Connection Intelligence - Subtask 28.6
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DisconnectPrediction,
  ReconnectionStrategy,
  ConnectionPattern,
  ProactiveNotification,
  NotificationPriority
} from '../types/predictive';
import {
  useDisconnectPrediction,
  useReconnectionStrategy,
  useConnectionPatterns,
  useProactiveNotifications
} from '../hooks/predictiveHooks';

// Utility function for formatting time
const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
};

// Utility function for risk level styling
const getRiskLevelStyle = (probability: number) => {
  if (probability >= 0.8) return 'bg-red-100 border-red-500 text-red-800';
  if (probability >= 0.6) return 'bg-yellow-100 border-yellow-500 text-yellow-800';
  if (probability >= 0.4) return 'bg-blue-100 border-blue-500 text-blue-800';
  return 'bg-green-100 border-green-500 text-green-800';
};

/**
 * Disconnect Warning Component
 * Shows proactive warnings about potential disconnections
 */
export const DisconnectWarning: React.FC<{
  prediction?: DisconnectPrediction | null;
  onOptimize?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ prediction, onOptimize, onDismiss, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (prediction && prediction.countdown?.isActive) {
      setIsVisible(true);
      
      const interval = setInterval(() => {
        const remaining = prediction.countdown!.estimatedDisconnect.getTime() - Date.now();
        setTimeRemaining(Math.max(0, remaining));
        
        if (remaining <= 0) {
          setIsVisible(false);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
    }
  }, [prediction]);

  if (!prediction || !isVisible) return null;

  const riskLevel = prediction.probability >= 0.8 ? 'critical' : 
                   prediction.probability >= 0.6 ? 'high' : 'medium';
  
  const riskStyle = getRiskLevelStyle(prediction.probability);

  return (
    <div className={`p-4 rounded-lg border-2 shadow-lg transition-all duration-300 ${riskStyle} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              riskLevel === 'critical' ? 'bg-red-500 animate-pulse' :
              riskLevel === 'high' ? 'bg-yellow-500 animate-pulse' :
              'bg-blue-500'
            }`} />
            <h3 className="font-semibold text-sm">
              {riskLevel === 'critical' ? 'Critical Connection Warning' :
               riskLevel === 'high' ? 'Connection Warning' :
               'Connection Notice'}
            </h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                Disconnect Probability: <strong>{Math.round(prediction.probability * 100)}%</strong>
              </span>
              {timeRemaining > 0 && (
                <span className="text-sm font-mono">
                  ETA: <strong>{formatTime(timeRemaining)}</strong>
                </span>
              )}
            </div>
            
            {prediction.causes.length > 0 && (
              <div className="text-xs">
                <span className="font-medium">Likely causes: </span>
                {prediction.causes.slice(0, 2).map(cause => cause.type.replace('_', ' ')).join(', ')}
              </div>
            )}
            
            {prediction.recommendations.length > 0 && (
              <div className="text-xs">
                <span className="font-medium">Recommendation: </span>
                {prediction.recommendations[0]}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 ml-4">
          {onOptimize && (
            <button
              onClick={onOptimize}
              className="px-3 py-1 text-xs bg-white bg-opacity-80 hover:bg-opacity-100 rounded transition-colors"
            >
              Optimize
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-2 py-1 text-xs bg-white bg-opacity-60 hover:bg-opacity-80 rounded transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Progress bar for countdown */}
      {timeRemaining > 0 && prediction.countdown && (
        <div className="mt-3">
          <div className="w-full bg-white bg-opacity-40 rounded-full h-1.5">
            <div 
              className="h-1.5 rounded-full transition-all duration-1000 ease-linear bg-current"
              style={{ 
                width: `${Math.max(0, (timeRemaining / prediction.timeToDisconnect) * 100)}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Connection Forecast Component
 * Shows predictive insights about connection quality trends
 */
export const ConnectionForecast: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { patterns, patternStats, hasProblematicPatterns } = useConnectionPatterns();
  const { predictions, avgRiskLevel } = useDisconnectPrediction();
  
  const forecast = useMemo(() => {
    const stabilityScore = patternStats.stablePatterns / Math.max(patternStats.totalPatterns, 1);
    const volatilityScore = patternStats.volatilePatterns / Math.max(patternStats.totalPatterns, 1);
    
    let outlook: 'stable' | 'improving' | 'declining' | 'volatile' = 'stable';
    let confidence = 0.5;
    
    if (volatilityScore > 0.5) {
      outlook = 'volatile';
      confidence = 0.8;
    } else if (stabilityScore > 0.7) {
      outlook = 'stable';
      confidence = 0.9;
    } else if (avgRiskLevel > 0.6) {
      outlook = 'declining';
      confidence = 0.7;
    } else if (avgRiskLevel < 0.3 && stabilityScore > 0.5) {
      outlook = 'improving';
      confidence = 0.6;
    }
    
    return { outlook, confidence, stabilityScore, volatilityScore };
  }, [patternStats, avgRiskLevel]);

  const getOutlookColor = (outlook: string) => {
    switch (outlook) {
      case 'stable': return 'text-green-600 bg-green-50';
      case 'improving': return 'text-blue-600 bg-blue-50';
      case 'declining': return 'text-red-600 bg-red-50';
      case 'volatile': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getOutlookIcon = (outlook: string) => {
    switch (outlook) {
      case 'stable': return '📊';
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'volatile': return '⚡';
      default: return '🔍';
    }
  };

  return (
    <div className={`p-4 bg-white rounded-lg border shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-800">Connection Forecast</h3>
      
      <div className="space-y-3">
        {/* Primary outlook */}
        <div className={`p-3 rounded-lg ${getOutlookColor(forecast.outlook)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getOutlookIcon(forecast.outlook)}</span>
            <span className="font-medium capitalize">{forecast.outlook} Connection</span>
          </div>
          <div className="text-xs opacity-80">
            Confidence: {Math.round(forecast.confidence * 100)}%
          </div>
        </div>
        
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-600">Stability</div>
            <div className="text-lg font-bold text-gray-800">
              {Math.round(forecast.stabilityScore * 100)}%
            </div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-600">Risk Level</div>
            <div className="text-lg font-bold text-gray-800">
              {Math.round(avgRiskLevel * 100)}%
            </div>
          </div>
        </div>
        
        {/* Pattern insights */}
        {patternStats.totalPatterns > 0 && (
          <div className="text-xs text-gray-600">
            <div className="font-medium mb-1">Pattern Analysis:</div>
            <div className="space-y-0.5">
              {patternStats.stablePatterns > 0 && (
                <div>• {patternStats.stablePatterns} stable pattern{patternStats.stablePatterns !== 1 ? 's' : ''}</div>
              )}
              {patternStats.volatilePatterns > 0 && (
                <div>• {patternStats.volatilePatterns} volatile pattern{patternStats.volatilePatterns !== 1 ? 's' : ''}</div>
              )}
              {patternStats.periodicPatterns > 0 && (
                <div>• {patternStats.periodicPatterns} periodic issue{patternStats.periodicPatterns !== 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
        )}
        
        {/* Recommendations */}
        {hasProblematicPatterns && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="font-medium text-yellow-800 mb-1">⚠️ Attention Needed</div>
            <div className="text-yellow-700">
              Connection patterns indicate potential issues. Consider optimizing your connection.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Reconnection Assistant Component
 * Provides intelligent reconnection guidance
 */
export const ReconnectionAssistant: React.FC<{
  isReconnecting?: boolean;
  disconnectCause?: string;
  networkQuality?: number;
  onReconnect?: (strategy: ReconnectionStrategy) => void;
  className?: string;
}> = ({ 
  isReconnecting = false, 
  disconnectCause = 'unknown',
  networkQuality = 50,
  onReconnect,
  className = '' 
}) => {
  const { selectedStrategy, availableStrategies, selectStrategy, getBestStrategy } = useReconnectionStrategy();
  const [customStrategy, setCustomStrategy] = useState<ReconnectionStrategy | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (disconnectCause && !isReconnecting) {
      const strategy = selectStrategy(disconnectCause, networkQuality);
      setCustomStrategy(strategy);
    }
  }, [disconnectCause, networkQuality, isReconnecting, selectStrategy]);

  const recommendedStrategy = customStrategy || selectedStrategy || getBestStrategy;
  
  const handleReconnect = useCallback((strategy: ReconnectionStrategy) => {
    if (onReconnect) {
      onReconnect(strategy);
    }
  }, [onReconnect]);

  const getStrategyIcon = (strategy: ReconnectionStrategy) => {
    switch (strategy.type) {
      case 'immediate': return '⚡';
      case 'progressive': return '📶';
      case 'adaptive': return '🧠';
      case 'parallel': return '🔄';
      default: return '🔌';
    }
  };

  const getStrategyDescription = (strategy: ReconnectionStrategy) => {
    switch (strategy.type) {
      case 'immediate': return 'Quick reconnection attempt';
      case 'progressive': return 'Gradual quality restoration';
      case 'adaptive': return 'AI-optimized reconnection';
      case 'parallel': return 'Multiple simultaneous attempts';
      default: return 'Standard reconnection';
    }
  };

  return (
    <div className={`p-4 bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Reconnection Assistant</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      
      {recommendedStrategy && (
        <div className="space-y-3">
          {/* Recommended strategy */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStrategyIcon(recommendedStrategy)}</span>
                <div>
                  <div className="font-medium text-blue-800 text-sm">
                    {recommendedStrategy.name}
                  </div>
                  <div className="text-xs text-blue-600">
                    {getStrategyDescription(recommendedStrategy)}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-blue-600">
                <div>Success: {Math.round(recommendedStrategy.successRate * 100)}%</div>
                <div>Avg: {formatTime(recommendedStrategy.avgReconnectTime)}</div>
              </div>
            </div>
            
            {!isReconnecting && onReconnect && (
              <button
                onClick={() => handleReconnect(recommendedStrategy)}
                className="w-full py-2 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Reconnect with {recommendedStrategy.name}
              </button>
            )}
            
            {isReconnecting && (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-600">Reconnecting...</span>
              </div>
            )}
          </div>
          
          {/* Additional strategies (when expanded) */}
          {isExpanded && availableStrategies.length > 1 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600">Alternative Strategies:</div>
              {availableStrategies
                .filter(s => s.id !== recommendedStrategy.id)
                .slice(0, 3)
                .map(strategy => (
                  <div key={strategy.id} className="p-2 bg-gray-50 rounded text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getStrategyIcon(strategy)}</span>
                        <span className="font-medium">{strategy.name}</span>
                      </div>
                      <div className="text-right text-gray-600">
                        <div>{Math.round(strategy.successRate * 100)}%</div>
                      </div>
                    </div>
                    {!isReconnecting && onReconnect && (
                      <button
                        onClick={() => handleReconnect(strategy)}
                        className="mt-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        Use this strategy
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
          
          {/* Context information */}
          {isExpanded && (
            <div className="text-xs text-gray-600 space-y-1">
              <div>Disconnect cause: <span className="font-medium">{disconnectCause.replace('_', ' ')}</span></div>
              <div>Network quality: <span className="font-medium">{networkQuality}%</span></div>
              {recommendedStrategy.timesUsed > 0 && (
                <div>Strategy used: <span className="font-medium">{recommendedStrategy.timesUsed} times</span></div>
              )}
            </div>
          )}
        </div>
      )}
      
      {!recommendedStrategy && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No reconnection strategies available
        </div>
      )}
    </div>
  );
};

/**
 * Network Insights Component
 * Shows pattern-based insights and recommendations
 */
export const NetworkInsights: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { patterns, activePatterns, patternStats } = useConnectionPatterns();
  const { notifications } = useProactiveNotifications();
  
  const insights = useMemo(() => {
    const insights: Array<{
      type: 'info' | 'warning' | 'tip';
      icon: string;
      title: string;
      description: string;
    }> = [];
    
    // Pattern-based insights
    if (patternStats.stablePatterns > patternStats.volatilePatterns) {
      insights.push({
        type: 'info',
        icon: '✅',
        title: 'Stable Connection',
        description: 'Your connection shows consistent quality patterns'
      });
    }
    
    if (patternStats.periodicPatterns > 0) {
      insights.push({
        type: 'warning',
        icon: '🔄',
        title: 'Periodic Issues',
        description: 'Regular disconnections detected - check for interference sources'
      });
    }
    
    if (patternStats.volatilePatterns > 2) {
      insights.push({
        type: 'warning',
        icon: '⚡',
        title: 'Unstable Patterns',
        description: 'Connection quality varies significantly - consider network optimization'
      });
    }
    
    // Time-based insights
    const timeBasedPatterns = patterns.filter(p => p.type === 'time_based');
    if (timeBasedPatterns.length > 0) {
      const pattern = timeBasedPatterns[0];
      insights.push({
        type: 'tip',
        icon: '🕒',
        title: 'Time-Based Issues',
        description: `Connection issues commonly occur at ${pattern.characteristics.timeOfDay || 'certain times'}`
      });
    }
    
    // Trend insights
    const improvingPatterns = patterns.filter(p => p.type === 'improving');
    const degradingPatterns = patterns.filter(p => p.type === 'degrading');
    
    if (improvingPatterns.length > degradingPatterns.length) {
      insights.push({
        type: 'info',
        icon: '📈',
        title: 'Improving Trends',
        description: 'Your connection quality is generally improving over time'
      });
    } else if (degradingPatterns.length > 0) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Quality Decline',
        description: 'Connection quality is trending downward - investigate potential causes'
      });
    }
    
    // General tips
    if (insights.length === 0) {
      insights.push({
        type: 'tip',
        icon: '💡',
        title: 'Monitoring Active',
        description: 'Predictive intelligence is learning your connection patterns'
      });
    }
    
    return insights.slice(0, 3); // Limit to 3 insights
  }, [patterns, patternStats]);
  
  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'tip': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={`p-4 bg-white rounded-lg border shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-800">Network Insights</h3>
      
      <div className="space-y-2">
        {insights.map((insight, index) => (
          <div key={index} className={`p-3 border rounded-lg ${getInsightStyle(insight.type)}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs mb-1">{insight.title}</div>
                <div className="text-xs opacity-90">{insight.description}</div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Pattern statistics */}
        {patternStats.totalPatterns > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">Pattern Summary:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>Total: {patternStats.totalPatterns}</div>
                <div>Active: {activePatterns.length}</div>
                <div>Stable: {patternStats.stablePatterns}</div>
                <div>Issues: {patternStats.volatilePatterns + patternStats.periodicPatterns}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Predictive Notification Toast
 * Shows proactive notifications as toast messages
 */
export const PredictiveNotificationToast: React.FC<{
  notification: ProactiveNotification;
  onAction?: (actionId: string) => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ notification, onAction, onDismiss, className = '' }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (notification.expiresAt) {
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, notification.expiresAt.getTime() - Date.now());
      
      return () => clearTimeout(timeout);
    }
  }, [notification]);
  
  const getPriorityStyle = (priority: NotificationPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800';
      case 'urgent': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'info': return 'bg-blue-100 border-blue-500 text-blue-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };
  
  const getPriorityIcon = (priority: NotificationPriority) => {
    switch (priority) {
      case 'critical': return '🚨';
      case 'urgent': return '⚠️';
      case 'warning': return '💭';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={`p-4 rounded-lg border-l-4 shadow-lg ${getPriorityStyle(notification.priority)} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-lg">{getPriorityIcon(notification.priority)}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-sm mt-1">{notification.message}</p>
            
            {notification.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {notification.actions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => onAction?.(action.id)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      action.primary 
                        ? 'bg-white bg-opacity-90 hover:bg-opacity-100 font-medium' 
                        : 'bg-white bg-opacity-60 hover:bg-opacity-80'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 text-lg leading-none hover:opacity-70 transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Combined Predictive Dashboard
 * Integrates all predictive components
 */
export const PredictiveDashboard: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { highestRisk } = useDisconnectPrediction();
  const { notifications, dismissNotification } = useProactiveNotifications();
  
  const activeNotifications = notifications.filter(n => 
    !n.dismissed && 
    (!n.expiresAt || n.expiresAt > new Date())
  );
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active notifications */}
      {activeNotifications.slice(0, 2).map(notification => (
        <PredictiveNotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}
      
      {/* Disconnect warning */}
      {highestRisk && (
        <DisconnectWarning prediction={highestRisk} />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConnectionForecast />
        <NetworkInsights />
      </div>
      
      <ReconnectionAssistant />
    </div>
  );
};