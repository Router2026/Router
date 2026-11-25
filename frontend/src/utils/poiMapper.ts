import type { POI } from '../api';

/**
 * Maps a slim location row from the backend (/api/locations, /api/locations/search,
 * /api/assistant/chat) to the frontend POI shape.
 */
export function mapRawToPoi(raw: Record<string, unknown>): POI {
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? '',
    category: raw.category,
    region: (raw.region_name ?? raw.region ?? '') as string,
    region_id: raw.region_id,
    latitude: raw.latitude,
    longitude: raw.longitude,
    images: raw.images ?? [],
    main_image: raw.main_image ?? '',
    difficulty: raw.difficulty ?? 'בינוני',
    duration_minutes: raw.duration_minutes,
    has_water: raw.has_water,
    has_shade: raw.has_shade,
    accessible: raw.accessible,
    is_featured: raw.is_featured,
    average_rating: raw.average_rating ?? 4,
    photo_credit: raw.photo_credit,
    uploaded_by: raw.uploaded_by,
    distance_meters: raw.distance_meters,
  } as POI;
}
