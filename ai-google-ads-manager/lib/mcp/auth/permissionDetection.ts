/**
 * Permission Detection Utilities
 * 
 * This file provides utilities for detecting and analyzing user permissions
 * for GA4 properties and operations.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4PropertyPermission,
  GA4TokenPermissions,
  GA4PermissionContext,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionError,
  PermissionErrorType,
  PermissionStatus,
  CachedPermissionInfo,
  OperationPermissionMap,
  PermissionLevelOperationMap
} from './permissionTypes';

// ============================================================================
// OPERATION TO PERMISSION MAPPING
// ============================================================================

/**
 * Maps each GA4 operation to its required permission level and OAuth scopes
 */
export const OPERATION_PERMISSION_MAP: OperationPermissionMap = {
  // Data Reading Operations
  [GA4Operation.READ_REPORTS]: {
    minimumPermissionLevel: GA4PermissionLevel.READ,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Read standard GA4 reports and data'
  },
  [GA4Operation.READ_REALTIME]: {
    minimumPermissionLevel: GA4PermissionLevel.READ,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Access real-time GA4 data'
  },
  [GA4Operation.READ_AUDIENCES]: {
    minimumPermissionLevel: GA4PermissionLevel.READ,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'View audience data and segments'
  },
  [GA4Operation.READ_CONVERSIONS]: {
    minimumPermissionLevel: GA4PermissionLevel.READ,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Access conversion data and goals'
  },

  // Analysis Operations
  [GA4Operation.CREATE_CUSTOM_REPORTS]: {
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Create and save custom reports'
  },
  [GA4Operation.ACCESS_ANALYSIS_HUB]: {
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Access Analysis Hub for advanced analysis'
  },
  [GA4Operation.CREATE_SEGMENTS]: {
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Create custom audience segments'
  },

  // Configuration Operations
  [GA4Operation.EDIT_GOALS]: {
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Create and modify conversion goals'
  },
  [GA4Operation.EDIT_CONVERSIONS]: {
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Configure conversion tracking'
  },
  [GA4Operation.EDIT_AUDIENCES]: {
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Create and modify audience definitions'
  },
  [GA4Operation.EDIT_CUSTOM_DIMENSIONS]: {
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Configure custom dimensions and metrics'
  },

  // Administrative Operations
  [GA4Operation.MANAGE_USERS]: {
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    requiredScopes: [GA4OAuthScope.ANALYTICS_MANAGE_USERS],
    description: 'Manage user access and permissions'
  },
  [GA4Operation.MANAGE_PROPERTIES]: {
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Configure property settings'
  },
  [GA4Operation.MANAGE_DATA_STREAMS]: {
    minimumPermissionLevel: GA4PermissionLevel.ADMIN,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Manage data streams and collection'
  },

  // Advanced Operations
  [GA4Operation.DATA_EXPORT]: {
    minimumPermissionLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Export GA4 data via API'
  },
  [GA4Operation.MEASUREMENT_PROTOCOL]: {
    minimumPermissionLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT],
    description: 'Send data via Measurement Protocol'
  },
  [GA4Operation.REPORTING_API]: {
    minimumPermissionLevel: GA4PermissionLevel.READ,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY],
    description: 'Access GA4 Reporting API'
  }
};

/**
 * Maps permission levels to their allowed operations
 * Built step by step to avoid circular reference during initialization
 */
const NONE_OPERATIONS: GA4Operation[] = [];

const READ_OPERATIONS: GA4Operation[] = [
  GA4Operation.READ_REPORTS,
  GA4Operation.READ_REALTIME,
  GA4Operation.READ_AUDIENCES,
  GA4Operation.READ_CONVERSIONS,
  GA4Operation.REPORTING_API
];

const ANALYZE_OPERATIONS: GA4Operation[] = [
  ...READ_OPERATIONS,
  GA4Operation.CREATE_CUSTOM_REPORTS,
  GA4Operation.ACCESS_ANALYSIS_HUB,
  GA4Operation.CREATE_SEGMENTS,
  GA4Operation.DATA_EXPORT
];

const COLLABORATE_OPERATIONS: GA4Operation[] = [
  ...ANALYZE_OPERATIONS
];

const EDIT_OPERATIONS: GA4Operation[] = [
  ...COLLABORATE_OPERATIONS,
  GA4Operation.EDIT_GOALS,
  GA4Operation.EDIT_CONVERSIONS,
  GA4Operation.EDIT_AUDIENCES,
  GA4Operation.EDIT_CUSTOM_DIMENSIONS,
  GA4Operation.MEASUREMENT_PROTOCOL
];

const ADMIN_OPERATIONS: GA4Operation[] = [
  ...EDIT_OPERATIONS,
  GA4Operation.MANAGE_USERS,
  GA4Operation.MANAGE_PROPERTIES,
  GA4Operation.MANAGE_DATA_STREAMS
];

export const PERMISSION_LEVEL_OPERATIONS: PermissionLevelOperationMap = {
  [GA4PermissionLevel.NONE]: NONE_OPERATIONS,
  [GA4PermissionLevel.READ]: READ_OPERATIONS,
  [GA4PermissionLevel.ANALYZE]: ANALYZE_OPERATIONS,
  [GA4PermissionLevel.COLLABORATE]: COLLABORATE_OPERATIONS,
  [GA4PermissionLevel.EDIT]: EDIT_OPERATIONS,
  [GA4PermissionLevel.ADMIN]: ADMIN_OPERATIONS
};

// ============================================================================
// PERMISSION DETECTION FUNCTIONS
// ============================================================================

/**
 * Detects user's permission level for a specific GA4 property
 */
export function detectPropertyPermissionLevel(
  propertyPermissions: GA4PropertyPermission[],
  propertyId: string
): GA4PermissionLevel {
  const permission = propertyPermissions.find(p => p.propertyId === propertyId);
  return permission?.permissionLevel || GA4PermissionLevel.NONE;
}

/**
 * Detects which operations a user can perform on a property
 */
export function detectAllowedOperations(
  permissionLevel: GA4PermissionLevel,
  grantedScopes: GA4OAuthScope[]
): GA4Operation[] {
  const levelOperations = PERMISSION_LEVEL_OPERATIONS[permissionLevel] || [];
  
  // Filter operations based on available OAuth scopes
  return levelOperations.filter(operation => {
    const required = OPERATION_PERMISSION_MAP[operation];
    return required.requiredScopes.every(scope => grantedScopes.includes(scope));
  });
}

/**
 * Detects missing OAuth scopes for a specific operation
 */
export function detectMissingScopes(
  operation: GA4Operation,
  grantedScopes: GA4OAuthScope[]
): GA4OAuthScope[] {
  const required = OPERATION_PERMISSION_MAP[operation];
  return required.requiredScopes.filter(scope => !grantedScopes.includes(scope));
}

/**
 * Checks if a token has expired
 */
export function isTokenExpired(tokenPermissions: GA4TokenPermissions): boolean {
  const now = new Date();
  const expiresAt = new Date(tokenPermissions.expiresAt);
  return now >= expiresAt;
}

/**
 * Checks if user has sufficient permission for an operation
 */
export function hasPermissionForOperation(
  userContext: GA4PermissionContext,
  propertyId: string,
  operation: GA4Operation
): boolean {
  // Check token expiration
  if (isTokenExpired(userContext.tokenPermissions)) {
    return false;
  }

  // Get user's permission level for the property
  const permissionLevel = detectPropertyPermissionLevel(
    userContext.propertyPermissions,
    propertyId
  );

  // Check if permission level is sufficient
  const required = OPERATION_PERMISSION_MAP[operation];
  if (!isPermissionLevelSufficient(permissionLevel, required.minimumPermissionLevel)) {
    return false;
  }

  // Check OAuth scopes
  const missingScopes = detectMissingScopes(
    operation,
    userContext.tokenPermissions.grantedScopes
  );

  return missingScopes.length === 0;
}

/**
 * Checks if a permission level is sufficient for a required minimum
 */
export function isPermissionLevelSufficient(
  actual: GA4PermissionLevel,
  required: GA4PermissionLevel
): boolean {
  const levelHierarchy = [
    GA4PermissionLevel.NONE,
    GA4PermissionLevel.READ,
    GA4PermissionLevel.ANALYZE,
    GA4PermissionLevel.COLLABORATE,
    GA4PermissionLevel.EDIT,
    GA4PermissionLevel.ADMIN
  ];

  const actualIndex = levelHierarchy.indexOf(actual);
  const requiredIndex = levelHierarchy.indexOf(required);

  return actualIndex >= requiredIndex;
}

// ============================================================================
// PERMISSION STATUS DETECTION
// ============================================================================

/**
 * Generates a comprehensive permission status for UI display
 */
export function generatePermissionStatus(
  userContext: GA4PermissionContext,
  propertyId: string
): PermissionStatus {
  // Check if currently checking permissions
  if (userContext.isCheckingPermissions) {
    return {
      status: 'checking',
      permissionLevelText: 'Checking permissions...',
      statusColor: 'gray',
      accessibleOperations: [],
      blockedOperations: [],
      canRequestPermissions: false
    };
  }

  // Check token expiration
  if (isTokenExpired(userContext.tokenPermissions)) {
    return {
      status: 'error',
      permissionLevelText: 'Token expired',
      statusColor: 'red',
      accessibleOperations: [],
      blockedOperations: Object.values(GA4Operation),
      canRequestPermissions: true
    };
  }

  const permissionLevel = detectPropertyPermissionLevel(
    userContext.propertyPermissions,
    propertyId
  );

  const allowedOperations = detectAllowedOperations(
    permissionLevel,
    userContext.tokenPermissions.grantedScopes
  );

  const allOperations = Object.values(GA4Operation);
  const blockedOperations = allOperations.filter(
    op => !allowedOperations.includes(op)
  );

  // Determine overall status
  let status: 'granted' | 'partial' | 'denied';
  let statusColor: 'green' | 'yellow' | 'red';

  if (permissionLevel === GA4PermissionLevel.NONE) {
    status = 'denied';
    statusColor = 'red';
  } else if (blockedOperations.length === 0) {
    status = 'granted';
    statusColor = 'green';
  } else {
    status = 'partial';
    statusColor = 'yellow';
  }

  return {
    status,
    permissionLevelText: getPermissionLevelDisplayText(permissionLevel),
    statusColor,
    accessibleOperations: allowedOperations,
    blockedOperations,
    canRequestPermissions: permissionLevel !== GA4PermissionLevel.ADMIN
  };
}

/**
 * Gets display text for permission levels
 */
export function getPermissionLevelDisplayText(level: GA4PermissionLevel): string {
  const displayTexts = {
    [GA4PermissionLevel.NONE]: 'No Access',
    [GA4PermissionLevel.READ]: 'Read Only',
    [GA4PermissionLevel.ANALYZE]: 'Analyze',
    [GA4PermissionLevel.COLLABORATE]: 'Collaborate',
    [GA4PermissionLevel.EDIT]: 'Edit',
    [GA4PermissionLevel.ADMIN]: 'Administrator'
  };

  return displayTexts[level] || 'Unknown';
}

// ============================================================================
// PERMISSION VALIDATION HELPERS
// ============================================================================

/**
 * Validates a permission check request
 */
export function validatePermissionCheckRequest(
  request: PermissionCheckRequest
): string[] {
  const errors: string[] = [];

  if (!request.userContext) {
    errors.push('User context is required');
  }

  if (!request.propertyId) {
    errors.push('Property ID is required');
  }

  if (!request.requiredOperation) {
    errors.push('Required operation is required');
  }

  if (request.userContext && !request.userContext.tokenPermissions) {
    errors.push('Token permissions are required in user context');
  }

  return errors;
}

/**
 * Creates a permission error object
 */
export function createPermissionError(
  type: PermissionErrorType,
  message: string,
  details: string,
  suggestions: string[] = [],
  retryable: boolean = false,
  propertyId?: string,
  requiredScopes?: GA4OAuthScope[],
  currentPermissionLevel?: GA4PermissionLevel
): PermissionError {
  return {
    type,
    message,
    details,
    suggestions,
    retryable,
    propertyId,
    requiredScopes,
    currentPermissionLevel
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets all operations that require a specific OAuth scope
 */
export function getOperationsRequiringScope(scope: GA4OAuthScope): GA4Operation[] {
  return Object.entries(OPERATION_PERMISSION_MAP)
    .filter(([_, config]) => config.requiredScopes.includes(scope))
    .map(([operation, _]) => operation as GA4Operation);
}

/**
 * Gets the minimum OAuth scopes needed for a permission level
 */
export function getMinimumScopesForPermissionLevel(
  level: GA4PermissionLevel
): GA4OAuthScope[] {
  const operations = PERMISSION_LEVEL_OPERATIONS[level] || [];
  const allScopes = operations.flatMap(op => OPERATION_PERMISSION_MAP[op].requiredScopes);
  
  // Remove duplicates
  return [...new Set(allScopes)];
}

/**
 * Gets a human-readable description for an operation
 */
export function getOperationDescription(operation: GA4Operation): string {
  return OPERATION_PERMISSION_MAP[operation]?.description || 'Unknown operation';
}

/**
 * Gets a human-readable description for an OAuth scope
 */
export function getScopeDescription(scope: GA4OAuthScope): string {
  const descriptions = {
    [GA4OAuthScope.ANALYTICS_READONLY]: 'Read-only access to Analytics data',
    [GA4OAuthScope.ANALYTICS]: 'Full access to Analytics',
    [GA4OAuthScope.ANALYTICS_MANAGE_USERS_READONLY]: 'Read-only access to user management',
    [GA4OAuthScope.ANALYTICS_MANAGE_USERS]: 'Full access to user management',
    [GA4OAuthScope.ANALYTICS_EDIT]: 'Edit access to Analytics configuration',
    [GA4OAuthScope.ANALYTICS_PROVISION]: 'Provision new Analytics accounts'
  };

  return descriptions[scope] || 'Unknown scope';
}