/**
 * MCP Credential Management Services
 * 
 * This file implements the high-level credential management services
 * using the architecture components from Phase 1. These services provide
 * easy-to-use interfaces for credential operations.
 */

import {
  GA4ServiceAccountCredential,
  EncryptedCredential,
  CredentialMetadata,
  CredentialOperationResult,
  CredentialSearchFilters,
  CredentialError,
  CredentialId,
  CredentialAlias,
  CredentialValidationResult
} from './types';

import {
  CredentialLifecycleReport
} from './lifecycle';

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

// ============================================================================
// CREDENTIAL SERVICE INTERFACE
// ============================================================================

/**
 * Main interface for credential management operations
 */
export interface ICredentialService {
  // Initialization
  initialize(masterPassword: string): Promise<CredentialOperationResult<boolean>>;
  isInitialized(): boolean;
  
  // Core credential operations
  storeCredential(credential: GA4ServiceAccountCredential, alias: string, options?: CredentialStoreOptions): Promise<CredentialOperationResult<CredentialId>>;
  getCredential(id: CredentialId): Promise<CredentialOperationResult<GA4ServiceAccountCredential>>;
  getCredentialByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<GA4ServiceAccountCredential>>;
  updateCredential(id: CredentialId, updates: Partial<GA4ServiceAccountCredential>): Promise<CredentialOperationResult<boolean>>;
  deleteCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Credential listing and search
  listCredentials(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<CredentialMetadata[]>>;
  searchCredentials(query: string): Promise<CredentialOperationResult<CredentialMetadata[]>>;
  
  // Validation and verification
  validateCredential(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult>;
  testCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>>;
  
  // Lifecycle management
  getCredentialReport(id: CredentialId): Promise<CredentialLifecycleReport>;
  rotateCredential(id: CredentialId): Promise<CredentialOperationResult<CredentialId>>;
  
  // Utility operations
  backupCredentials(): Promise<CredentialOperationResult<string>>;
  restoreCredentials(backupData: string): Promise<CredentialOperationResult<number>>;
  cleanupExpired(): Promise<CredentialOperationResult<number>>;
  
  // Security operations
  changePassword(oldPassword: string, newPassword: string): Promise<CredentialOperationResult<boolean>>;
  verifyIntegrity(): Promise<CredentialOperationResult<boolean>>;
}

/**
 * Options for storing credentials
 */
export interface CredentialStoreOptions {
  description?: string;
  tags?: string[];
  expiresAt?: string;
  autoRotate?: boolean;
  rotationInterval?: number;
  metadata?: Record<string, any>;
  validateBeforeStore?: boolean;
  enableLifecycleTracking?: boolean;
}

// ============================================================================
// CREDENTIAL SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Main credential management service implementation
 */
export class CredentialService implements ICredentialService {
  private storage: ICredentialStorage;
  private encryption: ICredentialEncryption;
  private lifecycle: ICredentialLifecycle;
  private masterPassword: string | null = null;
  private isInit: boolean = false;
  
  constructor(
    storage?: ICredentialStorage,
    encryption?: ICredentialEncryption,
    lifecycle?: ICredentialLifecycle
  ) {
    this.storage = storage || new BrowserCredentialStorage();
    this.encryption = encryption || CredentialEncryptionFactory.createDefault();
    this.lifecycle = lifecycle || CredentialLifecycleFactory.createDefault();
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.isInit && this.masterPassword !== null;
  }
  
  /**
   * Initialize the service with a master password
   */
  async initialize(masterPassword: string): Promise<CredentialOperationResult<boolean>> {
    try {
      // Validate master password strength
      if (!this.validatePasswordStrength(masterPassword)) {
        throw new CredentialError(
          'Master password does not meet security requirements',
          'WEAK_PASSWORD'
        );
      }
      
      this.masterPassword = masterPassword;
      
      // Initialize or retrieve master key
      let masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        masterKey = await CredentialKeyManager.generateMasterKey();
        await CredentialKeyManager.storeMasterKey(masterKey);
      }
      
      this.isInit = true;
      
      return {
        success: true,
        data: true,
        metadata: {
          initializedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to initialize credential service', 'INITIALIZATION_ERROR', undefined, 'initialize', error)
      };
    }
  }
  
  /**
   * Store a new GA4 credential
   */
  async storeCredential(
    credential: GA4ServiceAccountCredential, 
    alias: string, 
    options: CredentialStoreOptions = {}
  ): Promise<CredentialOperationResult<CredentialId>> {
    try {
      // Validate inputs
      if (!this.masterPassword) {
        throw new CredentialError('Service not initialized', 'NOT_INITIALIZED');
      }
      
      const validationResult = await this.validateCredential(credential);
      if (!validationResult.isValid) {
        throw new CredentialError(
          `Credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          'VALIDATION_FAILED'
        );
      }
      
      // Generate credential ID and derive password
      const credentialId = this.generateCredentialId();
      const masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        throw new CredentialError('Master key not found', 'MASTER_KEY_MISSING');
      }
      
      const credentialPassword = await CredentialKeyManager.deriveCredentialPassword(masterKey, credentialId);
      
      // Encrypt credential
      const encryptionResult = await this.encryption.encrypt(credential, credentialPassword);
      
      // Create metadata
      const metadata: CredentialMetadata = {
        version: '1.0',
        credentialType: 'ga4_service_account',
        projectId: credential.project_id,
        clientEmail: credential.client_email,
        description: options.description,
        tags: options.tags || [],
        expiresAt: options.expiresAt,
        lastUsed: undefined,
        usageCount: 0
      };
      
      // Create encrypted credential
      const encryptedCredential: EncryptedCredential = {
        id: credentialId,
        alias,
        encryptedData: encryptionResult.encryptedData,
        metadata,
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
      
      // Set lifecycle state
      await this.lifecycle.setState(credentialId, 'active', 'Credential created and stored');
      
      // Set expiry if provided
      if (options.expiresAt) {
        await this.lifecycle.setExpiry(credentialId, options.expiresAt);
      }
      
      // Schedule rotation if enabled
      if (options.autoRotate && options.rotationInterval) {
        await this.lifecycle.scheduleRotation(credentialId, {
          enabled: true,
          rotationInterval: options.rotationInterval,
          warningThreshold: options.rotationInterval * 0.1, // 10% warning threshold
          autoRotate: true,
          maxAge: options.rotationInterval * 2,
          retentionPeriod: options.rotationInterval * 0.5
        });
      }
      
      return {
        success: true,
        data: credentialId,
        metadata: {
          alias,
          projectId: credential.project_id,
          clientEmail: credential.client_email,
          createdAt: encryptedCredential.createdAt
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to store credential', 'STORE_ERROR', undefined, 'storeCredential', error)
      };
    }
  }
  
  /**
   * Retrieve and decrypt a credential by ID
   */
  async getCredential(id: CredentialId): Promise<CredentialOperationResult<GA4ServiceAccountCredential>> {
    try {
      if (!this.masterPassword) {
        throw new CredentialError('Service not initialized', 'NOT_INITIALIZED');
      }
      
      // Retrieve encrypted credential
      const retrieveResult = await this.storage.retrieve(id);
      if (!retrieveResult.success || !retrieveResult.data) {
        throw retrieveResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', id);
      }
      
      const encryptedCredential = retrieveResult.data;
      
      // Derive credential password
      const masterKey = await CredentialKeyManager.retrieveMasterKey();
      if (!masterKey) {
        throw new CredentialError('Master key not found', 'MASTER_KEY_MISSING');
      }
      
      const credentialPassword = await CredentialKeyManager.deriveCredentialPassword(masterKey, id);
      
      // Decrypt credential
      const decryptionParams = {
        encryptedData: encryptedCredential.encryptedData,
        iv: '', // This would be stored with the encrypted data
        salt: '', // This would be stored with the encrypted data
        algorithm: 'AES-GCM',
        expectedChecksum: encryptedCredential.integrity.checksum
      };
      
      // Note: In a real implementation, IV and salt would be stored separately
      // For now, we'll extract them from the encrypted data if they're embedded
      const credential = await this.encryption.decrypt(decryptionParams, credentialPassword);
      
      // Update last used timestamp
      await this.storage.update(id, {
        metadata: {
          ...encryptedCredential.metadata,
          lastUsed: new Date().toISOString(),
          usageCount: encryptedCredential.metadata.usageCount + 1
        }
      });
      
      // Log access event
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
          lastUsed: new Date().toISOString(),
          usageCount: encryptedCredential.metadata.usageCount + 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve credential', 'RETRIEVE_ERROR', id, 'getCredential', error)
      };
    }
  }
  
  /**
   * Retrieve credential by alias
   */
  async getCredentialByAlias(alias: CredentialAlias): Promise<CredentialOperationResult<GA4ServiceAccountCredential>> {
    try {
      const retrieveResult = await this.storage.getByAlias(alias);
      if (!retrieveResult.success || !retrieveResult.data) {
        throw retrieveResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND');
      }
      
      return await this.getCredential(retrieveResult.data.id);
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to retrieve credential by alias', 'RETRIEVE_BY_ALIAS_ERROR', undefined, 'getCredentialByAlias', error)
      };
    }
  }
  
  /**
   * Update an existing credential
   */
  async updateCredential(id: CredentialId, updates: Partial<GA4ServiceAccountCredential>): Promise<CredentialOperationResult<boolean>> {
    try {
      // Get current credential
      const currentResult = await this.getCredential(id);
      if (!currentResult.success || !currentResult.data) {
        throw currentResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', id);
      }
      
      // Apply updates
      const updatedCredential = { ...currentResult.data, ...updates };
      
      // Validate updated credential
      const validationResult = await this.validateCredential(updatedCredential);
      if (!validationResult.isValid) {
        throw new CredentialError(
          `Updated credential validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          'VALIDATION_FAILED'
        );
      }
      
      // Re-encrypt with same password
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
      
      // Log update event
      await this.lifecycle.logEvent({
        id: this.generateId(),
        credentialId: id,
        event: 'created', // Using 'created' for updates as it's the closest available
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
   * Delete a credential
   */
  async deleteCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      // Archive credential first
      await this.lifecycle.archiveCredential(id);
      
      // Delete from storage
      const deleteResult = await this.storage.delete(id);
      if (!deleteResult.success) {
        throw deleteResult.error || new CredentialError('Failed to delete credential', 'DELETE_ERROR', id);
      }
      
      return {
        success: true,
        data: true,
        metadata: {
          deletedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to delete credential', 'DELETE_ERROR', id, 'deleteCredential', error)
      };
    }
  }
  
  /**
   * List credentials metadata
   */
  async listCredentials(filters?: CredentialSearchFilters): Promise<CredentialOperationResult<CredentialMetadata[]>> {
    try {
      const listResult = await this.storage.list(filters);
      if (!listResult.success || !listResult.data) {
        throw listResult.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      const metadataList = listResult.data.map(cred => cred.metadata);
      
      return {
        success: true,
        data: metadataList,
        metadata: {
          count: metadataList.length,
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
  async searchCredentials(query: string): Promise<CredentialOperationResult<CredentialMetadata[]>> {
    try {
      // Implement search logic based on query
      const filters: CredentialSearchFilters = {};
      
      // Basic search implementation - can be enhanced
      if (query.includes('@')) {
        // Assume it's an email search
        // This would require enhanced search in the storage layer
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
   * Validate GA4 service account credential
   */
  async validateCredential(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult> {
    const errors = [];
    const warnings = [];
    
    try {
      // Required field validation
      const requiredFields = [
        'type', 'project_id', 'private_key_id', 'private_key',
        'client_email', 'client_id', 'auth_uri', 'token_uri'
      ];
      
      for (const field of requiredFields) {
        if (!credential[field as keyof GA4ServiceAccountCredential]) {
          errors.push({
            field,
            code: 'MISSING_FIELD',
            message: `Required field '${field}' is missing`,
            severity: 'error' as const
          });
        }
      }
      
      // Type validation
      if (credential.type && credential.type !== 'service_account') {
        errors.push({
          field: 'type',
          code: 'INVALID_TYPE',
          message: `Expected 'service_account', got '${credential.type}'`,
          severity: 'error' as const
        });
      }
      
      // Email format validation
      if (credential.client_email && !this.isValidEmail(credential.client_email)) {
        errors.push({
          field: 'client_email',
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
          severity: 'error' as const
        });
      }
      
      // Private key format validation
      if (credential.private_key && !credential.private_key.includes('BEGIN PRIVATE KEY')) {
        warnings.push({
          field: 'private_key',
          code: 'SUSPICIOUS_KEY_FORMAT',
          message: 'Private key format may be invalid',
          suggestion: 'Ensure the private key includes proper PEM headers'
        });
      }
      
      // URI validation
      const uriFields = ['auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      for (const field of uriFields) {
        const value = credential[field as keyof GA4ServiceAccountCredential];
        if (value && !this.isValidUrl(value)) {
          errors.push({
            field,
            code: 'INVALID_URI',
            message: `Invalid URI format for ${field}`,
            severity: 'error' as const
          });
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validatedAt: new Date().toISOString(),
          validationVersion: '1.0',
          checkedFields: Object.keys(credential)
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'unknown',
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${error.message}`,
          severity: 'error' as const
        }],
        warnings: [],
        metadata: {
          validatedAt: new Date().toISOString(),
          validationVersion: '1.0',
          checkedFields: []
        }
      };
    }
  }
  
  /**
   * Test credential by attempting to use it
   */
  async testCredential(id: CredentialId): Promise<CredentialOperationResult<boolean>> {
    try {
      // Get credential
      const credentialResult = await this.getCredential(id);
      if (!credentialResult.success || !credentialResult.data) {
        throw credentialResult.error || new CredentialError('Credential not found', 'CREDENTIAL_NOT_FOUND', id);
      }
      
      // This would typically involve making a test API call to Google Analytics
      // For now, we'll just validate the credential structure
      const validationResult = await this.validateCredential(credentialResult.data);
      
      return {
        success: validationResult.isValid,
        data: validationResult.isValid,
        metadata: {
          testedAt: new Date().toISOString(),
          validationErrors: validationResult.errors.length,
          validationWarnings: validationResult.warnings.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to test credential', 'TEST_ERROR', id, 'testCredential', error)
      };
    }
  }
  
  /**
   * Get credential lifecycle report
   */
  async getCredentialReport(id: CredentialId): Promise<CredentialLifecycleReport> {
    return await this.lifecycle.generateReport(id);
  }
  
  /**
   * Rotate credential
   */
  async rotateCredential(id: CredentialId): Promise<CredentialOperationResult<CredentialId>> {
    return await this.lifecycle.performRotation(id);
  }
  
  /**
   * Backup all credentials
   */
  async backupCredentials(): Promise<CredentialOperationResult<string>> {
    return await this.storage.backup();
  }
  
  /**
   * Restore credentials from backup
   */
  async restoreCredentials(backupData: string): Promise<CredentialOperationResult<number>> {
    return await this.storage.restore(backupData);
  }
  
  /**
   * Clean up expired credentials
   */
  async cleanupExpired(): Promise<CredentialOperationResult<number>> {
    return await this.lifecycle.cleanupExpired();
  }
  
  /**
   * Change master password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<CredentialOperationResult<boolean>> {
    try {
      if (!this.masterPassword || this.masterPassword !== oldPassword) {
        throw new CredentialError('Invalid current password', 'INVALID_PASSWORD');
      }
      
      if (!this.validatePasswordStrength(newPassword)) {
        throw new CredentialError(
          'New password does not meet security requirements',
          'WEAK_PASSWORD'
        );
      }
      
      // This would involve re-encrypting all credentials with new password
      // For now, just update the master password
      this.masterPassword = newPassword;
      
      // Generate new master key
      const newMasterKey = await CredentialKeyManager.generateMasterKey();
      await CredentialKeyManager.storeMasterKey(newMasterKey);
      
      return {
        success: true,
        data: true,
        metadata: {
          passwordChangedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof CredentialError 
          ? error 
          : new CredentialError('Failed to change password', 'PASSWORD_CHANGE_ERROR', undefined, 'changePassword', error)
      };
    }
  }
  
  /**
   * Verify integrity of all stored credentials
   */
  async verifyIntegrity(): Promise<CredentialOperationResult<boolean>> {
    try {
      const listResult = await this.storage.list();
      if (!listResult.success || !listResult.data) {
        throw listResult.error || new CredentialError('Failed to list credentials', 'LIST_ERROR');
      }
      
      let integrityIssues = 0;
      
      for (const credential of listResult.data) {
        // Verify checksum
        const isValid = await this.encryption.validateChecksum(
          credential.encryptedData,
          credential.integrity.checksum
        );
        
        if (!isValid) {
          integrityIssues++;
        }
      }
      
      return {
        success: integrityIssues === 0,
        data: integrityIssues === 0,
        metadata: {
          totalCredentials: listResult.data.length,
          integrityIssues,
          verifiedAt: new Date().toISOString()
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
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  private validatePasswordStrength(password: string): boolean {
    // Minimum 8 characters, at least one uppercase, lowercase, number, and special character
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return password.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  }
  
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  private generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Factory for creating credential service instances
 */
export class CredentialServiceFactory {
  /**
   * Create default credential service
   */
  static createDefault(): CredentialService {
    return new CredentialService();
  }
  
  /**
   * Create high-security credential service
   */
  static createSecure(): CredentialService {
    const storage = new BrowserCredentialStorage({
      encryptionEnabled: true,
      backupEnabled: true,
      maxCredentials: 25,
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    const encryption = CredentialEncryptionFactory.createHighSecurity();
    const lifecycle = CredentialLifecycleFactory.createDefault();
    
    return new CredentialService(storage, encryption, lifecycle);
  }
  
  /**
   * Create credential service with custom configuration
   */
  static create(
    storage: ICredentialStorage,
    encryption: ICredentialEncryption,
    lifecycle: ICredentialLifecycle
  ): CredentialService {
    return new CredentialService(storage, encryption, lifecycle);
  }
}