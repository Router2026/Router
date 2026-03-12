-- Migration: 004_social.sql
-- Reviews, Community Reports, Video Posts

-- ── Reviews ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              SERIAL PRIMARY KEY,
  location_id     INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  poi_name        VARCHAR(255),
  reviewer_name   VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content         TEXT NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_location ON reviews(location_id);

-- ── Community Reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_reports (
  id              SERIAL PRIMARY KEY,
  location_id     INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  poi_name        VARCHAR(255),
  report_type     VARCHAR(100) NOT NULL,
  severity        VARCHAR(50) NOT NULL DEFAULT 'בינונית',
  content         TEXT NOT NULL,
  reporter_name   VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  upvotes         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_location ON community_reports(location_id);

-- ── Video Posts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_posts (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  region          VARCHAR(100),
  uploader_name   VARCHAR(255) NOT NULL DEFAULT 'אנונימי',
  video_url       TEXT,
  thumbnail_url   TEXT,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Seed demo reviews ───────────────────────────────────────────────────────
INSERT INTO reviews (poi_name, reviewer_name, rating, content) VALUES
  ('מפל הבניאס',  'ישראל ישראלי', 5, 'מקום מדהים! המים קרים ומרעננים, הנוף פנטסטי.'),
  ('מפל הבניאס',  'שרה כהן',      4, 'מקום נהדר, קצת עמוס בסופ"ש אבל שווה.'),
  ('מצוק ארבל',   'דני לוי',      5, 'נוף עוצר נשימה! חובה לכל מי שאוהב הליכות.'),
  ('כנרת',        'מיכל גרין',    4, 'מושלם לשחייה בקיץ, מקום משפחתי נהדר.')
ON CONFLICT DO NOTHING;

-- ── Seed demo reports ───────────────────────────────────────────────────────
INSERT INTO community_reports (poi_name, report_type, severity, content, reporter_name, upvotes) VALUES
  ('מפל הבניאס',  'צפיפות',    'גבוהה',   'עמוס מאוד היום - ממליץ להגיע מוקדם בבוקר',  'עומרי',  10),
  ('מצוק ארבל',   'מצב שביל',  'בינונית', 'חלק מהשביל רטוב, כדאי להביא נעלי הליכה',  'מיכל',    5),
  ('נחל קנה',     'מצב מים',   'נמוכה',   'המים בגובה נמוך יחסית, אפשר לשחות',        'דוד',     3)
ON CONFLICT DO NOTHING;

-- ── Seed demo videos ────────────────────────────────────────────────────────
INSERT INTO video_posts (title, uploader_name, likes_count, thumbnail_url, region, views_count) VALUES
  ('שחייה במפל הבניאס',    'עומרי', 42, 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'גולן',        1200),
  ('שקיעה בגליל עליון',   'שרה',   38, 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600', 'גליל עליון',  890),
  ('טיול במכתש רמון',     'דוד',   27, 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', 'דרום',        560)
ON CONFLICT DO NOTHING;
