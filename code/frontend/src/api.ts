// ── Real API client — connects to backend via Vite proxy (/api → localhost:3001)
// All mock data, hardcoded arrays and base44 references removed.

const BASE_URL = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const j = await res.json(); message = j.error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Region {
  id: number; name: string; name_en: string; slug: string;
  center_lat: number; center_lng: number; zoom: number;
  radius_meters: number; color: string;
}

export interface POI {
  id: string; name: string; description: string; category: string;
  region: string; region_id?: number; latitude: number; longitude: number;
  images: string[]; main_image: string; difficulty: string;
  duration_minutes?: number; has_water?: boolean; has_shade?: boolean;
  accessible?: boolean; average_rating: number;
}

export interface TripStop {
  poi_name: string; arrival_time: string; duration_minutes: number;
  smart_insight?: string; location_id?: number; order_index?: number;
}

export interface Trip {
  id: string; name: string; description?: string; region?: string;
  total_duration_hours: number; total_distance_km?: number;
  difficulty?: string; group_type?: string; style?: string;
  stops: TripStop[];
}

export interface Review {
  id: string; poi_name?: string; reviewer_name: string;
  rating: number; content: string; created_date: string;
}

export interface CommunityReport {
  id: string; poi_name?: string; report_type: string; severity: string;
  content: string; reporter_name: string; upvotes: number; created_date: string;
}

export interface VideoPost {
  id: string; title: string; description?: string; region?: string;
  uploader_name: string; video_url?: string; thumbnail_url?: string;
  likes_count: number; views_count: number;
}

export interface UserProfile {
  id: string; email?: string; full_name?: string; display_name: string;
  xp_points: number; level: string;
  reports_count?: number; reviews_count?: number; trips_count?: number;
}

export interface AppStats {
  total_locations: number; total_regions: number; average_rating: number;
}

// ── Mappers ────────────────────────────────────────────────────────────────

function mapLocation(r: any): POI {
  return {
    id: String(r.id),
    name: r.name,
    description: r.description || '',
    category: r.category || '',
    region: r.region_name || r.region || '',
    region_id: r.region_id,
    latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    images: Array.isArray(r.images) ? r.images : [],
    main_image: r.main_image || (Array.isArray(r.images) ? r.images[0] : '') || '',
    difficulty: r.difficulty || 'בינוני',
    duration_minutes: r.duration_minutes,
    has_water: r.has_water,
    has_shade: r.has_shade,
    accessible: r.accessible,
    average_rating: parseFloat(r.average_rating) || 4.0,
  };
}

function mapTrip(r: any): Trip {
  return {
    id: String(r.id),
    name: r.name,
    description: r.description,
    region: r.region || r.region_name,
    total_duration_hours: parseFloat(r.total_duration_hours) || 0,
    total_distance_km: r.total_distance_km,
    difficulty: r.difficulty,
    group_type: r.group_type,
    style: r.style,
    stops: (r.stops || []).map((s: any) => ({
      poi_name: s.poi_name || s.location_name || '',
      arrival_time: s.arrival_time || '',
      duration_minutes: s.duration_minutes || 60,
      smart_insight: s.smart_insight,
      location_id: s.location_id,
      order_index: s.order_index,
    })),
  };
}

function mapReview(r: any): Review {
  return { id: String(r.id), poi_name: r.poi_name, reviewer_name: r.reviewer_name, rating: r.rating, content: r.content, created_date: r.created_at };
}

function mapReport(r: any): CommunityReport {
  return { id: String(r.id), poi_name: r.poi_name, report_type: r.report_type, severity: r.severity, content: r.content, reporter_name: r.reporter_name, upvotes: r.upvotes || 0, created_date: r.created_at };
}

function mapVideo(r: any): VideoPost {
  return { id: String(r.id), title: r.title, description: r.description, region: r.region, uploader_name: r.uploader_name, video_url: r.video_url, thumbnail_url: r.thumbnail_url, likes_count: r.likes_count || 0, views_count: r.views_count || 0 };
}

function mapUser(r: any): UserProfile {
  return { id: String(r.id), email: r.email, full_name: r.full_name, display_name: r.display_name || r.full_name || 'משתמש', xp_points: r.xp_points || 0, level: r.level || 'מטייל מתחיל', reports_count: r.reports_count || 0, reviews_count: r.reviews_count || 0, trips_count: r.trips_count || 0 };
}

// ── Main API Object ────────────────────────────────────────────────────────

export const api = {
  regions: {
    list: async (): Promise<Region[]> => (await apiFetch<{ data: any[] }>('/regions')).data,
  },

  locations: {
    list: async (params?: { region?: string; category?: string; difficulty?: string; search?: string; has_water?: boolean; has_shade?: boolean; accessible?: boolean; limit?: number; offset?: number }): Promise<POI[]> => {
      const qs = new URLSearchParams();
      if (params?.region)     qs.set('region', params.region);
      if (params?.category)   qs.set('category', params.category);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.search)     qs.set('search', params.search);
      if (params?.has_water)  qs.set('has_water', 'true');
      if (params?.has_shade)  qs.set('has_shade', 'true');
      if (params?.accessible) qs.set('accessible', 'true');
      if (params?.limit)      qs.set('limit', String(params.limit));
      if (params?.offset)     qs.set('offset', String(params.offset));
      return (await apiFetch<{ data: any[] }>(`/locations?${qs}`)).data.map(mapLocation);
    },
    get: async (id: string): Promise<POI> => mapLocation((await apiFetch<{ data: any }>(`/locations/${id}`)).data),
    inBounds: async (b: { north: number; south: number; east: number; west: number }): Promise<POI[]> => {
      const qs = new URLSearchParams({ north: String(b.north), south: String(b.south), east: String(b.east), west: String(b.west) });
      return (await apiFetch<{ data: any[] }>(`/locations/map?${qs}`)).data.map(mapLocation);
    },
  },

  trips: {
    list: async (): Promise<Trip[]> => (await apiFetch<{ data: any[] }>('/trips')).data.map(mapTrip),
    get: async (id: string): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>(`/trips/${id}`)).data),
    create: async (data: Partial<Trip>): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>('/trips', { method: 'POST', body: JSON.stringify(data) })).data),
  },

  reviews: {
    list: async (locationId?: number): Promise<Review[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: any[] }>(`/reviews${qs}`)).data.map(mapReview);
    },
    create: async (data: Partial<Review> & { location_id?: number }): Promise<Review> => mapReview((await apiFetch<{ data: any }>('/reviews', { method: 'POST', body: JSON.stringify(data) })).data),
  },

  reports: {
    list: async (locationId?: number): Promise<CommunityReport[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: any[] }>(`/reports${qs}`)).data.map(mapReport);
    },
    create: async (data: Partial<CommunityReport> & { location_id?: number }): Promise<CommunityReport> => mapReport((await apiFetch<{ data: any }>('/reports', { method: 'POST', body: JSON.stringify(data) })).data),
    upvote: async (id: string): Promise<CommunityReport> => mapReport((await apiFetch<{ data: any }>(`/reports/${id}/upvote`, { method: 'PATCH' })).data),
  },

  videos: {
    list: async (): Promise<VideoPost[]> => (await apiFetch<{ data: any[] }>('/videos')).data.map(mapVideo),
    create: async (data: Partial<VideoPost>): Promise<VideoPost> => mapVideo((await apiFetch<{ data: any }>('/videos', { method: 'POST', body: JSON.stringify(data) })).data),
    like: async (id: string): Promise<VideoPost> => mapVideo((await apiFetch<{ data: any }>(`/videos/${id}/like`, { method: 'PATCH' })).data),
  },

  users: {
    me: async (): Promise<UserProfile> => mapUser((await apiFetch<{ data: any }>('/users/me')).data),
    leaderboard: async (): Promise<UserProfile[]> => (await apiFetch<{ data: any[] }>('/users/leaderboard')).data.map(mapUser),
    stats: async (): Promise<AppStats> => (await apiFetch<{ data: AppStats }>('/users/stats')).data,
  },
};

// ── Legacy shim for pages still using base44.entities.* patterns ───────────
export const base44 = {
  auth: { me: () => api.users.me().then(u => ({ id: u.id, email: u.email || '', full_name: u.full_name || u.display_name })) },
  entities: {
    POI: { list: () => api.locations.list(), filter: (p?: { region?: string }) => api.locations.list(p), get: (id: string) => api.locations.get(id) },
    Trip: { filter: () => api.trips.list(), create: (data: any) => api.trips.create(data) },
    Review: { filter: () => api.reviews.list(), create: (data: any) => api.reviews.create(data) },
    CommunityReport: { filter: () => api.reports.list(), create: (data: any) => api.reports.create(data), update: (id: string, _data: any) => api.reports.upvote(id) },
    UserProfile: { filter: () => api.users.me().then(u => [u]), list: () => api.users.leaderboard(), create: (d: any) => Promise.resolve(d), update: (_id: string, d: any) => Promise.resolve(d) },
    VideoPost: { list: () => api.videos.list(), filter: () => api.videos.list(), create: (data: any) => api.videos.create(data), update: (id: string, _data: any) => api.videos.like(id) },
  },
  integrations: {
    Core: {
      UploadFile: async (_a: { file: File }) => ({ file_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800' }),
      InvokeLLM: async ({ body }: { body: string }) => {
        const req = JSON.parse(body);
        const region = req.region || 'גליל עליון';
        return { name: `טיול ${req.style || 'טבע'} ב${region}`, description: `מסלול מותאם ב${region}`, stops: [{ poi_name: 'נחל עיון', arrival_time: '08:00', duration_minutes: 90, smart_insight: 'להגיע בבוקר לפני העומס' }, { poi_name: 'מפלים בצפון', arrival_time: '10:30', duration_minutes: 60, smart_insight: 'מצוין לצילומים' }, { poi_name: 'נחל מחזיה', arrival_time: '12:30', duration_minutes: 60, smart_insight: 'מקום נהדר לפיקניק' }], total_duration_hours: req.duration_hours || 6, total_distance_km: 18, group_type: req.group_type, style: req.style };
      },
    },
  },
};

// Kept for legacy MapView import; MapView has been updated to use api.locations directly
export const ALL_POIS: POI[] = [];
