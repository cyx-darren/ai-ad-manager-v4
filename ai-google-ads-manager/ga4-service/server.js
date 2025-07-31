/**
 * GA4 API Service Server
 * Phase 5.5.4: Enhanced with comprehensive logging, monitoring, and health checks
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ga4DataClient } = require('./utils/ga4DataClient');
const logger = require('./utils/logger');

// Import routes
const ga4Routes = require('./routes/ga4Routes');
const authRoutes = require('./routes/authRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Import middleware
const authMiddleware = require('./middleware/auth');
const { autoRefreshTokenMiddleware } = require('./utils/tokenManager');
const { 
  rateLimitHeadersMiddleware, 
  quotaMonitoringMiddleware 
} = require('./middleware/rateLimitMiddleware');
const {
  createPerformanceMiddleware,
  errorTrackingMiddleware
} = require('./middleware/performanceMiddleware');

const app = express();
const PORT = process.env.PORT || 3001;

// Subtask 5.5.4: Enhanced performance monitoring middleware
app.use(createPerformanceMiddleware());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: [
    'X-Total-Count', 
    'X-Token-Warning',
    'X-Request-ID',
    'X-Response-Time',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-Service-Health',
    'X-Service-Version'
  ]
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global token refresh middleware
app.use(autoRefreshTokenMiddleware);

// Subtask 5.5.2: Comprehensive rate limiting and quota monitoring
app.use(rateLimitHeadersMiddleware);
app.use(quotaMonitoringMiddleware);

// Mount routes with authentication
app.use('/auth', authRoutes);
app.use('/cache', cacheRoutes); // Cache management routes
app.use('/health', healthRoutes); // Comprehensive health check routes
app.use('/api/ga4', authMiddleware, ga4Routes); // GA4 routes protected by auth

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    requestId: req.requestId,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Subtask 5.5.4: Enhanced error handling with structured logging
app.use(errorTrackingMiddleware);

// Global error handler
app.use((error, req, res, next) => {
  // Error already logged by errorTrackingMiddleware
  
  res.status(error.status || 500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Initialize server
async function startServer() {
  try {
    logger.info('Starting GA4 API Service...', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      features: {
        structuredLogging: true,
        performanceMonitoring: true,
        healthChecks: true,
        errorHandling: true,
        rateLimiting: true,
        quotaManagement: true
      }
    });

    // Initialize GA4DataClient with Redis caching
    logger.info('Initializing GA4DataClient with caching...');
    const ga4Initialized = await ga4DataClient.initialize();
    
    if (!ga4Initialized) {
      logger.error('Failed to initialize GA4DataClient - server will still start but GA4 functionality may be limited');
    } else {
      logger.info('GA4DataClient initialized successfully', {
        cacheEnabled: ga4DataClient.cacheEnabled,
        isInitialized: ga4DataClient.isInitialized
      });
    }

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info('GA4 API Service running', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`,
        detailedHealth: `http://localhost:${PORT}/health/detailed`,
        cacheEnabled: ga4DataClient.cacheEnabled,
        features: {
          'OAuth 2.0': true,
          'Token Management': true,
          'Rate Limiting': true,
          'Quota Management': true,
          'Redis Caching': ga4DataClient.cacheEnabled,
          'Cache Management': true,
          'Structured Logging': true,
          'Performance Monitoring': true,
          'Health Checks': true,
          'Error Handling': true
        }
      });
      
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Available endpoints', {
          // Core GA4 API endpoints
          ga4Sessions: `http://localhost:${PORT}/api/ga4/sessions/:propertyId`,
          ga4Users: `http://localhost:${PORT}/api/ga4/users/:propertyId`,
          ga4Traffic: `http://localhost:${PORT}/api/ga4/traffic-sources/:propertyId`,
          ga4Pages: `http://localhost:${PORT}/api/ga4/page-performance/:propertyId`,
          ga4Conversions: `http://localhost:${PORT}/api/ga4/conversions/:propertyId`,
          
          // Authentication endpoints
          authLogin: `http://localhost:${PORT}/auth/login`,
          authStatus: `http://localhost:${PORT}/auth/status`,
          
          // Health check endpoints (Phase 5.5.4)
          health: `http://localhost:${PORT}/health`,
          healthDetailed: `http://localhost:${PORT}/health/detailed`,
          healthReady: `http://localhost:${PORT}/health/ready`,
          healthLive: `http://localhost:${PORT}/health/live`,
          healthMetrics: `http://localhost:${PORT}/health/metrics`,
          healthHistory: `http://localhost:${PORT}/health/history`,
          healthStatus: `http://localhost:${PORT}/health/status`,
          
          // Cache management endpoints
          cacheStatus: `http://localhost:${PORT}/cache/status`,
          cacheHealth: `http://localhost:${PORT}/cache/health`,
          cacheMetrics: `http://localhost:${PORT}/cache/metrics`,
          cachePerformance: `http://localhost:${PORT}/cache/performance`,
          
          // Rate limiting and quota endpoints
          rateLimits: `http://localhost:${PORT}/cache/rate-limits`,
          quotaStatus: `http://localhost:${PORT}/cache/quota-status`,
          quotaAlerts: `http://localhost:${PORT}/cache/quota-alerts`,
          rateLimitConfig: `http://localhost:${PORT}/cache/rate-limit-config`,
          
          // Development endpoints
          errorStats: `http://localhost:${PORT}/cache/error-stats-dev`,
          testRateLimit: `http://localhost:${PORT}/cache/rate-limit-test-dev`,
          testError: `http://localhost:${PORT}/cache/test-error-dev`,
          quotaReset: `http://localhost:${PORT}/cache/quota-reset-dev`
        });
      }

      // Log system startup metrics
      const systemMetrics = logger.performance.getSystemMetrics();
      logger.info('System startup metrics', {
        memoryUsage: `${systemMetrics.memory.current}MB`,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`, {
        signal,
        uptime: Math.round(process.uptime()),
        totalRequests: logger.performance.getSystemMetrics().requests.total
      });
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close Redis connection if available
        try {
          const { redisClient } = require('./utils/redisClient');
          await redisClient.disconnect();
          logger.info('Redis connection closed');
        } catch (redisError) {
          logger.warn('Redis disconnect error', { error: redisError.message });
        }
        
        // Log final system metrics
        const finalMetrics = logger.performance.getSystemMetrics();
        logger.info('Final system metrics', {
          totalRequests: finalMetrics.requests.total,
          errorCount: finalMetrics.requests.errors,
          uptime: finalMetrics.uptime,
          peakMemory: `${finalMetrics.memory.peak}MB`
        });
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
      port: PORT,
      environment: process.env.NODE_ENV
    });
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;