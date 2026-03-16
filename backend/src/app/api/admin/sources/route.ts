import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { dataSources } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { DataSourceSchema } from '@/lib/admin/schemas';
import { successResponse, errorResponse } from '@/lib/api/response';
import { verifyAdminCookie, verifyAdminRequest } from '@/lib/admin/auth';

const unauth = () =>
  NextResponse.json(errorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 });

export async function GET() {
  if (!(await verifyAdminCookie())) return unauth();
  try {
    const all = await db.select().from(dataSources).orderBy(desc(dataSources.createdAt));
    return NextResponse.json(successResponse(all));
  } catch (err) {
    console.error('[GET /api/admin/sources]', err);
    return NextResponse.json(errorResponse('Failed to fetch sources', 'SERVER_ERROR'), {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) return unauth();
  try {
    const body = await req.json();
    const parsed = DataSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }
    const [source] = await db.insert(dataSources).values(parsed.data).returning();
    return NextResponse.json(successResponse(source), { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/sources]', err);
    return NextResponse.json(errorResponse('Failed to create source', 'SERVER_ERROR'), {
      status: 500,
    });
  }
}
