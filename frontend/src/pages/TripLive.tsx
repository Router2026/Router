// src/pages/TripLive.tsx — the trip day itself: next stop, how the day is going against the
// plan, a sunset warning, one-tap navigation. Works from the offline copy with no signal.
// Logic lives in utils/liveTrip.ts; this page only wires the clock, location and buttons.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Trip } from '../api';
import { getSavedTrip, refreshSavedTrip } from '../utils/offlineTrips';
import { fromMinutes } from '../utils/routeSchedule';
import {
  ARRIVE_RADIUS_M, computeLiveState, distanceM, loadProgress, localDate, markArrived, markDone,
  markSkipped, minuteOfDay, emptyProgress, saveProgress, sunsetAt, toLiveStops, undoLast, type LiveProgress,
} from '../utils/liveTrip';

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', accent: '#0d9e6e', soft: '#f0fdf8', deep: '#065f46', amber: '#b45309', amberBg: '#fffbeb', red: '#b91c1c', redBg: '#fef2f2' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: '16px 20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'right' };
const btn: React.CSSProperties = { border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', minHeight: 48 };

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} מ'` : `${(m / 1000).toFixed(1)} ק"מ`;
}

function delayBadge(delay: number | null): { text: string; color: string; bg: string } | null {
  if (delay == null) return null;
  if (delay <= 5 && delay >= -5) return { text: 'בזמן לפי התכנון', color: C.deep, bg: C.soft };
  if (delay < 0) return { text: `מקדימים ב-${-delay} דק'`, color: C.deep, bg: C.soft };
  if (delay < 30) return { text: `מאחרים ב-${delay} דק'`, color: C.amber, bg: C.amberBg };
  return { text: `מאחרים ב-${delay} דק'`, color: C.red, bg: C.redBg };
}

export default function TripLive() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tripId = params.get('id') || '';
  const [trip, setTrip] = useState<Trip | null>(null);
  const [offlineCopy, setOfflineCopy] = useState(false);
  const [loading, setLoading] = useState(Boolean(tripId));
  const [stored, setStored] = useState<LiveProgress>(() => loadProgress(tripId));
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const now = useMinuteClock();
  const nowMin = minuteOfDay(now);

  useEffect(() => {
    if (!tripId) return;
    api.trips.get(tripId)
      .then(t => { setTrip(t); refreshSavedTrip(t); })
      .catch(() => {
        const saved = getSavedTrip(tripId);
        if (saved) { setTrip(saved.trip); setOfflineCopy(true); }
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  // Past midnight the stored progress belongs to yesterday, so a new day starts clean.
  const today = localDate(now);
  const progress = stored.date === today ? stored : emptyProgress(today);

  const update = useCallback((next: LiveProgress) => {
    setStored(next);
    saveProgress(tripId, next);
  }, [tripId]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
  }, []);

  const startLocation = () => {
    if (!navigator.geolocation) { setGeoError('המכשיר לא תומך במיקום'); return; }
    setGeoError(null);
    watchId.current = navigator.geolocation.watchPosition(
      p => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(here);
        // Close enough to the next stop → count it as arrived.
        const { state: s, progress: pr, nowMin: t } = liveRef.current;
        const c = s.current;
        if (s.phase === 'enroute' && c?.lat != null && c.lng != null && distanceM(here, { lat: c.lat, lng: c.lng }) <= ARRIVE_RADIUS_M) {
          update(markArrived(pr, c.key, t));
        }
      },
      () => setGeoError('לא קיבלנו הרשאת מיקום'),
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
  };

  const stops = useMemo(() => toLiveStops(trip?.stops || []), [trip]);
  const state = computeLiveState(stops, progress, nowMin);
  const { current } = state;
  const distance = pos && current?.lat != null && current.lng != null ? distanceM(pos, { lat: current.lat, lng: current.lng }) : null;

  // The location callback outlives renders; it reads the latest state from here.
  const liveRef = useRef({ state, progress, nowMin });
  useEffect(() => { liveRef.current = { state, progress, nowMin }; });

  const anchor = stops.find(s => s.lat != null && s.lng != null);
  const sunset = anchor ? sunsetAt(now, anchor.lat!, anchor.lng!) : null;
  const sunsetMin = sunset ? minuteOfDay(sunset) : null;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>טוען...</div>;
  if (!trip) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>המסלול לא נמצא</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>בלי קליטה אפשר לפתוח רק מסלולים ששמרתם במכשיר.</div>
        <button type="button" onClick={() => navigate('/MyTrips')} style={{ ...btn, background: C.accent, color: '#fff' }}>חזרה למסלולים</button>
      </div>
    );
  }

  const badge = delayBadge(state.delay);
  const lastRemaining = state.remaining.at(-1);
  const pastSunset = sunsetMin != null && state.projectedEnd != null && state.projectedEnd > sunsetMin;
  const minsToSunset = sunsetMin != null ? sunsetMin - nowMin : null;
  const closedCount = progress.done.length + progress.skipped.length;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>
      <div style={{ background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button type="button" onClick={() => navigate(`/TripDetail?id=${tripId}`)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', color: '#fff', fontSize: 13, fontFamily: 'Heebo, sans-serif' }}>
            ← למסלול
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700 }}>מצב טיול · <bdi dir="ltr">{fromMinutes(nowMin)}</bdi></div>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: 0 }}>{trip.name}</h1>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{closedCount}/{stops.length} עצירות</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 100px' }}>
        {offlineCopy && (
          <div role="status" style={{ ...card, background: C.amberBg, color: '#92400e', fontSize: 13 }}>📴 אין חיבור – עובדים מהעותק השמור במכשיר.</div>
        )}

        {state.phase !== 'finished' && pastSunset && (
          <div role="alert" style={{ ...card, background: C.redBg, color: C.red, fontSize: 14, lineHeight: 1.6 }}>
            🌅 לפי הקצב הנוכחי תסיימו ב-<bdi dir="ltr">{fromMinutes(state.projectedEnd!)}</bdi>, אחרי השקיעה (<bdi dir="ltr">{fromMinutes(sunsetMin!)}</bdi>).
            {state.remaining.length > 1 && lastRemaining && <> כדאי לשקול לדלג על <b>{lastRemaining.name}</b>.</>}
          </div>
        )}
        {state.phase !== 'finished' && !pastSunset && minsToSunset != null && minsToSunset > 0 && minsToSunset <= 60 && (
          <div role="status" style={{ ...card, background: C.amberBg, color: C.amber, fontSize: 14 }}>
            🌅 השקיעה בעוד {minsToSunset} דק' (<bdi dir="ltr">{fromMinutes(sunsetMin!)}</bdi>). בשבילים בטבע כדאי לצאת לפני החושך.
          </div>
        )}

        {state.phase === 'finished' ? (
          <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, margin: '8px 0 4px' }}>סיימתם את המסלול!</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{progress.done.length} עצירות בוקרו{progress.skipped.length ? `, ${progress.skipped.length} דולגו` : ''}.</div>
            <button type="button" onClick={() => navigate(`/TripDetail?id=${tripId}`)} style={{ ...btn, background: C.accent, color: '#fff' }}>חזרה למסלול</button>
          </div>
        ) : current && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>
                {state.phase === 'at' ? 'אתם כאן' : 'העצירה הבאה'} · {state.currentIndex + 1}/{stops.length}
              </span>
              {badge && <span style={{ fontSize: 12, fontWeight: 800, color: badge.color, background: badge.bg, padding: '3px 8px', borderRadius: 8 }}>{badge.text}</span>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 6 }}>{current.name}</div>

            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 14 }}>
              {state.phase === 'enroute' && current.arrival != null && <div>הגעה מתוכננת: <bdi dir="ltr">{fromMinutes(current.arrival)}</bdi></div>}
              {state.phase === 'enroute' && distance != null && <div>מרחק בקו אווירי: {formatDistance(distance)}</div>}
              {state.phase === 'at' && state.minutesLeftHere != null && (
                state.minutesLeftHere >= 0
                  ? <div>נשארו כאן {state.minutesLeftHere} דק' לפי התכנון ({current.duration} דק' ביקור)</div>
                  : <div style={{ color: C.amber, fontWeight: 700 }}>חרגתם ב-{-state.minutesLeftHere} דק' מזמן הביקור</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.phase === 'enroute' ? (
                <>
                  {current.lat != null && current.lng != null && (
                    <a href={wazeUrl(current.lat, current.lng)} target="_blank" rel="noopener noreferrer"
                      style={{ ...btn, background: C.accent, color: '#fff', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                      🧭 נווט ל{current.name}
                    </a>
                  )}
                  <button type="button" onClick={() => update(markArrived(progress, current.key, nowMin))} style={{ ...btn, background: C.soft, color: C.deep }}>📍 הגענו</button>
                </>
              ) : (
                <button type="button" onClick={() => update(markDone(progress, current.key))} style={{ ...btn, background: C.accent, color: '#fff' }}>✓ סיימנו כאן – לעצירה הבאה</button>
              )}
              <button type="button" onClick={() => update(markSkipped(progress, current.key))} style={{ ...btn, background: '#fff', color: C.muted, border: '2px solid #e2e8f0' }}>דלג על העצירה</button>
            </div>
          </div>
        )}

        {state.remaining.length > 1 && (
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, marginBottom: 10 }}>בהמשך היום</div>
            {state.remaining.slice(1).map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{s.name}</span>
                {s.arrival != null && (
                  <bdi dir="ltr" style={{ color: state.delay && state.delay > 5 ? C.amber : C.muted, fontVariantNumeric: 'tabular-nums' }}>
                    ~{fromMinutes(s.arrival + Math.max(0, state.delay ?? 0))}
                  </bdi>
                )}
              </div>
            ))}
            {state.projectedEnd != null && (
              <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>סיום משוער: <bdi dir="ltr">{fromMinutes(state.projectedEnd)}</bdi>{sunsetMin != null && <> · שקיעה <bdi dir="ltr">{fromMinutes(sunsetMin)}</bdi></>}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!pos && state.phase !== 'finished' && (
            <button type="button" onClick={startLocation} style={{ ...btn, background: '#fff', color: C.deep, border: `2px solid ${C.soft}`, fontSize: 13, minHeight: 40, padding: '8px 14px' }}>
              📍 הפעל מיקום (סימון הגעה אוטומטי)
            </button>
          )}
          {closedCount > 0 && (
            <button type="button" onClick={() => update(undoLast(progress, stops))} style={{ ...btn, background: 'transparent', color: C.muted, fontSize: 13, minHeight: 40, padding: '8px 14px' }}>
              ↶ בטל פעולה אחרונה
            </button>
          )}
        </div>
        {geoError && <div style={{ textAlign: 'center', fontSize: 12, color: C.red, marginTop: 6 }}>{geoError}</div>}
      </div>
    </div>
  );
}
