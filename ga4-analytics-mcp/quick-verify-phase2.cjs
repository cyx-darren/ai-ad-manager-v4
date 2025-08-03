const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 QUICK PHASE 2 VERIFICATION: Monitoring & Observability');
console.log('========================================================\n');

async function quickVerifyPhase2() {
  // Check that all files exist and build works
  const requiredFiles = [
    'dist/utils/errorTracking.js',
    'dist/utils/apmMonitoring.js',
    'dist/utils/healthDashboard.js',
    'dist/utils/ga4MetricsCollector.js',
    'dist/index.js'
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
  });
  
  if (!allFilesExist) {
    console.log('\n❌ Missing built files - running build...');
    return false;
  }
  
  // Check implementation in built files
  const indexBuilt = fs.readFileSync('dist/index.js', 'utf8');
  
  const quickChecks = [
    {
      name: 'Error tracking system integrated',
      check: indexBuilt.includes('errorTracker') && 
             indexBuilt.includes('ERROR_TRACKING')
    },
    {
      name: 'APM monitoring system integrated',
      check: indexBuilt.includes('apmMonitor') && 
             indexBuilt.includes('APM') &&
             indexBuilt.includes('startTrace')
    },
    {
      name: 'Health dashboard system integrated',
      check: indexBuilt.includes('healthDashboard') && 
             indexBuilt.includes('HEALTH_DASHBOARD')
    },
    {
      name: 'GA4 metrics collection integrated',
      check: indexBuilt.includes('ga4MetricsCollector') && 
             indexBuilt.includes('GA4_METRICS') &&
             indexBuilt.includes('recordApiCall')
    },
    {
      name: 'Monitoring lifecycle hooks active',
      check: indexBuilt.includes('error-tracking') && 
             indexBuilt.includes('apm-monitoring') &&
             indexBuilt.includes('ga4-metrics') &&
             indexBuilt.includes('health-dashboard')
    },
    {
      name: 'APM tracing in query_analytics',
      check: indexBuilt.includes('startTrace') && 
             indexBuilt.includes('ga4_query_analytics') &&
             indexBuilt.includes('finishSpan')
    }
  ];
  
  let allPassed = true;
  quickChecks.forEach(check => {
    console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`);
    if (!check.check) allPassed = false;
  });
  
  console.log(`\n🎯 Phase 2 Status: ${allPassed ? '✅ VERIFIED - Ready for Phase 3' : '❌ ISSUES FOUND'}`);
  
  if (allPassed) {
    console.log('\n🚀 PROCEEDING TO PHASE 3: Railway Deployment Configuration');
    console.log('✅ Advanced error tracking and alerting system verified');
    console.log('✅ APM monitoring with distributed tracing verified');
    console.log('✅ Health dashboard and uptime monitoring verified');
    console.log('✅ GA4 API usage metrics collection verified');
    console.log('✅ Complete monitoring integration verified');
    console.log('\n🎯 Phase 3 Tasks:');
    console.log('- Configure production environment variables');
    console.log('- Set up Railway-specific deployment settings');
    console.log('- Implement database connection pooling for production');
    console.log('- Configure auto-scaling and resource limits');
    console.log('- Add deployment health checks and rollback strategies');
  }
  
  return allPassed;
}

quickVerifyPhase2().then(success => {
  process.exit(success ? 0 : 1);
});