# Push Notification Registration Debug Guide

## Current Status
- ✅ App built and installed successfully
- ✅ Permissions granted (receive: "granted")
- ✅ Environment configured (development/sandbox)
- ✅ Backend APNs service ready
- ❌ Registration event never fires
- ❌ No device token generated

## Configuration Verified
- Bundle ID: `com.porfirio.will`
- Team ID: `NXA5BG3PBX`
- Environment: `development` (sandbox)
- Entitlements: `aps-environment = development`

## Most Likely Causes

### 1. Device Not Registered in Apple Developer Portal
**Symptom**: Registration fails silently
**Solution**: 
- Get iPhone UDID (from Xcode: Window → Devices and Simulators)
- Add to Apple Developer → Certificates, Identifiers & Profiles → Devices
- Regenerate provisioning profile to include the device

### 2. App ID Missing Push Notifications Capability
**Symptom**: Registration appears to succeed but no token
**Solution**:
- Go to Apple Developer → Certificates, Identifiers & Profiles → Identifiers
- Select `com.porfirio.will`
- Ensure "Push Notifications" capability is enabled and configured

### 3. Provisioning Profile Issues
**Symptom**: App installs but push features don't work
**Solution**:
- Verify provisioning profile includes:
  - Your iPhone device
  - Push Notifications capability
  - Correct Bundle ID and Team ID
- Download and install correct profile in Xcode

### 4. Bundle ID Mismatch
**Symptom**: App works but Apple rejects push registration
**Solution**:
- Verify Bundle ID in:
  - Xcode project settings
  - Apple Developer portal
  - Capacitor config
  - All must match exactly

## Debugging Steps

### Step 1: Check Apple Developer Portal
1. Log into https://developer.apple.com
2. Go to Certificates, Identifiers & Profiles
3. Verify:
   - Device is registered
   - App ID has push notifications enabled
   - Provisioning profile includes both

### Step 2: Check Xcode Project
1. Open project in Xcode
2. Select App target → Signing & Capabilities
3. Verify:
   - Correct Team selected
   - Provisioning profile includes your device
   - Push Notifications capability is present

### Step 3: Console Debugging
Add this to your iOS app debugging:
```javascript
// Add more detailed logging
PushNotifications.addListener('registration', (token) => {
  console.log('✅ SUCCESS: Device token received:', token.value);
  console.log('Token length:', token.value.length);
  console.log('Token type:', typeof token.value);
});

PushNotifications.addListener('registrationError', (err) => {
  console.error('❌ Registration failed:', err.error);
  console.error('Error details:', JSON.stringify(err, null, 2));
});
```

### Step 4: Device Console Logs
1. Connect iPhone to Mac
2. Open Console.app
3. Filter by your app name
4. Look for push-related error messages during registration

## Next Actions
1. Verify device registration in Apple Developer portal
2. Check App ID push notifications capability
3. Regenerate and download correct provisioning profile
4. Rebuild app with updated profile
5. Test registration again

The fact that no registration event fires (success OR error) suggests Apple is rejecting the registration request before it reaches your app.