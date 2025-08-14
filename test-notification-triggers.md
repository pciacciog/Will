# WILL App - Push Notification Triggers

## Current Status
- **Device Token Registration**: ❌ Blocked by Apple Developer portal
- **Notification Sending**: ⏳ Ready but waiting for device tokens

## Automatic Notification Triggers in Your App

### 1. Will Creation (WILL Proposed)
**When**: User creates a new Will in the app
**Who gets notified**: Other circle members
**Trigger**: `POST /api/wills` endpoint
**Message**: "[Creator Name] has proposed a new WILL"

### 2. Will Becomes Active (WILL Active) 
**When**: All circle members commit and Will start date arrives
**Who gets notified**: All committed members
**Trigger**: Will status changes to "active"
**Message**: "Your WILL '[Will Title]' is now active!"

### 3. End Room Notifications
**When**: End Room is scheduled for a completed Will
**Who gets notified**: All Will participants
**Triggers**: 
- 24 hours before: "End Room starts in 24 hours"
- 15 minutes before: "End Room starts in 15 minutes"  
- Live: "End Room is starting now!"

### 4. Ready for New Will
**When**: Previous Will is completed and acknowledged
**Who gets notified**: Circle members
**Message**: "Ready to create your next WILL!"

## Manual Test Options (Once Device Tokens Work)

### Test Endpoint
```bash
POST /api/push-notifications/test
{
  "userId": "your-user-id",
  "title": "Test Notification",
  "body": "Testing WILL push notifications",
  "data": {"type": "test"}
}
```

### Encouragement Push
The app has a "Push" feature to send encouragement to circle members.

## Next Steps

**Option 1: Fix Device Registration (for real APNs)**
- Register iPhone in Apple Developer portal
- Get real device tokens
- Test actual push notifications

**Option 2: Test Notification Logic (simulation)**
- I can create a test that simulates the notification sending
- Shows what would happen when triggers fire
- Verifies the backend logic without real device tokens

Which would you prefer to focus on?