-- Family feed: posts and stories. Idempotent.

CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY,
  tree_id text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  about_person_id text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_tree_created_idx ON posts (tree_id, created_at DESC);
