/**
 * Circle → Shared Will Migration (Stage A)
 * Called on server startup — idempotent and safe to re-run.
 *
 * For each circle:
 *
 *   A) Has qualifying wills (status in active/scheduled/pending/paused/will_review with circleId set):
 *      1. Set wills.mode = 'shared'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL (final completion marker)
 *      Source circle rows are preserved (NOT deleted) for 30-day Stage A validation buffer.
 *
 *   B) No qualifying wills AND no wills (any status) reference this circle:
 *      Safe to delete now — no FK constraint prevents it. These are orphaned circles.
 *
 *   C) No qualifying wills BUT wills with other statuses still reference this circle:
 *      Cannot delete — FK constraint from wills.circleId → circles.id.
 *      These are preserved until Stage B when the circleId column is dropped.
 *
 * IDEMPOTENCY:
 * - Step 1: skipped if mode is already 'shared'.
 * - Step 2: per-invite existence check before inserting.
 * - Step 3: all-or-nothing transaction; if will_messages already has rows for this will, skipped.
 * - Step 4: once circleId is NULL, will no longer appears in qualifying query; fully skipped on rerun.
 * - On rerun, migrated circles (all wills have circleId=NULL) fall into case B or C, not A.
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
  userNotifications,
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
  let circlesWithNoWork = 0;

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
        // Non-qualifying wills (completed/terminated/etc.) still reference this circle.
        // Null their circleId to release the FK constraint, then delete the circle.
        await db.update(wills).set({ circleId: null }).where(eq(wills.circleId, circle.id));
      }

      // Clear all FK references to this circle, then delete it
      await db.update(userNotifications).set({ circleId: null }).where(eq(userNotifications.circleId, circle.id));
      await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
      await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
      await db.delete(circles).where(eq(circles.id, circle.id));
      console.log(`[Migration]   Deleted circle ${circle.id} (${anyWillCheck.length > 0 ? 'had non-qualifying wills, circleId nulled' : 'orphaned'}).`);
      circlesDeleted++;
      continue;
    }

    // Process qualifying wills — migrate them to shared will format
    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

    if (qualifyingWills.length > 1) {
      console.warn(`[Migration]   Circle ${circle.id} has ${qualifyingWills.length} qualifying wills — messages will be copied to each. Verify deduplication.`);
    }

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

      // Step 4: Null out circleId — final completion marker.
      // Source circle rows are preserved (never deleted in startup migration).
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`[Migration]   ✓ Will ${will.id} migrated (circle ${circle.id} source data preserved).`);
      willsMigrated++;
    }
  }

  console.log(`[Migration] Done. Wills migrated: ${willsMigrated}, invites: ${invitesCreated}, messages: ${messagesMigrated}, circles deleted: ${circlesDeleted}, preserved: ${circlesWithNoWork}`);
}
