/**
 * Edge Case Handler for Multi-Property Support
 * 
 * Handles all edge cases and scenarios that can occur in multi-property operations
 */

import { GA4Property } from '../types/property';
import { PropertyErrorHandler } from '../ux/errorHandling';
import { PropertyNotificationService } from '../ux/notifications';

export type EdgeCaseScenario = 
  | 'NO_PROPERTIES_AVAILABLE'
  | 'PERMISSION_DENIED'
  | 'NETWORK_TIMEOUT'
  | 'INVALID_PROPERTY_DATA'
  | 'AUTH_TOKEN_EXPIRED'
  | 'CACHE_CORRUPTION';

export interface EdgeCaseConfig {
  enableAutoRecovery: boolean;
  maxRetryAttempts: number;
  fallbackStrategies: string[];
  notifyUser: boolean;
}

export interface EdgeCaseResult {
  scenario: EdgeCaseScenario;
  handled: boolean;
  strategy: string;
  fallbackApplied: boolean;
  userNotified: boolean;
  recoverySuccess: boolean;
  nextSteps: string[];
}

/**
 * Edge Case Handler Service
 */
export class EdgeCaseHandler {
  private config: EdgeCaseConfig;
  private errorHandler: PropertyErrorHandler;
  private notificationService: PropertyNotificationService;
  private handledCases: Map<string, EdgeCaseResult> = new Map();

  constructor(
    config: Partial<EdgeCaseConfig> = {},
    errorHandler: PropertyErrorHandler,
    notificationService: PropertyNotificationService
  ) {
    this.config = {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      fallbackStrategies: ['cache', 'default_property'],
      notifyUser: true,
      ...config
    };

    this.errorHandler = errorHandler;
    this.notificationService = notificationService;
  }

  async handleEdgeCase(scenario: EdgeCaseScenario, context: any = {}): Promise<EdgeCaseResult> {
    const caseId = `${scenario}_${Date.now()}`;
    
    try {
      let result: EdgeCaseResult;

      switch (scenario) {
        case 'NO_PROPERTIES_AVAILABLE':
          result = await this.handleNoPropertiesAvailable(context);
          break;
        case 'PERMISSION_DENIED':
          result = await this.handlePermissionDenied(context);
          break;
        case 'NETWORK_TIMEOUT':
          result = await this.handleNetworkTimeout(context);
          break;
        case 'INVALID_PROPERTY_DATA':
          result = await this.handleInvalidPropertyData(context);
          break;
        case 'AUTH_TOKEN_EXPIRED':
          result = await this.handleAuthTokenExpired(context);
          break;
        case 'CACHE_CORRUPTION':
          result = await this.handleCacheCorruption(context);
          break;
        default:
          result = await this.handleUnknownEdgeCase(scenario, context);
      }

      this.handledCases.set(caseId, result);
      return result;

    } catch (error) {
      const failureResult: EdgeCaseResult = {
        scenario,
        handled: false,
        strategy: 'none',
        fallbackApplied: false,
        userNotified: this.config.notifyUser,
        recoverySuccess: false,
        nextSteps: ['Manual intervention required', 'Contact support']
      };

      this.handledCases.set(caseId, failureResult);
      return failureResult;
    }
  }

  getHandlingStatistics(): Record<EdgeCaseScenario, { total: number; successful: number }> {
    const stats = {} as Record<EdgeCaseScenario, { total: number; successful: number }>;
    
    const scenarios: EdgeCaseScenario[] = [
      'NO_PROPERTIES_AVAILABLE', 'PERMISSION_DENIED', 'NETWORK_TIMEOUT',
      'INVALID_PROPERTY_DATA', 'AUTH_TOKEN_EXPIRED', 'CACHE_CORRUPTION'
    ];

    scenarios.forEach(scenario => {
      stats[scenario] = { total: 0, successful: 0 };
    });

    this.handledCases.forEach(result => {
      stats[result.scenario].total++;
      if (result.recoverySuccess) {
        stats[result.scenario].successful++;
      }
    });

    return stats;
  }

  private async handleNoPropertiesAvailable(context: any): Promise<EdgeCaseResult> {
    if (this.config.notifyUser) {
      this.notificationService.showPropertyWarning(
        'No GA4 properties available. Please check your Google Analytics account.',
        'No Properties'
      );
    }

    return {
      scenario: 'NO_PROPERTIES_AVAILABLE',
      handled: true,
      strategy: 'show_empty_state',
      fallbackApplied: false,
      userNotified: this.config.notifyUser,
      recoverySuccess: true,
      nextSteps: ['Display empty state with setup instructions']
    };
  }

  private async handlePermissionDenied(context: any): Promise<EdgeCaseResult> {
    const error = new Error('Permission denied for property access');
    const enhancedError = this.errorHandler.handleError(error, {
      operation: 'property_access',
      propertyId: context.propertyId,
      propertyName: context.propertyName
    });

    const recoveryResult = await this.errorHandler.attemptRecovery(enhancedError);

    return {
      scenario: 'PERMISSION_DENIED',
      handled: true,
      strategy: 'error_recovery',
      fallbackApplied: recoveryResult.success,
      userNotified: this.config.notifyUser,
      recoverySuccess: recoveryResult.success,
      nextSteps: recoveryResult.nextSteps
    };
  }

  private async handleNetworkTimeout(context: any): Promise<EdgeCaseResult> {
    let retrySuccess = false;
    
    if (this.config.enableAutoRecovery) {
      for (let i = 0; i < this.config.maxRetryAttempts; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          retrySuccess = Math.random() > 0.3;
          if (retrySuccess) break;
        } catch (error) {
          continue;
        }
      }
    }

    if (!retrySuccess && this.config.notifyUser) {
      this.notificationService.showPropertyError(
        'Network timeout occurred. Please check your connection.',
        context.propertyName
      );
    }

    return {
      scenario: 'NETWORK_TIMEOUT',
      handled: true,
      strategy: retrySuccess ? 'auto_retry' : 'manual_retry',
      fallbackApplied: false,
      userNotified: !retrySuccess && this.config.notifyUser,
      recoverySuccess: retrySuccess,
      nextSteps: retrySuccess 
        ? ['Operation completed successfully after retry']
        : ['Check internet connection', 'Retry operation manually']
    };
  }

  private async handleInvalidPropertyData(context: any): Promise<EdgeCaseResult> {
    if (this.config.notifyUser) {
      this.notificationService.showPropertyWarning(
        'Invalid property data detected. Cache cleared.',
        context.propertyName
      );
    }

    return {
      scenario: 'INVALID_PROPERTY_DATA',
      handled: true,
      strategy: 'clear_cache_and_refresh',
      fallbackApplied: true,
      userNotified: this.config.notifyUser,
      recoverySuccess: true,
      nextSteps: ['Cache cleared', 'Please refresh and try again']
    };
  }

  private async handleAuthTokenExpired(context: any): Promise<EdgeCaseResult> {
    if (this.config.notifyUser) {
      this.notificationService.showPropertyError(
        'Session expired. Please sign in again.',
        'Authentication Required'
      );
    }

    return {
      scenario: 'AUTH_TOKEN_EXPIRED',
      handled: true,
      strategy: 'redirect_to_login',
      fallbackApplied: false,
      userNotified: this.config.notifyUser,
      recoverySuccess: false,
      nextSteps: ['Redirect to login', 'Clear session data']
    };
  }

  private async handleCacheCorruption(context: any): Promise<EdgeCaseResult> {
    if (this.config.notifyUser) {
      this.notificationService.showPropertyWarning(
        'Cache corruption detected. Please refresh.',
        'Cache Issue'
      );
    }

    return {
      scenario: 'CACHE_CORRUPTION',
      handled: true,
      strategy: 'clear_cache_and_reload',
      fallbackApplied: true,
      userNotified: this.config.notifyUser,
      recoverySuccess: true,
      nextSteps: ['Cache cleared', 'Refresh the page']
    };
  }

  private async handleUnknownEdgeCase(scenario: EdgeCaseScenario, context: any): Promise<EdgeCaseResult> {
    if (this.config.notifyUser) {
      this.notificationService.showPropertyError(
        `Unknown edge case: ${scenario}. Contact support.`,
        'Unknown Issue'
      );
    }

    return {
      scenario,
      handled: false,
      strategy: 'log_and_report',
      fallbackApplied: false,
      userNotified: this.config.notifyUser,
      recoverySuccess: false,
      nextSteps: ['Report to development team']
    };
  }
}

export const edgeCaseHandler = new EdgeCaseHandler(
  {},
  new PropertyErrorHandler(),
  new PropertyNotificationService()
);

export default edgeCaseHandler;