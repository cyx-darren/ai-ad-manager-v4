/**
 * Credential Monitoring & Expiry Detection
 * 
 * This file implements credential expiry detection, monitoring,
 * health checks, and proactive alerting systems.
 */

import {
  GA4ServiceAccountCredential,
  CredentialId,
  CredentialAlias,
  CredentialOperationResult,
  CredentialError,
  CredentialLifecycleState
} from './types';

import {
  ICredentialService,
  CredentialServiceFactory
} from './services';

import {
  ICredentialLifecycle,
  CredentialLifecycleFactory
} from './lifecycle';

import {
  ICredentialRefreshService,
  CredentialRefreshServiceFactory,
  GA4TokenInfo
} from './credentialRefresh';

// ============================================================================
// CREDENTIAL MONITORING TYPES
// ============================================================================

/**
 * Monitoring alert severity levels
 */
export type MonitoringAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Monitoring check types
 */
export type MonitoringCheckType = 
  | 'expiry'        // Check credential expiry
  | 'token'         // Check token validity
  | 'connectivity'  // Check API connectivity
  | 'usage'         // Check usage patterns
  | 'security'      // Check security indicators
  | 'performance'   // Check performance metrics
  | 'health';       // Overall health check

/**
 * Monitoring configuration
 */
export interface CredentialMonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  
  // Expiry monitoring
  expiryWarningThresholds: number[]; // days before expiry
  tokenExpiryThreshold: number; // hours before token expiry
  
  // Health monitoring
  enableHealthChecks: boolean;
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  
  // Connectivity monitoring
  enableConnectivityChecks: boolean;
  connectivityCheckInterval: number; // milliseconds
  maxFailedConnections: number;
  
  // Usage monitoring
  enableUsageMonitoring: boolean;
  usageMonitoringInterval: number; // milliseconds
  unusedCredentialThreshold: number; // days
  
  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  performanceThresholds: {
    responseTime: number; // milliseconds
    errorRate: number; // percentage (0-1)
    throughput: number; // requests per minute
  };
  
  // Alert configuration
  alertChannels: MonitoringAlertChannel[];
  alertDeduplication: boolean;
  alertDeduplicationWindow: number; // milliseconds
  
  // Retention settings
  metricsRetentionPeriod: number; // milliseconds
  alertRetentionPeriod: number; // milliseconds
}

/**
 * Alert channel configuration
 */
export interface MonitoringAlertChannel {
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'teams' | 'pagerduty' | 'custom';
  endpoint: string;
  enabled: boolean;
  severityFilter: MonitoringAlertSeverity[];
  checkTypeFilter: MonitoringCheckType[];
  metadata?: Record<string, any>;
}

/**
 * Monitoring alert
 */
export interface MonitoringAlert {
  alertId: string;
  credentialId: CredentialId;
  checkType: MonitoringCheckType;
  severity: MonitoringAlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

/**
 * Monitoring check result
 */
export interface MonitoringCheckResult {
  checkId: string;
  credentialId: CredentialId;
  checkType: MonitoringCheckType;
  status: 'pass' | 'warning' | 'fail' | 'error';
  message: string;
  timestamp: string;
  duration: number; // milliseconds
  metrics?: Record<string, number>;
  details?: Record<string, any>;
}

/**
 * Credential health status
 */
export interface CredentialHealthStatus {
  credentialId: CredentialId;
  overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastChecked: string;
  
  // Expiry information
  expiryStatus: {
    isExpired: boolean;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    tokenExpiresAt: string | null;
    hoursUntilTokenExpiry: number | null;
  };
  
  // Connectivity status
  connectivityStatus: {
    isConnected: boolean;
    lastSuccessfulConnection: string | null;
    consecutiveFailures: number;
    averageResponseTime: number | null;
  };
  
  // Usage status
  usageStatus: {
    lastUsed: string | null;
    daysSinceLastUse: number | null;
    requestCount24h: number;
    requestCountWeek: number;
    requestCountMonth: number;
  };
  
  // Performance metrics
  performanceMetrics: {
    averageResponseTime: number | null;
    errorRate: number | null;
    throughput: number | null;
    lastUpdated: string | null;
  };
  
  // Active alerts
  activeAlerts: MonitoringAlert[];
  alertCount: {
    info: number;
    warning: number;
    error: number;
    critical: number;
  };
}

/**
 * Monitoring statistics
 */
export interface MonitoringStatistics {
  totalCredentials: number;
  healthyCredentials: number;
  warningCredentials: number;
  criticalCredentials: number;
  unknownCredentials: number;
  
  expiryInfo: {
    expiredCredentials: number;
    expiringWithin7Days: number;
    expiringWithin30Days: number;
  };
  
  connectivityInfo: {
    connectedCredentials: number;
    disconnectedCredentials: number;
    averageResponseTime: number;
  };
  
  alertInfo: {
    totalActiveAlerts: number;
    criticalAlerts: number;
    errorAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
  };
  
  lastUpdated: string;
}

// ============================================================================
// CREDENTIAL MONITORING SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential monitoring operations
 */
export interface ICredentialMonitoringService {
  // Configuration management
  setMonitoringConfig(config: CredentialMonitoringConfig): Promise<CredentialOperationResult<boolean>>;
  getMonitoringConfig(): Promise<CredentialOperationResult<CredentialMonitoringConfig>>;
  updateMonitoringConfig(updates: Partial<CredentialMonitoringConfig>): Promise<CredentialOperationResult<boolean>>;
  
  // Monitoring operations
  startMonitoring(): Promise<CredentialOperationResult<boolean>>;
  stopMonitoring(): Promise<CredentialOperationResult<boolean>>;
  isMonitoringActive(): boolean;
  
  // Health checks
  performHealthCheck(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialHealthStatus>>;
  performAllHealthChecks(): Promise<CredentialOperationResult<CredentialHealthStatus[]>>;
  getHealthStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialHealthStatus>>;
  
  // Specific monitoring checks
  checkCredentialExpiry(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>>;
  checkTokenValidity(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>>;
  checkConnectivity(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>>;
  checkUsagePatterns(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>>;
  checkPerformanceMetrics(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>>;
  
  // Alert management
  getActiveAlerts(credentialId?: CredentialId): Promise<CredentialOperationResult<MonitoringAlert[]>>;
  getAlertHistory(credentialId?: CredentialId): Promise<CredentialOperationResult<MonitoringAlert[]>>;
  resolveAlert(alertId: string): Promise<CredentialOperationResult<boolean>>;
  createCustomAlert(credentialId: CredentialId, alert: Partial<MonitoringAlert>): Promise<CredentialOperationResult<string>>;
  
  // Statistics and reporting
  getMonitoringStatistics(): Promise<CredentialOperationResult<MonitoringStatistics>>;
  generateHealthReport(): Promise<CredentialOperationResult<any>>;
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<CredentialOperationResult<string>>;
  
  // Event handling
  onMonitoringEvent(callback: (event: string, data: any) => void): void;
  emitMonitoringEvent(event: string, data: any): void;
}

// ============================================================================
// CREDENTIAL MONITORING SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Credential monitoring service implementation
 */
export class CredentialMonitoringService implements ICredentialMonitoringService {
  private credentialService: ICredentialService;
  private lifecycle: ICredentialLifecycle;
  private refreshService: ICredentialRefreshService;
  private config: CredentialMonitoringConfig;
  private isActive: boolean = false;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectivityCheckTimer: NodeJS.Timeout | null = null;
  
  // Data storage
  private healthStatuses: Map<CredentialId, CredentialHealthStatus> = new Map();
  private checkResults: Map<string, MonitoringCheckResult> = new Map();
  private alerts: Map<string, MonitoringAlert> = new Map();
  private performanceMetrics: Map<CredentialId, any> = new Map();
  
  // Event handlers
  private monitoringEventHandlers: Array<(event: string, data: any) => void> = [];
  
  constructor(
    credentialService?: ICredentialService,
    lifecycle?: ICredentialLifecycle,
    refreshService?: ICredentialRefreshService
  ) {
    this.credentialService = credentialService || CredentialServiceFactory.createSecure();
    this.lifecycle = lifecycle || CredentialLifecycleFactory.createDefault();
    this.refreshService = refreshService || CredentialRefreshServiceFactory.createSecure();
    this.config = this.getDefaultMonitoringConfig();
  }
  
  /**
   * Set monitoring configuration
   */
  async setMonitoringConfig(config: CredentialMonitoringConfig): Promise<CredentialOperationResult<boolean>> {
    try {
      this.validateMonitoringConfig(config);
      this.config = config;
      
      // Restart monitoring if active
      if (this.isActive) {
        await this.stopMonitoring();
        await this.startMonitoring();
      }
      
      this.emitMonitoringEvent('config_updated', { config });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to set monitoring config', 'SET_CONFIG_ERROR', undefined, 'setMonitoringConfig', error)
      };
    }
  }
  
  /**
   * Get monitoring configuration
   */
  async getMonitoringConfig(): Promise<CredentialOperationResult<CredentialMonitoringConfig>> {
    try {
      return {
        success: true,
        data: { ...this.config }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get monitoring config', 'GET_CONFIG_ERROR', undefined, 'getMonitoringConfig', error)
      };
    }
  }
  
  /**
   * Update monitoring configuration
   */
  async updateMonitoringConfig(updates: Partial<CredentialMonitoringConfig>): Promise<CredentialOperationResult<boolean>> {
    try {
      const updatedConfig = { ...this.config, ...updates };
      return await this.setMonitoringConfig(updatedConfig);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update monitoring config', 'UPDATE_CONFIG_ERROR', undefined, 'updateMonitoringConfig', error)
      };
    }
  }
  
  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<CredentialOperationResult<boolean>> {
    try {
      if (this.isActive) {
        return { success: true, data: true };
      }
      
      if (!this.config.enabled) {
        throw new CredentialError('Monitoring is disabled in configuration', 'MONITORING_DISABLED');
      }
      
      this.isActive = true;
      
      // Start main monitoring timer
      this.monitoringTimer = setInterval(async () => {
        await this.performMonitoringCycle();
      }, this.config.checkInterval);
      
      // Start health check timer if enabled
      if (this.config.enableHealthChecks) {
        this.healthCheckTimer = setInterval(async () => {
          await this.performAllHealthChecks();
        }, this.config.healthCheckInterval);
      }
      
      // Start connectivity check timer if enabled
      if (this.config.enableConnectivityChecks) {
        this.connectivityCheckTimer = setInterval(async () => {
          await this.performConnectivityChecks();
        }, this.config.connectivityCheckInterval);
      }
      
      this.emitMonitoringEvent('monitoring_started', { timestamp: new Date().toISOString() });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to start monitoring', 'START_MONITORING_ERROR', undefined, 'startMonitoring', error)
      };
    }
  }
  
  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<CredentialOperationResult<boolean>> {
    try {
      this.isActive = false;
      
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }
      
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      if (this.connectivityCheckTimer) {
        clearInterval(this.connectivityCheckTimer);
        this.connectivityCheckTimer = null;
      }
      
      this.emitMonitoringEvent('monitoring_stopped', { timestamp: new Date().toISOString() });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to stop monitoring', 'STOP_MONITORING_ERROR', undefined, 'stopMonitoring', error)
      };
    }
  }
  
  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Perform health check for a credential
   */
  async performHealthCheck(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialHealthStatus>> {
    try {
      const healthStatus = await this.generateHealthStatus(credentialId);
      this.healthStatuses.set(credentialId, healthStatus);
      
      // Process alerts based on health status
      await this.processHealthStatusAlerts(healthStatus);
      
      this.emitMonitoringEvent('health_check_completed', { credentialId, healthStatus });
      
      return {
        success: true,
        data: healthStatus
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Health check failed', 'HEALTH_CHECK_ERROR', credentialId, 'performHealthCheck', error)
      };
    }
  }
  
  /**
   * Perform health checks for all credentials
   */
  async performAllHealthChecks(): Promise<CredentialOperationResult<CredentialHealthStatus[]>> {
    try {
      // Get list of all credentials
      const credentialListResult = await this.credentialService.listCredentials();
      if (!credentialListResult.success || !credentialListResult.data) {
        throw credentialListResult.error || new CredentialError('Failed to list credentials', 'LIST_CREDENTIALS_ERROR');
      }
      
      const healthStatuses: CredentialHealthStatus[] = [];
      
      // Perform health check for each credential
      for (const credentialMetadata of credentialListResult.data) {
        const credentialId = credentialMetadata.version; // This would be the actual ID
        
        try {
          const healthCheckResult = await this.performHealthCheck(credentialId);
          if (healthCheckResult.success && healthCheckResult.data) {
            healthStatuses.push(healthCheckResult.data);
          }
        } catch (error) {
          // Continue with other credentials
        }
      }
      
      return {
        success: true,
        data: healthStatuses
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to perform all health checks', 'ALL_HEALTH_CHECKS_ERROR', undefined, 'performAllHealthChecks', error)
      };
    }
  }
  
  /**
   * Get health status for a credential
   */
  async getHealthStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialHealthStatus>> {
    try {
      const healthStatus = this.healthStatuses.get(credentialId);
      if (!healthStatus) {
        // Perform health check if not available
        return await this.performHealthCheck(credentialId);
      }
      
      return {
        success: true,
        data: healthStatus
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get health status', 'GET_HEALTH_STATUS_ERROR', credentialId, 'getHealthStatus', error)
      };
    }
  }
  
  /**
   * Check credential expiry
   */
  async checkCredentialExpiry(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      // Get credential lifecycle information
      const lifecycleResult = await this.lifecycle.getCurrentState(credentialId);
      if (!lifecycleResult.success || !lifecycleResult.data) {
        throw lifecycleResult.error || new CredentialError('Failed to get lifecycle state', 'LIFECYCLE_ERROR', credentialId);
      }
      
      const lifecycle = lifecycleResult.data;
      const now = new Date();
      let status: 'pass' | 'warning' | 'fail' | 'error' = 'pass';
      let message = 'Credential expiry status normal';
      
      if (lifecycle.expiresAt) {
        const expiryDate = new Date(lifecycle.expiresAt);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 0) {
          status = 'fail';
          message = 'Credential has expired';
        } else if (this.config.expiryWarningThresholds.some(threshold => daysUntilExpiry <= threshold)) {
          status = 'warning';
          message = `Credential expires in ${daysUntilExpiry} days`;
        }
      }
      
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'expiry',
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        metrics: {
          daysUntilExpiry: lifecycle.expiresAt ? 
            Math.ceil((new Date(lifecycle.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1
        }
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: true,
        data: checkResult
      };
    } catch (error) {
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'expiry',
        status: 'error',
        message: `Expiry check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Expiry check failed', 'EXPIRY_CHECK_ERROR', credentialId, 'checkCredentialExpiry', error)
      };
    }
  }
  
  /**
   * Check token validity
   */
  async checkTokenValidity(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      // Get token information
      const tokenResult = await this.refreshService.getTokenInfo(credentialId);
      
      let status: 'pass' | 'warning' | 'fail' | 'error' = 'pass';
      let message = 'Token validity normal';
      
      if (tokenResult.success && tokenResult.data) {
        const token = tokenResult.data;
        const now = new Date();
        const expiryDate = new Date(token.expiresAt);
        const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry <= 0) {
          status = 'fail';
          message = 'Token has expired';
        } else if (hoursUntilExpiry <= this.config.tokenExpiryThreshold) {
          status = 'warning';
          message = `Token expires in ${Math.ceil(hoursUntilExpiry)} hours`;
        }
      } else {
        status = 'warning';
        message = 'Token information not available';
      }
      
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'token',
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        metrics: tokenResult.success && tokenResult.data ? {
          hoursUntilExpiry: (new Date(tokenResult.data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
        } : {}
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: true,
        data: checkResult
      };
    } catch (error) {
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'token',
        status: 'error',
        message: `Token check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Token check failed', 'TOKEN_CHECK_ERROR', credentialId, 'checkTokenValidity', error)
      };
    }
  }
  
  /**
   * Check connectivity
   */
  async checkConnectivity(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      // This would perform actual connectivity test
      // For now, simulate a connectivity check
      const responseTime = Math.random() * 1000; // Simulate response time
      const isConnected = Math.random() > 0.1; // 90% success rate
      
      const status: 'pass' | 'warning' | 'fail' | 'error' = isConnected ? 'pass' : 'fail';
      const message = isConnected ? 'Connectivity normal' : 'Connection failed';
      
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'connectivity',
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        metrics: {
          responseTime,
          connected: isConnected ? 1 : 0
        }
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: true,
        data: checkResult
      };
    } catch (error) {
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'connectivity',
        status: 'error',
        message: `Connectivity check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Connectivity check failed', 'CONNECTIVITY_CHECK_ERROR', credentialId, 'checkConnectivity', error)
      };
    }
  }
  
  /**
   * Check usage patterns
   */
  async checkUsagePatterns(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      // This would analyze actual usage patterns
      // For now, simulate usage data
      const daysSinceLastUse = Math.floor(Math.random() * 30);
      const requestCount24h = Math.floor(Math.random() * 100);
      
      let status: 'pass' | 'warning' | 'fail' | 'error' = 'pass';
      let message = 'Usage patterns normal';
      
      if (daysSinceLastUse > this.config.unusedCredentialThreshold) {
        status = 'warning';
        message = `Credential unused for ${daysSinceLastUse} days`;
      }
      
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'usage',
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        metrics: {
          daysSinceLastUse,
          requestCount24h
        }
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: true,
        data: checkResult
      };
    } catch (error) {
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'usage',
        status: 'error',
        message: `Usage check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Usage check failed', 'USAGE_CHECK_ERROR', credentialId, 'checkUsagePatterns', error)
      };
    }
  }
  
  /**
   * Check performance metrics
   */
  async checkPerformanceMetrics(credentialId: CredentialId): Promise<CredentialOperationResult<MonitoringCheckResult>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      // This would analyze actual performance metrics
      // For now, simulate performance data
      const responseTime = Math.random() * 2000;
      const errorRate = Math.random() * 0.1;
      const throughput = Math.random() * 100;
      
      let status: 'pass' | 'warning' | 'fail' | 'error' = 'pass';
      let message = 'Performance metrics normal';
      
      const thresholds = this.config.performanceThresholds;
      if (responseTime > thresholds.responseTime || errorRate > thresholds.errorRate || throughput < thresholds.throughput) {
        status = 'warning';
        message = 'Performance metrics degraded';
      }
      
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'performance',
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        metrics: {
          responseTime,
          errorRate,
          throughput
        }
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: true,
        data: checkResult
      };
    } catch (error) {
      const checkResult: MonitoringCheckResult = {
        checkId,
        credentialId,
        checkType: 'performance',
        status: 'error',
        message: `Performance check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.checkResults.set(checkId, checkResult);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Performance check failed', 'PERFORMANCE_CHECK_ERROR', credentialId, 'checkPerformanceMetrics', error)
      };
    }
  }
  
  /**
   * Get active alerts
   */
  async getActiveAlerts(credentialId?: CredentialId): Promise<CredentialOperationResult<MonitoringAlert[]>> {
    try {
      const activeAlerts = Array.from(this.alerts.values())
        .filter(alert => !alert.resolved)
        .filter(alert => !credentialId || alert.credentialId === credentialId);
      
      return {
        success: true,
        data: activeAlerts
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get active alerts', 'GET_ACTIVE_ALERTS_ERROR', credentialId, 'getActiveAlerts', error)
      };
    }
  }
  
  /**
   * Get alert history
   */
  async getAlertHistory(credentialId?: CredentialId): Promise<CredentialOperationResult<MonitoringAlert[]>> {
    try {
      const alerts = Array.from(this.alerts.values())
        .filter(alert => !credentialId || alert.credentialId === credentialId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return {
        success: true,
        data: alerts
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get alert history', 'GET_ALERT_HISTORY_ERROR', credentialId, 'getAlertHistory', error)
      };
    }
  }
  
  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        throw new CredentialError('Alert not found', 'ALERT_NOT_FOUND');
      }
      
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.alerts.set(alertId, alert);
      
      this.emitMonitoringEvent('alert_resolved', { alertId, alert });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to resolve alert', 'RESOLVE_ALERT_ERROR', undefined, 'resolveAlert', error)
      };
    }
  }
  
  /**
   * Create custom alert
   */
  async createCustomAlert(credentialId: CredentialId, alert: Partial<MonitoringAlert>): Promise<CredentialOperationResult<string>> {
    try {
      const alertId = this.generateAlertId();
      
      const fullAlert: MonitoringAlert = {
        alertId,
        credentialId,
        checkType: alert.checkType || 'health',
        severity: alert.severity || 'info',
        title: alert.title || 'Custom Alert',
        message: alert.message || 'Custom alert created',
        timestamp: new Date().toISOString(),
        resolved: false,
        metadata: alert.metadata,
        tags: alert.tags
      };
      
      this.alerts.set(alertId, fullAlert);
      this.emitMonitoringEvent('alert_created', { alertId, alert: fullAlert });
      
      return {
        success: true,
        data: alertId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to create custom alert', 'CREATE_ALERT_ERROR', credentialId, 'createCustomAlert', error)
      };
    }
  }
  
  /**
   * Get monitoring statistics
   */
  async getMonitoringStatistics(): Promise<CredentialOperationResult<MonitoringStatistics>> {
    try {
      const healthStatuses = Array.from(this.healthStatuses.values());
      const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
      
      const statistics: MonitoringStatistics = {
        totalCredentials: healthStatuses.length,
        healthyCredentials: healthStatuses.filter(s => s.overallHealth === 'healthy').length,
        warningCredentials: healthStatuses.filter(s => s.overallHealth === 'warning').length,
        criticalCredentials: healthStatuses.filter(s => s.overallHealth === 'critical').length,
        unknownCredentials: healthStatuses.filter(s => s.overallHealth === 'unknown').length,
        
        expiryInfo: {
          expiredCredentials: healthStatuses.filter(s => s.expiryStatus.isExpired).length,
          expiringWithin7Days: healthStatuses.filter(s => 
            s.expiryStatus.daysUntilExpiry !== null && s.expiryStatus.daysUntilExpiry <= 7 && s.expiryStatus.daysUntilExpiry > 0
          ).length,
          expiringWithin30Days: healthStatuses.filter(s => 
            s.expiryStatus.daysUntilExpiry !== null && s.expiryStatus.daysUntilExpiry <= 30 && s.expiryStatus.daysUntilExpiry > 0
          ).length
        },
        
        connectivityInfo: {
          connectedCredentials: healthStatuses.filter(s => s.connectivityStatus.isConnected).length,
          disconnectedCredentials: healthStatuses.filter(s => !s.connectivityStatus.isConnected).length,
          averageResponseTime: this.calculateAverageResponseTime(healthStatuses)
        },
        
        alertInfo: {
          totalActiveAlerts: activeAlerts.length,
          criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
          errorAlerts: activeAlerts.filter(a => a.severity === 'error').length,
          warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
          infoAlerts: activeAlerts.filter(a => a.severity === 'info').length
        },
        
        lastUpdated: new Date().toISOString()
      };
      
      return {
        success: true,
        data: statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get monitoring statistics', 'GET_STATISTICS_ERROR', undefined, 'getMonitoringStatistics', error)
      };
    }
  }
  
  /**
   * Generate health report
   */
  async generateHealthReport(): Promise<CredentialOperationResult<any>> {
    try {
      const statisticsResult = await this.getMonitoringStatistics();
      if (!statisticsResult.success || !statisticsResult.data) {
        throw statisticsResult.error || new CredentialError('Failed to get statistics', 'STATISTICS_ERROR');
      }
      
      const activeAlertsResult = await this.getActiveAlerts();
      if (!activeAlertsResult.success || !activeAlertsResult.data) {
        throw activeAlertsResult.error || new CredentialError('Failed to get alerts', 'ALERTS_ERROR');
      }
      
      const report = {
        generatedAt: new Date().toISOString(),
        statistics: statisticsResult.data,
        activeAlerts: activeAlertsResult.data,
        healthStatuses: Array.from(this.healthStatuses.values()),
        summary: {
          overallHealth: this.calculateOverallHealth(statisticsResult.data),
          criticalIssues: activeAlertsResult.data.filter(a => a.severity === 'critical').length,
          recommendations: this.generateRecommendations(statisticsResult.data, activeAlertsResult.data)
        }
      };
      
      return {
        success: true,
        data: report
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to generate health report', 'GENERATE_REPORT_ERROR', undefined, 'generateHealthReport', error)
      };
    }
  }
  
  /**
   * Export metrics
   */
  async exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<CredentialOperationResult<string>> {
    try {
      const statisticsResult = await this.getMonitoringStatistics();
      if (!statisticsResult.success || !statisticsResult.data) {
        throw statisticsResult.error || new CredentialError('Failed to get statistics', 'STATISTICS_ERROR');
      }
      
      const statistics = statisticsResult.data;
      let exportData: string;
      
      switch (format) {
        case 'json':
          exportData = JSON.stringify({
            statistics,
            healthStatuses: Array.from(this.healthStatuses.values()),
            alerts: Array.from(this.alerts.values()),
            checkResults: Array.from(this.checkResults.values())
          }, null, 2);
          break;
          
        case 'csv':
          exportData = this.convertToCSV(statistics);
          break;
          
        case 'prometheus':
          exportData = this.convertToPrometheus(statistics);
          break;
          
        default:
          throw new CredentialError('Unsupported export format', 'UNSUPPORTED_FORMAT');
      }
      
      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to export metrics', 'EXPORT_METRICS_ERROR', undefined, 'exportMetrics', error)
      };
    }
  }
  
  /**
   * Register monitoring event handler
   */
  onMonitoringEvent(callback: (event: string, data: any) => void): void {
    this.monitoringEventHandlers.push(callback);
  }
  
  /**
   * Emit monitoring event
   */
  emitMonitoringEvent(event: string, data: any): void {
    this.monitoringEventHandlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        // Ignore handler errors
      }
    });
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private validateMonitoringConfig(config: CredentialMonitoringConfig): void {
    if (config.checkInterval <= 0) {
      throw new CredentialError('Check interval must be positive', 'INVALID_INTERVAL');
    }
    
    if (config.expiryWarningThresholds.some(t => t < 0)) {
      throw new CredentialError('Warning thresholds must be non-negative', 'INVALID_THRESHOLDS');
    }
  }
  
  private async performMonitoringCycle(): Promise<void> {
    try {
      // Get list of all credentials
      const credentialListResult = await this.credentialService.listCredentials();
      if (!credentialListResult.success || !credentialListResult.data) {
        return;
      }
      
      // Perform checks for each credential
      for (const credentialMetadata of credentialListResult.data) {
        const credentialId = credentialMetadata.version; // This would be the actual ID
        
        try {
          // Perform various checks
          await this.checkCredentialExpiry(credentialId);
          await this.checkTokenValidity(credentialId);
          
          if (this.config.enableUsageMonitoring) {
            await this.checkUsagePatterns(credentialId);
          }
          
          if (this.config.enablePerformanceMonitoring) {
            await this.checkPerformanceMetrics(credentialId);
          }
        } catch (error) {
          // Continue with other credentials
        }
      }
    } catch (error) {
      // Log error but continue monitoring
    }
  }
  
  private async performConnectivityChecks(): Promise<void> {
    try {
      const credentialListResult = await this.credentialService.listCredentials();
      if (!credentialListResult.success || !credentialListResult.data) {
        return;
      }
      
      for (const credentialMetadata of credentialListResult.data) {
        const credentialId = credentialMetadata.version;
        
        try {
          await this.checkConnectivity(credentialId);
        } catch (error) {
          // Continue with other credentials
        }
      }
    } catch (error) {
      // Log error but continue monitoring
    }
  }
  
  private async generateHealthStatus(credentialId: CredentialId): Promise<CredentialHealthStatus> {
    // Perform all health checks
    const expiryCheck = await this.checkCredentialExpiry(credentialId);
    const tokenCheck = await this.checkTokenValidity(credentialId);
    const connectivityCheck = await this.checkConnectivity(credentialId);
    const usageCheck = await this.checkUsagePatterns(credentialId);
    const performanceCheck = await this.checkPerformanceMetrics(credentialId);
    
    // Get active alerts for this credential
    const activeAlertsResult = await this.getActiveAlerts(credentialId);
    const activeAlerts = activeAlertsResult.success ? activeAlertsResult.data || [] : [];
    
    // Calculate overall health
    const checks = [expiryCheck, tokenCheck, connectivityCheck, usageCheck, performanceCheck];
    const failedChecks = checks.filter(c => c.success && c.data?.status === 'fail');
    const warningChecks = checks.filter(c => c.success && c.data?.status === 'warning');
    
    let overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    if (failedChecks.length > 0 || activeAlerts.some(a => a.severity === 'critical')) {
      overallHealth = 'critical';
    } else if (warningChecks.length > 0 || activeAlerts.some(a => a.severity === 'warning' || a.severity === 'error')) {
      overallHealth = 'warning';
    }
    
    // Build health status
    const healthStatus: CredentialHealthStatus = {
      credentialId,
      overallHealth,
      lastChecked: new Date().toISOString(),
      
      expiryStatus: {
        isExpired: expiryCheck.success && expiryCheck.data?.status === 'fail',
        expiresAt: null, // Would be populated from actual data
        daysUntilExpiry: expiryCheck.success ? expiryCheck.data?.metrics?.daysUntilExpiry || null : null,
        tokenExpiresAt: null, // Would be populated from token data
        hoursUntilTokenExpiry: tokenCheck.success ? tokenCheck.data?.metrics?.hoursUntilExpiry || null : null
      },
      
      connectivityStatus: {
        isConnected: connectivityCheck.success && connectivityCheck.data?.status === 'pass',
        lastSuccessfulConnection: connectivityCheck.success && connectivityCheck.data?.status === 'pass' ? 
          connectivityCheck.data.timestamp : null,
        consecutiveFailures: 0, // Would be tracked over time
        averageResponseTime: connectivityCheck.success ? connectivityCheck.data?.metrics?.responseTime || null : null
      },
      
      usageStatus: {
        lastUsed: null, // Would be populated from actual usage data
        daysSinceLastUse: usageCheck.success ? usageCheck.data?.metrics?.daysSinceLastUse || null : null,
        requestCount24h: usageCheck.success ? usageCheck.data?.metrics?.requestCount24h || 0 : 0,
        requestCountWeek: 0, // Would be calculated from actual data
        requestCountMonth: 0 // Would be calculated from actual data
      },
      
      performanceMetrics: {
        averageResponseTime: performanceCheck.success ? performanceCheck.data?.metrics?.responseTime || null : null,
        errorRate: performanceCheck.success ? performanceCheck.data?.metrics?.errorRate || null : null,
        throughput: performanceCheck.success ? performanceCheck.data?.metrics?.throughput || null : null,
        lastUpdated: performanceCheck.success ? performanceCheck.data?.timestamp || null : null
      },
      
      activeAlerts,
      alertCount: {
        info: activeAlerts.filter(a => a.severity === 'info').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length,
        error: activeAlerts.filter(a => a.severity === 'error').length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length
      }
    };
    
    return healthStatus;
  }
  
  private async processHealthStatusAlerts(healthStatus: CredentialHealthStatus): Promise<void> {
    // Create alerts based on health status
    if (healthStatus.overallHealth === 'critical') {
      await this.createCustomAlert(healthStatus.credentialId, {
        checkType: 'health',
        severity: 'critical',
        title: 'Critical Health Issue',
        message: 'Credential health status is critical'
      });
    } else if (healthStatus.overallHealth === 'warning') {
      await this.createCustomAlert(healthStatus.credentialId, {
        checkType: 'health',
        severity: 'warning',
        title: 'Health Warning',
        message: 'Credential health status requires attention'
      });
    }
  }
  
  private calculateAverageResponseTime(healthStatuses: CredentialHealthStatus[]): number {
    const responseTimes = healthStatuses
      .map(s => s.connectivityStatus.averageResponseTime)
      .filter(rt => rt !== null) as number[];
    
    if (responseTimes.length === 0) return 0;
    return responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
  }
  
  private calculateOverallHealth(statistics: MonitoringStatistics): 'healthy' | 'warning' | 'critical' {
    if (statistics.criticalCredentials > 0 || statistics.alertInfo.criticalAlerts > 0) {
      return 'critical';
    } else if (statistics.warningCredentials > 0 || statistics.alertInfo.errorAlerts > 0 || statistics.alertInfo.warningAlerts > 0) {
      return 'warning';
    }
    return 'healthy';
  }
  
  private generateRecommendations(statistics: MonitoringStatistics, activeAlerts: MonitoringAlert[]): string[] {
    const recommendations: string[] = [];
    
    if (statistics.expiryInfo.expiredCredentials > 0) {
      recommendations.push('Rotate expired credentials immediately');
    }
    
    if (statistics.expiryInfo.expiringWithin7Days > 0) {
      recommendations.push('Schedule rotation for credentials expiring within 7 days');
    }
    
    if (statistics.connectivityInfo.disconnectedCredentials > 0) {
      recommendations.push('Investigate connectivity issues for disconnected credentials');
    }
    
    if (statistics.alertInfo.criticalAlerts > 0) {
      recommendations.push('Address critical alerts immediately');
    }
    
    return recommendations;
  }
  
  private convertToCSV(statistics: MonitoringStatistics): string {
    // Convert statistics to CSV format
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Credentials', statistics.totalCredentials.toString()],
      ['Healthy Credentials', statistics.healthyCredentials.toString()],
      ['Warning Credentials', statistics.warningCredentials.toString()],
      ['Critical Credentials', statistics.criticalCredentials.toString()],
      ['Expired Credentials', statistics.expiryInfo.expiredCredentials.toString()],
      ['Active Alerts', statistics.alertInfo.totalActiveAlerts.toString()]
    ];
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  private convertToPrometheus(statistics: MonitoringStatistics): string {
    // Convert statistics to Prometheus format
    const metrics = [
      `credential_total ${statistics.totalCredentials}`,
      `credential_healthy ${statistics.healthyCredentials}`,
      `credential_warning ${statistics.warningCredentials}`,
      `credential_critical ${statistics.criticalCredentials}`,
      `credential_expired ${statistics.expiryInfo.expiredCredentials}`,
      `alert_active_total ${statistics.alertInfo.totalActiveAlerts}`,
      `alert_critical ${statistics.alertInfo.criticalAlerts}`,
      `alert_error ${statistics.alertInfo.errorAlerts}`,
      `alert_warning ${statistics.alertInfo.warningAlerts}`
    ];
    
    return metrics.join('\n');
  }
  
  private generateCheckId(): string {
    return `check_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private getDefaultMonitoringConfig(): CredentialMonitoringConfig {
    return {
      enabled: true,
      checkInterval: 5 * 60 * 1000, // 5 minutes
      
      expiryWarningThresholds: [30, 14, 7, 1], // days
      tokenExpiryThreshold: 6, // hours
      
      enableHealthChecks: true,
      healthCheckInterval: 15 * 60 * 1000, // 15 minutes
      healthCheckTimeout: 30 * 1000, // 30 seconds
      
      enableConnectivityChecks: true,
      connectivityCheckInterval: 10 * 60 * 1000, // 10 minutes
      maxFailedConnections: 3,
      
      enableUsageMonitoring: true,
      usageMonitoringInterval: 60 * 60 * 1000, // 1 hour
      unusedCredentialThreshold: 7, // days
      
      enablePerformanceMonitoring: true,
      performanceThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.05, // 5%
        throughput: 10 // requests per minute
      },
      
      alertChannels: [],
      alertDeduplication: true,
      alertDeduplicationWindow: 60 * 60 * 1000, // 1 hour
      
      metricsRetentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      alertRetentionPeriod: 90 * 24 * 60 * 60 * 1000 // 90 days
    };
  }
}

// ============================================================================
// CREDENTIAL MONITORING FACTORY
// ============================================================================

/**
 * Factory for creating credential monitoring service instances
 */
export class CredentialMonitoringServiceFactory {
  /**
   * Create default credential monitoring service
   */
  static createDefault(): CredentialMonitoringService {
    return new CredentialMonitoringService();
  }
  
  /**
   * Create secure credential monitoring service
   */
  static createSecure(): CredentialMonitoringService {
    const credentialService = CredentialServiceFactory.createSecure();
    const lifecycle = CredentialLifecycleFactory.createDefault();
    const refreshService = CredentialRefreshServiceFactory.createSecure();
    
    return new CredentialMonitoringService(credentialService, lifecycle, refreshService);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default monitoring configuration
 */
export function createDefaultMonitoringConfig(): CredentialMonitoringConfig {
  return new CredentialMonitoringService().getDefaultMonitoringConfig();
}

/**
 * Quick monitoring setup function
 */
export async function setupCredentialMonitoring(
  config?: Partial<CredentialMonitoringConfig>
): Promise<CredentialMonitoringService> {
  const monitoringService = CredentialMonitoringServiceFactory.createSecure();
  
  if (config) {
    const fullConfig = {
      ...createDefaultMonitoringConfig(),
      ...config
    };
    
    await monitoringService.setMonitoringConfig(fullConfig);
  }
  
  return monitoringService;
}