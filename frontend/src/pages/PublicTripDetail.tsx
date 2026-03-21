// src/pages/PublicTripDetail.tsx — FIXED
// Reads from routes + route_stops via the rewritten public-trips-service.
// Shows region, difficulty, style, group_type, duration, distance.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip } from '../api';

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

export default function PublicTripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.publicTrips.get(parseInt(id))
      .then(setTrip)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        טוען מסלול...
      </div>
    </div>
  );

  if (notFound || !trip) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>המסלול לא נמצא</div>
      <button onClick={() => navigate('/trips')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700 }}>
        חזור למסלולים
      </button>
    </div>
  );

  const validStops = trip.locations.filter(l => l.latitude && l.longitude);
  const pts = validStops.map(l => [l.latitude, l.longitude] as [number, number]);
  const center = pts.length ? pts[Math.floor(pts.length / 2)] : [31.5, 34.8] as [number, number];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60, fontFamily: 'Heebo, sans-serif' }}>
      {/* Back bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← חזור
        </button>
      </div>

      {/* Map */}
      {pts.length > 0 && (
        <div style={{ height: 280 }}>
          <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.length > 1 && <Polyline positions={pts} pathOptions={{ color: '#0d9e6e', weight: 4, opacity: 0.9 }} />}
            {validStops.map((loc, i) => (
              <CircleMarker key={i} center={[loc.latitude, loc.longitude]} radius={8}
                pathOptions={{ fillColor: CAT_COLOR[loc.category] || '#0d9e6e', fillOpacity: 1, color: '#fff', weight: 2 }}>
                <Tooltip permanent={false} direction="top">{loc.name}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Title + meta */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>{trip.title}</div>
          {trip.description && (
            <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>{trip.description}</div>
          )}

          {/* Meta chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {(trip as any).region && (
              <span style={{ fontSize: 13, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>
                📍 {(trip as any).region}
              </span>
            )}
            {(trip as any).difficulty && (
              <span style={{ fontSize: 13, background: `${DIFF_COLOR[(trip as any).difficulty] || '#64748b'}18`, color: DIFF_COLOR[(trip as any).difficulty] || '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>
                {(trip as any).difficulty}
              </span>
            )}
            {(trip as any).style && (
              <span style={{ fontSize: 13, background: '#f8fafc', color: '#475569', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>
                {(trip as any).style}
              </span>
            )}
            {(trip as any).total_duration_hours ? (
              <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>
                ⏱ {(trip as any).total_duration_hours} שע'
              </span>
            ) : null}
            {(trip as any).total_distance_km ? (
              <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>
                📏 {parseFloat((trip as any).total_distance_km).toFixed(1)} ק"מ
              </span>
            ) : null}
            {(trip as any).group_type && GROUP_ICON[(trip as any).group_type] && (
              <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>
                {GROUP_ICON[(trip as any).group_type]}
              </span>
            )}
          </div>

          {/* Creator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>
              {trip.creator_avatar
                ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : trip.creator_username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{trip.creator_username}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>⚡ {trip.creator_xp} XP</div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginRight: 'auto' }}>
              {new Date(trip.created_at).toLocaleDateString('he-IL')}
            </div>
          </div>
        </div>

        {/* Stops list */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', marginBottom: 14 }}>
            📍 {trip.locations.length} עצירות במסלול
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {trip.locations.map((loc, i) => (
              <div
                key={i}
                onClick={() => loc.location_id && navigate(`/POIDetail?id=${loc.location_id}`)}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < trip.locations.length - 1 ? '1px solid #f0f0f0' : 'none', cursor: loc.location_id ? 'pointer' : 'default' }}
              >
                {/* Step number */}
                <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: CAT_COLOR[loc.category] || '#0d9e6e', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                {/* Image */}
                {loc.main_image && (
                  <img src={loc.main_image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                )}
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2e2a' }}>{loc.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: CAT_COLOR[loc.category] || '#64748b', fontWeight: 600 }}>{loc.category}</span>
                    {loc.region_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>{loc.region_name}</span>}
                    {loc.difficulty && <span style={{ fontSize: 12, color: '#64748b' }}>• {loc.difficulty}</span>}
                    {loc.arrival_time && (
                      <span style={{ fontSize: 11, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>{loc.arrival_time}</span>
                    )}
                    {loc.duration_minutes && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{loc.duration_minutes} דק'</span>
                    )}
                  </div>
                  {loc.smart_insight && (
                    <div style={{ marginTop: 6, background: '#fffbeb', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#d97706', fontWeight: 600, lineHeight: 1.4 }}>
                      💡 {loc.smart_insight}
                    </div>
                  )}
                </div>
                {loc.location_id ? <div style={{ fontSize: 18, color: '#cbd5e1', marginTop: 6 }}>›</div> : null}
              </div>
            ))}
          </div>

          {/* Navigate CTA */}
          {validStops.length > 0 && (
            <button
              onClick={() => window.open(`https://waze.com/ul?ll=${validStops[0].latitude},${validStops[0].longitude}&navigate=yes`, '_blank')}
              style={{ width: '100%', marginTop: 20, padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(13,158,110,0.25)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              נווט לנקודת ההתחלה
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
