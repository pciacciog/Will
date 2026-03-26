import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { getDatabaseUrl, logEnvironmentConfig } from './config/environment';

neonConfig.webSocketConstructor = ws;

// Log environment configuration on startup
logEnvironmentConfig();

// Get the appropriate database URL based on environment
const connectionString = getDatabaseUrl();
export const pool = new Pool({ connectionString });

// Increase max listeners to prevent warnings from the scheduler's frequent DB queries
// The Neon serverless pool adds a "wakeup" listener per connection use; with cron running
// every minute across many queries this exceeds Node's default limit of 10.
pool.setMaxListeners(50);

export const db = drizzle({ client: pool, schema });
