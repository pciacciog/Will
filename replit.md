# Replit.md

## Overview
This is a full-stack web application designed for group goal accountability. Users form "Inner Circles" (2-4 people) to define and track progress on "wills" (goal commitments). The application supports daily progress tracking, mutual accountability, and a structured goal lifecycle. Its purpose is to facilitate personal growth through shared commitment and consistent action within a supportive community.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 22, 2025: End Room Countdown for Will Review Status
- **UX Enhancement**: Added End Room countdown display for users waiting during `will_review` status
  - **Problem**: Users who submitted reviews early were stuck waiting hours (e.g., 3.5 hours from 6 PM to 9:30 PM) with no indication they needed to return for the End Room
  - **Solution**: Blue countdown card appears after user submits review, showing live timer and clear messaging
- **Backend API Enhancement**: Expanded `/api/wills/:id/review-status` endpoint response
  - Now returns: `hasReviewed`, `needsReview`, `reviewCount`, `totalMembers`
  - Complete data contract for frontend review flow and countdown display
  - Note: Currently uses 3 storage calls (optimization opportunity for future)
- **Frontend Implementation**: 
  - Query enabling logic fixed - now enables immediately when `id` and `user` exist (no timing gap)
  - Smart polling - only polls at 5-second intervals during `will_review` or `completed` status
  - Loading states added - shows spinner while review status loads
  - Countdown card displays: Video icon, "End Room Coming Up" title, live countdown timer, explanatory text
- **User Experience Flow**:
  1. Will ends (status → `will_review`)
  2. User submits review
  3. **NEW**: Countdown card appears showing time until End Room
  4. User understands they need to return for End Room
  5. End Room completes → Will transitions to `completed`
- **Files Modified**:
  - `server/routes.ts` (enhanced review-status endpoint)
  - `client/src/pages/WillDetails.tsx` (countdown UI + query logic)

### November 22, 2025: Will Review System - Asynchronous Completion Flow
- **Major Feature**: Replaced mandatory End Room video ceremonies with lightweight asynchronous Will Review system
  - **Motivation**: Poor End Room attendance (video call coordination difficult)
  - **Solution**: Optional End Room + mandatory Will Review for completion
- **Database Schema**: Added `will_reviews` table
  - Columns: id, willId, userId, followThrough (yes/no/partial), reflection (text, 200 chars), shareWithCircle (boolean)
  - Unique constraint on (willId, userId) to prevent duplicate reviews
- **Backend Implementation**: Three new API endpoints
  - `POST /api/wills/:id/review` - Submit individual review (circle member authorization)
  - `GET /api/wills/:id/reviews` - Fetch all submitted reviews for a Will (circle member authorization)
  - `GET /api/wills/:id/review-status` - Check review status (hasUserReviewed, needsReview, progress count)
- **State Machine Updates**: New `will_review` status + redundant completion paths
  - `active` → `will_review` (when endDate passes, triggered by scheduler + JIT)
  - `will_review` → `completed` when **EITHER**: (a) all members submit reviews OR (b) all members acknowledge (prevents deadlock)
  - Scheduler checks both paths every minute to ensure timely transitions
- **Frontend Components**:
  - `WillReviewFlow.tsx` - 3-step form (Acknowledge → Reflect → Share) using shadcn Form + useForm + zodResolver
  - Circle Hub: Shows "Review" button for will_review state
  - Will Details: Conditionally renders review flow (if user hasn't reviewed) or submitted reviews display
  - Loading states, empty states, and progress indicators for all review-related UI
- **Query Strategy**: 
  - 5-second polling for will_review state to ensure real-time UI updates
  - Proper query invalidation after mutations (`/api/wills`, `/api/wills/:id/reviews`, `/api/wills/:id/review-status`)
  - Review-status query enabled for both will_review AND completed states to prevent stale UI
- **Will Creation Flow**:
  - End Room scheduling remains a required step during Will creation (Step 4)
  - Users must schedule an End Room date/time before creating the Will
  - The scheduled End Room is NOT mandatory to attend - actual attendance is naturally optional
  - Will Review (mandatory reflection) happens when the Will ends, regardless of End Room attendance
- **Architecture Decisions**:
  - Will Review is now the **primary** completion mechanism
  - End Room remains available for circles who want synchronous video reflection
  - Reflections are private by default, shared only if user opts in
  - Follow-through is self-reported (yes/no/partial) with optional reflection
- **Files Modified**: 
  - `shared/schema.ts` (will_reviews table, will_review status)
  - `server/routes.ts` (3 new endpoints)
  - `server/scheduler.ts` (redundant completion logic)
  - `client/src/components/WillReviewFlow.tsx` (new component)
  - `client/src/pages/WillDetails.tsx` (review UI integration)
  - `client/src/pages/InnerCircleHub.tsx` (review button)
  - `client/src/pages/StartWill.tsx` (optional End Room)

### November 22, 2025: Critical Timezone Bug Fixed + JIT State Transitions
- **Critical Discovery**: Background scheduler does NOT run 24/7 in Replit development environment
  - Dev servers restart frequently (every few minutes when workspace is reopened)
  - Scheduler logs only show activity from current session (no historical logs from 11/19-11/21)
  - This explained why Will #4 showed "Active" on 11/21 despite ending on 11/19
- **Solution Implemented**: Just-In-Time (JIT) state checks in GET endpoints
  - `/api/wills/circle/:circleId` now transitions Will status on every request
  - `/api/wills/:id/details` now transitions Will status on every request
  - State transitions happen immediately when data is requested, regardless of scheduler
  - Works correctly even if scheduler hasn't run (dev restarts, deployment sleep, etc.)
- **Logging Added**: `[JIT]` prefix shows when endpoints perform state transitions
- **Architecture**: Scheduler still runs as backup, but JIT checks are primary reliability mechanism
- **Bug Fixed #1**: User ID type mismatch in acknowledgment logic (string vs number comparison)
  - Changed `currentUserId` from `number` to `string` in FinalWillSummary component
  - Now correctly identifies participating users for acknowledgment button display
- **Bug Fixed #2**: 5-hour timezone discrepancy in push notifications (PROPER FIX IMPLEMENTED)
  - **Root cause**: Server formatting UTC times with `.toLocaleTimeString()` which showed "10:00 PM" for 22:00 UTC instead of "5:00 PM" EST
  - **Solution**: Implemented per-user timezone system
  - **Database Schema**: Added `timezone` column to users table (default: "America/New_York")
  - **Timezone Detection**: Browser automatically detects and sends timezone during signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - **Per-User Formatting**: Scheduler now formats notifications individually per user using their stored timezone
  - **Example**: Michigan user (America/Detroit) sees "5:00 PM", California user (America/Los_Angeles) sees "2:00 PM" for same End Room
  - **Architecture**: Store UTC → Compare UTC → Display in user's timezone (golden rule)
  - Files modified: 
    - `shared/schema.ts` (added timezone column)
    - `client/src/pages/Auth.tsx` (timezone detection on signup)
    - `server/auth.ts` (timezone storage in registration)
    - `server/scheduler.ts` (per-user notification formatting)
    - `server/pushNotificationService.ts` (restored time display in notification body)

### November 10, 2025: Staging Database Environment Setup
- **Added**: Environment-aware database connection system
  - Database selection based on `NODE_ENV` environment variable
  - Support for separate staging database via `DATABASE_URL_STAGING` secret
  - Console logging to indicate which database is active
- **New Scripts**:
  - `npm run dev:staging` - Run application in staging mode
  - `npm run db:push:staging` - Push schema to staging database
  - `npm run seed:staging` - Seed staging database with test data
- **Test Data**: Staging seed script creates:
  - 3 test users (test1@staging.com, test2@staging.com, test3@staging.com)
  - 1 test circle with invite code TEST01
  - 3 sample wills (active, pending, scheduled)
  - Sample commitments for testing
- **Files Modified**: 
  - `server/db.ts` - Database connection logic
  - `package.json` - New staging scripts
  - `server/seed-staging.ts` - New staging seed script
  - `STAGING-SETUP.md` - Complete setup documentation

### November 7, 2025: Will Creation "When" Screen Redesign
- **Removed**: Template selection UI ("Week Template" vs "Custom")
- **Added**: Direct date/time pickers with smart defaults:
  - Start date/time: Next Monday at 12:00 AM (or current Monday if today)
  - End date/time: Following Sunday at 12:00 PM
  - Daily reminder: Optional toggle with time picker (frontend only, backend TODO)
- **Implementation**:
  - Controlled inputs with memoized state initialization to prevent re-render data loss
  - Local timezone date calculations (YYYY-MM-DD format) to avoid ISO conversion issues
  - Smart Monday logic: Returns current Monday on Mondays, next Monday on other days
  - Validation ensures start date is in the future
- **Files Modified**: `client/src/pages/StartWill.tsx`

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript, utilizing Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with custom design tokens.
- **Color Schemes**: Thoughtful use of gradients (emerald/teal, blue/indigo, purple) and consistent brand colors (brandGreen, brandBlue, brandGray).
- **Layout**: Mobile-first design, optimized for single-viewport display on iPhone screens.
- **Interaction**: Features smooth micro-interactions like hover animations and transition effects.
- **Information Flow**: Structured commitment and End Room flows (When → What → Why → End Room) with clear progress indicators and instructional modals.
- **Branding**: Employs "WILL" as core branding with a hand icon.

### Technical Implementations
- **Frontend**: React (TypeScript), Wouter for routing, TanStack Query for server state management, Vite for building.
- **Backend**: Express.js (TypeScript), Drizzle ORM, Passport.js for authentication. Uses a standalone server architecture.
- **Build Process**: ESBuild-only production builds for deployment compatibility.
- **Authentication**: Custom email/password system, managed via Express sessions with PostgreSQL storage. Now uses JWT for mobile persistence.
- **Will System**: Structured goal commitments with status tracking and individual member commitments.
- **Circle Management**: Invite codes, strict member limits (2-4), single-circle membership.
- **Real-time Updates**: Continuous polling and robust cache invalidation for immediate UI feedback.
- **Mobile Integration**: Implemented with Capacitor for iOS, including safe area optimization, APNs push notifications, and embedded video room support.

### Feature Specifications
- **Authentication**: Email and password-based sign-up/sign-in, secure password changes.
- **Circle Management**: Create/join circles, display member list (first names only).
- **Will Creation & Management**: Multi-step guided creation, editing of personal commitments, role-based permissions.
- **Progress Tracking**: Daily logging, progress acknowledgment, and timeline visualization.
- **End Room**: Scheduled video calls (Daily.co integration) for reflection and closure.
- **Account Settings**: User profile, password change, leave circle, permanent account deletion (Apple App Store Guideline 5.1.1(v) compliant).
- **Push Notifications**: Complete APNs integration for Will status changes, End Room timings, etc. Includes server-side `node-apn` and client-side auto-registration.
- **Team Encouragement**: "Push" feature to send encouragement to circle members.

### System Design Choices
- **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM.
  - Environment-based database routing (development, staging, production)
  - Schema push system (Drizzle Kit) instead of traditional migrations
- **API Design**: RESTful API endpoints with JSON responses.
- **Error Handling**: Comprehensive error handling and redirect logic.
- **Timezone Handling**: Consistent UTC storage with local time display.
- **Privacy**: "Because" statements are private, and member names are first names only.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection.
- **drizzle-orm**: Database ORM and query builder.
- **express**: Web server framework.
- **passport**: Authentication middleware.
- **@tanstack/react-query**: Client-side state management.
- **@radix-ui/**: UI component primitives.
- **tailwindcss**: CSS framework.
- **Daily.co**: Video conferencing API.
- **node-apn**: Apple Push Notification service integration.
- **@capacitor/core**, **@capacitor/ios**: iOS mobile app development and native features.