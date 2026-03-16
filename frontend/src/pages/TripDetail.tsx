import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type Trip, type TripStop } from '../api';

type StopWithCoords = TripStop & { latitude?: number; longitude?: number };
type TripWithCoords = Omit<Trip, 'stops'> & { stops: StopWithCoords[] };

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function TripDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id') || '';
  const [trip, setTrip] = useState<TripWithCoords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    api.trips
      .get(tripId)
      .then((data) => {
        setTrip(data);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: try listing trips and pick the first
        api.trips
          .list()
          .then((trips) => {
            if (trips.length > 0) setTrip(trips[0]);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
  }, [tripId]);

  if (loading)
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>טוען...</div>;

  if (!trip)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
        <div style={{ fontWeight: 700 }}>המסלול לא נמצא</div>
        <button
          onClick={() => navigate('/MyTrips')}
          style={{
            marginTop: 16,
            background: '#0d9e6e',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 24px',
            cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 700,
          }}
        >
          חזרה למסלולים
        </button>
      </div>
    );

  return (
    <div
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        width: '100%',
        direction: 'rtl',
      }}
    >
      {/* ── Header (Full Width) ── */}
      <div
        style={{
          background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)',
          width: '100%',
        }}
      >
        {/* Header Content (Centered) */}
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: '16px 20px 48px',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <button
              onClick={() => navigate('/MyTrips')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 12,
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#fff',
                transition: 'background 0.2s ease',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 12,
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#fff',
                transition: 'background 0.2s ease',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 22,
              fontWeight: 900,
              marginBottom: 6,
              textAlign: 'right',
            }}
          >
            {trip.name}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 13,
              marginBottom: 12,
              justifyContent: 'flex-end',
            }}
          >
            <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{trip.region}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {[
              `${trip.stops?.length || 0} עצירות`,
              `${trip.total_duration_hours} שעות`,
              trip.style || trip.group_type,
            ]
              .filter(Boolean)
              .map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    color: '#fff',
                    borderRadius: 20,
                    padding: '4px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* ── Main Content Container (Centered) ── */}
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '0 16px',
          marginTop: -20,
          position: 'relative',
          zIndex: 10,
          paddingBottom: 100,
        }}
      >
        {/* Itinerary */}
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            padding: '24px 20px',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#1a2e2a',
              marginBottom: 20,
              textAlign: 'right',
            }}
          >
            מסלול הטיול
          </h2>

          {/* Timeline */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                right: 16,
                top: 0,
                bottom: 0,
                width: 2,
                background: '#e8f5f1',
              }}
            />

            {(trip.stops || []).map((stop: StopWithCoords, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  marginBottom: 16,
                  paddingRight: 40,
                  position: 'relative',
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#0d9e6e',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                    zIndex: 2,
                    boxShadow: '0 2px 8px rgba(13, 158, 110, 0.3)',
                  }}
                >
                  {i + 1}
                </div>

                <div
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    borderRadius: 16,
                    padding: '14px 16px',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#94a3b8',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600 }}>
                        {stop.duration_minutes} דק'
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#64748b',
                          display: 'block',
                          background: '#e2e8f0',
                          padding: '2px 6px',
                          borderRadius: 6,
                        }}
                      >
                        {stop.arrival_time}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: '#1a2e2a',
                      textAlign: 'right',
                      marginBottom: stop.smart_insight ? 8 : 0,
                    }}
                  >
                    {stop.poi_name}
                  </div>
                  {stop.smart_insight && (
                    <div
                      style={{
                        background: '#fffbeb',
                        borderRadius: 10,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: '#d97706',
                          fontWeight: 600,
                          flex: 1,
                          textAlign: 'right',
                          lineHeight: 1.4,
                        }}
                      >
                        {stop.smart_insight}
                      </span>
                      <span style={{ fontSize: 14 }}>💡</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map View */}
        {(() => {
          const stopsWithCoords = (trip.stops || []).filter(
            (s: StopWithCoords) => s.latitude && s.longitude
          );
          if (stopsWithCoords.length < 1) return null;
          const center: [number, number] = [
            stopsWithCoords[0].latitude!,
            stopsWithCoords[0].longitude!,
          ];
          const polylinePoints: [number, number][] = stopsWithCoords.map((s: StopWithCoords) => [
            s.latitude!,
            s.longitude!,
          ]);
          return (
            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div style={{ padding: '16px 20px 12px', textAlign: 'right' }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>מפת המסלול</h2>
              </div>
              <MapContainer
                center={center}
                zoom={12}
                style={{ height: 280, width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap"
                />
                <Polyline positions={polylinePoints} color="#0d9e6e" weight={3} dashArray="6 4" />
                {stopsWithCoords.map((s: StopWithCoords, i: number) => (
                  <Marker key={i} position={[s.latitude!, s.longitude!]}>
                    <Popup>
                      <div
                        style={{
                          textAlign: 'right',
                          fontFamily: 'Heebo, sans-serif',
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}. {s.poi_name}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            style={{
              width: 56,
              height: 56,
              border: '2px solid #e2e8f0',
              borderRadius: 16,
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={() => {
              const addr = encodeURIComponent(trip.stops?.[0]?.poi_name || (trip.region ?? ''));
              window.open(`https://waze.com/ul?q=${addr}`, '_blank');
            }}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(13, 158, 110, 0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            התחל ניווט
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
