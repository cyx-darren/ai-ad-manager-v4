/**
 * MCP Error Boundary Component
 * 
 * This component provides error boundary functionality specifically for MCP-related
 * errors, with recovery mechanisms and error state management.
 */

'use client';

import * as React from 'react';
import { Component, ReactNode, ErrorInfo } from 'react';
import { MCPConnectionState } from '../client';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * MCP Error boundary configuration
 */
export interface MCPErrorBoundaryConfig {
  // Error handling behavior
  enableAutoRecovery?: boolean;
  maxRecoveryAttempts?: number;
  recoveryDelay?: number;
  
  // UI behavior
  showErrorDetails?: boolean;
  enableErrorReporting?: boolean;
  customErrorComponent?: React.ComponentType<MCPErrorDisplayProps>;
  
  // Logging and debugging
  enableErrorLogging?: boolean;
  logErrorsToConsole?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo, context: MCPErrorContext) => void;
  
  // Recovery callbacks
  onRecoveryAttempt?: (attempt: number, error: Error) => void;
  onRecoverySuccess?: (attempt: number) => void;
  onRecoveryFailure?: (error: Error, totalAttempts: number) => void;
}

/**
 * Error context information
 */
export interface MCPErrorContext {
  timestamp: Date;
  errorBoundaryId: string;
  userAgent?: string;
  url?: string;
  connectionState?: MCPConnectionState;
  additionalContext?: Record<string, any>;
}

/**
 * Error boundary state
 */
export interface MCPErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorContext?: MCPErrorContext;
  recoveryAttempts: number;
  isRecovering: boolean;
  lastRecoveryAttempt?: Date;
  errorHistory: Array<{
    error: Error;
    timestamp: Date;
    context: MCPErrorContext;
    recovered: boolean;
  }>;
}

/**
 * Error boundary props
 */
export interface MCPErrorBoundaryProps {
  children: ReactNode;
  config?: MCPErrorBoundaryConfig;
  fallback?: React.ComponentType<MCPErrorDisplayProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Error display component props
 */
export interface MCPErrorDisplayProps {
  error: Error;
  errorInfo?: ErrorInfo;
  errorContext?: MCPErrorContext;
  recoveryAttempts: number;
  isRecovering: boolean;
  onRetry: () => void;
  onReset: () => void;
  config: MCPErrorBoundaryConfig;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultConfig: MCPErrorBoundaryConfig = {
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryDelay: 5000, // 5 seconds
  showErrorDetails: process.env.NODE_ENV === 'development',
  enableErrorReporting: true,
  enableErrorLogging: true,
  logErrorsToConsole: process.env.NODE_ENV === 'development'
};

// ============================================================================
// DEFAULT ERROR DISPLAY COMPONENT
// ============================================================================

/**
 * Default error display component
 */
const DefaultMCPErrorDisplay: React.FC<MCPErrorDisplayProps> = ({
  error,
  errorInfo,
  errorContext,
  recoveryAttempts,
  isRecovering,
  onRetry,
  onReset,
  config
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mb-4">
          <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        {/* Error Title */}
        <h2 className="text-xl font-semibold text-red-800 mb-2">
          MCP Connection Error
        </h2>

        {/* Error Message */}
        <p className="text-red-700 mb-4">
          {error.message || 'An unexpected error occurred with the MCP connection.'}
        </p>

        {/* Recovery Information */}
        {recoveryAttempts > 0 && (
          <p className="text-sm text-red-600 mb-4">
            Recovery attempts: {recoveryAttempts}/{config.maxRecoveryAttempts}
          </p>
        )}

        {/* Recovery Status */}
        {isRecovering && (
          <div className="mb-4">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Attempting recovery...
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRetry}
            disabled={isRecovering}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRecovering ? 'Recovering...' : 'Retry Connection'}
          </button>
          
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Error Details (Development Only) */}
        {config.showErrorDetails && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-red-700 font-medium">
              Error Details
            </summary>
            <div className="mt-2 p-3 bg-red-100 rounded border text-sm">
              <div className="font-medium mb-2">Error:</div>
              <pre className="text-xs text-red-800 whitespace-pre-wrap overflow-auto max-h-32">
                {error.stack || error.message}
              </pre>
              
              {errorInfo && (
                <>
                  <div className="font-medium mt-3 mb-2">Component Stack:</div>
                  <pre className="text-xs text-red-800 whitespace-pre-wrap overflow-auto max-h-32">
                    {errorInfo.componentStack}
                  </pre>
                </>
              )}
              
              {errorContext && (
                <>
                  <div className="font-medium mt-3 mb-2">Context:</div>
                  <pre className="text-xs text-red-800 whitespace-pre-wrap overflow-auto max-h-32">
                    {JSON.stringify(errorContext, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </details>
        )}

        {/* Help Text */}
        <p className="text-xs text-red-600 mt-4 opacity-75">
          If this problem persists, please check your network connection and try refreshing the page.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// MCP ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * MCP Error Boundary Class Component
 */
export class MCPErrorBoundary extends Component<MCPErrorBoundaryProps, MCPErrorBoundaryState> {
  private config: MCPErrorBoundaryConfig;
  private errorBoundaryId: string;
  private recoveryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: MCPErrorBoundaryProps) {
    super(props);
    
    this.config = { ...defaultConfig, ...props.config };
    this.errorBoundaryId = `mcp-error-boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.state = {
      hasError: false,
      recoveryAttempts: 0,
      isRecovering: false,
      errorHistory: []
    };

    // Bind methods
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.attemptRecovery = this.attemptRecovery.bind(this);
  }

  /**
   * Static method to derive state from error
   */
  static getDerivedStateFromError(error: Error): Partial<MCPErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Component did catch error
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorContext: MCPErrorContext = {
      timestamp: new Date(),
      errorBoundaryId: this.errorBoundaryId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      additionalContext: {
        props: this.props,
        config: this.config
      }
    };

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorContext,
      errorHistory: [
        ...prevState.errorHistory,
        {
          error,
          timestamp: errorContext.timestamp,
          context: errorContext,
          recovered: false
        }
      ].slice(-10) // Keep only last 10 errors
    }));

    // Log error if enabled
    if (this.config.logErrorsToConsole) {
      console.error('[MCPErrorBoundary] Error caught:', error);
      console.error('[MCPErrorBoundary] Error info:', errorInfo);
      console.error('[MCPErrorBoundary] Error context:', errorContext);
    }

    // Call custom error handler
    if (this.config.onError) {
      try {
        this.config.onError(error, errorInfo, errorContext);
      } catch (handlerError) {
        console.error('[MCPErrorBoundary] Error in custom error handler:', handlerError);
      }
    }

    // Call props error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('[MCPErrorBoundary] Error in props error handler:', handlerError);
      }
    }

    // Start auto-recovery if enabled
    if (this.config.enableAutoRecovery && this.state.recoveryAttempts < this.config.maxRecoveryAttempts!) {
      this.attemptRecovery();
    }
  }

  /**
   * Attempt automatic error recovery
   */
  private attemptRecovery() {
    if (this.state.isRecovering || this.state.recoveryAttempts >= this.config.maxRecoveryAttempts!) {
      return;
    }

    const attemptNumber = this.state.recoveryAttempts + 1;

    this.setState({
      isRecovering: true,
      recoveryAttempts: attemptNumber,
      lastRecoveryAttempt: new Date()
    });

    // Call recovery attempt callback
    if (this.config.onRecoveryAttempt) {
      this.config.onRecoveryAttempt(attemptNumber, this.state.error!);
    }

    // Set recovery timeout
    this.recoveryTimeoutId = setTimeout(() => {
      try {
        // Attempt to recover by resetting error state
        this.setState({
          hasError: false,
          error: undefined,
          errorInfo: undefined,
          isRecovering: false
        });

        // Update error history to mark as recovered
        this.setState(prevState => ({
          errorHistory: prevState.errorHistory.map((entry, index) => 
            index === prevState.errorHistory.length - 1 
              ? { ...entry, recovered: true }
              : entry
          )
        }));

        // Call recovery success callback
        if (this.config.onRecoverySuccess) {
          this.config.onRecoverySuccess(attemptNumber);
        }

        if (this.config.logErrorsToConsole) {
          console.log(`[MCPErrorBoundary] Recovery attempt ${attemptNumber} succeeded`);
        }

      } catch (recoveryError) {
        console.error('[MCPErrorBoundary] Recovery attempt failed:', recoveryError);
        
        this.setState({ isRecovering: false });

        // Call recovery failure callback if this was the last attempt
        if (attemptNumber >= this.config.maxRecoveryAttempts!) {
          if (this.config.onRecoveryFailure) {
            this.config.onRecoveryFailure(recoveryError as Error, attemptNumber);
          }
        } else {
          // Schedule next recovery attempt
          setTimeout(() => this.attemptRecovery(), this.config.recoveryDelay);
        }
      }
    }, this.config.recoveryDelay);
  }

  /**
   * Handle manual retry
   */
  private handleRetry() {
    if (this.state.isRecovering) {
      return;
    }

    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }

    this.attemptRecovery();
  }

  /**
   * Handle reset
   */
  private handleReset() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorContext: undefined,
      recoveryAttempts: 0,
      isRecovering: false,
      lastRecoveryAttempt: undefined
    });

    if (this.config.logErrorsToConsole) {
      console.log('[MCPErrorBoundary] Error boundary reset');
    }
  }

  /**
   * Component will unmount
   */
  componentWillUnmount() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
  }

  /**
   * Render method
   */
  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            errorInfo={this.state.errorInfo}
            errorContext={this.state.errorContext}
            recoveryAttempts={this.state.recoveryAttempts}
            isRecovering={this.state.isRecovering}
            onRetry={this.handleRetry}
            onReset={this.handleReset}
            config={this.config}
          />
        );
      }

      // Use custom error component from config
      if (this.config.customErrorComponent) {
        const CustomComponent = this.config.customErrorComponent;
        return (
          <CustomComponent
            error={this.state.error!}
            errorInfo={this.state.errorInfo}
            errorContext={this.state.errorContext}
            recoveryAttempts={this.state.recoveryAttempts}
            isRecovering={this.state.isRecovering}
            onRetry={this.handleRetry}
            onReset={this.handleReset}
            config={this.config}
          />
        );
      }

      // Use default error display
      return (
        <DefaultMCPErrorDisplay
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          errorContext={this.state.errorContext}
          recoveryAttempts={this.state.recoveryAttempts}
          isRecovering={this.state.isRecovering}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          config={this.config}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// FUNCTIONAL ERROR BOUNDARY WRAPPER
// ============================================================================

/**
 * Functional wrapper for MCP Error Boundary
 */
export const withMCPErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: MCPErrorBoundaryConfig
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <MCPErrorBoundary config={errorBoundaryConfig}>
      <Component {...props} />
    </MCPErrorBoundary>
  );

  WrappedComponent.displayName = `withMCPErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Export default as MCPErrorBoundary
export default MCPErrorBoundary;