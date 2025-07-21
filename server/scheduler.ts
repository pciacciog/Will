import * as cron from 'node-cron';
import { db } from './db';
import { wills } from '@shared/schema';
import { eq, and, or, lt, gte, isNull, isNotNull } from 'drizzle-orm';
import { dailyService } from './daily';
import { storage } from './storage';

export class EndRoomScheduler {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('[EndRoomScheduler] Already running');
      return;
    }

    console.log('[EndRoomScheduler] Starting scheduler...');
    this.isRunning = true;

    // Check every minute for End Rooms that need to be opened or closed
    cron.schedule('* * * * *', async () => {
      try {
        await this.processEndRooms();
      } catch (error) {
        console.error('[EndRoomScheduler] Error processing end rooms:', error);
      }
    });

    console.log('[EndRoomScheduler] Scheduler started - checking every minute');
  }

  stop() {
    this.isRunning = false;
    console.log('[EndRoomScheduler] Scheduler stopped');
  }

  private async processEndRooms() {
    const now = new Date();
    console.log(`[EndRoomScheduler] Checking for End Rooms at ${now.toISOString()}`);

    // First, transition Will statuses based on dates
    await this.transitionWillStatuses(now);

    // Find End Rooms that should be opened (scheduled time has passed, status is pending)
    await this.openPendingEndRooms(now);

    // Find End Rooms that should be closed (30 minutes have passed, status is open)
    await this.closeExpiredEndRooms(now);

    // Send End Room notifications (24h and 15min warnings)
    await this.sendEndRoomNotifications(now);

    // Check for completed wills that need End Rooms scheduled
    await this.scheduleEndRoomsForCompletedWills();
  }

  private async transitionWillStatuses(now: Date) {
    try {
      // 1. Transition pending/scheduled wills to active (start time has passed)
      const willsToActivate = await db
        .select()
        .from(wills)
        .where(
          and(
            or(eq(wills.status, 'pending'), eq(wills.status, 'scheduled')),
            lt(wills.startDate, now)
          )
        );

      for (const will of willsToActivate) {
        console.log(`[EndRoomScheduler] Activating Will ${will.id}`);
        await storage.updateWillStatus(will.id, 'active');
      }

      // 2. Transition active wills to waiting_for_end_room (end time has passed and End Room scheduled)
      const willsToWaitForEndRoom = await db
        .select()
        .from(wills)
        .where(
          and(
            or(eq(wills.status, 'active'), eq(wills.status, 'scheduled')),
            lt(wills.endDate, now),
            isNotNull(wills.endRoomScheduledAt)
          )
        );

      for (const will of willsToWaitForEndRoom) {
        console.log(`[EndRoomScheduler] Transitioning Will ${will.id} to waiting_for_end_room`);
        await storage.updateWillStatus(will.id, 'waiting_for_end_room');
      }

      // 3. Transition active wills to completed (end time has passed and no End Room scheduled)
      const willsToComplete = await db
        .select()
        .from(wills)
        .where(
          and(
            or(eq(wills.status, 'active'), eq(wills.status, 'scheduled')),
            lt(wills.endDate, now),
            isNull(wills.endRoomScheduledAt)
          )
        );

      for (const will of willsToComplete) {
        console.log(`[EndRoomScheduler] Completing Will ${will.id} (no End Room)`);
        await storage.updateWillStatus(will.id, 'completed');
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
        );

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
            } catch (dailyError) {
              console.error(`[EndRoomScheduler] Failed to create Daily.co room for Will ${will.id}:`, dailyError);
              // Still mark as open even if video creation failed
              await storage.updateWillEndRoom(will.id, { 
                endRoomStatus: 'open',
                endRoomOpenedAt: now
              });
              console.log(`[EndRoomScheduler] End Room opened for Will ${will.id} but without video room`);
            }
          } else {
            // Update status to open (room URL already exists)
            await storage.updateWillEndRoom(will.id, { 
              endRoomStatus: 'open',
              endRoomOpenedAt: now
            });
            console.log(`[EndRoomScheduler] End Room opened for Will ${will.id}`);
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
        );

      for (const will of roomsToClose) {
        try {
          console.log(`[EndRoomScheduler] Closing End Room for Will ${will.id}`);
          
          // Update status to completed and will status to completed
          await storage.updateWillEndRoom(will.id, { endRoomStatus: 'completed' });
          await storage.updateWillStatus(will.id, 'completed');

          // Clean up the Daily room if it exists
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

          console.log(`[EndRoomScheduler] End Room closed and Will ${will.id} marked as completed`);
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
      // 24-hour warning (check for End Rooms scheduled 24-25 hours from now)
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      
      const endRooms24h = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, twentyFourHoursFromNow),
            lt(wills.endRoomScheduledAt, twentyFiveHoursFromNow)
          )
        );

      for (const will of endRooms24h) {
        console.log(`[EndRoomScheduler] Sending 24h End Room notification for Will ${will.id}`);
        // Note: In a real app, this would trigger push notifications to all circle members
        // For now, we log it as the notification service runs client-side
      }

      // 15-minute warning (check for End Rooms scheduled 15-16 minutes from now)
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      const sixteenMinutesFromNow = new Date(now.getTime() + 16 * 60 * 1000);
      
      const endRooms15min = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.endRoomStatus, 'pending'),
            gte(wills.endRoomScheduledAt, fifteenMinutesFromNow),
            lt(wills.endRoomScheduledAt, sixteenMinutesFromNow)
          )
        );

      for (const will of endRooms15min) {
        console.log(`[EndRoomScheduler] Sending 15min End Room notification for Will ${will.id}`);
        // Note: In a real app, this would trigger push notifications to all circle members
        // For now, we log it as the notification service runs client-side
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