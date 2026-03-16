/** POI status values aligned with the DB enum */
export type CommunityPoiStatus = 'pending' | 'approved' | 'rejected';

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
}
