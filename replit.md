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
- **Account Settings**: User profile (read-only name/email), password change, leave circle functionality.
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
```