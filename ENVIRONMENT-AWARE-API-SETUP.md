# Environment-Aware API Configuration - Setup Complete ✅

## Summary

Successfully implemented environment-aware API configuration for the WILL app to ensure:
- **Staging iOS app** (`com.porfirio.will.staging`) → Connects to **STAGING backend**
- **Production iOS app** (`com.porfirio.will`) → Connects to **PRODUCTION backend**
- **Web browser** → Uses relative URLs (same origin)

---

## What Was Changed

### 1. **Created Environment-Aware API Config** ✅
**File:** `client/src/config/api.ts`

**Features:**
- Bundle identifier detection (iOS staging vs production)
- Build-time environment override (`VITE_APP_ENV`)
- Async `getApiUrl()` with caching for environment detection
- Sync `getApiPath(path)` for immediate URL construction
- Automatic platform detection (native vs web)

**API URLs:**
```typescript
const PRODUCTION_API = 'https://will-1-porfirioaciacci.replit.app';
const STAGING_API    = 'https://will-staging-porfirioaciacci.replit.app'; // ⚠️ UPDATE AFTER DEPLOY
const LOCAL_API      = 'http://localhost:5000';
```

### 2. **Updated HTTP Client Integration** ✅
**File:** `client/src/lib/queryClient.ts`

- Updated `apiRequest()` to use `getApiPath(url)`
- Updated `getQueryFn()` to use `getApiPath(queryKey[0])`
- All API requests now use environment-aware URLs

### 3. **Refactored Call Sites** ✅
**Updated 11 occurrences across 6 files:**

| File | Occurrences |
|------|-------------|
| `client/src/lib/queryClient.ts` | 2 |
| `client/src/services/SessionPersistence.ts` | 1 |
| `client/src/services/NotificationService.ts` | 3 |
| `client/src/pages/NotificationTest.tsx` | 2 |
| `client/src/pages/InnerCircleHub.tsx` | 2 |
| `client/src/lib/logBridge.ts` | 1 |

**All changed from:** `getApiUrl(path)` → `getApiPath(path)`

### 4. **Added Startup Initialization** ✅
**File:** `client/src/App.tsx`

Added async initialization to warm up the API URL cache on app launch:
```typescript
useEffect(() => {
  const initializeApp = async () => {
    const apiUrl = await getApiUrl();
    console.log('🌐 [App] API URL initialized:', apiUrl || '(relative URLs)');
    logBridge.initialize();
  };
  initializeApp();
}, []);
```

---

## 🚨 CRITICAL: Update Staging URL After Deployment

### Current Status:
The `STAGING_API` URL in `client/src/config/api.ts` is currently a **placeholder**:
```typescript
const STAGING_API = 'https://will-staging-porfirioaciacci.replit.app'; // TODO: Update!
```

### Steps to Get the Real Staging URL:

1. **Deploy this Repl:**
   - Click the **"Deploy"** button in Replit
   - Choose **"Autoscale"** deployment (already configured)
   - Complete the deployment process

2. **Copy the Deployment URL:**
   - After deployment completes, go to the **Deploy tab**
   - Find your permanent staging URL (format: `https://<name>.replit.app`)
   - It will look something like:
     - `https://workspace-porfirioaciacci.replit.app` OR
     - `https://will-staging.replit.app` (if you renamed the Repl)

3. **Update the Staging URL:**
   - Edit `client/src/config/api.ts`
   - Replace the `STAGING_API` value with your actual deployment URL
   - Example:
     ```typescript
     const STAGING_API = 'https://your-actual-staging-url.replit.app';
     ```

4. **Rebuild and Deploy iOS Staging App:**
   - Update your iOS staging app config with the same URL (if using environment variables)
   - OR just rely on the bundle identifier detection (automatic!)

---

## How It Works

### Detection Strategy (in order):

1. **Build-time environment variable** (optional):
   ```bash
   VITE_APP_ENV=staging npm run build  # Forces staging
   VITE_APP_ENV=production npm run build  # Forces production
   ```

2. **Native app bundle identifier** (iOS/Android):
   ```typescript
   const info = await App.getInfo();
   if (info.id === 'com.porfirio.will.staging') → STAGING_API
   if (info.id === 'com.porfirio.will') → PRODUCTION_API
   ```

3. **Web platform fallback**:
   - Localhost → `LOCAL_API`
   - Deployed web → Relative URLs (empty string)

### Environment Detection Flow:

```
App Launch
    ↓
getApiUrl() called
    ↓
Check VITE_APP_ENV?
    ├─ Yes → Use specified environment
    └─ No → Continue
         ↓
    Is Native Platform?
    ├─ Yes → Check bundle ID
    │        ├─ com.porfirio.will.staging → STAGING_API
    │        └─ com.porfirio.will → PRODUCTION_API
    └─ No → Web Platform
             ├─ localhost → LOCAL_API
             └─ deployed → Relative URLs
```

---

## Verification Checklist

### ✅ Before iOS App Deployment:

- [ ] Deploy this staging backend Repl
- [ ] Copy the actual `.replit.app` URL from Deploy tab
- [ ] Update `STAGING_API` in `client/src/config/api.ts`
- [ ] Rebuild the web frontend: `npm run build`
- [ ] Redeploy the staging backend with updated frontend

### ✅ iOS Staging App:

- [ ] Bundle identifier set to: `com.porfirio.will.staging`
- [ ] Build and install staging app on test device
- [ ] Launch app and check console logs for:
  ```
  📱 [API Config] Native app detected: { bundleId: 'com.porfirio.will.staging', ... }
  ✅ [API Config] STAGING app detected → Using STAGING backend
  🎯 [API Config] Final API URL: https://your-staging-url.replit.app
  ```

### ✅ iOS Production App:

- [ ] Bundle identifier set to: `com.porfirio.will`
- [ ] Build production app
- [ ] Verify console shows:
  ```
  📱 [API Config] Native app detected: { bundleId: 'com.porfirio.will', ... }
  ✅ [API Config] PRODUCTION app detected → Using PRODUCTION backend
  🎯 [API Config] Final API URL: https://will-1-porfirioaciacci.replit.app
  ```

### ✅ Web Browser:

- [ ] Open app in browser
- [ ] Check console logs for:
  ```
  🌐 [API Config] Web platform detected
  🌐 [API Config] Using relative URLs (same origin)
  ```

---

## Testing Endpoints

Use these endpoints to verify environment routing:

### Health Check:
```bash
GET /api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "environment": "development" | "staging" | "production",
  "database": "development" | "staging" | "production",
  "databaseConnected": true
}
```

### User Authentication:
```bash
GET /api/user
```

Should return user data if authenticated, or 401 if not.

---

## Console Log Patterns

### Staging App (iOS):
```
📱 [API Config] Native app detected: { bundleId: 'com.porfirio.will.staging' }
✅ [API Config] STAGING app detected → Using STAGING backend
🎯 [API Config] Final API URL: https://<your-staging>.replit.app
```

### Production App (iOS):
```
📱 [API Config] Native app detected: { bundleId: 'com.porfirio.will' }
✅ [API Config] PRODUCTION app detected → Using PRODUCTION backend
🎯 [API Config] Final API URL: https://will-1-porfirioaciacci.replit.app
```

### Web Browser (Development):
```
🌐 [API Config] Web platform detected
💻 [API Config] Localhost detected → Using LOCAL_API
🎯 [API Config] Final API URL: http://localhost:5000
```

### Web Browser (Deployed):
```
🌐 [API Config] Web platform detected
🌐 [API Config] Using relative URLs (same origin)
🎯 [API Config] Final API URL: (relative URLs)
```

---

## Files Modified

1. ✅ `client/src/config/api.ts` - Environment-aware API config
2. ✅ `client/src/lib/queryClient.ts` - HTTP client integration
3. ✅ `client/src/services/SessionPersistence.ts` - Session validation
4. ✅ `client/src/services/NotificationService.ts` - Push notification registration
5. ✅ `client/src/pages/NotificationTest.tsx` - Notification testing
6. ✅ `client/src/pages/InnerCircleHub.tsx` - Circle queries
7. ✅ `client/src/lib/logBridge.ts` - Log forwarding
8. ✅ `client/src/App.tsx` - Startup initialization

---

## Next Steps

1. **Deploy this Repl** to get your staging backend URL
2. **Update** `STAGING_API` in `client/src/config/api.ts` with the real URL
3. **Build** your iOS staging app with bundle ID `com.porfirio.will.staging`
4. **Test** both apps to confirm they connect to the correct backends
5. **Monitor** console logs to verify environment detection

---

## Troubleshooting

### Issue: Staging app connects to production
**Solution:** 
- Verify bundle ID is exactly `com.porfirio.will.staging`
- Check console logs for bundle ID detection
- Ensure `STAGING_API` URL is correct in `api.ts`

### Issue: "Promise not assignable to string" errors
**Solution:**
- Use `getApiPath(path)` for synchronous URL construction
- Use `await getApiUrl()` only when you need the base URL
- All fetch calls should use `getApiPath('/api/...')`

### Issue: Web app shows wrong URL
**Solution:**
- Web should use relative URLs (empty string)
- Check if `window.location.hostname` is correctly detected
- Verify `Capacitor.isNativePlatform()` returns `false`

---

## Architecture Notes

**Why two functions?**
- `getApiUrl()`: Async, for getting base URL during initialization
- `getApiPath(path)`: Sync, for constructing full URLs in fetch calls

**Why caching?**
- Environment detection (especially `App.getInfo()`) is async
- Cache prevents repeated async calls in synchronous contexts
- Initialized once at app startup for performance

**Why bundle identifier detection?**
- Most reliable way to distinguish staging vs production iOS builds
- Works automatically without additional configuration
- Can't be accidentally misconfigured by developers

---

## Summary

✅ Environment-aware API configuration complete
✅ 11 call sites updated to use new system
✅ Startup initialization added
✅ Ready for iOS staging and production builds

**Action Required:** Deploy this Repl and update `STAGING_API` URL!
