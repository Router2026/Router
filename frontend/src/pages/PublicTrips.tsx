// src/pages/PublicTrips.tsx — FIXED
// Now reads from `routes` + `route_stops` (via the rewritten public-trips-service).
// Adds region, difficulty, style, and duration fields to each card.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PublicTrip, type PublicTripLocation } from '../api';

const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
};

const DIFF_COLOR: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#7c3aed',
};

const GROUP_ICON: Record<string, string> = {
  solo: '🚶', couple: '👫', family: '👨‍👩‍👧‍👦', friends: '👥',
  יחיד: '🚶', זוג: '👫', משפחה: '👨‍👩‍👧‍👦', חברים: '👥',
};

// ── Lightweight SVG route preview ──────────────────────────────────────────
function RouteSvg({ locations }: { locations: PublicTripLocation[] }) {
  const valid = locations.filter(l => l.latitude && l.longitude);
  if (!valid.length) {
    return (
      <div style={{ background: '#f1f5f9', borderRadius: 12, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        🗺️ אין מיקומים
      </div>
    );
  }

  const W = 280, H = 100, PAD = 14;
  const lats = valid.map(l => l.latitude);
  const lngs = valid.map(l => l.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;

  const toX = (lng: number) => PAD + ((lng - minLng) / dLng) * (W - PAD * 2);
  const toY = (lat: number) => H - PAD - ((lat - minLat) / dLat) * (H - PAD * 2);

  const pts = valid.map(l => ({ x: toX(l.longitude), y: toY(l.latitude), loc: l }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 12, display: 'block', background: '#f0fdf4' }}>
      {pts.length > 1 && (
        <path d={pathD} fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={i === 0 || i === pts.length - 1 ? 6 : 4}
            fill={CAT_COLOR[p.loc.category] || '#0d9e6e'} stroke="white" strokeWidth="2" />
          {i === 0 && <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="Heebo,Arial">התחלה</text>}
        </g>
      ))}
    </svg>
  );
}

export default function PublicTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.publicTrips.list({ region: regionFilter || undefined })
        .then(setTrips)
        .catch(() => setTrips([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [regionFilter]);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '24px 20px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1a2e2a', marginBottom: 4 }}>🗺️ מסלולים ציבוריים</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>גלה מסלולים שמשתמשים אחרים יצרו</div>
          <input
            placeholder="🔍 חפש לפי אזור..."
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            טוען מסלולים...
          </div>
        )}

        {!loading && !trips.length && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏔️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2e2a' }}>אין מסלולים עדיין</div>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>צור מסלול ראשון!</div>
            <button
              onClick={() => navigate('/RouteGenerator')}
              style={{ marginTop: 20, padding: '12px 28px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>
              + צור מסלול
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {trips.map(trip => (
            <div
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}`)}
              style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
            >
              {/* SVG route preview */}
              <div style={{ padding: '12px 12px 0' }}>
                <RouteSvg locations={trip.locations} />
              </div>

              <div style={{ padding: '14px 16px 16px' }}>
                {/* Title */}
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', marginBottom: 4 }}>{trip.title}</div>

                {trip.description && (
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {trip.description}
                  </div>
                )}

                {/* Meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {trip.region && (
                    <span style={{ fontSize: 12, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 8, padding: '3px 9px', fontWeight: 700 }}>
                      📍 {trip.region}
                    </span>
                  )}
                  {trip.difficulty && (
                    <span style={{ fontSize: 12, background: `${DIFF_COLOR[trip.difficulty] || '#64748b'}18`, color: DIFF_COLOR[trip.difficulty] || '#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 700 }}>
                      {trip.difficulty}
                    </span>
                  )}
                  {trip.style && (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>
                      {trip.style}
                    </span>
                  )}
                  {trip.total_duration_hours ? (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>
                      ⏱ {trip.total_duration_hours} שע'
                    </span>
                  ) : null}
                  {trip.group_type && GROUP_ICON[trip.group_type] && (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>
                      {GROUP_ICON[trip.group_type]}
                    </span>
                  )}
                </div>

                {/* Creator + stats row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                      {trip.creator_avatar
                        ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : trip.creator_username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{trip.creator_username}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b' }}>
                    📍 {trip.location_count} עצירות
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginRight: 'auto' }}>
                    {new Date(trip.created_at).toLocaleDateString('he-IL')}
                  </div>
                </div>

                {/* Stop name chips */}
                {trip.locations.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {trip.locations.slice(0, 4).map((loc, i) => (
                      <span key={i} style={{ background: '#f1f5f9', borderRadius: 8, padding: '3px 8px', fontSize: 12, color: '#475569' }}>{loc.name}</span>
                    ))}
                    {trip.locations.length > 4 && (
                      <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 4px' }}>+{trip.locations.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
