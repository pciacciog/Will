# iOS Push Notifications Setup Guide

## Overview

Your WILL app now has a complete push notification infrastructure that can send real iOS push notifications to users' devices even when the app is closed. The notifications will appear on lock screens and in the notification center.

## Current Implementation

✅ **Client-side**: Capacitor Push Notifications plugin registers device tokens and sends them to server
✅ **Server-side**: API endpoints store device tokens and handle notification requests  
✅ **Database**: Device tokens are stored with user associations
✅ **Push Service**: node-apn service ready for APNs integration
✅ **4 Key Notifications**: Will Proposed, Will Active, End Room timing, Ready for New Will

## Production Setup Required

To enable real iOS push notifications in production, you need:

### 1. Apple Developer Account Setup

1. **Apple Developer Program** membership ($99/year)
2. **App ID** configured with Push Notifications capability
3. **APNs Authentication Key** or Push Certificate

### 2. APNs Certificates/Keys

Option A - **APNs Key** (Recommended):
```bash
# Download .p8 key file from Apple Developer portal
# Add to your project: /certs/AuthKey_XXXXXXXXXX.p8
```

Option B - **Push Certificate**:
```bash
# Generate CSR, download .cer from Apple, convert to .pem
# Add to your project: /certs/cert.pem and /certs/key.pem
```

### 3. Environment Variables

Add these to your production environment:
```bash
# APNs Key Method (recommended)
APNS_KEY_PATH=./certs/AuthKey_XXXXXXXXXX.p8
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX

# APNs Certificate Method (alternative)
APNS_CERT_PATH=./certs/cert.pem
APNS_KEY_PATH=./certs/key.pem

# Your app's bundle ID
APNS_BUNDLE_ID=com.porfirio.will

# Production vs sandbox
NODE_ENV=production
```

### 4. Update Push Service

Uncomment the production configuration in `server/pushNotificationService.ts`:

```typescript
const options = {
  token: {
    key: process.env.APNS_KEY_PATH || './certs/AuthKey.p8',
    keyId: process.env.APNS_KEY_ID || 'YOUR_KEY_ID',
    teamId: process.env.APNS_TEAM_ID || 'YOUR_TEAM_ID',
  },
  production: process.env.NODE_ENV === 'production',
};

this.apnProvider = new apn.Provider(options);
```

### 5. iOS App Configuration

1. **Bundle ID**: Must match your Apple Developer App ID
2. **Capabilities**: Push Notifications enabled in Xcode
3. **Info.plist**: No additional configuration needed
4. **Provisioning Profile**: Must include Push Notifications

### 6. Testing

1. **Development**: Use Apple's sandbox APNs servers
2. **TestFlight**: Use production APNs servers
3. **App Store**: Use production APNs servers

## Current Status

🔄 **Simulation Mode**: The service currently logs what notifications would be sent
📱 **Device Registration**: iOS devices can register push tokens with the server
🎯 **Targeting**: Server knows which users to notify for each Will event
⚡ **Ready**: Just needs APNs certificates to send real notifications

## Notification Flow

1. **User opens app** → Device registers push token with server
2. **Will events occur** → Server identifies relevant users
3. **Push service** → Sends notifications via APNs to user devices
4. **iOS displays** → Notifications appear on lock screen even if app closed

## Testing Without APNs

While in simulation mode, you can test the notification flow:

1. Check server logs to see when notifications would be sent
2. Verify device tokens are being stored in database
3. Confirm API endpoints are working correctly
4. Test notification triggering from app actions

## Next Steps

1. Set up Apple Developer account with Push Notifications
2. Generate APNs authentication key
3. Add environment variables to production deployment
4. Update pushNotificationService.ts configuration
5. Test with TestFlight build
6. Deploy to App Store with real push notifications