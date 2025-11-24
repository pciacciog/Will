import * as cron from 'node-cron';
import { db } from './db';
import { wills } from '@shared/schema';
import { eq, and, or, lt, gte, isNull, isNotNull } from 'drizzle-orm';
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
            await pushNotificationService.sendWillStartedNotification(willTitle, committedMembers);
            console.log(`[EndRoomScheduler] Will Started notification sent for Will ${will.id}`);
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
      const roomsToOpen = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            lt(wills.endRoomScheduledAt, now)
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
                const circleMembers = await storage.getCircleMembers(will.circleId);
                const memberIds = circleMembers.map(member => member.userId);
                await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds);
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
                const circleMembers = await storage.getCircleMembers(will.circleId);
                const memberIds = circleMembers.map(member => member.userId);
                await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds);
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
              const circleMembers = await storage.getCircleMembers(will.circleId);
              const memberIds = circleMembers.map(member => member.userId);
              await pushNotificationService.sendEndRoomNotification('live', 'now', memberIds);
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
      
      const roomsToClose = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'open'),
            lt(wills.endRoomOpenedAt, thirtyMinutesAgo)
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
      
      const endRooms24h = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, twentyFourHoursFromNow),
            lt(wills.endRoomScheduledAt, twentyFourHoursOneMinuteFromNow)
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms24h) {
        console.log(`[EndRoomScheduler] Sending 24h End Room notification for Will ${will.id}`);
        try {
          const circleMembers = await storage.getCircleMembers(will.circleId);
          
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
              await pushNotificationService.sendEndRoomNotification('24_hours', endRoomTime, [member.userId]);
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
      
      const endRooms15min = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, fifteenMinutesFromNow),
            lt(wills.endRoomScheduledAt, fifteenMinutesOneMinuteFromNow)
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms15min) {
        console.log(`[EndRoomScheduler] Sending 15min End Room notification for Will ${will.id}`);
        try {
          const circleMembers = await storage.getCircleMembers(will.circleId);
          
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
              await pushNotificationService.sendEndRoomNotification('15_minutes', endRoomTime, [member.userId]);
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
}

export const endRoomScheduler = new EndRoomScheduler();