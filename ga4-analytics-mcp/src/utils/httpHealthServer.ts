/**
 * HTTP Health Check Server for Railway deployment monitoring
 * 
 * Provides HTTP endpoints for external monitoring systems to check
 * the health and status of the MCP server.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { logger } from './logger.js';
import { healthChecker } from './healthCheck.js';
import { getAuthManager } from './googleAuth.js';
import { performanceMonitor } from './performanceMetrics.js';
import { getCORSManager, corsSecurityMiddleware } from './corsSecurityHeaders.js';

export interface HttpHealthConfig {
  port: number;
  host: string;
  enableMetrics: boolean;
  enableDiagnostics: boolean;
}

export interface HealthEndpointResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks?: any;
  phase3Features?: any;
  metrics?: any;
  diagnostics?: any;
}

export class HttpHealthServer {
  private server?: ReturnType<typeof createServer>;
  private config: HttpHealthConfig;
  private isStarted = false;
  private startTime: number;
  private requestCount = 0;
  private healthCheckCount = 0;
  private lastHealthCheck?: HealthEndpointResponse;

  constructor(config: Partial<HttpHealthConfig> = {}) {
    this.config = {
      port: parseInt(process.env.HEALTH_CHECK_PORT || '3003'),
      host: process.env.HEALTH_CHECK_HOST || '0.0.0.0',
      enableMetrics: process.env.ENABLE_HEALTH_METRICS === 'true',
      enableDiagnostics: process.env.ENABLE_HEALTH_DIAGNOSTICS === 'true',
      ...config
    };
    this.startTime = Date.now();
  }

  /**
   * Start the HTTP health check server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('HTTP Health server already started');
      return;
    }

    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        this.isStarted = true;
        logger.info(`🏥 HTTP Health server started on ${this.config.host}:${this.config.port}`);
        logger.info(`   Health endpoint: http://${this.config.host}:${this.config.port}/health`);
        logger.info(`   Status endpoint: http://${this.config.host}:${this.config.port}/status`);
        if (this.config.enableMetrics) {
          logger.info(`   Metrics endpoint: http://${this.config.host}:${this.config.port}/metrics`);
        }
        if (this.config.enableDiagnostics) {
          logger.info(`   Diagnostics endpoint: http://${this.config.host}:${this.config.port}/diagnostics`);
        }
        resolve();
      });

      this.server!.on('error', (error) => {
        logger.error('HTTP Health server error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP health check server
   */
  async stop(): Promise<void> {
    if (!this.isStarted || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isStarted = false;
        logger.info('🏥 HTTP Health server stopped');
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.requestCount++;
    const startTime = Date.now();
    const url = req.url || '/';
    const method = req.method || 'GET';
    
    // Track HTTP requests in performance monitor
    performanceMonitor.incrementCounter('http_requests_total', { 
      method, 
      path: url,
      endpoint: 'health'
    });

    // Apply comprehensive CORS and security headers
    corsSecurityMiddleware(req, res);

    // Handle OPTIONS preflight (if not already handled by middleware)
    if (method === 'OPTIONS') {
      return;
    }

    try {
      let response: any;
      let statusCode = 200;

      switch (url) {
        case '/health':
          response = await this.getHealthStatus();
          statusCode = response.status === 'healthy' ? 200 : 
                      response.status === 'degraded' ? 200 : 503;
          break;

        case '/status':
          response = await this.getSimpleStatus();
          break;

        case '/metrics':
          if (this.config.enableMetrics) {
            response = await this.getMetrics();
          } else {
            response = { error: 'Metrics disabled' };
            statusCode = 404;
          }
          break;

        case '/diagnostics':
          if (this.config.enableDiagnostics) {
            response = await this.getDiagnostics();
          } else {
            response = { error: 'Diagnostics disabled' };
            statusCode = 404;
          }
          break;

        case '/':
        case '/ping':
          response = { 
            status: 'ok', 
            message: 'GA4 Analytics MCP Server Health Check',
            timestamp: new Date().toISOString()
          };
          break;

        default:
          response = { error: 'Not found' };
          statusCode = 404;
          break;
      }

      // Cache health status for performance
      if (url === '/health') {
        this.lastHealthCheck = response;
        this.healthCheckCount++;
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end(JSON.stringify(response, null, 2));

      const duration = Date.now() - startTime;
      
      // Track response time in performance monitor
      performanceMonitor.recordResponseTime(duration, 'http');
      
      logger.debug(`HTTP Health: ${method} ${url} ${statusCode} (${duration}ms)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`HTTP Health error for ${method} ${url}`, error instanceof Error ? error : undefined);

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Get comprehensive health status
   */
  private async getHealthStatus(): Promise<HealthEndpointResponse> {
    try {
      const healthStatus = await healthChecker.performHealthCheck();
      
      return {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: healthStatus.uptime,
        version: healthStatus.version,
        checks: healthStatus.checks,
        phase3Features: healthStatus.phase3Features
      };
    } catch (error) {
      logger.error('Failed to get health status', error instanceof Error ? error : undefined);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: '1.0.0',
        checks: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get simple status for quick checks
   */
  private async getSimpleStatus(): Promise<any> {
    const simple = healthChecker.getSimpleStatus();
    
    return {
      status: simple,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      server: 'ga4-analytics-mcp',
      version: '1.0.0'
    };
  }

  /**
   * Get metrics information
   */
  private async getMetrics(): Promise<any> {
    const uptime = Date.now() - this.startTime;
    
    // Get comprehensive performance metrics
    const perfMetrics = performanceMonitor.getPerformanceMetrics();
    const metricsSummary = performanceMonitor.getMetricsSummary();
    
    let authMetrics = {};
    try {
      const authManager = getAuthManager();
      const health = authManager.getAuthenticationHealth();
      authMetrics = {
        isAuthenticated: health.isAuthenticated,
        hasClient: health.hasClient,
        tokenStatus: health.tokenStatus,
        credentialHealth: health.credentialHealth
      };
    } catch (error) {
      authMetrics = { error: 'Authentication metrics unavailable' };
    }

    return {
      timestamp: new Date().toISOString(),
      server: {
        uptime,
        uptimeHuman: this.formatUptime(uptime),
        startTime: new Date(this.startTime).toISOString()
      },
      performance: perfMetrics,
      trends: metricsSummary.trends,
      alerts: metricsSummary.alerts,
      http: {
        totalRequests: this.requestCount,
        healthChecks: this.healthCheckCount,
        requestsPerMinute: Math.round((this.requestCount / (uptime / 1000)) * 60)
      },
      authentication: authMetrics,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * Get diagnostic information
   */
  private async getDiagnostics(): Promise<any> {
    let diagnostics = {};
    
    try {
      const authManager = getAuthManager();
      diagnostics = await authManager.getDiagnostics();
    } catch (error) {
      diagnostics = { 
        error: 'Diagnostics unavailable',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      timestamp: new Date().toISOString(),
      server: 'ga4-analytics-mcp',
      version: '1.0.0',
      uptime: Date.now() - this.startTime,
      lastHealthCheck: this.lastHealthCheck,
      ...diagnostics
    };
  }

  /**
   * Format uptime in human readable format
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get server status
   */
  getServerStatus(): {
    isStarted: boolean;
    port: number;
    host: string;
    uptime: number;
    requestCount: number;
  } {
    return {
      isStarted: this.isStarted,
      port: this.config.port,
      host: this.config.host,
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount
    };
  }
}

// Global HTTP health server instance
let globalHttpHealthServer: HttpHealthServer | undefined;

/**
 * Initialize global HTTP health server
 */
export function initializeHttpHealthServer(config?: Partial<HttpHealthConfig>): HttpHealthServer {
  globalHttpHealthServer = new HttpHealthServer(config);
  return globalHttpHealthServer;
}

/**
 * Get global HTTP health server
 */
export function getHttpHealthServer(): HttpHealthServer {
  if (!globalHttpHealthServer) {
    throw new Error('HTTP Health server not initialized');
  }
  return globalHttpHealthServer;
}

/**
 * Start global HTTP health server
 */
export async function startHttpHealthServer(config?: Partial<HttpHealthConfig>): Promise<void> {
  if (!globalHttpHealthServer) {
    globalHttpHealthServer = new HttpHealthServer(config);
  }
  await globalHttpHealthServer.start();
}

/**
 * Stop global HTTP health server
 */
export async function stopHttpHealthServer(): Promise<void> {
  if (globalHttpHealthServer) {
    await globalHttpHealthServer.stop();
  }
}