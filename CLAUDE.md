# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Router is an Israeli travel platform — a monorepo with three independent applications:
- **`backend/`** — Next.js 16 fullstack app (API + admin UI), runs on port 3000
- **`frontend/`** — Vite React SPA, runs on port 5173 (proxies `/api/*` to backend)
- **`fetchDataLocations/`** — Node.js ETL pipeline for ingesting Israeli location data

## Commands

### Backend (`cd backend/`)
```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Push Drizzle schema changes to DB
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio (visual DB explorer)
npm run db:seed      # Seed database
```

### Frontend (`cd frontend/`)
```bash
npm run dev          # Vite dev server on localhost:5173
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### ETL Pipeline (`cd fetchDataLocations/`)
```bash
npm start            # Full ETL (all sources)
npm run dry-run      # Test without DB writes
npm run osm-only     # OpenStreetMap only
npm run gov-only     # data.gov.il only
npm run kkl-only     # KKL-JNF only
npm run ihike-only   # Israel Hiking Map only
```

## Architecture

### Backend (`backend/src/`)
- **`app/api/`** — Next.js route handlers, organized by feature (auth, ai, locations, regions, trips, users, videos, reports, reviews, community-pois, trip-bucket, routes, admin)
- **`lib/db/schema.ts`** — Drizzle ORM schema (14 tables): `locations`, `regions`, `routes`, `routeStops`, `routerUsers`, `reviews`, `communityReports`, `videoPosts`, etc.
- **`lib/llm/`** — LLM provider abstraction with factory pattern; provider selected via `LLM_PROVIDER` env var (ollama/openai/anthropic)
- **`lib/`** — Feature modules mirror `app/api/` structure (locations, trips, users, auth, reviews, reports, etc.)
- TypeScript path alias: `@/*` maps to `src/*`

### Frontend (`frontend/src/`)
- **`pages/`** — Route-level components (MapView, TripPlanner, RouteGenerator, etc.)
- **`components/`** — Shared components (Layout, TripBucketFab, TripBucketSheet)
- **`context/`** — React Context: `AuthContext` (JWT management), `TripBucketContext` (saved trips)
- **`api.ts`** — Centralized Fetch-based HTTP client with auth headers

### Data & State
- **Database**: PostgreSQL via Supabase with PostGIS for geospatial queries (`ST_DWithin`, `ST_Distance`)
- **ORM**: Drizzle ORM — schema-first, TypeScript-safe
- **Auth**: Custom JWT stored in localStorage; `AuthContext` handles token lifecycle
- **Frontend state**: React Context API + local component state (no Redux/Zustand in frontend)
- **Backend state**: Stateless API — all state in PostgreSQL

## Environment Setup

Copy `backend/.env.example` to `backend/.env`. Key variables:
- `LLM_PROVIDER` — `ollama`, `openai`, or `anthropic`
- `DATABASE_URL` — PostgreSQL connection string
- `SUPABASE_URL` / `SUPABASE_KEY` — Supabase project credentials
- `JWT_SECRET` — Token signing secret
- `SMTP_*` — Email configuration for auth flows
