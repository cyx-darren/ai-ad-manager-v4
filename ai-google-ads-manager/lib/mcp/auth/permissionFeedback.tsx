'use client';

/**
 * Permission Feedback
 * 
 * This file provides complete permission error feedback system with actionable guidance,
 * contextual help, interactive troubleshooting, and user feedback collection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  PermissionErrorType
} from './permissionTypes';

import {
  PermissionErrorCategory,
  PermissionErrorSeverity,
  PermissionErrorInfo
} from './permissionErrorHandler';

// ============================================================================
// FEEDBACK TYPES & INTERFACES
// ============================================================================

/**
 * Feedback display modes
 */
export enum FeedbackDisplayMode {
  INLINE = 'inline',           // Inline with the component
  OVERLAY = 'overlay',         // Modal overlay
  SIDEBAR = 'sidebar',         // Side panel
  POPOVER = 'popover'         // Popover tooltip
}

/**
 * Resolution step types
 */
export enum ResolutionStepType {
  ACTION = 'action',           // Clickable action
  INFO = 'info',              // Information only
  WARNING = 'warning',        // Warning message
  LINK = 'link'               // External link
}

/**
 * Resolution step
 */
export interface ResolutionStep {
  /** Step ID */
  id: string;
  /** Step type */
  type: ResolutionStepType;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Action handler */
  action?: () => void | Promise<void>;
  /** External link URL */
  url?: string;
  /** Estimated time to complete */
  estimatedTime?: string;
  /** Difficulty level */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Icon component */
  icon?: React.ReactNode;
  /** Whether step is completed */
  completed?: boolean;
}

/**
 * Permission feedback data
 */
export interface PermissionFeedbackData {
  /** Error type */
  errorType: PermissionErrorType;
  /** Error category */
  category: PermissionErrorCategory;
  /** Error severity */
  severity: PermissionErrorSeverity;
  /** Error title */
  title: string;
  /** Error message */
  message: string;
  /** Technical details */
  technicalDetails?: string;
  /** Resolution steps */
  resolutionSteps: ResolutionStep[];
  /** Affected operation */
  operation?: GA4Operation;
  /** Missing permissions */
  missingPermissions?: GA4PermissionLevel[];
  /** Missing scopes */
  missingScopes?: GA4OAuthScope[];
  /** Context information */
  context?: Record<string, any>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * User feedback data
 */
export interface UserFeedback {
  /** Feedback ID */
  id: string;
  /** Error ID this feedback relates to */
  errorId: string;
  /** Whether the solution was helpful */
  wasHelpful: boolean;
  /** What the user tried */
  attemptedSolutions: string[];
  /** Whether the issue was resolved */
  isResolved: boolean;
  /** Additional comments */
  comments?: string;
  /** User satisfaction rating (1-5) */
  rating?: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Feedback configuration
 */
export interface PermissionFeedbackConfig {
  /** Display mode */
  displayMode: FeedbackDisplayMode;
  /** Show technical details */
  showTechnicalDetails: boolean;
  /** Enable user feedback collection */
  collectUserFeedback: boolean;
  /** Show estimated resolution time */
  showEstimatedTime: boolean;
  /** Enable interactive troubleshooting */
  enableTroubleshooting: boolean;
  /** Custom styling */
  className?: string;
  /** Feedback submission handler */
  onFeedbackSubmit?: (feedback: UserFeedback) => void;
  /** Resolution attempt handler */
  onResolutionAttempt?: (stepId: string, successful: boolean) => void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PermissionFeedbackConfig = {
  displayMode: FeedbackDisplayMode.INLINE,
  showTechnicalDetails: false,
  collectUserFeedback: true,
  showEstimatedTime: true,
  enableTroubleshooting: true
};

// ============================================================================
// ERROR MESSAGE TEMPLATES
// ============================================================================

const ERROR_TEMPLATES: Record<PermissionErrorType, {
  title: string;
  getMessage: (context?: any) => string;
  getSteps: (context?: any) => ResolutionStep[];
}> = {
  [PermissionErrorType.INVALID_TOKEN]: {
    title: 'Invalid Authentication Token',
    getMessage: () => 'Your authentication token is invalid or corrupted.',
    getSteps: () => [
      {
        id: 'reauth',
        type: ResolutionStepType.ACTION,
        title: 'Re-authenticate',
        description: 'Sign out and sign back in to refresh your authentication',
        estimatedTime: '2 minutes',
        difficulty: 'easy',
        action: () => window.location.href = '/auth/login'
      }
    ]
  },
  [PermissionErrorType.TOKEN_EXPIRED]: {
    title: 'Authentication Expired',
    getMessage: () => 'Your authentication has expired and needs to be renewed.',
    getSteps: () => [
      {
        id: 'refresh',
        type: ResolutionStepType.ACTION,
        title: 'Refresh Authentication',
        description: 'Click to automatically refresh your authentication',
        estimatedTime: '30 seconds',
        difficulty: 'easy'
      },
      {
        id: 'manual-reauth',
        type: ResolutionStepType.ACTION,
        title: 'Manual Re-authentication',
        description: 'If automatic refresh fails, sign in manually',
        estimatedTime: '2 minutes',
        difficulty: 'easy'
      }
    ]
  },
  [PermissionErrorType.INSUFFICIENT_PERMISSION]: {
    title: 'Insufficient Permissions',
    getMessage: (context) => `You need ${context?.requiredLevel || 'higher'} permissions to access this feature.`,
    getSteps: (context) => [
      {
        id: 'request-permission',
        type: ResolutionStepType.ACTION,
        title: 'Request Permission Upgrade',
        description: 'Contact your administrator to upgrade your permissions',
        estimatedTime: '1-2 business days',
        difficulty: 'medium'
      },
      {
        id: 'check-property',
        type: ResolutionStepType.INFO,
        title: 'Verify Property Access',
        description: 'Ensure you have access to the correct GA4 property',
        estimatedTime: '5 minutes',
        difficulty: 'easy'
      }
    ]
  },
  [PermissionErrorType.INSUFFICIENT_SCOPE]: {
    title: 'Missing OAuth Scopes',
    getMessage: (context) => `Missing required OAuth scope(s): ${context?.missingScopes?.join(', ') || 'unknown'}`,
    getSteps: (context) => [
      {
        id: 'reauthorize',
        type: ResolutionStepType.ACTION,
        title: 'Re-authorize Application',
        description: 'Grant additional permissions to access this feature',
        estimatedTime: '3 minutes',
        difficulty: 'easy'
      },
      {
        id: 'scope-info',
        type: ResolutionStepType.INFO,
        title: 'About Required Scopes',
        description: `This feature requires: ${context?.missingScopes?.join(', ') || 'additional permissions'}`,
        estimatedTime: '1 minute',
        difficulty: 'easy'
      }
    ]
  },
  [PermissionErrorType.RATE_LIMITED]: {
    title: 'Rate Limit Exceeded',
    getMessage: () => 'Too many requests. Please wait before trying again.',
    getSteps: () => [
      {
        id: 'wait',
        type: ResolutionStepType.INFO,
        title: 'Wait and Retry',
        description: 'Wait a few minutes before making more requests',
        estimatedTime: '5-15 minutes',
        difficulty: 'easy'
      },
      {
        id: 'optimize',
        type: ResolutionStepType.INFO,
        title: 'Optimize Requests',
        description: 'Consider reducing the frequency of data requests',
        estimatedTime: '10 minutes',
        difficulty: 'medium'
      }
    ]
  },
  [PermissionErrorType.NETWORK_ERROR]: {
    title: 'Network Connection Error',
    getMessage: () => 'Unable to connect to Google Analytics. Please check your internet connection.',
    getSteps: () => [
      {
        id: 'check-connection',
        type: ResolutionStepType.INFO,
        title: 'Check Internet Connection',
        description: 'Verify you have a stable internet connection',
        estimatedTime: '2 minutes',
        difficulty: 'easy'
      },
      {
        id: 'retry',
        type: ResolutionStepType.ACTION,
        title: 'Retry Request',
        description: 'Try the operation again',
        estimatedTime: '30 seconds',
        difficulty: 'easy'
      }
    ]
  }
};

// ============================================================================
// RESOLUTION STEP COMPONENT
// ============================================================================

interface ResolutionStepProps {
  step: ResolutionStep;
  index: number;
  onAttempt?: (stepId: string, successful: boolean) => void;
}

const ResolutionStepComponent: React.FC<ResolutionStepProps> = ({ 
  step, 
  index, 
  onAttempt 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(step.completed || false);

  const handleAction = async () => {
    if (!step.action) return;

    setIsLoading(true);
    try {
      await step.action();
      setIsCompleted(true);
      onAttempt?.(step.id, true);
    } catch (error) {
      console.error('Resolution step failed:', error);
      onAttempt?.(step.id, false);
    } finally {
      setIsLoading(false);
    }
  };

  const getStepIcon = () => {
    if (step.icon) return step.icon;

    switch (step.type) {
      case ResolutionStepType.ACTION:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case ResolutionStepType.INFO:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case ResolutionStepType.WARNING:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case ResolutionStepType.LINK:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStepColor = () => {
    if (isCompleted) return 'text-green-600';
    
    switch (step.type) {
      case ResolutionStepType.ACTION: return 'text-blue-600';
      case ResolutionStepType.INFO: return 'text-gray-600';
      case ResolutionStepType.WARNING: return 'text-yellow-600';
      case ResolutionStepType.LINK: return 'text-indigo-600';
      default: return 'text-gray-600';
    }
  };

  const getDifficultyBadge = () => {
    if (!step.difficulty) return null;

    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[step.difficulty]}`}>
        {step.difficulty}
      </span>
    );
  };

  return (
    <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-100' : 'bg-white'} ${getStepColor()}`}>
          {isCompleted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            getStepIcon()
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">{step.title}</h4>
          <div className="flex items-center space-x-2">
            {step.estimatedTime && (
              <span className="text-xs text-gray-500">{step.estimatedTime}</span>
            )}
            {getDifficultyBadge()}
          </div>
        </div>
        
        <p className="mt-1 text-sm text-gray-600">{step.description}</p>
        
        {step.type === ResolutionStepType.ACTION && (
          <button
            onClick={handleAction}
            disabled={isLoading || isCompleted}
            className={`
              mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded
              ${isCompleted 
                ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }
              ${isLoading ? 'cursor-wait' : ''}
            `}
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isCompleted ? 'Completed' : isLoading ? 'Processing...' : 'Try This'}
          </button>
        )}
        
        {step.type === ResolutionStepType.LINK && step.url && (
          <a
            href={step.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center text-xs text-blue-600 hover:text-blue-500"
          >
            Learn more
            <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// USER FEEDBACK COMPONENT
// ============================================================================

interface UserFeedbackProps {
  errorId: string;
  onSubmit: (feedback: UserFeedback) => void;
}

const UserFeedbackComponent: React.FC<UserFeedbackProps> = ({ errorId, onSubmit }) => {
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [isResolved, setIsResolved] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (wasHelpful === null) return;

    const feedback: UserFeedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId,
      wasHelpful,
      attemptedSolutions: [],
      isResolved: isResolved || false,
      rating: rating || undefined,
      comments: comments.trim() || undefined,
      timestamp: new Date()
    };

    onSubmit(feedback);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Thank you for your feedback!</h3>
            <p className="mt-1 text-sm text-green-700">Your input helps us improve the experience.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-blue-900 mb-3">Was this helpful?</h3>
      
      <div className="space-y-3">
        <div className="flex space-x-4">
          <button
            onClick={() => setWasHelpful(true)}
            className={`flex items-center px-3 py-1 rounded-md text-sm ${
              wasHelpful === true 
                ? 'bg-green-100 text-green-700 border-green-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } border`}
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            Yes
          </button>
          <button
            onClick={() => setWasHelpful(false)}
            className={`flex items-center px-3 py-1 rounded-md text-sm ${
              wasHelpful === false 
                ? 'bg-red-100 text-red-700 border-red-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } border`}
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
            </svg>
            No
          </button>
        </div>

        {wasHelpful === true && (
          <div>
            <label className="text-sm text-blue-900">Did this resolve your issue?</label>
            <div className="mt-1 flex space-x-4">
              <button
                onClick={() => setIsResolved(true)}
                className={`px-3 py-1 rounded text-sm ${
                  isResolved === true ? 'bg-green-100 text-green-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                } border`}
              >
                Yes, resolved
              </button>
              <button
                onClick={() => setIsResolved(false)}
                className={`px-3 py-1 rounded text-sm ${
                  isResolved === false ? 'bg-yellow-100 text-yellow-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                } border`}
              >
                Partially helped
              </button>
            </div>
          </div>
        )}

        {wasHelpful !== null && (
          <div>
            <label className="block text-sm text-blue-900 mb-1">
              Additional comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Tell us more about your experience..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={wasHelpful === null}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PERMISSION FEEDBACK COMPONENT
// ============================================================================

interface PermissionFeedbackProps {
  data: PermissionFeedbackData;
  config?: Partial<PermissionFeedbackConfig>;
}

export const PermissionFeedback: React.FC<PermissionFeedbackProps> = ({ 
  data, 
  config = {} 
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(cfg.showTechnicalDetails);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const handleResolutionAttempt = useCallback((stepId: string, successful: boolean) => {
    if (successful) {
      setCompletedSteps(prev => new Set(prev).add(stepId));
    }
    cfg.onResolutionAttempt?.(stepId, successful);
  }, [cfg]);

  const handleFeedbackSubmit = useCallback((feedback: UserFeedback) => {
    cfg.onFeedbackSubmit?.(feedback);
  }, [cfg]);

  const getSeverityColor = () => {
    switch (data.severity) {
      case PermissionErrorSeverity.LOW: return 'border-blue-200 bg-blue-50';
      case PermissionErrorSeverity.MEDIUM: return 'border-yellow-200 bg-yellow-50';
      case PermissionErrorSeverity.HIGH: return 'border-orange-200 bg-orange-50';
      case PermissionErrorSeverity.CRITICAL: return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityIcon = () => {
    switch (data.severity) {
      case PermissionErrorSeverity.LOW:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case PermissionErrorSeverity.MEDIUM:
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case PermissionErrorSeverity.HIGH:
      case PermissionErrorSeverity.CRITICAL:
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border rounded-lg p-6 ${getSeverityColor()} ${cfg.className || ''}`}>
      {/* Error Header */}
      <div className="flex items-start space-x-3 mb-4">
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon()}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">{data.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{data.message}</p>
          
          {data.operation && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Operation: {data.operation.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Technical Details */}
      {data.technicalDetails && (
        <div className="mb-4">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`w-4 h-4 mr-1 transform transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Technical Details
          </button>
          {showTechnicalDetails && (
            <div className="mt-2 p-3 bg-gray-100 rounded text-sm font-mono text-gray-800">
              {data.technicalDetails}
            </div>
          )}
        </div>
      )}

      {/* Resolution Steps */}
      {data.resolutionSteps.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Resolution Steps</h4>
          <div className="space-y-3">
            {data.resolutionSteps.map((step, index) => (
              <ResolutionStepComponent
                key={step.id}
                step={{ ...step, completed: completedSteps.has(step.id) }}
                index={index}
                onAttempt={handleResolutionAttempt}
              />
            ))}
          </div>
        </div>
      )}

      {/* User Feedback */}
      {cfg.collectUserFeedback && (
        <UserFeedbackComponent
          errorId={`error-${data.timestamp.getTime()}`}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create feedback data from error information
 */
export const createPermissionFeedbackData = (
  errorInfo: PermissionErrorInfo,
  context?: Record<string, any>
): PermissionFeedbackData => {
  const template = ERROR_TEMPLATES[errorInfo.type];
  
  if (!template) {
    return {
      errorType: errorInfo.type,
      category: errorInfo.category,
      severity: errorInfo.severity,
      title: 'Permission Error',
      message: errorInfo.message || 'An unexpected permission error occurred.',
      resolutionSteps: [],
      timestamp: new Date(),
      context
    };
  }

  return {
    errorType: errorInfo.type,
    category: errorInfo.category,
    severity: errorInfo.severity,
    title: template.title,
    message: template.getMessage(context),
    technicalDetails: errorInfo.technicalDetails,
    resolutionSteps: template.getSteps(context),
    timestamp: new Date(),
    context
  };
};

export default PermissionFeedback;