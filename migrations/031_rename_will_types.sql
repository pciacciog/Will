-- Migration 031: Rename will category types
-- habit → recurring, abstain → duration, mission → event
--
-- Run context: production DB had 0 rows with commitment_category set at time of migration.
-- These UPDATE statements are idempotent and safe to re-run.
--
UPDATE wills SET commitment_category = 'recurring' WHERE commitment_category = 'habit';
UPDATE wills SET commitment_category = 'duration'  WHERE commitment_category = 'abstain';
UPDATE wills SET commitment_category = 'event'     WHERE commitment_category = 'mission';

-- Same rename in will_commitments (column confirmed present: commitment_category varchar(10))
UPDATE will_commitments SET commitment_category = 'recurring' WHERE commitment_category = 'habit';
UPDATE will_commitments SET commitment_category = 'duration'  WHERE commitment_category = 'abstain';
UPDATE will_commitments SET commitment_category = 'event'     WHERE commitment_category = 'mission';

-- Add notification tracking columns for new category-aware scheduler behaviors
ALTER TABLE wills ADD COLUMN IF NOT EXISTS kickoff_notification_sent_at TIMESTAMP;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS category_completion_prompt_sent_at TIMESTAMP;
