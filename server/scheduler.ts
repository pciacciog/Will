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

    // Check for completed wills that need End Rooms scheduled
    await this.scheduleEndRoomsForCompletedWills();
  }

  private async transitionWillStatuses(now: Date) {
    try {
      // 1. Transition pending wills to active (start time has passed)
      const willsToActivate = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'pending'),
            lt(wills.startDate, now)
          )
        );

      for (const will of willsToActivate) {
        console.log(`[EndRoomScheduler] Activating Will ${will.id}`);
        await storage.updateWillStatus(will.id, 'active');
      }

      // 2. Transition active/scheduled wills to waiting_for_end_room (end time has passed and End Room scheduled)
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

      // 3. Transition active/scheduled wills to completed (end time has passed and no End Room scheduled)
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
          
          // Update status to open
          await storage.updateWillEndRoom(will.id, { endRoomStatus: 'open' });

          console.log(`[EndRoomScheduler] End Room opened for Will ${will.id}`);
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
            lt(wills.endRoomScheduledAt, thirtyMinutesAgo)
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