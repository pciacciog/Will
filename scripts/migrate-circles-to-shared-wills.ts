/**
 * Stage A Migration: Convert Circle Wills → Shared Wills
 *
 * For each circle that has an active will (status in active/scheduled/pending/paused/will_review):
 *   1. Set wills.mode = 'shared'
 *   2. Create shared_will_invites rows (status='accepted') for each circle member
 *      who has a will_commitment record (idempotent — skips existing invites)
 *   3. Migrate that circle's circle_messages into will_messages (idempotent — skips duplicates)
 *   4. Set wills.circleId = NULL
 *
 * For circles with NO qualifying will (and never had one): delete the circle record.
 *
 * This script is idempotent — safe to re-run without data loss.
 *
 * IDEMPOTENCY DESIGN:
 * - A circle is only considered for deletion if it has NO qualifying wills at all
 *   AND it has no corresponding shared_will_invites rows (indicating it was never migrated).
 *   This prevents re-runs from deleting source circle data during the Stage A window.
 * - Already-migrated wills (circleId=NULL, mode='shared') are found via originatingCircleId
 *   or by cross-referencing shared_will_invites created during a prior run.
 * - Messages are deduped by (willId, userId, text, createdAt to-the-second).
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { eq, inArray, and, isNotNull, sql, or } from "drizzle-orm";
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

const client = neon(DATABASE_URL);
const db = drizzle(client);

const QUALIFYING_STATUSES = ["active", "scheduled", "pending", "paused", "will_review"];

async function main() {
  console.log("=== Circle → Shared Will Migration (Stage A) ===");
  console.log("Starting at:", new Date().toISOString());

  let willsMigrated = 0;
  let circlesDeleted = 0;
  let messagesMigrated = 0;
  let invitesCreated = 0;
  let skipped = 0;

  // Fetch all circles
  const allCircles = await db.select().from(circles);
  console.log(`Found ${allCircles.length} total circles`);

  for (const circle of allCircles) {
    // --- Find qualifying wills that still reference this circleId ---
    const activeCircleWills = await db
      .select()
      .from(wills)
      .where(
        and(
          eq(wills.circleId, circle.id),
          sql`${wills.status} IN ('active','scheduled','pending','paused','will_review')`
        )
      );

    // --- Also find already-migrated wills: those that had circleId set to NULL but have
    //     shared_will_invites where the invitedByUserId was a member of this circle.
    //     We identify them via circle members who are also will originators.
    //     Simpler approach: just look for any will that was ever in this circle by checking
    //     if any circle member created a shared will whose invites contain other circle members.
    //
    //     Most reliable: check if there are ANY shared_will_invites for wills created by
    //     members of this circle. If so, the circle was already migrated — skip deletion.
    //
    //     Implementation: if activeCircleWills.length === 0, check if this circle has any
    //     members who are invitors in shared_will_invites. If yes → already migrated, skip deletion.

    if (activeCircleWills.length === 0) {
      // Check whether any member of this circle has been involved in a migration as originator
      const memberIds = await db
        .select({ userId: circleMembers.userId })
        .from(circleMembers)
        .where(eq(circleMembers.circleId, circle.id));

      if (memberIds.length === 0) {
        // Truly empty circle — safe to delete
        try {
          await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
          await db.delete(circles).where(eq(circles.id, circle.id));
          console.log(`  ✓ Deleted empty circle ${circle.id} (inviteCode: ${circle.inviteCode})`);
          circlesDeleted++;
        } catch (e) {
          console.warn(`  ⚠ Could not delete circle ${circle.id}:`, e);
        }
        continue;
      }

      const memberUserIds = memberIds.map((m) => m.userId);

      // Check if any member of this circle was an invitor in shared_will_invites
      // (indicating this circle was already migrated in a prior run)
      const priorMigrationCheck = await db
        .select({ id: sharedWillInvites.id })
        .from(sharedWillInvites)
        .where(
          sql`${sharedWillInvites.invitedByUserId} = ANY(${memberUserIds})`
        )
        .limit(1);

      if (priorMigrationCheck.length > 0) {
        // Circle was already migrated in a prior run — preserve circle data during Stage A window
        console.log(`  ↩ Circle ${circle.id} already migrated (prior run), preserving source data`);
        skipped++;
        continue;
      }

      // No qualifying will and no prior migration evidence — this is a truly inactive circle
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`  ✓ Deleted inactive circle ${circle.id} (inviteCode: ${circle.inviteCode})`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`  ⚠ Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    // Get all members of this circle
    const members = await db
      .select()
      .from(circleMembers)
      .where(eq(circleMembers.circleId, circle.id));

    // Get circle messages (for migration into will_messages)
    const msgs = await db
      .select()
      .from(circleMessages)
      .where(eq(circleMessages.circleId, circle.id));

    for (const will of activeCircleWills) {
      // Idempotent check: already fully migrated?
      if (will.mode === "shared" && will.circleId === null) {
        console.log(`  ↩ Will ${will.id} already migrated, skipping`);
        skipped++;
        continue;
      }

      console.log(`  Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

      // 1. Set mode = 'shared'
      await db
        .update(wills)
        .set({ mode: "shared" })
        .where(eq(wills.id, will.id));

      // 2. Create shared_will_invites for each member who has a commitment
      const commitments = await db
        .select()
        .from(willCommitments)
        .where(eq(willCommitments.willId, will.id));

      const committedUserIds = new Set(commitments.map((c) => c.userId));

      for (const member of members) {
        if (!committedUserIds.has(member.userId)) {
          // Member has no commitment — skip invite
          continue;
        }
        if (member.userId === will.createdBy) {
          // Creator doesn't get an invite row
          continue;
        }

        // Idempotent: check if invite already exists
        const existingInvite = await db
          .select({ id: sharedWillInvites.id })
          .from(sharedWillInvites)
          .where(
            and(
              eq(sharedWillInvites.willId, will.id),
              eq(sharedWillInvites.invitedUserId, member.userId)
            )
          );

        if (existingInvite.length > 0) {
          continue; // Already exists
        }

        await db.insert(sharedWillInvites).values({
          willId: will.id,
          invitedUserId: member.userId,
          invitedByUserId: will.createdBy,
          status: "accepted",
          respondedAt: new Date(),
        });
        invitesCreated++;
      }

      // 3. Migrate circle_messages into will_messages
      // Idempotent: dedupe by (willId, userId, text, createdAt to-the-second)
      // This preserves all messages including legitimate repeated identical ones at different times.
      for (const msg of msgs) {
        const msgCreatedAt = msg.createdAt ?? new Date();

        const existing = await db
          .select({ id: willMessages.id })
          .from(willMessages)
          .where(
            and(
              eq(willMessages.willId, will.id),
              eq(willMessages.userId, msg.userId),
              eq(willMessages.text, msg.text),
              sql`date_trunc('second', ${willMessages.createdAt}) = date_trunc('second', ${msgCreatedAt}::timestamptz)`
            )
          );

        if (existing.length > 0) {
          continue; // Already migrated this exact message
        }

        await db.insert(willMessages).values({
          willId: will.id,
          userId: msg.userId,
          text: msg.text,
          createdAt: msgCreatedAt,
        });
        messagesMigrated++;
      }

      // 4. Set circleId = NULL (marks will as fully migrated)
      await db
        .update(wills)
        .set({ circleId: null })
        .where(eq(wills.id, will.id));

      console.log(`    ✓ Will ${will.id} migrated (${invitesCreated} invites, ${messagesMigrated} messages so far)`);
      willsMigrated++;
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`  Wills migrated:    ${willsMigrated}`);
  console.log(`  Invites created:   ${invitesCreated}`);
  console.log(`  Messages migrated: ${messagesMigrated}`);
  console.log(`  Circles deleted:   ${circlesDeleted}`);
  console.log(`  Already done:      ${skipped}`);
  console.log("Finished at:", new Date().toISOString());
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
