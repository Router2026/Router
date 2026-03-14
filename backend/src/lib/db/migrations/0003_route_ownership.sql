-- ── Route ownership ───────────────────────────────────────────────────────
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_routes_user ON routes(user_id);
