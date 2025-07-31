/**
 * Comprehensive Health Check System
 * Subtask 5.5.4: Advanced health checks, system monitoring, and diagnostics
 */

const logger = require('./logger');

/**
 * Health Check Manager
 * Provides comprehensive system health monitoring
 */
class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.history = [];
    this.maxHistorySize = 100;
    this.lastFullCheck = null;
    
    // Register default health checks
    this.registerDefaultChecks();
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFunction - Function that returns health status
   * @param {Object} options - Check options
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      name,
      checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      tags: options.tags || [],
      description: options.description || `Health check for ${name}`
    });
    
    logger.debug('Health check registered', { checkName: name, options });
  }

  /**
   * Register default system health checks
   */
  registerDefaultChecks() {
    // Memory usage check
    this.registerCheck('memory', async () => {
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memory.heapTotal / 1024 / 1024);
      const usagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
      
      return {
        status: memoryMB > 512 ? 'warning' : usagePercent > 90 ? 'critical' : 'healthy',
        details: {
          heapUsed: `${memoryMB}MB`,
          heapTotal: `${totalMB}MB`,
          usagePercent: `${usagePercent}%`,
          external: `${Math.round(memory.external / 1024 / 1024)}MB`
        },
        metrics: {
          heapUsedMB: memoryMB,
          heapTotalMB: totalMB,
          usagePercent
        }
      };
    }, { critical: true, description: 'System memory usage monitoring' });

    // Process uptime check
    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      const uptimeHours = Math.round(uptime / 3600 * 100) / 100;
      
      return {
        status: 'healthy',
        details: {
          uptimeSeconds: Math.round(uptime),
          uptimeHours,
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version
        },
        metrics: {
          uptimeSeconds: Math.round(uptime),
          pid: process.pid
        }
      };
    }, { description: 'Process uptime and system information' });

    // Performance metrics check
    this.registerCheck('performance', async () => {
      const metrics = logger.performance.getSystemMetrics();
      const errorRate = metrics.requests.errorRate;
      const avgResponseTime = metrics.requests.averageResponseTime;
      
      let status = 'healthy';
      if (errorRate > 10 || avgResponseTime > 5000) status = 'critical';
      else if (errorRate > 5 || avgResponseTime > 2000) status = 'warning';
      
      return {
        status,
        details: {
          totalRequests: metrics.requests.total,
          errorRate: `${errorRate}%`,
          averageResponseTime: `${avgResponseTime}ms`,
          currentMemory: `${metrics.memory.current}MB`,
          peakMemory: `${metrics.memory.peak}MB`
        },
        metrics: {
          totalRequests: metrics.requests.total,
          errorRate,
          averageResponseTime,
          currentMemoryMB: metrics.memory.current
        }
      };
    }, { critical: true, description: 'Application performance metrics' });

    // GA4 client check
    this.registerCheck('ga4Client', async () => {
      try {
        // Check if GA4 client is properly initialized
        const { ga4DataClient } = require('./ga4DataClient');
        const isInitialized = ga4DataClient && ga4DataClient.client;
        
        return {
          status: isInitialized ? 'healthy' : 'critical',
          details: {
            initialized: isInitialized,
            cacheEnabled: ga4DataClient?.cacheEnabled || false,
            optimizations: ga4DataClient?.optimizationsEnabled || {}
          },
          metrics: {
            initialized: isInitialized ? 1 : 0,
            cacheEnabled: ga4DataClient?.cacheEnabled ? 1 : 0
          }
        };
      } catch (error) {
        return {
          status: 'critical',
          details: {
            initialized: false,
            error: error.message
          },
          metrics: {
            initialized: 0
          }
        };
      }
    }, { critical: true, description: 'GA4 client connectivity and status' });

    // Redis connection check
    this.registerCheck('redis', async () => {
      try {
        const { redisClient } = require('./redisClient');
        const isConnected = redisClient.isConnected;
        
        if (isConnected) {
          // Test basic Redis operations
          await redisClient.set('health_check', 'ok', 10);
          const testValue = await redisClient.get('health_check');
          
          return {
            status: testValue === 'ok' ? 'healthy' : 'warning',
            details: {
              connected: true,
              testPassed: testValue === 'ok',
              provider: 'redis'
            },
            metrics: {
              connected: 1,
              testPassed: testValue === 'ok' ? 1 : 0
            }
          };
        } else {
          return {
            status: 'warning',
            details: {
              connected: false,
              fallback: 'memory cache active',
              provider: 'memory'
            },
            metrics: {
              connected: 0
            }
          };
        }
      } catch (error) {
        return {
          status: 'warning',
          details: {
            connected: false,
            error: error.message,
            fallback: 'memory cache active'
          },
          metrics: {
            connected: 0
          }
        };
      }
    }, { description: 'Redis cache connectivity and performance' });

    // Rate limiting health check
    this.registerCheck('rateLimiting', async () => {
      try {
        const { rateLimitingManager } = require('./rateLimiter');
        const status = rateLimitingManager.getAllStatus();
        
        const totalRequests = status.statistics.totalRequests;
        const blockedPercent = status.statistics.blockedPercent;
        
        let checkStatus = 'healthy';
        if (blockedPercent > 20) checkStatus = 'warning';
        if (blockedPercent > 50) checkStatus = 'critical';
        
        return {
          status: checkStatus,
          details: {
            totalRequests,
            allowedPercent: status.statistics.allowedPercent,
            blockedPercent,
            limiters: Object.keys(status.limiters).length
          },
          metrics: {
            totalRequests,
            blockedPercent,
            limitersCount: Object.keys(status.limiters).length
          }
        };
      } catch (error) {
        return {
          status: 'critical',
          details: {
            error: error.message,
            available: false
          },
          metrics: {
            available: 0
          }
        };
      }
    }, { critical: true, description: 'Rate limiting system status' });

    // Quota tracking health check  
    this.registerCheck('quotaTracking', async () => {
      try {
        const { quotaTracker } = require('./rateLimiter');
        const quotaStatus = quotaTracker.getQuotaStatus();
        
        const quotas = Object.values(quotaStatus);
        const criticalQuotas = quotas.filter(q => q.status === 'critical').length;
        const warningQuotas = quotas.filter(q => q.status === 'warning').length;
        
        let checkStatus = 'healthy';
        if (warningQuotas > 0) checkStatus = 'warning';
        if (criticalQuotas > 0) checkStatus = 'critical';
        
        return {
          status: checkStatus,
          details: {
            totalQuotas: quotas.length,
            healthyQuotas: quotas.filter(q => q.status === 'ok').length,
            warningQuotas,
            criticalQuotas
          },
          metrics: {
            totalQuotas: quotas.length,
            warningQuotas,
            criticalQuotas
          }
        };
      } catch (error) {
        return {
          status: 'critical',
          details: {
            error: error.message,
            available: false
          },
          metrics: {
            available: 0
          }
        };
      }
    }, { critical: true, description: 'API quota tracking and monitoring' });
  }

  /**
   * Run a single health check with timeout
   * @param {string} name - Check name
   * @returns {Object} Health check result
   */
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      return {
        name,
        status: 'unknown',
        error: 'Health check not found',
        timestamp: new Date().toISOString()
      };
    }

    const startTime = Date.now();
    
    try {
      // Run check with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });
      
      const result = await Promise.race([
        check.checkFunction(),
        timeoutPromise
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        name,
        status: result.status || 'unknown',
        details: result.details || {},
        metrics: result.metrics || {},
        responseTime,
        critical: check.critical,
        description: check.description,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Health check failed', {
        checkName: name,
        error: error.message,
        responseTime
      });
      
      return {
        name,
        status: 'critical',
        error: error.message,
        responseTime,
        critical: check.critical,
        description: check.description,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run all health checks
   * @param {Array} includeOnly - Only run specific checks
   * @returns {Object} Complete health check results
   */
  async runAllChecks(includeOnly = null) {
    const startTime = Date.now();
    const checksToRun = includeOnly 
      ? Array.from(this.checks.keys()).filter(name => includeOnly.includes(name))
      : Array.from(this.checks.keys());
    
    logger.debug('Running health checks', { 
      checksToRun: checksToRun.length,
      checkNames: checksToRun 
    });

    // Run all checks in parallel
    const checkPromises = checksToRun.map(name => this.runCheck(name));
    const results = await Promise.all(checkPromises);
    
    const totalTime = Date.now() - startTime;
    
    // Determine overall status
    const criticalFailures = results.filter(r => r.status === 'critical' && r.critical).length;
    const totalFailures = results.filter(r => r.status === 'critical' || r.status === 'warning').length;
    
    let overallStatus = 'healthy';
    if (criticalFailures > 0) overallStatus = 'critical';
    else if (totalFailures > 0) overallStatus = 'degraded';
    
    const summary = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: totalTime,
      checks: {
        total: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        warning: results.filter(r => r.status === 'warning').length,
        critical: results.filter(r => r.status === 'critical').length,
        unknown: results.filter(r => r.status === 'unknown').length
      },
      details: results
    };
    
    // Store in history
    this.addToHistory(summary);
    this.lastFullCheck = summary;
    
    // Log health check results
    logger.info('Health checks completed', {
      overallStatus,
      duration: totalTime,
      checksRun: results.length,
      failures: totalFailures,
      criticalFailures
    });
    
    return summary;
  }

  /**
   * Add health check result to history
   * @param {Object} result - Health check result
   */
  addToHistory(result) {
    this.history.push({
      timestamp: result.timestamp,
      status: result.status,
      duration: result.duration,
      checkCounts: result.checks
    });
    
    // Maintain history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get health check history
   * @param {number} limit - Number of recent results to return
   * @returns {Array} Historical health check results
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Get quick health status (lightweight check)
   * @returns {Object} Quick health summary
   */
  async getQuickHealth() {
    const memory = process.memoryUsage();
    const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
    const performanceMetrics = logger.performance.getSystemMetrics();
    
    const status = memoryMB > 512 || performanceMetrics.requests.errorRate > 10 
      ? 'warning' 
      : 'healthy';
    
    return {
      status,
      timestamp: new Date().toISOString(),
      service: 'ga4-api-service',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      memory: `${memoryMB}MB`,
      requests: performanceMetrics.requests.total,
      errorRate: `${performanceMetrics.requests.errorRate}%`
    };
  }

  /**
   * Check if system is ready to serve requests
   * @returns {Object} Readiness check result
   */
  async checkReadiness() {
    const criticalChecks = ['memory', 'performance', 'ga4Client'];
    const results = await Promise.all(
      criticalChecks.map(name => this.runCheck(name))
    );
    
    const failures = results.filter(r => r.status === 'critical');
    const ready = failures.length === 0;
    
    return {
      ready,
      timestamp: new Date().toISOString(),
      checks: results,
      failures: failures.map(f => f.name)
    };
  }

  /**
   * Check if system is live (basic liveness)
   * @returns {Object} Liveness check result
   */
  async checkLiveness() {
    try {
      // Basic liveness - can we respond?
      const memory = process.memoryUsage();
      return {
        alive: true,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: Math.round(process.uptime()),
        memory: Math.round(memory.heapUsed / 1024 / 1024)
      };
    } catch (error) {
      return {
        alive: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

// Create global health check manager
const healthCheckManager = new HealthCheckManager();

module.exports = {
  HealthCheckManager,
  healthCheckManager
};