import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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
  { id: 'family',  name: 'פעילויות לילדים', icon: '🎠' },
];

const STOP_COUNTS = ['3', '5', '7'];
const STEPS = ['אזור', 'הרכב', 'סגנון', 'פרטים'];

const REGION_ICONS: Record<string, string> = {
  'גולן': '⛰️', 'גליל עליון': '⛰️', 'גליל תחתון': '💧', 'כרמל': '🌲',
  'מרכז': '📍', 'ירושלים': '🕐', 'דרום': '⛰️', 'אילת': '💧',
  'עמק יזרעאל': '🌾', 'שרון': '🌸', 'נגב': '🏜️', 'ערבה': '🌵',
};

function buildTripPayload(params: {
  region: string; groupType: string; styles: string[];
  startTime: string; endTime: string; stops: string;
  includeFood: boolean; includeCoffee: boolean; date: string;
  userLocation: { lat: number; lng: number } | null;
}): string {
  const selectedRegionName = params.region;
  const selectedGroupType = params.groupType;
  const selectedStyles = params.styles.join(', ');
  return JSON.stringify({
    region: selectedRegionName,
    group_type: selectedGroupType,
    style: selectedStyles,
    start_time: params.startTime,
    end_time: params.endTime,
    stops_count: Number.parseInt(params.stops),
    include_food: params.includeFood,
    include_coffee: params.includeCoffee,
    date: params.date,
    user_location: params.userLocation,
    starting_point: params.userLocation
      ? { lat: params.userLocation.lat, lng: params.userLocation.lng, label: 'מיקום נוכחי' }
      : null,
    optimize_order: true,
  });
}

export default function TripPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState('');
  const [groupType, setGroupType] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('16:00');
  const [stops, setStops] = useState('5');
  const [date, setDate] = useState('');
  const [includeFood, setIncludeFood] = useState(false);
  const [includeCoffee, setIncludeCoffee] = useState(false);
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
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

  const handleGenerate = async () => {
    setLoading(true);
    setGenError(null);
    try {
      const selectedRegionName = REGIONS.find(r => r.id === region)?.name || region;
      const selectedGroupType = GROUP_TYPES.find(g => g.id === groupType)?.name || groupType;
      const selectedStyles = styles.map(s => STYLES.find(st => st.id === s)?.name || s);

      // Generate trip data (AI simulation via base44 shim)
      const { base44 } = await import('../api');
      const tripData = await base44.integrations.Core.InvokeLLM({
        body: buildTripPayload({
          region: selectedRegionName,
          groupType: selectedGroupType,
          styles: selectedStyles,
          startTime,
          endTime,
          stops,
          includeFood,
          includeCoffee,
          date,
          userLocation,
        }),
      });

      // Save the generated trip to the backend
      const trip = tripData?.data ?? tripData;
      const saved = await api.trips.create({
        ...trip,
        region: selectedRegionName,
        group_type: selectedGroupType,
        style: selectedStyles.join(', '),
      });
      navigate(`/TripDetail?id=${saved.id}`);
    } catch (e) {
      console.error('Trip generation failed:', e);
      setGenError((e as Error)?.message || 'שגיאה בייצור המסלול');
    }
    setLoading(false);
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { state: includeFood, setState: setIncludeFood, label: 'כלול מקומות אכילה בדרך' },
                  { state: includeCoffee, setState: setIncludeCoffee, label: 'כלול עגלות קפה' },
                ].map(item => (
                  <label key={item.label} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', justifyContent: 'flex-end',
                  }}>
                    <span style={{ fontSize: 15, color: '#334155', fontWeight: 700 }}>{item.label}</span>
                    <button type="button"
                      onClick={() => item.setState(!item.state)}
                      style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${item.state ? '#0d9e6e' : '#cbd5e1'}`,
                        background: item.state ? '#0d9e6e' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s ease', padding: 0,
                      }}
                    >
                      {item.state && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  </label>
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
              onClick={handleGenerate}
              disabled={loading}
              style={{
                flex: 2, padding: '18px', border: 'none',
                borderRadius: 16,
                background: '#6ee7b7',
                color: '#064e3b', fontSize: 16, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'Heebo, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'יוצר...' : '✨ צור מסלול'}
            </button>
          )}
        </div>

        {genError && (
          <div style={{ margin: '12px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600, textAlign: 'center', direction: 'rtl' }}>
            ⚠️ {genError}
          </div>
        )}

      </div>
    </div>
  );
}