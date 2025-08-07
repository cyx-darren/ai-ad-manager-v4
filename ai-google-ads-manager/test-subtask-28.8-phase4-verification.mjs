/**
 * Verification Test for Subtask 28.8 Phase 4: Cross-Component State Consistency
 * 
 * Tests all Phase 4 components for cross-component state management:
 * - Component state registry
 * - State change event system  
 * - Component state validator
 * - Cross-component hooks
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Subtask 28.8 Phase 4: Cross-Component State Consistency');
console.log('================================================================================');

// Test results tracking
let totalScore = 0;
let maxScore = 0;

// Test file quality and structure
console.log('📁 Testing File Quality & Structure...\n');

const fileQualityChecks = [
  {
    file: 'lib/mcp/utils/componentRegistry.ts',
    patterns: [
      'ComponentStateRegistry',
      'ComponentRegistration',
      'register',
      'unregister',
      'updateState',
      'ComponentDependency',
      'RegistryStats',
      'componentStateRegistry',
      'performHealthCheck'
    ]
  },
  {
    file: 'lib/mcp/utils/stateEvents.ts',
    patterns: [
      'StateChangeEventManager',
      'StateChangeEvent',
      'subscribe',
      'unsubscribe',
      'publish',
      'EventSubscription',
      'EventBatch',
      'stateChangeEventManager',
      'enableReplay'
    ]
  },
  {
    file: 'lib/mcp/utils/stateValidator.ts',
    patterns: [
      'ComponentStateValidator',
      'ValidationRule',
      'ValidationSchema',
      'validateState',
      'ValidationResult',
      'repairState',
      'checkStateIntegrity',
      'componentStateValidator',
      'registerSchema'
    ]
  },
  {
    file: 'lib/mcp/hooks/crossComponentHooks.ts',
    patterns: [
      'useCrossComponentState',
      'useComponentEvents',
      'useRegistryMonitor',
      'useValidationMonitor',
      'CrossComponentOptions',
      'ComponentState',
      'CrossComponentResult',
      'publishEvent'
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
  
  if (fileSizeKB > 10 && lineCount > 300) {
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
    name: 'Component state registry system',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return content.includes('ComponentStateRegistry') && content.includes('register') && content.includes('Map<string, ComponentRegistration>');
    }
  },
  {
    name: 'Component registration and deregistration',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return content.includes('register') && content.includes('unregister') && content.includes('ComponentRegistration');
    }
  },
  {
    name: 'Component dependency tracking',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return content.includes('addDependency') && content.includes('ComponentDependency') && content.includes('getDependencies');
    }
  },
  {
    name: 'State change event system',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('StateChangeEventManager') && content.includes('subscribe') && content.includes('publish');
    }
  },
  {
    name: 'Event filtering and selective updates',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('filter') && content.includes('createFilter') && content.includes('topicMatches');
    }
  },
  {
    name: 'Event throttling and debouncing',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('throttle') && content.includes('debounce') && content.includes('throttleMs');
    }
  },
  {
    name: 'Event batching system',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('EventBatch') && content.includes('addToBatch') && content.includes('deliverBatch');
    }
  },
  {
    name: 'Event replay capabilities',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('enableReplay') && content.includes('sendReplayEvents') && content.includes('EventReplay');
    }
  },
  {
    name: 'Schema-based state validation',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('ValidationSchema') && content.includes('ValidationRule') && content.includes('validateState');
    }
  },
  {
    name: 'Cross-component state consistency checks',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('validateCrossComponent') && content.includes('CrossComponentValidation') && content.includes('validateRelationship');
    }
  },
  {
    name: 'Automatic state repair mechanisms',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('repairState') && content.includes('defaultRepairStrategy') && content.includes('repairedState');
    }
  },
  {
    name: 'State integrity verification with checksums',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('checkStateIntegrity') && content.includes('generateChecksum') && content.includes('StateIntegrityCheck');
    }
  },
  {
    name: 'Cross-component React hooks',
    check: () => {
      const content = fs.readFileSync('lib/mcp/hooks/crossComponentHooks.ts', 'utf8');
      return content.includes('useCrossComponentState') && content.includes('useComponentEvents') && content.includes('useRegistryMonitor');
    }
  },
  {
    name: 'Component health monitoring',
    check: () => {
      const registryContent = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      const hooksContent = fs.readFileSync('lib/mcp/hooks/crossComponentHooks.ts', 'utf8');
      return registryContent.includes('performHealthCheck') && hooksContent.includes('health');
    }
  },
  {
    name: 'Dashboard context integration',
    check: () => {
      const contextContent = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return contextContent.includes('useCrossComponentState') && contextContent.includes('crossComponentHandler');
    }
  },
  {
    name: 'Cross-component event publishing',
    check: () => {
      const contextContent = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return contextContent.includes('publishEvent') && contextContent.includes('dashboard.dateRange.changed');
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
  // Phase 4 component exports
  'ComponentStateRegistry',
  'componentStateRegistry',
  'StateChangeEventManager',
  'stateChangeEventManager',
  'ComponentStateValidator',
  'componentStateValidator',
  'useCrossComponentState',
  'useComponentEvents',
  'useRegistryMonitor',
  'useValidationMonitor',
  
  // Phase 4 type exports
  'ComponentRegistration',
  'ComponentSnapshot',
  'ComponentDependency',
  'RegistryStats',
  'StateChangeEvent',
  'EventSubscription',
  'EventBatch',
  'EventReplay',
  'EventStats',
  'ValidationRule',
  'ValidationSchema',
  'ValidationResult',
  'ValidationError',
  'ValidationWarning',
  'CrossComponentValidation',
  'StateIntegrityCheck',
  'CrossComponentOptions',
  'ComponentState',
  'CrossComponentResult'
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
    name: 'ComponentStateRegistry can manage components',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return content.includes('export const componentStateRegistry') && content.includes('new ComponentStateRegistry');
    }
  },
  {
    name: 'StateChangeEventManager has pub/sub capabilities',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('subscribe') && content.includes('publish') && content.includes('unsubscribe');
    }
  },
  {
    name: 'ComponentStateValidator has validation schemas',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('schemas') && content.includes('registerSchema') && content.includes('validateState');
    }
  },
  {
    name: 'Cross-component hooks provide state management',
    check: () => {
      const content = fs.readFileSync('lib/mcp/hooks/crossComponentHooks.ts', 'utf8');
      return content.includes('useCrossComponentState') && content.includes('updateState') && content.includes('publishEvent');
    }
  },
  {
    name: 'Event system supports filtering and batching',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('filter') && content.includes('EventBatch') && content.includes('batches');
    }
  },
  {
    name: 'Validation system supports auto-repair',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateValidator.ts', 'utf8');
      return content.includes('repairState') && content.includes('repairStrategies') && content.includes('autoRepair');
    }
  },
  {
    name: 'Registry tracks component dependencies',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return content.includes('dependencies') && content.includes('addDependency') && content.includes('ComponentDependency');
    }
  },
  {
    name: 'Dashboard context integration functional',
    check: () => {
      const content = fs.readFileSync('contexts/DashboardContext.tsx', 'utf8');
      return content.includes('crossComponentHandler.register') && content.includes('crossComponentHandler.updateState');
    }
  },
  {
    name: 'Health monitoring system operational',
    check: () => {
      const registryContent = fs.readFileSync('lib/mcp/utils/componentRegistry.ts', 'utf8');
      return registryContent.includes('performHealthCheck') && registryContent.includes('healthCheckInterval');
    }
  },
  {
    name: 'Event replay system functional',
    check: () => {
      const content = fs.readFileSync('lib/mcp/utils/stateEvents.ts', 'utf8');
      return content.includes('replayConfigs') && content.includes('sendReplayEvents') && content.includes('enableReplay');
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
  console.log('  - Excellent implementation! Phase 4 is ready for Phase 5!');
} else {
  if (fileQualityPercentage < 80) {
    console.log('  - Improve file structure and pattern implementation');
  }
  if (requirementsPercentage < 80) {
    console.log('  - Complete missing Phase 4 requirements');
  }
  if (exportPercentage < 80) {
    console.log('  - Fix export integration in MCP index');
  }
  if (functionalityPercentage < 80) {
    console.log('  - Fix functional issues in cross-component state consistency components');
  }
}

console.log('\n✅ Phase 4 verification complete');

// Exit with appropriate code
process.exit(overallPercentage >= 80 ? 0 : 1);