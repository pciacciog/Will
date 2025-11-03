# Replit.md

## Overview
This is a full-stack web application designed for group goal accountability. Users form "Inner Circles" (2-4 people) to define and track progress on "wills" (goal commitments). The application supports daily progress tracking, mutual accountability, and a structured goal lifecycle. Its purpose is to facilitate personal growth through shared commitment and consistent action within a supportive community.

## User Preferences
Preferred communication style: Simple, everyday language.

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