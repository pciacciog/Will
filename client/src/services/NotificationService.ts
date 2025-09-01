import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

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

    console.log('🔍 DEBUG: NotificationService initialize() called');
    
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
        console.log('🔍 DEBUG: Native platform detected, setting up push notifications');
        try {
          const pushPermission = await PushNotifications.requestPermissions();
          
          if (pushPermission.receive === 'granted') {
            console.log('Push notification permissions granted');
            
            // CRITICAL: Set up listeners BEFORE calling register() to avoid race condition
            console.log('🔍 DEBUG: Setting up push notification listeners...');
            
            // Listen for registration success from Capacitor plugin
            PushNotifications.addListener('registration', async (token) => {
              console.log('✅ Push registration success via Capacitor! Token received:', token.value);
              console.log('🔍 DEBUG: Capacitor listener triggered, calling saveDeviceToken');
              await this.saveDeviceToken(token.value);
            });
            
            // Listen for registration errors from Capacitor plugin
            PushNotifications.addListener('registrationError', (err) => {
              console.error('❌ Push registration error via Capacitor:', err.error);
              console.error('Error details:', JSON.stringify(err, null, 2));
            });
            
            // ENHANCED: Also listen for native AppDelegate events (our new implementation)
            console.log('🔍 DEBUG: Setting up window event listeners for AppDelegate bridge...');
            window.addEventListener('pushNotificationRegistration', async (event: any) => {
              console.log('✅ Push registration success via AppDelegate! Token received:', event.detail.value);
              console.log('🔍 DEBUG: AppDelegate window listener triggered, calling saveDeviceToken');
              await this.saveDeviceToken(event.detail.value);
            });
            
            window.addEventListener('pushNotificationRegistrationError', (event: any) => {
              console.error('❌ Push registration error via AppDelegate:', event.detail.error);
            });
            
            // ENHANCED: Listen for NotificationCenter events from AppDelegate
            console.log('🔍 DEBUG: Setting up NotificationCenter listeners...');
            // Create a custom event listener for NotificationCenter events
            const handleNotificationCenterEvent = (eventName: string) => {
              console.log(`🔍 DEBUG: Setting up listener for NotificationCenter event: ${eventName}`);
              // This will be triggered by native NotificationCenter posts
            };
            
            // Listen for incoming push notifications
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              console.log('📱 Push notification received:', notification);
            });
            
            // Listen for push notification actions
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
              console.log('🔔 Push notification action performed:', notification);
            });
            
            console.log('🔍 DEBUG: All listeners set up. Now registering for push notifications...');
            
            // Register for push notifications AFTER setting up listeners
            await PushNotifications.register();
            console.log('🔍 DEBUG: PushNotifications.register() called successfully');
          } else {
            console.log('🔍 DEBUG: Push notification permissions denied');
          }
        } catch (pushError) {
          console.warn('Push notifications not available:', pushError);
        }
      } else {
        console.log('🔍 DEBUG: Not on native platform, skipping push notifications');
      }
      
      this.initialized = true;
      console.log('🔍 DEBUG: NotificationService initialization completed');
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
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
  public async sendPendingTokenToServer(): Promise<boolean> {
    try {
      const storedTokenData = localStorage.getItem('pendingDeviceToken');
      if (!storedTokenData) {
        console.log('📱 No pending device token to send');
        return false;
      }
      
      const tokenData = JSON.parse(storedTokenData);
      console.log('📤 Attempting to send stored device token to server...');
      
      // Import apiRequest dynamically to avoid module issues
      const { apiRequest } = await import('../lib/queryClient');
      
      // First try the unauthenticated endpoint for immediate token storage
      let response;
      try {
        response = await fetch('/api/push-tokens/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceToken: tokenData.token,
            platform: tokenData.platform
          })
        });
        
        if (response.ok) {
          console.log('✅ Device token sent via unauthenticated endpoint');
        } else {
          console.warn('⚠️ Unauthenticated endpoint failed, trying authenticated endpoint...');
          // Fall back to authenticated endpoint
          response = await apiRequest('/api/push-tokens', {
            method: 'POST',
            body: JSON.stringify({
              deviceToken: tokenData.token,
              platform: tokenData.platform
            })
          });
        }
      } catch (error) {
        console.warn('⚠️ Unauthenticated endpoint unavailable, trying authenticated endpoint...');
        // Fall back to authenticated endpoint
        response = await apiRequest('/api/push-tokens', {
          method: 'POST',
          body: JSON.stringify({
            deviceToken: tokenData.token,
            platform: tokenData.platform
          })
        });
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