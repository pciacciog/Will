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
            
            // Register for push notifications
            await PushNotifications.register();
            
            // Listen for registration success
            PushNotifications.addListener('registration', (token) => {
              console.log('Push registration success, token:', token.value);
              // TODO: Send this token to server for storage
            });
            
            // Listen for registration errors
            PushNotifications.addListener('registrationError', (err) => {
              console.error('Push registration error:', err.error);
            });
            
            // Listen for incoming push notifications
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              console.log('Push notification received:', notification);
            });
            
            // Listen for push notification actions
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
              console.log('Push notification action performed:', notification);
            });
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

  // IMPORTANT: This only sends LOCAL notifications to the same device
  // For real cross-device push notifications, see docs/PUSH_NOTIFICATIONS.md
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
    if (!this.initialized) await this.initialize();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "Your Will has started! 🎯",
            body: `Time to begin your commitment: "${willTitle}"`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#1EB854',
            extra: { type: 'will_started', willTitle }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending will started notification:', error);
    }
  }

  async sendWillProposedNotification(creatorName: string, willTitle: string) {
    if (!this.initialized) await this.initialize();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "New Will proposed! 📝",
            body: `${creatorName} has proposed starting a new will`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#067DFD',
            extra: { type: 'will_proposed', creatorName, willTitle }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending will proposed notification:', error);
    }
  }

  async sendEndRoomNotification(type: '24_hours' | '15_minutes' | 'live', endRoomTime: string) {
    if (!this.initialized) await this.initialize();

    const notifications = {
      '24_hours': {
        title: "End Room tomorrow 📅",
        body: `Your End Room ceremony is scheduled for tomorrow at ${endRoomTime}`,
        color: '#8B5CF6'
      },
      '15_minutes': {
        title: "End Room starting soon ⏰",
        body: `Your End Room ceremony starts in 15 minutes`,
        color: '#F59E0B'
      },
      'live': {
        title: "End Room is live! 🎭",
        body: "Join now for your circle's reflection ceremony",
        color: '#8B5CF6'
      }
    };

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: notifications[type].title,
            body: notifications[type].body,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: notifications[type].color,
            extra: { type: `end_room_${type}`, endRoomTime }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending end room notification:', error);
    }
  }

  async sendReadyForNewWillNotification() {
    if (!this.initialized) await this.initialize();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "Ready for new Will! 🚀",
            body: "All members acknowledged - you can start a new Will!",
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#1EB854',
            extra: { type: 'ready_for_new_will' }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending ready for new will notification:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();