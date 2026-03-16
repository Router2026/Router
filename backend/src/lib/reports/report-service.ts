// src/lib/reports/report-service.ts
// Updated to include explicit user_id linkage (Feature 2).

import { rawDb } from "@/lib/db/raw-client";

export interface CommunityReport {
  id: number;
  user_id?: number | null;
  location_id?: number | null;
  poi_name?: string | null;
  report_type: string;
  severity: string;
  content: string;
  reporter_name: string;
  upvotes: number;
  created_at: Date;
}

export async function getReports(
  locationId?: number,
): Promise<CommunityReport[]> {
  const { rows } = locationId
    ? await rawDb.query(
        `SELECT * FROM community_reports WHERE location_id = $1 ORDER BY created_at DESC`,
        [locationId],
      )
    : await rawDb.query(
        `SELECT * FROM community_reports ORDER BY created_at DESC`,
      );
  return rows as unknown as CommunityReport[];
}

export interface CreateReportInput {
  /** ID of the authenticated user submitting the report */
  user_id?: number | null;
  /** Resolved FK to the locations table */
  location_id?: number | null;
  /** Fallback name when the location is not yet in the DB */
  poi_name?: string | null;
  report_type: string;
  severity?: string;
  content: string;
  reporter_name?: string;
}

export async function createReport(
  data: CreateReportInput,
): Promise<CommunityReport> {
  const { rows } = await rawDb.query(
    `INSERT INTO community_reports
       (user_id, location_id, poi_name, report_type, severity, content, reporter_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.user_id ?? null,
      data.location_id ?? null,
      data.poi_name ?? null,
      data.report_type,
      data.severity ?? "בינונית",
      data.content,
      data.reporter_name ?? "אנונימי",
    ],
  );

  // Increment the user's report counter and award XP
  if (data.user_id) {
    await rawDb.query(
      `UPDATE users
       SET reports_count = reports_count + 1,
           xp_points     = xp_points + 10
       WHERE id = $1`,
      [data.user_id],
    );
  }

  return rows[0] as unknown as CommunityReport;
}

export async function upvoteReport(
  id: number,
): Promise<CommunityReport | null> {
  const { rows } = await rawDb.query(
    `UPDATE community_reports SET upvotes = upvotes + 1 WHERE id = $1 RETURNING *`,
    [id],
  );
  return (rows[0] as unknown as CommunityReport) ?? null;
}
