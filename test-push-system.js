// Quick push notification test for iPhone app
// Run this in Safari Web Inspector: Develop > [Your iPhone] > WILL

console.log('🔔 WILL Push Notification Test - Starting...');
console.log('📱 Make sure you granted notification permission when prompted');

// Test 1: Check if user is logged in and device registered
async function checkDeviceStatus() {
  try {
    const authResponse = await fetch('/api/user');
    if (!authResponse.ok) {
      console.log('❌ Not logged in - please sign in first');
      return null;
    }
    
    const user = await authResponse.json();
    console.log('✅ User logged in:', user.firstName, user.lastName);
    
    const statusResponse = await fetch('/api/notifications/status');
    const status = await statusResponse.json();
    console.log('📱 Device status:', status);
    
    return user.id;
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return null;
  }
}

// Test 2: Send a simple test notification
async function sendTestNotification(userId) {
  try {
    console.log('📤 Sending test notification...');
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        title: 'WILL Test',
        body: 'Push notifications are working! 🎉'
      })
    });
    
    const result = await response.json();
    console.log('📬 Test result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Check your iPhone for the notification!');
      return true;
    } else {
      console.log('❌ FAILED:', result.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
async function runTest() {
  console.log('='.repeat(50));
  console.log('WILL PUSH NOTIFICATION TEST');
  console.log('='.repeat(50));
  
  const userId = await checkDeviceStatus();
  if (!userId) {
    console.log('🛑 STOP: Please log into the app first');
    return;
  }
  
  console.log('⏳ Sending test notification in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const success = await sendTestNotification(userId);
  
  console.log('='.repeat(50));
  if (success) {
    console.log('🎉 TEST PASSED: You should see a notification on your iPhone');
    console.log('📱 If you see the notification, push notifications are WORKING!');
  } else {
    console.log('❌ TEST FAILED: Check server logs for errors');
  }
  console.log('='.repeat(50));
}

// Auto-start test
runTest();