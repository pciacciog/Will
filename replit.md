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
- **June 26, 2025**: Completely removed usernames from authentication system
  - Switched to email + password only authentication for both sign-in and sign-up
  - Updated sign-up form to collect First Name, Last Name, Email, and Password fields
  - Updated sign-in form to use Email and Password only
  - Migrated all existing user accounts to have proper first and last names
  - Removed username column from database schema completely
  - Updated all user display logic to show "First Last" format instead of usernames
  - Authentication now uses email field as the username field for Passport.js LocalStrategy
- **June 26, 2025**: Updated landing page with simplified action-driven messaging
  - Replaced "Inner Circle / Shared Commitment / Real Progress" section with streamlined content
  - New simplified cards: "Build Your Inner Circle", "Create Your Will", "Go to Work" 
  - Used bold headers with brief subheadlines for clearer user flow
  - Maintained "A space to grow with your people" section title
  - Updated both Landing.tsx (unauthenticated) and Home.tsx (authenticated) pages
- **June 26, 2025**: Simplified "Set Your Timeline" page interface and styling
  - Changed section title from "Choose Your Scheduling Mode" to "Choose Your Schedule"
  - Updated scheduling option cards: "Week Template" and "Custom" with concise descriptions
  - Replaced green celebratory styling in schedule summary with subtle grey informational styling
  - Changed "Your Weekly Schedule" to "Selected Schedule" with informative rather than confirmatory tone
  - Removed green checkmark icon and background to avoid suggesting finality before submission
- **June 26, 2025**: Enhanced UX and softened language across commitment flow screens
  - Updated progress indicator: "Dates" → "When" to match When→What→Why flow
  - Removed "Pro Tip" sections from custom scheduling and commitment steps
  - Step 2 "What Will You Do?" updates: Changed header to "What would you like to do?" with "Cause it's as simple as wanting" subtext
  - Updated input label from "Your Commitment" to "Your Want" with new placeholder "call my grandmother this week"
  - Added 50-character limit to commitment input and removed tip styling for visual consistency
  - Step 3 "Why Does This Matter?" updates: Changed header to "Why would you like to do this?" with "Remember this when it gets tough" subtext
  - Added "Because" prefix to motivation input with new placeholder "because I like how I feel after I talk to her"
  - Added 50-character limit to motivation input and removed "Dig deep" tip section
- **June 26, 2025**: Enhanced input field experience with dynamic character counting
  - Added real-time character counters showing "X / 50" format that update with each keystroke
  - Fixed placeholder text in "Why" field from "because I like..." to "I like..." (removed redundant "because")
  - Implemented controlled input components with proper state management for character tracking
  - Ensured seamless text styling consistency between fixed prefixes and user input text
- **June 26, 2025**: Updated page titles and member display preferences
  - Changed Home page title from "Welcome to Your Growth Journey" to "Welcome" with no subtext
  - Removed "A space to grow with your people" section completely from Home page for cleaner design
  - Updated Inner Circle Hub to display member names as first names only (removed last names for privacy/simplicity)
  - Added motivational tagline "Become More — Together" to Inner Circle Hub header with italic and letter-spaced styling
  - Updated Auth page with simplified messaging: "Connect with the people who matter. Grow together." and concise feature descriptions
- **June 28, 2025**: Implemented comprehensive Account Settings and user management functionality
  - Added subtle user dropdown menu in Inner Circle Hub top-right corner with full name display
  - Created functional Account Settings modal with Profile Info (read-only name/email) and Security sections
  - Implemented secure password change functionality with current/new/confirm validation and 6-character minimum
  - Added Leave Circle option with confirmation dialog and safety checks for active wills
  - Added Sign Out functionality with proper session termination
  - Created backend API endpoints: `/api/change-password` and `/api/circles/leave` with authentication
  - Extended database storage with `updateUserPassword` and `removeCircleMember` methods
- **June 28, 2025**: Enhanced Will Details page with simplified Proposed Timeline section
  - Added "Proposed Timeline" section for pending wills to show proposed dates before approval
  - Displays clean Start/End date format with full weekday, date, and time information
  - Simplified layout removes redundant timeline summary while keeping essential scheduling details
  - Positioned above member commitments for better information flow during pending phase
- **June 28, 2025**: Implemented simple admin panel for internal testing
  - Added admin rights to pcguzman2000@hotmail.com user in database
  - Created Admin Panel link in user dropdown menu (only visible to admin users)
  - Added protected /admin route with access control (non-admins see "Access Denied")
  - Created simple JSON endpoints: /admin/users (all users) and /admin/wills (active wills only)
  - Minimal styling approach for internal testing and data inspection purposes
- **June 28, 2025**: Fixed acknowledgment logic for WILL completion
  - Changed acknowledgment requirements from all circle members to only committed members who participated
  - Only users who submitted commitments are now prompted to acknowledge completion
  - Fixed backend validation to prevent non-participants from acknowledging
  - Updated frontend displays to show "committed members" instead of "all members"
  - Fixed archival logic to use commitment count instead of total member count
  - Unified commitment submission UI between will creators and members joining existing wills with identical styling, icons, labels, and character limits
- **June 28, 2025**: Completed comprehensive "WILL" capitalization across entire application
  - Updated all user-facing text, buttons, headings, status messages to capitalize "WILL" when referring to the feature
  - Applied to Navigation, InnerCircleHub, StartWill, WillDetails, AdminDashboard, Landing, Auth, and EditWill pages
  - Maintained consistency across landing pages, modal dialogs, toast notifications, and admin interfaces
  - Preserved lowercase usage only when "will" is used as a verb or in descriptive text
- **June 28, 2025**: Fixed registration system database connection issue
  - Resolved "Cannot read properties of undefined (reading 'insert')" error in DatabaseStorage.createUser method
  - Added missing InsertUser type import to server/storage.ts
  - Fixed database reference inconsistencies by ensuring all methods use imported 'db' instance
  - Registration and login now working correctly with proper user creation and authentication flow
- **June 28, 2025**: Enhanced "Your Why" privacy and formatting across commitment pages
  - Added clear privacy notice with lock icon indicating "Why" statements are private and only visible to the user
  - Improved text formatting to make "Because" prefix flow seamlessly with user input
  - Applied consistent styling improvements to both StartWill and SubmitCommitment pages
  - Enhanced visual presentation with better alignment, borders, and background styling
- **June 28, 2025**: Improved acknowledgment messaging for WILL completion
  - Changed from "Waiting for committed members to acknowledge completion: X of Y" to "X of Y participating members have acknowledged"
  - Simplified requirement text from "All committed members must acknowledge before creating a new WILL" to "Required before creating a new WILL"
  - Applied consistent wording across WillDetails and InnerCircleHub pages for better clarity
- **June 28, 2025**: Streamlined WILL completion interface and user flow
  - Simplified Inner Circle Hub completed WILL section to show only "WILL Completed!" title, congratulations, and "View" button
  - Removed acknowledgment info and action from Inner Circle Hub for cleaner interface
  - Moved all acknowledgment functionality exclusively to Will Details page for focused user experience
- **June 28, 2025**: Relocated user dropdown menu for improved UX
  - Moved dropdown menu from top-right navigation to user's name in Circle Members section
  - User can now click on their own name (with chevron arrow) in the members list to access Account Settings, Leave Circle, Sign Out, and Admin Panel
  - Removed user display from top navigation bar for cleaner header design
  - Dropdown only appears for the current user, other members show as plain text
- **June 28, 2025**: Fixed comprehensive UI reactivity and cache invalidation issues
  - Resolved UI not updating without manual refresh across all components
  - Added proper cache invalidation to all mutations: WILL creation, commitment submission, editing, acknowledgments, and deletions
  - Implemented consistent query invalidation patterns for `/api/wills/circle`, `/api/circles/mine`, and specific will details queries
  - Fixed real-time updates for member lists, WILL status changes, and completion acknowledgments
  - Enhanced user experience with immediate UI feedback after all actions
- **June 29, 2025**: Enhanced commitment creation UX with "What" preview on "Why" page
  - Added preview card showing user's "What" input on the "Why would you like to do this?" step
  - Preview displays as "I will [user's input]" with clean, modern styling matching existing design
  - Implemented across both StartWill and SubmitCommitment flows for consistency
  - Preview updates automatically if user goes back to edit their "What" input
  - Improves context and flow during commitment creation process
- **June 29, 2025**: Fixed critical server startup issues and type safety improvements
  - Fixed duplicate import errors in database schema that prevented compilation
  - Resolved authentication system issues with user object handling in replitAuth.ts
  - Fixed apiRequest function signature and updated all usage throughout codebase
  - Added proper type annotations for User interface from shared schema
  - Updated pending note text: "This WILL becomes active automatically at the start date. Any member who has not submitted by then will not be included in the Will"
  - Server now running successfully with proper database connections and authentication flow
  - Fixed 100+ TypeScript errors related to API calls and user type definitions
  - Enhanced type safety while maintaining full application functionality
- **June 29, 2025**: Fixed will deletion cache invalidation for real-time UI updates
  - Enhanced will deletion mutation to invalidate all related queries comprehensively
  - Added invalidation for `/api/wills/circle`, `/api/wills/circle/${circleId}`, `/api/circles/mine`, and specific will details
  - Resolved UI lag issue where deleted wills required manual page refresh to update
  - All mutation operations now have proper cache invalidation for immediate UI feedback
- **June 29, 2025**: Implemented visual distinction for "Will" feature terminology across entire application
  - Added italic styling to "Will" when referring to the app feature using `<em>Will</em>` tags
  - Updated all major components: InnerCircleHub, StartWill, WillDetails, AdminDashboard, EditWill, Landing
  - Maintained lowercase "will" for normal grammar usage (auxiliary verb and descriptive text)
  - Applied consistent visual hierarchy to distinguish feature terminology from common language
  - Enhanced user experience with clear semantic emphasis on feature-specific references
- **June 29, 2025**: Disabled Replit authentication to enable direct public access
  - Completely removed Replit OIDC authentication system to prevent authentication gateway
  - Uninstalled openid-client and memoizee dependencies that trigger platform-level auth
  - Replaced replitAuth.ts with no-op functions to maintain compatibility
  - App now uses local email/password authentication exclusively
  - Users can access deployed app directly without requiring Replit accounts
  - Enables public sharing and user registration through app's native auth system
- **July 08, 2025**: Fixed mobile app refresh issues and enhanced End Room video functionality
  - Resolved "End Room not ready" error by fixing scheduler room creation logic
  - Added comprehensive fallback detection for missing Daily.co room URLs
  - Enhanced DailyService with improved logging and error handling
  - Implemented automatic app refresh when mobile app returns to foreground
  - Updated QueryClient configuration to enable focus-based data refresh
  - Created useAppRefresh hook for seamless mobile/web app state management
  - Data now refreshes automatically without requiring app restart
  - Fixed mobile app UI lag by setting proper staleTime (30 seconds) instead of Infinity
- **July 12, 2025**: Fixed Final Summary modal navigation issues blocking user dashboard access
  - Resolved unresponsive "X" button in Final Summary modal header
  - Fixed "Acknowledge and Close Will" button to properly handle already-acknowledged state
  - Added intelligent button behavior: acknowledges if not done, navigates to dashboard if already acknowledged
  - Enhanced error handling to prevent "already acknowledged" error messages
  - Added proper close button with X icon in modal header for better UX
  - Updated FinalWillSummary component to receive hasUserAcknowledged prop for state management
  - Users can now properly return to dashboard after Will completion without getting stuck
- **July 12, 2025**: Fixed End Room functionality and mobile compatibility issues
  - Resolved "End Room not ready" error caused by missing Daily.co room URLs in database
  - Created new Daily.co room for Will #40 with mobile-friendly configuration settings
  - Updated mobile End Room behavior to open directly in native browser for better compatibility
  - Enhanced Daily.co room properties: enabled prejoin UI, network UI for better mobile experience
  - Added device detection to automatically choose optimal video room experience (iframe vs browser)
  - Fixed mobile "Something went wrong" error by bypassing problematic iframe embedding on mobile devices
  - End Room now works seamlessly on both desktop (embedded) and mobile (native browser) platforms
  - Created MobileVideoRoom component that automatically opens video room in browser after 1 second
  - Removed inaccurate timer display that didn't reflect actual End Room duration
  - Implemented mobile-first approach that bypasses iframe limitations by opening directly in browser
  - Fixed "Something went wrong" error by avoiding problematic iframe embedding on mobile entirely
- **July 04, 2025**: Implemented Capacitor for iOS mobile app development
  - Added @capacitor/core, @capacitor/cli, and @capacitor/ios packages
  - Created capacitor.config.ts with proper iOS configuration and schemes
  - Initialized iOS platform with native Xcode project structure
  - Added mobile-optimized HTML with viewport settings and PWA meta tags
  - Created app manifest.json with proper iOS app configuration
  - Designed app icon with Inner Circles branding (connected circles motif)
  - Created build-mobile.sh script for streamlined iOS build process
  - Project now ready for iOS development and App Store submission
- **July 04, 2025**: Completed mobile app build process optimization
  - Resolved CSS build errors preventing mobile compilation (shadow-glow, hover effects)
  - Fixed development server stability issues
  - Created optimized build process that bypasses complex bundling timeouts
  - Successfully completed Capacitor iOS sync with proper asset handling
  - Created build-mobile-simple.sh for streamlined mobile builds
  - Mobile app now ready for Xcode building and device testing
  - App configured to redirect to https://willbeta.replit.app for full functionality
- **July 05, 2025**: Fixed iOS mobile UI issues and authentication system
  - Enhanced "I will" prefix visibility with white background, bold text, and proper z-index
  - Improved schedule selection visual feedback with blue highlighting and ring effects
  - Updated Week Template description text for clarity
  - Fixed authentication system for mobile app access with environment-aware cookie settings
  - Added comprehensive CORS headers for mobile app compatibility
  - Reverted to live server configuration (willbeta.replit.app) for production deployment
  - Applied fixes to both StartWill and SubmitCommitment pages for consistency
  - Fixed iOS app name display by updating CFBundleName and PRODUCT_NAME to "WILL" in both Info.plist and Xcode project settings
  - Resolved bundle identifier conflict by changing from com.will.app to com.porfirio.will to fix provisioning profile errors
  - Fixed "I will" prefix overlapping issue on iOS by restructuring input field layout with proper flexbox positioning
  - Fixed "Because" prefix overlapping issue on iOS by applying same flexbox solution to "Why" input fields
  - Updated both StartWill and SubmitCommitment pages to prevent text overlap on mobile devices
  - All input prefixes now use proper flexbox layout with flex-shrink-0 for consistent mobile display
- **July 05, 2025**: Implemented lightweight instructional modal for improved Will creation UX
  - Added WillInstructionModal component with step-by-step guidance for new users
  - Modal automatically shows for first-time Will creators and first-time commitment submitters
  - Persistent "?" help icon in StartWill and SubmitCommitment pages for easy access
  - Local storage tracking prevents repeated modal displays with optional "Don't show again" checkbox
  - Clear copy explaining When/What/Why flow with practical examples for better user onboarding
- **July 06, 2025**: Enhanced Will creation flow with End Room scheduling during creation
  - Implemented End Room scheduling as step 4 in Will creation process (not after completion)
  - Integrated Daily.co API to create video rooms automatically when Will is created
  - Added server-side End Room creation with proper error handling and status tracking
  - Updated database schema to support endRoomScheduledAt field in Will creation
- **July 06, 2025**: Redesigned End Room scheduling UX for ceremonial experience
  - Removed "End Room" from 3-step progress indicator (When → What → Why only)
  - Created special ceremonial 4th screen that appears after "Why" step without being in progress bar
  - Enhanced End Room interface with amber styling, larger icons, and ceremonial messaging
  - Added 48-hour time limit constraint after Will end date for End Room scheduling
  - Updated copy to "When will your circle gather to honor the efforts?" with detailed scheduling rules
  - Added comprehensive disclaimer about End Room behavior and completion criteria
- **July 06, 2025**: Enhanced Will completion flow with Final Will Summary modal
  - Implemented comprehensive Final Will Summary modal that automatically appears when Will is completed
  - Modal shows Will duration, member commitments, and End Room ceremony completion details
  - Added proper acknowledgment flow requiring user review before Will is officially archived
  - Updated Inner Circle Hub UI to show "Will Complete - Ready to Review" state with amber styling
  - Fixed pending Will note to display specific start date/time instead of generic "start date" text
- **July 06, 2025**: Enhanced End Room status displays and consistent date formatting
  - Fixed Final Will Summary to only appear after End Room ceremony actually completes (endRoomStatus === 'completed')
  - Added "End Room in Process" status with green styling when End Room is currently active
  - Updated date formatting to consistently show "Sunday, July 6, 2025 at 12:50 PM" format instead of "Tomorrow"
  - Enhanced both InnerCircleHub and EndRoom components to show exact "opens at" and "expires at" times
  - Differentiated UI states: End Room pending (purple) vs End Room active (green) vs End Room completed (amber)
  - Fixed timezone scheduling bug - End Room now correctly scheduled for 2 minutes after Will end instead of hours later
  - Updated date format to MM/DD time format (e.g., "7/6 1:22 PM") and removed "ceremony" wording
  - Simplified End Room messaging to "The End Room is live and will close at [time]"
  - Fixed redundant date formatting in Will activation text: now shows just time for today ("8:39 PM") or full date for other days ("on July 6 at 8:39 PM")
- **July 06, 2025**: Implemented proper Will lifecycle and End Room completion flow
  - Fixed Will status transitions with new "waiting_for_end_room" status between Will end and End Room completion
  - Added comprehensive scheduler logic for Will lifecycle: pending → active → waiting_for_end_room → completed
  - Enforced End Room scheduling validation rules: must be scheduled between Will end time and 48 hours afterward
  - Added client-side and server-side validation with clear error messages for invalid End Room times
  - Created dedicated UI for "waiting_for_end_room" status in Inner Circle Hub with purple styling and video icon
  - Fixed End Room completion logic: Wills only complete when End Room expires, not when Will end date passes
  - Updated End Room info text to clarify 30-minute duration, no rescheduling, and automatic completion policies
- **July 06, 2025**: Fixed comprehensive timezone handling for End Room scheduling
  - Fixed End Room scheduling to properly convert user's local time to UTC before database storage
  - Updated End Room display formatting to show times in user's local timezone from stored UTC timestamps
  - Fixed scheduler logic to compare UTC times correctly for status transitions
  - Implemented consistent timezone rules: store UTC in database, display local time in frontend
  - Fixed 7-hour timezone offset issue that was incorrectly scheduling End Rooms
  - Updated formatEndRoomTime function to handle proper UTC-to-local conversion without manual string manipulation
- **July 06, 2025**: Completed timezone and End Room functionality with working Daily.co integration
  - Resolved Daily.co API authentication by setting up billing and providing working API key
  - Fixed Daily.co API parameter issue ("unknown parameter 'config'") that was preventing room creation
  - End Room lifecycle working perfectly: Will ends → End Room active → End Room expires → Will completed
  - Timezone conversion working correctly: UTC storage with local time display throughout app
  - Smart time formatting: shows just time for today ("9:17 PM") or date+time for other days applied to all date displays
  - Scheduler automatically transitions Will status and closes End Rooms at proper times
  - Video room creation working: automatic during Will creation + fallback creation via "Join" button
  - Final Will Summary modal appears when End Room ceremony completes for acknowledgment flow
  - Updated End Room scheduling page with ceremonial wording and clear constraints ("honor the effort")
  - Fixed Daily.co room access permissions with enhanced public settings (enable_knocking: false, enable_prejoin_ui: false)
  - Updated End Room button from "Create Video Room" to "Join" with green styling for better UX
  - Restructured "Awaiting End Room" page to show "Will Complete" with "Pending End Room" status
  - Added End Room explanation text and Scheduled End Room section with start/end times
  - Removed duration text from date display for cleaner waiting for End Room interface
  - Standardized all character limits to 75 characters across StartWill, SubmitCommitment, and EditCommitment pages
  - Added real-time character counters showing "X / 75" format for consistent user experience
  - Removed "ceremony" terminology from End Room feature across all components
  - Updated End Room formatting to match Will Duration format with "Started:" and "Ended:" labels
  - Changed "Attendees:" to "Participants:" and added consistent grid layout and duration display
- **July 07, 2025**: Enhanced Will Details consistency and fixed critical scheduler bug
  - Made Will Details page consistent across all statuses (pending, scheduled, active, waiting_for_end_room, completed)
  - Added Will Duration section and End Room Meeting details for scheduled, active, and other non-pending statuses
  - Fixed critical scheduler bug where Wills were skipping the proper lifecycle transitions
  - Root cause: Scheduler only handled 'pending' and 'active' statuses, missing 'scheduled' status in transition logic
  - Updated scheduler to properly handle 'scheduled' status transitions: scheduled → active → waiting_for_end_room → completed
  - Wills now correctly follow End Room flow instead of bypassing waiting_for_end_room status
  - Added proper status transition logic with OR conditions to handle both 'pending' and 'scheduled' starting states
- **July 07, 2025**: Implemented advanced embedded video room with mobile optimization and permissions handling
  - Created AdvancedVideoRoom component using iframe approach for better mobile compatibility
  - Added Capacitor device detection to optimize experience for iOS/Android vs web
  - Implemented proper iOS WebView permissions for camera and microphone access
  - Added comprehensive fallback system: embedded iframe → native browser → external tab
  - Enhanced video room with auto-disconnect timer (30 minutes) and real-time countdown
  - Added iOS-specific configuration for camera/microphone permissions in Info.plist
  - Created mobile build script with video room support and permission setup
  - Fixed mobile video call errors by replacing embedded Daily.co SDK with iframe approach
  - Video room now works reliably across all platforms with appropriate permission handling

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