/**
 * TripBucketSheet — 2-Step Wizard
 * --------------------------------
 * Step 1 — "Your Locations": review, reorder, remove collected POIs.
 * Step 2 — "Build Your Route": detect live location, choose strategy
 * (Proximity or Smart Build), fire the backend, then navigate
 * to RouteGenerator with pre-ordered results and clear the bucket.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripBucket } from '../context/TripBucketContext';
import RouterLogo from '../assets/logo.jpeg';
import type { BucketItem, GeoState, UserLocation, BuildMode } from '../utils/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ש' ו-${m} דק'` : `${h} ש'`;
}

// ── Drag-and-Drop reorder hook ────────────────────────────────────────────────

function useDragReorder(onReorder: (from: number, to: number) => void) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      dragIndex.current = index;
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleDragEnter = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      dragOverIndex.current = index;
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragIndex.current === null || dragIndex.current === targetIndex) {
        dragIndex.current = null;
        dragOverIndex.current = null;
        return;
      }
      onReorder(dragIndex.current, targetIndex);
      dragIndex.current = null;
      dragOverIndex.current = null;
    },
    [onReorder]
  );

  const handleDragEnd = useCallback(() => {
    dragIndex.current = null;
    dragOverIndex.current = null;
  }, []);

  return { handleDragStart, handleDragEnter, handleDragOver, handleDrop, handleDragEnd };
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: Readonly<{ current: 1 | 2 }>) {
  const steps = ['המיקומים שלך', 'בניית מסלול'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 20px 0', direction: 'rtl' }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        const labelColor = (active || done) ? '#0d9e6e' : '#94a3b8';
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: done || active ? '#0d9e6e' : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
                fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done ? '✓' : idx}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: labelColor, textAlign: 'center' }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, marginBottom: 14, background: done ? '#0d9e6e' : '#e2e8f0' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── BucketListItem ────────────────────────────────────────────────────────────

function BucketListItem({
  item, index, onRemove, onMoveUp, onMoveDown, dragHandlers,
}: Readonly<{
  item: BucketItem;
  index: number;
  onRemove: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
}>) {
  const { poi } = item;
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 16, marginBottom: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', background: '#fff', direction: 'rtl', overflow: 'hidden' }}>
      {/* Main draggable area — native button acting as the drag handle + info row */}
      <button
        type="button"
        draggable
        onDragStart={dragHandlers.handleDragStart(index)}
        onDragEnter={dragHandlers.handleDragEnter(index)}
        onDragOver={dragHandlers.handleDragOver}
        onDrop={dragHandlers.handleDrop(index)}
        onDragEnd={dragHandlers.handleDragEnd}
        aria-label={`${poi.name} — Arrow Up/Down לשינוי סדר`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); onMoveUp?.(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.(); }
        }}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'grab', userSelect: 'none', textAlign: 'right',
          fontFamily: 'Heebo, sans-serif',
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {index + 1}
        </div>
        <img
          src={poi.main_image ?? RouterLogo}
          alt={poi.name}
          onError={e => { e.currentTarget.src = RouterLogo; e.currentTarget.onerror = null; }}
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#1a2e2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {poi.name}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {poi.region}{poi.duration_minutes ? ` · ${formatDuration(poi.duration_minutes)}` : ''}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
        </svg>
      </button>

      {/* Remove button — outside the draggable area to avoid nesting buttons */}
      <button
        type="button"
        onClick={() => onRemove(poi.id)}
        aria-label={`הסר את ${poi.name}`}
        style={{ background: '#fef2f2', border: 'none', borderRight: '1px solid #fee2e2', width: 46, height: '100%', minHeight: 64, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ── Helpers: parse coordinates from a Google Maps URL or a plain "lat,lng" ───

function parseGoogleMapsUrl(raw: string): UserLocation | null {
  const s = raw.trim();

  const plain = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (plain) {
    const lat = Number.parseFloat(plain[1]);
    const lng = Number.parseFloat(plain[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  const atSign = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
  if (atSign) return { lat: Number.parseFloat(atSign[1]), lng: Number.parseFloat(atSign[2]) };

  const qParam = /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
  if (qParam) return { lat: Number.parseFloat(qParam[1]), lng: Number.parseFloat(qParam[2]) };

  const place = /\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
  if (place) return { lat: Number.parseFloat(place[1]), lng: Number.parseFloat(place[2]) };

  return null;
}

interface GeoCandidate { lat: number; lng: number; display_name: string }

async function geocodePlaceName(query: string): Promise<GeoCandidate[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=he`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'he' } });
    const data = await res.json();
    return (data ?? []).map((r: Record<string, unknown>) => ({
      lat: Number.parseFloat(r.lat as string),
      lng: Number.parseFloat(r.lon as string),
      display_name: r.display_name as string,
    }));
  } catch {
    return [];
  }
}

// ── GPS location hook ─────────────────────────────────────────────────────────

function useGpsLocation(hasInitialLocation: boolean, onDetected: (loc: UserLocation) => void) {
  const [geoState, setGeoState] = useState<GeoState>(hasInitialLocation ? 'success' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('error');
      setErrorMsg('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => { onDetected({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState('success'); },
      err => { setGeoState('error'); setErrorMsg(err.code === 1 ? 'הגישה למיקום נדחתה. אנא אפשר גישה בהגדרות הדפדפן.' : 'לא ניתן לזהות מיקום. אנא נסה שוב.'); },
      { timeout: 10000, enableHighAccuracy: false },
    );
  }, [onDetected]);

  return { geoState, errorMsg, detect };
}

// ── Custom location hook ──────────────────────────────────────────────────────

function useCustomLocation(onDetected: (loc: UserLocation) => void) {
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');
  const [customSuccess, setCustomSuccess] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [candidates, setCandidates] = useState<GeoCandidate[]>([]);

  const applyLocation = useCallback((loc: UserLocation) => {
    onDetected(loc);
    setCustomSuccess(true);
    setCandidates([]);
  }, [onDetected]);

  const submit = useCallback(async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setCustomError('');
    setCustomSuccess(false);
    setCandidates([]);

    const parsed = parseGoogleMapsUrl(trimmed);
    if (parsed) { applyLocation(parsed); return; }

    setGeocoding(true);
    const results = await geocodePlaceName(trimmed);
    setGeocoding(false);

    if (results.length === 0) {
      setCustomError('לא מצאנו מיקום תואם. נסה שם מקום אחר, קואורדינטות, או קישור מגוגל מפות.');
    } else if (results.length === 1) {
      applyLocation(results[0]);
    } else {
      setCandidates(results);
    }
  }, [customInput, applyLocation]);

  const reset = useCallback(() => {
    setCustomError('');
    setCustomSuccess(false);
    setCandidates([]);
    setGeocoding(false);
  }, []);

  return { customInput, setCustomInput, customError, setCustomError, customSuccess, geocoding, candidates, applyLocation, submit, reset };
}

// ── Location Detector sub-panels ─────────────────────────────────────────────

type LocationMode = 'gps' | 'custom';

function GpsPanel({
  geoState, errorMsg, location, detect,
}: Readonly<{ geoState: GeoState; errorMsg: string; location: UserLocation | null; detect: () => void }>) {
  const gpsBorderColor = geoState === 'success' ? '#0d9e6e' : '#e2e8f0';
  const geoStatusColor = geoState === 'success' ? '#0d9e6e' : '#94a3b8';
  const detectBtnBg = geoState === 'loading' ? '#e2e8f0' : '#0d9e6e';
  const detectBtnColor = geoState === 'loading' ? '#94a3b8' : '#fff';
  const detectBtnCursor = geoState === 'loading' ? 'not-allowed' : 'pointer';

  let geoStatusText: string;
  if (geoState === 'success' && location) {
    geoStatusText = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  } else if (geoState === 'loading') {
    geoStatusText = 'מזהה את מיקומך...';
  } else {
    geoStatusText = 'לחץ "זהה מיקום" לאיתור GPS';
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: geoState === 'success' ? '#f0fdf8' : '#f8fafc', border: `2px solid ${gpsBorderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {geoState === 'loading' && <span style={{ fontSize: 18 }}>⏳</span>}
          {geoState === 'success' && <span style={{ fontSize: 18 }}>📍</span>}
          {geoState !== 'loading' && geoState !== 'success' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: geoStatusColor, marginTop: 2 }}>{geoStatusText}</div>
        </div>
        {geoState === 'success' ? (
          <button onClick={detect} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', fontFamily: 'Heebo, sans-serif', flexShrink: 0, textDecoration: 'underline' }}>זהה מחדש</button>
        ) : (
          <button onClick={detect} disabled={geoState === 'loading'} style={{ padding: '7px 14px', border: 'none', borderRadius: 10, background: detectBtnBg, color: detectBtnColor, fontSize: 12, fontWeight: 700, cursor: detectBtnCursor, flexShrink: 0, fontFamily: 'Heebo, sans-serif' }}>
            {geoState === 'loading' ? 'מזהה...' : 'זהה מיקום'}
          </button>
        )}
      </div>
      {geoState === 'error' && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: '#fef2f2', fontSize: 12, color: '#dc2626' }}>⚠️ {errorMsg}</div>
      )}
    </>
  );
}

function CustomPanel({
  custom, location,
}: Readonly<{ custom: ReturnType<typeof useCustomLocation>; location: UserLocation | null }>) {
  let inputBorderColor = '#e2e8f0';
  if (custom.customError) inputBorderColor = '#fca5a5';
  else if (custom.customSuccess) inputBorderColor = '#6ee7b7';

  const submitDisabled = custom.geocoding || !custom.customInput.trim();
  const submitBg = submitDisabled ? '#e2e8f0' : '#0d9e6e';
  const submitColor = submitDisabled ? '#94a3b8' : '#fff';
  const submitCursor = submitDisabled ? 'not-allowed' : 'pointer';

  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
        הקלד שם מקום, הדבק קישור מגוגל מפות, או קואורדינטות בפורמט <strong>קו רוחב, קו אורך</strong>.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={custom.customInput} onChange={e => { custom.setCustomInput(e.target.value); custom.setCustomError(''); }} onKeyDown={e => e.key === 'Enter' && custom.submit()} placeholder="תל אביב, מצפה רמון, https://maps.google.com/..." dir="rtl" style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${inputBorderColor}`, fontSize: 13, fontFamily: 'Heebo, sans-serif', color: '#1a2e2a', outline: 'none', background: '#f8fafc' }} />
        <button onClick={custom.submit} disabled={submitDisabled} style={{ padding: '9px 16px', border: 'none', borderRadius: 10, background: submitBg, color: submitColor, fontSize: 12, fontWeight: 700, cursor: submitCursor, fontFamily: 'Heebo, sans-serif', flexShrink: 0, minWidth: 56 }}>
          {custom.geocoding ? '⏳' : 'חפש'}
        </button>
      </div>
      {custom.customError && <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626' }}>⚠️ {custom.customError}</div>}
      {custom.candidates.length > 0 && (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#64748b', padding: '7px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>נמצאו מספר תוצאות — בחר את המיקום הנכון:</div>
          {custom.candidates.map((cand, i) => (
            <button key={`${cand.lat},${cand.lng}`} onClick={() => custom.applyLocation(cand)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: 'none', borderBottom: i < custom.candidates.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff', cursor: 'pointer', textAlign: 'right', fontFamily: 'Heebo, sans-serif', transition: 'background 0.12s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf8')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a', marginBottom: 2, direction: 'rtl' }}>{cand.display_name.split(',')[0]}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', direction: 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cand.display_name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {custom.customSuccess && location && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#0d9e6e', display: 'flex', alignItems: 'center', gap: 4 }}>✅ מיקום נקבע: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>
      )}
    </div>
  );
}

// ── Location Detector ─────────────────────────────────────────────────────────

function LocationStartPoint({
  location, onDetected,
}: Readonly<{ location: UserLocation | null; onDetected: (loc: UserLocation) => void }>) {
  const [mode, setMode] = useState<LocationMode>('gps');
  const { geoState, errorMsg, detect } = useGpsLocation(location !== null, onDetected);
  const custom = useCustomLocation(onDetected);

  const switchMode = (m: LocationMode) => { setMode(m); custom.reset(); };

  const isResolved = location !== null && (
    (mode === 'gps' && geoState === 'success') || (mode === 'custom' && custom.customSuccess)
  );

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', direction: 'rtl' }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: '#1a2e2a', marginBottom: 10 }}>נקודת התחלה</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
        {([
          { id: 'gps' as LocationMode, label: '📡 מיקום נוכחי (GPS)' },
          { id: 'custom' as LocationMode, label: '🔍 חיפוש מיקום' },
        ] as const).map(opt => (
          <button key={opt.id} onClick={() => switchMode(opt.id)} style={{ flex: 1, padding: '7px 8px', border: 'none', borderRadius: 9, background: mode === opt.id ? '#fff' : 'transparent', color: mode === opt.id ? '#0d9e6e' : '#64748b', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: mode === opt.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'gps' && <GpsPanel geoState={geoState} errorMsg={errorMsg} location={location} detect={detect} />}
      {mode === 'custom' && <CustomPanel custom={custom} location={location} />}

      {isResolved && (
        <div style={{ marginTop: 10, padding: '6px 12px', borderRadius: 10, background: '#f0fdf8', fontSize: 11, color: '#0d9e6e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          נקודת ההתחלה נקבעה בהצלחה
        </div>
      )}
    </div>
  );
}

// ── Strategy Cards ────────────────────────────────────────────────────────────

function StrategyCards({
  selected, onSelect,
}: Readonly<{ selected: BuildMode | null; onSelect: (m: BuildMode) => void }>) {
  const strategies: Array<{ id: BuildMode; icon: string; label: string; description: string; detail: string; comingSoon?: boolean }> = [
    { id: 'smart', icon: '🤖', label: 'בנייה חכמה', description: 'סידור זמנים חכם מבוסס AI', detail: 'מערכת ה-AI מנתחת את אופי המקום ומסדרת הגיונית - הליכות בבוקר, בתי קפה בצהריים ותצפיות בשקיעה.', comingSoon: true },
    { id: 'proximity', icon: '📍', label: 'לפי מרחק', description: 'המסלול הקצר ביותר', detail: 'שימוש באלגוריתם למציאת המסלול המיטבי המזער את מרחק הנסיעה הכולל בין כל העצירות.' },
  ];

  return (
    <div style={{ marginBottom: 16, direction: 'rtl' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>בחר אסטרטגיית בניית מסלול</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {strategies.map(s => {
          const active = selected === s.id;
          return (
            <button key={s.id} onClick={() => !s.comingSoon && onSelect(s.id)} disabled={s.comingSoon} style={{ flex: 1, padding: '14px 12px', borderRadius: 18, cursor: s.comingSoon ? 'not-allowed' : 'pointer', border: `2px solid ${active ? '#0d9e6e' : '#e2e8f0'}`, background: active ? '#f0fdf8' : '#fff', textAlign: 'right', transition: 'all 0.18s', boxShadow: active ? '0 4px 16px rgba(13,158,110,0.15)' : 'none', position: 'relative', overflow: 'hidden', opacity: s.comingSoon ? 0.75 : 1 }}>
              {s.comingSoon && <div style={{ position: 'absolute', top: 12, left: -26, background: '#ef4444', color: '#fff', padding: '4px 30px', transform: 'rotate(-45deg)', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 10, letterSpacing: '0.05em' }}>בקרוב</div>}
              <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: active ? '#0d9e6e' : '#1a2e2a', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#0d9e6e' : '#64748b', marginBottom: 6 }}>{s.description}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>{s.detail}</div>
              {active && <div style={{ marginTop: 8, padding: '3px 10px', borderRadius: 20, background: '#0d9e6e', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-block' }}>✓ נבחר</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Build route helpers ───────────────────────────────────────────────────────

interface RouteApiResponse {
  stops: Array<{ poi_id: string }>;
  total_distance_km?: number;
  total_duration_minutes?: number;
  smart_plan?: unknown;
}

async function callBuildApi(buildMode: BuildMode, poiIds: string[], userLocation: UserLocation): Promise<RouteApiResponse> {
  const base = import.meta.env.VITE_API_URL ?? '';
  const endpoint = buildMode === 'smart' ? `${base}/api/trip-bucket/smart-build` : `${base}/api/trip-bucket/proximity`;
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poi_ids: poiIds, user_location: { lat: userLocation.lat, lng: userLocation.lng } }) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `HTTP ${res.status}`);
  }
  return (await res.json()).data as RouteApiResponse;
}

// ── Step 1 content ────────────────────────────────────────────────────────────

function Step1Content({
  items, count, removePoi, reorderItems, dragHandlers, onNext,
}: Readonly<{
  items: BucketItem[];
  count: number;
  removePoi: (id: string) => void;
  reorderItems: (from: number, to: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onNext: () => void;
}>) {
  if (count === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: 50, marginBottom: 12 }}>🎒</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>סל המסלול שלך ריק</div>
        <div style={{ fontSize: 13 }}>לחץ על <strong>+</strong> בכל כרטיס מיקום כדי להוסיף אותו לכאן.</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        {items.map((item, index) => (
          <BucketListItem
            key={item.poi.id}
            item={item}
            index={index}
            onRemove={removePoi}
            onMoveUp={index > 0 ? () => reorderItems(index, index - 1) : undefined}
            onMoveDown={index < items.length - 1 ? () => reorderItems(index, index + 1) : undefined}
            dragHandlers={dragHandlers}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 14 }}>גרור כדי לשנות סדר · לחץ על × כדי להסיר</div>
      <button onClick={onNext} disabled={count < 2} style={{ width: '100%', padding: '15px', border: 'none', borderRadius: 18, background: count >= 2 ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0', color: count >= 2 ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 900, cursor: count >= 2 ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif', boxShadow: count >= 2 ? '0 6px 20px rgba(13,158,110,0.22)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {count >= 2 ? <>בחר אסטרטגיית בנייה <span style={{ marginRight: 8 }}>←</span></> : 'הוסף לפחות 2 מיקומים כדי להמשיך'}
      </button>
    </>
  );
}

// ── Step 2 content ────────────────────────────────────────────────────────────

function Step2Content({
  userLocation, buildMode, generationError, isGenerating, count, canBuild,
  onDetected, onSelectMode, onBuild,
}: Readonly<{
  userLocation: UserLocation | null;
  buildMode: BuildMode | null;
  generationError: string | null;
  isGenerating: boolean;
  count: number;
  canBuild: boolean;
  onDetected: (loc: UserLocation) => void;
  onSelectMode: (m: BuildMode) => void;
  onBuild: () => void;
}>) {
  const buildLabel = buildMode === 'smart' ? '🤖' : '📍';
  let buildButtonContent: React.ReactNode;
  if (isGenerating) {
    buildButtonContent = <><span style={{ fontSize: 18 }}>⏳</span>{buildMode === 'smart' ? 'מערכת ה-AI מתכננת את המסלול שלך...' : 'מייעל מסלול...'}</>;
  } else if (userLocation === null) {
    buildButtonContent = <>📍 זהה מיקום כדי להמשיך</>;
  } else if (buildMode === null) {
    buildButtonContent = <>בחר אסטרטגיה למעלה</>;
  } else {
    buildButtonContent = <><span style={{ fontSize: 18 }}>{buildLabel}</span>בנה מסלול — {count} עצירות</>;
  }

  return (
    <>
      <LocationStartPoint location={userLocation} onDetected={onDetected} />
      <StrategyCards selected={buildMode} onSelect={onSelectMode} />
      {generationError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#dc2626' }}>⚠️ {generationError}</div>
      )}
      <button onClick={onBuild} disabled={!canBuild} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 18, background: canBuild ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0', color: canBuild ? '#fff' : '#94a3b8', fontSize: 16, fontWeight: 900, cursor: canBuild ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif', boxShadow: canBuild ? '0 6px 24px rgba(13,158,110,0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', marginBottom: 24 }}>
        {buildButtonContent}
      </button>
    </>
  );
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

type SheetStep = 1 | 2;

export default function TripBucketSheet() {
  const { items, count, removePoi, reorderItems, clearBucket, isSheetOpen, closeSheet, isGenerating, setIsGenerating, generationError, setGenerationError, userLocation, setUserLocation } = useTripBucket();
  const navigate = useNavigate();
  const dragHandlers = useDragReorder(reorderItems);
  const [step, setStep] = useState<SheetStep>(1);
  const [buildMode, setBuildMode] = useState<BuildMode | null>(null);

  const handleClose = useCallback(() => { closeSheet(); setTimeout(() => setStep(1), 300); }, [closeSheet]);

  const handleBuildRoute = useCallback(async () => {
    if (!userLocation) { setGenerationError('אנא זהה את מיקומך תחילה.'); return; }
    if (!buildMode) { setGenerationError('אנא בחר אסטרטגיית בנייה.'); return; }
    if (items.length < 2) { setGenerationError('אנא הוסף לפחות 2 מיקומים.'); return; }

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const data = await callBuildApi(buildMode, items.map(i => i.poi.id), userLocation);
      const poiMap = new Map(items.map(i => [i.poi.id, i.poi]));
      const orderedPois = data.stops.map(s => poiMap.get(s.poi_id)).filter(Boolean);
      clearBucket(); closeSheet(); setStep(1);
      navigate('/RouteGenerator', { state: { bucketPois: orderedPois, userLocation, alreadyOrdered: true, routeMeta: { mode: buildMode, total_distance_km: data.total_distance_km, total_duration_minutes: data.total_duration_minutes, smart_plan: data.smart_plan } } });
    } catch (e) {
      setGenerationError((e as Error)?.message || 'יצירת המסלול נכשלה. אנא נסה שוב.');
    } finally {
      setIsGenerating(false);
    }
  }, [userLocation, buildMode, items, setIsGenerating, setGenerationError, clearBucket, closeSheet, navigate]);

  if (!isSheetOpen) return null;

  const canBuild = !!userLocation && !!buildMode && count >= 2 && !isGenerating;

  return (
    <>
      <button type="button" aria-label="סגור" onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', border: 'none', cursor: 'default', padding: 0 }} />

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 4001, background: '#f8fafc', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflowY: 'hidden', direction: 'rtl' }}>
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#cbd5e1' }} />
        </div>

        <div style={{ padding: '10px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8f0ed', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🎒</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#1a2e2a' }}>סל המסלול</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{count === 1 ? 'מיקום 1 נשמר' : `${count} מיקומים נשמרו`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {step === 1 && count > 0 && <button onClick={clearBucket} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>נקה הכל</button>}
            <button onClick={step === 2 ? () => setStep(1) : handleClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {step === 2 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              )}
            </button>
          </div>
        </div>

        <StepIndicator current={step} />
        <div style={{ height: 1, background: '#e8f0ed', margin: '10px 0 0' }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
          {step === 1 && <Step1Content items={items} count={count} removePoi={removePoi} reorderItems={reorderItems} dragHandlers={dragHandlers} onNext={() => setStep(2)} />}
          {step === 2 && <Step2Content userLocation={userLocation} buildMode={buildMode} generationError={generationError} isGenerating={isGenerating} count={count} canBuild={canBuild} onDetected={setUserLocation} onSelectMode={setBuildMode} onBuild={handleBuildRoute} />}
        </div>
      </div>
    </>
  );
}
