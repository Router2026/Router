/**
 * RouteReview — the last step before saving a route (RouteGenerator): what the day looks like,
 * why it's built this way (for agent-planned routes), and the save / navigate / publish actions.
 */

import { useState } from 'react';
import RouteMap from './RouteMap';
import { googleMapsRouteUrl, type Schedule } from '../utils/routeSchedule';

export const TRIP_TYPES = [['יחיד', '🚶 יחיד'], ['זוג', '👫 זוג'], ['משפחה', '👨‍👩‍👧‍👦 משפחה'], ['חברים', '👥 חברים']] as const;
export const TRIP_STYLES = ['טבע', 'היסטוריה', 'מים', 'נוף', 'מסלולים', 'חופים', 'גיאולוגיה', 'יין ואוכל'] as const;
export const TRIP_DIFFICULTIES = [['קל - משפחות', '#16a34a'], ['בינוני', '#d97706'], ['קשה', '#dc2626'], ['מאתגר', '#7c3aed']] as const;

export interface RouteDetails {
  tripType: string;
  tripStyle: string;
  tripDifficulty: string;
}

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', accent: '#0d9e6e', soft: '#f0fdf8', deep: '#065f46' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', direction: 'rtl' };

function Chip({ active, color = C.accent, onClick, children }: Readonly<{ active: boolean; color?: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${active ? color : C.line}`, background: active ? `${color}15` : '#fff', color: active ? color : C.muted, fontFamily: 'Heebo, sans-serif', fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

export default function RouteReview({
  schedule, start, overview, why, warnings, safetyFooter, distanceKm,
  routeName, onRouteName, details, onDetails, onRemove, onEdit,
  saving, onSave, onPublish,
}: Readonly<{
  schedule: Schedule;
  start: { lat: number; lng: number } | null;
  overview: string | null;
  why: string | null;
  warnings: string[];
  safetyFooter: string | null;
  distanceKm: number;
  routeName: string;
  onRouteName: (v: string) => void;
  details: RouteDetails;
  onDetails: (d: RouteDetails) => void;
  /** Only for hand-built routes: agent-planned times would no longer hold. */
  onRemove?: (poiId: string) => void;
  onEdit?: () => void;
  saving: boolean;
  onSave: () => void;
  onPublish: () => void;
}>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { stops } = schedule;
  const mapsUrl = googleMapsRouteUrl(stops.map(s => ({ lat: s.poi.latitude, lng: s.poi.longitude })), start);

  return (
    <>
      {/* Title + where it came from */}
      <div style={{ ...card, paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', background: schedule.planned ? C.soft : '#f1f5f9', color: schedule.planned ? C.deep : C.muted }}>
            {schedule.planned ? '🤖 תוכנן ע״י הסוכנים' : '✋ מסלול שבנית · זמנים משוערים'}
          </span>
          {onEdit && (
            <button type="button" onClick={onEdit} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
              ערוך עצירות
            </button>
          )}
        </div>
        <label htmlFor="route-name" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>שם המסלול</label>
        <input id="route-name" value={routeName} onChange={e => onRouteName(e.target.value)} placeholder="שם המסלול..."
          style={{ width: '100%', border: 'none', borderBottom: `2px dashed ${C.line}`, outline: 'none', fontSize: 19, fontWeight: 900, color: C.ink, textAlign: 'right', fontFamily: 'Heebo, sans-serif', background: 'transparent', padding: '4px 0', boxSizing: 'border-box' }} />
        {overview && <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, margin: '10px 0 0' }}>{overview}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', marginTop: 14, gap: 4 }}>
          {[
            [String(stops.length), 'עצירות'],
            [`${schedule.startTime}–${schedule.endTime}`, 'שעות'],
            [`${schedule.driveMinutes}`, "דק' נסיעה"],
            [distanceKm.toFixed(1), 'ק"מ'],
          ].map(([v, l]) => (
            <div key={l}>
              <bdi dir="ltr" style={{ display: 'block', fontSize: 16, fontWeight: 900, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{v}</bdi>
              <div style={{ fontSize: 11, color: C.faint }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why */}
      {why && (
        <div style={{ ...card, background: C.soft, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.deep, marginBottom: 4 }}>🧭 למה בניתי את המסלול ככה</div>
          <div style={{ fontSize: 14, color: C.deep, lineHeight: 1.7 }}>{why}</div>
        </div>
      )}

      {warnings.length > 0 && (
        <div role="note" style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#92400e', marginBottom: 6 }}>⚠️ שימו לב</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 4 }}>
            {warnings.map(w => <li key={w} style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Map */}
      <div style={{ marginBottom: 14 }}>
        <RouteMap
          height={300}
          start={start}
          activeId={activeId}
          onSelect={id => setActiveId(String(id))}
          stops={stops.map(s => ({ id: s.poi.id, name: s.poi.name, lat: s.poi.latitude, lng: s.poi.longitude, image: s.poi.main_image, time: s.arrival }))}
        />
      </div>

      {/* Timeline */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, marginBottom: 12 }}>לוח הזמנים</div>
        {start && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: '#2563eb', border: '3px solid #dbeafe' }} />
            נקודת התחלה
          </div>
        )}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {stops.map((s, i) => {
            const active = activeId === s.poi.id;
            return (
              <li key={s.poi.id}>
                {(i > 0 || start) && s.driveMinutesFromPrev > 0 && (
                  <div style={{ fontSize: 12, color: C.faint, padding: '4px 30px 6px 0' }}>🚗 {s.driveMinutesFromPrev} דק' נסיעה</div>
                )}
                <div role="button" tabIndex={0} onClick={() => setActiveId(s.poi.id)} onKeyDown={e => { if (e.key === 'Enter') setActiveId(s.poi.id); }}
                  style={{ display: 'flex', gap: 12, padding: 10, borderRadius: 14, cursor: 'pointer', background: active ? C.soft : 'transparent', outline: active ? `2px solid ${C.accent}` : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{s.poi.name}</span>
                      <bdi dir="ltr" style={{ fontSize: 12, fontWeight: 800, color: C.accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.arrival}–{s.departure}</bdi>
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>
                      {[s.poi.category, s.slotLabel, `${s.durationMinutes} דק'`].filter(Boolean).join(' · ')}
                    </div>
                    {s.reason && <div style={{ marginTop: 6, fontSize: 12.5, color: C.deep, background: C.soft, borderRadius: 10, padding: '5px 9px', lineHeight: 1.5 }}>🧭 {s.reason}</div>}
                    {s.tip && <div style={{ marginTop: 5, fontSize: 12.5, color: '#92400e', background: '#fffbeb', borderRadius: 10, padding: '5px 9px', lineHeight: 1.5 }}>💡 {s.tip}</div>}
                  </div>
                  {onRemove && (
                    <button type="button" aria-label={`הסר את ${s.poi.name}`} onClick={e => { e.stopPropagation(); onRemove(s.poi.id); }}
                      style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: C.faint, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {!schedule.planned && (
          <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>הזמנים משוערים: יציאה ב-09:00 ונסיעה לפי מרחק. אפשר לבנות עם "בנייה חכמה" כדי לקבל תכנון לפי שעות היום ומזג האוויר.</div>
        )}
      </div>

      {/* Optional details */}
      <details style={{ ...card, padding: '12px 16px' }}>
        <summary style={{ fontSize: 14, fontWeight: 800, color: C.ink, cursor: 'pointer' }}>פרטים נוספים (לא חובה)</summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>סוג הטיול</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRIP_TYPES.map(([id, label]) => <Chip key={id} active={details.tripType === id} onClick={() => onDetails({ ...details, tripType: id })}>{label}</Chip>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>סגנון</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRIP_STYLES.map(st => <Chip key={st} active={details.tripStyle === st} onClick={() => onDetails({ ...details, tripStyle: st })}>{st}</Chip>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>רמת קושי</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRIP_DIFFICULTIES.map(([d, color]) => <Chip key={d} color={color} active={details.tripDifficulty === d} onClick={() => onDetails({ ...details, tripDifficulty: d })}>{d}</Chip>)}
            </div>
          </div>
        </div>
      </details>

      {safetyFooter && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: '0 4px 14px', direction: 'rtl' }}>{safetyFooter}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={onSave} disabled={saving || stops.length === 0}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 18, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(13,158,110,0.25)' }}>
          {saving ? 'שומר...' : '💾 שמור מסלול'}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, padding: '13px', border: `2px solid ${C.accent}`, borderRadius: 16, background: '#fff', color: C.accent, fontSize: 14, fontWeight: 800, textAlign: 'center', textDecoration: 'none', fontFamily: 'Heebo, sans-serif' }}>
              🚗 נווט בכל המסלול
            </a>
          )}
          <button type="button" onClick={onPublish} disabled={saving}
            style={{ flex: 1, padding: '13px', border: '2px solid #7c3aed', borderRadius: 16, background: '#faf5ff', color: '#7c3aed', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            🌐 פרסם לכולם
          </button>
        </div>
      </div>
    </>
  );
}
