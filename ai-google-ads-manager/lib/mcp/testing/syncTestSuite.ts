/**
 * Comprehensive Test Suite for State Synchronization Systems
 * Provides automated testing for all synchronization scenarios and edge cases
 */

import { dateRangeSyncManager } from '../utils/dateRangeSync';
import { filterSyncManager } from '../utils/filterSync';
import { stateUpdateQueue } from '../utils/stateQueue';
import { concurrentUpdateHandler } from '../utils/concurrentUpdates';
import { conflictResolutionManager } from '../utils/conflictResolution';
import { componentStateRegistry } from '../utils/componentRegistry';
import { stateChangeEventManager } from '../utils/stateEvents';
import { componentStateValidator } from '../utils/stateValidator';
import { renderOptimizer } from '../utils/renderOptimizer';
import { updateBatcher } from '../utils/updateBatcher';
import { changeDetector } from '../utils/changeDetection';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  details: Record<string, any>;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
  coverage: number;
}

export interface SyncTestConfig {
  includePerformanceTests: boolean;
  includeStressTests: boolean;
  includeConcurrencyTests: boolean;
  includeEdgeCaseTests: boolean;
  testTimeoutMs: number;
  stressTestIterations: number;
  concurrentUsers: number;
}

export class SyncTestSuite {
  private config: SyncTestConfig;
  private testResults: Map<string, TestSuite>;
  private testData: any;

  constructor(config: Partial<SyncTestConfig> = {}) {
    this.config = {
      includePerformanceTests: true,
      includeStressTests: true,
      includeConcurrencyTests: true,
      includeEdgeCaseTests: true,
      testTimeoutMs: 5000,
      stressTestIterations: 100,
      concurrentUsers: 10,
      ...config
    };

    this.testResults = new Map();
    this.setupTestData();
  }

  /**
   * Run all synchronization tests
   */
  public async runAllTests(): Promise<Record<string, TestSuite>> {
    console.log('🧪 Starting Comprehensive Synchronization Test Suite...\n');

    const suites = [
      { name: 'Date Range Synchronization', testFn: () => this.testDateRangeSync() },
      { name: 'Filter State Propagation', testFn: () => this.testFilterSync() },
      { name: 'Race Condition Handling', testFn: () => this.testRaceConditions() },
      { name: 'Cross-Component Consistency', testFn: () => this.testCrossComponent() },
      { name: 'Performance Optimization', testFn: () => this.testPerformance() },
      { name: 'Integration Tests', testFn: () => this.testIntegration() }
    ];

    for (const suite of suites) {
      try {
        console.log(`🏃‍♂️ Running ${suite.name} tests...`);
        const startTime = performance.now();
        const results = await suite.testFn();
        const duration = performance.now() - startTime;

        const testSuite: TestSuite = {
          name: suite.name,
          tests: results,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          duration,
          coverage: this.calculateCoverage(results)
        };

        this.testResults.set(suite.name, testSuite);
        this.logSuiteResults(testSuite);

      } catch (error) {
        console.error(`❌ Error running ${suite.name}:`, error);
        this.testResults.set(suite.name, {
          name: suite.name,
          tests: [],
          passed: 0,
          failed: 1,
          duration: 0,
          coverage: 0
        });
      }
    }

    return Object.fromEntries(this.testResults);
  }

  /**
   * Test date range synchronization scenarios
   */
  private async testDateRangeSync(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Basic date range setting
    tests.push(await this.runTest('Basic Date Range Setting', async () => {
      const testRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const validation = dateRangeSyncManager.validateDateRange(testRange);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const normalized = dateRangeSyncManager.normalizeDateRange(testRange);
      if (!normalized.startDate || !normalized.endDate) {
        throw new Error('Normalization failed to produce valid dates');
      }

      return { range: normalized, validation };
    }));

    // Test 2: Cross-browser synchronization
    tests.push(await this.runTest('Cross-Browser Sync', async () => {
      const testRange = { startDate: '2024-02-01', endDate: '2024-02-28' };
      
      // Simulate persisting and retrieving
      dateRangeSyncManager.persistDateRange(testRange);
      const retrieved = dateRangeSyncManager.getPersistedDateRange();
      
      if (!retrieved || retrieved.startDate !== testRange.startDate) {
        throw new Error('Cross-browser sync failed');
      }

      return { persisted: testRange, retrieved };
    }));

    // Test 3: Date range validation edge cases
    tests.push(await this.runTest('Date Range Validation Edge Cases', async () => {
      const edgeCases = [
        { startDate: '2024-01-01', endDate: '2023-12-31' }, // Invalid: end before start
        { startDate: '2020-01-01', endDate: '2024-01-01' }, // Invalid: too long range
        { startDate: '2024-01-01', endDate: '2024-01-01' }, // Valid: same day
      ];

      const results = edgeCases.map(range => ({
        range,
        validation: dateRangeSyncManager.validateDateRange(range)
      }));

      // First two should be invalid, last should be valid
      if (results[0].validation.isValid || results[1].validation.isValid || !results[2].validation.isValid) {
        throw new Error('Edge case validation failed');
      }

      return { results };
    }));

    // Test 4: Property-specific date ranges
    tests.push(await this.runTest('Property-Specific Date Ranges', async () => {
      const property1Range = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const property2Range = { startDate: '2024-02-01', endDate: '2024-02-28' };

      dateRangeSyncManager.persistDateRange(property1Range, 'property-1');
      dateRangeSyncManager.persistDateRange(property2Range, 'property-2');

      const retrieved1 = dateRangeSyncManager.getPersistedDateRange('property-1');
      const retrieved2 = dateRangeSyncManager.getPersistedDateRange('property-2');

      if (!retrieved1 || !retrieved2 || 
          retrieved1.startDate !== property1Range.startDate ||
          retrieved2.startDate !== property2Range.startDate) {
        throw new Error('Property-specific persistence failed');
      }

      return { property1: retrieved1, property2: retrieved2 };
    }));

    return tests;
  }

  /**
   * Test filter synchronization scenarios
   */
  private async testFilterSync(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Filter validation and normalization
    tests.push(await this.runTest('Filter Validation and Normalization', async () => {
      const testFilters = {
        trafficSource: 'google',
        deviceCategory: 'mobile',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      const validation = filterSyncManager.validateFilters(testFilters);
      if (!validation.isValid) {
        throw new Error(`Filter validation failed: ${validation.errors.join(', ')}`);
      }

      const normalized = filterSyncManager.normalizeFilters(testFilters);
      return { original: testFilters, normalized, validation };
    }));

    // Test 2: Filter dependencies
    tests.push(await this.runTest('Filter Dependencies', async () => {
      const filtersWithDeps = {
        trafficSource: 'google',
        adEnabled: true,
        deviceCategory: 'mobile'
      };

      const withDependencies = filterSyncManager.applyFilterDependencies(filtersWithDeps);
      
      // Should have implied dependencies applied
      if (!withDependencies.trafficSource || !withDependencies.adEnabled) {
        throw new Error('Filter dependencies not applied correctly');
      }

      return { original: filtersWithDeps, withDependencies };
    }));

    // Test 3: Filter presets
    tests.push(await this.runTest('Filter Presets', async () => {
      const presets = filterSyncManager.getAvailablePresets();
      
      if (!presets.length) {
        throw new Error('No filter presets available');
      }

      const googleFocusPreset = presets.find(p => p.name === 'Google Focus');
      if (!googleFocusPreset) {
        throw new Error('Google Focus preset not found');
      }

      const appliedPreset = filterSyncManager.applyPreset('Google Focus', {});
      if (!appliedPreset.trafficSource || appliedPreset.trafficSource !== 'google') {
        throw new Error('Preset application failed');
      }

      return { presets, appliedPreset };
    }));

    // Test 4: Filter conflict resolution
    tests.push(await this.runTest('Filter Conflict Resolution', async () => {
      const conflictingFilters = {
        trafficSource: 'google',
        adEnabled: false, // Conflict: Google traffic but ads disabled
        deviceCategory: 'mobile'
      };

      const resolved = filterSyncManager.resolveFilterConflicts(conflictingFilters);
      
      // Should resolve the conflict
      if (resolved.adEnabled !== true) {
        throw new Error('Filter conflict not resolved');
      }

      return { original: conflictingFilters, resolved };
    }));

    return tests;
  }

  /**
   * Test race condition handling
   */
  private async testRaceConditions(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Concurrent updates detection
    tests.push(await this.runTest('Concurrent Updates Detection', async () => {
      const initialState = { value: 0, version: 1 };
      const update1 = { value: 1, version: 2 };
      const update2 = { value: 2, version: 2 }; // Same version - conflict

      const result1 = await concurrentUpdateHandler.processUpdate(initialState, update1, 'user1');
      const result2 = await concurrentUpdateHandler.processUpdate(initialState, update2, 'user2');

      if (!result1.success || result2.success) {
        throw new Error('Concurrent update detection failed');
      }

      return { result1, result2 };
    }));

    // Test 2: State update queuing
    tests.push(await this.runTest('State Update Queuing', async () => {
      const updates = [
        { id: '1', type: 'test', data: { value: 1 }, priority: 'high' },
        { id: '2', type: 'test', data: { value: 2 }, priority: 'normal' },
        { id: '3', type: 'test', data: { value: 3 }, priority: 'low' }
      ];

      const promises = updates.map(update => 
        stateUpdateQueue.queueUpdate(update.data, update.type, 'test', update.priority as any)
      );

      const results = await Promise.all(promises);
      
      if (!results.every(r => r.success)) {
        throw new Error('Update queuing failed');
      }

      return { updates, results };
    }));

    // Test 3: Conflict resolution strategies
    tests.push(await this.runTest('Conflict Resolution Strategies', async () => {
      const conflicts = [
        {
          type: 'timestamp',
          localData: { value: 1, timestamp: Date.now() - 1000 },
          remoteData: { value: 2, timestamp: Date.now() }
        },
        {
          type: 'priority',
          localData: { value: 1, priority: 'normal' },
          remoteData: { value: 2, priority: 'high' }
        }
      ];

      const resolutions = await Promise.all(
        conflicts.map(conflict => 
          conflictResolutionManager.resolveConflict(
            conflict.localData,
            conflict.remoteData,
            { strategy: conflict.type as any, context: 'test' }
          )
        )
      );

      // Check that conflicts were resolved appropriately
      if (resolutions[0].resolution.value !== 2 || resolutions[1].resolution.value !== 2) {
        throw new Error('Conflict resolution strategies failed');
      }

      return { conflicts, resolutions };
    }));

    return tests;
  }

  /**
   * Test cross-component state consistency
   */
  private async testCrossComponent(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Component registration and tracking
    tests.push(await this.runTest('Component Registration', async () => {
      const components = [
        { id: 'comp1', name: 'Dashboard', type: 'layout' },
        { id: 'comp2', name: 'Filter Panel', type: 'filter' },
        { id: 'comp3', name: 'Chart Widget', type: 'widget' }
      ];

      components.forEach(comp => {
        componentStateRegistry.registerComponent(comp.id, {
          componentName: comp.name,
          componentType: comp.type,
          state: { initialized: true },
          dependencies: []
        });
      });

      const registeredComponents = componentStateRegistry.getAllComponents();
      
      if (registeredComponents.length < components.length) {
        throw new Error('Component registration failed');
      }

      return { components, registeredComponents };
    }));

    // Test 2: State change event propagation
    tests.push(await this.runTest('State Change Event Propagation', async () => {
      let eventReceived = false;
      let eventData: any = null;

      const subscription = stateChangeEventManager.subscribe(
        'test.state.changed',
        (data) => {
          eventReceived = true;
          eventData = data;
        },
        { componentId: 'test-component' }
      );

      stateChangeEventManager.publish(
        'test.state.changed',
        { newValue: 42 },
        'test'
      );

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!eventReceived || eventData?.newValue !== 42) {
        throw new Error('Event propagation failed');
      }

      stateChangeEventManager.unsubscribe(subscription.id);
      return { eventReceived, eventData };
    }));

    // Test 3: State validation
    tests.push(await this.runTest('State Validation', async () => {
      const validState = {
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        filters: { trafficSource: 'google' },
        selectedProperty: 'property-1'
      };

      const invalidState = {
        dateRange: { startDate: '2024-01-31', endDate: '2024-01-01' }, // Invalid
        filters: { trafficSource: 'invalid-source' },
        selectedProperty: null
      };

      const validResult = componentStateValidator.validateState(validState, 'dashboard');
      const invalidResult = componentStateValidator.validateState(invalidState, 'dashboard');

      if (!validResult.isValid || invalidResult.isValid) {
        throw new Error('State validation failed');
      }

      return { validResult, invalidResult };
    }));

    return tests;
  }

  /**
   * Test performance optimization features
   */
  private async testPerformance(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Render optimization
    tests.push(await this.runTest('Render Optimization', async () => {
      const componentName = 'test-component';
      
      // Simulate renders
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        // Simulate render work
        await new Promise(resolve => setTimeout(resolve, 10));
        const endTime = performance.now();
        
        renderOptimizer.collectMetrics(componentName, startTime, endTime, {
          renderStartTime: startTime,
          renderEndTime: endTime,
          renderDuration: endTime - startTime,
          propsChanged: i % 2 === 0,
          stateChanged: false,
          forceRender: false,
          isVisible: true
        });
      }

      const metrics = renderOptimizer.getComponentMetrics(componentName);
      
      if (!metrics || metrics.renderCount !== 5) {
        throw new Error('Render metrics collection failed');
      }

      return { metrics };
    }));

    // Test 2: Update batching
    tests.push(await this.runTest('Update Batching', async () => {
      const updates = Array.from({ length: 10 }, (_, i) => ({
        id: `update-${i}`,
        type: 'test-update',
        data: { value: i },
        timestamp: Date.now() + i,
        source: 'test',
        dependencies: []
      }));

      const batchResult = await updateBatcher.batchUpdates(updates, 'normal');
      
      if (!batchResult.success || batchResult.updatesProcessed !== updates.length) {
        throw new Error('Update batching failed');
      }

      return { updates: updates.length, batchResult };
    }));

    // Test 3: Change detection optimization
    tests.push(await this.runTest('Change Detection Optimization', async () => {
      const obj1 = { a: 1, b: { c: 2, d: [1, 2, 3] } };
      const obj2 = { a: 1, b: { c: 2, d: [1, 2, 3] } }; // Same content
      const obj3 = { a: 1, b: { c: 3, d: [1, 2, 3] } }; // Different content

      const result1 = changeDetector.deepEquals(obj1, obj2);
      const result2 = changeDetector.deepEquals(obj1, obj3);

      if (!result1.isEqual || result2.isEqual) {
        throw new Error('Change detection failed');
      }

      return { result1, result2 };
    }));

    return tests;
  }

  /**
   * Test integration scenarios
   */
  private async testIntegration(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: End-to-end synchronization
    tests.push(await this.runTest('End-to-End Synchronization', async () => {
      // Simulate a complete user action that triggers multiple syncs
      const dateRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const filters = { trafficSource: 'google', deviceCategory: 'mobile' };

      // Trigger date range sync
      dateRangeSyncManager.persistDateRange(dateRange);
      
      // Trigger filter sync
      filterSyncManager.persistFilters(filters);

      // Verify persistence
      const retrievedDateRange = dateRangeSyncManager.getPersistedDateRange();
      const retrievedFilters = filterSyncManager.getPersistedFilters();

      if (!retrievedDateRange || !retrievedFilters) {
        throw new Error('End-to-end synchronization failed');
      }

      return { dateRange: retrievedDateRange, filters: retrievedFilters };
    }));

    // Test 2: Multi-property consistency
    tests.push(await this.runTest('Multi-Property Consistency', async () => {
      const properties = ['property-1', 'property-2', 'property-3'];
      const baseFilters = { deviceCategory: 'mobile' };

      // Set different traffic sources for each property
      properties.forEach((propertyId, index) => {
        const filters = {
          ...baseFilters,
          trafficSource: ['google', 'facebook', 'organic'][index]
        };
        filterSyncManager.persistFilters(filters, propertyId);
      });

      // Verify isolation
      const retrievedFilters = properties.map(propertyId => ({
        propertyId,
        filters: filterSyncManager.getPersistedFilters(propertyId)
      }));

      // Each property should have different traffic sources
      const uniqueTrafficSources = new Set(
        retrievedFilters.map(r => r.filters?.trafficSource)
      );

      if (uniqueTrafficSources.size !== 3) {
        throw new Error('Multi-property isolation failed');
      }

      return { retrievedFilters };
    }));

    return tests;
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName,
      passed: false,
      duration: 0,
      errors: [],
      warnings: [],
      details: {}
    };

    try {
      const testResult = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), this.config.testTimeoutMs)
        )
      ]);

      result.passed = true;
      result.details = testResult;

    } catch (error) {
      result.passed = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  /**
   * Calculate test coverage percentage
   */
  private calculateCoverage(tests: TestResult[]): number {
    if (tests.length === 0) return 0;
    return Math.round((tests.filter(t => t.passed).length / tests.length) * 100);
  }

  /**
   * Log test suite results
   */
  private logSuiteResults(suite: TestSuite): void {
    const status = suite.failed === 0 ? '✅' : '❌';
    const coverage = `${suite.coverage}%`;
    const timing = `${suite.duration.toFixed(2)}ms`;
    
    console.log(`${status} ${suite.name}: ${suite.passed}/${suite.tests.length} passed (${coverage} coverage) - ${timing}`);
    
    if (suite.failed > 0) {
      suite.tests.filter(t => !t.passed).forEach(test => {
        console.log(`   ❌ ${test.testName}: ${test.errors.join(', ')}`);
      });
    }
  }

  /**
   * Generate comprehensive test report
   */
  public generateReport(): string {
    const allSuites = Array.from(this.testResults.values());
    const totalTests = allSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    const totalPassed = allSuites.reduce((sum, suite) => sum + suite.passed, 0);
    const totalDuration = allSuites.reduce((sum, suite) => sum + suite.duration, 0);
    const overallCoverage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    let report = '📊 SYNCHRONIZATION TEST SUITE REPORT\n';
    report += '================================================================================\n\n';
    
    allSuites.forEach(suite => {
      report += `${suite.name}:\n`;
      report += `  Tests: ${suite.passed}/${suite.tests.length} passed\n`;
      report += `  Coverage: ${suite.coverage}%\n`;
      report += `  Duration: ${suite.duration.toFixed(2)}ms\n\n`;
    });

    report += `OVERALL RESULTS:\n`;
    report += `  Total Tests: ${totalPassed}/${totalTests} passed\n`;
    report += `  Overall Coverage: ${overallCoverage}%\n`;
    report += `  Total Duration: ${totalDuration.toFixed(2)}ms\n`;
    report += `  Status: ${overallCoverage >= 90 ? '🟢 EXCELLENT' : overallCoverage >= 80 ? '🟡 GOOD' : '🔴 NEEDS IMPROVEMENT'}\n`;

    return report;
  }

  /**
   * Setup test data
   */
  private setupTestData(): void {
    this.testData = {
      dateRanges: [
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        { startDate: '2024-02-01', endDate: '2024-02-28' },
        { startDate: '2024-03-01', endDate: '2024-03-31' }
      ],
      filters: [
        { trafficSource: 'google', deviceCategory: 'mobile' },
        { trafficSource: 'facebook', deviceCategory: 'desktop' },
        { trafficSource: 'organic', deviceCategory: 'tablet' }
      ],
      properties: ['property-1', 'property-2', 'property-3']
    };
  }
}

// Export singleton instance
export const syncTestSuite = new SyncTestSuite();

// Export types for external use
export type {
  TestResult,
  TestSuite,
  SyncTestConfig
};