/**
 * Enhanced Session Persistence for Property Management
 * 
 * Provides comprehensive session storage, cross-tab synchronization,
 * and property preference management with automatic recovery mechanisms.
 */

import { GA4Property, PropertyAccessLevel } from '../types/property';

// Session persistence configuration
export interface SessionPersistenceConfig {
  storageKey: string;
  enableCrossTabs: boolean;
  enableEncryption: boolean;
  sessionTimeout: number; // in milliseconds
  maxStorageSize: number; // in bytes
  autoCleanup: boolean;
  compressionEnabled: boolean;
}

export interface PropertySession {
  propertyId: string;
  propertyName: string;
  accessLevel: PropertyAccessLevel;
  selectedAt: Date;
  lastAccessed: Date;
  sessionId: string;
  tabId: string;
  preferences: PropertyUserPreferences;
}

export interface PropertyUserPreferences {
  autoSelectLastUsed: boolean;
  defaultView: 'dashboard' | 'analytics' | 'reports';
  preferredDateRange: string;
  notificationSettings: {
    propertySwitch: boolean;
    errorNotifications: boolean;
    permissionChanges: boolean;
  };
  dashboardLayout: Record<string, any>;
  favoriteProperties: string[];
}

export interface SessionRecoveryData {
  lastKnownState: PropertySession | null;
  recoveryTimestamp: Date;
  errorContext: string[];
  fallbackProperties: string[];
  userActions: SessionAction[];
}

export interface SessionAnalytics {
  sessionDuration: number;
  propertySwitches: number;
  errorsEncountered: number;
  averagePropertySwitchTime: number;
  mostUsedProperties: Record<string, number>;
  preferredFeatures: string[];
}

export interface SessionAction {
  type: 'property_switch' | 'error_recovery' | 'preference_change' | 'session_restore';
  timestamp: Date;
  propertyId?: string;
  metadata: Record<string, any>;
}

/**
 * Enhanced Session Persistence Service
 */
export class EnhancedSessionPersistence {
  private config: SessionPersistenceConfig;
  private currentSession: PropertySession | null = null;
  private sessionAnalytics: SessionAnalytics;
  private recoveryData: SessionRecoveryData;
  private storageQuota: number = 0;
  private compressionEnabled: boolean = false;

  constructor(config: Partial<SessionPersistenceConfig> = {}) {
    this.config = {
      storageKey: 'mcp_property_session',
      enableCrossTabs: true,
      enableEncryption: false,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxStorageSize: 5 * 1024 * 1024, // 5MB
      autoCleanup: true,
      compressionEnabled: false,
      ...config
    };

    this.sessionAnalytics = this.initializeAnalytics();
    this.recoveryData = this.initializeRecoveryData();
    this.compressionEnabled = this.config.compressionEnabled;

    this.initializeSession();
    this.setupEventListeners();
    this.startPeriodicCleanup();
  }

  /**
   * Initialize session from storage or create new one
   */
  private initializeSession(): void {
    try {
      const storedSession = this.getFromStorage<PropertySession>('current_session');
      
      if (storedSession && this.isSessionValid(storedSession)) {
        this.currentSession = {
          ...storedSession,
          lastAccessed: new Date(),
          tabId: this.generateTabId()
        };
        this.saveCurrentSession();
        this.recordAction('session_restore', { recovered: true });
      } else {
        this.createNewSession();
      }
    } catch (error) {
      console.warn('Failed to initialize session:', error);
      this.createNewSession();
    }
  }

  /**
   * Create a new session
   */
  private createNewSession(): void {
    this.currentSession = null;
    this.sessionAnalytics = this.initializeAnalytics();
    this.recoveryData = this.initializeRecoveryData();
  }

  /**
   * Save property session with preferences
   */
  savePropertySession(property: GA4Property, preferences: Partial<PropertyUserPreferences> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const now = new Date();
        const sessionId = this.currentSession?.sessionId || this.generateSessionId();
        const tabId = this.generateTabId();

        const session: PropertySession = {
          propertyId: property.id,
          propertyName: property.displayName,
          accessLevel: property.accessLevel,
          selectedAt: this.currentSession?.selectedAt || now,
          lastAccessed: now,
          sessionId,
          tabId,
          preferences: {
            ...this.getDefaultPreferences(),
            ...this.currentSession?.preferences,
            ...preferences
          }
        };

        this.currentSession = session;
        this.saveCurrentSession();
        this.updateAnalytics('property_switch', property.id);
        this.recordAction('property_switch', { propertyId: property.id, propertyName: property.displayName });

        if (this.config.enableCrossTabs) {
          this.broadcastSessionUpdate(session);
        }

        resolve();
      } catch (error) {
        this.handleStorageError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Restore property session
   */
  restorePropertySession(): Promise<PropertySession | null> {
    return new Promise((resolve, reject) => {
      try {
        if (this.currentSession && this.isSessionValid(this.currentSession)) {
          this.currentSession.lastAccessed = new Date();
          this.saveCurrentSession();
          resolve(this.currentSession);
        } else {
          // Try to recover from storage
          const recoveredSession = this.attemptSessionRecovery();
          resolve(recoveredSession);
        }
      } catch (error) {
        this.handleStorageError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<PropertyUserPreferences>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.currentSession) {
          reject(new Error('No active session to update preferences'));
          return;
        }

        this.currentSession.preferences = {
          ...this.currentSession.preferences,
          ...preferences
        };

        this.currentSession.lastAccessed = new Date();
        this.saveCurrentSession();
        this.recordAction('preference_change', { preferences });

        resolve();
      } catch (error) {
        this.handleStorageError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Clear session data
   */
  clearSession(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.currentSession = null;
        this.removeFromStorage('current_session');
        this.removeFromStorage('session_analytics');
        this.removeFromStorage('recovery_data');
        
        if (this.config.enableCrossTabs) {
          this.broadcastSessionClear();
        }

        resolve();
      } catch (error) {
        console.warn('Error clearing session:', error);
        resolve(); // Don't fail on cleanup errors
      }
    });
  }

  /**
   * Get current session
   */
  getCurrentSession(): PropertySession | null {
    return this.currentSession;
  }

  /**
   * Get session analytics
   */
  getSessionAnalytics(): SessionAnalytics {
    return { ...this.sessionAnalytics };
  }

  /**
   * Get recovery data
   */
  getRecoveryData(): SessionRecoveryData {
    return { ...this.recoveryData };
  }

  /**
   * Export session data for backup
   */
  exportSessionData(): string {
    const exportData = {
      session: this.currentSession,
      analytics: this.sessionAnalytics,
      recovery: this.recoveryData,
      exportedAt: new Date().toISOString()
    };

    return this.compressionEnabled ? 
      this.compressData(JSON.stringify(exportData)) : 
      JSON.stringify(exportData);
  }

  /**
   * Import session data from backup
   */
  importSessionData(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const decompressedData = this.compressionEnabled ? 
          this.decompressData(data) : 
          data;
        
        const importData = JSON.parse(decompressedData);
        
        if (importData.session) {
          this.currentSession = {
            ...importData.session,
            lastAccessed: new Date(),
            tabId: this.generateTabId()
          };
          this.saveCurrentSession();
        }

        if (importData.analytics) {
          this.sessionAnalytics = importData.analytics;
          this.saveToStorage('session_analytics', this.sessionAnalytics);
        }

        if (importData.recovery) {
          this.recoveryData = importData.recovery;
          this.saveToStorage('recovery_data', this.recoveryData);
        }

        resolve();
      } catch (error) {
        reject(new Error(`Failed to import session data: ${error}`));
      }
    });
  }

  // Private helper methods

  private saveCurrentSession(): void {
    if (this.currentSession) {
      this.saveToStorage('current_session', this.currentSession);
      this.saveToStorage('session_analytics', this.sessionAnalytics);
      this.saveToStorage('recovery_data', this.recoveryData);
    }
  }

  private isSessionValid(session: PropertySession): boolean {
    const now = new Date();
    const sessionAge = now.getTime() - new Date(session.lastAccessed).getTime();
    return sessionAge < this.config.sessionTimeout;
  }

  private attemptSessionRecovery(): PropertySession | null {
    try {
      const recoveryData = this.getFromStorage<SessionRecoveryData>('recovery_data');
      if (recoveryData?.lastKnownState) {
        const recovered = recoveryData.lastKnownState;
        this.recordAction('session_restore', { recovered: true, automatic: true });
        return recovered;
      }
    } catch (error) {
      console.warn('Session recovery failed:', error);
    }
    return null;
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      // Handle storage events for cross-tab synchronization
      if (this.config.enableCrossTabs) {
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
      }

      // Handle page visibility changes
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

      // Handle page unload
      window.addEventListener('beforeunload', this.handlePageUnload.bind(this));
    }
  }

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key === `${this.config.storageKey}_broadcast`) {
      try {
        const broadcastData = JSON.parse(event.newValue || '{}');
        this.handleCrossTabMessage(broadcastData);
      } catch (error) {
        console.warn('Failed to handle cross-tab message:', error);
      }
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.currentSession) {
      this.currentSession.lastAccessed = new Date();
      this.saveCurrentSession();
    }
  }

  private handlePageUnload(): void {
    if (this.currentSession) {
      this.updateAnalytics('session_end');
    }
  }

  private handleCrossTabMessage(data: any): void {
    if (data.type === 'session_update' && data.session) {
      // Update current session from other tab
      this.currentSession = {
        ...data.session,
        tabId: this.generateTabId()
      };
    } else if (data.type === 'session_clear') {
      this.currentSession = null;
    }
  }

  private broadcastSessionUpdate(session: PropertySession): void {
    const broadcastData = {
      type: 'session_update',
      session,
      timestamp: new Date().toISOString()
    };
    this.saveToStorage('broadcast', broadcastData);
  }

  private broadcastSessionClear(): void {
    const broadcastData = {
      type: 'session_clear',
      timestamp: new Date().toISOString()
    };
    this.saveToStorage('broadcast', broadcastData);
  }

  private updateAnalytics(action: string, propertyId?: string): void {
    const now = Date.now();
    
    if (action === 'property_switch') {
      this.sessionAnalytics.propertySwitches++;
      if (propertyId) {
        this.sessionAnalytics.mostUsedProperties[propertyId] = 
          (this.sessionAnalytics.mostUsedProperties[propertyId] || 0) + 1;
      }
    } else if (action === 'error_recovery') {
      this.sessionAnalytics.errorsEncountered++;
    } else if (action === 'session_end') {
      this.sessionAnalytics.sessionDuration = now - (this.currentSession?.selectedAt.getTime() || now);
    }
  }

  private recordAction(type: SessionAction['type'], metadata: Record<string, any> = {}): void {
    const action: SessionAction = {
      type,
      timestamp: new Date(),
      metadata
    };

    if (metadata.propertyId) {
      action.propertyId = metadata.propertyId;
    }

    this.recoveryData.userActions.push(action);
    
    // Keep only last 50 actions
    if (this.recoveryData.userActions.length > 50) {
      this.recoveryData.userActions = this.recoveryData.userActions.slice(-50);
    }
  }

  private startPeriodicCleanup(): void {
    if (this.config.autoCleanup) {
      setInterval(() => {
        this.performCleanup();
      }, 60 * 60 * 1000); // Every hour
    }
  }

  private performCleanup(): void {
    try {
      // Check storage quota
      if (this.getStorageUsage() > this.config.maxStorageSize * 0.8) {
        this.cleanupOldData();
      }

      // Clean expired sessions
      const allKeys = this.getAllStorageKeys();
      allKeys.forEach(key => {
        if (key.includes('session_') && key !== 'current_session') {
          const data = this.getFromStorage(key);
          if (data && data.lastAccessed) {
            const age = Date.now() - new Date(data.lastAccessed).getTime();
            if (age > this.config.sessionTimeout * 2) {
              this.removeFromStorage(key);
            }
          }
        }
      });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  private cleanupOldData(): void {
    // Remove old analytics data
    const analytics = this.getFromStorage<SessionAnalytics>('session_analytics');
    if (analytics) {
      // Keep only top 10 most used properties
      const sortedProperties = Object.entries(analytics.mostUsedProperties)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      analytics.mostUsedProperties = Object.fromEntries(sortedProperties);
      this.saveToStorage('session_analytics', analytics);
    }

    // Trim recovery data
    if (this.recoveryData.userActions.length > 25) {
      this.recoveryData.userActions = this.recoveryData.userActions.slice(-25);
      this.saveToStorage('recovery_data', this.recoveryData);
    }
  }

  private handleStorageError(error: Error): void {
    console.error('Storage error:', error);
    this.recordAction('error_recovery', { error: error.message, type: 'storage' });
    this.updateAnalytics('error_recovery');
  }

  private getDefaultPreferences(): PropertyUserPreferences {
    return {
      autoSelectLastUsed: true,
      defaultView: 'dashboard',
      preferredDateRange: 'last_30_days',
      notificationSettings: {
        propertySwitch: true,
        errorNotifications: true,
        permissionChanges: true
      },
      dashboardLayout: {},
      favoriteProperties: []
    };
  }

  private initializeAnalytics(): SessionAnalytics {
    const stored = this.getFromStorage<SessionAnalytics>('session_analytics');
    return stored || {
      sessionDuration: 0,
      propertySwitches: 0,
      errorsEncountered: 0,
      averagePropertySwitchTime: 0,
      mostUsedProperties: {},
      preferredFeatures: []
    };
  }

  private initializeRecoveryData(): SessionRecoveryData {
    const stored = this.getFromStorage<SessionRecoveryData>('recovery_data');
    return stored || {
      lastKnownState: null,
      recoveryTimestamp: new Date(),
      errorContext: [],
      fallbackProperties: [],
      userActions: []
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Storage utilities
  private saveToStorage<T>(key: string, data: T): void {
    try {
      const serialized = JSON.stringify(data);
      const compressed = this.compressionEnabled ? this.compressData(serialized) : serialized;
      localStorage.setItem(`${this.config.storageKey}_${key}`, compressed);
    } catch (error) {
      throw new Error(`Failed to save to storage: ${error}`);
    }
  }

  private getFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`${this.config.storageKey}_${key}`);
      if (!item) return null;

      const decompressed = this.compressionEnabled ? this.decompressData(item) : item;
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn(`Failed to get from storage: ${error}`);
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    try {
      localStorage.removeItem(`${this.config.storageKey}_${key}`);
    } catch (error) {
      console.warn(`Failed to remove from storage: ${error}`);
    }
  }

  private getAllStorageKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.config.storageKey)) {
        keys.push(key);
      }
    }
    return keys;
  }

  private getStorageUsage(): number {
    let total = 0;
    this.getAllStorageKeys().forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        total += item.length;
      }
    });
    return total;
  }

  private compressData(data: string): string {
    // Simple compression placeholder - in production, use a proper compression library
    return btoa(data);
  }

  private decompressData(data: string): string {
    // Simple decompression placeholder - in production, use a proper compression library
    return atob(data);
  }
}

// Singleton instance
export const enhancedSessionPersistence = new EnhancedSessionPersistence();

// Export types for external use
export type {
  SessionPersistenceConfig,
  PropertySession,
  PropertyUserPreferences,
  SessionRecoveryData,
  SessionAnalytics,
  SessionAction
};

export default enhancedSessionPersistence;