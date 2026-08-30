-- Shared eulogy: one collaborative tribute page per person, with an
-- optional public share link and moderated tributes from link visitors.
-- Idempotent.

CREATE TABLE IF NOT EXISTS eulogies (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  share_token text NOT NULL UNIQUE,
  link_enabled boolean NOT NULL DEFAULT false,
  allow_tributes boolean NOT NULL DEFAULT true,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS eulogies_person_idx ON eulogies (person_id);

CREATE TABLE IF NOT EXISTS eulogy_entries (
  id text PRIMARY KEY,
  eulogy_id text NOT NULL REFERENCES eulogies(id) ON DELETE CASCADE,
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  relationship text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'published',   -- published | pending | dismissed
  source text NOT NULL DEFAULT 'member',      -- member | link
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eulogy_entries_eulogy_idx ON eulogy_entries (eulogy_id, created_at);
