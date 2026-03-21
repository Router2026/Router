// src/api.ts — UPDATED: all 11 feature changes

const BASE_URL = '/api';

let _token: string | null = null;
export function setAuthToken(t: string | null) { _token = t; }
export function getAuthToken() { return _token; }

class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

const TOKEN_KEY = 'router_auth_token';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _token ?? localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try { const j = await res.json(); message = j.error?.message || j.error || message; code = j.error?.code; } catch { }
    throw new ApiError(message, code);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Region {
  id: number; name: string; name_en: string; slug: string;
  center_lat: number; center_lng: number; zoom: number;
  radius_meters: number; color: string;
  polygon_coords: [number, number][] | null;
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
  id: string; poi_name?: string; location_id?: number; report_type: string;
  severity: string; content: string; reporter_name: string;
  upvotes: number; created_date: string;
}

export interface VideoPost {
  id: string; title: string; description?: string; region?: string;
  uploader_name: string; video_url?: string; thumbnail_url?: string;
  likes_count: number; views_count: number;
}

export interface UserProfile {
  id: string; email?: string; full_name?: string; username: string;
  xp_points: number; xp?: number; level: string; level_number?: number;
  is_admin?: boolean; bio?: string; avatar_url?: string; cover_image?: string;
  favorite_regions?: string[]; instagram?: string; website?: string;
  reports_count?: number; reviews_count?: number; trips_count?: number;
}

export interface AppStats {
  total_locations: number; total_regions: number; average_rating: number;
}

export interface CommunityPoiSubmission {
  id: number; user_id: number | null; name: string; category: string;
  description: string | null; latitude: number; longitude: number;
  photos: string[]; status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null; reviewed_at: string | null; created_at: string;
}

export interface LocationImage {
  id: number; user_id: number; location_id: number;
  image_url: string; is_approved: boolean; created_at: string; username?: string;
}

export interface XpResult {
  new_xp: number; new_level: number; level_label: string; leveled_up: boolean;
}

export interface UploadImageResponse {
  image: LocationImage; xp: XpResult; limit: number;
}

export interface PublicTripLocation {
  id: number; location_id: number; name: string; category: string;
  latitude: number; longitude: number; main_image: string | null;
  order_index: number; region_name?: string; difficulty?: string;
}

export interface PublicTrip {
  id: number; user_id: number; title: string; description: string | null;
  route_geojson: object | null; is_public: boolean; created_at: string;
  creator_username: string; creator_avatar: string | null;
  creator_xp: number; location_count: number; locations: PublicTripLocation[];
}

export interface FavoriteLocation {
  id: number; user_id: number; location_id: number; created_at: string;
  name?: string; category?: string; region_name?: string;
  latitude?: number; longitude?: number;
  main_image?: string; difficulty?: string; average_rating?: number;
}

export interface ShareTripResult {
  shared: boolean; xp_awarded: boolean; xp: XpResult | null;
}

// ── Mapper helpers ─────────────────────────────────────────────────────────

function mapLocation(r: any): POI {
  return {
    id: String(r.id), name: r.name, description: r.description || '',
    category: r.category, region: r.region_name || r.region || '',
    region_id: r.region_id, latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    images: Array.isArray(r.images) ? r.images : (typeof r.images === 'string' ? JSON.parse(r.images) : []),
    main_image: r.main_image || '', difficulty: r.difficulty || 'בינוני',
    duration_minutes: r.duration_minutes, has_water: r.has_water,
    has_shade: r.has_shade, accessible: r.accessible,
    average_rating: parseFloat(r.average_rating) || 4.0,
  };
}

function mapTrip(r: any): Trip {
  return {
    id: String(r.id), name: r.name, description: r.description,
    region: r.region || r.region_name,
    total_duration_hours: parseFloat(r.total_duration_hours) || 0,
    total_distance_km: r.total_distance_km, difficulty: r.difficulty,
    group_type: r.group_type, style: r.style,
    stops: (r.stops || []).map((s: any) => ({
      poi_name: s.poi_name || s.location_name || '', arrival_time: s.arrival_time || '',
      duration_minutes: s.duration_minutes || 60, smart_insight: s.smart_insight,
      location_id: s.location_id, order_index: s.order_index,
    })),
  };
}

function mapReview(r: any): Review {
  return { id: String(r.id), poi_name: r.poi_name, reviewer_name: r.reviewer_name, rating: r.rating, content: r.content, created_date: r.created_at };
}

function mapReport(r: any): CommunityReport {
  return { id: String(r.id), poi_name: r.poi_name, location_id: r.location_id, report_type: r.report_type, severity: r.severity, content: r.content, reporter_name: r.reporter_name, upvotes: r.upvotes || 0, created_date: r.created_at };
}

function mapVideo(r: any): VideoPost {
  return { id: String(r.id), title: r.title, description: r.description, region: r.region, uploader_name: r.uploader_name, video_url: r.video_url, thumbnail_url: r.thumbnail_url, likes_count: r.likes_count || 0, views_count: r.views_count || 0 };
}

function mapUser(r: any): UserProfile {
  const xp = r.xp ?? r.xp_points ?? 0;
  return {
    id: String(r.id), email: r.email, full_name: r.full_name,
    username: r.username || r.display_name || 'user',
    xp_points: xp, xp,
    level: r.level || 'מטייל מתחיל',
    level_number: r.level_number ?? Math.floor(Math.sqrt(xp / 50)),
    is_admin: r.is_admin ?? false,
    bio: r.bio, avatar_url: r.avatar_url, cover_image: r.cover_image,
    favorite_regions: r.favorite_regions, instagram: r.instagram, website: r.website,
    reports_count: r.reports_count || 0,
    reviews_count: r.reviews_count || 0,
    trips_count:   r.trips_count   || 0,
  };
}

// ── Main API Object ────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────
  auth: {
    login: async (email: string, password: string): Promise<{ user: UserProfile; token: string }> => {
      const res = await apiFetch<{ data: { user: any; token: string } }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      return { user: mapUser(res.data.user), token: res.data.token };
    },
    register: async (email: string, password: string, full_name: string, username: string): Promise<{ requiresVerification: true }> => {
      await apiFetch<{ data: any }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, full_name, username }),
      });
      return { requiresVerification: true };
    },
    checkUsername: async (username: string): Promise<boolean> => {
      const res = await apiFetch<{ data: { available: boolean } }>(`/auth/check-username?username=${encodeURIComponent(username)}`);
      return res.data.available;
    },
    verifyEmail: async (token: string): Promise<{ user: UserProfile; token: string }> => {
      const res = await apiFetch<{ data: { user: any; token: string } }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
      return { user: mapUser(res.data.user), token: res.data.token };
    },
    resendVerification: async (email: string): Promise<void> => {
      await apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
    },
    forgotPassword: async (email: string): Promise<void> => {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    },
    resetPassword: async (token: string, password: string): Promise<{ token: string }> => {
      const res = await apiFetch<{ data: { token: string } }>('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token, password }),
      });
      return { token: res.data.token };
    },
    me: async (token?: string): Promise<UserProfile> => {
      const savedToken = _token;
      if (token) _token = token;
      try {
        const res = await apiFetch<{ data: any }>('/auth/me');
        return mapUser(res.data);
      } finally {
        _token = savedToken;
      }
    },
  },

  // ── Regions ──────────────────────────────────────────────────
  regions: {
    list: async (): Promise<Region[]> => (await apiFetch<{ data: any[] }>('/regions')).data,
  },

  // ── Locations ────────────────────────────────────────────────
  locations: {
    list: async (params?: {
      region?: string; category?: string; difficulty?: string; search?: string;
      has_water?: boolean; has_shade?: boolean; accessible?: boolean;
      limit?: number; offset?: number;
    }): Promise<POI[]> => {
      const qs = new URLSearchParams();
      if (params?.region)     qs.set('region',     params.region);
      if (params?.category)   qs.set('category',   params.category);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.search)     qs.set('search',     params.search);
      if (params?.has_water)  qs.set('has_water',  'true');
      if (params?.has_shade)  qs.set('has_shade',  'true');
      if (params?.accessible) qs.set('accessible', 'true');
      if (params?.limit)      qs.set('limit',  String(params.limit));
      if (params?.offset)     qs.set('offset', String(params.offset));
      return (await apiFetch<{ data: any[] }>(`/locations?${qs}`)).data.map(mapLocation);
    },
    get: async (id: string): Promise<POI> => mapLocation((await apiFetch<{ data: any }>(`/locations/${id}`)).data),
    update: async (id: string | number, data: Partial<POI> & { images?: string[] }): Promise<POI> =>
      mapLocation((await apiFetch<{ data: any }>(`/locations/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      })).data),
    inBounds: async (b: { north: number; south: number; east: number; west: number }): Promise<POI[]> => {
      const qs = new URLSearchParams({ north: String(b.north), south: String(b.south), east: String(b.east), west: String(b.west) });
      return (await apiFetch<{ data: any[] }>(`/locations/map?${qs}`)).data.map(mapLocation);
    },
    getImages: async (locationId: string | number): Promise<LocationImage[]> =>
      (await apiFetch<{ data: LocationImage[] }>(`/locations/${locationId}/images`)).data,
    // URL upload
    uploadImage: async (locationId: string | number, imageUrl: string): Promise<UploadImageResponse> =>
      (await apiFetch<{ data: UploadImageResponse }>(`/locations/${locationId}/images`, {
        method: 'POST', body: JSON.stringify({ image_url: imageUrl }),
      })).data,
    // File upload (base64)
    uploadImageFile: async (locationId: string | number, file: File): Promise<UploadImageResponse> => {
      const base64 = await fileToBase64(file);
      return (await apiFetch<{ data: UploadImageResponse }>(`/locations/${locationId}/images`, {
        method: 'POST',
        body: JSON.stringify({ image_data: base64, mime_type: file.type }),
      })).data;
    },
    approveImage: async (locationId: string | number, imageId: number): Promise<LocationImage> =>
      (await apiFetch<{ data: LocationImage }>(`/locations/${locationId}/images/${imageId}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'approve' }),
      })).data,
    rejectImage: async (locationId: string | number, imageId: number): Promise<void> => {
      await apiFetch(`/locations/${locationId}/images/${imageId}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'reject' }),
      });
    },
    deleteImage: async (locationId: string | number, imageId: number): Promise<void> => {
      await apiFetch(`/locations/${locationId}/images/${imageId}`, { method: 'DELETE' });
    },
  },

  // ── Trips (AI generator routes) ──────────────────────────────
  trips: {
    list: async (): Promise<Trip[]> => (await apiFetch<{ data: any[] }>('/routes')).data.map(mapTrip),
    get: async (id: string): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>(`/routes/${id}`)).data),
    create: async (data: Partial<Trip>): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>('/routes', { method: 'POST', body: JSON.stringify(data) })).data),
    delete: async (id: string): Promise<void> => { await apiFetch(`/routes/${id}`, { method: 'DELETE' }); },
    // Feature 9: share trip & earn XP
    share: async (id: string): Promise<ShareTripResult> =>
      (await apiFetch<{ data: ShareTripResult }>(`/routes/${id}/share`, { method: 'POST' })).data,
  },

  // ── Public trips ─────────────────────────────────────────────
  publicTrips: {
    list: async (params?: { region?: string; difficulty?: string; limit?: number; offset?: number }): Promise<PublicTrip[]> => {
      const qs = new URLSearchParams();
      if (params?.region)     qs.set('region',     params.region);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.limit)      qs.set('limit',  String(params.limit));
      if (params?.offset)     qs.set('offset', String(params.offset));
      return (await apiFetch<{ data: PublicTrip[] }>(`/trips/public?${qs}`)).data;
    },
    get: async (id: number): Promise<PublicTrip> =>
      (await apiFetch<{ data: PublicTrip }>(`/trips/public/${id}`)).data,
    create: async (data: {
      title: string; description?: string;
      route_geojson?: object; is_public?: boolean; location_ids?: number[];
    }): Promise<PublicTrip> =>
      (await apiFetch<{ data: PublicTrip }>('/trips/public', { method: 'POST', body: JSON.stringify(data) })).data,
    myTrips: async (): Promise<{ id: number; title: string; description: string | null; is_public: boolean; created_at: string; location_count: number }[]> =>
      (await apiFetch<{ data: any[] }>('/users/me/trips')).data,
  },

  // ── Reviews ──────────────────────────────────────────────────
  reviews: {
    list: async (locationId?: number): Promise<Review[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: any[] }>(`/reviews${qs}`)).data.map(mapReview);
    },
    create: async (data: Partial<Review> & { location_id?: number }): Promise<Review> =>
      mapReview((await apiFetch<{ data: any }>('/reviews', { method: 'POST', body: JSON.stringify(data) })).data),
    myReviews: async (): Promise<Review[]> =>
      (await apiFetch<{ data: any[] }>('/users/me/reviews')).data.map(mapReview),
  },

  // ── Reports ──────────────────────────────────────────────────
  reports: {
    list: async (locationId?: number): Promise<CommunityReport[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: any[] }>(`/reports${qs}`)).data.map(mapReport);
    },
    create: async (data: Partial<CommunityReport> & { location_id?: number }): Promise<CommunityReport> =>
      mapReport((await apiFetch<{ data: any }>('/reports', { method: 'POST', body: JSON.stringify(data) })).data),
    upvote: async (id: string): Promise<CommunityReport> =>
      mapReport((await apiFetch<{ data: any }>(`/reports/${id}/upvote`, { method: 'PATCH' })).data),
    myReports: async (): Promise<CommunityReport[]> =>
      (await apiFetch<{ data: any[] }>('/users/me/reports')).data.map(mapReport),
  },

  // ── Videos ───────────────────────────────────────────────────
  videos: {
    list: async (): Promise<VideoPost[]> => (await apiFetch<{ data: any[] }>('/videos')).data.map(mapVideo),
    create: async (data: Partial<VideoPost>): Promise<VideoPost> =>
      mapVideo((await apiFetch<{ data: any }>('/videos', { method: 'POST', body: JSON.stringify(data) })).data),
    like: async (id: string): Promise<VideoPost> =>
      mapVideo((await apiFetch<{ data: any }>(`/videos/${id}/like`, { method: 'PATCH' })).data),
  },

  // ── Users ────────────────────────────────────────────────────
  users: {
    me: async (): Promise<UserProfile> => mapUser((await apiFetch<{ data: any }>('/users/me')).data),
    updateMe: async (data: Partial<Pick<UserProfile, 'username' | 'full_name' | 'bio' | 'avatar_url' | 'cover_image' | 'favorite_regions' | 'instagram' | 'website'>>): Promise<UserProfile> =>
      mapUser((await apiFetch<{ data: any }>('/users/me', { method: 'PATCH', body: JSON.stringify(data) })).data),
    leaderboard: async (): Promise<UserProfile[]> => (await apiFetch<{ data: any[] }>('/users/leaderboard')).data.map(mapUser),
    stats: async (): Promise<AppStats> => (await apiFetch<{ data: AppStats }>('/users/stats')).data,
    getFavorites: async (): Promise<FavoriteLocation[]> =>
      (await apiFetch<{ data: FavoriteLocation[] }>('/users/me/favorites')).data,
  },

  // ── Favorites ─────────────────────────────────────────────────
  favorites: {
    add: async (locationId: number): Promise<{ favorited: boolean; favorite: FavoriteLocation }> =>
      (await apiFetch<{ data: any }>(`/favorites/${locationId}`, { method: 'POST' })).data,
    remove: async (locationId: number): Promise<{ favorited: boolean }> =>
      (await apiFetch<{ data: any }>(`/favorites/${locationId}`, { method: 'DELETE' })).data,
    list: async (): Promise<FavoriteLocation[]> =>
      (await apiFetch<{ data: FavoriteLocation[] }>('/users/me/favorites')).data,
  },

  // ── Admin ─────────────────────────────────────────────────────
  admin: {
    listUsers: async (): Promise<(UserProfile & { is_admin?: boolean; created_at?: string })[]> =>
      (await apiFetch<{ data: any[] }>('/admin/users')).data.map(r => ({ ...mapUser(r), is_admin: r.is_admin, created_at: r.created_at })),
    deleteUser: async (id: string): Promise<void> => { await apiFetch(`/admin/users/${id}`, { method: 'DELETE' }); },
    toggleAdmin: async (id: string, is_admin: boolean): Promise<UserProfile> =>
      mapUser((await apiFetch<{ data: any }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ is_admin }) })).data),
    listRoutes: async (): Promise<Trip[]> => (await apiFetch<{ data: any[] }>('/routes')).data.map(mapTrip),
    deleteRoute: async (id: string): Promise<void> => { await apiFetch(`/routes/${id}`, { method: 'DELETE' }); },
    // Location image moderation
    approveImage: async (locationId: number, imageId: number): Promise<LocationImage> =>
      api.locations.approveImage(locationId, imageId),
    rejectImage: async (locationId: number, imageId: number): Promise<void> =>
      api.locations.rejectImage(locationId, imageId),
  },
};

// ── Helper: convert File to base64 ────────────────────────────────────────
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ── Legacy shim ────────────────────────────────────────────────────────────
export const base44 = {
  auth: {
    me: () => api.users.me().then(u => ({ id: u.id, email: u.email || '', full_name: u.full_name || u.username })),
  },
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
        const GROUP_TYPE_MAP: Record<string, string> = { 'יחיד': 'solo', 'זוג': 'couple', 'משפחה': 'family', 'חברים': 'friends' };
        const STYLE_MAP: Record<string, string> = { 'היסטוריה ותרבות': 'history', 'מים ומעיינות': 'water', 'צילום ונוף': 'photo', 'צילום': 'photo', 'נופים ומצפים': 'nature', 'טיולים ומסלולים': 'hiking', 'חופים וים': 'beach', 'גיאולוגיה': 'geology', 'יין ואוכל': 'wine', 'כפרים ומסורת': 'village', 'פעילויות לילדים': 'family_activities' };
        const groupTypeId = GROUP_TYPE_MAP[req.group_type] ?? req.group_type;
        const styleIds = req.style ? req.style.split(', ').map((s: string) => STYLE_MAP[s.trim()] ?? s.trim()) : [];
        const res = await fetch('/api/ai/generate-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
          body: JSON.stringify({ ...req, group_type: groupTypeId, style: styleIds.join(', ') }),
        });
        if (!res.ok) throw new Error(`AI endpoint error: ${res.status}`);
        return res.json();
      },
    },
  },
};
