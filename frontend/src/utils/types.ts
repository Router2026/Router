// ── Types ─────────────────────────────────────────────────────────────────────


export interface BucketItem {
    poi: POI;
    /** Timestamp the user added the POI — used to preserve insertion order */
    addedAt: number;
}

export type BuildMode = 'proximity' | 'smart';

/** User's live geolocation — the fixed starting point of every generated route */
export interface UserLocation {
    lat: number;
    lng: number;
}

export interface RouteStop {
    poi_id: string;
    poi_name: string;
    arrival_time: string;
    duration_minutes: number;
    smart_insight?: string;
    order_index: number;
}

export interface GeneratedRoute {
    mode: BuildMode;
    stops: RouteStop[];
    total_distance_km?: number;
    total_duration_minutes?: number;
    smart_plan?: SmartPlan;
}

export interface SmartPlan {
    route_title: string;
    route_description: string;
    stops: Array<{
        location_id: string;
        poi_name: string;
        arrival_time: string;
        duration_minutes: number;
        smart_insight: string;
        visit_type: string;
    }>;
}

export interface TripBucketContextValue {
    /** Ordered list of bucket items */
    items: BucketItem[];
    /** Number of items in the bucket */
    count: number;
    /** Add a POI — silently ignores duplicates */
    addPoi: (poi: POI) => void;
    /** Remove a POI by its id */
    removePoi: (poiId: string) => void;
    /** Move an item from one index to another (for manual reordering) */
    reorderItems: (fromIndex: number, toIndex: number) => void;
    /** True if the given POI id is already in the bucket */
    hasPoi: (poiId: string) => boolean;
    /** Clear all items */
    clearBucket: () => void;
    /** Whether the bottom sheet is open */
    isSheetOpen: boolean;
    openSheet: () => void;
    closeSheet: () => void;
    /** The most recently generated route (null until built) */
    generatedRoute: GeneratedRoute | null;
    setGeneratedRoute: (route: GeneratedRoute | null) => void;
    /** Loading state for route generation */
    isGenerating: boolean;
    setIsGenerating: (v: boolean) => void;
    /** Error from the last generation attempt */
    generationError: string | null;
    setGenerationError: (msg: string | null) => void;
    /**
     * User's live geolocation — persisted in context so it survives a
     * sheet close/reopen within the same session.
     */
    userLocation: UserLocation | null;
    setUserLocation: (loc: UserLocation | null) => void;
}

export type GeoState = 'idle' | 'loading' | 'success' | 'error';
export interface LatLng { lat: number; lng: number }
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
    region: string | null;
    region_id: number | null;
    submitter_username?: string;
    submitter_email?: string;
}

export interface EditModalProps {
    poi: CommunityPoiAdmin;
    onClose: () => void;
    onSaved: (updated: CommunityPoiAdmin) => void;
}

export interface LatLng { lat: number; lng: number }
