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

  async sendCommitmentReceivedNotification(memberName: string, willTitle: string) {
    if (!this.initialized) await this.initialize();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "New commitment received! 🤝",
            body: `${memberName} just committed to "${willTitle}"`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#067DFD',
            extra: { type: 'commitment_received', memberName, willTitle }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending commitment notification:', error);
    }
  }

  async sendWillScheduledNotification(willTitle: string, startDate: string) {
    if (!this.initialized) await this.initialize();

    try {
      const startTime = new Date(startDate).toLocaleDateString('en-US', { 
        weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
      });

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "Will scheduled! 📅",
            body: `"${willTitle}" starts ${startTime}`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#1EB854',
            extra: { type: 'will_scheduled', willTitle, startDate }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending will scheduled notification:', error);
    }
  }

  async sendEndRoomNotification(type: 'scheduled' | 'starting' | 'ending', endRoomTime: string) {
    if (!this.initialized) await this.initialize();

    const notifications = {
      scheduled: {
        title: "End Room ceremony scheduled 🎭",
        body: `Your reflection session is set for ${endRoomTime}`,
        color: '#8B5CF6'
      },
      starting: {
        title: "End Room is live! 🎭",
        body: "Join now for your circle's reflection ceremony",
        color: '#8B5CF6'
      },
      ending: {
        title: "End Room closing soon ⏰",
        body: "Your ceremony ends in 10 minutes",
        color: '#F59E0B'
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

  async sendAcknowledgmentNotification(type: 'needed' | 'ready', willTitle: string, acknowledgedCount?: number, totalCount?: number) {
    if (!this.initialized) await this.initialize();

    const message = type === 'needed' 
      ? `Review and acknowledge completion of "${willTitle}"`
      : `All members acknowledged - you can start a new Will!`;

    const title = type === 'needed' 
      ? "Will completed! ✅" 
      : "Ready for new Will! 🚀";

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body: message,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: type === 'needed' ? '#F59E0B' : '#1EB854',
            extra: { 
              type: `acknowledgment_${type}`, 
              willTitle, 
              acknowledgedCount, 
              totalCount 
            }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending acknowledgment notification:', error);
    }
  }

  async sendDailyWillReminder(willTitle: string, dayNumber: number) {
    if (!this.initialized) await this.initialize();

    const encouragements = [
      "How's your Will going today?",
      "Keep the momentum going!",
      "Your circle believes in you!",
      "Another day, another step forward!",
      "You've got this!"
    ];

    const message = encouragements[dayNumber % encouragements.length];

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: `Day ${dayNumber} of your Will 💪`,
            body: `${message} Working on: "${willTitle}"`,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#1EB854',
            extra: { type: 'daily_reminder', willTitle, dayNumber }
          }
        ]
      });
    } catch (error) {
      console.error('Error sending daily reminder:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();