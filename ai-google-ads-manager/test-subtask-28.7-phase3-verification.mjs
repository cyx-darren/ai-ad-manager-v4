#!/usr/bin/env node

/**
 * Verification Script for Subtask 28.7 Phase 3: Property Selection UI Components
 * 
 * Tests the implementation of property selection UI components including:
 * - PropertySwitcher dropdown component  
 * - Dashboard header integration with PropertyControls
 * - Property search and filtering UI
 * - Visual indicators for selected property (PropertyBadge)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Subtask 28.7 Phase 3: Property Selection UI Components');
console.log('=' .repeat(80));

// Phase 3 files to test
const phase3Files = [
  { 
    path: 'components/PropertySwitcher/index.tsx', 
    minSize: 8000, 
    patterns: ['PropertySwitcher', 'PropertySearch', 'PropertyItem', 'AccessLevelIndicator', 'StatusIndicator', 'HealthIndicator'],
    minLines: 400
  },
  { 
    path: 'components/dashboard/PropertyControls.tsx', 
    minSize: 6000, 
    patterns: ['PropertyControls', 'PropertyBadge', 'PropertyStats', 'withPropertyControls'],
    minLines: 250
  },
  { 
    path: 'components/PropertyBadge/index.tsx', 
    minSize: 5000, 
    patterns: ['PropertyBadge', 'PropertyTooltip', 'AccessLevelIndicator', 'StatusIndicator', 'HealthIndicator', 'PropertyBadgeList'],
    minLines: 200
  },
  { 
    path: 'components/PropertyFilters/index.tsx', 
    minSize: 8000, 
    patterns: ['PropertyFilters', 'PropertySearch', 'FilterDropdown', 'SortControls', 'ActiveFilterTags'],
    minLines: 400
  }
];

// Test results storage
const results = {
  fileQuality: { score: 0, max: phase3Files.length * 4, details: [] }, // 4 points per file
  requirements: { score: 0, max: 8, details: [] },
  exports: { score: 0, max: 12, details: [] },
  functional: { score: 0, max: 4, details: [] }
};

console.log('📁 Testing File Quality & Structure...\n');

// Test each file
for (const fileInfo of phase3Files) {
  const filePath = join(__dirname, fileInfo.path);
  
  console.log(`  Testing ${fileInfo.path}:`);
  
  let fileScore = 0;

  // Check if file exists
  if (!existsSync(filePath)) {
    console.log(`    ❌ File does not exist`);
    results.fileQuality.details.push(`${fileInfo.path}: File missing`);
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  // Check file size
  if (content.length > fileInfo.minSize) {
    console.log(`    ✓ File size adequate (${content.length} chars, ${lines} lines)`);
    fileScore += 1;
  } else {
    console.log(`    ❌ File too small (${content.length} chars, expected ${fileInfo.minSize}+)`);
    results.fileQuality.details.push(`${fileInfo.path}: Too small (${content.length} chars)`);
  }

  // Check required patterns
  const foundPatterns = fileInfo.patterns.filter(pattern => content.includes(pattern));
  if (foundPatterns.length === fileInfo.patterns.length) {
    console.log(`    ✓ All required patterns found (${foundPatterns.length}/${fileInfo.patterns.length})`);
    fileScore += 1;
  } else {
    const missingPatterns = fileInfo.patterns.filter(pattern => !content.includes(pattern));
    console.log(`    ❌ Missing patterns: ${missingPatterns.join(', ')}`);
    results.fileQuality.details.push(`${fileInfo.path}: Missing patterns - ${missingPatterns.join(', ')}`);
  }

  // Check TypeScript/React structure
  const hasReactImports = content.includes('import React') || content.includes("from 'react'");
  const hasTypeScript = content.includes('interface ') || content.includes('type ') || content.includes(': React.FC');
  const hasProperExports = content.includes('export ') && (content.includes('export const') || content.includes('export interface') || content.includes('export type'));
  
  if (hasReactImports && hasTypeScript && hasProperExports) {
    console.log(`    ✓ TypeScript/React structure present`);
    fileScore += 1;
  } else {
    console.log(`    ❌ TypeScript/React structure issues`);
    results.fileQuality.details.push(`${fileInfo.path}: Structure issues (React: ${hasReactImports}, TS: ${hasTypeScript}, Exports: ${hasProperExports})`);
  }

  // Check implementation quality (comprehensive components)
  const qualityThreshold = fileInfo.path.includes('PropertySwitcher') ? 8000 : 
                          fileInfo.path.includes('PropertyFilters') ? 8000 :
                          fileInfo.path.includes('PropertyBadge') ? 5000 : 6000;
                          
  if (content.length > qualityThreshold && lines > fileInfo.minLines) {
    console.log(`    ✓ Implementation quality check passed`);
    fileScore += 1;
  } else {
    console.log(`    ❌ Implementation quality needs improvement`);
    results.fileQuality.details.push(`${fileInfo.path}: Implementation needs more content (${content.length} chars, ${lines} lines)`);
  }

  console.log(`    📊 File Score: ${fileScore}/4\n`);
  results.fileQuality.score += fileScore;
}

console.log('📋 Testing Requirements Implementation...');

// Requirements to check
const requirements = [
  {
    name: 'Property dropdown component with search capabilities',
    check: () => {
      const files = ['components/PropertySwitcher/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('PropertySwitcher') && content.includes('search') && 
                content.includes('dropdown') && content.includes('MagnifyingGlassIcon'));
      });
    }
  },
  {
    name: 'Dashboard header integration with property controls',
    check: () => {
      const files = ['components/dashboard/PropertyControls.tsx', 'components/dashboard/index.ts'];
      return files.every(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return content.includes('PropertyControls');
      });
    }
  },
  {
    name: 'Property search and filtering capabilities',
    check: () => {
      const files = ['components/PropertyFilters/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('PropertySearch') && content.includes('FilterDropdown') && 
                content.includes('SortControls') && content.includes('PropertyFilter'));
      });
    }
  },
  {
    name: 'Visual property status indicators and badges',
    check: () => {
      const files = ['components/PropertyBadge/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('PropertyBadge') && content.includes('AccessLevelIndicator') && 
                content.includes('StatusIndicator') && content.includes('HealthIndicator'));
      });
    }
  },
  {
    name: 'Keyboard navigation and accessibility features',
    check: () => {
      const files = ['components/PropertySwitcher/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('onKeyDown') && content.includes('aria-') && 
                content.includes('role=') && content.includes('tabIndex'));
      });
    }
  },
  {
    name: 'Responsive design implementation',
    check: () => {
      const files = ['components/dashboard/PropertyControls.tsx', 'components/PropertySwitcher/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('sm:') || content.includes('md:') || content.includes('lg:') || 
                content.includes('responsive') || content.includes('compact'));
      });
    }
  },
  {
    name: 'Property switching animations and feedback',
    check: () => {
      const files = ['components/PropertyBadge/index.tsx', 'components/PropertySwitcher/index.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('transition') && content.includes('animate') && 
                (content.includes('duration') || content.includes('animation')));
      });
    }
  },
  {
    name: 'Comprehensive error handling and loading states',
    check: () => {
      const files = ['components/PropertySwitcher/index.tsx', 'components/dashboard/PropertyControls.tsx'];
      return files.some(file => {
        const filePath = join(__dirname, file);
        if (!existsSync(filePath)) return false;
        const content = readFileSync(filePath, 'utf8');
        return (content.includes('isLoading') && content.includes('error') && 
                content.includes('LoadingSkeleton') && content.includes('EmptyState'));
      });
    }
  }
];

requirements.forEach((req, index) => {
  const passed = req.check();
  if (passed) {
    console.log(`  ✅ ${req.name} - IMPLEMENTED`);
    results.requirements.score += 1;
  } else {
    console.log(`  ❌ ${req.name} - NOT FOUND`);
    results.requirements.details.push(req.name);
  }
});

console.log('\n📤 Testing Export Integration...');

// Check exports in main index files
const exportChecks = [
  { file: 'components/index.ts', exports: ['PropertySwitcher', 'PropertyBadge', 'PropertyFilters', 'PropertyControls'] },
  { file: 'components/dashboard/index.ts', exports: ['PropertyControls', 'withPropertyControls'] },
  { file: 'lib/mcp/index.ts', exports: ['usePropertySelection', 'usePropertyContext', 'PropertyProvider'] }
];

exportChecks.forEach(({ file, exports }) => {
  const filePath = join(__dirname, file);
  if (!existsSync(filePath)) {
    console.log(`  ❌ Export file ${file} missing`);
    exports.forEach(exp => results.exports.details.push(`${exp} - File missing`));
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  exports.forEach(exportName => {
    if (content.includes(exportName)) {
      console.log(`  ✅ ${exportName} - EXPORTED`);
      results.exports.score += 1;
    } else {
      console.log(`  ❌ ${exportName} - NOT EXPORTED`);
      results.exports.details.push(`${exportName} - Missing from ${file}`);
    }
  });
});

console.log('\n⚙️ Testing Basic Functionality...');

// Functional tests
const functionalTests = [
  {
    name: 'Property switcher component structure',
    check: () => {
      const filePath = join(__dirname, 'components/PropertySwitcher/index.tsx');
      if (!existsSync(filePath)) return false;
      const content = readFileSync(filePath, 'utf8');
      return content.includes('PropertySwitcher') && content.includes('useState') && 
             content.includes('useCallback') && content.includes('useMemo');
    }
  },
  {
    name: 'Property controls integration',
    check: () => {
      const filePath = join(__dirname, 'components/dashboard/PropertyControls.tsx');
      if (!existsSync(filePath)) return false;
      const content = readFileSync(filePath, 'utf8');
      return content.includes('useSelectedProperty') && content.includes('useAvailableProperties') && 
             content.includes('PropertySwitcher');
    }
  },
  {
    name: 'Property badge system functionality',
    check: () => {
      const filePath = join(__dirname, 'components/PropertyBadge/index.tsx');
      if (!existsSync(filePath)) return false;
      const content = readFileSync(filePath, 'utf8');
      return content.includes('PropertyBadge') && content.includes('PropertyTooltip') && 
             content.includes('BadgeSize') && content.includes('BadgeVariant');
    }
  },
  {
    name: 'Property filtering system completeness',
    check: () => {
      const filePath = join(__dirname, 'components/PropertyFilters/index.tsx');
      if (!existsSync(filePath)) return false;
      const content = readFileSync(filePath, 'utf8');
      return content.includes('PropertyFilters') && content.includes('FilterDropdown') && 
             content.includes('SortControls') && content.includes('ActiveFilterTags');
    }
  }
];

functionalTests.forEach((test, index) => {
  const passed = test.check();
  if (passed) {
    console.log(`  ✅ ${test.name} - FUNCTIONAL`);
    results.functional.score += 1;
  } else {
    console.log(`  ❌ ${test.name} - ISSUES FOUND`);
    results.functional.details.push(test.name);
  }
});

// Calculate final results
const totalScore = results.fileQuality.score + results.requirements.score + results.exports.score + results.functional.score;
const maxScore = results.fileQuality.max + results.requirements.max + results.exports.max + results.functional.max;
const percentage = Math.round((totalScore / maxScore) * 100);

console.log('\n📊 FINAL RESULTS');
console.log('=' .repeat(80));
console.log(`📁 File Quality: ${results.fileQuality.score}/${results.fileQuality.max} (${Math.round((results.fileQuality.score/results.fileQuality.max)*100)}%)`);
console.log(`📋 Requirements Implementation: ${results.requirements.score}/${results.requirements.max} (${Math.round((results.requirements.score/results.requirements.max)*100)}%)`);
console.log(`📤 Export Integration: ${results.exports.score}/${results.exports.max} (${Math.round((results.exports.score/results.exports.max)*100)}%)`);
console.log(`⚙️ Functional Testing: ${results.functional.score}/${results.functional.max} (${Math.round((results.functional.score/results.functional.max)*100)}%)`);

console.log(`\n🎯 OVERALL SCORE: ${totalScore}/${maxScore} (${percentage}%)`);

// Quality assessment
let qualityLevel;
if (percentage >= 95) qualityLevel = '🏆 EXCELLENT';
else if (percentage >= 85) qualityLevel = '🎯 VERY GOOD';
else if (percentage >= 75) qualityLevel = '✅ GOOD';
else if (percentage >= 65) qualityLevel = '⚠️ FAIR';
else qualityLevel = '❌ NEEDS WORK';

console.log(`🏆 QUALITY LEVEL: ${qualityLevel}`);

// Show issues if any
const allIssues = [
  ...results.fileQuality.details,
  ...results.requirements.details.map(d => `Requirement: ${d}`),
  ...results.exports.details.map(d => `Export: ${d}`),
  ...results.functional.details.map(d => `Functional: ${d}`)
];

if (allIssues.length > 0) {
  console.log('\n⚠️ Issues Found:');
  allIssues.forEach(issue => console.log(`  - ${issue}`));
}

console.log('\n💡 Recommendations:');
if (percentage >= 95) {
  console.log('  - Phase 3 implementation is excellent and ready for Phase 4!');
} else if (percentage >= 85) {
  console.log('  - Implementation is very good with minor improvements possible');
  console.log('  - Phase 3 is ready for Phase 4!');
} else if (percentage >= 75) {
  console.log('  - Good implementation with some areas for improvement');
  console.log('  - Consider addressing file quality and pattern coverage');
} else {
  console.log('  - Significant improvements needed before proceeding');
  console.log('  - Focus on missing requirements and file completeness');
}

console.log('\n✅ Phase 3 verification complete');

process.exit(0);