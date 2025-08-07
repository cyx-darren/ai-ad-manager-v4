import {
  MCPAuthCredentials,
  SecurityValidationResult,
  SecurityViolation,
  SecurityViolationType,
  MCPSecurityConfig,
  SecurityAuditLogEntry
} from './authTypes';

/**
 * Security Validation System for Phase 5
 * Comprehensive security validation and token sanitization
 */
export class SecurityValidator {
  private config: MCPSecurityConfig;
  private auditLog: SecurityAuditLogEntry[] = [];
  private rateLimitTracker: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config: MCPSecurityConfig) {
    this.config = config;
  }

  // ============================================================================
  // PHASE 5: SECURITY VALIDATION & SANITIZATION
  // ============================================================================

  /**
   * Comprehensive security validation for authentication credentials
   */
  validateCredentials(credentials: MCPAuthCredentials, context?: Record<string, any>): SecurityValidationResult {
    const startTime = Date.now();
    const violations: SecurityViolation[] = [];
    let securityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Token structure validation
      this.validateTokenStructure(credentials, violations);

      // Token age validation
      this.validateTokenAge(credentials, violations);

      // Token tampering detection
      this.validateTokenIntegrity(credentials, violations);

      // Payload size validation
      this.validatePayloadSize(credentials, violations);

      // Encoding validation
      this.validateEncoding(credentials, violations);

      // Timing attack detection
      this.validateTiming(credentials, startTime, violations);

      // Context validation (headers, origin, etc.)
      if (context) {
        this.validateContext(context, violations);
      }

      // Rate limiting check
      this.validateRateLimit(credentials.userId, violations);

      // Determine security level based on violations
      securityLevel = this.calculateSecurityLevel(violations);

      // Create sanitized credentials
      const sanitizedData = this.sanitizeCredentials(credentials, violations);

      // Log security validation
      this.logSecurityValidation(credentials, violations, securityLevel);

      return {
        isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
        securityLevel,
        violations,
        recommendations: this.generateSecurityRecommendations(violations),
        sanitizedData,
        validationTimestamp: Date.now()
      };

    } catch (error) {
      const criticalViolation: SecurityViolation = {
        type: SecurityViolationType.INVALID_ENCODING,
        severity: 'critical',
        message: `Security validation error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        context: { error: error instanceof Error ? error.message : error }
      };

      violations.push(criticalViolation);

      return {
        isValid: false,
        securityLevel: 'critical',
        violations,
        recommendations: ['Review and fix security validation errors immediately'],
        validationTimestamp: Date.now()
      };
    }
  }

  /**
   * Validate token structure and required fields
   */
  private validateTokenStructure(credentials: MCPAuthCredentials, violations: SecurityViolation[]): void {
    if (!credentials.bearerToken || typeof credentials.bearerToken !== 'string') {
      violations.push({
        type: SecurityViolationType.MALFORMED_TOKEN,
        severity: 'critical',
        message: 'Bearer token is missing or invalid',
        field: 'bearerToken',
        originalValue: credentials.bearerToken,
        timestamp: Date.now()
      });
    }

    if (!credentials.userId || typeof credentials.userId !== 'string') {
      violations.push({
        type: SecurityViolationType.MALFORMED_TOKEN,
        severity: 'high',
        message: 'User ID is missing or invalid',
        field: 'userId',
        originalValue: credentials.userId,
        timestamp: Date.now()
      });
    }

    if (!credentials.userEmail || typeof credentials.userEmail !== 'string') {
      violations.push({
        type: SecurityViolationType.MALFORMED_TOKEN,
        severity: 'medium',
        message: 'User email is missing or invalid',
        field: 'userEmail',
        originalValue: credentials.userEmail,
        timestamp: Date.now()
      });
    }

    // Validate JWT structure if bearer token looks like a JWT
    if (credentials.bearerToken && typeof credentials.bearerToken === 'string') {
      const parts = credentials.bearerToken.split('.');
      if (parts.length === 3) {
        // Basic JWT structure validation
        try {
          const payload = JSON.parse(atob(parts[1]));
          if (!payload.exp || !payload.iat) {
            violations.push({
              type: SecurityViolationType.MALFORMED_TOKEN,
              severity: 'high',
              message: 'JWT payload missing required fields (exp, iat)',
              field: 'bearerToken',
              timestamp: Date.now()
            });
          }
        } catch (error) {
          violations.push({
            type: SecurityViolationType.MALFORMED_TOKEN,
            severity: 'high',
            message: 'Invalid JWT payload encoding',
            field: 'bearerToken',
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Validate token age and expiry
   */
  private validateTokenAge(credentials: MCPAuthCredentials, violations: SecurityViolation[]): void {
    const now = Date.now();

    if (credentials.expiresAt <= now) {
      violations.push({
        type: SecurityViolationType.EXPIRED_TOKEN,
        severity: 'critical',
        message: 'Token has expired',
        field: 'expiresAt',
        originalValue: credentials.expiresAt,
        timestamp: Date.now(),
        context: { expiresAt: new Date(credentials.expiresAt).toISOString(), now: new Date(now).toISOString() }
      });
    }

    // Check if token is too old (exceeds max age)
    const tokenAge = now - (credentials.expiresAt - (60 * 60 * 1000)); // Assume 1 hour default lifetime
    if (tokenAge > this.config.maxTokenAge) {
      violations.push({
        type: SecurityViolationType.EXPIRED_TOKEN,
        severity: 'high',
        message: 'Token exceeds maximum allowed age',
        field: 'expiresAt',
        originalValue: credentials.expiresAt,
        timestamp: Date.now(),
        context: { tokenAge, maxTokenAge: this.config.maxTokenAge }
      });
    }

    // Check if token expires too soon (less than 5 minutes)
    const timeUntilExpiry = credentials.expiresAt - now;
    if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
      violations.push({
        type: SecurityViolationType.EXPIRED_TOKEN,
        severity: 'medium',
        message: 'Token expires very soon (less than 5 minutes)',
        field: 'expiresAt',
        originalValue: credentials.expiresAt,
        timestamp: Date.now(),
        context: { timeUntilExpiry }
      });
    }
  }

  /**
   * Detect token tampering attempts
   */
  private validateTokenIntegrity(credentials: MCPAuthCredentials, violations: SecurityViolation[]): void {
    // Check for suspicious token modifications
    if (credentials.bearerToken && typeof credentials.bearerToken === 'string') {
      // Check for suspicious characters
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /eval\(/i,
        /setTimeout\(/i,
        /setInterval\(/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(credentials.bearerToken)) {
          violations.push({
            type: SecurityViolationType.TOKEN_TAMPERING,
            severity: 'critical',
            message: `Suspicious pattern detected in token: ${pattern.source}`,
            field: 'bearerToken',
            timestamp: Date.now()
          });
        }
      }

      // Check for unusual token length
      if (credentials.bearerToken.length < 20 || credentials.bearerToken.length > 8192) {
        violations.push({
          type: SecurityViolationType.TOKEN_TAMPERING,
          severity: 'medium',
          message: 'Token length is unusual (too short or too long)',
          field: 'bearerToken',
          originalValue: `Length: ${credentials.bearerToken.length}`,
          timestamp: Date.now()
        });
      }
    }

    // Validate user ID format
    if (credentials.userId && typeof credentials.userId === 'string') {
      // Check for SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /(\b(OR|AND)\b.*=)/i,
        /(--|\/\*|\*\/)/,
        /['";]/
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(credentials.userId)) {
          violations.push({
            type: SecurityViolationType.SQL_INJECTION,
            severity: 'critical',
            message: `SQL injection pattern detected in user ID: ${pattern.source}`,
            field: 'userId',
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Validate payload size limits
   */
  private validatePayloadSize(credentials: MCPAuthCredentials, violations: SecurityViolation[]): void {
    const maxTokenSize = 4096; // 4KB limit
    const maxFieldSize = 1024; // 1KB per field

    if (credentials.bearerToken && credentials.bearerToken.length > maxTokenSize) {
      violations.push({
        type: SecurityViolationType.PAYLOAD_TOO_LARGE,
        severity: 'high',
        message: 'Bearer token exceeds size limit',
        field: 'bearerToken',
        originalValue: `Size: ${credentials.bearerToken.length}`,
        timestamp: Date.now(),
        context: { size: credentials.bearerToken.length, limit: maxTokenSize }
      });
    }

    if (credentials.userEmail && credentials.userEmail.length > maxFieldSize) {
      violations.push({
        type: SecurityViolationType.PAYLOAD_TOO_LARGE,
        severity: 'medium',
        message: 'User email exceeds size limit',
        field: 'userEmail',
        originalValue: `Size: ${credentials.userEmail.length}`,
        timestamp: Date.now()
      });
    }

    if (credentials.userId && credentials.userId.length > maxFieldSize) {
      violations.push({
        type: SecurityViolationType.PAYLOAD_TOO_LARGE,
        severity: 'medium',
        message: 'User ID exceeds size limit',
        field: 'userId',
        originalValue: `Size: ${credentials.userId.length}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Validate encoding and character sets
   */
  private validateEncoding(credentials: MCPAuthCredentials, violations: SecurityViolation[]): void {
    const fields = ['bearerToken', 'userId', 'userEmail'] as const;

    for (const field of fields) {
      const value = credentials[field];
      if (typeof value === 'string') {
        // Check for valid UTF-8 encoding
        try {
          const encoded = encodeURIComponent(value);
          const decoded = decodeURIComponent(encoded);
          if (decoded !== value) {
            violations.push({
              type: SecurityViolationType.INVALID_ENCODING,
              severity: 'medium',
              message: `Invalid character encoding in ${field}`,
              field,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          violations.push({
            type: SecurityViolationType.INVALID_ENCODING,
            severity: 'high',
            message: `Encoding validation failed for ${field}`,
            field,
            timestamp: Date.now()
          });
        }

        // Check for null bytes and control characters
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
          violations.push({
            type: SecurityViolationType.INVALID_ENCODING,
            severity: 'high',
            message: `Control characters detected in ${field}`,
            field,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Detect timing attack attempts
   */
  private validateTiming(credentials: MCPAuthCredentials, startTime: number, violations: SecurityViolation[]): void {
    const processingTime = Date.now() - startTime;
    const maxProcessingTime = 1000; // 1 second

    if (processingTime > maxProcessingTime) {
      violations.push({
        type: SecurityViolationType.SUSPICIOUS_TIMING,
        severity: 'medium',
        message: 'Validation took unusually long time',
        timestamp: Date.now(),
        context: { processingTime, maxProcessingTime }
      });
    }
  }

  /**
   * Validate request context (headers, origin, etc.)
   */
  private validateContext(context: Record<string, any>, violations: SecurityViolation[]): void {
    // Validate origin if present
    if (context.origin && this.config.allowedOrigins.length > 0) {
      if (!this.config.allowedOrigins.includes(context.origin)) {
        violations.push({
          type: SecurityViolationType.INVALID_ORIGIN,
          severity: 'high',
          message: 'Request origin not in allowed list',
          field: 'origin',
          originalValue: context.origin,
          timestamp: Date.now()
        });
      }
    }

    // Check for restricted headers
    if (context.headers) {
      for (const header of this.config.restrictedHeaders) {
        if (context.headers[header]) {
          violations.push({
            type: SecurityViolationType.SUSPICIOUS_HEADERS,
            severity: 'medium',
            message: `Restricted header detected: ${header}`,
            field: 'headers',
            originalValue: header,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Rate limiting validation
   */
  private validateRateLimit(userId: string, violations: SecurityViolation[]): void {
    if (!this.config.enableRateLimiting) {
      return;
    }

    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindowMs;
    
    // Clean old entries
    for (const [key, data] of this.rateLimitTracker.entries()) {
      if (data.windowStart < windowStart) {
        this.rateLimitTracker.delete(key);
      }
    }

    // Check current user's rate
    const userKey = `user:${userId}`;
    const userData = this.rateLimitTracker.get(userKey);

    if (userData) {
      if (userData.windowStart >= windowStart) {
        userData.count++;
        if (userData.count > this.config.maxRequestsPerWindow) {
          violations.push({
            type: SecurityViolationType.RATE_LIMIT_EXCEEDED,
            severity: 'high',
            message: 'Rate limit exceeded for user',
            field: 'userId',
            originalValue: userId,
            timestamp: Date.now(),
            context: { count: userData.count, limit: this.config.maxRequestsPerWindow }
          });
        }
      } else {
        // Reset window
        this.rateLimitTracker.set(userKey, { count: 1, windowStart: now });
      }
    } else {
      // First request in window
      this.rateLimitTracker.set(userKey, { count: 1, windowStart: now });
    }
  }

  /**
   * Calculate overall security level based on violations
   */
  private calculateSecurityLevel(violations: SecurityViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const mediumCount = violations.filter(v => v.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'critical';
    if (highCount > 0) return 'high';
    if (mediumCount > 3) return 'high';
    if (mediumCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Sanitize credentials based on security violations
   */
  private sanitizeCredentials(credentials: MCPAuthCredentials, violations: SecurityViolation[]): MCPAuthCredentials {
    const sanitized = { ...credentials };

    for (const violation of violations) {
      if (violation.field && violation.sanitizedValue !== undefined) {
        (sanitized as any)[violation.field] = violation.sanitizedValue;
      }
    }

    return sanitized;
  }

  /**
   * Generate security recommendations based on violations
   */
  private generateSecurityRecommendations(violations: SecurityViolation[]): string[] {
    const recommendations: string[] = [];

    const violationTypes = new Set(violations.map(v => v.type));

    if (violationTypes.has(SecurityViolationType.TOKEN_TAMPERING)) {
      recommendations.push('Review token generation and transmission security');
      recommendations.push('Implement token signing and verification');
    }

    if (violationTypes.has(SecurityViolationType.EXPIRED_TOKEN)) {
      recommendations.push('Implement automatic token refresh');
      recommendations.push('Review token lifetime policies');
    }

    if (violationTypes.has(SecurityViolationType.RATE_LIMIT_EXCEEDED)) {
      recommendations.push('Review rate limiting policies');
      recommendations.push('Consider implementing user-specific rate limits');
    }

    if (violationTypes.has(SecurityViolationType.INVALID_ORIGIN)) {
      recommendations.push('Review and update allowed origins list');
      recommendations.push('Implement proper CORS configuration');
    }

    if (violationTypes.has(SecurityViolationType.SQL_INJECTION) || violationTypes.has(SecurityViolationType.XSS_ATTEMPT)) {
      recommendations.push('Implement comprehensive input sanitization');
      recommendations.push('Review all user input validation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for security threats');
      recommendations.push('Regularly review security policies');
    }

    return recommendations;
  }

  /**
   * Log security validation events
   */
  private logSecurityValidation(
    credentials: MCPAuthCredentials, 
    violations: SecurityViolation[], 
    securityLevel: string
  ): void {
    if (!this.config.enableSecurityLogging && !this.config.enableAuditLogging) {
      return;
    }

    const auditEntry: SecurityAuditLogEntry = {
      timestamp: Date.now(),
      eventType: violations.length > 0 ? 'security_violation' : 'auth_success',
      userId: credentials.userId,
      userEmail: credentials.userEmail,
      action: 'security_validation',
      result: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0 ? 'success' : 'failure',
      details: {
        securityLevel,
        violationCount: violations.length,
        tokenSource: credentials.tokenSource
      },
      clientInfo: {},
      securityContext: violations.length > 0 ? {
        violations,
        riskScore: this.calculateRiskScore(violations),
        mitigationActions: this.generateMitigationActions(violations)
      } : undefined
    };

    this.auditLog.push(auditEntry);

    // Keep only recent entries (last 1000)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    if (this.config.enableSecurityLogging) {
      console.log('[Security Validation]', {
        timestamp: new Date(auditEntry.timestamp).toISOString(),
        userId: credentials.userId,
        securityLevel,
        violations: violations.length,
        result: auditEntry.result
      });
    }
  }

  /**
   * Calculate risk score based on violations
   */
  private calculateRiskScore(violations: SecurityViolation[]): number {
    let score = 0;
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical': score += 25; break;
        case 'high': score += 15; break;
        case 'medium': score += 8; break;
        case 'low': score += 3; break;
      }
    }
    return Math.min(100, score);
  }

  /**
   * Generate mitigation actions for violations
   */
  private generateMitigationActions(violations: SecurityViolation[]): string[] {
    const actions: string[] = [];
    const violationTypes = new Set(violations.map(v => v.type));

    if (violationTypes.has(SecurityViolationType.TOKEN_TAMPERING)) {
      actions.push('Block token and force re-authentication');
    }
    if (violationTypes.has(SecurityViolationType.RATE_LIMIT_EXCEEDED)) {
      actions.push('Apply rate limiting restrictions');
    }
    if (violationTypes.has(SecurityViolationType.EXPIRED_TOKEN)) {
      actions.push('Force token refresh');
    }

    return actions;
  }

  /**
   * Get audit log entries
   */
  getAuditLog(): SecurityAuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}