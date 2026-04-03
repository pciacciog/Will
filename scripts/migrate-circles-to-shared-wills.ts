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
 * IDEMPOTENCY DESIGN (per-step, recoverable from partial failures):
 * - Step 1 (mode='shared'): skipped if already set; safe to re-apply.
 * - Step 2 (invites): each invite guarded by (willId, invitedUserId) existence check.
 * - Step 3 (messages): dedupe by (willId, userId, text, createdAt to-the-second).
 * - Step 4 (circleId=NULL): final marker — on rerun, nulled wills won't appear in
 *   the activeCircleWills query, so all prior steps are cleanly skipped.
 *   Partial failures (e.g., crash between steps 1–3 and step 4) are safe to rerun:
 *   the will still has circleId set, so it's picked up again and all steps re-checked.
 * - Circle-deletion idempotency: before deleting an empty circle, check if any will
 *   in mode='shared' was created by any member of that circle. If so, the circle was
 *   migrated in a prior run — preserve source data during Stage A window.
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
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

    if (activeCircleWills.length === 0) {
      // No active wills reference this circle. Check whether it was already migrated
      // in a prior run (wills may have completed since) before deciding to delete.
      const memberIds = await db
        .select({ userId: circleMembers.userId })
        .from(circleMembers)
        .where(eq(circleMembers.circleId, circle.id));

      if (memberIds.length === 0) {
        // Truly empty circle (no members) — safe to delete
        try {
          await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
          await db.delete(circles).where(eq(circles.id, circle.id));
          console.log(`  ✓ Deleted memberless circle ${circle.id} (inviteCode: ${circle.inviteCode})`);
          circlesDeleted++;
        } catch (e) {
          console.warn(`  ⚠ Could not delete circle ${circle.id}:`, e);
        }
        continue;
      }

      // Deterministic prior-migration detection:
      // After successful migration, wills.circleId is NULLed, so we can't simply join on circleId.
      // We look for ANY will (any status) that still references this circleId — including
      // completed/terminated wills that weren't in the qualifying-statuses set.
      // If any such will existed, this circle had activity and may have been migrated.
      // We also check for shared wills created by members where both the creator AND at least
      // one other member (from shared_will_invites) are both in this circle — this provides
      // a circle-scoped signal that can't be confused with independently-created shared wills.
      const anyCircleWillCheck = await db
        .select({ id: wills.id, mode: wills.mode })
        .from(wills)
        .where(eq(wills.circleId, circle.id))
        .limit(1);

      if (anyCircleWillCheck.length > 0) {
        // A non-qualifying will (e.g., completed/terminated) still references this circleId.
        // The circle had real activity — preserve source data during Stage A window.
        console.log(`  ↩ Circle ${circle.id} has historical wills (status: ${anyCircleWillCheck[0].mode}), preserving source data`);
        skipped++;
        continue;
      }

      // No wills reference this circle at all — check for migrated wills (circleId was nulled)
      // using circle-scoped invite evidence: shared will where BOTH creator AND at least one
      // invitee are members of this circle.
      const memberUserIds = memberIds.map((m) => m.userId);
      const memberSet = new Set(memberUserIds);
      const sharedWillsForMembers = await db
        .select({ id: wills.id, createdBy: wills.createdBy })
        .from(wills)
        .where(
          and(
            eq(wills.mode, 'shared'),
            sql`${wills.createdBy} = ANY(ARRAY[${sql.join(memberUserIds.map(id => sql`${id}`), sql`, `)}]::text[])`
          )
        );

      let alreadyMigrated = false;
      for (const sharedWill of sharedWillsForMembers) {
        if (!memberSet.has(sharedWill.createdBy)) continue;
        const invites = await db
          .select({ invitedUserId: sharedWillInvites.invitedUserId })
          .from(sharedWillInvites)
          .where(eq(sharedWillInvites.willId, sharedWill.id));
        const hasCircleMemberInvitee = invites.some(inv => memberSet.has(inv.invitedUserId));
        if (hasCircleMemberInvitee) {
          alreadyMigrated = true;
          break;
        }
      }
      if (alreadyMigrated) {
        console.log(`  ↩ Circle ${circle.id} already migrated (circle-scoped shared will found), preserving source data`);
        skipped++;
        continue;
      }

      // No qualifying will and no prior migration evidence — truly inactive circle
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
      console.log(`  Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

      // Step 1: Set mode = 'shared' (idempotent — safe to re-apply)
      if (will.mode !== "shared") {
        await db
          .update(wills)
          .set({ mode: "shared" })
          .where(eq(wills.id, will.id));
      }

      // Step 2: Create shared_will_invites for each committed member
      // Idempotent: each invite is guarded by (willId, invitedUserId) existence check
      const commitments = await db
        .select()
        .from(willCommitments)
        .where(eq(willCommitments.willId, will.id));

      const committedUserIds = new Set(commitments.map((c) => c.userId));

      for (const member of members) {
        if (!committedUserIds.has(member.userId)) continue;
        if (member.userId === will.createdBy) continue; // creator never gets an invite row

        const existingInvite = await db
          .select({ id: sharedWillInvites.id })
          .from(sharedWillInvites)
          .where(
            and(
              eq(sharedWillInvites.willId, will.id),
              eq(sharedWillInvites.invitedUserId, member.userId)
            )
          );

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

      // Step 3: Migrate circle_messages into will_messages
      // Idempotent: dedupe by (willId, userId, text, createdAt to-the-second)
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

        if (existing.length > 0) continue;

        await db.insert(willMessages).values({
          willId: will.id,
          userId: msg.userId,
          text: msg.text,
          createdAt: msgCreatedAt,
        });
        messagesMigrated++;
      }

      // Step 4: Null out circleId — this is the final migration marker for Stage A
      // On rerun the will won't appear in the activeCircleWills query (circleId IS NULL),
      // so all steps above are safely skipped. The circle's idempotency check (mode='shared'
      // will with this circleId) uses the database before circleId is nulled — safe because
      // the circle-deletion path only runs when there are no active wills at all.
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
