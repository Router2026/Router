import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type POI } from '../api';
import { getImageUrl } from '../utils/imageUtils';
import { useFeaturedLocations, useRegions, useNearbyUserLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { useGuestLock, LockBadge } from '../components/LockedFeature';

const CATEGORIES = [
  { name: 'מסלולי מים', icon: '💧', color: '#0891b2', bg: '#eff6ff', key: 'נחל' },
  { name: 'תצפיות', icon: '⛰️', color: '#d97706', bg: '#fffbeb', key: 'מצפה' },
  { name: 'היסטוריה', icon: '🏛️', color: '#7c3aed', bg: '#faf5ff', key: 'אתר היסטורי' },
  { name: 'משפחות', icon: '👨‍👩‍👧', color: '#0d9e6e', bg: '#f0fdf8', key: 'טבע' },
  { name: "ג'יפים", icon: '🚙', color: '#dc2626', bg: '#fef2f2', key: 'גיאולוגיה' },
  { name: 'צילום', icon: '📸', color: '#6366f1', bg: '#eef2ff', key: 'מצפה' },
];

const REGION_ICONS: Record<string, string> = {
  'גולן': '🏔️', 'גליל עליון': '🌲', 'גליל תחתון': '💧',
  'כרמל': '🌿', 'עמק יזרעאל': '🌾', 'שרון': '🌸',
  'מרכז': '🏙️', 'ירושלים': '🕌', 'יהודה ושומרון': '⛰️',
  'דרום': '🏜️', 'נגב': '🏜️', 'ערבה': '🌵', 'אילת': '🏖️',
};

const CATEGORY_COLORS: Record<string, string> = {
  'נחל': '#0891b2', 'מצפה': '#d97706', 'אתר היסטורי': '#7c3aed',
  'טבע': '#0d9e6e', 'גיאולוגיה': '#dc2626', 'חוף': '#0ea5e9',
  'גן לאומי': '#16a34a', 'מדבר': '#b45309',
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מ'`;
  return `${(meters / 1000).toFixed(1)} ק"מ`;
}

// ── Shared place card ────────────────────────────────────────────────────────
interface PlaceCardProps {
  poi: POI | NearbyPOI;
  badge?: React.ReactNode;
  onClick: () => void;
}

function PlaceCard({ poi, badge, onClick }: Readonly<PlaceCardProps>) {
  const color = CATEGORY_COLORS[poi.category] || '#0d9e6e';
  const img = poi.main_image || poi.images?.[0];
  const getCategoryEmoji = () => {
    if (poi.category.includes('נחל')) return '💧';
    if (poi.category.includes('מצפה')) return '⛰️';
    if (poi.category.includes('היסטור')) return '🏛️';
    return '🌿';
  };
  const categoryEmoji = getCategoryEmoji();

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: 160, background: '#fff', border: 'none',
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 3px 14px rgba(0,0,0,0.09)', fontFamily: 'Heebo, sans-serif',
        textAlign: 'right', padding: 0, transition: 'transform 0.15s', position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{
        height: 100, position: 'relative', overflow: 'hidden',
        background: img ? '#e2e8f0' : `linear-gradient(135deg, ${color}dd, ${color}66)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {img && (
          <img src={getImageUrl(img, 'card')} alt={poi.name}
            loading="lazy" decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.onerror = null; }}
          />
        )}
        {!img && <span style={{ fontSize: 36 }}>{categoryEmoji}</span>}
        {badge && <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>{badge}</div>}
        {poi.average_rating > 0 && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8, zIndex: 1,
            background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '2px 8px',
            fontSize: 11, color: '#fff', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            ⭐ {poi.average_rating.toFixed(1)}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: '#1a2e2a', lineHeight: 1.3, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {poi.name}
        </div>
        <div style={{
          display: 'inline-block',
          background: `${color}18`, color,
          fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '2px 7px',
        }}>
          {poi.category}
        </div>
      </div>
    </button>
  );
}

// ── Horizontal scroll row ────────────────────────────────────────────────────
// Horizontal scroll row
// ── Horizontal scroll row ────────────────────────────────────────────────────
function HScrollRow({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="pretty-scroll"
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 12,
        WebkitOverflowScrolling: 'touch',
        paddingRight: 16,
        paddingLeft: 16,
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent'
      }}
    >
      <style>{`
        .pretty-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .pretty-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .pretty-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .pretty-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {children}
    </div>
  );
}

// ── Skeleton placeholder ─────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ flexShrink: 0, width: 160, borderRadius: 20, overflow: 'hidden', background: '#f1f5f9' }}>
      <div style={{ height: 100, background: '#e2e8f0' }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 6, width: '60%' }} />
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string; icon?: string; actionLabel?: string; onAction?: () => void;
}
function SectionHeader({ title, icon, actionLabel, onAction }: Readonly<SectionHeaderProps>) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, padding: '0 16px',
    }}>
      {actionLabel && onAction
        ? <button onClick={onAction} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0d9e6e', fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>{actionLabel}</button>
        : <span />
      }
      <span style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>
        {icon && <span style={{ marginLeft: 6 }}>{icon}</span>}
        {title}
      </span>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function buildExploreUrl(search: string) {
  const qs = search ? `?q=${encodeURIComponent(search)}` : '';
  return `/Explore${qs}`;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, isGuest } = useAuth();
  const plannerLock = useGuestLock('יצירת מסלול AI');

  const [search, setSearch] = useState('');

  // ── React Query hooks — data is cached across navigations ────────────────
  // Navigating away and back will show cached data instantly;
  // a background refetch only happens after staleTime (5 min for nearby,
  // 15 min for featured, 60 min for regions — see useLocations.ts).
  const { data: regions = [] } = useRegions();
  const { data: featured = [], isLoading: featuredLoading } = useFeaturedLocations(10);
  const { data: nearby = [], isLoading: nearbyLoading,
    geoError: locationError } = useNearbyUserLocations(10, 30000);

  const handleSearchNavigate = () => navigate(buildExploreUrl(search));

  const displayRegions = regions.slice(0, 6);

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl', width: '100%' }}>

      {/* ── Hero ── */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden', width: '100%', backgroundImage: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200)', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(13,158,110,0.85) 0%, rgba(11,186,126,0.65) 100%)' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 2, padding: '50px 24px 0', textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>🧭 Router</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.88)', marginBottom: 28 }}>גלה מסלולים ייחודיים בטבע ישראל</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearchNavigate(); }}
              placeholder="חפש מסלול, אתר, אזור..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'Heebo, sans-serif', color: '#1a2e2a', background: 'transparent', textAlign: 'right' }} />
            <button onClick={handleSearchNavigate}
              style={{ background: '#0d9e6e', border: 'none', borderRadius: 12, padding: '8px 16px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'Heebo, sans-serif' }}>חפש</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 120 }}>

        {/* ── Main Action Cards ── */}
        <div style={{ padding: '0 16px', marginTop: -30, position: 'relative', zIndex: 10, display: 'flex', gap: 16, marginBottom: 28 }}>
          <button
            disabled
            onClick={() => plannerLock.guardAction(() => navigate('/TripPlanner'))}
            aria-label={isGuest ? 'תכנון מסלול AI — דרוש חשבון' : 'תכנון מסלול'}
            style={{ position: 'relative', overflow: 'hidden', flex: 1, background: isGuest ? '#f8fafc' : '#fff', border: isGuest ? '1.5px dashed #cbd5e1' : 'none', borderRadius: 16, padding: '20px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 130, boxShadow: isGuest ? 'none' : '0 4px 20px rgba(0,0,0,0.08)', transition: 'transform 0.15s', opacity: isGuest ? 0.8 : 1 }}
            onMouseEnter={e => { if (!isGuest) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {isGuest
              ? <div style={{ position: 'absolute', top: 10, left: 10 }}><LockBadge label="דרוש חשבון" /></div>
              : <div aria-hidden="true" style={{ position: 'absolute', top: 16, left: -30, background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 900, padding: '4px 34px', transform: 'rotate(-45deg)', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>בקרוב</div>
            }
            <div style={{ background: isGuest ? '#94a3b8' : '#10b981', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
              {isGuest
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
              }
            </div>
            <div style={{ textAlign: 'right', width: '100%', marginTop: 'auto' }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: isGuest ? '#94a3b8' : '#1e293b', marginBottom: 2 }}>תכנון מסלול</div>
              <div style={{ fontSize: 13, color: isGuest ? '#cbd5e1' : '#64748b' }}>{isGuest ? 'הרשמה נדרשת' : 'AI יוצר לך מסלול מושלם'}</div>
            </div>
          </button>
          {plannerLock.PromptComponent}

          <button
            data-tour="nav-explore"
            onClick={() => navigate('/Explore')}
            style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 16, padding: '20px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 130, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', transition: 'transform 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{ background: '#6366f1', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <div style={{ textAlign: 'right', width: '100%', marginTop: 'auto' }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1e293b', marginBottom: 2 }}>גילוי אתרים</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>חפש וגלה מקומות חדשים</div>
            </div>
          </button>
        </div>

        {/* ══════════════════════════════════════════
            ── ⭐ Featured Places ──────────────────
            ══════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="מקומות מומלצים" icon="⭐" actionLabel="הכל" onAction={() => navigate('/Explore')} />
          {featuredLoading && (
            <HScrollRow>{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</HScrollRow>
          )}
          {!featuredLoading && featured.length > 0 && (
            <HScrollRow>
              {featured.map(poi => (
                <PlaceCard
                  key={poi.id}
                  poi={poi}
                  badge={
                    <div style={{
                      background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                      borderRadius: 20, padding: '3px 8px', fontSize: 10,
                      color: '#fff', fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: 3,
                      boxShadow: '0 2px 8px rgba(245,158,11,0.45)',
                    }}>
                      ✨ מומלץ
                    </div>
                  }
                  onClick={() => navigate(`/POIDetail?id=${poi.id}`)}
                />
              ))}
            </HScrollRow>
          )}
          {!featuredLoading && featured.length === 0 && (
            <p style={{ padding: '0 16px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
              אין מקומות מומלצים כרגע
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════
            ── 📍 Nearby Places ────────────────────
            ══════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader
            title="קרוב אליך"
            icon="📍"
            actionLabel={nearby.length > 0 ? 'במפה' : undefined}
            onAction={() => navigate('/MapView')}
          />
          {nearbyLoading && (
            <HScrollRow>{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</HScrollRow>
          )}
          {!nearbyLoading && nearby.length > 0 && (
            <HScrollRow>
              {nearby.map(poi => (
                <PlaceCard
                  key={poi.id}
                  poi={poi}
                  badge={
                    <div style={{
                      background: 'rgba(13,158,110,0.88)',
                      borderRadius: 20, padding: '3px 8px',
                      fontSize: 10, color: '#fff', fontWeight: 800,
                      backdropFilter: 'blur(4px)',
                    }}>
                      📍 {formatDistance((poi as NearbyPOI).distance_meters)}
                    </div>
                  }
                  onClick={() => navigate(`/POIDetail?id=${poi.id}`)}
                />
              ))}
            </HScrollRow>
          )}
          {!nearbyLoading && nearby.length === 0 && locationError && (
            <div style={{
              margin: '0 16px', background: '#fff', borderRadius: 18,
              padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 32 }}>📍</div>
              <div style={{ textAlign: 'right', flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', marginBottom: 3 }}>גלה אתרים קרובים אליך</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>אפשר גישה למיקום כדי לראות מה קרוב אליך</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Recommended Regions ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="אזורים מומלצים" actionLabel="במפה" onAction={() => navigate('/MapView')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 16px' }}>
            {displayRegions.map(region => (
              <button key={region.id} onClick={() => navigate(`/MapView?region=${encodeURIComponent(region.name)}&lat=${region.center_lat}&lng=${region.center_lng}&zoom=${region.zoom}`)}
                style={{ background: '#fff', border: 'none', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', textAlign: 'right', fontFamily: 'Heebo, sans-serif', padding: 0, transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ height: 90, background: `linear-gradient(135deg, ${region.color}dd, ${region.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>
                  {REGION_ICONS[region.name] || '📍'}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>{region.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>לחץ לצפייה במפה 🗺️</div>
                </div>
              </button>
            ))}
            {displayRegions.length === 0 && [1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: '#f1f5f9', borderRadius: 18, height: 148 }} />
            ))}
          </div>
        </div>

        {/* ── Categories ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="קטגוריות" actionLabel="הכל" onAction={() => navigate('/Explore')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 16px' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.name}
                onClick={() => navigate(`/Explore?category=${encodeURIComponent(cat.key)}`)}
                style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '16px 10px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'Heebo, sans-serif', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{cat.icon}</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a' }}>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => navigate('/RouteGenerator')}
            style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', borderRadius: 18, padding: '18px 20px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>🗺️ בנה מסלול עצמאי</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>בחר אתרים וצור מסלול מותאם</div>
            </div>
            <div style={{ fontSize: 28 }}>📍</div>
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => navigate('/MyTrips')}
              style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '16px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>המסלולים שלי</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>הצג מסלולים שמורים</div>
            </button>
            {isLoggedIn ? (
              <button onClick={() => navigate('/AddReport')}
                style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '16px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>הוסף דיווח</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>מה קורה בשטח</div>
              </button>
            ) : (
              <button onClick={() => navigate('/Reports')}
                style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '16px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a' }}>דיווחים</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>מה קורה בשטח</div>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}