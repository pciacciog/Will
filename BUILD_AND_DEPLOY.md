# Build and Deployment Guide for WILL iOS App

## Overview

This guide explains how to build and deploy the WILL iOS app with **bundled content** instead of loading from a remote server. This configuration ensures reliable authentication persistence and better performance.

---

## 🔧 Configuration Changes Made

### 1. **Capacitor Config** (`capacitor.config.json`)

**REMOVED** the remote server URL:
```json
// ❌ OLD (caused auth issues):
"server": {
  "url": "https://willbeta.replit.app"
}

// ✅ NEW (bundled content):
"server": {
  "androidScheme": "https",
  "iosScheme": "https"
}
```

### 2. **API URL Configuration** (`client/src/config/api.ts`)

Created a helper that automatically uses the correct API URL:
- **Web browser**: Uses relative URLs (e.g., `/api/user`)
- **iOS/Android app**: Uses absolute URLs (e.g., `https://willbeta.replit.app/api/user`)

---

## 📦 Building the iOS App

### Step 1: Build the Frontend

```bash
npm run build
```

**What this does:**
- Compiles TypeScript to JavaScript
- Bundles React app with Vite
- Outputs to `dist/public/` directory
- Includes all assets (images, CSS, JavaScript)

**Expected output:**
```
✓ built in 3.45s
dist/public/index.html
dist/public/assets/index-abc123.js
dist/public/assets/index-def456.css
```

### Step 2: Sync to iOS

```bash
npx cap sync ios
```

**What this does:**
- Copies `dist/public/` to iOS app bundle (`ios/App/App/public/`)
- Updates native dependencies
- Syncs Capacitor plugins
- Prepares Xcode project

**Expected output:**
```
✔ Copying web assets from dist/public to ios/App/App/public
✔ Copying native bridge
✔ Copying capacitor config
✔ copy ios in 234ms
✔ Updating iOS plugins
```

### Step 3: Open in Xcode

```bash
npx cap open ios
```

**Or manually:**
```bash
open ios/App/App.xcworkspace
```

⚠️ **IMPORTANT**: Always open `.xcworkspace`, NOT `.xcodeproj`!

---

## 🏗️ Building in Xcode

### 1. Select Build Target

1. Click on "App" in the top bar (next to the play button)
2. Select either:
   - **"Any iOS Device (arm64)"** for App Store submission
   - **Your connected iPhone** for testing on device
   - **Simulator** for local testing (faster but can't test push notifications)

### 2. Build Settings

**For App Store / TestFlight:**
1. Product → Archive
2. Wait for build to complete (2-5 minutes)
3. Window → Organizer → Archives
4. Select the archive → Distribute App → App Store Connect
5. Follow the wizard

**For device testing:**
1. Connect iPhone via USB
2. Select your device in target menu
3. Click the Play button (⌘R) or Product → Run
4. App installs and launches on your device

---

## 🧪 Testing the Build

### Local Testing Checklist

Before submitting to App Store, test these features:

1. **Authentication Persistence**
   - ✅ Log in to the app
   - ✅ Close the app completely (swipe up from multitasking)
   - ✅ Wait 5 minutes
   - ✅ Reopen the app → You should REMAIN LOGGED IN

2. **API Calls**
   - ✅ Create a circle
   - ✅ Create a Will
   - ✅ Submit progress
   - ✅ All backend operations should work normally

3. **Push Notifications**
   - ✅ Grant notification permissions
   - ✅ Device token should register with backend
   - ✅ Receive test notification

4. **Video Calls (End Room)**
   - ✅ Join End Room video call
   - ✅ Video/audio should work

### Verify API Configuration

Check the console logs on first launch:
```
📱 [SessionPersistence] Platform: ios
📱 [SessionPersistence] isNativePlatform: true
🔍 [API] Using base URL: https://willbeta.replit.app
```

If you see `isNativePlatform: false`, something went wrong!

---

## 🚀 Deployment Process

### 1. Make Code Changes

```bash
# Edit your React/TypeScript code
code client/src/...

# Test locally in browser
npm run dev
```

### 2. Build for Production

```bash
# Build frontend
npm run build

# Sync to iOS
npx cap sync ios
```

### 3. Version Bump (Important!)

In Xcode:
1. Select "App" project in left sidebar
2. Select "App" target
3. General tab
4. Increment **Version** (e.g., 1.0.0 → 1.0.1) for App Store updates
5. Increment **Build** number (e.g., 1 → 2) for every upload

### 4. Archive and Upload

```bash
# Open Xcode
npx cap open ios

# Then in Xcode:
# Product → Archive → Distribute App
```

### 5. TestFlight / App Store

1. Go to App Store Connect (https://appstoreconnect.apple.com)
2. Select your app
3. Click "+" to create new version
4. Upload build from Xcode
5. Fill in release notes
6. Submit for review

---

## 🔄 Development Workflow

### Development Mode (Live Reload)

If you want to use the remote server during development for live reload:

```bash
# Use development config (has remote URL)
npx cap sync ios --config capacitor.config.dev.json
```

Then build in Xcode as normal. The app will load from `willbeta.replit.app` and auto-reload when you make changes.

### Production Mode (Bundled)

Always use the regular config for App Store builds:

```bash
# Use production config (bundled content)
npx cap sync ios
```

---

## 🔍 Troubleshooting

### "API calls are failing"

**Symptom**: Network errors like `TypeError: Failed to fetch`

**Solution**: Check `client/src/config/api.ts` - make sure `BACKEND_SERVER_URL` matches your actual backend:

```typescript
const BACKEND_SERVER_URL = 'https://willbeta.replit.app';
```

### "Still getting logged out after 30 minutes"

**Symptom**: Users logged out despite bundled content

**Diagnosis**: Check console logs:
```
📱 [SessionPersistence] Platform: ios
📱 [SessionPersistence] isNativePlatform: true  ← Should be true!
```

If `isNativePlatform: false`, the app is still loading from remote URL. Verify:
1. `capacitor.config.json` has NO `server.url` field
2. You ran `npx cap sync ios` after changing config
3. You rebuilt the app in Xcode

### "Build fails in Xcode"

**Common issues**:
1. **CocoaPods**: Run `cd ios/App && pod install && cd ../..`
2. **Derived Data**: Xcode → Product → Clean Build Folder (⇧⌘K)
3. **Signing**: Xcode → Signing & Capabilities → Select your team

---

## 📊 Comparison: Bundled vs Remote

| Feature | Bundled Content ✅ | Remote Server ❌ |
|---------|-------------------|------------------|
| **Auth Persistence** | 100% reliable (iOS UserDefaults) | Cleared after ~30min (WKWebView) |
| **App Load Speed** | Fast (local files) | Slower (network latency) |
| **Offline Support** | Yes (UI works offline) | No (requires connection) |
| **Updates** | App Store review required | Instant (no review) |
| **API Calls** | Still work (to backend server) | Work |
| **App Store Compliant** | Yes (standard approach) | Yes (but unusual) |

---

## 🎯 What You DON'T Lose by Bundling

- ✅ Backend API calls still work normally
- ✅ Push notifications still work
- ✅ Video calls (Daily.co) still work
- ✅ Database operations still work
- ✅ All server-side logic unchanged

The ONLY difference is that the HTML/CSS/JavaScript files are bundled in the app instead of fetched from a server.

---

## 📝 Summary

**Before each App Store submission:**

```bash
# 1. Build frontend
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode
npx cap open ios

# 4. Increment version/build numbers
# (Do this in Xcode UI)

# 5. Archive and upload
# Product → Archive → Distribute App
```

**Testing locally:**

```bash
# 1. Build and sync
npm run build && npx cap sync ios

# 2. Run on device/simulator from Xcode
# Click the Play button
```

That's it! The app now uses bundled content for reliability while still connecting to your backend server for all data operations.
