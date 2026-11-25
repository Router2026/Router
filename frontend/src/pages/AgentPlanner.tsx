/**
 * AgentPlanner — free-text request → a full day plan by the six trip agents (admin preview).
 * Streams progress from POST /api/ai/trip-agents, then shows the plan and hands the stops to
 * RouteGenerator (same state shape the Trip Bucket uses) for the map and saving.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { streamTripAgents, ApiError, type AgentEvent, type AgentPlan, type AgentPlanStop, type AgentStep, type POI } from '../api';

const STEPS: { key: AgentStep; label: string }[] = [
  { key: 'intent', label: 'מבין את הבקשה' },
  { key: 'search', label: 'מחפש מקומות במאגר' },
  { key: 'conditions', label: 'בודק מזג אוויר ובטיחות' },
  { key: 'planner', label: 'מתכנן סדר ושעות' },
  { key: 'review', label: 'בודק את התוכנית מול הבקשה' },
  { key: 'summary', label: 'כותב הסבר וטיפים' },
];

const EXAMPLES = [
  'בא לי מסלול מים בצפון',
  'טיול קל עם עגלה ליד ירושלים בשבת, 3 עצירות',
  'מסלול מאתגר במדבר ליד מצפה רמון מחר ב-6 בבוקר',
  'יום בגליל המערבי עם תצפית לשקיעה',
];

const SLOT_LABEL: Record<AgentPlanStop['slot'], string> = { morning: 'בוקר', midday: 'צהריים', afternoon: 'אחר הצהריים', sunset: 'שקיעה' };

const CONDITION_LABEL: Record<string, string> = {
  flash_flood_risk: 'סכנת שיטפונות', heavy_rain_streams: 'גשם כבד', rain: 'צפוי גשם',
  extreme_heat_hard_hike: 'חום כבד', extreme_heat_exposed: 'חום כבד בלי צל', heat: 'יום חם',
  strong_wind: 'רוח חזקה', no_forecast: 'אין עדיין תחזית',
};

const DROP_LABEL: Record<string, string> = {
  no_daylight: 'לא נשאר אור יום', day_full: 'לא נכנס עד החשכה', too_many_stops: 'יותר מדי עצירות',
  second_hard_hike: 'מסלול מאתגר שני', hiking_limit: 'יותר מדי שעות הליכה',
};

type StepState = 'pending' | 'running' | 'done';

const C = { ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', accent: '#0d9e6e', accentSoft: '#f0fdf8', warn: '#b45309', warnSoft: '#fffbeb', danger: '#b91c1c' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 18, boxShadow: '0 4px 20px rgba(15,23,42,0.06)', padding: '18px 18px', direction: 'rtl' };

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Minimal POI objects for RouteGenerator (it reads id, name, coordinates, category, image). */
function stopsToPois(stops: AgentPlanStop[]): POI[] {
  return stops.map((s) => ({
    id: String(s.id), name: s.name, description: '', category: s.category, region: s.region ?? '',
    latitude: s.lat, longitude: s.lng, images: s.image ? [s.image] : [], main_image: s.image ?? '', thumbnail: s.image ?? '',
    difficulty: s.difficulty ?? 'בינוני', has_water: s.hasWater, has_shade: s.hasShade, accessible: s.accessible,
    average_rating: 0, duration_minutes: s.visitMinutes,
  }));
}

export default function AgentPlanner() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const isAdmin = !!(user as Record<string, unknown> | null)?.is_admin;

  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<AgentStep, StepState>>(() => Object.fromEntries(STEPS.map((s) => [s.key, 'pending'])) as Record<AgentStep, StepState>);
  const [elapsed, setElapsed] = useState(0);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate('/');
  }, [isLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    const q = query.trim();
    if (q.length < 3 || running) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true); setElapsed(0); setPlan(null); setDebug(null); setError(null);
    setSteps(Object.fromEntries(STEPS.map((s) => [s.key, 'pending'])) as Record<AgentStep, StepState>);
    try {
      const last = await streamTripAgents(q, (ev: AgentEvent) => {
        if (ev.type === 'step') setSteps((prev) => ({ ...prev, [ev.step]: ev.phase === 'start' ? 'running' : 'done' }));
      }, ac.signal);
      if (last.type === 'result') { setPlan(last.data.plan); setDebug(last.data.debug); }
      else if (last.type === 'error') setError(last.message);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (e instanceof ApiError && e.status === 429) setError(`יותר מדי בקשות. נסו שוב בעוד ${e.retryAfterSec ?? 60} שניות.`);
      else if (e instanceof ApiError && e.status === 403) setError('הדף זמין למנהלים בלבד.');
      else setError('לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב.');
    } finally {
      setRunning(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
    setError('הבקשה בוטלה.');
  }

  function openOnMap() {
    if (!plan) return;
    navigate('/RouteGenerator', { state: { bucketPois: stopsToPois(plan.stops), alreadyOrdered: true } });
  }

  if (isLoading || !isAdmin) return null;

  const showProgress = running || (!plan && !error && Object.values(steps).some((s) => s !== 'pending'));

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f4', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(135deg, #0d9e6e, #0b7a57)', padding: '28px 16px 44px', direction: 'rtl' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 10, padding: '6px 12px', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>חזרה</button>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0 }}>תכנון יום עם סוכנים</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: '6px 0 0' }}>
            כתבו מה בא לכם, והסוכנים יחפשו מקומות, יבדקו את התחזית, יתכננו סדר ושעות ויסבירו את הבחירה.
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '1px 8px', fontSize: 11, marginInlineStart: 8 }}>תצוגה למנהלים</span>
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '-24px auto 0', padding: '0 16px', display: 'grid', gap: 14 }}>
        <div style={card}>
          <label htmlFor="agentQuery" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>מה מתכננים?</label>
          <textarea
            id="agentQuery" value={query} onChange={(e) => setQuery(e.target.value.slice(0, 500))} rows={3} disabled={running}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void run(); }}
            placeholder="לדוגמה: טיול קל עם ילדים בגליל עם מים, מחר מ-9 בבוקר"
            style={{ width: '100%', marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" disabled={running} onClick={() => setQuery(ex)}
                style={{ background: C.accentSoft, color: C.accent, border: '1px solid #d1fae5', borderRadius: 999, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>{ex}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => void run()} disabled={running || query.trim().length < 3}
              style={{ flex: 1, background: running || query.trim().length < 3 ? '#94a3b8' : C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 800, cursor: running ? 'default' : 'pointer' }}>
              {running ? `בונה יום טיול… ${elapsed} שנ׳` : 'בנה יום טיול'}
            </button>
            {running && (
              <button type="button" onClick={cancel} style={{ background: '#fff', color: C.danger, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, cursor: 'pointer' }}>ביטול</button>
            )}
          </div>
        </div>

        {showProgress && (
          <div style={card} aria-live="polite">
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>מה הסוכנים עושים עכשיו</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {STEPS.map((s, i) => {
                const st = steps[s.key];
                const color = st === 'done' ? C.accent : st === 'running' ? C.ink : '#94a3b8';
                return (
                  <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, color, fontSize: 14, fontWeight: st === 'running' ? 700 : 500 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                      background: st === 'done' ? C.accent : st === 'running' ? C.accentSoft : '#f1f5f9', color: st === 'done' ? '#fff' : color, border: st === 'running' ? `2px solid ${C.accent}` : 'none' }}>
                      {st === 'done' ? '✓' : i + 1}
                    </span>
                    {s.label}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {error && (
          <div role="alert" style={{ ...card, background: '#fef2f2', color: C.danger, fontSize: 14 }}>{error}</div>
        )}

        {plan && (
          <>
            <div style={card}>
              <div style={{ fontSize: 12, color: C.muted }}>{formatDate(plan.date)} · {plan.startTime}–{plan.endTime} · שקיעה {plan.sunset}</div>
              <h2 style={{ fontSize: 21, fontWeight: 900, color: C.ink, margin: '6px 0 8px' }}>{plan.title}</h2>
              <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.7, margin: 0 }}>{plan.overview}</p>
              {plan.why && <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: '8px 0 0' }}>{plan.why}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, fontSize: 13, color: C.muted }}>
                <span>{plan.stops.length} עצירות</span>
                <span>{plan.totalDriveMinutes} דק׳ נסיעה</span>
                <span>{plan.totalDistanceKm} ק״מ</span>
              </div>
            </div>

            {(plan.conditionsNote || !plan.forecastAvailable || plan.rejected.length > 0 || plan.dropped.length > 0) && (
              <div style={{ ...card, background: C.warnSoft, color: C.warn, fontSize: 14, display: 'grid', gap: 6 }}>
                {plan.conditionsNote && <div>{plan.conditionsNote}</div>}
                {!plan.forecastAvailable && <div>אין עדיין תחזית לתאריך הזה. כדאי לבדוק שוב קרוב ליום הטיול.</div>}
                {plan.rejected.map((r) => (
                  <div key={`r${r.id}`}>{r.name} לא נכלל: {r.codes.map((c) => CONDITION_LABEL[c] ?? c).join(', ')}</div>
                ))}
                {plan.dropped.map((d) => (
                  <div key={`d${d.id}`}>{d.name} לא נכנס ליום: {DROP_LABEL[d.reason] ?? d.reason}</div>
                ))}
              </div>
            )}

            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {plan.stops.map((s, i) => (
                <li key={s.id} style={{ ...card, display: 'grid', gap: 6 }}>
                  {i > 0 && s.driveMinutesFromPrev > 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>🚗 {s.driveMinutesFromPrev} דק׳ נסיעה ({s.distanceFromPrevKm} ק״מ){s.waitMinutes > 0 ? ` · המתנה ${s.waitMinutes} דק׳ לשקיעה` : ''}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: C.accent, fontSize: 15, minWidth: 92 }}>{s.arrival}–{s.departure}</span>
                    <button type="button" onClick={() => navigate(`/POIDetail?id=${s.id}`)}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 16, fontWeight: 800, color: C.ink, cursor: 'pointer', textAlign: 'right' }}>{s.name}</button>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span>{s.category}</span>
                    {s.region && <span>· {s.region}</span>}
                    <span>· {SLOT_LABEL[s.slot]}</span>
                    {s.difficulty === 'מאתגר' && <span>· מאתגר</span>}
                    {s.hasWater && <span>· מים</span>}
                    {s.hasShade && <span>· צל</span>}
                    {s.accessible && <span>· נגיש</span>}
                  </div>
                  {s.tip && <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{s.tip}</div>}
                  {s.conditions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {s.conditions.map((c) => (
                        <span key={c} style={{ background: C.warnSoft, color: C.warn, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{CONDITION_LABEL[c] ?? c}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <div style={{ ...card, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{plan.safetyFooter}</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={openOnMap}
                style={{ flex: 1, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>פתח במפה ושמור</button>
              <button type="button" onClick={() => { setPlan(null); setDebug(null); setQuery(''); }}
                style={{ background: '#fff', color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, cursor: 'pointer' }}>תכנון חדש</button>
            </div>

            {debug && (
              <details style={{ ...card, fontSize: 12, color: C.muted }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>פרטים טכניים (מנהלים)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', margin: '10px 0 0', fontSize: 11, overflowX: 'auto' }}>{JSON.stringify(debug, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
