// src/lib/location-images/location-images-service.ts — UPDATED
// Added: is_approved field, approveLocationImage, rejectLocationImage,
// getFirstApprovedImage, approvedOnly filter on getLocationImages.

import { rawDb } from "@/lib/db/raw-client";
import { awardXp, XP_REWARDS, type XpResult } from "@/lib/xp/xp-service";

export const MAX_IMAGES_PER_USER_PER_LOCATION = 5;

export interface LocationImage {
  id:          number;
  user_id:     number;
  location_id: number;
  image_url:   string;
  is_approved: boolean;
  approved_by?: number;
  approved_at?: Date;
  created_at:  Date;
  username?:   string;
}

export interface UploadImageResult {
  image: LocationImage;
  xp:    XpResult;
}

/**
 * Save image record and award XP.
 * Atomic limit enforcement prevents TOCTOU race conditions.
 */
export async function saveLocationImage(
  userId:     number,
  locationId: number,
  imageUrl:   string,
): Promise<UploadImageResult> {
  const { rows } = await rawDb.query(
    `INSERT INTO location_images (user_id, location_id, image_url, is_approved, approved_at)
     SELECT $1, $2, $3, TRUE, NOW()
     WHERE (
       SELECT COUNT(*) FROM location_images
       WHERE user_id = $1 AND location_id = $2
     ) < $4
     RETURNING *`,
    [userId, locationId, imageUrl, MAX_IMAGES_PER_USER_PER_LOCATION]
  );

  if (!rows.length) {
    throw Object.assign(
      new Error(`הגעת למגבלת ${MAX_IMAGES_PER_USER_PER_LOCATION} תמונות עבור מיקום זה`),
      { code: "LIMIT_REACHED" }
    );
  }

  const xpResult = await awardXp(userId, XP_REWARDS.PHOTO_UPLOAD);
  return { image: rows[0], xp: xpResult };
}

/** Approve a specific location image (admin only). */
export async function approveLocationImage(
  imageId: number,
  adminId: number,
): Promise<LocationImage> {
  const { rows } = await rawDb.query(
    `UPDATE location_images
     SET is_approved = TRUE, approved_by = $2, approved_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [imageId, adminId]
  );
  if (!rows.length) throw Object.assign(new Error("Image not found"), { code: "NOT_FOUND" });
  return rows[0];
}

/** Remove approval from a specific location image (admin only). */
export async function rejectLocationImage(imageId: number): Promise<void> {
  await rawDb.query(
    `UPDATE location_images
     SET is_approved = FALSE, approved_by = NULL, approved_at = NULL
     WHERE id = $1`,
    [imageId]
  );
}

/** Fetch all images for a location, newest first. Optionally filter by approved only. */
export async function getLocationImages(
  locationId:   number,
  approvedOnly: boolean = false,
): Promise<LocationImage[]> {
  const { rows } = await rawDb.query(
    `SELECT li.id, li.user_id, li.location_id, li.image_url,
            COALESCE(li.is_approved, FALSE) AS is_approved,
            li.approved_by, li.approved_at, li.created_at,
            u.username
     FROM   location_images li
     LEFT   JOIN users u ON u.id = li.user_id
     WHERE  li.location_id = $1
       ${approvedOnly ? "AND li.is_approved = TRUE" : ""}
     ORDER  BY li.created_at DESC`,
    [locationId]
  );
  return rows;
}

/** How many images has this user uploaded for this location? */
export async function countUserImages(userId: number, locationId: number): Promise<number> {
  const { rows } = await rawDb.query(
    `SELECT COUNT(*) AS cnt FROM location_images WHERE user_id = $1 AND location_id = $2`,
    [userId, locationId]
  );
  return Number.parseInt(rows[0].cnt as string, 10);
}

/** Get the first approved image URL for a location (fallback main image). */
export async function getFirstApprovedImage(locationId: number): Promise<string | null> {
  const { rows } = await rawDb.query(
    `SELECT image_url FROM location_images
     WHERE location_id = $1 AND is_approved = TRUE
     ORDER BY COALESCE(approved_at, created_at) DESC
     LIMIT 1`,
    [locationId]
  );
  return rows.length ? (rows[0].image_url as string) : null;
}
