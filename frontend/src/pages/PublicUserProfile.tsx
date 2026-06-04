// src/pages/PublicUserProfile.tsx
// View any user's public profile and their shared routes

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type PublicTrip, type CommunityPoiSubmission } from '../api';
import { useAuth } from '../context/AuthContext';

function computeLevel(xp: number) { return Math.floor(Math.sqrt(Math.max(0, xp) / 50)); }
function levelLabel(xp: number) {
  const l = computeLevel(xp);
  if (l === 0) return 'מטייל מתחיל';
  if (l < 3)  return 'חוקר';
  if (l < 6)  return 'שועל שטח';
  if (l < 10) return 'מגלה';
  if (l < 15) return 'נווט';
  return 'אלוף המסלולים';
}
function LevelBar({ xp }: { xp: number }) {
  const level    = computeLevel(xp);
  const nextXp   = (level + 1) * (level + 1) * 50;
  const curXp    = level * level * 50;
  const progress = nextXp > curXp ? Math.min(((xp - curXp) / (nextXp - curXp)) * 100, 100) : 100;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        <span>רמה {level}</span><span>{xp} / {nextXp} XP</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#0d9e6e,#34d399)', borderRadius: 999, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

const DIFF_COLOR: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#7c3aed',
};

function TripMiniCard({ trip, onClick }: { trip: PublicTrip; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer', border: '1px solid #f1f5f9', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}>

      {/* Cover */}
      {trip.image_url
        ? <img src={trip.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 130, background: 'linear-gradient(135deg,#0d9e6e,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🗺️</div>
      }

      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trip.title || trip.description || 'מסלול'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {trip.region && (
            <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>📍 {trip.region}</span>
          )}
          {trip.difficulty && (
            <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLOR[trip.difficulty] || '#64748b', background: `${DIFF_COLOR[trip.difficulty] || '#64748b'}15`, borderRadius: 8, padding: '2px 8px' }}>{trip.difficulty}</span>
          )}
          {trip.locations?.length > 0 && (
            <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>{trip.locations.length} עצירות</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
          {trip.average_rating ? (
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>★ {(trip.average_rating).toFixed(1)}</span>
          ) : <span />}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {trip.likes_count ? `❤️ ${trip.likes_count}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PublicUserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [communityPois, setCommunityPois] = useState<CommunityPoiSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = parseInt(id || '', 10);
  const isOwnProfile = user && Number(user.id) === userId;

  useEffect(() => {
    if (!userId || isNaN(userId)) { setError('מזהה משתמש לא תקין'); setLoading(false); return; }
    setLoading(true);
    api.userProfiles.get(userId)
      .then(({ profile: p, trips: t, community_pois: cp }) => { setProfile(p); setTrips(t); setCommunityPois(cp ?? []); })
      .catch(() => setError('לא נמצא פרופיל'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        טוען פרופיל...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !profile) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', gap: 16 }}>
      <div style={{ fontSize: 52 }}>😕</div>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>{error || 'לא נמצא פרופיל'}</div>
      <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0d9e6e', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>חזרה</button>
    </div>
  );

  const xp = profile.xp_points || profile.xp || 0;

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', direction: 'rtl', fontFamily: 'Heebo, sans-serif', paddingBottom: 80 }}>

      {/* ── Cover + back button ── */}
      <div style={{ position: 'relative', height: 180, background: profile.cover_image ? 'none' : 'linear-gradient(135deg,#0d9e6e 0%,#047857 100%)', overflow: 'hidden' }}>
        {profile.cover_image && <img src={profile.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
        <button onClick={() => navigate(-1)}
          style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Heebo, sans-serif', backdropFilter: 'blur(4px)' }}>
          ← חזרה
        </button>
        {isOwnProfile && (
          <button onClick={() => navigate('/Profile')}
            style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: 'Heebo, sans-serif', backdropFilter: 'blur(4px)' }}>
            ✏️ ערוך פרופיל
          </button>
        )}
      </div>

      {/* ── Profile card ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginTop: -50, position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Avatar */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', overflow: 'hidden', flexShrink: 0, background: '#0d9e6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28, color: '#fff', fontWeight: 900 }}>{(profile.username || profile.full_name || '?')[0].toUpperCase()}</span>
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name || profile.username}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>@{profile.username}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0d9e6e', background: '#f0fdf4', borderRadius: 20, padding: '3px 10px', border: '1px solid #bbf7d0' }}>
                {levelLabel(xp)}
              </span>
            </div>
          </div>

          <LevelBar xp={xp} />

          {profile.bio && (
            <div style={{ marginTop: 14, fontSize: 14, color: '#475569', lineHeight: 1.65, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              {profile.bio}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 0, marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            {[
              { label: 'מסלולים', value: trips.length },
              { label: 'דוחות', value: profile.reports_count || 0 },
              { label: 'ביקורות', value: profile.reviews_count || 0 },
              { label: 'XP', value: xp },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#0d9e6e' }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Social links */}
          {(profile.instagram || profile.website) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {profile.instagram && (
                <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#e1306c', fontWeight: 700, textDecoration: 'none', background: '#fdf2f8', borderRadius: 20, padding: '4px 12px', border: '1px solid #f9a8d4' }}>
                  📸 @{profile.instagram}
                </a>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#0284c7', fontWeight: 700, textDecoration: 'none', background: '#f0f9ff', borderRadius: 20, padding: '4px 12px', border: '1px solid #bae6fd' }}>
                  🌐 אתר אישי
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Public trips ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            🗺️ המסלולים הציבוריים
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>({trips.length})</span>
          </div>

          {trips.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏔️</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>אין מסלולים ציבוריים עדיין</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {trips.map(trip => (
              <TripMiniCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
            ))}
          </div>
        </div>



        {/* ── Community Places ── */}
        {communityPois.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              📍 מיקומים שהוסיף לקהילה
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>({communityPois.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {communityPois.map(poi => {
                const mainPhoto = poi.photos?.[0] ?? null;
                return (
                  <div key={poi.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ width: 72, flexShrink: 0, background: mainPhoto ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                      {mainPhoto
                        ? <img src={mainPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : '📍'}
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{poi.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>{poi.category}</span>
                        {poi.region && <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>📍 {poi.region}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Favorite regions */}
        {profile.favorite_regions?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 10 }}>❤️ אזורים אהובים</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {profile.favorite_regions.map((r: string) => (
                <span key={r} style={{ fontSize: 12, fontWeight: 700, color: '#0d9e6e', background: '#f0fdf4', borderRadius: 20, padding: '4px 12px', border: '1px solid #bbf7d0' }}>{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}