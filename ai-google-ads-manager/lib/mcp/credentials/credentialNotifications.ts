/**
 * Credential Update Notifications
 * 
 * This file implements credential update notifications,
 * event management, and communication channels.
 */

import {
  CredentialId,
  CredentialAlias,
  CredentialOperationResult,
  CredentialError
} from './types';

import {
  CredentialRotationEvent,
  CredentialRotationRecord
} from './credentialRotation';

import {
  MonitoringAlert,
  MonitoringAlertSeverity
} from './credentialMonitoring';

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Notification event types
 */
export type NotificationEventType = 
  | 'credential_added'
  | 'credential_updated'  
  | 'credential_removed'
  | 'credential_expired'
  | 'credential_expiring'
  | 'credential_rotated'
  | 'credential_rotation_failed'
  | 'credential_refresh_completed'
  | 'credential_refresh_failed'
  | 'credential_health_degraded'
  | 'credential_connectivity_lost'
  | 'credential_usage_anomaly'
  | 'system_maintenance'
  | 'security_alert'
  | 'custom_notification';

/**
 * Notification channel types
 */
export type NotificationChannelType = 
  | 'email'
  | 'sms'
  | 'webhook'
  | 'slack'
  | 'teams'
  | 'discord'
  | 'pagerduty'
  | 'pushover'
  | 'telegram'
  | 'custom';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  channelId: string;
  type: NotificationChannelType;
  name: string;
  enabled: boolean;
  
  // Channel-specific configuration
  config: {
    // Email
    emailAddress?: string;
    smtpServer?: string;
    
    // SMS
    phoneNumber?: string;
    smsProvider?: string;
    
    // Webhook
    webhookUrl?: string;
    headers?: Record<string, string>;
    method?: 'POST' | 'PUT' | 'PATCH';
    
    // Slack
    slackWebhookUrl?: string;
    slackChannel?: string;
    slackToken?: string;
    
    // Teams
    teamsWebhookUrl?: string;
    
    // PagerDuty
    pagerDutyIntegrationKey?: string;
    pagerDutyServiceKey?: string;
    
    // Custom
    customEndpoint?: string;
    customAuth?: Record<string, string>;
    
    [key: string]: any;
  };
  
  // Filtering and routing
  eventFilter: NotificationEventType[];
  priorityFilter: NotificationPriority[];
  credentialFilter?: CredentialId[];
  severityFilter?: MonitoringAlertSeverity[];
  
  // Delivery settings
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  
  // Rate limiting
  rateLimitEnabled: boolean;
  maxNotificationsPerHour: number;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    timezone: string;
  };
  
  // Template settings
  templateId?: string;
  customTemplate?: string;
  
  metadata?: Record<string, any>;
}

/**
 * Notification message
 */
export interface NotificationMessage {
  messageId: string;
  eventType: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  
  // Context data
  credentialId?: CredentialId;
  credentialAlias?: CredentialAlias;
  eventData?: Record<string, any>;
  
  // Delivery tracking
  channelId: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  deliveryAttempts: number;
  lastAttempt?: string;
  deliveredAt?: string;
  failureReason?: string;
  
  // Content details
  contentType: 'text' | 'html' | 'markdown' | 'json';
  attachments?: NotificationAttachment[];
  actions?: NotificationAction[];
  
  metadata?: Record<string, any>;
}

/**
 * Notification attachment
 */
export interface NotificationAttachment {
  attachmentId: string;
  type: 'file' | 'image' | 'url' | 'data';
  name: string;
  content: string | Buffer;
  mimeType?: string;
  size?: number;
}

/**
 * Notification action
 */
export interface NotificationAction {
  actionId: string;
  type: 'button' | 'link' | 'command';
  label: string;
  url?: string;
  command?: string;
  style?: 'default' | 'primary' | 'danger';
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  templateId: string;
  name: string;
  eventType: NotificationEventType;
  channelType: NotificationChannelType;
  
  // Template content
  titleTemplate: string;
  messageTemplate: string;
  subjectTemplate?: string; // For email
  
  // Template variables
  variables: string[];
  defaultValues?: Record<string, string>;
  
  // Formatting
  contentType: 'text' | 'html' | 'markdown' | 'json';
  formatting?: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    styles?: Record<string, string>;
  };
  
  created: string;
  updated: string;
  version: string;
}

/**
 * Notification delivery result
 */
export interface NotificationDeliveryResult extends CredentialOperationResult<boolean> {
  messageId: string;
  channelId: string;
  deliveryTime?: string;
  response?: any;
  retryCount?: number;
}

/**
 * Notification statistics
 */
export interface NotificationStatistics {
  totalNotifications: number;
  sentNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  
  byEventType: Record<NotificationEventType, number>;
  byChannel: Record<string, number>;
  byPriority: Record<NotificationPriority, number>;
  
  deliveryRates: {
    overall: number;
    byChannel: Record<string, number>;
    byEventType: Record<NotificationEventType, number>;
  };
  
  performanceMetrics: {
    averageDeliveryTime: number;
    averageRetryCount: number;
    errorRate: number;
  };
  
  lastUpdated: string;
}

// ============================================================================
// NOTIFICATION SERVICE INTERFACE
// ============================================================================

/**
 * Interface for notification operations
 */
export interface ICredentialNotificationService {
  // Channel management
  addChannel(channel: NotificationChannel): Promise<CredentialOperationResult<string>>;
  getChannel(channelId: string): Promise<CredentialOperationResult<NotificationChannel>>;
  updateChannel(channelId: string, updates: Partial<NotificationChannel>): Promise<CredentialOperationResult<boolean>>;
  removeChannel(channelId: string): Promise<CredentialOperationResult<boolean>>;
  listChannels(): Promise<CredentialOperationResult<NotificationChannel[]>>;
  testChannel(channelId: string): Promise<NotificationDeliveryResult>;
  
  // Template management
  addTemplate(template: NotificationTemplate): Promise<CredentialOperationResult<string>>;
  getTemplate(templateId: string): Promise<CredentialOperationResult<NotificationTemplate>>;
  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<CredentialOperationResult<boolean>>;
  removeTemplate(templateId: string): Promise<CredentialOperationResult<boolean>>;
  listTemplates(): Promise<CredentialOperationResult<NotificationTemplate[]>>;
  
  // Notification operations
  sendNotification(eventType: NotificationEventType, eventData: any, priority?: NotificationPriority): Promise<CredentialOperationResult<string[]>>;
  sendCustomNotification(message: Partial<NotificationMessage>, channelIds?: string[]): Promise<CredentialOperationResult<string[]>>;
  resendNotification(messageId: string): Promise<NotificationDeliveryResult>;
  cancelNotification(messageId: string): Promise<CredentialOperationResult<boolean>>;
  
  // Message tracking
  getMessage(messageId: string): Promise<CredentialOperationResult<NotificationMessage>>;
  getMessages(filter?: Partial<NotificationMessage>): Promise<CredentialOperationResult<NotificationMessage[]>>;
  getDeliveryStatus(messageId: string): Promise<CredentialOperationResult<NotificationMessage['deliveryStatus']>>;
  
  // Statistics and reporting
  getStatistics(timeRange?: { start: string; end: string }): Promise<CredentialOperationResult<NotificationStatistics>>;
  generateDeliveryReport(channelId?: string): Promise<CredentialOperationResult<any>>;
  
  // Event subscriptions
  subscribeToCredentialEvents(credentialId: CredentialId, eventTypes: NotificationEventType[], channelIds: string[]): Promise<CredentialOperationResult<string>>;
  unsubscribeFromCredentialEvents(subscriptionId: string): Promise<CredentialOperationResult<boolean>>;
  listSubscriptions(): Promise<CredentialOperationResult<any[]>>;
  
  // Integration with other services
  handleRotationEvent(event: CredentialRotationEvent, data: any): Promise<void>;
  handleMonitoringAlert(alert: MonitoringAlert): Promise<void>;
  handleRefreshEvent(event: string, data: any): Promise<void>;
  
  // Event handling
  onNotificationEvent(callback: (event: string, data: any) => void): void;
  emitNotificationEvent(event: string, data: any): void;
}

// ============================================================================
// NOTIFICATION SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Credential notification service implementation
 */
export class CredentialNotificationService implements ICredentialNotificationService {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private messages: Map<string, NotificationMessage> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private deliveryQueue: NotificationMessage[] = [];
  private isProcessingQueue: boolean = false;
  
  // Rate limiting tracking
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();
  
  // Event handlers
  private notificationEventHandlers: Array<(event: string, data: any) => void> = [];
  
  constructor() {
    this.initializeDefaultTemplates();
    this.startQueueProcessor();
  }
  
  /**
   * Add notification channel
   */
  async addChannel(channel: NotificationChannel): Promise<CredentialOperationResult<string>> {
    try {
      this.validateChannel(channel);
      
      const channelId = channel.channelId || this.generateChannelId();
      const fullChannel = { ...channel, channelId };
      
      this.channels.set(channelId, fullChannel);
      
      this.emitNotificationEvent('channel_added', { channelId, channel: fullChannel });
      
      return {
        success: true,
        data: channelId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to add channel', 'ADD_CHANNEL_ERROR', undefined, 'addChannel', error)
      };
    }
  }
  
  /**
   * Get notification channel
   */
  async getChannel(channelId: string): Promise<CredentialOperationResult<NotificationChannel>> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new CredentialError('Channel not found', 'CHANNEL_NOT_FOUND');
      }
      
      return {
        success: true,
        data: channel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get channel', 'GET_CHANNEL_ERROR', undefined, 'getChannel', error)
      };
    }
  }
  
  /**
   * Update notification channel
   */
  async updateChannel(channelId: string, updates: Partial<NotificationChannel>): Promise<CredentialOperationResult<boolean>> {
    try {
      const existingChannel = this.channels.get(channelId);
      if (!existingChannel) {
        throw new CredentialError('Channel not found', 'CHANNEL_NOT_FOUND');
      }
      
      const updatedChannel = { ...existingChannel, ...updates };
      this.validateChannel(updatedChannel);
      
      this.channels.set(channelId, updatedChannel);
      
      this.emitNotificationEvent('channel_updated', { channelId, updates });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update channel', 'UPDATE_CHANNEL_ERROR', undefined, 'updateChannel', error)
      };
    }
  }
  
  /**
   * Remove notification channel
   */
  async removeChannel(channelId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const removed = this.channels.delete(channelId);
      if (!removed) {
        throw new CredentialError('Channel not found', 'CHANNEL_NOT_FOUND');
      }
      
      this.emitNotificationEvent('channel_removed', { channelId });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove channel', 'REMOVE_CHANNEL_ERROR', undefined, 'removeChannel', error)
      };
    }
  }
  
  /**
   * List notification channels
   */
  async listChannels(): Promise<CredentialOperationResult<NotificationChannel[]>> {
    try {
      const channels = Array.from(this.channels.values());
      
      return {
        success: true,
        data: channels
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list channels', 'LIST_CHANNELS_ERROR', undefined, 'listChannels', error)
      };
    }
  }
  
  /**
   * Test notification channel
   */
  async testChannel(channelId: string): Promise<NotificationDeliveryResult> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new CredentialError('Channel not found', 'CHANNEL_NOT_FOUND');
      }
      
      const testMessage: Partial<NotificationMessage> = {
        eventType: 'custom_notification',
        priority: 'normal',
        title: 'Test Notification',
        message: `This is a test notification for channel: ${channel.name}`,
        contentType: 'text'
      };
      
      const deliveryResult = await this.deliverMessage(testMessage as NotificationMessage, channel);
      
      return {
        success: deliveryResult.success,
        data: deliveryResult.success,
        messageId: testMessage.messageId!,
        channelId,
        deliveryTime: deliveryResult.success ? new Date().toISOString() : undefined,
        error: deliveryResult.error
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        messageId: '',
        channelId,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Channel test failed', 'CHANNEL_TEST_ERROR', undefined, 'testChannel', error)
      };
    }
  }
  
  /**
   * Add notification template
   */
  async addTemplate(template: NotificationTemplate): Promise<CredentialOperationResult<string>> {
    try {
      this.validateTemplate(template);
      
      const templateId = template.templateId || this.generateTemplateId();
      const fullTemplate = { 
        ...template, 
        templateId,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0'
      };
      
      this.templates.set(templateId, fullTemplate);
      
      this.emitNotificationEvent('template_added', { templateId, template: fullTemplate });
      
      return {
        success: true,
        data: templateId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to add template', 'ADD_TEMPLATE_ERROR', undefined, 'addTemplate', error)
      };
    }
  }
  
  /**
   * Get notification template
   */
  async getTemplate(templateId: string): Promise<CredentialOperationResult<NotificationTemplate>> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new CredentialError('Template not found', 'TEMPLATE_NOT_FOUND');
      }
      
      return {
        success: true,
        data: template
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get template', 'GET_TEMPLATE_ERROR', undefined, 'getTemplate', error)
      };
    }
  }
  
  /**
   * Update notification template
   */
  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<CredentialOperationResult<boolean>> {
    try {
      const existingTemplate = this.templates.get(templateId);
      if (!existingTemplate) {
        throw new CredentialError('Template not found', 'TEMPLATE_NOT_FOUND');
      }
      
      const updatedTemplate = { 
        ...existingTemplate, 
        ...updates,
        updated: new Date().toISOString()
      };
      
      this.validateTemplate(updatedTemplate);
      this.templates.set(templateId, updatedTemplate);
      
      this.emitNotificationEvent('template_updated', { templateId, updates });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update template', 'UPDATE_TEMPLATE_ERROR', undefined, 'updateTemplate', error)
      };
    }
  }
  
  /**
   * Remove notification template
   */
  async removeTemplate(templateId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const removed = this.templates.delete(templateId);
      if (!removed) {
        throw new CredentialError('Template not found', 'TEMPLATE_NOT_FOUND');
      }
      
      this.emitNotificationEvent('template_removed', { templateId });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove template', 'REMOVE_TEMPLATE_ERROR', undefined, 'removeTemplate', error)
      };
    }
  }
  
  /**
   * List notification templates
   */
  async listTemplates(): Promise<CredentialOperationResult<NotificationTemplate[]>> {
    try {
      const templates = Array.from(this.templates.values());
      
      return {
        success: true,
        data: templates
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list templates', 'LIST_TEMPLATES_ERROR', undefined, 'listTemplates', error)
      };
    }
  }
  
  /**
   * Send notification
   */
  async sendNotification(eventType: NotificationEventType, eventData: any, priority: NotificationPriority = 'normal'): Promise<CredentialOperationResult<string[]>> {
    try {
      const matchingChannels = this.getMatchingChannels(eventType, priority, eventData.credentialId);
      const messageIds: string[] = [];
      
      for (const channel of matchingChannels) {
        const message = await this.createMessage(eventType, eventData, priority, channel);
        await this.queueMessage(message);
        messageIds.push(message.messageId);
      }
      
      this.emitNotificationEvent('notification_sent', { 
        eventType, 
        eventData, 
        priority, 
        messageIds,
        channelCount: matchingChannels.length 
      });
      
      return {
        success: true,
        data: messageIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to send notification', 'SEND_NOTIFICATION_ERROR', undefined, 'sendNotification', error)
      };
    }
  }
  
  /**
   * Send custom notification
   */
  async sendCustomNotification(message: Partial<NotificationMessage>, channelIds?: string[]): Promise<CredentialOperationResult<string[]>> {
    try {
      const targetChannels = channelIds 
        ? channelIds.map(id => this.channels.get(id)).filter(Boolean) as NotificationChannel[]
        : Array.from(this.channels.values());
      
      const messageIds: string[] = [];
      
      for (const channel of targetChannels) {
        const fullMessage = this.createFullMessage(message, channel);
        await this.queueMessage(fullMessage);
        messageIds.push(fullMessage.messageId);
      }
      
      this.emitNotificationEvent('custom_notification_sent', { 
        message, 
        channelIds: channelIds || [], 
        messageIds 
      });
      
      return {
        success: true,
        data: messageIds
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to send custom notification', 'SEND_CUSTOM_NOTIFICATION_ERROR', undefined, 'sendCustomNotification', error)
      };
    }
  }
  
  /**
   * Resend notification
   */
  async resendNotification(messageId: string): Promise<NotificationDeliveryResult> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        throw new CredentialError('Message not found', 'MESSAGE_NOT_FOUND');
      }
      
      const channel = this.channels.get(message.channelId);
      if (!channel) {
        throw new CredentialError('Channel not found', 'CHANNEL_NOT_FOUND');
      }
      
      // Reset delivery status
      message.deliveryStatus = 'pending';
      message.deliveryAttempts = 0;
      message.lastAttempt = undefined;
      message.deliveredAt = undefined;
      message.failureReason = undefined;
      
      this.messages.set(messageId, message);
      await this.queueMessage(message);
      
      return {
        success: true,
        data: true,
        messageId,
        channelId: message.channelId
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        messageId,
        channelId: '',
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to resend notification', 'RESEND_NOTIFICATION_ERROR', undefined, 'resendNotification', error)
      };
    }
  }
  
  /**
   * Cancel notification
   */
  async cancelNotification(messageId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        throw new CredentialError('Message not found', 'MESSAGE_NOT_FOUND');
      }
      
      if (message.deliveryStatus === 'delivered' || message.deliveryStatus === 'sent') {
        throw new CredentialError('Cannot cancel delivered message', 'MESSAGE_ALREADY_DELIVERED');
      }
      
      // Remove from queue
      this.deliveryQueue = this.deliveryQueue.filter(m => m.messageId !== messageId);
      
      // Update message status
      message.deliveryStatus = 'failed';
      message.failureReason = 'Cancelled by user';
      this.messages.set(messageId, message);
      
      this.emitNotificationEvent('notification_cancelled', { messageId });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to cancel notification', 'CANCEL_NOTIFICATION_ERROR', undefined, 'cancelNotification', error)
      };
    }
  }
  
  /**
   * Get notification message
   */
  async getMessage(messageId: string): Promise<CredentialOperationResult<NotificationMessage>> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        throw new CredentialError('Message not found', 'MESSAGE_NOT_FOUND');
      }
      
      return {
        success: true,
        data: message
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get message', 'GET_MESSAGE_ERROR', undefined, 'getMessage', error)
      };
    }
  }
  
  /**
   * Get notification messages with filter
   */
  async getMessages(filter?: Partial<NotificationMessage>): Promise<CredentialOperationResult<NotificationMessage[]>> {
    try {
      let messages = Array.from(this.messages.values());
      
      if (filter) {
        messages = messages.filter(message => {
          return Object.entries(filter).every(([key, value]) => {
            return message[key as keyof NotificationMessage] === value;
          });
        });
      }
      
      // Sort by timestamp (newest first)
      messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return {
        success: true,
        data: messages
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get messages', 'GET_MESSAGES_ERROR', undefined, 'getMessages', error)
      };
    }
  }
  
  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: string): Promise<CredentialOperationResult<NotificationMessage['deliveryStatus']>> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        throw new CredentialError('Message not found', 'MESSAGE_NOT_FOUND');
      }
      
      return {
        success: true,
        data: message.deliveryStatus
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get delivery status', 'GET_DELIVERY_STATUS_ERROR', undefined, 'getDeliveryStatus', error)
      };
    }
  }
  
  /**
   * Get notification statistics
   */
  async getStatistics(timeRange?: { start: string; end: string }): Promise<CredentialOperationResult<NotificationStatistics>> {
    try {
      let messages = Array.from(this.messages.values());
      
      // Filter by time range if provided
      if (timeRange) {
        const startTime = new Date(timeRange.start).getTime();
        const endTime = new Date(timeRange.end).getTime();
        
        messages = messages.filter(message => {
          const messageTime = new Date(message.timestamp).getTime();
          return messageTime >= startTime && messageTime <= endTime;
        });
      }
      
      const statistics: NotificationStatistics = {
        totalNotifications: messages.length,
        sentNotifications: messages.filter(m => m.deliveryStatus === 'sent' || m.deliveryStatus === 'delivered').length,
        deliveredNotifications: messages.filter(m => m.deliveryStatus === 'delivered').length,
        failedNotifications: messages.filter(m => m.deliveryStatus === 'failed').length,
        
        byEventType: this.groupBy(messages, 'eventType'),
        byChannel: this.groupBy(messages, 'channelId'),
        byPriority: this.groupBy(messages, 'priority'),
        
        deliveryRates: {
          overall: messages.length > 0 ? messages.filter(m => m.deliveryStatus === 'delivered').length / messages.length : 0,
          byChannel: this.calculateDeliveryRates(messages, 'channelId'),
          byEventType: this.calculateDeliveryRates(messages, 'eventType')
        },
        
        performanceMetrics: {
          averageDeliveryTime: this.calculateAverageDeliveryTime(messages),
          averageRetryCount: this.calculateAverageRetryCount(messages),
          errorRate: messages.length > 0 ? messages.filter(m => m.deliveryStatus === 'failed').length / messages.length : 0
        },
        
        lastUpdated: new Date().toISOString()
      };
      
      return {
        success: true,
        data: statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to get statistics', 'GET_STATISTICS_ERROR', undefined, 'getStatistics', error)
      };
    }
  }
  
  /**
   * Generate delivery report
   */
  async generateDeliveryReport(channelId?: string): Promise<CredentialOperationResult<any>> {
    try {
      const statisticsResult = await this.getStatistics();
      if (!statisticsResult.success || !statisticsResult.data) {
        throw statisticsResult.error || new CredentialError('Failed to get statistics', 'STATISTICS_ERROR');
      }
      
      const messages = channelId 
        ? Array.from(this.messages.values()).filter(m => m.channelId === channelId)
        : Array.from(this.messages.values());
      
      const report = {
        generatedAt: new Date().toISOString(),
        channelId: channelId || 'all',
        statistics: statisticsResult.data,
        recentMessages: messages
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50), // Last 50 messages
        summary: {
          totalMessages: messages.length,
          successRate: messages.length > 0 ? 
            messages.filter(m => m.deliveryStatus === 'delivered').length / messages.length : 0,
          failureReasons: this.groupBy(
            messages.filter(m => m.deliveryStatus === 'failed'),
            'failureReason'
          )
        }
      };
      
      return {
        success: true,
        data: report
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to generate delivery report', 'GENERATE_REPORT_ERROR', undefined, 'generateDeliveryReport', error)
      };
    }
  }
  
  /**
   * Subscribe to credential events
   */
  async subscribeToCredentialEvents(credentialId: CredentialId, eventTypes: NotificationEventType[], channelIds: string[]): Promise<CredentialOperationResult<string>> {
    try {
      const subscriptionId = this.generateSubscriptionId();
      
      const subscription = {
        subscriptionId,
        credentialId,
        eventTypes,
        channelIds,
        created: new Date().toISOString(),
        active: true
      };
      
      this.subscriptions.set(subscriptionId, subscription);
      
      this.emitNotificationEvent('subscription_created', { subscriptionId, subscription });
      
      return {
        success: true,
        data: subscriptionId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to create subscription', 'CREATE_SUBSCRIPTION_ERROR', credentialId, 'subscribeToCredentialEvents', error)
      };
    }
  }
  
  /**
   * Unsubscribe from credential events
   */
  async unsubscribeFromCredentialEvents(subscriptionId: string): Promise<CredentialOperationResult<boolean>> {
    try {
      const removed = this.subscriptions.delete(subscriptionId);
      if (!removed) {
        throw new CredentialError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }
      
      this.emitNotificationEvent('subscription_removed', { subscriptionId });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove subscription', 'REMOVE_SUBSCRIPTION_ERROR', undefined, 'unsubscribeFromCredentialEvents', error)
      };
    }
  }
  
  /**
   * List subscriptions
   */
  async listSubscriptions(): Promise<CredentialOperationResult<any[]>> {
    try {
      const subscriptions = Array.from(this.subscriptions.values());
      
      return {
        success: true,
        data: subscriptions
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list subscriptions', 'LIST_SUBSCRIPTIONS_ERROR', undefined, 'listSubscriptions', error)
      };
    }
  }
  
  /**
   * Handle rotation event
   */
  async handleRotationEvent(event: CredentialRotationEvent, data: any): Promise<void> {
    try {
      let eventType: NotificationEventType;
      let priority: NotificationPriority = 'normal';
      
      switch (event) {
        case 'rotation_completed':
          eventType = 'credential_rotated';
          priority = 'normal';
          break;
        case 'rotation_failed':
          eventType = 'credential_rotation_failed';
          priority = 'high';
          break;
        case 'expiry_warning':
          eventType = 'credential_expiring';
          priority = 'high';
          break;
        case 'credential_expired':
          eventType = 'credential_expired';
          priority = 'urgent';
          break;
        default:
          return; // Ignore other events
      }
      
      await this.sendNotification(eventType, data, priority);
    } catch (error) {
      // Log error but don't throw
    }
  }
  
  /**
   * Handle monitoring alert
   */
  async handleMonitoringAlert(alert: MonitoringAlert): Promise<void> {
    try {
      let eventType: NotificationEventType;
      let priority: NotificationPriority;
      
      switch (alert.severity) {
        case 'critical':
          eventType = 'security_alert';
          priority = 'urgent';
          break;
        case 'error':
          eventType = 'credential_health_degraded';
          priority = 'high';
          break;
        case 'warning':
          eventType = 'credential_health_degraded';
          priority = 'normal';
          break;
        default:
          eventType = 'credential_health_degraded';
          priority = 'low';
      }
      
      await this.sendNotification(eventType, {
        credentialId: alert.credentialId,
        alert
      }, priority);
    } catch (error) {
      // Log error but don't throw
    }
  }
  
  /**
   * Handle refresh event
   */
  async handleRefreshEvent(event: string, data: any): Promise<void> {
    try {
      let eventType: NotificationEventType;
      let priority: NotificationPriority = 'normal';
      
      switch (event) {
        case 'refresh_completed':
          eventType = 'credential_refresh_completed';
          priority = 'low';
          break;
        case 'refresh_failed':
          eventType = 'credential_refresh_failed';
          priority = 'high';
          break;
        default:
          return; // Ignore other events
      }
      
      await this.sendNotification(eventType, data, priority);
    } catch (error) {
      // Log error but don't throw
    }
  }
  
  /**
   * Register notification event handler
   */
  onNotificationEvent(callback: (event: string, data: any) => void): void {
    this.notificationEventHandlers.push(callback);
  }
  
  /**
   * Emit notification event
   */
  emitNotificationEvent(event: string, data: any): void {
    this.notificationEventHandlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        // Ignore handler errors
      }
    });
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private validateChannel(channel: NotificationChannel): void {
    if (!channel.type || !channel.name) {
      throw new CredentialError('Channel type and name are required', 'INVALID_CHANNEL');
    }
    
    if (channel.eventFilter.length === 0) {
      throw new CredentialError('At least one event type must be specified', 'INVALID_EVENT_FILTER');
    }
    
    // Validate channel-specific configuration
    switch (channel.type) {
      case 'email':
        if (!channel.config.emailAddress) {
          throw new CredentialError('Email address is required for email channel', 'INVALID_EMAIL_CONFIG');
        }
        break;
      case 'webhook':
        if (!channel.config.webhookUrl) {
          throw new CredentialError('Webhook URL is required for webhook channel', 'INVALID_WEBHOOK_CONFIG');
        }
        break;
      // Add more validation for other channel types
    }
  }
  
  private validateTemplate(template: NotificationTemplate): void {
    if (!template.name || !template.titleTemplate || !template.messageTemplate) {
      throw new CredentialError('Template name, title template, and message template are required', 'INVALID_TEMPLATE');
    }
  }
  
  private getMatchingChannels(eventType: NotificationEventType, priority: NotificationPriority, credentialId?: CredentialId): NotificationChannel[] {
    return Array.from(this.channels.values()).filter(channel => {
      if (!channel.enabled) return false;
      if (!channel.eventFilter.includes(eventType)) return false;
      if (!channel.priorityFilter.includes(priority)) return false;
      if (credentialId && channel.credentialFilter && !channel.credentialFilter.includes(credentialId)) return false;
      
      // Check rate limiting
      if (channel.rateLimitEnabled && this.isRateLimited(channel.channelId, channel.maxNotificationsPerHour)) {
        return false;
      }
      
      // Check quiet hours
      if (channel.quietHours?.enabled && this.isInQuietHours(channel.quietHours)) {
        return false;
      }
      
      return true;
    });
  }
  
  private async createMessage(eventType: NotificationEventType, eventData: any, priority: NotificationPriority, channel: NotificationChannel): Promise<NotificationMessage> {
    const messageId = this.generateMessageId();
    const template = this.findTemplate(eventType, channel.type);
    
    const title = this.renderTemplate(template?.titleTemplate || this.getDefaultTitle(eventType), eventData);
    const message = this.renderTemplate(template?.messageTemplate || this.getDefaultMessage(eventType), eventData);
    
    return {
      messageId,
      eventType,
      priority,
      title,
      message,
      timestamp: new Date().toISOString(),
      credentialId: eventData.credentialId,
      credentialAlias: eventData.credentialAlias,
      eventData,
      channelId: channel.channelId,
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      contentType: template?.contentType || 'text'
    };
  }
  
  private createFullMessage(partial: Partial<NotificationMessage>, channel: NotificationChannel): NotificationMessage {
    return {
      messageId: partial.messageId || this.generateMessageId(),
      eventType: partial.eventType || 'custom_notification',
      priority: partial.priority || 'normal',
      title: partial.title || 'Notification',
      message: partial.message || 'Custom notification message',
      timestamp: partial.timestamp || new Date().toISOString(),
      channelId: channel.channelId,
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      contentType: partial.contentType || 'text',
      ...partial
    };
  }
  
  private async queueMessage(message: NotificationMessage): Promise<void> {
    this.deliveryQueue.push(message);
    this.messages.set(message.messageId, message);
  }
  
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.deliveryQueue.length === 0) {
        return;
      }
      
      this.isProcessingQueue = true;
      
      try {
        const message = this.deliveryQueue.shift();
        if (message) {
          const channel = this.channels.get(message.channelId);
          if (channel) {
            await this.deliverMessage(message, channel);
          }
        }
      } catch (error) {
        // Continue processing
      } finally {
        this.isProcessingQueue = false;
      }
    }, 1000); // Process every second
  }
  
  private async deliverMessage(message: NotificationMessage, channel: NotificationChannel): Promise<CredentialOperationResult<boolean>> {
    try {
      message.deliveryStatus = 'sent';
      message.deliveryAttempts++;
      message.lastAttempt = new Date().toISOString();
      
      // Simulate message delivery based on channel type
      const success = await this.performDelivery(message, channel);
      
      if (success) {
        message.deliveryStatus = 'delivered';
        message.deliveredAt = new Date().toISOString();
      } else {
        message.deliveryStatus = 'failed';
        message.failureReason = 'Delivery failed';
        
        // Retry if configured
        if (message.deliveryAttempts < channel.retryAttempts) {
          setTimeout(() => {
            this.queueMessage(message);
          }, channel.retryDelay);
        }
      }
      
      this.messages.set(message.messageId, message);
      
      return {
        success,
        data: success
      };
    } catch (error) {
      message.deliveryStatus = 'failed';
      message.failureReason = error.message;
      this.messages.set(message.messageId, message);
      
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Message delivery failed', 'DELIVERY_ERROR', undefined, 'deliverMessage', error)
      };
    }
  }
  
  private async performDelivery(message: NotificationMessage, channel: NotificationChannel): Promise<boolean> {
    try {
      // This would implement actual delivery logic for each channel type
      // For now, simulate delivery with 95% success rate
      return Math.random() > 0.05;
    } catch (error) {
      return false;
    }
  }
  
  private isRateLimited(channelId: string, maxPerHour: number): boolean {
    const now = Date.now();
    const hourStart = now - (now % (60 * 60 * 1000));
    
    const counter = this.rateLimitCounters.get(channelId);
    if (!counter || counter.resetTime !== hourStart) {
      this.rateLimitCounters.set(channelId, { count: 0, resetTime: hourStart });
      return false;
    }
    
    return counter.count >= maxPerHour;
  }
  
  private isInQuietHours(quietHours: NonNullable<NotificationChannel['quietHours']>): boolean {
    // This would implement quiet hours logic based on timezone
    // For now, return false (not in quiet hours)
    return false;
  }
  
  private findTemplate(eventType: NotificationEventType, channelType: NotificationChannelType): NotificationTemplate | undefined {
    return Array.from(this.templates.values()).find(
      template => template.eventType === eventType && template.channelType === channelType
    );
  }
  
  private renderTemplate(template: string, data: any): string {
    // Simple template rendering - replace {{variable}} with data values
    return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
  }
  
  private getDefaultTitle(eventType: NotificationEventType): string {
    const titles: Record<NotificationEventType, string> = {
      credential_added: 'Credential Added',
      credential_updated: 'Credential Updated',
      credential_removed: 'Credential Removed',
      credential_expired: 'Credential Expired',
      credential_expiring: 'Credential Expiring Soon',
      credential_rotated: 'Credential Rotated',
      credential_rotation_failed: 'Credential Rotation Failed',
      credential_refresh_completed: 'Credential Refreshed',
      credential_refresh_failed: 'Credential Refresh Failed',
      credential_health_degraded: 'Credential Health Degraded',
      credential_connectivity_lost: 'Credential Connectivity Lost',
      credential_usage_anomaly: 'Credential Usage Anomaly',
      system_maintenance: 'System Maintenance',
      security_alert: 'Security Alert',
      custom_notification: 'Notification'
    };
    
    return titles[eventType] || 'Notification';
  }
  
  private getDefaultMessage(eventType: NotificationEventType): string {
    const messages: Record<NotificationEventType, string> = {
      credential_added: 'A new credential has been added to the system.',
      credential_updated: 'A credential has been updated.',
      credential_removed: 'A credential has been removed from the system.',
      credential_expired: 'A credential has expired and needs immediate attention.',
      credential_expiring: 'A credential is expiring soon and should be rotated.',
      credential_rotated: 'A credential has been successfully rotated.',
      credential_rotation_failed: 'Credential rotation has failed.',
      credential_refresh_completed: 'Credential has been successfully refreshed.',
      credential_refresh_failed: 'Credential refresh has failed.',
      credential_health_degraded: 'Credential health status has degraded.',
      credential_connectivity_lost: 'Credential connectivity has been lost.',
      credential_usage_anomaly: 'Unusual credential usage patterns detected.',
      system_maintenance: 'System maintenance is scheduled.',
      security_alert: 'A security alert has been triggered.',
      custom_notification: 'Custom notification message.'
    };
    
    return messages[eventType] || 'Notification message.';
  }
  
  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = (groups[groupKey] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }
  
  private calculateDeliveryRates(messages: NotificationMessage[], groupBy: keyof NotificationMessage): Record<string, number> {
    const groups = this.groupBy(messages, groupBy);
    const deliveredGroups = this.groupBy(
      messages.filter(m => m.deliveryStatus === 'delivered'),
      groupBy
    );
    
    const rates: Record<string, number> = {};
    for (const [key, total] of Object.entries(groups)) {
      const delivered = deliveredGroups[key] || 0;
      rates[key] = total > 0 ? delivered / total : 0;
    }
    
    return rates;
  }
  
  private calculateAverageDeliveryTime(messages: NotificationMessage[]): number {
    const deliveredMessages = messages.filter(m => m.deliveryStatus === 'delivered' && m.deliveredAt);
    
    if (deliveredMessages.length === 0) return 0;
    
    const totalTime = deliveredMessages.reduce((sum, message) => {
      const sent = new Date(message.timestamp).getTime();
      const delivered = new Date(message.deliveredAt!).getTime();
      return sum + (delivered - sent);
    }, 0);
    
    return totalTime / deliveredMessages.length;
  }
  
  private calculateAverageRetryCount(messages: NotificationMessage[]): number {
    if (messages.length === 0) return 0;
    
    const totalRetries = messages.reduce((sum, message) => sum + message.deliveryAttempts, 0);
    return totalRetries / messages.length;
  }
  
  private initializeDefaultTemplates(): void {
    // Add some default templates
    const defaultTemplates: Partial<NotificationTemplate>[] = [
      {
        name: 'Credential Expiry Warning',
        eventType: 'credential_expiring',
        channelType: 'email',
        titleTemplate: 'Credential Expiring: {{credentialAlias}}',
        messageTemplate: 'Your credential "{{credentialAlias}}" will expire in {{daysUntilExpiry}} days. Please rotate it soon.',
        variables: ['credentialAlias', 'daysUntilExpiry'],
        contentType: 'text'
      },
      {
        name: 'Credential Rotation Success',
        eventType: 'credential_rotated',
        channelType: 'slack',
        titleTemplate: 'Credential Rotated Successfully',
        messageTemplate: 'Credential "{{credentialAlias}}" has been successfully rotated.',
        variables: ['credentialAlias'],
        contentType: 'text'
      }
    ];
    
    defaultTemplates.forEach(template => {
      this.addTemplate(template as NotificationTemplate);
    });
  }
  
  private generateChannelId(): string {
    return `channel_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateMessageId(): string {
    return `message_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateSubscriptionId(): string {
    return `subscription_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

// ============================================================================
// NOTIFICATION SERVICE FACTORY
// ============================================================================

/**
 * Factory for creating notification service instances
 */
export class CredentialNotificationServiceFactory {
  /**
   * Create default notification service
   */
  static createDefault(): CredentialNotificationService {
    return new CredentialNotificationService();
  }
  
  /**
   * Create configured notification service
   */
  static createWithChannels(channels: NotificationChannel[]): CredentialNotificationService {
    const service = new CredentialNotificationService();
    
    channels.forEach(async (channel) => {
      await service.addChannel(channel);
    });
    
    return service;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default notification channel
 */
export function createDefaultNotificationChannel(type: NotificationChannelType): Partial<NotificationChannel> {
  return {
    type,
    enabled: true,
    eventFilter: ['credential_expiring', 'credential_expired', 'credential_rotation_failed'],
    priorityFilter: ['normal', 'high', 'urgent'],
    retryAttempts: 3,
    retryDelay: 5000,
    timeout: 30000,
    rateLimitEnabled: true,
    maxNotificationsPerHour: 50
  };
}

/**
 * Quick notification setup function
 */
export async function setupCredentialNotifications(
  channels: NotificationChannel[]
): Promise<CredentialNotificationService> {
  const notificationService = CredentialNotificationServiceFactory.createDefault();
  
  for (const channel of channels) {
    await notificationService.addChannel(channel);
  }
  
  return notificationService;
}