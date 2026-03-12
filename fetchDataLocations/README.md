# 🌿 Israel Nature Locations — ETL Pipeline

Automated ETL that fetches thousands of nature locations across Israel from multiple public data sources and loads them into PostgreSQL + PostGIS.

---

## Project Structure

```
israel-nature-etl/
├── scripts/
│   ├── fetchLocations.js   # Main orchestrator
│   ├── fetchOSM.js         # OpenStreetMap via Overpass API
│   ├── fetchGovData.js     # data.gov.il open datasets
│   ├── fetchKKL.js         # KKL-JNF ArcGIS FeatureServer
│   └── fetchIHike.js       # Israel Hiking Map API
├── db/
│   ├── db.js               # PostgreSQL connection pool + helpers
│   └── schema.sql          # DB schema, indices, seed data
├── utils/
│   ├── normalizeLocation.js  # Unified schema normalizer
│   ├── regionDetector.js     # Lat/lon → Hebrew region name
│   └── categoryMapper.js     # Raw type → Hebrew category
├── .env.example
└── package.json
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 12+ with PostGIS extension installed
- Internet access to reach Overpass, data.gov.il, ArcGIS, israelhiking.osm.org.il

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Create the database schema

```bash
psql -U postgres -d israel_nature -f db/schema.sql
```

This creates the `regions`, `locations` tables, PostGIS index, and seeds all 11 Israeli regions.

---

## Running the ETL

### Import all sources

```bash
node scripts/fetchLocations.js
# or
npm start
```

### Dry run (no DB writes — prints sample output)

```bash
node scripts/fetchLocations.js --dry-run
# or
npm run dry-run
```

### Import a single source

```bash
node scripts/fetchLocations.js --source=osm
node scripts/fetchLocations.js --source=gov
node scripts/fetchLocations.js --source=kkl
node scripts/fetchLocations.js --source=ihike
```

### Combine sources

```bash
node scripts/fetchLocations.js --source=osm,ihike
```

---

## Expected Output

```
═══════════════════════════════════════════════════════
 Israel Nature Locations ETL — fetchLocations.js
═══════════════════════════════════════════════════════
Sources: osm, gov, kkl, ihike
Mode:    LIVE
───────────────────────────────────────────────────────

[DB] Loaded 11 regions into cache.

▶ Source: OpenStreetMap (osm)
───────────────────────────────────────────────────────
[OSM] Sending Overpass query...
[OSM] Received 4800 raw elements.
[OSM] Converted 4320 valid elements.
[OSM] Normalized: 4100 / 4320
[OSM] Progress: 4100/4100
[OSM] ✓ Inserted: 3950  Skipped: 150  Errors: 0

... (other sources) ...

═══════════════════════════════════════════════════════
 ETL SUMMARY
═══════════════════════════════════════════════════════
  Total fetched:    7500
  Total normalized: 6800
  Total inserted:   6200
  Total skipped:    600
  Total errors:     0
  Elapsed time:     87.3s
═══════════════════════════════════════════════════════
```

---

## Key PostgreSQL INSERT

```sql
INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating,
  created_at, updated_at
)
VALUES (
  $1, $2, $3, $4, $5, $6,
  ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
  $7::jsonb, $8, $9, $10, $11, $12,
  $13, $14, $15, $16,
  NOW(), NOW()
)
ON CONFLICT (source, source_id) DO NOTHING
```

- `ST_MakePoint(longitude, latitude)` — note: lon comes first in PostGIS
- `::geography` — stores as WGS84 geography for accurate distance queries
- `ON CONFLICT DO NOTHING` — safe to re-run; never creates duplicates

---

## PostGIS Proximity Query Example

Find the 10 nearest springs to a given point:

```sql
SELECT
  name,
  category,
  region_id,
  ST_Distance(
    geom,
    ST_MakePoint(34.78, 32.08)::geography
  ) AS dist_meters
FROM locations
WHERE category = 'מעיין'
ORDER BY dist_meters ASC
LIMIT 10;
```

---

## Additional Israeli Nature Data Sources

| Source | URL | Content |
|---|---|---|
| INPA (רשות הטבע והגנים) | https://www.parks.org.il | Nature reserves & national parks official data |
| Israel Antiquities Authority | https://www.iaa.org.il | Archaeological sites across Israel |
| Survey of Israel (מפ"י) | https://www.mapi.gov.il | Topographic data, trails, elevation |
| iNaturalist Israel | https://www.inaturalist.org/places/israel | Biodiversity observation points |
| Wikidata | https://www.wikidata.org | Structured data for named natural features |
| Ministry of Tourism | https://goisrael.com | Tourist-facing location database |
| SPNI (החברה להגנת הטבע) | https://www.teva.org.il | Trail data, bird watching sites, nature sites |
| OpenAerialMap | https://openaerialmap.org | Aerial imagery for context |
| Nakdan (נקדן) | Internal survey data | Geological formations & craters |
| GovMap | https://www.govmap.gov.il/govmap/api | Multi-layer Israeli government spatial data |

### GovMap API tip

GovMap exposes a REST API with many layers:

```bash
# Example: fetch national parks layer
curl "https://www.govmap.gov.il/govmap/api/MapServer/0/query?where=1=1&outFields=*&f=json"
```

---

## Deduplication Strategy

The pipeline uses two layers of deduplication:

1. **DB-level**: `UNIQUE(source, source_id)` with `ON CONFLICT DO NOTHING`
2. **Source-level**: iHike fetcher deduplicates by ID before inserting

For near-duplicate detection across sources (e.g. same spring in both OSM and Gov data), you can run this post-ETL query:

```sql
-- Find locations within 50m of each other from different sources
SELECT
  a.id, a.name, a.source,
  b.id, b.name, b.source,
  ST_Distance(a.geom, b.geom) AS dist_meters
FROM locations a
JOIN locations b
  ON a.source <> b.source
  AND ST_DWithin(a.geom, b.geom, 50)
  AND a.id < b.id
ORDER BY dist_meters;
```

---

## Scheduling (cron example)

Re-run monthly to pick up new OSM edits and government data updates:

```cron
# Run ETL on the 1st of each month at 3 AM
0 3 1 * * cd /app/israel-nature-etl && node scripts/fetchLocations.js >> /var/log/etl.log 2>&1
```
