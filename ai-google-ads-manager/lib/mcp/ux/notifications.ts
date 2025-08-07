/**
 * Property Notification Service
 * 
 * Toast notifications and visual feedback for property operations.
 */

import { useState, useCallback, useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type NotificationPosition = 
  | 'top-right' 
  | 'top-left' 
  | 'bottom-right' 
  | 'bottom-left' 
  | 'top-center' 
  | 'bottom-center';

export interface NotificationConfig {
  autoRemove: boolean;
  duration: number; // in milliseconds
  position: NotificationPosition;
  maxNotifications: number;
  enableSounds: boolean;
  enableAnimations: boolean;
}

export interface PropertyNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  propertyId?: string;
  propertyName?: string;
  timestamp: Date;
  duration?: number;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  persistent?: boolean;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface ConfirmationDialog {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: 'info' | 'warning' | 'danger';
}

export interface FeedbackConfig {
  enableHaptics: boolean;
  enableVisualEffects: boolean;
  enableSounds: boolean;
  animationDuration: number;
}

/**
 * Property Notification Service
 */
export class PropertyNotificationService {
  private config: NotificationConfig;
  private notifications: Map<string, PropertyNotification> = new Map();
  private confirmationDialogs: Map<string, ConfirmationDialog> = new Map();
  private subscribers: Map<string, (notifications: PropertyNotification[]) => void> = new Map();
  private dialogSubscribers: Map<string, (dialogs: ConfirmationDialog[]) => void> = new Map();

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = {
      autoRemove: true,
      duration: 5000,
      position: 'top-right',
      maxNotifications: 5,
      enableSounds: false,
      enableAnimations: true,
      ...config
    };
  }

  /**
   * Show property switching notification
   */
  showPropertySwitch(propertyName: string, propertyId: string): string {
    return this.show({
      type: 'success',
      title: 'Property Switched',
      message: `Now viewing data for ${propertyName}`,
      propertyId,
      propertyName,
      duration: 3000
    });
  }

  /**
   * Show property loading notification
   */
  showPropertyLoading(propertyName: string, propertyId: string): string {
    return this.show({
      type: 'loading',
      title: 'Loading Property',
      message: `Loading ${propertyName}...`,
      propertyId,
      propertyName,
      persistent: true
    });
  }

  /**
   * Show property error notification
   */
  showPropertyError(error: string, propertyName?: string, propertyId?: string): string {
    return this.show({
      type: 'error',
      title: 'Property Error',
      message: error,
      propertyId,
      propertyName,
      duration: 8000,
      actions: [
        {
          label: 'Retry',
          action: () => this.retryLastOperation(),
          style: 'primary'
        },
        {
          label: 'Dismiss',
          action: () => {},
          style: 'secondary'
        }
      ]
    });
  }

  /**
   * Show property validation warning
   */
  showPropertyWarning(message: string, propertyName?: string, propertyId?: string): string {
    return this.show({
      type: 'warning',
      title: 'Property Warning',
      message,
      propertyId,
      propertyName,
      duration: 6000
    });
  }

  /**
   * Show generic notification
   */
  show(notification: Omit<PropertyNotification, 'id' | 'timestamp'>): string {
    const id = this.generateNotificationId();
    
    const fullNotification: PropertyNotification = {
      ...notification,
      id,
      timestamp: new Date(),
      duration: notification.duration || this.config.duration
    };

    this.notifications.set(id, fullNotification);

    // Remove oldest notifications if we exceed the limit
    this.enforceNotificationLimit();

    // Auto-remove if configured
    if (this.config.autoRemove && !fullNotification.persistent) {
      setTimeout(() => {
        this.remove(id);
      }, fullNotification.duration);
    }

    // Notify subscribers
    this.notifySubscribers();

    // Play sound if enabled
    if (this.config.enableSounds) {
      this.playNotificationSound(fullNotification.type);
    }

    return id;
  }

  /**
   * Remove notification
   */
  remove(id: string): boolean {
    const removed = this.notifications.delete(id);
    if (removed) {
      this.notifySubscribers();
    }
    return removed;
  }

  /**
   * Update existing notification
   */
  update(id: string, updates: Partial<PropertyNotification>): boolean {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    const updatedNotification = { ...notification, ...updates };
    this.notifications.set(id, updatedNotification);
    this.notifySubscribers();
    return true;
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notifications.clear();
    this.notifySubscribers();
  }

  /**
   * Clear notifications by property
   */
  clearByProperty(propertyId: string): void {
    const toRemove: string[] = [];
    
    this.notifications.forEach((notification, id) => {
      if (notification.propertyId === propertyId) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.notifications.delete(id));
    this.notifySubscribers();
  }

  /**
   * Clear notifications by type
   */
  clearByType(type: NotificationType): void {
    const toRemove: string[] = [];
    
    this.notifications.forEach((notification, id) => {
      if (notification.type === type) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.notifications.delete(id));
    this.notifySubscribers();
  }

  /**
   * Show confirmation dialog
   */
  showConfirmation(dialog: Omit<ConfirmationDialog, 'id'>): string {
    const id = this.generateDialogId();
    
    const fullDialog: ConfirmationDialog = {
      ...dialog,
      id
    };

    this.confirmationDialogs.set(id, fullDialog);
    this.notifyDialogSubscribers();

    return id;
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmation(id: string): boolean {
    const removed = this.confirmationDialogs.delete(id);
    if (removed) {
      this.notifyDialogSubscribers();
    }
    return removed;
  }

  /**
   * Subscribe to notification updates
   */
  subscribe(callback: (notifications: PropertyNotification[]) => void): string {
    const subscriptionId = this.generateSubscriptionId();
    this.subscribers.set(subscriptionId, callback);
    
    // Send current notifications
    callback(this.getAll());
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from notification updates
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscribers.delete(subscriptionId);
  }

  /**
   * Subscribe to dialog updates
   */
  subscribeToDialogs(callback: (dialogs: ConfirmationDialog[]) => void): string {
    const subscriptionId = this.generateSubscriptionId();
    this.dialogSubscribers.set(subscriptionId, callback);
    
    // Send current dialogs
    callback(this.getAllDialogs());
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from dialog updates
   */
  unsubscribeFromDialogs(subscriptionId: string): boolean {
    return this.dialogSubscribers.delete(subscriptionId);
  }

  /**
   * Get all notifications
   */
  getAll(): PropertyNotification[] {
    return Array.from(this.notifications.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get all confirmation dialogs
   */
  getAllDialogs(): ConfirmationDialog[] {
    return Array.from(this.confirmationDialogs.values());
  }

  /**
   * Get notification by ID
   */
  getById(id: string): PropertyNotification | undefined {
    return this.notifications.get(id);
  }

  /**
   * Get notifications by property
   */
  getByProperty(propertyId: string): PropertyNotification[] {
    return this.getAll().filter(n => n.propertyId === propertyId);
  }

  /**
   * Get notifications by type
   */
  getByType(type: NotificationType): PropertyNotification[] {
    return this.getAll().filter(n => n.type === type);
  }

  // Private helper methods

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDialogId(): string {
    return `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private enforceNotificationLimit(): void {
    const notifications = this.getAll();
    
    if (notifications.length > this.config.maxNotifications) {
      const toRemove = notifications.slice(this.config.maxNotifications);
      toRemove.forEach(notification => {
        this.notifications.delete(notification.id);
      });
    }
  }

  private notifySubscribers(): void {
    const notifications = this.getAll();
    this.subscribers.forEach(callback => {
      try {
        callback(notifications);
      } catch (error) {
        console.warn('Error notifying notification subscriber:', error);
      }
    });
  }

  private notifyDialogSubscribers(): void {
    const dialogs = this.getAllDialogs();
    this.dialogSubscribers.forEach(callback => {
      try {
        callback(dialogs);
      } catch (error) {
        console.warn('Error notifying dialog subscriber:', error);
      }
    });
  }

  private playNotificationSound(type: NotificationType): void {
    if (typeof window === 'undefined' || !this.config.enableSounds) return;

    try {
      // Simple beep sounds for different notification types
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different types
      const frequencies = {
        success: 800,
        error: 400,
        warning: 600,
        info: 700,
        loading: 500
      };

      oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  private retryLastOperation(): void {
    // Placeholder for retry logic
    console.log('Retrying last operation...');
  }
}

/**
 * React hook for property notifications
 */
export function usePropertyNotifications() {
  const [notifications, setNotifications] = useState<PropertyNotification[]>([]);
  const [dialogs, setDialogs] = useState<ConfirmationDialog[]>([]);

  useEffect(() => {
    const notificationSubscription = propertyNotificationService.subscribe(setNotifications);
    const dialogSubscription = propertyNotificationService.subscribeToDialogs(setDialogs);

    return () => {
      propertyNotificationService.unsubscribe(notificationSubscription);
      propertyNotificationService.unsubscribeFromDialogs(dialogSubscription);
    };
  }, []);

  const showNotification = useCallback((notification: Omit<PropertyNotification, 'id' | 'timestamp'>) => {
    return propertyNotificationService.show(notification);
  }, []);

  const showPropertySwitch = useCallback((propertyName: string, propertyId: string) => {
    return propertyNotificationService.showPropertySwitch(propertyName, propertyId);
  }, []);

  const showPropertyError = useCallback((error: string, propertyName?: string, propertyId?: string) => {
    return propertyNotificationService.showPropertyError(error, propertyName, propertyId);
  }, []);

  const showPropertyWarning = useCallback((message: string, propertyName?: string, propertyId?: string) => {
    return propertyNotificationService.showPropertyWarning(message, propertyName, propertyId);
  }, []);

  const showPropertyLoading = useCallback((propertyName: string, propertyId: string) => {
    return propertyNotificationService.showPropertyLoading(propertyName, propertyId);
  }, []);

  const removeNotification = useCallback((id: string) => {
    return propertyNotificationService.remove(id);
  }, []);

  const showConfirmation = useCallback((dialog: Omit<ConfirmationDialog, 'id'>) => {
    return propertyNotificationService.showConfirmation(dialog);
  }, []);

  const closeConfirmation = useCallback((id: string) => {
    return propertyNotificationService.closeConfirmation(id);
  }, []);

  const clearAll = useCallback(() => {
    propertyNotificationService.clear();
  }, []);

  const clearByProperty = useCallback((propertyId: string) => {
    propertyNotificationService.clearByProperty(propertyId);
  }, []);

  const clearByType = useCallback((type: NotificationType) => {
    propertyNotificationService.clearByType(type);
  }, []);

  return {
    notifications,
    dialogs,
    showNotification,
    showPropertySwitch,
    showPropertyError,
    showPropertyWarning,
    showPropertyLoading,
    removeNotification,
    showConfirmation,
    closeConfirmation,
    clearAll,
    clearByProperty,
    clearByType
  };
}

export const propertyNotificationService = new PropertyNotificationService();
export default propertyNotificationService;