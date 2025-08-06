import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Bell, Smartphone, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { notificationService } from "@/services/NotificationService";

export default function NotificationTest() {
  const [initializeStatus, setInitializeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Check device registration status
  const { data: deviceStatus, refetch: refetchStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/notifications/status'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/status');
      return response.json();
    }
  });

  const handleInitializeNotifications = async () => {
    setInitializeStatus('loading');
    setStatusMessage('Requesting notification permissions...');
    
    try {
      await notificationService.initialize();
      setInitializeStatus('success');
      setStatusMessage('Notification service initialized successfully! Check logs for device token.');
      // Refresh status after initialization
      setTimeout(() => refetchStatus(), 2000);
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

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brandGray mb-2">
            Push Notification Testing
          </h1>
          <p className="text-gray-600">
            Test and verify push notification setup for WILL app
          </p>
        </div>

        {/* Device Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Device Registration Status
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                disabled={statusLoading}
              >
                <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deviceStatus && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Registration Status:</span>
                  <span className={`px-2 py-1 rounded text-sm ${deviceStatus.registered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {deviceStatus.registered ? (
                      <><CheckCircle className="h-3 w-3 mr-1 inline" />Registered</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1 inline" />Not Registered</>
                    )}
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
                {deviceStatus.lastUpdated && (
                  <div className="flex items-center justify-between">
                    <span>Last Updated:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(deviceStatus.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button 
                onClick={handleInitializeNotifications}
                disabled={initializeStatus === 'loading'}
                className="w-full"
                variant={initializeStatus === 'success' ? 'outline' : 'default'}
              >
                {initializeStatus === 'loading' && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                {initializeStatus === 'success' ? 'Re-initialize' : 'Initialize Push Notifications'}
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
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                {statusMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p><strong>Step 1:</strong> Click "Initialize Push Notifications" to request permissions</p>
            <p><strong>Step 2:</strong> Grant notification permission when prompted by iOS</p>
            <p><strong>Step 3:</strong> Check the console logs for the real device token</p>
            <p><strong>Step 4:</strong> Verify the device status shows "Registered"</p>
            <p><strong>Step 5:</strong> Send a test notification to confirm end-to-end functionality</p>
            <p className="mt-3 p-2 bg-blue-50 rounded text-blue-700">
              <strong>Note:</strong> This must be run on a physical iOS device (not simulator) for real push notifications to work.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}