/**
 * Type definitions for predictive connection intelligence
 * Phase 5: Predictive Connection Intelligence - Subtask 28.6
 */

// Connection Pattern Analysis Types
export interface ConnectionPattern {
  id: string;
  type: PatternType;
  confidence: number;
  discovered: Date;
  lastSeen: Date;
  occurrences: number;
  characteristics: PatternCharacteristics;
  triggers: PatternTrigger[];
  predictions: PatternPrediction[];
}

export type PatternType = 
  | 'stable'           // Consistent connection quality
  | 'periodic_drops'   // Regular disconnections at intervals
  | 'degrading'        // Gradually worsening connection
  | 'improving'        // Gradually improving connection
  | 'volatile'         // Unstable, unpredictable patterns
  | 'time_based'       // Patterns based on time of day/week
  | 'usage_based'      // Patterns based on usage intensity
  | 'network_based';   // Patterns based on network type/location

export interface PatternCharacteristics {
  avgDuration: number;        // Average pattern duration (ms)
  avgLatency: number;         // Average latency during pattern
  avgBandwidth: number;       // Average bandwidth during pattern
  qualityScore: number;       // Average quality score (0-100)
  volatility: number;         // Pattern stability measure (0-1)
  timeOfDay?: string;         // Time-based pattern (if applicable)
  networkType?: string;       // Network type correlation
  repeatInterval?: number;    // Interval for periodic patterns (ms)
}

export interface PatternTrigger {
  type: TriggerType;
  value: any;
  correlation: number;        // Correlation strength (0-1)
  lastTriggered: Date;
}

export type TriggerType = 
  | 'time_of_day'
  | 'network_change'
  | 'high_usage'
  | 'server_load'
  | 'external_interference'
  | 'location_change'
  | 'device_state';

export interface PatternPrediction {
  nextOccurrence: Date;
  probability: number;        // Probability of occurrence (0-1)
  confidence: number;         // Confidence in prediction (0-1)
  severity: PredictionSeverity;
  impact: PredictedImpact;
}

export type PredictionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PredictedImpact {
  qualityDrop: number;        // Expected quality drop (0-100)
  latencyIncrease: number;    // Expected latency increase (ms)
  bandwidthReduction: number; // Expected bandwidth reduction (%)
  disconnectProbability: number; // Probability of disconnect (0-1)
}

// Disconnect Prediction Types
export interface DisconnectPrediction {
  probability: number;        // Immediate disconnect probability (0-1)
  confidence: number;         // Confidence in prediction (0-1)
  timeToDisconnect: number;   // Estimated time until disconnect (ms)
  severity: DisconnectSeverity;
  causes: DisconnectCause[];
  recommendations: string[];
  countdown?: DisconnectCountdown;
}

export type DisconnectSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface DisconnectCause {
  type: CauseType;
  probability: number;        // Contribution to disconnect probability
  indicators: string[];      // Observable indicators
  mitigation?: string;        // Suggested mitigation
}

export type CauseType = 
  | 'network_congestion'
  | 'server_overload'
  | 'connection_timeout'
  | 'quality_degradation'
  | 'pattern_prediction'
  | 'external_interference'
  | 'resource_exhaustion';

export interface DisconnectCountdown {
  startTime: Date;
  estimatedDisconnect: Date;
  warningThreshold: number;   // Warning threshold (ms)
  criticalThreshold: number;  // Critical threshold (ms)
  isActive: boolean;
  userNotified: boolean;
}

// Reconnection Strategy Types
export interface ReconnectionStrategy {
  id: string;
  name: string;
  type: StrategyType;
  priority: number;           // Strategy priority (1-10)
  conditions: StrategyCondition[];
  parameters: StrategyParameters;
  successRate: number;        // Historical success rate (0-1)
  avgReconnectTime: number;   // Average reconnection time (ms)
  lastUsed: Date;
  timesUsed: number;
}

export type StrategyType = 
  | 'immediate'          // Immediate reconnection attempt
  | 'delayed'           // Delayed reconnection with backoff
  | 'progressive'       // Progressive quality restoration
  | 'parallel'          // Multiple parallel attempts
  | 'adaptive'          // Adaptive based on conditions
  | 'fallback'          // Fallback to alternative connection
  | 'smart_retry';      // ML-optimized retry pattern

export interface StrategyCondition {
  type: ConditionType;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  weight: number;             // Condition weight in strategy selection
}

export type ConditionType = 
  | 'disconnect_cause'
  | 'network_quality'
  | 'server_health'
  | 'time_of_day'
  | 'reconnect_attempts'
  | 'last_success_time'
  | 'pattern_type';

export interface StrategyParameters {
  initialDelay?: number;      // Initial delay before first attempt (ms)
  maxDelay?: number;         // Maximum delay between attempts (ms)
  backoffFactor?: number;    // Exponential backoff factor
  maxAttempts?: number;      // Maximum number of attempts
  timeout?: number;          // Individual attempt timeout (ms)
  parallelAttempts?: number; // Number of parallel attempts
  qualityThreshold?: number; // Minimum quality threshold for success
  adaptiveFactors?: AdaptiveFactors;
}

export interface AdaptiveFactors {
  networkTypeWeight: number;
  timeOfDayWeight: number;
  historicalSuccessWeight: number;
  currentQualityWeight: number;
  serverHealthWeight: number;
}

// Proactive Notification Types
export interface ProactiveNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  expiresAt?: Date;
  actions: NotificationAction[];
  channels: NotificationChannel[];
  context: NotificationContext;
  acknowledged: boolean;
  dismissed: boolean;
}

export type NotificationType = 
  | 'disconnect_warning'
  | 'quality_alert'
  | 'pattern_notification'
  | 'reconnection_advice'
  | 'maintenance_notice'
  | 'performance_insight'
  | 'optimization_suggestion';

export type NotificationPriority = 'info' | 'warning' | 'urgent' | 'critical';

export interface NotificationAction {
  id: string;
  label: string;
  action: ActionType;
  parameters?: Record<string, any>;
  primary?: boolean;
}

export type ActionType = 
  | 'dismiss'
  | 'reconnect'
  | 'change_strategy'
  | 'view_details'
  | 'optimize_connection'
  | 'contact_support'
  | 'snooze';

export type NotificationChannel = 
  | 'ui_banner'
  | 'ui_toast'
  | 'ui_modal'
  | 'browser_notification'
  | 'system_notification'
  | 'email'
  | 'sms';

export interface NotificationContext {
  connectionState: string;
  networkQuality: number;
  serverHealth: number;
  prediction?: DisconnectPrediction;
  pattern?: ConnectionPattern;
  strategy?: ReconnectionStrategy;
}

// Predictive Engine Configuration
export interface PredictiveEngineConfig {
  patternAnalysis: PatternAnalysisConfig;
  disconnectPrediction: DisconnectPredictionConfig;
  reconnectionStrategy: ReconnectionStrategyConfig;
  notifications: NotificationConfig;
  machineLearning: MLConfig;
}

export interface PatternAnalysisConfig {
  enabled: boolean;
  minPatternLength: number;    // Minimum pattern length for recognition
  maxPatterns: number;         // Maximum number of patterns to track
  confidenceThreshold: number; // Minimum confidence for pattern recognition
  analysisWindow: number;      // Analysis window size (ms)
  updateInterval: number;      // Pattern analysis update interval (ms)
}

export interface DisconnectPredictionConfig {
  enabled: boolean;
  predictionWindow: number;    // Prediction lookahead window (ms)
  warningThreshold: number;    // Warning threshold probability (0-1)
  criticalThreshold: number;   // Critical threshold probability (0-1)
  countdownEnabled: boolean;
  modelUpdateInterval: number; // ML model update interval (ms)
}

export interface ReconnectionStrategyConfig {
  enabled: boolean;
  defaultStrategy: StrategyType;
  adaptiveSelection: boolean;
  strategies: ReconnectionStrategy[];
  evaluationInterval: number;  // Strategy evaluation interval (ms)
}

export interface NotificationConfig {
  enabled: boolean;
  defaultChannels: NotificationChannel[];
  priorityChannels: Record<NotificationPriority, NotificationChannel[]>;
  suppressionRules: SuppressionRule[];
  maxNotificationsPerHour: number;
}

export interface SuppressionRule {
  type: NotificationType;
  conditions: string[];       // Conditions for suppression
  duration: number;           // Suppression duration (ms)
}

export interface MLConfig {
  enabled: boolean;
  modelType: MLModelType;
  trainingDataSize: number;   // Maximum training data points
  retrainingInterval: number; // Model retraining interval (ms)
  features: MLFeature[];
  hyperparameters: Record<string, any>;
}

export type MLModelType = 
  | 'linear_regression'
  | 'decision_tree'
  | 'neural_network'
  | 'ensemble'
  | 'bayesian'
  | 'time_series';

export interface MLFeature {
  name: string;
  type: 'numerical' | 'categorical' | 'boolean' | 'timestamp';
  weight: number;
  source: string;            // Data source for the feature
}

// Predictive Intelligence State
export interface PredictiveIntelligenceState {
  patterns: ConnectionPattern[];
  activePredictions: DisconnectPrediction[];
  selectedStrategy: ReconnectionStrategy | null;
  availableStrategies: ReconnectionStrategy[];
  notifications: ProactiveNotification[];
  learningData: LearningData;
  isEnabled: boolean;
  lastUpdate: Date;
}

export interface LearningData {
  trainingPoints: TrainingPoint[];
  modelAccuracy: number;
  predictionHistory: PredictionResult[];
  featureImportance: Record<string, number>;
  modelVersion: string;
}

export interface TrainingPoint {
  timestamp: Date;
  features: Record<string, any>;
  outcome: 'connected' | 'disconnected' | 'degraded';
  actualLatency?: number;
  actualQuality?: number;
}

export interface PredictionResult {
  timestamp: Date;
  prediction: DisconnectPrediction;
  actualOutcome: 'connected' | 'disconnected' | 'degraded';
  accuracy: number;
  timeDifference: number;     // Difference between predicted and actual (ms)
}

// Event Types
export interface PredictiveEvent {
  type: PredictiveEventType;
  timestamp: Date;
  data: any;
  source: string;
}

export type PredictiveEventType = 
  | 'pattern_discovered'
  | 'pattern_updated'
  | 'disconnect_predicted'
  | 'strategy_selected'
  | 'notification_sent'
  | 'model_updated'
  | 'prediction_validated';

// Callback Types
export type PatternDiscoveryCallback = (pattern: ConnectionPattern) => void;
export type DisconnectPredictionCallback = (prediction: DisconnectPrediction) => void;
export type StrategySelectionCallback = (strategy: ReconnectionStrategy) => void;
export type NotificationCallback = (notification: ProactiveNotification) => void;
export type ModelUpdateCallback = (accuracy: number, version: string) => void;

// Default Configuration
export const DEFAULT_PREDICTIVE_CONFIG: PredictiveEngineConfig = {
  patternAnalysis: {
    enabled: true,
    minPatternLength: 5,
    maxPatterns: 50,
    confidenceThreshold: 0.7,
    analysisWindow: 300000,    // 5 minutes
    updateInterval: 30000      // 30 seconds
  },
  disconnectPrediction: {
    enabled: true,
    predictionWindow: 120000,  // 2 minutes
    warningThreshold: 0.6,
    criticalThreshold: 0.8,
    countdownEnabled: true,
    modelUpdateInterval: 300000 // 5 minutes
  },
  reconnectionStrategy: {
    enabled: true,
    defaultStrategy: 'adaptive',
    adaptiveSelection: true,
    strategies: [],
    evaluationInterval: 60000  // 1 minute
  },
  notifications: {
    enabled: true,
    defaultChannels: ['ui_toast'],
    priorityChannels: {
      info: ['ui_toast'],
      warning: ['ui_banner', 'ui_toast'],
      urgent: ['ui_modal', 'browser_notification'],
      critical: ['ui_modal', 'browser_notification', 'system_notification']
    },
    suppressionRules: [],
    maxNotificationsPerHour: 10
  },
  machineLearning: {
    enabled: true,
    modelType: 'ensemble',
    trainingDataSize: 1000,
    retrainingInterval: 3600000, // 1 hour
    features: [
      { name: 'latency', type: 'numerical', weight: 0.8, source: 'connection_monitor' },
      { name: 'bandwidth', type: 'numerical', weight: 0.7, source: 'connection_monitor' },
      { name: 'quality_score', type: 'numerical', weight: 0.9, source: 'connection_monitor' },
      { name: 'time_of_day', type: 'numerical', weight: 0.5, source: 'system' },
      { name: 'network_type', type: 'categorical', weight: 0.6, source: 'browser_api' },
      { name: 'server_health', type: 'numerical', weight: 0.8, source: 'server_monitor' }
    ],
    hyperparameters: {
      learning_rate: 0.01,
      max_depth: 10,
      n_estimators: 100
    }
  }
};