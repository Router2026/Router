// OSM ingestion: fetches nature locations from Overpass API and upserts into `locations` table.
import { rawDb } from "@/lib/db/raw-client";
import { upsertLocation } from "@/lib/locations/location-service";
import { getRegionIdByName } from "@/lib/regions/region-service";

const OVERPASS_URL = process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
const BBOX = "29,34,34,36"; // Israel bounding box: south,west,north,east

const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  node["natural"="spring"](${BBOX});
  node["tourism"="viewpoint"](${BBOX});
  node["leisure"="picnic_site"](${BBOX});
  node["natural"="waterfall"](${BBOX});
  node["natural"="peak"](${BBOX});
  node["natural"="cave_entrance"](${BBOX});
  node["natural"="beach"](${BBOX});
  node["leisure"="nature_reserve"](${BBOX});
  node["boundary"="national_park"](${BBOX});
  node["historic"="archaeological_site"](${BBOX});
  node["natural"="cliff"](${BBOX});
  node["natural"="crater"](${BBOX});
  way["natural"="spring"](${BBOX});
  way["tourism"="viewpoint"](${BBOX});
  way["leisure"="nature_reserve"](${BBOX});
  way["boundary"="national_park"](${BBOX});
  relation["leisure"="nature_reserve"](${BBOX});
  relation["boundary"="national_park"](${BBOX});
);
out center;
`.trim();

interface OsmElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function osmElementToRaw(element: OsmElement) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!lat || !lon) return null;

  const name =
    tags["name:he"] || tags["name"] || tags["name:en"] || tags["official_name"] || null;
  if (!name) return null;

  const category =
    tags.natural || tags.tourism || tags.leisure || tags.historic || tags.boundary || "טבע";

  return {
    id: String(element.id),
    name,
    description: tags.description || tags["description:he"] || null,
    category,
    latitude: lat,
    longitude: lon,
    has_water:
      tags.drinking_water === "yes" || tags.natural === "spring" || tags.amenity === "drinking_water",
    accessible: tags.wheelchair === "yes",
    has_shade: false,
    images: tags.image ? [tags.image] : [],
    main_image: tags.image || null,
    difficulty: tags["hiking:difficulty"] || "בינוני",
  };
}

export async function runOsmIngestion(jobId: string): Promise<{ processed: number }> {
  await rawDb.query(
    `UPDATE sync_jobs SET status='running', started_at=NOW() WHERE id=$1`,
    [jobId]
  );

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
      signal: AbortSignal.timeout(150_000),
    });

    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);

    const json = await res.json() as { elements: OsmElement[] };
    const elements = json.elements ?? [];

    await rawDb.query(
      `UPDATE sync_jobs SET total_locations=$1 WHERE id=$2`,
      [elements.length, jobId]
    );

    let processed = 0;
    for (const element of elements) {
      const raw = osmElementToRaw(element);
      if (!raw) continue;
      try {
        await upsertLocation({
          name: raw.name,
          description: raw.description || "",
          category: raw.category,
          latitude: raw.latitude,
          longitude: raw.longitude,
          images: raw.images,
          main_image: raw.main_image || undefined,
          source: "osm",
          source_id: raw.id,
          difficulty: raw.difficulty,
          has_water: raw.has_water,
          has_shade: raw.has_shade,
          accessible: raw.accessible,
        });
        processed++;
      } catch {
        // skip individual record errors
      }
      if (processed % 50 === 0) {
        await rawDb.query(
          `UPDATE sync_jobs SET processed_locations=$1 WHERE id=$2`,
          [processed, jobId]
        );
      }
    }

    await rawDb.query(
      `UPDATE sync_jobs SET status='completed', processed_locations=$1, completed_at=NOW() WHERE id=$2`,
      [processed, jobId]
    );

    return { processed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await rawDb.query(
      `UPDATE sync_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [msg, jobId]
    );
    throw err;
  }
}
