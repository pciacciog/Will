# Deployment Workflow for iOS Push Notifications

## Current Setup
- **iOS App**: Points to `https://willbeta.replit.app` (your live server)
- **Server**: Running on Replit with push notification infrastructure
- **Database**: PostgreSQL on Replit with device token storage

## Option 1: Hybrid Deployment (Recommended - Fastest)

### Step 1: Deploy Server to Replit
1. Your push notification server is already running on Replit
2. When you add APNs credentials, notifications will work immediately
3. No code deployment needed - server is live

### Step 2: Update Local iOS App
1. Pull latest code to your computer:
   ```bash
   git pull origin main
   ```

2. Build iOS app with latest client code:
   ```bash
   chmod +x build-mobile.sh
   ./build-mobile.sh
   ```

3. In Xcode:
   - Update version number (increment build number)
   - Archive for App Store submission
   - Upload to App Store Connect

### Step 3: Add APNs Credentials to Replit
1. Generate APNs key from Apple Developer Console
2. Upload `.p8` file to Replit project (`certs/` folder)
3. Add environment variables to Replit:
   ```bash
   APNS_KEY_PATH=./certs/AuthKey_ABC123DEFG.p8
   APNS_KEY_ID=ABC123DEFG
   APNS_TEAM_ID=XXXXXXXXXX
   APNS_BUNDLE_ID=com.porfirio.will
   NODE_ENV=production
   ```

### Result
- ✅ Server immediately sends real push notifications
- ✅ iOS app connects to live server with all latest features
- ✅ Users receive lock screen notifications instantly

---

## Option 2: Full Local Development

### Step 1: Pull Code Locally
```bash
git clone [your-repo]
cd will-app
npm install
```

### Step 2: Set Up Local Environment
1. Copy APNs credentials to local `certs/` folder
2. Create local `.env.production` with your values
3. Set up local PostgreSQL database

### Step 3: Build and Deploy
```bash
# Build web app
npm run build

# Build iOS app  
chmod +x build-mobile.sh
./build-mobile.sh
```

### Step 4: Deploy Server
- Deploy to your preferred hosting (AWS, Vercel, etc.)
- Update iOS app's server URL in `capacitor.config.ts`

---

## Recommended Approach

**Use Option 1** because:
- ✅ Faster deployment (server already live)
- ✅ Less infrastructure setup needed
- ✅ Replit handles database and hosting
- ✅ Push notifications work immediately when you add APNs credentials
- ✅ Your iOS app already points to the right server

## Current Status

Your app is deployment-ready:
- **Server**: Live on Replit with push notification infrastructure ✅
- **iOS App**: Points to live server ✅  
- **Database**: PostgreSQL ready with device token storage ✅
- **APNs Integration**: Code ready, just needs your Apple Developer credentials ✅

## Next Steps

1. **Generate APNs key** from Apple Developer Console
2. **Add credentials** to your Replit environment
3. **Update iOS app** with latest client code and submit to App Store
4. **Test push notifications** work on real devices

The beauty of your current setup is that the server with push notifications is already live - you just need the Apple Developer credentials to enable real notifications!