import { NextRequest, NextResponse } from 'next/server';
import { getVideos, createVideo } from '@/lib/videos/video-service';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET() {
  try {
    const data = await getVideos();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error('[GET /api/videos]', err);
    return NextResponse.json(errorResponse('Failed to fetch videos', 'DB_ERROR'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createVideo(body);
    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error('[POST /api/videos]', err);
    return NextResponse.json(errorResponse('Failed to create video', 'DB_ERROR'), { status: 500 });
  }
}
