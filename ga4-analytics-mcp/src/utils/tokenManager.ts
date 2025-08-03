/**
 * Advanced Token & Credential Management for GA4 MCP Server
 * 
 * This module provides secure token management, automatic refresh,
 * credential rotation, and recovery mechanisms.
 */

import { logger } from './logger.js';
import { MCPErrorHandler, ErrorCode } from './errorHandler.js';
import type { GoogleAuth } from 'google-auth-library';
import type { BetaAnalyticsDataClient } from '@google-analytics/data';

export interface TokenInfo {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // Unix timestamp
  token_type: 'Bearer';
  scope: string;
}

export interface CredentialHealth {
  isValid: boolean;
  expiresAt?: number;
  timeUntilExpiry?: number;
  needsRefresh: boolean;
  lastRefresh?: number;
  refreshCount: number;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newToken?: TokenInfo;
  error?: string;
  retryAfter?: number;
}

export interface CredentialRotationResult {
  success: boolean;
  rotated: boolean;
  newCredentials?: any;
  error?: string;
}

export class TokenManager {
  private auth?: GoogleAuth;
  private currentToken?: TokenInfo;
  private refreshTimer?: NodeJS.Timeout;
  private refreshInProgress = false;
  private refreshCount = 0;
  private lastRefreshTime = 0;
  private tokenRefreshCallbacks: Array<(token: TokenInfo | null) => void> = [];
  
  // Configuration
  private readonly REFRESH_BUFFER_MINUTES = 10; // Refresh 10 minutes before expiry
  private readonly MAX_REFRESH_RETRIES = 3;
  private readonly REFRESH_RETRY_DELAY = 5000; // 5 seconds
  private readonly MIN_REFRESH_INTERVAL = 60000; // 1 minute minimum between refreshes

  constructor(auth?: GoogleAuth) {
    this.auth = auth;
  }

  /**
   * Initialize token management with authentication context
   */
  async initialize(auth: GoogleAuth): Promise<void> {
    this.auth = auth;
    logger.info('Token Manager initialized');
    
    // Get initial token - don't throw on failure, just log
    try {
      await this.refreshToken();
      this.scheduleTokenRefresh();
      logger.info('✅ Token Manager ready with initial token');
    } catch (error) {
      logger.warn('⚠️ Token Manager initialized but could not get initial token', error instanceof Error ? error : undefined);
      // Don't throw - let the system continue so recovery mechanisms are available
    }
  }

  /**
   * Get current valid token, refreshing if necessary
   */
  async getValidToken(): Promise<TokenInfo> {
    if (!this.auth) {
      throw MCPErrorHandler.authenticationFailed('Token Manager not initialized');
    }

    // Check if current token is valid and not near expiry
    if (this.currentToken && this.isTokenValid(this.currentToken)) {
      return this.currentToken;
    }

    // Refresh token if needed
    logger.debug('Token invalid or near expiry, refreshing...');
    const refreshResult = await this.refreshToken();
    
    if (!refreshResult.success || !refreshResult.newToken) {
      throw MCPErrorHandler.authenticationFailed(
        `Token refresh failed: ${refreshResult.error}`
      );
    }

    return refreshResult.newToken;
  }

  /**
   * Manually refresh the authentication token
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    if (!this.auth) {
      return {
        success: false,
        error: 'Authentication not initialized'
      };
    }

    // Prevent concurrent refresh attempts
    if (this.refreshInProgress) {
      logger.debug('Token refresh already in progress, waiting...');
      return this.waitForRefreshCompletion();
    }

    this.refreshInProgress = true;
    logger.info('🔄 Refreshing authentication token...');

    try {
      // Get fresh access token from Google Auth
      const accessToken = await this.auth.getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token received from Google Auth');
      }

      // Create token info (Google Auth handles refresh tokens internally)
      const tokenInfo: TokenInfo = {
        access_token: accessToken,
        expires_at: Date.now() + (3600 * 1000), // 1 hour default
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/analytics.readonly'
      };

      // Try to get more accurate expiry time if available
      try {
        const credentials = await this.auth.getCredentials();
        if (credentials && typeof credentials === 'object' && 'expiry_date' in credentials) {
          const expiryDate = (credentials as any).expiry_date;
          if (typeof expiryDate === 'number') {
            tokenInfo.expires_at = expiryDate;
          }
        }
      } catch (error) {
        logger.debug('Could not get precise token expiry, using default');
      }

      this.currentToken = tokenInfo;
      this.refreshCount++;
      this.lastRefreshTime = Date.now();

      logger.info('✅ Token refreshed successfully', {
        expiresAt: new Date(tokenInfo.expires_at).toISOString(),
        refreshCount: this.refreshCount
      });

      // Notify callbacks
      this.notifyTokenRefresh(tokenInfo);

      // Schedule next refresh
      this.scheduleTokenRefresh();

      return {
        success: true,
        newToken: tokenInfo
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Token refresh failed', error instanceof Error ? error : undefined);

      // Notify callbacks of failure
      this.notifyTokenRefresh(null);

      return {
        success: false,
        error: errorMessage,
        retryAfter: this.REFRESH_RETRY_DELAY
      };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Check if a token is valid and not near expiry
   */
  private isTokenValid(token: TokenInfo): boolean {
    const now = Date.now();
    const bufferTime = this.REFRESH_BUFFER_MINUTES * 60 * 1000;
    return token.expires_at > (now + bufferTime);
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.currentToken) {
      logger.warn('No current token to schedule refresh for');
      return;
    }

    const now = Date.now();
    const expiryTime = this.currentToken.expires_at;
    const bufferTime = this.REFRESH_BUFFER_MINUTES * 60 * 1000;
    const refreshTime = expiryTime - bufferTime;
    const delay = Math.max(refreshTime - now, this.MIN_REFRESH_INTERVAL);

    logger.debug(`Scheduling token refresh in ${Math.round(delay / 1000)} seconds`);

    this.refreshTimer = setTimeout(async () => {
      logger.info('⏰ Automatic token refresh triggered');
      await this.refreshToken();
    }, delay);
  }

  /**
   * Wait for an ongoing refresh to complete
   */
  private async waitForRefreshCompletion(): Promise<TokenRefreshResult> {
    return new Promise((resolve) => {
      const checkRefresh = () => {
        if (!this.refreshInProgress) {
          if (this.currentToken) {
            resolve({ success: true, newToken: this.currentToken });
          } else {
            resolve({ success: false, error: 'Refresh completed but no token available' });
          }
        } else {
          setTimeout(checkRefresh, 100);
        }
      };
      checkRefresh();
    });
  }

  /**
   * Get comprehensive credential health information
   */
  getCredentialHealth(): CredentialHealth {
    if (!this.currentToken) {
      return {
        isValid: false,
        needsRefresh: true,
        refreshCount: this.refreshCount,
        error: 'No token available'
      };
    }

    const now = Date.now();
    const expiresAt = this.currentToken.expires_at;
    const timeUntilExpiry = expiresAt - now;
    const bufferTime = this.REFRESH_BUFFER_MINUTES * 60 * 1000;
    const needsRefresh = timeUntilExpiry <= bufferTime;

    return {
      isValid: timeUntilExpiry > 0,
      expiresAt,
      timeUntilExpiry,
      needsRefresh,
      lastRefresh: this.lastRefreshTime || undefined,
      refreshCount: this.refreshCount
    };
  }

  /**
   * Detect token expiration and handle recovery
   */
  async detectAndRecoverFromExpiration(): Promise<boolean> {
    const health = this.getCredentialHealth();
    
    if (!health.isValid) {
      logger.warn('⚠️ Token expired, attempting recovery...');
      
      const refreshResult = await this.refreshToken();
      if (refreshResult.success) {
        logger.info('✅ Successfully recovered from token expiration');
        return true;
      } else {
        logger.error('❌ Failed to recover from token expiration', new Error(refreshResult.error));
        return false;
      }
    }

    if (health.needsRefresh) {
      logger.info('🔄 Token near expiry, proactively refreshing...');
      await this.refreshToken();
    }

    return true;
  }

  /**
   * Handle credential rotation (mainly for service account keys)
   */
  async handleCredentialRotation(): Promise<CredentialRotationResult> {
    logger.info('🔄 Checking for credential rotation...');

    try {
      // For service account authentication, rotation typically means:
      // 1. New service account key files
      // 2. Updated environment variables
      // 3. New project configurations

      // Check if environment variables have changed
      const currentCredentials = this.getCurrentCredentialFingerprint();
      
      // This is a placeholder for credential rotation logic
      // In a real implementation, you might:
      // - Check for new credential files
      // - Compare credential fingerprints
      // - Reload from updated environment variables
      // - Validate new credentials before switching

      return {
        success: true,
        rotated: false, // No rotation needed in this implementation
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Credential rotation check failed', error instanceof Error ? error : undefined);
      
      return {
        success: false,
        rotated: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get a fingerprint of current credentials for rotation detection
   */
  private getCurrentCredentialFingerprint(): string {
    // Create a hash of current credential configuration
    const credentialData = {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
      projectId: process.env.GOOGLE_PROJECT_ID || '',
      applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
      // Don't include private key in fingerprint for security
    };

    return Buffer.from(JSON.stringify(credentialData)).toString('base64');
  }

  /**
   * Add callback for token refresh notifications
   */
  onTokenRefresh(callback: (token: TokenInfo | null) => void): void {
    this.tokenRefreshCallbacks.push(callback);
  }

  /**
   * Remove token refresh callback
   */
  removeTokenRefreshCallback(callback: (token: TokenInfo | null) => void): void {
    const index = this.tokenRefreshCallbacks.indexOf(callback);
    if (index > -1) {
      this.tokenRefreshCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all callbacks of token refresh
   */
  private notifyTokenRefresh(token: TokenInfo | null): void {
    this.tokenRefreshCallbacks.forEach(callback => {
      try {
        callback(token);
      } catch (error) {
        logger.warn('Token refresh callback error', error instanceof Error ? error : undefined);
      }
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    
    this.tokenRefreshCallbacks = [];
    this.currentToken = undefined;
    this.refreshInProgress = false;
    
    logger.info('Token Manager cleaned up');
  }

  /**
   * Get token status for health checks
   */
  getTokenStatus(): {
    hasToken: boolean;
    isValid: boolean;
    expiresIn: number;
    refreshCount: number;
    lastRefresh: number;
  } {
    const health = this.getCredentialHealth();
    
    return {
      hasToken: !!this.currentToken,
      isValid: health.isValid,
      expiresIn: health.timeUntilExpiry || 0,
      refreshCount: this.refreshCount,
      lastRefresh: this.lastRefreshTime
    };
  }
}

// Global token manager instance
let globalTokenManager: TokenManager | undefined;

/**
 * Initialize global token manager
 */
export function initializeTokenManager(auth: GoogleAuth): TokenManager {
  globalTokenManager = new TokenManager(auth);
  return globalTokenManager;
}

/**
 * Get global token manager
 */
export function getTokenManager(): TokenManager {
  if (!globalTokenManager) {
    throw MCPErrorHandler.authenticationFailed('Token Manager not initialized');
  }
  return globalTokenManager;
}

/**
 * Clean up global token manager
 */
export function cleanupTokenManager(): void {
  if (globalTokenManager) {
    globalTokenManager.cleanup();
    globalTokenManager = undefined;
  }
}