/**
 * CORS and Security Headers Configuration for GA4 Analytics MCP Server
 * 
 * Provides comprehensive CORS configuration and security headers
 * for HTTP endpoints and health checks in the MCP server.
 */

import { logger as productionLogger } from './productionLogger.js';

export interface CORSConfig {
  // Origins configuration
  allowedOrigins: string[] | string | boolean;
  allowCredentials: boolean;
  
  // Methods and headers
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  
  // Preflight configuration
  preflightMaxAge: number;
  optionsSuccessStatus: number;
  
  // Security options
  secureContext: boolean;
  sameSitePolicy: 'strict' | 'lax' | 'none';
}

export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
    reportOnly: boolean;
  };
  
  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  
  // X-Frame-Options
  frameOptions: 'DENY' | 'SAMEORIGIN' | string;
  
  // X-Content-Type-Options
  noSniff: boolean;
  
  // X-XSS-Protection
  xssProtection: {
    enabled: boolean;
    mode: 'block' | 'report';
    reportUri?: string;
  };
  
  // Referrer Policy
  referrerPolicy: string;
  
  // Feature Policy / Permissions Policy
  permissionsPolicy: Record<string, string[]>;
  
  // Additional custom headers
  customHeaders: Record<string, string>;
}

export interface SecurityMetrics {
  corsRequests: {
    total: number;
    allowed: number;
    blocked: number;
    preflightRequests: number;
  };
  securityHeaders: {
    applied: number;
    errors: number;
  };
  violations: {
    csp: number;
    xss: number;
    frameOptions: number;
  };
}

export class CORSSecurityManager {
  private corsConfig: CORSConfig;
  private securityConfig: SecurityHeadersConfig;
  private metrics: SecurityMetrics;
  private blockedOrigins: Set<string> = new Set();
  private allowedOriginsRegex: RegExp[] = [];

  constructor(
    corsConfig?: Partial<CORSConfig>,
    securityConfig?: Partial<SecurityHeadersConfig>
  ) {
    this.corsConfig = {
      allowedOrigins: this.parseAllowedOrigins(process.env.CORS_ORIGIN || '*'),
      allowCredentials: process.env.CORS_CREDENTIALS === 'true',
      allowedMethods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS,HEAD').split(','),
      allowedHeaders: (process.env.CORS_HEADERS || 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Cache-Control,X-File-Name').split(','),
      exposedHeaders: (process.env.CORS_EXPOSED_HEADERS || 'Content-Length,Content-Range,X-Content-Range').split(','),
      preflightMaxAge: parseInt(process.env.CORS_MAX_AGE || '86400'), // 24 hours
      optionsSuccessStatus: 204,
      secureContext: process.env.NODE_ENV === 'production',
      sameSitePolicy: (process.env.SAME_SITE_POLICY as any) || 'strict',
      ...corsConfig
    };

    this.securityConfig = {
      contentSecurityPolicy: {
        enabled: process.env.ENABLE_CSP !== 'false',
        reportOnly: process.env.CSP_REPORT_ONLY === 'true',
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"]
        }
      },
      hsts: {
        enabled: process.env.ENABLE_HSTS !== 'false',
        maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'), // 1 year
        includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
        preload: process.env.HSTS_PRELOAD === 'true'
      },
      frameOptions: (process.env.X_FRAME_OPTIONS as any) || 'DENY',
      noSniff: process.env.X_CONTENT_TYPE_OPTIONS !== 'false',
      xssProtection: {
        enabled: process.env.X_XSS_PROTECTION !== 'false',
        mode: (process.env.XSS_PROTECTION_MODE as any) || 'block',
        reportUri: process.env.XSS_REPORT_URI
      },
      referrerPolicy: process.env.REFERRER_POLICY || 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        'geolocation': ['none'],
        'microphone': ['none'],
        'camera': ['none'],
        'payment': ['none'],
        'usb': ['none'],
        'magnetometer': ['none'],
        'gyroscope': ['none'],
        'accelerometer': ['none']
      },
      customHeaders: {},
      ...securityConfig
    };

    this.metrics = {
      corsRequests: {
        total: 0,
        allowed: 0,
        blocked: 0,
        preflightRequests: 0
      },
      securityHeaders: {
        applied: 0,
        errors: 0
      },
      violations: {
        csp: 0,
        xss: 0,
        frameOptions: 0
      }
    };

    this.initializeOriginRegex();

    productionLogger.info('CORS and Security Headers manager initialized', {
      component: 'SECURITY',
      corsEnabled: true,
      allowedOrigins: this.corsConfig.allowedOrigins,
      securityHeaders: {
        csp: this.securityConfig.contentSecurityPolicy.enabled,
        hsts: this.securityConfig.hsts.enabled,
        frameOptions: this.securityConfig.frameOptions,
        xssProtection: this.securityConfig.xssProtection.enabled
      }
    });
  }

  /**
   * Parse allowed origins from environment variable
   */
  private parseAllowedOrigins(origins: string): string[] | string | boolean {
    if (origins === '*') return '*';
    if (origins === 'false') return false;
    if (origins === 'true') return true;
    return origins.split(',').map(origin => origin.trim());
  }

  /**
   * Initialize regex patterns for origin matching
   */
  private initializeOriginRegex(): void {
    if (Array.isArray(this.corsConfig.allowedOrigins)) {
      this.allowedOriginsRegex = this.corsConfig.allowedOrigins
        .filter(origin => origin.includes('*'))
        .map(pattern => new RegExp(pattern.replace(/\*/g, '.*')));
    }
  }

  /**
   * Check if an origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (!origin) return false;
    
    // Check if origin is blocked
    if (this.blockedOrigins.has(origin)) {
      return false;
    }

    // Allow all origins
    if (this.corsConfig.allowedOrigins === '*' || this.corsConfig.allowedOrigins === true) {
      return true;
    }

    // No origins allowed
    if (this.corsConfig.allowedOrigins === false) {
      return false;
    }

    // Check exact matches
    if (Array.isArray(this.corsConfig.allowedOrigins)) {
      if (this.corsConfig.allowedOrigins.includes(origin)) {
        return true;
      }

      // Check regex patterns
      return this.allowedOriginsRegex.some(regex => regex.test(origin));
    }

    return false;
  }

  /**
   * Apply CORS headers to response
   */
  applyCORSHeaders(req: any, res: any, origin?: string): boolean {
    this.metrics.corsRequests.total++;

    const requestOrigin = origin || req.headers?.origin;
    const method = req.method?.toUpperCase();

    // Handle preflight requests
    if (method === 'OPTIONS') {
      this.metrics.corsRequests.preflightRequests++;
      return this.handlePreflightRequest(req, res, requestOrigin);
    }

    // Handle simple requests
    return this.handleSimpleRequest(req, res, requestOrigin);
  }

  /**
   * Handle preflight CORS request
   */
  private handlePreflightRequest(req: any, res: any, origin?: string): boolean {
    if (!origin || !this.isOriginAllowed(origin)) {
      this.metrics.corsRequests.blocked++;
      productionLogger.warn('CORS preflight request blocked', {
        component: 'SECURITY',
        origin,
        reason: 'origin_not_allowed'
      });
      return false;
    }

    const requestMethod = req.headers['access-control-request-method'];
    const requestHeaders = req.headers['access-control-request-headers'];

    // Check if method is allowed
    if (requestMethod && !this.corsConfig.allowedMethods.includes(requestMethod)) {
      this.metrics.corsRequests.blocked++;
      productionLogger.warn('CORS preflight request blocked', {
        component: 'SECURITY',
        origin,
        method: requestMethod,
        reason: 'method_not_allowed'
      });
      return false;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', this.corsConfig.allowedMethods.join(','));
    res.setHeader('Access-Control-Allow-Headers', this.corsConfig.allowedHeaders.join(','));
    res.setHeader('Access-Control-Max-Age', this.corsConfig.preflightMaxAge.toString());

    if (this.corsConfig.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(this.corsConfig.optionsSuccessStatus);
    this.metrics.corsRequests.allowed++;

    productionLogger.debug('CORS preflight request allowed', {
      component: 'SECURITY',
      origin,
      method: requestMethod,
      headers: requestHeaders
    });

    return true;
  }

  /**
   * Handle simple CORS request
   */
  private handleSimpleRequest(req: any, res: any, origin?: string): boolean {
    if (!origin || !this.isOriginAllowed(origin)) {
      this.metrics.corsRequests.blocked++;
      return false;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    if (this.corsConfig.exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', this.corsConfig.exposedHeaders.join(','));
    }

    if (this.corsConfig.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    this.metrics.corsRequests.allowed++;
    return true;
  }

  /**
   * Apply security headers to response
   */
  applySecurityHeaders(res: any): void {
    try {
      // Content Security Policy
      if (this.securityConfig.contentSecurityPolicy.enabled) {
        const cspHeader = this.buildCSPHeader();
        const headerName = this.securityConfig.contentSecurityPolicy.reportOnly ? 
          'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
        res.setHeader(headerName, cspHeader);
      }

      // HTTP Strict Transport Security
      if (this.securityConfig.hsts.enabled && this.corsConfig.secureContext) {
        const hstsValue = this.buildHSTSHeader();
        res.setHeader('Strict-Transport-Security', hstsValue);
      }

      // X-Frame-Options
      res.setHeader('X-Frame-Options', this.securityConfig.frameOptions);

      // X-Content-Type-Options
      if (this.securityConfig.noSniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // X-XSS-Protection
      if (this.securityConfig.xssProtection.enabled) {
        const xssValue = this.buildXSSProtectionHeader();
        res.setHeader('X-XSS-Protection', xssValue);
      }

      // Referrer Policy
      res.setHeader('Referrer-Policy', this.securityConfig.referrerPolicy);

      // Permissions Policy
      const permissionsPolicy = this.buildPermissionsPolicyHeader();
      if (permissionsPolicy) {
        res.setHeader('Permissions-Policy', permissionsPolicy);
      }

      // Custom headers
      Object.entries(this.securityConfig.customHeaders).forEach(([name, value]) => {
        res.setHeader(name, value);
      });

      // Remove potentially dangerous headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      this.metrics.securityHeaders.applied++;

    } catch (error) {
      this.metrics.securityHeaders.errors++;
      productionLogger.error('Error applying security headers', {
        component: 'SECURITY',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Build Content Security Policy header
   */
  private buildCSPHeader(): string {
    return Object.entries(this.securityConfig.contentSecurityPolicy.directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * Build HSTS header
   */
  private buildHSTSHeader(): string {
    let hsts = `max-age=${this.securityConfig.hsts.maxAge}`;
    
    if (this.securityConfig.hsts.includeSubDomains) {
      hsts += '; includeSubDomains';
    }
    
    if (this.securityConfig.hsts.preload) {
      hsts += '; preload';
    }
    
    return hsts;
  }

  /**
   * Build XSS Protection header
   */
  private buildXSSProtectionHeader(): string {
    if (this.securityConfig.xssProtection.mode === 'block') {
      return '1; mode=block';
    } else if (this.securityConfig.xssProtection.reportUri) {
      return `1; report=${this.securityConfig.xssProtection.reportUri}`;
    }
    return '1';
  }

  /**
   * Build Permissions Policy header
   */
  private buildPermissionsPolicyHeader(): string {
    return Object.entries(this.securityConfig.permissionsPolicy)
      .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
      .join(', ');
  }

  /**
   * Block an origin temporarily
   */
  blockOrigin(origin: string, duration: number = 3600000): void { // 1 hour default
    this.blockedOrigins.add(origin);
    
    setTimeout(() => {
      this.blockedOrigins.delete(origin);
      productionLogger.info('Origin unblocked', {
        component: 'SECURITY',
        origin,
        reason: 'timeout_expired'
      });
    }, duration);

    productionLogger.warn('Origin blocked', {
      component: 'SECURITY',
      origin,
      duration,
      reason: 'security_violation'
    });
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get security status for health checks
   */
  getSecurityStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  } {
    const metrics = this.getSecurityMetrics();
    const corsBlockRate = metrics.corsRequests.total > 0 ? 
      (metrics.corsRequests.blocked / metrics.corsRequests.total) * 100 : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (corsBlockRate > 50 || metrics.violations.csp > 10) {
      status = 'critical';
    } else if (corsBlockRate > 20 || metrics.violations.csp > 5) {
      status = 'warning';
    }

    return {
      status,
      details: {
        corsBlockRate: Math.round(corsBlockRate * 100) / 100,
        totalCorsRequests: metrics.corsRequests.total,
        blockedOrigins: this.blockedOrigins.size,
        securityHeadersApplied: metrics.securityHeaders.applied,
        violations: metrics.violations
      }
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      corsRequests: {
        total: 0,
        allowed: 0,
        blocked: 0,
        preflightRequests: 0
      },
      securityHeaders: {
        applied: 0,
        errors: 0
      },
      violations: {
        csp: 0,
        xss: 0,
        frameOptions: 0
      }
    };
  }
}

// Global CORS and security instance
let globalCORSManager: CORSSecurityManager | null = null;

/**
 * Initialize global CORS and security manager
 */
export function initializeCORSSecurity(
  corsConfig?: Partial<CORSConfig>,
  securityConfig?: Partial<SecurityHeadersConfig>
): CORSSecurityManager {
  globalCORSManager = new CORSSecurityManager(corsConfig, securityConfig);
  return globalCORSManager;
}

/**
 * Get global CORS manager instance
 */
export function getCORSManager(): CORSSecurityManager | null {
  return globalCORSManager;
}

/**
 * Middleware function for Express-like applications
 */
export function corsSecurityMiddleware(req: any, res: any, next?: Function): void {
  if (!globalCORSManager) {
    if (next) next();
    return;
  }

  // Apply CORS headers
  globalCORSManager.applyCORSHeaders(req, res);

  // Apply security headers
  globalCORSManager.applySecurityHeaders(res);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  if (next) next();
}