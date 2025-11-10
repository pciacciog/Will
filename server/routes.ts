import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertCircleSchema, 
  insertWillSchema,
  insertWillCommitmentSchema,
  insertWillAcknowledgmentSchema,
  insertDailyProgressSchema,
  insertWillPushSchema,
  insertBlogPostSchema,
  insertPageContentSchema,
  insertDeviceTokenSchema,
  willCommitments,
  deviceTokens,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "./auth";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";
import { dailyService } from "./daily";
import { pushNotificationService } from "./pushNotificationService";

function generateInviteCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function getWillStatus(will: any, memberCount: number): string {
  const now = new Date();
  const startDate = new Date(will.startDate);
  const endDate = new Date(will.endDate);

  // If the will has an explicit status of 'completed', respect it (for legacy wills)
  if (will.status === 'completed') {
    return 'completed';
  }

  // If the will has End Room data, use the will's status directly
  if (will.endRoomScheduledAt) {
    return will.status || 'waiting_for_end_room';
  }

  if (now >= endDate) {
    return 'waiting_for_end_room'; // Will transition to completed after End Room
  } else if (now >= startDate) {
    return 'active';
  } else {
    // Check commitment count to determine pending vs scheduled
    const commitmentCount = will.commitments?.length || 0;
    if (commitmentCount < memberCount) {
      return 'pending';
    } else {
      return 'scheduled';
    }
  }
}



export async function registerRoutes(app: Express): Promise<Server> {
  // Use local authentication only - bypass Replit auth
  setupAuth(app);

  // Auth routes are handled by setupAuth

  // Health check endpoint - verify environment and database connection
  app.get('/api/health', async (req, res) => {
    const env = process.env.NODE_ENV || 'development';
    const databaseType = env === 'staging' ? 'staging' : (env === 'production' ? 'production' : 'development');
    
    try {
      // Test database connection with a simple query
      const result = await db.execute('SELECT 1 as health');
      
      res.json({
        status: 'ok',
        environment: env,
        database: databaseType,
        databaseConnected: true,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          daily: process.env.DAILY_API_KEY ? 'configured' : 'simulation',
          pushNotifications: process.env.APNS_PRIVATE_KEY ? 'configured' : 'simulation'
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        environment: env,
        database: databaseType,
        databaseConnected: false,
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Update profile route
  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      // Check if email is already taken by another user
      if (email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email is already taken" });
        }
      }

      // Update profile
      const updatedUser = await storage.updateUserProfile(userId, { firstName, lastName, email });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Password change route
  app.post('/api/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import password comparison function from auth module
      const { comparePasswords, hashPassword } = await import('./auth');
      
      // Verify current password
      const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password in database
      await storage.updateUserPassword(userId, hashedNewPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Delete account route
  app.delete('/api/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password confirmation is required to delete account" });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import password comparison function from auth module
      const { comparePasswords } = await import('./auth');
      
      // Verify password
      const isPasswordValid = await comparePasswords(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Password is incorrect" });
      }

      // Delete all user data
      await storage.deleteUser(userId);

      // Logout user by destroying session
      req.logout((err: any) => {
        if (err) {
          console.error("Error during logout after account deletion:", err);
        }
      });
      
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Client log bridge endpoint
  app.post('/api/logs', async (req: any, res) => {
    try {
      const { level = 'info', message, source = 'client', timestamp, userAgent } = req.body;
      
      // Format client log for server console
      const clientInfo = userAgent ? ` [${userAgent}]` : '';
      const logMessage = `[Client${clientInfo}] ${message}`;
      
      // Output to server console based on level
      switch (level) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        default:
          console.log(logMessage);
          break;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing client log:", error);
      res.status(500).json({ message: "Failed to process log" });
    }
  });

  // Circle routes
  app.post('/api/circles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if user is already in a circle
      const existingCircle = await storage.getUserCircle(userId);
      if (existingCircle) {
        return res.status(400).json({ message: "You're already a member of a circle" });
      }

      // Generate unique invite code
      let inviteCode: string;
      let isUnique = false;
      do {
        inviteCode = generateInviteCode();
        const existingCircle = await storage.getCircleByInviteCode(inviteCode);
        isUnique = !existingCircle;
      } while (!isUnique);

      // Create circle
      const circle = await storage.createCircle({
        inviteCode,
        createdBy: userId,
      });

      // Add creator as first member
      await storage.addCircleMember({
        circleId: circle.id,
        userId,
      });

      const circleWithMembers = await storage.getUserCircle(userId);
      res.json(circleWithMembers);
    } catch (error) {
      console.error("Error creating circle:", error);
      res.status(500).json({ message: "Failed to create circle" });
    }
  });

  app.post('/api/circles/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { inviteCode } = req.body;

      if (!inviteCode) {
        return res.status(400).json({ message: "Invite code is required" });
      }

      // Check if user is already in a circle
      const existingUserCircle = await storage.getUserCircle(userId);
      if (existingUserCircle) {
        return res.status(400).json({ message: "You're already a member of a circle" });
      }

      // Find circle by invite code
      const circle = await storage.getCircleByInviteCode(inviteCode.toUpperCase());
      if (!circle) {
        return res.status(404).json({ message: "No circle found with that code" });
      }

      // Check if circle is full
      const memberCount = await storage.getCircleMemberCount(circle.id);
      if (memberCount >= 4) {
        return res.status(400).json({ message: "This Circle is full" });
      }

      // Check if user is already in this circle
      const isAlreadyMember = await storage.isUserInCircle(userId, circle.id);
      if (isAlreadyMember) {
        return res.status(400).json({ message: "You're already a member of this circle" });
      }

      // Add user to circle
      await storage.addCircleMember({
        circleId: circle.id,
        userId,
      });

      // ISSUE FIX: Recalculate will status when new member joins
      // When a new member joins, a "scheduled" will (all previous members committed) should revert to "pending"
      // Only recalculate for pending/scheduled wills - never for active/completed/archived wills
      const activeWill = await storage.getCircleActiveWill(circle.id);
      if (activeWill && (activeWill.status === 'pending' || activeWill.status === 'scheduled')) {
        // Get will with commitments to calculate correct status
        const willWithCommitments = await storage.getWillWithCommitments(activeWill.id);
        if (willWithCommitments) {
          // Get NEW member count (after adding the user)
          const newMemberCount = await storage.getCircleMemberCount(circle.id);
          
          // Calculate what the status SHOULD be based on current state
          const calculatedStatus = getWillStatus(willWithCommitments, newMemberCount);
          
          // Only update if the calculated status differs from database status
          if (calculatedStatus !== activeWill.status) {
            await storage.updateWillStatus(activeWill.id, calculatedStatus);
            console.log(`[Join Circle] Will ${activeWill.id} status updated: ${activeWill.status} → ${calculatedStatus} (new member joined, ${newMemberCount} members total)`);
          }
        }
      }

      const circleWithMembers = await storage.getUserCircle(userId);
      res.json(circleWithMembers);
    } catch (error) {
      console.error("Error joining circle:", error);
      res.status(500).json({ message: "Failed to join circle" });
    }
  });

  app.get('/api/circles/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const circle = await storage.getUserCircle(userId);
      res.json(circle);
    } catch (error) {
      console.error("Error fetching user circle:", error);
      res.status(500).json({ message: "Failed to fetch circle" });
    }
  });

  app.post('/api/circles/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's current circle
      const circle = await storage.getUserCircle(userId);
      if (!circle) {
        return res.status(404).json({ message: "You are not a member of any circle" });
      }

      // Check if there are active wills
      const activeWill = await storage.getCircleActiveWill(circle.id);
      if (activeWill && (activeWill.status === 'active' || activeWill.status === 'scheduled')) {
        return res.status(400).json({ message: "Cannot leave circle while there is an active or scheduled will" });
      }

      // Remove user from circle (this will be handled by deleting the circle member record)
      await storage.removeCircleMember(userId, circle.id);

      res.json({ message: "Successfully left the circle" });
    } catch (error) {
      console.error("Error leaving circle:", error);
      res.status(500).json({ message: "Failed to leave circle" });
    }
  });

  // Will routes
  app.post('/api/wills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Prepare will data with proper types
      const willDataWithDefaults = {
        title: req.body.title,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        createdBy: userId,
        circleId: 0, // Will be set below after getting circle
        endRoomScheduledAt: req.body.endRoomScheduledAt ? new Date(req.body.endRoomScheduledAt) : null,
      };
      
      console.log("Will data before validation:", willDataWithDefaults);

      // Get user's circle
      const circle = await storage.getUserCircle(userId);
      if (!circle) {
        return res.status(400).json({ message: "You must be in a circle to create a Will" });
      }

      // Check if circle already has an active will
      const existingWill = await storage.getCircleActiveWill(circle.id);
      if (existingWill) {
        // If will is completed, check if all committed members have acknowledged
        if (existingWill.status === 'completed') {
          const existingWillWithCommitments = await storage.getWillWithCommitments(existingWill.id);
          const commitmentCount = existingWillWithCommitments?.commitments?.length || 0;
          const acknowledgedCount = await storage.getWillAcknowledgmentCount(existingWill.id);
          
          if (acknowledgedCount < commitmentCount) {
            return res.status(400).json({ 
              message: "Cannot create new Will until all committed members acknowledge completion of the current one",
              requiresAcknowledgment: true,
              acknowledgedCount,
              commitmentCount
            });
          }
        } else {
          return res.status(400).json({ message: "Your circle already has an active Will" });
        }
      }

      // Set circle ID and validate
      willDataWithDefaults.circleId = circle.id;
      const willData = insertWillSchema.parse(willDataWithDefaults);
      
      // Create will
      const will = await storage.createWill(willData);

      // Create End Room if scheduled
      if (req.body.endRoomScheduledAt) {
        try {
          const endRoomTime = new Date(req.body.endRoomScheduledAt);
          const willEndDate = new Date(req.body.endDate);
          
          // Validate End Room scheduling rules
          if (!dailyService.isValidEndRoomTime(willEndDate, endRoomTime)) {
            return res.status(400).json({ 
              error: 'End Room must be scheduled between the Will end time and 48 hours afterward' 
            });
          }
          
          const endRoom = await dailyService.createEndRoom({
            willId: will.id,
            scheduledStart: endRoomTime,
          });
          
          // Update will with End Room details
          await storage.updateWillEndRoom(will.id, {
            endRoomScheduledAt: endRoomTime,
            endRoomUrl: endRoom.url,
            endRoomStatus: 'pending',
          });
          
          console.log(`Created End Room for Will ${will.id}: ${endRoom.url}`);
        } catch (error) {
          console.error('Error creating End Room:', error);
          // Continue without End Room - will creation should still succeed
        }
      }

      // Send push notifications to other circle members
      try {
        console.log("Attempting to send push notifications...");
        const members = await storage.getCircleMembers(circle.id);
        console.log("Circle members found:", members?.length);
        
        const otherMembers = members
          .filter(member => member.userId !== userId)
          .map(member => member.userId);
        
        console.log("Other members to notify:", otherMembers.length);
        
        if (otherMembers.length > 0) {
          const creator = await storage.getUser(userId);
          console.log("Creator found:", creator?.firstName, creator?.lastName);
          
          const creatorName = creator ? creator.firstName : 'Someone';
          await pushNotificationService.sendWillProposedNotification(creatorName, otherMembers);
          console.log(`Sent Will proposed notifications to ${otherMembers.length} members`);
        } else {
          console.log("No other members to notify");
        }
      } catch (notificationError) {
        console.error("Error sending will proposed notifications:", notificationError);
        console.error("Notification error stack:", (notificationError as Error).stack);
        // Don't fail the will creation if notifications fail
      }

      res.json(will);
    } catch (error) {
      console.error("Error creating will:", error);
      res.status(500).json({ message: "Failed to create will" });
    }
  });

  app.post('/api/wills/:id/commitments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      const commitmentData = insertWillCommitmentSchema.parse({
        ...req.body,
        willId,
        userId,
      });

      // Check if user already committed
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (hasCommitted) {
        return res.status(400).json({ message: "You have already committed to this Will" });
      }

      // Add commitment
      const commitment = await storage.addWillCommitment(commitmentData);

      // Check if all members have committed
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      const circle = await storage.getCircleById(will.circleId);
      if (!circle) {
        return res.status(404).json({ message: "Circle not found" });
      }

      const memberCount = await storage.getCircleMemberCount(will.circleId);
      const commitmentCount = await storage.getWillCommitmentCount(willId);

      // If all members have committed, mark as scheduled
      if (commitmentCount >= memberCount) {
        await storage.updateWillStatus(willId, 'scheduled');
      }

      res.json(commitment);
    } catch (error) {
      console.error("Error adding commitment:", error);
      res.status(500).json({ message: "Failed to add commitment" });
    }
  });

  app.get('/api/wills/circle/:circleId', isAuthenticated, async (req: any, res) => {
    try {
      const circleId = parseInt(req.params.circleId);
      const will = await storage.getCircleActiveWill(circleId);
      
      if (!will) {
        return res.json(null);
      }

      // Get will with commitments for accurate status
      const willWithCommitments = await storage.getWillWithCommitments(will.id);
      const memberCount = await storage.getCircleMemberCount(circleId);
      const commitmentCount = willWithCommitments?.commitments?.length || 0;
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(will.id);
      
      const status = getWillStatus(willWithCommitments, memberCount);
      
      // Auto-update will status if it has transitioned based on time
      if (willWithCommitments && status === 'active' && willWithCommitments.status !== 'active') {
        await storage.updateWillStatus(will.id, 'active');
      } else if (willWithCommitments && status === 'completed' && willWithCommitments.status !== 'completed') {
        await storage.updateWillStatus(will.id, 'completed');
      }
      
      // Check if will should be archived (all committed members acknowledged)
      if (willWithCommitments && willWithCommitments.status === 'completed' && acknowledgedCount >= commitmentCount) {
        await storage.updateWillStatus(will.id, 'archived');
        // Return null to indicate no active will - this allows new Will creation
        return res.json(null);
      }
      
      // Add user acknowledgment status
      const hasUserAcknowledged = await storage.hasUserAcknowledged(will.id, req.user.id);
      
      res.json({
        ...willWithCommitments,
        status,
        memberCount,
        commitmentCount,
        acknowledgedCount,
        hasUserAcknowledged,
      });
    } catch (error) {
      console.error("Error fetching circle will:", error);
      res.status(500).json({ message: "Failed to fetch will" });
    }
  });

  app.get('/api/wills/:id/details', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      
      if (!willWithCommitments) {
        return res.status(404).json({ message: "Will not found" });
      }

      const memberCount = await storage.getCircleMemberCount(willWithCommitments.circleId);
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(willId);
      
      const status = getWillStatus(willWithCommitments, memberCount);
      
      // Auto-update will status if it has transitioned based on time
      if (status === 'active' && willWithCommitments.status !== 'active') {
        await storage.updateWillStatus(willId, 'active');
      } else if (status === 'completed' && willWithCommitments.status !== 'completed') {
        await storage.updateWillStatus(willId, 'completed');
      }

      // Get progress for each commitment
      const commitmentsWithProgress = await Promise.all(
        willWithCommitments.commitments.map(async (commitment) => {
          const stats = await storage.getUserProgressStats(willId, commitment.userId);
          const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          
          return {
            ...commitment,
            progressStats: stats,
            progressPercent,
          };
        })
      );

      res.json({
        ...willWithCommitments,
        status,
        memberCount,
        acknowledgedCount,
        commitments: commitmentsWithProgress,
      });
    } catch (error) {
      console.error("Error fetching will details:", error);
      res.status(500).json({ message: "Failed to fetch will details" });
    }
  });

  app.post('/api/wills/:id/acknowledge', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      // Check if user has committed to this will
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (!hasCommitted) {
        return res.status(403).json({ message: "Only users who submitted commitments can acknowledge completion" });
      }

      // Check if user already acknowledged
      const hasAcknowledged = await storage.hasUserAcknowledged(willId, userId);
      if (hasAcknowledged) {
        return res.status(400).json({ message: "You have already acknowledged this Will" });
      }

      // Add acknowledgment
      const acknowledgment = await storage.addWillAcknowledgment({
        willId,
        userId,
      });

      // Check if all committed members have acknowledged
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      if (!willWithCommitments) {
        return res.status(404).json({ message: "Will not found" });
      }

      const commitmentCount = willWithCommitments.commitments?.length || 0;
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(willId);

      // If all committed members have acknowledged, the will is fully completed and can be archived
      // This allows creation of new wills
      if (acknowledgedCount >= commitmentCount) {
        await storage.updateWillStatus(willId, 'archived');
        
        // ISSUE #2 FIX: Send Ready for New Will notification ONLY to CURRENT circle members
        try {
          const circleMembers = await storage.getCircleMembers(willWithCommitments.circleId);
          const memberIds = circleMembers.map(member => member.userId);
          
          console.log(`[Routes] ISSUE #2 FIX: Sending Ready for New Will notification to ${memberIds.length} CURRENT members of circle ${willWithCommitments.circleId}`);
          console.log(`[Routes] Circle members:`, memberIds);
          
          await pushNotificationService.sendReadyForNewWillNotification(memberIds);
          console.log(`[Routes] ✅ Ready for New Will notification sent for Will ${willId}`);
        } catch (error) {
          console.error(`[Routes] ❌ Failed to send Ready for New Will notification:`, error);
        }
      }

      res.json({
        ...acknowledgment,
        acknowledgedCount,
        commitmentCount,
        allAcknowledged: acknowledgedCount >= commitmentCount
      });
    } catch (error) {
      console.error("Error acknowledging will:", error);
      res.status(500).json({ message: "Failed to acknowledge will" });
    }
  });

  app.post('/api/wills/:id/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      const { date, completed } = req.body;

      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const progress = await storage.markDailyProgress({
        willId,
        userId,
        date,
        completed: completed ?? true,
      });

      res.json(progress);
    } catch (error) {
      console.error("Error marking progress:", error);
      res.status(500).json({ message: "Failed to mark progress" });
    }
  });

  // Push notification routes
  app.post('/api/wills/:id/push', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      // Check if user has already pushed for this will
      const hasAlreadyPushed = await storage.hasUserPushed(willId, userId);
      if (hasAlreadyPushed) {
        return res.status(409).json({ message: "You have already pushed for this will" });
      }

      // Get will to ensure it exists and is active
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      // Only allow pushing for active wills
      if (will.status !== 'active') {
        return res.status(400).json({ message: "Push notifications are only available for active wills" });
      }

      // Get pusher info
      const pusher = await storage.getUser(userId);
      const pusherName = pusher?.firstName && pusher?.lastName 
        ? `${pusher.firstName} ${pusher.lastName}`
        : pusher?.email || 'Someone';

      // Get circle members to notify (excluding the pusher)
      const circleMembers = await storage.getCircleMembers(will.circleId);
      const membersToNotify = circleMembers.filter(member => member.userId !== userId);
      const memberIds = membersToNotify.map(member => member.userId);

      // Record the push
      const push = await storage.addWillPush({
        willId,
        userId,
      });

      // Send real push notifications to all other circle members via APNs
      if (memberIds.length > 0) {
        const { pushNotificationService } = await import('./pushNotificationService');
        const willTitle = (will as any).title || 'Your Will';
        await pushNotificationService.sendTeamPushNotification(pusherName, willTitle, memberIds);
        console.log(`[Push] Sent encouragement notification from ${pusherName} to ${memberIds.length} members for Will: ${willTitle}`);
      }
      
      res.json({
        ...push,
        pusherName,
        membersNotified: memberIds.length
      });
    } catch (error) {
      console.error("Error adding push notification:", error);
      res.status(500).json({ message: "Failed to add push notification" });
    }
  });

  app.get('/api/wills/:id/push/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      const hasUserPushed = await storage.hasUserPushed(willId, userId);
      const pushes = await storage.getWillPushes(willId);

      res.json({ 
        hasUserPushed, 
        pushes 
      });
    } catch (error) {
      console.error("Error getting push status:", error);
      res.status(500).json({ message: "Failed to get push status" });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const users = await storage.getAllUsers(parseInt(limit), parseInt(offset));
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id/role', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      await storage.updateUserRole(id, role);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch('/api/admin/users/:id/deactivate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deactivateUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  app.patch('/api/admin/users/:id/activate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.activateUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error activating user:", error);
      res.status(500).json({ message: "Failed to activate user" });
    }
  });

  app.get('/api/admin/circles', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const circles = await storage.getAllCircles(parseInt(limit), parseInt(offset));
      res.json(circles);
    } catch (error) {
      console.error("Error fetching circles:", error);
      res.status(500).json({ message: "Failed to fetch circles" });
    }
  });

  app.delete('/api/admin/circles/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCircle(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting circle:", error);
      res.status(500).json({ message: "Failed to delete circle" });
    }
  });

  app.get('/api/admin/wills', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const wills = await storage.getAllWills(parseInt(limit), parseInt(offset));
      res.json(wills);
    } catch (error) {
      console.error("Error fetching wills:", error);
      res.status(500).json({ message: "Failed to fetch wills" });
    }
  });

  app.delete('/api/admin/wills/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWill(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting will:", error);
      res.status(500).json({ message: "Failed to delete will" });
    }
  });

  // Blog posts
  app.get('/api/admin/blog-posts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const posts = await storage.getAllBlogPosts(parseInt(limit), parseInt(offset));
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.post('/api/admin/blog-posts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const postData = insertBlogPostSchema.parse({ ...req.body, authorId: userId });
      const post = await storage.createBlogPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating blog post:", error);
      res.status(500).json({ message: "Failed to create blog post" });
    }
  });

  app.patch('/api/admin/blog-posts/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const post = await storage.updateBlogPost(parseInt(id), req.body);
      res.json(post);
    } catch (error) {
      console.error("Error updating blog post:", error);
      res.status(500).json({ message: "Failed to update blog post" });
    }
  });

  app.delete('/api/admin/blog-posts/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBlogPost(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ message: "Failed to delete blog post" });
    }
  });

  // Page contents
  app.get('/api/admin/page-contents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const contents = await storage.getAllPageContents();
      res.json(contents);
    } catch (error) {
      console.error("Error fetching page contents:", error);
      res.status(500).json({ message: "Failed to fetch page contents" });
    }
  });

  app.post('/api/admin/page-contents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contentData = insertPageContentSchema.parse({ ...req.body, updatedBy: userId });
      const content = await storage.createPageContent(contentData);
      res.json(content);
    } catch (error) {
      console.error("Error creating page content:", error);
      res.status(500).json({ message: "Failed to create page content" });
    }
  });

  app.patch('/api/admin/page-contents/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const content = await storage.updatePageContent(parseInt(id), { ...req.body, updatedBy: userId });
      res.json(content);
    } catch (error) {
      console.error("Error updating page content:", error);
      res.status(500).json({ message: "Failed to update page content" });
    }
  });

  app.delete('/api/admin/page-contents/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePageContent(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting page content:", error);
      res.status(500).json({ message: "Failed to delete page content" });
    }
  });

  // Update commitment (only allowed for pending status and own commitment)
  app.put('/api/will-commitments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const commitmentId = parseInt(req.params.id);
      const userId = req.user.id;
      const { what, why } = req.body;
      
      if (!what || !why) {
        return res.status(400).json({ message: "Both 'what' and 'why' are required" });
      }
      
      // Get the commitment to verify ownership and will status
      const [commitment] = await db
        .select()
        .from(willCommitments)
        .where(eq(willCommitments.id, commitmentId));
      
      if (!commitment) {
        return res.status(404).json({ message: "Commitment not found" });
      }
      
      // Only the user who created the commitment can edit it
      if (commitment.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own commitments" });
      }
      
      // Get the will to check status
      const will = await storage.getWillById(commitment.willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Can only edit commitments while will is pending or scheduled
      if (will.status === 'active' || will.status === 'completed') {
        return res.status(400).json({ message: "Commitments can only be edited while the will is pending or scheduled" });
      }
      
      // Update the commitment
      const [updatedCommitment] = await db
        .update(willCommitments)
        .set({ what: what.trim(), why: why.trim() })
        .where(eq(willCommitments.id, commitmentId))
        .returning();
      
      res.json(updatedCommitment);
    } catch (error) {
      console.error("Error updating commitment:", error);
      res.status(500).json({ message: "Failed to update commitment" });
    }
  });

  // Update will (only allowed for pending/scheduled status)
  app.put('/api/wills/:id', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Only creator can update the will
      if (will.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can update the will" });
      }
      
      // Can only update if status is pending or scheduled
      if (will.status === 'active' || will.status === 'completed') {
        return res.status(400).json({ message: "Cannot modify an active or completed will" });
      }
      
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const now = new Date();
      
      if (start <= now) {
        return res.status(400).json({ message: "Start date must be in the future" });
      }
      
      if (end <= start) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
      
      await storage.updateWill(willId, { startDate: start, endDate: end });
      
      res.json({ message: "Will updated successfully" });
    } catch (error) {
      console.error("Error updating will:", error);
      res.status(500).json({ message: "Failed to update will" });
    }
  });

  // Delete will (only allowed for pending/scheduled status)
  app.delete('/api/wills/:id', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Only creator can delete the will
      if (will.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can delete the will" });
      }
      
      // Can only delete if status is pending, scheduled, or active (but not completed)
      if (will.status === 'completed') {
        return res.status(400).json({ message: "Cannot delete a completed will" });
      }
      
      await storage.deleteWill(willId);
      
      res.json({ message: "Will deleted successfully" });
    } catch (error) {
      console.error("Error deleting will:", error);
      res.status(500).json({ message: "Failed to delete will" });
    }
  });

  // End Room routes
  app.get('/api/wills/:id/end-room', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Check if user is part of this will's circle
      const circle = await storage.getCircleById(will.circleId);
      if (!circle) {
        return res.status(404).json({ message: "Circle not found" });
      }
      
      const isInCircle = await storage.isUserInCircle(userId, circle.id);
      if (!isInCircle) {
        return res.status(403).json({ message: "You must be in the circle to access the End Room" });
      }
      
      // If End Room is open but URL is missing or invalid, try to create the room
      if (will.endRoomStatus === 'open' && (!will.endRoomUrl || will.endRoomUrl.includes('test')) && will.endRoomScheduledAt) {
        try {
          console.log(`Creating missing Daily.co room for Will ${willId}`);
          const endRoom = await dailyService.createEndRoom({
            willId: willId,
            scheduledStart: new Date(will.endRoomScheduledAt),
          });
          
          // Update will with End Room details
          await storage.updateWillEndRoom(willId, {
            endRoomUrl: endRoom.url,
            endRoomStatus: 'open',
          });
          
          console.log(`Created missing End Room for Will ${willId}: ${endRoom.url}`);
          
          // Return updated information
          res.json({
            endRoomUrl: endRoom.url,
            endRoomScheduledAt: will.endRoomScheduledAt,
            endRoomStatus: 'open',
            isOpen: true,
            canJoin: true
          });
          return;
        } catch (error) {
          console.error(`Failed to create missing End Room for Will ${willId}:`, error);
          // Fallback: Return End Room info without video URL
          res.json({
            endRoomUrl: null,
            endRoomScheduledAt: will.endRoomScheduledAt,
            endRoomStatus: 'open',
            isOpen: true,
            canJoin: false,
            error: 'Video room setup required - please contact support'
          });
          return;
        }
      }
      
      // Return End Room information
      res.json({
        endRoomUrl: will.endRoomUrl,
        endRoomScheduledAt: will.endRoomScheduledAt,
        endRoomStatus: will.endRoomStatus,
        isOpen: will.endRoomStatus === 'open',
        canJoin: will.endRoomStatus === 'open' && will.endRoomUrl
      });
    } catch (error) {
      console.error("Error fetching End Room:", error);
      res.status(500).json({ message: "Failed to fetch End Room information" });
    }
  });

  // Fix Will 38 End Room with real Daily.co room
  app.post('/api/fix-will-38-endroom', async (req: any, res) => {
    try {
      console.log('Creating Daily.co room for Will 38...');
      
      const apiKey = process.env.DAILY_API_KEY;
      const roomName = `will-38-endroom-${Date.now()}`;
      
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            start_video_off: false,
            start_audio_off: false,
            enable_chat: true,
            enable_screenshare: true,
            max_participants: 10,
            enable_knocking: false,
            enable_prejoin_ui: false,
            enable_people_ui: true,
            exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
            eject_at_room_exp: true
          }
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Daily.co API error: ${response.status} - ${error}`);
      }
      
      const room = await response.json();
      console.log('✅ Daily.co room created:', room.url);
      
      // Update Will 38 with the real room URL
      await storage.updateWillEndRoom(38, {
        endRoomUrl: room.url
      });
      
      console.log('✅ Will 38 updated with End Room URL');
      
      res.json({ success: true, url: room.url, room: room });
    } catch (error) {
      console.error('❌ Error creating Daily.co room for Will 38:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Test Daily.co API connectivity
  app.get('/api/daily/test', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const response = await fetch('https://api.daily.co/v1/rooms?limit=1', {
        headers: {
          'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        res.json({ status: 'connected', rooms: data });
      } else {
        const error = await response.text();
        res.status(response.status).json({ status: 'error', error });
      }
    } catch (error) {
      console.error("Daily.co test error:", error);
      res.status(500).json({ status: 'error', message: (error as Error).message });
    }
  });

  // Push notification API routes
  
  // Device token storage API with deduplication (Race Condition Fix)
  app.post('/api/device-token', async (req: any, res) => {
    try {
      // 🧪 COMPREHENSIVE DIAGNOSTIC LOGGING
      console.log('🔍 [DIAGNOSTIC] === NEW TOKEN REGISTRATION REQUEST ===');
      console.log('🔍 [DIAGNOSTIC] Timestamp:', new Date().toISOString());
      console.log('🔍 [DIAGNOSTIC] Full request body:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [DIAGNOSTIC] Environment parameter:', req.body.environment);
      console.log('🔍 [DIAGNOSTIC] Environment type:', typeof req.body.environment);
      console.log('🔍 [DIAGNOSTIC] Full body keys:', Object.keys(req.body));
      console.log('🔍 [DIAGNOSTIC] Token hash:', req.body.deviceToken?.substring(0, 10) + '...');
      console.log('🔍 [DIAGNOSTIC] Bundle ID received:', req.body.bundleId);
      console.log('🔍 [DIAGNOSTIC] User ID received:', req.body.userId);
      
      const { deviceToken, userId } = req.body;
      
      console.log(`[DeviceToken] 📱 NEW TOKEN REGISTRATION:`);
      console.log(`  🔍 Token Hash: ${deviceToken?.substring(0, 10)}...`);
      console.log(`  🔍 Incoming User ID: ${userId}`);
      console.log(`  🔍 Request Time: ${new Date().toISOString()}`);
      
      if (!deviceToken) {
        return res.status(400).json({ error: 'Device token is required' });
      }
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // 🔒 CRITICAL: Check if token already exists and is associated to prevent race condition
      const existingToken = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.deviceToken, deviceToken))
        .limit(1);
        
      if (existingToken.length > 0) {
        const existing = existingToken[0];
        console.log(`[DeviceToken] Found existing token with userId: ${existing.userId}`);
        
        // If token is already associated with a real user, SKIP registration to prevent duplicate reset
        if (existing.userId && existing.userId !== 'pending' && existing.userId !== null) {
          console.log(`🔒 [DeviceToken] Token already associated with user ${existing.userId}, preventing duplicate registration`);
          return res.json({ 
            success: true, 
            message: 'Token already associated with user',
            action: 'skipped_duplicate',
            alreadyAssociated: true,
            tokenHash: deviceToken.substring(0, 10) + '...'
          });
        }
        
        // Token exists but still pending - allow update
        console.log(`🔄 [DeviceToken] Token exists but pending, allowing update`);
      }
      
      // Proceed with registration only for new tokens or truly pending tokens
      console.log(`🔄 [DeviceToken] Proceeding with registration...`);
      
      // Handle pending tokens (not yet associated with a user)
      let finalUserId = userId;
      if (userId === 'pending') {
        console.log(`[DeviceToken] 🔄 Storing pending token for later association`);
        finalUserId = null; // Store as unassociated
      } else {
        // Verify user exists for non-pending tokens
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      
      // 🔧 FIX: Respect explicit environment from iOS app first, then fall back to detection
      console.log('🔍 [DIAGNOSTIC] === ENVIRONMENT DETECTION LOGIC ===');
      let environment: 'SANDBOX' | 'PRODUCTION';
      const explicitEnv = String(req.body.environment || '').trim().toLowerCase();
      console.log('🔍 [DIAGNOSTIC] Raw environment value:', req.body.environment);
      console.log('🔍 [DIAGNOSTIC] Normalized environment value:', explicitEnv);
      
      if (explicitEnv === 'sandbox') {
        environment = 'SANDBOX';
        console.log(`✅ [DIAGNOSTIC] iOS explicitly requested SANDBOX - should set is_sandbox: true`);
        console.log(`✅ [DeviceToken] iOS app explicitly requested SANDBOX environment`);
      } else if (explicitEnv === 'production') {
        environment = 'PRODUCTION';
        console.log(`✅ [DIAGNOSTIC] iOS explicitly requested PRODUCTION - should set is_sandbox: false`);
        console.log(`✅ [DeviceToken] iOS app explicitly requested PRODUCTION environment`);
      } else {
        // Fall back to header-based detection only if iOS didn't specify
        environment = detectTokenEnvironment(req.headers, 'ios');
        console.log(`⚠️ [DIAGNOSTIC] No explicit environment, falling back to header detection: ${environment}`);
        console.log(`🔍 [DeviceToken] iOS app didn't specify environment, detected: ${environment} (via headers)`);
      }
      
      const isSandbox = (environment === 'SANDBOX');
      console.log('🔍 [DIAGNOSTIC] Final environment decision:');
      console.log('  - Environment string:', environment);
      console.log('  - is_sandbox value:', isSandbox);
      console.log('  - Will be stored as:', isSandbox ? 'SANDBOX' : 'PRODUCTION');
      console.log(`  🔍 Final Environment: ${environment}`);
      
      const tokenData = {
        userId: finalUserId,
        deviceToken,
        platform: req.body.platform || 'ios',
        isActive: true,
        isSandbox: environment === 'SANDBOX',
        bundleId: req.body.bundleId || req.headers['x-app-bundle'] as string, // ✅ Check body first, then headers
        buildScheme: req.body.buildScheme || req.headers['x-app-buildscheme'] as string, // ✅ Check body first, then headers  
        provisioningProfile: req.body.provisioningProfile || req.headers['x-app-provisioning'] as string, // ✅ Check body first, then headers
        appVersion: req.body.appVersion || req.headers['x-app-version'] as string, // ✅ Check body first, then headers
        registrationSource: finalUserId ? 'api_device_token' : 'api_device_token_pending'
      };
      
      if (existingToken.length > 0) {
        console.log(`[DeviceToken] ✅ Updating existing token with environment: ${environment}`);
        await db
          .update(deviceTokens)
          .set({ 
            userId: finalUserId,
            isActive: true,
            isSandbox: environment === 'SANDBOX', // CRITICAL: Update environment on existing tokens
            updatedAt: new Date(),
            registrationSource: finalUserId ? 'api_device_token_update' : 'api_device_token_pending_update'
          })
          .where(eq(deviceTokens.deviceToken, deviceToken));
      } else {
        console.log(`[DeviceToken] ✅ Storing new token`);
        await db.insert(deviceTokens).values(tokenData);
      }
      
      // 🧪 VERIFY DATABASE INSERT
      console.log('✅ [DIAGNOSTIC] Token stored in database with:');
      console.log('  - is_sandbox:', environment === 'SANDBOX');
      console.log('  - bundle_id:', req.body.bundleId || req.headers['x-app-bundle'] || 'null');
      console.log('  - environment should be:', environment === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION');
      console.log('  - token_data_is_sandbox:', tokenData.isSandbox);
      
      const userInfo = finalUserId ? `user ${finalUserId}` : 'pending association';
      console.log(`[DeviceToken] ✅ Token ${deviceToken.substring(0, 8)}... registered for ${userInfo} (${environment})`);
      res.json({ 
        success: true, 
        message: `Token registered successfully as ${environment}${finalUserId ? '' : ' (pending user association)'}`,
        environment,
        pendingAssociation: !finalUserId,
        debugInfo: {
          receivedEnvironment: req.body.environment,
          normalizedEnvironment: explicitEnv,
          finalEnvironment: environment,
          isSandbox: environment === 'SANDBOX'
        }
      });
      
    } catch (error) {
      console.error("[DeviceToken] ❌ Error registering token:", error);
      res.status(500).json({ error: 'Failed to register device token' });
    }
  });

  // Token cleanup endpoint for lifecycle management - FIXED to preserve current token
  app.post('/api/device-tokens/cleanup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentToken } = req.body; // Optional: specify current token to preserve
      
      // Get all active tokens for user
      const allTokens = await db
        .select()
        .from(deviceTokens)
        .where(
          and(
            eq(deviceTokens.userId, userId),
            eq(deviceTokens.isActive, true)
          )
        )
        .orderBy(deviceTokens.updatedAt);
      
      if (allTokens.length <= 1) {
        console.log(`[TokenCleanup] User ${userId} has ${allTokens.length} token(s), no cleanup needed`);
        return res.json({ 
          success: true, 
          message: "No cleanup needed - only one active token",
          tokensAffected: 0
        });
      }
      
      // Find which token to preserve (current token if specified, otherwise most recent)
      let tokenToPreserve;
      if (currentToken) {
        tokenToPreserve = allTokens.find(t => t.deviceToken === currentToken);
      }
      if (!tokenToPreserve) {
        // If no current token specified or not found, preserve the most recent
        tokenToPreserve = allTokens[allTokens.length - 1];
      }
      
      // Mark all other tokens as inactive
      const tokensToDeactivate = allTokens.filter(t => t.id !== tokenToPreserve.id);
      
      if (tokensToDeactivate.length === 0) {
        console.log(`[TokenCleanup] No old tokens to clean up for user ${userId}`);
        return res.json({ 
          success: true, 
          message: "No old tokens to clean up",
          tokensAffected: 0
        });
      }
      
      // Deactivate each old token individually to avoid complex WHERE logic
      const results = [];
      for (const token of tokensToDeactivate) {
        const result = await db
          .update(deviceTokens)
          .set({
            isActive: false,
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.id, token.id))
          .returning();
        results.push(...result);
      }
      
      console.log(`[TokenCleanup] Marked ${results.length} old token(s) as inactive for user ${userId}, preserved token ${tokenToPreserve.deviceToken.substring(0, 8)}...`);
      res.json({ 
        success: true, 
        message: `Cleaned up ${results.length} old tokens, preserved current token`,
        tokensAffected: results.length,
        preservedToken: tokenToPreserve.deviceToken.substring(0, 8) + '...'
      });
    } catch (error) {
      console.error("[TokenCleanup] Error cleaning up tokens:", error);
      res.status(500).json({ error: 'Failed to cleanup tokens' });
    }
  });
  
  // Device status check for push notifications
  app.get('/api/notifications/status', async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        console.log('[Notifications] User not authenticated - returning default status');
        return res.json({
          registered: false,
          token: null,
          platform: null,
          lastUpdated: null,
          authenticated: false
        });
      }
      
      const userId = req.user.id;
      console.log('[Notifications] Checking status for user:', userId);
      
      // Check if user has a registered device token
      const [deviceToken] = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));
        
      const status = {
        registered: !!deviceToken,
        token: deviceToken?.deviceToken ? deviceToken.deviceToken.substring(0, 20) + '...' : null,
        platform: deviceToken?.platform || null,
        lastUpdated: deviceToken?.updatedAt || null,
        authenticated: true
      };
      
      console.log('[Notifications] Device status:', status);
      res.json(status);
    } catch (error) {
      console.error('[Notifications] Error checking status:', error);
      res.status(500).json({ 
        registered: false, 
        error: 'Failed to check device status',
        authenticated: false
      });
    }
  });

  // UNAUTHENTICATED token registration endpoint (for initial token capture)
  app.post('/api/push-tokens/register', async (req: any, res) => {
    try {
      const { deviceToken, platform, userId } = req.body;
      
      console.log(`[TokenRegistration] 🆕 UNAUTHENTICATED TOKEN REGISTRATION:`);
      console.log(`  🔍 Token Hash: ${deviceToken?.substring(0, 8)}...`);
      console.log(`  🔍 Platform: ${platform}`);
      console.log(`  🔍 User ID (if provided): ${userId || 'none'}`);
      console.log(`  🔍 Request Time: ${new Date().toISOString()}`);
      
      if (!deviceToken || !platform) {
        return res.status(400).json({ error: 'Device token and platform are required' });
      }
      
      // Store token without user association initially
      // Will be updated once user authenticates
      const tokenData = {
        userId: userId || 'pending-tokens', // Use system user for unauthenticated tokens
        deviceToken,
        platform,
        isActive: true,
        isSandbox: String(req.body.environment || '').trim().toLowerCase() === 'sandbox' ? true : String(req.body.environment || '').trim().toLowerCase() === 'production' ? false : detectTokenEnvironment(req.headers, platform) === 'SANDBOX', // Respect explicit iOS environment parameter with normalization
        registrationSource: 'unauthenticated_registration'
      };
      
      // Check if this exact token already exists
      const existingToken = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.deviceToken, deviceToken));
      
      if (existingToken.length > 0) {
        console.log(`[TokenRegistration] ✅ Token already exists, updating timestamp and environment`);
        const normalizedEnv = String(req.body.environment || '').trim().toLowerCase();
        const shouldBeSandbox = normalizedEnv === 'sandbox' ? true : normalizedEnv === 'production' ? false : detectTokenEnvironment(req.headers, platform) === 'SANDBOX';
        await db
          .update(deviceTokens)
          .set({ 
            updatedAt: new Date(),
            isActive: true,
            isSandbox: shouldBeSandbox, // CRITICAL: Update environment on existing tokens
            registrationSource: 'unauthenticated_update'
          })
          .where(eq(deviceTokens.deviceToken, deviceToken));
      } else {
        console.log(`[TokenRegistration] ✅ Storing new token for later user association`);
        await db.insert(deviceTokens).values(tokenData);
      }
      
      console.log(`[TokenRegistration] ✅ Token ${deviceToken.substring(0, 8)}... stored successfully`);
      res.json({ success: true, message: 'Token registered, will be associated with user upon login' });
      
    } catch (error) {
      console.error("[TokenRegistration] ❌ Error in unauthenticated registration:", error);
      res.status(500).json({ error: 'Failed to register token' });
    }
  });

  app.post('/api/push-tokens', isAuthenticated, async (req: any, res) => {
    try {
      // 🧪 ADD DIAGNOSTIC LOGGING TO THIS ENDPOINT TOO
      console.log('🔍 [DIAGNOSTIC] === /api/push-tokens ENDPOINT HIT ===');
      console.log('🔍 [DIAGNOSTIC] This endpoint was MISSING environment detection!');
      console.log('🔍 [DIAGNOSTIC] Full request body:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [DIAGNOSTIC] Environment parameter:', req.body.environment);
      
      const userId = req.user.id;
      const { deviceToken, platform = 'ios' } = req.body;
      
      console.log(`[TokenRegistration] 🔐 ROBUST TOKEN OWNERSHIP TRANSFER:`);
      console.log(`  🔍 User ID: ${userId}`);
      console.log(`  🔍 Token Hash: ${deviceToken?.substring(0, 8)}...`);
      console.log(`  🔍 Platform: ${platform}`);
      
      if (!deviceToken) {
        return res.status(400).json({ error: 'Device token is required' });
      }
      
      // 🔧 ADD MISSING ENVIRONMENT DETECTION TO THIS ENDPOINT
      let environment: 'SANDBOX' | 'PRODUCTION';
      const explicitEnv = String(req.body.environment || '').trim().toLowerCase();
      if (explicitEnv === 'sandbox') {
        environment = 'SANDBOX';
        console.log(`✅ [DIAGNOSTIC] /api/push-tokens: iOS explicitly requested SANDBOX`);
      } else if (explicitEnv === 'production') {
        environment = 'PRODUCTION';  
        console.log(`✅ [DIAGNOSTIC] /api/push-tokens: iOS explicitly requested PRODUCTION`);
      } else {
        environment = detectTokenEnvironment(req.headers, platform);
        console.log(`⚠️ [DIAGNOSTIC] /api/push-tokens: No explicit environment, detected: ${environment}`);
      }
      
      const isSandbox = (environment === 'SANDBOX');
      console.log('🔍 [DIAGNOSTIC] /api/push-tokens environment decision:');
      console.log('  - Environment:', environment);
      console.log('  - isSandbox:', isSandbox);
      
      // 🔥 ALWAYS update ownership, regardless of current state
      // This handles ALL scenarios: new tokens, pending tokens, tokens from other users
      // 🔧 FIXED: Now includes environment detection!
      await db
        .insert(deviceTokens)
        .values({
          deviceToken: deviceToken,
          userId: userId,
          platform: platform,
          isActive: true,
          isSandbox: isSandbox, // CRITICAL: Add missing environment detection
          registrationSource: 'authenticated_ownership_transfer'
        })
        .onConflictDoUpdate({
          target: deviceTokens.deviceToken,
          set: {
            userId: userId, // Always transfer ownership to current user
            isActive: true,
            isSandbox: isSandbox, // CRITICAL: Update environment on existing tokens
            registrationSource: 'authenticated_ownership_transfer',
            updatedAt: new Date()
          }
        });
        
      console.log('✅ [DIAGNOSTIC] /api/push-tokens: Token stored with environment:');
      console.log('  - isSandbox:', isSandbox);
      console.log('  - environment:', environment);
      
      console.log(`✅ [TokenRegistration] Token ${deviceToken.substring(0, 8)}... now owned by user ${userId}`);
      res.json({ success: true, message: 'Token ownership transferred successfully' });
    } catch (error) {
      console.error('[TokenRegistration] ❌ Error during token ownership transfer:', error);
      res.status(500).json({ message: 'Failed to transfer token ownership', error: (error as Error).message });
    }
  });

  // Token environment validation endpoint
  app.post('/api/push-tokens/validate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { deviceToken } = req.body;
      
      if (!deviceToken) {
        return res.status(400).json({ error: 'Device token is required' });
      }
      
      console.log(`[TokenValidation] 🧪 Validating token environment: ${deviceToken.substring(0, 8)}...`);
      
      // Import the validator dynamically
      const { tokenValidator } = await import('./utils/tokenValidator');
      const validationResult = await tokenValidator.validateToken(deviceToken);
      
      console.log(`[TokenValidation] ✅ Validation complete for ${deviceToken.substring(0, 8)}...`);
      
      res.json({
        success: true,
        validation: validationResult
      });
    } catch (error) {
      console.error('[TokenValidation] ❌ Error validating token:', error);
      res.status(500).json({ 
        error: 'Token validation failed', 
        message: (error as Error).message 
      });
    }
  });

  // Alias route for device registration (alternative naming)
  app.post('/api/notifications/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { token, deviceToken, platform } = req.body;
      
      // Accept either 'token' or 'deviceToken' field name
      const actualToken = token || deviceToken;
      
      console.log(`[Notifications] Device registration via /register - User ID: ${userId}, Platform: ${platform}, Token: ${actualToken?.substring(0, 20)}...`);
      
      if (!actualToken || !platform) {
        console.log("[Notifications] Missing token or platform");
        return res.status(400).json({ message: "Token and platform are required" });
      }
      
      // First try to find existing token for this user
      const existingToken = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId))
        .limit(1);
      
      if (existingToken.length > 0) {
        // Update existing token
        await db
          .update(deviceTokens)
          .set({
            deviceToken: actualToken,
            platform,
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.userId, userId));
        console.log(`[Notifications] Updated existing device token for user ${userId} via /register`);
      } else {
        // Insert new token
        await db
          .insert(deviceTokens)
          .values({
            userId,
            deviceToken: actualToken,
            platform,
            isActive: true
          });
        console.log(`[Notifications] Inserted new device token for user ${userId} via /register`);
      }
      
      console.log(`[Notifications] Device token successfully registered for user ${userId}`);
      res.json({ success: true, message: "Device token registered successfully" });
    } catch (error) {
      console.error("[Notifications] Error registering device token:", error);
      res.status(500).json({ message: "Failed to register device token" });
    }
  });


  app.post('/api/notifications/will-started', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { willTitle } = req.body;
      
      // Get user's circle and active will
      const userCircle = await storage.getUserCircle(userId);
      if (!userCircle) {
        return res.status(404).json({ message: "User not in a circle" });
      }
      
      // Get active will from circle
      const activeWill = await storage.getCircleActiveWill(userCircle.id);
      
      if (activeWill) {
        const willWithCommitments = await storage.getWillWithCommitments(activeWill.id);
        const committedMembers = willWithCommitments?.commitments?.map((c: any) => c.userId) || [];
        await pushNotificationService.sendWillStartedNotification(willTitle, committedMembers);
      }
      
      res.json({ success: true, message: "Will started notifications sent" });
    } catch (error) {
      console.error("Error sending will started notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  app.post('/api/notifications/end-room', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, endRoomTime } = req.body;
      
      // Get user's circle members
      const userCircle = await storage.getUserCircle(userId);
      if (!userCircle) {
        return res.status(404).json({ message: "User not in a circle" });
      }
      
      const members = await storage.getCircleMembers(userCircle.id);
      const memberIds = members.map(member => member.userId);
      
      // Send push notifications for End Room timing
      await pushNotificationService.sendEndRoomNotification(type, endRoomTime, memberIds);
      
      res.json({ success: true, message: "End room notifications sent" });
    } catch (error) {
      console.error("Error sending end room notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });


  // Test push notification endpoint (temporarily bypass auth for debugging)
  app.post('/api/notifications/test', async (req: any, res) => {
    try {
      const { title, body, userId: targetUserId } = req.body;
      const userId = targetUserId || req.user?.id;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required when not authenticated' });
      }
      
      const testPayload = {
        title: title || "Test Push Notification",
        body: body || "This is a test push notification from your WILL app",
        category: 'test',
        data: { type: 'test', timestamp: Date.now() }
      };
      
      const success = await pushNotificationService.sendToUser(userId, testPayload);
      
      if (success) {
        res.json({ success: true, message: "Test notification sent successfully" });
      } else {
        res.status(400).json({ success: false, message: "No device tokens found for user" });
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Simple admin endpoints for direct browser access
  app.get('/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.setHeader('Content-Type', 'application/json');
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/admin/wills', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const wills = await storage.getAllWills();
      // Filter for only active wills
      const activeWills = wills.filter(will => will.status === 'active');
      res.setHeader('Content-Type', 'application/json');
      res.json(activeWills);
    } catch (error) {
      console.error("Error fetching wills:", error);
      res.status(500).json({ message: "Failed to fetch active wills" });
    }
  });

  // Add direct debug endpoint for Randy's fresh token testing
  app.post('/api/debug/test-randy-token', async (req: any, res) => {
    try {
      console.log(`[DebugEndpoint] 🧪 DIRECT RANDY TOKEN TEST TRIGGERED`);
      
      const testPayload = {
        title: "🧪 Fresh Token Debug Test",
        body: "Testing Randy's 0d62e889 token with full logging pipeline",
        category: 'debug',
        data: { type: 'debug_test', timestamp: Date.now() }
      };
      
      console.log(`[DebugEndpoint] Calling pushNotificationService.sendToUser with:`);
      console.log(`  User ID: 17511021851866udaucmnr (Randy)`);
      console.log(`  Expected token: 0d62e889... (fresh token)`);
      console.log(`  Expected environment: SANDBOX (is_sandbox=true)`);
      
      const success = await pushNotificationService.sendToUser('17511021851866udaucmnr', testPayload);
      
      // Also test the validation utility
      console.log(`[DebugEndpoint] 🧪 Running token environment validation...`);
      try {
        const { tokenValidator } = await import('./utils/tokenValidator');
        const validation = await tokenValidator.validateToken('0d62e889c7405c8a88f61b50c7dd3ba8dbe1aa66f7b899c58c41f1c5452f02b4');
        console.log(`[DebugEndpoint] 📊 Validation result:`, validation);
      } catch (validationError) {
        console.error(`[DebugEndpoint] ❌ Validation failed:`, validationError);
      }
      
      console.log(`[DebugEndpoint] 📊 Test completed. Success: ${success}`);
      
      res.json({ 
        success: true,
        message: 'Randy token test completed - check logs for full details',
        userId: '17511021851866udaucmnr',
        expectedToken: '0d62e889...',
        pushResult: success
      });
    } catch (error) {
      console.error('[DebugEndpoint] ❌ Error in Randy token test:', error);
      res.status(500).json({ 
        error: 'Debug test failed', 
        message: (error as Error).message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Issue 1 fix: Smart token environment detection
function detectTokenEnvironment(headers: any, platform: string): 'SANDBOX' | 'PRODUCTION' {
  if (platform !== 'ios') return 'SANDBOX'; // Only iOS has environment complexity
  
  // Extract app metadata from headers
  const buildScheme = headers['x-app-buildscheme'] || '';
  const provisioningProfile = headers['x-app-provisioning'] || '';
  const bundleId = headers['x-app-bundle'] || '';
  
  console.log(`[TokenEnvironment] 🔍 DETECTION:`);
  console.log(`  🔍 Build Scheme: ${buildScheme}`);
  console.log(`  🔍 Provisioning: ${provisioningProfile}`);
  console.log(`  🔍 Bundle ID: ${bundleId}`);
  
  // Primary detection: Build scheme
  if (buildScheme.toLowerCase() === 'debug') {
    console.log(`  ✅ SANDBOX detected (Debug build)`);
    return 'SANDBOX';
  }
  
  if (buildScheme.toLowerCase() === 'release') {
    console.log(`  ✅ PRODUCTION detected (Release build)`);
    return 'PRODUCTION';
  }
  
  // Secondary detection: Provisioning profile keywords
  const provisioningLower = provisioningProfile.toLowerCase();
  if (provisioningLower.includes('development') || provisioningLower.includes('debug')) {
    console.log(`  ✅ SANDBOX detected (Development provisioning)`);
    return 'SANDBOX';
  }
  
  if (provisioningLower.includes('distribution') || provisioningLower.includes('appstore') || provisioningLower.includes('production')) {
    console.log(`  ✅ PRODUCTION detected (Distribution provisioning)`);
    return 'PRODUCTION';
  }
  
  // Fallback: In development server, default to SANDBOX
  const serverEnv = process.env.NODE_ENV;
  if (serverEnv === 'development') {
    console.log(`  🔄 SANDBOX fallback (Development server + ambiguous token)`);
    return 'SANDBOX';
  }
  
  // Ultimate fallback: PRODUCTION for production servers
  console.log(`  🔄 PRODUCTION fallback (Production server + ambiguous token)`);
  return 'PRODUCTION';
}
