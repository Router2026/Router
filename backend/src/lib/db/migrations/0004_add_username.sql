-- Replace display_name with a unique username field
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- Seed existing users
UPDATE users SET username = 'admin' WHERE email = 'admin@router.app' AND username IS NULL;
-- Fallback for any other existing users without a username
UPDATE users SET username = CONCAT('user_', id) WHERE username IS NULL;
