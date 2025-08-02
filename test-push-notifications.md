# Push Notification Testing Guide

## Current Status ✅

The push notification infrastructure is fully implemented and ready for testing:

### ✅ Server-Side Implementation Complete
- **PushNotificationService**: Uses node-apn with proper APNs credentials
- **Device Token Registration**: `/api/push-tokens` endpoint stores iOS device tokens
- **4 Notification Types**: All required notifications implemented
  - Will Proposed (`/api/notifications/will-proposed`)
  - Will Started (`/api/notifications/will-started`) 
  - End Room Alerts (`/api/notifications/end-room`)
  - Ready for New Will (`/api/notifications/ready-for-new-will`)
- **Test Endpoint**: `/api/notifications/test` for direct testing

### ✅ Client-Side Implementation Complete
- **NotificationService**: Handles APNs registration and token sending
- **Auto-Registration**: Device tokens automatically sent to server on app launch
- **Capacitor Integration**: Full iOS push notification support configured

### ✅ Database Schema Ready
- **device_tokens table**: Stores user device tokens with platform info
- **Proper Relations**: Connected to users table with foreign keys

### ✅ APNs Credentials Configured
- APNS_PRIVATE_KEY: ✅ Set
- APNS_KEY_ID: ✅ Set  
- APNS_TEAM_ID: ✅ Set
- APNS_TOPIC: ✅ Set (bundle ID)

## Testing Process

### 1. Server Startup Fix Required
The server currently fails to start due to tsx not being in PATH. Fix by:
```bash
# Method 1: Update package.json script
"dev": "NODE_ENV=development npx tsx server/index.ts"

# Method 2: Use direct path
NODE_ENV=development ./node_modules/.bin/tsx server/index.ts
```

### 2. iOS App Testing
1. Build and deploy to TestFlight or physical device
2. Launch app - device token automatically registers
3. Log in to create/join circle
4. Test notification endpoints via API calls

### 3. API Testing Examples
```bash
# Test device token registration
curl -X POST http://localhost:3000/api/push-tokens \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"test-token-123","platform":"ios"}'

# Test push notification
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Testing push notifications"}'
```

## Next Steps
1. Fix server startup issue
2. Build iOS app for testing
3. Verify notifications work on physical device
4. Test all 4 notification scenarios in app flow

The infrastructure is complete and ready for end-to-end testing!