import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useMultiImageUpload } from '../hooks/useMultiImageUpload';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LatLng } from '../utils/types';
import { CATEGORIES } from '../utils/constants';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
});

const MAX_MEDIA_FILES = 5;

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

async function geocodePlaceName(name: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=il`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'he' } });
    const data = await res.json();
    if (data?.[0]) return { lat: Number.parseFloat(data[0].lat), lng: Number.parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

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
      const regionName = data?.data?.name;
      if (regionName) return regionName;
    }
  } catch (err) {
    console.error("Backend region classification failed:", err);
  }

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

function PickedMarker({ position }: Readonly<{ position: LatLng }>) {
  const icon = L.divIcon({
    html: `<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#0d9e6e,#0bba7e);border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;box-shadow:0 3px 12px rgba(13,158,110,0.45);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">📍</span></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
  return <Marker position={[position.lat, position.lng]} icon={icon} />;
}

export default function ContributePOI() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);
  const [googleUrl, setGoogleUrl] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('טבע');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('בינוני');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [photoCredit, setPhotoCredit] = useState('');

  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const {
    selectedFiles,
    handleFilesChange,
    uploadAll,
    removeFile,
    reset: resetFiles,
    uploadError: fileUploadError,
  } = useMultiImageUpload();
  const [pastedUrls, setPastedUrls] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const defaultCenter: LatLng = { lat: 31.8, lng: 35.2 };

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

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url || pastedUrls.includes(url)) return;
    if (!url.startsWith('http')) { setError('הקישור חייב להתחיל ב-http'); return; }
    setPastedUrls(prev => [...prev, url]);
    setMediaUrlInput('');
  };

  const handleSubmit = async () => {
    if (!pickedPoint) { setError('נא לבחור נקודה על המפה'); return; }
    if (!name.trim()) { setError('נא להזין שם למיקום'); return; }

    setError('');
    setSubmitting(true);

    try {
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedUrls = await uploadAll();
      }

      const photos: string[] = [...pastedUrls, ...uploadedUrls];
      const token = localStorage.getItem('router_auth_token');
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

      const res = await fetch(`${apiBase}/api/community-pois`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            name: name.trim(),
            category,
            description: description.trim() || undefined,
            latitude: pickedPoint.lat,
            longitude: pickedPoint.lng,
            photos,
            difficulty,
            duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
            has_water: hasWater,
            has_shade: hasShade,
            accessible,
            photo_credit: photoCredit.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? `שגיאה ${res.status}`);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בשמירה');
    } finally {
      setSubmitting(false);
    }
  };

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
      <div style={{ background: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', margin: 0 }}>📍 הוסף מיקום לקהילה</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>אשר ← פרסום למפה + 50 XP</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto', paddingBottom: 100 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', marginBottom: 10, textAlign: 'right' }}>1. בחר נקודה על המפה</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={googleUrl} onChange={e => { setGoogleUrl(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') handleImportGoogleMaps(); }} placeholder="לינק מ-Google Maps, קואורדינטות או שם מקום..." style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', color: '#1a2e2a', direction: 'rtl' }} />
              <button onClick={handleImportGoogleMaps} disabled={geocoding || !googleUrl.trim()} style={{ padding: '10px 16px', background: geocoding ? '#94a3b8' : '#4285F4', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: geocoding ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>
                {geocoding ? 'מחפש...' : 'ייבוא'}
              </button>
            </div>
          </div>
          <button onClick={handleUseGPS} disabled={gpsLoading} style={{ width: '100%', marginBottom: 10, padding: '10px', border: '2px solid #3b82f6', borderRadius: 12, background: gpsLoading ? '#f0f4ff' : '#eff6ff', color: gpsLoading ? '#94a3b8' : '#3b82f6', fontSize: 13, fontWeight: 700, cursor: gpsLoading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {gpsLoading ? <> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> מאתר מיקום... </> : <>📡 השתמש במיקום הנוכחי שלי (GPS)</>}
          </button>
          <div style={{ borderRadius: 16, overflow: 'hidden', height: 240, border: `2px solid ${pickedPoint ? '#0d9e6e' : '#e2e8f0'}`, transition: 'border-color 0.2s' }}>
            <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onPick={handlePickPoint} />
              <MapRecenter position={pickedPoint} />
              {pickedPoint && <PickedMarker position={pickedPoint} />}
            </MapContainer>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-name" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 10, textAlign: 'right' }}>2. שם המיקום</label>
          <input id="cpoi-name" value={name} onChange={e => setName(e.target.value)} placeholder="לדוגמה: מפל נסתר בגליל..." maxLength={120} style={{ width: '100%', border: `2px solid ${name ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', color: '#1a2e2a', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 12, textAlign: 'right' }}>3. קטגוריה</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '10px 6px', border: `2px solid ${category === cat.id ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 14, background: category === cat.id ? '#f0fdf8' : '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span><span style={{ fontSize: 10, fontWeight: 700, color: category === cat.id ? '#0d9e6e' : '#64748b' }}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-description" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 10, textAlign: 'right' }}>4. תיאור (אופציונלי)</label>
          <textarea id="cpoi-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="ספר למטיילים על המיקום..." rows={4} style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a', boxSizing: 'border-box' }} />
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 12, textAlign: 'right' }}>5. פרטים נוספים</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textAlign: 'right' }}>רמת קושי</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              {['קל - משפחות', 'קל', 'בינוני', 'מאתגר', 'קשה', 'אקסטרים'].map(d => {
                const color = ({ 'קל - משפחות': '#16a34a', 'קל': '#16a34a', 'בינוני': '#d97706', 'מאתגר': '#dc2626', 'קשה': '#dc2626', 'אקסטרים': '#7c3aed' } as Record<string, string>)[d] || '#64748b';
                const active = difficulty === d;
                return (
                  <button key={d} onClick={() => setDifficulty(d)} style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${active ? color : '#e2e8f0'}`, background: active ? color + '18' : '#fff', color: active ? color : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>{d}</button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, textAlign: 'right' }}>משך ביקור משוער (דקות)</div>
            <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="לדוגמה: 90" style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', color: '#1a2e2a' }} />
          </div>
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

        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label htmlFor="cpoi-media-input" style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', display: 'block', marginBottom: 4, textAlign: 'right' }}>6. תמונות וסרטונים (אופציונלי)</label>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, textAlign: 'right' }}>עד {MAX_MEDIA_FILES} קבצים</div>

          <input type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} ref={fileInputRef} onChange={handleFilesChange} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={(selectedFiles.length + pastedUrls.length) >= MAX_MEDIA_FILES} style={{ flex: 1, padding: '10px', border: '2px dashed #0d9e6e', borderRadius: 12, background: (selectedFiles.length + pastedUrls.length) >= MAX_MEDIA_FILES ? '#f8fafc' : '#f0fdf8', color: (selectedFiles.length + pastedUrls.length) >= MAX_MEDIA_FILES ? '#94a3b8' : '#0d9e6e', fontSize: 13, fontWeight: 700, cursor: (selectedFiles.length + pastedUrls.length) >= MAX_MEDIA_FILES ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              📷 בחר מהגלריה / מצלמה
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: (selectedFiles.length || pastedUrls.length) ? 12 : 0 }}>
            <button onClick={addMediaUrl} disabled={!mediaUrlInput.trim() || (selectedFiles.length + pastedUrls.length) >= MAX_MEDIA_FILES} style={{ padding: '10px 14px', border: 'none', borderRadius: 12, background: mediaUrlInput.trim() ? '#0d9e6e' : '#e2e8f0', color: mediaUrlInput.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: mediaUrlInput.trim() ? 'pointer' : 'default', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>הוסף URL</button>
            <input value={mediaUrlInput} onChange={e => setMediaUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMediaUrl()} placeholder="https://example.com/photo.jpg" style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'left', outline: 'none', color: '#1a2e2a', direction: 'ltr' }} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, textAlign: 'right' }}>קרדיט לצלם (אופציונלי)</div>
            <input value={photoCredit} onChange={e => setPhotoCredit(e.target.value)} placeholder="שמך או שם הצלם..." style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', color: '#1a2e2a' }} />
          </div>

          {(selectedFiles.length > 0 || pastedUrls.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginTop: 12 }}>
              {selectedFiles.map((sf, idx) => (
                <div key={sf.previewUrl} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '1' }}>
                  <img src={sf.previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removeFile(idx)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              {pastedUrls.map((url, idx) => (
                <div key={url} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '1' }}>
                  <img src={url} alt="url preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setPastedUrls(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#dc2626', textAlign: 'right' }}>{error}</div>}
        {fileUploadError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#dc2626', textAlign: 'right' }}>{fileUploadError}</div>}

        <button onClick={handleSubmit} disabled={submitting || !pickedPoint || !name.trim()} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: !submitting && pickedPoint && name.trim() ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0', color: !submitting && pickedPoint && name.trim() ? '#fff' : '#94a3b8', fontSize: 16, fontWeight: 800, cursor: !submitting && pickedPoint && name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif', boxShadow: !submitting && pickedPoint && name.trim() ? '0 8px 24px rgba(13,158,110,0.25)' : 'none' }}>
          {submitting ? 'שולח...' : '📤 שלח לאישור — קבל 50 XP'}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}