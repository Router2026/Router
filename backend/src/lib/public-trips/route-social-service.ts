// src/lib/public-trips/route-social-service.ts
// Handles likes, comments, ratings, and media uploads for public routes.

import { rawDb } from "@/lib/db/raw-client";

// ── Types ─────────────────────────────────────────────────────────────────

export interface RouteComment {
  id: number;
  route_id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: Date;
}

export interface RouteSocialStats {
  likes_count: number;
  comments_count: number;
  average_rating: number;
  ratings_count: number;
  user_liked: boolean;
  user_rating: number | null;
}

// ── Likes ─────────────────────────────────────────────────────────────────

export async function toggleRouteLike(routeId: number, userId: number): Promise<{ liked: boolean; likes_count: number }> {
  // Try insert; if duplicate, delete instead
  const existing = await rawDb.query(
    `SELECT id FROM route_likes WHERE route_id = $1 AND user_id = $2`,
    [routeId, userId]
  );

  let liked: boolean;
  if (existing.rows.length) {
    await rawDb.query(`DELETE FROM route_likes WHERE route_id = $1 AND user_id = $2`, [routeId, userId]);
    liked = false;
  } else {
    await rawDb.query(`INSERT INTO route_likes (route_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [routeId, userId]);
    liked = true;
  }

  // Update denormalized count
  await rawDb.query(
    `UPDATE routes SET likes_count = (SELECT COUNT(*) FROM route_likes WHERE route_id = $1) WHERE id = $1`,
    [routeId]
  );

  const { rows } = await rawDb.query(`SELECT likes_count FROM routes WHERE id = $1`, [routeId]);
  return { liked, likes_count: (rows[0]?.likes_count as number) ?? 0 };
}

export async function getRouteLikeStatus(routeId: number, userId: number | null): Promise<{ liked: boolean; likes_count: number }> {
  const { rows } = await rawDb.query(`SELECT likes_count FROM routes WHERE id = $1`, [routeId]);
  const likes_count = (rows[0]?.likes_count as number) ?? 0;
  if (!userId) return { liked: false, likes_count };

  const { rows: likeRows } = await rawDb.query(
    `SELECT id FROM route_likes WHERE route_id = $1 AND user_id = $2`,
    [routeId, userId]
  );
  return { liked: likeRows.length > 0, likes_count };
}

// ── Comments ──────────────────────────────────────────────────────────────

export async function addRouteComment(routeId: number, userId: number, content: string): Promise<RouteComment> {
  const { rows } = await rawDb.query(
    `INSERT INTO route_comments (route_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, route_id, user_id, content, created_at`,
    [routeId, userId, content.trim()]
  );

  // Update denormalized count
  await rawDb.query(
    `UPDATE routes SET comments_count = (SELECT COUNT(*) FROM route_comments WHERE route_id = $1) WHERE id = $1`,
    [routeId]
  );

  // Fetch with username
  const { rows: full } = await rawDb.query(
    `SELECT rc.id, rc.route_id, rc.user_id, u.username, u.avatar_url, rc.content, rc.created_at
     FROM route_comments rc JOIN users u ON u.id = rc.user_id
     WHERE rc.id = $1`,
    [rows[0].id]
  );
  return full[0] as RouteComment;
}

export async function getRouteComments(routeId: number): Promise<RouteComment[]> {
  const { rows } = await rawDb.query(
    `SELECT rc.id, rc.route_id, rc.user_id, u.username, u.avatar_url, rc.content, rc.created_at
     FROM route_comments rc
     JOIN users u ON u.id = rc.user_id
     WHERE rc.route_id = $1
     ORDER BY rc.created_at DESC
     LIMIT 100`,
    [routeId]
  );
  return rows as RouteComment[];
}

export async function deleteRouteComment(commentId: number, userId: number, isAdmin: boolean): Promise<void> {
  const { rows } = await rawDb.query(
    `DELETE FROM route_comments WHERE id = $1 ${isAdmin ? "" : "AND user_id = $2"} RETURNING route_id`,
    isAdmin ? [commentId] : [commentId, userId]
  );
  if (!rows.length) throw Object.assign(new Error("Comment not found or not authorized"), { code: "NOT_FOUND" });

  await rawDb.query(
    `UPDATE routes SET comments_count = (SELECT COUNT(*) FROM route_comments WHERE route_id = $1) WHERE id = $1`,
    [rows[0].route_id]
  );
}

// ── Ratings ───────────────────────────────────────────────────────────────

export async function setRouteRating(routeId: number, userId: number, rating: number): Promise<{ average_rating: number; ratings_count: number; user_rating: number }> {
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  await rawDb.query(
    `INSERT INTO route_ratings (route_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (route_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [routeId, userId, rating]
  );

  // Update denormalized stats
  await rawDb.query(
    `UPDATE routes SET
       ratings_count  = (SELECT COUNT(*) FROM route_ratings WHERE route_id = $1),
       average_rating = (SELECT COALESCE(AVG(rating), 0) FROM route_ratings WHERE route_id = $1)
     WHERE id = $1`,
    [routeId]
  );

  const { rows } = await rawDb.query(`SELECT average_rating, ratings_count FROM routes WHERE id = $1`, [routeId]);
  return {
    average_rating: parseFloat(rows[0]?.average_rating as string) ?? 0,
    ratings_count:  (rows[0]?.ratings_count as number) ?? 0,
    user_rating:    rating,
  };
}

export async function getRouteRatingStatus(routeId: number, userId: number | null): Promise<{ average_rating: number; ratings_count: number; user_rating: number | null }> {
  const { rows } = await rawDb.query(`SELECT average_rating, ratings_count FROM routes WHERE id = $1`, [routeId]);
  const average_rating = parseFloat(rows[0]?.average_rating as string) ?? 0;
  const ratings_count  = (rows[0]?.ratings_count as number) ?? 0;

  if (!userId) return { average_rating, ratings_count, user_rating: null };

  const { rows: ratingRows } = await rawDb.query(
    `SELECT rating FROM route_ratings WHERE route_id = $1 AND user_id = $2`,
    [routeId, userId]
  );
  return { average_rating, ratings_count, user_rating: ratingRows[0]?.rating ?? null };
}

// ── Route media (image / video) ───────────────────────────────────────────

export async function updateRouteMedia(
  routeId: number,
  userId: number,
  data: {
    user_description?: string;
    image_url?: string;
    video_url?: string;
    points_of_interest?: string;
    recommended_stops?: string;
  }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.user_description !== undefined) {
    params.push(data.user_description);
    sets.push(`user_description = $${params.length}`);
  }
  if (data.image_url !== undefined) {
    params.push(data.image_url);
    sets.push(`image_url = $${params.length}`);
  }
  if (data.video_url !== undefined) {
    params.push(data.video_url);
    sets.push(`video_url = $${params.length}`);
  }
  if (data.points_of_interest !== undefined) {
    params.push(data.points_of_interest);
    sets.push(`points_of_interest = $${params.length}`);
  }
  if (data.recommended_stops !== undefined) {
    params.push(data.recommended_stops);
    sets.push(`recommended_stops = $${params.length}`);
  }

  if (!sets.length) return;
  params.push(routeId, userId);

  const { rows } = await rawDb.query(
    `UPDATE routes SET ${sets.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING id`,
    params
  );
  if (!rows.length) throw Object.assign(new Error("Route not found or not authorized"), { code: "NOT_FOUND" });
}

// ── Route Images ──────────────────────────────────────────────────────────

export async function addRouteImage(
  routeId: number,
  userId: number,
  image_url: string,
  caption?: string
): Promise<{ id: number; route_id: number; image_url: string; caption?: string; created_at: Date }> {
  // Verify ownership
  const { rows: ownerRows } = await rawDb.query(
    `SELECT id FROM routes WHERE id = $1 AND user_id = $2`,
    [routeId, userId]
  );
  if (!ownerRows.length) throw Object.assign(new Error("Not authorized"), { code: "NOT_FOUND" });

  const { rows } = await rawDb.query(
    `INSERT INTO route_images (route_id, user_id, image_url, caption)
     VALUES ($1, $2, $3, $4)
     RETURNING id, route_id, image_url, caption, created_at`,
    [routeId, userId, image_url, caption || null]
  );
  const r = rows[0];
  return {
    id: r.id as number,
    route_id: r.route_id as number,
    image_url: r.image_url as string,
    caption: (r.caption as string) || undefined,
    created_at: r.created_at as Date,
  };
}

export async function getRouteImages(
  routeId: number
): Promise<{ id: number; route_id: number; image_url: string; caption?: string; created_at: Date }[]> {
  const { rows } = await rawDb.query(
    `SELECT id, route_id, image_url, caption, created_at
     FROM route_images WHERE route_id = $1 ORDER BY created_at ASC`,
    [routeId]
  );
  return rows.map(r => ({
    id: r.id as number,
    route_id: r.route_id as number,
    image_url: r.image_url as string,
    caption: (r.caption as string) || undefined,
    created_at: r.created_at as Date,
  }));
}

export async function deleteRouteImage(
  routeId: number,
  imageId: number,
  userId: number
): Promise<void> {
  const { rows } = await rawDb.query(
    `DELETE FROM route_images WHERE id = $1 AND route_id = $2 AND user_id = $3 RETURNING id`,
    [imageId, routeId, userId]
  );
  if (!rows.length) throw Object.assign(new Error("Image not found or not authorized"), { code: "NOT_FOUND" });
}

// ── Social stats for a list of route IDs ─────────────────────────────────

export async function getSocialStatsForRoutes(
  routeIds: number[],
  userId: number | null
): Promise<Map<number, RouteSocialStats>> {
  if (!routeIds.length) return new Map();

  const placeholders = routeIds.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await rawDb.query(
    `SELECT id, likes_count, comments_count, average_rating, ratings_count FROM routes WHERE id IN (${placeholders})`,
    routeIds
  );

  let likedSet = new Set<number>();
  let userRatingMap = new Map<number, number>();

  if (userId) {
    const { rows: likeRows } = await rawDb.query(
      `SELECT route_id FROM route_likes WHERE user_id = $1 AND route_id IN (${placeholders})`,
      [userId, ...routeIds]
    );
    likedSet = new Set(likeRows.map(r => r.route_id as number));

    const { rows: ratingRows } = await rawDb.query(
      `SELECT route_id, rating FROM route_ratings WHERE user_id = $1 AND route_id IN (${placeholders})`,
      [userId, ...routeIds]
    );
    ratingRows.forEach(r => userRatingMap.set(r.route_id as number, r.rating as number));
  }

  const statsMap = new Map<number, RouteSocialStats>();
  for (const row of rows) {
    const id = row.id as number;
    statsMap.set(id, {
      likes_count:    (row.likes_count as number) ?? 0,
      comments_count: (row.comments_count as number) ?? 0,
      average_rating: parseFloat(row.average_rating as string) ?? 0,
      ratings_count:  (row.ratings_count as number) ?? 0,
      user_liked:     likedSet.has(id),
      user_rating:    userRatingMap.get(id) ?? null,
    });
  }
  return statsMap;
}
