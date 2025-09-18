import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// Add at the very top of the file
console.log('🔥 NOTIF SERVICE: File loaded at', new Date().toISOString());
console.log('🔥 NOTIF SERVICE: Capacitor check:', {
    isNativePlatform: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    isPluginAvailable: !!PushNotifications
});

export class NotificationService {
  private static instance: NotificationService;
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🔥 NOTIF SERVICE: initialize() called');
    console.log('🔥 NOTIF SERVICE: Current timestamp:', Date.now());
    
    try {
      // Request local notification permissions
      const localPermission = await LocalNotifications.requestPermissions();
      
      if (localPermission.display === 'granted') {
        console.log('Local notification permissions granted');
      } else {
        console.log('Local notification permissions denied');
      }

      // Only try push notifications on native platforms
      if (Capacitor.isNativePlatform()) {
        console.log('🔥 NOTIF SERVICE: ✅ Native platform detected - setting up push notifications');
        
        // CRITICAL: Add token registration listener with extensive logging
        PushNotifications.addListener('registration', (token) => {
          console.log('🔥 BRIDGE SUCCESS: Token received from iOS!');
          console.log('🔥 BRIDGE SUCCESS: Full token object:', JSON.stringify(token, null, 2));
          console.log('🔥 BRIDGE SUCCESS: Token value:', token.value);
          console.log('🔥 BRIDGE SUCCESS: Token length:', token.value?.length);
          console.log('🔥 BRIDGE SUCCESS: Token preview:', token.value?.substring(0, 20) + '...');
          console.log('🔥 BRIDGE SUCCESS: Received at:', new Date().toISOString());
          
          // Store in localStorage for persistent debugging
          localStorage.setItem('debug_bridge_token', token.value);
          localStorage.setItem('debug_bridge_timestamp', new Date().toISOString());
          localStorage.setItem('debug_bridge_success', 'true');
          
          // Call registration function
          console.log('🔥 BRIDGE SUCCESS: About to call registerDeviceToken...');
          this.registerDeviceToken(token.value);
        });

        // Add registration error listener
        PushNotifications.addListener('registrationError', (error) => {
          console.error('🚨 BRIDGE ERROR: Registration failed from iOS bridge');
          console.error('🚨 BRIDGE ERROR: Error object:', JSON.stringify(error, null, 2));
          console.error('🚨 BRIDGE ERROR: Error message:', (error as any).message || 'Unknown error');
          
          // Store error for debugging
          localStorage.setItem('debug_bridge_error', JSON.stringify(error));
          localStorage.setItem('debug_bridge_timestamp', new Date().toISOString());
          localStorage.setItem('debug_bridge_success', 'false');
        });

        console.log('🔥 NOTIF SERVICE: Listeners added successfully');
        console.log('🔥 NOTIF SERVICE: Requesting permissions...');
        
        // Request permissions with detailed logging
        try {
          const result = await PushNotifications.requestPermissions();
          console.log('🔥 NOTIF SERVICE: Permission result:', JSON.stringify(result, null, 2));
          console.log('🔥 NOTIF SERVICE: Receive permission:', result.receive);
          
          if (result.receive === 'granted') {
            console.log('🔥 NOTIF SERVICE: ✅ Permissions granted, calling register...');
            
            // Add delay to ensure iOS is ready
            setTimeout(async () => {
              console.log('🔥 NOTIF SERVICE: Delayed register call starting...');
              await PushNotifications.register();
              console.log('🔥 NOTIF SERVICE: Register call completed');
            }, 1000);
            
          } else {
            console.error('🚨 NOTIF SERVICE: ❌ Permissions denied!');
            console.error('🚨 NOTIF SERVICE: Result details:', result);
          }
        } catch (permError) {
          console.error('🚨 NOTIF SERVICE: Permission request failed:', permError);
        }
        
      } else {
        console.log('🔥 NOTIF SERVICE: ⚠️ Not native platform, skipping push setup');
        console.log('🔥 NOTIF SERVICE: Platform detected as:', Capacitor.getPlatform());
      }
      
      this.initialized = true;
      console.log('🔥 NOTIF SERVICE: NotificationService initialization completed');
    } catch (error) {
      console.error('🚨 NOTIF SERVICE: Error initializing notifications:', error);
    }
  }

  async registerDeviceToken(token: string) {
    console.log('🔥 TOKEN REG: registerDeviceToken() function called');
    console.log('🔥 TOKEN REG: Received token:', token?.substring(0, 20) + '...');
    console.log('🔥 TOKEN REG: Token length:', token?.length);
    console.log('🔥 TOKEN REG: Timestamp:', new Date().toISOString());
    
    // Validate token
    if (!token || token.length === 0) {
      console.error('🚨 TOKEN REG: Invalid token received!');
      return;
    }
    
    // Store token locally for debugging
    localStorage.setItem('debug_token_to_register', token);
    localStorage.setItem('debug_token_reg_timestamp', new Date().toISOString());
    
    // Test network connectivity first
    console.log('🔥 TOKEN REG: Testing network connectivity...');
    await this.testNetworkConnectivity();
    
    // Call API registration
    console.log('🔥 TOKEN REG: About to call sendTokenToServer...');
    await this.sendTokenToServer(token);
  }

  async testNetworkConnectivity() {
    console.log('🔥 NETWORK TEST: Starting connectivity test...');
    
    try {
      // Test basic connectivity - Use current server URL
      const apiBaseUrl = window.location.origin; // Use current origin
      const testUrl = `${apiBaseUrl}/api/notifications/status`;
      
      console.log('🔥 NETWORK TEST: Testing URL:', testUrl);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('🔥 NETWORK TEST: Response received');
      console.log('🔥 NETWORK TEST: Status:', response.status);
      console.log('🔥 NETWORK TEST: Status text:', response.statusText);
      console.log('🔥 NETWORK TEST: Response OK:', response.ok);
      
      const responseText = await response.text();
      console.log('🔥 NETWORK TEST: Response body:', responseText);
      
      localStorage.setItem('debug_network_test', 'success');
      localStorage.setItem('debug_network_status', response.status.toString());
      
    } catch (error) {
      console.error('🚨 NETWORK TEST: Connectivity test failed');
      console.error('🚨 NETWORK TEST: Error type:', (error as Error).constructor.name);
      console.error('🚨 NETWORK TEST: Error message:', (error as Error).message);
      console.error('🚨 NETWORK TEST: Full error:', error);
      
      localStorage.setItem('debug_network_test', 'failed');
      localStorage.setItem('debug_network_error', (error as Error).message);
    }
  }

  async sendTokenToServer(token: string) {
    console.log('🔥 API CALL: Starting sendTokenToServer...');
    console.log('🔥 API CALL: Token to send:', token?.substring(0, 20) + '...');
    
    // Use current server URL
    const apiBaseUrl = window.location.origin;
    const endpoint = `${apiBaseUrl}/api/device-token`;
    
    console.log('🔥 API CALL: Full endpoint URL:', endpoint);
    
    const payload = {
      deviceToken: token,
      userId: 'pending',
      platform: 'ios'
    };
    
    console.log('🔥 API CALL: Request payload:', JSON.stringify(payload, null, 2));
    console.log('🔥 API CALL: Making fetch request at:', new Date().toISOString());
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('🔥 API CALL: ✅ Response received');
      console.log('🔥 API CALL: Status code:', response.status);
      console.log('🔥 API CALL: Status text:', response.statusText);
      console.log('🔥 API CALL: Response headers:', Object.fromEntries(response.headers));
      console.log('🔥 API CALL: Response OK:', response.ok);
      
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
        console.log('🔥 API CALL: JSON response:', JSON.stringify(responseData, null, 2));
      } else {
        responseData = await response.text();
        console.log('🔥 API CALL: Text response:', responseData);
      }
      
      if (response.ok) {
        console.log('🔥 API CALL: ✅ SUCCESS - Token registration completed!');
        
        // Store success info
        localStorage.setItem('debug_api_success', 'true');
        localStorage.setItem('debug_api_response', JSON.stringify(responseData));
        localStorage.setItem('debug_api_timestamp', new Date().toISOString());
        
      } else {
        console.error('🚨 API CALL: ❌ FAILED - Server returned error status');
        console.error('🚨 API CALL: Error response:', responseData);
        
        localStorage.setItem('debug_api_success', 'false');
        localStorage.setItem('debug_api_error', JSON.stringify(responseData));
      }
      
    } catch (error) {
      console.error('🚨 API CALL: ❌ NETWORK ERROR - Request failed completely');
      console.error('🚨 API CALL: Error type:', (error as Error).constructor.name);
      console.error('🚨 API CALL: Error message:', (error as Error).message);
      console.error('🚨 API CALL: Full error object:', error);
      
      // Store error details
      localStorage.setItem('debug_api_success', 'false');
      localStorage.setItem('debug_api_error', (error as Error).message);
      localStorage.setItem('debug_api_error_type', (error as Error).constructor.name);
    }
    
    console.log('🔥 API CALL: sendTokenToServer completed');
  }

  // Add debugging utility method
  getDebugInfo() {
    const debugInfo = {
      bridgeToken: localStorage.getItem('debug_bridge_token'),
      bridgeTimestamp: localStorage.getItem('debug_bridge_timestamp'),
      bridgeSuccess: localStorage.getItem('debug_bridge_success'),
      bridgeError: localStorage.getItem('debug_bridge_error'),
      tokenToRegister: localStorage.getItem('debug_token_to_register'),
      networkTest: localStorage.getItem('debug_network_test'),
      networkStatus: localStorage.getItem('debug_network_status'),
      apiSuccess: localStorage.getItem('debug_api_success'),
      apiResponse: localStorage.getItem('debug_api_response'),
      apiError: localStorage.getItem('debug_api_error'),
      timestamp: new Date().toISOString()
    };
    
    console.log('🔍 DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
    return debugInfo;
  }

  // Store device token locally (to be sent after authentication)
  private async saveDeviceToken(deviceToken: string): Promise<void> {
    try {
      console.log('🔍 DEBUG: saveDeviceToken() called with token');
      console.log('📱 Device token received, storing locally until authentication');
      console.log('Token length:', deviceToken.length);
      console.log('Token preview:', deviceToken.substring(0, 20) + '...');
      console.log('🔍 DEBUG: About to store in localStorage...');
      
      // Store in localStorage with timestamp
      const tokenData = {
        token: deviceToken,
        platform: 'ios',
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('pendingDeviceToken', JSON.stringify(tokenData));
      console.log('✅ Device token stored locally, will send to server after login');
      console.log('🔍 DEBUG: localStorage content:', localStorage.getItem('pendingDeviceToken'));
      
      // Try to send immediately in case user is already logged in
      console.log('🔍 DEBUG: Attempting to send pending token to server immediately...');
      await this.sendPendingTokenToServer();
      
    } catch (error) {
      console.error('❌ Error storing device token locally:', error);
      console.error('🔍 DEBUG: Error details:', error);
    }
  }

  // Send stored device token to server (called after authentication)
  public async sendPendingTokenToServer(forceAuthenticated: boolean = false): Promise<boolean> {
    try {
      const storedTokenData = localStorage.getItem('pendingDeviceToken');
      if (!storedTokenData) {
        console.log('📱 No pending device token to send');
        return false;
      }
      
      const tokenData = JSON.parse(storedTokenData);
      console.log('📤 Attempting to send stored device token to server...');
      console.log(`🔍 Force authenticated: ${forceAuthenticated}`);
      
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      let response;
      
      if (forceAuthenticated) {
        // User is authenticated - use authenticated endpoint to trigger token association
        console.log('🔐 User authenticated - using authenticated endpoint for token association');
        try {
          response = await apiRequest('/api/notifications/register', {
            method: 'POST',
            body: JSON.stringify({
              token: tokenData.token,
              deviceToken: tokenData.token,
              platform: tokenData.platform
            })
          });
          console.log('✅ Token sent via authenticated endpoint for association');
        } catch (error) {
          console.error('❌ Authenticated endpoint failed:', error);
          return false;
        }
      } else {
        // User not authenticated - try unauthenticated endpoint first
        console.log('🔓 User not authenticated - trying unauthenticated endpoint first');
        try {
          response = await fetch('/api/device-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceToken: tokenData.token,
              userId: 'pending', // Will be associated later
              platform: tokenData.platform
            })
          });
          
          if (response.ok) {
            console.log('✅ Device token sent via unauthenticated endpoint (pending association)');
          } else {
            console.warn('⚠️ Unauthenticated endpoint failed, trying authenticated endpoint...');
            // Fall back to authenticated endpoint
            response = await apiRequest('/api/notifications/register', {
              method: 'POST',
              body: JSON.stringify({
                token: tokenData.token,
                deviceToken: tokenData.token,
                platform: tokenData.platform
              })
            });
          }
        } catch (error) {
          console.warn('⚠️ Unauthenticated endpoint unavailable, trying authenticated endpoint...');
          // Fall back to authenticated endpoint
          response = await apiRequest('/api/notifications/register', {
            method: 'POST',
            body: JSON.stringify({
              token: tokenData.token,
              deviceToken: tokenData.token,
              platform: tokenData.platform
            })
          });
        }
      }
      
      if (response.ok) {
        console.log('✅ Device token successfully sent to server and linked to user');
        // Clear the pending token since it's now stored on server
        localStorage.removeItem('pendingDeviceToken');
        return true;
      } else {
        console.error('❌ Failed to send device token to server. Status:', response.status);
        const errorText = await response.text();
        console.error('Server response:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending pending device token to server:', error);
      return false;
    }
  }

  // These methods now trigger SERVER-SIDE push notifications to all circle members
  // The server will send real iOS/Android push notifications that appear on lock screens
  async sendPushNotification(pusherName: string, willTitle: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // This only works on the same device - NOT cross-device
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: `${pusherName} has pushed you! 🚀`,
            body: `${pusherName} wants to encourage you with your Will`,
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#067DFD',
            extra: {
              type: 'will_push',
              willTitle,
              pusherName,
            }
          }
        ]
      });
      
      console.log('[NotificationService] LOCAL notification sent - this does NOT notify other users');
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  async sendWillReminderNotification(willTitle: string, timeRemaining: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "Will reminder",
            body: `Your Will "${willTitle}" has ${timeRemaining} remaining`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#1EB854',
            extra: {
              type: 'will_reminder',
              willTitle,
              timeRemaining,
            }
          }
        ]
      });
    } catch (error) {
      console.error('Error scheduling reminder notification:', error);
    }
  }

  // WILL LIFECYCLE NOTIFICATIONS
  async sendWillStartedNotification(willTitle: string) {
    try {
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      // Send server-side push notification to all committed members
      const response = await apiRequest('/api/notifications/will-started', {
        method: 'POST',
        body: JSON.stringify({
          willTitle: willTitle
        })
      });
      
      if (!response.ok) {
        console.error('Failed to send will started notification via server');
      }
    } catch (error) {
      console.error('Error sending will started notification:', error);
    }
  }

  async sendWillProposedNotification(creatorName: string, willTitle: string) {
    try {
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      // Send server-side push notification to all other circle members
      const response = await apiRequest('/api/notifications/will-proposed', {
        method: 'POST',
        body: JSON.stringify({
          creatorName: creatorName,
          willTitle: willTitle
        })
      });
      
      if (!response.ok) {
        console.error('Failed to send will proposed notification via server');
      }
    } catch (error) {
      console.error('Error sending will proposed notification:', error);
    }
  }

  async sendEndRoomNotification(type: '24_hours' | '15_minutes' | 'live', endRoomTime: string) {
    try {
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      // Send server-side push notification to all circle members
      const response = await apiRequest('/api/notifications/end-room', {
        method: 'POST',
        body: JSON.stringify({
          type: type,
          endRoomTime: endRoomTime
        })
      });
      
      if (!response.ok) {
        console.error('Failed to send end room notification via server');
      }
    } catch (error) {
      console.error('Error sending end room notification:', error);
    }
  }

  async sendReadyForNewWillNotification() {
    try {
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      // Send server-side push notification to all circle members
      const response = await apiRequest('/api/notifications/ready-for-new-will', {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('Failed to send ready for new will notification via server');
      }
    } catch (error) {
      console.error('Error sending ready for new will notification:', error);
    }
  }
  
  // Called when user becomes authenticated to associate pending tokens
  public async onUserAuthenticated(): Promise<boolean> {
    console.log('🔐 User authenticated - attempting to associate pending device tokens');
    const success = await this.sendPendingTokenToServer(true); // Force use of authenticated endpoint
    
    // Clean up old tokens for this user
    try {
      const { apiRequest } = await import('../lib/queryClient');
      await apiRequest('/api/device-tokens/cleanup', {
        method: 'POST'
      });
      console.log('🧹 Cleaned up old device tokens for user');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old tokens:', error);
    }
    
    return success;
  }
}

export const notificationService = NotificationService.getInstance();

// Export method for authentication flow integration
export const sendPendingDeviceToken = () => {
  return notificationService.sendPendingTokenToServer();
};

// TEST HELPER: Manually simulate device token reception (for debugging)
export const simulateDeviceToken = async (testToken: string = "test_token_" + Date.now()) => {
  console.log('🧪 TEST: Manually simulating device token reception');
  const service = NotificationService.getInstance();
  // Call the private method via the service instance
  await (service as any).saveDeviceToken(testToken);
  return testToken;
};