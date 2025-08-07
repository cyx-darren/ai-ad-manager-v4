/**
 * MCP Client Infrastructure
 * 
 * This file provides the foundational MCP client implementation for the frontend.
 * It handles connection management, state tracking, and communication with the MCP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { HTTPMCPClient, createHTTPMCPClient } from './httpClient';

// Authentication imports for Phase 6 (Subtask 28.1)
import { MCPAuthConfig, MCPAuthCredentials, MCPAuthStatus, MCPAuthEvents } from './auth/authTypes';
import { MCPAuthManager, createMCPAuthManager } from './auth/authManager';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Connection states for the MCP client
 */
export enum MCPConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

/**
 * Connection pooling configuration
 */
export interface MCPConnectionPoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionIdleTimeout?: number;
  connectionLifetime?: number;
  enablePooling?: boolean;
}

/**
 * Advanced retry configuration
 */
export interface MCPRetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitterEnabled?: boolean;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Configuration options for MCP client
 */
export interface MCPClientConfig {
  serverUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  enableLogging?: boolean;
  
  // Phase 3: Advanced features
  poolConfig?: MCPConnectionPoolConfig;
  retryConfig?: MCPRetryConfig;
  healthCheckInterval?: number;
  enableAdvancedReconnection?: boolean;
  connectionMetrics?: boolean;
  
  // Phase 4: State management & Events
  enableStatePersistence?: boolean;
  stateStorageKey?: string;
  loggingConfig?: MCPLoggingConfig;
  enableEnhancedEvents?: boolean;
  connectionHistoryLimit?: number;
  autoRestore?: boolean;
  
  // Phase 5: Configuration & Environment
  environmentConfig?: MCPEnvironmentConfig;
  validationConfig?: MCPValidationConfig;
  debugConfig?: MCPDebugConfig;
  enableEnvironmentOverrides?: boolean;
  
  // Phase 6: Authentication & Security (Subtask 28.1)
  authConfig?: MCPAuthConfig;
  enableAuthentication?: boolean;
}

/**
 * Connection event handlers (Enhanced for Phase 4)
 */
export interface MCPConnectionEvents {
  onStateChange?: (state: MCPConnectionState, previousState: MCPConnectionState) => void;
  onError?: (error: Error, context?: string) => void;
  onConnect?: (connectionInfo: { duration: number; attempt: number }) => void;
  onDisconnect?: (reason?: string) => void;
  onReconnect?: (attempt: number, delay: number) => void;
  
  // Phase 4: Enhanced lifecycle events
  onConnectionAttempt?: (attempt: number, serverUrl: string) => void;
  onPoolConnection?: (poolSize: number, connectionId: string) => void;
  onHealthCheckSuccess?: (duration: number) => void;
  onHealthCheckFailure?: (error: Error, duration: number) => void;
  onMetricsUpdate?: (metrics: MCPConnectionMetrics) => void;
  onConfigChange?: (newConfig: Partial<MCPClientConfig>) => void;
  onStateRestore?: (restoredState: MCPPersistedState) => void;
  onStatePersist?: (state: MCPPersistedState) => void;
  
  // Phase 6: Authentication events (Subtask 28.1)
  onAuthSuccess?: (credentials: MCPAuthCredentials) => void;
  onAuthFailure?: (error: Error, context?: string) => void;
  onTokenRefresh?: (newCredentials: MCPAuthCredentials) => void;
  onTokenExpired?: (expiredCredentials: MCPAuthCredentials) => void;
  onAuthStatusChange?: (status: MCPAuthStatus) => void;
}

/**
 * Persistent state interface for Phase 4
 */
export interface MCPPersistedState {
  lastConnectedServer?: string;
  lastConnectionTime?: number;
  reconnectAttempts?: number;
  totalConnections?: number;
  preferredPoolSize?: number;
  lastHealthCheckTime?: number;
  connectionHistory?: Array<{
    timestamp: number;
    success: boolean;
    duration: number;
    error?: string;
  }>;
}

/**
 * Advanced logging configuration for Phase 4
 */
export interface MCPLoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableMetricsLogging?: boolean;
  enableStateLogging?: boolean;
  enablePerformanceLogging?: boolean;
  logToConsole?: boolean;
  logToStorage?: boolean;
  maxLogEntries?: number;
}

/**
 * Environment-specific configuration for Phase 5
 */
export interface MCPEnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  debugMode?: boolean;
  enableDetailedLogging?: boolean;
  enablePerformanceMonitoring?: boolean;
  connectionTimeout?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
}

/**
 * Connection validation rules for Phase 5
 */
export interface MCPValidationConfig {
  validateServerUrl?: boolean;
  allowedProtocols?: string[];
  allowedDomains?: string[];
  requireHttps?: boolean;
  validateCertificates?: boolean;
  maxConnectionTime?: number;
  minReconnectDelay?: number;
  maxReconnectDelay?: number;
}

/**
 * Debugging utilities configuration for Phase 5
 */
export interface MCPDebugConfig {
  enableDebugMode?: boolean;
  captureNetworkLogs?: boolean;
  enableVerboseLogging?: boolean;
  trackConnectionLifecycle?: boolean;
  exportDebugData?: boolean;
  debugStorageKey?: string;
}

/**
 * Connection metrics for monitoring
 */
export interface MCPConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalReconnections: number;
  averageConnectionTime: number;
  lastConnectionDuration: number;
  healthChecksPassed: number;
  healthChecksFailed: number;
  dataTransferred: number;
}

/**
 * MCP client status and metrics
 */
export interface MCPClientStatus {
  state: MCPConnectionState;
  connected: boolean;
  lastConnected?: Date;
  lastError?: Error;
  reconnectAttempts: number;
  uptime: number;
  
  // Phase 3: Enhanced metrics
  metrics?: MCPConnectionMetrics;
  poolStatus?: {
    activeConnections: number;
    idleConnections: number;
    totalPoolSize: number;
  };
  nextRetryAt?: Date;
  retryBackoffMs?: number;
}

// ============================================================================
// MCP CLIENT CLASS
// ============================================================================

/**
 * MCP Client implementation with connection management and state tracking
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private httpClient: HTTPMCPClient | null = null;
  private state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private previousState: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private config: Required<MCPClientConfig>;
  private events: MCPConnectionEvents = {};
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectedAt: Date | null = null;
  private lastError: Error | null = null;
  private healthMonitoringInterval: NodeJS.Timeout | null = null;
  
  // Phase 3: Advanced connection features
  private connectionPool: Array<{ client: Client; transport: any; lastUsed: Date; idle: boolean; id: string }> = [];
  private metrics: MCPConnectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalReconnections: 0,
    averageConnectionTime: 0,
    lastConnectionDuration: 0,
    healthChecksPassed: 0,
    healthChecksFailed: 0,
    dataTransferred: 0
  };
  private connectionStartTime: Date | null = null;
  private nextRetryAt: Date | null = null;
  private currentBackoffMs = 0;
  
  // Phase 4: State management & Events
  private persistedState: MCPPersistedState = {};
  private connectionHistory: Array<{ timestamp: number; success: boolean; duration: number; error?: string }> = [];
  private logEntries: Array<{ timestamp: number; level: string; message: string; context?: any }> = [];
  private statePersistenceInterval: NodeJS.Timeout | null = null;
  private currentConnectionId: string | null = null;
  
  // Phase 5: Configuration & Environment
  private debugData: Array<{ timestamp: number; type: string; data: any }> = [];
  private networkLogs: Array<{ timestamp: number; type: 'request' | 'response' | 'error'; data: any }> = [];
  private currentEnvironment: 'development' | 'staging' | 'production' = 'development';
  private validationErrors: Array<{ timestamp: number; field: string; error: string; value: any }> = [];
  
  // Phase 6: Authentication & Security (Subtask 28.1)
  private authCredentials: MCPAuthCredentials | null = null;
  private authStatus: MCPAuthStatus | null = null;
  private authEvents: MCPAuthEvents = {};
  private lastAuthRefresh: number | null = null;
  private authRefreshTimeout: NodeJS.Timeout | null = null;
  private authManager: MCPAuthManager | null = null;

  constructor(config: MCPClientConfig = {}, events: MCPConnectionEvents = {}) {
    // Set default configuration with Phase 3 enhancements
    this.config = {
      serverUrl: config.serverUrl || process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 5,
      retryDelay: config.retryDelay || 1000,
      maxRetryDelay: config.maxRetryDelay || 30000,
      enableLogging: config.enableLogging ?? true,
      
      // Phase 3: Advanced configuration defaults
      poolConfig: {
        maxConnections: config.poolConfig?.maxConnections || 5,
        minConnections: config.poolConfig?.minConnections || 1,
        connectionIdleTimeout: config.poolConfig?.connectionIdleTimeout || 300000, // 5 minutes
        connectionLifetime: config.poolConfig?.connectionLifetime || 3600000, // 1 hour
        enablePooling: config.poolConfig?.enablePooling ?? false
      },
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 10,
        baseDelay: config.retryConfig?.baseDelay || 1000,
        maxDelay: config.retryConfig?.maxDelay || 60000,
        backoffMultiplier: config.retryConfig?.backoffMultiplier || 2,
        jitterEnabled: config.retryConfig?.jitterEnabled ?? true,
        retryCondition: config.retryConfig?.retryCondition || ((error: Error) => {
          // Default retry condition: retry on network errors, timeouts, and server errors
          const retryableErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
          return retryableErrors.some(code => error.message.includes(code)) || 
                 error.message.includes('timeout') ||
                 error.message.includes('Server Error');
        })
      },
      healthCheckInterval: config.healthCheckInterval || 30000,
      enableAdvancedReconnection: config.enableAdvancedReconnection ?? true,
      connectionMetrics: config.connectionMetrics ?? true,
      
      // Phase 4: State management & Events defaults
      enableStatePersistence: config.enableStatePersistence ?? false,
      stateStorageKey: config.stateStorageKey || 'mcp-client-state',
      loggingConfig: {
        level: config.loggingConfig?.level || 'info',
        enableMetricsLogging: config.loggingConfig?.enableMetricsLogging ?? false,
        enableStateLogging: config.loggingConfig?.enableStateLogging ?? false,
        enablePerformanceLogging: config.loggingConfig?.enablePerformanceLogging ?? false,
        logToConsole: config.loggingConfig?.logToConsole ?? true,
        logToStorage: config.loggingConfig?.logToStorage ?? false,
        maxLogEntries: config.loggingConfig?.maxLogEntries || 1000
      },
      enableEnhancedEvents: config.enableEnhancedEvents ?? false,
      connectionHistoryLimit: config.connectionHistoryLimit || 100,
      autoRestore: config.autoRestore ?? false,
      
      // Phase 5: Configuration & Environment defaults
      environmentConfig: {
        environment: config.environmentConfig?.environment || this.detectEnvironment(),
        debugMode: config.environmentConfig?.debugMode ?? (process.env.NODE_ENV === 'development'),
        enableDetailedLogging: config.environmentConfig?.enableDetailedLogging ?? (process.env.NODE_ENV === 'development'),
        enablePerformanceMonitoring: config.environmentConfig?.enablePerformanceMonitoring ?? false,
        connectionTimeout: config.environmentConfig?.connectionTimeout || (process.env.NODE_ENV === 'development' ? 60000 : 30000),
        healthCheckInterval: config.environmentConfig?.healthCheckInterval || (process.env.NODE_ENV === 'development' ? 60000 : 30000),
        maxRetries: config.environmentConfig?.maxRetries || (process.env.NODE_ENV === 'development' ? 15 : 10)
      },
      validationConfig: {
        validateServerUrl: config.validationConfig?.validateServerUrl ?? true,
        allowedProtocols: config.validationConfig?.allowedProtocols || ['http', 'https', 'ws', 'wss'],
        allowedDomains: config.validationConfig?.allowedDomains || [],
        requireHttps: config.validationConfig?.requireHttps ?? (process.env.NODE_ENV === 'production'),
        validateCertificates: config.validationConfig?.validateCertificates ?? (process.env.NODE_ENV === 'production'),
        maxConnectionTime: config.validationConfig?.maxConnectionTime || 300000, // 5 minutes
        minReconnectDelay: config.validationConfig?.minReconnectDelay || 1000,
        maxReconnectDelay: config.validationConfig?.maxReconnectDelay || 300000
      },
      debugConfig: {
        enableDebugMode: config.debugConfig?.enableDebugMode ?? (process.env.NODE_ENV === 'development'),
        captureNetworkLogs: config.debugConfig?.captureNetworkLogs ?? (process.env.NODE_ENV === 'development'),
        enableVerboseLogging: config.debugConfig?.enableVerboseLogging ?? false,
        trackConnectionLifecycle: config.debugConfig?.trackConnectionLifecycle ?? (process.env.NODE_ENV === 'development'),
        exportDebugData: config.debugConfig?.exportDebugData ?? false,
        debugStorageKey: config.debugConfig?.debugStorageKey || 'mcp-client-debug'
      },
      enableEnvironmentOverrides: config.enableEnvironmentOverrides ?? true,
      
      // Phase 6: Authentication & Security defaults (Subtask 28.1)
      enableAuthentication: config.enableAuthentication ?? false,
      authConfig: {
        enableAuthentication: config.authConfig?.enableAuthentication ?? false,
        tokenRefreshThreshold: config.authConfig?.tokenRefreshThreshold ?? 5, // 5 minutes
        maxTokenAge: config.authConfig?.maxTokenAge ?? (24 * 60 * 60 * 1000), // 24 hours
        fallbackToAnonymous: config.authConfig?.fallbackToAnonymous ?? true,
        strictValidation: config.authConfig?.strictValidation ?? (process.env.NODE_ENV === 'production'),
        debugAuth: config.authConfig?.debugAuth ?? (process.env.NODE_ENV === 'development')
      }
    };

    this.events = events;
    
    // Phase 6: Initialize authentication events (Subtask 28.1)
    this.authEvents = {
      onAuthSuccess: events.onAuthSuccess,
      onAuthFailure: events.onAuthFailure,
      onTokenRefresh: events.onTokenRefresh,
      onTokenExpired: events.onTokenExpired,
      onAuthStatusChange: events.onAuthStatusChange
    };

    // Initialize current backoff with base delay
    this.currentBackoffMs = this.config.retryConfig!.baseDelay!;

    // Phase 4: Initialize state management
    this.initializeStatePersistence();

    // Phase 5: Initialize environment and validation
    this.initializeEnvironmentSettings();
    this.currentEnvironment = this.config.environmentConfig!.environment;

    // Phase 6: Initialize authentication (Subtask 28.1 - Phase 2)
    this.initializeAuthentication();

    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.reconnect = this.reconnect.bind(this);
    this.advancedReconnect = this.advancedReconnect.bind(this);
    this.persistState = this.persistState.bind(this);
    this.restoreState = this.restoreState.bind(this);
    this.validateConfiguration = this.validateConfiguration.bind(this);
  }

  // ============================================================================
  // PHASE 5: ENVIRONMENT DETECTION AND VALIDATION
  // ============================================================================

  /**
   * Detect the current environment based on available indicators
   */
  private detectEnvironment(): 'development' | 'staging' | 'production' {
    // Check explicit environment variables
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV?.toLowerCase();
      if (nodeEnv === 'production') return 'production';
      if (nodeEnv === 'staging') return 'staging';
      if (nodeEnv === 'development') return 'development';
      
      // Check for other common environment indicators
      if (process.env.VERCEL_ENV === 'production' || process.env.HEROKU_APP_NAME) return 'production';
      if (process.env.VERCEL_ENV === 'preview' || process.env.STAGING) return 'staging';
    }

    // Check browser environment indicators
    if (typeof window !== 'undefined') {
      const hostname = window.location?.hostname;
      if (hostname) {
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('0.0.0.0')) {
          return 'development';
        }
        if (hostname.includes('staging') || hostname.includes('preview') || hostname.includes('dev.')) {
          return 'staging';
        }
        // Assume production for all other domains
        return 'production';
      }
    }

    // Default to development
    return 'development';
  }

  /**
   * Initialize environment-specific settings
   */
  private initializeEnvironmentSettings(): void {
    const envConfig = this.config.environmentConfig!;
    
    // Apply environment-specific overrides if enabled
    if (this.config.enableEnvironmentOverrides) {
      this.applyEnvironmentOverrides();
    }

    // Initialize debug mode if enabled
    if (envConfig.debugMode) {
      this.enhancedLog('info', 'Debug mode enabled', {
        environment: envConfig.environment,
        debugConfig: this.config.debugConfig
      });
    }

    // Initialize performance monitoring
    if (envConfig.enablePerformanceMonitoring) {
      this.enhancedLog('info', 'Performance monitoring enabled');
    }

    this.enhancedLog('info', 'Environment settings initialized', {
      environment: envConfig.environment,
      debugMode: envConfig.debugMode,
      detailedLogging: envConfig.enableDetailedLogging
    });
  }

  /**
   * Apply environment-specific configuration overrides
   */
  private applyEnvironmentOverrides(): void {
    const env = this.config.environmentConfig!.environment;
    
    // Production environment overrides
    if (env === 'production') {
      // More conservative settings for production
      this.config.loggingConfig!.level = 'warn';
      this.config.loggingConfig!.logToConsole = false;
      this.config.debugConfig!.enableDebugMode = false;
      this.config.debugConfig!.captureNetworkLogs = false;
      this.config.debugConfig!.enableVerboseLogging = false;
      
      this.enhancedLog('info', 'Applied production environment overrides');
    }
    
    // Development environment overrides
    else if (env === 'development') {
      // More verbose settings for development
      this.config.loggingConfig!.level = 'debug';
      this.config.loggingConfig!.enableMetricsLogging = true;
      this.config.loggingConfig!.enableStateLogging = true;
      this.config.debugConfig!.enableDebugMode = true;
      this.config.debugConfig!.captureNetworkLogs = true;
      
      this.enhancedLog('debug', 'Applied development environment overrides');
    }
    
    // Staging environment overrides
    else if (env === 'staging') {
      // Balanced settings for staging
      this.config.loggingConfig!.level = 'info';
      this.config.debugConfig!.enableDebugMode = true;
      this.config.debugConfig!.captureNetworkLogs = false;
      
      this.enhancedLog('info', 'Applied staging environment overrides');
    }
  }

  /**
   * Validate configuration settings and server parameters
   */
  private validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validationConfig = this.config.validationConfig!;

    // Validate server URL
    if (validationConfig.validateServerUrl) {
      const urlValidation = this.validateServerUrl(this.config.serverUrl);
      if (!urlValidation.isValid) {
        errors.push(...urlValidation.errors);
      }
    }

    // Validate connection timeouts
    if (this.config.timeout < 1000) {
      errors.push('Connection timeout must be at least 1000ms');
    }

    if (this.config.timeout > validationConfig.maxConnectionTime!) {
      errors.push(`Connection timeout cannot exceed ${validationConfig.maxConnectionTime}ms`);
    }

    // Validate retry configuration
    if (this.config.retryConfig!.baseDelay! < validationConfig.minReconnectDelay!) {
      errors.push(`Base retry delay must be at least ${validationConfig.minReconnectDelay}ms`);
    }

    if (this.config.retryConfig!.maxDelay! > validationConfig.maxReconnectDelay!) {
      errors.push(`Max retry delay cannot exceed ${validationConfig.maxReconnectDelay}ms`);
    }

    // Log validation errors if any
    if (errors.length > 0) {
      this.validationErrors.push({
        timestamp: Date.now(),
        field: 'configuration',
        error: errors.join('; '),
        value: { serverUrl: this.config.serverUrl, timeout: this.config.timeout }
      });

      this.enhancedLog('warn', 'Configuration validation failed', { errors });
    } else {
      this.enhancedLog('debug', 'Configuration validation passed');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate server URL according to validation rules
   */
  private validateServerUrl(url: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validationConfig = this.config.validationConfig!;

    try {
      const parsedUrl = new URL(url);
      
      // Check allowed protocols
      if (!validationConfig.allowedProtocols!.includes(parsedUrl.protocol.slice(0, -1))) {
        errors.push(`Protocol '${parsedUrl.protocol}' is not allowed. Allowed: ${validationConfig.allowedProtocols!.join(', ')}`);
      }

      // Check HTTPS requirement
      if (validationConfig.requireHttps && parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'wss:') {
        errors.push('HTTPS/WSS is required for this environment');
      }

      // Check allowed domains
      if (validationConfig.allowedDomains!.length > 0) {
        const hostname = parsedUrl.hostname;
        const isAllowed = validationConfig.allowedDomains!.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain)
        );
        
        if (!isAllowed) {
          errors.push(`Domain '${hostname}' is not in the allowed domains list`);
        }
      }

    } catch (error) {
      errors.push(`Invalid URL format: ${(error as Error).message}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  // ============================================================================
  // PHASE 4: STATE PERSISTENCE & ENHANCED LOGGING
  // ============================================================================

  /**
   * Initialize state persistence system
   */
  private initializeStatePersistence(): void {
    if (!this.config.enableStatePersistence) {
      return;
    }

    // Try to restore previous state
    if (this.config.autoRestore) {
      this.restoreState();
    }

    // Set up automatic state persistence
    this.statePersistenceInterval = setInterval(() => {
      this.persistState();
    }, 30000); // Persist state every 30 seconds

    this.enhancedLog('info', 'State persistence initialized', {
      storageKey: this.config.stateStorageKey,
      autoRestore: this.config.autoRestore
    });
  }

  /**
   * Initialize authentication system (Subtask 28.1 - Phase 2)
   */
  private initializeAuthentication(): void {
    if (!this.config.enableAuthentication || !this.config.authConfig) {
      this.enhancedLog('debug', 'Authentication disabled or not configured');
      return;
    }

    try {
      // Create authentication manager with config and events
      this.authManager = createMCPAuthManager(this.config.authConfig, this.authEvents);
      
      // Initialize auth status
      this.authStatus = this.authManager.getAuthStatus();
      this.authCredentials = this.authManager.getCredentials();

      this.enhancedLog('info', 'Authentication system initialized', {
        enableAuthentication: this.config.authConfig.enableAuthentication,
        strictValidation: this.config.authConfig.strictValidation,
        tokenRefreshThreshold: this.config.authConfig.tokenRefreshThreshold
      });

      // Fire authentication status change event
      this.authEvents.onAuthStatusChange?.(this.authStatus);

    } catch (error) {
      this.enhancedLog('error', 'Failed to initialize authentication system', { error });
      
      // If strict validation is disabled, continue without auth
      if (!this.config.authConfig?.strictValidation) {
        this.enhancedLog('warn', 'Continuing without authentication due to lenient config');
        this.authStatus = { isAuthenticated: false, hasValidToken: false };
      } else {
        // Re-throw error for strict validation
        throw error;
      }
    }
  }

  /**
   * Enhanced logging with Phase 4 features
   */
  private enhancedLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any): void {
    const loggingConfig = this.config.loggingConfig!;
    
    // Check if this log level should be recorded
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (logLevels[level] < logLevels[loggingConfig.level]) {
      return;
    }

    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      context
    };

    // Add to internal log storage
    if (loggingConfig.logToStorage) {
      this.logEntries.push(logEntry);
      
      // Trim log entries if exceeding limit
      if (this.logEntries.length > loggingConfig.maxLogEntries!) {
        this.logEntries = this.logEntries.slice(-loggingConfig.maxLogEntries!);
      }
    }

    // Log to console if enabled
    if (loggingConfig.logToConsole) {
      const timestamp = new Date(logEntry.timestamp).toISOString();
      const prefix = `[MCP Client ${timestamp}] ${level.toUpperCase()}:`;
      
      switch (level) {
        case 'error':
          console.error(prefix, message, context || '');
          break;
        case 'warn':
          console.warn(prefix, message, context || '');
          break;
        case 'debug':
          console.debug(prefix, message, context || '');
          break;
        default:
          console.log(prefix, message, context || '');
      }
    }
  }

  /**
   * Persist current state to storage
   */
  private persistState(): void {
    if (!this.config.enableStatePersistence) {
      return;
    }

    try {
      const stateToStore: MCPPersistedState = {
        lastConnectedServer: this.config.serverUrl,
        lastConnectionTime: this.connectedAt?.getTime(),
        reconnectAttempts: this.reconnectAttempts,
        totalConnections: this.metrics.totalConnections,
        preferredPoolSize: this.connectionPool.length,
        lastHealthCheckTime: Date.now(),
        connectionHistory: this.connectionHistory.slice(-50) // Keep last 50 entries
      };

      // Store in localStorage (browser) or equivalent
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.config.stateStorageKey!, JSON.stringify(stateToStore));
      }

      this.persistedState = stateToStore;
      
      // Fire event
      if (this.config.enableEnhancedEvents) {
        this.events.onStatePersist?.(stateToStore);
      }

      this.enhancedLog('debug', 'State persisted successfully', { stateKeys: Object.keys(stateToStore) });
    } catch (error) {
      this.enhancedLog('warn', 'Failed to persist state', { error: (error as Error).message });
    }
  }

  /**
   * Restore state from storage
   */
  private restoreState(): void {
    if (!this.config.enableStatePersistence) {
      return;
    }

    try {
      let restoredState: MCPPersistedState | null = null;

      // Restore from localStorage (browser) or equivalent
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedState = localStorage.getItem(this.config.stateStorageKey!);
        if (storedState) {
          restoredState = JSON.parse(storedState);
        }
      }

      if (restoredState) {
        this.persistedState = restoredState;
        
        // Restore connection history
        if (restoredState.connectionHistory) {
          this.connectionHistory = restoredState.connectionHistory;
        }

        // Update metrics with historical data
        if (restoredState.totalConnections) {
          this.metrics.totalConnections = restoredState.totalConnections;
        }

        // Fire event
        if (this.config.enableEnhancedEvents) {
          this.events.onStateRestore?.(restoredState);
        }

        this.enhancedLog('info', 'State restored successfully', { 
          restoredKeys: Object.keys(restoredState),
          connectionHistory: restoredState.connectionHistory?.length || 0
        });
      }
    } catch (error) {
      this.enhancedLog('warn', 'Failed to restore state', { error: (error as Error).message });
    }
  }

  /**
   * Add connection attempt to history
   */
  private addToConnectionHistory(success: boolean, duration: number, error?: string): void {
    const historyEntry = {
      timestamp: Date.now(),
      success,
      duration,
      error
    };

    this.connectionHistory.push(historyEntry);

    // Trim history if it exceeds the limit
    const limit = this.config.connectionHistoryLimit!;
    if (this.connectionHistory.length > limit) {
      this.connectionHistory = this.connectionHistory.slice(-limit);
    }

    // Log if performance logging is enabled
    if (this.config.loggingConfig!.enablePerformanceLogging) {
      this.enhancedLog('debug', 'Connection attempt recorded', historyEntry);
    }
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Establish connection to MCP server (Simplified HTTP approach)
   */
  async connect(): Promise<void> {
    if (this.state === MCPConnectionState.CONNECTED || this.state === MCPConnectionState.CONNECTING) {
      this.enhancedLog('debug', 'Already connected or connecting', { currentState: this.state });
      return;
    }

    // Use simple HTTP client for now
    if (this.config.serverUrl.startsWith('http')) {
      return this.connectViaHTTP();
    }

    // Fallback to SSE transport for other protocols
    return this.connectViaSSE();
  }

  /**
   * Connect using simple HTTP API calls
   */
  private async connectViaHTTP(): Promise<void> {
    this.setState(MCPConnectionState.CONNECTING);
    
    try {
      this.httpClient = createHTTPMCPClient(this.config.serverUrl);
      await this.httpClient.connect();
      
      this.setState(MCPConnectionState.CONNECTED);
      this.connectedAt = new Date();
      this.reconnectAttempts = 0;
      
      this.events.onConnect?.({
        duration: 0, // HTTP connection is immediate
        attempt: this.reconnectAttempts + 1
      });
      
      this.enhancedLog('info', 'HTTP MCP connection established');
      
    } catch (error) {
      this.setState(MCPConnectionState.ERROR);
      this.events.onError?.(error as Error, 'HTTP connection');
      throw error;
    }
  }

  /**
   * Connect using SSE transport (original method)
   */
  private async connectViaSSE(): Promise<void> {

    // Phase 5: Validate configuration before connecting
    const validation = this.validateConfiguration();
    if (!validation.isValid) {
      const error = new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      this.enhancedLog('error', 'Connection aborted due to configuration validation errors', { 
        errors: validation.errors 
      });
      throw error;
    }

    this.setState(MCPConnectionState.CONNECTING);
    this.connectionStartTime = new Date();
    this.currentConnectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.enhancedLog('info', `Attempting to connect to MCP server at ${this.config.serverUrl}...`, {
      serverUrl: this.config.serverUrl,
      connectionId: this.currentConnectionId,
      attempt: this.reconnectAttempts + 1,
      environment: this.currentEnvironment
    });

    // Phase 5: Capture network activity if debugging enabled
    if (this.config.debugConfig!.captureNetworkLogs) {
      this.addNetworkLog('request', {
        type: 'connection_attempt',
        url: this.config.serverUrl,
        connectionId: this.currentConnectionId,
        timestamp: Date.now()
      });
    }

    // Phase 4: Enhanced connection attempt event
    if (this.config.enableEnhancedEvents) {
      this.events.onConnectionAttempt?.(this.reconnectAttempts + 1, this.config.serverUrl);
    }

    // Update metrics
    if (this.config.connectionMetrics) {
      this.metrics.totalConnections++;
    }

    try {
      // Check for available pooled connection first
      if (this.config.poolConfig!.enablePooling) {
        const pooledConnection = this.getPooledConnection();
        if (pooledConnection) {
          this.client = pooledConnection.client;
          this.transport = pooledConnection.transport;
          this.log('Using pooled connection');
          
          // Update connection timing
          const connectionDuration = Date.now() - this.connectionStartTime!.getTime();
          this.updateConnectionMetrics(connectionDuration, true);
          
          this.setState(MCPConnectionState.CONNECTED);
          this.connectedAt = new Date();
          const currentAttempt = this.reconnectAttempts;
          this.reconnectAttempts = 0;
          
          // Phase 4: Enhanced connect event for pooled connection
          if (this.config.enableEnhancedEvents) {
            this.events.onConnect?.({ duration: connectionDuration, attempt: currentAttempt + 1 });
          } else {
            // Backward compatibility
            this.events.onConnect?.({ duration: connectionDuration, attempt: currentAttempt + 1 });
          }
          
          return;
        }
      }

      // Create new transport based on server URL
      if (this.config.serverUrl.startsWith('http')) {
        // HTTP/SSE transport for web connections
        // Use the base URL without appending /mcp/connect - let SSEClientTransport handle it
        this.transport = new SSEClientTransport(new URL(this.config.serverUrl));
      } else {
        // For now, default to SSE transport
        // StdioClientTransport is mainly for server-side or local connections
        this.transport = new SSEClientTransport(new URL(this.config.serverUrl));
      }

      // Initialize MCP client with transport
      this.client = new Client(
        {
          name: 'ai-ad-manager-frontend',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );

      // Connect to the MCP server
      await this.client.connect(this.transport);
      
      // Set up connection timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      // Wait for connection or timeout
      await Promise.race([
        this.waitForConnection(),
        timeoutPromise
      ]);

      // Calculate connection duration and update metrics
      const connectionDuration = Date.now() - this.connectionStartTime!.getTime();
      this.updateConnectionMetrics(connectionDuration, true);

      this.enhancedLog('info', `Connection established successfully in ${connectionDuration}ms`, {
        connectionId: this.currentConnectionId,
        duration: connectionDuration,
        attempt: this.reconnectAttempts + 1,
        serverUrl: this.config.serverUrl
      });

      this.setState(MCPConnectionState.CONNECTED);
      this.connectedAt = new Date();
      const currentAttempt = this.reconnectAttempts;
      this.reconnectAttempts = 0;
      this.currentBackoffMs = this.config.retryConfig!.baseDelay!; // Reset backoff

      // Phase 4: Enhanced connect event
      if (this.config.enableEnhancedEvents) {
        this.events.onConnect?.({ duration: connectionDuration, attempt: currentAttempt + 1 });
      } else {
        // Backward compatibility
        this.events.onConnect?.({ duration: connectionDuration, attempt: currentAttempt + 1 });
      }

      // Add to connection history
      this.addToConnectionHistory(true, connectionDuration);

      // Add to connection pool if enabled
      if (this.config.poolConfig!.enablePooling && this.client && this.transport) {
        this.addToPool(this.client, this.transport);
        
        // Phase 4: Pool connection event
        if (this.config.enableEnhancedEvents) {
          this.events.onPoolConnection?.(this.connectionPool.length, this.currentConnectionId!);
        }
      }

    } catch (error) {
      this.lastError = error as Error;
      const errorMessage = (error as Error).message;
      
      // Calculate failure duration
      const failedDuration = this.connectionStartTime ? 
        Date.now() - this.connectionStartTime.getTime() : 0;
      
      this.enhancedLog('error', `Connection failed: ${errorMessage}`, {
        connectionId: this.currentConnectionId,
        duration: failedDuration,
        attempt: this.reconnectAttempts + 1,
        serverUrl: this.config.serverUrl,
        errorType: error.constructor.name
      });
      
      // Update failure metrics
      if (this.config.connectionMetrics) {
        this.metrics.failedConnections++;
        if (this.connectionStartTime) {
          this.updateConnectionMetrics(failedDuration, false);
        }
      }
      
      // Add to connection history
      this.addToConnectionHistory(false, failedDuration, errorMessage);
      
      this.setState(MCPConnectionState.ERROR);
      
      // Phase 4: Enhanced error event
      if (this.config.enableEnhancedEvents) {
        this.events.onError?.(error as Error, `Connection attempt ${this.reconnectAttempts + 1}`);
      } else {
        // Backward compatibility
        this.events.onError?.(error as Error, `Connection attempt ${this.reconnectAttempts + 1}`);
      }
      
      // Cleanup on failure
      await this.cleanup();
      
      // Trigger advanced reconnection if enabled
      if (this.config.enableAdvancedReconnection && this.shouldRetry(error as Error)) {
        await this.advancedReconnect();
      }
      
      throw error;
    }
  }

  /**
   * Wait for connection to be established
   */
  private async waitForConnection(): Promise<void> {
    // Simple connection verification
    // In a real implementation, you might ping the server or check capabilities
    return new Promise((resolve) => {
      setTimeout(resolve, 100); // Small delay to simulate connection establishment
    });
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.state === MCPConnectionState.DISCONNECTED) {
      return;
    }

    this.log('Disconnecting from MCP server...');
    
    // Clear any pending reconnection attempts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      await this.cleanup();
      
      this.setState(MCPConnectionState.DISCONNECTED);
      this.connectedAt = null;
      this.events.onDisconnect?.();
      this.log('Disconnected successfully');

    } catch (error) {
      this.log(`Error during disconnect: ${error}`, 'error');
    }
  }

  /**
   * Clean up client and transport resources (Enhanced for Phase 4)
   */
  private async cleanup(): Promise<void> {
    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Phase 4: Stop state persistence
      if (this.statePersistenceInterval) {
        clearInterval(this.statePersistenceInterval);
        this.statePersistenceInterval = null;
      }

      // Clear connection pool if enabled
      if (this.config.poolConfig!.enablePooling) {
        await this.clearPool();
      }

      // Close MCP client connection
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      // Close transport
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      // Close HTTP client
      if (this.httpClient) {
        await this.httpClient.disconnect();
        this.httpClient = null;
      }

      // Phase 4: Final state persistence before cleanup
      if (this.config.enableStatePersistence) {
        this.persistState();
      }

      this.currentConnectionId = null;

    } catch (error) {
      this.enhancedLog('warn', `Error during cleanup: ${error}`, {
        connectionId: this.currentConnectionId,
        errorType: error.constructor.name
      });
    }
  }

  /**
   * Reconnect to MCP server with exponential backoff (Legacy Phase 2 method)
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.retryAttempts) {
      this.log('Max reconnection attempts reached', 'error');
      this.setState(MCPConnectionState.ERROR);
      return;
    }

    const delay = Math.min(
      this.config.retryDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxRetryDelay
    );

    this.reconnectAttempts++;
    this.setState(MCPConnectionState.RECONNECTING);
    
    this.log(`Reconnection attempt ${this.reconnectAttempts}/${this.config.retryAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        
        // Phase 4: Enhanced reconnect event
        if (this.config.enableEnhancedEvents) {
          this.events.onReconnect?.(this.reconnectAttempts, delay);
        } else {
          // Backward compatibility
          this.events.onReconnect?.(this.reconnectAttempts, delay);
        }
      } catch (error) {
        this.log(`Reconnection attempt ${this.reconnectAttempts} failed: ${error}`, 'error');
        await this.reconnect(); // Try again
      }
    }, delay);
  }

  /**
   * Phase 3: Advanced reconnection with exponential backoff and jitter
   */
  private async advancedReconnect(): Promise<void> {
    const retryConfig = this.config.retryConfig!;
    
    if (this.reconnectAttempts >= retryConfig.maxRetries!) {
      this.log(`Max advanced reconnection attempts reached (${retryConfig.maxRetries})`, 'error');
      this.setState(MCPConnectionState.ERROR);
      return;
    }

    // Calculate exponential backoff with jitter
    this.currentBackoffMs = Math.min(
      this.currentBackoffMs * retryConfig.backoffMultiplier!,
      retryConfig.maxDelay!
    );

    // Add jitter if enabled (randomness to prevent thundering herd)
    const jitter = retryConfig.jitterEnabled ? 
      Math.random() * 0.3 * this.currentBackoffMs : 0;
    const delay = this.currentBackoffMs + jitter;

    this.reconnectAttempts++;
    this.nextRetryAt = new Date(Date.now() + delay);
    this.setState(MCPConnectionState.RECONNECTING);
    
    this.log(`Advanced reconnection attempt ${this.reconnectAttempts}/${retryConfig.maxRetries} in ${Math.round(delay)}ms (backoff: ${this.currentBackoffMs}ms, jitter: ${Math.round(jitter)}ms)`);

    // Update metrics
    if (this.config.connectionMetrics) {
      this.metrics.totalReconnections++;
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        this.log(`Advanced reconnection successful after ${this.reconnectAttempts} attempts`);
        
        // Phase 4: Enhanced reconnect event
        if (this.config.enableEnhancedEvents) {
          this.events.onReconnect?.(this.reconnectAttempts, delay);
        } else {
          // Backward compatibility
          this.events.onReconnect?.(this.reconnectAttempts, delay);
        }
      } catch (error) {
        this.log(`Advanced reconnection attempt ${this.reconnectAttempts} failed: ${error}`, 'error');
        
        // Check if we should continue retrying
        if (this.shouldRetry(error as Error)) {
          await this.advancedReconnect(); // Try again with increased backoff
        } else {
          this.log('Stopping reconnection attempts due to non-retryable error', 'error');
          this.setState(MCPConnectionState.ERROR);
        }
      }
    }, delay);
  }

  /**
   * Determine if an error is retryable based on retry configuration
   */
  private shouldRetry(error: Error): boolean {
    const retryConfig = this.config.retryConfig!;
    
    // Check if we've exceeded max retries
    if (this.reconnectAttempts >= retryConfig.maxRetries!) {
      return false;
    }

    // Use custom retry condition if provided
    if (retryConfig.retryCondition) {
      return retryConfig.retryCondition(error);
    }

    // Default retry logic (already implemented in config)
    return true;
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Update connection state and notify listeners (Enhanced for Phase 4)
   */
  private setState(newState: MCPConnectionState): void {
    if (this.state !== newState) {
      this.previousState = this.state;
      this.state = newState;
      
      // Enhanced logging
      this.enhancedLog('info', `State changed: ${this.previousState} → ${newState}`, {
        previousState: this.previousState,
        newState,
        timestamp: Date.now(),
        connectionId: this.currentConnectionId
      });
      
      // Enhanced event with previous state
      if (this.config.enableEnhancedEvents) {
        this.events.onStateChange?.(newState, this.previousState);
      } else {
        // Backward compatibility
        this.events.onStateChange?.(newState, this.previousState);
      }
      
      // State logging if enabled
      if (this.config.loggingConfig!.enableStateLogging) {
        this.enhancedLog('debug', 'State transition details', {
          from: this.previousState,
          to: newState,
          duration: this.connectedAt ? Date.now() - this.connectedAt.getTime() : 0,
          reconnectAttempts: this.reconnectAttempts
        });
      }
    }
  }

  /**
   * Get current client status with Phase 3 enhancements
   */
  getStatus(): MCPClientStatus {
    return {
      state: this.state,
      connected: this.state === MCPConnectionState.CONNECTED,
      lastConnected: this.connectedAt,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.connectedAt ? Date.now() - this.connectedAt.getTime() : 0,
      
      // Phase 3: Enhanced status
      metrics: this.config.connectionMetrics ? { ...this.metrics } : undefined,
      poolStatus: this.config.poolConfig!.enablePooling ? {
        activeConnections: this.connectionPool.filter(conn => !conn.idle).length,
        idleConnections: this.connectionPool.filter(conn => conn.idle).length,
        totalPoolSize: this.connectionPool.length
      } : undefined,
      nextRetryAt: this.nextRetryAt,
      retryBackoffMs: this.currentBackoffMs
    };
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.state === MCPConnectionState.CONNECTED;
  }

  /**
   * Get the MCP client instance (only when connected)
   */
  getClient(): Client | null {
    if (this.isConnected()) {
      return this.client;
    }
    return null;
  }

  /**
   * Perform a health check on the connection (Enhanced for Phase 3)
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      if (this.config.connectionMetrics) {
        this.metrics.healthChecksFailed++;
      }
      return false;
    }

    const healthCheckStart = Date.now();

    try {
      // Try to list available tools as a health check
      const result = await this.client.listTools();
      const healthCheckDuration = Date.now() - healthCheckStart;
      
      this.enhancedLog('debug', `Health check passed (${healthCheckDuration}ms)`, {
        duration: healthCheckDuration,
        connectionId: this.currentConnectionId,
        toolsAvailable: result?.tools?.length || 0
      });
      
      // Update metrics
      if (this.config.connectionMetrics) {
        this.metrics.healthChecksPassed++;
      }
      
      // Phase 4: Health check success event
      if (this.config.enableEnhancedEvents) {
        this.events.onHealthCheckSuccess?.(healthCheckDuration);
      }
      
      return true;
    } catch (error) {
      const healthCheckDuration = Date.now() - healthCheckStart;
      
      this.enhancedLog('warn', `Health check failed after ${healthCheckDuration}ms: ${error}`, {
        duration: healthCheckDuration,
        connectionId: this.currentConnectionId,
        errorType: error.constructor.name,
        errorMessage: (error as Error).message
      });
      
      // Update failure metrics
      if (this.config.connectionMetrics) {
        this.metrics.healthChecksFailed++;
      }
      
      // Phase 4: Health check failure event
      if (this.config.enableEnhancedEvents) {
        this.events.onHealthCheckFailure?.(error as Error, healthCheckDuration);
      }
      
      // If health check fails, consider triggering reconnection
      if (this.config.enableAdvancedReconnection && this.shouldRetry(error as Error)) {
        this.enhancedLog('info', 'Triggering advanced reconnection due to failed health check');
        this.setState(MCPConnectionState.ERROR);
        await this.advancedReconnect();
      } else if (this.config.retryAttempts > 0) {
        this.enhancedLog('info', 'Triggering basic reconnection due to failed health check');
        this.setState(MCPConnectionState.ERROR);
        await this.reconnect();
      }
      
      return false;
    }
  }

  /**
   * Initialize automatic health monitoring (Enhanced for Phase 3)
   */
  startHealthMonitoring(intervalMs?: number): void {
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
    }

    // Use provided interval or fall back to config, then default
    const monitoringInterval = intervalMs || this.config.healthCheckInterval || 30000;

    this.healthMonitoringInterval = setInterval(async () => {
      if (this.isConnected()) {
        await this.healthCheck();
      }
    }, monitoringInterval);

    this.log(`Health monitoring started (interval: ${monitoringInterval}ms)`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = null;
      this.log('Health monitoring stopped');
    }
  }

  // ============================================================================
  // AUTHENTICATION BRIDGE (Subtask 28.1 - Phase 2)
  // ============================================================================

  /**
   * Initialize authentication with Supabase session
   * Core token bridge implementation
   */
  async authenticateWithSupabase(session: any): Promise<void> {
    if (!this.authManager) {
      throw new Error('Authentication system not initialized. Enable authentication in config.');
    }

    try {
      this.enhancedLog('info', 'Authenticating MCP client with Supabase session', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        sessionEmail: session?.user?.email
      });

      // Use auth manager to initialize authentication
      await this.authManager.initializeAuth(session);

      // Update local auth state
      this.authStatus = this.authManager.getAuthStatus();
      this.authCredentials = this.authManager.getCredentials();
      this.lastAuthRefresh = Date.now();

      // Log authentication success
      this.enhancedLog('info', 'MCP authentication successful', {
        isAuthenticated: this.authStatus?.isAuthenticated,
        hasValidToken: this.authStatus?.hasValidToken,
        userId: this.authCredentials?.userId
      });

      // Fire success event
      this.authEvents.onAuthSuccess?.(this.authCredentials!);

    } catch (error) {
      this.enhancedLog('error', 'Failed to authenticate with Supabase session', { error });
      
      // Fire failure event
      this.authEvents.onAuthFailure?.(error as Error);
      
      throw error;
    }
  }

  /**
   * Update authentication with new Supabase session
   * Handles token refresh and session updates
   */
  async updateAuthentication(session: any): Promise<void> {
    if (!this.authManager) {
      throw new Error('Authentication system not initialized');
    }

    try {
      this.enhancedLog('debug', 'Updating MCP authentication', {
        hadCredentials: !!this.authCredentials,
        hasNewSession: !!session
      });

      // Use auth manager to update authentication
      await this.authManager.updateAuth(session);

      // Update local auth state
      this.authStatus = this.authManager.getAuthStatus();
      this.authCredentials = this.authManager.getCredentials();
      this.lastAuthRefresh = Date.now();

      // Fire token refresh event
      if (this.authCredentials) {
        this.authEvents.onTokenRefresh?.(this.authCredentials);
      }

    } catch (error) {
      this.enhancedLog('error', 'Failed to update authentication', { error });
      throw error;
    }
  }

  /**
   * Clear authentication and logout (legacy method - use coordinatedLogout for Phase 4)
   */
  clearAuthentication(): void {
    this.coordinatedLogout('internal');
  }

  // ============================================================================
  // PHASE 4: COORDINATED LOGOUT & CLEANUP SYSTEM
  // ============================================================================

  /**
   * Coordinated logout across both Supabase and MCP systems (Phase 4)
   */
  async coordinatedLogout(source: 'supabase' | 'mcp' | 'user' | 'internal' = 'user'): Promise<void> {
    if (!this.authManager) {
      this.enhancedLog('warn', 'Authentication system not initialized during logout');
      return;
    }

    const logoutId = `mcp_logout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.enhancedLog('info', 'Starting coordinated MCP logout', {
      source,
      logoutId,
      isAuthenticated: this.authStatus?.isAuthenticated,
      hasCredentials: !!this.authCredentials
    });

    try {
      // Phase 4: Enhanced coordinated logout sequence
      await this.performMCPLogoutSequence(source, logoutId);

      this.enhancedLog('info', 'Coordinated MCP logout completed successfully', { logoutId });

    } catch (error) {
      this.enhancedLog('error', 'Logout error, performing force cleanup', { 
        logoutId, 
        error: error instanceof Error ? error.message : error 
      });

      // Force cleanup even if coordinated logout fails
      await this.forceAuthCleanup();
      throw error;
    }
  }

  /**
   * Perform MCP logout sequence with session invalidation (Phase 4)
   */
  private async performMCPLogoutSequence(source: string, logoutId: string): Promise<void> {
    // Step 1: Disable monitoring before logout
    this.disableAuthRefreshMonitoring();

    // Step 2: Coordinate with auth manager
    await this.authManager!.coordinatedLogout(source as any);

    // Step 3: Invalidate MCP connections
    await this.invalidateMCPConnections(logoutId);

    // Step 4: Clean MCP client state
    this.cleanMCPClientState();

    // Step 5: Fire MCP logout events
    this.fireMCPLogoutEvents(source);
  }

  /**
   * Invalidate active MCP connections during logout (Phase 4)
   */
  private async invalidateMCPConnections(logoutId: string): Promise<void> {
    this.enhancedLog('debug', 'Invalidating MCP connections', { logoutId });

    try {
      // Disconnect from MCP server if connected
      if (this.state === MCPConnectionState.CONNECTED) {
        this.enhancedLog('info', 'Disconnecting from MCP server during logout');
        await this.disconnect();
      }

      // Clear any pending connection attempts
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Clear connection pool if enabled
      if (this.config.poolConfig?.enablePooling) {
        await this.clearPool();
      }

    } catch (error) {
      this.enhancedLog('warn', 'Error during MCP connection invalidation', { 
        logoutId, 
        error: error instanceof Error ? error.message : error 
      });
      // Continue with logout even if connection cleanup fails
    }
  }

  /**
   * Clean MCP client authentication state (Phase 4)
   */
  private cleanMCPClientState(): void {
    this.enhancedLog('debug', 'Cleaning MCP client authentication state');

    // Clear authentication credentials and status
    this.authCredentials = null;
    this.authStatus = { isAuthenticated: false, hasValidToken: false };
    this.lastAuthRefresh = null;

    // Clear all authentication timeouts
    if (this.authRefreshTimeout) {
      clearTimeout(this.authRefreshTimeout);
      this.authRefreshTimeout = null;
    }

    // Reset authentication events
    this.authEvents = {
      onAuthSuccess: this.authEvents.onAuthSuccess,
      onAuthFailure: this.authEvents.onAuthFailure,
      onTokenRefresh: this.authEvents.onTokenRefresh,
      onTokenExpired: this.authEvents.onTokenExpired,
      onAuthStatusChange: this.authEvents.onAuthStatusChange
    };
  }

  /**
   * Fire MCP logout events (Phase 4)
   */
  private fireMCPLogoutEvents(source: string): void {
    this.enhancedLog('debug', 'Firing MCP logout events', { source });

    // Fire auth status change event
    this.authEvents.onAuthStatusChange?.(this.getAuthenticationStatus());

    // Note: Could add custom logout events here if needed
    // this.events.onLogout?.(source);
  }

  /**
   * Force authentication cleanup for partial logout scenarios (Phase 4)
   */
  async forceAuthCleanup(): Promise<void> {
    this.enhancedLog('warn', 'Performing force authentication cleanup');

    try {
      // Force cleanup auth manager
      if (this.authManager) {
        this.authManager.forceCleanup();
      }

      // Force clean MCP client state
      this.cleanMCPClientState();

      // Force disconnect if needed
      if (this.state === MCPConnectionState.CONNECTED) {
        try {
          await this.disconnect();
        } catch (error) {
          this.enhancedLog('warn', 'Force disconnect failed', { error });
        }
      }

      this.enhancedLog('info', 'Force authentication cleanup completed');

    } catch (error) {
      this.enhancedLog('error', 'Error during force cleanup', { error });
      // Swallow errors during force cleanup
    }
  }

  /**
   * Handle partial logout scenarios (Phase 4)
   */
  async handlePartialLogout(
    scenario: 'network_error' | 'timeout' | 'server_error' | 'connection_lost',
    originalError?: Error
  ): Promise<void> {
    this.enhancedLog('warn', 'Handling partial logout scenario', { 
      scenario, 
      originalError: originalError?.message 
    });

    switch (scenario) {
      case 'network_error':
        // Network issue - clean local state, keep connection if possible
        await this.forceAuthCleanup();
        break;

      case 'timeout':
        // Timeout - force immediate cleanup
        await this.forceAuthCleanup();
        break;

      case 'server_error':
        // Server error - try graceful logout, fallback to force cleanup
        try {
          await this.coordinatedLogout('internal');
        } catch {
          await this.forceAuthCleanup();
        }
        break;

      case 'connection_lost':
        // Connection lost - clean state but prepare for reconnection
        await this.forceAuthCleanup();
        break;
    }

    // Delegate to auth manager as well
    if (this.authManager) {
      await this.authManager.handlePartialLogout(
        scenario === 'connection_lost' ? 'network_error' : scenario
      );
    }
  }

  /**
   * Logout with Supabase coordination (Phase 4)
   */
  async logoutWithSupabaseCoordination(supabaseLogoutFn?: () => Promise<void>): Promise<void> {
    this.enhancedLog('info', 'Starting logout with Supabase coordination');

    try {
      // Step 1: Coordinate MCP logout
      await this.coordinatedLogout('supabase');

      // Step 2: Call Supabase logout if provided
      if (supabaseLogoutFn) {
        this.enhancedLog('debug', 'Calling provided Supabase logout function');
        await supabaseLogoutFn();
      }

      this.enhancedLog('info', 'Coordinated logout with Supabase completed');

    } catch (error) {
      this.enhancedLog('error', 'Error during coordinated logout', { error });
      
      // Ensure MCP is cleaned up even if Supabase logout fails
      await this.forceAuthCleanup();
      throw error;
    }
  }

  /**
   * Get comprehensive logout status (Phase 4)
   */
  getLogoutStatus(): {
    mcpStatus: {
      isLoggedOut: boolean;
      hasActiveRefresh: boolean;
      connectionState: MCPConnectionState;
      hasStoredCredentials: boolean;
    };
    authManagerStatus?: {
      isLoggedOut: boolean;
      hasActiveRefresh: boolean;
      hasStoredCredentials: boolean;
      timeSinceLastRefresh: number | null;
    };
  } {
    const result = {
      mcpStatus: {
        isLoggedOut: !this.authCredentials && this.authStatus?.isAuthenticated === false,
        hasActiveRefresh: !!this.authRefreshTimeout,
        connectionState: this.state,
        hasStoredCredentials: !!this.authCredentials
      },
      authManagerStatus: this.authManager?.getLogoutStatus()
    };

    return result;
  }

  /**
   * Get current authentication status
   */
  getAuthenticationStatus(): MCPAuthStatus {
    return this.authStatus || { isAuthenticated: false, hasValidToken: false };
  }

  /**
   * Get current authentication credentials
   */
  getAuthenticationCredentials(): MCPAuthCredentials | null {
    return this.authCredentials;
  }

  /**
   * Check if authentication is valid and not expired
   */
  isAuthenticated(): boolean {
    return this.authStatus?.isAuthenticated === true && this.authStatus?.hasValidToken === true;
  }

  /**
   * Get authentication headers for MCP requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.authManager) {
      return {};
    }
    return this.authManager.getAuthHeaders();
  }

  /**
   * Force refresh authentication tokens
   */
  async refreshAuthentication(newSession?: any): Promise<void> {
    if (!this.authManager) {
      throw new Error('Authentication system not initialized');
    }

    try {
      this.enhancedLog('info', 'Refreshing MCP authentication');
      
      await this.authManager.refreshAuth(newSession);
      
      // Update local state
      this.authStatus = this.authManager.getAuthStatus();
      this.authCredentials = this.authManager.getCredentials();
      this.lastAuthRefresh = Date.now();

    } catch (error) {
      this.enhancedLog('error', 'Failed to refresh authentication', { error });
      throw error;
    }
  }

  // ============================================================================
  // PHASE 3: SYNCHRONIZED REFRESH INTEGRATION
  // ============================================================================

  /**
   * Synchronized refresh with Supabase timing (Phase 3)
   * Ensures MCP and Supabase refresh cycles are coordinated
   */
  async synchronizeAuthRefresh(supabaseSession?: any): Promise<void> {
    if (!this.authManager) {
      throw new Error('Authentication system not initialized');
    }

    try {
      this.enhancedLog('info', 'Synchronizing authentication refresh with Supabase', {
        hasSupabaseSession: !!supabaseSession,
        currentAuthStatus: this.authStatus?.isAuthenticated,
        lastRefresh: this.lastAuthRefresh ? new Date(this.lastAuthRefresh).toISOString() : null
      });

      // Phase 3: Coordinated refresh logic
      if (supabaseSession) {
        // Supabase provided new session - update MCP accordingly
        await this.updateAuthentication(supabaseSession);
      } else {
        // No new session - check if refresh is needed
        const needsRefresh = this.authStatus?.hasValidToken === false || 
                           this.isAuthenticationExpiringSoon();
        
        if (needsRefresh) {
          await this.refreshAuthentication();
        }
      }

      // Clear any pending refresh timeout to avoid double-refresh
      if (this.authRefreshTimeout) {
        clearTimeout(this.authRefreshTimeout);
        this.authRefreshTimeout = null;
      }

      this.enhancedLog('info', 'Authentication synchronization completed');

    } catch (error) {
      this.enhancedLog('error', 'Failed to synchronize authentication refresh', { error });
      throw error;
    }
  }

  /**
   * Check if authentication is expiring soon (Phase 3)
   */
  private isAuthenticationExpiringSoon(): boolean {
    if (!this.authCredentials) {
      return false;
    }

    const now = Date.now();
    const expiryTime = this.authCredentials.expiresAt;
    const timeUntilExpiry = expiryTime - now;
    
    // Consider "expiring soon" as within 5 minutes (300000 ms)
    const refreshThresholdMs = 5 * 60 * 1000;
    
    return timeUntilExpiry <= refreshThresholdMs;
  }

  /**
   * Enable automatic refresh monitoring (Phase 3)
   * Sets up periodic checks for authentication status
   */
  enableAuthRefreshMonitoring(intervalMs: number = 60000): void {
    if (!this.authManager) {
      throw new Error('Authentication system not initialized');
    }

    // Clear existing monitoring
    this.disableAuthRefreshMonitoring();

    this.authRefreshTimeout = setInterval(() => {
      this.performRefreshCheck();
    }, intervalMs) as any;

    this.enhancedLog('info', 'Authentication refresh monitoring enabled', {
      intervalMs,
      intervalMinutes: Math.round(intervalMs / 60000)
    });
  }

  /**
   * Disable automatic refresh monitoring (Phase 3)
   */
  disableAuthRefreshMonitoring(): void {
    if (this.authRefreshTimeout) {
      clearInterval(this.authRefreshTimeout);
      this.authRefreshTimeout = null;
      this.enhancedLog('info', 'Authentication refresh monitoring disabled');
    }
  }

  /**
   * Perform periodic refresh check (Phase 3)
   */
  private async performRefreshCheck(): Promise<void> {
    if (!this.authManager || !this.authCredentials) {
      return;
    }

    try {
      const authStatus = this.authManager.getAuthStatus();
      
      // Check if token needs refresh
      if (!authStatus.hasValidToken || this.isAuthenticationExpiringSoon()) {
        this.enhancedLog('debug', 'Periodic refresh check detected expired/expiring token');
        
        // Fire token expired event
        this.authEvents.onTokenExpired?.(this.authCredentials);
        
        // Attempt refresh (this will be handled by the auth manager)
        // The auth manager will handle retry logic and failure recovery
      }
      
    } catch (error) {
      this.enhancedLog('warn', 'Error during periodic refresh check', { error });
    }
  }

  /**
   * Get detailed authentication timing information (Phase 3)
   */
  getAuthTiming(): {
    isAuthenticated: boolean;
    hasValidToken: boolean;
    timeUntilExpiry: number;
    isExpiringSoon: boolean;
    lastRefresh: number | null;
    nextRefreshCheck?: number;
  } {
    const authStatus = this.getAuthenticationStatus();
    const credentials = this.getAuthenticationCredentials();
    
    const result = {
      isAuthenticated: authStatus.isAuthenticated,
      hasValidToken: authStatus.hasValidToken,
      timeUntilExpiry: credentials ? credentials.expiresAt - Date.now() : 0,
      isExpiringSoon: this.isAuthenticationExpiringSoon(),
      lastRefresh: this.lastAuthRefresh
    };

    return result;
  }

  /**
   * Handle authentication failure with recovery (Phase 3)
   */
  async handleAuthFailureWithRecovery(error: Error, retryCount: number = 0): Promise<void> {
    const maxRetries = 3;
    
    this.enhancedLog('warn', `Authentication failure (attempt ${retryCount + 1}/${maxRetries})`, {
      error: error.message,
      retryCount
    });

    if (retryCount < maxRetries) {
      // Exponential backoff retry
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
      
      setTimeout(async () => {
        try {
          await this.refreshAuthentication();
          this.enhancedLog('info', 'Authentication recovery successful');
        } catch (retryError) {
          await this.handleAuthFailureWithRecovery(retryError as Error, retryCount + 1);
        }
      }, delayMs);
      
    } else {
      // Max retries exceeded - clear authentication
      this.enhancedLog('error', 'Authentication recovery failed - clearing auth state');
      this.clearAuthentication();
      this.authEvents.onAuthFailure?.(error);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Internal logging utility
   */
  private log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const prefix = `[MCP Client ${timestamp}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR:`, message);
        break;
      case 'warn':
        console.warn(`${prefix} WARN:`, message);
        break;
      default:
        console.log(`${prefix}`, message);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MCPClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated');
  }

  /**
   * Update event handlers
   */
  updateEvents(newEvents: Partial<MCPConnectionEvents>): void {
    this.events = { ...this.events, ...newEvents };
    
    // Phase 4: Fire config change event
    if (this.config.enableEnhancedEvents && Object.keys(newEvents).length > 0) {
      this.events.onConfigChange?.({ enableEnhancedEvents: this.config.enableEnhancedEvents });
    }
  }

  // ============================================================================
  // PHASE 4: PUBLIC STATE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get connection history
   */
  getConnectionHistory(): Array<{ timestamp: number; success: boolean; duration: number; error?: string }> {
    return [...this.connectionHistory];
  }

  /**
   * Get log entries
   */
  getLogEntries(level?: 'debug' | 'info' | 'warn' | 'error'): Array<{ timestamp: number; level: string; message: string; context?: any }> {
    if (level) {
      return this.logEntries.filter(entry => entry.level === level);
    }
    return [...this.logEntries];
  }

  /**
   * Clear connection history
   */
  clearConnectionHistory(): void {
    this.connectionHistory = [];
    this.enhancedLog('info', 'Connection history cleared');
  }

  /**
   * Clear log entries
   */
  clearLogEntries(): void {
    this.logEntries = [];
    this.enhancedLog('info', 'Log entries cleared');
  }

  /**
   * Get persisted state
   */
  getPersistedState(): MCPPersistedState {
    return { ...this.persistedState };
  }

  /**
   * Force state persistence
   */
  forcePersistState(): void {
    this.persistState();
  }

  /**
   * Force state restoration
   */
  forceRestoreState(): void {
    this.restoreState();
  }

  /**
   * Get current connection ID
   */
  getCurrentConnectionId(): string | null {
    return this.currentConnectionId;
  }

  /**
   * Enable/disable state persistence
   */
  setStatePersistence(enabled: boolean): void {
    this.config.enableStatePersistence = enabled;
    
    if (enabled && !this.statePersistenceInterval) {
      this.initializeStatePersistence();
    } else if (!enabled && this.statePersistenceInterval) {
      clearInterval(this.statePersistenceInterval);
      this.statePersistenceInterval = null;
    }

    this.enhancedLog('info', `State persistence ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update logging configuration
   */
  updateLoggingConfig(newConfig: Partial<MCPLoggingConfig>): void {
    this.config.loggingConfig = { ...this.config.loggingConfig!, ...newConfig };
    
    this.enhancedLog('info', 'Logging configuration updated', { 
      newConfig,
      currentConfig: this.config.loggingConfig 
    });

    // Fire config change event
    if (this.config.enableEnhancedEvents) {
      this.events.onConfigChange?.({ loggingConfig: this.config.loggingConfig });
    }
  }

  // ============================================================================
  // PHASE 5: PUBLIC CONFIGURATION & DEBUGGING APIS
  // ============================================================================

  /**
   * Get current environment configuration
   */
  getEnvironmentConfig(): MCPEnvironmentConfig {
    return { ...this.config.environmentConfig! };
  }

  /**
   * Get current validation configuration
   */
  getValidationConfig(): MCPValidationConfig {
    return { ...this.config.validationConfig! };
  }

  /**
   * Get current debug configuration
   */
  getDebugConfig(): MCPDebugConfig {
    return { ...this.config.debugConfig! };
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): Array<{ timestamp: number; field: string; error: string; value: any }> {
    return [...this.validationErrors];
  }

  /**
   * Get network logs (debugging)
   */
  getNetworkLogs(): Array<{ timestamp: number; type: 'request' | 'response' | 'error'; data: any }> {
    return [...this.networkLogs];
  }

  /**
   * Get debug data
   */
  getDebugData(): Array<{ timestamp: number; type: string; data: any }> {
    return [...this.debugData];
  }

  /**
   * Clear validation errors
   */
  clearValidationErrors(): void {
    this.validationErrors = [];
    this.enhancedLog('info', 'Validation errors cleared');
  }

  /**
   * Clear network logs
   */
  clearNetworkLogs(): void {
    this.networkLogs = [];
    this.enhancedLog('info', 'Network logs cleared');
  }

  /**
   * Clear debug data
   */
  clearDebugData(): void {
    this.debugData = [];
    this.enhancedLog('info', 'Debug data cleared');
  }

  /**
   * Export debug information for troubleshooting
   */
  exportDebugInfo(): any {
    return {
      timestamp: Date.now(),
      environment: this.currentEnvironment,
      connectionId: this.currentConnectionId,
      state: this.state,
      config: {
        serverUrl: this.config.serverUrl,
        environment: this.config.environmentConfig,
        validation: this.config.validationConfig,
        debug: this.config.debugConfig
      },
      metrics: this.metrics,
      connectionHistory: this.connectionHistory.slice(-10), // Last 10 connections
      validationErrors: this.validationErrors.slice(-10), // Last 10 errors
      networkLogs: this.networkLogs.slice(-20), // Last 20 network events
      debugData: this.debugData.slice(-20), // Last 20 debug entries
      logEntries: this.logEntries.filter(entry => entry.level === 'error').slice(-10) // Last 10 errors
    };
  }

  /**
   * Update environment configuration
   */
  updateEnvironmentConfig(newConfig: Partial<MCPEnvironmentConfig>): void {
    this.config.environmentConfig = { ...this.config.environmentConfig!, ...newConfig };
    
    // Re-apply environment overrides if environment changed
    if (newConfig.environment && newConfig.environment !== this.currentEnvironment) {
      this.currentEnvironment = newConfig.environment;
      this.applyEnvironmentOverrides();
    }

    this.enhancedLog('info', 'Environment configuration updated', { 
      newConfig,
      currentEnvironment: this.currentEnvironment 
    });

    // Fire config change event
    if (this.config.enableEnhancedEvents) {
      this.events.onConfigChange?.({ environmentConfig: this.config.environmentConfig });
    }
  }

  /**
   * Update validation configuration
   */
  updateValidationConfig(newConfig: Partial<MCPValidationConfig>): void {
    this.config.validationConfig = { ...this.config.validationConfig!, ...newConfig };
    
    this.enhancedLog('info', 'Validation configuration updated', { newConfig });

    // Fire config change event
    if (this.config.enableEnhancedEvents) {
      this.events.onConfigChange?.({ validationConfig: this.config.validationConfig });
    }
  }

  /**
   * Update debug configuration
   */
  updateDebugConfig(newConfig: Partial<MCPDebugConfig>): void {
    this.config.debugConfig = { ...this.config.debugConfig!, ...newConfig };
    
    this.enhancedLog('info', 'Debug configuration updated', { newConfig });

    // Fire config change event
    if (this.config.enableEnhancedEvents) {
      this.events.onConfigChange?.({ debugConfig: this.config.debugConfig });
    }
  }

  /**
   * Manually validate current configuration
   */
  validateCurrentConfiguration(): { isValid: boolean; errors: string[] } {
    return this.validateConfiguration();
  }

  /**
   * Add debug data entry
   */
  private addDebugData(type: string, data: any): void {
    if (!this.config.debugConfig!.enableDebugMode) {
      return;
    }

    this.debugData.push({
      timestamp: Date.now(),
      type,
      data
    });

    // Trim debug data if it exceeds reasonable limits
    if (this.debugData.length > 1000) {
      this.debugData = this.debugData.slice(-500);
    }
  }

  /**
   * Add network log entry
   */
  private addNetworkLog(type: 'request' | 'response' | 'error', data: any): void {
    if (!this.config.debugConfig!.captureNetworkLogs) {
      return;
    }

    this.networkLogs.push({
      timestamp: Date.now(),
      type,
      data
    });

    // Trim network logs if they exceed reasonable limits
    if (this.networkLogs.length > 1000) {
      this.networkLogs = this.networkLogs.slice(-500);
    }
  }

  // ============================================================================
  // PHASE 3: ADVANCED CONNECTION FEATURES
  // ============================================================================

  /**
   * Update connection metrics (Enhanced for Phase 4)
   */
  private updateConnectionMetrics(duration: number, success: boolean): void {
    if (!this.config.connectionMetrics) return;

    this.metrics.lastConnectionDuration = duration;
    
    if (success) {
      this.metrics.successfulConnections++;
    }

    // Calculate rolling average connection time
    const totalSuccessful = this.metrics.successfulConnections;
    if (totalSuccessful > 0) {
      this.metrics.averageConnectionTime = 
        ((this.metrics.averageConnectionTime * (totalSuccessful - 1)) + duration) / totalSuccessful;
    }

    // Phase 4: Metrics logging and events
    if (this.config.loggingConfig!.enableMetricsLogging) {
      this.enhancedLog('debug', 'Connection metrics updated', {
        duration,
        success,
        totalConnections: this.metrics.totalConnections,
        successfulConnections: this.metrics.successfulConnections,
        averageTime: this.metrics.averageConnectionTime
      });
    }

    // Phase 4: Metrics update event
    if (this.config.enableEnhancedEvents) {
      this.events.onMetricsUpdate?.({ ...this.metrics });
    }
  }

  /**
   * Get an available pooled connection
   */
  private getPooledConnection(): { client: Client; transport: any } | null {
    if (!this.config.poolConfig!.enablePooling) {
      return null;
    }

    // Clean up expired connections first
    this.cleanupExpiredConnections();

    // Find an idle connection
    const idleConnection = this.connectionPool.find(conn => conn.idle);
    if (idleConnection) {
      idleConnection.idle = false;
      idleConnection.lastUsed = new Date();
      this.log('Retrieved connection from pool');
      return { client: idleConnection.client, transport: idleConnection.transport };
    }

    return null;
  }

  /**
   * Add a connection to the pool
   */
  private addToPool(client: Client, transport: any): void {
    if (!this.config.poolConfig!.enablePooling) {
      return;
    }

    const poolConfig = this.config.poolConfig!;
    
    // Check if pool is at maximum capacity
    if (this.connectionPool.length >= poolConfig.maxConnections!) {
      this.log('Connection pool at maximum capacity, not adding connection');
      return;
    }

    this.connectionPool.push({
      client,
      transport,
      lastUsed: new Date(),
      idle: false,
      id: this.currentConnectionId || `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    this.log(`Added connection to pool (${this.connectionPool.length}/${poolConfig.maxConnections})`);
  }

  /**
   * Clean up expired connections from the pool
   */
  private cleanupExpiredConnections(): void {
    const poolConfig = this.config.poolConfig!;
    const now = Date.now();

    this.connectionPool = this.connectionPool.filter(conn => {
      const age = now - conn.lastUsed.getTime();
      const expired = age > poolConfig.connectionLifetime!;
      
      if (expired) {
        this.log('Removing expired connection from pool');
        // Clean up the expired connection
        try {
          conn.client.close();
          conn.transport.close();
        } catch (error) {
          this.log(`Error cleaning up expired connection: ${error}`, 'warn');
        }
      }

      return !expired;
    });
  }

  /**
   * Mark current connection as idle and return it to pool
   */
  returnToPool(): void {
    if (!this.config.poolConfig!.enablePooling || !this.client || !this.transport) {
      return;
    }

    const existingConnection = this.connectionPool.find(
      conn => conn.client === this.client
    );

    if (existingConnection) {
      existingConnection.idle = true;
      existingConnection.lastUsed = new Date();
      this.log('Returned connection to pool');
    }
  }

  /**
   * Get connection pool metrics
   */
  getPoolMetrics() {
    if (!this.config.poolConfig!.enablePooling) {
      return null;
    }

    return {
      totalConnections: this.connectionPool.length,
      activeConnections: this.connectionPool.filter(conn => !conn.idle).length,
      idleConnections: this.connectionPool.filter(conn => conn.idle).length,
      maxPoolSize: this.config.poolConfig!.maxConnections!,
      oldestConnection: this.connectionPool.length > 0 ? 
        Math.min(...this.connectionPool.map(conn => conn.lastUsed.getTime())) : null
    };
  }

  /**
   * Force cleanup of entire connection pool
   */
  async clearPool(): Promise<void> {
    this.log('Clearing connection pool');
    
    for (const conn of this.connectionPool) {
      try {
        await conn.client.close();
        await conn.transport.close();
      } catch (error) {
        this.log(`Error closing pooled connection: ${error}`, 'warn');
      }
    }

    this.connectionPool = [];
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    if (this.httpClient && this.httpClient.isConnected()) {
      return await this.httpClient.listTools();
    }
    
    if (this.client) {
      return await this.client.listTools();
    }
    
    throw new Error('No MCP connection available');
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (this.httpClient && this.httpClient.isConnected()) {
      return await this.httpClient.callTool(name, args);
    }
    
    if (this.client) {
      return await this.client.callTool({ name, arguments: args });
    }
    
    throw new Error('No MCP connection available');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create and configure a new MCP client instance
 */
export function createMCPClient(
  config?: MCPClientConfig,
  events?: MCPConnectionEvents
): MCPClient {
  return new MCPClient(config, events);
}

/**
 * Create MCP client with default production configuration
 */
export function createProductionMCPClient(events?: MCPConnectionEvents): MCPClient {
  return new MCPClient({
    serverUrl: process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004',
    timeout: 30000,
    retryAttempts: 5,
    retryDelay: 2000,
    maxRetryDelay: 30000,
    enableLogging: process.env.NODE_ENV !== 'production'
  }, events);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default MCPClient;