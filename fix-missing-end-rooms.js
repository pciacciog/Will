// Fix missing End Room URLs for currently open End Rooms
const { dailyService } = require('./server/daily');
const { storage } = require('./server/storage');

async function fixMissingEndRooms() {
  try {
    console.log('Starting fix for missing End Room URLs...');
    
    // Get all open End Rooms without URLs
    const wills = await storage.getWillsWithMissingEndRoomUrls();
    console.log(`Found ${wills.length} End Rooms needing video URLs`);
    
    for (const will of wills) {
      try {
        console.log(`Creating Daily.co room for Will ${will.id}...`);
        
        const endRoom = await dailyService.createEndRoom({
          willId: will.id,
          scheduledStart: new Date(will.endRoomScheduledAt),
        });
        
        await storage.updateWillEndRoom(will.id, {
          endRoomUrl: endRoom.url
        });
        
        console.log(`✅ Created video room for Will ${will.id}: ${endRoom.url}`);
      } catch (error) {
        console.error(`❌ Failed to create room for Will ${will.id}:`, error);
      }
    }
    
    console.log('Finished fixing missing End Room URLs');
  } catch (error) {
    console.error('Error in fix script:', error);
  }
}

fixMissingEndRooms();