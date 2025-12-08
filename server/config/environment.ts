/**
 * Environment Configuration
 * 
 * This module detects whether the app is running in staging or production
 * and provides the correct configuration values for each environment.
 * 
 * To use production mode, set APP_ENV=production in your environment variables.
 */

export type Environment = 'staging' | 'production' | 'development';

/**
 * Detect the current environment based on APP_ENV or NODE_ENV
 */
export function getEnvironment(): Environment {
  const appEnv = process.env.APP_ENV?.toLowerCase();
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  
  if (appEnv === 'production' || nodeEnv === 'production') {
    return 'production';
  }
  
  if (appEnv === 'staging') {
    return 'staging';
  }
  
  // In Replit development environment, use 'development' to use the main DATABASE_URL
  if (nodeEnv === 'development') {
    return 'development';
  }
  
  return 'staging'; // Default to staging for safety
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

/**
 * Get the database URL for the current environment
 * 
 * Production: Uses DATABASE_URL (or DATABASE_URL_PRODUCTION)
 * Development: Uses DATABASE_URL (Replit's built-in database)
 * Staging: Uses DATABASE_URL_STAGING
 */
export function getDatabaseUrl(): string {
  const env = getEnvironment();
  
  if (env === 'production' || env === 'development') {
    // Production and Development both use DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;
    if (!dbUrl) {
      throw new Error(
        `🚨 ${env.toUpperCase()} ERROR: DATABASE_URL environment variable is required.\n` +
        "Set DATABASE_URL for this environment."
      );
    }
    return dbUrl;
  }
  
  // Staging: use DATABASE_URL_STAGING or fallback to DATABASE_URL
  const stagingUrl = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;
  if (!stagingUrl) {
    throw new Error(
      "🚨 STAGING ERROR: DATABASE_URL_STAGING environment variable is required.\n" +
      "Set DATABASE_URL_STAGING for staging environment."
    );
  }
  return stagingUrl;
}

/**
 * Get allowed CORS origins for the current environment
 */
export function getAllowedOrigins(): string[] {
  const env = getEnvironment();
  
  // Common origins for both environments
  const commonOrigins = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:5000',
    'http://localhost:5173',
  ];
  
  if (env === 'production') {
    // Production origins - add your production domain here
    const productionDomain = process.env.PRODUCTION_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
    const origins = [...commonOrigins];
    
    if (productionDomain) {
      origins.push(`https://${productionDomain}`);
    }
    
    // Add any custom production origins from env
    if (process.env.ALLOWED_ORIGINS) {
      origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }
    
    return origins;
  }
  
  // Staging origins
  return [
    ...commonOrigins,
    'https://will-staging-porfirioaciacci.replit.app',
  ];
}

/**
 * Get the default origin for headers (used when origin is missing)
 */
export function getDefaultOrigin(): string {
  const env = getEnvironment();
  
  if (env === 'production') {
    const productionDomain = process.env.PRODUCTION_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
    if (productionDomain) {
      return `https://${productionDomain}`;
    }
    // Fallback - should be configured properly in production
    return 'https://localhost';
  }
  
  return 'https://will-staging-porfirioaciacci.replit.app';
}

/**
 * Get the backend host for the current environment
 */
export function getBackendHost(): string {
  const env = getEnvironment();
  
  if (env === 'production') {
    return process.env.PRODUCTION_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'localhost';
  }
  
  return 'will-staging-porfirioaciacci.replit.app';
}

/**
 * Log environment configuration on startup
 */
export function logEnvironmentConfig(): void {
  const env = getEnvironment();
  const dbUrl = getDatabaseUrl();
  const dbHost = new URL(dbUrl).host;
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log(`║ DATABASE CONNECTION - ${env.toUpperCase()} ENVIRONMENT                  ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`🔍 [DB] APP_ENV: ${process.env.APP_ENV || '(not set)'}`);
  console.log(`🔍 [DB] NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
  console.log(`${env === 'production' ? '🟢' : '🟡'} Using ${env.toUpperCase()} database`);
  console.log(`🔍 [DB] Database host: ${dbHost}`);
  console.log('════════════════════════════════════════════════════════════');
}
