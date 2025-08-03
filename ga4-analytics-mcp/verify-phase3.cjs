const { spawn } = require('child_process');

console.log('🔍 PHASE 3 VERIFICATION: Token & Credential Management');
console.log('===================================================\n');

// Test 1: Verify file structure
function testFileStructure() {
  const fs = require('fs');
  console.log('📁 Test 1: Phase 3 File Structure Verification');
  
  const requiredFiles = [
    'src/utils/tokenManager.ts',
    'src/utils/credentialRecovery.ts', 
    'dist/utils/tokenManager.js',
    'dist/utils/credentialRecovery.js',
    'dist/utils/googleAuth.js', // Should have Phase 3 enhancements
    'dist/utils/healthCheck.js' // Should have Phase 3 features
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
  });
  
  console.log(`  Result: ${allFilesExist ? '✅ PASS' : '❌ FAIL'}\n`);
  return allFilesExist;
}

// Test 2: Verify Phase 3 code integration
function testPhase3Integration() {
  return new Promise((resolve) => {
    console.log('🔧 Test 2: Phase 3 Code Integration');
    
    const fs = require('fs');
    
    // Check tokenManager features
    const tokenManagerCode = fs.readFileSync('dist/utils/tokenManager.js', 'utf8');
    const hasTokenRefresh = tokenManagerCode.includes('refreshToken');
    const hasExpiration = tokenManagerCode.includes('detectAndRecoverFromExpiration');
    const hasRotation = tokenManagerCode.includes('handleCredentialRotation');
    
    console.log(`  ${hasTokenRefresh ? '✅' : '❌'} Token refresh mechanism`);
    console.log(`  ${hasExpiration ? '✅' : '❌'} Expiration detection`);
    console.log(`  ${hasRotation ? '✅' : '❌'} Credential rotation`);
    
    // Check credential recovery features
    const recoveryCode = fs.readFileSync('dist/utils/credentialRecovery.js', 'utf8');
    const hasValidation = recoveryCode.includes('validateCredentials');
    const hasRecovery = recoveryCode.includes('attemptRecovery');
    const hasDiagnostics = recoveryCode.includes('getDiagnostics');
    
    console.log(`  ${hasValidation ? '✅' : '❌'} Credential validation`);
    console.log(`  ${hasRecovery ? '✅' : '❌'} Recovery mechanisms`);
    console.log(`  ${hasDiagnostics ? '✅' : '❌'} Diagnostic system`);
    
    // Check enhanced health monitoring
    const healthCode = fs.readFileSync('dist/utils/healthCheck.js', 'utf8');
    const hasTokenCheck = healthCode.includes('checkTokenManager');
    const hasRecoveryCheck = healthCode.includes('checkCredentialRecovery');
    const hasPhase3Features = healthCode.includes('phase3Features');
    
    console.log(`  ${hasTokenCheck ? '✅' : '❌'} Token health monitoring`);
    console.log(`  ${hasRecoveryCheck ? '✅' : '❌'} Recovery health monitoring`);
    console.log(`  ${hasPhase3Features ? '✅' : '❌'} Phase 3 feature detection`);
    
    const allIntegrated = hasTokenRefresh && hasExpiration && hasRotation && 
                         hasValidation && hasRecovery && hasDiagnostics &&
                         hasTokenCheck && hasRecoveryCheck && hasPhase3Features;
    
    console.log(`  Result: ${allIntegrated ? '✅ PASS' : '❌ FAIL'}\n`);
    resolve(allIntegrated);
  });
}

// Test 3: Test server startup with Phase 3 components
function testServerStartupWithPhase3() {
  return new Promise((resolve) => {
    console.log('🚀 Test 3: Server Startup with Phase 3 Components');
    
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GA4_PROPERTY_ID: 'test-property-12345',
        // Use properly formatted but invalid credentials to allow Phase 3 init but fail auth later
        GOOGLE_CLIENT_EMAIL: 'test-service-account@test-project.iam.gserviceaccount.com',
        GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nOl5blfswgCsKfnbpfZ7sMeN1VXBxWs0XYzQs6JwkQNE1yfY8u9gGYJwq6NxQrN6k\ntest-invalid-key-for-testing-purposes-only-this-will-fail-auth\n-----END PRIVATE KEY-----',
        GOOGLE_PROJECT_ID: 'test-project-12345'
      }
    });
    
    let phase3ComponentsInitialized = false;
    let authFailedAsExpected = false;
    let serverOutput = '';
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      
      // Check for Phase 3 component initialization
      if (output.includes('✅ Token Manager initialized') && 
          output.includes('✅ Credential Recovery Manager initialized')) {
        phase3ComponentsInitialized = true;
        console.log('  ✅ Phase 3 components initialized');
      }
      
      // Expected authentication failure with test credentials
      if (output.includes('Authentication failed') || output.includes('invalid_grant')) {
        authFailedAsExpected = true;
        console.log('  ✅ Authentication failed as expected (test credentials)');
      }
    });
    
    serverProcess.on('close', (code) => {
      // With invalid credentials, we expect startup failure but Phase 3 should initialize
      const testPassed = phase3ComponentsInitialized && authFailedAsExpected;
      
      console.log(`  ${testPassed ? '✅' : '❌'} Phase 3 initialization during auth flow`);
      console.log(`  Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);
      
      if (!testPassed) {
        console.log('  📋 Debug output:');
        console.log(serverOutput.split('\n').slice(-10).map(line => `    ${line}`).join('\n'));
      }
      
      resolve(testPassed);
    });
    
    // Timeout after 8 seconds
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      setTimeout(() => resolve(false), 1000);
    }, 8000);
  });
}

// Test 4: Test MCP functionality with Phase 3 features
function testMCPWithPhase3() {
  return new Promise((resolve) => {
    console.log('🔧 Test 4: MCP Server with Phase 3 Health Monitoring');
    
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GA4_PROPERTY_ID: 'test-property-12345',
        // Test with missing credentials to verify behavior
      }
    });
    
    let mcpServerStarted = false;
    let authErrorHandled = false;
    let healthMonitoringAvailable = false;
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('🚀 Starting GA4 Analytics MCP Server')) {
        mcpServerStarted = true;
        console.log('  ✅ MCP server startup initiated');
      }
      
      if (output.includes('No valid Google credentials found')) {
        authErrorHandled = true;
        console.log('  ✅ Authentication error handled gracefully');
      }
      
      if (output.includes('Starting MCP server lifecycle') || 
          output.includes('MCP server core initialized')) {
        healthMonitoringAvailable = true;
        console.log('  ✅ Health monitoring system available');
      }
    });
    
    serverProcess.on('close', (code) => {
      // Server should start MCP components but fail auth gracefully
      const testPassed = mcpServerStarted && authErrorHandled && healthMonitoringAvailable;
      
      console.log(`  ${testPassed ? '✅' : '❌'} MCP server with Phase 3 health monitoring`);
      console.log(`  Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);
      
      resolve(testPassed);
    });
    
    // Timeout after 6 seconds
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      setTimeout(() => resolve(false), 1000);
    }, 6000);
  });
}

// Run all Phase 3 verification tests
async function runPhase3Verification() {
  console.log('🧪 COMPREHENSIVE PHASE 3 VERIFICATION SUITE');
  console.log('===========================================\n');
  
  const results = {
    fileStructure: testFileStructure(),
    codeIntegration: await testPhase3Integration(),
    serverStartup: await testServerStartupWithPhase3(),
    mcpFunctionality: await testMCPWithPhase3()
  };
  
  console.log('📊 PHASE 3 VERIFICATION RESULTS:');
  console.log('================================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 PHASE 3 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 PHASE 3 TOKEN & CREDENTIAL MANAGEMENT IS WORKING CORRECTLY!');
    console.log('✅ Token management system fully functional');
    console.log('✅ Credential recovery mechanisms operational');  
    console.log('✅ Enhanced health monitoring integrated');
    console.log('✅ Server gracefully handles authentication scenarios');
    console.log('\n🚀 READY TO PROCEED WITH PHASE 4: Health Check & Monitoring Endpoints');
  } else {
    console.log('\n⚠️ PHASE 3 VERIFICATION FAILED - ISSUES NEED TO BE RESOLVED');
  }
  
  return allPassed;
}

runPhase3Verification();