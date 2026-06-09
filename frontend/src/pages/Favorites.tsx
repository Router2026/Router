// src/pages/Favorites.tsx
// Shows the authenticated user's saved locations with a map.

import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import FavoriteButton from '../components/FavoriteButton';
import { getImageUrl } from '../utils/imageUtils';

const DIFF_COLOR: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#dc2626',
};

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { favorites, loading } = useFavorites();

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❤️</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>המועדפים שלי</div>
        <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', maxWidth: 260, marginBottom: 24 }}>
          התחבר כדי לשמור מיקומים מועדפים
        </div>
        <button onClick={() => navigate('/Login')} style={{ padding: '12px 32px', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
          התחבר עכשיו
        </button>
      </div>
    );
  }

  const pinsWithCoords = favorites.filter(f => f.latitude && f.longitude);
  const mapCenter: [number, number] = pinsWithCoords.length
    ? [pinsWithCoords[0].latitude!, pinsWithCoords[0].longitude!]
    : [31.5, 34.8];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '24px 20px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1a2e2a' }}>❤️ המועדפים שלי</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{favorites.length} מיקומים שמורים</div>
        </div>
      </div>

      {/* Map */}
      {pinsWithCoords.length > 0 && (
        <div style={{ height: 220 }}>
          <MapContainer center={mapCenter} zoom={8} style={{ height: '100%' }} zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pinsWithCoords.map(f => (
              <CircleMarker
                key={f.id}
                center={[f.latitude!, f.longitude!]}
                radius={8}
                pathOptions={{ fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }}
                eventHandlers={{ click: () => navigate(`/POIDetail?id=${f.location_id}`) }}
              >
                <Tooltip permanent={false}>{f.name}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* List */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>⏳ טוען...</div>
        )}
        {!loading && !favorites.length && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💔</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2e2a' }}>אין מועדפים עדיין</div>
            <div style={{ color: '#94a3b8', marginTop: 6, marginBottom: 20 }}>לחץ על ❤️ בכל מיקום כדי לשמור אותו</div>
            <button onClick={() => navigate('/Explore')} style={{ padding: '12px 24px', border: 'none', borderRadius: 14, background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
              גלה מיקומים
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {favorites.map(fav => (
            <div
              key={fav.id}
              onClick={() => navigate(`/POIDetail?id=${fav.location_id}`)}
              style={{
                background: '#fff', borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '12px 14px', cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateX(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}
            >
              {/* Thumbnail */}
              <div style={{
                width: 60, height: 60, borderRadius: 12, flexShrink: 0,
                background: fav.main_image ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)',
                overflow: 'hidden',
              }}>
                {fav.main_image
                  ? <img src={getImageUrl(fav.main_image, 'thumb')} alt=""
                      loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.onerror = null; }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24 }}>📍</div>}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2e2a' }}>{fav.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {fav.category && <span style={{ fontSize: 12, color: '#64748b' }}>{fav.category}</span>}
                  {fav.region_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>• {fav.region_name}</span>}
                  {fav.difficulty && (
                    <span style={{ fontSize: 12, color: DIFF_COLOR[fav.difficulty] || '#64748b', fontWeight: 600 }}>
                      • {fav.difficulty}
                    </span>
                  )}
                </div>
                {fav.average_rating != null && !Number.isNaN(Number(fav.average_rating)) && (
                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 3 }}>
                    ★ {Number(fav.average_rating).toFixed(1)}
                  </div>
                )}
              </div>

              {/* Heart button */}
              <FavoriteButton locationId={fav.location_id} size={22} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
