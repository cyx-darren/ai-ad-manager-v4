/**
 * Fallback Manager (Phase 2)
 * 
 * This file provides comprehensive fallback mechanisms for unavailable MCP operations:
 * - Fallback strategies for different operation types
 * - Degraded functionality modes
 * - Mock data serving for offline scenarios
 * - Feature disabling for MCP-dependent operations
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Fallback strategy types
 */
export type FallbackStrategy = 
  | 'mock_data'           // Serve mock/cached data
  | 'reduced_functionality' // Provide limited features
  | 'disable_feature'      // Completely disable the feature
  | 'error_message'        // Show error with retry option
  | 'queue_for_later'      // Queue operation for when online
  | 'alternative_source';   // Use alternative data source

/**
 * Operation types that can have fallbacks
 */
export type OperationType = 
  | 'ga4_query'
  | 'ga4_realtime'
  | 'auth_check'
  | 'tool_list'
  | 'resource_access'
  | 'prompt_execution'
  | 'data_export'
  | 'configuration'
  | 'health_check';

/**
 * Degradation levels for functionality
 */
export type DegradationLevel = 
  | 'full'        // Full functionality available
  | 'limited'     // Some features disabled
  | 'minimal'     // Only basic features
  | 'read_only'   // No write operations
  | 'offline';    // No network operations

/**
 * Mock data types
 */
export interface MockDataConfig {
  type: 'static' | 'generated' | 'cached' | 'template';
  source?: string;
  generator?: () => any;
  cacheKey?: string;
  fallbackValue?: any;
  expiryTime?: number;
}

/**
 * Fallback operation configuration
 */
export interface FallbackOperationConfig {
  operationType: OperationType;
  strategy: FallbackStrategy;
  mockData?: MockDataConfig;
  alternativeAction?: () => Promise<any>;
  errorMessage?: string;
  retryable?: boolean;
  degradationLevel?: DegradationLevel;
  timeout?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Feature configuration for degradation
 */
export interface FeatureConfig {
  featureId: string;
  name: string;
  requiredOperations: OperationType[];
  fallbackBehavior: 'disable' | 'degrade' | 'mock';
  degradationLevel: DegradationLevel;
  essentialForApp: boolean;
  userMessage?: string;
  alternativeFeatures?: string[];
}

/**
 * Fallback manager state
 */
export interface FallbackManagerState {
  currentDegradationLevel: DegradationLevel;
  activeStrategies: Map<OperationType, FallbackStrategy>;
  disabledFeatures: Set<string>;
  queuedOperations: QueuedOperation[];
  mockDataCache: Map<string, { data: any; expiry: number }>;
  lastFallbackActivation: number;
  totalFallbackActivations: number;
  operationHistory: FallbackOperationHistory[];
}

/**
 * Queued operation for later execution
 */
export interface QueuedOperation {
  id: string;
  operationType: OperationType;
  operation: () => Promise<any>;
  params: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
}

/**
 * Fallback operation history entry
 */
export interface FallbackOperationHistory {
  id: string;
  operationType: OperationType;
  strategy: FallbackStrategy;
  timestamp: number;
  success: boolean;
  fallbackData?: any;
  error?: Error;
  executionTime: number;
}

/**
 * Fallback manager events
 */
export interface FallbackManagerEvents {
  onDegradationLevelChange?: (level: DegradationLevel, previousLevel: DegradationLevel) => void;
  onFeatureDisabled?: (featureId: string, reason: string) => void;
  onFeatureRestored?: (featureId: string) => void;
  onFallbackActivated?: (operationType: OperationType, strategy: FallbackStrategy) => void;
  onOperationQueued?: (operation: QueuedOperation) => void;
  onQueuedOperationExecuted?: (operation: QueuedOperation, result: any) => void;
  onMockDataServed?: (operationType: OperationType, mockData: any) => void;
}

/**
 * Fallback manager configuration
 */
export interface FallbackManagerConfig {
  // Default strategies for different operations
  defaultStrategies: Map<OperationType, FallbackStrategy>;
  
  // Feature configurations
  features: FeatureConfig[];
  
  // Mock data configurations
  mockDataConfigs: Map<OperationType, MockDataConfig>;
  
  // Queue settings
  maxQueueSize: number;
  queueRetryInterval: number;
  maxRetryAttempts: number;
  
  // Cache settings
  mockDataCacheSize: number;
  mockDataTTL: number;
  
  // Behavior settings
  autoFallbackEnabled: boolean;
  aggressiveFallback: boolean;
  fallbackTimeout: number;
  
  // Debug settings
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default fallback strategies for different operation types
 */
export const DEFAULT_FALLBACK_STRATEGIES: Map<OperationType, FallbackStrategy> = new Map([
  ['ga4_query', 'mock_data'],
  ['ga4_realtime', 'mock_data'],
  ['auth_check', 'alternative_source'],
  ['tool_list', 'mock_data'],
  ['resource_access', 'error_message'],
  ['prompt_execution', 'queue_for_later'],
  ['data_export', 'disable_feature'],
  ['configuration', 'mock_data'],
  ['health_check', 'alternative_source']
]);

/**
 * Default feature configurations
 */
export const DEFAULT_FEATURES: FeatureConfig[] = [
  {
    featureId: 'dashboard_metrics',
    name: 'Dashboard Metrics',
    requiredOperations: ['ga4_query'],
    fallbackBehavior: 'mock',
    degradationLevel: 'limited',
    essentialForApp: true,
    userMessage: 'Showing cached metrics data. Real-time data unavailable.',
    alternativeFeatures: ['basic_stats']
  },
  {
    featureId: 'realtime_analytics',
    name: 'Real-time Analytics',
    requiredOperations: ['ga4_realtime'],
    fallbackBehavior: 'disable',
    degradationLevel: 'minimal',
    essentialForApp: false,
    userMessage: 'Real-time analytics temporarily unavailable.',
    alternativeFeatures: ['historical_analytics']
  },
  {
    featureId: 'data_export',
    name: 'Data Export',
    requiredOperations: ['data_export', 'ga4_query'],
    fallbackBehavior: 'disable',
    degradationLevel: 'read_only',
    essentialForApp: false,
    userMessage: 'Data export temporarily disabled. You can view data but not export.'
  },
  {
    featureId: 'user_authentication',
    name: 'User Authentication',
    requiredOperations: ['auth_check'],
    fallbackBehavior: 'degrade',
    degradationLevel: 'minimal',
    essentialForApp: true,
    userMessage: 'Running in limited authentication mode.',
    alternativeFeatures: ['guest_mode']
  },
  {
    featureId: 'advanced_queries',
    name: 'Advanced Query Builder',
    requiredOperations: ['prompt_execution', 'tool_list'],
    fallbackBehavior: 'disable',
    degradationLevel: 'limited',
    essentialForApp: false,
    userMessage: 'Advanced queries temporarily unavailable. Use basic queries instead.',
    alternativeFeatures: ['basic_queries']
  }
];

/**
 * Default mock data configurations
 */
export const DEFAULT_MOCK_DATA_CONFIGS: Map<OperationType, MockDataConfig> = new Map([
  ['ga4_query', {
    type: 'generated',
    generator: generateMockGA4Data,
    cacheKey: 'ga4_metrics',
    expiryTime: 5 * 60 * 1000 // 5 minutes
  }],
  ['ga4_realtime', {
    type: 'generated',
    generator: generateMockRealtimeData,
    cacheKey: 'ga4_realtime',
    expiryTime: 30 * 1000 // 30 seconds
  }],
  ['tool_list', {
    type: 'static',
    fallbackValue: {
      tools: [
        { name: 'ga4_query', description: 'Basic GA4 queries (offline mode)' },
        { name: 'data_view', description: 'View cached data' }
      ]
    },
    cacheKey: 'tool_list_offline'
  }],
  ['configuration', {
    type: 'static',
    fallbackValue: {
      features: ['basic_dashboard', 'data_view'],
      limits: { queries_per_hour: 0, max_date_range: 7 },
      offline_mode: true
    },
    cacheKey: 'config_offline'
  }]
]);

/**
 * Default fallback manager configuration
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackManagerConfig = {
  defaultStrategies: DEFAULT_FALLBACK_STRATEGIES,
  features: DEFAULT_FEATURES,
  mockDataConfigs: DEFAULT_MOCK_DATA_CONFIGS,
  maxQueueSize: 100,
  queueRetryInterval: 30000, // 30 seconds
  maxRetryAttempts: 3,
  mockDataCacheSize: 50,
  mockDataTTL: 5 * 60 * 1000, // 5 minutes
  autoFallbackEnabled: true,
  aggressiveFallback: false,
  fallbackTimeout: 5000, // 5 seconds
  enableLogging: process.env.NODE_ENV === 'development',
  logLevel: 'info'
};

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate mock GA4 metrics data
 */
function generateMockGA4Data(): any {
  const now = new Date();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
    return {
      date: date.toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 1000) + 500,
      users: Math.floor(Math.random() * 800) + 400,
      pageviews: Math.floor(Math.random() * 2000) + 1000,
      bounceRate: (Math.random() * 0.4 + 0.3).toFixed(3),
      avgSessionDuration: Math.floor(Math.random() * 180) + 120
    };
  });

  return {
    metrics: {
      sessions: last30Days.reduce((sum, day) => sum + day.sessions, 0),
      users: last30Days.reduce((sum, day) => sum + day.users, 0),
      pageviews: last30Days.reduce((sum, day) => sum + day.pageviews, 0),
      bounceRate: (last30Days.reduce((sum, day) => sum + parseFloat(day.bounceRate), 0) / 30).toFixed(3),
      avgSessionDuration: Math.floor(last30Days.reduce((sum, day) => sum + day.avgSessionDuration, 0) / 30)
    },
    timeSeries: last30Days,
    lastUpdated: now.toISOString(),
    dataSource: 'mock_offline',
    note: 'This is cached/simulated data. Real-time data unavailable.'
  };
}

/**
 * Generate mock real-time data
 */
function generateMockRealtimeData(): any {
  return {
    activeUsers: Math.floor(Math.random() * 50) + 10,
    realtimeEvents: Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      event: ['page_view', 'click', 'scroll', 'session_start'][Math.floor(Math.random() * 4)],
      count: Math.floor(Math.random() * 5) + 1
    })),
    topPages: [
      { page: '/dashboard', activeUsers: Math.floor(Math.random() * 20) + 5 },
      { page: '/analytics', activeUsers: Math.floor(Math.random() * 15) + 3 },
      { page: '/reports', activeUsers: Math.floor(Math.random() * 10) + 2 }
    ],
    lastUpdated: new Date().toISOString(),
    dataSource: 'mock_realtime',
    note: 'Simulated real-time data. Actual real-time tracking unavailable.'
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique operation ID
 */
export const generateOperationId = (): string => {
  return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate degradation level based on available operations
 */
export const calculateDegradationLevel = (
  availableOperations: Set<OperationType>,
  features: FeatureConfig[]
): DegradationLevel => {
  const enabledFeatures = features.filter(feature => 
    feature.requiredOperations.every(op => availableOperations.has(op))
  );

  const essentialFeatures = features.filter(f => f.essentialForApp);
  const enabledEssentialFeatures = enabledFeatures.filter(f => f.essentialForApp);

  // Check if all essential features are available
  if (enabledEssentialFeatures.length === essentialFeatures.length) {
    if (enabledFeatures.length === features.length) {
      return 'full';
    } else if (enabledFeatures.length > features.length * 0.7) {
      return 'limited';
    } else {
      return 'minimal';
    }
  } else if (enabledEssentialFeatures.length > 0) {
    return 'read_only';
  } else {
    return 'offline';
  }
};

/**
 * Enhanced logging utility for fallback manager
 */
export const createFallbackLogger = (config: FallbackManagerConfig) => {
  if (!config.enableLogging) {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = logLevels[config.logLevel];

  const createLogFunction = (level: keyof typeof logLevels) => 
    (message: string, data?: any) => {
      if (logLevels[level] >= currentLevel) {
        const timestamp = new Date().toISOString();
        const prefix = `[Fallback Manager ${timestamp}] ${level.toUpperCase()}:`;
        
        if (data) {
          console[level](prefix, message, data);
        } else {
          console[level](prefix, message);
        }
      }
    };

  return {
    debug: createLogFunction('debug'),
    info: createLogFunction('info'),
    warn: createLogFunction('warn'),
    error: createLogFunction('error')
  };
};

// ============================================================================
// FALLBACK MANAGER CLASS
// ============================================================================

/**
 * Main fallback manager class
 */
export class FallbackManager {
  private config: FallbackManagerConfig;
  private state: FallbackManagerState;
  private events: FallbackManagerEvents;
  private logger: ReturnType<typeof createFallbackLogger>;
  
  // Timers and intervals
  private queueProcessingInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(
    config: Partial<FallbackManagerConfig> = {},
    events: FallbackManagerEvents = {}
  ) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.events = events;
    this.logger = createFallbackLogger(this.config);
    
    // Initialize state
    this.state = {
      currentDegradationLevel: 'full',
      activeStrategies: new Map(this.config.defaultStrategies),
      disabledFeatures: new Set(),
      queuedOperations: [],
      mockDataCache: new Map(),
      lastFallbackActivation: 0,
      totalFallbackActivations: 0,
      operationHistory: []
    };
    
    this.logger.info('Fallback manager initialized', {
      defaultStrategies: Array.from(this.config.defaultStrategies.entries()),
      features: this.config.features.length,
      autoFallbackEnabled: this.config.autoFallbackEnabled
    });
  }
  
  /**
   * Start fallback manager
   */
  start(): void {
    this.logger.info('Starting fallback manager');
    
    // Start queue processing
    this.startQueueProcessing();
    
    // Start cache cleanup
    this.startCacheCleanup();
  }
  
  /**
   * Stop fallback manager
   */
  stop(): void {
    this.logger.info('Stopping fallback manager');
    
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
  }
  
  /**
   * Execute operation with fallback
   */
  async executeWithFallback<T>(
    operationType: OperationType,
    primaryOperation: () => Promise<T>,
    operationConfig?: Partial<FallbackOperationConfig>
  ): Promise<T | any> {
    const startTime = Date.now();
    const operationId = generateOperationId();
    
    this.logger.debug(`Executing operation with fallback`, {
      operationType,
      operationId,
      hasConfig: !!operationConfig
    });
    
    try {
      // Try primary operation first with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${this.config.fallbackTimeout}ms`));
        }, operationConfig?.timeout || this.config.fallbackTimeout);
      });
      
      const result = await Promise.race([
        primaryOperation(),
        timeoutPromise
      ]) as T;
      
      this.logger.debug(`Primary operation succeeded`, {
        operationType,
        operationId,
        executionTime: Date.now() - startTime
      });
      
      return result;
      
    } catch (error) {
      this.logger.warn(`Primary operation failed, activating fallback`, {
        operationType,
        operationId,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      });
      
      // Activate fallback
      return this.activateFallback(operationType, operationConfig, operationId, error as Error);
    }
  }
  
  /**
   * Update degradation level based on available operations
   */
  updateDegradationLevel(availableOperations: Set<OperationType>): void {
    const newLevel = calculateDegradationLevel(availableOperations, this.config.features);
    
    if (newLevel !== this.state.currentDegradationLevel) {
      const previousLevel = this.state.currentDegradationLevel;
      this.state.currentDegradationLevel = newLevel;
      
      this.logger.info('Degradation level changed', {
        from: previousLevel,
        to: newLevel,
        availableOperations: Array.from(availableOperations)
      });
      
      this.events.onDegradationLevelChange?.(newLevel, previousLevel);
      
      // Update feature availability
      this.updateFeatureAvailability(availableOperations);
    }
  }
  
  /**
   * Queue operation for later execution
   */
  queueOperation(
    operationType: OperationType,
    operation: () => Promise<any>,
    params: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): string {
    const operationId = generateOperationId();
    
    const queuedOperation: QueuedOperation = {
      id: operationId,
      operationType,
      operation,
      params,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts
    };
    
    // Check queue size limit
    if (this.state.queuedOperations.length >= this.config.maxQueueSize) {
      // Remove oldest low priority operation
      const lowPriorityIndex = this.state.queuedOperations.findIndex(op => op.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.state.queuedOperations.splice(lowPriorityIndex, 1);
      } else {
        // Remove oldest operation
        this.state.queuedOperations.shift();
      }
    }
    
    // Insert operation based on priority
    if (priority === 'high') {
      this.state.queuedOperations.unshift(queuedOperation);
    } else if (priority === 'medium') {
      const highPriorityCount = this.state.queuedOperations.filter(op => op.priority === 'high').length;
      this.state.queuedOperations.splice(highPriorityCount, 0, queuedOperation);
    } else {
      this.state.queuedOperations.push(queuedOperation);
    }
    
    this.logger.debug('Operation queued', {
      operationType,
      operationId,
      priority,
      queueSize: this.state.queuedOperations.length
    });
    
    this.events.onOperationQueued?.(queuedOperation);
    
    return operationId;
  }
  
  /**
   * Get mock data for operation
   */
  getMockData(operationType: OperationType): any {
    const config = this.config.mockDataConfigs.get(operationType);
    if (!config) {
      return null;
    }
    
    // Check cache first
    if (config.cacheKey) {
      const cached = this.state.mockDataCache.get(config.cacheKey);
      if (cached && cached.expiry > Date.now()) {
        this.logger.debug('Serving cached mock data', { operationType, cacheKey: config.cacheKey });
        return cached.data;
      }
    }
    
    // Generate or get mock data
    let mockData: any;
    
    switch (config.type) {
      case 'generated':
        mockData = config.generator ? config.generator() : null;
        break;
      case 'static':
        mockData = config.fallbackValue;
        break;
      case 'template':
        // Template-based generation would go here
        mockData = config.fallbackValue;
        break;
      default:
        mockData = config.fallbackValue;
    }
    
    // Cache the data
    if (config.cacheKey && mockData) {
      const expiry = Date.now() + (config.expiryTime || this.config.mockDataTTL);
      this.state.mockDataCache.set(config.cacheKey, { data: mockData, expiry });
      
      // Clean up cache if too large
      if (this.state.mockDataCache.size > this.config.mockDataCacheSize) {
        this.cleanupMockDataCache();
      }
    }
    
    this.logger.debug('Generated mock data', { operationType, type: config.type });
    this.events.onMockDataServed?.(operationType, mockData);
    
    return mockData;
  }
  
  /**
   * Get current state
   */
  getState(): FallbackManagerState {
    return { ...this.state };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FallbackManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger = createFallbackLogger(this.config);
    
    this.logger.info('Configuration updated', { newConfig });
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private async activateFallback(
    operationType: OperationType,
    operationConfig: Partial<FallbackOperationConfig> | undefined,
    operationId: string,
    error: Error
  ): Promise<any> {
    const strategy = operationConfig?.strategy || 
                   this.state.activeStrategies.get(operationType) || 
                   'error_message';
    
    this.state.lastFallbackActivation = Date.now();
    this.state.totalFallbackActivations++;
    
    this.logger.info('Activating fallback strategy', {
      operationType,
      strategy,
      operationId
    });
    
    this.events.onFallbackActivated?.(operationType, strategy);
    
    const startTime = Date.now();
    let fallbackData: any = null;
    let success = false;
    
    try {
      switch (strategy) {
        case 'mock_data':
          fallbackData = this.getMockData(operationType);
          success = fallbackData !== null;
          break;
          
        case 'alternative_source':
          if (operationConfig?.alternativeAction) {
            fallbackData = await operationConfig.alternativeAction();
            success = true;
          } else {
            fallbackData = { error: 'No alternative source available', fallback: true };
            success = false;
          }
          break;
          
        case 'queue_for_later':
          if (operationConfig?.operationType) {
            this.queueOperation(
              operationConfig.operationType,
              async () => { throw error; }, // Will be replaced with actual operation
              {},
              operationConfig.priority || 'medium'
            );
            fallbackData = { queued: true, message: 'Operation queued for when connection is restored' };
            success = true;
          }
          break;
          
        case 'error_message':
          fallbackData = {
            error: operationConfig?.errorMessage || `${operationType} is currently unavailable`,
            retryable: operationConfig?.retryable !== false,
            fallback: true
          };
          success = false;
          break;
          
        case 'disable_feature':
          // This would be handled at the component level
          fallbackData = { disabled: true, reason: 'Feature temporarily disabled' };
          success = false;
          break;
          
        case 'reduced_functionality':
          fallbackData = this.getReducedFunctionalityData(operationType);
          success = fallbackData !== null;
          break;
          
        default:
          fallbackData = { error: 'Unknown fallback strategy', fallback: true };
          success = false;
      }
      
      // Record operation history
      this.recordOperationHistory({
        id: operationId,
        operationType,
        strategy,
        timestamp: Date.now(),
        success,
        fallbackData,
        error: success ? undefined : error,
        executionTime: Date.now() - startTime
      });
      
      return fallbackData;
      
    } catch (fallbackError) {
      this.logger.error('Fallback strategy failed', {
        operationType,
        strategy,
        operationId,
        error: (fallbackError as Error).message
      });
      
      // Record failed fallback
      this.recordOperationHistory({
        id: operationId,
        operationType,
        strategy,
        timestamp: Date.now(),
        success: false,
        error: fallbackError as Error,
        executionTime: Date.now() - startTime
      });
      
      // Return basic error response
      return {
        error: 'Fallback mechanism failed',
        originalError: error.message,
        fallbackError: (fallbackError as Error).message,
        fallback: true
      };
    }
  }
  
  private getReducedFunctionalityData(operationType: OperationType): any {
    // Provide reduced functionality versions of data
    switch (operationType) {
      case 'ga4_query':
        return {
          metrics: { sessions: 0, users: 0, pageviews: 0 },
          note: 'Limited data available in offline mode',
          reducedFunctionality: true
        };
      default:
        return {
          reducedFunctionality: true,
          message: 'Limited functionality available'
        };
    }
  }
  
  private updateFeatureAvailability(availableOperations: Set<OperationType>): void {
    const previouslyDisabled = new Set(this.state.disabledFeatures);
    
    for (const feature of this.config.features) {
      const isAvailable = feature.requiredOperations.every(op => availableOperations.has(op));
      const isCurrentlyDisabled = this.state.disabledFeatures.has(feature.featureId);
      
      if (!isAvailable && !isCurrentlyDisabled) {
        // Disable feature
        this.state.disabledFeatures.add(feature.featureId);
        this.logger.info('Feature disabled', {
          featureId: feature.featureId,
          name: feature.name,
          reason: 'Required operations unavailable'
        });
        this.events.onFeatureDisabled?.(feature.featureId, 'Required operations unavailable');
        
      } else if (isAvailable && isCurrentlyDisabled) {
        // Restore feature
        this.state.disabledFeatures.delete(feature.featureId);
        this.logger.info('Feature restored', {
          featureId: feature.featureId,
          name: feature.name
        });
        this.events.onFeatureRestored?.(feature.featureId);
      }
    }
  }
  
  private startQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
    }
    
    this.queueProcessingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.queueRetryInterval);
  }
  
  private async processQueue(): Promise<void> {
    if (this.state.queuedOperations.length === 0) {
      return;
    }
    
    const operationsToProcess = this.state.queuedOperations.slice(0, 5); // Process up to 5 at a time
    
    for (const queuedOp of operationsToProcess) {
      try {
        this.logger.debug('Processing queued operation', {
          operationId: queuedOp.id,
          operationType: queuedOp.operationType,
          retryCount: queuedOp.retryCount
        });
        
        const result = await queuedOp.operation();
        
        // Remove from queue on success
        this.state.queuedOperations = this.state.queuedOperations.filter(op => op.id !== queuedOp.id);
        
        this.logger.info('Queued operation executed successfully', {
          operationId: queuedOp.id,
          operationType: queuedOp.operationType
        });
        
        this.events.onQueuedOperationExecuted?.(queuedOp, result);
        
      } catch (error) {
        queuedOp.retryCount++;
        
        if (queuedOp.retryCount >= queuedOp.maxRetries) {
          // Remove from queue after max retries
          this.state.queuedOperations = this.state.queuedOperations.filter(op => op.id !== queuedOp.id);
          
          this.logger.warn('Queued operation failed after max retries', {
            operationId: queuedOp.id,
            operationType: queuedOp.operationType,
            retryCount: queuedOp.retryCount,
            error: (error as Error).message
          });
        } else {
          this.logger.debug('Queued operation failed, will retry', {
            operationId: queuedOp.id,
            operationType: queuedOp.operationType,
            retryCount: queuedOp.retryCount,
            maxRetries: queuedOp.maxRetries
          });
        }
      }
    }
  }
  
  private startCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupMockDataCache();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }
  
  private cleanupMockDataCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, data] of this.state.mockDataCache.entries()) {
      if (data.expiry <= now) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.state.mockDataCache.delete(key);
    }
    
    // If still too large, remove oldest entries
    if (this.state.mockDataCache.size > this.config.mockDataCacheSize) {
      const entries = Array.from(this.state.mockDataCache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      
      const toRemove = entries.slice(0, this.state.mockDataCache.size - this.config.mockDataCacheSize);
      for (const [key] of toRemove) {
        this.state.mockDataCache.delete(key);
      }
    }
    
    if (keysToDelete.length > 0) {
      this.logger.debug('Cleaned up mock data cache', {
        removedEntries: keysToDelete.length,
        currentSize: this.state.mockDataCache.size
      });
    }
  }
  
  private recordOperationHistory(entry: FallbackOperationHistory): void {
    this.state.operationHistory.push(entry);
    
    // Keep only last 100 entries
    if (this.state.operationHistory.length > 100) {
      this.state.operationHistory = this.state.operationHistory.slice(-100);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FallbackManager;