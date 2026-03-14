-- Migration: 0001_router_tables.sql
-- Adds all Router app tables to the Neon PostgreSQL database.
-- Run once: npx drizzle-kit migrate OR apply manually via psql.

-- ── PostGIS Extension ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ── Regions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regions (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  center_lat    NUMERIC(10, 6) NOT NULL,
  center_lng    NUMERIC(10, 6) NOT NULL,
  zoom          INTEGER NOT NULL DEFAULT 11,
  radius_meters INTEGER NOT NULL DEFAULT 25000,
  color         VARCHAR(7) NOT NULL DEFAULT '#16a34a',
  geom          GEOMETRY(Polygon, 4326),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_slug ON regions(slug);
CREATE INDEX IF NOT EXISTS idx_regions_geom ON regions USING GIST(geom);

-- ── Locations (Router POIs) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100) NOT NULL DEFAULT 'טבע',
  region_id        INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  latitude         NUMERIC(10, 7) NOT NULL,
  longitude        NUMERIC(10, 7) NOT NULL,
  geom             GEOGRAPHY(Point, 4326),
  images           JSONB NOT NULL DEFAULT '[]',
  main_image       TEXT,
  source           VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_id        VARCHAR(255),
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

CREATE INDEX IF NOT EXISTS idx_locations_region   ON locations(region_id);
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_source   ON locations(source);
CREATE INDEX IF NOT EXISTS idx_locations_geom     ON locations USING GIST(geom);

-- ── Routes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL,
  description          TEXT,
  region_id            INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  total_distance_km    NUMERIC(6, 2),
  total_duration_hours NUMERIC(4, 1),
  difficulty           VARCHAR(50) DEFAULT 'בינוני',
  group_type           VARCHAR(100) DEFAULT 'משפחה',
  style                VARCHAR(100) DEFAULT 'טבע',
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Route Stops ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_stops (
  id               SERIAL PRIMARY KEY,
  route_id         INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  poi_name         VARCHAR(255),
  order_index      INTEGER NOT NULL DEFAULT 0,
  arrival_time     VARCHAR(10),
  duration_minutes INTEGER DEFAULT 60,
  smart_insight    TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);

-- ── Users ─────────────────────────────────────────────────────────────────────
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

-- ── Sync Jobs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                  VARCHAR(100) PRIMARY KEY,
  source              VARCHAR(50) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_locations     INTEGER DEFAULT 0,
  processed_locations INTEGER DEFAULT 0,
  error_message       TEXT,
  started_at          TIMESTAMP WITH TIME ZONE,
  completed_at        TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  poi_name      VARCHAR(255),
  reviewer_name VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content       TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_location ON reviews(location_id);

-- ── Community Reports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_reports (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  poi_name      VARCHAR(255),
  report_type   VARCHAR(100) NOT NULL,
  severity      VARCHAR(50) NOT NULL DEFAULT 'בינונית',
  content       TEXT NOT NULL,
  reporter_name VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  upvotes       INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_location ON community_reports(location_id);

-- ── Video Posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_posts (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  region        VARCHAR(100),
  uploader_name VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  video_url     TEXT,
  thumbnail_url TEXT,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  views_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Auto-update updated_at trigger ────────────────────────────────────────────
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

-- ── Seed demo data ────────────────────────────────────────────────────────────
INSERT INTO reviews (poi_name, reviewer_name, rating, content) VALUES
  ('מפל הבניאס',  'ישראל ישראלי', 5, 'מקום מדהים! המים קרים ומרעננים, הנוף פנטסטי.'),
  ('מפל הבניאס',  'שרה כהן',      4, 'מקום נהדר, קצת עמוס בסופ"ש אבל שווה.'),
  ('מצוק ארבל',   'דני לוי',      5, 'נוף עוצר נשימה! חובה לכל מי שאוהב הליכות.'),
  ('כנרת',        'מיכל גרין',    4, 'מושלם לשחייה בקיץ, מקום משפחתי נהדר.')
ON CONFLICT DO NOTHING;

INSERT INTO community_reports (poi_name, report_type, severity, content, reporter_name, upvotes) VALUES
  ('מפל הבניאס',  'צפיפות',    'גבוהה',   'עמוס מאוד היום - ממליץ להגיע מוקדם בבוקר',  'עומרי',  10),
  ('מצוק ארבל',   'מצב שביל',  'בינונית', 'חלק מהשביל רטוב, כדאי להביא נעלי הליכה',  'מיכל',    5),
  ('נחל קנה',     'מצב מים',   'נמוכה',   'המים בגובה נמוך יחסית, אפשר לשחות',        'דוד',     3)
ON CONFLICT DO NOTHING;

INSERT INTO video_posts (title, uploader_name, likes_count, thumbnail_url, region, views_count) VALUES
  ('שחייה במפל הבניאס',    'עומרי', 42, 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'גולן',        1200),
  ('שקיעה בגליל עליון',   'שרה',   38, 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600', 'גליל עליון',  890),
  ('טיול במכתש רמון',     'דוד',   27, 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', 'דרום',        560)
ON CONFLICT DO NOTHING;
