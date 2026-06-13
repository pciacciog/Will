import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getApiPath } from '@/config/api';

const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_TIMESTAMP_KEY = 'auth_token_timestamp';

// Synchronous localStorage key — no bridge call needed
const LS_TOKEN_KEY = 'will_auth_token';

class SessionPersistenceService {
  private isNativePlatform = Capacitor.isNativePlatform();
  private authToken: string | null = null;
  
  constructor() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ SessionPersistence Service Initialized                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔍 [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    console.log(`🔍 [SessionPersistence] isNativePlatform: ${this.isNativePlatform}`);
    console.log(`🔍 [SessionPersistence] Timestamp: ${new Date().toISOString()}`);
    console.log(`🔍 [SessionPersistence] User Agent: ${navigator.userAgent}`);

    // Immediately seed memory from localStorage (synchronous — no bridge call)
    // This ensures getToken() never needs to call Preferences.get() in the hot path
    try {
      const lsToken = localStorage.getItem(LS_TOKEN_KEY);
      if (lsToken) {
        this.authToken = lsToken;
        console.log('✅ [SessionPersistence] Token pre-loaded from localStorage (synchronous)');
      } else {
        console.log('⚠️ [SessionPersistence] No token in localStorage yet');
      }
    } catch (e) {
      console.warn('⚠️ [SessionPersistence] localStorage unavailable:', e);
    }
    console.log('════════════════════════════════════════════════════════════');
  }

  /**
   * Save JWT auth token to persistent storage
   */
  async saveToken(token: string) {
    const timestamp = new Date().toISOString();
    const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ SAVING TOKEN                                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔐 [SessionPersistence] Token preview: ${tokenPreview}`);
    console.log(`🔐 [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    console.log(`🔐 [SessionPersistence] Timestamp: ${timestamp}`);
    
    // 1. Memory cache (fastest)
    this.authToken = token;

    // 2. localStorage (synchronous, survives page reloads, no bridge call)
    try {
      localStorage.setItem(LS_TOKEN_KEY, token);
      console.log('✅ [SessionPersistence] Token saved to localStorage (sync)');
    } catch (e) {
      console.warn('⚠️ [SessionPersistence] localStorage write failed:', e);
    }

    if (!this.isNativePlatform) {
      console.log('⚠️ [SessionPersistence] WEB PLATFORM - Saved to memory + localStorage only');
      console.log('════════════════════════════════════════════════════════════');
      return;
    }

    // 3. Capacitor Preferences (async bridge call — persists across full app restarts)
    try {
      await Preferences.set({ key: AUTH_TOKEN_KEY, value: token });
      await Preferences.set({ key: TOKEN_TIMESTAMP_KEY, value: timestamp });
      
      const verification = await Preferences.get({ key: AUTH_TOKEN_KEY });
      if (verification.value === token) {
        console.log('✅ [SessionPersistence] Token SUCCESSFULLY saved to Capacitor Preferences');
      } else {
        console.error('❌ [SessionPersistence] CRITICAL: Preferences verification FAILED');
      }
      console.log('════════════════════════════════════════════════════════════');
    } catch (error) {
      console.error('❌ [SessionPersistence] Preferences save error:', error);
      console.log('════════════════════════════════════════════════════════════');
    }
  }

  /**
   * Initialize token from persistent storage BEFORE any API requests are made.
   * Must be awaited at app startup on iOS — gates the entire Router from mounting.
   * On web: no-op (localStorage already read synchronously in the constructor).
   * On iOS: reads from Capacitor Preferences (async bridge) and populates memory + localStorage,
   * so every subsequent getToken() call is a synchronous memory hit.
   */
  async initialize(): Promise<void> {
    // Already have token in memory (set in constructor from localStorage, or from a prior call)
    if (this.authToken) {
      console.log('✅ [SessionPersistence] initialize() — token already in memory, no bridge needed');
      return;
    }

    // Web: localStorage is synchronous and was already checked in the constructor
    if (!this.isNativePlatform) {
      console.log('✅ [SessionPersistence] initialize() — web platform, localStorage already checked');
      return;
    }

    // iOS: read Capacitor Preferences (async bridge call)
    console.log('🔍 [SessionPersistence] initialize() — awaiting Capacitor Preferences bridge...');
    try {
      const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
      if (value) {
        this.authToken = value;
        // Back-fill localStorage so every future getToken() skips the bridge entirely
        try { localStorage.setItem(LS_TOKEN_KEY, value); } catch {}
        console.log('✅ [SessionPersistence] initialize() — token loaded from Capacitor Preferences');
      } else {
        console.log('⚠️ [SessionPersistence] initialize() — no token in Preferences (user not logged in)');
      }
    } catch (err) {
      console.error('❌ [SessionPersistence] initialize() — Preferences read error:', err);
    }
  }

  /**
   * Get current auth token.
   * Priority: memory → localStorage (sync, no bridge) → Capacitor Preferences (async)
   * After initialize() has run, this is always a synchronous memory hit.
   */
  async getToken(): Promise<string | null> {
    // 1. Memory cache — fastest, set on login or previous getToken call
    if (this.authToken) {
      return this.authToken;
    }

    // 2. localStorage — synchronous, no bridge call, available immediately in WKWebView
    try {
      const lsToken = localStorage.getItem(LS_TOKEN_KEY);
      if (lsToken) {
        this.authToken = lsToken;
        console.log('✅ [SessionPersistence] Token restored from localStorage (sync)');
        return lsToken;
      }
    } catch (e) {
      console.warn('⚠️ [SessionPersistence] localStorage read failed:', e);
    }

    // 3. Capacitor Preferences — async bridge call, only reached on first cold start
    if (this.isNativePlatform) {
      console.log('🔍 [SessionPersistence] Checking Capacitor Preferences (cold start)...');
      try {
        const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
        const { value: timestamp } = await Preferences.get({ key: TOKEN_TIMESTAMP_KEY });
        
        if (value) {
          this.authToken = value;
          // Back-fill localStorage so future calls skip the bridge
          try {
            localStorage.setItem(LS_TOKEN_KEY, value);
          } catch (e) { /* ignore */ }

          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║ TOKEN RESTORED FROM PREFERENCES                            ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log(`✅ [SessionPersistence] Token found in Capacitor Preferences`);
          console.log(`✅ [SessionPersistence] Originally saved at: ${timestamp || 'UNKNOWN'}`);
          console.log('════════════════════════════════════════════════════════════');
          return value;
        } else {
          console.log('⚠️ [SessionPersistence] No token in Capacitor Preferences');
        }
      } catch (error) {
        console.error('❌ [SessionPersistence] Preferences read error:', error);
      }
    }

    console.log('❌ [SessionPersistence] No token found — user needs to log in');
    return null;
  }

  /**
   * Restore session on app launch — validate token with server
   */
  async restoreSession(): Promise<boolean> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ RESTORING SESSION ON APP LAUNCH                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔄 [SessionPersistence] App launch time: ${new Date().toISOString()}`);
    
    const token = await this.getToken();
    
    if (!token) {
      console.log('❌ [SessionPersistence] No token found — session NOT restored');
      console.log('════════════════════════════════════════════════════════════');
      return false;
    }
    
    console.log('🔐 [SessionPersistence] Token found — validating with server...');
    try {
      const fetchOpts: RequestInit = {
        headers: { 
          "X-Requested-With": "XMLHttpRequest",
          Authorization: `Bearer ${token}` 
        },
      };
      if (!this.isNativePlatform) {
        fetchOpts.credentials = 'include';
      }
      const response = await fetch(getApiPath('/api/user'), fetchOpts);
      
      if (response.ok) {
        const user = await response.json();
        console.log(`✅ [SessionPersistence] Token VALID — User ${user.id} authenticated`);
        return true;
      } else if (response.status === 401) {
        console.log('⚠️ [SessionPersistence] Token rejected (401) — attempting refresh...');
        const refreshed = await this.attemptTokenRefresh();
        if (refreshed) {
          console.log('✅ [SessionPersistence] Session restored via token refresh');
          return true;
        }
        console.log('❌ [SessionPersistence] Refresh failed — clearing session');
        await this.clearSession();
        return false;
      } else {
        console.error(`❌ [SessionPersistence] Server returned ${response.status}`);
        await this.clearSession();
        return false;
      }
    } catch (error) {
      console.error('❌ [SessionPersistence] Network error during validation:', error);
      // Assume token is valid if network is unavailable
      return true;
    }
  }

  async attemptTokenRefresh(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    try {
      console.log('🔄 [SessionPersistence] Attempting token refresh...');
      const response = await fetch(getApiPath('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Authorization: `Bearer ${token}`
        },
        ...(this.isNativePlatform ? {} : { credentials: 'include' as RequestCredentials })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          await this.saveToken(data.token);
          console.log('✅ [SessionPersistence] Token refreshed successfully');
          return true;
        }
      }
      console.log(`❌ [SessionPersistence] Refresh failed: ${response.status}`);
      return false;
    } catch (error) {
      console.error('❌ [SessionPersistence] Refresh network error:', error);
      return false;
    }
  }

  /**
   * Clear saved auth token on logout
   */
  async clearSession() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ CLEARING SESSION                                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🗑️ [SessionPersistence] Had token in memory: ${this.authToken ? 'YES' : 'NO'}`);
    
    // 1. Memory
    this.authToken = null;

    // 2. localStorage
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
      console.log('✅ [SessionPersistence] Token removed from localStorage');
    } catch (e) {
      console.warn('⚠️ [SessionPersistence] localStorage remove failed:', e);
    }

    if (!this.isNativePlatform) {
      console.log('⚠️ [SessionPersistence] WEB PLATFORM — cleared memory + localStorage');
      console.log('════════════════════════════════════════════════════════════');
      return;
    }

    // 3. Capacitor Preferences
    try {
      await Preferences.remove({ key: AUTH_TOKEN_KEY });
      await Preferences.remove({ key: TOKEN_TIMESTAMP_KEY });
      const verification = await Preferences.get({ key: AUTH_TOKEN_KEY });
      if (!verification.value) {
        console.log('✅ [SessionPersistence] Token SUCCESSFULLY removed from Capacitor Preferences');
      } else {
        console.error('❌ [SessionPersistence] CRITICAL: Token still exists after removal!');
      }
      console.log('════════════════════════════════════════════════════════════');
    } catch (error) {
      console.error('❌ [SessionPersistence] Preferences clear error:', error);
      console.log('════════════════════════════════════════════════════════════');
    }
  }
}

export const sessionPersistence = new SessionPersistenceService();
