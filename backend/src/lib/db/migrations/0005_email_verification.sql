-- Email verification & password reset tokens
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Mark all existing users as already verified (they registered before verification existed)
UPDATE users SET email_verified = true;
