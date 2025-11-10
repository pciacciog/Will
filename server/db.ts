import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Determine which database URL to use based on APP_ENV or NODE_ENV
const getDatabaseUrl = () => {
  // Prefer APP_ENV over NODE_ENV for explicit environment control
  const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ DATABASE CONNECTION SELECTION                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`🔍 [DB] APP_ENV: ${process.env.APP_ENV || '(not set)'}`);
  console.log(`🔍 [DB] NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
  console.log(`🔍 [DB] Resolved environment: ${env}`);
  
  // STAGING environment: enforce strict isolation
  if (env === 'staging') {
    if (!process.env.DATABASE_URL_STAGING) {
      throw new Error(
        "🚨 SAFETY HALT: Environment is 'staging' but DATABASE_URL_STAGING is not set! " +
        "Set DATABASE_URL_STAGING secret to point to your staging database."
      );
    }
    
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "🚨 SAFETY HALT: DATABASE_URL (production) is not set. " +
        "Both DATABASE_URL and DATABASE_URL_STAGING must exist for safety checks."
      );
    }
    
    // Safety guard: ensure staging and production databases are DIFFERENT
    if (process.env.DATABASE_URL_STAGING === process.env.DATABASE_URL) {
      throw new Error(
        "🚨 SAFETY HALT: DATABASE_URL_STAGING is identical to DATABASE_URL! " +
        "Staging must use a separate database to prevent production data access."
      );
    }
    
    // Extract and compare database hosts to ensure they're different
    try {
      const prodUrl = new URL(process.env.DATABASE_URL);
      const stagingUrl = new URL(process.env.DATABASE_URL_STAGING);
      
      console.log(`🔍 [DB] Production host: ${prodUrl.host}`);
      console.log(`🔍 [DB] Staging host: ${stagingUrl.host}`);
      
      if (prodUrl.host === stagingUrl.host && prodUrl.pathname === stagingUrl.pathname) {
        throw new Error(
          "🚨 SAFETY HALT: DATABASE_URL_STAGING points to same host AND database as production! " +
          `Host: ${prodUrl.host}, Path: ${prodUrl.pathname}. ` +
          "Staging must use a completely separate database."
        );
      }
      
      console.log('🟡 Using STAGING database');
      console.log(`✅ [DB] Staging database is isolated from production`);
      console.log('════════════════════════════════════════════════════════════');
      return process.env.DATABASE_URL_STAGING;
      
    } catch (error: any) {
      if (error.message.includes('SAFETY HALT')) {
        throw error;
      }
      throw new Error(
        `🚨 Failed to parse database URLs for safety check: ${error.message}`
      );
    }
  }
  
  // PRODUCTION or DEVELOPMENT environment
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }
  
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log(`🟢 Using ${env.toUpperCase()} database`);
    console.log(`🔍 [DB] Database host: ${dbUrl.host}`);
    console.log('════════════════════════════════════════════════════════════');
  } catch (error) {
    console.log(`🟢 Using ${env.toUpperCase()} database`);
    console.log('════════════════════════════════════════════════════════════');
  }
  
  return process.env.DATABASE_URL;
};

const connectionString = getDatabaseUrl();
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });