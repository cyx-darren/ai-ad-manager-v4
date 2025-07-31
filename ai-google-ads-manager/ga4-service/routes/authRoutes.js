const express = require('express');
const { getGoogleOAuthUrl, handleOAuthCallback, signOut, getUserProfile } = require('../utils/supabase');
const { requireSupabaseAuth } = require('../middleware/auth');
const { 
  refreshToken, 
  tokenHealthCheck, 
  clearTokenCache, 
  getCacheStats,
  parseJWTToken 
} = require('../utils/tokenManager');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /auth/login
 * Initiate Google OAuth 2.0 login flow
 */
router.get('/login', async (req, res) => {
  try {
    const redirectTo = req.query.redirect_to || req.query.redirectTo;
    
    logger.info('OAuth login initiated', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      redirectTo: redirectTo
    });
    
    const oauthData = await getGoogleOAuthUrl(redirectTo);
    
    if (!oauthData.url) {
      throw new Error('Failed to generate OAuth URL');
    }
    
    // Redirect user to Google OAuth
    res.redirect(oauthData.url);
    
  } catch (error) {
    logger.error('OAuth login failed:', {
      error: error.message,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'OAuth initialization failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/callback
 * Handle OAuth callback from Google
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      logger.warn('OAuth callback error:', {
        error: oauthError,
        ip: req.ip
      });
      
      return res.status(400).json({
        error: 'OAuth authorization failed',
        message: oauthError,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate required parameters
    if (!code) {
      logger.warn('OAuth callback missing authorization code', {
        ip: req.ip,
        query: req.query
      });
      
      return res.status(400).json({
        error: 'Invalid OAuth callback',
        message: 'Authorization code is required',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Processing OAuth callback', {
      ip: req.ip,
      hasCode: !!code,
      hasState: !!state
    });
    
    // Exchange code for session
    const sessionData = await handleOAuthCallback(code, state);
    
    if (!sessionData.session || !sessionData.user) {
      throw new Error('Failed to create user session');
    }
    
    logger.info('OAuth callback successful', {
      userId: sessionData.user.id,
      email: sessionData.user.email,
      ip: req.ip
    });
    
    // Parse token for additional info
    const tokenInfo = parseJWTToken(sessionData.session.access_token);
    
    // Return success response with token and refresh token
    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.user_metadata?.full_name,
        avatar: sessionData.user.user_metadata?.avatar_url
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        expires_in: sessionData.session.expires_in
      },
      tokenInfo: {
        expiresAt: tokenInfo?.expiresAt?.toISOString() || null,
        expiresIn: tokenInfo?.expiresIn || null,
        needsRefresh: tokenInfo?.needsRefresh() || false
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('OAuth callback processing failed:', {
      error: error.message,
      ip: req.ip,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'OAuth callback failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh an expired or expiring access token
 * Phase 5.2.4: Token Refresh Management
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const refreshTokenHeader = req.headers['x-refresh-token'];
    
    const refreshTokenToUse = refresh_token || refreshTokenHeader;
    
    if (!refreshTokenToUse) {
      return res.status(400).json({
        error: 'Refresh token required',
        message: 'Provide refresh token in request body or X-Refresh-Token header',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Token refresh requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: refresh_token ? 'body' : 'header'
    });
    
    const refreshResult = await refreshToken(refreshTokenToUse);
    
    if (!refreshResult.success) {
      logger.warn('Token refresh failed', {
        error: refreshResult.error,
        retryCount: refreshResult.retryCount,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Token refresh failed',
        message: refreshResult.error,
        retryCount: refreshResult.retryCount,
        maxRetriesExceeded: refreshResult.maxRetriesExceeded,
        timestamp: new Date().toISOString()
      });
    }
    
    // Parse new token for additional info
    const tokenInfo = parseJWTToken(refreshResult.accessToken);
    
    logger.info('Token refresh successful', {
      userId: refreshResult.user.id,
      email: refreshResult.user.email,
      newExpiresAt: refreshResult.expiresAt.toISOString(),
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      user: {
        id: refreshResult.user.id,
        email: refreshResult.user.email,
        name: refreshResult.user.user_metadata?.full_name
      },
      session: {
        access_token: refreshResult.accessToken,
        refresh_token: refreshResult.refreshToken,
        expires_at: Math.floor(refreshResult.expiresAt.getTime() / 1000),
        expires_in: Math.floor(refreshResult.expiresIn / 1000)
      },
      tokenInfo: {
        expiresAt: tokenInfo?.expiresAt?.toISOString() || null,
        expiresIn: tokenInfo?.expiresIn || null,
        needsRefresh: tokenInfo?.needsRefresh() || false
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Token refresh endpoint error:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Token refresh error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/token/health
 * Check token health and expiration status
 * Phase 5.2.4: Token Management
 */
router.get('/token/health', tokenHealthCheck);

/**
 * POST /auth/logout
 * Sign out user (requires authentication)
 */
router.post('/logout', requireSupabaseAuth, async (req, res) => {
  try {
    const { token, user } = req.auth;
    
    logger.info('User logout initiated', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });
    
    await signOut(token);
    
    // Clear token cache for this user
    clearTokenCache();
    
    logger.info('User logout successful', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Logout failed:', {
      error: error.message,
      userId: req.auth?.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Logout failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', requireSupabaseAuth, async (req, res) => {
  try {
    const { token, user } = req.auth;
    
    logger.debug('User profile requested', {
      userId: user.id,
      ip: req.ip
    });
    
    const userProfile = await getUserProfile(token);
    
    if (!userProfile) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'User profile could not be retrieved'
      });
    }
    
    // Add token refresh info if available
    const responseData = {
      success: true,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.user_metadata?.full_name,
        avatar: userProfile.user_metadata?.avatar_url,
        created_at: userProfile.created_at,
        last_sign_in: userProfile.last_sign_in_at,
        profile: userProfile.profile
      },
      timestamp: new Date().toISOString()
    };
    
    // Include refreshed token info if available
    if (req.refreshedToken) {
      responseData.refreshedToken = {
        access_token: req.refreshedToken.accessToken,
        refresh_token: req.refreshedToken.refreshToken,
        expires_at: Math.floor(req.refreshedToken.expiresAt.getTime() / 1000),
        expires_in: Math.floor(req.refreshedToken.expiresIn / 1000)
      };
      responseData.message = 'Profile retrieved and token refreshed';
    }
    
    res.json(responseData);
    
  } catch (error) {
    logger.error('Get profile failed:', {
      error: error.message,
      userId: req.auth?.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Profile retrieval failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/status
 * Check authentication status (public endpoint)
 */
router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const apiKey = req.headers['x-api-key'];
    
    let authStatus = {
      authenticated: false,
      method: null,
      user: null,
      timestamp: new Date().toISOString()
    };
    
    // Check if user has valid Supabase token
    if (bearerToken && bearerToken !== 'development-key') {
      try {
        const { verifySupabaseToken } = require('../utils/supabase');
        const user = await verifySupabaseToken(bearerToken);
        
        if (user) {
          // Get token info
          const tokenInfo = parseJWTToken(bearerToken);
          
          authStatus = {
            authenticated: true,
            method: 'supabase_jwt',
            user: {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name
            },
            tokenInfo: {
              expiresAt: tokenInfo?.expiresAt?.toISOString() || null,
              expiresIn: tokenInfo?.expiresIn || null,
              needsRefresh: tokenInfo?.needsRefresh() || false,
              expired: tokenInfo?.isExpired() || false
            },
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        // Token invalid, continue with unauthenticated status
      }
    }
    // Check API key
    else if (apiKey || bearerToken === 'development-key') {
      const providedKey = apiKey || bearerToken;
      const validApiKey = process.env.GA4_API_KEY || 'development-key';
      
      if (providedKey === validApiKey) {
        authStatus = {
          authenticated: true,
          method: 'api_key',
          user: {
            id: 'api-key-user',
            email: 'developer@localhost',
            role: 'developer'
          },
          timestamp: new Date().toISOString()
        };
      }
    }
    
    res.json(authStatus);
    
  } catch (error) {
    logger.error('Auth status check failed:', error.message);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /auth/cache
 * Clear token validation cache (admin endpoint)
 * Phase 5.2.4: Cache Management
 */
router.delete('/cache', async (req, res) => {
  try {
    // This could be protected with admin auth in the future
    const statsBeforeClear = getCacheStats();
    clearTokenCache();
    
    logger.info('Token cache cleared via API', {
      ip: req.ip,
      previousCacheSize: statsBeforeClear.size
    });
    
    res.json({
      success: true,
      message: 'Token cache cleared',
      previousStats: statsBeforeClear,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Cache clear failed:', error.message);
    res.status(500).json({
      error: 'Cache clear failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/cache/stats
 * Get token cache statistics (admin endpoint)
 * Phase 5.2.4: Cache Management
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = getCacheStats();
    
    res.json({
      success: true,
      cacheStats: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Cache stats failed:', error.message);
    res.status(500).json({
      error: 'Cache stats failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;