import { db } from '../config/db';
import type { User } from '../models/types';

export async function getCurrentUser(): Promise<User> {
  // Return a default/demo user; extend with real auth later
  const { rows } = await db.query(
    `SELECT * FROM users WHERE id = 1 LIMIT 1`
  );
  if (rows.length) {
    return rows[0] as User;
  }
  // Auto-create demo user
  const { rows: created } = await db.query(
    `INSERT INTO users (email, full_name, display_name, xp_points, level)
     VALUES ('demo@router.app', 'עומרי חליפה', 'עומרי', 0, 'מטייל מתחיל')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`
  );
  return created[0] as User;
}

export async function getLeaderboard(): Promise<User[]> {
  const { rows } = await db.query(
    `SELECT * FROM users ORDER BY xp_points DESC LIMIT 50`
  );
  // If empty, return demo data
  if (!rows.length) {
    return [
      { id: 1, email: 'omri@example.com', full_name: 'עומרי חליפה', display_name: 'עומרי חליפה', xp_points: 1250, level: 'שועל שטח', reports_count: 5, reviews_count: 8, trips_count: 10, created_at: new Date() },
      { id: 2, email: 'sarah@example.com', full_name: 'שרה לוי', display_name: 'שרה לוי', xp_points: 980, level: 'חוקר', reports_count: 3, reviews_count: 6, trips_count: 7, created_at: new Date() },
      { id: 3, email: 'yoav@example.com', full_name: 'יואב כהן', display_name: 'יואב כהן', xp_points: 850, level: 'חוקר', reports_count: 2, reviews_count: 4, trips_count: 6, created_at: new Date() },
      { id: 4, email: 'noa@example.com', full_name: 'נועה ברק', display_name: 'נועה ברק', xp_points: 720, level: 'מתחיל', reports_count: 1, reviews_count: 3, trips_count: 4, created_at: new Date() },
      { id: 5, email: 'gil@example.com', full_name: 'גיל שמש', display_name: 'גיל שמש', xp_points: 650, level: 'מתחיל', reports_count: 1, reviews_count: 2, trips_count: 3, created_at: new Date() },
    ] as User[];
  }
  return rows as User[];
}

export async function getStats(): Promise<{ total_locations: number; total_regions: number; average_rating: number }> {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM locations)::int AS total_locations,
       (SELECT COUNT(*) FROM regions)::int AS total_regions,
       (SELECT ROUND(AVG(average_rating)::numeric, 1) FROM locations) AS average_rating`
  );
  return {
    total_locations: rows[0].total_locations || 0,
    total_regions: rows[0].total_regions || 0,
    average_rating: parseFloat(rows[0].average_rating) || 4.8,
  };
}
