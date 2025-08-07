'use client';

/**
 * Permission Indicators
 * 
 * This file provides comprehensive permission status indicators for UI components
 * with 5 indicator types, 4 permission states, and accessibility support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionErrorType
} from './permissionTypes';

import {
  PermissionHealthMetrics,
  PermissionChangeEvent
} from './permissionMonitor';

// ============================================================================
// INDICATOR TYPES & STATES
// ============================================================================

/**
 * Permission indicator types
 */
export enum PermissionIndicatorType {
  BADGE = 'badge',
  ICON = 'icon',
  TOAST = 'toast',
  BANNER = 'banner',
  MODAL = 'modal'
}

/**
 * Permission states for UI display
 */
export enum PermissionState {
  VALID = 'valid',           // All permissions OK
  WARNING = 'warning',       // Some permissions missing
  ERROR = 'error',          // Critical permissions missing
  CRITICAL = 'critical'     // System-level failures
}

/**
 * Permission indicator configuration
 */
export interface PermissionIndicatorConfig {
  /** Indicator type */
  type: PermissionIndicatorType;
  /** Show permission details */
  showDetails: boolean;
  /** Enable animations */
  animated: boolean;
  /** Position for floating indicators */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  /** Auto-dismiss timeout (ms) */
  autoHide: number | null;
  /** Custom styling */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Custom color scheme */
  colors?: {
    valid: string;
    warning: string;
    error: string;
    critical: string;
  };
}

/**
 * Permission indicator data
 */
export interface PermissionIndicatorData {
  /** Current permission state */
  state: PermissionState;
  /** Current permission level */
  level: GA4PermissionLevel;
  /** Available scopes */
  scopes: GA4OAuthScope[];
  /** Missing scopes */
  missingScopes: GA4OAuthScope[];
  /** Affected operations */
  affectedOperations: GA4Operation[];
  /** Health metrics */
  health?: PermissionHealthMetrics;
  /** Last updated timestamp */
  lastUpdated: Date;
  /** Additional context */
  context?: {
    operation?: GA4Operation;
    errorType?: PermissionErrorType;
    message?: string;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PermissionIndicatorConfig = {
  type: PermissionIndicatorType.BADGE,
  showDetails: true,
  animated: true,
  position: 'top-right',
  autoHide: null,
  colors: {
    valid: '#10B981',      // Green
    warning: '#F59E0B',    // Amber
    error: '#EF4444',      // Red
    critical: '#DC2626'    // Dark Red
  }
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

/**
 * Permission state icons
 */
const PermissionIcons = {
  valid: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
  critical: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
};

// ============================================================================
// PERMISSION BADGE COMPONENT
// ============================================================================

interface PermissionBadgeProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
}

export const PermissionBadge: React.FC<PermissionBadgeProps> = ({ 
  data, 
  config = {} 
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (cfg.autoHide) {
      const timer = setTimeout(() => setIsVisible(false), cfg.autoHide);
      return () => clearTimeout(timer);
    }
  }, [cfg.autoHide]);

  if (!isVisible) return null;

  const stateColor = cfg.colors![data.state];
  const stateIcon = PermissionIcons[data.state];

  const getBadgeText = () => {
    switch (data.state) {
      case PermissionState.VALID:
        return 'Authorized';
      case PermissionState.WARNING:
        return `${data.missingScopes.length} scope(s) missing`;
      case PermissionState.ERROR:
        return 'Permission denied';
      case PermissionState.CRITICAL:
        return 'System error';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        transition-all duration-200 cursor-pointer
        ${cfg.animated ? 'hover:scale-105 transform' : ''}
        ${cfg.className || ''}
      `}
      style={{ 
        backgroundColor: `${stateColor}20`,
        color: stateColor,
        border: `1px solid ${stateColor}`
      }}
      onClick={cfg.onClick}
      role="status"
      aria-label={`Permission status: ${data.state} - ${getBadgeText()}`}
    >
      <span className="mr-1">{stateIcon}</span>
      <span>{getBadgeText()}</span>
      {cfg.showDetails && data.missingScopes.length > 0 && (
        <span className="ml-1 text-xs opacity-75">
          ({data.missingScopes.length})
        </span>
      )}
    </div>
  );
};

// ============================================================================
// PERMISSION ICON COMPONENT
// ============================================================================

interface PermissionIconProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
  size?: 'sm' | 'md' | 'lg';
}

export const PermissionIcon: React.FC<PermissionIconProps> = ({ 
  data, 
  config = {},
  size = 'md'
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [showTooltip, setShowTooltip] = useState(false);

  const stateColor = cfg.colors![data.state];
  const stateIcon = PermissionIcons[data.state];

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  };

  const getTooltipText = () => {
    const baseText = `Permission Level: ${data.level}`;
    if (data.missingScopes.length > 0) {
      return `${baseText}\nMissing: ${data.missingScopes.join(', ')}`;
    }
    return baseText;
  };

  return (
    <div className="relative inline-block">
      <div
        className={`
          ${sizeClasses[size]} transition-all duration-200 cursor-pointer
          ${cfg.animated ? 'hover:scale-110 transform' : ''}
          ${cfg.className || ''}
        `}
        style={{ color: stateColor }}
        onClick={cfg.onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="img"
        aria-label={getTooltipText()}
      >
        {stateIcon}
      </div>
      
      {showTooltip && cfg.showDetails && (
        <div className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-pre-line -top-8 -left-8 min-w-max">
          {getTooltipText()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PERMISSION TOAST COMPONENT
// ============================================================================

interface PermissionToastProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
  onDismiss?: () => void;
}

export const PermissionToast: React.FC<PermissionToastProps> = ({ 
  data, 
  config = {},
  onDismiss
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (cfg.autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, cfg.autoHide);
      return () => clearTimeout(timer);
    }
  }, [cfg.autoHide, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const stateColor = cfg.colors![data.state];
  const stateIcon = PermissionIcons[data.state];

  const getPositionClasses = () => {
    const base = 'fixed z-50 transition-all duration-300';
    switch (cfg.position) {
      case 'top-left': return `${base} top-4 left-4`;
      case 'top-right': return `${base} top-4 right-4`;
      case 'bottom-left': return `${base} bottom-4 left-4`;
      case 'bottom-right': return `${base} bottom-4 right-4`;
      case 'center': return `${base} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
      default: return `${base} top-4 right-4`;
    }
  };

  return (
    <div
      className={`
        ${getPositionClasses()}
        max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto
        ring-1 ring-black ring-opacity-5 overflow-hidden
        ${cfg.animated ? 'animate-slide-in-right' : ''}
        ${cfg.className || ''}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div style={{ color: stateColor }}>
              {stateIcon}
            </div>
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">
              {data.state === PermissionState.VALID && 'Permissions OK'}
              {data.state === PermissionState.WARNING && 'Limited Permissions'}
              {data.state === PermissionState.ERROR && 'Permission Denied'}
              {data.state === PermissionState.CRITICAL && 'Critical Error'}
            </p>
            {cfg.showDetails && (
              <p className="mt-1 text-sm text-gray-500">
                {data.context?.message || 
                 (data.missingScopes.length > 0 
                   ? `Missing ${data.missingScopes.length} required scope(s)`
                   : 'All required permissions are available'
                 )}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={handleDismiss}
              aria-label="Dismiss notification"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PERMISSION BANNER COMPONENT
// ============================================================================

interface PermissionBannerProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
  onDismiss?: () => void;
}

export const PermissionBanner: React.FC<PermissionBannerProps> = ({ 
  data, 
  config = {},
  onDismiss
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || data.state === PermissionState.VALID) return null;

  const stateColor = cfg.colors![data.state];
  const stateIcon = PermissionIcons[data.state];

  const getBannerStyle = () => {
    switch (data.state) {
      case PermissionState.WARNING:
        return 'bg-yellow-50 border-yellow-200';
      case PermissionState.ERROR:
        return 'bg-red-50 border-red-200';
      case PermissionState.CRITICAL:
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div
      className={`
        ${getBannerStyle()}
        border-l-4 p-4 transition-all duration-300
        ${cfg.animated ? 'animate-slide-down' : ''}
        ${cfg.className || ''}
      `}
      style={{ borderLeftColor: stateColor }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <div style={{ color: stateColor }}>
            {stateIcon}
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium" style={{ color: stateColor }}>
            {data.state === PermissionState.WARNING && 'Limited GA4 Access'}
            {data.state === PermissionState.ERROR && 'GA4 Access Denied'}
            {data.state === PermissionState.CRITICAL && 'GA4 Service Unavailable'}
          </h3>
          {cfg.showDetails && (
            <div className="mt-2 text-sm text-gray-700">
              <p>
                {data.context?.message || 
                 (data.missingScopes.length > 0 
                   ? `You're missing ${data.missingScopes.length} required permission(s): ${data.missingScopes.join(', ')}`
                   : 'Unable to access GA4 data at this time'
                 )}
              </p>
              {data.affectedOperations.length > 0 && (
                <p className="mt-1">
                  <span className="font-medium">Affected features:</span> {data.affectedOperations.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            className="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PERMISSION MODAL COMPONENT
// ============================================================================

interface PermissionModalProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ 
  data, 
  config = {},
  isOpen,
  onClose
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stateColor = cfg.colors![data.state];
  const stateIcon = PermissionIcons[data.state];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`
          inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl 
          transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6
          ${cfg.animated ? 'animate-modal-enter' : ''}
          ${cfg.className || ''}
        `}>
          <div className="sm:flex sm:items-start">
            <div className={`
              mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10
              ${data.state === PermissionState.WARNING ? 'bg-yellow-100' : ''}
              ${data.state === PermissionState.ERROR ? 'bg-red-100' : ''}
              ${data.state === PermissionState.CRITICAL ? 'bg-red-100' : ''}
            `}>
              <div style={{ color: stateColor }}>
                {stateIcon}
              </div>
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                {data.state === PermissionState.WARNING && 'Limited GA4 Permissions'}
                {data.state === PermissionState.ERROR && 'GA4 Access Denied'}
                {data.state === PermissionState.CRITICAL && 'GA4 System Error'}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {data.context?.message || 
                   (data.missingScopes.length > 0 
                     ? `Your account is missing ${data.missingScopes.length} required permission(s) to access this feature.`
                     : 'There was an error accessing your GA4 permissions.'
                   )}
                </p>
                {cfg.showDetails && data.missingScopes.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-900">Missing Permissions:</h4>
                    <ul className="mt-1 text-sm text-gray-500 list-disc list-inside">
                      {data.missingScopes.map((scope) => (
                        <li key={scope}>{scope}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {cfg.showDetails && data.affectedOperations.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-900">Affected Features:</h4>
                    <ul className="mt-1 text-sm text-gray-500 list-disc list-inside">
                      {data.affectedOperations.map((operation) => (
                        <li key={operation}>{operation.replace('_', ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={() => {
                cfg.onClick?.();
                onClose();
              }}
            >
              Request Access
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PERMISSION INDICATOR COMPONENT
// ============================================================================

interface PermissionIndicatorProps {
  data: PermissionIndicatorData;
  config?: Partial<PermissionIndicatorConfig>;
  onDismiss?: () => void;
  onAction?: () => void;
}

export const PermissionIndicator: React.FC<PermissionIndicatorProps> = ({ 
  data, 
  config = {},
  onDismiss,
  onAction
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config, onClick: onAction };
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open modal for critical errors
  useEffect(() => {
    if (data.state === PermissionState.CRITICAL && cfg.type === PermissionIndicatorType.MODAL) {
      setModalOpen(true);
    }
  }, [data.state, cfg.type]);

  const handleModalToggle = () => {
    if (cfg.type === PermissionIndicatorType.MODAL) {
      setModalOpen(!modalOpen);
    } else {
      onAction?.();
    }
  };

  const commonProps = {
    data,
    config: { ...cfg, onClick: handleModalToggle },
    onDismiss
  };

  switch (cfg.type) {
    case PermissionIndicatorType.BADGE:
      return <PermissionBadge {...commonProps} />;
    
    case PermissionIndicatorType.ICON:
      return <PermissionIcon {...commonProps} />;
    
    case PermissionIndicatorType.TOAST:
      return <PermissionToast {...commonProps} />;
    
    case PermissionIndicatorType.BANNER:
      return <PermissionBanner {...commonProps} />;
    
    case PermissionIndicatorType.MODAL:
      return (
        <>
          <PermissionBadge {...commonProps} />
          <PermissionModal 
            {...commonProps} 
            isOpen={modalOpen} 
            onClose={() => setModalOpen(false)} 
          />
        </>
      );
    
    default:
      return <PermissionBadge {...commonProps} />;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine permission state from data
 */
export const determinePermissionState = (
  level: GA4PermissionLevel,
  requiredLevel: GA4PermissionLevel,
  scopes: GA4OAuthScope[],
  requiredScopes: GA4OAuthScope[],
  health?: PermissionHealthMetrics
): PermissionState => {
  // Critical system errors
  if (health && health.validity && !health.validity.isValid) {
    return PermissionState.CRITICAL;
  }

  // Check permission level
  const levelHierarchy = {
    [GA4PermissionLevel.NONE]: 0,
    [GA4PermissionLevel.READ]: 1,
    [GA4PermissionLevel.ANALYZE]: 2,
    [GA4PermissionLevel.COLLABORATE]: 3,
    [GA4PermissionLevel.EDIT]: 4,
    [GA4PermissionLevel.ADMIN]: 5
  };

  if (levelHierarchy[level] < levelHierarchy[requiredLevel]) {
    return PermissionState.ERROR;
  }

  // Check missing scopes
  const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
  if (missingScopes.length > 0) {
    return missingScopes.length >= requiredScopes.length / 2 
      ? PermissionState.ERROR 
      : PermissionState.WARNING;
  }

  return PermissionState.VALID;
};

/**
 * Create permission indicator data from permissions
 */
export const createPermissionIndicatorData = (
  permissions: GA4TokenPermissions,
  requiredLevel: GA4PermissionLevel = GA4PermissionLevel.READ,
  requiredScopes: GA4OAuthScope[] = [],
  health?: PermissionHealthMetrics,
  context?: PermissionIndicatorData['context']
): PermissionIndicatorData => {
  const missingScopes = requiredScopes.filter(scope => !permissions.scopes.includes(scope));
  const state = determinePermissionState(
    permissions.level,
    requiredLevel,
    permissions.scopes,
    requiredScopes,
    health
  );

  return {
    state,
    level: permissions.level,
    scopes: permissions.scopes,
    missingScopes,
    affectedOperations: [], // Would be populated based on missing scopes
    health,
    lastUpdated: new Date(),
    context
  };
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for managing permission indicator state
 */
export const usePermissionIndicator = (
  permissions: GA4TokenPermissions,
  requiredLevel: GA4PermissionLevel = GA4PermissionLevel.READ,
  requiredScopes: GA4OAuthScope[] = []
) => {
  const [indicatorData, setIndicatorData] = useState<PermissionIndicatorData>(
    createPermissionIndicatorData(permissions, requiredLevel, requiredScopes)
  );

  const [health, setHealth] = useState<PermissionHealthMetrics | undefined>();

  // Update indicator data when permissions change
  useEffect(() => {
    setIndicatorData(createPermissionIndicatorData(
      permissions,
      requiredLevel,
      requiredScopes,
      health
    ));
  }, [permissions, requiredLevel, requiredScopes, health]);

  const updateHealth = useCallback((newHealth: PermissionHealthMetrics) => {
    setHealth(newHealth);
  }, []);

  const updateContext = useCallback((context: PermissionIndicatorData['context']) => {
    setIndicatorData(prev => ({ ...prev, context, lastUpdated: new Date() }));
  }, []);

  return {
    indicatorData,
    updateHealth,
    updateContext
  };
};

export default PermissionIndicator;