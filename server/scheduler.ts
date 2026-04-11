import * as cron from 'node-cron';
import { db } from './db';
import { wills, willCommitments, circleMembers, willAcknowledgments, commitmentReminders, willReviews, users, deviceTokens, circleProofs, cloudinaryCleanupLog, teamWillInvites } from '@shared/schema';
import { eq, and, or, lt, gte, isNull, isNotNull, ne, notInArray, inArray } from 'drizzle-orm';
import { cloudinary } from './cloudinary';
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

    // NEW: Send random motivational "because" notifications (once per day) — legacy Wills only
    await this.checkMotivationalNotifications(now);

    // Category-aware notifications
    await this.checkHabitReminders(now);
    await this.checkAbstainReminder(now);
    await this.checkMilestoneNotifications(now);
    await this.checkDeadlineReminders(now);
    await this.checkMissionDailyNudge(now);

    // Team Will: activate or terminate at startDate, send 24h reminder to pending invitees
    await this.processTeamWillActivation(now);
    await this.sendTeamWillInviteReminders(now);

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
      // NOTE: Shared wills are handled separately by processTeamWillActivation
      const willsToActivate = await db
        .select({
          id: wills.id,
          mode: wills.mode,
          status: wills.status,
          startDate: wills.startDate,
          endDate: wills.endDate
        })
        .from(wills)
        .where(
          and(
            or(eq(wills.status, 'pending'), eq(wills.status, 'scheduled')),
            lt(wills.startDate, now),
            ne(wills.mode, 'team')
          )
        )
        .limit(50); // Limit to prevent memory issues in large datasets

      if (willsToActivate.length > 0) {
        console.log(`[SCHEDULER] Found ${willsToActivate.length} Wills to activate`);
      }

      for (const will of willsToActivate) {
        console.log(`[SCHEDULER] ⏩ Activating Will ${will.id} (started at ${will.startDate.toISOString()})`);
        await storage.updateWillStatus(will.id, 'active');
        
        // Send Will Started notification — each member gets their own commitment text
        try {
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (willWithCommitments && willWithCommitments.commitments) {
            const isSoloMode = will.mode !== 'team';
            for (const commitment of willWithCommitments.commitments) {
              const displayTitle = willWithCommitments.title || commitment.what || willWithCommitments.sharedWhat || "Your Will";
              await pushNotificationService.sendWillStartedNotification(displayTitle, [commitment.userId], will.id, isSoloMode);
            }
            console.log(`[EndRoomScheduler] Will Started notifications sent for Will ${will.id} (${willWithCommitments.commitments.length} members, solo: ${isSoloMode})`);
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
              const reviewNotifTitle = willWithCommitments.title || willWithCommitments.commitments[0]?.what || willWithCommitments.sharedWhat || undefined;
              await pushNotificationService.sendWillReviewRequiredNotification(will.id, participants, reviewNotifTitle);

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

          // RETRY LOGIC: Send missed will_review_required notification if not already sent
          // This catches cases where the server was down during the status transition
          if (!will.completionNotificationSentAt) {
            try {
              console.log(`[SCHEDULER] 🔄 Retrying missed notification for Will ${will.id} (already in will_review)`);
              const participants = willWithCommitments.commitments?.map(c => c.userId) || [];
              if (participants.length > 0) {
                const retryNotifTitle = willWithCommitments.title || willWithCommitments.commitments?.[0]?.what || willWithCommitments.sharedWhat || undefined;
                await pushNotificationService.sendWillReviewRequiredNotification(will.id, participants, retryNotifTitle);
                await db.update(wills)
                  .set({ completionNotificationSentAt: now })
                  .where(eq(wills.id, will.id));
                console.log(`[SCHEDULER] ✅ Retry successful - Will Completed Review notification sent for Will ${will.id}`);
              }
            } catch (error) {
              console.error(`[SCHEDULER] Failed to retry notification for Will ${will.id}:`, error);
            }
          }

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
            eq(wills.mode, 'team') // End Rooms are for team wills
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
                
                const circleMembers = await this.getTeamWillParticipants(will.id);
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
                
                const circleMembers = await this.getTeamWillParticipants(will.id);
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
              
              const circleMembers = await this.getTeamWillParticipants(will.id);
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
            eq(wills.mode, 'team') // End Rooms are for team wills
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
            eq(wills.mode, 'team') // End Rooms are for team wills
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms24h) {
        console.log(`[EndRoomScheduler] Sending 24h End Room notification for Will ${will.id}`);
        try {
          
          const circleMembers = await this.getTeamWillParticipants(will.id);
          
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
            eq(wills.mode, 'team') // End Rooms are for team wills
          )
        )
        .limit(30); // Limit notification batch size

      for (const will of endRooms15min) {
        console.log(`[EndRoomScheduler] Sending 15min End Room notification for Will ${will.id}`);
        try {
          
          const circleMembers = await this.getTeamWillParticipants(will.id);
          
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

  /**
   * Returns all participants of a team will: the creator plus all users with accepted invites.
   * Returns objects with { userId, user: { firstName, timezone } } matching the old getCircleMembers shape.
   */
  private async getTeamWillParticipants(willId: number): Promise<Array<{ userId: string; user: { firstName: string; timezone: string | null } }>> {
    const will = await db.select({ createdBy: wills.createdBy }).from(wills).where(eq(wills.id, willId)).limit(1);
    if (!will.length) return [];

    const acceptedInvites = await db
      .select({ invitedUserId: teamWillInvites.invitedUserId })
      .from(teamWillInvites)
      .where(and(eq(teamWillInvites.willId, willId), eq(teamWillInvites.status, 'accepted')));

    const participantIds = [will[0].createdBy, ...acceptedInvites.map(i => i.invitedUserId)];
    const uniqueIds = [...new Set(participantIds)];

    const participantUsers = await db
      .select({ id: users.id, firstName: users.firstName, timezone: users.timezone })
      .from(users)
      .where(inArray(users.id, uniqueIds));

    return participantUsers.map(u => ({ userId: u.id, user: { firstName: u.firstName, timezone: u.timezone } }));
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
            eq(wills.mode, 'team') // Only team wills have pending commitment reminders
          )
        )
        .limit(20);

      for (const will of pendingWills) {
        try {
          // Get all circle members
          const allCircleMembers = await this.getTeamWillParticipants(will.id);
          
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
            // Fallback chain: title ?? any committed member's what ?? sharedWhat
            let anyCommittedWhat: string | undefined;
            if (committedUserIds.length > 0) {
              const allCommitments = await storage.getWillCommitments(will.id);
              anyCommittedWhat = allCommitments.find(c => committedUserIds.includes(c.userId))?.what ?? undefined;
            }
            const commitmentDisplayTitle = will.title || anyCommittedWhat || will.sharedWhat || undefined;
            await pushNotificationService.sendCommitmentReminderNotification(will.id, userIdsToRemind, commitmentDisplayTitle);
            
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

      // 2. WILL REVIEW REMINDERS: Escalating daily reminders for 3 days + auto-complete
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
          const commitments = await db
            .select()
            .from(willCommitments)
            .where(eq(willCommitments.willId, will.id));

          const reviewedUsers = await db
            .select({ userId: willReviews.userId })
            .from(willReviews)
            .where(eq(willReviews.willId, will.id));
          const reviewedUserIds = reviewedUsers.map(r => r.userId);

          const unreviewedCommitments = commitments.filter(
            c => !reviewedUserIds.includes(c.userId)
          );

          if (unreviewedCommitments.length === 0) continue;

          // Calculate days since will entered review (endDate = when will ended)
          const reviewStartDate = will.endDate || will.completionNotificationSentAt || now;
          const daysSinceReview = (now.getTime() - new Date(reviewStartDate).getTime()) / (1000 * 60 * 60 * 24);

          // AUTO-COMPLETE after 3 days: submit skipped reviews for all unreviewed members
          if (daysSinceReview >= 3) {
            let autoCompletedCount = 0;
            for (const commitment of unreviewedCommitments) {
              // Idempotent check: skip if review already exists (e.g., from a previous partial run)
              const existingReview = await db
                .select({ id: willReviews.id })
                .from(willReviews)
                .where(and(eq(willReviews.willId, will.id), eq(willReviews.userId, commitment.userId)))
                .limit(1);
              if (existingReview.length > 0) continue;

              await db.insert(willReviews).values({
                willId: will.id,
                userId: commitment.userId,
                followThrough: 'skipped',
                reflectionText: 'Auto-completed: review period expired after 3 days.',
              });
              autoCompletedCount++;
              console.log(`[SCHEDULER] ⏭️ Auto-completed review for user ${commitment.userId} on Will ${will.id}`);
            }

            // Transition will to completed
            await db.update(wills)
              .set({ status: 'completed' })
              .where(and(eq(wills.id, will.id), eq(wills.status, 'will_review')));
            console.log(`[SCHEDULER] ✅ Will ${will.id} auto-completed after 3-day review deadline (${autoCompletedCount} reviews auto-submitted)`);
            continue;
          }

          // ESCALATING REMINDERS: Send daily reminders to unreviewed members
          // Only send if 24+ hours since last reminder (or never reminded)
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const unreviewedToRemind = unreviewedCommitments.filter(
            c => !c.ackReminderSentAt || new Date(c.ackReminderSentAt) < oneDayAgo
          );

          if (unreviewedToRemind.length > 0) {
            const userIdsToRemind = unreviewedToRemind.map(c => c.userId);
            const isSoloMode = will.mode === 'solo';
            const isFinalWarning = daysSinceReview >= 2;

            // Fallback chain: title ?? any unreviewed member's what ?? sharedWhat
            let reviewCommitmentWhat: string | undefined;
            if (unreviewedToRemind.length > 0) {
              reviewCommitmentWhat = unreviewedToRemind[0].what ?? undefined;
            }
            const reviewWillDisplay = will.title || reviewCommitmentWhat || will.sharedWhat || undefined;
            if (isFinalWarning) {
              await pushNotificationService.sendFinalReviewWarningNotification(will.id, userIdsToRemind, isSoloMode, reviewWillDisplay);
            } else {
              await pushNotificationService.sendWillReviewReminderNotification(will.id, userIdsToRemind, isSoloMode, reviewWillDisplay);
            }

            for (const commitment of unreviewedToRemind) {
              await db.update(willCommitments)
                .set({ ackReminderSentAt: now })
                .where(eq(willCommitments.id, commitment.id));
            }
            console.log(`[SCHEDULER] ✅ Will review ${isFinalWarning ? 'FINAL WARNING' : 'reminder'} sent to ${userIdsToRemind.length} users for Will ${will.id} (day ${Math.floor(daysSinceReview) + 1})`);
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
      // Find active set-date wills where midpoint has passed but notification hasn't been sent
      // Only for wills with defined end dates (skip indefinite/ongoing wills)
      const willsAtMidpoint = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'active'),
            eq(wills.isIndefinite, false),
            isNotNull(wills.endDate),
            lt(wills.midpointAt, now),
            isNull(wills.midpointNotificationSentAt)
          )
        )
        .limit(20);

      for (const will of willsAtMidpoint) {
        try {
          const updateResult = await db.update(wills)
            .set({ midpointNotificationSentAt: now })
            .where(
              and(
                eq(wills.id, will.id),
                isNull(wills.midpointNotificationSentAt)
              )
            )
            .returning({ id: wills.id });
          
          if (updateResult.length === 0) {
            console.log(`[SCHEDULER] ⏭️ Midpoint notification already sent for Will ${will.id} (skipping duplicate)`);
            continue;
          }
          
          const willWithCommitments = await storage.getWillWithCommitments(will.id);
          if (willWithCommitments && willWithCommitments.commitments) {
            const committedMembers = willWithCommitments.commitments.map(c => c.userId);
            const willStatement = willWithCommitments.title || willWithCommitments.commitments[0]?.what || will.sharedWhat || undefined;
            await pushNotificationService.sendMidpointMilestoneNotification(
              will.id,
              committedMembers,
              will.endDate!,
              willStatement
            );
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

  private async checkDailyReminders(now: Date) {
    try {
      let remindersSent = 0;

      // APPROACH 1: Per-commitment check-in reminders (each commitment fires independently at its own time)
      // Covers: wills with reminderTime set OR commitments with checkInTime set
      // Skips: final_review/one-time check-in types (no daily notifications)
      const willsWithReminders = await db
        .select({
          commitmentId: willCommitments.id,
          willId: wills.id,
          willTitle: wills.title,
          willSharedWhat: wills.sharedWhat,
          commitmentWhat: willCommitments.what,
          willReminderTime: wills.reminderTime,
          commitmentCheckInTime: willCommitments.checkInTime,
          lastCheckInReminderSentAt: willCommitments.lastCheckInReminderSentAt,
          userId: willCommitments.userId,
          userTimezone: users.timezone,
          willCheckInType: wills.checkInType,
          commitmentCheckInType: willCommitments.checkInType,
          willActiveDays: wills.activeDays,
          willCustomDays: wills.customDays,
          commitmentActiveDays: willCommitments.activeDays,
          commitmentCustomDays: willCommitments.customDays,
          commitmentCategory: wills.commitmentCategory,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(
          and(
            eq(wills.status, 'active'),
            or(isNotNull(wills.reminderTime), isNotNull(willCommitments.checkInTime))
          )
        )
        .limit(200);

      for (const willData of willsWithReminders) {
        try {
          if (!willData.userTimezone) continue;

          // Category-aware: Abstain and Mission never get check-in notifications
          if (willData.commitmentCategory === 'abstain' || willData.commitmentCategory === 'mission') continue;

          const effectiveCheckInType = willData.commitmentCheckInType || willData.willCheckInType || 'daily';
          if (effectiveCheckInType === 'final_review' || effectiveCheckInType === 'one-time') continue;

          if (effectiveCheckInType === 'specific_days') {
            const effectiveActiveDays = willData.commitmentActiveDays || willData.willActiveDays;
            const effectiveCustomDays = willData.commitmentCustomDays || willData.willCustomDays;
            if (!this.isTodayActiveDay(now, willData.userTimezone, effectiveActiveDays, effectiveCustomDays)) continue;
          }

          const effectiveReminderTime = willData.commitmentCheckInTime || willData.willReminderTime;
          if (!effectiveReminderTime) continue;

          if (this.alreadySentForScheduledOccurrence(willData.lastCheckInReminderSentAt, willData.userTimezone, effectiveReminderTime)) continue;

          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(and(eq(deviceTokens.userId, willData.userId), eq(deviceTokens.isActive, true)))
            .limit(1);
          if (hasToken.length === 0) continue;

          const userLocalTime = this.getTimeInTimezone(now, willData.userTimezone);
          if (!this.isWithinReminderWindow(userLocalTime, effectiveReminderTime)) continue;

          const dailyDisplayTitle = willData.willTitle || willData.commitmentWhat || willData.willSharedWhat || undefined;
          const success = await pushNotificationService.sendDailyReminderNotification(willData.userId, willData.willId, dailyDisplayTitle);
          if (success) {
            await db.update(willCommitments).set({ lastCheckInReminderSentAt: now }).where(eq(willCommitments.id, willData.commitmentId));
            remindersSent++;
            console.log(`[SCHEDULER] ✅ Commitment-specific reminder sent to user ${willData.userId} for Will ${willData.willId} at ${effectiveReminderTime}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send commitment-specific reminder:`, error);
        }
      }

      // APPROACH 2: Short-duration wills (<=24 hours) without check-in time — random time within the will's active window
      // Skips: final_review/one-time check-in types
      const shortWills = await db
        .select({
          commitmentId: willCommitments.id,
          willId: wills.id,
          willTitle: wills.title,
          willSharedWhat: wills.sharedWhat,
          commitmentWhat: willCommitments.what,
          willStartDate: wills.startDate,
          willEndDate: wills.endDate,
          lastCheckInReminderSentAt: willCommitments.lastCheckInReminderSentAt,
          userId: willCommitments.userId,
          userTimezone: users.timezone,
          willCheckInType: wills.checkInType,
          commitmentCheckInType: willCommitments.checkInType,
          willActiveDays: wills.activeDays,
          willCustomDays: wills.customDays,
          commitmentActiveDays: willCommitments.activeDays,
          commitmentCustomDays: willCommitments.customDays,
          commitmentCategory: wills.commitmentCategory,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(
          and(
            eq(wills.status, 'active'),
            eq(wills.isIndefinite, false),
            isNotNull(wills.endDate),
            isNull(wills.reminderTime),
            isNull(willCommitments.checkInTime)
          )
        )
        .limit(100);

      for (const willData of shortWills) {
        try {
          if (!willData.userTimezone || !willData.willEndDate) continue;

          // Category-aware: Abstain and Mission never get check-in notifications
          if (willData.commitmentCategory === 'abstain' || willData.commitmentCategory === 'mission') continue;

          const effectiveCheckInType = willData.commitmentCheckInType || willData.willCheckInType || 'daily';
          if (effectiveCheckInType === 'final_review' || effectiveCheckInType === 'one-time') continue;

          if (effectiveCheckInType === 'specific_days') {
            const effectiveActiveDays = willData.commitmentActiveDays || willData.willActiveDays;
            const effectiveCustomDays = willData.commitmentCustomDays || willData.willCustomDays;
            if (!this.isTodayActiveDay(now, willData.userTimezone, effectiveActiveDays, effectiveCustomDays)) continue;
          }

          const durationMs = new Date(willData.willEndDate).getTime() - new Date(willData.willStartDate).getTime();
          if (durationMs > 24 * 60 * 60 * 1000) continue;

          const targetTime = this.getShortWillRandomTime(willData.userId, now, willData.userTimezone, willData.willStartDate, willData.willEndDate, 'checkin');

          if (this.alreadySentForScheduledOccurrence(willData.lastCheckInReminderSentAt, willData.userTimezone, targetTime)) continue;

          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(and(eq(deviceTokens.userId, willData.userId), eq(deviceTokens.isActive, true)))
            .limit(1);
          if (hasToken.length === 0) continue;

          const userLocalTime = this.getTimeInTimezone(now, willData.userTimezone);

          if (!this.isWithinReminderWindow(userLocalTime, targetTime)) continue;

          const shortWillDisplayTitle = willData.willTitle || willData.commitmentWhat || willData.willSharedWhat || undefined;
          const success = await pushNotificationService.sendDailyReminderNotification(willData.userId, willData.willId, shortWillDisplayTitle);
          if (success) {
            await db.update(willCommitments).set({ lastCheckInReminderSentAt: now }).where(eq(willCommitments.id, willData.commitmentId));
            remindersSent++;
            console.log(`[SCHEDULER] ✅ Short-will check-in sent to user ${willData.userId} for Will ${willData.willId} at random time ${targetTime}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to send short-will check-in reminder:`, error);
        }
      }

      if (remindersSent > 0) {
        console.log(`[SCHEDULER] Check-in reminders sent: ${remindersSent}`);
      }

    } catch (error) {
      console.error('[EndRoomScheduler] Error checking daily reminders:', error);
    }
  }

  // ─── CATEGORY-AWARE NOTIFICATION FUNCTIONS ────────────────────────────────

  // Habit: fires at wills.reminderTime — replaces random motivational for habit Wills
  private async checkHabitReminders(now: Date) {
    try {
      const rows = await db
        .select({
          commitmentId: willCommitments.id,
          willId: wills.id,
          userId: willCommitments.userId,
          userTimezone: users.timezone,
          userWhat: willCommitments.what,
          userWhy: willCommitments.why,
          reminderTime: wills.reminderTime,
          lastMotivationalSentAt: willCommitments.lastMotivationalSentAt,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(and(
          eq(wills.status, 'active'),
          eq(wills.commitmentCategory, 'habit'),
          isNotNull(wills.reminderTime),
        ))
        .limit(200);

      for (const row of rows) {
        try {
          if (!row.userTimezone || !row.reminderTime) continue;
          if (this.alreadySentForScheduledOccurrence(row.lastMotivationalSentAt, row.userTimezone, row.reminderTime)) continue;
          const hasToken = await db.select({ id: deviceTokens.id }).from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true))).limit(1);
          if (hasToken.length === 0) continue;
          const userLocalTime = this.getTimeInTimezone(now, row.userTimezone);
          if (!this.isWithinReminderWindow(userLocalTime, row.reminderTime)) continue;
          const success = await pushNotificationService.sendHabitReminderNotification(row.userId, row.userWhat || '', row.userWhy || undefined, row.willId);
          if (success) {
            await db.update(willCommitments).set({ lastMotivationalSentAt: now }).where(eq(willCommitments.id, row.commitmentId));
            console.log(`[SCHEDULER] ✅ Habit reminder sent to user ${row.userId} for Will ${row.willId}`);
          }
        } catch (err) {
          console.error(`[SCHEDULER] Habit reminder error for user ${row.userId}:`, err);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error in checkHabitReminders:', error);
    }
  }

  // Abstain: daily reminder fires at wills.reminderTime
  private async checkAbstainReminder(now: Date) {
    try {
      const rows = await db
        .select({
          commitmentId: willCommitments.id,
          willId: wills.id,
          userId: willCommitments.userId,
          userTimezone: users.timezone,
          userWhat: willCommitments.what,
          userWhy: willCommitments.why,
          reminderTime: wills.reminderTime,
          lastMotivationalSentAt: willCommitments.lastMotivationalSentAt,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(and(
          eq(wills.status, 'active'),
          eq(wills.commitmentCategory, 'abstain'),
          isNotNull(wills.reminderTime),
        ))
        .limit(200);

      for (const row of rows) {
        try {
          if (!row.userTimezone || !row.reminderTime) continue;
          if (this.alreadySentForScheduledOccurrence(row.lastMotivationalSentAt, row.userTimezone, row.reminderTime)) continue;
          const hasToken = await db.select({ id: deviceTokens.id }).from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true))).limit(1);
          if (hasToken.length === 0) continue;
          const userLocalTime = this.getTimeInTimezone(now, row.userTimezone);
          if (!this.isWithinReminderWindow(userLocalTime, row.reminderTime)) continue;
          const success = await pushNotificationService.sendAbstainReminderNotification(row.userId, row.userWhat || '', row.userWhy || undefined, row.willId);
          if (success) {
            await db.update(willCommitments).set({ lastMotivationalSentAt: now }).where(eq(willCommitments.id, row.commitmentId));
            console.log(`[SCHEDULER] ✅ Abstain reminder sent to user ${row.userId} for Will ${row.willId}`);
          }
        } catch (err) {
          console.error(`[SCHEDULER] Abstain reminder error for user ${row.userId}:`, err);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error in checkAbstainReminder:', error);
    }
  }

  // Abstain: milestone celebrations — fires when streak day matches a milestone day
  private async checkMilestoneNotifications(now: Date) {
    try {
      const rows = await db
        .select({
          willId: wills.id,
          userId: wills.createdBy,
          userTimezone: users.timezone,
          milestones: wills.milestones,
          sentMilestones: wills.sentMilestones,
          streakStartDate: wills.streakStartDate,
          startDate: wills.startDate,
        })
        .from(wills)
        .innerJoin(users, eq(wills.createdBy, users.id))
        .where(and(
          eq(wills.status, 'active'),
          eq(wills.commitmentCategory, 'abstain'),
          isNotNull(wills.milestones),
        ))
        .limit(200);

      for (const row of rows) {
        try {
          if (!row.userTimezone) continue;
          const milestonesRaw: { day: number; label: string }[] = (() => {
            try { return JSON.parse(row.milestones || '[]'); } catch { return []; }
          })();
          if (milestonesRaw.length === 0) continue;

          const sentDays: number[] = (() => {
            try { return JSON.parse(row.sentMilestones || '[]'); } catch { return []; }
          })();

          const streakRef = row.streakStartDate || row.startDate;
          const streakRefLocal = new Date(streakRef);
          const nowLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: row.userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const streakRefLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: row.userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(streakRefLocal);
          const msPerDay = 24 * 60 * 60 * 1000;
          const nowDate = new Date(nowLocalStr);
          const refDate = new Date(streakRefLocalStr);
          const streakDay = Math.floor((nowDate.getTime() - refDate.getTime()) / msPerDay) + 1;

          const hasToken = await db.select({ id: deviceTokens.id }).from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true))).limit(1);
          if (hasToken.length === 0) continue;

          let updatedSent = [...sentDays];
          let fired = false;

          for (const ms of milestonesRaw) {
            if (sentDays.includes(ms.day)) continue;
            if (streakDay !== ms.day) continue;
            const success = await pushNotificationService.sendMilestoneNotification(row.userId, ms.label, ms.day, row.willId);
            if (success) {
              updatedSent.push(ms.day);
              fired = true;
              console.log(`[SCHEDULER] ✅ Milestone day ${ms.day} sent to user ${row.userId} for Will ${row.willId}`);
            }
          }

          if (fired) {
            await db.update(wills).set({ sentMilestones: JSON.stringify(updatedSent) }).where(eq(wills.id, row.willId));
          }
        } catch (err) {
          console.error(`[SCHEDULER] Milestone error for Will ${row.willId}:`, err);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error in checkMilestoneNotifications:', error);
    }
  }

  // Mission: fires deadline reminders at 3 days, 1 day, and day-of
  private async checkDeadlineReminders(now: Date) {
    try {
      const rows = await db
        .select({
          willId: wills.id,
          userId: wills.createdBy,
          userTimezone: users.timezone,
          userWhat: willCommitments.what,
          userWhy: willCommitments.why,
          endDate: wills.endDate,
          deadlineReminders: wills.deadlineReminders,
          sentDeadlineReminders: wills.sentDeadlineReminders,
        })
        .from(wills)
        .innerJoin(users, eq(wills.createdBy, users.id))
        .leftJoin(willCommitments, and(eq(willCommitments.willId, wills.id), eq(willCommitments.userId, wills.createdBy)))
        .where(and(
          eq(wills.status, 'active'),
          eq(wills.commitmentCategory, 'mission'),
          isNotNull(wills.deadlineReminders),
          isNotNull(wills.endDate),
        ))
        .limit(200);

      for (const row of rows) {
        try {
          if (!row.userTimezone || !row.endDate) continue;
          const config: { threeDays?: boolean; oneDay?: boolean; dayOf?: boolean } = (() => {
            try { return JSON.parse(row.deadlineReminders || '{}'); } catch { return {}; }
          })();
          const sentKeys: string[] = (() => {
            try { return JSON.parse(row.sentDeadlineReminders || '[]'); } catch { return []; }
          })();

          const nowLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: row.userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const endLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: row.userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.endDate));
          const msPerDay = 24 * 60 * 60 * 1000;
          const daysLeft = Math.round((new Date(endLocalStr).getTime() - new Date(nowLocalStr).getTime()) / msPerDay);

          const hasToken = await db.select({ id: deviceTokens.id }).from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true))).limit(1);
          if (hasToken.length === 0) continue;

          const what = row.userWhat || '';
          const why = row.userWhy || undefined;
          let updatedSent = [...sentKeys];
          let fired = false;

          const checks: { key: string; enabled: boolean | undefined; days: number; title: string }[] = [
            { key: 'threeDays', enabled: config.threeDays, days: 3, title: `3 days left — ${what.slice(0, 40)}` },
            { key: 'oneDay',    enabled: config.oneDay,    days: 1, title: `1 day left — ${what.slice(0, 40)}` },
            { key: 'dayOf',     enabled: config.dayOf,     days: 0, title: `Today is the day — ${what.slice(0, 40)}` },
          ];

          for (const check of checks) {
            if (!check.enabled) continue;
            if (sentKeys.includes(check.key)) continue;
            if (daysLeft !== check.days) continue;
            const success = await pushNotificationService.sendDeadlineReminderNotification(row.userId, check.title, why, row.willId);
            if (success) {
              updatedSent.push(check.key);
              fired = true;
              console.log(`[SCHEDULER] ✅ Deadline reminder '${check.key}' sent to user ${row.userId} for Will ${row.willId}`);
            }
          }

          if (fired) {
            await db.update(wills).set({ sentDeadlineReminders: JSON.stringify(updatedSent) }).where(eq(wills.id, row.willId));
          }
        } catch (err) {
          console.error(`[SCHEDULER] Deadline reminder error for Will ${row.willId}:`, err);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error in checkDeadlineReminders:', error);
    }
  }

  // Mission: optional daily nudge at missionReminderTime
  private async checkMissionDailyNudge(now: Date) {
    try {
      const rows = await db
        .select({
          commitmentId: willCommitments.id,
          willId: wills.id,
          userId: willCommitments.userId,
          userTimezone: users.timezone,
          userWhat: willCommitments.what,
          userWhy: willCommitments.why,
          missionReminderTime: wills.missionReminderTime,
          lastMotivationalSentAt: willCommitments.lastMotivationalSentAt,
        })
        .from(wills)
        .innerJoin(willCommitments, eq(wills.id, willCommitments.willId))
        .innerJoin(users, eq(willCommitments.userId, users.id))
        .where(and(
          eq(wills.status, 'active'),
          eq(wills.commitmentCategory, 'mission'),
          isNotNull(wills.missionReminderTime),
        ))
        .limit(200);

      for (const row of rows) {
        try {
          if (!row.userTimezone || !row.missionReminderTime) continue;
          if (this.alreadySentForScheduledOccurrence(row.lastMotivationalSentAt, row.userTimezone, row.missionReminderTime)) continue;
          const hasToken = await db.select({ id: deviceTokens.id }).from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true))).limit(1);
          if (hasToken.length === 0) continue;
          const userLocalTime = this.getTimeInTimezone(now, row.userTimezone);
          if (!this.isWithinReminderWindow(userLocalTime, row.missionReminderTime)) continue;
          const success = await pushNotificationService.sendMissionNudgeNotification(row.userId, row.userWhat || '', row.userWhy || undefined, row.willId);
          if (success) {
            await db.update(willCommitments).set({ lastMotivationalSentAt: now }).where(eq(willCommitments.id, row.commitmentId));
            console.log(`[SCHEDULER] ✅ Mission nudge sent to user ${row.userId} for Will ${row.willId}`);
          }
        } catch (err) {
          console.error(`[SCHEDULER] Mission nudge error for user ${row.userId}:`, err);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error in checkMissionDailyNudge:', error);
    }
  }

  // ─── END CATEGORY-AWARE FUNCTIONS ─────────────────────────────────────────

  // Motivational "because" notification — random once per day across all active wills
  private async checkMotivationalNotifications(now: Date) {
    try {
      let sent = 0;

      // Per-commitment motivational notifications: each commitment sends its own "Because..." independently
      // Skips: final_review/one-time check-in types; specific_days only on active days
      const activeCommitments = await db
        .select({
          commitmentId: willCommitments.id,
          userId: willCommitments.userId,
          willId: willCommitments.willId,
          willTitle: wills.title,
          userWhat: willCommitments.what,
          userWhy: willCommitments.why,
          userTimezone: users.timezone,
          lastMotivationalSentAt: willCommitments.lastMotivationalSentAt,
          willStartDate: wills.startDate,
          willEndDate: wills.endDate,
          willIsIndefinite: wills.isIndefinite,
          willCheckInType: wills.checkInType,
          commitmentCheckInType: willCommitments.checkInType,
          willActiveDays: wills.activeDays,
          willCustomDays: wills.customDays,
          commitmentActiveDays: willCommitments.activeDays,
          commitmentCustomDays: willCommitments.customDays,
          commitmentCategory: wills.commitmentCategory,
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

      for (const row of activeCommitments) {
        try {
          if (!row.userTimezone || !row.userWhy) continue;

          // Category-aware: skip categorized Wills — handled by dedicated functions
          if (row.commitmentCategory !== null) continue;

          const effectiveCheckInType = row.commitmentCheckInType || row.willCheckInType || 'daily';
          if (effectiveCheckInType === 'final_review' || effectiveCheckInType === 'one-time') continue;

          if (effectiveCheckInType === 'specific_days') {
            const effectiveActiveDays = row.commitmentActiveDays || row.willActiveDays;
            const effectiveCustomDays = row.commitmentCustomDays || row.willCustomDays;
            if (!this.isTodayActiveDay(now, row.userTimezone, effectiveActiveDays, effectiveCustomDays)) continue;
          }

          const hasToken = await db
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .where(and(eq(deviceTokens.userId, row.userId), eq(deviceTokens.isActive, true)))
            .limit(1);
          if (hasToken.length === 0) continue;

          const userLocalTime = this.getTimeInTimezone(now, row.userTimezone);

          const isShortWill = !row.willIsIndefinite && row.willStartDate && row.willEndDate &&
            (new Date(row.willEndDate).getTime() - new Date(row.willStartDate).getTime()) <= 24 * 60 * 60 * 1000;

          const willSeed = `${row.userId}-will${row.willId}`;
          let randomHour = isShortWill
            ? this.getShortWillRandomTime(row.userId, now, row.userTimezone, row.willStartDate!, row.willEndDate!, 'motivational')
            : this.getDailyRandomHourForWill(willSeed, now, row.userTimezone);

          if (isShortWill) {
            const checkinTime = this.getShortWillRandomTime(row.userId, now, row.userTimezone, row.willStartDate!, row.willEndDate!, 'checkin');
            if (randomHour === checkinTime) {
              const startTime = this.getTimeInTimezone(row.willStartDate!, row.userTimezone);
              const endTime = this.getTimeInTimezone(row.willEndDate!, row.userTimezone);
              const startMin = startTime.hours * 60 + startTime.minutes;
              let endMin = endTime.hours * 60 + endTime.minutes;
              if (endMin <= startMin) endMin += 24 * 60;

              const [h, m] = randomHour.split(':').map(Number);
              let shifted = h * 60 + m + 15;
              if (shifted > endMin) shifted = startMin + Math.floor((endMin - startMin) / 2);
              const clampedMin = shifted % (24 * 60);
              randomHour = `${Math.floor(clampedMin / 60).toString().padStart(2, '0')}:${(clampedMin % 60).toString().padStart(2, '0')}`;
            }
          }

          if (this.alreadySentForScheduledOccurrence(row.lastMotivationalSentAt, row.userTimezone, randomHour)) continue;

          if (!this.isWithinReminderWindow(userLocalTime, randomHour)) continue;

          const motivationalDisplayTitle = row.willTitle || row.userWhat || undefined;
          const success = await pushNotificationService.sendMotivationalNotification(row.userId, row.userWhy, row.willId, motivationalDisplayTitle);
          if (success) {
            await db.update(willCommitments).set({ lastMotivationalSentAt: now }).where(eq(willCommitments.id, row.commitmentId));
            sent++;
            console.log(`[SCHEDULER] ✅ Motivational notification sent to ${row.userId} for Will ${row.willId} at random time ${randomHour} ${row.userTimezone}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed motivational notification for ${row.userId}:`, error);
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
    return this.getDailyRandomHourForWill(userId, now, timezone);
  }

  // Generate a deterministic "random" time (HH:MM) for a specific seed (user+will) each day (8am-9pm range)
  private getDailyRandomHourForWill(seed: string, now: Date, timezone: string): string {
    const todayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = todayFormatter.format(now);
    const fullSeed = `${seed}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < fullSeed.length; i++) {
      hash = ((hash << 5) - hash) + fullSeed.charCodeAt(i);
      hash |= 0;
    }
    const totalMinutes = Math.abs(hash) % (13 * 60); // 0 to 779 minutes (13 hour range)
    const hour = 8 + Math.floor(totalMinutes / 60); // 8am to 8pm
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private getShortWillRandomTime(userId: string, now: Date, timezone: string, willStart: Date, willEnd: Date, seedSuffix: string = 'short'): string {
    const startTime = this.getTimeInTimezone(willStart, timezone);
    const endTime = this.getTimeInTimezone(willEnd, timezone);
    const startMinutes = startTime.hours * 60 + startTime.minutes;
    let endMinutes = endTime.hours * 60 + endTime.minutes;
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
    const seed = `${userId}-${dateStr}-${seedSuffix}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const offset = Math.abs(hash) % windowMinutes;
    const rawMinutes = startMinutes + offset;
    const totalMinutes = rawMinutes % (24 * 60);
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

  // Helper: Check if current time is within the reminder window
  // Uses a 2-hour FORWARD catch-up window: fires if current time is between
  // reminderTime and reminderTime + 2 hours. This ensures notifications still
  // fire if the server was asleep at the exact scheduled time (e.g. Autoscale).
  private isWithinReminderWindow(currentTime: { hours: number; minutes: number }, reminderTime: string): boolean {
    const [reminderHours, reminderMinutes] = reminderTime.split(':').map(Number);
    
    const currentTotalMinutes = currentTime.hours * 60 + currentTime.minutes;
    const reminderTotalMinutes = reminderHours * 60 + reminderMinutes;
    
    let diff = currentTotalMinutes - reminderTotalMinutes;
    if (diff < -720) {
      diff += 1440;
    } else if (diff > 720) {
      diff -= 1440;
    }
    
    return diff >= 0 && diff <= 120;
  }

  private isTodayActiveDay(now: Date, timezone: string, activeDays: string | null, customDays: string | null): boolean {
    try {
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });
      const dayName = dayFormatter.format(now);
      const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const todayDayNumber = dayMap[dayName] ?? new Date().getDay();

      if (activeDays === 'every_day' || !activeDays) return true;
      if (activeDays === 'weekdays') return todayDayNumber >= 1 && todayDayNumber <= 5;
      if (activeDays === 'custom' && customDays) {
        try {
          const days: number[] = JSON.parse(customDays);
          return days.includes(todayDayNumber);
        } catch {
          return true;
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  private alreadySentForScheduledOccurrence(lastSentAt: Date | null, timezone: string, reminderTime?: string): boolean {
    if (!lastSentAt) {
      return false;
    }

    try {
      const now = new Date();
      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const todayString = dateFormatter.format(now);
      const lastSentString = dateFormatter.format(lastSentAt);

      if (!reminderTime) {
        return todayString === lastSentString;
      }

      const userLocalTime = this.getTimeInTimezone(now, timezone);
      const [rH, rM] = reminderTime.split(':').map(Number);
      const currentMin = userLocalTime.hours * 60 + userLocalTime.minutes;
      const reminderMin = rH * 60 + rM;

      if (currentMin < reminderMin) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayString = dateFormatter.format(yesterday);
        return lastSentString === yesterdayString || lastSentString === todayString;
      }

      return lastSentString === todayString;
    } catch {
      const now = new Date();
      return lastSentAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    }
  }

  // ─── Team Will: Activation at startDate ───────────────────────────────────
  private async processTeamWillActivation(now: Date) {
    try {
      const teamWillsDue = await db
        .select()
        .from(wills)
        .where(and(
          eq(wills.mode, 'team'),
          or(eq(wills.status, 'pending'), eq(wills.status, 'scheduled')),
          lt(wills.startDate, now)
        ))
        .limit(50);

      if (teamWillsDue.length > 0) {
        console.log(`[SCHEDULER-TEAM] Found ${teamWillsDue.length} team will(s) at startDate`);
      }

      for (const will of teamWillsDue) {
        try {
          // Check for accepted invites
          const acceptedRows = await db
            .select()
            .from(teamWillInvites)
            .where(and(
              eq(teamWillInvites.willId, will.id),
              eq(teamWillInvites.status, 'accepted')
            ));

          // Expire all remaining pending invites
          await db
            .update(teamWillInvites)
            .set({ status: 'expired' })
            .where(and(
              eq(teamWillInvites.willId, will.id),
              eq(teamWillInvites.status, 'pending')
            ));

          if (acceptedRows.length >= 1) {
            // Activate the will
            await storage.updateWillStatus(will.id, 'active');
            console.log(`[SCHEDULER-TEAM] ✅ Activated Team Will ${will.id} (${acceptedRows.length} accepted invites)`);

            // Notify all participants: creator + accepted invitees (union of commitments and accepted invites)
            try {
              const willRecord = await storage.getWillById(will.id);
              const displayTitle = willRecord?.title || willRecord?.sharedWhat || 'Your Will';

              // Collect unique participant IDs: creator + all accepted invitees
              const participantIds = new Set<string>([will.createdBy]);
              for (const row of acceptedRows) {
                participantIds.add(row.invitedUserId);
              }
              // Also include anyone with a commitment (covers edge cases)
              const willWithCommitments = await storage.getWillWithCommitments(will.id);
              if (willWithCommitments?.commitments) {
                for (const c of willWithCommitments.commitments) {
                  participantIds.add(c.userId);
                  const commitmentTitle = willWithCommitments.title || c.what || willWithCommitments.sharedWhat || 'Your Will';
                  await pushNotificationService.sendWillStartedNotification(commitmentTitle, [c.userId], will.id, false);
                  participantIds.delete(c.userId); // Already notified via commitment
                }
              }
              // Notify remaining accepted invitees who haven't committed yet
              for (const pid of participantIds) {
                if (pid === will.createdBy) continue; // Creator should have a commitment
                await pushNotificationService.sendWillStartedNotification(displayTitle, [pid], will.id, false);
              }
            } catch (notifErr) {
              console.error(`[SCHEDULER-TEAM] Failed to send started notifications for Will ${will.id}:`, notifErr);
            }
          } else {
            // No accepted invites — terminate
            await storage.updateWillStatus(will.id, 'terminated');
            console.log(`[SCHEDULER-TEAM] ❌ Terminated Team Will ${will.id} (0 accepted invites)`);

            // Notify creator
            try {
              const [creator] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, will.createdBy));
              const willTitle = will.title || will.sharedWhat || 'Your Will';
              await pushNotificationService.sendToUser(will.createdBy, {
                title: 'Team Will could not start',
                body: `"${willTitle}" was cancelled — no friends accepted the invitation`,
                category: 'will_terminated',
                data: { type: 'will_terminated', willId: will.id, deepLink: `/will/${will.id}` },
              });
            } catch (notifErr) {
              console.error(`[SCHEDULER-TEAM] Failed to notify creator of termination for Will ${will.id}:`, notifErr);
            }
          }
        } catch (willErr) {
          console.error(`[SCHEDULER-TEAM] Error processing shared Will ${will.id}:`, willErr);
        }
      }
    } catch (err) {
      console.error('[SCHEDULER-TEAM] Error in processTeamWillActivation:', err);
    }
  }

  // ─── Team Will: 24h reminder to pending invitees ──────────────────────────
  private async sendTeamWillInviteReminders(now: Date) {
    try {
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23h from now
      const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h from now

      // Find pending invites for team wills whose startDate is ~24h away and reminder not yet sent
      const pendingInvites = await db
        .select({
          invite: teamWillInvites,
          willTitle: wills.title,
          willSharedWhat: wills.sharedWhat,
          willStartDate: wills.startDate,
          willId: wills.id,
          creatorId: wills.createdBy,
        })
        .from(teamWillInvites)
        .innerJoin(wills, eq(teamWillInvites.willId, wills.id))
        .where(and(
          eq(teamWillInvites.status, 'pending'),
          isNull(teamWillInvites.reminderSentAt),
          eq(wills.mode, 'team'),
          gte(wills.startDate, windowStart),
          lt(wills.startDate, windowEnd)
        ))
        .limit(100);

      if (pendingInvites.length > 0) {
        console.log(`[SCHEDULER-TEAM] Sending 24h reminders to ${pendingInvites.length} pending invitees`);
      }

      for (const row of pendingInvites) {
        try {
          const inviteTitle = row.willTitle || row.willSharedWhat || 'a Will';
          await pushNotificationService.sendToUser(row.invite.invitedUserId, {
            title: 'Team Will starts in 24 hours ⏰',
            body: `Accept or decline the invite for "${inviteTitle}" before it begins`,
            category: 'shared_will_reminder',
            data: { type: 'shared_will_invite', willId: row.willId, deepLink: `/will/${row.willId}/invite` },
          });

          await db
            .update(teamWillInvites)
            .set({ reminderSentAt: now })
            .where(eq(teamWillInvites.id, row.invite.id));
        } catch (remindErr) {
          console.error(`[SCHEDULER-TEAM] Failed to send reminder for invite ${row.invite.id}:`, remindErr);
        }
      }
    } catch (err) {
      console.error('[SCHEDULER-TEAM] Error in sendTeamWillInviteReminders:', err);
    }
  }
}

export const endRoomScheduler = new EndRoomScheduler();

// Nightly 2am cron: clean up pending/orphan proof drops older than 24 hours
cron.schedule('0 2 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await db
      .select()
      .from(circleProofs)
      .where(and(eq(circleProofs.status, 'pending'), lt(circleProofs.createdAt, cutoff)));

    console.log(`[ProofCleanup] Found ${stale.length} stale pending proof(s) to clean up`);

    for (const proof of stale) {
      try {
        if (proof.cloudinaryPublicId && process.env.CLOUDINARY_API_SECRET
            && proof.cloudinaryPublicId.startsWith('will_proofs/')) {
          await cloudinary.uploader.destroy(proof.cloudinaryPublicId);
        }
        await db.delete(circleProofs).where(eq(circleProofs.id, proof.id));
        console.log(`[ProofCleanup] Deleted stale proof ${proof.id}`);
      } catch (err: any) {
        console.error(`[ProofCleanup] Failed to clean proof ${proof.id}:`, err);
        if (proof.cloudinaryPublicId) {
          await db.insert(cloudinaryCleanupLog).values({
            publicId: proof.cloudinaryPublicId,
            reason: String(err?.message || err),
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[ProofCleanup] Nightly cleanup error:', err);
  }
});