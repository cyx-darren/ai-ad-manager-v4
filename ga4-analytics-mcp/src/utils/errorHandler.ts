/**
 * Centralized error handling for MCP server
 */

import { logger } from './logger.js';

export enum ErrorCode {
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SHUTDOWN_ERROR = 'SHUTDOWN_ERROR',
  
  // Request errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  INVALID_PARAMS = 'INVALID_PARAMS',
  
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  CREDENTIALS_INVALID = 'CREDENTIALS_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // GA4 API errors
  GA4_API_ERROR = 'GA4_API_ERROR',
  GA4_PROPERTY_ACCESS_DENIED = 'GA4_PROPERTY_ACCESS_DENIED',
  GA4_QUOTA_EXCEEDED = 'GA4_QUOTA_EXCEEDED',
  
  // Tool errors
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_TOOL_PARAMS = 'INVALID_TOOL_PARAMS',
}

export interface MCPError {
  code: ErrorCode;
  message: string;
  details?: any;
  originalError?: Error;
  requestId?: string;
}

export class MCPErrorHandler {
  static createError(
    code: ErrorCode,
    message: string,
    details?: any,
    originalError?: Error
  ): MCPError {
    return {
      code,
      message,
      details,
      originalError,
    };
  }

  static handleError(error: MCPError | Error | unknown, requestId?: string): MCPError {
    // If it's already an MCPError, just add requestId if missing
    if (this.isMCPError(error)) {
      return { ...error, requestId: requestId || error.requestId };
    }

    // If it's a standard Error
    if (error instanceof Error) {
      logger.error('Unhandled error occurred', error, { requestId });
      
      return {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'An unexpected error occurred',
        originalError: error,
        requestId,
      };
    }

    // If it's something else (string, object, etc.)
    logger.error('Unknown error type', undefined, { error, requestId });
    
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unknown error occurred',
      details: error,
      requestId,
    };
  }

  static isMCPError(error: any): error is MCPError {
    return error && typeof error === 'object' && 'code' in error && 'message' in error;
  }

  static formatForMCPResponse(error: MCPError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error [${error.code}]: ${error.message}${
            error.details ? '\nDetails: ' + JSON.stringify(error.details, null, 2) : ''
          }`,
        },
      ],
      isError: true,
    };
  }

  static logError(error: MCPError): void {
    logger.error(
      `[${error.code}] ${error.message}`,
      error.originalError,
      {
        details: error.details,
        requestId: error.requestId,
      }
    );
  }

  // Specific error creators for common scenarios
  static authenticationFailed(details?: any): MCPError {
    return this.createError(
      ErrorCode.AUTH_FAILED,
      'Authentication failed',
      details
    );
  }

  static invalidCredentials(details?: any): MCPError {
    return this.createError(
      ErrorCode.CREDENTIALS_INVALID,
      'Invalid credentials provided',
      details
    );
  }

  static ga4ApiError(message: string, originalError?: Error): MCPError {
    return this.createError(
      ErrorCode.GA4_API_ERROR,
      `GA4 API error: ${message}`,
      undefined,
      originalError
    );
  }

  static invalidToolParams(toolName: string, params: any): MCPError {
    return this.createError(
      ErrorCode.INVALID_TOOL_PARAMS,
      `Invalid parameters for tool: ${toolName}`,
      { toolName, params }
    );
  }

  static toolExecutionFailed(toolName: string, error: Error): MCPError {
    return this.createError(
      ErrorCode.TOOL_EXECUTION_FAILED,
      `Tool execution failed: ${toolName}`,
      { toolName },
      error
    );
  }
}

// Global error handlers for uncaught exceptions
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    const mcpError = MCPErrorHandler.handleError(error);
    MCPErrorHandler.logError(mcpError);
    
    // Give some time for logging before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const mcpError = MCPErrorHandler.handleError(reason);
    MCPErrorHandler.logError(mcpError);
    
    logger.error('Unhandled promise rejection', undefined, { 
      promise: promise.toString(),
      reason: mcpError 
    });
  });
}