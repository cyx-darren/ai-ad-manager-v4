const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://fjfwnjrmafoieiciuomm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnduanJtYWZvaWVpY2l1b21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1Nzk2MTIsImV4cCI6MjA2OTE1NTYxMn0.J7DAGU0LV2m_RvG07td6fnSxT_-Xn3Lsoslqp9EmIA8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    // Persist session in memory (for server-side)
    persistSession: false,
    // Detect session in URL for OAuth callbacks
    detectSessionInUrl: true
  }
});

/**
 * Verify a Supabase JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Promise<Object|null>} User object if valid, null if invalid
 */
async function verifySupabaseToken(token) {
  try {
    // Set the session with the provided token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.warn('Supabase token verification failed:', error.message);
      return null;
    }
    
    if (!user) {
      logger.warn('No user found for provided token');
      return null;
    }
    
    logger.debug('Supabase token verified successfully', { 
      userId: user.id, 
      email: user.email 
    });
    
    return user;
  } catch (error) {
    logger.error('Supabase token verification error:', error.message);
    return null;
  }
}

/**
 * Get OAuth URL for Google sign-in
 * @param {string} redirectTo - The URL to redirect to after authentication
 * @returns {Promise<Object>} OAuth URL and state
 */
async function getGoogleOAuthUrl(redirectTo = null) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${process.env.GA4_SERVICE_URL || 'http://localhost:3001'}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/analytics.readonly'
      }
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error('Failed to get Google OAuth URL:', error.message);
    throw error;
  }
}

/**
 * Handle OAuth callback and exchange code for session
 * @param {string} code - OAuth authorization code
 * @param {string} state - OAuth state parameter
 * @returns {Promise<Object>} Session data
 */
async function handleOAuthCallback(code, state) {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      throw error;
    }
    
    logger.info('OAuth callback handled successfully', {
      userId: data.user?.id,
      email: data.user?.email
    });
    
    return data;
  } catch (error) {
    logger.error('OAuth callback handling failed:', error.message);
    throw error;
  }
}

/**
 * Sign out user
 * @param {string} token - JWT token
 * @returns {Promise<void>}
 */
async function signOut(token) {
  try {
    // Set the session first
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // We don't store refresh tokens in this service
    });
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    logger.info('User signed out successfully');
  } catch (error) {
    logger.error('Sign out failed:', error.message);
    throw error;
  }
}

/**
 * Get user profile from Supabase
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} User profile
 */
async function getUserProfile(token) {
  try {
    const user = await verifySupabaseToken(token);
    
    if (!user) {
      return null;
    }
    
    // Get additional user metadata if needed
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
      logger.warn('Failed to get user profile:', error.message);
    }
    
    return {
      ...user,
      profile: profile || null
    };
  } catch (error) {
    logger.error('Get user profile failed:', error.message);
    return null;
  }
}

module.exports = {
  supabase,
  verifySupabaseToken,
  getGoogleOAuthUrl,
  handleOAuthCallback,
  signOut,
  getUserProfile
};