import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, RequestHandler } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    tableName: 'sessions',
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies for production HTTPS
      httpOnly: false, // Allow JavaScript access for mobile app
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'none', // Required for cross-origin requests from mobile app
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      console.log('[Auth] Deserializing user:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('[Auth] User not found during deserialization');
        return done(null, false);
      }
      console.log('[Auth] User deserialized successfully:', user.email);
      done(null, user);
    } catch (error) {
      console.error("[Auth] Error deserializing user:", error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser({
        email,
        password: await hashPassword(password),
        firstName,
        lastName,
        profileImageUrl: null,
        role: 'user',
        isActive: true,
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Associate any pending device tokens with the new user
        try {
          await associatePendingTokens(user.id);
          console.log(`✅ [Registration] Associated pending tokens with new user ${user.id}`);
        } catch (error) {
          console.error('❌ [Registration] Error associating pending tokens:', error);
          // Don't fail registration due to token association issues
        }
        
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), async (req: any, res) => {
    try {
      const user = req.user;
      // Log request info without password for security
      const safeBody = { ...req.body };
      delete safeBody.password;
      console.log(`🔍 [Login] Request body (safe):`, JSON.stringify(safeBody, null, 2));
      console.log(`🔍 [Login] Request headers:`, JSON.stringify(req.headers, null, 2));
      
      // 🔥 CRITICAL: Always transfer device token ownership on login
      const deviceToken = req.body.deviceToken || req.headers['x-device-token'];
      console.log(`🔍 [Login] Looking for device token...`);
      console.log(`🔍 [Login] Body token: ${req.body.deviceToken ? req.body.deviceToken.substring(0, 8) + '...' : 'NONE'}`);
      console.log(`🔍 [Login] Header token: ${req.headers['x-device-token'] ? req.headers['x-device-token'].substring(0, 8) + '...' : 'NONE'}`);
      
      if (deviceToken) {
        console.log(`🔄 [Login] Transferring token ownership to user ${user.id}`);
        console.log(`📱 Token: ${deviceToken.substring(0, 8)}...`);
        
        // Import database dependencies  
        const { neon } = await import('@neondatabase/serverless');
        const { drizzle } = await import('drizzle-orm/neon-http');
        const { deviceTokens } = await import('../shared/schema');
        
        // Create database connection
        const sqlConnection = neon(process.env.DATABASE_URL!);
        const dbConnection = drizzle(sqlConnection);
        
        // Always transfer token ownership, regardless of current state
        await dbConnection
          .insert(deviceTokens)
          .values({
            deviceToken: deviceToken,
            userId: user.id,
            platform: 'ios',
            registrationSource: 'login_transfer'
          })
          .onConflictDoUpdate({
            target: deviceTokens.deviceToken,
            set: {
              userId: user.id,
              registrationSource: 'login_transfer',
              updatedAt: new Date()
            }
          });
        
        console.log(`✅ [Login] Token ${deviceToken.substring(0, 8)}... now owned by user ${user.id}`);
      } else {
        console.log(`ℹ️ [Login] No device token in request - will check for pending tokens`);
      }
      
      // 🔥 CRITICAL: Always associate any pending device tokens after login
      try {
        console.log(`🔍 [Login] Checking for pending device tokens to associate with user ${user.id}`);
        await associatePendingTokens(user.id);
        console.log(`✅ [Login] Pending token association completed for user ${user.id}`);
      } catch (error) {
        console.error(`❌ [Login] Error associating pending tokens for user ${user.id}:`, error);
        // Don't fail login due to token association issues
      }
      
      res.status(200).json(user);
    } catch (error) {
      console.error('❌ [Login] Error during token ownership transfer:', error);
      // Don't fail login due to token transfer issues
      res.status(200).json(req.user);
    }
  });

  // Handle both GET and POST for logout
  const logoutHandler = (req: any, res: any, next: any) => {
    req.logout((err: any) => {
      if (err) return next(err);
      // For browser requests, redirect to home page
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        res.redirect('/');
      } else {
        // For API requests, return status
        res.sendStatus(200);
      }
    });
  };
  
  app.post("/api/logout", logoutHandler);
  app.get("/api/logout", logoutHandler);

  app.get("/api/user", (req, res) => {
    console.log('[Auth] /api/user called, authenticated:', req.isAuthenticated());
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // SECURE: Device-specific token association for logged-in users
  // Only associates tokens that match the current user's device, preventing token theft
  async function associateUserDeviceToken(userId: string, deviceToken?: string): Promise<void> {
    if (!deviceToken) {
      console.log(`ℹ️ [TokenAssociation] No device token provided for user ${userId}`);
      return;
    }
    
    try {
      // Import database dependencies  
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');
      const { deviceTokens } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Create database connection
      const sqlConnection = neon(process.env.DATABASE_URL!);
      const dbConnection = drizzle(sqlConnection);
      
      console.log(`🔗 [TokenAssociation] Associating specific token ${deviceToken.substring(0, 8)}... with user ${userId}`);
      
      // Only associate the SPECIFIC token provided, not all pending tokens
      await dbConnection
        .insert(deviceTokens)
        .values({
          deviceToken: deviceToken,
          userId: userId,
          platform: 'ios',
          registrationSource: 'post_login_association'
        })
        .onConflictDoUpdate({
          target: deviceTokens.deviceToken,
          set: {
            userId: userId,
            registrationSource: 'post_login_association',
            updatedAt: new Date()
          }
        });
      
      console.log(`✅ [TokenAssociation] Successfully associated token ${deviceToken.substring(0, 8)}... with user ${userId}`);
    } catch (error) {
      console.error(`❌ [TokenAssociation] Error associating token with user ${userId}:`, error);
    }
  }

  // CRITICAL: Associate ALL pending device tokens with authenticated user
  async function associatePendingTokens(userId: string): Promise<void> {
    try {
      console.log(`🔍 [PendingTokens] Looking for pending device tokens to associate with user ${userId}`);
      
      // Import database dependencies  
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');
      const { deviceTokens } = await import('../shared/schema');
      const { eq, isNull, or } = await import('drizzle-orm');
      
      // Create database connection
      const sqlConnection = neon(process.env.DATABASE_URL!);
      const dbConnection = drizzle(sqlConnection);
      
      // Find all pending tokens (userId is null OR userId is "pending") 
      const pendingTokens = await dbConnection
        .select()
        .from(deviceTokens)
        .where(
          or(
            isNull(deviceTokens.userId),
            eq(deviceTokens.userId, "pending")
          )
        );
        
      console.log(`🔍 [PendingTokens] Found ${pendingTokens.length} pending tokens to associate`);
      
      if (pendingTokens.length === 0) {
        console.log(`ℹ️ [PendingTokens] No pending tokens found for user ${userId}`);
        return;
      }
      
      // First, deactivate old tokens for this user to prevent notification conflicts
      const oldTokenCount = await dbConnection
        .update(deviceTokens)
        .set({ 
          isActive: false,
          registrationSource: 'deactivated_by_pending_association'
        })
        .where(eq(deviceTokens.userId, userId));
        
      console.log(`🔄 [PendingTokens] Deactivated ${oldTokenCount} old tokens for user ${userId}`);
      
      // Associate each pending token with the authenticated user
      let associatedCount = 0;
      for (const token of pendingTokens) {
        console.log(`🔗 [PendingTokens] Associating token ${token.deviceToken.substring(0, 8)}... with user ${userId}`);
        
        await dbConnection
          .update(deviceTokens)
          .set({
            userId: userId,
            isActive: true,
            registrationSource: 'pending_token_association',
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.deviceToken, token.deviceToken));
          
        associatedCount++;
      }
      
      console.log(`✅ [PendingTokens] Successfully associated ${associatedCount} pending tokens with user ${userId}`);
      
      // Verify the association worked
      const verifyTokens = await dbConnection
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));
        
      console.log(`✅ [PendingTokens] Verification: User ${userId} now has ${verifyTokens.length} active tokens`);
      
    } catch (error) {
      console.error(`❌ [PendingTokens] Error associating pending tokens with user ${userId}:`, error);
      throw error; // Re-throw to ensure calling code handles the error
    }
  }
  
  // Add the /api/auth/me route for compatibility
  app.get("/api/auth/me", (req, res) => {
    console.log('[Auth] /api/auth/me called, authenticated:', req.isAuthenticated());
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware
export const isAdmin: RequestHandler = (req: any, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
};

// Export password utility functions
export { hashPassword, comparePasswords };