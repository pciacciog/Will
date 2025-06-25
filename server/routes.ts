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
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "./auth";

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

  if (now >= endDate) {
    return 'completed';
  } else if (now >= startDate) {
    return 'active';
  } else if (will.status === 'scheduled') {
    return 'scheduled';
  } else {
    return 'pending';
  }
}

// Admin middleware
const isAdmin: any = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(403).json({ message: "Admin access required" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes are handled by setupAuth

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

  // Will routes
  app.post('/api/wills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willData = insertWillSchema.parse(req.body);

      // Get user's circle
      const circle = await storage.getUserCircle(userId);
      if (!circle) {
        return res.status(400).json({ message: "You must be in a circle to create a Will" });
      }

      // Check if circle already has an active will
      const existingWill = await storage.getCircleActiveWill(circle.id);
      if (existingWill) {
        return res.status(400).json({ message: "Your circle already has an active Will" });
      }

      // Create will
      const will = await storage.createWill({
        ...willData,
        circleId: circle.id,
        createdBy: userId,
      });

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

      const memberCount = await storage.getCircleMemberCount(circleId);
      const commitmentCount = await storage.getWillCommitmentCount(will.id);
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(will.id);
      
      const status = getWillStatus(will, memberCount);
      
      res.json({
        ...will,
        status,
        memberCount,
        commitmentCount,
        acknowledgedCount,
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

      // Check if all members have acknowledged
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      const memberCount = await storage.getCircleMemberCount(will.circleId);
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(willId);

      // If all members have acknowledged, mark as completed and archived
      if (acknowledgedCount >= memberCount) {
        await storage.updateWillStatus(willId, 'completed');
      }

      res.json(acknowledgment);
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

  const httpServer = createServer(app);
  return httpServer;
}
