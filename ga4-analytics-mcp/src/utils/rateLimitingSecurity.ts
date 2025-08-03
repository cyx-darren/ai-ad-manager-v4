/**
 * Rate Limiting and DDoS Protection for GA4 Analytics MCP Server
 * 
 * Provides comprehensive rate limiting, DDoS protection, and security middleware
 * for protecting the GA4 MCP server from abuse and ensuring fair resource usage.
 */

import { logger as productionLogger } from './productionLogger.js';
import { errorTracker, ErrorSeverity, ErrorType } from './errorTracking.js';
import { performanceMonitor } from './performanceMetrics.js';

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Max requests per window
  maxRequestsPerIP: number;   // Max requests per IP per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableWhitelist?: boolean;
  whitelist?: string[];
  enableBlacklist?: boolean;
  blacklist?: string[];
  banDuration?: number;       // Duration to ban IPs (in ms)
  ddosThreshold?: number;     // Requests per minute to trigger DDoS protection
}

export interface DDoSConfig {
  enabled: boolean;
  maxRequestsPerMinute: number;
  banDurationMs: number;
  alertThreshold: number;
  enableAutoBlock: boolean;
  enableResponseDelay: boolean;
  responseDelayMs: number;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  rateLimit: {
    violations: number;
    currentlyBlocked: number;
    averageRequestsPerMinute: number;
  };
  ddos: {
    suspiciousActivity: number;
    blockedAttacks: number;
    currentThreatLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  performance: {
    averageResponseTime: number;
    requestsInQueue: number;
  };
}

interface ClientInfo {
  requestCount: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  blockedUntil?: number;
  suspiciousActivity: boolean;
  fingerprint?: string;
}

export class RateLimitingSecurity {
  private clients: Map<string, ClientInfo> = new Map();
  private requestTimes: number[] = [];
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: Map<string, number> = new Map();
  private config: RateLimitConfig;
  private ddosConfig: DDoSConfig;
  private metrics: SecurityMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private ddosMonitorInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RateLimitConfig>, ddosConfig?: Partial<DDoSConfig>) {
    this.config = {
      windowMs: 15 * 60 * 1000,    // 15 minutes
      maxRequests: 1000,            // 1000 requests per window
      maxRequestsPerIP: 100,        // 100 requests per IP per window
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableWhitelist: true,
      whitelist: ['127.0.0.1', '::1', 'localhost'],
      enableBlacklist: true,
      blacklist: [],
      banDuration: 60 * 60 * 1000,  // 1 hour ban
      ddosThreshold: 300,           // 300 requests per minute triggers DDoS protection
      ...config
    };

    this.ddosConfig = {
      enabled: true,
      maxRequestsPerMinute: 200,
      banDurationMs: 30 * 60 * 1000, // 30 minutes
      alertThreshold: 500,
      enableAutoBlock: true,
      enableResponseDelay: true,
      responseDelayMs: 1000,
      ...ddosConfig
    };

    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimit: {
        violations: 0,
        currentlyBlocked: 0,
        averageRequestsPerMinute: 0
      },
      ddos: {
        suspiciousActivity: 0,
        blockedAttacks: 0,
        currentThreatLevel: 'low'
      },
      performance: {
        averageResponseTime: 0,
        requestsInQueue: 0
      }
    };

    this.startCleanupTimer();
    this.startDDoSMonitoring();

    productionLogger.info('Rate limiting and DDoS protection initialized', {
      component: 'SECURITY',
      config: {
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests,
        maxRequestsPerIP: this.config.maxRequestsPerIP,
        ddosEnabled: this.ddosConfig.enabled,
        ddosThreshold: this.ddosConfig.maxRequestsPerMinute
      }
    });
  }

  /**
   * Check if a request should be allowed
   */
  checkRateLimit(clientId: string, userAgent?: string): { 
    allowed: boolean; 
    reason?: string; 
    retryAfter?: number;
    remainingRequests?: number;
  } {
    const now = Date.now();
    this.metrics.totalRequests++;

    // Check blacklist
    if (this.config.enableBlacklist && this.config.blacklist?.includes(clientId)) {
      this.metrics.blockedRequests++;
      productionLogger.warn('Request blocked - IP in blacklist', {
        component: 'SECURITY',
        clientId,
        reason: 'blacklisted'
      });
      return { allowed: false, reason: 'IP blacklisted' };
    }

    // Check whitelist
    if (this.config.enableWhitelist && this.config.whitelist?.includes(clientId)) {
      return { allowed: true, remainingRequests: this.config.maxRequestsPerIP };
    }

    // Check if IP is currently banned
    if (this.isBlocked(clientId)) {
      const client = this.clients.get(clientId);
      const retryAfter = client?.blockedUntil ? Math.ceil((client.blockedUntil - now) / 1000) : 0;
      this.metrics.blockedRequests++;
      return { 
        allowed: false, 
        reason: 'IP temporarily banned', 
        retryAfter 
      };
    }

    // Get or create client info
    let client = this.clients.get(clientId);
    if (!client) {
      client = {
        requestCount: 0,
        firstRequest: now,
        lastRequest: now,
        blocked: false,
        suspiciousActivity: false,
        fingerprint: this.generateFingerprint(userAgent)
      };
      this.clients.set(clientId, client);
    }

    // Check window reset
    if (now - client.firstRequest > this.config.windowMs) {
      client.requestCount = 0;
      client.firstRequest = now;
    }

    client.requestCount++;
    client.lastRequest = now;

    // Check rate limit per IP
    if (client.requestCount > this.config.maxRequestsPerIP) {
      this.handleRateLimitViolation(clientId, client);
      const retryAfter = Math.ceil(this.config.windowMs / 1000);
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded', 
        retryAfter 
      };
    }

    // Check for suspicious patterns
    this.detectSuspiciousActivity(clientId, client, userAgent);

    // Check DDoS protection
    if (this.ddosConfig.enabled && this.isDDoSAttack()) {
      this.handleDDoSAttack(clientId);
      return { 
        allowed: false, 
        reason: 'DDoS protection activated',
        retryAfter: Math.ceil(this.ddosConfig.banDurationMs / 1000)
      };
    }

    const remainingRequests = Math.max(0, this.config.maxRequestsPerIP - client.requestCount);
    return { allowed: true, remainingRequests };
  }

  /**
   * Handle rate limit violations
   */
  private handleRateLimitViolation(clientId: string, client: ClientInfo): void {
    this.metrics.rateLimit.violations++;
    this.metrics.blockedRequests++;

    // Temporary ban for repeated violations
    if (client.requestCount > this.config.maxRequestsPerIP * 2) {
      this.blockIP(clientId, this.config.banDuration || 60 * 60 * 1000);
      
      errorTracker.trackError(new Error('Rate limit violation - IP banned'), {
        type: ErrorType.RATE_LIMIT_ERROR,
        severity: ErrorSeverity.MEDIUM,
        component: 'SECURITY',
        additionalContext: {
          clientId,
          requestCount: client.requestCount,
          maxAllowed: this.config.maxRequestsPerIP,
          action: 'ip_banned'
        }
      });
    }

    productionLogger.warn('Rate limit violation', {
      component: 'SECURITY',
      clientId,
      requestCount: client.requestCount,
      maxAllowed: this.config.maxRequestsPerIP,
      windowMs: this.config.windowMs
    });
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(clientId: string, client: ClientInfo, userAgent?: string): void {
    const patterns = [];

    // High frequency requests
    const requestRate = client.requestCount / ((Date.now() - client.firstRequest) / 60000);
    if (requestRate > 60) { // More than 1 request per second
      patterns.push('high_frequency');
    }

    // Unusual user agent
    if (!userAgent || userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent)) {
      patterns.push('suspicious_user_agent');
    }

    // Consistent timing patterns (potential bot)
    if (client.requestCount > 10) {
      const timingVariance = this.calculateTimingVariance(clientId);
      if (timingVariance < 0.1) {
        patterns.push('consistent_timing');
      }
    }

    if (patterns.length > 0) {
      client.suspiciousActivity = true;
      this.metrics.ddos.suspiciousActivity++;

      productionLogger.warn('Suspicious activity detected', {
        component: 'SECURITY',
        clientId,
        patterns,
        requestRate: Math.round(requestRate),
        userAgent
      });

      // Automatic blocking for highly suspicious activity
      if (patterns.length >= 2 && this.ddosConfig.enableAutoBlock) {
        this.blockIP(clientId, this.ddosConfig.banDurationMs);
      }
    }
  }

  /**
   * Check if current traffic pattern indicates DDoS attack
   */
  private isDDoSAttack(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old request times
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    this.requestTimes.push(now);

    const requestsPerMinute = this.requestTimes.length;
    this.metrics.rateLimit.averageRequestsPerMinute = requestsPerMinute;

    // Update threat level based on request volume
    if (requestsPerMinute > this.ddosConfig.alertThreshold * 2) {
      this.metrics.ddos.currentThreatLevel = 'critical';
    } else if (requestsPerMinute > this.ddosConfig.alertThreshold * 1.5) {
      this.metrics.ddos.currentThreatLevel = 'high';
    } else if (requestsPerMinute > this.ddosConfig.alertThreshold) {
      this.metrics.ddos.currentThreatLevel = 'medium';
    } else {
      this.metrics.ddos.currentThreatLevel = 'low';
    }

    return requestsPerMinute > this.ddosConfig.maxRequestsPerMinute;
  }

  /**
   * Handle DDoS attack
   */
  private handleDDoSAttack(clientId: string): void {
    this.metrics.ddos.blockedAttacks++;

    productionLogger.error('DDoS attack detected - activating protection', {
      component: 'SECURITY',
      clientId,
      requestsPerMinute: this.requestTimes.length,
      threshold: this.ddosConfig.maxRequestsPerMinute,
      threatLevel: this.metrics.ddos.currentThreatLevel
    });

    errorTracker.trackError(new Error('DDoS attack detected'), {
      type: ErrorType.SYSTEM_ERROR,
      severity: ErrorSeverity.CRITICAL,
      component: 'SECURITY',
      additionalContext: {
        clientId,
        requestsPerMinute: this.requestTimes.length,
        threshold: this.ddosConfig.maxRequestsPerMinute,
        threatLevel: this.metrics.ddos.currentThreatLevel
      }
    });

    // Auto-block aggressive IPs
    if (this.ddosConfig.enableAutoBlock) {
      this.blockIP(clientId, this.ddosConfig.banDurationMs);
    }
  }

  /**
   * Block an IP address
   */
  private blockIP(clientId: string, durationMs: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.blocked = true;
      client.blockedUntil = Date.now() + durationMs;
      this.metrics.rateLimit.currentlyBlocked++;
    }

    this.blockedIPs.add(clientId);

    productionLogger.warn('IP blocked', {
      component: 'SECURITY',
      clientId,
      durationMs,
      reason: 'security_violation'
    });

    // Auto-unblock after duration
    setTimeout(() => {
      this.unblockIP(clientId);
    }, durationMs);
  }

  /**
   * Unblock an IP address
   */
  private unblockIP(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.blocked = false;
      client.blockedUntil = undefined;
      this.metrics.rateLimit.currentlyBlocked = Math.max(0, this.metrics.rateLimit.currentlyBlocked - 1);
    }

    this.blockedIPs.delete(clientId);

    productionLogger.info('IP unblocked', {
      component: 'SECURITY',
      clientId,
      reason: 'ban_expired'
    });
  }

  /**
   * Check if an IP is currently blocked
   */
  private isBlocked(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.blocked) return false;

    // Check if ban has expired
    if (client.blockedUntil && Date.now() > client.blockedUntil) {
      this.unblockIP(clientId);
      return false;
    }

    return true;
  }

  /**
   * Calculate timing variance for bot detection
   */
  private calculateTimingVariance(clientId: string): number {
    // Simplified variance calculation
    // In a real implementation, you'd track request timestamps
    return Math.random() * 0.5; // Placeholder
  }

  /**
   * Generate a fingerprint for additional client identification
   */
  private generateFingerprint(userAgent?: string): string {
    // Simple fingerprint based on user agent
    if (!userAgent) return 'unknown';
    
    const hash = userAgent.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return hash.toString(36);
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get security status for health checks
   */
  getSecurityStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  } {
    const metrics = this.getMetrics();
    const blockRate = metrics.totalRequests > 0 ? 
      (metrics.blockedRequests / metrics.totalRequests) * 100 : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (metrics.ddos.currentThreatLevel === 'critical' || blockRate > 50) {
      status = 'critical';
    } else if (metrics.ddos.currentThreatLevel === 'high' || blockRate > 20) {
      status = 'warning';
    }

    return {
      status,
      details: {
        threatLevel: metrics.ddos.currentThreatLevel,
        blockRate: Math.round(blockRate * 100) / 100,
        currentlyBlocked: metrics.rateLimit.currentlyBlocked,
        requestsPerMinute: metrics.rateLimit.averageRequestsPerMinute,
        totalClients: this.clients.size
      }
    };
  }

  /**
   * Apply response delay for suspicious requests
   */
  async applyResponseDelay(clientId: string): Promise<void> {
    if (!this.ddosConfig.enableResponseDelay) return;

    const client = this.clients.get(clientId);
    if (client?.suspiciousActivity) {
      await new Promise(resolve => 
        setTimeout(resolve, this.ddosConfig.responseDelayMs)
      );
    }
  }

  /**
   * Start cleanup timer for old client data
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldClients();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Start DDoS monitoring
   */
  private startDDoSMonitoring(): void {
    this.ddosMonitorInterval = setInterval(() => {
      this.monitorDDoSPatterns();
    }, 30 * 1000); // Monitor every 30 seconds
  }

  /**
   * Clean up old client data
   */
  private cleanupOldClients(): void {
    const now = Date.now();
    const cleanupAge = this.config.windowMs * 2;

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastRequest > cleanupAge && !client.blocked) {
        this.clients.delete(clientId);
      }
    }

    productionLogger.debug('Client data cleanup completed', {
      component: 'SECURITY',
      activeClients: this.clients.size,
      cleanupAge
    });
  }

  /**
   * Monitor for DDoS patterns
   */
  private monitorDDoSPatterns(): void {
    const metrics = this.getMetrics();
    
    if (metrics.ddos.currentThreatLevel !== 'low') {
      productionLogger.info('DDoS monitoring report', {
        component: 'SECURITY',
        threatLevel: metrics.ddos.currentThreatLevel,
        requestsPerMinute: metrics.rateLimit.averageRequestsPerMinute,
        blockedIPs: metrics.rateLimit.currentlyBlocked,
        suspiciousActivity: metrics.ddos.suspiciousActivity
      });
    }
  }

  /**
   * Shutdown the rate limiting system
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.ddosMonitorInterval) {
      clearInterval(this.ddosMonitorInterval);
      this.ddosMonitorInterval = null;
    }

    productionLogger.info('Rate limiting and DDoS protection shutdown', {
      component: 'SECURITY',
      finalMetrics: this.getMetrics()
    });
  }
}

// Global rate limiting instance
let globalRateLimiter: RateLimitingSecurity | null = null;

/**
 * Initialize global rate limiting
 */
export function initializeRateLimiting(
  config?: Partial<RateLimitConfig>, 
  ddosConfig?: Partial<DDoSConfig>
): RateLimitingSecurity {
  if (globalRateLimiter) {
    globalRateLimiter.shutdown();
  }

  globalRateLimiter = new RateLimitingSecurity(config, ddosConfig);
  return globalRateLimiter;
}

/**
 * Get global rate limiter instance
 */
export function getRateLimiter(): RateLimitingSecurity | null {
  return globalRateLimiter;
}

/**
 * Shutdown global rate limiting
 */
export function shutdownRateLimiting(): void {
  if (globalRateLimiter) {
    globalRateLimiter.shutdown();
    globalRateLimiter = null;
  }
}

/**
 * MCP Rate Limiting Middleware
 */
export function mcpRateLimitingMiddleware(
  req: any,
  clientId?: string,
  userAgent?: string
): { allowed: boolean; reason?: string; retryAfter?: number } {
  if (!globalRateLimiter) {
    return { allowed: true };
  }

  const effectiveClientId = clientId || 'unknown';
  return globalRateLimiter.checkRateLimit(effectiveClientId, userAgent);
}