/**
 * MCP Credential Types and Interfaces
 * 
 * This file defines the type system for secure credential handling
 * in the MCP integration, specifically for GA4 service account credentials.
 */

// ============================================================================
// CREDENTIAL DATA STRUCTURES
// ============================================================================

/**
 * GA4 Service Account credential structure
 */
export interface GA4ServiceAccountCredential {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

/**
 * Encrypted credential wrapper
 */
export interface EncryptedCredential {
  id: string;
  alias: string;
  encryptedData: string;
  metadata: CredentialMetadata;
  integrity: CredentialIntegrity;
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential metadata for management and validation
 */
export interface CredentialMetadata {
  version: string;
  credentialType: 'ga4_service_account' | 'oauth2' | 'api_key';
  projectId: string;
  clientEmail?: string;
  description?: string;
  tags: string[];
  expiresAt?: string;
  lastUsed?: string;
  usageCount: number;
}

/**
 * Credential integrity validation data
 */
export interface CredentialIntegrity {
  checksum: string;
  algorithm: 'SHA-256' | 'SHA-512';
  signature?: string;
  verificationTimestamp: string;
}

// ============================================================================
// ENCRYPTION & SECURITY TYPES
// ============================================================================

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC';
  keyLength: 128 | 192 | 256;
  ivLength: 12 | 16;
  tagLength?: 128;
  saltLength: 32 | 64;
  iterations: number;
}

/**
 * Encryption key material
 */
export interface EncryptionKey {
  key: CryptoKey;
  salt: Uint8Array;
  iv: Uint8Array;
  algorithm: string;
  extractable: boolean;
  keyUsages: KeyUsage[];
}

/**
 * Credential encryption result
 */
export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
  algorithm: string;
  checksum: string;
}

/**
 * Credential decryption parameters
 */
export interface DecryptionParams {
  encryptedData: string;
  iv: string;
  salt: string;
  algorithm: string;
  expectedChecksum?: string;
}

// ============================================================================
// STORAGE & PERSISTENCE TYPES
// ============================================================================

/**
 * Credential storage configuration
 */
export interface CredentialStorageConfig {
  storageType: 'localStorage' | 'indexedDB' | 'sessionStorage';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  backupEnabled: boolean;
  maxCredentials: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Credential storage entry
 */
export interface CredentialStorageEntry {
  id: string;
  alias: string;
  data: EncryptedCredential;
  storageTimestamp: string;
  accessTimestamp: string;
  accessCount: number;
}

/**
 * Credential storage index
 */
export interface CredentialStorageIndex {
  version: string;
  entries: {
    [id: string]: {
      alias: string;
      type: string;
      createdAt: string;
      lastAccessed: string;
      metadata: Partial<CredentialMetadata>;
    };
  };
  totalCount: number;
  lastUpdated: string;
}

// ============================================================================
// LIFECYCLE MANAGEMENT TYPES
// ============================================================================

/**
 * Credential lifecycle state
 */
export type CredentialLifecycleState = 
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'archived';

/**
 * Credential lifecycle event
 */
export interface CredentialLifecycleEvent {
  id: string;
  credentialId: string;
  event: 'created' | 'activated' | 'used' | 'rotated' | 'expired' | 'revoked' | 'deleted';
  timestamp: string;
  source: 'user' | 'system' | 'scheduled' | 'lifecycle_manager';
  metadata?: Record<string, any>;
  reason?: string;
}

/**
 * Credential rotation policy
 */
export interface CredentialRotationPolicy {
  enabled: boolean;
  rotationInterval: number; // milliseconds
  warningThreshold: number; // milliseconds before expiry
  autoRotate: boolean;
  maxAge: number; // maximum credential age in milliseconds
  retentionPeriod: number; // how long to keep old credentials
}

/**
 * Credential audit entry
 */
export interface CredentialAuditEntry {
  id: string;
  credentialId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'encrypt' | 'decrypt' | 'rotate';
  timestamp: string;
  source: string;
  userAgent?: string;
  ipAddress?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// VALIDATION & ERROR TYPES
// ============================================================================

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  isValid: boolean;
  errors: CredentialValidationError[];
  warnings: CredentialValidationWarning[];
  metadata: {
    validatedAt: string;
    validationVersion: string;
    checkedFields: string[];
  };
}

/**
 * Credential validation error
 */
export interface CredentialValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Credential validation warning
 */
export interface CredentialValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * Credential operation error
 */
export class CredentialError extends Error {
  constructor(
    message: string,
    public code: string,
    public credentialId?: string,
    public operation?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CredentialError';
  }
}

// ============================================================================
// MCP INTEGRATION TYPES
// ============================================================================

/**
 * MCP credential authentication configuration
 */
export interface MCPCredentialConfig {
  credentialId: string;
  authenticationType: 'service_account' | 'oauth2' | 'api_key';
  scope: string[];
  audience?: string;
  expirationBuffer: number; // seconds before expiry to refresh
}

/**
 * MCP credential authentication result
 */
export interface MCPAuthenticationResult {
  success: boolean;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: string;
  scope?: string[];
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * MCP credential transmission format
 */
export interface MCPCredentialTransmission {
  type: 'encrypted' | 'hashed' | 'reference';
  payload: string;
  algorithm: string;
  timestamp: string;
  nonce: string;
  signature?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic credential operation options
 */
export interface CredentialOperationOptions {
  validate?: boolean;
  backup?: boolean;
  audit?: boolean;
  encryption?: Partial<EncryptionConfig>;
  metadata?: Record<string, any>;
}

/**
 * Credential search filters
 */
export interface CredentialSearchFilters {
  type?: string;
  projectId?: string;
  tags?: string[];
  state?: CredentialLifecycleState;
  createdAfter?: string;
  createdBefore?: string;
  lastUsedAfter?: string;
  lastUsedBefore?: string;
}

/**
 * Credential operation result
 */
export interface CredentialOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: CredentialError;
  warnings?: string[];
  metadata?: Record<string, any>;
}

// Export type guards and utilities
export type CredentialId = string;
export type CredentialAlias = string;
export type EncryptedData = string;
export type DecryptedData = string;