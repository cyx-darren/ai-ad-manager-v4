const { spawn } = require('child_process');
const http = require('http');

console.log('🔗 Testing Health Endpoints');
console.log('============================\n');

// Start the server
console.log('🚀 Starting MCP server with health endpoints...');

const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { 
    ...process.env,
    GA4_PROPERTY_ID: 'test-property-12345',
    HEALTH_CHECK_PORT: '3003',
    HEALTH_CHECK_HOST: '0.0.0.0',
    ENABLE_HEALTH_METRICS: 'true',
    ENABLE_HEALTH_DIAGNOSTICS: 'true',
    // Provide valid-format but invalid credentials
    GOOGLE_CLIENT_EMAIL: 'test-service@test-project.iam.gserviceaccount.com',
    GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\ntest-key-that-will-fail-but-allows-server-startup\n-----END PRIVATE KEY-----',
    GOOGLE_PROJECT_ID: 'test-project-12345'
  }
});

let healthServerStarted = false;

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('Server:', output.trim());
  
  if (output.includes('🏥 HTTP Health server started on')) {
    healthServerStarted = true;
    console.log('\n✅ Health server detected, testing endpoints in 3 seconds...\n');
    
    setTimeout(testEndpoints, 3000);
  }
});

function testEndpoints() {
  console.log('📡 Testing Health Endpoints:');
  
  // Test each endpoint
  const endpoints = [
    { path: '/health', name: 'Health Check' },
    { path: '/status', name: 'Status' },
    { path: '/metrics', name: 'Metrics' },
    { path: '/diagnostics', name: 'Diagnostics' },
    { path: '/ping', name: 'Ping' }
  ];
  
  let completed = 0;
  const results = {};
  
  endpoints.forEach((endpoint, index) => {
    setTimeout(() => {
      console.log(`  🔍 Testing ${endpoint.name} (${endpoint.path})...`);
      
      const req = http.get(`http://localhost:3003${endpoint.path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            console.log(`    ✅ ${endpoint.name}: Status ${res.statusCode}, Response OK`);
            console.log(`       Data keys: ${Object.keys(jsonData).join(', ')}`);
            results[endpoint.path] = true;
          } catch (e) {
            console.log(`    ⚠️ ${endpoint.name}: Status ${res.statusCode}, Invalid JSON`);
            results[endpoint.path] = false;
          }
          
          completed++;
          if (completed === endpoints.length) {
            showResults(results);
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(`    ❌ ${endpoint.name}: ${error.message}`);
        results[endpoint.path] = false;
        
        completed++;
        if (completed === endpoints.length) {
          showResults(results);
        }
      });
      
      req.setTimeout(5000, () => {
        console.log(`    ⏰ ${endpoint.name}: Timeout`);
        req.destroy();
        results[endpoint.path] = false;
        
        completed++;
        if (completed === endpoints.length) {
          showResults(results);
        }
      });
      
    }, index * 500); // Stagger requests
  });
}

function showResults(results) {
  console.log('\n📊 ENDPOINT TEST RESULTS:');
  console.log('=========================');
  
  Object.entries(results).forEach(([path, success]) => {
    console.log(`${success ? '✅' : '❌'} ${path}: ${success ? 'WORKING' : 'FAILED'}`);
  });
  
  const successCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Result: ${successCount}/${totalCount} endpoints working`);
  
  if (successCount === totalCount) {
    console.log('🎉 All health endpoints are working correctly!');
  } else if (successCount > 0) {
    console.log('⚠️ Some endpoints working but some failed');
  } else {
    console.log('❌ No endpoints accessible');
  }
  
  console.log('\n🛑 Stopping server...');
  serverProcess.kill('SIGTERM');
  
  setTimeout(() => {
    process.exit(successCount === totalCount ? 0 : 1);
  }, 1000);
}

// Handle timeout
setTimeout(() => {
  if (!healthServerStarted) {
    console.log('⏰ Timeout: Health server did not start');
    serverProcess.kill('SIGTERM');
    process.exit(1);
  }
}, 10000);

// Handle server exit
serverProcess.on('close', (code) => {
  if (!healthServerStarted) {
    console.log('❌ Server exited before health server could start');
    process.exit(1);
  }
});

console.log('⏳ Waiting for health server to start...');