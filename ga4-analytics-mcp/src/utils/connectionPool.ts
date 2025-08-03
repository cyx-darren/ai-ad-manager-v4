/**
 * Connection Pool Management for Production
 * 
 * Provides connection pooling capabilities for external services,
 * rate limiting, and resource management for production scalability.
 */

import { logger } from './productionLogger.js';
import { performanceMonitor } from './performanceMetrics.js';

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  enableHealthCheck: boolean;
}

export interface PooledConnection {
  id: string;
  created: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
  metadata?: Record<string, any>;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  averageConnectionTime: number;
}

export class ConnectionPool<T = any> {
  private connections: Map<string, PooledConnection & { resource: T }> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private config: ConnectionPoolConfig;
  private stats: ConnectionStats;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private connectionFactory: () => Promise<T>,
    private healthCheck: (resource: T) => Promise<boolean>,
    private closeConnection: (resource: T) => Promise<void>,
    config: Partial<ConnectionPoolConfig> = {}
  ) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 1,
      connectionTimeout: config.connectionTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      enableHealthCheck: config.enableHealthCheck !== false
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageWaitTime: 0,
      averageConnectionTime: 0
    };

    this.initialize();
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    try {
      // Create minimum connections
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection();
      }

      // Start health check timer
      if (this.config.enableHealthCheck) {
        this.healthCheckTimer = setInterval(() => {
          this.performHealthCheck();
        }, this.config.healthCheckInterval);
      }

      // Start cleanup timer
      this.cleanupTimer = setInterval(() => {
        this.cleanupIdleConnections();
      }, this.config.idleTimeout / 2);

      logger.info('Connection pool initialized', {
        component: 'CONNECTION_POOL',
        minConnections: this.config.minConnections,
        maxConnections: this.config.maxConnections,
        healthCheckEnabled: this.config.enableHealthCheck
      });
    } catch (error) {
      logger.error('Failed to initialize connection pool', error instanceof Error ? error : undefined, {
        component: 'CONNECTION_POOL',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<T> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        this.stats.failedRequests++;
        reject(new Error('Connection pool timeout'));
      }, this.config.connectionTimeout);

      this.waitingQueue.push({
        resolve: (connection: T) => {
          clearTimeout(timeout);
          const waitTime = Date.now() - startTime;
          this.updateAverageWaitTime(waitTime);
          this.stats.successfulRequests++;
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.stats.failedRequests++;
          reject(error);
        },
        timestamp: startTime
      });

      this.processQueue();
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(resource: T): Promise<void> {
    const connection = this.findConnectionByResource(resource);
    if (!connection) {
      logger.warn('Attempted to release unknown connection', {
        component: 'CONNECTION_POOL'
      });
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.updateStats();

    // Process waiting queue
    this.processQueue();

    logger.debug('Connection released', {
      component: 'CONNECTION_POOL',
      connectionId: connection.id,
      activeConnections: this.stats.activeConnections
    });
  }

  /**
   * Process the waiting queue
   */
  private async processQueue(): Promise<void> {
    if (this.waitingQueue.length === 0) return;

    // Try to find an idle connection
    const idleConnection = this.findIdleConnection();
    if (idleConnection) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        idleConnection.inUse = true;
        this.updateStats();
        waiter.resolve(idleConnection.resource);
        return;
      }
    }

    // Try to create a new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      try {
        const newConnection = await this.createConnection();
        const waiter = this.waitingQueue.shift();
        if (waiter) {
          newConnection.inUse = true;
          this.updateStats();
          waiter.resolve(newConnection.resource);
        }
      } catch (error) {
        logger.error('Failed to create new connection', error instanceof Error ? error : undefined, {
          component: 'CONNECTION_POOL'
        });
        
        const waiter = this.waitingQueue.shift();
        if (waiter) {
          waiter.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection & { resource: T }> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const resource = await this.connectionFactory();
      const connectionTime = Date.now() - startTime;
      this.updateAverageConnectionTime(connectionTime);

      const connection = {
        id: connectionId,
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        healthy: true,
        resource
      };

      this.connections.set(connectionId, connection);
      this.updateStats();

      // Record metrics
      performanceMonitor.incrementCounter('connection_pool_connections_created');
      performanceMonitor.recordMetric('connection_pool_connection_time', connectionTime);

      logger.debug('New connection created', {
        component: 'CONNECTION_POOL',
        connectionId,
        connectionTime,
        totalConnections: this.connections.size
      });

      return connection;
    } catch (error) {
      performanceMonitor.incrementCounter('connection_pool_connection_failures');
      logger.error('Failed to create connection', error instanceof Error ? error : undefined, {
        component: 'CONNECTION_POOL',
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find an idle connection
   */
  private findIdleConnection(): (PooledConnection & { resource: T }) | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.healthy) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Find connection by resource
   */
  private findConnectionByResource(resource: T): (PooledConnection & { resource: T }) | null {
    for (const connection of this.connections.values()) {
      if (connection.resource === resource) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.connections.values()).map(async (connection) => {
      if (connection.inUse) return; // Skip connections in use

      try {
        const isHealthy = await this.healthCheck(connection.resource);
        
        if (!isHealthy && connection.healthy) {
          logger.warn('Connection became unhealthy', {
            component: 'CONNECTION_POOL',
            connectionId: connection.id
          });
          connection.healthy = false;
        } else if (isHealthy && !connection.healthy) {
          logger.info('Connection recovered', {
            component: 'CONNECTION_POOL',
            connectionId: connection.id
          });
          connection.healthy = true;
        }
      } catch (error) {
        logger.error('Health check failed', error instanceof Error ? error : undefined, {
          component: 'CONNECTION_POOL',
          connectionId: connection.id
        });
        connection.healthy = false;
      }
    });

    await Promise.allSettled(healthCheckPromises);
    this.updateStats();
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      const idleTime = now - connection.lastUsed;
      
      // Remove unhealthy connections or connections that have been idle too long
      if (!connection.healthy || (idleTime > this.config.idleTimeout && !connection.inUse)) {
        // Don't remove if it would go below minimum connections
        if (this.connections.size > this.config.minConnections) {
          connectionsToRemove.push(id);
        }
      }
    }

    for (const id of connectionsToRemove) {
      const connection = this.connections.get(id);
      if (connection) {
        try {
          await this.closeConnection(connection.resource);
          this.connections.delete(id);
          
          logger.debug('Connection removed from pool', {
            component: 'CONNECTION_POOL',
            connectionId: id,
            reason: connection.healthy ? 'idle_timeout' : 'unhealthy'
          });
        } catch (error) {
          logger.error('Failed to close connection during cleanup', error instanceof Error ? error : undefined, {
            component: 'CONNECTION_POOL',
            connectionId: id
          });
        }
      }
    }

    this.updateStats();
  }

  /**
   * Update connection statistics
   */
  private updateStats(): void {
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;
    this.stats.idleConnections = Array.from(this.connections.values()).filter(c => !c.inUse && c.healthy).length;
    this.stats.unhealthyConnections = Array.from(this.connections.values()).filter(c => !c.healthy).length;

    // Record metrics
    performanceMonitor.recordMetric('connection_pool_total', this.stats.totalConnections);
    performanceMonitor.recordMetric('connection_pool_active', this.stats.activeConnections);
    performanceMonitor.recordMetric('connection_pool_idle', this.stats.idleConnections);
    performanceMonitor.recordMetric('connection_pool_unhealthy', this.stats.unhealthyConnections);
  }

  /**
   * Update average wait time
   */
  private updateAverageWaitTime(waitTime: number): void {
    const totalRequests = this.stats.successfulRequests;
    this.stats.averageWaitTime = (this.stats.averageWaitTime * (totalRequests - 1) + waitTime) / totalRequests;
  }

  /**
   * Update average connection time
   */
  private updateAverageConnectionTime(connectionTime: number): void {
    const totalConnections = this.connections.size;
    this.stats.averageConnectionTime = (this.stats.averageConnectionTime * (totalConnections - 1) + connectionTime) / totalConnections;
  }

  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get connection pool health status
   */
  getHealth(): {
    healthy: boolean;
    totalConnections: number;
    healthyConnections: number;
    utilizationRate: number;
    averageWaitTime: number;
  } {
    const healthyConnections = this.stats.totalConnections - this.stats.unhealthyConnections;
    const utilizationRate = this.stats.totalConnections > 0 ? 
      (this.stats.activeConnections / this.stats.totalConnections) * 100 : 0;

    return {
      healthy: this.stats.unhealthyConnections === 0 && this.waitingQueue.length === 0,
      totalConnections: this.stats.totalConnections,
      healthyConnections,
      utilizationRate,
      averageWaitTime: this.stats.averageWaitTime
    };
  }

  /**
   * Gracefully shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool', {
      component: 'CONNECTION_POOL',
      totalConnections: this.connections.size,
      activeConnections: this.stats.activeConnections
    });

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error('Connection pool is shutting down'));
    }
    this.waitingQueue.length = 0;

    // Close all connections
    const shutdownPromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        await this.closeConnection(connection.resource);
      } catch (error) {
        logger.error('Error closing connection during shutdown', error instanceof Error ? error : undefined, {
          component: 'CONNECTION_POOL',
          connectionId: connection.id
        });
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.connections.clear();
    this.updateStats();

    logger.info('Connection pool shutdown complete', {
      component: 'CONNECTION_POOL'
    });
  }
}

// Factory function for creating HTTP connection pools
export function createHttpConnectionPool(config?: Partial<ConnectionPoolConfig>) {
  return new ConnectionPool(
    async () => {
      // Create HTTP client/agent
      return {
        id: `http_${Date.now()}`,
        created: Date.now(),
        // In a real implementation, this would be an HTTP agent or client
      };
    },
    async (resource) => {
      // Perform health check (e.g., make a simple HTTP request)
      return true; // Simplified for this example
    },
    async (resource) => {
      // Close HTTP connection
      // In a real implementation, this would close the HTTP agent or client
    },
    config
  );
}

// Factory function for creating database connection pools
export function createDatabaseConnectionPool(
  connectionString: string,
  config?: Partial<ConnectionPoolConfig>
) {
  return new ConnectionPool(
    async () => {
      // Create database connection
      // This would use the actual database driver
      return {
        id: `db_${Date.now()}`,
        connectionString,
        created: Date.now(),
        // In a real implementation, this would be a database connection
      };
    },
    async (resource) => {
      // Perform health check (e.g., simple query)
      return true; // Simplified for this example
    },
    async (resource) => {
      // Close database connection
      // In a real implementation, this would close the database connection
    },
    config
  );
}

// Global connection pool instances
const connectionPools: Map<string, ConnectionPool> = new Map();

/**
 * Get or create a named connection pool
 */
export function getConnectionPool(
  name: string,
  factory?: () => ConnectionPool
): ConnectionPool | undefined {
  if (!connectionPools.has(name) && factory) {
    connectionPools.set(name, factory());
  }
  return connectionPools.get(name);
}

/**
 * Shutdown all connection pools
 */
export async function shutdownAllConnectionPools(): Promise<void> {
  const shutdownPromises = Array.from(connectionPools.values()).map(pool => pool.shutdown());
  await Promise.allSettled(shutdownPromises);
  connectionPools.clear();
}

// Initialize default pools if connection pooling is enabled
if (process.env.ENABLE_CONNECTION_POOLING === 'true') {
  const poolSize = parseInt(process.env.CONNECTION_POOL_SIZE || '10', 10);
  const connectionTimeout = parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10);

  // HTTP connection pool for external API calls
  connectionPools.set('http', createHttpConnectionPool({
    maxConnections: poolSize,
    minConnections: Math.ceil(poolSize / 4),
    connectionTimeout,
    idleTimeout: 300000, // 5 minutes
    enableHealthCheck: true
  }));

  logger.info('Connection pools initialized', {
    component: 'CONNECTION_POOL',
    enabledPools: Array.from(connectionPools.keys()),
    poolSize,
    connectionTimeout
  });
}