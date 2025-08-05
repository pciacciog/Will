// Test script to verify push notification functionality
// Run this in browser console on the iOS app

console.log('🔔 Testing iOS Push Notifications');

// 1. Test device token registration
async function testDeviceRegistration() {
  console.log('1. Testing device registration...');
  try {
    const response = await fetch('/api/auth/me');
    const user = await response.json();
    console.log('User ID:', user.id);
    
    // Check if device is registered
    const deviceResponse = await fetch('/api/notifications/status');
    const status = await deviceResponse.json();
    console.log('Device status:', status);
    
    return user.id;
  } catch (error) {
    console.error('Registration test failed:', error);
  }
}

// 2. Test manual notification
async function testManualNotification(userId) {
  console.log('2. Testing manual notification...');
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        title: 'Test Notification',
        body: 'This is a test push notification from WILL app!'
      })
    });
    
    const result = await response.json();
    console.log('Test notification result:', result);
  } catch (error) {
    console.error('Manual notification test failed:', error);
  }
}

// 3. Test WILL-specific notifications
async function testWillNotifications(userId) {
  console.log('3. Testing WILL notifications...');
  
  const notifications = [
    { type: 'will_proposed', title: 'New WILL Proposed!', body: 'Someone proposed a new commitment in your circle' },
    { type: 'will_active', title: 'WILL is Active!', body: 'Your commitment has started - time to begin!' },
    { type: 'end_room_24h', title: 'End Room Tomorrow', body: 'Your End Room is scheduled for tomorrow' },
    { type: 'end_room_15min', title: 'End Room Starting Soon', body: 'Your End Room starts in 15 minutes' },
    { type: 'ready_for_new_will', title: 'Ready for New WILL', body: 'Time to create your next commitment!' }
  ];
  
  for (const notification of notifications) {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          type: notification.type,
          title: notification.title,
          body: notification.body
        })
      });
      
      const result = await response.json();
      console.log(`${notification.type} result:`, result);
      
      // Wait 2 seconds between notifications
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`${notification.type} failed:`, error);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive push notification tests...');
  
  const userId = await testDeviceRegistration();
  if (!userId) {
    console.error('❌ Device registration failed - stopping tests');
    return;
  }
  
  await testManualNotification(userId);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await testWillNotifications(userId);
  
  console.log('✅ All tests completed!');
}

// Auto-run tests
runAllTests();