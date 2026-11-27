-- ── AI: site-wide daily budget ──────────────────────────────────────────────
--
-- One row per Israel-time day: how many paid AI requests the whole site made.
-- Caps total spend even when many accounts each stay under their own hourly
-- quota (ai_route_rate_limits, migration 0008). Atomic INSERT ... ON CONFLICT
-- ... RETURNING, same as 0008. Old days are pruned by the application.

CREATE TABLE IF NOT EXISTS ai_daily_budget (
  day           DATE    PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0
);

-- Backend connects as the table owner; RLS with no policies blocks the anon REST API.
ALTER TABLE ai_daily_budget ENABLE ROW LEVEL SECURITY;
