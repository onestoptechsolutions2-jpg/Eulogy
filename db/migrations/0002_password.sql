-- Email + password sign-in (Auth.js Credentials provider). Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
