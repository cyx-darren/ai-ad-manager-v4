/**
 * Test script to verify all dependencies are working correctly
 * for Phase 5.2.2 validation
 */

console.log('🧪 Testing Phase 5.2.2 Dependencies...\n');

const dependencies = [
  // Core Express dependencies
  { name: 'express', test: () => require('express') },
  { name: 'cors', test: () => require('cors') },
  { name: 'helmet', test: () => require('helmet') },
  { name: 'express-rate-limit', test: () => require('express-rate-limit') },
  
  // GA4 and Google dependencies
  { name: '@google-analytics/data', test: () => require('@google-analytics/data') },
  
  // Utilities
  { name: 'dotenv', test: () => require('dotenv') },
  { name: 'winston', test: () => require('winston') },
  { name: 'redis', test: () => require('redis') },
];

let passed = 0;
let failed = 0;

console.log('Testing dependency imports:');
console.log('========================\n');

dependencies.forEach(dep => {
  try {
    dep.test();
    console.log(`✅ ${dep.name} - OK`);
    passed++;
  } catch (error) {
    console.log(`❌ ${dep.name} - FAILED: ${error.message}`);
    failed++;
  }
});

console.log('\n========================');
console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All dependencies are working correctly!');
  console.log('✅ Phase 5.2.2 validation: PASSED');
} else {
  console.log('⚠️  Some dependencies have issues');
  console.log('❌ Phase 5.2.2 validation: FAILED');
  process.exit(1);
}

// Test GA4 client initialization
console.log('\n🔍 Testing GA4 Client Initialization...');
try {
  const { BetaAnalyticsDataClient } = require('@google-analytics/data');
  const client = new BetaAnalyticsDataClient({
    // This should work with GOOGLE_APPLICATION_CREDENTIALS
  });
  console.log('✅ GA4 BetaAnalyticsDataClient initialized successfully');
} catch (error) {
  console.log(`❌ GA4 Client initialization failed: ${error.message}`);
  process.exit(1);
}

console.log('\n🎯 Phase 5.2.2 Dependencies Test: COMPLETE');
console.log('Ready to proceed with Phase 5.2.3!');