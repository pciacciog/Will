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
- **June 25, 2025**: Complete admin dashboard implementation at `/webadmin` route
  - Added comprehensive user management (role updates, activate/deactivate)
  - Added circle and will monitoring with deletion capabilities  
  - Added blog post management system with full CRUD operations
  - Added page content management for static site content
  - Implemented admin middleware with role-based access control
  - Extended database schema with blog_posts and page_contents tables
  - Added admin statistics dashboard with platform metrics

## Changelog
- June 25, 2025. Initial setup
- June 25, 2025. Admin dashboard completed with full platform management

## User Preferences

Preferred communication style: Simple, everyday language.