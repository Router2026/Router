import { NextRequest, NextResponse } from 'next/server';
import { rawDb } from '@/lib/db/raw-client';
import { runOsmIngestion } from '@/lib/ingestion/osm-ingestion';
import { successResponse, errorResponse } from '@/lib/api/response';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json(errorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
  }
  try {
    const jobId = `osm-${Date.now()}`;
    await rawDb.query(`INSERT INTO sync_jobs (id, source, status) VALUES ($1, 'osm', 'pending')`, [
      jobId,
    ]);

    // Fire-and-forget: update progress in sync_jobs table
    void runOsmIngestion(jobId).catch(console.error);

    return NextResponse.json(successResponse({ jobId, message: 'OSM sync started' }), {
      status: 202,
    });
  } catch (err) {
    console.error('[POST /api/admin/sync/osm]', err);
    return NextResponse.json(errorResponse('Failed to start OSM sync', 'SERVER_ERROR'), {
      status: 500,
    });
  }
}
