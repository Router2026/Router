-- ── Auth columns for users ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_admin      BOOLEAN DEFAULT FALSE;

-- ── Admin user (password: admin123) ──────────────────────────────────────
-- Hash is PBKDF2-SHA256, 100k iterations, salt=deadbeef0123456789abcdef01234567
INSERT INTO users (email, full_name, display_name, password_hash, is_admin, xp_points, level)
VALUES (
  'admin@router.app',
  'Admin',
  'Admin',
  'deadbeef0123456789abcdef01234567:efe68b2e54f2490f0ee4d86180fd728b34814ea898214885e6d02af21fa9a0ca',
  true,
  9999,
  'מנהל'
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      is_admin      = true;
