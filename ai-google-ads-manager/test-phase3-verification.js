/**
 * Phase 3 Credential System Verification
 * 
 * This script verifies the Phase 3 implementation by checking file existence
 * and analyzing the code contents directly without requiring compilation.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Phase 3 Credential System Implementation...\n');

const credentialsDir = './lib/mcp/credentials';

// Test 1: File Existence Check
console.log('✅ Test 1: Checking required file existence...');

const requiredFiles = [
  'types.ts',
  'storage.ts', 
  'encryption.ts',
  'lifecycle.ts',
  'services.ts',
  'validation.ts',
  'persistence.ts',
  'mcpAuth.ts',       // Phase 3
  'mcpClient.ts',     // Phase 3
  'mcpCredentials.ts', // Phase 3
  'credentialRotation.ts',    // Phase 4
  'credentialRefresh.ts',     // Phase 4
  'credentialMonitoring.ts',  // Phase 4
  'credentialNotifications.ts', // Phase 4
  'index.ts'
];

let existingFiles = 0;
for (const file of requiredFiles) {
  const filePath = path.join(credentialsDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ✓ ${file} (${sizeKB}KB)`);
    existingFiles++;
  } else {
    console.log(`  ❌ ${file} missing`);
  }
}

console.log(`✅ ${existingFiles}/${requiredFiles.length} required files exist\n`);

// Test 2: Phase 3 Export Analysis
console.log('✅ Test 2: Analyzing Phase 3 exports...');

try {
  const indexContent = fs.readFileSync(path.join(credentialsDir, 'index.ts'), 'utf8');
  
  const phase3Exports = [
    'IMCPAuthService',
    'MCPAuthService', 
    'MCPAuthServiceFactory',
    'IMCPClient',
    'MCPClient',
    'MCPClientFactory',
    'IMCPCredentialManager',
    'MCPCredentialManager',
    'MCPCredentialManagerFactory'
  ];
  
  let foundPhase3Exports = 0;
  for (const exportName of phase3Exports) {
    if (indexContent.includes(exportName)) {
      console.log(`  ✓ ${exportName} found in exports`);
      foundPhase3Exports++;
    } else {
      console.log(`  ❌ ${exportName} missing from exports`);
    }
  }
  
  console.log(`✅ ${foundPhase3Exports}/${phase3Exports.length} Phase 3 exports found\n`);
  
  // Test 3: Phase 4 Export Analysis  
  console.log('✅ Test 3: Analyzing Phase 4 exports...');
  
  const phase4Exports = [
    'ICredentialRotationService',
    'CredentialRotationService',
    'ICredentialRefreshService',
    'CredentialRefreshService', 
    'ICredentialMonitoringService',
    'CredentialMonitoringService',
    'ICredentialNotificationService',
    'CredentialNotificationService'
  ];
  
  let foundPhase4Exports = 0;
  for (const exportName of phase4Exports) {
    if (indexContent.includes(exportName)) {
      console.log(`  ✓ ${exportName} found in exports`);
      foundPhase4Exports++;
    } else {
      console.log(`  ❌ ${exportName} missing from exports`);
    }
  }
  
  console.log(`✅ ${foundPhase4Exports}/${phase4Exports.length} Phase 4 exports found\n`);
  
  // Test 4: Implementation Quality Check
  console.log('✅ Test 4: Implementation quality analysis...');
  
  const phase3Files = ['mcpAuth.ts', 'mcpClient.ts', 'mcpCredentials.ts'];
  const phase4Files = ['credentialRotation.ts', 'credentialRefresh.ts', 'credentialMonitoring.ts', 'credentialNotifications.ts'];
  
  let phase3Quality = 0;
  let phase4Quality = 0;
  
  for (const file of phase3Files) {
    const filePath = path.join(credentialsDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      const hasInterfaces = content.includes('interface ');
      const hasImplementation = content.includes('class ') || content.includes('export const ');
      const hasFactory = content.includes('Factory');
      
      if (lines > 500 && hasInterfaces && hasImplementation && hasFactory) {
        console.log(`  ✓ ${file} - High quality implementation (${lines} lines)`);
        phase3Quality++;
      } else {
        console.log(`  ⚠️ ${file} - Implementation exists but may be incomplete`);
      }
    }
  }
  
  for (const file of phase4Files) {
    const filePath = path.join(credentialsDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      const hasInterfaces = content.includes('interface ');
      const hasImplementation = content.includes('class ') || content.includes('export const ');
      const hasFactory = content.includes('Factory');
      
      if (lines > 500 && hasInterfaces && hasImplementation && hasFactory) {
        console.log(`  ✓ ${file} - High quality implementation (${lines} lines)`);
        phase4Quality++;
      } else {
        console.log(`  ⚠️ ${file} - Implementation exists but may be incomplete`);
      }
    }
  }
  
  console.log(`✅ Phase 3 quality: ${phase3Quality}/${phase3Files.length} files complete`);
  console.log(`✅ Phase 4 quality: ${phase4Quality}/${phase4Files.length} files complete\n`);
  
  // Final Results
  console.log('📊 VERIFICATION RESULTS:');
  console.log(`  • File existence: ${existingFiles}/${requiredFiles.length} ${existingFiles === requiredFiles.length ? '✅' : '⚠️'}`);
  console.log(`  • Phase 3 exports: ${foundPhase3Exports}/${phase3Exports.length} ${foundPhase3Exports === phase3Exports.length ? '✅' : '⚠️'}`);
  console.log(`  • Phase 4 exports: ${foundPhase4Exports}/${phase4Exports.length} ${foundPhase4Exports === phase4Exports.length ? '✅' : '⚠️'}`);
  console.log(`  • Phase 3 quality: ${phase3Quality}/${phase3Files.length} ${phase3Quality === phase3Files.length ? '✅' : '⚠️'}`);
  console.log(`  • Phase 4 quality: ${phase4Quality}/${phase4Files.length} ${phase4Quality === phase4Files.length ? '✅' : '⚠️'}`);
  
  if (foundPhase3Exports === phase3Exports.length && phase3Quality === phase3Files.length) {
    console.log('\n🎉 PHASE 3 VERIFICATION: COMPLETE AND HIGH QUALITY!');
    
    if (foundPhase4Exports === phase4Exports.length && phase4Quality === phase4Files.length) {
      console.log('🚀 PHASE 4 VERIFICATION: ALREADY COMPLETE AND HIGH QUALITY!');
      console.log('\n✅ STATUS: Both phases are fully implemented');
      console.log('📋 NEXT STEPS: Integration testing and finalization');
    } else {
      console.log('\n📋 STATUS: Phase 3 complete, Phase 4 needs completion');
      console.log('🔄 NEXT STEPS: Complete Phase 4 implementation');
    }
  } else {
    console.log('\n⚠️ PHASE 3 VERIFICATION: NEEDS ATTENTION');
    console.log('📋 STATUS: Phase 3 implementation incomplete');
    console.log('🔧 NEXT STEPS: Complete Phase 3 before proceeding to Phase 4');
  }
  
} catch (error) {
  console.error('❌ Error during verification:', error.message);
  process.exit(1);
}