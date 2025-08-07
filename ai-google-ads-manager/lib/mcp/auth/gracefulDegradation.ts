/**
 * Graceful Degradation Handler
 * 
 * This file provides graceful degradation mechanisms for the credential system,
 * including feature degradation, fallback strategies, and recovery attempts.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Degradation levels
 */
export enum DegradationLevel {
  /** No degradation - full functionality */
  NONE = 'none',
  /** Minimal degradation - some non-critical features disabled */
  MINIMAL = 'minimal',
  /** Moderate degradation - significant feature reduction */
  MODERATE = 'moderate',
  /** Severe degradation - only basic functionality available */
  SEVERE = 'severe',
  /** Complete degradation - system unavailable */
  COMPLETE = 'complete'
}

/**
 * Degradation strategy types
 */
export enum DegradationStrategy {
  /** Disable non-essential features */
  DISABLE_FEATURES = 'disable_features',
  /** Use cached data when possible */
  USE_CACHE = 'use_cache',
  /** Provide read-only mode */
  READ_ONLY_MODE = 'read_only_mode',
  /** Show static content */
  STATIC_CONTENT = 'static_content',
  /** Redirect to simple version */
  SIMPLE_VERSION = 'simple_version',
  /** Show maintenance message */
  MAINTENANCE_MODE = 'maintenance_mode',
  /** Graceful shutdown */
  GRACEFUL_SHUTDOWN = 'graceful_shutdown'
}

/**
 * Graceful degradation configuration
 */
export interface GracefulDegradationConfig {
  /** Default degradation level to start with */
  defaultLevel: DegradationLevel;
  /** Maximum degradation level allowed */
  maxDegradationLevel: DegradationLevel;
  /** Whether to enable automatic degradation */
  enableAutoDegradation: boolean;
  /** Time before attempting recovery (in milliseconds) */
  recoveryAttemptInterval: number;
  /** Maximum number of recovery attempts */
  maxRecoveryAttempts: number;
  /** Whether to log degradation events */
  enableLogging: boolean;
  /** Whether to notify users of degradation */
  notifyUsers: boolean;
  /** Custom degradation strategies */
  customStrategies: Map<DegradationLevel, DegradationStrategy[]>;
}

/**
 * Degradation status
 */
export interface DegradationStatus {
  /** Current degradation level */
  currentLevel: DegradationLevel;
  /** Active degradation strategies */
  activeStrategies: DegradationStrategy[];
  /** When degradation was triggered */
  degradationStartTime: string;
  /** Reason for degradation */
  reason: string;
  /** Number of recovery attempts made */
  recoveryAttempts: number;
  /** Whether recovery is in progress */
  recoveryInProgress: boolean;
  /** When next recovery attempt is scheduled */
  nextRecoveryAttempt?: string;
  /** Available features in current state */
  availableFeatures: string[];
  /** Disabled features in current state */
  disabledFeatures: string[];
  /** User-facing status message */
  userMessage: string;
}

/**
 * Degradation event
 */
export interface DegradationEvent {
  /** Unique event ID */
  eventId: string;
  /** When the event occurred */
  timestamp: string;
  /** Type of degradation event */
  eventType: 'degradation_triggered' | 'level_changed' | 'recovery_attempted' | 'recovery_successful' | 'recovery_failed';
  /** Previous degradation level */
  previousLevel: DegradationLevel;
  /** New degradation level */
  newLevel: DegradationLevel;
  /** Reason for the event */
  reason: string;
  /** Additional event context */
  context: Record<string, any>;
  /** Duration of the event (for completed events) */
  duration?: number;
}

/**
 * Feature definition
 */
export interface FeatureDefinition {
  /** Feature identifier */
  featureId: string;
  /** Human-readable feature name */
  name: string;
  /** Feature description */
  description: string;
  /** Whether feature is critical */
  critical: boolean;
  /** Minimum degradation level where feature is disabled */
  disabledAtLevel: DegradationLevel;
  /** Dependencies on other features */
  dependencies: string[];
  /** Fallback behavior when disabled */
  fallback?: () => any;
}

/**
 * Graceful degradation handler interface
 */
export interface IGracefulDegradationHandler {
  /** Trigger degradation to a specific level */
  degrade(level: DegradationLevel, reason: string, context?: Record<string, any>): Promise<DegradationStatus>;
  
  /** Attempt to recover from degradation */
  attemptRecovery(): Promise<boolean>;
  
  /** Get current degradation status */
  getStatus(): DegradationStatus;
  
  /** Check if a feature is available */
  isFeatureAvailable(featureId: string): boolean;
  
  /** Register a feature */
  registerFeature(feature: FeatureDefinition): void;
  
  /** Get degradation event history */
  getEventHistory(): DegradationEvent[];
  
  /** Clear degradation and restore full functionality */
  restore(): Promise<boolean>;
  
  /** Update configuration */
  updateConfig(config: Partial<GracefulDegradationConfig>): void;
}

// ============================================================================
// BROWSER GRACEFUL DEGRADATION HANDLER
// ============================================================================

/**
 * Browser-based graceful degradation handler implementation
 */
export class BrowserGracefulDegradationHandler implements IGracefulDegradationHandler {
  private config: GracefulDegradationConfig;
  private currentStatus: DegradationStatus;
  private features: Map<string, FeatureDefinition> = new Map();
  private eventHistory: DegradationEvent[] = [];
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<GracefulDegradationConfig>) {
    this.config = {
      defaultLevel: DegradationLevel.NONE,
      maxDegradationLevel: DegradationLevel.SEVERE,
      enableAutoDegradation: true,
      recoveryAttemptInterval: 60000, // 1 minute
      maxRecoveryAttempts: 5,
      enableLogging: true,
      notifyUsers: true,
      customStrategies: new Map(),
      ...config
    };

    this.initializeDefaultFeatures();
    this.initializeDefaultStrategies();

    this.currentStatus = {
      currentLevel: this.config.defaultLevel,
      activeStrategies: [],
      degradationStartTime: new Date().toISOString(),
      reason: 'System initialized',
      recoveryAttempts: 0,
      recoveryInProgress: false,
      availableFeatures: this.getAvailableFeatures(this.config.defaultLevel),
      disabledFeatures: this.getDisabledFeatures(this.config.defaultLevel),
      userMessage: 'System operating normally'
    };
  }

  /**
   * Initialize default features
   */
  private initializeDefaultFeatures(): void {
    const defaultFeatures: FeatureDefinition[] = [
      {
        featureId: 'credential_management',
        name: 'Credential Management',
        description: 'Full credential storage and management capabilities',
        critical: true,
        disabledAtLevel: DegradationLevel.COMPLETE,
        dependencies: []
      },
      {
        featureId: 'real_time_sync',
        name: 'Real-time Synchronization',
        description: 'Real-time credential synchronization',
        critical: false,
        disabledAtLevel: DegradationLevel.MINIMAL,
        dependencies: ['credential_management']
      },
      {
        featureId: 'advanced_encryption',
        name: 'Advanced Encryption',
        description: 'Advanced encryption features',
        critical: false,
        disabledAtLevel: DegradationLevel.MODERATE,
        dependencies: ['credential_management']
      },
      {
        featureId: 'automatic_backup',
        name: 'Automatic Backup',
        description: 'Automatic credential backup functionality',
        critical: false,
        disabledAtLevel: DegradationLevel.MINIMAL,
        dependencies: ['credential_management']
      },
      {
        featureId: 'audit_logging',
        name: 'Audit Logging',
        description: 'Comprehensive audit logging',
        critical: false,
        disabledAtLevel: DegradationLevel.MODERATE,
        dependencies: []
      },
      {
        featureId: 'user_interface',
        name: 'User Interface',
        description: 'Full user interface functionality',
        critical: true,
        disabledAtLevel: DegradationLevel.SEVERE,
        dependencies: []
      }
    ];

    defaultFeatures.forEach(feature => {
      this.features.set(feature.featureId, feature);
    });
  }

  /**
   * Initialize default degradation strategies
   */
  private initializeDefaultStrategies(): void {
    this.config.customStrategies.set(DegradationLevel.MINIMAL, [
      DegradationStrategy.DISABLE_FEATURES,
      DegradationStrategy.USE_CACHE
    ]);

    this.config.customStrategies.set(DegradationLevel.MODERATE, [
      DegradationStrategy.DISABLE_FEATURES,
      DegradationStrategy.USE_CACHE,
      DegradationStrategy.READ_ONLY_MODE
    ]);

    this.config.customStrategies.set(DegradationLevel.SEVERE, [
      DegradationStrategy.DISABLE_FEATURES,
      DegradationStrategy.USE_CACHE,
      DegradationStrategy.READ_ONLY_MODE,
      DegradationStrategy.STATIC_CONTENT
    ]);

    this.config.customStrategies.set(DegradationLevel.COMPLETE, [
      DegradationStrategy.MAINTENANCE_MODE,
      DegradationStrategy.GRACEFUL_SHUTDOWN
    ]);
  }

  /**
   * Trigger degradation to a specific level
   */
  public async degrade(
    level: DegradationLevel, 
    reason: string, 
    context: Record<string, any> = {}
  ): Promise<DegradationStatus> {
    try {
      // Check if degradation level is within allowed limits
      if (this.isDegradationLevelExceeded(level)) {
        level = this.config.maxDegradationLevel;
        reason += ` (limited to ${level})`;
      }

      const previousLevel = this.currentStatus.currentLevel;
      const strategies = this.getStrategiesForLevel(level);

      // Apply degradation strategies
      await this.applyDegradationStrategies(strategies, context);

      // Update status
      this.currentStatus = {
        currentLevel: level,
        activeStrategies: strategies,
        degradationStartTime: previousLevel === DegradationLevel.NONE ? 
          new Date().toISOString() : this.currentStatus.degradationStartTime,
        reason,
        recoveryAttempts: level > previousLevel ? 0 : this.currentStatus.recoveryAttempts,
        recoveryInProgress: false,
        availableFeatures: this.getAvailableFeatures(level),
        disabledFeatures: this.getDisabledFeatures(level),
        userMessage: this.generateUserMessage(level, reason)
      };

      // Log degradation event
      const event: DegradationEvent = {
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType: 'degradation_triggered',
        previousLevel,
        newLevel: level,
        reason,
        context
      };

      this.eventHistory.push(event);
      this.trimEventHistory();

      // Start recovery timer if auto-recovery is enabled
      if (this.config.enableAutoDegradation && level > DegradationLevel.NONE) {
        this.scheduleRecoveryAttempt();
      }

      // Log and notify
      if (this.config.enableLogging) {
        console.log(`[GRACEFUL_DEGRADATION] Degraded to level ${level}: ${reason}`);
      }

      if (this.config.notifyUsers) {
        this.notifyUsers(this.currentStatus);
      }

      return this.currentStatus;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[GRACEFUL_DEGRADATION] Failed to apply degradation:', error);
      }
      throw error;
    }
  }

  /**
   * Attempt to recover from degradation
   */
  public async attemptRecovery(): Promise<boolean> {
    if (this.currentStatus.recoveryInProgress) {
      return false;
    }

    if (this.currentStatus.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      if (this.config.enableLogging) {
        console.log('[GRACEFUL_DEGRADATION] Maximum recovery attempts reached');
      }
      return false;
    }

    this.currentStatus.recoveryInProgress = true;
    this.currentStatus.recoveryAttempts++;

    try {
      // Attempt to test system health
      const healthCheck = await this.performHealthCheck();

      if (healthCheck.healthy) {
        // Gradually restore functionality
        const targetLevel = this.calculateRecoveryLevel(healthCheck.score);
        
        if (targetLevel < this.currentStatus.currentLevel) {
          await this.degrade(targetLevel, 'Recovery successful', { 
            healthScore: healthCheck.score,
            recoveryAttempt: this.currentStatus.recoveryAttempts
          });

          // Log successful recovery
          const event: DegradationEvent = {
            eventId: this.generateEventId(),
            timestamp: new Date().toISOString(),
            eventType: 'recovery_successful',
            previousLevel: this.currentStatus.currentLevel,
            newLevel: targetLevel,
            reason: 'Automatic recovery',
            context: { healthScore: healthCheck.score }
          };

          this.eventHistory.push(event);

          if (targetLevel === DegradationLevel.NONE) {
            this.stopRecoveryTimer();
          }

          return true;
        }
      }

      // Recovery failed
      const event: DegradationEvent = {
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType: 'recovery_failed',
        previousLevel: this.currentStatus.currentLevel,
        newLevel: this.currentStatus.currentLevel,
        reason: 'Health check failed',
        context: { healthScore: healthCheck.score }
      };

      this.eventHistory.push(event);

      return false;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[GRACEFUL_DEGRADATION] Recovery attempt failed:', error);
      }

      const event: DegradationEvent = {
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType: 'recovery_failed',
        previousLevel: this.currentStatus.currentLevel,
        newLevel: this.currentStatus.currentLevel,
        reason: `Recovery error: ${error.message}`,
        context: { error: error.message }
      };

      this.eventHistory.push(event);

      return false;

    } finally {
      this.currentStatus.recoveryInProgress = false;
      
      // Schedule next recovery attempt if needed
      if (this.currentStatus.currentLevel > DegradationLevel.NONE && 
          this.currentStatus.recoveryAttempts < this.config.maxRecoveryAttempts) {
        this.scheduleRecoveryAttempt();
      }
    }
  }

  /**
   * Get current degradation status
   */
  public getStatus(): DegradationStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if a feature is available
   */
  public isFeatureAvailable(featureId: string): boolean {
    const feature = this.features.get(featureId);
    if (!feature) {
      return false;
    }

    return this.currentStatus.currentLevel < feature.disabledAtLevel;
  }

  /**
   * Register a feature
   */
  public registerFeature(feature: FeatureDefinition): void {
    this.features.set(feature.featureId, feature);
    
    // Update current status to reflect new feature
    this.currentStatus.availableFeatures = this.getAvailableFeatures(this.currentStatus.currentLevel);
    this.currentStatus.disabledFeatures = this.getDisabledFeatures(this.currentStatus.currentLevel);
  }

  /**
   * Get degradation event history
   */
  public getEventHistory(): DegradationEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear degradation and restore full functionality
   */
  public async restore(): Promise<boolean> {
    try {
      this.stopRecoveryTimer();
      
      const previousLevel = this.currentStatus.currentLevel;
      
      // Restore to no degradation
      await this.degrade(DegradationLevel.NONE, 'Manual restore', { manual: true });

      const event: DegradationEvent = {
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType: 'recovery_successful',
        previousLevel,
        newLevel: DegradationLevel.NONE,
        reason: 'Manual restore',
        context: { manual: true }
      };

      this.eventHistory.push(event);

      if (this.config.enableLogging) {
        console.log('[GRACEFUL_DEGRADATION] System restored to full functionality');
      }

      return true;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[GRACEFUL_DEGRADATION] Failed to restore system:', error);
      }
      return false;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<GracefulDegradationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Check if degradation level exceeds maximum allowed
   */
  private isDegradationLevelExceeded(level: DegradationLevel): boolean {
    const levels = [
      DegradationLevel.NONE,
      DegradationLevel.MINIMAL,
      DegradationLevel.MODERATE,
      DegradationLevel.SEVERE,
      DegradationLevel.COMPLETE
    ];

    const levelIndex = levels.indexOf(level);
    const maxLevelIndex = levels.indexOf(this.config.maxDegradationLevel);

    return levelIndex > maxLevelIndex;
  }

  /**
   * Get strategies for a degradation level
   */
  private getStrategiesForLevel(level: DegradationLevel): DegradationStrategy[] {
    return this.config.customStrategies.get(level) || [];
  }

  /**
   * Apply degradation strategies
   */
  private async applyDegradationStrategies(
    strategies: DegradationStrategy[],
    context: Record<string, any>
  ): Promise<void> {
    for (const strategy of strategies) {
      try {
        await this.applyStrategy(strategy, context);
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`[GRACEFUL_DEGRADATION] Failed to apply strategy ${strategy}:`, error);
        }
      }
    }
  }

  /**
   * Apply a specific degradation strategy
   */
  private async applyStrategy(strategy: DegradationStrategy, context: Record<string, any>): Promise<void> {
    switch (strategy) {
      case DegradationStrategy.DISABLE_FEATURES:
        // Features are automatically disabled based on degradation level
        break;
        
      case DegradationStrategy.USE_CACHE:
        // Enable cache-only mode
        if (context.cacheService) {
          context.cacheService.enableCacheOnlyMode();
        }
        break;
        
      case DegradationStrategy.READ_ONLY_MODE:
        // Disable write operations
        if (context.credentialService) {
          context.credentialService.setReadOnlyMode(true);
        }
        break;
        
      case DegradationStrategy.STATIC_CONTENT:
        // Show static fallback content
        break;
        
      case DegradationStrategy.MAINTENANCE_MODE:
        // Show maintenance message
        break;
        
      case DegradationStrategy.GRACEFUL_SHUTDOWN:
        // Prepare for shutdown
        break;
    }
  }

  /**
   * Get available features for a degradation level
   */
  private getAvailableFeatures(level: DegradationLevel): string[] {
    return Array.from(this.features.values())
      .filter(feature => level < feature.disabledAtLevel)
      .map(feature => feature.featureId);
  }

  /**
   * Get disabled features for a degradation level
   */
  private getDisabledFeatures(level: DegradationLevel): string[] {
    return Array.from(this.features.values())
      .filter(feature => level >= feature.disabledAtLevel)
      .map(feature => feature.featureId);
  }

  /**
   * Generate user-facing message
   */
  private generateUserMessage(level: DegradationLevel, reason: string): string {
    switch (level) {
      case DegradationLevel.NONE:
        return 'All systems operational';
      case DegradationLevel.MINIMAL:
        return 'Some features temporarily unavailable';
      case DegradationLevel.MODERATE:
        return 'Limited functionality - using cached data';
      case DegradationLevel.SEVERE:
        return 'Reduced functionality - read-only mode';
      case DegradationLevel.COMPLETE:
        return 'System temporarily unavailable for maintenance';
      default:
        return 'System status unknown';
    }
  }

  /**
   * Schedule next recovery attempt
   */
  private scheduleRecoveryAttempt(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      this.attemptRecovery();
    }, this.config.recoveryAttemptInterval);

    this.currentStatus.nextRecoveryAttempt = new Date(
      Date.now() + this.config.recoveryAttemptInterval
    ).toISOString();
  }

  /**
   * Stop recovery timer
   */
  private stopRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.currentStatus.nextRecoveryAttempt = undefined;
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<{ healthy: boolean; score: number }> {
    try {
      // Simulate health check
      const score = Math.random() * 100;
      return {
        healthy: score > 70,
        score
      };
    } catch (error) {
      return {
        healthy: false,
        score: 0
      };
    }
  }

  /**
   * Calculate target recovery level based on health score
   */
  private calculateRecoveryLevel(healthScore: number): DegradationLevel {
    if (healthScore >= 90) return DegradationLevel.NONE;
    if (healthScore >= 70) return DegradationLevel.MINIMAL;
    if (healthScore >= 50) return DegradationLevel.MODERATE;
    if (healthScore >= 30) return DegradationLevel.SEVERE;
    return DegradationLevel.COMPLETE;
  }

  /**
   * Notify users of status change
   */
  private notifyUsers(status: DegradationStatus): void {
    // In a real implementation, this would send notifications to users
    if (this.config.enableLogging) {
      console.log(`[GRACEFUL_DEGRADATION] User notification: ${status.userMessage}`);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trim event history to prevent memory bloat
   */
  private trimEventHistory(): void {
    const maxEvents = 100;
    if (this.eventHistory.length > maxEvents) {
      this.eventHistory = this.eventHistory.slice(-maxEvents);
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating graceful degradation handlers
 */
export class GracefulDegradationFactory {
  /**
   * Create a standard graceful degradation handler
   */
  public static createStandard(config?: Partial<GracefulDegradationConfig>): BrowserGracefulDegradationHandler {
    return new BrowserGracefulDegradationHandler(config);
  }
}

/**
 * Create a standard graceful degradation handler
 */
export function createGracefulDegradationHandler(config?: Partial<GracefulDegradationConfig>): BrowserGracefulDegradationHandler {
  return GracefulDegradationFactory.createStandard(config);
}

/**
 * Create an aggressive degradation handler for high-availability systems
 */
export function createAggressiveDegradation(): BrowserGracefulDegradationHandler {
  return new BrowserGracefulDegradationHandler({
    maxDegradationLevel: DegradationLevel.MODERATE,
    recoveryAttemptInterval: 30000, // 30 seconds
    maxRecoveryAttempts: 10,
    enableAutoDegradation: true,
    enableLogging: true,
    notifyUsers: true
  });
}