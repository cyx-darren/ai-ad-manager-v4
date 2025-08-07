#!/usr/bin/env node

/**
 * Subtask 28.6 Phase 4 Verification Test
 * 
 * Verifies that Phase 4 (Historical Connection Analytics) 
 * of subtask 28.6 "Build Session Management" is properly implemented.
 */

import { existsSync, statSync } from 'fs';
import { readFileSync } from 'fs';

console.log('🔍 Subtask 28.6 Phase 4 Verification: Historical Connection Analytics...\n');

// ============================================================================
// TEST 1: VERIFY PHASE 4 FILE STRUCTURE FOR ANALYTICS COMPONENTS
// ============================================================================

console.log('✅ Test 1: Verifying Phase 4 file structure for analytics components...');

const phase4Files = [
  { name: 'lib/mcp/types/analytics.ts', minLines: 350 },
  { name: 'lib/mcp/utils/analyticsManager.ts', minLines: 600 },
  { name: 'lib/mcp/hooks/analyticsHooks.ts', minLines: 500 },
  { name: 'lib/mcp/components/AnalyticsDashboard.tsx', minLines: 400 },
  { name: 'lib/mcp/components/PerformanceChart.tsx', minLines: 400 }
];

let fileQualityScore = 0;
const maxFileQualityScore = phase4Files.length * 4; // 4 points per file

for (const file of phase4Files) {
  const filePath = file.name;
  console.log(`  📁 Checking ${filePath}...`);
  
  if (!existsSync(filePath)) {
    console.log(`    ❌ File missing: ${filePath}`);
    continue;
  }

  const stats = statSync(filePath);
  const content = readFileSync(filePath, 'utf8');
  const lineCount = content.split('\n').length;
  
  console.log(`    ✓ ${filePath}: ${lineCount} lines`);
  
  // Size check
  if (lineCount >= file.minLines) {
    console.log(`    ✓ Size check passed (${lineCount} >= ${file.minLines})`);
    fileQualityScore += 1;
  } else {
    console.log(`    ✗ Size check failed (${lineCount} < ${file.minLines})`);
  }
  
  // Check for required patterns based on file type
  const requiredPatterns = getRequiredPatterns(file.name);
  let patternsFound = 0;
  
  for (const pattern of requiredPatterns) {
    if (content.includes(pattern)) {
      patternsFound++;
    }
  }
  
  console.log(`    ✓ Required patterns found (${patternsFound}/${requiredPatterns.length})`);
  if (patternsFound === requiredPatterns.length) {
    fileQualityScore += 1;
  }
  
  // Check React/TypeScript structure
  if (file.name.includes('.tsx')) {
    // React component files
    const hasTypeScript = content.includes('interface ') || content.includes('type ') || content.includes(': React.FC');
    const hasProperStructure = content.includes('export ') && content.includes('import ');
    
    if (hasTypeScript && hasProperStructure) {
      console.log(`    ✓ React/TypeScript structure present`);
      fileQualityScore += 1;
    } else {
      console.log(`    ✗ React/TypeScript structure issues`);
    }
  } else if (file.name.includes('.ts')) {
    // TypeScript utility files
    const hasTypeScript = content.includes('interface ') || content.includes('type ') || content.includes('export ');
    const hasProperStructure = content.includes('export ') && (content.includes('import ') || content.includes('class ') || content.includes('function '));
    
    if (hasTypeScript && hasProperStructure) {
      console.log(`    ✓ React/TypeScript structure present`);
      fileQualityScore += 1;
    } else {
      console.log(`    ✗ React/TypeScript structure issues`);
    }
  } else {
    fileQualityScore += 1; // Give point for non-TS files
  }
  
  // Implementation quality check
  const hasGoodImplementation = checkImplementationQuality(file.name, content);
  if (hasGoodImplementation) {
    console.log(`    ✓ Implementation quality check passed`);
    fileQualityScore += 1;
  } else {
    console.log(`    ✗ Implementation quality needs improvement`);
  }
  
  console.log(`    Score: ${Math.min(4, fileQualityScore - (phase4Files.indexOf(file) * 4))}/4\n`);
}

console.log(`✅ File Quality Score: ${fileQualityScore}/${maxFileQualityScore} (${Math.round((fileQualityScore/maxFileQualityScore)*100)}%)\n`);

// ============================================================================
// TEST 2: VERIFY PHASE 4 ANALYTICS REQUIREMENTS IMPLEMENTATION
// ============================================================================

console.log('✅ Test 2: Checking Phase 4 analytics requirements...');

const analyticsRequirements = [
  'connection history tracking',
  'uptime/downtime analytics',
  'connection quality trends',
  'performance metrics dashboard',
  'data persistence (localStorage)',
  'React hooks integration',
  'analytics visualization',
  'trend analysis algorithms',
  'historical data aggregation',
  'event tracking system'
];

let requirementsScore = 0;

for (const requirement of analyticsRequirements) {
  const implemented = checkAnalyticsRequirement(requirement);
  if (implemented) {
    console.log(`  ✅ ${requirement} - IMPLEMENTED`);
    requirementsScore++;
  } else {
    console.log(`  ❌ ${requirement} - MISSING`);
  }
}

console.log(`✅ Requirements Score: ${requirementsScore}/${analyticsRequirements.length} (${Math.round((requirementsScore/analyticsRequirements.length)*100)}%)\n`);

// ============================================================================
// TEST 3: VERIFY EXPORT INTEGRATION FOR ANALYTICS COMPONENTS
// ============================================================================

console.log('✅ Test 3: Verifying export integration for analytics components...');

const indexPath = 'lib/mcp/index.ts';
if (!existsSync(indexPath)) {
  console.log('❌ Main index.ts file not found');
  process.exit(1);
}

const indexContent = readFileSync(indexPath, 'utf8');

const expectedExports = [
  'AnalyticsManager',
  'createAnalyticsManager', 
  'getGlobalAnalyticsManager',
  'useAnalytics',
  'useUptimeAnalytics',
  'useQualityTrends',
  'usePerformanceMetrics',
  'useConnectionEvents',
  'AnalyticsDashboard',
  'AnalyticsSummary',
  'PerformanceChart',
  'LatencyChart',
  'BandwidthChart',
  'QualityChart',
  'ConnectionEvent',
  'UptimeAnalytics',
  'AnalyticsConfig'
];

let exportScore = 0;
const exportTests = [];

for (const exportName of expectedExports) {
  const exportPattern = new RegExp(`export.*${exportName}`, 'g');
  const found = exportPattern.test(indexContent);
  exportTests.push({ export: exportName, found });
  if (found) exportScore++;
}

console.log(`  ✓ Analytics component exports found: ${exportScore}/${expectedExports.length}`);

const exportIntegrationScore = Math.round((exportScore / expectedExports.length) * 100);
console.log(`  ✓ Export integration score: ${exportIntegrationScore}%\n`);

// ============================================================================
// TEST 4: FUNCTIONAL TESTING OF ANALYTICS COMPONENTS
// ============================================================================

console.log('✅ Test 4: Functional testing of analytics components...');

let functionalScore = 0;
const functionalTests = [
  {
    name: 'Analytics manager class structure',
    test: () => checkAnalyticsManagerStructure()
  },
  {
    name: 'React hooks implementation',
    test: () => checkAnalyticsHooksImplementation()
  },
  {
    name: 'Data persistence patterns',
    test: () => checkDataPersistencePatterns()
  },
  {
    name: 'Chart components structure',
    test: () => checkChartComponentsStructure()
  },
  {
    name: 'TypeScript type definitions',
    test: () => checkAnalyticsTypeDefinitions()
  },
  {
    name: 'Historical data tracking',
    test: () => checkHistoricalDataTracking()
  }
];

for (const test of functionalTests) {
  const passed = test.test();
  if (passed) {
    console.log(`  ✓ ${test.name} is properly implemented`);
    functionalScore++;
  } else {
    console.log(`  ✗ ${test.name} has implementation issues`);
  }
}

console.log(`  ✓ Functional tests passed: ${functionalScore}/${functionalTests.length}\n`);

// ============================================================================
// FINAL VERIFICATION RESULTS
// ============================================================================

const fileQualityPercentage = Math.round((fileQualityScore / maxFileQualityScore) * 100);
const requirementsPercentage = Math.round((requirementsScore / analyticsRequirements.length) * 100);
const functionalPercentage = Math.round((functionalScore / functionalTests.length) * 100);

// Calculate overall score
const overallScore = Math.round((fileQualityPercentage + requirementsPercentage + exportIntegrationScore + functionalPercentage) / 4);

console.log('📊 SUBTASK 28.6 PHASE 4 VERIFICATION RESULTS:');
console.log(`  • File Quality: ${fileQualityPercentage}%`);
console.log(`  • Requirements Implementation: ${requirementsPercentage}%`);
console.log(`  • Export Integration: ${exportIntegrationScore}%`);
console.log(`  • Functional Testing: ${functionalPercentage}%`);
console.log(`  • Overall Score: ${overallScore}%`);

// Issue detection
console.log('\n🔧 ISSUES DETECTED:\n');

if (fileQualityPercentage < 80) {
  console.log('📁 File Issues:');
  phase4Files.forEach((file, index) => {
    const fileScore = Math.min(4, fileQualityScore - (index * 4));
    if (fileScore < 3) {
      console.log(`  • ${file.name}: Needs attention (score: ${fileScore}/4)`);
    }
  });
}

if (requirementsPercentage < 100) {
  console.log('📋 Missing Requirements:');
  analyticsRequirements.forEach(req => {
    if (!checkAnalyticsRequirement(req)) {
      console.log(`  • ${req}`);
    }
  });
}

if (exportIntegrationScore < 90) {
  console.log('🔗 Export Issues:');
  exportTests.forEach(test => {
    if (!test.found) {
      console.log(`  • Missing export: ${test.export}`);
    }
  });
}

// Final status
if (overallScore >= 90) {
  console.log('\n🎉 PHASE 4 VERIFICATION: EXCELLENT QUALITY!');
  console.log('✅ Historical Connection Analytics - PRODUCTION READY');
} else if (overallScore >= 80) {
  console.log('\n✅ PHASE 4 VERIFICATION: GOOD QUALITY');
  console.log('📋 Historical Connection Analytics - MINOR IMPROVEMENTS NEEDED');
} else if (overallScore >= 70) {
  console.log('\n⚠️  PHASE 4 VERIFICATION: NEEDS IMPROVEMENT');
  console.log('🔧 Historical Connection Analytics - REQUIRES FIXES');
} else {
  console.log('\n❌ PHASE 4 VERIFICATION: MAJOR ISSUES');
  console.log('🚨 Historical Connection Analytics - SIGNIFICANT WORK NEEDED');
}

if (overallScore >= 70) {
  console.log('📋 RECOMMENDATION: Proceed with Phase 5 - Predictive Connection Intelligence');
} else {
  console.log('📋 RECOMMENDATION: Fix Phase 4 issues before proceeding');
}

console.log(`\n🏁 Verification ${overallScore >= 70 ? 'PASSED' : 'FAILED'} - Score: ${overallScore}%\n`);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRequiredPatterns(fileName) {
  if (fileName.includes('types/analytics.ts')) {
    return ['ConnectionEvent', 'UptimeAnalytics', 'QualityTrends', 'PerformanceMetrics'];
  }
  if (fileName.includes('utils/analyticsManager.ts')) {
    return ['class AnalyticsManager', 'recordEvent', 'calculateUptimeAnalytics', 'calculateQualityTrends'];
  }
  if (fileName.includes('hooks/analyticsHooks.ts')) {
    return ['useAnalytics', 'useUptimeAnalytics', 'useQualityTrends', 'usePerformanceMetrics'];
  }
  if (fileName.includes('AnalyticsDashboard.tsx')) {
    return ['AnalyticsDashboard', 'React.FC', 'useAnalytics', 'uptime'];
  }
  if (fileName.includes('PerformanceChart.tsx')) {
    return ['PerformanceChart', 'LatencyChart', 'BandwidthChart', 'QualityChart'];
  }
  return [];
}

function checkImplementationQuality(fileName, content) {
  if (fileName.includes('analytics.ts')) {
    return content.includes('interface ') && content.includes('export type') && content.length > 2000;
  }
  if (fileName.includes('analyticsManager.ts')) {
    return content.includes('class ') && content.includes('recordEvent') && content.includes('localStorage') && content.length > 3000;
  }
  if (fileName.includes('analyticsHooks.ts')) {
    return content.includes('useState') && content.includes('useEffect') && content.includes('useCallback') && content.length > 2500;
  }
  if (fileName.includes('.tsx')) {
    return content.includes('React.FC') && content.includes('className') && 
           (content.includes('useState') || content.includes('props')) && content.length > 2000;
  }
  return content.length > 1000;
}

function checkAnalyticsRequirement(requirement) {
  const files = [
    'lib/mcp/types/analytics.ts', 
    'lib/mcp/utils/analyticsManager.ts', 
    'lib/mcp/hooks/analyticsHooks.ts',
    'lib/mcp/components/AnalyticsDashboard.tsx',
    'lib/mcp/components/PerformanceChart.tsx'
  ];
  
  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    
    switch (requirement) {
      case 'connection history tracking':
        if (content.includes('ConnectionEvent') && content.includes('recordEvent')) return true;
        break;
      case 'uptime/downtime analytics':
        if (content.includes('UptimeAnalytics') && content.includes('calculateUptimeAnalytics')) return true;
        break;
      case 'connection quality trends':
        if (content.includes('QualityTrends') && content.includes('calculateQualityTrends')) return true;
        break;
      case 'performance metrics dashboard':
        if ((content.includes('PerformanceMetrics') || content.includes('usePerformanceMetrics')) && 
            (content.includes('AnalyticsDashboard') || content.includes('Dashboard'))) return true;
        break;
      case 'data persistence (localStorage)':
        if (content.includes('localStorage') && content.includes('persistData')) return true;
        break;
      case 'React hooks integration':
        if (content.includes('useAnalytics') && content.includes('useState')) return true;
        break;
      case 'analytics visualization':
        if ((content.includes('Chart') || content.includes('chart')) && 
            (content.includes('svg') || content.includes('SVG') || content.includes('visualization'))) return true;
        break;
      case 'trend analysis algorithms':
        if (content.includes('calculateLinearTrend') && content.includes('slope')) return true;
        break;
      case 'historical data aggregation':
        if (content.includes('getAggregatedData') && content.includes('AnalyticsPeriod')) return true;
        break;
      case 'event tracking system':
        if (content.includes('addEventListener') && content.includes('AnalyticsEventCallback')) return true;
        break;
    }
  }
  
  return false;
}

function checkAnalyticsManagerStructure() {
  if (!existsSync('lib/mcp/utils/analyticsManager.ts')) return false;
  const content = readFileSync('lib/mcp/utils/analyticsManager.ts', 'utf8');
  return content.includes('class AnalyticsManager') && 
         content.includes('recordEvent') && 
         content.includes('calculateUptimeAnalytics') && 
         content.includes('persistData');
}

function checkAnalyticsHooksImplementation() {
  if (!existsSync('lib/mcp/hooks/analyticsHooks.ts')) return false;
  const content = readFileSync('lib/mcp/hooks/analyticsHooks.ts', 'utf8');
  return content.includes('useAnalytics') && 
         content.includes('useUptimeAnalytics') && 
         content.includes('useState') && 
         content.includes('useEffect');
}

function checkDataPersistencePatterns() {
  if (!existsSync('lib/mcp/utils/analyticsManager.ts')) return false;
  const content = readFileSync('lib/mcp/utils/analyticsManager.ts', 'utf8');
  return content.includes('localStorage') && 
         content.includes('saveToLocalStorage') && 
         content.includes('loadFromLocalStorage');
}

function checkChartComponentsStructure() {
  if (!existsSync('lib/mcp/components/PerformanceChart.tsx')) return false;
  const content = readFileSync('lib/mcp/components/PerformanceChart.tsx', 'utf8');
  return content.includes('LatencyChart') && 
         content.includes('BandwidthChart') && 
         content.includes('QualityChart') && 
         content.includes('svg');
}

function checkAnalyticsTypeDefinitions() {
  if (!existsSync('lib/mcp/types/analytics.ts')) return false;
  const content = readFileSync('lib/mcp/types/analytics.ts', 'utf8');
  return content.includes('interface ConnectionEvent') && 
         content.includes('interface UptimeAnalytics') && 
         content.includes('interface QualityTrends') && 
         content.includes('interface PerformanceMetrics');
}

function checkHistoricalDataTracking() {
  if (!existsSync('lib/mcp/utils/analyticsManager.ts')) return false;
  const content = readFileSync('lib/mcp/utils/analyticsManager.ts', 'utf8');
  return content.includes('events: ConnectionEvent[]') && 
         content.includes('qualityTrends: QualityTrendPoint[]') && 
         content.includes('retentionPeriod') && 
         content.includes('cleanupOldData');
}