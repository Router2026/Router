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
