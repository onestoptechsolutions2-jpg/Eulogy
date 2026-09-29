-- One family per user. users.tree_id (NOT NULL) + users.role replace
-- tree_members. Idempotent.
--
-- Backfill order: (1) take each user's existing membership, owner role first
-- then the oldest; (2) any user still without one gets a family of their own.
-- tree_members is left in place, unused, as a rollback safety net.

ALTER TABLE users ADD COLUMN IF NOT EXISTS tree_id text REFERENCES trees(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'contributor';
ALTER TABLE trees ALTER COLUMN owner_id DROP NOT NULL;

UPDATE users u
SET tree_id = m.tree_id, role = m.role
FROM (
  SELECT DISTINCT ON (user_id) user_id, tree_id, role
  FROM tree_members
  ORDER BY user_id, (role = 'owner') DESC, created_at ASC
) m
WHERE m.user_id = u.id AND u.tree_id IS NULL;

INSERT INTO trees (id, name, owner_id)
SELECT 'f' || substr(md5(u.id), 1, 20),
       coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) || ' family',
       u.id
FROM users u
WHERE u.tree_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE users u
SET tree_id = 'f' || substr(md5(u.id), 1, 20), role = 'owner'
WHERE u.tree_id IS NULL;

ALTER TABLE users ALTER COLUMN tree_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS users_tree_idx ON users (tree_id);
