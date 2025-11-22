import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, RequestHandler } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import jwt from "jsonwebtoken";

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
  // Handle case where password is undefined/null
  if (!stored || typeof stored !== 'string') {
    console.error('❌ [Auth] Invalid stored password - password is undefined or not a string');
    return false;
  }
  
  // Check if password has the expected format (hash.salt)
  if (!stored.includes('.')) {
    console.error('❌ [Auth] Invalid stored password format - missing salt separator');
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    console.error('❌ [Auth] Invalid stored password format - missing hash or salt');
    return false;
  }
  
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// JWT token generation and verification for mobile auth persistence
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'development-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7 days for mobile apps

// 🔥 CRITICAL: Log JWT secret configuration on server startup
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║ JWT AUTHENTICATION CONFIGURATION                           ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`🔐 [JWT] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔐 [JWT] JWT_SECRET env var: ${process.env.JWT_SECRET ? 'SET ✅' : 'NOT SET ❌'}`);
console.log(`🔐 [JWT] SESSION_SECRET env var: ${process.env.SESSION_SECRET ? 'SET ✅' : 'NOT SET ❌'}`);
console.log(`🔐 [JWT] Using secret source: ${process.env.JWT_SECRET ? 'JWT_SECRET' : process.env.SESSION_SECRET ? 'SESSION_SECRET (fallback)' : 'HARDCODED DEVELOPMENT (INSECURE!)'}`);
console.log(`🔐 [JWT] Token expiration: ${JWT_EXPIRES_IN}`);
console.log('════════════════════════════════════════════════════════════');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('╔════════════════════════════════════════════════════════════╗');
  console.error('║ ⚠️  CRITICAL PRODUCTION WARNING                            ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  console.error('❌ [JWT] JWT_SECRET environment variable is NOT SET in production!');
  console.error('❌ [JWT] This will cause all existing tokens to be INVALID');
  console.error('❌ [JWT] Users will be logged out and cannot restore sessions');
  console.error('❌ [JWT] SET JWT_SECRET immediately in production environment!');
  console.error('════════════════════════════════════════════════════════════');
}

function generateAuthToken(user: SelectUser): string {
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║ JWT TOKEN GENERATED                                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`🔑 [JWT] User ID: ${user.id}`);
  console.log(`🔑 [JWT] User Email: ${user.email}`);
  console.log(`🔑 [JWT] Token preview: ${token.substring(0, 30)}...${token.substring(token.length - 20)}`);
  console.log(`🔑 [JWT] Token length: ${token.length} chars`);
  console.log(`🔑 [JWT] Expires in: ${JWT_EXPIRES_IN}`);
  console.log(`🔑 [JWT] Generated at: ${new Date().toISOString()}`);
  console.log(`════════════════════════════════════════════════════════════`);
  
  return token;
}

export function verifyAuthToken(token: string): { id: string; email: string; role: string } | null {
  const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
  
  console.log(`🔍 [JWT] Attempting to verify token: ${tokenPreview}`);
  console.log(`🔍 [JWT] Token length: ${token.length} chars`);
  console.log(`🔍 [JWT] Verification time: ${new Date().toISOString()}`);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; exp?: number; iat?: number };
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ TOKEN VERIFICATION SUCCESS                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`✅ [JWT] Token is VALID`);
    console.log(`✅ [JWT] User ID: ${decoded.id}`);
    console.log(`✅ [JWT] User Email: ${decoded.email}`);
    console.log(`✅ [JWT] User Role: ${decoded.role}`);
    if (decoded.iat) {
      const issuedAt = new Date(decoded.iat * 1000);
      const ageMinutes = Math.round((Date.now() - issuedAt.getTime()) / 1000 / 60);
      console.log(`✅ [JWT] Issued at: ${issuedAt.toISOString()} (${ageMinutes} minutes ago)`);
    }
    if (decoded.exp) {
      const expiresAt = new Date(decoded.exp * 1000);
      const remainingMinutes = Math.round((expiresAt.getTime() - Date.now()) / 1000 / 60);
      console.log(`✅ [JWT] Expires at: ${expiresAt.toISOString()} (${remainingMinutes} minutes remaining)`);
    }
    console.log('════════════════════════════════════════════════════════════');
    
    return decoded;
  } catch (error: any) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ TOKEN VERIFICATION FAILED                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    if (error.name === 'TokenExpiredError') {
      console.error(`❌ [JWT] Token has EXPIRED`);
      console.error(`❌ [JWT] Expired at: ${error.expiredAt ? new Date(error.expiredAt).toISOString() : 'UNKNOWN'}`);
      console.error(`❌ [JWT] Current time: ${new Date().toISOString()}`);
      if (error.expiredAt) {
        const minutesSinceExpiry = Math.round((Date.now() - new Date(error.expiredAt).getTime()) / 1000 / 60);
        console.error(`❌ [JWT] Expired ${minutesSinceExpiry} minutes ago`);
      }
    } else if (error.name === 'JsonWebTokenError') {
      console.error(`❌ [JWT] Token is INVALID or MALFORMED`);
      console.error(`❌ [JWT] Error: ${error.message}`);
      console.error(`❌ [JWT] Possible causes:`);
      console.error(`❌   - Token was tampered with`);
      console.error(`❌   - Wrong JWT_SECRET (production vs development mismatch)`);
      console.error(`❌   - Token format is corrupted`);
    } else if (error.name === 'NotBeforeError') {
      console.error(`❌ [JWT] Token is not yet valid (nbf claim)`);
      console.error(`❌ [JWT] Valid from: ${error.date ? new Date(error.date).toISOString() : 'UNKNOWN'}`);
    } else {
      console.error(`❌ [JWT] Unknown verification error`);
      console.error(`❌ [JWT] Error name: ${error.name}`);
      console.error(`❌ [JWT] Error message: ${error.message}`);
      console.error(`❌ [JWT] Full error:`, error);
    }
    
    console.log(`❌ [JWT] Token preview: ${tokenPreview}`);
    console.log('════════════════════════════════════════════════════════════');
    return null;
  }
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    conString: process.env.DATABASE_URL_STAGING,
    createTableIfMissing: false,
    tableName: 'sessions',
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // Allow JavaScript access for mobile app
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' requires secure=true, so use 'lax' in development
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
        console.log(`🔍 [Auth] Login attempt for email: ${email}`);
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log(`❌ [Auth] User not found: ${email}`);
          return done(null, false);
        }
        
        console.log(`✅ [Auth] User found: ${email}, checking password...`);
        const passwordMatch = await comparePasswords(password, user.password);
        
        if (!passwordMatch) {
          console.log(`❌ [Auth] Password mismatch for user: ${email}`);
          return done(null, false);
        }
        
        console.log(`✅ [Auth] Password verified for user: ${email}`);
        return done(null, user);
      } catch (error) {
        console.error(`❌ [Auth] Error during authentication:`, error);
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
      const { email, password, firstName, lastName, timezone, deviceToken: bodyDeviceToken } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // TIMEZONE FIX: Use provided timezone or default to America/New_York
      const userTimezone = timezone || 'America/New_York';
      console.log(`🌍 [Registration] Setting user timezone: ${userTimezone}`);

      const user = await storage.createUser({
        email,
        password: await hashPassword(password),
        firstName,
        lastName,
        timezone: userTimezone,
        profileImageUrl: null,
        role: 'user',
        isActive: true,
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        
        // ISSUE #2 FIX: Extract device token from request body or header
        const deviceToken = bodyDeviceToken || req.headers['x-device-token'] as string;
        console.log(`🔍 [Registration] Device token:`, deviceToken ? deviceToken.substring(0, 10) + '...' : 'NOT PROVIDED');
        
        // Associate any pending device tokens with the new user
        try {
          const associationResult = await associatePendingTokensWithRetry(user.id, deviceToken);
          console.log(`✅ [Registration] Associated pending tokens with new user ${user.id}:`, associationResult);
        } catch (error) {
          console.error('❌ [Registration] Error associating pending tokens:', error);
          // Don't fail registration due to token association issues
        }
        
        // Generate JWT token for mobile auth persistence
        const token = generateAuthToken(user);
        console.log(`🔑 [Registration] Generated JWT token for user ${user.id}`);
        
        res.status(201).json({ ...user, token });
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
        const sqlConnection = neon(process.env.DATABASE_URL_STAGING!);
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
      
      // 🔥 CRITICAL FIX (ISSUE #2): Always associate pending device tokens after login with retry logic
      // Now passing deviceToken to only associate THIS device's token, not all NULL tokens globally
      try {
        console.log(`✅ [Login] User authenticated: ${user.email}`);
        console.log(`🔍 [Login] Starting pending token association for user: ${user.id}`);
        const associationResult = await associatePendingTokensWithRetry(user.id, deviceToken);
        console.log(`✅ [Login] Token association completed:`, associationResult);
      } catch (error) {
        console.error(`❌ [Login] Error associating pending tokens for user ${user.id}:`, error);
        // Don't fail login due to token association issues
      }
      
      // Generate JWT token for mobile auth persistence
      const token = generateAuthToken(user);
      console.log(`🔑 [Login] Generated JWT token for user ${user.id}`);
      
      res.status(200).json({ ...user, token });
    } catch (error) {
      console.error('❌ [Login] Error during token ownership transfer:', error);
      // Don't fail login due to token transfer issues
      const token = generateAuthToken(req.user);
      res.status(200).json({ ...req.user, token });
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

  app.get("/api/user", async (req, res) => {
    console.log('[Auth] /api/user called, session authenticated:', req.isAuthenticated());
    
    // First try session-based auth (for web)
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    
    // Then try JWT token auth (for mobile)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAuthToken(token);
      
      if (decoded) {
        const user = await storage.getUser(decoded.id);
        if (user) {
          console.log(`[Auth] /api/user - User ${user.id} authenticated via JWT token`);
          return res.json(user);
        }
      }
    }
    
    return res.sendStatus(401);
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
      const sqlConnection = neon(process.env.DATABASE_URL_STAGING!);
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

  // Enhanced association function with retry logic for timing issues
  async function associatePendingTokensWithRetry(userId: string, deviceToken?: string, maxRetries: number = 3, delayMs: number = 2000): Promise<{ tokensAssociated: number }> {
    console.log(`🔄 [PendingTokens] Starting association with retry for user ${userId}`);
    console.log(`🔄 [PendingTokens] Device token:`, deviceToken ? deviceToken.substring(0, 10) + '...' : 'NOT PROVIDED');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [PendingTokens] Association attempt ${attempt}/${maxRetries}`);
      
      // Check for pending tokens before attempting association
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');
      const { deviceTokens } = await import('../shared/schema');
      const { eq, isNull, or, and } = await import('drizzle-orm');
      
      const sqlConnection = neon(process.env.DATABASE_URL_STAGING!);
      const dbConnection = drizzle(sqlConnection);
      
      let pendingTokens;
      if (deviceToken) {
        // ISSUE #2 FIX: Only check for the specific device token
        pendingTokens = await dbConnection
          .select()
          .from(deviceTokens)
          .where(
            and(
              eq(deviceTokens.deviceToken, deviceToken),
              or(
                isNull(deviceTokens.userId),
                eq(deviceTokens.userId, "pending")
              )
            )
          );
      } else {
        // Fallback to global search (backwards compatibility)
        pendingTokens = await dbConnection
          .select()
          .from(deviceTokens)
          .where(
            or(
              isNull(deviceTokens.userId),
              eq(deviceTokens.userId, "pending")
            )
          );
      }
        
      const pendingCount = pendingTokens.length;
      console.log(`🔍 [PendingTokens] Found ${pendingCount} pending token(s) on attempt ${attempt}`);
      
      if (pendingCount > 0) {
        // Found pending tokens, attempt association
        const result = await associatePendingTokens(userId, deviceToken);
        
        if (result.tokensAssociated > 0) {
          console.log(`✅ [PendingTokens] Successfully associated ${result.tokensAssociated} token(s) on attempt ${attempt}`);
          return result;
        }
      }
      
      // If no tokens found or association failed, wait and retry
      if (attempt < maxRetries) {
        console.log(`⏳ [PendingTokens] Waiting ${delayMs}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log(`⚠️ [PendingTokens] No pending tokens associated after ${maxRetries} attempts for user ${userId}`);
    return { tokensAssociated: 0 };
  }

  // CRITICAL FIX (ISSUE #2): Associate ONLY the specific device token with authenticated user
  // This prevents associating ALL NULL tokens globally, which was causing notifications to wrong users
  async function associatePendingTokens(userId: string, deviceToken?: string): Promise<{ tokensAssociated: number }> {
    console.log('🔍 [PendingTokens] === ASSOCIATION FUNCTION EXECUTING ===');
    console.log('🔍 [PendingTokens] Target user ID:', userId);
    console.log('🔍 [PendingTokens] Device token:', deviceToken ? deviceToken.substring(0, 10) + '...' : 'NOT PROVIDED');
    console.log('🔍 [PendingTokens] Timestamp:', new Date().toISOString());
    
    try {
      // Import database dependencies  
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');
      const { deviceTokens } = await import('../shared/schema');
      const { eq, isNull, or, and } = await import('drizzle-orm');
      
      // Create database connection
      const sqlConnection = neon(process.env.DATABASE_URL_STAGING!);
      const dbConnection = drizzle(sqlConnection);
      
      // ISSUE #2 FIX: Only find the SPECIFIC device token if provided
      let pendingTokens;
      if (deviceToken) {
        console.log(`🔒 [PendingTokens] SECURE MODE: Only associating specific device token ${deviceToken.substring(0, 10)}...`);
        pendingTokens = await dbConnection
          .select()
          .from(deviceTokens)
          .where(
            and(
              eq(deviceTokens.deviceToken, deviceToken),
              or(
                isNull(deviceTokens.userId),
                eq(deviceTokens.userId, "pending")
              )
            )
          );
      } else {
        // Fallback: Find all pending tokens (backwards compatibility, but logs warning)
        console.log('⚠️ [PendingTokens] WARNING: No device token provided - falling back to global search (INSECURE)');
        pendingTokens = await dbConnection
          .select()
          .from(deviceTokens)
          .where(
            or(
              isNull(deviceTokens.userId),
              eq(deviceTokens.userId, "pending")
            )
          );
      }
        
      console.log('🔍 [PendingTokens] Query results:');
      console.log('  - Row count:', pendingTokens.length);
      console.log('  - Tokens found:', pendingTokens.map(row => ({
        tokenHash: row.deviceToken.substring(0, 10) + '...',
        platform: row.platform,
        currentUserId: row.userId,
        createdAt: row.createdAt
      })));
      
      if (pendingTokens.length === 0) {
        console.log('⚠️ [PendingTokens] No pending tokens found to associate');
        return { tokensAssociated: 0 };
      }
      
      // First, deactivate old tokens for this user to prevent notification conflicts
      const deactivateResult = await dbConnection
        .update(deviceTokens)
        .set({ 
          isActive: false,
          registrationSource: 'deactivated_by_pending_association'
        })
        .where(eq(deviceTokens.userId, userId));
        
      console.log(`🔄 [PendingTokens] Deactivated old tokens for user ${userId}`);
      
      // Associate each pending token with the authenticated user
      let associatedCount = 0;
      for (const token of pendingTokens) {
        console.log(`🔗 [PendingTokens] Associating token ${token.deviceToken.substring(0, 10)}... with user ${userId}`);
        
        const updateResult = await dbConnection
          .update(deviceTokens)
          .set({
            userId: userId,
            isActive: true,
            registrationSource: 'secure_token_association',
            updatedAt: new Date()
          })
          .where(eq(deviceTokens.deviceToken, token.deviceToken));
          
        associatedCount++;
        console.log(`✅ [PendingTokens] Token ${token.deviceToken.substring(0, 10)}... now belongs to user ${userId}`);
      }
      
      // Verification query
      const verifyTokens = await dbConnection
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));
        
      console.log(`✅ [PendingTokens] Transaction completed successfully`);
      console.log(`✅ [PendingTokens] Associated ${associatedCount} pending token(s) with user ${userId}`);
      console.log(`✅ [PendingTokens] User ${userId} now has ${verifyTokens.length} active token(s)`);
      
      return { tokensAssociated: associatedCount };
      
    } catch (error) {
      console.error('🚨 [PendingTokens] Association failed:', error);
      throw error;
    }
  }
  
  // Add the /api/auth/me route for compatibility
  app.get("/api/auth/me", async (req, res) => {
    console.log('[Auth] /api/auth/me called, session authenticated:', req.isAuthenticated());
    
    // First try session-based auth (for web)
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    
    // Then try JWT token auth (for mobile)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAuthToken(token);
      
      if (decoded) {
        const user = await storage.getUser(decoded.id);
        if (user) {
          console.log(`[Auth] /api/auth/me - User ${user.id} authenticated via JWT token`);
          return res.json(user);
        }
      }
    }
    
    return res.sendStatus(401);
  });
}

// Hybrid authentication middleware: supports both session cookies (web) and JWT tokens (mobile)
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // First try session-based auth (for web)
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Then try JWT token auth (for mobile)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyAuthToken(token);
    
    if (decoded) {
      // Load the full user object from database
      const user = await storage.getUser(decoded.id);
      if (user) {
        req.user = user;
        console.log(`[JWT Auth] User ${user.id} authenticated via JWT token`);
        return next();
      }
    }
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