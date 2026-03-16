// src/pages/ContributePOI.tsx
// Feature 3: User form to contribute a new community POI.
// The user taps the map to set a point, then fills out name/category/description
// and optionally attaches photo URLs.  Submits to POST /api/community-pois.

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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


// ── Map click handler ─────────────────────────────────────────────────────────

function MapClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

// ── Picked-point marker ───────────────────────────────────────────────────────

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

// ── Category config ───────────────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContributePOI() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  // Map state
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);

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

  // Default center: Israel
  const defaultCenter: LatLng = { lat: 31.8, lng: 35.2 };

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

  // ── Success screen ──────────────────────────────────────────────────────────
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

  // ── Auth guard ──────────────────────────────────────────────────────────────
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

  // ── Main form ───────────────────────────────────────────────────────────────
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

          {!pickedPoint && (
            <div style={{
              marginBottom: 8, padding: '8px 14px', background: '#fefce8',
              borderRadius: 10, fontSize: 12, color: '#92400e', textAlign: 'right',
              border: '1px solid #fde68a',
            }}>
              לחץ על המפה כדי לסמן את המיקום
            </div>
          )}

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
