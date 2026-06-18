// src/app/api/reports/route.ts
// Updated: extracts authenticated user_id and resolves location_id.
// Performance: forwards report_type filter and pagination params to the service layer.

import { NextRequest, NextResponse } from "next/server";
import { getReports, createReport } from "@/lib/reports/report-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { resolveContributorUser } from "@/lib/auth/resolve-user";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const locationId = sp.get("location_id") ? Number.parseInt(sp.get("location_id")!) : undefined;
    const reportType = sp.get("type") || undefined;
    const limit = sp.get("limit") ? Math.min(Number.parseInt(sp.get("limit")!), 100) : 50;
    const offset = sp.get("offset") ? Math.max(Number.parseInt(sp.get("offset")!), 0) : 0;

    const data = await getReports({ locationId, reportType, limit, offset });

    return NextResponse.json(successResponse(data), {
      headers: {
        // Reports change infrequently enough for a short shared cache.
        // CDN / reverse-proxy serves stale for up to 60 s while revalidating.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch reports", "DB_ERROR"),
      { status: 500 }
    );
  }
}

const ALLOWED_SEVERITIES = new Set(["נמוכה", "בינונית", "גבוהה"]);

function stripHtml(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/<[^>]*>/g, "").slice(0, 2000).trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { userId: resolvedUserId, name: resolvedReporterName } = await resolveContributorUser(
      req,
      body.reporter_name ?? "אנונימי"
    );

    if (!resolvedUserId) {
      return NextResponse.json(
        errorResponse("Authentication required to submit a report", "UNAUTHORIZED"),
        { status: 401 }
      );
    }

    const content = stripHtml(body.content);
    if (!content) {
      return NextResponse.json(
        errorResponse("content is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const severity = ALLOWED_SEVERITIES.has(body.severity) ? body.severity : "בינונית";

    // ── Resolve location_id from the locations table ────────────────────────
    let resolvedLocationId: number | null = body.location_id
      ? Number.parseInt(body.location_id)
      : null;

    if (!resolvedLocationId && body.poi_name) {
      const { rows } = await rawDb.query(
        `SELECT id FROM locations WHERE name = $1 LIMIT 1`,
        [body.poi_name]
      );
      if (rows.length) {
        resolvedLocationId = rows[0].id as number;
      }
    }

    const data = await createReport({
      user_id: resolvedUserId,
      location_id: resolvedLocationId,
      poi_name: body.poi_name ?? null,
      report_type: stripHtml(body.report_type),
      severity,
      content,
      reporter_name: resolvedReporterName,
    });

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error("[POST /api/reports]", err);
    return NextResponse.json(
      errorResponse("Failed to create report", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";