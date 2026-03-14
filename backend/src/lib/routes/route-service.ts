import { rawDb } from "@/lib/db/raw-client";

export interface RouteStop {
  id?: number;
  route_id?: number;
  location_id?: number;
  poi_name?: string;
  order_index: number;
  arrival_time: string;
  duration_minutes: number;
  smart_insight?: string;
  latitude?: number;
  longitude?: number;
}

export interface Route {
  id: number;
  name: string;
  description?: string;
  region_id?: number;
  region?: string;
  user_id?: number;
  total_distance_km?: number;
  total_duration_hours: number;
  difficulty?: string;
  group_type?: string;
  style?: string;
  stops: RouteStop[];
  created_at: Date;
}

export async function getRoutes(userId?: number): Promise<Route[]> {
  const { rows: routeRows } = userId
    ? await rawDb.query(
        `SELECT r.*, reg.name AS region FROM routes r
         LEFT JOIN regions reg ON r.region_id = reg.id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      )
    : await rawDb.query(
        `SELECT r.*, reg.name AS region FROM routes r
         LEFT JOIN regions reg ON r.region_id = reg.id
         ORDER BY r.created_at DESC`
      );
  if (!routeRows.length) return [];

  const routeIds = routeRows.map(r => r.id);
  const { rows: stopRows } = await rawDb.query(
    `SELECT rs.*, l.name AS location_name
     FROM route_stops rs
     LEFT JOIN locations l ON rs.location_id = l.id
     WHERE rs.route_id = ANY($1)
     ORDER BY rs.route_id, rs.order_index`,
    [routeIds]
  );

  return routeRows.map(route => ({
    ...route,
    total_duration_hours: parseFloat(route.total_duration_hours as string) || 0,
    stops: stopRows
      .filter(s => s.route_id === route.id)
      .map(s => ({ ...s, poi_name: (s.poi_name || s.location_name || "") as string })),
  })) as unknown as Route[];
}

export async function getRouteById(id: number): Promise<Route | null> {
  const { rows } = await rawDb.query(
    `SELECT r.*, reg.name AS region FROM routes r
     LEFT JOIN regions reg ON r.region_id = reg.id
     WHERE r.id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const route = rows[0];

  const { rows: stopRows } = await rawDb.query(
    `SELECT rs.*,
       COALESCE(l.name, rs.poi_name) AS location_name,
       COALESCE(l.latitude, l2.latitude)::float AS latitude,
       COALESCE(l.longitude, l2.longitude)::float AS longitude
     FROM route_stops rs
     LEFT JOIN locations l ON rs.location_id = l.id
     LEFT JOIN locations l2 ON rs.location_id IS NULL AND l2.name = rs.poi_name
     WHERE rs.route_id = $1
     ORDER BY rs.order_index`,
    [id]
  );

  return {
    ...route,
    total_duration_hours: parseFloat(route.total_duration_hours as string) || 0,
    stops: stopRows.map(s => ({
      ...s,
      poi_name: (s.poi_name || s.location_name || "") as string,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
    })),
  } as unknown as Route;
}

export async function deleteRoute(id: number): Promise<void> {
  await rawDb.query("DELETE FROM routes WHERE id = $1", [id]);
}

export async function createRoute(data: Partial<Route> & { user_id?: number }): Promise<Route> {
  const { rows } = await rawDb.query(
    `INSERT INTO routes (name, description, region_id, total_duration_hours, difficulty, group_type, style, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.name || "מסלול חדש",
      data.description || null,
      data.region_id || null,
      data.total_duration_hours || 0,
      data.difficulty || "בינוני",
      data.group_type || "משפחה",
      data.style || "טבע",
      data.user_id || null,
    ]
  );
  const route = rows[0];
  const routeId = route.id as number;

  const stops = data.stops || [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    await rawDb.query(
      `INSERT INTO route_stops (route_id, location_id, poi_name, order_index, arrival_time, duration_minutes, smart_insight)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        routeId,
        s.location_id || null,
        s.poi_name || null,
        i,
        s.arrival_time || "09:00",
        s.duration_minutes || 60,
        s.smart_insight || null,
      ]
    );
  }

  const result = await getRouteById(routeId);
  if (!result) throw new Error("Failed to retrieve created route");
  return result;
}
