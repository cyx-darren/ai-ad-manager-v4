/**
 * Monitoring Configuration System
 * Phase 6: Integration & Performance Optimization - Subtask 28.6
 */

export interface MonitoringConfig {
  // Environment settings
  environment: 'development' | 'testing' | 'production';
  
  // Performance optimization
  performance: {
    enabled: boolean;
    cpuThreshold: number;           // CPU usage threshold (0-1)
    memoryThreshold: number;        // Memory usage threshold in MB
    adaptiveThrottling: boolean;    // Enable adaptive throttling
    batchProcessing: boolean;       // Enable batch processing
    backgroundProcessing: boolean;  // Enable Web Worker processing
    idleTimeProcessing: boolean;    // Process during idle time
  };
  
  // Monitoring intervals (in milliseconds)
  intervals: {
    connection: number;             // Connection monitoring interval
    serverHealth: number;          // Server health check interval
    analytics: number;             // Analytics collection interval
    predictive: number;            // Predictive analysis interval
    storage: number;               // Storage sync interval
  };
  
  // Feature flags
  features: {
    connectionMonitoring: boolean;
    serverHealthMonitoring: boolean;
    visualIndicators: boolean;
    analytics: boolean;
    predictiveIntelligence: boolean;
    offlineIntegration: boolean;
  };
  
  // Storage configuration
  storage: {
    enabled: boolean;
    maxMemorySize: number;         // Max memory cache size in MB
    maxLocalStorageSize: number;   // Max localStorage size in MB
    maxIndexedDBSize: number;      // Max IndexedDB size in MB
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    retentionDays: number;
    autoCleanup: boolean;
    supabaseSync: boolean;
  };
  
  // Network configuration
  network: {
    requestCoalescing: boolean;
    batchSize: number;             // Batch size for network requests
    timeout: number;               // Request timeout in ms
    retryAttempts: number;
    backoffFactor: number;
  };
  
  // Logging configuration
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    maxLogSize: number;            // Max log size in MB
    remoteLogging: boolean;
  };
  
  // Integration settings
  integration: {
    offlineSystem: boolean;        // Integrate with offline system
    sharedEventSystem: boolean;    // Use shared event system
    unifiedNotifications: boolean; // Unified notification system
    combinedAnalytics: boolean;    // Combined analytics reporting
  };
}

// Environment-specific configurations
export const DEVELOPMENT_CONFIG: MonitoringConfig = {
  environment: 'development',
  performance: {
    enabled: true,
    cpuThreshold: 0.8,
    memoryThreshold: 100,
    adaptiveThrottling: true,
    batchProcessing: false,
    backgroundProcessing: false,
    idleTimeProcessing: false
  },
  intervals: {
    connection: 5000,        // 5 seconds
    serverHealth: 10000,     // 10 seconds
    analytics: 30000,        // 30 seconds
    predictive: 15000,       // 15 seconds
    storage: 60000           // 1 minute
  },
  features: {
    connectionMonitoring: true,
    serverHealthMonitoring: true,
    visualIndicators: true,
    analytics: true,
    predictiveIntelligence: true,
    offlineIntegration: true
  },
  storage: {
    enabled: true,
    maxMemorySize: 10,
    maxLocalStorageSize: 5,
    maxIndexedDBSize: 20,
    compressionEnabled: false,
    encryptionEnabled: false,
    retentionDays: 7,
    autoCleanup: true,
    supabaseSync: false
  },
  network: {
    requestCoalescing: false,
    batchSize: 10,
    timeout: 5000,
    retryAttempts: 3,
    backoffFactor: 1.5
  },
  logging: {
    enabled: true,
    level: 'debug',
    maxLogSize: 10,
    remoteLogging: false
  },
  integration: {
    offlineSystem: true,
    sharedEventSystem: true,
    unifiedNotifications: true,
    combinedAnalytics: true
  }
};

export const TESTING_CONFIG: MonitoringConfig = {
  environment: 'testing',
  performance: {
    enabled: true,
    cpuThreshold: 0.7,
    memoryThreshold: 75,
    adaptiveThrottling: true,
    batchProcessing: true,
    backgroundProcessing: false,
    idleTimeProcessing: false
  },
  intervals: {
    connection: 10000,       // 10 seconds
    serverHealth: 15000,     // 15 seconds
    analytics: 60000,        // 1 minute
    predictive: 30000,       // 30 seconds
    storage: 120000          // 2 minutes
  },
  features: {
    connectionMonitoring: true,
    serverHealthMonitoring: true,
    visualIndicators: true,
    analytics: true,
    predictiveIntelligence: true,
    offlineIntegration: true
  },
  storage: {
    enabled: true,
    maxMemorySize: 15,
    maxLocalStorageSize: 8,
    maxIndexedDBSize: 30,
    compressionEnabled: true,
    encryptionEnabled: false,
    retentionDays: 14,
    autoCleanup: true,
    supabaseSync: true
  },
  network: {
    requestCoalescing: true,
    batchSize: 20,
    timeout: 8000,
    retryAttempts: 3,
    backoffFactor: 2
  },
  logging: {
    enabled: true,
    level: 'info',
    maxLogSize: 20,
    remoteLogging: true
  },
  integration: {
    offlineSystem: true,
    sharedEventSystem: true,
    unifiedNotifications: true,
    combinedAnalytics: true
  }
};

export const PRODUCTION_CONFIG: MonitoringConfig = {
  environment: 'production',
  performance: {
    enabled: true,
    cpuThreshold: 0.5,
    memoryThreshold: 50,
    adaptiveThrottling: true,
    batchProcessing: true,
    backgroundProcessing: true,
    idleTimeProcessing: true
  },
  intervals: {
    connection: 30000,       // 30 seconds
    serverHealth: 60000,     // 1 minute
    analytics: 300000,       // 5 minutes
    predictive: 120000,      // 2 minutes
    storage: 600000          // 10 minutes
  },
  features: {
    connectionMonitoring: true,
    serverHealthMonitoring: true,
    visualIndicators: true,
    analytics: true,
    predictiveIntelligence: true,
    offlineIntegration: true
  },
  storage: {
    enabled: true,
    maxMemorySize: 25,
    maxLocalStorageSize: 15,
    maxIndexedDBSize: 50,
    compressionEnabled: true,
    encryptionEnabled: true,
    retentionDays: 30,
    autoCleanup: true,
    supabaseSync: true
  },
  network: {
    requestCoalescing: true,
    batchSize: 50,
    timeout: 10000,
    retryAttempts: 5,
    backoffFactor: 2.5
  },
  logging: {
    enabled: true,
    level: 'warn',
    maxLogSize: 50,
    remoteLogging: true
  },
  integration: {
    offlineSystem: true,
    sharedEventSystem: true,
    unifiedNotifications: true,
    combinedAnalytics: true
  }
};

// Configuration manager class
export class MonitoringConfigManager {
  private currentConfig: MonitoringConfig;
  private configUpdateCallbacks: Array<(config: MonitoringConfig) => void> = [];

  constructor(environment?: 'development' | 'testing' | 'production') {
    this.currentConfig = this.getDefaultConfig(environment);
  }

  /**
   * Get default configuration based on environment
   */
  private getDefaultConfig(environment?: string): MonitoringConfig {
    switch (environment || process.env.NODE_ENV) {
      case 'development':
        return { ...DEVELOPMENT_CONFIG };
      case 'testing':
        return { ...TESTING_CONFIG };
      case 'production':
        return { ...PRODUCTION_CONFIG };
      default:
        return { ...DEVELOPMENT_CONFIG };
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): MonitoringConfig {
    return { ...this.currentConfig };
  }

  /**
   * Update configuration
   */
  public updateConfig(partialConfig: Partial<MonitoringConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...partialConfig
    };

    // Notify listeners
    this.configUpdateCallbacks.forEach(callback => {
      callback(this.currentConfig);
    });
  }

  /**
   * Update specific feature
   */
  public updateFeature(feature: keyof MonitoringConfig['features'], enabled: boolean): void {
    this.currentConfig.features[feature] = enabled;
    this.notifyConfigUpdate();
  }

  /**
   * Update interval
   */
  public updateInterval(type: keyof MonitoringConfig['intervals'], interval: number): void {
    this.currentConfig.intervals[type] = interval;
    this.notifyConfigUpdate();
  }

  /**
   * Update performance settings
   */
  public updatePerformance(settings: Partial<MonitoringConfig['performance']>): void {
    this.currentConfig.performance = {
      ...this.currentConfig.performance,
      ...settings
    };
    this.notifyConfigUpdate();
  }

  /**
   * Subscribe to configuration updates
   */
  public onConfigUpdate(callback: (config: MonitoringConfig) => void): () => void {
    this.configUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.configUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.configUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get environment-optimized intervals
   */
  public getOptimizedIntervals(): MonitoringConfig['intervals'] {
    const baseIntervals = this.currentConfig.intervals;
    
    // In production, increase intervals for better performance
    if (this.currentConfig.environment === 'production') {
      return {
        connection: Math.max(baseIntervals.connection, 30000),
        serverHealth: Math.max(baseIntervals.serverHealth, 60000),
        analytics: Math.max(baseIntervals.analytics, 300000),
        predictive: Math.max(baseIntervals.predictive, 120000),
        storage: Math.max(baseIntervals.storage, 600000)
      };
    }

    return baseIntervals;
  }

  /**
   * Check if feature is enabled
   */
  public isFeatureEnabled(feature: keyof MonitoringConfig['features']): boolean {
    return this.currentConfig.features[feature];
  }

  /**
   * Get performance thresholds
   */
  public getPerformanceThresholds(): Pick<MonitoringConfig['performance'], 'cpuThreshold' | 'memoryThreshold'> {
    return {
      cpuThreshold: this.currentConfig.performance.cpuThreshold,
      memoryThreshold: this.currentConfig.performance.memoryThreshold
    };
  }

  /**
   * Reset to default configuration
   */
  public resetToDefault(): void {
    this.currentConfig = this.getDefaultConfig();
    this.notifyConfigUpdate();
  }

  /**
   * Export configuration as JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.currentConfig, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson) as MonitoringConfig;
      this.currentConfig = config;
      this.notifyConfigUpdate();
    } catch (error) {
      throw new Error('Invalid configuration JSON');
    }
  }

  private notifyConfigUpdate(): void {
    this.configUpdateCallbacks.forEach(callback => {
      callback(this.currentConfig);
    });
  }
}

// Global configuration manager instance
let globalConfigManager: MonitoringConfigManager | null = null;

/**
 * Get global configuration manager instance
 */
export function getGlobalConfigManager(): MonitoringConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new MonitoringConfigManager();
  }
  return globalConfigManager;
}

/**
 * Create new configuration manager instance
 */
export function createConfigManager(environment?: 'development' | 'testing' | 'production'): MonitoringConfigManager {
  return new MonitoringConfigManager(environment);
}

/**
 * Create monitoring configuration with defaults
 */
export function createMonitoringConfig(environment?: 'development' | 'testing' | 'production'): MonitoringConfig {
  const manager = new MonitoringConfigManager(environment);
  return manager.getConfig();
}

// Default export
export default MonitoringConfigManager;