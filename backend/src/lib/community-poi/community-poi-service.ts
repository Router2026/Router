// src/lib/community-poi/community-poi-service.ts — UPDATED
// Added: region auto-classification from coordinates via PostGIS / bounding-box lookup.

import { rawDb } from "@/lib/db/raw-client";
import { uploadToStorage } from "@/lib/location-images/location-media-service";
import { sendPushToUser } from "@/lib/notifications/push-service";
import { CommunityPoiRow, CommunityPoiStatus, CreateCommunityPoiInput } from "./types";

/** XP reward awarded when a community POI is approved */
const APPROVAL_XP_REWARD = 50;

// ── Region classification ──────────────────────────────────────────────────────

/**
 * Classify a lat/lng into a region by finding the nearest region center
 * within the region's radius.  Falls back to nearest regardless of radius.
 * Uses the existing `regions` table — no external API calls.
 */
export async function classifyRegion(
  latitude: number,
  longitude: number
): Promise<{ region_id: number; region_name: string } | null> {
  // Try PostGIS point-in-polygon first (uses the geom column on regions if present)
  // Fall back to nearest center within radius_meters, then absolute nearest
  const { rows } = await rawDb.query(
    `SELECT id, name,
       ST_Distance(
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         ST_SetSRID(ST_MakePoint(center_lng::float, center_lat::float), 4326)::geography
       ) AS dist_meters,
       radius_meters
     FROM regions
     ORDER BY dist_meters ASC
     LIMIT 1`,
    [latitude, longitude]
  );

  if (!rows.length) return null;

  return {
    region_id: rows[0].id as number,
    region_name: rows[0].name as string,
  };
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function listAllCommunityPois(
  status?: CommunityPoiStatus
): Promise<CommunityPoiRow[]> {
  const statusClause = status ? `WHERE cp.status = $1` : "";
  const params = status ? [status] : [];

  const { rows } = await rawDb.query(
    `SELECT cp.*,
            u.username  AS submitter_username,
            u.email     AS submitter_email
     FROM   community_pois cp
     LEFT JOIN users u ON u.id = cp.user_id
     ${statusClause}
     ORDER BY cp.created_at DESC`,
    params
  );
  return rows as unknown as CommunityPoiRow[];
}

export async function getCommunityPoi(id: number): Promise<CommunityPoiRow | null> {
  const { rows } = await rawDb.query(
    `SELECT cp.*,
            u.username AS submitter_username,
            u.email    AS submitter_email
     FROM   community_pois cp
     LEFT JOIN users u ON u.id = cp.user_id
     WHERE  cp.id = $1`,
    [id]
  );
  return (rows[0] as unknown as CommunityPoiRow) ?? null;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createCommunityPoi(
  input: CreateCommunityPoiInput
): Promise<CommunityPoiRow> {
  // INSERT immediately with null region so the HTTP response is not blocked
  // by the PostGIS classifyRegion query. Region is backfilled asynchronously.
  const { rows } = await rawDb.query(
    `INSERT INTO community_pois
       (user_id, name, category, description, latitude, longitude, photos, status, region, region_id,
        difficulty, duration_minutes, has_water, has_shade, accessible, photo_credit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NULL, NULL, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.category,
      input.description ?? null,
      input.latitude,
      input.longitude,
      JSON.stringify(input.photos ?? []),
      input.difficulty ?? 'בינוני',
      input.duration_minutes ?? null,
      input.has_water ?? false,
      input.has_shade ?? false,
      input.accessible ?? false,
      input.photo_credit ?? null,
    ]
  );

  const poi = rows[0] as unknown as CommunityPoiRow;

  // Classify region in the background — non-blocking, best-effort
  classifyRegion(input.latitude, input.longitude)
    .then(regionInfo => {
      if (!regionInfo) return;
      return rawDb.query(
        `UPDATE community_pois SET region = $1, region_id = $2 WHERE id = $3`,
        [regionInfo.region_name, regionInfo.region_id, poi.id]
      );
    })
    .catch(err => {
      console.error(
        `[createCommunityPoi] background region classification failed for POI ${poi.id}:`,
        err
      );
    });

  return poi;
}

// ── Admin: Approve ─────────────────────────────────────────────────────────────

export async function approveCommunityPoi(
  id: number,
  adminUserId: number,
  edits?: Partial<Pick<CommunityPoiRow, "name" | "category" | "description">>
): Promise<CommunityPoiRow> {
  const client = await rawDb.getClient();
  try {
    await client.query("BEGIN");

    // 1. Mark the community POI as approved (with optional admin edits)
    const { rows: updatedRows } = await client.query(
      `UPDATE community_pois
       SET status      = 'approved',
           reviewed_by = $2,
           reviewed_at = NOW(),
           name        = COALESCE($3, name),
           category    = COALESCE($4, category),
           description = COALESCE($5, description),
           updated_at  = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        adminUserId,
        edits?.name ?? null,
        edits?.category ?? null,
        edits?.description ?? null,
      ]
    );

    if (!updatedRows.length) {
      throw Object.assign(new Error("Community POI not found"), { code: "NOT_FOUND" });
    }

    const poi = updatedRows[0] as unknown as CommunityPoiRow;

    // 2. Fetch submitter username for credit fields
    let submitterUsername: string | null = null;
    if (poi.user_id) {
      const { rows: userRows } = await client.query(
        `SELECT username FROM users WHERE id = $1 LIMIT 1`,
        [poi.user_id]
      );
      submitterUsername = (userRows[0]?.username as string) ?? null;
    }

    const photos: string[] = Array.isArray(poi.photos) ? poi.photos : [];
    const mainImage = photos.length > 0 ? photos[0] : null;
    // Use contributor-supplied photo_credit if provided; fall back to submitter username.
    // uploaded_by always records who submitted the community POI.
    const photoCredit = (poi as any).photo_credit || submitterUsername || null;

    const lat = Number.parseFloat(poi.latitude as unknown as string);
    const lng = Number.parseFloat(poi.longitude as unknown as string);

    // 3. Upsert into public locations table — inside the same transaction
    // Note: lat/lng are passed TWICE — once as numeric for the columns,
    // once as float8 for ST_MakePoint — to avoid PostgreSQL type-inference
    // error 42P08 ("inconsistent types deduced for parameter $N").
    await client.query(
      `INSERT INTO locations
         (name, category, description, latitude, longitude,
          geom, images, main_image, source, source_id, region_id, photo_credit, uploaded_by,
          difficulty, duration_minutes, has_water, has_shade, accessible)
       VALUES ($1, $2, $3, $4, $5,
         ST_SetSRID(ST_MakePoint($6::float8, $7::float8), 4326)::geography,
         $8, $9, 'community', $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (source, source_id) DO UPDATE
         SET name             = EXCLUDED.name,
             category         = EXCLUDED.category,
             description      = EXCLUDED.description,
             latitude         = EXCLUDED.latitude,
             longitude        = EXCLUDED.longitude,
             geom             = EXCLUDED.geom,
             region_id        = EXCLUDED.region_id,
             images           = EXCLUDED.images,
             main_image       = EXCLUDED.main_image,
             photo_credit     = EXCLUDED.photo_credit,
             uploaded_by      = EXCLUDED.uploaded_by,
             difficulty       = EXCLUDED.difficulty,
             duration_minutes = EXCLUDED.duration_minutes,
             has_water        = EXCLUDED.has_water,
             has_shade        = EXCLUDED.has_shade,
             accessible       = EXCLUDED.accessible,
             updated_at       = NOW()`,
      [
        poi.name,                                    // $1
        poi.category,                                // $2
        poi.description ?? "",                       // $3
        lat,                                         // $4
        lng,                                         // $5
        lng,                                         // $6 MakePoint lng
        lat,                                         // $7 MakePoint lat
        JSON.stringify(photos),                      // $8
        mainImage,                                   // $9
        String(poi.id),                              // $10 source_id
        (poi as any).region_id ?? null,              // $11
        photoCredit,                                 // $12
        submitterUsername,                           // $13
        (poi as any).difficulty ?? 'בינוני',         // $14
        (poi as any).duration_minutes ?? null,       // $15
        (poi as any).has_water ?? false,             // $16
        (poi as any).has_shade ?? false,             // $17
        (poi as any).accessible ?? false,            // $18
      ]
    );

    // 4. Migrate any pending media from community_pois.photos into location_media.
    //    Photos are stored as JSON strings of https:// Storage URLs on community_pois.photos.
    //    We insert them into location_media so they appear in the approved POI's gallery.
    const pendingPhotos: string[] = Array.isArray(poi.photos) ? poi.photos : [];
    for (const photoUrl of pendingPhotos) {
      if (!photoUrl || !photoUrl.startsWith("http")) continue;
      await client.query(
        `INSERT INTO location_media
           (user_id, location_id, media_type, media_url, is_approved, approved_at)
         SELECT $1, loc.id, 'image', $2, TRUE, NOW()
         FROM locations loc
         WHERE loc.source = 'community' AND loc.source_id = $3
         ON CONFLICT DO NOTHING`,
        [poi.user_id, photoUrl, String(poi.id)]
      );
    }

    await client.query("COMMIT");

    // 4. XP + push notification (outside transaction — non-critical)
    if (poi.user_id) {
      await rawDb.query(
        `UPDATE users SET xp_points = xp_points + $1 WHERE id = $2`,
        [APPROVAL_XP_REWARD, poi.user_id]
      );

      await sendPushToUser(poi.user_id, {
        title: "📍 המיקום שלך אושר!",
        body: `"${poi.name}" פורסם למפה הציבורית. קיבלת ${APPROVAL_XP_REWARD} XP!`,
        data: {
          type: "community_poi_approved",
          community_poi_id: String(poi.id),
          xp_awarded: String(APPROVAL_XP_REWARD),
        },
      });
    }

    return poi;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[approveCommunityPoi] transaction failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// ── Admin: Reject ──────────────────────────────────────────────────────────────

export async function rejectCommunityPoi(
  id: number,
  adminUserId: number,
  adminNote?: string
): Promise<CommunityPoiRow> {
  const { rows } = await rawDb.query(
    `UPDATE community_pois
     SET status      = 'rejected',
         admin_note  = $3,
         reviewed_by = $2,
         reviewed_at = NOW(),
         updated_at  = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, adminUserId, adminNote ?? null]
  );

  const poi = rows[0] as unknown as CommunityPoiRow;

  if (poi.user_id) {
    await sendPushToUser(poi.user_id, {
      title: "📍 עדכון על המיקום שהגשת",
      body: adminNote
        ? `"${poi.name}" לא אושר: ${adminNote}`
        : `"${poi.name}" לא אושר על ידי הצוות שלנו.`,
      data: {
        type: "community_poi_rejected",
        community_poi_id: String(poi.id),
      },
    });
  }

  return poi;
}

// ── Admin: Edit ────────────────────────────────────────────────────────────────

export async function editCommunityPoi(
  id: number,
  updates: Partial<
    Pick<CommunityPoiRow, "name" | "category" | "description" | "latitude" | "longitude" | "photos">
  >
): Promise<CommunityPoiRow> {
  const { rows } = await rawDb.query(
    `UPDATE community_pois
     SET name        = COALESCE($2, name),
         category    = COALESCE($3, category),
         description = COALESCE($4, description),
         latitude    = COALESCE($5, latitude),
         longitude   = COALESCE($6, longitude),
         photos      = COALESCE($7, photos),
         updated_at  = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updates.name ?? null,
      updates.category ?? null,
      updates.description ?? null,
      updates.latitude ?? null,
      updates.longitude ?? null,
      updates.photos ? JSON.stringify(updates.photos) : null,
    ]
  );
  return rows[0] as unknown as CommunityPoiRow;
}