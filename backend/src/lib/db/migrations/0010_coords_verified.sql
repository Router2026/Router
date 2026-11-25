-- 0010: coords_verified — whether a location's coordinates come from a precise source.
--
-- Seeded rows from parks.org.il / amudanan / KKL / beaches had coordinates rounded to 2 decimals
-- (~1 km), some tens of km off. Rows that were re-matched to OpenStreetMap / Wikidata, and all
-- OSM / community rows, are verified. The rest are set FALSE by scripts (not here) and are
-- excluded from route planning until someone fixes them; they stay visible on the map and in search.
--
-- Default TRUE: new rows come from OSM ingestion, community map pins or admin edits — all precise.
-- Editing latitude/longitude through updateLocation() sets it back to TRUE.
--
-- Apply manually (same as 0001–0009). Idempotent; safe to re-run.
-- Rollback:  ALTER TABLE router.locations DROP COLUMN IF EXISTS coords_verified;

ALTER TABLE router.locations
  ADD COLUMN IF NOT EXISTS coords_verified BOOLEAN NOT NULL DEFAULT TRUE;
