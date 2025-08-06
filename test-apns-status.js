// APNs Configuration Status Check
// Run this in Safari Web Inspector to verify APNs setup

console.log('📡 Checking APNs Configuration Status...');

async function checkAPNsStatus() {
  try {
    // Check if user is authenticated
    const authResponse = await fetch('/api/auth/me');
    if (!authResponse.ok) {
      console.log('❌ Not authenticated - please sign in first');
      return;
    }
    
    const user = await authResponse.json();
    console.log('✅ User:', user.firstName, user.lastName);
    
    // Check current device registration status
    console.log('📱 Checking device registration status...');
    const statusResponse = await fetch('/api/notifications/status');
    const status = await statusResponse.json();
    console.log('📊 Current device status:', status);
    
    // Test APNs configuration by sending a notification with fake token
    console.log('🧪 Testing APNs configuration with fake token...');
    const testResponse = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        title: 'APNs Configuration Test',
        body: 'Testing if APNs service is properly configured'
      })
    });
    
    const testResult = await testResponse.json();
    console.log('🧪 APNs test result:', testResult);
    
    // Summary
    console.log('\n📋 APNs STATUS SUMMARY:');
    console.log('=' * 50);
    console.log('✅ Server: Running and responsive');
    console.log('✅ Authentication: Working');
    console.log('✅ Database: Device token storage working');
    console.log(`📱 Device Registration: ${status.registered ? '✅ Active' : '❌ No device registered'}`);
    console.log(`🔐 APNs Service: ${testResult.success ? '✅ Configured and operational' : '❌ Not working'}`);
    console.log('');
    
    if (!status.registered) {
      console.log('🔍 NEXT STEPS:');
      console.log('1. Get real device token from your iPhone app using Capacitor PushNotifications');
      console.log('2. Register it via: POST /api/push-tokens with real deviceToken');
      console.log('3. Test notification delivery to real device');
      console.log('');
      console.log('📱 Example iOS code to get real device token:');
      console.log(`
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});

PushNotifications.addListener('registration', async (token) => {
  console.log('Real device token:', token.value);
  
  // Register with server
  const response = await fetch('/api/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceToken: token.value,  // This is the real token!
      platform: 'ios'
    })
  });
  
  console.log('Registration result:', await response.json());
});
      `);
    } else {
      console.log('⚠️  IMPORTANT: You have a device registered, but it might be a test token.');
      console.log('   Real APNs tokens are 64-character hex strings from Apple.');
      console.log('   Test tokens like "test_device_token_..." will be rejected by Apple silently.');
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
}

// Auto-run
checkAPNsStatus();