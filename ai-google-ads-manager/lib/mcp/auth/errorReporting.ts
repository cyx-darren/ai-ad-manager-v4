/**
 * Error Reporting Service - Phase 6 Implementation
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

export interface ErrorReport {
  reportId: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  title: string;
  description: string;
  originalError: any;
  userContext: {
    userAgent: string;
    url: string;
    timestamp: string;
  };
  systemContext: {
    appVersion: string;
    browserInfo: string;
    platform: string;
  };
  userFeedback?: {
    description: string;
    expectedBehavior: string;
    actualBehavior: string;
  };
  resolutionActions: ResolutionAction[];
  resolved: boolean;
  tags: string[];
}

export interface ResolutionAction {
  actionId: string;
  title: string;
  description: string;
  type: 'user_action' | 'system_action' | 'contact_support';
  steps: string[];
  automated: boolean;
}

export interface UserFeedbackOptions {
  showFeedbackForm: boolean;
  requireFeedback: boolean;
  maxFeedbackLength: number;
}

export interface ErrorReportingConfig {
  enabled: boolean;
  autoReport: boolean;
  minSeverityLevel: ErrorSeverity;
  enableUserFeedback: boolean;
  userFeedbackOptions: UserFeedbackOptions;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  maxStoredErrors: number;
  enableNotifications: boolean;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsBySeverity: { [severity: string]: number };
  errorsByCategory: { [category: string]: number };
  mostCommonErrors: { error: string; count: number }[];
  resolutionRate: number;
  averageResolutionTime: number;
}

export interface IErrorReportingService {
  reportError(error: any, context?: Record<string, any>): Promise<string>;
  getErrorReport(reportId: string): Promise<ErrorReport | null>;
  listErrorReports(): Promise<ErrorReport[]>;
  resolveError(reportId: string, resolution: { method: string; resolvedBy: string; notes: string }): Promise<boolean>;
  getStatistics(): Promise<ErrorStatistics>;
  clearReports(): Promise<boolean>;
  updateConfig(config: Partial<ErrorReportingConfig>): void;
}

export class BrowserErrorReportingService implements IErrorReportingService {
  private config: ErrorReportingConfig;
  private errorReports: Map<string, ErrorReport> = new Map();

  constructor(config?: Partial<ErrorReportingConfig>) {
    this.config = {
      enabled: true,
      autoReport: true,
      minSeverityLevel: ErrorSeverity.MEDIUM,
      enableUserFeedback: true,
      userFeedbackOptions: {
        showFeedbackForm: true,
        requireFeedback: false,
        maxFeedbackLength: 1000
      },
      enableConsoleLogging: true,
      enableLocalStorage: true,
      maxStoredErrors: 100,
      enableNotifications: true,
      ...config
    };
  }

  public async reportError(error: any, context: Record<string, any> = {}): Promise<string> {
    if (!this.config.enabled) return '';

    const reportId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const report: ErrorReport = {
      reportId,
      timestamp: new Date().toISOString(),
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.SYSTEM,
      title: String(error?.message || error || 'Unknown error').substring(0, 100),
      description: String(error?.message || error),
      originalError: error,
      userContext: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      systemContext: {
        appVersion: '1.0.0',
        browserInfo: navigator.userAgent,
        platform: navigator.platform
      },
      resolutionActions: [{
        actionId: 'refresh-page',
        title: 'Refresh Page',
        description: 'Refresh the page to reload all resources',
        type: 'user_action',
        steps: ['Press F5 or click the refresh button'],
        automated: false
      }],
      resolved: false,
      tags: []
    };

    this.errorReports.set(reportId, report);

    if (this.config.enableConsoleLogging) {
      console.error('[ERROR_REPORTING]', report);
    }

    return reportId;
  }

  public async getErrorReport(reportId: string): Promise<ErrorReport | null> {
    return this.errorReports.get(reportId) || null;
  }

  public async listErrorReports(): Promise<ErrorReport[]> {
    return Array.from(this.errorReports.values());
  }

  public async resolveError(reportId: string, resolution: { method: string; resolvedBy: string; notes: string }): Promise<boolean> {
    const report = this.errorReports.get(reportId);
    if (!report) return false;
    report.resolved = true;
    return true;
  }

  public async getStatistics(): Promise<ErrorStatistics> {
    const reports = Array.from(this.errorReports.values());
    return {
      totalErrors: reports.length,
      errorsBySeverity: {},
      errorsByCategory: {},
      mostCommonErrors: [],
      resolutionRate: 0,
      averageResolutionTime: 0
    };
  }

  public async clearReports(): Promise<boolean> {
    this.errorReports.clear();
    return true;
  }

  public updateConfig(config: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export class ErrorReportingFactory {
  public static createStandard(config?: Partial<ErrorReportingConfig>): BrowserErrorReportingService {
    return new BrowserErrorReportingService(config);
  }
}

export function createErrorReportingService(config?: Partial<ErrorReportingConfig>): BrowserErrorReportingService {
  return ErrorReportingFactory.createStandard(config);
}

export function createVerboseErrorReporting(): BrowserErrorReportingService {
  return new BrowserErrorReportingService({
    enabled: true,
    autoReport: true,
    minSeverityLevel: ErrorSeverity.LOW,
    enableUserFeedback: true,
    enableConsoleLogging: true,
    enableLocalStorage: true,
    maxStoredErrors: 200,
    enableNotifications: true
  });
}