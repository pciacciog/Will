// Test device token registration for iPhone push notifications
// Run this in Safari Web Inspector: Develop > [Your iPhone] > WILL

console.log('📱 Testing Device Token Registration...');

async function testDeviceRegistration() {
  try {
    // First check if user is logged in
    console.log('🔍 Checking authentication...');
    const authResponse = await fetch('/api/auth/me');
    if (!authResponse.ok) {
      console.log('❌ Not logged in - please sign in first');
      return;
    }
    
    const user = await authResponse.json();
    console.log('✅ User logged in:', user.firstName, user.lastName);
    
    // Generate a fake device token for testing (real app will get this from Capacitor)
    const fakeDeviceToken = 'test_device_token_' + Math.random().toString(36).substring(2, 15);
    console.log('📲 Using test device token:', fakeDeviceToken.substring(0, 20) + '...');
    
    // Test both registration endpoints
    console.log('🔄 Testing /api/push-tokens endpoint...');
    const response1 = await fetch('/api/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: fakeDeviceToken,
        platform: 'ios'
      })
    });
    
    const result1 = await response1.json();
    console.log('📬 /api/push-tokens result:', result1);
    
    console.log('🔄 Testing /api/notifications/register endpoint...');
    const response2 = await fetch('/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: fakeDeviceToken + '_alt',
        platform: 'ios'
      })
    });
    
    const result2 = await response2.json();
    console.log('📬 /api/notifications/register result:', result2);
    
    // Check status after registration
    console.log('📱 Checking device status after registration...');
    const statusResponse = await fetch('/api/notifications/status');
    const status = await statusResponse.json();
    console.log('📊 Final device status:', status);
    
    if (status.registered) {
      console.log('🎉 SUCCESS: Device token registration is working!');
      console.log('📋 Next step: Wire up real Capacitor device token in your app');
    } else {
      console.log('❌ FAILED: Device registration did not work properly');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Auto-start test
testDeviceRegistration();