// src/lib/community-poi/community-poi-service.ts
// Business logic for user-contributed POIs (Community POI Feature).

import { rawDb } from '@/lib/db/raw-client';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { CommunityPoiRow, CommunityPoiStatus, CreateCommunityPoiInput } from './types';

/** XP reward awarded when a community POI is approved */
const APPROVAL_XP_REWARD = 50;

// ── Read ───────────────────────────────────────────────────────────────────────

/** Admin: list all community POIs, newest first, with submitter info */
export async function listAllCommunityPois(
  status?: CommunityPoiStatus
): Promise<CommunityPoiRow[]> {
  const statusClause = status ? `WHERE cp.status = $1` : '';
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

/** Get a single community POI by id */
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

/** User submits a new community POI (status = pending) */
export async function createCommunityPoi(input: CreateCommunityPoiInput): Promise<CommunityPoiRow> {
  const { rows } = await rawDb.query(
    `INSERT INTO community_pois
       (user_id, name, category, description, latitude, longitude, photos, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.category,
      input.description ?? null,
      input.latitude,
      input.longitude,
      JSON.stringify(input.photos ?? []),
    ]
  );
  return rows[0] as unknown as CommunityPoiRow;
}

// ── Admin: Approve ─────────────────────────────────────────────────────────────

/**
 * Admin approves a pending community POI.
 * Side-effects:
 *  1. Copies the POI into the public `locations` table.
 *  2. Awards APPROVAL_XP_REWARD XP to the submitter.
 *  3. Sends a push notification to the submitter.
 */
export async function approveCommunityPoi(
  id: number,
  adminUserId: number,
  edits?: Partial<Pick<CommunityPoiRow, 'name' | 'category' | 'description'>>
): Promise<CommunityPoiRow> {
  // 1. Update community_pois status to approved (apply optional admin edits)
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
    [id, adminUserId, edits?.name ?? null, edits?.category ?? null, edits?.description ?? null]
  );

  const poi = updatedRows[0] as unknown as CommunityPoiRow;

  // 2. Publish to the public locations table
  await rawDb.query(
    `INSERT INTO locations
       (name, category, description, latitude, longitude, images, source, source_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'community', $7)
     ON CONFLICT (source, source_id) DO UPDATE
       SET name        = EXCLUDED.name,
           category    = EXCLUDED.category,
           description = EXCLUDED.description,
           updated_at  = NOW()`,
    [
      poi.name,
      poi.category,
      poi.description ?? '',
      poi.latitude,
      poi.longitude,
      JSON.stringify(poi.photos),
      String(poi.id), // source_id = community_poi id
    ]
  );

  // 3. Award XP to the submitter (skip if no user linked)
  if (poi.user_id) {
    await rawDb.query(
      `UPDATE users
       SET xp_points = xp_points + $1
       WHERE id = $2`,
      [APPROVAL_XP_REWARD, poi.user_id]
    );

    // 4. Send push notification
    await sendPushToUser(poi.user_id, {
      title: '📍 המיקום שלך אושר!',
      body: `"${poi.name}" פורסם למפה הציבורית. קיבלת ${APPROVAL_XP_REWARD} XP!`,
      data: {
        type: 'community_poi_approved',
        community_poi_id: String(poi.id),
        xp_awarded: String(APPROVAL_XP_REWARD),
      },
    });
  }

  return poi;
}

// ── Admin: Reject ──────────────────────────────────────────────────────────────

/** Admin rejects a pending community POI with an optional note */
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

  // Notify user of rejection
  if (poi.user_id) {
    await sendPushToUser(poi.user_id, {
      title: '📍 עדכון על המיקום שהגשת',
      body: adminNote
        ? `"${poi.name}" לא אושר: ${adminNote}`
        : `"${poi.name}" לא אושר על ידי הצוות שלנו.`,
      data: {
        type: 'community_poi_rejected',
        community_poi_id: String(poi.id),
      },
    });
  }

  return poi;
}

// ── Admin: Edit ────────────────────────────────────────────────────────────────

/** Admin edits a pending community POI (before approve/reject) */
export async function editCommunityPoi(
  id: number,
  updates: Partial<
    Pick<CommunityPoiRow, 'name' | 'category' | 'description' | 'latitude' | 'longitude' | 'photos'>
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
