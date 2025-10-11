import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const SESSION_KEY = 'will_app_session';

class SessionPersistenceService {
  private isNativePlatform = Capacitor.isNativePlatform();

  /**
   * Save current session cookies to persistent storage
   * This runs after successful login
   */
  async saveSession() {
    if (!this.isNativePlatform) {
      console.log('[SessionPersistence] Web platform - relying on browser cookie storage');
      return;
    }

    try {
      // ISSUE #1 FIX: Get session cookie (connect.sid) from document.cookie
      // Note: server/auth.ts sets httpOnly: false specifically for mobile access
      const cookies = document.cookie;
      
      console.log('[SessionPersistence] 🔍 DEBUG: document.cookie =', cookies ? cookies.substring(0, 100) + '...' : 'EMPTY');
      
      if (cookies && cookies.includes('connect.sid')) {
        await Preferences.set({
          key: SESSION_KEY,
          value: cookies
        });
        console.log('[SessionPersistence] ✅ Session cookie saved to persistent storage');
      } else {
        console.error('[SessionPersistence] ❌ No connect.sid cookie found! Cookies:', cookies);
      }
    } catch (error) {
      console.error('[SessionPersistence] Failed to save session:', error);
    }
  }

  /**
   * Restore session cookies from persistent storage
   * This runs on app launch before API calls
   */
  async restoreSession() {
    if (!this.isNativePlatform) {
      console.log('[SessionPersistence] Web platform - no restoration needed');
      return false;
    }

    try {
      const { value } = await Preferences.get({ key: SESSION_KEY });
      
      console.log('[SessionPersistence] 🔍 DEBUG: Stored session =', value ? value.substring(0, 100) + '...' : 'NONE');
      
      if (value) {
        // ISSUE #1 FIX: Restore connect.sid cookie to document.cookie
        // The cookie must include proper attributes for cross-origin mobile app
        const cookiePairs = value.split('; ');
        cookiePairs.forEach(pair => {
          // For mobile apps, we need to set cookies with proper attributes
          if (pair.includes('connect.sid')) {
            // Extract just the cookie value
            const cookieValue = pair;
            document.cookie = `${cookieValue}; path=/; SameSite=None; Secure`;
            console.log('[SessionPersistence] 🔍 DEBUG: Set cookie:', cookieValue.substring(0, 50) + '...');
          }
        });
        
        console.log('[SessionPersistence] ✅ Session cookie restored from persistent storage');
        console.log('[SessionPersistence] 🔍 DEBUG: Current document.cookie =', document.cookie.substring(0, 100));
        return true;
      } else {
        console.log('[SessionPersistence] No saved session found');
        return false;
      }
    } catch (error) {
      console.error('[SessionPersistence] Failed to restore session:', error);
      return false;
    }
  }

  /**
   * Clear saved session
   * This runs on logout
   */
  async clearSession() {
    if (!this.isNativePlatform) {
      console.log('[SessionPersistence] Web platform - clearing browser cookies');
      // Clear all cookies on web
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      return;
    }

    try {
      await Preferences.remove({ key: SESSION_KEY });
      
      // Also clear document.cookie
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      console.log('[SessionPersistence] ✅ Session cleared from persistent storage');
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear session:', error);
    }
  }

  /**
   * Check if we have a saved session
   */
  async hasSession(): Promise<boolean> {
    if (!this.isNativePlatform) {
      return document.cookie.includes('connect.sid');
    }

    try {
      const { value } = await Preferences.get({ key: SESSION_KEY });
      return !!value;
    } catch {
      return false;
    }
  }
}

export const sessionPersistence = new SessionPersistenceService();
