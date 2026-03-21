import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LatLng } from '../utils/types';
import { CATEGORIES } from '../utils/constants';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Feature 14: Robust coordinate extraction from Google Maps URLs and raw text.
 *
 * Handles:
 *  • https://maps.google.com/…@32.1,34.9,…z
 *  • https://www.google.com/maps/place/…/@32.1,34.9,17z
 *  • https://www.google.com/maps/search/…/@32.1,34.9
 *  • ?q=32.1,34.9 and &ll=32.1,34.9
 *  • !3d32.1!4d34.9  (embedded in long URLs)
 *  • Raw "32.1, 34.9" coordinate string
 *  • maps.app.goo.gl short links  →  returns null (can't expand client-side)
 */
const extractLatLngFromGoogle = (input: string): LatLng | null => {
  const s = input.trim();

  // Raw lat,lng paste e.g. "32.1234, 34.9876" or "32.1234,34.9876"
  const rawCoord = s.match(/^(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (rawCoord) {
    const lat = parseFloat(rawCoord[1]);
    const lng = parseFloat(rawCoord[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // @lat,lng,zoom pattern (most common Maps URL)
  const atCoord = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoord) return { lat: parseFloat(atCoord[1]), lng: parseFloat(atCoord[2]) };

  // !3dlat!4dlng embedded params
  const embCoord = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (embCoord) return { lat: parseFloat(embCoord[1]), lng: parseFloat(embCoord[2]) };

  // ?q=lat,lng or &q=lat,lng
  const qParam = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qParam) return { lat: parseFloat(qParam[1]), lng: parseFloat(qParam[2]) };

  // ?ll=lat,lng
  const llParam = s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llParam) return { lat: parseFloat(llParam[1]), lng: parseFloat(llParam[2]) };

  return null;
};

/** Feature 14: Geocode a place name via Nominatim (OSM) as fallback. */
async function geocodePlaceName(name: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=il`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'he' } });
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* network error — silent */ }
  return null;
}

// ── Map Components ───────────────────────────────────────────────────────────

function MapClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

/**
 * Automatically pans and zooms the map when a point is picked (via import)
 */
function MapRecenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], 16, { animate: true });
    }
  }, [position, map]);
  return null;
}

function PickedMarker({ position }: { position: LatLng }) {
  const icon = L.divIcon({
    html: `
      <div style="
        width:40px;height:40px;border-radius:50% 50% 50% 0;
        background:linear-gradient(135deg,#0d9e6e,#0bba7e);
        border:3px solid #fff;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:20px;
        box-shadow:0 3px 12px rgba(13,158,110,0.45);
        transform:rotate(-45deg);
      ">
        <span style="transform:rotate(45deg)">📍</span>
      </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
  return <Marker position={[position.lat, position.lng]} icon={icon} />;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ContributePOI() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  // Map state
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);
  const [googleUrl, setGoogleUrl] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('טבע');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const defaultCenter: LatLng = { lat: 31.8, lng: 35.2 };

  const handleImportGoogleMaps = async () => {
    const input = googleUrl.trim();
    if (!input) return;

    setError('');

    // Short link — can't expand client-side, ask user to open + copy the full URL
    if (input.includes('maps.app.goo.gl') || input.includes('goo.gl/maps')) {
      setError('לינק מקוצר: פתח אותו בדפדפן, העתק את הכתובת המלאה מסרגל הכתובות ונסה שנית.');
      return;
    }

    // Try coordinate extraction first
    const coords = extractLatLngFromGoogle(input);
    if (coords) {
      setPickedPoint(coords);
      setGoogleUrl('');
      return;
    }

    // Nothing found — try Nominatim geocoding as fallback
    setGeocoding(true);
    const geocoded = await geocodePlaceName(input);
    setGeocoding(false);
    if (geocoded) {
      setPickedPoint(geocoded);
      setGoogleUrl('');
    } else {
      setError('לא מצאנו מיקום. נסה לפתוח את הלינק בדפדפן ולהעתיק כתובת מלאה, או הקלד שם מקום בעברית/אנגלית.');
    }
  };

  const addPhoto = () => {
    const url = photoUrl.trim();
    if (!url || photos.includes(url)) return;
    setPhotos(prev => [...prev, url]);
    setPhotoUrl('');
  };

  const removePhoto = (url: string) => {
    setPhotos(prev => prev.filter(p => p !== url));
  };

  const handleSubmit = async () => {
    if (!pickedPoint) { setError('נא לבחור נקודה על המפה'); return; }
    if (!name.trim()) { setError('נא להזין שם למיקום'); return; }

    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('router_auth_token');
      const res = await fetch('/api/community-pois', {
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
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? `שגיאה ${res.status}`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? 'אירעה שגיאה בשמירה');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        background: '#f0fdf8', minHeight: '100vh', direction: 'rtl',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
      }}>
        <div style={{
          background: '#fff', borderRadius: 24, padding: '40px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center',
          maxWidth: 360, width: '100%',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 10 }}>
            המיקום נשלח לאישור!
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            הצוות שלנו יבדוק את המיקום שהגשת.
            עם האישור תקבל התראה ו-50 XP נוספים! 🎉
          </p>
          <button onClick={() => navigate('/')}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            }}>
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{
        background: '#f8fafc', minHeight: '100vh', direction: 'rtl',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
      }}>
        <div style={{
          background: '#fff', borderRadius: 24, padding: '40px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center',
          maxWidth: 360, width: '100%',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', marginBottom: 10 }}>
            יש להתחבר תחילה
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
            כדי לתרום מיקום לקהילה, עליך להיות מחובר
          </p>
          <button onClick={() => navigate('/Login')}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            }}>
            התחברות / הרשמה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        background: '#fff', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', margin: 0 }}>
            📍 הוסף מיקום לקהילה
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            אשר ← פרסום למפה + 50 XP
          </p>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Map picker ──────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '16px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: '#1a2e2a',
            marginBottom: 10, textAlign: 'right'
          }}>
            1. בחר נקודה על המפה
          </div>

          {/* Feature 14: Google Maps Import UI — robust URL + name fallback */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={googleUrl}
                onChange={e => { setGoogleUrl(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleImportGoogleMaps(); }}
                placeholder="לינק מ-Google Maps, קואורדינטות (32.1, 34.9) או שם מקום..."
                style={{
                  flex: 1, border: '2px solid #e2e8f0', borderRadius: 12,
                  padding: '10px 14px', fontSize: 13, fontFamily: 'Heebo, sans-serif',
                  textAlign: 'right', outline: 'none', color: '#1a2e2a',
                  direction: 'rtl',
                }}
              />
              <button
                onClick={handleImportGoogleMaps}
                disabled={geocoding || !googleUrl.trim()}
                style={{
                  padding: '10px 16px', background: geocoding ? '#94a3b8' : '#4285F4',
                  color: '#fff', border: 'none', borderRadius: 12, fontSize: 13,
                  fontWeight: 800, cursor: geocoding ? 'not-allowed' : 'pointer',
                  fontFamily: 'Heebo, sans-serif', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {geocoding ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    מחפש...
                  </>
                ) : 'ייבוא'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', lineHeight: 1.5 }}>
              💡 הדבק לינק מלא מ-Google Maps, קואורדינטות, או שם מקום לחיפוש אוטומטי
            </div>
          </div>

          <div style={{
            borderRadius: 16, overflow: 'hidden', height: 240,
            border: `2px solid ${pickedPoint ? '#0d9e6e' : '#e2e8f0'}`,
            transition: 'border-color 0.2s',
          }}>
            <MapContainer
              center={[defaultCenter.lat, defaultCenter.lng]}
              zoom={8}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onPick={setPickedPoint} />
              <MapRecenter position={pickedPoint} />
              {pickedPoint && <PickedMarker position={pickedPoint} />}
            </MapContainer>
          </div>

          {pickedPoint && (
            <div style={{
              marginTop: 10, padding: '8px 14px', background: '#f0fdf8',
              borderRadius: 10, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button onClick={() => setPickedPoint(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 16, lineHeight: 1,
                }}>×</button>
              <span style={{ fontSize: 12, color: '#0d9e6e', fontWeight: 700 }}>
                ✓ {pickedPoint.lat.toFixed(5)}, {pickedPoint.lng.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* ── Name ────────────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '16px 18px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <label style={{
            fontSize: 14, fontWeight: 800, color: '#1a2e2a',
            display: 'block', marginBottom: 10, textAlign: 'right'
          }}>
            2. שם המיקום
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="לדוגמה: מפל נסתר בגליל..."
            maxLength={120}
            style={{
              width: '100%', border: `2px solid ${name ? '#0d9e6e' : '#e2e8f0'}`,
              borderRadius: 12, padding: '12px 14px', fontSize: 14,
              fontFamily: 'Heebo, sans-serif', textAlign: 'right',
              outline: 'none', color: '#1a2e2a', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* ── Category ────────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '16px 18px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <label style={{
            fontSize: 14, fontWeight: 800, color: '#1a2e2a',
            display: 'block', marginBottom: 12, textAlign: 'right'
          }}>
            3. קטגוריה
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                style={{
                  padding: '10px 6px', border: `2px solid ${category === cat.id ? '#0d9e6e' : '#e2e8f0'}`,
                  borderRadius: 14, background: category === cat.id ? '#f0fdf8' : '#fff',
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: category === cat.id ? '#0d9e6e' : '#64748b',
                }}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Description ─────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '16px 18px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <label style={{
            fontSize: 14, fontWeight: 800, color: '#1a2e2a',
            display: 'block', marginBottom: 10, textAlign: 'right'
          }}>
            4. תיאור (אופציונלי)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="ספר למטיילים על המיקום — איך מגיעים? מה מיוחד בו?"
            rows={4}
            style={{
              width: '100%', border: '2px solid #e2e8f0', borderRadius: 12,
              padding: '12px 14px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
              textAlign: 'right', resize: 'none', outline: 'none',
              color: '#1a2e2a', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Photos ──────────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '16px 18px',
          marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <label style={{
            fontSize: 14, fontWeight: 800, color: '#1a2e2a',
            display: 'block', marginBottom: 10, textAlign: 'right'
          }}>
            5. תמונות (URL, אופציונלי)
          </label>

          <div style={{ display: 'flex', gap: 8, marginBottom: photos.length ? 12 : 0 }}>
            <button onClick={addPhoto}
              disabled={!photoUrl.trim()}
              style={{
                padding: '10px 16px', border: 'none', borderRadius: 12,
                background: photoUrl.trim() ? '#0d9e6e' : '#e2e8f0',
                color: photoUrl.trim() ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 700, cursor: photoUrl.trim() ? 'pointer' : 'default',
                fontFamily: 'Heebo, sans-serif', flexShrink: 0,
              }}>
              הוסף
            </button>
            <input
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhoto()}
              placeholder="https://example.com/photo.jpg"
              style={{
                flex: 1, border: '2px solid #e2e8f0', borderRadius: 12,
                padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif',
                textAlign: 'left', outline: 'none', color: '#1a2e2a',
              }}
            />
          </div>

          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map(url => (
                <div key={url} style={{ position: 'relative' }}>
                  <img src={url} alt="preview"
                    style={{
                      width: 72, height: 72, borderRadius: 12,
                      objectFit: 'cover', border: '2px solid #e2e8f0',
                    }}
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button onClick={() => removePhoto(url)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#ef4444', border: '2px solid #fff',
                      color: '#fff', fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            fontSize: 13, color: '#dc2626', textAlign: 'right',
          }}>
            {error}
          </div>
        )}

        {/* ── Submit ──────────────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !pickedPoint || !name.trim()}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background:
              !submitting && pickedPoint && name.trim()
                ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)'
                : '#e2e8f0',
            color:
              !submitting && pickedPoint && name.trim() ? '#fff' : '#94a3b8',
            fontSize: 16, fontWeight: 800,
            cursor: !submitting && pickedPoint && name.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Heebo, sans-serif',
            boxShadow:
              !submitting && pickedPoint && name.trim()
                ? '0 8px 24px rgba(13,158,110,0.25)'
                : 'none',
          }}
        >
          {submitting ? 'שולח...' : '📤 שלח לאישור — קבל 50 XP'}
        </button>
      </div>
    </div>
  );
}
