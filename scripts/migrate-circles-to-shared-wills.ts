/**
 * Circle → Shared Will Migration (Stage A) — standalone script
 * Run with: npx tsx scripts/migrate-circles-to-shared-wills.ts
 *
 * Same logic as server/circleMigration.ts but run from CLI.
 * Uses Pool (not neon HTTP) for transaction support.
 *
 * MIGRATION CATEGORIES (evaluated per circle):
 *
 *   A) circle.migratedAt IS NOT NULL
 *      Already migrated — skip entirely (Stage A 30-day preservation window).
 *
 *   B) circle.migratedAt IS NULL AND has qualifying wills (active/scheduled/pending/paused/will_review):
 *      1. Set wills.mode = 'shared'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL (unlinks the will from circle)
 *      5. Set circles.migratedAt = NOW() — preserved for 30-day Stage A validation buffer.
 *
 *   C) circle.migratedAt IS NULL AND no qualifying wills:
 *      Null FK refs (wills.circleId, userNotifications.circleId) and delete the circle.
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { eq, and, sql } from "drizzle-orm";
import {
  circles,
  circleMembers,
  circleMessages,
  wills,
  willCommitments,
  sharedWillInvites,
  willMessages,
  userNotifications,
} from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool });

async function main() {
  console.log("=== Circle → Shared Will Migration (Stage A) ===");
  console.log("Starting at:", new Date().toISOString());

  let willsMigrated = 0;
  let circlesDeleted = 0;
  let circlesMigrated = 0;
  let circlesSkipped = 0;
  let messagesMigrated = 0;
  let invitesCreated = 0;

  const allCircles = await db.select().from(circles);
  console.log(`Found ${allCircles.length} total circles`);

  for (const circle of allCircles) {
    // Category A: already migrated — preserve for Stage A 30-day window
    if (circle.migratedAt !== null) {
      console.log(`  Circle ${circle.id} already migrated (migratedAt: ${circle.migratedAt}) — skipping.`);
      circlesSkipped++;
      continue;
    }

    // Find qualifying wills still referencing this circleId
    const qualifyingWills = await db
      .select()
      .from(wills)
      .where(
        and(
          eq(wills.circleId, circle.id),
          sql`${wills.status} IN ('active','scheduled','pending','paused','will_review')`
        )
      );

    if (qualifyingWills.length === 0) {
      // Category C: no qualifying wills — null FK refs and delete the circle
      await db.update(wills).set({ circleId: null }).where(eq(wills.circleId, circle.id));
      await db.update(userNotifications).set({ circleId: null }).where(eq(userNotifications.circleId, circle.id));
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`  ✓ Deleted circle ${circle.id} (no qualifying wills).`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`  ⚠ Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    // Category B: has qualifying wills — migrate then preserve
    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

    if (qualifyingWills.length > 1) {
      console.warn(`  Circle ${circle.id} has ${qualifyingWills.length} qualifying wills — messages will be copied to each. Verify deduplication.`);
    }

    for (const will of qualifyingWills) {
      console.log(`  Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

      // Step 1: Set mode = 'shared' (idempotent)
      if (will.mode !== "shared") {
        await db.update(wills).set({ mode: "shared" }).where(eq(wills.id, will.id));
      }

      // Step 2: Create shared_will_invites for committed members (per-invite idempotency)
      const commitments = await db.select().from(willCommitments).where(eq(willCommitments.willId, will.id));
      const committedUserIds = new Set(commitments.map((c) => c.userId));

      for (const member of members) {
        if (!committedUserIds.has(member.userId)) continue;
        if (member.userId === will.createdBy) continue;

        const existingInvite = await db
          .select({ id: sharedWillInvites.id })
          .from(sharedWillInvites)
          .where(and(eq(sharedWillInvites.willId, will.id), eq(sharedWillInvites.invitedUserId, member.userId)));

        if (existingInvite.length > 0) continue;

        await db.insert(sharedWillInvites).values({
          willId: will.id,
          invitedUserId: member.userId,
          invitedByUserId: will.createdBy,
          status: "accepted",
          respondedAt: new Date(),
        });
        invitesCreated++;
      }

      // Step 3: Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
      // Idempotency: if will_messages already has any entries for this will, skip entirely.
      if (msgs.length > 0) {
        const [existingCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(willMessages)
          .where(eq(willMessages.willId, will.id));
        const alreadyHasMessages = Number(existingCount?.count || 0) > 0;
        if (!alreadyHasMessages) {
          await db.transaction(async (tx) => {
            for (const msg of msgs) {
              await tx.insert(willMessages).values({
                willId: will.id,
                userId: msg.userId,
                text: msg.text,
                createdAt: msg.createdAt ?? new Date(),
              });
            }
          });
          messagesMigrated += msgs.length;
        }
      }

      // Step 4: Null out circleId on the will (unlinks from circle)
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`    ✓ Will ${will.id} migrated.`);
      willsMigrated++;
    }

    // Step 5: Mark circle as migrated — skips on future reruns (Stage A preservation)
    await db.update(circles).set({ migratedAt: new Date() }).where(eq(circles.id, circle.id));
    console.log(`  ✓ Circle ${circle.id} marked as migrated (preserved for Stage A window).`);
    circlesMigrated++;
  }

  console.log("\n=== Migration Complete ===");
  console.log(`  Wills migrated:         ${willsMigrated}`);
  console.log(`  Invites created:        ${invitesCreated}`);
  console.log(`  Messages migrated:      ${messagesMigrated}`);
  console.log(`  Circles migrated+kept:  ${circlesMigrated}`);
  console.log(`  Circles deleted:        ${circlesDeleted}`);
  console.log(`  Already done (skipped): ${circlesSkipped}`);
  console.log("Finished at:", new Date().toISOString());

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
