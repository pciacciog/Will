import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const AUTH_TOKEN_KEY = 'auth_token';

class SessionPersistenceService {
  private isNativePlatform = Capacitor.isNativePlatform();
  private authToken: string | null = null;

  /**
   * Save JWT auth token to persistent storage
   * This runs after successful login
   */
  async saveToken(token: string) {
    this.authToken = token;
    
    if (!this.isNativePlatform) {
      console.log('[SessionPersistence] Web platform - token saved to memory only');
      return;
    }

    try {
      await Preferences.set({
        key: AUTH_TOKEN_KEY,
        value: token
      });
      console.log('[SessionPersistence] ✅ JWT token saved to persistent storage');
    } catch (error) {
      console.error('[SessionPersistence] Failed to save token:', error);
    }
  }

  /**
   * Get current auth token (from memory or persistent storage)
   */
  async getToken(): Promise<string | null> {
    // Return from memory if available
    if (this.authToken) {
      return this.authToken;
    }

    // For mobile, try to restore from persistent storage
    if (this.isNativePlatform) {
      try {
        const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
        if (value) {
          this.authToken = value;
          console.log('[SessionPersistence] ✅ JWT token restored from persistent storage');
          return value;
        }
      } catch (error) {
        console.error('[SessionPersistence] Failed to restore token:', error);
      }
    }

    return null;
  }

  /**
   * Restore auth token from persistent storage
   * This runs on app launch before API calls
   */
  async restoreSession(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Clear saved auth token
   * This runs on logout
   */
  async clearSession() {
    this.authToken = null;
    
    if (!this.isNativePlatform) {
      console.log('[SessionPersistence] Web platform - token cleared from memory');
      return;
    }

    try {
      await Preferences.remove({ key: AUTH_TOKEN_KEY });
      console.log('[SessionPersistence] ✅ Token cleared from persistent storage');
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear token:', error);
    }
  }
}

export const sessionPersistence = new SessionPersistenceService();
