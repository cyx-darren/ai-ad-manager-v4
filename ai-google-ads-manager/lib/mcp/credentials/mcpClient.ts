/**
 * Authenticated MCP Client
 * 
 * This file implements an authenticated MCP client that uses
 * secure credentials for GA4 API communication.
 */

import {
  CredentialId,
  CredentialAlias,
  CredentialOperationResult,
  CredentialError
} from './types';

import {
  IMCPAuthService,
  MCPAuthServiceFactory,
  MCPAuthConfig,
  MCPAuthContext,
  MCPAuthHeaders,
  MCPAuthResult
} from './mcpAuth';

// ============================================================================
// MCP CLIENT TYPES
// ============================================================================

/**
 * MCP client configuration
 */
export interface MCPClientConfig {
  serverUrl: string;
  timeout: number;
  retryAttempts: number;
  enableAutoReconnect: boolean;
  reconnectInterval: number;
  enableRequestLogging: boolean;
  enableResponseCaching: boolean;
  cacheMaxAge: number;
  rateLimitRpm: number;
  enableCompression: boolean;
}

/**
 * MCP request options
 */
export interface MCPRequestOptions {
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
  enableCaching?: boolean;
  cacheKey?: string;
  validateResponse?: boolean;
  includeMetadata?: boolean;
}

/**
 * MCP API response
 */
export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
    fromCache?: boolean;
    credentialId: CredentialId;
  };
}

/**
 * GA4 data request parameters
 */
export interface GA4DataRequest {
  propertyId: string;
  dateRanges: Array<{
    startDate: string;
    endDate: string;
  }>;
  dimensions?: Array<{
    name: string;
  }>;
  metrics: Array<{
    name: string;
  }>;
  orderBy?: Array<{
    dimension?: { dimensionName: string };
    metric?: { metricName: string };
    desc?: boolean;
  }>;
  limit?: number;
  offset?: number;
}

/**
 * GA4 real-time data request
 */
export interface GA4RealTimeRequest {
  propertyId: string;
  dimensions?: Array<{
    name: string;
  }>;
  metrics: Array<{
    name: string;
  }>;
  limit?: number;
  minuteRanges?: Array<{
    startMinutesAgo: number;
    endMinutesAgo?: number;
  }>;
}

/**
 * MCP client connection status
 */
export interface MCPConnectionStatus {
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  lastConnected: string | null;
  authContext: MCPAuthContext | null;
  serverCapabilities: string[];
  error: string | null;
}

// ============================================================================
// MCP CLIENT INTERFACE
// ============================================================================

/**
 * Interface for authenticated MCP client operations
 */
export interface IMCPClient {
  // Connection management
  connect(credentialId: CredentialId, config?: Partial<MCPClientConfig>): Promise<CredentialOperationResult<boolean>>;
  connectByAlias(alias: CredentialAlias, config?: Partial<MCPClientConfig>): Promise<CredentialOperationResult<boolean>>;
  disconnect(): Promise<boolean>;
  reconnect(): Promise<CredentialOperationResult<boolean>>;
  
  // Connection status
  getConnectionStatus(): MCPConnectionStatus;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;
  
  // GA4 API operations
  getGA4Data(request: GA4DataRequest, options?: MCPRequestOptions): Promise<MCPResponse>;
  getGA4RealTimeData(request: GA4RealTimeRequest, options?: MCPRequestOptions): Promise<MCPResponse>;
  getGA4Metadata(propertyId: string, options?: MCPRequestOptions): Promise<MCPResponse>;
  
  // Custom requests
  makeRequest(endpoint: string, data?: any, options?: MCPRequestOptions): Promise<MCPResponse>;
  makeAuthenticatedRequest(endpoint: string, data?: any, headers?: Record<string, string>, options?: MCPRequestOptions): Promise<MCPResponse>;
  
  // Credential management
  refreshCredentials(): Promise<CredentialOperationResult<boolean>>;
  rotateCredentials(newCredentialId: CredentialId): Promise<CredentialOperationResult<boolean>>;
  validateCredentials(): Promise<CredentialOperationResult<boolean>>;
  
  // Cache management
  clearCache(): void;
  getCacheStats(): { hits: number; misses: number; size: number };
  
  // Event handling
  onConnectionChange(callback: (status: MCPConnectionStatus) => void): void;
  onError(callback: (error: CredentialError) => void): void;
  onRequestComplete(callback: (response: MCPResponse) => void): void;
}

// ============================================================================
// MCP CLIENT IMPLEMENTATION
// ============================================================================

/**
 * Authenticated MCP client implementation
 */
export class MCPClient implements IMCPClient {
  private authService: IMCPAuthService;
  private config: MCPClientConfig;
  private authContext: MCPAuthContext | null = null;
  private connectionStatus: MCPConnectionStatus;
  private responseCache: Map<string, { data: any; timestamp: number }> = new Map();
  private requestQueue: Array<{ resolve: Function; reject: Function; request: any }> = [];
  private isReconnecting: boolean = false;
  
  // Event handlers
  private connectionChangeHandlers: Array<(status: MCPConnectionStatus) => void> = [];
  private errorHandlers: Array<(error: CredentialError) => void> = [];
  private requestCompleteHandlers: Array<(response: MCPResponse) => void> = [];
  
  constructor(
    authService?: IMCPAuthService,
    config?: Partial<MCPClientConfig>
  ) {
    this.authService = authService || MCPAuthServiceFactory.createSecure();
    this.config = {
      serverUrl: process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3004',
      timeout: 30000,
      retryAttempts: 3,
      enableAutoReconnect: true,
      reconnectInterval: 5000,
      enableRequestLogging: false,
      enableResponseCaching: true,
      cacheMaxAge: 300000, // 5 minutes
      rateLimitRpm: 1000,
      enableCompression: true,
      ...config
    };
    
    this.connectionStatus = {
      isConnected: false,
      connectionState: 'disconnected',
      lastConnected: null,
      authContext: null,
      serverCapabilities: [],
      error: null
    };
  }
  
  /**
   * Connect to MCP server using credential ID
   */
  async connect(credentialId: CredentialId, config?: Partial<MCPClientConfig>): Promise<CredentialOperationResult<boolean>> {
    try {
      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }
      
      this.updateConnectionStatus('connecting');
      
      // Authenticate with server
      const authConfig: Partial<MCPAuthConfig> = {
        serverUrl: this.config.serverUrl,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts
      };
      
      const authResult = await this.authService.authenticate(credentialId, authConfig);
      if (!authResult.success) {
        throw authResult.error || new CredentialError('Authentication failed', 'AUTHENTICATION_FAILED', credentialId);
      }
      
      // Create auth context
      this.authContext = this.authService.createAuthContext(authResult);
      
      // Update connection status
      this.updateConnectionStatus('connected', null, authResult.serverCapabilities);
      
      // Start auto-reconnect if enabled
      if (this.config.enableAutoReconnect) {
        this.startAutoReconnect();
      }
      
      return {
        success: true,
        data: true,
        metadata: {
          connectedAt: new Date().toISOString(),
          credentialId,
          serverCapabilities: authResult.serverCapabilities
        }
      };
    } catch (error) {
      this.updateConnectionStatus('error', error.message);
      this.emitError(error instanceof CredentialError ? error : new CredentialError('Connection failed', 'CONNECTION_ERROR', credentialId, 'connect', error));
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to connect', 'CONNECTION_ERROR', credentialId, 'connect', error)
      };
    }
  }
  
  /**
   * Connect using credential alias
   */
  async connectByAlias(alias: CredentialAlias, config?: Partial<MCPClientConfig>): Promise<CredentialOperationResult<boolean>> {
    try {
      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }
      
      this.updateConnectionStatus('connecting');
      
      // Authenticate with server using alias
      const authConfig: Partial<MCPAuthConfig> = {
        serverUrl: this.config.serverUrl,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts
      };
      
      const authResult = await this.authService.authenticateByAlias(alias, authConfig);
      if (!authResult.success) {
        throw authResult.error || new CredentialError('Authentication failed', 'AUTHENTICATION_FAILED');
      }
      
      // Create auth context
      this.authContext = this.authService.createAuthContext(authResult);
      
      // Update connection status
      this.updateConnectionStatus('connected', null, authResult.serverCapabilities);
      
      // Start auto-reconnect if enabled
      if (this.config.enableAutoReconnect) {
        this.startAutoReconnect();
      }
      
      return {
        success: true,
        data: true,
        metadata: {
          connectedAt: new Date().toISOString(),
          alias,
          credentialId: authResult.credentialId,
          serverCapabilities: authResult.serverCapabilities
        }
      };
    } catch (error) {
      this.updateConnectionStatus('error', error.message);
      this.emitError(error instanceof CredentialError ? error : new CredentialError('Connection failed', 'CONNECTION_ERROR', undefined, 'connectByAlias', error));
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to connect by alias', 'CONNECTION_BY_ALIAS_ERROR', undefined, 'connectByAlias', error)
      };
    }
  }
  
  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.authContext) {
        await this.authService.revokeAuthContext(this.authContext);
        this.authContext = null;
      }
      
      this.updateConnectionStatus('disconnected');
      this.clearCache();
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Reconnect to MCP server
   */
  async reconnect(): Promise<CredentialOperationResult<boolean>> {
    if (!this.authContext) {
      return {
        success: false,
        error: new CredentialError('No authentication context available for reconnection', 'NO_AUTH_CONTEXT')
      };
    }
    
    return await this.connect(this.authContext.credentialId);
  }
  
  /**
   * Get connection status
   */
  getConnectionStatus(): MCPConnectionStatus {
    return { ...this.connectionStatus };
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus.isConnected && this.authContext !== null;
  }
  
  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        return false;
      }
      
      return await this.authService.testConnection({
        serverUrl: this.config.serverUrl,
        timeout: this.config.timeout,
        retryAttempts: 1,
        enableEncryption: true,
        verificationEnabled: false,
        compressionLevel: 'none'
      });
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get GA4 reporting data
   */
  async getGA4Data(request: GA4DataRequest, options?: MCPRequestOptions): Promise<MCPResponse> {
    return await this.makeAuthenticatedRequest('/api/ga4/data', request, {}, options);
  }
  
  /**
   * Get GA4 real-time data
   */
  async getGA4RealTimeData(request: GA4RealTimeRequest, options?: MCPRequestOptions): Promise<MCPResponse> {
    return await this.makeAuthenticatedRequest('/api/ga4/realtime', request, {}, options);
  }
  
  /**
   * Get GA4 metadata
   */
  async getGA4Metadata(propertyId: string, options?: MCPRequestOptions): Promise<MCPResponse> {
    return await this.makeAuthenticatedRequest(`/api/ga4/metadata/${propertyId}`, {}, {}, options);
  }
  
  /**
   * Make a generic request
   */
  async makeRequest(endpoint: string, data?: any, options?: MCPRequestOptions): Promise<MCPResponse> {
    return await this.makeAuthenticatedRequest(endpoint, data, {}, options);
  }
  
  /**
   * Make authenticated request
   */
  async makeAuthenticatedRequest(
    endpoint: string, 
    data?: any, 
    headers?: Record<string, string>, 
    options?: MCPRequestOptions
  ): Promise<MCPResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      // Ensure we're connected
      if (!this.isConnected() || !this.authContext) {
        throw new CredentialError('Not connected to MCP server', 'NOT_CONNECTED');
      }
      
      // Validate auth context
      if (!this.authService.validateAuthContext(this.authContext)) {
        // Try to refresh authentication
        const refreshResult = await this.refreshCredentials();
        if (!refreshResult.success) {
          throw refreshResult.error || new CredentialError('Authentication expired and refresh failed', 'AUTH_EXPIRED');
        }
      }
      
      // Check cache if enabled
      const cacheKey = options?.cacheKey || this.generateCacheKey(endpoint, data);
      if (options?.enableCaching !== false && this.config.enableResponseCaching) {
        const cachedResponse = this.getCachedResponse(cacheKey);
        if (cachedResponse) {
          return {
            ...cachedResponse,
            metadata: {
              ...cachedResponse.metadata,
              requestId,
              fromCache: true
            }
          };
        }
      }
      
      // Generate request headers
      const authHeaders = this.authService.generateRequestHeaders(this.authContext, data);
      const requestHeaders = { ...authHeaders, ...headers };
      
      // Perform the request
      const response = await this.performRequest(endpoint, data, requestHeaders, options);
      
      // Cache response if enabled
      if (response.success && this.config.enableResponseCaching && options?.enableCaching !== false) {
        this.cacheResponse(cacheKey, response);
      }
      
      // Add metadata
      response.metadata = {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        credentialId: this.authContext.credentialId,
        ...response.metadata
      };
      
      // Emit request complete event
      this.emitRequestComplete(response);
      
      return response;
    } catch (error) {
      const errorResponse: MCPResponse = {
        success: false,
        error: {
          code: error.code || 'REQUEST_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          credentialId: this.authContext?.credentialId || 'unknown'
        }
      };
      
      this.emitError(error instanceof CredentialError ? error : new CredentialError('Request failed', 'REQUEST_ERROR', this.authContext?.credentialId, 'makeAuthenticatedRequest', error));
      this.emitRequestComplete(errorResponse);
      
      return errorResponse;
    }
  }
  
  /**
   * Refresh credentials
   */
  async refreshCredentials(): Promise<CredentialOperationResult<boolean>> {
    try {
      if (!this.authContext) {
        throw new CredentialError('No authentication context available', 'NO_AUTH_CONTEXT');
      }
      
      const refreshResult = await this.authService.refreshAuthentication(this.authContext);
      if (!refreshResult.success) {
        throw refreshResult.error || new CredentialError('Credential refresh failed', 'REFRESH_FAILED');
      }
      
      // Update auth context
      this.authContext = this.authService.createAuthContext(refreshResult);
      
      return {
        success: true,
        data: true,
        metadata: {
          refreshedAt: new Date().toISOString(),
          credentialId: this.authContext.credentialId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to refresh credentials', 'REFRESH_ERROR', this.authContext?.credentialId, 'refreshCredentials', error)
      };
    }
  }
  
  /**
   * Rotate to new credentials
   */
  async rotateCredentials(newCredentialId: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      // Disconnect current session
      await this.disconnect();
      
      // Connect with new credentials
      const connectResult = await this.connect(newCredentialId);
      if (!connectResult.success) {
        throw connectResult.error || new CredentialError('Failed to connect with new credentials', 'ROTATION_FAILED', newCredentialId);
      }
      
      return {
        success: true,
        data: true,
        metadata: {
          rotatedAt: new Date().toISOString(),
          newCredentialId,
          oldCredentialId: this.authContext?.credentialId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to rotate credentials', 'ROTATION_ERROR', newCredentialId, 'rotateCredentials', error)
      };
    }
  }
  
  /**
   * Validate current credentials
   */
  async validateCredentials(): Promise<CredentialOperationResult<boolean>> {
    try {
      if (!this.authContext) {
        throw new CredentialError('No authentication context available', 'NO_AUTH_CONTEXT');
      }
      
      const verification = await this.authService.verifyCredential(this.authContext.credentialId);
      
      return {
        success: verification.isValid,
        data: verification.isValid,
        metadata: {
          validatedAt: new Date().toISOString(),
          credentialId: this.authContext.credentialId,
          verificationResult: verification
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to validate credentials', 'VALIDATION_ERROR', this.authContext?.credentialId, 'validateCredentials', error)
      };
    }
  }
  
  /**
   * Clear response cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; size: number } {
    // This would track actual cache hits/misses
    return {
      hits: 0,
      misses: 0,
      size: this.responseCache.size
    };
  }
  
  /**
   * Register connection change handler
   */
  onConnectionChange(callback: (status: MCPConnectionStatus) => void): void {
    this.connectionChangeHandlers.push(callback);
  }
  
  /**
   * Register error handler
   */
  onError(callback: (error: CredentialError) => void): void {
    this.errorHandlers.push(callback);
  }
  
  /**
   * Register request complete handler
   */
  onRequestComplete(callback: (response: MCPResponse) => void): void {
    this.requestCompleteHandlers.push(callback);
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  /**
   * Update connection status
   */
  private updateConnectionStatus(
    state: MCPConnectionStatus['connectionState'], 
    error?: string | null, 
    capabilities?: string[]
  ): void {
    this.connectionStatus = {
      isConnected: state === 'connected',
      connectionState: state,
      lastConnected: state === 'connected' ? new Date().toISOString() : this.connectionStatus.lastConnected,
      authContext: this.authContext,
      serverCapabilities: capabilities || this.connectionStatus.serverCapabilities,
      error: error || null
    };
    
    // Emit connection change event
    this.connectionChangeHandlers.forEach(handler => {
      try {
        handler(this.connectionStatus);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
  
  /**
   * Start auto-reconnect
   */
  private startAutoReconnect(): void {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    
    const reconnectTimer = setInterval(async () => {
      if (this.connectionStatus.connectionState === 'connected') {
        clearInterval(reconnectTimer);
        this.isReconnecting = false;
        return;
      }
      
      if (this.authContext) {
        try {
          this.updateConnectionStatus('reconnecting');
          await this.reconnect();
        } catch (error) {
          // Reconnection failed, will try again
        }
      }
    }, this.config.reconnectInterval);
  }
  
  /**
   * Perform HTTP request
   */
  private async performRequest(
    endpoint: string, 
    data: any, 
    headers: Record<string, string>, 
    options?: MCPRequestOptions
  ): Promise<MCPResponse> {
    try {
      // This would make the actual HTTP request
      // For now, simulate a successful response
      const url = `${this.config.serverUrl}${endpoint}`;
      
      // Simulate different responses based on endpoint
      let responseData: any;
      
      if (endpoint.includes('/ga4/data')) {
        responseData = {
          rows: [
            { dimensionValues: [{ value: 'United States' }], metricValues: [{ value: '1000' }] },
            { dimensionValues: [{ value: 'United Kingdom' }], metricValues: [{ value: '750' }] }
          ],
          metadata: {
            currencyCode: 'USD',
            timeZone: 'America/Los_Angeles'
          }
        };
      } else if (endpoint.includes('/ga4/realtime')) {
        responseData = {
          rows: [
            { dimensionValues: [{ value: '/home' }], metricValues: [{ value: '25' }] },
            { dimensionValues: [{ value: '/products' }], metricValues: [{ value: '18' }] }
          ],
          metadata: {
            dataLossFromOtherRow: false
          }
        };
      } else if (endpoint.includes('/ga4/metadata')) {
        responseData = {
          dimensions: [
            { apiName: 'country', uiName: 'Country', description: 'Country of the user' },
            { apiName: 'city', uiName: 'City', description: 'City of the user' }
          ],
          metrics: [
            { apiName: 'activeUsers', uiName: 'Active Users', description: 'Number of active users' },
            { apiName: 'sessions', uiName: 'Sessions', description: 'Number of sessions' }
          ]
        };
      } else {
        responseData = { message: 'Request processed successfully' };
      }
      
      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      throw new CredentialError('HTTP request failed', 'HTTP_ERROR', this.authContext?.credentialId, 'performRequest', error);
    }
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(endpoint: string, data: any): string {
    const hash = JSON.stringify({ endpoint, data });
    return btoa(hash).replace(/[/+=]/g, '');
  }
  
  /**
   * Get cached response
   */
  private getCachedResponse(cacheKey: string): MCPResponse | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.config.cacheMaxAge) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Cache response
   */
  private cacheResponse(cacheKey: string, response: MCPResponse): void {
    this.responseCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
  }
  
  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  /**
   * Emit error event
   */
  private emitError(error: CredentialError): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
  
  /**
   * Emit request complete event
   */
  private emitRequestComplete(response: MCPResponse): void {
    this.requestCompleteHandlers.forEach(handler => {
      try {
        handler(response);
      } catch (err) {
        // Ignore handler errors
      }
    });
  }
}

// ============================================================================
// MCP CLIENT FACTORY
// ============================================================================

/**
 * Factory for creating MCP client instances
 */
export class MCPClientFactory {
  /**
   * Create default MCP client
   */
  static createDefault(): MCPClient {
    return new MCPClient();
  }
  
  /**
   * Create secure MCP client
   */
  static createSecure(): MCPClient {
    const authService = MCPAuthServiceFactory.createSecure();
    const config = {
      enableAutoReconnect: true,
      enableResponseCaching: true,
      enableCompression: true,
      timeout: 15000,
      retryAttempts: 5
    };
    
    return new MCPClient(authService, config);
  }
  
  /**
   * Create MCP client with custom configuration
   */
  static create(authService: IMCPAuthService, config: Partial<MCPClientConfig>): MCPClient {
    return new MCPClient(authService, config);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick connection function
 */
export async function connectToMCP(credentialId: CredentialId, serverUrl?: string): Promise<MCPClient> {
  const client = MCPClientFactory.createDefault();
  await client.connect(credentialId, { serverUrl });
  return client;
}

/**
 * Quick GA4 data fetch function
 */
export async function fetchGA4Data(
  credentialId: CredentialId, 
  request: GA4DataRequest, 
  serverUrl?: string
): Promise<MCPResponse> {
  const client = await connectToMCP(credentialId, serverUrl);
  return await client.getGA4Data(request);
}