/**
 * Migration 001: Will Kind & Visibility Reset
 *
 * Introduces the `kind` column ('solo' | 'team_i_will' | 'team_we_will' | 'public' | 'challenge')
 * and renames visibility='public' → visibility='open'.
 *
 * Safe to run multiple times — every step is idempotent.
 *
 * Execution order:
 *   1. Add nullable kind column (no-op if already exists)
 *   2. Backfill kind for all rows that still have kind IS NULL
 *   3. Rename visibility='public' → 'open' (no-op if already done)
 *   4. Make kind NOT NULL with default 'solo'
 *   5. Set visibility column default to 'open'
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runMigration001() {
  console.log("[Migration 001] Starting will-kind-visibility migration…");

  // Step 1 — add kind column (idempotent via IF NOT EXISTS)
  await db.execute(sql`
    ALTER TABLE wills
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20)
  `);
  console.log("[Migration 001] Step 1: kind column ensured.");

  // Step 2 — backfill kind for any rows that are still NULL
  // Precedence:
  //   visibility='public'                         → 'public'  (Public Wills, creator row)
  //   parentWillId IS NOT NULL                    → 'public'  (joined child wills)
  //   mode='team' AND will_type='cumulative'      → 'team_we_will'
  //   mode='team'                                 → 'team_i_will'
  //   else                                        → 'solo'
  const backfillResult = await db.execute(sql`
    UPDATE wills SET kind =
      CASE
        WHEN visibility = 'public'                                   THEN 'public'
        WHEN parent_will_id IS NOT NULL                              THEN 'public'
        WHEN mode = 'team' AND will_type = 'cumulative'              THEN 'team_we_will'
        WHEN mode = 'team'                                           THEN 'team_i_will'
        ELSE 'solo'
      END
    WHERE kind IS NULL
  `);
  console.log("[Migration 001] Step 2: backfilled kind for", (backfillResult as any).rowCount ?? "N/A", "rows.");

  // Step 3 — rename visibility='public' → 'open' (idempotent)
  const visResult = await db.execute(sql`
    UPDATE wills SET visibility = 'open' WHERE visibility = 'public'
  `);
  console.log("[Migration 001] Step 3: renamed visibility='public' → 'open' for", (visResult as any).rowCount ?? "N/A", "rows.");

  // Step 4 — make kind NOT NULL with default 'solo' (idempotent: no-op if already NOT NULL)
  await db.execute(sql`
    ALTER TABLE wills
      ALTER COLUMN kind SET NOT NULL,
      ALTER COLUMN kind SET DEFAULT 'solo'
  `);
  console.log("[Migration 001] Step 4: kind NOT NULL + DEFAULT 'solo' applied.");

  // Step 5 — set visibility default to 'open'
  await db.execute(sql`
    ALTER TABLE wills ALTER COLUMN visibility SET DEFAULT 'open'
  `);
  console.log("[Migration 001] Step 5: visibility DEFAULT 'open' applied.");

  // Verification
  const counts = await db.execute(sql`
    SELECT kind, visibility, COUNT(*) AS cnt
    FROM wills
    GROUP BY kind, visibility
    ORDER BY kind, visibility
  `);
  console.log("[Migration 001] Post-migration distribution:", JSON.stringify((counts as any).rows ?? counts));

  const nullCheck = await db.execute(sql`
    SELECT COUNT(*) AS null_kind FROM wills WHERE kind IS NULL
  `);
  const nullCount = Number((nullCheck as any).rows?.[0]?.null_kind ?? 0);
  if (nullCount > 0) {
    throw new Error(`[Migration 001] FAILED: ${nullCount} rows still have kind=NULL after backfill`);
  }

  const oldVisCheck = await db.execute(sql`
    SELECT COUNT(*) AS old_public FROM wills WHERE visibility = 'public'
  `);
  const oldCount = Number((oldVisCheck as any).rows?.[0]?.old_public ?? 0);
  if (oldCount > 0) {
    throw new Error(`[Migration 001] FAILED: ${oldCount} rows still have visibility='public' after rename`);
  }

  console.log("[Migration 001] ✓ Completed and verified successfully.");
}
