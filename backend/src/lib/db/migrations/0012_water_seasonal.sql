-- 0012: water_seasonal — the place's water is unreliable (dry most of the year / only after rain).
--
-- has_water says a place is a water site; water_seasonal = TRUE means don't count on finding water.
-- Effects: the "water" attribute filter and water-themed trip planning skip these places, and the
-- app doesn't show a "מים" tag for them. Set by scripts/mark-seasonal-water.ts (OSM intermittent=yes
-- and explicit description wording); admins can change it later.
--
-- Apply manually (same as 0001–0011). Idempotent; safe to re-run.
-- Rollback:  ALTER TABLE router.locations DROP COLUMN IF EXISTS water_seasonal;

ALTER TABLE router.locations
  ADD COLUMN IF NOT EXISTS water_seasonal BOOLEAN NOT NULL DEFAULT FALSE;
