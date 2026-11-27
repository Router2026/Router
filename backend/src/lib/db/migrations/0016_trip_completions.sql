-- 0016: trip completions — a user finished (part of) a saved trip in live mode.
--
-- One row per user per route; the primary key is what makes the completion XP a one-time award
-- (INSERT ... ON CONFLICT DO NOTHING RETURNING, as trip_shares does for sharing).
-- stops_done is what the client reported, kept for stats.
--
-- Apply manually (same as 0001–0015). Idempotent; safe to re-run.
-- Rollback:
--   DROP TABLE IF EXISTS router.trip_completions;

CREATE TABLE IF NOT EXISTS router.trip_completions (
  route_id      INTEGER NOT NULL REFERENCES router.routes(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stops_done    INTEGER NOT NULL CHECK (stops_done >= 1),
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

-- Backend connects as the table owner; RLS with no policies blocks the anon REST API (as in 0014).
ALTER TABLE router.trip_completions ENABLE ROW LEVEL SECURITY;
