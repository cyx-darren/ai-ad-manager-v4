/**
 * Advanced Performance Analytics for GA4 API Service
 * Phase 5.4.4: Comprehensive performance monitoring and optimization analytics
 */

const logger = require('./logger');

class PerformanceAnalytics {
  constructor() {
    this.requestMetrics = new Map(); // Request pattern tracking
    this.performanceHistory = []; // Historical performance data
    this.cacheEffectiveness = new Map(); // Cache effectiveness by data type
    this.responseTimeTracker = new Map(); // Response time analytics
    this.usagePatterns = new Map(); // Usage pattern analysis
    this.optimizationRecommendations = [];
    
    // Configuration
    this.config = {
      historyRetentionHours: 24, // Keep 24 hours of metrics
      analysisIntervalMs: 5 * 60 * 1000, // Analyze every 5 minutes
      slowRequestThreshold: 1000, // 1 second
      lowHitRateThreshold: 0.7, // 70%
      highErrorRateThreshold: 0.05 // 5%
    };

    // Start periodic analysis
    this.startPeriodicAnalysis();
  }

  /**
   * Record a request with performance metrics
   * @param {Object} requestData - Request performance data
   */
  recordRequest(requestData) {
    const {
      dataType,
      propertyId,
      source, // 'cache', 'api', 'error'
      responseTime,
      cacheHit,
      error,
      options = {}
    } = requestData;

    const timestamp = Date.now();
    const requestKey = `${dataType}:${propertyId}`;

    // Track request metrics
    if (!this.requestMetrics.has(requestKey)) {
      this.requestMetrics.set(requestKey, {
        dataType,
        propertyId,
        requestCount: 0,
        totalResponseTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        lastRequested: timestamp,
        averageResponseTime: 0,
        hitRate: 0,
        errorRate: 0,
        requestFrequency: 0
      });
    }

    const metrics = this.requestMetrics.get(requestKey);
    metrics.requestCount++;
    metrics.totalResponseTime += responseTime;
    metrics.lastRequested = timestamp;

    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }

    if (error) {
      metrics.errors++;
    }

    // Calculate derived metrics
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.requestCount;
    metrics.hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);
    metrics.errorRate = metrics.errors / metrics.requestCount;

    // Add to performance history
    this.performanceHistory.push({
      timestamp,
      dataType,
      propertyId,
      source,
      responseTime,
      cacheHit,
      error: !!error
    });

    // Track cache effectiveness by data type
    this.updateCacheEffectiveness(dataType, { responseTime, cacheHit, error: !!error });

    // Track response times
    this.trackResponseTime(dataType, responseTime, source);

    // Analyze usage patterns
    this.analyzeUsagePattern(requestKey, timestamp, options);

    // Cleanup old data
    this.cleanupOldData();
  }

  /**
   * Update cache effectiveness metrics by data type
   */
  updateCacheEffectiveness(dataType, { responseTime, cacheHit, error }) {
    if (!this.cacheEffectiveness.has(dataType)) {
      this.cacheEffectiveness.set(dataType, {
        totalRequests: 0,
        cacheHits: 0,
        averageResponseTime: 0,
        cacheResponseTime: 0,
        apiResponseTime: 0,
        totalResponseTime: 0,
        errors: 0,
        effectiveness: 0
      });
    }

    const effectiveness = this.cacheEffectiveness.get(dataType);
    effectiveness.totalRequests++;
    effectiveness.totalResponseTime += responseTime;

    if (cacheHit) {
      effectiveness.cacheHits++;
      effectiveness.cacheResponseTime = (effectiveness.cacheResponseTime + responseTime) / 2;
    } else if (!error) {
      effectiveness.apiResponseTime = (effectiveness.apiResponseTime + responseTime) / 2;
    }

    if (error) {
      effectiveness.errors++;
    }

    effectiveness.averageResponseTime = effectiveness.totalResponseTime / effectiveness.totalRequests;
    
    // Calculate effectiveness score (0-100)
    const hitRate = effectiveness.cacheHits / effectiveness.totalRequests;
    const errorRate = effectiveness.errors / effectiveness.totalRequests;
    const speedImprovement = effectiveness.apiResponseTime > 0 
      ? 1 - (effectiveness.cacheResponseTime / effectiveness.apiResponseTime)
      : 0;

    effectiveness.effectiveness = Math.round(
      (hitRate * 0.4 + (1 - errorRate) * 0.3 + speedImprovement * 0.3) * 100
    );
  }

  /**
   * Track response time patterns
   */
  trackResponseTime(dataType, responseTime, source) {
    const key = `${dataType}:${source}`;
    
    if (!this.responseTimeTracker.has(key)) {
      this.responseTimeTracker.set(key, {
        dataType,
        source,
        samples: [],
        average: 0,
        median: 0,
        p95: 0,
        min: Infinity,
        max: 0
      });
    }

    const tracker = this.responseTimeTracker.get(key);
    tracker.samples.push(responseTime);
    
    // Keep only last 100 samples
    if (tracker.samples.length > 100) {
      tracker.samples.shift();
    }

    // Calculate statistics
    tracker.min = Math.min(tracker.min, responseTime);
    tracker.max = Math.max(tracker.max, responseTime);
    tracker.average = tracker.samples.reduce((a, b) => a + b, 0) / tracker.samples.length;
    
    const sorted = [...tracker.samples].sort((a, b) => a - b);
    tracker.median = sorted[Math.floor(sorted.length / 2)];
    tracker.p95 = sorted[Math.floor(sorted.length * 0.95)];
  }

  /**
   * Analyze usage patterns for optimization opportunities
   */
  analyzeUsagePattern(requestKey, timestamp, options) {
    if (!this.usagePatterns.has(requestKey)) {
      this.usagePatterns.set(requestKey, {
        requestKey,
        hourlyRequests: new Array(24).fill(0),
        commonDimensions: new Map(),
        commonDateRanges: new Map(),
        lastHourAnalyzed: -1
      });
    }

    const pattern = this.usagePatterns.get(requestKey);
    const hour = new Date(timestamp).getHours();
    pattern.hourlyRequests[hour]++;

    // Track common dimensions
    if (options.dimensions) {
      const dimKey = options.dimensions.sort().join(',');
      pattern.commonDimensions.set(dimKey, (pattern.commonDimensions.get(dimKey) || 0) + 1);
    }

    // Track common date ranges
    if (options.startDate && options.endDate) {
      const rangeKey = `${options.startDate}:${options.endDate}`;
      pattern.commonDateRanges.set(rangeKey, (pattern.commonDateRanges.get(rangeKey) || 0) + 1);
    }
  }

  /**
   * Generate performance analysis report
   */
  generateAnalysisReport() {
    const now = Date.now();
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      cacheEffectiveness: this.getCacheEffectivenessReport(),
      responseTimeAnalysis: this.getResponseTimeAnalysis(),
      usagePatterns: this.getUsagePatterns(),
      optimizationRecommendations: this.generateOptimizationRecommendations(),
      performanceScore: this.calculateOverallPerformanceScore()
    };

    logger.info('Performance analysis report generated', {
      performanceScore: report.performanceScore,
      totalRequests: report.summary.totalRequests,
      overallHitRate: report.summary.overallHitRate,
      recommendationsCount: report.optimizationRecommendations.length
    });

    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const recentHistory = this.getRecentHistory(60 * 60 * 1000); // Last hour
    
    const summary = {
      totalRequests: recentHistory.length,
      cacheHits: recentHistory.filter(r => r.cacheHit).length,
      errors: recentHistory.filter(r => r.error).length,
      averageResponseTime: 0,
      overallHitRate: 0,
      errorRate: 0,
      dataTypeBreakdown: new Map()
    };

    if (summary.totalRequests > 0) {
      summary.overallHitRate = summary.cacheHits / summary.totalRequests;
      summary.errorRate = summary.errors / summary.totalRequests;
      summary.averageResponseTime = recentHistory.reduce((sum, r) => sum + r.responseTime, 0) / summary.totalRequests;

      // Data type breakdown
      recentHistory.forEach(request => {
        const type = request.dataType;
        if (!summary.dataTypeBreakdown.has(type)) {
          summary.dataTypeBreakdown.set(type, { requests: 0, hits: 0, errors: 0 });
        }
        const breakdown = summary.dataTypeBreakdown.get(type);
        breakdown.requests++;
        if (request.cacheHit) breakdown.hits++;
        if (request.error) breakdown.errors++;
      });
    }

    return summary;
  }

  /**
   * Get cache effectiveness report
   */
  getCacheEffectivenessReport() {
    const report = {};
    
    this.cacheEffectiveness.forEach((effectiveness, dataType) => {
      report[dataType] = {
        ...effectiveness,
        hitRate: effectiveness.totalRequests > 0 ? effectiveness.cacheHits / effectiveness.totalRequests : 0,
        errorRate: effectiveness.totalRequests > 0 ? effectiveness.errors / effectiveness.totalRequests : 0,
        speedImprovement: effectiveness.apiResponseTime > 0 && effectiveness.cacheResponseTime > 0
          ? `${Math.round((1 - effectiveness.cacheResponseTime / effectiveness.apiResponseTime) * 100)}%`
          : 'N/A'
      };
    });

    return report;
  }

  /**
   * Get response time analysis
   */
  getResponseTimeAnalysis() {
    const analysis = {};
    
    this.responseTimeTracker.forEach((tracker, key) => {
      analysis[key] = {
        dataType: tracker.dataType,
        source: tracker.source,
        statistics: {
          average: Math.round(tracker.average),
          median: Math.round(tracker.median),
          p95: Math.round(tracker.p95),
          min: tracker.min,
          max: tracker.max
        },
        sampleCount: tracker.samples.length
      };
    });

    return analysis;
  }

  /**
   * Get usage patterns analysis
   */
  getUsagePatterns() {
    const patterns = {};

    this.usagePatterns.forEach((pattern, requestKey) => {
      const peakHour = pattern.hourlyRequests.indexOf(Math.max(...pattern.hourlyRequests));
      const totalRequests = pattern.hourlyRequests.reduce((a, b) => a + b, 0);
      
      // Get most common dimensions
      const topDimensions = Array.from(pattern.commonDimensions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dims, count]) => ({ dimensions: dims, count }));

      // Get most common date ranges
      const topDateRanges = Array.from(pattern.commonDateRanges.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([range, count]) => ({ range, count }));

      patterns[requestKey] = {
        totalRequests,
        peakHour,
        hourlyDistribution: pattern.hourlyRequests,
        topDimensions,
        topDateRanges,
        requestFrequency: totalRequests / 24 // requests per hour average
      };
    });

    return patterns;
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];

    // Analyze cache effectiveness
    this.cacheEffectiveness.forEach((effectiveness, dataType) => {
      const hitRate = effectiveness.totalRequests > 0 ? effectiveness.cacheHits / effectiveness.totalRequests : 0;
      const errorRate = effectiveness.totalRequests > 0 ? effectiveness.errors / effectiveness.totalRequests : 0;

      if (hitRate < this.config.lowHitRateThreshold) {
        recommendations.push({
          type: 'cache_optimization',
          priority: 'high',
          dataType,
          issue: 'Low cache hit rate',
          currentValue: `${Math.round(hitRate * 100)}%`,
          recommendation: `Consider increasing TTL for ${dataType} data or implementing cache warming`,
          impact: 'High - Will improve response times and reduce API usage'
        });
      }

      if (errorRate > this.config.highErrorRateThreshold) {
        recommendations.push({
          type: 'error_reduction',
          priority: 'critical',
          dataType,
          issue: 'High error rate',
          currentValue: `${Math.round(errorRate * 100)}%`,
          recommendation: `Investigate and fix errors in ${dataType} data fetching`,
          impact: 'Critical - Errors affect user experience and cache effectiveness'
        });
      }
    });

    // Analyze response times
    this.responseTimeTracker.forEach((tracker, key) => {
      if (tracker.average > this.config.slowRequestThreshold) {
        recommendations.push({
          type: 'performance_optimization',
          priority: 'medium',
          dataType: tracker.dataType,
          source: tracker.source,
          issue: 'Slow response times',
          currentValue: `${Math.round(tracker.average)}ms`,
          recommendation: `Optimize ${tracker.dataType} ${tracker.source} requests or implement prefetching`,
          impact: 'Medium - Will improve user experience'
        });
      }
    });

    // Analyze usage patterns for cache warming opportunities
    this.usagePatterns.forEach((pattern, requestKey) => {
      if (pattern.requestFrequency > 5) { // More than 5 requests per hour
        const [dataType, propertyId] = requestKey.split(':');
        recommendations.push({
          type: 'cache_warming',
          priority: 'low',
          dataType,
          propertyId,
          issue: 'High frequency requests',
          currentValue: `${Math.round(pattern.requestFrequency)} requests/hour`,
          recommendation: `Implement cache warming for ${dataType} data for property ${propertyId}`,
          impact: 'Low - Will reduce initial response times for frequent requests'
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallPerformanceScore() {
    const summary = this.generateSummary();
    
    if (summary.totalRequests === 0) {
      return 100; // No requests, no problems
    }

    // Calculate component scores (0-100)
    const hitRateScore = summary.overallHitRate * 100;
    const errorRateScore = (1 - summary.errorRate) * 100;
    const responseTimeScore = Math.max(0, 100 - (summary.averageResponseTime / 10)); // 1000ms = 0 score
    
    // Weighted average
    const overallScore = (
      hitRateScore * 0.4 +
      errorRateScore * 0.4 +
      responseTimeScore * 0.2
    );

    return Math.round(Math.max(0, Math.min(100, overallScore)));
  }

  /**
   * Get recent performance history
   */
  getRecentHistory(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.performanceHistory.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Clean up old performance data
   */
  cleanupOldData() {
    const cutoff = Date.now() - (this.config.historyRetentionHours * 60 * 60 * 1000);
    
    // Clean performance history
    this.performanceHistory = this.performanceHistory.filter(entry => entry.timestamp >= cutoff);

    // Clean request metrics for inactive requests
    this.requestMetrics.forEach((metrics, key) => {
      if (metrics.lastRequested < cutoff) {
        this.requestMetrics.delete(key);
      }
    });
  }

  /**
   * Start periodic analysis
   */
  startPeriodicAnalysis() {
    setInterval(() => {
      try {
        const report = this.generateAnalysisReport();
        
        // Log important findings
        if (report.optimizationRecommendations.length > 0) {
          const criticalRecommendations = report.optimizationRecommendations.filter(r => r.priority === 'critical');
          if (criticalRecommendations.length > 0) {
            logger.warn('Critical performance issues detected', {
              criticalIssues: criticalRecommendations.length,
              performanceScore: report.performanceScore
            });
          }
        }

        logger.info('Periodic performance analysis completed', {
          performanceScore: report.performanceScore,
          totalRequests: report.summary.totalRequests,
          hitRate: `${Math.round(report.summary.overallHitRate * 100)}%`,
          recommendations: report.optimizationRecommendations.length
        });

      } catch (error) {
        logger.error('Periodic performance analysis failed:', error.message);
      }
    }, this.config.analysisIntervalMs);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics() {
    return {
      requestMetrics: Object.fromEntries(this.requestMetrics),
      cacheEffectiveness: Object.fromEntries(this.cacheEffectiveness),
      responseTimeAnalysis: this.getResponseTimeAnalysis(),
      usagePatterns: this.getUsagePatterns(),
      performanceScore: this.calculateOverallPerformanceScore()
    };
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics() {
    this.requestMetrics.clear();
    this.performanceHistory = [];
    this.cacheEffectiveness.clear();
    this.responseTimeTracker.clear();
    this.usagePatterns.clear();
    this.optimizationRecommendations = [];
    
    logger.info('Performance analytics metrics reset');
  }
}

// Create singleton instance
const performanceAnalytics = new PerformanceAnalytics();

module.exports = { PerformanceAnalytics, performanceAnalytics };