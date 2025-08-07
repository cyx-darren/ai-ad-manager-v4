/**
 * Real-time Connection Monitor for MCP Client
 * Phase 1: Core WebSocket monitoring with basic quality assessment
 */

import {
  ConnectionState,
  NetworkQuality,
  ConnectionQualityMetrics,
  WebSocketMonitorConfig,
  NetworkMonitorConfig,
  ConnectionEvent,
  ConnectionEventCallback,
  ConnectionEventType,
  ConnectionHealth,
  MonitoringState,
  DEFAULT_WEBSOCKET_CONFIG,
  DEFAULT_NETWORK_CONFIG
} from '../types/connection';

/**
 * Simplified Connection Monitor for Phase 1 Implementation
 */
export class ConnectionMonitor {
  private websocket: WebSocket | null = null;
  private isActive: boolean = false;
  private connectionState: ConnectionState = 'disconnected';
  private eventCallbacks: Map<ConnectionEventType, ConnectionEventCallback[]> = new Map();
  private latencyHistory: number[] = [];
  private startTime: number = Date.now();

  constructor(
    private wsConfig: WebSocketMonitorConfig = DEFAULT_WEBSOCKET_CONFIG,
    private networkConfig: NetworkMonitorConfig = DEFAULT_NETWORK_CONFIG
  ) {
    this.initializeEventTypes();
  }

  private initializeEventTypes(): void {
    const eventTypes: ConnectionEventType[] = [
      'state_change', 'quality_change', 'metrics_update', 'error',
      'reconnection_attempt', 'bandwidth_test_complete', 'latency_spike'
    ];
    eventTypes.forEach(type => {
      this.eventCallbacks.set(type, []);
    });
  }

  /**
   * Start monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startTime = Date.now();
    await this.initializeWebSocket();
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    this.isActive = false;
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.updateConnectionState('disconnected');
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      this.websocket = new WebSocket(this.wsConfig.endpoint);
      
      this.websocket.onopen = () => this.handleOpen();
      this.websocket.onclose = (event) => this.handleClose(event);
      this.websocket.onerror = (error) => this.handleError(error);
      this.websocket.onmessage = (message) => this.handleMessage(message);
      
    } catch (error) {
      this.emitEvent('error', {
        state: 'error',
        error: { message: `WebSocket creation failed: ${error}` }
      });
    }
  }

  private handleOpen(): void {
    this.updateConnectionState('connected');
    this.startPingMonitoring();
  }

  private handleClose(event: CloseEvent): void {
    if (event.wasClean) {
      this.updateConnectionState('disconnected');
    } else {
      this.updateConnectionState('error');
    }
  }

  private handleError(error: Event): void {
    this.updateConnectionState('error');
    this.emitEvent('error', {
      state: 'error',
      error: { message: 'WebSocket error' }
    });
  }

  private handleMessage(message: MessageEvent): void {
    try {
      const data = JSON.parse(message.data);
      if (data.type === 'pong' && data.timestamp) {
        const latency = Date.now() - data.timestamp;
        this.recordLatency(latency);
      }
    } catch (error) {
      // Non-JSON message, ignore for now
    }
  }

  private startPingMonitoring(): void {
    const pingInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, this.wsConfig.pingInterval);
  }

  private sendPing(): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now()
      };
      this.websocket.send(JSON.stringify(pingMessage));
    }
  }

  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.networkConfig.latencySampleSize) {
      this.latencyHistory.shift();
    }
    
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const latency = this.calculateAverageLatency();
    const quality = this.calculateNetworkQuality(latency, 0);
    
    const metrics: ConnectionQualityMetrics = {
      latency,
      jitter: this.calculateJitter(),
      downloadBandwidth: 0,
      uploadBandwidth: 0,
      packetLoss: 0,
      quality,
      qualityConfidence: Math.min(this.latencyHistory.length / 10, 1),
      timestamp: Date.now()
    };
    
    this.emitEvent('metrics_update', {
      state: this.connectionState,
      metrics
    });
  }

  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    return this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
  }

  private calculateJitter(): number {
    if (this.latencyHistory.length < 2) return 0;
    const avg = this.calculateAverageLatency();
    const variance = this.latencyHistory.reduce((sum, lat) => sum + Math.pow(lat - avg, 2), 0) / this.latencyHistory.length;
    return Math.sqrt(variance);
  }

  private calculateNetworkQuality(latency: number, bandwidth: number): NetworkQuality {
    if (latency === 0) return 'unknown';
    if (latency < 50) return 'excellent';
    if (latency < 150) return 'good';
    if (latency < 300) return 'fair';
    if (latency < 1000) return 'poor';
    return 'critical';
  }

  private updateConnectionState(newState: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = newState;
    
    this.emitEvent('state_change', {
      state: newState,
      previousState
    });
  }

  private emitEvent(type: ConnectionEventType, data: Partial<ConnectionEvent>): void {
    const event: ConnectionEvent = {
      type,
      timestamp: Date.now(),
      state: this.connectionState,
      ...data
    };
    
    const callbacks = this.eventCallbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in connection event callback:`, error);
      }
    });
  }

  /**
   * Public API methods
   */
  public on(eventType: ConnectionEventType, callback: ConnectionEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    callbacks.push(callback);
    this.eventCallbacks.set(eventType, callbacks);
  }

  public off(eventType: ConnectionEventType, callback: ConnectionEventCallback): void {
    const callbacks = this.eventCallbacks.get(eventType) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  public getState(): MonitoringState {
    return {
      isActive: this.isActive,
      connectionState: this.connectionState,
      currentMetrics: {
        latency: this.calculateAverageLatency(),
        jitter: this.calculateJitter(),
        downloadBandwidth: 0,
        uploadBandwidth: 0,
        packetLoss: 0,
        quality: this.calculateNetworkQuality(this.calculateAverageLatency(), 0),
        qualityConfidence: Math.min(this.latencyHistory.length / 10, 1),
        timestamp: Date.now()
      },
      health: this.getHealth(),
      history: [],
      config: {
        websocket: this.wsConfig,
        network: this.networkConfig
      }
    };
  }

  public getHealth(): ConnectionHealth {
    const uptime = Date.now() - this.startTime;
    const isHealthy = this.connectionState === 'connected' && this.calculateAverageLatency() < 500;
    
    return {
      healthScore: isHealthy ? 85 : 45,
      isHealthy,
      uptime,
      downtime: 0,
      availability: this.connectionState === 'connected' ? 100 : 0,
      failureCount: 0,
      recoveryCount: 0,
      lastConnected: this.connectionState === 'connected' ? Date.now() : 0,
      lastDisconnected: 0,
      stability: 'stable'
    };
  }

  public getMetrics(): ConnectionQualityMetrics {
    return this.getState().currentMetrics;
  }

  public getHistory(): any[] {
    return [];
  }

  public async reconnect(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
    }
    await this.initializeWebSocket();
  }

  /**
   * Advanced latency monitoring with spike detection
   */
  public getLatencyStatistics(): {
    current: number;
    average: number;
    min: number;
    max: number;
    jitter: number;
    spikeCount: number;
  } {
    if (this.latencyHistory.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, jitter: 0, spikeCount: 0 };
    }

    const current = this.latencyHistory[this.latencyHistory.length - 1] || 0;
    const average = this.calculateAverageLatency();
    const min = Math.min(...this.latencyHistory);
    const max = Math.max(...this.latencyHistory);
    const jitter = this.calculateJitter();
    
    // Count latency spikes (latency > 2x average or > threshold)
    const threshold = this.networkConfig.degradationThreshold;
    const spikeCount = this.latencyHistory.filter(lat => 
      lat > average * 2 || lat > threshold
    ).length;

    return { current, average, min, max, jitter, spikeCount };
  }

  /**
   * Bandwidth testing implementation
   */
  public async performBandwidthTest(): Promise<{
    downloadSpeed: number;
    uploadSpeed: number;
    quality: NetworkQuality;
  }> {
    try {
      // Simulate bandwidth test for now
      const testUrl = this.networkConfig.testEndpoints[0] || 'https://httpbin.org/bytes/1024';
      const startTime = Date.now();
      
      const response = await fetch(testUrl);
      const blob = await response.blob();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const downloadSpeed = (blob.size * 8) / (duration * 1024 * 1024); // Mbps
      
      const quality = this.calculateBandwidthQuality(downloadSpeed);
      
      return {
        downloadSpeed,
        uploadSpeed: downloadSpeed * 0.1, // Estimate upload as 10% of download
        quality
      };
    } catch (error) {
      return {
        downloadSpeed: 0,
        uploadSpeed: 0,
        quality: 'unknown'
      };
    }
  }

  /**
   * Calculate bandwidth quality classification
   */
  private calculateBandwidthQuality(bandwidth: number): NetworkQuality {
    if (bandwidth >= 10) return 'excellent';
    if (bandwidth >= 5) return 'good';
    if (bandwidth >= 1) return 'fair';
    if (bandwidth >= 0.5) return 'poor';
    return 'critical';
  }

  /**
   * Get connection analytics and trends
   */
  public getConnectionAnalytics(): {
    connectionTime: number;
    disconnectionCount: number;
    averageLatency: number;
    qualityTrend: 'improving' | 'stable' | 'degrading';
    reliability: number;
  } {
    const connectionTime = Date.now() - this.startTime;
    const disconnectionCount = 0; // Simplified for Phase 1
    const averageLatency = this.calculateAverageLatency();
    
    // Simple quality trend analysis
    const recentLatencies = this.latencyHistory.slice(-5);
    const olderLatencies = this.latencyHistory.slice(-10, -5);
    
    let qualityTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentLatencies.length > 0 && olderLatencies.length > 0) {
      const recentAvg = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
      const olderAvg = olderLatencies.reduce((a, b) => a + b, 0) / olderLatencies.length;
      
      if (recentAvg < olderAvg * 0.9) qualityTrend = 'improving';
      else if (recentAvg > olderAvg * 1.1) qualityTrend = 'degrading';
    }

    const reliability = this.connectionState === 'connected' ? 95 : 50;

    return {
      connectionTime,
      disconnectionCount,
      averageLatency,
      qualityTrend,
      reliability
    };
  }

  /**
   * Advanced health monitoring with detailed metrics
   */
  public getDetailedHealth(): ConnectionHealth & {
    latencyGrade: string;
    stabilityGrade: string;
    performanceGrade: string;
  } {
    const baseHealth = this.getHealth();
    const latencyStats = this.getLatencyStatistics();
    
    // Grade latency performance
    let latencyGrade = 'F';
    if (latencyStats.average < 50) latencyGrade = 'A';
    else if (latencyStats.average < 100) latencyGrade = 'B';
    else if (latencyStats.average < 200) latencyGrade = 'C';
    else if (latencyStats.average < 500) latencyGrade = 'D';

    // Grade stability
    let stabilityGrade = 'F';
    if (latencyStats.jitter < 10) stabilityGrade = 'A';
    else if (latencyStats.jitter < 25) stabilityGrade = 'B';
    else if (latencyStats.jitter < 50) stabilityGrade = 'C';
    else if (latencyStats.jitter < 100) stabilityGrade = 'D';

    // Grade overall performance
    const performanceScore = (latencyGrade === 'A' ? 4 : latencyGrade === 'B' ? 3 : latencyGrade === 'C' ? 2 : latencyGrade === 'D' ? 1 : 0) +
                             (stabilityGrade === 'A' ? 4 : stabilityGrade === 'B' ? 3 : stabilityGrade === 'C' ? 2 : stabilityGrade === 'D' ? 1 : 0);
    
    let performanceGrade = 'F';
    if (performanceScore >= 7) performanceGrade = 'A';
    else if (performanceScore >= 5) performanceGrade = 'B';
    else if (performanceScore >= 3) performanceGrade = 'C';
    else if (performanceScore >= 1) performanceGrade = 'D';

    return {
      ...baseHealth,
      latencyGrade,
      stabilityGrade,
      performanceGrade
    };
  }

  /**
   * Update configuration dynamically
   */
  public updateConfiguration(
    wsConfig?: Partial<WebSocketMonitorConfig>,
    networkConfig?: Partial<NetworkMonitorConfig>
  ): void {
    if (wsConfig) {
      this.wsConfig = { ...this.wsConfig, ...wsConfig };
    }
    if (networkConfig) {
      this.networkConfig = { ...this.networkConfig, ...networkConfig };
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): {
    websocket: WebSocketMonitorConfig;
    network: NetworkMonitorConfig;
  } {
    return {
      websocket: { ...this.wsConfig },
      network: { ...this.networkConfig }
    };
  }
}

/**
 * Factory functions
 */
export function createConnectionMonitor(
  wsConfig?: Partial<WebSocketMonitorConfig>,
  networkConfig?: Partial<NetworkMonitorConfig>
): ConnectionMonitor {
  return new ConnectionMonitor(
    { ...DEFAULT_WEBSOCKET_CONFIG, ...wsConfig },
    { ...DEFAULT_NETWORK_CONFIG, ...networkConfig }
  );
}

let globalMonitor: ConnectionMonitor | null = null;

export function getGlobalConnectionMonitor(): ConnectionMonitor {
  if (!globalMonitor) {
    globalMonitor = createConnectionMonitor();
  }
  return globalMonitor;
}

export function resetGlobalConnectionMonitor(): void {
  if (globalMonitor) {
    globalMonitor.stopMonitoring();
    globalMonitor = null;
  }
}

export default ConnectionMonitor;