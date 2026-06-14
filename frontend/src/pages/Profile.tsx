// src/pages/Profile.tsx — UPDATED
// Feature 5: reports, reviews, trips synced with DB.
// Feature 8: "My Trips" link added to actions.
// Added loading state matching PublicTrips.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type UserProfile, type CommunityReport, type Review } from '../api';
import { useAuth } from '../context/AuthContext';
import { useInstallPrompt } from '../components/InstallPrompt';

function LevelBar({ xp }: Readonly<{ xp: number }>) {
  const level = Math.floor(Math.sqrt(xp / 50));
  const nextLevelXp = (level + 1) * (level + 1) * 50;
  const currentLevelXp = level * level * 50;
  const progress = nextLevelXp > currentLevelXp
    ? Math.min(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100, 100) : 100;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        <span>רמה {level}</span><span>{xp} / {nextLevelXp} XP</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#0d9e6e,#34d399)', borderRadius: 999, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { available: installAvailable, isIos: installIsIos, triggerInstall } = useInstallPrompt();
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  let installToggleIcon = '›';
  if (installIsIos) { installToggleIcon = showIosInstructions ? '▲' : '▼'; }

  // Keyed by user.id — a new user login is a cache miss; re-logins with the
  // same account are instant (staleTime allows 5-min background trips).
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['users', 'me', user?.id],
    queryFn: () => api.users.me(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentReports = [], isLoading: reportsLoading } = useQuery<CommunityReport[]>({
    queryKey: ['reports', 'mine', user?.id],
    queryFn: () => api.reports.myReports(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    select: (data) => data.slice(0, 3),
  });

  const { data: recentReviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ['reviews', 'mine', user?.id],
    queryFn: () => api.reviews.myReviews(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    select: (data) => data.slice(0, 3),
  });

  const loading = profileLoading || reportsLoading || reviewsLoading;

  const handleLogout = () => { logout(); navigate('/Login'); };

  // Handle case where user is not logged in
  if (!user && !loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>אינך מחובר</div>
        <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24, maxWidth: 280 }}>כדי לראות את הפרופיל, המסלולים וההתקדמות שלך, אנא התחבר לחשבון.</div>
        <button onClick={() => navigate('/Login')} style={{ padding: '12px 32px', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 14px rgba(13,158,110,0.3)' }}>
          התחבר עכשיו
        </button>
      </div>
    );
  }

  // Display loading spinner while fetching data
  if (loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 20 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <div style={{ color: '#94a3b8', fontSize: 16, fontFamily: 'Heebo, sans-serif' }}>טוען נתוני פרופיל...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const xp = profile?.xp_points ?? 0;
  const level = profile?.level || 'מטייל מתחיל';
  const levelNum = profile?.level_number ?? Math.floor(Math.sqrt(xp / 50));

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>
      {/* Cover */}
      <div style={{ height: 120, position: 'relative', background: profile?.cover_image ? `url(${profile.cover_image}) center/cover no-repeat` : 'linear-gradient(135deg, #0d9e6e 0%, #34d399 60%, #0284c7 100%)' }}>
        <button onClick={() => navigate('/profile/edit')} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', fontSize: 13, fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 600 }}>✏️ עריכה</button>
      </div>

      {/* Avatar + header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', paddingBottom: 20 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ transform: 'translateY(-32px)', marginBottom: -16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #fff', background: profile?.avatar_url ? 'none' : 'linear-gradient(135deg, #0d9e6e, #34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', fontWeight: 800, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : (user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'ע')}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a' }}>{profile?.full_name || user?.full_name || 'משתמש'}</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>@{profile?.username || user?.username}</div>
              {profile?.bio && <div style={{ fontSize: 14, color: '#475569', marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>{profile.bio}</div>}
            </div>
            <div style={{ background: '#ecfdf5', border: '2px solid #0d9e6e', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#0d9e6e', fontWeight: 600 }}>רמה {levelNum}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0d9e6e' }}>⚡ {xp} XP</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{level}</div>
            </div>
          </div>
          <LevelBar xp={xp} />
          {(profile?.instagram || profile?.website) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              {profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>📸 {profile.instagram}</a>}
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#0284c7', textDecoration: 'none' }}>🌐 אתר אישי</a>}
            </div>
          )}
          {profile?.favorite_regions?.length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {profile.favorite_regions.map(r => (
                <span key={r} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#166534', fontWeight: 600 }}>📍 {r}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 20px' }}>
        {/* Stats — synced from DB (Feature 5) */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
            {[
              { label: 'דיווחים', value: profile?.reports_count ?? recentReports.length, emoji: '📊' },
              { label: 'ביקורות', value: profile?.reviews_count ?? recentReviews.length, emoji: '⭐' },
              { label: 'מיקומים', value: profile?.places_count ?? 0, emoji: '📍' },
              { label: 'מסלולים', value: profile?.trips_count ?? 0, emoji: '🗺️' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a' }}>{stat.emoji} {stat.value}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity — Feature 5 */}
        {recentReports.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>הדיווחים האחרונים שלי</div>
            {recentReports.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', direction: 'rtl' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{r.poi_name || 'מיקום לא ידוע'}</span>
                <span style={{ fontSize: 11, background: '#fffbeb', color: '#d97706', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{r.report_type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {user?.is_admin && (
            <button onClick={() => navigate('/Admin')} style={{ width: '100%', padding: '14px 18px', border: '2px solid #7c3aed', borderRadius: 14, background: 'linear-gradient(135deg, #faf5ff, #ede9fe)', color: '#6d28d9', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'right', boxShadow: '0 2px 8px rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c3aed', fontSize: 18 }}>›</span>
              <span>🛡️ לוח ניהול</span>
            </button>
          )}
          {/* Feature 8: My Trips added */}
          {[
            { label: '📍 המיקומים שלי', path: '/my-places' },
            { label: '❤️ המועדפים שלי', path: '/favorites' },
            { label: '🗺️ המסלולים שלי', path: '/MyTrips' },
            { label: '🌍 מסלולים ציבוריים', path: '/trips' },
            { label: '🎥 צפייה בוידאו קהילתי', path: '/CommunityVideos' },
            { label: '✏️ עריכת פרופיל', path: '/profile/edit' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{ width: '100%', padding: '14px 18px', border: 'none', borderRadius: 14, background: '#fff', color: '#1a2e2a', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'right', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {item.label} <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
            </button>
          ))}
          <button onClick={handleLogout} style={{ width: '100%', padding: '14px 18px', border: '1.5px solid #fecaca', borderRadius: 14, background: '#fff', color: '#ef4444', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
            🚪 התנתקות
          </button>

          {/* ── Install App ── always visible when installation is available */}
          {installAvailable && (
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => installIsIos ? setShowIosInstructions(v => !v) : triggerInstall()}
                style={{
                  width: '100%', padding: '14px 18px',
                  border: 'none', borderRadius: 14,
                  background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                  color: '#fff', fontFamily: 'Heebo, sans-serif',
                  fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(13,158,110,0.3)',
                }}
              >
                <span style={{ fontSize: 18 }}>{installToggleIcon}</span>
                <span>📲 התקנת האפליקציה</span>
              </button>

              {/* iOS step-by-step instructions (toggled) */}
              {installIsIos && showIosInstructions && (
                <div style={{
                  marginTop: 8, background: '#fff', borderRadius: 14,
                  padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                  direction: 'rtl',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1a2e2a', marginBottom: 10 }}>
                    הוספה למסך הבית ב-iOS:
                  </div>
                  {[
                    { icon: '⬆️', text: 'לחץ על כפתור השיתוף בסרגל התחתון' },
                    { icon: '➕', text: 'גלול למטה ובחר "הוסף למסך הבית"' },
                    { icon: '✅', text: 'לחץ "הוסף" לאישור' },
                  ].map((step, i) => (
                    <div key={step.text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0d9e6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: '#374151', flex: 1 }}>
                        <span style={{ marginLeft: 4 }}>{step.icon}</span>{step.text}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                    פועל ב-Safari — Chrome ב-iOS אינו תומך בהתקנה
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}