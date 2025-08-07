/**
 * MCP Credential Storage Architecture
 * 
 * This file defines the secure storage architecture for GA4 credentials
 * with encryption, integrity validation, and lifecycle management.
 */

import {
  EncryptedCredential,
  CredentialStorageConfig,
  CredentialStorageEntry,
  CredentialStorageIndex,
  CredentialOperationResult,
  CredentialSearchFilters,
  CredentialLifecycleEvent,
  CredentialAuditEntry,
  CredentialError,
  CredentialId,
  CredentialAlias
} from './types';

// ============================================================================
// STORAGE ARCHITECTURE INTERFACE
// ============================================================================

/**
 * Abstract storage interface for credential persistence
 */
export interface ICredentialStorage {
  // Core CRUD operations
  store(credential: EncryptedCredential): Promise<CredentialOperationResult<CredentialId>>;
  retrieve(id: CredentialId): Promise<CredentialOperationResult<EncryptedCredential>>;
  update(id: CredentialId, credential: Partial<EncryptedCredential>): Promise<CredentialOperationResult<boolean>>;
  delete(id: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Query operations
  list(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<EncryptedCredential[]>>;
  exists(id: CredentialId): Promise<boolean>;
  count(filters?: CredentialSearchFilters): Promise<number>;
  
  // Alias operations
  getByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<EncryptedCredential>>;
  setAlias(id: CredentialId, alias: CredentialAlias): Promise<CredentialOperationResult<boolean>>;
  
  // Maintenance operations
  cleanup(): Promise<CredentialOperationResult<number>>;
  vacuum(): Promise<CredentialOperationResult<boolean>>;
  backup(): Promise<CredentialOperationResult<string>>;
  restore(backupData: string): Promise<CredentialOperationResult<number>>;
  
  // Index operations
  getIndex(): Promise<CredentialStorageIndex>;
  rebuildIndex(): Promise<CredentialOperationResult<boolean>>;
}

// ============================================================================
// BROWSER STORAGE IMPLEMENTATION
// ============================================================================

/**
 * Browser-based credential storage using localStorage with encryption
 */
export class BrowserCredentialStorage implements ICredentialStorage {
  private config: CredentialStorageConfig;
  private indexKey: string = 'mcp_credential_index';
  private auditKey: string = 'mcp_credential_audit';
  
  constructor(config: Partial<CredentialStorageConfig> = {}) {
    this.config = {
      storageType: 'localStorage',
      encryptionEnabled: true,
      compressionEnabled: false,
      backupEnabled: true,
      maxCredentials: 50,
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
      ...config
    };
  }
  
  async store(credential: EncryptedCredential): Promise<CredentialOperationResult<CredentialId>> {
    try {
      // Validate credential structure
      this.validateCredential(credential);
      
      // Check storage limits
      const currentCount = await this.count();
      if (currentCount >= this.config.maxCredentials) {
        throw new CredentialError(
          `Storage limit exceeded. Maximum ${this.config.maxCredentials} credentials allowed.`,
          'STORAGE_LIMIT_EXCEEDED'
        );
      }
      
      // Create storage entry
      const entry: CredentialStorageEntry = {
        id: credential.id,
        alias: credential.alias,
        data: credential,
        storageTimestamp: new Date().toISOString(),
        accessTimestamp: new Date().toISOString(),
        accessCount: 0
      };
      
      // Store credential
      const storageKey = this.getCredentialKey(credential.id);
      await this.setStorageItem(storageKey, entry);
      
      // Update index
      await this.updateIndex(credential);
      
      // Log audit event
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: credential.id,
        action: 'create',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: true,
        metadata: {
          alias: credential.alias,
          type: credential.metadata.credentialType
        }
      });
      
      return {
        success: true,
        data: credential.id,
        metadata: {
          storageType: this.config.storageType,
          encrypted: this.config.encryptionEnabled
        }
      };
    } catch (error) {
      const credentialError = error instanceof CredentialError 
        ? error 
        : new CredentialError('Failed to store credential', 'STORAGE_ERROR', credential.id, 'store', error);
      
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: credential.id,
        action: 'create',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: false,
        error: credentialError.message
      });
      
      return {
        success: false,
        error: credentialError
      };
    }
  }
  
  async retrieve(id: CredentialId): Promise<CredentialOperationResult<EncryptedCredential>> {
    try {
      const storageKey = this.getCredentialKey(id);
      const entry = await this.getStorageItem<CredentialStorageEntry>(storageKey);
      
      if (!entry) {
        throw new CredentialError(`Credential not found: ${id}`, 'CREDENTIAL_NOT_FOUND', id);
      }
      
      // Check TTL
      const entryAge = Date.now() - new Date(entry.storageTimestamp).getTime();
      if (entryAge > this.config.ttl) {
        await this.delete(id);
        throw new CredentialError(`Credential expired: ${id}`, 'CREDENTIAL_EXPIRED', id);
      }
      
      // Update access tracking
      entry.accessTimestamp = new Date().toISOString();
      entry.accessCount++;
      await this.setStorageItem(storageKey, entry);
      
      // Log audit event
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: id,
        action: 'read',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: true
      });
      
      return {
        success: true,
        data: entry.data,
        metadata: {
          accessCount: entry.accessCount,
          lastAccessed: entry.accessTimestamp
        }
      };
    } catch (error) {
      const credentialError = error instanceof CredentialError 
        ? error 
        : new CredentialError('Failed to retrieve credential', 'RETRIEVAL_ERROR', id, 'retrieve', error);
      
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: id,
        action: 'read',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: false,
        error: credentialError.message
      });
      
      return {
        success: false,
        error: credentialError
      };
    }
  }
  
  async update(id: CredentialId, updates: Partial<EncryptedCredential>): Promise<CredentialOperationResult<boolean>> {
    try {
      const retrieveResult = await this.retrieve(id);
      if (!retrieveResult.success || !retrieveResult.data) {
        throw new CredentialError(`Credential not found for update: ${id}`, 'CREDENTIAL_NOT_FOUND', id);
      }
      
      const updatedCredential: EncryptedCredential = {
        ...retrieveResult.data,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const storageKey = this.getCredentialKey(id);
      const entry = await this.getStorageItem<CredentialStorageEntry>(storageKey);
      
      if (entry) {
        entry.data = updatedCredential;
        await this.setStorageItem(storageKey, entry);
        await this.updateIndex(updatedCredential);
      }
      
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: id,
        action: 'update',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: true,
        metadata: {
          updatedFields: Object.keys(updates)
        }
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      const credentialError = error instanceof CredentialError 
        ? error 
        : new CredentialError('Failed to update credential', 'UPDATE_ERROR', id, 'update', error);
      
      return {
        success: false,
        error: credentialError
      };
    }
  }
  
  async delete(id: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      const storageKey = this.getCredentialKey(id);
      const entry = await this.getStorageItem<CredentialStorageEntry>(storageKey);
      
      if (!entry) {
        throw new CredentialError(`Credential not found for deletion: ${id}`, 'CREDENTIAL_NOT_FOUND', id);
      }
      
      // Remove from storage
      await this.removeStorageItem(storageKey);
      
      // Update index
      await this.removeFromIndex(id);
      
      await this.logAuditEvent({
        id: this.generateId(),
        credentialId: id,
        action: 'delete',
        timestamp: new Date().toISOString(),
        source: 'browser_storage',
        success: true,
        metadata: {
          alias: entry.alias
        }
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      const credentialError = error instanceof CredentialError 
        ? error 
        : new CredentialError('Failed to delete credential', 'DELETE_ERROR', id, 'delete', error);
      
      return {
        success: false,
        error: credentialError
      };
    }
  }
  
  async list(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<EncryptedCredential[]>> {
    try {
      const index = await this.getIndex();
      const credentials: EncryptedCredential[] = [];
      
      for (const [id, indexEntry] of Object.entries(index.entries)) {
        // Apply filters
        if (filters) {
          if (filters.type && indexEntry.type !== filters.type) continue;
          if (filters.createdAfter && indexEntry.createdAt < filters.createdAfter) continue;
          if (filters.createdBefore && indexEntry.createdAt > filters.createdBefore) continue;
          // Add more filter logic as needed
        }
        
        const retrieveResult = await this.retrieve(id);
        if (retrieveResult.success && retrieveResult.data) {
          credentials.push(retrieveResult.data);
        }
      }
      
      return {
        success: true,
        data: credentials,
        metadata: {
          totalFound: credentials.length,
          totalInIndex: index.totalCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError('Failed to list credentials', 'LIST_ERROR', undefined, 'list', error)
      };
    }
  }
  
  async exists(id: CredentialId): Promise<boolean> {
    try {
      const storageKey = this.getCredentialKey(id);
      const entry = await this.getStorageItem<CredentialStorageEntry>(storageKey);
      return entry !== null;
    } catch {
      return false;
    }
  }
  
  async count(filters?: CredentialSearchFilters): Promise<number> {
    try {
      const listResult = await this.list(filters);
      return listResult.success ? listResult.data?.length || 0 : 0;
    } catch {
      return 0;
    }
  }
  
  async getByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<EncryptedCredential>> {
    try {
      const index = await this.getIndex();
      
      for (const [id, indexEntry] of Object.entries(index.entries)) {
        if (indexEntry.alias === alias) {
          return await this.retrieve(id);
        }
      }
      
      throw new CredentialError(`Credential not found with alias: ${alias}`, 'CREDENTIAL_NOT_FOUND');
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve credential by alias', 'ALIAS_RETRIEVAL_ERROR', undefined, 'getByAlias', error)
      };
    }
  }
  
  async setAlias(id: CredentialId, alias: CredentialAlias): Promise<CredentialOperationResult<boolean>> {
    try {
      return await this.update(id, { alias });
    } catch (error) {
      return {
        success: false,
        error: new CredentialError('Failed to set alias', 'ALIAS_SET_ERROR', id, 'setAlias', error)
      };
    }
  }
  
  async cleanup(): Promise<CredentialOperationResult<number>> {
    try {
      const index = await this.getIndex();
      let cleanedCount = 0;
      
      for (const [id, indexEntry] of Object.entries(index.entries)) {
        const entryAge = Date.now() - new Date(indexEntry.createdAt).getTime();
        if (entryAge > this.config.ttl) {
          await this.delete(id);
          cleanedCount++;
        }
      }
      
      return {
        success: true,
        data: cleanedCount,
        metadata: {
          ttl: this.config.ttl,
          totalProcessed: index.totalCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError('Failed to cleanup credentials', 'CLEANUP_ERROR', undefined, 'cleanup', error)
      };
    }
  }
  
  async vacuum(): Promise<CredentialOperationResult<boolean>> {
    try {
      await this.rebuildIndex();
      // Additional vacuum operations can be added here
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError('Failed to vacuum storage', 'VACUUM_ERROR', undefined, 'vacuum', error)
      };
    }
  }
  
  async backup(): Promise<CredentialOperationResult<string>> {
    try {
      if (!this.config.backupEnabled) {
        throw new CredentialError('Backup is disabled', 'BACKUP_DISABLED');
      }
      
      const listResult = await this.list();
      if (!listResult.success || !listResult.data) {
        throw new CredentialError('Failed to get credentials for backup', 'BACKUP_LIST_ERROR');
      }
      
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        credentials: listResult.data,
        config: this.config
      };
      
      return {
        success: true,
        data: JSON.stringify(backupData),
        metadata: {
          credentialCount: listResult.data.length,
          backupSize: JSON.stringify(backupData).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to create backup', 'BACKUP_ERROR', undefined, 'backup', error)
      };
    }
  }
  
  async restore(backupData: string): Promise<CredentialOperationResult<number>> {
    try {
      const backup = JSON.parse(backupData);
      let restoredCount = 0;
      
      if (!backup.credentials || !Array.isArray(backup.credentials)) {
        throw new CredentialError('Invalid backup format', 'INVALID_BACKUP_FORMAT');
      }
      
      for (const credential of backup.credentials) {
        const storeResult = await this.store(credential);
        if (storeResult.success) {
          restoredCount++;
        }
      }
      
      return {
        success: true,
        data: restoredCount,
        metadata: {
          totalInBackup: backup.credentials.length,
          backupVersion: backup.version,
          backupTimestamp: backup.timestamp
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to restore backup', 'RESTORE_ERROR', undefined, 'restore', error)
      };
    }
  }
  
  async getIndex(): Promise<CredentialStorageIndex> {
    try {
      const index = await this.getStorageItem<CredentialStorageIndex>(this.indexKey);
      
      if (!index) {
        // Create new index
        const newIndex: CredentialStorageIndex = {
          version: '1.0',
          entries: {},
          totalCount: 0,
          lastUpdated: new Date().toISOString()
        };
        
        await this.setStorageItem(this.indexKey, newIndex);
        return newIndex;
      }
      
      return index;
    } catch (error) {
      throw new CredentialError('Failed to get storage index', 'INDEX_ERROR', undefined, 'getIndex', error);
    }
  }
  
  async rebuildIndex(): Promise<CredentialOperationResult<boolean>> {
    try {
      const newIndex: CredentialStorageIndex = {
        version: '1.0',
        entries: {},
        totalCount: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Scan all storage items
      const storage = this.getStorage();
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('mcp_credential_')) {
          try {
            const entry = await this.getStorageItem<CredentialStorageEntry>(key);
            if (entry && entry.data) {
              newIndex.entries[entry.id] = {
                alias: entry.alias,
                type: entry.data.metadata.credentialType,
                createdAt: entry.data.createdAt,
                lastAccessed: entry.accessTimestamp,
                metadata: {
                  projectId: entry.data.metadata.projectId,
                  description: entry.data.metadata.description
                }
              };
              newIndex.totalCount++;
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      await this.setStorageItem(this.indexKey, newIndex);
      
      return {
        success: true,
        data: true,
        metadata: {
          rebuiltEntries: newIndex.totalCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new CredentialError('Failed to rebuild index', 'INDEX_REBUILD_ERROR', undefined, 'rebuildIndex', error)
      };
    }
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private validateCredential(credential: EncryptedCredential): void {
    if (!credential.id || !credential.alias || !credential.encryptedData) {
      throw new CredentialError('Invalid credential structure', 'INVALID_CREDENTIAL_STRUCTURE');
    }
    
    if (!credential.metadata || !credential.metadata.credentialType) {
      throw new CredentialError('Missing credential metadata', 'MISSING_METADATA');
    }
  }
  
  private getCredentialKey(id: CredentialId): string {
    return `mcp_credential_${id}`;
  }
  
  private getStorage(): Storage {
    switch (this.config.storageType) {
      case 'localStorage':
        return localStorage;
      case 'sessionStorage':
        return sessionStorage;
      default:
        throw new CredentialError(`Unsupported storage type: ${this.config.storageType}`, 'UNSUPPORTED_STORAGE_TYPE');
    }
  }
  
  private async getStorageItem<T>(key: string): Promise<T | null> {
    try {
      const item = this.getStorage().getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      throw new CredentialError(`Failed to parse storage item: ${key}`, 'STORAGE_PARSE_ERROR', undefined, 'getStorageItem', error);
    }
  }
  
  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    try {
      this.getStorage().setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new CredentialError(`Failed to set storage item: ${key}`, 'STORAGE_SET_ERROR', undefined, 'setStorageItem', error);
    }
  }
  
  private async removeStorageItem(key: string): Promise<void> {
    try {
      this.getStorage().removeItem(key);
    } catch (error) {
      throw new CredentialError(`Failed to remove storage item: ${key}`, 'STORAGE_REMOVE_ERROR', undefined, 'removeStorageItem', error);
    }
  }
  
  private async updateIndex(credential: EncryptedCredential): Promise<void> {
    const index = await this.getIndex();
    
    index.entries[credential.id] = {
      alias: credential.alias,
      type: credential.metadata.credentialType,
      createdAt: credential.createdAt,
      lastAccessed: new Date().toISOString(),
      metadata: {
        projectId: credential.metadata.projectId,
        description: credential.metadata.description
      }
    };
    
    index.totalCount = Object.keys(index.entries).length;
    index.lastUpdated = new Date().toISOString();
    
    await this.setStorageItem(this.indexKey, index);
  }
  
  private async removeFromIndex(id: CredentialId): Promise<void> {
    const index = await this.getIndex();
    
    delete index.entries[id];
    index.totalCount = Object.keys(index.entries).length;
    index.lastUpdated = new Date().toISOString();
    
    await this.setStorageItem(this.indexKey, index);
  }
  
  private async logAuditEvent(event: CredentialAuditEntry): Promise<void> {
    try {
      const auditLog = await this.getStorageItem<CredentialAuditEntry[]>(this.auditKey) || [];
      auditLog.push(event);
      
      // Keep only last 1000 audit entries
      if (auditLog.length > 1000) {
        auditLog.splice(0, auditLog.length - 1000);
      }
      
      await this.setStorageItem(this.auditKey, auditLog);
    } catch {
      // Audit logging is non-critical, so we don't throw errors
    }
  }
  
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}