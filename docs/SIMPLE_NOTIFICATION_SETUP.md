# Simple Step-by-Step: Enable Real iOS Push Notifications

## Step 1: Get Apple Developer Account (Required)

1. Go to **developer.apple.com**
2. Click **"Account"** → **"Enroll"**
3. Pay **$99/year** (Individual or Organization)
4. Wait **24-48 hours** for approval

---

## Step 2: Generate Push Notification Key

**After your Apple Developer account is approved:**

1. Log into **developer.apple.com/account**
2. Go to **"Certificates, Identifiers & Profiles"**
3. Click **"Keys"** in the sidebar
4. Click the **"+"** button to create new key
5. Name it: **"WILL Push Notifications"**
6. Check the box: **"Apple Push Notifications service (APNs)"**
7. Click **"Continue"** → **"Register"**
8. **IMPORTANT:** Download the `.p8` file (you can only do this once!)
9. Note the **Key ID** (10 characters like `ABC123DEFG`)
10. Go to **"Membership"** tab and copy your **Team ID** (10 characters)

---

## Step 3: Enable Push for Your App

1. In Apple Developer Console, go to **"Identifiers"**
2. Find your App ID: **`com.porfirio.will`**
3. Click **"Edit"**
4. Check the box: **"Push Notifications"**
5. Click **"Save"**

---

## Step 4: Upload Key to Replit

1. In your Replit project, go to the **`certs/`** folder
2. Upload the `.p8` file you downloaded
3. Rename it to match your Key ID: `AuthKey_ABC123DEFG.p8`

---

## Step 5: Add Environment Variables

1. In Replit, click the **"Secrets"** tab (lock icon)
2. Add these secrets with YOUR actual values:

```
APNS_KEY_PATH = ./certs/AuthKey_ABC123DEFG.p8
APNS_KEY_ID = ABC123DEFG
APNS_TEAM_ID = XXXXXXXXXX
APNS_BUNDLE_ID = com.porfirio.will
NODE_ENV = production
```

**Replace:**
- `ABC123DEFG` with your actual Key ID
- `XXXXXXXXXX` with your actual Team ID
- Filename with your actual .p8 filename

---

## Step 6: Restart Server

1. In Replit, restart your workflow
2. Check the console logs - you should see:
   ```
   [PushNotificationService] Initialized with APNs (production mode)
   ```
   Instead of:
   ```
   [PushNotificationService] APNs credentials not found - running in simulation mode
   ```

---

## Step 7: Test Notifications

1. Open your iPhone app (or TestFlight app)
2. Create a Will on your laptop
3. Check if you receive a push notification on your iPhone lock screen

**If it works:** 🎉 You're done! Notifications are now live for all users.

**If it doesn't work:** Check the server logs for APNs error messages.

---

## Current Status

❌ **Not working yet** - You need Apple Developer account and APNs key
✅ **Code ready** - All notification infrastructure is built and deployed
✅ **Apps ready** - Your iPhone app and TestFlight build will work immediately

## Time Estimate

- **Apple Developer signup:** 5 minutes
- **Approval wait:** 24-48 hours
- **Generate key:** 5 minutes
- **Upload and configure:** 5 minutes

**Total active time:** ~15 minutes + waiting for Apple approval

## What Notifications You'll Get

1. **"[Name] proposed a new Will"** - When someone creates a Will
2. **"Your Will is now active!"** - When your Will starts
3. **"End Room opens in 15 minutes"** - Before End Room
4. **"Ready to create a new Will"** - When all members acknowledge

These will appear on your iPhone lock screen even when the app is closed!