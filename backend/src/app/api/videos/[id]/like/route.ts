import { NextRequest, NextResponse } from 'next/server';
import { likeVideo } from '@/lib/videos/video-service';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await likeVideo(parseInt(id));
    if (!data) {
      return NextResponse.json(errorResponse('Video not found', 'NOT_FOUND'), { status: 404 });
    }
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[PATCH /api/videos/[id]/like]', err);
    return NextResponse.json(errorResponse('Failed to like video', 'DB_ERROR'), { status: 500 });
  }
}
