import * as cron from 'node-cron';
import { db } from './db';
import { wills, willCommitments, circleMembers, willAcknowledgments, commitmentReminders, willReviews, users, deviceTokens } from '@shared/schema';
import { eq, and, or, lt, gte, isNull, isNotNull, ne, notInArray, inArray } from 'drizzle-orm';
import { dailyService } from './daily';
import { storage } from './storage';
import { pushNotificationService } from './pushNotificationService';

export class EndRoomScheduler {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('[EndRoomScheduler] Already running');
      return;
    }

    console.log('[EndRoomScheduler] Starting dual scheduler system...');
    this.isRunning = true;

    // ISSUE #3 FIX: Changed heavy operations from 5 minutes to 1 minute for instant status updates
    // DUAL SCHEDULER APPROACH:
    // 1. Heavy operations every 1 MINUTE (instant status transitions)
    // 2. Lightweight notifications every minute (time-sensitive)

    // ISSUE #3 FIX: Heavy operations scheduler (1 minute) - instant status updates and room management
    cron.schedule('* * * * *', async () => {
      try {
        await this.processHeavyOperations();
      } catch (error) {
        console.error('[EndRoomScheduler] Critical error in heavy operations:', error);
        console.error('[EndRoomScheduler] Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      }
    });

    // Lightweight notifications scheduler (1 minute) - ensures 24h/15min warning accuracy
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        await this.sendEndRoomNotifications(now);
      } catch (error) {
        console.error('[EndRoomScheduler] Error in notification scheduler:', error);
        console.error('[EndRoomScheduler] Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      }
    });

    console.log('[EndRoomScheduler] Dual scheduler started:');
    console.log('[EndRoomScheduler] - ISSUE #3 FIX: Heavy operations: every 1 MINUTE (instant status updates)');
    console.log('[EndRoomScheduler] - Notifications: every minute (time-sensitive)');
  }

  stop() {
    this.isRunning = false;
    console.log('[EndRoomScheduler] Scheduler stopped');
  }

  private async processHeavyOperations() {
    const now = new Date();
    console.log(`[EndRoomScheduler] Running heavy operations at ${now.toISOString()}`);

    // Heavy database operations and resource-intensive tasks
    // First, transition Will statuses based on dates
    await this.transitionWillStatuses(now);

    // Find End Rooms that should be opened (scheduled time has passed, status is pending)
    await this.openPendingEndRooms(now);

    // Find End Rooms that should be closed (30 minutes have passed, status is open)
    await this.closeExpiredEndRooms(now);

    // Check for completed wills that need End Rooms scheduled
    await this.scheduleEndRoomsForCompletedWills();

    // NEW: Send reminder notifications (6hr commitment/acknowledgment reminders)
    await this.sendReminderNotifications(now);

    // NEW: Send milestone notifications (midpoint)
    await this.sendMilestoneNotifications(now);

    // NEW: Send daily reminder notifications (user-scheduled)
    await this.checkDailyReminders(now);

    // NEW: Send random motivational "because" notifications (once per day)
    await this.checkMotivationalNotifications(now);

    console.log('[EndRoomScheduler] Heavy operations completed');
  }

  // Legacy method maintained for backward compatibility
  private async processEndRooms() {
    console.log('[EndRoomScheduler] Legacy processEndRooms method called - redirecting to heavy operations');
    await this.processHeavyOperations();
  }

  private async transitionWillStatuses(now: Date) {
    try {
      console.log(`[SCHEDULER] Checking Will status transitions at ${now.toISOString()}`);
      
      // 1. Transition pending/scheduled wills to active (start time has passed)
      const willsToActivate = await db
        .select({
          id: wills.id,
          circleId: wills.circleId,
          status: wills.status,
          startDate: wills.startDate,
          endDate: wills.endDate
        })
        .from(wills)
        .where(
          and(
            or(eq(wills.status, 'pending'), eq(wills.status, 'scheduled')),
            lt(wills.startDate, now)
          )
        )
        .limit(50); // Limit to prevent memory issues in large datasets

      if (willsToActivate.length > 0) {
        console.log(`[SCHEDULER] Found ${willsToActivate.length} Wills to activate`);
      }

      for (const will of willsToActivate) {
        console.log(`[SCHEDULER] ⏩ Activating Will ${will.id} (started at ${will.startDate.toISOString()})`);
        await storage.updateWillStatus(will.id, 'active');
        
        // Send Will Started notification
        try {
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (willWithCommitments && willWithCommitments.commitments) {
            const committedMembers = willWithCommitments.commitments.map(c => c.userId);
            // Use first commitment's "what" as title or fallback to generic title
            const willTitle = willWithCommitments.commitments[0]?.what || "Your Will";
            // Circle mode (scheduler only handles circle wills)
            const isSoloMode = will.circleId === null;
            await pushNotificationService.sendWillStartedNotification(willTitle, committedMembers, will.id, isSoloMode);
            console.log(`[EndRoomScheduler] Will Started notification sent for Will ${will.id} (solo: ${isSoloMode})`);
          }
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to send Will Started notification:`, error);
        }
      }

      // 2. NEW FEATURE: Transition active wills to will_review (end time has passed)
      // All Wills now go to will_review first for mandatory reflection
      // Also handles legacy 'waiting_for_end_room' status for backward compatibility
      const willsToReview = await db
        .select()
        .from(wills)
        .where(
          and(
            or(
              eq(wills.status, 'active'),
              eq(wills.status, 'scheduled'),
              eq(wills.status, 'waiting_for_end_room') // Legacy status migration
            ),
            lt(wills.endDate, now)
          )
        )
        .limit(50); // Limit to prevent memory issues in large datasets

      if (willsToReview.length > 0) {
        console.log(`[SCHEDULER] Found ${willsToReview.length} Wills to transition to will_review`);
      }

      for (const will of willsToReview) {
        console.log(`[SCHEDULER] 📝 Transitioning Will ${will.id} to will_review (ended at ${will.endDate.toISOString()})`);
        await storage.updateWillStatus(will.id, 'will_review');
        
        // NEW: Send Will Completed Review notification (only if not already sent)
        if (!will.completionNotificationSentAt) {
          try {
            const willWithCommitments = await storage.getWillWithCommitments(will.id);
            if (willWithCommitments && willWithCommitments.commitments) {
              const participants = willWithCommitments.commitments.map(c => c.userId);
              await pushNotificationService.sendWillReviewRequiredNotification(will.id, participants);

              for (const participantId of participants) {
                const existingReview = await storage.getWillReview(will.id, participantId);
                if (!existingReview) {
                  await storage.createUserNotification({
                    userId: participantId,
                    type: 'review_required',
                    willId: will.id,
                    circleId: will.circleId,
                    isRead: false,
                  });
                }
              }

              await db.update(wills)
                .set({ completionNotificationSentAt: now })
                .where(eq(wills.id, will.id));
              console.log(`[SCHEDULER] ✅ Will Completed Review notification sent for Will ${will.id}`);
            }
          } catch (error) {
            console.error(`[SCHEDULER] Failed to send Will Completed Review notification for Will ${will.id}:`, error);
          }
        }
      }

      // 3. Check will_review Wills and transition to completed when BOTH conditions are met:
      // Condition A: ALL members have submitted their reviews (mandatory)
      // Condition B: End Room has finished (or no End Room scheduled)
      const willsInReview = await db
        .select()
        .from(wills)
        .where(eq(wills.status, 'will_review'))
        .limit(50);

      for (const will of willsInReview) {
        try {
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (!willWithCommitments) continue;

          const commitmentCount = willWithCommitments.commitments?.length || 0;
          const reviewCount = await storage.getWillReviewCount(will.id);

          // CONDITION A: ALL members must submit reviews (acknowledgments do NOT count)
          const conditionA_ReviewsComplete = reviewCount >= commitmentCount;

          // CONDITION B: Check if End Room has finished (or doesn't exist)
          const hasEndRoom = !!will.endRoomScheduledAt;
          const endRoomFinished = will.endRoomStatus === 'completed';
          const conditionB_EndRoomComplete = !hasEndRoom || endRoomFinished;

          if (conditionA_ReviewsComplete && conditionB_EndRoomComplete) {
            // BOTH conditions met - transition to completed
            console.log(`[SCHEDULER] ✅ BOTH conditions met for Will ${will.id}:`);
            console.log(`[SCHEDULER]    - Reviews: ${reviewCount}/${commitmentCount} reviews submitted ✓`);
            console.log(`[SCHEDULER]    - End Room: ${endRoomFinished ? 'finished ✓' : 'no End Room scheduled ✓'}`);
            console.log(`[SCHEDULER] → Transitioning Will ${will.id} to completed`);
            await storage.updateWillStatus(will.id, 'completed');
          } else {
            // At least one condition NOT met - keep in will_review
            const missingConditions = [];
            if (!conditionA_ReviewsComplete) {
              missingConditions.push(`reviews (${reviewCount}/${commitmentCount} submitted)`);
            }
            if (!conditionB_EndRoomComplete) {
              missingConditions.push(`End Room (status: ${will.endRoomStatus})`);
            }
            console.log(`[SCHEDULER] ⏳ Will ${will.id} stays in will_review - waiting for: ${missingConditions.join(', ')}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Error checking will_review status for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error transitioning Will statuses:', error);
    }
  }

  private async openPendingEndRooms(now: Date) {
    try {
      // Only open End Rooms for circle mode wills (have circleId)
      const roomsToOpen = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            lt(wills.endRoomScheduledAt, now),
            isNotNull(wills.circleId) // Solo wills don't have End Rooms
          )
        )
        .limit(20); // Limit to prevent resource exhaustion

      for (const will of roomsToOpen) {
        try {
          console.log(`[EndRoomScheduler] Opening End Room for Will ${will.id}`);
          
          // Create Daily.co video room
          if (!will.endRoomUrl && will.endRoomScheduledAt) {
            try {
              const endRoom = await dailyService.createEndRoom({
                willId: will.id,
                scheduledStart: new Date(will.endRoomScheduledAt),
              });
              
              // Update status to open with video room URL and track when it actually opened
              await storage.updateWillEndRoom(will.id, { 
                endRoomStatus: 'open',
                endRoomOpenedAt: now,
                endRoomUrl: endRoom.url
              });
              
              console.log(`[EndRoomScheduler] End Room opened for Will ${will.id} with video URL: ${endRoom.url}`);
              try {
                // circleId is guaranteed to be non-null here (filtered in query)
                const circleMembers = await storage.getCircleMembers(will.circleId!);
                const memberIds = circleMembers.map(member => member.userId);
                await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds, will.id);
                console.log(`[EndRoomScheduler] End Room Live notification sent for Will ${will.id}`);
              } catch (error) {
                console.error(`[EndRoomScheduler] Failed to send End Room Live notification:`, error);
              }
            } catch (dailyError) {
              console.error(`[EndRoomScheduler] Failed to create Daily.co room for Will ${will.id}:`, dailyError);
              // Still mark as open even if video creation failed
              await storage.updateWillEndRoom(will.id, { 
                endRoomStatus: 'open',
                endRoomOpenedAt: now
              });
              console.log(`[EndRoomScheduler] End Room opened for Will ${will.id} but without video room`);
              try {
                // circleId is guaranteed to be non-null here (filtered in query)
                const circleMembers = await storage.getCircleMembers(will.circleId!);
                const memberIds = circleMembers.map(member => member.userId);
                await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds, will.id);
                console.log(`[EndRoomScheduler] End Room Live notification sent for Will ${will.id}`);
              } catch (error) {
                console.error(`[EndRoomScheduler] Failed to send End Room Live notification:`, error);
              }
            }
          } else {
            // Update status to open (room URL already exists)
            await storage.updateWillEndRoom(will.id, { 
              endRoomStatus: 'open',
              endRoomOpenedAt: now
            });
            console.log(`[EndRoomScheduler] End Room opened for Will ${will.id}`);
            try {
              // circleId is guaranteed to be non-null here (filtered in query)
              const circleMembers = await storage.getCircleMembers(will.circleId!);
              const memberIds = circleMembers.map(member => member.userId);
              await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds, will.id);
              console.log(`[EndRoomScheduler] End Room Live notification sent for Will ${will.id}`);
            } catch (error) {
              console.error(`[EndRoomScheduler] Failed to send End Room Live notification:`, error);
            }
          }
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to open End Room for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error opening pending End Rooms:', error);
    }
  }

  private async closeExpiredEndRooms(now: Date) {
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      // Only close End Rooms for circle mode wills (have circleId)
      const roomsToClose = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'open'),
            lt(wills.endRoomOpenedAt, thirtyMinutesAgo),
            isNotNull(wills.circleId) // Solo wills don't have End Rooms
          )
        )
        .limit(20); // Limit to prevent resource exhaustion

      for (const will of roomsToClose) {
        try {
          console.log(`[EndRoomScheduler] Closing End Room for Will ${will.id}`);
          
          // Step 1: Update End Room status to completed
          await storage.updateWillEndRoom(will.id, { endRoomStatus: 'completed' });
          console.log(`[EndRoomScheduler] End Room status set to 'completed' for Will ${will.id}`);

          // Step 2: Check if ALL members have submitted reviews
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (willWithCommitments) {
            const commitmentCount = willWithCommitments.commitments?.length || 0;
            const reviewCount = await storage.getWillReviewCount(will.id);
            const allReviewsSubmitted = reviewCount >= commitmentCount;

            if (allReviewsSubmitted) {
              // BOTH conditions met: End Room finished + All reviews submitted
              console.log(`[EndRoomScheduler] ✅ All ${reviewCount}/${commitmentCount} reviews submitted - Transitioning Will ${will.id} to completed`);
              await storage.updateWillStatus(will.id, 'completed');
            } else {
              // End Room finished, but NOT all reviews submitted yet
              console.log(`[EndRoomScheduler] ⏳ End Room finished, but only ${reviewCount}/${commitmentCount} reviews submitted - Will ${will.id} stays in will_review`);
            }
          }

          // Step 3: Clean up the Daily room if it exists
          if (will.endRoomUrl) {
            const roomName = will.endRoomUrl.split('/').pop();
            if (roomName) {
              try {
                await dailyService.deleteRoom(roomName);
              } catch (deleteError) {
                console.warn(`[EndRoomScheduler] Could not delete Daily room ${roomName}:`, deleteError);
              }
            }
          }
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to close End Room for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error closing expired End Rooms:', error);
    }
  }

  private async sendEndRoomNotifications(now: Date) {
    try {
      // 24-hour warning (check for End Rooms scheduled 24h-24h1m from now)
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twentyFourHoursOneMinuteFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 1000);
      
      // Only send notifications for circle mode wills (have circleId)
      const endRooms24h = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, twentyFourHoursFromNow),
            lt(wills.endRoomScheduledAt, twentyFourHoursOneMinuteFromNow),
            isNotNull(wills.circleId) // Solo wills don't have End Rooms
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms24h) {
        console.log(`[EndRoomScheduler] Sending 24h End Room notification for Will ${will.id}`);
        try {
          // circleId is guaranteed to be non-null here (filtered in query)
          const circleMembers = await storage.getCircleMembers(will.circleId!);
          
          // TIMEZONE FIX: Send personalized notifications per user with their timezone
          for (const member of circleMembers) {
            try {
              // Get user's timezone from database
              const userTimezone = member.user.timezone || 'America/New_York';
              
              // Format time in user's timezone
              const endRoomTime = will.endRoomScheduledAt 
                ? new Date(will.endRoomScheduledAt).toLocaleTimeString('en-US', {
                    timeZone: userTimezone,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                : 'scheduled time';
              
              console.log(`[EndRoomScheduler] User ${member.user.firstName} (${userTimezone}): End Room at ${endRoomTime}`);
              
              // Send personalized notification to this user
              await pushNotificationService.sendEndRoomNotification('24_hours', endRoomTime, [member.userId], will.id);
            } catch (memberError) {
              console.error(`[EndRoomScheduler] Failed to send notification to user ${member.userId}:`, memberError);
            }
          }
          
          console.log(`[EndRoomScheduler] 24h End Room notifications sent for Will ${will.id}`);
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to send 24h End Room notification:`, error);
        }
      }

      // 15-minute warning (check for End Rooms scheduled 15m-15m1m from now)
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      const fifteenMinutesOneMinuteFromNow = new Date(now.getTime() + 15 * 60 * 1000 + 60 * 1000);
      
      // Only send notifications for circle mode wills (have circleId)
      const endRooms15min = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, fifteenMinutesFromNow),
            lt(wills.endRoomScheduledAt, fifteenMinutesOneMinuteFromNow),
            isNotNull(wills.circleId) // Solo wills don't have End Rooms
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms15min) {
        console.log(`[EndRoomScheduler] Sending 15min End Room notification for Will ${will.id}`);
        try {
          // circleId is guaranteed to be non-null here (filtered in query)
          const circleMembers = await storage.getCircleMembers(will.circleId!);
          
          // TIMEZONE FIX: Send personalized notifications per user with their timezone
          for (const member of circleMembers) {
            try {
              // Get user's timezone from database
              const userTimezone = member.user.timezone || 'America/New_York';
              
              // Format time in user's timezone  
              const endRoomTime = will.endRoomScheduledAt 
                ? new Date(will.endRoomScheduledAt).toLocaleTimeString('en-US', {
                    timeZone: userTimezone,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                : 'scheduled time';
              
              console.log(`[EndRoomScheduler] User ${member.user.firstName} (${userTimezone}): End Room at ${endRoomTime}`);
              
              // Send personalized notification to this user
              await pushNotificationService.sendEndRoomNotification('15_minutes', endRoomTime, [member.userId], will.id);
            } catch (memberError) {
              console.error(`[EndRoomScheduler] Failed to send notification to user ${member.userId}:`, memberError);
            }
          }
          
          console.log(`[EndRoomScheduler] 15min End Room notifications sent for Will ${will.id}`);
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to send 15min End Room notification:`, error);
        }
      }
      
    } catch (error) {
      console.error('[EndRoomScheduler] Error sending End Room notifications:', error);
    }
  }

  private async scheduleEndRoomsForCompletedWills() {
    try {
      // This method is now handled by transitionWillStatuses
      // No additional logic needed here as status transitions are handled above
      return;
    } catch (error) {
      console.error('[EndRoomScheduler] Error scheduling End Rooms for completed wills:', error);
    }
  }

  // NEW: Send 6-hour reminder notifications for commitment and acknowledgment
  private async sendReminderNotifications(now: Date) {
    try {
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      // 1. COMMITMENT REMINDER: Wills in pending status created 6+ hours ago
      // Find circle mode wills that are pending and created 6+ hours ago
      const pendingWills = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'pending'),
            lt(wills.createdAt, sixHoursAgo),
            isNotNull(wills.circleId) // Only circle mode
          )
        )
        .limit(20);

      for (const will of pendingWills) {
        try {
          // Get all circle members
          const allCircleMembers = await storage.getCircleMembers(will.circleId!);
          
          // Get users who have already committed
          const existingCommitments = await db
            .select({ userId: willCommitments.userId })
            .from(willCommitments)
            .where(eq(willCommitments.willId, will.id));
          const committedUserIds = existingCommitments.map(c => c.userId);

          // Get users who have already received commitment reminder
          const existingReminders = await db
            .select({ userId: commitmentReminders.userId })
            .from(commitmentReminders)
            .where(eq(commitmentReminders.willId, will.id));
          const remindedUserIds = existingReminders.map(r => r.userId);

          // Find uncommitted members who haven't been reminded yet
          const uncommittedToRemind = allCircleMembers.filter(
            m => !committedUserIds.includes(m.userId) && !remindedUserIds.includes(m.userId)
          );

          if (uncommittedToRemind.length > 0) {
            const userIdsToRemind = uncommittedToRemind.map(m => m.userId);
            await pushNotificationService.sendCommitmentReminderNotification(will.id, userIdsToRemind);
            
            // Record that reminders were sent (idempotency)
            for (const userId of userIdsToRemind) {
              await db.insert(commitmentReminders).values({
                willId: will.id,
                userId: userId
              });
            }
            console.log(`[SCHEDULER] ✅ Commitment reminder sent to ${userIdsToRemind.length} users for Will ${will.id}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send commitment reminder for Will ${will.id}:`, error);
        }
      }

      // 2. WILL REVIEW REMINDER: Wills in will_review status where completion notification was sent 6+ hours ago
      // Works for BOTH Circle and Solo modes
      const willsInReview = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'will_review'),
            lt(wills.completionNotificationSentAt, sixHoursAgo)
          )
        )
        .limit(20);

      for (const will of willsInReview) {
        try {
          // Get all committed members
          const commitments = await db
            .select()
            .from(willCommitments)
            .where(eq(willCommitments.willId, will.id));

          // Get users who have already submitted REVIEWS (not acknowledgments)
          const reviewedUsers = await db
            .select({ userId: willReviews.userId })
            .from(willReviews)
            .where(eq(willReviews.willId, will.id));
          const reviewedUserIds = reviewedUsers.map(r => r.userId);

          // Find committed members who haven't submitted review AND haven't been reminded yet
          const unreviewedToRemind = commitments.filter(
            c => !reviewedUserIds.includes(c.userId) && !c.ackReminderSentAt
          );

          if (unreviewedToRemind.length > 0) {
            const userIdsToRemind = unreviewedToRemind.map(c => c.userId);
            const isSoloMode = will.mode === 'solo';
            await pushNotificationService.sendWillReviewReminderNotification(will.id, userIdsToRemind, isSoloMode);
            
            // Mark reminders as sent on each commitment record (idempotency)
            // Reusing ackReminderSentAt field for review reminders (same purpose)
            for (const commitment of unreviewedToRemind) {
              await db.update(willCommitments)
                .set({ ackReminderSentAt: now })
                .where(eq(willCommitments.id, commitment.id));
            }
            console.log(`[SCHEDULER] ✅ Will review reminder sent to ${userIdsToRemind.length} users for Will ${will.id} (${isSoloMode ? 'Solo' : 'Circle'} mode)`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send will review reminder for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error sending reminder notifications:', error);
    }
  }

  // NEW: Send midpoint milestone notifications (50% through Will duration)
  private async sendMilestoneNotifications(now: Date) {
    try {
      // Find active wills where midpoint has passed but notification hasn't been sent
      const willsAtMidpoint = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'active'),
            lt(wills.midpointAt, now),
            isNull(wills.midpointNotificationSentAt)
          )
        )
        .limit(20);

      for (const will of willsAtMidpoint) {
        try {
          // RACE CONDITION FIX: Use atomic update with WHERE clause to prevent duplicates
          // Only proceed if we successfully claim this notification (no one else has set it)
          const updateResult = await db.update(wills)
            .set({ midpointNotificationSentAt: now })
            .where(
              and(
                eq(wills.id, will.id),
                isNull(wills.midpointNotificationSentAt) // Only update if still null
              )
            )
            .returning({ id: wills.id });
          
          // If no rows updated, another scheduler instance already claimed it
          if (updateResult.length === 0) {
            console.log(`[SCHEDULER] ⏭️ Midpoint notification already sent for Will ${will.id} (skipping duplicate)`);
            continue;
          }
          
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (willWithCommitments && willWithCommitments.commitments) {
            const committedMembers = willWithCommitments.commitments.map(c => c.userId);
            await pushNotificationService.sendMidpointMilestoneNotification(will.id, committedMembers);
            console.log(`[SCHEDULER] ✅ Midpoint milestone notification sent for Will ${will.id}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send midpoint notification for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error sending milestone notifications:', error);
    }
  }

  // NEW: Check and send daily reminder notifications (user-scheduled)
  private async checkDailyReminders(now: Date) {
    try {
      let remindersSent = 0;

      // APPROACH 1: Will-specific reminders
      // Check for ALL active wills that have their own reminderTime set (daily AND one-time/set-duration)
      const willsWithReminders = await db
        .select({
          willId: wills.id,
          reminderTime: wills.reminderTime,
          userId: willCommitments.userId,
          userWhy: willCommitments.why,
          userTimezone: users.timezone,
          lastDailyReminderSentAt: users.lastDailyReminderSentAt,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(
          and(
            eq(wills.status, 'active'),
            isNotNull(wills.reminderTime)
          )
        )
        .limit(100);

      for (const willData of willsWithReminders) {
        try {
          if (!willData.userTimezone) continue;

          // Check if user has a valid device token
          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(
              and(
                eq(deviceTokens.userId, willData.userId),
                eq(deviceTokens.isActive, true)
              )
            )
            .limit(1);

          if (hasToken.length === 0) continue;

          // Convert current time to user's local timezone
          const userLocalTime = this.getTimeInTimezone(now, willData.userTimezone);

          // Check if current time is within ±5 minutes of Will's reminder time
          if (!this.isWithinReminderWindow(userLocalTime, willData.reminderTime!)) {
            continue;
          }

          // Check if we already sent a reminder today (in user's timezone)
          if (this.alreadySentToday(willData.lastDailyReminderSentAt, willData.userTimezone)) {
            continue;
          }

          const success = await pushNotificationService.sendDailyReminderNotification(
            willData.userId, 
            willData.willId
          );

          if (success) {
            await storage.updateUserLastDailyReminderSent(willData.userId);
            remindersSent++;
            console.log(`[SCHEDULER] ✅ Will-specific reminder sent to user ${willData.userId} for Will ${willData.willId} at ${willData.reminderTime} ${willData.userTimezone}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send Will-specific reminder:`, error);
        }
      }

      // APPROACH 2: User-level reminders (legacy/fallback)
      // For wills without specific reminderTime, use user's global dailyReminderTime
      const usersWithReminders = await db
        .select({
          id: users.id,
          dailyReminderTime: users.dailyReminderTime,
          dailyReminderEnabled: users.dailyReminderEnabled,
          timezone: users.timezone,
          lastDailyReminderSentAt: users.lastDailyReminderSentAt,
        })
        .from(users)
        .where(
          and(
            eq(users.dailyReminderEnabled, true),
            isNotNull(users.dailyReminderTime),
            isNotNull(users.timezone)
          )
        )
        .limit(100);

      for (const user of usersWithReminders) {
        try {
          // Check if user has an active daily Will WITHOUT its own reminderTime
          const activeWillsWithCommitment = await db
            .select({ 
              id: wills.id,
              userWhy: willCommitments.why,
              reminderTime: wills.reminderTime,
            })
            .from(wills)
            .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
            .where(
              and(
                eq(willCommitments.userId, user.id),
                eq(wills.status, 'active'),
                isNull(wills.reminderTime) // Only for wills without specific reminder
              )
            )
            .limit(1);

          if (activeWillsWithCommitment.length === 0) {
            continue; // No active Will without specific reminder, skip
          }

          // Check if user has a valid device token
          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(
              and(
                eq(deviceTokens.userId, user.id),
                eq(deviceTokens.isActive, true)
              )
            )
            .limit(1);

          if (hasToken.length === 0) continue;

          // Convert current time to user's local timezone
          const userLocalTime = this.getTimeInTimezone(now, user.timezone!);
          const reminderTime = user.dailyReminderTime!;

          // Check if current time is within ±5 minutes of reminder time
          if (!this.isWithinReminderWindow(userLocalTime, reminderTime)) {
            continue;
          }

          // Check if we already sent a reminder today
          if (this.alreadySentToday(user.lastDailyReminderSentAt, user.timezone!)) {
            continue;
          }

          const willId = activeWillsWithCommitment[0].id;
          const success = await pushNotificationService.sendDailyReminderNotification(user.id, willId);

          if (success) {
            await storage.updateUserLastDailyReminderSent(user.id);
            remindersSent++;
            console.log(`[SCHEDULER] ✅ User-level reminder sent to user ${user.id} at ${reminderTime} ${user.timezone}`);
          }

        } catch (error) {
          console.error(`[SCHEDULER] Failed to send user-level reminder to user ${user.id}:`, error);
        }
      }

      if (remindersSent > 0) {
        console.log(`[SCHEDULER] Daily reminders sent: ${remindersSent}`);
      }

    } catch (error) {
      console.error('[EndRoomScheduler] Error checking daily reminders:', error);
    }
  }

  // Motivational "because" notification — random once per day across all active wills
  private async checkMotivationalNotifications(now: Date) {
    try {
      let sent = 0;

      const activeCommitments = await db
        .select({
          userId: willCommitments.userId,
          willId: willCommitments.willId,
          userWhy: willCommitments.why,
          userTimezone: users.timezone,
          lastMotivationalSentAt: users.lastMotivationalSentAt,
          willStartDate: wills.startDate,
          willEndDate: wills.endDate,
          willIsIndefinite: wills.isIndefinite,
        })
        .from(willCommitments)
        .innerJoin(wills, eq(willCommitments.willId, wills.id))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(
          and(
            eq(wills.status, 'active'),
            isNotNull(willCommitments.why)
          )
        )
        .limit(200);

      const userMap = new Map<string, { why: string; willId: number; timezone: string; lastSent: Date | null; willStartDate: Date | null; willEndDate: Date | null; willIsIndefinite: boolean | null }>();
      for (const row of activeCommitments) {
        if (!row.userTimezone || !row.userWhy) continue;
        if (userMap.has(row.userId)) continue;
        userMap.set(row.userId, {
          why: row.userWhy,
          willId: row.willId,
          timezone: row.userTimezone,
          lastSent: row.lastMotivationalSentAt,
          willStartDate: row.willStartDate,
          willEndDate: row.willEndDate,
          willIsIndefinite: row.willIsIndefinite,
        });
      }

      for (const [userId, data] of Array.from(userMap.entries())) {
        try {
          if (this.alreadySentToday(data.lastSent, data.timezone)) continue;

          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)))
            .limit(1);
          if (hasToken.length === 0) continue;

          const userLocalTime = this.getTimeInTimezone(now, data.timezone);

          // For short-duration wills (<= 24 hours), pick random time within the will's actual window
          const isShortWill = !data.willIsIndefinite && data.willStartDate && data.willEndDate &&
            (new Date(data.willEndDate).getTime() - new Date(data.willStartDate).getTime()) <= 24 * 60 * 60 * 1000;

          const randomHour = isShortWill
            ? this.getShortWillRandomTime(userId, now, data.timezone, data.willStartDate!, data.willEndDate!)
            : this.getDailyRandomHour(userId, now, data.timezone);

          if (!this.isWithinReminderWindow(userLocalTime, randomHour)) continue;

          const success = await pushNotificationService.sendMotivationalNotification(userId, data.why, data.willId);
          if (success) {
            await db.update(users).set({ lastMotivationalSentAt: now }).where(eq(users.id, userId));
            sent++;
            console.log(`[SCHEDULER] \u2705 Motivational notification sent to ${userId} at random time ${randomHour} ${data.timezone}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed motivational notification for ${userId}:`, error);
        }
      }

      if (sent > 0) {
        console.log(`[SCHEDULER] Motivational notifications sent: ${sent}`);
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error checking motivational notifications:', error);
    }
  }

  // Generate a deterministic "random" time (HH:MM) for a user each day (8am-9pm range)
  private getDailyRandomHour(userId: string, now: Date, timezone: string): string {
    const todayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = todayFormatter.format(now);
    const seed = `${userId}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const totalMinutes = Math.abs(hash) % (13 * 60); // 0 to 779 minutes (13 hour range)
    const hour = 8 + Math.floor(totalMinutes / 60); // 8am to 8pm
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // Generate a random time within a short will's actual start-to-end window
  private getShortWillRandomTime(userId: string, now: Date, timezone: string, willStart: Date, willEnd: Date): string {
    const startTime = this.getTimeInTimezone(willStart, timezone);
    const endTime = this.getTimeInTimezone(willEnd, timezone);
    const startMinutes = startTime.hours * 60 + startTime.minutes;
    let endMinutes = endTime.hours * 60 + endTime.minutes;
    // Handle midnight crossing (e.g. 11pm to 2am)
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }
    const windowMinutes = Math.max(endMinutes - startMinutes, 1);

    const todayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = todayFormatter.format(now);
    const seed = `${userId}-${dateStr}-short`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const offset = Math.abs(hash) % windowMinutes;
    const rawMinutes = startMinutes + offset;
    const totalMinutes = rawMinutes % (24 * 60); // Wrap back to 0-23h
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // Helper: Get current time in a specific timezone
  private getTimeInTimezone(date: Date, timezone: string): { hours: number; minutes: number } {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      return { hours, minutes };
    } catch {
      // Fallback to UTC if timezone is invalid
      return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
    }
  }

  // Helper: Check if current time is within ±5 minutes of reminder time
  private isWithinReminderWindow(currentTime: { hours: number; minutes: number }, reminderTime: string): boolean {
    const [reminderHours, reminderMinutes] = reminderTime.split(':').map(Number);
    
    // Convert to total minutes since midnight
    const currentTotalMinutes = currentTime.hours * 60 + currentTime.minutes;
    const reminderTotalMinutes = reminderHours * 60 + reminderMinutes;
    
    // Calculate absolute difference (handle midnight crossing)
    let diff = Math.abs(currentTotalMinutes - reminderTotalMinutes);
    if (diff > 720) {
      diff = 1440 - diff; // Handle crossing midnight
    }
    
    return diff <= 5; // Within 5 minutes
  }

  // Helper: Check if reminder was already sent today in user's timezone
  private alreadySentToday(lastSentAt: Date | null, timezone: string): boolean {
    if (!lastSentAt) {
      return false;
    }

    try {
      const now = new Date();
      
      // Get today's date in user's timezone
      const todayFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayString = todayFormatter.format(now);
      
      // Get the date when reminder was last sent in user's timezone
      const lastSentString = todayFormatter.format(lastSentAt);
      
      return todayString === lastSentString;
    } catch {
      // Fallback to UTC comparison
      const now = new Date();
      return lastSentAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    }
  }
}

export const endRoomScheduler = new EndRoomScheduler();