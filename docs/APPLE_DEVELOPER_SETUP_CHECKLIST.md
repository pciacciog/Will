# Apple Developer Setup Checklist for iOS Push Notifications

## Step 1: Apple Developer Account ✅

**What you need to do:**
1. Go to [developer.apple.com](https://developer.apple.com)
2. Click "Account" → "Enroll"
3. Pay $99/year fee (Individual or Organization)
4. Wait 24-48 hours for approval

**Status:** ⏳ Pending (you need to complete this)

---

## Step 2: Enable Push Notifications for Your App ✅

**What you need to do:**
1. Log into [Apple Developer Console](https://developer.apple.com/account)
2. Go to "Certificates, Identifiers & Profiles"
3. Click "Identifiers"
4. Find your App ID: `com.porfirio.will`
5. Click "Edit" → Check "Push Notifications" → Save

**Status:** ⏳ Pending (requires Step 1 completion)

---

## Step 3: Generate APNs Authentication Key ✅

**What you need to do:**
1. In Apple Developer Console → "Keys" section
2. Click "+" to create new key
3. Name: "WILL Push Notifications"
4. Check "Apple Push Notifications service (APNs)"
5. Click "Continue" → "Register"
6. **IMPORTANT:** Download the `.p8` file (you can only do this once!)
7. Save the Key ID (e.g., `ABC123DEFG`)

**What you'll get:**
- `AuthKey_XXXXXXXXXX.p8` file
- Key ID (10 characters)
- Team ID (find in "Membership" section)

**Status:** ⏳ Pending (requires Step 1 completion)

---

## Step 4: Upload Certificates to Your Project ✅

**What you need to do:**
1. Download the `.p8` file from Apple Developer Console
2. Upload it to your project in the `certs/` folder
3. Rename it if needed: `AuthKey_[YOUR_KEY_ID].p8`

**File location:**
```
certs/
├── AuthKey_ABC123DEFG.p8  ← Your downloaded key
└── README.md
```

**Status:** ⏳ Pending (requires Step 3 completion)

---

## Step 5: Configure Environment Variables ✅

**What you need to do:**
1. Open `.env.production` in your project
2. Replace placeholders with your actual values:

```bash
# Replace these with your real values:
APNS_KEY_PATH=./certs/AuthKey_ABC123DEFG.p8  ← Your actual key filename
APNS_KEY_ID=ABC123DEFG                       ← Your actual Key ID
APNS_TEAM_ID=XXXXXXXXXX                      ← Your actual Team ID
APNS_BUNDLE_ID=com.porfirio.will             ← Keep this as-is
NODE_ENV=production                          ← Keep this as-is
```

**Where to find values:**
- **Key ID:** Shown when you create the key
- **Team ID:** Apple Developer Console → "Membership"
- **Key Path:** The filename of your uploaded `.p8` file

**Status:** ✅ Ready (file created, just needs your values)

---

## Step 6: Test Push Notifications ✅

**What happens when complete:**
1. Your server will automatically detect the APNs credentials
2. Push notifications will be sent to real iOS devices
3. Users will receive notifications on lock screen even when app is closed

**How to test:**
1. Build and install your iOS app on a device
2. Create a Will in the app
3. Check your server logs for APNs success/failure
4. Verify notifications appear on device lock screen

**Status:** ✅ Ready (your code is prepared)

---

## Current Status Summary

✅ **Server Code:** Ready for APNs integration  
✅ **Database:** Device token storage implemented  
✅ **API Endpoints:** Push notification routes created  
✅ **iOS App:** Device registration implemented  
⏳ **Apple Developer Account:** You need to set this up  
⏳ **APNs Key:** You need to generate and upload  
⏳ **Environment Variables:** You need to add your values  

## Next Steps

1. **TODAY:** Sign up for Apple Developer Program ($99)
2. **Within 48 hours:** Apple approves your account
3. **After approval:** Generate APNs key and configure environment
4. **Test:** Deploy and verify push notifications work

## Important Notes

- The `.p8` key file can only be downloaded once from Apple
- Keep your credentials secure (they're in .gitignore)
- Use sandbox APNs for development, production APNs for App Store
- TestFlight uses production APNs servers

## Support

If you encounter issues:
1. Check server logs for APNs connection errors
2. Verify Key ID and Team ID are correct
3. Ensure `.p8` file is in the right location
4. Confirm your App ID has Push Notifications enabled