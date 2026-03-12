# Router — Full-Stack Setup Guide

This project has been upgraded from a mock-data frontend to a full backend + database system.

---

## Architecture

```
frontend/          ← React + Vite + TypeScript (already existed)
backend/           ← Node.js + Express + TypeScript (new)
  ├── src/
  │   ├── config/   (PostgreSQL + Redis connections)
  │   ├── models/   (TypeScript interfaces)
  │   ├── routes/   (Express route handlers)
  │   ├── services/ (DB query logic)
  │   ├── jobs/     (BullMQ background workers)
  │   ├── ingestion/(OSM, INPA, KKL data fetchers)
  │   └── middleware/
  ├── migrations/   (SQL migration files)
  ├── Dockerfile
  └── docker-compose.yml
```

**Stack:**
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL 15 + PostGIS (spatial queries)
- Cache: Redis 7 (map queries cached 30s)
- Jobs: BullMQ (background data ingestion)
- Data sources: OpenStreetMap (Overpass), Israel gov open data (INPA, KKL)

---

## Quick Start (Docker — recommended)

### 1. Start infrastructure

```bash
cd backend
docker-compose up -d postgres redis
```

### 2. Install dependencies & run migrations

```bash
cd backend
npm install
cp .env.example .env
npm run migrate
```

### 3. Start the backend

```bash
npm run dev
# Server on http://localhost:3001
```

### 4. Start the frontend

```bash
cd ..   # root of project
npm install
cp .env.example .env   # contains VITE_API_URL=http://localhost:3001
npm run dev
# App on http://localhost:5173
```

---

## Run everything with Docker Compose

```bash
cd backend
docker-compose up --build
```

This starts:
- PostgreSQL + PostGIS on port 5432
- Redis on port 6379
- Backend API on port 3001

---

## Database Migrations

Migrations run automatically on startup via `npm run migrate`.

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Creates tables: regions, locations, routes, route_stops, users, sync_jobs |
| `002_seed_regions.sql`   | Seeds all 13 Israeli regions with polygon boundaries |
| `003_seed_locations.sql` | Seeds 25 hand-curated real Israeli nature locations |

---

## API Endpoints

### Locations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/locations` | All locations (with filters) |
| GET | `/locations?region=גולן` | Filter by region name or slug |
| GET | `/locations?category=טבע` | Filter by category |
| GET | `/locations?has_water=true` | Feature filter |
| GET | `/locations?search=בניאס` | Text search |
| GET | `/locations/:id` | Single location |
| GET | `/locations/map?north=&south=&east=&west=` | Viewport query (PostGIS) |
| GET | `/locations/clusters` | Clustered points for map |

### Regions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/regions` | All regions with metadata |
| GET | `/regions/:slug` | Single region (e.g. `/regions/golan`) |

### Data Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sync/osm` | Ingest from OpenStreetMap (recommended) |
| POST | `/sync/inpa` | Ingest from INPA via gov data portal |
| POST | `/sync/kkl` | Ingest from KKL via gov data portal |
| GET | `/sync/status` | Check job progress |

---

## Ingesting Real Data

After starting the backend, trigger a data sync:

```bash
# Fetch nature locations from OpenStreetMap (fastest, most complete)
curl -X POST http://localhost:3001/sync/osm

# Check progress
curl http://localhost:3001/sync/status
```

This will add hundreds of real nature locations from OpenStreetMap's Israel dataset.

---

## Caching

- **Map viewport queries** → Redis, TTL 30 seconds
- **Location list queries** → Redis, TTL 5 minutes  
- **Region list** → Redis, TTL 1 hour

Cache is bypassed gracefully if Redis is unavailable.

---

## Frontend Changes

The following files were updated:

### `src/api.ts` (full rewrite)
- Replaces mock `base44` with real HTTP calls to the backend
- `api.locations.list(params)` — fetch with filters
- `api.locations.get(id)` — single location
- `api.locations.inBounds(bounds)` — map viewport
- `api.regions.list()` — all regions
- Legacy `base44` shim preserved for backward compatibility

### `src/pages/MapView.tsx`
- Regions loaded dynamically from `/regions` API
- POIs fetched per-region from `/locations?region=...`
- Falls back to static regions if backend unavailable

### `src/pages/Explore.tsx`
- Filters sent to backend as query params
- Backend handles search, category, region, feature filters

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=router_db
DB_USER=router_user
DB_PASSWORD=router_pass
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
MAP_CACHE_TTL=30
LIST_CACHE_TTL=300
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:3001
```

---

## Example API Responses

### GET /locations?region=גולן

```json
{
  "data": [
    {
      "id": 1,
      "name": "מפל הבניאס",
      "description": "מפל מרהיב הזורם לכל אורך השנה...",
      "category": "טבע",
      "region_name": "גולן",
      "latitude": 33.249,
      "longitude": 35.694,
      "images": ["https://..."],
      "main_image": "https://...",
      "difficulty": "קל",
      "duration_minutes": 90,
      "has_water": true,
      "has_shade": true,
      "average_rating": 4.8
    }
  ],
  "total": 5
}
```

### GET /locations/map?north=33.4&south=32.9&east=35.9&west=35.5

```json
{
  "data": [ ... locations inside the map bounds ... ],
  "total": 12
}
```

### GET /sync/status

```json
{
  "jobId": "osm-1706000000000",
  "source": "osm",
  "status": "completed",
  "totalLocations": 243,
  "processedLocations": 243,
  "progressPercentage": 100
}
```
