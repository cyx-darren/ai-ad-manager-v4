/**
 * Offline Detection Manager
 * Comprehensive offline detection and state management system for MCP client.
 */

export interface NetworkInfo {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface ConnectionQuality {
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  factors: {
    latency: number;
    bandwidth: number;
    stability: number;
  };
}

export interface MCPServerStatus {
  isReachable: boolean;
  lastResponseTime?: number;
  averageResponseTime?: number;
  availableFeatures: string[];
  healthScore: number;
  lastError?: string;
}

export interface OfflineStatus {
  isOffline: boolean;
  networkOffline: boolean;
  mcpServerOffline: boolean;
  isPartiallyOffline: boolean;
  isRecovering: boolean;
  lastStatusChange: number;
  confidence: number;
}

export interface OfflineDetectionConfig {
  checkInterval: number;
  serverCheckTimeout: number;
  offlineThreshold: number;
  recoveryThreshold: number;
  statusChangeDebounce: number;
  enableBrowserAPIMonitoring: boolean;
  enableMCPServerMonitoring: boolean;
  mcpHealthEndpoint?: string;
  enableQualityAssessment: boolean;
  maxHistorySize: number;
}

export const DEFAULT_OFFLINE_CONFIG: OfflineDetectionConfig = {
  checkInterval: 30000,
  serverCheckTimeout: 5000,
  offlineThreshold: 3,
  recoveryThreshold: 2,
  statusChangeDebounce: 1000,
  enableBrowserAPIMonitoring: true,
  enableMCPServerMonitoring: true,
  mcpHealthEndpoint: '/health',
  enableQualityAssessment: true,
  maxHistorySize: 50
};

export interface StatusChangeEvent {
  previousStatus: OfflineStatus;
  newStatus: OfflineStatus;
  reason: string;
  timestamp: number;
}

export interface CheckHistory {
  timestamp: number;
  networkSuccess: boolean;
  mcpServerSuccess: boolean;
  responseTime?: number;
  error?: string;
}

export class OfflineDetectionManager {
  private config: OfflineDetectionConfig;
  private currentStatus: OfflineStatus;
  private checkHistory: CheckHistory[] = [];
  private networkInfo: NetworkInfo = { isOnline: navigator.onLine };
  private mcpServerStatus: MCPServerStatus = {
    isReachable: false,
    availableFeatures: [],
    healthScore: 0
  };
  
  private checkInterval?: NodeJS.Timeout;
  private statusChangeCallbacks: ((event: StatusChangeEvent) => void)[] = [];
  private isChecking = false;
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  constructor(config: Partial<OfflineDetectionConfig> = {}) {
    this.config = {
      checkInterval: 30000,
      serverCheckTimeout: 5000,
      offlineThreshold: 3,
      recoveryThreshold: 2,
      statusChangeDebounce: 2000,
      enableBrowserAPIMonitoring: true,
      enableMCPServerMonitoring: true,
      enableQualityAssessment: true,
      maxHistorySize: 50,
      ...config
    };

    this.currentStatus = {
      isOffline: false,
      networkOffline: false,
      mcpServerOffline: true,
      isPartiallyOffline: false,
      isRecovering: false,
      lastStatusChange: Date.now(),
      confidence: 50
    };

    this.initializeBrowserAPIMonitoring();
  }

  public startMonitoring(): void {
    console.log('[OfflineDetection] Starting monitoring...');
    
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    this.performCheck();
    this.checkInterval = setInterval(() => {
      if (!this.isChecking) {
        this.performCheck();
      }
    }, this.config.checkInterval);
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.removeBrowserAPIListeners();
  }

  public getStatus(): OfflineStatus {
    return { ...this.currentStatus };
  }

  public getNetworkInfo(): NetworkInfo {
    return { ...this.networkInfo };
  }

  public getMCPServerStatus(): MCPServerStatus {
    return { ...this.mcpServerStatus };
  }

  public getConnectionQuality(): ConnectionQuality {
    const factors = {
      latency: this.calculateLatencyScore(),
      bandwidth: this.calculateBandwidthScore(),
      stability: this.calculateStabilityScore()
    };

    const score = (factors.latency + factors.bandwidth + factors.stability) / 3;
    
    let level: ConnectionQuality['level'];
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'fair';
    else level = 'poor';

    return { score, level, factors };
  }

  public async forceCheck(): Promise<OfflineStatus> {
    await this.performCheck();
    return this.getStatus();
  }

  public onStatusChange(callback: (event: StatusChangeEvent) => void): () => void {
    this.statusChangeCallbacks.push(callback);
    return () => {
      const index = this.statusChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusChangeCallbacks.splice(index, 1);
      }
    };
  }

  public detectOffline(): boolean {
    return this.currentStatus.isOffline;
  }

  public getCheckHistory(): CheckHistory[] {
    return [...this.checkHistory];
  }

  public updateConfig(newConfig: Partial<OfflineDetectionConfig>): void {
    const wasMonitoring = !!this.checkInterval;
    if (wasMonitoring) this.stopMonitoring();
    this.config = { ...this.config, ...newConfig };
    if (wasMonitoring) this.startMonitoring();
  }

  public destroy(): void {
    this.stopMonitoring();
    this.statusChangeCallbacks.length = 0;
    this.checkHistory.length = 0;
  }

  private initializeBrowserAPIMonitoring(): void {
    if (!this.config.enableBrowserAPIMonitoring) return;

    this.onlineListener = () => {
      this.updateNetworkInfo();
      this.performCheck();
    };

    this.offlineListener = () => {
      this.updateNetworkInfo();
      this.performCheck();
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
    this.updateNetworkInfo();
  }

  private removeBrowserAPIListeners(): void {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
    }
  }

  private updateNetworkInfo(): void {
    this.networkInfo = {
      isOnline: navigator.onLine,
      ...this.getConnectionInformation()
    };
  }

  private getConnectionInformation(): Partial<NetworkInfo> {
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return {};

    return {
      connectionType: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  private async performCheck(): Promise<void> {
    if (this.isChecking) return;
    
    this.isChecking = true;

    try {
      this.updateNetworkInfo();
      
      const networkResult = await this.checkNetworkConnectivity();
      const mcpServerResult = await this.checkMCPServerAvailability();

      this.recordCheckResult(networkResult, mcpServerResult);
      const newStatus = this.calculateOfflineStatus();

      if (this.hasStatusChanged(newStatus)) {
        this.updateStatus(newStatus);
      }
    } catch (error) {
      console.error('[OfflineDetection] Check failed:', error);
    } finally {
      this.isChecking = false;
    }
  }

  private async checkNetworkConnectivity(): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    if (!this.networkInfo.isOnline) {
      return { success: false, error: 'Browser reports offline' };
    }

    try {
      const startTime = Date.now();
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.config.serverCheckTimeout)
      });

      const responseTime = Date.now() - startTime;
      return response.ok ? { success: true, responseTime } : { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network check failed' };
    }
  }

  private async checkMCPServerAvailability(): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    if (!this.config.enableMCPServerMonitoring) {
      return { success: true };
    }

    try {
      const startTime = Date.now();
      const endpoint = this.config.mcpHealthEndpoint || '/api/health';
      
      const response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.config.serverCheckTimeout)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        this.updateMCPServerStatus(true, responseTime);
        return { success: true, responseTime };
      } else {
        this.updateMCPServerStatus(false, undefined, `HTTP ${response.status}`);
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'MCP server check failed';
      this.updateMCPServerStatus(false, undefined, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private updateMCPServerStatus(isReachable: boolean, responseTime?: number, error?: string): void {
    this.mcpServerStatus = {
      ...this.mcpServerStatus,
      isReachable,
      lastError: error,
      lastResponseTime: responseTime
    };

    if (responseTime !== undefined) {
      if (this.mcpServerStatus.averageResponseTime) {
        this.mcpServerStatus.averageResponseTime = 
          (this.mcpServerStatus.averageResponseTime * 0.7) + (responseTime * 0.3);
      } else {
        this.mcpServerStatus.averageResponseTime = responseTime;
      }
    }

    this.mcpServerStatus.healthScore = this.calculateMCPHealthScore();
  }

  private calculateMCPHealthScore(): number {
    const recentChecks = this.checkHistory.slice(-10);
    if (recentChecks.length === 0) return 0;

    const successfulChecks = recentChecks.filter(check => check.mcpServerSuccess).length;
    const successRate = (successfulChecks / recentChecks.length) * 100;

    const avgResponseTime = this.mcpServerStatus.averageResponseTime || 5000;
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 50));

    return Math.round((successRate * 0.7) + (responseTimeScore * 0.3));
  }

  private recordCheckResult(
    networkResult: { success: boolean; responseTime?: number; error?: string },
    mcpServerResult: { success: boolean; responseTime?: number; error?: string }
  ): void {
    const checkRecord: CheckHistory = {
      timestamp: Date.now(),
      networkSuccess: networkResult.success,
      mcpServerSuccess: mcpServerResult.success,
      responseTime: networkResult.responseTime || mcpServerResult.responseTime,
      error: networkResult.error || mcpServerResult.error
    };

    this.checkHistory.push(checkRecord);

    if (this.checkHistory.length > this.config.maxHistorySize) {
      this.checkHistory.shift();
    }
  }

  private calculateOfflineStatus(): OfflineStatus {
    const recentChecks = this.checkHistory.slice(-Math.max(this.config.offlineThreshold, this.config.recoveryThreshold));
    
    if (recentChecks.length === 0) {
      return { ...this.currentStatus, confidence: 0 };
    }

    const recentNetworkFailures = recentChecks.slice(-this.config.offlineThreshold)
      .filter(check => !check.networkSuccess).length;
    const recentNetworkSuccesses = recentChecks.slice(-this.config.recoveryThreshold)
      .filter(check => check.networkSuccess).length;

    const networkOffline = recentNetworkFailures >= this.config.offlineThreshold && 
                          recentNetworkSuccesses < this.config.recoveryThreshold;

    const recentMCPFailures = recentChecks.slice(-this.config.offlineThreshold)
      .filter(check => !check.mcpServerSuccess).length;
    const recentMCPSuccesses = recentChecks.slice(-this.config.recoveryThreshold)
      .filter(check => check.mcpServerSuccess).length;

    const mcpServerOffline = recentMCPFailures >= this.config.offlineThreshold && 
                            recentMCPSuccesses < this.config.recoveryThreshold;

    const isOffline = networkOffline || mcpServerOffline;
    const isPartiallyOffline = networkOffline !== mcpServerOffline;
    
    const wasOffline = this.currentStatus.isOffline;
    const isRecovering = wasOffline && !isOffline && recentChecks.some(check => 
      check.networkSuccess || check.mcpServerSuccess
    );

    const confidence = this.calculateStatusConfidence(recentChecks);

    return {
      isOffline,
      networkOffline,
      mcpServerOffline,
      isPartiallyOffline,
      isRecovering,
      lastStatusChange: this.currentStatus.lastStatusChange,
      confidence
    };
  }

  private calculateStatusConfidence(recentChecks: CheckHistory[]): number {
    if (recentChecks.length === 0) return 0;

    const networkResults = recentChecks.map(check => check.networkSuccess);
    const mcpResults = recentChecks.map(check => check.mcpServerSuccess);

    const networkConsistency = this.calculateConsistency(networkResults);
    const mcpConsistency = this.calculateConsistency(mcpResults);

    const sampleSizeBonus = Math.min(recentChecks.length / 10, 1) * 20;
    const consistencyScore = (networkConsistency + mcpConsistency) / 2;

    return Math.round(Math.min(consistencyScore + sampleSizeBonus, 100));
  }

  private calculateConsistency(results: boolean[]): number {
    if (results.length <= 1) return 50;

    let changes = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i] !== results[i - 1]) {
        changes++;
      }
    }

    return Math.max(0, 100 - (changes / results.length * 100));
  }

  private hasStatusChanged(newStatus: OfflineStatus): boolean {
    const current = this.currentStatus;
    
    return (
      current.isOffline !== newStatus.isOffline ||
      current.networkOffline !== newStatus.networkOffline ||
      current.mcpServerOffline !== newStatus.mcpServerOffline ||
      current.isPartiallyOffline !== newStatus.isPartiallyOffline ||
      current.isRecovering !== newStatus.isRecovering
    );
  }

  private updateStatus(newStatus: OfflineStatus): void {
    const previousStatus = { ...this.currentStatus };
    
    const timeSinceLastChange = Date.now() - this.currentStatus.lastStatusChange;
    if (timeSinceLastChange < this.config.statusChangeDebounce) {
      return;
    }

    this.currentStatus = {
      ...newStatus,
      lastStatusChange: Date.now()
    };

    const event: StatusChangeEvent = {
      previousStatus,
      newStatus: { ...this.currentStatus },
      reason: this.determineChangeReason(previousStatus, newStatus),
      timestamp: this.currentStatus.lastStatusChange
    };

    this.statusChangeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[OfflineDetection] Callback error:', error);
      }
    });
  }

  private determineChangeReason(previous: OfflineStatus, current: OfflineStatus): string {
    if (previous.isOffline && !current.isOffline) {
      return 'recovered_connectivity';
    } else if (!previous.isOffline && current.isOffline) {
      return 'lost_connectivity';
    } else if (previous.networkOffline !== current.networkOffline) {
      return current.networkOffline ? 'network_disconnected' : 'network_reconnected';
    } else if (previous.mcpServerOffline !== current.mcpServerOffline) {
      return current.mcpServerOffline ? 'mcp_server_disconnected' : 'mcp_server_reconnected';
    }
    return 'status_update';
  }

  private calculateLatencyScore(): number {
    const avgRTT = this.networkInfo.rtt || this.mcpServerStatus.averageResponseTime || 1000;
    
    if (avgRTT <= 50) return 100;
    if (avgRTT <= 100) return 80;
    if (avgRTT <= 200) return 60;
    if (avgRTT <= 500) return 40;
    return 20;
  }

  private calculateBandwidthScore(): number {
    const downlink = this.networkInfo.downlink;
    if (!downlink) return 50;

    if (downlink >= 10) return 100;
    if (downlink >= 5) return 80;
    if (downlink >= 1) return 60;
    if (downlink >= 0.5) return 40;
    return 20;
  }

  private calculateStabilityScore(): number {
    const recentChecks = this.checkHistory.slice(-20);
    if (recentChecks.length < 3) return 50;

    const successfulChecks = recentChecks.filter(check => 
      check.networkSuccess && check.mcpServerSuccess
    ).length;

    return (successfulChecks / recentChecks.length) * 100;
  }
}

export function createOfflineDetectionManager(config?: Partial<OfflineDetectionConfig>): OfflineDetectionManager {
  return new OfflineDetectionManager(config);
}

export function isOfflineDetectionSupported(): boolean {
  return typeof navigator !== 'undefined' && 
         typeof window !== 'undefined' &&
         typeof fetch !== 'undefined';
}

export function getBasicNetworkStatus(): { isOnline: boolean; connectionType?: string } {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  // @ts-ignore
  const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
  const connectionType = connection?.effectiveType || connection?.type;
  return { isOnline, connectionType };
}

export default OfflineDetectionManager;