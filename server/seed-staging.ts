import { db } from './db';
import { users, circles, circleMembers, wills, willCommitments } from '@shared/schema';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seedStaging() {
  console.log('🌱 Seeding staging database...');
  console.log('');

  try {
    // Hash the test password (using a simple password for testing)
    const hashedPassword = await hashPassword('Test123!');

    // Create test users
    const testUsers = [
      {
        id: 'test-user-1',
        email: 'test1@staging.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User One',
        role: 'user',
        isActive: true,
      },
      {
        id: 'test-user-2',
        email: 'test2@staging.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User Two',
        role: 'user',
        isActive: true,
      },
      {
        id: 'test-user-3',
        email: 'test3@staging.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User Three',
        role: 'admin',
        isActive: true,
      },
    ];

    // Insert users
    await db.insert(users).values(testUsers);
    console.log('✅ Created 3 test users');
    console.log('   📧 test1@staging.com (user)');
    console.log('   📧 test2@staging.com (user)');
    console.log('   📧 test3@staging.com (admin)');
    console.log('   🔑 Password for all: Test123!');
    console.log('');

    // Create test circle
    const [circle] = await db.insert(circles).values({
      inviteCode: 'TEST01',
      createdBy: 'test-user-1',
    }).returning();
    console.log('✅ Created test circle');
    console.log(`   🔗 Circle ID: ${circle.id}`);
    console.log(`   🎫 Invite Code: ${circle.inviteCode}`);
    console.log('');

    // Add members to circle
    await db.insert(circleMembers).values([
      { circleId: circle.id, userId: 'test-user-1' },
      { circleId: circle.id, userId: 'test-user-2' },
      { circleId: circle.id, userId: 'test-user-3' },
    ]);
    console.log('✅ Added all 3 users to the test circle');
    console.log('');

    // Create sample wills with different statuses
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const farFuture = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    const [activeWill, pendingWill, scheduledWill] = await db.insert(wills).values([
      {
        circleId: circle.id,
        createdBy: 'test-user-1',
        startDate: yesterday,
        endDate: future,
        status: 'active',
        endRoomStatus: 'pending',
      },
      {
        circleId: circle.id,
        createdBy: 'test-user-2',
        startDate: now,
        endDate: future,
        status: 'pending',
        endRoomStatus: 'pending',
      },
      {
        circleId: circle.id,
        createdBy: 'test-user-3',
        startDate: future,
        endDate: farFuture,
        status: 'scheduled',
        endRoomStatus: 'pending',
      },
    ]).returning();
    console.log('✅ Created 3 sample wills:');
    console.log(`   📝 Will #${activeWill.id} - ACTIVE (ends in 7 days)`);
    console.log(`   📝 Will #${pendingWill.id} - PENDING (ends in 7 days)`);
    console.log(`   📝 Will #${scheduledWill.id} - SCHEDULED (starts in 7 days)`);
    console.log('');

    // Add commitments to the active will
    await db.insert(willCommitments).values([
      {
        willId: activeWill.id,
        userId: 'test-user-1',
        what: 'Exercise for 30 minutes daily',
        why: 'To improve my health and energy levels',
      },
      {
        willId: activeWill.id,
        userId: 'test-user-2',
        what: 'Read for 1 hour before bed',
        why: 'To expand my knowledge and relax',
      },
    ]);
    console.log('✅ Added sample commitments to active will');
    console.log('');

    console.log('🎉 Staging database seeded successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   - 3 test users created');
    console.log('   - 1 test circle with all members');
    console.log('   - 3 wills (active, pending, scheduled)');
    console.log('   - 2 commitments on the active will');
    console.log('');
    console.log('🚀 You can now run: npm run dev:staging');
  } catch (error) {
    console.error('❌ Error seeding staging database:', error);
    throw error;
  }
}

seedStaging()
  .catch(console.error)
  .finally(() => process.exit());
