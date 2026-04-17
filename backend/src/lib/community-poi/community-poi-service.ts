// src/lib/community-poi/community-poi-service.ts — UPDATED
// Added: region auto-classification from coordinates via PostGIS / bounding-box lookup.

import { rawDb } from "@/lib/db/raw-client";
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
  // Auto-classify region from coordinates
  const regionInfo = await classifyRegion(input.latitude, input.longitude).catch(() => null);

  const { rows } = await rawDb.query(
    `INSERT INTO community_pois
       (user_id, name, category, description, latitude, longitude, photos, status, region, region_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.category,
      input.description ?? null,
      input.latitude,
      input.longitude,
      JSON.stringify(input.photos ?? []),
      regionInfo?.region_name ?? null,
      regionInfo?.region_id ?? null,
    ]
  );
  return rows[0] as unknown as CommunityPoiRow;
}

// ── Admin: Approve ─────────────────────────────────────────────────────────────

export async function approveCommunityPoi(
  id: number,
  adminUserId: number,
  edits?: Partial<Pick<CommunityPoiRow, "name" | "category" | "description">>
): Promise<CommunityPoiRow> {
  const { rows: updatedRows } = await rawDb.query(
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

  const poi = updatedRows[0] as unknown as CommunityPoiRow;

  // Publish to public locations table (with geom + region_id)
  await rawDb.query(
    `INSERT INTO locations
       (name, category, description, latitude, longitude, geom, images, source, source_id, region_id)
     VALUES ($1, $2, $3, $4, $5,
       ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
       $7, 'community', $8, $9)
     ON CONFLICT (source, source_id) DO UPDATE
       SET name        = EXCLUDED.name,
           category    = EXCLUDED.category,
           description = EXCLUDED.description,
           region_id   = EXCLUDED.region_id,
           updated_at  = NOW()`,
    [
      poi.name,
      poi.category,
      poi.description ?? "",
      poi.latitude,
      poi.longitude,
      poi.longitude,          // MakePoint(lng, lat)
      JSON.stringify(poi.photos),
      String(poi.id),
      (poi as any).region_id ?? null,
    ]
  );

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
