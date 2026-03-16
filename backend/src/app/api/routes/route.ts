import { NextRequest, NextResponse } from 'next/server';
import { getRoutes, createRoute } from '@/lib/routes/route-service';
import { getUserFromRequest } from '@/lib/auth/tokens';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    // Admin sees all routes; regular users see only their own; unauthenticated sees nothing
    const data = await getRoutes(user?.is_admin ? undefined : user?.id);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/routes]', err);
    return NextResponse.json(errorResponse('Failed to fetch routes', 'DB_ERROR'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const data = await createRoute({ ...body, user_id: user?.id ?? null });
    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error('[POST /api/routes]', err);
    return NextResponse.json(errorResponse('Failed to create route', 'DB_ERROR'), { status: 500 });
  }
}
