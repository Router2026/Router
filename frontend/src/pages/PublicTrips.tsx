// src/pages/PublicTrips.tsx — Redesigned
// Improved map/preview showing place images, social stats (likes/ratings/comments)
// Sorted by best-rated routes first

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

function StarRow({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24"
          fill={i <= full ? '#f59e0b' : (i === full+1 && half ? '#f59e0b' : 'none')}
          stroke="#f59e0b" strokeWidth="2" opacity={i <= full ? 1 : (i === full+1 && half ? 0.5 : 0.3)}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      {count > 0 && <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 3 }}>({count})</span>}
    </div>
  );
}

function RouteImagePreview({ trip }: { trip: PublicTrip }) {
  const stops = trip.locations.filter(l => l.latitude && l.longitude);

  if (trip.image_url) {
    return (
      <div style={{ position: 'relative', height: 160, borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
        <img src={trip.image_url} alt={trip.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6))' }} />
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          {stops.slice(0, 5).map((loc, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              {loc.main_image
                ? <img src={loc.main_image} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                : <div style={{ width: 34, height: 34, borderRadius: 8, background: CAT_COLOR[loc.category] || '#0d9e6e', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>{i+1}</div>}
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: '#0d9e6e', color: '#fff', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>{i+1}</div>
            </div>
          ))}
          {stops.length > 5 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>+{stops.length-5}</span>}
        </div>
      </div>
    );
  }

  if (!stops.length) {
    return (
      <div style={{ height: 100, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        🗺️ אין מיקומים
      </div>
    );
  }

  const W = 340, H = 110, PAD = 24;
  const lats = stops.map(l => l.latitude);
  const lngs = stops.map(l => l.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;
  const toX = (lng: number) => PAD + ((lng - minLng) / dLng) * (W - PAD*2);
  const toY = (lat: number) => H - PAD - ((lat - minLat) / dLat) * (H - PAD*2);
  const pts = stops.map(l => ({ x: toX(l.longitude), y: toY(l.latitude), loc: l }));
  const pathD = pts.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const imgR = 18;

  return (
    <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" strokeDasharray="7 5" />
        )}
        {pts.map((p, i) => {
          const loc = p.loc as PublicTripLocation;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={imgR+3} fill="white" opacity="0.95" />
              {loc.main_image ? (
                <>
                  <defs>
                    <clipPath id={`pt-clip-${i}`}><circle cx={p.x} cy={p.y} r={imgR} /></clipPath>
                  </defs>
                  <image href={loc.main_image} x={p.x-imgR} y={p.y-imgR} width={imgR*2} height={imgR*2}
                    clipPath={`url(#pt-clip-${i})`} preserveAspectRatio="xMidYMid slice" />
                  <circle cx={p.x} cy={p.y} r={imgR} fill="none" stroke={CAT_COLOR[loc.category]||'#0d9e6e'} strokeWidth="2.5" />
                </>
              ) : (
                <circle cx={p.x} cy={p.y} r={imgR} fill={CAT_COLOR[loc.category]||'#0d9e6e'} stroke="white" strokeWidth="2.5" />
              )}
              <circle cx={p.x+imgR*0.65} cy={p.y-imgR*0.65} r="7.5" fill="#0d9e6e" stroke="white" strokeWidth="1.5" />
              <text x={p.x+imgR*0.65} y={p.y-imgR*0.65} textAnchor="middle" dominantBaseline="central"
                fontSize="7.5" fill="white" fontWeight="900" fontFamily="Heebo,Arial">{i+1}</text>
            </g>
          );
        })}
      </svg>
    </div>
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
    <div style={{ background: '#f1f5f9', minHeight: '100vh', direction: 'rtl', padding: '0 0 80px' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d9e6e,#059669)', padding: '28px 20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 4 }}>🗺️ מסלולים ציבוריים</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>מסלולים מדורגים לפי ציון הקהילה</div>
          <input
            placeholder="🔍 חפש לפי אזור..."
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            style={{ width: '100%', padding: '11px 16px', borderRadius: 14, border: 'none', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}
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
          {trips.map((trip, idx) => (
            <div
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}`)}
              style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 14px rgba(0,0,0,0.07)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 14px rgba(0,0,0,0.07)'; }}
            >
              <RouteImagePreview trip={trip} />

              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  {idx < 3 && (trip.average_rating ?? 0) > 0 && (
                    <div style={{ fontSize: 20, flexShrink: 0 }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                  )}
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', lineHeight: 1.3 }}>{trip.title}</div>
                </div>

                {(trip.average_rating ?? 0) > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <StarRow rating={trip.average_rating ?? 0} count={trip.ratings_count ?? 0} />
                  </div>
                )}

                {(trip.user_description || trip.description) && (
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', ...(trip.user_description ? { fontStyle: 'italic', borderRight: '3px solid #d1fae5', paddingRight: 8 } : {}) }}>
                    {trip.user_description || trip.description}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {trip.region && (
                    <span style={{ fontSize: 12, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 8, padding: '3px 9px', fontWeight: 700 }}>📍 {trip.region}</span>
                  )}
                  {trip.difficulty && (
                    <span style={{ fontSize: 12, background: `${DIFF_COLOR[trip.difficulty]||'#64748b'}18`, color: DIFF_COLOR[trip.difficulty]||'#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 700 }}>{trip.difficulty}</span>
                  )}
                  {trip.style && (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>{trip.style}</span>
                  )}
                  {trip.total_duration_hours ? (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>⏱ {trip.total_duration_hours} שע'</span>
                  ) : null}
                  {trip.group_type && GROUP_ICON[trip.group_type] && (
                    <span style={{ fontSize: 12, background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '3px 9px', fontWeight: 600 }}>{GROUP_ICON[trip.group_type]}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid #f0f4f8', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                      {trip.creator_avatar
                        ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : trip.creator_username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{trip.creator_username}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
                    {(trip.likes_count ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#64748b' }}>❤️ {trip.likes_count}</span>
                    )}
                    {(trip.comments_count ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#64748b' }}>💬 {trip.comments_count}</span>
                    )}
                    <span style={{ fontSize: 13, color: '#64748b' }}>📍 {trip.location_count}</span>
                  </div>
                </div>

                {trip.locations.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {trip.locations.slice(0, 4).map((loc, i) => (
                      <span key={i} style={{ background: '#f1f5f9', borderRadius: 8, padding: '3px 8px', fontSize: 12, color: '#475569' }}>{loc.name}</span>
                    ))}
                    {trip.locations.length > 4 && (
                      <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 4px' }}>+{trip.locations.length-4}</span>
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
