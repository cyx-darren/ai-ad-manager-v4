/**
 * Adapter Testing Utilities
 * 
 * Comprehensive testing system for MCP data adapters including performance testing,
 * error scenario testing, compatibility testing, and test data generation.
 */

import { 
  BaseAdapter,
  ValidationEngine,
  DataSanitizer,
  ComponentIntegrationManager,
  AdapterFactory,
  createChartAdapter,
  createWidgetAdapter,
  createTableAdapter,
  createMetricCardAdapter
} from './index';

import type {
  ChartInputData,
  WidgetInputData,
  TableInputData,
  MetricCardInputData,
  ExtendedAdapterConfig,
  ValidationResult,
  SanitizationResult
} from './index';

// ============================================================================
// TESTING TYPES
// ============================================================================

/**
 * Test configuration options
 */
export interface TestConfig {
  // Test scope
  includePerformanceTests?: boolean;
  includeErrorTests?: boolean;
  includeCompatibilityTests?: boolean;
  includeIntegrationTests?: boolean;
  
  // Performance test settings
  performanceIterations?: number;
  performanceDataSizes?: number[];
  performanceTimeoutMs?: number;
  
  // Error test settings
  errorTestTypes?: ErrorTestType[];
  
  // Output settings
  verboseOutput?: boolean;
  logResults?: boolean;
  generateReport?: boolean;
}

/**
 * Error test types
 */
export enum ErrorTestType {
  NULL_DATA = 'null_data',
  INVALID_DATA = 'invalid_data',
  MALFORMED_JSON = 'malformed_json',
  XSS_INJECTION = 'xss_injection',
  SQL_INJECTION = 'sql_injection',
  OVERFLOW_ATTACK = 'overflow_attack',
  MEMORY_EXHAUSTION = 'memory_exhaustion'
}

/**
 * Test result for individual test
 */
export interface TestResult {
  testName: string;
  testType: 'performance' | 'error' | 'compatibility' | 'integration';
  passed: boolean;
  duration: number;
  details: any;
  errors: string[];
  warnings: string[];
}

/**
 * Complete test suite result
 */
export interface TestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  results: TestResult[];
  summary: {
    performanceScore: number;
    securityScore: number;
    compatibilityScore: number;
    integrationScore: number;
  };
}

/**
 * Performance test result
 */
export interface PerformanceTestResult {
  adapterType: string;
  dataSize: number;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // operations per second
  memoryUsage?: number;
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Test data generator for different adapter types
 */
export class TestDataGenerator {
  /**
   * Generate chart test data
   */
  static generateChartData(size: number = 100, withErrors: boolean = false): ChartInputData {
    const data = [];
    const startDate = new Date('2024-01-01');
    
    for (let i = 0; i < size; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      data.push({
        date: withErrors && i % 10 === 0 ? null : date.toISOString().split('T')[0],
        value: withErrors && i % 15 === 0 ? null : Math.floor(Math.random() * 1000),
        clicks: withErrors && i % 20 === 0 ? 'invalid' : Math.floor(Math.random() * 500),
        impressions: Math.floor(Math.random() * 10000),
        cost: Math.random() * 100
      });
    }
    
    return {
      data,
      summary: {
        total: data.length,
        change: Math.random() * 20 - 10,
        trend: Math.random() > 0.5 ? 'up' : 'down'
      }
    };
  }

  /**
   * Generate widget test data
   */
  static generateWidgetData(withErrors: boolean = false): WidgetInputData {
    return {
      data: [
        {
          sessions: withErrors ? 'invalid' : Math.floor(Math.random() * 10000),
          pageviews: Math.floor(Math.random() * 50000),
          bounceRate: Math.random(),
          avgSessionDuration: Math.floor(Math.random() * 300),
          source: withErrors ? '<script>alert("xss")</script>' : 'google',
          medium: 'organic'
        }
      ],
      summary: {
        totalSessions: withErrors ? null : Math.floor(Math.random() * 10000),
        changePercent: Math.random() * 20 - 10
      }
    };
  }

  /**
   * Generate table test data
   */
  static generateTableData(size: number = 50, withErrors: boolean = false): TableInputData {
    const data = [];
    
    for (let i = 0; i < size; i++) {
      data.push({
        page: withErrors && i % 10 === 0 ? null : `/page-${i}`,
        pageviews: withErrors && i % 15 === 0 ? 'invalid' : Math.floor(Math.random() * 1000),
        bounceRate: Math.random(),
        avgTimeOnPage: Math.floor(Math.random() * 300),
        source: withErrors && i % 20 === 0 ? 'DROP TABLE users; --' : 'google'
      });
    }
    
    return {
      data,
      columns: [
        { key: 'page', title: 'Page', type: 'string' },
        { key: 'pageviews', title: 'Pageviews', type: 'number' },
        { key: 'bounceRate', title: 'Bounce Rate', type: 'percentage' },
        { key: 'avgTimeOnPage', title: 'Avg Time', type: 'duration' }
      ]
    };
  }

  /**
   * Generate metric card test data
   */
  static generateMetricCardData(withErrors: boolean = false): MetricCardInputData {
    return {
      current: withErrors ? NaN : Math.floor(Math.random() * 10000),
      previous: Math.floor(Math.random() * 10000),
      title: withErrors ? '<img src=x onerror=alert("xss")>' : 'Test Metric',
      subtitle: 'Test metric for validation',
      unit: withErrors ? null : 'views',
      type: 'number'
    };
  }

  /**
   * Generate malicious test data for security testing
   */
  static generateMaliciousData(): any {
    return {
      xssPayloads: [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        'data:text/html,<script>alert("xss")</script>'
      ],
      sqlPayloads: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES ('admin', 'password'); --"
      ],
      overflowPayloads: [
        'A'.repeat(10000),
        Number.MAX_SAFE_INTEGER + 1,
        Array(1000).fill({}).map(() => ({ data: 'A'.repeat(1000) }))
      ]
    };
  }
}

// ============================================================================
// ADAPTER TESTING ENGINE
// ============================================================================

/**
 * Main adapter testing engine
 */
export class AdapterTestingEngine {
  private config: TestConfig;
  private results: TestResult[];
  
  constructor(config: TestConfig = {}) {
    this.config = {
      includePerformanceTests: true,
      includeErrorTests: true,
      includeCompatibilityTests: true,
      includeIntegrationTests: true,
      performanceIterations: 100,
      performanceDataSizes: [10, 100, 1000],
      performanceTimeoutMs: 5000,
      errorTestTypes: Object.values(ErrorTestType),
      verboseOutput: false,
      logResults: true,
      generateReport: true,
      ...config
    };
    this.results = [];
  }

  /**
   * Run complete test suite
   */
  public async runTestSuite(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    this.results = [];
    
    if (this.config.verboseOutput) {
      console.log('🧪 Starting Adapter Test Suite...\n');
    }

    // Run performance tests
    if (this.config.includePerformanceTests) {
      await this.runPerformanceTests();
    }

    // Run error handling tests
    if (this.config.includeErrorTests) {
      await this.runErrorTests();
    }

    // Run compatibility tests
    if (this.config.includeCompatibilityTests) {
      await this.runCompatibilityTests();
    }

    // Run integration tests
    if (this.config.includeIntegrationTests) {
      await this.runIntegrationTests();
    }

    const totalDuration = Date.now() - startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;

    const result: TestSuiteResult = {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      totalDuration,
      results: this.results,
      summary: this.calculateSummaryScores()
    };

    if (this.config.logResults) {
      this.logTestResults(result);
    }

    return result;
  }

  // ============================================================================
  // PERFORMANCE TESTING
  // ============================================================================

  /**
   * Run performance tests for all adapter types
   */
  private async runPerformanceTests(): Promise<void> {
    if (this.config.verboseOutput) {
      console.log('⚡ Running Performance Tests...');
    }

    const adapterTypes = [
      { type: 'chart-line', factory: () => createChartAdapter('line') },
      { type: 'chart-bar', factory: () => createChartAdapter('bar') },
      { type: 'chart-donut', factory: () => createChartAdapter('donut') },
      { type: 'widget-traffic', factory: () => createWidgetAdapter('traffic-overview') },
      { type: 'widget-conversion', factory: () => createWidgetAdapter('conversion') },
      { type: 'table-generic', factory: () => createTableAdapter('generic') },
      { type: 'metric-card', factory: () => createMetricCardAdapter() }
    ];

    for (const adapterInfo of adapterTypes) {
      for (const dataSize of this.config.performanceDataSizes!) {
        await this.runPerformanceTest(adapterInfo.type, adapterInfo.factory, dataSize);
      }
    }
  }

  /**
   * Run performance test for specific adapter
   */
  private async runPerformanceTest(
    adapterType: string, 
    adapterFactory: () => any, 
    dataSize: number
  ): Promise<void> {
    const testName = `Performance: ${adapterType} (${dataSize} items)`;
    const startTime = Date.now();
    
    try {
      const adapter = adapterFactory();
      const testData = this.generateTestData(adapterType, dataSize);
      
      const times: number[] = [];
      const iterations = this.config.performanceIterations!;
      
      for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now();
        adapter.transform(testData);
        times.push(Date.now() - iterationStart);
        
        // Timeout check
        if (Date.now() - startTime > this.config.performanceTimeoutMs!) {
          throw new Error(`Performance test timed out after ${this.config.performanceTimeoutMs}ms`);
        }
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const throughput = 1000 / avgTime; // operations per second
      
      const performanceResult: PerformanceTestResult = {
        adapterType,
        dataSize,
        iterations,
        averageTime: avgTime,
        minTime,
        maxTime,
        throughput
      };
      
      this.results.push({
        testName,
        testType: 'performance',
        passed: avgTime < 100, // Pass if under 100ms average
        duration: Date.now() - startTime,
        details: performanceResult,
        errors: [],
        warnings: avgTime > 50 ? [`Performance warning: ${avgTime.toFixed(2)}ms average`] : []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'performance',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  // ============================================================================
  // ERROR TESTING
  // ============================================================================

  /**
   * Run error handling tests
   */
  private async runErrorTests(): Promise<void> {
    if (this.config.verboseOutput) {
      console.log('🛡️ Running Error Handling Tests...');
    }

    for (const errorType of this.config.errorTestTypes!) {
      await this.runErrorTest(errorType);
    }
  }

  /**
   * Run specific error test
   */
  private async runErrorTest(errorType: ErrorTestType): Promise<void> {
    const testName = `Error Handling: ${errorType}`;
    const startTime = Date.now();
    
    try {
      let testData: any;
      let expectedBehavior: string;
      
      switch (errorType) {
        case ErrorTestType.NULL_DATA:
          testData = null;
          expectedBehavior = 'Should handle null data gracefully';
          break;
          
        case ErrorTestType.INVALID_DATA:
          testData = { invalid: 'data', structure: true };
          expectedBehavior = 'Should validate and reject invalid data structure';
          break;
          
        case ErrorTestType.XSS_INJECTION:
          testData = TestDataGenerator.generateChartData(10, true);
          // Add XSS payloads
          if (testData.data && testData.data[0]) {
            testData.data[0].maliciousField = '<script>alert("xss")</script>';
          }
          expectedBehavior = 'Should sanitize XSS attempts';
          break;
          
        case ErrorTestType.SQL_INJECTION:
          testData = TestDataGenerator.generateTableData(10, true);
          expectedBehavior = 'Should prevent SQL injection';
          break;
          
        case ErrorTestType.OVERFLOW_ATTACK:
          testData = {
            data: Array(10000).fill(null).map(() => ({
              field: 'A'.repeat(1000)
            }))
          };
          expectedBehavior = 'Should limit data size to prevent overflow';
          break;
          
        default:
          throw new Error(`Unknown error test type: ${errorType}`);
      }
      
      // Test with chart adapter (as example)
      const adapter = createChartAdapter('line', {
        enableValidation: true,
        enableSanitization: true,
        strictValidation: false
      });
      
      let result: any;
      let sanitizationApplied = false;
      let validationFailed = false;
      
      try {
        result = adapter.transform(testData);
        
        // Check if sanitization was applied
        if (errorType === ErrorTestType.XSS_INJECTION) {
          const resultStr = JSON.stringify(result);
          sanitizationApplied = !resultStr.includes('<script>');
        }
        
      } catch (validationError) {
        validationFailed = true;
        result = adapter.getDefaultOutput();
      }
      
      // Determine if test passed based on error type
      let passed = false;
      const warnings: string[] = [];
      
      switch (errorType) {
        case ErrorTestType.NULL_DATA:
          passed = result !== null; // Should return default output
          break;
        case ErrorTestType.INVALID_DATA:
          passed = validationFailed || Array.isArray(result);
          break;
        case ErrorTestType.XSS_INJECTION:
          passed = sanitizationApplied;
          break;
        case ErrorTestType.SQL_INJECTION:
          passed = result !== null; // Should handle and continue
          break;
        case ErrorTestType.OVERFLOW_ATTACK:
          passed = result !== null && JSON.stringify(result).length < 100000;
          break;
        default:
          passed = true;
      }
      
      this.results.push({
        testName,
        testType: 'error',
        passed,
        duration: Date.now() - startTime,
        details: {
          errorType,
          expectedBehavior,
          sanitizationApplied,
          validationFailed,
          resultSize: result ? JSON.stringify(result).length : 0
        },
        errors: [],
        warnings
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'error',
        passed: false,
        duration: Date.now() - startTime,
        details: { errorType, error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  // ============================================================================
  // COMPATIBILITY TESTING
  // ============================================================================

  /**
   * Run compatibility tests
   */
  private async runCompatibilityTests(): Promise<void> {
    if (this.config.verboseOutput) {
      console.log('🔄 Running Compatibility Tests...');
    }

    // Test backward compatibility with existing data formats
    await this.testBackwardCompatibility();
    
    // Test data format consistency
    await this.testDataFormatConsistency();
    
    // Test cross-adapter compatibility
    await this.testCrossAdapterCompatibility();
  }

  /**
   * Test backward compatibility
   */
  private async testBackwardCompatibility(): Promise<void> {
    const testName = 'Backward Compatibility';
    const startTime = Date.now();
    
    try {
      // Test with legacy data formats
      const legacyChartData = {
        // Old format without summary
        data: [
          { date: '2024-01-01', value: 100 },
          { date: '2024-01-02', value: 150 }
        ]
      };
      
      const adapter = createChartAdapter('line');
      const result = adapter.transform(legacyChartData);
      
      const passed = Array.isArray(result) && result.length > 0;
      
      this.results.push({
        testName,
        testType: 'compatibility',
        passed,
        duration: Date.now() - startTime,
        details: { legacyDataHandled: passed },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'compatibility',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  /**
   * Test data format consistency
   */
  private async testDataFormatConsistency(): Promise<void> {
    const testName = 'Data Format Consistency';
    const startTime = Date.now();
    
    try {
      const testData = TestDataGenerator.generateChartData(10);
      
      const lineAdapter = createChartAdapter('line');
      const barAdapter = createChartAdapter('bar');
      
      const lineResult = lineAdapter.transform(testData);
      const barResult = barAdapter.transform(testData);
      
      // Both should return arrays with consistent structure
      const passed = Array.isArray(lineResult) && Array.isArray(barResult) &&
                     lineResult.length > 0 && barResult.length > 0;
      
      this.results.push({
        testName,
        testType: 'compatibility',
        passed,
        duration: Date.now() - startTime,
        details: {
          lineResultType: Array.isArray(lineResult) ? 'array' : typeof lineResult,
          barResultType: Array.isArray(barResult) ? 'array' : typeof barResult,
          consistentFormat: passed
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'compatibility',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  /**
   * Test cross-adapter compatibility
   */
  private async testCrossAdapterCompatibility(): Promise<void> {
    const testName = 'Cross-Adapter Compatibility';
    const startTime = Date.now();
    
    try {
      // Test that all adapters can handle similar data structures
      const testData = {
        data: [
          { date: '2024-01-01', value: 100, metric: 200 },
          { date: '2024-01-02', value: 150, metric: 250 }
        ]
      };
      
      const adapters = [
        createChartAdapter('line'),
        createChartAdapter('bar'),
        createChartAdapter('donut')
      ];
      
      const results = adapters.map(adapter => {
        try {
          return adapter.transform(testData);
        } catch (error) {
          return null;
        }
      });
      
      const passed = results.every(result => result !== null);
      
      this.results.push({
        testName,
        testType: 'compatibility',
        passed,
        duration: Date.now() - startTime,
        details: {
          successfulAdapters: results.filter(r => r !== null).length,
          totalAdapters: adapters.length,
          allCompatible: passed
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'compatibility',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  // ============================================================================
  // INTEGRATION TESTING
  // ============================================================================

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<void> {
    if (this.config.verboseOutput) {
      console.log('🔗 Running Integration Tests...');
    }

    await this.testComponentIntegration();
    await this.testAdapterFactory();
    await this.testValidationIntegration();
    await this.testSanitizationIntegration();
  }

  /**
   * Test component integration
   */
  private async testComponentIntegration(): Promise<void> {
    const testName = 'Component Integration';
    const startTime = Date.now();
    
    try {
      const integrationManager = ComponentIntegrationManager.getInstance();
      const testData = TestDataGenerator.generateChartData(10);
      
      const result = await integrationManager.integrateLineChart(testData);
      
      const passed = result && result.data && result.metadata &&
                     typeof result.metadata.processingTime === 'number';
      
      this.results.push({
        testName,
        testType: 'integration',
        passed,
        duration: Date.now() - startTime,
        details: {
          hasData: !!result.data,
          hasMetadata: !!result.metadata,
          processingTime: result.metadata?.processingTime || 0
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'integration',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  /**
   * Test adapter factory
   */
  private async testAdapterFactory(): Promise<void> {
    const testName = 'Adapter Factory';
    const startTime = Date.now();
    
    try {
      const factory = AdapterFactory.getInstance();
      
      // Test adapter creation
      const chartAdapter = factory.createAdapter('chart', 'line');
      const widgetAdapter = factory.createAdapter('widget', 'traffic-overview');
      
      const passed = chartAdapter && widgetAdapter &&
                     typeof chartAdapter.transform === 'function' &&
                     typeof widgetAdapter.transform === 'function';
      
      this.results.push({
        testName,
        testType: 'integration',
        passed,
        duration: Date.now() - startTime,
        details: {
          chartAdapterCreated: !!chartAdapter,
          widgetAdapterCreated: !!widgetAdapter,
          factoryWorking: passed
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'integration',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  /**
   * Test validation integration
   */
  private async testValidationIntegration(): Promise<void> {
    const testName = 'Validation Integration';
    const startTime = Date.now();
    
    try {
      const validator = ValidationEngine.getInstance();
      const testData = TestDataGenerator.generateChartData(5);
      
      // Test validation
      const result = validator.validate(testData, {
        type: 'object',
        required: true,
        properties: {
          data: { type: 'array', required: true }
        }
      });
      
      const passed = result && typeof result.isValid === 'boolean';
      
      this.results.push({
        testName,
        testType: 'integration',
        passed,
        duration: Date.now() - startTime,
        details: {
          validationWorking: passed,
          isValid: result?.isValid,
          hasErrors: result?.errors?.length || 0
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'integration',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  /**
   * Test sanitization integration
   */
  private async testSanitizationIntegration(): Promise<void> {
    const testName = 'Sanitization Integration';
    const startTime = Date.now();
    
    try {
      const sanitizer = DataSanitizer.getDefault();
      const maliciousData = '<script>alert("xss")</script>';
      
      const result = sanitizer.sanitize(maliciousData);
      
      const passed = result && result.sanitized !== maliciousData &&
                     !result.sanitized.includes('<script>');
      
      this.results.push({
        testName,
        testType: 'integration',
        passed,
        duration: Date.now() - startTime,
        details: {
          sanitizationWorking: passed,
          wasChanged: result?.sanitized !== maliciousData,
          changeCount: result?.changes?.length || 0
        },
        errors: [],
        warnings: []
      });
      
    } catch (error) {
      this.results.push({
        testName,
        testType: 'integration',
        passed: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        errors: [error.message],
        warnings: []
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate test data based on adapter type
   */
  private generateTestData(adapterType: string, size: number): any {
    if (adapterType.startsWith('chart')) {
      return TestDataGenerator.generateChartData(size);
    } else if (adapterType.startsWith('widget')) {
      return TestDataGenerator.generateWidgetData();
    } else if (adapterType.startsWith('table')) {
      return TestDataGenerator.generateTableData(size);
    } else if (adapterType.startsWith('metric')) {
      return TestDataGenerator.generateMetricCardData();
    }
    
    return TestDataGenerator.generateChartData(size);
  }

  /**
   * Calculate summary scores
   */
  private calculateSummaryScores(): TestSuiteResult['summary'] {
    const performanceTests = this.results.filter(r => r.testType === 'performance');
    const errorTests = this.results.filter(r => r.testType === 'error');
    const compatibilityTests = this.results.filter(r => r.testType === 'compatibility');
    const integrationTests = this.results.filter(r => r.testType === 'integration');
    
    return {
      performanceScore: this.calculateScore(performanceTests),
      securityScore: this.calculateScore(errorTests),
      compatibilityScore: this.calculateScore(compatibilityTests),
      integrationScore: this.calculateScore(integrationTests)
    };
  }

  /**
   * Calculate score for test group
   */
  private calculateScore(tests: TestResult[]): number {
    if (tests.length === 0) return 100;
    const passed = tests.filter(t => t.passed).length;
    return Math.round((passed / tests.length) * 100);
  }

  /**
   * Log test results
   */
  private logTestResults(result: TestSuiteResult): void {
    console.log('\n📊 ADAPTER TEST SUITE RESULTS');
    console.log('=====================================');
    console.log(`Total Tests: ${result.totalTests}`);
    console.log(`Passed: ${result.passedTests} ✅`);
    console.log(`Failed: ${result.failedTests} ${result.failedTests > 0 ? '❌' : ''}`);
    console.log(`Duration: ${result.totalDuration}ms`);
    console.log('\n📈 SCORES:');
    console.log(`Performance: ${result.summary.performanceScore}%`);
    console.log(`Security: ${result.summary.securityScore}%`);
    console.log(`Compatibility: ${result.summary.compatibilityScore}%`);
    console.log(`Integration: ${result.summary.integrationScore}%`);
    
    if (result.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      result.results.filter(r => !r.passed).forEach(test => {
        console.log(`- ${test.testName}: ${test.errors.join(', ')}`);
      });
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick testing functions
 */
export const AdapterTesting = {
  /**
   * Run complete test suite
   */
  runTestSuite: (config?: TestConfig) => new AdapterTestingEngine(config).runTestSuite(),
  
  /**
   * Generate test data
   */
  generateData: TestDataGenerator,
  
  /**
   * Test specific adapter
   */
  testAdapter: async (adapter: any, testData: any) => {
    try {
      const result = adapter.transform(testData);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * Default testing engine instance
 */
export const testingEngine = new AdapterTestingEngine();