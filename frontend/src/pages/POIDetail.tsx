import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type POI, type Review, type CommunityReport, type LocationImage, type LocationMedia, type NearbyPOI, type RatingSummary, type Region } from '../api';
import { useAuth } from '../context/AuthContext';
import { useGuestLock } from '../components/LockedFeature';
import { useTripBucket } from '../context/TripBucketContext';
import TripBucketSheet from '../components/TripBucketSheet';
import TripBucketFab from '../components/TripBucketFab';
import FavoriteButton from '../components/FavoriteButton';
import UploadPhotoButton from '../components/UploadPhotoButton';
import XpToast from '../components/XpToast';
import POIDetailsEditAdmin from './POIDetailsEditAdmin';
import { getImageUrl } from '../utils/imageUtils';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const DIFF_COLORS: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#dc2626',
};

// ── OSRM routing helper (unchanged) ──────────────────────────────────────────

async function fetchRoute(from: [number, number], to: [number, number]): Promise<{ coords: [number, number][]; distanceKm: number; durationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=simplified&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok') return null;
    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    return { coords, distanceKm: route.distance / 1000, durationMin: Math.round(route.duration / 60) };
  } catch { return null; }
}

function RouteLayer({ userCoords, poiCoords, onRouteLoaded }: {
  userCoords: [number, number] | null; poiCoords: [number, number];
  onRouteLoaded: (info: { distanceKm: number; durationMin: number }) => void;
}) {
  const map = useMap();
  const lineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  useEffect(() => {
    if (!userCoords) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = L.circleMarker(userCoords, { radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
    userMarkerRef.current.bindTooltip('המיקום שלי', { permanent: false });
    fetchRoute(userCoords, poiCoords).then(route => {
      lineRef.current?.remove();
      if (route) {
        lineRef.current = L.polyline(route.coords, { color: '#0d9e6e', weight: 4, opacity: 0.85, dashArray: '8,6' }).addTo(map);
        onRouteLoaded({ distanceKm: route.distanceKm, durationMin: route.durationMin });
        map.fitBounds(L.latLngBounds([userCoords, poiCoords]).pad(0.2));
      }
    });
    return () => { lineRef.current?.remove(); userMarkerRef.current?.remove(); };
  }, [userCoords, poiCoords, map, onRouteLoaded]);
  return null;
}

// ── HeroImage — lazy slides, Supabase image transforms ───────────────────────
// OPTIMISED:
//  • Only current slide + the next slide are mounted in DOM.
//    Previously ALL images were rendered simultaneously.
//  • src goes through getImageUrl('hero') → 820px WebP.
//    Originals can be 2-5 MB; transformed version is <120 KB.
//  • Preload link injected for the first image (LCP element).

function HeroImage({ poi, galleryImages, photoCredit }: {
  poi: POI; galleryImages: LocationImage[]; photoCredit?: string;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const images = useMemo(() => {
    const allUrls = galleryImages.map(i => i.image_url);
    const main = poi.main_image || allUrls[0] || '';
    const all = main
      ? [main, ...poi.images.filter(i => i !== main), ...allUrls.filter(u => u !== main)]
      : [...poi.images, ...allUrls];
    return [...new Set(all)].filter(Boolean);
  }, [poi.main_image, poi.images, galleryImages]);

  // Inject <link rel="preload"> for the LCP hero image
  useEffect(() => {
    if (!images[0]) return;
    const href = getImageUrl(images[0], 'hero');
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [images]);

  const currentSrc = !imgError && images[imgIdx] ? getImageUrl(images[imgIdx], 'hero') : null;
  const nextSrc = images[imgIdx + 1] ? getImageUrl(images[imgIdx + 1], 'hero') : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {currentSrc ? (
        // Only render current + next slide — previous slides are unmounted
        <>
          <img
            key={currentSrc}
            src={currentSrc}
            alt={poi.name}
            onError={() => setImgError(true)}
            // First image: eager (it's the LCP); subsequent: lazy
            loading={imgIdx === 0 ? 'eager' : 'lazy'}
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1, transition: 'opacity 0.25s ease' }}
          />
          {/* Preload the next slide at low priority so it's ready when user swipes */}
          {nextSrc && (
            <img
              key={`next-${nextSrc}`}
              src={nextSrc}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, pointerEvents: 'none' }}
            />
          )}
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0d9e6e 0%, #34d399 60%, #0284c7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 72, opacity: 0.3 }}>🏞️</span>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.65) 100%)' }} />

      {photoCredit && imgIdx === 0 && !imgError && currentSrc && (
        <div style={{ position: 'absolute', bottom: 22, left: 16, background: 'rgba(255,255,255,0.92)', borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: 'Heebo, sans-serif', direction: 'rtl', pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', zIndex: 13, lineHeight: 1.4 }}>
          צילום: {photoCredit}
        </div>
      )}

      {images.length > 1 && !imgError && (
        <>
          {/* Swipe areas for mobile */}
          <button
            onClick={() => setImgIdx(i => Math.max(0, i - 1))}
            aria-label="תמונה קודמת"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 11 }}
          />
          <button
            onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
            aria-label="תמונה הבאה"
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 11 }}
          />
          {/* Dot indicators */}
          <div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 12 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                style={{ width: i === imgIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s ease' }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── MiniMap — CARTO tile layer ────────────────────────────────────────────────

function MiniMap({ poi }: { poi: POI }) {
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const poiCoords = useMemo<[number, number]>(() => [poi.latitude, poi.longitude], [poi.latitude, poi.longitude]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGeoError('הדפדפן אינו תומך בגישה למיקום'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserCoords([pos.coords.latitude, pos.coords.longitude]); setGeoError(null); setGeoLoading(false); },
      () => { setGeoError('לא ניתן לקבל את מיקומך'); setGeoLoading(false); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };
  const onRouteLoaded = useCallback((info: { distanceKm: number; durationMin: number }) => setRouteInfo(info), []);

  return (
    <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'rtl' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {routeInfo && (
            <>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0d9e6e' }}>{routeInfo.distanceKm.toFixed(1)} ק"מ</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>מרחק</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0d9e6e' }}>{routeInfo.durationMin} דק'</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>זמן נסיעה</div>
              </div>
            </>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>🗺️ מפת ניווט</div>
      </div>
      <div style={{ height: 220, position: 'relative' }}>
        <MapContainer center={poiCoords} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={poiCoords} />
          {userCoords && <RouteLayer userCoords={userCoords} poiCoords={poiCoords} onRouteLoaded={onRouteLoaded} />}
        </MapContainer>
      </div>
      <div style={{ padding: '12px 16px', direction: 'rtl' }}>
        {geoError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8, textAlign: 'center' }}>{geoError}</div>}
        {!userCoords ? (
          <button onClick={handleGetLocation} disabled={geoLoading}
            style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 14, background: geoLoading ? '#e2e8f0' : 'linear-gradient(135deg, #3b82f6, #60a5fa)', color: geoLoading ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 700, cursor: geoLoading ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            {geoLoading ? '⏳ מאתר מיקום...' : '📍 הצג מסלול מהמיקום שלי'}
          </button>
        ) : (
          <button onClick={() => window.open(`https://waze.com/ul?q=${poi.latitude},${poi.longitude}`, '_blank')}
            style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            פתח ב-Waze
          </button>
        )}
      </div>
    </div>
  );
}

// ── StarRating (unchanged) ────────────────────────────────────────────────────

function StarRating({ locationId, initialSummary, isLoggedIn }: {
  locationId: number; initialSummary: RatingSummary | null; isLoggedIn: boolean;
}) {
  const [summary, setSummary] = useState<RatingSummary | null>(initialSummary);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justRated, setJustRated] = useState(false);
  useEffect(() => { setSummary(initialSummary); }, [initialSummary]);

  const handleRate = async (star: number) => {
    if (!isLoggedIn || saving) return;
    setSaving(true);
    try {
      const updated = await api.locations.rate(locationId, star);
      setSummary(updated); setJustRated(true);
      setTimeout(() => setJustRated(false), 2000);
    } catch { }
    finally { setSaving(false); }
  };

  const displayRating = summary?.average ?? 0;
  const userRating = summary?.userRating ?? 0;
  const ratingCount = summary?.count ?? 0;
  const activeStars = hovered || userRating;

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => handleRate(star)}
              onMouseEnter={() => isLoggedIn && setHovered(star)} onMouseLeave={() => setHovered(0)}
              disabled={saving || !isLoggedIn}
              style={{ background: 'none', border: 'none', padding: '2px', cursor: isLoggedIn ? 'pointer' : 'default', fontSize: 22, lineHeight: 1, color: star <= activeStars ? '#f59e0b' : star <= displayRating ? '#fcd34d' : '#d1d5db', transition: 'color 0.1s, transform 0.1s', transform: hovered === star ? 'scale(1.2)' : 'scale(1)' }}>
              ★
            </button>
          ))}
        </div>
        <span style={{ fontWeight: 900, color: '#1a2e2a', fontSize: 18 }}>{displayRating.toFixed(1)}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>({ratingCount} דירוגים)</span>
      </div>
      {justRated && <div style={{ fontSize: 12, color: '#0d9e6e', fontWeight: 700 }}>✓ הדירוג שלך נשמר!</div>}
      {!isLoggedIn && <div style={{ fontSize: 11, color: '#94a3b8' }}>התחבר כדי לדרג את המקום</div>}
      {isLoggedIn && !userRating && !hovered && <div style={{ fontSize: 11, color: '#94a3b8' }}>לחץ על כוכב כדי לדרג</div>}
    </div>
  );
}

// ── MediaGallery — lazy thumbnails + transform URLs ──────────────────────────
// OPTIMISED:
//  • Grid thumbnails: getImageUrl(url, 'card') → 420px WebP, loading="lazy"
//  • Lightbox viewer: getImageUrl(url, 'lightbox') → 1400px WebP
//    Image only loaded when lightbox is opened (not pre-fetched at page load)

function MediaGallery({ locationId, media, isAdmin, onApprove, onReject }: {
  locationId: number; media: LocationMedia[];
  isAdmin: boolean; onApprove: (id: number) => void; onReject: (id: number) => void;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  if (!media.length) return null;

  const closeLightbox = () => setLightboxIdx(null);
  const prevItem = () => setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : null);
  const nextItem = () => setLightboxIdx(i => i !== null ? Math.min(media.length - 1, i + 1) : null);

  return (
    <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, direction: 'rtl' }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{media.length} פריטים</span>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>📸 גלריית קהילה</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
        {media.map((item, idx) => (
          <div key={item.id}
            style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #0d9e6e', cursor: 'pointer', aspectRatio: '1' }}
            onClick={() => setLightboxIdx(idx)}>

            {item.media_type === 'video' ? (
              <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.thumbnail_url && (
                  // Video thumbnail — use card size (420px), lazy
                  <img
                    src={getImageUrl(item.thumbnail_url, 'card')}
                    alt="video thumbnail"
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                  />
                )}
                <div style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 16, marginRight: -2 }}>▶</span>
                </div>
              </div>
            ) : (
              // Photo thumbnail — 420px WebP, lazy loaded
              <img
                src={getImageUrl(item.media_url, 'card')}
                alt={item.caption || 'gallery'}
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
              />
            )}

            {item.media_type === 'video' && (
              <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 5px', fontSize: 9, color: '#fff', fontWeight: 700 }}>▶ סרטון</div>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '12px 4px 4px', fontSize: 9, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontWeight: 600 }}>
              {item.username || 'משתמש'}
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <button onClick={() => onReject(item.id)}
                  style={{ flex: 1, padding: '3px', fontSize: 9, border: 'none', borderRadius: 5, background: '#f87171', color: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>הסר</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox — images loaded at full quality only when opened */}
      {lightboxIdx !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={closeLightbox}>
          <div style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={closeLightbox}
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', zIndex: 1 }}>✕</button>

            {media[lightboxIdx].media_type === 'video' ? (
              <video src={media[lightboxIdx].media_url} controls autoPlay
                style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: 12 }} playsInline />
            ) : (
              // Lightbox: 1400px WebP — high quality but still ~5× smaller than original
              <img
                src={getImageUrl(media[lightboxIdx].media_url, 'lightbox')}
                alt={media[lightboxIdx].caption || ''}
                style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }}
              />
            )}

            <div style={{ marginTop: 12, textAlign: 'center', color: '#fff', direction: 'rtl' }}>
              {media[lightboxIdx].caption && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{media[lightboxIdx].caption}</div>}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                📷 {media[lightboxIdx].username || 'משתמש'} · {new Date(media[lightboxIdx].created_at).toLocaleDateString('he-IL')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              <button onClick={prevItem} disabled={lightboxIdx === 0}
                style={{ background: lightboxIdx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 44, height: 44, fontSize: 20, cursor: lightboxIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, alignSelf: 'center' }}>{lightboxIdx + 1} / {media.length}</span>
              <button onClick={nextItem} disabled={lightboxIdx === media.length - 1}
                style={{ background: lightboxIdx === media.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 44, height: 44, fontSize: 20, cursor: lightboxIdx === media.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NearbyPlaces — optimised thumbnails ──────────────────────────────────────

function NearbyPlaces({ locationId }: { locationId: number }) {
  const navigate = useNavigate();
  const [nearby, setNearby] = useState<NearbyPOI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.locations.getNearby(locationId, 6, 30000)
      .then(data => setNearby(data))
      .catch(() => setNearby([]))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) return (
    <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '16px 18px', marginBottom: 16, direction: 'rtl' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>📍 מקומות קרובים</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'hidden' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ flexShrink: 0, width: 140, height: 120, borderRadius: 14, background: '#f0f0f0' }} />)}
      </div>
    </div>
  );

  if (!nearby.length) return null;

  const formatDistance = (m: number) => m < 1000 ? `${Math.round(m)} מ'` : `${(m / 1000).toFixed(1)} ק"מ`;

  return (
    <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12, direction: 'rtl' }}>📍 מקומות קרובים</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' as any }}>
        {nearby.map(place => (
          <div key={place.id} onClick={() => navigate(`/POIDetail?id=${place.id}`)}
            style={{ flexShrink: 0, width: 150, borderRadius: 16, overflow: 'hidden', border: '1px solid #f0f0f0', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
            <div style={{ height: 90, position: 'relative', background: 'linear-gradient(135deg, #0d9e6e, #34d399)' }}>
              {place.main_image ? (
                // 120px WebP thumb — tiny payload for the horizontal scroll row
                <img
                  src={getImageUrl(place.main_image, 'thumb')}
                  alt={place.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <span style={{ fontSize: 28, opacity: 0.5 }}>🏞️</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '2px 7px', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                {formatDistance(place.distance_meters)}
              </div>
            </div>
            <div style={{ padding: '8px 10px', direction: 'rtl' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1a2e2a', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{place.category}</span>
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>★ {place.average_rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main POIDetail (unchanged structure, imageUtils wired in above) ────────────

export default function POIDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiId = searchParams.get('id') || '';
  const { user, isLoggedIn, isGuest } = useAuth();
  const { hasPoi, addPoi, removePoi, openSheet } = useTripBucket();
  const reportLock = useGuestLock('דיווח');
  const reviewLock = useGuestLock('הוספת ביקורת');

  const [poi, setPoi] = useState<POI | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [galleryImages, setGalleryImages] = useState<LocationImage[]>([]);
  const [media, setMedia] = useState<LocationMedia[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [tab, setTab] = useState<'reports' | 'reviews'>('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [shareXp, setShareXp] = useState<any>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  const poiIdNum = Number(poiId);
  const isAdmin = user?.is_admin ?? false;

  useEffect(() => {
    if (!poiId) return;
    setLoading(true); setError(null);
    if (user?.is_admin) api.regions.list().then(setRegions).catch(() => { });
    api.locations.get(poiId)
      .then(async poiData => {
        setPoi(poiData);
        const [revs, reps, imgs, mediaData, rating] = await Promise.all([
          api.reviews.list(Number(poiId)),
          api.reports.list(Number(poiId)),
          api.locations.getImages(Number(poiId)).catch(() => []),
          api.locations.getMedia(Number(poiId)).catch(() => []),
          api.locations.getRating(Number(poiId)).catch(() => null),
        ]);
        setReviews(revs); setReports(reps); setGalleryImages(imgs);
        setMedia(mediaData); setRatingSummary(rating); setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [poiId]);

  const handleApproveMedia = async (mediaId: number) => {
    if (!poi) return;
    await api.locations.approveMedia(poi.id, mediaId);
    setMedia(prev => prev.map(m => m.id === mediaId ? { ...m, is_approved: true } : m));
  };
  const handleRejectMedia = async (mediaId: number) => {
    if (!poi) return;
    await api.locations.rejectMedia(poi.id, mediaId);
    setMedia(prev => prev.map(m => m.id === mediaId ? { ...m, is_approved: false } : m));
  };
  const handleApproveImage = async (imageId: number) => {
    if (!poi) return;
    await api.locations.approveImage(poi.id, imageId);
    setGalleryImages(prev => prev.map(i => i.id === imageId ? { ...i, is_approved: true } : i));
  };
  const handleRejectImage = async (imageId: number) => {
    if (!poi) return;
    await api.locations.rejectImage(poi.id, imageId);
    setGalleryImages(prev => prev.map(i => i.id === imageId ? { ...i, is_approved: false } : i));
  };

  const openGoogleMaps = () => {
    if (!poi) return;
    window.open(`https://maps.google.com/?q=${poi.latitude},${poi.longitude}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}><div>טוען...</div></div>;
  if (error || !poi) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', gap: 12 }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <div style={{ fontWeight: 700 }}>לא ניתן לטעון את המקום</div>
      <button onClick={() => navigate(-1)} style={{ background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>חזרה</button>
    </div>
  );

  const legacyAsMedia: LocationMedia[] = galleryImages.map(img => ({
    id: img.id, location_id: img.location_id, user_id: img.user_id,
    media_type: 'image' as const, media_url: img.image_url,
    thumbnail_url: null, caption: null, is_approved: img.is_approved,
    created_at: img.created_at, username: img.username,
  }));
  const allMedia: LocationMedia[] = [
    ...media,
    ...legacyAsMedia.filter(l => !media.some(m => m.media_url === l.media_url)),
  ];

  const diffColor = DIFF_COLORS[poi.difficulty] || '#16a34a';

  return (
    <>
      {shareXp && <XpToast xp={shareXp} onDone={() => setShareXp(null)} />}
      {showAdminEdit && (
        <POIDetailsEditAdmin poi={poi} regions={regions} onClose={() => setShowAdminEdit(false)}
          onSaved={updated => { setPoi(updated); setShowAdminEdit(false); }}
          onDeleted={_id => { navigate(-1); }} />
      )}

      <div style={{ background: '#f0f4f3', minHeight: '100vh', width: '100%' }}>
        {/* Hero Banner */}
        <div style={{ position: 'relative', height: 350, width: '100%' }}>
          <HeroImage poi={poi} galleryImages={galleryImages} photoCredit={poi.photo_credit} />
          <div style={{ maxWidth: 600, margin: '0 auto', height: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => navigator.share?.({ title: poi.name, url: window.location.href })}
                  style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                </button>
                {!isNaN(poiIdNum) && <FavoriteButton locationId={poiIdNum} size={20} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 14, width: 42, height: 42 }} />}
                {isAdmin && (
                  <button onClick={() => setShowAdminEdit(true)}
                    style={{ background: 'rgba(124,58,237,0.9)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                )}
              </div>
              <button onClick={() => navigate(-1)}
                style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 20px 32px', direction: 'rtl', zIndex: 10 }}>
              <span style={{ display: 'inline-block', background: diffColor, color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 800, marginBottom: 12 }}>{poi.difficulty}</span>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{poi.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.95)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{poi.region}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px', marginTop: -20, position: 'relative', zIndex: 20, paddingBottom: 100 }}>
          {/* Info card */}
          <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', padding: '24px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, direction: 'rtl' }}>
              <span style={{ background: '#f0fdf8', color: '#0d9e6e', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 800 }}>{poi.category}</span>
              <StarRating locationId={poiIdNum} initialSummary={ratingSummary} isLoggedIn={isLoggedIn} />
            </div>
            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, textAlign: 'right', marginBottom: 24 }}>{poi.description}</p>
            {poi.uploaded_by && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf8', borderRadius: 12, padding: '10px 14px', marginBottom: 16, direction: 'rtl', border: '1px solid #d1fae5' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>מקום זה נוסף על ידי</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#065f46' }}>{poi.uploaded_by}</div>
                </div>
                <div style={{ fontSize: 11, color: '#0d9e6e', fontWeight: 700, background: '#d1fae5', borderRadius: 8, padding: '3px 9px' }}>קהילה 🌿</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', direction: 'rtl' }}>
              {poi.duration_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#64748b' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>{poi.duration_minutes} דקות</span>}
              {poi.has_water && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0284c7' }}>💧 יש מים</span>}
              {poi.has_shade && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🌿 יש צל</span>}
              {poi.accessible && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#faf5ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>♿ נגיש</span>}
            </div>
            <button onClick={openGoogleMaps}
              style={{ width: '100%', marginTop: 20, padding: '14px', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(13,158,110,0.25)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              פתח בגוגל מפות
            </button>
            {(() => {
              const inBucket = poi && hasPoi(poi.id);
              return (
                <button onClick={() => { if (!poi) return; if (inBucket) { removePoi(poi.id); } else { addPoi(poi); openSheet(); } }}
                  style={{ width: '100%', marginTop: 10, padding: '14px', borderRadius: 16, background: inBucket ? '#fef2f2' : '#f0fdf8', color: inBucket ? '#dc2626' : '#0d9e6e', fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `2px solid ${inBucket ? '#fca5a5' : '#6ee7b7'}`, transition: 'all 0.18s' }}>
                  {inBucket ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>הסר מסל המסלול</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>הוסף לסל המסלול 🎒</>}
                </button>
              );
            })()}
          </div>

          <MiniMap poi={poi} />
          {!isNaN(poiIdNum) && <NearbyPlaces locationId={poiIdNum} />}
          <MediaGallery locationId={poiIdNum} media={allMedia} isAdmin={isAdmin}
            onApprove={id => { if (media.some(m => m.id === id)) handleApproveMedia(id); else handleApproveImage(id); }}
            onReject={id => { if (media.some(m => m.id === id)) handleRejectMedia(id); else handleRejectImage(id); }} />

          {isLoggedIn && !isNaN(poiIdNum) && (
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-start', direction: 'rtl' }}>
              <UploadPhotoButton locationId={poiIdNum} onUploaded={newMedia => setMedia(prev => [newMedia, ...prev])} />
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 20, padding: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: 16, display: 'flex', direction: 'rtl' }}>
            {[{ key: 'reports', label: `דיווחים (${reports.length})` }, { key: 'reviews', label: `ביקורות (${reviews.length})` }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                style={{ flex: 1, padding: '12px', borderRadius: 16, border: 'none', background: tab === t.key ? '#0d9e6e' : 'transparent', color: tab === t.key ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'reports' && (
            <div style={{ direction: 'rtl' }}>
              {reports.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>אין דיווחים עדיין לאתר זה</div>}
              {reports.slice(0, 5).map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 18, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.reporter_name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706', background: '#fffbeb', borderRadius: 8, padding: '4px 10px' }}>{r.report_type}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#475569', textAlign: 'right', margin: 0 }}>{r.content}</p>
                </div>
              ))}
              {isLoggedIn ? (
                <button onClick={() => navigate(`/AddReport?poi_name=${encodeURIComponent(poi.name)}&location_id=${poiId}`)}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>+ הוסף דיווח</button>
              ) : isGuest ? (
                <><button onClick={() => reportLock.guardAction(() => { })}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #fbbf24', borderRadius: 18, background: '#fffbeb', color: '#92400e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>🔒 הוסף דיווח — דרוש חשבון</button>{reportLock.PromptComponent}</>
              ) : (
                <button onClick={() => navigate('/Login')}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #94a3b8', borderRadius: 18, background: '#f8fafc', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>🔑 התחבר כדי להוסיף דיווח</button>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div style={{ direction: 'rtl' }}>
              {reviews.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>אין ביקורות עדיין</div>}
              {reviews.map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 18, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 2 }}>{'★'.repeat(r.rating)}</div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>{r.reviewer_name}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#475569', textAlign: 'right', margin: 0 }}>{r.content}</p>
                </div>
              ))}
              {isLoggedIn ? (
                <button onClick={() => navigate(`/AddReview?poi_name=${encodeURIComponent(poi.name)}&location_id=${poiId}`)}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>+ כתוב ביקורת</button>
              ) : isGuest ? (
                <><button onClick={() => reviewLock.guardAction(() => { })}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #fbbf24', borderRadius: 18, background: '#fffbeb', color: '#92400e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>🔒 כתוב ביקורת — דרוש חשבון</button>{reviewLock.PromptComponent}</>
              ) : (
                <button onClick={() => navigate('/Login')}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #94a3b8', borderRadius: 18, background: '#f8fafc', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>🔑 התחבר כדי לכתוב ביקורת</button>
              )}
            </div>
          )}

          <button onClick={() => window.open(`https://waze.com/ul?ll=${poi.latitude},${poi.longitude}&navigate=yes`, '_blank')}
            style={{ width: '100%', padding: '18px', border: 'none', borderRadius: 20, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(13,158,110,0.25)', marginTop: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            נווט לשם
          </button>
        </div>
      </div>

      <TripBucketFab />
      <TripBucketSheet />
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}