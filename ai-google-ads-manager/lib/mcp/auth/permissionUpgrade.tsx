'use client';

/**
 * Permission Upgrade
 * 
 * This file provides permission upgrade prompts and guidance system with OAuth flow,
 * visual comparisons, benefit explanations, and organizational approval workflows.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions
} from './permissionTypes';

// ============================================================================
// UPGRADE TYPES & INTERFACES
// ============================================================================

/**
 * Permission upgrade types
 */
export enum PermissionUpgradeType {
  SCOPE_UPGRADE = 'scope_upgrade',           // OAuth scope upgrade
  LEVEL_UPGRADE = 'level_upgrade',           // Permission level upgrade
  PROPERTY_ACCESS = 'property_access',       // GA4 property access request
  ORGANIZATIONAL = 'organizational'          // Organization-level approval
}

/**
 * Upgrade flow steps
 */
export enum UpgradeFlowStep {
  ASSESSMENT = 'assessment',                 // Assess current vs required permissions
  COMPARISON = 'comparison',                 // Show before/after comparison
  BENEFITS = 'benefits',                     // Explain upgrade benefits
  AUTHORIZATION = 'authorization',           // OAuth consent flow
  APPROVAL = 'approval',                     // Organizational approval
  CONFIRMATION = 'confirmation'              // Confirmation and next steps
}

/**
 * Feature availability status
 */
export enum FeatureAvailability {
  AVAILABLE = 'available',                   // Feature is available
  LIMITED = 'limited',                       // Feature has limitations
  UNAVAILABLE = 'unavailable',               // Feature is not available
  REQUIRES_UPGRADE = 'requires_upgrade'      // Feature requires permission upgrade
}

/**
 * Permission upgrade request
 */
export interface PermissionUpgradeRequest {
  /** Request ID */
  id: string;
  /** Upgrade type */
  type: PermissionUpgradeType;
  /** Current permissions */
  currentPermissions: GA4TokenPermissions;
  /** Required permissions */
  requiredPermissions: {
    level: GA4PermissionLevel;
    scopes: GA4OAuthScope[];
  };
  /** Requested operation */
  operation?: GA4Operation;
  /** Business justification */
  justification?: string;
  /** Request timestamp */
  timestamp: Date;
  /** Requester information */
  requester?: {
    email: string;
    name: string;
    role?: string;
  };
}

/**
 * Feature comparison data
 */
export interface FeatureComparison {
  /** Feature name */
  name: string;
  /** Feature description */
  description: string;
  /** Current availability */
  currentStatus: FeatureAvailability;
  /** Status after upgrade */
  upgradeStatus: FeatureAvailability;
  /** Feature importance */
  importance: 'low' | 'medium' | 'high';
  /** Required permission level */
  requiredLevel?: GA4PermissionLevel;
  /** Required scopes */
  requiredScopes?: GA4OAuthScope[];
}

/**
 * Upgrade benefit
 */
export interface UpgradeBenefit {
  /** Benefit title */
  title: string;
  /** Benefit description */
  description: string;
  /** Benefit category */
  category: 'data_access' | 'functionality' | 'automation' | 'reporting';
  /** Business impact */
  impact: 'low' | 'medium' | 'high';
  /** Icon component */
  icon?: React.ReactNode;
}

/**
 * Upgrade configuration
 */
export interface PermissionUpgradeConfig {
  /** Enable organizational approval workflow */
  requiresOrganizationalApproval: boolean;
  /** OAuth authorization endpoint */
  authorizationUrl?: string;
  /** Organization admin email */
  adminEmail?: string;
  /** Custom approval workflow URL */
  approvalWorkflowUrl?: string;
  /** Enable visual feature comparison */
  showFeatureComparison: boolean;
  /** Enable benefit explanations */
  showBenefits: boolean;
  /** Custom styling */
  className?: string;
  /** Upgrade success handler */
  onUpgradeSuccess?: (request: PermissionUpgradeRequest) => void;
  /** Upgrade failure handler */
  onUpgradeFailure?: (error: Error) => void;
  /** Approval request handler */
  onApprovalRequest?: (request: PermissionUpgradeRequest) => void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PermissionUpgradeConfig = {
  requiresOrganizationalApproval: false,
  showFeatureComparison: true,
  showBenefits: true,
  authorizationUrl: '/auth/google'
};

// ============================================================================
// FEATURE MATRIX DATA
// ============================================================================

const GA4_FEATURE_MATRIX: FeatureComparison[] = [
  {
    name: 'View Basic Reports',
    description: 'Access to standard GA4 reports and dashboards',
    currentStatus: FeatureAvailability.AVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'high',
    requiredLevel: GA4PermissionLevel.READ
  },
  {
    name: 'Custom Report Building',
    description: 'Create and customize advanced reports',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'high',
    requiredLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY]
  },
  {
    name: 'Data Export',
    description: 'Export data to external tools and formats',
    currentStatus: FeatureAvailability.LIMITED,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'medium',
    requiredLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY]
  },
  {
    name: 'Real-time Data',
    description: 'Access to real-time analytics data',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'medium',
    requiredLevel: GA4PermissionLevel.ANALYZE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_READONLY]
  },
  {
    name: 'Audience Management',
    description: 'Create and manage custom audiences',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'high',
    requiredLevel: GA4PermissionLevel.COLLABORATE,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT]
  },
  {
    name: 'Goal Configuration',
    description: 'Set up and modify conversion goals',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'high',
    requiredLevel: GA4PermissionLevel.EDIT,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT]
  },
  {
    name: 'User Management',
    description: 'Manage user access and permissions',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'medium',
    requiredLevel: GA4PermissionLevel.ADMIN,
    requiredScopes: [GA4OAuthScope.ANALYTICS_MANAGE_USERS]
  },
  {
    name: 'Property Settings',
    description: 'Modify property configuration and settings',
    currentStatus: FeatureAvailability.UNAVAILABLE,
    upgradeStatus: FeatureAvailability.AVAILABLE,
    importance: 'low',
    requiredLevel: GA4PermissionLevel.ADMIN,
    requiredScopes: [GA4OAuthScope.ANALYTICS_EDIT]
  }
];

const UPGRADE_BENEFITS: UpgradeBenefit[] = [
  {
    title: 'Enhanced Data Access',
    description: 'Access to detailed analytics data and custom metrics',
    category: 'data_access',
    impact: 'high',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    title: 'Advanced Reporting',
    description: 'Create custom reports and advanced data visualizations',
    category: 'reporting',
    impact: 'high',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    )
  },
  {
    title: 'Automation Capabilities',
    description: 'Automate data collection and report generation',
    category: 'automation',
    impact: 'medium',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    title: 'Expanded Functionality',
    description: 'Access to premium features and advanced tools',
    category: 'functionality',
    impact: 'high',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 011 1v1z" />
      </svg>
    )
  }
];

// ============================================================================
// PERMISSION ASSESSMENT COMPONENT
// ============================================================================

interface PermissionAssessmentProps {
  currentPermissions: GA4TokenPermissions;
  requiredLevel: GA4PermissionLevel;
  requiredScopes: GA4OAuthScope[];
  onNext: () => void;
}

const PermissionAssessment: React.FC<PermissionAssessmentProps> = ({
  currentPermissions,
  requiredLevel,
  requiredScopes,
  onNext
}) => {
  const missingScopes = requiredScopes.filter(scope => !currentPermissions.scopes.includes(scope));
  
  const levelHierarchy = {
    [GA4PermissionLevel.NONE]: 0,
    [GA4PermissionLevel.READ]: 1,
    [GA4PermissionLevel.ANALYZE]: 2,
    [GA4PermissionLevel.COLLABORATE]: 3,
    [GA4PermissionLevel.EDIT]: 4,
    [GA4PermissionLevel.ADMIN]: 5
  };

  const needsLevelUpgrade = levelHierarchy[currentPermissions.level] < levelHierarchy[requiredLevel];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Permission Assessment</h3>
        <p className="text-sm text-gray-600 mb-6">
          We've analyzed your current permissions and identified what's needed to access this feature.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Permissions */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Current Permissions</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Permission Level:</span>
              <span className="text-sm font-medium text-gray-900">{currentPermissions.level}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600 block mb-1">OAuth Scopes:</span>
              <div className="space-y-1">
                {currentPermissions.scopes.map(scope => (
                  <span key={scope} className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800 mr-1 mb-1">
                    ✓ {scope}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Required Permissions */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Required Permissions</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Permission Level:</span>
              <span className={`text-sm font-medium ${needsLevelUpgrade ? 'text-red-600' : 'text-green-600'}`}>
                {requiredLevel} {needsLevelUpgrade && '(Upgrade Needed)'}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600 block mb-1">OAuth Scopes:</span>
              <div className="space-y-1">
                {requiredScopes.map(scope => {
                  const hasScope = currentPermissions.scopes.includes(scope);
                  return (
                    <span 
                      key={scope} 
                      className={`inline-flex items-center px-2 py-1 rounded text-xs mr-1 mb-1 ${
                        hasScope ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {hasScope ? '✓' : '✗'} {scope}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Upgrade Required</h3>
            <div className="mt-1 text-sm text-yellow-700">
              <p>To access this feature, you need:</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {needsLevelUpgrade && (
                  <li>Permission level upgrade to {requiredLevel}</li>
                )}
                {missingScopes.length > 0 && (
                  <li>{missingScopes.length} additional OAuth scope(s)</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// FEATURE COMPARISON COMPONENT
// ============================================================================

interface FeatureComparisonProps {
  currentLevel: GA4PermissionLevel;
  targetLevel: GA4PermissionLevel;
  onNext: () => void;
  onBack: () => void;
}

const FeatureComparison: React.FC<FeatureComparisonProps> = ({
  currentLevel,
  targetLevel,
  onNext,
  onBack
}) => {
  const getStatusIcon = (status: FeatureAvailability) => {
    switch (status) {
      case FeatureAvailability.AVAILABLE:
        return <span className="text-green-500">✓</span>;
      case FeatureAvailability.LIMITED:
        return <span className="text-yellow-500">◐</span>;
      case FeatureAvailability.UNAVAILABLE:
        return <span className="text-red-500">✗</span>;
      case FeatureAvailability.REQUIRES_UPGRADE:
        return <span className="text-blue-500">↑</span>;
      default:
        return <span className="text-gray-500">?</span>;
    }
  };

  const getStatusText = (status: FeatureAvailability) => {
    switch (status) {
      case FeatureAvailability.AVAILABLE: return 'Available';
      case FeatureAvailability.LIMITED: return 'Limited';
      case FeatureAvailability.UNAVAILABLE: return 'Not Available';
      case FeatureAvailability.REQUIRES_UPGRADE: return 'Needs Upgrade';
      default: return 'Unknown';
    }
  };

  const levelHierarchy = {
    [GA4PermissionLevel.NONE]: 0,
    [GA4PermissionLevel.READ]: 1,
    [GA4PermissionLevel.ANALYZE]: 2,
    [GA4PermissionLevel.COLLABORATE]: 3,
    [GA4PermissionLevel.EDIT]: 4,
    [GA4PermissionLevel.ADMIN]: 5
  };

  const relevantFeatures = GA4_FEATURE_MATRIX.filter(feature => {
    if (!feature.requiredLevel) return true;
    return levelHierarchy[feature.requiredLevel] <= levelHierarchy[targetLevel];
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Feature Comparison</h3>
        <p className="text-sm text-gray-600 mb-6">
          Here's what you'll gain access to with the permission upgrade:
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                After Upgrade
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Importance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {relevantFeatures.map((feature, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{feature.name}</div>
                    <div className="text-sm text-gray-500">{feature.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    {getStatusIcon(feature.currentStatus)}
                    <span className="ml-2 text-sm text-gray-600">
                      {getStatusText(feature.currentStatus)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    {getStatusIcon(feature.upgradeStatus)}
                    <span className="ml-2 text-sm text-gray-600">
                      {getStatusText(feature.upgradeStatus)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    feature.importance === 'high' ? 'bg-red-100 text-red-800' :
                    feature.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {feature.importance}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View Benefits
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// UPGRADE BENEFITS COMPONENT
// ============================================================================

interface UpgradeBenefitsProps {
  onNext: () => void;
  onBack: () => void;
}

const UpgradeBenefits: React.FC<UpgradeBenefitsProps> = ({ onNext, onBack }) => {
  const getBenefitColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upgrade Benefits</h3>
        <p className="text-sm text-gray-600 mb-6">
          Upgrading your permissions will unlock these key benefits:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {UPGRADE_BENEFITS.map((benefit, index) => (
          <div key={index} className={`border rounded-lg p-6 ${getBenefitColor(benefit.impact)}`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {benefit.icon}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium mb-2">{benefit.title}</h4>
                <p className="text-sm opacity-90 mb-3">{benefit.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide opacity-75">
                    {benefit.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-medium">
                    {benefit.impact.toUpperCase()} IMPACT
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex">
          <svg className="h-6 w-6 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900">Ready to Upgrade?</h3>
            <p className="mt-1 text-sm text-blue-800">
              The upgrade process is secure and typically takes just a few minutes. You'll be redirected to Google's authorization page to grant the necessary permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Start Upgrade
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// AUTHORIZATION COMPONENT
// ============================================================================

interface AuthorizationProps {
  request: PermissionUpgradeRequest;
  config: PermissionUpgradeConfig;
  onSuccess: () => void;
  onFailure: (error: Error) => void;
  onBack: () => void;
}

const Authorization: React.FC<AuthorizationProps> = ({
  request,
  config,
  onSuccess,
  onFailure,
  onBack
}) => {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showOrganizationalFlow, setShowOrganizationalFlow] = useState(false);

  const handleOAuthUpgrade = useCallback(async () => {
    setIsAuthorizing(true);
    
    try {
      // Construct OAuth URL with required scopes
      const scopes = request.requiredPermissions.scopes.join(' ');
      const authUrl = `${config.authorizationUrl}?scopes=${encodeURIComponent(scopes)}&upgrade=true`;
      
      // Redirect to OAuth flow
      window.location.href = authUrl;
      
    } catch (error) {
      setIsAuthorizing(false);
      onFailure(error as Error);
    }
  }, [request, config, onFailure]);

  const handleOrganizationalRequest = useCallback(() => {
    setShowOrganizationalFlow(true);
    config.onApprovalRequest?.(request);
  }, [request, config]);

  if (showOrganizationalFlow) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Request Organizational Approval</h3>
          <p className="text-sm text-gray-600 mb-6">
            This permission upgrade requires approval from your organization administrator.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <svg className="h-6 w-6 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-900">Approval Required</h3>
              <div className="mt-2 text-sm text-yellow-800">
                <p>Your request has been submitted to:</p>
                <p className="font-medium mt-1">{config.adminEmail || 'Your organization administrator'}</p>
                <p className="mt-2">You'll receive an email notification once your request is reviewed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Authorization Required</h3>
        <p className="text-sm text-gray-600 mb-6">
          To complete the permission upgrade, you'll need to authorize the application with the required OAuth scopes.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-sm font-medium text-blue-900 mb-3">What will happen:</h4>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>You'll be redirected to Google's secure authorization page</li>
          <li>Review and accept the requested permissions</li>
          <li>Return to the application with upgraded access</li>
        </ol>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Permissions to be granted:</h4>
        <div className="space-y-2">
          {request.requiredPermissions.scopes.map(scope => (
            <div key={scope} className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {scope}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isAuthorizing}
        >
          Back
        </button>
        <div className="space-x-3">
          {config.requiresOrganizationalApproval && (
            <button
              onClick={handleOrganizationalRequest}
              className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isAuthorizing}
            >
              Request Approval
            </button>
          )}
          <button
            onClick={handleOAuthUpgrade}
            disabled={isAuthorizing}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthorizing ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authorizing...
              </div>
            ) : (
              'Authorize Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PERMISSION UPGRADE COMPONENT
// ============================================================================

interface PermissionUpgradeProps {
  currentPermissions: GA4TokenPermissions;
  requiredLevel: GA4PermissionLevel;
  requiredScopes: GA4OAuthScope[];
  operation?: GA4Operation;
  config?: Partial<PermissionUpgradeConfig>;
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionUpgrade: React.FC<PermissionUpgradeProps> = ({
  currentPermissions,
  requiredLevel,
  requiredScopes,
  operation,
  config = {},
  isOpen,
  onClose
}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [currentStep, setCurrentStep] = useState<UpgradeFlowStep>(UpgradeFlowStep.ASSESSMENT);
  const [upgradeRequest, setUpgradeRequest] = useState<PermissionUpgradeRequest | null>(null);

  useEffect(() => {
    if (isOpen && !upgradeRequest) {
      const request: PermissionUpgradeRequest = {
        id: `upgrade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: PermissionUpgradeType.SCOPE_UPGRADE,
        currentPermissions,
        requiredPermissions: {
          level: requiredLevel,
          scopes: requiredScopes
        },
        operation,
        timestamp: new Date()
      };
      setUpgradeRequest(request);
    }
  }, [isOpen, currentPermissions, requiredLevel, requiredScopes, operation, upgradeRequest]);

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

  const handleNext = useCallback(() => {
    const stepOrder = [
      UpgradeFlowStep.ASSESSMENT,
      UpgradeFlowStep.COMPARISON,
      UpgradeFlowStep.BENEFITS,
      UpgradeFlowStep.AUTHORIZATION
    ];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const stepOrder = [
      UpgradeFlowStep.ASSESSMENT,
      UpgradeFlowStep.COMPARISON,
      UpgradeFlowStep.BENEFITS,
      UpgradeFlowStep.AUTHORIZATION
    ];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }, [currentStep]);

  const handleUpgradeSuccess = useCallback(() => {
    if (upgradeRequest) {
      cfg.onUpgradeSuccess?.(upgradeRequest);
    }
    onClose();
  }, [upgradeRequest, cfg, onClose]);

  const handleUpgradeFailure = useCallback((error: Error) => {
    cfg.onUpgradeFailure?.(error);
  }, [cfg]);

  if (!isOpen || !upgradeRequest) return null;

  const renderCurrentStep = () => {
    switch (currentStep) {
      case UpgradeFlowStep.ASSESSMENT:
        return (
          <PermissionAssessment
            currentPermissions={currentPermissions}
            requiredLevel={requiredLevel}
            requiredScopes={requiredScopes}
            onNext={handleNext}
          />
        );

      case UpgradeFlowStep.COMPARISON:
        return cfg.showFeatureComparison ? (
          <FeatureComparison
            currentLevel={currentPermissions.level}
            targetLevel={requiredLevel}
            onNext={handleNext}
            onBack={handleBack}
          />
        ) : (
          <UpgradeBenefits onNext={handleNext} onBack={handleBack} />
        );

      case UpgradeFlowStep.BENEFITS:
        return cfg.showBenefits ? (
          <UpgradeBenefits onNext={handleNext} onBack={handleBack} />
        ) : (
          <Authorization
            request={upgradeRequest}
            config={cfg}
            onSuccess={handleUpgradeSuccess}
            onFailure={handleUpgradeFailure}
            onBack={handleBack}
          />
        );

      case UpgradeFlowStep.AUTHORIZATION:
        return (
          <Authorization
            request={upgradeRequest}
            config={cfg}
            onSuccess={handleUpgradeSuccess}
            onFailure={handleUpgradeFailure}
            onBack={handleBack}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="upgrade-modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`
          inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl 
          transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full
          ${cfg.className || ''}
        `}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="upgrade-modal-title">
                Permission Upgrade
              </h3>
              <button
                onClick={onClose}
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {[
                  { step: UpgradeFlowStep.ASSESSMENT, label: 'Assessment' },
                  { step: UpgradeFlowStep.COMPARISON, label: 'Features' },
                  { step: UpgradeFlowStep.BENEFITS, label: 'Benefits' },
                  { step: UpgradeFlowStep.AUTHORIZATION, label: 'Authorization' }
                ].map((item, index) => (
                  <div key={item.step} className="flex items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${currentStep === item.step 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-300 text-gray-600'
                      }
                    `}>
                      {index + 1}
                    </div>
                    <span className={`ml-2 text-sm ${
                      currentStep === item.step ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}>
                      {item.label}
                    </span>
                    {index < 3 && <div className="flex-1 h-px bg-gray-300 mx-4"></div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Step Content */}
            {renderCurrentStep()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create permission upgrade request
 */
export const createPermissionUpgradeRequest = (
  currentPermissions: GA4TokenPermissions,
  requiredLevel: GA4PermissionLevel,
  requiredScopes: GA4OAuthScope[],
  operation?: GA4Operation,
  justification?: string
): PermissionUpgradeRequest => {
  return {
    id: `upgrade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: PermissionUpgradeType.SCOPE_UPGRADE,
    currentPermissions,
    requiredPermissions: {
      level: requiredLevel,
      scopes: requiredScopes
    },
    operation,
    justification,
    timestamp: new Date()
  };
};

export default PermissionUpgrade;