import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/users/user-service';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET() {
  try {
    const data = await getLeaderboard();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/users/leaderboard]', err);
    return NextResponse.json(errorResponse('Failed to fetch leaderboard', 'DB_ERROR'), {
      status: 500,
    });
  }
}
