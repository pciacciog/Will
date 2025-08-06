import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { notificationService } from "@/services/NotificationService";

export default function NotificationTest() {
  const [initializeStatus, setInitializeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [deviceStatus, setDeviceStatus] = useState<any>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/notifications/status');
      const status = await response.json();
      setDeviceStatus(status);
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleInitializeNotifications = async () => {
    setInitializeStatus('loading');
    setStatusMessage('Requesting notification permissions...');
    
    try {
      await notificationService.initialize();
      setInitializeStatus('success');
      setStatusMessage('Notification service initialized successfully! Check logs for device token.');
      // Refresh status after initialization
      setTimeout(() => checkStatus(), 2000);
    } catch (error) {
      setInitializeStatus('error');
      setStatusMessage(`Failed to initialize: ${error}`);
    }
  };

  const handleTestNotification = async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'WILL Test Notification',
          body: 'This is a test of the WILL push notification system!'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setStatusMessage('Test notification sent! Check your device.');
      } else {
        setStatusMessage(`Test failed: ${result.message}`);
      }
    } catch (error) {
      setStatusMessage(`Test error: ${error}`);
    }
  };

  // Load status on component mount
  useState(() => {
    checkStatus();
  });

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">
            Push Notification Testing
          </h1>
          <p className="text-gray-600">
            Test and verify push notification setup for WILL app
          </p>
        </div>

        {/* Device Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Device Registration Status</h2>
            <Button onClick={checkStatus} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
          
          {deviceStatus && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Registration Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  deviceStatus.registered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {deviceStatus.registered ? 'Registered' : 'Not Registered'}
                </span>
              </div>
              {deviceStatus.token && (
                <div className="flex items-center justify-between">
                  <span>Device Token:</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {deviceStatus.token}
                  </code>
                </div>
              )}
              {deviceStatus.platform && (
                <div className="flex items-center justify-between">
                  <span>Platform:</span>
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm">{deviceStatus.platform}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          
          <div className="space-y-3">
            <Button 
              onClick={handleInitializeNotifications}
              disabled={initializeStatus === 'loading'}
              className="w-full"
            >
              {initializeStatus === 'loading' ? 'Loading...' : 'Initialize Push Notifications'}
            </Button>
            
            <Button 
              onClick={handleTestNotification}
              disabled={!deviceStatus?.registered}
              className="w-full"
              variant="outline"
            >
              Send Test Notification
            </Button>
          </div>

          {statusMessage && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Step 1:</strong> Click "Initialize Push Notifications" to request permissions</p>
            <p><strong>Step 2:</strong> Grant notification permission when prompted by iOS</p>
            <p><strong>Step 3:</strong> Check the console logs for the real device token</p>
            <p><strong>Step 4:</strong> Verify the device status shows "Registered"</p>
            <p><strong>Step 5:</strong> Send a test notification to confirm end-to-end functionality</p>
            <p className="mt-3 p-2 bg-blue-50 rounded text-blue-700">
              <strong>Note:</strong> This must be run on a physical iOS device (not simulator) for real push notifications to work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}