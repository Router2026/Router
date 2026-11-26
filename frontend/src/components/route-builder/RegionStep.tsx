// Build-it-yourself, step 1: where you start from (optional) and which region.

import type { Region } from '../../api';

const REGION_ICONS: Record<string, string> = {
  'גולן': '🏔️', 'גליל עליון': '🌲', 'גליל תחתון': '💧', 'גליל מערבי': '🌊', 'כרמל': '🌿',
  'מרכז': '🏙️', 'ירושלים': '🕌', 'דרום': '🏜️', 'נגב': '🏜️',
  'ערבה': '🌵', 'אילת': '🏖️', 'עמק יזרעאל': '🌾', 'שרון': '🌸', 'ים המלח': '🧂',
};

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', accent: '#0d9e6e', soft: '#f0fdf8', blue: '#2563eb' };

export default function RegionStep({
  regions, hasStart, geoLoading, geoError, loadingRegionId, onLocate, onClearStart, onSelect,
}: Readonly<{
  regions: Region[];
  hasStart: boolean;
  geoLoading: boolean;
  geoError: string;
  loadingRegionId: string | number | null;
  onLocate: () => void;
  onClearStart: () => void;
  onSelect: (r: Region) => void;
}>) {
  return (
    <>
      {/* Start point */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', marginBottom: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>מאיפה יוצאים?</div>
        <div style={{ fontSize: 12, color: C.muted, margin: '2px 0 12px' }}>לא חובה — עוזר להתחיל מהעצירה הקרובה אליכם ולחשב זמני נסיעה</div>
        {hasStart ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', borderRadius: 14, padding: '10px 14px' }}>
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: C.blue, border: '3px solid #dbeafe', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.blue }}>יוצאים מהמיקום הנוכחי שלכם</span>
            <button type="button" onClick={onClearStart}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>הסר</button>
          </div>
        ) : (
          <button type="button" onClick={onLocate} disabled={geoLoading}
            style={{ width: '100%', padding: '11px 14px', border: `2px solid ${C.accent}`, borderRadius: 14, background: C.soft, color: C.accent, fontSize: 14, fontWeight: 800, cursor: geoLoading ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: geoLoading ? 0.7 : 1 }}>
            {geoLoading
              ? <span aria-hidden="true" style={{ width: 14, height: 14, border: '2px solid #d1fae5', borderTopColor: C.accent, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <span aria-hidden="true">📡</span>}
            {geoLoading ? 'מאתר מיקום...' : 'השתמשו במיקום הנוכחי שלי'}
          </button>
        )}
        {geoError && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{geoError}</div>}
      </div>

      {/* Region */}
      <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 12 }}>באיזה אזור תרצו לטייל?</div>
      {regions.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ height: 112, borderRadius: 18, background: '#e8eeec' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {regions.map(r => {
            const loading = loadingRegionId === r.id;
            return (
              <button key={r.id} type="button" onClick={() => onSelect(r)} disabled={loadingRegionId !== null}
                style={{ background: '#fff', border: `2px solid ${loading ? C.accent : 'transparent'}`, borderRadius: 18, overflow: 'hidden', cursor: loadingRegionId !== null ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', padding: 0, textAlign: 'right', fontFamily: 'Heebo, sans-serif', opacity: loadingRegionId !== null && !loading ? 0.6 : 1 }}>
                <div style={{ height: 70, background: `linear-gradient(135deg, ${r.color || '#0d9e6e'}cc, ${r.color || '#0d9e6e'}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }} aria-hidden="true">
                  {loading
                    ? <span style={{ width: 26, height: 26, border: '3px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : (REGION_ICONS[r.name] || '📍')}
                </div>
                <div style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, color: C.ink }}>
                  {r.name}
                  {loading && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.accent }}>טוען מקומות...</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
