import {
  GracefulDegradationConfig,
  DegradationLevel,
  FallbackStrategy,
  FallbackAction,
  SystemHealthStatus,
  ComponentHealth,
  HealthCheckResult,
  MCPAuthError,
  MCPAuthErrorType
} from './authTypes';

/**
 * Graceful Degradation Handler for Phase 6
 * Manages system degradation levels and fallback strategies
 */
export class GracefulDegradationHandler {
  private config: GracefulDegradationConfig;
  private currentDegradationLevel: number = 0;
  private systemHealth: SystemHealthStatus;
  private activeFallbacks: Set<string> = new Set();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private operationCounts: Map<string, { success: number; failure: number }> = new Map();

  constructor(config: GracefulDegradationConfig) {
    this.config = config;
    
    // Initialize system health
    this.systemHealth = this.initializeSystemHealth();
    
    if (this.config.enableGracefulDegradation) {
      this.startHealthMonitoring();
    }
  }

  // ============================================================================
  // PHASE 6: GRACEFUL DEGRADATION & FALLBACK STRATEGIES
  // ============================================================================

  /**
   * Execute operation with graceful degradation support
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    operationType: string,
    context?: Record<string, any>
  ): Promise<{ success: boolean; result?: T; error?: MCPAuthError; usedFallback?: string; degradationLevel: number }> {
    const startTime = Date.now();
    
    try {
      // Check if we should use fallback based on current degradation level
      const shouldUseFallback = this.shouldUseFallback(operationType);
      
      if (shouldUseFallback) {
        const fallbackResult = await this.executeFallback(operationType, context);
        return {
          success: fallbackResult.success,
          result: fallbackResult.result,
          error: fallbackResult.error,
          usedFallback: fallbackResult.strategy,
          degradationLevel: this.currentDegradationLevel
        };
      }

      // Execute normal operation
      const result = await operation();
      
      // Record success
      this.recordOperationResult(operationType, true, Date.now() - startTime);
      
      return {
        success: true,
        result,
        degradationLevel: this.currentDegradationLevel
      };

    } catch (error) {
      const authError = this.convertToMCPAuthError(error);
      const duration = Date.now() - startTime;
      
      // Record failure
      this.recordOperationResult(operationType, false, duration);
      
      // Check if we should degrade or use fallback
      const shouldDegrade = this.shouldDegrade(operationType);
      if (shouldDegrade) {
        this.degradeSystem();
      }

      // Try fallback strategy
      const fallbackResult = await this.executeFallback(operationType, context);
      if (fallbackResult.success) {
        return {
          success: true,
          result: fallbackResult.result,
          usedFallback: fallbackResult.strategy,
          degradationLevel: this.currentDegradationLevel
        };
      }

      return {
        success: false,
        error: authError,
        degradationLevel: this.currentDegradationLevel
      };
    }
  }

  /**
   * Execute fallback strategy for operation type
   */
  private async executeFallback(operationType: string, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
    error?: MCPAuthError;
    strategy?: string;
  }> {
    const applicableStrategies = this.config.fallbackStrategies
      .filter(strategy => strategy.triggerConditions.includes(operationType))
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of applicableStrategies) {
      try {
        const result = await this.executeStrategy(strategy, context);
        if (result.success) {
          this.activeFallbacks.add(strategy.name);
          return { ...result, strategy: strategy.name };
        }
      } catch (error) {
        console.warn(`[Graceful Degradation] Fallback strategy ${strategy.name} failed:`, error);
      }
    }

    return { success: false };
  }

  /**
   * Execute a specific fallback strategy
   */
  private async executeStrategy(strategy: FallbackStrategy, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
    error?: MCPAuthError;
  }> {
    for (const action of strategy.actions) {
      try {
        const result = await this.executeAction(action, context);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn(`[Graceful Degradation] Action ${action.type} failed:`, error);
      }
    }

    return { success: false };
  }

  /**
   * Execute a specific fallback action
   */
  private async executeAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
    error?: MCPAuthError;
  }> {
    switch (action.type) {
      case 'cache':
        return this.executeCacheAction(action, context);
      
      case 'anonymous':
        return this.executeAnonymousAction(action, context);
      
      case 'simplified':
        return this.executeSimplifiedAction(action, context);
      
      case 'offline':
        return this.executeOfflineAction(action, context);
      
      case 'retry':
        return this.executeRetryAction(action, context);
      
      case 'abort':
        return this.executeAbortAction(action, context);
      
      default:
        return { success: false };
    }
  }

  /**
   * Execute cache fallback action
   */
  private async executeCacheAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
  }> {
    // Simulate cache lookup
    const cacheKey = `fallback_${JSON.stringify(context)}`;
    
    // In a real implementation, this would check actual cache
    const cachedResult = this.getCachedResult(cacheKey);
    
    if (cachedResult) {
      return { success: true, result: cachedResult };
    }

    return { success: false };
  }

  /**
   * Execute anonymous fallback action
   */
  private async executeAnonymousAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
  }> {
    // Create anonymous credentials
    const anonymousCredentials = {
      bearerToken: 'anonymous',
      refreshToken: '',
      userId: 'anonymous',
      userEmail: 'anonymous@local',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      tokenSource: 'fallback'
    };

    return { success: true, result: anonymousCredentials };
  }

  /**
   * Execute simplified authentication action
   */
  private async executeSimplifiedAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
  }> {
    // Create simplified credentials with reduced validation
    const simplifiedCredentials = {
      bearerToken: `simplified_${Date.now()}`,
      refreshToken: '',
      userId: 'simplified_user',
      userEmail: 'simplified@local',
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
      tokenSource: 'simplified_fallback'
    };

    return { success: true, result: simplifiedCredentials };
  }

  /**
   * Execute offline mode action
   */
  private async executeOfflineAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
  }> {
    // Return cached/offline credentials
    const offlineCredentials = {
      bearerToken: 'offline_mode',
      refreshToken: '',
      userId: 'offline_user',
      userEmail: 'offline@local',
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      tokenSource: 'offline'
    };

    return { success: true, result: offlineCredentials };
  }

  /**
   * Execute retry action with delay
   */
  private async executeRetryAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    result?: any;
  }> {
    const retryDelay = action.parameters.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    
    // This would trigger the original operation retry
    return { success: false }; // Let the caller handle the retry
  }

  /**
   * Execute abort action
   */
  private async executeAbortAction(action: FallbackAction, context?: Record<string, any>): Promise<{
    success: boolean;
    error?: MCPAuthError;
  }> {
    return { 
      success: false,
      error: new MCPAuthError(
        MCPAuthErrorType.VALIDATION_ERROR,
        'Operation aborted by fallback strategy'
      )
    };
  }

  /**
   * Check if operation should use fallback based on degradation level
   */
  private shouldUseFallback(operationType: string): boolean {
    if (!this.config.enableGracefulDegradation) {
      return false;
    }

    const currentLevel = this.getCurrentDegradationLevel();
    if (!currentLevel) {
      return false;
    }

    return currentLevel.disabledFeatures.includes(operationType);
  }

  /**
   * Check if system should degrade based on operation failures
   */
  private shouldDegrade(operationType: string): boolean {
    const stats = this.operationCounts.get(operationType);
    if (!stats) {
      return false;
    }

    const totalOperations = stats.success + stats.failure;
    const failureRate = stats.failure / totalOperations;
    
    return failureRate >= (this.config.degradationThreshold / 100);
  }

  /**
   * Degrade system to next level
   */
  private degradeSystem(): void {
    if (this.currentDegradationLevel < this.config.maxDegradationLevel) {
      this.currentDegradationLevel++;
      this.updateSystemHealth();
      
      console.warn(`[Graceful Degradation] System degraded to level ${this.currentDegradationLevel}`);
    }
  }

  /**
   * Upgrade system degradation level if performance improves
   */
  private upgradeSystem(): void {
    if (this.currentDegradationLevel > 0) {
      this.currentDegradationLevel--;
      this.updateSystemHealth();
      
      console.info(`[Graceful Degradation] System upgraded to level ${this.currentDegradationLevel}`);
    }
  }

  /**
   * Get current degradation level configuration
   */
  private getCurrentDegradationLevel(): DegradationLevel | undefined {
    return this.config.degradationLevels.find(level => level.level === this.currentDegradationLevel);
  }

  /**
   * Record operation result for degradation decisions
   */
  private recordOperationResult(operationType: string, success: boolean, duration: number): void {
    const stats = this.operationCounts.get(operationType) || { success: 0, failure: 0 };
    
    if (success) {
      stats.success++;
    } else {
      stats.failure++;
    }
    
    this.operationCounts.set(operationType, stats);
    
    // Update component health
    this.updateComponentHealth(operationType, success, duration);
    
    // Check for auto-recovery
    if (this.config.enableAutoRecovery && success) {
      this.checkAutoRecovery(operationType);
    }
  }

  /**
   * Check if system can auto-recover to better degradation level
   */
  private checkAutoRecovery(operationType: string): void {
    const stats = this.operationCounts.get(operationType);
    if (!stats) return;

    const totalOperations = stats.success + stats.failure;
    const successRate = stats.success / totalOperations;
    
    if (successRate >= (this.config.recoveryThreshold / 100) && totalOperations >= 10) {
      this.upgradeSystem();
      // Reset stats after upgrade
      this.operationCounts.set(operationType, { success: 0, failure: 0 });
    }
  }

  /**
   * Update component health based on operation results
   */
  private updateComponentHealth(operationType: string, success: boolean, duration: number): void {
    const componentMap: Record<string, keyof SystemHealthStatus['components']> = {
      'auth': 'authentication',
      'refresh': 'tokenRefresh',
      'validate': 'security',
      'migrate': 'compatibility',
      'log': 'logging'
    };

    const componentName = componentMap[operationType] || 'authentication';
    const component = this.systemHealth.components[componentName];
    
    // Update metrics
    component.responseTime = (component.responseTime + duration) / 2; // Simple moving average
    component.lastCheck = Date.now();
    
    const stats = this.operationCounts.get(operationType) || { success: 0, failure: 0 };
    const total = stats.success + stats.failure;
    
    if (total > 0) {
      component.successRate = (stats.success / total) * 100;
      component.errorRate = (stats.failure / total) * 100;
    }

    // Update status based on performance
    if (component.errorRate > 50) {
      component.status = 'critical';
    } else if (component.errorRate > 25) {
      component.status = 'degraded';
    } else if (component.responseTime > 5000) {
      component.status = 'degraded';
    } else {
      component.status = 'healthy';
    }
  }

  /**
   * Initialize system health status
   */
  private initializeSystemHealth(): SystemHealthStatus {
    const now = Date.now();
    const healthyComponent: ComponentHealth = {
      status: 'healthy',
      responseTime: 0,
      errorRate: 0,
      successRate: 100,
      lastCheck: now,
      errors: [],
      metrics: {}
    };

    return {
      overall: 'healthy',
      components: {
        authentication: { ...healthyComponent },
        tokenRefresh: { ...healthyComponent },
        security: { ...healthyComponent },
        compatibility: { ...healthyComponent },
        logging: { ...healthyComponent }
      },
      degradationLevel: 0,
      activeFallbacks: [],
      lastHealthCheck: now,
      healthHistory: []
    };
  }

  /**
   * Update overall system health status
   */
  private updateSystemHealth(): void {
    const now = Date.now();
    const components = Object.values(this.systemHealth.components);
    
    // Determine overall health
    if (components.some(c => c.status === 'critical')) {
      this.systemHealth.overall = 'critical';
    } else if (components.some(c => c.status === 'degraded')) {
      this.systemHealth.overall = 'degraded';
    } else if (this.currentDegradationLevel > 0) {
      this.systemHealth.overall = 'degraded';
    } else {
      this.systemHealth.overall = 'healthy';
    }

    this.systemHealth.degradationLevel = this.currentDegradationLevel;
    this.systemHealth.activeFallbacks = Array.from(this.activeFallbacks);
    this.systemHealth.lastHealthCheck = now;

    // Add to health history
    const healthCheck: HealthCheckResult = {
      timestamp: now,
      component: 'system',
      status: this.systemHealth.overall,
      responseTime: this.getAverageResponseTime(),
      errorCount: this.getTotalErrorCount(),
      successCount: this.getTotalSuccessCount()
    };

    this.systemHealth.healthHistory.push(healthCheck);
    
    // Keep only recent history (last 100 checks)
    if (this.systemHealth.healthHistory.length > 100) {
      this.systemHealth.healthHistory = this.systemHealth.healthHistory.slice(-100);
    }
  }

  /**
   * Start health monitoring timer
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform periodic health check
   */
  private performHealthCheck(): void {
    this.updateSystemHealth();
    
    // Check if we should trigger fallbacks
    this.checkFallbackTriggers();
    
    // Clean up inactive fallbacks
    this.cleanupInactiveFallbacks();
  }

  /**
   * Check if any fallback strategies should be triggered
   */
  private checkFallbackTriggers(): void {
    for (const strategy of this.config.fallbackStrategies) {
      for (const condition of strategy.triggerConditions) {
        if (this.shouldTriggerFallback(condition)) {
          this.activeFallbacks.add(strategy.name);
        }
      }
    }
  }

  /**
   * Check if a fallback should be triggered based on condition
   */
  private shouldTriggerFallback(condition: string): boolean {
    // Simple condition parsing - in production this would be more sophisticated
    if (condition === 'high_error_rate') {
      return this.getAverageErrorRate() > 25;
    }
    
    if (condition === 'slow_response') {
      return this.getAverageResponseTime() > 5000;
    }
    
    if (condition === 'system_degraded') {
      return this.currentDegradationLevel > 0;
    }
    
    return false;
  }

  /**
   * Clean up inactive fallbacks
   */
  private cleanupInactiveFallbacks(): void {
    for (const fallbackName of Array.from(this.activeFallbacks)) {
      // Remove fallbacks that are no longer needed
      const strategy = this.config.fallbackStrategies.find(s => s.name === fallbackName);
      if (strategy && strategy.retryAfter) {
        // Check if retry period has passed
        // This would need more sophisticated tracking in production
        this.activeFallbacks.delete(fallbackName);
      }
    }
  }

  /**
   * Get cached result (simulation)
   */
  private getCachedResult(key: string): any {
    // This would interface with actual cache in production
    return null;
  }

  /**
   * Convert error to MCPAuthError
   */
  private convertToMCPAuthError(error: any): MCPAuthError {
    if (error instanceof MCPAuthError) {
      return error;
    }

    return new MCPAuthError(
      MCPAuthErrorType.UNKNOWN_ERROR,
      error instanceof Error ? error.message : String(error),
      error
    );
  }

  /**
   * Get average response time across all components
   */
  private getAverageResponseTime(): number {
    const components = Object.values(this.systemHealth.components);
    const total = components.reduce((sum, c) => sum + c.responseTime, 0);
    return components.length > 0 ? total / components.length : 0;
  }

  /**
   * Get average error rate across all components
   */
  private getAverageErrorRate(): number {
    const components = Object.values(this.systemHealth.components);
    const total = components.reduce((sum, c) => sum + c.errorRate, 0);
    return components.length > 0 ? total / components.length : 0;
  }

  /**
   * Get total error count
   */
  private getTotalErrorCount(): number {
    return Array.from(this.operationCounts.values())
      .reduce((sum, stats) => sum + stats.failure, 0);
  }

  /**
   * Get total success count
   */
  private getTotalSuccessCount(): number {
    return Array.from(this.operationCounts.values())
      .reduce((sum, stats) => sum + stats.success, 0);
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealthStatus {
    return { ...this.systemHealth };
  }

  /**
   * Get current degradation level
   */
  getDegradationLevel(): number {
    return this.currentDegradationLevel;
  }

  /**
   * Get active fallback strategies
   */
  getActiveFallbacks(): string[] {
    return Array.from(this.activeFallbacks);
  }

  /**
   * Force degradation to specific level (for testing)
   */
  forceDegradationLevel(level: number): void {
    this.currentDegradationLevel = Math.max(0, Math.min(level, this.config.maxDegradationLevel));
    this.updateSystemHealth();
  }

  /**
   * Reset system to healthy state
   */
  resetToHealthy(): void {
    this.currentDegradationLevel = 0;
    this.activeFallbacks.clear();
    this.operationCounts.clear();
    this.systemHealth = this.initializeSystemHealth();
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    this.activeFallbacks.clear();
    this.operationCounts.clear();
  }
}