// src/pages/PublicTrips.tsx
// Lists public trips. Uses a lightweight SVG route preview per card instead of a full
// Leaflet MapContainer — which would create dozens of map instances and crash browsers.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PublicTrip, type PublicTripLocation } from '../api';

const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
};

// ── Lightweight SVG route preview ──────────────────────────────────────────
// Projects lat/lng to a fixed canvas using linear normalisation — zero Leaflet instances.
function RouteSvg({ locations }: { locations: PublicTripLocation[] }) {
  if (!locations.length) {
    return (
      <div style={{ background: '#f1f5f9', borderRadius: 12, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        🗺️ אין מיקומים
      </div>
    );
  }

  const W = 280, H = 100, PAD = 14;
  const lats = locations.map(l => l.latitude);
  const lngs = locations.map(l => l.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;

  const toX = (lng: number) => PAD + ((lng - minLng) / dLng) * (W - PAD * 2);
  const toY = (lat: number) => H - PAD - ((lat - minLat) / dLat) * (H - PAD * 2);

  const pts = locations.map(l => ({ x: toX(l.longitude), y: toY(l.latitude), loc: l }));
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
  const [trips, setTrips]               = useState<PublicTrip[]>([]);
  const [loading, setLoading]           = useState(true);
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
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '24px 20px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1a2e2a', marginBottom: 4 }}>🗺️ מסלולים ציבוריים</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>גלה מסלולים שמשתמשים אחרים שיתפו</div>
          <input
            placeholder="🔍 חפש לפי אזור..."
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 16 }}>⏳ טוען מסלולים...</div>}

        {!loading && !trips.length && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏔️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2e2a' }}>אין מסלולים עדיין</div>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>היה הראשון לשתף מסלול!</div>
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
              <div style={{ padding: '12px 12px 0' }}>
                <RouteSvg locations={trip.locations} />
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', marginBottom: 4 }}>{trip.title}</div>
                {trip.description && (
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {trip.description}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                      {trip.creator_avatar ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : trip.creator_username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{trip.creator_username}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b' }}>📍 {trip.location_count} מיקומים</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginRight: 'auto' }}>{new Date(trip.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                {trip.locations.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {trip.locations.slice(0, 4).map((loc, i) => (
                      <span key={i} style={{ background: '#f1f5f9', borderRadius: 8, padding: '3px 8px', fontSize: 12, color: '#475569' }}>{loc.name}</span>
                    ))}
                    {trip.locations.length > 4 && <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 4px' }}>+{trip.locations.length - 4}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
