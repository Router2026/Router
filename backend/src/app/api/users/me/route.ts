import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/users/user-service';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET() {
  try {
    const data = await getCurrentUser();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/users/me]', err);
    return NextResponse.json(errorResponse('Failed to fetch user', 'DB_ERROR'), { status: 500 });
  }
}
