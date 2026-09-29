-- Every user is linked to exactly one person, in their own family.
-- users.person_id replaces people.claimed_by_user_id; users.onboarded_at
-- replaces the "skip" cookie. Idempotent.
--
-- The composite foreign key guarantees the person sits in the user's own
-- family. It is DEFERRABLE INITIALLY DEFERRED so a Gramps re-import (which
-- deletes and re-inserts people in one transaction) can pass through.

ALTER TABLE users ADD COLUMN IF NOT EXISTS person_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- existing accounts already went through onboarding
UPDATE users SET onboarded_at = now() WHERE onboarded_at IS NULL;

-- 1. accounts that had claimed a person keep that person
UPDATE users u
SET person_id = p.id
FROM people p
WHERE p.claimed_by_user_id = u.id AND p.tree_id = u.tree_id AND u.person_id IS NULL;

-- 2. everyone else gets a new person, named from their account
INSERT INTO people (id, tree_id, given, surname)
SELECT 'p' || substr(md5(u.id), 1, 20),
       u.tree_id,
       split_part(coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)), ' ', 1),
       trim(substr(coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)),
                   length(split_part(coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)), ' ', 1)) + 1))
FROM users u
WHERE u.person_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE users SET person_id = 'p' || substr(md5(id), 1, 20) WHERE person_id IS NULL;

ALTER TABLE users ALTER COLUMN person_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_tree_id_id_uidx ON people (tree_id, id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_person_unique;
ALTER TABLE users ADD CONSTRAINT users_person_unique UNIQUE (person_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_person_fk;
ALTER TABLE users ADD CONSTRAINT users_person_fk
  FOREIGN KEY (tree_id, person_id) REFERENCES people (tree_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE people DROP COLUMN IF EXISTS claimed_by_user_id;
