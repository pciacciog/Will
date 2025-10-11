# Replit.md

## Overview

This is a full-stack web application designed for group goal accountability. Users form "Inner Circles" (2-4 people) to define and track progress on "wills" (goal commitments). The application supports daily progress tracking, mutual accountability, and a structured goal lifecycle. Its purpose is to facilitate personal growth through shared commitment and consistent action within a supportive community.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript, utilizing Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with custom design tokens for a clean, modern aesthetic.
- **Color Schemes**: Thoughtful use of gradients (emerald/teal, blue/indigo, purple) and consistent brand colors (brandGreen, brandBlue, brandGray) to signify status and enhance visual hierarchy.
- **Layout**: Mobile-first design, strictly optimized for single-viewport display on iPhone screens, minimizing vertical scrolling through compact elements, optimized spacing, and flexible layouts.
- **Interaction**: Features smooth micro-interactions like hover animations, scale effects, and subtle transition animations (fade-in, slide-up) for a polished user experience.
- **Information Flow**: Structured commitment and End Room flows (When → What → Why → End Room) with clear progress indicators, instructional modals, and consistent iconography (Lucide React icons).
- **Branding**: Employs "WILL" as core branding with a hand icon symbolizing personal agency and commitment.

### Technical Implementations
- **Frontend**: React (TypeScript), Wouter for routing, TanStack Query for server state management, Vite for building.
- **Backend**: Express.js (TypeScript), Drizzle ORM for database interaction, Passport.js for authentication. Standalone server architecture (index-standalone.ts) eliminates vite dependency for deployment.
- **Build Process**: ESBuild-only production builds for deployment compatibility, bypassing vite dependencies that caused deployment failures. Package.json scripts updated to use standalone server architecture (August 2025).
- **Authentication**: Custom email/password authentication system, integrated with Replit's OIDC initially (later disabled for direct public access). Sessions are managed via Express sessions with PostgreSQL storage.
- **Will System**: Structured goal commitments with status tracking (pending, scheduled, active, completed, waiting_for_end_room), individual member commitments, and progress acknowledgment. Includes features like "Prescribed Weekly Will" scheduling.
- **Circle Management**: Invite codes for joining, strict member limits (2-4), and single-circle membership per user.
- **Real-time Updates**: Continuous polling (30-second intervals for critical data, 5-10 seconds for specific Will statuses) and robust cache invalidation for immediate UI feedback.
- **Mobile Integration**: Implemented with Capacitor for iOS, including safe area optimization, push notifications (APNs integration), and embedded video room support.

### Feature Specifications
- **Authentication**: Email and password-based sign-up/sign-in, dedicated authentication page, secure password changes.
- **Circle Management**: Create/join circles, display member list (first names only for privacy).
- **Will Creation & Management**: Multi-step guided creation process (When, What, Why, End Room scheduling), editing of personal commitments, role-based permissions (creator can modify Will dates/delete).
- **Progress Tracking**: Daily logging, progress acknowledgment system (by committed members), and timeline visualization.
- **End Room**: A scheduled video call (Daily.co integration) for reflection and closure at the Will's completion. Features include live countdowns, dynamic status updates, and mobile compatibility.
- **Account Settings**: User profile (read-only name/email), password change, leave circle functionality, permanent account deletion (Apple App Store Guideline 5.1.1(v) compliant).
- **Push Notifications**: Complete APNs integration with targeted notifications for Will status changes (Proposed, Active, End Room timings, Ready for New WILL). Server-side PushNotificationService implemented with node-apn, client-side auto-registration via Capacitor, and comprehensive API endpoints for all notification types. Real APNs functionality operational using fixed .p8 key file (AuthKey_4J2R866V2R_fixed.p8), resolving Node.js 18+ OpenSSL compatibility issues.
- **Team Encouragement**: "Push" feature to send encouragement to circle members (local-only initially, designed for APNs integration).

### System Design Choices
- **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM for type-safe schema and migrations.
- **API Design**: RESTful API endpoints with JSON responses.
- **Error Handling**: Comprehensive error handling and redirect logic for authentication and data operations.
- **Timezone Handling**: Consistent UTC storage in database with local time display in frontend.
- **Privacy**: "Because" statements are private to the user, and member names are displayed as first names only.

## External Dependencies

- **@neondatabase/serverless**: PostgreSQL database connection.
- **drizzle-orm**: Database ORM and query builder.
- **express**: Web server framework.
- **passport**: Authentication middleware.
- **@tanstack/react-query**: Client-side state management.
- **@radix-ui/**: UI component primitives.
- **tailwindcss**: CSS framework.
- **Daily.co**: Video conferencing API for End Room functionality.
- **node-apn**: For Apple Push Notification service integration.
- **@capacitor/core**, **@capacitor/ios**: For iOS mobile app development and native features.

## Recent Changes

### October 11, 2025 - Critical Bug Fixes: Authentication, Notifications, Status Updates
- **ISSUE #1 FIXED**: User Being Logged Out on App Close
  - **Root Cause**: Mobile apps (Capacitor) don't persist Express session cookies reliably across app restarts due to cross-origin limitations (capacitor://localhost vs API domain)
  - **Solution**: Implemented bearer token authentication using JWT tokens
  - **Implementation Details**:
    - Server: JWT token generation on login/register (7-day expiration)
    - Server: Hybrid authentication middleware supporting both session cookies (web) and JWT tokens (mobile)
    - Server: Updated /api/user and /api/auth/me to accept JWT bearer tokens
    - Client: SessionPersistence service stores/retrieves JWT tokens via Capacitor Preferences
    - Client: queryClient automatically adds Authorization header with JWT token to all API requests
    - Client: Login/register flows save JWT tokens, logout clears them
  - **Files**: server/auth.ts, client/src/lib/queryClient.ts, client/src/services/SessionPersistence.ts, client/src/pages/Auth.tsx, client/src/App.tsx
  - **Architect Review**: ✅ PASSED - Hybrid auth enables JWT-based persistence without breaking web sessions
  - **Status**: ✅ DEPLOYED - Mobile users will stay logged in after app restart, web users continue using session cookies
  - **Security Note**: Production must set strong JWT_SECRET environment variable (currently uses fallback for development)
  
- **ISSUE #2 FIXED**: Critical Device Token Association Bug (Cross-User Notification Leakage)
  - **Root Cause**: `associatePendingTokens()` was associating ALL NULL device tokens globally instead of only the current device's token
    - User X downloads app → NULL token created
    - User Y logs in → ALL NULL tokens (including User X's) get associated with User Y
    - Result: User X receives User Y's notifications (critical privacy/security bug)
  - **Solution**: Device token scoping - only associate the specific device's token when provided
  - **Implementation Details**:
    - Server: Updated `associatePendingTokens(userId, deviceToken?)` to accept optional deviceToken parameter
    - Server: SECURE MODE - When deviceToken provided, only associates that specific token (filters WHERE deviceToken = ?)
    - Server: Legacy fallback - When deviceToken absent, falls back to old behavior with INSECURE warnings for monitoring
    - Server: Login/register endpoints extract deviceToken from request body or X-Device-Token header
    - Client: Login/register mutations send deviceToken from localStorage in both body and headers
    - Comprehensive logging: All functions log SECURE vs INSECURE mode and track which token → which user
  - **Files**: server/auth.ts (associatePendingTokens, login/register endpoints), client/src/pages/Auth.tsx (login/register mutations)
  - **Architect Review**: ✅ PASSED - Fix prevents cross-user token leakage while maintaining backwards compatibility
  - **Status**: ✅ DEPLOYED - Device tokens now properly scoped to prevent notification privacy leaks
  - **Next Steps**: Monitor "INSECURE" warnings in logs, plan deprecation timeline for legacy fallback once all clients updated
  
- **ISSUE #3 FIXED**: Delayed Will Status Updates (3-minute delays)
  - **Root Cause**: Backend scheduler ran status transitions every 5 minutes, causing up to 5-minute delays
  - **Solution**: Changed scheduler from 5-minute intervals to 1-minute intervals for instant status updates
  - **Impact**: Maximum status update delay reduced from 5 minutes to 1 minute
  - **Files**: server/scheduler.ts (lines 24-52)
  - **Performance**: Same code path, just higher frequency - no regression expected
  - **Status**: ✅ DEPLOYED - Scheduler now logs "Heavy operations: every 1 MINUTE (instant status updates)"
  
- **ISSUE #4 FIXED**: iOS App Badge Number Never Clears
  - **Root Cause**: Badge numbers were set to 1 in every push notification, but no clearing logic existed when app opened
    - Server sets badge to 1 in pushNotificationService.ts
    - iOS shows badge on app icon
    - But badge was NEVER cleared - stayed at "1" even when user opened app
  - **Solution**: Implemented badge clearing in both iOS native and React/Capacitor layers
  - **Implementation Details**:
    - iOS Native (AppDelegate.swift): Added badge clearing in `applicationDidBecomeActive` method
      - Sets `UIApplication.shared.applicationIconBadgeNumber = 0`
      - Calls `removeAllDeliveredNotifications()` to clear notification center
    - React/Capacitor (App.tsx): Added badge clearing with proper async listener management
      - Clears badge on mount using `PushNotifications.setBadgeCount({ count: 0 })`
      - Listens for `appStateChange` events to clear badge when app becomes active
      - Uses `isMounted` flag to prevent race conditions and listener leaks (React StrictMode compatible)
  - **Files**: ios/App/App/AppDelegate.swift (applicationDidBecomeActive), client/src/App.tsx (badge clearing useEffect)
  - **Architect Review**: ✅ PASSED - Both native and JS layers clear badges reliably, no listener leaks or race conditions
  - **Status**: ✅ DEPLOYED - Badge now automatically clears to 0 when app opens
  - **Expected Behavior**: User receives notification → Badge shows "1" → User opens app → Badge clears to 0

### October 02, 2025 - Account Deletion Implementation (Apple App Store Compliance)
- **Feature Added**: Permanent account deletion functionality to comply with Apple App Store Guideline 5.1.1(v)
- **Backend Implementation**: DELETE /api/account endpoint with comprehensive cascading deletion logic
  - Deletes all user data in correct dependency order: device tokens → will-related data → wills created by user → circles owned by user (with all dependent data) → circle memberships → blog posts/page contents → sessions → user account
  - Password verification required for security
  - Handles complex dependency chains: wills created by user in any circle, circles owned by user with other members' data
- **Frontend UI**: Delete Account section in Account Settings (Security tab)
  - Clear warning messages about permanent data loss
  - Password confirmation dialog with AlertDialog component
  - Automatic redirect to auth page after successful deletion
- **Data Deletion Coverage**: Removes all traces across 9 database tables (users, circleMembers, wills, willCommitments, willAcknowledgments, dailyProgress, willPushes, deviceTokens, sessions)
- **Status**: ✅ COMPLETE - Architect-verified cascading deletion logic prevents foreign key violations and orphaned data

### September 13, 2025 - Push Notification FIXED with Direct iOS API Solution  
- **Issue Resolved**: Capacitor JavaScript bridge was broken - iOS generated device tokens but registration events never fired in JavaScript
- **Root Cause**: Bridge communication failure between iOS native code and JavaScript layer
- **SOLUTION IMPLEMENTED**: Direct iOS API calls bypass the broken bridge completely
- **Implementation**: Modified ios/App/App/AppDelegate.swift with sendTokenDirectlyToServer() method
- **Flow**: iOS token generation → Direct HTTP POST to /api/device-token → Server registration → User login association
- **Result**: Token registration now works reliably without JavaScript bridge dependency
- **Status**: ✅ PRODUCTION READY - Direct iOS API call solution successfully implemented and architect-verified
- **Confidence Level**: 9/10 for solving broken JavaScript bridge issue
- **Architecture Review**: PASS - Robust retry mechanism, proper HTTPS/ATS compliance, concurrency control
- **Deployment Status**: Ready for production with minor non-blocking improvements identified
```