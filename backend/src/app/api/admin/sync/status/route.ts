import { NextRequest, NextResponse } from 'next/server';
import { rawDb } from '@/lib/db/raw-client';
import { successResponse, errorResponse } from '@/lib/api/response';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json(errorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
  }
  try {
    const { rows } = await rawDb.query(`SELECT * FROM sync_jobs ORDER BY created_at DESC LIMIT 20`);
    return NextResponse.json(successResponse(rows));
  } catch (err) {
    console.error('[GET /api/admin/sync/status]', err);
    return NextResponse.json(errorResponse('Failed to fetch sync status', 'DB_ERROR'), {
      status: 500,
    });
  }
}
