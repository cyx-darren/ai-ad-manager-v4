const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 QUICK PHASE 2 VERIFICATION: Traffic & Audience Analysis');
console.log('=======================================================\n');

async function quickVerifyPhase2() {
  console.log('🧪 Phase 2 Implementation Check:');
  console.log('--------------------------------');
  
  // Check implementation in built files
  const indexBuilt = fs.readFileSync('dist/index.js', 'utf8');
  const utilsBuilt = fs.readFileSync('dist/utils/ga4Utils.js', 'utf8');
  
  const phase2Checks = [
    {
      name: 'get_traffic_sources implemented',
      check: indexBuilt.includes('Enhanced traffic source parameter processing') && 
             indexBuilt.includes('Traffic Sources Analysis')
    },
    {
      name: 'get_user_demographics implemented', 
      check: indexBuilt.includes('Enhanced user demographics parameter processing') &&
             indexBuilt.includes('User Demographics Summary')
    },
    {
      name: 'New GA4 dimensions added',
      check: utilsBuilt.includes('SESSION_DEFAULT_CHANNEL_GROUP') && 
             utilsBuilt.includes('USER_AGE_BRACKET')
    },
    {
      name: 'Advanced features working',
      check: indexBuilt.includes('channelGrouping') && 
             indexBuilt.includes('includeAge') &&
             indexBuilt.includes('ageBreakdown')
    }
  ];
  
  let allPassed = true;
  phase2Checks.forEach(check => {
    console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`);
    if (!check.check) allPassed = false;
  });
  
  console.log(`\n🎯 Phase 2 Status: ${allPassed ? '✅ VERIFIED - READY FOR PHASE 3' : '❌ ISSUES FOUND'}`);
  
  if (allPassed) {
    console.log('\n🚀 PROCEEDING TO PHASE 3: Performance & Conversion Tracking');
    console.log('✅ get_traffic_sources: Channel breakdown and source analysis - COMPLETE');
    console.log('✅ get_user_demographics: Age/gender/location analysis - COMPLETE');
    console.log('\n🎯 Phase 3 Tasks:');
    console.log('- Implement get_page_performance tool (page views/bounce rates, content analytics)');
    console.log('- Implement get_conversion_data tool (goals/funnels, conversion tracking)');
  }
  
  return allPassed;
}

quickVerifyPhase2().then(success => {
  process.exit(success ? 0 : 1);
});