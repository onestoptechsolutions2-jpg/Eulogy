-- Switch from magic-link auth to OAuth (Auth.js). Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '';
DROP TABLE IF EXISTS login_tokens;
