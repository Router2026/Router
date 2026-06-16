// src/lib/public-trips/public-trips-service.ts
//
// OPTIMIZATIONS:
//  1. getPublicTrips fetches routes AND their stops in a SINGLE SQL query
//     using a LEFT JOIN + aggregation (json_agg), eliminating the sequential
//     N+1 "attachStops" round-trip.
//  2. The aggregated stops are ordered and filtered inside SQL — no extra round-trip.
//  3. getPublicTripById similarly uses a single JOIN for the detail view.
//  4. getPublicTripsPaginated (new) supports infinite-scroll pagination:
//     fetches one extra row beyond the requested page size to derive
//     `has_more` without a separate COUNT(*) query.

import { rawDb } from "@/lib/db/raw-client";
import { awardXp, XP_REWARDS } from "@/lib/xp/xp-service";

export interface RouteImageRow {
  id: number;
  route_id: number;
  image_url: string;
  caption?: string;
  created_at: Date;
}

export interface PublicTrip {
  id:               number;
  user_id:          number;
  title:            string;
  description:      string | null;
  route_geojson:    object | null;
  is_public:        boolean;
  created_at:       Date;
  creator_username: string;
  creator_avatar:   string | null;
  creator_xp:       number;
  location_count:   number;
  locations:        PublicTripLocation[];
  region?:          string;
  difficulty?:      string;
  group_type?:      string;
  style?:           string;
  total_duration_hours?: number;
  total_distance_km?:    number;
  user_description?:  string;
  image_url?:         string;
  video_url?:         string;
  points_of_interest?: string;
  recommended_stops?:  string;
  route_images?:       RouteImageRow[];
  likes_count?:    number;
  comments_count?: number;
  average_rating?: number;
  ratings_count?:  number;
}

export interface PublicTripLocation {
  id:           number;
  location_id:  number;
  name:         string;
  category:     string;
  latitude:     number;
  longitude:    number;
  main_image:   string | null;
  order_index:  number;
  region_name?: string;
  difficulty?:  string;
  arrival_time?:      string;
  duration_minutes?:  number;
  smart_insight?:     string;
}

export interface PublicTripsQuery {
  user_id?:    number;
  region?:     string;
  difficulty?: string;
  style?:      string;
  group_type?: string;
  limit?:      number;
  offset?:     number;
}

/** Paginated result for infinite-scroll feeds. */
export interface PaginatedTrips {
  items:    PublicTrip[];
  has_more: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseStops(raw: unknown): PublicTripLocation[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .filter(r => Number(r.latitude) !== 0 || Number(r.longitude) !== 0)
    .map(r => ({
      id:               (r.rs_id          as number) ?? 0,
      location_id:      (r.location_id    as number) ?? 0,
      name:             (r.name           as string) || "מיקום",
      category:         (r.category       as string) || "טבע",
      latitude:         Number(r.latitude),
      longitude:        Number(r.longitude),
      main_image:       (r.main_image     as string) || null,
      order_index:      (r.order_index    as number) ?? 0,
      region_name:      (r.region_name    as string) || undefined,
      difficulty:       (r.difficulty     as string) || undefined,
      arrival_time:     (r.arrival_time   as string) || undefined,
      duration_minutes: (r.duration_minutes as number) || undefined,
      smart_insight:    (r.smart_insight  as string) || undefined,
    }));
}

function rowToTrip(r: Record<string, unknown>): PublicTrip {
  const stops = parseStops(r.stops);
  return {
    id:               r.id          as number,
    user_id:          r.user_id     as number,
    title:            (r.name       as string) || "מסלול",
    description:      (r.description as string) || null,
    route_geojson:    null,
    is_public:        true,
    created_at:       r.created_at  as Date,
    creator_username: (r.creator_username as string) || "משתמש",
    creator_avatar:   (r.creator_avatar  as string) || null,
    creator_xp:       Number.parseInt(r.creator_xp as string, 10) || 0,
    location_count:   stops.length,
    locations:        stops,
    region:           (r.region     as string) || undefined,
    difficulty:       (r.difficulty as string) || undefined,
    group_type:       (r.group_type as string) || undefined,
    style:            (r.style      as string) || undefined,
    total_duration_hours: Number.parseFloat(r.total_duration_hours as string) || undefined,
    total_distance_km:    Number.parseFloat(r.total_distance_km    as string) || undefined,
    user_description:     (r.user_description  as string) || undefined,
    image_url:            (r.image_url          as string) || undefined,
    video_url:            (r.video_url          as string) || undefined,
    points_of_interest:   (r.points_of_interest as string) || undefined,
    recommended_stops:    (r.recommended_stops  as string) || undefined,
    likes_count:          Number.parseInt(r.likes_count    as string, 10) || 0,
    comments_count:       Number.parseInt(r.comments_count as string, 10) || 0,
    average_rating:       Number.parseFloat(r.average_rating as string) || 0,
    ratings_count:        Number.parseInt(r.ratings_count  as string, 10) || 0,
  };
}

// ── Single-query fetch with aggregated stops ───────────────────────────────
// OPTIMIZATION: one round-trip instead of two (routes query + stops query).
// json_agg collects all stops per route inside Postgres so the app server
// receives a single result set.

const STOPS_SUBQUERY = `
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'rs_id',            rs.id,
          'location_id',      COALESCE(l.id, 0),
          'name',             COALESCE(l.name, rs.poi_name, ''),
          'category',         COALESCE(l.category, 'טבע'),
          'latitude',         COALESCE(l.latitude::float, 0),
          'longitude',        COALESCE(l.longitude::float, 0),
          'main_image',       l.main_image,
          'order_index',      rs.order_index,
          'region_name',      reg2.name,
          'difficulty',       l.difficulty,
          'arrival_time',     rs.arrival_time,
          'duration_minutes', rs.duration_minutes,
          'smart_insight',    rs.smart_insight
        )
        ORDER BY rs.order_index
      ),
      '[]'::json
    )
    FROM  route_stops rs
    LEFT  JOIN locations l   ON l.id  = rs.location_id
    LEFT  JOIN regions   reg2 ON reg2.id = l.region_id
    WHERE rs.route_id = r.id
  ) AS stops
`;

const BASE_SELECT = `
  r.id, r.user_id, r.name, r.description,
  r.total_duration_hours, r.total_distance_km,
  r.difficulty, r.group_type, r.style,
  r.created_at,
  r.user_description, r.image_url, r.video_url,
  r.points_of_interest, r.recommended_stops,
  COALESCE(r.likes_count, 0)    AS likes_count,
  COALESCE(r.comments_count, 0) AS comments_count,
  COALESCE(r.average_rating, 0) AS average_rating,
  COALESCE(r.ratings_count, 0)  AS ratings_count,
  reg.name AS region,
  u.username   AS creator_username,
  u.avatar_url AS creator_avatar,
  COALESCE(u.xp_points, 0) AS creator_xp,
  ${STOPS_SUBQUERY}
`;

// ── public API ─────────────────────────────────────────────────────────────

export async function getPublicTrips(query: PublicTripsQuery = {}): Promise<PublicTrip[]> {
  const conditions: string[] = ["r.is_public = TRUE", "r.user_id IS NOT NULL"];
  const params: unknown[]    = [];

  if (query.user_id) {
    params.push(query.user_id);
    conditions.push(`r.user_id = $${params.length}`);
  }
  if (query.region) {
    params.push(`%${query.region}%`);
    conditions.push(`reg.name ILIKE $${params.length}`);
  }
  if (query.difficulty) {
    params.push(query.difficulty);
    conditions.push(`r.difficulty = $${params.length}`);
  }
  if (query.style) {
    params.push(query.style);
    conditions.push(`r.style = $${params.length}`);
  }
  if (query.group_type) {
    params.push(query.group_type);
    conditions.push(`r.group_type = $${params.length}`);
  }

  const where    = `WHERE ${conditions.join(" AND ")}`;
  const limit    = Math.min(query.limit  || 50, 100);
  const offset   = query.offset || 0;
  params.push(limit);  const limitIdx  = params.length;
  params.push(offset); const offsetIdx = params.length;

  const { rows } = await rawDb.query(
    `SELECT ${BASE_SELECT}
     FROM   routes r
     JOIN   users u ON u.id = r.user_id
     LEFT   JOIN regions reg ON reg.id = r.region_id
     ${where}
     ORDER  BY r.average_rating DESC, r.likes_count DESC, r.created_at DESC
     LIMIT  $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return rows.map(rowToTrip);
}

/**
 * Infinite-scroll variant of getPublicTrips.
 *
 * OPTIMIZATION: instead of running a separate COUNT(*) query to know whether
 * more pages exist (which would double the query cost on every page fetch),
 * we over-fetch by one row (LIMIT pageSize + 1). If we get pageSize + 1 rows
 * back, we know there's at least one more page; we trim the extra row before
 * returning. This costs nothing extra in the common case (rows are cheap to
 * over-fetch by 1) and avoids a second round-trip to Postgres.
 */
export async function getPublicTripsPaginated(query: PublicTripsQuery = {}): Promise<PaginatedTrips> {
  const pageSize = Math.min(query.limit || 10, 50);
  const rowsResult = await getPublicTrips({ ...query, limit: pageSize + 1 });

  const hasMore = rowsResult.length > pageSize;
  const items = hasMore ? rowsResult.slice(0, pageSize) : rowsResult;

  return { items, has_more: hasMore };
}

export async function getPublicTripById(tripId: number): Promise<PublicTrip | null> {
  const { rows } = await rawDb.query(
    `SELECT ${BASE_SELECT}
     FROM   routes r
     JOIN   users u ON u.id = r.user_id
     LEFT   JOIN regions reg ON reg.id = r.region_id
     WHERE  r.id = $1`,
    [tripId]
  );
  if (!rows.length) return null;

  const trip = rowToTrip(rows[0]);

  // Attach route images (detail view only — not needed for the feed list)
  const { rows: imgRows } = await rawDb.query(
    `SELECT id, route_id, image_url, caption, created_at
     FROM route_images WHERE route_id = $1 ORDER BY created_at ASC`,
    [tripId]
  );
  trip.route_images = imgRows.map(r => ({
    id: r.id as number,
    route_id: r.route_id as number,
    image_url: r.image_url as string,
    caption: (r.caption as string) || undefined,
    created_at: r.created_at as Date,
  }));

  return trip;
}

export async function createTrip(
  userId: number,
  data: {
    title:          string;
    description?:   string;
    route_geojson?: object;
    is_public?:     boolean;
    location_ids?:  number[];
  }
): Promise<{ trip: PublicTrip; xp?: { new_xp: number; new_level: number; level_label: string; leveled_up: boolean } }> {
  const isPublic = data.is_public ?? false;
  const { rows } = await rawDb.query(
    `INSERT INTO routes (user_id, name, description, difficulty, group_type, style, total_duration_hours, is_public)
     VALUES ($1, $2, $3, 'בינוני', 'משפחה', 'טבע', 0, $4)
     RETURNING id`,
    [userId, data.title, data.description || null, isPublic]
  );
  const routeId = rows[0].id as number;

  if (data.location_ids?.length) {
    for (let i = 0; i < data.location_ids.length; i++) {
      await rawDb.query(
        `INSERT INTO route_stops (route_id, location_id, order_index, arrival_time, duration_minutes)
         VALUES ($1, $2, $3, '09:00', 60)`,
        [routeId, data.location_ids[i], i]
      );
    }
  }

  const result = await getPublicTripById(routeId);
  if (!result) throw new Error("Failed to fetch created trip");

  let xpResult: { new_xp: number; new_level: number; level_label: string; leveled_up: boolean } | undefined;
  if (isPublic) {
    try { xpResult = await awardXp(userId, XP_REWARDS.TRIP_CREATED); } catch { /* swallow */ }
  }

  return { trip: result, xp: xpResult };
}

export async function publishRoute(routeId: number, userId: number): Promise<{ trip: PublicTrip; xp?: { new_xp: number; new_level: number; level_label: string; leveled_up: boolean } }> {
  const { rows } = await rawDb.query(
    `UPDATE routes SET is_public = TRUE WHERE id = $1 AND user_id = $2 AND is_public = FALSE RETURNING id`,
    [routeId, userId]
  );
  if (!rows.length) throw Object.assign(new Error("Route not found or already public"), { code: "NOT_FOUND" });

  const trip = await getPublicTripById(routeId);
  if (!trip) throw new Error("Failed to fetch route");

  let xpResult: { new_xp: number; new_level: number; level_label: string; leveled_up: boolean } | undefined;
  try { xpResult = await awardXp(userId, XP_REWARDS.TRIP_CREATED); } catch { /* swallow */ }

  return { trip, xp: xpResult };
}

export async function updateRouteStops(
  routeId: number,
  userId: number,
  locationIds: number[]
): Promise<void> {
  const { rows: ownerRows } = await rawDb.query(
    `SELECT id FROM routes WHERE id = $1 AND user_id = $2`,
    [routeId, userId]
  );
  if (!ownerRows.length) throw Object.assign(new Error("Not authorized"), { code: "NOT_FOUND" });

  await rawDb.query(`DELETE FROM route_stops WHERE route_id = $1`, [routeId]);

  for (let i = 0; i < locationIds.length; i++) {
    await rawDb.query(
      `INSERT INTO route_stops (route_id, location_id, order_index, arrival_time, duration_minutes)
       VALUES ($1, $2, $3, $4, 60)`,
      [routeId, locationIds[i], i, `${String(9 + i).padStart(2, "0")}:00`]
    );
  }
}
