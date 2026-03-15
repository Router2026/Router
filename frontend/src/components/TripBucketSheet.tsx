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
import {
  useTripBucket,
  type BuildMode,
  type UserLocation,
} from '../context/TripBucketContext';
import RouterLogo from '../assets/logo.jpeg';

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

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === targetIndex) return;
    onReorder(dragIndex.current, targetIndex);
    dragIndex.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return { handleDragStart, handleDrop, handleDragOver };
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = ['המיקומים שלך', 'בניית מסלול'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 20px 0', direction: 'rtl' }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
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
              <div style={{
                fontSize: 10, fontWeight: 700, marginTop: 4,
                color: active ? '#0d9e6e' : done ? '#0d9e6e' : '#94a3b8',
                textAlign: 'center',
              }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 14,
                background: done ? '#0d9e6e' : '#e2e8f0',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── BucketListItem ────────────────────────────────────────────────────────────

function BucketListItem({
  item, index, onRemove, dragHandlers,
}: {
  item: { poi: any; addedAt: number };
  index: number;
  onRemove: (id: string) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
}) {
  const { poi } = item;
  return (
    <div
      draggable
      onDragStart={dragHandlers.handleDragStart(index)}
      onDrop={dragHandlers.handleDrop(index)}
      onDragOver={dragHandlers.handleDragOver}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: '#fff', borderRadius: 16,
        marginBottom: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        cursor: 'grab', userSelect: 'none', direction: 'rtl'
      }}
    >
      {/* Order badge */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
        color: '#fff', fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {index + 1}
      </div>

      {/* Thumbnail */}
      <img
        src={poi.main_image || RouterLogo}
        alt={poi.name}
        onError={e => { e.currentTarget.src = RouterLogo; e.currentTarget.onerror = null; }}
        style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 800, fontSize: 14, color: '#1a2e2a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {poi.name}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {poi.region}{poi.duration_minutes ? ` · ${formatDuration(poi.duration_minutes)}` : ''}
        </div>
      </div>

      {/* Drag handle + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onRemove(poi.id)}
          style={{ background: '#fef2f2', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
        </svg>
      </div>
    </div>
  );
}

// ── Location Detector ─────────────────────────────────────────────────────────

type GeoState = 'idle' | 'loading' | 'success' | 'error';

function LocationStartPoint({
  location,
  onDetected,
}: {
  location: UserLocation | null;
  onDetected: (loc: UserLocation) => void;
}) {
  const [geoState, setGeoState] = useState<GeoState>(location ? 'success' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDetect = () => {
    if (!navigator.geolocation) {
      setGeoState('error');
      setErrorMsg('הדפדפן שלך אינו תומך בזיהוי מיקום.');
      return;
    }
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        onDetected({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState('success');
      },
      err => {
        setGeoState('error');
        setErrorMsg(
          err.code === 1
            ? 'הגישה למיקום נדחתה. אנא אפשר גישה בהגדרות הדפדפן.'
            : 'לא ניתן לזהות מיקום. אנא נסה שוב.',
        );
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '14px 16px',
      marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', direction: 'rtl'
    }}>
      {/* Row: icon + label + status/button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Pin icon circle */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: geoState === 'success' ? '#f0fdf8' : '#f8fafc',
          border: `2px solid ${geoState === 'success' ? '#0d9e6e' : '#e2e8f0'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {geoState === 'loading' ? (
            <span style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>⏳</span>
          ) : geoState === 'success' ? (
            <span style={{ fontSize: 18 }}>📍</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1a2e2a' }}>
            נקודת התחלה
          </div>
          <div style={{
            fontSize: 11, color: geoState === 'success' ? '#0d9e6e' : '#94a3b8',
            marginTop: 2,
          }}>
            {geoState === 'success' && location
              ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
              : geoState === 'loading'
                ? 'מזהה את מיקומך...'
                : 'המיקום הנוכחי שלך (חובה)'}
          </div>
        </div>

        {/* Action button */}
        {geoState !== 'success' && (
          <button
            onClick={handleDetect}
            disabled={geoState === 'loading'}
            style={{
              padding: '7px 14px', border: 'none', borderRadius: 10,
              background: geoState === 'loading' ? '#e2e8f0' : '#0d9e6e',
              color: geoState === 'loading' ? '#94a3b8' : '#fff',
              fontSize: 12, fontWeight: 700, cursor: geoState === 'loading' ? 'not-allowed' : 'pointer',
              flexShrink: 0, fontFamily: 'Heebo, sans-serif',
            }}
          >
            {geoState === 'loading' ? 'מזהה...' : 'זהה מיקום'}
          </button>
        )}

        {/* Re-detect link when already set */}
        {geoState === 'success' && (
          <button
            onClick={handleDetect}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: '#94a3b8', fontFamily: 'Heebo, sans-serif',
              flexShrink: 0, textDecoration: 'underline',
            }}
          >
            זהה מחדש
          </button>
        )}
      </div>

      {/* Error */}
      {geoState === 'error' && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10,
          background: '#fef2f2', fontSize: 12, color: '#dc2626',
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}

// ── Strategy Cards ────────────────────────────────────────────────────────────

function StrategyCards({
  selected,
  onSelect,
}: {
  selected: BuildMode | null;
  onSelect: (m: BuildMode) => void;
}) {
  const strategies: Array<{
    id: BuildMode;
    icon: string;
    label: string;
    description: string;
    detail: string;
  }> = [
      {
        id: 'smart',
        icon: '🤖',
        label: 'בנייה חכמה',
        description: 'סידור זמנים חכם מבוסס AI',
        detail: 'מערכת ה-AI מנתחת את אופי המקום ומסדרת הגיונית - הליכות בבוקר, בתי קפה בצהריים ותצפיות בשקיעה.',
      },
      {
        id: 'proximity',
        icon: '📍',
        label: 'לפי מרחק',
        description: 'המסלול הקצר ביותר',
        detail: 'שימוש באלגוריתם למציאת המסלול המיטבי המזער את מרחק הנסיעה הכולל בין כל העצירות.',
      },
    ];

  return (
    <div style={{ marginBottom: 16, direction: 'rtl' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        בחר אסטרטגיית בניית מסלול
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {strategies.map(s => {
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                flex: 1, padding: '14px 12px', borderRadius: 18, cursor: 'pointer',
                border: `2px solid ${active ? '#0d9e6e' : '#e2e8f0'}`,
                background: active ? '#f0fdf8' : '#fff',
                textAlign: 'right', transition: 'all 0.18s',
                boxShadow: active ? '0 4px 16px rgba(13,158,110,0.15)' : 'none',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: active ? '#0d9e6e' : '#1a2e2a', marginBottom: 3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#0d9e6e' : '#64748b', marginBottom: 6 }}>
                {s.description}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
                {s.detail}
              </div>
              {active && (
                <div style={{
                  marginTop: 8, padding: '3px 10px', borderRadius: 20,
                  background: '#0d9e6e', color: '#fff',
                  fontSize: 10, fontWeight: 800, display: 'inline-block',
                }}>
                  ✓ נבחר
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

type SheetStep = 1 | 2;

export default function TripBucketSheet() {
  const {
    items, count, removePoi, reorderItems, clearBucket,
    isSheetOpen, closeSheet,
    isGenerating, setIsGenerating,
    generationError, setGenerationError,
    userLocation, setUserLocation,
  } = useTripBucket();

  const navigate = useNavigate();
  const dragHandlers = useDragReorder(reorderItems);

  // Wizard step — resets to 1 whenever the sheet is closed
  const [step, setStep] = useState<SheetStep>(1);
  const [buildMode, setBuildMode] = useState<BuildMode | null>(null);

  const handleClose = useCallback(() => {
    closeSheet();
    // Reset step so re-opening always starts at step 1
    setTimeout(() => setStep(1), 300);
  }, [closeSheet]);

  // ── Build Route ──────────────────────────────────────────────────────────
  const handleBuildRoute = useCallback(async () => {
    if (!userLocation) {
      setGenerationError('אנא זהה את מיקומך תחילה.');
      return;
    }
    if (!buildMode) {
      setGenerationError('אנא בחר אסטרטגיית בנייה.');
      return;
    }
    if (items.length < 2) {
      setGenerationError('אנא הוסף לפחות 2 מיקומים.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const poiIds = items.map(i => i.poi.id);
      const endpoint =
        buildMode === 'smart'
          ? '/api/trip-bucket/smart-build'
          : '/api/trip-bucket/proximity';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_ids: poiIds,
          user_location: { lat: userLocation.lat, lng: userLocation.lng },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || err?.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const data = json.data;

      // Map returned stops back to POI objects (preserving full metadata)
      const poiMap = new Map(items.map(i => [i.poi.id, i.poi]));
      const orderedPois = (data.stops as Array<{ poi_id: string }>)
        .map(s => poiMap.get(s.poi_id))
        .filter(Boolean);

      // Clear bucket and navigate — RouteGenerator will skip its own optimizer
      clearBucket();
      closeSheet();
      setStep(1);

      navigate('/RouteGenerator', {
        state: {
          bucketPois: orderedPois,
          userLocation,
          alreadyOrdered: true,
          routeMeta: {
            mode: buildMode,
            total_distance_km: data.total_distance_km,
            total_duration_minutes: data.total_duration_minutes,
            smart_plan: data.smart_plan,
          },
        },
      });
    } catch (e: any) {
      setGenerationError(e?.message || 'יצירת המסלול נכשלה. אנא נסה שוב.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    userLocation, buildMode, items,
    setIsGenerating, setGenerationError,
    clearBucket, closeSheet, navigate,
  ]);

  if (!isSheetOpen) return null;

  const canProceedToStep2 = count >= 2;
  const canBuild = !!userLocation && !!buildMode && count >= 2 && !isGenerating;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 4001,
        background: '#f8fafc', borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        overflowY: 'hidden', direction: 'rtl'
      }}>

        {/* Drag handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#cbd5e1' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '10px 20px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #e8f0ed', flexShrink: 0,
        }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🎒</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#1a2e2a' }}>סל הטיול</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {count === 1 ? 'מיקום 1 נשמר' : `${count} מיקומים נשמרו`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Clear all (step 1 only) */}
            {step === 1 && count > 0 && (
              <button
                onClick={clearBucket}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}
              >
                נקה הכל
              </button>
            )}

            {/* Back button (step 2) or Close (step 1) */}
            <button
              onClick={step === 2 ? () => setStep(1) : handleClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {step === 2 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Divider */}
        <div style={{ height: 1, background: '#e8f0ed', margin: '10px 0 0' }} />

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>

          {/* ── STEP 1: Your Locations ── */}
          {step === 1 && (
            <>
              {count === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 50, marginBottom: 12 }}>🎒</div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>סל הטיול שלך ריק</div>
                  <div style={{ fontSize: 13 }}>
                    לחץ על <strong>+</strong> בכל כרטיס מיקום כדי להוסיף אותו לכאן.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    {items.map((item, index) => (
                      <BucketListItem
                        key={item.poi.id}
                        item={item}
                        index={index}
                        onRemove={removePoi}
                        dragHandlers={dragHandlers}
                      />
                    ))}
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 14 }}>
                    גרור כדי לשנות סדר · לחץ על × כדי להסיר
                  </div>

                  {/* Next step CTA */}
                  <button
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                    style={{
                      width: '100%', padding: '15px', border: 'none', borderRadius: 18,
                      background: canProceedToStep2
                        ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)'
                        : '#e2e8f0',
                      color: canProceedToStep2 ? '#fff' : '#94a3b8',
                      fontSize: 15, fontWeight: 900,
                      cursor: canProceedToStep2 ? 'pointer' : 'not-allowed',
                      fontFamily: 'Heebo, sans-serif',
                      boxShadow: canProceedToStep2 ? '0 6px 20px rgba(13,158,110,0.22)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      marginBottom: 24,
                    }}
                  >
                    {canProceedToStep2
                      ? <>בחר אסטרטגיית בנייה <span style={{ marginRight: 8 }}>←</span></>
                      : 'הוסף לפחות 2 מיקומים כדי להמשיך'
                    }
                  </button>
                </>
              )}
            </>
          )}

          {/* ── STEP 2: Build Your Route ── */}
          {step === 2 && (
            <>
              {/* Location detector */}
              <LocationStartPoint
                location={userLocation}
                onDetected={loc => setUserLocation(loc)}
              />

              {/* Strategy selector */}
              <StrategyCards selected={buildMode} onSelect={setBuildMode} />

              {/* Error */}
              {generationError && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                  fontSize: 13, color: '#dc2626',
                }}>
                  ⚠️ {generationError}
                </div>
              )}

              {/* Build CTA */}
              <button
                onClick={handleBuildRoute}
                disabled={!canBuild}
                style={{
                  width: '100%', padding: '16px', border: 'none', borderRadius: 18,
                  background: canBuild
                    ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)'
                    : '#e2e8f0',
                  color: canBuild ? '#fff' : '#94a3b8',
                  fontSize: 16, fontWeight: 900,
                  cursor: canBuild ? 'pointer' : 'not-allowed',
                  fontFamily: 'Heebo, sans-serif',
                  boxShadow: canBuild ? '0 6px 24px rgba(13,158,110,0.25)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.2s', marginBottom: 24,
                }}
              >
                {isGenerating ? (
                  <>
                    <span style={{ fontSize: 18 }}>⏳</span>
                    {buildMode === 'smart' ? 'מערכת ה-AI מתכננת את המסלול שלך...' : 'מייעל מסלול...'}
                  </>
                ) : !userLocation ? (
                  <>📍 זהה מיקום כדי להמשיך</>
                ) : !buildMode ? (
                  <>בחר אסטרטגיה למעלה</>
                ) : (
                  <>
                    <span style={{ fontSize: 18 }}>{buildMode === 'smart' ? '🤖' : '📍'}</span>
                    בנה מסלול — {count} עצירות
                  </>
                )}
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}