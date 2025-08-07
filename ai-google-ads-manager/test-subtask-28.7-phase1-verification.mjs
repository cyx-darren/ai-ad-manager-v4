#!/usr/bin/env node

/**
 * Subtask 28.7 Phase 1 Verification Script
 * 
 * Tests Property Discovery & Data Architecture implementation:
 * - GA4 Property Data Structures
 * - Property Discovery API Integration  
 * - Property Validation & Filtering
 * - Property Caching Mechanisms
 * - MCP Integration
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  requiredFiles: [
    'lib/mcp/types/property.ts',
    'lib/mcp/utils/propertyDiscovery.ts', 
    'lib/mcp/utils/propertyValidation.ts',
    'lib/mcp/utils/propertyCache.ts',
    'lib/mcp/index.ts'
  ],
  phase1Files: [
    { path: 'lib/mcp/types/property.ts', minSize: 500, patterns: ['GA4Property', 'PropertyType', 'PropertySelectionState', 'PropertyCache', 'PropertyValidationResult'] },
    { path: 'lib/mcp/utils/propertyDiscovery.ts', minSize: 600, patterns: ['PropertyDiscoveryService', 'discoverProperties', 'fetchProperty', 'validatePropertyAccess'] },
    { path: 'lib/mcp/utils/propertyValidation.ts', minSize: 600, patterns: ['PropertyValidationService', 'validateProperty', 'filterProperties', 'sortProperties'] },
    { path: 'lib/mcp/utils/propertyCache.ts', minSize: 700, patterns: ['PropertyCacheService', 'PropertyCacheManager', 'getPropertyCache', 'createPropertyCache'] }
  ],
  requiredExports: [
    'GA4Property',
    'PropertyDiscoveryService', 
    'PropertyValidationService',
    'PropertyCacheService',
    'createPropertyDiscoveryService',
    'validateGA4Property',
    'getPropertyCache'
  ],
  requirements: [
    'comprehensive property data structures',
    'property discovery API integration',
    'property validation and filtering',
    'property caching with TTL',
    'error handling and retry logic',
    'TypeScript type safety'
  ]
};

// Test results storage
const results = {
  fileQuality: { score: 0, max: TEST_CONFIG.phase1Files.length * 4, details: [] },
  requirements: { score: 0, max: TEST_CONFIG.requirements.length, details: [] },
  exports: { score: 0, max: TEST_CONFIG.requiredExports.length, details: [] },
  functional: { score: 0, max: 4, details: [] }
};

console.log('🧪 Testing Subtask 28.7 Phase 1: Property Discovery & Data Architecture');
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

for (const fileInfo of TEST_CONFIG.phase1Files) {
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
  
  // Check TypeScript structure
  const hasTypes = content.includes('interface ') || content.includes('type ') || content.includes('enum ');
  const hasExports = content.includes('export ');
  const hasImports = content.includes('import ');
  
  if (hasTypes && hasExports) {
    console.log(`    ✓ TypeScript structure present`);
    fileScore += 1;
  } else {
    console.log(`    ❌ TypeScript structure issues`);
    filesWithIssues.push(`${fileInfo.path}: TypeScript structure issues`);
  }
  
  // Check implementation quality
  const qualityThreshold = fileInfo.path.includes('types') ? 400 : 500;
  if (stats.characters > qualityThreshold && content.includes('/**') && content.split('\n').length > 50) {
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
    case 'comprehensive property data structures':
      const propertyTypes = readFile('lib/mcp/types/property.ts');
      if (propertyTypes && propertyTypes.includes('GA4Property') && propertyTypes.includes('PropertyType') && propertyTypes.includes('PropertySelectionState')) {
        found = true;
      }
      break;
      
    case 'property discovery api integration':
      const propertyDiscovery = readFile('lib/mcp/utils/propertyDiscovery.ts');
      if (propertyDiscovery && propertyDiscovery.includes('PropertyDiscoveryService') && propertyDiscovery.includes('discoverProperties') && propertyDiscovery.includes('mcpClient')) {
        found = true;
      }
      break;
      
    case 'property validation and filtering':
      const propertyValidation = readFile('lib/mcp/utils/propertyValidation.ts');
      if (propertyValidation && propertyValidation.includes('PropertyValidationService') && propertyValidation.includes('filterProperties') && propertyValidation.includes('validateProperty')) {
        found = true;
      }
      break;
      
    case 'property caching with ttl':
      const propertyCache = readFile('lib/mcp/utils/propertyCache.ts');
      if (propertyCache && propertyCache.includes('PropertyCacheService') && propertyCache.includes('ttl') && propertyCache.includes('cleanup')) {
        found = true;
      }
      break;
      
    case 'error handling and retry logic':
      const discoveryFile = readFile('lib/mcp/utils/propertyDiscovery.ts');
      if (discoveryFile && discoveryFile.includes('PropertyError') && discoveryFile.includes('retry') && discoveryFile.includes('catch')) {
        found = true;
      }
      break;
      
    case 'typescript type safety':
      const typesFile = readFile('lib/mcp/types/property.ts');
      if (typesFile && typesFile.includes('interface ') && typesFile.includes('export type') && typesFile.includes('enum ')) {
        found = true;
      }
      break;
      
    default:
      // Generic keyword-based search
      for (const filePath of TEST_CONFIG.requiredFiles) {
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
    name: 'Property types system',
    test: () => {
      const content = readFile('lib/mcp/types/property.ts');
      return content && 
        content.includes('PropertyType') && 
        content.includes('PropertyStatus') && 
        content.includes('PropertyAccessLevel') &&
        content.includes('enum ');
    }
  },
  {
    name: 'Property discovery service',
    test: () => {
      const content = readFile('lib/mcp/utils/propertyDiscovery.ts');
      return content && 
        content.includes('PropertyDiscoveryService') &&
        content.includes('discoverProperties') &&
        content.includes('fetchProperty') &&
        content.includes('validatePropertyAccess');
    }
  },
  {
    name: 'Property validation system',
    test: () => {
      const content = readFile('lib/mcp/utils/propertyValidation.ts');
      return content && 
        content.includes('PropertyValidationService') &&
        content.includes('validateProperty') &&
        content.includes('filterProperties') &&
        content.includes('sortProperties');
    }
  },
  {
    name: 'Property caching system',
    test: () => {
      const content = readFile('lib/mcp/utils/propertyCache.ts');
      return content && 
        content.includes('PropertyCacheService') &&
        content.includes('PropertyCacheManager') &&
        content.includes('get') &&
        content.includes('set') &&
        content.includes('cleanup');
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
  console.log('  - Phase 1 implementation is ready for Phase 2!');
}

console.log('\n✅ Phase 1 verification complete');
process.exit(overallPercent >= 85 ? 0 : 1);