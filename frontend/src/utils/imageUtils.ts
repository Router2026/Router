const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

// ── Size presets ──────────────────────────────────────────────────────────────
// width: longest edge in px. quality: 1-100 (WebP).
// Keep quality ≥ 75 for hero/lightbox — visible difference below that on OLED.

export type ImageSize = 'marker' | 'card' | 'hero' | 'lightbox' | 'thumb';

const SIZE_MAP: Record<ImageSize, { width: number; quality: number }> = {
    marker: { width: 80, quality: 60 },  // Leaflet photo markers
    thumb: { width: 120, quality: 65 },  // NearbyPlaces row thumbnails
    card: { width: 420, quality: 75 },   // Explore grid cards (~160px tall)
    hero: { width: 820, quality: 82 },   // POIDetail hero banner
    lightbox: { width: 1400, quality: 88 },  // Full-screen lightbox viewer
};

/**
 * Returns a resized, WebP-converted URL for a Supabase Storage image.
 *
 * @param src   Original image URL (from `main_image`, `image_url`, etc.)
 * @param size  One of the preset sizes above
 * @returns     Transform URL if src is a Supabase Storage URL; original src otherwise
 *
 * @example
 * <img src={getImageUrl(poi.main_image, 'card')} />
 * <img src={getImageUrl(marker.image, 'marker')} />
 */
export function getImageUrl(src: string | null | undefined, size: ImageSize): string {
    if (!src) return '';

    // Only transform URLs that belong to this Supabase project's storage bucket.
    // External CDN links, blob: URLs, data: URIs etc. are returned as-is.
    const storagePrefix = SUPABASE_URL
        ? `${SUPABASE_URL}/storage/v1/object/public/`
        : null;

    if (!storagePrefix || !src.startsWith(storagePrefix)) return src;

    // Extract: bucket name + file path
    const withoutPrefix = src.replace(storagePrefix, '');
    const slashIdx = withoutPrefix.indexOf('/');
    if (slashIdx === -1) return src; // malformed — return original

    const bucket = withoutPrefix.slice(0, slashIdx);
    const filePath = withoutPrefix.slice(slashIdx + 1);

    const { width, quality } = SIZE_MAP[size];

    // Supabase Image Transformation endpoint:
    // /storage/v1/render/image/public/{bucket}/{path}?width=N&quality=N&format=webp
    return (
        `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${filePath}` +
        `?width=${width}&quality=${quality}&format=webp`
    );
}

/**
 * Generates a srcSet string for responsive images.
 * Use together with sizes= attribute for best results.
 *
 * @example
 * <img
 * src={getImageUrl(src, 'card')}
 * srcSet={getSrcSet(src, 'card')}
 * sizes="(max-width: 640px) 100vw, 420px"
 * />
 */
export function getSrcSet(src: string | null | undefined, size: ImageSize): string {
    if (!src) return '';
    const base = SIZE_MAP[size].width;
    const retina = Math.min(base * 2, 1600);
    return [
        `${getImageUrl(src, size)} ${base}w`,
        `${getImageUrl(src, size === 'card' ? 'hero' : 'lightbox')} ${retina}w`,
    ].join(', ');
}

// ── Fallback Logic (Req 3) ────────────────────────────────────────────────────

/**
 * Any object that can have a main image and a gallery array.
 * Covers both router.locations (images: string[]) and
 * router.community_pois (photos: string[]).
 */
export interface ImageSource {
  main_image?: string | null;
  images?: string[];    // locations table
  photos?: string[];    // community_pois table
}

/**
 * Returns the best available image URL for a place, in priority order:
 *
 * 1. main_image  (if the column has a non-empty string)
 * 2. images[0]   (first item in the gallery, for router.locations)
 * 3. photos[0]   (first item in the community gallery, for community_pois)
 * 4. ''          (empty string — callers should fall back to a logo/placeholder)
 *
 * @example
 * // In a card component:
 * <img src={resolveMainImage(poi) || RouterLogo} />
 */
export function resolveMainImage(source: ImageSource): string {
  // Priority 1: explicit main_image that is a non-empty string
  if (source.main_image && source.main_image.trim() !== '') {
    return source.main_image.trim();
  }

  // Priority 2: first item in the locations gallery array
  const firstGallery = source.images?.find(u => u && u.trim() !== '');
  if (firstGallery) return firstGallery.trim();

  // Priority 3: first item in the community photos array
  const firstPhoto = source.photos?.find(u => u && u.trim() !== '');
  if (firstPhoto) return firstPhoto.trim();

  // No image available
  return '';
}