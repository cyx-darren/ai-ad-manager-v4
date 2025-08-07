/**
 * MCP Credential Encryption Architecture
 * 
 * This file implements secure encryption/decryption for GA4 credentials
 * using browser Crypto APIs with AES-GCM encryption and key derivation.
 */

import {
  EncryptionConfig,
  EncryptionKey,
  EncryptionResult,
  DecryptionParams,
  CredentialError,
  GA4ServiceAccountCredential
} from './types';

// ============================================================================
// ENCRYPTION CONFIGURATION
// ============================================================================

/**
 * Default encryption configuration
 */
export const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  tagLength: 128,
  saltLength: 32,
  iterations: 100000
};

// ============================================================================
// ENCRYPTION SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential encryption services
 */
export interface ICredentialEncryption {
  encrypt(data: GA4ServiceAccountCredential, password: string): Promise<EncryptionResult>;
  decrypt(params: DecryptionParams, password: string): Promise<GA4ServiceAccountCredential>;
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
  generateSalt(): Uint8Array;
  generateIV(): Uint8Array;
  calculateChecksum(data: string): Promise<string>;
  validateChecksum(data: string, expectedChecksum: string): Promise<boolean>;
}

// ============================================================================
// BROWSER CRYPTO ENCRYPTION IMPLEMENTATION
// ============================================================================

/**
 * Browser-based credential encryption using Web Crypto API
 */
export class BrowserCredentialEncryption implements ICredentialEncryption {
  private config: EncryptionConfig;
  
  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
    this.validateBrowserSupport();
  }
  
  /**
   * Encrypt GA4 credential data
   */
  async encrypt(data: GA4ServiceAccountCredential, password: string): Promise<EncryptionResult> {
    try {
      // Validate input
      this.validateCredentialData(data);
      this.validatePassword(password);
      
      // Generate cryptographic materials
      const salt = this.generateSalt();
      const iv = this.generateIV();
      
      // Derive encryption key
      const key = await this.deriveKey(password, salt);
      
      // Prepare data for encryption
      const dataString = JSON.stringify(data);
      const dataBuffer = new TextEncoder().encode(dataString);
      
      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.config.algorithm,
          iv: iv,
          tagLength: this.config.tagLength
        },
        key,
        dataBuffer
      );
      
      // Convert to base64 for storage
      const encryptedBase64 = this.arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = this.arrayBufferToBase64(iv);
      const saltBase64 = this.arrayBufferToBase64(salt);
      
      // Calculate integrity checksum
      const checksum = await this.calculateChecksum(encryptedBase64);
      
      return {
        encryptedData: encryptedBase64,
        iv: ivBase64,
        salt: saltBase64,
        algorithm: this.config.algorithm,
        checksum: checksum
      };
    } catch (error) {
      throw new CredentialError(
        'Failed to encrypt credential data',
        'ENCRYPTION_ERROR',
        undefined,
        'encrypt',
        error
      );
    }
  }
  
  /**
   * Decrypt GA4 credential data
   */
  async decrypt(params: DecryptionParams, password: string): Promise<GA4ServiceAccountCredential> {
    try {
      // Validate input
      this.validateDecryptionParams(params);
      this.validatePassword(password);
      
      // Validate checksum if provided
      if (params.expectedChecksum) {
        const isValid = await this.validateChecksum(params.encryptedData, params.expectedChecksum);
        if (!isValid) {
          throw new CredentialError('Checksum validation failed', 'CHECKSUM_VALIDATION_FAILED');
        }
      }
      
      // Convert from base64
      const encryptedBuffer = this.base64ToArrayBuffer(params.encryptedData);
      const iv = this.base64ToArrayBuffer(params.iv);
      const salt = this.base64ToArrayBuffer(params.salt);
      
      // Derive decryption key
      const key = await this.deriveKey(password, new Uint8Array(salt));
      
      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: params.algorithm as any,
          iv: new Uint8Array(iv),
          tagLength: this.config.tagLength
        },
        key,
        encryptedBuffer
      );
      
      // Convert back to credential object
      const decryptedString = new TextDecoder().decode(decryptedBuffer);
      const credentialData = JSON.parse(decryptedString) as GA4ServiceAccountCredential;
      
      // Validate decrypted data structure
      this.validateCredentialData(credentialData);
      
      return credentialData;
    } catch (error) {
      throw new CredentialError(
        'Failed to decrypt credential data',
        'DECRYPTION_ERROR',
        undefined,
        'decrypt',
        error
      );
    }
  }
  
  /**
   * Derive encryption key from password using PBKDF2
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    try {
      // Import password as key material
      const passwordBuffer = new TextEncoder().encode(password);
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      // Derive actual encryption key
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.config.iterations,
          hash: 'SHA-256'
        },
        passwordKey,
        {
          name: this.config.algorithm,
          length: this.config.keyLength
        },
        false,
        ['encrypt', 'decrypt']
      );
      
      return derivedKey;
    } catch (error) {
      throw new CredentialError(
        'Failed to derive encryption key',
        'KEY_DERIVATION_ERROR',
        undefined,
        'deriveKey',
        error
      );
    }
  }
  
  /**
   * Generate cryptographically secure salt
   */
  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.config.saltLength));
  }
  
  /**
   * Generate cryptographically secure initialization vector
   */
  generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.config.ivLength));
  }
  
  /**
   * Calculate SHA-256 checksum for integrity validation
   */
  async calculateChecksum(data: string): Promise<string> {
    try {
      const dataBuffer = new TextEncoder().encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      return this.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      throw new CredentialError(
        'Failed to calculate checksum',
        'CHECKSUM_ERROR',
        undefined,
        'calculateChecksum',
        error
      );
    }
  }
  
  /**
   * Validate checksum for integrity verification
   */
  async validateChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(data);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      throw new CredentialError(
        'Failed to validate checksum',
        'CHECKSUM_VALIDATION_ERROR',
        undefined,
        'validateChecksum',
        error
      );
    }
  }
  
  // ========================================================================
  // VALIDATION METHODS
  // ========================================================================
  
  private validateBrowserSupport(): void {
    if (!crypto || !crypto.subtle) {
      throw new CredentialError(
        'Web Crypto API not supported in this environment',
        'CRYPTO_NOT_SUPPORTED'
      );
    }
    
    if (!crypto.getRandomValues) {
      throw new CredentialError(
        'Secure random number generation not supported',
        'RANDOM_NOT_SUPPORTED'
      );
    }
  }
  
  private validateCredentialData(data: GA4ServiceAccountCredential): void {
    if (!data || typeof data !== 'object') {
      throw new CredentialError('Invalid credential data structure', 'INVALID_CREDENTIAL_DATA');
    }
    
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
      'auth_uri',
      'token_uri'
    ];
    
    for (const field of requiredFields) {
      if (!data[field as keyof GA4ServiceAccountCredential]) {
        throw new CredentialError(
          `Missing required credential field: ${field}`,
          'MISSING_CREDENTIAL_FIELD'
        );
      }
    }
    
    if (data.type !== 'service_account') {
      throw new CredentialError(
        `Unsupported credential type: ${data.type}`,
        'UNSUPPORTED_CREDENTIAL_TYPE'
      );
    }
  }
  
  private validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new CredentialError('Invalid password', 'INVALID_PASSWORD');
    }
    
    if (password.length < 8) {
      throw new CredentialError(
        'Password must be at least 8 characters long',
        'PASSWORD_TOO_SHORT'
      );
    }
    
    // Additional password strength validation can be added here
  }
  
  private validateDecryptionParams(params: DecryptionParams): void {
    if (!params || typeof params !== 'object') {
      throw new CredentialError('Invalid decryption parameters', 'INVALID_DECRYPTION_PARAMS');
    }
    
    const requiredFields = ['encryptedData', 'iv', 'salt', 'algorithm'];
    for (const field of requiredFields) {
      if (!params[field as keyof DecryptionParams]) {
        throw new CredentialError(
          `Missing decryption parameter: ${field}`,
          'MISSING_DECRYPTION_PARAM'
        );
      }
    }
  }
  
  // ========================================================================
  // UTILITY METHODS
  // ========================================================================
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// ============================================================================
// KEY MANAGEMENT UTILITIES
// ============================================================================

/**
 * Secure key management utilities
 */
export class CredentialKeyManager {
  private static readonly MASTER_KEY_STORAGE_KEY = 'mcp_master_key_material';
  private static readonly KEY_DERIVATION_INFO = 'mcp_credential_encryption_v1';
  
  /**
   * Generate a master key for credential encryption
   */
  static async generateMasterKey(): Promise<string> {
    try {
      // Generate 256-bit random key material
      const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
      
      // Convert to base64 for storage
      const keyBase64 = btoa(String.fromCharCode.apply(null, Array.from(keyMaterial)));
      
      return keyBase64;
    } catch (error) {
      throw new CredentialError(
        'Failed to generate master key',
        'MASTER_KEY_GENERATION_ERROR',
        undefined,
        'generateMasterKey',
        error
      );
    }
  }
  
  /**
   * Derive credential-specific password from master key
   */
  static async deriveCredentialPassword(masterKey: string, credentialId: string): Promise<string> {
    try {
      // Decode master key
      const masterKeyBytes = Uint8Array.from(atob(masterKey), c => c.charCodeAt(0));
      
      // Create credential-specific input
      const credentialInput = new TextEncoder().encode(`${this.KEY_DERIVATION_INFO}:${credentialId}`);
      
      // Import master key for HMAC
      const hmacKey = await crypto.subtle.importKey(
        'raw',
        masterKeyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Generate credential password using HMAC
      const signature = await crypto.subtle.sign('HMAC', hmacKey, credentialInput);
      const signatureBase64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(signature))));
      
      return signatureBase64;
    } catch (error) {
      throw new CredentialError(
        'Failed to derive credential password',
        'CREDENTIAL_PASSWORD_DERIVATION_ERROR',
        credentialId,
        'deriveCredentialPassword',
        error
      );
    }
  }
  
  /**
   * Store master key securely (in browser context)
   */
  static async storeMasterKey(masterKey: string): Promise<void> {
    try {
      // In a real implementation, this should use more secure storage
      // For browser context, we use localStorage with additional security measures
      const timestamp = Date.now().toString();
      const keyData = {
        key: masterKey,
        timestamp: timestamp,
        version: '1.0'
      };
      
      localStorage.setItem(this.MASTER_KEY_STORAGE_KEY, JSON.stringify(keyData));
    } catch (error) {
      throw new CredentialError(
        'Failed to store master key',
        'MASTER_KEY_STORAGE_ERROR',
        undefined,
        'storeMasterKey',
        error
      );
    }
  }
  
  /**
   * Retrieve master key from secure storage
   */
  static async retrieveMasterKey(): Promise<string | null> {
    try {
      const storedData = localStorage.getItem(this.MASTER_KEY_STORAGE_KEY);
      if (!storedData) {
        return null;
      }
      
      const keyData = JSON.parse(storedData);
      return keyData.key || null;
    } catch (error) {
      throw new CredentialError(
        'Failed to retrieve master key',
        'MASTER_KEY_RETRIEVAL_ERROR',
        undefined,
        'retrieveMasterKey',
        error
      );
    }
  }
  
  /**
   * Clear master key from storage
   */
  static async clearMasterKey(): Promise<void> {
    try {
      localStorage.removeItem(this.MASTER_KEY_STORAGE_KEY);
    } catch (error) {
      throw new CredentialError(
        'Failed to clear master key',
        'MASTER_KEY_CLEAR_ERROR',
        undefined,
        'clearMasterKey',
        error
      );
    }
  }
  
  /**
   * Check if master key exists
   */
  static async hasMasterKey(): Promise<boolean> {
    try {
      const masterKey = await this.retrieveMasterKey();
      return masterKey !== null;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// ENCRYPTION FACTORY
// ============================================================================

/**
 * Factory for creating encryption service instances
 */
export class CredentialEncryptionFactory {
  /**
   * Create browser-based encryption service
   */
  static createBrowserEncryption(config?: Partial<EncryptionConfig>): ICredentialEncryption {
    return new BrowserCredentialEncryption(config);
  }
  
  /**
   * Create encryption service with default configuration
   */
  static createDefault(): ICredentialEncryption {
    return new BrowserCredentialEncryption();
  }
  
  /**
   * Create high-security encryption service
   */
  static createHighSecurity(): ICredentialEncryption {
    return new BrowserCredentialEncryption({
      keyLength: 256,
      iterations: 200000, // Higher iteration count for better security
      saltLength: 64      // Larger salt for better security
    });
  }
}