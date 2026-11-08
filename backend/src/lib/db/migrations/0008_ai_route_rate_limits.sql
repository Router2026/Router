-- ── AI route planner: per-user rate limiting ───────────────────────────────
--
-- Fixed-window counter (one row per user per hour). Stored in Postgres because
-- Vercel functions are stateless, so in-memory counters are not shared between
-- instances. A single atomic INSERT ... ON CONFLICT ... RETURNING both
-- increments and reads the counter, so concurrent requests cannot race.
--
-- Old windows are pruned opportunistically by the application.

CREATE TABLE IF NOT EXISTS ai_route_rate_limits (
  user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

-- Supports the periodic "DELETE WHERE window_start < ..." cleanup.
CREATE INDEX IF NOT EXISTS ai_route_rate_limits_window_idx
  ON ai_route_rate_limits (window_start);

-- The backend connects directly as the table owner (bypasses RLS). Enabling RLS
-- with no policies blocks access through Supabase's public REST API (anon key).
ALTER TABLE ai_route_rate_limits ENABLE ROW LEVEL SECURITY;
