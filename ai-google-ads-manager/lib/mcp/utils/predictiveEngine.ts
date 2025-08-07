/**
 * Predictive Engine for Connection Intelligence
 * Phase 5: Predictive Connection Intelligence - Subtask 28.6
 */

import {
  ConnectionPattern,
  DisconnectPrediction,
  ReconnectionStrategy,
  ProactiveNotification,
  PredictiveEngineConfig,
  PredictiveIntelligenceState,
  PatternType,
  StrategyType,
  NotificationType,
  NotificationPriority,
  TrainingPoint,
  PredictionResult,
  PatternDiscoveryCallback,
  DisconnectPredictionCallback,
  StrategySelectionCallback,
  NotificationCallback,
  ModelUpdateCallback,
  DEFAULT_PREDICTIVE_CONFIG,
  PatternCharacteristics,
  DisconnectCause,
  MLFeature
} from '../types/predictive';

import { ConnectionState, NetworkQuality } from '../types/connection';
import { ServerHealthState } from '../types/serverHealth';
import { ConnectionEvent, AnalyticsSummary } from '../types/analytics';

/**
 * Advanced Predictive Engine for Connection Intelligence
 * 
 * Provides machine learning-based pattern recognition, disconnect prediction,
 * intelligent reconnection strategies, and proactive user notifications.
 */
export class PredictiveEngine {
  private config: PredictiveEngineConfig;
  private state: PredictiveIntelligenceState;
  private callbacks: {
    onPatternDiscovered?: PatternDiscoveryCallback;
    onDisconnectPredicted?: DisconnectPredictionCallback;
    onStrategySelected?: StrategySelectionCallback;
    onNotificationSent?: NotificationCallback;
    onModelUpdated?: ModelUpdateCallback;
  };
  
  private analysisTimer: NodeJS.Timeout | null = null;
  private predictionTimer: NodeJS.Timeout | null = null;
  private modelTimer: NodeJS.Timeout | null = null;
  private notificationTimer: NodeJS.Timeout | null = null;
  
  private connectionHistory: ConnectionEvent[] = [];
  private qualityHistory: Array<{ timestamp: Date; quality: number; latency: number; bandwidth: number }> = [];
  private patternBuffer: Array<{ timestamp: Date; metrics: Record<string, any> }> = [];

  constructor(config: Partial<PredictiveEngineConfig> = {}) {
    this.config = { ...DEFAULT_PREDICTIVE_CONFIG, ...config };
    this.callbacks = {};
    
    this.state = {
      patterns: [],
      activePredictions: [],
      selectedStrategy: null,
      availableStrategies: this.initializeStrategies(),
      notifications: [],
      learningData: {
        trainingPoints: [],
        modelAccuracy: 0,
        predictionHistory: [],
        featureImportance: {},
        modelVersion: '1.0.0'
      },
      isEnabled: true,
      lastUpdate: new Date()
    };

    this.initializeEngine();
  }

  /**
   * Initialize the predictive engine with timers and initial data
   */
  private initializeEngine(): void {
    if (this.config.patternAnalysis.enabled) {
      this.analysisTimer = setInterval(
        () => this.analyzePatterns(),
        this.config.patternAnalysis.updateInterval
      );
    }

    if (this.config.disconnectPrediction.enabled) {
      this.predictionTimer = setInterval(
        () => this.predictDisconnection(),
        5000 // Check every 5 seconds
      );
    }

    if (this.config.machineLearning.enabled) {
      this.modelTimer = setInterval(
        () => this.updateMLModel(),
        this.config.machineLearning.retrainingInterval
      );
    }

    this.notificationTimer = setInterval(
      () => this.processNotifications(),
      10000 // Process notifications every 10 seconds
    );
  }

  /**
   * Initialize default reconnection strategies
   */
  private initializeStrategies(): ReconnectionStrategy[] {
    return [
      {
        id: 'immediate',
        name: 'Immediate Reconnect',
        type: 'immediate',
        priority: 8,
        conditions: [
          { type: 'disconnect_cause', operator: 'equals', value: 'connection_timeout', weight: 0.8 }
        ],
        parameters: {
          initialDelay: 0,
          maxAttempts: 3,
          timeout: 5000
        },
        successRate: 0.7,
        avgReconnectTime: 2000,
        lastUsed: new Date(),
        timesUsed: 0
      },
      {
        id: 'progressive',
        name: 'Progressive Reconnect',
        type: 'progressive',
        priority: 7,
        conditions: [
          { type: 'network_quality', operator: 'less_than', value: 50, weight: 0.9 }
        ],
        parameters: {
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 1.5,
          maxAttempts: 5,
          qualityThreshold: 60
        },
        successRate: 0.85,
        avgReconnectTime: 8000,
        lastUsed: new Date(),
        timesUsed: 0
      },
      {
        id: 'adaptive',
        name: 'Adaptive Reconnect',
        type: 'adaptive',
        priority: 9,
        conditions: [
          { type: 'pattern_type', operator: 'contains', value: 'volatile', weight: 0.8 }
        ],
        parameters: {
          initialDelay: 2000,
          maxDelay: 60000,
          backoffFactor: 2,
          maxAttempts: 10,
          adaptiveFactors: {
            networkTypeWeight: 0.8,
            timeOfDayWeight: 0.6,
            historicalSuccessWeight: 0.9,
            currentQualityWeight: 0.7,
            serverHealthWeight: 0.8
          }
        },
        successRate: 0.92,
        avgReconnectTime: 12000,
        lastUsed: new Date(),
        timesUsed: 0
      },
      {
        id: 'parallel',
        name: 'Parallel Reconnect',
        type: 'parallel',
        priority: 6,
        conditions: [
          { type: 'reconnect_attempts', operator: 'greater_than', value: 3, weight: 0.7 }
        ],
        parameters: {
          parallelAttempts: 3,
          timeout: 8000,
          maxAttempts: 2
        },
        successRate: 0.75,
        avgReconnectTime: 6000,
        lastUsed: new Date(),
        timesUsed: 0
      }
    ];
  }

  /**
   * Update connection data for analysis
   */
  public updateConnectionData(
    connectionState: ConnectionState,
    networkQuality: NetworkQuality,
    serverHealth: ServerHealthState
  ): void {
    const timestamp = new Date();
    
    // Add to connection history
    this.connectionHistory.push({
      id: `${timestamp.getTime()}`,
      type: connectionState.status === 'connected' ? 'connection_established' : 'connection_lost',
      timestamp,
      connectionId: connectionState.connectionId || 'unknown',
      quality: networkQuality.overall,
      latency: connectionState.latency || 0,
      bandwidth: networkQuality.bandwidth?.download || 0,
      serverHealth: serverHealth.overall,
      metadata: {
        networkType: networkQuality.networkType,
        serverStatus: serverHealth.status
      }
    });

    // Add to quality history
    this.qualityHistory.push({
      timestamp,
      quality: networkQuality.overall,
      latency: connectionState.latency || 0,
      bandwidth: networkQuality.bandwidth?.download || 0
    });

    // Add to pattern buffer
    this.patternBuffer.push({
      timestamp,
      metrics: {
        quality: networkQuality.overall,
        latency: connectionState.latency || 0,
        bandwidth: networkQuality.bandwidth?.download || 0,
        serverHealth: serverHealth.overall,
        isConnected: connectionState.status === 'connected'
      }
    });

    // Limit buffer sizes
    this.limitBufferSizes();

    // Add training point
    this.addTrainingPoint(connectionState, networkQuality, serverHealth);
  }

  /**
   * Analyze connection patterns using time-series analysis
   */
  private analyzePatterns(): void {
    if (this.patternBuffer.length < this.config.patternAnalysis.minPatternLength) {
      return;
    }

    const patterns = this.detectPatterns();
    
    patterns.forEach(pattern => {
      const existingPattern = this.state.patterns.find(p => p.type === pattern.type);
      
      if (existingPattern) {
        this.updatePattern(existingPattern, pattern);
      } else if (pattern.confidence >= this.config.patternAnalysis.confidenceThreshold) {
        this.state.patterns.push(pattern);
        this.callbacks.onPatternDiscovered?.(pattern);
      }
    });

    // Limit patterns
    if (this.state.patterns.length > this.config.patternAnalysis.maxPatterns) {
      this.state.patterns = this.state.patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.config.patternAnalysis.maxPatterns);
    }
  }

  /**
   * Detect patterns in connection data
   */
  private detectPatterns(): ConnectionPattern[] {
    const patterns: ConnectionPattern[] = [];
    
    // Analyze for different pattern types
    patterns.push(...this.detectStabilityPatterns());
    patterns.push(...this.detectPeriodicPatterns());
    patterns.push(...this.detectTrendPatterns());
    patterns.push(...this.detectTimeBasedPatterns());
    
    return patterns;
  }

  /**
   * Detect stability patterns (stable/volatile)
   */
  private detectStabilityPatterns(): ConnectionPattern[] {
    const recent = this.patternBuffer.slice(-20); // Last 20 data points
    if (recent.length < 10) return [];
    
    const qualityValues = recent.map(p => p.metrics.quality);
    const variance = this.calculateVariance(qualityValues);
    const mean = qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length;
    
    if (variance < 100) { // Low variance = stable
      return [{
        id: `stable_${Date.now()}`,
        type: 'stable',
        confidence: Math.min(0.9, 1 - (variance / 100)),
        discovered: new Date(),
        lastSeen: new Date(),
        occurrences: 1,
        characteristics: {
          avgDuration: recent.length * 5000, // Assuming 5s intervals
          avgLatency: recent.reduce((a, p) => a + p.metrics.latency, 0) / recent.length,
          avgBandwidth: recent.reduce((a, p) => a + p.metrics.bandwidth, 0) / recent.length,
          qualityScore: mean,
          volatility: variance / 1000
        },
        triggers: [],
        predictions: []
      }];
    }
    
    if (variance > 500) { // High variance = volatile
      return [{
        id: `volatile_${Date.now()}`,
        type: 'volatile',
        confidence: Math.min(0.9, variance / 1000),
        discovered: new Date(),
        lastSeen: new Date(),
        occurrences: 1,
        characteristics: {
          avgDuration: recent.length * 5000,
          avgLatency: recent.reduce((a, p) => a + p.metrics.latency, 0) / recent.length,
          avgBandwidth: recent.reduce((a, p) => a + p.metrics.bandwidth, 0) / recent.length,
          qualityScore: mean,
          volatility: variance / 1000
        },
        triggers: [],
        predictions: []
      }];
    }
    
    return [];
  }

  /**
   * Detect periodic patterns
   */
  private detectPeriodicPatterns(): ConnectionPattern[] {
    if (this.connectionHistory.length < 20) return [];
    
    const disconnects = this.connectionHistory
      .filter(e => e.type === 'connection_lost')
      .slice(-10); // Last 10 disconnects
    
    if (disconnects.length < 3) return [];
    
    // Check for regular intervals
    const intervals = [];
    for (let i = 1; i < disconnects.length; i++) {
      const interval = disconnects[i].timestamp.getTime() - disconnects[i-1].timestamp.getTime();
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance = this.calculateVariance(intervals);
    
    if (intervalVariance / avgInterval < 0.2) { // Regular intervals
      return [{
        id: `periodic_${Date.now()}`,
        type: 'periodic_drops',
        confidence: 0.8,
        discovered: new Date(),
        lastSeen: new Date(),
        occurrences: disconnects.length,
        characteristics: {
          avgDuration: avgInterval,
          avgLatency: disconnects.reduce((a, e) => a + (e.latency || 0), 0) / disconnects.length,
          avgBandwidth: disconnects.reduce((a, e) => a + (e.bandwidth || 0), 0) / disconnects.length,
          qualityScore: disconnects.reduce((a, e) => a + (e.quality || 0), 0) / disconnects.length,
          volatility: intervalVariance / avgInterval,
          repeatInterval: avgInterval
        },
        triggers: [],
        predictions: [{
          nextOccurrence: new Date(Date.now() + avgInterval),
          probability: 0.7,
          confidence: 0.8,
          severity: 'medium',
          impact: {
            qualityDrop: 50,
            latencyIncrease: 200,
            bandwidthReduction: 30,
            disconnectProbability: 0.7
          }
        }]
      }];
    }
    
    return [];
  }

  /**
   * Detect trend patterns (improving/degrading)
   */
  private detectTrendPatterns(): ConnectionPattern[] {
    if (this.qualityHistory.length < 15) return [];
    
    const recent = this.qualityHistory.slice(-15);
    const trend = this.calculateTrend(recent.map(h => h.quality));
    
    if (Math.abs(trend) > 0.5) {
      const type: PatternType = trend > 0 ? 'improving' : 'degrading';
      return [{
        id: `${type}_${Date.now()}`,
        type,
        confidence: Math.min(0.9, Math.abs(trend)),
        discovered: new Date(),
        lastSeen: new Date(),
        occurrences: 1,
        characteristics: {
          avgDuration: recent.length * 5000,
          avgLatency: recent.reduce((a, h) => a + h.latency, 0) / recent.length,
          avgBandwidth: recent.reduce((a, h) => a + h.bandwidth, 0) / recent.length,
          qualityScore: recent.reduce((a, h) => a + h.quality, 0) / recent.length,
          volatility: Math.abs(trend)
        },
        triggers: [],
        predictions: []
      }];
    }
    
    return [];
  }

  /**
   * Detect time-based patterns
   */
  private detectTimeBasedPatterns(): ConnectionPattern[] {
    if (this.connectionHistory.length < 50) return [];
    
    const hourlyStats = new Map<number, { quality: number; count: number }>();
    
    this.connectionHistory.forEach(event => {
      const hour = event.timestamp.getHours();
      const existing = hourlyStats.get(hour) || { quality: 0, count: 0 };
      existing.quality += event.quality || 0;
      existing.count += 1;
      hourlyStats.set(hour, existing);
    });
    
    // Find hours with consistently low quality
    const problematicHours = Array.from(hourlyStats.entries())
      .filter(([_, stats]) => stats.count >= 3)
      .map(([hour, stats]) => ({ hour, avgQuality: stats.quality / stats.count }))
      .filter(h => h.avgQuality < 50);
    
    if (problematicHours.length > 0) {
      return [{
        id: `time_based_${Date.now()}`,
        type: 'time_based',
        confidence: 0.75,
        discovered: new Date(),
        lastSeen: new Date(),
        occurrences: problematicHours.length,
        characteristics: {
          avgDuration: 3600000, // 1 hour
          avgLatency: 0,
          avgBandwidth: 0,
          qualityScore: problematicHours.reduce((a, h) => a + h.avgQuality, 0) / problematicHours.length,
          volatility: 0.3,
          timeOfDay: problematicHours.map(h => h.hour).join(',')
        },
        triggers: [{
          type: 'time_of_day',
          value: problematicHours.map(h => h.hour),
          correlation: 0.8,
          lastTriggered: new Date()
        }],
        predictions: []
      }];
    }
    
    return [];
  }

  /**
   * Predict potential disconnections
   */
  private predictDisconnection(): void {
    if (this.qualityHistory.length < 5) return;
    
    const recent = this.qualityHistory.slice(-5);
    const features = this.extractFeatures(recent);
    const probability = this.calculateDisconnectProbability(features);
    
    if (probability >= this.config.disconnectPrediction.warningThreshold) {
      const prediction: DisconnectPrediction = {
        probability,
        confidence: this.calculatePredictionConfidence(features),
        timeToDisconnect: this.estimateTimeToDisconnect(features),
        severity: probability > this.config.disconnectPrediction.criticalThreshold ? 'critical' : 'moderate',
        causes: this.identifyDisconnectCauses(features),
        recommendations: this.generateRecommendations(features),
        countdown: this.config.disconnectPrediction.countdownEnabled ? {
          startTime: new Date(),
          estimatedDisconnect: new Date(Date.now() + this.estimateTimeToDisconnect(features)),
          warningThreshold: 30000,
          criticalThreshold: 10000,
          isActive: true,
          userNotified: false
        } : undefined
      };
      
      this.state.activePredictions.push(prediction);
      this.callbacks.onDisconnectPredicted?.(prediction);
      
      // Generate proactive notification
      this.generateDisconnectNotification(prediction);
    }
    
    // Clean up old predictions
    this.state.activePredictions = this.state.activePredictions.filter(
      p => Date.now() - p.countdown?.startTime.getTime()! < 300000 // 5 minutes
    );
  }

  /**
   * Select intelligent reconnection strategy
   */
  public selectReconnectionStrategy(
    disconnectCause: string,
    networkQuality: number,
    attemptCount: number = 0
  ): ReconnectionStrategy {
    const availableStrategies = this.state.availableStrategies.filter(strategy => {
      return strategy.conditions.every(condition => {
        switch (condition.type) {
          case 'disconnect_cause':
            return condition.operator === 'equals' ? 
              condition.value === disconnectCause : true;
          case 'network_quality':
            return condition.operator === 'less_than' ? 
              networkQuality < condition.value : 
              networkQuality >= condition.value;
          case 'reconnect_attempts':
            return condition.operator === 'greater_than' ? 
              attemptCount > condition.value : 
              attemptCount <= condition.value;
          default:
            return true;
        }
      });
    });
    
    // Score strategies based on conditions and success rate
    const scoredStrategies = availableStrategies.map(strategy => {
      const conditionScore = strategy.conditions.reduce((score, condition) => {
        return score + condition.weight;
      }, 0) / strategy.conditions.length;
      
      const totalScore = (conditionScore * 0.6) + (strategy.successRate * 0.4);
      return { strategy, score: totalScore };
    });
    
    // Select best strategy
    scoredStrategies.sort((a, b) => b.score - a.score);
    const selected = scoredStrategies[0]?.strategy || this.state.availableStrategies[0];
    
    this.state.selectedStrategy = selected;
    this.callbacks.onStrategySelected?.(selected);
    
    return selected;
  }

  /**
   * Generate proactive notifications
   */
  private generateDisconnectNotification(prediction: DisconnectPrediction): void {
    const notification: ProactiveNotification = {
      id: `disconnect_warning_${Date.now()}`,
      type: 'disconnect_warning',
      priority: prediction.severity === 'critical' ? 'critical' : 'warning',
      title: 'Connection Issue Predicted',
      message: `Potential disconnect in ${Math.round(prediction.timeToDisconnect / 1000)}s (${Math.round(prediction.probability * 100)}% probability)`,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + prediction.timeToDisconnect + 60000),
      actions: [
        { id: 'optimize', label: 'Optimize Connection', action: 'optimize_connection', primary: true },
        { id: 'dismiss', label: 'Dismiss', action: 'dismiss' }
      ],
      channels: this.config.notifications.priorityChannels[
        prediction.severity === 'critical' ? 'critical' : 'warning'
      ],
      context: {
        connectionState: 'at_risk',
        networkQuality: 0,
        serverHealth: 0,
        prediction
      },
      acknowledged: false,
      dismissed: false
    };
    
    this.state.notifications.push(notification);
    this.callbacks.onNotificationSent?.(notification);
  }

  /**
   * Process and manage notifications
   */
  private processNotifications(): void {
    const now = Date.now();
    
    // Remove expired notifications
    this.state.notifications = this.state.notifications.filter(
      n => !n.expiresAt || n.expiresAt.getTime() > now
    );
    
    // Apply suppression rules
    this.applySuppression();
  }

  /**
   * Apply notification suppression rules
   */
  private applySuppression(): void {
    const hourAgo = Date.now() - 3600000;
    const recentNotifications = this.state.notifications.filter(
      n => n.timestamp.getTime() > hourAgo
    );
    
    if (recentNotifications.length >= this.config.notifications.maxNotificationsPerHour) {
      // Remove lower priority notifications
      this.state.notifications = this.state.notifications.filter(n => {
        const priorityOrder = { info: 1, warning: 2, urgent: 3, critical: 4 };
        return priorityOrder[n.priority] >= 3; // Keep only urgent and critical
      });
    }
  }

  /**
   * Update machine learning model
   */
  private updateMLModel(): void {
    if (this.state.learningData.trainingPoints.length < 10) return;
    
    const accuracy = this.calculateModelAccuracy();
    this.state.learningData.modelAccuracy = accuracy;
    this.state.learningData.modelVersion = `1.${Date.now()}`;
    
    this.callbacks.onModelUpdated?.(accuracy, this.state.learningData.modelVersion);
  }

  // Helper methods
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return variance;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((a, b, i) => a + b * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private extractFeatures(history: Array<{ quality: number; latency: number; bandwidth: number }>): Record<string, any> {
    return {
      avgQuality: history.reduce((a, h) => a + h.quality, 0) / history.length,
      avgLatency: history.reduce((a, h) => a + h.latency, 0) / history.length,
      avgBandwidth: history.reduce((a, h) => a + h.bandwidth, 0) / history.length,
      qualityTrend: this.calculateTrend(history.map(h => h.quality)),
      latencyTrend: this.calculateTrend(history.map(h => h.latency)),
      timeOfDay: new Date().getHours(),
      patternCount: this.state.patterns.length
    };
  }

  private calculateDisconnectProbability(features: Record<string, any>): number {
    // Simple ML-based probability calculation
    let probability = 0;
    
    // Quality factor (lower quality = higher disconnect probability)
    probability += (100 - features.avgQuality) / 100 * 0.4;
    
    // Latency factor (higher latency = higher disconnect probability)
    probability += Math.min(features.avgLatency / 1000, 1) * 0.3;
    
    // Trend factor (negative trends increase probability)
    if (features.qualityTrend < 0) {
      probability += Math.abs(features.qualityTrend) * 0.2;
    }
    
    // Pattern factor
    const volatilePatterns = this.state.patterns.filter(p => p.type === 'volatile' || p.type === 'degrading');
    probability += volatilePatterns.length * 0.1;
    
    return Math.min(probability, 1);
  }

  private calculatePredictionConfidence(features: Record<string, any>): number {
    // Confidence based on data quality and model accuracy
    return Math.min(this.state.learningData.modelAccuracy + 0.2, 0.9);
  }

  private estimateTimeToDisconnect(features: Record<string, any>): number {
    // Estimate based on quality degradation rate
    const degradationRate = Math.abs(features.qualityTrend);
    return Math.max(10000, 60000 - (degradationRate * 30000)); // 10s to 60s
  }

  private identifyDisconnectCauses(features: Record<string, any>): DisconnectCause[] {
    const causes: DisconnectCause[] = [];
    
    if (features.avgQuality < 30) {
      causes.push({
        type: 'quality_degradation',
        probability: 0.8,
        indicators: ['Low quality score', 'Poor network conditions'],
        mitigation: 'Check network connection or move to better location'
      });
    }
    
    if (features.avgLatency > 500) {
      causes.push({
        type: 'network_congestion',
        probability: 0.6,
        indicators: ['High latency', 'Network congestion'],
        mitigation: 'Wait for network congestion to clear or switch networks'
      });
    }
    
    return causes;
  }

  private generateRecommendations(features: Record<string, any>): string[] {
    const recommendations: string[] = [];
    
    if (features.avgQuality < 50) {
      recommendations.push('Check your network connection');
      recommendations.push('Move closer to WiFi router or switch to cellular');
    }
    
    if (features.avgLatency > 300) {
      recommendations.push('Close unnecessary applications using network');
      recommendations.push('Restart your router if possible');
    }
    
    return recommendations;
  }

  private addTrainingPoint(
    connectionState: ConnectionState, 
    networkQuality: NetworkQuality, 
    serverHealth: ServerHealthState
  ): void {
    const trainingPoint: TrainingPoint = {
      timestamp: new Date(),
      features: {
        quality: networkQuality.overall,
        latency: connectionState.latency || 0,
        bandwidth: networkQuality.bandwidth?.download || 0,
        serverHealth: serverHealth.overall,
        timeOfDay: new Date().getHours(),
        networkType: networkQuality.networkType
      },
      outcome: connectionState.status === 'connected' ? 'connected' : 'disconnected',
      actualLatency: connectionState.latency,
      actualQuality: networkQuality.overall
    };
    
    this.state.learningData.trainingPoints.push(trainingPoint);
    
    // Limit training data
    if (this.state.learningData.trainingPoints.length > this.config.machineLearning.trainingDataSize) {
      this.state.learningData.trainingPoints = this.state.learningData.trainingPoints.slice(-this.config.machineLearning.trainingDataSize);
    }
  }

  private calculateModelAccuracy(): number {
    if (this.state.learningData.predictionHistory.length === 0) return 0.5;
    
    const correct = this.state.learningData.predictionHistory.filter(p => p.accuracy > 0.7).length;
    return correct / this.state.learningData.predictionHistory.length;
  }

  private updatePattern(existing: ConnectionPattern, detected: ConnectionPattern): void {
    existing.lastSeen = new Date();
    existing.occurrences += 1;
    existing.confidence = Math.min(0.95, existing.confidence + 0.05);
    
    // Update characteristics with weighted average
    const weight = 0.1; // New data weight
    existing.characteristics.avgLatency = 
      existing.characteristics.avgLatency * (1 - weight) + 
      detected.characteristics.avgLatency * weight;
    existing.characteristics.avgBandwidth = 
      existing.characteristics.avgBandwidth * (1 - weight) + 
      detected.characteristics.avgBandwidth * weight;
    existing.characteristics.qualityScore = 
      existing.characteristics.qualityScore * (1 - weight) + 
      detected.characteristics.qualityScore * weight;
  }

  private limitBufferSizes(): void {
    const maxSize = 1000;
    if (this.connectionHistory.length > maxSize) {
      this.connectionHistory = this.connectionHistory.slice(-maxSize);
    }
    if (this.qualityHistory.length > maxSize) {
      this.qualityHistory = this.qualityHistory.slice(-maxSize);
    }
    if (this.patternBuffer.length > maxSize) {
      this.patternBuffer = this.patternBuffer.slice(-maxSize);
    }
  }

  // Public API methods
  public getState(): PredictiveIntelligenceState {
    return { ...this.state };
  }

  public getActivePatterns(): ConnectionPattern[] {
    return this.state.patterns.filter(p => 
      Date.now() - p.lastSeen.getTime() < 300000 // Active in last 5 minutes
    );
  }

  public getActivePredictions(): DisconnectPrediction[] {
    return this.state.activePredictions;
  }

  public getRecommendedStrategy(): ReconnectionStrategy | null {
    return this.state.selectedStrategy;
  }

  public getNotifications(): ProactiveNotification[] {
    return this.state.notifications.filter(n => !n.dismissed);
  }

  public dismissNotification(notificationId: string): void {
    const notification = this.state.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.dismissed = true;
    }
  }

  public acknowledgeNotification(notificationId: string): void {
    const notification = this.state.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledged = true;
    }
  }

  public setCallbacks(callbacks: {
    onPatternDiscovered?: PatternDiscoveryCallback;
    onDisconnectPredicted?: DisconnectPredictionCallback;
    onStrategySelected?: StrategySelectionCallback;
    onNotificationSent?: NotificationCallback;
    onModelUpdated?: ModelUpdateCallback;
  }): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public updateConfig(config: Partial<PredictiveEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public destroy(): void {
    if (this.analysisTimer) clearInterval(this.analysisTimer);
    if (this.predictionTimer) clearInterval(this.predictionTimer);
    if (this.modelTimer) clearInterval(this.modelTimer);
    if (this.notificationTimer) clearInterval(this.notificationTimer);
  }
}

// Global instance management
let globalPredictiveEngine: PredictiveEngine | null = null;

export function createPredictiveEngine(config?: Partial<PredictiveEngineConfig>): PredictiveEngine {
  return new PredictiveEngine(config);
}

export function getGlobalPredictiveEngine(config?: Partial<PredictiveEngineConfig>): PredictiveEngine {
  if (!globalPredictiveEngine) {
    globalPredictiveEngine = new PredictiveEngine(config);
  }
  return globalPredictiveEngine;
}

export function destroyGlobalPredictiveEngine(): void {
  if (globalPredictiveEngine) {
    globalPredictiveEngine.destroy();
    globalPredictiveEngine = null;
  }
}