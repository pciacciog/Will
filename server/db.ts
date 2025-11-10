import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Determine which database URL to use based on NODE_ENV
const getDatabaseUrl = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'staging') {
    if (!process.env.DATABASE_URL_STAGING) {
      throw new Error(
        "DATABASE_URL_STAGING must be set for staging environment. Did you forget to add it?"
      );
    }
    console.log('🟡 Using STAGING database');
    return process.env.DATABASE_URL_STAGING;
  }
  
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  console.log(`🟢 Using ${env.toUpperCase()} database`);
  return process.env.DATABASE_URL;
};

const connectionString = getDatabaseUrl();
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });