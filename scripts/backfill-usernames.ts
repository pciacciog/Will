/**
 * Backfill usernames for existing users.
 * Generates a username from the user's first name + random suffix if no username is set.
 * Run with: npx tsx scripts/backfill-usernames.ts
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';

const MAX_ATTEMPTS = 20;

function generateUsername(firstName: string | null, email: string): string {
  const base = firstName
    ? firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
    : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeBase = base.slice(0, 20) || 'user';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${safeBase}${suffix}`;
}

async function isUsernameTaken(username: string): Promise<boolean> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  return existing.length > 0;
}

async function main() {
  console.log('Starting username backfill...');

  const usersWithoutUsername = await db
    .select()
    .from(users)
    .where(isNull(users.username));

  console.log(`Found ${usersWithoutUsername.length} users without a username.`);

  let updated = 0;
  let failed = 0;

  for (const user of usersWithoutUsername) {
    let username: string | null = null;
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      const candidate = generateUsername(user.firstName, user.email);
      const taken = await isUsernameTaken(candidate);
      if (!taken) {
        username = candidate;
        break;
      }
      attempts++;
    }

    if (!username) {
      console.error(`  FAILED to find unique username for user ${user.id} (${user.email}) after ${MAX_ATTEMPTS} attempts`);
      failed++;
      continue;
    }

    await db
      .update(users)
      .set({ username })
      .where(eq(users.id, user.id));

    console.log(`  Updated user ${user.id} (${user.email}) → username: ${username} (attempts: ${attempts + 1})`);
    updated++;
  }

  console.log(`Backfill complete. Updated: ${updated}, Failed: ${failed}.`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
