import type { POI } from "../api";

export interface LocationSelectorProps {
    initialName?: string;
    onSelect: (poi: POI | null) => void;
}

export type Tab = 'users' | 'routes' | 'community_pois';

// ── Community POI types ───────────────────────────────────────────────────────

export type PoiStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityPoiAdmin {
    id: number;
    user_id: number | null;
    name: string;
    category: string;
    description: string | null;
    latitude: string;
    longitude: string;
    photos: string[];
    status: PoiStatus;
    admin_note: string | null;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    submitter_username?: string;
    submitter_email?: string;
}

export interface EditModalProps {
    poi: CommunityPoiAdmin;
    onClose: () => void;
    onSaved: (updated: CommunityPoiAdmin) => void;
}

export interface LatLng { lat: number; lng: number }