import { rawDb } from "@/lib/db/raw-client";

export interface Review {
  id: number;
  location_id?: number;
  poi_name?: string;
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

export async function createReview(data: Partial<Review>): Promise<Review> {
  const { rows } = await rawDb.query(
    `INSERT INTO reviews (location_id, poi_name, reviewer_name, rating, content)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      data.location_id || null,
      data.poi_name || null,
      data.reviewer_name || "אנונימי",
      data.rating,
      data.content,
    ]
  );
  return rows[0] as unknown as Review;
}
