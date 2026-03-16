// ── Real API client — connects to backend via Vite proxy (/api → localhost:3001)

const BASE_URL = '/api';

// Token getter — set by AuthContext after login
let _token: string | null = null;
export function setAuthToken(t: string | null) {
  _token = t;
}
export function getAuthToken() {
  return _token;
}

class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const j = await res.json();
      message = j.error?.message || j.error || message;
      code = j.error?.code;
    } catch {
      /* empty */
    }
    throw new ApiError(message, code);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

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
  // [lat, lng] pairs — Leaflet order, ready to use directly
  polygon_coords: [number, number][] | null;
}

export interface POI {
  id: string;
  name: string;
  description: string;
  category: string;
  region: string;
  region_id?: number;
  latitude: number;
  longitude: number;
  images: string[];
  main_image: string;
  difficulty: string;
  duration_minutes?: number;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  average_rating: number;
}

export interface TripStop {
  poi_name: string;
  arrival_time: string;
  duration_minutes: number;
  smart_insight?: string;
  location_id?: number;
  order_index?: number;
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  region?: string;
  total_duration_hours: number;
  total_distance_km?: number;
  difficulty?: string;
  group_type?: string;
  style?: string;
  stops: TripStop[];
}

export interface Review {
  id: string;
  poi_name?: string;
  reviewer_name: string;
  rating: number;
  content: string;
  created_date: string;
}

export interface CommunityReport {
  id: string;
  poi_name?: string;
  location_id?: number;
  report_type: string;
  severity: string;
  content: string;
  reporter_name: string;
  upvotes: number;
  created_date: string;
}

export interface VideoPost {
  id: string;
  title: string;
  description?: string;
  region?: string;
  uploader_name: string;
  video_url?: string;
  thumbnail_url?: string;
  likes_count: number;
  views_count: number;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  username: string;
  xp_points: number;
  level: string;
  is_admin?: boolean;
  reports_count?: number;
  reviews_count?: number;
  trips_count?: number;
}

export interface AppStats {
  total_locations: number;
  total_regions: number;
  average_rating: number;
}

export interface CommunityPoiSubmission {
  id: number;
  user_id: number | null;
  name: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  photos: string[];
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  submitter_username?: string;
}

// ── Mapper ─────────────────────────────────────────────────────────────────

function mapCommunityPoi(r: Record<string, unknown>): CommunityPoiSubmission {
  return {
    id: r.id,
    user_id: r.user_id ?? null,
    name: r.name,
    category: r.category,
    description: r.description ?? null,
    latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    photos: Array.isArray(r.photos) ? r.photos : [],
    status: r.status,
    admin_note: r.admin_note ?? null,
    reviewed_at: r.reviewed_at ?? null,
    created_at: r.created_at,
    submitter_username: r.submitter_username,
  };
}

// ── api.communityPois — add to the `api` object in api.ts ─────────────────

export const communityPoisApi = {
  /** Public: list approved community POIs */
  list: async (): Promise<CommunityPoiSubmission[]> => {
    const BASE_URL = '/api';
    let _token: string | null = null;
    try {
      _token = localStorage.getItem('router_auth_token');
    } catch {
      /* noop */
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;

    const res = await fetch(`${BASE_URL}/community-pois`, { headers });
    const json = await res.json();
    return (json.data ?? []).map(mapCommunityPoi);
  },

  /** Authenticated user submits a new community POI */
  create: async (data: {
    name: string;
    category: string;
    description?: string;
    latitude: number;
    longitude: number;
    photos?: string[];
  }): Promise<CommunityPoiSubmission> => {
    const BASE_URL = '/api';
    let _token: string | null = null;
    try {
      _token = localStorage.getItem('router_auth_token');
    } catch {
      /* noop */
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;

    const res = await fetch(`${BASE_URL}/community-pois`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
    }
    const json = await res.json();
    return mapCommunityPoi(json.data);
  },
};

// ── api.pushTokens — add to the `api` object in api.ts ────────────────────

export const pushTokensApi = {
  /** Register a device push token for the current user */
  register: async (token: string, platform: 'fcm' | 'apns' = 'fcm'): Promise<void> => {
    const BASE_URL = '/api';
    let _authToken: string | null = null;
    try {
      _authToken = localStorage.getItem('router_auth_token');
    } catch {
      /* noop */
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

    await fetch(`${BASE_URL}/push-tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token, platform }),
    });
  },
};

// ── Mappers ────────────────────────────────────────────────────────────────

function mapLocation(r: Record<string, unknown>): POI {
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

function mapTrip(r: Record<string, unknown>): Trip {
  return {
    id: String(r.id),
    name: r.name as string,
    description: r.description as string | undefined,
    region: (r.region || r.region_name) as string | undefined,
    total_duration_hours: parseFloat(r.total_duration_hours as string) || 0,
    total_distance_km: r.total_distance_km as number | undefined,
    difficulty: r.difficulty as string | undefined,
    group_type: r.group_type as string | undefined,
    style: r.style as string | undefined,
    stops: ((r.stops || []) as Record<string, unknown>[]).map((s) => ({
      poi_name: s.poi_name || s.location_name || '',
      arrival_time: s.arrival_time || '',
      duration_minutes: s.duration_minutes || 60,
      smart_insight: s.smart_insight,
      location_id: s.location_id,
      order_index: s.order_index,
    })),
  };
}

function mapReview(r: Record<string, unknown>): Review {
  return {
    id: String(r.id),
    poi_name: r.poi_name,
    reviewer_name: r.reviewer_name,
    rating: r.rating,
    content: r.content,
    created_date: r.created_at,
  };
}

function mapReport(r: Record<string, unknown>): CommunityReport {
  return {
    id: String(r.id),
    poi_name: r.poi_name,
    location_id: r.location_id,
    report_type: r.report_type,
    severity: r.severity,
    content: r.content,
    reporter_name: r.reporter_name,
    upvotes: r.upvotes || 0,
    created_date: r.created_at,
  };
}

function mapVideo(r: Record<string, unknown>): VideoPost {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,
    region: r.region,
    uploader_name: r.uploader_name,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    likes_count: r.likes_count || 0,
    views_count: r.views_count || 0,
  };
}

function mapUser(r: Record<string, unknown>): UserProfile {
  return {
    id: String(r.id),
    email: r.email,
    full_name: r.full_name,
    username: r.username || r.display_name || 'user',
    xp_points: r.xp_points || 0,
    level: r.level || 'מטייל מתחיל',
    is_admin: r.is_admin ?? false,
    reports_count: r.reports_count || 0,
    reviews_count: r.reviews_count || 0,
    trips_count: r.trips_count || 0,
  };
}

// ── Main API Object ────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────
  auth: {
    login: async (
      email: string,
      password: string
    ): Promise<{ user: UserProfile; token: string }> => {
      const res = await apiFetch<{ data: { user: Record<string, unknown>; token: string } }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      return { user: mapUser(res.data.user), token: res.data.token };
    },
    register: async (
      email: string,
      password: string,
      full_name: string,
      username: string
    ): Promise<{ requiresVerification: true }> => {
      await apiFetch<{ data: unknown }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name, username }),
      });
      return { requiresVerification: true };
    },
    checkUsername: async (username: string): Promise<boolean> => {
      const res = await apiFetch<{ data: { available: boolean } }>(
        `/auth/check-username?username=${encodeURIComponent(username)}`
      );
      return res.data.available;
    },
    verifyEmail: async (token: string): Promise<{ user: UserProfile; token: string }> => {
      const res = await apiFetch<{ data: { user: Record<string, unknown>; token: string } }>(
        `/auth/verify-email?token=${encodeURIComponent(token)}`
      );
      return { user: mapUser(res.data.user), token: res.data.token };
    },
    resendVerification: async (email: string): Promise<void> => {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    forgotPassword: async (email: string): Promise<void> => {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    },
    resetPassword: async (token: string, password: string): Promise<{ token: string }> => {
      const res = await apiFetch<{ data: { token: string } }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      return { token: res.data.token };
    },
    me: async (token?: string): Promise<UserProfile> => {
      const savedToken = _token;
      if (token) _token = token;
      try {
        const res = await apiFetch<{ data: Record<string, unknown> }>('/auth/me');
        return mapUser(res.data);
      } finally {
        _token = savedToken;
      }
    },
  },

  // ── Regions ──────────────────────────────────────────────────
  regions: {
    list: async (): Promise<Region[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/regions')).data as unknown as Region[],
  },

  // ── Locations ────────────────────────────────────────────────
  locations: {
    list: async (params?: {
      region?: string;
      category?: string;
      difficulty?: string;
      search?: string;
      has_water?: boolean;
      has_shade?: boolean;
      accessible?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<POI[]> => {
      const qs = new URLSearchParams();
      if (params?.region) qs.set('region', params.region);
      if (params?.category) qs.set('category', params.category);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.search) qs.set('search', params.search);
      if (params?.has_water) qs.set('has_water', 'true');
      if (params?.has_shade) qs.set('has_shade', 'true');
      if (params?.accessible) qs.set('accessible', 'true');
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      return (await apiFetch<{ data: Record<string, unknown>[] }>(`/locations?${qs}`)).data.map(
        mapLocation
      );
    },
    get: async (id: string): Promise<POI> =>
      mapLocation((await apiFetch<{ data: Record<string, unknown> }>(`/locations/${id}`)).data),
    inBounds: async (b: {
      north: number;
      south: number;
      east: number;
      west: number;
    }): Promise<POI[]> => {
      const qs = new URLSearchParams({
        north: String(b.north),
        south: String(b.south),
        east: String(b.east),
        west: String(b.west),
      });
      return (await apiFetch<{ data: Record<string, unknown>[] }>(`/locations/map?${qs}`)).data.map(
        mapLocation
      );
    },
  },

  // ── Trips ────────────────────────────────────────────────────
  trips: {
    // Router community routes live at /api/routes (/api/trips is the main app's AI generator)
    list: async (): Promise<Trip[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/routes')).data.map(mapTrip),
    get: async (id: string): Promise<Trip> =>
      mapTrip((await apiFetch<{ data: Record<string, unknown> }>(`/routes/${id}`)).data),
    create: async (data: Partial<Trip>): Promise<Trip> =>
      mapTrip(
        (
          await apiFetch<{ data: Record<string, unknown> }>('/routes', {
            method: 'POST',
            body: JSON.stringify(data),
          })
        ).data
      ),
    delete: async (id: string): Promise<void> => {
      await apiFetch(`/routes/${id}`, { method: 'DELETE' });
    },
  },

  // ── Reviews ──────────────────────────────────────────────────
  reviews: {
    list: async (locationId?: number): Promise<Review[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: Record<string, unknown>[] }>(`/reviews${qs}`)).data.map(
        mapReview
      );
    },
    create: async (data: Partial<Review> & { location_id?: number }): Promise<Review> =>
      mapReview(
        (
          await apiFetch<{ data: Record<string, unknown> }>('/reviews', {
            method: 'POST',
            body: JSON.stringify(data),
          })
        ).data
      ),
  },

  // ── Reports ──────────────────────────────────────────────────
  reports: {
    list: async (locationId?: number): Promise<CommunityReport[]> => {
      const qs = locationId ? `?location_id=${locationId}` : '';
      return (await apiFetch<{ data: Record<string, unknown>[] }>(`/reports${qs}`)).data.map(
        mapReport
      );
    },
    create: async (
      data: Partial<CommunityReport> & { location_id?: number }
    ): Promise<CommunityReport> =>
      mapReport(
        (
          await apiFetch<{ data: Record<string, unknown> }>('/reports', {
            method: 'POST',
            body: JSON.stringify(data),
          })
        ).data
      ),
    upvote: async (id: string): Promise<CommunityReport> =>
      mapReport(
        (
          await apiFetch<{ data: Record<string, unknown> }>(`/reports/${id}/upvote`, {
            method: 'PATCH',
          })
        ).data
      ),
  },

  // ── Videos ───────────────────────────────────────────────────
  videos: {
    list: async (): Promise<VideoPost[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/videos')).data.map(mapVideo),
    create: async (data: Partial<VideoPost>): Promise<VideoPost> =>
      mapVideo(
        (
          await apiFetch<{ data: Record<string, unknown> }>('/videos', {
            method: 'POST',
            body: JSON.stringify(data),
          })
        ).data
      ),
    like: async (id: string): Promise<VideoPost> =>
      mapVideo(
        (
          await apiFetch<{ data: Record<string, unknown> }>(`/videos/${id}/like`, {
            method: 'PATCH',
          })
        ).data
      ),
  },

  // ── Users ────────────────────────────────────────────────────
  users: {
    me: async (): Promise<UserProfile> =>
      mapUser((await apiFetch<{ data: Record<string, unknown> }>('/users/me')).data),
    leaderboard: async (): Promise<UserProfile[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/users/leaderboard')).data.map(mapUser),
    stats: async (): Promise<AppStats> => (await apiFetch<{ data: AppStats }>('/users/stats')).data,
  },

  // ── Admin ─────────────────────────────────────────────────────
  admin: {
    listUsers: async (): Promise<(UserProfile & { is_admin?: boolean; created_at?: string })[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/admin/users')).data.map((r) => ({
        ...mapUser(r),
        is_admin: r.is_admin as boolean | undefined,
        created_at: r.created_at as string | undefined,
      })),
    deleteUser: async (id: string): Promise<void> => {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
    },
    toggleAdmin: async (id: string, is_admin: boolean): Promise<UserProfile> =>
      mapUser(
        (
          await apiFetch<{ data: Record<string, unknown> }>(`/admin/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_admin }),
          })
        ).data
      ),
    listRoutes: async (): Promise<Trip[]> =>
      (await apiFetch<{ data: Record<string, unknown>[] }>('/routes')).data.map(mapTrip),
    deleteRoute: async (id: string): Promise<void> => {
      await apiFetch(`/routes/${id}`, { method: 'DELETE' });
    },
  },
};

// ── Legacy shim for pages still using base44.entities.* patterns ──────────
export const base44 = {
  auth: {
    me: () =>
      api.users
        .me()
        .then((u) => ({ id: u.id, email: u.email || '', full_name: u.full_name || u.username })),
  },
  entities: {
    POI: {
      list: () => api.locations.list(),
      filter: (p?: { region?: string }) => api.locations.list(p),
      get: (id: string) => api.locations.get(id),
    },
    Trip: {
      filter: () => api.trips.list(),
      create: (data: Partial<Trip>) => api.trips.create(data),
    },
    Review: {
      filter: () => api.reviews.list(),
      create: (data: Partial<Review> & { location_id?: number }) => api.reviews.create(data),
    },
    CommunityReport: {
      filter: () => api.reports.list(),
      create: (data: Partial<CommunityReport> & { location_id?: number }) =>
        api.reports.create(data),
      update: (id: string) => api.reports.upvote(id),
    },
    UserProfile: {
      filter: () => api.users.me().then((u) => [u]),
      list: () => api.users.leaderboard(),
      create: (d: unknown) => Promise.resolve(d),
      update: (id: string, d: unknown) => Promise.resolve({ id, ...((d as object) ?? {}) }),
    },
    VideoPost: {
      list: () => api.videos.list(),
      filter: () => api.videos.list(),
      create: (data: Partial<VideoPost>) => api.videos.create(data),
      update: (id: string) => api.videos.like(id),
    },
  },
  integrations: {
    Core: {
      UploadFile: async () => ({
        file_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
      }),
      InvokeLLM: async ({ body }: { body: string }) => {
        const req = JSON.parse(body);
        // Normalize group type: Hebrew display names → English IDs
        const GROUP_TYPE_MAP: Record<string, string> = {
          יחיד: 'solo',
          זוג: 'couple',
          משפחה: 'family',
          חברים: 'friends',
        };
        const groupTypeId = GROUP_TYPE_MAP[req.group_type] ?? req.group_type;
        // Normalize styles: Hebrew display names → English IDs
        const STYLE_MAP: Record<string, string> = {
          'היסטוריה ותרבות': 'history',
          'מים ומעיינות': 'water',
          'צילום ונוף': 'photo',
          צילום: 'photo',
          'נופים ומצפים': 'nature',
          'טיולים ומסלולים': 'hiking',
          'חופים וים': 'beach',
          גיאולוגיה: 'geology',
          'יין ואוכל': 'wine',
          'כפרים ומסורת': 'village',
          'פעילויות לילדים': 'family_activities',
        };
        const styleIds = req.style
          ? req.style.split(', ').map((s: string) => STYLE_MAP[s.trim()] ?? s.trim())
          : [];
        // Call the real AI endpoint on the Next.js backend
        const res = await fetch('/api/ai/generate-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            region: req.region,
            groupType: groupTypeId,
            styles: styleIds,
            startTime: req.start_time || '09:00',
            endTime: req.end_time || '16:00',
            includeFood: req.include_food || false,
            includeCoffee: req.include_coffee || false,
            userLocation: req.user_location || null,
          }),
        });
        if (!res.ok) throw new Error(`AI generation failed: ${res.status}`);
        const json = await res.json();
        return json.data;
      },
    },
  },
};

export const ALL_POIS: POI[] = [];
