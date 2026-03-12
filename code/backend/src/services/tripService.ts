import { db } from '../config/db';

export interface TripStop {
  id?: number;
  route_id?: number;
  location_id?: number;
  poi_name?: string;
  order_index: number;
  arrival_time: string;
  duration_minutes: number;
  smart_insight?: string;
}

export interface Trip {
  id: number;
  name: string;
  description?: string;
  region_id?: number;
  region?: string;
  total_distance_km?: number;
  total_duration_hours: number;
  difficulty?: string;
  group_type?: string;
  style?: string;
  stops: TripStop[];
  created_at: Date;
}

export async function getTrips(): Promise<Trip[]> {
  const { rows: routes } = await db.query(
    `SELECT r.*, reg.name AS region FROM routes r
     LEFT JOIN regions reg ON r.region_id = reg.id
     ORDER BY r.created_at DESC`
  );

  if (!routes.length) return [];

  const routeIds = routes.map((r: any) => r.id);
  const { rows: stops } = await db.query(
    `SELECT rs.*, l.name AS location_name
     FROM route_stops rs
     LEFT JOIN locations l ON rs.location_id = l.id
     WHERE rs.route_id = ANY($1)
     ORDER BY rs.route_id, rs.order_index`,
    [routeIds]
  );

  return routes.map((route: any) => ({
    ...route,
    total_duration_hours: parseFloat(route.total_duration_hours) || 0,
    stops: stops
      .filter((s: any) => s.route_id === route.id)
      .map((s: any) => ({
        ...s,
        poi_name: s.poi_name || s.location_name || '',
      })),
  }));
}

export async function getTripById(id: number): Promise<Trip | null> {
  const { rows } = await db.query(
    `SELECT r.*, reg.name AS region FROM routes r
     LEFT JOIN regions reg ON r.region_id = reg.id
     WHERE r.id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const route = rows[0];

  const { rows: stops } = await db.query(
    `SELECT rs.*, l.name AS location_name
     FROM route_stops rs
     LEFT JOIN locations l ON rs.location_id = l.id
     WHERE rs.route_id = $1
     ORDER BY rs.order_index`,
    [id]
  );

  return {
    ...route,
    total_duration_hours: parseFloat(route.total_duration_hours) || 0,
    stops: stops.map((s: any) => ({
      ...s,
      poi_name: s.poi_name || s.location_name || '',
    })),
  };
}

export async function createTrip(data: Partial<Trip>): Promise<Trip> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO routes (name, description, region_id, total_duration_hours, difficulty, group_type, style)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.name || 'מסלול חדש',
        data.description || null,
        data.region_id || null,
        data.total_duration_hours || 0,
        data.difficulty || 'בינוני',
        data.group_type || 'משפחה',
        data.style || 'טבע',
      ]
    );
    const route = rows[0];

    const stops = data.stops || [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      await client.query(
        `INSERT INTO route_stops (route_id, location_id, poi_name, order_index, arrival_time, duration_minutes, smart_insight)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          route.id,
          s.location_id || null,
          s.poi_name || null,
          i,
          s.arrival_time || '09:00',
          s.duration_minutes || 60,
          s.smart_insight || null,
        ]
      );
    }

    await client.query('COMMIT');
    return getTripById(route.id) as Promise<Trip>;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
