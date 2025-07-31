#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Phase 5.2.5: Production Deployment Security
 * 
 * This script validates that all required environment variables are set
 * and properly configured for the GA4 API service.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const error = (message) => log(`❌ ERROR: ${message}`, 'red');
const success = (message) => log(`✅ ${message}`, 'green');
const warning = (message) => log(`⚠️  WARNING: ${message}`, 'yellow');
const info = (message) => log(`ℹ️  ${message}`, 'blue');

// Required environment variables for different environments
const REQUIRED_VARS = {
  critical: [
    'NODE_ENV',
    'PORT'
  ],
  production: [
    'GA4_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'ALLOWED_ORIGINS',
    'GA4_SERVICE_URL'
  ],
  optional: [
    'LOG_LEVEL',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'TOKEN_REFRESH_BUFFER_MS',
    'MAX_TOKEN_REFRESH_RETRIES',
    'TOKEN_CACHE_TTL_MS',
    'OAUTH_REDIRECT_URLS',
    'GOOGLE_OAUTH_SCOPES'
  ]
};

// Validation functions
const validators = {
  NODE_ENV: (value) => {
    const validEnvs = ['development', 'staging', 'production'];
    if (!validEnvs.includes(value)) {
      return `Must be one of: ${validEnvs.join(', ')}`;
    }
    return null;
  },
  
  PORT: (value) => {
    const port = parseInt(value, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return 'Must be a valid port number (1-65535)';
    }
    return null;
  },
  
  SUPABASE_URL: (value) => {
    try {
      const url = new URL(value);
      if (!url.hostname.includes('supabase.co')) {
        return 'Must be a valid Supabase URL';
      }
    } catch (err) {
      return 'Must be a valid URL';
    }
    return null;
  },
  
  GA4_SERVICE_URL: (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
        return 'Must use HTTPS in production';
      }
    } catch (err) {
      return 'Must be a valid URL';
    }
    return null;
  },
  
  ALLOWED_ORIGINS: (value) => {
    const origins = value.split(',');
    for (const origin of origins) {
      try {
        new URL(origin.trim());
      } catch (err) {
        return `Invalid origin: ${origin}`;
      }
    }
    return null;
  },
  
  GOOGLE_APPLICATION_CREDENTIALS: (value) => {
    if (!fs.existsSync(value)) {
      return 'Service account file does not exist';
    }
    
    try {
      const content = fs.readFileSync(value, 'utf8');
      const serviceAccount = JSON.parse(content);
      
      if (!serviceAccount.type || serviceAccount.type !== 'service_account') {
        return 'File is not a valid service account JSON';
      }
      
      if (!serviceAccount.private_key || !serviceAccount.client_email) {
        return 'Service account file is missing required fields';
      }
      
    } catch (err) {
      return 'Service account file is not valid JSON';
    }
    
    return null;
  }
};

// Security checks
function performSecurityChecks() {
  info('Performing security checks...');
  
  const issues = [];
  
  // Check for default/weak values
  const weakValues = {
    GA4_API_KEY: ['development-key', 'test-key', 'api-key', 'password', '123456'],
    SUPABASE_ANON_KEY: ['your-supabase-anon-key', 'anon-key']
  };
  
  for (const [envVar, weakDefaults] of Object.entries(weakValues)) {
    const value = process.env[envVar];
    if (value && weakDefaults.some(weak => value.includes(weak))) {
      issues.push(`${envVar} appears to use a default/weak value`);
    }
  }
  
  // Check for production-specific requirements
  if (process.env.NODE_ENV === 'production') {
    if (process.env.GA4_SERVICE_URL && !process.env.GA4_SERVICE_URL.startsWith('https://')) {
      issues.push('GA4_SERVICE_URL must use HTTPS in production');
    }
    
    if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.includes('localhost')) {
      issues.push('ALLOWED_ORIGINS should not include localhost in production');
    }
  }
  
  return issues;
}

function checkEnvironmentFile() {
  const envFile = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envFile)) {
    warning('Found .env file - ensure it\'s not committed to version control');
    
    // Check if .env is in .gitignore
    const gitignoreFile = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignoreFile)) {
      const gitignoreContent = fs.readFileSync(gitignoreFile, 'utf8');
      if (!gitignoreContent.includes('.env')) {
        error('.env file exists but is not in .gitignore');
      }
    }
  }
}

function validateEnvironment() {
  log('\n🔍 GA4 API Service - Environment Validation', 'blue');
  log('='.repeat(50), 'blue');
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  info(`Environment: ${nodeEnv}`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // Check critical variables
  info('\nValidating critical environment variables...');
  for (const varName of REQUIRED_VARS.critical) {
    const value = process.env[varName];
    
    if (!value) {
      error(`${varName} is not set`);
      totalErrors++;
      continue;
    }
    
    // Run validator if exists
    if (validators[varName]) {
      const validationError = validators[varName](value);
      if (validationError) {
        error(`${varName}: ${validationError}`);
        totalErrors++;
        continue;
      }
    }
    
    success(`${varName} is set`);
  }
  
  // Check production-specific variables
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    info('\nValidating production environment variables...');
    for (const varName of REQUIRED_VARS.production) {
      const value = process.env[varName];
      
      if (!value) {
        error(`${varName} is not set (required for ${nodeEnv})`);
        totalErrors++;
        continue;
      }
      
      // Run validator if exists
      if (validators[varName]) {
        const validationError = validators[varName](value);
        if (validationError) {
          error(`${varName}: ${validationError}`);
          totalErrors++;
          continue;
        }
      }
      
      success(`${varName} is set`);
    }
  }
  
  // Check optional variables
  info('\nChecking optional environment variables...');
  for (const varName of REQUIRED_VARS.optional) {
    const value = process.env[varName];
    
    if (!value) {
      warning(`${varName} is not set (using default)`);
      totalWarnings++;
    } else {
      success(`${varName} is set`);
    }
  }
  
  // Perform security checks
  const securityIssues = performSecurityChecks();
  if (securityIssues.length > 0) {
    info('\nSecurity issues found:');
    securityIssues.forEach(issue => warning(issue));
    totalWarnings += securityIssues.length;
  }
  
  // Check for .env file
  checkEnvironmentFile();
  
  // Summary
  log('\n📊 Validation Summary', 'blue');
  log('='.repeat(20), 'blue');
  
  if (totalErrors === 0) {
    success(`Environment validation passed`);
    if (totalWarnings > 0) {
      warning(`${totalWarnings} warning(s) found`);
    }
  } else {
    error(`${totalErrors} error(s) found`);
    if (totalWarnings > 0) {
      warning(`${totalWarnings} warning(s) found`);
    }
  }
  
  // Environment-specific recommendations
  if (nodeEnv === 'production') {
    info('\n🔐 Production Deployment Checklist:');
    console.log('  ✅ Set all required environment variables in Railway');
    console.log('  ✅ Use strong, unique API keys');
    console.log('  ✅ Enable HTTPS for all URLs');
    console.log('  ✅ Configure CORS for production domains only');
    console.log('  ✅ Upload service account JSON securely');
    console.log('  ✅ Enable monitoring and alerting');
  }
  
  process.exit(totalErrors > 0 ? 1 : 0);
}

// Run validation
if (require.main === module) {
  validateEnvironment();
}

module.exports = {
  validateEnvironment,
  REQUIRED_VARS,
  validators
};