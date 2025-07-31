/**
 * Redis Client Utilities for GA4 API Service
 * Phase 5.4.2: Redis Connection Management and Basic Operations
 */

const redis = require('redis');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.retryDelay = 2000; // 2 seconds
    
    // Configuration from environment variables
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      username: process.env.REDIS_USERNAME || undefined,
      database: process.env.REDIS_DATABASE || 0,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 1000,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: false
    };

    // Default expiration times (in seconds)
    this.defaultTTL = {
      sessions: 3600,      // 1 hour
      users: 3600,         // 1 hour  
      traffic: 1800,       // 30 minutes
      pages: 1800,         // 30 minutes
      conversions: 7200,   // 2 hours
      summary: 900,        // 15 minutes
      health: 300          // 5 minutes
    };
  }

  /**
   * Initialize Redis connection
   * @returns {Promise<boolean>} Success status
   */
  async connect() {
    try {
      // Skip Redis connection if host is 'skip'
      if (this.config.host === 'skip') {
        logger.info('Redis connection skipped (host=skip)');
        return true;
      }
      
      if (this.isConnected && this.client) {
        logger.info('Redis client already connected');
        return true;
      }

      logger.info('Initializing Redis connection...', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

      // Create Redis client with configuration
      const redisUrl = this.buildRedisUrl();
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: this.config.connectTimeout,
          commandTimeout: this.config.commandTimeout,
          reconnectStrategy: (retries) => {
            if (retries > this.maxConnectionAttempts) {
              logger.error('Redis max connection attempts exceeded');
              return new Error('Redis connection failed');
            }
            const delay = Math.min(retries * this.retryDelay, 10000);
            logger.warn(`Redis reconnection attempt ${retries} in ${delay}ms`);
            return delay;
          }
        },
        database: this.config.database
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis with timeout to prevent blocking
      const connectionPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
      });

      await Promise.race([connectionPromise, timeoutPromise]);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      logger.info('Redis connection established successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

      // Test connection with ping
      await this.ping();
      
      return true;

    } catch (error) {
      this.connectionAttempts++;
      this.isConnected = false;
      
      logger.error('Failed to connect to Redis:', {
        error: error.message,
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database
        }
      });

      // Don't retry automatically in connect() - let the caller decide
      return false;
    }
  }

  /**
   * Build Redis connection URL
   * @returns {string} Redis connection URL
   */
  buildRedisUrl() {
    let url = 'redis://';
    
    if (this.config.username && this.config.password) {
      url += `${this.config.username}:${this.config.password}@`;
    } else if (this.config.password) {
      url += `:${this.config.password}@`;
    }
    
    url += `${this.config.host}:${this.config.port}`;
    
    if (this.config.database && this.config.database !== 0) {
      url += `/${this.config.database}`;
    }
    
    return url;
  }

  /**
   * Set up Redis event listeners
   */
  setupEventListeners() {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready for operations');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', {
        error: error.message,
        code: error.code
      });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Disconnect from Redis
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        logger.info('Redis connection closed gracefully');
      }
      this.isConnected = false;
      this.client = null;
    } catch (error) {
      logger.error('Error closing Redis connection:', error.message);
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Check if Redis is connected and responsive
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      const result = await this.client.ping();
      const success = result === 'PONG';
      
      if (success) {
        logger.debug('Redis ping successful');
      } else {
        logger.warn('Redis ping returned unexpected result:', result);
      }
      
      return success;
    } catch (error) {
      logger.error('Redis ping failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Basic Redis Operations
   */

  /**
   * Set a value in Redis with optional expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      if (!this.isConnected || !this.client || this.config.host === 'skip') {
        logger.debug('Redis not available, skipping set operation');
        return false;
      }

      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      logger.debug('Redis SET successful', {
        key,
        ttl,
        size: serializedValue.length
      });

      return true;
    } catch (error) {
      logger.error('Redis SET failed:', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get a value from Redis
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Retrieved value or null
   */
  async get(key) {
    try {
      if (!this.isConnected || !this.client || this.config.host === 'skip') {
        logger.debug('Redis not available, skipping get operation');
        return null;
      }

      const value = await this.client.get(key);
      
      if (value === null) {
        logger.debug('Redis GET - key not found', { key });
        return null;
      }

      const deserializedValue = JSON.parse(value);
      
      logger.debug('Redis GET successful', {
        key,
        size: value.length
      });

      return deserializedValue;
    } catch (error) {
      logger.error('Redis GET failed:', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      if (!this.isConnected || !this.client || this.config.host === 'skip') {
        logger.debug('Redis not available, skipping delete operation');
        return false;
      }

      const result = await this.client.del(key);
      const success = result > 0;

      logger.debug('Redis DEL result', {
        key,
        deleted: success
      });

      return success;
    } catch (error) {
      logger.error('Redis DEL failed:', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if a key exists in Redis
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Key existence status
   */
  async exists(key) {
    try {
      if (!this.isConnected || !this.client || this.config.host === 'skip') {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS failed:', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Set expiration for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl) {
    try {
      if (!this.isConnected || !this.client || this.config.host === 'skip') {
        return false;
      }

      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE failed:', {
        key,
        ttl,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get remaining time to live for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    try {
      if (!this.isConnected || !this.client) {
        return -2;
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL failed:', {
        key,
        error: error.message
      });
      return -2;
    }
  }

  /**
   * GA4-Specific Cache Operations
   */

  /**
   * Generate cache key for GA4 data
   * @param {string} dataType - Type of data (sessions, users, traffic, etc.)
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Query options (dateRange, dimensions, etc.)
   * @returns {string} Cache key
   */
  generateCacheKey(dataType, propertyId, options = {}) {
    const { startDate, endDate, dimensions = [], limit = 100 } = options;
    
    // Create a deterministic key based on parameters
    const keyParts = [
      'ga4',
      dataType,
      propertyId.replace('properties/', ''),
      startDate || 'nostart',
      endDate || 'noend',
      dimensions.sort().join(',') || 'nodims',
      limit.toString()
    ];

    return keyParts.join(':');
  }

  /**
   * Cache GA4 data with appropriate TTL
   * @param {string} dataType - Type of data
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Query options
   * @param {any} data - Data to cache
   * @returns {Promise<boolean>} Success status
   */
  async cacheGA4Data(dataType, propertyId, options, data) {
    try {
      const key = this.generateCacheKey(dataType, propertyId, options);
      const ttl = this.defaultTTL[dataType] || this.defaultTTL.summary;

      // Add caching metadata
      const cacheData = {
        data: data,
        cached_at: new Date().toISOString(),
        cache_key: key,
        data_type: dataType,
        property_id: propertyId,
        options: options,
        ttl: ttl
      };

      const success = await this.set(key, cacheData, ttl);

      if (success) {
        logger.info('GA4 data cached successfully', {
          dataType,
          propertyId,
          key,
          ttl,
          dataSize: JSON.stringify(data).length
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache GA4 data:', {
        dataType,
        propertyId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Retrieve cached GA4 data
   * @param {string} dataType - Type of data
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Query options
   * @returns {Promise<any|null>} Cached data or null
   */
  async getCachedGA4Data(dataType, propertyId, options) {
    try {
      const key = this.generateCacheKey(dataType, propertyId, options);
      const cachedData = await this.get(key);

      if (cachedData) {
        logger.info('GA4 data retrieved from cache', {
          dataType,
          propertyId,
          key,
          cachedAt: cachedData.cached_at
        });

        return cachedData.data;
      }

      logger.debug('GA4 data not found in cache', {
        dataType,
        propertyId,
        key
      });

      return null;
    } catch (error) {
      logger.error('Failed to retrieve cached GA4 data:', {
        dataType,
        propertyId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Clear cache for specific GA4 data type or property
   * @param {string} pattern - Pattern to match (e.g., 'ga4:sessions:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearCache(pattern) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        logger.info('No cache keys found matching pattern', { pattern });
        return 0;
      }

      const result = await this.client.del(keys);
      
      logger.info('Cache cleared', {
        pattern,
        keysDeleted: result
      });

      return result;
    } catch (error) {
      logger.error('Failed to clear cache:', {
        pattern,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get Redis connection and cache statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    try {
      if (!this.isConnected || !this.client) {
        return {
          connected: false,
          error: 'Redis not connected'
        };
      }

      const info = await this.client.info();
      const dbSize = await this.client.dbSize();
      
      // Parse relevant stats from Redis INFO command
      const stats = {
        connected: this.isConnected,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        total_keys: dbSize,
        connection_attempts: this.connectionAttempts,
        redis_info: this.parseRedisInfo(info)
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get Redis stats:', error.message);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Parse Redis INFO command output
   * @param {string} info - Redis INFO output
   * @returns {Object} Parsed information
   */
  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const parsed = {};

    lines.forEach(line => {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    });

    return {
      redis_version: parsed.redis_version,
      used_memory_human: parsed.used_memory_human,
      connected_clients: parsed.connected_clients,
      total_connections_received: parsed.total_connections_received,
      total_commands_processed: parsed.total_commands_processed,
      keyspace_hits: parsed.keyspace_hits,
      keyspace_misses: parsed.keyspace_misses
    };
  }
}

// Create singleton instance
const redisClient = new RedisClient();

module.exports = { RedisClient, redisClient };