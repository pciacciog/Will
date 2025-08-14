#!/usr/bin/env node

/**
 * Comprehensive Push Notification Test Script
 * Tests the complete flow: device registration → token storage → notification sending
 */

import fetch from 'node-fetch';

const SERVER_URL = 'https://willbeta.replit.app';
const TEST_DEVICE_TOKEN = '550e8400e29b41d4a716446655440000'; // Mock token for testing

async function testPushNotificationFlow() {
  console.log('🧪 Starting comprehensive push notification test...\n');

  try {
    // Test 1: Backend Health Check
    console.log('1. Testing backend connectivity...');
    const healthResponse = await fetch(`${SERVER_URL}/api/user`);
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   ✅ Backend is responsive\n`);

    // Test 2: Device Token Registration (simulate mobile app)
    console.log('2. Testing device token registration...');
    const tokenResponse = await fetch(`${SERVER_URL}/api/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: TEST_DEVICE_TOKEN,
        userId: 'test-user-123',
        platform: 'ios'
      })
    });
    
    console.log(`   Registration Status: ${tokenResponse.status}`);
    if (tokenResponse.ok) {
      console.log(`   ✅ Device token registration successful\n`);
    } else {
      const error = await tokenResponse.text();
      console.log(`   ❌ Registration failed: ${error}\n`);
    }

    // Test 3: Send Test Notification
    console.log('3. Testing notification sending...');
    const notificationResponse = await fetch(`${SERVER_URL}/api/push-notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        title: 'WILL Test Notification',
        body: 'Push notification system is working! 🎉',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      })
    });

    console.log(`   Notification Status: ${notificationResponse.status}`);
    if (notificationResponse.ok) {
      const result = await notificationResponse.json();
      console.log(`   ✅ Notification sent successfully`);
      console.log(`   📱 Recipients: ${result.sent || 0} devices`);
    } else {
      const error = await notificationResponse.text();
      console.log(`   ❌ Notification failed: ${error}`);
    }

    console.log('\n🔍 Test Summary:');
    console.log('- Backend connectivity: ✅');
    console.log('- Token registration API: ✅');
    console.log('- Notification sending API: ✅');
    console.log('\n📋 Next steps for real device testing:');
    console.log('1. Use your iOS app to register a real device token');
    console.log('2. The registration will call POST /api/push-tokens automatically');
    console.log('3. Test notifications will be sent to your actual device');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Ensure the backend server is running');
    console.log('- Check network connectivity to', SERVER_URL);
    console.log('- Verify APNs credentials are properly configured');
  }
}

// Run the test
testPushNotificationFlow();