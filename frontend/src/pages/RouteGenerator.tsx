import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type POI, type Region } from '../api';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Routing layer — draws polyline between all stops ─────────────
function RoutePolyline({ stops }: { stops: POI[] }) {
  const map = useMap();
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    lineRef.current?.remove();
    if (stops.length < 2) return;
    const coords: [number, number][] = stops.map(s => [s.latitude, s.longitude]);
    lineRef.current = L.polyline(coords, {
      color: '#0d9e6e', weight: 3, opacity: 0.8, dashArray: '8,6',
    }).addTo(map);
    map.fitBounds(L.latLngBounds(coords).pad(0.15));
    return () => { lineRef.current?.remove(); };
  }, [stops, map]);

  return null;
}

function NumberedMarker({ poi, index }: { poi: POI; index: number }) {
  const icon = L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#0d9e6e;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:Heebo,Arial">${index + 1}</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16],
  });
  return <Marker position={[poi.latitude, poi.longitude]} icon={icon} />;
}

// ── Haversine distance helper ────────────────────────────────────
function haversineKm(a: POI, b: POI): number {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalDistance(stops: POI[]): number {
  let d = 0;
  for (let i = 0; i < stops.length - 1; i++) d += haversineKm(stops[i], stops[i + 1]);
  return d;
}

// ── Nearest-neighbour route optimizer ───────────────────────────
function optimizeRoute(pois: POI[]): POI[] {
  if (pois.length <= 2) return pois;
  const remaining = [...pois];
  const result = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(last, p);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    result.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return result;
}

const REGION_ICONS: Record<string, string> = { 'גולן': '🏔️', 'גליל עליון': '🌲', 'גליל תחתון': '💧', 'כרמל': '🌿', 'מרכז': '🏙️', 'ירושלים': '🕌', 'דרום': '🏜️', 'נגב': '🏜️', 'ערבה': '🌵', 'אילת': '🏖️', 'עמק יזרעאל': '🌾', 'שרון': '🌸' };

type Step = 'region' | 'pois' | 'route';

export default function RouteGenerator() {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>('region');
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [optimized, setOptimized] = useState<POI[]>([]);
  const [routeName, setRouteName] = useState('');
  const [loadingPois, setLoadingPois] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { api.regions.list().then(setRegions).catch(() => { }); }, []);

  // ── Pre-load POIs arriving from the Trip Bucket ───────────────────────────
  useEffect(() => {
    const state = location.state as { bucketPois?: POI[] } | null;
    if (state?.bucketPois && state.bucketPois.length >= 2) {
      const incoming = state.bucketPois;
      const opt = optimizeRoute([...incoming]);
      setSelectedPois(incoming);
      setOptimized(opt);
      setRouteName(`מסלול נבחר — ${new Date().toLocaleDateString('he-IL')}`);
      setStep('route');
      // Clear navigation state so a manual refresh doesn't re-inject the POIs
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const selectRegion = async (region: Region) => {
    setSelectedRegion(region);
    setLoadingPois(true);
    const data = await api.locations.list({ region: region.name, limit: 100 }).catch(() => []);
    setPois(data);
    setLoadingPois(false);
    setStep('pois');
  };

  const togglePOI = (poi: POI) => {
    setSelectedPois(prev => prev.find(p => p.id === poi.id) ? prev.filter(p => p.id !== poi.id) : [...prev, poi]);
  };

  const handleOptimize = () => {
    const opt = optimizeRoute([...selectedPois]);
    setOptimized(opt);
    setRouteName(`מסלול ב${selectedRegion?.name || ''} — ${new Date().toLocaleDateString('he-IL')}`);
    setStep('route');
  };

  const handleSave = async () => {
    if (!optimized.length) return;
    setSaving(true);
    try {
      const stops = optimized.map((p, i) => ({
        poi_name: p.name, location_id: parseInt(p.id),
        arrival_time: `${String(8 + i * 2).padStart(2, '0')}:00`,
        duration_minutes: p.duration_minutes || 60,
        order_index: i,
      }));
      const dist = totalDistance(optimized);
      const saved = await api.trips.create({
        name: routeName || `מסלול ב${selectedRegion?.name}`,
        region: selectedRegion?.name,
        total_duration_hours: parseFloat((stops.reduce((s, st) => s + st.duration_minutes, 0) / 60).toFixed(1)),
        total_distance_km: parseFloat(dist.toFixed(1)),
        stops,
      });
      navigate(`/TripDetail?id=${saved.id}`);
    } catch { setSaving(false); }
  };

  const dist = totalDistance(optimized);
  const totalMin = optimized.reduce((s, p) => s + (p.duration_minutes || 60), 0);
  const filteredPois = pois.filter(p => !search || p.name.includes(search) || p.category.includes(search));

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>🗺️ בנה מסלול עצמאי</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>בחר אתרים וצור מסלול מותאם אישית</div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ background: '#fff', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 0, direction: 'rtl' }}>
        {(['region', 'pois', 'route'] as Step[]).map((s, i) => {
          const labels = ['אזור', 'אתרים', 'מסלול'];
          const done = step === 'pois' && i === 0 || step === 'route';
          const active = step === s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#0d9e6e' : active ? '#0d9e6e' : '#e2e8f0', color: done || active ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: active ? '#0d9e6e' : '#94a3b8', marginTop: 3 }}>{labels[i]}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 2, background: done ? '#0d9e6e' : '#e2e8f0', margin: '0 4px 14px' }} />}
            </div>
          );
        })}
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* ── Step 1: Region ── */}
        {step === 'region' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16, textAlign: 'right' }}>באיזה אזור תרצה לטייל?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {regions.map(r => (
                <button key={r.id} onClick={() => selectRegion(r)}
                  style={{ background: '#fff', border: 'none', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', padding: 0, textAlign: 'right', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <div style={{ height: 70, background: `linear-gradient(135deg, ${r.color}cc, ${r.color}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>{REGION_ICONS[r.name] || '📍'}</div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1a2e2a' }}>{r.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Select POIs ── */}
        {step === 'pois' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={() => setStep('region')} style={{ background: 'none', border: 'none', color: '#0d9e6e', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>← שנה אזור</button>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>בחר אתרים — {selectedRegion?.name}</div>
            </div>

            {selectedPois.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '12px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0d9e6e', marginBottom: 8, textAlign: 'right' }}>{selectedPois.length} אתרים נבחרו</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {selectedPois.map((p, i) => (
                    <span key={p.id} style={{ background: '#f0fdf8', color: '#0d9e6e', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i + 1}. {p.name}
                      <button onClick={() => togglePOI(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0d9e6e', fontSize: 12, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '2px solid #e2e8f0', marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש אתר..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', color: '#1a2e2a' }} />
            </div>

            {loadingPois ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>טוען אתרים...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredPois.map(poi => {
                  const sel = !!selectedPois.find(p => p.id === poi.id);
                  return (
                    <button key={poi.id} onClick={() => togglePOI(poi)}
                      style={{ background: sel ? '#f0fdf8' : '#fff', border: `2px solid ${sel ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 16, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: sel ? '#0d9e6e' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sel ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 800 }}>
                          {sel ? '✓' : '+'}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{poi.category} · {poi.duration_minutes ? `${poi.duration_minutes} דק'` : ''}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{poi.name}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPois.length >= 2 && (
              <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 100, maxWidth: 568, margin: '0 auto' }}>
                <button onClick={handleOptimize}
                  style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 18, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: '0 8px 24px rgba(13,158,110,0.3)' }}>
                  בנה מסלול אופטימלי →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Route preview ── */}
        {step === 'route' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={() => setStep('pois')} style={{ background: 'none', border: 'none', color: '#0d9e6e', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>← ערוך</button>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>המסלול שלך</div>
            </div>

            {/* Stats bar */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', marginBottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', direction: 'rtl' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>{optimized.length}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>עצירות</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>{dist.toFixed(1)} ק"מ</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>מרחק</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>{(totalMin / 60).toFixed(1)} ש'</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>זמן</div>
              </div>
            </div>

            {/* Map preview */}
            <div style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 16, height: 240, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <MapContainer center={[optimized[0].latitude, optimized[0].longitude]} zoom={11}
                style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {optimized.map((poi, i) => <NumberedMarker key={poi.id} poi={poi} index={i} />)}
                <RoutePolyline stops={optimized} />
              </MapContainer>
            </div>

            {/* Route name input */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <input value={routeName} onChange={e => setRouteName(e.target.value)}
                placeholder="שם המסלול..."
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: '#1a2e2a', textAlign: 'right', fontFamily: 'Heebo, sans-serif', background: 'transparent', boxSizing: 'border-box' }} />
            </div>

            {/* Ordered stop list */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', marginBottom: 12, textAlign: 'right' }}>סדר העצירות (מותאם אוטומטית)</div>
              {optimized.map((poi, i) => (
                <div key={poi.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < optimized.length - 1 ? '1px solid #f1f5f9' : 'none', direction: 'rtl' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a' }}>{poi.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{poi.category}{poi.duration_minutes ? ` · ${poi.duration_minutes} דק'` : ''}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d9e6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                  {i < optimized.length - 1 && (
                    <div style={{ position: 'absolute', right: 30, fontSize: 10, color: '#94a3b8' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Save & open in Waze */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 18, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(13,158,110,0.25)' }}>
                {saving ? 'שומר...' : '💾 שמור מסלול'}
              </button>
              <button onClick={() => {
                const first = optimized[0];
                window.open(`https://waze.com/ul?q=${first.latitude},${first.longitude}`, '_blank');
              }} style={{ width: '100%', padding: '14px', border: '2px solid #0d9e6e', borderRadius: 18, background: '#fff', color: '#0d9e6e', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                🚗 נווט לנקודה הראשונה
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}