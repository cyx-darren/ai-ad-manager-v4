const logger = require('./logger');
const { supabase } = require('./supabase');

/**
 * Token Management Utilities for Phase 5.2.4
 * Handles token refresh, validation, and expiration management
 */

/**
 * Token refresh buffer time (5 minutes before expiration)
 */
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Maximum retry attempts for token refresh
 */
const MAX_REFRESH_RETRIES = 3;

/**
 * Token validation cache to prevent excessive API calls
 */
const tokenValidationCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Parse JWT token to extract expiration and other claims
 * @param {string} token - JWT token
 * @returns {Object|null} Parsed token data
 */
function parseJWTToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Split JWT token into header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );

    return {
      header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
      payload: payload,
      signature: parts[2],
      raw: token,
      isExpired: () => {
        const now = Math.floor(Date.now() / 1000);
        return payload.exp && payload.exp < now;
      },
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      expiresIn: payload.exp ? Math.max(0, payload.exp * 1000 - Date.now()) : null,
      needsRefresh: () => {
        if (!payload.exp) return false;
        const now = Date.now();
        const expiresAt = payload.exp * 1000;
        return (expiresAt - now) <= TOKEN_REFRESH_BUFFER;
      }
    };
  } catch (error) {
    logger.error('Failed to parse JWT token:', error.message);
    return null;
  }
}

/**
 * Validate token and return validation result with caching
 * @param {string} token - JWT token to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateToken(token) {
  try {
    // Check cache first
    const cacheKey = `validate_${token.substring(0, 20)}`;
    const cached = tokenValidationCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.debug('Token validation cache hit');
      return cached.result;
    }

    // Parse token structure
    const parsed = parseJWTToken(token);
    if (!parsed) {
      const result = {
        valid: false,
        error: 'Invalid token format',
        parsed: null
      };
      tokenValidationCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    // Check if token is expired
    if (parsed.isExpired()) {
      const result = {
        valid: false,
        error: 'Token expired',
        parsed: parsed,
        expired: true,
        needsRefresh: true
      };
      tokenValidationCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    // Validate with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      const result = {
        valid: false,
        error: error?.message || 'Token validation failed',
        parsed: parsed,
        supabaseError: error
      };
      tokenValidationCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    // Token is valid
    const result = {
      valid: true,
      user: user,
      parsed: parsed,
      needsRefresh: parsed.needsRefresh(),
      expiresIn: parsed.expiresIn,
      expiresAt: parsed.expiresAt
    };

    // Cache valid result for shorter time if needs refresh
    const cacheTTL = parsed.needsRefresh() ? 30000 : CACHE_TTL; // 30 seconds if needs refresh
    tokenValidationCache.set(cacheKey, { result, timestamp: Date.now() }, cacheTTL);

    return result;
  } catch (error) {
    logger.error('Token validation error:', error.message);
    return {
      valid: false,
      error: error.message,
      parsed: null
    };
  }
}

/**
 * Attempt to refresh a Supabase token
 * @param {string} refreshToken - Refresh token
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Refresh result
 */
async function refreshToken(refreshToken, retryCount = 0) {
  try {
    logger.info('Attempting token refresh', { 
      attempt: retryCount + 1, 
      maxRetries: MAX_REFRESH_RETRIES 
    });

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }

    if (!data.session || !data.user) {
      throw new Error('Token refresh returned invalid session');
    }

    logger.info('Token refresh successful', {
      userId: data.user.id,
      newExpiresAt: new Date(data.session.expires_at * 1000).toISOString()
    });

    // Clear validation cache for old tokens
    tokenValidationCache.clear();

    return {
      success: true,
      session: data.session,
      user: data.user,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(data.session.expires_at * 1000),
      expiresIn: data.session.expires_in * 1000
    };

  } catch (error) {
    logger.error('Token refresh failed:', {
      error: error.message,
      attempt: retryCount + 1,
      maxRetries: MAX_REFRESH_RETRIES
    });

    // Retry logic
    if (retryCount < MAX_REFRESH_RETRIES - 1) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      logger.info(`Retrying token refresh in ${delay}ms`, { 
        nextAttempt: retryCount + 2 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshToken(refreshToken, retryCount + 1);
    }

    return {
      success: false,
      error: error.message,
      retryCount: retryCount + 1,
      maxRetriesExceeded: true
    };
  }
}

/**
 * Enhanced middleware to handle automatic token refresh
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function autoRefreshTokenMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Only process Supabase JWT tokens
    if (!bearerToken || bearerToken === 'development-key') {
      return next();
    }

    // Validate current token
    const validation = await validateToken(bearerToken);
    
    if (!validation.valid) {
      // If token is expired, try to refresh if refresh token is available
      if (validation.expired && req.headers['x-refresh-token']) {
        const refreshResult = await refreshToken(req.headers['x-refresh-token']);
        
        if (refreshResult.success) {
          // Update request with new token info
          req.headers['authorization'] = `Bearer ${refreshResult.accessToken}`;
          req.refreshedToken = {
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            expiresAt: refreshResult.expiresAt,
            expiresIn: refreshResult.expiresIn
          };
          
          logger.info('Token automatically refreshed in middleware', {
            userId: refreshResult.user.id,
            newExpiresAt: refreshResult.expiresAt.toISOString()
          });
        } else {
          logger.warn('Automatic token refresh failed in middleware', {
            error: refreshResult.error
          });
        }
      }
    } else if (validation.needsRefresh && req.headers['x-refresh-token']) {
      // Proactively refresh token if it will expire soon
      logger.info('Proactively refreshing token', {
        expiresIn: validation.expiresIn,
        expiresAt: validation.expiresAt?.toISOString()
      });
      
      try {
        const refreshResult = await refreshToken(req.headers['x-refresh-token']);
        if (refreshResult.success) {
          req.refreshedToken = {
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            expiresAt: refreshResult.expiresAt,
            expiresIn: refreshResult.expiresIn
          };
        }
      } catch (error) {
        // Log but don't fail the request
        logger.warn('Proactive token refresh failed:', error.message);
      }
    }

    // Add token info to request for downstream use
    req.tokenInfo = validation;
    
    next();
  } catch (error) {
    logger.error('Auto refresh token middleware error:', error.message);
    next(); // Continue without failing the request
  }
}

/**
 * Token health check endpoint handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function tokenHealthCheck(req, res) {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!bearerToken) {
      return res.status(400).json({
        error: 'No token provided',
        message: 'Provide token via Authorization: Bearer header'
      });
    }

    const validation = await validateToken(bearerToken);
    
    res.json({
      tokenHealth: {
        valid: validation.valid,
        expired: validation.expired || false,
        needsRefresh: validation.needsRefresh || false,
        expiresAt: validation.expiresAt?.toISOString() || null,
        expiresIn: validation.expiresIn || null,
        error: validation.error || null
      },
      user: validation.user ? {
        id: validation.user.id,
        email: validation.user.email,
        lastSignIn: validation.user.last_sign_in_at
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Token health check error:', error.message);
    res.status(500).json({
      error: 'Token health check failed',
      message: error.message
    });
  }
}

/**
 * Clear token validation cache
 */
function clearTokenCache() {
  tokenValidationCache.clear();
  logger.info('Token validation cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    size: tokenValidationCache.size,
    maxSize: 100, // Arbitrary limit
    keys: Array.from(tokenValidationCache.keys()).map(key => key.substring(0, 20) + '...')
  };
}

module.exports = {
  parseJWTToken,
  validateToken,
  refreshToken,
  autoRefreshTokenMiddleware,
  tokenHealthCheck,
  clearTokenCache,
  getCacheStats,
  TOKEN_REFRESH_BUFFER,
  MAX_REFRESH_RETRIES
};