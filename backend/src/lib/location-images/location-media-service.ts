// src/lib/location-images/location-media-service.ts
// Stores media in Supabase Storage and saves the resulting public URL in the DB.
// Previously this stored raw base64 data URIs directly in the media_url column,
// which bloated the DB, broke Supabase image transforms, and caused CSP failures.

import { rawDb } from "@/lib/db/raw-client";
import { supabaseAdmin } from "@/lib/db/supabase";
import { awardXp, XP_REWARDS, type XpResult } from "@/lib/xp/xp-service";

export const MAX_MEDIA_PER_USER_PER_LOCATION = 10;
export const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB for video
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;  // 8 MB for images

/** Supabase Storage bucket name. Must be created in the Supabase dashboard. */
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? "location-media";

export type MediaType = "image" | "video";

export interface LocationMedia {
  id: number;
  location_id: number;
  user_id: number;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_approved: boolean;
  approved_by?: number;
  approved_at?: Date;
  created_at: Date;
  username?: string;
}

export interface SaveMediaResult {
  media: LocationMedia;
  xp: XpResult;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-msvideo": "avi",
};

export function getMediaType(mimeType: string): MediaType {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video";
  throw Object.assign(
    new Error(`Unsupported file type: ${mimeType}. Supported: JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV`),
    { code: "VALIDATION_ERROR" }
  );
}

export function validateMediaSize(base64Data: string, mimeType: string) {
  const estimatedBytes = (base64Data.length * 3) / 4;
  const limit = ALLOWED_VIDEO_TYPES.includes(mimeType)
    ? MAX_MEDIA_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
  if (estimatedBytes > limit) {
    const mb = Math.round(limit / 1024 / 1024);
    throw Object.assign(
      new Error(`File too large (max ${mb} MB)`),
      { code: "VALIDATION_ERROR" }
    );
  }
}

/**
 * Upload a base64-encoded file to Supabase Storage and return its public URL.
 * Throws if the upload fails so the caller can surface the error properly.
 */
export async function uploadToStorage(
  base64Data: string,
  mimeType: string,
  folder: string,
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType] ?? "bin";
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(base64Data, "base64");

  const { error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "31536000", // 1 year — files are immutable (content-addressed by timestamp)
    });

  if (error) {
    throw Object.assign(
      new Error(`Storage upload failed: ${error.message}`),
      { code: "STORAGE_ERROR" }
    );
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Save a media item (image or video) for a location and award XP.
 * mediaUrl must already be a Supabase Storage public URL (not a data URI).
 */
export async function saveLocationMedia(
  userId: number,
  locationId: number,
  mediaUrl: string,
  mediaType: MediaType,
  thumbnailUrl?: string,
  caption?: string,
): Promise<SaveMediaResult> {
  const { rows } = await rawDb.query(
    `INSERT INTO location_media (user_id, location_id, media_type, media_url, thumbnail_url, caption, is_approved, approved_at)
     SELECT $1, $2, $3, $4, $5, $6, TRUE, NOW()
     WHERE (
       SELECT COUNT(*) FROM location_media
       WHERE user_id = $1 AND location_id = $2
     ) < $7
     RETURNING *`,
    [userId, locationId, mediaType, mediaUrl, thumbnailUrl ?? null, caption ?? null, MAX_MEDIA_PER_USER_PER_LOCATION]
  );

  if (!rows.length) {
    throw Object.assign(
      new Error(`הגעת למגבלת ${MAX_MEDIA_PER_USER_PER_LOCATION} פריטי מדיה עבור מיקום זה`),
      { code: "LIMIT_REACHED" }
    );
  }

  const xpResult = await awardXp(userId, XP_REWARDS.PHOTO_UPLOAD);
  return { media: rows[0] as unknown as LocationMedia, xp: xpResult };
}

/**
 * List all media for a location, with uploader username.
 */
export async function getLocationMedia(
  locationId: number,
  approvedOnly = false,
): Promise<LocationMedia[]> {
  const { rows } = await rawDb.query(
    `SELECT
       m.id, m.location_id, m.user_id, m.media_type, m.media_url,
       m.thumbnail_url, m.caption,
       COALESCE(m.is_approved, FALSE) AS is_approved,
       m.approved_by, m.approved_at, m.created_at,
       u.username
     FROM location_media m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.location_id = $1
       ${approvedOnly ? "AND m.is_approved = TRUE" : ""}
     ORDER BY m.created_at DESC`,
    [locationId]
  );
  return rows as unknown as LocationMedia[];
}

export async function approveMedia(mediaId: number, adminId: number): Promise<LocationMedia> {
  const { rows } = await rawDb.query(
    `UPDATE location_media
     SET is_approved = TRUE, approved_by = $2, approved_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [mediaId, adminId]
  );
  if (!rows.length) throw Object.assign(new Error("Media not found"), { code: "NOT_FOUND" });
  return rows[0] as unknown as LocationMedia;
}

export async function rejectMedia(mediaId: number): Promise<void> {
  await rawDb.query(
    `UPDATE location_media
     SET is_approved = FALSE, approved_by = NULL, approved_at = NULL
     WHERE id = $1`,
    [mediaId]
  );
}

export async function deleteMedia(mediaId: number, userId: number, isAdmin: boolean): Promise<void> {
  const { rows } = await rawDb.query(
    `DELETE FROM location_media
     WHERE id = $1 ${isAdmin ? "" : "AND user_id = $2"}
     RETURNING id`,
    isAdmin ? [mediaId] : [mediaId, userId]
  );
  if (!rows.length) throw Object.assign(new Error("Media not found or not authorized"), { code: "NOT_FOUND" });
}