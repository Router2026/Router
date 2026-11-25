-- 0011: where a location's description comes from.
--
-- description_source:
--   'wikipedia' — intro of the Hebrew Wikipedia article (CC BY-SA 4.0). The app MUST show
--                 attribution with a link to description_source_url wherever it shows the text.
--   'facts'     — built only from DB fields (category, region, attributes), replacing
--                 generated descriptions that contained wrong facts.
--   NULL        — written by a person (OSM description tag, community contributor, admin).
-- Editing a description through updateLocation() clears both columns.
--
-- location_description_pending holds Wikipedia texts until the attribution UI is live;
-- scripts/apply-descriptions.ts --publish-pending moves them into locations.
--
-- Apply manually (same as 0001–0010). Idempotent; safe to re-run.
-- Rollback:  DROP TABLE IF EXISTS router.location_description_pending;
--            ALTER TABLE router.locations DROP COLUMN IF EXISTS description_source,
--                                         DROP COLUMN IF EXISTS description_source_url;

ALTER TABLE router.locations
  ADD COLUMN IF NOT EXISTS description_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS description_source_url TEXT;

DO $$ BEGIN
  ALTER TABLE router.locations ADD CONSTRAINT locations_description_source_check
    CHECK (description_source IS NULL OR description_source IN ('wikipedia', 'facts'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS router.location_description_pending (
  location_id  INTEGER     PRIMARY KEY REFERENCES router.locations(id) ON DELETE CASCADE,
  description  TEXT        NOT NULL,
  source       VARCHAR(20) NOT NULL CHECK (source IN ('wikipedia', 'facts')),
  source_url   TEXT,
  -- the description this replaces; publishing skips rows whose description changed since
  replaces     TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same access model as the other router tables: backend connection only.
ALTER TABLE router.location_description_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON router.location_description_pending FROM anon, authenticated;
