/**
 * Circle → Shared Will Migration (Stage A)
 * Called on server startup — idempotent and safe to re-run.
 *
 * For each circle:
 *   A) If it has qualifying wills (active/scheduled/pending/paused/will_review with circleId set):
 *      1. Set wills.mode = 'shared'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL
 *      5. After all qualifying wills migrated: delete the circle (all wills now have circleId=NULL,
 *         so the FK constraint is satisfied)
 *
 *   B) If it has NO qualifying wills:
 *      - Check if any will (any status) still references this circle (FK constraint).
 *        If yes: skip (cannot delete due to FK). These are historical/non-qualifying wills.
 *        If no: delete the circle (safe — no FK dependencies remain).
 *
 * This satisfies "delete circles with no qualifying will" per Stage A spec.
 * Historical circles with completed/terminated wills still referencing them cannot be
 * deleted until Stage B (when the circleId column is dropped).
 *
 * IDEMPOTENCY:
 * - Will migration: step 1 (mode check) + step 2 (invite existence check) + step 3
 *   (message count check + transaction) + step 4 (circleId=NULL) are all independently idempotent.
 * - Circle deletion: only attempted after confirming all wills have circleId=NULL.
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
        // FK constraint: wills still reference this circle — cannot delete yet.
        // These are completed/terminated wills that weren't migrated (Stage A only migrates active wills).
        // They will be handled in Stage B when the circleId column is dropped.
        console.log(`[Migration]   Circle ${circle.id} skipped — has non-qualifying wills (FK constraint).`);
        skipped++;
        continue;
      }

      // No wills reference this circle at all — safe to delete
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`[Migration]   Deleted circle ${circle.id} (no qualifying wills).`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`[Migration]   Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    // Process qualifying wills
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

      // Step 4: Null out circleId — final completion marker
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`[Migration]   ✓ Will ${will.id} migrated`);
      willsMigrated++;
    }

    // After migrating all qualifying wills (all now have circleId=NULL),
    // check if any wills still reference this circle (e.g., non-qualifying/historical)
    const remainingWills = await db
      .select({ id: wills.id })
      .from(wills)
      .where(eq(wills.circleId, circle.id))
      .limit(1);

    if (remainingWills.length === 0) {
      // All wills migrated and circleId nulled — safe to delete the circle
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`[Migration]   ✓ Deleted circle ${circle.id} (all wills migrated).`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`[Migration]   Could not delete circle ${circle.id}:`, e);
      }
    } else {
      console.log(`[Migration]   Circle ${circle.id} preserved — has non-qualifying wills still referencing it.`);
      skipped++;
    }
  }

  console.log(`[Migration] Done. Wills migrated: ${willsMigrated}, invites: ${invitesCreated}, messages: ${messagesMigrated}, circles deleted: ${circlesDeleted}, skipped: ${skipped}`);
}
