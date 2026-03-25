import apn from 'node-apn';
import fs from 'fs';
import { db } from './db';
import { deviceTokens } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
  private isProductionMode: boolean = false; // Track APNs environment

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
        
        // Fix line breaks if the key is on a single line (common with environment variables)
        if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('\n')) {
          privateKey = privateKey
            .replace('-----BEGIN PRIVATE KEY----- ', '-----BEGIN PRIVATE KEY-----\n')
            .replace(' -----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
            .replace(/(.{64})/g, '$1\n') // Add line breaks every 64 characters for the key body
            .replace(/\n-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----'); // Fix the end marker
        }
        
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = privateKey.replace(/-----BEGIN.*?-----/, '-----BEGIN PRIVATE KEY-----');
          privateKey = privateKey.replace(/-----END.*?-----/, '-----END PRIVATE KEY-----');
        }
        
        // Determine APNs environment
        // APNS_PRODUCTION env var overrides NODE_ENV-based detection
        // Set APNS_PRODUCTION=false for staging deployments with debug builds
        const apnsProductionEnv = process.env.APNS_PRODUCTION;
        let isProductionAPNs: boolean;
        
        if (apnsProductionEnv !== undefined) {
          // Explicit override via environment variable
          isProductionAPNs = apnsProductionEnv === 'true';
          console.log(`[PushNotificationService] APNs mode explicitly set via APNS_PRODUCTION=${apnsProductionEnv}`);
        } else {
          // Default: use NODE_ENV
          isProductionAPNs = process.env.NODE_ENV === 'production';
          console.log(`[PushNotificationService] APNs mode derived from NODE_ENV=${process.env.NODE_ENV}`);
        }
        
        const options = {
          token: {
            key: privateKey,
            keyId: process.env.APNS_KEY_ID!,
            teamId: process.env.APNS_TEAM_ID!,
          },
          production: isProductionAPNs, // true for TestFlight/App Store, false for development/staging
        };
        
        this.apnProvider = new apn.Provider(options);
        this.isProductionMode = isProductionAPNs; // Store for token filtering
        const envMode = isProductionAPNs ? 'PRODUCTION' : 'SANDBOX';
        const endpoint = isProductionAPNs ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
        console.log(`[PushNotificationService] ✅ APNs ENABLED: Initialized with environment key (${envMode} mode - ${endpoint})`);
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

  private async markTokenInactive(token: string, reason: string): Promise<void> {
    try {
      console.log(`[PushNotificationService] 🗑️ Marking token as inactive: ${token.substring(0, 16)}...`);
      console.log(`  🔍 Reason: ${reason}`);
      
      await db.update(deviceTokens)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(deviceTokens.deviceToken, token));
      
      console.log(`[PushNotificationService] ✅ Token marked inactive successfully`);
    } catch (error) {
      console.error(`[PushNotificationService] ❌ Failed to mark token inactive:`, error);
    }
  }

  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      console.log(`[PushNotificationService] 🔍 DEBUG: Processing notification for user ${userId}`);
      
      // Get user's ACTIVE device tokens only (inactive tokens are skipped)
      const userTokens = await db
        .select()
        .from(deviceTokens)
        .where(and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.isActive, true)
        ));

      console.log(`[PushNotificationService] 🔍 DEBUG: Found ${userTokens.length} device token(s) for user ${userId}`);
      
      if (userTokens.length === 0) {
        console.log(`[PushNotificationService] No device tokens found for user ${userId}`);
        return false;
      }

      // ENVIRONMENT GUARDRAILS: Filter tokens by environment compatibility (Issue 1 fix)
      const serverIsSandbox = !this.isProductionMode; // Use actual APNs configuration
      const compatibleTokens = userTokens.filter(token => {
        if (token.platform !== 'ios') return true; // Non-iOS tokens are always compatible
        
        // For production mode, we want production tokens (isSandbox = false)
        // For sandbox mode, we want sandbox tokens (isSandbox = true)
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
          const serverEnv = this.isProductionMode ? 'PRODUCTION' : 'SANDBOX';
          
          // Skip if there's an environment mismatch
          const tokenIsProduction = tokenRecord.isSandbox === false;
          const serverIsProduction = this.isProductionMode;
          
          if (tokenIsProduction !== serverIsProduction) {
            console.log(`[PushNotificationService] ⚠️ GUARDRAIL TRIGGERED: Skipping ${tokenEnv} token on ${serverEnv} server`);
            console.log(`  🔍 Token: ${tokenRecord.deviceToken.substring(0, 8)}... is ${tokenEnv}`);
            console.log(`  🔍 Server: ${serverEnv}`);
            console.log(`  🔍 Action: Skipped to prevent 403 error`);
            continue; // Skip this token to prevent 403 errors
          }
        }
        
        await this.sendToDevice(tokenRecord.deviceToken, payload, userId, tokenRecord.bundleId || undefined);
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

  private async sendToDevice(deviceToken: string, payload: PushNotificationPayload, userId?: string, bundleId?: string): Promise<boolean> {
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
      // Use token's bundle ID if provided, otherwise fall back to env var or default
      notification.topic = bundleId || process.env.APNS_TOPIC || 'com.porfirio.will';
      notification.payload = payload.data || {};

      // COMPREHENSIVE APNS REQUEST LOGGING
      const tokenHash = deviceToken.substring(0, 8);
      const apnsId = `apns-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[PushNotificationService] 📤 OUTGOING APNs REQUEST:`);
      console.log(`  🔍 Request ID: ${apnsId}`);
      console.log(`  🔍 Target Device: ${tokenHash}...${userInfo}`);
      const envMode = this.isProductionMode ? 'PRODUCTION' : 'SANDBOX';
      const endpoint = this.isProductionMode ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
      console.log(`  🔍 Endpoint: ${endpoint} (${envMode})`);
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
        for (const failure of result.failed) {
          console.error(`  🔍 Request ID: ${apnsId}`);
          console.error(`  🔍 Device: ${tokenHash}...${userInfo}`);
          console.error(`  🔍 HTTP Status: ${failure.status}`);
          console.error(`  🔍 APNs Reason: ${failure.response?.reason || 'Unknown'}`);
          console.error(`  🔍 Response Headers: ${JSON.stringify(failure.response || {}, null, 2)}`);
          console.error(`  🔍 Timestamp: ${new Date().toISOString()}`)
          
          const status = String(failure.status);
          const reason = failure.response?.reason;
          
          if (status === '403') {
            console.error(`  🔍 403 FORBIDDEN - Detailed Analysis:`);
            if (reason === 'InvalidProviderToken') {
              console.error(`    ❌ Auth Issue: JWT token invalid (check Key ID, Team ID, private key)`);
            } else if (reason === 'BadDeviceToken') {
              console.error(`    ❌ Token Issue: Device token invalid or expired`);
              await this.markTokenInactive(deviceToken, 'BadDeviceToken (403)');
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
            if (reason === 'BadDeviceToken') {
              await this.markTokenInactive(deviceToken, 'BadDeviceToken (400)');
            }
          } else if (status === '410') {
            console.error(`  🔍 410 GONE: Device token no longer valid (app uninstalled)`);
            await this.markTokenInactive(deviceToken, 'Unregistered (410)');
          } else if (status === '413') {
            console.error(`  🔍 413 PAYLOAD TOO LARGE: Notification payload exceeds 4KB limit`);
          } else if (status === '429') {
            console.error(`  🔍 429 RATE LIMITED: Too many requests for this device token`);
          } else if (status === '500') {
            console.error(`  🔍 500 INTERNAL ERROR: APNs server issue (retry recommended)`);
          }
          
          console.error(`  🔍 Full Response:`, JSON.stringify(failure.response, null, 2));
        }
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
  async sendWillProposedNotification(creatorName: string, circleMembers: string[], willId?: number, isSharedWill: boolean = false, circleId?: number): Promise<void> {
    const payload: PushNotificationPayload = {
      title: isSharedWill ? "New Shared Will proposed! 📝" : "New Will proposed! 📝",
      body: isSharedWill 
        ? `${creatorName} proposed a new Shared Will for your circle`
        : `${creatorName} has proposed starting a new Will`,
      category: 'will_proposed',
      data: {
        type: 'will_proposed',
        creatorName,
        willId: willId?.toString() || '',
        circleId: circleId?.toString() || '',
        isSoloMode: 'false',
        isSharedWill: isSharedWill ? 'true' : 'false',
        deepLink: willId ? `/will/${willId}/commit` : (circleId ? `/circles/${circleId}` : '/circles'),
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  async sendWillStartedNotification(willTitle: string, committedMembers: string[], willId?: number, isSoloMode: boolean = false, circleId?: number): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Your Will has started! 🎯",
      body: `Time to begin your commitment: "${willTitle}"`,
      category: 'will_started',
      data: {
        type: 'will_started',
        willTitle,
        willId: willId?.toString() || '',
        circleId: circleId?.toString() || '',
        isSoloMode: isSoloMode ? 'true' : 'false',
        deepLink: willId ? `/will/${willId}` : (isSoloMode ? '/solo/hub' : (circleId ? `/circles/${circleId}` : '/circles')),
      }
    };

    await this.sendToMultipleUsers(committedMembers, payload);
  }

  async sendEndRoomNotification(type: '24_hours' | '15_minutes' | 'live', endRoomTime: string, circleMembers: string[], willId?: number, circleId?: number): Promise<void> {
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
        willId: willId?.toString() || '',
        circleId: circleId?.toString() || '',
        isSoloMode: 'false',
        deepLink: willId ? `/will/${willId}` : (circleId ? `/circles/${circleId}` : '/circles'),
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  async sendReadyForNewWillNotification(circleMembers: string[], circleId?: number): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Ready for new Will! 🚀",
      body: "All members acknowledged - you can start a new Will!",
      category: 'ready_for_new_will',
      data: {
        type: 'ready_for_new_will',
        circleId: circleId?.toString() || '',
        isSoloMode: 'false',
        deepLink: circleId ? `/circles/${circleId}` : '/circles',
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  async sendTeamPushNotification(pusherName: string, willTitle: string, circleMembers: string[], willId?: number, circleId?: number): Promise<void> {
    const payload: PushNotificationPayload = {
      title: `${pusherName} has pushed you! 🚀`,
      body: `Encouragement for your Will: "${willTitle}"`,
      category: 'team_push',
      data: {
        type: 'team_push',
        pusherName,
        willTitle,
        willId: willId?.toString() || '',
        circleId: circleId?.toString() || '',
        isSoloMode: 'false',
        deepLink: willId ? `/will/${willId}` : (circleId ? `/circles/${circleId}` : '/circles'),
      }
    };

    await this.sendToMultipleUsers(circleMembers, payload);
  }

  // NOTIFICATION: Will Review Required (fires when Will ENDS and status → will_review)
  async sendWillReviewRequiredNotification(willId: number, participants: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Your will has ended",
      body: "Please review and reflect on your journey.",
      category: 'will_review_required',
      data: {
        type: 'will_review_required',
        willId: willId.toString(),
        deepLink: `/will/${willId}/review`
      }
    };

    await this.sendToMultipleUsers(participants, payload);
  }

  // NEW NOTIFICATION #2: Commitment Reminder (6hrs after Will creation)
  async sendCommitmentReminderNotification(willId: number, uncommittedUsers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Your Circle is waiting 🤝",
      body: "Your Circle is waiting for your commitment.",
      category: 'commitment_reminder',
      data: {
        type: 'commitment_reminder',
        willId: willId.toString(),
        deepLink: `/will/${willId}/commit`
      }
    };

    await this.sendToMultipleUsers(uncommittedUsers, payload);
  }

  // NOTIFICATION: Will Review Reminder (6hrs after Will ends, for users who haven't submitted review)
  async sendWillReviewReminderNotification(willId: number, usersWithoutReview: string[], isSoloMode: boolean = false): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Review reminder",
      body: isSoloMode 
        ? "Don't forget to submit your Will review!" 
        : "Your Circle is waiting for your review.",
      category: 'will_review_reminder',
      data: {
        type: 'will_review_reminder',
        willId: willId.toString(),
        deepLink: `/will/${willId}/review`
      }
    };

    await this.sendToMultipleUsers(usersWithoutReview, payload);
  }

  async sendFinalReviewWarningNotification(willId: number, usersWithoutReview: string[], isSoloMode: boolean = false): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Last chance to review",
      body: isSoloMode
        ? "Your review will be auto-completed tomorrow if not submitted."
        : "Your Circle is waiting. Your review will be auto-completed tomorrow.",
      category: 'will_review_reminder',
      data: {
        type: 'will_review_reminder',
        willId: willId.toString(),
        deepLink: `/will/${willId}/review`
      }
    };

    await this.sendToMultipleUsers(usersWithoutReview, payload);
  }

  // NEW NOTIFICATION #4: Circle Member Joined
  async sendCircleMemberJoinedNotification(memberName: string, circleId: number, existingMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "New Circle member! 👋",
      body: `${memberName} joined your Circle.`,
      category: 'circle_member_joined',
      data: {
        type: 'circle_member_joined',
        memberName,
        circleId: circleId.toString(),
        deepLink: `/circles/${circleId}`
      }
    };

    await this.sendToMultipleUsers(existingMembers, payload);
  }

  // NEW NOTIFICATION #5: Member Review Submitted
  async sendMemberReviewSubmittedNotification(reviewerName: string, willId: number, otherMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Review submitted 📝",
      body: `${reviewerName} completed their Will review.`,
      category: 'member_review_submitted',
      data: {
        type: 'member_review_submitted',
        reviewerName,
        willId: willId.toString(),
        deepLink: `/will/${willId}/review`
      }
    };

    await this.sendToMultipleUsers(otherMembers, payload);
  }

  async sendWillLeftNotification(leaverName: string, willId: number, otherMembers: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Will ended",
      body: `${leaverName} left the Will. The Will has ended for everyone.`,
      category: 'will_left',
      data: {
        type: 'will_left',
        leaverName,
        willId: willId.toString(),
        deepLink: `/will/${willId}`
      }
    };

    await this.sendToMultipleUsers(otherMembers, payload);
  }

  async sendPublicWillJoinedNotification(joinerName: string, parentWillId: number, otherParticipants: string[], willTitle?: string): Promise<void> {
    const titleText = willTitle ? `'${willTitle}'` : 'your public Will';
    const payload: PushNotificationPayload = {
      title: "New participant! 🎉",
      body: `${joinerName} joined ${titleText}`,
      category: 'public_will_joined',
      data: {
        type: 'public_will_joined',
        joinerName,
        willId: parentWillId.toString(),
        deepLink: `/will/${parentWillId}`
      }
    };

    await this.sendToMultipleUsers(otherParticipants, payload);
  }

  async sendPublicWillLeftNotification(leaverName: string, parentWillId: number, otherParticipants: string[], willTitle?: string): Promise<void> {
    const titleText = willTitle ? `'${willTitle}'` : 'the public Will';
    const payload: PushNotificationPayload = {
      title: "Participant left",
      body: `${leaverName} left ${titleText}`,
      category: 'public_will_left',
      data: {
        type: 'public_will_left',
        leaverName,
        willId: parentWillId.toString(),
        deepLink: `/will/${parentWillId}`
      }
    };

    await this.sendToMultipleUsers(otherParticipants, payload);
  }

  async sendNewPublicWillNotification(creatorName: string, willTitle: string, willId: number, userIds: string[]): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "New Public Will! 🌍",
      body: `${creatorName} posted: "${willTitle}". Join them on Explore!`,
      category: 'new_public_will',
      data: {
        type: 'new_public_will',
        willId: willId.toString(),
        creatorName,
        willTitle,
        deepLink: '/explore',
      }
    };

    await this.sendToMultipleUsers(userIds, payload);
  }

  // Midpoint milestone notification — factual time-remaining with will statement
  async sendMidpointMilestoneNotification(willId: number, committedMembers: string[], endDate: Date, willWhat?: string): Promise<void> {
    const now = new Date();
    const remainingMs = Math.max(0, endDate.getTime() - now.getTime());
    const remainingTotalHours = remainingMs / (1000 * 60 * 60);
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    let timeRemaining: string;
    if (remainingDays >= 2) {
      timeRemaining = `${remainingDays} days remaining`;
    } else if (remainingTotalHours >= 1) {
      const hours = Math.ceil(remainingTotalHours);
      timeRemaining = `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
    } else {
      timeRemaining = `Less than an hour remaining`;
    }

    let body = timeRemaining;
    if (willWhat) {
      const truncatedWhat = willWhat.length > 80 ? willWhat.substring(0, 77) + '...' : willWhat;
      body = `${timeRemaining} — ${truncatedWhat}`;
    }

    const payload: PushNotificationPayload = {
      title: "Your will ends soon",
      body,
      category: 'will_midpoint',
      data: {
        type: 'will_midpoint',
        willId: willId.toString(),
        deepLink: `/will/${willId}`
      }
    };

    await this.sendToMultipleUsers(committedMembers, payload);
  }

  async sendDailyReminderNotification(userId: string, willId?: number): Promise<boolean> {
    const payload: PushNotificationPayload = {
      title: "Have you honored your will today?",
      body: "Tap to check in and log your progress.",
      category: 'daily_reminder',
      data: {
        type: 'daily_reminder',
        willId: willId?.toString() || '',
        deepLink: willId ? `/will/${willId}?action=checkin` : '/solo/hub'
      }
    };

    return await this.sendToUser(userId, payload);
  }

  // Motivational notification — displays the user's "because" statement
  async sendMotivationalNotification(userId: string, userWhy: string, willId?: number): Promise<boolean> {
    let notificationBody = `Because ${userWhy}`;
    if (notificationBody.length > 110) {
      notificationBody = notificationBody.substring(0, 107) + "...";
    }

    const payload: PushNotificationPayload = {
      title: "\u{1F90D}",
      body: notificationBody,
      category: 'motivational',
      data: {
        type: 'motivational',
        willId: willId?.toString() || '',
        deepLink: willId ? `/will/${willId}` : '/solo/hub'
      }
    };

    return await this.sendToUser(userId, payload);
  }
  async sendWillMessageNotification(senderName: string, willId: number, messagePreview: string, otherParticipants: string[]): Promise<void> {
    const truncatedPreview = messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview;

    const payload: PushNotificationPayload = {
      title: `${senderName} sent a message`,
      body: truncatedPreview,
      category: 'will_message',
      data: {
        type: 'will_message',
        willId: willId.toString(),
        senderName,
        deepLink: `/will/${willId}/messages`,
      }
    };

    await this.sendToMultipleUsers(otherParticipants, payload);
  }

  async sendCircleMessageNotification(senderName: string, circleId: number, messagePreview: string, otherMembers: string[]): Promise<void> {
    const truncatedPreview = messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview;

    const payload: PushNotificationPayload = {
      title: `${senderName} sent a message`,
      body: truncatedPreview,
      category: 'circle_message',
      data: {
        type: 'circle_message',
        circleId: circleId.toString(),
        senderName,
        deepLink: `/circles/${circleId}/messages`,
      }
    };

    await this.sendToMultipleUsers(otherMembers, payload);
  }
}

export const pushNotificationService = new PushNotificationService();