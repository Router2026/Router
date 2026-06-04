// src/pages/RouteGenerator.tsx
// Feature 1: Injects user location (or selected location) as the starting point
// into routeGenerate, and displays a visual start-point marker on the map.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type POI, type Region } from '../api';
import { useRegions } from '../hooks/useLocations';
import Disclaimer from '../components/Disclaimer';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LatLng } from '../utils/types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Static icon — created once for the entire session
const _startIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#3b82f6,#2563eb);border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;box-shadow:0 3px 10px rgba(37,99,235,0.45);transform:rotate(-45deg);"><span style="transform:rotate(45deg)">📍</span></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function StartMarker({ position }: { position: LatLng }) {
  return <Marker position={[position.lat, position.lng]} icon={_startIcon} />;
}

function NumberedMarker({ poi, index }: { poi: POI; index: number }) {
  const icon = useMemo(() => L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#0d9e6e;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:Heebo,Arial">${index + 1}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }), [index]);
  return <Marker position={[poi.latitude, poi.longitude]} icon={icon} />;
}

function RoutePolyline({ stops, startPoint }: { stops: POI[]; startPoint: LatLng | null }) {
  const map = useMap();
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    lineRef.current?.remove();
    if (stops.length < 2 && !startPoint) return;

    const coords: [number, number][] = [
      ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
      ...stops.map(s => [s.latitude, s.longitude] as [number, number]),
    ];

    if (coords.length < 2) return;

    lineRef.current = L.polyline(coords, {
      color: '#0d9e6e',
      weight: 3,
      opacity: 0.8,
      dashArray: '8,6',
    }).addTo(map);

    map.fitBounds(L.latLngBounds(coords).pad(0.15));
    return () => { lineRef.current?.remove(); };
  }, [stops, startPoint, map]);

  return null;
}

function PhotoMarker({ poi, index, selected }: { poi: POI; index: number; selected: boolean }) {
  const map = useMap();

  const icon = useMemo(() => L.divIcon({
    html: poi.main_image
      ? `<div style="
          position:relative;
          width:${selected ? 52 : 44}px;
          height:${selected ? 52 : 44}px;
          border-radius:12px;
          overflow:hidden;
          border:3px solid ${selected ? '#0d9e6e' : '#fff'};
          box-shadow:0 3px 12px rgba(0,0,0,0.35);
          cursor:pointer;
        ">
          <img src="${poi.main_image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:#0d9e6e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900\\'>${index + 1}</div>'"/>
          <div style="
            position:absolute;bottom:0;left:0;right:0;
            background:linear-gradient(transparent,rgba(0,0,0,0.6));
            color:#fff;font-size:9px;font-weight:700;
            padding:4px 4px 3px;text-align:center;
            font-family:Heebo,Arial;
          ">${index + 1}</div>
        </div>`
      : `<div style="
          width:${selected ? 44 : 36}px;
          height:${selected ? 44 : 36}px;
          border-radius:12px;
          background:linear-gradient(135deg,#0d9e6e,#0bba7e);
          border:3px solid ${selected ? '#fff' : '#e2e8f0'};
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:14px;font-weight:900;
          box-shadow:0 3px 10px rgba(13,158,110,0.4);
          font-family:Heebo,Arial;
        ">${index + 1}</div>`,
    className: '',
    iconSize: [selected ? 52 : 44, selected ? 52 : 44],
    iconAnchor: [selected ? 26 : 22, selected ? 26 : 22],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [poi.main_image, index, selected]);

  return (
    <Marker
      position={[poi.latitude, poi.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => {
          map.flyTo([poi.latitude, poi.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 });
        }
      }}
    />
  );
}

function FitBoundsToSelection({ pois, startPoint, region }: {
  pois: POI[];
  startPoint: LatLng | null;
  region: Region | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (pois.length > 0) {
      const coords: [number, number][] = [
        ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
        ...pois.map(p => [p.latitude, p.longitude] as [number, number]),
      ];
      map.fitBounds(L.latLngBounds(coords).pad(0.2));
    } else if (region) {
      map.flyTo([region.center_lat, region.center_lng], region.zoom || 11, { duration: 0.8 });
    }
  }, [pois.length, startPoint, region]);
  return null;
}

function RegionLabel({ region, count }: { region: Region | null; count: number }) {
  if (!region) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      textAlign: 'center',
      zIndex: 500,
    }}>
      <div style={{
        color: '#1a1a1a',
        textShadow: '0 1px 4px rgba(255,255,255,0.9), 0 -1px 4px rgba(255,255,255,0.9), 1px 0 4px rgba(255,255,255,0.9), -1px 0 4px rgba(255,255,255,0.9)',
        fontFamily: 'Heebo, Arial',
        direction: 'rtl',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>{region.name}</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>{region.name_en || region.name}</div>
        {count > 0 && (
          <div style={{
            marginTop: 4,
            display: 'inline-block',
            background: '#0d9e6e',
            color: '#fff',
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            {count} אתרים נבחרו
          </div>
        )}
      </div>
    </div>
  );
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * Math.PI / 180) *
    Math.cos(b.latitude * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalDistance(stops: POI[]): number {
  let d = 0;
  for (let i = 0; i < stops.length - 1; i++) d += haversineKm(stops[i], stops[i + 1]);
  return d;
}

function optimizeRoute(pois: POI[], startPoint?: LatLng | null): POI[] {
  if (pois.length <= 1) return pois;

  const remaining = [...pois];
  let firstIdx = 0;

  if (startPoint) {
    let minDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm({ latitude: startPoint.lat, longitude: startPoint.lng }, p);
      if (d < minDist) { minDist = d; firstIdx = i; }
    });
  }

  const result = [remaining.splice(firstIdx, 1)[0]];

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

const REGION_ICONS: Record<string, string> = {
  'גולן': '🏔️', 'גליל עליון': '🌲', 'גליל תחתון': '💧', 'כרמל': '🌿',
  'מרכז': '🏙️', 'ירושלים': '🕌', 'דרום': '🏜️', 'נגב': '🏜️',
  'ערבה': '🌵', 'אילת': '🏖️', 'עמק יזרעאל': '🌾', 'שרון': '🌸',
};

type Step = 'region' | 'pois' | 'route';

export default function RouteGenerator() {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [step, setStep] = useState<Step>('region');
  const { data: regions = [] } = useRegions();
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [optimized, setOptimized] = useState<POI[]>([]);
  const [routeName, setRouteName] = useState('');
  const [loadingPois, setLoadingPois] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishDesc, setPublishDesc] = useState('');
  const [publishPOI, setPublishPOI] = useState('');
  const [publishStops, setPublishStops] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState('');

  const [tripType, setTripType] = useState<string>('משפחה');
  const [tripStyle, setTripStyle] = useState<string>('טבע');
  const [tripDifficulty, setTripDifficulty] = useState<string>('בינוני');
  const [tripDuration, setTripDuration] = useState<string>('');

  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  useEffect(() => {
    const state = routerLocation.state as {
      bucketPois?: POI[];
      userLocation?: { lat: number; lng: number } | null;
      alreadyOrdered?: boolean;
    } | null;
    if (state?.bucketPois && state.bucketPois.length >= 2) {
      const incoming = state.bucketPois;
      setSelectedPois(incoming);
      setRouteName(`מסלול נבחר — ${new Date().toLocaleDateString('he-IL')}`);

      // If the user already set a start point in TripBucketSheet, use it
      // directly — no need to request GPS again.
      if (state.userLocation) {
        const sp: LatLng = { lat: state.userLocation.lat, lng: state.userLocation.lng };
        setStartPoint(sp);
        setUseCurrentLocation(true);
        setOptimized(
          state.alreadyOrdered
            ? [...incoming]
            : optimizeRoute([...incoming], sp)
        );
      } else if (navigator.geolocation) {
        // Fallback: no location from sheet — try GPS as before
        navigator.geolocation.getCurrentPosition(
          pos => {
            const sp = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setStartPoint(sp);
            setOptimized(optimizeRoute([...incoming], sp));
          },
          () => { setOptimized(optimizeRoute([...incoming], null)); },
          { timeout: 5000, enableHighAccuracy: false }
        );
      } else {
        setOptimized(optimizeRoute([...incoming], null));
      }

      setStep('route');
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state]);

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('הדפדפן שלך אינו תומך באיתור מיקום');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUseCurrentLocation(true);
        setGeoLoading(false);
      },
      () => {
        setGeoError('לא ניתן לקבל מיקום — אנא בדוק הרשאות');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const clearStartPoint = () => {
    setStartPoint(null);
    setUseCurrentLocation(false);
    setGeoError('');
  };

  const selectRegion = useCallback(async (region: Region) => {
    setSelectedRegion(region);
    setLoadingPois(true);
    const data = await api.locations.list({ region: region.name, limit: 100 }).catch(() => []);
    setPois(data);
    setLoadingPois(false);
    setStep('pois');
  }, []);

  const togglePOI = useCallback((poi: POI) => {
    setSelectedPois(prev =>
      prev.find(p => p.id === poi.id)
        ? prev.filter(p => p.id !== poi.id)
        : [...prev, poi]
    );
  }, []);

  const handleOptimize = useCallback(() => {
    const opt = optimizeRoute([...selectedPois], startPoint);
    setOptimized(opt);
    setRouteName(`מסלול ב${selectedRegion?.name || ''} — ${new Date().toLocaleDateString('he-IL')}`);
    setStep('route');
  }, [selectedPois, startPoint, selectedRegion?.name]);

  const handleSave = async () => {
    if (!optimized.length) return;
    setSaving(true);
    try {
      const stops = optimized.map((p, i) => ({
        poi_name: p.name,
        location_id: parseInt(p.id),
        arrival_time: `${String(8 + i * 2).padStart(2, '0')}:00`,
        duration_minutes: p.duration_minutes || 60,
        order_index: i,
      }));
      const dist = totalDistance(optimized);
      const autoHours = parseFloat(
        (stops.reduce((s, st) => s + st.duration_minutes, 0) / 60).toFixed(1)
      );
      const saved = await api.trips.create({
        name: routeName || `מסלול ב${selectedRegion?.name}`,
        region: selectedRegion?.name,
        total_duration_hours: tripDuration ? parseFloat(tripDuration) : autoHours,
        total_distance_km: parseFloat(dist.toFixed(1)),
        difficulty: tripDifficulty,
        group_type: tripType,
        style: tripStyle,
        stops,
      });
      navigate(`/TripDetail?id=${saved.id}`);
    } catch {
      setSaving(false);
    }
  };

  const buildStops = () => optimized.map((p, i) => ({
    poi_name: p.name,
    location_id: parseInt(p.id),
    arrival_time: `${String(8 + i * 2).padStart(2, '0')}:00`,
    duration_minutes: p.duration_minutes || 60,
    order_index: i,
  }));

  const handlePublish = async () => {
    if (!optimized.length) return;
    setPublishing(true);
    try {
      const stops = buildStops();
      const dist = totalDistance(optimized);
      const autoHours = parseFloat(
        (stops.reduce((s, st) => s + st.duration_minutes, 0) / 60).toFixed(1)
      );
      const publicTrip = await api.publicTrips.create({
        title: routeName || `מסלול ב${selectedRegion?.name}`,
        description: publishDesc || undefined,
        is_public: true,
        location_ids: optimized.map(p => parseInt(p.id)),
      });
      if (publishDesc || publishPOI || publishStops) {
        await api.publicTrips.updateMedia(publicTrip.id, {
          user_description: publishDesc || undefined,
          points_of_interest: publishPOI || undefined,
          recommended_stops: publishStops || undefined,
        });
      }
      setShowPublishModal(false);
      navigate(`/trips/${publicTrip.id}`);
    } catch {
      setPublishing(false);
    }
  };

  const dist = useMemo(() => totalDistance(optimized), [optimized]);
  const totalMin = useMemo(
    () => optimized.reduce((s, p) => s + (p.duration_minutes || 60), 0),
    [optimized],
  );
  const filteredPois = useMemo(
    () => pois.filter(p => !search || p.name.includes(search) || p.category.includes(search)),
    [pois, search],
  );

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        background: '#fff', padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl',
      }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>🗺️ בנה מסלול עצמאי</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>בחר אתרים וצור מסלול מותאם אישית</div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{
        background: '#fff', padding: '12px 20px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', gap: 0, direction: 'rtl',
      }}>
        {(['region', 'pois', 'route'] as Step[]).map((s, i) => {
          const labels = ['אזור', 'אתרים', 'מסלול'];
          const done = (step === 'pois' && i === 0) || step === 'route';
          const active = step === s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: done || active ? '#0d9e6e' : '#e2e8f0',
                  color: done || active ? '#fff' : '#94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: active ? '#0d9e6e' : '#94a3b8', marginTop: 3,
                }}>{labels[i]}</div>
              </div>
              {i < 2 && (
                <div style={{
                  flex: 1, height: 2,
                  background: done ? '#0d9e6e' : '#e2e8f0',
                  margin: '0 4px 14px',
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* ── Step 1: Region ─────────────────────────────────────────────────── */}
        {step === 'region' && (
          <>
            <div style={{
              background: '#fff', borderRadius: 20, padding: '16px 18px',
              marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 800, color: '#1a2e2a',
                marginBottom: 12, textAlign: 'right',
              }}>
                📍 נקודת התחלה (אופציונלי)
              </div>

              {startPoint ? (
                <div style={{
                  background: '#f0fdf8', borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <button onClick={clearStartPoint}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 0,
                    }}>×</button>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0d9e6e' }}>
                      {useCurrentLocation ? '📡 המיקום הנוכחי שלך' : '📍 מיקום נבחר'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={requestGeolocation}
                    disabled={geoLoading}
                    style={{
                      flex: 1, padding: '10px 14px',
                      border: '2px solid #0d9e6e', borderRadius: 12,
                      background: '#f0fdf8', color: '#0d9e6e',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'Heebo, sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: geoLoading ? 0.7 : 1,
                    }}
                  >
                    {geoLoading ? (
                      <span style={{
                        width: 14, height: 14, border: '2px solid #e2e8f0',
                        borderTopColor: '#0d9e6e', borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                    ) : '📡'}
                    {geoLoading ? 'מאתר...' : 'מיקום נוכחי'}
                  </button>
                </div>
              )}

              {geoError && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444', textAlign: 'right' }}>
                  {geoError}
                </div>
              )}
            </div>

            <div style={{
              fontSize: 16, fontWeight: 800, color: '#1a2e2a',
              marginBottom: 16, textAlign: 'right',
            }}>
              באיזה אזור תרצה לטייל?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {regions.map(r => (
                <button key={r.id} onClick={() => selectRegion(r)}
                  style={{
                    background: '#fff', border: 'none', borderRadius: 18,
                    overflow: 'hidden', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    padding: 0, textAlign: 'right',
                    fontFamily: 'Heebo, sans-serif', transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <div style={{
                    height: 70,
                    background: `linear-gradient(135deg, ${r.color}cc, ${r.color}77)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                  }}>
                    {REGION_ICONS[r.name] || '📍'}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1a2e2a' }}>{r.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Select POIs ─────────────────────────────────────────────── */}
        {step === 'pois' && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16,
            }}>
              <button onClick={() => setStep('region')}
                style={{
                  background: 'none', border: 'none', color: '#0d9e6e',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                }}>← שנה אזור</button>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>
                בחר אתרים — {selectedRegion?.name}
              </div>
            </div>

            {startPoint && (
              <div style={{
                background: '#eff6ff', borderRadius: 14, padding: '10px 14px',
                marginBottom: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'flex-end', gap: 8,
              }}>
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700 }}>
                  המסלול יתחיל ממיקומך ויותאם לנקודת הפתיחה
                </span>
                <span>📡</span>
              </div>
            )}

            {selectedPois.length > 0 && (
              <div style={{
                background: '#fff', borderRadius: 16, padding: '12px 16px',
                marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#0d9e6e',
                  marginBottom: 8, textAlign: 'right'
                }}>
                  {selectedPois.length} אתרים נבחרו
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {selectedPois.map((p, i) => (
                    <span key={p.id} style={{
                      background: '#f0fdf8', color: '#0d9e6e', borderRadius: 20,
                      padding: '4px 10px', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {i + 1}. {p.name}
                      <button onClick={() => togglePOI(p)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, color: '#0d9e6e', fontSize: 12, lineHeight: 1
                        }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Google Maps-style region overview map ── */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              marginBottom: 14, height: 220, position: 'relative',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}>
              {selectedRegion && (
                <>
                  <MapContainer
                    center={[selectedRegion.center_lat, selectedRegion.center_lng]}
                    zoom={selectedRegion.zoom || 11}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    doubleClickZoom={false}
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd" />
                    {startPoint && <StartMarker position={startPoint} />}
                    {selectedPois.map((poi, i) => (
                      <PhotoMarker key={poi.id} poi={poi} index={i} selected={true} />
                    ))}
                    <FitBoundsToSelection pois={selectedPois} startPoint={startPoint} region={selectedRegion} />
                  </MapContainer>
                  <RegionLabel region={selectedRegion} count={selectedPois.length} />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.08))',
                    pointerEvents: 'none', zIndex: 500,
                  }} />
                </>
              )}
            </div>

            {selectedPois.length === 0 && (
              <div style={{
                background: '#fffbeb', borderRadius: 14, padding: '10px 14px',
                marginBottom: 12, textAlign: 'right', fontSize: 12,
                color: '#92400e', fontWeight: 600, border: '1px solid #fde68a',
              }}>
                💡 בחר אתרים מהרשימה — הם יופיעו על המפה
              </div>
            )}

            {/* Search bar */}
            <div style={{
              background: '#f8fafc', borderRadius: 14, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              border: '2px solid #e2e8f0', marginBottom: 12,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="חפש אתר..."
                style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right',
                  color: '#1a2e2a',
                }} />
            </div>

            {loadingPois ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                טוען אתרים...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredPois.map(poi => {
                  const sel = !!selectedPois.find(p => p.id === poi.id);
                  return (
                    <button key={poi.id} onClick={() => togglePOI(poi)}
                      style={{
                        background: sel ? '#f0fdf8' : '#fff',
                        border: `2px solid ${sel ? '#0d9e6e' : '#e2e8f0'}`,
                        borderRadius: 16, padding: '12px 14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: sel ? '#0d9e6e' : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: sel ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 800,
                        }}>
                          {sel ? '✓' : '+'}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {poi.category} · {poi.duration_minutes ? `${poi.duration_minutes} דק'` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>
                        {poi.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPois.length >= 2 && (
              <div style={{
                position: 'fixed', bottom: 80, left: 16, right: 16,
                zIndex: 100, maxWidth: 568, margin: '0 auto',
              }}>
                <button onClick={handleOptimize}
                  style={{
                    width: '100%', padding: '16px', border: 'none', borderRadius: 18,
                    background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                    color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                    fontFamily: 'Heebo, sans-serif',
                    boxShadow: '0 8px 24px rgba(13,158,110,0.3)',
                  }}>
                  {startPoint ? '🗺️ בנה מסלול ממיקומי' : 'בנה מסלול אופטימלי →'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Route preview ───────────────────────────────────────────── */}
        {step === 'route' && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16,
            }}>
              <button onClick={() => setStep('pois')}
                style={{
                  background: 'none', border: 'none', color: '#0d9e6e',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                }}>← ערוך</button>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>המסלול שלך</div>
            </div>

            {/* Stats */}
            <div style={{
              background: '#fff', borderRadius: 20, padding: '16px 20px',
              marginBottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              textAlign: 'center', direction: 'rtl',
            }}>
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

            {startPoint && (
              <div style={{
                background: '#eff6ff', borderRadius: 14, padding: '10px 14px',
                marginBottom: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                  📡 מתחיל מנקודת ההתחלה
                </span>
              </div>
            )}

            {/* Map with photo markers */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              marginBottom: 16, height: 280, position: 'relative',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}>
              {optimized.length > 0 && (
                <>
                  <MapContainer
                    center={
                      startPoint
                        ? [startPoint.lat, startPoint.lng]
                        : [optimized[0].latitude, optimized[0].longitude]
                    }
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom={false}
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd" />
                    {startPoint && <StartMarker position={startPoint} />}
                    {optimized.map((poi, i) => (
                      <PhotoMarker key={poi.id} poi={poi} index={i} selected={true} />
                    ))}
                    <RoutePolyline stops={optimized} startPoint={startPoint} />
                  </MapContainer>
                  <RegionLabel region={selectedRegion} count={0} />
                </>
              )}
            </div>

            {/* Route name */}
            <div style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <input value={routeName} onChange={e => setRouteName(e.target.value)}
                placeholder="שם המסלול..."
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  fontSize: 15, fontWeight: 700, color: '#1a2e2a',
                  textAlign: 'right', fontFamily: 'Heebo, sans-serif',
                  background: 'transparent', boxSizing: 'border-box',
                }} />
            </div>

            {/* Ordered stop list */}
            <div style={{
              background: '#fff', borderRadius: 20, padding: '16px',
              marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 800, color: '#1a2e2a',
                marginBottom: 12, textAlign: 'right',
              }}>
                סדר העצירות {startPoint ? '(מסודר)' : '(מותאם אוטומטית)'}
              </div>

              {startPoint && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid #f1f5f9', direction: 'rtl',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                      📡 נקודת התחלה
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#2563eb', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, flexShrink: 0,
                  }}>🏠</div>
                </div>
              )}

              {optimized.map((poi, i) => (
                <div key={poi.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < optimized.length - 1 ? '1px solid #f1f5f9' : 'none',
                  direction: 'rtl',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a' }}>{poi.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {poi.category}{poi.duration_minutes ? ` · ${poi.duration_minutes} דק'` : ''}
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#0d9e6e', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, flexShrink: 0,
                  }}>{i + 1}</div>
                </div>
              ))}
            </div>

            {/* Trip metadata */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', direction: 'rtl' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', marginBottom: 14 }}>פרטי המסלול</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>סוג הטיול</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['solo', '🚶 יחיד'], ['couple', '👫 זוג'], ['family', '👨‍👩‍👧‍👦 משפחה'], ['friends', '👥 חברים']].map(([id, label]) => (
                    <button key={id} onClick={() => setTripType(id)}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${tripType === id ? '#0d9e6e' : '#e2e8f0'}`, background: tripType === id ? '#f0fdf8' : '#fff', color: tripType === id ? '#0d9e6e' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: tripType === id ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>סגנון</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['טבע', 'היסטוריה', 'מים', 'נוף', 'מסלולים', 'חופים', 'גיאולוגיה', 'יין ואוכל'].map(s => (
                    <button key={s} onClick={() => setTripStyle(s)}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${tripStyle === s ? '#0d9e6e' : '#e2e8f0'}`, background: tripStyle === s ? '#f0fdf8' : '#fff', color: tripStyle === s ? '#0d9e6e' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: tripStyle === s ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>רמת קושי</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['קל - משפחות', '#16a34a'], ['בינוני', '#d97706'], ['קשה', '#dc2626'], ['מאתגר', '#7c3aed']].map(([d, color]) => (
                    <button key={d} onClick={() => setTripDifficulty(d)}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${tripDifficulty === d ? color : '#e2e8f0'}`, background: tripDifficulty === d ? `${color}15` : '#fff', color: tripDifficulty === d ? color : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: tripDifficulty === d ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>אורך משוער בשעות (אופציונלי)</div>
                <input
                  type="number" min="0.5" max="24" step="0.5"
                  value={tripDuration}
                  onChange={e => setTripDuration(e.target.value)}
                  placeholder={`${parseFloat((optimized.reduce((s, p) => s + (p.duration_minutes || 60), 0) / 60).toFixed(1))} שעות (אוטומטי)`}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', direction: 'ltr', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <Disclaimer />
            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{
                  width: '100%', padding: '16px', border: 'none', borderRadius: 18,
                  background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                  color: '#fff', fontSize: 16, fontWeight: 800,
                  cursor: saving ? 'default' : 'pointer',
                  fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1,
                  boxShadow: '0 8px 24px rgba(13,158,110,0.25)',
                }}>
                {saving ? 'שומר...' : '💾 שמור מסלול'}
              </button>
              <button onClick={() => setShowPublishModal(true)} disabled={saving}
                style={{
                  width: '100%', padding: '14px', border: '2px solid #7c3aed', borderRadius: 18,
                  background: '#faf5ff', color: '#7c3aed', fontSize: 15, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                🌐 פרסם כמסלול ציבורי
              </button>
              <button onClick={() => {
                const target = startPoint ?? {
                  lat: optimized[0].latitude,
                  lng: optimized[0].longitude,
                };
                window.open(`https://waze.com/ul?q=${target.lat},${target.lng}`, '_blank');
              }}
                style={{
                  width: '100%', padding: '14px',
                  border: '2px solid #0d9e6e', borderRadius: 18,
                  background: '#fff', color: '#0d9e6e',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                }}>
                🚗 נווט לנקודת ההתחלה
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Publish Modal ───────────────────────────────────────────── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', direction: 'rtl', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowPublishModal(false)}>
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '24px 24px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>🌐 פרסם מסלול ציבורי</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>הוסף פרטים שיעזרו למטיילים אחרים</div>
                </div>
                <button onClick={() => setShowPublishModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 20 }}>×</button>
              </div>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Route name preview */}
              <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 28 }}>🗺️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{routeName || `מסלול ב${selectedRegion?.name}`}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{optimized.length} עצירות · {selectedRegion?.name}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  📝 תיאור המסלול <span style={{ fontWeight: 400, color: '#94a3b8' }}>(מה מיוחד? למי מתאים?)</span>
                </label>
                <textarea
                  value={publishDesc}
                  onChange={e => setPublishDesc(e.target.value)}
                  rows={3}
                  placeholder="ספר על המסלול — מה מיוחד בו, מה הכי שווה לראות, מתי כדאי לבוא..."
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Points of interest */}
              <div>
                <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  ✨ נקודות עניין מיוחדות <span style={{ fontWeight: 400, color: '#94a3b8' }}>(אטרקציות שכדאי לשים לב)</span>
                </label>
                <textarea
                  value={publishPOI}
                  onChange={e => setPublishPOI(e.target.value)}
                  rows={3}
                  placeholder="לדוגמה: מפל מדהים ב-100 מטר מהכניסה, נקודת תצפית לשקיעה, עץ עתיק בן 500 שנה..."
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Recommended stops */}
              <div>
                <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  🛑 עצירות מומלצות <span style={{ fontWeight: 400, color: '#94a3b8' }}>(היכן כדאי להתעכב?)</span>
                </label>
                <textarea
                  value={publishStops}
                  onChange={e => setPublishStops(e.target.value)}
                  rows={3}
                  placeholder="לדוגמה: כדאי לעצור 30 דק' ליד הנחל, לאכול ליד הפינה הירוקה בכניסה, לנוח בצל העצים בקילומטר ה-3..."
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Stops preview */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10 }}>📍 עצירות במסלול</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {optimized.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9e6e', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginRight: 'auto' }}>{p.category}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPublishModal(false)} style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>ביטול</button>
                <button onClick={handlePublish} disabled={publishing}
                  style={{ flex: 2, padding: '13px', borderRadius: 14, border: 'none', background: publishing ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontWeight: 800, cursor: publishing ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14, transition: 'all 0.2s' }}>
                  {publishing ? '⏳ מפרסם...' : '🌐 פרסם מסלול'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}