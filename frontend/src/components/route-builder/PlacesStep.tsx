// Build-it-yourself, step 2: pick places on the map or from the list, then build the route —
// with the trip agents (Smart Build: order and times by time of day and weather) or by distance.

import { useMemo, useState } from 'react';
import type { POI, Region } from '../../api';
import PlacePickerMap from '../PlacePickerMap';

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', accent: '#0d9e6e', soft: '#f0fdf8' };

/** Smart Build accepts up to 15 places (POST /api/trip-bucket/smart-build). */
export const SMART_BUILD_MAX = 15;

type Attr = 'water' | 'shade' | 'accessible';
const ATTRS: { key: Attr; label: string; test: (p: POI) => boolean }[] = [
  { key: 'water', label: '💧 מים', test: p => !!p.has_water },
  { key: 'shade', label: '🌳 צל', test: p => !!p.has_shade },
  { key: 'accessible', label: '♿ נגיש', test: p => !!p.accessible },
];

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${active ? C.accent : C.line}`, background: active ? C.soft : '#fff',
  color: active ? C.accent : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
});

export default function PlacesStep({
  region, places, loading, picked, start, onToggle, onClear, onChangeRegion, onBuildSmart, onBuildDistance,
}: Readonly<{
  region: Region | null;
  places: POI[];
  loading: boolean;
  picked: POI[];
  start: { lat: number; lng: number } | null;
  onToggle: (p: POI) => void;
  onClear: () => void;
  onChangeRegion: () => void;
  onBuildSmart: () => void;
  onBuildDistance: () => void;
}>) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [attrs, setAttrs] = useState<Set<Attr>>(new Set());
  const [focus, setFocus] = useState<POI | null>(null);

  // Most common categories first; the long tail stays reachable through search.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
  }, [places]);

  const visible = useMemo(() => {
    const q = search.trim();
    return places.filter(p =>
      (!q || p.name.includes(q) || (p.category ?? '').includes(q))
      && (!category || p.category === category)
      && ATTRS.every(a => !attrs.has(a.key) || a.test(p)));
  }, [places, search, category, attrs]);
  const visibleIds = useMemo(() => new Set(visible.map(p => p.id)), [visible]);
  const pickedIds = useMemo(() => new Set(picked.map(p => p.id)), [picked]);

  const toggleAttr = (a: Attr) => setAttrs(prev => { const n = new Set(prev); if (n.has(a)) n.delete(a); else n.add(a); return n; });
  const filtersActive = !!search.trim() || !!category || attrs.size > 0;
  const canBuild = picked.length >= 2;
  const smartDisabled = !canBuild || picked.length > SMART_BUILD_MAX;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>בחרו מקומות ב{region?.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{loading ? 'טוען מקומות...' : `${places.length} מקומות באזור · לחצו על המפה או ברשימה`}</div>
        </div>
        <button type="button" onClick={onChangeRegion}
          style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>שנה אזור</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <PlacePickerMap
          places={places}
          visibleIds={visibleIds}
          picked={picked}
          start={start}
          focus={focus}
          fallback={region ? { lat: region.center_lat, lng: region.center_lng, zoom: region.zoom || 10 } : null}
          onToggle={onToggle}
        />
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1.5px solid ${C.line}`, borderRadius: 14, padding: '9px 12px', marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש מקום..." aria-label="חיפוש מקום"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontFamily: 'Heebo, sans-serif', color: C.ink, minWidth: 0 }} />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="נקה חיפוש" style={{ border: 'none', background: 'none', color: C.faint, cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        <button type="button" style={chip(!category)} onClick={() => setCategory('')}>הכל</button>
        {categories.map(c => <button key={c} type="button" style={chip(category === c)} onClick={() => setCategory(category === c ? '' : c)}>{c}</button>)}
        <span aria-hidden="true" style={{ width: 1, background: C.line, margin: '0 4px', flexShrink: 0 }} />
        {ATTRS.map(a => <button key={a.key} type="button" style={chip(attrs.has(a.key))} aria-pressed={attrs.has(a.key)} onClick={() => toggleAttr(a.key)}>{a.label}</button>)}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }} aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ height: 72, borderRadius: 16, background: '#e8eeec' }} />)}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', color: C.muted, fontSize: 14 }}>
          {places.length === 0 ? 'לא מצאנו מקומות באזור הזה' : 'אין מקומות שמתאימים לסינון'}
          {filtersActive && (
            <div style={{ marginTop: 10 }}>
              <button type="button" style={chip(false)} onClick={() => { setSearch(''); setCategory(''); setAttrs(new Set()); }}>נקה סינון</button>
            </div>
          )}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {visible.map(p => {
            const sel = pickedIds.has(p.id);
            const n = sel ? picked.findIndex(x => x.id === p.id) + 1 : 0;
            const meta = [p.category, p.duration_minutes ? `${p.duration_minutes} דק'` : '', p.difficulty].filter(Boolean).join(' · ');
            return (
              <li key={p.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: sel ? C.soft : '#fff', border: `2px solid ${sel ? C.accent : C.line}`, borderRadius: 16, padding: 8 }}>
                  <button type="button" onClick={() => onToggle(p)} aria-pressed={sel} aria-label={`${sel ? 'הסר' : 'הוסף'} את ${p.name}`}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'right', fontFamily: 'Heebo, sans-serif', minWidth: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {p.main_image
                        ? <img src={p.main_image} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                        : <span aria-hidden="true">🌿</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{meta}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {[p.has_water && '💧', p.has_shade && '🌳', p.accessible && '♿'].filter(Boolean).join(' ')}
                        {p.average_rating > 0 && <span> ⭐ {p.average_rating.toFixed(1)}</span>}
                      </div>
                    </div>
                    <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sel ? 13 : 18, fontWeight: 900, background: sel ? C.accent : '#f1f5f9', color: sel ? '#fff' : C.accent }}>
                      {sel ? n : '+'}
                    </span>
                  </button>
                  <button type="button" onClick={() => setFocus(p)} aria-label={`הצג את ${p.name} על המפה`} title="הצג על המפה"
                    style={{ width: 32, height: 32, borderRadius: 10, border: `1.5px solid ${C.line}`, background: '#fff', cursor: 'pointer', flexShrink: 0, fontSize: 14 }}>📍</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Spacer so the fixed bar doesn't cover the last places */}
      <div style={{ height: picked.length ? 190 : 90 }} />

      {/* Bottom bar: what's picked + build */}
      {/* Sits just above the app's bottom nav (Layout: 72px + safe area). */}
      <div style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 1500, padding: '0 12px', pointerEvents: 'none' }}>
        <div style={{ maxWidth: 576, margin: '0 auto', background: '#fff', borderRadius: 20, boxShadow: '0 -4px 30px rgba(0,0,0,0.15)', padding: 12, pointerEvents: 'auto', direction: 'rtl' }}>
          {picked.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '4px 0' }}>בחרו לפחות 2 מקומות כדי לבנות מסלול</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: C.ink, flexShrink: 0 }}>{picked.length} נבחרו</span>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
                  {picked.map((p, i) => (
                    <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.soft, color: C.accent, borderRadius: 999, padding: '3px 4px 3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {i + 1}. {p.name}
                      <button type="button" onClick={() => onToggle(p)} aria-label={`הסר את ${p.name}`}
                        style={{ border: 'none', background: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
                    </span>
                  ))}
                </div>
                <button type="button" onClick={onClear} style={{ border: 'none', background: 'none', color: C.faint, fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', flexShrink: 0 }}>נקה</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onBuildSmart} disabled={smartDisabled}
                  title={picked.length > SMART_BUILD_MAX ? `בנייה חכמה עד ${SMART_BUILD_MAX} מקומות` : 'הסוכנים יסדרו לפי שעות היום ומזג האוויר'}
                  style={{ flex: 3, padding: '12px', border: 'none', borderRadius: 14, background: smartDisabled ? C.line : 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: smartDisabled ? C.faint : '#fff', fontSize: 14, fontWeight: 900, cursor: smartDisabled ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                  🤖 בנייה חכמה
                </button>
                <button type="button" onClick={onBuildDistance} disabled={!canBuild}
                  title="הסדר הקצר ביותר בנסיעה"
                  style={{ flex: 2, padding: '12px', border: `2px solid ${canBuild ? C.accent : C.line}`, borderRadius: 14, background: '#fff', color: canBuild ? C.accent : C.faint, fontSize: 14, fontWeight: 800, cursor: canBuild ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif' }}>
                  📍 לפי מרחק
                </button>
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6, textAlign: 'center' }}>
                {!canBuild ? 'עוד מקום אחד ואפשר לבנות'
                  : picked.length > SMART_BUILD_MAX ? `בנייה חכמה עובדת עד ${SMART_BUILD_MAX} מקומות`
                  : 'בנייה חכמה: סדר ושעות לפי אופי המקום, מזג האוויר והשקיעה'}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
