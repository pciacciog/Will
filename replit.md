# Replit.md

## Overview

This is a full-stack web application for group goal accountability, built with React, Express, and PostgreSQL. The app allows users to form "Inner Circles" of 2-4 people who help each other achieve meaningful goals through structured "wills" (goal commitments) and daily progress tracking. The application uses Replit's authentication system and is designed to be deployed on the Replit platform.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for development and build processes

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit's OIDC-based authentication system with Passport.js
- **Session Management**: Express sessions with PostgreSQL storage
- **API Design**: RESTful API endpoints with JSON responses

### Database Architecture
- **Database**: PostgreSQL (via Neon serverless)
- **Schema Management**: Drizzle migrations and schema definitions
- **Connection**: Connection pooling with Neon serverless driver

## Key Components

### Authentication System
- Uses Replit's OIDC authentication flow
- Session-based authentication with PostgreSQL session storage
- Mandatory user and session tables for Replit Auth compliance
- Protected routes with authentication middleware

### Inner Circle Management
- Users can create or join circles using 6-character invite codes
- Circle size limited to 2-4 members
- Each user can only be in one circle at a time

### Will (Goal) System
- Structured goal commitments with start/end dates
- Status tracking: pending, scheduled, active, completed
- Individual member commitments within shared goals
- Progress acknowledgment and tracking features

### Daily Progress Tracking
- Members can log daily progress on active goals
- Progress sharing and accountability features
- Timeline-based progress visualization

## Data Flow

1. **Authentication Flow**: User authenticates via Replit OAuth → Session created in PostgreSQL → User data stored/updated
2. **Circle Creation**: User creates circle → Generates unique invite code → Other users join via code
3. **Goal Setting**: Circle member creates "will" → Other members add commitments → Goal becomes active based on schedule
4. **Progress Tracking**: Members log daily progress → Progress shared with circle → Acknowledgments and support provided

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Database ORM and query builder
- **express**: Web server framework
- **passport**: Authentication middleware
- **openid-client**: OAuth/OIDC client implementation
- **@tanstack/react-query**: Client-side state management
- **@radix-ui/**: UI component primitives
- **tailwindcss**: CSS framework

### Development Dependencies
- **vite**: Build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling

## Deployment Strategy

- **Platform**: Replit with autoscale deployment
- **Build Process**: Vite builds client assets, esbuild bundles server
- **Environment**: Node.js 20 with PostgreSQL 16
- **Port Configuration**: Internal port 5000, external port 80
- **Asset Serving**: Static files served from dist/public in production

## Recent Changes
- **June 25, 2025**: Fixed authentication system and API endpoints
  - Resolved all authentication errors caused by user object structure mismatch
  - Fixed `/api/logout` endpoint routing and functionality
  - Corrected user ID references from `req.user.claims.sub` to `req.user.id`
  - Improved session management and passport deserialization
  - Registration and login now working correctly with proper error handling
- **June 25, 2025**: Complete admin dashboard implementation at `/webadmin` route
  - Added comprehensive user management (role updates, activate/deactivate)
  - Added circle and will monitoring with deletion capabilities  
  - Added blog post management system with full CRUD operations
  - Added page content management for static site content
  - Implemented admin middleware with role-based access control
  - Extended database schema with blog_posts and page_contents tables
  - Added admin statistics dashboard with platform metrics
- **June 25, 2025**: Enhanced authentication flow
  - Added dedicated authentication page at `/auth` route
  - Updated landing page to redirect to auth page instead of direct login
  - Improved user onboarding experience with feature preview
- **June 25, 2025**: Improved will commitment submission flow
  - Fixed Will Details page routing and status display issues
  - Implemented 2-step guided commitment flow at `/will/:id/commit` route
  - Separated commitment submission from Will Details view for better UX
  - Added consistent flow for both initiators and members joining existing wills
  - Enhanced real-time status updates and progress tracking
- **June 25, 2025**: Implemented role-based permissions system
  - Circle level: All members are equal, no owner role or special privileges
  - Will level: Only creators can edit/delete will structure (dates, deletion)
  - Commitment level: Users can only edit their own commitments while will is pending
  - Added Edit Commitment page at `/will/:id/edit-commitment/:commitmentId` route
  - Added edit buttons for user's own commitments in Will Details view
  - Proper authorization checks for all modification operations
- **June 25, 2025**: Enhanced acknowledgment system and time displays
  - Fixed acknowledgment blocking: New wills cannot be created until all members acknowledge completion
  - Added real-time counter updates (5-second polling) for acknowledgment status
  - Refined time display: Shows minutes when less than 1 hour remaining for active wills
  - Creators can now delete active wills (but not completed ones)
  - Removed "Mark Done Today" button for active wills
  - Improved server-side status transitions with automatic updates
  - Added acknowledgment counter display to WillDetails page with real-time updates
  - Fixed toast import error in InnerCircleHub component
  - Added informational notes about acknowledgment requirements before new Will creation
  - Fixed acknowledgment system transition to properly archive completed wills when all members acknowledge
  - Made Inner Circle intro message dynamic based on member count for more personal language
- **June 26, 2025**: Enhanced privacy and user experience for commitments
  - Made "Because" statements private - only visible to the user who submitted them
  - Added visual highlighting for user's own commitment with blue background and "You" badge
  - Implemented collapsible "Why?" toggle button for user's own reason with lightbulb icon
  - Fixed toast import error in InnerCircleHub component for invite code copying
- **June 26, 2025**: Implemented Prescribed Weekly Will scheduling mode
  - Added dual scheduling options: Prescribed Weekly Will vs Custom Will in StartWill component
  - Prescribed Weekly Will automatically sets Monday 12:00 AM to Sunday 12:00 PM cycle
  - Smart date calculation: next upcoming Monday start based on current day/time
  - Enhanced Will creation flow with radio button selection and live preview of weekly schedule
  - Maintains existing Custom Will functionality for flexible date/time selection
  - Fixed React hooks violations in WillDetails component that prevented page from loading
  - Moved useState from inside map function to component level with proper state management

## Changelog
- June 25, 2025. Initial setup
- June 25, 2025. Admin dashboard completed with full platform management

## User Preferences

Preferred communication style: Simple, everyday language.

## Role and Permission Rules
- **Circle Level**: All members are equal, no special "owner" role or privileges for circle creator
- **Will Level**: Only the will creator can edit start/end dates or delete the will
- **Commitment Level**: Each user can only edit their own commitment ("I will..." and "Because...")
- **Status Restrictions**: Wills and commitments can only be modified while status is "pending"