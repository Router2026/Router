// src/api.ts — UPDATED: media upload (images+video), ratings, nearby locations
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toast } from 'sonner';

export const BASE_URL = (import.meta.env.VITE_API_URL ?? '') + '/api';

let _token: string | null = null;
export function setAuthToken(t: string | null) { _token = t; }
export function getAuthToken() { return _token; }

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export { toast };

const TOKEN_KEY = 'router_auth_token';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function isNetworkError(err: unknown): err is TypeError {
  return err instanceof TypeError && (
    err.message === 'Failed to fetch' ||
    err.message === 'Load failed' ||
    err.message.includes('NetworkError')
  );
}

function shouldRetry(method: string, attempt: number, err: unknown, status?: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  // Only retry idempotent methods
  const idempotent = !method || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (!idempotent) return false;
  // Retry on network failures or server errors (5xx), not on 4xx
  if (isNetworkError(err)) return true;
  if (status && status >= 500) return true;
  return false;
}

function retryDelay(attempt: number): Promise<void> {
  const jitter = 0.8 + Math.random() * 0.4; // NOSONAR — timing jitter, not cryptographic
  const ms = RETRY_BASE_MS * Math.pow(2, attempt) * jitter;
  return new Promise(r => setTimeout(r, ms));
}

type AttemptResult<T> =
  | { ok: true; data: T }
  | { ok: false; err: unknown; status?: number };

async function singleAttempt<T>(url: string, init: RequestInit): Promise<AttemptResult<T>> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let code: string | undefined;
      try { const j = await res.json(); message = j.error?.message || j.error || message; code = j.error?.code; } catch { /* intentional */ }
      return { ok: false, err: new ApiError(message, code, res.status), status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, err };
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _token ?? localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const method = options?.method ?? 'GET';
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await retryDelay(attempt - 1);

    const result = await singleAttempt<T>(`${BASE_URL}${path}`, { headers, ...options });
    if (result.ok) return result.data;

    lastErr = result.err;
    if (!shouldRetry(method, attempt, result.err, result.status)) {
      throw result.err;
    }
    if (isNetworkError(result.err) && attempt === 0) {
      toast.error('בעיית חיבור לאינטרנט, מנסה שנית...', { id: 'network-retry', duration: 8000 });
    }
  }

  toast.dismiss('network-retry');
  const msg = isNetworkError(lastErr)
    ? 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.'
    : 'שגיאת שרת. נסה שוב מאוחר יותר.';
  toast.error(msg, { duration: 6000 });
  throw lastErr;
}

// For multipart/form-data uploads — no Content-Type header so browser sets boundary automatically
async function apiFetchForm<T>(path: string, formData: FormData): Promise<T> {
  const token = _token ?? localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  } catch (err) {
    if (isNetworkError(err)) {
      toast.error('אין חיבור לאינטרנט. לא ניתן להעלות את הקובץ.', { duration: 6000 });
    }
    throw err;
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try { const j = await res.json(); message = j.error?.message || j.error || message; code = j.error?.code; } catch { /* intentional */ }
    throw new ApiError(message, code, res.status);
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
  images: string[]; main_image: string; thumbnail: string; difficulty: string;
  duration_minutes?: number; has_water?: boolean; has_shade?: boolean;
  accessible?: boolean; is_featured?: boolean; average_rating: number;
  /** Optional photographer credit shown as a watermark on the main image */
  photo_credit?: string;
  /** Username of the community member who originally contributed this place */
  uploaded_by?: string;
  /** Distance from user in meters — present only when user_lat/user_lng passed to list() */
  distance_meters?: number;
  /** DB user id of the original community POI submitter (null for official POIs) */
  owner_user_id?: number | null;
  /** The community_pois.id this location was created from (null for official POIs) */
  community_poi_id?: number | null;
}

export interface NearbyPOI extends POI {
  distance_meters: number;
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
  region?: string | null; region_id?: number | null;
  // Optional detail fields
  difficulty?: string | null;
  duration_minutes?: number | null;
  has_water?: boolean | null;
  has_shade?: boolean | null;
  accessible?: boolean | null;
  photo_credit?: string | null;
  submitter_username?: string;
}

export interface LocationImage {
  id: number; user_id: number; location_id: number;
  image_url: string; is_approved: boolean; created_at: string; username?: string;
}

/** Unified media item — images and videos */
export interface LocationMedia {
  id: number;
  location_id: number;
  user_id: number;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_approved: boolean;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
  username?: string;
}

export interface XpResult {
  new_xp: number; new_level: number; level_label: string; leveled_up: boolean;
}

export interface UploadImageResponse {
  image: LocationImage; xp: XpResult; limit: number;
}

export interface UploadMediaResponse {
  media: LocationMedia; xp: XpResult;
}

export interface RatingSummary {
  average: number;
  count: number;
  userRating: number | null;
}

export interface PublicTripLocation {
  id: number; location_id: number; name: string; category: string;
  latitude: number; longitude: number; main_image: string | null;
  order_index: number; region_name?: string; difficulty?: string;
}

export interface RouteComment {
  id: number; route_id: number; user_id: number;
  username: string; avatar_url: string | null;
  content: string; created_at: string;
}

export interface CommunityMedia {
  id: number; route_id: number; user_id: number;
  username: string; avatar_url: string | null;
  media_type: 'image' | 'video'; url: string;
  caption: string | null; created_at: string;
}

export interface RouteImage {
  id: number; route_id: number; image_url: string; caption?: string; created_at: string;
}

export interface PublicTrip {
  id: number; user_id: number; title: string; description: string | null;
  route_geojson: object | null; is_public: boolean; created_at: string;
  creator_username: string; creator_avatar: string | null;
  creator_xp: number; location_count: number; locations: PublicTripLocation[];
  region?: string; difficulty?: string; style?: string; total_duration_hours?: number; group_type?: string;
  // user content
  user_description?: string; image_url?: string; video_url?: string;
  points_of_interest?: string; recommended_stops?: string;
  route_images?: RouteImage[];
  // social
  likes_count?: number; comments_count?: number;
  average_rating?: number; ratings_count?: number;
}

/** Returned by /trips/public when used for infinite-scroll pagination. */
export interface PaginatedTrips {
  items: PublicTrip[];
  has_more: boolean;
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

import { getImageUrl } from './utils/imageUtils';

// ── Mapper helpers ─────────────────────────────────────────────────────────

function mapLocation(r: any): POI {
  const mainImage: string = r.main_image || '';
  let images: string[];
  if (Array.isArray(r.images)) { images = r.images; }
  else if (typeof r.images === 'string') { images = JSON.parse(r.images) as string[]; }
  else { images = []; }
  return {
    id: String(r.id), name: r.name, description: r.description || '',
    category: r.category, region: r.region_name || r.region || '',
    region_id: r.region_id, latitude: Number.parseFloat(r.latitude),
    longitude: Number.parseFloat(r.longitude),
    images,
    main_image: mainImage, thumbnail: getImageUrl(mainImage, 'card'), difficulty: r.difficulty || 'בינוני',
    duration_minutes: r.duration_minutes, has_water: r.has_water,
    has_shade: r.has_shade, accessible: r.accessible,
    is_featured: r.is_featured ?? false,
    average_rating: Number.parseFloat(r.average_rating) || 4,
    photo_credit: r.photo_credit || r.credit || undefined,
    uploaded_by: r.uploaded_by || undefined,
    distance_meters: r.distance_meters !== undefined && r.distance_meters !== null
      ? Number.parseFloat(r.distance_meters) : undefined,
    owner_user_id: r.owner_user_id ?? null,
    community_poi_id: r.community_poi_id ?? null,
  };
}

function mapNearbyLocation(r: any): NearbyPOI {
  return { ...mapLocation(r), distance_meters: Number.parseFloat(r.distance_meters) || 0 };
}

function mapTrip(r: any): Trip {
  return {
    id: String(r.id), name: r.name, description: r.description,
    region: r.region || r.region_name,
    total_duration_hours: Number.parseFloat(r.total_duration_hours) || 0,
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
    trips_count: r.trips_count || 0,
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
    resetPassword: async (access_token: string, password: string): Promise<void> => {
      await apiFetch('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ access_token, password }),
      });
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
      // Proximity: pass user coords to get distance-sorted results from the DB
      user_lat?: number; user_lng?: number;
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
      if (params?.user_lat !== undefined) qs.set('user_lat', String(params.user_lat));
      if (params?.user_lng !== undefined) qs.set('user_lng', String(params.user_lng));
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

    // ── Nearby ─────────────────────────────────────────────────
    getNearby: async (locationId: string | number, limit = 6, radiusMeters = 25000): Promise<NearbyPOI[]> =>
      (await apiFetch<{ data: any[] }>(`/locations/${locationId}/nearby?limit=${limit}&radius=${radiusMeters}`))
        .data.map(mapNearbyLocation),

    // ── Featured ───────────────────────────────────────────
    getFeatured: async (limit = 10): Promise<POI[]> =>
      (await apiFetch<{ data: any[] }>(`/locations/featured?limit=${limit}`)).data.map(mapLocation),

    // ── Nearby User (by coordinates) ───────────────────────
    getNearbyUser: async (lat: number, lng: number, limit = 8, radius = 30000): Promise<NearbyPOI[]> => {
      const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: String(limit), radius: String(radius) });
      return (await apiFetch<{ data: any[] }>(`/locations/nearby-user?${qs}`)).data.map(mapNearbyLocation);
    },

    // ── Ratings ────────────────────────────────────────────────
    getRating: async (locationId: string | number): Promise<RatingSummary> =>
      (await apiFetch<{ data: RatingSummary }>(`/locations/${locationId}/rating`)).data,
    rate: async (locationId: string | number, rating: number): Promise<RatingSummary> =>
      (await apiFetch<{ data: RatingSummary }>(`/locations/${locationId}/rating`, {
        method: 'POST', body: JSON.stringify({ rating }),
      })).data,

    // ── Legacy image endpoints (kept for backward compat) ───────
    getImages: async (locationId: string | number): Promise<LocationImage[]> =>
      (await apiFetch<{ data: LocationImage[] }>(`/locations/${locationId}/images`)).data,
    uploadImage: async (locationId: string | number, imageUrl: string): Promise<UploadImageResponse> =>
      (await apiFetch<{ data: UploadImageResponse }>(`/locations/${locationId}/images`, {
        method: 'POST', body: JSON.stringify({ image_url: imageUrl }),
      })).data,
    uploadImageFile: async (locationId: string | number, file: File): Promise<UploadImageResponse> => {
      // FIX: FormData instead of base64 JSON — same size limit issue.
      const form = new FormData();
      form.append('file', file);
      return (await apiFetchForm<{ data: UploadImageResponse }>(`/locations/${locationId}/images`, form)).data;
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

    // ── New unified media endpoints (images + videos) ───────────
    getMedia: async (locationId: string | number, approvedOnly = false): Promise<LocationMedia[]> =>
      (await apiFetch<{ data: LocationMedia[] }>(
        `/locations/${locationId}/media${approvedOnly ? '?approved=true' : ''}`
      )).data,
    uploadMedia: async (locationId: string | number, file: File, caption?: string): Promise<UploadMediaResponse> => {
      // FIX: Use FormData (multipart) instead of base64 JSON.
      // base64 inflates file size by ~33% and the JSON body hits Next.js's
      // default 4 MB limit — causing "Failed to fetch" for photos over ~3 MB.
      // FormData streams the raw binary with no size overhead and no body limit.
      const form = new FormData();
      form.append('file', file);
      if (caption) form.append('caption', caption);
      return (await apiFetchForm<{ data: UploadMediaResponse }>(`/locations/${locationId}/media`, form)).data;
    },
    // Upload a file to Supabase Storage without attaching it to a location yet.
    // Used by ContributePOI so photos are stored before the community_pois row exists.
    // Returns the public https:// Storage URL to include in community_pois.photos.
    uploadPendingMedia: async (file: File): Promise<string> => {
      // FIX: Same — FormData instead of base64 JSON.
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetchForm<{ data: { url: string } }>('/media/upload', form);
      return res.data.url;
    },
    uploadMediaUrl: async (locationId: string | number, url: string, mediaType: 'image' | 'video' = 'image', caption?: string): Promise<UploadMediaResponse> =>
      (await apiFetch<{ data: UploadMediaResponse }>(`/locations/${locationId}/media`, {
        method: 'POST', body: JSON.stringify({ media_url: url, media_type: mediaType, caption }),
      })).data,
    approveMedia: async (locationId: string | number, mediaId: number): Promise<LocationMedia> =>
      (await apiFetch<{ data: LocationMedia }>(`/locations/${locationId}/media`, {
        method: 'PATCH', body: JSON.stringify({ media_id: mediaId, action: 'approve' }),
      })).data,
    rejectMedia: async (locationId: string | number, mediaId: number): Promise<void> => {
      await apiFetch(`/locations/${locationId}/media`, {
        method: 'PATCH', body: JSON.stringify({ media_id: mediaId, action: 'reject' }),
      });
    },
    deleteMedia: async (locationId: string | number, mediaId: number): Promise<void> => {
      await apiFetch(`/locations/${locationId}/media`, {
        method: 'DELETE', body: JSON.stringify({ media_id: mediaId }),
      });
    },

    delete: async (id: string | number): Promise<void> => {
      await apiFetch(`/locations/${id}`, { method: 'DELETE' });
    },
  },

  // ── Trips (AI generator routes) ──────────────────────────────
  trips: {
    list: async (): Promise<Trip[]> => (await apiFetch<{ data: any[] }>('/routes')).data.map(mapTrip),
    get: async (id: string): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>(`/routes/${id}`)).data),
    create: async (data: Partial<Trip>): Promise<Trip> => mapTrip((await apiFetch<{ data: any }>('/routes', { method: 'POST', body: JSON.stringify(data) })).data),
    update: async (id: string, data: Partial<Trip>): Promise<Trip> =>
      mapTrip((await apiFetch<{ data: any }>(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) })).data),
    delete: async (id: string): Promise<void> => { await apiFetch(`/routes/${id}`, { method: 'DELETE' }); },
    share: async (id: string): Promise<ShareTripResult> =>
      (await apiFetch<{ data: ShareTripResult }>(`/routes/${id}/share`, { method: 'POST' })).data,
  },

  // ── Public trips ─────────────────────────────────────────────
  publicTrips: {
    list: async (params?: { region?: string; difficulty?: string; style?: string; group_type?: string; limit?: number; offset?: number }): Promise<PublicTrip[]> => {
      const qs = new URLSearchParams();
      if (params?.region) qs.set('region', params.region);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.style) qs.set('style', params.style);
      if (params?.group_type) qs.set('group_type', params.group_type);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      return (await apiFetch<{ data: PublicTrip[] }>(`/trips/public?${qs}`)).data;
    },
    // OPTIMIZATION (infinite scroll): the backend now returns
    // { items, has_more } from the same /trips/public endpoint (default page
    // size 10). This is the paginated counterpart to `list` above — used by
    // the Community feed instead of fetching everything in one request.
    listPaginated: async (params?: { region?: string; difficulty?: string; style?: string; group_type?: string; limit?: number; offset?: number }): Promise<PaginatedTrips> => {
      const qs = new URLSearchParams();
      if (params?.region) qs.set('region', params.region);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.style) qs.set('style', params.style);
      if (params?.group_type) qs.set('group_type', params.group_type);
      qs.set('limit', String(params?.limit ?? 10));
      qs.set('offset', String(params?.offset ?? 0));
      return (await apiFetch<{ data: PaginatedTrips }>(`/trips/public?${qs}`)).data;
    },
    get: async (id: number): Promise<PublicTrip> =>
      (await apiFetch<{ data: PublicTrip }>(`/trips/public/${id}`)).data,
    create: async (data: {
      title: string; description?: string;
      route_geojson?: object; is_public?: boolean; location_ids?: number[];
    }): Promise<PublicTrip & { xp_awarded?: any }> =>
      (await apiFetch<{ data: any }>('/trips/public', { method: 'POST', body: JSON.stringify(data) })).data,
    myTrips: async (): Promise<{ id: number; title: string; description: string | null; is_public: boolean; created_at: string; location_count: number }[]> =>
      (await apiFetch<{ data: any[] }>('/users/me/trips')).data,
    // social
    toggleLike: async (id: number): Promise<{ liked: boolean; likes_count: number }> =>
      (await apiFetch<{ data: any }>(`/trips/public/${id}/likes`, { method: 'POST' })).data,
    getLikes: async (id: number): Promise<{ liked: boolean; likes_count: number }> =>
      (await apiFetch<{ data: any }>(`/trips/public/${id}/likes`)).data,
    getComments: async (id: number): Promise<RouteComment[]> =>
      (await apiFetch<{ data: RouteComment[] }>(`/trips/public/${id}/comments`)).data,
    addComment: async (id: number, content: string): Promise<RouteComment> =>
      (await apiFetch<{ data: RouteComment }>(`/trips/public/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) })).data,
    deleteComment: async (id: number, commentId: number): Promise<void> => {
      await apiFetch(`/trips/public/${id}/comments?commentId=${commentId}`, { method: 'DELETE' });
    },
    getRating: async (id: number): Promise<{ average_rating: number; ratings_count: number; user_rating: number | null }> =>
      (await apiFetch<{ data: any }>(`/trips/public/${id}/rating`)).data,
    setRating: async (id: number, rating: number): Promise<{ average_rating: number; ratings_count: number; user_rating: number }> =>
      (await apiFetch<{ data: any }>(`/trips/public/${id}/rating`, { method: 'POST', body: JSON.stringify({ rating }) })).data,
    // NOTE: intentionally targets /trips/public/:id (not /trips/public/:id/media).
    // /trips/public/:id/media PATCH is a moderation-only endpoint that expects
    // { media_id, action } — it does not handle description/image/video updates.
    // The correct route is PATCH /trips/public/:id which dispatches on field presence.
    updateMedia: async (id: number, data: { user_description?: string; image_url?: string; video_url?: string; points_of_interest?: string; recommended_stops?: string }): Promise<void> => {
      await apiFetch(`/trips/public/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    getImages: async (id: number): Promise<RouteImage[]> =>
      (await apiFetch<{ data: RouteImage[] }>(`/trips/public/${id}/images`)).data,
    addImage: async (id: number, image_url: string, caption?: string): Promise<RouteImage> =>
      (await apiFetch<{ data: RouteImage }>(`/trips/public/${id}/images`, { method: 'POST', body: JSON.stringify({ image_url, caption }) })).data,
    deleteImage: async (id: number, imageId: number): Promise<void> => {
      await apiFetch(`/trips/public/${id}/images/${imageId}`, { method: 'DELETE' });
    },
    updateStops: async (id: number, location_ids: number[]): Promise<PublicTrip> =>
      (await apiFetch<{ data: PublicTrip }>(`/trips/public/${id}`, { method: 'PATCH', body: JSON.stringify({ location_ids }) })).data,
    publish: async (id: number): Promise<{ trip: PublicTrip; xp_awarded?: any }> => {
      const data = (await apiFetch<{ data: any }>(`/trips/public/${id}`, { method: 'PATCH', body: JSON.stringify({ is_public: true }) })).data;
      return { trip: data, xp_awarded: data.xp_awarded };
    },
    getCommunityMedia: async (id: number): Promise<CommunityMedia[]> =>
      (await apiFetch<{ data: CommunityMedia[] }>(`/trips/public/${id}/community-media`)).data,
    addCommunityMedia: async (id: number, url: string, media_type: 'image' | 'video', caption?: string): Promise<CommunityMedia & { xp_awarded?: any }> =>
      (await apiFetch<{ data: any }>(`/trips/public/${id}/community-media`, { method: 'POST', body: JSON.stringify({ url, media_type, caption }) })).data,
    deleteCommunityMedia: async (id: number, mediaId: number): Promise<void> => {
      await apiFetch(`/trips/public/${id}/community-media/${mediaId}`, { method: 'DELETE' });
    },
  },

  userProfiles: {
    get: async (userId: number): Promise<{ profile: any; trips: PublicTrip[]; community_pois: CommunityPoiSubmission[] }> =>
      (await apiFetch<{ data: any }>(`/users/${userId}`)).data,
  },

  // ── Community POIs (user-submitted places) ────────────────────
  communityPois: {
    /** All POIs submitted by the authenticated user (all statuses) */
    myPlaces: async (): Promise<CommunityPoiSubmission[]> =>
      (await apiFetch<{ data: CommunityPoiSubmission[] }>('/community-pois/my')).data,

    /** Get a single community POI by id */
    get: async (id: number): Promise<CommunityPoiSubmission> =>
      (await apiFetch<{ data: CommunityPoiSubmission }>(`/community-pois/${id}`)).data,

    /** Edit a community POI — owner only, only allowed on pending/rejected POIs */
    update: async (
      id: number,
      data: Partial<Pick<CommunityPoiSubmission, 'name' | 'category' | 'description' | 'latitude' | 'longitude' | 'photos'>> & {
        difficulty?: string;
        duration_minutes?: number | null;
        has_water?: boolean | null;
        has_shade?: boolean | null;
        accessible?: boolean | null;
        photo_credit?: string | null;
      }
    ): Promise<CommunityPoiSubmission> =>
      (await apiFetch<{ data: CommunityPoiSubmission }>(`/community-pois/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })).data,

    /** Delete a pending/rejected community POI — owner only */
    delete: async (id: number): Promise<void> => {
      await apiFetch(`/community-pois/${id}`, { method: 'DELETE' });
    },

    /**
     * Owner edit for an APPROVED community POI.
     * Text/image changes are applied immediately (no re-approval).
     * Coordinate changes trigger a pending review but keep the place visible.
     * Returns { poi, location_changed, pending_review }.
     */
    ownerEdit: async (
      id: number,
      data: Partial<Pick<CommunityPoiSubmission, 'name' | 'category' | 'description' | 'photos'>> & {
        latitude?: number;
        longitude?: number;
        difficulty?: string;
        duration_minutes?: number | null;
        has_water?: boolean | null;
        has_shade?: boolean | null;
        accessible?: boolean | null;
        photo_credit?: string | null;
      }
    ): Promise<{ poi: CommunityPoiSubmission; location_changed: boolean; pending_review: boolean }> =>
      (await apiFetch<{ data: any }>(`/community-pois/${id}/owner-edit`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })).data,
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
    list: async (opts?: { locationId?: number; type?: string }): Promise<CommunityReport[]> => {
      const qs = new URLSearchParams();
      if (opts?.locationId) qs.set("location_id", String(opts.locationId));
      if (opts?.type) qs.set("type", opts.type);
      const query = qs.toString() ? `?${qs}` : "";
      return (await apiFetch<{ data: any[] }>(`/reports${query}`)).data.map(mapReport);
    },
    create: async (data: Partial<CommunityReport> & { location_id?: number }): Promise<CommunityReport> =>
      mapReport((await apiFetch<{ data: any }>('/reports', { method: 'POST', body: JSON.stringify(data) })).data),
    upvote: async (id: string, action: 'add' | 'remove' = 'add'): Promise<CommunityReport> =>
      mapReport((await apiFetch<{ data: any }>(`/reports/${id}/upvote`, { method: 'PATCH', body: JSON.stringify({ action }) })).data),
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
    deleteMe: async (): Promise<void> => { await apiFetch('/users/me', { method: 'DELETE' }); },
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
    approveImage: async (locationId: number, imageId: number): Promise<LocationImage> =>
      api.locations.approveImage(locationId, imageId),
    rejectImage: async (locationId: number, imageId: number): Promise<void> =>
      api.locations.rejectImage(locationId, imageId),
  },
};

// ── Helper: Supabase Storage image transform ───────────────────────────────────
// Requires VITE_ENABLE_IMG_TRANSFORM=true + Supabase Pro plan.
// On free tier the env var is absent so the original URL is returned unchanged.
export function transformSupabaseImage(
  url: string | null | undefined,
  width: number,
  quality = 75,
): string {
  if (!url) return '';
  if (!import.meta.env.VITE_ENABLE_IMG_TRANSFORM) return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  return `${base}?width=${width}&quality=${quality}&resize=cover`;
}

// ── Helper: geocode a city/locality name to coordinates (Israel-scoped) ──────
export interface GeocodedCity {
  name: string;       // display name returned by Nominatim
  lat: number;
  lng: number;
}

export async function geocodeCity(query: string): Promise<GeocodedCity | null> {
  if (!query.trim()) return null;
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'il',
      addressdetails: '1',
      'accept-language': 'he,en',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'RouterApp/1.0' },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!results.length) return null;
    const r = results[0];
    // Prefer city/town/village display name
    const displayName =
      r.address?.city ||
      r.address?.town ||
      r.address?.village ||
      r.address?.municipality ||
      r.address?.suburb ||
      r.display_name.split(',')[0];
    return { name: displayName, lat: Number.parseFloat(r.lat), lng: Number.parseFloat(r.lon) };
  } catch {
    return null;
  }
}

// ── Helper: haversine distance between two lat/lng points (meters) ────────────
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
        const res = await fetch(BASE_URL + '/ai/generate-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
          body: JSON.stringify({
            region: req.region,
            groupType: groupTypeId,
            styles: styleIds,
            startTime: req.start_time,
            endTime: req.end_time,
            includeFood: req.include_food,
            includeCoffee: req.include_coffee,
            userLocation: req.user_location,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`AI endpoint error: ${res.status} — ${errText}`);
        }
        return res.json();
      },
    },
  },
};