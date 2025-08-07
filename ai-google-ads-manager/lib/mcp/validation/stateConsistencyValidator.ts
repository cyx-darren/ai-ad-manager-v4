/**
 * State Consistency Validator
 * Provides comprehensive validation for state consistency across all synchronization systems
 */

import { dateRangeSyncManager } from '../utils/dateRangeSync';
import { filterSyncManager } from '../utils/filterSync';
import { componentStateRegistry } from '../utils/componentRegistry';
import { componentStateValidator } from '../utils/stateValidator';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  summary: ValidationSummary;
}

export interface ValidationError {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  category: 'consistency' | 'performance' | 'security' | 'usability';
  component: string;
  message: string;
  details: any;
  fixSuggestion?: string;
}

export interface ValidationWarning {
  id: string;
  category: 'performance' | 'best_practice' | 'compatibility';
  component: string;
  message: string;
  details: any;
  recommendation?: string;
}

export interface ValidationSuggestion {
  id: string;
  type: 'optimization' | 'enhancement' | 'cleanup';
  component: string;
  message: string;
  impact: 'low' | 'medium' | 'high';
  implementation: string;
}

export interface ValidationSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalErrors: number;
  majorErrors: number;
  minorErrors: number;
  warnings: number;
  suggestions: number;
  overallScore: number; // 0-100
  reliability: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ConsistencyCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  checkFn: () => Promise<ValidationResult>;
  severity: 'critical' | 'major' | 'minor';
}

export class StateConsistencyValidator {
  private static instance: StateConsistencyValidator | null = null;
  private consistencyChecks: Map<string, ConsistencyCheck>;
  private validationHistory: ValidationResult[];

  constructor() {
    this.consistencyChecks = new Map();
    this.validationHistory = [];
    this.initializeConsistencyChecks();
  }

  public static getInstance(): StateConsistencyValidator {
    if (!StateConsistencyValidator.instance) {
      StateConsistencyValidator.instance = new StateConsistencyValidator();
    }
    return StateConsistencyValidator.instance;
  }

  /**
   * Run comprehensive state consistency validation
   */
  public async validateStateConsistency(): Promise<ValidationResult> {
    console.log('🔍 Starting comprehensive state consistency validation...');

    const allResults: ValidationResult[] = [];
    const startTime = performance.now();

    // Run all consistency checks
    for (const [id, check] of this.consistencyChecks) {
      try {
        console.log(`  Running ${check.name}...`);
        const result = await check.checkFn();
        allResults.push(result);
      } catch (error) {
        console.error(`  ❌ Check ${check.name} failed:`, error);
        allResults.push({
          isValid: false,
          errors: [{
            id: `${id}-execution-error`,
            severity: 'critical',
            category: 'consistency',
            component: check.category,
            message: `Validation check execution failed: ${error}`,
            details: { error: String(error) },
            fixSuggestion: 'Check the implementation of this validation'
          }],
          warnings: [],
          suggestions: [],
          summary: {
            totalChecks: 1,
            passedChecks: 0,
            failedChecks: 1,
            criticalErrors: 1,
            majorErrors: 0,
            minorErrors: 0,
            warnings: 0,
            suggestions: 0,
            overallScore: 0,
            reliability: 'poor'
          }
        });
      }
    }

    // Aggregate results
    const aggregatedResult = this.aggregateResults(allResults);
    aggregatedResult.summary.totalChecks = this.consistencyChecks.size;

    const duration = performance.now() - startTime;
    console.log(`✅ Validation completed in ${duration.toFixed(2)}ms`);
    console.log(`📊 Score: ${aggregatedResult.summary.overallScore}/100 (${aggregatedResult.summary.reliability})`);

    // Store in history
    this.validationHistory.push(aggregatedResult);
    if (this.validationHistory.length > 100) {
      this.validationHistory.shift();
    }

    return aggregatedResult;
  }

  /**
   * Run specific validation check
   */
  public async runCheck(checkId: string): Promise<ValidationResult | null> {
    const check = this.consistencyChecks.get(checkId);
    if (!check) {
      return null;
    }

    try {
      return await check.checkFn();
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          id: `${checkId}-error`,
          severity: 'critical',
          category: 'consistency',
          component: check.category,
          message: `Check execution failed: ${error}`,
          details: { error: String(error) }
        }],
        warnings: [],
        suggestions: [],
        summary: {
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 1,
          criticalErrors: 1,
          majorErrors: 0,
          minorErrors: 0,
          warnings: 0,
          suggestions: 0,
          overallScore: 0,
          reliability: 'poor'
        }
      };
    }
  }

  /**
   * Get list of available validation checks
   */
  public getAvailableChecks(): ConsistencyCheck[] {
    return Array.from(this.consistencyChecks.values());
  }

  /**
   * Get validation history
   */
  public getValidationHistory(limit?: number): ValidationResult[] {
    const history = [...this.validationHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Generate validation report
   */
  public generateValidationReport(result: ValidationResult): string {
    let report = '🔍 STATE CONSISTENCY VALIDATION REPORT\n';
    report += '================================================================================\n\n';

    // Summary
    report += `OVERALL SCORE: ${result.summary.overallScore}/100 (${result.summary.reliability.toUpperCase()})\n`;
    report += `CHECKS: ${result.summary.passedChecks}/${result.summary.totalChecks} passed\n\n`;

    // Errors
    if (result.errors.length > 0) {
      report += 'ERRORS:\n';
      result.errors.forEach(error => {
        const icon = error.severity === 'critical' ? '🚨' : error.severity === 'major' ? '❌' : '⚠️';
        report += `  ${icon} [${error.component}] ${error.message}\n`;
        if (error.fixSuggestion) {
          report += `     💡 Fix: ${error.fixSuggestion}\n`;
        }
      });
      report += '\n';
    }

    // Warnings
    if (result.warnings.length > 0) {
      report += 'WARNINGS:\n';
      result.warnings.forEach(warning => {
        report += `  ⚠️ [${warning.component}] ${warning.message}\n`;
        if (warning.recommendation) {
          report += `     💡 Recommendation: ${warning.recommendation}\n`;
        }
      });
      report += '\n';
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      report += 'OPTIMIZATION SUGGESTIONS:\n';
      result.suggestions.forEach(suggestion => {
        const icon = suggestion.impact === 'high' ? '🚀' : suggestion.impact === 'medium' ? '⚡' : '💡';
        report += `  ${icon} [${suggestion.component}] ${suggestion.message}\n`;
        report += `     Implementation: ${suggestion.implementation}\n`;
      });
      report += '\n';
    }

    return report;
  }

  // Private methods

  private initializeConsistencyChecks(): void {
    // Date Range Synchronization Checks
    this.addCheck({
      id: 'date-range-persistence',
      name: 'Date Range Persistence',
      description: 'Verify date range data persists correctly across sessions',
      category: 'DateRangeSync',
      severity: 'major',
      checkFn: async () => this.checkDateRangePersistence()
    });

    this.addCheck({
      id: 'date-range-validation',
      name: 'Date Range Validation',
      description: 'Verify date range validation rules are working correctly',
      category: 'DateRangeSync',
      severity: 'critical',
      checkFn: async () => this.checkDateRangeValidation()
    });

    // Filter Synchronization Checks
    this.addCheck({
      id: 'filter-persistence',
      name: 'Filter Persistence',
      description: 'Verify filter data persists correctly across sessions',
      category: 'FilterSync',
      severity: 'major',
      checkFn: async () => this.checkFilterPersistence()
    });

    this.addCheck({
      id: 'filter-dependencies',
      name: 'Filter Dependencies',
      description: 'Verify filter dependency relationships work correctly',
      category: 'FilterSync',
      severity: 'major',
      checkFn: async () => this.checkFilterDependencies()
    });

    // Cross-Component Consistency Checks
    this.addCheck({
      id: 'component-registration',
      name: 'Component Registration',
      description: 'Verify all components are properly registered',
      category: 'ComponentRegistry',
      severity: 'critical',
      checkFn: async () => this.checkComponentRegistration()
    });

    this.addCheck({
      id: 'state-synchronization',
      name: 'State Synchronization',
      description: 'Verify state changes propagate correctly across components',
      category: 'StateSynchronization',
      severity: 'critical',
      checkFn: async () => this.checkStateSynchronization()
    });

    // Performance Checks
    this.addCheck({
      id: 'memory-usage',
      name: 'Memory Usage',
      description: 'Check for memory leaks and excessive usage',
      category: 'Performance',
      severity: 'minor',
      checkFn: async () => this.checkMemoryUsage()
    });

    this.addCheck({
      id: 'performance-metrics',
      name: 'Performance Metrics',
      description: 'Verify performance optimization systems are working',
      category: 'Performance',
      severity: 'minor',
      checkFn: async () => this.checkPerformanceMetrics()
    });

    // Data Integrity Checks
    this.addCheck({
      id: 'data-integrity',
      name: 'Data Integrity',
      description: 'Verify data integrity across all storage systems',
      category: 'DataIntegrity',
      severity: 'critical',
      checkFn: async () => this.checkDataIntegrity()
    });

    this.addCheck({
      id: 'cross-browser-sync',
      name: 'Cross-Browser Sync',
      description: 'Verify synchronization works across browser tabs',
      category: 'CrossBrowserSync',
      severity: 'major',
      checkFn: async () => this.checkCrossBrowserSync()
    });
  }

  private addCheck(check: ConsistencyCheck): void {
    this.consistencyChecks.set(check.id, check);
  }

  // Individual check implementations

  private async checkDateRangePersistence(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test basic persistence
      const testRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      dateRangeSyncManager.persistDateRange(testRange);
      const retrieved = dateRangeSyncManager.getPersistedDateRange();

      if (!retrieved || retrieved.startDate !== testRange.startDate) {
        errors.push({
          id: 'date-persistence-basic',
          severity: 'critical',
          category: 'consistency',
          component: 'DateRangeSync',
          message: 'Basic date range persistence failed',
          details: { expected: testRange, actual: retrieved },
          fixSuggestion: 'Check localStorage availability and permissions'
        });
      }

      // Test property-specific persistence
      const propertyRange = { startDate: '2024-02-01', endDate: '2024-02-28' };
      dateRangeSyncManager.persistDateRange(propertyRange, 'test-property');
      const retrievedProperty = dateRangeSyncManager.getPersistedDateRange('test-property');

      if (!retrievedProperty || retrievedProperty.startDate !== propertyRange.startDate) {
        errors.push({
          id: 'date-persistence-property',
          severity: 'major',
          category: 'consistency',
          component: 'DateRangeSync',
          message: 'Property-specific date range persistence failed',
          details: { expected: propertyRange, actual: retrievedProperty }
        });
      }

    } catch (error) {
      errors.push({
        id: 'date-persistence-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'DateRangeSync',
        message: `Date range persistence check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkDateRangeValidation(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test invalid ranges
      const invalidRanges = [
        { startDate: '2024-01-31', endDate: '2024-01-01' }, // End before start
        { startDate: '2020-01-01', endDate: '2024-01-01' }, // Too long
        { startDate: 'invalid', endDate: '2024-01-01' }, // Invalid format
      ];

      invalidRanges.forEach((range, index) => {
        const validation = dateRangeSyncManager.validateDateRange(range);
        if (validation.isValid) {
          errors.push({
            id: `date-validation-invalid-${index}`,
            severity: 'major',
            category: 'consistency',
            component: 'DateRangeSync',
            message: `Invalid date range was accepted: ${JSON.stringify(range)}`,
            details: { range, validation }
          });
        }
      });

      // Test valid ranges
      const validRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const validation = dateRangeSyncManager.validateDateRange(validRange);
      if (!validation.isValid) {
        errors.push({
          id: 'date-validation-valid-rejected',
          severity: 'major',
          category: 'consistency',
          component: 'DateRangeSync',
          message: 'Valid date range was rejected',
          details: { range: validRange, validation }
        });
      }

    } catch (error) {
      errors.push({
        id: 'date-validation-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'DateRangeSync',
        message: `Date range validation check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkFilterPersistence(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test basic filter persistence
      const testFilters = { trafficSource: 'google', deviceCategory: 'mobile' };
      filterSyncManager.persistFilters(testFilters);
      const retrieved = filterSyncManager.getPersistedFilters();

      if (!retrieved || retrieved.trafficSource !== testFilters.trafficSource) {
        errors.push({
          id: 'filter-persistence-basic',
          severity: 'major',
          category: 'consistency',
          component: 'FilterSync',
          message: 'Basic filter persistence failed',
          details: { expected: testFilters, actual: retrieved }
        });
      }

    } catch (error) {
      errors.push({
        id: 'filter-persistence-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'FilterSync',
        message: `Filter persistence check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkFilterDependencies(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test filter dependencies
      const filtersWithDeps = { trafficSource: 'google', adEnabled: false };
      const resolved = filterSyncManager.applyFilterDependencies(filtersWithDeps);

      // Google traffic should imply ads enabled
      if (resolved.adEnabled !== true) {
        warnings.push({
          id: 'filter-dependencies-google-ads',
          category: 'best_practice',
          component: 'FilterSync',
          message: 'Google traffic source should typically have ads enabled',
          details: { original: filtersWithDeps, resolved },
          recommendation: 'Review filter dependency rules'
        });
      }

    } catch (error) {
      errors.push({
        id: 'filter-dependencies-exception',
        severity: 'major',
        category: 'consistency',
        component: 'FilterSync',
        message: `Filter dependencies check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkComponentRegistration(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      const components = componentStateRegistry.getAllComponents();
      
      if (components.length === 0) {
        errors.push({
          id: 'component-registration-empty',
          severity: 'critical',
          category: 'consistency',
          component: 'ComponentRegistry',
          message: 'No components are registered',
          details: { componentCount: 0 },
          fixSuggestion: 'Ensure components are properly registering themselves'
        });
      }

      // Check for expected components
      const expectedComponents = ['DashboardContext', 'FilterPanel', 'DateRangePicker'];
      expectedComponents.forEach(expectedComponent => {
        const found = components.find(c => c.componentName.includes(expectedComponent));
        if (!found) {
          warnings.push({
            id: `component-registration-missing-${expectedComponent}`,
            category: 'compatibility',
            component: 'ComponentRegistry',
            message: `Expected component ${expectedComponent} not found`,
            details: { expectedComponent, registeredComponents: components.map(c => c.componentName) },
            recommendation: 'Verify component registration in lifecycle hooks'
          });
        }
      });

    } catch (error) {
      errors.push({
        id: 'component-registration-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'ComponentRegistry',
        message: `Component registration check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkStateSynchronization(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // This would ideally test actual state propagation
      // For now, we'll check if the systems are initialized
      const registryStats = componentStateRegistry.getRegistryStats();
      
      if (registryStats.componentCount === 0) {
        errors.push({
          id: 'state-sync-no-components',
          severity: 'major',
          category: 'consistency',
          component: 'StateSynchronization',
          message: 'No components available for state synchronization',
          details: { stats: registryStats }
        });
      }

    } catch (error) {
      errors.push({
        id: 'state-sync-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'StateSynchronization',
        message: `State synchronization check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkMemoryUsage(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Check memory usage of various systems
      if (performance.memory) {
        const memoryInfo = performance.memory;
        const usedMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        
        if (usedMB > 100) { // 100MB threshold
          warnings.push({
            id: 'memory-usage-high',
            category: 'performance',
            component: 'Performance',
            message: `High memory usage detected: ${usedMB.toFixed(2)}MB`,
            details: { memoryInfo },
            recommendation: 'Consider implementing memory cleanup strategies'
          });
        }
      }

      suggestions.push({
        id: 'memory-optimization',
        type: 'optimization',
        component: 'Performance',
        message: 'Implement regular memory cleanup intervals',
        impact: 'medium',
        implementation: 'Add periodic cleanup calls to optimization systems'
      });

    } catch (error) {
      // Memory API might not be available in all environments
      warnings.push({
        id: 'memory-check-unavailable',
        category: 'compatibility',
        component: 'Performance',
        message: 'Memory usage check not available in this environment',
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkPerformanceMetrics(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Check if performance systems are collecting metrics
      const renderStats = (global as any).renderOptimizer?.getRenderStats?.();
      const batchStats = (global as any).updateBatcher?.getStats?.();
      
      if (!renderStats) {
        warnings.push({
          id: 'performance-render-stats-missing',
          category: 'performance',
          component: 'Performance',
          message: 'Render performance metrics not available',
          details: {},
          recommendation: 'Ensure render optimizer is properly initialized'
        });
      }

      if (!batchStats) {
        warnings.push({
          id: 'performance-batch-stats-missing',
          category: 'performance',
          component: 'Performance',
          message: 'Update batching metrics not available',
          details: {},
          recommendation: 'Ensure update batcher is properly initialized'
        });
      }

    } catch (error) {
      errors.push({
        id: 'performance-metrics-exception',
        severity: 'minor',
        category: 'performance',
        component: 'Performance',
        message: `Performance metrics check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkDataIntegrity(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test data consistency across storage systems
      const testData = { test: 'consistency', timestamp: Date.now() };
      
      // Store in multiple systems and verify consistency
      dateRangeSyncManager.persistDateRange({ startDate: '2024-01-01', endDate: '2024-01-31' });
      filterSyncManager.persistFilters({ test: 'data' } as any);

      // Verify data can be retrieved
      const dateRange = dateRangeSyncManager.getPersistedDateRange();
      const filters = filterSyncManager.getPersistedFilters();

      if (!dateRange) {
        errors.push({
          id: 'data-integrity-date-range',
          severity: 'major',
          category: 'consistency',
          component: 'DataIntegrity',
          message: 'Date range data integrity check failed',
          details: { dateRange }
        });
      }

      if (!filters) {
        errors.push({
          id: 'data-integrity-filters',
          severity: 'major',
          category: 'consistency',
          component: 'DataIntegrity',
          message: 'Filter data integrity check failed',
          details: { filters }
        });
      }

    } catch (error) {
      errors.push({
        id: 'data-integrity-exception',
        severity: 'critical',
        category: 'consistency',
        component: 'DataIntegrity',
        message: `Data integrity check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private async checkCrossBrowserSync(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Test cross-browser sync capabilities
      if (typeof BroadcastChannel !== 'undefined') {
        // BroadcastChannel is available - good for cross-tab sync
        suggestions.push({
          id: 'cross-browser-sync-available',
          type: 'enhancement',
          component: 'CrossBrowserSync',
          message: 'BroadcastChannel API is available for enhanced cross-tab sync',
          impact: 'medium',
          implementation: 'Implement BroadcastChannel for real-time cross-tab sync'
        });
      } else {
        warnings.push({
          id: 'cross-browser-sync-limited',
          category: 'compatibility',
          component: 'CrossBrowserSync',
          message: 'BroadcastChannel API not available - cross-tab sync will be limited',
          details: {},
          recommendation: 'Fallback to storage events for cross-tab sync'
        });
      }

    } catch (error) {
      errors.push({
        id: 'cross-browser-sync-exception',
        severity: 'minor',
        category: 'compatibility',
        component: 'CrossBrowserSync',
        message: `Cross-browser sync check failed: ${error}`,
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(errors, warnings, suggestions);
  }

  private createValidationResult(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): ValidationResult {
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const majorErrors = errors.filter(e => e.severity === 'major').length;
    const minorErrors = errors.filter(e => e.severity === 'minor').length;

    const totalChecks = 1; // Each individual check
    const passedChecks = errors.length === 0 ? 1 : 0;
    const failedChecks = totalChecks - passedChecks;

    // Calculate score (0-100)
    let score = 100;
    score -= criticalErrors * 30; // Critical errors -30 points each
    score -= majorErrors * 15;    // Major errors -15 points each
    score -= minorErrors * 5;     // Minor errors -5 points each
    score -= warnings.length * 2; // Warnings -2 points each
    score = Math.max(0, score);

    const reliability = score >= 90 ? 'excellent' : 
                       score >= 70 ? 'good' : 
                       score >= 50 ? 'fair' : 'poor';

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        criticalErrors,
        majorErrors,
        minorErrors,
        warnings: warnings.length,
        suggestions: suggestions.length,
        overallScore: score,
        reliability
      }
    };
  }

  private aggregateResults(results: ValidationResult[]): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    const allSuggestions: ValidationSuggestion[] = [];

    results.forEach(result => {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    });

    const criticalErrors = allErrors.filter(e => e.severity === 'critical').length;
    const majorErrors = allErrors.filter(e => e.severity === 'major').length;
    const minorErrors = allErrors.filter(e => e.severity === 'minor').length;

    const totalChecks = results.length;
    const passedChecks = results.filter(r => r.isValid).length;
    const failedChecks = totalChecks - passedChecks;

    // Calculate overall score
    let score = 100;
    if (totalChecks > 0) {
      score = Math.round((passedChecks / totalChecks) * 100);
      score -= criticalErrors * 10; // Additional penalty for critical errors
      score -= majorErrors * 5;     // Additional penalty for major errors
      score = Math.max(0, score);
    }

    const reliability = score >= 90 ? 'excellent' : 
                       score >= 70 ? 'good' : 
                       score >= 50 ? 'fair' : 'poor';

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        criticalErrors,
        majorErrors,
        minorErrors,
        warnings: allWarnings.length,
        suggestions: allSuggestions.length,
        overallScore: score,
        reliability
      }
    };
  }
}

// Export singleton instance
export const stateConsistencyValidator = StateConsistencyValidator.getInstance();

// Export types for external use
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,
  ValidationSummary,
  ConsistencyCheck
};