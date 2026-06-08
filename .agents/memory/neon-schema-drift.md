---
name: Neon production DB schema drift
description: How to handle schema migrations for the Neon production database vs Replit dev PostgreSQL
---

The app has TWO separate databases:
- **Dev (Replit PostgreSQL)**: Updated automatically via `npm run db:push`. Host shows as "helium" in logs.
- **Production (Neon)**: `ep-super-meadow-afmffjco.c-2.us-west-2.aws.neon.tech/neondb`. The deployed app uses this. `db:push` does NOT run against it automatically.

**Why:** The deployed Replit app has its own DATABASE_URL environment variable pointing to the Neon database, separate from the workspace DATABASE_URL.

**How to apply:** After any schema change that gets pushed to the Replit dev DB, also run the equivalent ALTER TABLE on the Neon production DB via psql. Use `PGPASSWORD` env approach — credentials are in user's secrets (DATABASE_URL_STAGING may point there). Always use `ADD COLUMN IF NOT EXISTS` and backfill new columns.

**Example fix (June 2026):** Added `kind varchar(20) NOT NULL DEFAULT 'solo'` column to `wills` table in Neon DB after Challenge Will feature was deployed. Backfilled with CASE WHEN based on `mode` and `will_type`. This caused every Drizzle query to `wills` to fail ("column kind does not exist") on the production app.
