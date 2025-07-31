/**
 * Cache Warming Service for GA4 API Service
 * Phase 5.4.4: Intelligent cache warming based on usage patterns and predictive analytics
 */

const logger = require('./logger');

class CacheWarmingService {
  constructor() {
    this.warmingQueue = new Map(); // Queue of warming tasks
    this.warmingHistory = new Map(); // History of warming operations
    this.warmingStats = {
      totalWarmingRequests: 0,
      successfulWarmings: 0,
      failedWarmings: 0,
      cacheHitsFromWarming: 0,
      estimatedApiCallsSaved: 0
    };
    
    // Configuration
    this.config = {
      maxConcurrentWarmings: 3, // Max concurrent warming operations
      warmingInterval: 15 * 60 * 1000, // 15 minutes
      historyRetentionHours: 24,
      minRequestFrequency: 3, // Minimum requests per hour to trigger warming
      warmingPriorities: {
        high: { frequency: 10, recentActivity: 30 * 60 * 1000 }, // 30 min
        medium: { frequency: 5, recentActivity: 60 * 60 * 1000 }, // 1 hour
        low: { frequency: 3, recentActivity: 2 * 60 * 60 * 1000 }  // 2 hours
      },
      dataTypePriorities: {
        sessions: 1,
        users: 2,
        traffic: 3,
        pages: 4,
        conversions: 5
      }
    };

    // Services reference (injected later)
    this.ga4DataClient = null;
    this.performanceAnalytics = null;
    this.activeWarmings = new Set();

    // Start warming process
    this.startWarmingProcess();
  }

  /**
   * Initialize cache warming with service dependencies
   * @param {Object} ga4DataClient - GA4 data client instance
   * @param {Object} performanceAnalytics - Performance analytics instance
   */
  initialize(ga4DataClient, performanceAnalytics) {
    this.ga4DataClient = ga4DataClient;
    this.performanceAnalytics = performanceAnalytics;
    
    logger.info('Cache warming service initialized', {
      warmingInterval: this.config.warmingInterval,
      maxConcurrentWarmings: this.config.maxConcurrentWarmings
    });
  }

  /**
   * Analyze usage patterns and generate warming recommendations
   * @returns {Array} Array of warming tasks
   */
  generateWarmingRecommendations() {
    if (!this.performanceAnalytics) {
      return [];
    }

    const usagePatterns = this.performanceAnalytics.getUsagePatterns();
    const recommendations = [];
    const currentTime = Date.now();

    Object.entries(usagePatterns).forEach(([requestKey, pattern]) => {
      const [dataType, propertyId] = requestKey.split(':', 2);
      
      // Determine warming priority
      const priority = this.calculateWarmingPriority(pattern, dataType);
      
      if (priority) {
        // Generate warming task for most common parameters
        const warmingTasks = this.generateTasksForPattern(
          dataType, 
          propertyId, 
          pattern, 
          priority
        );
        
        recommendations.push(...warmingTasks);
      }
    });

    // Sort by priority and data type importance
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      return (this.config.dataTypePriorities[a.dataType] || 99) - 
             (this.config.dataTypePriorities[b.dataType] || 99);
    });

    return recommendations.slice(0, 20); // Limit to top 20 recommendations
  }

  /**
   * Calculate warming priority based on usage patterns
   */
  calculateWarmingPriority(pattern, dataType) {
    const { requestFrequency, totalRequests } = pattern;
    const priorities = this.config.warmingPriorities;

    // Check if meets minimum criteria
    if (requestFrequency < this.config.minRequestFrequency) {
      return null;
    }

    // Determine priority level
    if (requestFrequency >= priorities.high.frequency) {
      return 'high';
    } else if (requestFrequency >= priorities.medium.frequency) {
      return 'medium';
    } else if (requestFrequency >= priorities.low.frequency) {
      return 'low';
    }

    return null;
  }

  /**
   * Generate warming tasks for a usage pattern
   */
  generateTasksForPattern(dataType, propertyId, pattern, priority) {
    const tasks = [];
    const currentTime = Date.now();

    // Get most common dimensions (top 2)
    const topDimensions = pattern.topDimensions.slice(0, 2);
    
    // Get most common date ranges (top 1)
    const topDateRange = pattern.topDateRanges[0];

    // Generate warming task for most common parameters
    if (topDateRange) {
      const [startDate, endDate] = topDateRange.range.split(':');
      
      // Create base task
      const baseTask = {
        id: `${dataType}:${propertyId}:${Date.now()}`,
        dataType,
        propertyId,
        priority,
        options: {
          startDate,
          endDate,
          limit: 100
        },
        estimatedBenefit: this.calculateWarmingBenefit(pattern, priority),
        createdAt: currentTime
      };

      // Add task without dimensions
      tasks.push({ ...baseTask });

      // Add tasks with top dimensions
      topDimensions.forEach(({ dimensions }) => {
        if (dimensions && dimensions !== '') {
          tasks.push({
            ...baseTask,
            id: `${baseTask.id}:${dimensions}`,
            options: {
              ...baseTask.options,
              dimensions: dimensions.split(',')
            }
          });
        }
      });
    }

    return tasks;
  }

  /**
   * Calculate estimated benefit of warming a specific pattern
   */
  calculateWarmingBenefit(pattern, priority) {
    const baseScore = pattern.requestFrequency * 10;
    const priorityMultiplier = { high: 3, medium: 2, low: 1 }[priority] || 1;
    
    return Math.round(baseScore * priorityMultiplier);
  }

  /**
   * Execute cache warming for a specific task
   * @param {Object} warmingTask - Warming task specification
   * @returns {Promise<Object>} Warming result
   */
  async executeWarming(warmingTask) {
    const { id, dataType, propertyId, options } = warmingTask;
    const startTime = Date.now();

    try {
      this.warmingStats.totalWarmingRequests++;
      this.activeWarmings.add(id);

      logger.info('Starting cache warming', {
        warmingId: id,
        dataType,
        propertyId,
        priority: warmingTask.priority
      });

      // Execute the warming request
      let result;
      switch (dataType) {
        case 'sessions':
          result = await this.ga4DataClient.getSessionMetrics(propertyId, options);
          break;
        case 'users':
          result = await this.ga4DataClient.getUserMetrics(propertyId, options);
          break;
        case 'traffic':
          result = await this.ga4DataClient.getTrafficSourceBreakdown(propertyId, options);
          break;
        case 'pages':
          result = await this.ga4DataClient.getPagePerformance(propertyId, options);
          break;
        case 'conversions':
          result = await this.ga4DataClient.getConversionMetrics(propertyId, options);
          break;
        default:
          throw new Error(`Unsupported data type for warming: ${dataType}`);
      }

      const duration = Date.now() - startTime;
      this.warmingStats.successfulWarmings++;

      // Record warming history
      this.recordWarmingHistory(warmingTask, {
        success: true,
        duration,
        cached: result.cached || false,
        source: result.source || 'unknown'
      });

      logger.info('Cache warming completed successfully', {
        warmingId: id,
        dataType,
        duration,
        cached: result.cached,
        source: result.source
      });

      return {
        success: true,
        warmingId: id,
        duration,
        cached: result.cached,
        dataSize: result.data ? JSON.stringify(result.data).length : 0
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.warmingStats.failedWarmings++;

      // Record warming failure
      this.recordWarmingHistory(warmingTask, {
        success: false,
        duration,
        error: error.message
      });

      logger.warn('Cache warming failed', {
        warmingId: id,
        dataType,
        error: error.message,
        duration
      });

      return {
        success: false,
        warmingId: id,
        error: error.message,
        duration
      };

    } finally {
      this.activeWarmings.delete(id);
    }
  }

  /**
   * Record warming operation history
   */
  recordWarmingHistory(task, result) {
    if (!this.warmingHistory.has(task.dataType)) {
      this.warmingHistory.set(task.dataType, []);
    }

    const history = this.warmingHistory.get(task.dataType);
    history.push({
      warmingId: task.id,
      timestamp: Date.now(),
      priority: task.priority,
      propertyId: task.propertyId,
      options: task.options,
      result
    });

    // Keep only recent history
    const cutoff = Date.now() - (this.config.historyRetentionHours * 60 * 60 * 1000);
    const filteredHistory = history.filter(entry => entry.timestamp >= cutoff);
    this.warmingHistory.set(task.dataType, filteredHistory);
  }

  /**
   * Execute warming cycle
   */
  async executeWarmingCycle() {
    try {
      logger.info('Starting cache warming cycle');

      // Generate warming recommendations
      const recommendations = this.generateWarmingRecommendations();
      
      if (recommendations.length === 0) {
        logger.info('No warming recommendations generated');
        return;
      }

      logger.info('Generated warming recommendations', {
        totalRecommendations: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
        lowPriority: recommendations.filter(r => r.priority === 'low').length
      });

      // Execute warming tasks (limited by concurrency)
      const concurrentTasks = recommendations
        .slice(0, this.config.maxConcurrentWarmings)
        .map(task => this.executeWarming(task));

      const results = await Promise.allSettled(concurrentTasks);
      
      // Analyze results
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.length - successCount;

      logger.info('Cache warming cycle completed', {
        totalTasks: results.length,
        successful: successCount,
        failed: failureCount,
        activeWarmings: this.activeWarmings.size
      });

    } catch (error) {
      logger.error('Cache warming cycle failed:', error.message);
    }
  }

  /**
   * Start periodic warming process
   */
  startWarmingProcess() {
    // Initial delay to allow services to initialize
    setTimeout(() => {
      setInterval(() => {
        this.executeWarmingCycle();
      }, this.config.warmingInterval);
      
      // Execute first cycle
      this.executeWarmingCycle();
    }, 60000); // 1 minute delay

    logger.info('Cache warming process started', {
      interval: this.config.warmingInterval,
      initialDelay: 60000
    });
  }

  /**
   * Manually trigger warming for specific request
   * @param {string} dataType - Data type to warm
   * @param {string} propertyId - Property ID
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Warming result
   */
  async warmSpecificRequest(dataType, propertyId, options = {}) {
    const warmingTask = {
      id: `manual:${dataType}:${propertyId}:${Date.now()}`,
      dataType,
      propertyId,
      priority: 'high',
      options,
      estimatedBenefit: 100,
      createdAt: Date.now()
    };

    logger.info('Manual cache warming triggered', {
      dataType,
      propertyId,
      options
    });

    return await this.executeWarming(warmingTask);
  }

  /**
   * Get warming statistics
   * @returns {Object} Warming statistics
   */
  getWarmingStats() {
    const successRate = this.warmingStats.totalWarmingRequests > 0
      ? (this.warmingStats.successfulWarmings / this.warmingStats.totalWarmingRequests * 100).toFixed(1)
      : '0';

    return {
      ...this.warmingStats,
      successRate: successRate + '%',
      activeWarmings: this.activeWarmings.size,
      averageWarmingsPerCycle: this.warmingStats.totalWarmingRequests > 0
        ? Math.round(this.warmingStats.totalWarmingRequests / Math.max(1, Math.floor(Date.now() / this.config.warmingInterval)))
        : 0
    };
  }

  /**
   * Get warming history for analysis
   * @param {string} dataType - Optional data type filter
   * @returns {Object} Warming history
   */
  getWarmingHistory(dataType = null) {
    if (dataType) {
      return {
        dataType,
        history: this.warmingHistory.get(dataType) || []
      };
    }

    const allHistory = {};
    this.warmingHistory.forEach((history, type) => {
      allHistory[type] = history;
    });

    return allHistory;
  }

  /**
   * Get current warming queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    const recommendations = this.generateWarmingRecommendations();
    
    return {
      pendingRecommendations: recommendations.length,
      activeWarmings: this.activeWarmings.size,
      maxConcurrentWarmings: this.config.maxConcurrentWarmings,
      nextWarmingCycle: new Date(Date.now() + this.config.warmingInterval).toISOString(),
      recommendationBreakdown: {
        high: recommendations.filter(r => r.priority === 'high').length,
        medium: recommendations.filter(r => r.priority === 'medium').length,
        low: recommendations.filter(r => r.priority === 'low').length
      }
    };
  }

  /**
   * Track cache hit from warming (called by cache system)
   * @param {string} dataType - Data type that was warmed
   * @param {string} propertyId - Property ID
   */
  trackCacheHitFromWarming(dataType, propertyId) {
    this.warmingStats.cacheHitsFromWarming++;
    this.warmingStats.estimatedApiCallsSaved++;

    logger.debug('Cache hit from warming tracked', {
      dataType,
      propertyId,
      totalHitsFromWarming: this.warmingStats.cacheHitsFromWarming
    });
  }

  /**
   * Update warming configuration
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Cache warming configuration updated', {
      newConfig
    });
  }

  /**
   * Get warming effectiveness report
   * @returns {Object} Effectiveness analysis
   */
  getEffectivenessReport() {
    const stats = this.getWarmingStats();
    const history = this.getWarmingHistory();
    
    // Calculate effectiveness by data type
    const effectivenessByType = {};
    
    Object.entries(history).forEach(([dataType, records]) => {
      const successful = records.filter(r => r.result.success).length;
      const total = records.length;
      const effectiveness = total > 0 ? (successful / total * 100).toFixed(1) : '0';
      
      effectivenessByType[dataType] = {
        totalAttempts: total,
        successful,
        effectiveness: effectiveness + '%',
        averageDuration: records.length > 0
          ? Math.round(records.reduce((sum, r) => sum + r.result.duration, 0) / records.length)
          : 0
      };
    });

    return {
      overallStats: stats,
      effectivenessByType,
      recommendations: this.generateWarmingRecommendations().length > 0
        ? 'Active warming opportunities identified'
        : 'No immediate warming opportunities',
      estimatedImpact: {
        apiCallsSaved: stats.estimatedApiCallsSaved,
        cacheHitsImproved: stats.cacheHitsFromWarming,
        responseTimeImprovement: 'Estimated 80-95% faster for warmed requests'
      }
    };
  }

  /**
   * Reset warming statistics (for testing)
   */
  resetStats() {
    this.warmingStats = {
      totalWarmingRequests: 0,
      successfulWarmings: 0,
      failedWarmings: 0,
      cacheHitsFromWarming: 0,
      estimatedApiCallsSaved: 0
    };
    
    this.warmingHistory.clear();
    this.activeWarmings.clear();
    
    logger.info('Cache warming statistics reset');
  }
}

// Create singleton instance
const cacheWarmingService = new CacheWarmingService();

module.exports = { CacheWarmingService, cacheWarmingService };