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
  willCommitments,
  deviceTokens,
  users,
  wills,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "./auth";
import { db, pool } from "./db";
import { eq, and, or, isNull, sql } from "drizzle-orm";
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
        const { getDefaultOrigin } = await import('./config/environment');
        // Use APP_URL if explicitly set, otherwise use environment-aware default origin
        const baseUrl = process.env.APP_URL || getDefaultOrigin();
        
        console.log(`[PasswordReset] Using base URL: ${baseUrl}`);
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

  // Circle routes
  app.post('/api/circles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if user has reached maximum circles (3)
      const circleCount = await storage.getUserCircleCount(userId);
      if (circleCount >= 3) {
        return res.status(400).json({ message: "You've reached the maximum of 3 circles. Leave a circle to create another." });
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

      const circleWithMembers = await storage.getCircleWithMembers(circle.id);
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

      // Check if user has reached maximum circles (3)
      const userCircleCount = await storage.getUserCircleCount(userId);
      if (userCircleCount >= 3) {
        return res.status(400).json({ message: "You've reached the maximum of 3 circles. Leave a circle to join another." });
      }

      // Find circle by invite code
      const circle = await storage.getCircleByInviteCode(inviteCode.toUpperCase());
      if (!circle) {
        return res.status(404).json({ message: "No circle found with that code" });
      }

      // Check if circle is full (max 4 members per circle)
      const memberCount = await storage.getCircleMemberCount(circle.id);
      if (memberCount >= 4) {
        return res.status(400).json({ message: "This Circle is full (maximum 4 members)" });
      }

      // Check if user is already in this circle
      const isAlreadyMember = await storage.isUserInCircle(userId, circle.id);
      if (isAlreadyMember) {
        return res.status(400).json({ message: "You're already a member of this circle" });
      }

      // Get existing members BEFORE adding the new user (for notification)
      const existingMembersBefore = await storage.getCircleMembers(circle.id);
      const existingMemberIds = existingMembersBefore.map(m => m.userId);

      // Add user to circle
      await storage.addCircleMember({
        circleId: circle.id,
        userId,
      });

      // NEW: Send circle_member_joined notification to existing members
      try {
        const joiner = await storage.getUser(userId);
        const joinerName = joiner?.firstName || 'Someone';
        
        if (existingMemberIds.length > 0) {
          await pushNotificationService.sendCircleMemberJoinedNotification(joinerName, circle.id, existingMemberIds);
          console.log(`[Join Circle] Sent member joined notification to ${existingMemberIds.length} existing members`);
        }
      } catch (notificationError) {
        console.error("[Join Circle] Failed to send member joined notification:", notificationError);
      }

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

      const circleWithMembers = await storage.getCircleWithMembers(circle.id);
      res.json(circleWithMembers);
    } catch (error) {
      console.error("Error joining circle:", error);
      res.status(500).json({ message: "Failed to join circle" });
    }
  });

  // Get all circles user is a member of (for My Circles lobby)
  app.get('/api/circles/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const circles = await storage.getUserCircles(userId);
      res.json(circles);
    } catch (error) {
      console.error("Error fetching user circles:", error);
      res.status(500).json({ message: "Failed to fetch circles" });
    }
  });

  // Get specific circle by ID (for Circle Hub)
  app.get('/api/circles/:circleId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const circleId = parseInt(req.params.circleId);
      
      if (isNaN(circleId)) {
        return res.status(400).json({ message: "Invalid circle ID" });
      }
      
      // Verify user is a member of this circle
      const isMember = await storage.isUserInCircle(userId, circleId);
      if (!isMember) {
        return res.status(403).json({ message: "You're not a member of this circle" });
      }
      
      const circle = await storage.getCircleWithMembers(circleId);
      if (!circle) {
        return res.status(404).json({ message: "Circle not found" });
      }
      
      res.json(circle);
    } catch (error) {
      console.error("Error fetching circle:", error);
      res.status(500).json({ message: "Failed to fetch circle" });
    }
  });

  app.post('/api/circles/:circleId/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const circleId = parseInt(req.params.circleId);
      
      if (isNaN(circleId)) {
        return res.status(400).json({ message: "Invalid circle ID" });
      }
      
      // Verify user is a member of this circle
      const isMember = await storage.isUserInCircle(userId, circleId);
      if (!isMember) {
        return res.status(404).json({ message: "You are not a member of this circle" });
      }

      // Check if there are active wills in this circle
      const activeWill = await storage.getCircleActiveWill(circleId);
      if (activeWill && (activeWill.status === 'active' || activeWill.status === 'scheduled')) {
        return res.status(400).json({ message: "Cannot leave circle while there is an active or scheduled will" });
      }

      // Remove user from circle
      await storage.removeCircleMember(userId, circleId);

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
      const isPersonalMode = req.body.mode === 'solo' || req.body.mode === 'personal';
      
      // Prepare will data with proper types
      const isIndefinite = req.body.isIndefinite === true;
      const willDataWithDefaults: any = {
        title: req.body.title,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: isIndefinite ? null : (req.body.endDate ? new Date(req.body.endDate) : null),
        createdBy: userId,
        mode: isPersonalMode ? 'personal' : 'circle',
        visibility: req.body.visibility || 'private',
        endRoomScheduledAt: req.body.endRoomScheduledAt ? new Date(req.body.endRoomScheduledAt) : null,
        checkInType: req.body.checkInType || (isIndefinite ? 'daily' : 'one-time'),
        reminderTime: req.body.reminderTime || null,
        checkInTime: req.body.checkInTime || null,
        activeDays: req.body.activeDays || 'every_day',
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
          const commitmentData = {
            willId: will.id,
            userId: userId,
            what: req.body.what || "My personal goal",
            why: req.body.because || "",
          };
          await storage.addWillCommitment(commitmentData);
          console.log(`[Routes] Auto-created commitment for solo Will ${will.id}`);
        } catch (commitError) {
          console.error(`[Routes] Failed to create commitment for solo Will ${will.id}:`, commitError);
        }
        
        // Solo wills stay 'pending' until the scheduler transitions them to 'active' at startDate
        // The scheduler will also send the will_started notification when transitioning
        
        console.log(`Created solo Will ${will.id} for user ${userId}, status: pending, starts: ${req.body.startDate}, midpoint: ${midpointTime ? midpointTime.toISOString() : 'none (indefinite)'}`);
        
        res.json({ ...will, status: 'pending', midpointAt: midpointTime });
      } else {
        // CIRCLE MODE: Multi-circle support - use circleId from request
        
        // Get circle ID from request body
        const circleId = req.body.circleId;
        console.log('=== WILL CREATION DEBUG ===');
        console.log('User ID:', userId);
        console.log('Circle ID from request body:', circleId);
        console.log('Full request body:', JSON.stringify(req.body, null, 2));
        
        if (!circleId) {
          console.log('ERROR: No circleId provided in request');
          return res.status(400).json({ message: "Circle ID is required for circle mode Wills" });
        }
        
        // Verify user is a member of this specific circle
        const isMember = await storage.isUserInCircle(userId, circleId);
        console.log('Is user member of circle', circleId, '?', isMember);
        if (!isMember) {
          return res.status(403).json({ message: "You must be a member of this circle to create a Will" });
        }
        
        // Get circle details
        const circle = await storage.getCircleWithMembers(circleId);
        if (!circle) {
          return res.status(404).json({ message: "Circle not found" });
        }

        // Check if THIS SPECIFIC circle already has an active will
        console.log('Checking for active Will in circleId:', circleId);
        const existingWill = await storage.getCircleActiveWill(circleId);
        console.log('Existing Will found:', existingWill ? `ID=${existingWill.id}, status=${existingWill.status}, circleId=${existingWill.circleId}` : 'NONE');
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

        // Handle circle will type (classic or cumulative)
        const willType = req.body.willType || 'classic';
        willDataWithDefaults.willType = willType;
        
        // For cumulative wills, store the shared commitment
        if (willType === 'cumulative') {
          if (!req.body.sharedWhat) {
            return res.status(400).json({ message: "Cumulative wills require a shared commitment (sharedWhat)" });
          }
          willDataWithDefaults.sharedWhat = req.body.sharedWhat;
        }

        // Set circle ID and validate
        willDataWithDefaults.circleId = circle.id;
        const willData = insertWillSchema.parse(willDataWithDefaults);
        
        // Create will
        const will = await storage.createWill(willData);

        // Calculate and set midpointAt for milestone notification
        const circleStartTime = new Date(req.body.startDate).getTime();
        const circleEndTime = new Date(req.body.endDate).getTime();
        const circleMidpointTime = new Date((circleStartTime + circleEndTime) / 2);
        await db.update(wills).set({ midpointAt: circleMidpointTime }).where(eq(wills.id, will.id));
        console.log(`Created circle Will ${will.id}, midpoint: ${circleMidpointTime.toISOString()}`);

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
            const isSharedWill = willType === 'cumulative';
            await pushNotificationService.sendWillProposedNotification(creatorName, otherMembers, will.id, isSharedWill);
            console.log(`Sent Will proposed notifications to ${otherMembers.length} members (isSharedWill: ${isSharedWill})`);

            for (const memberId of otherMembers) {
              await storage.createUserNotification({
                userId: memberId,
                type: 'will_proposed',
                willId: will.id,
                circleId: circle.id,
                isRead: false,
              });
            }
          } else {
            console.log("No other members to notify");
          }
        } catch (notificationError) {
          console.error("Error sending will proposed notifications:", notificationError);
          console.error("Notification error stack:", (notificationError as Error).stack);
          // Don't fail the will creation if notifications fail
        }

        res.json(will);
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
      
      const commitmentData = insertWillCommitmentSchema.parse({
        ...req.body,
        what: whatValue,
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

      // Auto-clear any "will_proposed" in-app notification for this will
      try {
        await storage.markNotificationsReadByTypeAndWill(userId, 'will_proposed', willId);
      } catch (e) { /* non-critical */ }

      // For solo wills, status is already active - no need to check circle
      if (will.mode === 'solo') {
        // Solo will - commitment added, will is already active
        res.json(commitment);
        return;
      }

      // Circle mode - check if all members have committed
      const circle = await storage.getCircleById(will.circleId!);
      if (!circle) {
        return res.status(404).json({ message: "Circle not found" });
      }

      const memberCount = await storage.getCircleMemberCount(will.circleId!);
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
        .where(eq(wills.parentWillId, willId));
      
      res.json({
        id: will.id,
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
      
      // Create a new will instance for this user
      const newWill = await storage.createWill({
        createdBy: userId,
        mode: 'personal',
        visibility: 'private',
        parentWillId: parentWillId,
        startDate: parentWill.startDate,
        endDate: parentWill.endDate,
        checkInType: parentWill.checkInType || 'one-time',
        checkInTime: parentWill.checkInTime || null,
        activeDays: parentWill.activeDays || 'every_day',
        customDays: parentWill.customDays || null,
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
        checkInType: parentWill.checkInType || 'one-time',
      });
      
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
      const mode = req.query.mode as 'solo' | 'circle' | 'public' | undefined;
      const validModes = ['solo', 'circle', 'public'];
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
      const mode = req.query.mode as 'solo' | 'circle' | 'public';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const enhanced = req.query.enhanced === 'true';
      
      console.log(`[HISTORY] Fetching ${mode} history for user ${userId} (enhanced: ${enhanced})`);
      
      if (!mode || !['solo', 'circle', 'public'].includes(mode)) {
        return res.status(400).json({ message: "Invalid mode. Must be 'solo', 'circle', or 'public'." });
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
      
      // JIT (Just-In-Time) state checks: Update will status immediately when requested
      // This ensures correct state even if scheduler hasn't run (dev restarts, deployment sleep, etc.)
      if (willWithCommitments && status !== willWithCommitments.status) {
        console.log(`[JIT] Transitioning Will ${will.id}: ${willWithCommitments.status} → ${status}`);
        await storage.updateWillStatus(will.id, status);
        
        // Update the object to reflect the new status
        willWithCommitments.status = status;
      }
      
      // NOTE: Do NOT auto-archive here! Frontend getWillStatus() handles showing 'no_will'
      // when local user has acknowledged AND all members have acknowledged.
      // Auto-archiving here would return null before frontend sees hasUserAcknowledged.
      
      // Add user acknowledgment status
      const hasUserAcknowledged = await storage.hasUserAcknowledged(will.id, req.user.id);
      
      // Get per-member acknowledgment data for UI badges
      const acknowledgments = await storage.getWillAcknowledgments(will.id);
      
      res.json({
        ...willWithCommitments,
        status,
        memberCount,
        commitmentCount,
        acknowledgedCount,
        hasUserAcknowledged,
        acknowledgments,
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

      const memberCount = willWithCommitments.circleId ? await storage.getCircleMemberCount(willWithCommitments.circleId) : 1;
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

      // NEW: Send member_review_submitted notification to other members (CIRCLE MODE ONLY)
      try {
        const will = await storage.getWillById(willId);
        
        // Only send notification for circle mode wills (solo mode has no other members)
        if (will && will.circleId && will.mode === 'circle') {
          const reviewer = await storage.getUser(userId);
          const reviewerName = reviewer?.firstName || 'Someone';
          const circleMembers = await storage.getCircleMembers(will.circleId);
          const otherMemberIds = circleMembers
            .filter(m => m.userId !== userId)
            .map(m => m.userId);
          
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
        if (!willWithCommitments.endRoomScheduledAt) {
          // No End Room - move directly to completed
          await storage.updateWillStatus(willId, 'completed');
        } else {
          // End Room exists - check if it already happened
          const now = new Date();
          const endRoomEnd = new Date(new Date(willWithCommitments.endRoomScheduledAt).getTime() + 30 * 60 * 1000);
          if (now >= endRoomEnd) {
            // End Room already happened - move to completed
            await storage.updateWillStatus(willId, 'completed');
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
        await pushNotificationService.sendTeamPushNotification(pusherName, willTitle, memberIds, willId);
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

  app.patch('/api/notifications/circle/:circleId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const circleId = parseInt(req.params.circleId);
      await storage.markNotificationsReadByCircle(userId, circleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking circle notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
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
        await db.update(wills)
          .set({ status: 'will_review' })
          .where(eq(wills.id, willId));
        res.json({ message: "Will moved to review", status: 'will_review' });
      } else {
        await db.update(wills)
          .set({ status: 'terminated' })
          .where(eq(wills.id, willId));
        res.json({ message: "Will terminated successfully", status: 'terminated' });
      }
    } catch (error) {
      console.error("Error terminating will:", error);
      res.status(500).json({ message: "Failed to terminate Will" });
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
        await pushNotificationService.sendWillStartedNotification(willTitle, committedMembers, activeWill.id, false);
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
      
      // Get active will for the circle
      const activeWill = await storage.getCircleActiveWill(userCircle.id);
      
      // Send push notifications for End Room timing
      await pushNotificationService.sendEndRoomNotification(type, endRoomTime, memberIds, activeWill?.id);
      
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
