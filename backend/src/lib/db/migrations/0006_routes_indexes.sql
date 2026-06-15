-- ── Routes table indexes ───────────────────────────────────────────────────
--
-- Rationale for each index:
--
-- routes(created_at)
--   Every getRoutes() call sorts ORDER BY r.created_at DESC. Without an index
--   Postgres does a full sequential scan + sort. The index lets it walk the
--   B-tree in reverse order and skip the sort entirely.
--
-- routes(region_id)
--   The LEFT JOIN regions ON r.region_id = reg.id appears in every route
--   listing query. Postgres uses a nested-loop join; an index on the FK column
--   avoids a sequential scan of routes for each region row it evaluates.
--
-- route_stops(route_id, order_index)  — composite
--   Every stop fetch is: WHERE rs.route_id = ANY($1) ORDER BY rs.route_id, rs.order_index
--   The existing single-column idx_route_stops_route satisfies the WHERE but
--   Postgres still needs a sort pass for order_index. The composite index
--   covers both predicates in one ordered B-tree scan — no sort step.
--   Postgres will prefer the composite for ordered queries and fall back to
--   the single-column index for unordered point lookups.
--
-- route_stops(location_id)
--   The LEFT JOIN locations l ON rs.location_id = l.id appears in
--   getRouteById and the batch stop fetch. Without this index Postgres
--   sequential-scans route_stops for every locations row it probes.

CREATE INDEX IF NOT EXISTS routes_created_at_idx
  ON routes (created_at DESC);

CREATE INDEX IF NOT EXISTS routes_region_id_idx
  ON routes (region_id);

CREATE INDEX IF NOT EXISTS route_stops_route_id_order_idx
  ON route_stops (route_id, order_index);

-- route_stops(location_id) skipped — column not present in production DB
