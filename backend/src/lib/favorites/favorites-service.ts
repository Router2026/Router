// src/lib/favorites/favorites-service.ts

import { rawDb } from "@/lib/db/raw-client";

export interface FavoriteLocation {
  id:          number;
  user_id:     number;
  location_id: number;
  created_at:  Date;
  // Joined location fields
  name?:        string;
  category?:    string;
  region_name?: string;
  latitude?:    number;
  longitude?:   number;
  main_image?:  string;
  difficulty?:  string;
  average_rating?: number;
}

export async function addFavorite(userId: number, locationId: number): Promise<FavoriteLocation> {
  const { rows } = await rawDb.query(
    `INSERT INTO favorites (user_id, location_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, location_id) DO NOTHING
     RETURNING *`,
    [userId, locationId]
  );
  if (!rows.length) {
    // Already exists — fetch and return it
    const existing = await rawDb.query(
      `SELECT * FROM favorites WHERE user_id = $1 AND location_id = $2`,
      [userId, locationId]
    );
    return existing.rows[0] as FavoriteLocation;
  }
  return rows[0] as FavoriteLocation;
}

export async function removeFavorite(userId: number, locationId: number): Promise<void> {
  await rawDb.query(
    `DELETE FROM favorites WHERE user_id = $1 AND location_id = $2`,
    [userId, locationId]
  );
}

export async function getUserFavorites(userId: number): Promise<FavoriteLocation[]> {
  const { rows } = await rawDb.query(
    `SELECT f.*, l.name, l.category, r.name AS region_name,
            l.latitude, l.longitude, l.main_image, l.difficulty, l.average_rating
     FROM favorites f
     JOIN locations l ON l.id = f.location_id
     LEFT JOIN regions r ON r.id = l.region_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return rows as FavoriteLocation[];
}

export async function isFavorite(userId: number, locationId: number): Promise<boolean> {
  const { rows } = await rawDb.query(
    `SELECT 1 FROM favorites WHERE user_id = $1 AND location_id = $2`,
    [userId, locationId]
  );
  return rows.length > 0;
}
