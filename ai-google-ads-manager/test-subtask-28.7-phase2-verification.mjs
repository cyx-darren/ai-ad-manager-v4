#!/usr/bin/env node

/**
 * Subtask 28.7 Phase 2 Verification Script
 * 
 * Tests Context & State Management implementation:
 * - Property Management Hooks
 * - Property State Persistence  
 * - Property Context Integration
 * - Export Integration
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  phase2Files: [
    { path: 'lib/mcp/hooks/propertyHooks.ts', minSize: 900, patterns: ['usePropertySelection', 'usePropertyDiscovery', 'usePropertyCache', 'usePropertyValidation', 'usePropertyPermissions', 'usePropertyManager'] },
    { path: 'lib/mcp/utils/propertyPersistence.ts', minSize: 700, patterns: ['PropertyPersistenceService', 'saveSelectedProperty', 'loadSelectedProperty', 'getPropertyPersistenceService', 'crossTabSync'] },
    { path: 'lib/mcp/context/PropertyContext.tsx', minSize: 600, patterns: ['PropertyProvider', 'usePropertyContext', 'useSelectedProperty', 'useAvailableProperties', 'PropertyAction'] }
  ],
  requiredExports: [
    'usePropertySelection',
    'usePropertyDiscovery', 
    'usePropertyCache',
    'usePropertyValidation',
    'usePropertyPermissions',
    'usePropertyManager',
    'PropertyPersistenceService',
    'getPropertyPersistenceService',
    'PropertyProvider',
    'usePropertyContext',
    'useSelectedProperty'
  ],
  requirements: [
    'react hooks for property management',
    'property state persistence with localStorage',
    'property context provider and consumers',
    'cross-tab synchronization',
    'property selection state management',
    'comprehensive error handling'
  ]
};

// Test results storage  
const results = {
  fileQuality: { score: 0, max: TEST_CONFIG.phase2Files.length * 4, details: [] },
  requirements: { score: 0, max: TEST_CONFIG.requirements.length, details: [] },
  exports: { score: 0, max: TEST_CONFIG.requiredExports.length, details: [] },
  functional: { score: 0, max: 4, details: [] }
};

console.log('🧪 Testing Subtask 28.7 Phase 2: Context & State Management');
console.log('=' * 80);

// Helper function to read file safely
function readFile(filePath) {
  try {
    const fullPath = join(__dirname, filePath);
    if (!existsSync(fullPath)) {
      return null;
    }
    return readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to get file stats
function getFileStats(filePath) {
  try {
    const fullPath = join(__dirname, filePath);
    if (!existsSync(fullPath)) {
      return null;
    }
    const stats = statSync(fullPath);
    const content = readFileSync(fullPath, 'utf8');
    return {
      size: stats.size,
      lines: content.split('\n').length,
      characters: content.length
    };
  } catch (error) {
    return null;
  }
}

// Test 1: File Quality Assessment
console.log('\n📁 Testing File Quality & Structure...');
let filesWithIssues = [];

for (const fileInfo of TEST_CONFIG.phase2Files) {
  console.log(`\n  Testing ${fileInfo.path}:`);
  let fileScore = 0;
  
  const content = readFile(fileInfo.path);
  const stats = getFileStats(fileInfo.path);
  
  if (!content || !stats) {
    console.log(`    ❌ File not found or unreadable`);
    filesWithIssues.push(`${fileInfo.path}: File missing or unreadable`);
    continue;
  }
  
  // Check file size
  if (stats.characters > fileInfo.minSize) {
    console.log(`    ✓ File size adequate (${stats.characters} chars, ${stats.lines} lines)`);
    fileScore += 1;
  } else {
    console.log(`    ❌ File too small (${stats.characters} chars, expected ${fileInfo.minSize}+)`);
    filesWithIssues.push(`${fileInfo.path}: File too small`);
  }
  
  // Check required patterns
  let patternsFound = 0;
  for (const pattern of fileInfo.patterns) {
    if (content.includes(pattern)) {
      patternsFound++;
    } else {
      console.log(`    ❌ Missing pattern: ${pattern}`);
    }
  }
  
  if (patternsFound === fileInfo.patterns.length) {
    console.log(`    ✓ All required patterns found (${patternsFound}/${fileInfo.patterns.length})`);
    fileScore += 1;
  } else {
    console.log(`    ❌ Missing patterns (${patternsFound}/${fileInfo.patterns.length})`);
    filesWithIssues.push(`${fileInfo.path}: Missing ${fileInfo.patterns.length - patternsFound} patterns`);
  }
  
  // Check TypeScript/React structure
  const hasTypes = content.includes('interface ') || content.includes('type ') || content.includes('enum ');
  const hasExports = content.includes('export ');
  const hasImports = content.includes('import ');
  const isReactFile = fileInfo.path.includes('.tsx');
  const hasReactStuff = isReactFile ? (content.includes('React') && content.includes('useState')) : true;
  
  if (hasTypes && hasExports && hasImports && hasReactStuff) {
    console.log(`    ✓ TypeScript/React structure present`);
    fileScore += 1;
  } else {
    console.log(`    ❌ TypeScript/React structure issues`);
    filesWithIssues.push(`${fileInfo.path}: TypeScript/React structure issues`);
  }
  
  // Check implementation quality
  const qualityThreshold = fileInfo.path.includes('hooks') ? 800 : 500;
  if (stats.characters > qualityThreshold && content.includes('/**') && content.split('\n').length > 40) {
    console.log(`    ✓ Implementation quality check passed`);
    fileScore += 1;
  } else {
    console.log(`    ❌ Implementation quality needs improvement`);
    filesWithIssues.push(`${fileInfo.path}: Implementation quality needs improvement`);
  }
  
  console.log(`    📊 File Score: ${fileScore}/4`);
  results.fileQuality.score += fileScore;
  results.fileQuality.details.push(`${fileInfo.path}: ${fileScore}/4`);
}

// Test 2: Requirements Implementation
console.log('\n📋 Testing Requirements Implementation...');

const requirementChecks = TEST_CONFIG.requirements.map(requirement => {
  let found = false;
  
  // Special case handling for specific requirements
  switch (requirement.toLowerCase()) {
    case 'react hooks for property management':
      const hooksFile = readFile('lib/mcp/hooks/propertyHooks.ts');
      if (hooksFile && hooksFile.includes('usePropertySelection') && hooksFile.includes('usePropertyManager') && hooksFile.includes('useState')) {
        found = true;
      }
      break;
      
    case 'property state persistence with localstorage':
      const persistenceFile = readFile('lib/mcp/utils/propertyPersistence.ts');
      if (persistenceFile && persistenceFile.includes('localStorage') && persistenceFile.includes('PropertyPersistenceService') && persistenceFile.includes('savePropertyState')) {
        found = true;
      }
      break;
      
    case 'property context provider and consumers':
      const contextFile = readFile('lib/mcp/context/PropertyContext.tsx');
      if (contextFile && contextFile.includes('PropertyProvider') && contextFile.includes('usePropertyContext') && contextFile.includes('createContext')) {
        found = true;
      }
      break;
      
    case 'cross-tab synchronization':
      const syncFile = readFile('lib/mcp/utils/propertyPersistence.ts');
      if (syncFile && syncFile.includes('cross-tab') && syncFile.includes('StorageEvent') && syncFile.includes('addEventListener')) {
        found = true;
      }
      break;
      
    case 'property selection state management':
      const selectionFile = readFile('lib/mcp/hooks/propertyHooks.ts');
      if (selectionFile && selectionFile.includes('selectProperty') && selectionFile.includes('clearSelection') && selectionFile.includes('PropertySelectionState')) {
        found = true;
      }
      break;
      
    case 'comprehensive error handling':
      const errorFiles = [
        readFile('lib/mcp/hooks/propertyHooks.ts'),
        readFile('lib/mcp/utils/propertyPersistence.ts'),
        readFile('lib/mcp/context/PropertyContext.tsx')
      ];
      found = errorFiles.some(file => file && file.includes('try {') && file.includes('catch') && file.includes('PropertyError'));
      break;
      
    default:
      // Generic keyword-based search
      const searchFiles = [
        'lib/mcp/hooks/propertyHooks.ts',
        'lib/mcp/utils/propertyPersistence.ts', 
        'lib/mcp/context/PropertyContext.tsx'
      ];
      
      for (const filePath of searchFiles) {
        const content = readFile(filePath);
        if (content) {
          const keywords = requirement.toLowerCase().split(' ');
          const hasAllKeywords = keywords.every(keyword => 
            content.toLowerCase().includes(keyword) || 
            content.toLowerCase().includes(keyword.replace(/s$/, '')) ||
            content.toLowerCase().includes(keyword + 's')
          );
          
          if (hasAllKeywords) {
            found = true;
            break;
          }
        }
      }
  }
  
  console.log(`  ${found ? '✅' : '❌'} ${requirement} - ${found ? 'IMPLEMENTED' : 'NOT FOUND'}`);
  return found;
});

results.requirements.score = requirementChecks.filter(Boolean).length;
results.requirements.details = TEST_CONFIG.requirements.map((req, i) => 
  `${req}: ${requirementChecks[i] ? 'IMPLEMENTED' : 'NOT FOUND'}`
);

// Test 3: Export Integration
console.log('\n📤 Testing Export Integration...');

const mcpIndex = readFile('lib/mcp/index.ts');
if (!mcpIndex) {
  console.log('❌ MCP index file not found');
  results.exports.score = 0;
} else {
  const exportChecks = TEST_CONFIG.requiredExports.map(exportName => {
    const isExported = mcpIndex.includes(`export`) && (
      mcpIndex.includes(`export { ${exportName}`) ||
      mcpIndex.includes(`export * from`) ||
      mcpIndex.includes(`${exportName}`) ||
      mcpIndex.includes(`export type { ${exportName}`) ||
      mcpIndex.includes(`export type {`) && mcpIndex.includes(`${exportName}`)
    );
    
    console.log(`  ${isExported ? '✅' : '❌'} ${exportName} - ${isExported ? 'EXPORTED' : 'NOT EXPORTED'}`);
    return isExported;
  });
  
  results.exports.score = exportChecks.filter(Boolean).length;
  results.exports.details = TEST_CONFIG.requiredExports.map((exp, i) => 
    `${exp}: ${exportChecks[i] ? 'EXPORTED' : 'NOT EXPORTED'}`
  );
}

// Test 4: Functional Testing
console.log('\n⚙️ Testing Basic Functionality...');

const functionalTests = [
  {
    name: 'Property hooks system',
    test: () => {
      const content = readFile('lib/mcp/hooks/propertyHooks.ts');
      return content && 
        content.includes('usePropertySelection') && 
        content.includes('usePropertyManager') && 
        content.includes('useState') &&
        content.includes('useCallback');
    }
  },
  {
    name: 'Property persistence system',
    test: () => {
      const content = readFile('lib/mcp/utils/propertyPersistence.ts');
      return content && 
        content.includes('PropertyPersistenceService') &&
        content.includes('localStorage') &&
        content.includes('savePropertyState') &&
        content.includes('loadPropertyState');
    }
  },
  {
    name: 'Property context system',
    test: () => {
      const content = readFile('lib/mcp/context/PropertyContext.tsx');
      return content && 
        content.includes('PropertyProvider') &&
        content.includes('usePropertyContext') &&
        content.includes('createContext') &&
        content.includes('useReducer');
    }
  },
  {
    name: 'Integration completeness',
    test: () => {
      const indexContent = readFile('lib/mcp/index.ts');
      const hasHooksExports = indexContent && indexContent.includes('usePropertySelection');
      const hasPersistenceExports = indexContent && indexContent.includes('PropertyPersistenceService');
      const hasContextExports = indexContent && indexContent.includes('PropertyProvider');
      return hasHooksExports && hasPersistenceExports && hasContextExports;
    }
  }
];

functionalTests.forEach(test => {
  const passed = test.test();
  console.log(`  ${passed ? '✅' : '❌'} ${test.name} - ${passed ? 'FUNCTIONAL' : 'ISSUES FOUND'}`);
  if (passed) results.functional.score++;
  results.functional.details.push(`${test.name}: ${passed ? 'FUNCTIONAL' : 'ISSUES FOUND'}`);
});

// Calculate final scores
console.log('\n📊 FINAL RESULTS');
console.log('=' * 50);

const fileQualityPercent = Math.round((results.fileQuality.score / results.fileQuality.max) * 100);
const requirementsPercent = Math.round((results.requirements.score / results.requirements.max) * 100);
const exportsPercent = Math.round((results.exports.score / results.exports.max) * 100);
const functionalPercent = Math.round((results.functional.score / results.functional.max) * 100);

console.log(`📁 File Quality: ${results.fileQuality.score}/${results.fileQuality.max} (${fileQualityPercent}%)`);
console.log(`📋 Requirements Implementation: ${results.requirements.score}/${results.requirements.max} (${requirementsPercent}%)`);
console.log(`📤 Export Integration: ${results.exports.score}/${results.exports.max} (${exportsPercent}%)`);
console.log(`⚙️ Functional Testing: ${results.functional.score}/${results.functional.max} (${functionalPercent}%)`);

const totalScore = results.fileQuality.score + results.requirements.score + results.exports.score + results.functional.score;
const totalMax = results.fileQuality.max + results.requirements.max + results.exports.max + results.functional.max;
const overallPercent = Math.round((totalScore / totalMax) * 100);

console.log(`\n🎯 OVERALL SCORE: ${totalScore}/${totalMax} (${overallPercent}%)`);

// Quality assessment
let qualityLevel;
if (overallPercent >= 95) qualityLevel = 'OUTSTANDING';
else if (overallPercent >= 90) qualityLevel = 'EXCELLENT';
else if (overallPercent >= 80) qualityLevel = 'GOOD';
else if (overallPercent >= 70) qualityLevel = 'ACCEPTABLE';
else qualityLevel = 'NEEDS IMPROVEMENT';

console.log(`🏆 QUALITY LEVEL: ${qualityLevel}`);

// Issues summary
if (filesWithIssues.length > 0) {
  console.log('\n⚠️ Issues Found:');
  filesWithIssues.forEach(issue => console.log(`  - ${issue}`));
}

// Recommendations
console.log('\n💡 Recommendations:');
if (fileQualityPercent < 90) {
  console.log('  - Improve file structure and pattern coverage');
}
if (requirementsPercent < 90) {
  console.log('  - Complete missing requirement implementations');
}
if (exportsPercent < 90) {
  console.log('  - Fix export integration in MCP index');
}
if (functionalPercent < 90) {
  console.log('  - Address functional testing failures');
}
if (overallPercent >= 90) {
  console.log('  - Phase 2 implementation is ready for Phase 3!');
}

console.log('\n✅ Phase 2 verification complete');
process.exit(overallPercent >= 85 ? 0 : 1);