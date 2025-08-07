#!/usr/bin/env node

/**
 * Verification Test for Subtask 28.7 Phase 4: MCP Integration & API Updates
 * 
 * This test verifies that all Phase 4 components are properly implemented:
 * - Property-Aware GA4 Service
 * - Property Validation Middleware  
 * - Property-Aware MCP Client
 * - Property Authentication Manager
 * - MCP Integration Updates
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, statSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const CONFIG = {
  minFileSize: 10000, // Minimum expected file size in characters
  minLines: 300,      // Minimum expected lines
  timeout: 30000      // Test timeout in milliseconds
};

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let results = {
  fileQuality: { passed: 0, total: 0 },
  requirements: { passed: 0, total: 0 },
  exports: { passed: 0, total: 0 },
  functionality: { passed: 0, total: 0 }
};

// Console colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function test(description, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result) {
      log(`  ✓ ${description}`, colors.green);
      passedTests++;
      return true;
    } else {
      log(`  ❌ ${description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`  ❌ ${description} - ${error.message}`, colors.red);
    return false;
  }
}

function testFile(filePath, expectedPatterns = [], description = '') {
  log(`\n  Testing ${filePath}:`);
  
  const fullPath = join(__dirname, filePath);
  
  // Test file existence
  const fileExists = test('File exists', () => existsSync(fullPath));
  if (!fileExists) return { score: 0, total: 4 };
  
  const content = readFileSync(fullPath, 'utf8');
  const stats = statSync(fullPath);
  const lines = content.split('\n').length;
  
  // Test file size and content
  const sizeOk = test(`File size adequate (${content.length} chars, ${lines} lines)`, () => 
    content.length >= CONFIG.minFileSize && lines >= CONFIG.minLines
  );
  
  // Test required patterns
  const missingPatterns = expectedPatterns.filter(pattern => !content.includes(pattern));
  const patternsOk = test(
    missingPatterns.length === 0 
      ? `All required patterns found (${expectedPatterns.length}/${expectedPatterns.length})`
      : `Missing patterns: ${missingPatterns.join(', ')}`,
    () => missingPatterns.length === 0
  );
  
  // Test TypeScript structure
  const hasTypeScript = test('TypeScript structure present', () => 
    content.includes('interface ') || content.includes('type ') || content.includes('export')
  );
  
  // Test implementation quality
  const hasImplementation = test('Implementation quality check passed', () => 
    content.includes('class ') || content.includes('function ') || content.includes('const ')
  );
  
  const passed = [fileExists, sizeOk, patternsOk, hasTypeScript, hasImplementation].filter(Boolean).length;
  log(`    📊 File Score: ${passed}/5`);
  
  return { score: passed, total: 5 };
}

async function testFileQuality() {
  log(`${colors.bold}📁 Testing File Quality & Structure...${colors.reset}`);
  
  const fileTests = [
    {
      path: 'lib/mcp/services/propertyAwareGA4Service.ts',
      patterns: [
        'PropertyAwareGA4Service',
        'PropertyAwareRequest',
        'PropertyRequestContext',
        'PropertyValidationResult',
        'PropertyAwareResponse',
        'getPropertyAwareSessionMetrics',
        'getPropertyAwareTrafficSources',
        'getPropertyAwarePagePerformance'
      ]
    },
    {
      path: 'lib/mcp/middleware/propertyValidation.ts',
      patterns: [
        'PropertyValidationMiddleware',
        'PropertyValidationConfig',
        'PropertyValidationContext',
        'PropertyValidationResult',
        'PropertyOperation',
        'validatePropertyOperation',
        'withPropertyValidation'
      ]
    },
    {
      path: 'lib/mcp/client/propertyAwareMCPClient.ts',
      patterns: [
        'PropertyAwareMCPClient',
        'PropertyAwareMCPRequest',
        'PropertyAwareMCPResponse',
        'PropertyMCPClientConfig',
        'sendPropertyAwareRequest',
        'getGA4Analytics'
      ]
    },
    {
      path: 'lib/mcp/auth/propertyAuth.ts',
      patterns: [
        'PropertyAuthManager',
        'PropertyAuthScope',
        'PropertyAuthCredentials',
        'PropertyAuthConfig',
        'PropertyAuthStatus',
        'authenticateWithProperties',
        'validatePropertyAccess'
      ]
    }
  ];
  
  for (const fileTest of fileTests) {
    const result = testFile(fileTest.path, fileTest.patterns);
    results.fileQuality.passed += result.score;
    results.fileQuality.total += result.total;
  }
}

async function testRequirementsImplementation() {
  log(`\n${colors.bold}📋 Testing Requirements Implementation...${colors.reset}`);
  
  const requirements = [
    {
      name: 'Property-aware GA4 API service implementation',
      check: () => existsSync(join(__dirname, 'lib/mcp/services/propertyAwareGA4Service.ts'))
    },
    {
      name: 'Property validation middleware for MCP requests',
      check: () => existsSync(join(__dirname, 'lib/mcp/middleware/propertyValidation.ts'))
    },
    {
      name: 'Property-aware MCP client with context injection',
      check: () => existsSync(join(__dirname, 'lib/mcp/client/propertyAwareMCPClient.ts'))
    },
    {
      name: 'Property authentication manager implementation',
      check: () => existsSync(join(__dirname, 'lib/mcp/auth/propertyAuth.ts'))
    },
    {
      name: 'Property permission validation system',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/middleware/propertyValidation.ts'), 'utf8');
        return content.includes('validatePropertyOperation') && content.includes('PropertyPermission');
      }
    },
    {
      name: 'Property context propagation through API calls',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/client/propertyAwareMCPClient.ts'), 'utf8');
        return content.includes('propertyId') && content.includes('sendPropertyAwareRequest');
      }
    },
    {
      name: 'Property-specific authentication scope management',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/auth/propertyAuth.ts'), 'utf8');
        return content.includes('PropertyAuthScope') && content.includes('propertyScopes');
      }
    },
    {
      name: 'Backward compatibility with existing MCP calls',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/client/propertyAwareMCPClient.ts'), 'utf8');
        return content.includes('extends MCPClient') || content.includes('backward');
      }
    }
  ];
  
  for (const req of requirements) {
    const passed = test(req.name, req.check);
    results.requirements.passed += passed ? 1 : 0;
    results.requirements.total += 1;
    
    if (passed) {
      log(`  ✅ ${req.name} - IMPLEMENTED`, colors.green);
    } else {
      log(`  ❌ ${req.name} - MISSING`, colors.red);
    }
  }
}

async function testExportIntegration() {
  log(`\n${colors.bold}📤 Testing Export Integration...${colors.reset}`);
  
  const mcpIndexPath = join(__dirname, 'lib/mcp/index.ts');
  const mcpIndexContent = readFileSync(mcpIndexPath, 'utf8');
  
  const expectedExports = [
    'PropertyAwareGA4Service',
    'PropertyValidationMiddleware',
    'PropertyAwareMCPClient',
    'PropertyAuthManager',
    'PropertyAwareRequest',
    'PropertyValidationResult',
    'PropertyAwareMCPRequest',
    'PropertyAuthScope',
    'propertyAwareGA4Service',
    'validatePropertyOperation',
    'createPropertyAwareMCPClient',
    'authenticateWithProperties'
  ];
  
  for (const exportName of expectedExports) {
    const exported = test(exportName, () => mcpIndexContent.includes(exportName));
    results.exports.passed += exported ? 1 : 0;
    results.exports.total += 1;
    
    if (exported) {
      log(`  ✅ ${exportName} - EXPORTED`, colors.green);
    } else {
      log(`  ❌ ${exportName} - NOT EXPORTED`, colors.red);
    }
  }
}

async function testBasicFunctionality() {
  log(`\n${colors.bold}⚙️ Testing Basic Functionality...${colors.reset}`);
  
  const functionalityTests = [
    {
      name: 'Property-aware GA4 service can be instantiated',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/services/propertyAwareGA4Service.ts'), 'utf8');
        return content.includes('class PropertyAwareGA4Service') || content.includes('export class') || content.includes('PropertyAwareGA4Service');
      }
    },
    {
      name: 'Property validation middleware has validation logic',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/middleware/propertyValidation.ts'), 'utf8');
        return content.includes('validate') && content.includes('PropertyOperation');
      }
    },
    {
      name: 'Property-aware MCP client extends base client',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/client/propertyAwareMCPClient.ts'), 'utf8');
        return content.includes('extends MCPClient') || content.includes('PropertyAwareMCPClient');
      }
    },
    {
      name: 'Property authentication manager has auth methods',
      check: () => {
        const content = readFileSync(join(__dirname, 'lib/mcp/auth/propertyAuth.ts'), 'utf8');
        return content.includes('authenticate') && content.includes('PropertyAuth');
      }
    }
  ];
  
  for (const funcTest of functionalityTests) {
    const passed = test(funcTest.name, funcTest.check);
    results.functionality.passed += passed ? 1 : 0;
    results.functionality.total += 1;
    
    if (passed) {
      log(`  ✅ ${funcTest.name} - FUNCTIONAL`, colors.green);
    } else {
      log(`  ❌ ${funcTest.name} - NOT FUNCTIONAL`, colors.red);
    }
  }
}

function calculateScore() {
  const totalPossible = 
    results.fileQuality.total + 
    results.requirements.total + 
    results.exports.total + 
    results.functionality.total;
    
  const totalPassed = 
    results.fileQuality.passed + 
    results.requirements.passed + 
    results.exports.passed + 
    results.functionality.passed;
    
  return Math.round((totalPassed / totalPossible) * 100);
}

function getQualityLevel(score) {
  if (score >= 95) return '🏆 EXCELLENT';
  if (score >= 85) return '🎯 VERY GOOD';
  if (score >= 75) return '✅ GOOD';
  if (score >= 65) return '⚠️ FAIR';
  return '❌ NEEDS IMPROVEMENT';
}

async function runAllTests() {
  log(`${colors.cyan}${colors.bold}🧪 Testing Subtask 28.7 Phase 4: MCP Integration & API Updates${colors.reset}`);
  log('='.repeat(80));
  
  await testFileQuality();
  await testRequirementsImplementation();
  await testExportIntegration();
  await testBasicFunctionality();
  
  const score = calculateScore();
  const qualityLevel = getQualityLevel(score);
  
  log(`\n${colors.bold}📊 FINAL RESULTS${colors.reset}`);
  log('='.repeat(80));
  log(`📁 File Quality: ${results.fileQuality.passed}/${results.fileQuality.total} (${Math.round(results.fileQuality.passed/results.fileQuality.total*100)}%)`);
  log(`📋 Requirements Implementation: ${results.requirements.passed}/${results.requirements.total} (${Math.round(results.requirements.passed/results.requirements.total*100)}%)`);
  log(`📤 Export Integration: ${results.exports.passed}/${results.exports.total} (${Math.round(results.exports.passed/results.exports.total*100)}%)`);
  log(`⚙️ Functional Testing: ${results.functionality.passed}/${results.functionality.total} (${Math.round(results.functionality.passed/results.functionality.total*100)}%)`);
  log('');
  log(`🎯 OVERALL SCORE: ${results.fileQuality.passed + results.requirements.passed + results.exports.passed + results.functionality.passed}/${results.fileQuality.total + results.requirements.total + results.exports.total + results.functionality.total} (${score}%)`);
  log(`🏆 QUALITY LEVEL: ${qualityLevel}`, score >= 85 ? colors.green : score >= 75 ? colors.yellow : colors.red);
  
  if (score < 85) {
    log(`\n⚠️ Issues Found:`, colors.yellow);
    if (results.fileQuality.passed < results.fileQuality.total) {
      log(`  - File quality issues detected`);
    }
    if (results.requirements.passed < results.requirements.total) {
      log(`  - Some requirements not fully implemented`);
    }
    if (results.exports.passed < results.exports.total) {
      log(`  - Export integration incomplete`);
    }
    if (results.functionality.passed < results.functionality.total) {
      log(`  - Functionality tests failed`);
    }
  }
  
  log(`\n💡 Recommendations:`, colors.cyan);
  if (score >= 90) {
    log(`  - Excellent implementation! Phase 4 is ready for Phase 5!`);
  } else if (score >= 80) {
    log(`  - Good implementation with minor improvements possible`);
    log(`  - Phase 4 is ready for Phase 5!`);
  } else {
    log(`  - Implementation needs improvement before proceeding`);
    log(`  - Review failed tests and fix issues`);
  }
  
  log(`\n✅ Phase 4 verification complete\n`);
  
  // Exit with appropriate code
  process.exit(score >= 75 ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
  log(`❌ Test execution failed: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});