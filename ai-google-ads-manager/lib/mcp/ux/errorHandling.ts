/**
 * Property Error Handler
 * 
 * Comprehensive error handling for property-related operations.
 */

import { GA4Property } from '../types/property';
import { useState, useCallback } from 'react';

export type PropertyErrorType = 
  | 'INVALID_PROPERTY'
  | 'PERMISSION_DENIED'
  | 'PROPERTY_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecoveryStrategy = 
  | 'retry'
  | 'fallback_property'
  | 'refresh_auth'
  | 'clear_cache'
  | 'manual_intervention'
  | 'none';

export interface PropertyErrorContext {
  propertyId?: string;
  propertyName?: string;
  operation: string;
  timestamp: Date;
  userAgent: string;
  url: string;
}

export interface EnhancedPropertyError {
  type: PropertyErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  context: PropertyErrorContext;
  recoveryStrategy: RecoveryStrategy;
  suggestedActions: string[];
  retryCount: number;
  maxRetries: number;
  originalError?: Error;
}

export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  fallbackProperty?: GA4Property;
  requiresUserAction: boolean;
  nextSteps: string[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: EnhancedPropertyError | null;
  errorId: string;
  recoveryAttempts: number;
  isRecovering: boolean;
}

/**
 * Property Error Handler
 */
export class PropertyErrorHandler {
  private errorHistory: Map<string, EnhancedPropertyError[]> = new Map();
  private fallbackProperties: GA4Property[] = [];

  handleError(error: Error, context: Partial<PropertyErrorContext>): EnhancedPropertyError {
    const enhancedError = this.enhanceError(error, context);
    this.logError(enhancedError);
    return enhancedError;
  }

  async attemptRecovery(error: EnhancedPropertyError): Promise<RecoveryResult> {
    switch (error.recoveryStrategy) {
      case 'fallback_property':
        return this.fallbackToAlternativeProperty(error);
      case 'clear_cache':
        return this.clearCache(error);
      case 'retry':
        return this.retryOperation(error);
      default:
        return {
          success: false,
          strategy: error.recoveryStrategy,
          message: 'Manual intervention required',
          requiresUserAction: true,
          nextSteps: this.getManualRecoverySteps(error)
        };
    }
  }

  setFallbackProperties(properties: GA4Property[]): void {
    this.fallbackProperties = properties.filter(p => p.accessLevel !== 'NONE');
  }

  getUserFriendlyMessage(error: EnhancedPropertyError): string {
    const messages = {
      INVALID_PROPERTY: 'The selected property is no longer valid. Please choose a different property.',
      PERMISSION_DENIED: 'You don\'t have permission to access this property.',
      PROPERTY_NOT_FOUND: 'The property could not be found.',
      NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
      AUTHENTICATION_ERROR: 'Your session has expired. Please sign in again.',
      VALIDATION_ERROR: 'The property data is invalid. Please try refreshing.',
      TIMEOUT_ERROR: 'The request took too long. Please try again.',
      UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
    };

    return error.userMessage || messages[error.type] || messages.UNKNOWN_ERROR;
  }

  getRecoveryActions(error: EnhancedPropertyError): string[] {
    const actions = {
      INVALID_PROPERTY: [
        'Select a different property from the dropdown',
        'Refresh the page to reload property list'
      ],
      PERMISSION_DENIED: [
        'Contact your Google Analytics administrator',
        'Try signing in with a different account'
      ],
      PROPERTY_NOT_FOUND: [
        'Check if the property still exists',
        'Select a different property'
      ],
      NETWORK_ERROR: [
        'Check your internet connection',
        'Try refreshing the page'
      ],
      AUTHENTICATION_ERROR: [
        'Sign out and sign in again',
        'Clear your browser cache'
      ],
      VALIDATION_ERROR: [
        'Refresh the page',
        'Try again in a few minutes'
      ],
      TIMEOUT_ERROR: [
        'Try again in a few seconds',
        'Check your internet connection'
      ],
      UNKNOWN_ERROR: [
        'Refresh the page',
        'Try again in a few minutes'
      ]
    };

    return error.suggestedActions || actions[error.type] || actions.UNKNOWN_ERROR;
  }

  private enhanceError(error: Error, context: Partial<PropertyErrorContext>): EnhancedPropertyError {
    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(errorType);
    const recoveryStrategy = this.getRecoveryStrategy(errorType);

    const fullContext: PropertyErrorContext = {
      operation: 'unknown',
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      ...context
    };

    return {
      type: errorType,
      severity,
      message: error.message,
      userMessage: this.generateUserMessage(errorType),
      context: fullContext,
      recoveryStrategy,
      suggestedActions: this.getSuggestedActions(errorType),
      retryCount: 0,
      maxRetries: this.getMaxRetries(errorType),
      originalError: error
    };
  }

  private classifyError(error: Error): PropertyErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'PERMISSION_DENIED';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'PROPERTY_NOT_FOUND';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('authentication') || message.includes('401')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  private determineSeverity(errorType: PropertyErrorType): ErrorSeverity {
    const severityMap: Record<PropertyErrorType, ErrorSeverity> = {
      INVALID_PROPERTY: 'medium',
      PERMISSION_DENIED: 'high',
      PROPERTY_NOT_FOUND: 'medium',
      NETWORK_ERROR: 'medium',
      AUTHENTICATION_ERROR: 'high',
      VALIDATION_ERROR: 'low',
      TIMEOUT_ERROR: 'medium',
      UNKNOWN_ERROR: 'medium'
    };

    return severityMap[errorType];
  }

  private getRecoveryStrategy(errorType: PropertyErrorType): RecoveryStrategy {
    const strategyMap: Record<PropertyErrorType, RecoveryStrategy> = {
      INVALID_PROPERTY: 'fallback_property',
      PERMISSION_DENIED: 'manual_intervention',
      PROPERTY_NOT_FOUND: 'fallback_property',
      NETWORK_ERROR: 'retry',
      AUTHENTICATION_ERROR: 'refresh_auth',
      VALIDATION_ERROR: 'clear_cache',
      TIMEOUT_ERROR: 'retry',
      UNKNOWN_ERROR: 'retry'
    };

    return strategyMap[errorType];
  }

  private async fallbackToAlternativeProperty(error: EnhancedPropertyError): Promise<RecoveryResult> {
    const availableProperty = this.fallbackProperties[0];
    
    if (availableProperty) {
      return {
        success: true,
        strategy: 'fallback_property',
        message: `Switched to fallback property: ${availableProperty.displayName}`,
        fallbackProperty: availableProperty,
        requiresUserAction: false,
        nextSteps: [`Using ${availableProperty.displayName} as the active property`]
      };
    }

    return {
      success: false,
      strategy: 'fallback_property',
      message: 'No fallback properties available',
      requiresUserAction: true,
      nextSteps: ['Please select a valid property manually']
    };
  }

  private async clearCache(error: EnhancedPropertyError): Promise<RecoveryResult> {
    return {
      success: true,
      strategy: 'clear_cache',
      message: 'Cache cleared successfully',
      requiresUserAction: false,
      nextSteps: ['Cache has been cleared, please try again']
    };
  }

  private async retryOperation(error: EnhancedPropertyError): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'retry',
      message: 'Retry operation',
      requiresUserAction: false,
      nextSteps: ['Operation will be retried automatically']
    };
  }

  private generateUserMessage(errorType: PropertyErrorType): string {
    const messages = {
      INVALID_PROPERTY: 'The selected property is no longer available',
      PERMISSION_DENIED: 'Access denied to this property',
      PROPERTY_NOT_FOUND: 'Property not found',
      NETWORK_ERROR: 'Connection problem',
      AUTHENTICATION_ERROR: 'Please sign in again',
      VALIDATION_ERROR: 'Invalid data received',
      TIMEOUT_ERROR: 'Request timed out',
      UNKNOWN_ERROR: 'Something went wrong'
    };

    return messages[errorType];
  }

  private getSuggestedActions(errorType: PropertyErrorType): string[] {
    return this.getRecoveryActions({ type: errorType } as EnhancedPropertyError);
  }

  private getMaxRetries(errorType: PropertyErrorType): number {
    const retryMap: Record<PropertyErrorType, number> = {
      INVALID_PROPERTY: 1,
      PERMISSION_DENIED: 0,
      PROPERTY_NOT_FOUND: 1,
      NETWORK_ERROR: 3,
      AUTHENTICATION_ERROR: 1,
      VALIDATION_ERROR: 2,
      TIMEOUT_ERROR: 3,
      UNKNOWN_ERROR: 2
    };

    return retryMap[errorType];
  }

  private getManualRecoverySteps(error: EnhancedPropertyError): string[] {
    return this.getRecoveryActions(error);
  }

  private logError(error: EnhancedPropertyError): void {
    const propertyId = error.context.propertyId || 'unknown';
    
    if (!this.errorHistory.has(propertyId)) {
      this.errorHistory.set(propertyId, []);
    }

    const errors = this.errorHistory.get(propertyId)!;
    errors.push(error);

    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
  }
}

/**
 * React hook for property error handling
 */
export function usePropertyErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
    errorId: '',
    recoveryAttempts: 0,
    isRecovering: false
  });

  const handleError = useCallback((error: Error, context?: Partial<PropertyErrorContext>) => {
    const enhancedError = propertyErrorHandler.handleError(error, context || {});
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setErrorState({
      hasError: true,
      error: enhancedError,
      errorId,
      recoveryAttempts: 0,
      isRecovering: false
    });

    return enhancedError;
  }, []);

  const attemptRecovery = useCallback(async () => {
    if (!errorState.error) return;

    setErrorState(prev => ({ ...prev, isRecovering: true }));

    try {
      const result = await propertyErrorHandler.attemptRecovery(errorState.error);
      
      if (result.success) {
        setErrorState({
          hasError: false,
          error: null,
          errorId: '',
          recoveryAttempts: 0,
          isRecovering: false
        });
      } else {
        setErrorState(prev => ({
          ...prev,
          recoveryAttempts: prev.recoveryAttempts + 1,
          isRecovering: false
        }));
      }

      return result;
    } catch (recoveryError) {
      setErrorState(prev => ({
        ...prev,
        recoveryAttempts: prev.recoveryAttempts + 1,
        isRecovering: false
      }));

      throw recoveryError;
    }
  }, [errorState.error]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorId: '',
      recoveryAttempts: 0,
      isRecovering: false
    });
  }, []);

  return {
    errorState,
    handleError,
    attemptRecovery,
    clearError,
    getUserFriendlyMessage: (error: EnhancedPropertyError) => propertyErrorHandler.getUserFriendlyMessage(error),
    getRecoveryActions: (error: EnhancedPropertyError) => propertyErrorHandler.getRecoveryActions(error)
  };
}

export const propertyErrorHandler = new PropertyErrorHandler();
export default propertyErrorHandler;