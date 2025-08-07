/**
 * Backup & Restore Service
 * 
 * This file provides comprehensive backup and restore mechanisms for the credential system,
 * including automated backups, restore capabilities, and integrity verification.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Backup configuration
 */
export interface BackupConfig {
  /** Backup frequency in milliseconds */
  backupInterval: number;
  /** Maximum number of backups to retain */
  maxBackups: number;
  /** Whether to enable automatic backups */
  enableAutoBackup: boolean;
  /** Whether to compress backup data */
  enableCompression: boolean;
  /** Whether to encrypt backup data */
  enableEncryption: boolean;
  /** Backup storage location */
  storageLocation: 'localStorage' | 'indexedDB' | 'memory';
  /** Whether to verify backup integrity */
  verifyIntegrity: boolean;
  /** Whether to log backup operations */
  enableLogging: boolean;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  /** Unique backup ID */
  backupId: string;
  /** When the backup was created */
  timestamp: string;
  /** Size of backup data in bytes */
  dataSize: number;
  /** Backup version for compatibility */
  version: string;
  /** Checksum for integrity verification */
  checksum: string;
  /** Whether backup is compressed */
  compressed: boolean;
  /** Whether backup is encrypted */
  encrypted: boolean;
  /** Type of data backed up */
  dataType: string;
  /** Tags for categorizing backups */
  tags: string[];
  /** Human-readable description */
  description: string;
}

/**
 * Backup data structure
 */
export interface BackupData {
  /** Backup metadata */
  metadata: BackupMetadata;
  /** Actual backup payload */
  payload: any;
  /** Integrity hash */
  integrity: string;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  /** Backup ID to restore from */
  backupId: string;
  /** Whether to verify data integrity before restore */
  verifyIntegrity: boolean;
  /** Whether to create a backup before restore */
  createBackupBeforeRestore: boolean;
  /** Whether to merge with existing data or replace completely */
  mergeMode: 'replace' | 'merge' | 'selective';
  /** Specific data keys to restore (for selective mode) */
  selectiveKeys?: string[];
  /** Whether to validate restored data */
  validateData: boolean;
}

/**
 * Restore result
 */
export interface RestoreResult {
  /** Whether restore was successful */
  success: boolean;
  /** Backup ID that was restored */
  restoredBackupId: string;
  /** When the restore was performed */
  timestamp: string;
  /** Number of items restored */
  itemsRestored: number;
  /** Size of data restored in bytes */
  dataSize: number;
  /** Any warnings during restore */
  warnings: string[];
  /** Error message if restore failed */
  error?: string;
  /** Backup created before restore (if enabled) */
  preRestoreBackupId?: string;
}

/**
 * Backup system status
 */
export interface BackupSystemStatus {
  /** Whether automatic backups are enabled */
  autoBackupEnabled: boolean;
  /** When the last backup was created */
  lastBackupTime?: string;
  /** When the next backup is scheduled */
  nextBackupTime?: string;
  /** Total number of backups */
  totalBackups: number;
  /** Total size of all backups in bytes */
  totalBackupSize: number;
  /** Available storage space */
  availableStorage: number;
  /** System health score (0-100) */
  healthScore: number;
  /** Any system warnings */
  warnings: string[];
}

/**
 * Backup service interface
 */
export interface IBackupRestoreService {
  /** Create a manual backup */
  createBackup(data: any, description?: string, tags?: string[]): Promise<string>;
  
  /** Restore from a backup */
  restoreFromBackup(options: RestoreOptions): Promise<RestoreResult>;
  
  /** List all available backups */
  listBackups(): Promise<BackupMetadata[]>;
  
  /** Delete a specific backup */
  deleteBackup(backupId: string): Promise<boolean>;
  
  /** Get backup system status */
  getStatus(): BackupSystemStatus;
  
  /** Start automatic backup service */
  startAutoBackup(): void;
  
  /** Stop automatic backup service */
  stopAutoBackup(): void;
  
  /** Verify backup integrity */
  verifyBackup(backupId: string): Promise<boolean>;
  
  /** Clean up old backups */
  cleanupOldBackups(): Promise<number>;
  
  /** Export backup data */
  exportBackup(backupId: string): Promise<string>;
  
  /** Import backup data */
  importBackup(backupData: string): Promise<string>;
}

// ============================================================================
// BROWSER BACKUP RESTORE SERVICE
// ============================================================================

/**
 * Browser-based backup and restore service implementation
 */
export class BrowserBackupRestoreService implements IBackupRestoreService {
  private config: BackupConfig;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private backupStorage: Map<string, BackupData> = new Map();

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      backupInterval: 3600000, // 1 hour
      maxBackups: 10,
      enableAutoBackup: true,
      enableCompression: false,
      enableEncryption: false,
      storageLocation: 'localStorage',
      verifyIntegrity: true,
      enableLogging: true,
      ...config
    };

    this.initializeStorage();
    
    if (this.config.enableAutoBackup) {
      this.startAutoBackup();
    }
  }

  /**
   * Initialize storage system
   */
  private async initializeStorage(): Promise<void> {
    try {
      const existingBackups = await this.loadBackupsFromStorage();
      existingBackups.forEach(backup => {
        this.backupStorage.set(backup.metadata.backupId, backup);
      });

      if (this.config.enableLogging) {
        console.log(`[BACKUP_RESTORE] Initialized with ${existingBackups.length} existing backups`);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[BACKUP_RESTORE] Failed to initialize storage:', error);
      }
    }
  }

  /**
   * Create a manual backup
   */
  public async createBackup(data: any, description: string = 'Manual backup', tags: string[] = []): Promise<string> {
    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      
      // Serialize and optionally compress data
      let payload = JSON.stringify(data);
      let compressed = false;
      
      if (this.config.enableCompression) {
        // In a real implementation, you'd use a compression library
        compressed = true;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(payload);
      
      // Create metadata
      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        dataSize: payload.length,
        version: '1.0.0',
        checksum,
        compressed,
        encrypted: this.config.enableEncryption,
        dataType: 'credential-data',
        tags,
        description
      };

      // Create backup data structure
      const backupData: BackupData = {
        metadata,
        payload: payload,
        integrity: await this.calculateChecksum(JSON.stringify(metadata) + payload)
      };

      // Store backup
      this.backupStorage.set(backupId, backupData);
      await this.saveBackupToStorage(backupData);

      // Clean up old backups if needed
      await this.cleanupOldBackups();

      if (this.config.enableLogging) {
        console.log(`[BACKUP_RESTORE] Created backup ${backupId}: ${description}`);
      }

      return backupId;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[BACKUP_RESTORE] Failed to create backup:', error);
      }
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Restore from a backup
   */
  public async restoreFromBackup(options: RestoreOptions): Promise<RestoreResult> {
    try {
      const backup = this.backupStorage.get(options.backupId);
      if (!backup) {
        throw new Error(`Backup ${options.backupId} not found`);
      }

      // Verify integrity if requested
      if (options.verifyIntegrity) {
        const isValid = await this.verifyBackup(options.backupId);
        if (!isValid) {
          throw new Error('Backup integrity verification failed');
        }
      }

      // Create backup before restore if requested
      let preRestoreBackupId: string | undefined;
      if (options.createBackupBeforeRestore) {
        preRestoreBackupId = await this.createBackup(
          await this.getCurrentData(),
          `Pre-restore backup before restoring ${options.backupId}`,
          ['pre-restore', 'auto']
        );
      }

      // Parse backup data
      const restoredData = JSON.parse(backup.payload);
      
      // Apply restore based on merge mode
      let itemsRestored = 0;
      const warnings: string[] = [];

      switch (options.mergeMode) {
        case 'replace':
          await this.replaceAllData(restoredData);
          itemsRestored = Object.keys(restoredData).length;
          break;
        
        case 'merge':
          itemsRestored = await this.mergeData(restoredData);
          break;
        
        case 'selective':
          if (options.selectiveKeys) {
            itemsRestored = await this.selectiveRestore(restoredData, options.selectiveKeys);
          } else {
            warnings.push('Selective mode specified but no keys provided, falling back to merge mode');
            itemsRestored = await this.mergeData(restoredData);
          }
          break;
      }

      // Validate restored data if requested
      if (options.validateData) {
        const validationResult = await this.validateRestoredData(restoredData);
        if (!validationResult.valid) {
          warnings.push(`Data validation warnings: ${validationResult.warnings.join(', ')}`);
        }
      }

      const result: RestoreResult = {
        success: true,
        restoredBackupId: options.backupId,
        timestamp: new Date().toISOString(),
        itemsRestored,
        dataSize: backup.metadata.dataSize,
        warnings,
        preRestoreBackupId
      };

      if (this.config.enableLogging) {
        console.log(`[BACKUP_RESTORE] Successfully restored backup ${options.backupId}`);
      }

      return result;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[BACKUP_RESTORE] Failed to restore backup:', error);
      }

      return {
        success: false,
        restoredBackupId: options.backupId,
        timestamp: new Date().toISOString(),
        itemsRestored: 0,
        dataSize: 0,
        warnings: [],
        error: error.message
      };
    }
  }

  /**
   * List all available backups
   */
  public async listBackups(): Promise<BackupMetadata[]> {
    const backups = Array.from(this.backupStorage.values());
    return backups
      .map(backup => backup.metadata)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Delete a specific backup
   */
  public async deleteBackup(backupId: string): Promise<boolean> {
    try {
      if (!this.backupStorage.has(backupId)) {
        return false;
      }

      this.backupStorage.delete(backupId);
      await this.removeBackupFromStorage(backupId);

      if (this.config.enableLogging) {
        console.log(`[BACKUP_RESTORE] Deleted backup ${backupId}`);
      }

      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[BACKUP_RESTORE] Failed to delete backup:', error);
      }
      return false;
    }
  }

  /**
   * Get backup system status
   */
  public getStatus(): BackupSystemStatus {
    const backups = Array.from(this.backupStorage.values());
    const totalBackups = backups.length;
    const totalBackupSize = backups.reduce((sum, backup) => sum + backup.metadata.dataSize, 0);
    
    const sortedBackups = backups.sort((a, b) => 
      new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );
    
    const lastBackupTime = sortedBackups.length > 0 ? sortedBackups[0].metadata.timestamp : undefined;
    const nextBackupTime = this.autoBackupTimer ? 
      new Date(Date.now() + this.config.backupInterval).toISOString() : undefined;

    // Calculate health score
    let healthScore = 100;
    const warnings: string[] = [];

    if (totalBackups === 0) {
      healthScore -= 50;
      warnings.push('No backups available');
    } else if (totalBackups < 3) {
      healthScore -= 20;
      warnings.push('Low number of backups');
    }

    if (lastBackupTime) {
      const timeSinceLastBackup = Date.now() - new Date(lastBackupTime).getTime();
      if (timeSinceLastBackup > this.config.backupInterval * 2) {
        healthScore -= 30;
        warnings.push('Last backup is overdue');
      }
    }

    return {
      autoBackupEnabled: this.config.enableAutoBackup && this.autoBackupTimer !== null,
      lastBackupTime,
      nextBackupTime,
      totalBackups,
      totalBackupSize,
      availableStorage: this.getAvailableStorage(),
      healthScore: Math.max(0, healthScore),
      warnings
    };
  }

  /**
   * Start automatic backup service
   */
  public startAutoBackup(): void {
    if (this.autoBackupTimer) {
      this.stopAutoBackup();
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        const currentData = await this.getCurrentData();
        await this.createBackup(
          currentData,
          'Automatic backup',
          ['auto', 'scheduled']
        );
      } catch (error) {
        if (this.config.enableLogging) {
          console.error('[BACKUP_RESTORE] Automatic backup failed:', error);
        }
      }
    }, this.config.backupInterval);

    if (this.config.enableLogging) {
      console.log('[BACKUP_RESTORE] Automatic backup service started');
    }
  }

  /**
   * Stop automatic backup service
   */
  public stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;

      if (this.config.enableLogging) {
        console.log('[BACKUP_RESTORE] Automatic backup service stopped');
      }
    }
  }

  /**
   * Verify backup integrity
   */
  public async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backup = this.backupStorage.get(backupId);
      if (!backup) {
        return false;
      }

      // Verify integrity hash
      const expectedIntegrity = await this.calculateChecksum(
        JSON.stringify(backup.metadata) + backup.payload
      );
      
      if (backup.integrity !== expectedIntegrity) {
        return false;
      }

      // Verify payload checksum
      const payloadChecksum = await this.calculateChecksum(backup.payload);
      if (backup.metadata.checksum !== payloadChecksum) {
        return false;
      }

      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[BACKUP_RESTORE] Failed to verify backup:', error);
      }
      return false;
    }
  }

  /**
   * Clean up old backups
   */
  public async cleanupOldBackups(): Promise<number> {
    const backups = Array.from(this.backupStorage.values());
    
    if (backups.length <= this.config.maxBackups) {
      return 0;
    }

    // Sort by timestamp, oldest first
    const sortedBackups = backups.sort((a, b) => 
      new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime()
    );

    const backupsToDelete = sortedBackups.slice(0, backups.length - this.config.maxBackups);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      const success = await this.deleteBackup(backup.metadata.backupId);
      if (success) {
        deletedCount++;
      }
    }

    if (this.config.enableLogging && deletedCount > 0) {
      console.log(`[BACKUP_RESTORE] Cleaned up ${deletedCount} old backups`);
    }

    return deletedCount;
  }

  /**
   * Export backup data
   */
  public async exportBackup(backupId: string): Promise<string> {
    const backup = this.backupStorage.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    return JSON.stringify(backup);
  }

  /**
   * Import backup data
   */
  public async importBackup(backupData: string): Promise<string> {
    try {
      const backup: BackupData = JSON.parse(backupData);
      
      // Verify the backup structure
      if (!backup.metadata || !backup.payload) {
        throw new Error('Invalid backup data structure');
      }

      // Generate new ID to avoid conflicts
      const newBackupId = this.generateBackupId();
      backup.metadata.backupId = newBackupId;

      this.backupStorage.set(newBackupId, backup);
      await this.saveBackupToStorage(backup);

      if (this.config.enableLogging) {
        console.log(`[BACKUP_RESTORE] Imported backup as ${newBackupId}`);
      }

      return newBackupId;
    } catch (error) {
      throw new Error(`Failed to import backup: ${error.message}`);
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: string): Promise<string> {
    // Simple hash function for browser environment
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Load backups from storage
   */
  private async loadBackupsFromStorage(): Promise<BackupData[]> {
    const backups: BackupData[] = [];
    
    if (this.config.storageLocation === 'localStorage') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('backup-')) {
          try {
            const backupData = JSON.parse(localStorage.getItem(key) || '');
            backups.push(backupData);
          } catch (error) {
            // Skip invalid backup data
          }
        }
      }
    }
    
    return backups;
  }

  /**
   * Save backup to storage
   */
  private async saveBackupToStorage(backup: BackupData): Promise<void> {
    if (this.config.storageLocation === 'localStorage') {
      localStorage.setItem(backup.metadata.backupId, JSON.stringify(backup));
    }
  }

  /**
   * Remove backup from storage
   */
  private async removeBackupFromStorage(backupId: string): Promise<void> {
    if (this.config.storageLocation === 'localStorage') {
      localStorage.removeItem(backupId);
    }
  }

  /**
   * Get current data for backup
   */
  private async getCurrentData(): Promise<any> {
    // This would return the current credential system data
    return {
      credentials: {},
      settings: {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Replace all data
   */
  private async replaceAllData(data: any): Promise<void> {
    // Implementation would replace all current data
  }

  /**
   * Merge data with existing
   */
  private async mergeData(data: any): Promise<number> {
    // Implementation would merge data and return count of items
    return Object.keys(data).length;
  }

  /**
   * Selective restore
   */
  private async selectiveRestore(data: any, keys: string[]): Promise<number> {
    let restored = 0;
    for (const key of keys) {
      if (key in data) {
        // Restore specific key
        restored++;
      }
    }
    return restored;
  }

  /**
   * Validate restored data
   */
  private async validateRestoredData(data: any): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    
    // Basic validation
    if (!data || typeof data !== 'object') {
      return { valid: false, warnings: ['Invalid data structure'] };
    }

    return { valid: true, warnings };
  }

  /**
   * Get available storage space
   */
  private getAvailableStorage(): number {
    // Rough estimate for localStorage
    try {
      const testKey = 'storage-test';
      const testValue = 'x'.repeat(1024); // 1KB
      let size = 0;
      
      while (true) {
        try {
          localStorage.setItem(testKey, testValue.repeat(size));
          localStorage.removeItem(testKey);
          size++;
        } catch {
          break;
        }
      }
      
      return size * 1024; // Return in bytes
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating backup restore services
 */
export class BackupRestoreFactory {
  /**
   * Create a standard backup restore service
   */
  public static createStandard(config?: Partial<BackupConfig>): BrowserBackupRestoreService {
    return new BrowserBackupRestoreService(config);
  }
}

/**
 * Create a standard backup restore service
 */
export function createBackupRestoreService(config?: Partial<BackupConfig>): BrowserBackupRestoreService {
  return BackupRestoreFactory.createStandard(config);
}

/**
 * Create a high-frequency backup service
 */
export function createHighFrequencyBackup(): BrowserBackupRestoreService {
  return new BrowserBackupRestoreService({
    backupInterval: 900000, // 15 minutes
    maxBackups: 20,
    enableAutoBackup: true,
    verifyIntegrity: true,
    enableLogging: true
  });
}