-- Migration: 005_auth_users.sql
-- Adds authentication fields to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Seed demo password for existing user id=1 (password: 'demo1234')
-- bcrypt hash generated externally; replace with real hashed password at runtime
UPDATE users
SET password_hash = '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WqxCBCMgbRWkYB9b5Qa2'
WHERE id = 1 AND password_hash IS NULL;
