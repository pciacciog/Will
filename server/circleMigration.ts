/**
 * Circle → Shared Will Migration (Stage A)
 * Called on server startup — idempotent and safe to re-run.
 *
 * For each circle that has an active will (status in active/scheduled/pending/paused/will_review):
 *   1. Set wills.mode = 'shared'
 *   2. Create shared_will_invites rows (status='accepted') for committed members (per-row idempotency)
 *   3. Migrate circle_messages into will_messages (dedupe by content + timestamp)
 *   4. Set wills.circleId = NULL (final completion marker)
 *
 * For circles with no qualifying will and no evidence of prior migration: delete the circle.
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
    console.log("[Migration] No circles found — nothing to migrate.");
    return;
  }

  console.log(`[Migration] Starting circle → shared will migration. Found ${allCircles.length} circles.`);

  let willsMigrated = 0;
  let circlesDeleted = 0;
  let messagesMigrated = 0;
  let invitesCreated = 0;
  let skipped = 0;

  for (const circle of allCircles) {
    // Find qualifying wills that still reference this circleId
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
      // No active wills. Check if this circle should be deleted or preserved.
      const memberIds = await db
        .select({ userId: circleMembers.userId })
        .from(circleMembers)
        .where(eq(circleMembers.circleId, circle.id));

      if (memberIds.length === 0) {
        // Verify no wills reference this circle (would cause FK violation)
        const anyWill = await db.select({ id: wills.id }).from(wills).where(eq(wills.circleId, circle.id)).limit(1);
        if (anyWill.length > 0) {
          console.log(`[Migration]   Circle ${circle.id} has no members but has wills — preserving (Stage A).`);
          skipped++;
          continue;
        }
        try {
          await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
          await db.delete(circles).where(eq(circles.id, circle.id));
          console.log(`[Migration]   Deleted memberless circle ${circle.id}`);
          circlesDeleted++;
        } catch (e) {
          console.warn(`[Migration]   Could not delete circle ${circle.id}:`, e);
        }
        continue;
      }

      // Check for historical wills (non-qualifying status) still referencing this circle
      const anyCircleWillCheck = await db
        .select({ id: wills.id })
        .from(wills)
        .where(eq(wills.circleId, circle.id))
        .limit(1);

      if (anyCircleWillCheck.length > 0) {
        console.log(`[Migration]   Circle ${circle.id} has historical wills — preserving (Stage A).`);
        skipped++;
        continue;
      }

      // Check for circle-scoped migrated wills (circleId was nulled):
      // a shared will where BOTH the creator AND at least one invitee are members of this circle.
      const memberUserIds = memberIds.map((m) => m.userId);
      const memberSet = new Set(memberUserIds);

      const sharedWillsForMembers = await db
        .select({ id: wills.id, createdBy: wills.createdBy })
        .from(wills)
        .where(
          and(
            eq(wills.mode, "shared"),
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
        if (invites.some(inv => memberSet.has(inv.invitedUserId))) {
          alreadyMigrated = true;
          break;
        }
      }

      if (alreadyMigrated) {
        console.log(`[Migration]   Circle ${circle.id} previously migrated — preserving (Stage A).`);
        skipped++;
        continue;
      }

      // Truly inactive circle — delete it
      try {
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`[Migration]   Deleted inactive circle ${circle.id}`);
        circlesDeleted++;
      } catch (e) {
        console.warn(`[Migration]   Could not delete circle ${circle.id}:`, e);
      }
      continue;
    }

    // Process qualifying wills
    const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
    const msgs = await db.select().from(circleMessages).where(eq(circleMessages.circleId, circle.id));

    for (const will of activeCircleWills) {
      console.log(`[Migration]   Migrating will ${will.id} (circle ${circle.id}, status: ${will.status})`);

      // Step 1: Set mode = 'shared'
      if (will.mode !== "shared") {
        await db.update(wills).set({ mode: "shared" }).where(eq(wills.id, will.id));
      }

      // Step 2: Create shared_will_invites for committed members
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

      // Step 3: Migrate circle_messages → will_messages (all-or-nothing per will)
      // Idempotency: if will_messages already has any entries for this will, messages were
      // already migrated in a prior run — skip entirely to avoid any duplication.
      if (msgs.length > 0) {
        const existingCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(willMessages)
          .where(eq(willMessages.willId, will.id));
        const alreadyHasMessages = Number(existingCount[0]?.count || 0) > 0;
        if (!alreadyHasMessages) {
          for (const msg of msgs) {
            await db.insert(willMessages).values({
              willId: will.id,
              userId: msg.userId,
              text: msg.text,
              createdAt: msg.createdAt ?? new Date(),
            });
            messagesMigrated++;
          }
        }
      }

      // Step 4: Null out circleId — final completion marker
      await db.update(wills).set({ circleId: null }).where(eq(wills.id, will.id));

      console.log(`[Migration]   ✓ Will ${will.id} migrated`);
      willsMigrated++;
    }
  }

  console.log(`[Migration] Done. Wills migrated: ${willsMigrated}, invites: ${invitesCreated}, messages: ${messagesMigrated}, circles deleted: ${circlesDeleted}, skipped: ${skipped}`);
}
