import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type POI, type Review, type CommunityReport } from '../api';
import { useAuth } from '../context/AuthContext';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const DIFF_COLORS: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#dc2626',
};

// ── OSRM routing helper ──────────────────────────────────────────
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

// ── Route line layer ─────────────────────────────────────────────
function RouteLayer({ userCoords, poiCoords, onRouteLoaded }: {
  userCoords: [number, number] | null;
  poiCoords: [number, number];
  onRouteLoaded: (info: { distanceKm: number; durationMin: number }) => void;
}) {
  const map = useMap();
  const lineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!userCoords) return;
    // Draw user position dot
    userMarkerRef.current?.remove();
    userMarkerRef.current = L.circleMarker(userCoords, {
      radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1,
    }).addTo(map);
    userMarkerRef.current.bindTooltip('המיקום שלי', { permanent: false });

    fetchRoute(userCoords, poiCoords).then(route => {
      lineRef.current?.remove();
      if (route) {
        lineRef.current = L.polyline(route.coords, {
          color: '#0d9e6e', weight: 4, opacity: 0.85, dashArray: '8,6',
        }).addTo(map);
        onRouteLoaded({ distanceKm: route.distanceKm, durationMin: route.durationMin });
        // Fit both points
        map.fitBounds(L.latLngBounds([userCoords, poiCoords]).pad(0.2));
      }
    });

    return () => { lineRef.current?.remove(); userMarkerRef.current?.remove(); };
  }, [userCoords, poiCoords, map, onRouteLoaded]);

  return null;
}

// ── Hero Image component (Feature 2) ─────────────────────────────────────────
function HeroImage({ poi }: { poi: POI }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Deduplicated image list, main_image first
  const images = useMemo(() => {
    const all = poi.main_image
      ? [poi.main_image, ...poi.images.filter(i => i !== poi.main_image)]
      : [...poi.images];
    return all.filter(Boolean);
  }, [poi.main_image, poi.images]);

  const currentImage = !imgError && images[imgIdx] ? images[imgIdx] : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {currentImage ? (
        <img
          key={currentImage}
          src={currentImage}
          alt={poi.name}
          onError={() => setImgError(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0d9e6e 0%, #34d399 60%, #0284c7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 72, opacity: 0.3 }}>🏞️</span>
        </div>
      )}

      {/* Gradient scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.65) 100%)' }} />

      {/* Pagination dots */}
      {images.length > 1 && !imgError && (
        <div style={{
          position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 6, zIndex: 12,
        }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setImgIdx(i)}
              style={{
                width: i === imgIdx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini-Map ──────────────────────────────────────────────────────────────────
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
      pos => {
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
        setGeoError(null);
        setGeoLoading(false);
      },
      () => { setGeoError('לא ניתן לקבל את מיקומך'); setGeoLoading(false); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const onRouteLoaded = useCallback((info: { distanceKm: number; durationMin: number }) => {
    setRouteInfo(info);
  }, []);

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

      {/* Map */}
      <div style={{ height: 220, position: 'relative' }}>
        <MapContainer center={poiCoords} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={poiCoords} />
          {userCoords && <RouteLayer userCoords={userCoords} poiCoords={poiCoords} onRouteLoaded={onRouteLoaded} />}
        </MapContainer>
      </div>

      {/* Controls */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            פתח ב-Waze
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main POIDetail ────────────────────────────────────────────────
export default function POIDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiId = searchParams.get('id') || '';
  const { isLoggedIn } = useAuth();

  const [poi, setPoi] = useState<POI | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [tab, setTab] = useState<'reports' | 'reviews'>('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poiId) return;
    setLoading(true);
    setError(null);
    api.locations.get(poiId)
      .then(async poiData => {
        setPoi(poiData);
        const [revs, reps] = await Promise.all([
          api.reviews.list(Number(poiId)),
          api.reports.list(Number(poiId)),
        ]);
        setReviews(revs);
        setReports(reps);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [poiId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
      <div>טוען...</div>
    </div>
  );
  if (error || !poi) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', gap: 12 }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <div style={{ fontWeight: 700 }}>לא ניתן לטעון את המקום</div>
      <button onClick={() => navigate(-1)} style={{ background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>חזרה</button>
    </div>
  );

  const diffColor = DIFF_COLORS[poi.difficulty] || '#16a34a';

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', width: '100%' }}>

      {/* ── Feature 2: Hero Banner ── */}
      <div style={{ position: 'relative', height: 350, width: '100%' }}>
        <HeroImage poi={poi} />

        <div style={{ maxWidth: 600, margin: '0 auto', height: '100%', position: 'relative' }}>
          {/* Top bar: share + heart + back */}
          <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigator.share?.({ title: poi.name, url: window.location.href })}
                style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              </button>
            </div>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* POI title */}
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

      {/* ── Main content ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px', marginTop: -20, position: 'relative', zIndex: 20, paddingBottom: 100 }}>

        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', padding: '24px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, direction: 'rtl' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span style={{ fontWeight: 900, color: '#1a2e2a', fontSize: 18 }}>{poi.average_rating}</span>
            </div>
            <span style={{ background: '#f0fdf8', color: '#0d9e6e', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 800 }}>{poi.category}</span>
          </div>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, textAlign: 'right', marginBottom: 24 }}>{poi.description}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', direction: 'rtl' }}>
            {poi.duration_minutes && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {poi.duration_minutes} דקות
              </span>
            )}
            {poi.has_water && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0284c7' }}>💧 יש מים</span>}
            {poi.has_shade && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🌿 יש צל</span>}
            {poi.accessible && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#faf5ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>♿ נגיש</span>}
          </div>
        </div>

        {/* Feature 1: Mini-Map (fixed flickering) */}
        <MiniMap poi={poi} />

        {/* Tabs */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: 16, display: 'flex', direction: 'rtl' }}>
          {[
            { key: 'reports', label: `דיווחים (${reports.length})` },
            { key: 'reviews', label: `ביקורות (${reviews.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{ flex: 1, padding: '12px', borderRadius: 16, border: 'none', background: tab === t.key ? '#0d9e6e' : 'transparent', color: tab === t.key ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}
            >
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
                style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>
                + הוסף דיווח
              </button>
            ) : (
              <button onClick={() => navigate('/Login')}
                style={{ width: '100%', padding: '16px', border: '2px dashed #94a3b8', borderRadius: 18, background: '#f8fafc', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>
                🔑 התחבר כדי להוסיף דיווח
              </button>
            )}
          </div>
        )}

        {/* Reviews tab */}
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
                style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>
                + כתוב ביקורת
              </button>
            ) : (
              <button onClick={() => navigate('/Login')}
                style={{ width: '100%', padding: '16px', border: '2px dashed #94a3b8', borderRadius: 18, background: '#f8fafc', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>
                🔑 התחבר כדי לכתוב ביקורת
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(poi.name)}`, '_blank')}
          style={{ width: '100%', padding: '18px', border: 'none', borderRadius: 20, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(13,158,110,0.25)', marginTop: 8 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
          נווט לשם
        </button>
      </div>
    </div>
  );
}