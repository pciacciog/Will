-- Additive-only schema restoration after Neon point-in-time restore to Apr 18 12:00 EDT.
-- All operations are IF NOT EXISTS / no DROP. Safe to re-run.

BEGIN;

-- ─── Missing columns on users ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(30);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;

-- ─── Missing columns on circles ─────────────────────────────────────────────
ALTER TABLE circles ADD COLUMN IF NOT EXISTS migrated_at timestamp;

-- ─── Missing columns on wills ───────────────────────────────────────────────
ALTER TABLE wills ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS commitment_category varchar(10);
ALTER TABLE wills ADD COLUMN IF NOT EXISTS milestones text;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS deadline_reminders text;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS mission_reminder_time varchar(5);
ALTER TABLE wills ADD COLUMN IF NOT EXISTS streak_start_date timestamp;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS sent_milestones text;
ALTER TABLE wills ADD COLUMN IF NOT EXISTS sent_deadline_reminders text;

-- ─── Missing columns on will_commitments ────────────────────────────────────
ALTER TABLE will_commitments ADD COLUMN IF NOT EXISTS commitment_category varchar(10);
ALTER TABLE will_commitments ADD COLUMN IF NOT EXISTS mission_completed boolean DEFAULT false;
ALTER TABLE will_commitments ADD COLUMN IF NOT EXISTS mission_completed_at timestamp;

-- ─── Missing tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friendships (
  id serial PRIMARY KEY,
  requester_id varchar NOT NULL REFERENCES users(id),
  addressee_id varchar NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_friendships_requester_id" ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS "IDX_friendships_addressee_id" ON friendships(addressee_id);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_friendships_pair" ON friendships(requester_id, addressee_id);

CREATE TABLE IF NOT EXISTS shared_will_invites (
  id serial PRIMARY KEY,
  will_id integer NOT NULL REFERENCES wills(id),
  invited_user_id varchar NOT NULL REFERENCES users(id),
  invited_by_user_id varchar NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'pending',
  responded_at timestamp,
  expires_at timestamp,
  reminder_sent_at timestamp,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_shared_will_invites_will_id" ON shared_will_invites(will_id);
CREATE INDEX IF NOT EXISTS "IDX_shared_will_invites_invited_user_id" ON shared_will_invites(invited_user_id);

CREATE TABLE IF NOT EXISTS will_message_reads (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id),
  parent_will_id integer NOT NULL REFERENCES wills(id),
  last_read_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_will_message_reads_user_will" ON will_message_reads(user_id, parent_will_id);

CREATE TABLE IF NOT EXISTS will_proofs (
  id serial PRIMARY KEY,
  will_id integer NOT NULL REFERENCES wills(id),
  user_id varchar NOT NULL REFERENCES users(id),
  image_url text NOT NULL,
  thumbnail_url text,
  cloudinary_public_id text,
  caption text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_will_proofs_will_id" ON will_proofs(will_id);
CREATE INDEX IF NOT EXISTS "IDX_will_proofs_user_id" ON will_proofs(user_id);

CREATE TABLE IF NOT EXISTS circle_proofs (
  id serial PRIMARY KEY,
  circle_id integer NOT NULL REFERENCES circles(id),
  will_id integer REFERENCES wills(id),
  user_id varchar NOT NULL REFERENCES users(id),
  image_url text NOT NULL,
  thumbnail_url text,
  cloudinary_public_id text,
  caption text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_circle_proofs_circle_will" ON circle_proofs(circle_id, will_id);
CREATE INDEX IF NOT EXISTS "IDX_circle_proofs_user" ON circle_proofs(user_id);
CREATE INDEX IF NOT EXISTS "IDX_circle_proofs_status" ON circle_proofs(status);

CREATE TABLE IF NOT EXISTS abstain_logs (
  id serial PRIMARY KEY,
  will_id integer NOT NULL REFERENCES wills(id),
  user_id varchar NOT NULL REFERENCES users(id),
  honored boolean NOT NULL,
  date varchar(10) NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "abstain_logs_will_user_date_unique" ON abstain_logs(will_id, user_id, date);

CREATE TABLE IF NOT EXISTS cloudinary_cleanup_log (
  id serial PRIMARY KEY,
  public_id text NOT NULL,
  failed_at timestamp DEFAULT now(),
  reason text
);

COMMIT;
