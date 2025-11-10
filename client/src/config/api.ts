/**
 * API Configuration
 * 
 * This file determines the correct API base URL based on the environment:
 * - Staging iOS app (bundle ID: com.porfirio.will.staging) → STAGING backend
 * - Production iOS app (bundle ID: com.porfirio.will) → PRODUCTION backend
 * - Web app (browser): Uses relative URLs (same origin) or LOCAL for dev
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const PRODUCTION_API = 'https://will-1-porfirioaciacci.replit.app';
const STAGING_API    = 'https://will-staging-porfirioaciacci.replit.app'; // TODO: Update after deploying staging Repl
const LOCAL_API      = 'http://localhost:5000'; // For web dev testing

let cachedApiUrl: string | null = null;
let initPromise: Promise<string> | null = null;

/**
 * Detect environment and return appropriate API URL
 * 
 * Detection strategy:
 * 1. Check build-time env var (VITE_APP_ENV)
 * 2. Check native app bundle identifier (App.getInfo)
 * 3. Fallback to platform detection
 */
async function detectEnvAndUrl(): Promise<string> {
  // Build-time override: VITE_APP_ENV=staging|production
  const buildEnv = import.meta.env.VITE_APP_ENV;
  if (buildEnv === 'staging') {
    console.log('🔧 [API Config] Build-time STAGING mode detected');
    return STAGING_API;
  }
  if (buildEnv === 'production') {
    console.log('🔧 [API Config] Build-time PRODUCTION mode detected');
    return PRODUCTION_API;
  }

  // Native runtime detection via bundle identifier (Capacitor App)
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      console.log('📱 [API Config] Native app detected:', {
        bundleId: info.id,
        version: info.version,
        build: info.build
      });
      
      if (info.id === 'com.porfirio.will.staging') {
        console.log('✅ [API Config] STAGING app detected → Using STAGING backend');
        return STAGING_API;
      }
      
      console.log('✅ [API Config] PRODUCTION app detected → Using PRODUCTION backend');
      return PRODUCTION_API;
    } catch (error) {
      console.error('❌ [API Config] Failed to get app info:', error);
      return PRODUCTION_API;
    }
  }

  // Web fallback: Use LOCAL for dev, or relative URLs
  console.log('🌐 [API Config] Web platform detected');
  
  // Check if running on localhost (dev environment)
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      console.log('💻 [API Config] Localhost detected → Using LOCAL_API');
      return LOCAL_API;
    }
  }
  
  // Running on deployed web (Replit webview, etc.) - use relative URLs
  console.log('🌐 [API Config] Using relative URLs (same origin)');
  return '';
}

/**
 * Get the API base URL (async, cached)
 * Call this during app initialization to warm the cache
 */
export async function getApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;
  
  if (!initPromise) {
    initPromise = detectEnvAndUrl().then((url) => {
      cachedApiUrl = url;
      console.log('🎯 [API Config] Final API URL:', url || '(relative URLs)');
      return url;
    });
  }
  
  return initPromise;
}

/**
 * Get the API base URL synchronously
 * Returns cached value if available, otherwise returns PRODUCTION_API
 * 
 * ⚠️ Call getApiUrl() during app initialization to ensure cache is populated
 */
export function getApiUrlSync(): string {
  return cachedApiUrl ?? PRODUCTION_API;
}

/**
 * Construct a full API URL from a path
 * 
 * @param path - API path starting with / (e.g., '/api/user')
 * @returns Full URL to the API endpoint
 * 
 * Examples:
 * - Web (relative): getApiPath('/api/user') → '/api/user'
 * - iOS staging: getApiPath('/api/user') → 'https://will-staging-porfirioaciacci.replit.app/api/user'
 * - iOS production: getApiPath('/api/user') → 'https://will-1-porfirioaciacci.replit.app/api/user'
 */
export function getApiPath(path: string): string {
  const baseUrl = getApiUrlSync();
  
  // If baseUrl is empty (web with relative URLs), just return the path
  if (!baseUrl) {
    return path;
  }
  
  // For native apps or localhost, combine base URL + path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Legacy compatibility - maintains the old function name
 * @deprecated Use getApiPath instead for clarity
 */
export function getApiBaseUrl(): string {
  return getApiUrlSync();
}
