/**
 * MCP Credential Persistence Service
 * 
 * This file implements secure credential persistence operations
 * with automatic encryption, backup, and recovery capabilities.
 */

import {
  GA4ServiceAccountCredential,
  EncryptedCredential,
  CredentialOperationResult,
  CredentialSearchFilters,
  CredentialError,
  CredentialId,
  CredentialAlias,
  CredentialStorageIndex
} from './types';

import {
  ICredentialStorage,
  BrowserCredentialStorage
} from './storage';

import {
  ICredentialEncryption,
  CredentialEncryptionFactory,
  CredentialKeyManager
} from './encryption';

import {
  ICredentialLifecycle,
  CredentialLifecycleFactory
} from './lifecycle';

import {
  ICredentialValidator,
  CredentialValidatorFactory
} from './validation';

// ============================================================================
// PERSISTENCE SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential persistence operations
 */
export interface ICredentialPersistence {
  // Initialization
  initialize(masterPassword: string): Promise<CredentialOperationResult<boolean>>;
  isInitialized(): boolean;
  
  // Secure persistence operations
  persistCredential(credential: GA4ServiceAccountCredential, alias: string, options?: PersistenceOptions): Promise<CredentialOperationResult<CredentialId>>;
  retrieveCredential(id: CredentialId): Promise<CredentialOperationResult<GA4ServiceAccountCredential>>;
  retrieveCredentialByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<GA4ServiceAccountCredential>>;
  updateCredential(id: CredentialId, updates: Partial<GA4ServiceAccountCredential>): Promise<CredentialOperationResult<boolean>>;
  removeCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Batch operations
  persistBatch(credentials: Array<{ credential: GA4ServiceAccountCredential; alias: string; options?: PersistenceOptions }>): Promise<CredentialOperationResult<CredentialId[]>>;
  retrieveBatch(ids: CredentialId[]): Promise<CredentialOperationResult<GA4ServiceAccountCredential[]>>;
  
  // Query operations
  listCredentials(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<CredentialId[]>>;
  searchCredentials(query: string): Promise<CredentialOperationResult<CredentialId[]>>;
  getCredentialIndex(): Promise<CredentialStorageIndex>;
  
  // Backup and recovery
  createBackup(): Promise<CredentialOperationResult<string>>;
  restoreFromBackup(backupData: string): Promise<CredentialOperationResult<number>>;
  
  // Maintenance operations
  vacuum(): Promise<CredentialOperationResult<boolean>>;
  verifyIntegrity(): Promise<CredentialOperationResult<PersistenceIntegrityReport>>;
  cleanupExpired(): Promise<CredentialOperationResult<number>>;
  
  // Security operations
  rotateEncryption(newPassword: string): Promise<CredentialOperationResult<boolean>>;
  auditAccess(): Promise<CredentialOperationResult<PersistenceAuditReport>>;
}

/**
 * Options for credential persistence
 */
export interface PersistenceOptions {
  validateBeforeStore?: boolean;
  createBackup?: boolean;
  enableLifecycleTracking?: boolean;
  encryptionStrength?: 'standard' | 'high';
  ttl?: number; // Time to live in milliseconds
  metadata?: Record<string, any>;
}

/**
 * Persistence integrity report
 */
export interface PersistenceIntegrityReport {
  totalCredentials: number;
  validCredentials: number;
  corruptedCredentials: number;
  integrityIssues: Array<{
    credentialId: CredentialId;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  verifiedAt: string;
}

/**
 * Persistence audit report
 */
export interface PersistenceAuditReport {
  totalAccess: number;
  accessByCredential: Record<CredentialId, number>;
  recentAccess: Array<{
    credentialId: CredentialId;
    timestamp: string;
    operation: string;
  }>;
  securityEvents: Array<{
    timestamp: string;
    event: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  generatedAt: string;
}

// ============================================================================
// PERSISTENCE SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Secure credential persistence service implementation
 */
export class CredentialPersistence implements ICredentialPersistence {
  private storage: ICredentialStorage;
  private encryption: ICredentialEncryption;
  private lifecycle: ICredentialLifecycle;
  private validator: ICredentialValidator;
  private isInit: boolean = false;
  private masterPassword: string | null = null;
  
  constructor(
    storage?: ICredentialStorage,
    encryption?: ICredentialEncryption,
    lifecycle?: ICredentialLifecycle,
    validator?: ICredentialValidator
  ) {
    this.storage = storage || new BrowserCredentialStorage();
    this.encryption = encryption || CredentialEncryptionFactory.createDefault();
    this.lifecycle = lifecycle || CredentialLifecycleFactory.createDefault();
    this.validator = validator || CredentialValidatorFactory.createDefault();
  }
  
  /**
   * Initialize the persistence service
   */
  async initialize(masterPassword: string): Promise<CredentialOperationResult<boolean>> {
    try {
      // Validate master password
      if (!this.validateMasterPassword(masterPassword)) {
        throw new CredentialError(
          'Master password does not meet security requirements',
          'WEAK_MASTER_PASSWORD'
        );
      }
      
      this.masterPassword = masterPassword;
      
      // Initialize or retrieve master key
      let masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        masterKey = await CredentialKeyManager.generateMasterKey();
        await CredentialKeyManager.storeMasterKey(masterKey);
      }
      
      // Verify storage is accessible
      await this.storage.getIndex();
      
      this.isInit = true;
      
      // Log initialization
      await this.lifecycle.logEvent({
        id: this.generateId(),
        credentialId: 'system',
        event: 'created',
        timestamp: new Date().toISOString(),
        source: 'system',
        metadata: {
          action: 'persistence_initialized'
        }
      });
      
      return {
        success: true,
        data: true,
        metadata: {
          initializedAt: new Date().toISOString(),
          storageType: 'browser'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to initialize persistence service', 'INITIALIZATION_ERROR', undefined, 'initialize', error)
      };
    }
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.isInit && this.masterPassword !== null;
  }
  
  /**
   * Persist a credential securely
   */
  async persistCredential(
    credential: GA4ServiceAccountCredential, 
    alias: string, 
    options: PersistenceOptions = {}
  ): Promise<CredentialOperationResult<CredentialId>> {
    try {
      this.ensureInitialized();
      
      // Apply default options
      const opts: PersistenceOptions = {
        validateBeforeStore: true,
        createBackup: false,
        enableLifecycleTracking: true,
        encryptionStrength: 'standard',
        ...options
      };
      
      // Validate credential if requested
      if (opts.validateBeforeStore) {
        const validationResult = await this.validator.validateGA4Credential(credential);
        if (!validationResult.isValid) {
          throw new CredentialError(
            `Credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
            'VALIDATION_FAILED'
          );
        }
      }
      
      // Create backup if requested
      if (opts.createBackup) {
        await this.createBackup();
      }
      
      // Generate credential ID
      const credentialId = this.generateCredentialId();
      
      // Get master key and derive credential password
      const masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        throw new CredentialError('Master key not found', 'MASTER_KEY_MISSING');
      }
      
      const credentialPassword = await CredentialKeyManager.deriveCredentialPassword(masterKey, credentialId);
      
      // Select encryption service based on strength
      const encryptionService = opts.encryptionStrength === 'high' 
        ? CredentialEncryptionFactory.createHighSecurity()
        : this.encryption;
      
      // Encrypt credential
      const encryptionResult = await encryptionService.encrypt(credential, credentialPassword);
      
      // Create encrypted credential with metadata
      const encryptedCredential: EncryptedCredential = {
        id: credentialId,
        alias,
        encryptedData: encryptionResult.encryptedData,
        metadata: {
          version: '1.0',
          credentialType: 'ga4_service_account',
          projectId: credential.project_id,
          clientEmail: credential.client_email,
          description: `GA4 credential for ${credential.project_id}`,
          tags: [],
          expiresAt: opts.ttl ? new Date(Date.now() + opts.ttl).toISOString() : undefined,
          lastUsed: undefined,
          usageCount: 0,
          ...opts.metadata
        },
        integrity: {
          checksum: encryptionResult.checksum,
          algorithm: 'SHA-256',
          verificationTimestamp: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store credential
      const storeResult = await this.storage.store(encryptedCredential);
      if (!storeResult.success) {
        throw storeResult.error || new CredentialError('Failed to store credential', 'STORAGE_ERROR');
      }
      
      // Initialize lifecycle tracking if enabled
      if (opts.enableLifecycleTracking) {
        await this.lifecycle.setState(credentialId, 'active', 'Credential persisted');
        
        if (opts.ttl) {
          await this.lifecycle.setExpiry(credentialId, encryptedCredential.metadata.expiresAt!);
        }
      }
      
      return {
        success: true,
        data: credentialId,
        metadata: {
          alias,
          projectId: credential.project_id,
          encryptionStrength: opts.encryptionStrength,
          persistedAt: encryptedCredential.createdAt
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to persist credential', 'PERSIST_ERROR', undefined, 'persistCredential', error)
      };
    }
  }
  
  /**
   * Retrieve and decrypt a credential
   */
  async retrieveCredential(id: CredentialId): Promise<CredentialOperationResult<GA4ServiceAccountCredential>> {
    try {
      this.ensureInitialized();
      
      // Retrieve encrypted credential
      const retrieveResult = await this.storage.retrieve(id);
      if (!retrieveResult.success || !retrieveResult.data) {
        throw retrieveResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', id);
      }
      
      const encryptedCredential = retrieveResult.data;
      
      // Verify integrity
      const integrityValid = await this.encryption.validateChecksum(
        encryptedCredential.encryptedData,
        encryptedCredential.integrity.checksum
      );
      
      if (!integrityValid) {
        throw new CredentialError('Credential integrity verification failed', 'INTEGRITY_VERIFICATION_FAILED', id);
      }
      
      // Get master key and derive credential password
      const masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        throw new CredentialError('Master key not found', 'MASTER_KEY_MISSING');
      }
      
      const credentialPassword = await CredentialKeyManager.deriveCredentialPassword(masterKey, id);
      
      // Decrypt credential
      // Note: In a complete implementation, IV and salt would be stored with the encrypted data
      const decryptionParams = {
        encryptedData: encryptedCredential.encryptedData,
        iv: '', // Would be extracted from stored data
        salt: '', // Would be extracted from stored data
        algorithm: 'AES-GCM',
        expectedChecksum: encryptedCredential.integrity.checksum
      };
      
      const credential = await this.encryption.decrypt(decryptionParams, credentialPassword);
      
      // Update access tracking
      await this.storage.update(id, {
        metadata: {
          ...encryptedCredential.metadata,
          lastUsed: new Date().toISOString(),
          usageCount: encryptedCredential.metadata.usageCount + 1
        }
      });
      
      // Log access
      await this.lifecycle.logEvent({
        id: this.generateId(),
        credentialId: id,
        event: 'used',
        timestamp: new Date().toISOString(),
        source: 'user',
        metadata: {
          action: 'retrieve',
          alias: encryptedCredential.alias
        }
      });
      
      return {
        success: true,
        data: credential,
        metadata: {
          alias: encryptedCredential.alias,
          retrievedAt: new Date().toISOString(),
          usageCount: encryptedCredential.metadata.usageCount + 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve credential', 'RETRIEVE_ERROR', id, 'retrieveCredential', error)
      };
    }
  }
  
  /**
   * Retrieve credential by alias
   */
  async retrieveCredentialByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<GA4ServiceAccountCredential>> {
    try {
      const retrieveResult = await this.storage.getByAlias(alias);
      if (!retrieveResult.success || !retrieveResult.data) {
        throw retrieveResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }
      
      return await this.retrieveCredential(retrieveResult.data.id);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve credential by alias', 'RETRIEVE_BY_ALIAS_ERROR', undefined, 'retrieveCredentialByAlias', error)
      };
    }
  }
  
  /**
   * Update a persisted credential
   */
  async updateCredential(id: CredentialId, updates: Partial<GA4ServiceAccountCredential>): Promise<CredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      // Get current credential
      const currentResult = await this.retrieveCredential(id);
      if (!currentResult.success || !currentResult.data) {
        throw currentResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', id);
      }
      
      // Apply updates
      const updatedCredential = { ...currentResult.data, ...updates };
      
      // Validate updated credential
      const validationResult = await this.validator.validateGA4Credential(updatedCredential);
      if (!validationResult.isValid) {
        throw new CredentialError(
          `Updated credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          'VALIDATION_FAILED'
        );
      }
      
      // Re-encrypt credential
      const masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        throw new CredentialError('Master key not found', 'MASTER_KEY_MISSING');
      }
      
      const credentialPassword = await CredentialKeyManager.deriveCredentialPassword(masterKey, id);
      const encryptionResult = await this.encryption.encrypt(updatedCredential, credentialPassword);
      
      // Update storage
      const updateResult = await this.storage.update(id, {
        encryptedData: encryptionResult.encryptedData,
        integrity: {
          checksum: encryptionResult.checksum,
          algorithm: 'SHA-256',
          verificationTimestamp: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      });
      
      if (!updateResult.success) {
        throw updateResult.error || new CredentialError('Failed to update credential', 'UPDATE_ERROR', id);
      }
      
      // Log update
      await this.lifecycle.logEvent({
        id: this.generateId(),
        credentialId: id,
        event: 'created', // Using 'created' for updates
        timestamp: new Date().toISOString(),
        source: 'user',
        metadata: {
          action: 'update',
          updatedFields: Object.keys(updates)
        }
      });
      
      return {
        success: true,
        data: true,
        metadata: {
          updatedAt: new Date().toISOString(),
          updatedFields: Object.keys(updates)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to update credential', 'UPDATE_ERROR', id, 'updateCredential', error)
      };
    }
  }
  
  /**
   * Remove a persisted credential
   */
  async removeCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      // Archive in lifecycle first
      await this.lifecycle.archiveCredential(id);
      
      // Remove from storage
      const deleteResult = await this.storage.delete(id);
      if (!deleteResult.success) {
        throw deleteResult.error || new CredentialError('Failed to remove credential', 'REMOVE_ERROR', id);
      }
      
      return {
        success: true,
        data: true,
        metadata: {
          removedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to remove credential', 'REMOVE_ERROR', id, 'removeCredential', error)
      };
    }
  }
  
  /**
   * Persist multiple credentials in batch
   */
  async persistBatch(
    credentials: Array<{ credential: GA4ServiceAccountCredential; alias: string; options?: PersistenceOptions }>
  ): Promise<CredentialOperationResult<CredentialId[]>> {
    try {
      this.ensureInitialized();
      
      const results: CredentialId[] = [];
      const errors: string[] = [];
      
      // Create backup before batch operation
      await this.createBackup();
      
      for (const { credential, alias, options } of credentials) {
        try {
          const result = await this.persistCredential(credential, alias, options);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`Failed to persist ${alias}: ${result.error?.message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Failed to persist ${alias}: ${error.message}`);
        }
      }
      
      return {
        success: errors.length === 0,
        data: results,
        metadata: {
          totalRequested: credentials.length,
          successfullyPersisted: results.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to persist batch', 'BATCH_PERSIST_ERROR', undefined, 'persistBatch', error)
      };
    }
  }
  
  /**
   * Retrieve multiple credentials in batch
   */
  async retrieveBatch(ids: CredentialId[]): Promise<CredentialOperationResult<GA4ServiceAccountCredential[]>> {
    try {
      this.ensureInitialized();
      
      const results: GA4ServiceAccountCredential[] = [];
      const errors: string[] = [];
      
      for (const id of ids) {
        try {
          const result = await this.retrieveCredential(id);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`Failed to retrieve ${id}: ${result.error?.message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Failed to retrieve ${id}: ${error.message}`);
        }
      }
      
      return {
        success: errors.length === 0,
        data: results,
        metadata: {
          totalRequested: ids.length,
          successfullyRetrieved: results.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve batch', 'BATCH_RETRIEVE_ERROR', undefined, 'retrieveBatch', error)
      };
    }
  }
  
  /**
   * List stored credential IDs
   */
  async listCredentials(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<CredentialId[]>> {
    try {
      this.ensureInitialized();
      
      const listResult = await this.storage.list(filters);
      if (!listResult.success || !listResult.data) {
        throw listResult.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      const ids = listResult.data.map(cred => cred.id);
      
      return {
        success: true,
        data: ids,
        metadata: {
          count: ids.length,
          filters: filters || {}
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to list credentials', 'LIST_ERROR', undefined, 'listCredentials', error)
      };
    }
  }
  
  /**
   * Search credentials by query
   */
  async searchCredentials(query: string): Promise<CredentialOperationResult<CredentialId[]>> {
    try {
      // Basic search implementation - can be enhanced
      const filters: CredentialSearchFilters = {};
      
      // Simple search logic
      if (query.includes('@')) {
        // Assume email search
      } else if (query.includes('-')) {
        // Assume project ID search
      }
      
      return await this.listCredentials(filters);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to search credentials', 'SEARCH_ERROR', undefined, 'searchCredentials', error)
      };
    }
  }
  
  /**
   * Get credential storage index
   */
  async getCredentialIndex(): Promise<CredentialStorageIndex> {
    this.ensureInitialized();
    return await this.storage.getIndex();
  }
  
  /**
   * Create backup of all credentials
   */
  async createBackup(): Promise<CredentialOperationResult<string>> {
    try {
      this.ensureInitialized();
      return await this.storage.backup();
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to create backup', 'BACKUP_ERROR', undefined, 'createBackup', error)
      };
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreFromBackup(backupData: string): Promise<CredentialOperationResult<number>> {
    try {
      this.ensureInitialized();
      return await this.storage.restore(backupData);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to restore from backup', 'RESTORE_ERROR', undefined, 'restoreFromBackup', error)
      };
    }
  }
  
  /**
   * Vacuum storage (cleanup and optimize)
   */
  async vacuum(): Promise<CredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      return await this.storage.vacuum();
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to vacuum storage', 'VACUUM_ERROR', undefined, 'vacuum', error)
      };
    }
  }
  
  /**
   * Verify integrity of all persisted credentials
   */
  async verifyIntegrity(): Promise<CredentialOperationResult<PersistenceIntegrityReport>> {
    try {
      this.ensureInitialized();
      
      const listResult = await this.storage.list();
      if (!listResult.success || !listResult.data) {
        throw listResult.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      const report: PersistenceIntegrityReport = {
        totalCredentials: listResult.data.length,
        validCredentials: 0,
        corruptedCredentials: 0,
        integrityIssues: [],
        verifiedAt: new Date().toISOString()
      };
      
      for (const credential of listResult.data) {
        try {
          // Verify checksum
          const isValid = await this.encryption.validateChecksum(
            credential.encryptedData,
            credential.integrity.checksum
          );
          
          if (isValid) {
            report.validCredentials++;
          } else {
            report.corruptedCredentials++;
            report.integrityIssues.push({
              credentialId: credential.id,
              issue: 'Checksum validation failed',
              severity: 'critical'
            });
          }
        } catch (error) {
          report.corruptedCredentials++;
          report.integrityIssues.push({
            credentialId: credential.id,
            issue: `Integrity check failed: ${error.message}`,
            severity: 'high'
          });
        }
      }
      
      return {
        success: report.corruptedCredentials === 0,
        data: report,
        metadata: {
          integrityScore: report.totalCredentials > 0 ? report.validCredentials / report.totalCredentials : 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to verify integrity', 'INTEGRITY_ERROR', undefined, 'verifyIntegrity', error)
      };
    }
  }
  
  /**
   * Clean up expired credentials
   */
  async cleanupExpired(): Promise<CredentialOperationResult<number>> {
    try {
      this.ensureInitialized();
      return await this.lifecycle.cleanupExpired();
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to cleanup expired credentials', 'CLEANUP_ERROR', undefined, 'cleanupExpired', error)
      };
    }
  }
  
  /**
   * Rotate encryption with new password
   */
  async rotateEncryption(newPassword: string): Promise<CredentialOperationResult<boolean>> {
    try {
      this.ensureInitialized();
      
      if (!this.validateMasterPassword(newPassword)) {
        throw new CredentialError(
          'New password does not meet security requirements',
          'WEAK_PASSWORD'
        );
      }
      
      // This would involve re-encrypting all credentials with new password
      // For now, just update the master password and key
      this.masterPassword = newPassword;
      
      // Generate new master key
      const newMasterKey = await CredentialKeyManager.generateMasterKey();
      await CredentialKeyManager.storeMasterKey(newMasterKey);
      
      return {
        success: true,
        data: true,
        metadata: {
          rotatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to rotate encryption', 'ROTATION_ERROR', undefined, 'rotateEncryption', error)
      };
    }
  }
  
  /**
   * Generate audit report
   */
  async auditAccess(): Promise<CredentialOperationResult<PersistenceAuditReport>> {
    try {
      this.ensureInitialized();
      
      // This would collect access logs from lifecycle management
      const report: PersistenceAuditReport = {
        totalAccess: 0,
        accessByCredential: {},
        recentAccess: [],
        securityEvents: [],
        generatedAt: new Date().toISOString()
      };
      
      return {
        success: true,
        data: report,
        metadata: {
          auditPeriod: '30 days' // Could be configurable
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to generate audit report', 'AUDIT_ERROR', undefined, 'auditAccess', error)
      };
    }
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new CredentialError('Persistence service not initialized', 'NOT_INITIALIZED');
    }
  }
  
  private validateMasterPassword(password: string): boolean {
    // Enhanced password validation
    const minLength = 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return password.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  }
  
  private generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

// ============================================================================
// PERSISTENCE FACTORY
// ============================================================================

/**
 * Factory for creating persistence service instances
 */
export class CredentialPersistenceFactory {
  /**
   * Create default persistence service
   */
  static createDefault(): CredentialPersistence {
    return new CredentialPersistence();
  }
  
  /**
   * Create high-security persistence service
   */
  static createSecure(): CredentialPersistence {
    const storage = new BrowserCredentialStorage({
      encryptionEnabled: true,
      backupEnabled: true,
      maxCredentials: 25,
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    const encryption = CredentialEncryptionFactory.createHighSecurity();
    const lifecycle = CredentialLifecycleFactory.createDefault();
    const validator = CredentialValidatorFactory.createStrict();
    
    return new CredentialPersistence(storage, encryption, lifecycle, validator);
  }
}