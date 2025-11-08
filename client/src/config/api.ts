/**
 * API Configuration
 * 
 * This file determines the correct API base URL based on the environment:
 * - Web app (browser): Uses relative URLs (same origin)
 * - Native app (iOS/Android): Uses absolute URL to backend server
 */

import { Capacitor } from '@capacitor/core';

/**
 * Backend API server URL
 * UPDATE THIS if you change your backend deployment URL
 */
const BACKEND_SERVER_URL = 'https://willbeta.replit.app';

/**
 * Get the base URL for API requests
 * 
 * @returns The base URL to prepend to API paths
 * 
 * Examples:
 * - Web app: '' (empty string, uses relative URLs)
 * - iOS app: 'https://willbeta.replit.app'
 * - Android app: 'https://willbeta.replit.app'
 */
export function getApiBaseUrl(): string {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  
  console.log('🌐 [API Config] Platform detection:', {
    isNative,
    platform,
    currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
    backendUrl: BACKEND_SERVER_URL,
  });
  
  // If running in a native Capacitor app (iOS/Android with bundled content)
  if (isNative) {
    console.log('📱 [API Config] Using absolute URL for native app:', BACKEND_SERVER_URL);
    return BACKEND_SERVER_URL;
  }
  
  // If running in a web browser (served from same domain as API)
  // Use relative URLs (empty string means "/api/..." goes to current origin)
  console.log('🌐 [API Config] Using relative URLs for web browser (same origin)');
  return '';
}

/**
 * Construct a full API URL from a path
 * 
 * @param path - API path starting with / (e.g., '/api/user')
 * @returns Full URL to the API endpoint
 * 
 * Examples:
 * - Web: getApiUrl('/api/user') → '/api/user' (relative)
 * - iOS: getApiUrl('/api/user') → 'https://willbeta.replit.app/api/user' (absolute)
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // If baseUrl is empty (web), just return the path
  if (!baseUrl) {
    return path;
  }
  
  // For native apps, combine base URL + path
  // Ensure no double slashes
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
