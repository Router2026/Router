import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { enrichFromPlaces } from "@/lib/google-places/places-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { verifyAdminRequest } from "@/lib/admin/auth";

const DELAY_MS = 200;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { locationId?: number; force?: boolean; limit?: number };
  const { locationId, force = false, limit = 100 } = body;

  const rows = await rawDb.query<{ id: number; name: string; latitude: string; longitude: string }>(
    locationId
      ? `SELECT id, name, latitude, longitude FROM locations WHERE id = $1`
      : `SELECT id, name, latitude, longitude FROM locations
         WHERE ($1 OR google_place_id IS NULL)
         ORDER BY id
         LIMIT $2`,
    locationId ? [locationId] : [force, limit],
  );

  const results: Array<{ id: number; status: "enriched" | "not_found" | "error" }> = [];

  for (const row of rows.rows) {
    try {
      const enrichment = await enrichFromPlaces(row.name, parseFloat(row.latitude), parseFloat(row.longitude));
      if (!enrichment) {
        results.push({ id: row.id, status: "not_found" });
      } else {
        await rawDb.query(
          `UPDATE locations
           SET google_place_id = $1,
               images = $2::jsonb,
               main_image = $3,
               photo_credit = $4,
               updated_at = NOW()
           WHERE id = $5`,
          [
            enrichment.placeId,
            JSON.stringify(enrichment.photoUrls),
            enrichment.photoUrls[0] ?? null,
            enrichment.photoCredit,
            row.id,
          ],
        );
        results.push({ id: row.id, status: "enriched" });
      }
    } catch {
      results.push({ id: row.id, status: "error" });
    }
    await sleep(DELAY_MS);
  }

  const summary = {
    total: results.length,
    enriched: results.filter(r => r.status === "enriched").length,
    not_found: results.filter(r => r.status === "not_found").length,
    errors: results.filter(r => r.status === "error").length,
  };

  return NextResponse.json(successResponse({ summary, results }));
}
