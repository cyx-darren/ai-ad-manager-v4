/**
 * Request Deduplication Service for GA4 API Service
 * Phase 5.4.4: Prevents duplicate concurrent requests to improve performance and reduce API usage
 */

const logger = require('./logger');

class RequestDeduplication {
  constructor() {
    this.pendingRequests = new Map(); // Track ongoing requests
    this.requestQueue = new Map(); // Queue waiting requests
    this.requestStats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      savedApiCalls: 0,
      averageWaitTime: 0
    };
    
    // Configuration
    this.config = {
      maxWaitTime: 10000, // 10 seconds max wait for duplicate request
      cleanupInterval: 30000, // 30 seconds cleanup interval
      maxQueueSize: 100 // Max queued requests per key
    };

    // Start cleanup process
    this.startCleanupProcess();
  }

  /**
   * Execute request with deduplication
   * @param {string} requestKey - Unique identifier for the request
   * @param {Function} requestFunction - Function that performs the actual request
   * @param {number} timeout - Optional timeout for this request
   * @returns {Promise} Request result
   */
  async executeRequest(requestKey, requestFunction, timeout = this.config.maxWaitTime) {
    this.requestStats.totalRequests++;
    const startTime = Date.now();

    try {
      // Check if same request is already in progress
      if (this.pendingRequests.has(requestKey)) {
        return await this.waitForPendingRequest(requestKey, timeout, startTime);
      }

      // Create new request promise
      const requestPromise = this.createNewRequest(requestKey, requestFunction);
      
      return await requestPromise;

    } catch (error) {
      logger.error('Request deduplication error:', {
        requestKey,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Wait for an existing pending request to complete
   */
  async waitForPendingRequest(requestKey, timeout, startTime) {
    this.requestStats.deduplicatedRequests++;
    
    logger.debug('Request deduplicated - waiting for existing request', {
      requestKey,
      queueSize: this.getQueueSize(requestKey)
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeFromQueue(requestKey, resolve, reject);
        reject(new Error(`Request deduplication timeout after ${timeout}ms`));
      }, timeout);

      // Add to queue
      if (!this.requestQueue.has(requestKey)) {
        this.requestQueue.set(requestKey, []);
      }

      const queue = this.requestQueue.get(requestKey);
      
      // Limit queue size to prevent memory issues
      if (queue.length >= this.config.maxQueueSize) {
        clearTimeout(timeoutId);
        reject(new Error('Request queue full - too many concurrent requests'));
        return;
      }

      queue.push({
        resolve,
        reject,
        timeoutId,
        startTime
      });
    });
  }

  /**
   * Create and execute a new request
   */
  async createNewRequest(requestKey, requestFunction) {
    const requestPromise = this.executeWithCleanup(requestKey, requestFunction);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      this.resolveQueuedRequests(requestKey, result, null);
      return result;
    } catch (error) {
      this.resolveQueuedRequests(requestKey, null, error);
      throw error;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Execute request function with automatic cleanup
   */
  async executeWithCleanup(requestKey, requestFunction) {
    try {
      logger.debug('Executing new request', { requestKey });
      const result = await requestFunction();
      
      logger.debug('Request completed successfully', {
        requestKey,
        queueSize: this.getQueueSize(requestKey)
      });

      return result;
    } catch (error) {
      logger.warn('Request failed', {
        requestKey,
        error: error.message,
        queueSize: this.getQueueSize(requestKey)
      });
      throw error;
    }
  }

  /**
   * Resolve all queued requests for a given key
   */
  resolveQueuedRequests(requestKey, result, error) {
    const queue = this.requestQueue.get(requestKey);
    
    if (!queue || queue.length === 0) {
      return;
    }

    const resolvedCount = queue.length;
    this.requestStats.savedApiCalls += resolvedCount;

    logger.info('Resolving queued duplicate requests', {
      requestKey,
      queueSize: resolvedCount,
      success: !error
    });

    // Calculate average wait time
    const currentTime = Date.now();
    const totalWaitTime = queue.reduce((sum, item) => sum + (currentTime - item.startTime), 0);
    const averageWait = totalWaitTime / resolvedCount;
    
    // Update running average
    this.requestStats.averageWaitTime = 
      (this.requestStats.averageWaitTime + averageWait) / 2;

    // Resolve or reject all waiting requests
    queue.forEach(({ resolve, reject, timeoutId }) => {
      clearTimeout(timeoutId);
      
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });

    // Clear the queue
    this.requestQueue.delete(requestKey);
  }

  /**
   * Remove specific request from queue
   */
  removeFromQueue(requestKey, resolve, reject) {
    const queue = this.requestQueue.get(requestKey);
    
    if (!queue) {
      return;
    }

    const index = queue.findIndex(item => 
      item.resolve === resolve && item.reject === reject
    );

    if (index !== -1) {
      queue.splice(index, 1);
      
      if (queue.length === 0) {
        this.requestQueue.delete(requestKey);
      }
    }
  }

  /**
   * Get queue size for a request key
   */
  getQueueSize(requestKey) {
    const queue = this.requestQueue.get(requestKey);
    return queue ? queue.length : 0;
  }

  /**
   * Generate request key for GA4 requests
   * @param {string} dataType - Type of GA4 data
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Request options
   * @returns {string} Unique request key
   */
  generateGA4RequestKey(dataType, propertyId, options = {}) {
    const { startDate, endDate, dimensions = [], limit = 100 } = options;
    
    // Create deterministic key
    const sortedDimensions = [...dimensions].sort();
    const keyParts = [
      'ga4',
      dataType,
      propertyId.replace('properties/', ''),
      startDate || 'nostart',
      endDate || 'noend',
      sortedDimensions.join(',') || 'nodims',
      limit.toString()
    ];

    return keyParts.join(':');
  }

  /**
   * Generate request key for batch operations
   * @param {Array} requests - Array of request specifications
   * @returns {string} Batch request key
   */
  generateBatchRequestKey(requests) {
    const sortedRequests = requests
      .map(req => this.generateGA4RequestKey(req.dataType, req.propertyId, req.options))
      .sort();
    
    return `batch:${sortedRequests.join('|')}`;
  }

  /**
   * Check if request is currently pending
   * @param {string} requestKey - Request key to check
   * @returns {boolean} True if request is pending
   */
  isPending(requestKey) {
    return this.pendingRequests.has(requestKey);
  }

  /**
   * Get current deduplication statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.requestStats,
      pendingRequests: this.pendingRequests.size,
      queuedRequests: Array.from(this.requestQueue.values())
        .reduce((total, queue) => total + queue.length, 0),
      deduplicationRate: this.requestStats.totalRequests > 0 
        ? (this.requestStats.deduplicatedRequests / this.requestStats.totalRequests * 100).toFixed(1) + '%'
        : '0%',
      apiCallsSaved: this.requestStats.savedApiCalls
    };
  }

  /**
   * Get detailed queue information
   * @returns {Object} Queue details
   */
  getQueueDetails() {
    const queueDetails = {};
    
    this.requestQueue.forEach((queue, requestKey) => {
      queueDetails[requestKey] = {
        queueSize: queue.length,
        oldestWaitTime: queue.length > 0 
          ? Date.now() - Math.min(...queue.map(item => item.startTime))
          : 0,
        averageWaitTime: queue.length > 0
          ? queue.reduce((sum, item) => sum + (Date.now() - item.startTime), 0) / queue.length
          : 0
      };
    });

    return {
      totalQueues: this.requestQueue.size,
      queueDetails,
      pendingRequests: Array.from(this.pendingRequests.keys())
    };
  }

  /**
   * Clear specific request from pending and queue
   * @param {string} requestKey - Request key to clear
   */
  clearRequest(requestKey) {
    // Clear pending request
    this.pendingRequests.delete(requestKey);
    
    // Clear and reject queued requests
    const queue = this.requestQueue.get(requestKey);
    if (queue) {
      queue.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Request manually cleared'));
      });
      this.requestQueue.delete(requestKey);
    }

    logger.info('Request manually cleared', { requestKey });
  }

  /**
   * Clear all pending requests and queues
   */
  clearAll() {
    const clearedPending = this.pendingRequests.size;
    const clearedQueued = Array.from(this.requestQueue.values())
      .reduce((total, queue) => total + queue.length, 0);

    // Clear all pending requests
    this.pendingRequests.clear();

    // Clear and reject all queued requests
    this.requestQueue.forEach((queue) => {
      queue.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('All requests cleared'));
      });
    });
    this.requestQueue.clear();

    logger.info('All requests cleared', {
      clearedPending,
      clearedQueued
    });

    return { clearedPending, clearedQueued };
  }

  /**
   * Start cleanup process for stale requests
   */
  startCleanupProcess() {
    setInterval(() => {
      this.cleanupStaleRequests();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up stale requests that have been waiting too long
   */
  cleanupStaleRequests() {
    const currentTime = Date.now();
    const maxAge = this.config.maxWaitTime * 2; // Cleanup threshold
    let cleanedCount = 0;

    this.requestQueue.forEach((queue, requestKey) => {
      const staleItems = [];
      
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        const age = currentTime - item.startTime;
        
        if (age > maxAge) {
          clearTimeout(item.timeoutId);
          item.reject(new Error(`Request cleanup - waited ${age}ms`));
          queue.splice(i, 1);
          staleItems.push(i);
          cleanedCount++;
        }
      }

      if (queue.length === 0) {
        this.requestQueue.delete(requestKey);
      }

      if (staleItems.length > 0) {
        logger.warn('Cleaned up stale queued requests', {
          requestKey,
          cleanedCount: staleItems.length,
          remainingInQueue: queue.length
        });
      }
    });

    if (cleanedCount > 0) {
      logger.info('Request cleanup completed', {
        totalCleaned: cleanedCount,
        remainingQueues: this.requestQueue.size,
        pendingRequests: this.pendingRequests.size
      });
    }
  }

  /**
   * Reset all statistics (for testing or maintenance)
   */
  resetStats() {
    this.requestStats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      savedApiCalls: 0,
      averageWaitTime: 0
    };
    
    logger.info('Request deduplication statistics reset');
  }

  /**
   * Check system health
   */
  getHealthStatus() {
    const stats = this.getStats();
    const queueDetails = this.getQueueDetails();
    
    const health = {
      status: 'healthy',
      pendingRequests: stats.pendingRequests,
      queuedRequests: stats.queuedRequests,
      deduplicationRate: stats.deduplicationRate,
      averageWaitTime: Math.round(this.requestStats.averageWaitTime),
      issues: []
    };

    // Check for potential issues
    if (stats.queuedRequests > 50) {
      health.issues.push('High number of queued requests');
      health.status = 'degraded';
    }

    if (this.requestStats.averageWaitTime > 5000) {
      health.issues.push('High average wait time for duplicate requests');
      health.status = 'degraded';
    }

    if (stats.pendingRequests > 20) {
      health.issues.push('High number of concurrent pending requests');
      health.status = 'degraded';
    }

    return health;
  }
}

// Create singleton instance
const requestDeduplication = new RequestDeduplication();

module.exports = { RequestDeduplication, requestDeduplication };