-- 0013: route reasons — why the trip agents built a saved route the way they did.
--
-- route_stops.reason: why this stop is here, at this time ("מסלול הליכה — בבוקר, לפני החום").
-- routes.why:         how the day was built (agent 5's why_this_route, or a factual fallback).
-- Both come from the planner (lib/trip-agents/reasons.ts, summary-agent.ts) and are NULL for
-- routes built by hand. smart_insight stays the practical tip.
--
-- Apply manually (same as 0001–0012). Idempotent; safe to re-run.
-- Rollback:
--   ALTER TABLE router.route_stops DROP COLUMN IF EXISTS reason;
--   ALTER TABLE router.routes DROP COLUMN IF EXISTS why;

ALTER TABLE router.route_stops ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE router.routes      ADD COLUMN IF NOT EXISTS why    TEXT;
