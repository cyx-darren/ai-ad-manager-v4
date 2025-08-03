/**
 * MCP Error Handling Hooks
 * 
 * This file provides React hooks for handling MCP client errors,
 * including error recovery and error state management.
 */

'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useMCPContext, useMCPStatus } from '../context';
import { MCPConnectionState } from '../client';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory = 
  | 'connection' 
  | 'authentication' 
  | 'timeout' 
  | 'network' 
  | 'protocol' 
  | 'server' 
  | 'client' 
  | 'unknown';

/**
 * Enhanced error information
 */
export interface MCPError {
  id: string;
  timestamp: Date;
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  recoverable: boolean;
  retryCount: number;
  resolved: boolean;
  resolvedAt?: Date;
  customRecoveryFn?: (error: MCPError) => Promise<boolean>;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  retryableCategories: ErrorCategory[];
  customRecoveryFn?: (error: MCPError) => Promise<boolean>;
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  success: boolean;
  attempt: number;
  duration: number;
  error?: Error;
  strategy: string;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  totalErrors: number;
  resolvedErrors: number;
  unresolvedErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  averageResolutionTime: number;
  recoverySuccessRate: number;
}

/**
 * Error recovery hook return type
 */
export interface UseErrorRecoveryReturn {
  attemptRecovery: (error?: MCPError) => Promise<ErrorRecoveryResult>;
  isRecovering: boolean;
  lastRecoveryResult?: ErrorRecoveryResult;
  recoveryHistory: ErrorRecoveryResult[];
  canRecover: boolean;
  recoveryStrategy: ErrorRecoveryStrategy;
  updateRecoveryStrategy: (strategy: Partial<ErrorRecoveryStrategy>) => void;
}

/**
 * MCP errors hook return type
 */
export interface UseMCPErrorsReturn {
  errors: MCPError[];
  recentErrors: MCPError[];
  errorCount: number;
  unresolvedErrorCount: number;
  lastError?: MCPError;
  statistics: ErrorStatistics;
  addError: (error: Error, context?: Record<string, any>) => MCPError;
  resolveError: (errorId: string) => void;
  clearErrors: () => void;
  clearResolvedErrors: () => void;
  getErrorsByCategory: (category: ErrorCategory) => MCPError[];
  getErrorsBySeverity: (severity: ErrorSeverity) => MCPError[];
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const defaultRecoveryStrategy: ErrorRecoveryStrategy = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryableCategories: ['connection', 'timeout', 'network', 'server'],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Categorize error based on error message and type
 */
const categorizeError = (error: Error): ErrorCategory => {
  const message = error.message.toLowerCase();
  
  if (message.includes('connection') || message.includes('connect')) {
    return 'connection';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  }
  if (message.includes('auth') || message.includes('unauthorized')) {
    return 'authentication';
  }
  if (message.includes('protocol') || message.includes('invalid response')) {
    return 'protocol';
  }
  if (message.includes('server') || message.includes('internal')) {
    return 'server';
  }
  if (message.includes('client') || message.includes('bad request')) {
    return 'client';
  }
  
  return 'unknown';
};

/**
 * Determine error severity
 */
const determineErrorSeverity = (error: Error, category: ErrorCategory): ErrorSeverity => {
  // Critical errors that completely break functionality
  if (category === 'authentication' || category === 'protocol') {
    return 'critical';
  }
  
  // High severity for connection issues
  if (category === 'connection') {
    return 'high';
  }
  
  // Medium severity for temporary issues
  if (category === 'timeout' || category === 'network' || category === 'server') {
    return 'medium';
  }
  
  // Low severity for client-side issues
  return 'low';
};

/**
 * Check if error is recoverable
 */
const isErrorRecoverable = (category: ErrorCategory, severity: ErrorSeverity): boolean => {
  // Authentication and protocol errors are generally not recoverable
  if (category === 'authentication' || category === 'protocol') {
    return false;
  }
  
  // Critical client errors are not recoverable
  if (category === 'client' && severity === 'critical') {
    return false;
  }
  
  return true;
};

/**
 * Calculate exponential backoff delay
 */
const calculateBackoffDelay = (
  attempt: number, 
  baseDelay: number, 
  maxDelay: number, 
  backoffFactor: number
): number => {
  const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(delay, maxDelay);
};

// ============================================================================
// ERROR HANDLING HOOKS
// ============================================================================

/**
 * Hook for managing error recovery operations
 * 
 * @example
 * ```tsx
 * function ErrorRecoveryButton() {
 *   const { attemptRecovery, isRecovering, canRecover, lastRecoveryResult } = useErrorRecovery();
 *   
 *   const handleRecovery = async () => {
 *     const result = await attemptRecovery();
 *     if (result.success) {
 *       console.log(`Recovery successful after ${result.attempt} attempts`);
 *     } else {
 *       console.error('Recovery failed:', result.error);
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleRecovery} disabled={!canRecover || isRecovering}>
 *       {isRecovering ? 'Recovering...' : 'Attempt Recovery'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useErrorRecovery = (): UseErrorRecoveryReturn => {
  const { reconnect, clearError } = useMCPContext();
  const status = useMCPStatus();
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastRecoveryResult, setLastRecoveryResult] = useState<ErrorRecoveryResult>();
  const [recoveryHistory, setRecoveryHistory] = useState<ErrorRecoveryResult[]>([]);
  const [recoveryStrategy, setRecoveryStrategy] = useState<ErrorRecoveryStrategy>(defaultRecoveryStrategy);
  const recoveryAttemptRef = useRef(0);

  const attemptRecovery = useCallback(async (error?: MCPError): Promise<ErrorRecoveryResult> => {
    if (isRecovering) {
      throw new Error('Recovery operation already in progress');
    }

    setIsRecovering(true);
    recoveryAttemptRef.current += 1;
    const currentAttempt = recoveryAttemptRef.current;
    const startTime = Date.now();

    try {
      // Clear existing error state
      clearError();

      // If specific error provided, check if it's recoverable
      if (error && !error.recoverable) {
        throw new Error(`Error ${error.id} is not recoverable (category: ${error.category})`);
      }

      // Calculate delay for this attempt
      const delay = calculateBackoffDelay(
        currentAttempt,
        recoveryStrategy.baseDelay,
        recoveryStrategy.maxDelay,
        recoveryStrategy.backoffFactor
      );

      // Wait for backoff delay (except for first attempt)
      if (currentAttempt > 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Attempt recovery based on error type or current status
      if (error?.customRecoveryFn) {
        // Use custom recovery function if provided
        const success = await error.customRecoveryFn(error);
        if (!success) {
          throw new Error('Custom recovery function failed');
        }
      } else if (recoveryStrategy.customRecoveryFn && error) {
        // Use strategy's custom recovery function
        const success = await recoveryStrategy.customRecoveryFn(error);
        if (!success) {
          throw new Error('Strategy recovery function failed');
        }
      } else {
        // Default recovery: attempt reconnection
        await reconnect();
      }

      const result: ErrorRecoveryResult = {
        success: true,
        attempt: currentAttempt,
        duration: Date.now() - startTime,
        strategy: error?.customRecoveryFn ? 'custom' : 'reconnect'
      };

      setLastRecoveryResult(result);
      setRecoveryHistory(prev => [...prev.slice(-9), result]); // Keep last 10 results
      recoveryAttemptRef.current = 0; // Reset counter on success

      return result;
    } catch (recoveryError) {
      const result: ErrorRecoveryResult = {
        success: false,
        attempt: currentAttempt,
        duration: Date.now() - startTime,
        error: recoveryError as Error,
        strategy: error?.customRecoveryFn ? 'custom' : 'reconnect'
      };

      setLastRecoveryResult(result);
      setRecoveryHistory(prev => [...prev.slice(-9), result]);

      // Don't reset counter on failure - will be used for next attempt
      return result;
    } finally {
      setIsRecovering(false);
    }
  }, [isRecovering, clearError, reconnect, recoveryStrategy]);

  const updateRecoveryStrategy = useCallback((newStrategy: Partial<ErrorRecoveryStrategy>) => {
    setRecoveryStrategy(prev => ({ ...prev, ...newStrategy }));
  }, []);

  // Determine if recovery is possible
  const canRecover = status.hasError && !isRecovering && recoveryAttemptRef.current < recoveryStrategy.maxAttempts;

  return {
    attemptRecovery,
    isRecovering,
    lastRecoveryResult,
    recoveryHistory,
    canRecover,
    recoveryStrategy,
    updateRecoveryStrategy
  };
};

/**
 * Hook for managing MCP error state and statistics
 * 
 * @example
 * ```tsx
 * function ErrorDashboard() {
 *   const { 
 *     errors, 
 *     unresolvedErrorCount, 
 *     statistics, 
 *     resolveError, 
 *     clearErrors 
 *   } = useMCPErrors();
 *   
 *   return (
 *     <div>
 *       <h3>Error Dashboard</h3>
 *       <p>Total Errors: {statistics.totalErrors}</p>
 *       <p>Unresolved: {unresolvedErrorCount}</p>
 *       <p>Success Rate: {(statistics.recoverySuccessRate * 100).toFixed(1)}%</p>
 *       
 *       <button onClick={clearErrors}>Clear All Errors</button>
 *       
 *       {errors.slice(0, 5).map(error => (
 *         <div key={error.id}>
 *           <span>{error.category} - {error.severity}</span>
 *           <span>{error.error.message}</span>
 *           {!error.resolved && (
 *             <button onClick={() => resolveError(error.id)}>
 *               Mark Resolved
 *             </button>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMCPErrors = (): UseMCPErrorsReturn => {
  const status = useMCPStatus();
  const [errors, setErrors] = useState<MCPError[]>([]);

  // Add error from status changes
  useEffect(() => {
    if (status.hasError && status.lastError) {
      addError(status.lastError);
    }
  }, [status.hasError, status.lastError]);

  const addError = useCallback((error: Error, context?: Record<string, any>): MCPError => {
    const category = categorizeError(error);
    const severity = determineErrorSeverity(error, category);
    const recoverable = isErrorRecoverable(category, severity);

    const mcpError: MCPError = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      error,
      category,
      severity,
      context,
      recoverable,
      retryCount: 0,
      resolved: false
    };

    setErrors(prev => [mcpError, ...prev.slice(0, 99)]); // Keep last 100 errors
    return mcpError;
  }, []);

  const resolveError = useCallback((errorId: string) => {
    setErrors(prev => prev.map(error => 
      error.id === errorId 
        ? { ...error, resolved: true, resolvedAt: new Date() }
        : error
    ));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearResolvedErrors = useCallback(() => {
    setErrors(prev => prev.filter(error => !error.resolved));
  }, []);

  const getErrorsByCategory = useCallback((category: ErrorCategory): MCPError[] => {
    return errors.filter(error => error.category === category);
  }, [errors]);

  const getErrorsBySeverity = useCallback((severity: ErrorSeverity): MCPError[] => {
    return errors.filter(error => error.severity === severity);
  }, [errors]);

  // Calculate statistics
  const statistics: ErrorStatistics = {
    totalErrors: errors.length,
    resolvedErrors: errors.filter(e => e.resolved).length,
    unresolvedErrors: errors.filter(e => !e.resolved).length,
    errorsByCategory: errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>),
    errorsBySeverity: errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>),
    averageResolutionTime: (() => {
      const resolvedErrors = errors.filter(e => e.resolved && e.resolvedAt);
      if (resolvedErrors.length === 0) return 0;
      const totalTime = resolvedErrors.reduce((sum, error) => 
        sum + (error.resolvedAt!.getTime() - error.timestamp.getTime()), 0
      );
      return totalTime / resolvedErrors.length;
    })(),
    recoverySuccessRate: (() => {
      const recoverableErrors = errors.filter(e => e.recoverable);
      if (recoverableErrors.length === 0) return 1;
      const resolvedRecoverable = recoverableErrors.filter(e => e.resolved);
      return resolvedRecoverable.length / recoverableErrors.length;
    })()
  };

  // Get recent errors (last 10)
  const recentErrors = errors.slice(0, 10);
  
  // Get counts
  const errorCount = errors.length;
  const unresolvedErrorCount = errors.filter(e => !e.resolved).length;
  
  // Get last error
  const lastError = errors[0];

  return {
    errors,
    recentErrors,
    errorCount,
    unresolvedErrorCount,
    lastError,
    statistics,
    addError,
    resolveError,
    clearErrors,
    clearResolvedErrors,
    getErrorsByCategory,
    getErrorsBySeverity
  };
};