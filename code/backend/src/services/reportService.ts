import { db } from '../config/db';

export interface CommunityReport {
  id: number;
  location_id?: number;
  poi_name?: string;
  report_type: string;
  severity: string;
  content: string;
  reporter_name: string;
  upvotes: number;
  created_at: Date;
}

export async function getReports(locationId?: number): Promise<CommunityReport[]> {
  const { rows } = locationId
    ? await db.query(
        `SELECT * FROM community_reports WHERE location_id = $1 ORDER BY created_at DESC`,
        [locationId]
      )
    : await db.query(`SELECT * FROM community_reports ORDER BY created_at DESC`);
  return rows;
}

export async function createReport(data: Partial<CommunityReport>): Promise<CommunityReport> {
  const { rows } = await db.query(
    `INSERT INTO community_reports (location_id, poi_name, report_type, severity, content, reporter_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      data.location_id || null,
      data.poi_name || null,
      data.report_type,
      data.severity || 'בינונית',
      data.content,
      data.reporter_name || 'אנונימי',
    ]
  );
  return rows[0];
}

export async function upvoteReport(id: number): Promise<CommunityReport | null> {
  const { rows } = await db.query(
    `UPDATE community_reports SET upvotes = upvotes + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}
