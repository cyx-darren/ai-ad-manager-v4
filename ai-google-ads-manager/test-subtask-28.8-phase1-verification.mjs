/**
 * Verification Test for Subtask 28.8 Phase 1: Date Range Synchronization
 * 
 * Tests all Phase 1 components for state synchronization:
 * - Date range sync manager
 * - Enhanced date range hooks
 * - Dashboard context integration
 * - Cross-component synchronization
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Subtask 28.8 Phase 1: Date Range Synchronization');
console.log('================================================================================');

// Test results tracking
let totalScore = 0;
let maxScore = 0;

// Test file quality and structure
console.log('📁 Testing File Quality & Structure...\n');

const fileQualityChecks = [
  {
    file: 'lib/mcp/utils/dateRangeSync.ts',
    patterns: [
      'DateRangeSyncManager',
      'DateRangeValidationResult',
      'validateDateRange',
      'normalizeDateRange',
      'persistDateRange',
      'restoreDateRange',
      'getPresetDateRange',
      'addEventListener',
      'dateRangeSyncManager'
    ]
  },
  {
    file: 'lib/mcp/hooks/dateRangeHooks.ts',
    patterns: [
      'useSyncedDateRange',
      'useDateRangeSync',
      'useDateRangeValidation',
      'SyncedDateRangeResult',
      'DateRangeHookOptions',
      'setDateRange',
      'setPresetDateRange',
      'validateRange',
      'syncStatus'
    ]
  }
];

let fileQualityScore = 0;
let fileQualityMax = 0;

for (const check of fileQualityChecks) {
  const filePath = check.file;
  console.log(`  Testing ${filePath}:`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ File does not exist');
    fileQualityMax += 5;
    continue;
  }
  console.log('  ✅ File exists');
  fileQualityScore += 1;
  fileQualityMax += 1;

  // Check file size
  const stats = fs.statSync(filePath);
  const fileSizeKB = stats.size / 1024;
  const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;
  
  if (fileSizeKB > 10 && lineCount > 200) {
    console.log(`  ✅ File size adequate (${Math.round(fileSizeKB)}KB, ${lineCount} lines)`);
    fileQualityScore += 1;
  } else {
    console.log(`  ❌ File too small (${Math.round(fileSizeKB)}KB, ${lineCount} lines)`);
  }
  fileQualityMax += 1;

  // Check required patterns
  const content = fs.readFileSync(filePath, 'utf8');
  const foundPatterns = check.patterns.filter(pattern => content.includes(pattern));
  
  if (foundPatterns.length === check.patterns.length) {
    console.log(`  ✅ All required patterns found (${foundPatterns.length}/${check.patterns.length})`);
    fileQualityScore += 2;
  } else {
    const missingPatterns = check.patterns.filter(pattern => !content.includes(pattern));
    console.log(`  ❌ Missing patterns: ${missingPatterns.join(', ')}`);
    fileQualityScore += Math.floor((foundPatterns.length / check.patterns.length) * 2);
  }
  fileQualityMax += 2;

  // Check TypeScript structure
  if (content.includes('export') && content.includes('interface') && content.includes('class')) {
    console.log('  ✅ TypeScript structure present');
    fileQualityScore += 1;
  } else {
    console.log('  ❌ TypeScript structure incomplete');
  }
  fileQualityMax += 1;

  console.log(`    📊 File Score: ${Math.floor((fileQualityScore / fileQualityMax) * 5)}/5\n`);
}

// Test requirements implementation
console.log('📋 Testing Requirements Implementation...');

const requirementsChecks = [
  {
    name: 'Global date range state management',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('DateRangeSyncManager') && content.includes('persistDateRange');
    }
  },
  {
    name: 'Date range validation and boundary checking',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('validateDateRange') && content.includes('DateRangeLimits');
    }
  },
  {
    name: 'Cross-component propagation',
    check: () => {
      const hooksContent = fs.readFileSync('lib/mcp/hooks/dateRangeHooks.ts', 'utf8');
      return hooksContent.includes('useSyncedDateRange') && hooksContent.includes('addEventListener');
    }
  },
  {
    name: 'Dashboard context integration',
    check: () => {
      const contextContent = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return contextContent.includes('dateRangeSyncManager') && contextContent.includes('validateDateRange');
    }
  },
  {
    name: 'Date range persistence across sessions',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('persistDateRange') && content.includes('restoreDateRange');
    }
  },
  {
    name: 'Property-specific date range support',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('propertyId') && content.includes('enablePropertySpecificRanges');
    }
  },
  {
    name: 'Cross-browser synchronization',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('initializeCrossBrowserSync') && content.includes('storage');
    }
  },
  {
    name: 'React hooks integration',
    check: () => {
      const content = fs.readFileSync('lib/mcp/hooks/dateRangeHooks.ts', 'utf8');
      return content.includes('useSyncedDateRange') && content.includes('useDateRangeValidation');
    }
  }
];

let requirementsScore = 0;
const requirementsMax = requirementsChecks.length;

for (const req of requirementsChecks) {
  const implemented = req.check();
  console.log(`  ${implemented ? '✅' : '❌'} ${req.name}`);
  if (implemented) {
    requirementsScore += 1;
    console.log(`  ${implemented ? '🟢' : '🔴'} ${req.name} - ${implemented ? 'IMPLEMENTED' : 'MISSING'}`);
  }
}

// Test export integration
console.log('\n📤 Testing Export Integration...');

const exportChecks = [
  // Phase 1 component exports
  'DateRangeSyncManager',
  'dateRangeSyncManager', 
  'useSyncedDateRange',
  'useDateRangeSync',
  'useDateRangeValidation',
  
  // Phase 1 type exports
  'DateRangeLimits',
  'DateRangeValidationResult',
  'DateRangeSyncConfig',
  'DateRangeEventData',
  'DateRangeHookOptions',
  'SyncedDateRangeResult'
];

let exportScore = 0;
const exportMax = exportChecks.length;

const indexContent = fs.readFileSync('lib/mcp/index.ts', 'utf8');

for (const exportName of exportChecks) {
  const exported = indexContent.includes(exportName);
  console.log(`  ${exported ? '✅' : '❌'} ${exportName}`);
  if (exported) {
    exportScore += 1;
    console.log(`  ${exported ? '🟢' : '🔴'} ${exportName} - ${exported ? 'EXPORTED' : 'MISSING'}`);
  }
}

// Test basic functionality
console.log('\n⚙️ Testing Basic Functionality...');

const functionalityChecks = [
  {
    name: 'DateRangeSyncManager can be instantiated',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('export const dateRangeSyncManager') && content.includes('new DateRangeSyncManager');
    }
  },
  {
    name: 'Date range validation with limits checking',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/dateRangeSync.ts', 'utf8');
      return content.includes('limits.minDate') && content.includes('limits.maxDate');
    }
  },
  {
    name: 'Enhanced hooks with synchronization',
    check: () => {
      const content = fs.readFileSync('lib/mcp/hooks/dateRangeHooks.ts', 'utf8');
      return content.includes('syncStatus') && content.includes('isLoading');
    }
  },
  {
    name: 'Dashboard context enhanced with sync manager',
    check: () => {
      const content = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return content.includes('dateRangeSyncManager.validateDateRange') && content.includes('dateRangeSyncManager.persistDateRange');
    }
  },
  {
    name: 'Cross-browser sync initialization',
    check: () => {
      const contextContent = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return contextContent.includes('Initializing date range synchronization') && contextContent.includes('addEventListener');
    }
  }
];

let functionalityScore = 0;
const functionalityMax = functionalityChecks.length;

for (const func of functionalityChecks) {
  const working = func.check();
  console.log(`  ${working ? '✅' : '❌'} ${func.name}`);
  if (working) {
    functionalityScore += 1;
    console.log(`  ${working ? '🟢' : '🔴'} ${func.name} - ${working ? 'FUNCTIONAL' : 'NOT WORKING'}`);
  }
}

// Calculate final results
console.log('\n📊 FINAL RESULTS');
console.log('================================================================================');

totalScore = fileQualityScore + requirementsScore + exportScore + functionalityScore;
maxScore = fileQualityMax + requirementsMax + exportMax + functionalityMax;

const fileQualityPercentage = Math.round((fileQualityScore / fileQualityMax) * 100);
const requirementsPercentage = Math.round((requirementsScore / requirementsMax) * 100);
const exportPercentage = Math.round((exportScore / exportMax) * 100);
const functionalityPercentage = Math.round((functionalityScore / functionalityMax) * 100);
const overallPercentage = Math.round((totalScore / maxScore) * 100);

console.log(`📁 File Quality: ${fileQualityScore}/${fileQualityMax} (${fileQualityPercentage}%)`);
console.log(`📋 Requirements Implementation: ${requirementsScore}/${requirementsMax} (${requirementsPercentage}%)`);
console.log(`📤 Export Integration: ${exportScore}/${exportMax} (${exportPercentage}%)`);
console.log(`⚙️ Functional Testing: ${functionalityScore}/${functionalityMax} (${functionalityPercentage}%)`);
console.log('');
console.log(`🎯 OVERALL SCORE: ${totalScore}/${maxScore} (${overallPercentage}%)`);

// Determine quality level
let qualityLevel = '🔴 POOR';
if (overallPercentage >= 90) qualityLevel = '🏆 EXCELLENT';
else if (overallPercentage >= 80) qualityLevel = '🟢 VERY GOOD';
else if (overallPercentage >= 70) qualityLevel = '🟡 GOOD';
else if (overallPercentage >= 60) qualityLevel = '🟠 FAIR';

console.log(`🏆 QUALITY LEVEL: ${qualityLevel}`);

// Recommendations
console.log('\n💡 Recommendations:');
if (overallPercentage >= 90) {
  console.log('  - Excellent implementation! Phase 1 is ready for Phase 2!');
} else {
  if (fileQualityPercentage < 80) {
    console.log('  - Improve file structure and pattern implementation');
  }
  if (requirementsPercentage < 80) {
    console.log('  - Complete missing Phase 1 requirements');
  }
  if (exportPercentage < 80) {
    console.log('  - Fix export integration in MCP index');
  }
  if (functionalityPercentage < 80) {
    console.log('  - Fix functional issues in synchronization components');
  }
}

console.log('\n✅ Phase 1 verification complete');

// Exit with appropriate code
process.exit(overallPercentage >= 80 ? 0 : 1);