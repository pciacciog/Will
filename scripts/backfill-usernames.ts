/**
 * Backfill usernames for existing users.
 * Generates a username from the user's first name + random suffix if no username is set.
 * Run with: npx tsx scripts/backfill-usernames.ts
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';

function generateUsername(firstName: string | null, email: string): string {
  const base = firstName
    ? firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
    : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeBase = base.slice(0, 20) || 'user';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${safeBase}${suffix}`;
}

async function main() {
  console.log('Starting username backfill...');

  const usersWithoutUsername = await db
    .select()
    .from(users)
    .where(isNull(users.username));

  console.log(`Found ${usersWithoutUsername.length} users without a username.`);

  let updated = 0;
  for (const user of usersWithoutUsername) {
    let username = generateUsername(user.firstName, user.email);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));

    if (existing.length > 0) {
      username = generateUsername(user.firstName, user.email);
    }

    await db
      .update(users)
      .set({ username })
      .where(eq(users.id, user.id));

    console.log(`  Updated user ${user.id} (${user.email}) → username: ${username}`);
    updated++;
  }

  console.log(`Backfill complete. Updated ${updated} users.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
