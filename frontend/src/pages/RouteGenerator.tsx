// src/pages/RouteGenerator.tsx — build a route yourself, and review/save any route.
// Steps: 1 region (+ optional start point) → 2 pick places on a map/list → 3 review & save.
// From step 2 the picks are built either by the trip agents (Smart Build, streamed live) or by
// shortest distance. Smart Build / the free-text planner also land directly on step 3.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, streamSmartBuild, toast, type POI, type Region } from '../api';
import { useRegions } from '../hooks/useLocations';
import { useAgentRun } from '../hooks/useAgentRun';
import { SMART_BUILD_AGENTS } from '../utils/agents';
import RouteReview, { type RouteDetails } from '../components/RouteReview';
import RouteGeneratingOverlay from '../components/RouteGeneratingOverlay';
import RegionStep from '../components/route-builder/RegionStep';
import PlacesStep, { SMART_BUILD_MAX } from '../components/route-builder/PlacesStep';
import { buildSchedule, haversineKm as haversineLatLng, type PlanMeta } from '../utils/routeSchedule';
import type { LatLng } from '../utils/types';

/** Places per region request (the API caps a page at 100) and how many pages to load at most. */
const PLACES_PAGE = 100;
const PLACES_MAX_PAGES = 6; // the largest region (Negev) has ~480 places

interface SmartBuildResult {
  stops: Array<{ poi_id: string }>;
  total_distance_km?: number;
  smart_plan?: PlanMeta;
  warnings?: string[];
  safety_footer?: string;
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  return haversineLatLng({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
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

function toMinutesSafe(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}


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

  // Stored as Hebrew labels, same as the AI planner saves them.
  const [details, setDetails] = useState<RouteDetails>({ tripType: 'משפחה', tripStyle: 'טבע', tripDifficulty: 'בינוני' });
  // The trip agents' plan when the route came from Smart Build / the free-text planner.
  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [planDistanceKm, setPlanDistanceKm] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [safetyFooter, setSafetyFooter] = useState<string | null>(null);

  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [loadingRegionId, setLoadingRegionId] = useState<number | null>(null);

  // Smart Build from the picked places: live agent progress in an overlay.
  const agents = useAgentRun(SMART_BUILD_AGENTS);
  const [building, setBuilding] = useState(false);
  const buildAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => buildAbortRef.current?.abort(), []);

  useEffect(() => {
    const state = routerLocation.state as {
      bucketPois?: POI[];
      userLocation?: { lat: number; lng: number } | null;
      alreadyOrdered?: boolean;
      routeMeta?: {
        smart_plan?: PlanMeta;
        total_distance_km?: number;
        warnings?: string[];
        safety_footer?: string;
      };
    } | null;
    if (state?.bucketPois && state.bucketPois.length >= 2) {
      const incoming = state.bucketPois;
      const meta = state.routeMeta;
      setSelectedPois(incoming);
      setPlan(meta?.smart_plan ?? null);
      setPlanDistanceKm(typeof meta?.total_distance_km === 'number' ? meta.total_distance_km : null);
      setWarnings(meta?.warnings ?? []);
      setSafetyFooter(meta?.safety_footer ?? null);
      setRouteName(meta?.smart_plan?.route_title || `מסלול נבחר — ${new Date().toLocaleDateString('he-IL')}`);

      // If the user already set a start point in TripBucketSheet, use it
      // directly — no need to request GPS again.
      if (state.userLocation) {
        const sp: LatLng = { lat: state.userLocation.lat, lng: state.userLocation.lng };
        setStartPoint(sp);
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
      globalThis.history.replaceState({}, '');
    }
     
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
    setGeoError('');
  };

  const selectRegion = useCallback(async (region: Region) => {
    setLoadingRegionId(region.id);
    setLoadingPois(true);
    try {
      const all: POI[] = [];
      for (let page = 0; page < PLACES_MAX_PAGES; page++) {
        const batch = await api.locations.list({ region: region.name, limit: PLACES_PAGE, offset: page * PLACES_PAGE });
        all.push(...batch);
        if (batch.length < PLACES_PAGE) break;
      }
      // Keep earlier picks only if they're in this region.
      const ids = new Set(all.map(p => p.id));
      setSelectedPois(prev => prev.filter(p => ids.has(p.id)));
      setSelectedRegion(region);
      setPois(all);
      setStep('pois');
      globalThis.scrollTo({ top: 0 });
    } catch (e) {
      console.error('Loading places failed:', e);
      toast.error('לא הצלחנו לטעון את המקומות באזור. נסו שוב.');
    } finally {
      setLoadingPois(false);
      setLoadingRegionId(null);
    }
  }, []);

  const togglePOI = useCallback((poi: POI) => {
    setSelectedPois(prev =>
      prev.some(p => p.id === poi.id)
        ? prev.filter(p => p.id !== poi.id)
        : [...prev, poi]
    );
  }, []);

  const handleOptimize = useCallback(() => {
    const opt = optimizeRoute([...selectedPois], startPoint);
    setOptimized(opt);
    setPlan(null);
    setPlanDistanceKm(null);
    setWarnings([]);
    setSafetyFooter(null);
    setRouteName(`מסלול ב${selectedRegion?.name || ''} — ${new Date().toLocaleDateString('he-IL')}`);
    setStep('route');
    globalThis.scrollTo({ top: 0 });
  }, [selectedPois, startPoint, selectedRegion?.name]);

  const handleBuildSmart = useCallback(async () => {
    if (selectedPois.length < 2 || selectedPois.length > SMART_BUILD_MAX || building) return;
    buildAbortRef.current?.abort();
    const controller = new AbortController();
    buildAbortRef.current = controller;
    setBuilding(true);
    agents.reset();
    try {
      const data = await streamSmartBuild<SmartBuildResult>(selectedPois.map(p => p.id), startPoint, agents.onStep, controller.signal);
      const byId = new Map(selectedPois.map(p => [p.id, p]));
      const ordered = data.stops.map(s => byId.get(String(s.poi_id))).filter((p): p is POI => !!p);
      setOptimized(ordered);
      setPlan(data.smart_plan ?? null);
      setPlanDistanceKm(typeof data.total_distance_km === 'number' ? data.total_distance_km : null);
      setWarnings(data.warnings ?? []);
      setSafetyFooter(data.safety_footer ?? null);
      setRouteName(data.smart_plan?.route_title || `מסלול ב${selectedRegion?.name || ''}`);
      setStep('route');
      globalThis.scrollTo({ top: 0 });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      console.error('Smart Build failed:', e);
      toast.error((e as Error)?.message || 'הבנייה החכמה נכשלה. נסו שוב או בנו לפי מרחק.');
    } finally {
      if (buildAbortRef.current === controller) buildAbortRef.current = null;
      agents.stop();
      setBuilding(false);
    }
  }, [selectedPois, startPoint, selectedRegion?.name, building, agents]);

  const schedule = useMemo(() => buildSchedule(optimized, plan, startPoint), [optimized, plan, startPoint]);
  const dist = useMemo(
    () => (schedule.planned && planDistanceKm !== null ? planDistanceKm : totalDistance(optimized)),
    [schedule.planned, planDistanceKm, optimized],
  );
  const regionName = selectedRegion?.name || optimized[0]?.region || '';

  const handleSave = async () => {
    if (!schedule.stops.length) return;
    setSaving(true);
    try {
      const minutes = Math.max(0, toMinutesSafe(schedule.endTime) - toMinutesSafe(schedule.startTime));
      const saved = await api.trips.create({
        name: routeName.trim() || `מסלול ב${regionName}`,
        description: schedule.planned ? (plan?.overview || plan?.route_description || undefined) : undefined,
        why: schedule.planned ? (plan?.why || null) : null,
        region: regionName || undefined,
        total_duration_hours: Math.round((minutes / 60) * 10) / 10,
        total_distance_km: Math.round(dist * 10) / 10,
        difficulty: details.tripDifficulty,
        group_type: details.tripType,
        style: details.tripStyle,
        stops: schedule.stops.map((st, i) => ({
          poi_name: st.poi.name,
          location_id: Number.parseInt(st.poi.id, 10),
          arrival_time: st.arrival,
          duration_minutes: st.durationMinutes,
          smart_insight: st.tip ?? undefined,
          reason: st.reason,
          order_index: i,
        })),
      });
      navigate(`/TripDetail?id=${saved.id}`);
    } catch (e) {
      console.error('Saving the route failed:', e);
      toast.error('שמירת המסלול נכשלה. נסו שוב.');
      setSaving(false);
    }
  };

  const removeStop = (id: string) => {
    setOptimized(prev => prev.filter(p => p.id !== id));
    setSelectedPois(prev => prev.filter(p => p.id !== id));
  };

  const handlePublish = async () => {
    if (!optimized.length) return;
    setPublishing(true);
    try {
      const publicTrip = await api.publicTrips.create({
        title: routeName || `מסלול ב${regionName}`,
        description: publishDesc || undefined,
        is_public: true,
        location_ids: optimized.map(p => Number.parseInt(p.id)),
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


  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        background: '#fff', padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl',
      }}>
        <button type="button" aria-label="חזרה"
          onClick={() => { if (step === 'pois') setStep('region'); else if (step === 'route' && selectedRegion) setStep('pois'); else navigate(-1); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>🗺️ {step === 'route' ? 'המסלול שלך' : 'בנה מסלול בעצמך'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{step === 'route' ? 'בדקו, תנו שם ושמרו' : 'בוחרים מקומות, ואנחנו מסדרים את היום'}</div>
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
          <RegionStep
            regions={regions}
            hasStart={!!startPoint}
            geoLoading={geoLoading}
            geoError={geoError}
            loadingRegionId={loadingRegionId}
            onLocate={requestGeolocation}
            onClearStart={clearStartPoint}
            onSelect={selectRegion}
          />
        )}

        {/* ── Step 2: Pick places ────────────────────────────────────────────── */}
        {step === 'pois' && (
          <PlacesStep
            region={selectedRegion}
            places={pois}
            loading={loadingPois}
            picked={selectedPois}
            start={startPoint}
            onToggle={togglePOI}
            onClear={() => setSelectedPois([])}
            onChangeRegion={() => setStep('region')}
            onBuildSmart={handleBuildSmart}
            onBuildDistance={handleOptimize}
          />
        )}

        {/* ── Step 3: Review & save ───────────────────────────────────────────── */}
        {step === 'route' && (
          <RouteReview
            schedule={schedule}
            start={startPoint}
            overview={schedule.planned ? (plan?.overview || null) : null}
            why={schedule.planned ? (plan?.why || null) : null}
            warnings={warnings}
            safetyFooter={safetyFooter}
            distanceKm={dist}
            routeName={routeName}
            onRouteName={setRouteName}
            details={details}
            onDetails={setDetails}
            onRemove={!schedule.planned && optimized.length > 2 ? removeStop : undefined}
            onEdit={selectedRegion ? () => setStep('pois') : undefined}
            saving={saving}
            onSave={handleSave}
            onPublish={() => setShowPublishModal(true)}
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {building && (
        <RouteGeneratingOverlay
          phase="planning"
          keys={agents.visible}
          state={agents.state}
          startedAt={agents.startedAt}
          title="הסוכנים מסדרים את המקומות שבחרת"
          onCancel={() => buildAbortRef.current?.abort()}
        />
      )}

      {/* ── Publish Modal ───────────────────────────────────────────── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16 }}>
          <button type="button" aria-label="סגור" onClick={() => setShowPublishModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'default', padding: 0 }} />
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 }}>

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
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{routeName || `מסלול ב${regionName}`}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{optimized.length} עצירות · {regionName}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="rg-pub-desc" style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  📝 תיאור המסלול <span style={{ fontWeight: 400, color: '#94a3b8' }}>(מה מיוחד? למי מתאים?)</span>
                </label>
                <textarea
                  id="rg-pub-desc"
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
                <label htmlFor="rg-pub-poi" style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  ✨ נקודות עניין מיוחדות <span style={{ fontWeight: 400, color: '#94a3b8' }}>(אטרקציות שכדאי לשים לב)</span>
                </label>
                <textarea
                  id="rg-pub-poi"
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
                <label htmlFor="rg-pub-stops" style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
                  🛑 עצירות מומלצות <span style={{ fontWeight: 400, color: '#94a3b8' }}>(היכן כדאי להתעכב?)</span>
                </label>
                <textarea
                  id="rg-pub-stops"
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
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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