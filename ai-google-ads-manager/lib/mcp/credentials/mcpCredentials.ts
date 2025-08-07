/**
 * MCP Credential Communication
 * 
 * This file implements high-level credential communication
 * and integration with the MCP server for GA4 operations.
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
  MCPAuthServiceFactory,
  MCPAuthContext,
  MCPCredentialVerification
} from './mcpAuth';

import {
  IMCPClient,
  MCPClientFactory,
  MCPClientConfig,
  MCPConnectionStatus,
  MCPResponse,
  GA4DataRequest,
  GA4RealTimeRequest
} from './mcpClient';

// ============================================================================
// MCP CREDENTIAL MANAGER TYPES
// ============================================================================

/**
 * MCP credential manager configuration
 */
export interface MCPCredentialManagerConfig {
  // Server configuration
  defaultServerUrl: string;
  fallbackServerUrl?: string;
  
  // Connection settings
  connectionTimeout: number;
  maxRetryAttempts: number;
  enableAutoReconnect: boolean;
  
  // Credential settings
  enableCredentialRotation: boolean;
  rotationInterval: number;
  enableCredentialValidation: boolean;
  validationInterval: number;
  
  // Security settings
  enableEncryption: boolean;
  enableRequestSigning: boolean;
  enableResponseVerification: boolean;
  
  // Performance settings
  enableCaching: boolean;
  cacheMaxAge: number;
  enableRequestQueuing: boolean;
  maxConcurrentRequests: number;
}

/**
 * MCP operation result with credential context
 */
export interface MCPCredentialOperationResult<T = any> extends CredentialOperationResult<T> {
  credentialContext?: {
    credentialId: CredentialId;
    credentialAlias?: CredentialAlias;
    lastUsed: string;
    verificationStatus: 'valid' | 'invalid' | 'expired' | 'revoked' | 'unknown';
    serverUrl: string;
  };
}

/**
 * MCP credential manager status
 */
export interface MCPCredentialManagerStatus {
  isInitialized: boolean;
  activeConnections: number;
  totalCredentials: number;
  validCredentials: number;
  expiredCredentials: number;
  lastValidation: string | null;
  serverStatus: {
    primary: 'online' | 'offline' | 'unknown';
    fallback?: 'online' | 'offline' | 'unknown';
  };
  performance: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

/**
 * Credential rotation policy
 */
export interface CredentialRotationPolicy {
  enabled: boolean;
  rotationInterval: number; // milliseconds
  warningThreshold: number; // percentage of interval
  maxCredentialAge: number; // milliseconds
  autoRotate: boolean;
  notificationEnabled: boolean;
}

// ============================================================================
// MCP CREDENTIAL MANAGER INTERFACE
// ============================================================================

/**
 * Interface for MCP credential management operations
 */
export interface IMCPCredentialManager {
  // Initialization
  initialize(config: Partial<MCPCredentialManagerConfig>): Promise<CredentialOperationResult<boolean>>;
  isInitialized(): boolean;
  getStatus(): MCPCredentialManagerStatus;
  
  // Credential management
  addCredential(credential: GA4ServiceAccountCredential, alias: string): Promise<MCPCredentialOperationResult<CredentialId>>;
  getCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<GA4ServiceAccountCredential>>;
  removeCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<boolean>>;
  listCredentials(): Promise<MCPCredentialOperationResult<Array<{ id: CredentialId; alias: string; status: string }>>>;
  
  // Connection management
  connect(credentialId: CredentialId, serverUrl?: string): Promise<MCPCredentialOperationResult<IMCPClient>>;
  connectByAlias(alias: CredentialAlias, serverUrl?: string): Promise<MCPCredentialOperationResult<IMCPClient>>;
  disconnect(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>>;
  disconnectAll(): Promise<CredentialOperationResult<number>>;
  
  // GA4 operations
  fetchGA4Data(credentialId: CredentialId, request: GA4DataRequest): Promise<MCPCredentialOperationResult<any>>;
  fetchGA4RealTimeData(credentialId: CredentialId, request: GA4RealTimeRequest): Promise<MCPCredentialOperationResult<any>>;
  fetchGA4Metadata(credentialId: CredentialId, propertyId: string): Promise<MCPCredentialOperationResult<any>>;
  
  // Batch operations
  fetchMultipleProperties(credentialId: CredentialId, requests: GA4DataRequest[]): Promise<MCPCredentialOperationResult<any[]>>;
  fetchFromMultipleCredentials(requests: Array<{ credentialId: CredentialId; request: GA4DataRequest }>): Promise<MCPCredentialOperationResult<any[]>>;
  
  // Credential validation
  validateCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<boolean>>;
  validateAllCredentials(): Promise<MCPCredentialOperationResult<Array<{ credentialId: CredentialId; isValid: boolean }>>>;
  
  // Credential rotation
  rotateCredential(credentialId: CredentialId, newCredential: GA4ServiceAccountCredential): Promise<MCPCredentialOperationResult<boolean>>;
  scheduleRotation(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>>;
  
  // Health monitoring
  healthCheck(): Promise<MCPCredentialOperationResult<{ server: boolean; credentials: boolean; overall: boolean }>>;
  getMetrics(): MCPCredentialManagerStatus;
  
  // Event handling
  onCredentialExpired(callback: (credentialId: CredentialId) => void): void;
  onConnectionLost(callback: (credentialId: CredentialId, error: CredentialError) => void): void;
  onOperationComplete(callback: (operation: string, result: MCPCredentialOperationResult) => void): void;
}

// ============================================================================
// MCP CREDENTIAL MANAGER IMPLEMENTATION
// ============================================================================

/**
 * MCP credential manager implementation
 */
export class MCPCredentialManager implements IMCPCredentialManager {
  private config: MCPCredentialManagerConfig;
  private credentialService: ICredentialService;
  private authService: IMCPAuthService;
  private clients: Map<CredentialId, IMCPClient> = new Map();
  private isInit: boolean = false;
  private rotationTimers: Map<CredentialId, NodeJS.Timeout> = new Map();
  private validationTimer: NodeJS.Timeout | null = null;
  private metrics: MCPCredentialManagerStatus;
  
  // Event handlers
  private credentialExpiredHandlers: Array<(credentialId: CredentialId) => void> = [];
  private connectionLostHandlers: Array<(credentialId: CredentialId, error: CredentialError) => void> = [];
  private operationCompleteHandlers: Array<(operation: string, result: MCPCredentialOperationResult) => void> = [];
  
  constructor(
    credentialService?: ICredentialService,
    authService?: IMCPAuthService
  ) {
    this.credentialService = credentialService || CredentialServiceFactory.createSecure();
    this.authService = authService || MCPAuthServiceFactory.createSecure();
    
    this.config = {
      defaultServerUrl: 'http://localhost:3001',
      connectionTimeout: 30000,
      maxRetryAttempts: 3,
      enableAutoReconnect: true,
      enableCredentialRotation: false,
      rotationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      enableCredentialValidation: true,
      validationInterval: 60 * 60 * 1000, // 1 hour
      enableEncryption: true,
      enableRequestSigning: true,
      enableResponseVerification: true,
      enableCaching: true,
      cacheMaxAge: 300000, // 5 minutes
      enableRequestQueuing: true,
      maxConcurrentRequests: 10
    };
    
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Initialize the credential manager
   */
  async initialize(config: Partial<MCPCredentialManagerConfig>): Promise<CredentialOperationResult<boolean>> {
    try {
      // Update configuration
      this.config = { ...this.config, ...config };
      
      // Initialize credential service
      if (!this.credentialService.isInitialized()) {
        // This would require a master password in a real implementation
        const initResult = await this.credentialService.initialize('default-master-password');
        if (!initResult.success) {
          throw initResult.error || new CredentialError('Failed to initialize credential service', 'INIT_ERROR');
        }
      }
      
      // Start validation timer if enabled
      if (this.config.enableCredentialValidation) {
        this.startValidationTimer();
      }
      
      this.isInit = true;
      this.updateMetrics({ isInitialized: true });
      
      return {
        success: true,
        data: true,
        metadata: {
          initializedAt: new Date().toISOString(),
          config: this.config
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to initialize MCP credential manager', 'INITIALIZATION_ERROR', undefined, 'initialize', error)
      };
    }
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.isInit;
  }
  
  /**
   * Get manager status
   */
  getStatus(): MCPCredentialManagerStatus {
    return { ...this.metrics };
  }
  
  /**
   * Add new credential
   */
  async addCredential(credential: GA4ServiceAccountCredential, alias: string): Promise<MCPCredentialOperationResult<CredentialId>> {
    try {
      this.ensureInitialized();
      
      const storeResult = await this.credentialService.storeCredential(credential, alias, {
        validateBeforeStore: true,
        enableLifecycleTracking: true
      });
      
      if (!storeResult.success || !storeResult.data) {
        throw storeResult.error || new CredentialError('Failed to store credential', 'STORE_ERROR');
      }
      
      const credentialId = storeResult.data;
      
      // Schedule rotation if enabled
      if (this.config.enableCredentialRotation) {
        await this.scheduleCredentialRotation(credentialId);
      }
      
      this.updateMetrics({ totalCredentials: this.metrics.totalCredentials + 1 });
      this.emitOperationComplete('addCredential', {
        success: true,
        data: credentialId,
        credentialContext: {
          credentialId,
          credentialAlias: alias,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      });
      
      return {
        success: true,
        data: credentialId,
        credentialContext: {
          credentialId,
          credentialAlias: alias,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      };
    } catch (error) {
      const result: MCPCredentialOperationResult<CredentialId> = {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to add credential', 'ADD_CREDENTIAL_ERROR', undefined, 'addCredential', error)
      };
      
      this.emitOperationComplete('addCredential', result);
      return result;
    }
  }
  
  /**
   * Get credential
   */
  async getCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<GA4ServiceAccountCredential>> {
    try {
      this.ensureInitialized();
      
      const result = await this.credentialService.getCredential(credentialId);
      if (!result.success || !result.data) {
        throw result.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', credentialId);
      }
      
      return {
        success: true,
        data: result.data,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get credential', 'GET_CREDENTIAL_ERROR', credentialId, 'getCredential', error)
      };
    }
  }
  
  /**
   * Remove credential
   */
  async removeCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      // Disconnect if connected
      await this.disconnect(credentialId);
      
      // Remove rotation timer
      const timer = this.rotationTimers.get(credentialId);
      if (timer) {
        clearTimeout(timer);
        this.rotationTimers.delete(credentialId);
      }
      
      // Remove from credential service
      const result = await this.credentialService.deleteCredential(credentialId);
      if (!result.success) {
        throw result.error || new CredentialError('Failed to delete credential', 'DELETE_ERROR', credentialId);
      }
      
      this.updateMetrics({ totalCredentials: Math.max(0, this.metrics.totalCredentials - 1) });
      
      return {
        success: true,
        data: true,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove credential', 'REMOVE_CREDENTIAL_ERROR', credentialId, 'removeCredential', error)
      };
    }
  }
  
  /**
   * List all credentials
   */
  async listCredentials(): Promise<MCPCredentialOperationResult<Array<{ id: CredentialId; alias: string; status: string }>>> {
    try {
      this.ensureInitialized();
      
      const result = await this.credentialService.listCredentials();
      if (!result.success || !result.data) {
        throw result.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      const credentials = result.data.map(metadata => ({
        id: metadata.version, // This would be the actual ID from metadata
        alias: metadata.description || 'Unknown',
        status: 'active' // This would be determined from lifecycle data
      }));
      
      return {
        success: true,
        data: credentials
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list credentials', 'LIST_CREDENTIALS_ERROR', undefined, 'listCredentials', error)
      };
    }
  }
  
  /**
   * Connect to MCP server
   */
  async connect(credentialId: CredentialId, serverUrl?: string): Promise<MCPCredentialOperationResult<IMCPClient>> {
    try {
      this.ensureInitialized();
      
      const client = MCPClientFactory.createSecure();
      
      const connectResult = await client.connect(credentialId, {
        serverUrl: serverUrl || this.config.defaultServerUrl,
        timeout: this.config.connectionTimeout,
        retryAttempts: this.config.maxRetryAttempts,
        enableAutoReconnect: this.config.enableAutoReconnect
      });
      
      if (!connectResult.success) {
        throw connectResult.error || new CredentialError('Failed to connect to MCP server', 'CONNECTION_ERROR', credentialId);
      }
      
      this.clients.set(credentialId, client);
      this.updateMetrics({ activeConnections: this.clients.size });
      
      // Set up event handlers
      client.onConnectionChange((status) => {
        if (!status.isConnected) {
          this.clients.delete(credentialId);
          this.updateMetrics({ activeConnections: this.clients.size });
        }
      });
      
      client.onError((error) => {
        this.emitConnectionLost(credentialId, error);
      });
      
      return {
        success: true,
        data: client,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'valid',
          serverUrl: serverUrl || this.config.defaultServerUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to connect', 'CONNECT_ERROR', credentialId, 'connect', error)
      };
    }
  }
  
  /**
   * Connect by alias
   */
  async connectByAlias(alias: CredentialAlias, serverUrl?: string): Promise<MCPCredentialOperationResult<IMCPClient>> {
    try {
      // Get credential by alias first
      const credentialResult = await this.credentialService.getCredentialByAlias(alias);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }
      
      // Find credential ID - this would be from the retrieval metadata
      const credentialId = `cred_${Date.now()}_${alias.replace(/\W/g, '_')}`; // Simulated
      
      return await this.connect(credentialId, serverUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to connect by alias', 'CONNECT_BY_ALIAS_ERROR', undefined, 'connectByAlias', error)
      };
    }
  }
  
  /**
   * Disconnect from MCP server
   */
  async disconnect(credentialId: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      const client = this.clients.get(credentialId);
      if (client) {
        await client.disconnect();
        this.clients.delete(credentialId);
        this.updateMetrics({ activeConnections: this.clients.size });
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
          : new CredentialError('Failed to disconnect', 'DISCONNECT_ERROR', credentialId, 'disconnect', error)
      };
    }
  }
  
  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<CredentialOperationResult<number>> {
    try {
      const disconnectPromises = Array.from(this.clients.keys()).map(credentialId => 
        this.disconnect(credentialId)
      );
      
      const results = await Promise.all(disconnectPromises);
      const successCount = results.filter(r => r.success).length;
      
      return {
        success: successCount === results.length,
        data: successCount
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to disconnect all', 'DISCONNECT_ALL_ERROR', undefined, 'disconnectAll', error)
      };
    }
  }
  
  /**
   * Fetch GA4 data
   */
  async fetchGA4Data(credentialId: CredentialId, request: GA4DataRequest): Promise<MCPCredentialOperationResult<any>> {
    return await this.executeWithClient(credentialId, async (client) => {
      const response = await client.getGA4Data(request);
      this.updateRequestMetrics(response.success);
      return response.data;
    }, 'fetchGA4Data');
  }
  
  /**
   * Fetch GA4 real-time data
   */
  async fetchGA4RealTimeData(credentialId: CredentialId, request: GA4RealTimeRequest): Promise<MCPCredentialOperationResult<any>> {
    return await this.executeWithClient(credentialId, async (client) => {
      const response = await client.getGA4RealTimeData(request);
      this.updateRequestMetrics(response.success);
      return response.data;
    }, 'fetchGA4RealTimeData');
  }
  
  /**
   * Fetch GA4 metadata
   */
  async fetchGA4Metadata(credentialId: CredentialId, propertyId: string): Promise<MCPCredentialOperationResult<any>> {
    return await this.executeWithClient(credentialId, async (client) => {
      const response = await client.getGA4Metadata(propertyId);
      this.updateRequestMetrics(response.success);
      return response.data;
    }, 'fetchGA4Metadata');
  }
  
  /**
   * Fetch from multiple properties
   */
  async fetchMultipleProperties(credentialId: CredentialId, requests: GA4DataRequest[]): Promise<MCPCredentialOperationResult<any[]>> {
    return await this.executeWithClient(credentialId, async (client) => {
      const responses = await Promise.all(
        requests.map(request => client.getGA4Data(request))
      );
      
      responses.forEach(response => this.updateRequestMetrics(response.success));
      return responses.map(r => r.data);
    }, 'fetchMultipleProperties');
  }
  
  /**
   * Fetch from multiple credentials
   */
  async fetchFromMultipleCredentials(
    requests: Array<{ credentialId: CredentialId; request: GA4DataRequest }>
  ): Promise<MCPCredentialOperationResult<any[]>> {
    try {
      const responses = await Promise.all(
        requests.map(({ credentialId, request }) => 
          this.fetchGA4Data(credentialId, request)
        )
      );
      
      const data = responses.map(r => r.data);
      const allSuccessful = responses.every(r => r.success);
      
      return {
        success: allSuccessful,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to fetch from multiple credentials', 'MULTI_FETCH_ERROR', undefined, 'fetchFromMultipleCredentials', error)
      };
    }
  }
  
  /**
   * Validate credential
   */
  async validateCredential(credentialId: CredentialId): Promise<MCPCredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      const verification = await this.authService.verifyCredential(credentialId);
      
      return {
        success: verification.isValid,
        data: verification.isValid,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: verification.serverResponse.status,
          serverUrl: this.config.defaultServerUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to validate credential', 'VALIDATE_CREDENTIAL_ERROR', credentialId, 'validateCredential', error)
      };
    }
  }
  
  /**
   * Validate all credentials
   */
  async validateAllCredentials(): Promise<MCPCredentialOperationResult<Array<{ credentialId: CredentialId; isValid: boolean }>>> {
    try {
      const listResult = await this.listCredentials();
      if (!listResult.success || !listResult.data) {
        throw listResult.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      const validationResults = await Promise.all(
        listResult.data.map(async ({ id }) => {
          const result = await this.validateCredential(id);
          return {
            credentialId: id,
            isValid: result.success && result.data === true
          };
        })
      );
      
      // Update metrics
      const validCount = validationResults.filter(r => r.isValid).length;
      const expiredCount = validationResults.length - validCount;
      
      this.updateMetrics({
        validCredentials: validCount,
        expiredCredentials: expiredCount,
        lastValidation: new Date().toISOString()
      });
      
      return {
        success: true,
        data: validationResults
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to validate all credentials', 'VALIDATE_ALL_ERROR', undefined, 'validateAllCredentials', error)
      };
    }
  }
  
  /**
   * Rotate credential
   */
  async rotateCredential(credentialId: CredentialId, newCredential: GA4ServiceAccountCredential): Promise<MCPCredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      // Disconnect existing client
      await this.disconnect(credentialId);
      
      // Update credential
      const updateResult = await this.credentialService.updateCredential(credentialId, newCredential);
      if (!updateResult.success) {
        throw updateResult.error || new CredentialError('Failed to update credential', 'UPDATE_ERROR', credentialId);
      }
      
      // Reschedule rotation
      if (this.config.enableCredentialRotation) {
        await this.scheduleCredentialRotation(credentialId);
      }
      
      return {
        success: true,
        data: true,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to rotate credential', 'ROTATE_CREDENTIAL_ERROR', credentialId, 'rotateCredential', error)
      };
    }
  }
  
  /**
   * Schedule credential rotation
   */
  async scheduleRotation(credentialId: CredentialId, policy: CredentialRotationPolicy): Promise<CredentialOperationResult<boolean>> {
    try {
      if (!policy.enabled) {
        return { success: true, data: true };
      }
      
      // Clear existing timer
      const existingTimer = this.rotationTimers.get(credentialId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Schedule new rotation
      const timer = setTimeout(async () => {
        this.emitCredentialExpired(credentialId);
        
        if (policy.autoRotate) {
          // Auto-rotation would require new credential generation
          // For now, just emit the event
        }
      }, policy.rotationInterval);
      
      this.rotationTimers.set(credentialId, timer);
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to schedule rotation', 'SCHEDULE_ROTATION_ERROR', credentialId, 'scheduleRotation', error)
      };
    }
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<MCPCredentialOperationResult<{ server: boolean; credentials: boolean; overall: boolean }>> {
    try {
      this.ensureInitialized();
      
      // Check server connectivity
      const serverHealthy = await this.authService.testConnection({
        serverUrl: this.config.defaultServerUrl,
        timeout: 5000,
        retryAttempts: 1,
        enableEncryption: false,
        verificationEnabled: false,
        compressionLevel: 'none'
      });
      
      // Check credential validity
      const credentialValidation = await this.validateAllCredentials();
      const credentialsHealthy = credentialValidation.success && 
        credentialValidation.data!.every(r => r.isValid);
      
      const overall = serverHealthy && credentialsHealthy;
      
      // Update server status
      this.updateMetrics({
        serverStatus: {
          primary: serverHealthy ? 'online' : 'offline'
        }
      });
      
      return {
        success: overall,
        data: {
          server: serverHealthy,
          credentials: credentialsHealthy,
          overall
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Health check failed', 'HEALTH_CHECK_ERROR', undefined, 'healthCheck', error)
      };
    }
  }
  
  /**
   * Get metrics
   */
  getMetrics(): MCPCredentialManagerStatus {
    return { ...this.metrics };
  }
  
  /**
   * Register credential expired handler
   */
  onCredentialExpired(callback: (credentialId: CredentialId) => void): void {
    this.credentialExpiredHandlers.push(callback);
  }
  
  /**
   * Register connection lost handler
   */
  onConnectionLost(callback: (credentialId: CredentialId, error: CredentialError) => void): void {
    this.connectionLostHandlers.push(callback);
  }
  
  /**
   * Register operation complete handler
   */
  onOperationComplete(callback: (operation: string, result: MCPCredentialOperationResult) => void): void {
    this.operationCompleteHandlers.push(callback);
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private ensureInitialized(): void {
    if (!this.isInit) {
      throw new CredentialError('MCP credential manager not initialized', 'NOT_INITIALIZED');
    }
  }
  
  private async executeWithClient<T>(
    credentialId: CredentialId,
    operation: (client: IMCPClient) => Promise<T>,
    operationName: string
  ): Promise<MCPCredentialOperationResult<T>> {
    try {
      this.ensureInitialized();
      
      let client = this.clients.get(credentialId);
      if (!client) {
        const connectResult = await this.connect(credentialId);
        if (!connectResult.success || !connectResult.data) {
          throw connectResult.error || new CredentialError('Failed to connect', 'CONNECTION_ERROR', credentialId);
        }
        client = connectResult.data;
      }
      
      const data = await operation(client);
      
      const result: MCPCredentialOperationResult<T> = {
        success: true,
        data,
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'valid',
          serverUrl: this.config.defaultServerUrl
        }
      };
      
      this.emitOperationComplete(operationName, result);
      return result;
    } catch (error) {
      const result: MCPCredentialOperationResult<T> = {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError(`Failed to execute ${operationName}`, 'EXECUTION_ERROR', credentialId, operationName, error),
        credentialContext: {
          credentialId,
          lastUsed: new Date().toISOString(),
          verificationStatus: 'unknown',
          serverUrl: this.config.defaultServerUrl
        }
      };
      
      this.emitOperationComplete(operationName, result);
      return result;
    }
  }
  
  private initializeMetrics(): MCPCredentialManagerStatus {
    return {
      isInitialized: false,
      activeConnections: 0,
      totalCredentials: 0,
      validCredentials: 0,
      expiredCredentials: 0,
      lastValidation: null,
      serverStatus: {
        primary: 'unknown'
      },
      performance: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0
      }
    };
  }
  
  private updateMetrics(updates: Partial<MCPCredentialManagerStatus>): void {
    this.metrics = { ...this.metrics, ...updates };
  }
  
  private updateRequestMetrics(success: boolean): void {
    this.metrics.performance.totalRequests++;
    if (success) {
      this.metrics.performance.successfulRequests++;
    } else {
      this.metrics.performance.failedRequests++;
    }
  }
  
  private async scheduleCredentialRotation(credentialId: CredentialId): Promise<void> {
    const policy: CredentialRotationPolicy = {
      enabled: true,
      rotationInterval: this.config.rotationInterval,
      warningThreshold: 0.8,
      maxCredentialAge: this.config.rotationInterval * 2,
      autoRotate: false,
      notificationEnabled: true
    };
    
    await this.scheduleRotation(credentialId, policy);
  }
  
  private startValidationTimer(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
    
    this.validationTimer = setInterval(async () => {
      await this.validateAllCredentials();
    }, this.config.validationInterval);
  }
  
  private emitCredentialExpired(credentialId: CredentialId): void {
    this.credentialExpiredHandlers.forEach(handler => {
      try {
        handler(credentialId);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
  
  private emitConnectionLost(credentialId: CredentialId, error: CredentialError): void {
    this.connectionLostHandlers.forEach(handler => {
      try {
        handler(credentialId, error);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
  
  private emitOperationComplete(operation: string, result: MCPCredentialOperationResult): void {
    this.operationCompleteHandlers.forEach(handler => {
      try {
        handler(operation, result);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
}

// ============================================================================
// MCP CREDENTIAL MANAGER FACTORY
// ============================================================================

/**
 * Factory for creating MCP credential manager instances
 */
export class MCPCredentialManagerFactory {
  /**
   * Create default MCP credential manager
   */
  static createDefault(): MCPCredentialManager {
    return new MCPCredentialManager();
  }
  
  /**
   * Create secure MCP credential manager
   */
  static createSecure(): MCPCredentialManager {
    const credentialService = CredentialServiceFactory.createSecure();
    const authService = MCPAuthServiceFactory.createSecure();
    
    return new MCPCredentialManager(credentialService, authService);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick setup function for MCP credential management
 */
export async function setupMCPCredentials(config?: Partial<MCPCredentialManagerConfig>): Promise<MCPCredentialManager> {
  const manager = MCPCredentialManagerFactory.createSecure();
  await manager.initialize(config || {});
  return manager;
}

/**
 * Quick GA4 data fetch with automatic credential management
 */
export async function quickFetchGA4Data(
  credential: GA4ServiceAccountCredential,
  request: GA4DataRequest,
  serverUrl?: string
): Promise<any> {
  const manager = await setupMCPCredentials({ defaultServerUrl: serverUrl });
  
  const addResult = await manager.addCredential(credential, 'temp_credential');
  if (!addResult.success || !addResult.data) {
    throw addResult.error || new Error('Failed to add credential');
  }
  
  const fetchResult = await manager.fetchGA4Data(addResult.data, request);
  if (!fetchResult.success) {
    throw fetchResult.error || new Error('Failed to fetch data');
  }
  
  return fetchResult.data;
}