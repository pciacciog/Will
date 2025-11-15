import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// This staging Repl uses ONLY DATABASE_URL_STAGING
const getDatabaseUrl = () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ DATABASE CONNECTION - STAGING ENVIRONMENT                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`🔍 [DB] APP_ENV: ${process.env.APP_ENV || '(not set)'}`);
  console.log(`🔍 [DB] NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
  
  if (!process.env.DATABASE_URL_STAGING) {
    throw new Error(
      "🚨 ERROR: DATABASE_URL_STAGING environment variable is required.\n" +
      "This staging environment uses only DATABASE_URL_STAGING."
    );
  }
  
  try {
    const dbUrl = new URL(process.env.DATABASE_URL_STAGING);
    console.log('🟡 Using STAGING database');
    console.log(`🔍 [DB] Database host: ${dbUrl.host}`);
    console.log('════════════════════════════════════════════════════════════');
  } catch (error) {
    console.log('🟡 Using STAGING database');
    console.log('════════════════════════════════════════════════════════════');
  }
  
  return process.env.DATABASE_URL_STAGING;
};

const connectionString = getDatabaseUrl();
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });