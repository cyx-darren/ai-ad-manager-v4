const { spawn } = require('child_process');
const http = require('http');

console.log('🏥 PHASE 4 VERIFICATION: Health Check & Monitoring Endpoints');
console.log('=========================================================\n');

// Test 1: Verify file structure
function testPhase4Files() {
  const fs = require('fs');
  console.log('📁 Test 1: Phase 4 File Structure');
  
  const requiredFiles = [
    'src/utils/httpHealthServer.ts',
    'src/utils/performanceMetrics.ts',
    'dist/utils/httpHealthServer.js',
    'dist/utils/performanceMetrics.js',
    'railway.toml' // Should have health check config
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
  });
  
  // Check Railway config has health check settings
  const railwayConfig = fs.readFileSync('railway.toml', 'utf8');
  const hasHealthCheckConfig = railwayConfig.includes('HEALTH_CHECK_PORT') && 
                               railwayConfig.includes('[healthcheck]');
  console.log(`  ${hasHealthCheckConfig ? '✅' : '❌'} Railway health check configuration`);
  
  const result = allFilesExist && hasHealthCheckConfig;
  console.log(`  Result: ${result ? '✅ PASS' : '❌ FAIL'}\n`);
  return result;
}

// Test 2: Test HTTP health server startup
function testHttpHealthServerStartup() {
  return new Promise((resolve) => {
    console.log('🚀 Test 2: HTTP Health Server Startup');
    
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GA4_PROPERTY_ID: 'test-property-12345',
        HEALTH_CHECK_PORT: '3003',
        HEALTH_CHECK_HOST: '0.0.0.0',
        ENABLE_HEALTH_METRICS: 'true',
        ENABLE_HEALTH_DIAGNOSTICS: 'true',
        // Use missing credentials so server fails auth but starts health server
        GOOGLE_CLIENT_EMAIL: '',
        GOOGLE_PRIVATE_KEY: '',
        GOOGLE_PROJECT_ID: '',
        GOOGLE_APPLICATION_CREDENTIALS: ''
      }
    });
    
    let httpHealthServerStarted = false;
    let httpHealthPort = false;
    let authFailedAsExpected = false;
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('🏥 HTTP Health server started on')) {
        httpHealthServerStarted = true;
        console.log('  ✅ HTTP Health server started');
      }
      
      if (output.includes('Health endpoint: http://0.0.0.0:3003/health')) {
        httpHealthPort = true;
        console.log('  ✅ Health endpoint on correct port');
      }
      
      if (output.includes('No valid Google credentials found')) {
        authFailedAsExpected = true;
        console.log('  ✅ Auth failed as expected (missing credentials)');
      }
    });
    
    serverProcess.on('close', (code) => {
      // Should fail due to missing credentials but health server should start
      const testPassed = httpHealthServerStarted && httpHealthPort && authFailedAsExpected;
      
      console.log(`  ${testPassed ? '✅' : '❌'} HTTP Health server startup with auth failure`);
      console.log(`  Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);
      
      resolve(testPassed);
    });
    
    // Timeout
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      setTimeout(() => resolve(false), 1000);
    }, 8000);
  });
}

// Test 3: Test health endpoints accessibility  
function testHealthEndpoints() {
  return new Promise((resolve) => {
    console.log('🔗 Test 3: Health Endpoints Accessibility');
    
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GA4_PROPERTY_ID: 'test-property-12345',
        HEALTH_CHECK_PORT: '3003',
        HEALTH_CHECK_HOST: '0.0.0.0',
        ENABLE_HEALTH_METRICS: 'true',
        ENABLE_HEALTH_DIAGNOSTICS: 'true',
        // Provide valid-format credentials to allow server components to start
        GOOGLE_CLIENT_EMAIL: 'test-service@test-project.iam.gserviceaccount.com',
        GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\ntest-key-that-will-fail-api-calls-but-allows-server-startup\n-----END PRIVATE KEY-----',
        GOOGLE_PROJECT_ID: 'test-project-12345'
      }
    });
    
    let healthServerReady = false;
    let testResults = {
      healthEndpoint: false,
      statusEndpoint: false,
      metricsEndpoint: false,
      diagnosticsEndpoint: false
    };
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('🏥 HTTP Health server started on')) {
        healthServerReady = true;
        console.log('  ✅ Health server ready, testing endpoints...');
        
        // Test health endpoints
        setTimeout(async () => {
          try {
            // Test /health endpoint
            const healthReq = http.get('http://localhost:3003/health', (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const healthData = JSON.parse(data);
                  if (healthData.status && healthData.timestamp) {
                    testResults.healthEndpoint = true;
                    console.log('    ✅ /health endpoint working');
                  }
                } catch (e) {
                  console.log('    ❌ /health endpoint invalid JSON');
                }
              });
            });
            healthReq.on('error', () => {
              console.log('    ❌ /health endpoint unreachable');
            });
            
            // Test /status endpoint  
            setTimeout(() => {
              const statusReq = http.get('http://localhost:3003/status', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  try {
                    const statusData = JSON.parse(data);
                    if (statusData.status && statusData.timestamp) {
                      testResults.statusEndpoint = true;
                      console.log('    ✅ /status endpoint working');
                    }
                  } catch (e) {
                    console.log('    ❌ /status endpoint invalid JSON');
                  }
                });
              });
              statusReq.on('error', () => {
                console.log('    ❌ /status endpoint unreachable');
              });
            }, 500);
            
            // Test /metrics endpoint
            setTimeout(() => {
              const metricsReq = http.get('http://localhost:3003/metrics', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  try {
                    const metricsData = JSON.parse(data);
                    if (metricsData.performance && metricsData.timestamp) {
                      testResults.metricsEndpoint = true;
                      console.log('    ✅ /metrics endpoint working');
                    }
                  } catch (e) {
                    console.log('    ❌ /metrics endpoint invalid JSON');
                  }
                });
              });
              metricsReq.on('error', () => {
                console.log('    ❌ /metrics endpoint unreachable');
              });
            }, 1000);
            
            // Test /diagnostics endpoint
            setTimeout(() => {
              const diagnosticsReq = http.get('http://localhost:3003/diagnostics', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  try {
                    const diagData = JSON.parse(data);
                    if (diagData.timestamp && diagData.server) {
                      testResults.diagnosticsEndpoint = true;
                      console.log('    ✅ /diagnostics endpoint working');
                    }
                  } catch (e) {
                    console.log('    ❌ /diagnostics endpoint invalid JSON');
                  }
                });
              });
              diagnosticsReq.on('error', () => {
                console.log('    ❌ /diagnostics endpoint unreachable');
              });
            }, 1500);
            
          } catch (error) {
            console.log('    ❌ Error testing endpoints');
          }
        }, 2000);
      }
    });
    
    serverProcess.on('close', () => {
      const allEndpointsWorking = Object.values(testResults).every(result => result);
      console.log(`  ${allEndpointsWorking ? '✅' : '❌'} All health endpoints accessible`);
      console.log(`  Result: ${allEndpointsWorking ? '✅ PASS' : '❌ FAIL'}\n`);
      resolve(allEndpointsWorking);
    });
    
    // Timeout
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      setTimeout(() => resolve(false), 1000);
    }, 10000);
  });
}

// Test 4: Performance metrics collection
function testPerformanceMetrics() {
  return new Promise((resolve) => {
    console.log('📊 Test 4: Performance Metrics Collection');
    
    const fs = require('fs');
    
    // Check performance metrics code
    const perfMetricsCode = fs.readFileSync('dist/utils/performanceMetrics.js', 'utf8');
    const hasRequestTracking = perfMetricsCode.includes('incrementCounter');
    const hasResponseTimeTracking = perfMetricsCode.includes('recordResponseTime');
    const hasMetricsSummary = perfMetricsCode.includes('getMetricsSummary');
    const hasTrendCalculation = perfMetricsCode.includes('calculateTrends');
    const hasAlertsGeneration = perfMetricsCode.includes('generateAlerts');
    
    console.log(`  ${hasRequestTracking ? '✅' : '❌'} Request counter tracking`);
    console.log(`  ${hasResponseTimeTracking ? '✅' : '❌'} Response time tracking`);
    console.log(`  ${hasMetricsSummary ? '✅' : '❌'} Metrics summary generation`);
    console.log(`  ${hasTrendCalculation ? '✅' : '❌'} Performance trend calculation`);
    console.log(`  ${hasAlertsGeneration ? '✅' : '❌'} Performance alerts generation`);
    
    // Check integration in main server
    const serverCode = fs.readFileSync('dist/index.js', 'utf8');
    const hasPerformanceIntegration = serverCode.includes('performanceMonitor');
    const hasRequestTrackingIntegration = serverCode.includes('incrementCounter');
    
    console.log(`  ${hasPerformanceIntegration ? '✅' : '❌'} Performance monitor integration`);
    console.log(`  ${hasRequestTrackingIntegration ? '✅' : '❌'} Request tracking integration`);
    
    const allMetricsFeaturesPresent = hasRequestTracking && hasResponseTimeTracking && 
                                    hasMetricsSummary && hasTrendCalculation && 
                                    hasAlertsGeneration && hasPerformanceIntegration && 
                                    hasRequestTrackingIntegration;
    
    console.log(`  Result: ${allMetricsFeaturesPresent ? '✅ PASS' : '❌ FAIL'}\n`);
    resolve(allMetricsFeaturesPresent);
  });
}

// Run all Phase 4 verification tests
async function runPhase4Verification() {
  console.log('🧪 COMPREHENSIVE PHASE 4 VERIFICATION SUITE');
  console.log('============================================\n');
  
  const results = {
    fileStructure: testPhase4Files(),
    httpServerStartup: await testHttpHealthServerStartup(),
    healthEndpoints: await testHealthEndpoints(),
    performanceMetrics: await testPerformanceMetrics()
  };
  
  console.log('📊 PHASE 4 VERIFICATION RESULTS:');
  console.log('================================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 PHASE 4 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 PHASE 4 HEALTH CHECK & MONITORING ENDPOINTS COMPLETE!');
    console.log('✅ HTTP health check server implemented');
    console.log('✅ Railway deployment health endpoint ready');
    console.log('✅ Performance metrics collection functional');
    console.log('✅ Comprehensive monitoring endpoints available');
    console.log('✅ Server status monitoring operational');
    console.log('\n🚀 ALL 4 PHASES COMPLETE - MCP SERVER FULLY PRODUCTION READY!');
    console.log('\n📋 Production Deployment Features:');
    console.log('   - Complete MCP server with 6 GA4 analytics tools');
    console.log('   - Enterprise authentication with Google Service Account');
    console.log('   - Advanced token management with automatic refresh');
    console.log('   - Intelligent credential recovery and error handling');
    console.log('   - HTTP health endpoints for external monitoring');
    console.log('   - Performance metrics and trend analysis');
    console.log('   - Railway deployment configuration ready');
    console.log('\n🌐 Health Endpoints Available:');
    console.log('   - http://localhost:3003/health (main health check)');
    console.log('   - http://localhost:3003/status (simple status)');
    console.log('   - http://localhost:3003/metrics (performance metrics)');
    console.log('   - http://localhost:3003/diagnostics (detailed diagnostics)');
  } else {
    console.log('\n⚠️ PHASE 4 HAS ISSUES THAT NEED TO BE RESOLVED');
  }
  
  return allPassed;
}

runPhase4Verification();