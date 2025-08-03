#!/usr/bin/env node

/**
 * GA4 Analytics MCP Server
 * 
 * This server provides Google Analytics 4 data integration tools
 * through the Model Context Protocol (MCP).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode as MCPErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import utilities
import { logger, createRequestTimer } from './utils/logger.js';
import { logger as productionLogger, setCorrelationId, getCorrelationId, loggerConfig } from './utils/productionLogger.js';
import { 
  mcpRequestLoggingMiddleware, 
  ga4RequestLoggingMiddleware, 
  authLoggingMiddleware,
  healthCheckLoggingMiddleware 
} from './utils/requestLoggingMiddleware.js';
import { errorTracker } from './utils/errorTracking.js';
import { apmMonitor, withAPMTrace } from './utils/apmMonitoring.js';
import { healthDashboard } from './utils/healthDashboard.js';
import { ga4MetricsCollector } from './utils/ga4MetricsCollector.js';
import { getConnectionPool, shutdownAllConnectionPools } from './utils/connectionPool.js';
import { MCPErrorHandler, setupGlobalErrorHandlers, ErrorCode } from './utils/errorHandler.js';
import { lifecycleManager } from './utils/lifecycle.js';
import { initializeRateLimiting, shutdownRateLimiting, getRateLimiter, mcpRateLimitingMiddleware } from './utils/rateLimitingSecurity.js';
import { initializeCORSSecurity, getCORSManager } from './utils/corsSecurityHeaders.js';
import { initializeProductionCache, getProductionCache, shutdownProductionCache } from './utils/productionCache.js';
import { initializeAuthentication, getAuthManager, getGA4Client } from './utils/googleAuth.js';
import { startHttpHealthServer, stopHttpHealthServer } from './utils/httpHealthServer.js';
import { performanceMonitor } from './utils/performanceMetrics.js';
import { initializeGA4DataClient, getGA4DataClient } from './utils/ga4DataClient.js';
import { 
  parseDateRange, 
  filterGoogleAdsTraffic, 
  sortGA4Data, 
  limitGA4Data,
  formatMetricValue,
  getMetricDisplayName,
  getDimensionDisplayName,
  GA4_METRICS,
  GA4_DIMENSIONS,
  debugGA4Data
} from './utils/ga4Utils.js';

// Load environment variables
dotenv.config();

// Setup global error handlers
setupGlobalErrorHandlers();

/**
 * Create and configure the MCP server
 */
async function createServer(): Promise<Server> {
  logger.info('Initializing MCP server...');
  
  const server = new Server(
    {
      name: 'ga4-analytics-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Add server initialization to lifecycle
  lifecycleManager.addHook({
    name: 'mcp-server',
    priority: 1,
    startup: async () => {
      logger.info('MCP server core initialized');
    },
    shutdown: async () => {
      logger.info('MCP server core shutdown');
    },
  });

  // Add production logging to lifecycle
  lifecycleManager.addHook({
    name: 'production-logging',
    priority: 1.5,
    startup: async () => {
      productionLogger.info('Production logging system initialized', {
        component: 'LOGGING',
        loggerConfig,
        environment: process.env.NODE_ENV || 'development',
      });
    },
    shutdown: async () => {
      productionLogger.info('Production logging system shutting down', {
        component: 'LOGGING',
        shutdownTime: new Date().toISOString(),
      });
      
      // Close production logger gracefully
      const { closeLogger } = await import('./utils/productionLogger.js');
      await closeLogger();
    },
  });

  // Add error tracking to lifecycle
  lifecycleManager.addHook({
    name: 'error-tracking',
    priority: 2,
    startup: async () => {
      productionLogger.info('Error tracking system initialized', {
        component: 'ERROR_TRACKING',
        features: ['error_categorization', 'alert_rules', 'recovery_tracking']
      });
    },
    shutdown: async () => {
      const errorStats = errorTracker.getErrorStats();
      productionLogger.info('Error tracking system shutting down', {
        component: 'ERROR_TRACKING',
        totalErrors: errorStats.totalErrors,
        errorRate: errorStats.errorRate,
        shutdownTime: new Date().toISOString(),
      });
    },
  });

  // Add APM monitoring to lifecycle
  lifecycleManager.addHook({
    name: 'apm-monitoring',
    priority: 2.5,
    startup: async () => {
      productionLogger.info('APM monitoring system initialized', {
        component: 'APM',
        features: ['distributed_tracing', 'performance_insights', 'latency_tracking']
      });
    },
    shutdown: async () => {
      const apmMetrics = apmMonitor.getAPMMetrics();
      productionLogger.info('APM monitoring system shutting down', {
        component: 'APM',
        totalRequests: apmMetrics.throughput.requestsPerHour,
        averageLatency: apmMetrics.latency.mean,
        errorRate: apmMetrics.errorRate.percentage,
        shutdownTime: new Date().toISOString(),
      });
    },
  });

  // Add GA4 metrics collection to lifecycle
  lifecycleManager.addHook({
    name: 'ga4-metrics',
    priority: 3,
    startup: async () => {
      productionLogger.info('GA4 metrics collection initialized', {
        component: 'GA4_METRICS',
        features: ['api_usage_tracking', 'quota_monitoring', 'optimization_insights']
      });
    },
    shutdown: async () => {
      const ga4Metrics = ga4MetricsCollector.getPerformanceMetrics();
      const quotaUsage = ga4MetricsCollector.getQuotaUsage();
      productionLogger.info('GA4 metrics collection shutting down', {
        component: 'GA4_METRICS',
        totalApiCalls: ga4Metrics.totalCalls,
        successRate: ga4Metrics.successRate,
        quotaUsage: quotaUsage.daily.percentage,
        shutdownTime: new Date().toISOString(),
      });
    },
  });

  // Add health dashboard to lifecycle
  lifecycleManager.addHook({
    name: 'health-dashboard',
    priority: 3.5,
    startup: async () => {
      productionLogger.info('Health dashboard initialized', {
        component: 'HEALTH_DASHBOARD',
        features: ['uptime_monitoring', 'component_health', 'trend_analysis']
      });
    },
    shutdown: async () => {
      const systemStatus = await healthDashboard.getSystemStatus();
      productionLogger.info('Health dashboard shutting down', {
        component: 'HEALTH_DASHBOARD',
        systemStatus: systemStatus.status,
        uptime: systemStatus.uptime,
        componentCount: systemStatus.components.length,
        shutdownTime: new Date().toISOString(),
      });
    },
  });

  // Add rate limiting and DDoS protection to lifecycle
  lifecycleManager.addHook({
    name: 'rate-limiting-security',
    priority: 3.7,
    startup: async () => {
      // Initialize rate limiting with production configuration
      const rateLimitConfig = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        maxRequestsPerIP: parseInt(process.env.RATE_LIMIT_MAX_PER_IP || '100'),
        enableWhitelist: process.env.ENABLE_RATE_LIMIT_WHITELIST !== 'false',
        whitelist: process.env.RATE_LIMIT_WHITELIST?.split(',') || ['127.0.0.1', '::1', 'localhost'],
        banDuration: parseInt(process.env.RATE_LIMIT_BAN_DURATION || '3600000'), // 1 hour
      };

      const ddosConfig = {
        enabled: process.env.ENABLE_DDOS_PROTECTION !== 'false',
        maxRequestsPerMinute: parseInt(process.env.DDOS_MAX_REQUESTS_PER_MINUTE || '200'),
        banDurationMs: parseInt(process.env.DDOS_BAN_DURATION || '1800000'), // 30 minutes
        alertThreshold: parseInt(process.env.DDOS_ALERT_THRESHOLD || '500'),
        enableAutoBlock: process.env.DDOS_AUTO_BLOCK !== 'false',
        enableResponseDelay: process.env.DDOS_RESPONSE_DELAY !== 'false',
        responseDelayMs: parseInt(process.env.DDOS_RESPONSE_DELAY_MS || '1000'),
      };

      initializeRateLimiting(rateLimitConfig, ddosConfig);
      
      productionLogger.info('Rate limiting and DDoS protection initialized', {
        component: 'SECURITY',
        rateLimitWindow: rateLimitConfig.windowMs,
        maxRequests: rateLimitConfig.maxRequests,
        maxRequestsPerIP: rateLimitConfig.maxRequestsPerIP,
        ddosEnabled: ddosConfig.enabled,
        ddosThreshold: ddosConfig.maxRequestsPerMinute,
        features: ['rate_limiting', 'ddos_protection', 'ip_blocking', 'suspicious_activity_detection']
      });
    },
    shutdown: async () => {
      const rateLimiter = getRateLimiter();
      if (rateLimiter) {
        const securityMetrics = rateLimiter.getMetrics();
        productionLogger.info('Rate limiting and DDoS protection shutting down', {
          component: 'SECURITY',
          totalRequests: securityMetrics.totalRequests,
          blockedRequests: securityMetrics.blockedRequests,
          rateLimitViolations: securityMetrics.rateLimit.violations,
          currentThreatLevel: securityMetrics.ddos.currentThreatLevel,
          shutdownTime: new Date().toISOString(),
        });
      }
      shutdownRateLimiting();
    },
  });

  // Add CORS and Security Headers to lifecycle
  lifecycleManager.addHook({
    name: 'cors-security',
    priority: 3.8,
    startup: async () => {
      // Initialize CORS and security headers with production configuration
      const corsConfig = {
        allowedOrigins: process.env.CORS_ORIGIN?.split(',') || ['*'],
        allowCredentials: process.env.CORS_CREDENTIALS === 'true',
        allowedMethods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS,HEAD').split(','),
        allowedHeaders: (process.env.CORS_HEADERS || 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Cache-Control').split(','),
        secureContext: process.env.NODE_ENV === 'production'
      };

      const securityConfig = {
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
          maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
          includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
          preload: process.env.HSTS_PRELOAD === 'true'
        },
        frameOptions: (process.env.X_FRAME_OPTIONS as any) || 'DENY',
        xssProtection: {
          enabled: process.env.X_XSS_PROTECTION !== 'false',
          mode: (process.env.XSS_PROTECTION_MODE as any) || 'block',
          reportUri: process.env.XSS_REPORT_URI
        }
      };

      initializeCORSSecurity(corsConfig, securityConfig);
      
      productionLogger.info('CORS and Security Headers initialized', {
        component: 'SECURITY',
        allowedOrigins: corsConfig.allowedOrigins,
        secureContext: corsConfig.secureContext,
        cspEnabled: securityConfig.contentSecurityPolicy.enabled,
        hstsEnabled: securityConfig.hsts.enabled,
        features: ['cors_protection', 'security_headers', 'xss_protection', 'content_security_policy']
      });
    },
    shutdown: async () => {
      const corsManager = getCORSManager();
      if (corsManager) {
        const securityMetrics = corsManager.getSecurityMetrics();
        productionLogger.info('CORS and Security Headers shutting down', {
          component: 'SECURITY',
          totalCorsRequests: securityMetrics.corsRequests.total,
          blockedRequests: securityMetrics.corsRequests.blocked,
          securityHeadersApplied: securityMetrics.securityHeaders.applied,
          shutdownTime: new Date().toISOString(),
        });
      }
    },
  });

  // Add Production Cache to lifecycle
  lifecycleManager.addHook({
    name: 'production-cache',
    priority: 3.9,
    startup: async () => {
      // Initialize production cache with optimized configuration
      const cacheConfig = {
        maxMemoryEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '2000'),
        defaultTTL: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
        enableCompression: process.env.CACHE_COMPRESSION !== 'false',
        compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
        
        ttlStrategies: {
          'ga4-report': parseInt(process.env.CACHE_GA4_REPORT_TTL || '600000'), // 10 minutes
          'ga4-realtime': parseInt(process.env.CACHE_GA4_REALTIME_TTL || '30000'), // 30 seconds
          'ga4-traffic': parseInt(process.env.CACHE_GA4_TRAFFIC_TTL || '900000'), // 15 minutes
          'ga4-demographics': parseInt(process.env.CACHE_GA4_DEMOGRAPHICS_TTL || '1800000'), // 30 minutes
          'ga4-conversions': parseInt(process.env.CACHE_GA4_CONVERSIONS_TTL || '1200000'), // 20 minutes
        },
        
        enablePersistence: process.env.CACHE_PERSISTENCE === 'true',
        enableCacheWarming: process.env.CACHE_WARMING === 'true',
        enableAnalytics: process.env.CACHE_ANALYTICS !== 'false',
        enableOptimization: process.env.CACHE_OPTIMIZATION !== 'false',
        
        enableStaleWhileRevalidate: process.env.CACHE_STALE_WHILE_REVALIDATE !== 'false',
        staleTimeout: parseInt(process.env.CACHE_STALE_TIMEOUT || '60000'),
      };

      initializeProductionCache(cacheConfig);
      
      productionLogger.info('Production Cache initialized', {
        component: 'CACHE',
        maxEntries: cacheConfig.maxMemoryEntries,
        compression: cacheConfig.enableCompression,
        persistence: cacheConfig.enablePersistence,
        analytics: cacheConfig.enableAnalytics,
        optimization: cacheConfig.enableOptimization,
        features: ['multi_level_caching', 'intelligent_ttl', 'compression', 'lru_eviction', 'stale_while_revalidate']
      });
    },
    shutdown: async () => {
      const cache = getProductionCache();
      if (cache) {
        const cacheMetrics = cache.getMetrics();
        productionLogger.info('Production Cache shutting down', {
          component: 'CACHE',
          finalMetrics: {
            entries: cacheMetrics.memory.entries,
            hitRate: cacheMetrics.memory.hitRate,
            totalSize: cacheMetrics.memory.totalSize,
            compressionSavings: cacheMetrics.performance.compressionSavings,
            evictions: cacheMetrics.memory.evictions
          },
          shutdownTime: new Date().toISOString(),
        });
      }
      await shutdownProductionCache();
    },
  });

  // Add connection pooling to lifecycle
  lifecycleManager.addHook({
    name: 'connection-pooling',
    priority: 4,
    startup: async () => {
      if (process.env.ENABLE_CONNECTION_POOLING === 'true') {
        productionLogger.info('Connection pooling initialized', {
          component: 'CONNECTION_POOL',
          poolSize: process.env.CONNECTION_POOL_SIZE || '10',
          connectionTimeout: process.env.CONNECTION_TIMEOUT || '30000',
          features: ['http_pooling', 'resource_management', 'health_monitoring']
        });
        
        // Connection pools are initialized automatically in connectionPool.ts
        // when ENABLE_CONNECTION_POOLING=true
      } else {
        productionLogger.info('Connection pooling disabled', {
          component: 'CONNECTION_POOL',
          reason: 'ENABLE_CONNECTION_POOLING not set to true'
        });
      }
    },
    shutdown: async () => {
      if (process.env.ENABLE_CONNECTION_POOLING === 'true') {
        productionLogger.info('Shutting down connection pools', {
          component: 'CONNECTION_POOL',
          shutdownTime: new Date().toISOString(),
        });
        
        try {
          await shutdownAllConnectionPools();
          productionLogger.info('All connection pools shut down successfully', {
            component: 'CONNECTION_POOL'
          });
        } catch (error) {
          productionLogger.error('Error shutting down connection pools', error instanceof Error ? error : undefined, {
            component: 'CONNECTION_POOL',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    },
  });

  // Add Google Authentication to lifecycle
  lifecycleManager.addHook({
    name: 'google-authentication',
    priority: 5,
    startup: async () => {
      logger.info('Initializing Google Authentication...');
      try {
        const authResult = await initializeAuthentication();
        
        if (!authResult.isValid) {
          logger.error(`❌ Authentication failed: ${authResult.error}`);
          logger.warn('⚠️ Server will continue with degraded functionality (health monitoring only)');
          // Don't throw - allow server to continue for health monitoring
          return;
        }
        
        logger.info('✅ Google Authentication initialized successfully');
        if (authResult.propertyAccess) {
          logger.info('✅ GA4 property access verified');
        }
      } catch (error) {
        logger.error('❌ Authentication initialization error', error instanceof Error ? error : undefined);
        logger.warn('⚠️ Server will continue with degraded functionality (health monitoring only)');
        // Don't throw - allow server to continue for health monitoring
      }
    },
    shutdown: async () => {
      logger.info('Google Authentication shutdown');
      // Note: Google Auth clients will be garbage collected
    },
  });

  // Add GA4 Data Client to lifecycle (depends on authentication)
  lifecycleManager.addHook({
    name: 'ga4-data-client',
    priority: 10,
    startup: async () => {
      logger.info('Initializing GA4 Data Client...');
      try {
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (!propertyId) {
          throw new Error('GA4_PROPERTY_ID environment variable is required');
        }

        const authManager = getAuthManager();
        if (!authManager.isAuthenticationValid()) {
          logger.warn('⚠️ Authentication not available - GA4 Data Client initialization skipped');
          return;
        }

        const dataClient = initializeGA4DataClient(propertyId);
        await dataClient.initialize();
        
        logger.info('✅ GA4 Data Client initialized successfully');
        logger.info(`📊 GA4 Data Client ready for property: ${propertyId}`);
      } catch (error) {
        logger.error('❌ GA4 Data Client initialization error', error instanceof Error ? error : undefined);
        logger.warn('⚠️ GA4 tools will not be available');
        // Don't throw - allow server to continue without GA4 functionality
      }
    },
    shutdown: async () => {
      logger.info('GA4 Data Client shutdown');
      try {
        const dataClient = getGA4DataClient();
        dataClient.clearCache();
        logger.info('✅ GA4 Data Client cache cleared');
      } catch (error) {
        // Client might not be initialized, ignore errors
      }
    },
  });

  // Add HTTP Health Server to lifecycle (Phase 4) - Start early for monitoring
  lifecycleManager.addHook({
    name: 'http-health-server',
    priority: 2,
    startup: async () => {
      logger.info('Starting HTTP Health Check server...');
      await startHttpHealthServer({
        enableMetrics: process.env.NODE_ENV !== 'production',
        enableDiagnostics: process.env.NODE_ENV === 'development'
      });
      logger.info('✅ HTTP Health Check server started');
    },
    shutdown: async () => {
      logger.info('Stopping HTTP Health Check server...');
      await stopHttpHealthServer();
      logger.info('✅ HTTP Health Check server stopped');
    },
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const timer = createRequestTimer();
    const requestId = logger.requestStart('list_tools');
    
    try {
      logger.debug('Listing available tools');
      
      const tools = [
        {
          name: 'query_analytics',
          description: 'Execute custom GA4 queries with flexible metrics and dimensions',
          inputSchema: {
            type: 'object',
            properties: {
              metrics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of GA4 metrics (e.g., "sessions", "pageviews")',
              },
              dimensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of GA4 dimensions (e.g., "country", "deviceType")',
              },
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              limit: {
                type: 'number',
                description: 'Maximum rows to return (optional)',
                default: 100,
              },
            },
            required: ['metrics', 'startDate', 'endDate'],
          },
        },
        {
          name: 'get_realtime_data',
          description: 'Get current active users and real-time activity',
          inputSchema: {
            type: 'object',
            properties: {
              metrics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Real-time metrics array',
                default: ['activeUsers'],
              },
            },
          },
        },
        {
          name: 'get_traffic_sources',
          description: 'Analyze traffic sources and channel performance',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              includeChannels: {
                type: 'boolean',
                description: 'Include channel grouping data',
                default: true,
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'get_user_demographics',
          description: 'Access user demographic information',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              breakdown: {
                type: 'string',
                enum: ['age', 'gender', 'location'],
                description: 'Demographic breakdown type',
                default: 'age',
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'get_page_performance',
          description: 'Monitor page-level performance metrics',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              orderBy: {
                type: 'string',
                description: 'Sort field',
                default: 'pageviews',
              },
              limit: {
                type: 'number',
                description: 'Maximum pages to return',
                default: 50,
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'get_conversion_data',
          description: 'Track conversion goals and funnel performance',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              includeGoals: {
                type: 'boolean',
                description: 'Include goal completion data',
                default: true,
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
      ];

      const response = { tools };
      logger.requestEnd(requestId, timer.end(), true);
      
      return response;
      
    } catch (error) {
      const mcpError = MCPErrorHandler.handleError(error, requestId);
      MCPErrorHandler.logError(mcpError);
      logger.requestEnd(requestId, timer.end(), false);
      
      throw new Error(`Failed to list tools: ${mcpError.message}`);
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const timer = createRequestTimer();
    const requestId = logger.requestStart(`tool_call:${name}`, args);
    const requestStartTime = Date.now();

    // Initialize production logging for this request
    const mcpLogging = mcpRequestLoggingMiddleware(name, args);

    // Track MCP tool calls and authentication attempts
    performanceMonitor.incrementCounter('mcp_requests_total', { 
      method: 'call_tool',
      tool: name
    });
    performanceMonitor.incrementCounter('tool_calls_total', { tool: name });

    try {
      logger.debug(`Executing tool: ${name}`, { args });
      
      // Authentication middleware - verify authentication before tool execution
      performanceMonitor.incrementCounter('auth_attempts_total');
      const authManager = getAuthManager();
      if (!authManager.isAuthenticationValid()) {
        throw MCPErrorHandler.authenticationFailed(
          'Authentication required. Please ensure Google credentials are properly configured.'
        );
      }
      performanceMonitor.incrementCounter('auth_successes_total');
      
      let result;
      
      switch (name) {
        case 'query_analytics':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              metrics, 
              dimensions, 
              dateRange, 
              dateRanges, 
              limit, 
              sortBy, 
              sortDesc, 
              googleAdsOnly, 
              format,
              orderBy
            } = args as {
              metrics?: string[];
              dimensions?: string[];
              dateRange?: string | { startDate: string; endDate: string; name?: string };
              dateRanges?: Array<{ startDate: string; endDate: string; name?: string }>;
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              googleAdsOnly?: boolean;
              format?: 'summary' | 'detailed' | 'raw';
              orderBy?: Array<{ metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }>;
            };
            
            // Enhanced parameter processing with intelligent defaults
            const processedMetrics = metrics || [GA4_METRICS.SESSIONS, GA4_METRICS.ACTIVE_USERS, GA4_METRICS.NEW_USERS];
            const processedDimensions = dimensions || [GA4_DIMENSIONS.COUNTRY, GA4_DIMENSIONS.SESSION_SOURCE];
            const processedLimit = Math.min(limit || 25, 1000); // Max 1000 rows
            const outputFormat = format || 'summary';
            
            // Smart date range processing with preset support
            let processedDateRanges;
            if (dateRange) {
              // Single date range (string preset or object)
              const parsed = typeof dateRange === 'string' ? parseDateRange(dateRange) : parseDateRange(dateRange);
              processedDateRanges = [parsed];
            } else if (dateRanges && dateRanges.length > 0) {
              // Multiple date ranges
              processedDateRanges = dateRanges.map(range => parseDateRange(range));
            } else {
              // Default to last 30 days
              processedDateRanges = [parseDateRange('30daysAgo')];
            }
            
            logger.info(`🔍 GA4 Query: ${processedMetrics.length} metrics, ${processedDimensions.length} dimensions, ${processedDateRanges.length} date ranges`);
            
            // Start APM span for GA4 API call
            const traceId = apmMonitor.startTrace('ga4_query_analytics', 'GA4_API', {
              tool: 'query_analytics',
              metricsCount: processedMetrics.length,
              dimensionsCount: processedDimensions.length,
              dateRangesCount: processedDateRanges.length
            });
            
            const ga4SpanId = apmMonitor.startSpan(traceId, 'ga4_api_call', 'GA4_API', undefined, {
              endpoint: 'runReport',
              propertyId: process.env.GA4_PROPERTY_ID!,
              limit: processedLimit
            });
            
            // Record GA4 API call start time for metrics
            const apiCallStart = Date.now();
            
            try {
              // Execute GA4 query using shared data client
              let response = await ga4Client.runReport({
                propertyId: process.env.GA4_PROPERTY_ID!,
                metrics: processedMetrics,
                dimensions: processedDimensions,
                dateRanges: processedDateRanges,
                limit: processedLimit,
                orderBy: orderBy
              });
              
              const apiCallDuration = Date.now() - apiCallStart;
              
              // Record successful GA4 API call
              ga4MetricsCollector.recordApiCall({
                endpoint: 'runReport',
                method: 'POST',
                tool: 'query_analytics',
                correlationId: mcpLogging.correlationId,
                request: {
                  propertyId: process.env.GA4_PROPERTY_ID!,
                  metrics: processedMetrics,
                  dimensions: processedDimensions,
                  dateRanges: processedDateRanges,
                  limit: processedLimit,
                  parameters: { format, googleAdsOnly, sortBy, sortDesc }
                },
                response: {
                  success: true,
                  duration: apiCallDuration,
                  statusCode: 200,
                  rowCount: response.rows.length,
                  dataSize: JSON.stringify(response).length,
                  fromCache: response.requestInfo?.fromCache || false
                },
                quota: {
                  tokensUsed: Math.max(10, processedMetrics.length * 2 + processedDimensions.length * 2)
                }
              });
              
              // Add span tags and finish APM span successfully
              apmMonitor.spanTags(ga4SpanId, {
                rowCount: response.rows.length,
                fromCache: response.requestInfo?.fromCache || false,
                responseSize: JSON.stringify(response).length
              });
              apmMonitor.finishSpan(ga4SpanId);
              apmMonitor.finishSpan(apmMonitor.getTrace(traceId)?.rootSpan.id || '');
            
            // Apply Google Ads filtering if requested
            if (googleAdsOnly) {
              response = filterGoogleAdsTraffic(response);
              logger.info(`🎯 Filtered to Google Ads traffic: ${response.rows.length} rows remaining`);
            }
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging for development
            debugGA4Data(response, 'query_analytics result');
            
            // Format response based on requested format
            let formattedResponse = '';
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw GA4 Analytics Data**

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `✅ **GA4 Analytics Query - Detailed Results**

📊 **Query Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Metrics: ${processedMetrics.map(getMetricDisplayName).join(', ')}
- Dimensions: ${processedDimensions.map(getDimensionDisplayName).join(', ')}
- Date Range(s): ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- Google Ads Only: ${googleAdsOnly ? 'Yes' : 'No'}
- Execution Time: ${response.requestInfo.executionTime}ms
- From Cache: ${response.requestInfo.fromCache ? 'Yes' : 'No'}
- Total Rows: ${response.metadata.rowCount}

📈 **Performance Summary:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

📋 **Detailed Results:**
${response.rows.slice(0, 20).map((row, index) => {
  const dims = response.metadata.dimensionHeaders.map(h => 
    `${getDimensionDisplayName(h)}: ${row.dimensions[h]}`
  ).join(' | ');
  const mets = response.metadata.metricHeaders.map(h => 
    `${getMetricDisplayName(h)}: ${formatMetricValue(h, row.metrics[h])}`
  ).join(' | ');
  return `${index + 1}. ${dims}\n   ${mets}`;
}).join('\n\n')}

${response.rows.length > 20 ? `\n... and ${response.rows.length - 20} more rows` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else {
              // Summary format (default)
              formattedResponse = `✅ **GA4 Analytics Summary**

📊 **Query Overview:**
- **Metrics**: ${processedMetrics.map(getMetricDisplayName).join(', ')}
- **Dimensions**: ${processedDimensions.map(getDimensionDisplayName).join(', ')}
- **Period**: ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- **Rows**: ${response.metadata.rowCount} ${googleAdsOnly ? '(Google Ads only)' : ''}
- **Performance**: ${response.requestInfo.executionTime}ms ${response.requestInfo.fromCache ? '(cached)' : '(fresh)'}

🎯 **Key Metrics:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `**${getMetricDisplayName(metric)}**: ${formatted}`;
}).join('\n')}

📈 **Top Results:**
${response.rows.slice(0, 10).map((row, index) => {
  const dims = response.metadata.dimensionHeaders.map(h => row.dimensions[h]).join(' | ');
  const mainMetric = response.metadata.metricHeaders[0];
  const value = formatMetricValue(mainMetric, row.metrics[mainMetric]);
  return `${index + 1}. **${dims}** → ${value}`;
}).join('\n')}

${response.rows.length > 10 ? `*... and ${response.rows.length - 10} more results*` : ''}

💡 **Available Options:**
- Add \`"format": "detailed"\` for full breakdown
- Add \`"format": "raw"\` for JSON data
- Add \`"googleAdsOnly": true\` to filter Google Ads traffic
- Use \`"sortBy": "metricName"\` to sort results
- Try different date ranges: "7daysAgo", "30daysAgo", "lastMonth"`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
            } catch (apiError) {
              const apiCallDuration = Date.now() - apiCallStart;
              
              // Record failed GA4 API call
              ga4MetricsCollector.recordApiCall({
                endpoint: 'runReport',
                method: 'POST',
                tool: 'query_analytics',
                correlationId: mcpLogging.correlationId,
                request: {
                  propertyId: process.env.GA4_PROPERTY_ID!,
                  metrics: processedMetrics,
                  dimensions: processedDimensions,
                  dateRanges: processedDateRanges,
                  limit: processedLimit,
                  parameters: { format, googleAdsOnly, sortBy, sortDesc }
                },
                response: {
                  success: false,
                  duration: apiCallDuration,
                  statusCode: 500,
                  error: {
                    type: apiError instanceof Error ? apiError.constructor.name : 'UnknownError',
                    message: apiError instanceof Error ? apiError.message : String(apiError),
                    code: (apiError as any)?.code || 'unknown'
                  }
                },
                quota: {
                  tokensUsed: 0 // No tokens consumed on error
                }
              });
              
              // Track error in APM and finish spans with error
              apmMonitor.finishSpan(ga4SpanId, 'error' as any, apiError instanceof Error ? apiError : new Error(String(apiError)));
              apmMonitor.finishSpan(apmMonitor.getTrace(traceId)?.rootSpan.id || '', 'error' as any, apiError instanceof Error ? apiError : new Error(String(apiError)));
              
              // Track error in error tracker
              errorTracker.trackError(apiError instanceof Error ? apiError : new Error(String(apiError)), {
                type: 'ga4_api_error' as any,
                component: 'GA4_API',
                correlationId: mcpLogging.correlationId,
                additionalContext: {
                  tool: 'query_analytics',
                  endpoint: 'runReport',
                  metrics: processedMetrics,
                  dimensions: processedDimensions
                }
              });
              
              throw apiError; // Re-throw to be caught by outer catch
            }
          } catch (error) {
            logger.error('query_analytics tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **GA4 Analytics Query Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Common Issues & Solutions:**
- **Authentication**: Check GA4_PROPERTY_ID and Google credentials
- **Invalid Metrics/Dimensions**: Use valid GA4 metric/dimension names
- **Date Format**: Use YYYY-MM-DD format or presets like "7daysAgo"
- **Network**: Check internet connectivity and GA4 API availability
- **Quota**: Wait if quota limits exceeded, or reduce query complexity

**Available Metrics**: ${Object.values(GA4_METRICS).slice(0, 10).join(', ')} ...
**Available Dimensions**: ${Object.values(GA4_DIMENSIONS).slice(0, 10).join(', ')} ...

**Example Usage**:
\`\`\`json
{
  "metrics": ["sessions", "users"],
  "dimensions": ["country"],
  "dateRange": "30daysAgo",
  "limit": 10,
  "googleAdsOnly": false
}
\`\`\``,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'get_realtime_data':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              metrics, 
              dimensions, 
              limit, 
              sortBy, 
              sortDesc, 
              format,
              orderBy,
              refreshInterval 
            } = args as {
              metrics?: string[];
              dimensions?: string[];
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              format?: 'summary' | 'detailed' | 'raw' | 'live';
              orderBy?: Array<{ metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }>;
              refreshInterval?: number;
            };
            
            // Enhanced real-time parameter processing
            const processedMetrics = metrics || [
              GA4_METRICS.ACTIVE_USERS, 
              GA4_METRICS.SCREEN_PAGE_VIEWS, 
              GA4_METRICS.EVENT_COUNT
            ];
            const processedDimensions = dimensions || [
              GA4_DIMENSIONS.COUNTRY, 
              GA4_DIMENSIONS.DEVICE_CATEGORY,
              GA4_DIMENSIONS.SESSION_SOURCE
            ];
            const processedLimit = Math.min(limit || 15, 250); // Max 250 for real-time
            const outputFormat = format || 'live';
            
            logger.info(`🔴 Real-time Query: ${processedMetrics.length} metrics, ${processedDimensions.length} dimensions`);
            
            // Execute GA4 real-time query
            let response = await ga4Client.runRealtimeReport({
              propertyId: process.env.GA4_PROPERTY_ID!,
              metrics: processedMetrics,
              dimensions: processedDimensions,
              limit: processedLimit,
              orderBy: orderBy
            });
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Real-time data sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging for development
            debugGA4Data(response, 'get_realtime_data result');
            
            // Format response based on requested format
            let formattedResponse = '';
            const currentTime = new Date().toLocaleString();
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw Real-time GA4 Data**
**Timestamp**: ${currentTime}

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `🔴 **GA4 Real-time Analytics - Detailed View**
**Live Data as of**: ${currentTime}

📊 **Real-time Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Metrics: ${processedMetrics.map(getMetricDisplayName).join(', ')}
- Dimensions: ${processedDimensions.map(getDimensionDisplayName).join(', ')}
- Active Rows: ${response.metadata.rowCount}
- Query Time: ${response.requestInfo.executionTime}ms
- Data Timestamp: ${response.requestInfo.timestamp}

📈 **Live Totals:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

📋 **Detailed Real-time Activity:**
${response.rows.slice(0, 15).map((row, index) => {
  const dims = response.metadata.dimensionHeaders.map(h => 
    `${getDimensionDisplayName(h)}: ${row.dimensions[h]}`
  ).join(' | ');
  const mets = response.metadata.metricHeaders.map(h => 
    `${getMetricDisplayName(h)}: ${formatMetricValue(h, row.metrics[h])}`
  ).join(' | ');
  return `${index + 1}. ${dims}\n   ${mets}`;
}).join('\n\n')}

${response.rows.length > 15 ? `\n... and ${response.rows.length - 15} more active segments` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'summary') {
              formattedResponse = `🔴 **Real-time Analytics Summary**
**Updated**: ${currentTime}

📊 **Current Activity:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `**${getMetricDisplayName(metric)}**: ${formatted}`;
}).join('\n')}

📈 **Live Breakdown:**
${response.rows.slice(0, 8).map((row, index) => {
  const location = row.dimensions[GA4_DIMENSIONS.COUNTRY] || 'Unknown';
  const device = row.dimensions[GA4_DIMENSIONS.DEVICE_CATEGORY] || 'Unknown';
  const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE] || 'Unknown';
  const users = row.metrics[GA4_METRICS.ACTIVE_USERS] || 0;
  return `${index + 1}. **${location}** (${device}) via ${source} → ${users} active`;
}).join('\n')}

📊 **Metrics**: ${processedMetrics.map(getMetricDisplayName).join(' • ')}
⚡ **Performance**: ${response.requestInfo.executionTime}ms query time`;
            } else {
              // Live format (default) - optimized for real-time monitoring
              const activeUsers = response.totals[GA4_METRICS.ACTIVE_USERS] || 0;
              const pageViews = response.totals[GA4_METRICS.SCREEN_PAGE_VIEWS] || 0;
              const events = response.totals[GA4_METRICS.EVENT_COUNT] || 0;
              
              formattedResponse = `🔴 **LIVE GA4 Real-time Dashboard**
**${currentTime}** | ⚡ Updated in ${response.requestInfo.executionTime}ms

🔥 **RIGHT NOW:**
👥 **${activeUsers} Active Users**
📄 **${pageViews} Page Views** 
⚡ **${events} Events**

🌍 **Top Active Locations:**
${response.rows
  .filter(row => row.dimensions[GA4_DIMENSIONS.COUNTRY])
  .slice(0, 5)
  .map((row, index) => {
    const country = row.dimensions[GA4_DIMENSIONS.COUNTRY];
    const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
    return `${index + 1}. **${country}**: ${users} users`;
  }).join('\n')}

📱 **Device Breakdown:**
${response.rows
  .filter(row => row.dimensions[GA4_DIMENSIONS.DEVICE_CATEGORY])
  .slice(0, 3)
  .map((row, index) => {
    const device = row.dimensions[GA4_DIMENSIONS.DEVICE_CATEGORY];
    const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
    return `${device}: ${users}`;
  }).join(' • ')}

🚀 **Traffic Sources:**
${response.rows
  .filter(row => row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE])
  .slice(0, 3)
  .map((row, index) => {
    const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE];
    const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
    return `${source}: ${users}`;
  }).join(' • ')}

💡 **Real-time Options:**
- \`"format": "detailed"\` - Full breakdown
- \`"format": "summary"\` - Quick overview  
- \`"limit": 25\` - More results
- \`"sortBy": "activeUsers"\` - Custom sorting

🔄 *Refresh this tool to see updated live data*`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
          } catch (error) {
            logger.error('get_realtime_data tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **Real-time GA4 Data Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Real-time Specific Issues:**
- **Real-time API Access**: Ensure real-time reporting is enabled in GA4
- **Property Configuration**: Check if real-time data collection is active
- **API Permissions**: Verify real-time data access permissions
- **Data Availability**: Real-time data may have 1-4 minute delays
- **Quota Limits**: Real-time API has separate quota limits

**Available Real-time Metrics**: activeUsers, screenPageViews, eventCount
**Available Real-time Dimensions**: country, deviceCategory, source, pagePath

**Example Usage**:
\`\`\`json
{
  "metrics": ["activeUsers", "screenPageViews"],
  "dimensions": ["country", "deviceCategory"],
  "format": "live",
  "limit": 15
}
\`\`\`

**Troubleshooting**:
1. Check GA4 property settings for real-time reporting
2. Verify sufficient data activity (need active users)
3. Wait 2-4 minutes for data processing
4. Try with basic metrics: ["activeUsers"]`,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'get_traffic_sources':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              dateRange, 
              dateRanges, 
              limit, 
              sortBy, 
              sortDesc, 
              format,
              channelGrouping,
              includeGoogleAds,
              sourceMediumBreakdown
            } = args as {
              dateRange?: string | { startDate: string; endDate: string; name?: string };
              dateRanges?: Array<{ startDate: string; endDate: string; name?: string }>;
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              format?: 'summary' | 'detailed' | 'raw';
              channelGrouping?: boolean;
              includeGoogleAds?: boolean;
              sourceMediumBreakdown?: boolean;
            };
            
            // Enhanced traffic source parameter processing
            const processedLimit = Math.min(limit || 20, 1000);
            const outputFormat = format || 'summary';
            const useChannelGrouping = channelGrouping !== false; // Default true
            const includeAds = includeGoogleAds !== false; // Default true
            const detailedBreakdown = sourceMediumBreakdown !== false; // Default true
            
            // Smart date range processing
            let processedDateRanges;
            if (dateRange) {
              const parsed = typeof dateRange === 'string' ? parseDateRange(dateRange) : parseDateRange(dateRange);
              processedDateRanges = [parsed];
            } else if (dateRanges && dateRanges.length > 0) {
              processedDateRanges = dateRanges.map(range => parseDateRange(range));
            } else {
              processedDateRanges = [parseDateRange('30daysAgo')];
            }
            
            // Configure metrics for traffic source analysis
            const trafficMetrics = [
              GA4_METRICS.SESSIONS,
              GA4_METRICS.ACTIVE_USERS,
              GA4_METRICS.NEW_USERS,
              GA4_METRICS.BOUNCE_RATE,
              GA4_METRICS.AVERAGE_SESSION_DURATION
            ];
            
            // Configure dimensions based on breakdown requirements
            let trafficDimensions = [];
            if (useChannelGrouping) {
              trafficDimensions.push(GA4_DIMENSIONS.SESSION_DEFAULT_CHANNEL_GROUP);
            }
            if (detailedBreakdown) {
              trafficDimensions.push(GA4_DIMENSIONS.SESSION_SOURCE, GA4_DIMENSIONS.SESSION_MEDIUM);
            }
            if (trafficDimensions.length === 0) {
              // Fallback to basic source/medium
              trafficDimensions = [GA4_DIMENSIONS.SESSION_SOURCE, GA4_DIMENSIONS.SESSION_MEDIUM];
            }
            
            logger.info(`🔍 Traffic Sources Query: ${trafficMetrics.length} metrics, ${trafficDimensions.length} dimensions`);
            
            // Execute GA4 query
            let response = await ga4Client.runReport({
              propertyId: process.env.GA4_PROPERTY_ID!,
              metrics: trafficMetrics,
              dimensions: trafficDimensions,
              dateRanges: processedDateRanges,
              limit: processedLimit
            });
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Traffic sources sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging
            debugGA4Data(response, 'get_traffic_sources result');
            
            // Format response based on requested format
            let formattedResponse = '';
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw Traffic Sources Data**

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `🚀 **GA4 Traffic Sources - Detailed Analysis**

📊 **Analysis Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Period: ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- Channel Grouping: ${useChannelGrouping ? 'Enabled' : 'Disabled'}
- Source/Medium Breakdown: ${detailedBreakdown ? 'Enabled' : 'Disabled'}
- Google Ads Included: ${includeAds ? 'Yes' : 'No'}
- Total Sources: ${response.metadata.rowCount}
- Query Time: ${response.requestInfo.executionTime}ms

📈 **Traffic Overview:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

🔍 **Traffic Source Breakdown:**
${response.rows.slice(0, 15).map((row, index) => {
  const channelGroup = row.dimensions[GA4_DIMENSIONS.SESSION_DEFAULT_CHANNEL_GROUP] || 'Unknown';
  const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE] || 'Unknown';
  const medium = row.dimensions[GA4_DIMENSIONS.SESSION_MEDIUM] || 'Unknown';
  const sessions = formatMetricValue(GA4_METRICS.SESSIONS, row.metrics[GA4_METRICS.SESSIONS] || 0);
  const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
  const bounceRate = formatMetricValue(GA4_METRICS.BOUNCE_RATE, (row.metrics[GA4_METRICS.BOUNCE_RATE] || 0) * 100);
  
  return `${index + 1}. **${channelGroup}** | ${source}/${medium}
   📊 ${sessions} sessions | 👥 ${users} users | ⚡ ${bounceRate}% bounce rate`;
}).join('\n\n')}

${response.rows.length > 15 ? `\n... and ${response.rows.length - 15} more traffic sources` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else {
              // Summary format (default)
              const totalSessions = response.totals[GA4_METRICS.SESSIONS] || 0;
              const totalUsers = response.totals[GA4_METRICS.ACTIVE_USERS] || 0;
              const avgBounceRate = response.totals[GA4_METRICS.BOUNCE_RATE] || 0;
              
              formattedResponse = `🚀 **Traffic Sources Analysis**

📊 **Overview** (${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}):
- **Total Sessions**: ${formatMetricValue(GA4_METRICS.SESSIONS, totalSessions)}
- **Total Users**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, totalUsers)}
- **Average Bounce Rate**: ${formatMetricValue(GA4_METRICS.BOUNCE_RATE, avgBounceRate * 100)}%
- **Traffic Sources**: ${response.metadata.rowCount}

🎯 **Top Traffic Channels:**
${response.rows
  .filter(row => row.dimensions[GA4_DIMENSIONS.SESSION_DEFAULT_CHANNEL_GROUP])
  .slice(0, 8)
  .map((row, index) => {
    const channel = row.dimensions[GA4_DIMENSIONS.SESSION_DEFAULT_CHANNEL_GROUP];
    const sessions = formatMetricValue(GA4_METRICS.SESSIONS, row.metrics[GA4_METRICS.SESSIONS] || 0);
    const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
    const sessionPercent = totalSessions > 0 ? ((row.metrics[GA4_METRICS.SESSIONS] || 0) / totalSessions * 100).toFixed(1) : 0;
    return `${index + 1}. **${channel}**: ${sessions} sessions (${sessionPercent}%) | ${users} users`;
  }).join('\n')}

📈 **Source/Medium Breakdown:**
${response.rows
  .filter(row => row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE])
  .slice(0, 6)
  .map((row, index) => {
    const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE];
    const medium = row.dimensions[GA4_DIMENSIONS.SESSION_MEDIUM] || 'unknown';
    const sessions = formatMetricValue(GA4_METRICS.SESSIONS, row.metrics[GA4_METRICS.SESSIONS] || 0);
    return `${index + 1}. **${source}** / ${medium} → ${sessions} sessions`;
  }).join('\n')}

⚡ **Performance Insights:**
- Query executed in ${response.requestInfo.executionTime}ms
- Data ${response.requestInfo.fromCache ? 'served from cache' : 'freshly retrieved'}

💡 **Analysis Options:**
- Add \`"format": "detailed"\` for comprehensive breakdown
- Add \`"channelGrouping": false\` to focus on source/medium
- Add \`"sourceMediumBreakdown": false\` for channel-only view
- Use \`"sortBy": "sessions"\` to sort by traffic volume`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
          } catch (error) {
            logger.error('get_traffic_sources tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **Traffic Sources Analysis Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Common Issues & Solutions:**
- **Authentication**: Verify GA4_PROPERTY_ID and Google credentials
- **Data Availability**: Ensure sufficient traffic data exists for the date range
- **API Permissions**: Check GA4 property access and reporting permissions
- **Date Format**: Use YYYY-MM-DD format or presets like "30daysAgo"

**Available Traffic Dimensions**:
- Channel Grouping: sessionDefaultChannelGrouping
- Source/Medium: sessionSource, sessionMedium
- Campaign: sessionCampaignName, sessionManualAdContent

**Example Usage**:
\`\`\`json
{
  "dateRange": "30daysAgo",
  "format": "summary",
  "channelGrouping": true,
  "sourceMediumBreakdown": true,
  "limit": 20
}
\`\`\`

**Troubleshooting**:
1. Check GA4 property has sufficient traffic data
2. Verify date range contains data (not too recent or too old)
3. Try with basic parameters: {"dateRange": "30daysAgo"}
4. Ensure GA4 enhanced measurement is enabled`,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'get_user_demographics':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              dateRange, 
              dateRanges, 
              limit, 
              sortBy, 
              sortDesc, 
              format,
              includeAge,
              includeGender,
              includeLocation,
              detailedLocation
            } = args as {
              dateRange?: string | { startDate: string; endDate: string; name?: string };
              dateRanges?: Array<{ startDate: string; endDate: string; name?: string }>;
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              format?: 'summary' | 'detailed' | 'raw';
              includeAge?: boolean;
              includeGender?: boolean;
              includeLocation?: boolean;
              detailedLocation?: boolean;
            };
            
            // Enhanced user demographics parameter processing
            const processedLimit = Math.min(limit || 25, 1000);
            const outputFormat = format || 'summary';
            const showAge = includeAge !== false; // Default true
            const showGender = includeGender !== false; // Default true
            const showLocation = includeLocation !== false; // Default true
            const detailedGeo = detailedLocation === true; // Default false
            
            // Smart date range processing
            let processedDateRanges;
            if (dateRange) {
              const parsed = typeof dateRange === 'string' ? parseDateRange(dateRange) : parseDateRange(dateRange);
              processedDateRanges = [parsed];
            } else if (dateRanges && dateRanges.length > 0) {
              processedDateRanges = dateRanges.map(range => parseDateRange(range));
            } else {
              processedDateRanges = [parseDateRange('30daysAgo')];
            }
            
            // Configure metrics for demographic analysis
            const demographicMetrics = [
              GA4_METRICS.ACTIVE_USERS,
              GA4_METRICS.NEW_USERS,
              GA4_METRICS.SESSIONS,
              GA4_METRICS.ENGAGEMENT_RATE,
              GA4_METRICS.AVERAGE_SESSION_DURATION
            ];
            
            // Configure dimensions based on demographic requirements
            let demographicDimensions = [];
            if (showAge) {
              demographicDimensions.push(GA4_DIMENSIONS.USER_AGE_BRACKET);
            }
            if (showGender) {
              demographicDimensions.push(GA4_DIMENSIONS.USER_GENDER);
            }
            if (showLocation) {
              if (detailedGeo) {
                demographicDimensions.push(GA4_DIMENSIONS.COUNTRY, GA4_DIMENSIONS.REGION, GA4_DIMENSIONS.CITY);
              } else {
                demographicDimensions.push(GA4_DIMENSIONS.COUNTRY);
              }
            }
            
            // Fallback if no dimensions selected
            if (demographicDimensions.length === 0) {
              demographicDimensions = [GA4_DIMENSIONS.COUNTRY, GA4_DIMENSIONS.USER_AGE_BRACKET];
            }
            
            logger.info(`🔍 User Demographics Query: ${demographicMetrics.length} metrics, ${demographicDimensions.length} dimensions`);
            
            // Execute GA4 query
            let response = await ga4Client.runReport({
              propertyId: process.env.GA4_PROPERTY_ID!,
              metrics: demographicMetrics,
              dimensions: demographicDimensions,
              dateRanges: processedDateRanges,
              limit: processedLimit
            });
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Demographics sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging
            debugGA4Data(response, 'get_user_demographics result');
            
            // Format response based on requested format
            let formattedResponse = '';
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw User Demographics Data**

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `👥 **GA4 User Demographics - Detailed Analysis**

📊 **Demographic Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Period: ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- Age Brackets: ${showAge ? 'Included' : 'Excluded'}
- Gender Analysis: ${showGender ? 'Included' : 'Excluded'}
- Geographic Data: ${showLocation ? (detailedGeo ? 'Detailed (Country/Region/City)' : 'Country Only') : 'Excluded'}
- Total Segments: ${response.metadata.rowCount}
- Query Time: ${response.requestInfo.executionTime}ms

📈 **Audience Overview:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

👥 **Detailed Demographic Breakdown:**
${response.rows.slice(0, 20).map((row, index) => {
  const age = row.dimensions[GA4_DIMENSIONS.USER_AGE_BRACKET] || 'Unknown';
  const gender = row.dimensions[GA4_DIMENSIONS.USER_GENDER] || 'Unknown';
  const country = row.dimensions[GA4_DIMENSIONS.COUNTRY] || 'Unknown';
  const region = row.dimensions[GA4_DIMENSIONS.REGION] || '';
  const city = row.dimensions[GA4_DIMENSIONS.CITY] || '';
  const users = formatMetricValue(GA4_METRICS.ACTIVE_USERS, row.metrics[GA4_METRICS.ACTIVE_USERS] || 0);
  const engagement = formatMetricValue(GA4_METRICS.ENGAGEMENT_RATE, (row.metrics[GA4_METRICS.ENGAGEMENT_RATE] || 0) * 100);
  
  let location = country;
  if (region && detailedGeo) location += ` / ${region}`;
  if (city && detailedGeo) location += ` / ${city}`;
  
  return `${index + 1}. **${age}** | ${gender} | 🌍 ${location}
   👥 ${users} users | 💡 ${engagement}% engagement`;
}).join('\n\n')}

${response.rows.length > 20 ? `\n... and ${response.rows.length - 20} more demographic segments` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else {
              // Summary format (default)
              const totalUsers = response.totals[GA4_METRICS.ACTIVE_USERS] || 0;
              const totalSessions = response.totals[GA4_METRICS.SESSIONS] || 0;
              const avgEngagement = response.totals[GA4_METRICS.ENGAGEMENT_RATE] || 0;
              
              // Aggregate data by dimension for insights
              const ageBreakdown = new Map();
              const genderBreakdown = new Map();
              const countryBreakdown = new Map();
              
              response.rows.forEach(row => {
                const users = row.metrics[GA4_METRICS.ACTIVE_USERS] || 0;
                
                if (row.dimensions[GA4_DIMENSIONS.USER_AGE_BRACKET]) {
                  const age = row.dimensions[GA4_DIMENSIONS.USER_AGE_BRACKET];
                  ageBreakdown.set(age, (ageBreakdown.get(age) || 0) + users);
                }
                
                if (row.dimensions[GA4_DIMENSIONS.USER_GENDER]) {
                  const gender = row.dimensions[GA4_DIMENSIONS.USER_GENDER];
                  genderBreakdown.set(gender, (genderBreakdown.get(gender) || 0) + users);
                }
                
                if (row.dimensions[GA4_DIMENSIONS.COUNTRY]) {
                  const country = row.dimensions[GA4_DIMENSIONS.COUNTRY];
                  countryBreakdown.set(country, (countryBreakdown.get(country) || 0) + users);
                }
              });
              
              formattedResponse = `👥 **User Demographics Summary**

📊 **Audience Overview** (${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}):
- **Total Users**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, totalUsers)}
- **Total Sessions**: ${formatMetricValue(GA4_METRICS.SESSIONS, totalSessions)}
- **Engagement Rate**: ${formatMetricValue(GA4_METRICS.ENGAGEMENT_RATE, avgEngagement * 100)}%
- **Demographic Segments**: ${response.metadata.rowCount}

${showAge && ageBreakdown.size > 0 ? `
🎂 **Age Distribution:**
${Array.from(ageBreakdown.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([age, users]) => {
    const percent = totalUsers > 0 ? (users / totalUsers * 100).toFixed(1) : 0;
    return `**${age}**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, users)} users (${percent}%)`;
  }).join('\n')}` : ''}

${showGender && genderBreakdown.size > 0 ? `
⚥ **Gender Breakdown:**
${Array.from(genderBreakdown.entries())
  .sort((a, b) => b[1] - a[1])
  .map(([gender, users]) => {
    const percent = totalUsers > 0 ? (users / totalUsers * 100).toFixed(1) : 0;
    return `**${gender}**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, users)} users (${percent}%)`;
  }).join('\n')}` : ''}

${showLocation && countryBreakdown.size > 0 ? `
🌍 **Top Countries:**
${Array.from(countryBreakdown.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([country, users]) => {
    const percent = totalUsers > 0 ? (users / totalUsers * 100).toFixed(1) : 0;
    return `**${country}**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, users)} users (${percent}%)`;
  }).join('\n')}` : ''}

⚡ **Insights:**
- Query executed in ${response.requestInfo.executionTime}ms
- Data ${response.requestInfo.fromCache ? 'served from cache' : 'freshly retrieved'}

💡 **Demographic Options:**
- Add \`"format": "detailed"\` for comprehensive breakdown
- Add \`"detailedLocation": true\` for city/region data
- Add \`"includeAge": false\` to exclude age analysis
- Use \`"sortBy": "activeUsers"\` to sort by audience size`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
          } catch (error) {
            logger.error('get_user_demographics tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **User Demographics Analysis Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Common Issues & Solutions:**
- **Demographics Data**: GA4 demographics require sufficient data and user consent
- **Authentication**: Verify GA4_PROPERTY_ID and Google credentials  
- **Data Collection**: Ensure Google signals and demographics reporting are enabled
- **Sample Size**: Demographics need significant traffic volume to be available
- **Privacy**: Some demographic data may be withheld due to privacy thresholds

**Available Demographic Dimensions**:
- Age Brackets: userAgeBracket (18-24, 25-34, 35-44, 45-54, 55-64, 65+)
- Gender: userGender (male, female, (not set))
- Geography: country, region, city

**Example Usage**:
\`\`\`json
{
  "dateRange": "30daysAgo",
  "format": "summary",
  "includeAge": true,
  "includeGender": true,
  "includeLocation": true,
  "detailedLocation": false
}
\`\`\`

**Troubleshooting**:
1. Verify GA4 property has Google signals enabled
2. Check demographic data collection settings in GA4
3. Ensure sufficient traffic volume (typically 1000+ users)
4. Try longer date ranges: {"dateRange": "90daysAgo"}
5. Enable demographics reporting in GA4 property settings`,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'get_page_performance':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              dateRange, 
              dateRanges, 
              limit, 
              sortBy, 
              sortDesc, 
              format,
              includeBounceRate,
              includeExitRate,
              includeTimeOnPage,
              pagePathFilter
            } = args as {
              dateRange?: string | { startDate: string; endDate: string; name?: string };
              dateRanges?: Array<{ startDate: string; endDate: string; name?: string }>;
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              format?: 'summary' | 'detailed' | 'raw';
              includeBounceRate?: boolean;
              includeExitRate?: boolean;
              includeTimeOnPage?: boolean;
              pagePathFilter?: string;
            };
            
            // Enhanced page performance parameter processing
            const processedLimit = Math.min(limit || 30, 1000);
            const outputFormat = format || 'summary';
            const showBounceRate = includeBounceRate !== false; // Default true
            const showExitRate = includeExitRate !== false; // Default true
            const showTimeOnPage = includeTimeOnPage !== false; // Default true
            
            // Smart date range processing
            let processedDateRanges;
            if (dateRange) {
              const parsed = typeof dateRange === 'string' ? parseDateRange(dateRange) : parseDateRange(dateRange);
              processedDateRanges = [parsed];
            } else if (dateRanges && dateRanges.length > 0) {
              processedDateRanges = dateRanges.map(range => parseDateRange(range));
            } else {
              processedDateRanges = [parseDateRange('30daysAgo')];
            }
            
            // Configure metrics for page performance analysis
            let performanceMetrics: string[] = [
              GA4_METRICS.SCREEN_PAGE_VIEWS,
              GA4_METRICS.UNIQUE_USERS,
              GA4_METRICS.AVERAGE_SESSION_DURATION
            ];
            
            if (showBounceRate) {
              performanceMetrics.push(GA4_METRICS.BOUNCE_RATE);
            }
            if (showExitRate) {
              performanceMetrics.push(GA4_METRICS.EXIT_RATE);
            }
            if (showTimeOnPage) {
              performanceMetrics.push(GA4_METRICS.USER_ENGAGEMENT_DURATION);
            }
            
            // Configure dimensions for page analysis
            const performanceDimensions = [
              GA4_DIMENSIONS.PAGE_PATH,
              GA4_DIMENSIONS.PAGE_TITLE,
              GA4_DIMENSIONS.LANDING_PAGE
            ];
            
            logger.info(`🔍 Page Performance Query: ${performanceMetrics.length} metrics, ${performanceDimensions.length} dimensions`);
            
            // Execute GA4 query
            let response = await ga4Client.runReport({
              propertyId: process.env.GA4_PROPERTY_ID!,
              metrics: performanceMetrics,
              dimensions: performanceDimensions,
              dateRanges: processedDateRanges,
              limit: processedLimit
            });
            
            // Apply page path filtering if specified
            if (pagePathFilter) {
              const originalRowCount = response.rows.length;
              response.rows = response.rows.filter(row => {
                const pagePath = row.dimensions[GA4_DIMENSIONS.PAGE_PATH] || '';
                return pagePath.toLowerCase().includes(pagePathFilter.toLowerCase());
              });
              response.metadata.rowCount = response.rows.length;
              logger.info(`🔍 Filtered pages by "${pagePathFilter}": ${originalRowCount} → ${response.rows.length} pages`);
            }
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Pages sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging
            debugGA4Data(response, 'get_page_performance result');
            
            // Format response based on requested format
            let formattedResponse = '';
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw Page Performance Data**

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `📊 **GA4 Page Performance - Detailed Analysis**

📈 **Performance Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Period: ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- Bounce Rate Analysis: ${showBounceRate ? 'Included' : 'Excluded'}
- Exit Rate Analysis: ${showExitRate ? 'Included' : 'Excluded'}
- Time on Page Analysis: ${showTimeOnPage ? 'Included' : 'Excluded'}
- Page Filter: ${pagePathFilter || 'None'}
- Total Pages: ${response.metadata.rowCount}
- Query Time: ${response.requestInfo.executionTime}ms

📈 **Overall Performance:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

📊 **Detailed Page Analysis:**
${response.rows.slice(0, 20).map((row, index) => {
  const pagePath = row.dimensions[GA4_DIMENSIONS.PAGE_PATH] || 'Unknown';
  const pageTitle = row.dimensions[GA4_DIMENSIONS.PAGE_TITLE] || 'No Title';
  const isLanding = row.dimensions[GA4_DIMENSIONS.LANDING_PAGE] || 'No';
  const pageViews = formatMetricValue(GA4_METRICS.SCREEN_PAGE_VIEWS, row.metrics[GA4_METRICS.SCREEN_PAGE_VIEWS] || 0);
  const uniqueUsers = formatMetricValue(GA4_METRICS.UNIQUE_USERS, row.metrics[GA4_METRICS.UNIQUE_USERS] || 0);
  const bounceRate = showBounceRate ? formatMetricValue(GA4_METRICS.BOUNCE_RATE, (row.metrics[GA4_METRICS.BOUNCE_RATE] || 0) * 100) + '%' : 'N/A';
  
  return `${index + 1}. **${pagePath}**
   📄 ${pageTitle.substring(0, 50)}${pageTitle.length > 50 ? '...' : ''}
   📊 ${pageViews} views | 👥 ${uniqueUsers} users | ⚡ ${bounceRate} bounce rate
   🏠 Landing Page: ${isLanding}`;
}).join('\n\n')}

${response.rows.length > 20 ? `\n... and ${response.rows.length - 20} more pages` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else {
              // Summary format (default)
              const totalPageViews = response.totals[GA4_METRICS.SCREEN_PAGE_VIEWS] || 0;
              const totalUsers = response.totals[GA4_METRICS.UNIQUE_USERS] || 0;
              const avgBounceRate = showBounceRate ? response.totals[GA4_METRICS.BOUNCE_RATE] || 0 : null;
              const avgSessionDuration = response.totals[GA4_METRICS.AVERAGE_SESSION_DURATION] || 0;
              
              formattedResponse = `📊 **Page Performance Analysis**

📈 **Overview** (${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}):
- **Total Page Views**: ${formatMetricValue(GA4_METRICS.SCREEN_PAGE_VIEWS, totalPageViews)}
- **Unique Visitors**: ${formatMetricValue(GA4_METRICS.UNIQUE_USERS, totalUsers)}
${avgBounceRate !== null ? `- **Average Bounce Rate**: ${formatMetricValue(GA4_METRICS.BOUNCE_RATE, avgBounceRate * 100)}%` : ''}
- **Avg Session Duration**: ${formatMetricValue(GA4_METRICS.AVERAGE_SESSION_DURATION, avgSessionDuration)}
- **Pages Analyzed**: ${response.metadata.rowCount}

🏆 **Top Performing Pages:**
${response.rows
  .slice(0, 10)
  .map((row, index) => {
    const pagePath = row.dimensions[GA4_DIMENSIONS.PAGE_PATH] || 'Unknown';
    const pageViews = formatMetricValue(GA4_METRICS.SCREEN_PAGE_VIEWS, row.metrics[GA4_METRICS.SCREEN_PAGE_VIEWS] || 0);
    const uniqueUsers = formatMetricValue(GA4_METRICS.UNIQUE_USERS, row.metrics[GA4_METRICS.UNIQUE_USERS] || 0);
    const viewsPercent = totalPageViews > 0 ? ((row.metrics[GA4_METRICS.SCREEN_PAGE_VIEWS] || 0) / totalPageViews * 100).toFixed(1) : 0;
    return `${index + 1}. **${pagePath}** → ${pageViews} views (${viewsPercent}%) | ${uniqueUsers} users`;
  }).join('\n')}

${showBounceRate ? `
🎯 **Content Quality Insights:**
${response.rows
  .filter(row => row.metrics[GA4_METRICS.BOUNCE_RATE] !== undefined)
  .sort((a, b) => (a.metrics[GA4_METRICS.BOUNCE_RATE] || 1) - (b.metrics[GA4_METRICS.BOUNCE_RATE] || 1))
  .slice(0, 5)
  .map((row, index) => {
    const pagePath = row.dimensions[GA4_DIMENSIONS.PAGE_PATH] || 'Unknown';
    const bounceRate = formatMetricValue(GA4_METRICS.BOUNCE_RATE, (row.metrics[GA4_METRICS.BOUNCE_RATE] || 0) * 100);
    return `${index + 1}. **${pagePath}** → ${bounceRate}% bounce rate`;
  }).join('\n')}` : ''}

⚡ **Performance Insights:**
- Query executed in ${response.requestInfo.executionTime}ms
- Data ${response.requestInfo.fromCache ? 'served from cache' : 'freshly retrieved'}

💡 **Analysis Options:**
- Add \`"format": "detailed"\` for comprehensive page breakdown
- Add \`"pagePathFilter": "/blog"\` to focus on specific page sections
- Add \`"includeBounceRate": false\` to exclude bounce rate analysis
- Use \`"sortBy": "screenPageViews"\` to sort by page views`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
          } catch (error) {
            logger.error('get_page_performance tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **Page Performance Analysis Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Common Issues & Solutions:**
- **Authentication**: Verify GA4_PROPERTY_ID and Google credentials
- **Page Data**: Ensure GA4 enhanced measurement for page tracking is enabled
- **Data Availability**: Check that pages have sufficient traffic for analysis
- **Date Range**: Verify date range contains page view data

**Available Page Metrics**:
- Page Views: screenPageViews, views
- User Engagement: bounceRate, exitRate, averageSessionDuration
- User Analysis: uniqueUsers, sessions

**Available Page Dimensions**:
- Page Content: pagePath, pageTitle, pageLocation
- User Journey: landingPage, exitPage

**Example Usage**:
\`\`\`json
{
  "dateRange": "30daysAgo",
  "format": "summary",
  "includeBounceRate": true,
  "includeExitRate": true,
  "pagePathFilter": "/blog",
  "limit": 25
}
\`\`\`

**Troubleshooting**:
1. Verify GA4 enhanced measurement includes page views
2. Check that sufficient page traffic exists for the date range
3. Try basic parameters: {"dateRange": "30daysAgo"}
4. Ensure GA4 page tracking is properly configured`,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'get_conversion_data':
          try {
            const ga4Client = getGA4DataClient();
            const { 
              dateRange, 
              dateRanges, 
              limit, 
              sortBy, 
              sortDesc, 
              format,
              includeGoals,
              includeEcommerce,
              conversionEventFilter,
              includeConversionValue
            } = args as {
              dateRange?: string | { startDate: string; endDate: string; name?: string };
              dateRanges?: Array<{ startDate: string; endDate: string; name?: string }>;
              limit?: number;
              sortBy?: string;
              sortDesc?: boolean;
              format?: 'summary' | 'detailed' | 'raw';
              includeGoals?: boolean;
              includeEcommerce?: boolean;
              conversionEventFilter?: string;
              includeConversionValue?: boolean;
            };
            
            // Enhanced conversion data parameter processing
            const processedLimit = Math.min(limit || 20, 1000);
            const outputFormat = format || 'summary';
            const showGoals = includeGoals !== false; // Default true
            const showEcommerce = includeEcommerce !== false; // Default true
            const showValue = includeConversionValue !== false; // Default true
            
            // Smart date range processing
            let processedDateRanges;
            if (dateRange) {
              const parsed = typeof dateRange === 'string' ? parseDateRange(dateRange) : parseDateRange(dateRange);
              processedDateRanges = [parsed];
            } else if (dateRanges && dateRanges.length > 0) {
              processedDateRanges = dateRanges.map(range => parseDateRange(range));
            } else {
              processedDateRanges = [parseDateRange('30daysAgo')];
            }
            
            // Configure metrics for conversion analysis
            let conversionMetrics: string[] = [
              GA4_METRICS.CONVERSIONS,
              GA4_METRICS.CONVERSION_RATE,
              GA4_METRICS.SESSIONS,
              GA4_METRICS.ACTIVE_USERS
            ];
            
            if (showGoals) {
              conversionMetrics.push(GA4_METRICS.GOAL_COMPLETIONS, GA4_METRICS.GOAL_COMPLETION_RATE);
            }
            if (showEcommerce) {
              conversionMetrics.push(GA4_METRICS.ECOMMERCE_PURCHASES, GA4_METRICS.PURCHASE_REVENUE);
            }
            if (showValue) {
              conversionMetrics.push(GA4_METRICS.CONVERSION_VALUE, GA4_METRICS.TOTAL_REVENUE);
            }
            
            // Configure dimensions for conversion analysis
            const conversionDimensions = [
              GA4_DIMENSIONS.EVENT_NAME,
              GA4_DIMENSIONS.SESSION_SOURCE,
              GA4_DIMENSIONS.SESSION_MEDIUM,
              GA4_DIMENSIONS.SESSION_CAMPAIGN_NAME
            ];
            
            logger.info(`🔍 Conversion Data Query: ${conversionMetrics.length} metrics, ${conversionDimensions.length} dimensions`);
            
            // Execute GA4 query
            let response = await ga4Client.runReport({
              propertyId: process.env.GA4_PROPERTY_ID!,
              metrics: conversionMetrics,
              dimensions: conversionDimensions,
              dateRanges: processedDateRanges,
              limit: processedLimit
            });
            
            // Apply conversion event filtering if specified
            if (conversionEventFilter) {
              const originalRowCount = response.rows.length;
              response.rows = response.rows.filter(row => {
                const eventName = row.dimensions[GA4_DIMENSIONS.EVENT_NAME] || '';
                return eventName.toLowerCase().includes(conversionEventFilter.toLowerCase());
              });
              response.metadata.rowCount = response.rows.length;
              logger.info(`🔍 Filtered conversions by "${conversionEventFilter}": ${originalRowCount} → ${response.rows.length} events`);
            }
            
            // Apply sorting if specified
            if (sortBy) {
              response = sortGA4Data(response, sortBy, sortDesc !== false);
              logger.info(`📊 Conversions sorted by ${sortBy} (${sortDesc !== false ? 'desc' : 'asc'})`);
            }
            
            // Debug logging
            debugGA4Data(response, 'get_conversion_data result');
            
            // Format response based on requested format
            let formattedResponse = '';
            
            if (outputFormat === 'raw') {
              formattedResponse = `📋 **Raw Conversion Data**

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else if (outputFormat === 'detailed') {
              formattedResponse = `🎯 **GA4 Conversion Data - Detailed Analysis**

🎯 **Conversion Configuration:**
- Property ID: ${process.env.GA4_PROPERTY_ID}
- Period: ${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}
- Goal Tracking: ${showGoals ? 'Included' : 'Excluded'}
- E-commerce Tracking: ${showEcommerce ? 'Included' : 'Excluded'}
- Conversion Values: ${showValue ? 'Included' : 'Excluded'}
- Event Filter: ${conversionEventFilter || 'None'}
- Total Conversion Events: ${response.metadata.rowCount}
- Query Time: ${response.requestInfo.executionTime}ms

📊 **Overall Conversion Performance:**
${response.metadata.metricHeaders.map(metric => {
  const value = response.totals[metric];
  const formatted = formatMetricValue(metric, value);
  return `- ${getMetricDisplayName(metric)}: ${formatted}`;
}).join('\n')}

🎯 **Detailed Conversion Analysis:**
${response.rows.slice(0, 15).map((row, index) => {
  const eventName = row.dimensions[GA4_DIMENSIONS.EVENT_NAME] || 'Unknown Event';
  const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE] || 'Unknown';
  const medium = row.dimensions[GA4_DIMENSIONS.SESSION_MEDIUM] || 'Unknown';
  const campaign = row.dimensions[GA4_DIMENSIONS.SESSION_CAMPAIGN_NAME] || 'Unknown';
  const conversions = formatMetricValue(GA4_METRICS.CONVERSIONS, row.metrics[GA4_METRICS.CONVERSIONS] || 0);
  const conversionRate = formatMetricValue(GA4_METRICS.CONVERSION_RATE, (row.metrics[GA4_METRICS.CONVERSION_RATE] || 0) * 100);
  const conversionValue = showValue ? formatMetricValue(GA4_METRICS.CONVERSION_VALUE, row.metrics[GA4_METRICS.CONVERSION_VALUE] || 0) : 'N/A';
  
  return `${index + 1}. **${eventName}**
   🎯 ${conversions} conversions | 📈 ${conversionRate}% rate | 💰 $${conversionValue} value
   📊 Source: ${source}/${medium} | Campaign: ${campaign}`;
}).join('\n\n')}

${response.rows.length > 15 ? `\n... and ${response.rows.length - 15} more conversion events` : ''}

📋 **Raw Data (JSON):**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``;
            } else {
              // Summary format (default)
              const totalConversions = response.totals[GA4_METRICS.CONVERSIONS] || 0;
              const avgConversionRate = response.totals[GA4_METRICS.CONVERSION_RATE] || 0;
              const totalRevenue = showValue ? response.totals[GA4_METRICS.TOTAL_REVENUE] || 0 : null;
              const totalSessions = response.totals[GA4_METRICS.SESSIONS] || 0;
              const totalUsers = response.totals[GA4_METRICS.ACTIVE_USERS] || 0;
              
              // Aggregate conversion data by event type
              const eventBreakdown = new Map();
              const sourceBreakdown = new Map();
              
              response.rows.forEach(row => {
                const conversions = row.metrics[GA4_METRICS.CONVERSIONS] || 0;
                
                if (row.dimensions[GA4_DIMENSIONS.EVENT_NAME]) {
                  const eventName = row.dimensions[GA4_DIMENSIONS.EVENT_NAME];
                  eventBreakdown.set(eventName, (eventBreakdown.get(eventName) || 0) + conversions);
                }
                
                if (row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE]) {
                  const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE];
                  sourceBreakdown.set(source, (sourceBreakdown.get(source) || 0) + conversions);
                }
              });
              
              formattedResponse = `🎯 **Conversion Performance Summary**

📊 **Conversion Overview** (${response.dateRanges.map(dr => dr.name || `${dr.startDate} to ${dr.endDate}`).join(', ')}):
- **Total Conversions**: ${formatMetricValue(GA4_METRICS.CONVERSIONS, totalConversions)}
- **Conversion Rate**: ${formatMetricValue(GA4_METRICS.CONVERSION_RATE, avgConversionRate * 100)}%
${totalRevenue !== null ? `- **Total Revenue**: $${formatMetricValue(GA4_METRICS.TOTAL_REVENUE, totalRevenue)}` : ''}
- **Converting Sessions**: ${formatMetricValue(GA4_METRICS.SESSIONS, totalSessions)}
- **Converting Users**: ${formatMetricValue(GA4_METRICS.ACTIVE_USERS, totalUsers)}
- **Conversion Events**: ${response.metadata.rowCount}

🎯 **Top Conversion Events:**
${Array.from(eventBreakdown.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([eventName, conversions], index) => {
    const percent = totalConversions > 0 ? (conversions / totalConversions * 100).toFixed(1) : 0;
    return `${index + 1}. **${eventName}**: ${formatMetricValue(GA4_METRICS.CONVERSIONS, conversions)} conversions (${percent}%)`;
  }).join('\n')}

📈 **Top Converting Sources:**
${Array.from(sourceBreakdown.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([source, conversions], index) => {
    const percent = totalConversions > 0 ? (conversions / totalConversions * 100).toFixed(1) : 0;
    return `${index + 1}. **${source}**: ${formatMetricValue(GA4_METRICS.CONVERSIONS, conversions)} conversions (${percent}%)`;
  }).join('\n')}

🏆 **Conversion Quality Insights:**
${response.rows
  .filter(row => row.metrics[GA4_METRICS.CONVERSION_RATE] > 0)
  .sort((a, b) => (b.metrics[GA4_METRICS.CONVERSION_RATE] || 0) - (a.metrics[GA4_METRICS.CONVERSION_RATE] || 0))
  .slice(0, 5)
  .map((row, index) => {
    const eventName = row.dimensions[GA4_DIMENSIONS.EVENT_NAME] || 'Unknown';
    const conversionRate = formatMetricValue(GA4_METRICS.CONVERSION_RATE, (row.metrics[GA4_METRICS.CONVERSION_RATE] || 0) * 100);
    const source = row.dimensions[GA4_DIMENSIONS.SESSION_SOURCE] || 'Unknown';
    return `${index + 1}. **${eventName}** (${source}) → ${conversionRate}% conversion rate`;
  }).join('\n')}

⚡ **Performance Insights:**
- Query executed in ${response.requestInfo.executionTime}ms
- Data ${response.requestInfo.fromCache ? 'served from cache' : 'freshly retrieved'}

💡 **Conversion Options:**
- Add \`"format": "detailed"\` for comprehensive conversion breakdown
- Add \`"conversionEventFilter": "purchase"\` to focus on specific conversion types
- Add \`"includeEcommerce": false\` to exclude e-commerce conversions
- Use \`"sortBy": "conversions"\` to sort by conversion volume`;
            }
            
            result = {
              content: [
                {
                  type: 'text',
                  text: formattedResponse,
                },
              ],
            };
          } catch (error) {
            logger.error('get_conversion_data tool failed', error instanceof Error ? error : undefined);
            result = {
              content: [
                {
                  type: 'text',
                  text: `❌ **Conversion Data Analysis Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Common Issues & Solutions:**
- **Conversion Tracking**: Ensure GA4 conversion events are properly configured
- **Authentication**: Verify GA4_PROPERTY_ID and Google credentials
- **Data Availability**: Check that conversion events have sufficient data for the date range
- **Event Configuration**: Verify conversion events are marked as conversions in GA4

**Available Conversion Metrics**:
- Conversions: conversions, conversionRate
- Goals: goalCompletions, goalCompletionRate  
- E-commerce: ecommercePurchases, purchaseRevenue
- Values: conversionValue, totalRevenue

**Available Conversion Dimensions**:
- Events: eventName, conversionEvent
- Attribution: sessionSource, sessionMedium, sessionCampaignName
- Goals: goalName

**Example Usage**:
\`\`\`json
{
  "dateRange": "30daysAgo",
  "format": "summary",
  "includeGoals": true,
  "includeEcommerce": true,
  "conversionEventFilter": "purchase",
  "limit": 20
}
\`\`\`

**Troubleshooting**:
1. Verify conversion events are configured in GA4 Admin > Events > Conversions
2. Check that conversion events have fired during the date range
3. Ensure enhanced e-commerce is enabled if tracking purchases
4. Try basic parameters: {"dateRange": "30daysAgo"}
5. Verify conversion tracking setup in GA4`,
                },
              ],
              isError: true,
            };
          }
          break;

        default:
          const unknownToolError = MCPErrorHandler.createError(
            ErrorCode.METHOD_NOT_FOUND,
            `Unknown tool: ${name}`,
            { toolName: name, availableTools: ['query_analytics', 'get_realtime_data', 'get_traffic_sources', 'get_user_demographics', 'get_page_performance', 'get_conversion_data'] }
          );
          throw unknownToolError;
      }

      // Track successful tool execution
      const responseTime = Date.now() - requestStartTime;
      performanceMonitor.recordResponseTime(responseTime, 'mcp');
      performanceMonitor.incrementCounter('ga4_api_calls_total', { tool: name });

      logger.debug(`Tool execution completed: ${name}`);
      
      // Log successful tool execution with production logger
      mcpLogging.logSuccess(result);
      
      logger.requestEnd(requestId, timer.end(), true);
      
      return result;
      
    } catch (error) {
      // Track failed tool execution
      const responseTime = Date.now() - requestStartTime;
      performanceMonitor.recordResponseTime(responseTime, 'mcp');
      performanceMonitor.incrementCounter('ga4_api_errors_total', { tool: name });

      const mcpError = MCPErrorHandler.handleError(error, requestId);
      MCPErrorHandler.logError(mcpError);
      
      // Log failed tool execution with production logger
      mcpLogging.logError(error instanceof Error ? error : new Error(String(error)));
      
      logger.requestEnd(requestId, timer.end(), false);
      
      return MCPErrorHandler.formatForMCPResponse(mcpError);
    }
  });

  return server;
}

/**
 * Main function to start the MCP server
 */
async function main(): Promise<void> {
  try {
    // Initialize production logging
    const startupCorrelationId = setCorrelationId();
    productionLogger.info('🚀 Starting GA4 Analytics MCP Server...', {
      correlationId: startupCorrelationId,
      component: 'STARTUP',
      environment: process.env.NODE_ENV || 'development',
      loggerConfig,
    });
    
    logger.info('🚀 Starting GA4 Analytics MCP Server...');
    
    // Create server instance
    const server = await createServer();
    const transport = new StdioServerTransport();
    
    // Add transport connection to lifecycle
    lifecycleManager.addHook({
      name: 'mcp-transport',
      priority: 10,
      startup: async () => {
        logger.info('Connecting MCP transport...');
        await server.connect(transport);
        logger.info('✅ MCP transport connected successfully');
      },
      shutdown: async () => {
        logger.info('Disconnecting MCP transport...');
        // Note: MCP SDK doesn't provide explicit disconnect method
        // Connection will be closed when process exits
      },
    });
    
    // Start the server using lifecycle manager
    await lifecycleManager.startup();
    
    logger.info('🎉 GA4 Analytics MCP Server is running and ready to accept requests');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    const mcpError = MCPErrorHandler.handleError(error);
    MCPErrorHandler.logError(mcpError);
    logger.error('❌ Failed to start MCP server', error instanceof Error ? error : new Error(String(error)));
    
    // Attempt graceful shutdown even on startup failure
    try {
      await lifecycleManager.shutdown();
    } catch (shutdownError) {
      logger.error('Error during emergency shutdown', shutdownError instanceof Error ? shutdownError : new Error(String(shutdownError)));
    }
    
    process.exit(1);
  }
}

// Start the server if this file is run directly
import { fileURLToPath } from 'url';
const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === currentFile;

if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}