import { NextRequest, NextResponse } from 'next/server';
import { TripInputSchema } from '@/lib/trips/schemas';
import { generateTrip } from '@/lib/trips/trip-service';
import { successResponse, errorResponse } from '@/lib/api/response';

// Simple in-memory rate limiter: 5 trips per IP per 10 minutes.
// Note: resets on serverless cold start — use Redis for strict enforcement in production.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// Accepts only bare IPv4/IPv6 to prevent spoofed composite values
const IP_RE = /^[0-9a-fA-F.:]{2,45}$/;

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (IP_RE.test(first)) return first;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  if (real && IP_RE.test(real)) return real;
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      errorResponse(
        'Too many requests — please wait before generating another trip',
        'RATE_LIMITED'
      ),
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = TripInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(errorResponse('Invalid input', 'VALIDATION_ERROR'), { status: 400 });
    }

    const { uuid, plan } = await generateTrip(parsed.data);

    return NextResponse.json(successResponse({ tripId: uuid, plan }), {
      status: 201,
    });
  } catch (err) {
    console.error('[POST /api/trips]', err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : 'Plan generation failed — please try again',
        'GENERATION_ERROR'
      ),
      { status: 500 }
    );
  }
}
