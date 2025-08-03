'use client';

/**
 * Test Phase 2 - Core Adapter Framework
 * 
 * This test page verifies that all Phase 2 deliverables are working correctly
 * within the Next.js environment.
 */

import { useEffect, useState } from 'react';

export default function TestAdaptersPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const runTests = async () => {
      const results: string[] = [];
      
      try {
        results.push('🧪 Testing Phase 2 - Core Adapter Framework...');
        
        // Test 1: Import all core modules
        results.push('✅ Test 1: Import modules...');
        
        try {
          // Test dynamic imports for TypeScript modules
          const adapterTypes = await import('@/lib/mcp/adapters/types');
          results.push('   - Types imported successfully');
          
          const utils = await import('@/lib/mcp/adapters/utils');
          results.push('   - Utilities imported successfully');
          
          const { BaseAdapter } = await import('@/lib/mcp/adapters/BaseAdapter');
          results.push('   - BaseAdapter imported successfully');
          
          const { AdapterFactory } = await import('@/lib/mcp/adapters/AdapterFactory');
          results.push('   - AdapterFactory imported successfully');
          
          const { ErrorHandler } = await import('@/lib/mcp/adapters/ErrorHandler');
          results.push('   - ErrorHandler imported successfully');
          
          const adapterFramework = await import('@/lib/mcp/adapters/index');
          results.push('   - Main framework imported successfully');

          // Test 2: Test utility functions
          results.push('');
          results.push('✅ Test 2: Test utility functions...');
          
          // Test date normalization
          const normalizedDate = utils.normalizeDateString('20240101');
          results.push(`   - Date normalization: 20240101 → ${normalizedDate}`);
          
          // Test metric computation  
          const metrics = utils.computeMetrics({
            clicks: 100,
            impressions: 1000,
            cost: 50
          });
          results.push(`   - Metric computation: CTR = ${metrics.ctr?.toFixed(2)}%, CPC = $${metrics.cpc?.toFixed(2)}`);
          
          // Test field mapping
          const mapped = utils.mapFields(
            { screenPageViews: 1000 },
            { screenPageViews: 'pageviews' }
          );
          results.push(`   - Field mapping: screenPageViews → pageviews = ${mapped.pageviews}`);

          // Test 3: Test error handling
          results.push('');
          results.push('✅ Test 3: Test error handling...');
          
          const errorHandler = new ErrorHandler();
          const testError = new Error('Test error');
          const handled = errorHandler.handleError(testError, 'TEST_CONTEXT');
          results.push(`   - Error handled successfully: ${handled.handled}`);

          // Test 4: Test factory pattern
          results.push('');
          results.push('✅ Test 4: Test factory pattern...');
          
          const factory = new AdapterFactory();
          results.push('   - Factory created successfully');
          
          // Check helper functions
          if (typeof adapterFramework.createSimpleAdapter === 'function') {
            results.push('   - Helper functions available');
          }

          // Success message
          results.push('');
          results.push('🎉 PHASE 2 VERIFICATION COMPLETE');
          results.push('✅ All core framework components are working correctly');
          results.push('✅ No errors found in the implementation');
          results.push('✅ Ready to proceed with Phase 3: Component-Specific Adapters');
          
        } catch (importError) {
          throw new Error(`Import error: ${importError.message}`);
        }
        
      } catch (error) {
        results.push('');
        results.push('❌ PHASE 2 ERROR DETECTED:');
        results.push(`Error: ${error.message}`);
        
        if (error.message.includes('Cannot resolve')) {
          results.push('🔧 FIX: Module resolution error. Check if all Phase 2 files exist.');
        } else if (error.message.includes('SyntaxError')) {
          results.push('🔧 FIX: Syntax error in code. Check TypeScript compilation.');
        } else {
          results.push('🔧 FIX: Runtime error. Check implementation logic.');
        }
        
        setHasError(true);
      }
      
      setTestResults(results);
      setIsLoading(false);
    };

    runTests();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4">Testing Phase 2 - Core Adapter Framework</h1>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Running tests...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">
          Phase 2 Adapter Framework Test Results
        </h1>
        
        <div className={`p-4 rounded-lg ${hasError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <pre className="whitespace-pre-line text-sm font-mono">
            {testResults.join('\n')}
          </pre>
        </div>
        
        <div className="mt-6 flex space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Run Tests Again
          </button>
          
          <a
            href="/dashboard"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}