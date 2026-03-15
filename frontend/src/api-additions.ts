// src/api-additions.ts
// Additions to api.ts — paste these objects into the main `api` export object
// and the new type definitions into the types section.

// ── New types to add to api.ts ─────────────────────────────────────────────

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

function mapCommunityPoi(r: any): CommunityPoiSubmission {
  return {
    id:          r.id,
    user_id:     r.user_id     ?? null,
    name:        r.name,
    category:    r.category,
    description: r.description ?? null,
    latitude:    parseFloat(r.latitude),
    longitude:   parseFloat(r.longitude),
    photos:      Array.isArray(r.photos) ? r.photos : [],
    status:      r.status,
    admin_note:  r.admin_note  ?? null,
    reviewed_at: r.reviewed_at ?? null,
    created_at:  r.created_at,
    submitter_username: r.submitter_username,
  };
}

// ── api.communityPois — add to the `api` object in api.ts ─────────────────

export const communityPoisApi = {
  /** Public: list approved community POIs */
  list: async (): Promise<CommunityPoiSubmission[]> => {
    const BASE_URL = '/api';
    let _token: string | null = null;
    try { _token = localStorage.getItem('router_auth_token'); } catch { /* noop */ }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;

    const res  = await fetch(`${BASE_URL}/community-pois`, { headers });
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
    try { _token = localStorage.getItem('router_auth_token'); } catch { /* noop */ }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;

    const res  = await fetch(`${BASE_URL}/community-pois`, {
      method: 'POST', headers, body: JSON.stringify(data),
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
    try { _authToken = localStorage.getItem('router_auth_token'); } catch { /* noop */ }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

    await fetch(`${BASE_URL}/push-tokens`, {
      method: 'POST', headers, body: JSON.stringify({ token, platform }),
    });
  },
};

/*
 * ── Integration instructions ──────────────────────────────────────────────
 *
 * 1. In src/api.ts, add to the `api` export object:
 *
 *      communityPois: communityPoisApi,
 *      pushTokens:    pushTokensApi,
 *
 * 2. Add the new route in src/App.tsx (inside <Routes>):
 *
 *      import ContributePOI from './pages/ContributePOI';
 *      ...
 *      <Route path="/ContributePOI" element={<ContributePOI />} />
 *
 * 3. Add a link/button to ContributePOI from Home.tsx or Profile.tsx,
 *    e.g.: navigate('/ContributePOI')
 *
 * 4. On mobile (React Native), call api.pushTokens.register(fcmToken)
 *    after the user logs in to store the device token.
 */
