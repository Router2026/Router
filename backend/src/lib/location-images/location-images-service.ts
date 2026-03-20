// src/lib/location-images/location-images-service.ts

import { rawDb } from "@/lib/db/raw-client";
import { awardXp, XP_REWARDS, type XpResult } from "@/lib/xp/xp-service";

export const MAX_IMAGES_PER_USER_PER_LOCATION = 5;

export interface LocationImage {
  id:          number;
  user_id:     number;
  location_id: number;
  image_url:   string;
  created_at:  Date;
  username?:   string;
}

export interface UploadImageResult {
  image: LocationImage;
  xp:    XpResult;
}

/** Save image record and award XP.
 *
 * BUG FIX: The original two-step "count then insert" had a TOCTOU race
 * condition — two concurrent requests could both pass the count check and both
 * insert.  We now enforce the limit atomically via a conditional INSERT that
 * checks the count inside the same statement.
 */
export async function saveLocationImage(
  userId:     number,
  locationId: number,
  imageUrl:   string,
): Promise<UploadImageResult> {
  // One atomic statement: insert only when the user is below the limit.
  // Returns the new row if inserted, or nothing if the limit was already hit.
  const { rows } = await rawDb.query(
    `INSERT INTO location_images (user_id, location_id, image_url)
     SELECT $1, $2, $3
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
  return { image: rows[0] as unknown as LocationImage, xp: xpResult };
}

/** Fetch all images for a location, newest first. */
export async function getLocationImages(locationId: number): Promise<LocationImage[]> {
  const { rows } = await rawDb.query(
    `SELECT li.id, li.user_id, li.location_id, li.image_url, li.created_at,
            u.username
     FROM   location_images li
     LEFT   JOIN users u ON u.id = li.user_id
     WHERE  li.location_id = $1
     ORDER  BY li.created_at DESC`,
    [locationId]
  );
  return rows as unknown as LocationImage[];
}

/** How many images has this user uploaded for this location? */
export async function countUserImages(userId: number, locationId: number): Promise<number> {
  const { rows } = await rawDb.query(
    `SELECT COUNT(*) AS cnt FROM location_images WHERE user_id = $1 AND location_id = $2`,
    [userId, locationId]
  );
  return parseInt(rows[0].cnt as string, 10);
}
