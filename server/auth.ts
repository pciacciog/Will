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

      req.login(user, (err) => {
        if (err) return next(err);
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
      
      // 🔥 CRITICAL: Always transfer device token ownership on login
      const deviceToken = req.body.deviceToken || req.headers['x-device-token'];
      
      if (deviceToken) {
        console.log(`🔄 [Login] Transferring token ownership to user ${user.id}`);
        console.log(`📱 Token: ${deviceToken.substring(0, 8)}...`);
        
        // Import database dependencies
        const { db } = await import('./storage');
        const { deviceTokens } = await import('../shared/schema');
        const { sql } = await import('drizzle-orm');
        
        // Always transfer token ownership, regardless of current state
        await db
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