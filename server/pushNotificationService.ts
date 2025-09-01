import apn from 'node-apn';
import fs from 'fs';
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

    // Check for fixed .p8 key file first, then fall back to environment variable
    const fixedKeyPath = './AuthKey_4J2R866V2R_fixed.p8';
    const hasFixedKeyFile = fs.existsSync(fixedKeyPath);
    
    if (hasFixedKeyFile && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID) {
      try {
        console.log('[PushNotificationService] Using fixed .p8 key file for APNs initialization');
        
        const options = {
          token: {
            key: fs.readFileSync(fixedKeyPath),
            keyId: process.env.APNS_KEY_ID!,
            teamId: process.env.APNS_TEAM_ID!,
          },
          production: false, // Force sandbox mode to match iOS development environment
        };
        
        this.apnProvider = new apn.Provider(options);
        console.log(`[PushNotificationService] Successfully initialized APNs with fixed .p8 key (${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'} mode)`);
        console.log('[PushNotificationService] Real push notifications ENABLED - no longer in simulation mode');
      } catch (error) {
        console.error('[PushNotificationService] Failed to initialize APNs provider with fixed key:', error);
        console.log('[PushNotificationService] Falling back to simulation mode');
        this.apnProvider = null;
      }
    } else if (hasAPNSCredentials) {
      // Fallback to environment variable method
      try {
        console.log('[PushNotificationService] Fixed key file not found, trying environment variable');
        
        let privateKey = process.env.APNS_PRIVATE_KEY!;
        privateKey = privateKey.trim();
        
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = privateKey.replace(/-----BEGIN.*?-----/, '-----BEGIN PRIVATE KEY-----');
          privateKey = privateKey.replace(/-----END.*?-----/, '-----END PRIVATE KEY-----');
        }
        
        const options = {
          token: {
            key: privateKey,
            keyId: process.env.APNS_KEY_ID!,
            teamId: process.env.APNS_TEAM_ID!,
          },
          production: false, // Force sandbox mode to match iOS development environment
        };
        
        this.apnProvider = new apn.Provider(options);
        console.log(`[PushNotificationService] Initialized APNs with environment key (${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'} mode)`);
      } catch (error: any) {
        console.error('[PushNotificationService] Failed to initialize APNs provider:', error);
        
        if (error?.message && error.message.includes('DECODER routines::unsupported')) {
          console.log('[PushNotificationService] OpenSSL compatibility issue - consider using fixed .p8 key file');
          this.apnProvider = 'simulation_openssl_error' as any;
        } else {
          this.apnProvider = null;
        }
      }
    } else {
      console.log('[PushNotificationService] APNs credentials not found - running in simulation mode');
      console.log('[PushNotificationService] Provide fixed .p8 key file or set APNS_PRIVATE_KEY, APNS_KEY_ID, and APNS_TEAM_ID');
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
      if (!this.apnProvider || this.apnProvider === null) {
        // Enhanced simulation mode with OpenSSL error context
        const reason = 'APNs credentials not configured';
          
        console.log(`[PushNotificationService] SIMULATION MODE (${reason})`);
        console.log(`  Would send to device: ${deviceToken.substring(0, 10)}...${deviceToken.substring(-4)}`);
        console.log(`  Title: ${payload.title}`);
        console.log(`  Body: ${payload.body}`);
        console.log(`  Category: ${payload.category || 'default'}`);
        console.log(`  Data:`, JSON.stringify(payload.data, null, 2));
        console.log(`  Production Mode: ${process.env.NODE_ENV === 'production'}`);
        console.log('  ✅ Notification would be delivered successfully');
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

      console.log(`[PushNotificationService] Sending notification to device: ${deviceToken.substring(0, 20)}...`);
      console.log(`[PushNotificationService] Title: ${payload.title}`);
      console.log(`[PushNotificationService] Body: ${payload.body}`);
      console.log(`[PushNotificationService] Environment: ${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'}`);
      
      const result = await this.apnProvider.send(notification, deviceToken);
      
      console.log(`[PushNotificationService] APNs Response:`, {
        sent: result.sent.length,
        failed: result.failed.length
      });
      
      if (result.failed.length > 0) {
        console.error('[PushNotificationService] Failed deliveries:');
        result.failed.forEach((failure) => {
          console.error(`  Device: ${failure.device}`);
          console.error(`  Status: ${failure.status}`);
          console.error(`  Response: ${failure.response?.reason}`);
        });
        return false;
      }

      if (result.sent.length > 0) {
        console.log(`[PushNotificationService] ✅ Successfully sent to ${result.sent.length} device(s)`);
        result.sent.forEach((sent) => {
          console.log(`  ✅ Sent to: ${sent.device.substring(0, 20)}...`);
        });
      }
      
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