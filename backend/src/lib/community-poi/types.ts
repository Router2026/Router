// src/lib/community-poi/types.ts — UPDATED: added region fields

export type CommunityPoiStatus = "pending" | "approved" | "rejected";

export interface CommunityPoiRow {
  id: number;
  user_id: number | null;
  name: string;
  category: string;
  description: string | null;
  latitude: string;
  longitude: string;
  photos: string[];
  status: CommunityPoiStatus;
  admin_note: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Extra detail fields (optional, supplied by contributor)
  difficulty: string | null;
  duration_minutes: number | null;
  has_water: boolean | null;
  has_shade: boolean | null;
  accessible: boolean | null;
  photo_credit: string | null;
  // Auto-classified from coordinates
  region: string | null;
  region_id: number | null;
  // Joined fields
  submitter_username?: string;
  submitter_email?: string;
}

export interface CreateCommunityPoiInput {
  userId: number;
  name: string;
  category: string;
  description?: string;
  latitude: number;
  longitude: number;
  photos?: string[];
  difficulty?: string;
  duration_minutes?: number;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  photo_credit?: string;
}