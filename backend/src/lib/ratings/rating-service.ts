// src/lib/ratings/rating-service.ts
// Handles location ratings: upsert a user's rating, fetch summary.

import { rawDb } from "@/lib/db/raw-client";

export interface RatingSummary {
  average: number;
  count: number;
  userRating: number | null; // null if not rated by this user
}

/**
 * Upsert a rating for a location.
 * Returns the updated average and total count.
 */
export async function rateLocation(
  locationId: number,
  userId: number,
  rating: number
): Promise<RatingSummary> {
  if (rating < 1 || rating > 5) {
    throw Object.assign(new Error("Rating must be between 1 and 5"), { code: "VALIDATION_ERROR" });
  }

  // Upsert
  await rawDb.query(
    `INSERT INTO location_ratings (location_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (location_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating`,
    [locationId, userId, rating]
  );

  return getRatingSummary(locationId, userId);
}

/**
 * Get rating summary for a location, optionally for a specific user.
 */
export async function getRatingSummary(
  locationId: number,
  userId?: number
): Promise<RatingSummary> {
  const { rows } = await rawDb.query(
    `SELECT
       COALESCE(AVG(rating), 0)::numeric(3,2) AS average,
       COUNT(*) AS count
     FROM location_ratings
     WHERE location_id = $1`,
    [locationId]
  );

  let userRating: number | null = null;
  if (userId) {
    const { rows: ur } = await rawDb.query(
      `SELECT rating FROM location_ratings WHERE location_id = $1 AND user_id = $2`,
      [locationId, userId]
    );
    userRating = ur.length ? (ur[0].rating as number) : null;
  }

  return {
    average: Number.parseFloat(rows[0].average as string) || 0,
    count: Number.parseInt(rows[0].count as string, 10),
    userRating,
  };
}
