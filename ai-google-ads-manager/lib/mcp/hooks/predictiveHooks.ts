/**
 * React Hooks for Predictive Connection Intelligence
 * Phase 5: Predictive Connection Intelligence - Subtask 28.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConnectionPattern,
  DisconnectPrediction,
  ReconnectionStrategy,
  ProactiveNotification,
  PredictiveEngineConfig,
  PredictiveIntelligenceState,
  PatternType,
  NotificationPriority,
  StrategyType
} from '../types/predictive';
import { ConnectionState, NetworkQuality } from '../types/connection';
import { ServerHealthState } from '../types/serverHealth';
import { PredictiveEngine, getGlobalPredictiveEngine, createPredictiveEngine } from '../utils/predictiveEngine';

/**
 * Main hook for comprehensive predictive intelligence
 */
export function usePredictiveEngine(config?: Partial<PredictiveEngineConfig>) {
  const [state, setState] = useState<PredictiveIntelligenceState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<PredictiveEngine | null>(null);

  // Initialize engine
  useEffect(() => {
    try {
      if (!engineRef.current) {
        engineRef.current = config ? createPredictiveEngine(config) : getGlobalPredictiveEngine();
        
        // Set up callbacks
        engineRef.current.setCallbacks({
          onPatternDiscovered: (pattern) => {
            setState(prev => prev ? {
              ...prev,
              patterns: [...prev.patterns, pattern],
              lastUpdate: new Date()
            } : null);
          },
          onDisconnectPredicted: (prediction) => {
            setState(prev => prev ? {
              ...prev,
              activePredictions: [...prev.activePredictions, prediction],
              lastUpdate: new Date()
            } : null);
          },
          onStrategySelected: (strategy) => {
            setState(prev => prev ? {
              ...prev,
              selectedStrategy: strategy,
              lastUpdate: new Date()
            } : null);
          },
          onNotificationSent: (notification) => {
            setState(prev => prev ? {
              ...prev,
              notifications: [...prev.notifications, notification],
              lastUpdate: new Date()
            } : null);
          },
          onModelUpdated: (accuracy, version) => {
            setState(prev => prev ? {
              ...prev,
              learningData: {
                ...prev.learningData,
                modelAccuracy: accuracy,
                modelVersion: version
              },
              lastUpdate: new Date()
            } : null);
          }
        });

        setState(engineRef.current.getState());
        setIsInitialized(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize predictive engine');
    }
  }, [config]);

  // Update state periodically
  useEffect(() => {
    if (!engineRef.current || !isInitialized) return;

    const interval = setInterval(() => {
      setState(engineRef.current!.getState());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Update connection data
  const updateConnectionData = useCallback((
    connectionState: ConnectionState,
    networkQuality: NetworkQuality,
    serverHealth: ServerHealthState
  ) => {
    if (engineRef.current) {
      engineRef.current.updateConnectionData(connectionState, networkQuality, serverHealth);
    }
  }, []);

  // Select reconnection strategy
  const selectReconnectionStrategy = useCallback((
    disconnectCause: string,
    networkQuality: number,
    attemptCount: number = 0
  ): ReconnectionStrategy | null => {
    if (!engineRef.current) return null;
    return engineRef.current.selectReconnectionStrategy(disconnectCause, networkQuality, attemptCount);
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    if (engineRef.current) {
      engineRef.current.dismissNotification(notificationId);
      setState(engineRef.current.getState());
    }
  }, []);

  // Acknowledge notification
  const acknowledgeNotification = useCallback((notificationId: string) => {
    if (engineRef.current) {
      engineRef.current.acknowledgeNotification(notificationId);
      setState(engineRef.current.getState());
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<PredictiveEngineConfig>) => {
    if (engineRef.current) {
      engineRef.current.updateConfig(newConfig);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (engineRef.current && config) {
        // Only destroy if we created a custom instance
        engineRef.current.destroy();
      }
    };
  }, [config]);

  return {
    state,
    isInitialized,
    error,
    updateConnectionData,
    selectReconnectionStrategy,
    dismissNotification,
    acknowledgeNotification,
    updateConfig,
    activePatterns: state?.patterns.filter(p => 
      Date.now() - p.lastSeen.getTime() < 300000
    ) || [],
    activePredictions: state?.activePredictions || [],
    notifications: state?.notifications.filter(n => !n.dismissed) || [],
    selectedStrategy: state?.selectedStrategy,
    modelAccuracy: state?.learningData.modelAccuracy || 0
  };
}

/**
 * Hook for disconnect prediction functionality
 */
export function useDisconnectPrediction() {
  const [predictions, setPredictions] = useState<DisconnectPrediction[]>([]);
  const [highestRisk, setHighestRisk] = useState<DisconnectPrediction | null>(null);
  const [countdowns, setCountdowns] = useState<Map<string, number>>(new Map());
  const engineRef = useRef<PredictiveEngine | null>(null);

  useEffect(() => {
    engineRef.current = getGlobalPredictiveEngine();
    
    engineRef.current.setCallbacks({
      onDisconnectPredicted: (prediction) => {
        setPredictions(prev => [...prev, prediction]);
        
        // Update highest risk prediction
        setHighestRisk(prev => {
          if (!prev || prediction.probability > prev.probability) {
            return prediction;
          }
          return prev;
        });
      }
    });

    // Update predictions periodically
    const interval = setInterval(() => {
      const current = engineRef.current?.getActivePredictions() || [];
      setPredictions(current);
      
      if (current.length > 0) {
        const highest = current.reduce((max, pred) => 
          pred.probability > max.probability ? pred : max
        );
        setHighestRisk(highest);
      } else {
        setHighestRisk(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update countdowns for active predictions
  useEffect(() => {
    if (predictions.length === 0) return;

    const interval = setInterval(() => {
      const newCountdowns = new Map();
      
      predictions.forEach(prediction => {
        if (prediction.countdown?.isActive) {
          const remaining = prediction.countdown.estimatedDisconnect.getTime() - Date.now();
          if (remaining > 0) {
            newCountdowns.set(prediction.countdown.startTime.getTime().toString(), remaining);
          }
        }
      });
      
      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [predictions]);

  const getTimeToDisconnect = useCallback((prediction: DisconnectPrediction): number => {
    if (!prediction.countdown) return prediction.timeToDisconnect;
    return countdowns.get(prediction.countdown.startTime.getTime().toString()) || 0;
  }, [countdowns]);

  const getPredictionsByRisk = useCallback((minProbability: number = 0.5) => {
    return predictions
      .filter(p => p.probability >= minProbability)
      .sort((a, b) => b.probability - a.probability);
  }, [predictions]);

  const hasActiveWarnings = useCallback(() => {
    return predictions.some(p => p.probability >= 0.6);
  }, [predictions]);

  const hasCriticalWarnings = useCallback(() => {
    return predictions.some(p => p.probability >= 0.8);
  }, [predictions]);

  return {
    predictions,
    highestRisk,
    countdowns,
    getTimeToDisconnect,
    getPredictionsByRisk,
    hasActiveWarnings: hasActiveWarnings(),
    hasCriticalWarnings: hasCriticalWarnings(),
    totalPredictions: predictions.length,
    avgRiskLevel: predictions.length > 0 ? 
      predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length : 0
  };
}

/**
 * Hook for reconnection strategy management
 */
export function useReconnectionStrategy() {
  const [availableStrategies, setAvailableStrategies] = useState<ReconnectionStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<ReconnectionStrategy | null>(null);
  const [strategyHistory, setStrategyHistory] = useState<Array<{
    strategy: ReconnectionStrategy;
    timestamp: Date;
    success: boolean;
    reconnectTime?: number;
  }>>([]);
  const engineRef = useRef<PredictiveEngine | null>(null);

  useEffect(() => {
    engineRef.current = getGlobalPredictiveEngine();
    
    engineRef.current.setCallbacks({
      onStrategySelected: (strategy) => {
        setSelectedStrategy(strategy);
      }
    });

    // Get initial state
    const state = engineRef.current.getState();
    setAvailableStrategies(state.availableStrategies);
    setSelectedStrategy(state.selectedStrategy);
  }, []);

  const selectStrategy = useCallback((
    disconnectCause: string,
    networkQuality: number,
    attemptCount: number = 0
  ): ReconnectionStrategy | null => {
    if (!engineRef.current) return null;
    
    const strategy = engineRef.current.selectReconnectionStrategy(
      disconnectCause, 
      networkQuality, 
      attemptCount
    );
    
    if (strategy) {
      setSelectedStrategy(strategy);
    }
    
    return strategy;
  }, []);

  const recordStrategyResult = useCallback((
    strategy: ReconnectionStrategy,
    success: boolean,
    reconnectTime?: number
  ) => {
    setStrategyHistory(prev => [...prev, {
      strategy,
      timestamp: new Date(),
      success,
      reconnectTime
    }]);

    // Update strategy success rate
    setAvailableStrategies(prev => prev.map(s => {
      if (s.id === strategy.id) {
        const newTimesUsed = s.timesUsed + 1;
        const successCount = success ? 
          Math.round(s.successRate * s.timesUsed) + 1 : 
          Math.round(s.successRate * s.timesUsed);
        
        return {
          ...s,
          timesUsed: newTimesUsed,
          successRate: successCount / newTimesUsed,
          lastUsed: new Date(),
          avgReconnectTime: reconnectTime ? 
            (s.avgReconnectTime * s.timesUsed + reconnectTime) / newTimesUsed :
            s.avgReconnectTime
        };
      }
      return s;
    }));
  }, []);

  const getStrategyByType = useCallback((type: StrategyType): ReconnectionStrategy | null => {
    return availableStrategies.find(s => s.type === type) || null;
  }, [availableStrategies]);

  const getBestStrategy = useCallback((): ReconnectionStrategy | null => {
    if (availableStrategies.length === 0) return null;
    
    return availableStrategies.reduce((best, current) => {
      const bestScore = (best.successRate * 0.7) + (best.priority / 10 * 0.3);
      const currentScore = (current.successRate * 0.7) + (current.priority / 10 * 0.3);
      return currentScore > bestScore ? current : best;
    });
  }, [availableStrategies]);

  const getStrategyStats = useCallback((strategyId: string) => {
    const history = strategyHistory.filter(h => h.strategy.id === strategyId);
    const successCount = history.filter(h => h.success).length;
    
    return {
      totalUses: history.length,
      successRate: history.length > 0 ? successCount / history.length : 0,
      avgReconnectTime: history.length > 0 ? 
        history.reduce((sum, h) => sum + (h.reconnectTime || 0), 0) / history.length : 0,
      lastUsed: history.length > 0 ? history[history.length - 1].timestamp : null
    };
  }, [strategyHistory]);

  return {
    availableStrategies,
    selectedStrategy,
    strategyHistory,
    selectStrategy,
    recordStrategyResult,
    getStrategyByType,
    getBestStrategy: getBestStrategy(),
    getStrategyStats,
    hasStrategies: availableStrategies.length > 0
  };
}

/**
 * Hook for connection pattern analysis
 */
export function useConnectionPatterns() {
  const [patterns, setPatterns] = useState<ConnectionPattern[]>([]);
  const [activePatterns, setActivePatterns] = useState<ConnectionPattern[]>([]);
  const [patternStats, setPatternStats] = useState({
    totalPatterns: 0,
    stablePatterns: 0,
    volatilePatterns: 0,
    periodicPatterns: 0,
    trendPatterns: 0
  });
  const engineRef = useRef<PredictiveEngine | null>(null);

  useEffect(() => {
    engineRef.current = getGlobalPredictiveEngine();
    
    engineRef.current.setCallbacks({
      onPatternDiscovered: (pattern) => {
        setPatterns(prev => [...prev, pattern]);
      }
    });

    // Update patterns periodically
    const interval = setInterval(() => {
      const state = engineRef.current?.getState();
      if (state) {
        setPatterns(state.patterns);
        
        const active = state.patterns.filter(p => 
          Date.now() - p.lastSeen.getTime() < 300000 // 5 minutes
        );
        setActivePatterns(active);
        
        // Calculate stats
        setPatternStats({
          totalPatterns: state.patterns.length,
          stablePatterns: state.patterns.filter(p => p.type === 'stable').length,
          volatilePatterns: state.patterns.filter(p => p.type === 'volatile').length,
          periodicPatterns: state.patterns.filter(p => p.type === 'periodic_drops').length,
          trendPatterns: state.patterns.filter(p => 
            p.type === 'improving' || p.type === 'degrading'
          ).length
        });
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getPatternsByType = useCallback((type: PatternType): ConnectionPattern[] => {
    return patterns.filter(p => p.type === type);
  }, [patterns]);

  const getPatternsByConfidence = useCallback((minConfidence: number = 0.7): ConnectionPattern[] => {
    return patterns.filter(p => p.confidence >= minConfidence);
  }, [patterns]);

  const getMostRecentPattern = useCallback((): ConnectionPattern | null => {
    if (patterns.length === 0) return null;
    return patterns.reduce((latest, current) => 
      current.lastSeen > latest.lastSeen ? current : latest
    );
  }, [patterns]);

  const getPatternTrends = useCallback(() => {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    const lastHour = patterns.filter(p => p.lastSeen.getTime() > hourAgo);
    const lastDay = patterns.filter(p => p.lastSeen.getTime() > dayAgo);
    
    return {
      hourlyPatterns: lastHour.length,
      dailyPatterns: lastDay.length,
      recentQuality: lastHour.length > 0 ? 
        lastHour.reduce((sum, p) => sum + p.characteristics.qualityScore, 0) / lastHour.length : 0,
      stabilityTrend: lastHour.filter(p => p.type === 'stable').length / Math.max(lastHour.length, 1)
    };
  }, [patterns]);

  const hasProblematicPatterns = useCallback((): boolean => {
    return activePatterns.some(p => 
      p.type === 'volatile' || 
      p.type === 'degrading' || 
      p.type === 'periodic_drops'
    );
  }, [activePatterns]);

  return {
    patterns,
    activePatterns,
    patternStats,
    getPatternsByType,
    getPatternsByConfidence,
    getMostRecentPattern: getMostRecentPattern(),
    getPatternTrends: getPatternTrends(),
    hasProblematicPatterns: hasProblematicPatterns(),
    hasPatterns: patterns.length > 0,
    avgConfidence: patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0
  };
}

/**
 * Hook for proactive notification management
 */
export function useProactiveNotifications() {
  const [notifications, setNotifications] = useState<ProactiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsByPriority, setNotificationsByPriority] = useState<
    Record<NotificationPriority, ProactiveNotification[]>
  >({
    info: [],
    warning: [],
    urgent: [],
    critical: []
  });
  const engineRef = useRef<PredictiveEngine | null>(null);

  useEffect(() => {
    engineRef.current = getGlobalPredictiveEngine();
    
    engineRef.current.setCallbacks({
      onNotificationSent: (notification) => {
        setNotifications(prev => [...prev, notification]);
      }
    });

    // Update notifications periodically
    const interval = setInterval(() => {
      const current = engineRef.current?.getNotifications() || [];
      setNotifications(current);
      
      const unread = current.filter(n => !n.acknowledged && !n.dismissed).length;
      setUnreadCount(unread);
      
      // Group by priority
      const grouped: Record<NotificationPriority, ProactiveNotification[]> = {
        info: [],
        warning: [],
        urgent: [],
        critical: []
      };
      
      current.forEach(notification => {
        grouped[notification.priority].push(notification);
      });
      
      setNotificationsByPriority(grouped);
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const dismissNotification = useCallback((notificationId: string) => {
    if (engineRef.current) {
      engineRef.current.dismissNotification(notificationId);
    }
  }, []);

  const acknowledgeNotification = useCallback((notificationId: string) => {
    if (engineRef.current) {
      engineRef.current.acknowledgeNotification(notificationId);
    }
  }, []);

  const getNotificationsByType = useCallback((type: string): ProactiveNotification[] => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  const getActiveNotifications = useCallback((): ProactiveNotification[] => {
    const now = new Date();
    return notifications.filter(n => 
      !n.dismissed && 
      (!n.expiresAt || n.expiresAt > now)
    );
  }, [notifications]);

  const getCriticalNotifications = useCallback((): ProactiveNotification[] => {
    return notifications.filter(n => 
      n.priority === 'critical' && 
      !n.dismissed && 
      !n.acknowledged
    );
  }, [notifications]);

  const dismissAll = useCallback(() => {
    notifications.forEach(notification => {
      if (!notification.dismissed) {
        dismissNotification(notification.id);
      }
    });
  }, [notifications, dismissNotification]);

  const acknowledgeAll = useCallback(() => {
    notifications.forEach(notification => {
      if (!notification.acknowledged) {
        acknowledgeNotification(notification.id);
      }
    });
  }, [notifications, acknowledgeNotification]);

  return {
    notifications,
    unreadCount,
    notificationsByPriority,
    dismissNotification,
    acknowledgeNotification,
    getNotificationsByType,
    getActiveNotifications: getActiveNotifications(),
    getCriticalNotifications: getCriticalNotifications(),
    dismissAll,
    acknowledgeAll,
    hasUnread: unreadCount > 0,
    hasCritical: notificationsByPriority.critical.length > 0,
    totalNotifications: notifications.length
  };
}

/**
 * Hook for machine learning model monitoring
 */
export function useMLModelMonitoring() {
  const [modelAccuracy, setModelAccuracy] = useState(0);
  const [modelVersion, setModelVersion] = useState('1.0.0');
  const [trainingDataSize, setTrainingDataSize] = useState(0);
  const [predictionHistory, setPredictionHistory] = useState<any[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const engineRef = useRef<PredictiveEngine | null>(null);

  useEffect(() => {
    engineRef.current = getGlobalPredictiveEngine();
    
    engineRef.current.setCallbacks({
      onModelUpdated: (accuracy, version) => {
        setModelAccuracy(accuracy);
        setModelVersion(version);
        setIsLearning(false);
      }
    });

    // Update model stats periodically
    const interval = setInterval(() => {
      const state = engineRef.current?.getState();
      if (state) {
        setModelAccuracy(state.learningData.modelAccuracy);
        setModelVersion(state.learningData.modelVersion);
        setTrainingDataSize(state.learningData.trainingPoints.length);
        setPredictionHistory(state.learningData.predictionHistory);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getModelStats = useCallback(() => {
    return {
      accuracy: modelAccuracy,
      version: modelVersion,
      trainingDataSize,
      predictionCount: predictionHistory.length,
      avgAccuracy: predictionHistory.length > 0 ? 
        predictionHistory.reduce((sum, p) => sum + (p.accuracy || 0), 0) / predictionHistory.length : 0
    };
  }, [modelAccuracy, modelVersion, trainingDataSize, predictionHistory]);

  const getAccuracyTrend = useCallback(() => {
    if (predictionHistory.length < 2) return 0;
    
    const recent = predictionHistory.slice(-10);
    const older = predictionHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, p) => sum + (p.accuracy || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + (p.accuracy || 0), 0) / older.length;
    
    return recentAvg - olderAvg;
  }, [predictionHistory]);

  return {
    modelAccuracy,
    modelVersion,
    trainingDataSize,
    predictionHistory,
    isLearning,
    getModelStats: getModelStats(),
    accuracyTrend: getAccuracyTrend(),
    isModelReady: modelAccuracy > 0.5,
    hasTrainingData: trainingDataSize > 0
  };
}

/**
 * Hook for integrated predictive intelligence with existing monitoring
 */
export function usePredictiveIntegration(
  connectionState: ConnectionState | null,
  networkQuality: NetworkQuality | null,
  serverHealth: ServerHealthState | null
) {
  const predictiveEngine = usePredictiveEngine();
  const disconnectPrediction = useDisconnectPrediction();
  const reconnectionStrategy = useReconnectionStrategy();
  const patterns = useConnectionPatterns();
  const notifications = useProactiveNotifications();

  // Auto-update predictive engine with connection data
  useEffect(() => {
    if (connectionState && networkQuality && serverHealth && predictiveEngine.isInitialized) {
      predictiveEngine.updateConnectionData(connectionState, networkQuality, serverHealth);
    }
  }, [connectionState, networkQuality, serverHealth, predictiveEngine]);

  const getHealthInsights = useCallback(() => {
    return {
      riskLevel: disconnectPrediction.avgRiskLevel,
      hasPatternIssues: patterns.hasProblematicPatterns,
      needsAttention: notifications.hasCritical || disconnectPrediction.hasCriticalWarnings,
      modelConfidence: predictiveEngine.modelAccuracy,
      recommendedAction: disconnectPrediction.highestRisk?.recommendations[0] || 'Monitor connection quality'
    };
  }, [disconnectPrediction, patterns, notifications, predictiveEngine]);

  return {
    ...predictiveEngine,
    disconnectPrediction,
    reconnectionStrategy,
    patterns,
    notifications,
    insights: getHealthInsights(),
    isFullyOperational: predictiveEngine.isInitialized && !predictiveEngine.error
  };
}