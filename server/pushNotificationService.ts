import apn from 'node-apn';
import { db } from './db';
import { deviceTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface PushNotificationPayload {
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  category?: string;
  data?: Record<string, any>;
}

class PushNotificationService {
  private apnProvider: apn.Provider | null = null;

  constructor() {
    this.initializeAPNProvider();
  }

  private initializeAPNProvider() {
    // Check if APNs credentials are available
    const hasAPNSCredentials = process.env.APNS_PRIVATE_KEY && 
                              process.env.APNS_KEY_ID && 
                              process.env.APNS_TEAM_ID;

    if (hasAPNSCredentials) {
      try {
        const options = {
          token: {
            key: process.env.APNS_PRIVATE_KEY!, // Private key content from Apple Developer
            keyId: process.env.APNS_KEY_ID!, // Key ID from Apple Developer
            teamId: process.env.APNS_TEAM_ID!, // Team ID from Apple Developer
          },
          production: process.env.NODE_ENV === 'production', // Use production APNs for production
        };
        
        this.apnProvider = new apn.Provider(options);
        console.log(`[PushNotificationService] Initialized with APNs (${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'} mode)`);
      } catch (error) {
        console.error('[PushNotificationService] Failed to initialize APNs provider:', error);
        console.log('[PushNotificationService] Falling back to simulation mode');
        this.apnProvider = null;
      }
    } else {
      console.log('[PushNotificationService] APNs credentials not found - running in simulation mode');
      console.log('[PushNotificationService] Set APNS_PRIVATE_KEY, APNS_KEY_ID, and APNS_TEAM_ID to enable real push notifications');
    }
  }

  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      // Get user's device tokens
      const userTokens = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));

      if (userTokens.length === 0) {
        console.log(`[PushNotificationService] No device tokens found for user ${userId}`);
        return false;
      }

      // In production, send to all user's devices
      for (const tokenRecord of userTokens) {
        await this.sendToDevice(tokenRecord.deviceToken, payload);
      }

      return true;
    } catch (error) {
      console.error('[PushNotificationService] Error sending notification to user:', error);
      return false;
    }
  }

  async sendToMultipleUsers(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    const promises = userIds.map(userId => this.sendToUser(userId, payload));
    await Promise.all(promises);
  }

  private async sendToDevice(deviceToken: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      if (!this.apnProvider) {
        // Simulation mode - log what would be sent
        console.log(`[PushNotificationService] SIMULATION - Would send to device ${deviceToken.substring(0, 10)}...:`);
        console.log(`  Title: ${payload.title}`);
        console.log(`  Body: ${payload.body}`);
        console.log(`  Data:`, payload.data);
        return true;
      }

      // Production mode - actually send via APNs
      const notification = new apn.Notification();
      notification.alert = {
        title: payload.title,
        body: payload.body,
      };
      notification.badge = payload.badge || 1;
      notification.sound = payload.sound || 'default';
      notification.topic = process.env.APNS_TOPIC || 'com.porfirio.will'; // Your app's bundle ID
      notification.payload = payload.data || {};

      const result = await this.apnProvider.send(notification, deviceToken);
      
      if (result.failed.length > 0) {
        console.error('[PushNotificationService] Failed to send:', result.failed);
        return false;
      }

      console.log('[PushNotificationService] Successfully sent notification');
      return true;
    } catch (error) {
      console.error('[PushNotificationService] Error sending to device:', error);
      return false;
    }
  }

  // Predefined notification templates for the 4 key moments
  async sendWillProposedNotification(creatorName: string, circleMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "New Will proposed! 📝",
      body: `${creatorName} has proposed starting a new will`,
      category: 'will_proposed',
      data: {
        type: 'will_proposed',
        creatorName,
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  async sendWillStartedNotification(willTitle: string, committedMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Your Will has started! 🎯",
      body: `Time to begin your commitment: "${willTitle}"`,
      category: 'will_started',
      data: {
        type: 'will_started',
        willTitle,
      }
    };

    await this.sendToMultipleUsers(committedMembers, payload);
  }

  async sendEndRoomNotification(type: '24_hours' | '15_minutes' | 'live', endRoomTime: string, circleMembers: string[]): Promise<void> {
    const notifications = {
      '24_hours': {
        title: "End Room tomorrow 📅",
        body: `Your End Room ceremony is scheduled for tomorrow at ${endRoomTime}`,
      },
      '15_minutes': {
        title: "End Room starting soon ⏰",
        body: `Your End Room ceremony starts in 15 minutes`,
      },
      'live': {
        title: "End Room is live! 🎭",
        body: "Join now for your circle's reflection ceremony",
      }
    };

    const payload: PushNotificationPayload = {
      title: notifications[type].title,
      body: notifications[type].body,
      category: `end_room_${type}`,
      data: {
        type: `end_room_${type}`,
        endRoomTime,
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  async sendReadyForNewWillNotification(circleMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Ready for new Will! 🚀",
      body: "All members acknowledged - you can start a new Will!",
      category: 'ready_for_new_will',
      data: {
        type: 'ready_for_new_will',
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }
}

export const pushNotificationService = new PushNotificationService();