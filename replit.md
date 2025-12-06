# Replit.md

## Overview
This full-stack web application facilitates goal accountability through two modes:
1. **Solo Mode**: Personal accountability without circle coordination - immediate-start personal goals with simple review-based completion
2. **Inner Circle Mode**: Group accountability with 2-6 users defining and tracking "wills" (goal commitments) together

Both modes support daily progress tracking, Will commitments with reviews, and structured goal lifecycles to foster personal growth via consistent action.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript, Shadcn/ui (Radix UI), Tailwind CSS.
- **Styling**: Gradients (emerald/teal, blue/indigo, purple), consistent brand colors (brandGreen, brandBlue, brandGray).
- **Layout**: Mobile-first, optimized for single-viewport display (iPhone screens).
- **Interaction**: Smooth micro-interactions, hover animations, transition effects.
- **Information Flow**: Structured commitment and End Room flows (When → What → Why → End Room) with progress indicators and instructional modals.
- **Branding**: "WILL" as core branding with a hand icon.

### Technical Implementations
- **Frontend**: React (TypeScript), Wouter for routing, TanStack Query for server state management, Vite for building.
- **Backend**: Express.js (TypeScript), Drizzle ORM, Passport.js for authentication (now with JWT for mobile persistence).
- **Build Process**: ESBuild-only production builds.
- **Authentication**: Custom email/password system, Express sessions with PostgreSQL storage.
- **Will System**: Structured goal commitments with status tracking and individual member commitments.
- **Circle Management**: Invite codes, member limits (2-6), single-circle membership.
- **Real-time Updates**: Continuous polling and robust cache invalidation.
- **Mobile Integration**: Capacitor for iOS (safe area optimization, APNs push notifications, embedded video).
- **State Transitions**: Just-In-Time (JIT) state checks in GET endpoints for reliability in addition to a background scheduler.
- **Will Review System**: Asynchronous Will Review system (with `will_reviews` table) replaces mandatory video ceremonies as the primary completion mechanism. Will completion now requires all members to submit reviews and the End Room to be finished.

### Feature Specifications
- **Authentication**: Email/password sign-up/sign-in, secure password changes.
- **Mode Selection**: Users choose between Solo Mode (personal goals) or Inner Circle Mode (group accountability).
- **Solo Mode**: 
  - Personal Will creation without circle coordination
  - Immediate start (no waiting for others)
  - 3-step flow: When → What → Why (no End Room)
  - Single-user review for completion
  - Route: `/solo/hub`, `/solo/start-will`
- **Inner Circle Mode**:
  - Circle Management: Create/join circles, display member list
  - **Will Types** (Circle sub-types):
    - **Classic**: Each member defines their own personal commitment ("I Will")
    - **Cumulative**: Creator defines a shared commitment for the entire circle ("We Will") - all members commit to the same goal
  - 4-step Will flow: Type Selection → When → What → Why → End Room (optional)
  - Team coordination with mutual accountability
  - Database fields: `willType` ('classic' or 'cumulative'), `sharedWhat` (stores team commitment for cumulative wills)
- **Will Creation & Management**: Multi-step guided creation, commitment editing, role-based permissions.
- **Progress Tracking**: Daily logging, progress acknowledgment, timeline visualization.
- **End Room**: Scheduled video calls (Daily.co) for reflection and closure (circle mode only, optional).
- **Will Review**: Mandatory asynchronous review for Will completion.
- **Account Settings**: User profile, password change, leave circle, permanent account deletion.
- **Push Notifications**: APNs integration with 12 notification types, personalized per-user timezone.
  - **Time-based (scheduler-driven)**: will_started (Will starts), will_review_required (Will ends), will_review_reminder (6hrs after Will ends), midpoint_milestone (50% through), commitment_reminder (6hrs after Will created), end_room_30min_warning (24hrs before), end_room_15min_warning (15min before), end_room_now (End Room opens)
  - **Event-based**: will_proposed (Will created), circle_member_joined (member joins), team_push_encouragement (Push tapped), member_review_submitted (review submitted)
  - **Mode coverage**: Solo mode receives will_started, will_review_required, will_review_reminder, midpoint_milestone; Circle mode receives all notifications
  - **Idempotency**: Database tracking fields (completionNotificationSentAt, midpointAt, midpointNotificationSentAt on wills; ackReminderSentAt on will_commitments; commitmentReminders table) prevent duplicate sends.
  - **Token Cleanup**: Invalid APNs tokens (410/400/403 errors) automatically marked inactive to prevent wasted API calls.
  - **Performance**: 14 database indexes optimize scheduler queries for scale (wills, will_commitments, commitment_reminders, device_tokens tables).
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