/**
 * Health check utilities for MCP server monitoring
 */

import { logger } from './logger.js';
import { getAuthManager } from './googleAuth.js';
import { getTokenManager } from './tokenManager.js';
import { getCredentialRecoveryManager } from './credentialRecovery.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    authentication: HealthCheckResult;
    ga4Client: HealthCheckResult;
    lifecycle: HealthCheckResult;
    tokenManager?: HealthCheckResult;
    credentialRecovery?: HealthCheckResult;
  };
  phase3Features: {
    tokenManagement: boolean;
    credentialRecovery: boolean;
    automaticRefresh: boolean;
  };
}

export interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

export class HealthChecker {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    logger.debug('Performing health check...');

    const checks = {
      authentication: await this.checkAuthentication(),
      ga4Client: await this.checkGA4Client(),
      lifecycle: this.checkLifecycle(),
      tokenManager: await this.checkTokenManager(),
      credentialRecovery: await this.checkCredentialRecovery(),
    };

    // Check Phase 3 feature availability
    const phase3Features = this.checkPhase3Features();

    // Determine overall status
    const statuses = Object.values(checks).map(check => check.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (statuses.every(status => status === 'pass')) {
      overallStatus = 'healthy';
    } else if (statuses.some(status => status === 'fail')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Date.now() - this.startTime,
      checks,
      phase3Features,
    };

    logger.debug('Health check completed', { status: overallStatus });
    return healthStatus;
  }

  /**
   * Check authentication status
   */
  private async checkAuthentication(): Promise<HealthCheckResult> {
    try {
      const authManager = getAuthManager();
      const health = authManager.getAuthenticationHealth();

      if (health.status === 'healthy') {
        return {
          status: 'pass',
          message: 'Authentication is healthy',
          details: {
            propertyId: health.propertyId,
            isAuthenticated: health.isAuthenticated,
            hasClient: health.hasClient,
          },
        };
      } else if (health.status === 'degraded') {
        return {
          status: 'warn',
          message: 'Authentication is degraded',
          details: health,
        };
      } else {
        return {
          status: 'fail',
          message: 'Authentication is unhealthy',
          details: health,
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Authentication check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check GA4 client functionality
   */
  private async checkGA4Client(): Promise<HealthCheckResult> {
    try {
      const authManager = getAuthManager();
      
      if (!authManager.isAuthenticationValid()) {
        return {
          status: 'fail',
          message: 'GA4 client unavailable - authentication invalid',
        };
      }

      const client = authManager.getGA4Client();
      if (!client) {
        return {
          status: 'fail',
          message: 'GA4 client not initialized',
        };
      }

      // Test basic functionality with a lightweight call
      try {
        // This is a simple metadata check that shouldn't count against quota
        await client.getMetadata({
          name: `properties/${process.env.GA4_PROPERTY_ID}/metadata`,
        });

        return {
          status: 'pass',
          message: 'GA4 client is functional',
          details: { propertyId: process.env.GA4_PROPERTY_ID },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('permission') || errorMessage.includes('access')) {
          return {
            status: 'fail',
            message: 'GA4 client has no property access',
            details: { error: errorMessage },
          };
        } else {
          return {
            status: 'warn',
            message: 'GA4 client may have connectivity issues',
            details: { error: errorMessage },
          };
        }
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'GA4 client check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check lifecycle status
   */
  private checkLifecycle(): HealthCheckResult {
    try {
      // Import lifecycle manager to check status
      const { lifecycleManager } = require('./lifecycle.js');
      
      if (lifecycleManager.isServerStarted()) {
        return {
          status: 'pass',
          message: 'Server lifecycle is healthy',
          details: {
            isStarted: true,
            isShuttingDown: lifecycleManager.isServerShuttingDown(),
          },
        };
      } else {
        return {
          status: 'fail',
          message: 'Server lifecycle not started',
          details: {
            isStarted: false,
            isShuttingDown: lifecycleManager.isServerShuttingDown(),
          },
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Lifecycle check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check token manager health (Phase 3)
   */
  private async checkTokenManager(): Promise<HealthCheckResult> {
    try {
      const tokenManager = getTokenManager();
      const tokenStatus = tokenManager.getTokenStatus();
      const credentialHealth = tokenManager.getCredentialHealth();

      if (credentialHealth.isValid && tokenStatus.hasToken) {
        return {
          status: 'pass',
          message: 'Token Manager is healthy',
          details: {
            hasToken: tokenStatus.hasToken,
            isValid: credentialHealth.isValid,
            refreshCount: tokenStatus.refreshCount,
            timeUntilExpiry: credentialHealth.timeUntilExpiry
          }
        };
      } else if (tokenStatus.hasToken) {
        return {
          status: 'warn',
          message: 'Token Manager has issues',
          details: {
            hasToken: tokenStatus.hasToken,
            isValid: credentialHealth.isValid,
            needsRefresh: credentialHealth.needsRefresh,
            error: credentialHealth.error
          }
        };
      } else {
        return {
          status: 'fail',
          message: 'Token Manager has no token',
          details: tokenStatus
        };
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'Token Manager not available',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check credential recovery manager health (Phase 3)
   */
  private async checkCredentialRecovery(): Promise<HealthCheckResult> {
    try {
      const recoveryManager = getCredentialRecoveryManager();
      const diagnostics = await recoveryManager.getDiagnostics();

      if (diagnostics.hasCredentials && diagnostics.propertyAccess) {
        return {
          status: 'pass',
          message: 'Credential Recovery is healthy',
          details: {
            hasCredentials: diagnostics.hasCredentials,
            credentialType: diagnostics.credentialType,
            propertyAccess: diagnostics.propertyAccess,
            networkConnectivity: diagnostics.networkConnectivity,
            validationCount: diagnostics.validationCount
          }
        };
      } else if (diagnostics.hasCredentials) {
        return {
          status: 'warn',
          message: 'Credential Recovery has limited functionality',
          details: diagnostics
        };
      } else {
        return {
          status: 'fail',
          message: 'Credential Recovery: No credentials available',
          details: diagnostics
        };
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'Credential Recovery not available',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check Phase 3 feature availability
   */
  private checkPhase3Features(): {
    tokenManagement: boolean;
    credentialRecovery: boolean;
    automaticRefresh: boolean;
  } {
    let tokenManagement = false;
    let credentialRecovery = false;
    let automaticRefresh = false;

    try {
      const tokenManager = getTokenManager();
      tokenManagement = true;
      
      // Check if automatic refresh is working
      const tokenStatus = tokenManager.getTokenStatus();
      automaticRefresh = tokenStatus.refreshCount > 0 || tokenStatus.hasToken;
    } catch {
      // Token management not available
    }

    try {
      getCredentialRecoveryManager();
      credentialRecovery = true;
    } catch {
      // Credential recovery not available
    }

    return {
      tokenManagement,
      credentialRecovery,
      automaticRefresh
    };
  }

  /**
   * Get simple status for quick checks
   */
  getSimpleStatus(): 'ok' | 'error' {
    try {
      const authManager = getAuthManager();
      return authManager.isAuthenticationValid() ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}

// Global health checker instance
export const healthChecker = new HealthChecker();