#!/usr/bin/env node

// Test the real APNs functionality with the fixed .p8 key
import http from 'http';

console.log('🔥 Testing Real APNs with Fixed .p8 Key');
console.log('=====================================');

async function testRealAPNs() {
  try {
    console.log('1. Checking server status...');
    const healthResponse = await makeRequest('/api/health');
    
    if (healthResponse.status === 200) {
      console.log('   ✅ Server is running');
      
      console.log('\n2. Testing push notification (should use real APNs now)...');
      const pushResponse = await makeRequest('/api/notifications/test', 'POST', {
        title: 'Real APNs Test',
        body: 'Testing with fixed .p8 key file'
      });
      
      console.log(`   Response Status: ${pushResponse.status}`);
      console.log(`   Response Body: ${pushResponse.body}`);
      
      if (pushResponse.status === 200) {
        console.log('   ✅ Push notification endpoint working');
      } else if (pushResponse.status === 400) {
        console.log('   ℹ️  No device tokens registered (expected in development)');
        console.log('   💡 Check server logs to see if real APNs is being used');
      } else {
        console.log('   ⚠️  Unexpected response status');
      }
      
    } else {
      console.log('   ❌ Server not responding properly');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('💡 Make sure server is running: NODE_ENV=development npx tsx server/index-standalone.ts');
  }
}

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

testRealAPNs().catch(console.error);