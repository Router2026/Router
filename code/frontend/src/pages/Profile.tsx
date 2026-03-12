import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  // Get user state and logout function from context
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  // Added setter for reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch user-specific data only if the user is logged in
  useEffect(() => {
    if (!user) return;

    setLoadingData(true);
    // Fetch profile, trips, and reviews concurrently
    Promise.all([
      base44.entities.UserProfile.filter(),
      base44.entities.Trip.filter(),
      base44.entities.Review.filter()
    ]).then(([profileData, tripsData, reviewsData]) => {
      if (profileData.length > 0) setProfile(profileData[0]);
      setTrips(tripsData);
      setReviews(reviewsData); // Set fetched reviews
    }).catch(err => {
      console.error("Error fetching profile data:", err);
    }).finally(() => {
      setLoadingData(false);
    });
  }, [user]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/Login');
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // ── Unauthenticated View ──────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>אינך מחובר</div>
        <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24, maxWidth: 280 }}>
          כדי לראות את הפרופיל, המסלולים וההתקדמות שלך, אנא התחבר לחשבון.
        </div>
        <button onClick={() => navigate('/Login')} style={{
          padding: '12px 32px', border: 'none', borderRadius: 16,
          background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
          color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 14px rgba(13,158,110,0.3)'
        }}>
          התחבר עכשיו
        </button>
      </div>
    );
  }

  // ── Authenticated View ────────────────────────────────────────────
  const xp = profile?.xp_points ?? 0;
  const nextLevelXP = 100;
  const progress = Math.min((xp / nextLevelXP) * 100, 100);
  const level = profile?.level || 'מטייל מתחיל';

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>

      {/* ── Top header (Full Width) ─────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', width: '100%' }}>
        <div style={{
          maxWidth: 600, margin: '0 auto', padding: '24px 20px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0d9e6e, #34d399)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff', fontWeight: 800,
            }}>
              {user.full_name?.charAt(0) || user.email?.charAt(0) || 'ע'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a' }}>{user.full_name || 'משתמש'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, marginTop: 3 }}>
                <span>· {level}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#0d9e6e', fontWeight: 700 }}>
                  ⚡ {xp} XP
                </span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button onClick={handleLogout} style={{
            background: '#fef2f2', border: 'none', borderRadius: 10, padding: '8px 12px',
            color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif'
          }}>
            התנתק
          </button>
        </div>
      </div>

      {/* ── Main Content Container (Centered) ─────────────────────────── */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

        {loadingData ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>טוען נתונים...</div>
        ) : (
          <>
            {/* ── Stats row ─────────────────────────────────────── */}
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10, background: '#fff', borderRadius: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)', padding: '16px',
              }}>
                {[
                  { label: 'מסלולים', value: profile?.trips_count ?? trips.length, icon: '↔️', color: '#0d9e6e' },
                  { label: 'ביקורות', value: profile?.reviews_count ?? reviews.length, icon: '💬', color: '#0891b2' },
                  { label: 'דיווחים', value: profile?.reports_count ?? 0, icon: '⚠️', color: '#f59e0b' },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#1a2e2a', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── My Trips + My Reviews ──────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 16px 0' }}>

              {/* My Trips */}
              <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ color: '#94a3b8' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="6" r="2" /><path d="M5 8v12" /><circle cx="19" cy="18" r="2" /><path d="M19 16V4" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>המסלולים שלי</span>
                </div>
                <div>
                  {trips.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>אין מסלולים עדיין</div>
                  ) : (
                    trips.slice(0, 4).map(t => (
                      <div key={t.id} onClick={() => navigate(`/TripDetail?id=${t.id}`)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: '#f0fdf8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                        <div style={{ textAlign: 'right', flex: 1, paddingRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a', lineHeight: 1.3 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.region}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Reviews */}
              <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ color: '#94a3b8' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>הביקורות שלי</span>
                </div>
                <div>
                  {reviews.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, color: '#94a3b8' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.4 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span style={{ fontSize: 13, opacity: 0.6 }}>אין ביקורות</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {reviews.slice(0, 3).map((r, index) => {
                        const rating = r.rating || 5;
                        const emptyStars = 5 - rating;
                        return (
                          <div key={r.id || index} style={{ paddingBottom: 8, borderBottom: '1px solid #f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: '#f59e0b', fontSize: 10 }}>
                              {'★'.repeat(rating)}{'☆'.repeat(emptyStars)}
                            </div>
                            <div style={{ fontSize: 12, color: '#1a2e2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.content || r.text || 'ביקורת ללא טקסט'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Progress / Gamification ───────────────────────── */}
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ background: '#fff', borderRadius: 20, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a' }}>התקדמות</span>
                </div>

                {/* Level + avatar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>{nextLevelXP} XP לדרגה הבאה</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>{level}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>XP {xp}</div>
                    </div>
                    <div style={{ fontSize: 28 }}>🦊</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, background: '#f0f4f3', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: 'linear-gradient(90deg, #0d9e6e, #34d399)',
                    borderRadius: 4, transition: 'width 0.6s ease',
                  }} />
                </div>

                {/* XP methods */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'מסלול שהושלם', xp: 'XP 20+', color: '#0d9e6e', bg: '#f0fdf8' },
                    { label: 'כתיבת ביקורת', xp: 'XP 15+', color: '#0284c7', bg: '#eff6ff' },
                    { label: 'העלאת וידאו', xp: 'XP 10+', color: '#d97706', bg: '#fffbeb' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: item.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.xp}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Action buttons ────────────────────────────────── */}
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* AI planner */}
          <button onClick={() => navigate('/TripPlanner')} style={{
            background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
            border: 'none', borderRadius: 18, padding: '0 20px',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 72, overflow: 'hidden', position: 'relative',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>שילוב AI למסלולים</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>צור מסלול מותאם אישית עם AI</div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22 }}>✨</span>
            </div>
          </button>

          {/* Community */}
          <button onClick={() => navigate('/CommunityVideos')} style={{
            background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
            border: 'none', borderRadius: 18, padding: '0 20px',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 72,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>פיתוח קהילה</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>שתף וידאו, דווח ותרום לקהילה</div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}