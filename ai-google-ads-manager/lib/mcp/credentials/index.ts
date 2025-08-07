/**
 * MCP Credentials Module - Main Export File
 * 
 * This file exports all credential management components including
 * storage, encryption, lifecycle management, and related types.
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Credential data structures
  GA4ServiceAccountCredential,
  EncryptedCredential,
  CredentialMetadata,
  CredentialIntegrity,
  
  // Encryption types
  EncryptionConfig,
  EncryptionKey,
  EncryptionResult,
  DecryptionParams,
  
  // Storage types
  CredentialStorageConfig,
  CredentialStorageEntry,
  CredentialStorageIndex,
  
  // Lifecycle types
  CredentialLifecycleState,
  CredentialLifecycleEvent,
  CredentialAuditEntry,
  
  // Validation types
  CredentialValidationResult,
  CredentialValidationError,
  CredentialValidationWarning,
  
  // MCP integration types
  MCPCredentialConfig,
  MCPAuthenticationResult,
  MCPCredentialTransmission,
  
  // Utility types
  CredentialOperationOptions,
  CredentialSearchFilters,
  CredentialOperationResult,
  CredentialError,
  CredentialId,
  CredentialAlias,
  EncryptedData,
  DecryptedData
} from './types';

// ============================================================================
// STORAGE EXPORTS
// ============================================================================

export type {
  // Storage interface
  ICredentialStorage
} from './storage';

export {
  // Storage implementation
  BrowserCredentialStorage
} from './storage';

// ============================================================================
// ENCRYPTION EXPORTS
// ============================================================================

export type {
  // Encryption interface
  ICredentialEncryption
} from './encryption';

export {
  // Encryption configuration
  DEFAULT_ENCRYPTION_CONFIG,
  
  // Encryption implementation
  BrowserCredentialEncryption,
  
  // Key management
  CredentialKeyManager,
  
  // Encryption factory
  CredentialEncryptionFactory
} from './encryption';

// ============================================================================
// LIFECYCLE EXPORTS
// ============================================================================

export type {
  // Lifecycle interface
  ICredentialLifecycle,
  
  // Lifecycle report interface
  CredentialLifecycleReport
} from './lifecycle';

export {
  // Lifecycle implementation
  BrowserCredentialLifecycle,
  
  // Lifecycle factory
  CredentialLifecycleFactory
} from './lifecycle';

// ============================================================================
// PHASE 1 ARCHITECTURE SUMMARY
// ============================================================================

/**
 * Phase 1: Credential Storage Architecture - COMPLETE
 * 
 * This module provides a comprehensive architecture for secure GA4 credential
 * handling with the following key components:
 * 
 * ## 1. Type System (types.ts)
 * - Complete type definitions for GA4 service account credentials
 * - Encryption and security type interfaces
 * - Storage and persistence type definitions
 * - Lifecycle management type system
 * - Validation and error handling types
 * - MCP integration types
 * 
 * ## 2. Storage Architecture (storage.ts)
 * - Abstract storage interface (ICredentialStorage)
 * - Browser-based implementation (BrowserCredentialStorage)
 * - CRUD operations with encryption support
 * - Query and search capabilities
 * - Index management and maintenance
 * - Backup and restore functionality
 * - Audit logging integration
 * 
 * ## 3. Encryption System (encryption.ts)
 * - Web Crypto API based encryption (AES-GCM)
 * - PBKDF2 key derivation with configurable iterations
 * - Secure random salt and IV generation
 * - Integrity validation with SHA-256 checksums
 * - Master key management utilities
 * - Configurable encryption parameters
 * 
 * ## 4. Lifecycle Management (lifecycle.ts)
 * - State management (pending, active, expired, etc.)
 * - Event logging and audit trails
 * - Expiry detection and management
 * - Rotation policy enforcement
 * - Health monitoring and reporting
 * - Automated cleanup and archival
 * 
 * ## Key Security Features:
 * - End-to-end encryption using browser Crypto APIs
 * - Secure key derivation with PBKDF2
 * - Integrity validation with checksums
 * - Comprehensive audit logging
 * - Automated lifecycle management
 * - Secure storage with TTL support
 * 
 * ## Browser Compatibility:
 * - Uses Web Crypto API (supported in all modern browsers)
 * - Falls back gracefully when crypto features unavailable
 * - Local storage for persistence (with encryption)
 * - Memory-efficient storage indexing
 * 
 * ## Next Phase: Implementation
 * Phase 2 will implement these architectures into working credential
 * management services integrated with the MCP client system.
 */

// ============================================================================
// PHASE 2 EXPORTS - SECURE CREDENTIAL STORAGE IMPLEMENTATION
// ============================================================================

export type {
  // Service interface
  ICredentialService,
  CredentialStoreOptions
} from './services';

export {
  // Service implementation
  CredentialService,
  CredentialServiceFactory
} from './services';

export type {
  // Validation interface
  ICredentialValidator,
  ValidationPatterns,
  RequiredFields,
  ExpectedValues
} from './validation';

export {
  // Validation implementation
  CredentialValidator,
  CredentialValidatorFactory,
  validateGA4Credential,
  validateCredentialFile,
  formatValidationErrors
} from './validation';

export type {
  // Persistence interface
  ICredentialPersistence,
  PersistenceOptions,
  PersistenceIntegrityReport,
  PersistenceAuditReport
} from './persistence';

export {
  // Persistence implementation
  CredentialPersistence,
  CredentialPersistenceFactory
} from './persistence';

// ============================================================================
// PHASE 3 EXPORTS - MCP SERVER CREDENTIAL COMMUNICATION
// ============================================================================

export type {
  // MCP Authentication interface
  IMCPAuthService,
  MCPAuthConfig,
  MCPAuthHeaders,
  MCPAuthResult,
  MCPAuthContext,
  MCPCredentialVerification
} from './mcpAuth';

export {
  // MCP Authentication implementation
  MCPAuthService,
  MCPAuthServiceFactory,
  authenticateWithMCP,
  verifyCredentialWithMCP
} from './mcpAuth';

export type {
  // MCP Client interface
  IMCPClient,
  MCPClientConfig,
  MCPConnectionStatus,
  MCPResponse,
  MCPRequestOptions,
  GA4DataRequest,
  GA4RealTimeRequest
} from './mcpClient';

export {
  // MCP Client implementation
  MCPClient,
  MCPClientFactory,
  connectToMCP,
  fetchGA4Data
} from './mcpClient';

export type {
  // MCP Credential Manager interface
  IMCPCredentialManager,
  MCPCredentialManagerConfig,
  MCPCredentialOperationResult,
  MCPCredentialManagerStatus
} from './mcpCredentials';

export {
  // MCP Credential Manager implementation
  MCPCredentialManager,
  MCPCredentialManagerFactory,
  setupMCPCredentials,
  quickFetchGA4Data
} from './mcpCredentials';

// ============================================================================
// PHASE 4 EXPORTS - CREDENTIAL ROTATION & REFRESH
// ============================================================================

export type {
  // Credential Rotation interface
  ICredentialRotationService,
  CredentialRotationPolicy,
  CredentialRotationStatus,
  CredentialRotationRecord,
  CredentialRotationResult,
  CredentialRotationEvent
} from './credentialRotation';

export {
  // Credential Rotation implementation
  CredentialRotationService,
  CredentialRotationServiceFactory,
  createDefaultRotationPolicy,
  setupCredentialRotation
} from './credentialRotation';

export type {
  // Credential Refresh interface
  ICredentialRefreshService,
  CredentialRefreshConfig,
  CredentialRefreshStatus,
  CredentialRefreshResult,
  CredentialRefreshRecord,
  GA4TokenInfo
} from './credentialRefresh';

export {
  // Credential Refresh implementation
  CredentialRefreshService,
  CredentialRefreshServiceFactory,
  createDefaultRefreshConfig,
  setupCredentialRefresh
} from './credentialRefresh';

export type {
  // Credential Monitoring interface
  ICredentialMonitoringService,
  CredentialMonitoringConfig,
  CredentialHealthStatus,
  MonitoringAlert,
  MonitoringCheckResult,
  MonitoringStatistics
} from './credentialMonitoring';

export {
  // Credential Monitoring implementation
  CredentialMonitoringService,
  CredentialMonitoringServiceFactory,
  createDefaultMonitoringConfig,
  setupCredentialMonitoring
} from './credentialMonitoring';

export type {
  // Credential Notifications interface
  ICredentialNotificationService,
  NotificationChannel,
  NotificationMessage,
  NotificationTemplate,
  NotificationStatistics,
  NotificationEventType,
  NotificationPriority
} from './credentialNotifications';

export {
  // Credential Notifications implementation
  CredentialNotificationService,
  CredentialNotificationServiceFactory,
  createDefaultNotificationChannel,
  setupCredentialNotifications
} from './credentialNotifications';

// ============================================================================
// CONVENIENT FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a complete credential management system with default configuration
 */
export function createCredentialManager() {
  const { BrowserCredentialStorage } = require('./storage');
  const { CredentialEncryptionFactory } = require('./encryption');
  const { CredentialLifecycleFactory } = require('./lifecycle');
  
  return {
    storage: new BrowserCredentialStorage(),
    encryption: CredentialEncryptionFactory.createDefault(),
    lifecycle: CredentialLifecycleFactory.createDefault()
  };
}

/**
 * Create a high-security credential management system
 */
export function createSecureCredentialManager() {
  const { BrowserCredentialStorage } = require('./storage');
  const { CredentialEncryptionFactory } = require('./encryption');
  const { CredentialLifecycleFactory } = require('./lifecycle');
  
  return {
    storage: new BrowserCredentialStorage({
      encryptionEnabled: true,
      backupEnabled: true,
      maxCredentials: 25, // Lower limit for security
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days TTL
    }),
    encryption: CredentialEncryptionFactory.createHighSecurity(),
    lifecycle: CredentialLifecycleFactory.createDefault()
  };
}

/**
 * Create a complete credential service with all components integrated
 */
export function createCredentialService() {
  const { CredentialServiceFactory } = require('./services');
  return CredentialServiceFactory.createDefault();
}

/**
 * Create a high-security credential service
 */
export function createSecureCredentialService() {
  const { CredentialServiceFactory } = require('./services');
  return CredentialServiceFactory.createSecure();
}

/**
 * Create a credential persistence service
 */
export function createCredentialPersistence() {
  const { CredentialPersistenceFactory } = require('./persistence');
  return CredentialPersistenceFactory.createDefault();
}

/**
 * Create a high-security credential persistence service
 */
export function createSecureCredentialPersistence() {
  const { CredentialPersistenceFactory } = require('./persistence');
  return CredentialPersistenceFactory.createSecure();
}

/**
 * Create an MCP authentication service
 */
export function createMCPAuthService() {
  const { MCPAuthServiceFactory } = require('./mcpAuth');
  return MCPAuthServiceFactory.createDefault();
}

/**
 * Create a high-security MCP authentication service
 */
export function createSecureMCPAuthService() {
  const { MCPAuthServiceFactory } = require('./mcpAuth');
  return MCPAuthServiceFactory.createSecure();
}

/**
 * Create an MCP client
 */
export function createMCPClient() {
  const { MCPClientFactory } = require('./mcpClient');
  return MCPClientFactory.createDefault();
}

/**
 * Create a high-security MCP client
 */
export function createSecureMCPClient() {
  const { MCPClientFactory } = require('./mcpClient');
  return MCPClientFactory.createSecure();
}

/**
 * Create an MCP credential manager
 */
export function createMCPCredentialManager() {
  const { MCPCredentialManagerFactory } = require('./mcpCredentials');
  return MCPCredentialManagerFactory.createDefault();
}

/**
 * Create a high-security MCP credential manager
 */
export function createSecureMCPCredentialManager() {
  const { MCPCredentialManagerFactory } = require('./mcpCredentials');
  return MCPCredentialManagerFactory.createSecure();
}

/**
 * Create a complete MCP system with all components integrated
 */
export function createCompleteMCPSystem() {
  const { MCPCredentialManagerFactory } = require('./mcpCredentials');
  return MCPCredentialManagerFactory.createSecure();
}

/**
 * Create a credential rotation service
 */
export function createCredentialRotationService() {
  const { CredentialRotationServiceFactory } = require('./credentialRotation');
  return CredentialRotationServiceFactory.createDefault();
}

/**
 * Create a high-security credential rotation service
 */
export function createSecureCredentialRotationService() {
  const { CredentialRotationServiceFactory } = require('./credentialRotation');
  return CredentialRotationServiceFactory.createSecure();
}

/**
 * Create a credential refresh service
 */
export function createCredentialRefreshService() {
  const { CredentialRefreshServiceFactory } = require('./credentialRefresh');
  return CredentialRefreshServiceFactory.createDefault();
}

/**
 * Create a high-security credential refresh service
 */
export function createSecureCredentialRefreshService() {
  const { CredentialRefreshServiceFactory } = require('./credentialRefresh');
  return CredentialRefreshServiceFactory.createSecure();
}

/**
 * Create a credential monitoring service
 */
export function createCredentialMonitoringService() {
  const { CredentialMonitoringServiceFactory } = require('./credentialMonitoring');
  return CredentialMonitoringServiceFactory.createDefault();
}

/**
 * Create a high-security credential monitoring service
 */
export function createSecureCredentialMonitoringService() {
  const { CredentialMonitoringServiceFactory } = require('./credentialMonitoring');
  return CredentialMonitoringServiceFactory.createSecure();
}

/**
 * Create a credential notification service
 */
export function createCredentialNotificationService() {
  const { CredentialNotificationServiceFactory } = require('./credentialNotifications');
  return CredentialNotificationServiceFactory.createDefault();
}

/**
 * Create a complete Phase 4 credential management system
 */
export function createCompleteCredentialManagementSystem() {
  const { CredentialRotationServiceFactory } = require('./credentialRotation');
  const { CredentialRefreshServiceFactory } = require('./credentialRefresh');
  const { CredentialMonitoringServiceFactory } = require('./credentialMonitoring');
  const { CredentialNotificationServiceFactory } = require('./credentialNotifications');
  
  return {
    rotationService: CredentialRotationServiceFactory.createSecure(),
    refreshService: CredentialRefreshServiceFactory.createSecure(),
    monitoringService: CredentialMonitoringServiceFactory.createSecure(),
    notificationService: CredentialNotificationServiceFactory.createDefault()
  };
}