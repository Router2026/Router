// ── Region ─────────────────────────────────────────────────────────────────
export interface Region {
  id: number;
  name: string;
  name_en: string;
  slug: string;
  center_lat: number;
  center_lng: number;
  zoom: number;
  radius_meters: number;
  color: string;
  created_at: Date;
}

// ── Location (POI) ─────────────────────────────────────────────────────────
export interface Location {
  id: number;
  name: string;
  description: string;
  category: string;
  region_id: number;
  region_name?: string;
  latitude: number;
  longitude: number;
  images: string[];
  main_image?: string;
  source: 'kkl' | 'inpa' | 'osm' | 'manual' | 'seed';
  source_id?: string;
  difficulty?: string;
  duration_minutes?: number;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  average_rating: number;
  created_at: Date;
  updated_at: Date;
}

// ── Route ──────────────────────────────────────────────────────────────────
export interface Route {
  id: number;
  name: string;
  description: string;
  region_id: number;
  total_distance_km: number;
  total_duration_hours: number;
  difficulty: string;
  group_type: string;
  style: string;
  created_at: Date;
}

// ── RouteStop ──────────────────────────────────────────────────────────────
export interface RouteStop {
  id: number;
  route_id: number;
  location_id: number;
  location_name?: string;
  order_index: number;
  arrival_time: string;
  duration_minutes: number;
  smart_insight: string;
}

// ── User ───────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  xp_points: number;
  level: string;
  reports_count: number;
  reviews_count: number;
  trips_count: number;
  created_at: Date;
}

// ── Sync Job Status ────────────────────────────────────────────────────────
export interface SyncStatus {
  jobId: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalLocations: number;
  processedLocations: number;
  progressPercentage: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ── Cluster ────────────────────────────────────────────────────────────────
export interface Cluster {
  lat: number;
  lng: number;
  count: number;
  ids: number[];
  category?: string;
}

// ── API Query Params ───────────────────────────────────────────────────────
export interface LocationQuery {
  region?: string;
  category?: string;
  difficulty?: string;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
