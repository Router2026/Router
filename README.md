# 🧭 Router - Israel's Smart Travel Platform

Router is an innovative "One-Stop-Shop" platform for the Israeli traveler, combining advanced trip planning capabilities, field navigation, and a location-based social network. The application solves the problem of scattered information by making data on nature trails, attractions, culinary options, and logistics accessible in one place, using Artificial Intelligence (AI) to build personalized itineraries.

## ✨ Key Features

* **🗺️ Smart Discovery Map:** An interactive map divided into regions, with information layers (springs, trails, culinary) and real-time insights on crowds and weather.
* **🤖 AI-Powered Trip Planner:** Building a full, customized itinerary (by region, participant composition, and style) integrated with a smart algorithm that optimally arranges the stops.
* **ℹ️ Comprehensive Site Information:** Detailed information cards including difficulty level, stroller accessibility, shade index, and dog-friendly status.
* **🏆 Community & Gamification:** An incentive model encouraging users to report from the field, write reviews, and upload photos in exchange for points (XP) and leveling up.
* **🎥 Content Creators Social Network:** Uploading video clips, sharing routes, and following other travelers.

## 🛠️ Technologies

**Frontend:**
* React + TypeScript + Vite
* React Router DOM (Navigation)
* Leaflet + React-Leaflet (Maps)
* Material-UI (MUI) & Lucide React (Design & Icons)

**Backend & AI:**
* Node.js (Request and user management)
* Python Microservice (LLM model communication and route processing)
* Firebase Auth / Auth0 (User authentication)

**Database:**
* PostgreSQL + PostGIS (For smart spatial geographic queries)

---

## 🚀 Installation Technologies and Setup

**Backend (Next.js fullstack app in `backend/`):**

- Next.js 16 + React 19 + TypeScript
- Drizzle ORM + PostgreSQL (Supabase)
- Custom JWT authentication + Nodemailer
- Multi-provider LLM support: Ollama, OpenAI, Anthropic
- Leaflet / React-Leaflet (maps), MUI (UI components)

**Frontend (standalone Vite app in `frontend/`):**

- React + TypeScript + Vite
- Leaflet + React-Leaflet
- Material-UI (MUI) & Lucide React

**Database:** Supabase (hosted PostgreSQL)

---

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- For AI: Ollama running locally, or an OpenAI/Anthropic API key

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)
npm run dev
```

The backend runs at `http://localhost:3000`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

### 3. Database Setup

The project uses [Drizzle ORM](https://orm.drizzle.team) against a Supabase PostgreSQL database.

```bash
cd backend

# Push schema to your Supabase database
npm run db:push

# (Optional) Seed initial data
npm run db:seed
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

| Variable | Description |
| --- | --- |
| `LLM_PROVIDER` | `ollama`, `openai`, or `anthropic` |
| `OLLAMA_BASE_URL` | Ollama API base URL (default: `http://localhost:11434/v1`) |
| `OLLAMA_MODEL` | Ollama model name (e.g. `llama3.1:8b`) |
| `OPENAI_API_KEY` | Required if `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | Required if `LLM_PROVIDER=anthropic` |
| `SUPABASE_URL` | From Supabase → Project Settings → API |
| `SUPABASE_KEY` | Supabase anon/public key |
| `DATABASE_URL` | Supabase transaction pooler connection string |
| `JWT_SECRET` | Secret for signing user auth tokens |
| `SMTP_*` | SMTP credentials for sending email (optional — logs to console if unset) |
| `APP_URL` | Frontend URL (used in email links) |
| `OVERPASS_API_URL` | Overpass API endpoint for OSM data |

---

## Database Commands

```bash
npm run db:push          # Push schema changes to DB
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio (visual DB browser)
npm run db:seed          # Seed initial location data
```
