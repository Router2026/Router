-- 0009: pgvector + location embeddings for hybrid (semantic + full-text) search.
--
-- Model: OpenAI text-embedding-3-small, requested with dimensions = 768.
-- One model per table: vectors from different models are not comparable.
-- If the model changes, re-embed everything (the `model` column makes stale rows easy to find).
--
-- Apply manually (same as 0001–0007). Idempotent; safe to re-run.
-- Rollback:  DROP TABLE IF EXISTS router.location_embeddings;
--            (leave the extension; DROP EXTENSION vector only if nothing else uses it)

-- Installed in `public` alongside PostGIS so the app's search_path (router, public)
-- resolves the `vector` type and the <=> operator without schema-qualification.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS router.location_embeddings (
  location_id   INTEGER      PRIMARY KEY REFERENCES router.locations(id) ON DELETE CASCADE,
  embedding     vector(768)  NOT NULL,
  -- sha256 of the exact text that was embedded; the sync job re-embeds only when this changes
  content_hash  CHAR(64)     NOT NULL,
  model         VARCHAR(100) NOT NULL,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Same access model as the other router tables: RLS on, no policies, no grants to API roles.
-- Only the backend's direct Postgres connection can read/write it; the Supabase Data API cannot.
ALTER TABLE router.location_embeddings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON router.location_embeddings FROM anon, authenticated;

-- No ANN index yet: at ~2k rows an exact scan is a few ms and has perfect recall under
-- region/radius filters (HNSW can drop filtered results). Add this past ~50k rows:
--   CREATE INDEX location_embeddings_hnsw
--     ON router.location_embeddings USING hnsw (embedding vector_cosine_ops);
--   and at query time: SET LOCAL hnsw.iterative_scan = relaxed_order;  (pgvector >= 0.8)
