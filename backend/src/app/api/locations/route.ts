import { NextRequest, NextResponse } from 'next/server';
import { getLocations } from '@/lib/locations/location-service';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await getLocations({
      region: sp.get('region') || undefined,
      category: sp.get('category') || undefined,
      difficulty: sp.get('difficulty') || undefined,
      search: sp.get('search') || undefined,
      has_water: sp.get('has_water') === 'true',
      has_shade: sp.get('has_shade') === 'true',
      accessible: sp.get('accessible') === 'true',
      limit: sp.get('limit') ? parseInt(sp.get('limit')!) : undefined,
      offset: sp.get('offset') ? parseInt(sp.get('offset')!) : undefined,
    });
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/locations]', err);
    return NextResponse.json(errorResponse('Failed to fetch locations', 'DB_ERROR'), {
      status: 500,
    });
  }
}
