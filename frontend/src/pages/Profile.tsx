// src/pages/Profile.tsx
//
// PERFORMANCE OPTIMIZATIONS:
//  1. Removed the all-or-nothing loading gate: previously the page waited for
//     profile + reports + reviews to ALL resolve before rendering anything.
//     Now the header renders as soon as the profile arrives (fastest query),
//     and the activity section fills in progressively.
//  2. Reduced reviews/reports fetch from 50 rows to 10 (service also capped).
//  3. "select: data => data.slice(0, 3)" no longer needed since the server
//     already returns ≤10; kept for safety.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type UserProfile, type CommunityReport, type Review } from '../api';
import { useAuth } from '../context/AuthContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

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

// Skeleton placeholder for progressive rendering
function SkeletonLine({ width = '100%', height = 14, style = {} }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width, height, borderRadius: 6, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', ...style }} />
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { available: installAvailable, isIos: installIsIos, triggerInstall } = useInstallPrompt();
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  let installToggleIcon = '›';
  if (installIsIos) { installToggleIcon = showIosInstructions ? '▲' : '▼'; }

  // ── OPTIMIZATION: three independent queries, not a single blocking gate ──
  // Profile loads fastest (single row from users table + server cache).
  // Reports and reviews load independently; the page renders progressively.
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

  const handleLogout = () => { logout(); navigate('/Login'); };

  if (!user && !profileLoading) {
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

  // ── Only block on the profile itself (the header); sub-sections render progressively ──
  if (profileLoading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>
        <div style={{ height: 120, background: 'linear-gradient(135deg, #0d9e6e 0%, #34d399 60%, #0284c7 100%)' }} />
        <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', paddingBottom: 20 }}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ transform: 'translateY(-32px)', marginBottom: -16 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e2e8f0' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              <SkeletonLine width={160} height={20} />
              <SkeletonLine width={100} height={14} />
              <SkeletonLine width="100%" height={6} style={{ marginTop: 8, borderRadius: 999 }} />
            </div>
          </div>
        </div>
        <style>{`@keyframes shimmer { to { background-position: -200% 0; } }`}</style>
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
                ? <img src={profile.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
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
        {/* Stats */}
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

        {/* Recent activity — progressive: shows skeleton while loading */}
        {reportsLoading ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
            <SkeletonLine width={160} height={15} style={{ marginBottom: 12 }} />
            {[1, 2, 3].map(i => <SkeletonLine key={i} height={32} style={{ marginBottom: 8, borderRadius: 8 }} />)}
          </div>
        ) : recentReports.length > 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>הדיווחים האחרונים שלי</div>
            {recentReports.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', direction: 'rtl' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{r.poi_name || 'מיקום לא ידוע'}</span>
                <span style={{ fontSize: 11, background: '#fffbeb', color: '#d97706', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{r.report_type}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {user?.is_admin && (
            <button onClick={() => navigate('/Admin')} style={{ width: '100%', padding: '14px 18px', border: '2px solid #7c3aed', borderRadius: 14, background: 'linear-gradient(135deg, #faf5ff, #ede9fe)', color: '#6d28d9', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'right', boxShadow: '0 2px 8px rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c3aed', fontSize: 18 }}>›</span>
              <span>🛡️ לוח ניהול</span>
            </button>
          )}
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
      <style>{`@keyframes shimmer { to { background-position: -200% 0; } }`}</style>
    </div>
  );
}
