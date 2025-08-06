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
import { eq } from "drizzle-orm";
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
          
          const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Someone';
          await pushNotificationService.sendWillProposedNotification(creatorName, otherMembers);
          console.log(`Sent Will proposed notifications to ${otherMembers.length} members`);
        } else {
          console.log("No other members to notify");
        }
      } catch (notificationError) {
        console.error("Error sending will proposed notifications:", notificationError);
        console.error("Notification error stack:", notificationError.stack);
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
      if (status === 'active' && willWithCommitments.status !== 'active') {
        await storage.updateWillStatus(will.id, 'active');
      } else if (status === 'completed' && willWithCommitments.status !== 'completed') {
        await storage.updateWillStatus(will.id, 'completed');
      }
      
      // Check if will should be archived (all committed members acknowledged)
      if (willWithCommitments.status === 'completed' && acknowledgedCount >= commitmentCount) {
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

      // Record the push
      const push = await storage.addWillPush({
        willId,
        userId,
      });

      // Send push notifications to all other circle members
      // In a real implementation, you would:
      // 1. Store device tokens for each user
      // 2. Use APNs for iOS or FCM for cross-platform
      // 3. Send actual push notifications
      
      // For now, we'll return the data so the frontend can handle local notifications
      res.json({
        ...push,
        pusherName,
        membersToNotify: membersToNotify.map(member => ({
          id: member.userId,
          name: member.user.firstName && member.user.lastName 
            ? `${member.user.firstName} ${member.user.lastName}`
            : member.user.email
        }))
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Push notification API routes
  
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

  app.post('/api/push-tokens', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { deviceToken, platform } = req.body;
      
      console.log(`[Notifications] Device token registration attempt - User ID: ${userId}, Platform: ${platform}, Token: ${deviceToken?.substring(0, 20)}...`);
      
      if (!deviceToken || !platform) {
        console.log("[Notifications] Missing device token or platform");
        return res.status(400).json({ message: "Device token and platform are required" });
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
            deviceToken,
            platform,
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.userId, userId));
        console.log(`[Notifications] Updated existing device token for user ${userId}`);
      } else {
        // Insert new token
        await db
          .insert(deviceTokens)
          .values({
            userId,
            deviceToken,
            platform,
            isActive: true
          });
        console.log(`[Notifications] Inserted new device token for user ${userId}`);
      }
      
      console.log(`[Notifications] Device token successfully stored for user ${userId}`);
      res.json({ success: true, message: "Device token registered successfully" });
    } catch (error) {
      console.error("[Notifications] Error storing device token:", error);
      res.status(500).json({ message: "Failed to store device token" });
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

  app.post('/api/notifications/will-proposed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { creatorName, willTitle } = req.body;
      
      // Get user's circle to find other members
      const userCircle = await storage.getUserCircle(userId);
      if (!userCircle) {
        return res.status(404).json({ message: "User not in a circle" });
      }
      
      // Get all circle members except the creator
      const members = await storage.getCircleMembers(userCircle.id);
      const otherMembers = members
        .filter(member => member.userId !== userId)
        .map(member => member.userId);
      
      // Send push notifications to all other circle members
      await pushNotificationService.sendWillProposedNotification(creatorName, otherMembers);
      
      res.json({ success: true, message: "Will proposed notifications sent" });
    } catch (error) {
      console.error("Error sending will proposed notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
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
      
      // Get all committed members of the active will
      const activeWills = await storage.getCircleWills(userCircle.id);
      const activeWill = activeWills.find(will => will.status === 'active');
      
      if (activeWill) {
        const committedMembers = activeWill.commitments?.map(c => c.userId) || [];
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

  app.post('/api/notifications/ready-for-new-will', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's circle members
      const userCircle = await storage.getUserCircle(userId);
      if (!userCircle) {
        return res.status(404).json({ message: "User not in a circle" });
      }
      
      const members = await storage.getCircleMembers(userCircle.id);
      const memberIds = members.map(member => member.userId);
      
      // Send push notifications that circle is ready for new will
      await pushNotificationService.sendReadyForNewWillNotification(memberIds);
      
      res.json({ success: true, message: "Ready for new will notifications sent" });
    } catch (error) {
      console.error("Error sending ready for new will notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  // Test push notification endpoint  
  app.post('/api/notifications/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { title, body } = req.body;
      
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

  const httpServer = createServer(app);
  return httpServer;
}
