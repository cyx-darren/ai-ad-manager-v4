/**
 * Health Check Routes
 * Subtask 5.5.4: Comprehensive health monitoring endpoints
 */

const express = require('express');
const { healthCheckManager } = require('../utils/healthCheck');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /health (mounted as / since router is at /health)
 * Basic health check endpoint (existing, enhanced)
 */
router.get('/', async (req, res) => {
  try {
    const quickHealth = await healthCheckManager.getQuickHealth();
    
    // Log the health check request
    logger.http('Basic health check requested', {
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.json(quickHealth);
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(503).json({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/detailed
 * Comprehensive health check with all systems
 */
router.get('/detailed', async (req, res) => {
  try {
    const includeOnly = req.query.checks ? req.query.checks.split(',') : null;
    const healthResults = await healthCheckManager.runAllChecks(includeOnly);
    
    logger.info('Detailed health check requested', {
      requestId: req.headers['x-request-id'],
      checksRequested: includeOnly || 'all',
      overallStatus: healthResults.status,
      duration: healthResults.duration
    });

    // Set appropriate HTTP status based on health
    const httpStatus = healthResults.status === 'critical' ? 503 : 
                      healthResults.status === 'degraded' ? 207 : 200;
    
    res.status(httpStatus).json(healthResults);
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(503).json({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/ready
 * Kubernetes-style readiness probe
 */
router.get('/ready', async (req, res) => {
  try {
    const readiness = await healthCheckManager.checkReadiness();
    
    logger.debug('Readiness check requested', {
      requestId: req.headers['x-request-id'],
      ready: readiness.ready,
      failures: readiness.failures
    });

    const httpStatus = readiness.ready ? 200 : 503;
    res.status(httpStatus).json(readiness);
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/live
 * Kubernetes-style liveness probe
 */
router.get('/live', async (req, res) => {
  try {
    const liveness = await healthCheckManager.checkLiveness();
    
    // Don't log liveness checks as they're frequent
    if (req.query.debug === 'true') {
      logger.debug('Liveness check requested', {
        requestId: req.headers['x-request-id'],
        alive: liveness.alive
      });
    }

    const httpStatus = liveness.alive ? 200 : 503;
    res.status(httpStatus).json(liveness);
  } catch (error) {
    logger.error('Liveness check failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(503).json({
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/history
 * Get health check history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = healthCheckManager.getHistory(limit);
    
    logger.debug('Health history requested', {
      requestId: req.headers['x-request-id'],
      limit,
      entriesReturned: history.length
    });

    res.json({
      history,
      limit,
      total: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health history request failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/metrics
 * Get system performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const systemMetrics = logger.performance.getSystemMetrics();
    
    logger.debug('System metrics requested', {
      requestId: req.headers['x-request-id'],
      uptime: systemMetrics.uptime,
      totalRequests: systemMetrics.requests.total
    });

    res.json({
      ...systemMetrics,
      timestamp: new Date().toISOString(),
      service: 'ga4-api-service',
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('System metrics request failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/checks/:checkName
 * Run individual health check
 */
router.get('/checks/:checkName', async (req, res) => {
  try {
    const { checkName } = req.params;
    const result = await healthCheckManager.runCheck(checkName);
    
    logger.debug('Individual health check requested', {
      requestId: req.headers['x-request-id'],
      checkName,
      status: result.status,
      responseTime: result.responseTime
    });

    const httpStatus = result.status === 'critical' ? 503 :
                      result.status === 'warning' ? 207 : 200;
    
    res.status(httpStatus).json(result);
  } catch (error) {
    logger.error('Individual health check failed', {
      error: error.message,
      requestId: req.headers['x-request-id'],
      checkName: req.params.checkName
    });
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/status
 * Service status summary for monitoring dashboards
 */
router.get('/status', async (req, res) => {
  try {
    const quickHealth = await healthCheckManager.getQuickHealth();
    const systemMetrics = logger.performance.getSystemMetrics();
    
    const statusSummary = {
      service: 'ga4-api-service',
      version: '1.0.0',
      status: quickHealth.status,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.round(process.uptime()),
        formatted: formatUptime(process.uptime())
      },
      performance: {
        requests: systemMetrics.requests,
        memory: systemMetrics.memory,
        averageResponseTime: systemMetrics.requests.averageResponseTime
      },
      features: {
        oauth2: true,
        tokenRefresh: true,
        caching: true,
        rateLimiting: true,
        quotaManagement: true,
        errorHandling: true,
        monitoring: true
      }
    };
    
    logger.debug('Service status requested', {
      requestId: req.headers['x-request-id'],
      status: statusSummary.status,
      uptime: statusSummary.uptime.seconds
    });

    res.json(statusSummary);
  } catch (error) {
    logger.error('Service status request failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /health/checks/run
 * Trigger health checks manually
 */
router.post('/checks/run', async (req, res) => {
  try {
    const { checks } = req.body;
    const healthResults = await healthCheckManager.runAllChecks(checks);
    
    logger.info('Manual health check triggered', {
      requestId: req.headers['x-request-id'],
      checksRequested: checks || 'all',
      overallStatus: healthResults.status,
      duration: healthResults.duration,
      triggeredBy: req.ip
    });

    res.json({
      ...healthResults,
      triggered: true,
      triggeredBy: req.ip,
      triggeredAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual health check failed', {
      error: error.message,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper function to format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

module.exports = router;