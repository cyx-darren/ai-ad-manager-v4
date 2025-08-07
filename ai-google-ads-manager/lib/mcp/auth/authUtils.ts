/**
 * MCP Authentication Utilities
 * 
 * Utilities for extracting and transforming Supabase authentication data for MCP usage
 * Phase 1 of Subtask 28.1: Foundation Setup
 */

import { Session, User } from '@supabase/supabase-js';
import { 
  SupabaseAuthData, 
  MCPAuthCredentials, 
  MCPAuthError, 
  MCPAuthErrorType,
  TokenValidationResult,
  ExtendedSupabaseSession,
  MCPAuthStatus
} from './authTypes';

// ============================================================================
// TOKEN EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract authentication data from Supabase session
 */
export function extractSupabaseAuthData(session: Session | null): SupabaseAuthData | null {
  if (!session || !session.access_token || !session.user) {
    return null;
  }

  try {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token || '',
      userId: session.user.id,
      email: session.user.email || '',
      expiresAt: session.expires_at ? session.expires_at * 1000 : undefined, // Convert to milliseconds
      tokenType: session.token_type || 'bearer',
      sessionId: generateSessionId(session)
    };
  } catch (error) {
    console.error('[MCP Auth] Error extracting Supabase auth data:', error);
    return null;
  }
}

/**
 * Transform Supabase auth data into MCP credentials
 */
export function transformToMCPCredentials(authData: SupabaseAuthData): MCPAuthCredentials {
  const now = Date.now();
  const expiresAt = authData.expiresAt || (now + (60 * 60 * 1000)); // Default 1 hour if no expiry

  return {
    bearerToken: authData.accessToken,
    refreshToken: authData.refreshToken,
    userId: authData.userId,
    userEmail: authData.email,
    expiresAt,
    tokenSource: 'supabase',
    sessionMetadata: {
      sessionId: authData.sessionId || generateSessionId(),
      issuedAt: now,
      lastRefresh: undefined
    }
  };
}

/**
 * Extract MCP credentials directly from Supabase session
 */
export function extractMCPCredentials(session: Session | null): MCPAuthCredentials | null {
  const authData = extractSupabaseAuthData(session);
  if (!authData) {
    return null;
  }

  return transformToMCPCredentials(authData);
}

/**
 * Generate a unique session ID for tracking
 */
function generateSessionId(session?: Session): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const userHash = session?.user?.id ? 
    session.user.id.substring(0, 8) : 
    'anon';
  
  return `mcp_${userHash}_${timestamp}_${random}`;
}

// ============================================================================
// TOKEN VALIDATION UTILITIES
// ============================================================================

/**
 * Validate MCP authentication token
 */
export function validateMCPToken(credentials: MCPAuthCredentials | null): TokenValidationResult {
  if (!credentials) {
    return {
      isValid: false,
      isExpired: true,
      timeUntilExpiry: 0,
      errors: ['No credentials provided']
    };
  }

  const errors: string[] = [];
  const now = Date.now();
  const timeUntilExpiry = credentials.expiresAt - now;
  const isExpired = timeUntilExpiry <= 0;

  // Basic validation
  if (!credentials.bearerToken) {
    errors.push('Missing bearer token');
  }

  if (!credentials.userId) {
    errors.push('Missing user ID');
  }

  if (!credentials.userEmail) {
    errors.push('Missing user email');
  }

  if (credentials.tokenSource !== 'supabase') {
    errors.push('Invalid token source');
  }

  // Token format validation (basic JWT structure check)
  if (credentials.bearerToken && !isValidJWTFormat(credentials.bearerToken)) {
    errors.push('Invalid token format');
  }

  const isValid = errors.length === 0 && !isExpired;

  return {
    isValid,
    isExpired,
    timeUntilExpiry: Math.max(0, timeUntilExpiry),
    errors,
    metadata: {
      issuedAt: credentials.sessionMetadata?.issuedAt,
      expiresAt: credentials.expiresAt,
      tokenAge: credentials.sessionMetadata?.issuedAt ? 
        now - credentials.sessionMetadata.issuedAt : undefined
    }
  };
}

/**
 * Check if token needs refresh (within threshold of expiry)
 */
export function shouldRefreshToken(
  credentials: MCPAuthCredentials, 
  thresholdMinutes: number = 5
): boolean {
  const validation = validateMCPToken(credentials);
  if (!validation.isValid || validation.isExpired) {
    return true;
  }

  const thresholdMs = thresholdMinutes * 60 * 1000;
  return validation.timeUntilExpiry <= thresholdMs;
}

/**
 * Basic JWT format validation
 */
function isValidJWTFormat(token: string): boolean {
  try {
    const parts = token.split('.');
    return parts.length === 3 && 
           parts.every(part => part.length > 0);
  } catch {
    return false;
  }
}

// ============================================================================
// AUTH STATUS UTILITIES
// ============================================================================

/**
 * Get current authentication status
 */
export function getAuthStatus(credentials: MCPAuthCredentials | null): MCPAuthStatus {
  if (!credentials) {
    return {
      isAuthenticated: false,
      hasValidToken: false,
      authSource: 'none',
      errors: ['No authentication credentials available']
    };
  }

  const validation = validateMCPToken(credentials);
  
  return {
    isAuthenticated: validation.isValid,
    hasValidToken: validation.isValid && !validation.isExpired,
    tokenExpiresAt: credentials.expiresAt,
    timeUntilExpiry: validation.timeUntilExpiry,
    lastRefresh: credentials.sessionMetadata?.lastRefresh,
    authSource: credentials.tokenSource,
    userId: credentials.userId,
    userEmail: credentials.userEmail,
    errors: validation.errors
  };
}

/**
 * Create authentication headers for MCP requests
 */
export function createAuthHeaders(credentials: MCPAuthCredentials | null): Record<string, string> {
  if (!credentials || !validateMCPToken(credentials).isValid) {
    return {};
  }

  return {
    'Authorization': `Bearer ${credentials.bearerToken}`,
    'X-User-ID': credentials.userId,
    'X-User-Email': credentials.userEmail,
    'X-Token-Source': credentials.tokenSource,
    'X-Session-ID': credentials.sessionMetadata?.sessionId || 'unknown'
  };
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Create standardized MCP authentication error
 */
export function createMCPAuthError(
  type: MCPAuthErrorType,
  message: string,
  context?: any,
  originalError?: Error
): MCPAuthError {
  return new MCPAuthError(type, message, context, originalError);
}

/**
 * Handle Supabase authentication errors and convert to MCP auth errors
 */
export function handleSupabaseAuthError(error: any): MCPAuthError {
  if (!error) {
    return createMCPAuthError(
      MCPAuthErrorType.UNKNOWN_ERROR,
      'Unknown authentication error'
    );
  }

  // Handle Supabase-specific errors
  if (error.message?.includes('JWT expired')) {
    return createMCPAuthError(
      MCPAuthErrorType.TOKEN_EXPIRED,
      'Authentication token has expired',
      { supabaseError: error },
      error
    );
  }

  if (error.message?.includes('Invalid JWT')) {
    return createMCPAuthError(
      MCPAuthErrorType.INVALID_TOKEN,
      'Invalid authentication token',
      { supabaseError: error },
      error
    );
  }

  if (error.message?.includes('refresh')) {
    return createMCPAuthError(
      MCPAuthErrorType.REFRESH_FAILED,
      'Failed to refresh authentication token',
      { supabaseError: error },
      error
    );
  }

  if (error.status === 401 || error.statusCode === 401) {
    return createMCPAuthError(
      MCPAuthErrorType.INVALID_TOKEN,
      'Authentication failed - invalid credentials',
      { supabaseError: error },
      error
    );
  }

  // Network errors
  if (error.message?.includes('network') || error.message?.includes('fetch')) {
    return createMCPAuthError(
      MCPAuthErrorType.NETWORK_ERROR,
      'Network error during authentication',
      { supabaseError: error },
      error
    );
  }

  // Generic Supabase error
  return createMCPAuthError(
    MCPAuthErrorType.SUPABASE_ERROR,
    `Supabase authentication error: ${error.message || 'Unknown error'}`,
    { supabaseError: error },
    error
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debug log authentication data (safely, without exposing sensitive info)
 */
export function debugLogAuthData(
  credentials: MCPAuthCredentials | null, 
  label: string = 'Auth Data'
): void {
  if (!credentials) {
    console.debug(`[MCP Auth] ${label}: No credentials`);
    return;
  }

  const safeData = {
    hasToken: !!credentials.bearerToken,
    tokenLength: credentials.bearerToken?.length || 0,
    userId: credentials.userId,
    userEmail: credentials.userEmail?.replace(/(.{3}).*(@.*)/, '$1***$2'), // Mask email
    expiresAt: new Date(credentials.expiresAt).toISOString(),
    timeUntilExpiry: credentials.expiresAt - Date.now(),
    tokenSource: credentials.tokenSource,
    sessionId: credentials.sessionMetadata?.sessionId
  };

  console.debug(`[MCP Auth] ${label}:`, safeData);
}

/**
 * Check if current environment supports secure token storage
 */
export function supportsSecureStorage(): boolean {
  return typeof window !== 'undefined' && 
         'localStorage' in window && 
         window.isSecureContext;
}

/**
 * Sanitize auth data for logging (remove sensitive tokens)
 */
export function sanitizeAuthDataForLogging(credentials: MCPAuthCredentials): any {
  return {
    userId: credentials.userId,
    userEmail: credentials.userEmail,
    hasToken: !!credentials.bearerToken,
    tokenLength: credentials.bearerToken?.length,
    expiresAt: credentials.expiresAt,
    tokenSource: credentials.tokenSource,
    sessionMetadata: credentials.sessionMetadata
  };
}