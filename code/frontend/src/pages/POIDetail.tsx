import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type POI, type Review, type CommunityReport } from '../api';

const DIFF_COLORS: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#dc2626',
};

export default function POIDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiId = searchParams.get('id') || '';

  const [poi, setPoi] = useState<POI | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [tab, setTab] = useState<'reports' | 'reviews'>('reports');
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poiId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.locations.get(poiId),
      api.reviews.list(),
      api.reports.list(),
    ])
      .then(([poiData, reviewsData, reportsData]) => {
        setPoi(poiData);
        setReviews(reviewsData);
        setReports(reportsData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [poiId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
      <div>טוען...</div>
    </div>
  );

  if (error || !poi) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', gap: 12 }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <div style={{ fontWeight: 700 }}>לא ניתן לטעון את המקום</div>
      <button onClick={() => navigate(-1)} style={{ background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>חזרה</button>
    </div>
  );

  const diffColor = DIFF_COLORS[poi.difficulty] || '#16a34a';

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', width: '100%' }}>

      {/* ── Hero Image ─────────────────────────────────── */}
      <div style={{ position: 'relative', height: 350, width: '100%', backgroundImage: poi.main_image ? `url(${poi.main_image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', background: poi.main_image ? undefined : 'linear-gradient(135deg, #0d9e6e, #34d399)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              </button>
              <button onClick={() => setIsFav(!isFav)} style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? '#ef4444' : 'none'} stroke={isFav ? '#ef4444' : '#1a2e2a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </button>
            </div>
            <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 14, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 20px 32px', direction: 'rtl', zIndex: 10 }}>
            <span style={{ display: 'inline-block', background: diffColor, color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 800, marginBottom: 12 }}>{poi.difficulty}</span>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{poi.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.95)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{poi.region}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px', marginTop: -20, position: 'relative', zIndex: 20, paddingBottom: 100 }}>

        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', padding: '24px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, direction: 'rtl' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span style={{ fontWeight: 900, color: '#1a2e2a', fontSize: 18 }}>{poi.average_rating}</span>
            </div>
            <span style={{ background: '#f0fdf8', color: '#0d9e6e', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 800 }}>{poi.category}</span>
          </div>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, textAlign: 'right', marginBottom: 24 }}>{poi.description}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', direction: 'rtl' }}>
            {poi.duration_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#64748b' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>{poi.duration_minutes} דקות</span>}
            {poi.has_water && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0284c7' }}>💧 יש מים</span>}
            {poi.has_shade && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🌿 יש צל</span>}
            {poi.accessible && <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#faf5ff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>♿ נגיש</span>}
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: 16, display: 'flex', direction: 'rtl' }}>
          {[{ key: 'reports', label: `דיווחים (${reports.length})` }, { key: 'reviews', label: `ביקורות (${reviews.length})` }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: '12px', borderRadius: 16, border: 'none', background: tab === t.key ? '#0d9e6e' : 'transparent', color: tab === t.key ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>{t.label}</button>
          ))}
        </div>

        {/* Reports tab */}
        {tab === 'reports' && (
          <div style={{ direction: 'rtl' }}>
            {reports.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>אין דיווחים עדיין</div>}
            {reports.slice(0, 5).map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 18, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.reporter_name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706', background: '#fffbeb', borderRadius: 8, padding: '4px 10px' }}>{r.report_type}</span>
                </div>
                <p style={{ fontSize: 14, color: '#475569', textAlign: 'right', margin: 0 }}>{r.content}</p>
              </div>
            ))}
            <button onClick={() => navigate(`/AddReport?poi_name=${poi.name}`)} style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>+ הוסף דיווח</button>
          </div>
        )}

        {/* Reviews tab */}
        {tab === 'reviews' && (
          <div style={{ direction: 'rtl' }}>
            {reviews.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>אין ביקורות עדיין</div>}
            {reviews.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 18, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 2 }}>{'★'.repeat(r.rating)}</div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>{r.reviewer_name}</span>
                </div>
                <p style={{ fontSize: 14, color: '#475569', textAlign: 'right', margin: 0 }}>{r.content}</p>
              </div>
            ))}
            <button onClick={() => navigate(`/AddReview?poi_name=${poi.name}`)} style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>+ כתוב ביקורת</button>
          </div>
        )}

        <button onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(poi.name)}`, '_blank')} style={{ width: '100%', padding: '18px', border: 'none', borderRadius: 20, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(13, 158, 110, 0.25)', marginTop: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
          נווט לשם
        </button>
      </div>
    </div>
  );
}
