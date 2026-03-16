import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { pois } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PoiRecordSchema } from '@/lib/admin/schemas';
import { successResponse, errorResponse } from '@/lib/api/response';
import { verifyAdminCookie, verifyAdminRequest } from '@/lib/admin/auth';

const unauth = () =>
  NextResponse.json(errorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 });

export async function GET() {
  if (!(await verifyAdminCookie())) return unauth();
  try {
    const all = await db.select().from(pois).orderBy(desc(pois.createdAt));
    return NextResponse.json(successResponse(all));
  } catch (err) {
    console.error('[GET /api/admin/pois]', err);
    return NextResponse.json(errorResponse('Failed to fetch POIs', 'SERVER_ERROR'), {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) return unauth();
  try {
    const body = await req.json();
    const parsed = PoiRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }
    const [poi] = await db.insert(pois).values(parsed.data).returning();
    return NextResponse.json(successResponse(poi), { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/pois]', err);
    return NextResponse.json(errorResponse('Failed to create POI', 'SERVER_ERROR'), {
      status: 500,
    });
  }
}
