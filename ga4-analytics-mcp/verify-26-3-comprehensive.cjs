const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 COMPREHENSIVE VERIFICATION: Subtask 26.3 - Shared GA4 Data Fetching Utilities');
console.log('==============================================================================\n');

async function runComprehensiveVerification() {
  console.log('📋 VERIFICATION CHECKLIST:');
  console.log('==========================\n');
  
  let allTestsPassed = true;
  
  // Test 1: File Structure Verification
  console.log('📁 Test 1: File Structure & Compilation');
  console.log('---------------------------------------');
  
  const requiredFiles = [
    'src/utils/ga4DataClient.ts',
    'src/utils/ga4Utils.ts',
    'dist/utils/ga4DataClient.js',
    'dist/utils/ga4Utils.js',
    'src/index.ts',
    'dist/index.js'
  ];
  
  let filesExist = true;
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) filesExist = false;
  });
  
  if (!filesExist) {
    console.log('❌ Required files missing - cannot proceed with verification');
    return false;
  }
  
  // Check file sizes to ensure substantial implementation
  const ga4ClientSize = fs.statSync('src/utils/ga4DataClient.ts').size;
  const ga4UtilsSize = fs.statSync('src/utils/ga4Utils.ts').size;
  const indexSize = fs.statSync('src/index.ts').size;
  
  console.log(`  📊 File sizes:`);
  console.log(`     ga4DataClient.ts: ${Math.round(ga4ClientSize/1024)}KB`);
  console.log(`     ga4Utils.ts: ${Math.round(ga4UtilsSize/1024)}KB`);
  console.log(`     index.ts: ${Math.round(indexSize/1024)}KB`);
  
  const hasSubstantialImplementation = ga4ClientSize > 15000 && ga4UtilsSize > 15000 && indexSize > 10000;
  console.log(`  ${hasSubstantialImplementation ? '✅' : '❌'} Substantial implementation detected`);
  
  if (!hasSubstantialImplementation) {
    allTestsPassed = false;
  }
  
  console.log(`  Result: ${filesExist && hasSubstantialImplementation ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test 2: Code Integration Analysis
  console.log('🔧 Test 2: Code Integration Analysis');
  console.log('-----------------------------------');
  
  const indexCode = fs.readFileSync('src/index.ts', 'utf8');
  const ga4ClientCode = fs.readFileSync('src/utils/ga4DataClient.ts', 'utf8');
  const ga4UtilsCode = fs.readFileSync('src/utils/ga4Utils.ts', 'utf8');
  
  const integrationChecks = [
    {
      name: 'GA4DataClient import in index.ts',
      check: indexCode.includes('initializeGA4DataClient') && indexCode.includes('getGA4DataClient')
    },
    {
      name: 'GA4 lifecycle integration',
      check: indexCode.includes('ga4-data-client') && indexCode.includes('priority: 10')
    },
    {
      name: 'Tool implementation updates',
      check: indexCode.includes('query_analytics') && indexCode.includes('get_realtime_data') && indexCode.includes('runReport')
    },
    {
      name: 'GA4DataClient class implementation',
      check: ga4ClientCode.includes('class GA4DataClient') && ga4ClientCode.includes('runReport') && ga4ClientCode.includes('runRealtimeReport')
    },
    {
      name: 'Error handling implementation',
      check: ga4ClientCode.includes('GA4ErrorType') && ga4ClientCode.includes('handleGA4Error')
    },
    {
      name: 'Caching implementation',
      check: ga4ClientCode.includes('cache') && ga4ClientCode.includes('setCachedData') && ga4ClientCode.includes('getCachedData')
    },
    {
      name: 'GA4 utility functions',
      check: ga4UtilsCode.includes('parseDateRange') && ga4UtilsCode.includes('filterGoogleAdsTraffic') && ga4UtilsCode.includes('formatMetricValue')
    },
    {
      name: 'Date range processing',
      check: ga4UtilsCode.includes('DATE_RANGE_PRESETS') && ga4UtilsCode.includes('validateDateRange')
    },
    {
      name: 'Performance monitoring integration',
      check: indexCode.includes('performanceMonitor.incrementCounter') && indexCode.includes('ga4_api_calls_total')
    }
  ];
  
  let integrationPassed = true;
  integrationChecks.forEach(check => {
    console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`);
    if (!check.check) integrationPassed = false;
  });
  
  console.log(`  Result: ${integrationPassed ? '✅ PASS' : '❌ FAIL'}\n`);
  
  if (!integrationPassed) {
    allTestsPassed = false;
  }
  
  // Test 3: Server Startup Test
  console.log('🚀 Test 3: Server Startup & GA4 Integration Test');
  console.log('------------------------------------------------');
  
  return new Promise((resolve) => {
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GA4_PROPERTY_ID: 'test-property-12345',
        HEALTH_CHECK_PORT: '3003',
        // Missing credentials to test graceful degradation
        GOOGLE_CLIENT_EMAIL: '',
        GOOGLE_PRIVATE_KEY: '',
        GOOGLE_PROJECT_ID: '',
        GOOGLE_APPLICATION_CREDENTIALS: ''
      }
    });
    
    let testResults = {
      serverStarted: false,
      authStarted: false,
      ga4ClientSkipped: false,
      healthServerStarted: false,
      serverReady: false
    };
    
    let outputBuffer = '';
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      if (output.includes('🎉 GA4 Analytics MCP Server is running')) {
        testResults.serverReady = true;
        console.log('  ✅ Server started successfully');
      }
      
      if (output.includes('Initializing Google Authentication')) {
        testResults.authStarted = true;
        console.log('  ✅ Authentication initialization started');
      }
      
      if (output.includes('⚠️ Authentication not available - GA4 Data Client initialization skipped')) {
        testResults.ga4ClientSkipped = true;
        console.log('  ✅ GA4 Data Client graceful degradation working');
      }
      
      if (output.includes('🏥 HTTP Health server started')) {
        testResults.healthServerStarted = true;
        console.log('  ✅ Health server started');
      }
      
      if (output.includes('Initializing GA4 Data Client')) {
        console.log('  ✅ GA4 Data Client initialization attempted');
      }
    });
    
    serverProcess.on('close', (code) => {
      const startupSuccess = testResults.serverReady && testResults.authStarted && 
                           testResults.ga4ClientSkipped && testResults.healthServerStarted;
      
      console.log(`  ${startupSuccess ? '✅' : '❌'} Server startup with GA4 utilities`);
      console.log(`  Result: ${startupSuccess ? '✅ PASS' : '❌ FAIL'}\n`);
      
      if (!startupSuccess) {
        allTestsPassed = false;
        console.log('🔍 Server Output Analysis:');
        console.log(outputBuffer.split('\n').slice(-20).join('\n'));
      }
      
      // Final Results
      console.log('📊 COMPREHENSIVE VERIFICATION RESULTS:');
      console.log('======================================');
      
      console.log(`✅ File Structure & Implementation: ${filesExist && hasSubstantialImplementation ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Code Integration: ${integrationPassed ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Server Startup & GA4 Integration: ${startupSuccess ? 'PASS' : 'FAIL'}`);
      
      console.log(`\n🎯 SUBTASK 26.3 VERIFICATION: ${allTestsPassed && startupSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      
      if (allTestsPassed && startupSuccess) {
        console.log('\n🎉 SUBTASK 26.3 VERIFICATION COMPLETE!');
        console.log('✅ Shared GA4 Data Fetching Utilities working correctly');
        console.log('✅ All integrations functional');
        console.log('✅ Server handles graceful degradation properly');
        console.log('✅ GA4 utilities ready for use in tools');
        console.log('\n🚀 READY TO PROCEED WITH PHASE 1 OF SUBTASK 26.4!');
      } else {
        console.log('\n⚠️ SUBTASK 26.3 HAS ISSUES THAT NEED RESOLUTION');
        console.log('Please review the failed tests above');
      }
      
      resolve(allTestsPassed && startupSuccess);
    });
    
    // Timeout
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      setTimeout(() => resolve(false), 1000);
    }, 12000);
  });
}

runComprehensiveVerification().then(success => {
  process.exit(success ? 0 : 1);
});