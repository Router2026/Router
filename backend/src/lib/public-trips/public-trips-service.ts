// src/lib/public-trips/public-trips-service.ts

import { rawDb } from "@/lib/db/raw-client";

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
}

export interface PublicTripsQuery {
  region?:     string;
  difficulty?: string;
  limit?:      number;
  offset?:     number;
}

// ── helpers ───────────────────────────────────────────────────────────────

function rowToTripLocation(r: Record<string, unknown>): PublicTripLocation {
  return {
    id:           r.tl_id    as number ?? 0,
    location_id:  r.location_id as number,
    name:         r.name     as string,
    category:     r.category as string,
    latitude:     parseFloat(r.latitude  as string),
    longitude:    parseFloat(r.longitude as string),
    main_image:   (r.main_image as string) || null,
    order_index:  r.order_index as number,
    region_name:  (r.region_name as string) || undefined,
    difficulty:   (r.difficulty  as string) || undefined,
  };
}

async function attachLocations(trips: Record<string, unknown>[]): Promise<PublicTrip[]> {
  if (!trips.length) return [];

  const tripIds   = trips.map(t => t.id as number);
  const placeholders = tripIds.map((_, i) => `$${i + 1}`).join(", ");

  const { rows: locRows } = await rawDb.query(
    `SELECT tl.id AS tl_id, tl.trip_id, tl.order_index,
            l.id AS location_id, l.name, l.category,
            l.latitude, l.longitude, l.main_image, l.difficulty,
            r.name AS region_name
     FROM   trip_locations tl
     JOIN   locations l ON l.id = tl.location_id
     LEFT JOIN regions r ON r.id = l.region_id
     WHERE  tl.trip_id IN (${placeholders})
     ORDER  BY tl.trip_id, tl.order_index`,
    tripIds
  );

  // Group by trip_id
  const locsByTrip = new Map<number, PublicTripLocation[]>();
  for (const row of locRows) {
    const tid = row.trip_id as number;
    if (!locsByTrip.has(tid)) locsByTrip.set(tid, []);
    locsByTrip.get(tid)!.push(rowToTripLocation(row));
  }

  return trips.map(t => {
    const locs = locsByTrip.get(t.id as number) || [];
    return {
      ...(t as any),
      creator_xp:     parseInt(t.creator_xp as string, 10) || 0,
      location_count: locs.length,
      locations:      locs,
    } as PublicTrip;
  });
}

// ── public API ────────────────────────────────────────────────────────────

export async function getPublicTrips(query: PublicTripsQuery = {}): Promise<PublicTrip[]> {
  const conditions: string[] = ["t.is_public = TRUE"];
  const params: unknown[]    = [];

  // BUG FIX: region filter was joining through trip_locations, turning LEFT JOIN
  // into an implicit INNER JOIN and dropping trips with no locations.
  // We now filter by a subquery so the main trip row is always preserved.
  if (query.region) {
    params.push(`%${query.region}%`);
    conditions.push(
      `EXISTS (
         SELECT 1 FROM trip_locations tl2
         JOIN locations l2 ON l2.id = tl2.location_id
         JOIN regions   r2 ON r2.id = l2.region_id
         WHERE tl2.trip_id = t.id AND r2.name ILIKE $${params.length}
       )`
    );
  }
  if (query.difficulty) {
    params.push(query.difficulty);
    conditions.push(
      `EXISTS (
         SELECT 1 FROM trip_locations tl3
         JOIN locations l3 ON l3.id = tl3.location_id
         WHERE tl3.trip_id = t.id AND l3.difficulty = $${params.length}
       )`
    );
  }

  const where    = `WHERE ${conditions.join(" AND ")}`;
  const limit    = Math.min(query.limit  || 50, 100);
  const offset   = query.offset || 0;
  params.push(limit);  const limitIdx  = params.length;
  params.push(offset); const offsetIdx = params.length;

  // BUG FIX: removed DISTINCT ON + window function combination which was
  // incompatible in Postgres. Use a simple GROUP BY subquery for location_count.
  const { rows: trips } = await rawDb.query(
    `SELECT t.id, t.user_id, t.title, t.description,
            t.route_geojson, t.is_public, t.created_at,
            u.username   AS creator_username,
            u.avatar_url AS creator_avatar,
            COALESCE(u.xp, u.xp_points, 0) AS creator_xp
     FROM   trips t
     JOIN   users u ON u.id = t.user_id
     ${where}
     ORDER  BY t.created_at DESC
     LIMIT  $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return attachLocations(trips);
}

export async function getPublicTripById(tripId: number): Promise<PublicTrip | null> {
  // BUG FIX: old version called getPublicTrips({limit:1}) — useless, and the
  // result was thrown away immediately after.
  const { rows } = await rawDb.query(
    `SELECT t.id, t.user_id, t.title, t.description,
            t.route_geojson, t.is_public, t.created_at,
            u.username   AS creator_username,
            u.avatar_url AS creator_avatar,
            COALESCE(u.xp, u.xp_points, 0) AS creator_xp
     FROM   trips t
     JOIN   users u ON u.id = t.user_id
     WHERE  t.id = $1 AND t.is_public = TRUE`,
    [tripId]
  );
  if (!rows.length) return null;

  const results = await attachLocations(rows);
  return results[0] ?? null;
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
): Promise<PublicTrip> {
  const { rows } = await rawDb.query(
    `INSERT INTO trips (user_id, title, description, route_geojson, is_public)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      userId,
      data.title,
      data.description   || null,
      data.route_geojson ? JSON.stringify(data.route_geojson) : null,
      data.is_public     ?? false,
    ]
  );
  const tripId = rows[0].id as number;

  if (data.location_ids?.length) {
    // Insert all locations in a single query via VALUES list
    const values    = data.location_ids.map((locId, i) => `($1, $${i + 2}, ${i})`).join(", ");
    const locParams = [tripId, ...data.location_ids];
    await rawDb.query(
      `INSERT INTO trip_locations (trip_id, location_id, order_index) VALUES ${values}`,
      locParams
    );
  }

  // Increment trips_count regardless of whether locations were attached
  await rawDb.query(`UPDATE users SET trips_count = trips_count + 1 WHERE id = $1`, [userId]);

  // BUG FIX: was calling getPublicTripById which requires is_public=TRUE.
  // A just-created trip might be private (is_public=false) — fetch directly.
  const { rows: tripRows } = await rawDb.query(
    `SELECT t.id, t.user_id, t.title, t.description,
            t.route_geojson, t.is_public, t.created_at,
            u.username   AS creator_username,
            u.avatar_url AS creator_avatar,
            COALESCE(u.xp, u.xp_points, 0) AS creator_xp
     FROM   trips t
     JOIN   users u ON u.id = t.user_id
     WHERE  t.id = $1`,
    [tripId]
  );
  const results = await attachLocations(tripRows);
  return results[0];
}
