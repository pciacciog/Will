/**
 * Circle → Shared Will Migration (Stage A) — standalone script
 * Run with: npx tsx scripts/migrate-circles-to-shared-wills.ts
 *
 * Same logic as server/circleMigration.ts but run from CLI.
 * Uses Pool (not neon HTTP) for transaction support.
 *
 * For each circle:
 *   A) Has qualifying wills (active/scheduled/pending/paused/will_review with circleId set):
 *      1. Set wills.mode = 'shared'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL
 *      Source circle rows are PRESERVED for 30-day validation buffer. Stage B drops tables.
 *
 *   B) No qualifying wills AND no wills reference this circle at all:
 *      Truly orphaned — delete immediately.
 *
 *   C) No qualifying wills BUT wills (any status) still reference this circle:
 *      Skipped — FK constraint; Stage B will handle when circleId column drops.
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
  let messagesMigrated = 0;
  let invitesCreated = 0;
  let skipped = 0;

  const allCircles = await db.select().from(circles);
  console.log(`Found ${allCircles.length} total circles`);

  for (const circle of allCircles) {
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
      // No qualifying wills — check if any will (any status) still references this circle
      const anyWillCheck = await db
        .select({ id: wills.id })
        .from(wills)
        .where(eq(wills.circleId, circle.id))
        .limit(1);

      if (anyWillCheck.length > 0) {
        // Historical wills (completed/terminated) still reference this circle via FK.
        // Preserve for Stage B (when circleId column drops).
        console.log(`  ↩ Circle ${circle.id} skipped — has non-qualifying wills (FK constraint).`);
        skipped++;
        continue;
      }

      // Truly orphaned: no wills ever referenced this circle — safe to delete
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`  ✓ Deleted orphaned circle ${circle.id}.`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`  ⚠ Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

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

      // Step 3: Migrate circle_messages → will_messages inside a transaction (all-or-nothing)
      // Idempotency: if will_messages already has any entries for this will, skip entirely.
      // Transaction ensures partial failures leave zero rows, allowing safe full retry.
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

      // Step 4: Null out circleId — final completion marker.
      // Source circle rows preserved for 30-day validation buffer (Stage A).
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`    ✓ Will ${will.id} migrated (source circle ${circle.id} preserved for Stage A).`);
      willsMigrated++;
    }

    skipped++;
  }

  console.log("\n=== Migration Complete ===");
  console.log(`  Wills migrated:    ${willsMigrated}`);
  console.log(`  Invites created:   ${invitesCreated}`);
  console.log(`  Messages migrated: ${messagesMigrated}`);
  console.log(`  Circles deleted:   ${circlesDeleted}`);
  console.log(`  Preserved/skipped: ${skipped}`);
  console.log("Finished at:", new Date().toISOString());

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
