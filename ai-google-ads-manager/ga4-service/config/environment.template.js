/**
 * Environment Variables Template for GA4 API Service
 * This file provides a comprehensive template for all configurable environment variables
 * Phase 5.4.2: Updated with Redis configuration and Railway integration
 */

module.exports = {
  // === Core Application Configuration ===
  NODE_ENV: process.env.NODE_ENV || 'development', // development, staging, production
  PORT: process.env.PORT || 3001,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info', // error, warn, info, debug

  // === Google Analytics 4 Configuration ===
  GA4_API_KEY: process.env.GA4_API_KEY, // Required: Your GA4 API key for development
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './ga4-service-account.json',

  // === Supabase Configuration ===
  SUPABASE_URL: process.env.SUPABASE_URL, // Required: Your Supabase project URL
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY, // Required: Your Supabase anonymous key

  // === Redis Configuration ===
  // Redis connection settings
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD, // Optional: Redis password
  REDIS_USERNAME: process.env.REDIS_USERNAME, // Optional: Redis username (Redis 6+)
  REDIS_DATABASE: parseInt(process.env.REDIS_DATABASE) || 0,

  // Redis connection timeouts and retries
  REDIS_CONNECT_TIMEOUT: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000, // 10 seconds
  REDIS_COMMAND_TIMEOUT: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,  // 5 seconds
  REDIS_RETRY_DELAY: parseInt(process.env.REDIS_RETRY_DELAY) || 1000,          // 1 second

  // === Railway Platform Configuration ===
  GA4_SERVICE_URL: process.env.GA4_SERVICE_URL || `http://localhost:${process.env.PORT || 3001}`,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'development',
  RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
  RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,

  // === Security Configuration ===
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  
  // Content Security Policy
  CSP_DEFAULT_SRC: process.env.CSP_DEFAULT_SRC || "'self'",
  CSP_SCRIPT_SRC: process.env.CSP_SCRIPT_SRC || "'self' 'unsafe-inline'",
  CSP_STYLE_SRC: process.env.CSP_STYLE_SRC || "'self' 'unsafe-inline'",

  // === Rate Limiting Configuration ===
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,      // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,   // Max requests per window

  // === OAuth 2.0 Configuration ===
  OAUTH_REDIRECT_URLS: process.env.OAUTH_REDIRECT_URLS || 'http://localhost:3000/auth/callback',
  GOOGLE_OAUTH_SCOPES: process.env.GOOGLE_OAUTH_SCOPES || 'openid profile email',

  // === Token Management Configuration ===
  TOKEN_REFRESH_BUFFER_MS: parseInt(process.env.TOKEN_REFRESH_BUFFER_MS) || 300000,    // 5 minutes
  MAX_TOKEN_REFRESH_RETRIES: parseInt(process.env.MAX_TOKEN_REFRESH_RETRIES) || 3,
  TOKEN_CACHE_TTL_MS: parseInt(process.env.TOKEN_CACHE_TTL_MS) || 3300000,             // 55 minutes

  // === Feature Flags ===
  ENABLE_CORS_ALL_ORIGINS: process.env.ENABLE_CORS_ALL_ORIGINS === 'true',
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING === 'true',
  SKIP_AUTH_FOR_HEALTH: process.env.SKIP_AUTH_FOR_HEALTH === 'true',

  // === Cache Configuration (TTL in seconds) ===
  CACHE_TTL_SESSIONS: parseInt(process.env.CACHE_TTL_SESSIONS) || 3600,      // 1 hour
  CACHE_TTL_USERS: parseInt(process.env.CACHE_TTL_USERS) || 3600,            // 1 hour
  CACHE_TTL_TRAFFIC: parseInt(process.env.CACHE_TTL_TRAFFIC) || 1800,        // 30 minutes
  CACHE_TTL_PAGES: parseInt(process.env.CACHE_TTL_PAGES) || 1800,            // 30 minutes
  CACHE_TTL_CONVERSIONS: parseInt(process.env.CACHE_TTL_CONVERSIONS) || 7200, // 2 hours
  CACHE_TTL_SUMMARY: parseInt(process.env.CACHE_TTL_SUMMARY) || 900,         // 15 minutes
  CACHE_TTL_HEALTH: parseInt(process.env.CACHE_TTL_HEALTH) || 300,           // 5 minutes
};

// === Environment Validation ===
const requiredVars = [
  'GA4_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('📝 Please check your .env file or environment configuration');
  process.exit(1);
}

// === Security Checklist ===
/**
 * Security Configuration Checklist:
 * 
 * ✅ Required for Production:
 * - GA4_API_KEY: Secure API key for Google Analytics 4
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anonymous key (public)
 * - REDIS_PASSWORD: Redis authentication (if Redis auth enabled)
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins
 * 
 * ⚠️ Security Notes:
 * - Never commit .env files to version control
 * - Use strong, unique passwords for Redis
 * - Rotate API keys regularly
 * - Use HTTPS in production (enforced by Railway)
 * - Keep Supabase keys secure and monitor usage
 * 
 * 🏗️ Railway Configuration:
 * - Set environment variables in Railway dashboard
 * - Use Railway secrets for sensitive values
 * - Configure Redis plugin in Railway
 * - Monitor resource usage and scaling
 * 
 * 📊 Redis Configuration Notes:
 * - Railway Redis is automatically configured when plugin is added
 * - Connection details are provided via environment variables
 * - Redis is optional - service works without it (offline mode)
 * - Monitor Redis memory usage and key expiration
 * 
 * 🔄 Cache Strategy:
 * - Sessions/Users: 1 hour TTL (frequent access)
 * - Traffic/Pages: 30 minutes TTL (moderate access)
 * - Conversions: 2 hours TTL (less frequent, more stable)
 * - Summary data: 15 minutes TTL (quick overview)
 * - Health checks: 5 minutes TTL (status monitoring)
 */

module.exports.validate = () => {
  const config = module.exports;
  const warnings = [];
  const errors = [];

  // Validate Redis configuration
  if (config.REDIS_HOST === 'localhost' && config.NODE_ENV === 'production') {
    warnings.push('Redis host is localhost in production environment');
  }

  // Validate security settings
  if (config.ENABLE_CORS_ALL_ORIGINS && config.NODE_ENV === 'production') {
    warnings.push('CORS allows all origins in production - security risk');
  }

  // Validate Railway configuration
  if (config.NODE_ENV === 'production' && !config.RAILWAY_PROJECT_ID) {
    warnings.push('RAILWAY_PROJECT_ID not set in production environment');
  }

  // Validate cache TTL settings
  if (config.CACHE_TTL_SESSIONS > 86400) { // 24 hours
    warnings.push('Session cache TTL is very high (>24 hours) - consider reducing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};