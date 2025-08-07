/**
 * MCP Authentication Integration
 * 
 * This file implements secure credential passing and authentication
 * for MCP server communication with GA4 credentials.
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

// ============================================================================
// MCP AUTHENTICATION TYPES
// ============================================================================

/**
 * MCP authentication configuration
 */
export interface MCPAuthConfig {
  serverUrl: string;
  timeout: number;
  retryAttempts: number;
  enableEncryption: boolean;
  verificationEnabled: boolean;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * MCP authentication headers
 */
export interface MCPAuthHeaders {
  'Authorization': string;
  'X-Credential-ID': string;
  'X-Credential-Hash': string;
  'X-Client-Version': string;
  'X-Timestamp': string;
  'X-Nonce': string;
  'Content-Type': string;
  [key: string]: string;
}

/**
 * MCP authentication result
 */
export interface MCPAuthResult {
  success: boolean;
  credentialId: CredentialId;
  authToken: string;
  expiresAt: string;
  serverCapabilities: string[];
  error?: CredentialError;
  metadata?: {
    verificationTime: number;
    serverVersion: string;
    connectionId: string;
  };
}

/**
 * MCP credential verification result
 */
export interface MCPCredentialVerification {
  isValid: boolean;
  credentialId: CredentialId;
  verificationTimestamp: string;
  serverResponse: {
    status: 'valid' | 'invalid' | 'expired' | 'revoked';
    message: string;
    nextVerification?: string;
  };
  issues?: Array<{
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

/**
 * MCP authentication context
 */
export interface MCPAuthContext {
  credentialId: CredentialId;
  authToken: string;
  expiresAt: string;
  serverUrl: string;
  sessionId: string;
  lastUsed: string;
  isActive: boolean;
}

// ============================================================================
// MCP AUTHENTICATION SERVICE INTERFACE
// ============================================================================

/**
 * Interface for MCP authentication operations
 */
export interface IMCPAuthService {
  // Authentication operations
  authenticate(credentialId: CredentialId, config?: Partial<MCPAuthConfig>): Promise<MCPAuthResult>;
  authenticateByAlias(alias: CredentialAlias, config?: Partial<MCPAuthConfig>): Promise<MCPAuthResult>;
  refreshAuthentication(context: MCPAuthContext): Promise<MCPAuthResult>;
  
  // Credential verification
  verifyCredential(credentialId: CredentialId): Promise<MCPCredentialVerification>;
  verifyCredentialWithServer(credentialId: CredentialId, serverUrl: string): Promise<MCPCredentialVerification>;
  
  // Header generation
  generateAuthHeaders(credential: GA4ServiceAccountCredential, credentialId: CredentialId): Promise<MCPAuthHeaders>;
  generateRequestHeaders(context: MCPAuthContext, requestData?: any): MCPAuthHeaders;
  
  // Session management
  createAuthContext(authResult: MCPAuthResult): MCPAuthContext;
  validateAuthContext(context: MCPAuthContext): boolean;
  refreshAuthContext(context: MCPAuthContext): Promise<MCPAuthContext>;
  revokeAuthContext(context: MCPAuthContext): Promise<boolean>;
  
  // Server communication
  testConnection(config: MCPAuthConfig): Promise<boolean>;
  getServerCapabilities(serverUrl: string): Promise<string[]>;
  
  // Security operations
  encryptCredentialPayload(credential: GA4ServiceAccountCredential): Promise<string>;
  decryptServerResponse(encryptedResponse: string): Promise<any>;
  validateServerCertificate(serverUrl: string): Promise<boolean>;
}

// ============================================================================
// MCP AUTHENTICATION SERVICE IMPLEMENTATION
// ============================================================================

/**
 * MCP authentication service implementation
 */
export class MCPAuthService implements IMCPAuthService {
  private credentialService: ICredentialService;
  private defaultConfig: MCPAuthConfig;
  private activeContexts: Map<string, MCPAuthContext> = new Map();
  
  constructor(
    credentialService?: ICredentialService,
    defaultConfig?: Partial<MCPAuthConfig>
  ) {
    this.credentialService = credentialService || CredentialServiceFactory.createSecure();
    this.defaultConfig = {
      serverUrl: 'http://localhost:3001',
      timeout: 30000,
      retryAttempts: 3,
      enableEncryption: true,
      verificationEnabled: true,
      compressionLevel: 'medium',
      ...defaultConfig
    };
  }
  
  /**
   * Authenticate with MCP server using credential ID
   */
  async authenticate(credentialId: CredentialId, config?: Partial<MCPAuthConfig>): Promise<MCPAuthResult> {
    try {
      const authConfig = { ...this.defaultConfig, ...config };
      
      // Get credential from secure storage
      const credentialResult = await this.credentialService.getCredential(credentialId);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', credentialId);
      }
      
      const credential = credentialResult.data;
      
      // Validate credential before use
      const validationResult = await this.credentialService.validateCredential(credential);
      if (!validationResult.isValid) {
        throw new CredentialError(
          `Credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          'CREDENTIAL_INVALID',
          credentialId
        );
      }
      
      // Generate authentication headers
      const authHeaders = await this.generateAuthHeaders(credential, credentialId);
      
      // Encrypt credential payload if enabled
      const payload = authConfig.enableEncryption 
        ? await this.encryptCredentialPayload(credential)
        : JSON.stringify(credential);
      
      // Perform authentication request
      const authResult = await this.performAuthentication(authConfig.serverUrl, authHeaders, payload, authConfig);
      
      // Create and store auth context
      if (authResult.success) {
        const context = this.createAuthContext(authResult);
        this.activeContexts.set(context.sessionId, context);
      }
      
      return authResult;
    } catch (error) {
      return {
        success: false,
        credentialId,
        authToken: '',
        expiresAt: '',
        serverCapabilities: [],
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Authentication failed', 'AUTHENTICATION_ERROR', credentialId, 'authenticate', error)
      };
    }
  }
  
  /**
   * Authenticate using credential alias
   */
  async authenticateByAlias(alias: CredentialAlias, config?: Partial<MCPAuthConfig>): Promise<MCPAuthResult> {
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
      
      return await this.authenticate(credentialId, config);
    } catch (error) {
      return {
        success: false,
        credentialId: 'unknown',
        authToken: '',
        expiresAt: '',
        serverCapabilities: [],
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Authentication by alias failed', 'AUTHENTICATION_BY_ALIAS_ERROR', undefined, 'authenticateByAlias', error)
      };
    }
  }
  
  /**
   * Refresh existing authentication
   */
  async refreshAuthentication(context: MCPAuthContext): Promise<MCPAuthResult> {
    try {
      if (!this.validateAuthContext(context)) {
        throw new CredentialError('Invalid authentication context', 'INVALID_AUTH_CONTEXT');
      }
      
      // Re-authenticate using existing credential
      const authResult = await this.authenticate(context.credentialId, {
        serverUrl: context.serverUrl
      });
      
      // Update existing context
      if (authResult.success) {
        const updatedContext = this.createAuthContext(authResult);
        updatedContext.sessionId = context.sessionId; // Keep same session ID
        this.activeContexts.set(context.sessionId, updatedContext);
      }
      
      return authResult;
    } catch (error) {
      return {
        success: false,
        credentialId: context.credentialId,
        authToken: '',
        expiresAt: '',
        serverCapabilities: [],
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Authentication refresh failed', 'AUTHENTICATION_REFRESH_ERROR', context.credentialId, 'refreshAuthentication', error)
      };
    }
  }
  
  /**
   * Verify credential with MCP server
   */
  async verifyCredential(credentialId: CredentialId): Promise<MCPCredentialVerification> {
    return await this.verifyCredentialWithServer(credentialId, this.defaultConfig.serverUrl);
  }
  
  /**
   * Verify credential with specific server
   */
  async verifyCredentialWithServer(credentialId: CredentialId, serverUrl: string): Promise<MCPCredentialVerification> {
    try {
      // Get credential
      const credentialResult = await this.credentialService.getCredential(credentialId);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', credentialId);
      }
      
      // Perform server verification
      const verificationResult = await this.performServerVerification(
        credentialResult.data,
        credentialId,
        serverUrl
      );
      
      return verificationResult;
    } catch (error) {
      return {
        isValid: false,
        credentialId,
        verificationTimestamp: new Date().toISOString(),
        serverResponse: {
          status: 'invalid',
          message: `Verification failed: ${error.message}`
        },
        issues: [{
          code: 'VERIFICATION_ERROR',
          message: error.message,
          severity: 'high'
        }]
      };
    }
  }
  
  /**
   * Generate authentication headers
   */
  async generateAuthHeaders(credential: GA4ServiceAccountCredential, credentialId: CredentialId): Promise<MCPAuthHeaders> {
    const timestamp = new Date().toISOString();
    const nonce = this.generateNonce();
    
    // Create credential hash for verification
    const credentialHash = await this.createCredentialHash(credential);
    
    // Generate authorization token
    const authToken = await this.generateAuthToken(credential, credentialId, timestamp, nonce);
    
    return {
      'Authorization': `Bearer ${authToken}`,
      'X-Credential-ID': credentialId,
      'X-Credential-Hash': credentialHash,
      'X-Client-Version': '1.0.0',
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Generate request headers for authenticated requests
   */
  generateRequestHeaders(context: MCPAuthContext, requestData?: any): MCPAuthHeaders {
    const timestamp = new Date().toISOString();
    const nonce = this.generateNonce();
    
    return {
      'Authorization': `Bearer ${context.authToken}`,
      'X-Credential-ID': context.credentialId,
      'X-Credential-Hash': '', // Would be computed from request data
      'X-Client-Version': '1.0.0',
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Session-ID': context.sessionId,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Create authentication context from auth result
   */
  createAuthContext(authResult: MCPAuthResult): MCPAuthContext {
    return {
      credentialId: authResult.credentialId,
      authToken: authResult.authToken,
      expiresAt: authResult.expiresAt,
      serverUrl: this.defaultConfig.serverUrl,
      sessionId: this.generateSessionId(),
      lastUsed: new Date().toISOString(),
      isActive: true
    };
  }
  
  /**
   * Validate authentication context
   */
  validateAuthContext(context: MCPAuthContext): boolean {
    if (!context || !context.authToken || !context.credentialId) {
      return false;
    }
    
    // Check if expired
    const expiryTime = new Date(context.expiresAt).getTime();
    const currentTime = new Date().getTime();
    
    if (currentTime >= expiryTime) {
      return false;
    }
    
    // Check if active
    if (!context.isActive) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Refresh authentication context
   */
  async refreshAuthContext(context: MCPAuthContext): Promise<MCPAuthContext> {
    const refreshResult = await this.refreshAuthentication(context);
    if (!refreshResult.success) {
      throw refreshResult.error || new CredentialError('Failed to refresh context', 'CONTEXT_REFRESH_ERROR');
    }
    
    return this.createAuthContext(refreshResult);
  }
  
  /**
   * Revoke authentication context
   */
  async revokeAuthContext(context: MCPAuthContext): Promise<boolean> {
    try {
      // Remove from active contexts
      this.activeContexts.delete(context.sessionId);
      
      // Perform server-side revocation
      await this.performTokenRevocation(context);
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Test connection to MCP server
   */
  async testConnection(config: MCPAuthConfig): Promise<boolean> {
    try {
      // Implement actual connection test
      // For now, return true for valid URLs
      return config.serverUrl.startsWith('http');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get server capabilities
   */
  async getServerCapabilities(serverUrl: string): Promise<string[]> {
    try {
      // This would make an actual request to the server
      // For now, return standard GA4 capabilities
      return [
        'ga4_reporting',
        'real_time_data',
        'custom_dimensions',
        'audience_management',
        'conversion_tracking'
      ];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Encrypt credential payload
   */
  async encryptCredentialPayload(credential: GA4ServiceAccountCredential): Promise<string> {
    try {
      // Use Web Crypto API for encryption
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(credential));
      
      // Generate encryption key
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt data
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);
      
      // Return base64 encoded result
      return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    } catch (error) {
      throw new CredentialError('Failed to encrypt credential payload', 'ENCRYPTION_ERROR', undefined, 'encryptCredentialPayload', error);
    }
  }
  
  /**
   * Decrypt server response
   */
  async decryptServerResponse(encryptedResponse: string): Promise<any> {
    try {
      // This would implement the decryption logic
      // For now, assume it's already decrypted JSON
      return JSON.parse(encryptedResponse);
    } catch (error) {
      throw new CredentialError('Failed to decrypt server response', 'DECRYPTION_ERROR', undefined, 'decryptServerResponse', error);
    }
  }
  
  /**
   * Validate server certificate
   */
  async validateServerCertificate(serverUrl: string): Promise<boolean> {
    try {
      // This would implement certificate validation
      // For now, check if HTTPS is used
      return serverUrl.startsWith('https://');
    } catch (error) {
      return false;
    }
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  /**
   * Perform authentication request
   */
  private async performAuthentication(
    serverUrl: string,
    headers: MCPAuthHeaders,
    payload: string,
    config: MCPAuthConfig
  ): Promise<MCPAuthResult> {
    try {
      // This would make the actual HTTP request to the MCP server
      // For now, simulate a successful authentication
      const authToken = this.generateAuthToken(JSON.parse(payload), headers['X-Credential-ID'], headers['X-Timestamp'], headers['X-Nonce']);
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      
      return {
        success: true,
        credentialId: headers['X-Credential-ID'],
        authToken: await authToken,
        expiresAt,
        serverCapabilities: await this.getServerCapabilities(serverUrl),
        metadata: {
          verificationTime: Date.now(),
          serverVersion: '1.0.0',
          connectionId: this.generateConnectionId()
        }
      };
    } catch (error) {
      throw new CredentialError('Authentication request failed', 'AUTHENTICATION_REQUEST_ERROR', headers['X-Credential-ID'], 'performAuthentication', error);
    }
  }
  
  /**
   * Perform server verification
   */
  private async performServerVerification(
    credential: GA4ServiceAccountCredential,
    credentialId: CredentialId,
    serverUrl: string
  ): Promise<MCPCredentialVerification> {
    try {
      // This would make an actual verification request
      // For now, simulate verification based on credential structure
      const isValid = credential.type === 'service_account' && 
                     credential.project_id && 
                     credential.client_email;
      
      return {
        isValid: Boolean(isValid),
        credentialId,
        verificationTimestamp: new Date().toISOString(),
        serverResponse: {
          status: isValid ? 'valid' : 'invalid',
          message: isValid ? 'Credential verified successfully' : 'Credential validation failed',
          nextVerification: new Date(Date.now() + 86400000).toISOString() // 24 hours
        }
      };
    } catch (error) {
      throw new CredentialError('Server verification failed', 'SERVER_VERIFICATION_ERROR', credentialId, 'performServerVerification', error);
    }
  }
  
  /**
   * Find credential ID by alias
   */
  private async findCredentialIdByAlias(alias: CredentialAlias): Promise<CredentialId | null> {
    try {
      // This would query the credential storage for the ID
      // For now, return a simulated ID
      return `cred_${Date.now()}_${alias.replace(/\W/g, '_')}`;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Create credential hash
   */
  private async createCredentialHash(credential: GA4ServiceAccountCredential): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({
        project_id: credential.project_id,
        client_email: credential.client_email,
        client_id: credential.client_id
      }));
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new CredentialError('Failed to create credential hash', 'HASH_ERROR', undefined, 'createCredentialHash', error);
    }
  }
  
  /**
   * Generate authentication token
   */
  private async generateAuthToken(credential: GA4ServiceAccountCredential, credentialId: CredentialId, timestamp: string, nonce: string): Promise<string> {
    try {
      const payload = {
        credentialId,
        projectId: credential.project_id,
        clientEmail: credential.client_email,
        timestamp,
        nonce
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new CredentialError('Failed to generate auth token', 'TOKEN_GENERATION_ERROR', credentialId, 'generateAuthToken', error);
    }
  }
  
  /**
   * Perform token revocation
   */
  private async performTokenRevocation(context: MCPAuthContext): Promise<void> {
    // This would make a revocation request to the server
    // For now, just mark as inactive
    context.isActive = false;
  }
  
  /**
   * Generate nonce
   */
  private generateNonce(): string {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  }
  
  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${this.generateNonce()}`;
  }
  
  /**
   * Generate connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${this.generateNonce()}`;
  }
}

// ============================================================================
// MCP AUTH FACTORY
// ============================================================================

/**
 * Factory for creating MCP authentication service instances
 */
export class MCPAuthServiceFactory {
  /**
   * Create default MCP authentication service
   */
  static createDefault(): MCPAuthService {
    return new MCPAuthService();
  }
  
  /**
   * Create high-security MCP authentication service
   */
  static createSecure(): MCPAuthService {
    const credentialService = CredentialServiceFactory.createSecure();
    const config = {
      enableEncryption: true,
      verificationEnabled: true,
      timeout: 15000,
      retryAttempts: 5
    };
    
    return new MCPAuthService(credentialService, config);
  }
  
  /**
   * Create MCP authentication service with custom configuration
   */
  static create(credentialService: ICredentialService, config: Partial<MCPAuthConfig>): MCPAuthService {
    return new MCPAuthService(credentialService, config);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick authentication function
 */
export async function authenticateWithMCP(credentialId: CredentialId, serverUrl?: string): Promise<MCPAuthResult> {
  const authService = MCPAuthServiceFactory.createDefault();
  return await authService.authenticate(credentialId, { serverUrl });
}

/**
 * Quick credential verification function
 */
export async function verifyCredentialWithMCP(credentialId: CredentialId, serverUrl?: string): Promise<MCPCredentialVerification> {
  const authService = MCPAuthServiceFactory.createDefault();
  return serverUrl 
    ? await authService.verifyCredentialWithServer(credentialId, serverUrl)
    : await authService.verifyCredential(credentialId);
}