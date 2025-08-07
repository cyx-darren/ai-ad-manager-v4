/**
 * Permission Notifier
 * 
 * This file provides permission change notification system with priority levels,
 * customizable channels, health alerts, and notification grouping.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionErrorType
} from './permissionTypes';

import {
  PermissionErrorCategory,
  PermissionErrorSeverity
} from './permissionErrorHandler';

import {
  PermissionHealthMetrics,
  PermissionChangeEvent,
  PermissionMonitorEvent
} from './permissionMonitor';

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  INFO = 'info',
  WARNING = 'warning', 
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Notification channels
 */
export enum NotificationChannel {
  TOAST = 'toast',                    // In-app toast notifications
  BANNER = 'banner',                  // Persistent banner notifications
  MODAL = 'modal',                    // Modal dialog notifications
  SOUND = 'sound',                    // Audio notifications
  CONSOLE = 'console',                // Console logging
  CALLBACK = 'callback',              // Custom callback function
  WEBHOOK = 'webhook',                // External webhook
  EMAIL = 'email',                    // Email notifications
  PUSH = 'push'                       // Push notifications
}

/**
 * Notification delivery modes
 */
export enum NotificationDeliveryMode {
  IMMEDIATE = 'immediate',            // Send immediately
  BATCHED = 'batched',               // Group and send in batches
  THROTTLED = 'throttled',           // Limit frequency
  SILENT = 'silent',                 // Log only, no UI
  INTERACTIVE = 'interactive'        // Require user interaction
}

/**
 * Notification configuration
 */
export interface PermissionNotifierConfig {
  /** Enable notifications */
  enabled: boolean;
  /** Default notification channels */
  defaultChannels: NotificationChannel[];
  /** Channel-specific configurations */
  channelConfigs: Map<NotificationChannel, NotificationChannelConfig>;
  /** Enable notification grouping */
  enableGrouping: boolean;
  /** Grouping window in milliseconds */
  groupingWindow: number;
  /** Maximum notifications per group */
  maxNotificationsPerGroup: number;
  /** Enable notification batching */
  enableBatching: boolean;
  /** Batch size */
  batchSize: number;
  /** Batch interval in milliseconds */
  batchInterval: number;
  /** Enable throttling */
  enableThrottling: boolean;
  /** Throttle window in milliseconds */
  throttleWindow: number;
  /** Maximum notifications per throttle window */
  maxNotificationsPerWindow: number;
  /** Notification retention time */
  retentionTime: number;
  /** Enable notification history */
  enableHistory: boolean;
  /** Maximum history entries */
  maxHistoryEntries: number;
}

/**
 * Channel-specific configuration
 */
export interface NotificationChannelConfig {
  /** Enable this channel */
  enabled: boolean;
  /** Priority threshold for this channel */
  priorityThreshold: NotificationPriority;
  /** Delivery mode */
  deliveryMode: NotificationDeliveryMode;
  /** Channel-specific settings */
  settings: Record<string, any>;
  /** Custom formatter function */
  formatter?: (notification: PermissionNotification) => any;
  /** Custom delivery function */
  deliveryFunction?: (notification: PermissionNotification, config: any) => Promise<boolean>;
}

/**
 * Permission notification
 */
export interface PermissionNotification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: PermissionNotificationType;
  /** Priority level */
  priority: NotificationPriority;
  /** Title */
  title: string;
  /** Message */
  message: string;
  /** Detailed description */
  description?: string;
  /** Additional data */
  data: Record<string, any>;
  /** Target channels */
  channels: NotificationChannel[];
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Whether notification is dismissible */
  dismissible: boolean;
  /** Action buttons */
  actions: NotificationAction[];
  /** Related permission context */
  permissionContext?: {
    operation: GA4Operation;
    currentLevel: GA4PermissionLevel;
    requiredLevel: GA4PermissionLevel;
    missingScopes: GA4OAuthScope[];
  };
  /** Delivery status */
  deliveryStatus: Map<NotificationChannel, NotificationDeliveryStatus>;
  /** Group ID (if grouped) */
  groupId?: string;
  /** Batch ID (if batched) */
  batchId?: string;
}

/**
 * Notification types
 */
export enum PermissionNotificationType {
  PERMISSION_CHANGED = 'permission_changed',
  SCOPE_ADDED = 'scope_added',
  SCOPE_REMOVED = 'scope_removed',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REFRESHED = 'token_refreshed',
  HEALTH_WARNING = 'health_warning',
  HEALTH_CRITICAL = 'health_critical',
  ERROR_DETECTED = 'error_detected',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  UPGRADE_REQUIRED = 'upgrade_required'
}

/**
 * Notification action
 */
export interface NotificationAction {
  /** Action ID */
  id: string;
  /** Action label */
  label: string;
  /** Action type */
  type: 'primary' | 'secondary' | 'destructive';
  /** Action handler */
  handler: () => void | Promise<void>;
  /** Whether action dismisses notification */
  dismisses: boolean;
}

/**
 * Notification delivery status
 */
export interface NotificationDeliveryStatus {
  /** Delivery attempt timestamp */
  attemptedAt: Date;
  /** Whether delivery was successful */
  success: boolean;
  /** Error message if delivery failed */
  error?: string;
  /** Retry count */
  retryCount: number;
}

/**
 * Notification group
 */
export interface NotificationGroup {
  /** Group ID */
  id: string;
  /** Group type */
  type: PermissionNotificationType;
  /** Group priority (highest in group) */
  priority: NotificationPriority;
  /** Notifications in group */
  notifications: PermissionNotification[];
  /** Group creation time */
  createdAt: Date;
  /** Group summary */
  summary: string;
}

/**
 * Notification batch
 */
export interface NotificationBatch {
  /** Batch ID */
  id: string;
  /** Notifications in batch */
  notifications: PermissionNotification[];
  /** Batch creation time */
  createdAt: Date;
  /** Target channels */
  channels: NotificationChannel[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default notifier configuration
 */
export const DEFAULT_NOTIFIER_CONFIG: PermissionNotifierConfig = {
  enabled: true,
  defaultChannels: [NotificationChannel.TOAST, NotificationChannel.CONSOLE],
  channelConfigs: new Map([
    [NotificationChannel.TOAST, {
      enabled: true,
      priorityThreshold: NotificationPriority.INFO,
      deliveryMode: NotificationDeliveryMode.IMMEDIATE,
      settings: {
        position: 'top-right',
        duration: 5000,
        showProgress: true
      }
    }],
    [NotificationChannel.BANNER, {
      enabled: true,
      priorityThreshold: NotificationPriority.WARNING,
      deliveryMode: NotificationDeliveryMode.IMMEDIATE,
      settings: {
        position: 'top',
        persistent: true
      }
    }],
    [NotificationChannel.MODAL, {
      enabled: true,
      priorityThreshold: NotificationPriority.CRITICAL,
      deliveryMode: NotificationDeliveryMode.INTERACTIVE,
      settings: {
        blocking: true,
        backdrop: true
      }
    }],
    [NotificationChannel.CONSOLE, {
      enabled: true,
      priorityThreshold: NotificationPriority.INFO,
      deliveryMode: NotificationDeliveryMode.IMMEDIATE,
      settings: {}
    }]
  ]),
  enableGrouping: true,
  groupingWindow: 30000, // 30 seconds
  maxNotificationsPerGroup: 10,
  enableBatching: true,
  batchSize: 5,
  batchInterval: 10000, // 10 seconds
  enableThrottling: true,
  throttleWindow: 60000, // 1 minute
  maxNotificationsPerWindow: 20,
  retentionTime: 24 * 60 * 60 * 1000, // 24 hours
  enableHistory: true,
  maxHistoryEntries: 1000
};

// ============================================================================
// PERMISSION NOTIFIER CLASS
// ============================================================================

/**
 * Permission change notification system
 */
export class PermissionNotifier {
  private config: PermissionNotifierConfig;
  private notifications: Map<string, PermissionNotification> = new Map();
  private groups: Map<string, NotificationGroup> = new Map();
  private batches: Map<string, NotificationBatch> = new Map();
  private history: PermissionNotification[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private throttleCounters: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config?: Partial<PermissionNotifierConfig>) {
    this.config = { ...DEFAULT_NOTIFIER_CONFIG, ...config };
    this.startBatchTimer();
    this.startCleanupTimer();
  }

  /**
   * Send notification
   */
  public async notify(
    type: PermissionNotificationType,
    title: string,
    message: string,
    options?: Partial<PermissionNotification>
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const notification: PermissionNotification = {
      id: this.generateNotificationId(),
      type,
      priority: options?.priority || this.getDefaultPriority(type),
      title,
      message,
      description: options?.description,
      data: options?.data || {},
      channels: options?.channels || this.config.defaultChannels,
      createdAt: new Date(),
      expiresAt: options?.expiresAt,
      dismissible: options?.dismissible !== false,
      actions: options?.actions || [],
      permissionContext: options?.permissionContext,
      deliveryStatus: new Map(),
      ...options
    };

    // Check throttling
    if (this.config.enableThrottling && this.isThrottled(notification)) {
      console.warn('[PERMISSION_NOTIFIER] Notification throttled:', notification.id);
      return '';
    }

    // Add to notifications
    this.notifications.set(notification.id, notification);

    // Handle grouping
    if (this.config.enableGrouping) {
      this.handleGrouping(notification);
    }

    // Handle batching or immediate delivery
    if (this.config.enableBatching && this.shouldBatch(notification)) {
      this.addToBatch(notification);
    } else {
      await this.deliverNotification(notification);
    }

    // Add to history
    if (this.config.enableHistory) {
      this.addToHistory(notification);
    }

    console.info('[PERMISSION_NOTIFIER] Notification created:', {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title
    });

    return notification.id;
  }

  /**
   * Notify permission change
   */
  public async notifyPermissionChange(event: PermissionChangeEvent): Promise<string> {
    const title = this.getPermissionChangeTitle(event.changeType);
    const message = this.getPermissionChangeMessage(event);
    
    return this.notify(PermissionNotificationType.PERMISSION_CHANGED, title, message, {
      priority: NotificationPriority.INFO,
      data: { event },
      actions: this.getPermissionChangeActions(event)
    });
  }

  /**
   * Notify health warning
   */
  public async notifyHealthWarning(metrics: PermissionHealthMetrics): Promise<string> {
    const issues = this.identifyHealthIssues(metrics);
    const title = 'Permission Health Warning';
    const message = `${issues.length} permission health issue(s) detected`;
    
    return this.notify(PermissionNotificationType.HEALTH_WARNING, title, message, {
      priority: NotificationPriority.WARNING,
      data: { metrics, issues },
      actions: this.getHealthWarningActions(metrics)
    });
  }

  /**
   * Notify health critical
   */
  public async notifyHealthCritical(metrics: PermissionHealthMetrics): Promise<string> {
    const issues = this.identifyHealthIssues(metrics);
    const title = 'Critical Permission Issue';
    const message = 'Immediate attention required for permission system';
    
    return this.notify(PermissionNotificationType.HEALTH_CRITICAL, title, message, {
      priority: NotificationPriority.CRITICAL,
      channels: [NotificationChannel.MODAL, NotificationChannel.BANNER, NotificationChannel.CONSOLE],
      data: { metrics, issues },
      actions: this.getCriticalHealthActions(metrics)
    });
  }

  /**
   * Notify error
   */
  public async notifyError(
    errorType: PermissionErrorType,
    errorMessage: string,
    context?: Record<string, any>
  ): Promise<string> {
    const priority = this.getErrorPriority(errorType);
    const title = this.getErrorTitle(errorType);
    
    return this.notify(PermissionNotificationType.ERROR_DETECTED, title, errorMessage, {
      priority,
      data: { errorType, context },
      actions: this.getErrorActions(errorType)
    });
  }

  /**
   * Dismiss notification
   */
  public dismiss(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification || !notification.dismissible) {
      return false;
    }

    this.notifications.delete(notificationId);
    console.info('[PERMISSION_NOTIFIER] Notification dismissed:', notificationId);
    return true;
  }

  /**
   * Dismiss group
   */
  public dismissGroup(groupId: string): number {
    const group = this.groups.get(groupId);
    if (!group) {
      return 0;
    }

    let dismissedCount = 0;
    group.notifications.forEach(notification => {
      if (this.dismiss(notification.id)) {
        dismissedCount++;
      }
    });

    this.groups.delete(groupId);
    return dismissedCount;
  }

  /**
   * Get notifications
   */
  public getNotifications(filter?: {
    type?: PermissionNotificationType;
    priority?: NotificationPriority;
    active?: boolean;
  }): PermissionNotification[] {
    let notifications = Array.from(this.notifications.values());

    if (filter) {
      if (filter.type) {
        notifications = notifications.filter(n => n.type === filter.type);
      }
      if (filter.priority) {
        notifications = notifications.filter(n => n.priority === filter.priority);
      }
      if (filter.active !== undefined) {
        const now = Date.now();
        notifications = notifications.filter(n => 
          filter.active ? (!n.expiresAt || n.expiresAt.getTime() > now) 
                        : (n.expiresAt && n.expiresAt.getTime() <= now)
        );
      }
    }

    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get notification groups
   */
  public getGroups(): NotificationGroup[] {
    return Array.from(this.groups.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get notification history
   */
  public getHistory(limit?: number): PermissionNotification[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }

  /**
   * Clear all notifications
   */
  public clear(): void {
    this.notifications.clear();
    this.groups.clear();
    this.batches.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PermissionNotifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Get default priority for notification type
   */
  private getDefaultPriority(type: PermissionNotificationType): NotificationPriority {
    switch (type) {
      case PermissionNotificationType.HEALTH_CRITICAL:
      case PermissionNotificationType.AUTHENTICATION_REQUIRED:
        return NotificationPriority.CRITICAL;
      
      case PermissionNotificationType.TOKEN_EXPIRED:
      case PermissionNotificationType.HEALTH_WARNING:
      case PermissionNotificationType.ERROR_DETECTED:
      case PermissionNotificationType.UPGRADE_REQUIRED:
        return NotificationPriority.WARNING;
      
      case PermissionNotificationType.SCOPE_REMOVED:
      case PermissionNotificationType.THRESHOLD_EXCEEDED:
        return NotificationPriority.ERROR;
      
      default:
        return NotificationPriority.INFO;
    }
  }

  /**
   * Check if notification should be throttled
   */
  private isThrottled(notification: PermissionNotification): boolean {
    const key = `${notification.type}-${notification.priority}`;
    const now = Date.now();
    const counter = this.throttleCounters.get(key);

    if (!counter || now - counter.windowStart > this.config.throttleWindow) {
      this.throttleCounters.set(key, { count: 1, windowStart: now });
      return false;
    }

    if (counter.count >= this.config.maxNotificationsPerWindow) {
      return true;
    }

    counter.count++;
    return false;
  }

  /**
   * Handle notification grouping
   */
  private handleGrouping(notification: PermissionNotification): void {
    const groupKey = `${notification.type}-${notification.priority}`;
    const existingGroup = Array.from(this.groups.values())
      .find(g => g.type === notification.type && 
                 Date.now() - g.createdAt.getTime() < this.config.groupingWindow);

    if (existingGroup && existingGroup.notifications.length < this.config.maxNotificationsPerGroup) {
      existingGroup.notifications.push(notification);
      notification.groupId = existingGroup.id;
      existingGroup.summary = this.generateGroupSummary(existingGroup);
    } else {
      const newGroup: NotificationGroup = {
        id: this.generateGroupId(),
        type: notification.type,
        priority: notification.priority,
        notifications: [notification],
        createdAt: new Date(),
        summary: notification.title
      };
      
      this.groups.set(newGroup.id, newGroup);
      notification.groupId = newGroup.id;
    }
  }

  /**
   * Check if notification should be batched
   */
  private shouldBatch(notification: PermissionNotification): boolean {
    return notification.priority === NotificationPriority.INFO ||
           notification.priority === NotificationPriority.WARNING;
  }

  /**
   * Add notification to batch
   */
  private addToBatch(notification: PermissionNotification): void {
    const channelKey = notification.channels.sort().join('-');
    let batch = Array.from(this.batches.values())
      .find(b => b.channels.sort().join('-') === channelKey &&
                 b.notifications.length < this.config.batchSize);

    if (!batch) {
      batch = {
        id: this.generateBatchId(),
        notifications: [],
        createdAt: new Date(),
        channels: notification.channels
      };
      this.batches.set(batch.id, batch);
    }

    batch.notifications.push(notification);
    notification.batchId = batch.id;
  }

  /**
   * Deliver notification
   */
  private async deliverNotification(notification: PermissionNotification): Promise<void> {
    for (const channel of notification.channels) {
      const config = this.config.channelConfigs.get(channel);
      if (!config || !config.enabled) {
        continue;
      }

      // Check priority threshold
      if (this.getPriorityLevel(notification.priority) < this.getPriorityLevel(config.priorityThreshold)) {
        continue;
      }

      try {
        let success = false;
        
        if (config.deliveryFunction) {
          success = await config.deliveryFunction(notification, config.settings);
        } else {
          success = await this.deliverToChannel(notification, channel, config);
        }

        notification.deliveryStatus.set(channel, {
          attemptedAt: new Date(),
          success,
          retryCount: 0
        });

      } catch (error) {
        console.error(`[PERMISSION_NOTIFIER] Delivery error for channel ${channel}:`, error);
        notification.deliveryStatus.set(channel, {
          attemptedAt: new Date(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0
        });
      }
    }
  }

  /**
   * Deliver to specific channel
   */
  private async deliverToChannel(
    notification: PermissionNotification,
    channel: NotificationChannel,
    config: NotificationChannelConfig
  ): Promise<boolean> {
    switch (channel) {
      case NotificationChannel.CONSOLE:
        const level = this.getConsoleLevel(notification.priority);
        console[level](`[PERMISSION] ${notification.title}: ${notification.message}`, notification.data);
        return true;

      case NotificationChannel.TOAST:
        // Would integrate with actual toast library
        console.info('[TOAST]', notification.title, notification.message);
        return true;

      case NotificationChannel.BANNER:
        // Would integrate with actual banner system
        console.info('[BANNER]', notification.title, notification.message);
        return true;

      case NotificationChannel.MODAL:
        // Would integrate with actual modal system
        console.info('[MODAL]', notification.title, notification.message);
        return true;

      default:
        return false;
    }
  }

  /**
   * Get console log level for priority
   */
  private getConsoleLevel(priority: NotificationPriority): 'info' | 'warn' | 'error' {
    switch (priority) {
      case NotificationPriority.CRITICAL:
      case NotificationPriority.ERROR:
        return 'error';
      case NotificationPriority.WARNING:
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Get priority level number
   */
  private getPriorityLevel(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.INFO: return 1;
      case NotificationPriority.WARNING: return 2;
      case NotificationPriority.ERROR: return 3;
      case NotificationPriority.CRITICAL: return 4;
    }
  }

  /**
   * Process batches
   */
  private async processBatches(): Promise<void> {
    for (const [batchId, batch] of this.batches.entries()) {
      if (batch.notifications.length >= this.config.batchSize || 
          Date.now() - batch.createdAt.getTime() >= this.config.batchInterval) {
        
        // Deliver batch
        await this.deliverBatch(batch);
        this.batches.delete(batchId);
      }
    }
  }

  /**
   * Deliver notification batch
   */
  private async deliverBatch(batch: NotificationBatch): Promise<void> {
    console.info('[PERMISSION_NOTIFIER] Delivering batch:', {
      id: batch.id,
      count: batch.notifications.length,
      channels: batch.channels
    });

    for (const notification of batch.notifications) {
      await this.deliverNotification(notification);
    }
  }

  /**
   * Add notification to history
   */
  private addToHistory(notification: PermissionNotification): void {
    this.history.push({ ...notification });
    
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history.shift();
    }
  }

  /**
   * Cleanup expired notifications
   */
  private cleanup(): void {
    const now = Date.now();
    const retentionTime = this.config.retentionTime;

    // Clean notifications
    for (const [id, notification] of this.notifications.entries()) {
      if ((notification.expiresAt && notification.expiresAt.getTime() <= now) ||
          (now - notification.createdAt.getTime() > retentionTime)) {
        this.notifications.delete(id);
      }
    }

    // Clean groups
    for (const [id, group] of this.groups.entries()) {
      if (now - group.createdAt.getTime() > retentionTime) {
        this.groups.delete(id);
      }
    }

    // Clean throttle counters
    for (const [key, counter] of this.throttleCounters.entries()) {
      if (now - counter.windowStart > this.config.throttleWindow) {
        this.throttleCounters.delete(key);
      }
    }
  }

  /**
   * Generate group summary
   */
  private generateGroupSummary(group: NotificationGroup): string {
    const count = group.notifications.length;
    const type = group.type.replace('_', ' ');
    return `${count} ${type} notification${count > 1 ? 's' : ''}`;
  }

  /**
   * Get permission change title
   */
  private getPermissionChangeTitle(changeType: string): string {
    switch (changeType) {
      case 'permission_level': return 'Permission Level Changed';
      case 'scope_added': return 'New Scope Available';
      case 'scope_removed': return 'Scope Removed';
      case 'token_refreshed': return 'Token Refreshed';
      default: return 'Permission Changed';
    }
  }

  /**
   * Get permission change message
   */
  private getPermissionChangeMessage(event: PermissionChangeEvent): string {
    switch (event.changeType) {
      case 'scope_added':
        return `New OAuth scope available. ${event.affectedOperations.length} operation(s) now accessible.`;
      case 'scope_removed':
        return `OAuth scope removed. ${event.affectedOperations.length} operation(s) may be affected.`;
      case 'token_refreshed':
        return 'Authentication token has been refreshed successfully.';
      default:
        return 'Your permissions have been updated.';
    }
  }

  /**
   * Get permission change actions
   */
  private getPermissionChangeActions(event: PermissionChangeEvent): NotificationAction[] {
    return [
      {
        id: 'view-details',
        label: 'View Details',
        type: 'secondary',
        handler: () => console.log('Permission change details:', event),
        dismisses: false
      },
      {
        id: 'dismiss',
        label: 'Dismiss',
        type: 'secondary',
        handler: () => {},
        dismisses: true
      }
    ];
  }

  /**
   * Identify health issues
   */
  private identifyHealthIssues(metrics: PermissionHealthMetrics): string[] {
    const issues: string[] = [];

    if (!metrics.validity.isValid) {
      issues.push('Token is invalid or expired');
    }

    if (metrics.scopeCoverage.coverage < 0.7) {
      issues.push('Low scope coverage detected');
    }

    if (metrics.expiration.warningLevel === 'critical') {
      issues.push('Token expires very soon');
    } else if (metrics.expiration.warningLevel === 'warning') {
      issues.push('Token expires soon');
    }

    if (metrics.errors.errorRate > 0.1) {
      issues.push('High error rate detected');
    }

    return issues;
  }

  /**
   * Get health warning actions
   */
  private getHealthWarningActions(metrics: PermissionHealthMetrics): NotificationAction[] {
    const actions: NotificationAction[] = [];

    if (metrics.expiration.warningLevel !== 'none') {
      actions.push({
        id: 'refresh-token',
        label: 'Refresh Token',
        type: 'primary',
        handler: () => console.log('Refreshing token...'),
        dismisses: true
      });
    }

    if (metrics.scopeCoverage.coverage < 0.7) {
      actions.push({
        id: 'upgrade-permissions',
        label: 'Upgrade Permissions',
        type: 'primary',
        handler: () => console.log('Upgrading permissions...'),
        dismisses: true
      });
    }

    actions.push({
      id: 'view-health',
      label: 'View Health Report',
      type: 'secondary',
      handler: () => console.log('Health metrics:', metrics),
      dismisses: false
    });

    return actions;
  }

  /**
   * Get critical health actions
   */
  private getCriticalHealthActions(metrics: PermissionHealthMetrics): NotificationAction[] {
    return [
      {
        id: 'immediate-action',
        label: 'Take Immediate Action',
        type: 'primary',
        handler: () => console.log('Taking immediate action...'),
        dismisses: true
      },
      {
        id: 'contact-support',
        label: 'Contact Support',
        type: 'secondary',
        handler: () => console.log('Contacting support...'),
        dismisses: false
      }
    ];
  }

  /**
   * Get error priority
   */
  private getErrorPriority(errorType: PermissionErrorType): NotificationPriority {
    switch (errorType) {
      case PermissionErrorType.INVALID_TOKEN:
      case PermissionErrorType.INSUFFICIENT_PERMISSION:
        return NotificationPriority.CRITICAL;
      case PermissionErrorType.TOKEN_EXPIRED:
      case PermissionErrorType.INSUFFICIENT_SCOPE:
        return NotificationPriority.ERROR;
      case PermissionErrorType.RATE_LIMITED:
        return NotificationPriority.WARNING;
      default:
        return NotificationPriority.INFO;
    }
  }

  /**
   * Get error title
   */
  private getErrorTitle(errorType: PermissionErrorType): string {
    switch (errorType) {
      case PermissionErrorType.INVALID_TOKEN: return 'Invalid Token';
      case PermissionErrorType.TOKEN_EXPIRED: return 'Token Expired';
      case PermissionErrorType.INSUFFICIENT_PERMISSION: return 'Insufficient Permissions';
      case PermissionErrorType.INSUFFICIENT_SCOPE: return 'Insufficient Scope';
      case PermissionErrorType.RATE_LIMITED: return 'Rate Limited';
      case PermissionErrorType.NETWORK_ERROR: return 'Network Error';
      default: return 'Permission Error';
    }
  }

  /**
   * Get error actions
   */
  private getErrorActions(errorType: PermissionErrorType): NotificationAction[] {
    const actions: NotificationAction[] = [];

    switch (errorType) {
      case PermissionErrorType.TOKEN_EXPIRED:
      case PermissionErrorType.INVALID_TOKEN:
        actions.push({
          id: 'reauth',
          label: 'Re-authenticate',
          type: 'primary',
          handler: () => console.log('Re-authenticating...'),
          dismisses: true
        });
        break;

      case PermissionErrorType.INSUFFICIENT_PERMISSION:
      case PermissionErrorType.INSUFFICIENT_SCOPE:
        actions.push({
          id: 'upgrade',
          label: 'Upgrade Permissions',
          type: 'primary',
          handler: () => console.log('Upgrading permissions...'),
          dismisses: true
        });
        break;

      case PermissionErrorType.RATE_LIMITED:
        actions.push({
          id: 'retry-later',
          label: 'Retry Later',
          type: 'secondary',
          handler: () => console.log('Will retry later...'),
          dismisses: true
        });
        break;
    }

    return actions;
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.processBatches();
    }, this.config.batchInterval);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Generate notification ID
   */
  private generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate group ID
   */
  private generateGroupId(): string {
    return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy notifier instance
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating permission notifiers
 */
export class PermissionNotifierFactory {
  /**
   * Create standard notifier
   */
  public static createStandard(config?: Partial<PermissionNotifierConfig>): PermissionNotifier {
    return new PermissionNotifier(config);
  }

  /**
   * Create silent notifier (console only)
   */
  public static createSilent(): PermissionNotifier {
    return new PermissionNotifier({
      defaultChannels: [NotificationChannel.CONSOLE],
      enableGrouping: false,
      enableBatching: false
    });
  }

  /**
   * Create interactive notifier
   */
  public static createInteractive(): PermissionNotifier {
    return new PermissionNotifier({
      defaultChannels: [
        NotificationChannel.TOAST,
        NotificationChannel.BANNER,
        NotificationChannel.MODAL,
        NotificationChannel.CONSOLE
      ],
      enableGrouping: true,
      enableBatching: true,
      enableThrottling: false
    });
  }
}

/**
 * Create a standard permission notifier
 */
export function createPermissionNotifier(config?: Partial<PermissionNotifierConfig>): PermissionNotifier {
  return PermissionNotifierFactory.createStandard(config);
}

/**
 * Global permission notifier instance (singleton pattern)
 */
let globalPermissionNotifier: PermissionNotifier | null = null;

/**
 * Get global permission notifier instance
 */
export function getGlobalPermissionNotifier(): PermissionNotifier {
  if (!globalPermissionNotifier) {
    globalPermissionNotifier = createPermissionNotifier();
  }
  return globalPermissionNotifier;
}

/**
 * Set global permission notifier instance
 */
export function setGlobalPermissionNotifier(notifier: PermissionNotifier): void {
  if (globalPermissionNotifier) {
    globalPermissionNotifier.destroy();
  }
  globalPermissionNotifier = notifier;
}