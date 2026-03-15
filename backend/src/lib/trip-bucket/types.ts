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
}

export interface SmartPlan {
    route_title: string;
    route_description: string;
    stops: SmartStop[];
}