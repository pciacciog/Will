import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getApiUrl } from '@/config/api';

const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_TIMESTAMP_KEY = 'auth_token_timestamp';

class SessionPersistenceService {
  private isNativePlatform = Capacitor.isNativePlatform();
  private authToken: string | null = null;
  
  constructor() {
    // 🔍 DIAGNOSTIC: Log platform detection immediately on service creation
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ SessionPersistence Service Initialized                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔍 [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    console.log(`🔍 [SessionPersistence] isNativePlatform: ${this.isNativePlatform}`);
    console.log(`🔍 [SessionPersistence] Timestamp: ${new Date().toISOString()}`);
    console.log(`🔍 [SessionPersistence] User Agent: ${navigator.userAgent}`);
    console.log('════════════════════════════════════════════════════════════');
  }

  /**
   * Save JWT auth token to persistent storage
   * This runs after successful login
   */
  async saveToken(token: string) {
    const timestamp = new Date().toISOString();
    const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ SAVING TOKEN                                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔐 [SessionPersistence] Token preview: ${tokenPreview}`);
    console.log(`🔐 [SessionPersistence] Token length: ${token.length} chars`);
    console.log(`🔐 [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    console.log(`🔐 [SessionPersistence] isNativePlatform: ${this.isNativePlatform}`);
    console.log(`🔐 [SessionPersistence] Timestamp: ${timestamp}`);
    
    this.authToken = token;
    
    if (!this.isNativePlatform) {
      console.log('⚠️ [SessionPersistence] WEB PLATFORM - Token saved to MEMORY ONLY (will be lost on refresh!)');
      console.log('════════════════════════════════════════════════════════════');
      return;
    }

    try {
      // Save token
      await Preferences.set({
        key: AUTH_TOKEN_KEY,
        value: token
      });
      
      // Save timestamp for diagnostics
      await Preferences.set({
        key: TOKEN_TIMESTAMP_KEY,
        value: timestamp
      });
      
      // Verify it was saved by reading it back
      const verification = await Preferences.get({ key: AUTH_TOKEN_KEY });
      const timestampVerification = await Preferences.get({ key: TOKEN_TIMESTAMP_KEY });
      
      if (verification.value === token) {
        console.log('✅ [SessionPersistence] Token SUCCESSFULLY saved to Capacitor Preferences');
        console.log(`✅ [SessionPersistence] Saved at: ${timestampVerification.value}`);
        console.log(`✅ [SessionPersistence] Verification: Token read back matches`);
      } else {
        console.error('❌ [SessionPersistence] CRITICAL: Token verification FAILED!');
        console.error(`❌ [SessionPersistence] Saved token length: ${token.length}`);
        console.error(`❌ [SessionPersistence] Retrieved token length: ${verification.value?.length || 0}`);
      }
      
      console.log('════════════════════════════════════════════════════════════');
    } catch (error) {
      console.error('╔════════════════════════════════════════════════════════════╗');
      console.error('║ CRITICAL ERROR SAVING TOKEN                                ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      console.error('❌ [SessionPersistence] Exception:', error);
      console.error(`❌ [SessionPersistence] Error type: ${error instanceof Error ? error.name : typeof error}`);
      console.error(`❌ [SessionPersistence] Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error('════════════════════════════════════════════════════════════');
    }
  }

  /**
   * Get current auth token (from memory or persistent storage)
   */
  async getToken(): Promise<string | null> {
    console.log('🔍 [SessionPersistence] getToken() called');
    console.log(`🔍 [SessionPersistence] Memory cache: ${this.authToken ? 'HAS TOKEN' : 'EMPTY'}`);
    
    // Return from memory if available
    if (this.authToken) {
      console.log(`✅ [SessionPersistence] Returning token from MEMORY cache`);
      console.log(`✅ [SessionPersistence] Token preview: ${this.authToken.substring(0, 20)}...${this.authToken.substring(this.authToken.length - 10)}`);
      return this.authToken;
    }

    // For mobile, try to restore from persistent storage
    if (this.isNativePlatform) {
      console.log('🔍 [SessionPersistence] Memory cache empty - checking Capacitor Preferences...');
      try {
        const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
        const { value: timestamp } = await Preferences.get({ key: TOKEN_TIMESTAMP_KEY });
        
        if (value) {
          this.authToken = value;
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║ TOKEN RESTORED FROM PREFERENCES                            ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log(`✅ [SessionPersistence] Token found in Capacitor Preferences!`);
          console.log(`✅ [SessionPersistence] Token length: ${value.length} chars`);
          console.log(`✅ [SessionPersistence] Token preview: ${value.substring(0, 20)}...${value.substring(value.length - 10)}`);
          console.log(`✅ [SessionPersistence] Originally saved at: ${timestamp || 'UNKNOWN'}`);
          console.log(`✅ [SessionPersistence] Time since save: ${timestamp ? Math.round((Date.now() - new Date(timestamp).getTime()) / 1000 / 60) : '?'} minutes`);
          console.log('════════════════════════════════════════════════════════════');
          return value;
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║ NO TOKEN IN PREFERENCES                                    ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('⚠️ [SessionPersistence] Capacitor Preferences returned NULL');
          console.log('⚠️ [SessionPersistence] This means either:');
          console.log('⚠️   1. User never logged in');
          console.log('⚠️   2. Token was cleared (logout)');
          console.log('⚠️   3. iOS cleared Preferences storage (CRITICAL BUG)');
          console.log('⚠️   4. Storage is not persisting correctly');
          console.log('════════════════════════════════════════════════════════════');
        }
      } catch (error) {
        console.error('╔════════════════════════════════════════════════════════════╗');
        console.error('║ ERROR READING FROM PREFERENCES                             ║');
        console.error('╚════════════════════════════════════════════════════════════╝');
        console.error('❌ [SessionPersistence] Exception:', error);
        console.error(`❌ [SessionPersistence] Error type: ${error instanceof Error ? error.name : typeof error}`);
        console.error(`❌ [SessionPersistence] Error message: ${error instanceof Error ? error.message : String(error)}`);
        console.error('════════════════════════════════════════════════════════════');
      }
    } else {
      console.log('⚠️ [SessionPersistence] WEB PLATFORM - Not checking Preferences (memory only)');
    }

    console.log('❌ [SessionPersistence] No token available - user needs to login');
    return null;
  }

  /**
   * Restore auth token from persistent storage AND validate it with server
   * This runs on app launch before API calls
   */
  async restoreSession(): Promise<boolean> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ RESTORING SESSION ON APP LAUNCH                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🔄 [SessionPersistence] App launch time: ${new Date().toISOString()}`);
    console.log(`🔄 [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    
    const token = await this.getToken();
    
    if (!token) {
      console.log('❌ [SessionPersistence] No token found - session NOT restored');
      console.log('════════════════════════════════════════════════════════════');
      return false;
    }
    
    // 🔥 NEW: Validate token with server before claiming session restored
    console.log('🔐 [SessionPersistence] Token found - validating with server...');
    try {
      const response = await fetch(getApiUrl('/api/user'), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      
      if (response.ok) {
        const user = await response.json();
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║ SESSION SUCCESSFULLY RESTORED                              ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`✅ [SessionPersistence] Token VALID - User authenticated`);
        console.log(`✅ [SessionPersistence] User ID: ${user.id}`);
        console.log(`✅ [SessionPersistence] User Email: ${user.email}`);
        console.log('════════════════════════════════════════════════════════════');
        return true;
      } else {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║ TOKEN VALIDATION FAILED                                    ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.error(`❌ [SessionPersistence] Server returned ${response.status}: ${response.statusText}`);
        console.error('❌ [SessionPersistence] Token is INVALID or EXPIRED');
        console.error('❌ [SessionPersistence] Clearing invalid token from storage...');
        
        // Clear the invalid token
        await this.clearSession();
        
        console.log('════════════════════════════════════════════════════════════');
        return false;
      }
    } catch (error) {
      console.error('╔════════════════════════════════════════════════════════════╗');
      console.error('║ NETWORK ERROR DURING TOKEN VALIDATION                      ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      console.error('❌ [SessionPersistence] Could not validate token with server');
      console.error('❌ [SessionPersistence] Error:', error);
      console.error('⚠️ [SessionPersistence] Assuming token is valid (network issue)');
      console.error('════════════════════════════════════════════════════════════');
      // If network error, assume token is valid and let the app try
      return true;
    }
  }

  /**
   * Clear saved auth token
   * This runs on logout
   */
  async clearSession() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ CLEARING SESSION                                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`🗑️ [SessionPersistence] Timestamp: ${new Date().toISOString()}`);
    console.log(`🗑️ [SessionPersistence] Platform: ${Capacitor.getPlatform()}`);
    console.log(`🗑️ [SessionPersistence] Had token in memory: ${this.authToken ? 'YES' : 'NO'}`);
    
    // Get timestamp before clearing to see how long session lasted
    if (this.isNativePlatform) {
      try {
        const { value: timestamp } = await Preferences.get({ key: TOKEN_TIMESTAMP_KEY });
        if (timestamp) {
          const minutesSinceLogin = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
          console.log(`📊 [SessionPersistence] Session duration: ${minutesSinceLogin} minutes`);
          console.log(`📊 [SessionPersistence] Token was saved at: ${timestamp}`);
        }
      } catch (e) {
        // Ignore error, just diagnostic
      }
    }
    
    this.authToken = null;
    
    if (!this.isNativePlatform) {
      console.log('⚠️ [SessionPersistence] WEB PLATFORM - Cleared from memory only');
      console.log('════════════════════════════════════════════════════════════');
      return;
    }

    try {
      await Preferences.remove({ key: AUTH_TOKEN_KEY });
      await Preferences.remove({ key: TOKEN_TIMESTAMP_KEY });
      
      // Verify deletion
      const verification = await Preferences.get({ key: AUTH_TOKEN_KEY });
      if (!verification.value) {
        console.log('✅ [SessionPersistence] Token SUCCESSFULLY removed from Capacitor Preferences');
        console.log('✅ [SessionPersistence] Verification: Preferences storage is empty');
      } else {
        console.error('❌ [SessionPersistence] CRITICAL: Token still exists after removal attempt!');
      }
      
      console.log('════════════════════════════════════════════════════════════');
    } catch (error) {
      console.error('╔════════════════════════════════════════════════════════════╗');
      console.error('║ ERROR CLEARING SESSION                                     ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      console.error('❌ [SessionPersistence] Exception:', error);
      console.error(`❌ [SessionPersistence] Error type: ${error instanceof Error ? error.name : typeof error}`);
      console.error(`❌ [SessionPersistence] Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error('════════════════════════════════════════════════════════════');
    }
  }
}

export const sessionPersistence = new SessionPersistenceService();
