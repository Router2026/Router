// src/lib/users/profile-service.ts

import { rawDb } from "@/lib/db/raw-client";
import { computeLevel, levelLabel } from "@/lib/xp/xp-service";

export interface PublicProfile {
  id:               number;
  username:         string;
  full_name:        string | null;
  bio:              string | null;
  avatar_url:       string | null;
  cover_image:      string | null;
  favorite_regions: string[] | null;
  instagram:        string | null;
  website:          string | null;
  xp:               number;
  xp_points:        number;
  level:            string;
  level_number:     number;
  is_admin:         boolean;
  reports_count:    number;
  reviews_count:    number;
  trips_count:      number;
  created_at:       Date;
}

export interface UpdateProfileInput {
  username?:         string;
  full_name?:        string;
  bio?:              string;
  avatar_url?:       string;
  cover_image?:      string;
  favorite_regions?: string[];
  instagram?:        string;
  website?:          string;
}

// BUG FIX: COALESCE(xp, xp_points, 0) throws if the `xp` column doesn't yet
// exist (pre-migration). We alias xp_points as the canonical XP source and also
// select xp when available so post-migration both columns are populated.
const XP_EXPR = `COALESCE(xp_points, 0)`;

function rowToProfile(row: Record<string, unknown>): PublicProfile {
  const xp = parseInt(row.xp as string, 10) || (row.xp_points as number) || 0;
  return {
    id:               row.id               as number,
    username:         row.username         as string,
    full_name:        (row.full_name        as string) || null,
    bio:              (row.bio              as string) || null,
    avatar_url:       (row.avatar_url       as string) || null,
    cover_image:      (row.cover_image      as string) || null,
    favorite_regions: (row.favorite_regions as string[]) || null,
    instagram:        (row.instagram        as string) || null,
    website:          (row.website          as string) || null,
    xp,
    xp_points:        xp,
    level:            (row.level            as string) || levelLabel(xp),
    level_number:     computeLevel(xp),
    is_admin:         (row.is_admin         as boolean) || false,
    reports_count:    (row.reports_count    as number)  || 0,
    reviews_count:    (row.reviews_count    as number)  || 0,
    trips_count:      (row.trips_count      as number)  || 0,
    created_at:       row.created_at        as Date,
  };
}

export async function getProfile(userId: number): Promise<PublicProfile | null> {
  const { rows } = await rawDb.query(
    `SELECT id, username, full_name, bio, avatar_url, cover_image,
            favorite_regions, instagram, website,
            ${XP_EXPR} AS xp, xp_points,
            level, is_admin, reports_count, reviews_count, trips_count, created_at
     FROM   users
     WHERE  id = $1`,
    [userId]
  );
  return rows.length ? rowToProfile(rows[0]) : null;
}

export async function updateProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<PublicProfile> {
  const fields: string[] = [];
  const params: unknown[] = [];

  const allowed: (keyof UpdateProfileInput)[] = [
    "username", "full_name", "bio", "avatar_url",
    "cover_image", "favorite_regions", "instagram", "website",
  ];

  for (const key of allowed) {
    if (input[key] !== undefined) {
      params.push(input[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (!fields.length) throw new Error("No fields to update");

  // Username uniqueness — check before update
  if (input.username) {
    const { rows: clash } = await rawDb.query(
      `SELECT id FROM users WHERE username = $1 AND id <> $2`,
      [input.username, userId]
    );
    if (clash.length) {
      throw Object.assign(new Error("Username already taken"), { code: "USERNAME_TAKEN" });
    }
  }

  params.push(userId);
  const { rows } = await rawDb.query(
    `UPDATE users
     SET    ${fields.join(", ")}
     WHERE  id = $${params.length}
     RETURNING id, username, full_name, bio, avatar_url, cover_image,
               favorite_regions, instagram, website,
               ${XP_EXPR} AS xp, xp_points,
               level, is_admin, reports_count, reviews_count, trips_count, created_at`,
    params
  );

  if (!rows.length) throw new Error("User not found");
  return rowToProfile(rows[0]);
}
