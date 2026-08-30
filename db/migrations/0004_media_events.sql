-- Photos (profile picture, background, gallery) + life events. Idempotent.
--
-- Image bytes are stored base64 in media.data for now — small family
-- archive, capped per-upload in lib/media.ts. Swap for object storage
-- later without touching callers (people.photo_url / cover_url just hold
-- whatever URL, including our own /media/<id> route).

ALTER TABLE people ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS media (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id text,
  kind text NOT NULL DEFAULT 'gallery',          -- avatar | cover | gallery
  mime_type text NOT NULL,
  data text NOT NULL,                             -- base64-encoded bytes
  byte_size integer NOT NULL DEFAULT 0,
  caption text NOT NULL DEFAULT '',
  uploaded_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_person_idx ON media (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_tree_idx ON media (tree_id, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',            -- birth|death|marriage|baptism|graduation|residence|military|immigration|custom
  title text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',                  -- free text, like people.birth_date
  place text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_person_idx ON events (person_id);
