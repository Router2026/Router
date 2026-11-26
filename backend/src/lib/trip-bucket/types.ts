/**
 * Trip Bucket — Type Definitions
 */

export interface BucketPoi {
    id: string;
    name: string;
    description: string;
    category: string;
    region: string;
    latitude: number;
    longitude: number;
    duration_minutes: number;
    difficulty: string;
    has_water: boolean;
    has_shade: boolean;
    accessible: boolean;
    average_rating: number;
}

export interface TspNode {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    duration_minutes: number;
}

export interface MapboxMatrixResponse {
    code: string;
    durations: number[][] | null; // seconds
    distances: number[][] | null; // meters
}

export interface SmartStop {
    location_id: string;
    poi_name: string;
    arrival_time: string;       // "HH:MM" format
    duration_minutes: number;
    smart_insight: string;      // One-sentence rationale for this slot
    visit_type: string;         // e.g. "morning hike", "afternoon coffee", "sunset viewpoint"
    /** Why this stop is here, at this time (agents/reasons.ts). */
    reason?: string;
    departure_time?: string;    // "HH:MM"
    drive_minutes_from_prev?: number;
    distance_from_prev_km?: number;
}

export interface SmartPlan {
    route_title: string;
    route_description: string;
    /** Agent 5's overview of the day. */
    overview?: string;
    /** How the day was built — the model's why_this_route, or a factual fallback. */
    why?: string;
    sunset?: string;
    total_drive_minutes?: number;
    stops: SmartStop[];
}