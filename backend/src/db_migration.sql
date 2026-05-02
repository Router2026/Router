-- ============================================================
-- Migration: All schema changes for 11-feature update
-- ============================================================

-- 1. Add is_approved to location_images (Feature 3: gallery)
ALTER TABLE location_images
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add approved_by column (optional, for audit trail)
ALTER TABLE location_images
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);

ALTER TABLE location_images
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 3. Add share_count to routes (Feature 9: share trip with XP)
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

-- 4. Add trip_shares table to prevent duplicate XP for same share
CREATE TABLE IF NOT EXISTS trip_shares (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id    INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  shared_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

-- 5. Re-compute trips_count from routes table for all users
-- (ensures Profile page stats are accurate)
UPDATE users u
SET trips_count = (
  SELECT COUNT(*) FROM routes r WHERE r.user_id = u.id
);

-- 6. Re-compute reports_count from community_reports
UPDATE users u
SET reports_count = (
  SELECT COUNT(*) FROM community_reports cr
  JOIN users u2 ON u2.username = cr.reporter_name AND u2.id = u.id
);

-- 7. Re-compute reviews_count from reviews
UPDATE users u
SET reviews_count = (
  SELECT COUNT(*) FROM reviews rv
  JOIN users u2 ON u2.username = rv.reviewer_name AND u2.id = u.id
);

-- 8. Index for faster location image queries
CREATE INDEX IF NOT EXISTS idx_location_images_location_approved
  ON location_images(location_id, is_approved);

-- ============================================================
-- End of migration
-- ============================================================

-- Add user_id to community_reports so we can query by logged-in user
ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Add user_id to reviews  
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_community_reports_user_id ON community_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- ============================================================
-- Migration: Route enrichment fields + route images gallery
-- ============================================================

-- Add points_of_interest and recommended_stops to routes
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS points_of_interest TEXT;

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS recommended_stops TEXT;

-- Create route_images table for multi-image gallery
CREATE TABLE IF NOT EXISTS route_images (
  id          SERIAL PRIMARY KEY,
  route_id    INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_images_route_id ON route_images(route_id);

-- ============================================================
-- End of route enrichment migration
-- ============================================================

-- ============================================================
-- Migration: GIST spatial index for proximity sorting on Explore
-- ============================================================

-- Ensure PostGIS is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- GIST index on the geography column — used by ST_Distance ORDER BY in getLocations
-- This allows the proximity sort query to use an index scan instead of a seq scan
CREATE INDEX IF NOT EXISTS idx_locations_geom_gist
  ON locations USING GIST (geom);

-- ============================================================
-- End of proximity sort migration
-- ============================================================

-- ============================================================
-- Migration: Community route media, is_public flag, filters
-- ============================================================

-- Ensure routes has is_public column
ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Community media submitted by any user on a public route
CREATE TABLE IF NOT EXISTS route_community_media (
  id          SERIAL PRIMARY KEY,
  route_id    INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type  TEXT NOT NULL CHECK (media_type IN ('image','video')),
  url         TEXT NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_community_media_route ON route_community_media(route_id);

-- ============================================================

-- ============================================================
-- Migration: Performance indexes for public trips feed
-- ============================================================

-- Primary feed filter: only public routes, sorted by rating + likes
CREATE INDEX IF NOT EXISTS idx_routes_public_feed
  ON routes (is_public, average_rating DESC, likes_count DESC, created_at DESC)
  WHERE is_public = TRUE;

-- Filter by user (profile page)
CREATE INDEX IF NOT EXISTS idx_routes_user_public
  ON routes (user_id, is_public, created_at DESC)
  WHERE is_public = TRUE;

-- Filter chips: difficulty, style, group_type
CREATE INDEX IF NOT EXISTS idx_routes_difficulty ON routes (difficulty) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_routes_style       ON routes (style)      WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_routes_group_type  ON routes (group_type) WHERE is_public = TRUE;

-- Region join is already fast if regions table is small, but index routes.region_id
CREATE INDEX IF NOT EXISTS idx_routes_region_id ON routes (region_id) WHERE is_public = TRUE;

-- route_stops lookup by route_id (critical for attachStops)
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops (route_id, order_index);

-- ============================================================
-- End of performance indexes migration
-- ============================================================
