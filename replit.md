# Replit.md

## Overview
This full-stack web application enables goal accountability through two primary modes: Solo Mode for personal goal tracking with review-based completion, and Inner Circle Mode for group accountability, allowing 2-4 users to define and track "wills" (goal commitments) together. Users can join up to 3 circles. The application supports daily progress tracking, structured goal lifecycles, and asynchronous will reviews to foster personal growth and consistent action.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Shadcn/ui (Radix UI), and Tailwind CSS, emphasizing a mobile-first approach optimized for single-viewport displays. Styling incorporates gradients and consistent brand colors (brandGreen, brandBlue, brandGray) with smooth micro-interactions, hover animations, and transition effects. Key interaction flows, such as the 4-step Will creation process, include progress indicators. The core branding centers around "WILL" with a hand icon.

### Technical Implementations
The frontend uses React with TypeScript, Wouter for routing, TanStack Query for server state management, and Vite for building. The backend is an Express.js application written in TypeScript, utilizing Drizzle ORM for database interactions and Passport.js for authentication, now with JWT for mobile persistence. Production builds are ESBuild-only.

Authentication features a custom email/password system, Express sessions with PostgreSQL storage, and JWT tokens for mobile with a silent refresh mechanism and client-side auto-refresh on 401 responses. The system supports multi-circle participation (up to 3 circles, max 4 members per circle) and two types of circle wills: "Normal" (individual commitments) and "Shared" (collective commitments). Real-time updates are managed via continuous polling and robust cache invalidation. Capacitor is used for iOS integration, including safe area optimization, APNs push notifications, and embedded video. State transitions incorporate Just-In-Time (JIT) checks and a background scheduler for reliability. Will completion is driven by an asynchronous Will Review system.

**Key Features:**
- **Authentication**: Email/password sign-up/sign-in, secure password changes.
- **Homepage & My Wills**: Dashboard summary, dedicated "My Wills" page with status filtering and public will visibility.
- **Mode Selection**: Choice between Solo (personal) and Inner Circle (group) accountability.
- **Solo Mode**: Personal will creation with immediate start, offering flexible tracking types: "Every Day," "Specific Days," and "Final Review Only."
- **Progress Tracking**: DailyCheckInModal, ProgressView with calendar, success rate calculation, and streak tracking.
- **Inner Circle Mode**: Multi-circle support, lobby view, circle hub, and distinct "Normal" and "Shared" will types.
- **Will Creation & Management**: Multi-step guided creation, commitment editing, and lifecycle management (Pause, Resume, Terminate).
- **Will Review**: Mandatory asynchronous review for will completion.
- **Account Settings**: User profile management and account deletion.
- **Push Notifications**: APNs integration with 12 types, per-user timezone personalization, including time-based and event-based notifications, short-duration will specific notifications, and a review escalation/auto-complete mechanism.
- **In-App Notification Badges**: Red badge system for action items like pending commitments and reviews, cleared upon action.
- **Team Encouragement**: "Push" feature to send encouragement within circles.
- **Circle Messaging**: Group chat within circles via "Messages" tab in Circle Hub. Text-only (500 char max), polling-based (10s), last 50 messages loaded. Push notifications sent to other circle members on new messages. Messages stored permanently in `circle_messages` table.

### System Design Choices
The application uses PostgreSQL (Neon serverless) with Drizzle ORM, employing environment-based database routing. API design is RESTful with JSON responses, robust error handling, and consistent UTC storage with per-user local time display. Privacy is maintained by keeping "Because" statements private and using only first names for members.

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
- **@capacitor/core**, **@capacitor/ios**: iOS mobile app development.