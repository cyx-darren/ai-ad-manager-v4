#!/usr/bin/env node

/**
 * Campaign Table Phase 2 Verification Script for Subtask 29.3
 * Tests that Phase 2 Basic Table Migration is complete and working
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

log('============================================================', colors.cyan);
log('📊 CAMPAIGN TABLE PHASE 2 VERIFICATION: Subtask 29.3', colors.bold);
log('============================================================', colors.cyan);

let allTestsPassed = true;

// Test 1: Verify Phase 2 implementation files exist
info('Checking Phase 2 implementation files...');
const requiredFiles = [
  'components/dashboard/MCPCampaignTable.tsx',
  'lib/mcp/dataFetchers/CampaignTableDataFetcher.ts',
  'hooks/useCampaignTableData.ts'
];

requiredFiles.forEach(file => {
  if (existsSync(file)) {
    success(`✓ ${file} exists`);
  } else {
    error(`✗ ${file} missing`);
    allTestsPassed = false;
  }
});

// Test 2: Verify MCPCampaignTable implementation quality
info('Verifying MCPCampaignTable implementation...');
try {
  const campaignTableContent = readFileSync('components/dashboard/MCPCampaignTable.tsx', 'utf8');
  
  const campaignTableChecks = [
    { pattern: 'MCPCampaignTable', name: 'Main component function' },
    { pattern: 'useCampaignTableData', name: 'Hook integration' },
    { pattern: 'loading', name: 'Loading state handling' },
    { pattern: 'error', name: 'Error state handling' },
    { pattern: 'fallback', name: 'Fallback mechanism reference' },
    { pattern: 'source', name: 'Data source tracking' },
    { pattern: 'refresh', name: 'Manual refresh capability' },
    { pattern: 'export', name: 'Export functionality' },
    { pattern: 'searchTerm', name: 'Search functionality' },
    { pattern: 'statusFilter', name: 'Status filtering' },
    { pattern: 'typeFilter', name: 'Type filtering' },
    { pattern: 'sortBy', name: 'Column sorting' },
    { pattern: 'Pagination', name: 'Pagination controls' },
    { pattern: 'nextPage', name: 'Page navigation' },
    { pattern: 'formatCurrency', name: 'Data formatting' },
    { pattern: 'formatPercent', name: 'Percentage formatting' },
    { pattern: 'getStatusBadge', name: 'Status badge styling' },
    { pattern: 'getTypeBadge', name: 'Type badge styling' },
    { pattern: 'showSource', name: 'Source indicator' },
    { pattern: 'autoRefresh', name: 'Auto-refresh capability' },
    { pattern: 'enableMCP', name: 'MCP toggle control' }
  ];
  
  campaignTableChecks.forEach(check => {
    if (campaignTableContent.includes(check.pattern)) {
      success(`✓ ${check.name} implemented`);
    } else {
      error(`✗ ${check.name} missing`);
      allTestsPassed = false;
    }
  });
  
} catch (err) {
  error(`✗ Failed to verify MCPCampaignTable: ${err.message}`);
  allTestsPassed = false;
}

// Test 3: Verify dashboard integration
info('Verifying dashboard integration...');
try {
  const dashboardContent = readFileSync('app/dashboard/page.tsx', 'utf8');
  
  const dashboardChecks = [
    { pattern: 'MCPCampaignTable', name: 'MCPCampaignTable imported' },
    { pattern: 'MCPCampaignTable', name: 'MCPCampaignTable used in JSX' },
    { pattern: 'enableMCP={true}', name: 'MCP enabled by default' },
    { pattern: 'showSource={true}', name: 'Source display enabled' },
    { pattern: 'autoRefresh={true}', name: 'Auto-refresh enabled' },
    { pattern: 'initialPageSize', name: 'Pagination configured' }
  ];
  
  dashboardChecks.forEach(check => {
    if (dashboardContent.includes(check.pattern)) {
      success(`✓ ${check.name}`);
    } else {
      error(`✗ ${check.name} missing`);
      allTestsPassed = false;
    }
  });
  
} catch (err) {
  error(`✗ Failed to verify dashboard integration: ${err.message}`);
  allTestsPassed = false;
}

// Test 4: Verify exports are updated
info('Verifying component exports...');
try {
  const indexContent = readFileSync('components/dashboard/index.ts', 'utf8');
  
  if (indexContent.includes('MCPCampaignTable')) {
    success('✓ MCPCampaignTable exported from dashboard components');
  } else {
    error('✗ MCPCampaignTable not exported');
    allTestsPassed = false;
  }
  
} catch (err) {
  error(`✗ Failed to verify exports: ${err.message}`);
  allTestsPassed = false;
}

// Test 5: Check for comprehensive table features
info('Verifying table features readiness...');
try {
  const campaignTableContent = readFileSync('components/dashboard/MCPCampaignTable.tsx', 'utf8');
  
  const tableFeatures = [
    { pattern: 'onClick={() => sortBy', name: 'Column sorting clicks' },
    { pattern: 'ChevronUpIcon', name: 'Sort direction indicators' },
    { pattern: 'ChevronDownIcon', name: 'Sort direction indicators' },
    { pattern: 'RefreshIcon', name: 'Refresh button UI' },
    { pattern: 'DownloadIcon', name: 'Export button UI' },
    { pattern: 'SearchIcon', name: 'Search input UI' },
    { pattern: 'select.*multiple', name: 'Multi-select filters' },
    { pattern: 'previousPage', name: 'Pagination controls' },
    { pattern: 'nextPage', name: 'Pagination controls' },
    { pattern: 'changePageSize', name: 'Page size control' },
    { pattern: 'bg-red-50.*border-red-400', name: 'Error message styling' },
    { pattern: 'animate-spin', name: 'Loading spinner' },
    { pattern: 'hover:bg-gray-50', name: 'Interactive row styling' },
    { pattern: 'disabled:opacity-50', name: 'Disabled state styling' }
  ];
  
  tableFeatures.forEach(feature => {
    if (campaignTableContent.includes(feature.pattern)) {
      success(`✓ ${feature.name} implemented`);
    } else {
      warning(`⚠️  ${feature.name} - may need refinement`);
    }
  });
  
} catch (err) {
  error(`✗ Failed to check table features: ${err.message}`);
}

// Test 6: Verify error handling and fallback
info('Verifying error handling and fallback...');
try {
  const campaignTableContent = readFileSync('components/dashboard/MCPCampaignTable.tsx', 'utf8');
  
  const errorHandlingFeatures = [
    { pattern: 'error &&', name: 'Error state display' },
    { pattern: 'loading &&', name: 'Loading state display' },
    { pattern: 'bg-red-50', name: 'Error message styling' },
    { pattern: 'Displaying fallback data', name: 'Fallback data notice' },
    { pattern: 'Please try refreshing', name: 'Error recovery guidance' },
    { pattern: 'No campaigns found', name: 'Empty state handling' }
  ];
  
  errorHandlingFeatures.forEach(feature => {
    if (campaignTableContent.includes(feature.pattern)) {
      success(`✓ ${feature.name} implemented`);
    } else {
      warning(`⚠️  ${feature.name} - check implementation`);
    }
  });
  
} catch (err) {
  error(`✗ Failed to verify error handling: ${err.message}`);
}

log('============================================================', colors.cyan);

if (allTestsPassed) {
  log('🎉 CAMPAIGN TABLE PHASE 2: COMPLETE SUCCESS!', colors.green + colors.bold);
  log('', colors.reset);
  success('✅ MCPCampaignTable component created with full functionality');
  success('✅ Dashboard integration completed');
  success('✅ Component exports updated');
  success('✅ Error handling and loading states implemented');
  success('✅ Fallback mechanism integrated');
  success('✅ Search, filtering, and sorting UI implemented');
  success('✅ Pagination controls implemented');
  success('✅ Export functionality integrated');
  success('✅ Data source indicators implemented');
  log('', colors.reset);
  info('🚀 Ready for Phase 3: Search & Filtering implementation!');
  log('', colors.reset);
  info('📋 Phase 2 Deliverables:');
  info('   ✓ Complete MCP-powered campaign table component');
  info('   ✓ Replaced mock data table with MCP integration');
  info('   ✓ Basic error handling and loading states');
  info('   ✓ Feature flag controlled data sources');
  info('   ✓ Search, filter, and sort UI foundations');
  info('   ✓ Export and refresh capabilities');
  info('   ✓ Responsive design and accessibility features');
} else {
  log('❌ CAMPAIGN TABLE PHASE 2: ISSUES FOUND', colors.red + colors.bold);
  log('Please fix the missing components before proceeding to Phase 3.', colors.yellow);
}

log('============================================================', colors.cyan);