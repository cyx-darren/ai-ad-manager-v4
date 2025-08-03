/**
 * Google Authentication utilities for GA4 MCP Server
 */

import { GoogleAuth } from 'google-auth-library';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { logger } from './logger.js';
import { MCPErrorHandler, ErrorCode } from './errorHandler.js';
import { TokenManager, initializeTokenManager, getTokenManager } from './tokenManager.js';
import { CredentialRecoveryManager, initializeCredentialRecovery, getCredentialRecoveryManager } from './credentialRecovery.js';
import type { GA4Config, GA4Credentials } from '../types/ga4.js';

export interface AuthenticationResult {
  isValid: boolean;
  client?: BetaAnalyticsDataClient;
  error?: string;
  propertyAccess?: boolean;
}

export class GoogleAuthManager {
  private ga4Client?: BetaAnalyticsDataClient;
  private auth?: GoogleAuth;
  private isAuthenticated = false;
  private propertyId: string;
  private tokenManager?: TokenManager;
  private recoveryManager?: CredentialRecoveryManager;

  constructor(propertyId: string) {
    this.propertyId = propertyId;
  }

  /**
   * Initialize Google Authentication using environment variables or credentials
   */
  async initialize(): Promise<AuthenticationResult> {
    try {
      logger.info('Initializing Google Authentication...');

      // Check if we have the required environment variables
      const authResult = await this.validateEnvironmentCredentials();
      if (!authResult.isValid) {
        return authResult;
      }

      // Initialize Google Auth
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        credentials: authResult.credentials,
      });

      // Initialize GA4 client
      this.ga4Client = new BetaAnalyticsDataClient({
        auth: this.auth,
      });

      // Initialize token manager early (before testing)
      try {
        this.tokenManager = initializeTokenManager(this.auth);
        await this.tokenManager.initialize(this.auth);
        logger.info('✅ Token Manager initialized');
      } catch (error) {
        logger.warn('⚠️ Token Manager initialization had issues', error instanceof Error ? error : undefined);
      }

      // Initialize credential recovery manager early (before testing)
      try {
        this.recoveryManager = initializeCredentialRecovery(this.propertyId);
        if (this.tokenManager) {
          this.recoveryManager.initialize(this.tokenManager, this.auth, this.ga4Client);
        } else {
          this.recoveryManager.initialize(undefined as any, this.auth, this.ga4Client);
        }
        logger.info('✅ Credential Recovery Manager initialized');
      } catch (error) {
        logger.warn('⚠️ Credential Recovery Manager initialization had issues', error instanceof Error ? error : undefined);
      }

      // Test authentication by making a simple API call
      const testResult = await this.testAuthentication();
      if (!testResult.isValid) {
        return testResult;
      }

      this.isAuthenticated = true;
      logger.info('✅ Google Authentication with Phase 3 features initialized successfully');

      return {
        isValid: true,
        client: this.ga4Client,
        propertyAccess: testResult.propertyAccess,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      logger.error('❌ Google Authentication initialization failed', error instanceof Error ? error : undefined);
      
      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate environment credentials
   */
  private async validateEnvironmentCredentials(): Promise<{ isValid: boolean; credentials?: any; error?: string }> {
    logger.debug('Validating environment credentials...');

    // Check for property ID
    if (!this.propertyId) {
      const error = 'GA4_PROPERTY_ID is required';
      logger.error(error);
      return { isValid: false, error };
    }

    // Method 1: Check for service account key file path
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (keyFilePath) {
      logger.debug('Using service account key file path');
      try {
        // The GoogleAuth library will automatically load this
        return { isValid: true, credentials: undefined }; // Let GoogleAuth handle it
      } catch (error) {
        logger.warn('Service account key file path found but invalid', error instanceof Error ? error : undefined);
      }
    }

    // Method 2: Check for individual credential environment variables
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (clientEmail && privateKey && projectId) {
      logger.debug('Using individual environment credentials');
      
      try {
        // Parse the private key (handle both raw and JSON escaped formats)
        let parsedPrivateKey = privateKey;
        if (privateKey.includes('\\n')) {
          parsedPrivateKey = privateKey.replace(/\\n/g, '\n');
        }

        const credentials = {
          client_email: clientEmail,
          private_key: parsedPrivateKey,
          project_id: projectId,
          type: 'service_account',
        };

        return { isValid: true, credentials };
      } catch (error) {
        const errorMessage = `Invalid individual credentials: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMessage);
        return { isValid: false, error: errorMessage };
      }
    }

    // No valid credentials found
    const error = 'No valid Google credentials found. Please set either:\n' +
      '1. GOOGLE_APPLICATION_CREDENTIALS (path to service account key file), or\n' +
      '2. GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_PROJECT_ID';
    
    logger.error(error);
    return { isValid: false, error };
  }

  /**
   * Test authentication by making a simple GA4 API call
   */
  private async testAuthentication(): Promise<{ isValid: boolean; propertyAccess?: boolean; error?: string }> {
    if (!this.ga4Client) {
      return { isValid: false, error: 'GA4 client not initialized' };
    }

    try {
      logger.debug(`Testing GA4 property access for property: ${this.propertyId}`);

      // Make a simple metadata request to test authentication and property access
      const [response] = await this.ga4Client.getMetadata({
        name: `properties/${this.propertyId}/metadata`,
      });

      if (response) {
        logger.info(`✅ Successfully authenticated and accessed GA4 property: ${this.propertyId}`);
        return { isValid: true, propertyAccess: true };
      } else {
        const error = 'Authentication succeeded but no metadata response received';
        logger.warn(error);
        return { isValid: false, error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('permission')) {
        logger.error(`❌ Authentication succeeded but no access to GA4 property: ${this.propertyId}`);
        return { 
          isValid: false, 
          error: `No access to GA4 property ${this.propertyId}. Please ensure the service account has Viewer permissions.`,
          propertyAccess: false 
        };
      } else if (errorMessage.includes('not found')) {
        logger.error(`❌ GA4 property not found: ${this.propertyId}`);
        return { 
          isValid: false, 
          error: `GA4 property ${this.propertyId} not found. Please check the property ID.`,
          propertyAccess: false 
        };
      } else {
        logger.error('❌ Authentication test failed', error instanceof Error ? error : undefined);
        return { isValid: false, error: errorMessage };
      }
    }
  }

  /**
   * Get the initialized GA4 client
   */
  getGA4Client(): BetaAnalyticsDataClient | undefined {
    if (!this.isAuthenticated) {
      throw MCPErrorHandler.authenticationFailed('Authentication not initialized');
    }
    return this.ga4Client;
  }

  /**
   * Check if authentication is valid
   */
  isAuthenticationValid(): boolean {
    return this.isAuthenticated && !!this.ga4Client;
  }

  /**
   * Refresh authentication (useful for long-running processes)
   */
  async refreshAuthentication(): Promise<boolean> {
    try {
      if (!this.auth) {
        logger.warn('No auth instance available for refresh');
        return false;
      }

      logger.debug('Refreshing Google authentication...');
      
      // Get fresh access token
      await this.auth.getAccessToken();
      
      logger.info('✅ Authentication refreshed successfully');
      return true;
      
    } catch (error) {
      logger.error('❌ Authentication refresh failed', error instanceof Error ? error : undefined);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Get authentication health status with Phase 3 enhancements
   */
  getAuthenticationHealth(): { 
    isAuthenticated: boolean; 
    hasClient: boolean; 
    propertyId: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    tokenStatus?: any;
    credentialHealth?: any;
  } {
    const isAuthenticated = this.isAuthenticated;
    const hasClient = !!this.ga4Client;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (isAuthenticated && hasClient) {
      status = 'healthy';
    } else if (isAuthenticated || hasClient) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // Get Phase 3 health information
    let tokenStatus;
    let credentialHealth;
    
    if (this.tokenManager) {
      tokenStatus = this.tokenManager.getTokenStatus();
      credentialHealth = this.tokenManager.getCredentialHealth();
    }

    return {
      isAuthenticated,
      hasClient,
      propertyId: this.propertyId,
      status,
      tokenStatus,
      credentialHealth,
    };
  }

  /**
   * Get token manager instance (Phase 3)
   */
  getTokenManager(): TokenManager | undefined {
    return this.tokenManager;
  }

  /**
   * Get credential recovery manager instance (Phase 3)
   */
  getCredentialRecoveryManager(): CredentialRecoveryManager | undefined {
    return this.recoveryManager;
  }

  /**
   * Validate credentials with recovery capability (Phase 3)
   */
  async validateWithRecovery(): Promise<{ isValid: boolean; recovered?: boolean; error?: string }> {
    if (!this.recoveryManager) {
      logger.warn('Credential recovery not available - falling back to basic validation');
      return { isValid: this.isAuthenticated };
    }

    try {
      const validationResult = await this.recoveryManager.validateCredentials();
      
      if (validationResult.isValid) {
        return { isValid: true };
      }

      // Attempt recovery if possible
      if (validationResult.canRecover) {
        logger.info('🔄 Credentials invalid, attempting recovery...');
        const recoveryResult = await this.recoveryManager.attemptRecovery(validationResult);
        
        if (recoveryResult.success) {
          logger.info('✅ Credential recovery successful');
          
          // Re-validate after recovery
          const revalidationResult = await this.recoveryManager.validateCredentials();
          return { 
            isValid: revalidationResult.isValid, 
            recovered: true,
            error: revalidationResult.error
          };
        } else {
          logger.error('❌ Credential recovery failed', new Error(recoveryResult.error));
          return { 
            isValid: false, 
            recovered: false,
            error: recoveryResult.error
          };
        }
      } else {
        return { 
          isValid: false, 
          error: validationResult.error || 'Credentials invalid and not recoverable'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Credential validation with recovery failed', error instanceof Error ? error : undefined);
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Get comprehensive diagnostics (Phase 3)
   */
  async getDiagnostics(): Promise<any> {
    if (!this.recoveryManager) {
      return {
        basic: this.getAuthenticationHealth(),
        phase3Available: false
      };
    }

    try {
      const diagnostics = await this.recoveryManager.getDiagnostics();
      return {
        basic: this.getAuthenticationHealth(),
        phase3Available: true,
        diagnostics
      };
    } catch (error) {
      logger.error('❌ Failed to get diagnostics', error instanceof Error ? error : undefined);
      return {
        basic: this.getAuthenticationHealth(),
        phase3Available: true,
        diagnosticsError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Global authentication manager instance
let globalAuthManager: GoogleAuthManager | undefined;

/**
 * Initialize global authentication manager
 */
export async function initializeAuthentication(): Promise<AuthenticationResult> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  
  if (!propertyId) {
    const error = 'GA4_PROPERTY_ID environment variable is required';
    logger.error(error);
    return { isValid: false, error };
  }

  globalAuthManager = new GoogleAuthManager(propertyId);
  return await globalAuthManager.initialize();
}

/**
 * Get the global authentication manager
 */
export function getAuthManager(): GoogleAuthManager {
  if (!globalAuthManager) {
    throw MCPErrorHandler.authenticationFailed('Authentication not initialized. Call initializeAuthentication() first.');
  }
  return globalAuthManager;
}

/**
 * Get authenticated GA4 client
 */
export function getGA4Client(): BetaAnalyticsDataClient {
  const authManager = getAuthManager();
  const client = authManager.getGA4Client();
  
  if (!client) {
    throw MCPErrorHandler.authenticationFailed('GA4 client not available');
  }
  
  return client;
}