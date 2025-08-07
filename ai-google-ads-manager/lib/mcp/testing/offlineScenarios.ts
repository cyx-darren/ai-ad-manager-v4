/**
 * Offline Scenarios Handler for Multi-Property Support
 */

import { GA4Property } from '../types/property';
import { PropertyErrorHandler } from '../ux/errorHandling';
import { PropertyNotificationService } from '../ux/notifications';

export type OfflineScenario = 
  | 'COMPLETE_OFFLINE'
  | 'INTERMITTENT_CONNECTION'
  | 'SLOW_CONNECTION'
  | 'API_RATE_LIMITED';

export interface OfflineConfig {
  enableOfflineMode: boolean;
  cacheValidityPeriod: number;
  maxOfflineActions: number;
  syncWhenOnline: boolean;
  showOfflineIndicator: boolean;
}

export interface OfflineState {
  isOnline: boolean;
  lastOnlineTime: Date;
  queuedActions: OfflineAction[];
  cachedProperties: GA4Property[];
  offlineCapabilities: string[];
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export interface OfflineResult {
  scenario: OfflineScenario;
  handled: boolean;
  offlineMode: boolean;
  actionsQueued: number;
  cacheUsed: boolean;
  userNotified: boolean;
  capabilities: string[];
}

/**
 * Offline Scenarios Handler
 */
export class OfflineScenariosHandler {
  private config: OfflineConfig;
  private errorHandler: PropertyErrorHandler;
  private notificationService: PropertyNotificationService;
  private offlineState: OfflineState;

  constructor(
    config: Partial<OfflineConfig> = {},
    errorHandler: PropertyErrorHandler,
    notificationService: PropertyNotificationService
  ) {
    this.config = {
      enableOfflineMode: true,
      cacheValidityPeriod: 24,
      maxOfflineActions: 50,
      syncWhenOnline: true,
      showOfflineIndicator: true,
      ...config
    };

    this.errorHandler = errorHandler;
    this.notificationService = notificationService;
    
    this.offlineState = {
      isOnline: navigator.onLine,
      lastOnlineTime: new Date(),
      queuedActions: [],
      cachedProperties: [],
      offlineCapabilities: [
        'view_cached_properties',
        'switch_cached_properties',
        'view_cached_metrics',
        'queue_actions_for_sync'
      ]
    };

    this.initializeConnectionMonitoring();
  }

  async handleOfflineScenario(scenario: OfflineScenario, context: any = {}): Promise<OfflineResult> {
    try {
      let result: OfflineResult;

      switch (scenario) {
        case 'COMPLETE_OFFLINE':
          result = await this.handleCompleteOffline(context);
          break;
        case 'INTERMITTENT_CONNECTION':
          result = await this.handleIntermittentConnection(context);
          break;
        case 'SLOW_CONNECTION':
          result = await this.handleSlowConnection(context);
          break;
        case 'API_RATE_LIMITED':
          result = await this.handleApiRateLimited(context);
          break;
        default:
          result = await this.handleUnknownOfflineScenario(scenario, context);
      }

      return result;

    } catch (error) {
      console.error('Error handling offline scenario:', error);
      
      return {
        scenario,
        handled: false,
        offlineMode: false,
        actionsQueued: 0,
        cacheUsed: false,
        userNotified: false,
        capabilities: []
      };
    }
  }

  queueAction(type: string, payload: any, maxRetries: number = 3): void {
    if (this.offlineState.queuedActions.length >= this.config.maxOfflineActions) {
      this.offlineState.queuedActions.shift();
    }

    const action: OfflineAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries
    };

    this.offlineState.queuedActions.push(action);
  }

  async processQueuedActions(): Promise<{ success: number; failed: number }> {
    if (!this.offlineState.isOnline || this.offlineState.queuedActions.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    const actionsToProcess = [...this.offlineState.queuedActions];
    this.offlineState.queuedActions = [];

    for (const action of actionsToProcess) {
      try {
        await this.executeQueuedAction(action);
        success++;
      } catch (error) {
        action.retryCount++;
        
        if (action.retryCount < action.maxRetries) {
          this.offlineState.queuedActions.push(action);
        } else {
          failed++;
        }
      }
    }

    if (success > 0 || failed > 0) {
      this.notificationService.showPropertySuccess(
        `Sync complete: ${success} successful, ${failed} failed actions`,
        'Offline Sync'
      );
    }

    return { success, failed };
  }

  getOfflineCapabilities(): string[] {
    return [...this.offlineState.offlineCapabilities];
  }

  isCapabilityAvailable(capability: string): boolean {
    return this.offlineState.offlineCapabilities.includes(capability);
  }

  private async handleCompleteOffline(context: any): Promise<OfflineResult> {
    this.offlineState.isOnline = false;

    if (this.config.showOfflineIndicator) {
      this.notificationService.showPropertyWarning(
        'You are offline. Using cached data.',
        'Offline Mode'
      );
    }

    return {
      scenario: 'COMPLETE_OFFLINE',
      handled: true,
      offlineMode: true,
      actionsQueued: 0,
      cacheUsed: this.offlineState.cachedProperties.length > 0,
      userNotified: this.config.showOfflineIndicator,
      capabilities: this.getOfflineCapabilities()
    };
  }

  private async handleIntermittentConnection(context: any): Promise<OfflineResult> {
    const queuedCount = this.offlineState.queuedActions.length;
    
    if (context.action) {
      this.queueAction(context.action.type, context.action.payload);
    }

    this.notificationService.showPropertyWarning(
      'Unstable connection. Actions will be retried.',
      'Connection Issues'
    );

    return {
      scenario: 'INTERMITTENT_CONNECTION',
      handled: true,
      offlineMode: false,
      actionsQueued: this.offlineState.queuedActions.length - queuedCount,
      cacheUsed: true,
      userNotified: true,
      capabilities: ['queue_actions', 'auto_retry', 'cache_fallback']
    };
  }

  private async handleSlowConnection(context: any): Promise<OfflineResult> {
    this.notificationService.showPropertyWarning(
      'Slow connection. Using cached data.',
      'Slow Connection'
    );

    return {
      scenario: 'SLOW_CONNECTION',
      handled: true,
      offlineMode: false,
      actionsQueued: 0,
      cacheUsed: true,
      userNotified: true,
      capabilities: ['cache_priority', 'reduced_requests']
    };
  }

  private async handleApiRateLimited(context: any): Promise<OfflineResult> {
    const retryAfter = context.retryAfter || 60;
    
    this.notificationService.showPropertyWarning(
      `Rate limit reached. Retry in ${retryAfter}s.`,
      'Rate Limited'
    );

    if (context.action) {
      setTimeout(() => {
        this.queueAction(context.action.type, context.action.payload);
      }, retryAfter * 1000);
    }

    return {
      scenario: 'API_RATE_LIMITED',
      handled: true,
      offlineMode: false,
      actionsQueued: 1,
      cacheUsed: true,
      userNotified: true,
      capabilities: ['cache_only', 'delayed_retry']
    };
  }

  private async handleUnknownOfflineScenario(scenario: OfflineScenario, context: any): Promise<OfflineResult> {
    this.notificationService.showPropertyError(
      `Unknown offline scenario: ${scenario}`,
      'Unknown Issue'
    );

    return {
      scenario,
      handled: false,
      offlineMode: false,
      actionsQueued: 0,
      cacheUsed: false,
      userNotified: true,
      capabilities: []
    };
  }

  private initializeConnectionMonitoring(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.offlineState.isOnline = true;
      this.offlineState.lastOnlineTime = new Date();
      
      if (this.config.syncWhenOnline) {
        this.processQueuedActions();
      }
      
      this.notificationService.showPropertySuccess(
        'Connection restored. Syncing...',
        'Back Online'
      );
    });

    window.addEventListener('offline', () => {
      this.offlineState.isOnline = false;
      this.handleOfflineScenario('COMPLETE_OFFLINE');
    });
  }

  private async executeQueuedAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'property_switch':
        break;
      case 'data_refresh':
        break;
      case 'settings_update':
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}

export const offlineScenariosHandler = new OfflineScenariosHandler(
  {},
  new PropertyErrorHandler(),
  new PropertyNotificationService()
);

export default offlineScenariosHandler;