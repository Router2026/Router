// src/pages/PublicTripDetail.tsx
// Full trip view: map route, locations list, creator profile link.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip } from '../api';

const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      ⏳ טוען מסלול...
    </div>
  );

  if (notFound || !trip) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>המסלול לא נמצא</div>
      <button onClick={() => navigate('/trips')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700 }}>
        חזור למסלולים
      </button>
    </div>
  );

  const pts = trip.locations.map(l => [l.latitude, l.longitude] as [number, number]);
  const center = pts.length ? pts[Math.floor(pts.length / 2)] : [31.5, 34.8] as [number, number];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>
      {/* Back */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← חזור
        </button>
      </div>

      {/* Map */}
      <div style={{ height: 280 }}>
        <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl={true} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pts.length > 1 && <Polyline positions={pts} pathOptions={{ color: '#0d9e6e', weight: 4, opacity: 0.9 }} />}
          {trip.locations.map((loc, i) => (
            <CircleMarker key={i} center={[loc.latitude, loc.longitude]} radius={8}
              pathOptions={{ fillColor: CAT_COLOR[loc.category] || '#0d9e6e', fillOpacity: 1, color: '#fff', weight: 2 }}
            >
              <Tooltip permanent={false} direction="top">{loc.name}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {/* Title + creator */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>{trip.title}</div>
          {trip.description && <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>{trip.description}</div>}

          {/* Creator row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700,
            }}>
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

        {/* Locations */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', marginBottom: 14 }}>
            📍 {trip.locations.length} עצירות במסלול
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {trip.locations.map((loc, i) => (
              <div
                key={i}
                onClick={() => navigate(`/POIDetail?id=${loc.location_id}`)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '12px 0',
                  borderBottom: i < trip.locations.length - 1 ? '1px solid #f0f0f0' : 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Step number */}
                <div style={{
                  minWidth: 28, height: 28, borderRadius: '50%',
                  background: CAT_COLOR[loc.category] || '#0d9e6e',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  {i + 1}
                </div>
                {/* Image */}
                {loc.main_image && (
                  <img src={loc.main_image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                )}
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2e2a' }}>{loc.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: CAT_COLOR[loc.category] || '#64748b', fontWeight: 600 }}>{loc.category}</span>
                    {loc.region_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>{loc.region_name}</span>}
                    {loc.difficulty && (
                      <span style={{ fontSize: 12, color: '#64748b' }}>• {loc.difficulty}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: '#cbd5e1', marginTop: 6 }}>›</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
