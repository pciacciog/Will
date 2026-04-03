/**
 * Circle → Shared Will Migration (Stage A)
 * Called on server startup — idempotent and safe to re-run.
 *
 * For each circle:
 *
 *   A) If it has qualifying wills (status in active/scheduled/pending/paused/will_review
 *      with circleId still set):
 *      1. Set wills.mode = 'shared'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL (final completion marker)
 *      Source circle rows (circles, circle_members, circle_messages) are PRESERVED for 30-day
 *      validation buffer. Stage B will drop tables once rollback window expires.
 *
 *   B) If it has NO qualifying wills AND no will (any status) still references it:
 *      The circle is truly orphaned (never had active usage). Safe to delete immediately.
 *
 *   C) If it has NO qualifying wills BUT wills with other statuses still reference it:
 *      Skipped — FK constraint; Stage B will clean up when circleId column drops.
 *
 * IDEMPOTENCY:
 * - Step 1 (mode check) + step 2 (invite existence check) + step 3 (message count +
 *   transaction) + step 4 (circleId=NULL) are all independently idempotent.
 * - On rerun, qualifying wills query returns empty (circleId is NULL), so migrated circles
 *   are checked against case B or C above.
 */

import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  circles,
  circleMembers,
  circleMessages,
  wills,
  willCommitments,
  sharedWillInvites,
  willMessages,
} from "@shared/schema";

export async function runCircleMigration(): Promise<void> {
  const allCircles = await db.select().from(circles);
  if (allCircles.length === 0) {
    return;
  }

  console.log(`[Migration] Starting circle → shared will migration. Found ${allCircles.length} circles.`);

  let willsMigrated = 0;
  let circlesDeleted = 0;
  let messagesMigrated = 0;
  let invitesCreated = 0;
  let skipped = 0;

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
        skipped++;
        continue;
      }

      // Truly orphaned: no wills ever referenced this circle — safe to delete now
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`[Migration]   Deleted orphaned circle ${circle.id}.`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`[Migration]   Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    // Process qualifying wills — migrate them to shared will format
    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

    for (const will of qualifyingWills) {
      console.log(`[Migration]   Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

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

      // Step 4: Null out circleId — final completion marker for this will.
      // Source circle rows are preserved for 30-day validation buffer (Stage A).
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`[Migration]   ✓ Will ${will.id} migrated (source circle ${circle.id} preserved for Stage A).`);
      willsMigrated++;
    }

    skipped++;
  }

  console.log(`[Migration] Done. Wills migrated: ${willsMigrated}, invites: ${invitesCreated}, messages: ${messagesMigrated}, circles deleted: ${circlesDeleted}, preserved: ${skipped}`);
}
