import { defineConfig } from "drizzle-kit";

// Environment-aware database URL selection
// Production: Uses DATABASE_URL or DATABASE_URL_PRODUCTION
// Staging: Uses DATABASE_URL_STAGING or falls back to DATABASE_URL
function getDatabaseUrl(): string {
  const appEnv = process.env.APP_ENV?.toLowerCase();
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const isProduction = appEnv === 'production' || nodeEnv === 'production';
  
  if (isProduction) {
    const productionUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;
    if (!productionUrl) {
      throw new Error("DATABASE_URL is required for production. Set DATABASE_URL or DATABASE_URL_PRODUCTION.");
    }
    console.log("Using PRODUCTION database");
    return productionUrl;
  }
  
  // Staging environment
  const stagingUrl = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;
  if (!stagingUrl) {
    throw new Error("DATABASE_URL_STAGING is required for staging. Set DATABASE_URL_STAGING or DATABASE_URL.");
  }
  console.log("Using STAGING database");
  return stagingUrl;
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
