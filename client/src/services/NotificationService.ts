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
        try {
          const pushPermission = await PushNotifications.requestPermissions();
          
          if (pushPermission.receive === 'granted') {
            console.log('Push notification permissions granted');
            
            // CRITICAL: Set up listeners BEFORE calling register() to avoid race condition
            console.log('Setting up push notification listeners...');
            
            // Listen for registration success
            PushNotifications.addListener('registration', async (token) => {
              console.log('✅ Push registration success! Token received:', token.value);
              console.log('Token length:', token.value.length);
              console.log('Token type:', typeof token.value);
              
              // Send device token to server for storage
              try {
                // Import apiRequest dynamically to avoid module issues
                const { apiRequest } = await import('../lib/queryClient');
                
                console.log('Sending device token to backend...');
                const response = await apiRequest('/api/push-tokens', {
                  method: 'POST',
                  body: JSON.stringify({
                    deviceToken: token.value,
                    platform: 'ios' // Since this is mainly for iOS
                  })
                });
                
                if (response.ok) {
                  console.log('✅ Device token successfully stored on server');
                } else {
                  console.error('❌ Failed to store device token on server. Status:', response.status);
                  const errorText = await response.text();
                  console.error('Server response:', errorText);
                }
              } catch (error) {
                console.error('❌ Error sending device token to server:', error);
              }
            });
            
            // Listen for registration errors
            PushNotifications.addListener('registrationError', (err) => {
              console.error('❌ Push registration error:', err.error);
              console.error('Error details:', JSON.stringify(err, null, 2));
            });
            
            // Listen for incoming push notifications
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              console.log('📱 Push notification received:', notification);
            });
            
            // Listen for push notification actions
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
              console.log('🔔 Push notification action performed:', notification);
            });
            
            console.log('All listeners set up. Now registering for push notifications...');
            
            // Register for push notifications AFTER setting up listeners
            await PushNotifications.register();
            console.log('PushNotifications.register() called successfully');
          }
        } catch (pushError) {
          console.warn('Push notifications not available:', pushError);
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
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