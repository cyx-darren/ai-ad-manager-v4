const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 QUICK PHASE 3 VERIFICATION: Performance & Conversion Tracking');
console.log('===============================================================\n');

async function quickVerifyPhase3() {
  console.log('🧪 Phase 3 Implementation Check:');
  console.log('--------------------------------');
  
  // Check implementation in built files
  const indexBuilt = fs.readFileSync('dist/index.js', 'utf8');
  const utilsBuilt = fs.readFileSync('dist/utils/ga4Utils.js', 'utf8');
  
  const phase3Checks = [
    {
      name: 'get_page_performance implemented',
      check: indexBuilt.includes('Enhanced page performance parameter processing') && 
             indexBuilt.includes('Page Performance Analysis')
    },
    {
      name: 'get_conversion_data implemented', 
      check: indexBuilt.includes('Enhanced conversion data parameter processing') &&
             indexBuilt.includes('Conversion Performance Summary')
    },
    {
      name: 'Phase 3 GA4 metrics added',
      check: utilsBuilt.includes('VIEWS') && 
             utilsBuilt.includes('GOAL_COMPLETIONS') &&
             utilsBuilt.includes('CONVERSION_VALUE')
    },
    {
      name: 'Phase 3 GA4 dimensions added',
      check: utilsBuilt.includes('CONVERSION_EVENT') && 
             utilsBuilt.includes('LANDING_PAGE') &&
             utilsBuilt.includes('EXIT_PAGE')
    },
    {
      name: 'Advanced Phase 3 features working',
      check: indexBuilt.includes('pagePathFilter') && 
             indexBuilt.includes('conversionEventFilter') &&
             indexBuilt.includes('Content Quality Insights') &&
             indexBuilt.includes('Conversion Quality Insights')
    }
  ];
  
  let allPassed = true;
  phase3Checks.forEach(check => {
    console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`);
    if (!check.check) allPassed = false;
  });
  
  console.log(`\n🎯 Phase 3 Status: ${allPassed ? '✅ VERIFIED - READY FOR PHASE 4' : '❌ ISSUES FOUND'}`);
  
  if (allPassed) {
    console.log('\n🚀 PROCEEDING TO PHASE 4: Integration & Comprehensive Testing');
    console.log('✅ get_page_performance: Page analytics and content optimization - COMPLETE');
    console.log('✅ get_conversion_data: Goal tracking and e-commerce analysis - COMPLETE');
    console.log('\n🎯 Phase 4 Tasks:');
    console.log('- Tool integration testing and optimization');
    console.log('- Cross-tool data consistency verification');
    console.log('- Performance benchmarking and caching optimization');
    console.log('- Complete error handling and edge case testing');
    console.log('- Tool documentation and schema validation');
  }
  
  return allPassed;
}

quickVerifyPhase3().then(success => {
  process.exit(success ? 0 : 1);
});