/**
 * Circle → Team Will Migration (Stage A)
 * Called on server startup — idempotent and safe to re-run.
 *
 * MIGRATION CATEGORIES (evaluated per circle):
 *
 *   A) circle.migratedAt IS NOT NULL
 *      Already migrated — skip entirely (Stage A 30-day preservation window).
 *
 *   B) circle.migratedAt IS NULL AND has qualifying wills (active/scheduled/pending/paused/will_review with circleId set):
 *      1. Set wills.mode = 'team'
 *      2. Create shared_will_invites for committed members (per-invite idempotency)
 *      3. Migrate circle_messages → will_messages in a transaction (all-or-nothing per will)
 *      4. Set wills.circleId = NULL (unlinks the will from circle)
 *      5. Set circles.migratedAt = NOW() — marks this circle as migrated; skipped on all future startups.
 *      Source circle rows are preserved (NOT deleted) for 30-day Stage A validation buffer.
 *
 *   C) circle.migratedAt IS NULL AND no qualifying wills:
 *      These circles never had active wills to migrate.
 *      Null any FK references (wills.circleId, userNotifications.circleId) and delete the circle.
 *
 * IDEMPOTENCY:
 * - Category A: entire circle block skipped on rerun (migratedAt gate).
 * - Category B, Step 1: skipped if mode is already 'team'.
 * - Category B, Step 2: per-invite existence check before inserting.
 * - Category B, Step 3: skipped if will_messages already has rows for this will.
 * - Category B, Step 4+5: once circleId is NULL and migratedAt is set, future reruns skip via category A.
 * - Category C: safe to rerun (nulling already-null FKs and deleting already-deleted rows are no-ops).
 */

import { db } from "./db";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  circles,
  circleMembers,
  circleMessages,
  wills,
  willCommitments,
  teamWillInvites,
  willMessages,
  userNotifications,
} from "@shared/schema";

export async function runCircleMigration(): Promise<void> {
  const allCircles = await db.select().from(circles);
  if (allCircles.length === 0) {
    return;
  }

  console.log(`[Migration] Starting circle → team will migration. Found ${allCircles.length} circles.`);

  let willsMigrated = 0;
  let circlesDeleted = 0;
  let circlesMigrated = 0;
  let circlesSkipped = 0;
  let messagesMigrated = 0;
  let invitesCreated = 0;

  for (const circle of allCircles) {
    // Category A: already migrated — preserve for Stage A 30-day window
    if (circle.migratedAt !== null) {
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
      await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
      await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
      await db.delete(circles).where(eq(circles.id, circle.id));
      console.log(`[Migration]   Deleted circle ${circle.id} (no qualifying wills).`);
      circlesDeleted++;
      continue;
    }

    // Category B: has qualifying wills — migrate then preserve
    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

    if (qualifyingWills.length > 1) {
      console.warn(`[Migration]   Circle ${circle.id} has ${qualifyingWills.length} qualifying wills — messages will be copied to each. Verify deduplication.`);
    }

    for (const will of qualifyingWills) {
      console.log(`[Migration]   Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

      // Step 1: Set mode = 'shared' (idempotent)
      if (will.mode !== "shared") {
        await db.update(wills).set({ mode: "team" }).where(eq(wills.id, will.id));
      }

      // Step 2: Create shared_will_invites for committed members (per-invite idempotency)
      const commitments = await db.select().from(willCommitments).where(eq(willCommitments.willId, will.id));
      const committedUserIds = new Set(commitments.map((c) => c.userId));

      for (const member of members) {
        if (!committedUserIds.has(member.userId)) continue;
        if (member.userId === will.createdBy) continue;

        const existingInvite = await db
          .select({ id: teamWillInvites.id })
          .from(teamWillInvites)
          .where(and(eq(teamWillInvites.willId, will.id), eq(teamWillInvites.invitedUserId, member.userId)));

        if (existingInvite.length > 0) continue;

        await db.insert(teamWillInvites).values({
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

      console.log(`[Migration]   ✓ Will ${will.id} migrated.`);
      willsMigrated++;
    }

    // Step 5: Mark circle as migrated — skips this circle on all future startups (Stage A preservation)
    await db.update(circles).set({ migratedAt: new Date() }).where(eq(circles.id, circle.id));
    console.log(`[Migration]   ✓ Circle ${circle.id} marked as migrated (preserved for Stage A window).`);
    circlesMigrated++;
  }

  console.log(`[Migration] Done. Wills migrated: ${willsMigrated}, invites: ${invitesCreated}, messages: ${messagesMigrated}, circles migrated+preserved: ${circlesMigrated}, circles deleted: ${circlesDeleted}, already-done: ${circlesSkipped}`);
}
