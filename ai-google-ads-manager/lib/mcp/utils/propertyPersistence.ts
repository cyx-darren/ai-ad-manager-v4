/**
 * Property State Persistence Utilities
 * 
 * Utilities for persisting property selection state across sessions,
 * with cross-tab synchronization, encryption, and state migration.
 */

import { 
  GA4Property, 
  PropertySelectionState,
  PropertyFilter,
  PropertySort,
  PropertyError,
  PropertyErrorCode
} from '../types/property';

// Storage keys
const STORAGE_KEYS = {
  SELECTED_PROPERTY: 'ga4-selected-property',
  PROPERTY_SELECTION_STATE: 'ga4-property-selection-state',
  PROPERTY_FILTER: 'ga4-property-filter',
  PROPERTY_SORT: 'ga4-property-sort',
  PROPERTY_CACHE: 'ga4-property-cache',
  LAST_SYNC: 'ga4-property-last-sync'
} as const;

// Persistence configuration
export interface PropertyPersistenceConfig {
  enableEncryption: boolean;
  enableCrossTabs: boolean;
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  maxRetries: number;
  compressionEnabled: boolean;
}

export const DEFAULT_PERSISTENCE_CONFIG: PropertyPersistenceConfig = {
  enableEncryption: false, // Disabled by default for development
  enableCrossTabs: true,
  enableAutoSync: true,
  syncInterval: 5000, // 5 seconds
  maxRetries: 3,
  compressionEnabled: true
};

// Persisted property state interface
export interface PersistedPropertyState {
  selectedProperty: GA4Property | null;
  filter: PropertyFilter;
  sort: PropertySort;
  lastUpdated: string;
  version: string;
}

// Property persistence service
export class PropertyPersistenceService {
  private config: PropertyPersistenceConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private storageEventListener: ((event: StorageEvent) => void) | null = null;
  private isListening = false;

  constructor(config?: Partial<PropertyPersistenceConfig>) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
    
    if (this.config.enableCrossTabs) {
      this.startCrossTabSync();
    }
  }

  /**
   * Save property selection state
   */
  async savePropertySelection(property: GA4Property | null): Promise<void> {
    try {
      const data = {
        property,
        timestamp: new Date().toISOString()
      };

      const serializedData = this.serializeData(data);
      
      if (this.config.enableEncryption) {
        const encrypted = await this.encrypt(serializedData);
        localStorage.setItem(STORAGE_KEYS.SELECTED_PROPERTY, encrypted);
      } else {
        localStorage.setItem(STORAGE_KEYS.SELECTED_PROPERTY, serializedData);
      }

      // Also save just the ID for quick access
      if (property) {
        localStorage.setItem('ga4-selected-property-id', property.id);
      } else {
        localStorage.removeItem('ga4-selected-property-id');
      }

      console.log('💾 Saved property selection:', property ? `${property.name} (${property.id})` : 'None');
    } catch (error) {
      console.error('❌ Failed to save property selection:', error);
      throw this.createPersistenceError('Failed to save property selection', error);
    }
  }

  /**
   * Load property selection state
   */
  async loadPropertySelection(): Promise<GA4Property | null> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_PROPERTY);
      if (!stored) return null;

      let data;
      if (this.config.enableEncryption) {
        const decrypted = await this.decrypt(stored);
        data = this.deserializeData(decrypted);
      } else {
        data = this.deserializeData(stored);
      }

      console.log('📂 Loaded property selection:', data.property ? `${data.property.name} (${data.property.id})` : 'None');
      return data.property;
    } catch (error) {
      console.warn('⚠️ Failed to load property selection:', error);
      return null;
    }
  }

  /**
   * Save complete property selection state
   */
  async savePropertyState(state: Partial<PropertySelectionState>): Promise<void> {
    try {
      const persistedState: PersistedPropertyState = {
        selectedProperty: state.selectedProperty || null,
        filter: state.filter || {} as PropertyFilter,
        sort: state.sort || {} as PropertySort,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };

      const serializedData = this.serializeData(persistedState);
      
      if (this.config.enableEncryption) {
        const encrypted = await this.encrypt(serializedData);
        localStorage.setItem(STORAGE_KEYS.PROPERTY_SELECTION_STATE, encrypted);
      } else {
        localStorage.setItem(STORAGE_KEYS.PROPERTY_SELECTION_STATE, serializedData);
      }

      console.log('💾 Saved property state');
    } catch (error) {
      console.error('❌ Failed to save property state:', error);
      throw this.createPersistenceError('Failed to save property state', error);
    }
  }

  /**
   * Load complete property selection state
   */
  async loadPropertyState(): Promise<PersistedPropertyState | null> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROPERTY_SELECTION_STATE);
      if (!stored) return null;

      let data: PersistedPropertyState;
      if (this.config.enableEncryption) {
        const decrypted = await this.decrypt(stored);
        data = this.deserializeData(decrypted);
      } else {
        data = this.deserializeData(stored);
      }

      // Migrate old versions if needed
      const migratedData = this.migrateState(data);

      console.log('📂 Loaded property state');
      return migratedData;
    } catch (error) {
      console.warn('⚠️ Failed to load property state:', error);
      return null;
    }
  }

  /**
   * Clear all persisted property data
   */
  clearPropertyState(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Also clear the simple ID key
      localStorage.removeItem('ga4-selected-property-id');
      
      console.log('🗑️ Cleared all property state');
    } catch (error) {
      console.error('❌ Failed to clear property state:', error);
    }
  }

  /**
   * Check if property state exists
   */
  hasPropertyState(): boolean {
    return localStorage.getItem(STORAGE_KEYS.PROPERTY_SELECTION_STATE) !== null ||
           localStorage.getItem(STORAGE_KEYS.SELECTED_PROPERTY) !== null;
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    totalSize: number;
    keyCount: number;
    details: Record<string, number>;
  } {
    const details: Record<string, number> = {};
    let totalSize = 0;
    let keyCount = 0;

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const value = localStorage.getItem(key);
      if (value) {
        const size = new Blob([value]).size;
        details[name] = size;
        totalSize += size;
        keyCount++;
      }
    });

    return { totalSize, keyCount, details };
  }

  /**
   * Start cross-tab synchronization
   */
  private startCrossTabSync(): void {
    if (this.isListening) return;

    this.storageEventListener = (event: StorageEvent) => {
      if (Object.values(STORAGE_KEYS).includes(event.key as any)) {
        console.log('🔄 Cross-tab property sync detected:', event.key);
        
        // Emit custom event for components to listen to
        window.dispatchEvent(new CustomEvent('property-state-changed', {
          detail: {
            key: event.key,
            oldValue: event.oldValue,
            newValue: event.newValue
          }
        }));
      }
    };

    window.addEventListener('storage', this.storageEventListener);
    this.isListening = true;

    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }

    console.log('🔄 Started cross-tab property sync');
  }

  /**
   * Stop cross-tab synchronization
   */
  private stopCrossTabSync(): void {
    if (this.storageEventListener) {
      window.removeEventListener('storage', this.storageEventListener);
      this.storageEventListener = null;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.isListening = false;
    console.log('⏹️ Stopped cross-tab property sync');
  }

  /**
   * Start automatic synchronization
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncWithStorage();
    }, this.config.syncInterval);
  }

  /**
   * Sync with storage (for auto-sync)
   */
  private async syncWithStorage(): Promise<void> {
    try {
      const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      const currentTime = new Date().toISOString();

      // Update last sync timestamp
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, currentTime);

      // You can add additional sync logic here if needed
    } catch (error) {
      console.warn('⚠️ Auto-sync failed:', error);
    }
  }

  /**
   * Serialize data for storage
   */
  private serializeData(data: any): string {
    const serialized = JSON.stringify(data);
    
    if (this.config.compressionEnabled) {
      // Simple compression using base64 (in a real app, you might use a compression library)
      return btoa(serialized);
    }
    
    return serialized;
  }

  /**
   * Deserialize data from storage
   */
  private deserializeData(data: string): any {
    try {
      let parsed;
      
      if (this.config.compressionEnabled) {
        // Decompress from base64
        const decompressed = atob(data);
        parsed = JSON.parse(decompressed);
      } else {
        parsed = JSON.parse(data);
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to deserialize data: ${error}`);
    }
  }

  /**
   * Encrypt data (basic implementation)
   */
  private async encrypt(data: string): Promise<string> {
    // This is a basic implementation
    // In production, use Web Crypto API or similar
    return btoa(data);
  }

  /**
   * Decrypt data (basic implementation)
   */
  private async decrypt(data: string): Promise<string> {
    // This is a basic implementation
    // In production, use Web Crypto API or similar
    return atob(data);
  }

  /**
   * Migrate state from older versions
   */
  private migrateState(state: any): PersistedPropertyState {
    // Handle migration from older state formats
    if (!state.version || state.version === '1.0') {
      return state as PersistedPropertyState;
    }

    // Add migration logic for future versions here
    return state as PersistedPropertyState;
  }

  /**
   * Create a persistence error
   */
  private createPersistenceError(message: string, originalError?: any): PropertyError {
    return {
      code: PropertyErrorCode.UNKNOWN_ERROR,
      message,
      details: originalError,
      timestamp: new Date().toISOString(),
      retryable: true,
      suggestedAction: 'Try clearing browser data and refreshing the page'
    };
  }

  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    this.stopCrossTabSync();
    console.log('💥 Property persistence service destroyed');
  }
}

// Global persistence service instance
let globalPersistenceService: PropertyPersistenceService | null = null;

/**
 * Get or create the global persistence service
 */
export function getPropertyPersistenceService(config?: Partial<PropertyPersistenceConfig>): PropertyPersistenceService {
  if (!globalPersistenceService) {
    globalPersistenceService = new PropertyPersistenceService(config);
  }
  return globalPersistenceService;
}

/**
 * Create a new persistence service instance
 */
export function createPropertyPersistenceService(config?: Partial<PropertyPersistenceConfig>): PropertyPersistenceService {
  return new PropertyPersistenceService(config);
}

// Utility functions for common persistence operations

/**
 * Quick save property selection
 */
export async function saveSelectedProperty(property: GA4Property | null): Promise<void> {
  const service = getPropertyPersistenceService();
  return service.savePropertySelection(property);
}

/**
 * Quick load property selection
 */
export async function loadSelectedProperty(): Promise<GA4Property | null> {
  const service = getPropertyPersistenceService();
  return service.loadPropertySelection();
}

/**
 * Quick save property state
 */
export async function savePropertyState(state: Partial<PropertySelectionState>): Promise<void> {
  const service = getPropertyPersistenceService();
  return service.savePropertyState(state);
}

/**
 * Quick load property state
 */
export async function loadPropertyState(): Promise<PersistedPropertyState | null> {
  const service = getPropertyPersistenceService();
  return service.loadPropertyState();
}

/**
 * Quick clear all property data
 */
export function clearAllPropertyData(): void {
  const service = getPropertyPersistenceService();
  service.clearPropertyState();
}

/**
 * Check if browser supports required storage features
 */
export function checkStorageSupport(): {
  localStorage: boolean;
  sessionStorage: boolean;
  webCrypto: boolean;
  storageEvents: boolean;
} {
  return {
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
    storageEvents: typeof window !== 'undefined' && 'addEventListener' in window
  };
}

export default PropertyPersistenceService;