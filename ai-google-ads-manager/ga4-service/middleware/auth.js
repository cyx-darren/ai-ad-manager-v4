const logger = require('../utils/logger');
const { verifySupabaseToken, getUserProfile } = require('../utils/supabase');
const { validateToken, parseJWTToken } = require('../utils/tokenManager');

/**
 * Enhanced authentication middleware for GA4 API service
 * Supports both API key (development) and Supabase OAuth 2.0 (production)
 * Phase 5.2.3: OAuth 2.0 implementation
 * Phase 5.2.4: Token refresh and management integration
 */

const authMiddleware = async (req, res, next) => {
  try {
    // Extract authentication credentials
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Track authentication method attempted
    let authMethod = 'none';
    let authResult = null;
    
    // Method 1: Supabase JWT Token (OAuth 2.0) - Production
    if (bearerToken && bearerToken !== 'development-key') {
      authMethod = 'supabase_jwt';
      logger.debug('Attempting Supabase JWT authentication');
      
      try {
        // Use enhanced token validation from Phase 5.2.4
        const validation = await validateToken(bearerToken);
        
        if (validation.valid) {
          authResult = {
            method: 'supabase_jwt',
            user: validation.user,
            token: bearerToken,
            authenticated: true,
            timestamp: new Date().toISOString(),
            tokenInfo: {
              expiresAt: validation.expiresAt?.toISOString() || null,
              expiresIn: validation.expiresIn || null,
              needsRefresh: validation.needsRefresh || false,
              parsed: validation.parsed
            }
          };
          
          logger.debug('Supabase JWT authentication successful', {
            userId: validation.user.id,
            email: validation.user.email,
            ip: req.ip,
            needsRefresh: validation.needsRefresh,
            expiresIn: validation.expiresIn
          });
          
          // Add token refresh warning to response headers
          if (validation.needsRefresh) {
            res.set('X-Token-Warning', 'Token expires soon, consider refreshing');
            res.set('X-Token-Expires-In', validation.expiresIn?.toString() || '0');
          }
        } else {
          logger.warn('Supabase JWT authentication failed:', {
            error: validation.error,
            expired: validation.expired,
            needsRefresh: validation.needsRefresh,
            ip: req.ip
          });
          
          // Provide specific error information for expired tokens
          if (validation.expired) {
            res.set('X-Token-Error', 'expired');
            res.set('X-Token-Expired-At', validation.parsed?.expiresAt?.toISOString() || 'unknown');
          }
        }
      } catch (error) {
        logger.warn('Supabase JWT authentication failed:', {
          error: error.message,
          ip: req.ip
        });
      }
    }
    
    // Method 2: API Key Authentication - Development/Testing
    if (!authResult && (apiKey || bearerToken === 'development-key')) {
      authMethod = 'api_key';
      const providedKey = apiKey || bearerToken;
      const validApiKey = process.env.GA4_API_KEY || 'development-key';
      
      if (providedKey === validApiKey) {
        authResult = {
          method: 'api_key',
          apiKey: providedKey,
          authenticated: true,
          timestamp: new Date().toISOString(),
          user: {
            id: 'api-key-user',
            email: 'developer@localhost',
            role: 'developer'
          }
        };
        
        logger.debug('API key authentication successful', {
          method: 'api_key',
          ip: req.ip
        });
      } else {
        logger.warn('API key authentication failed: Invalid key', {
          ip: req.ip,
          providedKey: providedKey?.substring(0, 8) + '...'
        });
      }
    }
    
    // Authentication failed
    if (!authResult) {
      const errorDetails = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        authMethod: authMethod,
        hasApiKey: !!apiKey,
        hasBearerToken: !!bearerToken
      };
      
      logger.warn('Authentication failed: No valid credentials', errorDetails);
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Provide either:\n' +
                '- X-API-Key header with valid API key\n' +
                '- Authorization: Bearer <supabase_jwt_token>',
        authMethods: ['api_key', 'supabase_jwt'],
        tokenRefresh: {
          endpoint: '/auth/refresh',
          description: 'Use POST /auth/refresh with refresh_token to get new access token'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Authentication successful - add auth info to request
    req.auth = authResult;
    
    // Add user profile for Supabase users (optional enhancement)
    if (authResult.method === 'supabase_jwt') {
      try {
        const userProfile = await getUserProfile(authResult.token);
        if (userProfile) {
          req.auth.userProfile = userProfile;
        }
      } catch (error) {
        // Non-critical error - continue without profile
        logger.debug('Failed to get user profile:', error.message);
      }
    }
    
    logger.info('Authentication successful', {
      method: authResult.method,
      userId: authResult.user?.id,
      email: authResult.user?.email,
      url: req.originalUrl,
      ip: req.ip,
      tokenNeedsRefresh: authResult.tokenInfo?.needsRefresh || false
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal authentication error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional middleware to require Supabase authentication only
 * (excludes API key authentication)
 * Enhanced with token management in Phase 5.2.4
 */
const requireSupabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!bearerToken || bearerToken === 'development-key') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Supabase OAuth token required. API key authentication not allowed for this endpoint.',
        requiredAuth: 'supabase_jwt',
        tokenRefresh: {
          endpoint: '/auth/refresh',
          description: 'Use POST /auth/refresh with refresh_token to get new access token'
        }
      });
    }
    
    // Use enhanced token validation
    const validation = await validateToken(bearerToken);
    
    if (!validation.valid) {
      const errorResponse = {
        error: 'Unauthorized',
        message: validation.error || 'Invalid or expired Supabase token',
        timestamp: new Date().toISOString()
      };
      
      // Add specific error information for expired tokens
      if (validation.expired) {
        errorResponse.tokenRefresh = {
          endpoint: '/auth/refresh',
          description: 'Token is expired. Use POST /auth/refresh with refresh_token to get new access token'
        };
        errorResponse.expiredAt = validation.parsed?.expiresAt?.toISOString() || null;
      }
      
      return res.status(401).json(errorResponse);
    }
    
    req.auth = {
      method: 'supabase_jwt',
      user: validation.user,
      token: bearerToken,
      authenticated: true,
      timestamp: new Date().toISOString(),
      tokenInfo: {
        expiresAt: validation.expiresAt?.toISOString() || null,
        expiresIn: validation.expiresIn || null,
        needsRefresh: validation.needsRefresh || false,
        parsed: validation.parsed
      }
    };
    
    // Add token refresh warning to response headers
    if (validation.needsRefresh) {
      res.set('X-Token-Warning', 'Token expires soon, consider refreshing');
      res.set('X-Token-Expires-In', validation.expiresIn?.toString() || '0');
    }
    
    next();
  } catch (error) {
    logger.error('Supabase authentication middleware error:', error.message);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal authentication error'
    });
  }
};

module.exports = authMiddleware;
module.exports.requireSupabaseAuth = requireSupabaseAuth;