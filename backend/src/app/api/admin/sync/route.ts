import { NextRequest, NextResponse } from 'next/server';
import { syncDataSource } from '@/lib/poi/sync-service';
import { successResponse, errorResponse } from '@/lib/api/response';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json(errorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
  }
  try {
    const { sourceId } = await req.json();
    if (!sourceId || typeof sourceId !== 'string') {
      return NextResponse.json(errorResponse('sourceId required', 'VALIDATION_ERROR'), {
        status: 400,
      });
    }
    const result = await syncDataSource(sourceId);
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error('[POST /api/admin/sync]', err);
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json(errorResponse(message, 'SERVER_ERROR'), { status: 500 });
  }
}
