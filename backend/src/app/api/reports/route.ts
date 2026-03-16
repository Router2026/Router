// src/app/api/reports/route.ts
// Updated: extracts authenticated user_id and resolves location_id.

import { NextRequest, NextResponse } from 'next/server';
import { getReports, createReport } from '@/lib/reports/report-service';
import { getUserFromRequest } from '@/lib/auth/tokens';
import { successResponse, errorResponse } from '@/lib/api/response';
import { rawDb } from '@/lib/db/raw-client';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get('location_id');
    const data = await getReports(locationId ? parseInt(locationId) : undefined);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/reports]', err);
    return NextResponse.json(errorResponse('Failed to fetch reports', 'DB_ERROR'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Resolve authenticated user ──────────────────────────────────────────
    let resolvedUserId: number | null = null;
    let resolvedReporterName: string = body.reporter_name ?? 'אנונימי';

    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser(token);
      if (sbUser?.email) {
        const { rows } = await rawDb.query(
          `SELECT id, username, full_name FROM users WHERE email = $1 LIMIT 1`,
          [sbUser.email]
        );
        if (rows.length) {
          resolvedUserId = rows[0].id as number;
          resolvedReporterName =
            (rows[0].full_name as string) || (rows[0].username as string) || resolvedReporterName;
        }
      } else {
        const auth = await getUserFromRequest(req);
        if (auth?.id) {
          const { rows } = await rawDb.query(
            `SELECT id, username, full_name FROM users WHERE id = $1 LIMIT 1`,
            [auth.id]
          );
          if (rows.length) {
            resolvedUserId = rows[0].id as number;
            resolvedReporterName =
              (rows[0].full_name as string) || (rows[0].username as string) || resolvedReporterName;
          }
        }
      }
    }

    // ── Resolve location_id from the locations table ────────────────────────
    let resolvedLocationId: number | null = body.location_id ? parseInt(body.location_id) : null;

    if (!resolvedLocationId && body.poi_name) {
      const { rows } = await rawDb.query(`SELECT id FROM locations WHERE name = $1 LIMIT 1`, [
        body.poi_name,
      ]);
      if (rows.length) {
        resolvedLocationId = rows[0].id as number;
      }
    }

    const data = await createReport({
      user_id: resolvedUserId,
      location_id: resolvedLocationId,
      poi_name: body.poi_name ?? null,
      report_type: body.report_type,
      severity: body.severity ?? 'בינונית',
      content: body.content,
      reporter_name: resolvedReporterName,
    });

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error('[POST /api/reports]', err);
    return NextResponse.json(errorResponse('Failed to create report', 'DB_ERROR'), { status: 500 });
  }
}
