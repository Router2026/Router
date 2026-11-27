// src/pages/TripRecap.tsx — "how was it?" after a trip.
// For each stop the user visited: stars + an optional line (→ a review, +XP on the server),
// a photo, and for water places "was there water?" (→ a 'מצב מים' report, which keeps the
// water data fresh for the planner). Finishing records the completion (one-time XP).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, type Trip, type XpResult } from '../api';
import UploadPhotoButton from '../components/UploadPhotoButton';
import XpToast from '../components/XpToast';
import { getSavedTrip } from '../utils/offlineTrips';
import { WATER_CATEGORIES, clearPendingRecap, getPendingRecap, loadProgress, toLiveStops } from '../utils/liveTrip';

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', accent: '#0d9e6e', soft: '#f0fdf8', deep: '#065f46', star: '#f59e0b', line: '#e2e8f0' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'right' };
const pill = (on: boolean): React.CSSProperties => ({
  minHeight: 36, padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  border: `1.5px solid ${on ? C.accent : C.line}`, background: on ? C.soft : '#fff', color: on ? C.accent : '#334155',
});

type Water = 'yes' | 'no' | null;
const EMPTY = { rating: 0, text: '', water: null as Water };
interface Answer { rating: number; text: string; water: Water }

export default function TripRecap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tripId = params.get('id') || '';
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(Boolean(tripId));
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [xp, setXp] = useState<XpResult | null>(null);

  useEffect(() => {
    if (!tripId) return;
    api.trips.get(tripId)
      .then(setTrip)
      .catch(() => setTrip(getSavedTrip(tripId)?.trip ?? null))
      .finally(() => setLoading(false));
  }, [tripId]);

  // The stops the user actually visited: from the pending recap, else today's live progress,
  // else (recap opened some other way) every stop.
  const visited = useMemo(() => {
    if (!trip) return [];
    const stops = toLiveStops(trip.stops || []).map((s, i) => ({ ...s, stop: trip.stops[i] }));
    const doneKeys = getPendingRecap(tripId)?.done ?? loadProgress(tripId).done;
    const picked = stops.filter(s => doneKeys.includes(s.key));
    return picked.length ? picked : stops;
  }, [trip, tripId]);

  const set = (key: string, patch: Partial<Answer>) =>
    setAnswers(a => ({ ...a, [key]: { ...(a[key] ?? EMPTY), ...patch } }));

  const submit = async () => {
    if (!trip) return;
    setSending(true);
    // Each job clears its part of the answer once sent, so a retry after a failure resends
    // only what failed (no duplicate reviews).
    const jobs: { key: string; part: 'rating' | 'water'; run: Promise<unknown> }[] = [];
    for (const { key, stop } of visited) {
      const a = answers[key];
      if (!a) continue;
      const location_id = stop.location_id ?? undefined;
      if (a.rating > 0) {
        jobs.push({ key, part: 'rating', run: api.reviews.create({
          location_id, poi_name: stop.poi_name, rating: a.rating,
          content: a.text.trim() || `ביקרתי כאן בטיול "${trip.name}"`,
        }) });
      }
      if (a.water) {
        jobs.push({ key, part: 'water', run: api.reports.create({
          location_id, poi_name: stop.poi_name, report_type: 'מצב מים', severity: 'נמוכה',
          content: a.water === 'yes' ? 'היו מים בביקור' : 'יבש – לא היו מים בביקור',
        }) });
      }
    }
    const results = await Promise.allSettled(jobs.map(j => j.run));
    const failed = results.filter(r => r.status === 'rejected').length;
    setAnswers(prev => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const { key, part } = jobs[i];
        next[key] = part === 'rating' ? { ...next[key], rating: 0, text: '' } : { ...next[key], water: null };
      });
      return next;
    });

    try {
      const res = await api.trips.complete(trip.id, Math.max(1, visited.length));
      if (res.xp_awarded && res.xp) setXp(res.xp);
    } catch { /* completion XP is a bonus; the reviews above are what matter */ }

    if (failed) toast.error(`${failed} מתוך ${jobs.length} לא נשלחו. אפשר לנסות שוב.`);
    else {
      clearPendingRecap(trip.id);
      setDone(true);
    }
    setSending(false);
  };

  const skip = () => { clearPendingRecap(tripId); navigate('/MyTrips'); };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>טוען...</div>;
  if (!trip) return <div style={{ padding: 40, textAlign: 'center', color: C.faint }}>המסלול לא נמצא</div>;

  const answered = Object.values(answers).some(a => a.rating > 0 || a.water);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>
      {xp && <XpToast xp={xp} onDone={() => setXp(null)} />}
      <div style={{ background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px 24px', textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 }}>אחרי הטיול</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '2px 0 4px' }}>איך היה ב{trip.name}?</h1>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>הדירוגים והעדכונים שלכם עוזרים למטיילים הבאים – ומזכים ב-XP.</div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 100px' }}>
        {done ? (
          <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 44 }}>🙏</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, margin: '8px 0 16px' }}>תודה! העדכונים נשלחו.</div>
            <button type="button" onClick={() => navigate('/MyTrips')} style={{ ...pill(true), width: '100%', minHeight: 48, fontSize: 15 }}>למסלולים שלי</button>
          </div>
        ) : (
          <>
            {visited.map(({ key, stop }) => {
              const a = answers[key] ?? EMPTY;
              const watery = WATER_CATEGORIES.includes(stop.category ?? '');
              return (
                <div key={key} style={card}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    {stop.main_image && <img src={stop.main_image} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />}
                    <div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>{stop.poi_name}</div>
                  </div>

                  <div role="radiogroup" aria-label={`דירוג ל${stop.poi_name}`} style={{ display: 'flex', gap: 4, marginBottom: 8, direction: 'ltr', justifyContent: 'flex-end' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" role="radio" aria-checked={a.rating === n} aria-label={`${n} כוכבים`}
                        onClick={() => set(key, { rating: a.rating === n ? 0 : n })}
                        style={{ background: 'none', border: 'none', fontSize: 28, lineHeight: 1, cursor: 'pointer', padding: 2, color: n <= a.rating ? C.star : '#cbd5e1' }}>★</button>
                    ))}
                  </div>

                  {a.rating > 0 && (
                    <textarea value={a.text} onChange={e => set(key, { text: e.target.value })} maxLength={500} rows={2}
                      placeholder="משפט אחד למטיילים הבאים (לא חובה)"
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1.5px solid ${C.line}`, padding: '8px 10px', fontSize: 14, fontFamily: 'Heebo, sans-serif', direction: 'rtl', resize: 'vertical', marginBottom: 8 }} />
                  )}

                  {watery && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>💧 היו מים?</span>
                      <button type="button" aria-pressed={a.water === 'yes'} onClick={() => set(key, { water: a.water === 'yes' ? null : 'yes' })} style={pill(a.water === 'yes')}>כן</button>
                      <button type="button" aria-pressed={a.water === 'no'} onClick={() => set(key, { water: a.water === 'no' ? null : 'no' })} style={pill(a.water === 'no')}>יבש</button>
                    </div>
                  )}

                  {stop.location_id != null && <UploadPhotoButton locationId={stop.location_id} />}
                </div>
              );
            })}

            <button type="button" onClick={submit} disabled={sending || !answered}
              style={{ width: '100%', minHeight: 52, border: 'none', borderRadius: 16, background: answered ? C.accent : '#cbd5e1', color: '#fff', fontSize: 16, fontWeight: 800, cursor: answered ? 'pointer' : 'default', fontFamily: 'Heebo, sans-serif' }}>
              {sending ? 'שולח…' : 'שליחה'}
            </button>
            <button type="button" onClick={skip}
              style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
              לא עכשיו – אל תזכירו לי
            </button>
          </>
        )}
      </div>
    </div>
  );
}
