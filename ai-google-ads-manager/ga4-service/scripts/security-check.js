#!/usr/bin/env node

/**
 * Security Validation Script
 * Phase 5.2.5: Production Security Checks
 * 
 * This script performs comprehensive security checks for the GA4 API service
 * before deployment to production.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const error = (message) => log(`🚨 CRITICAL: ${message}`, 'red');
const warning = (message) => log(`⚠️  WARNING: ${message}`, 'yellow');
const success = (message) => log(`✅ ${message}`, 'green');
const info = (message) => log(`ℹ️  ${message}`, 'blue');
const security = (message) => log(`🔒 ${message}`, 'magenta');

class SecurityChecker {
  constructor() {
    this.criticalIssues = [];
    this.warnings = [];
    this.passed = [];
  }

  addCritical(issue) {
    this.criticalIssues.push(issue);
    error(issue);
  }

  addWarning(warningMessage) {
    this.warnings.push(warningMessage);
    warning(warningMessage);
  }

  addPassed(check) {
    this.passed.push(check);
    success(check);
  }

  // Check for hardcoded secrets in code
  checkHardcodedSecrets() {
    security('Checking for hardcoded secrets...');
    
    const secretPatterns = [
      { name: 'API Keys', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{10,}['"]/, risk: 'HIGH' },
      { name: 'JWT Secrets', pattern: /(?:jwt[_-]?secret|jwtSecret)\s*[:=]\s*['"][^'"]{10,}['"]/, risk: 'HIGH' },
      { name: 'Database URLs', pattern: /(?:database[_-]?url|databaseUrl)\s*[:=]\s*['"]postgresql:\/\/[^'"]+['"]/, risk: 'HIGH' },
      { name: 'Private Keys', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, risk: 'CRITICAL' },
      { name: 'AWS Keys', pattern: /AKIA[0-9A-Z]{16}/, risk: 'HIGH' },
      { name: 'Generic Secrets', pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/, risk: 'MEDIUM' }
    ];

    const filesToCheck = [
      'server.js',
      'routes/',
      'middleware/',
      'utils/',
      'config/',
      'scripts/'
    ];

    let foundSecrets = false;

    for (const filePattern of filesToCheck) {
      this.scanDirectoryForSecrets(filePattern, secretPatterns, (file, pattern, match) => {
        foundSecrets = true;
        if (pattern.risk === 'CRITICAL') {
          this.addCritical(`${pattern.name} found in ${file}: ${pattern.risk} RISK`);
        } else {
          this.addWarning(`${pattern.name} potentially found in ${file}: ${pattern.risk} RISK`);
        }
      });
    }

    if (!foundSecrets) {
      this.addPassed('No hardcoded secrets detected in source code');
    }
  }

  scanDirectoryForSecrets(target, patterns, callback) {
    try {
      const fullPath = path.resolve(target);
      
      if (!fs.existsSync(fullPath)) {
        return;
      }

      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          if (file.startsWith('.') || file === 'node_modules') continue;
          this.scanDirectoryForSecrets(path.join(fullPath, file), patterns, callback);
        }
      } else if (stat.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.json'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        for (const pattern of patterns) {
          const matches = content.match(pattern.pattern);
          if (matches) {
            callback(target, pattern, matches[0]);
          }
        }
      }
    } catch (err) {
      // Ignore file access errors
    }
  }

  // Check file permissions and ownership
  checkFilePermissions() {
    security('Checking file permissions...');
    
    const sensitiveFiles = [
      'ga4-service-account.json',
      '.env',
      'scripts/deploy.sh'
    ];

    for (const file of sensitiveFiles) {
      if (fs.existsSync(file)) {
        try {
          const stats = fs.statSync(file);
          const mode = stats.mode;
          const permissions = (mode & parseInt('777', 8)).toString(8);
          
          // Check if file is readable by others
          if (permissions.endsWith('4') || permissions.endsWith('6') || permissions.endsWith('7')) {
            this.addWarning(`${file} is readable by others (permissions: ${permissions})`);
          } else {
            this.addPassed(`${file} has secure permissions (${permissions})`);
          }
        } catch (err) {
          this.addWarning(`Could not check permissions for ${file}`);
        }
      }
    }
  }

  // Check environment variable security
  checkEnvironmentSecurity() {
    security('Checking environment variable security...');
    
    const securityChecks = [
      {
        name: 'NODE_ENV in production',
        check: () => process.env.NODE_ENV === 'production',
        critical: true,
        message: 'NODE_ENV must be set to "production" for production deployment'
      },
      {
        name: 'Strong API key',
        check: () => {
          const apiKey = process.env.GA4_API_KEY;
          return apiKey && apiKey !== 'development-key' && apiKey.length >= 32;
        },
        critical: true,
        message: 'GA4_API_KEY must be a strong, unique key (32+ characters)'
      },
      {
        name: 'HTTPS URLs',
        check: () => {
          const serviceUrl = process.env.GA4_SERVICE_URL;
          const origins = process.env.ALLOWED_ORIGINS;
          
          if (process.env.NODE_ENV !== 'production') return true;
          
          const httpsCheck = (!serviceUrl || serviceUrl.startsWith('https://')) &&
                           (!origins || !origins.includes('http://'));
          return httpsCheck;
        },
        critical: true,
        message: 'All URLs must use HTTPS in production'
      },
      {
        name: 'No localhost in production',
        check: () => {
          if (process.env.NODE_ENV !== 'production') return true;
          
          const origins = process.env.ALLOWED_ORIGINS || '';
          return !origins.includes('localhost') && !origins.includes('127.0.0.1');
        },
        critical: false,
        message: 'ALLOWED_ORIGINS should not include localhost in production'
      },
      {
        name: 'Service account file security',
        check: () => {
          const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
          if (!credFile || !fs.existsSync(credFile)) return false;
          
          try {
            const content = JSON.parse(fs.readFileSync(credFile, 'utf8'));
            return content.type === 'service_account' && 
                   content.private_key && 
                   content.client_email;
          } catch {
            return false;
          }
        },
        critical: true,
        message: 'Google service account file must exist and be valid'
      }
    ];

    for (const check of securityChecks) {
      try {
        if (check.check()) {
          this.addPassed(check.name);
        } else {
          if (check.critical) {
            this.addCritical(check.message);
          } else {
            this.addWarning(check.message);
          }
        }
      } catch (err) {
        this.addWarning(`Failed to check ${check.name}: ${err.message}`);
      }
    }
  }

  // Check dependency security
  checkDependencySecurity() {
    security('Checking dependency security...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for known vulnerable packages (simplified check)
      const vulnerablePatterns = [
        'express-rate-limit@6.', // Example of version-specific vulnerability
        'helmet@6.',
        'cors@2.8.4' // Example of specific vulnerable version
      ];
      
      let vulnerableFound = false;
      
      for (const [pkg, version] of Object.entries(dependencies)) {
        const packageVersion = `${pkg}@${version}`;
        
        for (const pattern of vulnerablePatterns) {
          if (packageVersion.includes(pattern)) {
            this.addWarning(`Potentially vulnerable dependency: ${packageVersion}`);
            vulnerableFound = true;
          }
        }
      }
      
      if (!vulnerableFound) {
        this.addPassed('No known vulnerable dependency patterns detected');
      }
      
      // Check for package-lock.json
      if (fs.existsSync('package-lock.json')) {
        this.addPassed('package-lock.json exists (dependency integrity)');
      } else {
        this.addWarning('package-lock.json missing (dependency integrity risk)');
      }
      
    } catch (err) {
      this.addWarning('Could not analyze package.json for security issues');
    }
  }

  // Check server configuration security
  checkServerConfiguration() {
    security('Checking server configuration...');
    
    // Check if security middleware is properly configured
    const serverFile = 'server.js';
    if (fs.existsSync(serverFile)) {
      const content = fs.readFileSync(serverFile, 'utf8');
      
      const securityChecks = [
        { name: 'Helmet middleware', pattern: /helmet\(\)/, required: true },
        { name: 'CORS configuration', pattern: /cors\(\{/, required: true },
        { name: 'Rate limiting', pattern: /rateLimit\(/, required: true },
        { name: 'Authentication middleware', pattern: /authMiddleware/, required: true },
        { name: 'Error handling', pattern: /Error handling middleware/, required: true }
      ];
      
      for (const check of securityChecks) {
        if (content.match(check.pattern)) {
          this.addPassed(`${check.name} is configured`);
        } else if (check.required) {
          this.addCritical(`${check.name} is missing or not properly configured`);
        } else {
          this.addWarning(`${check.name} is not configured`);
        }
      }
    } else {
      this.addCritical('server.js file not found');
    }
  }

  // Check for common security misconfigurations
  checkMisconfigurations() {
    security('Checking for common misconfigurations...');
    
    // Check if .env file exists and warn about it
    if (fs.existsSync('.env')) {
      this.addWarning('.env file exists - ensure it\'s not committed to version control');
      
      // Check if .env is in .gitignore
      if (fs.existsSync('.gitignore')) {
        const gitignore = fs.readFileSync('.gitignore', 'utf8');
        if (gitignore.includes('.env')) {
          this.addPassed('.env is properly ignored by git');
        } else {
          this.addCritical('.env file exists but is NOT in .gitignore');
        }
      } else {
        this.addWarning('.gitignore file missing');
      }
    }
    
    // Check for debug/development configurations
    if (process.env.NODE_ENV === 'production') {
      const debugVars = ['DEBUG', 'VERBOSE', 'ENABLE_REQUEST_LOGGING'];
      for (const debugVar of debugVars) {
        if (process.env[debugVar] === 'true') {
          this.addWarning(`${debugVar} is enabled in production`);
        }
      }
    }
    
    // Check for proper logging configuration
    const logLevel = process.env.LOG_LEVEL || 'info';
    if (process.env.NODE_ENV === 'production' && ['debug', 'verbose'].includes(logLevel)) {
      this.addWarning('Log level is set to debug/verbose in production');
    } else {
      this.addPassed(`Log level is appropriate for environment (${logLevel})`);
    }
  }

  // Generate security entropy check
  generateSecurityMetrics() {
    security('Generating security metrics...');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      criticalIssues: this.criticalIssues.length,
      warnings: this.warnings.length,
      passedChecks: this.passed.length,
      securityScore: 0
    };
    
    // Calculate security score (0-100)
    const totalChecks = metrics.criticalIssues + metrics.warnings + metrics.passedChecks;
    if (totalChecks > 0) {
      metrics.securityScore = Math.round(
        ((metrics.passedChecks - (metrics.criticalIssues * 2)) / totalChecks) * 100
      );
      metrics.securityScore = Math.max(0, Math.min(100, metrics.securityScore));
    }
    
    return metrics;
  }

  // Run all security checks
  runAllChecks() {
    log('\n🔐 GA4 API Service - Security Validation', 'magenta');
    log('='.repeat(50), 'magenta');
    
    this.checkHardcodedSecrets();
    this.checkFilePermissions();
    this.checkEnvironmentSecurity();
    this.checkDependencySecurity();
    this.checkServerConfiguration();
    this.checkMisconfigurations();
    
    const metrics = this.generateSecurityMetrics();
    
    // Summary
    log('\n📊 Security Summary', 'blue');
    log('='.repeat(20), 'blue');
    
    info(`Environment: ${metrics.environment}`);
    info(`Security Score: ${metrics.securityScore}/100`);
    
    if (metrics.criticalIssues > 0) {
      error(`${metrics.criticalIssues} CRITICAL security issue(s) found`);
    }
    
    if (metrics.warnings > 0) {
      warning(`${metrics.warnings} security warning(s) found`);
    }
    
    success(`