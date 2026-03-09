import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REGIONS = [
  { name: 'גולן', icon: '🏔️', color: '#16a34a' },
  { name: 'גליל עליון', icon: '🌲', color: '#15803d' },
  { name: 'כרמל', icon: '🌿', color: '#65a30d' },
  { name: 'ירושלים', icon: '🕌', color: '#f59e0b' },
  { name: 'נגב', icon: '🏜️', color: '#ef4444' },
  { name: 'אילת', icon: '🏖️', color: '#0284c7' },
];

const CATEGORIES = [
  { name: 'מסלולי מים', icon: '💧', color: '#0891b2', bg: '#eff6ff' },
  { name: 'תצפיות', icon: '⛰️', color: '#d97706', bg: '#fffbeb' },
  { name: 'היסטוריה', icon: '🏛️', color: '#7c3aed', bg: '#faf5ff' },
  { name: 'משפחות', icon: '👨‍👩‍👧', color: '#0d9e6e', bg: '#f0fdf8' },
  { name: 'ג׳יפים', icon: '🚙', color: '#dc2626', bg: '#fef2f2' },
  { name: 'צילום', icon: '📸', color: '#6366f1', bg: '#eef2ff' },
];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl', width: '100%' }}>

      {/* ── Hero (Full Width) ───────────────────────────────────────── */}
      <div style={{
        position: 'relative', height: 280, overflow: 'hidden', width: '100%',
        backgroundImage: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200)',
        backgroundSize: 'cover', backgroundPosition: 'center 40%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(13,158,110,0.85) 0%, rgba(11,186,126,0.65) 100%)',
        }} />

        {/* Content Inside Hero (Centered) */}
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 2, padding: '50px 24px 0', textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>
            🧭 Router
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.88)', marginBottom: 28 }}>
            גלה מסלולים ייחודיים בטבע ישראל
          </div>

          {/* Search bar */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: '12px 18px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') navigate('/Explore'); }}
              placeholder="חפש מסלול, אתר, אזור..."
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 15,
                fontFamily: 'Heebo, sans-serif', color: '#1a2e2a', background: 'transparent',
                textAlign: 'right',
              }}
            />
            <button onClick={() => navigate('/Explore')} style={{
              background: '#0d9e6e', border: 'none', borderRadius: 12, padding: '8px 16px',
              cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 14,
              fontFamily: 'Heebo, sans-serif',
            }}>חפש</button>
          </div>
        </div>
      </div>

      {/* ── Main Content Container (Centered & Constrained) ─────────── */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 120 }}>

        {/* ── Quick Stats ───────────────────────────────── */}
        <div style={{ padding: '0 16px', marginTop: -20, position: 'relative', zIndex: 10 }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '18px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center',
          }}>
            {[
              { value: '200+', label: 'מסלולים', icon: '🗺️' },
              { value: '13', label: 'אזורים', icon: '📍' },
              { value: '4.8★', label: 'דירוג ממוצע', icon: '⭐' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Categories ────────────────────────────────── */}
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={() => navigate('/Explore')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0d9e6e', fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>הכל</button>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>קטגוריות</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.name} onClick={() => navigate('/Explore')} style={{
                background: '#fff', border: 'none', borderRadius: 18, padding: '16px 10px',
                cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                fontFamily: 'Heebo, sans-serif',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: cat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>{cat.icon}</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a' }}>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Region Grid ───────────────────────────────── */}
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={() => navigate('/MapView')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0d9e6e', fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>במפה</button>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>אזורים מומלצים</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {REGIONS.map(region => (
              <button key={region.name} onClick={() => navigate('/MapView')} style={{
                background: '#fff', border: 'none', borderRadius: 18, overflow: 'hidden',
                cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', textAlign: 'right',
                fontFamily: 'Heebo, sans-serif', padding: 0,
              }}>
                <div style={{
                  height: 90, background: `linear-gradient(135deg, ${region.color}dd, ${region.color}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
                }}>{region.icon}</div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>{region.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>לחץ לצפייה באתרים</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────── */}
        <div style={{ padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => navigate('/TripPlanner')} style={{
            background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
            border: 'none', borderRadius: 18, padding: '18px 20px',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>✨ בנה מסלול עם AI</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>מסלול מותאם אישית בלחיצה אחת</div>
            </div>
            <div style={{ fontSize: 28 }}>🤖</div>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => navigate('/MyTrips')} style={{
              background: '#fff', border: 'none', borderRadius: 18, padding: '16px',
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>המסלולים שלי</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>הצג מסלולים שמורים</div>
            </button>
            <button onClick={() => navigate('/Reports')} style={{
              background: '#fff', border: 'none', borderRadius: 18, padding: '16px',
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>דיווחים</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>מה קורה בשטח</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}