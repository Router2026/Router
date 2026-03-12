-- ─────────────────────────────────────────────────────────────────────────────
-- Israel Nature Platform — PostgreSQL Schema Setup
-- Run this ONCE before your first ETL import.
-- Requires: PostgreSQL 12+ with PostGIS extension
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Regions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Seed regions
INSERT INTO regions (name) VALUES
  ('גולן'),
  ('גליל עליון'),
  ('גליל תחתון'),
  ('כרמל'),
  ('עמק יזרעאל'),
  ('שרון'),
  ('מרכז'),
  ('ירושלים'),
  ('נגב'),
  ('ערבה'),
  ('אילת')
ON CONFLICT (name) DO NOTHING;

-- ─── Locations ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
  id               SERIAL PRIMARY KEY,
  name             TEXT        NOT NULL,
  description      TEXT,
  category         TEXT,
  region_id        INTEGER     REFERENCES regions(id),
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  geom             GEOGRAPHY(Point, 4326),
  images           JSONB       DEFAULT '[]'::jsonb,
  main_image       TEXT,
  source           TEXT        NOT NULL,
  source_id        TEXT        NOT NULL,
  difficulty       TEXT,
  duration_minutes INTEGER,
  has_water        BOOLEAN,
  has_shade        BOOLEAN,
  accessible       BOOLEAN,
  average_rating   NUMERIC(3, 2),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT locations_source_source_id_unique UNIQUE (source, source_id)
);

-- ─── Indices ─────────────────────────────────────────────────────────────────

-- Spatial index for proximity queries
CREATE INDEX IF NOT EXISTS idx_locations_geom
  ON locations USING GIST (geom);

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_locations_category
  ON locations (category);

-- Index for filtering by region
CREATE INDEX IF NOT EXISTS idx_locations_region_id
  ON locations (region_id);

-- Index for source lookups / deduplication
CREATE INDEX IF NOT EXISTS idx_locations_source
  ON locations (source, source_id);

-- ─── Trigger: auto-update updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON locations;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Useful views ─────────────────────────────────────────────────────────────

-- View: locations with region name joined
CREATE OR REPLACE VIEW locations_full AS
  SELECT
    l.*,
    r.name AS region_name
  FROM locations l
  LEFT JOIN regions r ON l.region_id = r.id;

-- ─── Verification queries (run after ETL) ─────────────────────────────────────

-- Total locations per source:
-- SELECT source, COUNT(*) FROM locations GROUP BY source ORDER BY count DESC;

-- Total locations per category:
-- SELECT category, COUNT(*) FROM locations GROUP BY category ORDER BY count DESC;

-- Total locations per region:
-- SELECT r.name, COUNT(*) FROM locations l JOIN regions r ON l.region_id = r.id GROUP BY r.name ORDER BY count DESC;

-- Nearest springs to Tel Aviv (32.08, 34.78):
-- SELECT name, ST_Distance(geom, ST_MakePoint(34.78, 32.08)::geography) AS dist_meters
-- FROM locations
-- WHERE category = 'מעיין'
-- ORDER BY dist_meters ASC
-- LIMIT 10;
