// src/lib/reviews/review-service.ts
// Updated to include explicit user_id linkage (Feature 2).

import { rawDb } from "@/lib/db/raw-client";

export interface Review {
  id: number;
  user_id?: number | null;
  location_id?: number | null;
  poi_name?: string | null;
  reviewer_name: string;
  rating: number;
  content: string;
  created_at: Date;
}

export async function getReviews(locationId?: number): Promise<Review[]> {
  const { rows } = locationId
    ? await rawDb.query(
        `SELECT * FROM reviews WHERE location_id = $1 ORDER BY created_at DESC`,
        [locationId]
      )
    : await rawDb.query(`SELECT * FROM reviews ORDER BY created_at DESC`);
  return rows as unknown as Review[];
}

export interface CreateReviewInput {
  /** ID of the authenticated user who is writing the review */
  user_id?: number | null;
  /** Resolved FK to the locations table */
  location_id?: number | null;
  /** Fallback display name (used when POI is not yet in the locations table) */
  poi_name?: string | null;
  /** Display name override; falls back to the user's username if omitted */
  reviewer_name?: string;
  rating: number;
  content: string;
}

export async function createReview(data: CreateReviewInput): Promise<Review> {
  const { rows } = await rawDb.query(
    `INSERT INTO reviews
       (user_id, location_id, poi_name, reviewer_name, rating, content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.user_id      ?? null,
      data.location_id  ?? null,
      data.poi_name     ?? null,
      data.reviewer_name ?? "אנונימי",
      data.rating,
      data.content,
    ]
  );

  // Increment the user's review counter and award XP
  if (data.user_id) {
    await rawDb.query(
      `UPDATE users
       SET reviews_count = reviews_count + 1,
           xp_points     = xp_points + 20
       WHERE id = $1`,
      [data.user_id]
    );
  }

  return rows[0] as unknown as Review;
}
