-- Migration 031: Rename will category types
-- habit → recurring, abstain → duration, mission → event
--
-- Run context: production DB had 0 rows with commitment_category set at time of migration.
-- These UPDATE statements are idempotent and safe to re-run.
--
UPDATE wills SET commitment_category = 'recurring' WHERE commitment_category = 'habit';
UPDATE wills SET commitment_category = 'duration'  WHERE commitment_category = 'abstain';
UPDATE wills SET commitment_category = 'event'     WHERE commitment_category = 'mission';

-- Same rename in will_commitments (if the column is tracked there in future):
-- UPDATE will_commitments SET commitment_category = 'recurring' WHERE commitment_category = 'habit';
-- UPDATE will_commitments SET commitment_category = 'duration'  WHERE commitment_category = 'abstain';
-- UPDATE will_commitments SET commitment_category = 'event'     WHERE commitment_category = 'mission';

-- Add kickoff notification tracking column for Duration wills (day-1 notification)
ALTER TABLE wills ADD COLUMN IF NOT EXISTS kickoff_notification_sent_at TIMESTAMP;
