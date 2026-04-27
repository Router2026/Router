// src/lib/public-trips/public-trips-service.ts — REWRITTEN
//
// The `trips` and `trip_locations` tables are empty.
// All custom-built trips live in `routes` + `route_stops`.
// This service now reads from those tables while keeping the same
// PublicTrip / PublicTripLocation shape so frontend stays unchanged.

import { rawDb } from "@/lib/db/raw-client";

export interface PublicTrip {
  id:               number;
  user_id:          number;
  title:            string;           // mapped from routes.name
  description:      string | null;
  route_geojson:    object | null;
  is_public:        boolean;
  created_at:       Date;
  creator_username: string;
  creator_avatar:   string | null;
  creator_xp:       number;
  location_count:   number;
  locations:        PublicTripLocation[];
  // extra route fields exposed for richer cards
  region?:          string;
  difficulty?:      string;
  group_type?:      string;
  style?:           string;
  total_duration_hours?: number;
  total_distance_km?:    number;
  // user-provided content
  user_description?: string;
  image_url?:        string;
  video_url?:        string;
  // social stats
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
  region?:     string;
  difficulty?: string;
  limit?:      number;
  offset?:     number;
}

// ── helpers ────────────────────────────────────────────────────────────────

function rowToLocation(r: Record<string, unknown>): PublicTripLocation {
  return {
    id:               (r.rs_id       as number) ?? 0,
    location_id:      r.location_id  as number,
    name:             (r.name        as string) || (r.poi_name as string) || "מיקום",
    category:         (r.category    as string) || "טבע",
    latitude:         parseFloat(r.latitude  as string),
    longitude:        parseFloat(r.longitude as string),
    main_image:       (r.main_image  as string) || null,
    order_index:      (r.order_index as number) ?? 0,
    region_name:      (r.region_name as string) || undefined,
    difficulty:       (r.difficulty  as string) || undefined,
    arrival_time:     (r.arrival_time    as string) || undefined,
    duration_minutes: (r.duration_minutes as number) || undefined,
    smart_insight:    (r.smart_insight   as string) || undefined,
  };
}

/** Attach route_stop + location rows to each route. */
async function attachStops(routes: Record<string, unknown>[]): Promise<PublicTrip[]> {
  if (!routes.length) return [];

  const routeIds    = routes.map(r => r.id as number);
  const placeholders = routeIds.map((_, i) => `$${i + 1}`).join(", ");

  const { rows: stopRows } = await rawDb.query(
    `SELECT
       rs.id          AS rs_id,
       rs.route_id,
       rs.order_index,
       rs.arrival_time,
       rs.duration_minutes,
       rs.smart_insight,
       rs.poi_name,
       COALESCE(l.id,   0)     AS location_id,
       COALESCE(l.name, rs.poi_name, '') AS name,
       COALESCE(l.category, 'טבע')      AS category,
       COALESCE(l.latitude::float,  0)  AS latitude,
       COALESCE(l.longitude::float, 0)  AS longitude,
       l.main_image,
       l.difficulty,
       reg.name AS region_name
     FROM   route_stops rs
     LEFT   JOIN locations l   ON l.id  = rs.location_id
     LEFT   JOIN regions   reg ON reg.id = l.region_id
     WHERE  rs.route_id IN (${placeholders})
     ORDER  BY rs.route_id, rs.order_index`,
    routeIds
  );

  // Group stops by route_id
  const stopsByRoute = new Map<number, PublicTripLocation[]>();
  for (const row of stopRows) {
    const rid = row.route_id as number;
    if (!stopsByRoute.has(rid)) stopsByRoute.set(rid, []);
    // Only include stops that have real coordinates
    const loc = rowToLocation(row);
    if (loc.latitude !== 0 || loc.longitude !== 0) {
      stopsByRoute.get(rid)!.push(loc);
    }
  }

  return routes.map(r => {
    const stops = stopsByRoute.get(r.id as number) || [];
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
      creator_xp:       parseInt(r.creator_xp as string, 10) || 0,
      location_count:   stops.length,
      locations:        stops,
      region:           (r.region     as string) || undefined,
      difficulty:       (r.difficulty as string) || undefined,
      group_type:       (r.group_type as string) || undefined,
      style:            (r.style      as string) || undefined,
      total_duration_hours: parseFloat(r.total_duration_hours as string) || undefined,
      total_distance_km:    parseFloat(r.total_distance_km    as string) || undefined,
      user_description:     (r.user_description as string) || undefined,
      image_url:            (r.image_url   as string) || undefined,
      video_url:            (r.video_url   as string) || undefined,
      likes_count:          parseInt(r.likes_count    as string, 10) || 0,
      comments_count:       parseInt(r.comments_count as string, 10) || 0,
      average_rating:       parseFloat(r.average_rating as string) || 0,
      ratings_count:        parseInt(r.ratings_count  as string, 10) || 0,
    } as PublicTrip;
  });
}

// ── public API ─────────────────────────────────────────────────────────────

export async function getPublicTrips(query: PublicTripsQuery = {}): Promise<PublicTrip[]> {
  const conditions: string[] = ["r.user_id IS NOT NULL"];
  const params: unknown[]    = [];

  if (query.region) {
    params.push(`%${query.region}%`);
    conditions.push(
      `(reg.name ILIKE $${params.length} OR r.description ILIKE $${params.length})`
    );
  }
  if (query.difficulty) {
    params.push(query.difficulty);
    conditions.push(`r.difficulty = $${params.length}`);
  }

  const where    = `WHERE ${conditions.join(" AND ")}`;
  const limit    = Math.min(query.limit  || 50, 100);
  const offset   = query.offset || 0;
  params.push(limit);  const limitIdx  = params.length;
  params.push(offset); const offsetIdx = params.length;

  const { rows } = await rawDb.query(
    `SELECT
       r.id, r.user_id, r.name, r.description,
       r.total_duration_hours, r.total_distance_km,
       r.difficulty, r.group_type, r.style,
       r.created_at,
       r.user_description, r.image_url, r.video_url,
       COALESCE(r.likes_count, 0)    AS likes_count,
       COALESCE(r.comments_count, 0) AS comments_count,
       COALESCE(r.average_rating, 0) AS average_rating,
       COALESCE(r.ratings_count, 0)  AS ratings_count,
       reg.name AS region,
       u.username   AS creator_username,
       u.avatar_url AS creator_avatar,
       COALESCE(u.xp_points, 0) AS creator_xp
     FROM   routes r
     JOIN   users u ON u.id = r.user_id
     LEFT   JOIN regions reg ON reg.id = r.region_id
     ${where}
     ORDER  BY r.average_rating DESC, r.likes_count DESC, r.created_at DESC
     LIMIT  $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return attachStops(rows);
}

export async function getPublicTripById(tripId: number): Promise<PublicTrip | null> {
  const { rows } = await rawDb.query(
    `SELECT
       r.id, r.user_id, r.name, r.description,
       r.total_duration_hours, r.total_distance_km,
       r.difficulty, r.group_type, r.style,
       r.created_at,
       r.user_description, r.image_url, r.video_url,
       COALESCE(r.likes_count, 0)    AS likes_count,
       COALESCE(r.comments_count, 0) AS comments_count,
       COALESCE(r.average_rating, 0) AS average_rating,
       COALESCE(r.ratings_count, 0)  AS ratings_count,
       reg.name AS region,
       u.username   AS creator_username,
       u.avatar_url AS creator_avatar,
       COALESCE(u.xp_points, 0) AS creator_xp
     FROM   routes r
     JOIN   users u ON u.id = r.user_id
     LEFT   JOIN regions reg ON reg.id = r.region_id
     WHERE  r.id = $1`,
    [tripId]
  );
  if (!rows.length) return null;

  const results = await attachStops(rows);
  return results[0] ?? null;
}

// createTrip still inserts into `routes` for consistency with the rest of the app.
export async function createTrip(
  userId: number,
  data: {
    title:          string;
    description?:   string;
    route_geojson?: object;
    is_public?:     boolean;
    location_ids?:  number[];
  }
): Promise<PublicTrip> {
  const { rows } = await rawDb.query(
    `INSERT INTO routes (user_id, name, description, difficulty, group_type, style, total_duration_hours)
     VALUES ($1, $2, $3, 'בינוני', 'משפחה', 'טבע', 0)
     RETURNING id`,
    [userId, data.title, data.description || null]
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
  return result;
}
