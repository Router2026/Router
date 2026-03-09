import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/* ── inline SVG nav icons ────────────────────────────────────── */
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#0d9e6e' : 'none'}
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const MapIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);
const RouteIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="6" r="2"/><path d="M5 8v12"/>
    <circle cx="19" cy="18" r="2"/><path d="M19 16V4"/>
    <path d="M5 14h8a2 2 0 0 0 2-2V8"/><path d="M19 10h-8a2 2 0 0 1-2-2"/>
  </svg>
);
const VideoIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);
const AlertIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const PersonIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#0d9e6e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const NAV_ITEMS = [
  { label: 'בית',     value: 'Home',            Icon: HomeIcon },
  { label: 'מפה',     value: 'MapView',         Icon: MapIcon },
  { label: 'מסלול',  value: 'TripPlanner',     Icon: RouteIcon },
  { label: 'וידאו',  value: 'CommunityVideos', Icon: VideoIcon },
  { label: 'דיווחים',value: 'Reports',         Icon: AlertIcon },
  { label: 'פרופיל', value: 'Profile',         Icon: PersonIcon },
];

/** Pages where bottom nav is hidden */
const HIDE_NAV = new Set(['TripDetail', 'POIDetail', 'AddReport', 'AddReview', 'UploadVideo']);

export default function Layout({ children, currentPageName }: { children: React.ReactNode; currentPageName: string }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const showNav   = !HIDE_NAV.has(currentPageName);
  const currentPath = location.pathname.substring(1) || 'Home';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <main style={{ flex: 1, paddingBottom: showNav ? 72 : 0, width: '100%', overflowX: 'hidden' }}>
        {children}
      </main>

      {showNav && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2000,
          background: '#fff',
          borderTop: '1px solid #e8f5f1',
          boxShadow: '0 -4px 20px rgba(13,158,110,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            maxWidth: 640, margin: '0 auto', padding: '6px 0 4px',
          }}>
            {NAV_ITEMS.map(({ label, value, Icon }) => {
              const active = currentPath === value || (currentPath === '' && value === 'Home');
              return (
                <button key={value} onClick={() => navigate(`/${value}`)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '5px 10px', borderRadius: 12, minWidth: 44,
                }}>
                  <div style={{
                    width: 38, height: 32, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', borderRadius: 10,
                    background: active ? '#e8f9f3' : 'transparent', transition: 'all 0.2s',
                  }}>
                    <Icon active={active} />
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? '#0d9e6e' : '#94a3b8',
                    fontFamily: 'Heebo, sans-serif',
                  }}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
