/**
 * Scope Reporting System
 * 
 * This file provides comprehensive scope error reporting with user feedback,
 * detailed error classification, and actionable resolution guidance.
 */

import {
  GA4PermissionLevel,
  GA4OAuthScope,
  GA4Operation,
  GA4TokenPermissions,
  PermissionErrorType,
  ScopeValidationResult,
  ScopeValidationError,
  ScopeReportingConfig,
  ScopeErrorReport,
  ScopeResolutionAction,
  ScopeErrorCategory,
  ScopeErrorSeverity,
  UserFeedbackForm,
  ScopeReportingStatistics
} from './permissionTypes';

import {
  OPERATION_SCOPE_REQUIREMENTS,
  ScopeValidator,
  createScopeValidator
} from './scopeValidator';

import {
  getScopeDescription,
  getOperationDescription
} from './permissionDetection';

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

/**
 * Categorize scope errors by type and severity
 */
export function categorizeScopeError(error: ScopeValidationError): {
  category: ScopeErrorCategory;
  severity: ScopeErrorSeverity;
  userFacing: boolean;
} {
  switch (error.type) {
    case PermissionErrorType.INSUFFICIENT_SCOPE:
      return {
        category: ScopeErrorCategory.SCOPE_MISMATCH,
        severity: ScopeErrorSeverity.HIGH,
        userFacing: true
      };

    case PermissionErrorType.INSUFFICIENT_PERMISSION:
      return {
        category: ScopeErrorCategory.PERMISSION_LEVEL,
        severity: ScopeErrorSeverity.HIGH,
        userFacing: true
      };

    case PermissionErrorType.TOKEN_EXPIRED:
      return {
        category: ScopeErrorCategory.TOKEN_ISSUE,
        severity: ScopeErrorSeverity.MEDIUM,
        userFacing: true
      };

    case PermissionErrorType.INVALID_TOKEN:
      return {
        category: ScopeErrorCategory.TOKEN_ISSUE,
        severity: ScopeErrorSeverity.HIGH,
        userFacing: true
      };

    case PermissionErrorType.VALIDATION_ERROR:
      return {
        category: ScopeErrorCategory.SYSTEM_ERROR,
        severity: ScopeErrorSeverity.MEDIUM,
        userFacing: false
      };

    case PermissionErrorType.MIDDLEWARE_ERROR:
      return {
        category: ScopeErrorCategory.SYSTEM_ERROR,
        severity: ScopeErrorSeverity.LOW,
        userFacing: false
      };

    default:
      return {
        category: ScopeErrorCategory.UNKNOWN,
        severity: ScopeErrorSeverity.MEDIUM,
        userFacing: true
      };
  }
}

/**
 * Generate user-friendly error messages
 */
export function generateUserFriendlyMessage(error: ScopeValidationError): string {
  const { category } = categorizeScopeError(error);

  switch (category) {
    case ScopeErrorCategory.SCOPE_MISMATCH:
      const missingScopes = error.details?.missingScopes || [];
      const scopeNames = missingScopes.map(scope => getScopeDescription(scope)).join(', ');
      return `To perform this action, you need additional permissions: ${scopeNames}. Please re-authenticate with elevated permissions.`;

    case ScopeErrorCategory.PERMISSION_LEVEL:
      const requiredLevel = error.details?.requiredLevel || 'higher';
      const currentLevel = error.details?.currentLevel || 'current';
      return `Your current permission level (${currentLevel}) is insufficient. This action requires ${requiredLevel} permissions. Please contact your administrator for access.`;

    case ScopeErrorCategory.TOKEN_ISSUE:
      if (error.type === PermissionErrorType.TOKEN_EXPIRED) {
        return 'Your authentication has expired. Please sign in again to continue.';
      }
      return 'There is an issue with your authentication. Please sign in again.';

    case ScopeErrorCategory.SYSTEM_ERROR:
      return 'A system error occurred while checking permissions. Please try again or contact support if the issue persists.';

    case ScopeErrorCategory.UNKNOWN:
    default:
      return 'An unexpected permission error occurred. Please try again or contact support for assistance.';
  }
}

/**
 * Generate resolution actions for scope errors
 */
export function generateResolutionActions(error: ScopeValidationError): ScopeResolutionAction[] {
  const { category } = categorizeScopeError(error);
  const actions: ScopeResolutionAction[] = [];

  switch (category) {
    case ScopeErrorCategory.SCOPE_MISMATCH:
      const missingScopes = error.details?.missingScopes || [];
      const currentScopes = error.details?.availableScopes || [];
      
      actions.push({
        actionId: 'reauthorize',
        title: 'Re-authorize with Additional Permissions',
        description: 'Grant additional permissions to perform this action',
        type: 'user_action',
        priority: 'high',
        estimatedTime: '2-3 minutes',
        steps: [
          'Click the "Re-authorize" button below',
          'Review the requested permissions',
          'Click "Allow" to grant the additional permissions',
          'You will be redirected back to continue'
        ],
        metadata: {
          missingScopes,
          currentScopes,
          upgradeUrl: generateScopeUpgradeUrl(missingScopes, currentScopes)
        }
      });

      actions.push({
        actionId: 'contact_admin',
        title: 'Request Permissions from Administrator',
        description: 'Ask your organization administrator to grant the required permissions',
        type: 'contact_support',
        priority: 'medium',
        estimatedTime: '1-2 business days',
        steps: [
          'Contact your Google Analytics administrator',
          `Request the following permissions: ${missingScopes.map(s => getScopeDescription(s)).join(', ')}`,
          'Provide this error reference for faster resolution'
        ],
        metadata: {
          requiredPermissions: missingScopes.map(s => getScopeDescription(s))
        }
      });
      break;

    case ScopeErrorCategory.PERMISSION_LEVEL:
      actions.push({
        actionId: 'request_elevation',
        title: 'Request Permission Elevation',
        description: 'Ask for higher-level permissions for your account',
        type: 'contact_support',
        priority: 'high',
        estimatedTime: '1-3 business days',
        steps: [
          'Contact your Google Analytics property administrator',
          `Request elevation to ${error.details?.requiredLevel || 'higher'} permissions`,
          'Explain the business need for performing this action',
          'Provide this error reference for context'
        ],
        metadata: {
          currentLevel: error.details?.currentLevel,
          requiredLevel: error.details?.requiredLevel
        }
      });
      break;

    case ScopeErrorCategory.TOKEN_ISSUE:
      actions.push({
        actionId: 'reauthenticate',
        title: 'Sign In Again',
        description: 'Refresh your authentication to restore access',
        type: 'user_action',
        priority: 'high',
        estimatedTime: '1-2 minutes',
        steps: [
          'Click "Sign Out" in the top navigation',
          'Click "Sign In" to start fresh authentication',
          'Complete the Google sign-in process',
          'Try your action again'
        ],
        metadata: {
          signOutUrl: '/auth/logout',
          signInUrl: '/auth/login'
        }
      });
      break;

    case ScopeErrorCategory.SYSTEM_ERROR:
      actions.push({
        actionId: 'retry',
        title: 'Try Again',
        description: 'Retry the operation as it may be a temporary issue',
        type: 'user_action',
        priority: 'medium',
        estimatedTime: '30 seconds',
        steps: [
          'Wait a moment for any temporary issues to resolve',
          'Try your action again',
          'If the problem persists, contact support'
        ],
        metadata: {}
      });

      actions.push({
        actionId: 'contact_support',
        title: 'Contact Technical Support',
        description: 'Get help from our technical support team',
        type: 'contact_support',
        priority: 'low',
        estimatedTime: '4-24 hours',
        steps: [
          'Collect error details and steps to reproduce',
          'Contact support with error reference ID',
          'Provide any additional context about what you were trying to do'
        ],
        metadata: {
          supportEmail: 'support@example.com',
          errorReference: error.validationId
        }
      });
      break;
  }

  return actions;
}

/**
 * Generate scope upgrade URL
 */
function generateScopeUpgradeUrl(
  missingScopes: GA4OAuthScope[],
  currentScopes: GA4OAuthScope[]
): string {
  const allScopes = [...new Set([...currentScopes, ...missingScopes])];
  const scopeString = allScopes.join(' ');
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: typeof window !== 'undefined' 
      ? window.location.origin + '/auth/callback'
      : '/auth/callback',
    scope: scopeString,
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ============================================================================
// SCOPE REPORTING SERVICE
// ============================================================================

/**
 * Comprehensive scope error reporting service
 */
export class ScopeReportingService {
  private config: ScopeReportingConfig;
  private errorReports: Map<string, ScopeErrorReport> = new Map();
  private statistics: {
    totalReports: number;
    reportsByCategory: Map<ScopeErrorCategory, number>;
    reportsBySeverity: Map<ScopeErrorSeverity, number>;
    resolutionRate: number;
  };

  constructor(config?: Partial<ScopeReportingConfig>) {
    this.config = {
      enableReporting: true,
      enableUserFeedback: true,
      enableAnalytics: true,
      storageLocation: 'localStorage',
      maxStoredReports: 100,
      retentionDays: 30,
      enableNotifications: true,
      notificationTimeout: 5000,
      ...config
    };

    this.statistics = {
      totalReports: 0,
      reportsByCategory: new Map(),
      reportsBySeverity: new Map(),
      resolutionRate: 0
    };

    this.loadStoredReports();
  }

  /**
   * Create a comprehensive error report
   */
  public createErrorReport(
    validationResult: ScopeValidationResult,
    userContext?: Record<string, any>
  ): ScopeErrorReport {
    if (validationResult.valid || !validationResult.error) {
      throw new Error('Cannot create error report for successful validation');
    }

    const error = validationResult.error;
    const reportId = this.generateReportId();
    const { category, severity, userFacing } = categorizeScopeError(error);

    const report: ScopeErrorReport = {
      reportId,
      timestamp: new Date().toISOString(),
      operation: error.operation,
      tokenPermissions: error.tokenPermissions,
      error: {
        type: error.type,
        message: error.message,
        details: error.details,
        userFriendlyMessage: generateUserFriendlyMessage(error)
      },
      categorization: {
        category,
        severity,
        userFacing
      },
      resolutionActions: generateResolutionActions(error),
      context: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        timestamp: new Date().toISOString(),
        ...userContext
      },
      status: 'unresolved',
      userFeedback: null,
      resolution: null,
      metadata: {
        validationId: validationResult.validationId,
        validationDuration: validationResult.duration || 0,
        cached: validationResult.cached || false
      }
    };

    // Store the report
    this.errorReports.set(reportId, report);
    this.updateStatistics(report);
    this.saveReports();

    // Show notification if enabled
    if (this.config.enableNotifications && userFacing) {
      this.showNotification(report);
    }

    // Log the report
    console.error('[SCOPE_REPORTING] Created error report', {
      reportId,
      operation: error.operation,
      category,
      severity,
      userFacing
    });

    return report;
  }

  /**
   * Add user feedback to an error report
   */
  public addUserFeedback(
    reportId: string,
    feedback: UserFeedbackForm
  ): boolean {
    const report = this.errorReports.get(reportId);
    if (!report) return false;

    report.userFeedback = {
      helpful: feedback.helpful,
      comments: feedback.comments,
      suggestedSolution: feedback.suggestedSolution,
      timestamp: new Date().toISOString()
    };

    this.saveReports();
    return true;
  }

  /**
   * Mark an error report as resolved
   */
  public markResolved(
    reportId: string,
    resolutionAction: string,
    resolutionNotes?: string
  ): boolean {
    const report = this.errorReports.get(reportId);
    if (!report) return false;

    report.status = 'resolved';
    report.resolution = {
      resolvedAt: new Date().toISOString(),
      resolutionAction,
      resolutionNotes,
      resolvedBy: 'user'
    };

    this.updateStatistics(report);
    this.saveReports();
    return true;
  }

  /**
   * Get error report by ID
   */
  public getReport(reportId: string): ScopeErrorReport | null {
    return this.errorReports.get(reportId) || null;
  }

  /**
   * Get all error reports
   */
  public getAllReports(): ScopeErrorReport[] {
    return Array.from(this.errorReports.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get filtered error reports
   */
  public getFilteredReports(filters: {
    category?: ScopeErrorCategory;
    severity?: ScopeErrorSeverity;
    status?: 'resolved' | 'unresolved';
    dateFrom?: string;
    dateTo?: string;
  }): ScopeErrorReport[] {
    let reports = this.getAllReports();

    if (filters.category) {
      reports = reports.filter(r => r.categorization.category === filters.category);
    }

    if (filters.severity) {
      reports = reports.filter(r => r.categorization.severity === filters.severity);
    }

    if (filters.status) {
      reports = reports.filter(r => r.status === filters.status);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      reports = reports.filter(r => new Date(r.timestamp) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      reports = reports.filter(r => new Date(r.timestamp) <= toDate);
    }

    return reports;
  }

  /**
   * Get reporting statistics
   */
  public getStatistics(): ScopeReportingStatistics {
    const totalReports = this.errorReports.size;
    const resolvedReports = Array.from(this.errorReports.values())
      .filter(r => r.status === 'resolved').length;

    return {
      totalReports,
      resolvedReports,
      resolutionRate: totalReports > 0 ? resolvedReports / totalReports : 0,
      reportsByCategory: Object.fromEntries(this.statistics.reportsByCategory),
      reportsBySeverity: Object.fromEntries(this.statistics.reportsBySeverity),
      averageResolutionTime: this.calculateAverageResolutionTime(),
      mostCommonErrors: this.getMostCommonErrors(),
      resolutionActionEffectiveness: this.getResolutionActionEffectiveness()
    };
  }

  /**
   * Clear all reports
   */
  public clearReports(): void {
    this.errorReports.clear();
    this.statistics = {
      totalReports: 0,
      reportsByCategory: new Map(),
      reportsBySeverity: new Map(),
      resolutionRate: 0
    };
    this.saveReports();
  }

  /**
   * Export reports as JSON
   */
  public exportReports(): string {
    return JSON.stringify(this.getAllReports(), null, 2);
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Update statistics when a report is added or updated
   */
  private updateStatistics(report: ScopeErrorReport): void {
    const category = report.categorization.category;
    const severity = report.categorization.severity;

    this.statistics.totalReports = this.errorReports.size;
    this.statistics.reportsByCategory.set(category, 
      (this.statistics.reportsByCategory.get(category) || 0) + 1);
    this.statistics.reportsBySeverity.set(severity,
      (this.statistics.reportsBySeverity.get(severity) || 0) + 1);

    // Calculate resolution rate
    const resolvedCount = Array.from(this.errorReports.values())
      .filter(r => r.status === 'resolved').length;
    this.statistics.resolutionRate = this.statistics.totalReports > 0 
      ? resolvedCount / this.statistics.totalReports 
      : 0;
  }

  /**
   * Calculate average resolution time
   */
  private calculateAverageResolutionTime(): number {
    const resolvedReports = Array.from(this.errorReports.values())
      .filter(r => r.status === 'resolved' && r.resolution);

    if (resolvedReports.length === 0) return 0;

    const totalTime = resolvedReports.reduce((sum, report) => {
      const created = new Date(report.timestamp).getTime();
      const resolved = new Date(report.resolution!.resolvedAt).getTime();
      return sum + (resolved - created);
    }, 0);

    return totalTime / resolvedReports.length;
  }

  /**
   * Get most common error types
   */
  private getMostCommonErrors(): { error: string; count: number }[] {
    const errorCounts = new Map<string, number>();

    Array.from(this.errorReports.values()).forEach(report => {
      const errorKey = `${report.categorization.category}-${report.error.type}`;
      errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get resolution action effectiveness
   */
  private getResolutionActionEffectiveness(): { [action: string]: number } {
    const actionCounts = new Map<string, { total: number; successful: number }>();

    Array.from(this.errorReports.values()).forEach(report => {
      if (report.resolution) {
        const action = report.resolution.resolutionAction;
        const current = actionCounts.get(action) || { total: 0, successful: 0 };
        actionCounts.set(action, {
          total: current.total + 1,
          successful: current.successful + (report.status === 'resolved' ? 1 : 0)
        });
      }
    });

    const effectiveness: { [action: string]: number } = {};
    actionCounts.forEach(({ total, successful }, action) => {
      effectiveness[action] = total > 0 ? successful / total : 0;
    });

    return effectiveness;
  }

  /**
   * Show notification to user
   */
  private showNotification(report: ScopeErrorReport): void {
    if (typeof window === 'undefined') return;

    // Simple notification implementation
    console.warn('[SCOPE_REPORTING] Permission Error', {
      message: report.error.userFriendlyMessage,
      reportId: report.reportId,
      actions: report.resolutionActions.length
    });

    // In a real app, you'd integrate with your notification system
  }

  /**
   * Load stored reports from storage
   */
  private loadStoredReports(): void {
    if (!this.config.enableReporting) return;

    try {
      if (this.config.storageLocation === 'localStorage' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('scope-error-reports');
        if (stored) {
          const reports: ScopeErrorReport[] = JSON.parse(stored);
          reports.forEach(report => {
            this.errorReports.set(report.reportId, report);
            this.updateStatistics(report);
          });
        }
      }
    } catch (error) {
      console.error('[SCOPE_REPORTING] Failed to load stored reports:', error);
    }
  }

  /**
   * Save reports to storage
   */
  private saveReports(): void {
    if (!this.config.enableReporting) return;

    try {
      if (this.config.storageLocation === 'localStorage' && typeof localStorage !== 'undefined') {
        const reports = this.getAllReports();
        localStorage.setItem('scope-error-reports', JSON.stringify(reports));
      }
    } catch (error) {
      console.error('[SCOPE_REPORTING] Failed to save reports:', error);
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `scope-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating scope reporting services
 */
export class ScopeReportingFactory {
  /**
   * Create standard scope reporting service
   */
  public static createStandard(config?: Partial<ScopeReportingConfig>): ScopeReportingService {
    return new ScopeReportingService(config);
  }

  /**
   * Create comprehensive reporting service with full features
   */
  public static createComprehensive(): ScopeReportingService {
    return new ScopeReportingService({
      enableReporting: true,
      enableUserFeedback: true,
      enableAnalytics: true,
      enableNotifications: true,
      maxStoredReports: 500,
      retentionDays: 90
    });
  }

  /**
   * Create minimal reporting service for development
   */
  public static createMinimal(): ScopeReportingService {
    return new ScopeReportingService({
      enableReporting: true,
      enableUserFeedback: false,
      enableAnalytics: false,
      enableNotifications: false,
      maxStoredReports: 50,
      retentionDays: 7
    });
  }
}

/**
 * Create a standard scope reporting service
 */
export function createScopeReportingService(config?: Partial<ScopeReportingConfig>): ScopeReportingService {
  return ScopeReportingFactory.createStandard(config);
}

/**
 * Create error report from validation result (convenience function)
 */
export function createErrorReportFromValidation(
  validationResult: ScopeValidationResult,
  userContext?: Record<string, any>
): ScopeErrorReport | null {
  if (validationResult.valid) return null;
  
  const service = createScopeReportingService();
  return service.createErrorReport(validationResult, userContext);
}