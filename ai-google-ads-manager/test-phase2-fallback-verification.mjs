#!/usr/bin/env node

/**
 * Phase 2 Fallback Management Verification Script
 * 
 * This script verifies the implementation of Phase 2: Graceful Degradation & Fallback Behavior
 * for Subtask 28.5 (Create Offline Mode Handling).
 * 
 * Verification Areas:
 * 1. File Structure & Creation
 * 2. File Quality & Completeness  
 * 3. Requirements Implementation
 * 4. Export Integration
 * 5. TypeScript Type Safety
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// CONFIGURATION
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

const EXPECTED_FILES = {
  'lib/mcp/utils/fallbackManager.ts': {
    minLines: 800,
    requiredPatterns: [
      'export class FallbackManager',
      'export interface FallbackManagerConfig',
      'export interface FallbackManagerState',
      'export type FallbackStrategy',
      'export type OperationType',
      'export type DegradationLevel',
      'executeWithFallback',
      'updateDegradationLevel',
      'queueOperation',
      'getMockData',
      'generateMockGA4Data',
      'generateMockRealtimeData',
      'DEFAULT_FALLBACK_STRATEGIES',
      'DEFAULT_FEATURES',
      'DEFAULT_MOCK_DATA_CONFIGS'
    ],
    description: 'Core fallback management system'
  },
  'lib/mcp/hooks/fallbackHooks.ts': {
    minLines: 600,
    requiredPatterns: [
      'export function useFallbackManager',
      'export function useDegradationLevel',
      'export function useFeatureAvailability',
      'export function useQueuedOperations',
      'export function useMockDataCache',
      'export interface FallbackManagerResult',
      'export interface DegradationLevelResult',
      'export interface FeatureAvailabilityResult',
      'export interface QueuedOperationsResult',
      'export interface MockDataCacheResult',
      'executeWithFallback',
      'queueOperation',
      'getMockData',
      'getFeatureStatus'
    ],
    description: 'React hooks for fallback functionality'
  }
};

const EXPORT_INTEGRATION_PATTERNS = [
  "export \\* from './utils/fallbackManager'",
  "export \\* from './hooks/fallbackHooks'"
];

const REQUIREMENTS_CHECKLIST = [
  {
    name: 'Fallback Mechanisms for MCP Operations',
    patterns: [
      'executeWithFallback',
      'FallbackStrategy',
      'alternativeAction',
      'primaryOperation'
    ],
    files: ['lib/mcp/utils/fallbackManager.ts']
  },
  {
    name: 'Degraded Functionality Modes',
    patterns: [
      'DegradationLevel',
      'calculateDegradationLevel',
      'updateDegradationLevel',
      'degradedFeatures'
    ],
    files: ['lib/mcp/utils/fallbackManager.ts', 'lib/mcp/hooks/fallbackHooks.ts']
  },
  {
    name: 'Mock Data Serving for Offline Scenarios',
    patterns: [
      'generateMockGA4Data',
      'generateMockRealtimeData',
      'MockDataConfig',
      'getMockData',
      'mockDataCache'
    ],
    files: ['lib/mcp/utils/fallbackManager.ts', 'lib/mcp/hooks/fallbackHooks.ts']
  },
  {
    name: 'Feature Disabling for MCP-dependent Operations',
    patterns: [
      'disabledFeatures',
      'FeatureConfig',
      'updateFeatureAvailability',
      'onFeatureDisabled',
      'useFeatureAvailability'
    ],
    files: ['lib/mcp/utils/fallbackManager.ts', 'lib/mcp/hooks/fallbackHooks.ts']
  },
  {
    name: 'Queue for Later Execution',
    patterns: [
      'queueOperation',
      'QueuedOperation',
      'processQueue',
      'useQueuedOperations',
      'queuedOperations'
    ],
    files: ['lib/mcp/utils/fallbackManager.ts', 'lib/mcp/hooks/fallbackHooks.ts']
  },
  {
    name: 'React Hook Integration',
    patterns: [
      'useFallbackManager',
      'useDegradationLevel', 
      'useFeatureAvailability',
      'useQueuedOperations',
      'useMockDataCache'
    ],
    files: ['lib/mcp/hooks/fallbackHooks.ts']
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title, 'bold'));
  console.log('='.repeat(60));
}

function logSubsection(title) {
  console.log('\n' + colorize(title, 'cyan'));
  console.log('-'.repeat(40));
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileLineCount(filePath) {
  if (!checkFileExists(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

function checkPatternInFile(filePath, pattern) {
  if (!checkFileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(pattern, 'i');
  return regex.test(content);
}

function analyzeFileQuality(filePath, expectedFile) {
  const results = {
    exists: false,
    lineCount: 0,
    meetsMinLines: false,
    patternMatches: 0,
    totalPatterns: expectedFile.requiredPatterns.length,
    issues: []
  };

  if (!checkFileExists(filePath)) {
    results.issues.push('File does not exist');
    return results;
  }

  results.exists = true;
  results.lineCount = getFileLineCount(filePath);
  results.meetsMinLines = results.lineCount >= expectedFile.minLines;

  if (!results.meetsMinLines) {
    results.issues.push(`File too short: ${results.lineCount} lines < ${expectedFile.minLines} required`);
  }

  // Check required patterns
  for (const pattern of expectedFile.requiredPatterns) {
    if (checkPatternInFile(filePath, pattern)) {
      results.patternMatches++;
    } else {
      results.issues.push(`Missing pattern: ${pattern}`);
    }
  }

  // Check for potential syntax issues
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax checks
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    if (openBraces !== closeBraces) {
      results.issues.push('Unmatched braces detected');
    }
    
    if (openParens !== closeParens) {
      results.issues.push('Unmatched parentheses detected');
    }
    
    // Check for incomplete exports
    if (content.includes('export ') && !content.includes('export {') && !content.includes('export *') && !content.includes('export default') && !content.includes('export interface') && !content.includes('export type') && !content.includes('export class') && !content.includes('export function')) {
      results.issues.push('Potential export syntax issues detected');
    }
    
  } catch (error) {
    results.issues.push(`File analysis error: ${error.message}`);
  }

  return results;
}

function calculateScore(current, total, weight = 1) {
  return Math.round((current / total) * 100 * weight) / weight;
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

function verifyFileStructure() {
  logSection('📁 FILE STRUCTURE VERIFICATION');
  
  let totalFiles = Object.keys(EXPECTED_FILES).length;
  let createdFiles = 0;
  let structureIssues = [];

  for (const [filePath, expectedFile] of Object.entries(EXPECTED_FILES)) {
    if (checkFileExists(filePath)) {
      console.log(colorize(`✅ ${filePath}`, 'green'));
      createdFiles++;
    } else {
      console.log(colorize(`❌ ${filePath} - Missing`, 'red'));
      structureIssues.push(`Missing file: ${filePath}`);
    }
  }

  const structureScore = calculateScore(createdFiles, totalFiles);
  
  console.log(`\n📊 Structure Score: ${structureScore}%`);
  
  if (structureIssues.length > 0) {
    console.log(colorize('\n⚠️  Structure Issues:', 'yellow'));
    structureIssues.forEach(issue => console.log(`   - ${issue}`));
  }

  return { score: structureScore, issues: structureIssues };
}

function verifyFileQuality() {
  logSection('🔍 FILE QUALITY VERIFICATION');
  
  let totalQualityPoints = 0;
  let maxQualityPoints = 0;
  let qualityIssues = [];

  for (const [filePath, expectedFile] of Object.entries(EXPECTED_FILES)) {
    logSubsection(`Analyzing: ${filePath}`);
    
    const analysis = analyzeFileQuality(filePath, expectedFile);
    maxQualityPoints += 4; // 4 points max per file (exists, lines, patterns, syntax)
    
    if (analysis.exists) {
      console.log(colorize(`✅ File exists (${analysis.lineCount} lines)`, 'green'));
      totalQualityPoints += 1;
      
      if (analysis.meetsMinLines) {
        console.log(colorize(`✅ Meets minimum line requirement`, 'green'));
        totalQualityPoints += 1;
      } else {
        console.log(colorize(`❌ Below minimum lines (${analysis.lineCount}/${expectedFile.minLines})`, 'red'));
      }
      
      const patternScore = calculateScore(analysis.patternMatches, analysis.totalPatterns);
      if (patternScore >= 80) {
        console.log(colorize(`✅ Pattern matching (${analysis.patternMatches}/${analysis.totalPatterns})`, 'green'));
        totalQualityPoints += 1;
      } else {
        console.log(colorize(`⚠️  Pattern matching (${analysis.patternMatches}/${analysis.totalPatterns})`, 'yellow'));
        totalQualityPoints += 0.5;
      }
      
      if (analysis.issues.length <= 2) {
        console.log(colorize(`✅ Code quality check passed`, 'green'));
        totalQualityPoints += 1;
      } else {
        console.log(colorize(`⚠️  Potential syntax issues detected`, 'yellow'));
        totalQualityPoints += 0.5;
      }
      
      if (analysis.issues.length > 0) {
        qualityIssues.push(...analysis.issues.map(issue => `${filePath}: ${issue}`));
      }
    } else {
      console.log(colorize(`❌ File does not exist`, 'red'));
      qualityIssues.push(`${filePath}: File does not exist`);
    }
  }

  const qualityScore = calculateScore(totalQualityPoints, maxQualityPoints);
  console.log(`\n📊 Quality Score: ${qualityScore}%`);
  
  if (qualityIssues.length > 0) {
    console.log(colorize('\n⚠️  Quality Issues:', 'yellow'));
    qualityIssues.forEach(issue => console.log(`   - ${issue}`));
  }

  return { score: qualityScore, issues: qualityIssues };
}

function verifyRequirementsImplementation() {
  logSection('📋 REQUIREMENTS IMPLEMENTATION VERIFICATION');
  
  let implementedRequirements = 0;
  let totalRequirements = REQUIREMENTS_CHECKLIST.length;
  let requirementIssues = [];

  for (const requirement of REQUIREMENTS_CHECKLIST) {
    logSubsection(requirement.name);
    
    let requiredPatterns = requirement.patterns.length;
    let foundPatterns = 0;
    let missingPatterns = [];

    for (const pattern of requirement.patterns) {
      let patternFound = false;
      
      for (const filePath of requirement.files) {
        if (checkPatternInFile(filePath, pattern)) {
          patternFound = true;
          break;
        }
      }
      
      if (patternFound) {
        console.log(colorize(`✅ ${pattern}`, 'green'));
        foundPatterns++;
      } else {
        console.log(colorize(`❌ ${pattern}`, 'red'));
        missingPatterns.push(pattern);
      }
    }

    const completionRate = foundPatterns / requiredPatterns;
    if (completionRate >= 0.8) {
      implementedRequirements++;
      console.log(colorize(`✅ Requirement satisfied (${foundPatterns}/${requiredPatterns})`, 'green'));
    } else {
      console.log(colorize(`❌ Requirement incomplete (${foundPatterns}/${requiredPatterns})`, 'red'));
      requirementIssues.push(`${requirement.name}: Missing patterns - ${missingPatterns.join(', ')}`);
    }
  }

  const requirementsScore = calculateScore(implementedRequirements, totalRequirements);
  console.log(`\n📊 Requirements Score: ${requirementsScore}%`);
  
  if (requirementIssues.length > 0) {
    console.log(colorize('\n⚠️  Requirements Issues:', 'yellow'));
    requirementIssues.forEach(issue => console.log(`   - ${issue}`));
  }

  return { score: requirementsScore, issues: requirementIssues };
}

function verifyExportIntegration() {
  logSection('🔗 EXPORT INTEGRATION VERIFICATION');
  
  const indexPath = 'lib/mcp/index.ts';
  let exportScore = 0;
  let maxExportScore = EXPORT_INTEGRATION_PATTERNS.length;
  let exportIssues = [];

  if (!checkFileExists(indexPath)) {
    console.log(colorize(`❌ Index file missing: ${indexPath}`, 'red'));
    exportIssues.push(`Index file missing: ${indexPath}`);
    return { score: 0, issues: exportIssues };
  }

  console.log(colorize(`Checking exports in: ${indexPath}`, 'cyan'));

  for (const pattern of EXPORT_INTEGRATION_PATTERNS) {
    if (checkPatternInFile(indexPath, pattern)) {
      console.log(colorize(`✅ Export found: ${pattern}`, 'green'));
      exportScore++;
    } else {
      console.log(colorize(`❌ Export missing: ${pattern}`, 'red'));
      exportIssues.push(`Missing export: ${pattern}`);
    }
  }

  const integrationScore = calculateScore(exportScore, maxExportScore);
  console.log(`\n📊 Export Integration Score: ${integrationScore}%`);
  
  if (exportIssues.length > 0) {
    console.log(colorize('\n⚠️  Export Issues:', 'yellow'));
    exportIssues.forEach(issue => console.log(`   - ${issue}`));
  }

  return { score: integrationScore, issues: exportIssues };
}

function verifyTypeScriptIntegration() {
  logSection('🔷 TYPESCRIPT INTEGRATION VERIFICATION');
  
  let tsScore = 0;
  let maxTsScore = 3; // Build check, type exports, import validation
  let tsIssues = [];

  // Check TypeScript compilation
  logSubsection('TypeScript Compilation Check');
  try {
    console.log('Running TypeScript compilation check...');
    execSync('npx tsc --noEmit --skipLibCheck', { 
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    console.log(colorize('✅ TypeScript compilation successful', 'green'));
    tsScore++;
  } catch (error) {
    console.log(colorize('❌ TypeScript compilation failed', 'red'));
    tsIssues.push('TypeScript compilation errors detected');
  }

  // Check type exports
  logSubsection('Type Export Validation');
  const typePatterns = [
    'export interface FallbackManagerResult',
    'export interface DegradationLevelResult',
    'export interface FeatureAvailabilityResult',
    'export type FallbackStrategy',
    'export type OperationType',
    'export type DegradationLevel'
  ];

  let foundTypes = 0;
  for (const pattern of typePatterns) {
    let found = false;
    for (const filePath of Object.keys(EXPECTED_FILES)) {
      if (checkPatternInFile(filePath, pattern)) {
        found = true;
        break;
      }
    }
    if (found) foundTypes++;
  }

  if (foundTypes >= typePatterns.length * 0.8) {
    console.log(colorize(`✅ Type exports validation (${foundTypes}/${typePatterns.length})`, 'green'));
    tsScore++;
  } else {
    console.log(colorize(`❌ Type exports incomplete (${foundTypes}/${typePatterns.length})`, 'red'));
    tsIssues.push('Missing essential type exports');
  }

  // Check import compatibility
  logSubsection('Import Compatibility Check');
  const indexPath = 'lib/mcp/index.ts';
  if (checkFileExists(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes("export * from './utils/fallbackManager'") && 
        content.includes("export * from './hooks/fallbackHooks'")) {
      console.log(colorize('✅ Import structure is valid', 'green'));
      tsScore++;
    } else {
      console.log(colorize('❌ Import structure issues detected', 'red'));
      tsIssues.push('Import structure validation failed');
    }
  }

  const typeScriptScore = calculateScore(tsScore, maxTsScore);
  console.log(`\n📊 TypeScript Integration Score: ${typeScriptScore}%`);
  
  if (tsIssues.length > 0) {
    console.log(colorize('\n⚠️  TypeScript Issues:', 'yellow'));
    tsIssues.forEach(issue => console.log(`   - ${issue}`));
  }

  return { score: typeScriptScore, issues: tsIssues };
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

function runVerification() {
  console.log(colorize('🚀 Phase 2 Fallback Management Verification', 'bold'));
  console.log(colorize('📅 Subtask 28.5 - Phase 2: Graceful Degradation & Fallback Behavior', 'blue'));
  console.log(`🕒 Verification started at: ${new Date().toISOString()}`);

  const results = {
    structure: verifyFileStructure(),
    quality: verifyFileQuality(),
    requirements: verifyRequirementsImplementation(),
    exports: verifyExportIntegration(),
    typescript: verifyTypeScriptIntegration()
  };

  // Calculate overall score
  const weights = {
    structure: 0.15,
    quality: 0.25,
    requirements: 0.35,
    exports: 0.15,
    typescript: 0.10
  };

  const overallScore = Math.round(
    (results.structure.score * weights.structure) +
    (results.quality.score * weights.quality) +
    (results.requirements.score * weights.requirements) +
    (results.exports.score * weights.exports) +
    (results.typescript.score * weights.typescript)
  );

  // Final report
  logSection('📊 VERIFICATION SUMMARY');
  
  console.log(`📁 File Structure:           ${results.structure.score}%`);
  console.log(`🔍 File Quality:             ${results.quality.score}%`);
  console.log(`📋 Requirements:             ${results.requirements.score}%`);
  console.log(`🔗 Export Integration:       ${results.exports.score}%`);
  console.log(`🔷 TypeScript Integration:   ${results.typescript.score}%`);
  console.log('─'.repeat(40));
  console.log(colorize(`🎯 Overall Score: ${overallScore}%`, 'bold'));

  // Determine status
  let status, statusColor;
  if (overallScore >= 95) {
    status = 'EXCELLENT - PRODUCTION READY';
    statusColor = 'green';
  } else if (overallScore >= 85) {
    status = 'GOOD - MINOR IMPROVEMENTS NEEDED';
    statusColor = 'green';
  } else if (overallScore >= 70) {
    status = 'ACCEPTABLE - IMPROVEMENTS RECOMMENDED';
    statusColor = 'yellow';
  } else {
    status = 'NEEDS WORK - MAJOR ISSUES DETECTED';
    statusColor = 'red';
  }

  console.log(colorize(`\n🏆 Status: ${status}`, statusColor));

  // Collect all issues
  const allIssues = [
    ...results.structure.issues,
    ...results.quality.issues,
    ...results.requirements.issues,
    ...results.exports.issues,
    ...results.typescript.issues
  ];

  if (allIssues.length > 0) {
    console.log(colorize('\n⚠️  Issues to Address:', 'yellow'));
    allIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  console.log(`\n🕒 Verification completed at: ${new Date().toISOString()}`);
  
  // Exit with appropriate code
  if (overallScore >= 70) {
    console.log(colorize('\n✅ Phase 2 verification passed!', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('\n❌ Phase 2 verification failed. Please address the issues above.', 'red'));
    process.exit(1);
  }
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

// Check if running in correct directory
if (!fs.existsSync('package.json')) {
  console.error(colorize('❌ Error: This script must be run from the project root directory', 'red'));
  process.exit(1);
}

runVerification();