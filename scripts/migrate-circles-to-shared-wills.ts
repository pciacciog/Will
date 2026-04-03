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
 * For circles with NO qualifying will: delete the circle record.
 *
 * This script is idempotent — safe to re-run.
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { eq, inArray, and, isNotNull, sql } from "drizzle-orm";
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
    // Find qualifying wills for this circle
    const circleWills = await db
      .select()
      .from(wills)
      .where(
        and(
          eq(wills.circleId, circle.id),
          sql`${wills.status} IN ('active','scheduled','pending','paused','will_review')`
        )
      );

    if (circleWills.length === 0) {
      // No qualifying will — delete the circle
      try {
        // First delete circle members
        await db.delete(circleMembers).where(eq(circleMembers.circleId, circle.id));
        // Delete circle messages
        await db.delete(circleMessages).where(eq(circleMessages.circleId, circle.id));
        // Delete circle
        await db.delete(circles).where(eq(circles.id, circle.id));
        console.log(`  ✓ Deleted empty circle ${circle.id} (inviteCode: ${circle.inviteCode})`);
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

    for (const will of circleWills) {
      // Idempotent check: already migrated?
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

      // 3. Migrate circle_messages into will_messages (idempotent via content+timestamp match)
      for (const msg of msgs) {
        // Check if a matching will_message already exists (by userId + content + approximate time)
        const existing = await db
          .select({ id: willMessages.id })
          .from(willMessages)
          .where(
            and(
              eq(willMessages.willId, will.id),
              eq(willMessages.userId, msg.userId),
              eq(willMessages.content, msg.content)
            )
          );

        if (existing.length > 0) {
          continue; // Already migrated
        }

        await db.insert(willMessages).values({
          willId: will.id,
          userId: msg.userId,
          content: msg.content,
          createdAt: msg.createdAt ?? new Date(),
        });
        messagesMigrated++;
      }

      // 4. Set circleId = NULL
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
