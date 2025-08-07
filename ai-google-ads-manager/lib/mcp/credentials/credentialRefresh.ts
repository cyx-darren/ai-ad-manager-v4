/**
 * GA4 Credential Refresh Mechanism
 * 
 * This file implements GA4 credential refresh mechanisms,
 * token renewal, and credential update handling.
 */

import {
  GA4ServiceAccountCredential,
  CredentialId,
  CredentialAlias,
  CredentialOperationResult,
  CredentialError
} from './types';

import {
  ICredentialService,
  CredentialServiceFactory
} from './services';

import {
  IMCPAuthService,
  MCPAuthServiceFactory
} from './mcpAuth';

// ============================================================================
// CREDENTIAL REFRESH TYPES
// ============================================================================

/**
 * Credential refresh strategy
 */
export type CredentialRefreshStrategy = 
  | 'proactive'    // Refresh before expiry
  | 'reactive'     // Refresh when needed
  | 'scheduled'    // Refresh on schedule
  | 'on-demand';   // Manual refresh only

/**
 * Credential refresh configuration
 */
export interface CredentialRefreshConfig {
  strategy: CredentialRefreshStrategy;
  
  // Proactive refresh settings
  refreshThreshold: number; // percentage of token lifetime (0-1)
  refreshBuffer: number;    // buffer time in milliseconds
  
  // Scheduled refresh settings
  refreshInterval: number;  // milliseconds
  maxRefreshAttempts: number;
  
  // Retry settings
  retryOnFailure: boolean;
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  initialRetryDelay: number;
  
  // Validation settings
  validateAfterRefresh: boolean;
  testCredentialsAfterRefresh: boolean;
  
  // Notification settings
  notifyOnRefresh: boolean;
  notifyOnFailure: boolean;
  
  // Cache settings
  enableTokenCaching: boolean;
  tokenCacheMaxAge: number;
}

/**
 * Credential refresh status
 */
export interface CredentialRefreshStatus {
  credentialId: CredentialId;
  lastRefresh: string | null;
  nextRefresh: string | null;
  refreshAttempts: number;
  lastRefreshResult: 'success' | 'failure' | 'pending' | 'unknown';
  currentTokenExpiresAt: string | null;
  refreshThresholdReached: boolean;
  isRefreshPending: boolean;
  refreshConfig: CredentialRefreshConfig;
  error?: CredentialError;
}

/**
 * Token information
 */
export interface GA4TokenInfo {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  expiresIn: number;
  scope: string[];
  refreshToken?: string;
  clientId: string;
  projectId: string;
}

/**
 * Credential refresh result
 */
export interface CredentialRefreshResult extends CredentialOperationResult<GA4TokenInfo> {
  refreshedAt: string;
  previousTokenExpiry?: string;
  nextRefreshTime?: string;
  refreshAttempt: number;
}

/**
 * Refresh operation record
 */
export interface CredentialRefreshRecord {
  refreshId: string;
  credentialId: CredentialId;
  startTime: string;
  endTime: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  strategy: CredentialRefreshStrategy;
  trigger: 'scheduled' | 'threshold' | 'manual' | 'on-demand' | 'failure';
  attempt: number;
  previousTokenExpiry?: string;
  newTokenExpiry?: string;
  error?: CredentialError;
  metadata?: Record<string, any>;
}

// ============================================================================
// CREDENTIAL REFRESH SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential refresh operations
 */
export interface ICredentialRefreshService {
  // Configuration management
  setRefreshConfig(credentialId: CredentialId, config: CredentialRefreshConfig): Promise<CredentialOperationResult<boolean>>;
  getRefreshConfig(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshConfig>>;
  updateRefreshConfig(credentialId: CredentialId, updates: Partial<CredentialRefreshConfig>): Promise<CredentialOperationResult<boolean>>;
  
  // Refresh operations
  refreshCredential(credentialId: CredentialId, trigger?: string): Promise<CredentialRefreshResult>;
  refreshCredentialByAlias(alias: CredentialAlias, trigger?: string): Promise<CredentialRefreshResult>;
  refreshAllCredentials(): Promise<CredentialOperationResult<CredentialRefreshResult[]>>;
  
  // Token management
  getTokenInfo(credentialId: CredentialId): Promise<CredentialOperationResult<GA4TokenInfo>>;
  getCachedToken(credentialId: CredentialId): Promise<CredentialOperationResult<GA4TokenInfo | null>>;
  clearTokenCache(credentialId?: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Status and monitoring
  getRefreshStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshStatus>>;
  listCredentialsNeedingRefresh(): Promise<CredentialOperationResult<CredentialId[]>>;
  getRefreshHistory(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshRecord[]>>;
  
  // Automated refresh
  startAutomaticRefresh(): Promise<CredentialOperationResult<boolean>>;
  stopAutomaticRefresh(): Promise<CredentialOperationResult<boolean>>;
  processScheduledRefreshes(): Promise<CredentialOperationResult<number>>;
  
  // Validation and testing
  validateToken(token: GA4TokenInfo): Promise<CredentialOperationResult<boolean>>;
  testCredentialRefresh(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Event handling
  onRefreshEvent(callback: (event: string, data: any) => void): void;
  emitRefreshEvent(event: string, data: any): void;
}

// ============================================================================
// CREDENTIAL REFRESH SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Credential refresh service implementation
 */
export class CredentialRefreshService implements ICredentialRefreshService {
  private credentialService: ICredentialService;
  private authService: IMCPAuthService;
  private refreshConfigs: Map<CredentialId, CredentialRefreshConfig> = new Map();
  private refreshTimers: Map<CredentialId, NodeJS.Timeout> = new Map();
  private refreshRecords: Map<string, CredentialRefreshRecord> = new Map();
  private tokenCache: Map<CredentialId, { token: GA4TokenInfo; cachedAt: number }> = new Map();
  private isAutomaticRefreshEnabled: boolean = false;
  private automaticRefreshTimer: NodeJS.Timeout | null = null;
  
  // Event handlers
  private refreshEventHandlers: Array<(event: string, data: any) => void> = [];
  
  constructor(
    credentialService?: ICredentialService,
    authService?: IMCPAuthService
  ) {
    this.credentialService = credentialService || CredentialServiceFactory.createSecure();
    this.authService = authService || MCPAuthServiceFactory.createSecure();
  }
  
  /**
   * Set refresh configuration for a credential
   */
  async setRefreshConfig(credentialId: CredentialId, config: CredentialRefreshConfig): Promise<CredentialOperationResult<boolean>> {
    try {
      // Validate configuration
      this.validateRefreshConfig(config);
      
      // Store configuration
      this.refreshConfigs.set(credentialId, config);
      
      // Schedule refresh if using scheduled strategy
      if (config.strategy === 'scheduled') {
        await this.scheduleRefresh(credentialId, config);
      }
      
      // Emit event
      this.emitRefreshEvent('config_updated', {
        credentialId,
        config,
        nextRefresh: this.calculateNextRefreshTime(config)
      });
      
      return {
        success: true,
        data: true,
        metadata: {
          configSet: new Date().toISOString(),
          nextRefresh: this.calculateNextRefreshTime(config)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to set refresh config', 'SET_CONFIG_ERROR', credentialId, 'setRefreshConfig', error)
      };
    }
  }
  
  /**
   * Get refresh configuration for a credential
   */
  async getRefreshConfig(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshConfig>> {
    try {
      const config = this.refreshConfigs.get(credentialId);
      if (!config) {
        // Return default config
        return {
          success: true,
          data: this.getDefaultRefreshConfig()
        };
      }
      
      return {
        success: true,
        data: config
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get refresh config', 'GET_CONFIG_ERROR', credentialId, 'getRefreshConfig', error)
      };
    }
  }
  
  /**
   * Update refresh configuration for a credential
   */
  async updateRefreshConfig(credentialId: CredentialId, updates: Partial<CredentialRefreshConfig>): Promise<CredentialOperationResult<boolean>> {
    try {
      const existingConfig = this.refreshConfigs.get(credentialId) || this.getDefaultRefreshConfig();
      const updatedConfig = { ...existingConfig, ...updates };
      
      this.validateRefreshConfig(updatedConfig);
      this.refreshConfigs.set(credentialId, updatedConfig);
      
      // Reschedule if necessary
      if (updatedConfig.strategy === 'scheduled') {
        await this.scheduleRefresh(credentialId, updatedConfig);
      } else {
        this.cancelScheduledRefresh(credentialId);
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update refresh config', 'UPDATE_CONFIG_ERROR', credentialId, 'updateRefreshConfig', error)
      };
    }
  }
  
  /**
   * Refresh a credential
   */
  async refreshCredential(credentialId: CredentialId, trigger?: string): Promise<CredentialRefreshResult> {
    const refreshId = this.generateRefreshId();
    const startTime = new Date().toISOString();
    const config = this.refreshConfigs.get(credentialId) || this.getDefaultRefreshConfig();
    
    // Create refresh record
    const refreshRecord: CredentialRefreshRecord = {
      refreshId,
      credentialId,
      startTime,
      endTime: null,
      status: 'in-progress',
      strategy: config.strategy,
      trigger: (trigger as any) || 'manual',
      attempt: 1
    };
    
    this.refreshRecords.set(refreshId, refreshRecord);
    this.emitRefreshEvent('refresh_started', { refreshId, credentialId });
    
    try {
      // Get current credential
      const credentialResult = await this.credentialService.getCredential(credentialId);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', credentialId);
      }
      
      const credential = credentialResult.data;
      
      // Get current token info if available
      const currentTokenResult = await this.getTokenInfo(credentialId);
      if (currentTokenResult.success && currentTokenResult.data) {
        refreshRecord.previousTokenExpiry = currentTokenResult.data.expiresAt;
      }
      
      // Perform credential refresh with GA4 API
      const tokenInfo = await this.performGA4TokenRefresh(credential);
      
      // Update refresh record
      refreshRecord.status = 'completed';
      refreshRecord.endTime = new Date().toISOString();
      refreshRecord.newTokenExpiry = tokenInfo.expiresAt;
      this.refreshRecords.set(refreshId, refreshRecord);
      
      // Cache token if enabled
      if (config.enableTokenCaching) {
        this.cacheToken(credentialId, tokenInfo);
      }
      
      // Validate token if required
      if (config.validateAfterRefresh) {
        const validationResult = await this.validateToken(tokenInfo);
        if (!validationResult.success) {
          throw validationResult.error || new CredentialError('Token validation failed after refresh', 'VALIDATION_FAILED', credentialId);
        }
      }
      
      // Test credentials if required
      if (config.testCredentialsAfterRefresh) {
        const testResult = await this.testCredentialRefresh(credentialId);
        if (!testResult.success) {
          throw testResult.error || new CredentialError('Credential testing failed after refresh', 'TESTING_FAILED', credentialId);
        }
      }
      
      // Schedule next refresh if using proactive or scheduled strategy
      if (config.strategy === 'proactive' || config.strategy === 'scheduled') {
        await this.scheduleRefresh(credentialId, config);
      }
      
      // Emit completion event
      this.emitRefreshEvent('refresh_completed', { refreshId, credentialId, tokenInfo });
      
      return {
        success: true,
        data: tokenInfo,
        refreshedAt: startTime,
        previousTokenExpiry: refreshRecord.previousTokenExpiry,
        nextRefreshTime: this.calculateNextRefreshTime(config),
        refreshAttempt: 1
      };
    } catch (error) {
      // Update refresh record with failure
      refreshRecord.status = 'failed';
      refreshRecord.endTime = new Date().toISOString();
      refreshRecord.error = error instanceof CredentialError ? error : new CredentialError('Refresh failed', 'REFRESH_FAILED', credentialId, 'refreshCredential', error);
      this.refreshRecords.set(refreshId, refreshRecord);
      
      // Emit failure event
      this.emitRefreshEvent('refresh_failed', { refreshId, credentialId, error: refreshRecord.error });
      
      // Retry if enabled
      if (config.retryOnFailure && refreshRecord.attempt < config.maxRetryAttempts) {
        const retryDelay = config.initialRetryDelay * Math.pow(config.retryBackoffMultiplier, refreshRecord.attempt - 1);
        
        setTimeout(async () => {
          try {
            refreshRecord.attempt++;
            await this.refreshCredential(credentialId, `retry_${refreshRecord.attempt}`);
          } catch (retryError) {
            // Final failure
          }
        }, retryDelay);
      }
      
      return {
        success: false,
        error: refreshRecord.error,
        refreshedAt: startTime,
        refreshAttempt: refreshRecord.attempt
      };
    }
  }
  
  /**
   * Refresh credential by alias
   */
  async refreshCredentialByAlias(alias: CredentialAlias, trigger?: string): Promise<CredentialRefreshResult> {
    try {
      // Get credential by alias
      const credentialResult = await this.credentialService.getCredentialByAlias(alias);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }
      
      // Find credential ID for this alias
      const credentialId = await this.findCredentialIdByAlias(alias);
      if (!credentialId) {
        throw new CredentialError('Could not resolve credential ID', 'CREDENTIAL_ID_NOT_FOUND');
      }
      
      return await this.refreshCredential(credentialId, trigger);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Refresh by alias failed', 'REFRESH_BY_ALIAS_ERROR', undefined, 'refreshCredentialByAlias', error),
        refreshedAt: new Date().toISOString(),
        refreshAttempt: 1
      };
    }
  }
  
  /**
   * Refresh all credentials
   */
  async refreshAllCredentials(): Promise<CredentialOperationResult<CredentialRefreshResult[]>> {
    try {
      const credentialIds = Array.from(this.refreshConfigs.keys());
      const refreshPromises = credentialIds.map(id => 
        this.refreshCredential(id, 'batch_refresh')
      );
      
      const results = await Promise.all(refreshPromises);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to refresh all credentials', 'REFRESH_ALL_ERROR', undefined, 'refreshAllCredentials', error)
      };
    }
  }
  
  /**
   * Get token information for a credential
   */
  async getTokenInfo(credentialId: CredentialId): Promise<CredentialOperationResult<GA4TokenInfo>> {
    try {
      // Check cache first
      const cachedToken = await this.getCachedToken(credentialId);
      if (cachedToken.success && cachedToken.data) {
        return {
          success: true,
          data: cachedToken.data
        };
      }
      
      // Get credential and generate token info
      const credentialResult = await this.credentialService.getCredential(credentialId);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', credentialId);
      }
      
      const credential = credentialResult.data;
      const tokenInfo = await this.generateTokenInfo(credential);
      
      return {
        success: true,
        data: tokenInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get token info', 'GET_TOKEN_ERROR', credentialId, 'getTokenInfo', error)
      };
    }
  }
  
  /**
   * Get cached token for a credential
   */
  async getCachedToken(credentialId: CredentialId): Promise<CredentialOperationResult<GA4TokenInfo | null>> {
    try {
      const cached = this.tokenCache.get(credentialId);
      if (!cached) {
        return {
          success: true,
          data: null
        };
      }
      
      const config = this.refreshConfigs.get(credentialId) || this.getDefaultRefreshConfig();
      const maxAge = config.tokenCacheMaxAge;
      const age = Date.now() - cached.cachedAt;
      
      if (age > maxAge) {
        this.tokenCache.delete(credentialId);
        return {
          success: true,
          data: null
        };
      }
      
      return {
        success: true,
        data: cached.token
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get cached token', 'GET_CACHED_TOKEN_ERROR', credentialId, 'getCachedToken', error)
      };
    }
  }
  
  /**
   * Clear token cache
   */
  async clearTokenCache(credentialId?: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      if (credentialId) {
        this.tokenCache.delete(credentialId);
      } else {
        this.tokenCache.clear();
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to clear token cache', 'CLEAR_CACHE_ERROR', credentialId, 'clearTokenCache', error)
      };
    }
  }
  
  /**
   * Get refresh status for a credential
   */
  async getRefreshStatus(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshStatus>> {
    try {
      const config = this.refreshConfigs.get(credentialId) || this.getDefaultRefreshConfig();
      const history = this.getCredentialRefreshHistory(credentialId);
      const lastRefresh = history.length > 0 ? history[0] : null;
      
      // Get current token info
      const tokenResult = await this.getTokenInfo(credentialId);
      const currentToken = tokenResult.success ? tokenResult.data : null;
      
      const status: CredentialRefreshStatus = {
        credentialId,
        lastRefresh: lastRefresh?.endTime || null,
        nextRefresh: this.calculateNextRefreshTime(config),
        refreshAttempts: history.filter(r => r.status === 'failed').length,
        lastRefreshResult: lastRefresh?.status === 'completed' ? 'success' : 
                          lastRefresh?.status === 'failed' ? 'failure' : 
                          lastRefresh?.status === 'in-progress' ? 'pending' : 'unknown',
        currentTokenExpiresAt: currentToken?.expiresAt || null,
        refreshThresholdReached: currentToken ? this.isRefreshThresholdReached(currentToken, config) : false,
        isRefreshPending: this.refreshTimers.has(credentialId),
        refreshConfig: config
      };
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get refresh status', 'GET_STATUS_ERROR', credentialId, 'getRefreshStatus', error)
      };
    }
  }
  
  /**
   * List credentials that need refresh
   */
  async listCredentialsNeedingRefresh(): Promise<CredentialOperationResult<CredentialId[]>> {
    try {
      const needingRefresh: CredentialId[] = [];
      
      for (const [credentialId, config] of this.refreshConfigs) {
        const statusResult = await this.getRefreshStatus(credentialId);
        if (statusResult.success && statusResult.data) {
          const status = statusResult.data;
          if (status.refreshThresholdReached || this.isTokenExpired(status.currentTokenExpiresAt)) {
            needingRefresh.push(credentialId);
          }
        }
      }
      
      return {
        success: true,
        data: needingRefresh
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list credentials needing refresh', 'LIST_NEEDING_REFRESH_ERROR', undefined, 'listCredentialsNeedingRefresh', error)
      };
    }
  }
  
  /**
   * Get refresh history for a credential
   */
  async getRefreshHistory(credentialId: CredentialId): Promise<CredentialOperationResult<CredentialRefreshRecord[]>> {
    try {
      const history = this.getCredentialRefreshHistory(credentialId);
      
      return {
        success: true,
        data: history
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get refresh history', 'GET_HISTORY_ERROR', credentialId, 'getRefreshHistory', error)
      };
    }
  }
  
  /**
   * Start automatic refresh
   */
  async startAutomaticRefresh(): Promise<CredentialOperationResult<boolean>> {
    try {
      if (this.isAutomaticRefreshEnabled) {
        return { success: true, data: true };
      }
      
      this.isAutomaticRefreshEnabled = true;
      
      // Start refresh processor
      this.automaticRefreshTimer = setInterval(async () => {
        await this.processScheduledRefreshes();
      }, 30000); // Check every 30 seconds
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to start automatic refresh', 'START_AUTO_REFRESH_ERROR', undefined, 'startAutomaticRefresh', error)
      };
    }
  }
  
  /**
   * Stop automatic refresh
   */
  async stopAutomaticRefresh(): Promise<CredentialOperationResult<boolean>> {
    try {
      this.isAutomaticRefreshEnabled = false;
      
      if (this.automaticRefreshTimer) {
        clearInterval(this.automaticRefreshTimer);
        this.automaticRefreshTimer = null;
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to stop automatic refresh', 'STOP_AUTO_REFRESH_ERROR', undefined, 'stopAutomaticRefresh', error)
      };
    }
  }
  
  /**
   * Process scheduled refreshes
   */
  async processScheduledRefreshes(): Promise<CredentialOperationResult<number>> {
    try {
      const needingRefreshResult = await this.listCredentialsNeedingRefresh();
      if (!needingRefreshResult.success || !needingRefreshResult.data) {
        return { success: true, data: 0 };
      }
      
      const credentialsToRefresh = needingRefreshResult.data;
      let processedCount = 0;
      
      for (const credentialId of credentialsToRefresh) {
        try {
          await this.refreshCredential(credentialId, 'scheduled');
          processedCount++;
        } catch (error) {
          // Continue with other credentials
        }
      }
      
      return {
        success: true,
        data: processedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to process scheduled refreshes', 'PROCESS_REFRESHES_ERROR', undefined, 'processScheduledRefreshes', error)
      };
    }
  }
  
  /**
   * Validate token
   */
  async validateToken(token: GA4TokenInfo): Promise<CredentialOperationResult<boolean>> {
    try {
      // Basic validation
      if (!token.accessToken || !token.expiresAt) {
        throw new CredentialError('Invalid token structure', 'INVALID_TOKEN');
      }
      
      // Check expiry
      if (this.isTokenExpired(token.expiresAt)) {
        throw new CredentialError('Token is expired', 'TOKEN_EXPIRED');
      }
      
      // Additional validation could go here
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Token validation failed', 'TOKEN_VALIDATION_ERROR', undefined, 'validateToken', error)
      };
    }
  }
  
  /**
   * Test credential refresh
   */
  async testCredentialRefresh(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      // This would perform actual GA4 API tests
      // For now, just validate the credential exists
      const credentialResult = await this.credentialService.getCredential(credentialId);
      
      return {
        success: credentialResult.success,
        data: credentialResult.success
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Credential refresh test failed', 'REFRESH_TEST_ERROR', credentialId, 'testCredentialRefresh', error)
      };
    }
  }
  
  /**
   * Register refresh event handler
   */
  onRefreshEvent(callback: (event: string, data: any) => void): void {
    this.refreshEventHandlers.push(callback);
  }
  
  /**
   * Emit refresh event
   */
  emitRefreshEvent(event: string, data: any): void {
    this.refreshEventHandlers.forEach(handler => {
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
  
  private validateRefreshConfig(config: CredentialRefreshConfig): void {
    if (config.refreshThreshold < 0 || config.refreshThreshold > 1) {
      throw new CredentialError('Refresh threshold must be between 0 and 1', 'INVALID_THRESHOLD');
    }
    
    if (config.refreshInterval <= 0) {
      throw new CredentialError('Refresh interval must be positive', 'INVALID_INTERVAL');
    }
    
    if (config.maxRetryAttempts < 0) {
      throw new CredentialError('Max retry attempts must be non-negative', 'INVALID_RETRY_ATTEMPTS');
    }
  }
  
  private async scheduleRefresh(credentialId: CredentialId, config: CredentialRefreshConfig): Promise<void> {
    // Cancel existing timer
    this.cancelScheduledRefresh(credentialId);
    
    // Calculate next refresh time
    const nextRefresh = this.calculateNextRefreshTime(config);
    const delay = new Date(nextRefresh).getTime() - Date.now();
    
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.refreshCredential(credentialId, 'scheduled');
      }, delay);
      
      this.refreshTimers.set(credentialId, timer);
    }
  }
  
  private cancelScheduledRefresh(credentialId: CredentialId): void {
    const timer = this.refreshTimers.get(credentialId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(credentialId);
    }
  }
  
  private calculateNextRefreshTime(config: CredentialRefreshConfig): string {
    const now = new Date();
    let nextRefresh: Date;
    
    switch (config.strategy) {
      case 'scheduled':
        nextRefresh = new Date(now.getTime() + config.refreshInterval);
        break;
      case 'proactive':
        // This would calculate based on token expiry and threshold
        nextRefresh = new Date(now.getTime() + config.refreshBuffer);
        break;
      default:
        nextRefresh = new Date(now.getTime() + config.refreshInterval);
    }
    
    return nextRefresh.toISOString();
  }
  
  private isRefreshThresholdReached(token: GA4TokenInfo, config: CredentialRefreshConfig): boolean {
    const now = Date.now();
    const expiryTime = new Date(token.expiresAt).getTime();
    const tokenLifetime = token.expiresIn * 1000; // Convert to milliseconds
    const thresholdTime = expiryTime - (tokenLifetime * config.refreshThreshold);
    
    return now >= thresholdTime;
  }
  
  private isTokenExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return true;
    return new Date(expiresAt).getTime() <= Date.now();
  }
  
  private async performGA4TokenRefresh(credential: GA4ServiceAccountCredential): Promise<GA4TokenInfo> {
    try {
      // This would implement the actual GA4 OAuth2 token refresh
      // For now, simulate a successful token refresh
      const now = new Date();
      const expiresIn = 3600; // 1 hour
      const expiresAt = new Date(now.getTime() + expiresIn * 1000);
      
      return {
        accessToken: `ya29.${Date.now()}.${Math.random().toString(36)}`,
        tokenType: 'Bearer',
        expiresAt: expiresAt.toISOString(),
        expiresIn,
        scope: ['https://www.googleapis.com/auth/analytics.readonly'],
        clientId: credential.client_id,
        projectId: credential.project_id
      };
    } catch (error) {
      throw new CredentialError('GA4 token refresh failed', 'GA4_REFRESH_ERROR', undefined, 'performGA4TokenRefresh', error);
    }
  }
  
  private async generateTokenInfo(credential: GA4ServiceAccountCredential): Promise<GA4TokenInfo> {
    // This would generate token info from the credential
    // For now, simulate token info
    return await this.performGA4TokenRefresh(credential);
  }
  
  private cacheToken(credentialId: CredentialId, token: GA4TokenInfo): void {
    this.tokenCache.set(credentialId, {
      token,
      cachedAt: Date.now()
    });
  }
  
  private async findCredentialIdByAlias(alias: CredentialAlias): Promise<CredentialId | null> {
    try {
      // This would query the credential storage for the ID
      // For now, return a simulated ID
      return `cred_${Date.now()}_${alias.replace(/\W/g, '_')}`;
    } catch (error) {
      return null;
    }
  }
  
  private getCredentialRefreshHistory(credentialId: CredentialId): CredentialRefreshRecord[] {
    return Array.from(this.refreshRecords.values())
      .filter(record => record.credentialId === credentialId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }
  
  private generateRefreshId(): string {
    return `refresh_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private getDefaultRefreshConfig(): CredentialRefreshConfig {
    return {
      strategy: 'proactive',
      refreshThreshold: 0.8, // Refresh when 80% of token lifetime elapsed
      refreshBuffer: 5 * 60 * 1000, // 5 minutes buffer
      refreshInterval: 60 * 60 * 1000, // 1 hour
      maxRefreshAttempts: 3,
      retryOnFailure: true,
      maxRetryAttempts: 3,
      retryBackoffMultiplier: 2,
      initialRetryDelay: 1000,
      validateAfterRefresh: true,
      testCredentialsAfterRefresh: false,
      notifyOnRefresh: true,
      notifyOnFailure: true,
      enableTokenCaching: true,
      tokenCacheMaxAge: 30 * 60 * 1000 // 30 minutes
    };
  }
}

// ============================================================================
// CREDENTIAL REFRESH FACTORY
// ============================================================================

/**
 * Factory for creating credential refresh service instances
 */
export class CredentialRefreshServiceFactory {
  /**
   * Create default credential refresh service
   */
  static createDefault(): CredentialRefreshService {
    return new CredentialRefreshService();
  }
  
  /**
   * Create secure credential refresh service
   */
  static createSecure(): CredentialRefreshService {
    const credentialService = CredentialServiceFactory.createSecure();
    const authService = MCPAuthServiceFactory.createSecure();
    
    return new CredentialRefreshService(credentialService, authService);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default refresh configuration
 */
export function createDefaultRefreshConfig(): CredentialRefreshConfig {
  return new CredentialRefreshService().getDefaultRefreshConfig();
}

/**
 * Quick refresh setup function
 */
export async function setupCredentialRefresh(
  credentialId: CredentialId,
  config: Partial<CredentialRefreshConfig>
): Promise<CredentialRefreshService> {
  const refreshService = CredentialRefreshServiceFactory.createSecure();
  
  const fullConfig = {
    ...createDefaultRefreshConfig(),
    ...config
  };
  
  await refreshService.setRefreshConfig(credentialId, fullConfig);
  return refreshService;
}