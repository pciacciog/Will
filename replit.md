# Replit.md

## Overview
This full-stack web application facilitates goal accountability through two modes:
1. **Solo Mode**: Personal accountability without circle coordination - immediate-start personal goals with simple review-based completion
2. **Inner Circle Mode**: Group accountability with 2-4 users per circle defining and tracking "wills" (goal commitments) together. Users can join up to 3 circles simultaneously.

Both modes support daily progress tracking, Will commitments with reviews, and structured goal lifecycles to foster personal growth via consistent action.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript, Shadcn/ui (Radix UI), Tailwind CSS.
- **Styling**: Gradients (emerald/teal, blue/indigo, purple), consistent brand colors (brandGreen, brandBlue, brandGray).
- **Layout**: Mobile-first, optimized for single-viewport display (iPhone screens).
- **Interaction**: Smooth micro-interactions, hover animations, transition effects.
- **Information Flow**: 4-step Will creation flow (What → Why → When → Check-In) with progress indicators. End Room behind feature flag (step 5 when enabled). TimeChipPicker uses native `<input type="time">` for iOS compatibility.
- **Branding**: "WILL" as core branding with a hand icon.

### Technical Implementations
- **Frontend**: React (TypeScript), Wouter for routing, TanStack Query for server state management, Vite for building.
- **Backend**: Express.js (TypeScript), Drizzle ORM, Passport.js for authentication (now with JWT for mobile persistence).
- **Build Process**: ESBuild-only production builds.
- **Authentication**: Custom email/password system, Express sessions with PostgreSQL storage (30-day cookie). JWT tokens for mobile persistence (365-day expiry) with silent refresh endpoint (`/api/auth/refresh`) and 30-day grace period for expired tokens. Client-side auto-refresh on 401 responses and proactive refresh when token is within 7 days of expiry.
- **Will System**: Structured goal commitments with status tracking and individual member commitments.
- **Multi-Circle System**: Users can join up to 3 circles simultaneously (max 4 members per circle). "My Circles" lobby at `/circles` lists all circles, circle hub at `/circles/:circleId` shows specific circle.
- **Real-time Updates**: Continuous polling and robust cache invalidation.
- **Mobile Integration**: Capacitor for iOS (safe area optimization, APNs push notifications, embedded video).
- **State Transitions**: Just-In-Time (JIT) state checks in GET endpoints for reliability in addition to a background scheduler.
- **Will Review System**: Asynchronous Will Review system (with `will_reviews` table) replaces mandatory video ceremonies as the primary completion mechanism. Will completion now requires all members to submit reviews and the End Room to be finished.

### Feature Specifications
- **Authentication**: Email/password sign-up/sign-in, secure password changes.
- **Homepage**: Clean summary dashboard with "Create a Will" CTA, active wills summary card (count + Solo/Circle/Review breakdown), Explore and Circles navigation cards. Full will list moved to dedicated "My Wills" page.
- **My Wills Page** (`/wills`): Dedicated page with tabs (All/Solo/Circle/Public) showing full WillCard list with status badges, duration labels, and tap-to-view navigation. Public wills (created or joined) show blue Globe icon and "Public" badge. Back button returns to homepage.
- **Mode Selection**: Users choose between Solo Mode (personal goals) or Inner Circle Mode (group accountability).
- **Solo Mode**: 
  - Personal Will creation without circle coordination
  - Immediate start (no waiting for others)
  - 5-step flow: When → What → Why → Tracking Type → Confirm
  - **Tracking Type Options**:
    - **Daily**: Daily check-ins with yes/no/partial status, calendar view, success rate tracking
    - **One-time**: Simple review at the end (default)
  - Single-user review for completion
  - Route: `/solo/hub`, `/solo/start-will`
- **Progress Tracking** (for daily check-in wills):
  - DailyCheckInModal: Select date, choose status (yes/no/partial), add optional notes
  - ProgressView: Calendar with color-coded days, success rate display, streak tracking
  - Check-in data stored in `will_check_ins` table
  - Success rate calculated as (yes + 0.5×partial) / total_days
- **Inner Circle Mode**:
  - **Multi-Circle**: Users can belong to up to 3 circles simultaneously (max 4 members each)
  - **My Circles Lobby**: `/circles` route shows all circles user belongs to with cards and create/join options
  - **Circle Hub**: `/circles/:circleId` route shows specific circle's Will status and members
  - Circle Management: Create/join circles with invite codes, display member list, leave circle
  - **Will Types** (Circle sub-types):
    - **Normal**: Each member defines their own personal commitment ("I Will")
    - **Shared**: Creator defines a shared commitment for the entire circle ("We Will") - all members commit to the same goal
  - 4-step Will flow: Type Selection → When → What → Why → End Room (optional)
  - Team coordination with mutual accountability
  - Database fields: `willType` ('classic' or 'cumulative'), `sharedWhat` (stores team commitment for cumulative wills)
  - Routes: `/circles` (lobby), `/circles/:circleId` (hub), `/start-will` (will creation)
- **Will Creation & Management**: Multi-step guided creation, commitment editing, role-based permissions.
- **Recipient Commitment Flow** (SubmitCommitment.tsx):
  - Classic wills: Timeline → What → Why → [Check-In Time] → [Confirm] (5 internal steps, ladder shows 3: When/What/Why)
  - Cumulative/Shared wills: Timeline → Why → [Check-In Time] → [Confirm] (4 internal steps, ladder shows 2: When/Why)
  - Each recipient sets their own check-in time (stored per-commitment in `will_commitments.check_in_time`)
  - "One last step..." transition appears after check-in time, before confirm
  - Confirm page shows check-in time instead of daily reminder
  - Ladder visibility rule: Only core decision steps shown (What, Why, When); utility steps (Check-in, Loading, Confirm) hidden from ladder
- **Indefinite Duration Wills**: Users can create ongoing wills without end dates (isIndefinite=true, endDate=null). UI shows "Ongoing" instead of end date.
- **Will Lifecycle Management**: 
  - **Pause**: Temporarily stop tracking an active will (sets pausedAt, status='paused')
  - **Resume**: Continue a paused will (clears pausedAt, status='active')
  - **Terminate**: Permanently end a will (status='terminated'), preserves progress history
  - API endpoints: `/api/wills/:id/pause`, `/api/wills/:id/resume`, `/api/wills/:id/terminate`
- **Progress Tracking**: Daily logging, progress acknowledgment, timeline visualization.
- **End Room**: Scheduled video calls (Daily.co) for reflection and closure (circle mode only, optional).
- **Will Review**: Mandatory asynchronous review for Will completion.
- **Account Settings**: User profile, password change, leave circle, permanent account deletion.
- **Push Notifications**: APNs integration with 12 notification types, personalized per-user timezone.
  - **Time-based (scheduler-driven)**: will_started (Will starts), will_review_required (Will ends), will_review_reminder (6hrs after Will ends), midpoint_milestone (50% through), commitment_reminder (6hrs after Will created), end_room_30min_warning (24hrs before), end_room_15min_warning (15min before), end_room_now (End Room opens)
  - **Event-based**: will_proposed (Will created), circle_member_joined (member joins), team_push_encouragement (Push tapped), member_review_submitted (review submitted)
  - **Short-Duration Will Notifications** (<=24 hours): Three essential notifications — (1) Check-in "Have you honored your will today?" at random time within active window, (2) Motivational "because" statement at different random time, (3) "Your will has ended. Please review..." when will expires. Uses seed-based deterministic random times with collision avoidance (15-min offset, clamped to will window).
  - **Daily Reminder Enhancement**: Daily check-in notifications display "Have you honored your will today?" prompt. Motivational notifications show the user's personal "why" statement with a heart emoji title. Long statements are truncated to 110 characters for iOS lock screen.
  - **Mode coverage**: Solo mode receives will_started, will_review_required, will_review_reminder, midpoint_milestone; Circle mode receives all notifications
  - **Per-Commitment Notification Independence**: Each commitment (user+will pair) fires check-in and motivational notifications independently. Dedup tracking via `lastCheckInReminderSentAt` and `lastMotivationalSentAt` on `will_commitments` table — not per-user or per-will. Users with multiple active wills receive all appropriate notifications. Circle members on shared wills each get their own notifications at their own times.
  - **Scheduler Architecture**: Two approaches — (1) Commitments with explicit check-in times (will.reminderTime or commitment.checkInTime), (2) Short-duration wills (≤24hr) with random timing. Motivational notifications use `getDailyRandomHourForWill()` with will-specific seeds for varied timing across wills.
  - **Idempotency**: Database tracking fields (completionNotificationSentAt, midpointAt, midpointNotificationSentAt on wills; ackReminderSentAt, lastCheckInReminderSentAt, lastMotivationalSentAt on will_commitments; commitmentReminders table) prevent duplicate sends.
  - **Token Cleanup**: Invalid APNs tokens (410/400/403 errors) automatically marked inactive to prevent wasted API calls.
  - **Performance**: 14 database indexes optimize scheduler queries for scale (wills, will_commitments, commitment_reminders, device_tokens tables).
- **In-App Notification Badges**: Red badge system that surfaces action items inside the app (complements push notifications).
  - **Notification types**: `will_proposed` (circle Will needs your commitment), `review_required` (Will ended, submit your review)
  - **Badge placement**: Red count badge on Circles card (homepage), individual circle cards (lobby)
  - **Auto-dismiss**: Badges clear when user taps into a circle (lobby) or completes the action (submits commitment/review)
  - **Duplicate prevention**: Only one active notification per user per type per Will
  - **Polling**: Frontend polls every 30 seconds for unread notifications
  - **Database**: `user_notifications` table with indexes on (userId, isRead) and (userId, type, willId)
  - **API**: `GET /api/notifications` (unread list + count), `PATCH /api/notifications/:id/read`
- **Team Encouragement**: "Push" feature to send encouragement (circle mode only).

### System Design Choices
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
  - Environment-based database routing (development, staging, production).
  - Drizzle Kit for schema management.
- **API Design**: RESTful API endpoints with JSON responses.
- **Error Handling**: Comprehensive error handling and redirect logic.
- **Timezone Handling**: Consistent UTC storage with per-user local time display.
- **Privacy**: "Because" statements are private, member names are first names only.

### Environment Configuration (server/config/environment.ts)
The application automatically detects and configures for staging vs production based on environment variables:

**Environment Detection:**
- `APP_ENV=production` or `NODE_ENV=production` → Production mode
- Otherwise → Staging mode (default)

**Database URLs:**
- Production: Uses `DATABASE_URL` or `DATABASE_URL_PRODUCTION`
- Staging: Uses `DATABASE_URL_STAGING` (or falls back to `DATABASE_URL`)

**CORS Origins:**
- Production: Reads from `PRODUCTION_DOMAIN` or `REPLIT_DEV_DOMAIN`
- Staging: Uses `will-staging-porfirioaciacci.replit.app`

**Production Deployment Checklist:**
1. Set `APP_ENV=production` in environment variables
2. Set `NODE_ENV=production`
3. Set `APNS_PRODUCTION=true` for production APNs
4. Configure `DATABASE_URL` (production database)
5. Set unique `JWT_SECRET` and `SESSION_SECRET`
6. Optionally set `PRODUCTION_DOMAIN` for CORS

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