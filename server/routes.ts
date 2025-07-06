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
  insertBlogPostSchema,
  insertPageContentSchema,
  willCommitments,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "./auth";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
        return res.json(null); // Return null to indicate no active will
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
