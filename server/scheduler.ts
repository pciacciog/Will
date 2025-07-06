import * as cron from 'node-cron';
import { db } from './db';
import { wills } from '@shared/schema';
import { eq, and, lt, gte, isNull } from 'drizzle-orm';
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

    // Find End Rooms that should be opened (scheduled time has passed, status is pending)
    await this.openPendingEndRooms(now);

    // Find End Rooms that should be closed (30 minutes have passed, status is open)
    await this.closeExpiredEndRooms(now);

    // Check for completed wills that need End Rooms scheduled
    await this.scheduleEndRoomsForCompletedWills();
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
      // Find wills that have ended but don't have End Rooms scheduled yet
      const now = new Date();
      const willsNeedingEndRooms = await db
        .select()
        .from(wills)
        .where(
          and(
            eq(wills.status, 'active'),
            lt(wills.endDate, now)
          )
        );

      for (const will of willsNeedingEndRooms) {
        // Skip if already has End Room scheduled
        if (will.endRoomScheduledAt) {
          continue;
        }
        
        try {
          console.log(`[EndRoomScheduler] Scheduling End Room for completed Will ${will.id}`);
          
          const endRoomTime = dailyService.calculateEndRoomTime(will.endDate);
          
          // Create Daily room
          const room = await dailyService.createEndRoom({
            willId: will.id,
            scheduledStart: endRoomTime,
            durationMinutes: 30
          });

          // Update will with End Room details
          await storage.updateWillEndRoom(will.id, {
            endRoomScheduledAt: endRoomTime,
            endRoomUrl: room.url,
            endRoomStatus: 'pending'
          });
          
          await storage.updateWillStatus(will.id, 'waiting_for_end_room');

          console.log(`[EndRoomScheduler] End Room scheduled for Will ${will.id} at ${endRoomTime.toISOString()}`);
        } catch (error) {
          console.error(`[EndRoomScheduler] Failed to schedule End Room for Will ${will.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[EndRoomScheduler] Error scheduling End Rooms for completed wills:', error);
    }
  }
}

export const endRoomScheduler = new EndRoomScheduler();