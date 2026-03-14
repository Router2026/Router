-- Migration: 007_favorites.sql
-- User favorites (saved locations)

CREATE TABLE IF NOT EXISTS user_favorites (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user     ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_location ON user_favorites(location_id);