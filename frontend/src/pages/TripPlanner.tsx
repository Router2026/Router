import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, toast, type AiGroupType } from '../api';
import { useAuth } from '../context/AuthContext';
import RouteGeneratingOverlay, { type GeneratingPhase } from '../components/RouteGeneratingOverlay';
import { describeRouteError, isAbortError, saveDraft, takeDraft, type RouteErrorInfo } from '../utils/aiRoutePlanner';

// These stay local — UI-only choices not stored in backend
const GROUP_TYPES = [
  { id: 'solo',    name: 'יחיד',           emoji: '🚶' },
  { id: 'couple',  name: 'זוג',             emoji: '👫' },
  { id: 'family',  name: 'משפחה',           emoji: '👨‍👩‍👧‍👦' },
  { id: 'friends', name: 'חברים',           emoji: '👥' },
];

const STYLES = [
  { id: 'history', name: 'היסטוריה ותרבות', icon: '🕌' },
  { id: 'water',   name: 'מים ומעיינות',    icon: '💧' },
  { id: 'photo',   name: 'צילום ונוף',      icon: '📷' },
  { id: 'nature',  name: 'נופים ומצפים',    icon: '⛰️' },
  { id: 'hiking',  name: 'טיולים ומסלולים', icon: '🥾' },
  { id: 'beach',   name: 'חופים וים',       icon: '🏖️' },
  { id: 'geology', name: 'גיאולוגיה',       icon: '🪨' },
  { id: 'wine',    name: 'יין ואוכל',       icon: '🍷' },
  { id: 'village', name: 'כפרים ומסורת',    icon: '🏡' },
  { id: 'family_activities', name: 'פעילויות לילדים', icon: '🎠' },
];

const STOP_COUNTS = ['3', '5', '7'];
const STEPS = ['אזור', 'הרכב', 'סגנון', 'פרטים'];

const REGION_ICONS: Record<string, string> = {
  'גולן': '⛰️', 'גליל עליון': '⛰️', 'גליל תחתון': '💧', 'כרמל': '🌲',
  'מרכז': '📍', 'ירושלים': '🕐', 'דרום': '⛰️', 'אילת': '💧',
  'עמק יזרעאל': '🌾', 'שרון': '🌸', 'נגב': '🏜️', 'ערבה': '🌵',
};

export default function TripPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const needsLogin = !authLoading && !isLoggedIn;
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState('');
  const [groupType, setGroupType] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('16:00');
  const [stops, setStops] = useState('5');
  const [date, setDate] = useState('');
  const [phase, setPhase] = useState<GeneratingPhase | null>(null);
  const [genError, setGenError] = useState<RouteErrorInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the wizard after returning from the login page.
  useEffect(() => {
    const draft = takeDraft();
    if (!draft) return;
    setStep(draft.step);
    setRegion(draft.region);
    setGroupType(draft.groupType);
    setStyles(draft.styles);
    setStartTime(draft.startTime);
    setEndTime(draft.endTime);
    setStops(draft.stops);
  }, []);

  // Cancel an in-flight request if the user leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [apiRegions, setApiRegions] = useState<Array<{ id: string; name: string; icon: string }>>([]);

  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => setLocationLoading(false),
        { timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    api.regions.list().then(regions => {
      setApiRegions(regions.map(r => ({ id: r.slug || String(r.id), name: r.name, icon: REGION_ICONS[r.name] || '📍' })));
    }).catch(() => {
      // Fallback if regions fail to load
      setApiRegions([
        { id: 'golan', name: 'גולן', icon: '⛰️' }, { id: 'galil_u', name: 'גליל עליון', icon: '⛰️' },
        { id: 'galil_t', name: 'גליל תחתון', icon: '💧' }, { id: 'carmel', name: 'כרמל', icon: '🌲' },
        { id: 'mercaz', name: 'מרכז', icon: '📍' }, { id: 'jeru', name: 'ירושלים', icon: '🕐' },
        { id: 'darom', name: 'דרום', icon: '⛰️' }, { id: 'eilat', name: 'אילת', icon: '💧' },
      ]);
    });
  }, []);

  const REGIONS = apiRegions;

  const toggleStyle = (id: string) => {
    setStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const goToLogin = () => {
    // Keep the user's choices so they land back on the last step after login.
    saveDraft({ step, region, groupType, styles, startTime, endTime, stops });
    navigate('/Login', { state: { from: location } });
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  const handleGenerate = async () => {
    if (needsLogin) {
      goToLogin();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('planning');
    setGenError(null);
    try {
      const selectedRegionName = REGIONS.find(r => r.id === region)?.name || region;
      const route = await api.ai.generateRoute({
        region: selectedRegionName,
        groupType: groupType as AiGroupType,
        styles,
        startTime,
        endTime,
        maxStops: Number.parseInt(stops, 10) || undefined,
        userLocation,
      }, controller.signal);

      if (controller.signal.aborted) return;
      setPhase('saving');
      // Stops carry location_id, so the saved route links to real DB locations.
      const saved = await api.trips.create({
        name: route.name,
        description: route.description,
        region: route.region,
        region_id: route.region_id,
        group_type: GROUP_TYPES.find(g => g.id === route.group_type)?.name ?? route.group_type,
        style: route.style,
        total_duration_hours: route.total_duration_hours,
        total_distance_km: route.total_distance_km,
        stops: route.stops.map(s => ({
          location_id: s.location_id,
          poi_name: s.poi_name,
          arrival_time: s.arrival_time,
          duration_minutes: s.duration_minutes,
          smart_insight: s.smart_insight,
          order_index: s.order_index,
        })),
      });

      if (route.source === 'fallback') {
        toast.info('ה-AI לא היה זמין כרגע, אז בנינו מסלול מהמקומות הקרובים והמומלצים באזור');
      }
      navigate(`/TripDetail?id=${saved.id}`);
    } catch (e) {
      if (isAbortError(e)) return;
      console.error('Trip generation failed:', e);
      setGenError(describeRouteError(e));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPhase(null);
    }
  };

  const canNext = [
    !!region,
    !!groupType,
    styles.length > 0,
    true,
  ][step];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Header (Full Width) ── */}
      <div style={{
        background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)',
        width: '100%',
      }}>
        {/* Header Content (Centered) */}
        <div style={{
          maxWidth: 600, margin: '0 auto', position: 'relative',
          paddingTop: 48, paddingBottom: 64, paddingLeft: 20, paddingRight: 20, textAlign: 'center'
        }}>
          {/* Back button */}
          <button onClick={() => navigate(-1)} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.2)', border: 'none',
            borderRadius: 12, padding: '8px 12px', cursor: 'pointer', color: '#fff',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '5px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600, color: '#fff',
          }}>
            ✨ מתכנן מסלול חכם
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 6 }}>בוא ניצור לך מסלול</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            ענה על כמה שאלות ונבנה לך יום מושלם
          </p>
        </div>
      </div>

      {/* ── Main Content Container (Centered) ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', padding: '0 16px', position: 'relative', zIndex: 10, marginTop: -32, paddingBottom: 60 }}>

        {/* Stepper */}
        <div style={{
          background: '#fff', borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)', padding: '20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            const stepBg = done || active ? '#0d9e6e' : '#f1f5f9';
            const stepBorder = done || active ? '2px solid #0d9e6e' : '2px solid #e2e8f0';
            return (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: stepBg,
                    color: done || active ? '#fff' : '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, border: stepBorder,
                  }}>
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (i + 1)}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#0d9e6e' : '#94a3b8' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 3, background: i < step ? '#0d9e6e' : '#e2e8f0', marginBottom: 16, borderRadius: 3, margin: '0 4px' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <div style={{
          background: '#fff', borderRadius: 24,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          padding: '32px 20px',
          marginBottom: 24,
        }}>
          {/* STEP 0: Region */}
          {step === 0 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>לאן נוסעים?</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>בחר את האזור לטיול</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                {REGIONS.map(r => (
                  <button key={r.id} onClick={() => setRegion(r.id)} style={{
                    border: `2px solid ${region === r.id ? '#0d9e6e' : '#f1f5f9'}`,
                    borderRadius: 16, padding: '20px 12px', background: region === r.id ? '#f0fdf8' : '#fff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 12, transition: 'all 0.2s ease',
                    boxShadow: region === r.id ? '0 4px 12px rgba(13, 158, 110, 0.15)' : 'none'
                  }}>
                    <span style={{ fontSize: 32 }}>{r.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: region === r.id ? '#0d9e6e' : '#334155' }}>{r.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 1: Group type */}
          {step === 1 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>עם מי הטיול?</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>זה יעזור לנו להתאים את המסלול</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                {GROUP_TYPES.map(g => (
                  <button key={g.id} onClick={() => setGroupType(g.id)} style={{
                    border: `2px solid ${groupType === g.id ? '#0d9e6e' : '#f1f5f9'}`,
                    borderRadius: 16, padding: '28px 12px', background: groupType === g.id ? '#f0fdf8' : '#fff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 12, transition: 'all 0.2s ease',
                    boxShadow: groupType === g.id ? '0 4px 12px rgba(13, 158, 110, 0.15)' : 'none'
                  }}>
                    <span style={{ fontSize: 40 }}>{g.emoji}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: groupType === g.id ? '#0d9e6e' : '#334155' }}>{g.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 2: Styles */}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>מה מעניין אותך?</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>אפשר לבחור כמה אפשרויות</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                {STYLES.map(st => {
                  const active = styles.includes(st.id);
                  return (
                    <button key={st.id} onClick={() => toggleStyle(st.id)} style={{
                      border: `2px solid ${active ? '#0d9e6e' : '#f1f5f9'}`,
                      borderRadius: 16, padding: '24px 12px', background: active ? '#f0fdf8' : '#fff',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 12, transition: 'all 0.2s ease',
                      boxShadow: active ? '0 4px 12px rgba(13, 158, 110, 0.15)' : 'none'
                    }}>
                      <span style={{ fontSize: 32 }}>{st.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: active ? '#0d9e6e' : '#334155', textAlign: 'center' }}>{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 3: Details */}
          {step === 3 && (
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>פרטים אחרונים</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>כמעט סיימנו!</p>

              <label htmlFor="tp-date" style={{ fontSize: 14, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 8, textAlign: 'right' }}>
                תאריך הטיול (אופציונלי)
              </label>
              <input id="tp-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={{
                width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', boxSizing: 'border-box',
                borderRadius: 14, fontSize: 15, marginBottom: 24, fontFamily: 'Heebo, sans-serif',
                textAlign: 'right', outline: 'none', background: '#f8fafc', color: '#334155'
              }} />

              <div style={{ fontSize: 14, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 10, textAlign: 'right' }}>
                שעות הטיול
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>סיום</div>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{
                    width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                    borderRadius: 12, fontSize: 16, fontFamily: 'Heebo, sans-serif',
                    textAlign: 'center', outline: 'none', background: '#f8fafc', color: '#334155',
                    cursor: 'pointer',
                  }} />
                </div>
                <div style={{ color: '#94a3b8', fontWeight: 800, paddingTop: 20 }}>—</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>התחלה</div>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{
                    width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                    borderRadius: 12, fontSize: 16, fontFamily: 'Heebo, sans-serif',
                    textAlign: 'center', outline: 'none', background: '#f8fafc', color: '#334155',
                    cursor: 'pointer',
                  }} />
                </div>
              </div>

              {/* Location status */}
              {(() => {
                let locationStatusText: string;
                if (locationLoading) {
                  locationStatusText = 'מאתר מיקום...';
                } else if (userLocation) {
                  locationStatusText = 'מיקום זוהה — יחושב זמן נסיעה';
                } else {
                  locationStatusText = 'לא זוהה מיקום';
                }
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
                    marginBottom: 24, padding: '10px 14px', borderRadius: 12,
                    background: userLocation ? '#f0fdf8' : '#f8fafc',
                    border: `1.5px solid ${userLocation ? '#6ee7b7' : '#e2e8f0'}`,
                  }}>
                    <span style={{ fontSize: 13, color: userLocation ? '#0d9e6e' : '#94a3b8', fontWeight: 700 }}>
                      {locationStatusText}
                    </span>
                    <span style={{ fontSize: 18 }}>{userLocation ? '📍' : '🔍'}</span>
                  </div>
                );
              })()}

              <div style={{ fontSize: 14, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 10, textAlign: 'right' }}>
                מספר עצירות מקסימלי
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 32, justifyContent: 'flex-end', flexDirection: 'row-reverse' }}>
                {STOP_COUNTS.map(c => (
                  <button key={c} onClick={() => setStops(c)} style={{
                    flex: 1, padding: '12px 8px',
                    border: `2px solid ${stops === c ? '#0d9e6e' : '#e2e8f0'}`,
                    borderRadius: 12, background: stops === c ? '#f0fdf8' : '#fff',
                    color: stops === c ? '#0d9e6e' : '#64748b',
                    fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    transition: 'all 0.2s ease'
                  }}>
                    עצירות {c}
                  </button>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, padding: '18px', border: '2px solid #cbd5e1',
              borderRadius: 16, background: '#fff', fontSize: 16, fontWeight: 800,
              cursor: 'pointer', color: '#475569', fontFamily: 'Heebo, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s ease'
            }}>
              חזרה
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              style={{
                flex: 2, padding: '18px', border: 'none',
                borderRadius: 16,
                background: canNext ? '#6ee7b7' : '#e2e8f0',
                color: canNext ? '#064e3b' : '#94a3b8',
                fontSize: 16, fontWeight: 800, cursor: canNext ? 'pointer' : 'not-allowed',
                fontFamily: 'Heebo, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              המשך
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <button
              onClick={needsLogin ? goToLogin : handleGenerate}
              disabled={phase !== null || authLoading}
              style={{
                flex: 2, padding: '18px', border: 'none',
                borderRadius: 16,
                background: needsLogin ? '#0d9e6e' : '#6ee7b7',
                color: needsLogin ? '#fff' : '#064e3b', fontSize: 16, fontWeight: 800,
                cursor: phase !== null ? 'wait' : 'pointer',
                fontFamily: 'Heebo, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              {needsLogin ? '🔑 התחבר כדי לתכנן מסלול' : '✨ צור מסלול'}
            </button>
          )}
        </div>

        {needsLogin && step === 3 && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#64748b', textAlign: 'center', direction: 'rtl' }}>
            הבחירות שלך יישמרו ותחזור לכאן אחרי ההתחברות
          </p>
        )}

        {genError && (
          <div role="alert" style={{ margin: '12px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600, textAlign: 'center', direction: 'rtl' }}>
            ⚠️ {genError.message}
            {(genError.canRetry || genError.kind === 'auth') && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={genError.kind === 'auth' ? goToLogin : handleGenerate}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
                >
                  {genError.kind === 'auth' ? 'התחברות' : 'נסו שוב'}
                </button>
              </div>
            )}
          </div>
        )}

        {phase && <RouteGeneratingOverlay phase={phase} onCancel={cancelGenerate} />}

      </div>
    </div>
  );
}