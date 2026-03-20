-- ============================================================
-- Migration: XP System, Public Trips, Favorites, Profile
-- Run once against your database.
-- Safe to re-run: uses IF NOT EXISTS / DO NOTHING guards.
-- ============================================================

-- ── 1. Extend users table ────────────────────────────────────────────────────
-- Add each column only if it does not exist (idempotent).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='xp') THEN
    ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bio') THEN
    ALTER TABLE users ADD COLUMN bio TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cover_image') THEN
    ALTER TABLE users ADD COLUMN cover_image TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_regions') THEN
    ALTER TABLE users ADD COLUMN favorite_regions TEXT[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='instagram') THEN
    ALTER TABLE users ADD COLUMN instagram TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='website') THEN
    ALTER TABLE users ADD COLUMN website TEXT;
  END IF;
END $$;

-- Back-fill xp from xp_points so both columns stay in sync.
-- This runs AFTER the xp column is guaranteed to exist.
UPDATE users SET xp = COALESCE(xp_points, 0) WHERE xp = 0 AND xp_points > 0;

-- ── 2. compute_level helper function ─────────────────────────────────────────
-- level = floor(sqrt(xp / 50))  — mirrors the TypeScript formula exactly.
CREATE OR REPLACE FUNCTION compute_level(xp_val INTEGER) RETURNS INTEGER AS $$
  SELECT FLOOR(SQRT(xp_val::FLOAT / 50))::INTEGER;
$$ LANGUAGE SQL IMMUTABLE;

-- ── 3. location_images ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_images (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  image_url    TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_images_location ON location_images(location_id);
CREATE INDEX IF NOT EXISTS idx_location_images_user     ON location_images(user_id);
-- Prevent duplicate identical URLs per user per location
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_images_user_loc_url
  ON location_images(user_id, location_id, image_url);

-- ── 4. trips ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  description   TEXT,
  route_geojson JSONB,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user      ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_is_public ON trips(is_public) WHERE is_public = TRUE;

-- ── 5. trip_locations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_locations (
  id           SERIAL PRIMARY KEY,
  trip_id      INTEGER NOT NULL REFERENCES trips(id)     ON DELETE CASCADE,
  location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (trip_id, location_id)          -- each location appears once per trip
);

CREATE INDEX IF NOT EXISTS idx_trip_locations_trip     ON trip_locations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_locations_location ON trip_locations(location_id);

-- ── 6. favorites ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_favorites_user_location UNIQUE (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user     ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_location ON favorites(location_id);
