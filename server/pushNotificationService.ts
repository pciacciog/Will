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

    if (hasAPNSCredentials) {
      // Use environment variable method only (security compliance)
      try {
        console.log('[PushNotificationService] Using environment variable for APNs initialization');
        
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
        console.log(`[PushNotificationService] ✅ APNs ENABLED: Initialized with environment key (SANDBOX mode - forced for development)`);
      } catch (error: any) {
        console.error('[PushNotificationService] Failed to initialize APNs provider:', error);
        
        // Always set to null on any error to ensure proper simulation mode
        this.apnProvider = null;
        
        if (error?.message && error.message.includes('DECODER routines::unsupported')) {
          console.log('[PushNotificationService] OpenSSL compatibility issue detected - falling back to simulation mode');
        }
      }
    } else {
      console.log('[PushNotificationService] ⚠️ APNs DISABLED: Credentials not found - running in simulation mode');
      console.log('[PushNotificationService] To enable real notifications, set APNS_PRIVATE_KEY, APNS_KEY_ID, and APNS_TEAM_ID environment variables');
    }
  }

  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      console.log(`[PushNotificationService] 🔍 DEBUG: Processing notification for user ${userId}`);
      
      // Get user's device tokens
      const userTokens = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));

      console.log(`[PushNotificationService] 🔍 DEBUG: Found ${userTokens.length} device token(s) for user ${userId}`);
      
      if (userTokens.length === 0) {
        console.log(`[PushNotificationService] No device tokens found for user ${userId}`);
        return false;
      }

      // ENVIRONMENT GUARDRAILS: Filter tokens by environment compatibility (Issue 1 fix)
      const serverIsSandbox = true; // We're always in sandbox mode during development
      const compatibleTokens = userTokens.filter(token => {
        if (token.platform !== 'ios') return true; // Non-iOS tokens are always compatible
        
        const tokenIsSandbox = token.isSandbox ?? true; // Default to sandbox if null
        const compatible = serverIsSandbox === tokenIsSandbox;
        
        console.log(`[PushNotificationService] 🔍 Token ${token.deviceToken.substring(0, 8)}... - Server: ${serverIsSandbox ? 'SANDBOX' : 'PRODUCTION'}, Token: ${tokenIsSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
        
        if (!compatible) {
          console.log(`[PushNotificationService] ⚠️ SKIPPED: Token ${token.deviceToken.substring(0, 8)}... environment mismatch`);
          console.log(`  🔍 Server: ${serverIsSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
          console.log(`  🔍 Token: ${tokenIsSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
          console.log(`  🔍 Action: Skipping to prevent 403 error`);
        } else {
          console.log(`  ✅ COMPATIBLE: Environment match - allowing notification`);
        }
        
        return compatible;
      });
      
      if (compatibleTokens.length === 0) {
        console.log(`[PushNotificationService] ⚠️ User ${userId} has no environment-compatible tokens`);
        console.log(`  🔍 Total tokens: ${userTokens.length}`);
        console.log(`  🔍 Compatible: ${compatibleTokens.length}`);
        console.log(`  🔍 Server environment: ${serverIsSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
        return false;
      }
      
      console.log(`[PushNotificationService] 🔍 DEBUG: Processing ${compatibleTokens.length} environment-compatible token(s)`);

      // Send to environment-compatible tokens only
      for (const tokenRecord of compatibleTokens) {
        console.log(`[PushNotificationService] 🔍 DEBUG: Sending to device token ${tokenRecord.deviceToken.substring(0, 20)}... (belongs to user ${userId})`);
        console.log(`[PushNotificationService] 🔍 DEBUG: Token details: Platform=${tokenRecord.platform}, Active=${tokenRecord.isActive}, Environment=${tokenRecord.isSandbox ? 'SANDBOX' : 'PRODUCTION'}, Updated=${tokenRecord.updatedAt}`);
        console.log(`[PushNotificationService] 🔍 DEBUG: Provenance: Bundle=${tokenRecord.bundleId || 'N/A'}, Scheme=${tokenRecord.buildScheme || 'N/A'}, Profile=${tokenRecord.provisioningProfile || 'N/A'}, Version=${tokenRecord.appVersion || 'N/A'}`);
        
        // ENVIRONMENT GUARDRAIL CHECK (Issue 1 fix)
        if (tokenRecord.platform === 'ios') {
          const tokenEnv = tokenRecord.isSandbox ? 'SANDBOX' : 'PRODUCTION';
          const serverEnv = 'SANDBOX'; // We're always sandbox in development
          
          if (tokenRecord.isSandbox === false) {
            console.log(`[PushNotificationService] ⚠️ GUARDRAIL TRIGGERED: Skipping production token on sandbox server`);
            console.log(`  🔍 Token: ${tokenRecord.deviceToken.substring(0, 8)}... is PRODUCTION`);
            console.log(`  🔍 Server: SANDBOX`);
            console.log(`  🔍 Action: Skipped to prevent 403 error`);
            continue; // Skip this token to prevent 403 errors
          }
        }
        
        await this.sendToDevice(tokenRecord.deviceToken, payload, userId);
      }

      return true;
    } catch (error) {
      console.error('[PushNotificationService] Error sending notification to user:', error);
      return false;
    }
  }

  async sendToMultipleUsers(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    console.log(`[PushNotificationService] 🔍 DEBUG: Starting notification send to ${userIds.length} users`);
    console.log(`[PushNotificationService] 🔍 DEBUG: Target user IDs: ${userIds.join(', ')}`);
    console.log(`[PushNotificationService] 🔍 DEBUG: Notification: "${payload.title}" - "${payload.body}"`);
    
    const promises = userIds.map((userId, index) => {
      console.log(`[PushNotificationService] 🔍 DEBUG: Processing user ${index + 1}/${userIds.length}: ${userId}`);
      return this.sendToUser(userId, payload);
    });
    
    await Promise.all(promises);
    console.log(`[PushNotificationService] 🔍 DEBUG: Completed notification send to all ${userIds.length} users`);
  }

  private async sendToDevice(deviceToken: string, payload: PushNotificationPayload, userId?: string): Promise<boolean> {
    try {
      const userInfo = userId ? ` (for user ${userId})` : '';
      console.log(`[PushNotificationService] 🔍 DEBUG: sendToDevice called with token ${deviceToken.substring(0, 20)}...${userInfo}`);
      
      if (this.apnProvider === null || this.apnProvider === undefined || typeof this.apnProvider !== 'object') {
        // Enhanced simulation mode - APNs not properly initialized
        const reason = this.apnProvider === null ? 'APNs initialization failed or credentials not configured' : 'APNs provider invalid';
          
        console.log(`[PushNotificationService] 📱 SIMULATION MODE (${reason})`);
        console.log(`  📤 Would send to device: ${deviceToken.substring(0, 10)}...${deviceToken.substring(-4)}${userInfo}`);
        console.log(`  📋 Title: ${payload.title}`);
        console.log(`  📝 Body: ${payload.body}`);
        console.log(`  🏷️ Category: ${payload.category || 'default'}`);
        console.log(`  📊 Data:`, JSON.stringify(payload.data, null, 2));
        console.log(`  🔧 Environment: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'}`);
        console.log('  ✅ SIMULATION: Notification would be delivered successfully');
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

      // COMPREHENSIVE APNS REQUEST LOGGING
      const tokenHash = deviceToken.substring(0, 8);
      const apnsId = `apns-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[PushNotificationService] 📤 OUTGOING APNs REQUEST:`);
      console.log(`  🔍 Request ID: ${apnsId}`);
      console.log(`  🔍 Target Device: ${tokenHash}...${userInfo}`);
      console.log(`  🔍 Endpoint: api.sandbox.push.apple.com (SANDBOX - forced in development)`);
      console.log(`  🔍 Auth Method: JWT (p8 key)`);
      console.log(`  🔍 Team ID: ${process.env.APNS_TEAM_ID}`);
      console.log(`  🔍 Key ID: ${process.env.APNS_KEY_ID}`);
      console.log(`  🔍 Topic (Bundle ID): ${notification.topic}`);
      console.log(`  🔍 Push Type: alert`);
      console.log(`  🔍 Priority: 10`);
      console.log(`  🔍 Payload Size: ${JSON.stringify(notification.payload).length} bytes`);
      console.log(`  🔍 Title: "${payload.title}"`);
      console.log(`  🔍 Body: "${payload.body}"`);
      console.log(`  🔍 Badge: ${notification.badge}`);
      console.log(`  🔍 Sound: ${notification.sound}`)
      
      const startTime = Date.now();
      const result = await this.apnProvider.send(notification, deviceToken);
      const duration = Date.now() - startTime;
      
      // COMPREHENSIVE APNS RESPONSE LOGGING
      console.log(`[PushNotificationService] 📥 APNs RESPONSE (${duration}ms):`);
      console.log(`  🔍 Request ID: ${apnsId}`);
      console.log(`  🔍 Sent: ${result.sent.length}, Failed: ${result.failed.length}`);
      
      if (result.failed.length > 0) {
        console.error(`[PushNotificationService] ❌ FAILED DELIVERIES:`);
        result.failed.forEach((failure) => {
          console.error(`  🔍 Request ID: ${apnsId}`);
          console.error(`  🔍 Device: ${tokenHash}...${userInfo}`);
          console.error(`  🔍 HTTP Status: ${failure.status}`);
          console.error(`  🔍 APNs Reason: ${failure.response?.reason || 'Unknown'}`);
          console.error(`  🔍 Response Headers: ${JSON.stringify(failure.response || {}, null, 2)}`);
          console.error(`  🔍 Timestamp: ${new Date().toISOString()}`)
          
          // Enhanced error analysis
          const status = String(failure.status);
          const reason = failure.response?.reason;
          
          if (status === '403') {
            console.error(`  🔍 403 FORBIDDEN - Detailed Analysis:`);
            if (reason === 'InvalidProviderToken') {
              console.error(`    ❌ Auth Issue: JWT token invalid (check Key ID, Team ID, private key)`);
            } else if (reason === 'BadDeviceToken') {
              console.error(`    ❌ Token Issue: Device token invalid or expired`);
            } else if (reason === 'TopicDisallowed') {
              console.error(`    ❌ Topic Issue: Bundle ID mismatch or unauthorized topic`);
            } else {
              console.error(`    ❌ Environment Issue: Token/Server environment mismatch`);
              console.error(`    ❌ Server: SANDBOX (development mode)`);
              console.error(`    ❌ Token likely from: PRODUCTION environment`);
              console.error(`    ❌ Solution: Regenerate token with development provisioning profile`);
            }
          } else if (status === '400') {
            console.error(`  🔍 400 BAD REQUEST: ${reason || 'Malformed request'}`);
          } else if (status === '410') {
            console.error(`  🔍 410 GONE: Device token no longer valid (app uninstalled)`);
          } else if (status === '413') {
            console.error(`  🔍 413 PAYLOAD TOO LARGE: Notification payload exceeds 4KB limit`);
          } else if (status === '429') {
            console.error(`  🔍 429 RATE LIMITED: Too many requests for this device token`);
          } else if (status === '500') {
            console.error(`  🔍 500 INTERNAL ERROR: APNs server issue (retry recommended)`);
          }
          
          console.error(`  🔍 Full Response:`, JSON.stringify(failure.response, null, 2));
        });
        return false;
      }

      if (result.sent.length > 0) {
        console.log(`[PushNotificationService] ✅ SUCCESSFUL DELIVERIES:`);
        result.sent.forEach((sent) => {
          console.log(`  🔍 Request ID: ${apnsId}`);
          console.log(`  🔍 Device: ${tokenHash}...${userInfo}`);
          console.log(`  🔍 APNs ID: ${sent.device}`);
          console.log(`  🔍 Status: Delivered successfully`);
        });
      }
      
      return true;
    } catch (error) {
      console.error(`[PushNotificationService] Error sending to device${userId ? ` (user ${userId})` : ''}:`, error);
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