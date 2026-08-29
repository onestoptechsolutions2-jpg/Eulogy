-- Mizizi initial schema. Applied by `npm run db:migrate` (scripts/migrate.ts).
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_tokens (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS trees (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tree_members (
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tree_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  email text NOT NULL,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor',
  person_id text,
  token text NOT NULL UNIQUE,
  invited_by text REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations (email);

CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  gramps_id text NOT NULL DEFAULT '',
  given text NOT NULL DEFAULT '',
  surname text NOT NULL DEFAULT '',
  prefix text NOT NULL DEFAULT '',
  suffix text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  nick text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT 'U',
  birth_date text NOT NULL DEFAULT '',
  death_date text NOT NULL DEFAULT '',
  living boolean NOT NULL DEFAULT true,
  claimed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  photo_url text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS people_tree_idx ON people (tree_id);
-- fuzzy name search
CREATE INDEX IF NOT EXISTS people_name_trgm_idx
  ON people USING gin ((lower(given || ' ' || surname)) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS families (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  gramps_id text NOT NULL DEFAULT '',
  partner1_id text,
  partner2_id text,
  rel_type text NOT NULL DEFAULT 'Unknown'
);
CREATE INDEX IF NOT EXISTS families_tree_idx ON families (tree_id);

CREATE TABLE IF NOT EXISTS family_children (
  family_id text NOT NULL,
  child_id text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, child_id)
);
CREATE INDEX IF NOT EXISTS family_children_child_idx ON family_children (child_id);

CREATE TABLE IF NOT EXISTS edit_suggestions (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  suggested_by_user_id text NOT NULL REFERENCES users(id),
  field text NOT NULL,
  value text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
