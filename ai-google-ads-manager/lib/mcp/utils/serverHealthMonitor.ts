/**
 * MCP Server Health Monitor
 * 
 * Provides comprehensive monitoring of MCP server health including:
 * - Real-time heartbeat monitoring
 * - Service availability tracking
 * - API endpoint health checks
 * - Server response time monitoring
 */

import {
  ServerHealthState,
  ServiceStatus,
  HealthCheckResult,
  HeartbeatConfig,
  ServiceConfig,
  EndpointConfig,
  ServerHealthMetrics,
  ServiceHealth,
  EndpointHealth,
  HealthEvent,
  HealthEventCallback,
  HealthEventType,
  ServerHealthMonitoringState,
  ResponseTimeAnalytics,
  HealthSummary,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_SERVICE_CONFIG,
  DEFAULT_ENDPOINT_CONFIG
} from '../types/serverHealth';

/**
 * Server Health Monitor Class
 */
export class ServerHealthMonitor {
  private state: ServerHealthMonitoringState;
  private eventCallbacks: Map<HealthEventType, HealthEventCallback[]> = new Map();

  constructor(
    private baseUrl: string = 'http://localhost:3001',
    private heartbeatConfig: HeartbeatConfig = DEFAULT_HEARTBEAT_CONFIG
  ) {
    this.state = {
      isActive: false,
      metrics: this.createInitialMetrics(),
      heartbeatConfig: this.heartbeatConfig,
      services: new Map(),
      endpoints: new Map(),
      eventHistory: [],
      activeIntervals: new Map()
    };

    this.initializeEventTypes();
  }

  /**
   * Initialize event callback maps
   */
  private initializeEventTypes(): void {
    const eventTypes: HealthEventType[] = [
      'heartbeat_success', 'heartbeat_failure', 'service_status_change',
      'endpoint_status_change', 'health_degradation', 'health_recovery',
      'response_time_spike', 'error_rate_increase'
    ];

    eventTypes.forEach(type => {
      this.eventCallbacks.set(type, []);
    });
  }

  /**
   * Start health monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.state.isActive) {
      console.warn('Server health monitoring is already active');
      return;
    }

    this.state.isActive = true;
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
    
    // Start service monitoring
    this.startServiceMonitoring();
    
    // Start endpoint monitoring
    this.startEndpointMonitoring();
    
    console.log('Server health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    
    // Clear all intervals
    this.state.activeIntervals.forEach(interval => clearInterval(interval));
    this.state.activeIntervals.clear();
    
    console.log('Server health monitoring stopped');
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    const performHeartbeat = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${this.baseUrl}${this.heartbeatConfig.endpoint}`, {
          method: 'GET',
          headers: this.heartbeatConfig.headers,
          signal: AbortSignal.timeout(this.heartbeatConfig.timeout)
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;

        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success,
          responseTime,
          statusCode: response.status,
          metadata: { endpoint: this.heartbeatConfig.endpoint }
        };

        if (success) {
          this.handleHeartbeatSuccess(result);
        } else {
          this.handleHeartbeatFailure(result);
        }

      } catch (error) {
        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success: false,
          responseTime: this.heartbeatConfig.timeout,
          error: error instanceof Error ? error.message : String(error),
          metadata: { endpoint: this.heartbeatConfig.endpoint }
        };

        this.handleHeartbeatFailure(result);
      }
    };

    // Initial heartbeat
    performHeartbeat();

    // Schedule recurring heartbeats
    const heartbeatInterval = setInterval(performHeartbeat, this.heartbeatConfig.interval);
    this.state.activeIntervals.set('heartbeat', heartbeatInterval);
  }

  /**
   * Handle successful heartbeat
   */
  private handleHeartbeatSuccess(result: HealthCheckResult): void {
    this.state.metrics.lastHeartbeat = result.timestamp;
    this.state.metrics.failedHeartbeats = Math.max(0, this.state.metrics.failedHeartbeats - 1);

    this.emitEvent('heartbeat_success', {
      severity: 'info',
      data: { responseTime: result.responseTime, statusCode: result.statusCode }
    });

    this.updateHealthMetrics();
  }

  /**
   * Handle failed heartbeat
   */
  private handleHeartbeatFailure(result: HealthCheckResult): void {
    this.state.metrics.failedHeartbeats++;

    this.emitEvent('heartbeat_failure', {
      severity: this.state.metrics.failedHeartbeats >= this.heartbeatConfig.failureThreshold ? 'critical' : 'warning',
      data: { error: result.error, consecutiveFailures: this.state.metrics.failedHeartbeats }
    });

    this.updateHealthMetrics();
  }

  /**
   * Add service for monitoring
   */
  public addService(config: ServiceConfig): void {
    const serviceHealth: ServiceHealth = {
      config: { ...DEFAULT_SERVICE_CONFIG, ...config },
      status: 'unknown',
      lastCheck: {
        timestamp: 0,
        success: false,
        responseTime: 0
      },
      checkHistory: [],
      uptime: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastSuccessfulCheck: 0,
      consecutiveFailures: 0
    };

    this.state.services.set(config.id, serviceHealth);

    if (this.state.isActive) {
      this.startServiceHealthChecks(config.id);
    }
  }

  /**
   * Start service health checks
   */
  private startServiceMonitoring(): void {
    this.state.services.forEach((_, serviceId) => {
      this.startServiceHealthChecks(serviceId);
    });
  }

  /**
   * Start health checks for a specific service
   */
  private startServiceHealthChecks(serviceId: string): void {
    const serviceHealth = this.state.services.get(serviceId);
    if (!serviceHealth) return;

    const performHealthCheck = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(serviceHealth.config.healthEndpoint, {
          method: 'GET',
          signal: AbortSignal.timeout(serviceHealth.config.timeout)
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;

        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success,
          responseTime,
          statusCode: response.status
        };

        this.updateServiceHealth(serviceId, result);

      } catch (error) {
        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success: false,
          responseTime: serviceHealth.config.timeout,
          error: error instanceof Error ? error.message : String(error)
        };

        this.updateServiceHealth(serviceId, result);
      }
    };

    // Initial check
    performHealthCheck();

    // Schedule recurring checks
    const checkInterval = setInterval(performHealthCheck, serviceHealth.config.checkInterval);
    this.state.activeIntervals.set(`service_${serviceId}`, checkInterval);
  }

  /**
   * Update service health based on check result
   */
  private updateServiceHealth(serviceId: string, result: HealthCheckResult): void {
    const serviceHealth = this.state.services.get(serviceId);
    if (!serviceHealth) return;

    const previousStatus = serviceHealth.status;
    
    // Update check history
    serviceHealth.lastCheck = result;
    serviceHealth.checkHistory.push(result);
    
    // Keep only recent history (last 100 checks)
    if (serviceHealth.checkHistory.length > 100) {
      serviceHealth.checkHistory.shift();
    }

    // Update consecutive failures
    if (result.success) {
      serviceHealth.consecutiveFailures = 0;
      serviceHealth.lastSuccessfulCheck = result.timestamp;
    } else {
      serviceHealth.consecutiveFailures++;
    }

    // Calculate metrics
    this.calculateServiceMetrics(serviceHealth);

    // Determine new status
    const newStatus = this.determineServiceStatus(serviceHealth);
    serviceHealth.status = newStatus;

    // Update overall metrics
    this.state.metrics.servicesHealth[serviceId] = newStatus;

    // Emit event if status changed
    if (previousStatus !== newStatus) {
      this.emitEvent('service_status_change', {
        targetId: serviceId,
        previousValue: previousStatus,
        currentValue: newStatus,
        severity: newStatus === 'outage' ? 'critical' : newStatus === 'degraded' ? 'warning' : 'info'
      });
    }

    this.updateHealthMetrics();
  }

  /**
   * Calculate service metrics
   */
  private calculateServiceMetrics(serviceHealth: ServiceHealth): void {
    const history = serviceHealth.checkHistory;
    if (history.length === 0) return;

    // Calculate uptime
    const successfulChecks = history.filter(check => check.success).length;
    serviceHealth.uptime = (successfulChecks / history.length) * 100;

    // Calculate average response time
    const responseTimes = history.filter(check => check.success).map(check => check.responseTime);
    serviceHealth.averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    // Calculate error rate
    serviceHealth.errorRate = ((history.length - successfulChecks) / history.length) * 100;
  }

  /**
   * Determine service status based on health data
   */
  private determineServiceStatus(serviceHealth: ServiceHealth): ServiceStatus {
    if (serviceHealth.consecutiveFailures >= 3) {
      return 'outage';
    }
    
    if (serviceHealth.uptime < 95) {
      return 'degraded';
    }
    
    if (serviceHealth.errorRate > 5) {
      return 'degraded';
    }

    return 'operational';
  }

  /**
   * Add endpoint for monitoring
   */
  public addEndpoint(config: EndpointConfig): void {
    const endpointHealth: EndpointHealth = {
      config: { ...DEFAULT_ENDPOINT_CONFIG, ...config },
      isHealthy: false,
      lastCheck: {
        timestamp: 0,
        success: false,
        responseTime: 0
      },
      checkHistory: [],
      responseTimeStats: {
        min: 0,
        max: 0,
        average: 0,
        p95: 0,
        p99: 0
      },
      successRate: 0,
      consecutiveFailures: 0
    };

    this.state.endpoints.set(config.id, endpointHealth);

    if (this.state.isActive) {
      this.startEndpointHealthChecks(config.id);
    }
  }

  /**
   * Start endpoint monitoring
   */
  private startEndpointMonitoring(): void {
    this.state.endpoints.forEach((_, endpointId) => {
      this.startEndpointHealthChecks(endpointId);
    });
  }

  /**
   * Start health checks for a specific endpoint
   */
  private startEndpointHealthChecks(endpointId: string): void {
    const endpointHealth = this.state.endpoints.get(endpointId);
    if (!endpointHealth) return;

    const performHealthCheck = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(endpointHealth.config.url, {
          method: endpointHealth.config.method,
          headers: endpointHealth.config.headers,
          body: endpointHealth.config.body ? JSON.stringify(endpointHealth.config.body) : undefined,
          signal: AbortSignal.timeout(endpointHealth.config.timeout)
        });

        const responseTime = Date.now() - startTime;
        const success = endpointHealth.config.expectedStatusCodes.includes(response.status) && 
                       responseTime <= endpointHealth.config.responseTimeThreshold;

        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success,
          responseTime,
          statusCode: response.status
        };

        this.updateEndpointHealth(endpointId, result);

      } catch (error) {
        const result: HealthCheckResult = {
          timestamp: Date.now(),
          success: false,
          responseTime: endpointHealth.config.timeout,
          error: error instanceof Error ? error.message : String(error)
        };

        this.updateEndpointHealth(endpointId, result);
      }
    };

    // Initial check
    performHealthCheck();

    // Schedule recurring checks
    const checkInterval = setInterval(performHealthCheck, endpointHealth.config.checkInterval);
    this.state.activeIntervals.set(`endpoint_${endpointId}`, checkInterval);
  }

  /**
   * Update endpoint health based on check result
   */
  private updateEndpointHealth(endpointId: string, result: HealthCheckResult): void {
    const endpointHealth = this.state.endpoints.get(endpointId);
    if (!endpointHealth) return;

    const previousHealthy = endpointHealth.isHealthy;
    
    // Update check history
    endpointHealth.lastCheck = result;
    endpointHealth.checkHistory.push(result);
    
    // Keep only recent history (last 100 checks)
    if (endpointHealth.checkHistory.length > 100) {
      endpointHealth.checkHistory.shift();
    }

    // Update consecutive failures
    if (result.success) {
      endpointHealth.consecutiveFailures = 0;
    } else {
      endpointHealth.consecutiveFailures++;
    }

    // Calculate metrics
    this.calculateEndpointMetrics(endpointHealth);

    // Determine health status
    endpointHealth.isHealthy = endpointHealth.consecutiveFailures < 3 && endpointHealth.successRate > 90;

    // Update overall metrics
    this.state.metrics.endpointsHealth[endpointId] = endpointHealth.isHealthy;

    // Emit event if status changed
    if (previousHealthy !== endpointHealth.isHealthy) {
      this.emitEvent('endpoint_status_change', {
        targetId: endpointId,
        previousValue: previousHealthy,
        currentValue: endpointHealth.isHealthy,
        severity: !endpointHealth.isHealthy ? 'warning' : 'info'
      });
    }

    this.updateHealthMetrics();
  }

  /**
   * Calculate endpoint metrics
   */
  private calculateEndpointMetrics(endpointHealth: EndpointHealth): void {
    const history = endpointHealth.checkHistory;
    if (history.length === 0) return;

    // Calculate success rate
    const successfulChecks = history.filter(check => check.success).length;
    endpointHealth.successRate = (successfulChecks / history.length) * 100;

    // Calculate response time statistics
    const responseTimes = history.map(check => check.responseTime).sort((a, b) => a - b);
    
    if (responseTimes.length > 0) {
      endpointHealth.responseTimeStats = {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        p95: this.calculatePercentile(responseTimes, 0.95),
        p99: this.calculatePercentile(responseTimes, 0.99)
      };
    }
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)] || 0;
  }

  /**
   * Update overall health metrics
   */
  private updateHealthMetrics(): void {
    const now = Date.now();
    
    // Calculate overall health score
    let healthScore = 100;
    
    // Reduce score based on failed heartbeats
    if (this.state.metrics.failedHeartbeats > 0) {
      healthScore -= Math.min(50, this.state.metrics.failedHeartbeats * 10);
    }
    
    // Reduce score based on service health
    const services = Array.from(this.state.services.values());
    const unhealthyServices = services.filter(s => s.status === 'outage' || s.status === 'degraded');
    healthScore -= unhealthyServices.length * 10;
    
    // Reduce score based on endpoint health
    const endpoints = Array.from(this.state.endpoints.values());
    const unhealthyEndpoints = endpoints.filter(e => !e.isHealthy);
    healthScore -= unhealthyEndpoints.length * 5;
    
    this.state.metrics.healthScore = Math.max(0, healthScore);
    
    // Determine overall health state
    this.state.metrics.overallHealth = this.determineOverallHealthState();
    
    // Calculate other metrics
    this.state.metrics.uptime = this.calculateUptime();
    this.state.metrics.averageResponseTime = this.calculateAverageResponseTime();
    this.state.metrics.errorRate = this.calculateErrorRate();
    this.state.metrics.timestamp = now;
  }

  /**
   * Determine overall health state
   */
  private determineOverallHealthState(): ServerHealthState {
    if (this.state.metrics.healthScore >= 95) return 'healthy';
    if (this.state.metrics.healthScore >= 80) return 'degraded';
    if (this.state.metrics.healthScore >= 60) return 'unhealthy';
    return 'unhealthy';
  }

  /**
   * Calculate uptime percentage
   */
  private calculateUptime(): number {
    // Simplified calculation for now
    return this.state.metrics.failedHeartbeats === 0 ? 100 : Math.max(0, 100 - this.state.metrics.failedHeartbeats * 2);
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    const allEndpoints = Array.from(this.state.endpoints.values());
    if (allEndpoints.length === 0) return 0;
    
    const avgTimes = allEndpoints.map(e => e.responseTimeStats.average).filter(t => t > 0);
    return avgTimes.length > 0 ? avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length : 0;
  }

  /**
   * Calculate overall error rate
   */
  private calculateErrorRate(): number {
    const allServices = Array.from(this.state.services.values());
    if (allServices.length === 0) return 0;
    
    const errorRates = allServices.map(s => s.errorRate);
    return errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
  }

  /**
   * Create initial metrics
   */
  private createInitialMetrics(): ServerHealthMetrics {
    return {
      overallHealth: 'unknown',
      healthScore: 0,
      uptime: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastHeartbeat: 0,
      failedHeartbeats: 0,
      servicesHealth: {},
      endpointsHealth: {},
      timestamp: Date.now()
    };
  }

  /**
   * Emit health event
   */
  private emitEvent(type: HealthEventType, data: Partial<HealthEvent>): void {
    const event: HealthEvent = {
      type,
      timestamp: Date.now(),
      severity: 'info',
      ...data
    };
    
    this.state.eventHistory.push(event);
    
    // Keep only recent events
    if (this.state.eventHistory.length > 1000) {
      this.state.eventHistory.shift();
    }
    
    const callbacks = this.eventCallbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in health event callback:`, error);
      }
    });
  }

  /**
   * Public API methods
   */
  public on(eventType: HealthEventType, callback: HealthEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    callbacks.push(callback);
    this.eventCallbacks.set(eventType, callbacks);
  }

  public off(eventType: HealthEventType, callback: HealthEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  public getMetrics(): ServerHealthMetrics {
    return { ...this.state.metrics };
  }

  public getServiceHealth(serviceId: string): ServiceHealth | undefined {
    const service = this.state.services.get(serviceId);
    return service ? { ...service } : undefined;
  }

  public getEndpointHealth(endpointId: string): EndpointHealth | undefined {
    const endpoint = this.state.endpoints.get(endpointId);
    return endpoint ? { ...endpoint } : undefined;
  }

  public getHealthSummary(): HealthSummary {
    const services = Array.from(this.state.services.values());
    const endpoints = Array.from(this.state.endpoints.values());
    
    return {
      status: this.state.metrics.overallHealth,
      score: this.state.metrics.healthScore,
      criticalIssues: this.state.eventHistory.filter(e => e.severity === 'critical').length,
      warningIssues: this.state.eventHistory.filter(e => e.severity === 'warning').length,
      services: {
        total: services.length,
        healthy: services.filter(s => s.status === 'operational').length,
        degraded: services.filter(s => s.status === 'degraded').length,
        unhealthy: services.filter(s => s.status === 'outage').length
      },
      endpoints: {
        total: endpoints.length,
        healthy: endpoints.filter(e => e.isHealthy).length,
        unhealthy: endpoints.filter(e => !e.isHealthy).length
      },
      performance: {
        averageResponseTime: this.state.metrics.averageResponseTime,
        uptime: this.state.metrics.uptime,
        errorRate: this.state.metrics.errorRate
      }
    };
  }
}

/**
 * Factory function
 */
export function createServerHealthMonitor(
  baseUrl?: string,
  heartbeatConfig?: Partial<HeartbeatConfig>
): ServerHealthMonitor {
  return new ServerHealthMonitor(
    baseUrl,
    { ...DEFAULT_HEARTBEAT_CONFIG, ...heartbeatConfig }
  );
}

let globalHealthMonitor: ServerHealthMonitor | null = null;

export function getGlobalServerHealthMonitor(): ServerHealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = createServerHealthMonitor();
  }
  return globalHealthMonitor;
}

export function resetGlobalServerHealthMonitor(): void {
  if (globalHealthMonitor) {
    globalHealthMonitor.stopMonitoring();
    globalHealthMonitor = null;
  }
}

export default ServerHealthMonitor;