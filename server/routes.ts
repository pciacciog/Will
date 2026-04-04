import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertCircleSchema, 
  insertWillSchema,
  insertWillCommitmentSchema,
  insertWillAcknowledgmentSchema,
  insertWillReviewSchema,
  insertDailyProgressSchema,
  insertWillPushSchema,
  insertBlogPostSchema,
  insertPageContentSchema,
  insertDeviceTokenSchema,
  insertTodayItemSchema,
  circleProofs,
  cloudinaryCleanupLog,
  circles,
  circleMembers,
  circleMessages,
  willCommitments,
  deviceTokens,
  users,
  wills,
  friendships,
  teamWillInvites,
  willProofs,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "./auth";
import { db, pool } from "./db";
import { eq, and, or, isNull, sql, inArray, lt, gte, desc, ne, ilike } from "drizzle-orm";
import { cloudinary, cloudName, apiKey as cloudApiKey } from "./cloudinary";
import { dailyService } from "./daily";
import { pushNotificationService } from "./pushNotificationService";
import { getEnvironment, getDatabaseUrl, getBackendHost, isProduction } from "./config/environment";

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

  // Respect terminal states - these should never be recalculated
  if (will.status === 'completed' || will.status === 'archived' || will.status === 'terminated') {
    return will.status;
  }

  // Respect paused state - user explicitly paused, don't override
  if (will.status === 'paused') {
    return 'paused';
  }

  // Respect will_review state - mandatory reflection phase should persist
  if (will.status === 'will_review') {
    return 'will_review';
  }

  // Indefinite wills never auto-transition to will_review (they have no end date)
  if (will.isIndefinite || !will.endDate) {
    if (now >= startDate) {
      return 'active';
    }
    const commitmentCount = will.commitments?.length || 0;
    if (commitmentCount < memberCount) {
      return 'pending';
    }
    return 'scheduled';
  }

  const endDate = new Date(will.endDate);

  // Date-based calculation for non-terminal statuses with end dates
  if (now >= endDate) {
    return 'will_review';
  } else if (now >= startDate) {
    // Will is currently active
    return 'active';
  } else {
    // Will hasn't started yet - check commitment count
    const commitmentCount = will.commitments?.length || 0;
    if (commitmentCount < memberCount) {
      return 'pending'; // Waiting for members to commit
    } else {
      return 'scheduled'; // All committed, waiting for start date
    }
  }
}



const ACTIVE_PARTICIPANT_STATUSES = ['active', 'committed', 'pending', 'scheduled', 'paused', 'will_review'];

async function getPublicWillParticipantIds(parentWillId: number): Promise<string[]> {
  const childWills = await storage.getWillsByParentId(parentWillId);
  const parentWill = await storage.getWillById(parentWillId);
  const participantIds = new Set<string>();
  childWills.forEach(w => {
    if (ACTIVE_PARTICIPANT_STATUSES.includes(w.status)) participantIds.add(w.createdBy);
  });
  if (parentWill && ACTIVE_PARTICIPANT_STATUSES.includes(parentWill.status)) {
    participantIds.add(parentWill.createdBy);
  }
  return Array.from(participantIds);
}

async function isUserPublicWillParticipant(userId: string, parentWillId: number): Promise<boolean> {
  const participantIds = await getPublicWillParticipantIds(parentWillId);
  return participantIds.includes(userId);
}

async function getOtherPublicWillParticipants(userId: string, parentWillId: number): Promise<string[]> {
  const participantIds = await getPublicWillParticipantIds(parentWillId);
  return participantIds.filter(id => id !== userId);
}

async function getSharedWillParticipantIds(willId: number): Promise<string[]> {
  const will = await storage.getWillById(willId);
  if (!will) return [];
  const participantIds = new Set<string>();
  participantIds.add(will.createdBy);
  const invites = await db.select().from(teamWillInvites).where(and(
    eq(teamWillInvites.willId, willId),
    eq(teamWillInvites.status, 'accepted')
  ));
  invites.forEach(invite => participantIds.add(invite.invitedUserId));
  const commitments = await storage.getWillCommitments(willId);
  commitments.forEach(c => participantIds.add(c.userId));
  return Array.from(participantIds);
}

async function isUserSharedWillParticipant(userId: string, willId: number): Promise<boolean> {
  const participantIds = await getSharedWillParticipantIds(willId);
  return participantIds.includes(userId);
}

async function getOtherSharedWillParticipants(userId: string, willId: number): Promise<string[]> {
  const participantIds = await getSharedWillParticipantIds(willId);
  return participantIds.filter(id => id !== userId);
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

  // Enhanced diagnostic health endpoint for environment verification
  app.get('/api/health/env', async (req, res) => {
    const environment = getEnvironment();
    const nodeEnv = process.env.NODE_ENV;
    const backendHost = getBackendHost();
    
    // Get database URL for current environment
    let activeDbUrl = '';
    try {
      activeDbUrl = getDatabaseUrl();
    } catch (e) {
      // Database URL not configured
    }
    
    try {
      // Extract database host from connection string
      let dbHost = 'unknown';
      let dbName = 'unknown';
      
      if (activeDbUrl) {
        try {
          const dbUrl = new URL(activeDbUrl);
          dbHost = dbUrl.host;
        } catch (error) {
          dbHost = 'invalid-url';
        }
      }
      
      // Query current database name using pool directly
      const dbNameResult = await pool.query('SELECT current_database() as db_name');
      if (dbNameResult.rows && dbNameResult.rows[0]) {
        dbName = dbNameResult.rows[0].db_name;
      }
      
      // Query users count using Drizzle
      const usersResult = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const usersCount = usersResult && usersResult[0] ? usersResult[0].count : 0;
      
      res.json({
        environment,
        isProduction: isProduction(),
        nodeEnv: nodeEnv || '(not set)',
        backendUrlHost: backendHost,
        usingDbUrlHost: dbHost,
        usingDbName: dbName,
        usersCount,
        databaseConfigured: !!activeDbUrl,
        apnsMode: process.env.APNS_PRODUCTION === 'true' ? 'production' : 'sandbox',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to query database',
        message: error.message,
        environment,
        isProduction: isProduction(),
        nodeEnv: nodeEnv || '(not set)',
        backendUrlHost: backendHost,
        databaseConfigured: !!activeDbUrl,
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

  // ─── USERNAME UPDATE ───────────────────────────────────────────────────────
  app.patch('/api/user/username', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { username } = req.body;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      const trimmed = username.trim().toLowerCase();

      if (!/^[a-z0-9_]{3,30}$/.test(trimmed)) {
        return res.status(400).json({ message: "Username must be 3–30 characters, letters, numbers, or underscores only" });
      }

      // Check uniqueness
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, trimmed), ne(users.id, userId)));

      if (existing) {
        return res.status(409).json({ message: "Username is already taken" });
      }

      const [updated] = await db
        .update(users)
        .set({ username: trimmed, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[USERNAME] Error updating username:", error);
      res.status(500).json({ message: "Failed to update username" });
    }
  });

  // ─── USER SEARCH ───────────────────────────────────────────────────────────
  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const q = (req.query.q as string || '').trim();

      if (!q || q.length < 2) {
        return res.json([]);
      }

      // Search by username (partial) or exact email, excluding self
      const results = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email,
        })
        .from(users)
        .where(
          and(
            ne(users.id, currentUserId),
            or(
              ilike(users.username, `%${q}%`),
              eq(users.email, q.toLowerCase())
            )
          )
        )
        .limit(20);

      if (results.length === 0) {
        return res.json([]);
      }

      // Fetch friendship status for each result
      const resultIds = results.map(u => u.id);
      const existingFriendships = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, currentUserId), inArray(friendships.addresseeId, resultIds)),
            and(eq(friendships.addresseeId, currentUserId), inArray(friendships.requesterId, resultIds))
          )
        );

      const friendshipMap = new Map<string, { id: number; status: string; direction: 'sent' | 'received' }>();
      for (const f of existingFriendships) {
        const otherId = f.requesterId === currentUserId ? f.addresseeId : f.requesterId;
        const direction = f.requesterId === currentUserId ? 'sent' : 'received';
        friendshipMap.set(otherId, { id: f.id, status: f.status, direction });
      }

      const enriched = results.map(u => {
        const fs = friendshipMap.get(u.id);
        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          username: u.username,
          friendshipId: fs?.id ?? null,
          friendshipStatus: fs?.status ?? null,
          friendshipDirection: fs?.direction ?? null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("[USER-SEARCH] Error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // ─── FRIENDS API ───────────────────────────────────────────────────────────

  // GET /api/friends — list accepted friends + pending incoming requests
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const allFriendships = await db
        .select()
        .from(friendships)
        .where(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId)
          )
        );

      const accepted = allFriendships.filter(f => f.status === 'accepted');
      const pendingIncoming = allFriendships.filter(f => f.status === 'pending' && f.addresseeId === userId);

      // Collect all user IDs we need
      const allUserIds = new Set<string>();
      for (const f of [...accepted, ...pendingIncoming]) {
        allUserIds.add(f.requesterId);
        allUserIds.add(f.addresseeId);
      }
      allUserIds.delete(userId);

      let userMap = new Map<string, { id: string; firstName: string | null; lastName: string | null; username: string | null }>();
      if (allUserIds.size > 0) {
        const userRows = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users)
          .where(inArray(users.id, Array.from(allUserIds)));
        for (const u of userRows) {
          userMap.set(u.id, u);
        }
      }

      const friendsList = accepted.map(f => {
        const otherId = f.requesterId === userId ? f.addresseeId : f.requesterId;
        const other = userMap.get(otherId);
        return {
          friendshipId: f.id,
          userId: otherId,
          firstName: other?.firstName ?? null,
          lastName: other?.lastName ?? null,
          username: other?.username ?? null,
        };
      });

      const pendingList = pendingIncoming.map(f => {
        const other = userMap.get(f.requesterId);
        return {
          friendshipId: f.id,
          userId: f.requesterId,
          firstName: other?.firstName ?? null,
          lastName: other?.lastName ?? null,
          username: other?.username ?? null,
        };
      });

      res.json({ friends: friendsList, pendingIncoming: pendingList });
    } catch (error) {
      console.error("[FRIENDS] Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  // POST /api/friends/request — send a friend request
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.id;
      const { userId: addresseeId } = req.body;

      if (!addresseeId || typeof addresseeId !== 'string') {
        return res.status(400).json({ message: "userId is required" });
      }

      if (requesterId === addresseeId) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself" });
      }

      // Check if addressee exists
      const [addressee] = await db.select().from(users).where(eq(users.id, addresseeId));
      if (!addressee) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check for existing friendship in either direction
      const [existing] = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId)),
            and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, requesterId))
          )
        );

      if (existing) {
        if (existing.status === 'accepted') {
          return res.status(409).json({ message: "You are already friends" });
        }
        if (existing.status === 'pending') {
          return res.status(409).json({ message: "A friend request already exists" });
        }
        // If declined, update to pending (re-request)
        const [updated] = await db
          .update(friendships)
          .set({ status: 'pending', requesterId, addresseeId, updatedAt: new Date() })
          .where(eq(friendships.id, existing.id))
          .returning();

        // Send push notification for re-request
        try {
          const [sender] = await db
            .select({ firstName: users.firstName })
            .from(users)
            .where(eq(users.id, requesterId));
          const senderName = sender?.firstName || 'Someone';
          await pushNotificationService.sendToUser(addresseeId, {
            title: 'New friend request 👋',
            body: `${senderName} sent you a friend request`,
            category: 'friend_request',
            data: { type: 'friend_request', deepLink: '/friends' },
          });
        } catch (notifError) {
          console.error('[FRIENDS] Push notification failed (non-fatal):', notifError);
        }

        return res.status(201).json(updated);
      }

      const [newFriendship] = await db
        .insert(friendships)
        .values({ requesterId, addresseeId, status: 'pending' })
        .returning();

      // Send push notification to recipient
      try {
        const [sender] = await db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, requesterId));
        const senderName = sender?.firstName || 'Someone';
        await pushNotificationService.sendToUser(addresseeId, {
          title: 'New friend request 👋',
          body: `${senderName} sent you a friend request`,
          category: 'friend_request',
          data: { type: 'friend_request', deepLink: '/friends' },
        });
      } catch (notifError) {
        console.error('[FRIENDS] Push notification failed (non-fatal):', notifError);
      }

      res.status(201).json(newFriendship);
    } catch (error) {
      console.error("[FRIENDS] Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  // PATCH /api/friends/:id/accept
  app.patch('/api/friends/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const friendshipId = parseInt(req.params.id);

      const [fs] = await db.select().from(friendships).where(eq(friendships.id, friendshipId));
      if (!fs) return res.status(404).json({ message: "Friend request not found" });
      if (fs.addresseeId !== userId) return res.status(403).json({ message: "Not authorized" });
      if (fs.status !== 'pending') return res.status(400).json({ message: "Request is not pending" });

      const [updated] = await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(friendships.id, friendshipId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[FRIENDS] Error accepting friend request:", error);
      res.status(500).json({ message: "Failed to accept request" });
    }
  });

  // PATCH /api/friends/:id/decline
  app.patch('/api/friends/:id/decline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const friendshipId = parseInt(req.params.id);

      const [fs] = await db.select().from(friendships).where(eq(friendships.id, friendshipId));
      if (!fs) return res.status(404).json({ message: "Friend request not found" });
      if (fs.addresseeId !== userId) return res.status(403).json({ message: "Not authorized" });
      if (fs.status !== 'pending') return res.status(400).json({ message: "Request is not pending" });

      const [updated] = await db
        .update(friendships)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(eq(friendships.id, friendshipId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[FRIENDS] Error declining friend request:", error);
      res.status(500).json({ message: "Failed to decline request" });
    }
  });

  // DELETE /api/friends/:id — remove a friend (either party)
  app.delete('/api/friends/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const friendshipId = parseInt(req.params.id);

      const [fs] = await db.select().from(friendships).where(eq(friendships.id, friendshipId));
      if (!fs) return res.status(404).json({ message: "Friendship not found" });
      if (fs.requesterId !== userId && fs.addresseeId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await db.delete(friendships).where(eq(friendships.id, friendshipId));

      res.json({ message: "Friend removed" });
    } catch (error) {
      console.error("[FRIENDS] Error removing friend:", error);
      res.status(500).json({ message: "Failed to remove friend" });
    }
  });

  // Daily reminder settings route
  app.patch('/api/user/reminder-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dailyReminderTime, dailyReminderEnabled } = req.body;

      // Validate time format if provided (HH:MM)
      if (dailyReminderTime !== undefined && dailyReminderTime !== null) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(dailyReminderTime)) {
          return res.status(400).json({ message: "Invalid time format. Use HH:MM (e.g., 07:30)" });
        }
      }

      // Validate enabled is boolean if provided
      if (dailyReminderEnabled !== undefined && typeof dailyReminderEnabled !== 'boolean') {
        return res.status(400).json({ message: "dailyReminderEnabled must be a boolean" });
      }

      const updatedUser = await storage.updateUserReminderSettings(userId, {
        dailyReminderTime,
        dailyReminderEnabled
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating reminder settings:", error);
      res.status(500).json({ message: "Failed to update reminder settings" });
    }
  });

  // Forgot password - request reset email
  app.post('/api/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Always return success to prevent email enumeration
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      
      if (user) {
        // Generate secure random token
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        // Save token to database
        await storage.createPasswordResetToken(user.id, token, expiresAt);
        
        // Send email
        const { emailService } = await import('./emailService');
        let originFromRequest = req.headers.origin || '';
        if (!originFromRequest && req.headers.referer) {
          try {
            const refUrl = new URL(req.headers.referer);
            originFromRequest = refUrl.origin;
          } catch {}
        }
        const { getDefaultOrigin } = await import('./config/environment');
        const baseUrl = process.env.APP_URL || originFromRequest || getDefaultOrigin();
        
        console.log(`[PasswordReset] Using base URL: ${baseUrl} (from origin: ${req.headers.origin}, referer: ${req.headers.referer})`);
        await emailService.sendPasswordResetEmail(user.email, token, baseUrl);
        
        console.log(`[PasswordReset] Reset email sent to ${user.email}`);
      } else {
        console.log(`[PasswordReset] No user found for email: ${email}`);
      }
      
      // Always return success to prevent email enumeration attacks
      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error) {
      console.error("[PasswordReset] Error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password - use token to set new password
  app.post('/api/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      // Get token from database
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }
      
      // Check if token was already used
      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }
      
      // Hash new password and update
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);
      
      console.log(`[PasswordReset] Password reset successful for user ${resetToken.userId}`);
      res.json({ message: "Password reset successful. You can now sign in with your new password." });
    } catch (error) {
      console.error("[PasswordReset] Error:", error);
      res.status(500).json({ message: "Failed to reset password" });
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

  // Will messages routes (for public and team wills)
  app.get('/api/wills/:willId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);

      if (isNaN(willId)) {
        return res.status(400).json({ message: "Invalid will ID" });
      }

      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      const isPublic = (will as any).visibility === 'public' || !!(will as any).parentWillId;
      const isShared = (will as any).mode === 'team';

      if (!isPublic && !isShared) {
        return res.status(400).json({ message: "Messages are only available for public or team wills" });
      }

      let isParticipant: boolean;
      let messageThreadId: number;

      if (isPublic) {
        const parentId = (will as any).parentWillId || willId;
        isParticipant = await isUserPublicWillParticipant(userId, parentId);
        messageThreadId = parentId;
      } else {
        isParticipant = await isUserSharedWillParticipant(userId, willId);
        messageThreadId = willId;
      }

      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant of this Will" });
      }

      const messages = await storage.getWillMessages(messageThreadId, 50);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching will messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/wills/:willId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);

      if (isNaN(willId)) {
        return res.status(400).json({ message: "Invalid will ID" });
      }

      const text = (req.body.text || '').trim();
      if (!text) {
        return res.status(400).json({ message: "Message text is required" });
      }
      if (text.length > 500) {
        return res.status(400).json({ message: "Message must be 500 characters or less" });
      }

      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      const isPublic = (will as any).visibility === 'public' || !!(will as any).parentWillId;
      const isShared = (will as any).mode === 'team';

      if (!isPublic && !isShared) {
        return res.status(400).json({ message: "Messages are only available for public or team wills" });
      }

      let isParticipant: boolean;
      let messageThreadId: number;
      let otherParticipantIds: string[];

      if (isPublic) {
        const parentId = (will as any).parentWillId || willId;
        isParticipant = await isUserPublicWillParticipant(userId, parentId);
        messageThreadId = parentId;
        otherParticipantIds = await getOtherPublicWillParticipants(userId, parentId);
      } else {
        isParticipant = await isUserSharedWillParticipant(userId, willId);
        messageThreadId = willId;
        otherParticipantIds = await getOtherSharedWillParticipants(userId, willId);
      }

      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant of this Will" });
      }

      const message = await storage.createWillMessage({
        willId: messageThreadId,
        userId,
        text,
      });

      const sender = await storage.getUser(userId);
      const senderName = sender?.firstName || 'Someone';

      if (otherParticipantIds.length > 0) {
        const { pushNotificationService } = await import('./pushNotificationService');
        await pushNotificationService.sendWillMessageNotification(
          senderName,
          messageThreadId,
          text,
          otherParticipantIds,
        );
      }

      res.json({ ...message, user: { firstName: senderName } });
    } catch (error) {
      console.error("Error sending will message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // GET unread message count for a public/team will thread (per current user)
  app.get('/api/wills/:willId/messages/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);
      if (isNaN(willId)) return res.status(400).json({ message: "Invalid will ID" });

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: "Will not found" });

      const isPublic = (will as any).visibility === 'public' || !!(will as any).parentWillId;
      const isShared = (will as any).mode === 'team';

      if (!isPublic && !isShared) return res.status(400).json({ message: "Messages are only available for public or team wills" });

      let messageThreadId: number;
      let isParticipant: boolean;

      if (isPublic) {
        const parentId = (will as any).parentWillId || willId;
        isParticipant = await isUserPublicWillParticipant(userId, parentId);
        messageThreadId = parentId;
      } else {
        isParticipant = await isUserSharedWillParticipant(userId, willId);
        messageThreadId = willId;
      }

      if (!isParticipant) return res.status(403).json({ message: "You are not a participant of this Will" });

      const unreadCount = await storage.getWillMessageUnreadCount(userId, messageThreadId);
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // POST mark all messages in a public/team will thread as read
  app.post('/api/wills/:willId/messages/mark-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);
      if (isNaN(willId)) return res.status(400).json({ message: "Invalid will ID" });

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: "Will not found" });

      const isPublic = (will as any).visibility === 'public' || !!(will as any).parentWillId;
      const isShared = (will as any).mode === 'team';

      if (!isPublic && !isShared) return res.status(400).json({ message: "Messages are only available for public or team wills" });

      let messageThreadId: number;
      let isParticipant: boolean;

      if (isPublic) {
        const parentId = (will as any).parentWillId || willId;
        isParticipant = await isUserPublicWillParticipant(userId, parentId);
        messageThreadId = parentId;
      } else {
        isParticipant = await isUserSharedWillParticipant(userId, willId);
        messageThreadId = willId;
      }

      if (!isParticipant) return res.status(403).json({ message: "You are not a participant of this Will" });

      await storage.markWillMessagesRead(userId, messageThreadId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Will routes
  app.post('/api/wills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const isPersonalMode = req.body.mode === 'solo' || req.body.mode === 'personal';
      const isTeamMode = req.body.mode === 'team';
      
      // Prepare will data with proper types
      const isIndefinite = req.body.isIndefinite === true;
      let rawCheckInType = req.body.checkInType || (isIndefinite ? 'daily' : 'final_review');
      if (rawCheckInType === 'one-time') rawCheckInType = 'final_review';
      const validCheckInTypes = ['daily', 'specific_days', 'final_review'];
      const normalizedCheckInType = validCheckInTypes.includes(rawCheckInType) ? rawCheckInType : 'final_review';

      const willDataWithDefaults: any = {
        title: req.body.title ? String(req.body.title).trim().slice(0, 40) || null : null,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: isIndefinite ? null : (req.body.endDate ? new Date(req.body.endDate) : null),
        createdBy: userId,
        mode: isPersonalMode ? 'personal' : isTeamMode ? 'team' : 'circle',
        visibility: req.body.visibility || 'private',
        endRoomScheduledAt: req.body.endRoomScheduledAt ? new Date(req.body.endRoomScheduledAt) : null,
        checkInType: normalizedCheckInType,
        reminderTime: req.body.reminderTime || null,
        checkInTime: req.body.checkInTime || null,
        activeDays: normalizedCheckInType === 'specific_days' ? (req.body.activeDays || 'custom') : (req.body.activeDays || 'every_day'),
        customDays: req.body.customDays || null,
        isIndefinite: isIndefinite,
      };
      
      console.log("Will data before validation:", willDataWithDefaults, "isPersonalMode:", isPersonalMode);

      if (isPersonalMode) {
        // PERSONAL MODE: No circle required, respects user's scheduled start date
        
        const soloWillCount = await storage.getUserActiveSoloWillCount(userId);
        if (soloWillCount >= 3) {
          return res.status(400).json({ message: "You can have up to 3 active solo Wills" });
        }
        
        // Solo wills don't have a circleId
        willDataWithDefaults.circleId = null;
        
        const willData = insertWillSchema.parse(willDataWithDefaults);
        
        // Create will with 'pending' status (default)
        const will = await storage.createWill(willData);
        
        // Calculate and set midpointAt for milestone notification (skip for indefinite wills)
        let midpointTime = null;
        if (!isIndefinite && req.body.endDate) {
          const startTime = new Date(req.body.startDate).getTime();
          const endTime = new Date(req.body.endDate).getTime();
          midpointTime = new Date((startTime + endTime) / 2);
          await db.update(wills).set({ midpointAt: midpointTime }).where(eq(wills.id, will.id));
        }
        
        // Auto-create commitment for Solo user (required for scheduler to find participants)
        try {
          const commitmentData: any = {
            willId: will.id,
            userId: userId,
            what: req.body.what || "My personal goal",
            why: req.body.because || "",
            checkInType: normalizedCheckInType,
            checkInTime: willDataWithDefaults.checkInTime || null,
            activeDays: willDataWithDefaults.activeDays || 'every_day',
            customDays: willDataWithDefaults.customDays || null,
          };
          await storage.addWillCommitment(commitmentData);
          console.log(`[Routes] Auto-created commitment for solo Will ${will.id}`);
        } catch (commitError) {
          console.error(`[Routes] Failed to create commitment for solo Will ${will.id}:`, commitError);
        }
        
        // Solo wills stay 'pending' until the scheduler transitions them to 'active' at startDate
        // The scheduler will also send the will_started notification when transitioning
        
        // Notify all users when a new public will is created
        if (willData.visibility === 'public') {
          try {
            const creator = await storage.getUser(userId);
            const creatorName = creator?.firstName || 'Someone';
            const willTitle = req.body.what || 'a new commitment';
            const allUsers = await db.select({ id: users.id }).from(users);
            const otherUserIds = allUsers.map(u => u.id).filter(id => id !== userId);
            if (otherUserIds.length > 0) {
              const { pushNotificationService } = await import('./pushNotificationService');
              await pushNotificationService.sendNewPublicWillNotification(creatorName, willTitle, will.id, otherUserIds);
              console.log(`[Routes] New public will notification sent to ${otherUserIds.length} users for Will ${will.id}`);
            }
          } catch (notifError) {
            console.error('[Routes] Failed to send new public will notification:', notifError);
          }
        }
        
        console.log(`Created solo Will ${will.id} for user ${userId}, status: pending, starts: ${req.body.startDate}, midpoint: ${midpointTime ? midpointTime.toISOString() : 'none (indefinite)'}`);
        
        res.json({ ...will, status: 'pending', midpointAt: midpointTime });
      } else if (isTeamMode) {
        // SHARED MODE: Friends-based will — invites friends, activates at startDate if ≥1 accepts

        const invitedFriendIds: string[] = Array.isArray(req.body.invitedFriendIds) ? req.body.invitedFriendIds : [];
        if (invitedFriendIds.length === 0) {
          return res.status(400).json({ message: "At least one friend must be invited for a Team Will" });
        }
        if (invitedFriendIds.length > 5) {
          return res.status(400).json({ message: "You can invite up to 5 friends" });
        }
        // Remove duplicates and self from list
        const filteredInviteIds = [...new Set(invitedFriendIds.filter((id: string) => id !== userId))];
        if (filteredInviteIds.length === 0) {
          return res.status(400).json({ message: "Cannot invite only yourself" });
        }

        // Validate each invited user is an accepted friend
        for (const friendId of filteredInviteIds) {
          const [friendship] = await db
            .select({ id: friendships.id })
            .from(friendships)
            .where(and(
              eq(friendships.status, 'accepted'),
              or(
                and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
                and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId))
              )
            ))
            .limit(1);
          if (!friendship) {
            return res.status(403).json({ message: `User ${friendId} is not your friend` });
          }
        }

        // Validate willType
        const willType = req.body.willType || 'classic';
        if (!['classic', 'cumulative'].includes(willType)) {
          return res.status(400).json({ message: "willType must be 'classic' or 'cumulative'" });
        }
        willDataWithDefaults.willType = willType;
        if (willType === 'cumulative') {
          if (!req.body.sharedWhat) {
            return res.status(400).json({ message: "We Will requires a shared commitment (sharedWhat)" });
          }
          willDataWithDefaults.sharedWhat = req.body.sharedWhat;
        }

        // Shared wills have no circleId
        willDataWithDefaults.circleId = null;

        const willData = insertWillSchema.parse(willDataWithDefaults);
        const will = await storage.createWill(willData);

        // Calculate midpointAt if applicable
        if (!isIndefinite && req.body.endDate) {
          const startMs = new Date(req.body.startDate).getTime();
          const endMs = new Date(req.body.endDate).getTime();
          const midpoint = new Date((startMs + endMs) / 2);
          await db.update(wills).set({ midpointAt: midpoint }).where(eq(wills.id, will.id));
        }

        // Auto-create creator's commitment
        try {
          const creatorCommitmentData: any = {
            willId: will.id,
            userId,
            what: willType === 'cumulative' ? (req.body.sharedWhat || "Our shared goal") : (req.body.what || "My commitment"),
            why: req.body.because || "",
            checkInType: normalizedCheckInType,
            checkInTime: willDataWithDefaults.checkInTime || null,
            activeDays: willDataWithDefaults.activeDays || 'every_day',
            customDays: willDataWithDefaults.customDays || null,
          };
          await storage.addWillCommitment(creatorCommitmentData);
          console.log(`[Routes] Auto-created commitment for shared Will ${will.id} creator`);
        } catch (commitError) {
          console.error(`[Routes] Failed to create commitment for shared Will ${will.id}:`, commitError);
        }

        // Create invites and send push notifications
        const creator = await storage.getUser(userId);
        const creatorName = creator?.firstName || 'Someone';
        const inviteDisplayTitle = will.title || req.body.what || will.sharedWhat || undefined;

        for (const friendId of filteredInviteIds) {
          try {
            await db.insert(teamWillInvites).values({
              willId: will.id,
              invitedUserId: friendId,
              invitedByUserId: userId,
              status: 'pending',
              expiresAt: new Date(req.body.startDate),
            });

            await pushNotificationService.sendToUser(friendId, {
              title: `${creatorName} invited you to a Team Will 🤝`,
              body: inviteDisplayTitle ? `"${inviteDisplayTitle}" — tap to accept or decline` : 'Tap to accept or decline the invitation',
              category: 'shared_will_invite',
              data: { type: 'shared_will_invite', willId: will.id, deepLink: `/will/${will.id}/invite` },
            });
          } catch (inviteErr) {
            console.error(`[Routes] Failed to create invite or notify friend ${friendId} for Will ${will.id}:`, inviteErr);
          }
        }

        console.log(`[Routes] Created Team Will ${will.id} with ${filteredInviteIds.length} invites`);
        res.json(will);
      } else {
        return res.status(400).json({ message: "Invalid mode. Use 'solo', 'personal', 'team', or 'public'." });
      }
    } catch (error) {
      console.error("Error creating will:", error);
      res.status(500).json({ message: "Failed to create will" });
    }
  });

  app.post('/api/wills/:id/commitments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      
      // Get the will to check if it's cumulative
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // For cumulative wills, use the shared commitment from the will
      let whatValue = req.body.what;
      if (will.willType === 'cumulative' && will.sharedWhat) {
        whatValue = will.sharedWhat;
      }
      
      let commitCheckInType = req.body.checkInType || will.checkInType || 'final_review';
      if (commitCheckInType === 'one-time') commitCheckInType = 'final_review';
      const commitValidTypes = ['daily', 'specific_days', 'final_review'];
      if (!commitValidTypes.includes(commitCheckInType)) commitCheckInType = 'final_review';

      const commitmentData = insertWillCommitmentSchema.parse({
        ...req.body,
        what: whatValue,
        willId,
        userId,
        checkInType: commitCheckInType,
        activeDays: req.body.activeDays || will.activeDays || 'every_day',
        customDays: req.body.customDays || will.customDays || null,
      });

      // Check if user already committed
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (hasCommitted) {
        return res.status(400).json({ message: "You have already committed to this Will" });
      }

      // For team wills: authorize BEFORE writing to DB
      if (will.mode === 'team') {
        const isCreator = will.createdBy === userId;
        if (!isCreator) {
          const [acceptedInvite] = await db
            .select({ id: teamWillInvites.id })
            .from(teamWillInvites)
            .where(and(
              eq(teamWillInvites.willId, willId),
              eq(teamWillInvites.invitedUserId, userId),
              eq(teamWillInvites.status, 'accepted')
            ))
            .limit(1);
          if (!acceptedInvite) {
            return res.status(403).json({ message: "You must accept the invite before committing to this Will" });
          }
        }
      }

      // Add commitment
      const commitment = await storage.addWillCommitment(commitmentData);

      // Auto-clear any "will_proposed" in-app notification for this will
      try {
        await storage.markNotificationsReadByTypeAndWill(userId, 'will_proposed', willId);
      } catch (e) { /* non-critical */ }

      // For solo/personal wills, status is already pending→active via scheduler - no circle check needed
      if (will.mode === 'solo' || will.mode === 'personal') {
        res.json(commitment);
        return;
      }

      // For team wills — will activates at startDate via scheduler; just return commitment
      if (will.mode === 'team') {
        res.json(commitment);
        return;
      }

      res.json(commitment);
    } catch (error) {
      console.error("Error adding commitment:", error);
      res.status(500).json({ message: "Failed to add commitment" });
    }
  });

  // ─── Team Will Invite Routes ─────────────────────────────────────────────

  // GET /api/wills/my-pending-invites — all pending invites for the current user
  app.get('/api/wills/my-pending-invites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db
        .select({
          invite: teamWillInvites,
          will: wills,
          invitedBy: { id: users.id, firstName: users.firstName },
        })
        .from(teamWillInvites)
        .innerJoin(wills, eq(teamWillInvites.willId, wills.id))
        .innerJoin(users, eq(teamWillInvites.invitedByUserId, users.id))
        .where(and(
          eq(teamWillInvites.invitedUserId, userId),
          eq(teamWillInvites.status, 'pending'),
        ));
      res.json(rows);
    } catch (err) {
      console.error('[Invites] Failed to fetch pending invites:', err);
      res.status(500).json({ message: 'Failed to fetch pending invites' });
    }
  });

  // GET /api/wills/:id/invites — creator sees invite list with status
  app.get('/api/wills/:id/invites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: 'Will not found' });
      if (will.createdBy !== userId) return res.status(403).json({ message: 'Only the creator can view invites' });

      const invites = await db
        .select({
          id: teamWillInvites.id,
          willId: teamWillInvites.willId,
          invitedUserId: teamWillInvites.invitedUserId,
          status: teamWillInvites.status,
          respondedAt: teamWillInvites.respondedAt,
          expiresAt: teamWillInvites.expiresAt,
          createdAt: teamWillInvites.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(teamWillInvites)
        .innerJoin(users, eq(teamWillInvites.invitedUserId, users.id))
        .where(eq(teamWillInvites.willId, willId));

      res.json(invites);
    } catch (err) {
      console.error('[Invites] Failed to list invites:', err);
      res.status(500).json({ message: 'Failed to fetch invites' });
    }
  });

  // GET /api/wills/:id/my-invite — invitee checks their own invite status
  app.get('/api/wills/:id/my-invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      const [invite] = await db
        .select()
        .from(teamWillInvites)
        .where(and(eq(teamWillInvites.willId, willId), eq(teamWillInvites.invitedUserId, userId)))
        .limit(1);

      if (!invite) return res.status(404).json({ message: 'No invite found' });

      const will = await storage.getWillById(willId);
      let creatorName = 'A friend';
      if (will?.createdBy) {
        const creator = await storage.getUser(will.createdBy);
        if (creator) {
          creatorName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 'A friend';
        }
      }
      res.json({ invite, will: { ...will, creatorName } });
    } catch (err) {
      console.error('[Invites] Failed to fetch my-invite:', err);
      res.status(500).json({ message: 'Failed to fetch invite' });
    }
  });

  // POST /api/wills/:id/accept-invite — invitee accepts; frontend routes to SubmitCommitment
  app.post('/api/wills/:id/accept-invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      const [invite] = await db
        .select()
        .from(teamWillInvites)
        .where(and(eq(teamWillInvites.willId, willId), eq(teamWillInvites.invitedUserId, userId)))
        .limit(1);

      if (!invite) return res.status(404).json({ message: 'Invite not found' });
      if (invite.status === 'expired') return res.status(410).json({ message: 'This invite has expired' });
      if (invite.status === 'accepted') return res.status(409).json({ message: 'Invite already accepted' });
      if (invite.status === 'declined') return res.status(409).json({ message: 'Invite was declined — cannot accept' });

      // Reject acceptance if the will's startDate has already passed
      const will = await storage.getWillById(willId);
      if (will && will.startDate <= new Date()) {
        return res.status(410).json({ message: 'This invite has expired — the Will has already started' });
      }

      await db
        .update(teamWillInvites)
        .set({ status: 'accepted', respondedAt: new Date() })
        .where(eq(teamWillInvites.id, invite.id));

      res.json({ message: 'Invite accepted', willId, will });
    } catch (err) {
      console.error('[Invites] Failed to accept invite:', err);
      res.status(500).json({ message: 'Failed to accept invite' });
    }
  });

  // POST /api/wills/:id/decline-invite — invitee declines; notifies creator
  app.post('/api/wills/:id/decline-invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      const [invite] = await db
        .select()
        .from(teamWillInvites)
        .where(and(eq(teamWillInvites.willId, willId), eq(teamWillInvites.invitedUserId, userId)))
        .limit(1);

      if (!invite) return res.status(404).json({ message: 'Invite not found' });
      if (invite.status === 'expired') return res.status(410).json({ message: 'This invite has expired' });
      if (invite.status !== 'pending') return res.status(409).json({ message: `Cannot decline an invite with status: ${invite.status}` });

      await db
        .update(teamWillInvites)
        .set({ status: 'declined', respondedAt: new Date() })
        .where(eq(teamWillInvites.id, invite.id));

      // Notify creator
      const will = await storage.getWillById(willId);
      if (will) {
        try {
          const [decliner] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, userId));
          const declinerName = decliner?.firstName || 'A friend';
          const willTitle = will.title || will.sharedWhat || 'Your Will';
          await pushNotificationService.sendToUser(will.createdBy, {
            title: `${declinerName} declined your invite`,
            body: `They won't be joining "${willTitle}"`,
            category: 'invite_declined',
            data: { type: 'invite_declined', willId, deepLink: `/will/${willId}/invites` },
          });
        } catch (notifErr) {
          console.error('[Invites] Failed to notify creator of decline:', notifErr);
        }
      }

      res.json({ message: 'Invite declined' });
    } catch (err) {
      console.error('[Invites] Failed to decline invite:', err);
      res.status(500).json({ message: 'Failed to decline invite' });
    }
  });

  // ─── Will-Scoped Proof Routes ───────────────────────────────────────────────

  // GET /api/wills/:id/will-proofs — list will_proofs table entries for a will (participants only)
  app.get('/api/wills/:id/will-proofs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      // Authorization: creator, committer, or accepted invitee
      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: 'Will not found' });

      const isCreator = will.createdBy === userId;
      const [commitment] = await db.select({ id: willCommitments.id }).from(willCommitments)
        .where(and(eq(willCommitments.willId, willId), eq(willCommitments.userId, userId))).limit(1);
      const [acceptedInvite] = await db.select({ id: teamWillInvites.id }).from(teamWillInvites)
        .where(and(eq(teamWillInvites.willId, willId), eq(teamWillInvites.invitedUserId, userId), eq(teamWillInvites.status, 'accepted'))).limit(1);

      if (!isCreator && !commitment && !acceptedInvite) {
        return res.status(403).json({ message: 'Not a participant of this will' });
      }

      const proofs = await db
        .select({
          id: willProofs.id,
          willId: willProofs.willId,
          userId: willProofs.userId,
          imageUrl: willProofs.imageUrl,
          thumbnailUrl: willProofs.thumbnailUrl,
          caption: willProofs.caption,
          status: willProofs.status,
          createdAt: willProofs.createdAt,
          firstName: users.firstName,
        })
        .from(willProofs)
        .innerJoin(users, eq(willProofs.userId, users.id))
        .where(eq(willProofs.willId, willId))
        .orderBy(desc(willProofs.createdAt));

      res.json(proofs);
    } catch (err) {
      console.error('[WillProofs] Failed to list proofs:', err);
      res.status(500).json({ message: 'Failed to fetch proofs' });
    }
  });

  // POST /api/wills/:id/proof — upload a proof for a will (participants only)
  app.post('/api/wills/:id/proof', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID' });

      if (!checkProofRateLimit(userId)) {
        return res.status(429).json({ message: 'Too many drops. Try again later.' });
      }

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: 'Will not found' });

      // Authorization: must be creator or have a commitment
      const isCreator = will.createdBy === userId;
      const [commitment] = await db.select({ id: willCommitments.id }).from(willCommitments)
        .where(and(eq(willCommitments.willId, willId), eq(willCommitments.userId, userId))).limit(1);
      if (!isCreator && !commitment) {
        return res.status(403).json({ message: 'Not a participant of this will' });
      }

      const { imageUrl, thumbnailUrl, cloudinaryPublicId, caption } = req.body;

      if (!cloudinaryPublicId || typeof cloudinaryPublicId !== 'string' || !cloudinaryPublicId.startsWith('will_proofs/')) {
        return res.status(400).json({ message: 'Invalid cloudinaryPublicId. Must be in will_proofs/ folder.' });
      }

      const isValidCloudinaryUrl = (url: string) =>
        typeof url === 'string' &&
        url.startsWith('https://') &&
        (url.includes('res.cloudinary.com') || url.includes('cloudinary.com')) &&
        url.includes('/will_proofs/');

      if (!imageUrl || !isValidCloudinaryUrl(imageUrl)) {
        return res.status(400).json({ message: 'Invalid image URL. Must be a Cloudinary will_proofs URL.' });
      }
      if (thumbnailUrl && !isValidCloudinaryUrl(thumbnailUrl)) {
        return res.status(400).json({ message: 'Invalid thumbnail URL. Must be a Cloudinary will_proofs URL.' });
      }

      // One drop per user per will per day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [existing] = await db
        .select({ id: willProofs.id })
        .from(willProofs)
        .where(and(
          eq(willProofs.userId, userId),
          eq(willProofs.willId, willId),
          gte(willProofs.createdAt, today),
          ne(willProofs.status, 'failed')
        ))
        .limit(1);
      if (existing) return res.status(429).json({ message: 'You already dropped a proof today for this Will.' });

      const [proof] = await db.insert(willProofs).values({
        willId,
        userId,
        imageUrl,
        thumbnailUrl: thumbnailUrl || null,
        cloudinaryPublicId: cloudinaryPublicId || null,
        caption: caption || null,
        status: 'pending',
      }).returning();

      res.status(201).json({ id: proof.id, status: proof.status, createdAt: proof.createdAt });
    } catch (err) {
      console.error('[WillProofs] Failed to create proof:', err);
      res.status(500).json({ message: 'Failed to create proof drop.' });
    }
  });

  // ─── All-Active Wills ───────────────────────────────────────────────────────

  app.get('/api/wills/all-active', isAuthenticated, async (req: any, res) => {
    console.log('═══════════════════════════════════');
    console.log('[ALL-ACTIVE] GET /api/wills/all-active');
    console.log('[ALL-ACTIVE] Timestamp:', new Date().toISOString());
    console.log('[ALL-ACTIVE] User ID:', req.user?.id);
    console.log('[ALL-ACTIVE] User email:', req.user?.email);
    console.log('[ALL-ACTIVE] Auth header present:', !!req.headers.authorization);
    console.log('[ALL-ACTIVE] Session auth:', req.isAuthenticated?.() || false);
    try {
      const userId = req.user.id;
      const allWills = await storage.getUserAllActiveWills(userId);
      console.log('[ALL-ACTIVE] Query successful');
      console.log('[ALL-ACTIVE] Wills found:', allWills.length);
      console.log('[ALL-ACTIVE] Will IDs:', allWills.map((w: any) => w.id));
      console.log('[ALL-ACTIVE] Will statuses:', allWills.map((w: any) => `${w.id}:${w.status}`));
      console.log('═══════════════════════════════════');
      res.json(allWills);
    } catch (error: any) {
      console.error('[ALL-ACTIVE] ERROR:', error.message);
      console.error('[ALL-ACTIVE] Stack:', error.stack?.split('\n').slice(0, 5).join(' | '));
      console.log('═══════════════════════════════════');
      res.status(500).json({ message: "Failed to fetch wills", detail: error.message });
    }
  });

  // Personal wills endpoint - fetch all personal (non-circle) wills for current user
  app.get('/api/wills/personal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const personalWills = await storage.getUserPersonalWills(userId);
      res.json(personalWills);
    } catch (error) {
      console.error("Error fetching personal wills:", error);
      res.status(500).json({ message: "Failed to fetch personal wills" });
    }
  });

  // Debug test endpoint - admin-only, for diagnosing active wills issue
  app.get('/api/wills/test-active/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    const userId = req.params.userId;
    console.log('[TEST-ACTIVE] Raw test for user:', userId);
    try {
      const allWills = await storage.getUserAllActiveWills(userId);
      console.log('[TEST-ACTIVE] Found:', allWills.length, 'wills');
      console.log('[TEST-ACTIVE] IDs:', allWills.map((w: any) => w.id));
      res.json({
        timestamp: new Date().toISOString(),
        userId,
        willsCount: allWills.length,
        wills: allWills,
      });
    } catch (error: any) {
      console.error('[TEST-ACTIVE] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Legacy solo wills endpoint (redirects to personal)
  app.get('/api/wills/solo', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const personalWills = await storage.getUserPersonalWills(userId);
      res.json(personalWills);
    } catch (error) {
      console.error("Error fetching solo wills:", error);
      res.status(500).json({ message: "Failed to fetch solo wills" });
    }
  });

  // Public wills endpoint - fetch all discoverable public wills for Explore page
  app.get('/api/wills/public', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const search = req.query.search as string | undefined;
      const publicWills = await storage.getPublicWills(search);
      const enriched = await Promise.all(
        publicWills.map(async (w) => {
          const isOwner = w.createdBy === userId;
          let hasJoined = false;
          if (!isOwner) {
            const joined = await storage.getUserJoinedWill(userId, w.id);
            hasJoined = !!joined;
          }
          return { ...w, isOwner, hasJoined };
        })
      );
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching public wills:", error);
      res.status(500).json({ message: "Failed to fetch public wills" });
    }
  });

  app.get('/api/wills/:id/public-details', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const will = await storage.getWillById(willId);
      if (!will || will.visibility !== 'public') {
        return res.status(404).json({ message: "Public Will not found" });
      }
      
      const validStatuses = ['pending', 'scheduled', 'active'];
      if (!will.status || !validStatuses.includes(will.status)) {
        return res.status(404).json({ message: "This Will is no longer available to join" });
      }
      
      const commitmentList = await storage.getWillCommitments(willId);
      const firstCommitment = commitmentList[0];
      
      const [creator] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, will.createdBy));
      
      const [memberCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(wills)
        .where(and(
          eq(wills.parentWillId, willId),
          inArray(wills.status, ACTIVE_PARTICIPANT_STATUSES)
        ));
      
      res.json({
        id: will.id,
        title: will.title ?? null,
        what: firstCommitment?.what || 'Untitled commitment',
        checkInType: will.checkInType,
        startDate: will.startDate,
        endDate: will.endDate,
        isIndefinite: will.isIndefinite,
        activeDays: will.activeDays,
        customDays: will.customDays,
        creatorName: creator?.firstName || 'Anonymous',
        memberCount: Number(memberCountResult?.count || 0) + 1,
        status: will.status,
      });
    } catch (error) {
      console.error("Error fetching public will details:", error);
      res.status(500).json({ message: "Failed to fetch Will details" });
    }
  });

  app.get('/api/wills/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      if (will.visibility !== 'public' && !will.parentWillId) {
        return res.status(403).json({ message: "Participants are only available for Public Wills" });
      }

      const rootWillId = will.parentWillId || will.id;
      const rootWill = will.parentWillId ? await storage.getWillById(rootWillId) : will;

      const childWills = await db
        .select({ id: wills.id, createdBy: wills.createdBy, status: wills.status })
        .from(wills)
        .where(eq(wills.parentWillId, rootWillId));

      const activeChildWills = childWills.filter(w => ACTIVE_PARTICIPANT_STATUSES.includes(w.status));
      const allParticipantIds = [rootWill!.createdBy, ...activeChildWills.map(w => w.createdBy)];
      const uniqueIds = Array.from(new Set(allParticipantIds));

      const participants = await db
        .select({ id: users.id, firstName: users.firstName })
        .from(users)
        .where(inArray(users.id, uniqueIds));

      const [creator] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, rootWill!.createdBy));

      res.json({
        participants: participants.map(p => ({ id: p.id, firstName: p.firstName })),
        totalCount: uniqueIds.length,
        creatorName: creator?.firstName || 'Anonymous',
      });
    } catch (error) {
      console.error("Error fetching participants:", error);
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Join a public will - creates a new will instance for the user
  app.post('/api/wills/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parentWillId = parseInt(req.params.id);
      
      // Get the parent will
      const parentWill = await storage.getWillById(parentWillId);
      if (!parentWill) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      if (parentWill.visibility !== 'public') {
        return res.status(403).json({ message: "This Will is not public" });
      }
      
      // Check if user already joined this will
      const existingJoin = await storage.getUserJoinedWill(userId, parentWillId);
      if (existingJoin) {
        return res.status(400).json({ message: "You've already joined this Will" });
      }
      
      // Get the parent's commitment details
      const parentCommitments = await db
        .select()
        .from(willCommitments)
        .where(eq(willCommitments.willId, parentWillId))
        .limit(1);
      
      const parentCommitment = parentCommitments[0];
      if (!parentCommitment) {
        return res.status(400).json({ message: "Parent Will has no commitment" });
      }
      
      // Use joiner's own tracking choices if provided, otherwise fall back to parent's
      let joinCheckInType: string = req.body.checkInType || parentWill.checkInType || 'final_review';
      if (joinCheckInType === 'one-time') joinCheckInType = 'final_review';
      const joinerActiveDays: string = req.body.activeDays || parentWill.activeDays || 'every_day';
      const joinerCustomDays: string | null = req.body.customDays || parentWill.customDays || null;
      const userCheckInTime: string | null = joinCheckInType !== 'final_review'
        ? (req.body.checkInTime || parentWill.checkInTime || null)
        : null;

      // Create a new will instance for this user
      // Start date is when the user joins, not when the parent will started
      const joinDate = new Date();
      joinDate.setHours(0, 0, 0, 0);
      const effectiveStartDate = joinDate > new Date(parentWill.startDate) ? joinDate : parentWill.startDate;

      const newWill = await storage.createWill({
        createdBy: userId,
        mode: 'personal',
        visibility: 'private',
        parentWillId: parentWillId,
        startDate: effectiveStartDate,
        endDate: parentWill.endDate,
        checkInType: joinCheckInType,
        checkInTime: userCheckInTime,
        activeDays: joinerActiveDays,
        customDays: joinerCustomDays,
      });
      
      // Update status to match parent if it's active
      if (parentWill.status === 'active') {
        await storage.updateWillStatus(newWill.id, 'active');
      }
      
      const userWhy = req.body.why || parentCommitment.why;
      
      await storage.addWillCommitment({
        willId: newWill.id,
        userId: userId,
        what: parentCommitment.what,
        why: userWhy,
        checkInType: joinCheckInType,
        checkInTime: userCheckInTime,
        activeDays: joinerActiveDays,
        customDays: joinerCustomDays,
      });

      const joiningUser = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const joinerName = joiningUser[0]?.firstName || 'Someone';

      const activeChildWills = await db
        .select({ createdBy: wills.createdBy })
        .from(wills)
        .where(and(
          eq(wills.parentWillId, parentWillId),
          inArray(wills.status, ACTIVE_PARTICIPANT_STATUSES)
        ));
      const otherParticipantIds = [
        parentWill.createdBy,
        ...activeChildWills.map(w => w.createdBy)
      ].filter(id => id !== userId);
      const uniqueOtherIds = Array.from(new Set(otherParticipantIds));

      if (uniqueOtherIds.length > 0) {
        try {
          // Use full displayTitle fallback: title ?? commitment.what ?? sharedWhat
          const joinNotifTitle = parentWill.title || parentCommitment.what || parentWill.sharedWhat || undefined;
          await pushNotificationService.sendPublicWillJoinedNotification(joinerName, parentWillId, uniqueOtherIds, joinNotifTitle);
        } catch (notifError) {
          console.error('[JoinPublicWill] Failed to send notifications:', notifError);
        }
      }

      res.json({ willId: newWill.id, message: "Successfully joined" });
    } catch (error) {
      console.error("Error joining will:", error);
      res.status(500).json({ message: "Failed to join Will" });
    }
  });

  // User stats endpoint - get overall will statistics for a user
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const mode = req.query.mode as 'solo' | 'circle' | 'team' | 'public' | undefined;
      const validModes = ['solo', 'circle', 'team', 'public'];
      const filteredMode = mode && validModes.includes(mode) ? mode : undefined;
      const stats = await storage.getUserWillStats(userId, filteredMode);
      res.json(stats);
    } catch (error) {
      console.error("[USER-STATS] Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  // Will History endpoint - get completed wills for a user filtered by mode
  app.get('/api/wills/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const mode = req.query.mode as 'solo' | 'circle' | 'team' | 'public';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const enhanced = req.query.enhanced === 'true';
      
      console.log(`[HISTORY] Fetching ${mode} history for user ${userId} (enhanced: ${enhanced})`);
      
      if (!mode || !['solo', 'circle', 'team', 'public'].includes(mode)) {
        return res.status(400).json({ message: "Invalid mode. Must be 'solo', 'circle', 'team', or 'public'." });
      }
      
      // Use enhanced version with check-in data if requested
      if (enhanced) {
        const history = await storage.getUserWillHistoryWithCheckIns(userId, mode, limit);
        console.log(`[HISTORY] Found ${history.length} completed ${mode} wills for user ${userId}`);
        return res.json(history);
      }
      
      const history = await storage.getUserWillHistory(userId, mode, limit);
      console.log(`[HISTORY] Found ${history.length} completed ${mode} wills for user ${userId}`);
      
      res.json(history);
    } catch (error) {
      console.error("[HISTORY] Error fetching will history:", error);
      res.status(500).json({ message: "Failed to fetch will history" });
    }
  });

  app.get('/api/wills/:id/details', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      
      if (!willWithCommitments) {
        return res.status(404).json({ message: "Will not found" });
      }

      // For team wills: memberCount = creator + accepted invitees (the true participant pool)
      // For other wills: fall back to commitments length (original behavior)
      let memberCount: number;
      if ((willWithCommitments as any).mode === 'team') {
        const participantIds = await getSharedWillParticipantIds(willId);
        memberCount = Math.max(participantIds.length, 1);
      } else {
        memberCount = willWithCommitments.commitments?.length || 1;
      }

      const acknowledgedCount = await storage.getWillAcknowledgmentCount(willId);
      
      const status = getWillStatus(willWithCommitments, memberCount);
      
      // JIT (Just-In-Time) state checks: Update will status immediately when requested
      // This ensures correct state even if scheduler hasn't run (dev restarts, deployment sleep, etc.)
      if (status !== willWithCommitments.status) {
        console.log(`[JIT] Transitioning Will ${willId}: ${willWithCommitments.status} → ${status}`);
        await storage.updateWillStatus(willId, status);
        
        // Update the object to reflect the new status
        willWithCommitments.status = status;
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

      // Get creator name for display
      const creator = await storage.getUser(willWithCommitments.createdBy);
      const creatorFirstName = creator?.firstName || 'Someone';
      const creatorLastName = creator?.lastName || '';

      res.json({
        ...willWithCommitments,
        status,
        memberCount,
        acknowledgedCount,
        commitments: commitmentsWithProgress,
        creatorFirstName,
        creatorLastName,
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

      console.log(`[ACKNOWLEDGE] User ${userId} attempting to acknowledge Will ${willId}`);

      // Check if user has committed to this will
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      console.log(`[ACKNOWLEDGE] User committed check: ${hasCommitted}`);
      if (!hasCommitted) {
        console.log(`[ACKNOWLEDGE] ❌ User ${userId} has not committed to Will ${willId} - rejecting`);
        return res.status(403).json({ message: "Only users who submitted commitments can acknowledge completion" });
      }

      // Check if user already acknowledged
      const hasAcknowledged = await storage.hasUserAcknowledged(willId, userId);
      console.log(`[ACKNOWLEDGE] User already acknowledged check: ${hasAcknowledged}`);
      if (hasAcknowledged) {
        console.log(`[ACKNOWLEDGE] ⚠️ User ${userId} already acknowledged Will ${willId}`);
        return res.status(400).json({ message: "You have already acknowledged this Will" });
      }

      // Add acknowledgment
      console.log(`[ACKNOWLEDGE] Creating acknowledgment for User ${userId}, Will ${willId}`);
      const acknowledgment = await storage.addWillAcknowledgment({
        willId,
        userId,
      });
      console.log(`[ACKNOWLEDGE] ✅ Acknowledgment created:`, acknowledgment);

      // Check if all committed members have acknowledged
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      if (!willWithCommitments) {
        return res.status(404).json({ message: "Will not found" });
      }

      const commitmentCount = willWithCommitments.commitments?.length || 0;
      const acknowledgedCount = await storage.getWillAcknowledgmentCount(willId);

      console.log(`[ACKNOWLEDGE] Acknowledgment counts - Acknowledged: ${acknowledgedCount}, Committed: ${commitmentCount}`);

      // NEW FEATURE: If Will is in will_review and all members acknowledge, transition to completed
      // This provides a fallback path if members skip the review flow
      if (willWithCommitments.status === 'will_review' && acknowledgedCount >= commitmentCount) {
        console.log(`[ACKNOWLEDGE] All members acknowledged in will_review - transitioning to completed`);
        await storage.updateWillStatus(willId, 'completed');
        // Update the local copy to reflect the new status
        willWithCommitments.status = 'completed';
      }

      // If all committed members have acknowledged and Will is completed, archive it
      // This allows creation of new wills
      if (willWithCommitments.status === 'completed' && acknowledgedCount >= commitmentCount) {
        console.log(`[ACKNOWLEDGE] 🎉 All members acknowledged - archiving Will ${willId}`);
        await storage.updateWillStatus(willId, 'archived');
        
        // Send Ready for New Will notification to all committed members
        try {
          const memberIds = (willWithCommitments.commitments || []).map(c => c.userId);
          await pushNotificationService.sendReadyForNewWillNotification(memberIds);
          console.log(`[Routes] ✅ Ready for New Will notification sent for Will ${willId}`);
        } catch (error) {
          console.error(`[Routes] ❌ Failed to send Ready for New Will notification:`, error);
        }
      } else {
        console.log(`[ACKNOWLEDGE] ⏳ Waiting for more acknowledgments (${acknowledgedCount}/${commitmentCount})`);
      }

      console.log(`[ACKNOWLEDGE] ✅ Sending response with acknowledgedCount=${acknowledgedCount}`);
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

  // Will Review endpoints
  app.post('/api/wills/:id/review', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      
      console.log(`[REVIEW] ========================================`);
      console.log(`[REVIEW] POST /api/wills/${willId}/review`);
      console.log(`[REVIEW] User ID: ${userId}`);
      console.log(`[REVIEW] Request body:`, JSON.stringify(req.body, null, 2));
      
      const { followThrough, reflectionText } = req.body;
      
      console.log(`[REVIEW] Extracted - followThrough: "${followThrough}", reflectionText: "${reflectionText}"`);

      // Validate input
      let reviewData;
      try {
        reviewData = insertWillReviewSchema.parse({
          willId,
          userId,
          followThrough,
          reflectionText,
        });
        console.log(`[REVIEW] Zod validation passed:`, reviewData);
      } catch (zodError: any) {
        console.error(`[REVIEW] ❌ Zod validation FAILED:`, zodError.errors || zodError.message);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: zodError.errors || zodError.message 
        });
      }

      // Check if user has committed to this will
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (!hasCommitted) {
        return res.status(403).json({ message: "Only users who committed to this Will can submit a review" });
      }

      // Check if user already submitted a review
      const existingReview = await storage.getWillReview(willId, userId);
      if (existingReview) {
        return res.status(400).json({ message: "You have already submitted a review for this Will" });
      }

      // Validate reflection text length
      if (reflectionText.length > 200) {
        return res.status(400).json({ message: "Reflection text must be 200 characters or less" });
      }

      // Validate followThrough value
      if (!['yes', 'mostly', 'no'].includes(followThrough)) {
        return res.status(400).json({ message: "Follow-through must be 'yes', 'mostly', or 'no'" });
      }

      // Add review
      const review = await storage.addWillReview(reviewData);

      // Auto-clear any "review_required" in-app notification for this will
      try {
        await storage.markNotificationsReadByTypeAndWill(userId, 'review_required', willId);
      } catch (e) { /* non-critical */ }

      // Send member_review_submitted notification to other members of team wills
      try {
        const will = await storage.getWillById(willId);
        if (will && will.mode === 'team') {
          const reviewer = await storage.getUser(userId);
          const reviewerName = reviewer?.firstName || 'Someone';
          const willWithComms = await storage.getWillWithCommitments(willId);
          const otherMemberIds = (willWithComms?.commitments || [])
            .filter(c => c.userId !== userId)
            .map(c => c.userId);
          if (otherMemberIds.length > 0) {
            await pushNotificationService.sendMemberReviewSubmittedNotification(reviewerName, willId, otherMemberIds);
            console.log(`[REVIEW] Sent review submitted notification to ${otherMemberIds.length} other members`);
          }
        }
      } catch (notificationError) {
        console.error("[REVIEW] Failed to send review submitted notification:", notificationError);
      }

      // Check if all committed members have reviewed
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      if (!willWithCommitments) {
        return res.status(404).json({ message: "Will not found" });
      }

      const commitmentCount = willWithCommitments.commitments?.length || 0;
      const reviewCount = await storage.getWillReviewCount(willId);
      const allReviewed = reviewCount >= commitmentCount;

      // If all members reviewed, check if End Room exists
      if (allReviewed) {
        const isSoloOrPersonal = willWithCommitments.mode === 'solo' || willWithCommitments.mode === 'personal';
        
        if (!willWithCommitments.endRoomScheduledAt) {
          // No End Room - move directly to completed
          await storage.updateWillStatus(willId, 'completed');
          
          // Solo/personal wills skip acknowledgment — auto-acknowledge and archive
          if (isSoloOrPersonal) {
            console.log(`[REVIEW] Solo/personal will ${willId} — auto-acknowledging and archiving`);
            try {
              await storage.addWillAcknowledgment({ willId, userId });
            } catch (e) { /* may already be acknowledged */ }
            await storage.updateWillStatus(willId, 'archived');
          }
        } else {
          // End Room exists - check if it already happened
          const now = new Date();
          const endRoomEnd = new Date(new Date(willWithCommitments.endRoomScheduledAt).getTime() + 30 * 60 * 1000);
          if (now >= endRoomEnd) {
            // End Room already happened - move to completed
            await storage.updateWillStatus(willId, 'completed');
            
            if (isSoloOrPersonal) {
              console.log(`[REVIEW] Solo/personal will ${willId} — auto-acknowledging and archiving (post End Room)`);
              try {
                await storage.addWillAcknowledgment({ willId, userId });
              } catch (e) { /* may already be acknowledged */ }
              await storage.updateWillStatus(willId, 'archived');
            }
          }
          // Otherwise stay in will_review until End Room happens
        }
      }

      res.json({
        ...review,
        reviewCount,
        commitmentCount,
        allReviewed
      });
    } catch (error: any) {
      console.error(`[REVIEW] ❌ FATAL ERROR submitting will review:`);
      console.error(`[REVIEW] Error name:`, error?.name);
      console.error(`[REVIEW] Error message:`, error?.message);
      console.error(`[REVIEW] Error stack:`, error?.stack);
      console.error(`[REVIEW] Full error:`, error);
      res.status(500).json({ 
        message: "Failed to submit will review",
        error: error?.message || "Unknown error"
      });
    }
  });

  app.get('/api/wills/:id/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      // Get will to ensure it exists
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      // Authorization: Check if user has committed to this will (circle member verification)
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (!hasCommitted) {
        return res.status(403).json({ message: "Only members who committed to this Will can view reviews" });
      }

      // Get all reviews for this will with user info
      const reviews = await storage.getWillReviews(willId);

      res.json(reviews);
    } catch (error) {
      console.error("Error fetching will reviews:", error);
      res.status(500).json({ message: "Failed to fetch will reviews" });
    }
  });

  app.get('/api/wills/:id/review-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      // Get will to ensure it exists
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      // Authorization: Check if user has committed to this will (circle member verification)
      const hasCommitted = await storage.hasUserCommitted(willId, userId);
      if (!hasCommitted) {
        return res.status(403).json({ message: "Only members who committed to this Will can view review status" });
      }

      // Get user's review for this will
      const review = await storage.getWillReview(willId, userId);

      // Get total review count and member count for progress display
      const reviewCount = await storage.getWillReviewCount(willId);
      const willWithCommitments = await storage.getWillWithCommitments(willId);
      const totalMembers = willWithCommitments?.commitments?.length || 0;

      res.json({
        hasReviewed: !!review,
        needsReview: !review, // Inverse of hasReviewed for frontend convenience
        review: review || null,
        reviewCount,
        totalMembers
      });
    } catch (error) {
      console.error("Error fetching review status:", error);
      res.status(500).json({ message: "Failed to fetch review status" });
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

  // Daily check-in routes (for daily tracking feature)
  app.post('/api/wills/:id/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      const { date, status, reflectionText, isRetroactive } = req.body;

      if (!date || !status) {
        return res.status(400).json({ message: "Date and status are required" });
      }

      if (!['yes', 'no', 'partial'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'yes', 'no', or 'partial'" });
      }

      // Check if check-in already exists for this date
      const existingCheckIn = await storage.getWillCheckIn(willId, userId, date);
      if (existingCheckIn) {
        // Update existing check-in
        const updated = await storage.updateWillCheckIn(existingCheckIn.id, {
          status,
          reflectionText: reflectionText || null,
          isRetroactive: isRetroactive || false,
        });
        return res.json(updated);
      }

      // Create new check-in
      const checkIn = await storage.createWillCheckIn({
        willId,
        userId,
        date,
        status,
        reflectionText: reflectionText || null,
        isRetroactive: isRetroactive || false,
      });

      res.json(checkIn);
    } catch (error) {
      console.error("Error creating check-in:", error);
      res.status(500).json({ message: "Failed to create check-in" });
    }
  });

  app.get('/api/wills/:id/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      const checkIns = await storage.getWillCheckIns(willId, userId);
      res.json(checkIns);
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      res.status(500).json({ message: "Failed to fetch check-ins" });
    }
  });

  app.get('/api/wills/:id/check-in-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      const progress = await storage.getWillCheckInProgress(willId, userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching check-in progress:", error);
      res.status(500).json({ message: "Failed to fetch check-in progress" });
    }
  });

  // Final reflection routes
  app.post('/api/wills/:id/final-reflection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);
      const { feeling, finalThoughts } = req.body;

      if (!feeling) {
        return res.status(400).json({ message: "Feeling is required" });
      }

      if (!['great', 'okay', 'could_improve'].includes(feeling)) {
        return res.status(400).json({ message: "Feeling must be 'great', 'okay', or 'could_improve'" });
      }

      // Check if reflection already exists
      const existing = await storage.getWillFinalReflection(willId, userId);
      if (existing) {
        return res.status(409).json({ message: "Final reflection already exists" });
      }

      const reflection = await storage.createWillFinalReflection({
        willId,
        userId,
        feeling,
        finalThoughts: finalThoughts || null,
      });

      res.json(reflection);
    } catch (error) {
      console.error("Error creating final reflection:", error);
      res.status(500).json({ message: "Failed to create final reflection" });
    }
  });

  app.get('/api/wills/:id/final-reflection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      const reflection = await storage.getWillFinalReflection(willId, userId);
      if (!reflection) {
        return res.status(404).json({ message: "Final reflection not found" });
      }

      res.json(reflection);
    } catch (error) {
      console.error("Error fetching final reflection:", error);
      res.status(500).json({ message: "Failed to fetch final reflection" });
    }
  });

  // Push notification routes
  app.post('/api/wills/:id/push', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.id);

      // Get will to ensure it exists and is active
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      if (!ACTIVE_PARTICIPANT_STATUSES.includes(will.status)) {
        return res.status(400).json({ message: "Push notifications are only available for active wills" });
      }

      const isPublicWill = (will as any).visibility === 'public' || !!(will as any).parentWillId;
      const pushDedupeId = isPublicWill ? ((will as any).parentWillId || willId) : willId;

      // Check if user has already pushed (normalized to parent for public wills)
      const hasAlreadyPushed = await storage.hasUserPushed(pushDedupeId, userId);
      if (hasAlreadyPushed) {
        return res.status(409).json({ message: "You have already pushed for this will" });
      }

      // Get pusher info
      const pusher = await storage.getUser(userId);
      const pusherName = pusher?.firstName && pusher?.lastName 
        ? `${pusher.firstName} ${pusher.lastName}`
        : pusher?.email || 'Someone';

      let memberIds: string[] = [];

      if (isPublicWill) {
        const parentId = (will as any).parentWillId || willId;
        const isParticipant = await isUserPublicWillParticipant(userId, parentId);
        if (!isParticipant) {
          return res.status(403).json({ message: "You are not a participant of this Will" });
        }
        memberIds = await getOtherPublicWillParticipants(userId, parentId);
      } else if (will.mode === 'team') {
        const willWithCommsForPush = await storage.getWillWithCommitments(willId);
        memberIds = (willWithCommsForPush?.commitments || [])
          .filter(c => c.userId !== userId)
          .map(c => c.userId);
      }

      // Record the push (normalized to parent for public wills)
      const push = await storage.addWillPush({
        willId: pushDedupeId,
        userId,
      });

      // Send real push notifications to all other members via APNs
      if (memberIds.length > 0) {
        const { pushNotificationService } = await import('./pushNotificationService');
        // Use full displayTitle fallback: title ?? commitment.what ?? sharedWhat
        const willWithCommitmentsForPush = await storage.getWillWithCommitments(willId);
        const pusherCommitment = willWithCommitmentsForPush?.commitments?.find(c => c.userId === userId);
        const willTitle = will.title || pusherCommitment?.what || will.sharedWhat || 'Your Will';
        const notificationWillId = isPublicWill ? pushDedupeId : willId;
        await pushNotificationService.sendTeamPushNotification(pusherName, willTitle, memberIds, notificationWillId);
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

      const will = await storage.getWillById(willId);
      const isPublic = will && ((will as any).visibility === 'public' || !!(will as any).parentWillId);
      const checkId = isPublic ? ((will as any).parentWillId || willId) : willId;

      const hasUserPushed = await storage.hasUserPushed(checkId, userId);
      const pushes = await storage.getWillPushes(checkId);

      res.json({ 
        hasUserPushed, 
        pushes 
      });
    } catch (error) {
      console.error("Error getting push status:", error);
      res.status(500).json({ message: "Failed to get push status" });
    }
  });

  // In-app notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getUserUnreadNotifications(userId);
      const count = notifications.length;
      res.json({ notifications, count });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });


  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationRead(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
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
      const { limit = '50', offset = '0' } = req.query;
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const allCircles = await db.select().from(circles).limit(limitNum).offset(offsetNum).orderBy(desc(circles.createdAt));
      const result = await Promise.all(allCircles.map(async (circle) => {
        const [memberCount] = await db.select({ count: sql<number>`count(*)` }).from(circleMembers).where(eq(circleMembers.circleId, circle.id));
        return { ...circle, memberCount: Number(memberCount?.count || 0) };
      }));
      res.json(result);
    } catch (error) {
      console.error("Error fetching circles:", error);
      res.status(500).json({ message: "Failed to fetch circles" });
    }
  });

  app.delete('/api/admin/circles/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const circleId = parseInt(req.params.id);
      await db.delete(circleMembers).where(eq(circleMembers.circleId, circleId));
      await db.delete(circleMessages).where(eq(circleMessages.circleId, circleId));
      await db.delete(circles).where(eq(circles.id, circleId));
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
      
      // Public Will joiners cannot change the commitment text — only their personal "why"
      const isPublicWillJoiner = !!will.parentWillId;
      const updateData: Record<string, any> = { why: why.trim() };
      if (!isPublicWillJoiner) {
        updateData.what = what.trim();
      }

      if (req.body.checkInType !== undefined) {
        let editCheckInType = req.body.checkInType;
        if (editCheckInType === 'one-time') editCheckInType = 'final_review';
        const editValidTypes = ['daily', 'specific_days', 'final_review'];
        if (editValidTypes.includes(editCheckInType)) {
          updateData.checkInType = editCheckInType;
        }
      }
      if (req.body.checkInTime !== undefined) {
        updateData.checkInTime = req.body.checkInTime;
      }
      if (req.body.activeDays !== undefined) {
        updateData.activeDays = req.body.activeDays;
      }
      if (req.body.customDays !== undefined) {
        updateData.customDays = req.body.customDays;
      }

      const [updatedCommitment] = await db
        .update(willCommitments)
        .set(updateData)
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

      // Public Will joiners cannot modify the timeline (it's set by the original creator)
      if (will.parentWillId) {
        return res.status(403).json({ message: "Timeline is set by the Public Will creator and cannot be changed" });
      }
      
      // Can only update if status is pending or scheduled
      if (will.status === 'active' || will.status === 'completed') {
        return res.status(400).json({ message: "Cannot modify an active or completed will" });
      }
      
      const { startDate, endDate, title } = req.body;
      
      // Allow title-only updates (no dates required for title change)
      if (!startDate && !endDate) {
        if (title !== undefined) {
          if (title !== null && title !== '' && (typeof title !== 'string' || title.trim().length > 40)) {
            return res.status(400).json({ message: "Title must be 40 characters or fewer" });
          }
          const trimmed = title ? String(title).trim() : null;
          await storage.updateWill(willId, { title: trimmed || null });
          return res.json({ message: "Will updated successfully" });
        }
        return res.status(400).json({ message: "Start date and end date are required" });
      }

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

      const updates: Record<string, any> = { startDate: start, endDate: end };
      if (title !== undefined) {
        updates.title = title ? String(title).trim().slice(0, 40) || null : null;
      }
      await storage.updateWill(willId, updates);
      
      res.json({ message: "Will updated successfully" });
    } catch (error) {
      console.error("Error updating will:", error);
      res.status(500).json({ message: "Failed to update will" });
    }
  });

  // Update will title (originator only, max 40 chars)
  // PATCH /api/wills/:id — originator-only update for title (and future fields)
  app.patch('/api/wills/:id', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: "Will not found" });
      if (will.createdBy !== userId) return res.status(403).json({ message: "Only the Will creator can update it" });

      const updates: Partial<{ title: string | null }> = {};
      const { title } = req.body;

      if (title !== undefined) {
        if (title === null || title === '') {
          updates.title = null;
        } else if (typeof title !== 'string' || title.trim().length > 40) {
          return res.status(400).json({ message: "Title must be 40 characters or fewer" });
        } else {
          updates.title = title.trim();
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await storage.updateWill(willId, updates);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating will:", error);
      res.status(500).json({ message: "Failed to update will" });
    }
  });

  // Update notification settings for a will (reminderTime)
  app.patch('/api/wills/:id/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;

      const will = await storage.getWillById(willId);
      if (!will) return res.status(404).json({ message: "Will not found" });

      const hasAccess = will.createdBy === userId;
      if (!hasAccess) {
        const commitments = await storage.getWillCommitments(willId);
        const isParticipant = commitments.some((c: any) => c.userId === userId);
        if (!isParticipant) return res.status(403).json({ message: "Not authorized" });
      }

      const { reminderTime } = req.body;

      if (reminderTime !== null && reminderTime !== undefined) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(reminderTime)) {
          return res.status(400).json({ message: "Invalid time format. Use HH:MM" });
        }
      }

      await db.update(wills).set({ reminderTime: reminderTime || null }).where(eq(wills.id, willId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating will notifications:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // Pause a will (only allowed for active indefinite wills)
  app.post('/api/wills/:id/pause', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Only creator can pause the will
      if (will.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can pause this Will" });
      }
      
      // Can only pause active wills
      if (will.status !== 'active') {
        return res.status(400).json({ message: "Can only pause active Wills" });
      }
      
      // Set pausedAt timestamp and update status
      await db.update(wills)
        .set({ pausedAt: new Date(), status: 'paused' })
        .where(eq(wills.id, willId));
      
      res.json({ message: "Will paused successfully" });
    } catch (error) {
      console.error("Error pausing will:", error);
      res.status(500).json({ message: "Failed to pause Will" });
    }
  });

  // Resume a paused will
  app.post('/api/wills/:id/resume', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Only creator can resume the will
      if (will.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can resume this Will" });
      }
      
      // Can only resume paused wills
      if (will.status !== 'paused') {
        return res.status(400).json({ message: "Can only resume paused Wills" });
      }
      
      // Clear pausedAt and set status back to active
      await db.update(wills)
        .set({ pausedAt: null, status: 'active' })
        .where(eq(wills.id, willId));
      
      res.json({ message: "Will resumed successfully" });
    } catch (error) {
      console.error("Error resuming will:", error);
      res.status(500).json({ message: "Failed to resume Will" });
    }
  });

  // Terminate a will completely
  app.post('/api/wills/:id/terminate', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }
      
      // Only creator can terminate the will
      if (will.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can terminate this Will" });
      }
      
      // Can terminate active, paused, or pending wills
      if (will.status === 'completed' || will.status === 'terminated') {
        return res.status(400).json({ message: "Will is already completed or terminated" });
      }
      
      if (will.isIndefinite) {
        const nowDate = new Date();
        await db.update(wills)
          .set({ status: 'will_review', endDate: nowDate, completionNotificationSentAt: nowDate })
          .where(eq(wills.id, willId));
        res.json({ message: "Will moved to review", status: 'will_review' });
      } else {
        await db.update(wills)
          .set({ status: 'terminated', endDate: new Date() })
          .where(eq(wills.id, willId));
        res.json({ message: "Will terminated successfully", status: 'terminated' });
      }
    } catch (error) {
      console.error("Error terminating will:", error);
      res.status(500).json({ message: "Failed to terminate Will" });
    }
  });

  // Leave a will — for circle wills ends for ALL members, for public wills ends only the user's child will
  app.post('/api/wills/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const willId = parseInt(req.params.id);
      const userId = req.user.id;

      const will = await storage.getWillById(willId);
      if (!will) {
        return res.status(404).json({ message: "Will not found" });
      }

      if (will.status === 'completed' || will.status === 'terminated' || will.status === 'archived') {
        return res.status(400).json({ message: "This Will has already ended" });
      }

      // Handle public will leave (child will with parentWillId)
      if (will.parentWillId) {
        if (will.createdBy !== userId) {
          return res.status(403).json({ message: "You can only leave your own joined Will" });
        }

        await db.update(wills)
          .set({ status: 'terminated', endDate: new Date() })
          .where(eq(wills.id, willId));

        const leavingUser = await db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const leaverName = leavingUser[0]?.firstName || 'A member';

        const parentWill = await storage.getWillById(will.parentWillId);
        const parentWillId = will.parentWillId;

        const [parentCommitment] = await db
          .select({ what: willCommitments.what })
          .from(willCommitments)
          .where(eq(willCommitments.willId, parentWillId))
          .limit(1);
        const willTitle = parentCommitment?.what || undefined;

        const activeChildWills = await db
          .select({ createdBy: wills.createdBy })
          .from(wills)
          .where(and(
            eq(wills.parentWillId, parentWillId),
            sql`${wills.id} != ${willId}`,
            inArray(wills.status, ACTIVE_PARTICIPANT_STATUSES)
          ));

        const otherParticipantIds = [
          ...(parentWill ? [parentWill.createdBy] : []),
          ...activeChildWills.map(w => w.createdBy)
        ].filter(id => id !== userId);
        const uniqueOtherIds = Array.from(new Set(otherParticipantIds));

        if (uniqueOtherIds.length > 0) {
          try {
            await pushNotificationService.sendPublicWillLeftNotification(leaverName, parentWillId, uniqueOtherIds, willTitle);
          } catch (notifError) {
            console.error('[LeavePublicWill] Failed to send notifications:', notifError);
          }
        }

        console.log(`[LeavePublicWill] User ${userId} (${leaverName}) left public Will ${willId} (parent: ${parentWillId})`);
        return res.json({ message: "You left the Will. Your progress has been saved.", status: 'terminated' });
      }

      // Handle circle/team will leave (original behavior — ends for ALL members)
      if (will.mode !== 'circle' && will.mode !== 'team') {
        return res.status(400).json({ message: "Leave is only available for Circle, Shared, or Public Wills" });
      }

      const commitments = await db
        .select({ userId: willCommitments.userId })
        .from(willCommitments)
        .where(eq(willCommitments.willId, willId));

      const isMember = commitments.some(c => c.userId === userId);
      if (!isMember && will.createdBy !== userId) {
        return res.status(403).json({ message: "You are not a member of this Will" });
      }

      await db.update(wills)
        .set({ status: 'terminated', endDate: new Date() })
        .where(eq(wills.id, willId));

      const leavingUser = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const leaverName = leavingUser[0]?.firstName || 'A member';

      const otherMemberIds = commitments
        .map(c => c.userId)
        .filter(id => id !== userId);
      if (will.createdBy !== userId && !commitments.some(c => c.userId === will.createdBy)) {
        otherMemberIds.push(will.createdBy);
      }

      if (otherMemberIds.length > 0) {
        try {
          await pushNotificationService.sendWillLeftNotification(leaverName, willId, otherMemberIds);
        } catch (notifError) {
          console.error('[LeaveWill] Failed to send notifications:', notifError);
        }
      }

      console.log(`[LeaveWill] User ${userId} (${leaverName}) left Will ${willId}, ending it for all members`);
      res.json({ message: "You left the Will. It has ended for everyone.", status: 'terminated' });
    } catch (error) {
      console.error("Error leaving will:", error);
      res.status(500).json({ message: "Failed to leave Will" });
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
      
      // Check if user is a committed participant of this will
      const endRoomWillWithComms = await storage.getWillWithCommitments(willId);
      const isParticipant = (endRoomWillWithComms?.commitments || []).some(c => c.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You must be a participant to access the End Room" });
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
        
        // If token is already associated with a real user
        if (existing.userId && existing.userId !== 'pending' && existing.userId !== null) {
          // CRITICAL FIX: If same user is re-registering, just acknowledge (prevents race conditions)
          if (existing.userId === userId) {
            console.log(`🔒 [DeviceToken] Token already belongs to requesting user ${userId}, acknowledging`);
            return res.json({ 
              success: true, 
              message: 'Token already associated with your account',
              action: 'already_yours',
              alreadyAssociated: true,
              tokenHash: deviceToken.substring(0, 10) + '...'
            });
          }
          
          // 🔥 CRITICAL FIX: Prevent "pending" from overwriting a real user association!
          // This happens when iOS DIRECT fires AFTER login and sends userId: "pending"
          if (userId === 'pending') {
            console.log(`🛡️ [DeviceToken] PROTECTION: Rejecting "pending" overwrite of real user ${existing.userId}`);
            console.log(`🛡️ [DeviceToken] This is likely iOS DIRECT firing after login - ignoring`);
            return res.json({ 
              success: true, 
              message: 'Token already associated with a user, ignoring pending request',
              action: 'protected_existing_association',
              alreadyAssociated: true,
              tokenHash: deviceToken.substring(0, 10) + '...',
              existingUserId: existing.userId.substring(0, 10) + '...'
            });
          }
          
          // If token belongs to a DIFFERENT real user (not pending), reassign it to the new user
          // This handles the case where a user switches accounts on the same device
          console.log(`🔄 [DeviceToken] Token currently belongs to user ${existing.userId}, reassigning to ${userId}`);
          console.log(`🔄 [DeviceToken] This is likely an account switch on the same device`);
          // Allow the update to proceed (don't return early)
        } else {
          // Token exists but still pending - allow update
          console.log(`🔄 [DeviceToken] Token exists but pending, allowing update`);
        }
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
        const existing = existingToken[0];
        
        // 🔒 CRITICAL RACE CONDITION FIX: Use database-level guard to prevent pending from overwriting real user
        // This protects against iOS DIRECT firing AFTER login has already associated the token
        if (!finalUserId) {
          // This is a pending registration - only update if token doesn't have a real user
          console.log(`[DeviceToken] 🔍 Pending registration - checking if token already has real user...`);
          console.log(`[DeviceToken] 🔍 Existing userId: ${existing.userId}`);
          
          // Use guarded UPDATE: only set userId=NULL if current userId IS NULL
          const result = await db
            .update(deviceTokens)
            .set({ 
              isActive: true,
              isSandbox: environment === 'SANDBOX',
              updatedAt: new Date(),
              registrationSource: 'api_device_token_pending_update'
            })
            .where(
              and(
                eq(deviceTokens.deviceToken, deviceToken),
                or(
                  sql`${deviceTokens.userId} IS NULL`,
                  eq(deviceTokens.userId, 'pending')
                )
              )
            )
            .returning();
          
          if (result.length === 0) {
            // No rows updated - token already has a real user, don't overwrite!
            console.log(`🛡️ [DeviceToken] RACE PROTECTION: Token already associated with real user, rejecting pending update`);
            console.log(`🛡️ [DeviceToken] Existing userId: ${existing.userId}, attempted userId: ${finalUserId}`);
            return res.json({ 
              success: true, 
              message: 'Token already associated with a user, pending request ignored',
              action: 'race_protection_active',
              alreadyAssociated: true,
              tokenHash: deviceToken.substring(0, 10) + '...'
            });
          }
          console.log(`[DeviceToken] ✅ Updated pending token with environment: ${environment}`);
        } else {
          // This is a real user registration - always update
          console.log(`[DeviceToken] ✅ Updating token with real userId: ${finalUserId}`);
          await db
            .update(deviceTokens)
            .set({ 
              userId: finalUserId,
              isActive: true,
              isSandbox: environment === 'SANDBOX',
              updatedAt: new Date(),
              registrationSource: 'api_device_token_update'
            })
            .where(eq(deviceTokens.deviceToken, deviceToken));
        }
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
      
      // 🔥 FIX: Use check-then-update pattern instead of broken INSERT...ON CONFLICT
      // (The device_tokens table doesn't have a unique constraint on device_token column)
      const existingToken = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.deviceToken, deviceToken))
        .limit(1);

      if (existingToken.length > 0) {
        // Token exists - UPDATE it
        console.log(`🔄 [TokenRegistration] Token exists, updating ownership...`);
        await db
          .update(deviceTokens)
          .set({
            userId: userId,
            isActive: true,
            isSandbox: isSandbox,
            registrationSource: 'authenticated_ownership_transfer',
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.deviceToken, deviceToken));
        console.log(`✅ [TokenRegistration] UPDATED token ${deviceToken.substring(0, 8)}...`);
      } else {
        // Token doesn't exist - INSERT it
        console.log(`🆕 [TokenRegistration] Token not found, creating new entry...`);
        await db
          .insert(deviceTokens)
          .values({
            deviceToken: deviceToken,
            userId: userId,
            platform: platform,
            isActive: true,
            isSandbox: isSandbox,
            registrationSource: 'authenticated_ownership_transfer'
          });
        console.log(`✅ [TokenRegistration] INSERTED new token ${deviceToken.substring(0, 8)}...`);
      }
        
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

  app.get('/api/today/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      const entry = await storage.getTodayEntry(userId, date);
      res.json(entry || { content: "", date });
    } catch (error) {
      console.error("Error fetching today entry:", error);
      res.status(500).json({ message: "Failed to fetch today entry" });
    }
  });

  app.put('/api/today/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.params;
      const { content } = req.body;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      if (typeof content !== 'string') {
        return res.status(400).json({ message: "Content must be a string." });
      }
      const entry = await storage.upsertTodayEntry(userId, date, content);
      res.json(entry);
    } catch (error) {
      console.error("Error saving today entry:", error);
      res.status(500).json({ message: "Failed to save today entry" });
    }
  });

  app.get('/api/today/:date/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      const rawContext = req.query.context as string;
      const context = rawContext === 'work' ? 'work' : 'personal';
      const items = await storage.getTodayItems(userId, date, context);
      res.json(items);
    } catch (error) {
      console.error("Error fetching today items:", error);
      res.status(500).json({ message: "Failed to fetch today items" });
    }
  });

  app.post('/api/today/:date/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      const rawContextPost = req.body.context;
      const context = rawContextPost === 'work' ? 'work' : 'personal';
      const parsed = insertTodayItemSchema.parse({
        userId,
        date,
        content: req.body.content,
        sortOrder: req.body.sortOrder ?? 0,
        context,
      });
      if (!parsed.content || parsed.content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required." });
      }
      const item = await storage.createTodayItem(userId, date, parsed.content.trim(), parsed.sortOrder, context);
      res.json(item);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input.", errors: error.errors });
      }
      console.error("Error creating today item:", error);
      res.status(500).json({ message: "Failed to create today item" });
    }
  });

  app.delete('/api/today/items/:itemId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID." });
      }
      await storage.deleteTodayItem(itemId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting today item:", error);
      res.status(500).json({ message: "Failed to delete today item" });
    }
  });

  app.patch('/api/today/items/:itemId/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID." });
      }
      const { checked } = req.body;
      if (typeof checked !== 'boolean') {
        return res.status(400).json({ message: "checked must be a boolean." });
      }
      const item = await storage.toggleTodayItem(itemId, userId, checked);
      res.json(item);
    } catch (error) {
      console.error("Error toggling today item:", error);
      res.status(500).json({ message: "Failed to toggle today item" });
    }
  });

  // ──────────────────────────────────────────────
  // PROOF ROUTES
  // ──────────────────────────────────────────────

  // In-memory upload tokens: map uploadToken → { userId, publicId, expiresAt }
  // Issued by /api/cloudinary/sign; consumed/validated by /api/cloudinary/abandon
  const uploadTokenStore = new Map<string, { userId: string; publicId: string; expiresAt: number }>();
  // Prune expired tokens every 15 minutes to prevent unbounded growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of uploadTokenStore.entries()) {
      if (val.expiresAt < now) uploadTokenStore.delete(key);
    }
  }, 15 * 60 * 1000).unref();

  // Simple in-memory rate limiter: 10 POST /proofs per user per hour
  const proofRateLimiter = new Map<string, { count: number; resetAt: number }>();
  // Prune expired rate limit entries every hour
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of proofRateLimiter.entries()) {
      if (val.resetAt < now) proofRateLimiter.delete(key);
    }
  }, 60 * 60 * 1000).unref();
  function checkProofRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = proofRateLimiter.get(userId);
    if (!entry || now > entry.resetAt) {
      proofRateLimiter.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
      return true;
    }
    if (entry.count >= 10) return false;
    entry.count++;
    return true;
  }

  // GET /api/cloudinary/sign — signed upload params; also issues a short-TTL upload token for secure orphan cleanup
  app.get('/api/cloudinary/sign', isAuthenticated, async (req: any, res) => {
    if (!cloudName || !cloudApiKey || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Photo uploads are not configured.' });
    }
    try {
      const userId = req.user.id;
      const timestamp = Math.round(Date.now() / 1000);
      // Derive a server-controlled public_id so we own the namespace
      const publicId = `will_proofs/${userId}_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
      const params: Record<string, any> = {
        public_id: publicId,
        timestamp,
        transformation: 'c_limit,w_1200,h_1200,q_auto',
        eager: 'c_fill,w_200,h_200,q_auto',
      };
      const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
      // Issue a short-TTL upload token (10 min) to allow ownership-verified orphan cleanup
      const uploadToken = `ut_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      uploadTokenStore.set(uploadToken, { userId, publicId, expiresAt: Date.now() + 10 * 60 * 1000 });
      res.json({ timestamp, signature, publicId, apiKey: cloudApiKey, cloudName, eager: params.eager, uploadToken });
    } catch (err) {
      console.error('[Proof] Failed to sign upload:', err);
      res.status(500).json({ message: 'Failed to generate upload signature.' });
    }
  });

  // POST /api/wills/:willId/proofs — create a new proof drop
  app.post('/api/wills/:willId/proofs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID.' });

      // Rate limit
      if (!checkProofRateLimit(userId)) {
        return res.status(429).json({ message: 'Too many drops. Try again later.' });
      }

      // Validate will participation (user must have a commitment or be creator)
      const proofWill = await storage.getWillWithCommitments(willId);
      if (!proofWill) return res.status(404).json({ message: 'Will not found.' });
      const isParticipant = (proofWill.commitments || []).some((c: any) => c.userId === userId);
      if (!isParticipant) return res.status(403).json({ message: 'You are not a participant of this will.' });

      const { imageUrl, thumbnailUrl, cloudinaryPublicId, caption } = req.body;

      // Validate that cloudinaryPublicId is scoped to our upload folder
      if (!cloudinaryPublicId || typeof cloudinaryPublicId !== 'string' || !cloudinaryPublicId.startsWith('will_proofs/')) {
        return res.status(400).json({ message: 'Invalid cloudinaryPublicId. Must be in will_proofs/ folder.' });
      }

      // Validate Cloudinary URL format
      const isValidCloudinaryUrl = (url: string) =>
        typeof url === 'string' &&
        (url.includes('res.cloudinary.com') || url.includes('cloudinary.com')) &&
        url.startsWith('https://') &&
        url.includes('/will_proofs/');
      if (!imageUrl || !isValidCloudinaryUrl(imageUrl)) {
        return res.status(400).json({ message: 'Invalid image URL. Must be a Cloudinary will_proofs URL.' });
      }
      if (thumbnailUrl && !isValidCloudinaryUrl(thumbnailUrl)) {
        return res.status(400).json({ message: 'Invalid thumbnail URL. Must be a Cloudinary will_proofs URL.' });
      }

      // One drop per user per will per day
      {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existing = await db
          .select({ id: circleProofs.id })
          .from(circleProofs)
          .where(
            and(
              eq(circleProofs.userId, userId),
              eq(circleProofs.willId, willId),
              gte(circleProofs.createdAt, today),
              ne(circleProofs.status, 'failed')
            )
          )
          .limit(1);
        if (existing.length > 0) {
          return res.status(429).json({ message: 'You already dropped a proof today for this Will.' });
        }
      }

      const [proof] = await db.insert(circleProofs).values({
        circleId: null,
        willId,
        userId,
        imageUrl,
        thumbnailUrl: thumbnailUrl || null,
        cloudinaryPublicId: cloudinaryPublicId || null,
        caption: caption || null,
        status: 'pending',
      }).returning();

      res.status(201).json({ id: proof.id, status: proof.status, createdAt: proof.createdAt });
    } catch (err) {
      console.error('[Proof] Failed to create proof:', err);
      res.status(500).json({ message: 'Failed to create proof drop.' });
    }
  });

  // PATCH /api/proofs/:proofId/confirm — confirm a proof drop
  app.patch('/api/proofs/:proofId/confirm', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const proofId = parseInt(req.params.proofId);
      if (isNaN(proofId)) return res.status(400).json({ message: 'Invalid proof ID.' });

      const [existing] = await db.select().from(circleProofs).where(eq(circleProofs.id, proofId)).limit(1);
      if (!existing) return res.status(404).json({ message: 'Proof not found.' });
      if (existing.userId !== userId) return res.status(403).json({ message: 'Not your proof.' });

      const [updated] = await db.update(circleProofs).set({ status: 'confirmed' }).where(eq(circleProofs.id, proofId)).returning();
      res.json(updated);
    } catch (err) {
      console.error('[Proof] Failed to confirm proof:', err);
      res.status(500).json({ message: 'Failed to confirm proof.' });
    }
  });

  // PATCH /api/proofs/:proofId/fail — mark proof as failed + attempt Cloudinary delete
  app.patch('/api/proofs/:proofId/fail', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const proofId = parseInt(req.params.proofId);
      if (isNaN(proofId)) return res.status(400).json({ message: 'Invalid proof ID.' });

      const [existing] = await db.select().from(circleProofs).where(eq(circleProofs.id, proofId)).limit(1);
      if (!existing) return res.status(404).json({ message: 'Proof not found.' });
      if (existing.userId !== userId) return res.status(403).json({ message: 'Not your proof.' });

      await db.update(circleProofs).set({ status: 'failed' }).where(eq(circleProofs.id, proofId));

      if (existing.cloudinaryPublicId && process.env.CLOUDINARY_API_SECRET
          && existing.cloudinaryPublicId.startsWith('will_proofs/')) {
        try {
          await cloudinary.uploader.destroy(existing.cloudinaryPublicId);
        } catch (cloudErr: any) {
          await db.insert(cloudinaryCleanupLog).values({
            publicId: existing.cloudinaryPublicId,
            reason: String(cloudErr?.message || cloudErr),
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[Proof] Failed to fail proof:', err);
      res.status(500).json({ message: 'Failed to update proof status.' });
    }
  });

  // GET /api/wills/:willId/proofs?cursor=&limit= — paginated confirmed proofs for a will
  app.get('/api/wills/:willId/proofs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const willId = parseInt(req.params.willId);
      if (isNaN(willId)) return res.status(400).json({ message: 'Invalid will ID.' });

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 200);
      const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

      // Validate will participation
      const proofFeedWill = await storage.getWillWithCommitments(willId);
      if (!proofFeedWill) return res.status(404).json({ message: 'Will not found.' });
      const isParticipant = (proofFeedWill.commitments || []).some((c: any) => c.userId === userId);
      if (!isParticipant) return res.status(403).json({ message: 'Not a participant of this will.' });

      const conditions = [
        eq(circleProofs.willId, willId),
        eq(circleProofs.status, 'confirmed'),
        ...(cursor ? [lt(circleProofs.createdAt, cursor)] : []),
      ];

      const rows = await db
        .select({
          id: circleProofs.id,
          willId: circleProofs.willId,
          userId: circleProofs.userId,
          imageUrl: circleProofs.imageUrl,
          thumbnailUrl: circleProofs.thumbnailUrl,
          caption: circleProofs.caption,
          status: circleProofs.status,
          createdAt: circleProofs.createdAt,
          firstName: users.firstName,
          email: users.email,
        })
        .from(circleProofs)
        .innerJoin(users, eq(circleProofs.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(circleProofs.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      res.json({ items, hasMore, nextCursor: hasMore ? items[items.length - 1].createdAt : null });
    } catch (err) {
      console.error('[Proof] Failed to fetch proofs:', err);
      res.status(500).json({ message: 'Failed to fetch proofs.' });
    }
  });

  // POST /api/cloudinary/abandon — ownership-verified; abandon an orphan asset using a short-TTL upload token
  // The token is issued by /api/cloudinary/sign and binds the userId to the publicId
  app.post('/api/cloudinary/abandon', isAuthenticated, async (req: any, res) => {
    if (!process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Cloudinary not configured.' });
    }
    const { uploadToken } = req.body;
    if (!uploadToken || typeof uploadToken !== 'string') {
      return res.status(400).json({ message: 'uploadToken is required.' });
    }
    const userId = req.user.id;
    const entry = uploadTokenStore.get(uploadToken);
    if (!entry) return res.status(403).json({ message: 'Invalid or expired upload token.' });
    if (entry.expiresAt < Date.now()) {
      uploadTokenStore.delete(uploadToken);
      return res.status(403).json({ message: 'Upload token expired.' });
    }
    if (entry.userId !== userId) return res.status(403).json({ message: 'Token does not belong to you.' });
    // Consume the token (single-use)
    uploadTokenStore.delete(uploadToken);
    const { publicId } = entry;
    try {
      await cloudinary.uploader.destroy(publicId);
      res.json({ success: true });
    } catch (err: any) {
      const reason = String(err?.message || err);
      await db.insert(cloudinaryCleanupLog).values({ publicId, reason });
      console.error('[Proof] Abandon failed for', publicId, reason);
      res.status(500).json({ message: 'Cloudinary deletion failed.', logged: true });
    }
  });

  // DELETE /api/cloudinary/cleanup — delete a specific asset by publicId; admin-only
  app.delete('/api/cloudinary/cleanup', isAuthenticated, isAdmin, async (req: any, res) => {
    if (!process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Cloudinary not configured.' });
    }
    const { publicId } = req.body;
    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ message: 'publicId is required.' });
    }
    try {
      await cloudinary.uploader.destroy(publicId);
      await db.delete(cloudinaryCleanupLog).where(eq(cloudinaryCleanupLog.publicId, publicId));
      res.json({ success: true, publicId });
    } catch (err: any) {
      const reason = String(err?.message || err);
      await db.insert(cloudinaryCleanupLog).values({ publicId, reason });
      console.error('[Proof] Cloudinary cleanup failed for', publicId, reason);
      res.status(500).json({ message: 'Cloudinary deletion failed.', error: reason });
    }
  });

  // DELETE /api/proofs/:proofId — delete a proof (ownership required)
  app.delete('/api/proofs/:proofId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const proofId = parseInt(req.params.proofId);
      if (isNaN(proofId)) return res.status(400).json({ message: 'Invalid proof ID.' });

      const [existing] = await db.select().from(circleProofs).where(eq(circleProofs.id, proofId)).limit(1);
      if (!existing) return res.status(404).json({ message: 'Proof not found.' });
      if (existing.userId !== userId) return res.status(403).json({ message: 'Not your proof.' });

      if (existing.cloudinaryPublicId && process.env.CLOUDINARY_API_SECRET
          && existing.cloudinaryPublicId.startsWith('will_proofs/')) {
        try {
          await cloudinary.uploader.destroy(existing.cloudinaryPublicId);
        } catch (cloudErr: any) {
          await db.insert(cloudinaryCleanupLog).values({
            publicId: existing.cloudinaryPublicId,
            reason: String(cloudErr?.message || cloudErr),
          });
        }
      }

      await db.delete(circleProofs).where(eq(circleProofs.id, proofId));
      res.json({ success: true });
    } catch (err) {
      console.error('[Proof] Failed to delete proof:', err);
      res.status(500).json({ message: 'Failed to delete proof.' });
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
