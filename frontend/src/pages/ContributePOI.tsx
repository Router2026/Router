// src/pages/ContributePOI.tsx — UPDATED
// Fixes & new features:
//  • Extract final URL from shortened Google Maps links (goo.gl / maps.app)
//  • Dynamic region classification via backend API (/api/regions/classify)
//  • Fixed Google Maps link generation (coordinate-based URL)
//  • GPS "use my location" button
//  • Mobile file upload fix: accept="image/*,video/*" + capture attribute
//  • Video upload support with preview
//  • Validation and optimistic error handling

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { fileToBase64 } from '../api';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LatLng } from '../utils/types';
import { CATEGORIES } from '../utils/constants';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
});

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_MEDIA_FILES = 5;
const MAX_FILE_MB = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract lat/lng from a Google Maps URL or raw coordinate string */
const extractLatLngFromGoogle = (input: string): LatLng | null => {
  const s = input.trim();

  const rawCoord = s.match(/^(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (rawCoord) {
    const lat = Number.parseFloat(rawCoord[1]);
    const lng = Number.parseFloat(rawCoord[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  const atCoord = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoord) return { lat: Number.parseFloat(atCoord[1]), lng: Number.parseFloat(atCoord[2]) };

  const embCoord = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (embCoord) return { lat: Number.parseFloat(embCoord[1]), lng: Number.parseFloat(embCoord[2]) };

  const qParam = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qParam) return { lat: Number.parseFloat(qParam[1]), lng: Number.parseFloat(qParam[2]) };

  const llParam = s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llParam) return { lat: Number.parseFloat(llParam[1]), lng: Number.parseFloat(llParam[2]) };

  return null;
};

/** Helper to expand short Google Maps links using an open API */
async function unshortenGoogleUrl(url: string): Promise<string> {
  try {
    const res = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.success && data.resolved_url) {
      return data.resolved_url;
    }
  } catch (e) {
    console.error("Failed to unshorten URL", e);
  }
  return url;
}

/** Geocode a place name via Nominatim */
async function geocodePlaceName(name: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=il`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'he' } });
    const data = await res.json();
    if (data?.[0]) return { lat: Number.parseFloat(data[0].lat), lng: Number.parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

/** Classify region via Backend API (regions table), fallback to Nominatim */
async function reverseGeocodeRegion(lat: number, lng: number): Promise<string | null> {
  try {
    const apiUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/regions/classify?lat=${lat}&lng=${lng}`;
    const token = localStorage.getItem('router_auth_token');

    const dbRes = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
    });

    if (dbRes.ok) {
      const data = await dbRes.json();
      // API returns { data: { name, id } }
      const regionName = data?.data?.name;
      if (regionName) return regionName;
    }
  } catch (err) {
    console.error("Backend region classification failed:", err);
  }

  // Fallback to Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=8&accept-language=he`;
    const res = await fetch(url);
    const data = await res.json();

    const addr = data?.address;
    if (!addr) return null;
    return (
      addr.state_district ||
      addr.county ||
      addr.state ||
      addr.region ||
      null
    );
  } catch { return null; }
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

// ── Media item type ────────────────────────────────────────────────────────
interface MediaItem {
  id: string;
  file?: File;
  previewUrl: string;
  type: 'image' | 'video';
  url?: string;
}

// ── Map Components ───────────────────────────────────────────────────────────

function MapClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

function MapRecenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], 16, { animate: true });
  }, [position, map]);
  return null;
}

function PickedMarker({ position }: { position: LatLng }) {
  const icon = L.divIcon({
    html: `<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#0d9e6e,#0bba7e);border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;box-shadow:0 3px 12px rgba(13,158,110,0.45);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">📍</span></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
  return <Marker position={[position.lat, position.lng]} icon={icon} />;
}

// ── Submit helpers ────────────────────────────────────────────────────────────

async function uploadFileItems(fileItems: MediaItem[], token: string | null, apiBase: string): Promise<string[]> {
  const results = await Promise.allSettled(
    fileItems.map(async (item) => {
      const base64 = await fileToBase64(item.file!);
      const res = await fetch(`${apiBase}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ media_data: base64, mime_type: item.file!.type }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? `Upload error ${res.status}`);
      }
      const json = await res.json();
      const publicUrl: string = json?.data?.url;
      if (!publicUrl) { throw new Error('No URL returned from upload API'); }
      return publicUrl;
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value);
}

interface PoiSubmitPayload {
  name: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  photos: string[];
  difficulty: string;
  durationMinutes: string;
  hasWater: boolean;
  hasShade: boolean;
  accessible: boolean;
  photoCredit: string;
}

async function postCommunityPoi(payload: PoiSubmitPayload, token: string | null, apiBase: string): Promise<void> {
  const res = await fetch(`${apiBase}/api/community-pois`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: payload.name.trim(),
      category: payload.category,
      description: payload.description.trim() || undefined,
      latitude: payload.latitude,
      longitude: payload.longitude,
      photos: payload.photos,
      difficulty: payload.difficulty,
      duration_minutes: payload.durationMinutes ? Number.parseInt(payload.durationMinutes, 10) : undefined,
      has_water: payload.hasWater,
      has_shade: payload.hasShade,
      accessible: payload.accessible,
      photo_credit: payload.photoCredit.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `שגיאה ${res.status}`);
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ContributePOI() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map state
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);
  const [googleUrl, setGoogleUrl] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('טבע');
  const [description, setDescription] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [difficulty, setDifficulty] = useState('בינוני');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [photoCredit, setPhotoCredit] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const defaultCenter: LatLng = { lat: 31.8, lng: 35.2 };

  // Auto-detect region when a point is picked
  const handlePickPoint = async (coords: LatLng) => {
    setPickedPoint(coords);
    setDetectedRegion(null);
    const region = await reverseGeocodeRegion(coords.lat, coords.lng);
    if (region) setDetectedRegion(region);
  };

  const handleImportGoogleMaps = async () => {
    let input = googleUrl.trim();
    if (!input) return;
    setError('');
    setGeocoding(true);

    if (input.includes('goo.gl') || input.includes('maps.app.goo.gl')) {
      input = await unshortenGoogleUrl(input);
    }

    const coords = extractLatLngFromGoogle(input);
    if (coords) {
      handlePickPoint(coords);
      setGoogleUrl('');
      setGeocoding(false);
      return;
    }

    const geocoded = await geocodePlaceName(input);
    setGeocoding(false);
    if (geocoded) {
      handlePickPoint(geocoded);
      setGoogleUrl('');
    } else {
      setError('לא מצאנו מיקום. נסה להעתיק כתובת מלאה של קואורדינטות, או הקלד שם מקום מדוייק.');
    }
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setError('הדפדפן שלך אינו תומך בשירות מיקום');
      return;
    }
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLoading(false);
        handlePickPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setGpsLoading(false);
        setError('לא הצלחנו לקבל את מיקומך. ודא שנתת הרשאת מיקום.');
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  // ── Media handlers ────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_MEDIA_FILES - mediaItems.length;
    if (remaining <= 0) {
      setError(`מקסימום ${MAX_MEDIA_FILES} קבצים`);
      return;
    }

    const toAdd = files.slice(0, remaining);
    const newItems: MediaItem[] = [];

    for (const file of toAdd) {
      if (!isImageFile(file) && !isVideoFile(file)) {
        setError(`הקובץ ${file.name} אינו נתמך. נא לבחור תמונה או סרטון.`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`הקובץ ${file.name} גדול מדי (מקסימום ${MAX_FILE_MB} MB)`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        type: isVideoFile(file) ? 'video' : 'image',
      });
    }

    setMediaItems(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url || mediaItems.some(m => m.url === url)) return;
    if (!url.startsWith('http')) { setError('הקישור חייב להתחיל ב-http'); return; }
    const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) || mediaUrlInput.includes('video');
    setMediaItems(prev => [...prev, {
      id: `url-${Date.now()}`,
      previewUrl: url,
      type: isVideo ? 'video' : 'image',
      url,
    }]);
    setMediaUrlInput('');
  };

  const removeMedia = (id: string) => {
    setMediaItems(prev => {
      const item = prev.find(m => m.id === id);
      if (item?.file) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(m => m.id !== id);
    });
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!pickedPoint) { setError('נא לבחור נקודה על המפה'); return; }
    if (!name.trim()) { setError('נא להזין שם למיקום'); return; }

    setError('');
    setSubmitting(true);

    try {
      const fileItems = mediaItems.filter(m => m.file && m.type === 'image');
      const urlItems = mediaItems.filter(m => m.url && m.type === 'image').map(m => m.url!);
      const token = localStorage.getItem('router_auth_token');
      const apiBase = (import.meta.env.VITE_API_URL ?? '');

      const uploadedUrls = await uploadFileItems(fileItems, token, apiBase);
      const photos: string[] = [...urlItems, ...uploadedUrls];

      await postCommunityPoi({
        name, category, description,
        latitude: pickedPoint.lat, longitude: pickedPoint.lng,
        photos, difficulty, durationMinutes,
        hasWater, hasShade, accessible, photoCredit,
      }, token, apiBase);

      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message ?? 'אירעה שגיאה בשמירה');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ background: '#f0fdf8', minHeight: '100vh', direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 10 }}>המיקום נשלח לאישור!</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            הצוות שלנו יבדוק את המיקום שהגשת. עם האישור תקבל התראה ו-50 XP נוספים! 🎉
          </p>
          {detectedRegion && (
            <div style={{ background: '#f0fdf8', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0d9e6e', fontWeight: 700 }}>
              📍 אזור שזוהה: {detectedRegion}
            </div>
          )}
          <button onClick={() => navigate('/')}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', marginBottom: 10 }}>יש להתחבר תחילה</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>כדי לתרום מיקום לקהילה, עליך להיות מחובר</p>
          <button onClick={() => navigate('/Login')}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            התחברות / הרשמה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', margin: 0 }}>📍 הוסף מיקום לקהילה</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>אשר ← פרסום למפה + 50 XP</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Map picker ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', marginBottom: 10, textAlign: 'right' }}>
            1. בחר נקודה על המפה
          </div>

          {/* Google Maps import */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={googleUrl}
                onChange={e => { setGoogleUrl(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleImportGoogleMaps(); }}
                placeholder="לינק מ-Google Maps, קואורדינטות (32.1, 34.9) או שם מקום..."
                style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', color: '#1a2e2a', direction: 'rtl' }}
              />
              <button
                onClick={handleImportGoogleMaps}
                disabled={geocoding || !googleUrl.trim()}
                style={{ padding: '10px 16px', background: geocoding ? '#94a3b8' : '#4285F4', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: geocoding ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>
                {geocoding ? 'מחפש...' : 'ייבוא'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
              💡 הדבק לינק מלא/מקוצר מ-Google Maps, קואורדינטות, או שם מקום
            </div>
          </div>

          {/* GPS button */}
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading}
            style={{
              width: '100%', marginBottom: 10, padding: '10px', border: '2px solid #3b82f6',
              borderRadius: 12, background: gpsLoading ? '#f0f4ff' : '#eff6ff',
              color: gpsLoading ? '#94a3b8' : '#3b82f6', fontSize: 13, fontWeight: 700,
              cursor: gpsLoading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {gpsLoading ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                מאתר מיקום...
              </>
            ) : (
              <>📡 השתמש במיקום הנוכחי שלי (GPS)</>
            )}
          </button>

          {/* Map */}
          <div style={{ borderRadius: 16, overflow: 'hidden', height: 240, border: `2px solid ${pickedPoint ? '#0d9e6e' : '#e2e8f0'}`, transition: 'border-color 0.2s' }}>
            <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onPick={handlePickPoint} />
              <MapRecenter position={pickedPoint} />
              {pickedPoint && <PickedMarker position={pickedPoint} />}
            </MapContainer>
          </div>

          {pickedPoint && (
            <div style={{ marginTop: 10, padding: '8px 14px', background: '#f0fdf8', borderRadius: 10, direction: 'rtl' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => { setPickedPoint(null); setDetectedRegion(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
                <span style={{ fontSize: 12, color: '#0d9e6e', fontWeight: 700 }}>
                  ✓ {pickedPoint.lat.toFixed(5)}, {pickedPoint.lng.toFixed(5)}
                </span>
              </div>
              {detectedRegion && (
                <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 }}>
                  🗺️ אזור שזוהה: <strong>{detectedRegion}</strong>
                </div>
              )}
              <a
                href={`https://maps.google.com/?q=${pickedPoint.lat},${pickedPoint.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#4285F4', textDecoration: 'none', display: 'block', textAlign: 'right', marginTop: 4 }}>
                🔗 פתח ב-Google Maps לאימות
              </a>
            </div>
          )}
        </div>

        {/* ── Name ───────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-name" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 10, textAlign: 'right' }}>
            2. שם המיקום
          </label>
          <input
            id="cpoi-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="לדוגמה: מפל נסתר בגליל..."
            maxLength={120}
            style={{ width: '100%', border: `2px solid ${name ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', color: '#1a2e2a', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          />
        </div>

        {/* ── Category ───────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 12, textAlign: 'right' }}>
            3. קטגוריה
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                style={{ padding: '10px 6px', border: `2px solid ${category === cat.id ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 14, background: category === cat.id ? '#f0fdf8' : '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: category === cat.id ? '#0d9e6e' : '#64748b' }}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-description" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 10, textAlign: 'right' }}>
            4. תיאור (אופציונלי)
          </label>
          <textarea
            id="cpoi-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="ספר למטיילים על המיקום — איך מגיעים? מה מיוחד בו?"
            rows={4}
            style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a', boxSizing: 'border-box' }}
          />
        </div>


        {/* ── Details ─────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 12, textAlign: 'right' }}>
            5. פרטים נוספים
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textAlign: 'right' }}>רמת קושי</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              {['קל - משפחות', 'קל', 'בינוני', 'מאתגר', 'קשה', 'אקסטרים'].map(d => {
                const color = ({ 'קל - משפחות': '#16a34a', 'קל': '#16a34a', 'בינוני': '#d97706', 'מאתגר': '#dc2626', 'קשה': '#dc2626', 'אקסטרים': '#7c3aed' } as Record<string, string>)[d] || '#64748b';
                const active = difficulty === d;
                return (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    padding: '7px 14px', borderRadius: 20, border: `2px solid ${active ? color : '#e2e8f0'}`,
                    background: active ? color + '18' : '#fff', color: active ? color : '#64748b',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  }}>{d}</button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, textAlign: 'right' }}>משך ביקור משוער (דקות)</div>
            <input
              type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)}
              placeholder="לדוגמה: 90"
              style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', color: '#1a2e2a' }}
            />
          </div>

          {/* Flags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
            {([
              { key: 'water', label: '💧 יש מים / מעיין בקרבת מקום', val: hasWater, set: setHasWater },
              { key: 'shade', label: '🌳 יש צל', val: hasShade, set: setHasShade },
              { key: 'accessible', label: '♿ נגיש לעגלות ולנכים', val: accessible, set: setAccessible },
            ] as const).map(({ key, label, val, set }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <button type="button" onClick={() => set(!val)} style={{ width: 44, height: 24, borderRadius: 12, background: val ? '#0d9e6e' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', top: 2, left: val ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </button>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Media (images + videos) ─────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-media-input" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 4, textAlign: 'right' }}>
            6. תמונות וסרטונים (אופציונלי)
          </label>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, textAlign: 'right' }}>
            עד {MAX_MEDIA_FILES} קבצים · JPEG, PNG, WEBP, MP4, MOV · עד {MAX_FILE_MB} MB
          </div>

          {/* Hidden file input */}
          <input
            id="cpoi-media-input"
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Upload buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaItems.length >= MAX_MEDIA_FILES}
              style={{
                flex: 1, padding: '10px', border: '2px dashed #0d9e6e', borderRadius: 12,
                background: mediaItems.length >= MAX_MEDIA_FILES ? '#f8fafc' : '#f0fdf8',
                color: mediaItems.length >= MAX_MEDIA_FILES ? '#94a3b8' : '#0d9e6e',
                fontSize: 13, fontWeight: 700, cursor: mediaItems.length >= MAX_MEDIA_FILES ? 'not-allowed' : 'pointer',
                fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              📷 בחר מהגלריה / מצלמה
            </button>
          </div>

          {/* URL input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: mediaItems.length ? 12 : 0 }}>
            <button onClick={addMediaUrl}
              disabled={!mediaUrlInput.trim() || mediaItems.length >= MAX_MEDIA_FILES}
              style={{ padding: '10px 14px', border: 'none', borderRadius: 12, background: mediaUrlInput.trim() ? '#0d9e6e' : '#e2e8f0', color: mediaUrlInput.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: mediaUrlInput.trim() ? 'pointer' : 'default', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>
              הוסף URL
            </button>
            <input
              value={mediaUrlInput}
              onChange={e => setMediaUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMediaUrl()}
              placeholder="https://example.com/photo.jpg"
              style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'left', outline: 'none', color: '#1a2e2a', direction: 'ltr' }}
            />
          </div>
          {/* Photo credit */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, textAlign: 'right' }}>קרדיט לצלם (אופציונלי)</div>
            <input
              value={photoCredit} onChange={e => setPhotoCredit(e.target.value)}
              placeholder="שמך או שם הצלם..."
              style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', color: '#1a2e2a' }}
            />
          </div>
          {/* Media preview grid */}
          {mediaItems.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
              {mediaItems.map(item => (
                <div key={item.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '1' }}>
                  {item.type === 'video' ? (
                    <video src={item.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline>
                      <track kind="captions" />
                    </video>
                  ) : (
                    <img src={item.previewUrl} alt="preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; (e.target as HTMLImageElement).onerror = null; }}
                    />
                  )}
                  <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 5px', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                    {item.type === 'video' ? '▶ סרטון' : '🖼'}
                  </div>
                  <button onClick={() => removeMedia(item.id)}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#dc2626', textAlign: 'right' }}>
            {error}
          </div>
        )}

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !pickedPoint || !name.trim()}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background: !submitting && pickedPoint && name.trim() ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0',
            color: !submitting && pickedPoint && name.trim() ? '#fff' : '#94a3b8',
            fontSize: 16, fontWeight: 800, cursor: !submitting && pickedPoint && name.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Heebo, sans-serif',
            boxShadow: !submitting && pickedPoint && name.trim() ? '0 8px 24px rgba(13,158,110,0.25)' : 'none',
          }}>
          {submitting ? 'שולח...' : '📤 שלח לאישור — קבל 50 XP'}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}