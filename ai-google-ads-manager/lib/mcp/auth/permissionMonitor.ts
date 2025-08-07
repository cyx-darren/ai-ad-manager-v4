/**
 * Permission Monitor
 * 
 * This file provides real-time permission status monitoring with configurable
 * polling intervals, health metrics, and WebSocket integration.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionErrorType
} from './permissionTypes';

import {
  PermissionErrorHandler,
  PermissionErrorCategory,
  PermissionErrorSeverity
} from './permissionErrorHandler';

// ============================================================================
// MONITORING CONFIGURATION TYPES
// ============================================================================

/**
 * Permission monitoring configuration
 */
export interface PermissionMonitorConfig {
  /** Polling interval in milliseconds */
  pollingInterval: number;
  /** Enable WebSocket monitoring */
  enableWebSocket: boolean;
  /** WebSocket URL for real-time updates */
  webSocketUrl?: string;
  /** Enable health metrics tracking */
  enableHealthMetrics: boolean;
  /** Enable performance optimization */
  enablePerformanceOptimization: boolean;
  /** Selective monitoring based on usage patterns */
  enableSelectiveMonitoring: boolean;
  /** Maximum monitoring history entries */
  maxHistoryEntries: number;
  /** Health check thresholds */
  healthThresholds: PermissionHealthThresholds;
  /** Performance settings */
  performanceSettings: {
    /** Maximum concurrent checks */
    maxConcurrentChecks: number;
    /** Request timeout in milliseconds */
    requestTimeout: number;
    /** Retry attempts for failed checks */
    retryAttempts: number;
  };
}

/**
 * Permission health thresholds
 */
export interface PermissionHealthThresholds {
  /** Minimum validity score (0-1) */
  minValidityScore: number;
  /** Minimum scope coverage (0-1) */
  minScopeCoverage: number;
  /** Warning threshold for token expiration (seconds) */
  expirationWarningThreshold: number;
  /** Critical threshold for token expiration (seconds) */
  expirationCriticalThreshold: number;
  /** Maximum acceptable error rate (0-1) */
  maxErrorRate: number;
  /** Minimum refresh success rate (0-1) */
  minRefreshSuccessRate: number;
}

/**
 * Permission health metrics
 */
export interface PermissionHealthMetrics {
  /** Overall health score (0-1) */
  overallScore: number;
  /** Token validity indicator */
  validity: {
    isValid: boolean;
    score: number;
    details: string;
  };
  /** Scope coverage metrics */
  scopeCoverage: {
    totalScopes: number;
    availableScopes: number;
    coverage: number;
    missingScopes: GA4OAuthScope[];
  };
  /** Token expiration status */
  expiration: {
    isExpired: boolean;
    timeToExpiry: number;
    expiresAt: Date;
    warningLevel: 'none' | 'warning' | 'critical';
  };
  /** Usage patterns */
  usage: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
  };
  /** Error tracking */
  errors: {
    totalErrors: number;
    errorRate: number;
    recentErrors: PermissionMonitorError[];
    errorsByType: Map<PermissionErrorType, number>;
  };
  /** Refresh statistics */
  refresh: {
    totalRefreshes: number;
    successfulRefreshes: number;
    failedRefreshes: number;
    successRate: number;
    lastRefresh: Date | null;
  };
}

/**
 * Permission monitoring status
 */
export enum PermissionMonitorStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error'
}

/**
 * Permission monitor event types
 */
export enum PermissionMonitorEvent {
  STATUS_CHANGED = 'status_changed',
  HEALTH_UPDATED = 'health_updated',
  PERMISSION_CHANGED = 'permission_changed',
  TOKEN_REFRESHED = 'token_refreshed',
  ERROR_DETECTED = 'error_detected',
  THRESHOLD_EXCEEDED = 'threshold_exceeded'
}

/**
 * Permission monitor error
 */
export interface PermissionMonitorError {
  /** Error ID */
  id: string;
  /** When error occurred */
  timestamp: Date;
  /** Error type */
  type: PermissionErrorType;
  /** Error category */
  category: PermissionErrorCategory;
  /** Error severity */
  severity: PermissionErrorSeverity;
  /** Error message */
  message: string;
  /** Additional context */
  context: Record<string, any>;
}

/**
 * Permission change event
 */
export interface PermissionChangeEvent {
  /** Event ID */
  id: string;
  /** When change occurred */
  timestamp: Date;
  /** Change type */
  changeType: 'permission_level' | 'scope_added' | 'scope_removed' | 'token_refreshed';
  /** Previous state */
  previousState: GA4TokenPermissions | null;
  /** Current state */
  currentState: GA4TokenPermissions;
  /** Affected operations */
  affectedOperations: GA4Operation[];
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'permission_update' | 'health_update' | 'error_notification';
  timestamp: string;
  data: any;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITOR_CONFIG: PermissionMonitorConfig = {
  pollingInterval: 30000, // 30 seconds
  enableWebSocket: true,
  enableHealthMetrics: true,
  enablePerformanceOptimization: true,
  enableSelectiveMonitoring: true,
  maxHistoryEntries: 1000,
  healthThresholds: {
    minValidityScore: 0.8,
    minScopeCoverage: 0.7,
    expirationWarningThreshold: 300, // 5 minutes
    expirationCriticalThreshold: 60, // 1 minute
    maxErrorRate: 0.1, // 10%
    minRefreshSuccessRate: 0.9 // 90%
  },
  performanceSettings: {
    maxConcurrentChecks: 3,
    requestTimeout: 10000, // 10 seconds
    retryAttempts: 2
  }
};

// ============================================================================
// PERMISSION MONITOR CLASS
// ============================================================================

/**
 * Real-time permission monitoring system
 */
export class PermissionMonitor {
  private config: PermissionMonitorConfig;
  private status: PermissionMonitorStatus = PermissionMonitorStatus.STOPPED;
  private pollingTimer: NodeJS.Timeout | null = null;
  private webSocket: WebSocket | null = null;
  private healthMetrics: PermissionHealthMetrics;
  private monitoringHistory: PermissionHealthMetrics[] = [];
  private eventListeners: Map<PermissionMonitorEvent, Set<Function>> = new Map();
  private errorHandler: PermissionErrorHandler;
  private activeChecks: Set<string> = new Set();
  private usagePatterns: Map<GA4Operation, number> = new Map();

  constructor(config?: Partial<PermissionMonitorConfig>) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
    this.errorHandler = new PermissionErrorHandler();
    this.healthMetrics = this.initializeHealthMetrics();
    this.initializeEventListeners();
  }

  /**
   * Start permission monitoring
   */
  public async start(): Promise<void> {
    if (this.status === PermissionMonitorStatus.RUNNING) {
      return;
    }

    try {
      this.status = PermissionMonitorStatus.STARTING;
      this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status });

      // Start polling
      if (this.config.pollingInterval > 0) {
        this.startPolling();
      }

      // Connect WebSocket
      if (this.config.enableWebSocket && this.config.webSocketUrl) {
        await this.connectWebSocket();
      }

      this.status = PermissionMonitorStatus.RUNNING;
      this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status });

      console.info('[PERMISSION_MONITOR] Monitoring started', {
        pollingInterval: this.config.pollingInterval,
        webSocketEnabled: this.config.enableWebSocket,
        healthMetricsEnabled: this.config.enableHealthMetrics
      });

    } catch (error) {
      this.status = PermissionMonitorStatus.ERROR;
      this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status, error });
      throw error;
    }
  }

  /**
   * Stop permission monitoring
   */
  public async stop(): Promise<void> {
    this.status = PermissionMonitorStatus.STOPPED;

    // Stop polling
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Close WebSocket
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // Clear active checks
    this.activeChecks.clear();

    this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status });

    console.info('[PERMISSION_MONITOR] Monitoring stopped');
  }

  /**
   * Pause monitoring
   */
  public pause(): void {
    if (this.status !== PermissionMonitorStatus.RUNNING) {
      return;
    }

    this.status = PermissionMonitorStatus.PAUSED;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status });
  }

  /**
   * Resume monitoring
   */
  public resume(): void {
    if (this.status !== PermissionMonitorStatus.PAUSED) {
      return;
    }

    this.status = PermissionMonitorStatus.RUNNING;
    
    if (this.config.pollingInterval > 0) {
      this.startPolling();
    }

    this.emitEvent(PermissionMonitorEvent.STATUS_CHANGED, { status: this.status });
  }

  /**
   * Check permissions manually
   */
  public async checkPermissions(): Promise<PermissionHealthMetrics> {
    const checkId = this.generateCheckId();
    
    if (this.activeChecks.size >= this.config.performanceSettings.maxConcurrentChecks) {
      throw new Error('Maximum concurrent checks reached');
    }

    try {
      this.activeChecks.add(checkId);
      
      const previousMetrics = { ...this.healthMetrics };
      this.healthMetrics = await this.performHealthCheck();
      
      // Update history
      this.addToHistory(this.healthMetrics);
      
      // Detect changes
      const changes = this.detectPermissionChanges(previousMetrics, this.healthMetrics);
      if (changes.length > 0) {
        this.emitEvent(PermissionMonitorEvent.PERMISSION_CHANGED, { changes });
      }
      
      // Check thresholds
      this.checkHealthThresholds(this.healthMetrics);
      
      this.emitEvent(PermissionMonitorEvent.HEALTH_UPDATED, { metrics: this.healthMetrics });
      
      return this.healthMetrics;

    } finally {
      this.activeChecks.delete(checkId);
    }
  }

  /**
   * Get current health metrics
   */
  public getHealthMetrics(): PermissionHealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * Get monitoring history
   */
  public getHistory(limit?: number): PermissionHealthMetrics[] {
    return limit ? this.monitoringHistory.slice(-limit) : [...this.monitoringHistory];
  }

  /**
   * Get monitoring status
   */
  public getStatus(): PermissionMonitorStatus {
    return this.status;
  }

  /**
   * Record operation usage
   */
  public recordUsage(operation: GA4Operation): void {
    if (!this.config.enableSelectiveMonitoring) {
      return;
    }

    const currentCount = this.usagePatterns.get(operation) || 0;
    this.usagePatterns.set(operation, currentCount + 1);
  }

  /**
   * Add event listener
   */
  public addEventListener(event: PermissionMonitorEvent, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: PermissionMonitorEvent, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PermissionMonitorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart polling if interval changed
    if (this.status === PermissionMonitorStatus.RUNNING && this.pollingTimer) {
      this.stopPolling();
      this.startPolling();
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Initialize health metrics
   */
  private initializeHealthMetrics(): PermissionHealthMetrics {
    return {
      overallScore: 0,
      validity: {
        isValid: false,
        score: 0,
        details: 'Not checked'
      },
      scopeCoverage: {
        totalScopes: 0,
        availableScopes: 0,
        coverage: 0,
        missingScopes: []
      },
      expiration: {
        isExpired: false,
        timeToExpiry: 0,
        expiresAt: new Date(),
        warningLevel: 'none'
      },
      usage: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        avgResponseTime: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        recentErrors: [],
        errorsByType: new Map()
      },
      refresh: {
        totalRefreshes: 0,
        successfulRefreshes: 0,
        failedRefreshes: 0,
        successRate: 0,
        lastRefresh: null
      }
    };
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    Object.values(PermissionMonitorEvent).forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Start polling
   */
  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.checkPermissions();
      } catch (error) {
        console.error('[PERMISSION_MONITOR] Polling error:', error);
        this.emitEvent(PermissionMonitorEvent.ERROR_DETECTED, { error });
      }
    }, this.config.pollingInterval);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Connect WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.config.webSocketUrl) {
      return;
    }

    try {
      this.webSocket = new WebSocket(this.config.webSocketUrl);
      
      this.webSocket.onopen = () => {
        console.info('[PERMISSION_MONITOR] WebSocket connected');
      };

      this.webSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[PERMISSION_MONITOR] WebSocket message error:', error);
        }
      };

      this.webSocket.onerror = (error) => {
        console.error('[PERMISSION_MONITOR] WebSocket error:', error);
        this.emitEvent(PermissionMonitorEvent.ERROR_DETECTED, { error });
      };

      this.webSocket.onclose = () => {
        console.warn('[PERMISSION_MONITOR] WebSocket disconnected');
        this.webSocket = null;
      };

    } catch (error) {
      console.error('[PERMISSION_MONITOR] WebSocket connection failed:', error);
      throw error;
    }
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'permission_update':
        this.emitEvent(PermissionMonitorEvent.PERMISSION_CHANGED, message.data);
        break;
      case 'health_update':
        this.emitEvent(PermissionMonitorEvent.HEALTH_UPDATED, message.data);
        break;
      case 'error_notification':
        this.emitEvent(PermissionMonitorEvent.ERROR_DETECTED, message.data);
        break;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<PermissionHealthMetrics> {
    // Simulate permission checking (in real implementation, this would check actual permissions)
    const metrics: PermissionHealthMetrics = {
      overallScore: 0.85,
      validity: {
        isValid: true,
        score: 0.9,
        details: 'Token is valid and active'
      },
      scopeCoverage: {
        totalScopes: 6,
        availableScopes: 5,
        coverage: 0.83,
        missingScopes: [GA4OAuthScope.ANALYTICS_EDIT]
      },
      expiration: {
        isExpired: false,
        timeToExpiry: 1800, // 30 minutes
        expiresAt: new Date(Date.now() + 1800000),
        warningLevel: 'warning'
      },
      usage: {
        totalRequests: this.healthMetrics.usage.totalRequests + 1,
        successfulRequests: this.healthMetrics.usage.successfulRequests + 1,
        failedRequests: this.healthMetrics.usage.failedRequests,
        successRate: 0.95,
        avgResponseTime: 250
      },
      errors: {
        totalErrors: this.healthMetrics.errors.totalErrors,
        errorRate: 0.05,
        recentErrors: this.healthMetrics.errors.recentErrors,
        errorsByType: this.healthMetrics.errors.errorsByType
      },
      refresh: {
        totalRefreshes: this.healthMetrics.refresh.totalRefreshes,
        successfulRefreshes: this.healthMetrics.refresh.successfulRefreshes,
        failedRefreshes: this.healthMetrics.refresh.failedRefreshes,
        successRate: 0.95,
        lastRefresh: this.healthMetrics.refresh.lastRefresh
      }
    };

    return metrics;
  }

  /**
   * Detect permission changes
   */
  private detectPermissionChanges(
    previous: PermissionHealthMetrics,
    current: PermissionHealthMetrics
  ): PermissionChangeEvent[] {
    const changes: PermissionChangeEvent[] = [];

    // Check validity changes
    if (previous.validity.isValid !== current.validity.isValid) {
      changes.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        changeType: 'token_refreshed',
        previousState: null,
        currentState: {} as GA4TokenPermissions,
        affectedOperations: []
      });
    }

    // Check scope changes
    if (previous.scopeCoverage.availableScopes !== current.scopeCoverage.availableScopes) {
      const changeType = current.scopeCoverage.availableScopes > previous.scopeCoverage.availableScopes
        ? 'scope_added' : 'scope_removed';
      
      changes.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        changeType,
        previousState: null,
        currentState: {} as GA4TokenPermissions,
        affectedOperations: []
      });
    }

    return changes;
  }

  /**
   * Check health thresholds
   */
  private checkHealthThresholds(metrics: PermissionHealthMetrics): void {
    const thresholds = this.config.healthThresholds;

    // Check validity threshold
    if (metrics.validity.score < thresholds.minValidityScore) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'validity',
        threshold: thresholds.minValidityScore,
        actual: metrics.validity.score
      });
    }

    // Check scope coverage threshold
    if (metrics.scopeCoverage.coverage < thresholds.minScopeCoverage) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'scope_coverage',
        threshold: thresholds.minScopeCoverage,
        actual: metrics.scopeCoverage.coverage
      });
    }

    // Check expiration thresholds
    if (metrics.expiration.timeToExpiry <= thresholds.expirationCriticalThreshold) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'expiration_critical',
        threshold: thresholds.expirationCriticalThreshold,
        actual: metrics.expiration.timeToExpiry
      });
    } else if (metrics.expiration.timeToExpiry <= thresholds.expirationWarningThreshold) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'expiration_warning',
        threshold: thresholds.expirationWarningThreshold,
        actual: metrics.expiration.timeToExpiry
      });
    }

    // Check error rate threshold
    if (metrics.errors.errorRate > thresholds.maxErrorRate) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'error_rate',
        threshold: thresholds.maxErrorRate,
        actual: metrics.errors.errorRate
      });
    }

    // Check refresh success rate threshold
    if (metrics.refresh.successRate < thresholds.minRefreshSuccessRate) {
      this.emitEvent(PermissionMonitorEvent.THRESHOLD_EXCEEDED, {
        type: 'refresh_success_rate',
        threshold: thresholds.minRefreshSuccessRate,
        actual: metrics.refresh.successRate
      });
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: PermissionHealthMetrics): void {
    this.monitoringHistory.push({ ...metrics });
    
    // Limit history size
    if (this.monitoringHistory.length > this.config.maxHistoryEntries) {
      this.monitoringHistory.shift();
    }
  }

  /**
   * Emit event
   */
  private emitEvent(event: PermissionMonitorEvent, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[PERMISSION_MONITOR] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Generate unique check ID
   */
  private generateCheckId(): string {
    return `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating permission monitors
 */
export class PermissionMonitorFactory {
  /**
   * Create standard monitor
   */
  public static createStandard(config?: Partial<PermissionMonitorConfig>): PermissionMonitor {
    return new PermissionMonitor(config);
  }

  /**
   * Create high-frequency monitor
   */
  public static createHighFrequency(): PermissionMonitor {
    return new PermissionMonitor({
      pollingInterval: 15000, // 15 seconds
      enableWebSocket: true,
      enableHealthMetrics: true,
      enablePerformanceOptimization: true,
      healthThresholds: {
        minValidityScore: 0.9,
        minScopeCoverage: 0.8,
        expirationWarningThreshold: 600, // 10 minutes
        expirationCriticalThreshold: 120, // 2 minutes
        maxErrorRate: 0.05, // 5%
        minRefreshSuccessRate: 0.95 // 95%
      }
    });
  }

  /**
   * Create low-frequency monitor
   */
  public static createLowFrequency(): PermissionMonitor {
    return new PermissionMonitor({
      pollingInterval: 300000, // 5 minutes
      enableWebSocket: false,
      enableHealthMetrics: true,
      enablePerformanceOptimization: true,
      healthThresholds: {
        minValidityScore: 0.7,
        minScopeCoverage: 0.6,
        expirationWarningThreshold: 900, // 15 minutes
        expirationCriticalThreshold: 300, // 5 minutes
        maxErrorRate: 0.15, // 15%
        minRefreshSuccessRate: 0.85 // 85%
      }
    });
  }
}

/**
 * Create a standard permission monitor
 */
export function createPermissionMonitor(config?: Partial<PermissionMonitorConfig>): PermissionMonitor {
  return PermissionMonitorFactory.createStandard(config);
}

/**
 * Global permission monitor instance (singleton pattern)
 */
let globalPermissionMonitor: PermissionMonitor | null = null;

/**
 * Get global permission monitor instance
 */
export function getGlobalPermissionMonitor(): PermissionMonitor {
  if (!globalPermissionMonitor) {
    globalPermissionMonitor = createPermissionMonitor();
  }
  return globalPermissionMonitor;
}

/**
 * Set global permission monitor instance
 */
export function setGlobalPermissionMonitor(monitor: PermissionMonitor): void {
  globalPermissionMonitor = monitor;
}