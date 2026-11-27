// "Plan together" on the trip page: invite friends with a WhatsApp link, see who joined,
// suggest places and vote. The owner adds a suggestion to the route or dismisses it.
// Hidden when the panel can't load (offline, or the viewer isn't a member).

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type CollabState, type POI } from '../api';

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', accent: '#0d9e6e', soft: '#f0fdf8', deep: '#065f46', purple: '#7c3aed', line: '#e2e8f0' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'right', direction: 'rtl' };
const small: React.CSSProperties = { minHeight: 36, padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${C.line}`, background: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', color: '#334155' };

function inviteUrl(token: string) {
  return `${globalThis.location.origin}/invite/${token}`;
}

function whatsappUrl(tripName: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`בואו נתכנן ביחד את "${tripName}" בראוטר – תציעו מקומות ותצביעו 👇\n${url}`)}`;
}

const SUGGEST_ERRORS: Record<string, string> = {
  ALREADY_IN_ROUTE: 'המקום כבר במסלול',
  ALREADY_SUGGESTED: 'מישהו כבר הציע את המקום הזה',
  NOT_FOUND: 'המקום לא נמצא',
};

export default function TripCollabPanel({
  tripId, tripName, currentUserId, onRouteChanged, onLeft,
}: Readonly<{
  tripId: string; tripName: string; currentUserId: number | null;
  /** A suggestion was added to the route — reload the stops. */
  onRouteChanged: () => void;
  /** The current user left the trip. */
  onLeft: () => void;
}>) {
  const [state, setState] = useState<CollabState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<POI[]>([]);
  const searchSeq = useRef(0);

  const load = useCallback(() => {
    api.collab.get(tripId).then(setState).catch(() => setState(null));
  }, [tripId]);
  useEffect(load, [load]);

  // Debounced place search for suggestions.
  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      if (q.length < 2) { if (seq === searchSeq.current) setResults([]); return; }
      api.locations.list({ search: q, limit: 6 })
        .then(r => { if (seq === searchSeq.current) setResults(r); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!state) return null;

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    try { await fn(); after?.(); load(); } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error((code && SUGGEST_ERRORS[code]) || 'הפעולה נכשלה. נסו שוב.');
    } finally { setBusy(null); }
  };

  const createLink = () => run('invite', async () => setToken(await api.collab.createInvite(tripId)));
  const url = token ? inviteUrl(token) : null;
  const copy = () => { if (url) navigator.clipboard.writeText(url).then(() => toast.success('הקישור הועתק')).catch(() => {}); };

  const existingSuggestion = new Set(state.suggestions.map(s => s.location_id));

  return (
    <section style={card} aria-labelledby="collab-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 id="collab-title" style={{ fontSize: 18, fontWeight: 900, color: C.ink, margin: 0 }}>👥 מתכננים ביחד</h2>
        <div style={{ display: 'flex' }} aria-label={`${state.members.length} משתתפים`}>
          {state.members.slice(0, 5).map((m, i) => (
            <span key={m.id} title={m.is_owner ? `${m.name} (מארגן/ת)` : m.name}
              style={{ width: 30, height: 30, borderRadius: '50%', marginInlineStart: i ? -8 : 0, border: '2px solid #fff', background: m.avatar_url ? `center/cover url(${JSON.stringify(m.avatar_url)})` : (m.is_owner ? C.accent : C.purple), color: '#fff', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.avatar_url ? '' : m.name.slice(0, 1)}
            </span>
          ))}
        </div>
      </div>

      {/* Invite — owner only */}
      {state.is_owner && (
        <div style={{ background: C.soft, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          {url ? (
            <>
              <div style={{ fontSize: 13, color: C.deep, fontWeight: 700, marginBottom: 8 }}>שלחו את הקישור לחברים. מי שנכנס יכול להציע מקומות ולהצביע.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={whatsappUrl(tripName, url)} target="_blank" rel="noopener noreferrer"
                  style={{ ...small, background: '#25d366', borderColor: '#25d366', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  שליחה בוואטסאפ
                </a>
                <button type="button" onClick={copy} style={small}>העתקת קישור</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontSize: 13, color: C.deep, fontWeight: 700, minWidth: 160 }}>
                {state.has_invite ? 'יש קישור הזמנה פעיל. קישור חדש יבטל את הקודם.' : 'הזמינו חברים לתכנן איתכם את הטיול.'}
              </span>
              <button type="button" onClick={createLink} disabled={busy === 'invite'} style={{ ...small, background: C.accent, borderColor: C.accent, color: '#fff' }}>
                {busy === 'invite' ? '…' : state.has_invite ? 'קישור חדש' : 'יצירת קישור הזמנה'}
              </button>
            </div>
          )}
          {state.has_invite && (
            <button type="button" onClick={() => run('revoke', () => api.collab.revokeInvite(tripId), () => setToken(null))}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, marginTop: 8, cursor: 'pointer', padding: 0, fontFamily: 'Heebo, sans-serif' }}>
              ביטול הקישור (מי שכבר הצטרף נשאר)
            </button>
          )}
        </div>
      )}

      {/* Suggest a place */}
      <label htmlFor="collab-search" style={{ fontSize: 13, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>הצעת מקום לטיול</label>
      <input id="collab-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="חפשו מקום, למשל: עין גדי"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, borderRadius: 12, border: `1.5px solid ${C.line}`, padding: '0 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif', direction: 'rtl' }} />
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
          {results.map(p => {
            const id = Number(p.id);
            const taken = existingSuggestion.has(id);
            return (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.ink }}>{p.name}<span style={{ color: C.faint, fontWeight: 500, fontSize: 12 }}> · {p.region}</span></span>
                <button type="button" disabled={taken || busy === `s${id}`}
                  onClick={() => run(`s${id}`, () => api.collab.suggest(tripId, id), () => { setQuery(''); setResults([]); toast.success('ההצעה נוספה'); })}
                  style={{ ...small, color: C.accent, borderColor: C.accent }}>
                  {taken ? 'הוצע' : 'הצעה'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Open suggestions */}
      <div style={{ marginTop: 14 }}>
        {state.suggestions.length === 0 ? (
          <div style={{ fontSize: 13, color: C.faint }}>עוד אין הצעות. חפשו מקום והציעו אותו לכולם.</div>
        ) : state.suggestions.map(s => (
          <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
            {s.main_image
              ? <img src={s.main_image} alt="" loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              : <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, background: C.soft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📍</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.muted }}>הציע/ה: {s.suggested_by_name}{s.note ? ` · ${s.note}` : ''}</div>
            </div>
            <button type="button" aria-pressed={s.my_vote} disabled={busy === `v${s.id}`}
              onClick={() => run(`v${s.id}`, () => api.collab.act(tripId, s.id, 'vote'))}
              title={s.my_vote ? 'ביטול ההצבעה' : 'הצבעה בעד'}
              style={{ ...small, minWidth: 54, ...(s.my_vote ? { background: C.soft, borderColor: C.accent, color: C.accent } : {}) }}>
              👍 {s.votes}
            </button>
            {state.is_owner && (
              <>
                <button type="button" disabled={busy === `a${s.id}`} title="הוספה כעצירה אחרונה במסלול"
                  onClick={() => run(`a${s.id}`, () => api.collab.act(tripId, s.id, 'accept'), () => { onRouteChanged(); toast.success(`${s.name} נוסף למסלול`); })}
                  style={{ ...small, background: C.accent, borderColor: C.accent, color: '#fff' }}>הוספה</button>
                <button type="button" aria-label={`דחיית ${s.name}`} disabled={busy === `d${s.id}`}
                  onClick={() => run(`d${s.id}`, () => api.collab.act(tripId, s.id, 'dismiss'))}
                  style={{ ...small, padding: '6px 10px' }}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>

      {!state.is_owner && currentUserId != null && (
        <button type="button" onClick={() => run('leave', () => api.collab.removeMember(tripId, currentUserId), onLeft)}
          style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, marginTop: 10, cursor: 'pointer', padding: 0, fontFamily: 'Heebo, sans-serif' }}>
          יציאה מהטיול המשותף
        </button>
      )}
    </section>
  );
}
