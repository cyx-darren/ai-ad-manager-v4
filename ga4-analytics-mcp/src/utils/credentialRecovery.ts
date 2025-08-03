/**
 * Credential Validation and Recovery System
 * 
 * Handles credential validation, recovery flows, and error scenarios
 * for robust authentication management.
 */

import { logger } from './logger.js';
import { MCPErrorHandler, ErrorCode } from './errorHandler.js';
import type { GoogleAuth } from 'google-auth-library';
import type { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { TokenManager, CredentialHealth } from './tokenManager.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorType?: 'CREDENTIALS_INVALID' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'QUOTA_EXCEEDED' | 'UNKNOWN';
  canRecover: boolean;
  recoveryAction?: string;
  retryAfter?: number;
}

export interface RecoveryResult {
  success: boolean;
  recoveryAction: string;
  error?: string;
  shouldRetry: boolean;
  retryAfter?: number;
}

export interface CredentialDiagnostics {
  hasCredentials: boolean;
  credentialType: 'SERVICE_ACCOUNT_FILE' | 'ENVIRONMENT_VARIABLES' | 'NONE';
  propertyAccess: boolean;
  networkConnectivity: boolean;
  quotaStatus: 'OK' | 'NEAR_LIMIT' | 'EXCEEDED' | 'UNKNOWN';
  lastValidation: number;
  validationCount: number;
  errors: string[];
}

export class CredentialRecoveryManager {
  private tokenManager?: TokenManager;
  private auth?: GoogleAuth;
  private ga4Client?: BetaAnalyticsDataClient;
  private propertyId: string;
  private validationCount = 0;
  private lastValidation = 0;
  private recoveryAttempts = 0;
  private lastRecoveryAttempt = 0;

  // Configuration
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly RECOVERY_COOLDOWN = 30000; // 30 seconds
  private readonly VALIDATION_CACHE_DURATION = 300000; // 5 minutes
  private readonly QUOTA_RESET_HOUR = 0; // Midnight UTC

  constructor(propertyId: string) {
    this.propertyId = propertyId;
  }

  /**
   * Initialize with authentication components
   */
  initialize(tokenManager: TokenManager | undefined, auth: GoogleAuth, ga4Client: BetaAnalyticsDataClient): void {
    this.tokenManager = tokenManager;
    this.auth = auth;
    this.ga4Client = ga4Client;
    logger.info('Credential Recovery Manager initialized');
  }

  /**
   * Comprehensive credential validation
   */
  async validateCredentials(): Promise<ValidationResult> {
    this.validationCount++;
    this.lastValidation = Date.now();

    logger.debug('Starting comprehensive credential validation...');

    try {
      // Step 1: Check if we have authentication components
      if (!this.auth || !this.ga4Client) {
        return {
          isValid: false,
          error: 'Authentication components not initialized',
          errorType: 'CREDENTIALS_INVALID',
          canRecover: true,
          recoveryAction: 'Re-initialize authentication components'
        };
      }

      // Step 2: Check token validity if token manager is available
      if (this.tokenManager) {
        const tokenHealth = this.tokenManager.getCredentialHealth();
        if (!tokenHealth.isValid) {
          logger.warn('Token validation failed, attempting recovery...');
          
          const recovered = await this.tokenManager.detectAndRecoverFromExpiration();
          if (!recovered) {
            return {
              isValid: false,
              error: 'Token expired and recovery failed',
              errorType: 'CREDENTIALS_INVALID',
              canRecover: true,
              recoveryAction: 'Refresh authentication credentials'
            };
          }
        }
      }

      // Step 3: Test GA4 API access
      const apiResult = await this.testGA4APIAccess();
      if (!apiResult.isValid) {
        return apiResult;
      }

      // Step 4: Check quota status
      const quotaResult = await this.checkQuotaStatus();
      if (quotaResult.errorType === 'QUOTA_EXCEEDED') {
        return quotaResult;
      }

      logger.info('✅ Credential validation passed');
      return {
        isValid: true,
        canRecover: false
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      logger.error('❌ Credential validation failed', error instanceof Error ? error : undefined);

      return {
        isValid: false,
        error: errorMessage,
        errorType: this.categorizeError(errorMessage),
        canRecover: this.isRecoverableError(errorMessage),
        recoveryAction: this.getRecoveryAction(errorMessage)
      };
    }
  }

  /**
   * Test GA4 API access with lightweight call
   */
  private async testGA4APIAccess(): Promise<ValidationResult> {
    if (!this.ga4Client) {
      return {
        isValid: false,
        error: 'GA4 client not available',
        errorType: 'CREDENTIALS_INVALID',
        canRecover: true,
        recoveryAction: 'Initialize GA4 client'
      };
    }

    try {
      logger.debug(`Testing GA4 API access for property: ${this.propertyId}`);

      // Use getMetadata as a lightweight test
      const [response] = await this.ga4Client.getMetadata({
        name: `properties/${this.propertyId}/metadata`,
      });

      if (!response) {
        return {
          isValid: false,
          error: 'No response from GA4 API',
          errorType: 'NETWORK_ERROR',
          canRecover: true,
          recoveryAction: 'Check network connectivity'
        };
      }

      logger.debug('✅ GA4 API access test successful');
      return {
        isValid: true,
        canRecover: false
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      
      if (errorMessage.includes('not found')) {
        return {
          isValid: false,
          error: `GA4 property ${this.propertyId} not found`,
          errorType: 'PERMISSION_DENIED',
          canRecover: false,
          recoveryAction: 'Verify GA4 property ID'
        };
      }

      if (errorMessage.includes('permission') || errorMessage.includes('access')) {
        return {
          isValid: false,
          error: `No access to GA4 property ${this.propertyId}`,
          errorType: 'PERMISSION_DENIED',
          canRecover: false,
          recoveryAction: 'Grant Viewer permissions to service account'
        };
      }

      if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
        return {
          isValid: false,
          error: 'GA4 API quota exceeded',
          errorType: 'QUOTA_EXCEEDED',
          canRecover: true,
          recoveryAction: 'Wait for quota reset',
          retryAfter: this.getQuotaResetTime()
        };
      }

      return {
        isValid: false,
        error: errorMessage,
        errorType: this.categorizeError(errorMessage),
        canRecover: this.isRecoverableError(errorMessage),
        recoveryAction: this.getRecoveryAction(errorMessage)
      };
    }
  }

  /**
   * Check quota status (simplified version)
   */
  private async checkQuotaStatus(): Promise<ValidationResult> {
    // This is a simplified quota check
    // In a real implementation, you might track API calls and estimated quota usage
    
    try {
      // Could implement quota usage tracking here
      // For now, we rely on API error responses
      
      return {
        isValid: true,
        canRecover: false
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Quota check failed',
        errorType: 'UNKNOWN',
        canRecover: true,
        recoveryAction: 'Retry quota check'
      };
    }
  }

  /**
   * Attempt credential recovery
   */
  async attemptRecovery(validationResult: ValidationResult): Promise<RecoveryResult> {
    const now = Date.now();
    
    // Check recovery cooldown
    if (now - this.lastRecoveryAttempt < this.RECOVERY_COOLDOWN) {
      return {
        success: false,
        recoveryAction: 'Recovery cooldown',
        error: 'Recovery attempted too recently',
        shouldRetry: true,
        retryAfter: this.RECOVERY_COOLDOWN - (now - this.lastRecoveryAttempt)
      };
    }

    // Check maximum recovery attempts
    if (this.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
      return {
        success: false,
        recoveryAction: 'Max attempts exceeded',
        error: 'Maximum recovery attempts reached',
        shouldRetry: false
      };
    }

    this.recoveryAttempts++;
    this.lastRecoveryAttempt = now;

    logger.info(`🔄 Attempting credential recovery (attempt ${this.recoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS})`);

    try {
      switch (validationResult.errorType) {
        case 'CREDENTIALS_INVALID':
          return await this.recoverFromInvalidCredentials();
          
        case 'PERMISSION_DENIED':
          return await this.handlePermissionDenied();
          
        case 'NETWORK_ERROR':
          return await this.recoverFromNetworkError();
          
        case 'QUOTA_EXCEEDED':
          return await this.handleQuotaExceeded();
          
        default:
          return await this.genericRecovery();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown recovery error';
      logger.error('❌ Recovery attempt failed', error instanceof Error ? error : undefined);
      
      return {
        success: false,
        recoveryAction: 'Recovery failed',
        error: errorMessage,
        shouldRetry: this.recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS
      };
    }
  }

  /**
   * Recover from invalid credentials
   */
  private async recoverFromInvalidCredentials(): Promise<RecoveryResult> {
    logger.info('🔧 Attempting to recover from invalid credentials...');

    if (this.tokenManager) {
      // Try token refresh
      const refreshResult = await this.tokenManager.refreshToken();
      if (refreshResult.success) {
        logger.info('✅ Credentials recovered via token refresh');
        return {
          success: true,
          recoveryAction: 'Token refresh',
          shouldRetry: false
        };
      }

      // Try credential rotation
      const rotationResult = await this.tokenManager.handleCredentialRotation();
      if (rotationResult.success && rotationResult.rotated) {
        logger.info('✅ Credentials recovered via rotation');
        return {
          success: true,
          recoveryAction: 'Credential rotation',
          shouldRetry: false
        };
      }
    }

    return {
      success: false,
      recoveryAction: 'Invalid credentials',
      error: 'Could not recover from invalid credentials',
      shouldRetry: false
    };
  }

  /**
   * Handle permission denied errors
   */
  private async handlePermissionDenied(): Promise<RecoveryResult> {
    logger.warn('⚠️ Permission denied - cannot recover automatically');
    
    return {
      success: false,
      recoveryAction: 'Permission denied',
      error: 'Manual intervention required - check service account permissions',
      shouldRetry: false
    };
  }

  /**
   * Recover from network errors
   */
  private async recoverFromNetworkError(): Promise<RecoveryResult> {
    logger.info('🌐 Attempting to recover from network error...');

    // Simple network connectivity test
    // In a real implementation, you might test specific endpoints
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    return {
      success: true,
      recoveryAction: 'Network retry',
      shouldRetry: true,
      retryAfter: 5000
    };
  }

  /**
   * Handle quota exceeded errors
   */
  private async handleQuotaExceeded(): Promise<RecoveryResult> {
    logger.warn('📊 Quota exceeded - waiting for reset...');
    
    const retryAfter = this.getQuotaResetTime();
    
    return {
      success: false,
      recoveryAction: 'Quota exceeded',
      error: 'API quota exceeded - waiting for reset',
      shouldRetry: true,
      retryAfter
    };
  }

  /**
   * Generic recovery attempt
   */
  private async genericRecovery(): Promise<RecoveryResult> {
    logger.info('🔄 Attempting generic recovery...');

    // Basic recovery steps
    if (this.tokenManager) {
      await this.tokenManager.refreshToken();
    }

    return {
      success: true,
      recoveryAction: 'Generic recovery',
      shouldRetry: true,
      retryAfter: 10000
    };
  }

  /**
   * Get comprehensive diagnostics
   */
  async getDiagnostics(): Promise<CredentialDiagnostics> {
    const hasCredentials = !!(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
    );

    const credentialType = this.getCredentialType();
    
    // Test property access
    let propertyAccess = false;
    try {
      const result = await this.testGA4APIAccess();
      propertyAccess = result.isValid;
    } catch {
      propertyAccess = false;
    }

    // Test network connectivity (simplified)
    let networkConnectivity = true;
    try {
      // Could implement actual network test here
      networkConnectivity = true;
    } catch {
      networkConnectivity = false;
    }

    return {
      hasCredentials,
      credentialType,
      propertyAccess,
      networkConnectivity,
      quotaStatus: 'UNKNOWN', // Would need quota tracking for accurate status
      lastValidation: this.lastValidation,
      validationCount: this.validationCount,
      errors: [] // Could collect validation errors here
    };
  }

  /**
   * Reset recovery state
   */
  resetRecoveryState(): void {
    this.recoveryAttempts = 0;
    this.lastRecoveryAttempt = 0;
    logger.info('🔄 Recovery state reset');
  }

  /**
   * Categorize error type
   */
  private categorizeError(errorMessage: string): ValidationResult['errorType'] {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('credential') || message.includes('auth') || message.includes('token')) {
      return 'CREDENTIALS_INVALID';
    }
    
    if (message.includes('permission') || message.includes('access') || message.includes('forbidden')) {
      return 'PERMISSION_DENIED';
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    
    if (message.includes('quota') || message.includes('rate') || message.includes('limit')) {
      return 'QUOTA_EXCEEDED';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(errorMessage: string): boolean {
    const errorType = this.categorizeError(errorMessage);
    return errorType !== 'PERMISSION_DENIED';
  }

  /**
   * Get recovery action for error
   */
  private getRecoveryAction(errorMessage: string): string {
    const errorType = this.categorizeError(errorMessage);
    
    switch (errorType) {
      case 'CREDENTIALS_INVALID':
        return 'Refresh or rotate credentials';
      case 'PERMISSION_DENIED':
        return 'Check service account permissions';
      case 'NETWORK_ERROR':
        return 'Check network connectivity';
      case 'QUOTA_EXCEEDED':
        return 'Wait for quota reset';
      default:
        return 'Generic recovery attempt';
    }
  }

  /**
   * Get credential type
   */
  private getCredentialType(): CredentialDiagnostics['credentialType'] {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return 'SERVICE_ACCOUNT_FILE';
    }
    
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      return 'ENVIRONMENT_VARIABLES';
    }
    
    return 'NONE';
  }

  /**
   * Calculate time until quota reset
   */
  private getQuotaResetTime(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(this.QUOTA_RESET_HOUR, 0, 0, 0);
    
    return tomorrow.getTime() - now.getTime();
  }
}

// Global credential recovery manager
let globalRecoveryManager: CredentialRecoveryManager | undefined;

/**
 * Initialize global credential recovery manager
 */
export function initializeCredentialRecovery(propertyId: string): CredentialRecoveryManager {
  globalRecoveryManager = new CredentialRecoveryManager(propertyId);
  return globalRecoveryManager;
}

/**
 * Get global credential recovery manager
 */
export function getCredentialRecoveryManager(): CredentialRecoveryManager {
  if (!globalRecoveryManager) {
    throw MCPErrorHandler.authenticationFailed('Credential Recovery Manager not initialized');
  }
  return globalRecoveryManager;
}