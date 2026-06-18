// src/lib/reports/report-service.ts
// Updated to include explicit user_id linkage (Feature 2).
// Performance: getReports now accepts server-side type filter + pagination (limit/offset).

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

export interface GetReportsOptions {
  locationId?: number;
  reportType?: string;   // server-side filter — avoids loading all rows for one type
  limit?: number;        // default 50, max 100
  offset?: number;       // default 0
}

export async function getReports(opts: GetReportsOptions = {}): Promise<CommunityReport[]> {
  const { locationId, reportType, limit = 50, offset = 0 } = opts;
  const safeLimit = Math.min(limit, 100);
  const safeOffset = Math.max(offset, 0);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (locationId !== undefined) {
    params.push(locationId);
    conditions.push(`location_id = $${params.length}`);
  }
  if (reportType) {
    params.push(reportType);
    conditions.push(`report_type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(safeLimit, safeOffset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  // Explicit column list — avoids pulling large unused columns in list views
  const { rows } = await rawDb.query(
    `SELECT id, user_id, location_id, poi_name, report_type, severity,
            content, reporter_name, upvotes, created_at
     FROM community_reports
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows;
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

export async function createReport(data: CreateReportInput): Promise<CommunityReport> {
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
    ]
  );

  // Increment the user's report counter and award XP
  if (data.user_id) {
    await rawDb.query(
      `UPDATE users
       SET reports_count = reports_count + 1,
           xp_points     = xp_points + 10
       WHERE id = $1`,
      [data.user_id]
    );
  }

  return rows[0];
}

export async function upvoteReport(id: number, delta: 1 | -1): Promise<CommunityReport | null> {
  const { rows } = await rawDb.query(
    `UPDATE community_reports
     SET upvotes = GREATEST(0, upvotes + $2)
     WHERE id = $1 RETURNING *`,
    [id, delta]
  );
  return (rows[0]) ?? null;
}