-- Migration 032: Add commit_reminder_sent_at column to shared_will_invites
-- This column tracks when the ~2h-before "finish committing" reminder was sent
-- to invitees who accepted but never submitted a commitment (ACCEPTED-but-uncommitted).
-- Referenced by sendTeamWillCommitReminders in server/scheduler.ts.
-- Column was defined in shared/schema.ts but never applied to the database,
-- causing a recurring scheduler error: "column shared_will_invites.commit_reminder_sent_at does not exist".
--
-- Already applied to production manually on 2026-05-11; included here for reproducibility.
ALTER TABLE shared_will_invites ADD COLUMN IF NOT EXISTS commit_reminder_sent_at TIMESTAMP;
