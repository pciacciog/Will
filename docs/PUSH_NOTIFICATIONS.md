# Push Notifications Implementation Guide

## Current Status
The current implementation uses **Capacitor Local Notifications** which only sends notifications to the same device. This does NOT send notifications to other users' devices.

## What We Need for Real Push Notifications

### 1. Apple Push Notification Service (APNs) Setup
- Apple Developer Account with Push Notification certificate
- APNs authentication key or certificate
- App ID configured for push notifications
- Provisioning profile with push notifications enabled

### 2. Device Token Management
- Store device tokens for each user in database
- Update tokens when app launches/user logs in
- Handle token refresh and cleanup

### 3. Server-Side Push Service
- APNs client library (node-apn or similar)
- Queue system for reliable delivery
- Push notification payload formatting

### 4. Database Schema Updates
```sql
-- Add device tokens table
CREATE TABLE user_device_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Frontend Changes
- Request push notification permissions
- Register for remote notifications
- Handle device token updates
- Process incoming push notifications

## Implementation Steps

1. **Get Apple Developer Account**: Required for APNs access
2. **Generate APNs Key**: Create authentication key in Apple Developer portal
3. **Update Database**: Add device token storage
4. **Install APNs Library**: Add node-apn or similar to server
5. **Update Mobile App**: Add push notification permissions and token handling
6. **Test with Real Devices**: Cannot test APNs in simulator

## Alternative: Firebase Cloud Messaging (FCM)
- Cross-platform solution (iOS + Android)
- Simpler setup than APNs
- Free tier available
- Better for cross-platform apps

## Security Considerations
- Never log device tokens
- Encrypt sensitive push payloads
- Implement rate limiting
- Handle token expiration gracefully