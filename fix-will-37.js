const { dailyService } = require('./server/daily.js');
const { db } = require('./server/db.js');
const { wills } = require('./shared/schema.js');
const { eq } = require('drizzle-orm');

async function fixWill37() {
  try {
    console.log('Creating Daily.co room for Will 37...');
    
    // Create the Daily.co room
    const endRoom = await dailyService.createEndRoom({
      willId: 37,
      scheduledStart: new Date('2025-07-07T11:54:00.000Z'),
    });
    
    console.log('Created room:', endRoom.url);
    
    // Update the database
    await db.update(wills)
      .set({ endRoomUrl: endRoom.url })
      .where(eq(wills.id, 37));
    
    console.log('✅ Successfully fixed Will 37 End Room URL:', endRoom.url);
    
  } catch (error) {
    console.error('❌ Error fixing Will 37:', error);
  }
  
  process.exit(0);
}

fixWill37();