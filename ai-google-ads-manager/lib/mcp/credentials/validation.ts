/**
 * MCP Credential Validation Service
 * 
 * This file implements comprehensive validation and format checking
 * for GA4 service account credentials and related data structures.
 */

import {
  GA4ServiceAccountCredential,
  CredentialValidationResult,
  CredentialValidationError,
  CredentialValidationWarning,
  CredentialError
} from './types';

// ============================================================================
// VALIDATION SERVICE INTERFACE
// ============================================================================

/**
 * Interface for credential validation operations
 */
export interface ICredentialValidator {
  // Core validation
  validateGA4Credential(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult>;
  validateCredentialFile(fileContent: string): Promise<CredentialValidationResult>;
  
  // Field-specific validation
  validatePrivateKey(privateKey: string): CredentialValidationResult;
  validateProjectId(projectId: string): CredentialValidationResult;
  validateClientEmail(email: string): CredentialValidationResult;
  validateClientId(clientId: string): CredentialValidationResult;
  
  // Format validation
  validateJsonStructure(jsonString: string): CredentialValidationResult;
  validatePEMFormat(pemString: string): CredentialValidationResult;
  
  // Security validation
  checkSecurityRequirements(credential: GA4ServiceAccountCredential): CredentialValidationResult;
  detectCommonIssues(credential: GA4ServiceAccountCredential): CredentialValidationResult;
  
  // Utility validation
  validateEnvironment(credential: GA4ServiceAccountCredential): CredentialValidationResult;
  validateExpiry(credential: GA4ServiceAccountCredential): CredentialValidationResult;
}

// ============================================================================
// VALIDATION RULES AND PATTERNS
// ============================================================================

/**
 * Validation patterns and rules
 */
export const ValidationPatterns = {
  // Google Project ID: 6-30 characters, lowercase letters, digits, hyphens
  PROJECT_ID: /^[a-z0-9][a-z0-9\-]{4,28}[a-z0-9]$/,
  
  // Google Client ID: numeric string
  CLIENT_ID: /^\d{20,21}$/,
  
  // Google Client Email: service account email format
  CLIENT_EMAIL: /^[a-z0-9\-]+@[a-z0-9\-]+\.iam\.gserviceaccount\.com$/,
  
  // Private Key ID: hex string
  PRIVATE_KEY_ID: /^[a-f0-9]{40}$/,
  
  // RSA Private Key PEM format
  PRIVATE_KEY_PEM: /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/,
  
  // Google OAuth URLs
  AUTH_URI: /^https:\/\/accounts\.google\.com\/o\/oauth2\/auth$/,
  TOKEN_URI: /^https:\/\/oauth2\.googleapis\.com\/token$/,
  
  // X509 Certificate URLs
  CERT_URL: /^https:\/\/www\.googleapis\.com\/oauth2\/v\d+\/certs$/,
  CLIENT_CERT_URL: /^https:\/\/www\.googleapis\.com\/robot\/v\d+\/metadata\/x509\/.+@.+\.iam\.gserviceaccount\.com$/
};

/**
 * Required fields for GA4 service account credentials
 */
export const RequiredFields = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
  'auth_uri',
  'token_uri',
  'auth_provider_x509_cert_url',
  'client_x509_cert_url'
] as const;

/**
 * Expected values for specific fields
 */
export const ExpectedValues = {
  TYPE: 'service_account',
  AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
  TOKEN_URI: 'https://oauth2.googleapis.com/token',
  AUTH_PROVIDER_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
  UNIVERSE_DOMAIN: 'googleapis.com'
} as const;

// ============================================================================
// VALIDATION SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Comprehensive credential validation service
 */
export class CredentialValidator implements ICredentialValidator {
  
  /**
   * Validate complete GA4 service account credential
   */
  async validateGA4Credential(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult> {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    try {
      // Structure validation
      const structureResult = this.validateStructure(credential);
      errors.push(...structureResult.errors);
      warnings.push(...structureResult.warnings);
      
      // Field validation
      const fieldResults = await this.validateAllFields(credential);
      errors.push(...fieldResults.errors);
      warnings.push(...fieldResults.warnings);
      
      // Security validation
      const securityResult = this.checkSecurityRequirements(credential);
      errors.push(...securityResult.errors);
      warnings.push(...securityResult.warnings);
      
      // Common issues detection
      const issuesResult = this.detectCommonIssues(credential);
      errors.push(...issuesResult.errors);
      warnings.push(...issuesResult.warnings);
      
      // Environment validation
      const envResult = this.validateEnvironment(credential);
      errors.push(...envResult.errors);
      warnings.push(...envResult.warnings);
      
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
          code: 'VALIDATION_EXCEPTION',
          message: `Validation failed with exception: ${error.message}`,
          severity: 'error'
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
   * Validate credential from JSON file content
   */
  async validateCredentialFile(fileContent: string): Promise<CredentialValidationResult> {
    try {
      // First validate JSON structure
      const jsonResult = this.validateJsonStructure(fileContent);
      if (!jsonResult.isValid) {
        return jsonResult;
      }
      
      // Parse and validate credential
      const credential = JSON.parse(fileContent) as GA4ServiceAccountCredential;
      return await this.validateGA4Credential(credential);
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'file',
          code: 'FILE_PARSE_ERROR',
          message: `Failed to parse credential file: ${error.message}`,
          severity: 'error'
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
   * Validate private key format and content
   */
  validatePrivateKey(privateKey: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Check if private key exists
    if (!privateKey || typeof privateKey !== 'string') {
      errors.push({
        field: 'private_key',
        code: 'MISSING_PRIVATE_KEY',
        message: 'Private key is missing or not a string',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata(['private_key']) };
    }
    
    // Check PEM format
    if (!ValidationPatterns.PRIVATE_KEY_PEM.test(privateKey.trim())) {
      errors.push({
        field: 'private_key',
        code: 'INVALID_PEM_FORMAT',
        message: 'Private key is not in valid PEM format',
        severity: 'error'
      });
    }
    
    // Check for common formatting issues
    if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
      warnings.push({
        field: 'private_key',
        code: 'ESCAPED_NEWLINES',
        message: 'Private key contains escaped newlines (\\n)',
        suggestion: 'Replace \\n with actual newline characters'
      });
    }
    
    // Check key length (RSA-2048 should be around 1700+ characters)
    if (privateKey.length < 1600) {
      warnings.push({
        field: 'private_key',
        code: 'SHORT_PRIVATE_KEY',
        message: 'Private key appears to be shorter than expected',
        suggestion: 'Verify this is a complete RSA-2048 or higher private key'
      });
    }
    
    // Check for suspicious content
    if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
      warnings.push({
        field: 'private_key',
        code: 'RSA_FORMAT_DETECTED',
        message: 'Private key uses RSA format instead of PKCS#8',
        suggestion: 'Convert to PKCS#8 format if needed: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['private_key'])
    };
  }
  
  /**
   * Validate Google Cloud project ID
   */
  validateProjectId(projectId: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    if (!projectId || typeof projectId !== 'string') {
      errors.push({
        field: 'project_id',
        code: 'MISSING_PROJECT_ID',
        message: 'Project ID is missing or not a string',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata(['project_id']) };
    }
    
    // Validate format
    if (!ValidationPatterns.PROJECT_ID.test(projectId)) {
      errors.push({
        field: 'project_id',
        code: 'INVALID_PROJECT_ID_FORMAT',
        message: 'Project ID format is invalid',
        severity: 'error'
      });
    }
    
    // Check length
    if (projectId.length < 6 || projectId.length > 30) {
      errors.push({
        field: 'project_id',
        code: 'INVALID_PROJECT_ID_LENGTH',
        message: 'Project ID must be 6-30 characters long',
        severity: 'error'
      });
    }
    
    // Check for common issues
    if (projectId.startsWith('-') || projectId.endsWith('-')) {
      errors.push({
        field: 'project_id',
        code: 'INVALID_PROJECT_ID_HYPHENS',
        message: 'Project ID cannot start or end with hyphens',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['project_id'])
    };
  }
  
  /**
   * Validate client email format
   */
  validateClientEmail(email: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    if (!email || typeof email !== 'string') {
      errors.push({
        field: 'client_email',
        code: 'MISSING_CLIENT_EMAIL',
        message: 'Client email is missing or not a string',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata(['client_email']) };
    }
    
    // Validate service account email format
    if (!ValidationPatterns.CLIENT_EMAIL.test(email)) {
      errors.push({
        field: 'client_email',
        code: 'INVALID_SERVICE_ACCOUNT_EMAIL',
        message: 'Client email is not a valid service account email format',
        severity: 'error'
      });
    }
    
    // Check if it ends with the correct domain
    if (!email.endsWith('.iam.gserviceaccount.com')) {
      errors.push({
        field: 'client_email',
        code: 'INVALID_SERVICE_ACCOUNT_DOMAIN',
        message: 'Service account email must end with .iam.gserviceaccount.com',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['client_email'])
    };
  }
  
  /**
   * Validate client ID format
   */
  validateClientId(clientId: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    if (!clientId || typeof clientId !== 'string') {
      errors.push({
        field: 'client_id',
        code: 'MISSING_CLIENT_ID',
        message: 'Client ID is missing or not a string',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata(['client_id']) };
    }
    
    // Validate numeric format
    if (!ValidationPatterns.CLIENT_ID.test(clientId)) {
      errors.push({
        field: 'client_id',
        code: 'INVALID_CLIENT_ID_FORMAT',
        message: 'Client ID must be a 20-21 digit numeric string',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['client_id'])
    };
  }
  
  /**
   * Validate JSON structure
   */
  validateJsonStructure(jsonString: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    try {
      const parsed = JSON.parse(jsonString);
      
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push({
          field: 'json',
          code: 'INVALID_JSON_OBJECT',
          message: 'JSON content is not an object',
          severity: 'error'
        });
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: this.createMetadata(['json'])
      };
    } catch (error) {
      errors.push({
        field: 'json',
        code: 'INVALID_JSON_SYNTAX',
        message: `Invalid JSON syntax: ${error.message}`,
        severity: 'error'
      });
      
      return {
        isValid: false,
        errors,
        warnings,
        metadata: this.createMetadata(['json'])
      };
    }
  }
  
  /**
   * Validate PEM format
   */
  validatePEMFormat(pemString: string): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    if (!pemString || typeof pemString !== 'string') {
      errors.push({
        field: 'pem',
        code: 'MISSING_PEM_DATA',
        message: 'PEM data is missing or not a string',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata(['pem']) };
    }
    
    // Check for proper PEM boundaries
    if (!pemString.includes('-----BEGIN') || !pemString.includes('-----END')) {
      errors.push({
        field: 'pem',
        code: 'MISSING_PEM_BOUNDARIES',
        message: 'PEM data is missing BEGIN/END boundaries',
        severity: 'error'
      });
    }
    
    // Check for matching boundaries
    const beginMatches = pemString.match(/-----BEGIN [^-]+-----/g);
    const endMatches = pemString.match(/-----END [^-]+-----/g);
    
    if (!beginMatches || !endMatches || beginMatches.length !== endMatches.length) {
      errors.push({
        field: 'pem',
        code: 'MISMATCHED_PEM_BOUNDARIES',
        message: 'PEM data has mismatched BEGIN/END boundaries',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['pem'])
    };
  }
  
  /**
   * Check security requirements
   */
  checkSecurityRequirements(credential: GA4ServiceAccountCredential): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Check private key strength
    if (credential.private_key && credential.private_key.length < 1700) {
      warnings.push({
        field: 'private_key',
        code: 'WEAK_PRIVATE_KEY',
        message: 'Private key may be weaker than RSA-2048',
        suggestion: 'Use RSA-2048 or stronger private keys for better security'
      });
    }
    
    // Check for test/development indicators
    if (credential.project_id && (
      credential.project_id.includes('test') ||
      credential.project_id.includes('dev') ||
      credential.project_id.includes('staging')
    )) {
      warnings.push({
        field: 'project_id',
        code: 'DEVELOPMENT_PROJECT',
        message: 'Project ID suggests this is a development/test project',
        suggestion: 'Ensure this is not a production credential in a development environment'
      });
    }
    
    // Check for production indicators in development
    if (credential.project_id && (
      credential.project_id.includes('prod') ||
      credential.project_id.includes('production')
    )) {
      warnings.push({
        field: 'project_id',
        code: 'PRODUCTION_PROJECT',
        message: 'Project ID suggests this is a production project',
        suggestion: 'Ensure proper access controls and monitoring for production credentials'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(Object.keys(credential))
    };
  }
  
  /**
   * Detect common credential issues
   */
  detectCommonIssues(credential: GA4ServiceAccountCredential): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Check for escaped newlines in private key
    if (credential.private_key && credential.private_key.includes('\\n')) {
      warnings.push({
        field: 'private_key',
        code: 'ESCAPED_NEWLINES_DETECTED',
        message: 'Private key contains escaped newlines',
        suggestion: 'Replace \\n with actual newline characters when using the key'
      });
    }
    
    // Check for Unicode/encoding issues
    if (credential.private_key && /[^\x00-\x7F]/.test(credential.private_key)) {
      warnings.push({
        field: 'private_key',
        code: 'NON_ASCII_CHARACTERS',
        message: 'Private key contains non-ASCII characters',
        suggestion: 'Ensure the private key is properly encoded in UTF-8'
      });
    }
    
    // Check for common copy-paste issues
    if (credential.private_key && credential.private_key.includes(' ')) {
      const spaces = (credential.private_key.match(/ /g) || []).length;
      if (spaces > 5) { // More than a few spaces might indicate formatting issues
        warnings.push({
          field: 'private_key',
          code: 'EXCESSIVE_SPACES',
          message: 'Private key contains many spaces, possibly from copy-paste issues',
          suggestion: 'Verify the private key format and remove unnecessary spaces'
        });
      }
    }
    
    // Check for placeholder values
    if (credential.project_id && (
      credential.project_id.includes('your-project') ||
      credential.project_id.includes('project-id') ||
      credential.project_id.includes('example')
    )) {
      errors.push({
        field: 'project_id',
        code: 'PLACEHOLDER_VALUE',
        message: 'Project ID appears to be a placeholder value',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(Object.keys(credential))
    };
  }
  
  /**
   * Validate environment compatibility
   */
  validateEnvironment(credential: GA4ServiceAccountCredential): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Check universe domain (for newer credentials)
    if (credential.universe_domain && credential.universe_domain !== ExpectedValues.UNIVERSE_DOMAIN) {
      warnings.push({
        field: 'universe_domain',
        code: 'NON_STANDARD_UNIVERSE_DOMAIN',
        message: `Universe domain '${credential.universe_domain}' is not the standard googleapis.com`,
        suggestion: 'Verify this is correct for your use case'
      });
    }
    
    // Validate standard OAuth URLs
    if (credential.auth_uri !== ExpectedValues.AUTH_URI) {
      warnings.push({
        field: 'auth_uri',
        code: 'NON_STANDARD_AUTH_URI',
        message: 'Auth URI is not the standard Google OAuth URI',
        suggestion: 'Verify this is correct for your authentication flow'
      });
    }
    
    if (credential.token_uri !== ExpectedValues.TOKEN_URI) {
      warnings.push({
        field: 'token_uri',
        code: 'NON_STANDARD_TOKEN_URI',
        message: 'Token URI is not the standard Google OAuth token URI',
        suggestion: 'Verify this is correct for your authentication flow'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(Object.keys(credential))
    };
  }
  
  /**
   * Validate credential expiry (if applicable)
   */
  validateExpiry(credential: GA4ServiceAccountCredential): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Service account credentials don't typically expire, but we can check
    // for signs that this might be a temporary or limited credential
    
    // Check if private key ID suggests rotation
    if (credential.private_key_id && credential.private_key_id.length < 40) {
      warnings.push({
        field: 'private_key_id',
        code: 'SHORT_PRIVATE_KEY_ID',
        message: 'Private key ID is shorter than expected',
        suggestion: 'Verify this is a valid service account credential'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(['private_key_id'])
    };
  }
  
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================
  
  /**
   * Validate credential structure and required fields
   */
  private validateStructure(credential: GA4ServiceAccountCredential): CredentialValidationResult {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Check if credential is an object
    if (!credential || typeof credential !== 'object') {
      errors.push({
        field: 'credential',
        code: 'INVALID_CREDENTIAL_TYPE',
        message: 'Credential must be an object',
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings, metadata: this.createMetadata([]) };
    }
    
    // Check required fields
    for (const field of RequiredFields) {
      if (!credential[field]) {
        errors.push({
          field,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          severity: 'error'
        });
      }
    }
    
    // Check credential type
    if (credential.type !== ExpectedValues.TYPE) {
      errors.push({
        field: 'type',
        code: 'INVALID_CREDENTIAL_TYPE',
        message: `Expected type '${ExpectedValues.TYPE}', got '${credential.type}'`,
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(Object.keys(credential))
    };
  }
  
  /**
   * Validate all credential fields
   */
  private async validateAllFields(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult> {
    const errors: CredentialValidationError[] = [];
    const warnings: CredentialValidationWarning[] = [];
    
    // Validate individual fields
    const fieldValidations = [
      this.validateProjectId(credential.project_id),
      this.validateClientEmail(credential.client_email),
      this.validateClientId(credential.client_id),
      this.validatePrivateKey(credential.private_key)
    ];
    
    for (const result of fieldValidations) {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    
    // Validate URLs
    const urlFields = [
      { field: 'auth_uri', value: credential.auth_uri },
      { field: 'token_uri', value: credential.token_uri },
      { field: 'auth_provider_x509_cert_url', value: credential.auth_provider_x509_cert_url },
      { field: 'client_x509_cert_url', value: credential.client_x509_cert_url }
    ];
    
    for (const { field, value } of urlFields) {
      if (value && !this.isValidUrl(value)) {
        errors.push({
          field,
          code: 'INVALID_URL_FORMAT',
          message: `${field} is not a valid URL`,
          severity: 'error'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.createMetadata(Object.keys(credential))
    };
  }
  
  /**
   * Create validation metadata
   */
  private createMetadata(checkedFields: string[]) {
    return {
      validatedAt: new Date().toISOString(),
      validationVersion: '1.0',
      checkedFields
    };
  }
  
  /**
   * Check if a string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// VALIDATION FACTORY
// ============================================================================

/**
 * Factory for creating validator instances
 */
export class CredentialValidatorFactory {
  /**
   * Create default validator
   */
  static createDefault(): CredentialValidator {
    return new CredentialValidator();
  }
  
  /**
   * Create strict validator with enhanced security checks
   */
  static createStrict(): CredentialValidator {
    // This could be enhanced with additional security validation rules
    return new CredentialValidator();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick validation function for simple checks
 */
export async function validateGA4Credential(credential: GA4ServiceAccountCredential): Promise<CredentialValidationResult> {
  const validator = CredentialValidatorFactory.createDefault();
  return await validator.validateGA4Credential(credential);
}

/**
 * Quick validation function for credential files
 */
export async function validateCredentialFile(fileContent: string): Promise<CredentialValidationResult> {
  const validator = CredentialValidatorFactory.createDefault();
  return await validator.validateCredentialFile(fileContent);
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: CredentialValidationResult): string {
  if (result.isValid) {
    return 'Credential validation passed';
  }
  
  const errorMessages = result.errors.map(error => 
    `[${error.severity.toUpperCase()}] ${error.field}: ${error.message}`
  );
  
  const warningMessages = result.warnings.map(warning => 
    `[WARNING] ${warning.field}: ${warning.message}${warning.suggestion ? ` (${warning.suggestion})` : ''}`
  );
  
  return [...errorMessages, ...warningMessages].join('\n');
}