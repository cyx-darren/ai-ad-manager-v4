/**
 * Server lifecycle management for graceful startup and shutdown
 */

import { logger } from './logger.js';
import { MCPErrorHandler, ErrorCode } from './errorHandler.js';

export interface LifecycleHook {
  name: string;
  priority: number; // Lower numbers run first
  startup?: () => Promise<void>;
  shutdown?: () => Promise<void>;
}

export class LifecycleManager {
  private hooks: LifecycleHook[] = [];
  private isStarted = false;
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;

  constructor() {
    this.setupSignalHandlers();
  }

  addHook(hook: LifecycleHook): void {
    this.hooks.push(hook);
    // Sort by priority (lower numbers first)
    this.hooks.sort((a, b) => a.priority - b.priority);
    logger.debug(`Added lifecycle hook: ${hook.name} (priority: ${hook.priority})`);
  }

  async startup(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Server already started, ignoring startup call');
      return;
    }

    logger.info('Starting MCP server lifecycle...');
    
    try {
      // Run startup hooks in priority order
      for (const hook of this.hooks) {
        if (hook.startup) {
          logger.debug(`Running startup hook: ${hook.name}`);
          await hook.startup();
          logger.debug(`Completed startup hook: ${hook.name}`);
        }
      }

      this.isStarted = true;
      logger.info('✅ MCP server startup completed successfully');
      
    } catch (error) {
      const mcpError = MCPErrorHandler.createError(
        ErrorCode.INITIALIZATION_FAILED,
        'Server startup failed',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      
      MCPErrorHandler.logError(mcpError);
      throw mcpError;
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, waiting for completion...');
      return this.shutdownPromise;
    }

    if (!this.isStarted) {
      logger.warn('Server not started, ignoring shutdown call');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    try {
      // Run shutdown hooks in reverse priority order (high priority shuts down first)
      const shutdownHooks = [...this.hooks].reverse();
      
      for (const hook of shutdownHooks) {
        if (hook.shutdown) {
          logger.debug(`Running shutdown hook: ${hook.name}`);
          
          try {
            // Give each hook a maximum of 10 seconds to complete
            await Promise.race([
              hook.shutdown(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
              ),
            ]);
            
            logger.debug(`Completed shutdown hook: ${hook.name}`);
          } catch (error) {
            logger.error(`Shutdown hook failed: ${hook.name}`, error instanceof Error ? error : new Error(String(error)));
            // Continue with other hooks even if one fails
          }
        }
      }

      this.isStarted = false;
      logger.info('✅ Graceful shutdown completed');
      
    } catch (error) {
      const mcpError = MCPErrorHandler.createError(
        ErrorCode.SHUTDOWN_ERROR,
        'Server shutdown failed',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      
      MCPErrorHandler.logError(mcpError);
      throw mcpError;
    }
  }

  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, initiating graceful shutdown...');
      this.shutdown().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('Error during shutdown', error);
        process.exit(1);
      });
    });

    // Handle SIGTERM (termination request)
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, initiating graceful shutdown...');
      this.shutdown().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('Error during shutdown', error);
        process.exit(1);
      });
    });

    // Handle SIGHUP (hang up)
    process.on('SIGHUP', () => {
      logger.info('Received SIGHUP, reloading configuration...');
      // Could implement config reload here in the future
    });
  }

  isServerStarted(): boolean {
    return this.isStarted;
  }

  isServerShuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

// Global lifecycle manager instance
export const lifecycleManager = new LifecycleManager();