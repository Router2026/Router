-- Migration: 001_initial_schema.sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ── Regions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regions (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,          -- Hebrew name: גולן
  name_en       VARCHAR(100) NOT NULL,          -- English name: Golan
  slug          VARCHAR(100) NOT NULL UNIQUE,   -- URL slug: golan
  center_lat    NUMERIC(10, 6) NOT NULL,
  center_lng    NUMERIC(10, 6) NOT NULL,
  zoom          INTEGER NOT NULL DEFAULT 11,
  radius_meters INTEGER NOT NULL DEFAULT 25000,
  color         VARCHAR(7) NOT NULL DEFAULT '#16a34a',
  geom          GEOMETRY(Polygon, 4326),        -- region boundary polygon
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_slug ON regions(slug);
CREATE INDEX IF NOT EXISTS idx_regions_geom ON regions USING GIST(geom);

-- ── Locations (POIs) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100) NOT NULL DEFAULT 'טבע',
  region_id        INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  latitude         NUMERIC(10, 7) NOT NULL,
  longitude        NUMERIC(10, 7) NOT NULL,
  geom             GEOGRAPHY(Point, 4326),      -- spatial point for queries
  images           JSONB NOT NULL DEFAULT '[]', -- array of image URLs
  main_image       TEXT,
  source           VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_id        VARCHAR(255),               -- original ID from source
  difficulty       VARCHAR(50) DEFAULT 'בינוני',
  duration_minutes INTEGER,
  has_water        BOOLEAN DEFAULT FALSE,
  has_shade        BOOLEAN DEFAULT FALSE,
  accessible       BOOLEAN DEFAULT FALSE,
  average_rating   NUMERIC(3, 2) DEFAULT 4.0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_source ON locations(source);
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST(geom);

-- ── Routes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  region_id           INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  total_distance_km   NUMERIC(6, 2),
  total_duration_hours NUMERIC(4, 1),
  difficulty          VARCHAR(50) DEFAULT 'בינוני',
  group_type          VARCHAR(100) DEFAULT 'משפחה',
  style               VARCHAR(100) DEFAULT 'טבע',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Route Stops ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_stops (
  id              SERIAL PRIMARY KEY,
  route_id        INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  location_id     INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  arrival_time    VARCHAR(10),   -- e.g. '09:00'
  duration_minutes INTEGER DEFAULT 60,
  smart_insight   TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);

-- ── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE,
  full_name     VARCHAR(255),
  display_name  VARCHAR(255),
  xp_points     INTEGER DEFAULT 0,
  level         VARCHAR(100) DEFAULT 'מטייל מתחיל',
  reports_count INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  trips_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Sync Jobs (simple status tracking) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                    VARCHAR(100) PRIMARY KEY,
  source                VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_locations       INTEGER DEFAULT 0,
  processed_locations   INTEGER DEFAULT 0,
  error_message         TEXT,
  started_at            TIMESTAMP WITH TIME ZONE,
  completed_at          TIMESTAMP WITH TIME ZONE,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Auto-update updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
