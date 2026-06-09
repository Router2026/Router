import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type POI, geocodeCity, haversineDistance, type GeocodedCity } from '../api';
import RouterLogo from '../assets/logo.jpeg';
import { useTripBucket } from '../context/TripBucketContext';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import TripBucketFab from '../components/TripBucketFab';
import TripBucketSheet from '../components/TripBucketSheet';
import { useGuestLock } from '../components/LockedFeature';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['קל', 'בינוני', 'מאתגר', 'אקסטרים'];
const PAGE_SIZE = 40;
// City-mode fetches a larger page so the radius filter has enough candidates.
// Offsets for subsequent city pages must use this constant, not PAGE_SIZE.
const CITY_PAGE_SIZE = 200;
// City search: show POIs within this radius of the geocoded city centre
const CITY_RADIUS_METERS = 30000;

const DIFF_COLORS: Record<string, { color: string; bg: string }> = {
  'קל': { color: '#16a34a', bg: '#f0fdf4' },
  'בינוני': { color: '#d97706', bg: '#fffbeb' },
  'מאתגר': { color: '#dc2626', bg: '#fef2f2' },
  'קשה': { color: '#dc2626', bg: '#fef2f2' },
  'אקסטרים': { color: '#7c3aed', bg: '#faf5ff' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function TagGrid({ items, selected, onToggle }: Readonly<{
  items: string[]; selected: string[]; onToggle: (v: string) => void;
}>) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => {
        const active = selected.includes(item);
        return (
          <button key={item} onClick={() => onToggle(item)} style={{
            padding: '6px 12px', borderRadius: 20,
            border: `2px solid ${active ? '#0d9e6e' : '#e2e8f0'}`,
            background: active ? '#0d9e6e' : '#fff',
            color: active ? '#fff' : '#64748b',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
          }}>
            {item}
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({
  open, onClose,
  selectedRegions, setSelectedRegions,
  selectedCategories, setSelectedCategories,
  selectedDifficulties, setSelectedDifficulties,
  hasWater, setHasWater, hasShade, setHasShade, accessible, setAccessible,
  dynamicRegions, dynamicCategories,
  sortByProximity, handleProximityToggle, geoLoading, geoError,
}: Record<string, unknown>) {
  if (!open) return null;
  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  let proximityBorderColor: string;
  if (sortByProximity) { proximityBorderColor = '#0d9e6e'; }
  else if (geoError) { proximityBorderColor = '#ef4444'; }
  else { proximityBorderColor = '#e2e8f0'; }

  let proximityTextColor: string;
  if (sortByProximity) { proximityTextColor = '#0d9e6e'; }
  else if (geoError) { proximityTextColor = '#ef4444'; }
  else { proximityTextColor = '#64748b'; }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-start' }}>
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, background: '#fff', overflowY: 'auto', padding: '24px 20px', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={() => {
            setSelectedRegions([]); setSelectedCategories([]); setSelectedDifficulties([]);
            setHasWater(false); setHasShade(false); setAccessible(false);
            if (sortByProximity) handleProximityToggle();
          }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'Heebo, sans-serif' }}>
            נקה הכל
          </button>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>סינון ומיון</div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <FilterSection title="מיון">
          <button onClick={handleProximityToggle} disabled={geoLoading} style={{
            width: '100%', padding: '10px 14px', borderRadius: 12,
            border: `2px solid ${proximityBorderColor}`,
            background: sortByProximity ? '#f0fdf8' : '#fff',
            color: proximityTextColor,
            fontSize: 14, fontWeight: 700, cursor: geoLoading ? 'wait' : 'pointer',
            fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {geoLoading
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>
              }
              {geoLoading ? 'מאתר מיקום...' : 'מיין לפי קרבה אליי'}
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sortByProximity ? '#0d9e6e' : '#cbd5e1'}`, background: sortByProximity ? '#0d9e6e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {sortByProximity && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
          </button>
          {geoError && <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ {geoError}</div>}
        </FilterSection>

        <FilterSection title="אזור">
          <TagGrid items={dynamicRegions || []} selected={selectedRegions} onToggle={v => toggle(selectedRegions, setSelectedRegions, v)} />
        </FilterSection>
        <FilterSection title="סוג אתר">
          <TagGrid items={dynamicCategories || []} selected={selectedCategories} onToggle={v => toggle(selectedCategories, setSelectedCategories, v)} />
        </FilterSection>
        <FilterSection title="רמת קושי">
          <TagGrid items={DIFFICULTIES} selected={selectedDifficulties} onToggle={v => toggle(selectedDifficulties, setSelectedDifficulties, v)} />
        </FilterSection>
        <FilterSection title="מאפיינים">
          {[
            { label: 'יש מים', state: hasWater, set: setHasWater },
            { label: 'יש צל', state: hasShade, set: setHasShade },
            { label: 'נגיש לעגלות', state: accessible, set: setAccessible },
          ].map(f => (
            <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: 'pointer', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 14, color: '#1a2e2a' }}>{f.label}</span>
              <button type="button" onClick={() => f.set(!f.state)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${f.state ? '#0d9e6e' : '#cbd5e1'}`, background: f.state ? '#0d9e6e' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', padding: 0 }}>
                {f.state && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
            </label>
          ))}
        </FilterSection>
      </div>
    </div>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} מ'`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} ק"מ`;
  return `${Math.round(m / 1000)} ק"מ`;
}

// ── Module-level fetch helpers (reduce fetchPage cognitive complexity) ─────────

function mapRawToPoi(raw: Record<string, unknown>): POI {
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? '',
    category: raw.category,
    region: (raw.region_name ?? raw.region ?? '') as string,
    region_id: raw.region_id,
    latitude: raw.latitude,
    longitude: raw.longitude,
    images: raw.images ?? [],
    main_image: raw.main_image ?? '',
    difficulty: raw.difficulty ?? 'בינוני',
    duration_minutes: raw.duration_minutes,
    has_water: raw.has_water,
    has_shade: raw.has_shade,
    accessible: raw.accessible,
    is_featured: raw.is_featured,
    average_rating: raw.average_rating ?? 4,
    photo_credit: raw.photo_credit,
    uploaded_by: raw.uploaded_by,
    distance_meters: raw.distance_meters,
  } as POI;
}

function appendPoisDedup(prev: POI[], newPois: POI[], pageNum: number): POI[] {
  if (pageNum === 0) return newPois;
  const seen = new Set(prev.map(p => p.id));
  const unique = newPois.filter(p => !seen.has(p.id));
  return unique.length > 0 ? [...prev, ...unique] : prev;
}

// ── POICard ───────────────────────────────────────────────────────────────────

const POICard = React.memo(function POICard({ poi, onDelete }: Readonly<{ poi: POI; onDelete?: (id: string) => void }>) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const { addPoi, removePoi, hasPoi } = useTripBucket();
  const { user, isGuest } = useAuth();
  const diff = DIFF_COLORS[poi.difficulty] || DIFF_COLORS['קל'];
  const inBucket = hasPoi(poi.id);
  const bucketLock = useGuestLock('הוספה לסל המסלול');
  const favLock = useGuestLock('שמירת מועדפים');

  const handleBucketToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    bucketLock.guardAction(() => { if (inBucket) { removePoi(poi.id); } else { addPoi(poi); } });
  };
  const handleFavToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    favLock.guardAction(() => toggleFavorite(Number(poi.id)));
  };

  let bucketAriaLabel: string;
  let bucketBorderColor: string;
  let bucketBg: string;
  let bucketColor: string;
  let bucketLabel: React.ReactNode;
  if (isGuest) {
    bucketAriaLabel = 'הוספה לסל המסלול — דרוש חשבון';
    bucketBorderColor = '#e2e8f0';
    bucketBg = '#f8fafc';
    bucketColor = '#94a3b8';
    bucketLabel = <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> הוספה לסל — דרוש חשבון</>;
  } else if (inBucket) {
    bucketAriaLabel = 'הסר מסל המסלול';
    bucketBorderColor = '#0d9e6e';
    bucketBg = '#f0fdf8';
    bucketColor = '#0d9e6e';
    bucketLabel = <>✓ נוסף לסל המסלול</>;
  } else {
    bucketAriaLabel = 'הוסף לסל המסלול';
    bucketBorderColor = '#e2e8f0';
    bucketBg = '#f8fafc';
    bucketColor = '#64748b';
    bucketLabel = <>+ הוספה מהירה למסלול</>;
  }

  return (
    <button type="button" onClick={() => navigate(`/POIDetail?id=${poi.id}`)}
      style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'transform 0.15s ease', border: 'none', padding: 0, textAlign: 'right', display: 'block', width: '100%' }}>
      <div style={{ position: 'relative', height: 160 }}>
        <img src={poi.thumbnail || poi.main_image || RouterLogo} alt={poi.name}
          loading="lazy" decoding="async"
          onError={e => { e.currentTarget.src = RouterLogo; e.currentTarget.onerror = null; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

        {poi.photo_credit && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.92)', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: 'Heebo, sans-serif', direction: 'rtl', pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', lineHeight: 1.4 }}>
            צילום: {poi.photo_credit}
          </div>
        )}

        <button onClick={handleFavToggle} aria-label={isFavorite(poi.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          style={{ position: 'absolute', top: 10, right: 10, background: isGuest ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isGuest
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite(poi.id) ? '#ef4444' : 'none'} stroke={isFavorite(poi.id) ? '#ef4444' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          }
        </button>
        {favLock.PromptComponent}

        {user?.is_admin && onDelete && (
          <button onClick={e => { e.stopPropagation(); if (window.confirm(`למחוק את "${poi.name}"?`)) onDelete(poi.id); }}
            style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(220,38,38,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
          </button>
        )}
        <span style={{ position: 'absolute', bottom: 10, left: 10, background: '#fff', color: diff.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{poi.difficulty}</span>
      </div>

      <div style={{ padding: '14px 14px 16px', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>{poi.average_rating}</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a' }}>{poi.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <span style={{ fontSize: 12 }}>{poi.region}</span>
          </div>
          {poi.distance_meters !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9e6e', background: '#f0fdf4', borderRadius: 8, padding: '2px 8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 3 }}>
              📍 {formatDistance(poi.distance_meters)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {poi.duration_minutes && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 11 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>{poi.duration_minutes} דק'</div>}
          {poi.has_water && <div style={{ color: '#0284c7', fontSize: 11, fontWeight: 600 }}>💧 מים</div>}
          {poi.has_shade && <div style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>🌿 צל</div>}
        </div>
        <button onClick={handleBucketToggle}
          aria-label={bucketAriaLabel}
          style={{ marginTop: 10, width: '100%', padding: '7px', border: `1.5px solid ${bucketBorderColor}`, borderRadius: 10, background: bucketBg, color: bucketColor, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}>
          {bucketLabel}
        </button>
        {bucketLock.PromptComponent}
      </div>
    </button>
  );
});

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The single source of truth for what kind of fetch to perform.
 *
 * - 'normal'  : standard paginated fetch, passes `search=` to the server.
 * - 'city'    : city-mode fetch, fetches all POIs without a `search=` param
 *               so the client-side radius filter can narrow them down.
 */
type FetchMode = 'normal' | 'city';

// ── Main Explore page ─────────────────────────────────────────────────────────

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') || '';
  const urlQuery = searchParams.get('q') || '';

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState(urlQuery);
  const [selRegions, setSelRegions] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>(urlCategory ? [urlCategory] : []);
  const [selDiffs, setSelDiffs] = useState<string[]>([]);
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Server-side pagination ────────────────────────────────────────────────
  const [pois, setPois] = useState<POI[]>([]);
  const pageRef = useRef(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasMore = totalCount !== null ? pois.length < totalCount : true;

  // ── Filter dropdown data ──────────────────────────────────────────────────
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // ── Proximity sort (GPS) ──────────────────────────────────────────────────
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByProximity, setSortByProximity] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ── City geocoding state ──────────────────────────────────────────────────
  const [cityResult, setCityResult] = useState<GeocodedCity | null>(null);
  const [citySearching, setCitySearching] = useState(false);

  // ── Unified debounced search ──────────────────────────────────────────────
  // A single 400 ms debounce drives ALL search-triggered fetches. The
  // geocodeCity call happens inside the same pipeline, so the two timers
  // cannot race each other.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Guards ────────────────────────────────────────────────────────────────
  // fetchingRef: prevents concurrent duplicate fetches from IntersectionObserver.
  const fetchingRef = useRef(false);
  // abortRef: cancels in-flight requests when a reset (page=0) is triggered.
  const abortRef = useRef<AbortController | null>(null);
  // fetchModeRef: authoritative source for the current fetch strategy. Set
  // synchronously before any async work so a subsequent effect never reads stale.
  const fetchModeRef = useRef<FetchMode>('normal');
  // cityResultRef: mirrors cityResult so fetchPage can read it in callbacks
  // without depending on it as a reactive value.
  const cityResultRef = useRef<GeocodedCity | null>(null);
  // FIX 4 (City-mode infinite pagination): tracks whether the last city-mode
  // server page returned fewer items than CITY_PAGE_SIZE, meaning the server
  // has no more candidates. When true, the IntersectionObserver will not fire
  // any further page requests even though totalCount (server-side) may be high.
  const cityFetchExhaustedRef = useRef(false);

  // ── Fetch filter meta once ────────────────────────────────────────────────
  useEffect(() => {
    api.regions.list()
      .then(r => setRegions(r.map(reg => reg.name)))
      .catch(console.error);

    fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/locations/meta`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.categories) setCategories(data.categories); })
      .catch(console.error);
  }, []);

  // ── Core fetch ────────────────────────────────────────────────────────────
  // Reads fetchModeRef synchronously at call time so it always reflects the
  // intent of whichever code path triggered it.
  //
  // Returns the array of POIs that were fetched (or null on abort/error) so
  // the search effect can inspect the data without misusing setState as a
  // getter (FIX 2 — setPois-as-getter anti-pattern).
  //
  // FIX (Duplicate POIs): A dedupe guard using a Set<string> is applied
  // before appending to state, making append-mode safe even if the
  // IntersectionObserver fires while a fetch is in flight.
  const fetchPage = useCallback(async (
    pageNum: number,
    gpsCoords?: { lat: number; lng: number } | null,
  ): Promise<POI[] | null> => {
    if (pageNum > 0 && fetchingRef.current) return null;
    if (pageNum === 0) {
      abortRef.current?.abort();
      // Reset the city-exhaustion flag whenever we start a fresh fetch sequence.
      cityFetchExhaustedRef.current = false;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    // Snapshot the mode at the moment this fetch was initiated.
    const isCityFetch = fetchModeRef.current === 'city';
    let aborted = false;

    try {
      const qs = new URLSearchParams();
      if (selRegions[0]) qs.set('region', selRegions[0]);
      if (selCats[0]) qs.set('category', selCats[0]);
      if (selDiffs[0]) qs.set('difficulty', selDiffs[0]);
      if (hasWater) qs.set('has_water', 'true');
      if (hasShade) qs.set('has_shade', 'true');
      if (accessible) qs.set('accessible', 'true');
      // City fetches omit `search=` so the server returns unfiltered candidates
      // for the client-side radius pass. Normal fetches pass the search term.
      if (!isCityFetch && debouncedSearch.trim()) qs.set('search', debouncedSearch.trim());

      // FIX 1 (Offset over-fetch in city mode): limit and offset must use the
      // SAME page-size constant. City pages are CITY_PAGE_SIZE items wide, so
      // page 1 must start at offset 200, not 40.
      const effectivePageSize = isCityFetch ? CITY_PAGE_SIZE : PAGE_SIZE;
      qs.set('limit', String(effectivePageSize));
      qs.set('offset', String(pageNum * effectivePageSize));

      if (gpsCoords) {
        qs.set('user_lat', String(gpsCoords.lat));
        qs.set('user_lng', String(gpsCoords.lng));
      }

      const token = localStorage.getItem('router_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/locations?${qs}`,
        { headers, signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const total = res.headers.get('X-Total-Count');
      if (total) setTotalCount(Number.parseInt(total));

      const json = await res.json();
      const newPois: POI[] = (json.data ?? []).map((raw: Record<string, unknown>) => mapRawToPoi(raw));

      // Deduplicate by ID before updating state. Prevents double-appends from
      // concurrent observer triggers or re-renders.
      setPois(prev => appendPoisDedup(prev, newPois, pageNum));

      // FIX 4 (City-mode infinite pagination): if the server returned fewer
      // items than requested, there are no more server pages to fetch. Mark the
      // city sequence as exhausted so the IntersectionObserver halts.
      if (isCityFetch && newPois.length < CITY_PAGE_SIZE) {
        cityFetchExhaustedRef.current = true;
      }

      // FIX 2 (setPois-as-getter anti-pattern): return the data directly so
      // the search effect can inspect it without a no-op setState trick.
      return newPois;
    } catch (err) {
      if ((err as Error).name === 'AbortError') { aborted = true; return null; }
      setError((err as Error).message);
      return null;
    } finally {
      fetchingRef.current = false;
      if (!aborted) setLoading(false);
    }
  }, [selRegions, selCats, selDiffs, debouncedSearch, hasWater, hasShade, accessible]);

  // ── Unified search + geocoding effect ────────────────────────────────────
  //
  // FIX (Bug 1 — Competing Timers): Replaces the two separate debounce effects
  // (400 ms POI fetch + 600 ms geocode) with a single pipeline gated on
  // `debouncedSearch`. After the 400 ms debounce fires we attempt geocoding
  // only when the standard DB search yields no strong match. This guarantees
  // the geocode never runs before the POI fetch resolves.
  //
  // FIX (Bug 3 — Clear Duplication): When the search box is cleared,
  // `debouncedSearch` settles to '' and this is the ONLY effect that reacts,
  // performing exactly one reset fetch.
  //
  // FIX (Bug 2 — Filter Blocking): Filters change `fetchPage`'s identity via
  // its `useCallback` deps. That causes `debouncedSearch` to also appear in
  // this effect's dep array (via `fetchPage`), so filter changes re-run this
  // effect and trigger a fresh fetch regardless of whether city mode is active.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const term = debouncedSearch.trim();

      if (!term) {
        // User cleared the search box — exit city mode and do one normal fetch.
        fetchModeRef.current = 'normal';
        cityResultRef.current = null;
        setCityResult(null);
        setCitySearching(false);
        setPois([]);
        pageRef.current = 0;
        setTotalCount(null);
        fetchingRef.current = false;
        await fetchPage(0, userCoords);
        return;
      }

      // --- Standard POI fetch (always runs first) ---
      fetchModeRef.current = 'normal';
      setPois([]);
      pageRef.current = 0;
      setTotalCount(null);
      fetchingRef.current = false;
      const normalResults = await fetchPage(0, userCoords);

      if (cancelled) return;

      // --- Geocode attempt (only if standard search found no strong match) ---
      // FIX 2 (setPois-as-getter anti-pattern): fetchPage now returns the fetched
      // array directly, so we inspect it here instead of misusing setState as a
      // synchronous read mechanism (which is undefined behaviour — React batches
      // updates and the updater function is not guaranteed to run immediately).
      const strongMatch = (normalResults ?? []).some(
        p => p.name === term || p.name.startsWith(term + ' '),
      );

      if (strongMatch) {
        cityResultRef.current = null;
        setCityResult(null);
        return;
      }

      // Attempt geocoding
      setCitySearching(true);
      const result = await geocodeCity(term);
      if (cancelled) return;

      setCitySearching(false);

      if (!result) {
        cityResultRef.current = null;
        setCityResult(null);
        return;
      }

      // Enter city mode — set the ref BEFORE triggering the city fetch so
      // fetchPage snapshots the correct mode.
      fetchModeRef.current = 'city';
      cityResultRef.current = result;
      setCityResult(result);
      setPois([]);
      pageRef.current = 0;
      setTotalCount(null);
      fetchingRef.current = false;
      // Pass the city's coordinates so the server sorts its 200-item batch by
      // proximity to the city centre. Without this the server returns an
      // arbitrary 200 POIs, and the client-side radius filter finds 0 matches
      // for a city whose POIs sit further down in the un-sorted database.
      await fetchPage(0, { lat: result.lat, lng: result.lng });
    };

    run();

    return () => { cancelled = true; };
    // fetchPage identity changes when filters change, which correctly triggers
    // a re-run of this effect even in city mode — fixing Bug 2.
  }, [debouncedSearch, fetchPage, userCoords]);  

  // ── URL category param ────────────────────────────────────────────────────
  useEffect(() => {
    if (urlCategory && !selCats.includes(urlCategory)) setSelCats([urlCategory]);
  }, [urlCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IntersectionObserver — load next page on scroll ───────────────────────
  const observer = useRef<IntersectionObserver | null>(null);

  // FIX 3 (Memory leak): Disconnect the observer when the component unmounts.
  // lastPoiRef only disconnects when a new last-node is assigned; it never runs
  // on unmount, leaving a live observer pointing at a detached DOM node.
  useEffect(() => {
    return () => { observer.current?.disconnect(); };
  }, []);

  const lastPoiRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
        // FIX 4 (City-mode infinite pagination): in city mode the server's
        // totalCount may be in the thousands while the radius filter yields
        // only a handful of visible cards. Don't keep paging once the server
        // has confirmed it has no more candidates (short-page signal).
        if (fetchModeRef.current === 'city' && cityFetchExhaustedRef.current) return;

        pageRef.current += 1;
        let coords: { lat: number; lng: number } | null;
        if (fetchModeRef.current === 'city') {
          coords = cityResultRef.current ? { lat: cityResultRef.current.lat, lng: cityResultRef.current.lng } : null;
        } else {
          coords = userCoords;
        }
        fetchPage(pageRef.current, coords);
      }
    });
    if (node) observer.current.observe(node);
  }, [hasMore, fetchPage, userCoords]);

  // ── Client-side city-radius filter ───────────────────────────────────────
  // Pure display transform — never triggers a fetch.
  const displayedPois = useMemo(() => {
    if (!cityResult || !debouncedSearch.trim()) return pois;
    return pois
      .flatMap(p => {
        const dist = haversineDistance(cityResult.lat, cityResult.lng, p.latitude, p.longitude);
        if (dist > CITY_RADIUS_METERS) return [];
        return [{ ...p, distance_meters: dist }];
      })
      .sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));
  }, [pois, cityResult, debouncedSearch]);

  // ── GPS proximity toggle ──────────────────────────────────────────────────
  const handleProximityToggle = useCallback(async () => {
    if (sortByProximity) {
      setSortByProximity(false);
      setUserCoords(null);
      setGeoError(null);
      return;
    }
    if (!navigator.geolocation) {
      setGeoError('הדפדפן שלך אינו תומך באיתור מיקום');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        // Exiting city mode when user explicitly requests GPS proximity sort
        fetchModeRef.current = 'normal';
        cityResultRef.current = null;
        setCityResult(null);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setSortByProximity(true);
        setGeoLoading(false);
      },
      err => {
        setGeoLoading(false);
        setGeoError(err.code === 1
          ? 'אנא אפשר גישה למיקום בהגדרות הדפדפן'
          : 'לא ניתן לאתר את המיקום');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [sortByProximity]);

  const handleDeletePoi = useCallback(async (id: string) => {
    await api.locations.delete(id);
    setPois(prev => prev.filter(p => p.id !== id));
    setTotalCount(prev => prev !== null ? prev - 1 : null);
  }, []);

  const activeFilterCount =
    selRegions.length + selCats.length + selDiffs.length +
    (hasWater ? 1 : 0) + (hasShade ? 1 : 0) + (accessible ? 1 : 0);

  // ── Count bar text ────────────────────────────────────────────────────────
  let countBarNode: React.ReactNode;
  if (loading && pois.length === 0) {
    countBarNode = <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>טוען אתרים...</span>;
  } else if (error) {
    countBarNode = <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>שגיאה: {error}</span>;
  } else {
    let countBarText: string;
    if (cityResult) {
      countBarText = `${displayedPois.length} אתרים · קרוב ל-${cityResult.name}`;
    } else if (sortByProximity) {
      countBarText = `${totalCount ?? displayedPois.length} אתרים · ממוינים לפי קרבה`;
    } else {
      countBarText = `${totalCount ?? displayedPois.length} אתרים · ממוינים לפי דירוג`;
    }
    countBarNode = <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>{countBarText}</span>;
  }

  // ── Empty grid message ────────────────────────────────────────────────────
  const emptyMessage = cityResult
    ? `לא נמצאו אתרים בקרבת ${cityResult.name}`
    : 'לא נמצאו אתרים תואמים לחיפוש שלך';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', paddingBottom: 40, direction: 'rtl' }}>
      {urlCategory && (
        <div style={{ background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl' }}>
          <button onClick={() => { setSelCats([]); window.history.replaceState({}, '', '/Explore'); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>נקה</button>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>קטגוריה: {urlCategory}</span>
        </div>
      )}

      {/* Sticky search + filter bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '14px 16px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFilterOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, border: '2px solid #e2e8f0', background: activeFilterCount > 0 ? '#0d9e6e' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeFilterCount > 0 ? '#fff' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
            </button>
            {activeFilterCount > 0 && <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</div>}
          </div>

          <button onClick={() => navigate('/ContributePOI')}
            style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(13,158,110,0.2)' }} title="הוסף אתר חדש">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>

          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '2px solid #e2e8f0' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש אתרים, עיר או יישוב..."
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, fontFamily: 'Heebo, sans-serif', textAlign: 'right', color: '#1a2e2a' }} />
            {search
              ? <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            }
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {citySearching && search.trim() && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fefce8', color: '#ca8a04', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1.5px solid #fde68a' }}>🔍 מחפש יישוב...</span>
          )}
          {cityResult && search.trim() && !citySearching && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#2563eb', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1.5px solid #bfdbfe' }}>
              <span>📍 אתרים קרוב ל-{cityResult.name}</span>
              <button onClick={() => setSearch('')} aria-label="נקה חיפוש עיר" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </span>
          )}
          {sortByProximity && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf8', color: '#0d9e6e', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1.5px solid #0d9e6e' }}>
              <span>📍 מיון לפי קרבה</span>
              <button onClick={handleProximityToggle} aria-label="הסר מיון לפי קרבה" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9e6e', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </span>
          )}
          {geoError && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, background: '#fef2f2', borderRadius: 20, padding: '4px 12px', border: '1.5px solid #fca5a5' }}>⚠️ {geoError}</span>}
          {selCats.map(c => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf8', color: '#0d9e6e', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1.5px solid #0d9e6e' }}>
              <span>{c}</span>
              <button onClick={() => setSelCats(prev => prev.filter(x => x !== c))} aria-label={`הסר קטגוריה ${c}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9e6e', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </span>
          ))}
        </div>
      </div>
      {/* Count bar */}
      <div style={{ padding: '14px 20px 8px', textAlign: 'right' }}>
        {countBarNode}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: '0 16px 24px' }}>
        {displayedPois.map((poi, index) => {
          const isLast = index === displayedPois.length - 1;
          return (
            <div key={poi.id} ref={isLast ? lastPoiRef : null}>
              <POICard poi={poi} onDelete={handleDeletePoi} />
            </div>
          );
        })}
        {loading || displayedPois.length > 0 ? null : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700 }}>{emptyMessage}</div>
          </div>
        )}
      </div>

      {loading && pois.length > 0 && (
        <div style={{ textAlign: 'center', padding: '10px 20px 30px', color: '#0d9e6e', fontWeight: 600 }}>
          טוען עוד אתרים...
        </div>
      )}

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
        selectedRegions={selRegions} setSelectedRegions={setSelRegions}
        selectedCategories={selCats} setSelectedCategories={setSelCats}
        selectedDifficulties={selDiffs} setSelectedDifficulties={setSelDiffs}
        hasWater={hasWater} setHasWater={setHasWater}
        hasShade={hasShade} setHasShade={setHasShade}
        accessible={accessible} setAccessible={setAccessible}
        dynamicRegions={regions} dynamicCategories={categories}
        sortByProximity={sortByProximity} handleProximityToggle={handleProximityToggle}
        geoLoading={geoLoading} geoError={geoError}
      />

      <TripBucketFab />
      <TripBucketSheet />
    </div>
  );
}