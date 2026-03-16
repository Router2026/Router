export interface Review {
  id: number;
  user_id?: number | null;
  location_id?: number | null;
  poi_name?: string | null;
  reviewer_name: string;
  rating: number;
  content: string;
  created_at: Date;
}

export interface CreateReviewInput {
  /** ID of the authenticated user who is writing the review */
  user_id?: number | null;
  /** Resolved FK to the locations table */
  location_id?: number | null;
  /** Fallback display name (used when POI is not yet in the locations table) */
  poi_name?: string | null;
  /** Display name override; falls back to the user's username if omitted */
  reviewer_name?: string;
  rating: number;
  content: string;
}
