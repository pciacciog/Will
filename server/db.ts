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
export const db = drizzle({ client: pool, schema });
