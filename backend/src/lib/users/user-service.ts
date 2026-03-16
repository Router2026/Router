import { rawDb } from '@/lib/db/raw-client';

export interface RouterUser {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  xp_points: number;
  level: string;
  reports_count: number;
  reviews_count: number;
  trips_count: number;
  created_at: Date;
}

export async function getCurrentUser(): Promise<RouterUser | null> {
  const { rows } = await rawDb.query(`SELECT * FROM users WHERE id = 1 LIMIT 1`);
  return rows.length ? (rows[0] as unknown as RouterUser) : null;
}

export async function getLeaderboard(): Promise<RouterUser[]> {
  const { rows } = await rawDb.query(`SELECT * FROM users ORDER BY xp_points DESC LIMIT 50`);
  if (!rows.length) {
    return [
      {
        id: 1,
        email: 'omri@example.com',
        full_name: 'עומרי חליפה',
        display_name: 'עומרי חליפה',
        xp_points: 1250,
        level: 'שועל שטח',
        reports_count: 5,
        reviews_count: 8,
        trips_count: 10,
        created_at: new Date(),
      },
      {
        id: 2,
        email: 'sarah@example.com',
        full_name: 'שרה לוי',
        display_name: 'שרה לוי',
        xp_points: 980,
        level: 'חוקר',
        reports_count: 3,
        reviews_count: 6,
        trips_count: 7,
        created_at: new Date(),
      },
      {
        id: 3,
        email: 'yoav@example.com',
        full_name: 'יואב כהן',
        display_name: 'יואב כהן',
        xp_points: 850,
        level: 'חוקר',
        reports_count: 2,
        reviews_count: 4,
        trips_count: 6,
        created_at: new Date(),
      },
      {
        id: 4,
        email: 'noa@example.com',
        full_name: 'נועה ברק',
        display_name: 'נועה ברק',
        xp_points: 720,
        level: 'מתחיל',
        reports_count: 1,
        reviews_count: 3,
        trips_count: 4,
        created_at: new Date(),
      },
      {
        id: 5,
        email: 'gil@example.com',
        full_name: 'גיל שמש',
        display_name: 'גיל שמש',
        xp_points: 650,
        level: 'מתחיל',
        reports_count: 1,
        reviews_count: 2,
        trips_count: 3,
        created_at: new Date(),
      },
    ];
  }
  return rows as unknown as RouterUser[];
}

export async function getStats(): Promise<{
  total_locations: number;
  total_regions: number;
  average_rating: number;
}> {
  const { rows } = await rawDb.query(
    `SELECT
       (SELECT COUNT(*) FROM locations)::int AS total_locations,
       (SELECT COUNT(*) FROM regions)::int AS total_regions,
       (SELECT ROUND(AVG(average_rating)::numeric, 1) FROM locations) AS average_rating`
  );
  return {
    total_locations: (rows[0].total_locations as number) || 0,
    total_regions: (rows[0].total_regions as number) || 0,
    average_rating: parseFloat(rows[0].average_rating as string) || 4.8,
  };
}
